import { useState } from 'react';
import { Avatar, Button, Empty, useToast } from '../../components/ui';
import { adminApi, adminCache } from '../../lib/perms';

/** Usuarios desactivados (modo conectado): se pueden reactivar. */
export default function InactiveUsers() {
  const toast = useToast(); const [busy, setBusy] = useState<number | null>(null); const list = adminCache.users.filter(u => !u.active);
  if (!list.length) return <Empty icon="user" title="No hay usuarios desactivados" />;
  return <div className="scroll-thin overflow-auto rounded-xl border border-line bg-white"><table className="w-full min-w-max text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead>
    <tbody>{list.map(u => <tr key={u.id} className="border-b border-line/70"><td className="px-4 py-2.5"><div className="flex items-center gap-2"><Avatar name={u.fullName} size={26} /><span className="font-semibold text-slate">{u.fullName}</span></div></td><td className="text-slate">{u.email}</td><td className="text-slate">{u.role === 'admin' ? 'Administrador' : u.role === 'manager' ? 'Gestor' : 'Setter'}</td>
      <td className="pr-3 text-right"><Button size="sm" disabled={busy === u.id} onClick={async () => { setBusy(u.id); try { await adminApi('POST', `/admin/users/${u.id}/reactivate`); toast('Usuario reactivado'); } catch { toast('No se pudo reactivar', 'err'); } setBusy(null); }}>Reactivar</Button></td></tr>)}</tbody></table></div>;
}
