import { useState } from 'react';
import { API_URL, useAuth } from '../../lib/auth';
import { Button, Field, Input, Logo } from '../../components/ui';
import { BRAND } from '../../lib/brand';
import { PasswordRules, REASON_ES, passwordChecks } from './passwordRules';

/** Pantalla obligatoria tras entrar con una contraseña temporal: el servidor bloquea todo lo demás (403 password_change_required) hasta que se cambie. */
export default function MustChangeGate() {
  const { user, refresh, logout } = useAuth();
  const [cur, setCur] = useState(''); const [nxt, setNxt] = useState(''); const [rep, setRep] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const checks = passwordChecks(nxt, cur, user.email); const ok = checks.every(c => c.ok) && nxt === rep && !!cur;
  const go = async () => {
    if (!ok || busy) return; setBusy(true); setErr('');
    try {
      const r = await fetch(`${API_URL}/api/v1/auth/change-password`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: cur, next: nxt }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { await refresh(); return; }
      setErr(r.status === 401 ? 'La contraseña temporal no es correcta. Revisa que la copiaste completa.' : r.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : REASON_ES[j?.reason] ?? 'No se pudo cambiar la contraseña.');
    } catch { setErr('No hay conexión con el servidor.'); }
    setBusy(false);
  };
  return <main className="grid min-h-full place-items-center bg-canvas px-5 py-10"><form onSubmit={e => { e.preventDefault(); void go(); }} noValidate className="page-in w-full max-w-[420px]" aria-labelledby="mc-h">
    <div className="mb-6 flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-rail"><Logo size={26} /></span><span className="font-display text-[17px] font-bold text-navy">{BRAND.first} <span className="text-link">{BRAND.last}</span></span></div>
    <h1 id="mc-h" className="font-display text-[26px] font-bold leading-tight text-navy">Crea tu contraseña</h1>
    <p className="mt-1 mb-5 text-[14px] text-slate">Entraste con una contraseña temporal. Elige una propia para continuar; solo la sabrás tú.</p>
    <div aria-live="assertive">{err && <p role="alert" className="mb-3 rounded-lg border border-[#F1C4C0] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#9B2318]">{err}</p>}</div>
    <Field label="Contraseña temporal"><Input type="password" autoComplete="current-password" autoFocus value={cur} onChange={e => setCur(e.target.value)} /></Field>
    <Field label="Contraseña nueva"><Input type="password" autoComplete="new-password" aria-describedby="mc-rules" value={nxt} onChange={e => setNxt(e.target.value)} /></Field>
    <PasswordRules id="mc-rules" checks={checks} />
    <Field label="Repite la contraseña nueva" hint={rep && nxt !== rep ? 'No coincide.' : undefined}><Input type="password" autoComplete="new-password" value={rep} onChange={e => setRep(e.target.value)} /></Field>
    <Button type="submit" variant="primary" className="w-full" disabled={!ok || busy}>{busy ? 'Guardando…' : 'Guardar y entrar'}</Button>
    <button type="button" onClick={() => logout()} className="mt-4 w-full cursor-pointer text-center text-[13px] font-semibold text-link hover:underline">Cerrar sesión</button>
  </form></main>;
}
