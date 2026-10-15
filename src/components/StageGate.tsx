import { useState, type ReactNode } from 'react';
import { crm } from '../lib/api';
import { PIPELINES, propLabel, type PipeObj } from '../lib/schema';
import type { ObjKey, Rec } from '../lib/types';
import { STAGE_PROP } from '../pages/properties/pipelineApi';
import PropertyInput from './PropertyInput';
import { Button, Field, Modal } from './ui';

/** Propiedades obligatorias de la etapa de destino que el registro aún no tiene (Nexa: negocios y tickets). */
export function missingRequired(obj: ObjKey, rec: Rec, stage: string): string[] {
  const sp = STAGE_PROP[obj as PipeObj]; if (!sp) return [];
  const pipes = PIPELINES[obj as PipeObj]; const pid = rec.properties[sp.pipeline] ?? pipes[0]?.id;
  const st = (pipes.find(p => p.id === pid) ?? pipes[0])?.stages.find(s => s.id === stage);
  return (st?.requiredProperties ?? []).filter(n => !rec.properties[n]);
}
export const isStageProp = (obj: ObjKey, name: string) => STAGE_PROP[obj as PipeObj]?.stage === name;

function GateModal({ obj, rec, stage, miss, onClose }: { obj: ObjKey; rec: Rec; stage: string; miss: string[]; onClose: () => void }) {
  const [vals, setVals] = useState<Record<string, string | null>>({}); const sp = STAGE_PROP[obj as PipeObj];
  const pipes = PIPELINES[obj as PipeObj]; const st = (pipes.find(p => p.id === (rec.properties[sp.pipeline] ?? pipes[0]?.id)) ?? pipes[0])?.stages.find(s => s.id === stage);
  const ok = miss.every(n => vals[n]);
  return <Modal title={`Para mover a “${st?.label ?? stage}”`} onClose={onClose} width="max-w-md" footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!ok} onClick={() => { crm.update(obj, rec.id, { [sp.stage]: stage, ...vals }); onClose(); }}>Mover</Button></>}>
    <p className="mb-3 text-[13.5px] text-slate">Esta etapa exige completar estas propiedades:</p>
    {miss.map((n, i) => <Field key={n} label={propLabel(obj, n) + ' *'}><div data-autofocus={i === 0 ? true : undefined}><PropertyInput obj={obj} name={n} value={vals[n] ?? null} ctx={rec.properties} onChange={v => setVals(s => ({ ...s, [n]: v }))} /></div></Field>)}
  </Modal>;
}
/** `gate.move(obj, rec, stage)` → true si abrió el diálogo (faltan propiedades obligatorias); renderiza `gate.node`. */
export function useStageGate(): { move: (obj: ObjKey, rec: Rec, stage: string) => boolean; node: ReactNode } {
  const [g, setG] = useState<{ obj: ObjKey; rec: Rec; stage: string; miss: string[] } | null>(null);
  return { move: (obj, rec, stage) => { const miss = missingRequired(obj, rec, stage); if (!miss.length) return false; setG({ obj, rec, stage, miss }); return true; }, node: g ? <GateModal {...g} onClose={() => setG(null)} /> : null };
}
