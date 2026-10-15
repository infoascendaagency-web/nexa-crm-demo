// Credencial para IA (MCP): crea una app privada con permisos acotados y muestra el bloque de configuración listo para pegar
// en Claude Code / Claude Desktop. El servidor MCP vive en POST /api/v1/mcp y solo acepta tokens de app (backend/src/routes/mcp.ts).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { store, useDbValue } from '../../lib/api';
import { SCOPES } from '../../lib/schema';
import type { AppDef } from '../../lib/types';
import { fmtDateTime } from '../../lib/fmt';
import { Button, Card, Checkbox, Field, Input, Modal, Select, useCopy } from '../../components/ui';

export const MCP_MARK = '[MCP]';
const allScopes = SCOPES.flatMap(g => g.scopes);
const OBJECTS = [...new Set(allScopes.map(s => /^crm\.objects\.([a-z_]+)\.read$/.exec(s)?.[1]).filter((x): x is string => !!x && x !== 'owners'))];
const LEVELS = { read: 'Solo lectura (buscar y leer)', write: 'Lectura y escritura (crear, editar, notas) — sin borrar' } as const;
type Level = keyof typeof LEVELS;
/** Scopes de cada nivel. Nunca incluye `.delete`: borrar se concede aparte, a mano, desde la aplicación. */
export const mcpScopes = (level: Level, objs: string[]) => allScopes.filter(s => {
  const m = /^crm\.(objects|schemas)\.([a-z_]+)\.(read|write)$/.exec(s); if (!m) return false;
  const [, kind, o, rw] = m;
  if (o === 'owners') return rw === 'read';
  if (!objs.includes(o)) return false;
  return rw === 'read' || (level === 'write' && kind === 'objects');
});
export const mcpUrl = () => `${location.origin}/api/v1/mcp`;
export const configs = (name: string, token: string) => {
  const url = mcpUrl(), id = 'nx-crm';
  return [
    { title: 'Claude Code (comando)', text: `claude mcp add --transport http ${id} ${url} --header "Authorization: Bearer ${token}"` },
    { title: 'Claude Code / Cursor (.mcp.json)', text: JSON.stringify({ mcpServers: { [id]: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2) },
    { title: 'Claude Desktop (claude_desktop_config.json)', text: JSON.stringify({ mcpServers: { [id]: { command: 'npx', args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${CRM_AUTH}'], env: { CRM_AUTH: `Bearer ${token}` } } } }, null, 2) },
    { title: 'ChatGPT y otros clientes MCP (URL + cabecera)', text: `URL del servidor MCP: ${url}\nTransporte: HTTP (Streamable HTTP, JSON-RPC 2.0)\nCabecera: Authorization: Bearer ${token}\n(Si el cliente solo admite OAuth, usa n8n o un puente mcp-remote.)` },
  ].map(c => ({ ...c, name }));
};

function CreateMcp({ onClose }: { onClose: () => void }) {
  const copy = useCopy();
  const [name, setName] = useState(''); const [level, setLevel] = useState<Level>('read'); const [days, setDays] = useState('90'); const [cidrs, setCidrs] = useState('');
  const [objs, setObjs] = useState<string[]>(OBJECTS); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [made, setMade] = useState<AppDef | null>(null);
  const create = () => {
    if (!name.trim()) return setErr('Ponle un nombre (por ejemplo: «Claude de Dani»).');
    if (!objs.length) return setErr('Elige al menos un tipo de registro.');
    setErr(''); setBusy(true);
    store.createAppAsync(`MCP · ${name.trim()}`, `${MCP_MARK} Credencial para IA (${level === 'read' ? 'solo lectura' : 'lectura y escritura'})`, mcpScopes(level, objs), { expiresInDays: Number(days), allowedCidrs: cidrs.split(/[\s,]+/).map(x => x.trim()).filter(Boolean), maxRowsPerDay: 20000 })
      .then(a => setMade(a), e => { setBusy(false); setErr(String(e?.message ?? 'No se pudo crear la credencial')); });
  };
  if (made) return <Modal title="Credencial creada" width="max-w-3xl" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Listo</Button>}>
    <p role="alert" className="mb-3 rounded-lg bg-[#FFF8E1] px-3 py-2 text-[13px] font-medium">Copia la configuración ahora y guárdala en un lugar seguro: quien tenga este token puede hacer lo que permiten los permisos. Más adelante solo se puede volver a ver pidiendo tu contraseña (Aplicaciones → la credencial).</p>
    <div className="space-y-3">{configs(made.name, made.token).map(c => <div key={c.title}><div className="mb-1 flex items-center justify-between"><b className="text-[13px] text-navy">{c.title}</b><Button size="sm" onClick={() => copy(c.text)}>Copiar</Button></div><pre className="overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all">{c.text}</pre></div>)}</div>
    <p className="mt-3 text-[12.5px] text-slate">Permisos: {made.scopes.length} · Caduca: {made.expiresAt ? fmtDateTime(made.expiresAt) : 'sin caducidad'} · Para quitar el acceso, elimina o rota la credencial en Aplicaciones.</p>
  </Modal>;
  return <Modal title="Crear credencial para IA (MCP)" width="max-w-2xl" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={create}>{busy ? 'Creando…' : 'Crear credencial'}</Button></>}>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    <Field label="¿Para quién o qué es?"><Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ej.: Claude de Dani" /></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nivel de acceso"><Select value={level} onChange={e => setLevel(e.target.value as Level)}>{(Object.keys(LEVELS) as Level[]).map(k => <option key={k} value={k}>{LEVELS[k]}</option>)}</Select></Field>
      <Field label="Caducidad"><Select value={days} onChange={e => setDays(e.target.value)}>{[['30', '30 días'], ['90', '90 días (recomendado)'], ['180', '180 días'], ['365', '1 año']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field></div>
    <Field label="IPs permitidas (opcional)" hint="Si la IA corre desde una IP fija, ponla aquí; si no, déjalo vacío."><Input value={cidrs} onChange={e => setCidrs(e.target.value)} placeholder="Cualquier IP" /></Field>
    <h3 className="mb-1 font-display text-[14px] font-bold text-navy">Qué registros puede tocar</h3>
    <div className="mb-1"><Checkbox label="Todos" checked={objs.length === OBJECTS.length} onChange={c => setObjs(c ? OBJECTS : [])} /></div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">{OBJECTS.map(o => <Checkbox key={o} label={o} checked={objs.includes(o)} onChange={c => setObjs(c ? [...objs, o] : objs.filter(x => x !== o))} />)}</div>
    <p className="mt-3 text-[12.5px] text-slate">Esta credencial nunca puede borrar registros. Si algún día hace falta, se concede a mano en Aplicaciones → Permisos (<code>.delete</code>).</p>
  </Modal>;
}

export default function McpCredentialCard() {
  const apps = useDbValue(() => store.apps(), []); const [open, setOpen] = useState(false);
  const mine = apps.filter(a => (a.description ?? '').startsWith(MCP_MARK));
  return <Card title="Credenciales para IA (MCP)">
    <p className="mb-3 text-[13.5px] text-slate">Conecta Claude u otra IA al CRM por MCP para buscar, leer y (si lo permites) actualizar registros y crear notas, con permisos acotados y todo auditado. Cada credencial es una aplicación privada que puedes rotar o eliminar.</p>
    <p className="mb-3 text-[12.5px] text-slate">Dirección del servidor MCP: <code className="rounded bg-sky px-1 font-mono text-[12px]">{mcpUrl()}</code></p>
    {mine.length > 0 && <ul className="mb-3 divide-y divide-line rounded-lg border border-line text-[13.5px]">{mine.map(a => <li key={a.id} className="flex items-center justify-between px-3 py-2"><span><b>{a.name}</b> <span className="text-slate">· {a.scopes.some(s => s.endsWith('.write')) ? 'lectura y escritura' : 'solo lectura'}{a.scopes.some(s => s.endsWith('.delete')) ? ' + borrado' : ''}</span></span><Link className="font-semibold text-link hover:underline" to={`/developer/apps/${a.id}`}>Administrar</Link></li>)}</ul>}
    <Button onClick={() => setOpen(true)}>Crear credencial para IA (MCP)</Button>
    {open && <CreateMcp onClose={() => setOpen(false)} />}
  </Card>;
}
