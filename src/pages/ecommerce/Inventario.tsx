// Inventario: tabla editable en línea (edición masiva), totales de costo y de venta, alertas de stock bajo y movimientos de existencias.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/backend';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner, cx, useToast } from '../../components/ui';
import { errMsg, fmt, type Category, type Product, type Settings } from './shared';

type Inv = { lowStockThreshold: number; totals: { units: number; totalCost: number; totalSale: number; potentialMargin: number; marginPct: number; items: number; lowStock: number }; results: Product[] };
type Move = { id: number; productId: number; name: string; sku: string | null; kind: string; qty: number; stockAfter: number; reason: string; by: string | null; createdAt: string };
type Draft = { price?: number; cost?: number; salePrice?: number | null; stock?: number };
const KIND: Record<string, string> = { in: 'Entrada', out: 'Salida', adjust: 'Ajuste', sale: 'Venta', return: 'Devolución' };

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return <div className="rounded-xl border border-line bg-white p-4"><div className="text-[11.5px] font-bold uppercase tracking-wide text-slate">{label}</div><div className={cx('mt-1 font-display text-[26px] font-bold leading-none tabular', tone ?? 'text-navy')}>{value}</div>{sub && <div className="mt-1 text-[12.5px] text-slate">{sub}</div>}</div>;
}
export default function Inventario() {
  const toast = useToast(); const [shop, setShop] = useState<Settings | null>(null); const [cats, setCats] = useState<Category[]>([]); const [inv, setInv] = useState<Inv | null>(null);
  const [cat, setCat] = useState(''); const [qs, setQs] = useState(''); const [low, setLow] = useState(false); const [drafts, setDrafts] = useState<Record<number, Draft>>({}); const [busy, setBusy] = useState(false);
  const [move, setMove] = useState<Product | null>(null); const [hist, setHist] = useState<Product | 'all' | null>(null);
  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (cat) p.set('categoryId', cat); if (qs.trim()) p.set('q', qs.trim()); if (low) p.set('low', '1');
    try { const [i, s, c] = await Promise.all([api<Inv>('GET', `/ecommerce/inventory?${p}`), shop ? Promise.resolve(shop) : api<Settings>('GET', '/ecommerce/settings'), cats.length ? Promise.resolve({ results: cats }) : api<{ results: Category[] }>('GET', '/ecommerce/categories')]); setInv(i); setShop(s); setCats(c.results); }
    catch { toast('No se pudo cargar el inventario', 'err'); }
  }, [cat, qs, low]); // eslint-disable-line
  useEffect(() => { const t = setTimeout(() => void load(), 200); return () => clearTimeout(t); }, [load]);
  const dirty = Object.keys(drafts).length;
  const edit = (id: number, patch: Draft) => setDrafts(d => { const n = { ...d, [id]: { ...d[id], ...patch } }; const p = inv?.results.find(x => x.id === id); if (p) { for (const k of Object.keys(n[id]) as (keyof Draft)[]) if (n[id][k] === (p as any)[k === 'stock' ? 'stock' : k]) delete n[id][k]; if (!Object.keys(n[id]).length) delete n[id]; } return n; });
  const save = async () => {
    setBusy(true);
    try { await api('POST', '/ecommerce/products/bulk', { updates: Object.entries(drafts).map(([id, d]) => ({ id: Number(id), ...d })) }); toast(`${dirty} artículo(s) actualizados`); setDrafts({}); await load(); }
    catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
  };
  const cur = shop?.currency ?? 'USD', loc = shop?.locale ?? 'es';
  const live = useMemo(() => {   // totales que reflejan también lo que estás editando
    if (!inv) return null; let cost = 0, sale = 0;
    for (const p of inv.results) { if (!p.trackStock) continue; const d = drafts[p.id] ?? {}; const s = Math.max(0, d.stock ?? p.stock), c = d.cost ?? p.cost, pr = d.price ?? p.price, sp = d.salePrice === undefined ? p.salePrice : d.salePrice; const eff = p.onSale && sp != null && sp < pr ? sp : (d.salePrice === undefined ? (p.onSale ? p.effectivePrice : pr) : pr); cost += s * c; sale += s * eff; }
    return { cost, sale, margin: sale - cost, pct: sale > 0 ? Math.round(((sale - cost) / sale) * 1000) / 10 : 0 };
  }, [inv, drafts]);
  if (!inv || !live) return <div className="grid place-items-center p-12"><Spinner s={22} /></div>;
  const numCell = (p: Product, k: 'price' | 'cost' | 'stock', step = '0.01') => <input aria-label={k} type="number" min={0} step={step} value={drafts[p.id]?.[k] ?? p[k]} onChange={e => edit(p.id, { [k]: k === 'stock' ? Math.max(0, Math.floor(Number(e.target.value))) : Number(e.target.value) })} className={cx('h-8 w-24 rounded-md border bg-white px-2 text-right text-[13.5px] tabular', drafts[p.id]?.[k] !== undefined ? 'border-brand bg-[#fff6f0]' : 'border-line')} />;
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Stat label="Costo total del inventario" value={fmt(live.cost, cur, loc)} sub={`${inv.totals.units} unidades`} />
      <Stat label="Valor total de venta" value={fmt(live.sale, cur, loc)} sub="a precio vigente (con ofertas)" />
      <Stat label="Margen potencial" value={fmt(live.margin, cur, loc)} sub={`${live.pct}% del valor de venta`} tone={live.margin >= 0 ? 'text-good' : 'text-bad'} />
      <Stat label="Artículos" value={String(inv.totals.items)} />
      <button onClick={() => setLow(v => !v)} className="cursor-pointer text-left"><Stat label="Stock bajo o agotado" value={String(inv.totals.lowStock)} sub={`umbral ≤ ${inv.lowStockThreshold} · pulsa para filtrar`} tone={inv.totals.lowStock ? 'text-warn' : 'text-navy'} /></button>
    </div>
    <Card pad={false} title="Existencias" action={<div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Sección" value={cat} onChange={e => setCat(e.target.value)} className="!w-44"><option value="">Todas las secciones</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Input aria-label="Buscar" placeholder="Buscar nombre o código" value={qs} onChange={e => setQs(e.target.value)} className="!w-52" />
      <Button size="sm" onClick={() => setHist('all')}>Historial</Button>
      {dirty > 0 && <><Button size="sm" onClick={() => setDrafts({})}>Descartar</Button><Button variant="primary" size="sm" onClick={save} disabled={busy}>{busy ? 'Guardando…' : `Guardar ${dirty} cambio(s)`}</Button></>}</div>}>
      {!inv.results.length ? <Empty icon="box" title="Sin artículos">Crea artículos en la pestaña Tienda y aquí controlas sus costos y existencias.</Empty>
        : <div className="scroll-thin max-h-[calc(100vh-24rem)] overflow-auto"><table className="w-full min-w-[820px] border-collapse text-[13.5px]"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b border-line text-left text-[12px] font-bold uppercase text-slate">
          <th className="px-3 py-2">Artículo</th><th className="px-3 py-2">Código</th><th className="px-3 py-2 text-right">Costo</th><th className="px-3 py-2 text-right">Precio</th><th className="px-3 py-2 text-right">Margen</th><th className="px-3 py-2 text-right">Existencias</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2" /></tr></thead>
          <tbody>{inv.results.map(p => { const d = drafts[p.id] ?? {}; const price = d.price ?? p.price, c = d.cost ?? p.cost; return <tr key={p.id} className="border-b border-line/60 hover:bg-canvas">
            <td className="px-3 py-1.5"><div className="max-w-[20rem] truncate font-semibold text-navy">{p.name}</div>{p.onSale && <span className="rounded bg-[#FFD43B] px-1.5 text-[10.5px] font-extrabold">OFERTA {fmt(p.effectivePrice, cur, loc)}</span>}</td>
            <td className="px-3 py-1.5 text-slate">{p.sku ?? '—'}</td><td className="px-3 py-1.5 text-right">{numCell(p, 'cost')}</td><td className="px-3 py-1.5 text-right">{numCell(p, 'price')}</td>
            <td className={cx('px-3 py-1.5 text-right tabular', price - c < 0 && 'text-bad')}>{price > 0 ? `${Math.round(((price - c) / price) * 100)}%` : '—'}</td>
            <td className="px-3 py-1.5 text-right">{p.trackStock ? numCell(p, 'stock', '1') : <span className="text-slate">sin control</span>}</td>
            <td className="px-3 py-1.5">{p.trackStock ? (p.stockLevel === 'out' ? <Badge tone="Canceled">Agotado</Badge> : p.stockLevel === 'low' ? <Badge tone="Pending">Bajo</Badge> : <Badge tone="Confirmed">OK</Badge>) : null}{p.status !== 'published' && <span className="ml-1 text-[12px] text-slate">{p.status === 'draft' ? 'borrador' : ''}</span>}</td>
            <td className="px-3 py-1.5 text-right"><Button size="sm" onClick={() => setMove(p)}>Movimiento</Button> <Button size="sm" onClick={() => setHist(p)}>Historial</Button></td></tr>; })}</tbody></table></div>}
    </Card>
    {move && <MoveModal p={move} onClose={() => setMove(null)} onDone={() => { setMove(null); void load(); }} />}
    {hist && <History p={hist === 'all' ? null : hist} onClose={() => setHist(null)} />}
  </div>;
}

function MoveModal({ p, onClose, onDone }: { p: Product; onClose: () => void; onDone: () => void }) {
  const toast = useToast(); const [kind, setKind] = useState<'in' | 'out' | 'adjust'>('in'); const [qty, setQty] = useState(1); const [reason, setReason] = useState(''); const [cost, setCost] = useState<string>(''); const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await api('POST', '/ecommerce/inventory/moves', { productId: p.id, kind, qty, reason, unitCost: kind === 'in' && cost !== '' ? Number(cost) : null }); toast('Movimiento registrado'); onDone(); } catch (e) { toast(errMsg(e), 'err'); setBusy(false); } };
  return <Modal title={`Movimiento · ${p.name}`} onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={go} disabled={busy}>Registrar</Button></div>}>
    <p className="mb-3 text-[13px] text-slate">Existencia actual: <b>{p.stock}</b></p>
    <Field label="Tipo"><Select value={kind} onChange={e => setKind(e.target.value as any)}><option value="in">Entrada (compra / reposición)</option><option value="out">Salida (merma, regalo, uso)</option><option value="adjust">Ajuste (fijar la existencia a…)</option></Select></Field>
    <Field label={kind === 'adjust' ? 'Nueva existencia' : 'Cantidad'}><Input type="number" min={kind === 'adjust' ? 0 : 1} step="1" value={qty} onChange={e => setQty(Math.floor(Number(e.target.value)))} /></Field>
    {kind === 'in' && <Field label="Costo unitario de esta compra (opcional)" hint="Actualiza el costo vigente del artículo."><Input type="number" min={0} step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></Field>}
    <Field label="Motivo"><Input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} /></Field>
  </Modal>;
}
function History({ p, onClose }: { p: Product | null; onClose: () => void }) {
  const [rows, setRows] = useState<Move[] | null>(null);
  useEffect(() => { api<{ results: Move[] }>('GET', `/ecommerce/inventory/moves${p ? `?productId=${p.id}` : ''}`).then(r => setRows(r.results)).catch(() => setRows([])); }, [p]);
  return <Modal title={p ? `Historial · ${p.name}` : 'Historial de movimientos'} onClose={onClose} width="max-w-3xl">
    {!rows ? <div className="grid place-items-center p-8"><Spinner /></div> : !rows.length ? <Empty icon="list" title="Sin movimientos">Aquí verás cada entrada, salida, ajuste y venta.</Empty>
      : <div className="scroll-thin max-h-[60vh] overflow-auto"><table className="w-full text-[13px]"><thead><tr className="text-left text-[12px] font-bold uppercase text-slate"><th className="py-1.5">Fecha</th>{!p && <th>Artículo</th>}<th>Tipo</th><th className="text-right">Cant.</th><th className="text-right">Quedó</th><th className="pl-3">Motivo</th></tr></thead>
        <tbody>{rows.map(m => <tr key={m.id} className="border-t border-line/60"><td className="py-1.5">{new Date(m.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>{!p && <td className="max-w-[12rem] truncate">{m.name}</td>}<td>{KIND[m.kind] ?? m.kind}</td><td className={cx('text-right tabular', m.qty < 0 ? 'text-bad' : 'text-good')}>{m.qty > 0 ? '+' : ''}{m.qty}</td><td className="text-right tabular">{m.stockAfter}</td><td className="pl-3 text-slate">{m.reason}{m.by ? ` · ${m.by}` : ''}</td></tr>)}</tbody></table></div>}
  </Modal>;
}
