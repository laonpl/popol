// PPTX 템플릿 파서.
// 안전하게 zip을 풀고 xmldom으로 각 slide.xml 의:
//   - 텍스트 박스(위치/크기/폰트/색상)
//   - 장식 도형(채움/외곽선)
//   - 이미지(p:pic, base64 data URL)
//   - 슬라이드 배경
// 을 추출하고, theme1.xml 에서 색상/폰트도 가져온다. 정규식으로 XML을 직접 수정하지 않는다.

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
  let fontFace = null;
  let bold = false;
  let color = null;
  let originalText = '';
  let runCount = 0;

  if (txBody) {
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
          if (sz) fontPt = parseInt(sz, 10) / 100;
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

  return {
    shapeId: `s${idx}`,
    role,
    x, y, w, h, rotation,
    shapeKind,
    fill, lineColor, lineWidthPt,
    fontPt, fontFace, bold, color,
    phType, phIdx,
    originalText,
    hasText: runCount > 0,
    zIndex,
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

  return { kind: 'pic', picId: `p${idx}`, x, y, w, h, embedRid, zIndex };
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

async function extractSlide(zip, slideFile, slideIndex, themeColors) {
  const xml = await zip.file(slideFile).async('string');
  const doc = parseXml(xml);
  const sld = doc.documentElement;
  const spTree = firstChild(sld, P_NS, 'spTree');
  if (!spTree) return { index: slideIndex, textBoxes: [], decor: [], pics: [], bg: null };

  const rels = await readRels(zip, slideFile);
  const bg = extractBg(sld, themeColors);

  const textBoxes = [];
  const decor = [];
  const pics = [];

  // spTree 의 직계 자식 순서대로 z-index 부여 (먼저 = 뒤에 그려짐)
  let zIndex = 0;
  let counter = 0;
  for (let i = 0; i < spTree.childNodes.length; i++) {
    const node = spTree.childNodes.item(i);
    if (node.nodeType !== 1) continue;
    const ln = node.localName;
    zIndex++;

    if (ln === 'sp') {
      const meta = extractShape(node, counter++, themeColors, zIndex);
      meta.shapeId = `slide${slideIndex}_${meta.shapeId}`;
      if (meta.w <= 0 || meta.h <= 0) continue;
      if (meta.hasText) {
        textBoxes.push(meta);
      } else if (meta.fill || (meta.lineColor && meta.lineWidthPt > 0)) {
        decor.push(meta);
      }
    } else if (ln === 'pic') {
      const pic = extractPic(node, counter++, zIndex);
      if (pic.embedRid && rels[pic.embedRid]) {
        pic.dataUrl = await readMediaAsDataUrl(zip, rels[pic.embedRid]);
      }
      if (pic.dataUrl && pic.w > 0 && pic.h > 0) pics.push(pic);
    }
  }

  textBoxes.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return { index: slideIndex, textBoxes, decor, pics, bg };
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

  const slides = [];
  for (let i = 0; i < slideFiles.length; i++) {
    slides.push(await extractSlide(zip, slideFiles[i], i, theme._schemeMap || {}));
  }

  return { theme, slideSize, slides };
}
