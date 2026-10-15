import { useState } from 'react';
import { Button, Checkbox, Field, Input, Modal, Select, useCopy } from '../../components/ui';
import Icon from '../../components/Icon';
import { adminApi, adminCache } from '../../lib/perms';
import type { Owner } from '../../lib/types';
import PermissionEditor from '../PermissionEditor';
import { passwordChecks } from './passwordRules';

export type Credentials = { email: string; tempPassword: string; loginUrl: string; notificationQueued: boolean; expiresDays?: number };
/** Muestra la contraseña temporal UNA vez, con botón de copiar. */
export function CredentialsView({ c, intro }: { c: Credentials; intro: string }) {
  const copy = useCopy(); const url = c.loginUrl || window.location.origin;
  const text = `Enlace: ${url}\nUsuario: ${c.email}\nContraseña temporal: ${c.tempPassword}`;
  return <div>
    <p className="mb-3 text-[13.5px]">{intro}</p>
    <div className="rounded-xl border border-line bg-canvas p-3.5">
      <dl className="space-y-2 text-[13.5px]">
        <div><dt className="text-[12px] font-bold text-slate">Usuario</dt><dd>{c.email}</dd></div>
        <div><dt className="text-[12px] font-bold text-slate">Contraseña temporal</dt><dd className="flex items-center gap-2"><code data-testid="temp-password" className="select-all rounded bg-white px-2 py-1 font-mono text-[15px] font-bold tracking-wide text-navy ring-1 ring-line">{c.tempPassword}</code>
          <Button size="sm" icon="copy" onClick={() => copy(c.tempPassword, 'Contraseña copiada')}>Copiar</Button></dd></div>
      </dl>
    </div>
    <p className="mt-3 flex items-start gap-2 rounded-lg bg-[#FFF6E0] px-3 py-2 text-[12.5px] text-[#7A5410]"><Icon n="warn" s={15} className="mt-0.5 shrink-0" /><span><b>Se muestra una sola vez.</b> No queda guardada en claro en ningún sitio. Si la pierdes, restablece la contraseña. Caduca en {c.expiresDays ?? 7} días.</span></p>
    <p className="mt-2 text-[12.5px] text-slate">{c.notificationQueued ? 'También quedó anotado el aviso de credenciales para el flujo de correos (n8n).' : 'No se anotó aviso por correo: comparte las credenciales por un canal seguro.'}</p>
    <div className="mt-3"><Button icon="copy" onClick={() => copy(text, 'Credenciales copiadas')}>Copiar enlace + usuario + contraseña</Button></div>
  </div>;
}

const ROLE_HINT: Record<string, string> = { setter: 'Trabaja sus propios registros y herramientas básicas.', manager: 'Gestor: ve y gestiona según los permisos que le des. No puede administrar usuarios.', admin: 'Acceso total, incluida la administración de usuarios. Deberá activar la verificación en dos pasos.' };

export default function InviteUser({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ email: '', firstName: '', lastName: '', role: 'setter', ownerId: '', permissionSetId: '', custom: false, password: '', verify: false, notify: true });
  const [teams, setTeams] = useState<number[]>([]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState<{ c: Credentials; owner: Owner } | null>(null); const [editPerms, setEditPerms] = useState(false);
  const up = (k: string) => (e: { target: { value: string } }) => setF(s => ({ ...s, [k]: e.target.value }));
  const pwChecks = passwordChecks(f.password, '', f.email); const pwOk = !f.custom || pwChecks.every(c => c.ok);
  const valid = /^\S+@\S+\.\S+$/.test(f.email) && !!f.firstName.trim() && pwOk && (!f.ownerId || /^\d{1,18}$/.test(f.ownerId));
  const submit = async () => {
    if (!valid || busy) return; setBusy(true); setErr('');
    try {
      const r: any = await adminApi('POST', '/admin/users/invite', { email: f.email.trim(), firstName: f.firstName.trim(), lastName: f.lastName.trim(), role: f.role, ...(f.ownerId ? { ownerId: f.ownerId } : {}), ...(teams.length ? { teamIds: teams } : {}),
        ...(f.permissionSetId ? { permissionSetId: Number(f.permissionSetId) } : {}), ...(f.custom ? { password: f.password } : {}), requireEmailVerification: f.verify, notify: f.notify });
      const u = r.user; setDone({ c: { email: u.email, tempPassword: r.tempPassword, loginUrl: r.loginUrl, notificationQueued: r.notificationQueued }, owner: { id: u.ownerId ?? `u${u.id}`, firstName: u.fullName.split(' ')[0], lastName: u.fullName.split(' ').slice(1).join(' '), email: u.email, teams: [] } });
    } catch (e: any) {
      setErr(e?.code === 'user_exists_or_owner_id_taken' ? 'Ese correo (o ese ID de propietario) ya existe.' : e?.code === 'weak_password' ? 'La contraseña no cumple la política.' : e?.code === 'invalid_input' ? 'Revisa los datos del formulario.' : `No se pudo crear (${e?.code ?? 'error'})`);
      setBusy(false);
    }
  };
  if (done) return <>
    <Modal title="Usuario creado" onClose={onClose} footer={<><Button onClick={() => setEditPerms(true)}>Ajustar permisos…</Button><Button variant="primary" onClick={onClose}>Listo</Button></>}>
      <CredentialsView c={done.c} intro={`${done.owner.firstName} ya puede entrar. Al primer ingreso el CRM le pedirá crear su propia contraseña.`} /></Modal>
    {editPerms && <PermissionEditor owner={done.owner} onClose={() => setEditPerms(false)} />}</>;
  return <Modal title="Crear usuario" onClose={onClose} width="max-w-xl" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!valid || busy} onClick={submit}>{busy ? 'Creando…' : 'Crear usuario'}</Button></>}>
    {err && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-bad">{err}</p>}
    <Field label="Correo"><Input type="email" autoFocus autoComplete="off" value={f.email} onChange={up('email')} /></Field>
    <div className="grid gap-x-3 sm:grid-cols-2"><Field label="Nombre"><Input value={f.firstName} onChange={up('firstName')} /></Field><Field label="Apellido"><Input value={f.lastName} onChange={up('lastName')} /></Field></div>
    <Field label="Rol" hint={ROLE_HINT[f.role]}><Select value={f.role} onChange={up('role')}><option value="setter">Setter</option><option value="manager">Gestor</option><option value="admin">Administrador</option></Select></Field>
    <div className="grid gap-x-3 sm:grid-cols-2">
      <Field label="Conjunto de permisos (preset)" hint="Los permisos por área se afinan después en «Ajustar permisos»."><Select value={f.permissionSetId} onChange={up('permissionSetId')}><option value="">Sin preset (según el rol)</option>{adminCache.sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="ID de propietario (opcional)" hint="El que usa Nexa/n8n para asignar sus registros."><Input inputMode="numeric" value={f.ownerId} onChange={e => setF(s => ({ ...s, ownerId: e.target.value.replace(/\D/g, '') }))} /></Field>
    </div>
    {adminCache.teams.length > 0 && <div className="mb-3"><div className="mb-1 text-[12.5px] font-semibold text-slate">Equipos</div><div className="flex flex-wrap gap-x-4 gap-y-1">{adminCache.teams.map(t => <Checkbox key={t.id} label={t.name} checked={teams.includes(t.id)} onChange={v => setTeams(a => v ? [...a, t.id] : a.filter(x => x !== t.id))} />)}</div></div>}
    <fieldset className="mb-3 rounded-xl border border-line p-3"><legend className="px-1 text-[12.5px] font-semibold text-slate">Contraseña temporal</legend>
      <label className="flex cursor-pointer items-center gap-2 text-[13.5px]"><input type="radio" name="pwmode" checked={!f.custom} onChange={() => setF(s => ({ ...s, custom: false, password: '' }))} /> Generar una fuerte automáticamente (recomendado)</label>
      <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[13.5px]"><input type="radio" name="pwmode" checked={f.custom} onChange={() => setF(s => ({ ...s, custom: true }))} /> La defino yo</label>
      {f.custom && <div className="mt-2"><Input type="text" autoComplete="off" aria-label="Contraseña temporal definida por el administrador" value={f.password} onChange={up('password')} />
        <ul className="mt-2 space-y-0.5 text-[12.5px]" aria-label="Requisitos">{pwChecks.filter(c => c.id !== 'diff').map(c => <li key={c.id} className={c.ok ? 'text-good' : 'text-slate'}>{c.ok ? '✓' : '○'} {c.label}</li>)}</ul></div>}
      <p className="mt-2 text-[12px] text-slate">Se le pedirá cambiarla en su primer ingreso. Caduca en 7 días.</p></fieldset>
    <div className="space-y-1.5"><Checkbox label="Enviar las credenciales por correo (aviso para el flujo de n8n)" checked={f.notify} onChange={v => setF(s => ({ ...s, notify: v }))} />
      <Checkbox label="Exigir confirmar el correo antes de poder entrar" checked={f.verify} onChange={v => setF(s => ({ ...s, verify: v }))} /></div>
  </Modal>;
}
