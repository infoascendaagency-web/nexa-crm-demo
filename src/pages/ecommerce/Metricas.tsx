// Métricas: más y menos vendidos, ticket promedio, curva de ventas, comparación con el periodo anterior y con meses anteriores, margen y rotación.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/backend';
import { Button, Card, Empty, Select, Spinner, cx, useToast } from '../../components/ui';
import { fmt, pct } from './shared';

type Sum = { revenue: number; cost: number; profit: number; marginPct: number; orders: number; units: number; avgTicket: number };
type Row = { id: number; name: string; sku: string | null; units: number; revenue: number; profit: number; stock: number; rotation: number };
type M = { currency: string; range: { from: string; to: string; bucket: string }; summary: Sum; previous: Sum; change: Record<string, number | null>; series: { t: string; revenue: number; orders: number; cost: number }[]; top: Row[]; bottom: Row[]; slowMovers: Row[]; categories: { name: string; revenue: number; units: number }[];
  months: { month: string; revenue: number; orders: number; profit: number; avgTicket: number }[]; monthCompare: { current: any; previous: any; sameMonthLastYear: any; vsPrevious: number | null; vsLastYear: number | null }; inventory: { totalCost: number; totalSale: number; lowStock: number }; ordersByStatus: Record<string, number> };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const PRESETS = [{ id: '7', label: 'Últimos 7 días' }, { id: '30', label: 'Últimos 30 días' }, { id: '90', label: 'Últimos 90 días' }, { id: 'ytd', label: 'Este año' }, { id: '365', label: 'Últimos 12 meses' }];

function Kpi({ label, value, change }: { label: string; value: string; change?: number | null }) {
  return <div className="rounded-xl border border-line bg-white p-4"><div className="text-[11.5px] font-bold uppercase tracking-wide text-slate">{label}</div><div className="mt-1 font-display text-[26px] font-bold leading-none tabular text-navy">{value}</div>
    {change !== undefined && <div className={cx('mt-1 text-[12.5px] font-semibold', change == null ? 'text-slate' : change >= 0 ? 'text-good' : 'text-bad')}>{pct(change)} <span className="font-normal text-slate">vs. periodo anterior</span></div>}</div>;
}
function Line({ data, cur, locale }: { data: { t: string; revenue: number; cost: number }[]; cur: string; locale: string }) {
  const W = 760, H = 210, P = { l: 52, r: 12, t: 12, b: 26 }; const max = Math.max(1, ...data.map(d => d.revenue)); const x = (i: number) => P.l + (data.length < 2 ? 0 : (i / (data.length - 1)) * (W - P.l - P.r)); const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = (k: 'revenue' | 'cost') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' '); const [hover, setHover] = useState<number | null>(null);
  const ticks = [0, 0.5, 1].map(f => f * max); const step = Math.max(1, Math.ceil(data.length / 8));
  return <div className="relative"><svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Curva de ventas" onMouseLeave={() => setHover(null)} onMouseMove={e => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (data.length - 1))))); }}>
    {ticks.map((v, i) => <g key={i}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#e3e8ef" /><text x={P.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="#5c6b82">{fmt(v, cur, locale).replace(/\D00$/, '')}</text></g>)}
    <path d={`${path('revenue')} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="#E8590C" opacity=".1" /><path d={path('cost')} fill="none" stroke="#9aa8bb" strokeWidth="1.5" strokeDasharray="4 3" /><path d={path('revenue')} fill="none" stroke="#E8590C" strokeWidth="2.2" />
    {data.map((d, i) => i % step === 0 && <text key={d.t} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#5c6b82">{d.t.slice(5)}</text>)}
    {hover != null && <g><line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="#14213d" opacity=".25" /><circle cx={x(hover)} cy={y(data[hover].revenue)} r="4" fill="#E8590C" /></g>}</svg>
    {hover != null && <div className="pointer-events-none absolute right-2 top-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] shadow"><b>{data[hover].t}</b><div>Ventas {fmt(data[hover].revenue, cur, locale)}</div><div className="text-slate">Costo {fmt(data[hover].cost, cur, locale)}</div></div>}
    <div className="mt-1 flex gap-4 text-[12px] text-slate"><span className="inline-flex items-center gap-1"><i className="h-0.5 w-4 bg-[#E8590C]" /> Ventas</span><span className="inline-flex items-center gap-1"><i className="h-0.5 w-4 border-t border-dashed border-[#9aa8bb]" /> Costo</span></div></div>;
}
function Bars({ rows, cur, locale, metric }: { rows: Row[]; cur: string; locale: string; metric: 'units' | 'revenue' }) {
  const max = Math.max(1, ...rows.map(r => r[metric]));
  return <div className="space-y-1.5">{rows.map(r => <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[13px]"><div><div className="truncate font-semibold text-navy">{r.name}</div><div className="h-2 overflow-hidden rounded bg-sky"><div className="h-full rounded bg-brand" style={{ width: `${Math.max(2, (r[metric] / max) * 100)}%` }} /></div></div>
    <div className="text-right tabular"><b>{r.units}</b> u. <span className="text-slate">· {fmt(r.revenue, cur, locale)}</span></div></div>)}</div>;
}

export default function Metricas() {
  const toast = useToast(); const [preset, setPreset] = useState('30'); const [bucket, setBucket] = useState(''); const [m, setM] = useState<M | null>(null); const [loc, setLoc] = useState('es');
  const range = useMemo(() => { const to = new Date(); const from = new Date(); if (preset === 'ytd') from.setMonth(0, 1); else from.setDate(from.getDate() - (Number(preset) - 1)); return { from: iso(from), to: iso(to) }; }, [preset]);
  useEffect(() => { setM(null); const p = new URLSearchParams(range); if (bucket) p.set('bucket', bucket); api<M>('GET', `/ecommerce/metrics?${p}`).then(setM).catch(() => toast('No se pudieron calcular las métricas', 'err')); api<{ locale: string }>('GET', '/ecommerce/settings').then(s => setLoc(s.locale)).catch(() => {}); }, [range, bucket, toast]);
  if (!m) return <div className="grid place-items-center p-12"><Spinner s={22} /></div>;
  const c = m.currency; const mc = m.monthCompare; const maxM = Math.max(1, ...m.months.map(x => x.revenue));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2"><Select aria-label="Periodo" value={preset} onChange={e => setPreset(e.target.value)} className="!w-48">{PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
      <Select aria-label="Agrupar" value={bucket} onChange={e => setBucket(e.target.value)} className="!w-40"><option value="">Agrupar: automático</option><option value="day">Por día</option><option value="week">Por semana</option><option value="month">Por mes</option></Select>
      <span className="text-[12.5px] text-slate">Una venta cuenta cuando el pedido está confirmado, enviado o entregado.</span></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Kpi label="Ingresos" value={fmt(m.summary.revenue, c, loc)} change={m.change.revenue} /><Kpi label="Ganancia" value={fmt(m.summary.profit, c, loc)} change={m.change.profit} /><Kpi label="Pedidos" value={String(m.summary.orders)} change={m.change.orders} /><Kpi label="Ticket promedio" value={fmt(m.summary.avgTicket, c, loc)} change={m.change.avgTicket} /><Kpi label="Margen" value={`${m.summary.marginPct}%`} /></div>
    <Card title="Curva de ventas">{m.series.every(s => !s.revenue) ? <Empty icon="reports" title="Sin ventas en este periodo">Confirma pedidos para ver la curva.</Empty> : <Line data={m.series} cur={c} locale={loc} />}</Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Más vendidos">{m.top.length ? <Bars rows={m.top} cur={c} locale={loc} metric="units" /> : <Empty icon="box" title="Aún no hay ventas" />}</Card>
      <Card title="Menos vendidos (publicados)">{m.bottom.length ? <Bars rows={m.bottom} cur={c} locale={loc} metric="units" /> : <Empty icon="box" title="Sin artículos publicados" />}</Card></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Comparación con meses anteriores" action={<span className="text-[12.5px] text-slate">Este mes {pct(mc.vsPrevious)} vs. mes anterior · {pct(mc.vsLastYear)} vs. mismo mes del año pasado</span>}>
        <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Ventas por mes">{m.months.map((x, i) => <div key={x.month} className="group relative flex flex-1 flex-col items-center justify-end" title={`${x.month}: ${fmt(x.revenue, c, loc)} · ${x.orders} pedidos`}><div className={cx('w-full rounded-t', i === m.months.length - 1 ? 'bg-brand' : 'bg-[#f4b48f]')} style={{ height: `${Math.max(2, (x.revenue / maxM) * 100)}%` }} /><span className="mt-1 text-[10px] text-slate">{x.month.slice(5)}</span></div>)}</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12.5px]"><div><div className="text-slate">Este mes</div><b>{fmt(mc.current.revenue, c, loc)}</b></div><div><div className="text-slate">Mes anterior</div><b>{fmt(mc.previous.revenue, c, loc)}</b></div><div><div className="text-slate">Hace un año</div><b>{fmt(mc.sameMonthLastYear.revenue, c, loc)}</b></div></div></Card>
      <Card title="Ventas por sección">{m.categories.length ? <div className="space-y-1.5">{m.categories.map(x => <div key={x.name} className="flex items-center justify-between text-[13.5px]"><span className="truncate font-semibold text-navy">{x.name}</span><span className="tabular">{fmt(x.revenue, c, loc)} <span className="text-slate">· {x.units} u.</span></span></div>)}</div> : <Empty icon="tag" title="Sin datos" />}</Card></div>
    <Card title="Inventario y rotación"><div className="grid gap-3 sm:grid-cols-3"><div><div className="text-slate text-[12.5px]">Costo en existencias</div><b className="text-[18px]">{fmt(m.inventory.totalCost, c, loc)}</b></div><div><div className="text-slate text-[12.5px]">Valor de venta en existencias</div><b className="text-[18px]">{fmt(m.inventory.totalSale, c, loc)}</b></div><div><div className="text-slate text-[12.5px]">Con stock bajo o agotado</div><b className="text-[18px]">{m.inventory.lowStock}</b></div></div>
      {m.slowMovers.length > 0 && <div className="mt-3"><div className="mb-1 text-[12.5px] font-bold uppercase text-slate">Rotación más lenta</div>{m.slowMovers.map(r => <div key={r.id} className="flex justify-between border-t border-line/60 py-1 text-[13.5px]"><span className="truncate">{r.name}</span><span className="tabular text-slate">{r.stock} en stock · rotación {r.rotation}</span></div>)}</div>}</Card>
  </div>;
}
