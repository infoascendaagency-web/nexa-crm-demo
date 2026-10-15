// Widget de Inicio: "Mis tareas de hoy y vencidas".
import { Link } from 'react-router-dom';
import { CompleteButton, TargetLink, applyPatch } from './parts';
import { useNow } from './TasksWorkspace';
import { bucketOf, buildTargets, dueOf, endOfDay, relDue, sortByDue } from './util';
import { useDbValue, useSearch } from '../../lib/api';
import { useAccess } from '../../lib/perms';
import { ME } from '../../lib/schema';
import { Card, cx, useToast } from '../../components/ui';

export default function TasksWidget() {
  const acc = useAccess(); const toast = useToast(); const now = useNow(60000);
  const res = useSearch('tasks', ME.id ? { filterGroups: [{ filters: [{ propertyName: 'hubspot_owner_id', operator: 'EQ', value: ME.id }, { propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' }, { propertyName: 'hs_timestamp', operator: 'LTE', value: new Date(endOfDay(now)).toISOString() }] }], sorts: [{ propertyName: 'hs_timestamp', direction: 'ASCENDING' }], limit: 200 } : { limit: 1, filterGroups: [{ filters: [{ propertyName: 'hs_object_id', operator: 'EQ', value: '0' }] }] });
  const targets = useDbValue(() => buildTargets(), []);
  if (!ME.id || !acc.obj('tasks')) return null;
  const tasks = [...res.results].filter(t => dueOf(t) != null).sort(sortByDue);
  const overdue = tasks.filter(t => bucketOf(t, now) === 'overdue'); const today = tasks.filter(t => bucketOf(t, now) === 'today');
  const list = [...overdue, ...today].slice(0, 6);
  return <Card className="mb-4" title="Mis tareas de hoy y vencidas" action={<Link to="/tasks/workspace" className="text-[13px] font-semibold text-link hover:underline">Abrir mis tareas</Link>} pad={false}>
    <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-line px-4 py-2.5 text-[13px]" data-testid="tasks-widget">
      <Link to="/tasks/workspace?bucket=overdue" className={cx('font-semibold hover:underline', overdue.length ? 'text-bad' : 'text-slate')}>{overdue.length} {overdue.length === 1 ? 'vencida' : 'vencidas'}</Link>
      <Link to="/tasks/workspace?bucket=today" className="font-semibold text-navy hover:underline">{today.length} para hoy</Link></div>
    {list.length === 0 ? <p className="px-4 py-5 text-[13.5px] text-slate">Estás al día: no tienes tareas vencidas ni para hoy.</p>
      : <ul>{list.map(t => { const late = (dueOf(t) ?? 0) < now; return <li key={t.id} className="flex items-center gap-3 border-b border-line/70 px-4 py-2 last:border-b-0">
        <CompleteButton task={t} done={false} onToggle={() => { applyPatch([t], () => ({ hs_task_status: 'COMPLETED' })); toast('Tarea completada'); }} />
        <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold text-navy">{t.properties.hs_task_subject}</div><div className="flex flex-wrap gap-x-3 text-[12px]"><span className={late ? 'font-semibold text-bad' : 'text-slate'}>{relDue(dueOf(t), now)}</span><TargetLink target={targets.get(t.id)} className="text-[12px]" /></div></div></li>; })}</ul>}
    {tasks.length > list.length && <Link to="/tasks/workspace?bucket=overdue" className="block border-t border-line px-4 py-2 text-[13px] font-semibold text-link hover:bg-sky">Ver las {tasks.length - list.length} restantes</Link>}
  </Card>;
}
