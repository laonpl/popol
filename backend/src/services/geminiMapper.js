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

const LITE_OPTIONS = {
  models: ['gemini-2.5-flash-lite'],
  retries: 2,
  delayMs: 1500,
  rateLimitDelayMs: 4000,
};
const PER_SLIDE_TIMEOUT_MS = 45000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 타임아웃 (${ms / 1000}s 초과)`)), ms)
    ),
  ]);
}

// ── 1) 포트폴리오 정규화 ─────────────────────────────────────────────────────
// 라벨 → 키 매칭 (subSections / exportConfig.sections 처리용)
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

  // 노션 에디터에서 저장한 형식: structuredResult.exportConfig.sections = [{key,label,content},...]
  const exportSections = Array.isArray(sr.exportConfig?.sections) ? sr.exportConfig.sections : [];
  const subSections = [
    ...exportSections,
    ...(Array.isArray(sr.sections) ? sr.sections : []),
    ...(Array.isArray(exp.sections) ? exp.sections : []),
    ...(Array.isArray(exp.customSections) ? exp.customSections : []),
  ]
    .map(s => ({ key: s?.key || '', label: s?.label || s?.title || '', content: s?.content || s?.body || '' }))
    .filter(s => s.label || s.content);

  // 키 우선 → 라벨 fallback. 합격자 포트폴리오의 7개 표준 섹션.
  const byKey = (k) => subSections.find(s => s.key === k)?.content || '';
  const intro      = sr.intro      || byKey('intro')      || findSectionByLabel(subSections, '프로젝트 소개', 'intro') || exp.description || overview.summary || '';
  const overviewT  = sr.overview   || byKey('overview')   || findSectionByLabel(subSections, '프로젝트 개요', 'overview') || overview.background || '';
  const task       = sr.task       || byKey('task')       || findSectionByLabel(subSections, '진행한 일', 'task');
  const process    = sr.process    || byKey('process')    || findSectionByLabel(subSections, '과정', 'process') || carl.action || '';
  const output     = sr.output     || byKey('output')     || findSectionByLabel(subSections, '결과물', 'output') || sr.deliverable || sr.deliverables || carl.result || '';
  const growth     = sr.growth     || byKey('growth')     || findSectionByLabel(subSections, '성장한 점', '성과', 'growth') || carl.learning || '';
  const competency = sr.competency || sr.myCompetency || byKey('competency') || findSectionByLabel(subSections, '나의 역량', '역량', 'competency') || '';

  // 문제/핵심행동 (CARL 호환 + 진행한 일/과정에서 보완)
  const problem = carl.context || carl.problem || carl.background || findSectionByLabel(subSections, '문제', 'problem') || '';
  const action  = carl.action || process || findSectionByLabel(subSections, '핵심행동', 'action') || '';

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
  project:   ['프로젝트', 'project', '작업물', '소개', '개요', 'overview'],
  metric:    ['지표', '수치', '차트', '그래프', '데이터', 'kpi', 'metric', '%', 'before', 'after', '↑', '↓', '증가', '감소'],
  problem:   ['문제', '배경', '이슈', 'problem', 'issue', 'background', '핵심행동', '진행', '과정', 'task', 'process', 'action', '해결', 'solution'],
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

// ── 3) 섹션 → 슬라이드 매칭 ──────────────────────────────────────────────────
// 하나의 sectionType 이 여러 templateKind 중 어디에 가장 잘 맞는지 점수.
const KIND_MATCH = {
  cover:           { cover: 100, generic: 50 },
  about:           { about: 100, cover: 35, generic: 60 },
  skills:          { skills: 100, project: 30, generic: 55 },
  project_overview:{ project: 100, about: 50, generic: 60 },
  project_problem: { problem: 100, project: 70, generic: 55 },
  project_metric:  { metric: 100, result: 70, project: 50, generic: 50 },
  project_result:  { result: 100, growth: 80, project: 60, generic: 55 },
  project_growth:  { growth: 100, result: 70, project: 50, generic: 55 },
  experience:      { experience: 100, project: 70, generic: 55 },
  education:       { education: 100, awards: 35, generic: 55 },
  awards:          { awards: 100, education: 35, generic: 55 },
  contact:         { contact: 100, cover: 35, generic: 55 },
};
const REUSE_PENALTY = 12;

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

  // 프로젝트 1건 → 합격자 포트폴리오 스타일로 최대 4장 확장.
  // 데이터 보유 여부에 따라 슬라이드 수 자동 조정.
  for (let i = 0; i < norm.projects.length; i++) {
    const p = norm.projects[i];
    desired.push({ kind: 'project_overview', sectionType: 'project_overview', sectionParam: i });
    if (p.problem || p.task || p.process || p.action) {
      desired.push({ kind: 'project_problem', sectionType: 'project_problem', sectionParam: i });
    }
    const hasMetric = (p.keyExperiences || []).some(ke => ke.metric || ke.beforeMetric || ke.afterMetric);
    if (hasMetric) {
      desired.push({ kind: 'project_metric', sectionType: 'project_metric', sectionParam: i });
    }
    if (p.output || p.growth || p.competency) {
      desired.push({ kind: 'project_result', sectionType: 'project_result', sectionParam: i });
    }
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
function buildSlots(layout, step) {
  const tpl = layout.slides[step.templateSlideIndex];
  return (tpl.textBoxes || []).map(box => ({
    shapeId: box.shapeId,
    role: box.role,
    phType: box.phType || null,
    width: Math.round(box.w),
    height: Math.round(box.h),
    basePt: Math.round(box.fontPt || 14),
    maxChars: estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt: box.fontPt || 14 }),
    originalText: (box.originalText || '').slice(0, 120),
  }));
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
    case 'project_problem':
      return {
        title: proj?.title,
        problem: proj?.problem,
        task: proj?.task,
        process: proj?.process,
        action: proj?.action,
      };
    case 'project_metric':
      return {
        title: proj?.title,
        keyExperiences: proj?.keyExperiences || [],
      };
    case 'project_result':
      return {
        title: proj?.title,
        output: proj?.output,
        growth: proj?.growth,
        competency: proj?.competency,
      };
    case 'project': // 레거시 단일 슬라이드 케이스
      return { project: proj };
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
  project_overview:
    `이 슬라이드는 프로젝트 소개·개요. 박스 의도에 맞춰 분배:\n` +
    `  · 큰 제목 박스 → title\n` +
    `  · 부제/요약 박스 → intro (서비스/특징 한 줄)\n` +
    `  · 본문 박스 → overview (배경·목적 1~2문장)\n` +
    `  · 메타 박스 → period · role 한 줄\n` +
    `  · 작은 나열 박스 → techStack 3~6개 콤마 구분\n` +
    `데이터에 없는 회사/숫자 창작 금지.`,
  project_problem:
    `이 슬라이드는 문제상황 → 핵심행동(진행한 일·과정).\n` +
    `  · "문제","Problem","배경" 라벨 박스 → problem (1~2문장)\n` +
    `  · "행동","Action","진행한 일","과정" 라벨 박스 → action 또는 task/process\n` +
    `긴 박스는 동사 시작 bullet (각 줄 60자 이내).`,
  project_metric:
    `이 슬라이드는 시각화 지표·핵심 경험과 성과.\n` +
    `  · 큰 짧은 박스 (숫자만 들어갈 자리) → keyExperiences[i].metric 그대로 (예: "150ms", "+12%"). emphasis="metric".\n` +
    `  · 그 옆/아래 라벨 박스 → keyExperiences[i].title 또는 metricLabel\n` +
    `  · 비교 (전→후) 박스가 두 개면 beforeMetric / afterMetric\n` +
    `  · 본문 박스 → keyExperiences[i].result 또는 description\n` +
    `keyExperiences 가 여러 개면 박스마다 다른 항목 배정. 데이터에 없는 숫자 절대 창작 금지.`,
  project_result:
    `이 슬라이드는 결과물·성장한 점·나의 역량.\n` +
    `  · "결과","Result","Output","결과물" 라벨 박스 → output\n` +
    `  · "성장","Growth","배운 점","회고" 라벨 박스 → growth\n` +
    `  · "역량","Competency","나의 역량" 라벨 박스 → competency\n` +
    `각 1~2문장. 단정형.`,
  project: // 레거시 단일 슬라이드
    `이 슬라이드는 프로젝트. project 한 건의 풍부한 데이터를 슬라이드 박스 의도에 맞춰 분배:\n` +
    `  · title → 프로젝트 제목 / overview → 소개\n` +
    `  · problem → 문제 / action → 핵심행동 / output → 결과 / growth → 성장\n` +
    `  · keyExperiences[i].metric → 큰 숫자 박스 (emphasis="metric")\n` +
    `데이터에 없는 정보 창작 금지.`,
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
  return `당신은 PPT 콘텐츠 매핑 모듈입니다. 한 슬라이드의 텍스트 박스에 들어갈
한국어 텍스트를 결정해 JSON 으로 반환하시오.

[규칙]
1. 각 박스의 maxChars 절대 초과 금지. 초과 위험 시 정보 압축 X, 정보 선택 O.
2. 각 박스의 originalText 는 그 자리가 어떤 의도인지 강한 힌트(라벨/예시).
   originalText 자체를 복사하지 말 것 — 사용자 데이터로 채울 것.
3. 데이터에 없는 회사명/숫자/사실 창작 금지.
4. 단정형/명사형 (존댓말 X, 이모지 X).
5. 출력은 JSON 만.

[이 슬라이드의 섹션]
sectionType: ${step.sectionType}${step.sectionParam != null ? `[${step.sectionParam}]` : ''}
${guide}

[사용자 데이터 (이 슬라이드에 사용할 부분)]
${JSON.stringify(ctx, null, 2)}

[채워야 할 텍스트 박스]
${JSON.stringify(slots, null, 2)}

[출력 스키마]
{
  "slots": [
    { "shapeId": "<입력 그대로>", "text": "<maxChars 이내>", "emphasis": "<none|metric|title>" }
  ]
}

JSON 만 반환하시오.`;
}

// ── 8) 결정적 폴백 (AI 실패 시) ──────────────────────────────────────────────
// originalText 힌트에 맞춰 ctx 에서 가장 그럴듯한 값을 채워 넣는다.
function deterministicFallback(step, ctx, slots) {
  const out = [];
  const pool = [];
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
    case 'project_overview':
      pool.push(ctx.title, ctx.intro, ctx.overview,
        [ctx.period, ctx.role].filter(Boolean).join(' · '),
        (ctx.techStack || []).join(', '));
      break;
    case 'project_problem':
      pool.push(ctx.title, ctx.problem, ctx.action || ctx.task, ctx.process);
      break;
    case 'project_metric': {
      const kes = ctx.keyExperiences || [];
      // metric · title 을 박스 수만큼 번갈아 배치
      for (const ke of kes) {
        if (ke.metric) pool.push(ke.metric);
        if (ke.title || ke.metricLabel) pool.push(ke.metricLabel || ke.title);
        if (ke.result || ke.description) pool.push(ke.result || ke.description);
      }
      break;
    }
    case 'project_result':
      pool.push(ctx.title, ctx.output, ctx.growth, ctx.competency);
      break;
    case 'project': {
      const p = ctx.project || {};
      pool.push(p.title, p.overview || p.intro || p.description, p.problem, p.action, p.output || p.result, p.growth || p.learning,
        (p.techStack || []).join(', '),
        ...(p.keyExperiences || []).flatMap(ke => [ke.metric, ke.title]));
      break;
    }
    case 'education':
      pool.push(...(ctx.education || []).map(e => [e.school, e.major, e.period].filter(Boolean).join(' · ')));
      break;
    case 'awards':
      pool.push(...(ctx.awards || []).map(a => [a.title || a.name, a.organization || a.org, a.year || a.date].filter(Boolean).join(' · ')));
      break;
    case 'contact':
      pool.push(ctx.contact?.email, ctx.contact?.github, ctx.contact?.website || ctx.contact?.linkedin);
      break;
  }
  const cleanPool = pool.map(s => (s || '').toString().trim()).filter(Boolean);
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const text = (cleanPool[i] || '').slice(0, slot.maxChars || 120);
    const isMetric = step.sectionType === 'project_metric' && /^[+\-]?\d|%|ms|s$|배|개$/.test(text);
    out.push({ shapeId: slot.shapeId, text, emphasis: isMetric ? 'metric' : 'none' });
  }
  return { slots: out };
}

// ── 9) 메인: per-slide 병렬 호출 ─────────────────────────────────────────────
async function mapSlide(step, ctx, slots) {
  if (!slots.length) return { slots: [] };
  const prompt = buildSingleSlidePrompt(step, ctx, slots);
  const label = `Slide${step.planIndex}-${step.sectionType}`;
  try {
    const text = await withTimeout(
      generateWithRetry(prompt, LITE_OPTIONS),
      PER_SLIDE_TIMEOUT_MS,
      label
    );
    const parsed = parseJSON(text);
    if (!parsed?.slots || !Array.isArray(parsed.slots)) throw new Error('AI 응답에 slots 없음');
    return parsed;
  } catch (err) {
    console.warn(`[${label}] 매핑 실패 → 결정적 폴백:`, err.message);
    return deterministicFallback(step, ctx, slots);
  }
}

export async function mapDeck({ portfolio, layout }) {
  const { norm, plan } = planDeck(layout, portfolio);
  const t0 = Date.now();
  console.log(`[PPT-Mapper] ${plan.length}개 슬라이드 병렬 매핑 시작 (Lite)`);

  const slideResults = await Promise.all(plan.map(step => {
    const ctx = buildContext(norm, step);
    const slots = buildSlots(layout, step);
    return mapSlide(step, ctx, slots);
  }));

  console.log(`[PPT-Mapper] 병렬 완료: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  return plan.map((step, i) => {
    const tpl = layout.slides[step.templateSlideIndex];
    const ai = slideResults[i] || { slots: [] };
    const slotMap = new Map();
    for (const s of (ai.slots || [])) slotMap.set(s.shapeId, s);
    return {
      planIndex: step.planIndex,
      sectionType: step.sectionType,
      templateSlideIndex: step.templateSlideIndex,
      boxes: (tpl.textBoxes || []).map(box => {
        const aiSlot = slotMap.get(box.shapeId);
        return {
          ...box,
          text: (aiSlot?.text || '').trim(),
          emphasis: aiSlot?.emphasis || 'none',
        };
      }),
    };
  });
}
