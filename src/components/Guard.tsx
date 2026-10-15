import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAccess } from '../lib/perms';
import type { ObjKey } from '../lib/types';
import { Empty } from './ui';

/** Oculta una ruta si el usuario efectivo no tiene acceso. (La UI solo oculta: el servidor impone el acceso real.) */
export default function Guard({ section, obj, children }: { section?: string; obj?: ObjKey; children: ReactNode }) {
  const a = useAccess(); const ok = section ? a.section(section) : obj ? a.obj(obj, 'view') : true;
  if (ok) return <>{children}</>;
  return <div className="p-6"><Empty icon="shield" title="No tienes acceso a esta sección">Pídele a un administrador que active el permiso en <b>Ajustes → Usuarios y equipos</b>. <div className="mt-3"><Link to="/" className="font-semibold text-link hover:underline">Ir al inicio</Link></div></Empty></div>;
}
