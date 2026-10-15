// Desarrollo → Proyectos · Conectores de MCP · Pruebas (réplica del menú de desarrolladores de Nexa).
// Nada de aquí escribe en el CRM: las pruebas llaman a endpoints existentes (webhook de prueba firmado) o a /dev/simulate (modo simulación estricto).
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as be from '../../lib/backend';
import { store, useDbValue } from '../../lib/api';
import { fmtDateTime } from '../../lib/fmt';
import type { AppDef } from '../../lib/types';
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Tabs, Textarea, useCopy, useToast } from '../../components/ui';
import McpCredentialCard, { MCP_MARK, configs, mcpUrl } from './McpCredential';
import { CreateApp } from '../Dev';

const errText = (e: unknown): string => {
  if (e instanceof be.ApiError) {
    const d = (e.detail as any)?.message ?? (e.detail as any)?.detail;
    const m: Record<string, string> = { unauthorized: 'Tu sesión caducó: vuelve a entrar.', forbidden: 'No tienes permiso para esto.', no_target_url: 'Esta aplicación no tiene URL de destino: configúrala en su pestaña Webhooks.', invalid_payload: 'El evento no es válido.', invalid_input: 'Los datos no son válidos.' };
    return (m[e.code] ?? `Error del servidor (${e.code})`) + (typeof d === 'string' && d ? ` — ${d}` : '');
  }
  return e instanceof Error ? e.message : 'Error desconocido';
};
const pretty = (v: unknown, max = 6000) => { const s = typeof v === 'string' ? v : JSON.stringify(v, null, 2); return s.length > max ? s.slice(0, max) + '\n… (recortado)' : s; };
const Pre = ({ children }: { children: string }) => <pre className="max-h-96 overflow-auto rounded-lg bg-canvas p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all">{children}</pre>;
const isMcp = (a: AppDef) => (a.description ?? '').startsWith(MCP_MARK);
const expiry = (a: AppDef): { label: string; tone: string } => {
  if (!a.expiresAt) return { label: 'Sin caducidad', tone: 'Confirmed' };
  const left = new Date(a.expiresAt).getTime() - Date.now();
  return left <= 0 ? { label: 'Caducado', tone: 'Canceled' } : left < 14 * 86400000 ? { label: `Caduca en ${Math.ceil(left / 86400000)} d`, tone: 'Follow-Up Needed' } : { label: 'Activo', tone: 'Confirmed' };
};

/* ================= Proyectos ================= */
export function DevProjects() {
  const apps = useDbValue(() => store.apps(), []); const nav = useNavigate(); const [create, setCreate] = useState(false);
  const stats = useMemo(() => ({ total: apps.length, mcp: apps.filter(isMcp).length, hooks: apps.reduce((n, a) => n + a.subs.filter(s => s.active).length, 0), errs: apps.reduce((n, a) => n + a.subs.reduce((m, s) => m + s.errors, 0), 0) }), [apps]);
  return <div>
    <PageHeader title="Proyectos" sub="Un proyecto agrupa una integración con sus claves, permisos y webhooks: por ejemplo «n8n | Task Creator» o la credencial de una IA." actions={<Button variant="primary" onClick={() => setCreate(true)}>Crear proyecto</Button>} />
    <div className="mb-4 grid gap-3 sm:grid-cols-4">{[['Proyectos', stats.total], ['Credenciales de IA (MCP)', stats.mcp], ['Webhooks activos', stats.hooks], ['Errores de entrega', stats.errs]].map(([l, n]) => <div key={l as string} className="rounded-xl border border-line bg-white p-4"><div className="text-[11.5px] font-bold uppercase tracking-wide text-slate">{l}</div><div className="mt-1 font-display text-[28px] font-bold leading-none text-navy">{n}</div></div>)}</div>
    {apps.length === 0 ? <Empty icon="puzzle" title="Aún no hay proyectos">Crea uno para obtener un token, elegir sus permisos y conectar n8n u otra herramienta.</Empty>
      : <div className="overflow-x-auto rounded-xl border border-line bg-white"><table className="w-full min-w-[760px] text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Proyecto</th><th className="px-3 py-2.5">Tipo</th><th className="px-3 py-2.5">Estado</th><th className="px-3 py-2.5">Permisos</th><th className="px-3 py-2.5">Webhooks</th><th className="px-3 py-2.5">Creado</th><th className="px-3 py-2.5 text-right">Ir a</th></tr></thead>
        <tbody>{apps.map(a => { const e = expiry(a); const on = a.subs.filter(s => s.active).length; const errs = a.subs.reduce((n, s) => n + s.errors, 0); return <tr key={a.id} className="border-b border-line/60 last:border-0 hover:bg-sky/40">
          <td className="px-4 py-2.5"><Link className="font-semibold text-link hover:underline" to={`/developer/apps/${a.id}`}>{a.name}</Link>{a.description && !isMcp(a) && <div className="max-w-xs truncate text-[12px] text-slate">{a.description}</div>}</td>
          <td className="px-3 py-2.5">{isMcp(a) ? <Badge tone="Referral">IA · MCP</Badge> : <Badge>Integración</Badge>}</td>
          <td className="px-3 py-2.5"><Badge tone={e.tone}>{e.label}</Badge></td>
          <td className="px-3 py-2.5 tabular">{a.scopes.length}{a.scopes.some(s => s.endsWith('.delete')) && <span className="ml-1 text-bad" title="Puede borrar">⚠</span>}</td>
          <td className="px-3 py-2.5 tabular">{on}/{a.subs.length}{errs > 0 && <span className="ml-1 text-bad">· {errs} errores</span>}{a.targetUrl ? '' : <span className="ml-1 text-slate">· sin URL</span>}</td>
          <td className="px-3 py-2.5 text-slate">{fmtDateTime(a.createdAt)}</td>
          <td className="px-3 py-2.5 text-right"><Link className="text-link hover:underline" to={`/developer/apps/${a.id}`}>Claves</Link> · <Link className="text-link hover:underline" to={`/developer/apps/${a.id}`}>Webhooks</Link></td></tr>; })}</tbody></table></div>}
    <p className="mt-3 text-[12.5px] text-slate">Para quitar el acceso a un proyecto, ábrelo y elimínalo o rota su token. Probar un token o un webhook: <Link className="text-link hover:underline" to="/developer/tests">Pruebas</Link>.</p>
    {create && <CreateApp onClose={() => setCreate(false)} onCreated={a => { setCreate(false); nav(`/developer/apps/${a.id}`); }} />}
  </div>;
}

/* ================= Conectores de MCP ================= */
type ToolRow = { name: string; description: string; needs: string; writes: boolean; destructive: boolean };
type McpInfo = { server: { name: string; title: string; version: string; protocols: string[] }; tools: ToolRow[] };
export function DevMcp() {
  const copy = useCopy(); const [info, setInfo] = useState<McpInfo | null>(null); const [err, setErr] = useState('');
  useEffect(() => { let alive = true; be.api<McpInfo>('GET', '/dev/mcp/tools').then(r => alive && setInfo(r)).catch(e => alive && setErr(errText(e))); return () => { alive = false; }; }, []);
  const snippets = configs('', '<TU_TOKEN>');
  return <div>
    <PageHeader title="Conectores de MCP" sub="Conecta Claude, Cursor u otra IA al CRM con el protocolo MCP: buscar, leer y (si lo permites) escribir, con permisos acotados y todo auditado." />
    <div className="grid gap-4">
      <Card title="Servidor MCP del CRM">
        <div className="flex flex-wrap items-center gap-2"><code className="rounded bg-sky px-2 py-1 font-mono text-[13px]">{mcpUrl()}</code><Button size="sm" onClick={() => copy(mcpUrl())}>Copiar dirección</Button></div>
        <p className="mt-2 text-[13px] text-slate">Transporte HTTP (JSON-RPC 2.0), sin estado. Solo acepta tokens de aplicación (<code>Authorization: Bearer …</code>); la sesión del navegador no sirve aquí.{info && <> Servidor <b>{info.server.name}</b> v{info.server.version} · protocolos {info.server.protocols.join(', ')}.</>}</p>
      </Card>
      <McpCredentialCard />
      <Card title="Cómo configurarlo en tu cliente" >
        <p className="mb-3 text-[13px] text-slate">Estos bloques llevan <code>&lt;TU_TOKEN&gt;</code> como marcador. Crea la credencial arriba: al terminar te los muestra ya con el token real.</p>
        <div className="space-y-3">{snippets.map(c => <div key={c.title}><div className="mb-1 flex items-center justify-between"><b className="text-[13px] text-navy">{c.title}</b><Button size="sm" onClick={() => copy(c.text)}>Copiar</Button></div><Pre>{c.text}</Pre></div>)}</div>
      </Card>
      <Card title={`Herramientas disponibles${info ? ` (${info.tools.length})` : ''}`}>
        {err ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>
          : !info ? <p className="text-[13px] text-slate">Cargando…</p>
          : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="py-2 pr-3">Herramienta</th><th className="py-2 pr-3">Qué hace</th><th className="py-2 pr-3">Permiso que exige</th><th className="py-2">Tipo</th></tr></thead>
            <tbody>{info.tools.map(t => <tr key={t.name} className="border-b border-line/60 align-top last:border-0"><td className="py-2 pr-3 font-mono text-[12px] text-navy">{t.name}</td><td className="py-2 pr-3">{t.description}</td><td className="py-2 pr-3 font-mono text-[11.5px] text-slate">{t.needs}</td><td className="py-2">{t.destructive ? <Badge tone="Canceled">Borrado</Badge> : t.writes ? <Badge tone="Follow-Up Needed">Escritura</Badge> : <Badge tone="Confirmed">Lectura</Badge>}</td></tr>)}</tbody></table></div>}
        <p className="mt-3 text-[12.5px] text-slate">Una credencial solo ve las herramientas que sus permisos permiten. Para comprobar una credencial: <Link className="text-link hover:underline" to="/developer/tests">Pruebas → Endpoint MCP</Link>.</p>
      </Card>
    </div>
  </div>;
}

/* ================= Pruebas ================= */
type Tab = 'webhook' | 'key' | 'mcp' | 'sim';
export function DevTests() {
  const [tab, setTab] = useState<Tab>('webhook');
  return <div>
    <PageHeader title="Pruebas" sub="Comprueba cada conexión antes de usarla. Ninguna prueba crea ni modifica registros del CRM." />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'webhook', label: 'Webhook firmado' }, { id: 'key', label: 'Probar una clave' }, { id: 'mcp', label: 'Endpoint MCP' }, { id: 'sim', label: 'Simular Dialpad / Meta' }]} />
    <div className="mt-4">{tab === 'webhook' ? <TestWebhook /> : tab === 'key' ? <TestKey /> : tab === 'mcp' ? <TestMcp /> : <TestSim />}</div>
  </div>;
}

const EVENTS = [
  { id: 'contact', label: 'Contacto creado', body: { objectType: 'contacts', event: 'creation' } },
  { id: 'deal', label: 'Cambio de etapa de un negocio', body: { objectType: 'deals', event: 'propertyChange', property: 'dealstage' } },
  { id: 'appt', label: 'Cambio de etapa de una cita', body: { objectType: 'appointments', event: 'propertyChange', property: 'hs_pipeline_stage' } },
  { id: 'call', label: 'Llamada creada', body: { objectType: 'calls', event: 'creation' } },
] as const;
function TestWebhook() {
  const apps = useDbValue(() => store.apps(), []); const toast = useToast();
  const [appId, setAppId] = useState(''); const [ev, setEv] = useState<(typeof EVENTS)[number]['id']>('contact'); const [busy, setBusy] = useState(false); const [res, setRes] = useState<any>(null); const [err, setErr] = useState('');
  const app = apps.find(a => a.id === appId) ?? apps[0]; const e = EVENTS.find(x => x.id === ev)!;
  const send = async () => {
    if (!app) return; setBusy(true); setErr(''); setRes(null);
    try {
      setRes(await be.api('POST', `/dev/apps/${app.id}/webhooks/test`, e.body)); toast('Prueba enviada', 'ok');
    } catch (x) { setErr(errText(x)); } finally { setBusy(false); }
  };
  if (!apps.length) return <Card><Empty icon="puzzle" title="Aún no hay aplicaciones">Crea un proyecto con su URL de destino (por ejemplo el webhook de n8n) para poder probarlo. <Link className="text-link hover:underline" to="/developer/projects">Ir a Proyectos</Link></Empty></Card>;
  return <Card title="Enviar un evento de prueba firmado a la URL de una aplicación">
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Aplicación"><Select value={app?.id ?? ''} onChange={x => setAppId(x.target.value)}>{apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      <Field label="Evento"><Select value={ev} onChange={x => setEv(x.target.value as typeof ev)}>{EVENTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
    </div>
    <p className="mb-3 text-[13px] text-slate">Destino: {app?.targetUrl ? <code className="rounded bg-sky px-1 font-mono text-[12px]">{app.targetUrl}</code> : <span className="text-bad">esta aplicación no tiene URL de destino. Configúrala en <Link className="underline" to={`/developer/apps/${app?.id}`}>su pestaña Webhooks</Link>.</span>}</p>
    <Button variant="primary" onClick={send} disabled={busy || !app?.targetUrl}>{busy ? 'Enviando…' : 'Enviar prueba firmada'}</Button>
    <p className="mt-2 text-[12.5px] text-slate">Se envía con las cabeceras <code>X-CRM-Signature-V3</code> y <code>X-CRM-Request-Timestamp</code> (HMAC-SHA256 con el secreto de la aplicación), igual que los eventos reales. El objeto del evento es de prueba (id 0).</p>
    {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    {res && <div className="mt-3"><p className="mb-2 text-[13.5px]">{res.ok ? <Badge tone="Confirmed">Entregado</Badge> : <Badge tone="Canceled">Falló</Badge>} <span className="ml-2">HTTP {res.status || '—'} · {res.ms} ms</span>{res.simulated && <span className="ml-2 text-slate">(simulado: modo demostración)</span>}{res.error && <span className="ml-2 text-bad">{res.error}</span>}</p><Pre>{pretty(res.event)}</Pre></div>}
  </Card>;
}

function useTimed() { const [busy, setBusy] = useState(false); return { busy, run: async <T,>(fn: () => Promise<T>) => { setBusy(true); const t = performance.now(); try { return { v: await fn(), ms: Math.round(performance.now() - t) }; } finally { setBusy(false); } } }; }
const TokenField = ({ v, set }: { v: string; set: (s: string) => void }) => <Field label="Token de la aplicación" hint="Se usa solo desde tu navegador para esta prueba; no se guarda."><Input type="password" autoComplete="off" value={v} onChange={e => set(e.target.value.trim())} placeholder="pat-crm-…" /></Field>;
const authMsg = (s: number) => s === 401 ? 'Token inválido, caducado o desactivado.' : s === 403 ? 'El token es válido pero no tiene el permiso (scope) necesario, o su IP no está permitida.' : s === 429 ? 'Demasiadas llamadas: espera un momento.' : s >= 500 ? 'Error del servidor.' : '';

const KEY_CALLS = [{ id: 'contacts', label: 'Leer 1 contacto', path: '/objects/contacts?limit=1' }, { id: 'deals', label: 'Leer 1 negocio', path: '/objects/deals?limit=1' }, { id: 'appointments', label: 'Leer 1 cita', path: '/objects/appointments?limit=1' }];
function TestKey() {
  const [token, setToken] = useState(''); const [call, setCall] = useState(KEY_CALLS[0].id); const [out, setOut] = useState<{ status: number; ms: number; body: string } | null>(null); const [err, setErr] = useState(''); const { busy, run } = useTimed();
  const go = async () => {
    setErr(''); setOut(null); const c = KEY_CALLS.find(x => x.id === call)!;
    try {
      const r = await run(async () => { const f = await be.rawFetch(be.BASE + c.path, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); return { status: f.status, body: await f.text() }; });
      let body = r.v.body; try { body = pretty(JSON.parse(body), 3000); } catch { /* texto */ } setOut({ status: r.v.status, ms: r.ms, body });
    } catch (x) { setErr(`No se pudo conectar con la API: ${x instanceof Error ? x.message : 'sin red'}`); }
  };
  return <Card title="Probar una clave (token de aplicación) contra la API">
    <TokenField v={token} set={setToken} />
    <Field label="Llamada de prueba (solo lectura)"><Select value={call} onChange={e => setCall(e.target.value)}>{KEY_CALLS.map(c => <option key={c.id} value={c.id}>{c.label} — GET /api/v1{c.path}</option>)}</Select></Field>
    <Button variant="primary" onClick={go} disabled={busy || token.length < 10}>{busy ? 'Probando…' : 'Probar clave'}</Button>
    {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    {out && <div className="mt-3"><p className="mb-2 text-[13.5px]">{out.status < 300 ? <Badge tone="Confirmed">Funciona</Badge> : <Badge tone="Canceled">No funciona</Badge>} <span className="ml-2">HTTP {out.status} · {out.ms} ms</span>{authMsg(out.status) && <span className="ml-2 text-bad">{authMsg(out.status)}</span>}</p><Pre>{out.body}</Pre></div>}
  </Card>;
}

function TestMcp() {
  const [token, setToken] = useState(''); const [out, setOut] = useState<{ step: string; status: number; ms: number; body: string; summary?: string } | null>(null); const [err, setErr] = useState(''); const { busy, run } = useTimed();
  const rpc = async (step: 'initialize' | 'tools/list') => {
    setErr(''); setOut(null);
    const body = step === 'initialize'
      ? { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'crm-pruebas', version: '1.0.0' } } }
      : { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
    try {
      const r = await run(async () => { const f = await be.rawFetch(mcpUrl(), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }); return { status: f.status, text: await f.text() }; });
      let parsed: any = null; try { parsed = JSON.parse(r.v.text); } catch { /* no JSON */ }
      const tools = parsed?.result?.tools as { name: string }[] | undefined;
      const summary = parsed?.error ? `Error MCP: ${parsed.error.message}` : tools ? `${tools.length} herramientas visibles con este token: ${tools.map(t => t.name).join(', ') || '(ninguna)'}` : parsed?.result?.serverInfo ? `Servidor «${parsed.result.serverInfo.name}» · protocolo ${parsed.result.protocolVersion}` : authMsg(r.v.status);
      setOut({ step, status: r.v.status, ms: r.ms, body: parsed ? pretty(parsed, 5000) : r.v.text.slice(0, 2000), summary });
    } catch (x) { setErr(`No se pudo conectar: ${x instanceof Error ? x.message : 'sin red'}`); }
  };
  return <Card title="Probar el endpoint MCP con un token">
    <p className="mb-3 text-[13px] text-slate">Llama a <code className="rounded bg-sky px-1 font-mono text-[12px]">{mcpUrl()}</code> como lo haría una IA. <b>initialize</b> comprueba el saludo del protocolo; <b>tools/list</b> muestra qué herramientas permite este token. Solo lectura: no ejecuta herramientas.</p>
    <TokenField v={token} set={setToken} />
    <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => rpc('initialize')} disabled={busy || token.length < 10}>Probar initialize</Button><Button onClick={() => rpc('tools/list')} disabled={busy || token.length < 10}>Probar tools/list</Button></div>
    {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    {out && <div className="mt-3"><p className="mb-2 text-[13.5px]">{out.status < 300 && !/Error MCP/.test(out.summary ?? '') ? <Badge tone="Confirmed">Responde</Badge> : <Badge tone="Canceled">Problema</Badge>} <span className="ml-2">{out.step} · HTTP {out.status} · {out.ms} ms</span></p>{out.summary && <p className="mb-2 text-[13px]">{out.summary}</p>}<Pre>{out.body}</Pre></div>}
  </Card>;
}

const sampleDialpad = () => { const t = Date.now(); return { call_id: 5550001234, state: 'hangup', direction: 'outbound', external_number: '+17865550123', internal_number: '+17867584080', date_started: t - 90000, date_connected: t - 80000, date_ended: t, duration: 90000, event_timestamp: t, contact: { name: 'Cliente de Prueba', phone: '+17865550123' }, target: { type: 'user', name: 'Setter de Prueba', email: 'setter@ejemplo.com', office_id: 1 } }; };
const sampleMeta = () => ({ id: '123456789012345', platform: 'fb', is_organic: false, form_id: '999000111', campaign_name: 'Roofing FL', adset_name: 'Conjunto A', ad_name: 'Anuncio 1', field_data: [{ name: 'full_name', values: ['Ana de Prueba'] }, { name: 'email', values: ['ana@ejemplo.com'] }, { name: 'phone_number', values: ['+17865550123'] }] });
function TestSim() {
  const [src, setSrc] = useState<'dialpad' | 'meta'>('dialpad'); const [text, setText] = useState(() => pretty(sampleDialpad())); const [out, setOut] = useState<any>(null); const [err, setErr] = useState(''); const { busy, run } = useTimed();
  const change = (s: 'dialpad' | 'meta') => { setSrc(s); setText(pretty(s === 'dialpad' ? sampleDialpad() : sampleMeta())); setOut(null); setErr(''); };
  const go = async () => {
    setErr(''); setOut(null); let payload: unknown; try { payload = JSON.parse(text); } catch { return setErr('El JSON no es válido: revisa comas y comillas.'); }
    try { setOut((await run(() => be.api('POST', '/dev/simulate', { source: src, payload }))).v); } catch (x) { setErr(errText(x)); }
  };
  const pv = out?.preview as { action: string; properties: Record<string, string>; contactId?: number | null; existingContactId?: number | null; wouldCreateContact?: boolean; extra?: string[]; contactTimestamp?: Record<string, string> } | null | undefined;
  return <Card title="Simular un evento de Dialpad o un lead de Meta (no escribe nada)">
    <p className="mb-3 text-[13px] text-slate">Pega el evento tal como lo manda la plataforma y mira <b>qué registro se crearía</b> en el CRM. El servidor solo lee (busca si el contacto o la llamada ya existen) y no guarda ni llama a servicios externos.</p>
    <div className="mb-3 max-w-xs"><Field label="Origen"><Select value={src} onChange={e => change(e.target.value as 'dialpad' | 'meta')}><option value="dialpad">Dialpad — evento de llamada (webhook)</option><option value="meta">Meta — lead de formulario (respuesta de Graph)</option></Select></Field></div>
    <Field label="Evento (JSON)"><Textarea rows={12} spellCheck={false} className="font-mono text-[12px]" value={text} onChange={e => setText(e.target.value)} /></Field>
    <div className="flex gap-2"><Button variant="primary" onClick={go} disabled={busy}>{busy ? 'Simulando…' : 'Simular'}</Button><Button onClick={() => change(src)}>Restaurar ejemplo</Button></div>
    {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    {out && <div className="mt-4">
      <p className="mb-2 text-[13.5px]"><Badge tone="Referral">Simulación</Badge> <span className="ml-2">{out.object === 'calls' ? 'Llamada' : 'Contacto'}</span>{pv && <span className="ml-2">· se <b>{pv.action === 'create' ? 'crearía' : 'actualizaría'}</b></span>}</p>
      {out.error && <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{out.error}</p>}
      {out.note && !pv && <p className="mb-2 text-[13px] text-slate">{out.note}</p>}
      {pv && <>
        <p className="mb-2 text-[13px] text-slate">{out.object === 'calls' ? (pv.contactId ? <>Se asociaría al contacto <b>{pv.contactId}</b> (por teléfono).</> : pv.wouldCreateContact ? 'No hay contacto con ese teléfono: se crearía uno nuevo.' : 'No hay contacto con ese teléfono: la llamada quedaría sin contacto asociado.') : (pv.existingContactId ? <>Ya existe un contacto con ese teléfono (<b>{pv.existingContactId}</b>): se actualizaría.</> : 'No existe un contacto con ese teléfono: se crearía uno nuevo.')}</p>
        <div className="overflow-x-auto rounded-xl border border-line bg-white"><table className="w-full text-[13px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-3 py-2">Propiedad</th><th className="px-3 py-2">Valor que se guardaría</th></tr></thead><tbody>{Object.entries(pv.properties).map(([k, v]) => <tr key={k} className="border-b border-line/60 last:border-0"><td className="px-3 py-1.5 font-mono text-[12px] text-navy">{k}</td><td className="break-all px-3 py-1.5">{v}</td></tr>)}</tbody></table></div>
        {pv.extra && pv.extra.length > 0 && <p className="mt-2 text-[12.5px] text-slate">Campos sin propiedad equivalente (irían al resumen del envío): {pv.extra.join(' · ')}</p>}
        {pv.contactTimestamp && <p className="mt-2 text-[12.5px] text-slate">También actualizaría en el contacto: {Object.entries(pv.contactTimestamp).map(([k, v]) => `${k} = ${v}`).join(', ')}</p>}
      </>}
    </div>}
  </Card>;
}
