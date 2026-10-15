// Vista de lista del espacio de tareas: agrupada en Vencidas / Hoy / Próximas / Sin fecha / Completadas.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Checkbox, Empty, IconButton, cx } from '../../components/ui';
import type { Rec } from '../../lib/types';
import { CompleteButton, OwnerChip, OwnerMenu, PRIO_STYLE, PrioMenu, SnoozeMenu, StatusTag, Tag, TargetLink, prioOf, typeLabel } from './parts';
import { BUCKETS, PRIO_LABEL, bucketOf, daysLate, dueOf, isAuto, isDone, relDue, sortByDue, type Bucket, type Target } from './util';

export type RowActions = {
  toggle: (t: Rec) => void; snooze: (ts: Rec[], f: (t: Rec) => number) => void; prio: (ts: Rec[], p: string) => void; owner: (ts: Rec[], o: string) => void; open: (t: Rec) => void;
};
const GRID = 'lg:grid lg:grid-cols-[24px_28px_minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_104px_92px_minmax(0,1fr)_104px_64px] lg:items-center lg:gap-x-3';
const PAGE = 100;

function Row({ t, target, now, selected, onSelect, act }: { t: Rec; target?: Target; now: number; selected: boolean; onSelect: (v: boolean) => void; act: RowActions }) {
  const done = isDone(t); const due = dueOf(t); const late = !done && due != null && due < now; const p = t.properties; const prio = prioOf(t);
  const dueCls = late ? 'font-semibold text-bad' : done ? 'text-slate' : 'text-ink';
  const dueTxt = <span className={cx('whitespace-nowrap', dueCls)} title={due ? new Date(due).toLocaleString('es') : ''}>{relDue(due, now)}{late && daysLate(due!, now) > 0 && <span className="ml-1 text-[11.5px] font-medium">({daysLate(due!, now)} d)</span>}</span>;
  const snooze = <SnoozeMenu onPick={f => act.snooze([t], f)} trigger={({ toggle }) => <IconButton n="clock" label={`Posponer: ${p.hs_task_subject ?? ''}`} onClick={toggle} disabled={done} />} />;
  const go = target ? <Link to={target.path} aria-label={`Ir a ${target.name}`} title={`Ir a ${target.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate hover:bg-sky hover:text-navy"><Icon n="chevR" s={17} /></Link> : <span className="h-8 w-8" />;
  return <li data-task-id={t.id} data-bucket={bucketOf(t, now)} className={cx('border-b border-line/70 px-3 py-2.5 last:border-b-0 hover:bg-sky/40 sm:px-4', GRID, selected && 'bg-sky/60')}>
    {/* móvil / tablet: tarjeta */}
    <div className="flex items-start gap-3 lg:contents">
      <span className="mt-0.5 lg:mt-0"><Checkbox checked={selected} onChange={onSelect} aria={`Seleccionar tarea: ${p.hs_task_subject ?? ''}`} /></span>
      <span className="mt-0 lg:mt-0"><CompleteButton task={t} done={done} onToggle={() => act.toggle(t)} /></span>
      <div className="min-w-0 flex-1 lg:flex-none">
        <button type="button" onClick={() => act.open(t)} className={cx('block max-w-full cursor-pointer truncate text-left text-[14px] font-semibold hover:underline', done ? 'text-slate line-through' : 'text-navy')}>{p.hs_task_subject || '(sin título)'}</button>
        {isAuto(t) && <Tag cls="ml-0 mt-0.5 bg-black text-white">AUTO</Tag>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] lg:hidden">
          {dueTxt}<Tag cls={PRIO_STYLE[prio]}>{PRIO_LABEL[prio]}</Tag><span className="text-slate">{typeLabel(t)}</span><OwnerChip id={p.hubspot_owner_id} />
          {target && <TargetLink target={target} className="text-[12.5px]" />}
        </div>
        <div className="mt-1.5 flex items-center gap-1 lg:hidden">{snooze}{go}<StatusTag t={t} /></div>
      </div>
    </div>
    {/* escritorio: columnas */}
    <div className="hidden min-w-0 lg:block"><TargetLink target={target} /></div>
    <div className="hidden lg:block">{dueTxt}</div>
    <div className="hidden lg:block"><PrioMenu onPick={v => act.prio([t], v)} trigger={({ toggle }) => <button type="button" onClick={toggle} aria-label={`Prioridad ${PRIO_LABEL[prio]}. Cambiar`} className="cursor-pointer rounded-md"><Tag cls={PRIO_STYLE[prio]}>{PRIO_LABEL[prio]}</Tag></button>} /></div>
    <div className="hidden text-[13px] text-slate lg:block">{typeLabel(t)}</div>
    <div className="hidden min-w-0 lg:block"><OwnerMenu onPick={v => act.owner([t], v)} trigger={({ toggle }) => <button type="button" onClick={toggle} aria-label="Cambiar propietario" className="max-w-full cursor-pointer rounded-md text-left text-[13px] hover:bg-sky"><OwnerChip id={p.hubspot_owner_id} /></button>} /></div>
    <div className="hidden lg:block"><StatusTag t={t} /></div>
    <div className="hidden items-center justify-end lg:flex">{snooze}{go}</div>
  </li>;
}

export default function TaskList({ tasks, targets, now, selected, setSelected, act, only, emptyHint }: { tasks: Rec[]; targets: Map<string, Target>; now: number; selected: Set<string>; setSelected: (s: Set<string>) => void; act: RowActions; only: Bucket | null; emptyHint?: React.ReactNode }) {
  const groups = useMemo(() => {
    const m: Record<Bucket, Rec[]> = { overdue: [], today: [], upcoming: [], nodate: [], done: [] };
    for (const t of tasks) m[bucketOf(t, now)].push(t);
    (['overdue', 'today', 'upcoming'] as Bucket[]).forEach(b => m[b].sort(sortByDue)); m.done.sort((a, b) => (dueOf(b) ?? 0) - (dueOf(a) ?? 0));
    return m;
  }, [tasks, now]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ done: true }); const [shown, setShown] = useState<Record<string, number>>({});
  const visible = BUCKETS.filter(b => (!only || only === b.id) && groups[b.id].length);
  if (!visible.length) return <Empty icon="tasks" title="No hay tareas con estos filtros">{emptyHint}</Empty>;
  return <div className="space-y-4">
    <div className="hidden grid-cols-[24px_28px_minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_104px_92px_minmax(0,1fr)_104px_64px] gap-x-3 px-4 text-[11.5px] font-bold uppercase tracking-wide text-slate lg:grid" aria-hidden="true"><span /><span /><span>Tarea</span><span>Contacto / registro</span><span>Vencimiento</span><span>Prioridad</span><span>Tipo</span><span>Propietario</span><span>Estado</span><span /></div>
    {visible.map(b => { const list = groups[b.id]; const open = !(collapsed[b.id] && !only); const n = shown[b.id] ?? PAGE; const allSel = list.every(t => selected.has(t.id)); const someSel = list.some(t => selected.has(t.id));
      return <section key={b.id} aria-label={`${b.label} (${list.length})`} className="overflow-hidden rounded-xl border border-line bg-white">
        <header className={cx('flex items-center gap-2 px-3 py-2 sm:px-4', open && 'border-b border-line', b.id === 'overdue' ? 'bg-[#FDECEC]/70' : 'bg-canvas/70')}>
          <Checkbox checked={allSel} indeterminate={!allSel && someSel} onChange={v => { const s = new Set(selected); list.forEach(t => (v ? s.add(t.id) : s.delete(t.id))); setSelected(s); }} aria={`Seleccionar todas: ${b.label}`} />
          <button type="button" aria-expanded={open} onClick={() => setCollapsed(c => ({ ...c, [b.id]: open }))} className="flex flex-1 cursor-pointer items-center gap-2 text-left"><Icon n={open ? 'chevD' : 'chevR'} s={15} className="text-slate" />
            <h3 className={cx('font-display text-[15px] font-bold', b.id === 'overdue' ? 'text-bad' : 'text-navy')}>{b.label}</h3><span className="rounded-full bg-white px-2 text-[12px] font-semibold tabular text-slate ring-1 ring-line">{list.length}</span></button>
        </header>
        {open && <ul>{list.slice(0, n).map(t => <Row key={t.id} t={t} target={targets.get(t.id)} now={now} selected={selected.has(t.id)} onSelect={v => { const s = new Set(selected); if (v) s.add(t.id); else s.delete(t.id); setSelected(s); }} act={act} />)}</ul>}
        {open && list.length > n && <button type="button" onClick={() => setShown(s => ({ ...s, [b.id]: n + PAGE }))} className="w-full cursor-pointer border-t border-line py-2 text-[13px] font-semibold text-link hover:bg-sky">Mostrar {Math.min(PAGE, list.length - n)} más ({list.length - n} sin mostrar)</button>}
      </section>; })}
  </div>;
}
