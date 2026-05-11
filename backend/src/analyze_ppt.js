/**
 * PPTX 출력 분석 스크립트
 * 각 슬라이드의 shape별 텍스트, 폰트크기, 박스크기, 공백여부를 출력한다.
 * 
 * 실행: node src/analyze_ppt.js <pptx경로>
 */
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs';
import path from 'path';

const EMU_TO_PT = 1 / 12700;

function attr(el, name) {
  return el?.getAttribute?.(name) ?? null;
}
function firstChild(el, ns, tag) {
  if (!el?.childNodes) return null;
  for (let i = 0; i < el.childNodes.length; i++) {
    const c = el.childNodes[i];
    if (c.localName === tag) return c;
  }
  return null;
}
function allChildren(el, tag) {
  const out = [];
  if (!el?.childNodes) return out;
  for (let i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].localName === tag) out.push(el.childNodes[i]);
  }
  return out;
}
function getAllText(el) {
  if (!el) return '';
  const parts = [];
  function walk(n) {
    if (n.nodeType === 3) { parts.push(n.nodeValue || ''); return; }
    if (n.localName === 't') { parts.push(n.textContent || ''); return; }
    if (n.childNodes) for (let i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
  }
  walk(el);
  return parts.join('').trim();
}

async function analyzePptx(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const parser = new DOMParser();

  // 슬라이드 파일 목록
  const slideKeys = Object.keys(zip.files)
    .filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  console.log(`\n=== ${path.basename(filePath)} (${slideKeys.length} slides) ===\n`);

  for (const key of slideKeys) {
    const xml = await zip.files[key].async('string');
    const doc = parser.parseFromString(xml, 'application/xml');
    const spTree = doc.getElementsByTagName('p:spTree')[0];
    if (!spTree) continue;

    const slideNum = key.match(/slide(\d+)/)?.[1];
    const shapes = allChildren(spTree, 'sp');
    
    const rows = [];
    let emptyCount = 0;
    let tinyFontCount = 0;
    let tooLongCount = 0;

    for (const sp of shapes) {
      const nvSpPr = firstChild(sp, null, 'nvSpPr');
      const cNvPr = firstChild(nvSpPr, null, 'cNvPr');
      const cNvSpPr = firstChild(nvSpPr, null, 'cNvSpPr');
      const spPr = firstChild(sp, null, 'spPr');
      const txBody = firstChild(sp, null, 'txBody');

      const id = attr(cNvPr, 'id') ?? '?';
      const name = attr(cNvPr, 'name') ?? '?';
      const phEl = firstChild(cNvSpPr, null, 'ph');
      const phType = attr(phEl, 'type') ?? (phEl ? 'body' : null);

      // 박스 크기
      const xfrm = firstChild(spPr, null, 'xfrm');
      const ext = firstChild(xfrm, null, 'ext');
      const wEmu = parseInt(attr(ext, 'cx') ?? '0');
      const hEmu = parseInt(attr(ext, 'cy') ?? '0');
      const wPt = Math.round(wEmu * EMU_TO_PT);
      const hPt = Math.round(hEmu * EMU_TO_PT);

      if (!txBody) continue;

      // 텍스트 내용
      const text = getAllText(txBody);
      
      // 폰트 크기 (첫 번째 run 기준)
      let fontSz = null;
      const paras = allChildren(txBody, 'p');
      for (const p of paras) {
        const runs = allChildren(p, 'r');
        for (const r of runs) {
          const rPr = firstChild(r, null, 'rPr');
          const sz = attr(rPr, 'sz');
          if (sz) { fontSz = parseInt(sz) / 100; break; }
        }
        if (fontSz) break;
      }
      // bodyPr normAutofit 여부
      const bodyPr = firstChild(txBody, null, 'bodyPr');
      const hasNormAutofit = !!firstChild(bodyPr, null, 'normAutofit');
      const hasSpAutofit = !!firstChild(bodyPr, null, 'spAutoFit');
      const hasNoAutofit = !!firstChild(bodyPr, null, 'noAutofit');

      const isEmpty = text === '';
      const isTiny = fontSz !== null && fontSz < 8;
      const approxCharsPerLine = wPt > 0 && fontSz ? Math.floor(wPt / (fontSz * 0.55)) : null;
      const approxMaxLines = hPt > 0 && fontSz ? Math.floor(hPt / (fontSz * 1.3)) : null;
      const approxCap = approxCharsPerLine && approxMaxLines ? approxCharsPerLine * approxMaxLines : null;
      const isTooLong = approxCap !== null && text.length > approxCap * 1.5;

      if (isEmpty) emptyCount++;
      if (isTiny) tinyFontCount++;
      if (isTooLong) tooLongCount++;

      const flags = [
        isEmpty ? '🔴EMPTY' : '',
        isTiny ? `🔴TINY(${fontSz}pt)` : '',
        isTooLong ? `⚠️TOOLONG(${text.length}>${approxCap})` : '',
        phType ? `[PH:${phType}]` : '',
        hasNormAutofit ? '[normAutofit]' : hasSpAutofit ? '[spAutofit]' : hasNoAutofit ? '[noAutofit]' : '',
      ].filter(Boolean).join(' ');

      const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;

      rows.push({
        id, name: name.slice(0,20), wPt, hPt,
        fontSz: fontSz ?? '-',
        cap: approxCap ?? '-',
        textLen: text.length,
        preview,
        flags,
      });
    }

    console.log(`--- Slide ${slideNum} (${shapes.length} shapes, empty:${emptyCount}, tiny:${tinyFontCount}, toolong:${tooLongCount}) ---`);
    for (const r of rows) {
      const line = `  sp${String(r.id).padEnd(3)} [${String(r.wPt).padStart(4)}x${String(r.hPt).padStart(4)}pt] sz=${String(r.fontSz).padStart(4)}pt cap=${String(r.cap).padStart(5)} len=${String(r.textLen).padStart(4)}  "${r.preview}"  ${r.flags}`;
      console.log(line);
    }
    console.log();
  }
}

// 메인
const files = process.argv.slice(2);
if (files.length === 0) {
  // 기본: 다운로드 폴더의 최근 pptx들
  const dlDir = 'C:/Users/user/Downloads';
  const all = fs.readdirSync(dlDir)
    .filter(f => f.endsWith('.pptx') && f.startsWith('김유신_포트폴리오'))
    .map(f => ({ f, t: fs.statSync(path.join(dlDir, f)).mtime }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 4)
    .map(x => path.join(dlDir, x.f));
  for (const fp of all) await analyzePptx(fp);
} else {
  for (const fp of files) await analyzePptx(fp);
}
