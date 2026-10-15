// Importa el Markdown antiguo (editor anterior) a bloques. Escáner lineal (sin regex con retroceso) y con topes.
import { plain, isSafeImage, safeLink, uid, type Block, type Run, type Runs } from './types';

export function inlineRuns(src: string): Runs {
  const s = src.slice(0, 5000); const out: Run[] = []; let buf = ''; let b = false, it = false;
  const flush = () => { if (buf) { out.push({ t: buf, ...(b ? { b: true } : {}), ...(it ? { i: true } : {}) }); buf = ''; } };
  for (let i = 0; i < s.length;) {
    if (s[i] === '[') {
      const close = s.indexOf(']', i + 1); if (close > 0 && s[close + 1] === '(') { const end = s.indexOf(')', close + 2); if (end > 0) { const url = s.slice(close + 2, end).trim(); const text = s.slice(i + 1, close); if (safeLink(url)) { flush(); out.push({ t: text, ...(b ? { b: true } : {}), ...(it ? { i: true } : {}), a: { href: url } }); i = end + 1; continue; } } }
    }
    if (s.startsWith('**', i)) { flush(); b = !b; i += 2; continue; }
    if (s[i] === '*' && s[i + 1] !== ' ') { flush(); it = !it; i++; continue; }
    buf += s[i]; i++;
  }
  flush(); return out;
}
export function mdToBlocks(md: string): Block[] {
  const blocks: Block[] = []; const parts = md.replace(/\r\n?/g, '\n').split('\n\n').slice(0, 400);
  for (const raw of parts) {
    const t = raw.trim(); if (!t || blocks.length >= 200) continue; const id = uid();
    const hm = t.startsWith('#') && !t.includes('\n') ? t.indexOf(' ') : -1;
    if (hm > 0 && hm <= 4 && t.slice(0, hm).split('').every(c => c === '#')) { blocks.push({ id, type: 'heading', level: (Math.min(4, Math.max(2, hm === 1 ? 2 : hm)) as 2 | 3 | 4), text: t.slice(hm + 1).replace(/\*+/g, '').slice(0, 200) }); continue; }
    if (t === '---' || t === '***') { blocks.push({ id, type: 'divider' }); continue; }
    if (t.startsWith('![') && !t.includes('\n')) { const c = t.indexOf(']('); const e = t.lastIndexOf(')'); if (c > 0 && e > c) { const src = t.slice(c + 2, e).trim(); if (isSafeImage(src)) { blocks.push({ id, type: 'image', src, alt: t.slice(2, c), caption: '', align: 'center', width: 'large' }); continue; } } }
    const lines = t.split('\n');
    if (lines.every(l => l.startsWith('- ') || l.startsWith('* '))) { blocks.push({ id, type: 'list', ordered: false, items: lines.slice(0, 100).map(l => inlineRuns(l.slice(2))) }); continue; }
    if (lines.every(l => { const d = l.indexOf('. '); return d > 0 && d < 4 && /^\d+$/.test(l.slice(0, d)); })) { blocks.push({ id, type: 'list', ordered: true, items: lines.slice(0, 100).map(l => inlineRuns(l.slice(l.indexOf('. ') + 2))) }); continue; }
    if (lines.every(l => l.startsWith('>'))) { blocks.push({ id, type: 'quote', runs: inlineRuns(lines.map(l => l.replace(/^>\s?/, '')).join('\n')) }); continue; }
    if (t.startsWith('```')) { blocks.push({ id, type: 'paragraph', runs: plain(t.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')) }); continue; }
    blocks.push({ id, type: 'paragraph', runs: inlineRuns(t) });
  }
  return blocks;
}
