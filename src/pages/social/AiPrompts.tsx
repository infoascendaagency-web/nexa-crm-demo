// «IA y prompts»: prompt general con la información de la empresa, prompt y modo por plataforma, interruptor «Guardar como lead»,
// fuentes de conocimiento (carpetas de Google Drive que n8n lee cada día) y conexión con n8n. Nada responde por sí solo hasta conectar las redes y activar n8n.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/backend';
import { Badge, Button, Card, Empty, Field, Input, Select, Spinner, Switch, Textarea, useToast } from '../../components/ui';
import { PLATFORMS, when, type Platform } from './shared';

type PlatformAi = { prompt: string; replyMode: 'off' | 'draft' | 'auto'; saveAsLead: boolean };
type Settings = { general: { prompt: string }; platforms: Record<Platform, PlatformAi>; n8n: { appId: number | null; enabled: boolean }; n8nApps: { id: number; name: string; hasTargetUrl: boolean; active: boolean }[] };
type Source = { id: number; kind: string; url: string; label: string; platforms: Platform[]; enabled: boolean; status: string; lastSyncAt: string | null; lastError: string | null; docCount: number };
type Ev = { id: number; conversationId: number; status: string; note: string; simulated: boolean; createdAt: string };
const MODES = [{ id: 'off', label: 'Desactivada' }, { id: 'draft', label: 'Borrador para aprobar' }, { id: 'auto', label: 'Automática (vía n8n)' }] as const;
const SRC_STATUS: Record<string, { label: string; tone?: string }> = { pending: { label: 'Sin sincronizar' }, queued: { label: 'En cola', tone: 'Referral' }, syncing: { label: 'Sincronizando…', tone: 'Referral' }, ok: { label: 'Al día', tone: 'Sale' }, error: { label: 'Error', tone: 'Canceled' } };
const errText = (e: unknown) => (e instanceof ApiError && e.status === 403 ? 'Solo un administrador puede cambiar esto' : 'No se pudo guardar');

function PlatformCard({ p, v, onSave }: { p: (typeof PLATFORMS)[number]; v: PlatformAi; onSave: (patch: Partial<PlatformAi>) => Promise<void> }) {
  const [d, setD] = useState(v); const [busy, setBusy] = useState(false);
  useEffect(() => setD(v), [v.prompt, v.replyMode, v.saveAsLead]); // eslint-disable-line
  const dirty = d.prompt !== v.prompt || d.replyMode !== v.replyMode || d.saveAsLead !== v.saveAsLead;
  return <Card title={<span className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold text-white ${p.tone}`}>{p.short}</span>{p.label}</span>}>
    <Field label="Prompt de esta plataforma" hint="Tono y reglas propias de la red (largo de las respuestas, emojis, qué pedir primero…). Se suma al prompt general."><Textarea rows={4} value={d.prompt} onChange={e => setD({ ...d, prompt: e.target.value })} placeholder={p.id === 'tiktok' ? 'Ej. Respuestas muy cortas y casuales; pide el teléfono para llamar.' : 'Ej. Tono cercano, 2 frases, pregunta qué servicio necesita.'} /></Field>
    <Field label="Cuándo responde la IA"><Select value={d.replyMode} onChange={e => setD({ ...d, replyMode: e.target.value as PlatformAi['replyMode'] })}>{MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
    <Switch on={d.saveAsLead} onChange={x => setD({ ...d, saveAsLead: x })} label="Guardar como lead en el CRM a todo el que escriba por mensaje directo" />
    <p className="mt-1 text-[12px] text-slate">{d.saveAsLead ? 'Se crea (o reutiliza) el contacto y se completa con lo que la persona vaya dando: nombre, teléfono, email e interés.' : 'Apagado: las conversaciones se ven en la bandeja, pero no crean contactos solos.'}</p>
    <div className="mt-3 flex justify-end"><Button variant="primary" disabled={!dirty || busy} onClick={async () => { setBusy(true); await onSave(d).finally(() => setBusy(false)); }}>Guardar {p.label}</Button></div>
  </Card>;
}

export default function AiPrompts() {
  const toast = useToast(); const [s, setS] = useState<Settings | null>(null); const [general, setGeneral] = useState(''); const [src, setSrc] = useState<Source[] | null>(null); const [ev, setEv] = useState<Ev[]>([]);
  const [n8n, setN8n] = useState<{ appId: string; enabled: boolean }>({ appId: '', enabled: false }); const [ns, setNs] = useState({ url: '', label: '', platforms: [] as Platform[] });
  const load = useCallback(() => {
    api<Settings>('GET', '/social/ai/settings').then(r => { setS(r); setGeneral(r.general.prompt); setN8n({ appId: r.n8n.appId ? String(r.n8n.appId) : '', enabled: r.n8n.enabled }); }).catch(() => toast('No se pudieron cargar los ajustes', 'err'));
    api<{ results: Source[] }>('GET', '/social/ai/sources').then(r => setSrc(r.results)).catch(() => setSrc([]));
    api<{ results: Ev[] }>('GET', '/social/events?limit=8').then(r => setEv(r.results)).catch(() => {});
  }, [toast]);
  useEffect(load, [load]);
  const put = async (body: unknown, ok = 'Guardado') => { try { await api('PUT', '/social/ai/settings', body); toast(ok); load(); } catch (e) { toast(errText(e), 'err'); throw e; } };
  if (!s) return <div className="grid place-items-center p-10"><Spinner /></div>;
  const toggleP = (pl: Platform) => setNs(x => ({ ...x, platforms: x.platforms.includes(pl) ? x.platforms.filter(i => i !== pl) : [...x.platforms, pl] }));
  const addSource = async () => { try { await api('POST', '/social/ai/sources', { url: ns.url.trim(), label: ns.label.trim(), platforms: ns.platforms }); setNs({ url: '', label: '', platforms: [] }); toast('Fuente agregada'); load(); } catch (e) { toast(e instanceof ApiError && e.code === 'duplicate_url' ? 'Esa carpeta ya está en la lista' : e instanceof ApiError && e.status === 400 ? 'Pega un enlace https válido (por ejemplo, de una carpeta de Google Drive)' : errText(e), 'err'); } };
  const srcAct = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); load(); } catch (e) { toast(errText(e), 'err'); } };

  return <div className="space-y-4">
    <div role="note" className="flex items-start gap-2.5 rounded-lg border border-line bg-sky px-3.5 py-2.5 text-[13px] text-navy"><span><b>Cómo funciona.</b> Cada mensaje que entra pasa por el CRM: se guarda, se crea el lead si lo activas y, si la plataforma tiene IA, el CRM avisa a n8n con los prompts y el conocimiento. n8n genera la respuesta y la devuelve al CRM (como borrador o enviada). Mientras las redes no estén conectadas, todo se puede probar con el simulador de la pestaña <b>Cuentas</b>.</span></div>

    <Card title="Prompt general de la empresa" action={<Button variant="primary" disabled={general === s.general.prompt} onClick={() => put({ general: { prompt: general } })}>Guardar</Button>}>
      <p className="mb-2 text-[13px] text-slate">Quiénes son, qué venden, zonas, precios orientativos, horarios, qué NO deben prometer y cómo escalar a una persona. Es la base de todas las plataformas.</p>
      <Textarea aria-label="Prompt general" rows={7} value={general} onChange={e => setGeneral(e.target.value)} placeholder="Somos Nexa Home: remodelación de techos, ventanas, cocinas y baños en Florida y California…" />
    </Card>

    <div className="grid gap-4 lg:grid-cols-2">{PLATFORMS.map(p => <PlatformCard key={p.id} p={p} v={s.platforms[p.id]} onSave={patch => put({ platforms: { [p.id]: patch } }, `${p.label} guardado`)} />)}</div>

    <Card title="Conocimiento: carpetas de Drive" action={<span className="text-[12px] text-slate">n8n las lee cada día y actualiza la memoria de la IA</span>}>
      {!src ? <Spinner /> : !src.length ? <Empty icon="folder" title="Sin fuentes">Agrega un enlace a una carpeta de Google Drive (catálogo, preguntas frecuentes, precios). El flujo diario de n8n la lee y la IA responde con esa información.</Empty>
        : <ul className="divide-y divide-line/70">{src.map(x => <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold text-navy">{x.label || x.url}</div><div className="truncate text-[12px] text-slate">{x.url}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-slate"><Badge tone={SRC_STATUS[x.status]?.tone}>{SRC_STATUS[x.status]?.label ?? x.status}</Badge><span>{x.lastSyncAt ? `Última sincronización: ${when(x.lastSyncAt)} · ${x.docCount} documentos` : 'Nunca sincronizada'}</span><span>· {x.platforms.length ? x.platforms.map(p => PLATFORMS.find(i => i.id === p)?.label).join(', ') : 'Todas las plataformas'}</span>{x.lastError && <span className="text-bad">· {x.lastError}</span>}</div></div>
          <Switch on={x.enabled} onChange={v => srcAct(() => api('PATCH', `/social/ai/sources/${x.id}`, { enabled: v }), v ? 'Fuente activada' : 'Fuente desactivada')} label={x.enabled ? 'Activa' : 'Pausada'} />
          <Button onClick={() => srcAct(() => api('POST', `/social/ai/sources/${x.id}/sync`, {}), 'Sincronización en cola: la procesa el flujo de n8n')}>Sincronizar ahora</Button>
          <Button onClick={() => { if (window.confirm('¿Quitar esta fuente de la lista?')) void srcAct(() => api('DELETE', `/social/ai/sources/${x.id}`), 'Fuente eliminada'); }}>Quitar</Button></li>)}</ul>}
      <div className="mt-3 rounded-lg border border-line p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_14rem]"><Field label="Enlace de la carpeta o documento"><Input value={ns.url} onChange={e => setNs({ ...ns, url: e.target.value })} placeholder="https://drive.google.com/drive/folders/…" /></Field><Field label="Nombre"><Input value={ns.label} onChange={e => setNs({ ...ns, label: e.target.value })} placeholder="Catálogo y precios" /></Field></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]"><span className="text-slate">Aplica a:</span>{PLATFORMS.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={ns.platforms.includes(p.id)} onChange={() => toggleP(p.id)} />{p.label}</label>)}<span className="text-[12px] text-slate">{ns.platforms.length ? '' : '(sin marcar = todas)'}</span>
          <Button className="ml-auto" variant="primary" disabled={!ns.url.trim()} onClick={addSource}>Agregar fuente</Button></div>
        <p className="mt-2 text-[12px] text-slate">La carpeta debe estar compartida con la cuenta de Google que usa n8n. El CRM no lee el contenido: solo guarda el enlace y el estado.</p>
      </div>
    </Card>

    <Card title="Conexión con n8n" action={<Button variant="primary" disabled={n8n.appId === (s.n8n.appId ? String(s.n8n.appId) : '') && n8n.enabled === s.n8n.enabled} onClick={() => put({ n8n: { appId: n8n.appId ? Number(n8n.appId) : null, enabled: n8n.enabled && !!n8n.appId } }, 'Conexión guardada')}>Guardar</Button>}>
      <p className="mb-2 text-[13px] text-slate">Elige la app del CRM que representa a n8n (<Link to="/developer/apps" className="font-semibold text-link hover:underline">Desarrollo → Proyectos</Link>): su URL de destino recibe los mensajes firmados, y su token con permisos <code>social.read</code> y <code>social.write</code> permite que n8n devuelva la respuesta y los datos del lead.</p>
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end"><Field label="App de n8n"><Select value={n8n.appId} onChange={e => setN8n({ ...n8n, appId: e.target.value })}><option value="">— sin elegir —</option>{s.n8nApps.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}{a.hasTargetUrl ? '' : ' (sin URL de destino)'}</option>)}</Select></Field>
        <div className="mb-3"><Switch on={n8n.enabled} onChange={v => setN8n({ ...n8n, enabled: v })} label="Enviar mensajes a n8n" /></div></div>
      <div className="mt-1 text-[12px] font-bold uppercase tracking-wide text-slate">Últimos eventos</div>
      {!ev.length ? <p className="mt-1 text-[13px] text-slate">Todavía no se ha enviado ningún evento.</p> : <ul className="mt-1 divide-y divide-line/70 text-[13px]">{ev.map(e => <li key={e.id} className="flex flex-wrap items-center gap-2 py-1.5"><Badge tone={e.status === 'queued' ? 'Sale' : undefined}>{e.status === 'queued' ? 'Enviado a n8n' : 'No enviado'}</Badge><span>conversación #{e.conversationId}</span>{e.simulated && <Badge tone="Canceled">Simulado</Badge>}<span className="text-slate">{e.note}</span><span className="ml-auto text-[12px] text-slate">{when(e.createdAt)}</span></li>)}</ul>}
    </Card>
  </div>;
}
