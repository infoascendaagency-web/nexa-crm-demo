// Vista previa REAL: el servidor renderiza el artículo con el tema elegido (mismo HTML y CSS que verá el visitante) y se muestra en un iframe
// con el ancho de móvil / tablet / escritorio. Desde aquí se puede: hacer clic en un bloque para seleccionarlo, arrastrarlo para moverlo,
// cambiar su ancho (asas laterales o botones: angosto / normal / ancho / completo), alinear imágenes y agregar imágenes.
// Todo se guarda en los bloques (campo `w`, `align`, `width`) y el servidor lo renderiza con clases fijas: no hay HTML ni estilos libres.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, cx, useToast } from '../../components/ui';
import { BIcon } from './icons';
import DesignControls, { Seg3 } from './DesignControls';
import ImagePicker, { type PickedImage } from './ImagePicker';
import type { Media } from './BlockEditor';
import { blog2, errMsg, type PreviewRes, type ThemeInfo } from './blogApi';
import { absUrl } from './themeAssets';
import { blockPlain } from './analysis';
import { BW_LABEL, blockLabel, cloneBlock, uid, type BW, type Block, type PostDoc } from './types';

const DEV = { m: { w: 390, label: 'Móvil', icon: 'mobile' }, t: { w: 768, label: 'Tablet', icon: 'template' }, d: { w: 1200, label: 'Escritorio', icon: 'desktop' } } as const;
type Dev = keyof typeof DEV;
const W_ORDER: BW[] = ['narrow', 'normal', 'wide', 'full'];

const EDIT_CSS = `
html{scroll-behavior:auto}body{margin:0;background:#fff}
#root .nx-post{min-height:100vh}
#root [data-bid]{cursor:pointer}
#root [data-bid]:hover{outline:2px dashed rgba(47,111,237,.65);outline-offset:6px}
#root [data-bid].__sel{outline:2px solid #2f6fed;outline-offset:6px}
#root [data-bid].__drag{opacity:.35}
#root img,#root iframe,#root a{pointer-events:none}
#root .nx-title{cursor:text}#root .nx-title:hover{outline:2px dashed rgba(47,111,237,.65);outline-offset:6px}
#__ind{position:absolute;height:4px;background:#2f6fed;border-radius:2px;display:none;pointer-events:none;z-index:80;box-shadow:0 0 0 2px rgba(47,111,237,.25)}
#__rz[hidden]{display:none}
.__grip{position:absolute;width:14px;height:46px;margin-top:-23px;border-radius:7px;background:#2f6fed;box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:ew-resize;z-index:90;touch-action:none;display:grid;place-items:center}
.__grip::after{content:"";width:2px;height:20px;border-left:2px solid rgba(255,255,255,.85);border-right:2px solid rgba(255,255,255,.85);width:4px}
#__lbl{position:absolute;z-index:95;padding:3px 9px;border-radius:999px;background:#0b1f3a;color:#fff;font:600 12px/1.4 system-ui,sans-serif;pointer-events:none;display:none;white-space:nowrap;transform:translateX(-50%)}
`;
const SKELETON = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link id="nx-theme" rel="stylesheet"><style>${EDIT_CSS}</style></head><body><div id="root"></div><div id="__ind"></div><div id="__rz" hidden><div class="__grip" data-side="l"></div><div class="__grip" data-side="r"></div><div id="__lbl"></div></div></body></html>`;

type Props = { doc: PostDoc; authorName: string; themes: ThemeInfo[]; media: Media; onBlocks: (b: Block[]) => void; onPatch: (p: Partial<PostDoc>) => void; onEdit: (blockId: string) => void; split?: boolean };

export default function PreviewPane({ doc, authorName, themes, media, onBlocks, onPatch, onEdit, split }: Props) {
  const toast = useToast();
  const frame = useRef<HTMLIFrameElement>(null); const wrap = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Dev>(split ? 't' : typeof window !== 'undefined' && window.innerWidth < 700 ? 'm' : 'd'); const [avail, setAvail] = useState(780); const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  const [res, setRes] = useState<PreviewRes | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(true); const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<string | null>(null); const [picker, setPicker] = useState<null | { mode: 'replace' | 'after'; id: string }>(null);
  const docRef = useRef(doc); docRef.current = doc; const selRef = useRef(sel); selRef.current = sel;
  const api = useRef({ onBlocks, onEdit, setSel }); api.current = { onBlocks, onEdit, setSel };
  const lastHtml = useRef(''); const reqN = useRef(0);

  /* ---- medidas ---- */
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setAvail(Math.max(300, el.clientWidth - (window.innerWidth < 640 ? 24 : 32)))); ro.observe(el); setAvail(Math.max(300, el.clientWidth - 32)); const onR = () => setVh(window.innerHeight); window.addEventListener('resize', onR); return () => { ro.disconnect(); window.removeEventListener('resize', onR); }; }, []);
  const devW = DEV[device].w; const k = Math.min(1, avail / devW); const H = Math.max(480, Math.min(vh - 250, 980));

  /* ---- operaciones sobre bloques (siempre sobre el documento más reciente) ---- */
  const blocks = () => docRef.current.blocks;
  const setW = useCallback((id: string, w: BW) => api.current.onBlocks(blocks().map(b => (b.id === id ? ({ ...b, w } as Block) : b))), []);
  const patchBlock = (id: string, p: Partial<Block>) => onBlocks(blocks().map(b => (b.id === id ? ({ ...b, ...p } as Block) : b)));
  const move = useCallback((id: string, d: -1 | 1) => { const a = [...blocks()]; const i = a.findIndex(b => b.id === id); const j = i + d; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; api.current.onBlocks(a); }, []);
  const reorder = useCallback((id: string, target: string, after: boolean) => { const a = blocks(); const from = a.find(b => b.id === id); if (!from || id === target) return; const rest = a.filter(b => b.id !== id); let to = rest.findIndex(b => b.id === target); if (to < 0) return; if (after) to++; rest.splice(to, 0, from); api.current.onBlocks(rest); }, []);
  const remove = (id: string) => { const b = blocks().find(x => x.id === id); onBlocks(blocks().filter(x => x.id !== id)); setSel(null); if (b) toast(`${blockLabel[b.type]} eliminado`); };
  const dup = (id: string) => { const a = [...blocks()]; const i = a.findIndex(b => b.id === id); if (i < 0) return; const c = cloneBlock(a[i]); a.splice(i + 1, 0, c); onBlocks(a); setSel(c.id); };

  /* ---- pedir el render al servidor (con espera corta para no saturar al escribir) ---- */
  const key = useMemo(() => JSON.stringify([doc.blocks, doc.title, doc.excerpt, authorName, doc.categories, doc.tags, doc.featuredImage, doc.publishedAt, doc.theme, doc.layout]), [doc.blocks, doc.title, doc.excerpt, authorName, doc.categories, doc.tags, doc.featuredImage, doc.publishedAt, doc.theme, doc.layout]);
  useEffect(() => {
    setBusy(true); const n = ++reqN.current;
    const t = setTimeout(() => { blog2.preview(docRef.current, authorName).then(r => { if (n === reqN.current) { setRes(r); setErr(''); setBusy(false); } }).catch(e => { if (n === reqN.current) { setErr(errMsg(e)); setBusy(false); } }); }, 220);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line

  /* ---- iframe: esqueleto + escuchas (una sola vez) ---- */
  useEffect(() => {
    const f = frame.current; const d = f?.contentDocument; const win = f?.contentWindow; if (!f || !d || !win) return;
    d.open(); d.write(SKELETON); d.close();
    const $ = <T extends HTMLElement>(id: string) => d.getElementById(id) as T; const root = $('root'); const ind = $('__ind'); const rz = $('__rz'); const lbl = $('__lbl');
    const blockEl = (id: string | null) => (id ? root.querySelector<HTMLElement>(`[data-bid="${id}"]`) : null);
    const grips = () => rz.querySelectorAll<HTMLElement>('.__grip');
    const place = () => {
      const el = blockEl(selRef.current); if (!el) { rz.hidden = true; return; }
      const r = el.getBoundingClientRect(); const sy = win.scrollY, sx = win.scrollX; const vhh = win.innerHeight; const top = Math.max(r.top, 0), bot = Math.min(r.bottom, vhh);
      const cy = (bot - top > 30 ? (top + bot) / 2 : r.top + r.height / 2) + sy; const dw = d.documentElement.clientWidth;
      const [gl, gr] = [...grips()]; gl.style.top = gr.style.top = cy + 'px'; gl.style.left = Math.max(2, r.left + sx - 9) + 'px'; gr.style.left = Math.min(dw - 16, r.right + sx - 5) + 'px'; rz.hidden = false;
    };
    (d as unknown as { __place: () => void }).__place = place;
    let raf = 0; win.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); }, { passive: true }); win.addEventListener('resize', place);
    const idOf = (t: EventTarget | null) => (t as Element | null)?.closest?.('[data-bid]')?.getAttribute('data-bid') ?? null;
    d.addEventListener('click', e => { e.preventDefault(); if ((e.target as Element).closest?.('#__rz')) return; const id = idOf(e.target); if (id) api.current.setSel(id); else if ((e.target as Element).closest?.('.nx-title')) api.current.onEdit('__title'); else api.current.setSel(null); });
    d.addEventListener('dblclick', e => { const id = idOf(e.target); if (id) api.current.onEdit(id); });
    d.addEventListener('keydown', e => { const id = selRef.current; if (!id) return; if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(id, e.key === 'ArrowUp' ? -1 : 1); } if (e.key === 'Escape') api.current.setSel(null); });
    /* arrastrar para mover */
    let dragId: string | null = null; let target: { id: string; after: boolean } | null = null;
    const nearest = (y: number) => { let best: HTMLElement | null = null, bd = Infinity, after = false; root.querySelectorAll<HTMLElement>('[data-bid]').forEach(el => { if (el.dataset.bid === dragId) return; const r = el.getBoundingClientRect(); const mid = (r.top + r.bottom) / 2; const dist = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0; const score = dist * 1000 + Math.abs(y - mid); if (score < bd) { bd = score; best = el; after = y > mid; } }); return best ? { el: best as HTMLElement, after } : null; };
    d.addEventListener('dragstart', e => { const id = idOf(e.target); if (!id) { e.preventDefault(); return; } dragId = id; e.dataTransfer?.setData('text/plain', id); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; blockEl(id)?.classList.add('__drag'); api.current.setSel(id); rz.hidden = true; });
    d.addEventListener('dragover', e => {
      if (!dragId) return; e.preventDefault(); const n = nearest(e.clientY); if (!n) return; const r = n.el.getBoundingClientRect(); target = { id: n.el.dataset.bid!, after: n.after };
      ind.style.display = 'block'; ind.style.left = Math.max(0, r.left + win.scrollX) + 'px'; ind.style.width = r.width + 'px'; ind.style.top = (n.after ? r.bottom : r.top) + win.scrollY - 6 + 'px';
      if (e.clientY < 70) win.scrollBy(0, -16); else if (e.clientY > win.innerHeight - 70) win.scrollBy(0, 16);
    });
    const endDrag = () => { if (dragId) blockEl(dragId)?.classList.remove('__drag'); dragId = null; target = null; ind.style.display = 'none'; place(); };
    d.addEventListener('drop', e => { e.preventDefault(); if (dragId && target) reorder(dragId, target.id, target.after); endDrag(); });
    d.addEventListener('dragend', endDrag);
    /* asas para cambiar el ancho */
    let rs: { id: string; w: BW } | null = null;
    rz.addEventListener('pointerdown', e => { const g = (e.target as Element).closest('.__grip') as HTMLElement | null; const id = selRef.current; if (!g || !id) return; e.preventDefault(); g.setPointerCapture(e.pointerId); const cur = (docRef.current.blocks.find(b => b.id === id)?.w ?? 'normal') as BW; rs = { id, w: cur }; });
    rz.addEventListener('pointermove', e => {
      if (!rs) return; const body = root.querySelector<HTMLElement>('.nx-body'); if (!body) return; const br = body.getBoundingClientRect(); const cx = br.left + br.width / 2; const ratio = Math.abs(e.clientX - cx) / (br.width / 2);
      const fullR = Math.max(1.5, root.getBoundingClientRect().width / br.width); const w: BW = ratio < 0.89 ? 'narrow' : ratio < 1.21 ? 'normal' : ratio < (1.42 + fullR) / 2 ? 'wide' : 'full';
      lbl.style.display = 'block'; lbl.textContent = `Ancho: ${BW_LABEL[w]}`; lbl.style.left = e.clientX + win.scrollX + 'px'; lbl.style.top = e.clientY + win.scrollY - 36 + 'px';
      if (w !== rs.w) { rs.w = w; const el = blockEl(rs.id); if (el) { el.classList.remove('nx-w-narrow', 'nx-w-wide', 'nx-w-full'); if (w !== 'normal') el.classList.add(`nx-w-${w}`); } setW(rs.id, w); place(); }
    });
    const endRs = () => { rs = null; lbl.style.display = 'none'; place(); };
    rz.addEventListener('pointerup', endRs); rz.addEventListener('pointercancel', endRs);
    setReady(true);
  }, []); // eslint-disable-line

  /* ---- aplicar el render al iframe (sin recargar: se conserva el scroll) ---- */
  const decorate = useCallback(() => {
    const d = frame.current?.contentDocument; if (!d) return; const root = d.getElementById('root'); if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-bid]').forEach(el => { el.setAttribute('draggable', 'true'); el.classList.toggle('__sel', el.dataset.bid === selRef.current); });
    (d as unknown as { __place?: () => void }).__place?.();
  }, []);
  useEffect(() => {
    if (!ready || !res) return; const d = frame.current?.contentDocument; if (!d) return; const root = d.getElementById('root'); const link = d.getElementById('nx-theme') as HTMLLinkElement | null; if (!root || !link) return;
    if (res.themeCssUrl) { const u = absUrl(res.themeCssUrl); if (link.href !== u) link.href = u; }
    if (res.article && res.article !== lastHtml.current) { root.innerHTML = res.article; lastHtml.current = res.article; }
    decorate(); setTimeout(decorate, 350);   // (la tipografía puede cambiar las alturas al cargar)
  }, [res, ready, decorate]);
  useEffect(() => { decorate(); const d = frame.current?.contentDocument; const el = sel ? d?.querySelector<HTMLElement>(`[data-bid="${sel}"]`) : null; if (el && d) { const r = el.getBoundingClientRect(); const h = frame.current!.contentWindow!.innerHeight; if (r.bottom < 0 || r.top > h) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, [sel, decorate]);
  useEffect(() => { if (sel && !doc.blocks.some(b => b.id === sel)) setSel(null); }, [doc.blocks, sel]);

  const cur = sel ? doc.blocks.find(b => b.id === sel) : null; const idx = cur ? doc.blocks.findIndex(b => b.id === cur.id) : -1;
  const onPicked = (img: PickedImage) => {
    const p = picker; setPicker(null); if (!p) return;
    if (p.mode === 'replace') { const b = blocks().find(x => x.id === p.id); patchBlock(p.id, { src: img.src, alt: img.alt, caption: img.caption || (b?.sample ? '' : (b as { caption?: string })?.caption ?? ''), sample: undefined } as Partial<Block>); toast('Imagen agregada'); }
    else { const a = [...blocks()]; const i = a.findIndex(x => x.id === p.id); const nb: Block = { id: uid(), type: 'image', src: img.src, alt: img.alt, caption: img.caption, align: 'center', width: 'large' }; a.splice(i < 0 ? a.length : i + 1, 0, nb); onBlocks(a); setSel(nb.id); toast('Imagen insertada'); }
  };

  return <div data-testid="preview-pane">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div role="radiogroup" aria-label="Dispositivo" className="inline-flex overflow-hidden rounded-lg border border-line-2 bg-white">{(Object.keys(DEV) as Dev[]).map(d => <button key={d} type="button" role="radio" aria-checked={device === d} onClick={() => setDevice(d)} className={cx('flex h-8 cursor-pointer items-center gap-1.5 px-3 text-[13px] font-semibold', device === d ? 'bg-navy text-white' : 'text-slate hover:bg-sky')}><BIcon n={DEV[d].icon} s={15} />{DEV[d].label}<span className={cx('text-[11px] font-normal', device === d ? 'text-white/70' : 'text-mute')}>{DEV[d].w}</span></button>)}</div>
      <p className="text-[12.5px] text-slate" role="status">{busy ? <span className="inline-flex items-center gap-1.5"><Spinner s={13} />Actualizando vista previa…</span> : err ? <span className="font-semibold text-bad">{err}</span> : doc.status !== 'published' ? 'Así se verá. Aún no es público.' : 'Así se ve publicado.'}</p></div>
    <div className="mb-3 rounded-xl border border-line bg-white px-3 py-2.5"><DesignControls compact doc={doc} themes={themes} onPatch={onPatch} /></div>
    <div className={cx('flex gap-4', split ? 'flex-col' : 'flex-col xl:flex-row xl:items-start')}>
      <div ref={wrap} className="min-w-0 flex-1 rounded-xl border border-line bg-[#E9EEF3] p-3 sm:p-4">
        <div data-testid="preview-frame" data-device={device} className={cx('mx-auto overflow-hidden bg-white shadow-[var(--shadow-card)]', device === 'm' ? 'rounded-[28px] border-[6px] border-navy' : 'rounded-lg border border-line')} style={{ width: devW * k + (device === 'm' ? 12 : 2), height: H }}>
          <iframe ref={frame} title="Vista previa del artículo" data-testid="preview-iframe" style={{ width: devW, height: H / k, border: 0, display: 'block', transform: `scale(${k})`, transformOrigin: '0 0' }} />
        </div>
        {err && !res && <p role="alert" className="mt-3 rounded-lg bg-[#FDECEC] px-3 py-2 text-[13px] text-bad">No se pudo generar la vista previa: {err}</p>}
      </div>
      <aside aria-label="Bloque seleccionado" className={cx('min-w-0', split ? '' : 'xl:sticky xl:top-[68px] xl:w-[300px] xl:shrink-0')}>
        <div className="rounded-xl border border-line bg-white p-3.5">
          {!cur ? <div><p className="font-display text-[14px] font-bold text-navy">Edita desde aquí</p><ul className="mt-2 space-y-1.5 text-[12.5px] leading-snug text-slate"><li><strong className="text-navy">Clic</strong> en un bloque para seleccionarlo.</li><li><strong className="text-navy">Arrástralo</strong> para moverlo (o Alt + ↑ / ↓).</li><li><strong className="text-navy">Asas azules</strong> a los lados para cambiar su ancho.</li><li><strong className="text-navy">Doble clic</strong> para editar su texto.</li></ul>
            <Button className="mt-3 w-full" icon="plus" onClick={() => setPicker({ mode: 'after', id: doc.blocks[doc.blocks.length - 1]?.id ?? '' })}>Agregar imagen al final</Button></div>
            : <div data-testid="block-panel">
              <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-md bg-sky text-navy"><BIcon n={cur.type === 'heading' ? 'heading' : cur.type === 'paragraph' ? 'para' : cur.type === 'list' ? 'ul' : cur.type} s={15} /></span><div className="min-w-0"><p className="text-[13.5px] font-bold text-navy">{cur.type === 'heading' ? `Encabezado H${cur.level}` : blockLabel[cur.type]} <span className="font-normal text-mute">· {idx + 1} de {doc.blocks.length}</span></p><p className="truncate text-[12px] text-slate">{blockPlain(cur).slice(0, 70) || (cur.type === 'image' ? ((cur as { src: string }).src ? (cur as { alt: string }).alt : 'Sin imagen todavía') : '')}</p></div></div>
              <div className="mt-2.5 flex flex-wrap gap-1">
                <Button size="sm" icon="up" disabled={idx <= 0} onClick={() => move(cur.id, -1)} aria-label="Subir bloque">Subir</Button>
                <Button size="sm" icon="down" disabled={idx >= doc.blocks.length - 1} onClick={() => move(cur.id, 1)} aria-label="Bajar bloque">Bajar</Button>
                <Button size="sm" icon="copy" onClick={() => dup(cur.id)}>Duplicar</Button>
                <Button size="sm" variant="danger" icon="trash" onClick={() => remove(cur.id)}>Eliminar</Button></div>
              <div className="mt-3"><span className="mb-1 block text-[12.5px] font-semibold text-slate">Ancho del bloque</span><Seg3<BW> block label="Ancho del bloque" value={cur.w ?? 'normal'} onChange={v => setW(cur.id, v)} items={W_ORDER.map(w => ({ id: w, label: BW_LABEL[w] }))} /><p className="mt-1 text-[11.5px] text-mute">También con las asas azules en la vista previa.</p></div>
              {cur.type === 'image' && <div className="mt-3 space-y-2.5">
                {!cur.src ? <Button variant="primary" className="w-full" icon="download" onClick={() => setPicker({ mode: 'replace', id: cur.id })}>Agregar imagen</Button> : <Button className="w-full" onClick={() => setPicker({ mode: 'replace', id: cur.id })}>Cambiar imagen</Button>}
                <div><span className="mb-1 block text-[12.5px] font-semibold text-slate">Alineación</span><Seg3 block label="Alineación de la imagen" value={cur.align} onChange={v => patchBlock(cur.id, { align: v } as Partial<Block>)} items={[{ id: 'left', label: 'Izquierda' }, { id: 'center', label: 'Centro' }, { id: 'right', label: 'Derecha' }]} /><p className="mt-1 text-[11.5px] text-mute">Izquierda/derecha con tamaño pequeño o mediano: el texto la rodea.</p></div>
                <div><span className="mb-1 block text-[12.5px] font-semibold text-slate">Tamaño</span><Seg3 block label="Tamaño de la imagen" value={cur.width} onChange={v => patchBlock(cur.id, { width: v } as Partial<Block>)} items={[{ id: 'small', label: 'Pequeña' }, { id: 'medium', label: 'Mediana' }, { id: 'large', label: 'Grande' }, { id: 'full', label: 'Todo' }]} /></div></div>}
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                {['heading', 'paragraph', 'list', 'quote', 'callout', 'faq', 'table', 'cta', 'video'].includes(cur.type) && <Button size="sm" onClick={() => onEdit(cur.id)}>Editar contenido</Button>}
                <Button size="sm" icon="image" onClick={() => setPicker({ mode: 'after', id: cur.id })}>Insertar imagen después</Button></div>
            </div>}
        </div>
        <details className="mt-3 rounded-xl border border-line bg-white px-3.5 py-2.5"><summary className="cursor-pointer text-[13px] font-semibold text-navy">Orden de los bloques ({doc.blocks.length})</summary>
          <ol className="mt-2 max-h-72 space-y-0.5 overflow-auto" aria-label="Orden de los bloques">{doc.blocks.map((b, i) => <li key={b.id} className={cx('flex items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px]', sel === b.id ? 'bg-sky' : 'hover:bg-canvas')}>
            <button type="button" className="min-w-0 flex-1 cursor-pointer truncate text-left" onClick={() => setSel(b.id)}><span className="font-semibold text-navy">{b.type === 'heading' ? `H${b.level}` : blockLabel[b.type]}</span> <span className="text-slate">{blockPlain(b).slice(0, 34)}</span></button>
            <button type="button" aria-label={`Subir ${blockLabel[b.type]} ${i + 1}`} disabled={i === 0} onClick={() => move(b.id, -1)} className="grid h-6 w-6 cursor-pointer place-items-center rounded text-slate hover:bg-white disabled:opacity-30"><BIcon n="up" s={13} /></button>
            <button type="button" aria-label={`Bajar ${blockLabel[b.type]} ${i + 1}`} disabled={i === doc.blocks.length - 1} onClick={() => move(b.id, 1)} className="grid h-6 w-6 cursor-pointer place-items-center rounded text-slate hover:bg-white disabled:opacity-30"><BIcon n="down" s={13} /></button></li>)}</ol></details>
      </aside>
    </div>
    {picker && <ImagePicker media={media} replacing={picker.mode === 'replace' && !!(doc.blocks.find(b => b.id === picker.id) as { src?: string } | undefined)?.src} onClose={() => setPicker(null)} onInsert={onPicked} />}
  </div>;
}
