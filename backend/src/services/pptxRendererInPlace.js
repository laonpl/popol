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

    // ③ normAutofit 강제 주입 (Auto-Shrink 안전망)
    const bodyPr = firstChild(txBody, A_NS, 'bodyPr');
    if (bodyPr) {
      for (const tag of ['spAutoFit', 'noAutofit', 'normAutofit']) {
        const ex = firstChild(bodyPr, A_NS, tag);
        if (ex) bodyPr.removeChild(ex);
      }
      bodyPr.appendChild(doc.createElementNS(A_NS, 'a:normAutofit'));
    }
  }
  return savedStyles;
}

// ── 사진 제거 ──────────────────────────────────────────────────────────────────
// 사용자가 웅로드한 템플릿의 sample 이미지(프로필 사진, 샘플 로고 등)가 출력물에 남지
// 않도록 슬라이드의 모든 <p:pic> 논드를 제거. 디자인은 배경/장식 도형(<p:sp>) /
// 레이아웃·마스터의 색·폰트로 보존되므로 큐레이터리시 틀이 크지 않다.
function removeAllPicsFromSpTree(spTree) {
  const toRemove = [];
  const collectFromGroup = (group) => {
    for (let i = 0; i < group.childNodes.length; i++) {
      const c = group.childNodes.item(i);
      if (!c || c.nodeType !== 1) continue;
      if (c.localName === 'pic') toRemove.push(c);
      else if (c.localName === 'grpSp') collectFromGroup(c);
    }
  };
  collectFromGroup(spTree);
  for (const pic of toRemove) {
    if (pic.parentNode) pic.parentNode.removeChild(pic);
  }
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

function applyTextReplacements(slideXml, boxes, templateSlideIndex) {
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

  // Pass 2.5: 텍스트 매핑 완료 후 sample 사진 <p:pic> 제거
  removeAllPicsFromSpTree(spTree);

  // Pass 3: graphicFrame(표/차트/SmartArt) 제거 — 템플릿 샘플 데이터 원천 차단
  removeAllGraphicFramesFromSpTree(spTree);

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
  if (newText && boxMeta && boxMeta.w > 0 && boxMeta.h > 0 && boxMeta.fontPt > 0) {
    // 박스 치수가 정확할 때 shrinkToFit 으로 최적 sz 계산
    const { fontSize } = shrinkToFit({
      text: newText, boxWidthPt: boxMeta.w, boxHeightPt: boxMeta.h, basePt: boxMeta.fontPt,
    });
    computedSz = String(Math.round(Math.max(6, fontSize) * 100));
  } else if (newText && boxMeta?.maxChars && newText.length > boxMeta.maxChars * 0.8) {
    // Auto-Shrink 폴백: char_budget 의 80% 초과 시 원본 sz 의 75% 로 강제 축소
    const baseSzStr = savedStyle?.sz || (boxMeta?.fontPt ? String(Math.round(boxMeta.fontPt * 100)) : null);
    if (baseSzStr) {
      const baseSz = parseInt(baseSzStr, 10);
      if (baseSz > 0) computedSz = String(Math.round(Math.max(600, baseSz * 0.75)));
    }
  }

  // <a:bodyPr> 에 normAutofit 주입: 텍스트가 박스를 초과할 경우 PowerPoint 가
  // 자동으로 폰트를 추가 축소하도록 보장 (shrinkToFit 추정 오차의 안전망).
  const bodyPr = firstChild(txBody, A_NS, 'bodyPr');
  if (bodyPr) {
    // 기존 spAutoFit / noAutofit 제거 후 normAutofit 삽입 (newText 유무 무관)
    for (const tag of ['spAutoFit', 'noAutofit', 'normAutofit']) {
      const existing = firstChild(bodyPr, A_NS, tag);
      if (existing) bodyPr.removeChild(existing);
    }
    bodyPr.appendChild(txBody.ownerDocument.createElementNS(A_NS, 'a:normAutofit'));
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

    const modifiedXml = applyTextReplacements(src.sourceXml, slidePlan.boxes || [], tplIdx);
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
