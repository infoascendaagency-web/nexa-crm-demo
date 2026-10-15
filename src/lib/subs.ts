// Capa de datos de las suscripciones de webhooks (Desarrollo → Aplicaciones → Webhooks).
// Modo conectado: llama al backend (/dev/apps/:id/webhooks/…) y refresca las suscripciones de la app en el almacén.
// Modo demostración: opera sobre el almacén local (db.ts) y simula la prueba.
import * as db from './db';
import { api, ApiError } from './backend';
import type { AppDef, ObjKey } from './types';

export type Sub = AppDef['subs'][number];
export type NewSub = { objectType: ObjKey; event: Sub['event']; properties?: string[]; anyProperty?: boolean; valueEquals?: string };
export type TestResult = { ok: boolean; status: number; ms: number; error?: string; simulated?: boolean };

/** Texto en español de un error del backend. */
export function subsErrText(e: unknown): string {
  if (e instanceof ApiError) {
    const d = (e.detail as { message?: string } | undefined)?.message;
    const map: Record<string, string> = { unknown_property: 'Esa propiedad no existe en el objeto.', duplicate_subscription: 'Ya existe una suscripción igual.', too_many_subscriptions: 'Se alcanzó el máximo de suscripciones por aplicación.', not_found: 'No se encontró la suscripción (¿otra persona la eliminó?).', no_target_url: 'Configura primero la URL de destino.', invalid_body: d ?? 'Datos no válidos.', invalid_input: 'Datos no válidos.', forbidden: 'No tienes permiso.' };
    return map[e.code] ?? d ?? `Error del servidor (${e.code})`;
  }
  return 'No se pudo completar la acción.';
}

const refresh = async (appId: string) => {
  const r = await api<{ subscriptions: Sub[] }>('GET', `/dev/apps/${appId}/webhooks`);
  db.patchState(S => { const a = S.apps.find(x => x.id === appId); if (a) a.subs = r.subscriptions; });
};
const key = (s: { objectType: string; event: string; property?: string; valueEquals?: string }) => `${s.objectType}|${s.event}|${s.property ?? ''}|${s.valueEquals ?? ''}`;
const demoApp = (id: string) => db.state().apps.find(a => a.id === id);

/** Crea suscripciones (una por propiedad). Las repetidas no se duplican y se devuelven en `duplicates`. */
export async function createSubs(app: AppDef, n: NewSub): Promise<{ created: Sub[]; duplicates: Sub[] }> {
  if (db.CONNECTED) {
    const r = await api<{ created: Sub[]; duplicates: Sub[] }>('POST', `/dev/apps/${app.id}/webhooks/subscriptions/bulk`, { objectType: n.objectType, event: n.event, ...(n.properties?.length ? { properties: n.properties } : {}), ...(n.anyProperty ? { anyProperty: true } : {}), ...(n.valueEquals ? { valueEquals: n.valueEquals } : {}) });
    await refresh(app.id); return r;
  }
  const a = demoApp(app.id); const have = new Map((a?.subs ?? []).map(s => [key(s), s]));
  const list: Omit<Sub, 'id' | 'total' | 'errors' | 'active'>[] = n.event !== 'propertyChange' ? [{ objectType: n.objectType, event: n.event }]
    : n.anyProperty ? [{ objectType: n.objectType, event: n.event, anyProperty: true }] : (n.properties ?? []).map(p => ({ objectType: n.objectType, event: n.event, property: p, ...(n.valueEquals ? { valueEquals: n.valueEquals } : {}) }));
  const created: Sub[] = [], duplicates: Sub[] = [];
  for (const s of list) { const ex = have.get(key(s)); if (ex) { duplicates.push(ex); continue; } created.push({ ...s, id: `s${Date.now()}${created.length}`, active: true, total: 0, errors: 0 }); }
  if (created.length) db.updateApp(app.id, { subs: [...(a?.subs ?? []), ...created] });
  return { created, duplicates };
}
export async function patchSub(app: AppDef, sid: string, patch: { active?: boolean; property?: string; anyProperty?: boolean; valueEquals?: string | null }) {
  if (db.CONNECTED) { await api('PATCH', `/dev/apps/${app.id}/webhooks/subscriptions/${sid}`, patch); await refresh(app.id); return; }
  db.updateApp(app.id, { subs: app.subs.map(s => s.id !== sid ? s : { ...s, ...(patch.active !== undefined ? { active: patch.active } : {}), ...(patch.property ? { property: patch.property, anyProperty: false } : {}), ...(patch.anyProperty ? { anyProperty: true, property: undefined } : {}), ...(patch.valueEquals !== undefined ? { valueEquals: patch.valueEquals || undefined } : {}) }) });
}
export async function deleteSub(app: AppDef, sid: string) {
  if (db.CONNECTED) { await api('DELETE', `/dev/apps/${app.id}/webhooks/subscriptions/${sid}`); await refresh(app.id); return; }
  db.updateApp(app.id, { subs: app.subs.filter(s => s.id !== sid) });
}
export async function saveTargetUrl(app: AppDef, url: string) { db.updateApp(app.id, { targetUrl: url }); }
/** Envía un evento de prueba firmado a la URL de destino (modo demostración: simulado). */
export async function sendTest(app: AppDef, sid: string): Promise<TestResult> {
  if (db.CONNECTED) { const r = await api<TestResult>('POST', `/dev/apps/${app.id}/webhooks/test`, { subscriptionId: sid }); await refresh(app.id); return r; }
  return { ok: true, status: 200, ms: 0, simulated: true };
}
export const loadSubs = (appId: string) => (db.CONNECTED ? refresh(appId) : Promise.resolve());
