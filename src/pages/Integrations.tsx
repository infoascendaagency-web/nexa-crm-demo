import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Badge, Button, Checkbox, Drawer, Field, Input, PageHeader, Select, Switch, useToast } from '../components/ui';
import { useAccess } from '../lib/perms';
import { api } from '../lib/backend';
import { store } from '../lib/api';
import { useEffect } from 'react';

// Estado de integraciones. DEMO: localStorage (solo datos NO secretos + últimos 4 del token).
// CONECTADO: PUT /api/v1/integrations/<id> con el secreto; el servidor lo guarda cifrado y nunca lo devuelve.
type Cfg = Record<string, string | boolean | string[]>;
type State = Record<string, { connected: boolean; cfg: Cfg }>;
const KEY = 'nx-integrations-v1';
const load = (): State => { try { return JSON.parse(localStorage.getItem(KEY) ?? '') as State; } catch { return {}; } };

import { BrandLogo, hasLogo } from '../components/BrandLogos';
const LOGO: Record<string, string> = { meta: 'meta', google: 'googleads', calendar: 'googlecalendar', gmail: 'gmail', n8n: 'n8n', telegram: 'telegram' };
const mark = (i: { id: string; letter: string }) => (LOGO[i.id] && hasLogo(LOGO[i.id]) ? <BrandLogo id={LOGO[i.id]} className="h-[22px] w-[22px]" /> : i.letter);

type Item = { id: string; name: string; cat: string; desc: string; tone: string; letter: string; extra?: string };
const ITEMS: Item[] = [
  { id: 'meta', name: 'Meta Ads — Lead Ads + API de Conversiones', cat: 'Publicidad', desc: 'Prepara la recepción de leads de formularios nativos y el envío de eventos de conversión (cita, venta) a Meta. No se activa nada por sí solo.', tone: 'bg-[#0866FF]', letter: 'M' },
  { id: 'google', name: 'Google Ads — conversiones offline', cat: 'Publicidad', desc: 'Sube a Google Ads las citas y ventas con el GCLID para optimizar por resultados reales.', tone: 'bg-[#34A853]', letter: 'G' },
  { id: 'dialpad', name: 'Dialpad', cat: 'Llamadas y SMS', desc: 'Registra cada llamada con resumen IA, grabación y duración. Los setters llaman desde el CRM.', tone: 'bg-gradient-to-br from-[#7C52FF] to-[#E04FD8]', letter: 'd' },
  { id: 'n8n', name: 'n8n', cat: 'Automatización', desc: 'Tus flujos actuales siguen en n8n. Aquí se prepara el envío de webhooks firmados del CRM hacia n8n, sin tocar los flujos existentes.', tone: 'bg-[#EA4B71]', letter: 'n' },
  { id: 'calendar', name: 'Google Calendar', cat: 'Calendario', desc: 'Sincroniza las citas de cada usuario con su calendario y evita dobles reservas.', tone: 'bg-[#4285F4]', letter: 'C' },
  { id: 'gmail', name: 'Gmail', cat: 'Correo', desc: 'Registra en la ficha los correos con clientes y envía desde el CRM con tu dirección.', tone: 'bg-[#EA4335]', letter: 'G' },
  { id: 'telegram', name: 'Telegram', cat: 'Alertas', desc: 'Alertas diarias de pacing y embudo hacia el canal del equipo.', tone: 'bg-[#229ED9]', letter: 'T' },
];
const META_EVENTS: [string, string, string][] = [['Lead', 'Contacto creado', 'Se envía cuando entra un contacto nuevo.'], ['Contact', 'Primer contacto exitoso', 'Cuando el setter logra hablar con el lead.'], ['Schedule', 'Cita agendada', 'Cuando se crea o se confirma una cita.'], ['SubmitApplication', 'Contrato firmado', 'Cuando el negocio pasa a Contract Signed.'], ['Purchase', 'Venta / pago recibido', 'Cuando el negocio llega a Payment Received (con valor).']];
const isId = (v: unknown, min = 10, max = 20) => typeof v === 'string' && new RegExp(`^\\d{${min},${max}}$`).test(v.trim());

function Row({ label, children }: { label: string; children: ReactNode }) { return <div className="mb-3">{children}<span className="sr-only">{label}</span></div>; }

function MetaConfig({ st, onSave, onClose }: { st?: State[string]; onSave: (connected: boolean, cfg: Cfg) => void; onClose: () => void }) {
  const toast = useToast(); const c = st?.cfg ?? {};
  const [token, setToken] = useState(''); const [pixel, setPixel] = useState((c.pixel as string) ?? ''); const [page, setPage] = useState((c.page as string) ?? ''); const [acct, setAcct] = useState((c.acct as string) ?? ''); const [test, setTest] = useState((c.test as string) ?? '');
  const [events, setEvents] = useState<string[]>((c.events as string[]) ?? ['Lead', 'Schedule', 'Purchase']); const [leadAds, setLeadAds] = useState(c.leadAds !== false); const [err, setErr] = useState<Record<string, string>>({});
  const last4 = (c.tokenLast4 as string) ?? '';
  const validate = () => { const e: Record<string, string> = {}; if (!token && !last4) e.token = 'Pega el token de acceso.'; else if (token && token.length < 40) e.token = 'El token parece demasiado corto.'; if (!isId(pixel, 14, 17)) e.pixel = 'El ID del dataset/píxel tiene 15–16 dígitos.'; if (leadAds && !isId(page)) e.page = 'El ID de la página son solo números.'; if (acct && !/^(act_)?\d{6,20}$/.test(acct.trim())) e.acct = 'Formato: act_1234567890.'; if (!events.length) e.events = 'Elige al menos un evento.'; setErr(e); return !Object.keys(e).length; };
  const save = () => { if (!validate()) return; onSave(true, { pixel: pixel.trim(), page: page.trim(), acct: acct.trim(), test: test.trim(), events, leadAds, tokenLast4: token ? token.slice(-4) : last4 }); toast('Meta guardado en modo prueba. No se envía nada a Meta hasta que actives el envío.'); onClose(); };
  const fe = (k: string) => err[k] && <span role="alert" className="mt-1 block text-xs text-bad">{err[k]}</span>;
  return <Drawer title="Meta Ads" onClose={onClose} width="w-[560px]" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save}>Guardar configuración</Button></>}>
    <p className="mb-4 text-[13.5px] text-slate">Conecta tu cuenta de Meta con un token de acceso del sistema (Business Manager → Usuarios del sistema). Necesita los permisos <code className="rounded bg-sky px-1">ads_management</code>, <code className="rounded bg-sky px-1">leads_retrieval</code> y <code className="rounded bg-sky px-1">pages_manage_metadata</code>.</p>
    <Field label="Token de acceso"><Input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e => setToken(e.target.value)} placeholder={last4 ? `Guardado · termina en ${last4} (pega uno nuevo para cambiarlo)` : 'EAAB…'} aria-invalid={!!err.token} />{fe('token')}</Field>
    <div className="grid gap-x-3 sm:grid-cols-2"><Field label="ID del dataset / píxel (CAPI)"><Input inputMode="numeric" value={pixel} onChange={e => setPixel(e.target.value)} placeholder="1234567890123456" aria-invalid={!!err.pixel} />{fe('pixel')}</Field><Field label="ID de la página de Facebook"><Input inputMode="numeric" value={page} onChange={e => setPage(e.target.value)} placeholder="1029384756" aria-invalid={!!err.page} />{fe('page')}</Field>
      <Field label="Cuenta publicitaria (opcional)"><Input value={acct} onChange={e => setAcct(e.target.value)} placeholder="act_1943162763159967" />{fe('acct')}</Field><Field label="Código de evento de prueba (opcional)"><Input value={test} onChange={e => setTest(e.target.value)} placeholder="TEST12345" /></Field></div>
    <div className="mb-4 flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span><span className="block text-[13.5px] font-semibold">Recibir leads de Lead Ads</span><span className="block text-xs text-slate">Cada formulario nativo crea un contacto con su campaña, anuncio y UTM.</span></span><Switch on={leadAds} onChange={setLeadAds} label="Recibir leads de Lead Ads" /></div>
    <h3 className="mb-1 font-display text-[14px] font-bold text-navy">Eventos que se envían a Meta (CAPI)</h3>{fe('events')}
    <ul className="mt-1 divide-y divide-line rounded-xl border border-line">{META_EVENTS.map(([ev, when, hint]) => <li key={ev} className="px-3 py-2.5"><Checkbox checked={events.includes(ev)} onChange={on => setEvents(s => (on ? [...s, ev] : s.filter(x => x !== ev)))} label={`${ev} — ${when}`} /><p className="ml-6 text-xs text-slate">{hint}</p></li>)}</ul>
    <p className="mt-3 text-xs text-slate">Los eventos se envían desde el servidor con el email y teléfono en hash (SHA-256) y el <i>fbc/fbp</i> del contacto. Nunca se envía a Meta información que el contacto no haya dado.</p>
  </Drawer>;
}

function SimpleConfig({ item, st, fields, onSave, onClose, children }: { item: Item; st?: State[string]; fields: { k: string; label: string; ph?: string; type?: string }[]; onSave: (c: boolean, cfg: Cfg) => void; onClose: () => void; children?: ReactNode }) {
  const toast = useToast(); const [v, setV] = useState<Record<string, string>>(Object.fromEntries(fields.map(f => [f.k, ((st?.cfg[f.k] as string) ?? '')])));
  return <Drawer title={item.name} onClose={onClose} width="w-[520px]" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => { const cfg: Cfg = {}; fields.forEach(f => { if (f.type !== 'password') cfg[f.k] = v[f.k]; else if (v[f.k]) cfg[`${f.k}Last4`] = v[f.k].slice(-4); }); onSave(true, { ...st?.cfg, ...cfg }); toast(`${item.name} guardado`); onClose(); }}>Guardar</Button></>}>
    <p className="mb-4 text-[13.5px] text-slate">{item.desc}</p>{fields.map(f => <Field key={f.k} label={f.label}><Input type={f.type} autoComplete="off" value={v[f.k]} onChange={e => setV(s => ({ ...s, [f.k]: e.target.value }))} placeholder={f.ph} /></Field>)}{children}</Drawer>;
}

function IntegrationsDemo() {
  const toast = useToast(); const acc = useAccess(); const [state, setState] = useState<State>(load); const [open, setOpen] = useState<string | null>(null); const [q, setQ] = useState(''); const [cat, setCat] = useState('Todas');
  const put = (id: string, connected: boolean, cfg: Cfg) => setState(s => { const n = { ...s, [id]: { connected, cfg } }; try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* */ } return n; });
  const cats = ['Todas', ...Array.from(new Set(ITEMS.map(i => i.cat)))]; const list = ITEMS.filter(i => (cat === 'Todas' || i.cat === cat) && (i.name + i.desc).toLowerCase().includes(q.toLowerCase()));
  const it = ITEMS.find(i => i.id === open); const st = open ? state[open] : undefined; const done = (c: boolean, cfg: Cfg) => open && put(open, c, cfg);
  return <div>
    <PageHeader title="Integraciones" sub="Prepara las conexiones del CRM con anuncios, llamadas y automatizaciones. Todas arrancan desconectadas y en modo prueba." actions={<Link to="/developer/apps"><Button>Aplicaciones privadas y API</Button></Link>} />
    <div role="note" className="mb-4 flex items-start gap-2.5 rounded-lg border border-line bg-sky px-3.5 py-2.5 text-[13px] text-navy"><Icon n="info" s={16} className="mt-0.5 shrink-0" /><span>Este CRM funciona <b>en paralelo</b> a tus sistemas actuales. Configurar una integración aquí no cambia nada en Nexa, n8n, Meta, Google ni Dialpad; pasar a producción es una decisión posterior. Los secretos nunca se guardan en el navegador.</span></div>
    <div className="mb-4 flex flex-wrap items-center gap-2"><div className="relative w-full sm:w-64"><Icon n="search" s={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar integraciones" aria-label="Buscar integraciones" className="h-9 w-full rounded-full border border-line-2 bg-white pl-8 pr-3 text-sm placeholder:text-mute focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></div>
      <div role="group" aria-label="Categoría" className="flex flex-wrap gap-1">{cats.map(c => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`cursor-pointer rounded-full px-3 py-1 text-[13px] font-semibold ${cat === c ? 'bg-navy text-white' : 'text-slate hover:bg-sky'}`}>{c}</button>)}</div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map(i => { const s = state[i.id]; const on = !!s?.connected; return <article key={i.id} className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-[18px] font-bold text-white ${i.tone}`} aria-hidden="true">{mark(i)}</span><div className="min-w-0"><h3 className="font-display text-[14.5px] font-bold leading-snug text-navy">{i.name}</h3><div className="text-[12px] text-slate">{i.cat}</div></div></div>
      <p className="mt-3 flex-1 text-[13px] text-slate">{i.desc}</p>
      <div className="mt-3 flex items-center justify-between gap-2">{on ? <Badge tone="Confirmed">Conectado</Badge> : <Badge tone="Canceled">No conectado</Badge>}
        <div className="flex gap-1.5">{on && <Button size="sm" variant="ghost" onClick={() => { put(i.id, false, s!.cfg); toast(`${i.name.split(' — ')[0]} desconectado`); }}>Desconectar</Button>}<Button size="sm" variant={on ? 'secondary' : 'primary'} disabled={!acc.section('integrations')} onClick={() => setOpen(i.id)}>{on ? 'Configurar' : 'Conectar'}</Button></div></div>
      {on && <p className="mt-2 text-[12px] text-slate">Modo prueba · no envía datos reales</p>}
      {on && i.id === 'meta' && <p className="mt-2 text-[12px] text-slate">Dataset {(s!.cfg.pixel as string) || '—'} · {(s!.cfg.events as string[] | undefined)?.length ?? 0} eventos</p>}
    </article>; })}{list.length === 0 && <p className="text-[13.5px] text-slate">Ninguna integración coincide.</p>}</div>
    {open === 'meta' && <MetaConfig st={st} onSave={done} onClose={() => setOpen(null)} />}
    {open === 'google' && it && <SimpleConfig item={it} st={st} onSave={done} onClose={() => setOpen(null)} fields={[{ k: 'customer', label: 'ID de cliente de Google Ads', ph: '123-456-7890' }, { k: 'convAction', label: 'Acción de conversión (nombre)', ph: 'Nexa Appointment Set' }, { k: 'devtoken', label: 'Developer token', type: 'password' }]} />}
    {open === 'dialpad' && it && <SimpleConfig item={it} st={st} onSave={done} onClose={() => setOpen(null)} fields={[{ k: 'webhook', label: 'URL de webhook para Dialpad', ph: 'https://api.<dominio-del-crm>/webhook/dialpad-integration' }, { k: 'apiKey', label: 'API key de Dialpad', type: 'password' }]}><p className="text-xs text-slate">Sincroniza llamadas entrantes/salientes, resumen IA y grabación. Se activa al conectar el backend.</p></SimpleConfig>}
    {open === 'n8n' && it && <SimpleConfig item={it} st={st} onSave={done} onClose={() => setOpen(null)} fields={[{ k: 'base', label: 'URL de n8n', ph: 'https://n8n.example.com' }, { k: 'secret', label: 'Secreto de firma de webhooks', type: 'password' }]}><p className="text-xs text-slate">El CRM firma cada webhook; n8n debe verificar la firma. Las apps y tokens se gestionan en <Link to="/developer/apps" className="font-semibold text-link hover:underline">Desarrollo</Link>.</p></SimpleConfig>}
    {open && ['calendar', 'gmail'].includes(open) && it && <SimpleConfig item={it} st={st} onSave={done} onClose={() => setOpen(null)} fields={[{ k: 'account', label: 'Cuenta de Google', ph: 'nombre@nexahome.example' }]}><p className="text-xs text-slate">La autorización (OAuth) se completa con el backend; aquí solo se elige la cuenta.</p></SimpleConfig>}
    {open === 'telegram' && it && <SimpleConfig item={it} st={st} onSave={done} onClose={() => setOpen(null)} fields={[{ k: 'chat', label: 'ID del chat o canal', ph: '-1001234567890' }, { k: 'bot', label: 'Token del bot', type: 'password' }]} />}
  </div>;
}
void Select;
void Row;

export function IntegrationsPage() { return store.CONNECTED ? <IntegrationsConnected /> : <IntegrationsDemo />; }

/* ---------------- Modo conectado: /integrations del servidor ---------------- */
const SERVER_KIND: Record<string, string | null> = { meta: 'meta', google: 'google_ads', dialpad: 'dialpad', n8n: 'n8n', telegram: 'telegram', calendar: null, gmail: null };
const GENERIC: Record<string, { k: string; label: string; ph?: string; secret?: boolean }[]> = {
  google_ads: [{ k: 'customer_id', label: 'ID de cliente de Google Ads', ph: '123-456-7890' }, { k: 'conversion_action', label: 'Acción de conversión', ph: 'Nexa Appointment Set' }, { k: 'developer_token', label: 'Developer token', secret: true }],
  dialpad: [{ k: 'webhook_url', label: 'URL de webhook para Dialpad' }, { k: 'api_key', label: 'API key de Dialpad', secret: true }],
  n8n: [{ k: 'base_url', label: 'URL de n8n', ph: 'https://n8n.example.com' }, { k: 'webhook_secret', label: 'Secreto de firma de webhooks', secret: true }],
  telegram: [{ k: 'chat_id', label: 'ID del chat o canal', ph: '-1001234567890' }, { k: 'bot_token', label: 'Token del bot', secret: true }],
};
function IntegrationsConnected() {
  const acc = useAccess(); const [q, setQ] = useState(''); const [cat, setCat] = useState('Todas'); const [open, setOpen] = useState<string | null>(null);
  const [list, setList] = useState<Record<string, { status: string; enabled?: boolean }>>({}); const [err, setErr] = useState('');
  const refresh = async () => { try { const l = await api<{ results: any[] }>('GET', '/integrations'); const m: Record<string, any> = {}; l.results.forEach(r => { m[r.kind] = { status: r.status }; }); const meta = await api<any>('GET', '/integrations/meta').catch(() => null); if (meta) m.meta = { status: meta.enabled ? 'connected' : 'disconnected', enabled: meta.enabled }; setList(m); setErr(''); } catch { setErr('No se pudieron leer las integraciones (¿tienes acceso de administrador?).'); } };
  useEffect(() => { void refresh(); }, []);
  const cats = ['Todas', ...Array.from(new Set(ITEMS.map(i => i.cat)))]; const shown = ITEMS.filter(i => (cat === 'Todas' || i.cat === cat) && (i.name + i.desc).toLowerCase().includes(q.toLowerCase()));
  const it = ITEMS.find(i => i.id === open);
  return <div>
    <PageHeader title="Integraciones" sub="Conexiones del CRM con anuncios, llamadas y automatizaciones. Los secretos se guardan cifrados en el servidor y no se vuelven a mostrar." actions={<Link to="/developer/apps"><Button>Aplicaciones privadas y API</Button></Link>} />
    <div role="note" className="mb-4 flex items-start gap-2.5 rounded-lg border border-line bg-sky px-3.5 py-2.5 text-[13px] text-navy"><Icon n="info" s={16} className="mt-0.5 shrink-0" /><span>Este CRM funciona <b>en paralelo</b> a tus sistemas actuales. La API de Conversiones nace <b>apagada</b> y el modo “prueba” solo registra; configurar algo aquí no cambia Nexa, n8n, Meta, Google ni Dialpad.</span></div>
    {err && <p role="alert" className="mb-3 text-[13px] text-bad">{err}</p>}
    <div className="mb-4 flex flex-wrap items-center gap-2"><div className="relative w-full sm:w-64"><Icon n="search" s={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar integraciones" aria-label="Buscar integraciones" className="h-9 w-full rounded-full border border-line-2 bg-white pl-8 pr-3 text-sm placeholder:text-mute focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></div>
      <div role="group" aria-label="Categoría" className="flex flex-wrap gap-1">{cats.map(c => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`cursor-pointer rounded-full px-3 py-1 text-[13px] font-semibold ${cat === c ? 'bg-navy text-white' : 'text-slate hover:bg-sky'}`}>{c}</button>)}</div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map(i => { const kind = SERVER_KIND[i.id]; const on = kind ? list[kind]?.status === 'connected' : false; return <article key={i.id} className="flex flex-col rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-[18px] font-bold text-white ${i.tone}`} aria-hidden="true">{mark(i)}</span><div className="min-w-0"><h3 className="font-display text-[14.5px] font-bold leading-snug text-navy">{i.name}</h3><div className="text-[12px] text-slate">{i.cat}</div></div></div>
      <p className="mt-3 flex-1 text-[13px] text-slate">{i.desc}</p>
      <div className="mt-3 flex items-center justify-between gap-2">{on ? <Badge tone="Confirmed">Conectado</Badge> : <Badge tone="Canceled">{kind ? 'No conectado' : 'Próximamente'}</Badge>}
        <Button size="sm" variant={on ? 'secondary' : 'primary'} disabled={!kind || !acc.section('integrations')} onClick={() => setOpen(i.id)}>{on ? 'Configurar' : 'Conectar'}</Button></div></article>; })}</div>
    {open === 'meta' && <MetaConnected onClose={() => { setOpen(null); void refresh(); }} />}
    {open && open !== 'meta' && it && SERVER_KIND[open] && <GenericConnected item={it} kind={SERVER_KIND[open]!} onClose={() => { setOpen(null); void refresh(); }} />}
  </div>;
}
function MetaConnected({ onClose }: { onClose: () => void }) {
  const toast = useToast(); const [d, setD] = useState<any>(null); const [f, setF] = useState<Record<string, any>>({}); const [sec, setSec] = useState({ accessToken: '', pageAccessToken: '', appSecret: '' }); const [rules, setRules] = useState<any[]>([]); const [err, setErr] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { api<any>('GET', '/integrations/meta').then(x => { setD(x); setF({ pixelId: x.config.pixelId ?? '', pageId: x.config.pageId ?? '', testEventCode: x.config.testEventCode ?? '', capiMode: x.config.capiMode ?? 'off', leadAdsEnabled: x.config.leadAdsEnabled !== false, enabled: !!x.enabled }); setRules(x.config.rules ?? x.info?.defaultRules ?? []); }).catch(() => setErr({ load: 'No se pudo cargar la configuración.' })); }, []);
  const save = async () => {
    const e: Record<string, string> = {}; if (f.pixelId && !/^\d{5,20}$/.test(f.pixelId)) e.pixelId = 'Solo números (5–20 dígitos).'; if (f.pageId && !/^\d{5,25}$/.test(f.pageId)) e.pageId = 'Solo números (5–25 dígitos).'; setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const config: Record<string, unknown> = { capiMode: f.capiMode, leadAdsEnabled: f.leadAdsEnabled, rules }; if (f.pixelId) config.pixelId = f.pixelId; if (f.pageId) config.pageId = f.pageId; if (f.testEventCode) config.testEventCode = f.testEventCode;
      const secrets: Record<string, string> = {}; (Object.keys(sec) as (keyof typeof sec)[]).forEach(k => { if (sec[k].trim()) secrets[k] = sec[k].trim(); });
      await api('PUT', '/integrations/meta', { enabled: !!f.enabled, config, ...(Object.keys(secrets).length ? { secrets } : {}) }); toast('Meta guardado. La API de Conversiones solo envía si eliges "En vivo" y el servidor lo permite.'); onClose();
    } catch (x: any) { setErr({ save: `No se pudo guardar (${x?.code ?? 'error'})` }); setBusy(false); }
  };
  if (!d) return <Drawer title="Meta Ads" onClose={onClose}><p className="text-[13.5px] text-slate">{err.load ?? 'Cargando…'}</p></Drawer>;
  return <Drawer title="Meta Ads" onClose={onClose} width="w-[580px]" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={busy} onClick={save}>Guardar configuración</Button></>}>
    {err.save && <p role="alert" className="mb-3 text-[13px] text-bad">{err.save}</p>}
    <div className="mb-3 flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span className="text-[13.5px] font-semibold">Integración activa</span><Switch on={!!f.enabled} onChange={v => setF(s => ({ ...s, enabled: v }))} label="Integración Meta activa" /></div>
    <Field label={`Token de acceso (CAPI)${d.secretsSet.accessToken ? ' — guardado' : ''}`}><Input type="password" autoComplete="off" value={sec.accessToken} onChange={e => setSec(s => ({ ...s, accessToken: e.target.value }))} placeholder={d.secretsSet.accessToken ? 'Déjalo vacío para conservarlo' : 'EAAB…'} /></Field>
    <div className="grid gap-x-3 sm:grid-cols-2"><Field label="ID del dataset / píxel"><Input inputMode="numeric" value={f.pixelId} onChange={e => setF(s => ({ ...s, pixelId: e.target.value }))} />{err.pixelId && <span role="alert" className="text-xs text-bad">{err.pixelId}</span>}</Field><Field label="ID de la página"><Input inputMode="numeric" value={f.pageId} onChange={e => setF(s => ({ ...s, pageId: e.target.value }))} />{err.pageId && <span role="alert" className="text-xs text-bad">{err.pageId}</span>}</Field>
      <Field label={`Token de la página (Lead Ads)${d.secretsSet.pageAccessToken ? ' — guardado' : ''}`}><Input type="password" autoComplete="off" value={sec.pageAccessToken} onChange={e => setSec(s => ({ ...s, pageAccessToken: e.target.value }))} /></Field><Field label={`App secret${d.secretsSet.appSecret ? ' — guardado' : ''}`}><Input type="password" autoComplete="off" value={sec.appSecret} onChange={e => setSec(s => ({ ...s, appSecret: e.target.value }))} /></Field>
      <Field label="Código de evento de prueba"><Input value={f.testEventCode} onChange={e => setF(s => ({ ...s, testEventCode: e.target.value }))} /></Field>
      <Field label="Conversions API"><Select value={f.capiMode} onChange={e => setF(s => ({ ...s, capiMode: e.target.value }))}><option value="off">Apagada</option><option value="dry_run">Prueba (registra, no envía)</option><option value="live">En vivo (exige permiso del servidor)</option></Select></Field></div>
    <div className="mb-4 flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><span><span className="block text-[13.5px] font-semibold">Recibir leads de Lead Ads</span><span className="block text-xs text-slate">Webhook: <code>{d.info?.webhookPath}</code> · token de verificación: <code>{d.revealed?.verifyToken}</code></span></span><Switch on={!!f.leadAdsEnabled} onChange={v => setF(s => ({ ...s, leadAdsEnabled: v }))} label="Recibir leads de Lead Ads" /></div>
    <h3 className="mb-1 font-display text-[14px] font-bold text-navy">Eventos que se envían a Meta</h3>
    <ul className="divide-y divide-line rounded-xl border border-line">{rules.map((r, i) => <li key={r.id} className="px-3 py-2.5"><Checkbox checked={r.enabled !== false} onChange={on => setRules(rs => rs.map((x, j) => (j === i ? { ...x, enabled: on } : x)))} label={`${r.eventName}${r.pixel === 'b2b' ? ' (B2B)' : ''}`} /><p className="ml-6 text-xs text-slate">{r.label}</p></li>)}</ul>
  </Drawer>;
}
function GenericConnected({ item, kind, onClose }: { item: Item; kind: string; onClose: () => void }) {
  const toast = useToast(); const fields = GENERIC[kind] ?? []; const [v, setV] = useState<Record<string, string>>({}); const [cur, setCur] = useState<Record<string, string>>({}); const [err, setErr] = useState('');
  useEffect(() => { api<any>('GET', `/integrations/${kind}`).then(x => setCur(x.config ?? {})).catch(() => {}); }, [kind]);
  return <Drawer title={item.name} onClose={onClose} width="w-[520px]" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={async () => { try { const config: Record<string, string> = {}; fields.forEach(f => { if (v[f.k] !== undefined && v[f.k] !== '') config[f.k] = v[f.k]; }); await api('PUT', `/integrations/${kind}`, { config }); toast(`${item.name} guardado (cifrado en el servidor)`); onClose(); } catch (e: any) { setErr(`No se pudo guardar (${e?.code ?? 'error'})`); } }}>Guardar</Button></>}>
    <p className="mb-4 text-[13.5px] text-slate">{item.desc}</p>{err && <p role="alert" className="mb-2 text-[13px] text-bad">{err}</p>}
    {fields.map(f => <Field key={f.k} label={f.label}><Input type={f.secret ? 'password' : 'text'} autoComplete="off" value={v[f.k] ?? ''} onChange={e => setV(s => ({ ...s, [f.k]: e.target.value }))} placeholder={cur[f.k] ? `Guardado: ${cur[f.k]}` : f.ph} /></Field>)}</Drawer>;
}
