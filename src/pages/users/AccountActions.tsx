import { useState, type ReactNode } from 'react';
import { Badge, Button, Card, Modal, useToast } from '../../components/ui';
import { adminApi, adminUserFor } from '../../lib/perms';
import { useAuth } from '../../lib/auth';
import { CredentialsView, type Credentials } from './InviteUser';

type Act = 'reset-password' | 'reset-2fa' | 'revoke' | 'deactivate' | 'resend' | null;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Tarjeta «Cuenta y acceso» de la ficha de usuario (solo modo conectado, solo administrador). */
export default function AccountActions({ ownerKey }: { ownerKey: string }) {
  const toast = useToast(); const { user: me } = useAuth(); const u = adminUserFor(ownerKey) as any;
  const [act, setAct] = useState<Act>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [cred, setCred] = useState<Credentials | null>(null);
  if (!u) return null; const self = String(u.id) === String(me.id);
  const close = () => { setAct(null); setErr(''); setCred(null); setBusy(false); };
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); try { await fn(); } catch (e: any) { setErr(e?.code === 'use_own_flow' ? 'Usa tu propio flujo en Configuración → Seguridad.' : e?.code === 'last_admin' || e?.code === 'cannot_demote_self' ? 'No puedes quitarte el último acceso de administrador.' : `No se pudo completar (${e?.code ?? 'error'})`); setBusy(false); } };
  const doReset = () => run(async () => { const r: any = await adminApi('POST', `/admin/users/${u.id}/reset-password`, {}); setCred({ email: u.email, tempPassword: r.tempPassword, loginUrl: r.loginUrl, notificationQueued: r.notificationQueued }); setBusy(false); });
  const simple = (path: string, msg: string, method = 'POST') => () => run(async () => { await adminApi(method, path); toast(msg); close(); });
  const status: ReactNode = <div className="mb-4 flex flex-wrap gap-1.5">
    <Badge tone={u.active ? 'Confirmed' : 'Canceled'}>{u.active ? 'Activo' : 'Desactivado'}</Badge>
    {u.mustChangePassword && <Badge tone="Pending">Debe cambiar su contraseña</Badge>}
    <Badge tone={u.twoFactorEnabled ? 'Confirmed' : 'Pending'}>{u.twoFactorEnabled ? '2FA activo' : '2FA sin activar'}</Badge>
    <Badge tone={u.emailVerified ? 'Confirmed' : 'Pending'}>{u.emailVerified ? 'Correo verificado' : 'Correo sin verificar'}</Badge>
    {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <Badge tone="Canceled">Bloqueado temporalmente</Badge>}</div>;
  const COPY: Record<Exclude<Act, null>, { title: string; body: string; go: () => Promise<void>; label: string; danger?: boolean }> = {
    'reset-password': { title: 'Restablecer contraseña', body: `Se genera una contraseña temporal nueva para ${u.fullName}, se cierran todas sus sesiones y deberá crear otra al entrar. La contraseña anterior deja de funcionar.`, go: doReset, label: 'Restablecer' },
    'reset-2fa': { title: 'Restablecer verificación en dos pasos', body: `Se quita el segundo factor de ${u.fullName} (por pérdida del teléfono). Tendrá que volver a activarlo y se cierran sus sesiones. Queda en la auditoría.`, go: simple(`/admin/users/${u.id}/reset-2fa`, 'Verificación en dos pasos restablecida'), label: 'Restablecer 2FA', danger: true },
    revoke: { title: 'Cerrar todas las sesiones', body: `${u.fullName} tendrá que iniciar sesión de nuevo en todos sus dispositivos.`, go: simple(`/admin/users/${u.id}/revoke-sessions`, 'Sesiones cerradas'), label: 'Cerrar sesiones' },
    deactivate: { title: 'Desactivar usuario', body: `${u.fullName} no podrá entrar. Su historial y sus registros se conservan y puedes reactivarlo cuando quieras.`, go: simple(`/admin/users/${u.id}`, 'Usuario desactivado', 'DELETE'), label: 'Desactivar', danger: true },
    resend: { title: 'Enviar verificación de correo', body: `Se anota un aviso con un enlace de un solo uso (caduca en 48 h) y ${u.fullName} no podrá entrar hasta confirmarlo. Los enlaces anteriores dejan de valer.`, go: simple(`/admin/users/${u.id}/resend-verification`, 'Aviso de verificación anotado'), label: 'Enviar' },
  };
  const cur = act ? COPY[act] : null;
  return <Card title="Cuenta y acceso">
    {status}
    <dl className="mb-4 grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2"><div><dt className="text-[12px] font-bold text-slate">Último ingreso</dt><dd>{fmt(u.lastLogin)}</dd></div>{u.mustChangePassword && <div><dt className="text-[12px] font-bold text-slate">La temporal caduca</dt><dd>{fmt(u.tempPasswordExpiresAt)}</dd></div>}</dl>
    {self ? <p className="text-[13px] text-slate">Esta es tu cuenta: cambia tu contraseña y tu verificación en dos pasos en Configuración → Seguridad.</p>
    : <div className="flex flex-wrap gap-2">
      <Button icon="key" onClick={() => setAct('reset-password')} disabled={!u.active}>Restablecer contraseña</Button>
      <Button icon="lock" onClick={() => setAct('reset-2fa')} disabled={!u.twoFactorEnabled}>Restablecer 2FA</Button>
      <Button icon="refresh" onClick={() => setAct('revoke')}>Cerrar todas las sesiones</Button>
      {!u.emailVerified || u.requireEmailVerification ? <Button icon="send" onClick={() => setAct('resend')} disabled={!u.active}>Enviar verificación de correo</Button> : null}
      {!u.emailVerified && <Button onClick={() => void run(async () => { await adminApi('POST', `/admin/users/${u.id}/mark-verified`); toast('Correo marcado como verificado'); })}>Marcar correo verificado</Button>}
      <Button variant="danger" onClick={() => setAct('deactivate')}>Desactivar usuario</Button></div>}
    {err && !cur && <p role="alert" className="mt-3 text-[13px] text-bad">{err}</p>}
    {cur && <Modal title={cred ? 'Contraseña restablecida' : cur.title} onClose={close} footer={cred ? <Button variant="primary" onClick={close}>Listo</Button> : <><Button onClick={close}>Cancelar</Button><Button variant={cur.danger ? 'danger' : 'primary'} disabled={busy} onClick={cur.go}>{busy ? 'Procesando…' : cur.label}</Button></>}>
      {cred ? <CredentialsView c={cred} intro={`Nueva contraseña temporal para ${u.fullName}. Sus sesiones se cerraron.`} /> : <>{err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}<p className="text-[13.5px]">{cur.body}</p></>}</Modal>}
  </Card>;
}
