import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PERMISSION_CATEGORIES, OBJECTS, OWNERS, ME } from '../lib/schema';
import type { Owner } from '../lib/types';
import Icon from '../components/Icon';
import PermissionEditor from './PermissionEditor';
import { SECTIONS, adminApi, adminCache, adminUserFor, loadAdmin, permsOf, presets, savePresets, useAccess, userList, type Seat } from '../lib/perms';
import { store } from '../lib/api';
import InviteUser from './users/InviteUser';
import InactiveUsers from './users/InactiveUsers';
import { Avatar, Badge, Button, Card, Checkbox, Empty, Field, IconButton, Input, Modal, PageHeader, Pill, Select, Switch, Tabs, cx, useToast } from '../components/ui';

const SEATS: Record<string, Seat> = { 'lucas.ferrer@nexa.example': 'Core', 'clara.montes@nexa.example': 'Core', 'daniel.ruiz@nexa.example': 'Core', 'paula.vidal@nexa.example': 'Core', 'hugo.navarro@nexa.example': 'Core', 'irene.castro@nexa.example': 'Core', 'marta.soler@nexa.example': 'Sales Professional' };
const ACCESS: Record<string, string[]> = { 'alex.rivera@nexa.example': ['Super Admin'], 'marta.soler@nexa.example': ['Reports', 'Contacts', 'Marketing'], 'lucas.ferrer@nexa.example': ['Reports', 'Contacts'] };
const seatOf = (o: Owner): Seat => permsOf(o.id).seat;
const isSuper = (o: Owner) => (store.CONNECTED ? adminUserFor(o.id)?.role === 'admin' : o.email === 'alex.rivera@nexa.example');
const accessOf = (o: Owner) => (store.CONNECTED && isSuper(o) ? ['Super Admin'] : ACCESS[o.email] ?? ['Reports', 'Marketing', 'Contacts']);
const LAST: Record<string, string> = { 'lucas.ferrer@nexa.example': 'Hoy', 'alex.rivera@nexa.example': 'Hoy', 'marta.soler@nexa.example': 'Ayer', 'clara.montes@nexa.example': 'Hoy', 'daniel.ruiz@nexa.example': '2 d' };
const DEACTIVATED = [{ name: 'Ana Prieto', email: 'ana.prieto@(desactivado)' }, { name: 'Leo Marín', email: 'leo.marin@(desactivado)' }];

/* ---- Pantalla Usuarios y equipos ---- */
export default function SettingsUsers() {
  useAccess(); useEffect(() => { void loadAdmin(); }, []); const ALL = userList();
  const toast = useToast(); const [tab, setTab] = useState<'users' | 'seats' | 'teams' | 'presets'>('users'); const [view, setView] = useState<'active' | 'deact'>('active'); const [q, setQ] = useState(''); const [edit, setEdit] = useState<Owner | null>(null); const [add, setAdd] = useState(false); const [newTeam, setNewTeam] = useState(false);
  const rows = ALL.filter(o => (o.firstName + ' ' + o.lastName + o.email).toLowerCase().includes(q.toLowerCase()));
  const teams = useMemo(() => { const m = new Map<string, Owner[]>(); ['Partners', 'Nexa - B2B Team', 'Nexa - Hot Leads', 'Nexa – Cold Team'].forEach(t => m.set(t, [])); adminCache.teams.forEach(t => m.set(t.name, m.get(t.name) ?? [])); ALL.forEach(o => o.teams.forEach(t => t && m.set(t, [...(m.get(t) ?? []), o]))); return [...m.entries()]; }, [ALL.length, adminCache.teams.length]);
  const seatCount = (s: Seat) => ALL.filter(o => seatOf(o) === s).length;
  return <div><PageHeader title="Usuarios y equipos" actions={tab === 'users' ? <><Button>Acciones</Button><Button variant="primary" onClick={() => setAdd(true)}>Agregar usuarios</Button></> : tab === 'teams' ? <Button variant="primary" onClick={() => setNewTeam(true)}>Crear equipo</Button> : undefined} />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'users', label: 'Usuarios' }, { id: 'seats', label: 'Licencias' }, { id: 'teams', label: 'Equipos' }, { id: 'presets', label: 'Presets' }]} />
    <div className="mt-4">
      {tab === 'users' && <><div className="mb-3 flex flex-wrap items-center gap-2"><div className="inline-flex rounded-lg border border-line bg-white p-0.5 text-[13.5px] font-semibold">{([['active', `${store.CONNECTED ? ALL.length : OWNERS.length} Usuarios activos`], ['deact', `${store.CONNECTED ? adminCache.users.filter(u => !u.active).length : 3} Usuarios desactivados`]] as const).map(([k, l]) => <button key={k} onClick={() => setView(k)} className={cx('cursor-pointer rounded-md px-3 py-1', view === k ? 'bg-navy text-white' : 'text-slate')}>{l}</button>)}</div><Pill>{store.CONNECTED ? adminCache.users.filter(u => u.active && u.mustChangePassword).length : 0} con contraseña temporal pendiente</Pill>
        <div className="relative w-full sm:ml-auto sm:w-auto"><Icon n="search" s={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nombre o correo" aria-label="Buscar usuarios" className="h-9 w-full sm:w-64 rounded-full border border-line-2 bg-white pl-8 pr-3 text-[13.5px] focus:border-teal focus:outline-none" /></div></div>
        <div className={cx('scroll-thin overflow-auto rounded-xl border border-line bg-white', store.CONNECTED && view === 'deact' && 'hidden')}><table className="w-full min-w-max text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Nombre</th><th>Correo</th><th>Licencia</th><th>Acceso</th><th>Equipo predeterminado</th><th>Equipos extra</th><th>Invitación</th><th>Última actividad</th></tr></thead>
          <tbody>{store.CONNECTED && view === 'deact' ? null : view === 'active' ? rows.map(o => <tr key={o.id} className="group border-b border-line/70 hover:bg-sky/40"><td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar name={`${o.firstName} ${o.lastName}`} size={26} /><Link to={`/settings/users/${o.id}`} className="font-semibold text-link hover:underline">{o.firstName} {o.lastName}</Link>{isSuper(o) && <Badge tone="Referral">Super Admin</Badge>}<Button size="sm" className="ml-1 opacity-0 group-hover:opacity-100" onClick={() => setEdit(o)}>Editar permisos</Button></div></td><td>{o.email}</td><td>{seatOf(o)}</td><td><div className="flex gap-1">{accessOf(o).map(a => <Pill key={a}>{a}</Pill>)}</div></td><td>{o.teams[0] ?? '--'}</td><td>{o.teams[1] ?? '--'}</td><td>{store.CONNECTED ? (adminUserFor(o.id)?.mustChangePassword ? 'Pendiente de crear contraseña' : 'Activo') : 'Invitación aceptada'}</td><td>{LAST[o.email] ?? 'Ayer'}</td></tr>)
            : DEACTIVATED.map(d => <tr key={d.name} className="border-b border-line/70"><td className="px-4 py-2.5 font-semibold text-slate">{d.name}</td><td className="text-slate">{d.email}</td><td colSpan={6} className="text-slate">Desactivado</td></tr>)}</tbody></table></div>{store.CONNECTED && view === 'deact' && <InactiveUsers />}</>}
      {tab === 'seats' && <div className="grid max-w-3xl gap-3 md:grid-cols-3">{(['Sales Professional', 'Core', 'View-Only'] as Seat[]).map(s => <Card key={s} title={s}><div className="font-display text-[34px] font-bold text-navy">{seatCount(s)}</div><p className="text-[13px] text-slate">usuarios con esta licencia</p></Card>)}</div>}
      {tab === 'teams' && <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Nombre</th><th>Miembros del equipo</th></tr></thead><tbody>{teams.map(([n, m]) => <tr key={n} className="border-b border-line/70"><td className="px-4 py-2.5 font-semibold text-link">{n}</td><td><div className="flex -space-x-1.5">{m.length ? m.slice(0, 7).map(o => <span key={o.id} className="rounded-full ring-2 ring-white"><Avatar name={`${o.firstName} ${o.lastName}`} size={26} /></span>) : <span className="text-slate">Ninguno</span>}</div></td></tr>)}</tbody></table></div>}
      {tab === 'presets' && <PresetsTab />}
    </div>
    {edit && <PermissionEditor owner={edit} onClose={() => setEdit(null)} />}
    {add && store.CONNECTED && <InviteUser onClose={() => setAdd(false)} />}
    {newTeam && store.CONNECTED && <NewTeamConnected onClose={() => setNewTeam(false)} />}
    {add && !store.CONNECTED && <Modal title="Agregar usuarios" onClose={() => setAdd(false)} footer={<><Button onClick={() => setAdd(false)}>Cancelar</Button><Button variant="primary" onClick={() => { setAdd(false); toast('Invitación preparada (se envía al conectar el backend)'); }}>Enviar invitación</Button></>}><Field label="Correo"><Input type="email" placeholder="nombre@nexahome.example" /></Field><Field label="Licencia"><Select defaultValue="Core"><option>Core</option><option>View-Only</option><option>Sales Professional</option></Select></Field><Field label="Equipo"><Select defaultValue="Nexa - Hot Leads">{teams.map(([n]) => <option key={n}>{n}</option>)}</Select></Field></Modal>}
    {newTeam && !store.CONNECTED && <Modal title="Crear equipo" onClose={() => setNewTeam(false)} footer={<><Button onClick={() => setNewTeam(false)}>Cancelar</Button><Button variant="primary" onClick={() => { setNewTeam(false); toast('Equipo creado (demo)'); }}>Crear</Button></>}><Field label="Nombre del equipo"><Input autoFocus /></Field><div className="space-y-1">{OWNERS.map(o => <Checkbox key={o.id} label={`${o.firstName} ${o.lastName}`} checked={false} onChange={() => {}} />)}</div></Modal>}
    <span className="hidden">{ME.id}</span>
  </div>;
}

function PresetsTab() {
  const toast = useToast(); const [, force] = useState(0); const list = presets();
  return <div><p className="mb-3 max-w-2xl text-[13.5px] text-slate">Un preset es un conjunto de permisos reutilizable. Para crear uno, edita los permisos de un usuario y pulsa <b>Guardar como preset</b> en la pestaña Revisar.</p>
    <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Preset</th><th>Licencia</th><th>Secciones</th><th></th></tr></thead><tbody>{list.map(p => <tr key={p.id} className="border-b border-line/70"><td className="px-4 py-2.5 font-semibold text-navy">{p.name}</td><td>{p.perms.seat}</td><td className="text-slate">{SECTIONS.filter(s => p.perms.sections[s.id]).map(s => s.label).join(', ') || '—'}</td><td className="pr-3 text-right"><IconButton n="trash" label={`Eliminar preset ${p.name}`} onClick={() => { savePresets(list.filter(x => x.id !== p.id)); force(n => n + 1); toast('Preset eliminado'); }} /></td></tr>)}</tbody></table></div></div>;
}

function NewTeamConnected({ onClose }: { onClose: () => void }) {
  const toast = useToast(); const [name, setName] = useState(''); const [err, setErr] = useState('');
  return <Modal title="Crear equipo" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!name.trim()} onClick={async () => { try { await adminApi('POST', '/admin/teams', { name: name.trim() }); toast('Equipo creado'); onClose(); } catch (e: any) { setErr(e?.code === 'team_exists' ? 'Ya existe un equipo con ese nombre.' : 'No se pudo crear el equipo'); } }}>Crear</Button></>}>
    {err && <p role="alert" className="mb-3 text-[13px] text-bad">{err}</p>}<Field label="Nombre del equipo"><Input autoFocus value={name} onChange={e => setName(e.target.value)} /></Field></Modal>;
}
