// Piezas compartidas del espacio de tareas: acciones con deshacer, menús de posponer / prioridad / propietario.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar, Button, MenuItem, Popover, cx } from '../../components/ui';
import { crm } from '../../lib/api';
import { OWNERS, ownerName } from '../../lib/schema';
import type { Rec } from '../../lib/types';
import { PRIO_LABEL, PRIO_ORDER, STATUS_LABEL, TYPE_LABEL, fromInput, snoozeTarget, toInput, type Target } from './util';

/** Aplica un cambio a varias tareas y devuelve la función que lo deshace. */
export function applyPatch(tasks: Rec[], patch: (t: Rec) => Record<string, string | null>): () => void {
  const prev = tasks.map(t => {
    const p = patch(t); const keys = Object.keys(p); if ('hs_task_status' in p) keys.push('hs_task_completion_date');
    return { id: t.id, back: Object.fromEntries(keys.map(k => [k, t.properties[k] ?? null])) as Record<string, string | null> };
  });
  tasks.forEach(t => crm.update('tasks', t.id, patch(t)));
  return () => prev.forEach(x => crm.update('tasks', x.id, x.back));
}
export const MAX_BATCH = 80;   // el servidor limita las escrituras por minuto (90): un lote grande se rechazaría a medias

export const PRIO_STYLE: Record<string, string> = { HIGH: 'bg-[#FDECEC] text-[#B3122A]', MEDIUM: 'bg-[#FFF1D6] text-[#7A4B00]', LOW: 'bg-[#E6F4EC] text-[#00704A]', NONE: 'bg-canvas text-slate' };
export const STATUS_STYLE: Record<string, string> = { NOT_STARTED: 'bg-canvas text-slate', IN_PROGRESS: 'bg-[#E3EEFF] text-[#1E4FB5]', WAITING: 'bg-[#FFF1D6] text-[#7A4B00]', DEFERRED: 'bg-[#EEE5FB] text-[#5B36A8]', COMPLETED: 'bg-[#E6F4EC] text-[#00704A]' };
export const Tag = ({ cls, children }: { cls: string; children: React.ReactNode }) => <span className={cx('inline-flex items-center whitespace-nowrap rounded-md px-2 py-[1px] text-[12px] font-semibold leading-5', cls)}>{children}</span>;
export const prioOf = (t: Rec) => t.properties.hs_task_priority || 'NONE';
export const typeLabel = (t: Rec) => TYPE_LABEL[t.properties.hs_task_type ?? ''] ?? t.properties.hs_task_type ?? '—';

export function CompleteButton({ task, done, onToggle }: { task: Rec; done: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-label={`${done ? 'Reabrir' : 'Completar'} tarea: ${task.properties.hs_task_subject ?? ''}`} title={done ? 'Reabrir' : 'Completar'}
    className={cx('grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border-2 transition-colors', done ? 'border-good bg-good text-white' : 'border-line-2 text-transparent hover:border-good hover:text-good focus-visible:border-good focus-visible:text-good')}><Icon n="check" s={13} stroke={2.6} /></button>;
}

/** Menú de posponer: hoy / mañana / +3 días / fecha y hora. `onPick` recibe cómo calcular el nuevo vencimiento de cada tarea. */
export function SnoozeMenu({ onPick, trigger, align = 'right' }: { onPick: (f: (t: Rec) => number) => void; trigger: (o: { toggle: () => void; open: boolean }) => React.ReactNode; align?: 'left' | 'right' }) {
  const [v, setV] = useState('');
  return <Popover align={align} width="w-64" trigger={trigger}>{close => <div>
    <MenuItem icon="clock" onClick={() => { close(); onPick(t => snoozeTarget(t, 'today')); }}>Hoy (más tarde)</MenuItem>
    <MenuItem icon="calendar" onClick={() => { close(); onPick(t => snoozeTarget(t, 'tomorrow')); }}>Mañana</MenuItem>
    <MenuItem icon="calendar" onClick={() => { close(); onPick(t => snoozeTarget(t, 'plus3')); }}>En 3 días</MenuItem>
    <div className="mt-1 border-t border-line px-1.5 pb-1 pt-2">
      <label className="block text-[12px] font-semibold text-slate">Elegir fecha y hora<input type="datetime-local" value={v} onChange={e => setV(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line-2 px-2 text-sm text-ink focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></label>
      <Button size="sm" variant="primary" className="mt-2 w-full" disabled={!fromInput(v)} onClick={() => { const ms = fromInput(v); if (ms == null) return; close(); onPick(() => ms); setV(''); }}>Aplicar</Button>
    </div></div>}</Popover>;
}
export function PrioMenu({ onPick, trigger }: { onPick: (p: string) => void; trigger: (o: { toggle: () => void; open: boolean }) => React.ReactNode }) {
  return <Popover width="w-44" trigger={trigger}>{close => <>{PRIO_ORDER.map(p => <button key={p} type="button" onClick={() => { close(); onPick(p); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] hover:bg-sky"><Tag cls={PRIO_STYLE[p]}>{PRIO_LABEL[p]}</Tag></button>)}</>}</Popover>;
}
export function OwnerMenu({ onPick, trigger, align = 'left' }: { onPick: (o: string) => void; trigger: (o: { toggle: () => void; open: boolean }) => React.ReactNode; align?: 'left' | 'right' }) {
  return <Popover align={align} width="w-60" trigger={trigger}>{close => <div className="scroll-thin max-h-64 overflow-auto">{OWNERS.map(o => <button key={o.id} type="button" onClick={() => { close(); onPick(o.id); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] hover:bg-sky"><Avatar name={`${o.firstName} ${o.lastName}`} size={20} /><span className="truncate">{o.firstName} {o.lastName}</span></button>)}</div>}</Popover>;
}
export const StatusTag = ({ t }: { t: Rec }) => { const s = t.properties.hs_task_status ?? 'NOT_STARTED'; return <Tag cls={STATUS_STYLE[s] ?? STATUS_STYLE.NOT_STARTED}>{STATUS_LABEL[s] ?? s}</Tag>; };
export const OwnerChip = ({ id }: { id: string | null | undefined }) => { const n = ownerName(id); return n ? <span className="inline-flex min-w-0 items-center gap-1.5"><Avatar name={n} size={20} /><span className="truncate">{n.split(' ')[0]}</span></span> : <span className="text-mute">Sin propietario</span>; };
export function TargetLink({ target, className }: { target?: Target; className?: string }) {
  if (!target) return <span className="text-mute">Sin registro asociado</span>;
  return <Link to={target.path} onClick={e => e.stopPropagation()} className={cx('inline-flex min-w-0 max-w-full items-center gap-1.5 font-semibold text-link hover:underline', className)} title={`Ir a ${target.name}`}>
    {target.kind === 'contacts' ? <Avatar name={target.name} size={20} /> : <Icon n={target.kind === 'appointments' ? 'calendar' : target.kind === 'deals' ? 'deals' : 'companies'} s={15} />}<span className="truncate">{target.name}</span></Link>;
}
export { toInput };
