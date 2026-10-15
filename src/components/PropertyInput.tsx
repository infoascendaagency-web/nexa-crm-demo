import { toLocalInput } from '../lib/fmt';
import { OWNERS, PIPELINES, propDef, type PipeObj, type PropOption } from '../lib/schema';
import type { ObjKey } from '../lib/types';
import { OptionPill, OptionSelect } from './OptionPill';
import { Checkbox, Input, Select, Textarea } from './ui';

export const OWNER_PROPS = new Set(['hubspot_owner_id']);
const PIPE: Partial<Record<ObjKey, { pipeline: string; stage: string; list: PipeObj }>> = { deals: { pipeline: 'pipeline', stage: 'dealstage', list: 'deals' }, appointments: { pipeline: 'hs_pipeline', stage: 'hs_pipeline_stage', list: 'appointments' }, tickets: { pipeline: 'hs_pipeline', stage: 'hs_pipeline_stage', list: 'tickets' }, leads: { pipeline: 'hs_pipeline', stage: 'hs_pipeline_stage', list: 'leads' } };

export function optionsFor(obj: ObjKey, name: string, ctx?: Record<string, string | null>): PropOption[] | null {
  if (OWNER_PROPS.has(name)) return OWNERS.map(o => ({ label: `${o.firstName} ${o.lastName}`.trim(), value: o.id }));
  const pp = PIPE[obj];
  if (pp && name === pp.pipeline) return PIPELINES[pp.list].map(p => ({ label: p.label, value: p.id }));
  if (pp && name === pp.stage) { const pid = ctx?.[pp.pipeline] ?? PIPELINES[pp.list][0].id; return (PIPELINES[pp.list].find(p => p.id === pid) ?? PIPELINES[pp.list][0]).stages.map(s => ({ label: s.label, value: s.id })); }
  const d = propDef(obj, name); if (d?.options?.length) return d.options.filter(o => !o.hidden);
  return null;
}
export const isMulti = (obj: ObjKey, name: string) => propDef(obj, name)?.fieldType === 'checkbox';

export default function PropertyInput({ obj, name, value, onChange, ctx, autoFocus, onBlur, id }: { obj: ObjKey; name: string; value: string | null; onChange: (v: string | null) => void; ctx?: Record<string, string | null>; autoFocus?: boolean; onBlur?: () => void; id?: string }) {
  const d = propDef(obj, name); const opts = optionsFor(obj, name, ctx); const v = value ?? '';
  if (opts && isMulti(obj, name)) { const sel = v.split(';').filter(Boolean); return <div className="flex flex-col gap-1">{opts.map(o => <Checkbox key={o.value} label={<OptionPill label={o.label} color={o.color} />} aria={o.label} checked={sel.includes(o.value)} onChange={c => onChange((c ? [...sel, o.value] : sel.filter(x => x !== o.value)).join(';') || null)} />)}</div>; }
  if (opts) return <OptionSelect id={id} value={v || null} options={opts} autoFocus={autoFocus} onBlur={onBlur} onChange={onChange} ariaLabel={d?.label ?? name} />;
  if (d?.type === 'bool' || d?.fieldType === 'booleancheckbox') return <Select id={id} value={v} onBlur={onBlur} onChange={e => onChange(e.target.value || null)}><option value="">— Sin valor —</option><option value="true">Sí</option><option value="false">No</option></Select>;
  if (d?.type === 'datetime') return <Input id={id} type="datetime-local" autoFocus={autoFocus} onBlur={onBlur} value={toLocalInput(v)} onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />;
  if (d?.type === 'date') return <Input id={id} type="date" autoFocus={autoFocus} onBlur={onBlur} value={v.slice(0, 10)} onChange={e => onChange(e.target.value || null)} />;
  if (d?.type === 'number') return <Input id={id} type="number" autoFocus={autoFocus} onBlur={onBlur} value={v} onChange={e => onChange(e.target.value || null)} />;
  if (d?.fieldType === 'textarea' || name.endsWith('_body') || name.endsWith('_note') || name === 'product_description') return <Textarea id={id} rows={3} autoFocus={autoFocus} onBlur={onBlur} value={v} onChange={e => onChange(e.target.value || null)} />;
  return <Input id={id} type={name === 'email' ? 'email' : 'text'} autoFocus={autoFocus} onBlur={onBlur} value={v} onChange={e => onChange(e.target.value || null)} />;
}
