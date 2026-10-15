import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import '../lib/propOptions';
import { HEX, PALETTE, colorName, pillColors } from '../lib/optionColor';
import type { PropOption } from '../lib/schema';
import Icon from './Icon';
import { cx, inputCls, useLayerEscape } from './ui';

/** Etiqueta de una opción con su color (como Nexa). Sin color = blanco con borde neutro. */
export function OptionPill({ label, color, className, title }: { label: ReactNode; color?: string | null; className?: string; title?: string }) {
  const c = pillColors(color);
  return <span title={title} data-color={color ?? ''} className={cx('inline-flex max-w-full items-center truncate rounded-md border px-2 py-[1px] text-[12px] font-semibold leading-5', !c && 'border-line-2 bg-white text-ink', className)}
    style={c ? { backgroundColor: c.bg, color: c.fg, borderColor: c.border } : undefined}><span className="truncate">{label}</span></span>;
}

/** Fila de una opción en listas/filtros con casilla: la etiqueta se ve como píldora. */
export const optionLabel = (o: PropOption) => <OptionPill label={o.label} color={o.color} />;

/** Desplegable de una sola opción: fondo blanco, cada opción como píldora de su color, teclado completo (↑ ↓ Inicio Fin Enter Esc, escribir para saltar). */
export function OptionSelect({ value, options, onChange, id, autoFocus, onBlur, placeholder = '— Sin valor —', ariaLabel, disabled, allowClear = true }: {
  value: string | null; options: PropOption[]; onChange: (v: string | null) => void; id?: string; autoFocus?: boolean; onBlur?: () => void; placeholder?: string; ariaLabel?: string; disabled?: boolean; allowClear?: boolean;
}) {
  const [open, setOpen] = useState(!!autoFocus); const [act, setAct] = useState(-1); const btn = useRef<HTMLButtonElement>(null); const list = useRef<HTMLDivElement>(null); const lid = useId();
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; max: number } | null>(null);
  const items = useMemo(() => [...(allowClear ? [{ label: placeholder, value: '', clear: true } as PropOption & { clear?: boolean }] : []), ...options as (PropOption & { clear?: boolean })[]], [options, placeholder, allowClear]);
  const sel = options.find(o => o.value === value);
  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect(); if (!r) return; const below = window.innerHeight - r.bottom - 8; const above = r.top - 8; const flip = below < 200 && above > below;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 240) - 8)), width: Math.max(r.width, 240), max: Math.min(320, flip ? above : below), ...(flip ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  }, []);
  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (list.current?.contains(e.target as Node)) return; const r = btn.current?.getBoundingClientRect(); if (!r || r.bottom < 0 || r.top > window.innerHeight) setOpen(false); else place(); };   // se reubica al hacer scroll; se cierra solo si el campo sale de la pantalla
    const down = (e: MouseEvent) => { if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) { setOpen(false); } };
    window.addEventListener('scroll', close, true); window.addEventListener('resize', place); document.addEventListener('mousedown', down);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', place); document.removeEventListener('mousedown', down); };
  }, [open, place]);
  useLayerEscape(open, () => { setOpen(false); btn.current?.focus({ preventScroll: true }); });
  useEffect(() => { if (open) { const i = items.findIndex(o => o.value === (value ?? '')); setAct(i >= 0 ? i : 0); } }, [open]); // eslint-disable-line
  useEffect(() => { const l = list.current; const el = l?.querySelector<HTMLElement>(`[data-i="${act}"]`); if (!l || !el) return; if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop - 6; else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight + 6; }, [act, open, pos]);   // sin scrollIntoView: no mueve la página
  const pick = (i: number) => { const o = items[i]; if (!o) return; setOpen(false); onChange(o.value === '' ? null : o.value); btn.current?.focus({ preventScroll: true }); };
  const typed = useRef({ s: '', t: 0 });
  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAct(a => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(a => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setAct(0); } else if (e.key === 'End') { e.preventDefault(); setAct(items.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(act); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { const now = Date.now(); typed.current.s = (now - typed.current.t > 700 ? '' : typed.current.s) + e.key.toLowerCase(); typed.current.t = now; const i = items.findIndex(o => o.label.toLowerCase().startsWith(typed.current.s)); if (i >= 0) setAct(i); }
  };
  return <div className="relative" onBlur={e => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node) && !list.current?.contains(e.relatedTarget as Node)) { setOpen(false); onBlur?.(); } }}>
    <button ref={btn} id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? lid : undefined} aria-label={ariaLabel} disabled={disabled} autoFocus={autoFocus}
      onClick={() => setOpen(o => !o)} onKeyDown={onKey} className={cx(inputCls, 'flex cursor-pointer items-center justify-between gap-2 bg-white text-left')}>
      <span className="min-w-0 flex-1 truncate">{sel ? <OptionPill label={sel.label} color={sel.color} /> : value ? <span className="text-ink">{value}</span> : <span className="text-mute">{placeholder}</span>}</span>
      <Icon n="chevD" s={14} className="shrink-0 text-slate" />
    </button>
    {open && pos && createPortal(
      <div ref={list} id={lid} role="listbox" aria-label={ariaLabel ?? 'Opciones'} onMouseDown={e => e.preventDefault()} className="pop scroll-thin fixed z-[200] overflow-auto rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]"
        style={{ left: pos.left, width: pos.width, maxHeight: pos.max, top: pos.top, bottom: pos.bottom }}>
        {items.map((o, i) => { const on = o.value === (value ?? '') && !(o as { clear?: boolean }).clear || (!value && (o as { clear?: boolean }).clear);
          return <div key={o.value || '—'} role="option" aria-selected={!!on} data-i={i} data-value={o.value} onMouseEnter={() => setAct(i)} onClick={() => pick(i)}
            className={cx('flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5', act === i ? 'bg-sky' : 'bg-white')}>
            {(o as { clear?: boolean }).clear ? <span className="text-[13px] text-mute">{o.label}</span> : <OptionPill label={o.label} color={o.color} />}
            {on && <Icon n="check" s={14} className="shrink-0 text-good" />}</div>; })}
        {!items.length && <div className="px-2 py-3 text-center text-[13px] text-slate">Sin opciones</div>}
      </div>, document.body)}
  </div>;
}

/** Selector de color: 12 colores de la paleta + sin color + hex personalizado. */
export function ColorPicker({ value, onChange, label = 'Color' }: { value?: string | null; onChange: (c: string | null) => void; label?: string }) {
  const [hex, setHex] = useState(value ?? ''); useEffect(() => setHex(value ?? ''), [value]);
  const ok = hex === '' || HEX.test(hex);
  return <div role="radiogroup" aria-label={label} className="w-56">
    <div className="grid grid-cols-6 gap-1.5">
      {PALETTE.map(p => { const on = value?.toLowerCase() === p.hex.toLowerCase();
        return <button key={p.id} type="button" role="radio" aria-checked={on} aria-label={p.name} title={p.name} onClick={() => onChange(p.hex)}
          className={cx('grid h-7 w-7 cursor-pointer place-items-center rounded-full border-2', on ? 'border-navy' : 'border-white ring-1 ring-line-2')} style={{ backgroundColor: p.hex }}>{on && <Icon n="check" s={13} className="text-white" />}</button>; })}
    </div>
    <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(null)} className={cx('mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-left text-[12.5px]', !value ? 'border-navy bg-sky font-semibold text-navy' : 'border-line text-slate hover:bg-sky')}>
      <span className="h-4 w-4 rounded-full border border-line-2 bg-white" />Sin color (blanco){!value && <Icon n="check" s={13} className="ml-auto" />}</button>
    <label className="mt-2 block text-[12px] font-semibold text-slate">Color personalizado
      <div className="mt-1 flex items-center gap-1.5">
        <input type="color" aria-label="Elegir color" value={value && HEX.test(value) ? value : '#64748b'} onChange={e => onChange(e.target.value.toUpperCase())} className="h-8 w-9 cursor-pointer rounded border border-line-2 bg-white p-0.5" />
        <input value={hex} placeholder="#RRGGBB" aria-label="Código hexadecimal" aria-invalid={!ok} maxLength={7} onChange={e => { const v = e.target.value.startsWith('#') || !e.target.value ? e.target.value : '#' + e.target.value; setHex(v); if (HEX.test(v)) onChange(v.toUpperCase()); }}
          className={cx(inputCls, 'h-8 font-mono text-[12.5px]', !ok && 'border-bad')} /></div></label>
    <p className="sr-only" aria-live="polite">{colorName(value)}</p>
  </div>;
}
