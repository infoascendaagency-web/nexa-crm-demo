// Constructor de la tienda: portada con secciones (tarjetas que se arrastran), artículos (con oferta, fotos y especificaciones) y vista previa en vivo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, BASE } from '../../lib/backend';
import Icon from '../../components/Icon';
import { Badge, Button, Card, Drawer, Empty, Field, Input, Select, Spinner, Switch, Textarea, cx, useToast } from '../../components/ui';
import { storePreviewHtml } from '../../lib/mock-api';
import { errMsg, fmt, uploadImage, dstr, type Category, type Img, type Product, type Settings } from './shared';

function useDragList<T extends { id: number }>(items: T[], onReorder: (ids: number[]) => void) {
  const from = useRef<number | null>(null);
  return (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { from.current = i; e.dataTransfer.effectAllowed = 'move'; },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const f = from.current; from.current = null; if (f == null || f === i) return; const next = [...items]; const [m] = next.splice(f, 1); next.splice(i, 0, m); onReorder(next.map(x => x.id)); },
  });
}
const EMPTY: Partial<Product> = { name: '', sku: '', description: '', categoryId: null, price: 0, cost: 0, salePrice: null, saleStarts: null, saleEnds: null, stock: 0, trackStock: true, specs: [], badge: '', status: 'draft', images: [] };

export default function Tienda() {
  const toast = useToast();
  const [shop, setShop] = useState<Settings | null>(null); const [cats, setCats] = useState<Category[] | null>(null); const [prods, setProds] = useState<Product[] | null>(null);
  const [sel, setSel] = useState<number | 'all'>('all'); const [edit, setEdit] = useState<Partial<Product> | null>(null); const [catEdit, setCatEdit] = useState<Partial<Category> | null>(null);
  const [previewKey, setPreviewKey] = useState(0); const [cover, setCover] = useState(false);
  const load = useCallback(async () => {
    try { const [s, c, p] = await Promise.all([api<Settings>('GET', '/ecommerce/settings'), api<{ results: Category[] }>('GET', '/ecommerce/categories'), api<{ results: Product[] }>('GET', '/ecommerce/products?limit=500')]); setShop(s); setCats(c.results); setProds(p.results); setPreviewKey(k => k + 1); }
    catch { toast('No se pudo cargar la tienda', 'err'); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);
  const catDrag = useDragList(cats ?? [], async ids => { setCats(ids.map(id => cats!.find(c => c.id === id)!)); try { await api('POST', '/ecommerce/categories/reorder', { ids }); setPreviewKey(k => k + 1); } catch { void load(); } });
  const shown = (prods ?? []).filter(p => sel === 'all' || p.categoryId === sel);
  const prodDrag = useDragList(shown, async ids => { const rest = (prods ?? []).filter(p => !ids.includes(p.id)).map(p => p.id); const all = sel === 'all' ? ids : [...ids, ...rest]; setProds(all.map(id => prods!.find(p => p.id === id)!).filter(Boolean)); try { await api('POST', '/ecommerce/products/reorder', { ids: all }); setPreviewKey(k => k + 1); } catch { void load(); } });
  if (!shop || !cats || !prods) return <div className="grid place-items-center p-12"><Spinner s={22} /></div>;
  const togglePublished = async (v: boolean) => { try { setShop(await api<Settings>('PUT', '/ecommerce/settings', { published: v })); toast(v ? 'Tienda publicada' : 'Tienda oculta'); } catch (e) { toast(errMsg(e), 'err'); } };
  return <div className="grid gap-5 xl:grid-cols-[1fr_26rem]">
    <div className="min-w-0 space-y-5">
      <Card title="Portada y secciones" action={<div className="flex items-center gap-3"><Switch on={shop.published} onChange={togglePublished} label="Tienda publicada" /><span className="text-[12.5px] text-slate">{shop.published ? 'Publicada' : 'Oculta'}</span><Button size="sm" onClick={() => setCover(true)}>Portada y datos</Button></div>}>
        <p className="mb-3 text-[13px] text-slate">Cada tarjeta es una sección de tu portada. <b>Arrástralas</b> para cambiar el orden en que las ve el cliente.</p>
        <div className="flex gap-3 overflow-x-auto pb-2 scroll-thin" role="list" aria-label="Secciones">
          <button onClick={() => setSel('all')} className={cx('w-44 shrink-0 cursor-pointer rounded-xl border p-3 text-left', sel === 'all' ? 'border-brand bg-[#fff6f0]' : 'border-line bg-white')}><Icon n="box" s={20} /><div className="mt-2 font-bold text-navy">Todo</div><div className="text-[12.5px] text-slate">{prods.length} artículos</div></button>
          {cats.map((c, i) => <div key={c.id} role="listitem" {...catDrag(i)} onClick={() => setSel(c.id)} className={cx('w-44 shrink-0 cursor-grab rounded-xl border bg-white', sel === c.id ? 'border-brand bg-[#fff6f0]' : 'border-line', !c.visible && 'opacity-60')}>
            <div className="h-20 rounded-t-xl bg-sky bg-cover bg-center" style={c.imageUrl ? { backgroundImage: `url(${c.imageUrl})` } : undefined} />
            <div className="p-3"><div className="flex items-center justify-between gap-1"><b className="truncate text-navy">{c.name}</b><button aria-label="Editar sección" onClick={e => { e.stopPropagation(); setCatEdit(c); }} className="cursor-pointer text-slate hover:text-navy"><Icon n="edit" s={14} /></button></div><div className="text-[12.5px] text-slate">{c.products} artículos{!c.visible && ' · oculta'}</div></div></div>)}
          <button onClick={() => setCatEdit({ name: '', description: '', visible: true })} className="grid w-44 shrink-0 cursor-pointer place-items-center rounded-xl border border-dashed border-line-2 text-slate hover:border-brand hover:text-navy"><span className="flex items-center gap-1 text-[13.5px] font-semibold"><Icon n="plus" s={14} /> Nueva sección</span></button>
        </div>
      </Card>
      <Card title={`Artículos${sel === 'all' ? '' : ' · ' + (cats.find(c => c.id === sel)?.name ?? '')}`} action={<Button variant="primary" size="sm" icon="plus" onClick={() => setEdit({ ...EMPTY, categoryId: sel === 'all' ? null : sel })}>Nuevo artículo</Button>}>
        {!shown.length ? <Empty icon="box" title="Aún no hay artículos">Agrega el primero con foto, precio y existencias. Puedes arrastrarlos para ordenarlos.</Empty>
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">{shown.map((p, i) => <article key={p.id} role="listitem" {...prodDrag(i)} onClick={() => setEdit(p)} className="cursor-grab overflow-hidden rounded-xl border border-line bg-white hover:shadow-md">
            <div className="relative aspect-[4/3] bg-sky">{p.images[0]?.url ? <img src={p.images[0].url} alt={p.images[0].alt || p.name} className="h-full w-full object-cover" draggable={false} /> : <div className="grid h-full place-items-center text-slate"><Icon n="box" s={28} /></div>}
              {p.onSale && <span className="absolute left-0 top-3 bg-[#FFD43B] px-3 py-1 text-[11.5px] font-extrabold tracking-wide text-[#1b1b1b] shadow">OFERTA −{p.discountPct}%</span>}
              {p.status !== 'published' && <span className="absolute right-2 top-2"><Badge tone="Canceled">{p.status === 'draft' ? 'Borrador' : 'Archivado'}</Badge></span>}</div>
            <div className="p-3"><div className="truncate font-bold text-navy">{p.name}</div><div className="mt-0.5 flex items-baseline gap-2">{p.onSale ? <><b className="text-[18px] text-navy">{fmt(p.effectivePrice, shop.currency, shop.locale)}</b><s className="text-[12.5px] text-slate">{fmt(p.price, shop.currency, shop.locale)}</s></> : <b className="text-[18px] text-navy">{fmt(p.price, shop.currency, shop.locale)}</b>}</div>
              <div className="mt-1 text-[12.5px] text-slate">{p.sku ? `Cód. ${p.sku} · ` : ''}{p.trackStock ? <span className={p.stockLevel === 'out' ? 'font-semibold text-bad' : p.stockLevel === 'low' ? 'font-semibold text-warn' : ''}>{p.stock} en existencia</span> : 'Sin control de stock'}</div></div></article>)}</div>}
      </Card>
    </div>
    <Card title="Vista previa en vivo" action={<Button size="sm" onClick={() => setPreviewKey(k => k + 1)}>Actualizar</Button>} pad={false}>
      <iframe key={previewKey} title="Vista previa de la tienda" {...(import.meta.env.VITE_MODE !== 'connected' ? { srcDoc: storePreviewHtml() } : { src: `${BASE}/ecommerce/preview` })} className="h-[40rem] w-full rounded-b-xl border-0" />
    </Card>
    {edit && <ProductEditor shop={shop} cats={cats} initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
    {catEdit && <CategoryEditor initial={catEdit} onClose={() => setCatEdit(null)} onSaved={() => { setCatEdit(null); void load(); }} />}
    {cover && <CoverEditor shop={shop} onClose={() => setCover(false)} onSaved={s => { setShop(s); setCover(false); setPreviewKey(k => k + 1); }} />}
  </div>;
}

function ImageUploader({ images, onChange }: { images: Img[]; onChange: (i: Img[]) => void }) {
  const toast = useToast(); const [busy, setBusy] = useState(false); const from = useRef<number | null>(null);
  const add = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true); const out = [...images];
    for (const f of Array.from(files).slice(0, 12 - images.length)) { try { const r = await uploadImage(f); out.push({ mediaId: r.id, url: r.url, alt: f.name.replace(/\.[^.]+$/, '') }); } catch (e) { toast(errMsg(e), 'err'); } }
    onChange(out); setBusy(false);
  };
  return <div>
    <div className="flex flex-wrap gap-2">{images.map((im, i) => <div key={(im.mediaId ?? im.url ?? '') + i} draggable onDragStart={() => { from.current = i; }} onDragOver={e => e.preventDefault()} onDrop={() => { const f = from.current; from.current = null; if (f == null || f === i) return; const n = [...images]; const [m] = n.splice(f, 1); n.splice(i, 0, m); onChange(n); }} className="group relative h-20 w-20 cursor-grab overflow-hidden rounded-lg border border-line">
      {im.url && <img src={im.url} alt={im.alt} className="h-full w-full object-cover" draggable={false} />}{i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-navy/80 text-center text-[10px] font-bold text-white">Principal</span>}
      <button type="button" aria-label="Quitar foto" onClick={() => onChange(images.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 hidden h-5 w-5 cursor-pointer place-items-center rounded-full bg-white/90 text-[12px] group-hover:grid">×</button></div>)}
      {images.length < 12 && <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-line-2 text-slate hover:border-brand">{busy ? <Spinner /> : <Icon n="plus" s={18} />}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple className="sr-only" onChange={e => { void add(e.target.files); e.target.value = ''; }} /></label>}</div>
    <p className="mt-1 text-[12px] text-slate">Hasta 12 fotos. Arrastra para ordenar; la primera es la principal.</p></div>;
}

function ProductEditor({ shop, cats, initial, onClose, onSaved }: { shop: Settings; cats: Category[]; initial: Partial<Product>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const [p, setP] = useState<Partial<Product>>(initial); const [busy, setBusy] = useState(false); const isNew = !initial.id;
  const set = <K extends keyof Product>(k: K, v: Product[K] | null) => setP(x => ({ ...x, [k]: v }));
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const save = async () => {
    if (!p.name?.trim()) return toast('Escribe el nombre del artículo', 'err'); setBusy(true);
    const body = { name: p.name, sku: p.sku || null, description: p.description ?? '', categoryId: p.categoryId ?? null, price: p.price ?? 0, cost: p.cost ?? 0, salePrice: p.salePrice ?? null, saleStarts: p.saleStarts ? dstr(p.saleStarts) : null, saleEnds: p.saleEnds ? dstr(p.saleEnds) : null, stock: p.stock ?? 0, trackStock: p.trackStock ?? true, specs: (p.specs ?? []).filter(s => s.k.trim()), badge: p.badge || null, status: p.status ?? 'draft' };
    try {
      const saved = isNew ? await api<Product>('POST', '/ecommerce/products', body) : await api<Product>('PATCH', `/ecommerce/products/${initial.id}`, body);
      await api('PUT', `/ecommerce/products/${saved.id}/images`, { images: (p.images ?? []).map(i => ({ mediaId: i.mediaId, url: i.mediaId ? null : i.url, alt: i.alt ?? '' })) });
      toast('Artículo guardado'); onSaved();
    } catch (e) { toast(errMsg(e), 'err'); setBusy(false); }
  };
  const archive = async () => { if (!initial.id) return; try { await api('DELETE', `/ecommerce/products/${initial.id}`); toast('Artículo archivado'); onSaved(); } catch (e) { toast(errMsg(e), 'err'); } };
  const sale = p.salePrice != null && p.price != null && p.salePrice < p.price;
  return <Drawer title={isNew ? 'Nuevo artículo' : 'Editar artículo'} onClose={onClose} width="w-[560px]" footer={<div className="flex w-full items-center justify-between gap-2">{!isNew ? <Button variant="danger" onClick={archive}>Archivar</Button> : <span />}<div className="flex gap-2"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button></div></div>}>
    <Field label="Fotos"><ImageUploader images={p.images ?? []} onChange={i => set('images', i)} /></Field>
    <Field label="Nombre"><Input value={p.name ?? ''} onChange={e => set('name', e.target.value)} maxLength={160} /></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Código / SKU"><Input value={p.sku ?? ''} onChange={e => set('sku', e.target.value)} maxLength={60} /></Field>
      <Field label="Sección"><Select value={p.categoryId ?? ''} onChange={e => set('categoryId', e.target.value ? Number(e.target.value) : null)}><option value="">Sin sección</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field></div>
    <Field label="Descripción"><Textarea rows={4} value={p.description ?? ''} onChange={e => set('description', e.target.value)} maxLength={5000} /></Field>
    <div className="grid grid-cols-2 gap-3"><Field label={`Precio (${shop.currency})`}><Input type="number" min={0} step="0.01" value={p.price ?? 0} onChange={e => set('price', num(e.target.value))} /></Field>
      <Field label="Costo" hint="Solo lo ves tú. Sirve para el margen."><Input type="number" min={0} step="0.01" value={p.cost ?? 0} onChange={e => set('cost', num(e.target.value))} /></Field></div>
    <div className="mb-3 rounded-xl border border-line bg-canvas p-3"><div className="mb-2 flex items-center gap-2"><Switch on={p.salePrice != null} onChange={v => set('salePrice', v ? Math.max(0, Math.round(((p.price ?? 0) * 0.9) * 100) / 100) : null)} label="Oferta" /><b className="text-navy">Oferta</b>{sale && <span className="rounded bg-[#FFD43B] px-2 py-0.5 text-[11px] font-extrabold">OFERTA −{Math.round((1 - (p.salePrice ?? 0) / (p.price || 1)) * 100)}%</span>}</div>
      {p.salePrice != null && <div className="grid grid-cols-3 gap-3"><Field label="Precio de oferta"><Input type="number" min={0} step="0.01" value={p.salePrice} onChange={e => set('salePrice', num(e.target.value))} /></Field><Field label="Desde (opcional)"><Input type="date" value={dstr(p.saleStarts)} onChange={e => set('saleStarts', e.target.value || null)} /></Field><Field label="Hasta (opcional)"><Input type="date" value={dstr(p.saleEnds)} onChange={e => set('saleEnds', e.target.value || null)} /></Field></div>}
      {p.salePrice != null && !sale && <p className="text-[12.5px] text-bad">El precio de oferta debe ser menor que el normal.</p>}</div>
    <div className="grid grid-cols-2 gap-3"><Field label="Existencias"><Input type="number" min={0} step="1" disabled={p.trackStock === false} value={p.stock ?? 0} onChange={e => set('stock', Math.max(0, Math.floor(num(e.target.value))))} /></Field>
      <Field label="Control de stock"><div className="flex h-9 items-center gap-2"><Switch on={p.trackStock ?? true} onChange={v => set('trackStock', v)} label="Controlar existencias" /><span className="text-[13px] text-slate">{p.trackStock === false ? 'Siempre disponible' : 'Descuenta al confirmar'}</span></div></Field></div>
    <Field label="Especificaciones">
      {(p.specs ?? []).map((s, i) => <div key={i} className="mb-1.5 flex gap-2"><Input placeholder="Característica" value={s.k} onChange={e => set('specs', (p.specs ?? []).map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} /><Input placeholder="Valor" value={s.v} onChange={e => set('specs', (p.specs ?? []).map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} /><button type="button" aria-label="Quitar" onClick={() => set('specs', (p.specs ?? []).filter((_, j) => j !== i))} className="cursor-pointer px-2 text-slate hover:text-bad">×</button></div>)}
      <Button size="sm" onClick={() => set('specs', [...(p.specs ?? []), { k: '', v: '' }])}>+ Agregar especificación</Button></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Etiqueta (opcional)" hint="Ej. «Nuevo». La franja OFERTA es automática."><Input value={p.badge ?? ''} onChange={e => set('badge', e.target.value)} maxLength={24} /></Field>
      <Field label="Estado"><Select value={p.status ?? 'draft'} onChange={e => set('status', e.target.value as Product['status'])}><option value="draft">Borrador (no se ve)</option><option value="published">Publicado</option></Select></Field></div>
  </Drawer>;
}

function CategoryEditor({ initial, onClose, onSaved }: { initial: Partial<Category>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast(); const [c, setC] = useState<Partial<Category>>(initial); const [busy, setBusy] = useState(false); const isNew = !initial.id;
  const up = async (f: FileList | null) => { if (!f?.[0]) return; try { const r = await uploadImage(f[0]); setC(x => ({ ...x, mediaId: r.id, imageUrl: r.url })); } catch (e) { toast(errMsg(e), 'err'); } };
  const save = async () => { if (!c.name?.trim()) return toast('Escribe el nombre de la sección', 'err'); setBusy(true); const body = { name: c.name, description: c.description ?? '', mediaId: c.mediaId ?? null, imageUrl: c.mediaId ? null : c.imageUrl ?? null, visible: c.visible ?? true };
    try { if (isNew) await api('POST', '/ecommerce/categories', body); else await api('PATCH', `/ecommerce/categories/${initial.id}`, body); onSaved(); } catch (e) { toast(errMsg(e), 'err'); setBusy(false); } };
  const del = async () => { try { await api('DELETE', `/ecommerce/categories/${initial.id}`); onSaved(); } catch (e) { toast(errMsg(e), 'err'); } };
  return <Drawer title={isNew ? 'Nueva sección' : 'Editar sección'} onClose={onClose} footer={<div className="flex w-full items-center justify-between">{!isNew ? <Button variant="danger" onClick={del}>Eliminar</Button> : <span />}<div className="flex gap-2"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} disabled={busy}>Guardar</Button></div></div>}>
    <Field label="Nombre"><Input value={c.name ?? ''} onChange={e => setC({ ...c, name: e.target.value })} maxLength={80} /></Field>
    <Field label="Descripción (opcional)"><Textarea rows={2} value={c.description ?? ''} onChange={e => setC({ ...c, description: e.target.value })} maxLength={300} /></Field>
    <Field label="Imagen de la tarjeta">{c.imageUrl && <img src={c.imageUrl} alt="" className="mb-2 h-24 w-40 rounded-lg object-cover" />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void up(e.target.files)} /></Field>
    <Field label="Visible en la tienda"><Switch on={c.visible ?? true} onChange={v => setC({ ...c, visible: v })} label="Visible" /></Field>
    {!isNew && <p className="text-[12.5px] text-slate">Al eliminarla, sus artículos quedan «sin sección».</p>}
  </Drawer>;
}

function CoverEditor({ shop, onClose, onSaved }: { shop: Settings; onClose: () => void; onSaved: (s: Settings) => void }) {
  const toast = useToast(); const [f, setF] = useState({ name: shop.name, tagline: shop.tagline, title: shop.cover.title ?? '', subtitle: shop.cover.subtitle ?? '', imageMediaId: shop.cover.imageMediaId ?? null, imageUrl: shop.cover.imageUrl ?? null, accent: shop.theme.accent ?? '#E8590C', ribbon: shop.theme.ribbon ?? '#FFD43B', currency: shop.currency, whatsapp: shop.whatsapp_number ?? '', email: shop.order_email ?? '', low: shop.low_stock, slug: shop.slug }); const [busy, setBusy] = useState(false);
  const up = async (fl: FileList | null) => { if (!fl?.[0]) return; try { const r = await uploadImage(fl[0]); setF(x => ({ ...x, imageMediaId: r.id, imageUrl: r.url })); } catch (e) { toast(errMsg(e), 'err'); } };
  const save = async () => { setBusy(true); try { onSaved(await api<Settings>('PUT', '/ecommerce/settings', { name: f.name, tagline: f.tagline, slug: f.slug, currency: f.currency, whatsapp_number: f.whatsapp.trim() || null, order_email: f.email.trim() || null, low_stock: f.low, theme: { accent: f.accent, ribbon: f.ribbon }, cover: { title: f.title, subtitle: f.subtitle, imageMediaId: f.imageMediaId, imageUrl: f.imageMediaId ? null : f.imageUrl } })); toast('Datos guardados'); } catch (e) { toast(errMsg(e), 'err'); setBusy(false); } };
  return <Drawer title="Portada y datos de la tienda" onClose={onClose} footer={<div className="flex w-full justify-end gap-2"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} disabled={busy}>Guardar</Button></div>}>
    <Field label="Nombre de la tienda"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={80} /></Field>
    <Field label="Frase corta"><Input value={f.tagline} onChange={e => setF({ ...f, tagline: e.target.value })} maxLength={200} /></Field>
    <Field label="Título de la portada"><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} maxLength={120} /></Field>
    <Field label="Subtítulo de la portada"><Input value={f.subtitle} onChange={e => setF({ ...f, subtitle: e.target.value })} maxLength={240} /></Field>
    <Field label="Imagen de fondo de la portada">{f.imageUrl && <img src={f.imageUrl} alt="" className="mb-2 h-24 w-44 rounded-lg object-cover" />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void up(e.target.files)} /></Field>
    <div className="grid grid-cols-2 gap-3"><Field label="Color principal"><input type="color" value={f.accent} onChange={e => setF({ ...f, accent: e.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-line-2" /></Field><Field label="Color de la franja de oferta"><input type="color" value={f.ribbon} onChange={e => setF({ ...f, ribbon: e.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-line-2" /></Field></div>
    <div className="grid grid-cols-2 gap-3"><Field label="Moneda (ISO)"><Input value={f.currency} onChange={e => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} /></Field><Field label="Alerta de stock bajo (≤)"><Input type="number" min={0} value={f.low} onChange={e => setF({ ...f, low: Number(e.target.value) })} /></Field></div>
    <Field label="WhatsApp para pedidos" hint="Con código de país, solo números. Ej. 17865551234"><Input value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} /></Field>
    <Field label="Correo para avisos de pedidos nuevos"><Input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
    <Field label="Identificador de la tienda (en la dirección pública)"><Input value={f.slug} onChange={e => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></Field>
  </Drawer>;
}
