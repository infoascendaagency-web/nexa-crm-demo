// "Agregar imagen": un solo lugar para subir (botón, arrastrar o pegar con Ctrl+V) o usar una dirección, con texto alternativo guiado.
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Spinner, cx, useToast } from '../../components/ui';
import { BIcon } from './icons';
import { fixLink, isSafeImage } from './types';
import type { Media } from './BlockEditor';

export const OK_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
export type PickedImage = { src: string; alt: string; caption: string };
const nameToAlt = (n: string) => n.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
const looksGeneric = (s: string) => /^(img|image|imagen|dsc|screenshot|captura|foto|photo|whatsapp)[\s\d_-]*/i.test(s.slice(0, 20)) || /^\d+$/.test(s.trim());

export default function ImagePicker({ media, initialFile, replacing, onClose, onInsert }: { media: Media; initialFile?: File | null; replacing?: boolean; onClose: () => void; onInsert: (i: PickedImage) => void }) {
  const toast = useToast(); const fileRef = useRef<HTMLInputElement>(null); const zone = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState(''); const [alt, setAlt] = useState(''); const [caption, setCaption] = useState(''); const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const [over, setOver] = useState(false); const [fileName, setFileName] = useState('');
  const upload = async (f: File | undefined | null) => {
    if (!f) return;
    if (!OK_IMG.includes(f.type)) return toast('Formato no admitido. Usa JPG, PNG, WebP, GIF o AVIF.', 'err');
    if (f.size > 8 * 1024 * 1024) return toast('La imagen pesa más de 8 MB. Reduce su tamaño y vuelve a intentarlo.', 'err');
    if (media.status === 'unconfigured') return toast('La subida de archivos no está activada en este entorno. Pega la dirección (https://) de la imagen.', 'err');
    setBusy(true);
    try { const s = await media.upload(f); setSrc(s); setFileName(f.name); const guess = nameToAlt(f.name); if (!alt && guess && !looksGeneric(guess)) setAlt(guess); } catch (e) { toast((e as Error).message || 'No se pudo subir la imagen', 'err'); } finally { setBusy(false); }
  };
  useEffect(() => { if (initialFile) void upload(initialFile); }, []); // eslint-disable-line
  useEffect(() => {   // pegar una imagen copiada (Ctrl+V) mientras el cuadro está abierto
    const h = (e: ClipboardEvent) => { const f = [...(e.clipboardData?.files ?? [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); void upload(f); } };
    document.addEventListener('paste', h); return () => document.removeEventListener('paste', h);
  }); // eslint-disable-line
  const useUrl = () => { const u = fixLink(url); if (!isSafeImage(u)) return toast('La dirección debe empezar por https:// (o ser una ruta del sitio como /img/foto.jpg).', 'err'); setSrc(u); setFileName(''); setUrl(''); };
  const okAlt = alt.trim().length > 0; const generic = okAlt && looksGeneric(alt.trim());
  return <Modal title={replacing ? 'Cambiar imagen' : 'Agregar imagen'} width="max-w-xl" onClose={onClose} footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!src || !okAlt || busy} onClick={() => onInsert({ src, alt: alt.trim(), caption: caption.trim() })}>{replacing ? 'Usar esta imagen' : 'Insertar imagen'}</Button></>}>
    {!src ? <div>
      <div ref={zone} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files[0]); }} className={cx('grid place-items-center rounded-xl border-2 border-dashed px-4 py-9 text-center transition-colors', over ? 'border-link bg-sky/60' : 'border-line-2 bg-canvas/60')}>
        {busy ? <><Spinner s={24} /><p className="mt-2 text-[13.5px] text-slate">Subiendo imagen…</p></> : <>
          <BIcon n="image" s={32} className="text-slate" />
          <p className="mt-1.5 text-[14.5px] font-semibold text-navy">Arrastra una imagen aquí</p>
          <p className="text-[13px] text-slate">o pégala con <kbd className="rounded border border-line-2 bg-white px-1 text-[12px]">Ctrl</kbd> + <kbd className="rounded border border-line-2 bg-white px-1 text-[12px]">V</kbd> si la copiaste</p>
          <Button variant="primary" className="mt-3" icon="download" disabled={media.status === 'unconfigured'} onClick={() => fileRef.current?.click()}>Subir desde tu equipo</Button>
          <input ref={fileRef} type="file" accept={OK_IMG.join(',')} className="sr-only" aria-label="Elegir imagen" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
          <p className="mt-2 text-[12px] text-mute">JPG, PNG, WebP, GIF o AVIF · máx. 8 MB · ideal 1600 px de ancho</p></>}
      </div>
      {media.status === 'unconfigured' && <p role="status" className="mt-2 rounded-lg bg-[#FDF5E3] px-3 py-2 text-[12.5px] text-[#8A5A0B]"><strong>Subir archivos aún no está activado en este entorno.</strong> Puedes usar una imagen que ya esté publicada: pega su dirección (https://) aquí abajo.</p>}
      <div className="mt-3"><label htmlFor="img-url" className="mb-1 block text-[12.5px] font-semibold text-slate">O pega la dirección de una imagen</label><div className="flex gap-2"><Input id="img-url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); useUrl(); } }} placeholder="https://tusitio.com/foto.jpg" /><Button onClick={useUrl} disabled={!url.trim()}>Usar</Button></div></div>
    </div> : <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
      <div><img src={src} alt="" className="max-h-40 w-full rounded-lg border border-line bg-canvas object-contain" /><button type="button" className="mt-1.5 cursor-pointer text-[12.5px] font-semibold text-link hover:underline" onClick={() => { setSrc(''); setFileName(''); }}>Elegir otra</button>{fileName && <p className="truncate text-[11.5px] text-mute">{fileName}</p>}</div>
      <div>
        <label><span className={cx('mb-1 block text-[12.5px] font-semibold', okAlt ? 'text-slate' : 'text-bad')}>Texto alternativo (obligatorio)</span>
          <textarea autoFocus rows={3} value={alt} onChange={e => setAlt(e.target.value)} maxLength={300} aria-required="true" aria-describedby="alt-help" placeholder="Describe lo que se ve, como si se lo explicaras a alguien por teléfono" className={cx('w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-mute focus:outline-none focus:ring-2', okAlt ? 'border-line-2 focus:border-link focus:ring-link/25' : 'border-bad focus:ring-bad/25')} /></label>
        <div id="alt-help" className="mt-1 text-[12px] leading-snug text-slate">
          <p><span className="font-semibold text-good">Bien:</span> «Tejado de tejas grises recién instalado en una casa de dos pisos».</p>
          <p><span className="font-semibold text-bad">Evita:</span> «imagen1.jpg», «foto», o repetir el título.</p>
          {generic && <p role="alert" className="mt-1 font-semibold text-[#8A5A0B]">Parece un nombre de archivo: describe lo que se ve.</p>}
          <p className="mt-0.5 text-mute">{alt.length} caracteres · ideal: menos de 125. Lo leen los lectores de pantalla y Google; sin él no se puede publicar.</p></div>
        <label className="mt-3 block"><span className="mb-1 block text-[12.5px] font-semibold text-slate">Pie de foto (opcional)</span><Input value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} placeholder="Aparece debajo de la imagen" /></label>
      </div></div>}
  </Modal>;
}
