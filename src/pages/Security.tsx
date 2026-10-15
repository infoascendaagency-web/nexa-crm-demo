import { useState } from 'react';
import { API_URL, useAuth } from '../lib/auth';
import { Button, Card, Field, Input, PageHeader, useCopy, useToast } from '../components/ui';
import Icon from '../components/Icon';

async function post(path: string, body: unknown) {
  const r = await fetch(`${API_URL}/api/v1${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j };
}

/** Alta del segundo factor: contraseña → QR/secreto → código → códigos de recuperación. */
export function TwoFactorCard() {
  const { user, refresh } = useAuth(); const toast = useToast(); const copy = useCopy();
  const tf = user.me?.twoFactor as { enabled: boolean; required: boolean } | undefined; const enabled = !!tf?.enabled;
  const [step, setStep] = useState<'idle' | 'qr' | 'codes'>('idle'); const [pw, setPw] = useState(''); const [code, setCode] = useState(''); const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [offPw, setOffPw] = useState(''); const [offCode, setOffCode] = useState(''); const [off, setOff] = useState(false);
  const start = async () => { setBusy(true); setErr(''); const r = await post('/auth/2fa/setup', { password: pw }); setBusy(false); if (!r.ok) return setErr(r.j?.error === 'reauth_required' ? 'Contraseña incorrecta.' : 'No se pudo iniciar. Inténtalo de nuevo.'); setSetup(r.j); setStep('qr'); setPw(''); };
  const enable = async () => { setBusy(true); setErr(''); const r = await post('/auth/2fa/enable', { code }); setBusy(false); if (!r.ok) return setErr('Código incorrecto. Revisa la hora de tu teléfono e inténtalo otra vez.'); setCodes(r.j.recoveryCodes); setStep('codes'); setCode(''); };
  const disable = async () => { setBusy(true); setErr(''); const r = await post('/auth/2fa/disable', { password: offPw, code: offCode }); setBusy(false); if (!r.ok) return setErr(r.j?.error === 'required_for_admins' ? 'Los administradores no pueden desactivarlo.' : 'Contraseña o código incorrectos.'); toast('Verificación en dos pasos desactivada'); window.location.reload(); };
  return <Card title="Verificación en dos pasos (2FA)">
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    {step === 'codes' ? <div>
      <p className="text-[13.5px]"><b>Guarda estos códigos de recuperación</b> en un lugar seguro. Cada uno sirve una sola vez si pierdes el teléfono. No se volverán a mostrar.</p>
      <div className="my-3 grid grid-cols-2 gap-2 rounded-xl bg-canvas p-3 font-mono text-[14px]">{codes.map(c => <span key={c}>{c}</span>)}</div>
      <div className="flex gap-2"><Button onClick={() => copy(codes.join('\n'), 'Códigos copiados')}>Copiar</Button><Button variant="primary" onClick={async () => { setStep('idle'); setCodes([]); await refresh(); }}>Ya los guardé</Button></div></div>
    : step === 'qr' && setup ? <div>
      <p className="mb-3 text-[13.5px]">1. Escanea el código con Google Authenticator, Authy o 1Password. 2. Escribe el código de 6 dígitos que muestre.</p>
      <div className="flex flex-wrap items-center gap-5"><img src={setup.qr} alt="Código QR para la app de autenticación" width={180} height={180} className="rounded-lg border border-line bg-white p-1" />
        <div className="min-w-[220px] flex-1"><p className="text-[12.5px] text-slate">¿No puedes escanear? Clave manual:</p><code className="my-1 block break-all rounded bg-canvas px-2 py-1.5 font-mono text-[13px]">{setup.secret}</code>
          <Field label="Código de 6 dígitos"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => { if (e.key === 'Enter' && code.length === 6) enable(); }} /></Field>
          <Button variant="primary" disabled={busy || code.length !== 6} onClick={enable}>{busy ? 'Verificando…' : 'Activar'}</Button></div></div></div>
    : enabled ? <div>
      <p className="flex items-center gap-2 text-[13.5px]"><Icon n="check" s={16} className="text-ok" /><b>Activa.</b> Se te pedirá un código al iniciar sesión.</p>
      {tf?.required ? <p className="mt-2 text-[12.5px] text-slate">Es obligatoria para administradores.</p> : off ? <div className="mt-3 max-w-sm"><Field label="Contraseña"><Input type="password" value={offPw} onChange={e => setOffPw(e.target.value)} /></Field><Field label="Código actual"><Input inputMode="numeric" maxLength={6} value={offCode} onChange={e => setOffCode(e.target.value.replace(/\D/g, ''))} /></Field><div className="flex gap-2"><Button onClick={() => setOff(false)}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={disable}>Desactivar</Button></div></div>
        : <Button className="mt-3" onClick={() => setOff(true)}>Desactivar…</Button>}</div>
    : <div className="max-w-sm"><p className="mb-3 text-[13.5px]">Protege tu cuenta con un código de tu teléfono, además de la contraseña.{tf?.required && <b> Es obligatoria para tu rol.</b>}</p>
      <Field label="Confirma tu contraseña para empezar"><Input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && pw) start(); }} /></Field>
      <Button variant="primary" disabled={busy || !pw} onClick={start}>{busy ? 'Preparando…' : 'Activar verificación en dos pasos'}</Button></div>}
  </Card>;
}

function ChangePasswordCard() {
  const toast = useToast(); const [cur, setCur] = useState(''); const [nxt, setNxt] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const REASONS: Record<string, string> = { min_length_12: 'Mínimo 12 caracteres.', needs_letters_and_numbers_or_symbols: 'Combina letras con números o símbolos.', same_as_current: 'Debe ser distinta de la actual.', contains_username: 'No debe contener tu usuario.' };
  const go = async () => { setBusy(true); setErr(''); const r = await post('/auth/change-password', { current: cur, next: nxt }); setBusy(false);
    if (r.ok) { toast('Contraseña actualizada. Se cerraron tus otras sesiones.'); setCur(''); setNxt(''); return; }
    setErr(r.status === 401 ? 'La contraseña actual no es correcta.' : REASONS[r.j?.reason] ?? 'No se pudo cambiar la contraseña.'); };
  return <Card title="Cambiar contraseña"><div className="max-w-sm">{err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    <Field label="Contraseña actual"><Input type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></Field>
    <Field label="Contraseña nueva" hint="Mínimo 12 caracteres, con letras y números o símbolos."><Input type="password" autoComplete="new-password" value={nxt} onChange={e => setNxt(e.target.value)} /></Field>
    <Button variant="primary" disabled={busy || !cur || !nxt} onClick={go}>Cambiar contraseña</Button></div></Card>;
}

export function SecurityPage() { return <div className="max-w-2xl space-y-4"><PageHeader title="Seguridad" sub="Protege tu acceso al CRM." /><TwoFactorCard /><ChangePasswordCard /></div>; }

/** Pantalla obligatoria: un admin sin 2FA no puede usar el CRM hasta activarlo. */
export function EnrollGate() {
  const { logout } = useAuth();
  return <div className="grid min-h-full place-items-center bg-canvas p-6"><div className="w-full max-w-xl space-y-4"><div><h1 className="font-display text-[24px] font-bold text-navy">Activa la verificación en dos pasos</h1><p className="mt-1 text-[14px] text-slate">Por seguridad, las cuentas de administrador la necesitan para entrar al CRM.</p></div><TwoFactorCard /><button onClick={() => logout()} className="cursor-pointer text-[13.5px] font-semibold text-link hover:underline">Cerrar sesión</button></div></div>;
}
