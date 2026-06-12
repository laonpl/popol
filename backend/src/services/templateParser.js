// PPTX 템플릿 파서.
// 안전하게 zip을 풀고 xmldom으로 각 slide.xml 의:
//   - 텍스트 박스(위치/크기/폰트/색상)
//   - 장식 도형(채움/외곽선)
//   - 이미지(p:pic, base64 data URL)
//   - 슬라이드 배경
// 을 추출하고, theme1.xml 에서 색상/폰트도 가져온다. 정규식으로 XML을 직접 수정하지 않는다.

import path from 'node:path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { emuToPt } from './autofit.js';

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function parseXml(content) {
  return new DOMParser({
    locator: {},
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  }).parseFromString(content, 'application/xml');
}

function findChildren(node, ns, localName) {
  if (!node) return [];
  const out = [];
  const list = node.getElementsByTagNameNS(ns, localName);
  for (let i = 0; i < list.length; i++) out.push(list.item(i));
  return out;
}

function firstChild(node, ns, localName) {
  return findChildren(node, ns, localName)[0] || null;
}

function attr(node, name) {
  if (!node || typeof node.getAttribute !== 'function') return null;
  const v = node.getAttribute(name);
  return v === '' || v == null ? null : v;
}

function readCNvPrId(node) {
  const cNvPr = firstChild(node, P_NS, 'cNvPr');
  return attr(cNvPr, 'id');
}

// ── 색상 추출: solidFill / gradFill 의 첫 stop / schemeClr 폴백 ──────────
function readColor(parent, themeColors = {}) {
  if (!parent) return null;
  const solid = firstChild(parent, A_NS, 'solidFill');
  if (solid) {
    const srgb = firstChild(solid, A_NS, 'srgbClr');
    if (srgb) return '#' + (attr(srgb, 'val') || '000000').toUpperCase();
    const scheme = firstChild(solid, A_NS, 'schemeClr');
    if (scheme) {
      const v = attr(scheme, 'val');
      return themeColors[v] || null;
    }
    const sysClr = firstChild(solid, A_NS, 'sysClr');
    if (sysClr) return '#' + (attr(sysClr, 'lastClr') || '000000').toUpperCase();
  }
  const grad = firstChild(parent, A_NS, 'gradFill');
  if (grad) {
    const stops = findChildren(grad, A_NS, 'gs');
    if (stops.length) {
      const srgb = firstChild(stops[0], A_NS, 'srgbClr');
      if (srgb) return '#' + (attr(srgb, 'val') || '000000').toUpperCase();
    }
  }
  return null;
}

function extractTheme(themeXml) {
  if (!themeXml) return { ...defaultTheme(), _schemeMap: {} };
  const doc = parseXml(themeXml);
  const clrScheme = firstChild(doc, A_NS, 'clrScheme');
  const colors = {};
  if (clrScheme) {
    for (let i = 0; i < clrScheme.childNodes.length; i++) {
      const c = clrScheme.childNodes.item(i);
      if (c.nodeType !== 1) continue;
      const name = c.localName;
      const srgb = firstChild(c, A_NS, 'srgbClr');
      const sysClr = firstChild(c, A_NS, 'sysClr');
      if (srgb) colors[name] = '#' + (attr(srgb, 'val') || '000000').toUpperCase();
      else if (sysClr) colors[name] = '#' + (attr(sysClr, 'lastClr') || '000000').toUpperCase();
    }
  }
  // schemeClr val → hex 매핑 (도형 fill 에서 schemeClr 가 나올 때 해석용)
  const schemeMap = {
    bg1: colors.lt1, bg2: colors.lt2, tx1: colors.dk1, tx2: colors.dk2,
    lt1: colors.lt1, lt2: colors.lt2, dk1: colors.dk1, dk2: colors.dk2,
    accent1: colors.accent1, accent2: colors.accent2, accent3: colors.accent3,
    accent4: colors.accent4, accent5: colors.accent5, accent6: colors.accent6,
  };

  const fontScheme = firstChild(doc, A_NS, 'fontScheme');
  let headingFont = 'Pretendard';
  let bodyFont = 'Pretendard';
  if (fontScheme) {
    const major = firstChild(fontScheme, A_NS, 'majorFont');
    const minor = firstChild(fontScheme, A_NS, 'minorFont');
    if (major) {
      const lat = firstChild(major, A_NS, 'latin');
      if (lat && attr(lat, 'typeface')) headingFont = attr(lat, 'typeface');
    }
    if (minor) {
      const lat = firstChild(minor, A_NS, 'latin');
      if (lat && attr(lat, 'typeface')) bodyFont = attr(lat, 'typeface');
    }
  }
  return {
    accent: colors.accent1 || '#3B82F6',
    bg: colors.lt1 || '#FFFFFF',
    text: colors.dk1 || '#111827',
    heading: colors.dk2 || colors.dk1 || '#111827',
    headingFont,
    bodyFont,
    _schemeMap: schemeMap,
  };
}

function defaultTheme() {
  return {
    accent: '#3B82F6', bg: '#FFFFFF', text: '#111827', heading: '#111827',
    headingFont: 'Pretendard', bodyFont: 'Pretendard',
  };
}

function extractSlideSize(presXml) {
  const doc = parseXml(presXml);
  const sldSz = firstChild(doc, P_NS, 'sldSz');
  if (!sldSz) return { widthPt: 720, heightPt: 540 };
  return {
    widthPt: emuToPt(attr(sldSz, 'cx') || 9144000),
    heightPt: emuToPt(attr(sldSz, 'cy') || 6858000),
  };
}

// ── prstGeom → pptxgenjs shape 매핑 ──────────────────────────────────────
function mapPrstGeomToShape(prst) {
  if (!prst) return 'rect';
  if (/^(rect|roundRect|round1Rect|round2DiagRect|round2SameRect)$/.test(prst)) return 'roundRect';
  if (prst === 'ellipse' || prst === 'oval') return 'ellipse';
  if (prst === 'line' || prst === 'straightConnector1') return 'line';
  if (prst === 'triangle' || prst === 'rtTriangle') return 'triangle';
  return 'rect';
}

// 단일 <p:sp> 노드에서 메타데이터를 추출. 텍스트 유무 무관.
function extractShape(spNode, idx, themeColors, zIndex) {
  const spPr = firstChild(spNode, P_NS, 'spPr');
  const xfrm = spPr ? firstChild(spPr, A_NS, 'xfrm') : null;
  const off = xfrm ? firstChild(xfrm, A_NS, 'off') : null;
  const ext = xfrm ? firstChild(xfrm, A_NS, 'ext') : null;

  const x = emuToPt(attr(off, 'x') || 0);
  const y = emuToPt(attr(off, 'y') || 0);
  const w = emuToPt(attr(ext, 'cx') || 0);
  const h = emuToPt(attr(ext, 'cy') || 0);

  // 회전(rot) — 60000 단위가 1도
  const rotAttr = xfrm ? attr(xfrm, 'rot') : null;
  const rotation = rotAttr ? Math.round(parseInt(rotAttr, 10) / 60000) : 0;

  // 도형 종류
  const prstGeom = spPr ? firstChild(spPr, A_NS, 'prstGeom') : null;
  const prst = prstGeom ? attr(prstGeom, 'prst') : null;
  const shapeKind = mapPrstGeomToShape(prst);

  // 채움
  const fill = readColor(spPr, themeColors);
  // 외곽선
  let lineColor = null;
  let lineWidthPt = 0;
  const ln = spPr ? firstChild(spPr, A_NS, 'ln') : null;
  if (ln) {
    const wEmu = attr(ln, 'w');
    if (wEmu) lineWidthPt = emuToPt(parseInt(wEmu, 10));
    lineColor = readColor(ln, themeColors);
  }

  // 텍스트 정보
  const txBody = firstChild(spNode, P_NS, 'txBody');
  let fontPt = 18;
  let szExplicit = false; // 슬라이드 XML 에 sz 가 명시됐는가 (없으면 레이아웃/마스터 상속)
  let fontFace = null;
  let bold = false;
  let color = null;
  let originalText = '';
  let runCount = 0;

  if (txBody) {
    // 박스 자체의 lstStyle 기본 크기 (run rPr 보다 약하지만 명시 값)
    const lstStyle = firstChild(txBody, A_NS, 'lstStyle');
    const lvl1 = lstStyle ? firstChild(lstStyle, A_NS, 'lvl1pPr') : null;
    const defRPr = lvl1 ? firstChild(lvl1, A_NS, 'defRPr') : null;
    const lstSz = defRPr ? attr(defRPr, 'sz') : null;
    if (lstSz) { fontPt = parseInt(lstSz, 10) / 100; szExplicit = true; }

    const paragraphs = findChildren(txBody, A_NS, 'p');
    for (const p of paragraphs) {
      const runs = findChildren(p, A_NS, 'r');
      for (const r of runs) {
        runCount++;
        const rPr = firstChild(r, A_NS, 'rPr');
        const t = firstChild(r, A_NS, 't');
        if (t && t.textContent) originalText += t.textContent;
        if (rPr && runCount === 1) {
          const sz = attr(rPr, 'sz');
          if (sz) { fontPt = parseInt(sz, 10) / 100; szExplicit = true; }
          const b = attr(rPr, 'b');
          if (b === '1' || b === 'true') bold = true;
          const latin = firstChild(rPr, A_NS, 'latin');
          if (latin) fontFace = attr(latin, 'typeface');
          color = readColor(rPr, themeColors);
        }
      }
      if (originalText) originalText += '\n';
    }
  }
  originalText = originalText.trim();

  // placeholder 정보
  const ph = firstChild(spNode, P_NS, 'nvSpPr');
  let phType = null;
  let phIdx = null;
  if (ph) {
    const nvSpPr = firstChild(ph, P_NS, 'nvPr');
    if (nvSpPr) {
      const phNode = firstChild(nvSpPr, P_NS, 'ph');
      if (phNode) {
        phType = attr(phNode, 'type');
        phIdx = attr(phNode, 'idx');
      }
    }
  }

  let role = 'body';
  if (phType === 'title' || phType === 'ctrTitle') role = 'title';
  else if (phType === 'subTitle') role = 'subtitle';
  else if (fontPt >= 28 && y < 120) role = 'title';
  else if (fontPt >= 22) role = 'heading';

  const cNvPrId = readCNvPrId(spNode);

  return {
    shapeId: `sp${cNvPrId || idx}`,
    role,
    x, y, w, h, rotation,
    shapeKind,
    fill, lineColor, lineWidthPt,
    fontPt, szExplicit, fontFace, bold, color,
    phType, phIdx,
    originalText,
    hasText: runCount > 0,
    hasTxBody: txBody !== null,
    zIndex,
  };
}

// ── placeholder 상속 해석 (slideLayout → slideMaster) ────────────────────────
// 슬라이드의 placeholder 는 위치(xfrm)와 폰트 크기를 레이아웃/마스터에서 상속하는
// 경우가 많다. 이를 해석하지 않으면 박스 위치가 0×0(→누락)·폰트 18pt(기본값)로
// 잘못 잡혀, placeholder 위주 템플릿(과제형 덱)에서 빈 슬라이드·작은 글씨가 생긴다.

function resolveTargetPath(fromPath, target) {
  if (!target) return null;
  if (target.startsWith('/')) return target.slice(1);
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), target));
}

// 파트의 _rels 에서 [{ type, target }] 목록
async function readRelsList(zip, partPath) {
  const relsPath = partPath.replace(/([^/]+)$/, '_rels/$1.rels');
  const xml = await zip.file(relsPath)?.async('string');
  if (!xml) return [];
  const doc = parseXml(xml);
  const out = [];
  const rels = doc.getElementsByTagName('Relationship');
  for (let i = 0; i < rels.length; i++) {
    const r = rels.item(i);
    out.push({ type: r.getAttribute('Type') || '', target: r.getAttribute('Target') || '' });
  }
  return out;
}

// 레이아웃/마스터 XML 에서 placeholder 항목(geometry + sz) 수집
function collectPhEntries(doc) {
  const entries = [];
  const sps = doc.getElementsByTagNameNS(P_NS, 'sp');
  for (let i = 0; i < sps.length; i++) {
    const sp = sps.item(i);
    const nvSpPr = firstChild(sp, P_NS, 'nvSpPr');
    const nvPr = nvSpPr ? firstChild(nvSpPr, P_NS, 'nvPr') : null;
    const ph = nvPr ? firstChild(nvPr, P_NS, 'ph') : null;
    if (!ph) continue;
    const spPr = firstChild(sp, P_NS, 'spPr');
    const xfrm = spPr ? firstChild(spPr, A_NS, 'xfrm') : null;
    const off = xfrm ? firstChild(xfrm, A_NS, 'off') : null;
    const ext = xfrm ? firstChild(xfrm, A_NS, 'ext') : null;
    const txBody = firstChild(sp, P_NS, 'txBody');
    let sz = null;
    if (txBody) {
      const lstStyle = firstChild(txBody, A_NS, 'lstStyle');
      const lvl1 = lstStyle ? firstChild(lstStyle, A_NS, 'lvl1pPr') : null;
      const defRPr = lvl1 ? firstChild(lvl1, A_NS, 'defRPr') : null;
      if (defRPr && attr(defRPr, 'sz')) sz = parseInt(attr(defRPr, 'sz'), 10) / 100;
      if (!sz) {
        const firstR = firstChild(txBody, A_NS, 'r');
        const rPr = firstR ? firstChild(firstR, A_NS, 'rPr') : null;
        if (rPr && attr(rPr, 'sz')) sz = parseInt(attr(rPr, 'sz'), 10) / 100;
      }
    }
    entries.push({
      type: attr(ph, 'type') || 'body',
      idx: attr(ph, 'idx'),
      x: off ? emuToPt(attr(off, 'x') || 0) : null,
      y: off ? emuToPt(attr(off, 'y') || 0) : null,
      w: ext ? emuToPt(attr(ext, 'cx') || 0) : null,
      h: ext ? emuToPt(attr(ext, 'cy') || 0) : null,
      sz,
    });
  }
  return entries;
}

// 마스터의 txStyles 기본 폰트 크기 { title, body, other }
function collectTxStyles(masterDoc) {
  const out = {};
  const txStyles = firstChild(masterDoc.documentElement, P_NS, 'txStyles');
  if (!txStyles) return out;
  for (const [tag, key] of [['titleStyle', 'title'], ['bodyStyle', 'body'], ['otherStyle', 'other']]) {
    const style = firstChild(txStyles, P_NS, tag);
    const lvl1 = style ? firstChild(style, A_NS, 'lvl1pPr') : null;
    const defRPr = lvl1 ? firstChild(lvl1, A_NS, 'defRPr') : null;
    if (defRPr && attr(defRPr, 'sz')) out[key] = parseInt(attr(defRPr, 'sz'), 10) / 100;
  }
  return out;
}

// 슬라이드 파일 → { layoutEntries, masterEntries, txStyles } (레이아웃 경로 기준 캐시)
async function getPhInheritance(zip, slidePath, cache) {
  const rels = await readRelsList(zip, slidePath);
  const layoutRel = rels.find(r => /\/slideLayout$/.test(r.type));
  if (!layoutRel) return null;
  const layoutPath = resolveTargetPath(slidePath, layoutRel.target);
  if (!layoutPath) return null;
  if (cache.has(layoutPath)) return cache.get(layoutPath);

  const info = { layoutEntries: [], masterEntries: [], txStyles: {} };
  const layoutXml = await zip.file(layoutPath)?.async('string');
  if (layoutXml) {
    info.layoutEntries = collectPhEntries(parseXml(layoutXml));
    const layoutRels = await readRelsList(zip, layoutPath);
    const masterRel = layoutRels.find(r => /\/slideMaster$/.test(r.type));
    const masterPath = masterRel ? resolveTargetPath(layoutPath, masterRel.target) : null;
    const masterXml = masterPath ? await zip.file(masterPath)?.async('string') : null;
    if (masterXml) {
      const masterDoc = parseXml(masterXml);
      info.masterEntries = collectPhEntries(masterDoc);
      info.txStyles = collectTxStyles(masterDoc);
    }
  }
  cache.set(layoutPath, info);
  return info;
}

// 슬라이드 placeholder(type, idx) → 상속된 { x, y, w, h, sz }
function resolvePlaceholder(inheritance, phType, phIdx) {
  if (!inheritance) return null;
  const typeEq = (a, b) => {
    const na = a || 'body', nb = b || 'body';
    if (na === nb) return true;
    return (na === 'title' || na === 'ctrTitle') && (nb === 'title' || nb === 'ctrTitle');
  };
  const findIn = (entries) =>
    (phIdx != null ? entries.find(e => e.idx != null && e.idx === phIdx) : null)
    || entries.find(e => typeEq(e.type, phType));

  const layoutHit = findIn(inheritance.layoutEntries);
  const masterHit = findIn(inheritance.masterEntries);
  const geomHit = [layoutHit, masterHit].find(e => e && e.w > 0 && e.h > 0) || null;
  let sz = layoutHit?.sz || masterHit?.sz || null;
  if (!sz) {
    const t = phType || 'body';
    if (t === 'title' || t === 'ctrTitle') sz = inheritance.txStyles.title || null;
    else if (t === 'body' || t === 'subTitle' || t === 'obj') sz = inheritance.txStyles.body || null;
    else sz = inheritance.txStyles.other || inheritance.txStyles.body || null;
  }
  if (!geomHit && !sz) return null;
  return {
    x: geomHit?.x ?? null, y: geomHit?.y ?? null,
    w: geomHit?.w ?? null, h: geomHit?.h ?? null,
    sz,
  };
}

// <p:pic> 노드에서 위치/이미지 rId 추출
function extractPic(picNode, idx, zIndex) {
  const spPr = firstChild(picNode, P_NS, 'spPr');
  const xfrm = spPr ? firstChild(spPr, A_NS, 'xfrm') : null;
  const off = xfrm ? firstChild(xfrm, A_NS, 'off') : null;
  const ext = xfrm ? firstChild(xfrm, A_NS, 'ext') : null;
  const x = emuToPt(attr(off, 'x') || 0);
  const y = emuToPt(attr(off, 'y') || 0);
  const w = emuToPt(attr(ext, 'cx') || 0);
  const h = emuToPt(attr(ext, 'cy') || 0);

  const blipFill = firstChild(picNode, P_NS, 'blipFill');
  const blip = blipFill ? firstChild(blipFill, A_NS, 'blip') : null;
  const embedRid = blip ? (attr(blip, 'r:embed') || attr(blip, 'embed')) : null;

  const cNvPrId = readCNvPrId(picNode);
  return { kind: 'pic', picId: `pic${cNvPrId || idx}`, x, y, w, h, embedRid, zIndex };
}

// 슬라이드 배경 색상 추출 (cSld > bg)
function extractBg(sldNode, themeColors) {
  const cSld = firstChild(sldNode, P_NS, 'cSld');
  if (!cSld) return null;
  const bg = firstChild(cSld, P_NS, 'bg');
  if (!bg) return null;
  const bgPr = firstChild(bg, P_NS, 'bgPr');
  if (!bgPr) return null;
  return readColor(bgPr, themeColors);
}

// 슬라이드별 _rels/slideN.xml.rels 파싱 → rId → 미디어 경로
async function readRels(zip, slideFile) {
  const relsFile = slideFile.replace(/slides\/(slide\d+)\.xml$/, 'slides/_rels/$1.xml.rels');
  const xml = await zip.file(relsFile)?.async('string');
  if (!xml) return {};
  const doc = parseXml(xml);
  const map = {};
  const rels = doc.getElementsByTagName('Relationship');
  for (let i = 0; i < rels.length; i++) {
    const r = rels.item(i);
    const id = r.getAttribute('Id');
    const target = r.getAttribute('Target');
    if (id && target) map[id] = target.replace(/^\.\.\//, 'ppt/');
  }
  return map;
}

// 미디어 파일을 base64 데이터 URL 로 변환
async function readMediaAsDataUrl(zip, mediaPath) {
  const file = zip.file(mediaPath);
  if (!file) return null;
  const ext = (mediaPath.match(/\.(png|jpe?g|gif|svg|webp)$/i)?.[1] || 'png').toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'svg' ? 'image/svg+xml'
    : `image/${ext}`;
  const buf = await file.async('nodebuffer');
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// spTree 를 재귀적으로 순회하여 sp/pic 노드를 yield.
// grpSp 안에 중첩된 도형도 빠짐없이 포함된다.
function* walkSpAndPic(node) {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes.item(i);
    if (!child || child.nodeType !== 1) continue;
    const ln = child.localName;
    if (ln === 'sp' || ln === 'pic') yield child;
    else if (ln === 'grpSp') yield* walkSpAndPic(child);
  }
}

async function extractSlide(zip, slideFile, slideIndex, themeColors, slideSize, phCache) {
  const xml = await zip.file(slideFile).async('string');
  const doc = parseXml(xml);
  const sld = doc.documentElement;
  const spTree = firstChild(sld, P_NS, 'spTree');
  if (!spTree) return { index: slideIndex, textBoxes: [], decor: [], pics: [], bg: null };

  const rels = await readRels(zip, slideFile);
  const bg = extractBg(sld, themeColors);
  const inheritance = await getPhInheritance(zip, slideFile, phCache || new Map());
  const slideW = slideSize?.widthPt || 720;
  const slideH = slideSize?.heightPt || 540;
  const TINY_PT = 6;

  const textBoxes = [];
  const decor = [];
  const pics = [];

  let zIndex = 0;
  let counter = 0;
  for (const node of walkSpAndPic(spTree)) {
    zIndex++;
    const ln = node.localName;

    if (ln === 'sp') {
      const meta = extractShape(node, counter++, themeColors, zIndex);
      meta.shapeId = `slide${slideIndex}_${meta.shapeId}`;

      // placeholder 상속: 슬라이드에 xfrm/sz 가 없으면 레이아웃/마스터에서 가져온다.
      // (과제형 덱은 위치·폰트가 전부 상속이라, 해석 없이는 박스가 0×0/18pt 로 잘못 잡힘)
      if (meta.hasTxBody && (meta.phType || meta.phIdx != null)) {
        const inherited = resolvePlaceholder(inheritance, meta.phType, meta.phIdx);
        if (inherited) {
          if ((meta.w <= TINY_PT || meta.h <= TINY_PT) && inherited.w > 0 && inherited.h > 0) {
            meta.x = inherited.x ?? meta.x;
            meta.y = inherited.y ?? meta.y;
            meta.w = inherited.w;
            meta.h = inherited.h;
          }
          if (!meta.szExplicit && inherited.sz) {
            meta.fontPt = inherited.sz;
            meta.szExplicit = true;
          }
        }
      }

      // 0×0 자동확장(spAutoFit) 텍스트박스: 원문이 있던 자리면 실사용 영역을 합성.
      // (선언 크기가 0이라도 PowerPoint 는 autofit 으로 키워 그렸음 — 그대로 버리면
      //  그 슬라이드의 본문 자리가 통째로 사라진다)
      if (meta.hasTxBody && (meta.w <= TINY_PT || meta.h <= TINY_PT) && meta.hasText
          && meta.x >= 0 && meta.y >= 0 && meta.x < slideW * 0.92 && meta.y < slideH * 0.92) {
        const synthW = Math.min(slideW * 0.55, slideW - meta.x - slideW * 0.04);
        const synthH = Math.min(slideH * 0.35, slideH - meta.y - slideH * 0.05);
        if (synthW >= 60 && synthH >= 20) {
          meta.w = Math.max(meta.w, synthW);
          meta.h = Math.max(meta.h, synthH);
          meta.synthetic = true;
        }
      }

      // sz 를 어디서도 찾지 못한 박스: 슬라이드 크기에 비례한 기본값.
      // (1920pt 폭 덱에서 18pt 고정 기본값은 사실상 안 보이는 크기)
      if (!meta.szExplicit) {
        meta.fontPt = Math.round(18 * Math.max(1, slideH / 540));
      }

      // 상속·합성 반영 후 role 재산정 (extractShape 시점에는 fontPt·위치 미해석).
      // 폰트 임계값은 슬라이드 크기에 비례(1080pt 덱의 28pt 는 작은 글씨).
      {
        const scale = Math.max(1, slideH / 540);
        if (meta.phType === 'title' || meta.phType === 'ctrTitle') meta.role = 'title';
        else if (meta.phType === 'subTitle') meta.role = 'subtitle';
        else if (meta.fontPt >= 28 * scale && meta.y < slideH * 0.22) meta.role = 'title';
        else if (meta.fontPt >= 22 * scale) meta.role = 'heading';
        else meta.role = 'body';
      }

      if (meta.w <= 0 || meta.h <= 0) continue;
      // hasTxBody 이면 항상 textBoxes — fill 여부 무관.
      // Why: 채움색이 있고 현재 텍스트 없는 박스도 사용자가 비워둔 '입력용 칸'이다.
      // 이전 조건(hasTxBody && (hasText || !fill))은 filled-background 빈 칸을
      // decor로 분류해 콘텐츠를 못 받는 버그가 있었음.
      if (meta.hasTxBody) {
        textBoxes.push(meta);
      } else if (meta.fill || (meta.lineColor && meta.lineWidthPt > 0)) {
        decor.push(meta);
      }
    } else if (ln === 'pic') {
      const pic = extractPic(node, counter++, zIndex);
      if (pic.embedRid && rels[pic.embedRid]) {
        pic.mediaPath = rels[pic.embedRid];
        pic.dataUrl = await readMediaAsDataUrl(zip, rels[pic.embedRid]);
        if (pic.dataUrl) {
          // base64 길이 → 원본 바이트 근사 (콘텐츠 사진 판별용)
          pic.mediaBytes = Math.round((pic.dataUrl.length - pic.dataUrl.indexOf(',') - 1) * 0.75);
        }
      }
      if (pic.dataUrl && pic.w > 0 && pic.h > 0) pics.push(pic);
    }
  }

  textBoxes.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return { index: slideIndex, textBoxes, decor, pics, bg };
}

// ── 디자인 DNA 추출 ──────────────────────────────────────────────────────
// theme1.xml 스킴만 읽으면 한국형 템플릿의 "보이는" 디자인과 어긋난다
// (디자이너들이 기본 Office 테마를 그대로 두고 도형·텍스트에 색을 하드코딩하므로).
// 슬라이드 + 레이아웃 + 마스터에서 실제 칠해진 색을 면적·글자수 가중으로 모아
// bg/text/dark/accent 와 실사용 폰트를 도출한다.

function hexToRgbTuple(hexColor) {
  const c = String(hexColor || '').replace('#', '');
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function hexLuminance(hexColor) {
  const rgb = hexToRgbTuple(hexColor);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map(v => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function hexSaturation(hexColor) {
  const rgb = hexToRgbTuple(hexColor);
  if (!rgb) return 0;
  const max = Math.max(...rgb), min = Math.min(...rgb);
  if (max === min) return 0;
  const l = (max + min) / 2 / 255;
  return (max - min) / (255 * (1 - Math.abs(2 * l - 1)));
}

function hexHue(hexColor) {
  const rgb = hexToRgbTuple(hexColor);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function contrastBetween(a, b) {
  const la = hexLuminance(a), lb = hexLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function hexShade(hexColor, factor = 0.72) {
  const rgb = hexToRgbTuple(hexColor);
  if (!rgb) return hexColor;
  return '#' + rgb.map(v => Math.round(v * factor).toString(16).padStart(2, '0')).join('').toUpperCase();
}

// "Pretendard Regular" → "Pretendard" (Regular 만 안전하게 제거 — Bold/Light 등은
// 별도 설치 패밀리명일 수 있어 유지)
function normalizeFontFamily(name) {
  return String(name || '').trim().replace(/\s+Regular$/i, '');
}

// 마스터/레이아웃의 <p:bg> — bgPr(solid/grad) 또는 bgRef(schemeClr) 둘 다 해석
function readPartBg(rootEl, themeMap) {
  const cSld = firstChild(rootEl, P_NS, 'cSld');
  if (!cSld) return null;
  const bg = firstChild(cSld, P_NS, 'bg');
  if (!bg) return null;
  const bgPr = firstChild(bg, P_NS, 'bgPr');
  if (bgPr) return readColor(bgPr, themeMap);
  const bgRef = firstChild(bg, P_NS, 'bgRef');
  if (bgRef) {
    const scheme = firstChild(bgRef, A_NS, 'schemeClr');
    if (scheme) return themeMap[attr(scheme, 'val')] || null;
    const srgb = firstChild(bgRef, A_NS, 'srgbClr');
    if (srgb) return '#' + (attr(srgb, 'val') || 'FFFFFF').toUpperCase();
  }
  return null;
}

// 한 파트(slide/layout/master)에서 fills(면적)·textColors(글자수)·fonts(글자수) 수집
function scanPartForDna(doc, themeMap, weight, acc) {
  const root = doc.documentElement;
  const spTree = root ? firstChild(firstChild(root, P_NS, 'cSld') || root, P_NS, 'spTree') : null;
  if (!spTree) return;
  for (const node of walkSpAndPic(spTree)) {
    if (node.localName !== 'sp') continue;
    const spPr = firstChild(node, P_NS, 'spPr');
    const xfrm = spPr ? firstChild(spPr, A_NS, 'xfrm') : null;
    const ext = xfrm ? firstChild(xfrm, A_NS, 'ext') : null;
    const w = emuToPt(attr(ext, 'cx') || 0);
    const h = emuToPt(attr(ext, 'cy') || 0);
    const fill = spPr ? readColor(spPr, themeMap) : null;
    if (fill && w > 0 && h > 0) {
      acc.fills.set(fill, (acc.fills.get(fill) || 0) + w * h * weight);
    }
    const txBody = firstChild(node, P_NS, 'txBody');
    if (!txBody) continue;
    for (const p of findChildren(txBody, A_NS, 'p')) {
      for (const r of findChildren(p, A_NS, 'r')) {
        const t = firstChild(r, A_NS, 't');
        const chars = (t && t.textContent ? t.textContent.trim().length : 0);
        if (!chars) continue;
        const rPr = firstChild(r, A_NS, 'rPr');
        const color = rPr ? readColor(rPr, themeMap) : null;
        if (color) acc.textColors.set(color, (acc.textColors.get(color) || 0) + chars * weight);
        acc.totalChars += chars * weight;
        if (rPr) {
          const szAttr = attr(rPr, 'sz');
          const sz = szAttr ? parseInt(szAttr, 10) / 100 : 0;
          const bold = attr(rPr, 'b') === '1' || attr(rPr, 'b') === 'true';
          for (const tag of ['latin', 'ea']) {
            const fontEl = firstChild(rPr, A_NS, tag);
            const face = fontEl ? attr(fontEl, 'typeface') : null;
            if (!face || face.startsWith('+')) continue;
            const fam = normalizeFontFamily(face);
            if (!fam) continue;
            const cur = acc.fonts.get(fam) || { chars: 0, headChars: 0 };
            cur.chars += chars * weight;
            if (sz >= 24 || bold) cur.headChars += chars * weight;
            acc.fonts.set(fam, cur);
          }
        }
      }
    }
  }
}

/**
 * 업로드 PPTX 에서 디자인 DNA(실제 칠해진 팔레트 + 실사용 폰트)를 추출.
 * @param {Buffer} buffer
 * @returns {Promise<{bg, text, heading, accent, accent2, dark, fontHeading, fontBody}>}
 */
export async function extractDesignDna(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const presXml = await zip.file('ppt/presentation.xml')?.async('string');
  if (!presXml) throw new Error('유효한 PPTX 파일이 아닙니다 (presentation.xml 없음)');
  const themeXml = await zip.file('ppt/theme/theme1.xml')?.async('string');
  const theme = extractTheme(themeXml);
  const themeMap = theme._schemeMap || {};

  const partsByLevel = [
    { re: /^ppt\/slides\/slide\d+\.xml$/, weight: 1.0 },
    { re: /^ppt\/slideLayouts\/slideLayout\d+\.xml$/, weight: 0.5 },
    { re: /^ppt\/slideMasters\/slideMaster\d+\.xml$/, weight: 0.4 },
  ];
  const acc = { fills: new Map(), textColors: new Map(), fonts: new Map(), totalChars: 0 };
  const bgByLevel = [new Map(), new Map(), new Map()]; // 슬라이드 > 레이아웃 > 마스터 우선
  for (let level = 0; level < partsByLevel.length; level++) {
    const { re, weight } = partsByLevel[level];
    for (const path of Object.keys(zip.files).filter(p => re.test(p))) {
      const xml = await zip.file(path)?.async('string');
      if (!xml) continue;
      const doc = parseXml(xml);
      const bg = readPartBg(doc.documentElement, themeMap);
      if (bg) bgByLevel[level].set(bg, (bgByLevel[level].get(bg) || 0) + 1);
      scanPartForDna(doc, themeMap, weight, acc);
    }
  }

  const topOf = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const bg = topOf(bgByLevel[0]) || topOf(bgByLevel[1]) || topOf(bgByLevel[2]) || theme.bg || '#FFFFFF';
  const bgIsDark = hexLuminance(bg) < 0.35;

  // 본문 텍스트색: 가장 많이 쓰인 저채도 색 (고채도는 강조색이지 본문색이 아님)
  const textEntries = [...acc.textColors.entries()].sort((a, b) => b[1] - a[1]);
  let text = null;
  for (const [color] of textEntries) {
    if (hexSaturation(color) <= 0.35 && contrastBetween(color, bg) >= 2.5) { text = color; break; }
  }
  if (!text) text = bgIsDark ? '#FFFFFF' : '#1F2937';

  // 강조색 후보: 도형 채움(면적, 가중 3배) + 텍스트색(글자수)
  const charFloor = Math.max(16, acc.totalChars * 0.03);
  const candidates = new Map(); // color -> score
  const maxFill = Math.max(1, ...acc.fills.values());
  for (const [color, area] of acc.fills) {
    if (hexSaturation(color) < 0.18) continue;
    if (hexLuminance(color) > 0.92 || hexLuminance(color) < 0.02) continue;
    if (contrastBetween(color, bg) < 1.5) continue;
    candidates.set(color, Math.max(candidates.get(color) || 0, (area / maxFill) * (0.4 + hexSaturation(color)) * 3));
  }
  const maxText = Math.max(1, ...acc.textColors.values());
  for (const [color, chars] of acc.textColors) {
    if (chars < charFloor) continue;
    if (hexSaturation(color) < 0.3) continue;
    if (contrastBetween(color, bg) < 1.5) continue;
    candidates.set(color, Math.max(candidates.get(color) || 0, (chars / maxText) * (0.4 + hexSaturation(color))));
  }
  const ranked = [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const accent = ranked[0] || theme.accent || '#3B82F6';
  const accent2 = ranked.find(c => c !== accent && Math.abs(hexHue(c) - hexHue(accent)) > 40) || null;

  // 다크 패널색: 실제 쓰인 어두운 색 우선, 없으면 어두운 배경 자체, 최후엔 테마 dk
  const usedDark = [
    ...[...acc.fills.entries()].filter(([c, a]) => hexLuminance(c) <= 0.18 && a >= maxFill * 0.05).map(([c]) => c),
    ...textEntries.filter(([c, n]) => hexLuminance(c) <= 0.12 && n >= charFloor).map(([c]) => c),
  ].sort((a, b) => hexLuminance(a) - hexLuminance(b));
  let dark = usedDark[0] || (bgIsDark ? bg : null)
    || [theme.heading, theme.text].find(c => c && hexLuminance(c) <= 0.35)
    || '#1F2937';
  // 다크가 배경과 거의 같으면(예: 배경 자체가 어두운 템플릿) 한 단계 더 어둡게
  if (Math.abs(hexLuminance(dark) - hexLuminance(bg)) < 0.05) dark = hexShade(dark, 0.72);

  // 폰트: 명시적으로 지정된 패밀리만 집계 (+mj/+mn 테마 참조는 제외), 없으면 테마 폰트.
  // "Pretendard Bold" 같은 웨이트별 패밀리는 기본 패밀리가 같이 쓰였을 때만 합산
  // (볼드는 렌더러가 b 플래그로 처리하므로 패밀리는 기본형이 안전).
  const WEIGHT_SUFFIX_RE = /\s+(Bold|SemiBold|DemiBold|ExtraBold|UltraBold|Black|Heavy|Medium|Light|ExtraLight|UltraLight|Thin|Book)$/i;
  for (const [fam, v] of [...acc.fonts.entries()]) {
    const base = fam.replace(WEIGHT_SUFFIX_RE, '');
    if (base !== fam && acc.fonts.has(base)) {
      const baseV = acc.fonts.get(base);
      baseV.chars += v.chars;
      baseV.headChars += v.headChars;
      acc.fonts.delete(fam);
    }
  }
  const fontEntries = [...acc.fonts.entries()].sort((a, b) => b[1].chars - a[1].chars);
  const fontBody = fontEntries[0]?.[0] || theme.bodyFont || 'Pretendard';
  const headRanked = [...acc.fonts.entries()].filter(([, v]) => v.headChars > 0).sort((a, b) => b[1].headChars - a[1].headChars);
  const fontHeading = headRanked[0]?.[0] || fontEntries[0]?.[0] || theme.headingFont || fontBody;

  return { bg, text, heading: text, accent, accent2, dark, fontHeading, fontBody };
}

/**
 * PPTX 버퍼를 받아 레이아웃 메타데이터를 반환.
 * @param {Buffer} buffer
 * @returns {Promise<{theme, slideSize, slides: Array<{index, textBoxes, decor, pics, bg}>}>}
 */
export async function parsePptxLayout(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const presXml = await zip.file('ppt/presentation.xml')?.async('string');
  if (!presXml) throw new Error('유효한 PPTX 파일이 아닙니다 (presentation.xml 없음)');

  const themeXml = await zip.file('ppt/theme/theme1.xml')?.async('string');
  const theme = extractTheme(themeXml);
  const slideSize = extractSlideSize(presXml);

  const slideFiles = Object.keys(zip.files)
    .filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)/)[1], 10);
      return na - nb;
    });

  if (slideFiles.length === 0) throw new Error('PPTX에 슬라이드가 없습니다');

  const phCache = new Map(); // 레이아웃 경로 → placeholder 상속 정보
  const slides = [];
  for (let i = 0; i < slideFiles.length; i++) {
    slides.push(await extractSlide(zip, slideFiles[i], i, theme._schemeMap || {}, slideSize, phCache));
  }

  return { theme, slideSize, slides };
}
