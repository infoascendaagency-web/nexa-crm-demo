// Pedidos y pagos: modalidades de cobro clicables (se pueden activar varias) y bandeja de pedidos con confirmación (descuenta stock) y cancelación.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/backend';
import Icon from '../../components/Icon';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner, Switch, Textarea, cx, useToast } from '../../components/ui';
import { errMsg, fmt, type Settings } from './shared';

type Method = { id: string; label: string; kind: 'offline' | 'online'; description: string; implemented: boolean; docsUrl: string | null; enabled: boolean; status: 'ready' | 'needs_setup' | 'coming_soon'; config: Record<string, any>; configFields: { key: string; label: string; hint?: string; type?: 'text' | 'textarea' | 'bool' }[]; secretFields: { key: string; label: string }[]; secretHints: Record<string, string> };
type Order = { id: number; code: string; status: string; paymentMethod: string; paymentStatus: string; customerName: string; customerEmail: string | null; customerPhone: string | null; customerAddress: string | null; notes: string; currency: string; subtotal: number; discount: number; total: number; costTotal: number; contactId: number | null; stockApplied: boolean; createdAt: string; items?: { id: number; name: string; sku: string | null; qty: number; unitPrice: number; onSale: boolean }[] };
const ST: Record<string, { label: string; tone: string }> = { new: { label: 'Nuevo', tone: 'Pending' }, confirmed: { label: 'Confirmado', tone: 'Confirmed' }, shipped: { label: 'Enviado', tone: 'Confirmed' }, delivered: { label: 'Entregado', tone: 'Confirmed' }, cancelled: { label: 'Cancelado', tone: 'Canceled' } };
const PAY: Record<string, string> = { unpaid: 'Sin pagar', pending: 'Pendiente', paid: 'Pagado', refunded: 'Reembolsado' };
const ICON: Record<string, string> = { whatsapp: 'chat', form: 'form', stripe: 'coins', paypal: 'coins', mercadopago: 'coins' };

export default function Pedidos() {
  return <div className="space-y-5"><Methods /><Orders /></div>;
}

function Methods() {
  const toast = useToast(); const [list, setList] = useState<Method[] | null>(null); const [edit, setEdit] = useState<Method | null>(null);
  const load = useCallback(() => api<{ results: Method[] }>('GET', '/ecommerce/payment-methods').then(r => setList(r.results)).catch(() => toast('No se pudieron cargar las modalidades', 'err')), [toast]);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (m: Method) => { try { await api('PUT', `/ecommerce/payment-methods/${m.id}`, { enabled: !m.enabled }); await load(); } catch (e) { toast(errMsg(e), 'err'); } };
  if (!list) return <div className="grid place-items-center p-10"><Spinner s={20} /></div>;
  return <Card title="Cómo cobra tu tienda" action={<span className="text-[12.5px] text-slate">Pulsa para activar. Puedes tener varias a la vez.</span>}>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map(m => <div key={m.id} className={cx('rounded-xl border p-4', m.enabled ? 'border-brand bg-[#fff6f0]' : 'border-line bg-white')}>
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky text-navy"><Icon n={ICON[m.id] ?? 'coins'} s={20} /></span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="text-navy">{m.label}</b>{m.status === 'coming_soon' ? <Badge tone="Canceled">Próximamente</Badge> : m.status === 'needs_setup' ? <Badge tone="Pending">Falta configurar</Badge> : m.enabled ? <Badge tone="Confirmed">Activa</Badge> : null}</div>
          <p className="mt-1 text-[12.5px] text-slate">{m.description}</p></div>
        <Switch on={m.enabled} onChange={() => void toggle(m)} label={`Activar ${m.label}`} /></div>
      <div className="mt-3 flex items-center justify-between"><Button size="sm" onClick={() => setEdit(m)}>Configurar</Button>{m.kind === 'online' && <span className="text-[12px] text-slate">Se guarda para cuando se conecte</span>}</div></div>)}</div>
    {edit && <MethodEditor m={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
  </Card>;
}
function MethodEditor({ m, onClose, onSaved }: { m: Method; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const [cfg, setCfg] = useState<Record<string, any>>(m.config); const [sec, setSec] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api('PUT', `/ecommerce/payment-methods/${m.id}`, { config: cfg, ...(Object.keys(sec).length ? { secrets: sec } : {}) }); toast('Guardado'); onSaved(); } catch (e) { toast(errMsg(e), 'err'); setBusy(false); } };
  return <Modal title={m.label} onClose={onClose} footer={<div className="flex justify-end gap-2"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} disabled={busy}>Guardar</Button></div>}>
    <p className="mb-3 text-[13px] text-slate">{m.description}</p>
    {m.configFields.map(f => <Field key={f.key} label={f.label} hint={f.hint}>{f.type === 'textarea' ? <Textarea rows={3} value={cfg[f.key] ?? ''} onChange={e => setCfg({ ...cfg, [f.key]: e.target.value })} /> : f.type === 'bool' ? <Switch on={!!cfg[f.key]} onChange={v => setCfg({ ...cfg, [f.key]: v })} label={f.label} /> : <Input value={cfg[f.key] ?? ''} onChange={e => setCfg({ ...cfg, [f.key]: e.target.value })} />}</Field>)}
    {m.secretFields.map(f => <Field key={f.key} label={f.label} hint={m.secretHints[f.key] ? `Guardada ${m.secretHints[f.key]} · escribe para reemplazarla` : 'Se guarda cifrada y no se vuelve a mostrar'}><Input type="password" autoComplete="off" value={sec[f.key] ?? ''} onChange={e => setSec({ ...sec, [f.key]: e.target.value })} /></Field>)}
    {m.id === 'whatsapp' && <p className="text-[12.5px] text-slate">Si lo dejas vacío se usa el WhatsApp de «Portada y datos» en la pestaña Tienda.</p>}
    {!m.implemented && <p className="rounded-lg bg-sky p-2.5 text-[12.5px] text-navy">La pasarela se conectará más adelante. Mientras tanto no se ofrece a tus clientes, aunque la actives.{m.docsUrl && <> Documentación: <a className="underline" href={m.docsUrl} target="_blank" rel="noreferrer">{m.docsUrl}</a></>}</p>}
  </Modal>;
}

function Orders() {
  const toast = useToast(); const [status, setStatus] = useState(''); const [qs, setQs] = useState(''); const [data, setData] = useState<{ total: number; counts: Record<string, number>; results: Order[] } | null>(null); const [open, setOpen] = useState<number | null>(null); const [cur, setCur] = useState<Settings | null>(null);
  const load = useCallback(() => { const p = new URLSearchParams({ limit: '100' }); if (status) p.set('status', status); if (qs.trim()) p.set('q', qs.trim()); api<typeof data>('GET', `/ecommerce/orders?${p}`).then(setData).catch(() => toast('No se pudieron cargar los pedidos', 'err')); }, [status, qs, toast]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api<Settings>('GET', '/ecommerce/settings').then(setCur).catch(() => {}); }, []);
  const c = data?.counts ?? {};
  return <Card pad={false} title="Pedidos" action={<div className="flex flex-wrap items-center gap-2"><Select aria-label="Estado" value={status} onChange={e => setStatus(e.target.value)} className="!w-44"><option value="">Todos</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.label} {c[k] ? `(${c[k]})` : ''}</option>)}</Select><Input aria-label="Buscar" placeholder="Código, nombre o teléfono" value={qs} onChange={e => setQs(e.target.value)} className="!w-56" /></div>}>
    {!data ? <div className="grid place-items-center p-10"><Spinner /></div> : !data.results.length ? <Empty icon="cart" title="Sin pedidos todavía">Cuando un cliente envíe un pedido desde tu tienda aparecerá aquí, y también como contacto en el CRM.</Empty>
      : <div className="scroll-thin overflow-auto"><table className="w-full min-w-[720px] text-[13.5px]"><thead><tr className="border-b border-line text-left text-[12px] font-bold uppercase text-slate"><th className="px-3 py-2">Pedido</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Fecha</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Pago</th></tr></thead>
        <tbody>{data.results.map(o => <tr key={o.id} onClick={() => setOpen(o.id)} className="cursor-pointer border-b border-line/60 hover:bg-canvas"><td className="px-3 py-2 font-bold text-navy">{o.code}</td><td className="px-3 py-2">{o.customerName}<div className="text-[12px] text-slate">{o.customerPhone ?? o.customerEmail}</div></td><td className="px-3 py-2 text-slate">{new Date(o.createdAt).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td className="px-3 py-2 text-right font-semibold tabular">{fmt(o.total, o.currency, cur?.locale)}</td><td className="px-3 py-2"><Badge tone={ST[o.status]?.tone}>{ST[o.status]?.label ?? o.status}</Badge></td><td className="px-3 py-2 text-slate">{PAY[o.paymentStatus]} · {o.paymentMethod}</td></tr>)}</tbody></table></div>}
    {open && <OrderModal id={open} locale={cur?.locale} onClose={() => setOpen(null)} onChanged={load} />}
  </Card>;
}
function OrderModal({ id, locale, onClose, onChanged }: { id: number; locale?: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast(); const [o, setO] = useState<Order | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(() => api<Order>('GET', `/ecommerce/orders/${id}`).then(setO).catch(() => toast('No se pudo abrir el pedido', 'err')), [id, toast]);
  useEffect(() => { void load(); }, [load]);
  const patch = async (b: Record<string, string>, ok: string) => { setBusy(true); try { await api('PATCH', `/ecommerce/orders/${id}`, b); toast(ok); await load(); onChanged(); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); } };
  if (!o) return <Modal title="Pedido" onClose={onClose}><div className="grid place-items-center p-8"><Spinner /></div></Modal>;
  return <Modal title={`Pedido ${o.code}`} onClose={onClose} width="max-w-2xl" footer={<div className="flex flex-wrap justify-between gap-2">
    <div>{o.status !== 'cancelled' && <Button variant="danger" disabled={busy} onClick={() => void patch({ status: 'cancelled' }, o.stockApplied ? 'Pedido cancelado y stock devuelto' : 'Pedido cancelado')}>Cancelar pedido</Button>}</div>
    <div className="flex flex-wrap gap-2">{o.status === 'new' && <Button variant="primary" disabled={busy} onClick={() => void patch({ status: 'confirmed' }, 'Confirmado: existencias descontadas')}>Confirmar (descuenta stock)</Button>}
      {o.status === 'confirmed' && <Button variant="primary" disabled={busy} onClick={() => void patch({ status: 'shipped' }, 'Marcado como enviado')}>Marcar enviado</Button>}
      {o.status === 'shipped' && <Button variant="primary" disabled={busy} onClick={() => void patch({ status: 'delivered' }, 'Marcado como entregado')}>Marcar entregado</Button>}
      {o.paymentStatus !== 'paid' && o.status !== 'cancelled' && <Button disabled={busy} onClick={() => void patch({ paymentStatus: 'paid' }, 'Pago registrado')}>Marcar pagado</Button>}</div></div>}>
    <div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone={ST[o.status]?.tone}>{ST[o.status]?.label}</Badge><span className="text-[13px] text-slate">{PAY[o.paymentStatus]} · {o.paymentMethod}</span>{o.stockApplied && <span className="text-[12.5px] text-slate">· existencias ya descontadas</span>}</div>
    <div className="mb-3 grid gap-1 text-[13.5px]"><div><b>{o.customerName}</b></div>{o.customerPhone && <div>Tel. {o.customerPhone}</div>}{o.customerEmail && <div>{o.customerEmail}</div>}{o.customerAddress && <div>{o.customerAddress}</div>}{o.notes && <div className="text-slate">«{o.notes}»</div>}
      {o.contactId && <Link to={`/contacts/${o.contactId}`} className="text-link underline">Ver contacto en el CRM</Link>}</div>
    <table className="w-full text-[13.5px]"><tbody>{(o.items ?? []).map(i => <tr key={i.id} className="border-t border-line/60"><td className="py-1.5">{i.qty} × {i.name}{i.sku ? <span className="text-slate"> ({i.sku})</span> : ''}{i.onSale && <span className="ml-1 rounded bg-[#FFD43B] px-1 text-[10.5px] font-extrabold">OFERTA</span>}</td><td className="py-1.5 text-right tabular">{fmt(i.qty * i.unitPrice, o.currency, locale)}</td></tr>)}</tbody></table>
    <div className="mt-2 space-y-0.5 border-t border-line pt-2 text-right text-[13.5px]">{o.discount > 0 && <div className="text-slate">Ahorro por ofertas {fmt(o.discount, o.currency, locale)}</div>}<div className="text-[16px] font-bold text-navy">Total {fmt(o.total, o.currency, locale)}</div><div className="text-[12.5px] text-slate">Costo {fmt(o.costTotal, o.currency, locale)} · Margen {fmt(o.total - o.costTotal, o.currency, locale)}</div></div>
  </Modal>;
}
