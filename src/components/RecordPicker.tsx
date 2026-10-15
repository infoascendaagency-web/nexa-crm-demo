import { useState } from 'react';
import { crm, useDbValue } from '../lib/api';
import type { ObjKey } from '../lib/types';
import { inputCls, cx } from './ui';

// Selector con búsqueda de un registro (para asociaciones).
export default function RecordPicker({ obj, value, onChange, exclude = [], placeholder = 'Buscar…' }: { obj: ObjKey; value: string | null; onChange: (id: string | null) => void; exclude?: string[]; placeholder?: string }) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false);
  const sel = useDbValue(() => (value ? crm.get(obj, value) : null), [value, obj]);
  const results = useDbValue(() => (q.trim().length < 1 ? [] : crm.search(obj, { query: q, limit: 8 }).results.filter(r => !exclude.includes(r.id))), [q, obj, exclude.join()]);
  if (sel && !open) return <div className="flex items-center justify-between rounded-lg border border-line-2 bg-sky/40 px-3 py-1.5 text-sm"><span className="truncate font-medium">{crm.nameOf(sel, obj)}</span><button type="button" className="cursor-pointer text-xs font-semibold text-link" onClick={() => { onChange(null); setQ(''); setOpen(true); }}>Cambiar</button></div>;
  return <div className="relative"><input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} className={inputCls} aria-label={placeholder} />
    {open && results.length > 0 && <div className="pop absolute left-0 right-0 top-full z-[90] mt-1 max-h-56 overflow-auto rounded-xl border border-line bg-white py-1 shadow-xl">{results.map(r => <button key={r.id} type="button" onMouseDown={() => { onChange(r.id); setOpen(false); setQ(''); }} className={cx('block w-full cursor-pointer px-3 py-1.5 text-left text-[13.5px] hover:bg-sky')}>{crm.nameOf(r, obj)}<span className="ml-2 text-xs text-mute">{r.properties.email ?? r.properties.mobilephone ?? ''}</span></button>)}</div>}</div>;
}
