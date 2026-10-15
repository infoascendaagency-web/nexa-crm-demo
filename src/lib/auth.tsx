// Sesión y autenticación. PUNTO DE EXTENSIÓN: en modo conectado (VITE_MODE=connected) la app exige sesión.
// Contrato esperado del backend (cookie de sesión httpOnly + Secure + SameSite; el token NUNCA toca localStorage):
//   POST {API}/auth/login   { email, password }  -> 200 { user }  | 401 { error } | 423/429 { error, retryAfter? (s) }
//   GET  {API}/auth/me                          -> 200 { user }  | 401
//   POST {API}/auth/logout                      -> 204
// La capa de datos (api.ts) debe llamar a `notifyUnauthorized()` ante cualquier 401 para mostrar "sesión expirada".
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ME } from './schema';

export const MODE: 'demo' | 'connected' = import.meta.env.VITE_MODE === 'connected' ? 'connected' : 'demo';
export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
export type SessionUser = { id: string; name: string; email: string; role?: string; ownerId?: string | null; me?: any };
const fromMe = (m: any): SessionUser => ({ id: String(m.id), name: m.fullName, email: m.email, role: m.role === 'admin' ? 'Super admin' : m.role === 'manager' ? 'Gestor' : 'Setter', ownerId: m.ownerId ?? null, me: m });
export type LoginResult = { ok: true } | { ok: false; error: string; lockedFor?: number; need2fa?: undefined } | { ok: false; need2fa: true; challenge: string; error: '' };
type Status = 'loading' | 'anon' | 'authed';
type Ctx = { mode: typeof MODE; status: Status; user: SessionUser; expired: boolean; login: (email: string, password: string) => Promise<LoginResult>; verify2fa: (challenge: string, code: string) => Promise<LoginResult>; refresh: () => Promise<void>; logout: () => Promise<void> };

const DEMO_USER: SessionUser = { id: ME.id, name: `${ME.firstName} ${ME.lastName}`, email: ME.email, role: 'Super admin' };
const AuthCtx = createContext<Ctx>({ mode: 'demo', status: 'authed', user: DEMO_USER, expired: false, login: async () => ({ ok: true }), verify2fa: async () => ({ ok: true }), refresh: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(AuthCtx);

const EVT = 'nx:unauthorized';
/** Llamar desde la capa de datos cuando el servidor responda 401: muestra la pantalla de login conservando la ruta actual. */
export const notifyUnauthorized = () => window.dispatchEvent(new Event(EVT));
/** fetch con cookies de sesión y detección de 401. Pensado para que api.ts lo use en la fase de backend. */
export async function authFetch(path: string, init: RequestInit = {}) {
  const r = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  if (r.status === 401) notifyUnauthorized();
  return r;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(MODE === 'demo' ? 'authed' : 'loading'); const [user, setUser] = useState<SessionUser>(DEMO_USER); const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (MODE === 'demo') return; let alive = true;
    fetch(`${API_URL}/api/v1/auth/me`, { credentials: 'include' }).then(async r => { if (!alive) return; if (r.ok) { setUser(fromMe(await r.json())); setStatus('authed'); } else setStatus('anon'); }).catch(() => alive && setStatus('anon'));
    const h = () => { setExpired(true); setStatus('anon'); }; window.addEventListener(EVT, h);
    return () => { alive = false; window.removeEventListener(EVT, h); };
  }, []);
  const login = useCallback<Ctx['login']>(async (email, password) => {
    try {
      const r = await fetch(`${API_URL}/api/v1/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.requires2fa) return { ok: false, need2fa: true, challenge: String(j.challenge), error: '' };
      if (r.ok) { const m = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: 'include' }); if (!m.ok) return { ok: false, error: 'No se pudo cargar tu sesión.' }; setUser(fromMe(await m.json())); setExpired(false); setStatus('authed'); return { ok: true }; }
      if (r.status === 403 && j.error === 'email_not_verified') return { ok: false, error: 'Tu correo aún no está verificado. Pídele a un administrador que lo active.' };
      if (r.status === 423 || r.status === 429) { const ra = Number(j.retryAfter ?? r.headers.get('Retry-After') ?? (j.error === 'locked' ? 900 : 60)); return { ok: false, error: j.error === 'locked' ? 'Cuenta bloqueada por demasiados intentos.' : 'Demasiados intentos.', lockedFor: Number.isFinite(ra) ? ra : 60 }; }
      return { ok: false, error: r.status === 401 ? 'Correo o contraseña incorrectos.' : (j.error ?? 'No se pudo iniciar sesión.') };
    } catch { return { ok: false, error: 'No hay conexión con el servidor. Inténtalo de nuevo en unos segundos.' }; }
  }, []);
  const verify2fa = useCallback<Ctx['verify2fa']>(async (challenge, code) => {
    try {
      const r = await fetch(`${API_URL}/api/v1/auth/login/2fa`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge, code }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { const m = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: 'include' }); if (!m.ok) return { ok: false, error: 'No se pudo cargar tu sesión.' }; setUser(fromMe(await m.json())); setExpired(false); setStatus('authed'); return { ok: true }; }
      if (r.status === 429) return { ok: false, error: 'Demasiados intentos. Espera unos minutos.', lockedFor: Number(r.headers.get('Retry-After') ?? 900) };
      return { ok: false, error: r.status === 401 && j.error === 'invalid_code' ? 'Código incorrecto o vencido.' : 'La verificación caducó. Vuelve a iniciar sesión.' };
    } catch { return { ok: false, error: 'No hay conexión con el servidor.' }; }
  }, []);
  const refresh = useCallback(async () => { try { const m = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: 'include' }); if (m.ok) setUser(fromMe(await m.json())); } catch { /* */ } }, []);
  const logout = useCallback(async () => { try { await fetch(`${API_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { /* */ } setExpired(false); setStatus('anon'); }, []);
  const v = useMemo(() => ({ mode: MODE, status, user, expired, login, verify2fa, refresh, logout }), [status, user, expired, login, verify2fa, refresh, logout]);
  return <AuthCtx.Provider value={v}>{children}</AuthCtx.Provider>;
}
