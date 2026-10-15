import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { crm, store, useDbValue } from '../lib/api';
import { BUILTIN_VIEWS, OBJECTS, PINNED_DEFAULT } from '../lib/schema';
import type { FilterGroup, ObjKey, ViewDef } from '../lib/types';
import FilterPanel, { describeFilter } from '../components/FilterPanel';
import { Badge, Button, Card, Empty, Field, IconButton, Input, MenuItem, PageHeader, Pill, Popover, useToast } from '../components/ui';

/* ---- Todas las vistas (administración) ---- */
export function ViewsAdmin() {
  const { obj } = useParams(); const o = (obj as ObjKey) in OBJECTS ? (obj as ObjKey) : 'contacts'; const nav = useNavigate(); const toast = useToast();
  const user = useDbValue(() => store.userViews().filter(v => v.objectType === o), [o]); const pinned = useDbValue(() => store.getPinned(o, PINNED_DEFAULT[o]), [o]);
  const all = [...BUILTIN_VIEWS.filter(v => v.objectType === o), ...user]; const [q, setQ] = useState('');
  const rows = all.filter(v => v.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="p-4 sm:p-6"><Link to={OBJECTS[o].path} className="mb-2 inline-block text-[13px] font-semibold text-link hover:underline">‹ Volver a {OBJECTS[o].plural.toLowerCase()}</Link>
    <PageHeader title="Todas las vistas" sub={`${all.length} vistas de ${OBJECTS[o].plural.toLowerCase()}`} actions={<Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar vistas" aria-label="Buscar vistas" className="!w-60" />} />
    <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Objeto</th><th>Nombre de la vista</th><th>Propietario</th><th>Compartida con</th><th>Filtros</th><th></th></tr></thead>
      <tbody>{rows.map(v => <tr key={v.id} className="border-b border-line/70 hover:bg-sky/40"><td className="px-4 py-2.5">{OBJECTS[o].plural}</td><td><button className="cursor-pointer font-semibold text-link hover:underline" onClick={() => nav(`${OBJECTS[o].path}?view=${v.id}`)}>{v.name}</button>{pinned.includes(v.id) && <Pill color="bg-[#FFF1D6] text-warn">Fijada</Pill>}</td><td>{v.owner}</td><td><Badge tone={v.shared === 'PUBLIC' ? 'Appointment Set' : 'Pending'}>{v.shared === 'PUBLIC' ? 'Público' : 'Privado'}</Badge></td><td className="max-w-[320px] truncate text-[12.5px] text-slate">{v.filterGroups.length ? v.filterGroups.map(g => g.filters.map(f => describeFilter(o, f)).join(' y ')).join(' — o — ') : 'Sin filtros'}</td>
        <td className="pr-3 text-right"><Popover align="right" width="w-52" trigger={({ toggle }) => <IconButton n="dots" label="Más" onClick={toggle} />}>{close => <><MenuItem icon="pin" onClick={() => { close(); store.setPinned(o, pinned.includes(v.id) ? pinned.filter(x => x !== v.id) : [...pinned, v.id]); }}>{pinned.includes(v.id) ? 'Quitar de pestañas' : 'Fijar en pestañas'}</MenuItem><MenuItem icon="copy" onClick={() => { close(); const id = `u-${Date.now()}`; store.saveView({ ...v, id, name: `${v.name} (copia)`, builtin: false, owner: 'Jose', shared: 'PRIVATE' }); toast('Vista clonada'); }}>Clonar</MenuItem>{!v.builtin && <MenuItem icon="eye" onClick={() => { close(); store.saveView({ ...v, shared: v.shared === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' }); }}>{v.shared === 'PUBLIC' ? 'Hacer privada' : 'Compartir con todos'}</MenuItem>}{!v.builtin && <MenuItem icon="trash" danger onClick={() => { close(); if (confirm(`¿Eliminar "${v.name}"?`)) store.deleteView(v.id); }}>Eliminar</MenuItem>}</>}</Popover></td></tr>)}</tbody></table></div></div>;
}

/* ---- Segmentos (listas) ---- */
type Seg = { id: string; name: string; type: 'dynamic' | 'manual'; groups: FilterGroup[] };
const SEEDED: { name: string; type: string; note: string }[] = [{ name: 'Suscriptores a un boletín informativo', type: 'Dinámica', note: 'Sistema' }, { name: 'Suscripción cancelada', type: 'Dinámica', note: 'Sistema' }, { name: 'Todos los clientes', type: 'Dinámica', note: 'Sistema' }, { name: 'Social Media Leads-Setters (1).csv', type: 'Manual', note: 'Importada' }];
export function ListsPage() {
  const [segs, setSegs] = useState<Seg[]>(() => { try { return JSON.parse(localStorage.getItem('nx-segments') ?? '[]') as Seg[]; } catch { return []; } }); const [edit, setEdit] = useState<Seg | null>(null); const [name, setName] = useState('');
  const save = (s: Seg[]) => { setSegs(s); try { localStorage.setItem('nx-segments', JSON.stringify(s)); } catch { /* */ } };
  return <div className="p-4 sm:p-6"><PageHeader title="Segmentos (listas)" sub="Grupos de contactos que se actualizan solos según filtros. El trabajo diario usa las vistas guardadas; estos segmentos sirven para campañas y automatizaciones." actions={<div className="flex gap-2"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del segmento nuevo" aria-label="Nombre del segmento" className="!w-64" /><Button variant="primary" disabled={!name.trim()} onClick={() => { setEdit({ id: `seg-${Date.now()}`, name: name.trim(), type: 'dynamic', groups: [] }); setName(''); }}>Crear segmento</Button></div>} />
    <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Nombre</th><th>Tipo</th><th>Tamaño</th><th>Origen</th><th></th></tr></thead><tbody>
      {segs.map(s => <SegRow key={s.id} s={s} onEdit={() => setEdit(s)} onDelete={() => save(segs.filter(x => x.id !== s.id))} />)}
      {SEEDED.map(s => <tr key={s.name} className="border-b border-line/70"><td className="px-4 py-2.5 font-semibold text-link">{s.name}</td><td>{s.type}</td><td className="text-slate">—</td><td>{s.note}</td><td /></tr>)}</tbody></table></div>
    {edit && <FilterPanel obj="contacts" groups={edit.groups} onClose={() => setEdit(null)} onApply={g => { const n = { ...edit, groups: g }; save(segs.some(x => x.id === n.id) ? segs.map(x => x.id === n.id ? n : x) : [n, ...segs]); }} />}</div>;
}
function SegRow({ s, onEdit, onDelete }: { s: Seg; onEdit: () => void; onDelete: () => void }) {
  const n = useDbValue(() => crm.search('contacts', { filterGroups: s.groups, limit: 1 }).total, [JSON.stringify(s.groups)]);
  return <tr className="border-b border-line/70 hover:bg-sky/40"><td className="px-4 py-2.5"><button className="cursor-pointer font-semibold text-link hover:underline" onClick={onEdit}>{s.name}</button></td><td>Dinámica</td><td className="tabular">{n}</td><td>Creada aquí</td><td className="pr-3 text-right"><IconButton n="trash" label="Eliminar" onClick={() => { if (confirm(`¿Eliminar "${s.name}"?`)) onDelete(); }} /></td></tr>;
}

/* ---- Automatización ---- */
const FLOWS: [string, string, string][] = [['Nexa | Task Creator Contacts', 'nx-contacts-v3', 'Clasifica el lead status y crea tareas de setters'], ['Nexa | Task Creator Appointments', 'nx-appt-handler', 'Ciclo de vida de citas y sus tareas'], ['Nexa | Report Sender', 'nx-report-sender', 'Reportes de roofing, windows y kitchen'], ['Nexa | UTM Fragmentation', 'nx-utm-fragmentation', 'Parte la URL del anuncio en campos de atribución'], ['Nexa | Ads CAPI', 'nx-meta-capi', 'Eventos de conversión a Meta y Google'], ['Nexa | Appointment Welcome Sequence', 'nx-appt-welcome', '3 correos al cliente con cita'], ['Partners | B2B Automation', 'partners-contractor-contract', 'Ciclo de contratos B2B']];
export function AutomationPage() {
  return <div className="p-4 sm:p-6 max-w-5xl"><PageHeader title="Automatización" sub="La lógica de negocio corre en n8n. El CRM le avisa de cada cambio y n8n le responde por la API." actions={<Link to="/developer/apps"><Button variant="primary">Webhooks y aplicaciones</Button></Link>} />
    <Card title="Cómo se conecta" className="mb-4"><ol className="list-decimal space-y-1 pl-5 text-[13.5px]"><li>El CRM envía un evento (<code className="rounded bg-sky px-1">contact.propertyChange</code>, <code className="rounded bg-sky px-1">appointment.propertyChange</code>…) al webhook de n8n.</li><li>n8n decide y llama a la API del CRM (crear tarea, cambiar estado, escribir nota).</li><li>Cada paso queda en <Link className="font-semibold text-link hover:underline" to="/developer/logs">Registros</Link>.</li></ol></Card>
    <Card title="Flujos de n8n que usan el CRM" pad={false}><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Flujo</th><th>Webhook de entrada</th><th>Qué hace</th></tr></thead><tbody>{FLOWS.map(([n, w, d]) => <tr key={n} className="border-b border-line/70"><td className="px-4 py-2.5 font-semibold">{n}</td><td><code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]">/webhook/{w}</code></td><td className="text-slate">{d}</td></tr>)}</tbody></table></Card>
    <Empty icon="bolt" title="Los workflows nativos de Nexa no se construyen aquí">Se portarán a n8n más adelante, cuando se migre. Ver documento de especificación §8.</Empty></div>;
}
export const Field_ = Field;
