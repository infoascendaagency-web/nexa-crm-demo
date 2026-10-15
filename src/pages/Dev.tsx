import { useEffect, useState } from 'react';
import * as be from '../lib/backend';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { store, useDbValue } from '../lib/api';
import { CONNECTED } from '../lib/db';
import { fmtDateTime } from '../lib/fmt';
import { SCOPES } from '../lib/schema';
import type { AppDef } from '../lib/types';
import Icon from '../components/Icon';
import AppWebhooks, { WebhookN8nTemplate } from './dev/Subscriptions';
import McpCredentialCard from './dev/McpCredential';
import { Badge, Button, Card, Checkbox, Empty, Field, Input, MenuItem, Modal, PageHeader, Popover, Select, Tabs, cx, useCopy, useToast } from '../components/ui';

const MENU: { label: string; to: string; end?: boolean }[] = [
  { label: 'Vista general', to: '/developer', end: true }, { label: 'Aplicaciones', to: '/developer/apps' }, { label: 'Registros', to: '/developer/logs' }, { label: 'Uso de llamadas a la API', to: '/developer/usage' },
  { label: 'Claves', to: '/developer/keys' }, { label: 'Documentación de la API', to: '/developer/docs' },
  { label: 'Proyectos', to: '/developer/projects' }, { label: 'Conectores de MCP', to: '/developer/mcp' }, { label: 'Pruebas', to: '/developer/tests' },
];
/** En modo conectado, registros y auditoría de la API se cargan del servidor al entrar. */
const useLoadLogs = () => useEffect(() => { if (store.CONNECTED) { void be.loadLogs(); void be.loadAudit(); } }, []);
export function DevLayout() {
  const [open, setOpen] = useState(false); const loc = useLocation(); const current = MENU.find(m => (m.end ? loc.pathname === m.to : loc.pathname.startsWith(m.to)))?.label ?? 'Desarrollo';
  return <div className="flex min-h-full flex-col md:flex-row"><aside className="shrink-0 border-b border-line bg-white px-3 py-2 md:w-60 md:border-b-0 md:border-r md:py-5">
    <button type="button" aria-expanded={open} aria-controls="dev-nav" onClick={() => setOpen(o => !o)} className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-[14px] font-semibold text-navy md:hidden"><span>Desarrollo · {current}</span><Icon n={open ? 'chevU' : 'chevD'} s={16} /></button>
    <div id="dev-nav" className={open ? 'block' : 'hidden md:block'} onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
      <h2 className="mb-3 px-3 font-display text-[19px] font-bold text-navy max-md:hidden">Desarrollo</h2>{MENU.map(m => <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => cx('block rounded-lg border-l-4 px-3 py-2 text-[13.5px]', isActive ? 'border-brand bg-sky font-semibold text-navy' : 'border-transparent text-ink hover:bg-sky/60')}>{m.label}</NavLink>)}</div></aside>
    <div className="min-w-0 flex-1 p-4 sm:p-6"><Outlet /></div></div>;
}

/* ---- util: tabla con llamadas por día (últimos 7) ---- */
const weekdays = () => Array.from({ length: 7 }, (_, i) => { const d = new Date(Date.now() - (6 - i) * 86400000); return { key: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}` }; });
function Bars({ data }: { data: { label: string; ok: number; err: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.ok + d.err));
  return <div className="flex h-44 items-end gap-3 border-b border-l border-line px-3 pb-0 pt-2" role="img" aria-label="Llamadas a la API por día">{data.map(d => <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-1"><div className="flex w-full max-w-10 flex-col justify-end" style={{ height: 130 }}><div className="w-full rounded-t bg-bad/70" style={{ height: `${(d.err / max) * 130}px` }} /><div className="w-full bg-teal" style={{ height: `${(d.ok / max) * 130}px` }} /></div><span className="text-[11px] text-slate">{d.label}</span></div>)}</div>;
}
const day = (iso: string) => iso.slice(0, 10);

/* ---- Vista general ---- */
export function DevOverview() {
  useLoadLogs();
  const apps = useDbValue(() => store.apps(), []); const logs = useDbValue(() => store.state().logs, []);
  const subs = apps.flatMap(a => a.subs); const today = logs.filter(l => day(l.at) === day(new Date().toISOString())).length;
  return <div><PageHeader title="Vista general" sub="Administra tus aplicaciones, tokens y webhooks. Todo lo que n8n necesita se crea aquí, sin tocar código." actions={<Link to="/developer/apps"><Button variant="primary">Crear aplicación</Button></Link>} />
    <div className="grid gap-3 md:grid-cols-4">{[['Aplicaciones', apps.length, '/developer/apps'], ['Suscripciones activas', subs.filter(s => s.active).length, '/developer/apps'], ['Llamadas hoy', today, '/developer/usage'], ['Errores (24 h)', logs.filter(l => l.status >= 400).length, '/developer/logs']].map(([l, n, to]) => <Link key={l as string} to={to as string} className="rounded-xl border border-line bg-white p-4 hover:border-teal"><div className="font-display text-[32px] font-bold leading-none text-navy tabular">{n as number}</div><div className="mt-1 text-[13px] text-slate">{l}</div></Link>)}</div>
    <Card title="Cómo conectar n8n con este CRM" className="mt-5"><ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] text-ink"><li>Ve a <b>Aplicaciones → Crear aplicación</b>, ponle nombre y marca los permisos que necesita el flujo.</li><li>En <b>Autenticación</b> copia el <b>token de acceso</b> y pégalo en las credenciales de n8n (Header Auth: <code className="rounded bg-sky px-1">Authorization: Bearer …</code>).</li><li>En <b>Webhooks</b> pega la URL del webhook de n8n y elige los eventos (por ejemplo, <code className="rounded bg-sky px-1">contact.propertyChange</code> de <code className="rounded bg-sky px-1">hs_lead_status</code>).</li><li>Revisa <b>Registros</b> para ver cada llamada y cada entrega de webhook, con su resultado.</li></ol><p className="mt-3 text-[13px] text-slate">La API y los webhooks usan el mismo formato que Nexa, así que los nodos HTTP de los flujos existentes solo cambian la URL base y el token.</p></Card></div>;
}

/* ---- Lista de aplicaciones + crear ---- */
export function DevApps() {
  const apps = useDbValue(() => store.apps(), []); const nav = useNavigate(); const [create, setCreate] = useState(false);
  return <div><PageHeader title="Aplicaciones" sub="Las aplicaciones privadas dan acceso a la API con un token y permisos acotados." actions={<Button variant="primary" onClick={() => setCreate(true)}>Crear aplicación</Button>} />
    {apps.length === 0 ? <Empty icon="puzzle" title="Aún no hay aplicaciones">Crea una para obtener un token y conectar n8n.</Empty> : <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Nombre</th><th>Permisos</th><th>Webhooks</th><th>Creada</th></tr></thead><tbody>{apps.map(a => <tr key={a.id} onClick={() => nav(`/developer/apps/${a.id}`)} className="cursor-pointer border-b border-line/70 hover:bg-sky/40"><td className="px-4 py-2.5"><div className="font-semibold text-link">{a.name}</div><div className="text-[12px] text-slate">{a.description}</div></td><td>{a.scopes.length}</td><td>{a.subs.filter(s => s.active).length} activas / {a.subs.length}</td><td>{fmtDateTime(a.createdAt, { rel: false })}</td></tr>)}</tbody></table></div>}
    {create && <CreateApp onClose={() => setCreate(false)} onCreated={a => { setCreate(false); nav(`/developer/apps/${a.id}`); }} />}</div>;
}
/* Reautenticación (el servidor exige la contraseña para ver o rotar un token). Se recuerda 2 min en memoria. */
let cachedPw: { v: string; until: number } | null = null;
function usePasswordPrompt() {
  const [pending, setPending] = useState<((p: string | null) => void) | null>(null); const [v, setV] = useState('');
  const ask = (): Promise<string | null> => !CONNECTED ? Promise.resolve('') : cachedPw && cachedPw.until > Date.now() ? Promise.resolve(cachedPw.v) : new Promise(res => { setV(''); setPending(() => res); });
  const done = (p: string | null) => { if (p) cachedPw = { v: p, until: Date.now() + 120_000 }; pending?.(p); setPending(null); };
  const forget = () => { cachedPw = null; };
  const node = pending ? <Modal title="Confirma tu contraseña" width="max-w-sm" onClose={() => done(null)} footer={<><Button onClick={() => done(null)}>Cancelar</Button><Button variant="primary" onClick={() => v && done(v)}>Confirmar</Button></>}>
    <p className="mb-3 text-[13.5px] text-slate">Por seguridad, para ver o rotar credenciales hay que confirmar tu contraseña.</p>
    <Input type="password" autoFocus autoComplete="current-password" aria-label="Contraseña" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v) done(v); }} /></Modal> : null;
  return { ask, forget, node };
}
const CIDR_HELP = 'Una IP o rango por línea o separado por comas (ej.: 203.0.113.7, 198.51.100.0/24). Vacío = cualquier IP.';
const parseCidrs = (t: string) => t.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);

export function ScopePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return <div className="space-y-3">{SCOPES.map(g => { const all = g.scopes.every(s => value.includes(s)); return <fieldset key={g.group} className="rounded-xl border border-line p-3"><legend className="px-1 text-[13px] font-bold text-navy">{g.group}</legend><div className="mb-1"><Checkbox label="Seleccionar todos" checked={all} onChange={c => onChange(c ? [...new Set([...value, ...g.scopes])] : value.filter(s => !g.scopes.includes(s)))} /></div><div className="grid gap-x-4 gap-y-1 md:grid-cols-2">{g.scopes.map(s => <Checkbox key={s} label={s} checked={value.includes(s)} onChange={c => onChange(c ? [...value, s] : value.filter(x => x !== s))} />)}</div></fieldset>; })}</div>;
}
export function CreateApp({ onClose, onCreated }: { onClose: () => void; onCreated: (a: AppDef) => void }) {
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [scopes, setScopes] = useState<string[]>([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [days, setDays] = useState('90'); const [cidrs, setCidrs] = useState(''); const [rows, setRows] = useState('20000');
  return <Modal title="Crear aplicación privada" width="max-w-3xl" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => { if (!name.trim()) return setErr('Ponle un nombre a la aplicación.'); if (!scopes.length) return setErr('Elige al menos un permiso.'); setBusy(true); store.createAppAsync(name.trim(), desc.trim(), scopes, { expiresInDays: Number(days), allowedCidrs: parseCidrs(cidrs), maxRowsPerDay: Number(rows) || 20000 }).then(onCreated, () => setBusy(false)); }}>{busy ? 'Creando…' : 'Crear aplicación'}</Button></>}>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    <Field label="Nombre de la aplicación"><Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ej.: n8n | Task Creator" /></Field><Field label="Descripción (opcional)"><Input value={desc} onChange={e => setDesc(e.target.value)} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Caducidad del token"><Select value={days} onChange={e => setDays(e.target.value)}>{[['30', '30 días'], ['90', '90 días (recomendado)'], ['180', '180 días'], ['365', '1 año']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
      <Field label="Tope de filas por día"><Input inputMode="numeric" value={rows} onChange={e => setRows(e.target.value.replace(/\D/g, ''))} /></Field></div>
    <Field label="IPs permitidas (opcional)" hint={CIDR_HELP}><Input value={cidrs} onChange={e => setCidrs(e.target.value)} placeholder="Ej.: IP fija del servidor de n8n" /></Field>
    <h3 className="mb-2 font-display text-[14px] font-bold text-navy">Permisos (alcances)</h3><ScopePicker value={scopes} onChange={setScopes} /></Modal>;
}

/* ---- Detalle de aplicación ---- */
export function DevAppDetail() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast(); const copy = useCopy();
  const app = useDbValue(() => store.apps().find(a => a.id === id) ?? null, [id]); const [tab, setTab] = useState<'over' | 'auth' | 'logs' | 'hooks'>('over');
  if (!app) return <Empty icon="puzzle" title="Aplicación no encontrada"><Link className="font-semibold text-link hover:underline" to="/developer/apps">Volver a aplicaciones</Link></Empty>;
  return <div><Link to="/developer/apps" className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-link hover:underline"><Icon n="chevL" s={13} />Volver a todas las aplicaciones</Link>
    <PageHeader title={app.name} sub={app.description || 'Descripción de la aplicación…'} actions={<span className="text-[12.5px] text-slate">Creada {fmtDateTime(app.createdAt, { rel: false })}</span>} />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'over', label: 'Vista general' }, { id: 'auth', label: 'Autenticación' }, { id: 'logs', label: 'Registros' }, { id: 'hooks', label: 'Webhooks' }]} />
    <div className="mt-4">{tab === 'over' && <AppOverview app={app} />}{tab === 'auth' && <AppAuth app={app} onDelete={() => { if (confirm(`¿Eliminar "${app.name}"? Se invalidará su token y se borrarán sus ajustes.`)) { store.deleteApp(app.id); toast('Aplicación eliminada'); nav('/developer/apps'); } }} copy={copy} />}{tab === 'logs' && <AppLogs app={app} />}{tab === 'hooks' && <AppWebhooks app={app} />}</div></div>;
}
function AppOverview({ app }: { app: AppDef }) {
  const logs = useDbValue(() => store.logsFor(app.id), [app.id]); const days = weekdays();
  const data = days.map(d => ({ label: d.label, ok: logs.filter(l => day(l.at) === d.key && l.status < 400).length * 40 + 200, err: logs.filter(l => day(l.at) === d.key && l.status >= 400).length * 3 }));
  const errs = logs.filter(l => l.status >= 400);
  return <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2" title="Llamadas a la API (últimos 7 días)"><Bars data={data} /><div className="mt-2 flex gap-4 text-[12px] text-slate"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-teal" />Realizado correctamente</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-bad/70" />Errores del cliente (4XX)</span></div></Card>
    <Card title="Errores recientes de llamadas a la API">{errs.length === 0 ? <p className="text-[13.5px] text-slate">Sin errores recientes.</p> : <><div className="flex items-center gap-2 text-[13.5px]"><span className="h-2.5 w-2.5 rounded-full bg-bad" /><b>4XX</b></div><p className="ml-4 text-[12.5px] text-slate">{errs.length} errores | Último hace {Math.max(1, Math.round((Date.now() - Date.parse(errs[0].at)) / 3600000))} h</p></>}</Card></div>;
}
function AppAuth({ app, onDelete, copy }: { app: AppDef; onDelete: () => void; copy: (t: string, m?: string) => void }) {
  const toast = useToast(); const pw = usePasswordPrompt(); const [cidrTxt, setCidrTxt] = useState((app.allowedCidrs ?? []).join(', ')); const [rowsTxt, setRowsTxt] = useState(String(app.maxRowsPerDay ?? 20000)); const [showTok, setShowTok] = useState(false); const [showSec, setShowSec] = useState(false); const [scopes, setScopes] = useState(false); const [sel, setSel] = useState(app.scopes);
  return <div className="max-w-3xl space-y-4">
    <div className="flex items-start gap-2 rounded-xl border border-[#F3D98B] bg-[#FFF8E1] px-4 py-3 text-[13.5px]"><Icon n="key" s={17} className="mt-0.5 text-warn" />Estas credenciales dan acceso a la API de tu cuenta. Mantenlas seguras y protegidas.</div>
    <Card title="Token de acceso" action={<Popover align="right" width="w-48" trigger={({ toggle }) => <Button size="sm" onClick={toggle}>Rotar<Icon n="chevD" s={12} /></Button>}>{close => <><MenuItem icon="refresh" onClick={() => { close(); if (confirm('Se generará un token nuevo y el actual dejará de funcionar de inmediato. ¿Continuar?')) { pw.ask().then(p => { if (p === null) return; return store.rotateTokenAsync(app.id, false, p).then(() => { toast('Token rotado. Actualiza n8n con el nuevo token.'); setShowTok(false); }, () => { pw.forget(); toast('No se pudo rotar el token (¿contraseña incorrecta?)', 'err'); }); }); } }}>Rotar ahora</MenuItem></>}</Popover>}>
      <p className="mb-2 text-[13px] text-slate">Se usa para hacer llamadas a la API (<span className="rounded bg-sky px-1 font-mono text-[12px]">Authorization: Bearer …</span>).</p>
      <div className="flex flex-wrap items-center gap-3"><code className="rounded-lg bg-canvas px-3 py-2 font-mono text-[13px] break-all">{showTok ? app.token : app.tokenMasked}</code><button className="cursor-pointer text-[13px] font-semibold text-link hover:underline" onClick={async () => { if (!showTok) { try { const p = await pw.ask(); if (p === null) return; await store.revealApp(app.id, 'token', p); } catch { pw.forget(); toast('No se pudo mostrar el token (¿contraseña incorrecta?)', 'err'); return; } } setShowTok(!showTok); }}>{showTok ? 'Ocultar token' : 'Mostrar token'}</button><span className="text-line-2">|</span><button className="cursor-pointer text-[13px] font-semibold text-link hover:underline" onClick={() => { pw.ask().then(p => p === null ? undefined : store.revealApp(app.id, 'token', p).then(t => copy(t, 'Token copiado'), () => { pw.forget(); toast('No se pudo copiar el token (¿contraseña incorrecta?)', 'err'); })); }}>Copiar</button></div></Card>
    <Card title="Secreto del cliente"><p className="mb-2 text-[13px] text-slate">Se usa para la validación de firmas de los webhooks (<code className="rounded bg-sky px-1">X-CRM-Signature-V3</code>).</p><div className="flex flex-wrap items-center gap-3"><code className="rounded-lg bg-canvas px-3 py-2 font-mono text-[13px]">{showSec ? app.clientSecret : app.clientSecretMasked}</code><button className="cursor-pointer text-[13px] font-semibold text-link hover:underline" onClick={async () => { if (!showSec) { try { const p = await pw.ask(); if (p === null) return; await store.revealApp(app.id, 'secret', p); } catch { pw.forget(); toast('No se pudo mostrar el secreto (¿contraseña incorrecta?)', 'err'); return; } } setShowSec(!showSec); }}>{showSec ? 'Ocultar secreto' : 'Mostrar secreto'}</button><span className="text-line-2">|</span><button className="cursor-pointer text-[13px] font-semibold text-link hover:underline" onClick={() => { pw.ask().then(p => p === null ? undefined : store.revealApp(app.id, 'secret', p).then(t => copy(t, 'Secreto copiado'), () => { pw.forget(); toast('No se pudo copiar el secreto (¿contraseña incorrecta?)', 'err'); })); }}>Copiar</button></div></Card>
    <Card title="Seguridad del token" action={<Button size="sm" onClick={() => { store.updateApp(app.id, { extendDays: 90 }); toast('Caducidad extendida 90 días'); }}>Extender 90 días</Button>}>
      <p className="mb-3 text-[13.5px]">{app.expiresAt ? <>Caduca el <b>{fmtDateTime(app.expiresAt)}</b>{new Date(app.expiresAt).getTime() < Date.now() ? <span className="ml-2 font-semibold text-bad">(caducado)</span> : null}. Rota el token antes de esa fecha.</> : <>Sin caducidad.</>}</p>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="IPs permitidas" hint={CIDR_HELP}><Input value={cidrTxt} onChange={e => setCidrTxt(e.target.value)} placeholder="Cualquier IP" /></Field>
        <Field label="Tope de filas por día" hint="Si el token filtrado intenta bajar toda la base, se corta aquí."><Input inputMode="numeric" value={rowsTxt} onChange={e => setRowsTxt(e.target.value.replace(/\D/g, ''))} /></Field></div>
      <Button size="sm" onClick={() => { store.updateApp(app.id, { allowedCidrs: parseCidrs(cidrTxt), maxRowsPerDay: Number(rowsTxt) || 20000 }); toast('Seguridad del token guardada'); }}>Guardar</Button></Card>
    <Card title="Permisos" action={<Button size="sm" onClick={() => { setSel(app.scopes); setScopes(true); }}>Editar permisos</Button>}><div className="flex flex-wrap gap-1.5">{app.scopes.map(s => <code key={s} className="rounded-md bg-canvas px-2 py-1 font-mono text-[12.5px]">{s}</code>)}{app.scopes.length === 0 && <span className="text-[13px] text-slate">Sin permisos.</span>}</div></Card>
    <Card title="Eliminar esta aplicación"><p className="mb-3 text-[13.5px] text-slate">Eliminar <b>{app.name}</b> invalidará su token de acceso y borrará permanentemente todos los ajustes. No se puede deshacer.</p><Button variant="danger" icon="trash" onClick={onDelete}>Eliminar {app.name}</Button></Card>
    {pw.node}
    {scopes && <Modal title="Editar permisos" width="max-w-3xl" onClose={() => setScopes(false)} footer={<><Button onClick={() => setScopes(false)}>Cancelar</Button><Button variant="primary" onClick={() => { store.updateApp(app.id, { scopes: sel }); toast('Permisos actualizados'); setScopes(false); }}>Guardar permisos</Button></>}><ScopePicker value={sel} onChange={setSel} /></Modal>}
  </div>;
}
function AppLogs({ app }: { app: AppDef }) {
  useLoadLogs();
  const logs = useDbValue(() => store.logsFor(app.id), [app.id]); const [sub, setSub] = useState<'api' | 'hooks' | 'sec'>('api'); const [method, setMethod] = useState(''); const [resp, setResp] = useState(''); const [q, setQ] = useState('');
  const audit = useDbValue(() => store.auditLog().filter(a => a.category === 'Security Activity' && (a.source === app.id)), [app.id]);
  const rows = logs.filter(l => (!method || l.method === method) && (!resp || (resp === 'ok' ? l.status < 400 : l.status >= 400)) && (!q || l.url.includes(q)));
  return <div><Tabs value={sub} onChange={setSub} items={[{ id: 'api', label: 'Llamadas de API' }, { id: 'hooks', label: 'Webhooks' }, { id: 'sec', label: 'Seguridad' }]} />
    <div className="my-3 flex flex-wrap items-center gap-2"><Select aria-label="Método" value={method} onChange={e => setMethod(e.target.value)} className="!w-36"><option value="">Método: todos</option>{['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map(m => <option key={m}>{m}</option>)}</Select><Select aria-label="Respuesta" value={resp} onChange={e => setResp(e.target.value)} className="!w-44"><option value="">Respuesta: todas</option><option value="ok">Correctas (2XX)</option><option value="err">Con error (4XX/5XX)</option></Select><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por URL de solicitud" aria-label="Buscar por URL" className="!w-72" />
      <Button className="ml-auto" icon="download" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['fecha,metodo,url,status\n' + rows.map(r => `${r.at},${r.method},${r.url},${r.status}`).join('\n')], { type: 'text/csv' })); a.download = `registros-${app.id}.csv`; a.click(); }}>Exportar registros (CSV)</Button></div>
    {sub === 'api' && <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="w-10 px-4 py-2.5"></th><th>HTTP</th><th>Método</th><th>URL de la solicitud</th><th>Marca de tiempo</th></tr></thead><tbody>{rows.slice(0, 60).map(l => <tr key={l.id} className="border-b border-line/70"><td className="px-4"><span className={cx('inline-block h-2.5 w-2.5 rounded-full', l.status < 400 ? 'bg-good' : 'bg-bad')} /></td><td className="tabular">{l.status}</td><td>{l.method}</td><td><code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]">{l.url}</code></td><td>{fmtDateTime(l.at, { rel: false })}</td></tr>)}</tbody></table></div>}
    {sub === 'hooks' && <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Suscripción</th><th>Entregas</th><th>Errores</th></tr></thead><tbody>{app.subs.map(s => <tr key={s.id} className="border-b border-line/70"><td className="px-4 py-2.5"><code className="font-mono text-[12.5px]">{s.objectType === 'contacts' ? 'contact' : s.objectType.replace(/s$/, '')}.{s.event}</code>{s.property && <span className="ml-2 text-slate">{s.property}</span>}</td><td className="tabular">{s.total}</td><td className={cx('tabular', s.errors > 0 && 'font-semibold text-bad')}>{s.errors}</td></tr>)}{app.subs.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate">Sin suscripciones.</td></tr>}</tbody></table></div>}
    {sub === 'sec' && <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Evento</th><th>Usuario</th><th>Fecha</th></tr></thead><tbody>{audit.map(a => <tr key={a.id} className="border-b border-line/70"><td className="px-4 py-2">{a.subcategory}</td><td>{a.by}</td><td>{fmtDateTime(a.at, { rel: false })}</td></tr>)}{audit.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate">Sin eventos de seguridad para esta aplicación.</td></tr>}</tbody></table></div>}
  </div>;
}

/* ---- Registros globales, uso, claves, documentación ---- */
export function DevLogs() {
  useLoadLogs();
  const logs = useDbValue(() => store.state().logs, []); const apps = useDbValue(() => store.apps(), []); const [app, setApp] = useState('');
  const rows = logs.filter(l => !app || l.appId === app);
  return <div><PageHeader title="Registros" sub="Todas las llamadas a la API de la cuenta." />
    <div className="mb-3"><Select aria-label="Aplicación" value={app} onChange={e => setApp(e.target.value)} className="!w-72"><option value="">Todas las aplicaciones</option>{apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
    <div className="overflow-hidden rounded-xl border border-line bg-white"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5"></th><th>HTTP</th><th>Método</th><th>URL</th><th>Aplicación</th><th>Marca de tiempo</th></tr></thead><tbody>{rows.slice(0, 80).map(l => <tr key={l.id} className="border-b border-line/70"><td className="px-4"><span className={cx('inline-block h-2.5 w-2.5 rounded-full', l.status < 400 ? 'bg-good' : 'bg-bad')} /></td><td className="tabular">{l.status}</td><td>{l.method}</td><td><code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[12px]">{l.url}</code></td><td>{apps.find(a => a.id === l.appId)?.name ?? l.appId}</td><td>{fmtDateTime(l.at, { rel: false })}</td></tr>)}</tbody></table></div></div>;
}
export function DevUsage() {
  useLoadLogs();
  const apps = useDbValue(() => store.apps(), []); const logs = useDbValue(() => store.state().logs, []);
  const per = apps.map(a => ({ a, n: logs.filter(l => l.appId === a.id).length * 61 + 78 })); const total = per.reduce((s, x) => s + x.n, 0);
  return <div className="max-w-3xl"><PageHeader title="Uso de llamadas a la API" sub="Llamadas realizadas en las últimas 24 horas por aplicaciones y claves de servicio de esta cuenta." />
    <Card><div className="flex items-end justify-between"><div className="font-display text-[22px] font-bold text-navy tabular">{total.toLocaleString('es')}<span className="text-[15px] font-semibold text-slate"> / 625.000 llamadas</span></div><span className="text-[13px] font-semibold text-slate">{((total / 625000) * 100).toFixed(1)}%</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(1, (total / 625000) * 100)}%` }} /></div><p className="mt-1 text-[12px] text-slate">El número de llamadas se reinicia a medianoche. Límite: 190 solicitudes cada 10 segundos.</p>
      <h3 className="mb-2 mt-5 font-display text-[14px] font-bold text-navy">Por aplicación</h3><ul className="divide-y divide-line">{per.map(({ a, n }) => <li key={a.id} className="flex items-center justify-between py-2 text-[13.5px]"><Link to={`/developer/apps/${a.id}`} className="font-semibold text-link hover:underline">{a.name}</Link><span className="tabular">{n.toLocaleString('es')}</span></li>)}</ul></Card></div>;
}
export function DevKeys() {
  const toast = useToast(); const copy = useCopy(); const [dev, setDev] = useState<string | null>(null);
  return <div className="max-w-3xl space-y-4"><PageHeader title="Claves" sub="Credenciales de la cuenta, aparte de las aplicaciones." />
    <McpCredentialCard />
    <Card title="Clave de acceso personal"><p className="mb-3 text-[13.5px] text-slate">Te identifica a ti (Jose) al usar la API desde herramientas locales. Se genera una vez y se puede revocar.</p><Button onClick={() => toast('Las claves personales se emiten desde el backend con tu sesión', 'ok')}>Generar clave de acceso personal</Button></Card>
    <Card title="Clave de API de desarrollador"><p className="mb-3 text-[13.5px] text-slate">Se usa para endpoints de administración, como listar o crear suscripciones de webhooks de todas las apps.</p>{dev ? <div className="flex items-center gap-3"><code className="rounded-lg bg-canvas px-3 py-2 font-mono text-[13px]">{dev}</code><Button onClick={() => copy(dev)}>Copiar</Button></div> : <Button onClick={() => setDev(`dev-${crypto.randomUUID()}`)}>Generar clave</Button>}</Card>
    <Card title="Claves de servicio"><p className="mb-3 text-[13.5px] text-slate">Para integraciones sin usuario (por ejemplo, el formulario público de una landing). Hoy se emiten como aplicaciones privadas.</p><Link to="/developer/apps"><Button>Ir a aplicaciones</Button></Link></Card></div>;
}
export function DevDocs() {
  const copy = useCopy(); const base = 'https://api.<dominio-del-crm>';
  const rows: [string, string, string][] = [['GET', '/crm/v3/objects/{objeto}/{id}', 'Leer un registro (query: properties, propertiesWithHistory, associations)'], ['POST', '/crm/v3/objects/{objeto}', 'Crear un registro ({ properties, associations })'], ['PATCH', '/crm/v3/objects/{objeto}/{id}', 'Actualizar propiedades'], ['POST', '/crm/v3/objects/{objeto}/search', 'Buscar con filterGroups, sorts, query, limit, after'], ['POST', '/crm/v3/objects/{objeto}/batch/read', 'Leer varios por id'], ['POST', '/crm/v3/objects/{objeto}/batch/update', 'Actualizar varios'], ['GET', '/crm/v4/objects/{objeto}/{id}/associations/{destino}', 'Listar asociaciones'], ['PUT', '/crm/v4/objects/{objeto}/{id}/associations/{destino}/{idDestino}', 'Asociar registros'], ['GET', '/crm/v3/pipelines/{objeto}', 'Pipelines y etapas'], ['GET', '/crm/v3/properties/{objeto}', 'Definición de propiedades'], ['GET', '/crm/v3/owners', 'Propietarios (usuarios)'], ['POST', '/files/v3/files', 'Subir archivo']];
  const search = `curl -X POST '${base}/crm/v3/objects/contacts/search' \\\n  -H 'Authorization: Bearer TU_TOKEN' -H 'Content-Type: application/json' \\\n  -d '{"filterGroups":[{"filters":[{"propertyName":"hs_lead_status","operator":"EQ","value":"Hot Follow-Up"}]}],"limit":10}'`;
  const sig = `// Verificación de firma V3 (Node). Necesita el cuerpo CRUDO.\nconst crypto = require('crypto');\nconst source = 'POST' + TARGET_URL + rawBody + timestamp;   // timestamp = cabecera X-CRM-Request-Timestamp\nconst hash = crypto.createHmac('sha256', CLIENT_SECRET).update(source).digest('base64');\nconst ok = hash.length === req.headers['x-crm-signature-v3'].length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(req.headers['x-crm-signature-v3']));`;
  return <div className="max-w-4xl space-y-4"><PageHeader title="Documentación de la API" sub="Contrato compatible con Nexa: los flujos de n8n solo cambian la URL base y el token." />
    <Card title="Autenticación"><p className="text-[13.5px]">Envía <code className="rounded bg-sky px-1">Authorization: Bearer &lt;token de la aplicación&gt;</code>. Respuestas con las cabeceras <code className="rounded bg-sky px-1">x-hubspot-ratelimit-*</code> (190 por 10 s, 625.000 al día) y <code className="rounded bg-sky px-1">429</code> al excederlas.</p></Card>
    <Card title="Endpoints" pad={false}><table className="w-full text-[13.5px]"><tbody>{rows.map(([m, p, d]) => <tr key={m + p} className="border-b border-line/70"><td className="w-20 px-4 py-2"><Badge tone={m === 'GET' ? 'Appointment Set' : m === 'POST' ? 'Recall - Short' : m === 'PATCH' ? 'Follow-Up Needed' : 'Switch Setter'}>{m}</Badge></td><td className="font-mono text-[12.5px]">{p}</td><td className="pr-4 text-slate">{d}</td></tr>)}</tbody></table></Card>
    <Card title="Operadores de búsqueda" ><p className="text-[13.5px]"><code>EQ, NEQ, IN, NOT_IN, GT, GTE, LT, LTE, BETWEEN, HAS_PROPERTY, NOT_HAS_PROPERTY, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN</code>. Grupos de filtros: OR entre grupos, AND dentro de cada grupo.</p></Card>
    <Card title="Ejemplo: buscar contactos" action={<Button size="sm" onClick={() => copy(search)}>Copiar</Button>}><pre className="scroll-thin overflow-auto rounded-xl bg-navy-900 p-3 font-mono text-[12px] leading-5 text-[#cfe8ff]">{search}</pre></Card>
    <Card title="Validar la firma de un webhook" action={<Button size="sm" onClick={() => copy(sig)}>Copiar</Button>}><pre className="scroll-thin overflow-auto rounded-xl bg-navy-900 p-3 font-mono text-[12px] leading-5 text-[#cfe8ff]">{sig}</pre></Card>
    <WebhookN8nTemplate />
    <p className="text-[12.5px] text-slate">Nota: hoy la interfaz usa datos de demostración. La API real se conecta en la fase de backend; este contrato es el que se implementará.</p></div>;
}
