import { BRAND } from '../lib/brand';
import { Component, createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ErrorInfo, type ReactNode } from 'react';
import Icon from './Icon';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

/* ---------- Botones ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand';
export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: string }) {
  const v = { primary: 'bg-navy text-white hover:bg-navy-700 border-navy', brand: 'bg-brand-600 text-white hover:bg-[#BF3218] border-brand-600', secondary: 'bg-white text-navy border-line-2 hover:bg-sky', ghost: 'bg-transparent text-slate border-transparent hover:bg-sky', danger: 'bg-white text-bad border-line-2 hover:bg-red-50' }[variant];
  return <button type="button" {...p} className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer', size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm', v, className)}>{icon && <Icon n={icon} s={size === 'sm' ? 14 : 16} />}{children}</button>;
}
export const IconButton = ({ n, label, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { n: string; label: string }) => (
  <button type="button" aria-label={label} title={label} {...p} className={cx('grid h-8 w-8 place-items-center rounded-lg text-slate hover:bg-sky hover:text-navy cursor-pointer disabled:opacity-40', className)}><Icon n={n} s={17} /></button>
);

/* ---------- Badges ---------- */
const STATUS_STYLE: Record<string, string> = {
  New: 'bg-[#0B7D4B] text-white', 'No Answer - Active Recall': 'bg-black text-white', 'Research Pending': 'bg-[#6B46C1] text-white', 'Hot Follow-Up': 'bg-[#C24410] text-white', 'Appointment Set': 'bg-[#0B7678] text-white',
  Sale: 'bg-[#DDE3EA] text-ink', 'Do Not Call': 'bg-[#DDE3EA] text-ink', Unreachable: 'bg-[#DDE3EA] text-ink', Duplicate: 'bg-[#DDE3EA] text-ink', 'Lost - Not Interested': 'bg-[#DDE3EA] text-ink', 'Follow-Up Needed': 'bg-[#A35F0E] text-white', 'Call later TODAY': 'bg-[#8F6805] text-white',
  'Recall - Short': 'bg-[#2F6FED] text-white', 'Recall - Long': 'bg-[#3F6FD1] text-white', 'Switch Setter': 'bg-[#8A5A44] text-white', 'Re-Hash': 'bg-[#7A4EAB] text-white',
  Paid: 'bg-[#B3122A] text-white', 'Paid Ads': 'bg-[#B3122A] text-white', 'Organic Website': 'bg-[#0B7D4B] text-white', Other: 'bg-black text-white', 'Digital Door Knocking': 'bg-[#2F6FED] text-white', 'Manual Setter': 'bg-[#6B46C1] text-white', Referral: 'bg-[#0B7678] text-white',
  Confirmed: 'bg-[#E6F4EC] text-[#00704A]', Pending: 'bg-[#FDECEC] text-[#B3122A]', Canceled: 'bg-[#DDE3EA] text-ink', 'No-show': 'bg-[#FDECEC] text-[#B3122A]',
};
export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const key = typeof children === 'string' ? children : '';
  return <span className={cx('inline-flex max-w-full items-center truncate rounded-md px-2 py-[1px] text-[12px] font-semibold leading-5', STATUS_STYLE[tone ?? key] ?? 'bg-sky text-navy', className)}>{children}</span>;
}
export const Pill = ({ children, color = 'bg-sky text-navy' }: { children: ReactNode; color?: string }) => <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', color)}>{children}</span>;

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || '?';
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <span className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 38% 42%)` }} aria-hidden="true">{ini}</span>;
}

/* ---------- Pila de capas: Escape cierra SOLO la capa superior (popover dentro de drawer/modal) ---------- */
const layerStack: string[] = [];
const pushLayer = (id: string) => { layerStack.push(id); };
const popLayer = (id: string) => { const i = layerStack.lastIndexOf(id); if (i >= 0) layerStack.splice(i, 1); };
/** Escucha Escape en fase de captura y solo actúa si esta capa es la superior; detiene la propagación para que las capas inferiores no se cierren. */
export function useLayerEscape(active: boolean, onEscape: () => void) {
  const id = useId(); const cb = useRef(onEscape); cb.current = onEscape;
  useEffect(() => {
    if (!active) return; pushLayer(id);
    const k = (e: KeyboardEvent) => { if (e.key !== 'Escape' || layerStack[layerStack.length - 1] !== id) return; e.stopPropagation(); e.preventDefault(); cb.current(); };
    document.addEventListener('keydown', k, true);
    return () => { document.removeEventListener('keydown', k, true); popLayer(id); };
  }, [active, id]);
}
const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
/** Foco inicial dentro del diálogo, trampa de Tab y restauración del foco al cerrar. */
function useDialogFocus(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null; const el = ref.current; if (!el) return;
    const first = el.querySelector<HTMLElement>('[data-autofocus],input:not([type=hidden]),textarea,select') ?? el.querySelector<HTMLElement>(FOCUSABLE); (first ?? el).focus({ preventScroll: true });
    const t = (e: KeyboardEvent) => { if (e.key !== 'Tab') return; const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
    el.addEventListener('keydown', t);
    return () => { el.removeEventListener('keydown', t); prev?.focus?.({ preventScroll: true }); };
  }, [ref]);
}

/* ---------- Popover / menú ---------- */
export function Popover({ trigger, children, align = 'left', width = 'w-64', open: ctrl, onOpenChange }: { trigger: (o: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [own, setOwn] = useState(false); const open = ctrl ?? own; const ref = useRef<HTMLDivElement>(null);
  const set = useCallback((o: boolean) => { setOwn(o); onOpenChange?.(o); }, [onOpenChange]);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => { if (open) opener.current = document.activeElement as HTMLElement | null; }, [open]);
  useLayerEscape(open, () => { set(false); opener.current?.focus?.({ preventScroll: true }); });
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) set(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [open, set]);
  return <div ref={ref} className="relative inline-block">{trigger({ open, toggle: () => set(!open) })}{open && <div className={cx('pop absolute top-full z-50 mt-1 max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-pop)]', width, align === 'right' ? 'right-0' : 'left-0')}>{children(() => set(false))}</div>}</div>;
}
export const MenuItem = ({ children, onClick, icon, danger, disabled }: { children: ReactNode; onClick?: () => void; icon?: string; danger?: boolean; disabled?: boolean }) => (
  <button type="button" disabled={disabled} onClick={onClick} className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] hover:bg-sky disabled:opacity-40 cursor-pointer', danger ? 'text-bad' : 'text-ink')}>{icon && <Icon n={icon} s={15} className="text-slate" />}{children}</button>
);

/* ---------- Modal / Drawer ---------- */
export function Modal({ title, onClose, children, footer, width = 'max-w-lg' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null); const tid = useId(); useLayerEscape(true, onClose); useDialogFocus(ref);
  return <div className="fade fixed inset-0 z-[80] grid place-items-center bg-[#071B33]/45 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={tid} className={cx('pop flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl outline-none', width)} style={{ transformOrigin: 'center' }}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 id={tid} className="font-display text-[17px] font-bold text-navy">{title}</h2><IconButton n="x" label="Cerrar" onClick={onClose} /></div>
      <div className="scroll-thin overflow-auto px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line bg-canvas/60 px-5 py-3 rounded-b-2xl">{footer}</div>}
    </div></div>;
}
export function Drawer({ title, onClose, children, footer, width = 'w-[460px]' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLElement>(null); const tid = useId(); useLayerEscape(true, onClose); useDialogFocus(ref);
  return <div className="fade fixed inset-0 z-[70] bg-[#071B33]/30" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={tid} className={cx('slidein absolute right-0 top-0 flex h-full max-w-full flex-col bg-white shadow-2xl outline-none', width)}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h2 id={tid} className="font-display text-[17px] font-bold text-navy">{title}</h2><IconButton n="x" label="Cerrar" onClick={onClose} /></div>
      <div className="scroll-thin flex-1 overflow-auto px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
    </aside></div>;
}

/* ---------- Formularios ---------- */
export const inputCls = 'h-9 w-full rounded-lg border border-line-2 bg-white px-3 text-sm text-ink placeholder:text-mute focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25 disabled:bg-canvas disabled:text-slate';
export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => <label className="mb-3 block"><span className="mb-1 block text-[12.5px] font-semibold text-slate">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}</label>;
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = ({ children, className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, 'pr-8', className)}>{children}</select>;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, 'h-auto py-2', p.className)} />;
export function Checkbox({ checked, onChange, label, aria, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; aria?: string; indeterminate?: boolean }) {
  return <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={checked} ref={el => { if (el) el.indeterminate = !!indeterminate; }} onChange={e => onChange(e.target.checked)} className="h-4 w-4 cursor-pointer rounded border-line-2 accent-navy" aria-label={aria ?? (typeof label === 'string' ? label : undefined)} />{label && <span className="text-[13.5px]">{label}</span>}</label>;
}
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cx('relative h-5 w-9 shrink-0 cursor-pointer rounded-full', on ? 'bg-good' : 'bg-line-2')}><span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} /></button>;
}

/* ---------- Estructura de página ---------- */
export const Card = ({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) => (
  <section className={cx('rounded-xl border border-line bg-white', className)}>{(title || action) && <header className="flex items-center justify-between border-b border-line px-4 py-2.5"><h3 className="font-display text-[15px] font-bold text-navy">{title}</h3>{action}</header>}<div className={pad ? 'p-4' : ''}>{children}</div></section>
);
export const PageHeader = ({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) => (
  <header className="mb-4 flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><h1 className="font-display text-[22px] font-bold leading-tight text-navy sm:text-[26px]">{title}</h1>{sub && <p className="mt-0.5 text-[13.5px] text-slate">{sub}</p>}</div><div className="flex flex-wrap items-center gap-2">{actions}</div></header>
);
export const Empty = ({ icon = 'info', title, children }: { icon?: string; title: string; children?: ReactNode }) => <div className="grid place-items-center px-6 py-14 text-center"><span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-sky text-navy"><Icon n={icon} s={26} /></span><h3 className="font-display text-[17px] font-bold text-navy">{title}</h3><div className="mt-1 max-w-sm text-[13.5px] text-slate">{children}</div></div>;
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return <div role="tablist" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line">{items.map(t => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold', value === t.id ? 'border-brand text-navy' : 'border-transparent text-slate hover:text-navy')}>{t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-sky px-1.5 text-[11px]">{t.count}</span>}</button>)}</div>;
}

/* ---------- Toast ---------- */
const ToastCtx = createContext<(m: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<{ id: number; m: string; kind: 'ok' | 'err' }[]>([]);
  const push = useCallback((m: string, kind: 'ok' | 'err' = 'ok') => { const id = Date.now() + Math.random(); setList(l => [...l, { id, m, kind }]); setTimeout(() => setList(l => l.filter(x => x.id !== id)), 3200); }, []);
  return <ToastCtx.Provider value={push}>{children}<div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">{list.map(t => <div key={t.id} className={cx('pop rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.kind === 'ok' ? 'bg-navy' : 'bg-bad')}>{t.m}</div>)}</div></ToastCtx.Provider>;
}
export function useCopy() { const toast = useToast(); return (t: string, msg = 'Copiado') => { navigator.clipboard?.writeText(t).then(() => toast(msg), () => toast('No se pudo copiar', 'err')); }; }


/* ---------- Estados: carga, error, logo ---------- */
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden="true" className={cx('skeleton', className)} />;
export const Spinner = ({ s = 16, className }: { s?: number; className?: string }) => <svg role="status" aria-label="Cargando" width={s} height={s} viewBox="0 0 24 24" fill="none" className={cx('spin', className)}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
export const TableSkeleton = ({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) => <div className="divide-y divide-line/70" role="status" aria-label="Cargando datos">{Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-4 px-4 py-3">{Array.from({ length: cols }, (_, j) => <Skeleton key={j} className={cx('h-3.5', j === 0 ? 'w-40' : 'w-24')} />)}</div>)}</div>;
export const ErrorState = ({ title = 'No se pudo cargar esta pantalla', detail, onRetry }: { title?: string; detail?: string; onRetry?: () => void }) => (
  <div role="alert" className="grid place-items-center px-6 py-14 text-center"><span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#FDECEC] text-bad"><Icon n="warn" s={26} /></span><h3 className="font-display text-[17px] font-bold text-navy">{title}</h3>{detail && <p className="mt-1 max-w-md text-[13.5px] text-slate">{detail}</p>}{onRetry && <Button className="mt-4" icon="refresh" onClick={onRetry}>Reintentar</Button>}</div>
);
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { err: Error | null; key?: string }> {
  state: { err: Error | null; key?: string } = { err: null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  static getDerivedStateFromProps(p: { resetKey?: string }, st: { err: Error | null; key?: string }) { return p.resetKey !== st.key ? { err: null, key: p.resetKey } : null; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[ui] error de render', e, i.componentStack); }
  render() { return this.state.err ? <ErrorState detail={this.state.err.message} onRetry={() => this.setState({ err: null })} /> : this.props.children; }
}
/** Logo real de Nexa (casa naranja sobre fondo transparente; funciona sobre navy y blanco). */
export const Logo = ({ size = 28, className }: { size?: number; className?: string }) => <img src={BRAND.logo} width={size} height={size} alt="" aria-hidden="true" draggable={false} className={cx('shrink-0 select-none', className)} />;
