import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon';
import { Avatar, Badge, Button, Card, Checkbox, Empty, Field, Input, Modal, Select, Switch, Tabs, cx, useToast } from '../components/ui';
import { GRANS, PERM_NAV, PERM_OBJECTS, SCOPE_LABEL, SECTIONS, TOOLS, defaultPerms, permsOf, presets, roleOf, savePerms, savePresets, type Gran, type ObjPerm, type Perms, type Scope, type Seat } from '../lib/perms';
import { OBJECTS } from '../lib/schema';
import type { Owner } from '../lib/types';

const SEATS: { id: Seat; desc: string }[] = [{ id: 'Sales Professional', desc: 'Todo el CRM, con herramientas de ventas y automatización.' }, { id: 'Core', desc: 'Uso diario del CRM: contactos, citas, tareas, llamadas.' }, { id: 'View-Only', desc: 'Solo consulta. No crea ni edita.' }];
export const summarize = (p: ObjPerm) => !p.on ? 'Sin acceso' : [`Ver: ${SCOPE_LABEL[p.view]}${p.unassigned.view && p.view !== 'all' ? ' + sin propietario' : ''}`, p.create && 'Crear', p.edit !== 'none' && `Editar: ${SCOPE_LABEL[p.edit]}`, p.del !== 'none' && `Eliminar: ${SCOPE_LABEL[p.del]}`, p.merge !== 'none' && `Combinar: ${SCOPE_LABEL[p.merge]}`].filter(Boolean).join(' · ');

function ObjRow({ o, p, open, onToggle, onChange }: { o: string; p: ObjPerm; open: boolean; onToggle: () => void; onChange: (p: ObjPerm) => void }) {
  const cfg = OBJECTS[o as keyof typeof OBJECTS]; const id = `perm-${o}`;
  return <div className={cx('mb-2.5 rounded-xl border bg-white', p.on ? 'border-line' : 'border-line bg-canvas/60')}>
    <div className="flex items-center gap-3 px-3.5 py-3">
      <Switch on={p.on} onChange={v => onChange(v ? { ...defaultPerms('setter').objects.contacts, ...p, on: true } : { ...p, on: false })} label={`Acceso a ${cfg.plural}`} />
      <div className="min-w-0 flex-1"><div className="font-display text-[14.5px] font-bold text-navy">{cfg.plural}</div><div className="truncate text-[12.5px] text-slate">{summarize(p)}</div></div>
      <button type="button" disabled={!p.on} aria-expanded={open} aria-controls={id} onClick={onToggle} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-link hover:bg-sky disabled:cursor-not-allowed disabled:opacity-40">{open ? 'Ocultar' : 'Permisos'}<Icon n={open ? 'chevU' : 'chevD'} s={14} /></button>
    </div>
    {open && p.on && <div id={id} className="border-t border-line px-3.5 py-3">
      <div className="grid grid-cols-[1fr] gap-x-4 gap-y-2.5 sm:grid-cols-[110px_210px_1fr] sm:items-center">
        {GRANS.map(g => <div key={g.id} className="contents">
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">{g.label}{g.critical && <Badge tone="Pending" className="!text-[10.5px]">Crítico</Badge>}</div>
          <Select aria-label={`${g.label} ${cfg.plural}`} value={p[g.id]} onChange={e => onChange({ ...p, [g.id]: e.target.value as Scope })} className="!h-8 text-[13px]">{(['all', 'team', 'own', 'none'] as Scope[]).map(s => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}</Select>
          <Checkbox label="Sin propietario" checked={p.unassigned[g.id as Gran]} onChange={c => onChange({ ...p, unassigned: { ...p.unassigned, [g.id]: c } })} />
        </div>)}
        <div className="text-[13.5px] font-semibold text-ink">Crear</div><div><Switch on={p.create} onChange={v => onChange({ ...p, create: v })} label={`Crear ${cfg.plural}`} /></div><div />
      </div>
    </div>}
  </div>;
}

export default function PermissionEditor({ owner, onClose }: { owner: Owner; onClose: () => void }) {
  const toast = useToast(); const saved = useMemo(() => permsOf(owner.id), [owner.id]); const [pr, setPr] = useState<Perms>(() => JSON.parse(JSON.stringify(saved)));
  const [tab, setTab] = useState<'access' | 'review'>('access'); const [nav, setNav] = useState(0); const [q, setQ] = useState(''); const [expand, setExpand] = useState(false); const [openObj, setOpenObj] = useState<string | null>(null); const [presetName, setPresetName] = useState<string | null>(null);
  const list = presets(); const dirty = JSON.stringify(pr) !== JSON.stringify(saved); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role=dialog][aria-modal=true]')) onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [onClose]);
  const setObj = (o: string, v: ObjPerm) => setPr(s => ({ ...s, objects: { ...s.objects, [o]: v } }));
  const navItems = PERM_NAV.map((l, i) => ({ l, i })).filter(x => !q || x.l.toLowerCase().includes(q.toLowerCase()) || (x.i === 0 && PERM_OBJECTS.some(o => OBJECTS[o].plural.toLowerCase().includes(q.toLowerCase()))));
  const applyPreset = (id: string) => { const p = list.find(x => x.id === id); if (p) setPr({ ...JSON.parse(JSON.stringify(p.perms)), seat: pr.seat, mode: 'preset', presetId: id }); else setPr(s => ({ ...s, presetId: undefined })); };
  const save = () => { savePerms(owner.id, pr); toast(`Permisos de ${owner.firstName} guardados`); onClose(); };
  const objsShown = PERM_OBJECTS.filter(o => !q || OBJECTS[o].plural.toLowerCase().includes(q.toLowerCase()) || PERM_NAV[0].toLowerCase().includes(q.toLowerCase()));
  return <div ref={ref} tabIndex={-1} role="region" aria-label="Editor de permisos" className="fixed inset-0 z-[90] flex flex-col bg-canvas outline-none">
    <header className="rail flex h-14 shrink-0 items-center justify-between gap-2 bg-rail px-3 text-white sm:px-4"><button onClick={onClose} className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-white/10"><Icon n="chevL" s={15} />Atrás</button><h2 className="min-w-0 truncate font-display text-[15px] font-bold sm:text-[16px]">Editando el acceso de {owner.firstName} {owner.lastName}</h2><Button variant="brand" disabled={!dirty} onClick={() => (tab === 'access' ? setTab('review') : save())}>{tab === 'access' ? 'Revisar' : 'Guardar'}</Button></header>
    <div className="mx-auto w-full max-w-5xl flex-1 overflow-auto px-4 py-6 sm:px-6">
      <div className="mb-5 flex justify-center"><Tabs value={tab} onChange={setTab} items={[{ id: 'access', label: 'Acceso' }, { id: 'review', label: 'Revisar', count: dirty ? 1 : undefined }]} /></div>
      {tab === 'review' ? <div className="space-y-3">
        <Card title="Resumen de cambios"><p className="mb-3 text-[13.5px] text-slate">Licencia: <b>{pr.seat}</b> · Modo: <b>{pr.mode === 'manual' ? 'permisos manuales' : `preset (${list.find(x => x.id === pr.presetId)?.name ?? '—'})`}</b></p>
          <ul className="divide-y divide-line text-[13.5px]">{PERM_OBJECTS.map(o => <li key={o} className="flex flex-wrap items-baseline justify-between gap-2 py-2"><span className="font-semibold text-navy">{OBJECTS[o].plural}</span><span className="text-slate">{summarize(pr.objects[o])}</span></li>)}</ul></Card>
        <Card title="Herramientas y secciones"><div className="flex flex-wrap gap-1.5">{TOOLS.filter(t => pr.tools[t.id]).map(t => <Badge key={t.id} tone="Confirmed">{t.label}</Badge>)}{SECTIONS.filter(s => pr.sections[s.id]).map(s => <Badge key={s.id} tone="Appointment Set">{s.label}</Badge>)}</div></Card>
        <div className="flex flex-wrap justify-end gap-2"><Button icon="copy" onClick={() => setPresetName(`Preset de ${owner.firstName}`)}>Guardar como preset</Button><Button variant="brand" onClick={save}>Guardar permisos</Button></div>
      </div> : <>
        <div className="mb-4 flex items-center gap-3"><Avatar name={`${owner.firstName} ${owner.lastName}`} size={40} /><div><h3 className="font-display text-[22px] font-bold leading-tight text-navy">Gestionar el acceso del usuario</h3><p className="text-[13.5px] text-slate">{owner.email} · {roleOf(owner.id) === 'admin' ? 'Administrador' : roleOf(owner.id) === 'setter' ? 'Setter' : 'Consulta'}</p></div></div>
        <Card className="mb-3" title="1. Asignar una licencia"><div role="radiogroup" aria-label="Licencia" className="grid gap-2 sm:grid-cols-3">{SEATS.map(s => <button key={s.id} role="radio" aria-checked={pr.seat === s.id} onClick={() => setPr(x => ({ ...x, seat: s.id }))} className={cx('cursor-pointer rounded-xl border p-3 text-left', pr.seat === s.id ? 'border-navy bg-sky' : 'border-line hover:bg-canvas')}><div className="font-display text-[14.5px] font-bold text-navy">{s.id}</div><div className="mt-0.5 text-[12.5px] text-slate">{s.desc}</div></button>)}</div></Card>
        <Card className="mb-3" title="2. Elegir cómo definir el acceso"><div role="radiogroup" aria-label="Modo de acceso" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-[14px]"><input type="radio" name="mode" checked={pr.mode === 'manual'} onChange={() => setPr(x => ({ ...x, mode: 'manual', presetId: undefined }))} className="accent-navy" />Asignar permisos manualmente</label>
          <label className="flex cursor-pointer items-center gap-2 text-[14px]"><input type="radio" name="mode" checked={pr.mode === 'preset'} onChange={() => { setPr(x => ({ ...x, mode: 'preset' })); if (list[0] && !pr.presetId) applyPreset(list[0].id); }} className="accent-navy" />Usar un preset</label>
          {pr.mode === 'preset' && <Select aria-label="Preset" value={pr.presetId ?? ''} onChange={e => applyPreset(e.target.value)} className="!w-56">{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</div></Card>
        <Card title="3. Elegir permisos" pad={false}><div className="flex flex-col md:flex-row">
          <nav aria-label="Categorías de permisos" className="shrink-0 border-b border-line p-2 md:w-60 md:border-b-0 md:border-r">
            <div className="relative mb-2"><Icon n="search" s={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar permisos" aria-label="Buscar permisos" className="h-8 w-full rounded-full border border-line-2 pl-8 pr-3 text-[13px] placeholder:text-mute focus:border-link focus:outline-none focus:ring-2 focus:ring-link/25" /></div>
            <div className="flex gap-1 overflow-x-auto md:block">{navItems.map(({ l, i }) => <button key={l} onClick={() => setNav(i)} aria-current={nav === i} className={cx('block shrink-0 cursor-pointer whitespace-nowrap rounded-lg border-l-4 px-3 py-1.5 text-left text-[13.5px] md:w-full', nav === i ? 'border-brand bg-sky font-semibold text-navy' : 'border-transparent text-ink hover:bg-sky/60')}>{l}</button>)}{navItems.length === 0 && <p className="px-3 py-2 text-[13px] text-slate">Sin resultados</p>}</div>
          </nav>
          <div className="min-w-0 flex-1 p-4">
            {nav === 0 && <><div className="mb-3 flex items-center justify-between"><h4 className="font-display text-[15px] font-bold text-navy">Objetos del CRM</h4><Checkbox label="Expandir todos los permisos" checked={expand} onChange={setExpand} /></div>{objsShown.map(o => <ObjRow key={o} o={o} p={pr.objects[o]} open={expand || openObj === o} onToggle={() => setOpenObj(openObj === o ? null : o)} onChange={v => setObj(o, v)} />)}</>}
            {nav === 1 && <><h4 className="mb-3 font-display text-[15px] font-bold text-navy">Herramientas del CRM</h4><ul className="divide-y divide-line rounded-xl border border-line bg-white">{TOOLS.map(t => <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5"><span className="text-[13.5px] text-ink">{t.label}{t.hint && <Badge tone="Pending" className="ml-2 !text-[10.5px]">{t.hint}</Badge>}</span><Switch on={!!pr.tools[t.id]} onChange={v => setPr(s => ({ ...s, tools: { ...s.tools, [t.id]: v } }))} label={t.label} /></li>)}</ul></>}
            {nav === 2 && <><h4 className="mb-1 font-display text-[15px] font-bold text-navy">Secciones del CRM</h4><p className="mb-3 text-[13px] text-slate">Qué partes del menú puede ver y abrir este usuario.</p><ul className="divide-y divide-line rounded-xl border border-line bg-white">{SECTIONS.map(t => <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5"><span><span className="block text-[13.5px] font-semibold text-ink">{t.label}</span><span className="block text-[12.5px] text-slate">{t.hint}</span></span><Switch on={!!pr.sections[t.id]} onChange={v => setPr(s => ({ ...s, sections: { ...s.sections, [t.id]: v } }))} label={t.label} /></li>)}</ul></>}
            {nav > 2 && <Empty icon="shield" title={PERM_NAV[nav]}>Esta categoría existe en Nexa, pero todavía no tiene funciones en este CRM. Cuando se active, aparecerá aquí con sus permisos.</Empty>}
          </div></div></Card>
      </>}
    </div>
    {presetName !== null && <Modal title="Guardar como preset" onClose={() => setPresetName(null)} width="max-w-md" footer={<><Button onClick={() => setPresetName(null)}>Cancelar</Button><Button variant="primary" disabled={!presetName.trim()} onClick={() => { savePresets([...presets(), { id: `p-${Date.now()}`, name: presetName.trim(), perms: { ...pr, mode: 'manual', presetId: undefined } }]); setPresetName(null); toast('Preset guardado'); }}>Guardar preset</Button></>}><Field label="Nombre del preset"><Input value={presetName} onChange={e => setPresetName(e.target.value)} /></Field></Modal>}
  </div>;
}
