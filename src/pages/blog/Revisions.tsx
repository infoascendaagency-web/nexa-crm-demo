// Historial de versiones: ver, previsualizar y restaurar.
import { useEffect, useState } from 'react';
import { Button, Drawer, Modal, Skeleton, cx, useToast } from '../../components/ui';
import { fmtDateTime } from '../../lib/fmt';
import { ArticleView } from './ArticleView';
import { blogApi, errMsg, type Revision } from './blogApi';
import type { PostDoc, PostFull } from './types';

const REASON: Record<string, string> = { save: 'Guardado', publish: 'Publicado / actualizado', restore: 'Versión restaurada', before_restore: 'Antes de restaurar', before_edit: 'Antes de editar' };
const ST: Record<string, string> = { draft: 'Borrador', scheduled: 'Programado', published: 'Publicado' };

export default function Revisions({ id, onClose, onRestored }: { id: string; onClose: () => void; onRestored: (p: PostFull) => void }) {
  const toast = useToast(); const [list, setList] = useState<Revision[] | null>(null); const [max, setMax] = useState(50); const [sel, setSel] = useState<number | null>(null); const [doc, setDoc] = useState<(PostDoc & { id: number }) | null>(null); const [prev, setPrev] = useState(false); const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { let on = true; blogApi.revisions(id).then(r => { if (on) { setList(r.results); setMax(r.max); } }).catch(e => on && setErr(errMsg(e))); return () => { on = false; }; }, [id]);
  useEffect(() => { setDoc(null); if (sel == null) return; let on = true; blogApi.revision(id, sel).then(d => on && setDoc(d)).catch(e => on && toast(errMsg(e), 'err')); return () => { on = false; }; }, [id, sel]); // eslint-disable-line
  const restore = async () => { if (sel == null) return; setBusy(true); try { const p = await blogApi.restore(id, sel); toast('Versión restaurada'); onRestored(p); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); setConfirm(false); } };
  const heads = doc?.blocks.filter(b => b.type === 'heading') ?? [];
  return <Drawer title="Historial de versiones" onClose={onClose} width="w-[480px]">
    <p className="mb-3 text-[13px] text-slate">Cada vez que guardas o publicas se guarda una versión (se conservan las últimas {max}). Restaurar no borra nada: la versión actual también queda en el historial.</p>
    {err && <p role="alert" className="text-bad">{err}</p>}
    {!list && !err && <div className="space-y-2">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>}
    {list && list.length === 0 && <p className="rounded-lg bg-canvas px-3 py-6 text-center text-[13.5px] text-slate">Aún no hay versiones. Aparecerán cuando guardes el artículo.</p>}
    <ul className="space-y-1.5">{list?.map((r, i) => <li key={r.id} className={cx('rounded-lg border', sel === r.id ? 'border-navy bg-sky/40' : 'border-line bg-white')}>
      <button type="button" aria-expanded={sel === r.id} onClick={() => setSel(sel === r.id ? null : r.id)} className="flex w-full cursor-pointer items-start justify-between gap-3 px-3 py-2.5 text-left">
        <span className="min-w-0"><span className="block truncate text-[13.5px] font-semibold text-navy">{r.title}</span><span className="block text-[12px] text-slate">{fmtDateTime(r.at)} · {r.by || 'Sistema'}</span></span>
        <span className="shrink-0 text-right text-[11.5px] text-mute">{i === 0 && <span className="mb-0.5 block rounded bg-[#E6F4EC] px-1.5 font-semibold text-[#00704A]">Actual</span>}{REASON[r.reason] ?? r.reason}<br />{ST[r.status]} · {r.words} pal.</span></button>
      {sel === r.id && <div className="border-t border-line px-3 py-3">
        {!doc ? <Skeleton className="h-16 w-full" /> : <>
          <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-mute">Esquema de esta versión</p>
          {heads.length === 0 ? <p className="text-[12.5px] text-slate">Sin encabezados.</p> : <ul className="mb-3 space-y-0.5 text-[12.5px]">{heads.map((h, k) => h.type === 'heading' && <li key={k} className={cx('truncate', h.level === 3 && 'pl-3', h.level === 4 && 'pl-6')}><span className="mr-1.5 font-bold text-mute">H{h.level}</span>{h.text}</li>)}</ul>}
          <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setPrev(true)}>Vista previa</Button>{i > 0 && <Button size="sm" variant="primary" onClick={() => setConfirm(true)}>Restaurar esta versión</Button>}</div></>}
      </div>}</li>)}</ul>
    {prev && doc && <Modal title={`Versión: ${doc.title}`} width="max-w-3xl" onClose={() => setPrev(false)}><div className="-mx-5 -my-4 bg-canvas py-4"><ArticleView doc={doc} /></div></Modal>}
    {confirm && <Modal title="Restaurar versión" onClose={() => setConfirm(false)} footer={<><Button onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="primary" disabled={busy} onClick={restore}>{busy ? 'Restaurando…' : 'Restaurar'}</Button></>}><p className="text-[14px]">El contenido del artículo volverá a como estaba en esa versión. Su estado (borrador/publicado) y fecha no cambian, y la versión actual queda guardada en el historial.</p></Modal>}
  </Drawer>;
}
