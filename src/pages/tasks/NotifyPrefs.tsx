// Configuración → Notificaciones: preferencia "recibir avisos de tareas por correo".
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, Switch, useToast } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import * as be from '../../lib/backend';
import { useAccess } from '../../lib/perms';

const KEY = 'nx-notify-task-email';
export default function NotifyPrefs() {
  const auth = useAuth(); const acc = useAccess(); const toast = useToast(); const connected = auth.mode === 'connected';
  const [on, setOn] = useState<boolean | null>(connected ? null : (() => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } })());
  const [pend, setPend] = useState<{ pending: number; assigned: number; overdue: number } | null>(null);
  useEffect(() => { if (!connected) return; be.api<{ notifyTaskEmail: boolean }>('GET', '/tasks-workspace/prefs').then(r => setOn(r.notifyTaskEmail)).catch(() => setOn(true)); }, [connected]);
  useEffect(() => { if (connected && acc.isAdmin) be.api('GET', '/tasks-workspace/outbox-summary').then(setPend).catch(() => {}); }, [connected, acc.isAdmin]);
  const change = (v: boolean) => {
    const prev = on; setOn(v);
    if (!connected) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* */ } toast(v ? 'Avisos de tareas activados' : 'Avisos de tareas desactivados'); return; }
    be.api('PUT', '/tasks-workspace/prefs', { notifyTaskEmail: v }).then(() => toast(v ? 'Recibirás avisos de tareas por correo' : 'Ya no recibirás avisos de tareas por correo')).catch(() => { setOn(prev); toast('No se pudo guardar la preferencia', 'err'); });
  };
  return <div className="max-w-3xl"><PageHeader title="Notificaciones" sub="Cómo quieres enterarte de tus tareas." />
    <Card title="Tareas">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><p className="text-[14px] font-semibold text-ink">Recibir avisos de tareas por correo</p>
          <p className="mt-1 text-[13px] text-slate">Te escribimos a <b>{auth.user.email}</b> cuando te asignan una <b>tarea nueva</b> (o te la reasignan) y cuando una tarea tuya <b>vence sin completarse</b> (un aviso por tarea y día, hasta 7 días de atraso). No te avisamos de las tareas que creas para ti.</p></div>
        {on != null && <Switch on={on} onChange={change} label="Recibir avisos de tareas por correo" />}
      </div>
      <p className="mt-4 text-[13px] text-slate">Dentro del CRM, la campana de arriba muestra tus tareas atrasadas. <Link to="/tasks/workspace" className="font-semibold text-link hover:underline">Ver mis tareas</Link></p>
    </Card>
    {pend && <Card className="mt-4" title="Bandeja de avisos (solo administración)"><p className="text-[13.5px] text-slate" data-testid="outbox-card">Avisos de tareas pendientes de envío: <b className="text-navy">{pend.pending}</b> ({pend.assigned} de tarea nueva · {pend.overdue} de tarea vencida). El CRM no envía correos: los anota y un flujo de n8n los envía.</p></Card>}
  </div>;
}
