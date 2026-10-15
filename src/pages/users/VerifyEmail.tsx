import { useEffect, useState } from 'react';
import { API_URL } from '../../lib/auth';
import { Logo } from '../../components/ui';
import { BRAND } from '../../lib/brand';

/** Página pública /verify-email?token=…: confirma el correo con el enlace de un solo uso. No requiere sesión. */
export default function VerifyEmail() {
  const [st, setSt] = useState<'working' | 'ok' | 'bad' | 'limit'>('working');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? ''; if (!token) { setSt('bad'); return; }
    fetch(`${API_URL}/api/v1/auth/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(r => setSt(r.ok ? 'ok' : r.status === 429 ? 'limit' : 'bad')).catch(() => setSt('bad'));
    try { window.history.replaceState(null, '', '/verify-email'); } catch { /* quita el token de la barra */ }
  }, []);
  return <main className="grid min-h-full place-items-center bg-canvas px-5 py-10"><div className="page-in w-full max-w-[400px]">
    <div className="mb-6 flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-rail"><Logo size={26} /></span><span className="font-display text-[17px] font-bold text-navy">{BRAND.first} <span className="text-link">{BRAND.last}</span></span></div>
    <div aria-live="polite">
      {st === 'working' && <p className="text-[14px] text-slate">Verificando tu correo…</p>}
      {st === 'ok' && <><h1 className="font-display text-[24px] font-bold text-navy">Correo confirmado</h1><p className="mt-1 text-[14px] text-slate">Ya puedes iniciar sesión con tu correo y la contraseña temporal que recibiste.</p><a href="/" className="mt-5 inline-flex h-10 items-center rounded-lg bg-navy px-5 text-[14px] font-semibold text-white hover:bg-navy-700">Ir a iniciar sesión</a></>}
      {st === 'bad' && <><h1 className="font-display text-[24px] font-bold text-navy">Este enlace no es válido</h1><p className="mt-1 text-[14px] text-slate">Puede haber caducado o ya se usó. Pide a un administrador que te envíe uno nuevo.</p></>}
      {st === 'limit' && <><h1 className="font-display text-[24px] font-bold text-navy">Demasiados intentos</h1><p className="mt-1 text-[14px] text-slate">Espera unos minutos y vuelve a abrir el enlace.</p></>}
    </div></div></main>;
}
