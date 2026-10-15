// Cargador de códigos y scripts para las páginas PÚBLICAS del CRM (formularios). Se monta SOLO en las rutas públicas de App.tsx,
// antes de la sesión; las pantallas autenticadas nunca lo montan (un script de terceros ahí sería un riesgo grave).
// Capas de defensa: (1) solo se monta en rutas públicas; (2) el propio cargador del servidor se aborta si la ruta no es pública
// (site=crm); (3) useTagsFence recarga la página si, tras cargar códigos, se navega a una pantalla privada sin recarga completa.
import { useEffect } from 'react';
import { API_URL } from '../../lib/auth';

const FLAG = '__nxTagsInjected';
/** Rutas del CRM donde SÍ pueden correr códigos de terceros. Mantener alineado con el cargador del servidor (site-tags-loader.ts). */
export const isPublicTagsPath = (p: string) => /^\/(landing\/[A-Za-z0-9-]{3,120}|contacto)\/?$/.test(p);

export function PublicTags({ type = 'form' }: { type?: 'form' | 'site' | 'blog' }) {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('embed') === '1' || q.get('test') === '1' || window.top !== window.self) return;   // iframe (la página que lo incrusta ya carga los suyos) y envíos de prueba: sin códigos
    if (!isPublicTagsPath(window.location.pathname) || document.querySelector('script[data-nx-tags-loader]')) return;
    const s = document.createElement('script');
    s.src = `${API_URL}/api/v1/public/tags.js?site=crm&type=${type}`; s.async = true; s.setAttribute('data-nx-tags-loader', '1');
    document.head.appendChild(s); (window as any)[FLAG] = true;
  }, [type]);
  return null;
}

/** Si una página pública cargó códigos y la navegación (sin recarga) pasa a una ruta que no es pública, recarga: así no queda código de terceros vivo en el CRM. */
export function useTagsFence(pathname: string) {
  useEffect(() => { if ((window as any)[FLAG] && !isPublicTagsPath(pathname)) window.location.replace(pathname + window.location.search); }, [pathname]);
}
