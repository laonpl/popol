/**
 * projectSections — 프로젝트(경험) 상세의 섹션 정의와
 * 경험 데이터 → Yoopta(노션) 문서 변환/삽입 유틸.
 *
 * 편집(NotionPortfolioEditor) · 미리보기(NotionPortfolioPreview) ·
 * 링크공유(PublicPortfolioView)에서 공통으로 사용한다.
 */
import { generateId } from '@yoopta/editor';
import { FRAMEWORKS, JOB_SPECIFIC_FIELDS } from '../stores/experienceStore';
import { contentBearingCoreSections } from './coreExperienceSections';

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
 * (직군 핵심 경험 파트는 JobCoreShowcase가 디자인으로 렌더링하므로 여기서 텍스트로 중복시키지 않는다)
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
  // 직군 핵심 경험 섹션 — 저장된 내보내기 구성(exportConfig)에 없어도 원본 데이터에서 채운다
  const core = key ? contentBearingCoreSections(exp).find(section => section.key === key) : null;
  if (core) return sectionToBlocks(normSection(core));
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

// ── 직군 산출물 → 초안 블록 ─────────────────────────────────────
// 경험 정리에서 이미 만들어진 산출물(서비스 개요·GitHub 기여/코드 근거·마케팅 KPI·린 캔버스)을
// 초안 만들기에 함께 배치한다. 데이터가 있는 산출물만 들어간다.

/** 문자열/배열/객체 값 → 한 줄 텍스트 */
function plainText(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(plainText).filter(Boolean).join('\n');
  if (typeof v === 'object') return Object.values(v).filter(x => typeof x === 'string').map(s => s.trim()).filter(Boolean).join(' ');
  return String(v).trim();
}
const usableText = (v) => {
  const t = sanitizeText(plainText(v)).trim();
  return t && !isPlaceholderText(t) ? t : '';
};

/** 서비스 개요 — product(문제·해결·핵심 기능·주요 성과), 전 직군 공통 */
function productDraftBlocks(sr) {
  const p = sr.product && typeof sr.product === 'object' ? sr.product : {};
  const tagline = usableText(p.tagline);
  const problem = usableText(p.problem);
  const solution = usableText(p.solution);
  const features = (Array.isArray(p.features) ? p.features : [])
    .map(f => ({ name: usableText(f?.name), desc: usableText(f?.desc) })).filter(f => f.name);
  const outcomes = (Array.isArray(p.outcomes) ? p.outcomes : [])
    .map(o => ({ label: usableText(o?.label), value: usableText(o?.value) })).filter(o => o.label || o.value);
  if (!problem && !solution && features.length === 0 && outcomes.length === 0) return [];
  const blocks = [headingBlock('서비스 개요', 'HeadingTwo')];
  if (tagline) blocks.push(paragraphBlock(tagline));
  if (problem) blocks.push(headingBlock('문제', 'HeadingThree'), ...textToParagraphs(problem));
  if (solution) blocks.push(headingBlock('해결 방식', 'HeadingThree'), ...textToParagraphs(solution));
  if (features.length > 0) {
    blocks.push(headingBlock('핵심 기능', 'HeadingThree'));
    features.slice(0, 8).forEach(f => blocks.push(paragraphBlock(f.desc ? `${f.name} — ${f.desc}` : f.name)));
  }
  if (outcomes.length > 0) {
    blocks.push(headingBlock('주요 성과', 'HeadingThree'));
    outcomes.slice(0, 8).forEach(o => blocks.push(paragraphBlock(`${o.label || '성과'} · ${o.value}`)));
  }
  return blocks;
}

/** 개발자 — GitHub 기여 요약(잔디·기여율·언어) + 커밋 근거 문제 해결(코드 리뷰) */
function githubDraftBlocks(sr) {
  const blocks = [];
  const stats = sr.githubStats && typeof sr.githubStats === 'object' ? sr.githubStats : null;
  if (stats) {
    const lines = [];
    if (stats.repoName) lines.push(`리포지토리 · ${stats.repoName}`);
    if (Number(stats.contributionPct) > 0) lines.push(`커밋 기여 비중 · ${stats.contributionPct}% (내 커밋 ${stats.myCommits ?? '—'} / 전체 ${stats.totalCommits ?? '—'})`);
    else if (stats.myCommits) lines.push(`내 커밋 · ${stats.myCommits}건`);
    const langs = (Array.isArray(stats.languages) ? stats.languages : []).filter(l => l?.name);
    if (langs.length > 0) lines.push(`주요 언어 · ${langs.slice(0, 5).map(l => (l.pct != null ? `${l.name} ${l.pct}%` : l.name)).join(', ')}`);
    const days = Array.isArray(stats.dailyActivity) ? stats.dailyActivity : [];
    if (days.length > 0) {
      const activeDays = days.filter(d => (d?.count || 0) > 0).length;
      const totalCommits = days.reduce((s, d) => s + (d?.count || 0), 0);
      const period = stats.activePeriod ? ` (${stats.activePeriod.first} ~ ${stats.activePeriod.last})` : '';
      lines.push(`커밋 활동 · ${activeDays}일 활동, 커밋 ${totalCommits}건${period}`);
    } else if (stats.activePeriod) {
      lines.push(`활동 기간 · ${stats.activePeriod.first} ~ ${stats.activePeriod.last}`);
    }
    if (lines.length > 0) {
      blocks.push(headingBlock('GitHub 기여 요약', 'HeadingTwo'));
      lines.forEach(l => blocks.push(paragraphBlock(sanitizeText(l))));
    }
  }
  const gitExps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences.filter(Boolean) : [];
  if (gitExps.length > 0) {
    blocks.push(headingBlock('코드로 보는 문제 해결', 'HeadingTwo'));
    gitExps.slice(0, 4).forEach((e, i) => {
      blocks.push(headingBlock(usableText(e.project_name) || `문제 해결 ${i + 1}`, 'HeadingThree'));
      const lines = [
        usableText(e.core_tech_stack) && `기술 · ${usableText(e.core_tech_stack)}`,
        usableText(e.core_impact) && `임팩트 · ${usableText(e.core_impact)}`,
        usableText(e.problem_definition) && `문제 · ${usableText(e.problem_definition)}`,
        usableText(e.action_and_solution) && `해결 · ${usableText(e.action_and_solution)}`,
        usableText(e.troubleshooting) && `트러블슈팅 · ${usableText(e.troubleshooting)}`,
        usableText(e.learning) && `배운 점 · ${usableText(e.learning)}`,
      ].filter(Boolean);
      lines.forEach(l => blocks.push(...textToParagraphs(l)));
      // 코드 리뷰 근거 — 어떤 파일의 어떤 변경이 왜 필요했는지
      (Array.isArray(e.code_snippets) ? e.code_snippets : []).slice(0, 2).forEach(s => {
        const why = usableText(s?.why);
        if (why) blocks.push(paragraphBlock(`코드 리뷰 · ${s.file ? `${s.file} — ` : ''}${why}`));
      });
    });
  }
  return blocks;
}

/** 마케터 — 캠페인 스토리(퍼널)·이력서 bullet·KPI 증거 자료 */
const FUNNEL_DRAFT_LABELS = [
  ['problem', '문제'], ['goal', '목표/KPI'], ['target', '타깃'], ['strategy', '전략'],
  ['execution', '실행'], ['result', '성과'], ['insight', '인사이트'],
];
function marketerDraftBlocks(sr) {
  const kit = sr.marketerKit && typeof sr.marketerKit === 'object' ? sr.marketerKit : null;
  if (!kit) return [];
  const blocks = [];
  const funnel = kit.funnel && typeof kit.funnel === 'object' ? kit.funnel : {};
  const funnelLines = FUNNEL_DRAFT_LABELS
    .map(([key, label]) => { const v = usableText(funnel[key]); return v ? `${label} · ${v}` : ''; })
    .filter(Boolean);
  if (funnelLines.length > 0) {
    blocks.push(headingBlock('캠페인 스토리', 'HeadingTwo'));
    funnelLines.forEach(l => blocks.push(...textToParagraphs(l)));
  }
  const bullets = (Array.isArray(kit.resumeVariants) && kit.resumeVariants.length > 0
    ? kit.resumeVariants.map(r => r?.sentence || r?.text)
    : (Array.isArray(kit.resumeBullets) ? kit.resumeBullets : [])
  ).map(usableText).filter(Boolean);
  if (bullets.length > 0) {
    blocks.push(headingBlock('이력서 한 줄 성과', 'HeadingThree'));
    bullets.slice(0, 5).forEach(b => blocks.push(paragraphBlock(b)));
  }
  const evidence = (Array.isArray(kit.evidenceChecklist) ? kit.evidenceChecklist : []).map(usableText).filter(Boolean);
  if (evidence.length > 0) {
    blocks.push(headingBlock('KPI 증거 자료', 'HeadingThree'));
    evidence.slice(0, 6).forEach(v => blocks.push(paragraphBlock(v)));
  }
  return blocks;
}

/** 기획/PM — 린 캔버스 요약 */
function leanCanvasDraftBlocks(sr) {
  const lc = sr.leanCanvas && typeof sr.leanCanvas === 'object' ? sr.leanCanvas : null;
  if (!lc) return [];
  const lines = [
    ['existingAlternatives', '기존 대안'], ['uvp', '고유 가치 제안'],
    ['customers', '고객 세그먼트'], ['earlyAdopters', '얼리어답터'],
  ].map(([key, label]) => { const v = usableText(lc[key]); return v ? `${label} · ${v}` : ''; }).filter(Boolean);
  if (lines.length === 0) return [];
  return [headingBlock('린 캔버스 요약', 'HeadingTwo'), ...lines.map(l => paragraphBlock(l))];
}

/** 직군 특화 텍스트 섹션 라벨 (jobSpecific 보충용) */
const JOB_FIELD_LABELS = Object.fromEntries(
  Object.values(JOB_SPECIFIC_FIELDS).flat().map(f => [f.key, f.label])
);

/** 경험 정리 전체 → 초안 블록 (제목 + 속성 + 서비스 개요 + 작성된 섹션 + 핵심경험 + 직군 산출물) */
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

  // 서비스 개요(product) — 소개 최상단에 배치
  blocks.push(...productDraftBlocks(sr));

  const rendered = buildRenderableSections(exp);
  rendered.forEach(section => { blocks.push(...sectionToBlocks(section, imageData)); });

  // 직군 특화 텍스트 섹션이 렌더 목록에 빠졌으면 보충 (예: exportConfig.sections가 7섹션만 담고 있을 때)
  const renderedKeys = new Set(rendered.map(s => s.key));
  Object.entries(sr.jobSpecific || {}).forEach(([key, value]) => {
    if (renderedKeys.has(key)) return;
    const content = usableText(value);
    if (!content) return;
    blocks.push(headingBlock(JOB_FIELD_LABELS[key] || key, 'HeadingTwo'), ...textToParagraphs(content));
  });

  const keyExps = (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : []).filter(Boolean);
  if (keyExps.length > 0) {
    blocks.push(headingBlock('핵심 경험', 'HeadingTwo'));
    keyExps.forEach((ke, i) => blocks.push(...keyExperienceToBlocks(ke, i)));
  }

  // 직군 산출물 — GitHub 기여/코드 근거(개발), 캠페인 KPI(마케팅), 린 캔버스(기획/PM)
  blocks.push(...githubDraftBlocks(sr), ...marketerDraftBlocks(sr), ...leanCanvasDraftBlocks(sr));

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

// ============================================================
// 구성 계획 기반 조립 (composeDraftBlocks)
//   experienceDraftBlocks는 모든 경험을 같은 순서로 조립해 결과물 골격이 늘 동일했다.
//   여기서는 백엔드가 만든 구성 계획(plan)을 따라
//   "무엇을 · 어떤 순서로 · 어떤 제목으로" 넣을지 경험마다 다르게 조립한다.
//   plan이 없으면 호출부가 experienceDraftBlocks로 폴백한다.
// ============================================================

/** 판단 지도 — 대안 비교·선택 기준·바뀐 원칙 */
function decisionTraceBlocks(keyExps) {
  const blocks = [];
  keyExps.forEach((ke, i) => {
    const t = ke?.decisionTrace || {};
    const alts = (Array.isArray(t.alternatives) ? t.alternatives : [])
      .map(a => (typeof a === 'string' ? a : [a?.option, a?.reasonNotChosen || a?.cons].filter(Boolean).join(' — ')))
      .filter(Boolean);
    const crit = (Array.isArray(t.decisionCriteria) ? t.decisionCriteria : [])
      .map(c => (typeof c === 'string' ? c : [c?.criterion, c?.why].filter(Boolean).join(' — ')))
      .filter(Boolean);
    const lines = [
      usableText(t.problemJudgment) && `문제 판단 · ${usableText(t.problemJudgment)}`,
      usableText(t.problemEvidence) && `판단 근거 · ${usableText(t.problemEvidence)}`,
      ...alts.map(a => `검토한 대안 · ${a}`),
      ...crit.map(c => `선택 기준 · ${c}`),
      usableText(t.choice) && `최종 선택 · ${usableText(t.choice)}`,
      usableText(t.changedJudgment) && `바뀐 판단 · ${usableText(t.changedJudgment)}`,
      usableText(t.newPrinciple) && `다음 원칙 · ${usableText(t.newPrinciple)}`,
    ].filter(Boolean);
    if (lines.length === 0) return;
    blocks.push(headingBlock(sanitizeText(ke?.title) || `판단 ${i + 1}`, 'HeadingThree'));
    lines.forEach(l => blocks.push(...textToParagraphs(l)));
  });
  return blocks;
}

/** 증거 자료 목록 — 주장 옆에 붙는 근거 */
function evidenceBlocks(keyExps) {
  const rows = keyExps.flatMap(ke => (Array.isArray(ke?.evidenceBundle) ? ke.evidenceBundle : []))
    .map(e => [usableText(e?.sourceRef) || usableText(e?.type), usableText(e?.whatItProves) || usableText(e?.claim),
      usableText(e?.ownership) && `기여: ${usableText(e.ownership)}`, usableText(e?.status) && `(${usableText(e.status)})`]
      .filter(Boolean).join(' · '))
    .filter(Boolean);
  return rows.map(r => paragraphBlock(r));
}

/** 솔직 회고 — 막힌 지점·오판·한계·다시 한다면 */
function honestReviewBlocks(keyExps) {
  const blocks = [];
  keyExps.forEach(ke => {
    const h = ke?.honestReview || {};
    const lines = [
      usableText(h.struggle) && `막혔던 지점 · ${usableText(h.struggle)}`,
      usableText(h.misjudgment) && `예상과 달랐던 점 · ${usableText(h.misjudgment)}`,
      usableText(h.limitation) && `남은 한계 · ${usableText(h.limitation)}`,
      usableText(h.nextTime) && `다시 한다면 · ${usableText(h.nextTime)}`,
    ].filter(Boolean);
    lines.forEach(l => blocks.push(...textToParagraphs(l)));
  });
  return blocks;
}

/** 사용자의 실제 말 인용 */
function voiceBlocks(keyExps) {
  return keyExps.map(ke => usableText(ke?.voiceRecord?.originalQuote))
    .filter(Boolean).map(q => paragraphBlock(`"${q}"`));
}

/** 지표 시각화 데이터 → 텍스트 요약 (캔버스는 텍스트 기반이라 수치만 옮긴다) */
function visualBlocks(sr) {
  const pv = sr?.portfolioVisuals || {};
  const lines = [
    ...(Array.isArray(pv.kpis) ? pv.kpis : []).map(k => [usableText(k?.label), usableText(k?.value)].filter(Boolean).join(' · ')),
    ...(Array.isArray(pv.compare) ? pv.compare : []).map(c => {
      const l = usableText(c?.label), b = usableText(c?.before), a = usableText(c?.after);
      return l && (b || a) ? `${l} · ${b} → ${a}` : '';
    }),
  ].filter(Boolean);
  return lines.map(l => paragraphBlock(l));
}

/** 직군 특화 섹션 전체 */
function jobSpecificBlocks(sr) {
  const blocks = [];
  Object.entries(sr?.jobSpecific || {}).forEach(([key, value]) => {
    const content = usableText(value);
    if (!content) return;
    blocks.push(headingBlock(JOB_FIELD_LABELS[key] || key, 'HeadingThree'), ...textToParagraphs(content));
  });
  return blocks;
}

/** source key → 실제 블록. 내용이 없으면 빈 배열을 돌려 섹션 자체가 생략된다. */
function blocksForSource(source, exp, sr, keyExps, imageData) {
  switch (source) {
    case 'product': return productDraftBlocks(sr);
    case 'keyExperiences': return keyExps.flatMap((ke, i) => keyExperienceToBlocks(ke, i));
    case 'decisionTrace': return decisionTraceBlocks(keyExps);
    case 'evidenceBundle': return evidenceBlocks(keyExps);
    case 'honestReview': return honestReviewBlocks(keyExps);
    case 'voiceRecord': return voiceBlocks(keyExps);
    case 'jobSpecific': return jobSpecificBlocks(sr);
    case 'githubStats': return githubDraftBlocks(sr);
    case 'marketerKit': return marketerDraftBlocks(sr);
    case 'leanCanvas': return leanCanvasDraftBlocks(sr);
    case 'portfolioVisuals': return visualBlocks(sr);
    default: {
      // 기본 7섹션(intro/overview/task/process/output/growth/competency)
      const content = usableText(sr?.[source]);
      if (!content) return [];
      return sectionToBlocks({ key: source, label: '', content, blocks: [] }, imageData)
        .filter(b => b.type !== 'HeadingTwo');
    }
  }
}

/**
 * 구성 계획(plan)에 따라 경험을 조립한다.
 * plan.sections의 순서·제목을 그대로 쓰되, 내용이 비어 있는 블록은 건너뛴다.
 */
export function composeDraftBlocks(exp, imageData = {}, plan = null) {
  if (!plan?.sections?.length) return experienceDraftBlocks(exp, imageData);
  const sr = exp?.structuredResult || {};
  const allKeyExps = (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : []).filter(Boolean);

  // 계획이 지정한 순서로 핵심 경험을 재배열 (지원 직무와 가장 관련 있는 것을 앞으로)
  const order = (plan.keyExperienceOrder || []).filter(i => i < allKeyExps.length);
  const keyExps = order.length
    ? [...order.map(i => allKeyExps[i]), ...allKeyExps.filter((_, i) => !order.includes(i))]
    : allKeyExps;

  const blocks = [headingBlock(sanitizeText(exp?.title) || '제목 없음', 'HeadingOne')];
  if (usableText(plan.headline)) blocks.push(paragraphBlock(usableText(plan.headline)));

  const overview = sr.projectOverview || {};
  [
    overview.duration && `기간 · ${overview.duration}`,
    overview.role && `역할 · ${overview.role}`,
    Array.isArray(overview.techStack) && overview.techStack.length > 0 && `기술 · ${overview.techStack.join(', ')}`,
  ].filter(Boolean).filter(l => !isPlaceholderText(l)).forEach(l => blocks.push(paragraphBlock(sanitizeText(l))));

  // 문단 단위 중복 제거 — 같은 문장이 product·intro·task·핵심경험에 겹쳐 들어가는 것을 막는다.
  // (섹션 종류는 계획 단계에서 이미 중복 제거됨. 여기서는 "내용"의 중복을 막는다)
  const seenText = new Set();
  const dedupeKey = (block) => {
    if (!block || block.type === 'Image') return null;
    const text = (block.value || [])
      .map(node => slateText(node))
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/[·.,!?~\-—]/g, '')
      .trim()
      .toLowerCase();
    return text.length >= 12 ? text : null; // 짧은 라벨성 문구는 중복 판정에서 제외
  };

  plan.sections.forEach(section => {
    const body = blocksForSource(section.source, exp, sr, keyExps, imageData);
    const fresh = body.filter(block => {
      const key = dedupeKey(block);
      if (!key) return true;
      if (seenText.has(key)) return false;
      seenText.add(key);
      return true;
    });
    // 헤딩만 남고 본문이 전부 중복이면 섹션 자체를 넣지 않는다
    const hasBody = fresh.some(b => b.type === 'Image' || dedupeKey(b) || b.type === 'HeadingThree');
    if (fresh.length === 0 || !hasBody) return;
    blocks.push(headingBlock(sanitizeText(section.title) || section.source, 'HeadingTwo'), ...fresh);
  });

  if (blocks.length <= 1) return experienceDraftBlocks(exp, imageData);
  return blocks;
}
