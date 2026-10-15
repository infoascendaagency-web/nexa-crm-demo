// Espacio "Tareas": revisión de las tareas de cada setter (lista agrupada + calendario), como en Nexa, con acciones rápidas.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Button, Empty, PageHeader, Popover, Select, Switch, cx, useToast } from '../../components/ui';
import { useSearch, useDbValue } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import * as be from '../../lib/backend';
import { useAccess } from '../../lib/perms';
import { ME, OWNERS } from '../../lib/schema';
import type { Filter, Rec } from '../../lib/types';
import TaskCalendar, { gridRange, rangeMs, type CalMode } from './TaskCalendar';
import TaskList, { type RowActions } from './TaskList';
import { NewTaskModal, TaskDrawer } from './TaskDialogs';
import { MAX_BATCH, OwnerMenu, PRIO_STYLE, PrioMenu, SnoozeMenu, Tag, applyPatch } from './parts';
import { PRIO_LABEL, PRIO_ORDER, STATUS_LABEL, TYPE_LABEL, addDaysKey, bucketOf, buildTargets, dayKey, dueOf, endOfDay, isDone, keyToMs, keyLabel, startOfDay, startOfWeekKey, type Bucket } from './util';

type View = 'list' | 'cal'; type BucketFilter = Bucket | 'week' | null;
const NOOP = { limit: 1, filterGroups: [{ filters: [{ propertyName: 'hs_object_id', operator: 'EQ' as const, value: '0' }] }] };
const f = (propertyName: string, operator: Filter['operator'], value?: string, extra: Partial<Filter> = {}): Filter => ({ propertyName, operator, ...(value !== undefined ? { value } : {}), ...extra });
const iso = (ms: number) => new Date(ms).toISOString();

/** Devuelve [ids de propietarios] de un equipo. */
const teamMembers = (team: string) => OWNERS.filter(o => o.teams.includes(team)).map(o => o.id);
const TEAMS = () => [...new Set(OWNERS.flatMap(o => o.teams))].sort();

export function useNow(ms = 30000) { const [n, setN] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]); return n; }

export default function TasksWorkspace() {
  const [sp, setSp] = useSearchParams(); const toast = useToast(); const acc = useAccess(); const auth = useAuth(); const now = useNow();
  const get = (k: string, d = '') => sp.get(k) ?? d;
  const setParam = (patch: Record<string, string | null>) => setSp(prev => { const n = new URLSearchParams(prev); for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') n.delete(k); else n.set(k, v); } return n; }, { replace: true });
  const canPick = acc.isAdmin || (acc.perms.objects.tasks?.view ?? 'own') !== 'own';
  const hasMe = !!ME.id; const owner = canPick ? get('owner', hasMe ? 'me' : 'all') : (hasMe ? 'me' : 'all');
  const view: View = get('view') === 'cal' ? 'cal' : 'list'; const calMode = (['month', 'week', 'day'].includes(get('cal')) ? get('cal') : 'month') as CalMode;
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(get('date')) ? get('date') : dayKey(now);
  const status = get('status', 'open'); const prio = get('prio'); const type = get('type'); const from = get('from'); const to = get('to'); const bucket = (get('bucket') || null) as BucketFilter;
  const [q, setQ] = useState(''); const [showDone, setShowDone] = useState(true); const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null); const [creating, setCreating] = useState(false); const [filtersOpen, setFiltersOpen] = useState(false);
  const [undo, setUndo] = useState<{ id: number; msg: string; fn: () => void } | null>(null);
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(u => (u?.id === undo.id ? null : u)), 9000); return () => clearTimeout(t); }, [undo]);
  const announce = (msg: string, fn: () => void) => setUndo({ id: Date.now(), msg, fn });

  /* ---- consultas ---- */
  const base: Filter[] = [];
  if (owner === 'me') base.push(f('hubspot_owner_id', 'EQ', ME.id)); else if (owner === 'none') base.push(f('hubspot_owner_id', 'NOT_HAS_PROPERTY'));
  else if (owner.startsWith('team:')) base.push(f('hubspot_owner_id', 'IN', undefined, { values: teamMembers(owner.slice(5)) })); else if (owner !== 'all') base.push(f('hubspot_owner_id', 'EQ', owner));
  if (prio) base.push(f('hs_task_priority', 'EQ', prio)); if (type) base.push(f('hs_task_type', 'EQ', type));
  const statusF = (s: string): Filter[] => (s === 'open' ? [f('hs_task_status', 'NEQ', 'COMPLETED')] : s === 'all' ? [] : [f('hs_task_status', 'EQ', s)]);
  const dateF: Filter[] = [...(/^\d{4}-/.test(from) ? [f('hs_timestamp', 'GTE', iso(keyToMs(from)))] : []), ...(/^\d{4}-/.test(to) ? [f('hs_timestamp', 'LTE', iso(keyToMs(addDaysKey(to, 1)) - 1))] : [])];
  const sorts = [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' as const }];
  const day0 = startOfDay(now);
  const listRes = useSearch('tasks', view === 'list' ? { query: q, filterGroups: [{ filters: [...base, ...statusF(status), ...dateF] }], sorts, limit: 500 } : NOOP);
  const recentDone = useSearch('tasks', view === 'list' && status === 'open' ? { query: q, filterGroups: [{ filters: [...base, f('hs_task_status', 'EQ', 'COMPLETED'), f('hs_task_completion_date', 'GTE', iso(day0 - 7 * 86400000))] }], sorts: [{ propertyName: 'hs_task_completion_date', direction: 'DESCENDING' as const }], limit: 100 } : NOOP);
  const range = rangeMs(calMode, anchor); const calStatus = status === 'open' ? (showDone ? 'all' : 'open') : status;
  const calRes = useSearch('tasks', view === 'cal' ? { query: q, filterGroups: [{ filters: [...base, ...statusF(calStatus), f('hs_timestamp', 'GTE', iso(range.from)), f('hs_timestamp', 'LTE', iso(range.to))] }], sorts, limit: 500 } : NOOP);
  const openOwn = useSearch('tasks', { filterGroups: [{ filters: [...base.filter(x => x.propertyName === 'hubspot_owner_id'), f('hs_task_status', 'NEQ', 'COMPLETED')] }], sorts, limit: 500 });   // contadores: siempre sobre las abiertas de la persona elegida
  const targets = useDbValue(() => buildTargets(), []);
  const listTasks = useMemo(() => (view === 'list' ? [...listRes.results, ...(status === 'open' ? recentDone.results : [])] : []), [listRes, recentDone, view, status]);
  const counts = useMemo(() => {
    const open = openOwn.results.filter(t => !isDone(t)); const wkEnd = endOfDay(keyToMs(addDaysKey(startOfWeekKey(dayKey(now)), 6)));
    return { overdue: open.filter(t => bucketOf(t, now) === 'overdue').length, today: open.filter(t => bucketOf(t, now) === 'today').length, week: open.filter(t => { const d = dueOf(t); return d != null && d >= now && d <= wkEnd; }).length, open: open.length };
  }, [openOwn, now]);
  const shownTasks = useMemo(() => {
    if (!bucket) return listTasks;
    if (bucket === 'week') { const wkEnd = endOfDay(keyToMs(addDaysKey(startOfWeekKey(dayKey(now)), 6))); return listTasks.filter(t => { const d = dueOf(t); return !isDone(t) && d != null && d >= now && d <= wkEnd; }); }
    return listTasks.filter(t => bucketOf(t, now) === bucket);
  }, [listTasks, bucket, now]);
  useEffect(() => { const ids = new Set([...listTasks, ...calRes.results].map(t => t.id)); setSelected(s => (s.size && [...s].some(i => !ids.has(i)) ? new Set([...s].filter(i => ids.has(i))) : s)); }, [listTasks, calRes]);

  /* ---- acciones ---- */
  const guard = (n: number) => { if (n > MAX_BATCH) { toast(`Máximo ${MAX_BATCH} tareas por acción. Selecciona menos.`, 'err'); return false; } return true; };
  const act: RowActions = {
    toggle: t => { const d = isDone(t); announce(d ? 'Tarea reabierta' : 'Tarea completada', applyPatch([t], () => ({ hs_task_status: d ? 'NOT_STARTED' : 'COMPLETED' }))); },
    snooze: (ts, fn) => { if (!guard(ts.length)) return; announce(ts.length === 1 ? 'Tarea pospuesta' : `${ts.length} tareas pospuestas`, applyPatch(ts, t => ({ hs_timestamp: iso(fn(t)) }))); },
    prio: (ts, p) => { if (!guard(ts.length)) return; announce(ts.length === 1 ? `Prioridad: ${PRIO_LABEL[p]}` : `${ts.length} tareas con prioridad ${PRIO_LABEL[p].toLowerCase()}`, applyPatch(ts, () => ({ hs_task_priority: p }))); },
    owner: (ts, o) => { if (!guard(ts.length)) return; const n = OWNERS.find(x => x.id === o); announce(ts.length === 1 ? `Reasignada a ${n?.firstName ?? 'otra persona'}` : `${ts.length} tareas reasignadas a ${n?.firstName ?? 'otra persona'}`, applyPatch(ts, () => ({ hubspot_owner_id: o }))); },
    open: t => setOpenId(t.id),
  };
  const selTasks = listTasks.filter(t => selected.has(t.id));
  const bulkComplete = () => { const ts = selTasks.filter(t => !isDone(t)); if (!ts.length || !guard(ts.length)) return; announce(`${ts.length} tareas completadas`, applyPatch(ts, () => ({ hs_task_status: 'COMPLETED' }))); setSelected(new Set()); };
  const calAct = { open: act.open, toggle: act.toggle, reschedule: (t: Rec, ms: number, label: string) => announce(`Reprogramada: ${label}`, applyPatch([t], () => ({ hs_timestamp: iso(ms) }))) };

  /* ---- bandeja (solo admin) ---- */
  const [pend, setPend] = useState<number | null>(null);
  useEffect(() => { if (auth.mode !== 'connected' || !acc.isAdmin) return; let alive = true; const load = () => be.api<{ pending: number }>('GET', '/tasks-workspace/outbox-summary').then(r => alive && setPend(r.pending)).catch(() => {}); load(); const t = setInterval(load, 60000); return () => { alive = false; clearInterval(t); }; }, [auth.mode, acc.isAdmin]);

  const activeFilters = [prio, type, from, to, status !== 'open' ? status : '', q].filter(Boolean).length + (bucket ? 1 : 0);
  const clear = () => { setQ(''); setParam({ prio: null, type: null, from: null, to: null, status: null, bucket: null }); };
  const ownerLabel = owner === 'me' ? 'Mis tareas' : owner === 'all' ? 'Todas las personas' : owner === 'none' ? 'Sin propietario' : owner.startsWith('team:') ? `Equipo ${owner.slice(5)}` : (OWNERS.find(o => o.id === owner) ? `${OWNERS.find(o => o.id === owner)!.firstName} ${OWNERS.find(o => o.id === owner)!.lastName}` : owner);
  const chips: { id: BucketFilter; label: string; n: number; tone: string }[] = [{ id: 'overdue', label: 'Vencidas', n: counts.overdue, tone: 'text-bad' }, { id: 'today', label: 'Hoy', n: counts.today, tone: 'text-navy' }, { id: 'week', label: 'Esta semana', n: counts.week, tone: 'text-navy' }];
  const total = view === 'list' ? listRes.total : calRes.total;

  return <div className="p-4 sm:p-6">
    <PageHeader title="Tareas" sub={<>{ownerLabel} · hora de Nueva York</>} actions={<>
      {acc.isAdmin && pend != null && <span data-testid="outbox-pending" title="Avisos de tarea nueva o vencida que ya están en la bandeja y n8n todavía no envió" className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold', pend ? 'bg-[#FFF1D6] text-[#7A4B00]' : 'bg-canvas text-slate')}><Icon n="mail" s={14} />Avisos pendientes de envío: {pend}</span>}
      <Link to="/tasks" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate hover:bg-sky"><Icon n="table" s={16} />Vista de tabla</Link>
      {acc.obj('tasks', 'create') && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Nueva tarea</Button>}</>} />

    {/* contadores */}
    <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3" role="group" aria-label="Resumen de tareas abiertas">
      {chips.map(c => <button key={c.id} type="button" onClick={() => { setParam({ view: null, bucket: bucket === c.id ? null : c.id }); }} aria-pressed={bucket === c.id} data-chip={c.id}
        className={cx('cursor-pointer rounded-xl border bg-white p-3 text-left transition-colors hover:border-link', bucket === c.id ? 'border-navy ring-2 ring-navy/15' : 'border-line')}>
        <div className="text-[11.5px] font-bold uppercase tracking-wide text-slate">{c.label}</div><div className={cx('mt-0.5 font-display text-[28px] font-bold leading-none tabular', c.n && c.tone === 'text-bad' ? 'text-bad' : 'text-navy')}>{c.n}</div></button>)}
    </div>

    {/* barra de herramientas */}
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Tipo de vista" className="inline-flex overflow-hidden rounded-lg border border-line-2">{([['list', 'Lista', 'list'], ['cal', 'Calendario', 'calendar']] as const).map(([v, l, ic]) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setParam({ view: v === 'list' ? null : v })} className={cx('inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[13.5px] font-semibold', view === v ? 'bg-navy text-white' : 'bg-white text-slate hover:bg-sky')}><Icon n={ic} s={15} />{l}</button>)}</div>
      {canPick ? <Select aria-label="Persona o equipo" value={owner} onChange={e => setParam({ owner: e.target.value === (hasMe ? 'me' : 'all') ? null : e.target.value })} className="!w-auto min-w-44 !font-semibold">
        {hasMe && <option value="me">Mis tareas</option>}<option value="all">Todas las personas</option>
        {TEAMS().length > 0 && <optgroup label="Equipos">{TEAMS().map(t => <option key={t} value={`team:${t}`}>{t}</option>)}</optgroup>}
        <optgroup label="Personas">{OWNERS.filter(o => o.id !== ME.id).map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}</optgroup><option value="none">Sin propietario</option></Select>
        : <span className="rounded-lg bg-sky px-3 py-1.5 text-[13.5px] font-semibold text-navy">Mis tareas</span>}
      <div className="relative min-w-40 flex-1 sm:max-w-xs"><Icon n="search" s={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar tareas" aria-label="Buscar tareas" className="h-9 w-full rounded-lg border border-line-2 bg-white pl-8 pr-3 text-sm focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></div>
      <Button onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen} icon="filter">Filtros{activeFilters ? ` (${activeFilters})` : ''}</Button>
      {activeFilters > 0 && <button type="button" onClick={clear} className="cursor-pointer text-[13px] font-semibold text-link hover:underline">Quitar filtros</button>}
      {view === 'cal' && status === 'open' && <label className="ml-auto inline-flex items-center gap-2 text-[13px] text-slate"><Switch on={showDone} onChange={setShowDone} label="Mostrar completadas" />Mostrar completadas</label>}
    </div>
    {filtersOpen && <div className="mb-3 grid gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Filtros">
      <label className="block text-[12px] font-semibold text-slate">Estado<Select aria-label="Estado" value={status} onChange={e => setParam({ status: e.target.value === 'open' ? null : e.target.value })} className="mt-1"><option value="open">Abiertas</option><option value="all">Todas</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
      <label className="block text-[12px] font-semibold text-slate">Prioridad<Select aria-label="Prioridad" value={prio} onChange={e => setParam({ prio: e.target.value })} className="mt-1"><option value="">Todas</option>{PRIO_ORDER.map(p => <option key={p} value={p}>{PRIO_LABEL[p]}</option>)}</Select></label>
      <label className="block text-[12px] font-semibold text-slate">Tipo<Select aria-label="Tipo" value={type} onChange={e => setParam({ type: e.target.value })} className="mt-1"><option value="">Todos</option>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
      {view === 'list' && <><label className="block text-[12px] font-semibold text-slate">Vence desde<input type="date" aria-label="Vence desde" value={from} onChange={e => setParam({ from: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-line-2 px-2 text-sm focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></label>
        <label className="block text-[12px] font-semibold text-slate">Vence hasta<input type="date" aria-label="Vence hasta" value={to} onChange={e => setParam({ to: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-line-2 px-2 text-sm focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></label></>}
    </div>}

    {view === 'list'
      ? <TaskList tasks={shownTasks} targets={targets} now={now} selected={selected} setSelected={setSelected} act={act} only={null}
          emptyHint={listRes.total === 0 && activeFilters === 0 ? <>{owner === 'me' ? 'No tienes tareas abiertas. ' : ''}{acc.obj('tasks', 'create') && <button type="button" onClick={() => setCreating(true)} className="cursor-pointer font-semibold text-link hover:underline">Crear una tarea</button>}</> : <button type="button" onClick={clear} className="cursor-pointer font-semibold text-link hover:underline">Quitar filtros</button>} />
      : <TaskCalendar tasks={calRes.results} targets={targets} now={now} mode={calMode} setMode={m => setParam({ cal: m === 'month' ? null : m })} anchor={anchor} setAnchor={k => setParam({ date: k === dayKey(now) ? null : k })} act={calAct} />}
    {total > 500 && <p className="mt-2 text-[12.5px] text-slate">Mostrando las primeras 500 de {total}. Usa los filtros para acotar.</p>}

    {/* acciones en lote */}
    {selected.size > 0 && view === 'list' && <div role="region" aria-label="Acciones en lote" className="pop sticky bottom-3 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-navy px-4 py-2.5 text-white shadow-[var(--shadow-pop)]">
      <span className="text-[13.5px] font-semibold" aria-live="polite">{selected.size} {selected.size === 1 ? 'seleccionada' : 'seleccionadas'}</span>
      <Button size="sm" onClick={bulkComplete}><Icon n="check" s={14} />Completar</Button>
      <SnoozeMenu align="left" onPick={fn => { act.snooze(selTasks.filter(t => !isDone(t)), fn); setSelected(new Set()); }} trigger={({ toggle }) => <Button size="sm" onClick={toggle}><Icon n="clock" s={14} />Posponer</Button>} />
      <PrioMenu onPick={p => { act.prio(selTasks, p); setSelected(new Set()); }} trigger={({ toggle }) => <Button size="sm" onClick={toggle}>Prioridad<Icon n="chevD" s={13} /></Button>} />
      <OwnerMenu onPick={o => { act.owner(selTasks, o); setSelected(new Set()); }} trigger={({ toggle }) => <Button size="sm" onClick={toggle}><Icon n="user" s={14} />Reasignar</Button>} />
      <button type="button" onClick={() => setSelected(new Set())} className="ml-auto cursor-pointer rounded-lg px-2 py-1 text-[13px] font-semibold text-white/80 hover:bg-white/15">Limpiar selección</button></div>}

    {undo && <div role="status" aria-live="polite" data-testid="undo-bar" className="pop fixed bottom-[4.5rem] left-1/2 z-[95] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white shadow-2xl md:bottom-16">{undo.msg}
      <button type="button" onClick={() => { undo.fn(); setUndo(null); }} className="cursor-pointer rounded-md px-2 py-0.5 font-bold text-teal hover:bg-white/10">Deshacer</button>
      <button type="button" aria-label="Cerrar aviso" onClick={() => setUndo(null)} className="cursor-pointer text-white/70 hover:text-white"><Icon n="x" s={14} /></button></div>}
    {openId && <TaskDrawer id={openId} target={targets.get(openId)} onClose={() => setOpenId(null)} onUndo={announce} />}
    {creating && <NewTaskModal defaultOwner={owner === 'me' || !canPick ? ME.id : /^\d+$/.test(owner) ? owner : ME.id} onClose={() => setCreating(false)} onCreated={() => {}} />}
  </div>;
}
void Empty; void Popover; void PRIO_STYLE; void Tag; void gridRange; void keyLabel;
