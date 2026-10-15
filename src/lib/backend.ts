// Adaptador del backend real (VITE_MODE=connected). Diseño: HIDRATACIÓN + ESCRITURA DIRECTA.
//  - start(): GET /bootstrap → se carga en el almacén local (db.ts) → las pantallas siguen usando los mismos hooks síncronos.
//  - Cada mutación de db.ts dispara un gancho (hooks.*) que la envía al servidor por una COLA ordenada (optimista en local);
//    si falla: toast de error y re-hidratación (revierte). Los ids temporales se traducen a los del servidor.
//  - Sondea GET /version cada 15 s y re-hidrata si cambió (solo cuando la cola está vacía).
//  - Si bootstrap trae `truncated[obj]`, las búsquedas de ese objeto pasan al servidor (POST /objects/:type/search, paginado con `after`).
import * as db from './db';
import { mockApi, mockHttp } from './mock-api';
import { applyOptionOverrides } from './propOptions';
import { API_URL, notifyUnauthorized } from './auth';
import { ME, OWNERS, PIPELINES, SETTERS, registerProp, CUSTOM_PROPS, type PropDef } from './schema';
import type { AppDef, AuditRow, ApiLogRow, ObjKey, Owner, Page, Rec, SearchReq, ViewDef } from './types';

export const BASE = `${API_URL}/api/v1`;
export class ApiError extends Error { constructor(public status: number, public code: string, public detail?: unknown) { super(code); } }
export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  if (import.meta.env.VITE_MODE !== 'connected') return mockApi<T>(method, path, body);   // demo: servidor simulado en el navegador
  const r = await fetch(BASE + path, { method, credentials: 'same-origin', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (r.status === 401) { notifyUnauthorized(); throw new ApiError(401, 'unauthorized'); }
  if (r.status === 204) return undefined as T;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (j as any)?.error ?? `http_${r.status}`, j);
  return j as T;
}
/** fetch «crudo» (p. ej. pruebas con un token de aplicación). En demo lo atiende el servidor simulado. */
export async function rawFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; text: () => Promise<string> }> {
  if (import.meta.env.VITE_MODE !== 'connected') { const r = mockHttp(init.method, url, init.headers, init.body); return { status: r.status, text: async () => r.text }; }
  const f = await fetch(url, { method: init.method, credentials: 'omit', headers: init.headers, body: init.body }); return { status: f.status, text: () => f.text() };
}
const errText = (e: unknown) => (e instanceof ApiError ? ({ forbidden: 'sin permiso', record_not_permitted: 'no tienes permiso sobre este registro', missing_scope: 'falta un permiso', invalid_input: 'datos no válidos', unknown_property: 'propiedad desconocida', property_not_writable: 'propiedad no editable', slug_in_use: 'el slug ya existe', invalid_url: 'URL no válida', stage_in_use: 'la etapa aún tiene registros' } as Record<string, string>)[e.code] ?? e.code : (e as Error).message);

let notifier: (m: string, k?: 'ok' | 'err') => void = () => {}; export const setNotifier = (f: typeof notifier) => { notifier = f; };

/* ---------- cola de escritura ordenada + ids temporales ---------- */
let chain: Promise<unknown> = Promise.resolve(); let pending = 0; const idMap = new Map<string, string>(); const rid = (id: string) => idMap.get(id) ?? id;
const knownViews = new Set<string>(); const knownSite = { forms: new Set<string>(), posts: new Set<string>(), pages: new Set<string>() };
function enqueue(label: string, fn: () => Promise<void>) {
  pending++; chain = chain.then(fn).catch(async e => { if (e instanceof ApiError && e.status === 401) return; notifier(`${label}: ${errText(e)}`, 'err'); await rehydrate(); }).finally(() => { pending--; });
  return chain;
}
export const idle = () => chain.then(() => undefined);

/* ---------- hidratación ---------- */
export type Boot = Record<string, any>;
let bootLimit = Number(import.meta.env.VITE_BOOT_LIMIT ?? 0) || 0; let lastVersion = -1; const truncated: Record<string, boolean> = {};
export const isRemote = (obj: ObjKey) => !!truncated[obj];

/* ---------- fichas: completar lo asociado desde el servidor ---------- */
// El arranque trae solo una parte de los datos (los más recientes). Al abrir una ficha se piden sus asociados al servidor y se mezclan en el almacén local.
type Around = { record: Rec & { type: ObjKey }; related: (Rec & { type: ObjKey })[]; assoc: { from: ObjKey; fromId: string; to: ObjKey; toId: string; label?: string }[] };
const pulled = new Map<string, Around>();
function mergeAround(a: Around) {
  db.patchState(S => {
    for (const r of [a.record, ...a.related]) {
      const list = S.records[r.type]; if (!list || list.some(x => x.id === r.id)) continue;
      const { type: _t, ...rec } = r as any; list.push(rec as Rec);
    }
    for (const e of a.assoc) for (const x of [e, { from: e.to, fromId: e.toId, to: e.from, toId: e.fromId, label: e.label }])
      if (!S.assoc.some(y => y.from === x.from && y.fromId === x.fromId && y.to === x.to && y.toId === x.toId)) S.assoc.push(x as any);
  });
}
export async function pullAround(obj: ObjKey, id: string) {
  if (!id || !/^\d+$/.test(id)) return;
  try {
    const a = await api<Around>('GET', `/objects/${obj}/${id}/around`);
    pulled.set(`${obj}:${id}`, a); if (pulled.size > 40) pulled.delete(pulled.keys().next().value as string);
    mergeAround(a);
  } catch { /* sin permiso o sin red: la ficha muestra lo que haya */ }
}
const ownerOf = (o: any): Owner => ({ id: String(o.id), firstName: o.firstName, lastName: o.lastName, email: o.email, teams: o.teams ?? [] });
function apply(b: Boot) {
  lastVersion = b.version;
  OWNERS.splice(0, OWNERS.length, ...(b.owners as any[]).filter(o => o.active !== false).map(ownerOf));
  SETTERS.splice(0, SETTERS.length, ...OWNERS.filter(o => o.teams.includes('Nexa - Hot Leads')));
  // propiedades propias (el catálogo de Nexa es estático en el cliente)
  for (const k of Object.keys(CUSTOM_PROPS)) delete CUSTOM_PROPS[k];
  const customProps: { obj: ObjKey; def: PropDef }[] = [];
  for (const [obj, list] of Object.entries(b.properties ?? {})) for (const d of list as any[]) { const def: PropDef = { name: d.name, label: d.label, type: d.type, fieldType: d.fieldType, groupName: d.groupName, options: d.options, hidden: d.hidden }; registerProp(obj as ObjKey, def); customProps.push({ obj: obj as ObjKey, def }); }
  applyOptionOverrides(b.propertyOverrides);   // colores/etiquetas/orden de opciones personalizados sobre propiedades de Nexa
  for (const t of ['deals', 'appointments', 'tickets', 'leads'] as const) if (b.pipelines?.[t]?.length) PIPELINES[t] = b.pipelines[t];
  const views: ViewDef[] = (b.views as ViewDef[]).filter(v => !v.builtin); knownViews.clear(); views.forEach(v => knownViews.add(v.id));
  for (const k of ['forms', 'posts', 'pages'] as const) { knownSite[k].clear(); (b[k] ?? []).forEach((x: any) => knownSite[k].add(x.id)); }
  Object.assign(truncated, b.truncated ?? {});
  const records = b.records && Object.keys(b.records).length ? b.records : null;
  const apps: AppDef[] = (b.apps ?? []).map(toApp);
  db.hydrate({ ...(records ? { records: { contacts: [], companies: [], deals: [], appointments: [], tasks: [], calls: [], notes: [], meetings: [], ...records } } : {}), assoc: b.assoc ?? [], views, pinned: b.pinned ?? {}, customProps, apps, forms: b.forms ?? [], posts: b.posts ?? [], pages: b.pages ?? [] } as any);
  for (const a of pulled.values()) mergeAround(a);   // lo traído por las fichas abiertas sobrevive a la re-hidratación
}
const toApp = (a: any): AppDef => ({ token: '', clientSecret: '', tokenMasked: '', clientSecretMasked: '', ...a, subs: a.subs ?? [] });
async function load(): Promise<Boot> { const p = new URLSearchParams(); if (bootLimit) p.set('limit', String(bootLimit)); return api('GET', `/bootstrap${p.size ? '?' + p : ''}`); }
export async function rehydrate() { if (pending) return; try { apply(await load()); } catch (e) { if (!(e instanceof ApiError && e.status === 401)) notifier('No se pudo sincronizar con el servidor', 'err'); } }

let poll: ReturnType<typeof setInterval> | null = null;
/** Llamar una vez autenticado: hidrata, registra ganchos y arranca el sondeo. `me` = respuesta de /auth/me. */
export async function start(me: { ownerId: string | null; fullName: string; email: string }) {
  Object.assign(ME, { id: me.ownerId ?? '', firstName: me.fullName.split(' ')[0], lastName: me.fullName.split(' ').slice(1).join(' '), email: me.email, teams: [] });
  registerHooks(); await loadPrefs(); apply(await load());
  if (poll) clearInterval(poll);
  poll = setInterval(async () => { if (pending || document.hidden) return; try { const v = (await api<{ version: number }>('GET', '/version')).version; if (v !== lastVersion) await rehydrate(); } catch { /* sin red */ } }, 15000);
}
/** Preferencias por usuario guardadas en el servidor (p. ej. propiedades fijadas de cada tarjeta). */
export const serverPrefs: Record<string, any> = {};
export async function loadPrefs() { try { Object.assign(serverPrefs, (await api<{ prefs: Record<string, any> }>('GET', '/me/prefs')).prefs); } catch { /* sin prefs: se usan los valores por defecto */ } }
export function savePref(key: string, value: unknown) { serverPrefs[key] = value; api('PUT', `/me/prefs/${encodeURIComponent(key)}`, { value }).catch(() => notifier('No se pudo guardar la preferencia', 'err')); }
export function delPref(key: string) { delete serverPrefs[key]; api('DELETE', `/me/prefs/${encodeURIComponent(key)}`).catch(() => {}); }
export function stop() { if (poll) clearInterval(poll); poll = null; }

/* ---------- búsqueda remota (listas truncadas) ---------- */
export async function remoteSearch(obj: ObjKey, req: SearchReq): Promise<Page<Rec>> {
  const body: Record<string, unknown> = { limit: Math.min(req.limit ?? 50, 500), after: req.after ?? 0 };
  if (req.query) body.query = req.query; if (req.filterGroups?.length) body.filterGroups = req.filterGroups; if (req.sorts?.length) body.sorts = req.sorts;
  const r = await api<{ total: number; results: Rec[]; paging?: { next?: { after: number } } }>('POST', `/objects/${obj}/search`, body);
  return r;
}

/* ---------- ganchos de escritura ---------- */
const SYS = new Set(['hs_object_id', 'createdate', 'hs_createdate', 'lastmodifieddate', 'hs_lastmodifieddate']);
const clean = (p: Record<string, string | null>) => Object.fromEntries(Object.entries(p).filter(([k]) => !SYS.has(k)));
const viewBody = (v: ViewDef) => ({ name: v.name, filterGroups: v.filterGroups, columns: v.columns, sorts: v.sorts, shared: v.shared, ...(v.quickFilters ? { quickFilters: v.quickFilters } : {}), ...(v.kpis ? { kpis: v.kpis } : {}), ...(v.mode ? { mode: v.mode } : {}) });
const strip = <T extends object>(o: T, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

function registerHooks() {
  const h = db.hooks;
  h.create = (obj: ObjKey, rec: Rec, orig: Record<string, string | null>, assoc?: { to: ObjKey; id: string }[]) => enqueue('No se pudo crear', async () => {
    const r = await api<Rec>('POST', `/objects/${obj}`, { properties: clean(orig), ...(assoc?.length ? { associations: assoc.map(a => ({ toType: a.to, toId: rid(a.id) })) } : {}) });
    idMap.set(rec.id, r.id); db.remapId('record', obj, rec.id, r.id, r);
  });
  h.createRemote = async (obj: ObjKey, props: Record<string, string | null>, assoc?: { to: ObjKey; id: string }[]) => {
    await idle(); try { return await api<Rec>('POST', `/objects/${obj}`, { properties: clean(props), ...(assoc?.length ? { associations: assoc.map(a => ({ toType: a.to, toId: rid(a.id) })) } : {}) }); }
    catch (e) { notifier(`No se pudo crear: ${errText(e)}`, 'err'); throw e; }
  };
  h.update = (obj: ObjKey, id: string, props: Record<string, string | null>) => enqueue('No se pudo guardar', async () => { await api('PATCH', `/objects/${obj}/${rid(id)}`, { properties: clean(props) }); });
  h.remove = (obj: ObjKey, ids: string[]) => enqueue('No se pudo eliminar', async () => { if (ids.length === 1) await api('DELETE', `/objects/${obj}/${rid(ids[0])}`); else await api('POST', `/objects/${obj}/batch/archive`, { inputs: ids.map(id => ({ id: rid(id) })) }); });
  h.associate = (a: ObjKey, aId: string, b: ObjKey, bId: string) => enqueue('No se pudo asociar', async () => { await api('PUT', `/objects/${a}/${rid(aId)}/associations/${b}/${rid(bId)}`, {}); });
  h.unassociate = (a: ObjKey, aId: string, b: ObjKey, bId: string) => enqueue('No se pudo quitar la asociación', async () => { await api('DELETE', `/objects/${a}/${rid(aId)}/associations/${b}/${rid(bId)}`); });
  h.saveView = (v: ViewDef) => enqueue('No se pudo guardar la vista', async () => {
    if (knownViews.has(v.id)) { await api('PATCH', `/views/${v.objectType}/${v.id}`, viewBody(v)); return; }
    const r = await api<ViewDef>('POST', `/views/${v.objectType}`, viewBody(v)); knownViews.add(r.id); idMap.set(v.id, r.id); db.remapId('view', null, v.id, r.id);
  });
  h.deleteView = (id: string, t?: ObjKey) => enqueue('No se pudo eliminar la vista', async () => { const v = rid(id); if (!t) return; await api('DELETE', `/views/${t}/${v}`); knownViews.delete(v); });
  h.setPinned = (obj: ObjKey, ids: string[]) => enqueue('No se pudieron fijar las vistas', async () => { await api('PUT', `/views/${obj}/pinned`, { viewIds: ids.map(rid) }); });
  h.addProperty = (obj: ObjKey, def: PropDef) => enqueue('No se pudo crear la propiedad', async () => { await api('POST', `/properties/${obj}`, { name: def.name, label: def.label, type: def.type, fieldType: def.fieldType, ...(def.groupName ? { groupName: def.groupName } : {}), ...(def.options?.length ? { options: def.options.map(o => ({ label: o.label, value: o.value })) } : {}) }); });
  h.savePipelines = () => enqueue('No se pudieron guardar los pipelines', async () => { for (const t of ['deals', 'appointments', 'tickets', 'leads'] as const) { if (!PIPELINES[t]?.length) continue; await api('PUT', `/pipelines/${t}`, { pipelines: PIPELINES[t].map(p => ({ id: p.id, label: p.label, stages: p.stages.map(s => ({ id: s.id, label: s.label, closed: !!s.closed, ...(s.probability ? { probability: String(s.probability) } : {}) })) })) }); } });
  h.createApp = async (name: string, description: string, scopes: string[], opts: Record<string, unknown> = {}) => { await idle(); try { const a = await api<any>('POST', '/dev/apps', { name, description, scopes, ...opts }); return toApp(a); } catch (e) { notifier(`No se pudo crear la app: ${errText(e)}`, 'err'); throw e; } };
  h.rotateToken = async (id: string, rotateSecret: boolean, password: string) => toApp(await api('POST', `/dev/apps/${id}/rotate-token`, { rotateSecret, password }));
  h.revealApp = async (id: string, what: 'token' | 'secret', password: string) => { const r = await api<any>('POST', `/dev/apps/${id}/token-view`, { what, password }); return what === 'token' ? r.token : r.clientSecret; };
  h.deleteApp = (id: string, name: string) => enqueue('No se pudo eliminar la app', async () => { await api('DELETE', `/dev/apps/${id}`, { confirmName: name }); });
  h.updateApp = (id: string, patch: Partial<AppDef>) => enqueue('No se pudo actualizar la app', async () => {
    const base = strip(patch, ['subs', 'targetUrl', 'tokenMasked', 'clientSecretMasked', 'token', 'clientSecret', 'createdAt', 'id', 'expiresAt', 'createdBy']);
    if (Object.keys(base).length) await api('PATCH', `/dev/apps/${id}`, base);
    if (patch.targetUrl !== undefined) await api('PUT', `/dev/apps/${id}/webhooks`, { targetUrl: patch.targetUrl || null });
    if (patch.subs) { const r = await api<any>('PUT', `/dev/apps/${id}/webhooks/subscriptions`, { subscriptions: patch.subs.map(s => ({ objectType: s.objectType, event: s.event, ...(s.property ? { property: s.property } : {}), ...(s.anyProperty ? { anyProperty: true } : {}), ...(s.valueEquals ? { valueEquals: s.valueEquals } : {}), active: s.active })) }); db.patchState(S => { const a = S.apps.find(x => x.id === id); if (a) a.subs = r.subscriptions; }); }
  });
  h.saveSite = (kind: 'forms' | 'posts' | 'pages', item: any) => enqueue('No se pudo guardar', async () => {
    const known = knownSite[kind]; const body = strip(item, ['createdAt', 'updatedAt', 'submissions']);
    const r = known.has(item.id) ? await api<any>('PUT', `/site/${kind}/${item.id}`, body) : await api<any>('POST', `/site/${kind}`, body); known.add(item.id);
    db.patchState(S => { const list = (S as any)[kind] as any[]; const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = { ...list[i], createdAt: r.createdAt, updatedAt: r.updatedAt, ...(r.code ? { code: r.code } : {}) }; });
  });
  h.deleteSite = (kind: 'forms' | 'posts' | 'pages', id: string) => enqueue('No se pudo eliminar', async () => { if (knownSite[kind].has(id)) { await api('DELETE', `/site/${kind}/${id}`); knownSite[kind].delete(id); } });
}
/* ---------- datos de carga perezosa ---------- */
export async function loadLogs() { try { const r = await api<{ results: ApiLogRow[] }>('GET', '/dev/logs?limit=1000'); db.patchState(S => { S.logs = r.results; }); } catch { /* */ } }
export async function loadAudit() {
  try {
    const [a, d] = await Promise.all([api<{ results: AuditRow[] }>('GET', '/admin/audit?limit=500').catch(() => ({ results: [] as AuditRow[] })), api<{ results: any[] }>('GET', '/dev/audit?limit=200').catch(() => ({ results: [] as any[] }))]);
    const dev: AuditRow[] = d.results.map(r => ({ id: `d${r.id}`, at: r.at, category: 'Security Activity', subcategory: String(r.action), action: 'Perform', by: '', source: r.app_id == null ? '' : String(r.app_id) }));
    db.patchState(S => { S.audit = [...a.results, ...dev]; });
  } catch { /* */ }
}
export async function loadUsage() { try { return await api<{ dailyLimit: number; todayTotal: number; today: any[]; byDay: any[] }>('GET', '/dev/usage?days=7'); } catch { return null; } }
