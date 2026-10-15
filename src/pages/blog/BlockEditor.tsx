// Editor por bloques: añadir / quitar / duplicar / mover (botones y arrastrar) con ayuda contextual en cada encabezado.
import { Fragment, useEffect, useRef, useState } from 'react';
import { Button, IconButton, Input, Spinner, cx, useToast } from '../../components/ui';
import Icon from '../../components/Icon';
import RichText from './RichText';
import { BIcon } from './icons';
import { TONES } from './ArticleView';
import { cloneBlock, blockLabel, makeBlock, parseVideo, isSafeImage, fixLink, safeLink, BUILTIN_EMBEDS, type Block, type BlockType, type Runs } from './types';
import type { Issue } from './analysis';

export type Media = { status: 'unknown' | 'ready' | 'unconfigured'; upload: (f: File) => Promise<string> };
type Props = { blocks: Block[]; onChange: (b: Block[]) => void; issues: Map<string, Issue[]>; media: Media; focusId: string | null; onFocused: () => void; onFeatured: (src: string, alt: string) => void; featuredSrc: string | undefined; onFocusBlock?: (id: string | null) => void; onAddImage?: () => void; onPasteContent?: () => void };

type Entry = { key: string; type: BlockType; level?: 2 | 3 | 4; icon: string; name: string; desc: string; group: string };
export const ENTRIES: Entry[] = [
  { key: 'h2', type: 'heading', level: 2, icon: 'heading', name: 'Encabezado H2', desc: 'Sección principal. Responde una pregunta del lector.', group: 'Texto' },
  { key: 'h3', type: 'heading', level: 3, icon: 'heading', name: 'Encabezado H3', desc: 'Detalle dentro de un H2: pasos, ejemplos, opciones.', group: 'Texto' },
  { key: 'h4', type: 'heading', level: 4, icon: 'heading', name: 'Encabezado H4', desc: 'Subdivisión fina dentro de un H3. Úsalo poco.', group: 'Texto' },
  { key: 'p', type: 'paragraph', icon: 'para', name: 'Párrafo', desc: 'Texto con negrita, cursiva y enlaces.', group: 'Texto' },
  { key: 'list', type: 'list', icon: 'ul', name: 'Lista', desc: 'Viñetas o pasos numerados.', group: 'Texto' },
  { key: 'quote', type: 'quote', icon: 'quote', name: 'Cita', desc: 'Opinión de un cliente o frase destacada.', group: 'Texto' },
  { key: 'image', type: 'image', icon: 'image', name: 'Imagen', desc: 'Sube una foto o pega su dirección. Pide texto alternativo.', group: 'Contenido' },
  { key: 'video', type: 'video', icon: 'video', name: 'Video / incrustado', desc: 'YouTube, Vimeo, Loom, Calendly, Mapas… pega el enlace.', group: 'Contenido' },
  { key: 'table', type: 'table', icon: 'table', name: 'Tabla', desc: 'Compara datos en filas y columnas.', group: 'Contenido' },
  { key: 'faq', type: 'faq', icon: 'faq', name: 'Preguntas frecuentes', desc: 'Preguntas y respuestas; Google puede mostrarlas.', group: 'Contenido' },
  { key: 'callout', type: 'callout', icon: 'callout', name: 'Aviso', desc: 'Caja de consejo, advertencia o dato clave.', group: 'Destacar' },
  { key: 'cta', type: 'cta', icon: 'cta', name: 'Botón', desc: 'Llamada a la acción con enlace.', group: 'Destacar' },
  { key: 'divider', type: 'divider', icon: 'divider', name: 'Separador', desc: 'Línea para separar partes largas.', group: 'Destacar' },
];
const HINT: Record<number, string> = { 2: 'Sección principal: una idea grande que responde a una pregunta del lector.', 3: 'Detalle dentro de la sección anterior: un paso, un ejemplo o una opción.', 4: 'Subdivisión fina de un H3. Si dudas, usa un H3.' };

export function InsertMenu({ onPick, label = 'Añadir bloque', variant = 'inline' }: { onPick: (e: Entry) => void; label?: string; variant?: 'inline' | 'big' }) {
  const [open, setOpen] = useState(false); const [pos, setPos] = useState<{ up: boolean; max: number }>({ up: false, max: 480 }); const ref = useRef<HTMLDivElement>(null); const trig = () => ref.current?.querySelector('button') as HTMLButtonElement | null;
  const toggle = () => {
    if (!open) { const r = trig()!.getBoundingClientRect(); const below = window.innerHeight - r.bottom - 16, above = r.top - 72; const up = below < 380 && above > below; setPos({ up, max: Math.max(220, Math.min(560, up ? above : below)) }); }
    setOpen(o => !o);
  };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trig()?.focus(); } };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); };
  }, [open]);
  const trigger = variant === 'big'
    ? <Button variant="secondary" icon="plus" onMouseDown={e => e.preventDefault()} onClick={toggle} aria-expanded={open} aria-haspopup="menu">{label}</Button>
    : <button type="button" onMouseDown={e => e.preventDefault()} onClick={toggle} aria-expanded={open} aria-haspopup="menu" aria-label={label} title={label} className="group/ins relative flex h-5 w-full cursor-pointer items-center justify-center focus-visible:outline-offset-0"><span className="absolute inset-x-0 top-1/2 h-px bg-transparent group-hover/ins:bg-line-2 group-focus-visible/ins:bg-link" /><span className="relative grid h-5 w-5 place-items-center rounded-full border border-line-2 bg-white text-slate opacity-0 shadow-sm group-hover/ins:opacity-100 group-focus-visible/ins:opacity-100 hover:bg-navy hover:text-white"><Icon n="plus" s={12} /></span></button>;
  return <div ref={ref} className={cx('relative', variant === 'big' ? 'inline-block' : 'block')}>{trigger}
    {open && <div role="menu" aria-label="Tipos de bloque" style={{ maxHeight: pos.max }} className={cx('pop absolute left-1/2 z-50 w-[min(92vw,600px)] -translate-x-1/2 overflow-auto rounded-xl border border-line bg-white p-2 shadow-[var(--shadow-pop)]', pos.up ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5')}>
      {['Texto', 'Contenido', 'Destacar'].map(g => <div key={g} className="mb-1"><p className="px-2 pb-1 pt-1 text-[11.5px] font-bold uppercase tracking-wide text-mute">{g}</p>
        <div className="grid gap-1 sm:grid-cols-2">{ENTRIES.filter(e => e.group === g).map(e => <button key={e.key} role="menuitem" type="button" onMouseDown={ev => ev.preventDefault()} onClick={() => { setOpen(false); onPick(e); }} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-sky focus-visible:bg-sky">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky text-navy"><BIcon n={e.icon} s={17} /></span>
          <span className="min-w-0"><span className="block text-[13.5px] font-semibold text-navy">{e.name}</span><span className="block text-[12.5px] leading-snug text-slate">{e.desc}</span></span></button>)}</div></div>)}
    </div>}
  </div>;
}

export function Seg<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  return <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-lg border border-line-2 bg-white">{items.map(i => <button key={i.id} type="button" role="radio" aria-checked={value === i.id} onClick={() => onChange(i.id)} className={cx('h-7 cursor-pointer px-2.5 text-[12.5px] font-semibold', value === i.id ? 'bg-navy text-white' : 'text-slate hover:bg-sky')}>{i.label}</button>)}</div>;
}
const lbl = 'mb-1 block text-[12.5px] font-semibold text-slate';
/** Campo de una línea que crece en alto si el texto no cabe (los encabezados largos no se cortan). */
function GrowText({ value, onChange, onEnter, ...p }: { value: string; onChange: (v: string) => void; onEnter?: () => void } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={e => onChange(e.target.value.replace(/\n/g, ' '))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }} {...p} />;
}

export default function BlockEditor({ blocks, onChange, issues, media, focusId, onFocused, onFeatured, featuredSrc, onFocusBlock, onAddImage, onPasteContent }: Props) {
  const toast = useToast(); const [autoId, setAutoId] = useState<string | null>(null); const [drag, setDrag] = useState<{ id: string; over: string | null; after: boolean } | null>(null); const [focused, setFocused] = useState<string | null>(null);
  useEffect(() => { if (autoId) { const t = setTimeout(() => setAutoId(null), 300); return () => clearTimeout(t); } }, [autoId]);
  useEffect(() => { if (focusId) { const t = setTimeout(onFocused, 50); return () => clearTimeout(t); } }, [focusId, onFocused]);
  const set = (id: string, patch: Partial<Block>) => onChange(blocks.map(b => (b.id === id ? ({ ...b, ...patch, sample: undefined } as Block) : b)));   // al editar un bloque de ejemplo deja de serlo
  const keepSample = (id: string) => onChange(blocks.map(b => (b.id === id ? ({ ...b, sample: undefined } as Block) : b)));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= blocks.length) return; const a = [...blocks]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); toast(`${blockLabel[blocks[i].type]} movido ${d < 0 ? 'arriba' : 'abajo'}`); };
  const insert = (at: number, e: Entry) => { const b = makeBlock(e.type, { level: e.level }); const a = [...blocks]; a.splice(at, 0, b); onChange(a); setFocused(b.id); setAutoId(b.id); return b; };
  const remove = (i: number) => { const b = blocks[i]; onChange(blocks.filter((_, k) => k !== i)); toast(`${blockLabel[b.type]} eliminado`); };
  const dup = (i: number) => { const a = [...blocks]; a.splice(i + 1, 0, cloneBlock(blocks[i])); onChange(a); };
  const drop = () => { if (!drag?.over || drag.over === drag.id) return setDrag(null); const from = blocks.findIndex(b => b.id === drag.id); const a = blocks.filter(b => b.id !== drag.id); let to = a.findIndex(b => b.id === drag.over); if (drag.after) to++; a.splice(to, 0, blocks[from]); onChange(a); setDrag(null); };
  // contexto de encabezados para la ayuda de cada H
  const parent: Record<string, string> = {}; { const last: Record<number, string> = {}; for (const b of blocks) if (b.type === 'heading') { parent[b.id] = last[b.level - 1] ?? ''; last[b.level] = b.text; for (let l = b.level + 1; l <= 4; l++) delete last[l]; } }

  return <div>
    {blocks.length === 0 && <div className="rounded-xl border-2 border-dashed border-line-2 bg-white/60 px-6 py-10 text-center"><p className="font-display text-[17px] font-bold text-navy">Empieza a escribir</p><p className="mx-auto mt-1 max-w-md text-[13.5px] text-slate">Añade un primer bloque. Un buen artículo alterna encabezados (H2/H3), párrafos cortos, listas e imágenes.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><Button variant="primary" icon="plus" onClick={() => insert(0, ENTRIES[3])}>Escribir un párrafo</Button>{onAddImage && <Button icon="image" onClick={onAddImage}>Agregar imagen</Button>}{onPasteContent && <Button onClick={onPasteContent}>Pegar contenido</Button>}<InsertMenu onPick={e => insert(0, e)} label="Elegir otro tipo de bloque" variant="big" /></div></div>}
    {blocks.length > 0 && <InsertMenu onPick={e => insert(0, e)} />}
    {blocks.map((b, i) => {
      const iss = issues.get(b.id) ?? []; const isDrop = drag?.over === b.id && drag.id !== b.id;
      return <Fragment key={b.id}>
        <section data-block-id={b.id} data-block-type={b.type} aria-label={`${blockLabel[b.type]} ${i + 1} de ${blocks.length}`} onFocusCapture={() => { setFocused(b.id); onFocusBlock?.(b.id); }}
          onDragOver={e => { if (drag) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDrag({ ...drag, over: b.id, after: e.clientY > r.top + r.height / 2 }); } }} onDrop={e => { e.preventDefault(); drop(); }}
          className={cx('group/b relative rounded-xl border bg-white transition-shadow', focused === b.id ? 'border-line-2 shadow-[var(--shadow-card)]' : 'border-transparent hover:border-line', drag?.id === b.id && 'opacity-40', iss.some(x => x.sev === 'error') && 'border-bad/50')}>
          {isDrop && <span className={cx('pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-link', drag!.after ? '-bottom-1' : '-top-1')} />}
          <div className="flex items-center gap-1 border-b border-transparent px-2 pt-1.5 group-focus-within/b:border-line/70 group-hover/b:border-line/70">
            <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', b.id); e.dataTransfer.effectAllowed = 'move'; setDrag({ id: b.id, over: null, after: false }); }} onDragEnd={() => setDrag(null)} title="Arrastra para mover" aria-hidden="true" className="grid h-7 w-6 cursor-grab place-items-center rounded text-mute-2 hover:bg-sky active:cursor-grabbing"><BIcon n="grip" s={15} /></span>
            <span className="mr-auto flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-mute">{b.type === 'heading' ? `H${b.level}` : blockLabel[b.type]}{iss.length > 0 && <span className={cx('rounded-full px-1.5 text-[10.5px] normal-case tracking-normal', iss.some(x => x.sev === 'error') ? 'bg-[#FDECEC] text-bad' : 'bg-[#FDF5E3] text-[#8A5A0B]')}>{iss.length} aviso{iss.length > 1 ? 's' : ''}</span>}{b.sample && <span data-testid="sample-chip" className="inline-flex items-center gap-1 rounded-full bg-[#FFF1D6] px-2 text-[10.5px] normal-case tracking-normal text-[#8A5A0B]">Texto de ejemplo: reemplázalo<button type="button" onClick={() => keepSample(b.id)} className="cursor-pointer font-bold underline" title="Dejar este contenido tal cual y quitar la marca">Ya está listo</button></span>}</span>
            <div className="flex items-center opacity-0 group-focus-within/b:opacity-100 group-hover/b:opacity-100 max-md:opacity-100">
              <IconButton n="up" label={`Subir ${blockLabel[b.type]}`} className="!h-7 !w-7" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton n="down" label={`Bajar ${blockLabel[b.type]}`} className="!h-7 !w-7" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} />
              <IconButton n="copy" label={`Duplicar ${blockLabel[b.type]}`} className="!h-7 !w-7" onClick={() => dup(i)} />
              <IconButton n="trash" label={`Eliminar ${blockLabel[b.type]}`} className="!h-7 !w-7 hover:!text-bad" onClick={() => remove(i)} />
            </div>
          </div>
          <div className="px-3.5 pb-3.5 pt-2.5">
            <BlockBody b={b} set={p => set(b.id, p)} auto={(autoId ?? focusId) === b.id} media={media} parent={parent[b.id]} insertAfter={e => insert(i + 1, e)} onFeatured={onFeatured} isFeatured={!!featuredSrc && b.type === 'image' && featuredSrc === b.src} removeSelf={() => remove(i)} />
            {iss.length > 0 && <ul className="mt-2 space-y-1">{iss.map(x => <li key={x.id} className={cx('flex items-start gap-1.5 text-[12.5px]', x.sev === 'error' ? 'text-bad' : 'text-[#8A5A0B]')}><BIcon n="alert" s={14} className="mt-0.5 shrink-0" /><span><strong>{x.title}.</strong> {x.detail}</span></li>)}</ul>}
          </div>
        </section>
        <InsertMenu onPick={e => insert(i + 1, e)} />
      </Fragment>;
    })}
    {blocks.length > 0 && <div className="mt-2 flex flex-wrap justify-center gap-2"><InsertMenu onPick={e => insert(blocks.length, e)} variant="big" label="Añadir bloque" />{onAddImage && <Button icon="image" onClick={onAddImage}>Agregar imagen</Button>}</div>}
  </div>;
}

/* ---------------- cuerpo de cada tipo ---------------- */
function BlockBody({ b, set, auto, media, parent, insertAfter, onFeatured, isFeatured, removeSelf }: { b: Block; set: (p: any) => void; auto: boolean; media: Media; parent?: string; insertAfter: (e: Entry) => void; onFeatured: (src: string, alt: string) => void; isFeatured: boolean; removeSelf: () => void }) {
  const newPara = () => insertAfter(ENTRIES[3]);
  switch (b.type) {
    case 'heading': {
      const len = b.text.trim().length; const max = b.level === 2 ? 70 : 90;
      return <div>
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1"><Seg<string> label="Nivel del encabezado" value={String(b.level)} onChange={v => set({ level: Number(v) })} items={[{ id: '2', label: 'H2' }, { id: '3', label: 'H3' }, { id: '4', label: 'H4' }]} />
          <span className="order-last min-w-0 basis-full text-[12.5px] text-slate sm:order-none sm:basis-0 sm:flex-1">{HINT[b.level]}{b.level > 2 && parent ? <> Cuelga de «<strong className="text-navy">{parent.length > 40 ? parent.slice(0, 40) + '…' : parent}</strong>».</> : null}</span><span className={cx('ml-auto shrink-0 text-[11.5px] tabular', len > max ? 'font-bold text-[#8A5A0B]' : 'text-mute')}>{len}/{max}</span></div>
        <GrowText autoFocus={auto} value={b.text} onChange={v => set({ text: v })} onEnter={newPara} maxLength={200} aria-label={`Texto del encabezado H${b.level}`} placeholder={b.level === 2 ? 'Ej. ¿Cuánto cuesta cambiar un techo?' : b.level === 3 ? 'Ej. Paso 1: inspecciona el tejado' : 'Subdetalle'}
          className={cx('w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 font-display font-bold leading-tight text-navy placeholder:font-normal placeholder:text-mute hover:border-line focus:border-link focus:bg-white focus:outline-none focus:ring-2 focus:ring-link/25', b.level === 2 ? 'text-[24px]' : b.level === 3 ? 'text-[19px]' : 'text-[16px]')} />
      </div>;
    }
    case 'paragraph': return <RichText value={b.runs} onChange={runs => set({ runs })} ariaLabel="Párrafo" placeholder={b.hint || 'Escribe aquí…'} autoFocus={auto} onEnter={newPara} onBackspaceEmpty={removeSelf} className="text-[15.5px] leading-7" />;
    case 'list': return <ListBody b={b} set={set} auto={auto} removeSelf={removeSelf} />;
    case 'quote': return <div className="border-l-4 border-brand pl-3"><RichText value={b.runs} onChange={runs => set({ runs })} ariaLabel="Texto de la cita" placeholder={b.hint || 'Texto de la cita'} autoFocus={auto} className="text-[17px] italic leading-7 text-navy" /><Input className="mt-2 !h-8 max-w-sm !text-[13px]" value={b.cite ?? ''} onChange={e => set({ cite: e.target.value })} placeholder="Quién lo dijo (opcional)" aria-label="Autor de la cita" maxLength={200} /></div>;
    case 'callout': return <div className={cx('rounded-xl border p-3', TONES[b.tone].box)}>
      <div className="mb-2 flex flex-wrap items-center gap-2"><Seg<string> label="Tipo de aviso" value={b.tone} onChange={v => set({ tone: v })} items={Object.entries(TONES).map(([id, t]) => ({ id, label: t.label }))} /></div>
      <Input value={b.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="Título del aviso (opcional)" aria-label="Título del aviso" className="mb-2 !h-8 !bg-white/70 font-semibold" maxLength={120} />
      <RichText value={b.runs} onChange={runs => set({ runs })} ariaLabel="Texto del aviso" placeholder={b.hint || 'Escribe el aviso…'} autoFocus={auto} className="text-[15px] leading-7" /></div>;
    case 'cta': return <CtaBody b={b} set={set} auto={auto} />;
    case 'divider': return <hr className="my-2 border-line-2" />;
    case 'video': return <VideoBody b={b} set={set} auto={auto} />;
    case 'table': return <TableBody b={b} set={set} auto={auto} />;
    case 'faq': return <FaqBody b={b} set={set} auto={auto} />;
    case 'image': return <ImageBody b={b} set={set} media={media} auto={auto} onFeatured={onFeatured} isFeatured={isFeatured} />;
  }
}

function ListBody({ b, set, auto, removeSelf }: { b: Extract<Block, { type: 'list' }>; set: (p: any) => void; auto: boolean; removeSelf: () => void }) {
  const [fi, setFi] = useState<number | null>(null); const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (fi != null) { (root.current?.querySelectorAll('li [role=textbox]')[fi] as HTMLElement | undefined)?.focus(); setFi(null); } }, [fi, b.items]);
  return <div ref={root}>
    <div className="mb-2"><Seg<string> label="Tipo de lista" value={b.ordered ? 'o' : 'u'} onChange={v => set({ ordered: v === 'o' })} items={[{ id: 'u', label: 'Viñetas' }, { id: 'o', label: 'Numerada' }]} /></div>
    <ul className="space-y-1.5">{b.items.map((it, i) => <li key={i} className="flex items-start gap-2"><span className="mt-[3px] w-5 shrink-0 text-right text-[14px] font-semibold text-mute">{b.ordered ? `${i + 1}.` : '•'}</span>
      <RichText value={it} onChange={runs => set({ items: b.items.map((x, k) => (k === i ? runs : x)) })} singleLine ariaLabel={`Elemento ${i + 1} de la lista`} placeholder="Elemento de la lista" autoFocus={auto && i === 0} className="min-w-0 flex-1 text-[15.5px] leading-7"
        onEnter={() => { const a = [...b.items]; a.splice(i + 1, 0, []); set({ items: a }); setFi(i + 1); }}
        onBackspaceEmpty={() => { if (b.items.length > 1) { set({ items: b.items.filter((_, k) => k !== i) }); setFi(Math.max(0, i - 1)); } else removeSelf(); }} />
      <IconButton n="x" label={`Quitar elemento ${i + 1}`} className="!h-6 !w-6" disabled={b.items.length <= 1} onClick={() => set({ items: b.items.filter((_, k) => k !== i) })} /></li>)}</ul>
    <Button size="sm" variant="ghost" icon="plus" className="mt-1.5" onClick={() => set({ items: [...b.items, []] })} disabled={b.items.length >= 100}>Añadir elemento</Button></div>;
}
function CtaBody({ b, set, auto }: { b: Extract<Block, { type: 'cta' }>; set: (p: any) => void; auto: boolean }) {
  const bad = b.url.trim() && !safeLink(fixLink(b.url));
  return <div className="grid gap-3 sm:grid-cols-2">
    <label><span className={lbl}>Texto del botón</span><Input autoFocus={auto} value={b.text} onChange={e => set({ text: e.target.value })} maxLength={80} /></label>
    <label><span className={lbl}>Dirección (enlace)</span><Input value={b.url} onChange={e => set({ url: e.target.value })} onBlur={() => b.url && set({ url: fixLink(b.url) })} placeholder="https://… o /contacto" aria-invalid={!!bad} />{bad && <span role="alert" className="mt-1 block text-[12px] text-bad">Debe empezar por https://, mailto: o / (ruta del sitio).</span>}</label>
    <div><span className={lbl}>Estilo</span><Seg<string> label="Estilo del botón" value={b.style} onChange={v => set({ style: v })} items={[{ id: 'primary', label: 'Principal' }, { id: 'secondary', label: 'Secundario' }]} /></div>
    <label><span className={lbl}>Nota bajo el botón (opcional)</span><Input value={b.note ?? ''} onChange={e => set({ note: e.target.value })} maxLength={200} placeholder="Ej. Sin compromiso" /></label>
    <div className="sm:col-span-2"><span className={cx('inline-flex h-10 items-center rounded-lg px-5 text-[14.5px] font-semibold', b.style === 'primary' ? 'bg-brand-600 text-white' : 'border border-navy text-navy')}>{b.text || 'Botón'}</span></div></div>;
}
function VideoBody({ b, set, auto }: { b: Extract<Block, { type: 'video' }>; set: (p: any) => void; auto: boolean }) {
  const v = parseVideo(b.url); const NAME: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', loom: 'Loom', wistia: 'Wistia', dailymotion: 'Dailymotion', gmaps: 'Google Maps', calendly: 'Calendly', spotify: 'Spotify', custom: 'Dominio autorizado' };
  return <div><label><span className={lbl}>Pega el enlace del video o contenido</span><Input autoFocus={auto} value={b.url} onChange={e => set({ url: e.target.value })} placeholder="https://www.youtube.com/watch?v=… · loom.com/share/… · calendly.com/…" aria-invalid={!!b.url && !v} /></label>
    {b.url && (v ? <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-good"><Icon n="check" s={14} />{NAME[v.provider] ?? v.provider} · se incrusta de forma segura (lo verás en la Vista previa).</p> : <p role="alert" className="mt-2 text-[12.5px] text-bad">No reconocemos este enlace. Pega la dirección completa (https://) de uno de los proveedores permitidos; si usas otro dominio, pídele a un administrador que lo autorice en «Ajustes del blog».</p>)}
    <p className="mt-2 text-[12px] leading-snug text-slate"><strong className="text-navy">Permitidos:</strong> {BUILTIN_EMBEDS.map(e => e.name).join(', ')} y los dominios que autorice un administrador. Por seguridad nunca se admite código HTML ni iframes pegados: solo el enlace.</p>
    <label className="mt-3 block"><span className={lbl}>Pie del video (opcional)</span><Input value={b.caption ?? ''} onChange={e => set({ caption: e.target.value })} maxLength={300} /></label></div>;
}
function TableBody({ b, set, auto }: { b: Extract<Block, { type: 'table' }>; set: (p: any) => void; auto: boolean }) {
  const cols = b.rows[0]?.length ?? 1;
  const cell = (r: number, c: number, v: string) => set({ rows: b.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) });
  return <div>
    <div className="mb-2 flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" className="accent-navy" checked={b.header} onChange={e => set({ header: e.target.checked })} />La primera fila es el encabezado</label>
      <Button size="sm" variant="ghost" icon="plus" disabled={b.rows.length >= 30} onClick={() => set({ rows: [...b.rows, Array(cols).fill('')] })}>Fila</Button>
      <Button size="sm" variant="ghost" icon="plus" disabled={cols >= 8} onClick={() => set({ rows: b.rows.map(r => [...r, '']) })}>Columna</Button></div>
    <div className="overflow-x-auto"><table className="w-full border-collapse"><tbody>{b.rows.map((row, r) => <tr key={r}>{row.map((c, j) => <td key={j} className="border border-line-2 p-0"><input autoFocus={auto && r === 0 && j === 0} value={c} onChange={e => cell(r, j, e.target.value)} maxLength={300} aria-label={`Fila ${r + 1}, columna ${j + 1}`} className={cx('h-9 w-full min-w-[110px] bg-transparent px-2 text-[13.5px] focus:bg-sky/50 focus:outline-none', b.header && r === 0 && 'bg-sky font-bold text-navy')} /></td>)}
      <td className="w-8 border-0 pl-1"><IconButton n="x" label={`Quitar fila ${r + 1}`} className="!h-6 !w-6" disabled={b.rows.length <= 1} onClick={() => set({ rows: b.rows.filter((_, i) => i !== r) })} /></td></tr>)}
      <tr>{Array.from({ length: cols }, (_, j) => <td key={j} className="pt-1 text-center"><button type="button" aria-label={`Quitar columna ${j + 1}`} disabled={cols <= 1} onClick={() => set({ rows: b.rows.map(r => r.filter((_, k) => k !== j)) })} className="cursor-pointer text-[11.5px] font-semibold text-slate hover:text-bad disabled:opacity-30">Quitar columna</button></td>)}<td /></tr></tbody></table></div>
    <Input className="mt-2 !h-8 max-w-sm !text-[13px]" value={b.caption ?? ''} onChange={e => set({ caption: e.target.value })} placeholder="Título de la tabla (opcional)" aria-label="Título de la tabla" maxLength={200} /></div>;
}
function FaqBody({ b, set, auto }: { b: Extract<Block, { type: 'faq' }>; set: (p: any) => void; auto: boolean }) {
  const upd = (i: number, p: Partial<{ q: string; a: Runs }>) => set({ items: b.items.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const mv = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= b.items.length) return; const a = [...b.items]; [a[i], a[j]] = [a[j], a[i]]; set({ items: a }); };
  return <div><p className="mb-2 text-[12.5px] text-slate">Cada pregunta se publica y además se marca para que Google pueda mostrarla como desplegable en los resultados.</p>
    <div className="space-y-3">{b.items.map((it, i) => <div key={i} className="rounded-lg border border-line p-3"><div className="mb-2 flex items-center gap-1"><span className="mr-auto text-[12px] font-bold text-mute">Pregunta {i + 1}</span><IconButton n="up" label={`Subir pregunta ${i + 1}`} className="!h-6 !w-6" disabled={i === 0} onClick={() => mv(i, -1)} /><IconButton n="down" label={`Bajar pregunta ${i + 1}`} className="!h-6 !w-6" disabled={i === b.items.length - 1} onClick={() => mv(i, 1)} /><IconButton n="trash" label={`Quitar pregunta ${i + 1}`} className="!h-6 !w-6 hover:!text-bad" disabled={b.items.length <= 1} onClick={() => set({ items: b.items.filter((_, k) => k !== i) })} /></div>
      <Input autoFocus={auto && i === 0} value={it.q} onChange={e => upd(i, { q: e.target.value })} placeholder="¿Cuál es la pregunta?" aria-label={`Pregunta ${i + 1}`} className="mb-2 font-semibold" maxLength={300} />
      <div className="rounded-lg border border-line-2 bg-white px-3 py-2"><RichText value={it.a} onChange={a => upd(i, { a })} ariaLabel={`Respuesta ${i + 1}`} placeholder="Respuesta clara y directa" className="text-[14.5px] leading-6" /></div></div>)}</div>
    <Button size="sm" variant="ghost" icon="plus" className="mt-2" disabled={b.items.length >= 40} onClick={() => set({ items: [...b.items, { q: '', a: [] }] })}>Añadir pregunta</Button></div>;
}
const OK_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
function ImageBody({ b, set, media, auto, onFeatured, isFeatured }: { b: Extract<Block, { type: 'image' }>; set: (p: any) => void; media: Media; auto: boolean; onFeatured: (s: string, a: string) => void; isFeatured: boolean }) {
  const toast = useToast(); const [busy, setBusy] = useState(false); const [url, setUrl] = useState(''); const [over, setOver] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const upload = async (f: File | undefined) => {
    if (!f) return; if (!OK_IMG.includes(f.type)) return toast('Formato no admitido. Usa JPG, PNG, WebP, GIF o AVIF.', 'err'); if (f.size > 8 * 1024 * 1024) return toast('La imagen pesa más de 8 MB. Reduce su tamaño y vuelve a intentarlo.', 'err');
    setBusy(true); try { const src = await media.upload(f); set({ src, alt: b.alt || f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), ...(b.sample ? { caption: '' } : {}) }); } catch (e) { toast((e as Error).message || 'No se pudo subir la imagen', 'err'); } finally { setBusy(false); }
  };
  const useUrl = () => { const u = fixLink(url); if (!isSafeImage(u)) { toast('La dirección debe empezar por https:// (o ser una ruta del sitio como /img/foto.jpg).', 'err'); return; } set({ src: u, ...(b.sample ? { caption: '' } : {}) }); setUrl(''); };
  const onPaste = (e: React.ClipboardEvent) => { const f = [...e.clipboardData.files].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); void upload(f); } };
  if (!b.src) return <div>
    <div tabIndex={0} role="group" aria-label="Zona para agregar una imagen: arrastra un archivo, pégalo con Ctrl+V o súbelo" onPaste={onPaste} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); void upload(e.dataTransfer.files[0]); }} className={cx('grid place-items-center rounded-xl border-2 border-dashed px-4 py-8 text-center outline-none focus-visible:border-link focus-visible:ring-2 focus-visible:ring-link/25', over ? 'border-link bg-sky/60' : 'border-line-2 bg-canvas/60')}>
      {busy ? <><Spinner s={22} /><p className="mt-2 text-[13.5px] text-slate">Subiendo imagen…</p></> : <>
        <BIcon n="image" s={30} className="text-slate" />
        {b.sample && b.caption && <p className="mt-1 text-[13px] font-bold text-navy">{b.caption}</p>}
        <p className="mt-1 text-[14px] font-semibold text-navy">Arrastra una imagen aquí</p>
        <p className="text-[12.5px] text-slate">o pégala con Ctrl + V · o elige un archivo:</p>
        <div className="mt-2.5 flex flex-wrap justify-center gap-2"><Button variant="primary" icon="download" disabled={media.status === 'unconfigured'} onClick={() => fileRef.current?.click()} data-autofocus={auto || undefined}>Subir desde tu equipo</Button></div>
        <input ref={fileRef} type="file" accept={OK_IMG.join(',')} className="sr-only" aria-label="Elegir imagen" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        <p className="mt-2 text-[12px] text-mute">JPG, PNG, WebP, GIF o AVIF · máx. 8 MB · ideal 1600 px de ancho</p></>}
    </div>
    {media.status === 'unconfigured' && <p role="status" className="mt-2 rounded-lg bg-[#FDF5E3] px-3 py-2 text-[12.5px] text-[#8A5A0B]"><strong>La subida de imágenes aún no está activada en este entorno.</strong> Mientras tanto pega la dirección (https://) de una imagen ya publicada, aquí abajo.</p>}
    <div className="mt-3 flex gap-2"><Input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); useUrl(); } }} placeholder="o pega la dirección de la imagen: https://…" aria-label="Dirección de la imagen" /><Button onClick={useUrl} disabled={!url.trim()}>Usar</Button></div></div>;
  const noAlt = !b.alt.trim();
  return <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
    <div><img src={b.src} alt={b.alt} className="max-h-52 w-full rounded-lg border border-line object-contain bg-canvas" onError={e => { (e.target as HTMLImageElement).style.opacity = '.3'; }} />
      <div className="mt-2 flex flex-wrap gap-1.5"><Button size="sm" onClick={() => set({ src: '' })}>Cambiar imagen</Button>{!isFeatured ? <Button size="sm" variant="ghost" onClick={() => { onFeatured(b.src, b.alt); toast('Usada como imagen destacada'); }}>Usar como destacada</Button> : <span className="inline-flex h-7 items-center rounded-lg bg-[#E6F4EC] px-2 text-[12px] font-semibold text-good">Imagen destacada</span>}</div></div>
    <div>
      <label><span className={cx(lbl, noAlt && '!text-bad')}>Texto alternativo (obligatorio)</span>
        <textarea autoFocus={auto} rows={2} value={b.alt} onChange={e => set({ alt: e.target.value })} maxLength={300} aria-required="true" aria-invalid={noAlt} aria-describedby={`alt-${b.id}`} placeholder="Describe lo que se ve. Ej. Tejado de tejas grises recién instalado en una casa de dos pisos" className={cx('w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-mute focus:outline-none focus:ring-2', noAlt ? 'border-bad focus:ring-bad/25' : 'border-line-2 focus:border-link focus:ring-link/25')} /></label>
      <p id={`alt-${b.id}`} role={noAlt ? 'alert' : undefined} className={cx('mt-1 text-[12px]', noAlt ? 'font-semibold text-bad' : 'text-mute')}>{noAlt ? 'Falta el texto alternativo: lo leen los lectores de pantalla y Google, y sin él no podrás publicar.' : `${b.alt.length} caracteres · ideal: una frase corta (menos de 125).`}</p>
      <label className="mt-3 block"><span className={lbl}>Pie de foto (opcional)</span><Input value={b.caption ?? ''} onChange={e => set({ caption: e.target.value })} maxLength={300} /></label>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2"><div><span className={lbl}>Alineación</span><Seg<string> label="Alineación" value={b.align} onChange={v => set({ align: v })} items={[{ id: 'left', label: 'Izquierda' }, { id: 'center', label: 'Centro' }, { id: 'right', label: 'Derecha' }]} /></div>
        <div><span className={lbl}>Ancho</span><Seg<string> label="Ancho" value={b.width} onChange={v => set({ width: v })} items={[{ id: 'small', label: 'Pequeña' }, { id: 'medium', label: 'Mediana' }, { id: 'large', label: 'Grande' }, { id: 'full', label: 'Completo' }]} /></div></div>
    </div></div>;
}
