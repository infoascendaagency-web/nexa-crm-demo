// Calendario de tareas (mes / semana / día) con arrastrar para reprogramar.
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { Button, IconButton, cx } from '../../components/ui';
import type { Rec } from '../../lib/types';
import { CompleteButton, PRIO_STYLE, Tag, TargetLink, prioOf } from './parts';
import { DOW_ES, MONTHS_ES, PRIO_LABEL, addDaysKey, dayKey, dowOfKey, dueOf, fromParts, isDone, keyLabel, keyParts, keyToMs, monthKeyStart, partsOf, startOfWeekKey, timeLabel, type Target } from './util';

export type CalMode = 'month' | 'week' | 'day';
export const MODE_LABEL: Record<CalMode, string> = { month: 'Mes', week: 'Semana', day: 'Día' };
/** Primer y último día (claves YYYY-MM-DD) que dibuja cada vista. */
export function gridRange(mode: CalMode, anchor: string): { first: string; last: string } {
  if (mode === 'day') return { first: anchor, last: anchor };
  if (mode === 'week') { const f = startOfWeekKey(anchor); return { first: f, last: addDaysKey(f, 6) }; }
  const f = startOfWeekKey(monthKeyStart(anchor)); const { y, m } = keyParts(anchor); const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
  const lastOfMonth = addDaysKey(next, -1); return { first: f, last: addDaysKey(startOfWeekKey(lastOfMonth), 6) };
}
export const rangeMs = (mode: CalMode, anchor: string) => { const r = gridRange(mode, anchor); return { from: keyToMs(r.first), to: keyToMs(addDaysKey(r.last, 1)) - 1 }; };
const shift = (mode: CalMode, anchor: string, dir: 1 | -1) => {
  if (mode === 'day') return addDaysKey(anchor, dir); if (mode === 'week') return addDaysKey(anchor, 7 * dir);
  const { y, m } = keyParts(anchor); const t = new Date(Date.UTC(y, m - 1 + dir, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-01`;
};
export function calTitle(mode: CalMode, anchor: string) {
  const { y, m } = keyParts(anchor); if (mode === 'month') return `${MONTHS_ES[m - 1]} de ${y}`;
  if (mode === 'day') return keyLabel(anchor);
  const f = startOfWeekKey(anchor), l = addDaysKey(f, 6); const a = keyParts(f), b = keyParts(l);
  return a.m === b.m ? `${a.d}–${b.d} de ${MONTHS_ES[b.m - 1]} de ${b.y}` : `${a.d} ${MONTHS_ES[a.m - 1].slice(0, 3)}. – ${b.d} ${MONTHS_ES[b.m - 1].slice(0, 3)}. de ${b.y}`;
}

type CalActions = { open: (t: Rec) => void; toggle: (t: Rec) => void; reschedule: (t: Rec, ms: number, label: string) => void };
const DRAG_MIME = 'application/x-nx-task';

function Chip({ t, now, act, compact }: { t: Rec; now: number; act: CalActions; compact?: boolean }) {
  const due = dueOf(t); const done = isDone(t); const late = !done && due != null && due < now; const hi = prioOf(t) === 'HIGH';
  return <button type="button" draggable={!done || true} onDragStart={e => { e.dataTransfer.setData(DRAG_MIME, t.id); e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; }} onClick={e => { e.stopPropagation(); act.open(t); }}
    data-task-chip={t.id} title={`${t.properties.hs_task_subject ?? ''} · ${due ? timeLabel(due) : 'sin hora'}`}
    className={cx('flex w-full cursor-grab items-center gap-1 truncate rounded-md border-l-[3px] px-1.5 py-[2px] text-left text-[12px] leading-5 active:cursor-grabbing', done ? 'border-line-2 bg-canvas text-slate line-through' : late ? 'border-bad bg-[#FDECEC] text-[#8E1224]' : hi ? 'border-brand bg-[#FFF0EC] text-ink' : 'border-navy bg-sky text-navy', compact && 'py-0')}>
    {due != null && <span className="shrink-0 font-semibold tabular">{timeLabel(due).replace(' a. m.', 'a').replace(' p. m.', 'p')}</span>}<span className="truncate">{t.properties.hs_task_subject || '(sin título)'}</span></button>;
}

function useDrop(act: CalActions, byId: Map<string, Rec>, targetMs: (t: Rec) => number, label: string) {
  const [over, setOver] = useState(false);
  return { over, props: {
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!over) setOver(true); } },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(false); const t = byId.get(e.dataTransfer.getData(DRAG_MIME)); if (t) act.reschedule(t, targetMs(t), label); },
  } };
}

function DayCell({ k, tasks, now, act, byId, inMonth, onDay }: { k: string; tasks: Rec[]; now: number; act: CalActions; byId: Map<string, Rec>; inMonth: boolean; onDay: (k: string) => void }) {
  const today = dayKey(now) === k; const { d } = keyParts(k);
  const drop = useDrop(act, byId, t => { const due = dueOf(t); const p = due != null ? partsOf(due) : { h: 9, mi: 0 }; return keyToMs(k, p.h, p.mi); }, keyLabel(k));
  const open = tasks.filter(t => !isDone(t)).length;
  return <div {...drop.props} data-day={k} onClick={() => onDay(k)} className={cx('min-h-[84px] cursor-pointer border-b border-r border-line p-1 sm:min-h-[108px]', !inMonth && 'bg-canvas/60', drop.over && 'bg-[#E3EEFF] outline outline-2 -outline-offset-2 outline-link')}>
    <div className="flex items-center justify-between"><span className={cx('grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12.5px] font-semibold tabular', today ? 'bg-navy text-white' : inMonth ? 'text-ink' : 'text-mute')}>{d}</span>
      {tasks.length > 0 && <span className={cx('rounded-full px-1.5 text-[11px] font-bold tabular sm:hidden', open ? 'bg-navy text-white' : 'bg-canvas text-slate')} aria-label={`${tasks.length} tareas`}>{tasks.length}</span>}</div>
    <div className="mt-0.5 hidden space-y-[2px] sm:block">{tasks.slice(0, 3).map(t => <Chip key={t.id} t={t} now={now} act={act} />)}
      {tasks.length > 3 && <button type="button" onClick={e => { e.stopPropagation(); onDay(k); }} className="w-full cursor-pointer rounded px-1 text-left text-[11.5px] font-semibold text-link hover:underline">+{tasks.length - 3} más</button>}</div>
  </div>;
}

function WeekDay({ k, tasks, now, act, byId, onDay }: { k: string; tasks: Rec[]; now: number; act: CalActions; byId: Map<string, Rec>; onDay: (k: string) => void }) {
  const today = dayKey(now) === k; const drop = useDrop(act, byId, t => { const due = dueOf(t); const p = due != null ? partsOf(due) : { h: 9, mi: 0 }; return keyToMs(k, p.h, p.mi); }, keyLabel(k));
  return <div {...drop.props} data-day={k} className={cx('min-h-[140px] border-line p-2 max-lg:border-b lg:border-r', drop.over && 'bg-[#E3EEFF]')}>
    <button type="button" onClick={() => onDay(k)} className={cx('mb-2 flex w-full cursor-pointer items-center gap-2 text-left text-[13px] font-bold hover:underline', today ? 'text-brand' : 'text-navy')}><span className="inline-block first-letter:uppercase">{keyLabel(k)}</span><span className="rounded-full bg-canvas px-1.5 text-[11px] font-semibold text-slate">{tasks.length}</span></button>
    <div className="space-y-1">{tasks.map(t => <Chip key={t.id} t={t} now={now} act={act} />)}{tasks.length === 0 && <p className="text-[12px] text-mute">—</p>}</div>
  </div>;
}

function HourRow({ k, h, tasks, targets, now, act, byId }: { k: string; h: number; tasks: Rec[]; targets: Map<string, Target>; now: number; act: CalActions; byId: Map<string, Rec> }) {
  const drop = useDrop(act, byId, () => fromParts(keyParts(k).y, keyParts(k).m, keyParts(k).d, h, 0), `${keyLabel(k)} ${timeLabel(fromParts(2026, 1, 1, h, 0))}`);
  return <div {...drop.props} data-hour={h} className={cx('flex min-h-[44px] gap-3 border-b border-line px-3 py-1.5', drop.over && 'bg-[#E3EEFF]')}>
    <div className="w-24 shrink-0 whitespace-nowrap pt-1 text-right text-[12px] font-semibold tabular text-slate">{timeLabel(fromParts(2026, 1, 1, h, 0))}</div>
    <div className="min-w-0 flex-1 space-y-1.5">{tasks.map(t => { const done = isDone(t); const due = dueOf(t); const late = !done && due != null && due < now; const prio = prioOf(t);
      return <div key={t.id} draggable onDragStart={e => { e.dataTransfer.setData(DRAG_MIME, t.id); e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; }} data-task-chip={t.id} className="flex cursor-grab flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-white px-2.5 py-1.5">
        <CompleteButton task={t} done={done} onToggle={() => act.toggle(t)} />
        <button type="button" onClick={() => act.open(t)} className={cx('min-w-0 flex-1 cursor-pointer truncate text-left text-[13.5px] font-semibold hover:underline', done ? 'text-slate line-through' : 'text-navy')}>{t.properties.hs_task_subject || '(sin título)'}</button>
        {due != null && <span className={cx('text-[12px] tabular', late ? 'font-semibold text-bad' : 'text-slate')}>{timeLabel(due)}</span>}<Tag cls={PRIO_STYLE[prio]}>{PRIO_LABEL[prio]}</Tag><TargetLink target={targets.get(t.id)} className="text-[12.5px]" /></div>; })}</div>
  </div>;
}

export default function TaskCalendar({ tasks, targets, now, mode, setMode, anchor, setAnchor, act }: { tasks: Rec[]; targets: Map<string, Target>; now: number; mode: CalMode; setMode: (m: CalMode) => void; anchor: string; setAnchor: (k: string) => void; act: CalActions }) {
  const byId = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const byDay = useMemo(() => { const m = new Map<string, Rec[]>(); for (const t of tasks) { const d = dueOf(t); if (d == null) continue; const k = dayKey(d); (m.get(k) ?? m.set(k, []).get(k)!).push(t); } for (const l of m.values()) l.sort((a, b) => (dueOf(a) ?? 0) - (dueOf(b) ?? 0)); return m; }, [tasks]);
  const range = gridRange(mode, anchor); const days: string[] = []; for (let k = range.first; k <= range.last; k = addDaysKey(k, 1)) days.push(k);
  const goDay = (k: string) => { setAnchor(k); setMode('day'); };
  const todayKey = dayKey(now); const inRange = tasks.length;
  return <section aria-label="Calendario de tareas" className="overflow-hidden rounded-xl border border-line bg-white">
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
      <Button size="sm" onClick={() => setAnchor(todayKey)}>Hoy</Button>
      <IconButton n="chevL" label="Anterior" onClick={() => setAnchor(shift(mode, anchor, -1))} /><IconButton n="chevR" label="Siguiente" onClick={() => setAnchor(shift(mode, anchor, 1))} />
      <h2 className="order-last w-full min-w-0 font-display text-[17px] font-bold text-navy first-letter:uppercase sm:order-none sm:w-auto sm:flex-1" aria-live="polite">{calTitle(mode, anchor)}</h2>
      <div role="group" aria-label="Escala del calendario" className="ml-auto inline-flex overflow-hidden rounded-lg border border-line-2">{(['month', 'week', 'day'] as CalMode[]).map(m => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cx('cursor-pointer px-3 py-1 text-[13px] font-semibold', mode === m ? 'bg-navy text-white' : 'bg-white text-slate hover:bg-sky')}>{MODE_LABEL[m]}</button>)}</div>
    </div>
    {mode === 'month' && <div>
      <div className="grid grid-cols-7 border-b border-line bg-canvas/60 text-center text-[11.5px] font-bold uppercase tracking-wide text-slate" aria-hidden="true">{DOW_ES.map(d => <div key={d} className="py-1.5">{d}</div>)}</div>
      <div className="grid grid-cols-7 border-l border-t-0 border-line">{days.map(k => <DayCell key={k} k={k} tasks={byDay.get(k) ?? []} now={now} act={act} byId={byId} inMonth={k.slice(0, 7) === anchor.slice(0, 7)} onDay={goDay} />)}</div></div>}
    {mode === 'week' && <div className="grid lg:grid-cols-7 lg:border-l">{days.map(k => <WeekDay key={k} k={k} tasks={byDay.get(k) ?? []} now={now} act={act} byId={byId} onDay={goDay} />)}</div>}
    {mode === 'day' && <div>{(() => {
      const list = byDay.get(anchor) ?? []; const hours = Array.from({ length: 17 }, (_, i) => i + 6);   // 6:00 a 22:00; lo anterior/posterior se agrupa en los extremos
      const hourOf = (t: Rec) => Math.min(22, Math.max(6, partsOf(dueOf(t)!).h));
      return <>{hours.map(h => <HourRow key={h} k={anchor} h={h} tasks={list.filter(t => hourOf(t) === h)} targets={targets} now={now} act={act} byId={byId} />)}{list.length === 0 && <p className="px-4 py-3 text-[13px] text-slate">No hay tareas este día. Arrastra una tarea desde otra vista para programarla aquí.</p>}</>; })()}</div>}
    <p className="border-t border-line px-4 py-2 text-[12px] text-slate"><Icon n="info" s={13} className="mr-1 inline" />Arrastra una tarea a otro día{mode === 'day' ? ' u hora' : ''} para reprogramarla; haz clic para abrirla. {inRange === 0 && 'No hay tareas en este período.'}</p>
  </section>;
}
void dowOfKey;
