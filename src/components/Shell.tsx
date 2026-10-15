import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { Avatar, Button, IconButton, Logo, MenuItem, Popover, cx, useToast } from './ui';
import { useAuth } from '../lib/auth';
import { BRAND } from '../lib/brand';
import { setViewAs, useAccess } from '../lib/perms';
import CreateRecord from './CreateRecord';
import { crm, store, useDbValue } from '../lib/api';
import { ME, OBJECTS, OWNERS } from '../lib/schema';
import type { ObjKey } from '../lib/types';

const CRM_ITEMS: { id: string; label: string; to: string; obj?: ObjKey }[] = [
  { obj: 'contacts', id: 'contacts', label: 'Contactos', to: '/contacts' }, { obj: 'companies', id: 'companies', label: 'Empresas', to: '/companies' }, { obj: 'deals', id: 'deals', label: 'Negocios', to: '/deals' },
  { obj: 'appointments', id: 'appointments', label: 'Citas', to: '/appointments' }, { id: 'lists', label: 'Segmentos (listas)', to: '/lists' }, { obj: 'calls', id: 'calls', label: 'Llamadas', to: '/calls' },
  { obj: 'meetings', id: 'meetings', label: 'Reuniones', to: '/meetings' }, { obj: 'tasks', id: 'tasks', label: 'Tareas', to: '/tasks/workspace' }, { obj: 'notes', id: 'notes', label: 'Notas', to: '/notes' },
  { obj: 'tickets', id: 'tickets', label: 'Tickets', to: '/tickets' }, { obj: 'leads', id: 'leads', label: 'Leads', to: '/leads' }, { obj: 'communications', id: 'communications', label: 'Comunicaciones', to: '/communications' },
  { obj: 'products', id: 'products', label: 'Productos', to: '/products' }, { obj: 'line_items', id: 'line_items', label: 'Partidas (line items)', to: '/line_items' }, { obj: 'quotes', id: 'quotes', label: 'Cotizaciones', to: '/quotes' }, { obj: 'invoices', id: 'invoices', label: 'Facturas', to: '/invoices' },
];
const PIN_KEY = 'nx-nav-pins';
const readPins = (): string[] => { try { return JSON.parse(localStorage.getItem(PIN_KEY) ?? '') as string[]; } catch { return ['contacts', 'appointments', 'tasks']; } };

type Group = { id: string; label: string; icon: string; items?: { label: string; to: string; id?: string; sec?: string }[]; to?: string; sec?: string };
const GROUPS: Group[] = [
  { id: 'home', label: 'Inicio', icon: 'home', to: '/' },
  { id: 'dash', label: 'Informes', icon: 'reports', items: [{ label: 'Informe admin', to: '/dashboard/admin', sec: 'dashAdmin' }, { label: 'Informe setters', to: '/dashboard/setters', sec: 'dashSetters' }] },
  { id: 'pins', label: 'Marcadores', icon: 'bookmark' },
  { id: 'crm', label: 'CRM', icon: 'contacts' },
  { id: 'site', label: 'Sitio', icon: 'globe', sec: 'siteAny', items: [{ label: 'Formularios', to: '/site/forms', sec: 'siteForms' }, { label: 'Blog', to: '/site/blog', sec: 'siteBlog' }, { label: 'Códigos y scripts', to: '/site/tags', sec: 'siteTags' }] },
  { id: 'social', label: 'Redes sociales', icon: 'chat', to: '/social', sec: 'social' },
  { id: 'ecom', label: 'E-commerce', icon: 'cart', to: '/ecommerce', sec: 'ecommerce' },
  { id: 'auto', label: 'Automatización', icon: 'bolt', sec: 'automation', items: [{ label: 'Resumen (n8n)', to: '/automation' }, { label: 'Webhooks y suscripciones', to: '/developer/apps' }] },
  { id: 'dev', label: 'Desarrollo', icon: 'code', sec: 'dev', items: [{ label: 'Vista general', to: '/developer' }, { label: 'Aplicaciones', to: '/developer/apps' }, { label: 'Claves', to: '/developer/keys' }, { label: 'Registros', to: '/developer/logs' }, { label: 'Uso de llamadas a la API', to: '/developer/usage' }] },
];

function GlobalSearch() {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const nav = useNavigate(); const ref = useRef<HTMLDivElement>(null);
  const results = useDbValue(() => (q.trim().length < 2 ? [] : (['contacts', 'companies', 'deals', 'appointments'] as ObjKey[]).flatMap(o => crm.search(o, { query: q, limit: 4 }).results.map(r => ({ o, r })))), [q]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const go = (o: ObjKey, id: string) => { setOpen(false); setQ(''); nav(`${OBJECTS[o].path}/${id}`); };
  return <div ref={ref} className="relative min-w-0 flex-1 md:w-[min(420px,40vw)] md:flex-none">
    <Icon n="search" s={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
    <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={e => { if (e.key === 'Enter' && results[0]) go(results[0].o, results[0].r.id); }} placeholder="Buscar en el CRM" aria-label="Buscar en el CRM" className="h-8 w-full rounded-full border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/70 focus:bg-white focus:text-ink focus:placeholder:text-mute focus:outline-none" />
    {open && results.length > 0 && <div className="pop absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl">
      {results.map(({ o, r }) => <button key={o + r.id} onMouseDown={() => go(o, r.id)} className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-sky"><Icon n={OBJECTS[o].icon} s={16} className="text-slate" /><span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{crm.nameOf(r, o)}</span><span className="text-[11.5px] uppercase tracking-wide text-mute">{OBJECTS[o].singular}</span></button>)}
    </div>}
  </div>;
}

function DialpadWidget() {
  const toast = useToast();
  return <Popover align="right" width="w-80" trigger={({ toggle, open }) => <IconButton n="phone" label="Llamadas (Dialpad)" onClick={toggle} className={cx('!text-white/85 hover:!bg-white/15 hover:!text-white', open && '!bg-white/20')} />}>
    {close => <div>
      <div className="flex items-center justify-between px-2 py-1.5"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[#7C52FF] to-[#E04FD8] text-[13px] font-bold text-white">d</span><span className="text-sm font-semibold text-ink">Dialpad</span></div><IconButton n="x" label="Cerrar" onClick={close} /></div>
      <div className="px-4 pb-4 pt-5 text-center"><Icon n="phone" s={34} className="mx-auto mb-3 text-mute" /><h4 className="font-display text-[15px] font-bold text-navy">Tu ventana de llamadas está cerrada.</h4><p className="mx-auto mt-1 max-w-[230px] text-[12.5px] text-slate">Para hacer y recibir llamadas, debes tener abierta la ventana de llamadas.</p>
        <Button variant="primary" className="mt-3" onClick={() => { toast('La conexión con Dialpad se activa en la fase de backend', 'ok'); close(); }}>Abrir la ventana de llamadas</Button></div>
    </div>}
  </Popover>;
}

export default function Shell() {
  const loc = useLocation(); const nav = useNavigate(); const toast = useToast(); const auth = useAuth(); const me = auth.user; const acc = useAccess();
  const groups = useMemo(() => GROUPS.filter(g => (!g.sec || acc.section(g.sec)) && (!g.items?.some(i => i.sec) || g.items.some(i => !i.sec || acc.section(i.sec)))).map(g => g.items ? { ...g, items: g.items.filter(i => !i.sec || acc.section(i.sec)) } : g), [acc]); // eslint-disable-line
  const crmItems = CRM_ITEMS.filter(i => !i.obj || acc.obj(i.obj, 'view'));
  const [flyout, setFlyout] = useState<string | null>(null); const [pins, setPins] = useState<string[]>(readPins); const [create, setCreate] = useState<ObjKey | null>(null);
  const [railHover, setRailHover] = useState(false); const [railKb, setRailKb] = useState(false);   // hover = ratón sobre la barra; kb = foco de teclado
  useEffect(() => { setFlyout(null); setRailHover(false); setRailKb(false); (document.activeElement as HTMLElement | null)?.closest?.('nav[aria-label=Principal]') && (document.activeElement as HTMLElement).blur(); }, [loc.pathname]);   // al cambiar de página la barra vuelve a íconos
  const railOpen = (railHover || railKb) && !flyout;
  const savePins = (p: string[]) => { setPins(p); try { localStorage.setItem(PIN_KEY, JSON.stringify(p)); } catch { /* */ } };
  const overdue = useDbValue(() => crm.search('tasks', { filterGroups: [{ filters: [{ propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' }, { propertyName: 'hubspot_owner_id', operator: 'EQ', value: '{{me}}' }, { propertyName: 'hs_timestamp', operator: 'LT', value: '{{now}}' }] }], limit: 5 }), []);
  const flyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!flyout) return; const h = (e: MouseEvent) => { if (!flyRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-rail]')) setFlyout(null); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [flyout]);
  const pinned = useMemo(() => CRM_ITEMS.filter(i => pins.includes(i.id) && (!i.obj || true)), [pins]);

  return <div className="flex h-full flex-col">
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    <div role="note" className="flex shrink-0 items-center justify-center gap-3 bg-[#0B6E6A] px-3 py-1 text-[12.5px] text-white"><span className="rounded bg-white/20 px-1.5 py-px text-[11px] font-bold tracking-wide">DEMO</span><span>Demo interactiva con datos ficticios: todo funciona como en un CRM real. Tus cambios se guardan solo en este navegador.</span><button type="button" className="rounded border border-white/40 px-2 py-px text-[12px] font-semibold hover:bg-white/15" onClick={() => { if (!window.confirm('¿Restablecer todos los datos de la demo?')) return; try { Object.keys(localStorage).filter(k => /^(nexa|nx)-/.test(k)).forEach(k => localStorage.removeItem(k)); } catch { /* */ } location.reload(); }}>Restablecer datos</button></div>
    {acc.viewingAs && <div role="status" className="flex shrink-0 items-center justify-center gap-3 bg-[#FFF1D6] px-3 py-1.5 text-[13px] text-[#6B4A00]"><Icon n="eye" s={15} /><span>Viendo el CRM como <b>{acc.viewingAs.firstName} {acc.viewingAs.lastName}</b> (solo vista previa de permisos)</span><button className="cursor-pointer font-semibold underline" onClick={() => { setViewAs(null); nav('/'); }}>Salir</button></div>}
    <header className="rail flex h-12 shrink-0 items-center gap-2 bg-rail px-2.5 text-white md:gap-3 md:px-3">
      <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg pr-2" aria-label="Nexa CRM — Inicio"><Logo size={28} /><span className="hidden font-display text-[15px] font-bold leading-none sm:block">{BRAND.first} <span className="text-teal">{BRAND.last}</span></span></Link>
      <GlobalSearch />
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <Popover align="right" width="w-56" trigger={({ toggle }) => <IconButton n="plus" label="Crear" onClick={toggle} className="!text-white/85 hover:!bg-white/15 hover:!text-white" />}>
          {close => <>{(['contacts', 'appointments', 'tasks', 'deals', 'companies'] as ObjKey[]).filter(o => acc.obj(o, 'create')).map(o => <MenuItem key={o} icon={OBJECTS[o].icon} onClick={() => { close(); setCreate(o); }}>Nuevo {OBJECTS[o].singular}</MenuItem>)}</>}
        </Popover>
        <DialpadWidget />
        <Popover align="right" width="w-80" trigger={({ toggle }) => <span className="relative"><IconButton n="bell" label="Notificaciones" onClick={toggle} className="!text-white/85 hover:!bg-white/15 hover:!text-white" />{overdue.total > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold">{overdue.total > 99 ? '99+' : overdue.total}</span>}</span>}>
          {close => <div><div className="px-2.5 py-2 font-display text-[14px] font-bold text-navy">Tareas atrasadas</div>
            {overdue.results.length === 0 && <p className="px-3 pb-3 text-[13px] text-slate">Estás al día.</p>}
            {overdue.results.map(t => <button key={t.id} onClick={() => { close(); nav('/tasks/workspace?bucket=overdue'); }} className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left hover:bg-sky"><span className="block truncate text-[13px] font-medium text-ink">{t.properties.hs_task_subject}</span></button>)}
            <MenuItem icon="chevR" onClick={() => { close(); nav('/tasks/workspace?bucket=overdue'); }}>Ver todas mis tareas</MenuItem></div>}
        </Popover>
        <Link to="/settings" aria-label="Configuración" title="Configuración" className="grid h-8 w-8 place-items-center rounded-lg text-white/85 hover:bg-white/15 hover:text-white"><Icon n="gear" s={17} /></Link>
        <Popover align="right" width="w-64" trigger={({ toggle }) => <button onClick={toggle} className="ml-1 flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/15" aria-label="Cuenta"><Avatar name={me.name} size={26} /><span className="hidden text-left leading-tight md:block"><span className="block text-[12.5px] font-semibold">{me.name}</span><span className="block text-[11px] text-white/70">{me.role ?? 'Equipo'}</span></span><Icon n="chevD" s={14} className="text-white/70" /></button>}>
          {close => <><div className="px-2.5 py-2"><div className="text-[13.5px] font-semibold text-ink">{me.name}</div><div className="text-xs text-slate">{me.email}</div></div>
            <MenuItem icon="gear" onClick={() => { close(); nav('/settings'); }}>Configuración</MenuItem>
            {auth.mode === 'demo' && acc.realIsAdmin && <><div className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[11.5px] font-bold uppercase tracking-wide text-slate">Ver como</div><div className="scroll-thin max-h-48 overflow-auto">{acc.viewingAs && <MenuItem icon="user" onClick={() => { close(); setViewAs(null); nav('/'); }}>Volver a mi vista (admin)</MenuItem>}{OWNERS.filter(o => o.id !== me.id).map(o => <MenuItem key={o.id} icon="eye" onClick={() => { close(); setViewAs(o.id); nav('/'); }}>{o.firstName} {o.lastName}</MenuItem>)}</div><div className="my-1 border-t border-line" /></>}{auth.mode === 'demo' && <MenuItem icon="refresh" onClick={() => { close(); if (confirm('¿Restablecer los datos de demostración?')) { store.resetDemo(); toast('Datos de demostración restablecidos'); } }}>Restablecer datos de demo</MenuItem>}{auth.mode === 'connected' && <MenuItem icon="x" onClick={() => { close(); void auth.logout(); }}>Cerrar sesión</MenuItem>}</>}
        </Popover>
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
      <div className="relative z-40 shrink-0 md:w-14"><nav aria-label="Principal" onMouseEnter={() => setRailHover(true)} onMouseLeave={() => { setRailHover(false); setRailKb(false); }} onFocus={e => { if (e.target.matches(':focus-visible')) setRailKb(true); }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setRailKb(false); }} className={cx('rail flex flex h-14 flex-row items-center justify-around gap-1 bg-rail-2 px-2 md:absolute md:inset-y-0 md:left-0 md:h-auto md:flex-col md:items-stretch md:justify-start md:overflow-hidden md:px-2 md:py-3 md:transition-[width,box-shadow] md:duration-150 md:ease-out', railOpen ? 'md:w-56 md:shadow-2xl' : 'md:w-14 md:shadow-none')}>
        {groups.map(gp => { const active = gp.to ? (gp.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(gp.to)) : (gp.id === 'crm' && crmItems.some(i => loc.pathname.startsWith(i.to))) || (gp.items?.some(i => loc.pathname.startsWith(i.to) && i.to !== '/' && !(gp.id === 'auto' && i.to.startsWith('/developer'))) ?? false);
          const el = <span data-rail data-active={active} className={cx('rail-item flex h-10 w-10 items-center rounded-xl text-white/75 hover:bg-white/10 hover:text-white md:w-full', active && '!bg-white/15 !text-white', flyout === gp.id && '!bg-white/20 !text-white')}><span className="grid h-10 w-10 shrink-0 place-items-center"><Icon n={gp.icon} s={19} /></span><span className={cx('hidden whitespace-nowrap pr-3 text-[13.5px] font-semibold', railOpen && 'md:block')} aria-hidden={!railOpen}>{gp.label}</span></span>;
          return gp.to ? <NavLink key={gp.id} to={gp.to} title={gp.label} aria-label={gp.label}>{el}</NavLink> : <button key={gp.id} title={gp.label} aria-label={gp.label} aria-expanded={flyout === gp.id} onClick={() => setFlyout(flyout === gp.id ? null : gp.id)} className="cursor-pointer text-left">{el}</button>; })}
        <Link to="/settings" className="hidden h-10 items-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white md:mt-auto md:flex" title="Configuración" aria-label="Configuración"><span className="grid h-10 w-10 shrink-0 place-items-center"><Icon n="gear" s={19} /></span><span className={cx('hidden whitespace-nowrap pr-3 text-[13.5px] font-semibold', railOpen && 'md:block')} aria-hidden={!railOpen}>Configuración</span></Link>
      </nav></div>
      {flyout && <div ref={flyRef} className="rail pop fixed bottom-14 left-2 right-2 z-40 max-h-[70vh] overflow-auto rounded-2xl bg-rail-2 p-2 pb-3 text-white shadow-2xl md:absolute md:bottom-auto md:left-14 md:right-auto md:top-12 md:w-60 md:rounded-l-none md:rounded-r-2xl" role="menu">
        <h2 className="px-3 pb-1 pt-2 font-display text-[15px] font-bold">{groups.find(x => x.id === flyout)?.label}</h2>
        {flyout === 'crm' && crmItems.map(i => <div key={i.id} className="group flex items-center rounded-lg hover:bg-white/10"><NavLink to={i.to} className={({ isActive }) => cx('flex-1 px-3 py-1.5 text-[13.5px]', isActive && 'font-bold')}>{i.label}</NavLink><button onClick={() => savePins(pins.includes(i.id) ? pins.filter(p => p !== i.id) : [...pins, i.id])} aria-label={pins.includes(i.id) ? 'Quitar de marcadores' : 'Añadir a marcadores'} className={cx('mr-1 grid h-6 w-6 cursor-pointer place-items-center rounded', pins.includes(i.id) ? 'text-brand' : 'text-white/0 group-hover:text-white/70 focus-visible:text-white/80')}><Icon n="bookmark" s={14} /></button></div>)}
        {flyout === 'pins' && (pinned.length ? pinned.map(i => <NavLink key={i.id} to={i.to} className="block rounded-lg px-3 py-1.5 text-[13.5px] hover:bg-white/10">{i.label}</NavLink>) : <p className="px-3 py-2 text-[13px] text-white/70">Marca páginas del menú CRM para verlas aquí.</p>)}
        {groups.find(x => x.id === flyout)?.items?.map(i => <NavLink key={i.to + i.label} to={i.to} end className={({ isActive }) => cx('block rounded-lg px-3 py-1.5 text-[13.5px] hover:bg-white/10', isActive && 'font-bold')}>{i.label}</NavLink>)}
      </div>}
      <main id="contenido" tabIndex={-1} className="scroll-thin min-w-0 flex-1 overflow-auto outline-none"><div key={loc.pathname} className="page-in min-h-full"><Outlet /></div></main>
    </div>
    {create && <CreateRecord obj={create} onClose={() => setCreate(null)} />}
  </div>;
}
void OWNERS;
