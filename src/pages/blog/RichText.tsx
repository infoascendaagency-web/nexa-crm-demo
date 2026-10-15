// Texto en línea editable (negrita, cursiva, enlaces) sin HTML libre: se guarda como lista de tramos {t,b,i,a}.
// Se usa contentEditable solo como superficie de escritura; lo que sale hacia el estado se reconstruye desde el DOM
// con una lista blanca (B/STRONG, I/EM, A, BR, texto). El pegado siempre entra como texto plano.
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon';
import { cx } from '../../components/ui';
import { fixLink, safeLink, type Run, type Runs } from './types';
import { BIcon } from './icons';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function runsToHtml(rs: Runs): string {
  return rs.map(r => {
    let h = esc(r.t).replace(/\n/g, '<br>'); if (r.i) h = `<em>${h}</em>`; if (r.b) h = `<strong>${h}</strong>`;
    if (r.a && safeLink(r.a.href)) h = `<a href="${esc(r.a.href)}"${r.a.nofollow ? ' data-nf="1"' : ''}${r.a.blank ? ' data-bl="1"' : ''}>${h}</a>`;
    return h;
  }).join('');
}
type Fmt = { b?: boolean; i?: boolean; a?: Run['a'] };
export function domToRuns(root: HTMLElement, singleLine: boolean): Runs {
  const out: Run[] = [];
  const push = (t: string, f: Fmt) => { if (!t) return; const last = out[out.length - 1]; const same = last && !!last.b === !!f.b && !!last.i === !!f.i && JSON.stringify(last.a ?? null) === JSON.stringify(f.a ?? null); if (same) last.t += t; else out.push({ t, ...(f.b ? { b: true } : {}), ...(f.i ? { i: true } : {}), ...(f.a ? { a: f.a } : {}) }); };
  const walk = (n: Node, f: Fmt, top: boolean) => {
    n.childNodes.forEach((c, idx) => {
      if (c.nodeType === Node.TEXT_NODE) { push((c.textContent ?? '').replace(/ /g, ' ').replace(/[​\r]/g, '').replace(singleLine ? /\n/g : /$^/, ' '), f); return; }
      if (c.nodeType !== Node.ELEMENT_NODE) return;
      const el = c as HTMLElement; const tag = el.tagName;
      if (tag === 'BR') { if (!singleLine && !(idx === n.childNodes.length - 1 && top && false)) push('\n', f); return; }
      const nf: Fmt = { ...f };
      const st = el.style;
      if (tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) nf.b = true;
      if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') nf.i = true;
      if (tag === 'A') { const href = safeLink(el.getAttribute('href') ?? ''); if (href) nf.a = { href, ...(el.dataset.nf ? { nofollow: true } : {}), ...(el.dataset.bl ? { blank: true } : {}) }; }
      if ((tag === 'DIV' || tag === 'P') && !singleLine && out.length && !out[out.length - 1].t.endsWith('\n')) push('\n', f);   // el navegador mete <div> al pulsar Enter
      walk(el, nf, false);
    });
  };
  walk(root, {}, true);
  while (out.length && out[out.length - 1].t.endsWith('\n')) { out[out.length - 1].t = out[out.length - 1].t.replace(/\n+$/, ''); if (!out[out.length - 1].t) out.pop(); }
  return out;
}

type Props = {
  value: Runs; onChange: (r: Runs) => void; placeholder?: string; singleLine?: boolean; ariaLabel: string; className?: string; autoFocus?: boolean;
  onEnter?: () => void; onBackspaceEmpty?: () => void; id?: string; toolbar?: boolean; minRows?: number;
};
export default function RichText({ value, onChange, placeholder, singleLine, ariaLabel, className, autoFocus, onEnter, onBackspaceEmpty, id, toolbar = true }: Props) {
  const ref = useRef<HTMLDivElement>(null); const last = useRef<string>(''); const wrap = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState(false); const [link, setLink] = useState<{ url: string; nofollow: boolean; blank: boolean; err: string; existing: boolean } | null>(null);
  const [empty, setEmpty] = useState(!value.length); const saved = useRef<Range | null>(null);
  useEffect(() => { const el = ref.current; if (!el) return; const key = JSON.stringify(value); if (key !== last.current) { el.innerHTML = runsToHtml(value); last.current = key; setEmpty(!value.length || !value.some(r => r.t)); } }, [value]);
  useEffect(() => { if (autoFocus) { const el = ref.current; el?.focus(); if (el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); } } }, []); // eslint-disable-line
  const emit = useCallback(() => { const el = ref.current; if (!el) return; const rs = domToRuns(el, !!singleLine); last.current = JSON.stringify(rs); setEmpty(!rs.some(r => r.t)); onChange(rs); }, [onChange, singleLine]);
  const exec = (cmd: string) => { ref.current?.focus(); document.execCommand('styleWithCSS', false, 'false'); document.execCommand(cmd); emit(); };
  const selInside = () => { const s = getSelection(); return s && s.rangeCount && ref.current?.contains(s.anchorNode) ? s : null; };
  const openLink = () => {
    const s = selInside(); if (!s) { ref.current?.focus(); return; }
    saved.current = s.getRangeAt(0).cloneRange();
    let node: Node | null = s.anchorNode; let a: HTMLAnchorElement | null = null; while (node && node !== ref.current) { if ((node as HTMLElement).tagName === 'A') { a = node as HTMLAnchorElement; break; } node = node.parentNode; }
    setLink({ url: a?.getAttribute('href') ?? '', nofollow: !!a?.dataset.nf, blank: !!a?.dataset.bl, err: '', existing: !!a });
  };
  const applyLink = () => {
    if (!link) return; const url = fixLink(link.url); const ok = safeLink(url);
    if (!ok) { setLink({ ...link, err: 'Escribe una dirección que empiece por https:// (también sirve mailto:, /ruta o #ancla).' }); return; }
    const el = ref.current!; el.focus(); const s = getSelection(); s?.removeAllRanges(); if (saved.current) s?.addRange(saved.current);
    if (saved.current?.collapsed) { document.execCommand('insertHTML', false, `<a href="${esc(ok)}">${esc(ok)}</a>`); }
    else document.execCommand('createLink', false, ok);
    let lastA: HTMLAnchorElement | null = null;
    el.querySelectorAll<HTMLAnchorElement>('a').forEach(a => { if (a.getAttribute('href') === ok) { lastA = a; link.nofollow ? a.setAttribute('data-nf', '1') : a.removeAttribute('data-nf'); link.blank ? a.setAttribute('data-bl', '1') : a.removeAttribute('data-bl'); } });
    if (lastA) { const r = document.createRange(); r.setStartAfter(lastA); r.collapse(true); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }   // el cursor queda justo después del enlace para seguir escribiendo
    setLink(null); emit();
  };
  const unlink = () => { const el = ref.current!; el.focus(); const s = getSelection(); if (saved.current) { s?.removeAllRanges(); s?.addRange(saved.current); } document.execCommand('unlink'); setLink(null); emit(); };
  const onKey = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openLink(); return; }
    if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); exec('bold'); return; }
    if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); exec('italic'); return; }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { if (singleLine || onEnter) { e.preventDefault(); onEnter?.(); } else { e.preventDefault(); document.execCommand('insertLineBreak'); emit(); } return; }
    if (e.key === 'Enter' && e.shiftKey && singleLine) { e.preventDefault(); return; }
    if (e.key === 'Backspace' && onBackspaceEmpty && empty) { e.preventDefault(); onBackspaceEmpty(); }
  };
  const onPaste = (e: React.ClipboardEvent) => { e.preventDefault(); let t = e.clipboardData.getData('text/plain'); if (singleLine) t = t.replace(/\s*\n+\s*/g, ' '); t = t.slice(0, 5000); document.execCommand('insertText', false, t); emit(); };
  return <div ref={wrap} className={cx('relative', className)} onFocus={() => setFocus(true)} onBlur={e => { if (!wrap.current?.contains(e.relatedTarget as Node)) { setFocus(false); setLink(null); } }}>
    {toolbar && focus && <div role="toolbar" aria-label="Formato de texto" className="absolute -top-10 left-0 z-20 flex items-center gap-0.5 rounded-lg border border-line bg-white p-1 shadow-[var(--shadow-pop)]" onMouseDown={e => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); }}>
      {!link ? <>
        <button type="button" aria-label="Negrita (Ctrl+B)" title="Negrita (Ctrl+B)" className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-navy hover:bg-sky" onClick={() => exec('bold')}><BIcon n="bold" s={15} /></button>
        <button type="button" aria-label="Cursiva (Ctrl+I)" title="Cursiva (Ctrl+I)" className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-navy hover:bg-sky" onClick={() => exec('italic')}><BIcon n="italic" s={15} /></button>
        <span className="mx-0.5 h-4 w-px bg-line" />
        <button type="button" aria-label="Enlace (Ctrl+K)" title="Enlace (Ctrl+K)" className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[12.5px] font-semibold text-navy hover:bg-sky" onClick={openLink}><Icon n="link" s={14} />Enlace</button>
      </> : <div className="flex flex-col gap-1.5 p-1" style={{ width: 300 }}>
        <input autoFocus value={link.url} onChange={e => setLink({ ...link, url: e.target.value, err: '' })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') { e.stopPropagation(); setLink(null); ref.current?.focus(); } }} placeholder="https://… o /otro-articulo" aria-label="Dirección del enlace" className="h-8 w-full rounded-md border border-line-2 px-2 text-[13px] focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" />
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink"><input type="checkbox" className="accent-navy" checked={link.nofollow} onChange={e => setLink({ ...link, nofollow: e.target.checked })} />No pasar autoridad SEO (nofollow)</label>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink"><input type="checkbox" className="accent-navy" checked={link.blank} onChange={e => setLink({ ...link, blank: e.target.checked })} />Abrir en pestaña nueva</label>
        {link.err && <p role="alert" className="text-[12px] text-bad">{link.err}</p>}
        <div className="flex justify-end gap-1.5"><button type="button" className="h-7 cursor-pointer rounded-md px-2 text-[12.5px] text-slate hover:bg-sky" onClick={() => { setLink(null); ref.current?.focus(); }}>Cancelar</button>{link.existing && <button type="button" className="h-7 cursor-pointer rounded-md px-2 text-[12.5px] text-bad hover:bg-red-50" onClick={unlink}>Quitar</button>}<button type="button" className="h-7 cursor-pointer rounded-md bg-navy px-3 text-[12.5px] font-semibold text-white hover:bg-navy-700" onClick={applyLink}>Aplicar</button></div>
      </div>}
    </div>}
    <div ref={ref} id={id} contentEditable suppressContentEditableWarning role="textbox" aria-multiline={!singleLine} aria-label={ariaLabel} spellCheck lang="es" data-empty={empty || undefined} data-placeholder={placeholder}
      onInput={emit} onKeyDown={onKey} onPaste={onPaste} onDrop={e => e.preventDefault()} onBlur={emit}
      className={cx('rt min-h-[1.6em] whitespace-pre-wrap break-words outline-none [&_a]:text-link [&_a]:underline', empty && "before:pointer-events-none before:text-mute before:content-[attr(data-placeholder)]")} />
  </div>;
}
