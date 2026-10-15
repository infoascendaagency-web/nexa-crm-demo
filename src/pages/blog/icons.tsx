// Iconos propios del editor de blog (los comunes salen de components/Icon). Trazos de 24x24, mismo estilo.
import Icon from '../../components/Icon';
const P: Record<string, string> = {
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z', italic: 'M10 5h8M6 19h8M14 5l-4 14',
  heading: 'M5 5v14M5 12h10M15 5v14', para: 'M6 6h12M6 11h12M6 16h8', ol: 'M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M4 11.5c1-.8 2.2-.3 2 .8L4 15h2.5M4 17.5h2.2l-1 1.2c1 0 1.5.8 1 1.6-.6.7-1.7.5-2.2 0',
  ul: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01', quote: 'M5 17v-5a4 4 0 0 1 4-4M12 17v-5a4 4 0 0 1 4-4M5 17h4v-4M12 17h4v-4', image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  callout: 'M4 5h16v11H9l-5 4zM12 8.5v3M12 14h.01', cta: 'M4 8h16v8H4zM8 12h8', divider: 'M4 12h16M8 7h.01M12 7h.01M16 7h.01M8 17h.01M12 17h.01M16 17h.01', video: 'M4 6h16v12H4zM10.5 9.5v5l4.5-2.5z',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14', faq: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 16.5h.01',
  history: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M12 8v4.5l3 1.5', desktop: 'M3 5h18v11H3zM8 20h8M12 16v4', mobile: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  template: 'M4 4h16v5H4zM4 13h7v7H4zM15 13h5v7h-5z', outline: 'M5 6h14M9 12h10M13 18h6M5 12h.01M9 18h.01', seo: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8.5 11l2 2 3.5-4', settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 7a2 2 0 1 0 0 .01M8 17a2 2 0 1 0 0 .01',
  upload: 'M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14', plusc: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', dup: 'M8 8h11v11H8zM5 16V5h11', check: 'M5 12.5l4.5 4.5L19 7', alert: 'M12 4l9.5 16h-19zM12 10v4.5M12 17h.01',
  external: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5', eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
};
export function BIcon({ n, s = 18, className = '' }: { n: string; s?: number; className?: string }) {
  if (!P[n]) return <Icon n={n} s={s} className={className} />;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={P[n]} /></svg>;
}
