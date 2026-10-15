// Motor de búsqueda con la semántica del endpoint /search de Nexa (filterGroups: OR entre grupos, AND dentro).
import type { Filter, FilterGroup, Page, Rec, SearchReq, Sort } from './types';

const SPECIAL: Record<string, (r: Rec) => string | null> = {
  hs_object_id: r => r.id,
  createdate: r => r.createdAt, hs_createdate: r => r.createdAt,
  lastmodifieddate: r => r.updatedAt, hs_lastmodifieddate: r => r.updatedAt,
};
export const getVal = (r: Rec, prop: string): string | null => (SPECIAL[prop] ? SPECIAL[prop](r) : r.properties[prop] ?? null);

const num = (s: string | null | undefined) => (s != null && s !== '' && !isNaN(Number(s)) ? Number(s) : null);
const dt = (s: string | null | undefined) => { if (!s) return null; const t = /^\d{4}-\d\d-\d\d/.test(s) ? Date.parse(s) : NaN; return isNaN(t) ? null : t; };
// Compara como número, fecha o texto (en minúsculas) según lo que sea el valor.
function cmp(a: string | null, b: string | null): number {
  const na = num(a), nb = num(b); if (na != null && nb != null) return na - nb;
  const da = dt(a), db = dt(b); if (da != null && db != null) return da - db;
  return (a ?? '').toLowerCase().localeCompare((b ?? '').toLowerCase());
}
const empty = (v: string | null) => v == null || v === '';
const tokens = (s: string) => s.toLowerCase().split(/[\s,;|]+/).filter(Boolean);
const multi = (v: string | null) => (v ?? '').split(';').map(x => x.trim().toLowerCase()).filter(Boolean);

export function matchFilter(r: Rec, f: Filter): boolean {
  const v = getVal(r, f.propertyName);
  switch (f.operator) {
    case 'HAS_PROPERTY': return !empty(v);
    case 'NOT_HAS_PROPERTY': return empty(v);
    case 'EQ': return !empty(v) && (multi(v).length > 1 ? multi(v).includes((f.value ?? '').toLowerCase()) : cmp(v, f.value ?? '') === 0);
    case 'NEQ': return empty(v) || cmp(v, f.value ?? '') !== 0;
    case 'IN': return !empty(v) && (f.values ?? []).some(x => multi(v).includes(x.toLowerCase()) || cmp(v, x) === 0);
    case 'NOT_IN': return empty(v) || !(f.values ?? []).some(x => multi(v).includes(x.toLowerCase()) || cmp(v, x) === 0);
    case 'GT': return !empty(v) && cmp(v, f.value ?? '') > 0;
    case 'GTE': return !empty(v) && cmp(v, f.value ?? '') >= 0;
    case 'LT': return !empty(v) && cmp(v, f.value ?? '') < 0;
    case 'LTE': return !empty(v) && cmp(v, f.value ?? '') <= 0;
    case 'BETWEEN': return !empty(v) && cmp(v, f.value ?? '') >= 0 && cmp(v, f.highValue ?? '') <= 0;
    case 'CONTAINS_TOKEN': { const want = tokens(f.value ?? ''); const have = (v ?? '').toLowerCase(); return want.length > 0 && want.every(t => have.includes(t.replace(/\*/g, ''))); }
    case 'NOT_CONTAINS_TOKEN': { const want = tokens(f.value ?? ''); const have = (v ?? '').toLowerCase(); return !want.some(t => have.includes(t.replace(/\*/g, ''))); }
  }
}
export const matchGroups = (r: Rec, groups?: FilterGroup[]) => !groups || groups.length === 0 || groups.some(g => g.filters.every(f => matchFilter(r, f)));

const textOf = (r: Rec) => Object.values(r.properties).filter(Boolean).join(' ').toLowerCase();

export function runSearch(all: Rec[], req: SearchReq, searchProps?: string[]): Page<Rec> {
  let rows = all.filter(r => !r.archived && matchGroups(r, req.filterGroups));
  if (req.query && req.query.trim()) {
    const q = req.query.trim().toLowerCase();
    rows = rows.filter(r => (searchProps ? searchProps.map(p => r.properties[p] ?? '').join(' ').toLowerCase() : textOf(r)).includes(q));
  }
  const sorts: Sort[] = req.sorts?.length ? req.sorts : [{ propertyName: 'createdate', direction: 'DESCENDING' }];
  rows = [...rows].sort((a, b) => { for (const s of sorts) { const c = cmp(getVal(a, s.propertyName), getVal(b, s.propertyName)); if (c) return s.direction === 'ASCENDING' ? c : -c; } return 0; });
  const limit = req.limit ?? 100, after = req.after ?? 0;
  const results = rows.slice(after, after + limit);
  return { total: rows.length, results, paging: after + limit < rows.length ? { next: { after: after + limit } } : undefined };
}
