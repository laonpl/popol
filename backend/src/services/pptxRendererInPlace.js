// 업로드된 원본 PPTX 의 ZIP/XML을 보존한 채 텍스트만 치환한다.
// 기존 pptxgenjs 재렌더링은 그라디언트, 그룹 도형, 표/차트, 마스터 상속 등을
// 잃었기 때문에 원본 디자인을 100% 유지하려면 이 in-place 방식이 필요하다.
//
// deck 길이가 템플릿 슬라이드 수보다 많으면 원본 슬라이드를 복제해 늘린다.
// 적으면 사용한 슬라이드만 남긴다(unused slide 는 결과물에서 제거).

import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

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
function directChildrenByLocalName(parent, localName) {
  const out = [];
  if (!parent) return out;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const c = parent.childNodes.item(i);
    if (c && c.nodeType === 1 && c.localName === localName) out.push(c);
  }
  return out;
}

// ── 텍스트 치환 ─────────────────────────────────────────────────────────────
// 슬라이드 XML 내 <p:sp> 를 templateParser 와 동일한 순서로 순회하며 shapeId 를
// 부여하고, deck 의 box.text 가 있으면 해당 sp 의 <p:txBody> 안 텍스트만 교체한다.
// 도형/이미지/테마/마스터 등은 일절 건드리지 않는다.
function applyTextReplacements(slideXml, boxes, templateSlideIndex) {
  if (!boxes || boxes.length === 0) return slideXml;
  const map = new Map();
  for (const b of boxes) {
    // text가 null/undefined이거나 빈 문자열이면 원본 유지 (원본 내용 보존)
    if (!b.text) continue;
    map.set(b.shapeId, b);
  }
  if (map.size === 0) return slideXml;

  const doc = parseXml(slideXml);
  const sld = doc.documentElement;
  const cSld = firstChild(sld, P_NS, 'cSld');
  const spTree = cSld ? firstChild(cSld, P_NS, 'spTree') : null;
  if (!spTree) return slideXml;

  // templateParser 와 같은 카운팅 규칙: spTree 의 직계 child 중 sp/pic 만 ++.
  let counter = 0;
  for (let i = 0; i < spTree.childNodes.length; i++) {
    const node = spTree.childNodes.item(i);
    if (!node || node.nodeType !== 1) continue;
    const ln = node.localName;
    if (ln === 'sp') {
      const id = `slide${templateSlideIndex}_s${counter}`;
      counter++;
      const box = map.get(id);
      if (box) replaceTextInShape(node, String(box.text || ''));
    } else if (ln === 'pic') {
      counter++;
    }
  }

  return serializeXml(doc);
}

// <p:sp>/<p:txBody> 안의 모든 <a:p> 를 찾아, 첫 단락의 첫 run 서식을 보존한 채
// 새 텍스트로 단락을 재구성한다. <a:bodyPr>, <a:lstStyle> 같은 형제 요소와
// 도형 자체의 회전/위치/크기/스타일은 그대로 유지된다.
function replaceTextInShape(spNode, newText) {
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

  // 기존 단락 모두 제거 (<a:bodyPr>, <a:lstStyle> 등은 보존)
  for (const p of allP) {
    if (p.parentNode === txBody) txBody.removeChild(p);
  }

  const doc = txBody.ownerDocument;
  const lines = String(newText).split(/\r?\n/);
  // 빈 텍스트 케이스: 단락 한 개에 endParaRPr 만 둔다 (원본 빈 텍스트 박스와 동일)
  if (lines.length === 1 && lines[0] === '') {
    const pEl = doc.createElementNS(A_NS, 'a:p');
    if (templatePPr) pEl.appendChild(templatePPr.cloneNode(true));
    if (templateEndParaRPr) pEl.appendChild(templateEndParaRPr.cloneNode(true));
    txBody.appendChild(pEl);
    return;
  }

  for (const line of lines) {
    const pEl = doc.createElementNS(A_NS, 'a:p');
    if (templatePPr) pEl.appendChild(templatePPr.cloneNode(true));
    const rEl = doc.createElementNS(A_NS, 'a:r');
    if (templateRPr) rEl.appendChild(templateRPr.cloneNode(true));
    const tEl = doc.createElementNS(A_NS, 'a:t');
    if (line.length > 0) tEl.appendChild(doc.createTextNode(line));
    rEl.appendChild(tEl);
    pEl.appendChild(rEl);
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

  // 6) 각 deck 항목을 새 슬라이드 파일로 작성
  const newSlideMeta = []; // { rid, target, sldIdNum, partName }
  for (let i = 0; i < deck.length; i++) {
    const slidePlan = deck[i];
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
