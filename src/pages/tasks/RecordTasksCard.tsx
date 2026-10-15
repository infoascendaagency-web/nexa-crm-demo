// Tarjeta "Tareas" de la ficha (contacto, cita, negocio, empresa): próxima tarea, abiertas, crear y ver todas.
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { cx, useToast } from '../../components/ui';
import { useAssoc } from '../../lib/api';
import type { ObjKey } from '../../lib/types';
import { CompleteButton, PRIO_STYLE, Tag, applyPatch, prioOf } from './parts';
import { PRIO_LABEL, dueOf, isDone, relDue, sortByDue } from './util';
import { ownerName } from '../../lib/schema';

export default function RecordTasksCard({ obj, id, onCreate, onSeeAll }: { obj: ObjKey; id: string; onCreate: () => void; onSeeAll: () => void }) {
  const all = useAssoc(obj, id, 'tasks'); const toast = useToast(); const now = Date.now();
  const open = all.filter(t => !isDone(t)).sort(sortByDue); const done = all.length - open.length; const [next, ...rest] = open;
  const row = (t: typeof next, main: boolean) => { const due = dueOf(t); const late = due != null && due < now; const prio = prioOf(t);
    return <div key={t.id} className={cx('flex items-start gap-2.5', main && 'rounded-lg bg-sky/60 p-2.5')}>
      <CompleteButton task={t} done={false} onToggle={() => { applyPatch([t], () => ({ hs_task_status: 'COMPLETED' })); toast('Tarea completada'); }} />
      <div className="min-w-0 flex-1"><Link to={`/tasks/${t.id}`} className="block truncate text-[13.5px] font-semibold text-navy hover:underline">{t.properties.hs_task_subject}</Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]"><span className={late ? 'font-semibold text-bad' : 'text-slate'}>{relDue(due, now)}</span>{prio !== 'NONE' && <Tag cls={PRIO_STYLE[prio]}>{PRIO_LABEL[prio]}</Tag>}<span className="text-slate">{ownerName(t.properties.hubspot_owner_id) ?? 'Sin propietario'}</span></div></div></div>; };
  return <section className="rounded-xl border border-line bg-white p-3.5" aria-label="Tareas" data-testid="record-tasks-card">
    <div className="mb-2 flex items-center justify-between"><h3 className="font-display text-[14.5px] font-bold text-navy">Tareas{open.length > 0 && <span className="ml-2 rounded-full bg-sky px-2 text-[12px] font-semibold">{open.length}</span>}</h3>
      <button type="button" onClick={onCreate} className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-link hover:bg-sky"><Icon n="plus" s={14} />Crear</button></div>
    {next ? <div className="space-y-2.5"><div><div className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-slate">Próxima tarea</div>{row(next, true)}</div>
      {rest.length > 0 && <div className="space-y-2.5">{rest.slice(0, 3).map(t => row(t, false))}</div>}</div>
      : <p className="text-[13px] text-slate">No hay tareas abiertas.</p>}
    <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[12.5px]"><button type="button" onClick={onSeeAll} className="cursor-pointer font-semibold text-link hover:underline">Ver todas ({all.length})</button>{done > 0 && <span className="text-slate">{done} completada{done === 1 ? '' : 's'}</span>}</div>
  </section>;
}
