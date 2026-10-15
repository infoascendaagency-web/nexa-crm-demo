// Modelo de permisos del CRM (réplica del editor de acceso de Nexa, spec §15).
// Demo: se guarda en localStorage. Conectado: el backend devolverá los permisos efectivos del usuario en /auth/me
// (campo `perms`) y se inyectan con `setServerPerms()`; la UI solo OCULTA, el servidor es quien impone el acceso.
import { useSyncExternalStore } from 'react';
import { OWNERS, SETTERS } from './schema';
import type { ObjKey, Owner } from './types';
import { MODE, useAuth } from './auth';
import { api } from './backend';

export type Scope = 'all' | 'team' | 'own' | 'none';
export type Seat = 'Core' | 'View-Only' | 'Sales Professional';
export type Gran = 'view' | 'edit' | 'del' | 'merge';
export type ObjPerm = { on: boolean; view: Scope; edit: Scope; del: Scope; merge: Scope; unassigned: Record<Gran, boolean>; create: boolean };
export type Perms = { seat: Seat; mode: 'manual' | 'preset'; presetId?: string; objects: Record<string, ObjPerm>; tools: Record<string, boolean>; sections: Record<string, boolean> };
export type Preset = { id: string; name: string; perms: Perms };

export const PERM_OBJECTS: ObjKey[] = ['contacts', 'companies', 'deals', 'appointments', 'tasks', 'calls', 'meetings', 'notes'];
export const GRANS: { id: Gran; label: string; critical?: boolean }[] = [{ id: 'view', label: 'Ver' }, { id: 'edit', label: 'Editar' }, { id: 'del', label: 'Eliminar', critical: true }, { id: 'merge', label: 'Combinar' }];
export const SCOPE_LABEL: Record<Scope, string> = { all: 'Todos los registros', team: 'Los de su equipo', own: 'Los suyos', none: 'Ninguno' };
export const TOOLS: { id: string; label: string; hint?: string }[] = [
  { id: 'communicate', label: 'Comunicar (llamar, correo, SMS)' }, { id: 'bulkDelete', label: 'Eliminación masiva', hint: 'Crítico' }, { id: 'import', label: 'Importar' }, { id: 'export', label: 'Exportar' },
  { id: 'editTasks', label: 'Editar tareas de otros clientes' }, { id: 'editAssoc', label: 'Editar asociaciones' }, { id: 'dataAgent', label: 'Acceso a Data Agent' }, { id: 'customizeLayout', label: 'Personalizar el diseño de la ficha' },
  { id: 'viewConnected', label: 'Ver datos de registros conectados' }, { id: 'customViews', label: 'Vistas personalizadas' }, { id: 'createViews', label: 'Crear vistas CRM en la página índice' },
];
// Secciones del CRM propio (además de los objetos). `settings` = Configuración de la cuenta (usuarios, propiedades, auditoría…).
export const SECTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'dashAdmin', label: 'Dashboard admin', hint: 'Panel de gestión del equipo y de la operación' }, { id: 'dashSetters', label: 'Dashboard setters', hint: 'Panel de productividad de los setters' }, { id: 'dashTeam', label: 'Dashboard · Gestionar setters', hint: 'Agregar/quitar setters y cambiar metas, país, tipo y rendimiento (pestaña de gestión)' },
  { id: 'reports', label: 'Informes', hint: 'Informes y analítica' }, { id: 'site', label: 'Sitio (todo)', hint: 'Formularios y blog' }, { id: 'siteForms', label: 'Sitio · Solo formularios', hint: 'Crear y editar formularios' }, { id: 'siteBlog', label: 'Sitio · Solo blog', hint: 'Crear y editar artículos' }, { id: 'siteTags', label: 'Sitio · Códigos y scripts', hint: 'Pegar GTM, GA4, píxeles u otro código que se ejecuta en las páginas públicas. NO lo incluye “Sitio (todo)”: se concede aparte' }, { id: 'automation', label: 'Automatización', hint: 'Resumen de n8n' },
  { id: 'dev', label: 'Desarrollo', hint: 'Apps privadas, tokens, webhooks y registros de la API' }, { id: 'integrations', label: 'Integraciones', hint: 'Meta, Google, Dialpad, n8n…' }, { id: 'social', label: 'Redes sociales', hint: 'Bandeja de Instagram/Facebook y respuestas automáticas' }, { id: 'ecommerce', label: 'E-commerce', hint: 'Tienda, inventario, pedidos y métricas de ventas' }, { id: 'settings', label: 'Ajustes de cuenta', hint: 'Usuarios, propiedades, objetos, auditoría, importación' },
];
export const PERM_NAV = ['CRM · Objetos', 'CRM · Herramientas', 'Secciones del CRM', 'Marketing', 'Ventas', 'Ingresos', 'Servicio', 'Gestión de datos', 'Automatización', 'Informes', 'Funciones de IA', 'Cuenta'];

const full = (): ObjPerm => ({ on: true, view: 'all', edit: 'all', del: 'all', merge: 'all', unassigned: { view: true, edit: true, del: true, merge: true }, create: true });
const none = (): ObjPerm => ({ on: false, view: 'none', edit: 'none', del: 'none', merge: 'none', unassigned: { view: false, edit: false, del: false, merge: false }, create: false });
export type Role = 'admin' | 'setter' | 'viewer';
export function defaultPerms(role: Role): Perms {
  const objects: Record<string, ObjPerm> = {}; PERM_OBJECTS.forEach(o => { objects[o] = role === 'admin' ? full() : none(); });
  const tools: Record<string, boolean> = {}; TOOLS.forEach(t => { tools[t.id] = role === 'admin'; });
  const sections: Record<string, boolean> = {}; SECTIONS.forEach(s => { sections[s.id] = role === 'admin'; });
  if (role === 'setter') {
    (['contacts', 'appointments', 'tasks', 'calls', 'notes', 'meetings'] as ObjKey[]).forEach(o => { objects[o] = { on: true, view: 'all', edit: 'all', del: 'own', merge: o === 'contacts' ? 'all' : 'none', unassigned: { view: true, edit: true, del: false, merge: false }, create: true }; });
    objects.companies = { ...full(), edit: 'own', del: 'none', merge: 'none', unassigned: { view: true, edit: false, del: false, merge: false } };
    objects.deals = { on: true, view: 'own', edit: 'own', del: 'none', merge: 'none', unassigned: { view: false, edit: false, del: false, merge: false }, create: false };
    Object.assign(tools, { communicate: true, import: false, export: false, customViews: true, createViews: true, editAssoc: true }); sections.dashSetters = true;
  }
  if (role === 'viewer') { PERM_OBJECTS.forEach(o => { objects[o] = { ...none(), on: true, view: 'own' }; }); sections.dashSetters = true; }
  return { seat: role === 'admin' ? 'Sales Professional' : role === 'setter' ? 'Core' : 'View-Only', mode: 'manual', objects, tools, sections };
}
export const roleOf = (userId: string): Role => { const o = OWNERS.find(x => x.id === userId); if (!o) return 'admin'; if (o.email === 'alex.rivera@nexa.example' || o.email === 'marta.soler@nexa.example') return 'admin'; return SETTERS.some(s => s.id === userId) ? 'setter' : 'viewer'; };

/* ---- Conexión con el servidor (modo conectado): mapeo de ids y capa de administración ---- */
export const TOOL_MAP: Record<string, string> = { communicate: 'communicate', bulkDelete: 'bulk_delete', import: 'import', export: 'export', editTasks: 'edit_customer_tasks', editAssoc: 'edit_associations', dataAgent: 'data_agent', customizeLayout: 'customize_record_layout', viewConnected: 'view_connected_data', customViews: 'custom_views', createViews: 'create_views' };
export const SECTION_MAP: Record<string, string> = { dashAdmin: 'dashboard_admin', dashSetters: 'dashboard_setters', dashTeam: 'dashboard_team', reports: 'reports', site: 'site', siteForms: 'site_forms', siteBlog: 'site_blog', siteTags: 'site_tags', automation: 'automation', dev: 'developer', integrations: 'integrations', social: 'social', ecommerce: 'ecommerce', settings: 'settings' };
const sc = (v: unknown): Scope => (v === 'their' || v === 'own' ? 'own' : v === 'team' ? 'team' : v === 'all' ? 'all' : 'none');
const scOut = (v: Scope) => (v === 'own' ? 'their' : v);
const seatOfServer = (x?: string): Seat => (/sales/i.test(x ?? '') ? 'Sales Professional' : /view/i.test(x ?? '') ? 'View-Only' : 'Core');
const seatOut = (x: Seat) => (x === 'Sales Professional' ? 'sales_professional' : x === 'View-Only' ? 'view_only' : 'core');
/** Sección con herencia: 'site' incluye formularios y blog; 'siteAny' = cualquiera de las tres (para el menú). */
const SEC_PARENT: Record<string, string> = { siteForms: 'site', siteBlog: 'site' };   // siteTags NO hereda de `site` (ejecuta código en páginas públicas)
export const secOf = (s: Record<string, boolean>, id: string): boolean => id === 'siteAny' ? !!(s.site || s.siteForms || s.siteBlog || s.siteTags) : !!(s[id] || (SEC_PARENT[id] && s[SEC_PARENT[id]]));
/** Capa de permisos del servidor (forma `permissions` de /auth/me o parcial de usuario/preset) sobre una base. */
export function layerServer(base: Perms, raw: any): Perms {
  const out: Perms = JSON.parse(JSON.stringify(base));
  for (const o of PERM_OBJECTS) { const x = raw?.objects?.[o]; if (!x) continue; const cur = out.objects[o] ?? defaultPerms('viewer').objects[o];
    const n: ObjPerm = { ...cur, view: x.view ? sc(x.view) : cur.view, edit: x.edit ? sc(x.edit) : cur.edit, del: x.delete ? sc(x.delete) : cur.del, merge: x.merge ? sc(x.merge) : cur.merge, create: typeof x.create === 'boolean' ? x.create : cur.create,
      unassigned: { view: x.viewUnassigned ?? cur.unassigned.view, edit: x.editUnassigned ?? cur.unassigned.edit, del: x.deleteUnassigned ?? cur.unassigned.del, merge: x.mergeUnassigned ?? cur.unassigned.merge }, on: true };
    n.on = n.view !== 'none' || n.unassigned.view || n.create || n.edit !== 'none'; out.objects[o] = n; }
  for (const [k, sk] of Object.entries(TOOL_MAP)) if (typeof raw?.tools?.[sk] === 'boolean') out.tools[k] = raw.tools[sk];
  for (const [k, sk] of Object.entries(SECTION_MAP)) if (typeof raw?.sections?.[sk] === 'boolean') out.sections[k] = raw.sections[sk];
  return out;
}
/** Defaults del servidor por rol (espejo de backend/src/lib/permissions.ts → defaults()). */
export function serverDefaults(role: 'admin' | 'manager' | 'setter'): Perms {
  const p = defaultPerms('viewer'); const all = role !== 'setter';
  PERM_OBJECTS.forEach(o => { p.objects[o] = { on: true, view: 'all', edit: 'all', del: role === 'setter' ? 'own' : 'all', merge: all ? 'all' : 'none', unassigned: { view: role === 'admin', edit: role === 'admin', del: role === 'admin', merge: role === 'admin' }, create: true }; });
  TOOLS.forEach(t => { p.tools[t.id] = role === 'admin' || (role === 'manager' && t.id !== 'dataAgent' && t.id !== 'viewConnected') || (role === 'setter' && ['communicate', 'editTasks', 'editAssoc', 'customViews', 'createViews'].includes(t.id)); });
  SECTIONS.forEach(s => { p.sections[s.id] = role === 'admin' || (role === 'manager' && ['dashAdmin', 'dashSetters', 'reports', 'site', 'siteForms', 'siteBlog'].includes(s.id)) || (role === 'setter' && s.id === 'dashSetters'); });
  p.seat = role === 'admin' ? 'Sales Professional' : 'Core'; return p;
}
export function toServer(p: Perms) {
  return { objects: Object.fromEntries(PERM_OBJECTS.map(o => { const x = p.objects[o]; return [o, { view: x.on ? scOut(x.view) : 'none', edit: x.on ? scOut(x.edit) : 'none', delete: x.on ? scOut(x.del) : 'none', merge: x.on ? scOut(x.merge) : 'none', create: x.on && x.create, viewUnassigned: x.on && x.unassigned.view, editUnassigned: x.on && x.unassigned.edit, deleteUnassigned: x.on && x.unassigned.del, mergeUnassigned: x.on && x.unassigned.merge }]; })),
    tools: Object.fromEntries(Object.entries(TOOL_MAP).map(([k, sk]) => [sk, !!p.tools[k]])), sections: Object.fromEntries([...new Set(Object.values(SECTION_MAP))].map(sk => [sk, Object.entries(SECTION_MAP).some(([k, v]) => v === sk && p.sections[k])])) };
}
export const fromMe = (me: any): Perms => { const b = layerServer(defaultPerms('viewer'), me.permissions); b.seat = seatOfServer(me.seat); return b; };
export type AdminUser = { id: number; email: string; fullName: string; role: 'admin' | 'manager' | 'setter'; active: boolean; ownerId: string | null; teamIds: number[]; permissionSetId: number | null; permissions: any; seat: string; mustChangePassword?: boolean; twoFactorEnabled?: boolean; emailVerified?: boolean; requireEmailVerification?: boolean; lastLogin?: string | null; lockedUntil?: string | null; tempPasswordExpiresAt?: string | null };
export type AdminTeam = { id: number; name: string; description?: string | null };
export const adminCache: { users: AdminUser[]; teams: AdminTeam[]; sets: { id: number; name: string; permissions: any; isPreset: boolean }[]; loaded: boolean } = { users: [], teams: [], sets: [], loaded: false };
export async function loadAdmin() {
  if (MODE !== 'connected') return; try {
    const [u, t, ps] = await Promise.all([api<any>('GET', '/admin/users'), api<any>('GET', '/admin/teams'), api<any>('GET', '/admin/permission-sets')]);
    adminCache.users = u.results; adminCache.teams = t.results; adminCache.sets = ps.results; adminCache.loaded = true; emit();
  } catch { /* sin acceso de admin */ }
}
const userByOwner = (key: string) => adminCache.users.find(u => u.ownerId === key || `u${u.id}` === key);
/** Usuarios para las pantallas de administración (en conectado, todos los usuarios activos del servidor; en demo, OWNERS). */
export const userList = (): Owner[] => (MODE === 'connected' && adminCache.loaded ? adminCache.users.filter(u => u.active).map(u => ({ id: u.ownerId ?? `u${u.id}`, firstName: u.fullName.split(' ')[0], lastName: u.fullName.split(' ').slice(1).join(' '), email: u.email, teams: u.teamIds.map(t => adminCache.teams.find(x => x.id === t)?.name ?? '') })) : OWNERS);
export const adminUserFor = userByOwner;
export async function adminApi(method: string, path: string, body?: unknown) { const r = await api(method, path, body); await loadAdmin(); return r; }
const permsFromAdmin = (u: AdminUser): Perms => { let b = serverDefaults(u.role); const set = adminCache.sets.find(x => x.id === u.permissionSetId); if (set) b = layerServer(b, set.permissions); b = layerServer(b, u.permissions); b.seat = seatOfServer(u.seat); b.mode = set ? 'preset' : 'manual'; b.presetId = set ? String(set.id) : undefined; return b; };

/* ---- almacén (localStorage) ---- */
const K = 'nx-perms-v2', KP = 'nx-presets-v1', KV = 'nx-viewas';
const read = <T,>(k: string, d: T): T => { try { return (JSON.parse(localStorage.getItem(k) ?? '') as T) ?? d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };
let tick = 0; const ls = new Set<() => void>(); const emit = () => { tick++; ls.forEach(l => l()); };
const sub = (l: () => void) => { ls.add(l); return () => { ls.delete(l); }; };
let server: Perms | null = null; let serverSuper = false;
export const setServerPerms = (p: Perms | null, superAdmin = false) => { server = p; serverSuper = superAdmin; emit(); };
export const permsOf = (userId: string): Perms => { if (MODE === 'connected') { const u = userByOwner(userId); return u ? permsFromAdmin(u) : defaultPerms('viewer'); } return read<Record<string, Perms>>(K, {})[userId] ?? defaultPerms(roleOf(userId)); };
export const savePerms = (userId: string, p: Perms) => { if (MODE === 'connected') { const u = userByOwner(userId); if (u) void adminApi('PATCH', `/admin/users/${u.id}`, { permissions: toServer(p), seat: seatOut(p.seat), permissionSetId: p.mode === 'preset' && p.presetId ? Number(p.presetId) : null }).catch(e => alert('No se pudieron guardar los permisos: ' + (e?.code ?? e))); return; } write(K, { ...read<Record<string, Perms>>(K, {}), [userId]: p }); emit(); };
export const presets = (): Preset[] => MODE === 'connected' ? adminCache.sets.map(x => ({ id: String(x.id), name: x.name, perms: layerServer(serverDefaults('setter'), x.permissions) })) : read<Preset[]>(KP, [{ id: 'p-setter', name: 'Setter estándar', perms: defaultPerms('setter') }, { id: 'p-viewer', name: 'Solo lectura', perms: defaultPerms('viewer') }]);
export const savePresets = (p: Preset[]) => {
  if (MODE === 'connected') { const cur = adminCache.sets; void (async () => { try { for (const x of cur.filter(c => !p.some(n => n.id === String(c.id)) && !c.isPreset)) await api('DELETE', `/admin/permission-sets/${x.id}`); for (const n of p.filter(n => !cur.some(c => String(c.id) === n.id))) await api('POST', '/admin/permission-sets', { name: n.name, permissions: toServer(n.perms) }); await loadAdmin(); } catch (e: any) { alert('No se pudo guardar el preset: ' + (e?.code ?? e)); } })(); return; }
  write(KP, p); emit();
};
export const viewAs = (): string | null => read<string | null>(KV, null);
export const setViewAs = (id: string | null) => { write(KV, id); emit(); };

/** Acceso efectivo del usuario actual (o del usuario "ver como" si el real es admin). */
export function useAccess() {
  useSyncExternalStore(sub, () => tick); const { user, mode } = useAuth();
  if (mode === 'connected') {
    const p = server ?? defaultPerms('viewer'); const isAdmin = serverSuper;
    return { perms: p, isAdmin, realIsAdmin: isAdmin, viewingAs: null as Owner | null, section: (id: string) => isAdmin || secOf(p.sections, id), obj: (o: ObjKey, g: 'on' | 'create' | Gran = 'on') => { if (isAdmin) return true; const x = p.objects[o]; if (!x?.on) return false; if (g === 'on') return true; if (g === 'create') return x.create; return x[g] !== 'none' || x.unassigned[g]; }, tool: (id: string) => isAdmin || !!p.tools[id] };
  }
  const realIsAdmin = roleOf(user.id) === 'admin'; const as = realIsAdmin ? viewAs() : null; const uid = as ?? user.id;
  const p = permsOf(uid); const isAdmin = roleOf(uid) === 'admin' && !as;
  const section = (id: string) => isAdmin || secOf(p.sections, id);
  const obj = (o: ObjKey, g: 'on' | 'create' | Gran = 'on') => { const x = p.objects[o]; if (!x?.on) return false; if (g === 'on' || g === 'create') return g === 'on' ? true : x.create; return x[g] !== 'none' || x.unassigned[g]; };
  const tool = (id: string) => isAdmin || !!p.tools[id];
  return { perms: p, isAdmin, realIsAdmin, viewingAs: as ? OWNERS.find(o => o.id === as) ?? null : null, section, obj, tool };
}
