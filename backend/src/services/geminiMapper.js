// Gemini 기반 PPT 콘텐츠 매핑.
//
// 단계:
//  (1) 템플릿 각 슬라이드의 originalText 키워드로 종류 분류
//      (cover/about/skills/project/experience/education/awards/contact/generic).
//  (2) 사용자 데이터 → desired 섹션 목록을 만들고 affinity 점수로 가장 잘 맞는
//      템플릿 슬라이드에 그리디 매칭. 같은 슬라이드 재사용에 페널티 부여로 분산.
//  (3) 슬라이드별로 독립 프롬프트를 만들어 Gemini Flash-Lite 에 병렬 호출.
//      각 호출은 해당 슬라이드의 slots 와 그 섹션에 필요한 portfolio 부분집합만
//      포함 → 프롬프트가 작아 빠르고, 실패해도 그 슬라이드만 결정적 폴백.
//
// 한 번의 거대한 Pro 호출 (60s+ 흔함) 대신 N 개의 작은 Lite 병렬 호출 (~10s) 로
// 응답 시간을 대폭 단축.

import { generateWithRetry } from '../config/geminiClient.js';
import { parseJSON } from './geminiService.js';
import { estimateMaxChars } from './autofit.js';

const _estimateMaxChars = estimateMaxChars;

// PPT 슬라이드 매핑: Pro 우선, Flash 폴백, Lite 최후 안전망
// callTimeoutMs=40s: 병렬 실행 시 각 모델 호출에 40s만 할당 (90s는 너무 느림)
// retries=1: 모델당 1번만 시도하고 실패 시 즉시 다음 모델로 (빠른 폴백)
const PPT_SLIDE_OPTIONS = {
  models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  retries: 3,  // GEMINI_TIMEOUT 포함 최대 3회 시도 후 다음 모델로 폴백
  delayMs: 2000,
  rateLimitDelayMs: 5000,
  callTimeoutMs: 80000, // 40s → 80s (Pro 2.5 응답 지연 대응)
};
const PER_SLIDE_TIMEOUT_MS = 120000; // 큐 해제 후 시작 기준 (mapSlide 내부에서만 적용)

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 타임아웃 (${ms / 1000}s 초과)`)), ms)
    ),
  ]);
}

// ── 1) 포트폴리오 정규화 ─────────────────────────────────────────────────────
function findSectionByLabel(subSections, ...labels) {
  for (const label of labels) {
    const lc = label.toLowerCase();
    const hit = subSections.find(s => (s.label || '').toLowerCase().includes(lc));
    if (hit?.content) return hit.content;
  }
  return '';
}

function normalizeProject(exp) {
  if (!exp || typeof exp !== 'object') return null;
  const sr = exp.structuredResult || {};
  const overview = sr.projectOverview || {};
  const carl = exp.content || sr.content || {};

  const techStack = Array.from(new Set([
    ...(Array.isArray(exp.skills) ? exp.skills : []),
    ...(Array.isArray(overview.techStack) ? overview.techStack : []),
    ...(Array.isArray(exp.projectTechStack) ? exp.projectTechStack : []),
  ].filter(Boolean)));

  const keyExperiences = (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [])
    .map(ke => ({
      title: ke?.title || '',
      metric: ke?.metric || '',
      metricLabel: ke?.metricLabel || '',
      beforeMetric: ke?.beforeMetric || '',
      afterMetric: ke?.afterMetric || '',
      situation: ke?.situation || '',
      action: ke?.action || '',
      result: ke?.result || '',
      description: ke?.description || ke?.content || '',
    }))
    .filter(ke => ke.title || ke.metric || ke.situation || ke.action || ke.result);

  const exportSections = Array.isArray(sr.exportConfig?.sections) ? sr.exportConfig.sections : [];
  const subSections = [
    ...exportSections,
    ...(Array.isArray(sr.sections) ? sr.sections : []),
    ...(Array.isArray(exp.sections) ? exp.sections : []),
    ...(Array.isArray(exp.customSections) ? exp.customSections : []),
  ]
    .map(s => ({ key: s?.key || '', label: s?.label || s?.title || '', content: s?.content || s?.body || '' }))
    .filter(s => s.label || s.content);

  const byKey = (k) => subSections.find(s => s.key === k)?.content || '';
  // structuredResult 의 각 섹션 → 없으면 직접 경험 필드(exp.task 등) → subSections 검색 순서로 폴백.
  // 사용자가 경험 구조화 폼에서 직접 입력한 필드들은 exp.* 에 저장된다.
  const intro      = sr.intro      || exp.intro      || byKey('intro')      || findSectionByLabel(subSections, '프로젝트 소개', 'intro') || exp.description || overview.summary || '';
  const overviewT  = sr.overview   || exp.overview   || byKey('overview')   || findSectionByLabel(subSections, '프로젝트 개요', 'overview') || overview.background || '';
  const task       = sr.task       || exp.task       || byKey('task')       || findSectionByLabel(subSections, '진행한 일', 'task') || '';
  const process    = sr.process    || exp.process    || byKey('process')    || findSectionByLabel(subSections, '과정', 'process') || carl.action || '';
  const output     = sr.output     || exp.output     || byKey('output')     || findSectionByLabel(subSections, '결과물', 'output') || sr.deliverable || sr.deliverables || carl.result || '';
  const growth     = sr.growth     || exp.growth     || byKey('growth')     || findSectionByLabel(subSections, '성장한 점', '성과', 'growth') || carl.learning || '';
  const competency = sr.competency || exp.competency || sr.myCompetency || byKey('competency') || findSectionByLabel(subSections, '나의 역량', '역량', 'competency') || '';
  const problem    = carl.context  || carl.problem   || carl.background || exp.problem || findSectionByLabel(subSections, '문제', 'problem') || '';
  const action     = carl.action   || exp.action     || process || findSectionByLabel(subSections, '핵심행동', 'action') || '';

  return {
    title: exp.title || '',
    role: overview.role || exp.role || '',
    period: overview.period || exp.date || exp.period || '',
    description: exp.description || overview.summary || intro,
    techStack,
    intro,
    overview: overviewT || intro,
    task,
    process,
    output,
    growth,
    competency,
    problem,
    action,
    result: output,
    learning: growth,
    keyExperiences,
    subSections,
    contribution: exp.contribution || null,
    link: exp.link || '',
  };
}

function normalizePortfolio(p) {
  const projects = (Array.isArray(p.experiences) ? p.experiences : [])
    .map(normalizeProject)
    .filter(Boolean);

  return {
    about: {
      name: p.userName || '',
      headline: p.headline || '',
      essay: p.valuesEssay || '',
      values: Array.isArray(p.values) ? p.values : [],
      goals: Array.isArray(p.goals) ? p.goals : [],
    },
    skills: p.skills || {},
    projects,
    education: Array.isArray(p.education) ? p.education : [],
    awards: Array.isArray(p.awards) ? p.awards : [],
    interests: p.interests || [],
    contact: p.contact || {},
    targetCompany: p.targetCompany || '',
    targetPosition: p.targetPosition || '',
    title: p.title || '포트폴리오',
  };
}

// ── 2) 템플릿 슬라이드 분류 ──────────────────────────────────────────────────
const KIND_KEYWORDS = {
  cover:     ['표지', '커버', '포트폴리오', 'portfolio', '이름', 'profile', '프로필'],
  about:     ['소개', '자기소개', '가치관', '비전', '미션', 'about', 'values', '강점', 'introduction'],
  skills:    ['기술', '스킬', '스택', '역량', '도구', '프레임워크', '언어', 'skill', 'stack', 'tool', 'framework', 'tech'],
  project:   ['프로젝트', 'project', '작업물', '소개', '개요', 'overview', 'case study', 'work'],
  metric:    ['지표', '수치', '차트', '그래프', '데이터', 'kpi', 'metric', '%', 'before', 'after', '↑', '↓', '증가', '감소'],
  problem:   ['문제', '배경', '이슈', 'problem', 'issue', 'background', '핵심행동', '진행', '과정', 'task', 'process', 'action', '해결', 'solution', 'ideate', 'prototype', 'develop', 'test', 'iteration', 'research'],
  result:    ['결과', '성과', '결과물', 'result', 'output', 'achievement', '산출물'],
  growth:    ['성장', '배운', '회고', '학습', 'growth', 'learning', 'retrospect', '나의 역량', 'competency'],
  experience:['경력', '경험', '활동', '인턴', '업무', 'experience', 'career', 'work'],
  education: ['학력', '교육', '학교', '전공', '학과', 'education', 'degree'],
  awards:    ['수상', '상', '자격', '인증', 'award', 'certificate', 'license'],
  contact:   ['연락처', '이메일', '문의', 'contact', 'email', '@'],
};

function classifySlideKind(tplSlide) {
  if (!tplSlide || !tplSlide.textBoxes) return 'generic';
  const allText = tplSlide.textBoxes
    .map(b => (b.originalText || '').toLowerCase())
    .filter(Boolean)
    .join(' ');
  if (!allText.trim()) return 'generic';

  const titles = tplSlide.textBoxes
    .filter(b => b.role === 'title' || (b.fontPt || 0) >= 28)
    .map(b => (b.originalText || '').toLowerCase());
  const titleText = titles.join(' ');

  const scoreFor = (kind) => {
    const kws = KIND_KEYWORDS[kind] || [];
    let score = 0;
    for (const kw of kws) {
      if (allText.includes(kw)) score += 1;
      if (titleText.includes(kw)) score += 2;
    }
    return score;
  };

  let best = 'generic', bestScore = 0;
  for (const kind of Object.keys(KIND_KEYWORDS)) {
    const s = scoreFor(kind);
    if (s > bestScore) { best = kind; bestScore = s; }
  }
  return bestScore > 0 ? best : 'generic';
}

// ── 3-a) 프로젝트 데이터 밀도 측정 ─────────────────────────────────────────
// 각 섹션 데이터의 문자 수 합계를 세어 "이 프로젝트가 몇 슬라이드가 필요한지" 판단.
// • overview 가 intro 로 fallback 됐을 때 중복 카운트하지 않도록 동일 내용은 1회만.
function measureProjectDensity(p) {
  const keyExperienceText = (p.keyExperiences || [])
    .flatMap(ke => [ke.title, ke.metric, ke.metricLabel, ke.situation, ke.action, ke.result, ke.description])
    .filter(Boolean)
    .join(' ');
  // overview 가 intro 와 동일한 fallback 일 때 제외 (중복 카운트 → 슬라이드 수 과대평가 방지)
  const overviewField = (p.overview && p.overview !== p.intro) ? p.overview : null;
  const fields = [p.intro, overviewField, p.task, p.problem, p.action, p.process, p.output, p.growth, p.competency, keyExperienceText];
  const total = fields.filter(Boolean).reduce((s, f) => s + f.length, 0);
  const hasMetric = (p.keyExperiences || []).some(ke => ke.metric || ke.beforeMetric || ke.afterMetric);
  return { totalChars: total, hasMetric };
}

// 슬라이드 한 장의 총 char_budget 추정 (textBoxes 기준)
function estimateSlideCapacity(tplSlide) {
  return (tplSlide.textBoxes || []).reduce((s, b) => {
    return s + _estimateMaxChars({ boxWidthPt: b.w, boxHeightPt: b.h, basePt: b.fontPt || 14 });
  }, 0);
}

function estimatePackingCapacity(layout, tplKinds) {
  const caps = (layout.slides || [])
    .map((slide, i) => ({
      capacity: estimateSlideCapacity(slide),
      kind: tplKinds[i]?.kind || 'generic',
      boxCount: (slide.textBoxes || []).length,
    }))
    .filter(x => x.capacity > 0);
  const contentKinds = new Set(['project', 'problem', 'result', 'metric', 'generic']);
  const contentCaps = caps
    .filter(x => contentKinds.has(x.kind) && x.boxCount >= 3)
    .map(x => x.capacity)
    .sort((a, b) => b - a);
  const basis = contentCaps.length ? contentCaps : caps.map(x => x.capacity).sort((a, b) => b - a);
  const top = basis.slice(0, Math.min(3, basis.length));
  const avgTop = top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
  return Math.max(500, avgTop);
}

// ── 3-b) 프로젝트 섹션 목록 → Smart Packing 적용 ────────────────────────────
// "한 장에 모두 담기" 판정 기준:
//   단일 템플릿 슬라이드의 평균 용량(avgSlideCapacity) 대비 프로젝트 전체 데이터가
//   1.2 슬라이드 이하 → merged_project 단일 섹션으로 처리.
//   2.5 슬라이드 이하 → 2그룹(intro+PAR | metric+output+growth)으로 압축.
function buildProjectSections(proj, projIndex, packingCapacity, totalProjects) {
  const { totalChars, hasMetric } = measureProjectDensity(proj);
  // 슬라이드 한 장 기준으로 몇 장 필요한지 추정
  const cap = packingCapacity > 0 ? packingCapacity : 500;
  const estimatedSlides = totalChars / cap;
  const needsDivider = totalProjects > 1;

  // ─ 케이스 A: 매우 짧음 → divider + 통합 1장 ────────────────────────────────
  if (estimatedSlides <= 1.5) {
    const sections = [];
    if (needsDivider) sections.push({ kind: 'project_divider', sectionType: 'project_divider', sectionParam: projIndex });
    sections.push({ kind: 'project_merged', sectionType: 'project_merged', sectionParam: projIndex });
    return sections;
  }

  // ─ 케이스 B: 중간 → divider + intro 1장 + PAR 통합 1장 [+ metric] ──────────
  if (estimatedSlides <= 3.5) {
    const sections = [
      // intro + overview + techStack 묶음
      { kind: 'project_overview', sectionType: 'project_intro',    sectionParam: projIndex },
      // problem + action + output + growth + competency 묶음
      { kind: 'project_problem',  sectionType: 'project_par',      sectionParam: projIndex },
    ];
    if (needsDivider) sections.unshift({ kind: 'project_divider', sectionType: 'project_divider', sectionParam: projIndex });
    if (hasMetric) {
      sections.push({ kind: 'project_metric', sectionType: 'project_metric', sectionParam: projIndex });
    }
    return sections;
  }

  // ─ 케이스 C: 충분한 콘텐츠 → 최대 6슬라이드 세분화 ──────────────────────────
  // (기존 최대 9슬라이드에서 축소: task+problem 통합, output+growth+competency 통합)
  const sections = [];
  if (needsDivider) sections.push({ kind: 'project_divider', sectionType: 'project_divider', sectionParam: projIndex });
  // Intro: 항상 포함 (title + intro + tech + meta)
  sections.push({ kind: 'project_overview', sectionType: 'project_intro', sectionParam: projIndex });
  // Overview: intro 와 다른 충분한 내용이 있을 때만 별도 슬라이드
  if (proj.overview && proj.overview !== proj.intro && proj.overview.length > 80) {
    sections.push({ kind: 'project_overview', sectionType: 'project_overview', sectionParam: projIndex });
  }
  // Problem: task + problem + action + process 를 1장에 통합
  if (proj.task || proj.problem || proj.action || proj.process) {
    sections.push({ kind: 'project_problem', sectionType: 'project_problem', sectionParam: projIndex });
  }
  // Metric: 수치 성과 (있을 때만)
  if (hasMetric) {
    sections.push({ kind: 'project_metric', sectionType: 'project_metric', sectionParam: projIndex });
  }
  // Result: output + growth + competency 를 1장에 통합
  if (proj.output || proj.growth || proj.competency) {
    sections.push({ kind: 'project_result', sectionType: 'project_result', sectionParam: projIndex });
  }
  return sections;
}


const KIND_MATCH = {
  cover:              { cover: 100, generic: 50 },
  about:              { about: 100, cover: 35, generic: 60 },
  skills:             { skills: 100, project: 30, generic: 55 },
  // 프로젝트 섹션 구분 — cover/about 스타일 (제목 위주의 단순 슬라이드) 선호
  project_divider:    { cover: 100, about: 70, generic: 60, project: 50 },
  // 프로젝트 카드/소개
  project_intro:      { project: 100, about: 50, generic: 60 },
  project_overview:   { project: 100, about: 50, generic: 60 },
  // 진행한 일 / 문제상황
  project_task:       { problem: 100, project: 70, generic: 55 },
  project_problem:    { problem: 100, project: 70, generic: 55 },
  // 시각화 지표
  project_metric:     { metric: 100, result: 70, project: 50, generic: 50 },
  // 결과물 / 성장 / 역량
  project_output:     { result: 100, project: 60, generic: 55 },
  project_result:     { result: 100, growth: 80, project: 60, generic: 55 },
  project_growth:     { growth: 100, result: 70, project: 50, generic: 55 },
  project_competency: { growth: 100, about: 70, project: 50, generic: 55 },
  // Smart Packing 병합 섹션
  project_merged:     { project: 100, problem: 80, result: 70, generic: 60 },
  project_par:        { problem: 100, result: 80, project: 70, generic: 55 },
  experience:         { experience: 100, project: 70, generic: 55 },
  education:          { education: 100, awards: 35, generic: 55 },
  awards:             { awards: 100, education: 35, generic: 55 },
  contact:            { contact: 100, cover: 35, generic: 55 },
};
// 노션형 포트폴리오는 프로젝트당 최대 9슬라이드 → 페널티가 너무 크면 적합하지 않은
// 템플릿으로 분산됨. 낮은 페널티 = 가장 적합한 템플릿을 우선 재사용.
const REUSE_PENALTY = 5;

export function planDeck(layout, portfolio) {
  const norm = normalizePortfolio(portfolio);

  const tplKinds = (layout.slides || []).map((s, i) => ({
    index: i,
    kind: classifySlideKind(s),
    boxCount: (s.textBoxes || []).length,
  }));

  const desired = [];
  desired.push({ kind: 'cover', sectionType: 'cover', sectionParam: null });
  if (norm.about.essay || norm.about.values.length || norm.about.goals.length || norm.about.headline) {
    desired.push({ kind: 'about', sectionType: 'about', sectionParam: null });
  }
  if (norm.skills && Object.keys(norm.skills).length) {
    desired.push({ kind: 'skills', sectionType: 'skills', sectionParam: null });
  }

  // Smart Packing: 실제 콘텐츠를 담을 수 있는 상위 템플릿 슬라이드 용량 기준.
  // 표지/챕터 같은 작은 슬라이드까지 평균에 섞으면 짧은 프로젝트도 과분할된다.
  const packingCapacity = estimatePackingCapacity(layout, tplKinds);

  // 프로젝트 1건당: 데이터 밀도에 따라 슬라이드 수를 자동으로 압축
  for (let i = 0; i < norm.projects.length; i++) {
    const sections = buildProjectSections(norm.projects[i], i, packingCapacity, norm.projects.length);
    desired.push(...sections);
  }

  if (norm.education.length) {
    desired.push({ kind: 'education', sectionType: 'education', sectionParam: null });
  }
  if (norm.awards.length) {
    desired.push({ kind: 'awards', sectionType: 'awards', sectionParam: null });
  }
  desired.push({ kind: 'contact', sectionType: 'contact', sectionParam: null });

  const plan = [];
  const usedCount = new Map();
  for (let i = 0; i < desired.length; i++) {
    const d = desired[i];
    let bestIdx = 0, bestScore = -Infinity;
    for (const t of tplKinds) {
      const aff = (KIND_MATCH[d.kind] || {})[t.kind];
      const base = (aff != null) ? aff : 30;
      const reuse = usedCount.get(t.index) || 0;
      const adjusted = base - reuse * REUSE_PENALTY;
      if (adjusted > bestScore) { bestScore = adjusted; bestIdx = t.index; }
    }
    usedCount.set(bestIdx, (usedCount.get(bestIdx) || 0) + 1);
    plan.push({
      planIndex: i,
      templateSlideIndex: bestIdx,
      sectionType: d.sectionType,
      sectionParam: d.sectionParam,
      templateKind: tplKinds.find(t => t.index === bestIdx)?.kind || 'generic',
    });
  }
  return { norm, plan, tplKinds };
}

// ── 4) 슬라이드 박스 사양 빌드 (per-slide) ───────────────────────────────────
// AI 가 박스 의도(제목/본문/메트릭/태그)를 빠르게 파악할 수 있도록 hint 첨부.
function buildSlots(layout, step) {
  const tpl = layout.slides[step.templateSlideIndex];
  const boxes = tpl.textBoxes || [];
  const maxFont = boxes.reduce((m, b) => Math.max(m, b.fontPt || 0), 0);
  const slots = boxes.map(box => {
    const fontPt = Math.round(box.fontPt || 14);
    const maxChars = estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt: box.fontPt || 14 });
    const originalText = (box.originalText || '').slice(0, 120);
    const { hint, semanticRole } = inferSlotIntent(box, { maxFont, maxChars, originalText });
    return {
      shapeId: box.shapeId,
      role: box.role,
      phType: box.phType || null,
      hint,
      semanticRole,
      width: Math.round(box.w),
      height: Math.round(box.h),
      basePt: fontPt,
      maxChars,
      originalText,
    };
  });

  // PAR/병합 슬라이드: 가장 큰 non-title 박스를 'result' 슬롯으로 지정.
  // Result(성과/지표)가 슬라이드에서 가장 눈에 띄는 위치에 배치되도록 보장.
  const PAR_TYPES = new Set(['project_par', 'project_merged', 'project_result', 'project_output']);
  if (PAR_TYPES.has(step.sectionType)) {
    const nonTitle = slots.filter(s => s.semanticRole !== 'title' && s.semanticRole !== 'stage');
    if (nonTitle.length > 0) {
      const largest = nonTitle.reduce((a, b) => b.basePt > a.basePt ? b : a);
      if (largest.semanticRole !== 'metric') {
        const target = slots.find(s => s.shapeId === largest.shapeId);
        if (target) { target.semanticRole = 'result'; target.hint = 'heading'; }
      }
    }
  }

  return slots;
}

function inferSlotIntent(box, { maxFont, maxChars, originalText }) {
  const fontPt = Math.round(box.fontPt || 14);
  const text = originalText.toLowerCase();
  const has = (...words) => words.some(w => text.includes(w));

  if (has('ideate', 'prototype', 'develop', 'test', 'research', 'define', 'discover')) {
    return { hint: 'heading', semanticRole: 'stage' };
  }
  if (has('metric', 'kpi', '성과', '지표', 'before', 'after') || /^[+\-]?\d+([.,]\d+)?(%|ms|s|배|개|원|회|점|위)?$/.test(originalText.trim())) {
    return { hint: 'metric', semanticRole: 'metric' };
  }
  if (has('tech', 'stack', 'skill', 'tools', '기술', '스택', '도구')) {
    return { hint: maxChars <= 20 ? 'tag' : 'body', semanticRole: 'tech' };
  }
  if (has('period', 'date', 'role', '기간', '역할')) {
    return { hint: 'heading', semanticRole: 'meta' };
  }
  if (has('link', 'url', 'github', 'demo', '링크')) {
    return { hint: 'body', semanticRole: 'link' };
  }
  if (box.role === 'title' || (maxFont > 0 && fontPt >= maxFont * 0.9 && fontPt >= 24)) {
    return { hint: 'title', semanticRole: 'title' };
  }
  if (fontPt >= 28 && maxChars <= 14) {
    return { hint: 'metric', semanticRole: 'metric' };
  }
  if (box.role === 'heading' || fontPt >= 22) {
    return { hint: 'heading', semanticRole: 'heading' };
  }
  if (maxChars <= 8) {
    return { hint: 'tag', semanticRole: 'tag' };
  }
  return { hint: 'body', semanticRole: 'body' };
}

// ── 5) 섹션별 컨텍스트(포트폴리오 부분집합) ─────────────────────────────────
function buildContext(norm, step) {
  const proj = norm.projects[step.sectionParam] || null;
  switch (step.sectionType) {
    case 'cover':
      return {
        userName: norm.about.name,
        headline: norm.about.headline,
        targetCompany: norm.targetCompany,
        targetPosition: norm.targetPosition,
        title: norm.title,
      };
    case 'about':
      return {
        userName: norm.about.name,
        headline: norm.about.headline,
        essay: norm.about.essay,
        values: norm.about.values,
        goals: norm.about.goals,
      };
    case 'skills':
      return { skills: norm.skills };
    case 'project_divider':
      return {
        sectionLabel: `Project ${(step.sectionParam ?? 0) + 1}`,
        projectIndex: (step.sectionParam ?? 0) + 1,
        title: proj?.title,
        role: proj?.role,
        period: proj?.period,
      };
    case 'project_intro':
    case 'project_overview':
      return {
        title: proj?.title,
        role: proj?.role,
        period: proj?.period,
        intro: proj?.intro,
        overview: proj?.overview,
        techStack: proj?.techStack,
        link: proj?.link,
      };
    case 'project_task':
      return {
        title: proj?.title,
        task: proj?.task,
        role: proj?.role,
      };
    case 'project_problem':
      return {
        title: proj?.title,
        task: proj?.task,
        problem: proj?.problem,
        action: proj?.action,
        process: proj?.process,
      };
    case 'project_metric':
      return {
        title: proj?.title,
        keyExperiences: proj?.keyExperiences || [],
      };
    case 'project_output':
      return {
        title: proj?.title,
        output: proj?.output,
        link: proj?.link,
      };
    case 'project_growth':
      return {
        title: proj?.title,
        growth: proj?.growth,
      };
    case 'project_competency':
      return {
        title: proj?.title,
        competency: proj?.competency,
        techStack: proj?.techStack,
      };
    case 'project_result':
      return {
        title: proj?.title,
        output: proj?.output,
        growth: proj?.growth,
        competency: proj?.competency,
      };
    case 'project':
      return { project: proj };
    // Smart Packing 병합 섹션
    case 'project_merged':
    case 'project_par':
      return {
        title: proj?.title,
        role: proj?.role,
        period: proj?.period,
        intro: proj?.intro,
        overview: proj?.overview,
        techStack: proj?.techStack,
        problem: proj?.problem,
        action: proj?.action,
        process: proj?.process,
        task: proj?.task,
        output: proj?.output,
        growth: proj?.growth,
        competency: proj?.competency,
        keyExperiences: proj?.keyExperiences || [],
        link: proj?.link,
      };
    case 'education':
      return { education: norm.education };
    case 'awards':
      return { awards: norm.awards };
    case 'contact':
      return { userName: norm.about.name, contact: norm.contact };
    default:
      return {
        userName: norm.about.name,
        headline: norm.about.headline,
        skills: norm.skills,
      };
  }
}

// ── 6) 섹션별 매핑 가이드 ────────────────────────────────────────────────────
const SECTION_GUIDE = {
  cover:
    `이 슬라이드는 표지. 큰 제목 박스 = userName 또는 title; ` +
    `보조 박스 = headline / targetCompany / targetPosition.`,
  about:
    `이 슬라이드는 자기소개/가치관. values·goals·essay 를 단정형 1~2 문장으로. ` +
    `미사여구 X. 박스가 여러 개면 분산.`,
  skills:
    `이 슬라이드는 기술 스택. 카테고리별로 단어 3~6개씩 나열. ` +
    `별점/레벨/% 표기 금지. 박스가 카테고리별로 여러 개면 박스마다 다른 카테고리 배정.`,
  project_divider:
    `이 슬라이드는 새로운 프로젝트 섹션의 시작을 알리는 구분 카드(챕터 표지).\n` +
    `  · 가장 큰 박스 → sectionLabel ("Project N" 형식)\n` +
    `  · 부제 박스 → title (프로젝트명)\n` +
    `  · 메타 박스 → "period · role" 한 줄\n` +
    `최소한의 텍스트로 시각적 단절감을 줄 것. 본문/긴 설명 절대 X.`,
  project_intro:
    `이 슬라이드는 프로젝트 소개. 박스 의도에 맞춰 분배:\n` +
    `  · 큰 제목 박스 → title\n` +
    `  · 부제/요약 박스 → intro (서비스/특징 한 줄)\n` +
    `  · 메타 박스 → "period · role" 한 줄\n` +
    `  · 작은 나열 박스 → techStack 3~6개 콤마 구분\n` +
    `데이터에 없는 회사/숫자 창작 금지.`,
  project_overview:
    `이 슬라이드는 프로젝트 개요(배경·목적). 박스 의도에 맞춰 분배:\n` +
    `  · 제목/큰 박스 → title 또는 "프로젝트 개요"\n` +
    `  · 본문 박스 → overview (배경·목적 1~2문장)\n` +
    `  · 부가 박스 → intro / 또는 techStack 한 줄\n` +
    `데이터에 없는 회사/숫자 창작 금지.`,
  project_task:
    `이 슬라이드는 "진행한 일" (역할별 활동/책임).\n` +
    `  · 제목 박스 → "진행한 일" 또는 title\n` +
    `  · 본문/리스트 박스 → task 를 동사 시작 bullet 으로 분할 (각 줄 60자 이내, 줄바꿈 \\n)\n` +
    `  · 부가 박스 → role`,
  project_problem:
    `이 슬라이드는 "진행한 일 / 문제상황 → 핵심행동".\n` +
    `  · "진행한 일","역할","Task","Process" 라벨 박스 → task (동사 시작 bullet, 각 줄 60자 이내)\n` +
    `  · "문제","Problem","상황","배경" 라벨 박스 → problem (1~2문장)\n` +
    `  · "행동","Action","핵심행동","과정","해결" 라벨 박스 → action 또는 process\n` +
    `task와 problem이 동시에 있으면 각각 담당 라벨 박스에 배정. 긴 박스는 동사 시작 bullet (각 줄 60자 이내).`,
  project_metric:
    `이 슬라이드는 시각화 지표·핵심 경험과 성과 (KPI 카드).\n` +
    `  · hint="metric" 박스 → keyExperiences[i].metric 그대로 (예: "150ms","+12%","3배"). emphasis="metric".\n` +
    `  · 그 옆/아래 라벨 박스 → keyExperiences[i].metricLabel 또는 title\n` +
    `  · 비교(전→후) 박스가 두 개면 beforeMetric / afterMetric\n` +
    `  · 본문/설명 박스 → keyExperiences[i].result 또는 description\n` +
    `keyExperiences 항목이 여러 개면 박스마다 다른 항목 배정. 데이터에 없는 숫자 절대 창작 금지.`,
  project_output:
    `이 슬라이드는 "결과물" (산출물·데모).\n` +
    `  · 제목 박스 → "결과물" 또는 title\n` +
    `  · 본문 박스 → output (산출물 설명, 1~3문장 또는 bullet)\n` +
    `  · 링크 박스 → link (있으면)\n` +
    `각 줄 60자 이내. 데이터에 없는 숫자 창작 금지.`,
  project_growth:
    `이 슬라이드는 "성장한 점" (회고/배운 점).\n` +
    `  · 제목 박스 → "성장한 점" 또는 "배운 점"\n` +
    `  · 본문 박스 → growth (1~3문장 또는 bullet, 동사/명사형)\n` +
    `존댓말/이모지 X. 단정형.`,
  project_competency:
    `이 슬라이드는 "나의 역량" (이 프로젝트에서 발휘한/입증된 역량).\n` +
    `  · 제목 박스 → "나의 역량"\n` +
    `  · 본문 박스 → competency (역량 키워드 + 근거, 1~3개 bullet)\n` +
    `  · 부가 박스 → techStack 한 줄\n` +
    `각 줄 60자 이내. 단정형.`,
  project_result:
    `이 슬라이드는 결과물·성장한 점·나의 역량(통합).\n` +
    `  · "결과","Output","결과물" 라벨 박스 → output\n` +
    `  · "성장","Growth","배운 점" 라벨 박스 → growth\n` +
    `  · "역량","Competency","나의 역량" 라벨 박스 → competency\n` +
    `각 1~2문장. 단정형.`,
  project:
    `이 슬라이드는 프로젝트. project 한 건의 데이터를 박스 의도에 맞춰 분배:\n` +
    `  · title → 제목 / overview → 소개\n` +
    `  · problem → 문제 / action → 핵심행동 / output → 결과 / growth → 성장\n` +
    `  · keyExperiences[i].metric → hint=metric 박스 (emphasis="metric")\n` +
    `데이터에 없는 정보 창작 금지.`,
  // Smart Packing 병합 섹션
  project_merged:
    `이 슬라이드는 프로젝트 전체 내용을 한 장에 압축하는 통합 카드.\n` +
    `템플릿의 모든 텍스트 박스를 최대한 활용해 다음 정보를 빠짐없이 배치:\n` +
    `  · 가장 큰/상단 박스 → title (프로젝트명)\n` +
    `  · 메타 박스 → "period · role" 한 줄\n` +
    `  · 기술 박스 → techStack 3~6개\n` +
    `  · "문제/배경" 박스 → problem 또는 intro (1~2문장 압축)\n` +
    `  · "과정/행동" 박스 → action 또는 task (1~2문장 압축)\n` +
    `  · "결과/성과" 박스 → output 또는 growth (1~2문장 압축)\n` +
    `  · hint=metric 박스 → keyExperiences[0].metric (없으면 "")\n` +
    `박스가 남으면 growth / competency 내용도 채워 넣어. 빈 박스로 남기지 말 것.`,
  project_par:
    `이 슬라이드는 문제(Problem) → 핵심행동(Action) → 성과(Result) 통합 카드.\n` +
    `  · "문제/배경/상황" 라벨 박스 → problem 또는 intro (핵심만 1~2문장)\n` +
    `  · "과정/행동/해결" 라벨 박스 → action 또는 process 또는 task (동사 bullet)\n` +
    `  · "결과/성과/결과물" 라벨 박스 → output + growth 압축 (1~2문장)\n` +
    `  · hint=metric 박스 → keyExperiences[0].metric (강조, emphasis="metric")\n` +
    `  · 나머지 박스 → competency / techStack / role 배분\n` +
    `PAR 흐름을 명확히 보여주는 것이 이 슬라이드의 목적. 단정형, 동사 시작 bullet.`,
  education:
    `이 슬라이드는 학력. 학교·전공·기간을 한 줄에. 핵심만.`,
  awards:
    `이 슬라이드는 수상/자격. 상명·기관·연도 한 줄.`,
  contact:
    `이 슬라이드는 연락처. 이메일/링크만. 전화번호·주소 X.`,
};

// ── 7) 단일 슬라이드 프롬프트 ────────────────────────────────────────────────
function buildSingleSlidePrompt(step, ctx, slots) {
  const guide = SECTION_GUIDE[step.sectionType] || SECTION_GUIDE.cover;
  // Unique Mapping: AI에게는 B0·B1·… 단축 ID만 노출 (내부 shapeId 비공개)
  const charBudgetList = slots.map((s, i) =>
    `  box_id="B${i}" | hint=${s.hint} | semanticRole=${s.semanticRole} | char_budget=${s.maxChars} | basePt=${s.basePt}`
  ).join('\n');
  // originalText 는 AI 프롬프트에서 완전 제외 — 템플릿 텍스트 복사 원천 차단.
  // semanticRole=stage 인 박스만 stageLabel 로 원본 라벨 전달 (IDEATE/PROTOTYPE 등).
  const slotsForPrompt = slots.map((s, i) => {
    const slot = {
      box_id: `B${i}`,
      hint: s.hint,
      semanticRole: s.semanticRole,
      char_budget: s.maxChars,
      basePt: s.basePt,
    };
    if (s.semanticRole === 'stage' && s.originalText) slot.stageLabel = s.originalText;
    return slot;
  });
  return `당신은 FitPoly의 수석 포트폴리오 디렉터이자 PPT 콘텐츠 매핑 모듈입니다.
한 슬라이드의 텍스트 박스에 들어갈 한국어 텍스트를 결정해 JSON 으로 반환하십시오.

━━━ [절대 규칙] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A. char_budget 초과 절대 금지. 각 박스에 부여된 char_budget(글자 수 한도)을 단 1자도 초과하지 않도록
   텍스트를 고도로 압축하십시오. 초과 시 PowerPoint에서 글자가 세로로 줄바꿈되어 깨집니다.
B. 사용자 데이터(아래 [사용자 데이터])에 없는 회사명·숫자·사실·수치 절대 창작 금지.
C. 같은 슬라이드 내 두 박스에 동일·유사 text 출력 금지 (중복 내용 출력 방지).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[형식 규칙]
1. 모든 slots 항목에 text 필드 포함 필수.
   빈 문자열("") 사용 조건:
   (a) 사용자 데이터에 이 박스 의도에 맞는 값이 없는 경우
   (b) char_budget ≤ 6 인 경우 (아이콘·장식 자리 — 의미 있는 단어 불가)
2. 한국어 명사형/단정형. 존댓말·이모지 X.
3. 출력은 JSON 만 (마크다운 코드펜스 X).

[박스 hint / semanticRole 가이드]
- hint="title"  : 슬라이드 핵심 제목. 가장 짧고 강한 표현. char_budget 엄수.
- hint="metric" : 숫자/단위/% KPI 값만 (예: "150ms", "+12%", "3배"). emphasis="metric".
                  데이터에 metric 없으면 "" — 절대 창작 금지.
- hint="tag"    : 키워드 한 단어. 긴 텍스트 절대 금지.
- hint="heading": 부제·섹션 헤딩. 한 줄 요약.
- hint="body"   : 본문. 1~3문장 또는 동사 시작 bullet.
                  bullet 줄바꿈은 \\n. 각 줄은 char_budget / 줄 수 이내.
- semanticRole="stage" 는 IDEATE/PROTOTYPE 같은 템플릿 단계 라벨입니다. stageLabel 값을 유지하거나
  사용자 데이터의 문제/행동/결과 흐름을 해당 단계에 맞게 매우 짧게 배치하십시오.
- semanticRole="title|metric|meta|tech|link|body" 를 우선하고, 배열 순서보다 semanticRole 을 더 신뢰하십시오.

[PAR 원칙 — 프로젝트 슬라이드 필수 적용]
모든 프로젝트 경험은 반드시 "문제(Problem) → 핵심행동(Action) → 수치 성과(Result)" 순으로 구조화.
특히 숫자로 표현된 성과(metric: 응답속도, 전환율, 처리량 등)를 1순위로 추출해 hint="metric" 박스에 배치.

[이 슬라이드의 섹션]
sectionType: ${step.sectionType}${step.sectionParam != null ? `[${step.sectionParam}]` : ''}
${guide}

[char_budget 목록 (박스별 글자 수 한도)]
${charBudgetList}

[사용자 데이터 (이 슬라이드에 사용할 부분)]
${JSON.stringify(ctx, null, 2)}

[채워야 할 텍스트 박스 (배열 인덱스 = reading order)]
${JSON.stringify(slotsForPrompt, null, 2)}

[출력 스키마]
{
  "slots": [
    { "box_id": "<B0~B${slots.length - 1} 중 하나>", "text": "<char_budget 이내>", "emphasis": "<none|metric|title>" }
  ]
}

JSON 만 반환하시오.`;
}

// ── 8) 결정적 폴백 (AI 실패 시) ──────────────────────────────────────────────
function deterministicFallback(step, ctx, slots) {
  const pool = [];
  const secondary = [];
  const pushS = (...vs) => vs.forEach(v => { if (v) secondary.push(v); });
  pushS(ctx.title, ctx.intro, ctx.overview, ctx.problem, ctx.action, ctx.process,
    ctx.task, ctx.output, ctx.growth, ctx.competency, ctx.role, ctx.period);
  if (Array.isArray(ctx.techStack) && ctx.techStack.length) secondary.push(ctx.techStack.join(', '));
  for (const ke of (ctx.keyExperiences || [])) {
    pushS(ke.metric, ke.title, ke.metricLabel, ke.result, ke.description);
  }

  switch (step.sectionType) {
    case 'cover':
      pool.push(ctx.userName, ctx.title, ctx.headline,
        [ctx.targetCompany, ctx.targetPosition].filter(Boolean).join(' · '));
      break;
    case 'about': {
      const valuesLine = (ctx.values || []).slice(0, 5).join(', ');
      const goalsLine = (ctx.goals || []).slice(0, 3).join(', ');
      pool.push(ctx.headline, ctx.essay, valuesLine, goalsLine);
      break;
    }
    case 'skills': {
      const s = ctx.skills || {};
      ['languages', 'frameworks', 'tools', 'others'].forEach(k => {
        const arr = Array.isArray(s[k]) ? s[k] : [];
        if (arr.length) pool.push(arr.map(x => typeof x === 'string' ? x : x?.name || '').filter(Boolean).join(', '));
      });
      break;
    }
    case 'project_divider':
      pool.push(
        ctx.sectionLabel || `Project ${ctx.projectIndex || 1}`,
        ctx.title,
        [ctx.period, ctx.role].filter(Boolean).join(' · '),
      );
      break;
    case 'project_intro':
      pool.push(ctx.title, ctx.intro,
        [ctx.period, ctx.role].filter(Boolean).join(' · '),
        (ctx.techStack || []).join(', '));
      break;
    case 'project_overview':
      pool.push(ctx.title, ctx.overview, ctx.intro,
        [ctx.period, ctx.role].filter(Boolean).join(' · '),
        (ctx.techStack || []).join(', '));
      break;
    case 'project_task':
      pool.push(ctx.title, ctx.task, ctx.role);
      break;
    case 'project_problem':
      pool.push(ctx.title, ctx.problem, ctx.action, ctx.process);
      break;
    case 'project_metric': {
      const kes = ctx.keyExperiences || [];
      for (const ke of kes) {
        if (ke.metric) pool.push(ke.metric);
        if (ke.metricLabel || ke.title) pool.push(ke.metricLabel || ke.title);
        if (ke.result || ke.description) pool.push(ke.result || ke.description);
      }
      break;
    }
    case 'project_output':
      pool.push(ctx.title, ctx.output, ctx.link);
      break;
    case 'project_growth':
      pool.push(ctx.title, ctx.growth);
      break;
    case 'project_competency':
      pool.push(ctx.title, ctx.competency, (ctx.techStack || []).join(', '));
      break;
    case 'project_result':
      pool.push(ctx.title, ctx.output, ctx.growth, ctx.competency);
      break;
    case 'project': {
      const p = ctx.project || {};
      pool.push(p.title, p.overview || p.intro || p.description, p.problem, p.action,
        p.output || p.result, p.growth || p.learning,
        (p.techStack || []).join(', '),
        ...(p.keyExperiences || []).flatMap(ke => [ke.metric, ke.title]));
      break;
    }
    case 'education':
      for (const e of (ctx.education || [])) {
        pool.push(e.school || e.name || '');
        pool.push([e.major || e.degree, e.period].filter(Boolean).join(' · '));
      }
      break;
    case 'awards':
      for (const a of (ctx.awards || [])) {
        pool.push(a.title || a.name || '');
        pool.push([a.organization || a.org, a.year || a.date].filter(Boolean).join(' · '));
      }
      break;
    case 'contact':
      pool.push(ctx.contact?.email, ctx.contact?.github, ctx.contact?.website || ctx.contact?.linkedin);
      break;
  }

  const cleanPrimary = pool.map(s => (s || '').toString().trim()).filter(Boolean);
  const cleanSecondary = secondary.map(s => (s || '').toString().trim()).filter(Boolean)
    .filter(s => !cleanPrimary.includes(s));
  // cycling 절대 안 함 — 부족하면 빈 슬롯 유지. 반복 출력이 빈 박스보다 나쁘다.
  const merged = [...cleanPrimary, ...cleanSecondary];

  const firstMetric = (ctx.keyExperiences || []).find(ke => ke.metric || ke.beforeMetric || ke.afterMetric) || null;
  const projectMeta = [ctx.period, ctx.role].filter(Boolean).join(' · ');
  const techLine = Array.isArray(ctx.techStack) ? ctx.techStack.slice(0, 6).join(', ') : '';
  const pickForSlot = (slot, index) => {
    const role = slot.semanticRole || slot.hint || 'body';
    if (role === 'title') return ctx.title || ctx.userName || ctx.sectionLabel || merged[index] || '';
    if (role === 'metric') return firstMetric?.metric || firstMetric?.afterMetric || '';
    if (role === 'meta') return projectMeta || merged[index] || '';
    if (role === 'tech' || role === 'tag') return techLine || merged[index] || '';
    if (role === 'link') return ctx.link || ctx.contact?.github || ctx.contact?.website || '';
    if (role === 'stage') {
      return slot.originalText || merged[index] || '';
    }
    if (role === 'heading') return merged[index] || ctx.title || '';
    return merged[index] || '';
  };

  const out = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const cap = slot.maxChars || 120;
    const candidate = pickForSlot(slot, i);
    let text = '';
    if (candidate) {
      // 박스가 너무 작은데 후보가 길면 강제 자르지 않고 비운다 (세로 글자 깨짐 방지).
      const tooLong = candidate.length > cap * 1.5 && cap <= 12;
      text = tooLong ? '' : candidate.slice(0, cap);
    }
    const isMetric = step.sectionType === 'project_metric' && /^[+\-]?\d|%|ms|s$|배|개$/.test(text);
    out.push({ shapeId: slot.shapeId, text, emphasis: isMetric ? 'metric' : 'none' });
  }
  return { slots: out };
}

// AI 출력이 원본 template 더미 텍스트를 그대로 복사했는지 판정.
// - 와전 동일
// - b 가 4~30자: a 가 b 를 포함 (짧은 플레이스홀더 단어 누수)
// - b 가 31자 이상: a 가 b 의 앞 40% 이상을 포함 (장문 부분 복사)
function looksLikeOriginal(text, originalText) {
  if (!text || !originalText) return false;
  const norm = (s) => String(s).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '').trim();
  const a = norm(text);
  const b = norm(originalText);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.length >= 4 && b.length <= 30 && a.includes(b)) return true;
  if (b.length > 30 && b.length >= 8) {
    const prefix = b.slice(0, Math.max(8, Math.floor(b.length * 0.4)));
    if (a.includes(prefix)) return true;
  }
  return false;
}

// ── 9) 메인: per-slide 병렬 호출 ─────────────────────────────────────────────
async function mapSlide(step, ctx, slots) {
  if (!slots.length) return { slots: [] };
  const det = deterministicFallback(step, ctx, slots);
  const detById = new Map((det.slots || []).map(s => [s.shapeId, s]));

  const prompt = buildSingleSlidePrompt(step, ctx, slots);
  const label = `Slide${step.planIndex}-${step.sectionType}`;
  let aiSlots = null;
  try {
    // 타임아웃은 큐 해제 후 시작 기준으로 적용해야 하므로
    // 외부 withTimeout 제거: callGeminiModel 내부 callTimeoutMs(40s)가 각 모델 호출에 적용됨.
    // 병렬(Promise.all) 실행 시 외부 타임아웃은 큐대기 시간을 포함해 뺄리 소진된다.
    const text = await generateWithRetry(prompt, PPT_SLIDE_OPTIONS);
    const parsed = parseJSON(text);
    if (!parsed?.slots || !Array.isArray(parsed.slots)) throw new Error('AI 응답에 slots 없음');
    aiSlots = parsed.slots;
  } catch (err) {
    console.warn(`[${label}] AI 매핑 실패 → 전체 폴백:`, err.message);
    return det;
  }

  // 슬롯 단위 머지:
  //   AI 결과가 (a) 비었거나 (b) originalText 누수면 결정적 폴백 사용.
  //   (c) 작은 박스에 긴 텍스트가 들어오면 빈 문자열 (세로 글자 깨짐 방지).
  //   (d) 슬라이드 내 중복 텍스트는 첫 등장만 유지.
  // Unique Mapping: AI 반환 box_id(B0…) → shapeId 역매핑
  const boxIdToShapeId = new Map(slots.map((s, i) => [`B${i}`, s.shapeId]));
  const aiByShapeId = new Map(
    (aiSlots || []).map(s => {
      const shapeId = s.shapeId || boxIdToShapeId.get(s.box_id);
      return shapeId ? [shapeId, s] : null;
    }).filter(Boolean)
  );
  let leaks = 0, empties = 0, oversize = 0, dupes = 0;
  const seen = new Map();
  const normStr = (s) => s.toLowerCase().replace(/\s+/g, '').trim();
  const merged = slots.map(slot => {
    const a = aiByShapeId.get(slot.shapeId);
    const d = detById.get(slot.shapeId) || { shapeId: slot.shapeId, text: '', emphasis: 'none' };
    const aiText = (a?.text || '').trim();
    let chosen;
    if (!aiText) {
      empties++;
      chosen = d;
    } else if (looksLikeOriginal(aiText, slot.originalText)) {
      leaks++;
      chosen = d;
    } else {
      const cap = slot.maxChars || 120;
      const tooLong = aiText.length > cap * 1.5 && cap <= 12;
      if (tooLong) {
        oversize++;
        chosen = { shapeId: slot.shapeId, text: '', emphasis: 'none' };
      } else {
        chosen = { shapeId: slot.shapeId, text: aiText, emphasis: a?.emphasis || 'none' };
      }
    }
    const t = chosen.text || '';
    if (t.length >= 8) {
      const key = normStr(t);
      if (key && seen.has(key)) {
        dupes++;
        chosen = { shapeId: slot.shapeId, text: '', emphasis: 'none' };
      } else if (key) {
        seen.set(key, true);
      }
    }
    return chosen;
  });
  if (leaks || empties || oversize || dupes) {
    console.log(`[${label}] 슬롯 보정: 누수=${leaks} 공백=${empties} 과다길이=${oversize} 중복=${dupes} (총 ${slots.length})`);
  }
  return { slots: merged };
}

export async function mapDeck({ portfolio, layout }) {
  const { norm, plan } = planDeck(layout, portfolio);
  const t0 = Date.now();
  console.log(`[PPT-Mapper] ${plan.length}개 슬라이드 병렬 매핑 시작 (Pro→Flash-Lite 폴백, 큐 2.5s 간격, 세마포어 타임아웃 600s)`);

  // 병렬(Promise.all): 모든 슬라이드가 RPM 큐에 동시 등록 → 4100ms 간격으로 순차 시작.
  // 외부 withTimeout 제거: callTimeoutMs(40s)가 각 모델 호출에 직접 적용됨.
  // 429: 대기 없이 즉시 Flash 폴백 → 세마포어 점유 시간 최소화.
  const slideResults = await Promise.all(plan.map(step => {
    const ctx = buildContext(norm, step);
    const slots = buildSlots(layout, step);
    return mapSlide(step, ctx, slots);
  }));

  console.log(`[PPT-Mapper] 병렬 완료: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const normStr = (s) => s.toLowerCase().replace(/\s+/g, '').trim();

  const deck = plan.map((step, i) => {
    const tpl = layout.slides[step.templateSlideIndex];
    const ai = slideResults[i] || { slots: [] };
    const slotMap = new Map();
    for (const s of (ai.slots || [])) slotMap.set(s.shapeId, s);
    const rawBoxes = (tpl.textBoxes || []).map(box => {
      const aiSlot = slotMap.get(box.shapeId);
      const rawText = (aiSlot?.text || '').trim();
      return {
        ...box,
        text: rawText,
        emphasis: aiSlot?.emphasis || 'none',
      };
    });

    // 슬라이드 내 중복 텍스트 제거 (8자 이상)
    const seen = new Map();
    const dedupedBoxes = rawBoxes.map(b => {
      const t = b.text || '';
      if (t.length >= 8) {
        const key = normStr(t);
        if (key && seen.has(key)) return { ...b, text: '' };
        if (key) seen.set(key, true);
      }
      return b;
    });

    return {
      planIndex: step.planIndex,
      sectionType: step.sectionType,
      templateSlideIndex: step.templateSlideIndex,
      boxes: dedupedBoxes,
    };
  });

  // Slide Pruning: AI가 아무 내용도 채우지 않은 슬라이드를 최종 덱에서 제거.
  // cover/about/skills/교육/수상/연락처/project_divider 는 항상 유지.
  const ALWAYS_KEEP = new Set(['cover', 'about', 'skills', 'education', 'awards', 'contact']);
  // project_divider: title 이 콘텐츠 → 일반 hasContent 체크(>2자)로 판정. 빈 divider 자동 제거.
  return deck.filter(slide => {
    if (ALWAYS_KEEP.has(slide.sectionType)) return true;
    const hasContent = (slide.boxes || []).some(b => (b.text || '').trim().length > 2);
    if (!hasContent) console.log(`[PPT-Mapper] 빈 슬라이드 제거: ${slide.sectionType}[${slide.templateSlideIndex}]`);
    return hasContent;
  });
}
