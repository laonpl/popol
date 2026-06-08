/**
 * projectSections — 프로젝트(경험) 상세의 섹션 정의와
 * 경험 데이터 → Yoopta(노션) 문서 변환/삽입 유틸.
 *
 * 편집(NotionPortfolioEditor) · 미리보기(NotionPortfolioPreview) ·
 * 링크공유(PublicPortfolioView)에서 공통으로 사용한다.
 */
import { generateId } from '@yoopta/editor';
import { FRAMEWORKS, JOB_SPECIFIC_FIELDS } from '../stores/experienceStore';

export const EXP_SECTION_META = {
  intro:      { num: '01', label: '프로젝트 소개' },
  overview:   { num: '02', label: '프로젝트 개요' },
  task:       { num: '03', label: '진행한 일' },
  process:    { num: '04', label: '과정' },
  output:     { num: '05', label: '결과물' },
  growth:     { num: '06', label: '성장한 점' },
  competency: { num: '07', label: '나의 역량' },
};
export const EXP_SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

function sanitizeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function normBlock(block) {
  if (!block) return null;
  if (block.type === 'image') {
    return { type: 'image', content: block.content || block.src || '', alt: sanitizeText(block.alt || ''), width: block.width || '100%' };
  }
  if (block.type === 'infographic') {
    const info = block.infographic || block;
    const cards = (Array.isArray(info.cards) ? info.cards : []).map(card => [
      card?.question,
      card?.finding,
      card?.value != null ? `${card.valueLabel || '수치'}: ${card.value}${card.unit || ''}` : '',
      Array.isArray(card?.bars) ? card.bars.map(bar => `${bar?.label || ''} ${bar?.value ?? ''}${bar?.unit || card?.unit || ''}`.trim()).filter(Boolean).join(', ') : '',
      card?.interpretation,
      card?.sourceUrl ? `출처: ${card.sourceUrl}` : '',
    ].filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
    return {
      type: 'text',
      content: sanitizeText([info.title, info.subtitle, cards, info.conclusion, info.limitations && `해석 한계: ${info.limitations}`].filter(Boolean).join('\n\n')),
    };
  }
  if (block.type === 'slide') {
    const cardText = (block.cards || []).map(c => [c?.label, c?.title, c?.body, c?.metric].filter(Boolean).join(' ')).filter(Boolean).join('\n');
    return { type: 'text', content: sanitizeText([block.title, block.subtitle, block.content, cardText].filter(Boolean).join('\n')) };
  }
  return { type: 'text', content: sanitizeText(block.content || block.text || '') };
}

function blocksToText(blocks = []) {
  return blocks.map(b => (b?.type === 'text' ? sanitizeText(b.content || '') : '')).filter(Boolean).join('\n\n');
}

function normSection(section = {}) {
  const rawBlocks = Array.isArray(section.blocks) && section.blocks.length > 0
    ? section.blocks.map(normBlock).filter(Boolean)
    : (section.content ? [{ type: 'text', content: sanitizeText(section.content) }] : []);
  return {
    key: section.key || section.title || 'section',
    label: sanitizeText(section.label || section.title || ''),
    type: section.type || 'custom',
    content: sanitizeText(section.content || blocksToText(rawBlocks)),
    blocks: rawBlocks,
  };
}

/**
 * 경험 객체에서 렌더링 가능한 상세 섹션 목록을 만든다.
 * 우선순위: exportConfig.sections → exp.sections(레거시) → jobSpecific + 기본 7섹션
 */
export function buildRenderableSections(exp) {
  const structured = exp?.structuredResult || {};
  const exportCfg = structured.exportConfig;
  if (exportCfg?.sections?.length > 0) {
    return exportCfg.sections
      .map((s, i) => normSection({ ...s, key: s.key || `export-${i}`, label: s.label || s.title }))
      .filter(s => s.content?.trim() || s.blocks?.some(b => b.type === 'image'));
  }
  if (Array.isArray(exp?.sections) && exp.sections.some(s => s.title && s.content)) {
    return exp.sections
      .filter(s => s.title && s.content)
      .map((s, i) => normSection({ key: s.key || `sec-${i}`, label: s.title, content: s.content, blocks: s.blocks }));
  }
  const jobSpecific = structured.jobSpecific || {};
  const jobSects = Object.entries(jobSpecific)
    .filter(([, v]) => v?.trim?.())
    .map(([k, v]) => normSection({ key: k, label: k, type: 'job', content: v }));
  const baseSects = EXP_SECTION_KEYS
    .filter(k => typeof structured[k] === 'string' && structured[k].trim())
    .map(k => normSection({ key: k, label: EXP_SECTION_META[k].label, type: 'base', content: structured[k] }));
  return [...jobSects, ...baseSects];
}

// ── Yoopta 블록 빌더 (order는 조립 단계에서 부여) ───────────────
function paragraphBlock(text = '') {
  return { id: generateId(), type: 'Paragraph', value: [{ id: generateId(), type: 'paragraph', children: [{ text: text || '' }] }], meta: { depth: 0 } };
}

function headingBlock(text = '', level = 'HeadingTwo') {
  const elType = level === 'HeadingOne' ? 'heading-one' : level === 'HeadingThree' ? 'heading-three' : 'heading-two';
  return { id: generateId(), type: level, value: [{ id: generateId(), type: elType, children: [{ text: text || '' }] }], meta: { depth: 0 } };
}

function imageBlock(src, alt = 'image', sizes = { width: 720, height: 420 }) {
  return {
    id: generateId(),
    type: 'Image',
    value: [{ id: generateId(), type: 'image', children: [{ text: '' }], props: { src, alt, sizes, fit: 'contain', nodeType: 'void' } }],
    meta: { depth: 0, align: 'center' },
  };
}

function textToParagraphs(text) {
  return sanitizeText(text).split('\n').map(l => l.trim()).filter(Boolean).map(paragraphBlock);
}

/** 단일 섹션 → Yoopta 블록 배열 (제목 + 본문 + 이미지) */
function sectionToBlocks(section, imageData = {}) {
  const { allImages, sectionImages } = imageData;
  const out = [];
  if (section.label) out.push(headingBlock(section.label, 'HeadingTwo'));
  if (Array.isArray(section.blocks) && section.blocks.length > 0) {
    section.blocks.forEach(b => {
      if (b.type === 'image' && b.content) out.push(imageBlock(b.content, b.alt));
      else if (b.content) out.push(...textToParagraphs(b.content));
    });
  } else if (section.content) {
    out.push(...textToParagraphs(section.content));
  }
  // 경험 컬렉션(Firestore)에 인덱스로 저장된 섹션 이미지 보존
  (sectionImages?.[section.key] || []).forEach(imgIdx => {
    const img = allImages?.[imgIdx];
    if (img?.url) out.push(imageBlock(img.url, img.name || 'image'));
  });
  return out;
}

/** 블록 배열 → Yoopta value(객체). 비어 있으면 빈 단락 하나. */
export function blocksToYooptaValue(blocks = []) {
  const value = {};
  blocks.forEach((b, i) => {
    const block = { ...b, id: b.id || generateId(), meta: { ...(b.meta || {}), order: i, depth: b.meta?.depth ?? 0 } };
    value[block.id] = block;
  });
  if (Object.keys(value).length === 0) {
    const empty = paragraphBlock('');
    empty.meta = { order: 0, depth: 0 };
    value[empty.id] = empty;
  }
  return value;
}

/** 경험 → Yoopta 문서(value). 기존 상세 섹션을 노션 블록으로 변환. */
export function buildNotionDocFromExperience(exp, imageData = {}) {
  const blocks = [];
  buildRenderableSections(exp).forEach(section => { blocks.push(...sectionToBlocks(section, imageData)); });
  return blocksToYooptaValue(blocks);
}

// ── 팔레트 드래그 삽입용 ───────────────────────────────────────
/** 빈 섹션 템플릿(제목 + 빈 단락) */
export function sectionTemplateToBlocks(label) {
  return [headingBlock(label || '새 섹션', 'HeadingTwo'), paragraphBlock('')];
}

/** 빈 노션 문서(빈 단락 1개) — 미리보기 캔버스를 빈 화면으로 시작할 때 사용 */
export function emptyNotionDoc() {
  return blocksToYooptaValue([]);
}

function isPlaceholderText(text) {
  const t = String(text || '').trim();
  return !t || t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]');
}

/** 특정 섹션 키의 작성된 본문 (없거나 플레이스홀더면 '') */
function sectionContentForKey(exp, key) {
  const sr = exp?.structuredResult || {};
  const base = typeof sr[key] === 'string' ? sr[key] : '';
  if (base && !isPlaceholderText(base)) return base;
  const job = sr.jobSpecific?.[key];
  if (typeof job === 'string' && job.trim() && !isPlaceholderText(job)) return job;
  return '';
}

/** 팔레트 섹션 드래그 → 작성된 내용이 있으면 채워서, 없으면 빈 템플릿으로 */
export function sectionPaletteBlocks(exp, key, label) {
  const rendered = buildRenderableSections(exp).find(section => (
    (key && section.key === key) || (label && section.label === label)
  ));
  if (rendered && (rendered.content?.trim() || rendered.blocks?.length > 0)) {
    return sectionToBlocks(rendered);
  }
  const content = key ? sectionContentForKey(exp, key) : '';
  if (content) return [headingBlock(label || '새 섹션', 'HeadingTwo'), ...textToParagraphs(content)];
  return sectionTemplateToBlocks(label);
}

/** 핵심 경험 1건 → 블록 (H3 제목 + 요약 줄) */
function keyExperienceToBlocks(ke, index) {
  const blocks = [headingBlock(sanitizeText(ke?.title) || `핵심 경험 ${index + 1}`, 'HeadingThree')];
  const lines = [
    ke?.metric && `성과 · ${ke.metric}`,
    (ke?.situation || ke?.context) && `상황 · ${ke.situation || ke.context}`,
    ke?.action && `행동 · ${ke.action}`,
    ke?.result && `결과 · ${ke.result}`,
    ke?.learning && `배운 점 · ${ke.learning}`,
  ].filter(Boolean).filter(line => !isPlaceholderText(line));
  lines.forEach(line => blocks.push(...textToParagraphs(line)));
  if (blocks.length === 1) blocks.push(paragraphBlock(''));
  return blocks;
}

/** 팔레트에서 핵심 경험을 캔버스에 끼워 넣을 때 쓰는 블록 */
export function keyExperiencePaletteBlocks(exp, index = 0) {
  const keyExps = Array.isArray(exp?.structuredResult?.keyExperiences)
    ? exp.structuredResult.keyExperiences
    : [];
  const item = keyExps[index];
  return item ? keyExperienceToBlocks(item, index) : [];
}

/** 팔레트에서 모든 핵심 경험을 한 번에 끼워 넣을 때 쓰는 블록 */
export function allKeyExperiencePaletteBlocks(exp) {
  const keyExps = Array.isArray(exp?.structuredResult?.keyExperiences)
    ? exp.structuredResult.keyExperiences.filter(Boolean)
    : [];
  if (keyExps.length === 0) return [];
  const blocks = [headingBlock('핵심 경험', 'HeadingTwo')];
  keyExps.forEach((item, index) => blocks.push(...keyExperienceToBlocks(item, index)));
  return blocks;
}

/** 경험 정리 전체 → 초안 블록 (제목 + 속성 + 작성된 섹션 + 핵심경험) */
export function experienceDraftBlocks(exp, imageData = {}) {
  const sr = exp?.structuredResult || {};
  const overview = sr.projectOverview || {};
  const blocks = [headingBlock(sanitizeText(exp?.title) || '제목 없음', 'HeadingOne')];

  const props = [
    overview.duration && `기간 · ${overview.duration}`,
    overview.role && `역할 · ${overview.role}`,
    (Array.isArray(overview.techStack) && overview.techStack.length > 0) && `기술 · ${overview.techStack.join(', ')}`,
    overview.goal && `목표 · ${overview.goal}`,
  ].filter(Boolean).filter(line => !isPlaceholderText(line));
  props.forEach(line => blocks.push(paragraphBlock(sanitizeText(line))));

  buildRenderableSections(exp).forEach(section => { blocks.push(...sectionToBlocks(section, imageData)); });

  const keyExps = (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : []).filter(Boolean);
  if (keyExps.length > 0) {
    blocks.push(headingBlock('핵심 경험', 'HeadingTwo'));
    keyExps.forEach((ke, i) => blocks.push(...keyExperienceToBlocks(ke, i)));
  }

  if (blocks.length <= 1) blocks.push(paragraphBlock(''));
  return blocks;
}

/** 노션 문서(value) → 헤딩 목차 [{ id, level, text }] (Quick Menu용) */
export function extractHeadingsFromDoc(value) {
  if (!value || typeof value !== 'object') return [];
  const ordered = Object.values(value).filter(Boolean).sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));
  const out = [];
  ordered.forEach(block => {
    const level = block.type === 'HeadingOne' ? 1 : block.type === 'HeadingTwo' ? 2 : block.type === 'HeadingThree' ? 3 : 0;
    if (!level) return;
    const text = (block.value || []).map(slateText).join('').trim();
    if (text) out.push({ id: block.id, level, text });
  });
  return out;
}

/** AI 첨삭 결과 → 제목(H2) + 본문 블록 */
export function tailoredToBlocks(label, content) {
  return [headingBlock(label || '섹션', 'HeadingTwo'), ...(textToParagraphs(content).length ? textToParagraphs(content) : [paragraphBlock('')])];
}

/** 팔레트에 노출할 섹션 템플릿 목록(기본 7 + 직군 특화) */
export function getSectionTemplates(jobCategory) {
  const base = (FRAMEWORKS.STRUCTURED?.fields || []).map(f => ({ key: f.key, label: f.label }));
  const job = (JOB_SPECIFIC_FIELDS[jobCategory] || []).map(f => ({ key: f.key, label: f.label }));
  return [...base, ...job];
}

function slateText(node) {
  if (node == null) return '';
  if (typeof node.text === 'string') return node.text;
  return (node.children || []).map(slateText).join('');
}

/** Yoopta 문서 → 헤딩 기준으로 나눈 섹션 목록(AI 첨삭 입력용). */
export function extractSectionsFromDoc(value) {
  if (!value || typeof value !== 'object') return [];
  const ordered = Object.values(value).sort((a, b) => (a.meta?.order ?? 0) - (b.meta?.order ?? 0));
  const textOf = (block) => (block.value || []).map(slateText).join('\n').trim();
  const sections = [];
  let current = null;
  ordered.forEach(block => {
    const t = block.type;
    if (t === 'HeadingOne' || t === 'HeadingTwo' || t === 'HeadingThree') {
      current = { key: `doc-${sections.length}`, label: textOf(block) || '섹션', content: '' };
      sections.push(current);
    } else if (t === 'Image' || t === 'Divider') {
      // 텍스트 없는 블록은 건너뜀
    } else {
      const text = textOf(block);
      if (!text) return;
      if (!current) { current = { key: 'doc-0', label: '내용', content: '' }; sections.push(current); }
      current.content += (current.content ? '\n' : '') + text;
    }
  });
  return sections.filter(s => s.content.trim());
}

/** 기존 에디터에 블록 배열을 삽입(atOrder 위치, 없으면 끝). */
export function insertYooptaBlocks(editor, blocks, atOrder) {
  const value = editor.getEditorValue();
  const existing = Object.values(value || {});
  const insertAt = (atOrder == null) ? existing.length : atOrder;
  const next = {};
  existing.forEach(b => {
    const order = b.meta?.order ?? 0;
    next[b.id] = order >= insertAt ? { ...b, meta: { ...b.meta, order: order + blocks.length } } : b;
  });
  blocks.forEach((b, i) => {
    const block = { ...b, id: b.id || generateId(), meta: { ...(b.meta || {}), order: insertAt + i, depth: b.meta?.depth ?? 0 } };
    next[block.id] = block;
  });
  editor.setEditorValue(next);
}
