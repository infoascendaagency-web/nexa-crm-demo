import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { crm, useAssoc, useRecord } from '../lib/api';
import { fmtDateTime, fmtDuration } from '../lib/fmt';
import { ownerName } from '../lib/schema';
import type { ObjKey, Rec } from '../lib/types';
import Icon from './Icon';
import { Badge, cx } from './ui';

export type ActTab = 'all' | 'notes' | 'emails' | 'calls' | 'tasks' | 'meetings';
type Ev = { kind: 'task' | 'note' | 'email' | 'call' | 'meeting' | 'created'; at: number; rec?: Rec; parent: Rec };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const isEmail = (r: Rec) => (r.properties.hs_note_body ?? '').startsWith('✉️');

export default function Timeline({ obj, id, tab, query, owner, expandAll }: { obj: ObjKey; id: string; tab: ActTab; query: string; owner: string; expandAll: boolean | null }) {
  const parent = useRecord(obj, id); const notes = useAssoc(obj, id, 'notes'); const calls = useAssoc(obj, id, 'calls'); const tasks = useAssoc(obj, id, 'tasks'); const meetings = useAssoc(obj, id, 'meetings');
  const now = Date.now();
  const events = useMemo<Ev[]>(() => {
    if (!parent) return [];
    const ev: Ev[] = [];
    notes.forEach(r => ev.push({ kind: isEmail(r) ? 'email' : 'note', at: Date.parse(r.properties.hs_timestamp ?? r.createdAt), rec: r, parent }));
    calls.forEach(r => ev.push({ kind: 'call', at: Date.parse(r.properties.hs_timestamp ?? r.createdAt), rec: r, parent }));
    tasks.forEach(r => ev.push({ kind: 'task', at: Date.parse(r.properties.hs_timestamp ?? r.createdAt), rec: r, parent }));
    meetings.forEach(r => ev.push({ kind: 'meeting', at: Date.parse(r.properties.hs_timestamp ?? r.createdAt), rec: r, parent }));
    ev.push({ kind: 'created', at: Date.parse(parent.createdAt), parent });
    return ev;
  }, [parent, notes, calls, tasks, meetings]);
  const filtered = events.filter(e => {
    if (tab === 'notes' && e.kind !== 'note') return false; if (tab === 'emails' && e.kind !== 'email') return false; if (tab === 'calls' && e.kind !== 'call') return false; if (tab === 'tasks' && e.kind !== 'task') return false; if (tab === 'meetings' && e.kind !== 'meeting') return false;
    if (owner && e.rec?.properties.hubspot_owner_id !== owner) return false;
    if (query.trim()) { const q = query.toLowerCase(); return Object.values(e.rec?.properties ?? {}).join(' ').toLowerCase().includes(q); }
    return true;
  });
  if (!parent) return null;
  const pinnedId = parent.properties.hs_pinned_engagement_id;
  const pinned = pinnedId ? filtered.find(e => e.rec?.id === pinnedId) : undefined;
  const rest = filtered.filter(e => e !== pinned);
  const open = rest.filter(e => e.kind === 'task' && e.rec!.properties.hs_task_status !== 'COMPLETED');
  const overdue = open.filter(e => e.at < now).sort((a, b) => a.at - b.at);
  const upcoming = [...open.filter(e => e.at >= now), ...rest.filter(e => e.kind === 'meeting' && e.at >= now)].sort((a, b) => a.at - b.at);
  const past = rest.filter(e => !overdue.includes(e) && !upcoming.includes(e)).sort((a, b) => b.at - a.at);
  const byMonth: { label: string; items: Ev[] }[] = []; past.forEach(e => { const d = new Date(e.at); const l = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; const last = byMonth[byMonth.length - 1]; if (last?.label === l) last.items.push(e); else byMonth.push({ label: l, items: [e] }); });
  const Section = ({ title, items, tone }: { title: string; items: Ev[]; tone?: string }) => items.length ? <section className="mb-4"><h4 className={cx('mb-2 text-[13px] font-bold', tone ?? 'text-navy')}>{title}</h4><div className="space-y-2">{items.map(e => <Item key={(e.rec?.id ?? 'created') + e.kind} e={e} obj={obj} expandAll={expandAll} />)}</div></section> : null;
  return <div>
    {pinned && <div className="mb-4"><Item e={pinned} obj={obj} pinned expandAll={expandAll} /></div>}
    <Section title="Atrasado" items={overdue} tone="text-bad" /><Section title="Próximamente" items={upcoming} />
    {byMonth.map(m => <Section key={m.label} title={m.label} items={m.items} />)}
    {filtered.length === 0 && <p className="py-10 text-center text-[13.5px] text-slate">No hay actividades que coincidan.</p>}
  </div>;
}

function Item({ e, obj, pinned, expandAll }: { e: Ev; obj: ObjKey; pinned?: boolean; expandAll: boolean | null }) {
  const [own, setOwn] = useState(false); const open = expandAll ?? own; const r = e.rec; const p = r?.properties ?? {}; const owner = ownerName(p.hubspot_owner_id) ?? '—';
  const contact = obj === 'contacts' ? e.parent : r ? crm.firstAssoc('calls', r.id, 'contacts') : null;
  const wrap = (icon: string, head: React.ReactNode, sub: React.ReactNode, when: string, body?: React.ReactNode, extra?: React.ReactNode, tone = '') =>
    <article className={cx('rounded-xl border bg-white p-3.5', pinned ? 'border-[#F3D98B] bg-[#FFF8E1]' : 'border-line', tone)}>
      <div className="flex items-start gap-2.5"><button onClick={() => setOwn(!own)} aria-expanded={open} aria-label={open ? 'Contraer' : 'Expandir'} className="mt-0.5 cursor-pointer text-slate"><Icon n={open ? 'chevD' : 'chevR'} s={15} /></button>
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky text-navy"><Icon n={icon} s={13} /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3"><div className="text-[13.5px] text-ink">{head}</div><div className="text-[12px] text-slate">{when}</div></div><div className={cx('mt-0.5 text-[13.5px] text-ink', !open && 'line-clamp-2')}>{sub}</div>{open && body}{extra}</div></div></article>;
  if (e.kind === 'created') return wrap('plus', <b>Creado</b>, `Este registro fue creado el ${fmtDateTime(e.parent.createdAt, { rel: false })}.`, fmtDateTime(e.parent.createdAt));
  if (e.kind === 'task') { const done = p.hs_task_status === 'COMPLETED'; const late = !done && e.at < Date.now();
    return <article className="rounded-xl border border-line bg-white p-3.5"><div className="flex items-start gap-2.5"><button aria-label={done ? 'Reabrir tarea' : 'Completar tarea'} onClick={() => crm.update('tasks', r!.id, { hs_task_status: done ? 'NOT_STARTED' : 'COMPLETED' })} className={cx('mt-0.5 grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full border', done ? 'border-good bg-good text-white' : late ? 'border-bad text-transparent hover:bg-red-50 hover:text-bad' : 'border-line-2 text-transparent hover:text-good')}><Icon n="check" s={12} stroke={2.4} /></button>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-3"><div className="text-[13.5px]"><b>Tarea</b> asignada a {owner}</div><span className={cx('text-[12px]', late ? 'font-semibold text-bad' : done ? 'text-good' : 'text-slate')}>{done ? 'Completada' : late ? 'Con demora' : 'Pendiente'}: {fmtDateTime(p.hs_timestamp)}</span></div>
        <div className={cx('mt-0.5 text-[13.5px]', done && 'text-slate line-through')}>{p.hs_task_subject}{p.hs_task_subject?.startsWith('[Nexa AUTO]') && <Badge className="ml-2" tone="Other">AUTO</Badge>}</div>{p.hs_task_body && <div className="mt-1 text-[13px] text-slate">{p.hs_task_body}</div>}</div></div></article>; }
  if (e.kind === 'note' || e.kind === 'email') return wrap(e.kind === 'note' ? 'note' : 'mail', <><b>{e.kind === 'note' ? 'Nota' : 'Correo'}</b> de {owner}{pinned && <span className="ml-2 text-[11px] font-bold text-warn">📌 Fijada</span>}</>, <span className="whitespace-pre-wrap">{p.hs_note_body}</span>, fmtDateTime(p.hs_timestamp), undefined,
    obj === 'contacts' || obj === 'appointments' ? <button className="mt-1.5 cursor-pointer text-[12px] font-semibold text-link hover:underline" onClick={() => crm.update(obj, e.parent.id, { hs_pinned_engagement_id: pinned ? null : r!.id })}>{pinned ? 'Desfijar' : 'Fijar'}</button> : null);
  if (e.kind === 'call') { const ok = p.hs_call_status === 'COMPLETED'; const out = p.hs_call_direction === 'OUTBOUND'; const title = ok ? <><b>Llamadas</b> {out ? 'hechas' : 'recibidas'} por {owner}</> : <><b>Llamadas registradas - Sin respuesta</b> por {owner}</>;
    return wrap('phone', title, <><div>De: {out ? owner : (contact ? crm.nameOf(contact, 'contacts') : '—')} · Para: {out ? (contact ? crm.nameOf(contact, 'contacts') : '—') : owner}</div>{p.hs_call_body && <div className="text-slate">{p.hs_call_body}</div>}</>, fmtDateTime(p.hs_timestamp),
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]"><div><dt className="text-[11.5px] font-bold text-slate">Duración</dt><dd>{fmtDuration(p.hs_call_duration)}</dd></div><div><dt className="text-[11.5px] font-bold text-slate">Resultado</dt><dd>{p.hs_call_disposition ?? '--'}</dd></div>
        {p.dialpad_call_ai_summary && <div className="col-span-2 rounded-lg bg-sky/60 p-2"><dt className="text-[11.5px] font-bold text-navy">Resumen IA (Dialpad)</dt><dd>{p.dialpad_call_ai_summary}</dd></div>}{p.hs_call_recording_url && <div className="col-span-2"><a className="inline-flex items-center gap-1 font-semibold text-link hover:underline" href={p.hs_call_recording_url} target="_blank" rel="noopener noreferrer"><Icon n="play" s={13} />Ver grabación en Dialpad</a></div>}</dl>); }
  return wrap('calendar', <><b>Reunión</b> con {owner}</>, p.hs_meeting_title, fmtDateTime(p.hs_timestamp));
}
void Link;
