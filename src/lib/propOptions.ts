// Personalización de OPCIONES de propiedades de enumeración (color, etiqueta, orden, oculta) sobre el catálogo de Nexa.
// El catálogo es estático en el cliente; las ediciones del admin viajan del servidor en bootstrap.propertyOverrides y se aplican aquí EN SITIO
// (los PropDef son objetos compartidos). En modo demo se guardan en localStorage. Los valores internos jamás cambian.
import { CATALOG, propDef, type PropOption } from './schema';
import { CONNECTED } from './db';
import type { ObjKey } from './types';

const orig = new Map<string, PropOption[] | undefined>();   // snapshot del catálogo antes de aplicar overrides
const KEY = 'nx-crm-prop-options';
const clone = (o?: PropOption[]) => (o ? o.map(x => ({ ...x })) : undefined);

/** Aplica (o reaplica) las personalizaciones del servidor. Restaura primero lo anterior para que borrarlas se refleje. */
export function applyOptionOverrides(ov: Record<string, Record<string, PropOption[]>> | undefined) {
  for (const [k, o] of orig) { const [obj, name] = k.split('.'); const d = propDef(obj as ObjKey, name); if (d) d.options = o; }
  orig.clear();
  for (const [obj, m] of Object.entries(ov ?? {})) for (const [name, opts] of Object.entries(m)) {
    const d = propDef(obj as ObjKey, name); if (!d) continue;
    orig.set(`${obj}.${name}`, d.options); d.options = clone(opts);
  }
}
/** Cambio local inmediato (el guardado en servidor lo hace propApi). `null` = volver a los valores originales. */
export function setLocalOptions(obj: ObjKey, name: string, options: PropOption[] | null) {
  const d = propDef(obj, name); if (!d) return; const k = `${obj}.${name}`;
  if (options === null) { if (orig.has(k)) { d.options = orig.get(k); orig.delete(k); } return; }
  if ((CATALOG[obj] ?? []).includes(d) && !orig.has(k)) orig.set(k, d.options);
  d.options = clone(options);
}
export const isCustomized = (obj: ObjKey, name: string) => orig.has(`${obj}.${name}`);

/* ---- persistencia SOLO para el modo demo ---- */
export function saveDemo() {
  try { const out: Record<string, Record<string, PropOption[]>> = {}; for (const k of orig.keys()) { const [obj, name] = k.split('.'); const d = propDef(obj as ObjKey, name); if (d?.options) (out[obj] ??= {})[name] = d.options; } localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* */ }
}
export function loadDemo() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v) applyOptionOverrides(v); } catch { /* */ }
}

if (!CONNECTED) loadDemo();   // demo: recupera personalizaciones guardadas
