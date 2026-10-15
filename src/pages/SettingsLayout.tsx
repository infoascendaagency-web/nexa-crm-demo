import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { cx } from '../components/ui';
import { useAccess } from '../lib/perms';

const NAV: { title: string; items: { label: string; to: string; sec?: string }[] }[] = [
  { title: 'Tus preferencias', items: [{ label: 'General', to: '/settings/preferences' }, { label: 'Seguridad', to: '/settings/security' }, { label: 'Notificaciones', to: '/settings/notifications' }] },
  { title: 'Gestión de cuentas', items: [{ sec: 'settings', label: 'Valores predeterminados de la cuenta', to: '/settings/account' }, { sec: 'settings', label: 'Registro de auditoría', to: '/settings/audit' }, { sec: 'settings', label: 'Usuarios y equipos', to: '/settings/users' }, { sec: 'integrations', label: 'Integraciones', to: '/settings/integrations' }] },
  { title: 'Gestión de datos', items: [{ sec: 'settings', label: 'Propiedades', to: '/settings/properties' }, { sec: 'settings', label: 'Objetos', to: '/settings/objects' }, { sec: 'settings', label: 'Importar y exportar', to: '/settings/import' }] },
  { title: 'Sitio', items: [{ sec: 'settings', label: 'Dominios y URL', to: '/settings/domains' }] },
];
export default function SettingsLayout() {
  const [q, setQ] = useState(''); const nav = useNavigate(); const [open, setOpen] = useState(false); const loc = useLocation(); const current = NAV.flatMap(s => s.items).find(i => loc.pathname.startsWith(i.to))?.label ?? 'Configuración';
  const acc = useAccess(); const NAVF = NAV.map(g => ({ ...g, items: g.items.filter(i => !i.sec || acc.section(i.sec)) })).filter(g => g.items.length); const flat = NAVF.flatMap(s => s.items);
  return <div className="flex min-h-full flex-col md:flex-row">
    <aside className="shrink-0 border-b border-line bg-white px-3 py-2 md:w-64 md:border-b-0 md:border-r md:py-4">
      <button type="button" aria-expanded={open} aria-controls="settings-nav" onClick={() => setOpen(o => !o)} className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-[14px] font-semibold text-navy md:hidden"><span>Configuración · {current}</span><Icon n={open ? 'chevU' : 'chevD'} s={16} /></button>
      <div id="settings-nav" className={open ? 'block' : 'hidden md:block'} onClick={e => { if ((e.target as HTMLElement).closest('a')) setOpen(false); }}>
      <button onClick={() => nav('/')} className="mb-3 flex cursor-pointer items-center gap-1 text-[13.5px] font-semibold text-link hover:underline"><Icon n="chevL" s={14} />Panel</button>
      <div className="relative mb-4"><Icon n="search" s={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar configuración" aria-label="Buscar configuración" className="h-9 w-full rounded-full border border-line-2 pl-8 pr-3 text-[13.5px] focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></div>
      {q ? flat.filter(i => i.label.toLowerCase().includes(q.toLowerCase())).map(i => <NavLink key={i.to} to={i.to} onClick={() => setQ('')} className="block rounded-lg px-3 py-1.5 text-[13.5px] hover:bg-sky">{i.label}</NavLink>)
        : NAVF.map(s => <div key={s.title} className="mb-4"><h2 className="px-3 pb-1 font-display text-[14px] font-bold text-navy">{s.title}</h2>{s.items.map(i => <NavLink key={i.to} to={i.to} className={({ isActive }) => cx('block rounded-lg border-l-4 px-3 py-1.5 text-[13.5px]', isActive ? 'border-brand bg-sky font-semibold text-navy' : 'border-transparent text-ink hover:bg-sky/60')}>{i.label}</NavLink>)}</div>)}
      </div>
    </aside>
    <div className="min-w-0 flex-1 p-4 sm:p-6"><Outlet /></div>
  </div>;
}
