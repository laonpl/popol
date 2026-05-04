import { extractFields, shorten, smartBullets, strip } from './textUtils';
import api from '../services/api';

const DEFAULT_SECTIONS = ['프로필 요약', '핵심 역량', '프로젝트 경험', '링크형 섹션 상세', '성과 및 마무리'];

function decodeXmlText(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

  function encodeXmlText(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

function normalizeExtractedLine(text) {
  return strip(String(text || '').replace(/\s+/g, ' ')).trim();
}

function pickSectionTitle(text, fallback) {
  const candidates = String(text || '')
    .split(/\n+/)
    .map(normalizeExtractedLine)
    .filter(Boolean)
    .filter(line => line.length >= 2 && line.length <= 70);
  return shorten(candidates[0] || fallback, 48);
}

function extractSlideText(xml) {
  return [...String(xml || '').matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
    .map(match => decodeXmlText(match[1]))
    .map(normalizeExtractedLine)
    .filter(Boolean)
    .join('\n');
}

function countTextParagraphs(xml) {
  return [...String(xml || '').matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)]
    .filter(match => extractSlideText(match[0]))
    .length;
}

// 장식용/구조용 텍스트인지 판단 (교체 대상에서 제외)
function isStructuralText(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/^\d{1,3}$/.test(t)) return true;          // 순수 숫자: 01, 02, 3
  if (/^[A-Za-z]$/.test(t)) return true;         // 낱글자 장식
  if (/^Q\d+$/.test(t)) return true;             // Q0, Q1 등 슬라이드 번호
  if (/^[A-Z]\d+[.:)]?$/.test(t)) return true;  // A1, B2: 등 섹션 번호
  if (t.length <= 2) return true;                // 너무 짧은 장식 텍스트
  return false;
}

// EMU(914400 / inch, 12700 / pt) → pt 변환
function emuToPt(emu) {
  const n = Number(emu);
  return Number.isFinite(n) ? Math.round((n / 12700) * 10) / 10 : 0;
}

// p:sp 또는 a:tc 단편에서 a:xfrm 좌표/크기 추출
function extractGeometry(fragment) {
  const offMatch = fragment.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"\s*\/>/);
  const extMatch = fragment.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
  return {
    x_pt: offMatch ? emuToPt(offMatch[1]) : null,
    y_pt: offMatch ? emuToPt(offMatch[2]) : null,
    width_pt: extMatch ? emuToPt(extMatch[1]) : null,
    height_pt: extMatch ? emuToPt(extMatch[2]) : null,
  };
}

// shape 크기 + 원본 폰트 크기로 실제 적정 글자수 한도 추정
// 한글 1자 폭 ≈ font_size * 1.0pt, 줄높이 ≈ font_size * 1.35pt
function estimateCharBudget(geom, fontSizeHundredths) {
  const w = geom?.width_pt;
  const h = geom?.height_pt;
  if (!w || !h) return 28;
  const fs = fontSizeHundredths ? fontSizeHundredths / 100 : 18; // 기본 18pt 가정
  const charWidth = Math.max(6, fs * 1.0);
  const lineHeight = Math.max(8, fs * 1.35);
  const perLine = Math.max(2, Math.floor((w - 4) / charWidth));
  const lines = Math.max(1, Math.floor(h / lineHeight));
  // 박스에 어느 정도 여백을 두기 위해 0.85배 적용
  return Math.max(6, Math.min(Math.floor(perLine * lines * 0.85), 200));
}

// 원본 shape의 첫 번째 <a:rPr ... /> 또는 <a:rPr ...></a:rPr> 를 캡처해 새 단락 작성 시 재사용
// → 폰트 face, 크기(sz), 색상, bold 등 디자인이 유지된다.
function captureFirstRPr(fragment) {
  const m = String(fragment || '').match(/<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/);
  return m ? m[0] : null;
}

// 첫 번째 단락의 <a:pPr ... /> (정렬·indent) 캡처
function captureFirstPPr(fragment) {
  const m = String(fragment || '').match(/<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/);
  return m ? m[0] : null;
}

// 원본 rPr에서 sz 값을 추출 (1/100 pt 단위)
function extractRPrFontSize(rPrXml) {
  if (!rPrXml) return null;
  const m = rPrXml.match(/\bsz="(\d+)"/);
  return m ? Number(m[1]) : null;
}

// 추론된 역할(역할명만, 텍스트 분량 상이) — Gemini 프롬프트와 동기화
function inferRoleHint(geom, phType, originalText, isTable) {
  if (isTable) return 'Table Cell';
  if (phType === 'title' || phType === 'ctrtitle') return 'Main Title';
  if (phType === 'subtitle') return 'Subtitle';
  const w = geom?.width_pt || 0;
  const h = geom?.height_pt || 0;
  const y = geom?.y_pt || 0;
  if (h && w) {
    if (w > 380 && h < 70 && y < 120) return 'Main Title';
    if (w < 200 && h < 60) return 'Tag/Metric';
    if (h > 180) return 'Body / Troubleshooting';
    if (w > 300 && h > 80) return 'Body';
    return 'Subtext';
  }
  if (originalText && originalText.length > 80) return 'Body';
  return 'Subtext';
}

// 교체 가능한 shape을 우선순위/지오메트리와 함께 추출
// 각 shape에 안정 shape_id (slide 내 인덱스) 부여
function extractReplaceableShapes(xml) {
  const xmlStr = String(xml || '');
  const shapes = [];
  let nextId = 1;

  for (const m of xmlStr.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)) {
    const text = extractSlideText(m[0]);
    if (!text || isStructuralText(text)) continue;
    const phMatch = m[0].match(/<p:ph([^>]*?)\/?>/);
    const phAttrs = phMatch ? phMatch[1] : '';
    const phType = (phAttrs.match(/type="([^"]+)"/)?.[1] || '').toLowerCase();
    const phIdx = Number(phAttrs.match(/idx="([^"]+)"/)?.[1] || 99);
    let priority;
    if (phType === 'title' || phType === 'ctrtitle') priority = 0;
    else if (phType === 'subtitle') priority = 1;
    else if (phMatch && (phType === 'body' || !phType)) priority = 10 + phIdx;
    else if (phMatch) priority = 20 + phIdx;
    else priority = 50;
    const geom = extractGeometry(m[0]);
    const rPr = captureFirstRPr(m[0]);
    const pPr = captureFirstPPr(m[0]);
    const sz = extractRPrFontSize(rPr);
    shapes.push({
      type: 'sp',
      shape_id: nextId++,
      matchStart: m.index,
      matchEnd: m.index + m[0].length,
      originalText: text,
      priority,
      geom,
      phType: phType || '',
      role_hint: inferRoleHint(geom, phType, text, false),
      char_budget: estimateCharBudget(geom, sz),
      rPrTemplate: rPr,
      pPrTemplate: pPr,
      origFontSizeHundredths: sz,
    });
  }

  for (const m of xmlStr.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)) {
    const text = extractSlideText(m[0]);
    if (!text || isStructuralText(text)) continue;
    const rPr = captureFirstRPr(m[0]);
    const pPr = captureFirstPPr(m[0]);
    const sz = extractRPrFontSize(rPr);
    shapes.push({
      type: 'tc',
      shape_id: nextId++,
      matchStart: m.index,
      matchEnd: m.index + m[0].length,
      originalText: text,
      priority: 100,
      geom: { x_pt: null, y_pt: null, width_pt: null, height_pt: null },
      phType: '',
      role_hint: 'Table Cell',
      char_budget: sz ? Math.max(6, Math.floor(20 - sz / 100 / 2)) : 18,
      rPrTemplate: rPr,
      pPrTemplate: pPr,
      origFontSizeHundredths: sz,
    });
  }

  return shapes;
}

// AI에 전달할 슬라이드 레이아웃 지도 — 디자인(지오메트리)만 포함, 기존 템플릿 텍스트는 절대 포함하지 않음
// shape_id 순서는 safelyReplaceSlideTextDom 의 DOM 순회와 정확히 일치해야 함.
function buildSlideLayoutMap(xml, slideIndex) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'application/xml');
  const shapesOut = [];
  let shapeId = 0;

  const collectText = (el) => {
    const ts = el.getElementsByTagNameNS(NS_A, 't');
    let s = '';
    for (let i = 0; i < ts.length; i++) s += ts[i].textContent || '';
    return s.replace(/\s+/g, ' ').trim();
  };

  const readGeometry = (el) => {
    const off = el.getElementsByTagNameNS(NS_A, 'off')[0];
    const ext = el.getElementsByTagNameNS(NS_A, 'ext')[0];
    return {
      x_pt: off ? emuToPt(off.getAttribute('x')) : null,
      y_pt: off ? emuToPt(off.getAttribute('y')) : null,
      width_pt: ext ? emuToPt(ext.getAttribute('cx')) : null,
      height_pt: ext ? emuToPt(ext.getAttribute('cy')) : null,
    };
  };

  const firstRPrSize = (el) => {
    const rPrs = el.getElementsByTagNameNS(NS_A, 'rPr');
    for (let i = 0; i < rPrs.length; i++) {
      const sz = rPrs[i].getAttribute('sz');
      if (sz) return Number(sz);
    }
    return null;
  };

  const sps = Array.from(xmlDoc.getElementsByTagNameNS(NS_P, 'sp'));
  for (const sp of sps) {
    const text = collectText(sp);
    if (!text || isStructuralText(text)) continue;
    shapeId += 1;
    const ph = sp.getElementsByTagNameNS(NS_P, 'ph')[0];
    const phType = (ph?.getAttribute('type') || '').toLowerCase();
    const geom = readGeometry(sp);
    const sz = firstRPrSize(sp);
    shapesOut.push({
      shape_id: shapeId,
      role_hint: inferRoleHint(geom, phType, text, false),
      width_pt: geom.width_pt,
      height_pt: geom.height_pt,
      x_pt: geom.x_pt,
      y_pt: geom.y_pt,
      char_budget: estimateCharBudget(geom, sz),
      original_font_size_pt: sz ? Math.round(sz / 100) : null,
    });
  }

  const tcs = Array.from(xmlDoc.getElementsByTagNameNS(NS_A, 'tc'));
  for (const tc of tcs) {
    const text = collectText(tc);
    if (!text || isStructuralText(text)) continue;
    shapeId += 1;
    const sz = firstRPrSize(tc);
    shapesOut.push({
      shape_id: shapeId,
      role_hint: 'Table Cell',
      width_pt: null,
      height_pt: null,
      x_pt: null,
      y_pt: null,
      char_budget: sz ? Math.max(6, Math.floor(20 - sz / 100 / 2)) : 18,
      original_font_size_pt: sz ? Math.round(sz / 100) : null,
    });
  }

  return { slideIndex, textBoxCount: shapesOut.length || 1, shapes: shapesOut };
}

// 교체 대상 shape 수 카운트 (p:sp 도형 + a:tc 테이블 셀)
function countTextShapes(xml) {
  return extractReplaceableShapes(xml).length || 1;
}

function cleanLine(line) {
  return strip(String(line || ''))
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*•]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^슬라이드\s*\d+\s*[:.-]?\s*/i, '')
    .trim();
}

function listText(values, max = 9) {
  return values.filter(Boolean).slice(0, max).join(' · ');
}

function skillNames(portfolio, max = 99) {
  const skills = portfolio.skills || {};
  return [...(skills.languages || []), ...(skills.frameworks || []), ...(skills.tools || []), ...(skills.others || [])]
    .map(skill => typeof skill === 'string' ? skill : skill?.name)
    .filter(Boolean)
    .slice(0, max);
}

function contactLines(portfolio) {
  const contact = portfolio.contact || {};
  return [contact.email, contact.phone, contact.github, contact.website || contact.linkedin || contact.instagram].filter(Boolean);
}

function experienceTitle(exp, idx) {
  return exp.title || exp.company || exp.name || exp.organization || `프로젝트 ${idx + 1}`;
}

function impactText(exp, fields) {
  const keyItem = (fields.keyExperiences || []).find(item => item?.metric || item?.result);
  return keyItem?.metric || keyItem?.result || fields.output || fields.growth || fields.competency || exp.description || fields.aiSummary || '';
}

function techStack(exp, fields) {
  const stack = fields.projectOverview?.techStack || exp.techStack || exp.skills || [];
  return stack.map(skill => typeof skill === 'string' ? skill : skill?.name).filter(Boolean);
}

function compact(content, lines = 2, max = 64) {
  const text = strip(Array.isArray(content) ? content.filter(Boolean).join('\n') : content);
  return smartBullets(text, lines, max).join('\n') || shorten(text, max * lines);
}

function inferSectionType(label) {
  const lower = String(label || '').toLowerCase();
  if (/프로필|소개|자기소개|about|intro|cover|요약/.test(lower)) return 'profile';
  if (/역량|스킬|기술|stack|skill|tool|키워드/.test(lower)) return 'skills';
  if (/과정|문제|해결|action|process|problem|접근/.test(lower)) return 'process';
  if (/성과|결과|impact|metric|result|증거|수치/.test(lower)) return 'result';
  if (/링크|섹션|상세|detail|내용|목차|구성/.test(lower)) return 'details';
  if (/학력|교육|수상|award|education|활동/.test(lower)) return 'education';
  if (/연락|contact|마무리|thank|끝/.test(lower)) return 'contact';
  if (/프로젝트|경험|case|work|portfolio|경력/.test(lower)) return 'projects';
  return 'projects';
}

function chunkCards(cards, size = 4) {
  const chunks = [];
  for (let index = 0; index < cards.length; index += size) chunks.push(cards.slice(index, index + size));
  return chunks.length ? chunks : [[]];
}

function card(label, text, badge = '') {
  return { label: shorten(label, 38), text: compact(text, 2, 62), badge: shorten(badge, 28) };
}

function compactLines(lines, max = 12) {
  return lines
    .flatMap(line => String(line || '').split('\n'))
    .map(line => strip(line))
    .filter(Boolean)
    .map(line => line.length > 45 ? line.slice(0, 43) + '…' : line)  // shape당 최대 45자
    .slice(0, max);
}

function buildCardsForType(portfolio, type) {
  const experiences = portfolio.experiences || [];
  if (type === 'profile') {
    const values = (portfolio.values || []).map(value => value.keyword || String(value)).filter(Boolean);
    return [
      card('소개', portfolio.about || portfolio.valuesEssay || portfolio.headline || portfolio.targetPosition || '포트폴리오 요약'),
      card('핵심 키워드', listText(values.length ? values : skillNames(portfolio, 8), 8)),
      card('연락처', contactLines(portfolio).join('\n')),
    ].filter(item => item.text);
  }
  if (type === 'skills') {
    const skills = portfolio.skills || {};
    const groups = [
      ['Languages', skills.languages], ['Frameworks', skills.frameworks], ['Tools', skills.tools], ['Other', skills.others],
    ];
    const cards = groups.map(([label, values]) => card(label, listText((values || []).map(value => typeof value === 'string' ? value : value?.name), 12))).filter(item => item.text);
    return cards.length ? cards : [card('핵심 역량', listText(skillNames(portfolio, 12), 12))];
  }
  if (type === 'process') {
    return experiences.map((exp, idx) => {
      const fields = extractFields(exp);
      return card(experienceTitle(exp, idx), [fields.task, fields.process, fields.overview || fields.description].filter(Boolean), techStack(exp, fields).slice(0, 3).join(' · '));
    }).filter(item => item.text);
  }
  if (type === 'result') {
    return experiences.map((exp, idx) => {
      const fields = extractFields(exp);
      return card(experienceTitle(exp, idx), [impactText(exp, fields), fields.output, fields.growth || fields.competency].filter(Boolean), fields.projectOverview?.role || exp.role || 'Impact');
    }).filter(item => item.text);
  }
  if (type === 'details') {
    const cards = [];
    experiences.forEach((exp, expIdx) => {
      const fields = extractFields(exp);
      const title = experienceTitle(exp, expIdx);
      const add = (label, content) => {
        const text = compact(content, 2, 58);
        if (text) cards.push(card(`${title} · ${label}`, text, title));
      };
      add('개요', [fields.intro, fields.overview, fields.description, fields.aiSummary]);
      add('문제/목표', fields.task);
      add('과정', fields.process);
      add('결과', fields.output);
      add('성장/역량', [fields.growth, fields.competency]);
      (exp.sections || []).forEach((section, idx) => add(section.title || `섹션 ${idx + 1}`, section.content));
      if (Array.isArray(exp.details)) exp.details.forEach((detail, idx) => add(`상세 ${idx + 1}`, detail));
      if (Array.isArray(exp.bullets)) exp.bullets.forEach((bullet, idx) => add(`포인트 ${idx + 1}`, bullet));
    });
    return cards;
  }
  if (type === 'education') {
    return [
      ...(portfolio.education || []).map(item => card(item.name || 'Education', [item.degree, item.period, item.description].filter(Boolean), item.period)),
      ...(portfolio.awards || []).map(item => card(item.title || item.name || 'Award', [item.organization, item.date, item.description].filter(Boolean), item.date)),
    ];
  }
  if (type === 'contact') {
    return [
      card('마무리', portfolio.headline || portfolio.targetPosition || '감사합니다'),
      card('Contact', contactLines(portfolio).join('\n')),
    ].filter(item => item.text);
  }
  return experiences.map((exp, idx) => {
    const fields = extractFields(exp);
    return card(experienceTitle(exp, idx), [fields.overview || fields.description || fields.intro, impactText(exp, fields)].filter(Boolean), fields.projectOverview?.duration || exp.period || exp.date);
  }).filter(item => item.text);
}

export function parseDirectTemplate(templateText) {
  const lines = String(templateText || '').split(/\r?\n/).map(cleanLine).filter(Boolean);
  const title = lines[0] || '직접 구성 템플릿';
  const sectionLines = lines.length > 1 ? lines.slice(1) : DEFAULT_SECTIONS;
  return {
    title: shorten(title.replace(/^템플릿\s*[:.-]?\s*/i, ''), 54),
    sections: sectionLines.slice(0, 14).map(line => shorten(line, 48)),
  };
}

export function buildDirectTemplateSlides(portfolio, templateText) {
  const spec = parseDirectTemplate(templateText);
  const slides = [];
  spec.sections.forEach((section, sectionIdx) => {
    const type = inferSectionType(section);
    const cards = buildCardsForType(portfolio, type);
    chunkCards(cards, type === 'details' ? 4 : 4).forEach((chunk, pageIdx) => {
      slides.push({
        sectionIdx,
        pageIdx,
        type,
        title: pageIdx > 0 ? `${section} ${pageIdx + 1}` : section,
        subtitle: type === 'details' ? '링크형 포트폴리오 섹션 내용을 압축 정리' : spec.title,
        cards: chunk,
      });
    });
  });
  return slides;
}

export function directTemplatePlaceholder() {
  return '합격자 포트폴리오 템플릿\n프로필 요약\n핵심 역량\n프로젝트 경험\n문제 해결 과정\n성과 지표\n링크형 섹션 상세\n마무리';
}

async function extractPptxTemplate(file) {
  const { default: JSZip } = await import('jszip');
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/)?.[1] || 0));
  const sections = [];
  for (const path of slideFiles) {
    const slideNumber = Number(path.match(/slide(\d+)\.xml/)?.[1] || sections.length + 1);
    const xml = await zip.files[path].async('text');
    const text = extractSlideText(xml);
    sections.push(pickSectionTitle(text, `슬라이드 ${slideNumber}`));
  }
  const designTokens = await extractPptxDesignTokens(zip);
  return {
    title: file.name.replace(/\.pptx$/i, ''),
    sections: sections.length ? sections : DEFAULT_SECTIONS,
    slideCount: slideFiles.length,
    sourceType: 'pptx',
    arrayBuffer,
    designTokens,
  };
}

/**
 * 업로드 PPTX의 테마/슬라이드에서 색상·폰트를 추출하여 우리 합격자 레이아웃에 입힌다.
 * accent1 색을 메인 액센트로, 슬라이드 1의 가장 큰 채움색을 사이드바 색 후보로 사용.
 */
async function extractPptxDesignTokens(zip) {
  const themePath = Object.keys(zip.files).find(p => /^ppt\/theme\/theme\d+\.xml$/.test(p));
  let accent = '#0F172A';
  let accent2 = null;
  let dk = '#1F2937';
  let lt = '#FFFFFF';
  let majorFont = 'Pretendard';
  let minorFont = 'Pretendard';

  if (themePath) {
    const xml = await zip.files[themePath].async('text');
    const grab = (tag) => {
      const m = xml.match(new RegExp(`<a:${tag}>[\\s\\S]*?<a:srgbClr val="([0-9A-Fa-f]{6})"`));
      if (m) return `#${m[1].toUpperCase()}`;
      const sysM = xml.match(new RegExp(`<a:${tag}>[\\s\\S]*?<a:sysClr [^>]*lastClr="([0-9A-Fa-f]{6})"`));
      return sysM ? `#${sysM[1].toUpperCase()}` : null;
    };
    accent = grab('accent1') || accent;
    accent2 = grab('accent2');
    dk = grab('dk2') || grab('dk1') || dk;
    lt = grab('lt1') || lt;

    const majorM = xml.match(/<a:majorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
    const minorM = xml.match(/<a:minorFont>[\s\S]*?<a:latin typeface="([^"]+)"/);
    if (majorM) majorFont = sanitizeFont(majorM[1]);
    if (minorM) minorFont = sanitizeFont(minorM[1]);
  }

  // 슬라이드 마스터·슬라이드 1에서 가장 진하고 채도 높은 fill 색을 사이드바 후보로 사용.
  let sidebarColor = accent; // 기본값: accent1
  const candidatePaths = [
    Object.keys(zip.files).find(p => /^ppt\/slideMasters\/slideMaster1\.xml$/.test(p)),
    Object.keys(zip.files).find(p => /^ppt\/slides\/slide1\.xml$/.test(p)),
  ].filter(Boolean);

  const allFills = [];
  for (const path of candidatePaths) {
    const sx = await zip.files[path].async('text');
    const fills = Array.from(sx.matchAll(/<a:srgbClr val="([0-9A-Fa-f]{6})"/g))
      .map(m => `#${m[1].toUpperCase()}`)
      .filter(c => c !== '#FFFFFF' && c !== '#000000' && c !== '#FFFFFE' && c !== '#F2F2F2');
    allFills.push(...fills);
  }
  if (allFills.length) {
    const scored = allFills.map(c => ({ c, score: colorVibrancy(c) })).sort((a, b) => b.score - a.score);
    const best = scored.find(({ c }) => colorVibrancy(c) > 30);
    if (best) sidebarColor = best.c;
  }

  // sidebarColor가 너무 밝으면 accent1로 강제 대체
  if (isLight(sidebarColor) && !isLight(accent)) sidebarColor = accent;

  // 가독성: 사이드바 위에 흰/검정 중 무엇을 올릴지 결정
  const sideFg = isLight(sidebarColor) ? '#1F2937' : '#FFFFFF';

  return {
    accent,
    accent2: accent2 || accent,
    side: sidebarColor,
    sideFg,
    bg: '#FFFFFF',
    sub: dk,
    fontHeading: majorFont,
    fontBody: minorFont,
  };
}

function sanitizeFont(name) {
  if (!name) return 'Pretendard';
  // 대표 매칭: Calibri/Calibri Light/Arial → 그대로 두되 한글 환경에선 fallback이 작동
  return name.replace(/[<>"']/g, '').slice(0, 40);
}

function isLight(hex) {
  const c = (hex || '').replace('#', '');
  if (c.length !== 6) return true;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
}

// 색의 '진함·채도' 점수 (0-100). 회색/흰색 계열은 낮음.
function colorVibrancy(hex) {
  const c = (hex || '').replace('#', '');
  if (c.length !== 6) return 0;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const brightness = max;
  const saturation = max === 0 ? 0 : (max - min) / max;
  // 어두운 색(낮은 밝기)이나 채도 높은 색에 높은 점수
  return saturation * 60 + (255 - brightness) * 0.25;
}

async function extractPdfTemplate(file) {
  const pdfjsLib = await import('pdfjs-dist');
  const buffer = await file.arrayBuffer();
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const sections = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).filter(Boolean).join('\n');
    sections.push(pickSectionTitle(text, `페이지 ${pageNumber}`));
  }
  return {
    title: file.name.replace(/\.pdf$/i, ''),
    sections: sections.length ? sections : DEFAULT_SECTIONS,
    sourceType: 'pdf',
  };
}

export async function extractDirectTemplateFromFile(file) {
  const name = file?.name || '';
  if (/\.pptx$/i.test(name)) return extractPptxTemplate(file);
  if (/\.ppt$/i.test(name)) throw new Error('구형 .ppt 파일은 구조 분석을 지원하지 않습니다. PowerPoint에서 .pptx로 저장한 뒤 업로드해 주세요.');
  if (/\.pdf$/i.test(name)) return extractPdfTemplate(file);
  throw new Error('PPTX 또는 PDF 파일만 업로드할 수 있습니다.');
}

export function directTemplateSpecToText(spec) {
  if (!spec) return directTemplatePlaceholder();
  return [spec.title || '업로드 템플릿', ...(spec.sections || DEFAULT_SECTIONS)].filter(Boolean).join('\n');
}

function getSlideFiles(zip) {
  return Object.keys(zip.files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/)?.[1] || 0));
}

function getNextRelationshipId(relsXml) {
  const ids = [...String(relsXml || '').matchAll(/Id="rId(\d+)"/g)].map(match => Number(match[1])).filter(Boolean);
  return `rId${Math.max(0, ...ids) + 1}`;
}

function getNextSlideId(presentationXml) {
  const ids = [...String(presentationXml || '').matchAll(/<p:sldId[^>]*\sid="(\d+)"/g)].map(match => Number(match[1])).filter(Boolean);
  return Math.max(255, ...ids) + 1;
}

function ensureSlideCount(zip, desiredCount, sourceSlideFiles) {
  const slideFiles = getSlideFiles(zip);
  if (slideFiles.length >= desiredCount || !slideFiles.length) return slideFiles;

  let contentTypesXml = zip.file('[Content_Types].xml')?.async('text');
  let presentationXml = zip.file('ppt/presentation.xml')?.async('text');
  let relsXml = zip.file('ppt/_rels/presentation.xml.rels')?.async('text');

  return Promise.all([contentTypesXml, presentationXml, relsXml]).then(async ([contentTypes, presentation, rels]) => {
    let nextSlideNumber = Math.max(...slideFiles.map(path => Number(path.match(/slide(\d+)\.xml/)?.[1] || 0))) + 1;
    let nextSlideId = getNextSlideId(presentation);
    let relsOutput = rels;
    let presentationOutput = presentation;
    let contentTypesOutput = contentTypes;

    while (slideFiles.length < desiredCount) {
      const sourcePath = sourceSlideFiles[Math.min(sourceSlideFiles.length - 1, slideFiles.length)] || sourceSlideFiles[sourceSlideFiles.length - 1];
      const sourceXml = await zip.file(sourcePath).async('text');
      const newPath = `ppt/slides/slide${nextSlideNumber}.xml`;
      zip.file(newPath, sourceXml);

      const sourceRelsPath = sourcePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      const sourceRels = zip.file(sourceRelsPath);
      if (sourceRels) {
        const newRelsPath = newPath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
        zip.file(newRelsPath, await sourceRels.async('text'));
      }

      const relationshipId = getNextRelationshipId(relsOutput);
      relsOutput = relsOutput.replace('</Relationships>', `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${nextSlideNumber}.xml"/></Relationships>`);
      presentationOutput = presentationOutput.replace('</p:sldIdLst>', `<p:sldId id="${nextSlideId}" r:id="${relationshipId}"/></p:sldIdLst>`);
      contentTypesOutput = contentTypesOutput.replace('</Types>', `<Override PartName="/ppt/slides/slide${nextSlideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);

      slideFiles.push(newPath);
      nextSlideNumber += 1;
      nextSlideId += 1;
    }

    zip.file('[Content_Types].xml', contentTypesOutput);
    zip.file('ppt/presentation.xml', presentationOutput);
    zip.file('ppt/_rels/presentation.xml.rels', relsOutput);
    return getSlideFiles(zip);
  });
}

// 슬라이드 개수가 많을 때 뭐를 제거
async function reduceToSlideCount(zip, targetCount) {
  const slideFiles = getSlideFiles(zip);
  if (slideFiles.length <= targetCount) return;
  const toRemove = slideFiles.slice(targetCount);
  let presentationXml = await zip.file('ppt/presentation.xml').async('text');
  let relsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('text');
  let contentTypesXml = await zip.file('[Content_Types].xml').async('text');
  for (const slidePath of toRemove) {
    const slideNum = slidePath.match(/slide(\d+)\.xml/)?.[1];
    if (!slideNum) continue;
    const relPat = new RegExp(`<Relationship[^>]*Id="([^"]+)"[^>]*Target="slides/slide${slideNum}\.xml"[^/]*/?>`);
    const relM = relsXml.match(relPat);
    if (relM) {
      const relId = relM[1];
      presentationXml = presentationXml.replace(new RegExp(`<p:sldId[^>]*r:id="${relId}"[^/]*/?>\s*`), '');
      relsXml = relsXml.replace(relPat, '');
    }
    contentTypesXml = contentTypesXml.replace(new RegExp(`<Override[^>]*PartName="/ppt/slides/slide${slideNum}\.xml"[^/]*/?>\s*`), '');
  }
  zip.file('ppt/presentation.xml', presentationXml);
  zip.file('ppt/_rels/presentation.xml.rels', relsXml);
  zip.file('[Content_Types].xml', contentTypesXml);
}

// 포트폴리오 콘텐츠를 기반으로 필요한 만큼 슬라이드를 생성
function generatePortfolioContentPlan(portfolio) {
  const exps = portfolio.experiences || [];
  const skills = skillNames(portfolio, 20);
  const plan = [];

  // 1. 표지
  plan.push({ intent: 'profile', lines: coverPayload(portfolio, portfolio.userName || 'Portfolio') });

  // 2. 역량/기술 (있을 때)
  if (skills.length >= 2) {
    plan.push({
      intent: 'skills',
      lines: compactLines([
        '핵심 역량',
        skills.slice(0, 10).join(' · '),
        portfolio.headline || portfolio.targetPosition || '',
      ].filter(Boolean), 12),
    });
  }

  // 3. 경험별 슬라이드
  exps.forEach((exp, idx) => {
    const fields = extractFields(exp);
    // 메인 프로젝트 슬라이드
    plan.push({ intent: 'project', lines: experiencePayload(exp, idx) });

    // 과정 슬라이드 (충분한 내용이 있을 때)
    const processText = [fields.task, fields.process].filter(Boolean).join(' ');
    if (processText.length > 60) {
      plan.push({
        intent: 'process',
        lines: compactLines([
          experienceTitle(exp, idx) + ' — 문제 해결 과정',
          fields.task || '',
          fields.process || '',
          techStack(exp, fields).slice(0, 4).join(' · '),
        ].filter(Boolean), 10),
      });
    }

    // 성과 슬라이드
    const impact = impactText(exp, fields);
    if (impact || fields.output || fields.growth) {
      plan.push({
        intent: 'result',
        lines: compactLines([
          experienceTitle(exp, idx) + ' — 성과',
          impact || '',
          fields.output || '',
          fields.growth || fields.competency || '',
        ].filter(Boolean), 10),
      });
    }
  });

  // 4. 마무리
  plan.push({
    intent: 'contact',
    lines: compactLines([
      '감사합니다',
      portfolio.userName || '',
      portfolio.targetPosition || portfolio.headline || '',
      ...contactLines(portfolio),
    ], 8),
  });

  return plan;
}

// 주어진 intent에 가장 적합한 템플릿 디자인을 선택
function findBestDesignXml(designMap, intent) {
  if (designMap[intent]) return designMap[intent];
  const fallback = { process: 'project', result: 'project', details: 'project', education: 'project', skills: 'project' };
  const fb = fallback[intent];
  if (fb && designMap[fb]) return designMap[fb];
  // 가운데 슬라이드를 generic 콘텐츠로 활용
  const keys = Object.keys(designMap);
  const midKey = keys[Math.floor(keys.length / 2)] || keys[0];
  return designMap[midKey] || null;
}

function coverPayload(portfolio, templateTitle) {
  return compactLines([
    portfolio.userName || '이름',
    portfolio.headline || portfolio.targetPosition || templateTitle || 'Portfolio',
    portfolio.about || portfolio.valuesEssay || '',
    contactLines(portfolio).join('\n'),
    skillNames(portfolio, 8).join(' · '),
  ], 10);
}

function experiencePayload(exp, idx) {
  const fields = extractFields(exp || {});
  return compactLines([
    experienceTitle(exp || {}, idx),
    fields.projectOverview?.role || exp?.role || fields.projectOverview?.duration || exp?.period || '',
    fields.overview || fields.description || fields.intro || fields.aiSummary,
    fields.task,
    fields.process,
    impactText(exp || {}, fields) || fields.output,
    fields.growth || fields.competency,
    techStack(exp || {}, fields).slice(0, 5).join(' · '),
  ], 12);
}

function detailPayload(portfolio, max = 12) {
  const lines = [];
  (portfolio.experiences || []).forEach((exp, idx) => {
    const fields = extractFields(exp);
    lines.push(experienceTitle(exp, idx));
    [fields.overview || fields.description || fields.intro, fields.task, fields.process, fields.output, fields.growth || fields.competency]
      .filter(Boolean)
      .forEach(item => lines.push(compact(item, 1, 66)));
    (exp.sections || []).forEach(section => lines.push(compact([section.title, section.content], 1, 66)));
    if (Array.isArray(exp.details)) exp.details.forEach(detail => lines.push(compact(detail, 1, 66)));
    if (Array.isArray(exp.bullets)) exp.bullets.forEach(bullet => lines.push(compact(bullet, 1, 66)));
  });
  return compactLines(lines, max);
}

function inferTemplateSlideType(text, slideIndex, slideTotal) {
  const lower = String(text || '').toLowerCase();
  if (slideIndex === 0 || /cover|title|portfolio|profile|intro|소개|표지|프로필/.test(lower)) return 'profile';
  if (slideIndex === slideTotal - 1 || /thank|contact|연락|마무리|감사/.test(lower)) return 'contact';
  if (/skill|stack|tool|역량|스킬|기술|키워드/.test(lower)) return 'skills';
  if (/result|impact|metric|성과|결과|수치|지표/.test(lower)) return 'result';
  if (/problem|process|action|solution|과정|문제|해결|접근/.test(lower)) return 'process';
  if (/detail|section|link|appendix|상세|섹션|링크|내용/.test(lower)) return 'details';
  if (/education|award|activity|학력|교육|수상|활동/.test(lower)) return 'education';
  return 'project';
}

function payloadForTemplateSlide(portfolio, originalText, slideIndex, slideTotal, textBoxCount, templateTitle, overrideType) {
  const experiences = portfolio.experiences || [];
  const type = overrideType || inferTemplateSlideType(originalText, slideIndex, slideTotal);
  const projectIndex = experiences.length ? Math.max(0, Math.min(experiences.length - 1, slideIndex - 1)) : 0;
  let lines = [];

  if (type === 'profile') lines = coverPayload(portfolio, templateTitle);
  else if (type === 'skills') lines = compactLines(['핵심 역량', skillNames(portfolio, 16).join(' · '), portfolio.headline || portfolio.targetPosition || ''], 8);
  else if (type === 'result') lines = compactLines(['성과 요약', ...experiences.map((exp, idx) => `${experienceTitle(exp, idx)}: ${impactText(exp, extractFields(exp)) || '핵심 성과'}`)], 12);
  else if (type === 'process') lines = compactLines(['문제 해결 과정', ...experiences.flatMap((exp, idx) => {
    const fields = extractFields(exp);
    return [experienceTitle(exp, idx), fields.task, fields.process].filter(Boolean);
  })], 12);
  else if (type === 'details') lines = detailPayload(portfolio, 14);
  else if (type === 'education') lines = compactLines([
    'Education & Awards',
    ...(portfolio.education || []).map(item => [item.name, item.degree, item.period].filter(Boolean).join(' · ')),
    ...(portfolio.awards || []).map(item => [item.title || item.name, item.organization, item.date].filter(Boolean).join(' · ')),
  ], 12);
  else if (type === 'contact') lines = compactLines(['감사합니다', portfolio.userName || '', portfolio.targetPosition || portfolio.headline || '', contactLines(portfolio).join('\n')], 8);
  else lines = experiencePayload(experiences[projectIndex] || {}, projectIndex);

  return lines.slice(0, Math.max(1, textBoxCount || lines.length || 1));
}

function slidePayload(slideData) {
  return compactLines([
    slideData.title,
    slideData.subtitle,
    ...(slideData.cards || []).flatMap(item => [item.label, item.text, item.badge]),
  ], 14);
}

// rPr 템플릿에서 sz 속성을 새 값(1/100 pt)으로 교체하거나 주입
function applyFontSizeToRPr(rPrXml, hundredths) {
  if (!rPrXml) return `<a:rPr lang="ko-KR" dirty="0" sz="${hundredths}"/>`;
  if (/\bsz="\d+"/.test(rPrXml)) return rPrXml.replace(/\bsz="\d+"/, `sz="${hundredths}"`);
  // self-closing 인지 컨테이너인지 따라 주입
  if (/\/>\s*$/.test(rPrXml)) return rPrXml.replace(/\/>\s*$/, ` sz="${hundredths}"/>`);
  return rPrXml.replace(/^<a:rPr\b/, `<a:rPr sz="${hundredths}"`);
}

// 한 shape의 단락 채우기 — \n 단위로 a:p 분리, 원본 rPr/pPr 보존, 옵션으로 폰트 크기 조정
function fillTxBody(txBodyXml, replacement, opts = {}) {
  const { rPrTemplate = null, pPrTemplate = null, fontSizePt = null } = opts;
  const withoutParas = txBodyXml.replace(/<a:p\b[\s\S]*?<\/a:p>/g, '');
  const endPara = '<a:p><a:endParaRPr lang="ko-KR" dirty="0"/></a:p>';

  const lines = String(replacement || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!lines.length) return withoutParas + endPara;

  let rPr = rPrTemplate || '<a:rPr lang="ko-KR" dirty="0"/>';
  if (fontSizePt && Number.isFinite(fontSizePt)) {
    rPr = applyFontSizeToRPr(rPr, Math.round(Number(fontSizePt) * 100));
  }
  const pPrTag = pPrTemplate || '';

  const paras = lines
    .map(line => `<a:p>${pPrTag}<a:r>${rPr}<a:t>${encodeXmlText(line)}</a:t></a:r></a:p>`)
    .join('');
  return withoutParas + paras + endPara;
}

// shape별 글자수 한도에 맞춰 텍스트 다듬기
function fitTextToBudget(text, budget) {
  const t = String(text || '').trim();
  if (!t) return '';
  const limit = Math.max(8, Number(budget) || 60);
  if (t.length <= limit) return t;
  // 문장 끊어서 fit (개조식 보존)
  const segs = t.split(/(?<=[.!?。·])\s+|\s*[\n·]\s*/).map(s => s.trim()).filter(Boolean);
  let acc = '';
  for (const seg of segs) {
    const next = acc ? `${acc} · ${seg}` : seg;
    if (next.length > limit) break;
    acc = next;
  }
  if (!acc) acc = t.slice(0, limit - 1) + '…';
  return acc;
}

// Shape(도형/테이블셀) 단위로 교체.
// replacements 가 배열이면 priority 순서대로 채우고,
// { byShapeId: Map<id,text>, budgets: Map<id,n> } 형태면 shape_id 매핑으로 채운다.
function replaceSlideText(xml, replacements) {
  if (!replacements) return String(xml || '');
  const xmlStr = String(xml || '');
  const shapes = extractReplaceableShapes(xmlStr);
  if (!shapes.length) return xmlStr;

  const isShapeIdMode = !Array.isArray(replacements) && replacements.byShapeId instanceof Map;
  const assignments = new Map(); // matchStart → { text, fontSizePt }
  const fontMap = isShapeIdMode && replacements.byShapeFontPt instanceof Map ? replacements.byShapeFontPt : null;

  if (isShapeIdMode) {
    const byId = replacements.byShapeId;
    for (const sh of shapes) {
      const raw = byId.get(sh.shape_id);
      if (raw == null) continue;
      assignments.set(sh.matchStart, {
        text: fitTextToBudget(raw, sh.char_budget),
        fontSizePt: fontMap ? fontMap.get(sh.shape_id) || null : null,
      });
    }
  } else {
    const list = Array.isArray(replacements) ? replacements : [];
    if (!list.length) return xmlStr;
    const byPriority = [...shapes].sort((a, b) => a.priority - b.priority || a.matchStart - b.matchStart);
    byPriority.forEach((shape, i) => {
      const raw = i < list.length ? (list[i] || '') : '';
      assignments.set(shape.matchStart, {
        text: fitTextToBudget(raw, shape.char_budget),
        fontSizePt: null,
      });
    });
  }

  // 뒤에서 앞으로 교체 (위치 보존)
  const byPos = [...shapes].sort((a, b) => b.matchStart - a.matchStart);
  let result = xmlStr;
  for (const shape of byPos) {
    if (!assignments.has(shape.matchStart)) continue;
    const { text: repl, fontSizePt } = assignments.get(shape.matchStart);
    const frag = result.slice(shape.matchStart, shape.matchEnd);
    const txTag = shape.type === 'sp' ? 'p:txBody' : 'a:txBody';
    const replaced = frag.replace(
      new RegExp(`(<${txTag}(?:\\s[^>]*)?>)([\\s\\S]*?)(<\\/${txTag}>)`),
      (_, open, body, close) => `${open}${fillTxBody(body, repl, {
        rPrTemplate: shape.rPrTemplate,
        pPrTemplate: shape.pPrTemplate,
        fontSizePt,
      })}${close}`
    );
    result = result.slice(0, shape.matchStart) + replaced + result.slice(shape.matchEnd);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 기반 안전 교체기 (정규식이 아닌 DOMParser/XMLSerializer 사용)
// 정규식으로 PPTX 내부 XML을 자르고 붙이는 방식은 속성 순서·줄바꿈·중첩 그룹에서
// 미세하게 어긋나며 PowerPoint 렌더링이 무너진다. DOM 트리로 다루면 디자인이 보존됨.
// ─────────────────────────────────────────────────────────────────────────────
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

// shape_id 와 일치하는 순서로 DOM 요소를 순회해 새 텍스트를 주입한다.
// extractReplaceableShapes 와 동일한 필터(빈/구조 텍스트 제외) + 같은 순서(p:sp → a:tc).
function safelyReplaceSlideTextDom(xmlString, byShapeId, byShapeFontPt = null) {
  if (!byShapeId || !byShapeId.size) return xmlString;
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length) {
    console.warn('[safelyReplaceSlideTextDom] XML 파싱 실패, 원본 유지');
    return xmlString;
  }

  const collectText = (el) => {
    const ts = el.getElementsByTagNameNS(NS_A, 't');
    let s = '';
    for (let i = 0; i < ts.length; i++) s += ts[i].textContent || '';
    return s.replace(/\s+/g, ' ').trim();
  };

  // 한 텍스트박스(p:txBody 또는 a:txBody)의 첫 a:p 안에서 pPr / rPr / endParaRPr 클론을 추출
  const captureDesign = (txBody) => {
    let pPr = null, rPr = null, endParaRPr = null;
    const aPs = txBody.getElementsByTagNameNS(NS_A, 'p');
    for (let i = 0; i < aPs.length; i++) {
      const aP = aPs[i];
      if (!pPr) {
        const x = aP.getElementsByTagNameNS(NS_A, 'pPr')[0];
        if (x) pPr = x.cloneNode(true);
      }
      if (!rPr) {
        const aR = aP.getElementsByTagNameNS(NS_A, 'r')[0];
        if (aR) {
          const x = aR.getElementsByTagNameNS(NS_A, 'rPr')[0];
          if (x) rPr = x.cloneNode(true);
        }
      }
      if (!endParaRPr) {
        const x = aP.getElementsByTagNameNS(NS_A, 'endParaRPr')[0];
        if (x) endParaRPr = x.cloneNode(true);
      }
      if (pPr && rPr && endParaRPr) break;
    }
    return { pPr, rPr, endParaRPr };
  };

  const writeLines = (txBody, lines, design, fontSizePt) => {
    // 기존 a:p 모두 제거 (bodyPr, lstStyle 등 다른 자식은 보존)
    const oldPs = Array.from(txBody.getElementsByTagNameNS(NS_A, 'p'));
    oldPs.forEach(p => p.parentNode.removeChild(p));

    const rPrCloneBase = design.rPr ? design.rPr.cloneNode(true) : null;
    if (rPrCloneBase && fontSizePt && Number.isFinite(fontSizePt)) {
      rPrCloneBase.setAttribute('sz', String(Math.round(Number(fontSizePt) * 100)));
    }

    if (!lines.length) {
      const p = xmlDoc.createElementNS(NS_A, 'a:p');
      if (design.endParaRPr) p.appendChild(design.endParaRPr.cloneNode(true));
      else {
        const epr = xmlDoc.createElementNS(NS_A, 'a:endParaRPr');
        epr.setAttribute('lang', 'ko-KR');
        p.appendChild(epr);
      }
      txBody.appendChild(p);
      return;
    }

    lines.forEach(line => {
      const p = xmlDoc.createElementNS(NS_A, 'a:p');
      if (design.pPr) p.appendChild(design.pPr.cloneNode(true));
      const r = xmlDoc.createElementNS(NS_A, 'a:r');
      if (rPrCloneBase) r.appendChild(rPrCloneBase.cloneNode(true));
      const t = xmlDoc.createElementNS(NS_A, 'a:t');
      t.textContent = line; // DOM 직렬화기가 특수문자/엔티티를 안전하게 처리
      r.appendChild(t);
      p.appendChild(r);
      txBody.appendChild(p);
    });

    // 호환성을 위해 마지막 endParaRPr 단락 추가
    const endP = xmlDoc.createElementNS(NS_A, 'a:p');
    if (design.endParaRPr) endP.appendChild(design.endParaRPr.cloneNode(true));
    else {
      const epr = xmlDoc.createElementNS(NS_A, 'a:endParaRPr');
      epr.setAttribute('lang', 'ko-KR');
      endP.appendChild(epr);
    }
    txBody.appendChild(endP);
  };

  let shapeId = 0;

  // 1) p:sp 도형 (그룹 내 중첩 포함, 문서 순서)
  const sps = Array.from(xmlDoc.getElementsByTagNameNS(NS_P, 'sp'));
  for (const sp of sps) {
    const text = collectText(sp);
    if (!text || isStructuralText(text)) continue;
    shapeId += 1;
    const raw = byShapeId.get(shapeId);
    if (raw == null) continue;
    const txBody = sp.getElementsByTagNameNS(NS_P, 'txBody')[0];
    if (!txBody) continue;
    const design = captureDesign(txBody);
    const fontSizePt = byShapeFontPt ? byShapeFontPt.get(shapeId) || null : null;
    const lines = String(raw).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    writeLines(txBody, lines, design, fontSizePt);
  }

  // 2) a:tc 테이블 셀 (문서 순서)
  const tcs = Array.from(xmlDoc.getElementsByTagNameNS(NS_A, 'tc'));
  for (const tc of tcs) {
    const text = collectText(tc);
    if (!text || isStructuralText(text)) continue;
    shapeId += 1;
    const raw = byShapeId.get(shapeId);
    if (raw == null) continue;
    const txBody = tc.getElementsByTagNameNS(NS_A, 'txBody')[0];
    if (!txBody) continue;
    const design = captureDesign(txBody);
    const fontSizePt = byShapeFontPt ? byShapeFontPt.get(shapeId) || null : null;
    const lines = String(raw).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    writeLines(txBody, lines, design, fontSizePt);
  }

  return new XMLSerializer().serializeToString(xmlDoc);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function addNormAutofit(xml) {
  return String(xml || '')
    // self-closing <a:bodyPr .../> → 태그 펼쳐서 normAutofit 주입
    .replace(/<a:bodyPr([^>]*?)\/>/g, '<a:bodyPr$1><a:normAutofit/></a:bodyPr>')
    // 기존 spAutoFit/noAutofit → normAutofit으로 강제 교체 (오버플로우 방지)
    .replace(/<a:spAutoFit\s*\/>/g, '<a:normAutofit/>')
    .replace(/<a:noAutofit\s*\/>/g, '<a:normAutofit/>')
    // normAutofit 없는 bodyPr에 추가
    .replace(/(<a:bodyPr[^>]*>)([\s\S]*?)(<\/a:bodyPr>)/g, (match, open, content, close) => {
      if (/<a:normAutofit/.test(content)) return match;
      return `${open}<a:normAutofit/>${content}${close}`;
    });
}

export async function analyzeAndPreviewTemplate(templateArrayBuffer, portfolio, templateText) {
  if (!templateArrayBuffer) throw new Error('먼저 PPTX 템플릿 파일을 업로드해 주세요.');
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(templateArrayBuffer.slice ? templateArrayBuffer.slice(0) : templateArrayBuffer);
  const slideFiles = getSlideFiles(zip);
  if (!slideFiles.length) throw new Error('PPTX 템플릿에서 슬라이드를 찾을 수 없습니다.');

  // Step 1: 각 슬라이드의 shape-level 레이아웃 지도 추출 (디자인만, 기존 텍스트는 제외)
  const spec = parseDirectTemplate(templateText || '');
  const slideAnalyses = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i]).async('text');
    slideAnalyses.push(buildSlideLayoutMap(xml, i));
  }

  // Step 2: AI가 레이아웃 지도 + 포트폴리오 내용 분석 → shape_id 별 텍스트 배치
  try {
    const { data } = await api.post('/portfolio/direct-pptx-map', {
      templateTitle: spec.title,
      slides: slideAnalyses,
      portfolio: safePortfolioForAI(portfolio),
    }, {
      // 2-stage Gemini Pro 호출 (distill + layout-fit) + 재시도 → 기본 120s 로는 부족
      timeout: 300000,
    });
    const aiMappings = Array.isArray(data?.mappings) ? data.mappings : [];
    if (aiMappings.length) {
      return aiMappings.map(m => {
        const orderedShapes = Array.isArray(m.shapes) ? [...m.shapes].sort((a, b) => Number(a.shape_id) - Number(b.shape_id)) : [];
        const shapeMap = {};
        const fontMap = {};
        orderedShapes.forEach(s => {
          const id = Number(s.shape_id);
          if (!Number.isFinite(id)) return;
          shapeMap[id] = String(s.new_text || '');
          const sz = Number(s.font_size_pt);
          if (Number.isFinite(sz) && sz >= 6 && sz <= 96) fontMap[id] = sz;
        });
        const linesFromShapes = orderedShapes
          .flatMap(s => String(s.new_text || '').split(/\r?\n/))
          .map(l => l.trim())
          .filter(Boolean);
        const lines = Array.isArray(m.lines) && m.lines.length ? m.lines.filter(Boolean) : linesFromShapes;
        return {
          slideIndex: Number(m.slideIndex),
          intent: m.intent || 'project',
          lines,
          shapeMap,
          fontMap,
        };
      });
    }
  } catch (err) {
    console.error('[analyzeAndPreviewTemplate] AI 호출 실패:', err);
    throw new Error(`AI 분석 실패: ${err?.response?.data?.error || err?.message || '알 수 없는 오류'}. 잠시 후 다시 시도해 주세요.`);
  }

  throw new Error('AI 분석이 빈 결과를 반환했습니다. 다시 시도해 주세요.');
}

export async function fillUploadedPptxTemplate(templateArrayBuffer, portfolio, templateText, precomputedSlides = null) {
  if (!templateArrayBuffer) throw new Error('먼저 PPTX 템플릿 파일을 업로드해 주세요.');
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(templateArrayBuffer.slice ? templateArrayBuffer.slice(0) : templateArrayBuffer);
  const templateSlideFiles = getSlideFiles(zip);
  if (!templateSlideFiles.length) throw new Error('PPTX 템플릿에서 슬라이드를 찾을 수 없습니다.');

  // 사전 분석 결과가 없으면 여기서 즉시 AI 분석을 수행 (절대 로컬 폴백으로 빠지지 않음)
  let slides = Array.isArray(precomputedSlides) && precomputedSlides.length ? precomputedSlides : null;
  if (!slides) {
    console.log('[fillUploadedPptxTemplate] precomputedSlides 없음 → AI 분석 자동 실행');
    slides = await analyzeAndPreviewTemplate(templateArrayBuffer, portfolio, templateText);
  }
  if (!slides || !slides.length) {
    throw new Error('AI 분석 결과가 비어 있습니다. 다시 분석해 주세요.');
  }

  // 슬라이드별 텍스트 주입 — DOMParser 기반 안전 교체기 사용 (정규식 XML 조작 금지)
  // 또한 normAutofit 강제 주입을 제거하여 템플릿 원본의 autofit 설정을 보존한다.
  const upTo = Math.min(slides.length, templateSlideFiles.length);
  for (let i = 0; i < upTo; i++) {
    const slide = slides[i];
    const xml = await zip.file(templateSlideFiles[i]).async('text');
    const shapeMap = slide.shapeMap && typeof slide.shapeMap === 'object' ? slide.shapeMap : null;
    const fontMapObj = slide.fontMap && typeof slide.fontMap === 'object' ? slide.fontMap : null;

    let outXml = xml;
    if (shapeMap && Object.keys(shapeMap).length) {
      const byShapeId = new Map(Object.entries(shapeMap).map(([k, v]) => [Number(k), v]));
      const byShapeFontPt = fontMapObj
        ? new Map(Object.entries(fontMapObj).map(([k, v]) => [Number(k), Number(v)]))
        : null;
      outXml = safelyReplaceSlideTextDom(xml, byShapeId, byShapeFontPt);
    } else if (Array.isArray(slide.lines) && slide.lines.length) {
      // shapeMap 이 없는 비상시: lines 를 priority 순서로 임시 매핑
      const layout = buildSlideLayoutMap(xml, i);
      const byShapeId = new Map();
      slide.lines.forEach((line, idx) => {
        const target = layout.shapes[idx];
        if (target) byShapeId.set(target.shape_id, line);
      });
      outXml = safelyReplaceSlideTextDom(xml, byShapeId, null);
    }
    zip.file(templateSlideFiles[i], outXml);
  }

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const fileName = `${(portfolio.userName || 'portfolio').replace(/\s+/g, '_')}_portfolio.pptx`;
  downloadBlob(blob, fileName);
}

function safePortfolioForAI(portfolio) {
  const {
    customTemplateArrayBuffer,
    customTemplateText,
    directTemplateText,
    ...rest
  } = portfolio || {};
  return JSON.parse(JSON.stringify(rest, (key, value) => {
    if (value instanceof ArrayBuffer) return undefined;
    if (ArrayBuffer.isView(value)) return undefined;
    if (typeof value === 'function') return undefined;
    if (typeof value === 'string') return value.length > 1600 ? value.slice(0, 1600) : value;
    return value;
  }));
}

async function requestAiTemplateMappings({ templateTitle, slides, portfolio }) {
  const { data } = await api.post('/portfolio/direct-pptx-map', {
    templateTitle,
    slides,
    portfolio: safePortfolioForAI(portfolio),
  }, { timeout: 300000 });
  const mappings = Array.isArray(data?.mappings) ? data.mappings : [];
  return new Map(mappings.map(mapping => [Number(mapping.slideIndex), mapping.lines || []]));
}