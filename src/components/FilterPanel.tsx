import { useMemo, useState } from 'react';
import { allProps, propLabel, propDef, type PropDef } from '../lib/schema';
import type { Filter, FilterGroup, ObjKey, Op } from '../lib/types';
import Icon from './Icon';
import { optionLabel } from './OptionPill';
import PropertyInput, { optionsFor } from './PropertyInput';
import { Button, Checkbox, Drawer, Input, Popover, Select, cx, inputCls } from './ui';

export function propsOf(obj: ObjKey): { name: string; label: string; def?: PropDef }[] {
  const base = allProps(obj).filter(p => !p.hidden).map(p => ({ name: p.name, label: propLabel(obj, p.name), def: p }));
  const extra = obj === 'contacts' ? [] : [];
  return [...base, ...extra].sort((a, b) => a.label.localeCompare(b.label));
}
// Selector de propiedad con búsqueda (reutilizado en filtros, columnas y tarjetas)
export function PropertyPicker({ obj, value, onChange, exclude = [], placeholder = 'Elige una propiedad' }: { obj: ObjKey; value?: string; onChange: (n: string) => void; exclude?: string[]; placeholder?: string }) {
  const [q, setQ] = useState(''); const all = useMemo(() => propsOf(obj), [obj]);
  const list = all.filter(p => !exclude.includes(p.name) && (p.label.toLowerCase().includes(q.toLowerCase()) || p.name.includes(q.toLowerCase()))).slice(0, 80);
  return <Popover width="w-72" trigger={({ toggle }) => <button type="button" onClick={toggle} className={cx(inputCls, 'flex cursor-pointer items-center justify-between text-left')}><span className={cx('truncate', !value && 'text-mute')}>{value ? propLabel(obj, value) : placeholder}</span><Icon n="chevD" s={14} className="shrink-0 text-slate" /></button>}>
    {close => <div><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar propiedades" aria-label="Buscar propiedades" className={cx(inputCls, 'mb-1')} />
      <div className="scroll-thin max-h-64 overflow-auto">{list.map(p => <button key={p.name} type="button" onClick={() => { onChange(p.name); close(); setQ(''); }} className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[13.5px] hover:bg-sky"><span className="block truncate text-ink">{p.label}</span><span className="block truncate text-[11px] text-mute">{p.def?.groupName ?? ''}</span></button>)}{list.length === 0 && <p className="px-3 py-3 text-[13px] text-slate">Sin resultados</p>}</div></div>}
  </Popover>;
}

type OpDef = { op: Op; label: string; needs: 0 | 1 | 2 | 'multi' };
const OPS = {
  enum: [{ op: 'IN', label: 'es igual a cualquiera de', needs: 'multi' }, { op: 'NOT_IN', label: 'no es igual a ninguno de', needs: 'multi' }, { op: 'HAS_PROPERTY', label: 'tiene un valor', needs: 0 }, { op: 'NOT_HAS_PROPERTY', label: 'está en blanco', needs: 0 }] as OpDef[],
  text: [{ op: 'EQ', label: 'es igual a', needs: 1 }, { op: 'NEQ', label: 'no es igual a', needs: 1 }, { op: 'CONTAINS_TOKEN', label: 'contiene', needs: 1 }, { op: 'NOT_CONTAINS_TOKEN', label: 'no contiene', needs: 1 }, { op: 'HAS_PROPERTY', label: 'tiene un valor', needs: 0 }, { op: 'NOT_HAS_PROPERTY', label: 'está en blanco', needs: 0 }] as OpDef[],
  num: [{ op: 'EQ', label: 'es igual a', needs: 1 }, { op: 'NEQ', label: 'no es igual a', needs: 1 }, { op: 'GT', label: 'es mayor que', needs: 1 }, { op: 'GTE', label: 'es mayor o igual que', needs: 1 }, { op: 'LT', label: 'es menor que', needs: 1 }, { op: 'LTE', label: 'es menor o igual que', needs: 1 }, { op: 'BETWEEN', label: 'está entre', needs: 2 }, { op: 'HAS_PROPERTY', label: 'tiene un valor', needs: 0 }, { op: 'NOT_HAS_PROPERTY', label: 'está en blanco', needs: 0 }] as OpDef[],
  date: [{ op: 'GT', label: 'es posterior a', needs: 1 }, { op: 'LT', label: 'es anterior a', needs: 1 }, { op: 'BETWEEN', label: 'está entre', needs: 2 }, { op: 'HAS_PROPERTY', label: 'tiene un valor', needs: 0 }, { op: 'NOT_HAS_PROPERTY', label: 'está en blanco', needs: 0 }] as OpDef[],
  bool: [{ op: 'EQ', label: 'es igual a', needs: 1 }, { op: 'HAS_PROPERTY', label: 'tiene un valor', needs: 0 }, { op: 'NOT_HAS_PROPERTY', label: 'está en blanco', needs: 0 }] as OpDef[],
};
export function opsFor(obj: ObjKey, name: string): OpDef[] {
  const d = propDef(obj, name); if (name === 'hubspot_owner_id' || optionsFor(obj, name)) return OPS.enum;
  if (d?.type === 'number') return OPS.num; if (d?.type === 'date' || d?.type === 'datetime') return OPS.date; if (d?.type === 'bool') return OPS.bool; return OPS.text;
}
export const describeFilter = (obj: ObjKey, f: Filter) => {
  const od = opsFor(obj, f.propertyName).find(o => o.op === f.operator); const opts = optionsFor(obj, f.propertyName);
  const lab = (v: string) => opts?.find(o => o.value === v)?.label ?? v;
  const val = f.values?.length ? f.values.map(lab).join(' o ') : f.value != null ? lab(f.value) : '';
  return `${propLabel(obj, f.propertyName)} ${od?.label ?? f.operator} ${val}`.trim();
};

function ValueEditor({ obj, f, onChange }: { obj: ObjKey; f: Filter; onChange: (f: Filter) => void }) {
  const od = opsFor(obj, f.propertyName).find(o => o.op === f.operator); const opts = optionsFor(obj, f.propertyName);
  if (!od || od.needs === 0) return null;
  if (od.needs === 'multi' && opts) { const sel = f.values ?? []; return <Popover width="w-64" trigger={({ toggle }) => <button type="button" onClick={toggle} className={cx(inputCls, 'flex cursor-pointer items-center justify-between text-left')}><span className={cx('truncate', !sel.length && 'text-mute')}>{sel.length ? `${sel.length} seleccionado(s)` : 'Elige valores'}</span><Icon n="chevD" s={14} className="text-slate" /></button>}>{() => <div className="scroll-thin max-h-64 overflow-auto p-1">{opts.map(o => <div key={o.value} className="px-2 py-1"><Checkbox label={optionLabel(o)} aria={o.label} checked={sel.includes(o.value)} onChange={c => onChange({ ...f, values: c ? [...sel, o.value] : sel.filter(x => x !== o.value) })} /></div>)}</div>}</Popover>; }
  if (od.needs === 2) return <div className="flex gap-1.5"><Input value={f.value ?? ''} onChange={e => onChange({ ...f, value: e.target.value })} aria-label="Desde" /><Input value={f.highValue ?? ''} onChange={e => onChange({ ...f, highValue: e.target.value })} aria-label="Hasta" /></div>;
  const d = propDef(obj, f.propertyName);
  if (d?.type === 'date' || d?.type === 'datetime') return <Input type="date" value={(f.value ?? '').slice(0, 10)} onChange={e => onChange({ ...f, value: e.target.value ? new Date(e.target.value).toISOString() : '' })} />;
  return <PropertyInput obj={obj} name={f.propertyName} value={f.value ?? null} onChange={v => onChange({ ...f, value: v ?? '' })} />;
}

export default function FilterPanel({ obj, groups, onApply, onClose }: { obj: ObjKey; groups: FilterGroup[]; onApply: (g: FilterGroup[]) => void; onClose: () => void }) {
  const [gs, setGs] = useState<FilterGroup[]>(groups.length ? JSON.parse(JSON.stringify(groups)) : [{ filters: [] }]);
  const setF = (gi: number, fi: number, f: Filter) => setGs(s => s.map((g, i) => (i === gi ? { filters: g.filters.map((x, j) => (j === fi ? f : x)) } : g)));
  const add = (gi: number, name: string) => setGs(s => s.map((g, i) => (i === gi ? { filters: [...g.filters, { propertyName: name, operator: opsFor(obj, name)[0].op }] } : g)));
  return <Drawer title="Todos los filtros" onClose={onClose} width="w-[520px]" footer={<><Button onClick={() => setGs([{ filters: [] }])}>Borrar todo</Button><Button variant="primary" onClick={() => { onApply(gs.filter(g => g.filters.length)); onClose(); }}>Aplicar filtros</Button></>}>
    <h3 className="mb-1 font-display text-[15px] font-bold text-navy">Asociación</h3>
    <p className="mb-2 text-[13px] text-slate">Filtrar por objeto asociado</p><Button size="sm" icon="plus" disabled title="Disponible con el backend">Agregar filtro</Button>
    <div className="my-5 flex items-center gap-3 text-xs font-semibold text-mute"><span className="h-px flex-1 bg-line" />Y<span className="h-px flex-1 bg-line" /></div>
    <h3 className="mb-1 font-display text-[15px] font-bold text-navy">Filtros avanzados</h3>
    <p className="mb-2 text-[12.5px] text-slate">Dentro de un grupo deben cumplirse <b>todas</b> las condiciones (Y). Entre grupos basta con <b>un</b> grupo (O).</p>
    {gs.map((g, gi) => <div key={gi}>
      {gi > 0 && <div className="my-2 text-center text-xs font-bold uppercase text-mute">o</div>}
      <div className="rounded-xl border border-line bg-canvas/50 p-3">
        <div className="mb-2 flex items-center justify-between"><span className="font-display text-[13.5px] font-bold text-navy">Grupo {gi + 1}</span>{gs.length > 1 && <button className="cursor-pointer text-slate hover:text-bad" aria-label="Eliminar grupo" onClick={() => setGs(s => s.filter((_, i) => i !== gi))}><Icon n="trash" s={15} /></button>}</div>
        {g.filters.map((f, fi) => <div key={fi} className="mb-2 rounded-lg bg-white p-2.5 ring-1 ring-line">
          <div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-[13px] font-semibold text-ink">{propLabel(obj, f.propertyName)}</span><button className="cursor-pointer text-slate hover:text-bad" aria-label="Quitar filtro" onClick={() => setGs(s => s.map((x, i) => (i === gi ? { filters: x.filters.filter((_, j) => j !== fi) } : x)))}><Icon n="x" s={14} /></button></div>
          <Select value={f.operator} aria-label="Operador" className="mb-1.5" onChange={e => setF(gi, fi, { propertyName: f.propertyName, operator: e.target.value as Op })}>{opsFor(obj, f.propertyName).map(o => <option key={o.op} value={o.op}>{o.label}</option>)}</Select>
          <ValueEditor obj={obj} f={f} onChange={nf => setF(gi, fi, nf)} />
          {fi < g.filters.length - 1 && <div className="mt-2 text-center text-[11px] font-bold uppercase text-mute">y</div>}
        </div>)}
        <PropertyPicker obj={obj} placeholder="+ Agregar filtro" onChange={n => add(gi, n)} />
      </div></div>)}
    <button className="mt-3 cursor-pointer rounded-lg border border-dashed border-line-2 px-3 py-1.5 text-[13px] font-semibold text-link hover:bg-sky" onClick={() => setGs(s => [...s, { filters: [] }])}>+ Agregar grupo de filtros (o)</button>
  </Drawer>;
}
