import { useDbValue, crm } from '../lib/api';
import { SETTERS, ownerName } from '../lib/schema';
import { Avatar, Card, PageHeader } from '../components/ui';
import Dashboard from './Reports';

export const DashboardAdmin = () => <Dashboard title="Informe admin" />;

/** Rendimiento por setter, calculado en vivo con los registros de la demo. */
export function DashboardSetters() {
  const rows = useDbValue(() => {
    const since = Date.now() - 30 * 86400000;
    const contacts = crm.search('contacts', { limit: 100000 }).results, calls = crm.search('calls', { limit: 100000 }).results.filter(c => Date.parse(c.properties.hs_timestamp ?? '') >= since);
    const appts = crm.search('appointments', { limit: 100000 }).results, tasks = crm.search('tasks', { limit: 100000 }).results, deals = crm.search('deals', { limit: 100000 }).results;
    return SETTERS.map(o => {
      const mine = (r: { properties: Record<string, string | null> }) => r.properties.hubspot_owner_id === o.id; const cs = calls.filter(mine);
      const talk = cs.reduce((a, c) => a + Number(c.properties.hs_call_duration || 0), 0) / 60000;
      return { id: o.id, name: ownerName(o.id) ?? '', leads: contacts.filter(mine).length, calls: cs.length, answered: cs.filter(c => c.properties.hs_call_status === 'COMPLETED').length, talk: Math.round(talk), appts: appts.filter(mine).length, open: tasks.filter(t => mine(t) && t.properties.hs_task_status !== 'COMPLETED').length, deals: deals.filter(mine).length };
    }).sort((a, b) => b.calls - a.calls);
  }, []);
  const max = Math.max(1, ...rows.map(r => r.calls));
  return <div className="p-4 sm:p-6"><PageHeader title="Informe de setters" sub="Últimos 30 días · calculado en vivo con los datos de la demo" />
    <Card pad={false}><div className="overflow-x-auto"><table className="w-full text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12.5px] font-bold text-slate"><th className="px-4 py-2.5">Setter</th><th>Leads</th><th>Llamadas</th><th>Contestadas</th><th>Min. hablados</th><th>Citas</th><th>Tareas abiertas</th><th>Negocios</th><th className="w-40 pr-4">Actividad</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id} className="border-b border-line/70"><td className="px-4 py-2.5"><span className="flex items-center gap-2 font-semibold"><Avatar name={r.name} size={24} />{r.name}</span></td><td className="tabular">{r.leads}</td><td className="tabular">{r.calls}</td><td className="tabular">{r.answered} <span className="text-slate">({r.calls ? Math.round(r.answered / r.calls * 100) : 0}%)</span></td><td className="tabular">{r.talk}</td><td className="tabular">{r.appts}</td><td className="tabular">{r.open}</td><td className="tabular">{r.deals}</td><td className="pr-4"><div className="h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-teal" style={{ width: `${r.calls / max * 100}%` }} /></div></td></tr>)}</tbody></table></div></Card></div>;
}
