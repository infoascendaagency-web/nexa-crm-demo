// Capa de acceso a datos. Hoy lee del almacén local (db.ts); al conectar el backend se cambia la implementación
// manteniendo estas firmas (hooks que devuelven datos + acciones).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as be from './backend';
import * as db from './db';
import type { FilterGroup, ObjKey, Rec, SearchReq } from './types';

export const useVersion = () => useSyncExternalStore(db.subscribe, db.getVersion);
const NONE = { total: 0, results: [] as Rec[] };
export function useSearch(obj: ObjKey, req: SearchReq) {
  const v = useVersion(); const key = JSON.stringify(req); const remote = db.CONNECTED && be.isRemote(obj); const [rem, setRem] = useState<{ total: number; results: Rec[]; paging?: { next?: { after: number } } } | null>(null);
  const local = useMemo(() => (remote ? NONE : db.search(obj, req)), [v, obj, key, remote]); // eslint-disable-line
  useEffect(() => { if (!remote) return; let alive = true; be.remoteSearch(obj, req).then(r => alive && setRem(r)).catch(() => {}); return () => { alive = false; }; }, [remote, obj, key, v]); // eslint-disable-line
  return remote ? (rem ?? NONE) : local;
}
export function useCount(obj: ObjKey, groups: FilterGroup[]) {
  const v = useVersion(); const key = JSON.stringify(groups); const remote = db.CONNECTED && be.isRemote(obj); const [n, setN] = useState(0);
  useEffect(() => { if (!remote) return; let alive = true; be.remoteSearch(obj, { filterGroups: groups, limit: 1 }).then(r => alive && setN(r.total)).catch(() => {}); return () => { alive = false; }; }, [remote, obj, key, v]); // eslint-disable-line
  const local = useMemo(() => (remote ? 0 : db.search(obj, { filterGroups: groups, limit: 1 }).total), [v, obj, key, remote]); // eslint-disable-line
  return remote ? n : local;
}
export function useRecord(obj: ObjKey, id: string | undefined) { const v = useVersion(); useEffect(() => { if (id && db.CONNECTED) be.pullAround(obj, id); }, [obj, id]); return useMemo(() => (id ? db.getRecord(obj, id) : null), [v, obj, id]); }
export function useAssoc(obj: ObjKey, id: string | undefined, to: ObjKey): Rec[] { const v = useVersion(); return useMemo(() => (id ? db.associated(obj, id, to) : []), [v, obj, id, to]); }
export function useDbValue<T>(fn: () => T, deps: unknown[] = []): T { const v = useVersion(); return useMemo(fn, [v, ...deps]); } // eslint-disable-line
export const crm = {
  create: db.createRecord, createAsync: db.createRecordAsync, update: db.updateRecord, remove: db.deleteRecords, associate: db.associate, unassociate: db.removeAssoc,
  nameOf: db.nameOf, get: db.getRecord, search: db.search, associated: db.associated, firstAssoc: db.firstAssoc,
};
export * as store from './db';
