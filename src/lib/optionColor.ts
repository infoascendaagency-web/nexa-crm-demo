// Colores de etiquetas de opciones (como las de Nexa): paleta fija + hex personalizado.
// El color guardado es el "base" (#RRGGBB); el fondo de la píldora es un tinte claro y el texto se oscurece hasta cumplir contraste AA (≥4,5:1).
export const PALETTE: { id: string; name: string; hex: string }[] = [
  { id: 'gris', name: 'Gris', hex: '#64748B' }, { id: 'azul', name: 'Azul', hex: '#2F6FE4' }, { id: 'celeste', name: 'Celeste', hex: '#0E8FB3' },
  { id: 'turquesa', name: 'Turquesa', hex: '#0F9488' }, { id: 'verde', name: 'Verde', hex: '#2E9E4F' }, { id: 'lima', name: 'Lima', hex: '#7A9A12' },
  { id: 'amarillo', name: 'Amarillo', hex: '#C99700' }, { id: 'naranja', name: 'Naranja', hex: '#E8710A' }, { id: 'rojo', name: 'Rojo', hex: '#D93636' },
  { id: 'rosa', name: 'Rosa', hex: '#D6366F' }, { id: 'purpura', name: 'Púrpura', hex: '#8B4FD8' }, { id: 'indigo', name: 'Índigo', hex: '#4B4FD0' },
];
export const HEX = /^#[0-9a-fA-F]{6}$/;
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c: number[]) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
const lum = (h: string) => { const [r, g, b] = rgb(h).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const cache = new Map<string, PillColors>();
export type PillColors = { bg: string; fg: string; border: string; dot: string };
/** Colores de la píldora para un color base. Sin color = blanco con borde neutro. */
export function pillColors(color?: string | null): PillColors | null {
  if (!color || !HEX.test(color)) return null;
  const k = color.toLowerCase(); const hit = cache.get(k); if (hit) return hit;
  const bg = mix(k, '#FFFFFF', 0.86); let fg = k; for (let i = 0; i < 24 && contrast(fg, bg) < 4.6; i++) fg = mix(fg, '#071B33', 0.12);
  const out = { bg, fg, border: mix(k, '#FFFFFF', 0.55), dot: k }; cache.set(k, out); return out;
}
export const colorName = (hex?: string | null) => (hex ? PALETTE.find(p => p.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex.toUpperCase() : 'Sin color');
