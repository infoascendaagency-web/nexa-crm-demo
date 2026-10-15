import { useMemo, useState } from 'react';
import GROUPS_JSON from '../data/property-groups.json';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { crm, store, useAssoc, useDbValue, useRecord } from '../lib/api';
import { CONNECTED } from '../lib/db';
import { savePref, serverPrefs } from '../lib/backend';
import { fmtDateTime, fmtMoney } from '../lib/fmt';
import { OBJECTS, OWNERS, allProps, propDef, propLabel, stageLabel } from '../lib/schema';
import type { ObjKey, Rec } from '../lib/types';
import RecordTasksCard from '../pages/tasks/RecordTasksCard';
import ActivityModal, { type Activity } from './ActivityModals';
import { Cell, displayValue } from './cells';
import CreateRecord from './CreateRecord';
import { PropertyPicker } from './FilterPanel';
import Icon from './Icon';
import PropertyInput, { optionsFor } from './PropertyInput';
import RecordPicker from './RecordPicker';
import AllPropertiesModal from '../pages/properties/AllProperties';
import { isStageProp, useStageGate } from './StageGate';
import Timeline, { type ActTab } from './Timeline';
import { Avatar, Badge, Button, Checkbox, IconButton, Input, MenuItem, Modal, Popover, Select, cx, useToast } from './ui';

/* ---------- Tarjetas de propiedades (configurables, por objeto) ---------- */
const CARDS: Record<ObjKey, { id: string; title: string; props: string[] }[]> = {
  contacts: [
    { id: 'about', title: 'Resumen del contacto', props: ['contact_type', 'buying_timeline', 'address', 'mobilephone', 'phone', 'email', 'hs_lead_status', 'hubspot_owner_id', 'lead_source', 'lead_language', 'lead_temperature', 'prioridad_de_seguimiento', 'product', 'product_description', 'roof_area', 'roof_report_sent', 'report_reintentar', 'nx__dispo_note', 'contact_score', 'notes_last_updated', 'createdate'] },
    { id: 'attr', title: 'Atribución y campañas', props: ['meta_campaign_source', 'utm_campaign', 'utm_content', 'slug', 'landing_page_url', 'hs_object_source_label', 'lead_intake_status'] },
    { id: 'kitchen', title: 'Kitchen y reportes', props: ['kitchen_report_sent', 'kitchen_render_sent'] },
  ],
  appointments: [{ id: 'about', title: 'Resumen de la cita', props: ['hs_appointment_name', 'hs_appointment_start', 'hubspot_owner_id', 'nx___appointment_confirmed_', 'hs_pipeline_stage', 'nx___dispo_note__vendor_', 'empresa_asignada', 'assigned_company_match_key', 'nx___disposition__vendor_'] }],
  deals: [{ id: 'about', title: 'Resumen del negocio', props: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'hubspot_owner_id', 'payment_status', 'nx__quote_amount_', 'createdate'] }],
  companies: [{ id: 'about', title: 'Resumen de la empresa', props: ['name', 'domain', 'phone', 'city', 'state', 'country', 'industry', 'hubspot_owner_id', 'b2b_eligibility_status', 'b2b_research_status'] }],
  tasks: [{ id: 'about', title: 'Resumen de la tarea', props: ['hs_task_subject', 'hs_task_type', 'hs_timestamp', 'hs_task_priority', 'hs_task_status', 'hubspot_owner_id', 'hs_task_body'] }],
  calls: [{ id: 'about', title: 'Resumen de la llamada', props: ['hs_call_title', 'hs_timestamp', 'hs_call_direction', 'hs_call_status', 'hs_call_disposition', 'hs_call_duration', 'hubspot_owner_id', 'hs_call_body', 'hs_call_recording_url', 'dialpad_call_ai_summary', 'dialpad_call_ai_outcome'] }],
  notes: [{ id: 'about', title: 'Nota', props: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'] }], meetings: [{ id: 'about', title: 'Reunión', props: ['hs_meeting_title', 'hs_timestamp', 'hubspot_owner_id'] }],
  tickets: [{ id: 'about', title: 'Resumen del ticket', props: ['subject', 'content', 'hs_pipeline', 'hs_pipeline_stage', 'hs_ticket_priority', 'hubspot_owner_id', 'createdate'] }],
  leads: [{ id: 'about', title: 'Resumen del lead', props: ['hs_lead_name', 'hs_lead_label', 'hs_pipeline', 'hs_pipeline_stage', 'hubspot_owner_id', 'hs_createdate'] }],
  communications: [{ id: 'about', title: 'Comunicación', props: ['hs_communication_channel_type', 'hs_communication_body', 'hs_timestamp', 'hubspot_owner_id'] }],
  products: [{ id: 'about', title: 'Resumen del producto', props: ['name', 'price', 'hs_sku', 'description', 'hs_cost_of_goods_sold', 'hs_recurring_billing_period'] }],
  line_items: [{ id: 'about', title: 'Resumen de la partida', props: ['name', 'quantity', 'price', 'amount', 'hs_sku', 'description'] }],
  quotes: [{ id: 'about', title: 'Resumen de la cotización', props: ['hs_title', 'hs_status', 'hs_expiration_date', 'hs_quote_amount', 'hubspot_owner_id', 'hs_createdate'] }],
  invoices: [{ id: 'about', title: 'Resumen de la factura', props: ['hs_number', 'hs_invoice_status', 'hs_amount_billed', 'hs_balance_due', 'hs_due_date', 'hs_currency'] }],
};
const ASSOC: Record<ObjKey, ObjKey[]> = { contacts: ['appointments', 'deals', 'companies'], appointments: ['contacts', 'companies', 'deals'], deals: ['contacts', 'companies', 'appointments'], companies: ['contacts', 'deals', 'appointments'], tasks: ['contacts', 'appointments', 'companies'], calls: ['contacts', 'companies'], notes: ['contacts'], meetings: ['contacts'], tickets: ['contacts', 'companies', 'deals'], leads: ['contacts', 'companies'], communications: ['contacts', 'companies'], products: ['deals'], line_items: ['deals', 'quotes'], quotes: ['contacts', 'companies', 'deals'], invoices: ['contacts', 'companies', 'deals']};
const RO = new Set(['createdate', 'lastmodifieddate', 'notes_last_updated', 'hs_object_id', 'hs_createdate', 'hs_lastmodifieddate', 'notes_last_contacted', 'hs_created_by_user_id', 'hs_updated_by_user_id']);
const storeKey = (o: ObjKey, c: string) => `nx-card-${o}-${c}`;
const prefKey = (o: ObjKey, c: string) => `card:${o}:${c}`;
const loadCard = (o: ObjKey, c: string, def: string[]) => { const sv = serverPrefs[prefKey(o, c)]; if (Array.isArray(sv) && sv.length) return sv as string[]; try { const v = JSON.parse(localStorage.getItem(storeKey(o, c)) ?? 'null') as string[] | null; return v?.length ? v : def; } catch { return def; } };

function PropertyRow({ obj, rec, name }: { obj: ObjKey; rec: Rec; name: string }) {
  const [editing, setEditing] = useState(false); const [val, setVal] = useState<string | null>(null); const toast = useToast(); const gate = useStageGate();
  const d = propDef(obj, name); const ro = RO.has(name) || d?.calculated || d?.readOnlyValue; const selectLike = !!optionsFor(obj, name, rec.properties) || d?.type === 'bool';
  const commit = (v: string | null) => { setEditing(false); if ((v ?? '') !== (rec.properties[name] ?? '')) { if (v && isStageProp(obj, name) && gate.move(obj, rec, v)) return; crm.update(obj, rec.id, { [name]: v }); toast(`${propLabel(obj, name)} actualizado`); } };
  const raw = rec.properties[name] ?? (name === 'createdate' ? rec.createdAt : null);
  return <div className="group">{gate.node}
    <div className="text-[12px] font-bold text-slate">{propLabel(obj, name)}</div>
    {editing && !ro ? <div className="mt-0.5" onKeyDown={e => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && !selectLike && (e.target as HTMLElement).tagName !== 'TEXTAREA') commit(val); }}>
      <PropertyInput obj={obj} name={name} value={val} ctx={rec.properties} autoFocus onChange={v => { setVal(v); if (selectLike) commit(v); }} onBlur={() => { if (!selectLike) commit(val); else setEditing(false); }} /></div>
      : <button type="button" disabled={!!ro} onClick={() => { setVal(rec.properties[name] ?? null); setEditing(true); }} aria-label={`Editar ${propLabel(obj, name)}`} className={cx('-mx-1.5 mt-0.5 flex w-[calc(100%+12px)] items-start gap-1 rounded-md px-1.5 py-0.5 text-left text-[14px] text-ink', !ro && 'cursor-pointer hover:bg-sky')}>
        {raw ? <span className="min-w-0 break-words"><Cell obj={obj} r={rec} col={name} /></span> : <span className="text-mute">--</span>}{!ro && <Icon n="edit" s={13} className="ml-auto mt-1 shrink-0 text-mute opacity-0 group-hover:opacity-100" />}</button>}
  </div>;
}

function PropertyCard({ obj, rec, card }: { obj: ObjKey; rec: Rec; card: { id: string; title: string; props: string[] } }) {
  const [names, setNames] = useState(() => loadCard(obj, card.id, card.props)); const [custom, setCustom] = useState(false); const [open, setOpen] = useState(true);
  const save = (n: string[]) => { setNames(n); try { localStorage.setItem(storeKey(obj, card.id), JSON.stringify(n)); } catch { /* */ } if (CONNECTED) savePref(prefKey(obj, card.id), n); };
  const move = (i: number, d: number) => { const a = [...names]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(a); };
  return <section className="rounded-xl border border-line bg-white">
    <header className="flex items-center justify-between px-3 py-2.5"><button onClick={() => setOpen(!open)} aria-expanded={open} className="flex cursor-pointer items-center gap-1.5 font-display text-[15px] font-bold text-navy"><Icon n={open ? 'chevD' : 'chevR'} s={15} />{card.title}</button>
      <IconButton n="gear" label="Personalizar propiedades" onClick={() => setCustom(true)} className="!h-7 !w-7" /></header>
    {open && <div className="space-y-3.5 px-3 pb-4 pt-1">{names.map(n => <PropertyRow key={n} obj={obj} rec={rec} name={n} />)}</div>}
    {custom && <Modal title={`Personalizar: ${card.title}`} onClose={() => setCustom(false)} width="max-w-xl" footer={<><Button onClick={() => { save(card.props); setCustom(false); }}>Restablecer</Button><Button variant="primary" onClick={() => setCustom(false)}>Listo</Button></>}>
      <PropertyPicker obj={obj} placeholder="+ Agregar propiedad" exclude={names} onChange={n => save([...names, n])} />
      <div className="mt-3 divide-y divide-line rounded-lg border border-line">{names.map((n, i) => <div key={n} className="flex items-center gap-1 px-2 py-1 text-[13.5px]"><span className="min-w-0 flex-1 truncate">{propLabel(obj, n)}</span><IconButton n="up" label="Subir" className="!h-6 !w-6" onClick={() => move(i, -1)} /><IconButton n="down" label="Bajar" className="!h-6 !w-6" onClick={() => move(i, 1)} /><IconButton n="x" label="Quitar" className="!h-6 !w-6" onClick={() => save(names.filter(x => x !== n))} /></div>)}</div></Modal>}
  </section>;
}

/* ---------- Asociaciones (columna derecha) ---------- */
const TITLES: Record<ObjKey, string> = { contacts: 'Contactos', companies: 'Empresas', deals: 'Negocios', appointments: 'Citas', tasks: 'Tareas', calls: 'Llamadas', notes: 'Notas', meetings: 'Reuniones', tickets: 'Tickets', leads: 'Leads', communications: 'Comunicaciones', products: 'Productos', line_items: 'Partidas', quotes: 'Cotizaciones', invoices: 'Facturas' };
function AssocCard({ obj, id, to }: { obj: ObjKey; id: string; to: ObjKey }) {
  const items = useAssoc(obj, id, to); const [open, setOpen] = useState(true); const [pick, setPick] = useState<string | null>(null); const [create, setCreate] = useState(false); const toast = useToast(); const cfg = OBJECTS[to];
  const sub = (r: Rec) => to === 'contacts' ? [r.properties.mobilephone, r.properties.address].filter(Boolean).join(' · ') : to === 'appointments' ? `${displayValue('appointments', r, 'hs_appointment_start')} · ${stageLabel('appointments', r.properties.hs_pipeline, r.properties.hs_pipeline_stage)}` : to === 'deals' ? `${fmtMoney(r.properties.amount)} · ${stageLabel('deals', r.properties.pipeline, r.properties.dealstage)}` : [r.properties.phone, r.properties.city].filter(Boolean).join(' · ');
  return <section className="rounded-xl border border-line bg-white">
    <header className="flex items-center justify-between px-3 py-2.5"><button onClick={() => setOpen(!open)} aria-expanded={open} className="flex cursor-pointer items-center gap-1.5 font-display text-[15px] font-bold text-navy"><Icon n={open ? 'chevD' : 'chevR'} s={15} />{TITLES[to]} ({items.length})</button>
      <Popover align="right" width="w-72" trigger={({ toggle }) => <Button size="sm" variant="ghost" icon="plus" onClick={toggle}>Agregar</Button>}>
        {close => <div className="p-1"><div className="mb-1 px-1 text-[12px] font-bold text-slate">Asociar {cfg.singular} existente</div><RecordPicker obj={to} value={pick} exclude={items.map(i => i.id)} onChange={v => { if (v) { crm.associate(obj, id, to, v); toast(`${TITLES[to]} asociado(s)`); setPick(null); close(); } }} /><div className="mt-2 border-t border-line pt-1"><MenuItem icon="plus" onClick={() => { close(); setCreate(true); }}>Crear {cfg.singular} nuevo</MenuItem></div></div>}
      </Popover></header>
    {open && <div className="space-y-2 px-3 pb-3">{items.length === 0 && <p className="py-3 text-center text-[13px] text-slate">No hay {TITLES[to].toLowerCase()} asociados.</p>}
      {items.slice(0, 6).map(r => <div key={r.id} className="group relative rounded-lg border border-line p-2.5 hover:border-teal"><Link to={`${cfg.path}/${r.id}`} className="flex items-center gap-2 text-[14px] font-semibold text-link hover:underline">{to === 'contacts' && <Avatar name={crm.nameOf(r, to)} size={22} />}<span className="truncate">{crm.nameOf(r, to)}</span></Link><div className="mt-0.5 truncate text-[12.5px] text-slate">{sub(r)}</div>
        <button aria-label="Quitar asociación" onClick={() => { crm.unassociate(obj, id, to, r.id); toast('Asociación eliminada'); }} className="absolute right-1.5 top-1.5 hidden cursor-pointer rounded p-1 text-mute hover:bg-red-50 hover:text-bad group-hover:block"><Icon n="x" s={13} /></button></div>)}
      {items.length > 6 && <Link to={`${cfg.path}`} className="block text-center text-[13px] font-semibold text-link hover:underline">Ver todos los elementos asociados ({items.length})</Link>}</div>}
    {create && <CreateRecord obj={to} onClose={() => setCreate(false)} assocTo={{ obj, id }} onCreated={() => { setCreate(false); toast(`${cfg.singular} creado y asociado`); }} />}
  </section>;
}

/* ---------- Información avanzada ---------- */
const GROUP_INFO: Record<string, Record<string, { label: string; order: number }>> = Object.fromEntries(Object.entries(GROUPS_JSON as Record<string, { name: string; label: string; displayOrder: number }[]>).map(([o, l]) => [o, Object.fromEntries(l.map(g => [g.name, { label: g.label, order: g.displayOrder }]))]));
function AdvancedInfo({ obj, rec }: { obj: ObjKey; rec: Rec }) {
  const [q, setQ] = useState(''); const [onlyVal, setOnlyVal] = useState(true);
  const groups = useMemo(() => { const m = new Map<string, string[]>(); allProps(obj).filter(p => !p.hidden).forEach(p => { const g = p.groupName ?? 'otros'; m.set(g, [...(m.get(g) ?? []), p.name]); }); return [...m.entries()].map(([g, ps]) => ({ g, ps })).sort((a, b) => (GROUP_INFO[obj]?.[a.g]?.order ?? 9999) - (GROUP_INFO[obj]?.[b.g]?.order ?? 9999) || a.g.localeCompare(b.g)); }, [obj]);
  const label = (g: string) => GROUP_INFO[obj]?.[g]?.label ?? g.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  return <div><div className="mb-3 flex flex-wrap items-center gap-3"><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar propiedades" aria-label="Buscar propiedades" className="max-w-xs" /><Checkbox label="Mostrar solo propiedades con valor" checked={onlyVal} onChange={setOnlyVal} /></div>
    <div className="space-y-2">{groups.map(({ g, ps }) => { const list = ps.filter(n => (!onlyVal || rec.properties[n]) && (!q || propLabel(obj, n).toLowerCase().includes(q.toLowerCase()) || n.includes(q.toLowerCase()))); if (!list.length) return null;
      return <details key={g} open={!!q || list.length < 14} className="rounded-xl border border-line bg-white"><summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 font-display text-[14.5px] font-bold text-navy">{label(g)}<span className="rounded-full bg-sky px-2 text-[12px] font-semibold">{list.length}</span></summary><div className="grid gap-x-8 gap-y-3 px-4 pb-4 pt-1 md:grid-cols-2">{list.slice(0, 60).map(n => <PropertyRow key={n} obj={obj} rec={rec} name={n} />)}</div></details>; })}</div></div>;
}

/* ---------- Página de registro ---------- */
export default function RecordPage({ obj }: { obj: ObjKey }) {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast(); const cfg = OBJECTS[obj]; const rec = useRecord(obj, id);
  const [tab, setTab] = useState<'act' | 'desc' | 'adv'>('act'); const [act, setAct] = useState<ActTab>('all'); const [q, setQ] = useState(''); const [owner, setOwner] = useState(''); const [expand, setExpand] = useState<boolean | null>(null); const [modal, setModal] = useState<Activity | null>(null); const [right, setRight] = useState(true); const [allOpen, setAllOpen] = useState(false);
  const notes = useAssoc(obj, id ?? '', 'notes'); const calls = useAssoc(obj, id ?? '', 'calls'); const tasks = useAssoc(obj, id ?? '', 'tasks'); const nextTask = tasks.filter(t => t.properties.hs_task_status !== 'COMPLETED').sort((a, b) => (a.properties.hs_timestamp ?? '').localeCompare(b.properties.hs_timestamp ?? ''))[0];
  if (!rec) return <div className="grid h-full place-items-center p-10 text-center"><div><Icon n="search" s={34} className="mx-auto mb-2 text-mute" /><h1 className="font-display text-xl font-bold text-navy">No encontramos este {cfg.singular}</h1><Link to={cfg.path} className="mt-2 inline-block font-semibold text-link hover:underline">Volver a {cfg.plural.toLowerCase()}</Link></div></div>;
  const title = crm.nameOf(rec, obj); const p = rec.properties; const phone = p.mobilephone ?? p.phone ?? null;
  const actions: { k: Activity; label: string; icon: string }[] = [{ k: 'note', label: 'Nota', icon: 'note' }, { k: 'email', label: 'Correo', icon: 'mail' }, { k: 'call', label: 'Llamar', icon: 'phone' }, { k: 'task', label: 'Tarea', icon: 'tasks' }, { k: 'meeting', label: 'Reunión', icon: 'calendar' }];
  const showAct = obj === 'contacts' || obj === 'appointments' || obj === 'deals' || obj === 'companies';
  return <div className="flex min-h-full gap-4 p-4">
    {/* Izquierda */}
    <aside className="w-[330px] shrink-0 space-y-3">
      <section className="rounded-xl border border-line bg-white p-3.5">
        <div className="mb-2 flex items-center justify-between"><Link to={cfg.path} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-link hover:underline"><Icon n="chevL" s={14} />{cfg.plural}</Link>
          <Popover align="right" width="w-56" trigger={({ toggle }) => <Button size="sm" onClick={toggle}>Acciones<Icon n="chevD" s={13} /></Button>}>{close => <><MenuItem icon="list" onClick={() => { close(); setAllOpen(true); }}>Ver todas las propiedades</MenuItem><MenuItem icon="link" onClick={() => { close(); navigator.clipboard?.writeText(location.href); toast('Enlace copiado'); }}>Copiar enlace</MenuItem><MenuItem icon="download" onClick={() => { close(); const b = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${obj}-${rec.id}.json`; a.click(); }}>Exportar registro (JSON)</MenuItem><MenuItem icon="trash" danger onClick={() => { close(); if (confirm(`¿Eliminar ${cfg.singular} "${title}"?`)) { crm.remove(obj, [rec.id]); toast('Registro eliminado'); nav(cfg.path); } }}>Eliminar</MenuItem></>}</Popover></div>
        <div className="flex items-center gap-2.5"><Avatar name={title} size={40} /><div className="min-w-0"><h1 className="break-words font-display text-[20px] font-bold leading-tight text-navy">{title}</h1>{obj === 'contacts' && p.email && <div className="flex items-center gap-1 text-[13px] text-link"><span className="truncate">{p.email}</span><button aria-label="Copiar correo" className="cursor-pointer text-slate" onClick={() => { navigator.clipboard?.writeText(p.email!); toast('Correo copiado'); }}><Icon n="copy" s={13} /></button></div>}{obj === 'appointments' && <div className="text-[13px] text-slate">{displayValue('appointments', rec, 'hs_appointment_start')}</div>}</div></div>
        {showAct && <div className="mt-3.5 flex justify-between">{actions.map(a => <button key={a.k} onClick={() => setModal(a.k)} className="group flex w-14 cursor-pointer flex-col items-center gap-1"><span className="grid h-9 w-9 place-items-center rounded-full border border-line-2 text-navy group-hover:bg-sky"><Icon n={a.icon} s={16} /></span><span className="text-[11.5px] font-medium text-slate">{a.label}</span></button>)}</div>}
      </section>
      {showAct && <RecordTasksCard obj={obj} id={rec.id} onCreate={() => setModal('task')} onSeeAll={() => { setTab('act'); setAct('tasks'); }} />}
      {CARDS[obj].map(c => <PropertyCard key={c.id} obj={obj} rec={rec} card={c} />)}
    </aside>

    {/* Centro */}
    <section className="min-w-0 flex-1">
      <div className="flex items-end justify-between border-b border-line"><div role="tablist" className="flex">{([['act', 'Actividades'], ['desc', 'Descripción'], ['adv', 'Información avanzada']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-[14px] font-semibold', tab === k ? 'border-brand text-navy' : 'border-transparent text-slate hover:text-navy')}>{l}</button>)}</div>
        <button onClick={() => setRight(r => !r)} className="mb-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-slate hover:bg-sky"><Icon n="board" s={14} />{right ? 'Ocultar' : 'Mostrar'} asociaciones</button></div>
      <div className="pt-4">
        {tab === 'act' && <>
          <div className="mb-3 flex flex-wrap items-center gap-1" role="tablist">{([['all', 'Todas las actividades'], ['notes', 'Notas'], ['emails', 'Correos'], ['calls', 'Llamadas'], ['tasks', 'Tareas'], ['meetings', 'Reuniones']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={act === k} onClick={() => setAct(k)} className={cx('cursor-pointer rounded-full px-3 py-1 text-[13.5px] font-semibold', act === k ? 'bg-navy text-white' : 'text-slate hover:bg-sky')}>{l}</button>)}</div>
          <div className="mb-4 flex flex-wrap items-center gap-2"><div className="relative"><Icon n="search" s={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar actividades" aria-label="Buscar actividades" className="h-8 w-52 rounded-full border border-line-2 bg-white pl-8 pr-3 text-[13.5px] focus:border-teal focus:outline-none" /></div>
            <Select aria-label="Actividad asignada a" value={owner} onChange={e => setOwner(e.target.value)} className="!h-8 !w-auto text-[13px]"><option value="">Actividad asignada a: todos</option>{OWNERS.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName}</option>)}</Select>
            <button className="ml-auto cursor-pointer text-[13px] font-semibold text-link hover:underline" onClick={() => setExpand(expand === true ? false : true)}>{expand === true ? 'Contraer todo' : 'Expandir todo'}</button></div>
          <Timeline obj={obj} id={rec.id} tab={act} query={q} owner={owner} expandAll={expand} /></>}
        {tab === 'desc' && <div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-line bg-white p-4"><h3 className="mb-3 font-display text-[15px] font-bold text-navy">Resumen</h3><dl className="space-y-2 text-[13.5px]"><div className="flex justify-between"><dt className="text-slate">Notas</dt><dd className="font-semibold">{notes.length}</dd></div><div className="flex justify-between"><dt className="text-slate">Llamadas</dt><dd className="font-semibold">{calls.length}</dd></div><div className="flex justify-between"><dt className="text-slate">Tareas abiertas</dt><dd className="font-semibold">{tasks.filter(t => t.properties.hs_task_status !== 'COMPLETED').length}</dd></div><div className="flex justify-between"><dt className="text-slate">Creado</dt><dd className="font-semibold">{fmtDateTime(rec.createdAt)}</dd></div><div className="flex justify-between"><dt className="text-slate">Última modificación</dt><dd className="font-semibold">{fmtDateTime(rec.updatedAt)}</dd></div></dl></div>
          <div className="rounded-xl border border-line bg-white p-4"><h3 className="mb-3 font-display text-[15px] font-bold text-navy">Siguiente actividad</h3>{nextTask ? <div className="text-[13.5px]"><div className="font-semibold">{nextTask.properties.hs_task_subject}</div><div className="text-slate">{fmtDateTime(nextTask.properties.hs_timestamp)}</div></div> : <p className="text-[13.5px] text-slate">No hay tareas abiertas. <button className="cursor-pointer font-semibold text-link hover:underline" onClick={() => setModal('task')}>Crear tarea</button></p>}</div></div>}
        {tab === 'adv' && <AdvancedInfo obj={obj} rec={rec} />}
      </div>
    </section>

    {/* Derecha */}
    {right && <aside className="w-[320px] shrink-0 space-y-3">{ASSOC[obj].map(t => <AssocCard key={t} obj={obj} id={rec.id} to={t} />)}</aside>}
    {allOpen && <AllPropertiesModal obj={obj} rec={rec} onClose={() => setAllOpen(false)} />}
    {modal && <ActivityModal kind={modal} parent={{ obj, id: rec.id, name: title, phone, email: p.email }} onClose={() => setModal(null)} />}
  </div>;
}
void Badge; void store; void useDbValue;
