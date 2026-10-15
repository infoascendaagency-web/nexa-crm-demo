// Formato de fechas/duraciones al estilo de Nexa en español. Zona del portal: America/New_York (GMT-4/-5).
const TZ = 'America/New_York';
const MONTHS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];
function parts(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'shortOffset' }).formatToParts(d);
  const o: Record<string, string> = {}; f.forEach(p => { o[p.type] = p.value; });
  return { y: +o.year, m: +o.month, d: +o.day, time: `${o.hour}:${o.minute} ${o.dayPeriod}`, tz: o.timeZoneName };
}
const dayKey = (p: { y: number; m: number; d: number }) => Date.UTC(p.y, p.m - 1, p.d) / 86400000;
export function fmtDateTime(iso: string | null | undefined, opts: { rel?: boolean; tz?: boolean } = { rel: true, tz: true }): string {
  if (!iso) return '--'; const d = new Date(/^\d+$/.test(iso) ? Number(iso) : iso); if (isNaN(d.getTime())) return iso;
  const p = parts(d), n = parts(new Date()); const diff = dayKey(p) - dayKey(n); const tz = opts.tz === false ? '' : ` ${p.tz}`;
  if (opts.rel !== false) { if (diff === 0) return `Hoy a la(s) ${p.time}${tz}`; if (diff === -1) return `Ayer a la(s) ${p.time}${tz}`; if (diff === 1) return `Mañana a las ${p.time}${tz}`; }
  return `${p.d} de ${MONTHS[p.m - 1]} de ${p.y} ${p.time}${tz}`;
}
export const fmtDate = (iso: string | null | undefined) => { if (!iso) return '--'; const d = new Date(iso); if (isNaN(d.getTime())) return iso; const p = parts(d); return `${p.d} de ${MONTHS[p.m - 1]} de ${p.y}`; };
export const fmtMoney = (v: string | null | undefined) => (v == null || v === '' ? '--' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v)));
export function fmtDuration(ms: string | null | undefined) { const n = Number(ms); if (!n) return '--'; const s = Math.round(n / 1000); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; }
export const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || '?';
export const toLocalInput = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(d.getTime())) return ''; const o = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return o.toISOString().slice(0, 16); };
export function relTime(iso: string) { const s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'hace unos segundos'; if (s < 3600) return `hace ${Math.floor(s / 60)} min`; if (s < 86400) return `hace ${Math.floor(s / 3600)} h`; return `hace ${Math.floor(s / 86400)} d`; }
