import { Link } from 'react-router-dom';
import { crm } from '../lib/api';
import { fmtDate, fmtDateTime, fmtDuration, fmtMoney } from '../lib/fmt';
import { OBJECTS, ownerName, propDef, stageLabel } from '../lib/schema';
import type { ObjKey, Rec } from '../lib/types';
import { OptionPill } from './OptionPill';
import { optionsFor } from './PropertyInput';
import { Avatar, Badge, cx } from './ui';

const TASK_TYPE: Record<string, string> = { TODO: 'Por hacer', CALL: 'Llamada', EMAIL: 'Correo' };
const DIR: Record<string, string> = { OUTBOUND: 'Salientes', INBOUND: 'Entrantes' };
const STATUS_ES: Record<string, string> = { New: 'Nuevo' };

export const optLabel = (obj: ObjKey, name: string, value: string | null, ctx?: Record<string, string | null>) => {
  if (value == null || value === '') return '';
  const opts = optionsFor(obj, name, ctx); return opts?.find(o => o.value === value)?.label ?? value;
};
export const displayValue = (obj: ObjKey, r: Rec, name: string): string => {
  const v = r.properties[name] ?? (name === 'createdate' ? r.createdAt : name === 'lastmodifieddate' ? r.updatedAt : null);
  if (v == null || v === '') return '';
  if (name === 'hubspot_owner_id') return ownerName(v) ?? v;
  if (name === 'hs_task_type') return TASK_TYPE[v] ?? v;
  if (name === 'hs_call_direction') return DIR[v] ?? v;
  if (name === 'hs_call_duration') return fmtDuration(v);
  if (name === 'amount') return fmtMoney(v);
  if (obj === 'deals' && name === 'dealstage') return stageLabel('deals', r.properties.pipeline, v);
  if ((obj === 'appointments' || obj === 'tickets' || obj === 'leads') && name === 'hs_pipeline_stage') return stageLabel(obj, r.properties.hs_pipeline, v);
  const d = propDef(obj, name);
  if (d?.type === 'datetime') return fmtDateTime(v); if (d?.type === 'date') return fmtDate(v);
  if (['createdate', 'lastmodifieddate', 'hs_createdate', 'hs_lastmodifieddate', 'hs_timestamp', 'hs_appointment_start', 'hs_appointment_end'].includes(name)) return fmtDateTime(v);
  if (d?.type === 'bool') return v === 'true' ? 'Sí' : 'No';
  if (d?.type === 'enumeration' || name === 'hs_pipeline' || name === 'pipeline') return optLabel(obj, name, v, r.properties);
  return v;
};

export function Cell({ obj, r, col }: { obj: ObjKey; r: Rec; col: string }) {
  const cfg = OBJECTS[obj]; const p = r.properties;
  if (col === '@name' || col === cfg.titleProp) {
    const t = crm.nameOf(r, obj);
    return <Link to={`${cfg.path}/${r.id}`} className="inline-flex max-w-full items-center gap-2 font-semibold text-link hover:underline">{obj === 'contacts' && <Avatar name={t} size={22} />}<span className="truncate">{t}</span></Link>;
  }
  if (col === '@contact') { const c = crm.firstAssoc(obj, r.id, 'contacts'); return c ? <Link to={`/contacts/${c.id}`} className="inline-flex items-center gap-1.5 font-semibold text-link hover:underline"><Avatar name={crm.nameOf(c, 'contacts')} size={20} /><span className="truncate">{crm.nameOf(c, 'contacts')}</span></Link> : <span className="text-mute">--</span>; }
  if (col === '@contactLastContacted') { const c = crm.firstAssoc(obj, r.id, 'contacts'); return <span className="text-slate">{c ? fmtDateTime(c.properties.notes_last_contacted) : '--'}</span>; }
  if (col === '@company') { const c = crm.firstAssoc(obj, r.id, 'companies'); return c ? <Link to={`/companies/${c.id}`} className="font-semibold text-link hover:underline">{c.properties.name}</Link> : <span className="text-mute">--</span>; }
  const raw = p[col] ?? (col === 'createdate' || col === 'hs_createdate' ? r.createdAt : col === 'lastmodifieddate' || col === 'hs_lastmodifieddate' ? r.updatedAt : null);
  if (raw == null || raw === '') return <span className="text-mute">--</span>;
  if (col === 'hubspot_owner_id') { const n = ownerName(raw) ?? raw; return <span className="inline-flex items-center gap-1.5"><Avatar name={n} size={20} /><span className="truncate">{n}</span></span>; }
  // Enumeraciones con color por opción (Configuración → Propiedades): píldora del color de cada etiqueta (blanca si no tiene)
  const pd = propDef(obj, col);
  if (pd?.type === 'enumeration' && col !== 'hubspot_owner_id' && col !== 'hs_pipeline' && col !== 'pipeline') {
    const os = optionsFor(obj, col, p) ?? []; const vals = raw.includes(';') ? raw.split(';').filter(Boolean) : [raw];
    if (os.some(o => o.color) || col === 'hs_lead_status' || col === 'lead_source' || col === 'nx___appointment_confirmed_') return <span className="flex flex-wrap gap-1">{vals.map(v => { const o = os.find(x => x.value === v); return <OptionPill key={v} label={col === 'hs_lead_status' ? STATUS_ES[v] ?? o?.label ?? v : o?.label ?? v} color={o?.color} />; })}</span>;
  }
  if (col === 'hs_lead_status') return <Badge tone={raw}>{STATUS_ES[raw] ?? raw}</Badge>;
  if (col === 'lead_source') return <Badge tone={raw}>{raw}</Badge>;
  if (col === 'nx___appointment_confirmed_') return <Badge tone={raw}>{raw}</Badge>;
  if (col === 'hs_pipeline_stage' || col === 'dealstage') return <span className="inline-flex max-w-full truncate rounded-md bg-[#EEE5FB] px-2 py-[1px] text-[12px] font-semibold leading-5 text-[#5B36A8]">{displayValue(obj, r, col)}</span>;
  if (col === 'hs_task_type' && raw === 'CALL') return <span className="inline-flex items-center gap-1 text-ink">Llamada</span>;
  return <span className={cx('block truncate', ['hs_timestamp'].includes(col) && obj === 'tasks' && new Date(raw) < new Date() && p.hs_task_status !== 'COMPLETED' && 'font-semibold text-bad')} title={displayValue(obj, r, col)}>{displayValue(obj, r, col)}</span>;
}
