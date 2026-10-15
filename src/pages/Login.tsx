import { BRAND } from '../lib/brand';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Icon from '../components/Icon';
import { Logo, Spinner, cx, inputCls } from '../components/ui';
import { useAuth } from '../lib/auth';

const MAX_LOCAL = 5; const LOCAL_LOCK_S = 30; // freno de UI; el límite real de intentos lo impone el servidor (423/429)

export default function Login() {
  const { login, verify2fa, expired } = useAuth(); const [challenge, setChallenge] = useState(''); const [code, setCode] = useState('');
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [fails, setFails] = useState(0); const [lock, setLock] = useState(0); const [caps, setCaps] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null); useEffect(() => emailRef.current?.focus(), []);
  useEffect(() => { if (lock <= 0) return; const t = setInterval(() => setLock(l => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, [lock > 0]); // eslint-disable-line
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy || lock > 0) return;
    if (!email.trim() || !pw) { setErr(!email.trim() ? 'Escribe tu correo.' : 'Escribe tu contraseña.'); return; }
    setBusy(true); setErr(''); const r = await login(email.trim(), pw); setBusy(false);
    if (r.ok) return;
    if (r.need2fa) { setChallenge(r.challenge); setPw(''); return; }
    setErr(r.error); setPw('');
    if (r.lockedFor) { setLock(r.lockedFor); return; }
    const n = fails + 1; setFails(n); if (n >= MAX_LOCAL) { setLock(LOCAL_LOCK_S); setFails(0); }
  };
  const submit2 = async (e: FormEvent) => {
    e.preventDefault(); if (busy || lock > 0 || !code.trim()) return;
    setBusy(true); setErr(''); const r = await verify2fa(challenge, code.trim()); setBusy(false);
    if (r.ok || r.need2fa) return; setErr(r.error); setCode(''); if (r.lockedFor) setLock(r.lockedFor); else if (/caduc/i.test(r.error)) { setChallenge(''); }
  };
  const locked = lock > 0;
  if (challenge) return <main className="grid min-h-full place-items-center bg-canvas px-5 py-10"><form onSubmit={submit2} noValidate className="page-in w-full max-w-[380px]" aria-labelledby="login2-h">
    <div className="mb-6 flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-rail"><Logo size={26} /></span><span className="font-display text-[17px] font-bold text-navy">{BRAND.first} <span className="text-link">{BRAND.last}</span></span></div>
    <h1 id="login2-h" className="font-display text-[26px] font-bold leading-tight text-navy">Verificación en dos pasos</h1>
    <p className="mt-1 text-[14px] text-slate">Escribe el código de 6 dígitos de tu app de autenticación, o un código de recuperación.</p>
    <div aria-live="assertive">{(err || locked) && <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#F1C4C0] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#9B2318]"><Icon n="warn" s={17} className="mt-0.5 shrink-0" /><span>{locked ? `Demasiados intentos. Espera ${lock}s.` : err}</span></div>}</div>
    <label className="mt-5 block"><span className="mb-1 block text-[13px] font-semibold text-slate">Código</span><input autoFocus inputMode="text" autoComplete="one-time-code" name="code" value={code} onChange={e => setCode(e.target.value)} disabled={busy} className={cx(inputCls, '!h-11 tracking-widest')} /></label>
    <button type="submit" disabled={busy || locked || !code.trim()} className="mt-6 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-navy text-[15px] font-semibold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <><Spinner s={16} />Verificando…</> : 'Verificar'}</button>
    <button type="button" onClick={() => { setChallenge(''); setCode(''); setErr(''); }} className="mt-4 w-full cursor-pointer text-center text-[13px] font-semibold text-link hover:underline">Volver</button>
  </form></main>;
  return <div className="grid min-h-full lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    <aside className="rail relative hidden flex-col justify-between overflow-hidden bg-rail p-12 text-white lg:flex" aria-hidden="true">
      <div className="flex items-center gap-3"><Logo size={36} /><span className="font-display text-[18px] font-bold">{BRAND.first} <span className="text-teal">{BRAND.last}</span></span></div>
      <div className="max-w-md"><h2 className="font-display text-[34px] font-bold leading-[1.1] tracking-tight">{BRAND.headline}</h2><p className="mt-4 text-[15px] leading-relaxed text-white/70">{BRAND.blurb}</p></div>
      <p className="text-[12.5px] text-white/50">© {BRAND.company} · Acceso solo para el equipo autorizado</p>
      <svg className="pointer-events-none absolute -bottom-24 -right-24 opacity-[.07]" width="520" height="520" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth=".5"><path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" /></svg>
    </aside>
    <main className="grid place-items-center bg-canvas px-5 py-10">
      <form onSubmit={submit} noValidate className="page-in w-full max-w-[380px]" aria-labelledby="login-h">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-rail"><Logo size={26} /></span><span className="font-display text-[17px] font-bold text-navy">{BRAND.first} <span className="text-link">{BRAND.last}</span></span></div>
        <h1 id="login-h" className="font-display text-[28px] font-bold leading-tight text-navy">Iniciar sesión</h1>
        <p className="mt-1 text-[14px] text-slate">Entra con tu cuenta del equipo.</p>
        {expired && <div role="status" className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#F0D9A6] bg-[#FFF8E6] px-3.5 py-2.5 text-[13.5px] text-[#7A5600]"><Icon n="clock" s={17} className="mt-0.5 shrink-0" /><span><b>Tu sesión expiró.</b> Inicia sesión de nuevo para continuar donde estabas.</span></div>}
        <div aria-live="assertive">{(err || locked) && <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-lg border border-[#F1C4C0] bg-[#FDECEC] px-3.5 py-2.5 text-[13.5px] text-[#9B2318]"><Icon n="warn" s={17} className="mt-0.5 shrink-0" /><span>{locked ? <>Acceso bloqueado temporalmente. Inténtalo de nuevo en <b className="tabular">{lock} s</b>.</> : err}</span></div>}</div>
        <label className="mt-5 block"><span className="mb-1 block text-[13px] font-semibold text-slate">Correo electrónico</span><input ref={emailRef} type="email" name="email" autoComplete="username" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} aria-invalid={!!err && !email.trim()} placeholder="nombre@nexahome.example" className={cx(inputCls, '!h-11')} /></label>
        <label className="mt-4 block"><span className="mb-1 block text-[13px] font-semibold text-slate">Contraseña</span>
          <span className="relative block"><input type={show ? 'text' : 'password'} name="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} onKeyUp={e => setCaps(e.getModifierState?.('CapsLock') ?? false)} disabled={busy} className={cx(inputCls, '!h-11 pr-11')} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show} className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-slate hover:bg-sky hover:text-navy"><Icon n="eye" s={17} /></button></span>
          {caps && <span className="mt-1 block text-xs text-warn">Bloq Mayús está activado.</span>}</label>
        <button type="submit" disabled={busy || locked} className="mt-6 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-navy text-[15px] font-semibold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <><Spinner s={16} />Comprobando…</> : locked ? `Espera ${lock} s` : 'Entrar'}</button>
        <p className="mt-5 text-center text-[12.5px] text-slate">¿Sin acceso o olvidaste la contraseña? Pídele a un administrador que restablezca tu cuenta.</p>
      </form>
    </main>
  </div>;
}

export function SessionLoading() { return <div className="grid h-full place-items-center bg-canvas text-slate"><div className="flex items-center gap-2.5 text-[14px]"><Spinner s={18} />Comprobando sesión…</div></div>; }
