// "Pegar contenido": pega texto plano, Markdown o lo copiado de Word / Google Docs / una web y se convierte en bloques (nunca HTML).
// El HTML del portapapeles se interpreta con DOMParser (documento inerte: no ejecuta nada) y se reduce a Markdown; el servidor hace el resto.
import { useState } from 'react';
import { Button, Modal, Spinner, cx, useToast } from '../../components/ui';
import { BIcon } from './icons';
import { blog2, errMsg, type ImportRes } from './blogApi';

/* ───────── HTML (Word, Google Docs, web) → Markdown ───────── */
const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'BLOCKQUOTE', 'PRE', 'HR', 'SECTION', 'ARTICLE', 'FIGURE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV']);
const isBoldEl = (el: HTMLElement) => { const fw = el.style?.fontWeight; if (fw) return fw === 'bold' || fw === 'bolder' || Number(fw) >= 600; return el.tagName === 'B' || el.tagName === 'STRONG'; };   // (Google Docs envuelve todo en <b style="font-weight:normal">)
const isItalicEl = (el: HTMLElement) => (el.style?.fontStyle ? el.style.fontStyle === 'italic' : el.tagName === 'I' || el.tagName === 'EM');
function wrapMark(mark: string, inner: string) { if (!inner.trim()) return inner; const lead = inner.length - inner.trimStart().length, trail = inner.length - inner.trimEnd().length; return inner.slice(0, lead) + mark + inner.trim() + mark + inner.slice(inner.length - trail); }
function inline(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').replace(/[\r\n\t ]+/g, ' ').replace(/ {2,}/g, ' ');
  if (n.nodeType !== Node.ELEMENT_NODE) return '';
  const el = n as HTMLElement; const tag = el.tagName; if (tag === 'BR') return '\n'; if (tag === 'IMG' || tag === 'SCRIPT' || tag === 'STYLE') return '';
  let inner = ''; el.childNodes.forEach(c => { inner += inline(c); });
  if (tag === 'A') { const href = el.getAttribute('href') ?? ''; return /^(https:\/\/|mailto:|\/)/i.test(href) && inner.trim() ? `[${inner.trim()}](${href})` : inner; }
  if (isItalicEl(el)) inner = wrapMark('*', inner); if (isBoldEl(el)) inner = wrapMark('**', inner);
  return inner;
}
export function htmlToMarkdown(html: string, boldAsHeading = true): { md: string; images: number } {
  const doc = new DOMParser().parseFromString(html.slice(0, 3_000_000), 'text/html'); doc.querySelectorAll('script,style,meta,link,title,xml,noscript').forEach(n => n.remove());
  const out: string[] = []; let images = doc.querySelectorAll('img').length;
  const listItems = (list: Element, depth: number, ordered: boolean) => { let i = 0; list.childNodes.forEach(c => { if (c.nodeType !== Node.ELEMENT_NODE) return; const li = c as HTMLElement; if (li.tagName !== 'LI') return; i++; let t = ''; const subs: Element[] = []; li.childNodes.forEach(k => { if (k.nodeType === Node.ELEMENT_NODE && (['UL', 'OL'] as string[]).includes((k as Element).tagName)) subs.push(k as Element); else t += inline(k); }); t = t.replace(/\s*\n\s*/g, ' ').trim(); if (t) out.push(`${ordered ? `${i}.` : '-'} ${t}`); subs.forEach(s => listItems(s, depth + 1, s.tagName === 'OL')); }); };
  const table = (t: HTMLElement) => { const rows = [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(c => inline(c).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/').trim())).filter(r => r.length); if (!rows.length) return; const w = Math.max(...rows.map(r => r.length)); const pad = (r: string[]) => `| ${Array.from({ length: w }, (_, k) => r[k] ?? '').join(' | ')} |`; out.push(pad(rows[0]), `|${' --- |'.repeat(w)}`, ...rows.slice(1).map(pad)); out.push(''); };
  const walk = (parent: Node) => {
    parent.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) { const t = inline(n).trim(); if (t) out.push(t, ''); return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement; const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) { const t = inline(el).replace(/\*/g, '').replace(/\s*\n\s*/g, ' ').trim(); if (t) out.push(`${'#'.repeat(Number(tag[1]))} ${t}`, ''); return; }
      if (tag === 'UL' || tag === 'OL') { listItems(el, 0, tag === 'OL'); out.push(''); return; }
      if (tag === 'TABLE') { table(el); return; }
      if (tag === 'HR') { out.push('---', ''); return; }
      if (tag === 'BLOCKQUOTE') { const t = inline(el).trim(); if (t) out.push(...t.split('\n').map(l => `> ${l}`), ''); return; }
      if (tag === 'PRE') { const t = (el.textContent ?? '').trim(); if (t) out.push(t, ''); return; }
      if ((tag === 'P' || tag === 'DIV' || tag === 'LI' || tag === 'FIGURE') && [...el.children].some(c => BLOCKS.has(c.tagName) && c.tagName !== 'P' || (tag !== 'P' && c.tagName === 'P'))) { walk(el); return; }
      if (BLOCKS.has(tag) && tag !== 'P' && tag !== 'DIV' && tag !== 'LI') { walk(el); return; }
      let t = inline(el).replace(/[ \t]*\n[ \t]*/g, '\n').trim(); if (!t) return;
      const cls = (el.getAttribute('class') ?? '').toLowerCase();
      if (cls.includes('msotitle') && !t.startsWith('#')) t = '# ' + t.replace(/\*/g, '');
      else if (boldAsHeading && t.startsWith('**') && t.endsWith('**') && t.indexOf('**', 2) === t.length - 2 && t.length <= 96 && !/[.,;:!]$/.test(t.slice(0, -2))) t = '## ' + t.slice(2, -2);
      out.push(t, '');
    });
  };
  walk(doc.body);
  return { md: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), images };
}

const STAT: Record<string, [string, string]> = { heading: ['encabezado', 'encabezados'], paragraph: ['párrafo', 'párrafos'], list: ['lista', 'listas'], quote: ['cita', 'citas'], image: ['imagen', 'imágenes'], callout: ['aviso', 'avisos'], table: ['tabla', 'tablas'], video: ['video', 'videos'], faq: ['bloque de preguntas', 'bloques de preguntas'], divider: ['separador', 'separadores'], cta: ['botón', 'botones'] };
const plural = (n: number, k: string) => `${n} ${(STAT[k] ?? [k, k])[n === 1 ? 0 : 1]}`;
export type ImportMode = 'samples' | 'append' | 'all';

export default function PasteImport({ hasSamples, hasContent, titleEmpty, onClose, onApply }: { hasSamples: boolean; hasContent: boolean; titleEmpty: boolean; onClose: () => void; onApply: (r: ImportRes, mode: ImportMode) => void }) {
  const toast = useToast(); const [text, setText] = useState(''); const [plainHeadings, setPlain] = useState(true); const [firstLineTitle, setFirst] = useState(titleEmpty);
  const [mode, setMode] = useState<ImportMode>(hasSamples ? 'samples' : hasContent ? 'append' : 'all'); const [busy, setBusy] = useState(false); const [res, setRes] = useState<ImportRes | null>(null); const [note, setNote] = useState('');
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html'); if (!html || !/<(h[1-6]|p|ul|ol|table|b|strong|li)\b/i.test(html.slice(0, 200000))) return;   // texto plano normal: se deja pegar tal cual
    const conv = htmlToMarkdown(html, plainHeadings); const images = conv.images; const md = conv.md.slice(0, 200000); if (!md) return;
    e.preventDefault(); const t = e.currentTarget; const a = t.selectionStart, b = t.selectionEnd; setText(t.value.slice(0, a) + md + t.value.slice(b)); setRes(null);
    setNote(`Detectamos formato (títulos, listas, negritas, enlaces). ${images ? `Las ${images} imagen(es) copiadas no se pueden importar desde el portapapeles: agrégalas después con «Agregar imagen». ` : ''}Revisa el texto convertido abajo.`);
  };
  const convert = async () => { setBusy(true); try { setRes(await blog2.importText(text, { plainHeadings, firstLineTitle })); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); } };
  const heads = res?.blocks.filter(b => b.type === 'heading') as { level: number; text: string }[] | undefined;
  return <Modal title="Pegar contenido" width="max-w-3xl" onClose={onClose} footer={res ? <><Button onClick={() => setRes(null)}>Volver al texto</Button><Button variant="primary" disabled={!res.blocks.length} onClick={() => onApply(res, mode)}>Insertar {res.blocks.length} bloques</Button></> : <><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!text.trim() || busy} onClick={convert}>{busy ? <><Spinner s={14} /> Convirtiendo…</> : 'Convertir en bloques'}</Button></>}>
    {!res ? <div>
      <p className="mb-2 text-[13.5px] text-slate">Pega aquí tu texto: puede venir de <strong className="text-navy">Word, Google Docs, un correo o una nota</strong>. Reconocemos títulos, listas, tablas, citas y enlaces, y los ponemos en bloques con la estructura de H correcta.</p>
      <textarea autoFocus value={text} onChange={e => { setText(e.target.value); setNote(''); }} onPaste={onPaste} maxLength={200000} rows={12} aria-label="Texto a convertir" placeholder={'Cómo cuidar tu techo\n\nIntroducción…\n\n## Primera sección\nTexto…\n\n- punto uno\n- punto dos'} className="w-full resize-y rounded-lg border border-line-2 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed placeholder:text-mute focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" />
      <div className="mt-1 flex justify-between text-[12px] text-mute"><span>{note && <span className="text-navy">{note}</span>}</span><span className="tabular">{text.length.toLocaleString('es')} / 200 000</span></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-2 text-[13px] text-navy"><input type="checkbox" className="mt-1 accent-navy" checked={plainHeadings} onChange={e => setPlain(e.target.checked)} /><span><strong>Detectar títulos en texto plano</strong><span className="block text-[12px] text-slate">Líneas cortas sin punto final, en MAYÚSCULAS, «Paso 2:» o «¿Pregunta?» pasan a H2/H3.</span></span></label>
        <label className="flex cursor-pointer items-start gap-2 text-[13px] text-navy"><input type="checkbox" className="mt-1 accent-navy" checked={firstLineTitle} onChange={e => setFirst(e.target.checked)} /><span><strong>La primera línea es el título (H1)</strong><span className="block text-[12px] text-slate">{titleEmpty ? 'Se usará como título del artículo.' : 'Reemplazará el título actual.'}</span></span></label></div>
      <fieldset className="mt-3"><legend className="mb-1 text-[12.5px] font-semibold text-slate">¿Dónde se inserta?</legend><div className="flex flex-wrap gap-2">
        {([['samples', 'Reemplazar el texto de ejemplo', hasSamples], ['append', 'Añadir al final', hasContent], ['all', 'Reemplazar todo el contenido', hasContent]] as [ImportMode, string, boolean][]).filter(x => x[2] || x[0] === mode || (x[0] === 'append' && !hasContent)).map(([k, l]) => <label key={k} className={cx('cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-semibold', mode === k ? 'border-navy bg-sky/60 text-navy' : 'border-line bg-white text-slate hover:bg-sky/30')}><input type="radio" name="imode" className="sr-only" checked={mode === k} onChange={() => setMode(k)} />{l}</label>)}</div></fieldset>
    </div> : <div>
      <div className="mb-3 flex items-start gap-2 rounded-lg bg-[#E6F4EC] px-3 py-2 text-[13px] text-[#00704A]"><BIcon n="check" s={16} className="mt-0.5 shrink-0" /><span>Listo: {Object.entries(res.stats).map(([k, n]) => plural(n, k)).join(', ') || 'sin contenido'}.{res.title && <> Título detectado: <strong>«{res.title}»</strong>.</>}</span></div>
      {res.warnings.length > 0 && <ul className="mb-3 space-y-1">{res.warnings.map((w, i) => <li key={i} className="flex items-start gap-1.5 rounded-lg bg-[#FDF5E3] px-3 py-1.5 text-[12.5px] text-[#8A5A0B]"><BIcon n="alert" s={14} className="mt-0.5 shrink-0" />{w}</li>)}</ul>}
      <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-mute">Estructura de encabezados</p>
      <ol className="mb-3 max-h-56 space-y-0.5 overflow-auto rounded-lg border border-line bg-canvas/50 p-2" aria-label="Encabezados detectados">{res.title && <li className="flex gap-2 text-[13px]"><span className="mt-0.5 grid h-5 w-7 shrink-0 place-items-center rounded bg-brand-600 text-[11px] font-extrabold text-white">H1</span><strong className="text-navy">{res.title}</strong></li>}
        {(heads ?? []).map((h, i) => <li key={i} className="flex gap-2 text-[13px]" style={{ paddingLeft: (h.level - 2) * 16 }}><span className={cx('mt-0.5 grid h-5 w-7 shrink-0 place-items-center rounded text-[11px] font-extrabold', h.level === 2 ? 'bg-navy text-white' : 'bg-sky text-navy')}>H{h.level}</span><span className="text-ink">{h.text}</span></li>)}{!(heads ?? []).length && <li className="px-1 text-[12.5px] text-slate">No se detectaron encabezados. Puedes añadirlos después en el editor.</li>}</ol>
      <p className="text-[12.5px] text-slate">{mode === 'samples' ? 'Reemplazará los textos de ejemplo de la plantilla (los botones y separadores se conservan).' : mode === 'all' ? 'Reemplazará todo el contenido actual del artículo.' : 'Se añadirá al final del contenido actual.'}</p>
    </div>}
  </Modal>;
}
