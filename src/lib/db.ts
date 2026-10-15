// Almacén en memoria + localStorage que imita el backend (objetos, asociaciones, vistas, apps de desarrollador, registros).
// Al conectar el backend real se reemplaza SOLO este archivo y api.ts; la interfaz no cambia.
import { runSearch } from './engine';
import { ME, OBJECTS, OWNERS, PIPELINES, registerProp, type PropDef } from './schema';
import { buildSeed } from './seed';
import type { ApiLogRow, AppDef, AssocRow, AuditRow, ObjKey, Page, Rec, SearchReq, ViewDef } from './types';

const KEY = 'nexa-crm-demo-v4';
export const CONNECTED = import.meta.env.VITE_MODE === 'connected';
/** Ganchos de escritura (write-through). Los registra `backend.ts` en modo conectado; en demo no hacen nada. */
export const hooks: Record<string, (...a: any[]) => any> = {};
const H = (k: string, ...a: unknown[]) => (CONNECTED ? hooks[k]?.(...a) : undefined);
type State = { records: Record<ObjKey, Rec[]>; assoc: AssocRow[]; views: ViewDef[]; pinned: Record<string, string[]>; apps: AppDef[]; logs: ApiLogRow[]; audit: AuditRow[]; seq: number; customProps: { obj: ObjKey; def: PropDef }[]; pipelines?: typeof PIPELINES; forms: any[]; posts: any[]; pages: any[] };

const rnd = (n: number, alphabet = 'abcdef0123456789') => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const uid = () => `${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
export const makeToken = () => `pat-crm-${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
export const mask = (t: string) => t.slice(0, 16) + '**-****-****-****-************';

function initial(): State {
  const seed = buildSeed();
  const t = (d: number) => new Date(Date.now() - d * 60000).toISOString();
  const tok = makeToken(), sec = rnd(8) + '-' + rnd(4) + '-' + rnd(4) + '-' + rnd(4) + '-' + rnd(12);
  const app: AppDef = {
    id: '40625243', name: 'Nexa Task Creator', description: 'Ejemplo: app que alimenta el flujo Task Creator de n8n', createdAt: t(60 * 24 * 30), token: tok, tokenMasked: mask(tok), clientSecret: sec, clientSecretMasked: '********-****-****-****-************',
    scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.appointments.read', 'crm.objects.appointments.write', 'crm.objects.deals.read', 'crm.objects.deals.write', 'crm.schemas.contacts.read', 'crm.schemas.appointments.read', 'actions'],
    targetUrl: 'https://n8n.example.com/webhook/nx-contacts-v3', throttle: 10,
    subs: [
      { id: 's1', objectType: 'contacts', event: 'creation', active: true, total: 1205, errors: 0 },
      { id: 's2', objectType: 'contacts', event: 'propertyChange', property: 'hs_lead_status', active: true, total: 4795, errors: 1 },
      { id: 's3', objectType: 'contacts', event: 'propertyChange', property: 'hubspot_owner_id', active: true, total: 1180, errors: 0 },
      { id: 's4', objectType: 'contacts', event: 'propertyChange', property: 'dialpad_last_inbound_call_timestamp', active: false, total: 0, errors: 0 },
      { id: 's5', objectType: 'contacts', event: 'propertyChange', property: 'dialpad_last_outbound_call_timestamp', active: false, total: 0, errors: 0 },
    ],
  };
  const urls: [string, string, number][] = [['POST', '/crm/v3/objects/notes', 200], ['PATCH', '/crm/v3/objects/contacts/566814151407', 200], ['PATCH', '/crm/v3/objects/contacts/566814151407', 200], ['POST', '/crm/v3/objects/tasks/search', 200], ['GET', '/crm/v4/objects/contacts/566814151407/associations/tasks', 200], ['POST', '/crm/v3/objects/contacts/search', 200], ['PATCH', '/crm/v3/objects/contacts/566810000001', 404], ['POST', '/crm/v3/objects/tasks', 201], ['GET', '/crm/v3/objects/appointments/865948963522', 200]];
  const logs: ApiLogRow[] = Array.from({ length: 40 }, (_, i) => { const u = urls[i % urls.length]; return { id: uid(), at: t(i * 3 + 1), method: u[0], url: u[1], status: u[2], appId: app.id }; });
  const audit: AuditRow[] = [
    ['Login', 'Login Succeeded', 'Perform', 'Alex Rivera', '203.0.113.24', 5], ['Security Activity', 'Viewed the private app access token', 'Perform', 'Lucas Ferrer', '46229961', 20], ['Login', 'Login Succeeded', 'Perform', 'Lucas Ferrer', '203.0.113.24', 27], ['Login', 'Login Failed', 'Perform', 'Clara Montes', '203.0.113.57', 150], ['Login', 'Login Succeeded', 'Perform', 'Clara Montes', '203.0.113.88', 1000],
  ].map((r, i) => ({ id: uid(), at: t(r[5] as number), category: r[0] as string, subcategory: r[1] as string, action: r[2] as string, by: r[3] as string, source: r[4] as string }));
  return { records: seed.records, assoc: seed.assoc, views: [], pinned: {}, apps: [app], logs, audit, seq: 900000000000, customProps: [], forms: [], posts: [], pages: [] };
}

const emptyState = (): State => ({ records: { contacts: [], companies: [], deals: [], appointments: [], tasks: [], calls: [], notes: [], meetings: [], tickets: [], leads: [], communications: [], products: [], line_items: [], quotes: [], invoices: [] }, assoc: [], views: [], pinned: {}, apps: [], logs: [], audit: [], seq: 900000000000, customProps: [], forms: [], posts: [], pages: [] });
let S: State = CONNECTED ? emptyState() : (() => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as State; } catch { /* sin almacenamiento */ } return initial(); })();
S.customProps ??= []; S.forms ??= []; S.posts ??= []; S.pages ??= [];
S.customProps.forEach(c => registerProp(c.obj, c.def));
if (S.pipelines) { PIPELINES.deals = S.pipelines.deals; PIPELINES.appointments = S.pipelines.appointments; PIPELINES.tickets = S.pipelines.tickets; }
const listeners = new Set<() => void>();
let timer: any;
const persist = () => { if (CONNECTED) return; clearTimeout(timer); timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* cuota */ } }, 300); };
let version = 0;
export const getVersion = () => version;
const emit = () => { version++; persist(); listeners.forEach(l => l()); };
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const resetDemo = () => { try { localStorage.removeItem(KEY); } catch { /* */ } S = initial(); emit(); };
export const state = () => S;
/** Sustituye el estado por el del servidor (modo conectado). Conserva las referencias de OWNERS/PIPELINES/props que usa el resto de la UI. */
export function hydrate(patch: Partial<State>) { S = { ...S, ...patch }; S.customProps ??= []; emit(); }
export const patchState = (fn: (s: State) => void) => { fn(S); emit(); };

/* ---- Resolución de tokens dinámicos en filtros ---- */
function resolveVal(v?: string): string | undefined {
  if (!v || !v.includes('{{')) return v;
  const now = Date.now(); const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return v.replace(/\{\{(\w+)(?::(\d+))?\}\}/g, (_m, k, n) => {
    if (k === 'me') return ME.id; if (k === 'now') return new Date(now).toISOString();
    if (k === 'today_start') return new Date(start).toISOString(); if (k === 'today_end') return new Date(start + 86400000 - 1).toISOString();
    if (k === 'days_ago') return new Date(now - Number(n) * 86400000).toISOString(); if (k === 'days_ahead') return new Date(now + Number(n) * 86400000).toISOString();
    return '';
  });
}
export function resolveReq(req: SearchReq): SearchReq {
  return { ...req, filterGroups: req.filterGroups?.map(gr => ({ filters: gr.filters.map(f => ({ ...f, value: resolveVal(f.value), highValue: resolveVal(f.highValue), values: f.values?.map(x => resolveVal(x)!) })) })) };
}

/* ---- Registros ---- */
const nextId = () => String(S.seq += 1 + Math.floor(Math.random() * 9000));
export function nameOf(r: Rec, obj: ObjKey) {
  if (obj === 'contacts') return [r.properties.firstname, r.properties.lastname].filter(Boolean).join(' ') || r.properties.email || '(sin nombre)';
  return r.properties[OBJECTS[obj].titleProp] || '(sin título)';
}
export function search(obj: ObjKey, req: SearchReq): Page<Rec> {
  const cfg = OBJECTS[obj]; const res = runSearch(S.records[obj], resolveReq(req), cfg.searchProps);
  return res;
}
export const getRecord = (obj: ObjKey, id: string) => S.records[obj].find(r => r.id === id && !r.archived) ?? null;
export function createRecord(obj: ObjKey, props: Record<string, string | null>, assoc?: { to: ObjKey; id: string }[]): Rec {
  const orig = { ...props };
  const now = new Date().toISOString(); const r: Rec = { id: nextId(), properties: { ...props }, createdAt: now, updatedAt: now };
  if (obj === 'tasks') { r.properties.hs_task_status ??= 'NOT_STARTED'; r.properties.hs_task_type ??= 'TODO'; r.properties.hs_task_priority ??= 'NONE'; }
  if (obj === 'contacts') r.properties.hs_lead_status ??= 'New';
  S.records[obj] = [r, ...S.records[obj]];
  assoc?.forEach(a => associate(obj, r.id, a.to, a.id, false));
  if (!CONNECTED) S.audit.unshift({ id: uid(), at: now, category: 'Objects', subcategory: `${obj} created`, action: 'Create', by: `${ME.firstName} ${ME.lastName}`, source: r.id });
  emit(); H('create', obj, r, orig, assoc); return r;
}
export function updateRecord(obj: ObjKey, id: string, props: Record<string, string | null>) {
  const r = getRecord(obj, id); if (!r) return null;
  const old = { ...r.properties };
  r.properties = { ...r.properties, ...props }; r.updatedAt = new Date().toISOString();
  if (obj === 'tasks' && props.hs_task_status === 'COMPLETED') r.properties.hs_task_completion_date = r.updatedAt;
  if (obj === 'contacts' || obj === 'appointments') r.properties.notes_last_updated = r.updatedAt;
  if (!CONNECTED) S.logs.unshift({ id: uid(), at: r.updatedAt, method: 'PATCH', url: `/crm/v3/objects/${obj}/${id}`, status: 200, appId: S.apps[0]?.id ?? '' });
  // Webhook simulado: se registra cada evento que Nexa enviaría a la app (visible en Desarrollo → Webhooks → Detalles)
  for (const k of Object.keys(props)) if (old[k] !== props[k]) for (const a of S.apps) for (const sub of a.subs) if (sub.active && sub.objectType === obj && sub.event === 'propertyChange' && (sub.property === k || (sub.anyProperty && k !== 'notes_last_updated')) && (!sub.valueEquals || props[k] === sub.valueEquals)) sub.total++;
  emit(); H('update', obj, id, props); return r;
}
export function deleteRecords(obj: ObjKey, ids: string[]) { S.records[obj].forEach(r => { if (ids.includes(r.id)) r.archived = true; }); if (!CONNECTED) S.audit.unshift({ id: uid(), at: new Date().toISOString(), category: 'Objects', subcategory: `${obj} deleted`, action: 'Delete', by: `${ME.firstName} ${ME.lastName}`, source: ids.join(',').slice(0, 40) }); emit(); H('remove', obj, ids); }

/* ---- Asociaciones ---- */
export function associate(a: ObjKey, aId: string, b: ObjKey, bId: string, notify = true) {
  if (!S.assoc.some(x => x.from === a && x.fromId === aId && x.to === b && x.toId === bId)) S.assoc.push({ from: a, fromId: aId, to: b, toId: bId });
  if (!S.assoc.some(x => x.from === b && x.fromId === bId && x.to === a && x.toId === aId)) S.assoc.push({ from: b, fromId: bId, to: a, toId: aId });
  if (notify) { emit(); H('associate', a, aId, b, bId); }
}
export function removeAssoc(a: ObjKey, aId: string, b: ObjKey, bId: string) { S.assoc = S.assoc.filter(x => !((x.from === a && x.fromId === aId && x.to === b && x.toId === bId) || (x.from === b && x.fromId === bId && x.to === a && x.toId === aId))); emit(); H('unassociate', a, aId, b, bId); }
export function associated(obj: ObjKey, id: string, to: ObjKey): Rec[] {
  const ids = new Set(S.assoc.filter(x => x.from === obj && x.fromId === id && x.to === to).map(x => x.toId));
  return S.records[to].filter(r => ids.has(r.id) && !r.archived);
}
export const firstAssoc = (obj: ObjKey, id: string, to: ObjKey) => associated(obj, id, to)[0] ?? null;

/* ---- Vistas ---- */
export const userViews = () => S.views;
export function saveView(v: ViewDef) { const i = S.views.findIndex(x => x.id === v.id); if (i >= 0) S.views[i] = v; else S.views.push(v); emit(); H('saveView', v); }
export function deleteView(id: string) { const t = S.views.find(v => v.id === id)?.objectType; S.views = S.views.filter(v => v.id !== id); emit(); H('deleteView', id, t); }
export const getPinned = (obj: ObjKey, def: string[]) => S.pinned[obj] ?? def;
export function setPinned(obj: ObjKey, ids: string[]) { S.pinned[obj] = ids; emit(); H('setPinned', obj, ids); }

/* ---- Apps de desarrollador ---- */
export const apps = () => S.apps;
export function createApp(name: string, description: string, scopes: string[]): AppDef {
  const tok = makeToken(); const sec = `${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
  const a: AppDef = { id: String(40000000 + Math.floor(Math.random() * 999999)), name, description, createdAt: new Date().toISOString(), token: tok, tokenMasked: mask(tok), clientSecret: sec, clientSecretMasked: '********-****-****-****-************', scopes, targetUrl: '', throttle: 10, subs: [] };
  S.apps.unshift(a); if (!CONNECTED) S.audit.unshift({ id: uid(), at: a.createdAt, category: 'Security Activity', subcategory: 'Created a private app', action: 'Create', by: `${ME.firstName} ${ME.lastName}`, source: a.id }); emit(); return a;
}
/** Crea la app (en conectado, en el servidor: el token completo solo se ve en esta respuesta). */
export type AppSecOpts = { expiresInDays?: number | null; allowedCidrs?: string[]; maxRowsPerDay?: number };
export async function createAppAsync(name: string, description: string, scopes: string[], opts: AppSecOpts = {}): Promise<AppDef> {
  if (!CONNECTED) return createApp(name, description, scopes);
  const a = (await hooks.createApp(name, description, scopes, opts)) as AppDef; S.apps.unshift(a); emit(); return a;
}
export function updateApp(id: string, patch: Partial<AppDef>) { const a = S.apps.find(x => x.id === id); if (a) { Object.assign(a, patch); emit(); H('updateApp', id, patch); } return a; }
export async function rotateTokenAsync(id: string, rotateSecret = false, password = ''): Promise<AppDef | null> {
  if (!CONNECTED) return rotateToken(id);
  const a = (await hooks.rotateToken(id, rotateSecret, password)) as AppDef; const i = S.apps.findIndex(x => x.id === id); if (i >= 0) S.apps[i] = a; emit(); return a;
}
/** Devuelve el token o el secreto completos (en conectado: bajo demanda, queda en auditoría del servidor). */
export async function revealApp(id: string, what: 'token' | 'secret', password = ''): Promise<string> {
  const a = S.apps.find(x => x.id === id); if (!a) return '';
  if (!CONNECTED) { logTokenView(id); return what === 'token' ? a.token : a.clientSecret; }
  if (what === 'token' && a.token) return a.token; if (what === 'secret' && a.clientSecret) return a.clientSecret;
  const v = (await hooks.revealApp(id, what, password)) as string; if (what === 'token') a.token = v; else a.clientSecret = v; return v;
}
export function rotateToken(id: string) { const a = S.apps.find(x => x.id === id); if (!a) return null; a.token = makeToken(); a.tokenMasked = mask(a.token); S.audit.unshift({ id: uid(), at: new Date().toISOString(), category: 'Security Activity', subcategory: 'Rotated the private app access token', action: 'Perform', by: `${ME.firstName} ${ME.lastName}`, source: id }); emit(); return a; }
export function logTokenView(id: string) { if (CONNECTED) return; S.audit.unshift({ id: uid(), at: new Date().toISOString(), category: 'Security Activity', subcategory: 'Viewed the private app access token', action: 'Perform', by: `${ME.firstName} ${ME.lastName}`, source: id }); emit(); }
export function deleteApp(id: string) { const a = S.apps.find(x => x.id === id); S.apps = S.apps.filter(x => x.id !== id); emit(); H('deleteApp', id, a?.name ?? ''); }
export const logsFor = (appId: string) => S.logs.filter(l => l.appId === appId);
export const auditLog = () => S.audit;
export const users = () => OWNERS;

/* ---- Propiedades y pipelines editables (Configuración) ---- */
export function addProperty(obj: ObjKey, def: PropDef) { registerProp(obj, def); S.customProps.push({ obj, def }); H('addProperty', obj, def); if (!CONNECTED) S.audit.unshift({ id: uid(), at: new Date().toISOString(), category: 'Settings', subcategory: `Property created (${obj})`, action: 'Create', by: `${ME.firstName} ${ME.lastName}`, source: def.name }); emit(); }
export function savePipelines() { S.pipelines = JSON.parse(JSON.stringify(PIPELINES)); H('savePipelines'); if (!CONNECTED) S.audit.unshift({ id: uid(), at: new Date().toISOString(), category: 'Settings', subcategory: 'Pipelines updated', action: 'Update', by: `${ME.firstName} ${ME.lastName}`, source: 'pipelines' }); emit(); }
/* ---- Sitio: formularios, blog, landings ---- */
export const forms = () => S.forms; export const posts = () => S.posts; export const pages = () => S.pages;
export function saveForm(f: any) { const i = S.forms.findIndex((x: any) => x.id === f.id); if (i >= 0) S.forms[i] = f; else S.forms.unshift(f); emit(); H('saveSite', 'forms', f); }
export function deleteForm(id: string) { S.forms = S.forms.filter((x: any) => x.id !== id); emit(); H('deleteSite', 'forms', id); }
export function savePost(p: any) { const i = S.posts.findIndex((x: any) => x.id === p.id); if (i >= 0) S.posts[i] = p; else S.posts.unshift(p); emit(); H('saveSite', 'posts', p); }
export function deletePost(id: string) { S.posts = S.posts.filter((x: any) => x.id !== id); emit(); H('deleteSite', 'posts', id); }
export function savePage(p: any) { const i = S.pages.findIndex((x: any) => x.id === p.id); if (i >= 0) S.pages[i] = p; else S.pages.unshift(p); emit(); H('saveSite', 'pages', p); }
export function deletePage(id: string) { S.pages = S.pages.filter((x: any) => x.id !== id); emit(); H('deleteSite', 'pages', id); }
export const newId = uid;

/** Alta de registro que espera al servidor en modo conectado (necesita el id real para navegar a la ficha). */
export async function createRecordAsync(obj: ObjKey, props: Record<string, string | null>, assoc?: { to: ObjKey; id: string }[]): Promise<Rec> {
  if (!CONNECTED) return createRecord(obj, props, assoc);
  const r = (await hooks.createRemote(obj, props, assoc)) as Rec;
  S.records[obj] = [r, ...S.records[obj].filter(x => x.id !== r.id)];
  assoc?.forEach(a => associate(obj, r.id, a.to, a.id, false)); emit(); return r;
}
/** Cambia el id temporal de un registro/vista creado en local por el definitivo del servidor. */
export function remapId(kind: 'record' | 'view', obj: ObjKey | null, from: string, to: string, server?: Rec | ViewDef) {
  if (kind === 'record' && obj) {
    S.records[obj] = S.records[obj].map(r => (r.id === from ? ((server as Rec) ?? { ...r, id: to }) : r));
    S.assoc = S.assoc.map(a => ({ ...a, fromId: a.from === obj && a.fromId === from ? to : a.fromId, toId: a.to === obj && a.toId === from ? to : a.toId }));
  } else {
    S.views = S.views.map(v => (v.id === from ? { ...v, id: to } : v));
    for (const k of Object.keys(S.pinned)) S.pinned[k] = S.pinned[k].map(x => (x === from ? to : x));
    try { const u = new URL(location.href); if (u.searchParams.get('view') === from) { u.searchParams.set('view', to); history.replaceState(history.state, '', u); window.dispatchEvent(new PopStateEvent('popstate')); } } catch { /* */ }
  }
  emit();
}
