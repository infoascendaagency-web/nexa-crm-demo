// Marca configurable (paquete de venta). Por defecto = Nexa (el CRM de Nexa se ve exactamente igual que siempre).
// Un cliente nuevo define `window.__BRAND__` en /brand.js (generado desde su brand.json; ver paquete-venta/docs/02-personalizacion-marca.md):
//   { name, company, headline, blurb, logo, colors: { rail, navy, brand, teal, link, ... } }  — los colores sobreescriben los tokens `--color-*` del tema.
type Raw = { name?: string; company?: string; headline?: string; blurb?: string; logo?: string; colors?: Record<string, string> };
const w: Raw = (typeof window !== 'undefined' ? (window as unknown as { __BRAND__?: Raw }).__BRAND__ : undefined) ?? {};
const name = w.name ?? 'Nexa CRM';
const words = name.trim().split(/\s+/);
export const BRAND = {
  name,
  /** Nombre partido para el logotipo de dos tonos: «HomePro» + «CRM» (todo menos la última palabra, y la última). */
  first: words.length > 1 ? words.slice(0, -1).join(' ') : '',
  last: words[words.length - 1] ?? name,
  company: w.company ?? 'Nexa Home',
  headline: w.headline ?? 'Cada lead, a la persona correcta, a tiempo.',
  blurb: w.blurb ?? 'Contactos, citas, tareas, tienda y redes sociales de tu equipo en un solo lugar. Demo interactiva con datos ficticios.',
  logo: w.logo ?? `${import.meta.env.BASE_URL}logo-mark.png`,
};
if (typeof document !== 'undefined') {
  for (const [k, v] of Object.entries(w.colors ?? {})) if (/^[a-z0-9-]+$/i.test(k) && /^#[0-9a-f]{3,8}$/i.test(v)) document.documentElement.style.setProperty(`--color-${k}`, v);
  if (w.name) document.title = w.name;
}
