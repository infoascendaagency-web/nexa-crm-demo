import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { crm, store, useCount, useDbValue, useSearch } from '../lib/api';
import { BUILTIN_VIEWS, OBJECTS, OWNERS, PINNED_DEFAULT, PIPELINES, propDef, propLabel, stageLabel, type ObjectCfg, type PipeObj } from '../lib/schema';
import type { Filter, FilterGroup, KpiDef, ObjKey, Rec, Sort, ViewDef } from '../lib/types';
import { Cell, displayValue } from './cells';
import Icon from './Icon';
import FilterPanel, { PropertyPicker, describeFilter, propsOf } from './FilterPanel';
import { optionLabel } from './OptionPill';
import { useStageGate } from './StageGate';
import PropertyInput, { optionsFor } from './PropertyInput';
import CreateRecord from './CreateRecord';
import { Avatar, Button, Checkbox, Drawer, Field, IconButton, Input, MenuItem, Modal, Popover, Select, cx, inputCls, useToast } from './ui';
import { fmtMoney } from '../lib/fmt';
import { useAccess } from '../lib/perms';

const BOARD_OBJS: ObjKey[] = ['deals', 'appointments'];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const combine = (groups: FilterGroup[], extra: Filter[]): FilterGroup[] => (!extra.length ? groups : groups.length ? groups.map(g => ({ filters: [...g.filters, ...extra] })) : [{ filters: extra }]);

/* ---------- Filtros rápidos ---------- */
const DATE_PRESETS: { label: string; f: Filter[] }[] = [
  { label: 'Hoy', f: [{ propertyName: '', operator: 'GTE', value: '{{today_start}}' }, { propertyName: '', operator: 'LTE', value: '{{today_end}}' }] },
  { label: 'Últimos 7 días', f: [{ propertyName: '', operator: 'GTE', value: '{{days_ago:7}}' }] },
  { label: 'Últimos 30 días', f: [{ propertyName: '', operator: 'GTE', value: '{{days_ago:30}}' }] },
  { label: 'Hace más de 7 días', f: [{ propertyName: '', operator: 'LT', value: '{{days_ago:7}}' }] },
  { label: 'Hace más de 30 días', f: [{ propertyName: '', operator: 'LT', value: '{{days_ago:30}}' }] },
  { label: 'Próximos 7 días', f: [{ propertyName: '', operator: 'GTE', value: '{{now}}' }, { propertyName: '', operator: 'LTE', value: '{{days_ahead:7}}' }] },
  { label: 'Sin valor', f: [{ propertyName: '', operator: 'NOT_HAS_PROPERTY' }] },
];
type QF = { prop: string; filters: Filter[]; chips: string[] };

function QuickFilter({ obj, prop, value, onChange }: { obj: ObjKey; prop: string; value?: QF; onChange: (v: QF | null) => void }) {
  const d = propDef(obj, prop); const opts = optionsFor(obj, prop); const isDate = d?.type === 'datetime' || d?.type === 'date' || ['createdate', 'lastmodifieddate', 'hs_createdate', 'hs_lastmodifieddate'].includes(prop);
  const label = propLabel(obj, prop); const active = !!value;
  return <Popover width="w-64" trigger={({ toggle, open }) => <button onClick={toggle} aria-expanded={open} className={cx('inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-[13.5px] font-semibold hover:bg-sky', active ? 'bg-sky text-navy' : 'text-slate')}>{label}{active && <span className="rounded-full bg-navy px-1.5 text-[11px] text-white">{value!.chips.length}</span>}<Icon n="chevD" s={13} /></button>}>
    {close => <div className="max-h-72 overflow-auto scroll-thin">
      {opts && !isDate && <>{opts.map(o => { const sel = (value?.filters[0]?.values ?? []).includes(o.value); return <div key={o.value} className="px-2 py-1"><Checkbox label={optionLabel(o)} aria={o.label} checked={sel} onChange={c => { const cur = value?.filters[0]?.values ?? []; const nv = c ? [...cur, o.value] : cur.filter(x => x !== o.value); onChange(nv.length ? { prop, filters: [{ propertyName: prop, operator: 'IN', values: nv }], chips: nv } : null); }} /></div>; })}
        {prop === 'hubspot_owner_id' && <div className="px-2 py-1"><Checkbox label="Sin propietario" checked={value?.filters[0]?.operator === 'NOT_HAS_PROPERTY'} onChange={c => onChange(c ? { prop, filters: [{ propertyName: prop, operator: 'NOT_HAS_PROPERTY' }], chips: ['Sin propietario'] } : null)} /></div>}</>}
      {isDate && DATE_PRESETS.map(p => <MenuItem key={p.label} onClick={() => { onChange({ prop, filters: p.f.map(f => ({ ...f, propertyName: prop })), chips: [p.label] }); close(); }}>{p.label}{value?.chips[0] === p.label && <Icon n="check" s={14} className="ml-auto text-good" />}</MenuItem>)}
      {!opts && !isDate && <div className="p-2"><Input autoFocus placeholder={`Contiene…`} defaultValue={value?.filters[0]?.value ?? ''} onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); onChange(v ? { prop, filters: [{ propertyName: prop, operator: 'CONTAINS_TOKEN', value: v }], chips: [v] } : null); close(); } }} /><div className="mt-1 flex gap-1"><MenuItem onClick={() => { onChange({ prop, filters: [{ propertyName: prop, operator: 'HAS_PROPERTY' }], chips: ['Tiene valor'] }); close(); }}>Tiene valor</MenuItem><MenuItem onClick={() => { onChange({ prop, filters: [{ propertyName: prop, operator: 'NOT_HAS_PROPERTY' }], chips: ['Sin valor'] }); close(); }}>Sin valor</MenuItem></div></div>}
      {active && <div className="mt-1 border-t border-line pt-1"><MenuItem icon="x" onClick={() => { onChange(null); close(); }}>Quitar filtro</MenuItem></div>}
    </div>}
  </Popover>;
}

function Kpi({ obj, k, base }: { obj: ObjKey; k: KpiDef; base: FilterGroup[] }) {
  const n = useCount(obj, base.length ? base.flatMap(bg => k.filterGroups.map(kg => ({ filters: [...bg.filters, ...kg.filters] }))) : k.filterGroups);
  return <div className="px-4 py-3 text-center"><div className="text-[11px] font-bold uppercase tracking-wide text-slate">{k.label}</div><div className="mt-1 font-display text-[30px] font-bold leading-none text-link tabular">{n}</div></div>;
}

/* ---------- Columnas ---------- */
function ColumnsModal({ obj, cols, onApply, onClose }: { obj: ObjKey; cols: string[]; onApply: (c: string[]) => void; onClose: () => void }) {
  const [sel, setSel] = useState(cols); const [q, setQ] = useState('');
  const avail = propsOf(obj).filter(p => !sel.includes(p.name) && (p.label.toLowerCase().includes(q.toLowerCase()) || p.name.includes(q.toLowerCase()))).slice(0, 60);
  const move = (i: number, d: number) => setSel(s => { const a = [...s]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  return <Modal title="Elegir qué columnas ver" onClose={onClose} width="max-w-3xl" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => { onApply(sel); onClose(); }}>Aplicar</Button></>}>
    <div className="grid gap-4 md:grid-cols-2">
      <div><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar propiedades" aria-label="Buscar propiedades" className="mb-2" />
        <div className="scroll-thin h-72 overflow-auto rounded-lg border border-line">{avail.map(p => <button key={p.name} className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left text-[13.5px] hover:bg-sky" onClick={() => setSel(s => [...s, p.name])}><span className="truncate">{p.label}</span><Icon n="plus" s={14} className="text-slate" /></button>)}</div></div>
      <div><div className="mb-2 text-[13px] font-semibold text-slate">Columnas seleccionadas ({sel.length})</div>
        <div className="scroll-thin h-72 overflow-auto rounded-lg border border-line">{sel.map((c, i) => <div key={c} className="flex items-center gap-1 border-b border-line/60 px-2 py-1 text-[13.5px]"><span className="min-w-0 flex-1 truncate">{propLabel(obj, c)}</span><IconButton n="up" label="Subir" onClick={() => move(i, -1)} className="!h-6 !w-6" /><IconButton n="down" label="Bajar" onClick={() => move(i, 1)} className="!h-6 !w-6" /><IconButton n="x" label="Quitar" onClick={() => setSel(s => s.filter(x => x !== c))} className="!h-6 !w-6" /></div>)}</div></div>
    </div></Modal>;
}

/* ---------- Tablero (kanban) ---------- */
function Board({ cfg, rows, pipelineId, onMove }: { cfg: ObjectCfg; rows: Rec[]; pipelineId: string; onMove: (id: string, stage: string) => void }) {
  const list = cfg.key as PipeObj; const pipe = PIPELINES[list].find(p => p.id === pipelineId) ?? PIPELINES[list][0];
  const [over, setOver] = useState<string | null>(null);
  return <div className="scroll-thin flex gap-3 overflow-x-auto pb-3">{pipe.stages.map(s => { const items = rows.filter(r => r.properties[cfg.stageProp!] === s.id); const total = items.reduce((a, r) => a + (Number(r.properties[cfg.boardAmountProp ?? '']) || 0), 0);
    return <div key={s.id} onDragOver={e => { e.preventDefault(); setOver(s.id); }} onDragLeave={() => setOver(null)} onDrop={e => { setOver(null); const id = e.dataTransfer.getData('text/plain'); if (id) onMove(id, s.id); }} className={cx('w-[280px] shrink-0 rounded-xl bg-[#EAF0F6] p-2', over === s.id && 'ring-2 ring-teal')}>
      <div className="px-2 pb-2 pt-1"><div className="flex items-center justify-between"><span className="truncate text-[13px] font-bold text-navy" title={s.label}>{s.label}</span><span className="rounded-full bg-white px-2 text-[12px] font-semibold text-slate">{items.length}</span></div>{cfg.boardAmountProp && <div className="text-[12px] text-slate">{fmtMoney(String(total))}</div>}</div>
      <div className="flex flex-col gap-2">{items.map(r => <Link key={r.id} to={`${cfg.path}/${r.id}`} draggable onDragStart={e => e.dataTransfer.setData('text/plain', r.id)} className="block cursor-grab rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-line hover:ring-teal">
        <div className="truncate text-[13.5px] font-semibold text-link">{crm.nameOf(r, cfg.key)}</div>
        <div className="mt-1 flex items-center justify-between text-[12px] text-slate"><span>{cfg.key === 'deals' ? fmtMoney(r.properties.amount) : displayValue('appointments', r, 'hs_appointment_start')}</span><Avatar name={displayValue(cfg.key, r, 'hubspot_owner_id') || '?'} size={20} /></div></Link>)}
        {items.length === 0 && <div className="rounded-lg border border-dashed border-line-2 px-2 py-6 text-center text-[12px] text-mute">Suelta aquí</div>}</div></div>; })}</div>;
}

/* ---------- Paginación ---------- */
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const win = 11; const start = Math.max(1, Math.min(page - 5, pages - win + 1)); const nums = Array.from({ length: Math.min(win, pages) }, (_, i) => start + i);
  return <div className="flex items-center justify-center gap-1 text-[13.5px]"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="cursor-pointer rounded px-2 py-1 font-semibold text-slate hover:bg-sky disabled:opacity-40"><Icon n="chevL" s={13} className="mr-1 inline" />Anterior</button>
    {nums.map(n => <button key={n} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} className={cx('h-7 min-w-7 cursor-pointer rounded-full px-2 font-semibold hover:bg-sky', n === page ? 'bg-white text-navy ring-2 ring-navy' : 'text-slate')}>{n}</button>)}
    <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="cursor-pointer rounded px-2 py-1 font-semibold text-slate hover:bg-sky disabled:opacity-40">Siguiente<Icon n="chevR" s={13} className="ml-1 inline" /></button></div>;
}

/* ---------- Lista de objetos ---------- */
export default function ObjectIndex({ obj }: { obj: ObjKey }) {
  const gate = useStageGate();
  const cfg = OBJECTS[obj]; const acc = useAccess(); const nav = useNavigate(); const toast = useToast(); const [sp, setSp] = useSearchParams();
  const userViews = useDbValue(() => store.userViews().filter(v => v.objectType === obj), [obj]);
  const allViews = useMemo(() => [...BUILTIN_VIEWS.filter(v => v.objectType === obj), ...userViews], [obj, userViews]);
  const pinnedIds = useDbValue(() => store.getPinned(obj, PINNED_DEFAULT[obj]), [obj]);
  const viewId = sp.get('view') ?? pinnedIds[0] ?? allViews[0]?.id; const view = allViews.find(v => v.id === viewId) ?? allViews[0];
  const page = Math.max(1, Number(sp.get('page') ?? 1)); const size = Number(sp.get('size') ?? 50); const q = sp.get('q') ?? '';
  const pl = cfg.pipelineProp ? PIPELINES[obj as PipeObj] : null; const pipeId = sp.get('pipe') ?? pl?.[0].id;
  const setParam = (k: string, v: string | null, resetPage = true) => setSp(p => { const n = new URLSearchParams(p); v == null || v === '' ? n.delete(k) : n.set(k, v); if (resetPage && k !== 'page') n.delete('page'); return n; }, { replace: true });

  // copia de trabajo de la vista (cambios sin guardar)
  const base = useMemo(() => ({ filterGroups: view?.filterGroups ?? [], columns: view?.columns ?? [], sorts: view?.sorts ?? [], qf: view?.quickFilters ?? [] }), [view]);
  const [work, setWork] = useState(() => clone(base)); const [quick, setQuick] = useState<Record<string, QF>>({}); const [mode, setMode] = useState<'table' | 'board'>(view?.mode ?? 'table');
  useEffect(() => { setWork(clone(base)); setQuick({}); setMode(view?.mode ?? 'table'); setSel(new Set()); }, [view?.id]); // eslint-disable-line
  const dirty = JSON.stringify(work) !== JSON.stringify(base);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [showFilter, setShowFilter] = useState(false); const [showCols, setShowCols] = useState(false); const [create, setCreate] = useState(false); const [preview, setPreview] = useState<Rec | null>(null); const [newView, setNewView] = useState(false); const [nameDlg, setNameDlg] = useState<null | { kind: 'clone' | 'rename'; value: string }>(null); const [delDlg, setDelDlg] = useState(false); const [bulk, setBulk] = useState<'edit' | null>(null); const [collapsed, setCollapsed] = useState(false);

  const extra: Filter[] = [...Object.values(quick).flatMap(x => x.filters), ...(pl && pipeId && cfg.pipelineProp ? [{ propertyName: cfg.pipelineProp, operator: 'EQ' as const, value: pipeId }] : [])];
  const groups = combine(work.filterGroups, extra);
  const isBoard = mode === 'board' && BOARD_OBJS.includes(obj);
  const res = useSearch(obj, { filterGroups: groups, sorts: work.sorts, query: q, limit: isBoard ? 1000 : size, after: isBoard ? 0 : (page - 1) * size });
  const pages = Math.max(1, Math.ceil(res.total / size));
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,select')) { e.preventDefault(); document.getElementById('idx-search')?.focus(); } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);

  if (!view) return null;
  const filterCount = work.filterGroups.reduce((a, g) => a + g.filters.length, 0) + Object.keys(quick).length;
  const sortBy = (prop: string) => setWork(w => { const cur = w.sorts[0]; const dir = cur?.propertyName === prop && cur.direction === 'ASCENDING' ? 'DESCENDING' : 'ASCENDING'; return { ...w, sorts: [{ propertyName: prop, direction: dir }] as Sort[] }; });
  const saveView = (asNew?: string) => { if (view.builtin || asNew) { const id = `u-${Date.now()}`; store.saveView({ ...view, id, name: asNew ?? `${view.name} (copia)`, builtin: false, owner: 'Jose', shared: 'PRIVATE', filterGroups: work.filterGroups, columns: work.columns, sorts: work.sorts, quickFilters: work.qf }); store.setPinned(obj, [...pinnedIds, id]); setParam('view', id); toast('Vista guardada como nueva'); } else { store.saveView({ ...view, filterGroups: work.filterGroups, columns: work.columns, sorts: work.sorts, quickFilters: work.qf }); toast('Vista guardada'); } };
  const cloneView = (name: string) => saveView(name);
  const renameView = (name: string) => { if (view.builtin) return; store.saveView({ ...view, name }); toast('Vista renombrada'); };
  const shareView = (shared: 'PRIVATE' | 'PUBLIC') => { if (view.builtin) return; store.saveView({ ...view, shared }); toast(shared === 'PUBLIC' ? 'Vista compartida con todo el equipo' : 'La vista ahora es privada'); };
  const exportCsv = () => { const rows = crm.search(obj, { filterGroups: groups, sorts: work.sorts, query: q, limit: 100000 }).results; const head = work.columns.map(c => propLabel(obj, c)); const esc = (s: string) => `"${s.replace(/"/g, '""')}"`; const body = rows.map(r => work.columns.map(c => esc(c.startsWith('@') ? (c === '@name' ? crm.nameOf(r, obj) : '') : displayValue(obj, r, c))).join(',')); const blob = new Blob(['﻿' + [head.map(esc).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${cfg.plural.toLowerCase()}-${view.name.replace(/\W+/g, '-')}.csv`; a.click(); toast(`${rows.length} filas exportadas`); };
  const visible = pinnedIds.map(id => allViews.find(v => v.id === id)).filter(Boolean) as ViewDef[];
  const allSel = res.results.length > 0 && res.results.every(r => sel.has(r.id));
  const selIds = [...sel];

  return <div className="flex min-h-full flex-col px-5 pb-4 pt-4">{gate.node}
    <div className="flex items-center justify-between gap-2">
      <Popover width="w-56" trigger={({ toggle }) => <button onClick={toggle} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-1 py-0.5 hover:bg-sky"><h1 className="font-display text-[22px] font-bold leading-tight text-navy sm:text-[26px]">{cfg.plural}</h1><Icon n="chevD" s={16} className="text-slate" /></button>}>
        {close => <>{(['contacts', 'companies', 'deals', 'appointments', 'calls', 'tasks'] as ObjKey[]).map(o => <MenuItem key={o} icon={OBJECTS[o].icon} onClick={() => { close(); nav(OBJECTS[o].path); }}>{OBJECTS[o].plural}</MenuItem>)}</>}
      </Popover>
      <div className="flex items-center gap-2">
        <Popover align="right" width="w-56" trigger={({ toggle }) => <IconButton n="dotsV" label="Más acciones" onClick={toggle} className="border border-line-2 bg-white" />}>
          {close => <>{acc.tool('export') && <MenuItem icon="download" onClick={() => { close(); exportCsv(); }}>Exportar vista (CSV)</MenuItem>}<MenuItem icon="table" onClick={() => { close(); setShowCols(true); }}>Editar columnas</MenuItem><MenuItem icon="gear" onClick={() => { close(); nav('/settings/properties?object=' + obj); }}>Editar propiedades</MenuItem><MenuItem icon="list" onClick={() => { close(); nav(`/views/${obj}`); }}>Administrar vistas</MenuItem></>}
        </Popover>
        {acc.obj(obj, 'create') && <Button variant="primary" className="shrink-0" onClick={() => setCreate(true)}><Icon n="plus" s={15} className="sm:hidden" /><span className="max-sm:sr-only">Agregar {cfg.plural.toLowerCase()}</span></Button>}
      </div>
    </div>

    {/* Pestañas de vistas */}
    <div className="mt-3 flex items-center gap-1 border-b border-line" role="tablist">
      <div className="scroll-thin flex min-w-0 items-center overflow-x-auto" onKeyDown={e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const i = visible.findIndex(v => v.id === view.id); const nx = visible[(i + (e.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length]; if (nx) { e.preventDefault(); setSp({ view: nx.id }, { replace: true }); setTimeout(() => (e.currentTarget.querySelector('[aria-selected=true]') as HTMLElement | null)?.focus(), 0); } }}>{visible.map(v => <button key={v.id} role="tab" tabIndex={v.id === view.id ? 0 : -1} aria-selected={v.id === view.id} onClick={() => { setSp({ view: v.id }, { replace: true }); }} className={cx('-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13.5px] font-semibold', v.id === view.id ? 'border-brand text-navy' : 'border-transparent text-slate hover:text-navy')}><Icon n={v.mode === 'board' ? 'board' : 'table'} s={14} />{v.name}{!v.builtin && v.shared === 'PUBLIC' && <Icon n="users" s={12} className="text-mute" />}</button>)}</div>
      <Popover width="w-72" trigger={({ toggle }) => <button onClick={toggle} className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-slate hover:bg-sky"><Icon n="dots" s={15} />Más</button>}>
        {close => <div><div className="scroll-thin max-h-72 overflow-auto">{allViews.filter(v => !pinnedIds.includes(v.id)).map(v => <MenuItem key={v.id} onClick={() => { close(); setSp({ view: v.id }, { replace: true }); }} icon="table">{v.name}</MenuItem>)}{allViews.every(v => pinnedIds.includes(v.id)) && <p className="px-3 py-2 text-[13px] text-slate">Todas las vistas están fijadas.</p>}</div><div className="mt-1 border-t border-line pt-1"><MenuItem icon="list" onClick={() => { close(); nav(`/views/${obj}`); }}>Todas las vistas</MenuItem></div></div>}
      </Popover>
      <Popover width="w-60" trigger={({ toggle }) => <button type="button" onClick={toggle} aria-label="Agregar vista" className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-link hover:bg-sky"><Icon n="plus" s={15} />Agregar vista</button>}>
        {close => <><MenuItem icon="plus" onClick={() => { close(); setNewView(true); }}>Crear vista nueva</MenuItem><MenuItem icon="copy" onClick={() => { close(); setNameDlg({ kind: 'clone', value: `${view.name} (copia)` }); }}>Clonar “{view.name.length > 22 ? view.name.slice(0, 22) + '…' : view.name}”</MenuItem><MenuItem icon="list" onClick={() => { close(); nav(`/views/${obj}`); }}>Administrar todas las vistas</MenuItem></>}
      </Popover>
      <div className="ml-auto flex items-center gap-1 pb-1">
        {dirty && <><Button size="sm" variant="ghost" onClick={() => { setWork(clone(base)); }}>Restablecer</Button><Button size="sm" variant="primary" onClick={() => saveView()}>{view.builtin ? 'Guardar como nueva vista' : 'Guardar vista'}</Button></>}
        <Popover align="right" width="w-56" trigger={({ toggle }) => <IconButton n="chevD" label="Opciones de la vista" onClick={toggle} />}>
          {close => <>
            {dirty && <MenuItem icon="check" onClick={() => { close(); saveView(); }}>{view.builtin ? 'Guardar como nueva vista' : 'Guardar vista'}</MenuItem>}
            <MenuItem icon="edit" disabled={view.builtin} onClick={() => { close(); setNameDlg({ kind: 'rename', value: view.name }); }}>Renombrar{view.builtin ? ' (solo mis vistas)' : ''}</MenuItem>
            <MenuItem icon="copy" onClick={() => { close(); setNameDlg({ kind: 'clone', value: `${view.name} (copia)` }); }}>Clonar vista</MenuItem>
            <MenuItem icon="users" disabled={view.builtin} onClick={() => { close(); shareView(view.shared === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'); }}>{view.shared === 'PUBLIC' ? (view.builtin ? 'Compartida con el equipo' : 'Dejar de compartir (privada)') : 'Compartir con el equipo'}</MenuItem>
            <MenuItem icon="pin" onClick={() => { close(); store.setPinned(obj, pinnedIds.includes(view.id) ? pinnedIds.filter(x => x !== view.id) : [...pinnedIds, view.id]); }}>{pinnedIds.includes(view.id) ? 'Quitar de pestañas' : 'Fijar en pestañas'}</MenuItem>
            {!view.builtin && <><div className="my-1 border-t border-line" /><MenuItem icon="trash" danger onClick={() => { close(); setDelDlg(true); }}>Eliminar vista</MenuItem></>}</>}
        </Popover>
      </div>
    </div>

    {/* Barra de herramientas */}
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-auto"><Icon n="search" s={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input id="idx-search" value={q} onChange={e => setParam('q', e.target.value)} placeholder="Buscar ( / )" aria-label={`Buscar ${cfg.plural.toLowerCase()}`} className="h-9 w-full rounded-full border border-line-2 bg-white pl-8 pr-3 text-sm placeholder:text-mute focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25 sm:w-56" /></div>
      <Button size="md" icon="filter" onClick={() => setShowFilter(true)} className={filterCount ? '!border-navy' : ''}>Filtro{filterCount ? ` (${filterCount})` : ''}</Button>
      <Popover width="w-64" trigger={({ toggle }) => <Button icon="sort" onClick={toggle}>Ordenar por</Button>}>
        {close => <div className="scroll-thin max-h-72 overflow-auto">{work.columns.filter(c => !c.startsWith('@')).map(c => <MenuItem key={c} onClick={() => { setWork(w => ({ ...w, sorts: [{ propertyName: c, direction: w.sorts[0]?.propertyName === c && w.sorts[0].direction === 'ASCENDING' ? 'DESCENDING' : 'ASCENDING' }] })); close(); }}>{propLabel(obj, c)}{work.sorts[0]?.propertyName === c && <Icon n={work.sorts[0].direction === 'ASCENDING' ? 'up' : 'down'} s={14} className="ml-auto text-navy" />}</MenuItem>)}</div>}
      </Popover>
      <div className="ml-auto flex items-center gap-2">
        {pl && <Select aria-label="Pipeline" value={pipeId} onChange={e => setParam('pipe', e.target.value)} className="!w-auto max-w-[300px]">{pl.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>}
        {BOARD_OBJS.includes(obj) && <div className="inline-flex overflow-hidden rounded-lg border border-line-2 bg-white" role="group" aria-label="Tipo de vista"><button aria-pressed={mode === 'board'} aria-label="Tablero" onClick={() => setMode('board')} className={cx('grid h-9 w-9 cursor-pointer place-items-center', mode === 'board' ? 'bg-sky text-navy' : 'text-slate')}><Icon n="board" s={16} /></button><button aria-pressed={mode === 'table'} aria-label="Tabla" onClick={() => setMode('table')} className={cx('grid h-9 w-9 cursor-pointer place-items-center border-l border-line-2', mode === 'table' ? 'bg-sky text-navy' : 'text-slate')}><Icon n="table" s={16} /></button></div>}
        <IconButton n="gear" label="Columnas y ajustes" onClick={() => setShowCols(true)} className="border border-line-2 bg-white" />
        <IconButton n={collapsed ? 'chevD' : 'chevU'} label={collapsed ? 'Mostrar resumen' : 'Ocultar resumen'} onClick={() => setCollapsed(c => !c)} className="border border-line-2 bg-white" />
      </div>
    </div>

    {/* Filtros rápidos */}
    {!collapsed && <div className="mt-2 flex flex-wrap items-center gap-1">
      {work.qf.map(p => <QuickFilter key={p} obj={obj} prop={p} value={quick[p]} onChange={v => setQuick(s => { const n = { ...s }; v ? (n[p] = v) : delete n[p]; return n; })} />)}
      <Popover width="w-72" trigger={({ toggle }) => <IconButton n="plus" label="Agregar filtro rápido" onClick={toggle} className="border border-line-2 !h-7 !w-7" />}>{close => <PropertyPicker obj={obj} placeholder="Elige una propiedad" onChange={n => { setWork(w => ({ ...w, qf: w.qf.includes(n) ? w.qf : [...w.qf, n] })); close(); }} />}</Popover>
      {work.qf.length > 0 && <IconButton n="trash" label="Quitar todos los filtros rápidos" onClick={() => { setWork(w => ({ ...w, qf: [] })); setQuick({}); }} className="!h-7 !w-7" />}
      {(Object.keys(quick).length > 0 || dirty) && <button className="ml-1 cursor-pointer text-[13px] font-semibold text-link hover:underline" onClick={() => { setQuick({}); setWork(clone(base)); }}>Borrar todo</button>}
      {work.filterGroups.some(g => g.filters.length) && <button onClick={() => setShowFilter(true)} className="ml-1 inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-sky px-2.5 text-[13px] font-semibold text-navy"><Icon n="filter" s={13} />Filtros avanzados</button>}
    </div>}
    {!collapsed && Object.values(quick).length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{Object.values(quick).map(x => <span key={x.prop} className="rounded-full bg-sky px-2.5 py-0.5 text-[12px] text-navy">{describeFilter(obj, x.filters[0])}</span>)}</div>}

    {/* KPIs */}
    {!collapsed && view.kpis && <div className="mt-3 grid grid-cols-2 divide-x divide-line rounded-xl border border-line bg-white md:grid-cols-4">{view.kpis.map(k => <Kpi key={k.label} obj={obj} k={k} base={groups} />)}</div>}

    {/* Acciones en lote */}
    {sel.size > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-navy px-4 py-2 text-white">
      <span className="text-sm font-semibold">{sel.size} seleccionado(s)</span>
      <Popover width="w-60" trigger={({ toggle }) => <Button size="sm" variant="secondary" onClick={toggle} icon="user">Asignar propietario</Button>}>{close => <>{OWNERS.map(o => <MenuItem key={o.id} onClick={() => { selIds.forEach(id => crm.update(obj, id, { hubspot_owner_id: o.id })); toast(`${selIds.length} registro(s) asignados a ${o.firstName}`); setSel(new Set()); close(); }}>{o.firstName} {o.lastName}</MenuItem>)}</>}</Popover>
      <Button size="sm" variant="secondary" icon="edit" onClick={() => setBulk('edit')}>Editar propiedad</Button>
      <Button size="sm" variant="secondary" icon="download" onClick={exportCsv}>Exportar</Button>
      {acc.tool('bulkDelete') && <Button size="sm" variant="danger" icon="trash" onClick={() => { if (confirm(`¿Eliminar ${sel.size} registro(s)?`)) { crm.remove(obj, selIds); setSel(new Set()); toast('Registros eliminados'); } }}>Eliminar</Button>}
      <button className="ml-auto cursor-pointer text-sm underline" onClick={() => setSel(new Set())}>Cancelar</button></div>}

    {/* Contenido */}
    <div className="mt-3 flex-1">
      {isBoard ? <Board cfg={cfg} rows={res.results} pipelineId={pipeId!} onMove={(id, stage) => { const rr = res.results.find(x => x.id === id); if (rr && gate.move(obj, rr, stage)) return; crm.update(obj, id, { [cfg.stageProp!]: stage }); toast(`Movido a "${stageLabel(obj as 'deals' | 'appointments', pipeId, stage)}"`); }} />
        : <div className="scroll-thin max-h-[calc(100vh-14rem)] overflow-auto rounded-xl border border-line bg-white [scrollbar-gutter:stable]"><table className="w-full min-w-max border-collapse text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-white"><tr className="border-b border-line">
            <th className="sticky left-0 z-20 w-12 bg-white px-3 py-2.5 text-left"><Checkbox checked={allSel} indeterminate={sel.size > 0 && !allSel} aria="Seleccionar todo" onChange={c => setSel(c ? new Set(res.results.map(r => r.id)) : new Set())} /></th>
            {work.columns.map((c, i) => <th key={c} className={cx('whitespace-nowrap px-3 py-2.5 text-left text-[12.5px] font-bold text-slate', i === 0 && 'sticky left-12 z-20 bg-white')}>
              <button className="inline-flex cursor-pointer items-center gap-1 hover:text-navy" onClick={() => !c.startsWith('@') && sortBy(c)} aria-label={`Ordenar por ${propLabel(obj, c)}`}>{propLabel(obj, c)}{work.sorts[0]?.propertyName === c && <Icon n={work.sorts[0].direction === 'ASCENDING' ? 'up' : 'down'} s={12} className="text-navy" />}</button></th>)}
            <th className="w-10 px-2"><IconButton n="plus" label="Agregar columna" onClick={() => setShowCols(true)} className="!h-7 !w-7" /></th>
          </tr></thead>
          <tbody>{res.results.map(r => <tr key={r.id} className={cx('group border-b border-line/70 hover:bg-sky/40', sel.has(r.id) && 'bg-sky/60')}>
            <td className="sticky left-0 z-[5] bg-white px-3 py-2 group-hover:bg-[#f1f8fd]"><div className="flex items-center gap-1.5"><Checkbox checked={sel.has(r.id)} aria="Seleccionar fila" onChange={c => setSel(s => { const n = new Set(s); c ? n.add(r.id) : n.delete(r.id); return n; })} />
              <button aria-label="Vista rápida" onClick={() => setPreview(r)} className="cursor-pointer text-mute hover:text-navy"><Icon n="chevR" s={14} /></button></div></td>
            {work.columns.map((c, i) => <td key={c} className={cx('max-w-[280px] px-3 py-2', i === 0 && 'sticky left-12 z-[5] bg-white group-hover:bg-[#f1f8fd]')}>
              {i === 0 && obj === 'tasks' && <button aria-label={r.properties.hs_task_status === 'COMPLETED' ? 'Completada' : 'Marcar como completada'} onClick={() => { crm.update('tasks', r.id, { hs_task_status: r.properties.hs_task_status === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED' }); }} className={cx('mr-2 inline-grid h-5 w-5 cursor-pointer place-items-center rounded-full border align-middle', r.properties.hs_task_status === 'COMPLETED' ? 'border-good bg-good text-white' : 'border-line-2 text-transparent hover:border-good hover:text-good')}><Icon n="check" s={12} stroke={2.4} /></button>}
              <Cell obj={obj} r={r} col={c} /></td>)}
            <td />
          </tr>)}
          {res.results.length === 0 && <tr><td colSpan={work.columns.length + 2} className="py-16 text-center"><Icon n="search" s={28} className="mx-auto mb-2 text-mute" /><div className="font-display text-[16px] font-bold text-navy">No hay {cfg.plural.toLowerCase()} que coincidan</div><div className="text-[13px] text-slate">Prueba a cambiar los filtros o la búsqueda.</div>{(filterCount > 0 || q) && <Button size="sm" className="mt-3" onClick={() => { setQuick({}); setWork(clone(base)); setParam('q', null); }}>Quitar filtros y búsqueda</Button>}</td></tr>}</tbody>
        </table></div>}
    </div>

    {/* Pie */}
    {!isBoard && <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><Pager page={page} pages={pages} onPage={p => setParam('page', String(p), false)} />
      <Select aria-label="Filas por página" value={String(size)} onChange={e => setParam('size', e.target.value)} className="!w-auto">{[25, 50, 100].map(n => <option key={n} value={n}>{n} por página</option>)}</Select></div>}
    <div className="sticky bottom-0 z-30 -mx-5 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas/95 px-5 py-2 backdrop-blur"><span className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-slate ring-1 ring-line tabular">{res.total.toLocaleString('es')} {res.total === 1 ? cfg.singular : cfg.plural.toLowerCase()}</span>
      <div className="flex items-center gap-2"><IconButton n="refresh" label="Actualizar" onClick={() => toast('Datos actualizados')} className="border border-line-2 bg-white" />{acc.tool('export') && <Button icon="download" onClick={exportCsv}>Exportar</Button>}<Button icon="copy" onClick={() => setNameDlg({ kind: 'clone', value: `${view.name} (copia)` })}>Clonar</Button></div></div>

    {showFilter && <FilterPanel obj={obj} groups={work.filterGroups} onClose={() => setShowFilter(false)} onApply={g => setWork(w => ({ ...w, filterGroups: g }))} />}
    {showCols && <ColumnsModal obj={obj} cols={work.columns} onClose={() => setShowCols(false)} onApply={c => setWork(w => ({ ...w, columns: c }))} />}
    {create && <CreateRecord obj={obj} onClose={() => setCreate(false)} />}
    {nameDlg && <NameModal title={nameDlg.kind === 'clone' ? 'Clonar vista' : 'Renombrar vista'} cta={nameDlg.kind === 'clone' ? 'Clonar' : 'Guardar'} value={nameDlg.value} onClose={() => setNameDlg(null)} onSubmit={v => { nameDlg.kind === 'clone' ? cloneView(v) : renameView(v); setNameDlg(null); }} />}
    {delDlg && <Modal title="Eliminar vista" onClose={() => setDelDlg(false)} width="max-w-md" footer={<><Button onClick={() => setDelDlg(false)}>Cancelar</Button><Button variant="danger" onClick={() => { store.deleteView(view.id); store.setPinned(obj, pinnedIds.filter(x => x !== view.id)); setDelDlg(false); setSp({}, { replace: true }); toast('Vista eliminada'); }}>Eliminar vista</Button></>}><p className="text-[14px] text-ink">Se eliminará la vista <b>{view.name}</b>. Los registros no se tocan.</p></Modal>}
    {newView && <NewViewModal obj={obj} onClose={() => setNewView(false)} onCreate={name => { const id = `u-${Date.now()}`; store.saveView({ id, objectType: obj, name, filterGroups: [], columns: work.columns, sorts: work.sorts, owner: 'Jose', shared: 'PRIVATE', quickFilters: work.qf }); store.setPinned(obj, [...pinnedIds, id]); setSp({ view: id }, { replace: true }); setNewView(false); toast('Vista creada'); }} />}
    {preview && <Drawer title={crm.nameOf(preview, obj)} onClose={() => setPreview(null)} footer={<Button variant="primary" onClick={() => nav(`${cfg.path}/${preview.id}`)}>Abrir registro completo</Button>}><dl className="space-y-2.5">{work.columns.filter(c => !c.startsWith('@')).map(c => <div key={c}><dt className="text-[12px] font-bold text-slate">{propLabel(obj, c)}</dt><dd className="text-[14px]"><Cell obj={obj} r={preview} col={c} /></dd></div>)}</dl></Drawer>}
    {bulk === 'edit' && <BulkEdit obj={obj} ids={selIds} onClose={() => { setBulk(null); setSel(new Set()); }} />}
  </div>;
}

function NameModal({ title, cta, value, onClose, onSubmit }: { title: string; cta: string; value: string; onClose: () => void; onSubmit: (v: string) => void }) {
  const [v, setV] = useState(value);
  return <Modal title={title} onClose={onClose} width="max-w-md" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!v.trim()} onClick={() => onSubmit(v.trim())}>{cta}</Button></>}>
    <Field label="Nombre de la vista"><input data-autofocus className={inputCls} value={v} onChange={e => setV(e.target.value)} onFocus={e => e.currentTarget.select()} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) onSubmit(v.trim()); }} /></Field></Modal>;
}
function NewViewModal({ obj, onClose, onCreate }: { obj: ObjKey; onClose: () => void; onCreate: (n: string) => void }) {
  const [name, setName] = useState(''); const ref = useRef<HTMLInputElement>(null); useEffect(() => ref.current?.focus(), []);
  return <Modal title="Crear vista" onClose={onClose} width="max-w-md" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!name.trim()} onClick={() => onCreate(name.trim())}>Crear vista</Button></>}>
    <Field label="Nombre de la vista"><input ref={ref} className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder={`Mis ${OBJECTS[obj].plural.toLowerCase()}`} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()); }} /></Field>
    <p className="text-[13px] text-slate">Se crea privada, con las columnas actuales y sin filtros. Luego puedes ajustarla y guardarla.</p></Modal>;
}
function BulkEdit({ obj, ids, onClose }: { obj: ObjKey; ids: string[]; onClose: () => void }) {
  const toast = useToast(); const [prop, setProp] = useState(''); const [val, setVal] = useState<string | null>(null);
  return <Modal title={`Editar ${ids.length} registro(s)`} onClose={onClose} width="max-w-md" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!prop} onClick={() => { ids.forEach(id => crm.update(obj, id, { [prop]: val })); toast('Registros actualizados'); onClose(); }}>Actualizar</Button></>}>
    <Field label="Propiedad"><PropertyPicker obj={obj} value={prop} onChange={n => { setProp(n); setVal(null); }} /></Field>
    {prop && <Field label="Nuevo valor"><PropertyInput obj={obj} name={prop} value={val} onChange={setVal} /></Field>}</Modal>;
}
