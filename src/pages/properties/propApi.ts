// Guardado de personalizaciones de propiedades (opciones con color, ajuste "permitir crear propiedades"). Local primero; en modo conectado además PATCH al servidor.
import { api, rehydrate } from '../../lib/backend';
import { CONNECTED, patchState } from '../../lib/db';
import { saveDemo, setLocalOptions } from '../../lib/propOptions';
import type { PropOption } from '../../lib/schema';
import type { ObjKey } from '../../lib/types';

const clean = (o: PropOption[]) => o.map(x => ({ label: x.label.trim() || x.value, value: x.value, hidden: !!x.hidden, color: x.color ?? null }));
export async function saveOptions(obj: ObjKey, name: string, options: PropOption[]) {
  const body = clean(options); setLocalOptions(obj, name, body); patchState(() => {}); if (!CONNECTED) { saveDemo(); return; }
  try { await api('PATCH', `/properties/${obj}/${name}`, { options: body }); } catch (e) { await rehydrate(); throw e; }
}
export async function resetOptions(obj: ObjKey, name: string) {
  setLocalOptions(obj, name, null); patchState(() => {}); if (!CONNECTED) { saveDemo(); return; }
  try { await api('PATCH', `/properties/${obj}/${name}`, { resetOptions: true }); await rehydrate(); } catch (e) { await rehydrate(); throw e; }
}
const CFG_KEY = 'nx-allow-new-properties';
export async function getAllowNew(): Promise<boolean> {
  if (CONNECTED) { try { return (await api<{ allowNewProperties: boolean }>('GET', '/properties-config')).allowNewProperties !== false; } catch { return true; } }
  try { return localStorage.getItem(CFG_KEY) !== 'false'; } catch { return true; }
}
export async function setAllowNew(v: boolean) {
  if (CONNECTED) { await api('PUT', '/properties-config', { allowNewProperties: v }); return; }
  try { localStorage.setItem(CFG_KEY, String(v)); } catch { /* */ }
}
