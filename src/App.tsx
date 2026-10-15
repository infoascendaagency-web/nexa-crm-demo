import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button, ErrorBoundary, useToast } from './components/ui';
import * as be from './lib/backend';
import { fromMe, setServerPerms } from './lib/perms';
import { useAuth } from './lib/auth';
import Guard from './components/Guard';
import Login, { SessionLoading } from './pages/Login';
import { EnrollGate, SecurityPage } from './pages/Security';
import PublicForm from './pages/forms/PublicForm';
import MustChangeGate from './pages/users/MustChangeGate';
import VerifyEmail from './pages/users/VerifyEmail';
import { FormBuilder as FormBuilderV2, FormsList as FormsListV2 } from './pages/forms/FormBuilder';
import ObjectIndex from './components/ObjectIndex';
import RecordPage from './components/RecordPage';
import Shell from './components/Shell';
import type { ObjKey } from './lib/types';
import { AutomationPage, ListsPage, ViewsAdmin } from './pages/Misc';
import Social from './pages/Social';
import Ecommerce from './pages/ecommerce/Ecommerce';
import { DevApps, DevAppDetail, DevDocs, DevKeys, DevLayout, DevLogs, DevOverview, DevUsage } from './pages/Dev';
import { DevProjects, DevMcp, DevTests } from './pages/dev/DevExtra';
import Dashboard from './pages/Reports';
import { DashboardAdmin, DashboardSetters } from './pages/Dashboards';
import { AccountPage, AuditPage, DomainsPage, ImportPage, IntegrationsPage, ObjectsPage, PropertiesPage, SimplePage } from './pages/SettingsData';
import SettingsLayout from './pages/SettingsLayout';
import SettingsUsers from './pages/SettingsUsers';
import UserDetail from './pages/UserDetail';
import TasksWorkspace from './pages/tasks/TasksWorkspace';
import NotifyPrefs from './pages/tasks/NotifyPrefs';
import { TagsList } from './pages/tags/TagsList';
import { TagEditor } from './pages/tags/TagEditor';
import { PublicTags, useTagsFence } from './pages/tags/PublicTags';
import { BlogEditor, BlogList, FilesPage, FormBuilder, FormsList, LandingEditor, LandingList } from './pages/Site';

const IDX: ObjKey[] = ['contacts', 'companies', 'deals', 'appointments', 'tasks', 'calls', 'meetings', 'notes', 'tickets', 'leads', 'communications', 'products', 'line_items', 'quotes', 'invoices'];
/** Modo conectado: tras iniciar sesión hidrata el almacén local desde /bootstrap (permisos efectivos de /auth/me incluidos). */
function useConnectedBoot() {
  const { status, user, mode } = useAuth(); const toast = useToast(); const [ready, setReady] = useState(mode === 'demo'); const [err, setErr] = useState(''); const [n, setN] = useState(0);
  useEffect(() => {
    if (mode !== 'connected') return; be.setNotifier(toast);
    if (status !== 'authed') { setReady(false); be.stop(); return; }
    let alive = true; setErr(''); setServerPerms(fromMe(user.me), !!user.me?.permissions?.superAdmin);
    be.start({ ownerId: user.ownerId ?? null, fullName: user.name, email: user.email }).then(() => alive && setReady(true)).catch(e => alive && setErr(e?.code ?? 'No se pudieron cargar los datos'));
    return () => { alive = false; };
  }, [status, user.id, user.me?.twoFactor?.enabled, user.me?.mustChangePassword, n, mode]); // eslint-disable-line
  return { ready, err, retry: () => setN(x => x + 1) };
}
export default function App() {
  const { status, user } = useAuth(); const loc = useLocation(); const boot = useConnectedBoot();
  useTagsFence(loc.pathname);   // si una página pública cargó códigos y se navega a una pantalla privada, recarga limpio
  const pub = /^\/landing\/([a-z0-9-]{3,120})\/?$/.exec(loc.pathname);   // formulario público: sin sesión ni menú
  if (pub) return <><PublicTags /><PublicForm code={pub[1]} /></>;
  if (loc.pathname === '/verify-email') return <VerifyEmail />;   // sin códigos de terceros: la URL lleva un token secreto
  if (/^\/contacto\/?$/.test(loc.pathname)) return <><PublicTags /><PublicForm slot="contacto" /></>;   // el formulario cambia según la UTM de la URL
  if (status === 'loading') return <SessionLoading />;
  if (status === 'anon') return <Login />;
  if (user.me?.mustChangePassword) return <MustChangeGate />;   // contraseña temporal: primero crear la propia, luego (admin) activar 2FA
  if (user.me?.twoFactor?.required && !user.me.twoFactor.enabled) return <EnrollGate />;   // admin sin 2FA: no hay CRM hasta activarlo
  if (boot.err) return <div className="grid h-full place-items-center bg-canvas p-6 text-center" role="alert"><div><h1 className="font-display text-[20px] font-bold text-navy">No se pudieron cargar los datos</h1><p className="mt-1 text-[13.5px] text-slate">{boot.err}</p><Button className="mt-4" variant="primary" onClick={boot.retry}>Reintentar</Button></div></div>;
  if (!boot.ready) return <SessionLoading />;
  return <ErrorBoundary resetKey={loc.pathname}><Routes><Route element={<Shell />}>
    <Route index element={<Dashboard />} />
    <Route path="/reports" element={<Navigate to="/dashboard/admin" replace />} />
    <Route path="/dashboard" element={<Navigate to="/dashboard/admin" replace />} />
    <Route path="/dashboard/admin" element={<Guard section="dashAdmin"><DashboardAdmin /></Guard>} />
    <Route path="/dashboard/setters" element={<Guard section="dashSetters"><DashboardSetters /></Guard>} />
    <Route path="/tasks/workspace" element={<Guard obj="tasks"><TasksWorkspace /></Guard>} />
    {IDX.map(o => <Route key={o} path={`/${o}`} element={<Guard obj={o}><ObjectIndex obj={o} /></Guard>} />)}
    {IDX.filter(o => o !== 'notes').map(o => <Route key={o + 'r'} path={`/${o}/:id`} element={<Guard obj={o}><RecordPage obj={o} /></Guard>} />)}
    <Route path="/notes/:id" element={<Navigate to="/notes" replace />} />
    <Route path="/views/:obj" element={<ViewsAdmin />} />
    <Route path="/lists" element={<ListsPage />} />
    <Route path="/social" element={<Guard section="social"><Social /></Guard>} />
    <Route path="/ecommerce/*" element={<Guard section="ecommerce"><Ecommerce /></Guard>} />
    <Route path="/automation" element={<Guard section="automation"><AutomationPage /></Guard>} />
    <Route path="/site/forms" element={<Guard section="siteForms"><FormsListV2 /></Guard>} /><Route path="/site/forms/:id" element={<Guard section="siteForms"><FormBuilderV2 /></Guard>} />
    <Route path="/site/blog" element={<Guard section="siteBlog"><div className="p-4 sm:p-6"><BlogList /></div></Guard>} /><Route path="/site/blog/:id" element={<Guard section="siteBlog"><div className="p-4 sm:p-6"><BlogEditor /></div></Guard>} />
    <Route path="/site/tags" element={<Guard section="siteTags"><TagsList /></Guard>} /><Route path="/site/tags/:id" element={<Guard section="siteTags"><TagEditor /></Guard>} />
    <Route path="/developer" element={<Guard section="dev"><DevLayout /></Guard>}><Route index element={<DevOverview />} /><Route path="apps" element={<DevApps />} /><Route path="apps/:id" element={<DevAppDetail />} /><Route path="logs" element={<DevLogs />} /><Route path="usage" element={<DevUsage />} /><Route path="keys" element={<DevKeys />} /><Route path="docs" element={<DevDocs />} /><Route path="projects" element={<DevProjects />} /><Route path="mcp" element={<DevMcp />} /><Route path="tests" element={<DevTests />} /></Route>
    <Route path="/settings" element={<SettingsLayout />}>
      <Route index element={<Navigate to="/settings/account" replace />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="preferences" element={<SimplePage title="Preferencias generales"><p className="text-[13.5px] text-slate">Idioma de la interfaz: Español. Zona horaria: America/New_York.</p></SimplePage>} />
      <Route path="notifications" element={<NotifyPrefs />} />
      <Route path="account" element={<Guard section="settings"><AccountPage /></Guard>} /><Route path="audit" element={<Guard section="settings"><AuditPage /></Guard>} /><Route path="users" element={<Guard section="settings"><SettingsUsers /></Guard>} /><Route path="users/:id" element={<Guard section="settings"><UserDetail /></Guard>} /><Route path="integrations" element={<Guard section="integrations"><IntegrationsPage /></Guard>} />
      <Route path="properties" element={<Guard section="settings"><PropertiesPage /></Guard>} /><Route path="objects" element={<Guard section="settings"><ObjectsPage /></Guard>} /><Route path="import" element={<Guard section="settings"><ImportPage /></Guard>} /><Route path="domains" element={<Guard section="settings"><DomainsPage /></Guard>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes></ErrorBoundary>;
}
