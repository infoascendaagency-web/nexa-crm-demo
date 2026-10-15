// Utilidades del espacio de tareas. Todos los días/horas se calculan en la zona del portal (America/New_York),
// la misma con la que `fmt.ts` muestra las fechas, para que "Hoy", "Vencidas" y el calendario coincidan con lo que se ve.
import { crm, store } from '../../lib/api';
import type { ObjKey, Rec } from '../../lib/types';

export const TZ = 'America/New_York';
export const STATUS_LABEL: Record<string, string> = { NOT_STARTED: 'No iniciada', IN_PROGRESS: 'En curso', WAITING: 'En espera', DEFERRED: 'Aplazada', COMPLETED: 'Completada' };
export const PRIO_LABEL: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja', NONE: 'Sin prioridad' };
export const TYPE_LABEL: Record<string, string> = { TODO: 'Por hacer', CALL: 'Llamada', EMAIL: 'Correo' };
export const PRIO_ORDER = ['HIGH', 'MEDIUM', 'LOW', 'NONE'];
export const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DOW_ES = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/* ---------- zona horaria ---------- */
type P = { y: number; m: number; d: number; h: number; mi: number };
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
export function partsOf(ms: number): P {
  const o: Record<string, number> = {}; for (const p of fmt.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = +p.value;
  return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute };
}
/** Instante (ms) de una fecha-hora de pared en la zona del portal. */
export function fromParts(y: number, m: number, d: number, h = 0, mi = 0): number {
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 2; i++) { const p = partsOf(guess); const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi); guess += Date.UTC(y, m - 1, d, h, mi) - shown; }
  return guess;
}
export const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (ms: number) => { const p = partsOf(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const keyParts = (k: string) => { const [y, m, d] = k.split('-').map(Number); return { y, m, d }; };
export const keyToMs = (k: string, h = 0, mi = 0) => { const { y, m, d } = keyParts(k); return fromParts(y, m, d, h, mi); };
export const addDaysKey = (k: string, n: number) => { const { y, m, d } = keyParts(k); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
/** 0 = lunes … 6 = domingo */
export const dowOfKey = (k: string) => { const { y, m, d } = keyParts(k); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; };
export const startOfDay = (ms: number) => keyToMs(dayKey(ms));
export const endOfDay = (ms: number) => keyToMs(addDaysKey(dayKey(ms), 1)) - 1;
export const startOfWeekKey = (k: string) => addDaysKey(k, -dowOfKey(k));
export const monthKeyStart = (k: string) => `${k.slice(0, 7)}-01`;
export const keyLabel = (k: string) => { const { y, m, d } = keyParts(k); return `${DOW_ES[dowOfKey(k)]} ${d} de ${MONTHS_ES[m - 1]}${y !== partsOf(Date.now()).y ? ` de ${y}` : ''}`; };
export const timeLabel = (ms: number) => { const p = partsOf(ms); const h12 = p.h % 12 === 0 ? 12 : p.h % 12; return `${h12}:${pad(p.mi)} ${p.h < 12 ? 'a. m.' : 'p. m.'}`; };
/** Valor para <input type="datetime-local"> en hora del portal. */
export const toInput = (ms: number | null) => { if (ms == null) return ''; const p = partsOf(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`; };
export const fromInput = (v: string): number | null => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v); return m ? fromParts(+m[1], +m[2], +m[3], +m[4], +m[5]) : null; };

/* ---------- tareas ---------- */
export const dueOf = (t: Rec): number | null => { const v = t.properties.hs_timestamp; if (!v) return null; const n = /^\d{9,}$/.test(v) ? Number(v) : Date.parse(v); return Number.isFinite(n) ? n : null; };
export const isDone = (t: Rec) => t.properties.hs_task_status === 'COMPLETED';
export const isAuto = (t: Rec) => !!t.properties.hs_task_subject?.startsWith('[Nexa AUTO]');
export type Bucket = 'overdue' | 'today' | 'upcoming' | 'nodate' | 'done';
export const BUCKETS: { id: Bucket; label: string }[] = [{ id: 'overdue', label: 'Vencidas' }, { id: 'today', label: 'Hoy' }, { id: 'upcoming', label: 'Próximas' }, { id: 'nodate', label: 'Sin fecha' }, { id: 'done', label: 'Completadas' }];
export function bucketOf(t: Rec, now: number): Bucket {
  if (isDone(t)) return 'done'; const d = dueOf(t); if (d == null) return 'nodate';
  if (d < now) return 'overdue'; return d <= endOfDay(now) ? 'today' : 'upcoming';
}
export const sortByDue = (a: Rec, b: Rec) => (dueOf(a) ?? Infinity) - (dueOf(b) ?? Infinity);
/** Vencimiento al pasar a otro día conservando la hora (o 9:00 si no tenía). */
export function moveToDay(t: Rec, key: string): number {
  const d = dueOf(t); const p = d != null ? partsOf(d) : { h: 9, mi: 0 }; return keyToMs(key, p.h, p.mi);
}
export function snoozeTarget(t: Rec, kind: 'today' | 'tomorrow' | 'plus3', now = Date.now()): number {
  const d = dueOf(t); const p = d != null ? partsOf(d) : { h: 9, mi: 0 }; const today = dayKey(now);
  if (kind === 'today') { const target = keyToMs(today, p.h, p.mi); return target > now ? target : now + 3600e3; }
  return keyToMs(addDaysKey(today, kind === 'tomorrow' ? 1 : 3), p.h, p.mi);
}
export const relDue = (ms: number | null, now = Date.now()): string => {
  if (ms == null) return 'Sin fecha'; const dk = dayKey(ms), tk = dayKey(now);
  if (dk === tk) return `Hoy · ${timeLabel(ms)}`; if (dk === addDaysKey(tk, 1)) return `Mañana · ${timeLabel(ms)}`; if (dk === addDaysKey(tk, -1)) return `Ayer · ${timeLabel(ms)}`;
  const { d, m } = keyParts(dk); return `${d} ${MONTHS_ES[m - 1].slice(0, 3)}. · ${timeLabel(ms)}`;
};
export const daysLate = (ms: number, now = Date.now()) => Math.max(0, Math.round((startOfDay(now) - startOfDay(ms)) / 86400000));

/* ---------- registro asociado (contacto, cita, negocio, empresa) ---------- */
export type Target = { kind: ObjKey; rec: Rec; name: string; path: string };
const KINDS: ObjKey[] = ['contacts', 'appointments', 'deals', 'companies'];
/** Mapa tarea → primer registro asociado. Una sola pasada por las asociaciones (no una búsqueda por fila). */
export function buildTargets(): Map<string, Target> {
  const st = store.state(); const out = new Map<string, Target>();
  const recs: Partial<Record<ObjKey, Map<string, Rec>>> = {};
  for (const k of KINDS) recs[k] = new Map(st.records[k].filter(r => !r.archived).map(r => [r.id, r]));
  const best = new Map<string, number>();
  for (const a of st.assoc) {
    if (a.from !== 'tasks') continue; const rank = KINDS.indexOf(a.to); if (rank < 0) continue;
    if ((best.get(a.fromId) ?? 99) <= rank) continue; const rec = recs[a.to]?.get(a.toId); if (!rec) continue;
    best.set(a.fromId, rank); out.set(a.fromId, { kind: a.to, rec, name: crm.nameOf(rec, a.to), path: `/${a.to}/${rec.id}` });
  }
  return out;
}
export const KIND_LABEL: Partial<Record<ObjKey, string>> = { contacts: 'contacto', appointments: 'cita', deals: 'negocio', companies: 'empresa' };
