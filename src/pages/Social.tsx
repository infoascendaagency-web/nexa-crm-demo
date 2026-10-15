// «Redes sociales»: bandeja de DM y comentarios de Instagram/Facebook, respuestas automáticas y estado de la conexión con Meta.
// ANDAMIAJE: la interfaz y la API están completas; el envío/recepción real se activa al conectar las cuentas (ver contexto/crm-redes-sociales-arquitectura.md).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/backend';
import Icon from '../components/Icon';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, Switch, Tabs, Textarea, useToast } from '../components/ui';
import Inbox from './social/Inbox';
import AiPrompts from './social/AiPrompts';
import Simulator from './social/Simulator';
import { platformLabel } from './social/shared';

type Channel = 'ig_dm' | 'fb_dm' | 'ig_comment' | 'fb_comment' | 'tt_dm' | 'tt_comment' | 'wa_dm';
const CHANNELS: { id: Channel; label: string }[] = [{ id: 'ig_dm', label: 'Instagram · mensajes' }, { id: 'fb_dm', label: 'Facebook · Messenger' }, { id: 'ig_comment', label: 'Instagram · comentarios' }, { id: 'fb_comment', label: 'Facebook · comentarios' }, { id: 'tt_dm', label: 'TikTok · mensajes' }, { id: 'tt_comment', label: 'TikTok · comentarios' }, { id: 'wa_dm', label: 'WhatsApp · mensajes' }];
const MODES = [{ id: 'fixed', label: 'Respuesta fija' }, { id: 'ai_draft', label: 'Borrador con IA (una persona lo aprueba)' }, { id: 'off', label: 'Desactivada' }] as const;
type Mode = (typeof MODES)[number]['id'];
type Status = { connected: boolean; accounts: number; accountsConnected: number; metaTokenConfigured: boolean; metaIntegrationEnabled: boolean; webhookUrl: string; webhookRouting: boolean; requiredPermissions: { channel: string; scope: string; why: string }[] };
type Account = { id: number; channel: 'instagram' | 'facebook' | 'tiktok' | 'whatsapp'; externalId: string; name: string; username?: string; status: string; lastError?: string; permissions: string[]; simulated?: boolean };
type Cond = { keywords: string[]; matchAll: boolean; postIds: string[]; firstMessageOnly: boolean; schedule: { tz: string; days: number[]; from: string; to: string } | null };
type Rule = { id: number; name: string; enabled: boolean; mode: Mode; channels: Channel[]; accountIds: number[]; conditions: Cond; replyText: string; priority: number };
const EMPTY_RULE: Omit<Rule, 'id'> = { name: '', enabled: false, mode: 'fixed', channels: [], accountIds: [], conditions: { keywords: [], matchAll: false, postIds: [], firstMessageOnly: false, schedule: null }, replyText: '', priority: 100 };
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const netName = (c: string) => platformLabel(c);

function PendingBanner({ status }: { status: Status | null }) {
  if (status?.connected) return null;
  return <div role="note" className="mb-4 flex items-start gap-2.5 rounded-lg border border-line bg-sky px-3.5 py-2.5 text-[13px] text-navy"><Icon n="info" s={16} className="mt-0.5 shrink-0" />
    <div><b>Pendiente de conectar.</b> La bandeja y las reglas ya se pueden preparar, pero no se envía ni se recibe nada hasta conectar las cuentas. Mientras tanto puedes probar todo con el simulador (pestaña «Cuentas y pruebas»). {status && !status.metaTokenConfigured && <>Primero guarda el token de Meta en <Link to="/integrations" className="font-semibold text-link hover:underline">Integraciones</Link>.</>}</div></div>;
}

/* ---------- Respuestas automáticas ---------- */
function RuleEditor({ initial, accounts, onClose, onSaved }: { initial: Omit<Rule, 'id'> & { id?: number }; accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const [r, setR] = useState(initial); const [kw, setKw] = useState(initial.conditions.keywords.join(', ')); const [posts, setPosts] = useState(initial.conditions.postIds.join(', ')); const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof r>(k: K, v: (typeof r)[K]) => setR(x => ({ ...x, [k]: v }));
  const cond = (patch: Partial<Cond>) => setR(x => ({ ...x, conditions: { ...x.conditions, ...patch } }));
  const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
  const toggleCh = (c: Channel) => set('channels', r.channels.includes(c) ? r.channels.filter(x => x !== c) : [...r.channels, c]);
  const sch = r.conditions.schedule;
  const save = async () => {
    if (!r.name.trim()) return toast('Ponle un nombre a la regla', 'err'); setBusy(true);
    const body = { name: r.name.trim(), enabled: r.enabled, mode: r.mode, channels: r.channels, accountIds: r.accountIds, replyText: r.replyText, priority: r.priority, conditions: { ...r.conditions, keywords: split(kw), postIds: split(posts) } };
    try { if (r.id) await api('PATCH', `/social/rules/${r.id}`, body); else await api('POST', '/social/rules', body); toast('Regla guardada'); onSaved(); onClose(); }
    catch { toast('No se pudo guardar la regla', 'err'); } finally { setBusy(false); }
  };
  return <Modal title={r.id ? 'Editar regla' : 'Nueva regla de respuesta'} onClose={onClose} width="max-w-2xl" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} disabled={busy}>Guardar</Button></>}>
    <Field label="Nombre"><Input value={r.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Precio por comentario" /></Field>
    <Field label="Qué hacer"><Select value={r.mode} onChange={e => set('mode', e.target.value as Mode)}>{MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
    <Field label={r.mode === 'ai_draft' ? 'Instrucciones para la IA (tono, qué decir, qué no)' : 'Texto de la respuesta'} hint={r.mode === 'ai_draft' ? 'Claude redacta un borrador y una persona lo aprueba antes de enviarse.' : 'Puedes usar {{nombre}} para el nombre de la persona.'}><Textarea rows={3} value={r.replyText} onChange={e => set('replyText', e.target.value)} disabled={r.mode === 'off'} /></Field>
    <div className="mb-3"><div className="mb-1 text-[13px] font-semibold text-navy">Dónde</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">{CHANNELS.map(c => <label key={c.id} className="flex cursor-pointer items-center gap-1.5 text-[13.5px]"><input type="checkbox" checked={r.channels.includes(c.id)} onChange={() => toggleCh(c.id)} />{c.label}</label>)}</div>
      <p className="mt-1 text-[12px] text-slate">{r.channels.length ? '' : 'Sin marcar = todos los canales.'} {accounts.length ? '' : 'Las cuentas aparecerán cuando conectes Meta (por ahora vale para todas).'}</p>
      {accounts.length > 0 && <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{accounts.map(a => <label key={a.id} className="flex cursor-pointer items-center gap-1.5 text-[13.5px]"><input type="checkbox" checked={r.accountIds.includes(a.id)} onChange={() => set('accountIds', r.accountIds.includes(a.id) ? r.accountIds.filter(x => x !== a.id) : [...r.accountIds, a.id])} />{netName(a.channel)} · {a.name}</label>)}</div>}
      <Field label="Publicaciones concretas (solo comentarios)" hint="Ids separados por comas. Vacío = todas."><Input value={posts} onChange={e => setPosts(e.target.value)} /></Field></div>
    <div className="mb-3"><div className="mb-1 text-[13px] font-semibold text-navy">Cuándo</div>
      <Field label="Palabras clave" hint="Separadas por comas. Vacío = cualquier mensaje. No distingue mayúsculas ni tildes."><Input value={kw} onChange={e => setKw(e.target.value)} placeholder="precio, cotización, cuánto cuesta" /></Field>
      <div className="flex flex-wrap gap-x-6 gap-y-1"><label className="flex cursor-pointer items-center gap-1.5 text-[13.5px]"><input type="checkbox" checked={r.conditions.matchAll} onChange={e => cond({ matchAll: e.target.checked })} />Deben aparecer todas las palabras</label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13.5px]"><input type="checkbox" checked={r.conditions.firstMessageOnly} onChange={e => cond({ firstMessageOnly: e.target.checked })} />Solo el primer mensaje (bienvenida)</label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13.5px]"><input type="checkbox" checked={!!sch} onChange={e => cond({ schedule: e.target.checked ? { tz: 'America/New_York', days: [1, 2, 3, 4, 5], from: '18:00', to: '08:00' } : null })} />Solo en un horario</label></div>
      {sch && <div className="mt-2 rounded-lg border border-line p-3"><div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <label key={d} className="flex cursor-pointer items-center gap-1 text-[13px]"><input type="checkbox" checked={sch.days.includes(i)} onChange={() => cond({ schedule: { ...sch, days: sch.days.includes(i) ? sch.days.filter(x => x !== i) : [...sch.days, i].sort() } })} />{d}</label>)}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">De <Input type="time" value={sch.from} onChange={e => cond({ schedule: { ...sch, from: e.target.value } })} className="!w-28" /> a <Input type="time" value={sch.to} onChange={e => cond({ schedule: { ...sch, to: e.target.value } })} className="!w-28" /><span className="text-slate">(zona {sch.tz}; si «a» es menor que «de», cruza la medianoche)</span></div></div>}</div>
    <Field label="Prioridad" hint="Menor número = se evalúa primero. Responde la primera regla que coincida."><Input type="number" min={1} value={r.priority} onChange={e => set('priority', Number(e.target.value) || 100)} className="!w-28" /></Field>
    <Switch on={r.enabled} onChange={v => set('enabled', v)} label="Regla activa" />
  </Modal>;
}

function Rules({ accounts }: { accounts: Account[] }) {
  const toast = useToast(); const [rules, setRules] = useState<Rule[] | null>(null); const [edit, setEdit] = useState<(Omit<Rule, 'id'> & { id?: number }) | null>(null);
  const [test, setTest] = useState({ channel: 'ig_comment' as Channel, text: '' }); const [res, setRes] = useState<{ winner: { name: string } | null; results: { id: number; name: string; ok: boolean; why: string }[] } | null>(null);
  const load = useCallback(() => { api<{ results: Rule[] }>('GET', '/social/rules').then(r => setRules(r.results)).catch(() => setRules([])); }, []);
  useEffect(load, [load]);
  const toggle = async (r: Rule, on: boolean) => { try { await api('PATCH', `/social/rules/${r.id}`, { enabled: on }); load(); } catch { toast('No se pudo cambiar la regla', 'err'); } };
  const del = async (r: Rule) => { if (!window.confirm(`¿Eliminar la regla «${r.name}»?`)) return; try { await api('DELETE', `/social/rules/${r.id}`); load(); } catch { toast('No se pudo eliminar', 'err'); } };
  const run = async () => { try { setRes(await api('POST', '/social/rules/test', { channel: test.channel, text: test.text, accountId: accounts[0]?.id ?? 0 })); } catch { toast('No se pudo probar', 'err'); } };
  const summary = (r: Rule) => `${r.channels.length ? r.channels.map(c => CHANNELS.find(x => x.id === c)?.label).join(', ') : 'Todos los canales'}${r.conditions.keywords.length ? ` · palabras: ${r.conditions.keywords.slice(0, 4).join(', ')}` : ''}${r.conditions.schedule ? ` · ${r.conditions.schedule.from}–${r.conditions.schedule.to}` : ''}`;
  return <div>
    <div className="mb-3 flex items-center justify-between gap-2"><p className="max-w-2xl text-[13.5px] text-slate">Define qué responder, dónde y cuándo. Hasta conectar Meta, las reglas se guardan pero no envían nada.</p><Button variant="primary" onClick={() => setEdit({ ...EMPTY_RULE })}>Nueva regla</Button></div>
    {!rules ? <div className="p-6"><Spinner /></div> : !rules.length ? <div className="rounded-xl border border-line bg-white"><Empty icon="bolt" title="Aún no hay reglas">Crea una para saludar a quien escribe, responder «precio» en un comentario o contestar fuera de horario.</Empty></div>
      : <div className="overflow-hidden rounded-xl border border-line bg-white">{rules.map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line/70 px-4 py-3 last:border-0">
        <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-navy">{r.name} <Badge>{MODES.find(m => m.id === r.mode)?.label.split(' (')[0]}</Badge></div><div className="truncate text-[12.5px] text-slate">{summary(r)}</div></div>
        <Switch on={r.enabled} onChange={v => toggle(r, v)} label={r.enabled ? 'Activa' : 'Inactiva'} />
        <Button onClick={() => setEdit(r)}>Editar</Button><Button onClick={() => del(r)}>Eliminar</Button></div>)}</div>}
    <Card title="Probar una regla" className="mt-4"><div className="flex flex-wrap items-end gap-2"><Select aria-label="Canal de prueba" value={test.channel} onChange={e => setTest(t => ({ ...t, channel: e.target.value as Channel }))} className="!w-56">{CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
      <Input aria-label="Mensaje de prueba" value={test.text} onChange={e => setTest(t => ({ ...t, text: e.target.value }))} placeholder="Escribe un mensaje de ejemplo" className="!w-72 flex-1" /><Button onClick={run} disabled={!test.text.trim()}>Ver qué respondería</Button></div>
      {res && <p className="mt-2 text-[13.5px] text-ink">{res.winner ? <>Respondería la regla <b>{res.winner.name}</b>.</> : 'Ninguna regla respondería a este mensaje.'}</p>}</Card>
    {edit && <RuleEditor initial={edit} accounts={accounts} onClose={() => setEdit(null)} onSaved={load} />}
  </div>;
}

/* ---------- Cuentas ---------- */
function Accounts({ status, accounts, onSimChange }: { status: Status | null; accounts: Account[]; onSimChange: () => void }) {
  const toast = useToast();
  return <div className="grid gap-4 lg:grid-cols-2">
    <Card title="Conexión con Meta">
      <ul className="space-y-2 text-[13.5px]">
        <li className="flex items-center justify-between"><span>Token de Meta guardado</span><Badge tone={status?.metaTokenConfigured ? 'Sale' : undefined}>{status?.metaTokenConfigured ? 'Sí' : 'No'}</Badge></li>
        <li className="flex items-center justify-between"><span>Cuentas conectadas</span><Badge>{status?.accountsConnected ?? 0}</Badge></li>
        <li className="flex items-center justify-between"><span>Estado</span><Badge tone={status?.connected ? 'Sale' : undefined}>{status?.connected ? 'Conectado' : 'No conectado'}</Badge></li>
      </ul>
      <p className="mt-3 text-[12.5px] text-slate">Se reutiliza el token de <Link to="/integrations" className="font-semibold text-link hover:underline">Integraciones → Meta</Link>. Nada se envía ni se recibe hasta que se active la conexión.</p>
      <div className="mt-3"><Button onClick={() => toast('La conexión se activa al cerrar la sección de Redes sociales', 'ok')} disabled>Conectar cuentas</Button></div>
      {status && <div className="mt-4"><div className="text-[12px] font-bold uppercase tracking-wide text-slate">URL del webhook (la misma de Meta)</div><code className="mt-1 block break-all rounded bg-sky px-2 py-1 text-[12px]">{status.webhookUrl}</code></div>}
    </Card>
    <Card title="Cuentas">
      {!accounts.length ? <Empty icon="globe" title="No conectado">Cuando conectes Meta verás aquí tus Páginas de Facebook y cuentas de Instagram profesional.</Empty>
        : <ul className="divide-y divide-line/70">{accounts.map(a => <li key={a.id} className="flex items-center justify-between py-2 text-[13.5px]"><span><b>{a.name}</b> <span className="text-slate">· {netName(a.channel)}{a.username ? ` · @${a.username}` : ''}</span></span><Badge tone={a.simulated ? 'Canceled' : a.status === 'connected' ? 'Sale' : undefined}>{a.simulated ? 'Simulada' : a.status === 'connected' ? 'Conectada' : a.status === 'error' ? 'Con error' : 'Pendiente'}</Badge></li>)}</ul>}
    </Card>
    <Card title="Permisos de Meta necesarios" className="lg:col-span-2">
      <div className="overflow-x-auto"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="py-2 pr-3">Permiso</th><th className="pr-3">Red</th><th>Para qué</th></tr></thead>
        <tbody>{(status?.requiredPermissions ?? []).map(p => <tr key={p.scope} className="border-b border-line/60"><td className="py-2 pr-3"><code>{p.scope}</code></td><td className="pr-3 capitalize">{p.channel}</td><td>{p.why}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-[12.5px] text-slate">Meta exige revisión de la app (App Review) para usar estos permisos con cuentas que no sean de tu propio negocio. Las respuestas a mensajes solo se permiten dentro de las 24 h siguientes al último mensaje de la persona.</p>
    </Card>
    <Simulator onChange={onSimChange} />
  </div>;
}

export default function Social() {
  const [tab, setTab] = useState<'inbox' | 'ai' | 'rules' | 'accounts'>('inbox'); const [status, setStatus] = useState<Status | null>(null); const [accounts, setAccounts] = useState<Account[]>([]); const [tick, setTick] = useState(0);
  const reload = useCallback(() => { api<Status>('GET', '/social/status').then(setStatus).catch(() => {}); api<{ results: Account[] }>('GET', '/social/accounts').then(r => setAccounts(r.results)).catch(() => {}); setTick(t => t + 1); }, []);
  useEffect(reload, [reload]);
  return <div className="p-4 sm:p-6">
    <PageHeader title="Redes sociales" sub="Mensajes y comentarios de Facebook, Instagram, TikTok y WhatsApp, con respuestas automáticas e IA" />
    <PendingBanner status={status} />
    <Tabs value={tab} onChange={setTab} items={[{ id: 'inbox', label: 'Bandeja' }, { id: 'ai', label: 'IA y prompts' }, { id: 'rules', label: 'Respuestas automáticas' }, { id: 'accounts', label: 'Cuentas y pruebas' }]} />
    <div className="pt-4">{tab === 'inbox' ? <Inbox connected={!!status?.connected} refreshKey={tick} /> : tab === 'ai' ? <AiPrompts /> : tab === 'rules' ? <Rules accounts={accounts.filter(a => !a.simulated)} /> : <Accounts status={status} accounts={accounts} onSimChange={reload} />}</div>
  </div>;
}
