// Carga de temas del blog: lista (con su CSS público) y enlace <link> una sola vez por tema. El CSS lo sirve el backend
// (GET /api/v1/public/blog/themes/<id>.css): es el mismo que usará la web pública, así lo que ves es lo que se publica.
import { useEffect, useState } from 'react';
import { CONNECTED } from '../../lib/db';
import { blog2, type ThemeInfo } from './blogApi';

let cache: { default: string; themes: ThemeInfo[] } | null = null; let pending: Promise<{ default: string; themes: ThemeInfo[] }> | null = null;
export function loadThemes() {
  if (cache) return Promise.resolve(cache);
  return (pending ??= blog2.themes().then(r => (cache = r)).catch(e => { pending = null; throw e; }));
}
/** Lista de temas (vacía en modo demo o mientras carga). */
export function useThemes(): ThemeInfo[] {
  const [t, setT] = useState<ThemeInfo[]>(cache?.themes ?? []);
  useEffect(() => { if (!CONNECTED || cache) return; let on = true; loadThemes().then(r => on && setT(r.themes)).catch(() => {}); return () => { on = false; }; }, []);
  return t;
}
const linked = new Set<string>();
export const absUrl = (u: string) => { try { return new URL(u, window.location.href).href; } catch { return u; } };
/** Añade <link rel="stylesheet"> del tema a la página (solo una vez). */
export function ensureThemeCss(url: string) {
  if (!url || linked.has(url)) return; linked.add(url);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; l.dataset.nxTheme = '1'; document.head.appendChild(l);
}
