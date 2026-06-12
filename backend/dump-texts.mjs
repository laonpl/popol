// Dump per-slide text boxes with positions. Usage: node dump-texts.mjs <file.pptx> [slideNo]
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const file = process.argv[2];
const only = process.argv[3] ? +process.argv[3] : null;
const zip = await JSZip.loadAsync(fs.readFileSync(file));
const parser = new DOMParser();

const presRels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
const presXml = await zip.file('ppt/presentation.xml').async('string');
const relMap = {};
for (const m of presRels.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];
const order = [...presXml.matchAll(/<p:sldId id="\d+" r:id="([^"]+)"/g)].map((m) => relMap[m[1]]);

const EMU_IN = 914400;
let idx = 0;
for (const target of order) {
  idx++;
  if (only && idx !== only) continue;
  const p = path.posix.normalize(path.posix.join('ppt', target));
  const doc = parser.parseFromString(await zip.file(p).async('string'), 'text/xml');
  console.log(`\n===== #${idx} ${p} =====`);
  const sps = doc.getElementsByTagName('p:sp');
  for (let i = 0; i < sps.length; i++) {
    const sp = sps.item(i);
    let name = '';
    const nv = sp.getElementsByTagName('p:cNvPr').item(0);
    if (nv) name = nv.getAttribute('name') || '';
    const ph = sp.getElementsByTagName('p:ph').item(0);
    const phType = ph ? (ph.getAttribute('type') || 'body') + (ph.getAttribute('idx') ? '#' + ph.getAttribute('idx') : '') : '';
    // spPr/a:xfrm 의 off/ext 만 사용 — cNvPr extLst 의 <a:ext uri=...> 가 먼저 잡히면 0x0 으로 오인
    const spPr = sp.getElementsByTagName('p:spPr').item(0);
    const xfrm = spPr ? spPr.getElementsByTagName('a:xfrm').item(0) : null;
    const off = xfrm ? xfrm.getElementsByTagName('a:off').item(0) : null;
    const ext = xfrm ? xfrm.getElementsByTagName('a:ext').item(0) : null;
    const pos = off && ext
      ? `(${(+off.getAttribute('x') / EMU_IN).toFixed(1)},${(+off.getAttribute('y') / EMU_IN).toFixed(1)} ${(+ext.getAttribute('cx') / EMU_IN).toFixed(1)}x${(+ext.getAttribute('cy') / EMU_IN).toFixed(1)}in)`
      : '(inherit)';
    const paras = sp.getElementsByTagName('a:p');
    const lines = [];
    for (let j = 0; j < paras.length; j++) {
      const rs = paras.item(j).getElementsByTagName('a:r');
      let line = '';
      let szs = new Set();
      for (let k = 0; k < rs.length; k++) {
        const t = rs.item(k).getElementsByTagName('a:t').item(0);
        if (t) line += t.textContent;
        const rPr = rs.item(k).getElementsByTagName('a:rPr').item(0);
        if (rPr && rPr.getAttribute('sz')) szs.add(+rPr.getAttribute('sz') / 100);
      }
      if (line.trim()) lines.push(`${line}${szs.size ? ` [${[...szs].join('/')}pt]` : ''}`);
    }
    if (!lines.length) { console.log(`  [empty${phType ? ' ph:' + phType : ''}] ${name} ${pos}`); continue; }
    console.log(`  ${phType ? 'ph:' + phType + ' ' : ''}${name} ${pos}`);
    for (const l of lines) console.log(`     | ${l.length > 110 ? l.slice(0, 110) + '…' : l}`);
  }
  const pics = doc.getElementsByTagName('p:pic').length;
  const gfs = doc.getElementsByTagName('p:graphicFrame').length;
  if (pics || gfs) console.log(`  (pics=${pics} graphicFrames=${gfs})`);
}
