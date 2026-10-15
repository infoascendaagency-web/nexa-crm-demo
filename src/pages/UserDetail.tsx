import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, Badge, Button, Card, Checkbox, Empty, Field, PageHeader, Pill, Select, Switch, Tabs, useToast } from '../components/ui';
import { SECTIONS, TOOLS, PERM_OBJECTS, adminUserFor, loadAdmin, permsOf, roleOf, setViewAs, useAccess, userList } from '../lib/perms';
import { store } from '../lib/api';
import { OBJECTS, OWNERS } from '../lib/schema';
import PermissionEditor, { summarize } from './PermissionEditor';
import AccountActions from './users/AccountActions';

type Tab = 'overview' | 'account' | 'access' | 'setup' | 'routing' | 'prefs';
const LS = (k: string, d: unknown) => { try { return JSON.parse(localStorage.getItem(k) ?? '') ?? d; } catch { return d; } };
const ROLE: Record<string, string> = { admin: 'Administrador', manager: 'Gestor', setter: 'Setter', viewer: 'Consulta' };

export default function UserDetail() {
  const { id } = useParams(); useEffect(() => { void loadAdmin(); }, []); const owner = userList().find(o => o.id === id); const nav = useNavigate(); const toast = useToast(); const acc = useAccess();
  const [tab, setTab] = useState<Tab>('overview'); const [edit, setEdit] = useState(false);
  const rk = `nx-routing-${id}`, pk = `nx-userpref-${id}`;
  const [routing, setRouting] = useState<{ available: boolean; capacity: number; langs: string[]; products: string[] }>(() => LS(rk, { available: true, capacity: 40, langs: ['Spanish', 'English'], products: ['Roofing', 'Windows', 'Kitchen'] }));
  const [pref, setPref] = useState<{ lang: string; tz: string; mailTasks: boolean; mailLeads: boolean }>(() => LS(pk, { lang: 'es', tz: 'America/New_York', mailTasks: true, mailLeads: false }));
  if (!owner) return <div className="p-4 sm:p-6"><Empty icon="user" title="Usuario no encontrado"><Link to="/settings/users" className="font-semibold text-link hover:underline">Volver a usuarios</Link></Empty></div>;
  const p = permsOf(owner.id); const au = store.CONNECTED ? adminUserFor(owner.id) : undefined; const role: string = au ? au.role : roleOf(owner.id); const name = `${owner.firstName} ${owner.lastName}`;
  const saveR = (v: typeof routing) => { setRouting(v); try { localStorage.setItem(rk, JSON.stringify(v)); } catch { /* */ } };
  const saveP = (v: typeof pref) => { setPref(v); try { localStorage.setItem(pk, JSON.stringify(v)); } catch { /* */ } };
  const toggle = (arr: string[], x: string) => (arr.includes(x) ? arr.filter(y => y !== x) : [...arr, x]);
  return <div>
    <Link to="/settings/users" className="mb-2 inline-block text-[13px] font-semibold text-link hover:underline">‹ Usuarios y equipos</Link>
    <PageHeader title={<span className="flex items-center gap-3"><Avatar name={name} size={40} />{name}</span>} sub={`${owner.email} · ${ROLE[role]} · Licencia ${p.seat}`} actions={<>{!store.CONNECTED && acc.realIsAdmin && role !== 'admin' && <Button icon="eye" onClick={() => { setViewAs(owner.id); nav('/'); }}>Ver como {owner.firstName}</Button>}<Button variant="primary" onClick={() => setEdit(true)}>Editar permisos</Button></>} />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'overview', label: 'Resumen' }, ...(store.CONNECTED ? [{ id: 'account' as Tab, label: 'Cuenta' }] : []), { id: 'access', label: 'Acceso' }, { id: 'setup', label: 'Configuración' }, { id: 'routing', label: 'Asignación' }, { id: 'prefs', label: 'Preferencias' }]} />
    <div className="mt-4 max-w-4xl">
      {tab === 'overview' && <div className="grid gap-3 sm:grid-cols-2"><Card title="Datos"><dl className="space-y-2 text-[13.5px]"><div><dt className="text-[12px] font-bold text-slate">Correo</dt><dd>{owner.email}</dd></div><div><dt className="text-[12px] font-bold text-slate">ID de propietario</dt><dd className="tabular">{owner.id}</dd></div><div><dt className="text-[12px] font-bold text-slate">Rol</dt><dd>{ROLE[role]}</dd></div></dl></Card>
        <Card title="Equipos">{owner.teams.length ? <div className="flex flex-wrap gap-1.5">{owner.teams.map(t => <Pill key={t}>{t}</Pill>)}</div> : <p className="text-[13.5px] text-slate">Sin equipo.</p>}</Card></div>}
      {tab === 'account' && store.CONNECTED && <AccountActions ownerKey={owner.id} />}
      {tab === 'access' && <div className="space-y-3"><Card title="Licencia y modo"><p className="text-[13.5px]">Licencia <b>{p.seat}</b> · {p.mode === 'preset' ? 'definido por un preset' : 'permisos manuales'}</p></Card>
        <Card title="Objetos del CRM" pad={false}><ul className="divide-y divide-line text-[13.5px]">{PERM_OBJECTS.map(o => <li key={o} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5"><span className="font-semibold text-navy">{OBJECTS[o].plural}</span><span className="text-slate">{summarize(p.objects[o])}</span></li>)}</ul></Card>
        <Card title="Secciones y herramientas"><div className="flex flex-wrap gap-1.5">{SECTIONS.map(s => <Badge key={s.id} tone={p.sections[s.id] || role === 'admin' ? 'Confirmed' : 'Canceled'}>{s.label}</Badge>)}</div><div className="mt-3 flex flex-wrap gap-1.5">{TOOLS.filter(t => p.tools[t.id]).map(t => <Pill key={t.id}>{t.label}</Pill>)}</div></Card></div>}
      {tab === 'setup' && <div className="space-y-3"><Card title="Equipos"><div className="flex flex-wrap gap-1.5">{owner.teams.map(t => <Pill key={t}>{t}</Pill>)}</div></Card><Card title="Integraciones del usuario"><p className="text-[13.5px] text-slate">Dialpad (extensión), calendario y correo se conectan desde Ajustes → Integraciones.</p></Card></div>}
      {tab === 'routing' && <Card title="Asignación de leads"><p className="mb-3 text-[13px] text-slate">Define cuándo y qué leads puede recibir este usuario. El backend usará estos valores para repartir (hoy lo hace n8n).</p>
        <div className="mb-3 flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span className="text-[13.5px] font-semibold">Disponible para recibir leads</span><Switch on={routing.available} onChange={v => saveR({ ...routing, available: v })} label="Disponible para recibir leads" /></div>
        <Field label="Capacidad máxima de leads abiertos"><input type="number" min={0} className="h-9 w-32 rounded-lg border border-line-2 px-3 text-sm focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" value={routing.capacity} onChange={e => saveR({ ...routing, capacity: Number(e.target.value) })} /></Field>
        <div className="mb-3"><div className="mb-1 text-[12.5px] font-semibold text-slate">Idiomas</div><div className="flex gap-4">{['Spanish', 'English'].map(l => <Checkbox key={l} label={l} checked={routing.langs.includes(l)} onChange={() => saveR({ ...routing, langs: toggle(routing.langs, l) })} />)}</div></div>
        <div><div className="mb-1 text-[12.5px] font-semibold text-slate">Productos</div><div className="flex flex-wrap gap-4">{['Roofing', 'Windows', 'Kitchen', 'Bathroom'].map(l => <Checkbox key={l} label={l} checked={routing.products.includes(l)} onChange={() => saveR({ ...routing, products: toggle(routing.products, l) })} />)}</div></div></Card>}
      {tab === 'prefs' && <Card title="Preferencias del usuario"><Field label="Idioma"><Select value={pref.lang} onChange={e => saveP({ ...pref, lang: e.target.value })} className="!w-48"><option value="es">Español</option><option value="en">English</option></Select></Field><Field label="Zona horaria"><Select value={pref.tz} onChange={e => saveP({ ...pref, tz: e.target.value })} className="!w-64"><option>America/New_York</option><option>America/Chicago</option><option>America/Bogota</option><option>America/Los_Angeles</option></Select></Field>
        <div className="flex items-center justify-between border-t border-line py-2.5"><span className="text-[13.5px]">Avisar por correo de tareas vencidas</span><Switch on={pref.mailTasks} onChange={v => saveP({ ...pref, mailTasks: v })} label="Avisos de tareas por correo" /></div><div className="flex items-center justify-between border-t border-line py-2.5"><span className="text-[13.5px]">Avisar por correo de leads nuevos asignados</span><Switch on={pref.mailLeads} onChange={v => saveP({ ...pref, mailLeads: v })} label="Avisos de leads por correo" /></div>
        <Button className="mt-2" onClick={() => toast('Preferencias guardadas')}>Guardar</Button></Card>}
    </div>
    {edit && <PermissionEditor owner={owner} onClose={() => setEdit(false)} />}
  </div>;
}
