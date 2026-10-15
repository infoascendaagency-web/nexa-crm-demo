// Tipos y utilidades compartidas del módulo E-commerce.
import { BASE } from '../../lib/backend';
import { mockMedia } from '../../lib/mock-api';

export type Settings = {
  slug: string; name: string; tagline: string; currency: string; locale: string; whatsapp_number: string | null; order_email: string | null; low_stock: number; published: boolean;
  theme: { accent?: string; ribbon?: string }; cover: { title?: string; subtitle?: string; imageMediaId?: string | null; imageUrl?: string | null };
  publish: { siteUrl?: string; mode?: 'route' | 'subdomain' | 'embed'; subdomain?: string; path?: string; provider?: 'aws' | 'cloudflare' | 'server' };
  allowed_origins: string[]; publicPageUrl: string;
};
export type Category = { id: number; name: string; slug: string; description: string; mediaId: string | null; imageUrl: string | null; position: number; visible: boolean; products: number };
export type Img = { id?: number; mediaId: string | null; url: string | null; alt: string };
export type Product = {
  id: number; sku: string | null; name: string; description: string; categoryId: number | null; price: number; cost: number; salePrice: number | null; saleStarts: string | null; saleEnds: string | null;
  stock: number; trackStock: boolean; specs: { k: string; v: string }[]; badge: string | null; status: 'draft' | 'published' | 'archived'; position: number;
  onSale: boolean; effectivePrice: number; discountPct: number; stockLevel: 'ok' | 'low' | 'out'; margin: number; images: Img[];
};
export const fmt = (n: number | null | undefined, cur = 'USD', loc = 'es') => { try { return new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).format(n ?? 0); } catch { return `${(n ?? 0).toFixed(2)} ${cur}`; } };
export const pct = (n: number | null | undefined) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n}%`);
export const dstr = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : '');
export const errMsg = (e: unknown) => { const c = (e as { code?: string })?.code ?? ''; const M: Record<string, string> = { sku_taken: 'Ese código (SKU) ya existe.', sale_price_must_be_lower: 'El precio de oferta debe ser menor que el normal.', sale_dates_invalid: 'La fecha de fin de la oferta es anterior a la de inicio.', slug_taken: 'Ese nombre de tienda ya está en uso.', insufficient_stock: 'No hay existencias suficientes.', invalid_qty: 'Cantidad no válida.', product_has_orders: 'Tiene pedidos: se puede archivar, no borrar.', image_type_not_allowed: 'Solo imágenes JPG, PNG, WebP, GIF o AVIF.', file_too_large: 'La imagen es demasiado pesada.', site_url_invalid: 'La URL del sitio no es válida (ej. midominio.com).', site_url_required: 'Escribe la URL de tu sitio.', path_invalid: 'La ruta no es válida (ej. /tienda).', subdomain_invalid: 'El subdominio no es válido (ej. tienda).', order_cancelled: 'El pedido está cancelado.', invalid_whatsapp_number: 'Número de WhatsApp no válido.', forbidden: 'No tienes permiso.' }; return M[c] || 'No se pudo completar la acción'; };

/** Sube una imagen: la reduce a ≤1600 px en el navegador y la manda al servidor (almacenamiento en la base o en S3 según el servidor). Devuelve el id y la URL. */
export async function uploadImage(file: File): Promise<{ id: string; url: string }> {
  const blob = await shrink(file);
  if (import.meta.env.VITE_MODE !== 'connected') return mockMedia(blob);   // demo: la imagen queda como data-URL en el navegador
  const r = await fetch(`${BASE}/ecommerce/media?name=${encodeURIComponent(file.name.slice(0, 100))}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j?.error ?? 'upload_failed') as Error & { code?: string }; e.code = j?.error; throw e; }
  return j;
}
async function shrink(file: File, max = 1600): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); if (k === 1 && file.size < 900_000) return file;
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>(res => c.toBlob(b => res(b ?? file), 'image/webp', 0.85));
}
