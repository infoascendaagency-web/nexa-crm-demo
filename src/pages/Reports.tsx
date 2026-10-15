import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { crm, useDbValue } from '../lib/api';
import { fmtDateTime, fmtMoney } from '../lib/fmt';
import { ME, OWNERS, PIPELINES, SETTERS, ownerName, propDef } from '../lib/schema';
import type { Filter } from '../lib/types';
import { Avatar, Button, Card, PageHeader, Select, cx } from '../components/ui';
import TasksWidget from './tasks/TasksWidget';

type Period = '30' | 'billing' | 'all';
function range(p: Period): { from: number | null; label: string } {
  const now = new Date(); if (p === 'all') return { from: null, label: 'Todo el tiempo' };
  if (p === '30') return { from: Date.now() - 30 * 86400000, label: 'Últimos 30 días' };
  const d = now.getDate() >= 16 ? new Date(now.getFullYear(), now.getMonth(), 16) : new Date(now.getFullYear(), now.getMonth() - 1, 16); return { from: d.getTime(), label: `Período 16→15 (desde el ${d.getDate()}/${d.getMonth() + 1})` };
}
const gte = (prop: string, from: number | null): Filter[] => (from ? [{ propertyName: prop, operator: 'GTE', value: new Date(from).toISOString() }] : []);

function HBars({ rows, color = 'bg-navy' }: { rows: { label: string; n: number; sub?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return <ul className="space-y-2">{rows.map(r => <li key={r.label}><div className="flex items-baseline justify-between text-[13px]"><span className="truncate pr-2 font-medium text-ink">{r.label}</span><span className="tabular font-semibold text-navy">{r.sub ?? r.n}</span></div><div className="mt-0.5 h-2 overflow-hidden rounded-full bg-canvas"><div className={cx('grow-x h-full rounded-full', color)} style={{ width: `${(r.n / max) * 100}%` }} /></div></li>)}{rows.length === 0 && <li className="text-[13px] text-slate">Sin datos.</li>}</ul>;
}
function Cols({ data }: { data: { label: string; n: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.n));
  return <div className="flex h-40 items-stretch gap-[3px]" role="img" aria-label="Contactos creados por día">{data.map((d, i) => <div key={i} className="group relative flex flex-1 flex-col justify-end" title={`${d.label}: ${d.n}`}><div className="grow-y w-full rounded-t bg-teal/80 group-hover:bg-teal" style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} /></div>)}</div>;
}
function Stat({ label, value, sub, to, warn }: { label: string; value: string | number; sub?: string; to?: string; warn?: boolean }) {
  const inner = <><div className="text-[11.5px] font-bold uppercase tracking-wide text-slate">{label}</div><div className={cx('mt-1 font-display text-[30px] font-bold leading-none tabular', warn ? 'text-brand' : 'text-navy')}>{value}</div>{sub && <div className="mt-1 text-[12px] text-slate">{sub}</div>}</>;
  return to ? <Link to={to} className="rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)] hover:border-link hover:shadow-md">{inner}</Link> : <div className="rounded-xl border border-line bg-white p-4">{inner}</div>;
}

export default function Dashboard({ title = 'Panel' }: { title?: string }) {
  const [period, setPeriod] = useState<Period>('30'); const { from, label } = range(period);
  const d = useDbValue(() => {
    const created = gte('createdate', from);
    const contacts = crm.search('contacts', { filterGroups: created.length ? [{ filters: created }] : [], limit: 100000 });
    const all = contacts.results;
    const appts = crm.search('appointments', { filterGroups: from ? [{ filters: gte('hs_createdate', from) }] : [], limit: 100000 });
    const sales = all.filter(c => c.properties.hs_lead_status === 'Sale').length;
    const tasksOpen = crm.search('tasks', { filterGroups: [{ filters: [{ propertyName: 'hs_task_status', operator: 'NEQ', value: 'COMPLETED' }] }], limit: 100000 }).results;
    const overdue = tasksOpen.filter(t => t.properties.hs_timestamp && t.properties.hs_timestamp < new Date().toISOString());
    const calls = crm.search('calls', { filterGroups: from ? [{ filters: gte('hs_timestamp', from) }] : [], limit: 100000 }).results;
    const deals = crm.search('deals', { limit: 100000 }).results.filter(x => x.properties.pipeline === PIPELINES.deals[0].id);
    const days = Array.from({ length: 30 }, (_, i) => { const t = new Date(Date.now() - (29 - i) * 86400000); const k = t.toISOString().slice(0, 10); return { label: `${t.getDate()}/${t.getMonth() + 1}`, n: all.filter(c => c.createdAt.slice(0, 10) === k).length }; });
    const byStatus = Object.entries(all.reduce<Record<string, number>>((m, c) => { const k = c.properties.hs_lead_status ?? '(sin estado)'; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const byOwner = OWNERS.map(o => ({ label: `${o.firstName} ${o.lastName}`, n: all.filter(c => c.properties.hubspot_owner_id === o.id).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
    const noOwner = all.filter(c => !c.properties.hubspot_owner_id).length;
    const bySource = Object.entries(all.reduce<Record<string, number>>((m, c) => { const k = c.properties.lead_source ?? '(sin fuente)'; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
    const tasksBy = SETTERS.map(o => ({ label: `${o.firstName} ${o.lastName}`, n: tasksOpen.filter(t => t.properties.hubspot_owner_id === o.id).length, late: overdue.filter(t => t.properties.hubspot_owner_id === o.id).length })).sort((a, b) => b.n - a.n);
    const stages = PIPELINES.deals[0].stages.map(s => { const r = deals.filter(x => x.properties.dealstage === s.id); return { label: s.label, n: r.length, v: r.reduce((a, x) => a + Number(x.properties.amount || 0), 0) }; });
    const feed = [...calls.slice(0, 40), ...crm.search('notes', { limit: 20 }).results].sort((a, b) => (b.properties.hs_timestamp ?? '').localeCompare(a.properties.hs_timestamp ?? '')).slice(0, 8);
    return { all, appts: appts.total, sales, tasksOpen: tasksOpen.length, overdue: overdue.length, calls: calls.length, answered: calls.filter(c => c.properties.hs_call_status === 'COMPLETED').length, days, byStatus, byOwner, noOwner, bySource, tasksBy, stages, feed, dealValue: deals.reduce((a, x) => a + Number(x.properties.amount || 0), 0), dealsN: deals.length };
  }, [period]);
  const conv = d.all.length ? ((d.appts / d.all.length) * 100).toFixed(1) : '0.0'; const convSale = d.all.length ? ((d.sales / d.all.length) * 100).toFixed(1) : '0.0';
  const feedIcon = useMemo(() => (r: { properties: Record<string, string | null> }) => (r.properties.hs_call_title ? 'llamada' : 'nota'), []);
  return <div className="p-4 sm:p-6"><PageHeader title={title} sub={`Hola, ${ME.firstName}. Resumen del equipo · ${label}`} actions={<Select aria-label="Período" value={period} onChange={e => setPeriod(e.target.value as Period)} className="!w-72"><option value="30">Últimos 30 días</option><option value="billing">Período 16→15 (mes de facturación)</option><option value="all">Todo el tiempo</option></Select>} />
    {title === 'Panel' && <TasksWidget />}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Stat label="Contactos creados" value={d.all.length} to="/contacts" /><Stat label="Citas creadas" value={d.appts} sub={`${conv}% de los contactos`} to="/appointments" /><Stat label="Ventas (lead status)" value={d.sales} sub={`${convSale}% de los contactos`} /><Stat label="Tareas abiertas" value={d.tasksOpen} to="/tasks" /><Stat label="Tareas atrasadas" value={d.overdue} warn={d.overdue > 0} to="/tasks?view=t-overdue" /><Stat label="Llamadas" value={d.calls} sub={`${d.answered} contestadas`} to="/calls" /></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2" title="Contactos creados por día (30 días)"><Cols data={d.days} /><div className="mt-1 flex justify-between text-[11px] text-slate"><span>{d.days[0].label}</span><span>{d.days[29].label}</span></div></Card>
      <Card title="Actividades del equipo" pad={false}><ul className="max-h-[230px] divide-y divide-line overflow-auto">{d.feed.map(r => <li key={r.id} className="px-4 py-2 text-[13px]"><span className="font-semibold">{ownerName(r.properties.hubspot_owner_id) ?? '—'}</span> registró {feedIcon(r) === 'llamada' ? 'una llamada' : 'una nota'}<div className="truncate text-slate">{r.properties.hs_call_title ?? r.properties.hs_note_body}</div><div className="text-[11.5px] text-mute">{fmtDateTime(r.properties.hs_timestamp)}</div></li>)}</ul></Card>
      <Card title="Contactos por estado del lead"><HBars rows={d.byStatus.map(([label, n]) => ({ label, n }))} /></Card>
      <Card title="Contactos por propietario" action={d.noOwner ? <span className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11.5px] font-semibold text-bad">{d.noOwner} sin propietario</span> : undefined}><HBars rows={d.byOwner} color="bg-teal" /></Card>
      <Card title="Contactos por fuente"><HBars rows={d.bySource.map(([label, n]) => ({ label, n }))} color="bg-brand" /></Card>
      <Card title="Tareas abiertas por setter"><ul className="space-y-2">{d.tasksBy.map(t => <li key={t.label} className="flex items-center gap-2 text-[13px]"><Avatar name={t.label} size={22} /><span className="flex-1 truncate font-medium">{t.label}</span><span className="tabular text-navy">{t.n}</span>{t.late > 0 && <span className="rounded-full bg-[#FDECEC] px-1.5 text-[11px] font-semibold text-bad">{t.late} atrasadas</span>}</li>)}</ul></Card>
      <Card title="Embudo (período)"><HBars rows={[{ label: 'Contactos creados', n: d.all.length }, { label: 'Citas creadas', n: d.appts }, { label: 'Ventas', n: d.sales }]} /></Card>
      <Card title="Previsión de negocios por etapa" action={<span className="text-[12.5px] font-semibold text-navy">{d.dealsN} · {fmtMoney(String(d.dealValue))}</span>}><HBars rows={d.stages.map(s => ({ label: s.label, n: s.v, sub: `${s.n} · ${fmtMoney(String(s.v))}` }))} color="bg-[#6B46C1]" /></Card>
    </div><p className="mt-4 text-[12px] text-slate">Datos de demostración. Los informes se calculan con la misma búsqueda que usará el backend real.</p>
    <span className="hidden"><Button>x</Button>{propDef('contacts', 'email')?.name}</span></div>;
}
