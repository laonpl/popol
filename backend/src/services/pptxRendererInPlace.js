// 업로드된 원본 PPTX 의 ZIP/XML을 보존한 채 텍스트만 치환한다.
// 기존 pptxgenjs 재렌더링은 그라디언트, 그룹 도형, 표/차트, 마스터 상속 등을
// 잃었기 때문에 원본 디자인을 100% 유지하려면 이 in-place 방식이 필요하다.
//
// deck 길이가 템플릿 슬라이드 수보다 많으면 원본 슬라이드를 복제해 늘린다.
// 적으면 사용한 슬라이드만 남긴다(unused slide 는 결과물에서 제거).

import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { shrinkToFit } from './autofit.js';

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_TYPE_SLIDE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const CT_SLIDE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';

function parseXml(s) {
  return new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  }).parseFromString(s, 'application/xml');
}
function serializeXml(node) {
  return new XMLSerializer().serializeToString(node);
}
function findChildren(node, ns, ln) {
  if (!node) return [];
  const out = [];
  const list = node.getElementsByTagNameNS(ns, ln);
  for (let i = 0; i < list.length; i++) out.push(list.item(i));
  return out;
}
function firstChild(node, ns, ln) {
  return findChildren(node, ns, ln)[0] || null;
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
function directChildrenByLocalName(parent, localName) {
  const out = [];
  if (!parent) return out;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes.item(i);
    if (c && c.nodeType === 1 && c.localName === localName) out.push(c);
  }
  return out;
}

const WATERMARK_RE = /템플릿\s*\d|template\s*\d|Project\s*\d|project\s*\d|샘플|sample|예시|lorem\s+ipsum|클릭하여|텍스트를?\s*입력|제목을?\s*입력|부제목을?\s*입력|click to (add|edit)/i;

function readTxBodyText(txBody) {
  let out = '';
  const list = txBody.getElementsByTagNameNS(A_NS, 't');
  for (let i = 0; i < list.length; i++) out += list.item(i).textContent || '';
  return out.trim();
}

// spTree 를 재귀적으로 순회하여 sp/pic 노드를 yield (templateParser 와 동일).
function* walkSpAndPic(node) {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes.item(i);
    if (!child || child.nodeType !== 1) continue;
    const ln = child.localName;
    if (ln === 'sp' || ln === 'pic') yield child;
    else if (ln === 'grpSp') yield* walkSpAndPic(child);
  }
}

// ── 텍스트 치환 ─────────────────────────────────────────────────────────────
// Pass 1 (sanitizeAllText): 모든 <p:sp>를 순회하여
//   ① 각 shape의 첫 <a:rPr>/<a:endParaRPr>에서 sz·solidFill 을 savedStyles Map 에 저장.
//   ② 모든 단락의 <a:r>/<a:fld>/<a:br> 을 완전 삭제 — 빈 슬레이트에서 시작(Force-Clear).
//   ③ <a:bodyPr> 에 <a:normAutofit> 를 강제 주입(Auto-Shrink 안전망).
//   <a:pPr>, <a:endParaRPr> 는 단락 구조 정보이므로 유지한다.
// Pass 2 (applyTextReplacements): 매핑된 박스에만 AI 텍스트를 채워 넣는다.
// 도형/이미지/테마/마스터 등은 일절 건드리지 않는다.
//
// Returns: Map<cNvPrId, { sz: string|null, solidFillXml: string|null }>
function sanitizeAllText(spTree, doc) {
  const savedStyles = new Map();
  for (const node of walkSpAndPic(spTree)) {
    if (node.localName !== 'sp') continue;
    const txBody = firstChild(node, P_NS, 'txBody');
    if (!txBody) continue;

    // ① Force-Clear 전 sz·solidFill·rPr 전체 추출 (보관)
    // rPrClone: Force-Clear 전의 <a:rPr> 딥클론 — 폰트/색/굵기 복원에 사용.
    // ⚠ endParaRPr 는 element 이름이 다르므로 절대 rPrClone 으로 사용하지 않는다.
    //   endParaRPr 를 run 안에 넣으면 <a:r><a:endParaRPr/><a:t/></a:r> 라는 invalid XML 이 된다.
    //   → run <a:rPr> 에서만 clone, endParaRPr 는 sz/color 값 추출 전용.
    let sz = null, solidFillXml = null, rPrClone = null;
    for (const p of directChildrenByLocalName(txBody, 'p')) {
      // run 의 rPr 에서만 clone (element 이름이 a:rPr 임을 보장)
      for (const r of directChildrenByLocalName(p, 'r')) {
        const rPrEl = firstChild(r, A_NS, 'rPr');
        if (!rPrEl) continue;
        if (!rPrClone && (rPrEl.attributes?.length > 0 || rPrEl.childNodes?.length > 0)) {
          rPrClone = rPrEl.cloneNode(true); // 반드시 a:rPr element
        }
        if (!sz) sz = rPrEl.getAttribute('sz') || null;
        if (!solidFillXml) {
          const fill = firstChild(rPrEl, A_NS, 'solidFill');
          if (fill) solidFillXml = serializeXml(fill);
        }
      }
      // endParaRPr 는 sz/color 추출 전용 — clone 금지
      const endPr = firstChild(p, A_NS, 'endParaRPr');
      if (endPr) {
        if (!sz) sz = endPr.getAttribute('sz') || null;
        if (!solidFillXml) {
          const fill = firstChild(endPr, A_NS, 'solidFill');
          if (fill) solidFillXml = serializeXml(fill);
        }
      }
      if (rPrClone && sz && solidFillXml) break;
    }
    const cNvPrId = readCNvPrId(node);
    if (cNvPrId) savedStyles.set(cNvPrId, { sz, solidFillXml, rPrClone });

    // ② Force-Clear: <a:r>/<a:fld>/<a:br> 완전 삭제 후 빈 <a:r> 삽입.
    // ⚠ 빈 <a:r> 을 넣지 않으면 PowerPoint 가 슬라이드 레이아웃의 placeholder prompt text
    //   (예: "제목을 입력해주세요")를 렌더링 시점에 fallback 으로 주입한다.
    //   빈 <a:r> 으로 "이 shape 은 명시적으로 비어있음" 을 선언해 fallback 을 완전 차단.
    for (const p of directChildrenByLocalName(txBody, 'p')) {
      const toRemove = [];
      for (let i = 0; i < p.childNodes.length; i++) {
        const c = p.childNodes.item(i);
        if (c && c.nodeType === 1 && (c.localName === 'r' || c.localName === 'fld' || c.localName === 'br')) {
          toRemove.push(c);
        }
      }
      for (const c of toRemove) p.removeChild(c);
      // 빈 run 삽입 (endParaRPr 이 있으면 그 앞에)
      const emptyR = doc.createElementNS(A_NS, 'a:r');
      emptyR.appendChild(doc.createElementNS(A_NS, 'a:rPr'));
      emptyR.appendChild(doc.createElementNS(A_NS, 'a:t'));
      const endParaRPr = firstChild(p, A_NS, 'endParaRPr');
      if (endParaRPr) p.insertBefore(emptyR, endParaRPr);
      else p.appendChild(emptyR);
    }

    // ③ noAutofit 보장: normAutofit/spAutoFit 제거 → noAutofit 삽입.
    // Why: normAutofit(Auto-Shrink)을 주입하면 PDF 변환기가 이를 무시하고 원본 폰트 크기로 렌더링,
    // 박스를 넘치는 줄을 잘라버린다("글이 나오다가 마는" 현상).
    // shrinkToFit으로 이미 맞는 폰트 크기를 sz에 직접 기록했으므로 normAutofit 필요 없음.
    const bodyPr = firstChild(txBody, A_NS, 'bodyPr');
    if (bodyPr) {
      for (const tag of ['spAutoFit', 'normAutofit', 'noAutofit']) {
        const ex = firstChild(bodyPr, A_NS, tag);
        if (ex) bodyPr.removeChild(ex);
      }
      bodyPr.appendChild(doc.createElementNS(A_NS, 'a:noAutofit'));
    }
  }
  return savedStyles;
}

// ── 사진 제거 (샘플/placeholder 사진만) ───────────────────────────────────────
// 템플릿의 sample 이미지(프로필 사진 placeholder 등)는 제거하되,
// 배경·장식 이미지(디자인 요소)는 보존한다.
// 구별 기준: <p:nvPicPr> 아래 <p:nvPr><p:ph> 있으면 placeholder → 제거.
//            ph 없는 pic은 디자인 요소 → 보존.
// 콘텐츠 샘플 이미지 판정 (사진·그래프·스크린샷 등 사용자 데이터로 대체 불가능한 템플릿 잔재).
// 디자인 띠/바(가로로 매우 긴 배경 이미지)와 아이콘(작음), 풀블리드 배경은 보존.
//  · 면적 3% 이상 55% 미만 + 종횡비(긴변/짧은변) 5 미만 → 샘플 콘텐츠로 보고 제거
export function isContentSamplePic(w, h, slideW, slideH) {
  if (!(w > 0) || !(h > 0) || !(slideW > 0) || !(slideH > 0)) return false;
  const areaRatio = (w * h) / (slideW * slideH);
  if (areaRatio < 0.03 || areaRatio >= 0.55) return false;
  const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
  return aspect < 5;
}

function removeAllPicsFromSpTree(spTree, slideW = 0, slideH = 0) {
  const toRemove = [];
  const isPlaceholderPic = (pic) => {
    const nvPicPr = firstChild(pic, P_NS, 'nvPicPr');
    const nvPr    = nvPicPr ? firstChild(nvPicPr, P_NS, 'nvPr') : null;
    return nvPr ? !!firstChild(nvPr, P_NS, 'ph') : false;
  };
  const isSamplePic = (pic) => {
    const geom = topLevelXfrm(pic);
    return geom ? isContentSamplePic(geom.w, geom.h, slideW, slideH) : false;
  };
  const collectFromGroup = (group) => {
    for (let i = 0; i < group.childNodes.length; i++) {
      const c = group.childNodes.item(i);
      if (!c || c.nodeType !== 1) continue;
      if (c.localName === 'pic' && (isPlaceholderPic(c) || isSamplePic(c))) toRemove.push(c);
      else if (c.localName === 'grpSp') collectFromGroup(c);
    }
  };
  collectFromGroup(spTree);
  for (const pic of toRemove) {
    if (pic.parentNode) pic.parentNode.removeChild(pic);
  }
  if (toRemove.length) console.log(`[Renderer] 샘플/placeholder 이미지 ${toRemove.length}개 제거`);
  return toRemove.length;
}

// 템플릿에 포함된 표(table), 차트(chart), SmartArt 등 graphicFrame 을 제거.
// 이 요소들은 사용자 데이터로 채울 수 없는 템플릿 플레이스홀더이므로 출력물에서 제거.
// grpSp 내부도 재귀 탐색.
function removeAllGraphicFramesFromSpTree(spTree) {
  const toRemove = [];
  const collect = (group) => {
    for (let i = 0; i < group.childNodes.length; i++) {
      const c = group.childNodes.item(i);
      if (!c || c.nodeType !== 1) continue;
      if (c.localName === 'graphicFrame') toRemove.push(c);
      else if (c.localName === 'grpSp') collect(c);
    }
  };
  collect(spTree);
  for (const gf of toRemove) {
    if (gf.parentNode) gf.parentNode.removeChild(gf);
  }
  if (toRemove.length) console.log(`[Renderer] graphicFrame(표/차트 등) ${toRemove.length}개 제거`);
  return toRemove.length;
}

const EMU_PER_PT = 12700;

// ── 적응형 재배치 ───────────────────────────────────────────────────────────
// 템플릿 디자인을 1:1 로 고정하지 않고, 내용이 배정되지 않은 카드(공간 그룹)는
// 도형째 제거한 뒤 남은 카드를 원래 영역에 균등 재배치한다.
// "형태는 비슷하게, 배치·구성은 데이터 양에 맞게" — 3카드 템플릿에 항목이 2개면 2카드로.
//
// 안전 장치:
//  · 같은 축(열/행)에서 크기가 비슷한 "동급(peer) 그룹"만 대상 (좌측 레일·제목띠 등 이형 그룹 불변)
//  · 슬라이드 면적 50% 이상의 배경 도형, 그룹 폭을 1.5배 넘는 가로지르는 도형 불변
//  · 채워진 텍스트를 포함한 노드는 절대 제거하지 않음
function clusterBoxesByAxis(boxes, axis, gap) {
  const pos = axis === 'column' ? (b) => b.x : (b) => b.y;
  const len = axis === 'column' ? (b) => b.w : (b) => b.h;
  const sorted = [...boxes].sort((a, b) => pos(a) - pos(b));
  const buckets = [];
  let cur = [sorted[0]];
  let edge = pos(sorted[0]) + len(sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i];
    if (pos(b) > edge + gap) { buckets.push(cur); cur = [b]; edge = pos(b) + len(b); }
    else { cur.push(b); edge = Math.max(edge, pos(b) + len(b)); }
  }
  buckets.push(cur);
  return buckets;
}

function topLevelXfrm(node) {
  const spPr = firstChild(node, P_NS, 'spPr') || firstChild(node, P_NS, 'grpSpPr');
  const xfrm = spPr ? firstChild(spPr, A_NS, 'xfrm') : null;
  const off = xfrm ? firstChild(xfrm, A_NS, 'off') : null;
  const ext = xfrm ? firstChild(xfrm, A_NS, 'ext') : null;
  if (!off || !ext) return null;
  return {
    off,
    x: parseInt(attr(off, 'x') || '0', 10) / EMU_PER_PT,
    y: parseInt(attr(off, 'y') || '0', 10) / EMU_PER_PT,
    w: parseInt(attr(ext, 'cx') || '0', 10) / EMU_PER_PT,
    h: parseInt(attr(ext, 'cy') || '0', 10) / EMU_PER_PT,
  };
}

function subtreeCNvPrIds(node) {
  const ids = new Set();
  const list = node.getElementsByTagNameNS(P_NS, 'cNvPr');
  for (let i = 0; i < list.length; i++) {
    const id = list.item(i).getAttribute('id');
    if (id) ids.add(id);
  }
  return ids;
}

function adaptiveRegroup(spTree, boxes, slideW, slideH) {
  const geomBoxes = (boxes || []).filter(b => b.w > 0 && b.h > 0);
  if (geomBoxes.length < 4) return;

  // 열 우선, 불균형하면 행 — geminiMapper.detectSpatialGroups 와 동일 기준.
  // 둘 다 실패하면(좌측 레일의 세로로 긴 박스가 행들을 붙여버리는 패턴) 가장 큰 열 안에서
  // 행 재클러스터링 — "좌측 제목 레일 + 우측 카드 스택" 한국형 템플릿 대응.
  // 열 간격 8%: 매퍼(12%)보다 좁게 — 좌측 레일과 본문 영역 분리가 목적이라 민감해야 한다.
  const sizesOk = (bk) => bk.length >= 2 && Math.max(...bk.map(b => b.length)) <= Math.min(...bk.map(b => b.length)) * 3;
  const colBuckets = clusterBoxesByAxis(geomBoxes, 'column', slideW * 0.08);
  // 전략 체이닝: 한 전략이 빈 그룹을 못 찾으면 다음 전략 시도
  if (colBuckets.length >= 2 && sizesOk(colBuckets)
    && applySpatialAdaptation(spTree, geomBoxes, 'column', slideW, slideH, geomBoxes)) return;
  if (clusterBoxesByAxis(geomBoxes, 'row', slideH * 0.10).length >= 2
    && applySpatialAdaptation(spTree, geomBoxes, 'row', slideW, slideH, geomBoxes)) return;
  if (colBuckets.length >= 2) {
    const largest = colBuckets.reduce((a, b) => (b.length > a.length ? b : a));
    if (largest.length >= 4 && clusterBoxesByAxis(largest, 'row', slideH * 0.10).length >= 2) {
      applySpatialAdaptation(spTree, largest, 'row', slideW, slideH, geomBoxes);
    }
  }
}

// subsetBoxes 기준으로 그룹을 만들고, 빈 peer 그룹 제거 + 채워진 peer 그룹 균등 재배치.
// 교차축 영역 가드: subset 영역 밖(좌측 레일 등)의 도형은 건드리지 않는다.
function applySpatialAdaptation(spTree, subsetBoxes, axis, slideW, slideH, allBoxes = subsetBoxes) {
  const buckets = clusterBoxesByAxis(subsetBoxes, axis, axis === 'column' ? slideW * 0.08 : slideH * 0.10);
  if (buckets.length < 2) return false;

  const start = axis === 'column' ? (g) => g.x1 : (g) => g.y1;
  const end = axis === 'column' ? (g) => g.x2 : (g) => g.y2;
  const groups = buckets.map(bucket => ({
    filled: bucket.some(b => (b.text || '').trim()),
    x1: Math.min(...bucket.map(b => b.x)),
    y1: Math.min(...bucket.map(b => b.y)),
    x2: Math.max(...bucket.map(b => b.x + b.w)),
    y2: Math.max(...bucket.map(b => b.y + b.h)),
  }));

  // 동급(peer) 그룹 판정: 축 방향 크기가 중앙값의 0.6~1.67배
  const lens = groups.map(g => end(g) - start(g)).sort((a, b) => a - b);
  const median = lens[Math.floor(lens.length / 2)] || 1;
  groups.forEach(g => { g.peer = (end(g) - start(g)) >= median * 0.6 && (end(g) - start(g)) <= median * 1.67; });
  const peers = groups.filter(g => g.peer);
  const emptyPeers = peers.filter(g => !g.filled);
  const filledPeers = peers.filter(g => g.filled);
  if (peers.length < 2 || !emptyPeers.length || !filledPeers.length) return false;

  // 밴드: 각 그룹 구간을 이웃 중간점까지 확장 (정렬: clusterBoxesByAxis 가 보장)
  const bands = groups.map((g, gi) => ({
    s: gi > 0 ? (end(groups[gi - 1]) + start(g)) / 2 : start(g) - 12,
    e: gi < groups.length - 1 ? (end(g) + start(groups[gi + 1])) / 2 : end(g) + 12,
  }));

  // 새 위치: 채워진 peer 그룹을 peer 전체 구간에 균등 배치
  const peerSpanS = Math.min(...peers.map(start));
  const peerSpanE = Math.max(...peers.map(end));
  const filledSizes = filledPeers.map(g => end(g) - start(g));
  const totalSize = filledSizes.reduce((a, b) => a + b, 0);
  const gap = filledPeers.length > 1
    ? Math.max(0, (peerSpanE - peerSpanS - totalSize) / (filledPeers.length - 1))
    : 0;
  let cursor = filledPeers.length > 1 ? peerSpanS : peerSpanS + (peerSpanE - peerSpanS - totalSize) / 2;
  const deltaByGroup = new Map();
  groups.forEach((g, gi) => {
    if (!g.peer || !g.filled) return;
    deltaByGroup.set(gi, cursor - start(g));
    cursor += (end(g) - start(g)) + gap;
  });

  // 교차축 영역: peer 그룹들의 직교 방향 범위 (좌측 레일 등 영역 밖 도형 보호)
  const crossS = Math.min(...peers.map(g => (axis === 'column' ? g.y1 : g.x1)));
  const crossE = Math.max(...peers.map(g => (axis === 'column' ? g.y2 : g.x2)));

  const filledTextIds = new Set(
    allBoxes.filter(b => (b.text || '').trim())
      .map(b => String(b.shapeId || '').match(/sp(\d+)$/)?.[1])
      .filter(Boolean)
  );

  const topNodes = [];
  for (let i = 0; i < spTree.childNodes.length; i++) {
    const c = spTree.childNodes.item(i);
    if (c && c.nodeType === 1 && (c.localName === 'sp' || c.localName === 'pic' || c.localName === 'grpSp')) topNodes.push(c);
  }

  const slideArea = slideW * slideH;
  let removed = 0, shifted = 0;
  for (const node of topNodes) {
    const geom = topLevelXfrm(node);
    if (!geom || geom.w <= 0 || geom.h <= 0) continue;
    if (geom.w * geom.h > slideArea * 0.5) continue; // 배경급 도형 불변
    const crossCenter = axis === 'column' ? geom.y + geom.h / 2 : geom.x + geom.w / 2;
    if (crossCenter < crossS - 36 || crossCenter > crossE + 36) continue; // 영역 밖 도형 불변
    const center = axis === 'column' ? geom.x + geom.w / 2 : geom.y + geom.h / 2;
    const gi = bands.findIndex(band => center >= band.s && center <= band.e);
    if (gi < 0 || !groups[gi].peer) continue;
    const bandLen = end(groups[gi]) - start(groups[gi]);
    const extent = axis === 'column' ? geom.w : geom.h;
    if (extent > bandLen * 1.5) continue; // 그룹을 가로지르는 도형(제목띠 등) 불변

    if (!groups[gi].filled) {
      const ids = subtreeCNvPrIds(node);
      let hasFilled = false;
      for (const id of ids) if (filledTextIds.has(id)) { hasFilled = true; break; }
      if (hasFilled) continue;
      spTree.removeChild(node);
      removed++;
    } else {
      const delta = deltaByGroup.get(gi) || 0;
      if (Math.abs(delta) < 0.5) continue;
      if (axis === 'column') geom.off.setAttribute('x', String(Math.round((geom.x + delta) * EMU_PER_PT)));
      else geom.off.setAttribute('y', String(Math.round((geom.y + delta) * EMU_PER_PT)));
      shifted++;
    }
  }
  if (removed || shifted) {
    console.log(`[Renderer] 적응 재배치(${axis}): 빈 그룹 ${emptyPeers.length}개 정리(도형 ${removed}개 제거, ${shifted}개 이동)`);
  }
  return true;
}

function applyTextReplacements(slideXml, boxes, templateSlideIndex, slideSizePt = { w: 720, h: 540 }) {
  const map = new Map();
  for (const b of (boxes || [])) {
    if (b.text == null) continue;
    map.set(b.shapeId, b);
  }

  const doc = parseXml(slideXml);
  const sld = doc.documentElement;
  const cSld = firstChild(sld, P_NS, 'cSld');
  const spTree = cSld ? firstChild(cSld, P_NS, 'spTree') : null;
  if (!spTree) return slideXml;

  // Pass 1: Force-Clear (sz/color/rPr 보관 → r/fld/br 완전 삭제, 빈 r 삽입) + normAutofit 주입
  const savedStyles = sanitizeAllText(spTree, doc);

  // Pass 2: Unique Mapping — shapeId 당 1회만 주입 (이중 주입 버그 차단)
  // ⚠ pic 제거(Pass 2.5)는 반드시 이 루프 이후: 파서가 pic 도 counter++ 했으므로
  //   루프 중에 pic 노드가 살아있어야 counter 가 파서와 일치한다.
  const injected = new Set();
  let counter = 0;
  for (const node of walkSpAndPic(spTree)) {
    const ln = node.localName;
    if (ln === 'sp') {
      const cNvPrId = readCNvPrId(node);
      const id = `slide${templateSlideIndex}_sp${cNvPrId || counter}`;
      counter++;
      if (injected.has(id)) continue;
      const box = map.get(id);
      if (box) {
        injected.add(id);
        const savedStyle = cNvPrId ? (savedStyles.get(cNvPrId) || null) : null;
        replaceTextInShape(node, String(box.text || ''), box, savedStyle);
      }
    } else if (ln === 'pic') {
      counter++;
    }
  }

  // Pass 2.5: 텍스트 매핑 완료 후 sample 사진/그래프 <p:pic> 제거
  removeAllPicsFromSpTree(spTree, slideSizePt.w, slideSizePt.h);

  // Pass 3: graphicFrame(표/차트/SmartArt) 제거 — 템플릿 샘플 데이터 원천 차단
  removeAllGraphicFramesFromSpTree(spTree);

  // Pass 4: 적응형 재배치 — 빈 카드 그룹 제거 + 남은 카드 균등 재배치
  adaptiveRegroup(spTree, boxes, slideSizePt.w, slideSizePt.h);

  return serializeXml(doc);
}

// replaceTextInShape(spNode, newText, boxMeta?, savedStyle?)
// boxMeta:    { w, h, fontPt, maxChars } — 있으면 shrinkToFit 으로 폰트 크기를 XML 에 직접 기록.
// savedStyle: { sz, solidFillXml }      — Force-Clear 전 추출한 원본 폰트/색상 (복원용).
function replaceTextInShape(spNode, newText, boxMeta, savedStyle) {
  const txBody = firstChild(spNode, P_NS, 'txBody');
  if (!txBody) return;

  const allP = findChildren(txBody, A_NS, 'p');
  if (allP.length === 0) return;

  // 첫 번째로 실제 run 이 들어있는 단락의 서식을 템플릿으로 사용
  let templatePPr = null;
  let templateRPr = null;
  let templateEndParaRPr = null;
  for (const p of allP) {
    const r = firstChild(p, A_NS, 'r');
    if (r) {
      templatePPr = firstChild(p, A_NS, 'pPr');
      templateRPr = firstChild(r, A_NS, 'rPr');
      templateEndParaRPr = firstChild(p, A_NS, 'endParaRPr');
      break;
    }
  }
  // run 이 전혀 없는 박스(빈 placeholder)면 첫 단락의 pPr/endParaRPr 라도 활용
  if (!templateRPr) {
    const p0 = allP[0];
    templatePPr = templatePPr || firstChild(p0, A_NS, 'pPr');
    templateEndParaRPr = templateEndParaRPr || firstChild(p0, A_NS, 'endParaRPr');
  }

  // shrinkToFit: 텍스트가 박스를 넘치면 sz 를 줄여서 XML 에 직접 기록한다.
  // 이 값이 실제 PowerPoint 렌더링에 반영되므로 preview 와 PPT 가 일치.
  let computedSz = null;
  const MIN_READABLE_PT = 9; // 9pt 미만은 판독 불가 → 잘라냄
  if (newText && boxMeta && boxMeta.w > 0 && boxMeta.h > 0 && boxMeta.fontPt > 0) {
    // 박스 치수가 정확할 때 shrinkToFit 으로 최적 sz 계산
    const { fontSize } = shrinkToFit({
      text: newText, boxWidthPt: boxMeta.w, boxHeightPt: boxMeta.h, basePt: boxMeta.fontPt,
    });
    if (fontSize < MIN_READABLE_PT) {
      // 9pt 이하로 떨어지면: 9pt 기준으로 들어갈 수 있는 글자 수로 텍스트 잘라냄
      const innerW = Math.max(8, boxMeta.w - 12);
      const innerH = Math.max(8, boxMeta.h - 8);
      const cpl = Math.max(1, Math.floor(innerW / (MIN_READABLE_PT * 0.55)));
      const maxL = Math.max(1, Math.floor(innerH / (MIN_READABLE_PT * 1.3)));
      const limit = Math.max(4, cpl * maxL - 1);
      if (newText.length > limit) newText = newText.slice(0, limit - 1) + '…';
      computedSz = String(MIN_READABLE_PT * 100); // 900 = 9pt
    } else {
      computedSz = String(Math.round(fontSize * 100));
    }
  } else if (newText && boxMeta?.maxChars && newText.length > boxMeta.maxChars * 0.8) {
    // Auto-Shrink 폴백: char_budget 의 80% 초과 시 원본 sz 의 75% 로 강제 축소
    const baseSzStr = savedStyle?.sz || (boxMeta?.fontPt ? String(Math.round(boxMeta.fontPt * 100)) : null);
    if (baseSzStr) {
      const baseSz = parseInt(baseSzStr, 10);
      if (baseSz > 0) computedSz = String(Math.round(Math.max(900, baseSz * 0.75)));
    }
  }

  // noAutofit 유지: shrinkToFit이 계산한 sz(폰트 크기)가 이미 박스에 맞게 설정됐으므로
  // normAutofit 필요 없음. normAutofit은 PDF 변환기가 무시해 잘림을 유발하므로 제거.
  const bodyPr = firstChild(txBody, A_NS, 'bodyPr');
  if (bodyPr) {
    for (const tag of ['spAutoFit', 'normAutofit']) {
      const existing = firstChild(bodyPr, A_NS, tag);
      if (existing) bodyPr.removeChild(existing);
    }
    if (!firstChild(bodyPr, A_NS, 'noAutofit')) {
      bodyPr.appendChild(txBody.ownerDocument.createElementNS(A_NS, 'a:noAutofit'));
    }
  }

  // 기존 단락 모두 제거 (<a:bodyPr>, <a:lstStyle> 등은 보존)
  for (const p of allP) {
    if (p.parentNode === txBody) txBody.removeChild(p);
  }

  const doc = txBody.ownerDocument;
  const lines = String(newText).split(/\r?\n/);
  // 빈 텍스트 케이스: 빈 <a:r> 을 넣어 레이아웃 prompt text fallback 을 억제.
  // (endParaRPr 만 두면 PowerPoint 가 슬라이드 레이아웃의 "제목을 입력해주세요" 등을 fallback 표시)
  // Force-Clear 로 삽입된 빈 <a:rPr/> 를 templateRPr 로 쓰면 폰트 정보가 사라짐.
  // savedStyle.rPrClone = Force-Clear 전 원본 rPr 딥클론 → 이를 최우선으로 사용.
  const buildRPr = () => {
    if (savedStyle?.rPrClone) return savedStyle.rPrClone.cloneNode(true);
    // templateRPr 가 실제 내용을 가진 경우에만 사용 (빈 placeholder 제외)
    if (templateRPr && (templateRPr.attributes?.length > 0 || templateRPr.childNodes?.length > 0)) {
      return templateRPr.cloneNode(true);
    }
    // 최후 fallback: 빈 rPr 에 sz 만이라도 복원
    const fallback = doc.createElementNS(A_NS, 'a:rPr');
    if (savedStyle?.sz) fallback.setAttribute('sz', savedStyle.sz);
    return fallback;
  };

  if (lines.length === 1 && lines[0] === '') {
    const pEl = doc.createElementNS(A_NS, 'a:p');
    if (templatePPr) pEl.appendChild(templatePPr.cloneNode(true));
    const rEl = doc.createElementNS(A_NS, 'a:r');
    rEl.appendChild(buildRPr());
    rEl.appendChild(doc.createElementNS(A_NS, 'a:t'));
    pEl.appendChild(rEl);
    if (templateEndParaRPr) pEl.appendChild(templateEndParaRPr.cloneNode(true));
    txBody.appendChild(pEl);
    return;
  }

  for (const line of lines) {
    const pEl = doc.createElementNS(A_NS, 'a:p');
    if (templatePPr) pEl.appendChild(templatePPr.cloneNode(true));
    const rEl = doc.createElementNS(A_NS, 'a:r');
    const rPrClone = buildRPr();
    if (computedSz) rPrClone.setAttribute('sz', computedSz);
    rEl.appendChild(rPrClone);
    const tEl = doc.createElementNS(A_NS, 'a:t');
    if (line.length > 0) tEl.appendChild(doc.createTextNode(line));
    rEl.appendChild(tEl);
    pEl.appendChild(rEl);
    if (templateEndParaRPr) pEl.appendChild(templateEndParaRPr.cloneNode(true));
    txBody.appendChild(pEl);
  }
}

// ── 메인 진입점 ─────────────────────────────────────────────────────────────
/**
 * @param {Array} deck — geminiMapper.mapDeck() 결과
 * @param {Buffer} originalBuffer — 사용자가 업로드한 PPTX 원본
 * @returns {Promise<Buffer>}
 */
export async function renderDeckInPlace(deck, originalBuffer) {
  const zip = await JSZip.loadAsync(originalBuffer);

  // 1) presentation.xml / rels / [Content_Types].xml 로드
  const presPath = 'ppt/presentation.xml';
  const presXml = await zip.file(presPath)?.async('string');
  if (!presXml) throw new Error('유효한 PPTX 가 아닙니다 (presentation.xml 없음)');
  const presDoc = parseXml(presXml);

  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  const presRelsXml = await zip.file(presRelsPath)?.async('string');
  if (!presRelsXml) throw new Error('presentation.xml.rels 가 없습니다');
  const presRelsDoc = parseXml(presRelsXml);

  const ctPath = '[Content_Types].xml';
  const ctXml = await zip.file(ctPath)?.async('string');
  if (!ctXml) throw new Error('[Content_Types].xml 가 없습니다');
  const ctDoc = parseXml(ctXml);

  // 슬라이드 크기(pt) — 적응형 재배치의 클러스터 간격 기준
  const sldSz = firstChild(presDoc.documentElement, P_NS, 'sldSz');
  const slideSizePt = {
    w: parseInt(attr(sldSz, 'cx') || '9144000', 10) / EMU_PER_PT,
    h: parseInt(attr(sldSz, 'cy') || '6858000', 10) / EMU_PER_PT,
  };

  // 2) sldIdLst 와 슬라이드 rId → 파일 경로 매핑
  const sldIdLst = firstChild(presDoc.documentElement, P_NS, 'sldIdLst');
  if (!sldIdLst) throw new Error('sldIdLst 가 없습니다');
  const sldIdNodes = findChildren(sldIdLst, P_NS, 'sldId');

  const relsRoot = presRelsDoc.documentElement;
  const allRelNodes = directChildrenByLocalName(relsRoot, 'Relationship');
  const ridToTarget = {};
  const ridToType = {};
  for (const r of allRelNodes) {
    ridToTarget[r.getAttribute('Id')] = r.getAttribute('Target');
    ridToType[r.getAttribute('Id')] = r.getAttribute('Type');
  }

  // 템플릿 슬라이드를 sldIdLst 순서로 수집 (parsePptxLayout 의 인덱스와 일치하지는 않지만
  // 둘 다 'slide 파일명 숫자 오름차순' 으로 정렬되므로 결과적으로 일치)
  const tplSlides = [];
  for (const sldId of sldIdNodes) {
    const rid = sldId.getAttributeNS(R_NS, 'id') || sldId.getAttribute('r:id');
    const target = ridToTarget[rid];
    if (!target) continue;
    const sourceFile = ('ppt/' + target.replace(/^\.\.\//, '').replace(/^\//, '')).replace(/\\/g, '/');
    const sourceXml = await zip.file(sourceFile)?.async('string');
    if (!sourceXml) continue;
    const baseName = sourceFile.match(/slides\/(slide\d+)\.xml$/)?.[1];
    const sourceRelsFile = baseName ? `ppt/slides/_rels/${baseName}.xml.rels` : null;
    const sourceRelsXml = sourceRelsFile ? (await zip.file(sourceRelsFile)?.async('string')) || null : null;
    tplSlides.push({ rid, target, sourceFile, sourceRelsFile, sourceXml, sourceRelsXml });
  }
  if (tplSlides.length === 0) throw new Error('템플릿에 슬라이드가 없습니다');

  // 3) parsePptxLayout 은 슬라이드 파일명 숫자 오름차순으로 정렬 → 동일 정렬을 보장
  tplSlides.sort((a, b) => {
    const na = parseInt(a.sourceFile.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    const nb = parseInt(b.sourceFile.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    return na - nb;
  });

  // 4) 다음 사용 가능한 rId / sldId 번호 계산
  let maxRidNum = 0;
  for (const r of allRelNodes) {
    const m = r.getAttribute('Id')?.match(/^rId(\d+)$/);
    if (m) maxRidNum = Math.max(maxRidNum, parseInt(m[1], 10));
  }
  let nextRid = maxRidNum + 1;
  let maxSldId = 255;
  for (const sld of sldIdNodes) {
    const id = parseInt(sld.getAttribute('id') || '0', 10);
    if (id > maxSldId) maxSldId = id;
  }
  let nextSldId = maxSldId + 1;

  // 5) 기존 slideN.xml / _rels 파일 모두 제거 (재발급)
  for (const t of tplSlides) {
    zip.remove(t.sourceFile);
    if (t.sourceRelsFile && t.sourceRelsXml) zip.remove(t.sourceRelsFile);
  }

  // 5-b) 슬라이드 레이아웃/마스터 텍스트 초기화.
  // 템플릿에 "템플릿 1" 같은 워터마크 텍스트가 레이아웃/마스터 XML에 있으면 모든 슬라이드에 표시됨.
  // ph(placeholder) 없는 sp의 텍스트만 Force-Clear (placeholder는 슬라이드 컨텐츠 영역이라 유지).
  const layoutMasterRE = /^ppt\/(slideLayouts\/slideLayout|slideMasters\/slideMaster)\d+\.xml$/;
  for (const filePath of Object.keys(zip.files)) {
    if (!layoutMasterRE.test(filePath)) continue;
    const lmXml = await zip.file(filePath)?.async('string');
    if (!lmXml) continue;
    const lmDoc = parseXml(lmXml);
    const cSld = firstChild(lmDoc.documentElement, P_NS, 'cSld');
    const spTree = cSld ? firstChild(cSld, P_NS, 'spTree') : null;
    if (!spTree) continue;
    for (const node of walkSpAndPic(spTree)) {
      if (node.localName !== 'sp') continue;
      const txBody = firstChild(node, P_NS, 'txBody');
      if (!txBody) continue;
      const nvSpPr = firstChild(node, P_NS, 'nvSpPr');
      const nvPr   = nvSpPr ? firstChild(nvSpPr, P_NS, 'nvPr') : null;
      const ph     = nvPr   ? firstChild(nvPr, P_NS, 'ph')     : null;
      if (ph && !WATERMARK_RE.test(readTxBodyText(txBody))) continue;
      for (const p of directChildrenByLocalName(txBody, 'p')) {
        const toRemove = [];
        for (let k = 0; k < p.childNodes.length; k++) {
          const c = p.childNodes.item(k);
          if (c && c.nodeType === 1 && (c.localName === 'r' || c.localName === 'fld' || c.localName === 'br')) {
            toRemove.push(c);
          }
        }
        for (const c of toRemove) p.removeChild(c);
        const emptyR = lmDoc.createElementNS(A_NS, 'a:r');
        emptyR.appendChild(lmDoc.createElementNS(A_NS, 'a:rPr'));
        emptyR.appendChild(lmDoc.createElementNS(A_NS, 'a:t'));
        const endParaRPr = firstChild(p, A_NS, 'endParaRPr');
        if (endParaRPr) p.insertBefore(emptyR, endParaRPr);
        else p.appendChild(emptyR);
      }
    }
    zip.file(filePath, serializeXml(lmDoc));
  }

  // 6) Slide Pruning: boxes 가 있는데 모두 비어있는 슬라이드 제외 (이미지 전용 슬라이드는 유지)
  const activeDeck = deck.filter(slidePlan => {
    const boxes = slidePlan.boxes || [];
    if (boxes.length === 0) return true;
    return boxes.some(b => b.text && String(b.text).trim().length > 0);
  });
  if (activeDeck.length < deck.length) {
    console.log(`[Renderer] Slide Pruning: ${deck.length - activeDeck.length}개 빈 슬라이드 제외 → ${activeDeck.length}장`);
  }

  // 각 deck 항목을 새 슬라이드 파일로 작성
  const newSlideMeta = []; // { rid, target, sldIdNum, partName }
  for (let i = 0; i < activeDeck.length; i++) {
    const slidePlan = activeDeck[i];
    const tplIdx = Math.min(slidePlan.templateSlideIndex || 0, tplSlides.length - 1);
    const src = tplSlides[tplIdx];
    const newNum = i + 1;
    const newPath = `ppt/slides/slide${newNum}.xml`;
    const newRelsPath = `ppt/slides/_rels/slide${newNum}.xml.rels`;

    const modifiedXml = applyTextReplacements(src.sourceXml, slidePlan.boxes || [], tplIdx, slideSizePt);
    zip.file(newPath, modifiedXml);
    if (src.sourceRelsXml) zip.file(newRelsPath, src.sourceRelsXml);

    newSlideMeta.push({
      rid: `rId${nextRid++}`,
      target: `slides/slide${newNum}.xml`,
      sldIdNum: nextSldId++,
      partName: `/ppt/slides/slide${newNum}.xml`,
    });
  }

  // 7) presentation.xml.rels 갱신: 슬라이드 타입 rels 만 교체
  // 기존 슬라이드 Relationship 을 in-place 수정/추가/제거하여 네임스페이스 손상 회피.
  const oldSlideRels = allRelNodes.filter(r => ridToType[r.getAttribute('Id')] === REL_TYPE_SLIDE);
  for (let i = 0; i < newSlideMeta.length; i++) {
    const ns = newSlideMeta[i];
    let rel = oldSlideRels[i];
    if (!rel) {
      rel = (oldSlideRels[0] || allRelNodes[0]).cloneNode(false);
      relsRoot.appendChild(rel);
    }
    rel.setAttribute('Id', ns.rid);
    rel.setAttribute('Type', REL_TYPE_SLIDE);
    rel.setAttribute('Target', ns.target);
  }
  // 남는 기존 슬라이드 rel 제거
  for (let i = newSlideMeta.length; i < oldSlideRels.length; i++) {
    relsRoot.removeChild(oldSlideRels[i]);
  }
  zip.file(presRelsPath, serializeXml(presRelsDoc));

  // 8) sldIdLst 갱신: 동일하게 in-place 로 갱신 (r:id 네임스페이스 보존)
  for (let i = 0; i < newSlideMeta.length; i++) {
    const ns = newSlideMeta[i];
    let sldId = sldIdNodes[i];
    if (!sldId) {
      sldId = sldIdNodes[0].cloneNode(false);
      sldIdLst.appendChild(sldId);
    }
    sldId.setAttribute('id', String(ns.sldIdNum));
    // r:id 는 NS-aware 로 갱신 (qualified name 으로 set 하면 xmldom 이 NS 없이 저장하기도 함)
    if (sldId.hasAttributeNS(R_NS, 'id')) sldId.removeAttributeNS(R_NS, 'id');
    if (sldId.hasAttribute('r:id')) sldId.removeAttribute('r:id');
    sldId.setAttributeNS(R_NS, 'r:id', ns.rid);
  }
  for (let i = newSlideMeta.length; i < sldIdNodes.length; i++) {
    sldIdLst.removeChild(sldIdNodes[i]);
  }
  zip.file(presPath, serializeXml(presDoc));

  // 9) [Content_Types].xml 갱신: 슬라이드 Override in-place 수정/추가/제거
  const ctRoot = ctDoc.documentElement;
  const overrideNodes = directChildrenByLocalName(ctRoot, 'Override');
  const slideOverrides = overrideNodes.filter(o =>
    o.getAttribute('ContentType') === CT_SLIDE &&
    /^\/ppt\/slides\/slide\d+\.xml$/.test(o.getAttribute('PartName') || '')
  );
  for (let i = 0; i < newSlideMeta.length; i++) {
    const ns = newSlideMeta[i];
    let ov = slideOverrides[i];
    if (!ov) {
      ov = (slideOverrides[0] || overrideNodes[0]).cloneNode(false);
      ctRoot.appendChild(ov);
    }
    ov.setAttribute('PartName', ns.partName);
    ov.setAttribute('ContentType', CT_SLIDE);
  }
  for (let i = newSlideMeta.length; i < slideOverrides.length; i++) {
    ctRoot.removeChild(slideOverrides[i]);
  }
  zip.file(ctPath, serializeXml(ctDoc));

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
