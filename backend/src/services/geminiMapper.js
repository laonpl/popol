// PPT 콘텐츠 매핑 (결정론적).
//
// Gemini 호출 없이 결정론적 폴백만으로 박스를 채운다.
// 이전 방식(슬라이드당 Gemini 호출)은 토큰이 많이 들고,
// AI가 박스를 오분류해 디자인이 깨지는 문제가 있었음.
// 결정론적 fill은 더 빠르고 디자인을 안정적으로 보존함.

import { estimateMaxChars } from './autofit.js';
import { generateWithRetry } from '../config/geminiClient.js';

const _estimateMaxChars = estimateMaxChars;

function parseJSON(text, pattern = /\{[\s\S]*\}/) {
  if (!text) return null;
  const m = text.match(pattern);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function numbersSubsetOf(summary, source) {
  const nums = (s) => new Set((String(s).match(/\d+(?:[.,]\d+)?/g) || []).map(n => n.replace(/,/g, '')));
  const srcNums = nums(source);
  for (const n of nums(summary)) {
    if (!srcNums.has(n)) return false;
  }
  return true;
}

// 포트폴리오에서 올 수 있는 플레이스홀더 텍스트 패턴.
// 이 패턴이 탐지되면 빈 문자열로 교체해 슬라이드에 노출되지 않게 한다.
const PLACEHOLDER_RE = /작성\s*필요|원본에\s*없음|^\(?\s*예\s*[:：]|^\[작성|^\[예:|작성예시|입력하세요|내용을 입력|TODO/i;
function cleanFill(value) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  return PLACEHOLDER_RE.test(s) ? '' : s;
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
// 한국어 포트폴리오 템플릿의 다양한 변형(표지/커버/메인/Hero, 사례/케이스/주요 경험 등)을 잡기 위해
// 키워드를 충분히 넓혀둠. 매칭은 점수 가산식이므로 키워드 중복(예: '소개'가 cover/about/project에 모두 등장)은
// scoreFor에서 합산되어 가장 강한 신호가 이김 — 중복을 두려워하지 말 것.
const KIND_KEYWORDS = {
  cover:     ['표지', '커버', '포트폴리오', 'portfolio', '이름', 'profile', '프로필', '메인', 'main', 'hero', 'intro', '소개합니다', '안녕하세요', 'opening'],
  about:     ['소개', '자기소개', '가치관', '비전', '미션', 'about', 'values', '강점', 'introduction', '저는', 'who am i', 'who i am', '핵심 가치', 'philosophy', '나를'],
  skills:    ['기술', '스킬', '스택', '역량', '도구', '프레임워크', '언어', 'skill', 'stack', 'tool', 'framework', 'tech', 'expertise', '전문성', '핵심 역량', 'core competency', 'capability', '능력'],
  // '01'/'02'/'03' 같은 순번 토큰은 목차(TOC)·인덱스 슬라이드와 오매칭되어 그 슬라이드를
  // 'project'로 잘못 분류시킨다(→ 프로젝트 본문이 목차에 배정돼 빈칸→삭제되는 내용 손실). 제외.
  project:   ['프로젝트', 'project', '작업물', '개요', 'overview', 'case study', 'case', 'work', '사례', '케이스', '주요 경험', '대표 프로젝트', '프로젝트 사례', 'representative'],
  metric:    ['지표', '수치', '차트', '그래프', '데이터', 'kpi', 'metric', '%', 'before', 'after', '↑', '↓', '증가', '감소', '임팩트', 'impact', '전환', '효율', '절감', '개선', '배', 'x배', 'roi', 'mau', 'dau', '향상', '단축', '달성'],
  problem:   ['문제', '배경', '이슈', 'problem', 'issue', 'background', '핵심행동', '진행', '과정', 'task', 'process', 'action', '해결', 'solution', 'ideate', 'prototype', 'develop', 'test', 'iteration', 'research', '도전', 'challenge', '접근', 'approach', 'how', '실행', '수행'],
  result:    ['결과', '성과', '결과물', 'result', 'output', 'achievement', '산출물', '효과', '임팩트', 'impact', '달성', 'outcome', '성취', '완성', 'delivered'],
  growth:    ['성장', '배운', '회고', '학습', 'growth', 'learning', 'retrospect', '나의 역량', 'competency', 'lesson', 'takeaway', 'reflection', '교훈', '회고록', 'what i learned', '깨달은'],
  experience:['경력', '경험', '활동', '인턴', '업무', 'experience', 'career', 'work history', '재직', '이력', 'history', 'timeline'],
  education: ['학력', '교육', '학교', '전공', '학과', 'education', 'degree', '졸업', 'university', 'school', '대학', '학위'],
  awards:    ['수상', '상', '자격', '인증', 'award', 'certificate', 'license', '인정', 'recognition', '취득', 'achievement', '자격증'],
  contact:   ['연락처', '이메일', '문의', 'contact', 'email', '@', '연결', 'reach out', 'get in touch', '메일', 'thank you', 'thanks', '감사합니다', 'final', '마무리', 'closing'],
};

function classifySlideKind(tplSlide) {
  if (!tplSlide || !tplSlide.textBoxes) return 'generic';
  // 목차(TOC) 슬라이드 구조 감지: "01","02",... 순번 박스가 3개 이상이거나 목차 키워드.
  // 키워드 점수로는 본문 단계명(EMPATHIZE 등)에 밀려 problem 등으로 오분류된다.
  const indexBoxCount = tplSlide.textBoxes.filter(b => /^0?\d{1,2}$/.test((b.originalText || '').trim())).length;
  const tocText = tplSlide.textBoxes.map(b => (b.originalText || '').toLowerCase()).join(' ');
  if (indexBoxCount >= 3 || /목차|contents|agenda|순서는/.test(tocText)) return 'toc';
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

// ── 3-c) 공간적 그룹핑 (Spatial Grouping) ───────────────────────────────────
// 슬라이드 내 텍스트 박스를 x(열) 또는 y(행) 좌표로 클러스터링하여
// "카드" 또는 "열" 단위를 인식한다.
//
// 핵심 문제: 3열 카드 템플릿에서 모든 텍스트를 순서대로 첫 번째 열에 쏟아붓고
// 나머지 열은 빈 채로 남는 현상 → 각 클러스터가 별개 데이터 1건을 받도록 보장.
//
// 알고리즘:
//   1. x 좌표로 정렬 후 gap > slideWidth * 12% 이면 새 열 클러스터 시작.
//   2. 열 클러스터가 2개 이상이고 크기가 균형 잡혀 있으면 column 모드.
//   3. 열 클러스터가 1개(단일 열)면 y 좌표로 재시도 → row 모드.
//   4. 그것도 1개면 grouping 없음 (기존 sequential fill 유지).
function detectSpatialGroups(boxes, slideW = 720, slideH = 540) {
  if (!boxes || boxes.length <= 1) {
    return { groupCount: 1, groupAxis: 'none', groupMap: new Map((boxes || []).map(b => [b.shapeId, 0])) };
  }

  const X_GAP = slideW * 0.12; // 슬라이드 너비의 12% 이상 공백 = 열 경계
  const Y_GAP = slideH * 0.10; // 슬라이드 높이의 10% 이상 공백 = 행 경계

  // ── 열(column) 클러스터링 ──
  const byX = [...boxes].sort((a, b) => a.x - b.x);
  const colBuckets = [];
  let curCol = [byX[0]];
  let rightEdge = byX[0].x + byX[0].w;
  for (let i = 1; i < byX.length; i++) {
    const b = byX[i];
    if (b.x > rightEdge + X_GAP) {
      colBuckets.push(curCol);
      curCol = [b];
      rightEdge = b.x + b.w;
    } else {
      curCol.push(b);
      rightEdge = Math.max(rightEdge, b.x + b.w);
    }
  }
  colBuckets.push(curCol);

  if (colBuckets.length >= 2) {
    const sizes = colBuckets.map(c => c.length);
    const maxSz = Math.max(...sizes);
    const minSz = Math.min(...sizes);
    // 균형 조건: 가장 큰 열 박스 수가 가장 작은 열의 3배 이내
    if (maxSz <= minSz * 3) {
      const groupMap = new Map();
      colBuckets.forEach((bucket, gi) => bucket.forEach(b => groupMap.set(b.shapeId, gi)));
      return { groupCount: colBuckets.length, groupAxis: 'column', groupMap };
    }
  }

  // ── 행(row) 클러스터링 ──
  const byY = [...boxes].sort((a, b) => a.y - b.y);
  const rowBuckets = [];
  let curRow = [byY[0]];
  let bottomEdge = byY[0].y + byY[0].h;
  for (let i = 1; i < byY.length; i++) {
    const b = byY[i];
    if (b.y > bottomEdge + Y_GAP) {
      rowBuckets.push(curRow);
      curRow = [b];
      bottomEdge = b.y + b.h;
    } else {
      curRow.push(b);
      bottomEdge = Math.max(bottomEdge, b.y + b.h);
    }
  }
  rowBuckets.push(curRow);

  if (rowBuckets.length >= 2) {
    const groupMap = new Map();
    rowBuckets.forEach((row, gi) => row.forEach(b => groupMap.set(b.shapeId, gi)));
    return { groupCount: rowBuckets.length, groupAxis: 'row', groupMap };
  }

  // 그룹 없음 → 기존 sequential fill
  return { groupCount: 1, groupAxis: 'none', groupMap: new Map(boxes.map(b => [b.shapeId, 0])) };
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
  toc:                { toc: 100, generic: 40 },
  about:              { about: 100, cover: 35, generic: 60 },
  skills:             { skills: 100, project: 30, generic: 55 },
  // 프로젝트 섹션 구분 — 제목 위주의 단순 슬라이드 선호. cover 는 실제 표지와 겹쳐 "표지 반복"처럼
  // 보이므로 낮춘다(about/generic/project 우선). 표지 중복의 핵심 원인.
  project_divider:    { about: 80, generic: 72, project: 62, cover: 40 },
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
// 같은 템플릿 슬라이드를 반복 사용하면 출력물이 "같은 슬라이드 여러 장"처럼 보인다(중복의 핵심).
// 페널티를 키워 desired 섹션이 가능한 한 서로 다른 템플릿 슬라이드로 분산되게 한다.
// (base 점수 30~100 범위 → 35면 한 번 재사용한 강매칭(100→65)이 미사용 약매칭(~60)과 비슷해져
//  먼저 모든 슬라이드를 한 번씩 쓰고 부족할 때만 재사용)
const REUSE_PENALTY = 35;

export function planDeck(layout, portfolio) {
  const norm = normalizePortfolio(portfolio);

  const tplKinds = (layout.slides || []).map((s, i) => {
    let kind = classifySlideKind(s);
    // 구조 prior: 첫 슬라이드는 사실상 항상 표지. 키워드 분류는 표지 샘플 문구(전공·학번 등)에
    // 끌려 education 등으로 오분류된다 — toc 가 아닌 한 cover 로 고정.
    if (i === 0 && kind !== 'toc') kind = 'cover';
    return { index: i, kind, boxCount: (s.textBoxes || []).length };
  });
  const hasToc = tplKinds.some(t => t.kind === 'toc');
  // 챕터 구분 카드로 쓸 만한 박스 적은 슬라이드(≤7개)가 없으면 divider 자체를 생략.
  // 박스 12개짜리 본문 슬라이드가 divider 로 배정되면 LLM 이 전부 채워 본문 슬라이드와 중복된다.
  const hasSparseSlide = tplKinds.some(t => t.kind !== 'cover' && t.kind !== 'toc' && t.boxCount <= 7);

  const desired = [];
  desired.push({ kind: 'cover', sectionType: 'cover', sectionParam: null });
  if (hasToc) {
    desired.push({ kind: 'toc', sectionType: 'toc', sectionParam: null });
  }
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
    const sections = buildProjectSections(norm.projects[i], i, packingCapacity, norm.projects.length)
      .filter(sec => hasSparseSlide || sec.sectionType !== 'project_divider');
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
      // divider 는 텍스트가 적은 슬라이드를 선호 — 본문형 슬라이드에 배정되면 내용 중복 발생.
      const sparseBias = d.kind === 'project_divider' ? t.boxCount * 2 : 0;
      const adjusted = base - reuse * REUSE_PENALTY - sparseBias;
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

// 덱 아웃라인(목차 항목) — toc 섹션 채움에 사용
function buildOutlineItems(norm) {
  const items = [];
  if (norm.about.essay || norm.about.headline || norm.about.values.length) items.push('소개');
  if (norm.skills && Object.keys(norm.skills).length) items.push('기술 스택');
  norm.projects.forEach((p, i) => items.push(p.title || `프로젝트 ${i + 1}`));
  if (norm.education.length) items.push('학력');
  if (norm.awards.length) items.push('수상 및 자격');
  items.push('연락처');
  return items;
}

// ── 4) 슬라이드 박스 사양 빌드 (per-slide) ───────────────────────────────────
// AI 가 박스 의도(제목/본문/메트릭/태그)를 빠르게 파악할 수 있도록 hint 첨부.
function buildSlots(layout, step) {
  const tpl = layout.slides[step.templateSlideIndex];
  const boxes = tpl.textBoxes || [];
  const slideW = layout.slideSize?.widthPt  || 720;
  const slideH = layout.slideSize?.heightPt || 540;

  // 공간적 그룹 탐지: 각 박스에 groupId 부착
  const { groupCount, groupAxis, groupMap } = detectSpatialGroups(boxes, slideW, slideH);

  const maxFont = boxes.reduce((m, b) => Math.max(m, b.fontPt || 0), 0);
  const slots = boxes.map(box => {
    const fontPt = Math.round(box.fontPt || 14);
    // 템플릿 폰트가 9pt 미만인 박스는 9pt 기준으로 char_budget 계산 → 현실적인 수용량 보장
    const effectivePt = Math.max(box.fontPt || 14, 9);
    const maxChars = estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt: effectivePt });
    const originalText = (box.originalText || '').slice(0, 120);
    let { hint, semanticRole } = inferSlotIntent(box, { maxFont, maxChars, originalText });
    // 목차: 행 라벨 박스(원문이 EMPATHIZE 같은 큰 라벨이라 metric 등으로 오분류)를
    // heading 으로 통일해 아웃라인 항목이 행 순서대로 들어가게 한다.
    if (step.sectionType === 'toc' && semanticRole !== 'title' && semanticRole !== 'index' && maxChars > 6) {
      semanticRole = 'heading';
      hint = 'heading';
    }
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
      groupId: groupMap.get(box.shapeId) ?? 0,
    };
  });

  // PAR/병합 슬라이드: 가장 큰 non-title 박스를 'result' 슬롯으로 지정.
  // Result(성과/지표)가 슬라이드에서 가장 눈에 띄는 위치에 배치되도록 보장.
  const PAR_TYPES = new Set(['project_par', 'project_merged', 'project_result', 'project_output']);
  if (PAR_TYPES.has(step.sectionType)) {
    const nonTitle = slots.filter(s => s.semanticRole !== 'title' && s.semanticRole !== 'index');
    if (nonTitle.length > 0) {
      const largest = nonTitle.reduce((a, b) => b.basePt > a.basePt ? b : a);
      if (largest.semanticRole !== 'metric') {
        const target = slots.find(s => s.shapeId === largest.shapeId);
        if (target) { target.semanticRole = 'result'; target.hint = 'heading'; }
      }
    }
  }

  return { slots, groupCount, groupAxis };
}

// 박스의 originalText / 폰트 크기 / 글자 한도를 보고 의도(metric/title/tag/...)를 추론.
// Why: 같은 슬라이드에 비슷한 크기의 박스가 여럿 있을 때, 어느 박스가 무엇을 위한 자리인지
// 정확히 구분되어야 Gemini가 엉뚱한 자리에 텍스트를 넣지 않는다. 한국어 변형·단위·번호 패턴을 충분히 인식.
function inferSlotIntent(box, { maxFont, maxChars, originalText }) {
  const fontPt = Math.round(box.fontPt || 14);
  const text = originalText.toLowerCase();
  const trimmed = originalText.trim();
  const has = (...words) => words.some(w => text.includes(w));
  // 단계 라벨(IDEATE/STEP 1 등)도 일반 박스로 취급 — 템플릿 글은 보존하지 않고
  // 폰트 크기 규칙에 따라 title/heading 으로 분류되어 사용자 내용을 받는다(사용자 결정).

  const isIndexLabel = /^(0?\d{1,2}|[①-⑳]|[IVXLCDM]{1,4})$/i.test(trimmed) && trimmed.length <= 4;
  if (isIndexLabel) return { hint: 'index', semanticRole: 'index' };

  // 숫자/단위/증감 화살표 — 한국어 단위(명/건/억/만/주/일/시간 등) 보강
  const isNumeric = /^[+\-]?\d+([.,]\d+)?(%|%p|ms|s|배|개|원|회|점|위|명|건|억|만|주|일|시간|분|x|X|K|M|B|kg|MB|GB|TB|↑|↓|→)?$/.test(trimmed)
    || /^[↑↓→]\s*[+\-]?\d/.test(trimmed)
    || /^\d+([.,]\d+)?\s*(→|->|to)\s*\d/.test(trimmed);
  if (isNumeric || has('metric', 'kpi', '성과', '지표', 'before', 'after', '임팩트', 'impact', '전환', '효율', '절감', '향상')) {
    return { hint: 'metric', semanticRole: 'metric' };
  }
  if (has('tech', 'stack', 'skill', 'tools', '기술', '스택', '도구', '프레임워크', '언어', 'framework', 'expertise')) {
    return { hint: maxChars <= 20 ? 'tag' : 'body', semanticRole: 'tech' };
  }
  if (has('period', 'date', 'role', '기간', '역할', '소속', '회사', 'company', '날짜', 'when', 'where')) {
    return { hint: 'heading', semanticRole: 'meta' };
  }
  if (has('link', 'url', 'github', 'demo', '링크', 'live', 'website', 'http')) {
    return { hint: 'body', semanticRole: 'link' };
  }
  if (box.role === 'title' || (maxFont > 0 && fontPt >= maxFont * 0.9 && fontPt >= 24)) {
    return { hint: 'title', semanticRole: 'title' };
  }
  // 큰 폰트 + 작은 글자수 한도 → 메트릭 자리 (예: 한 화면에 "85%"만 들어가는 큰 칸)
  if (fontPt >= 28 && maxChars <= 14) {
    return { hint: 'metric', semanticRole: 'metric' };
  }
  if (box.role === 'heading' || fontPt >= 22) {
    return { hint: 'heading', semanticRole: 'heading' };
  }
  if (maxChars <= 15) {
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
    case 'about': {
      const skillsSummary = Object.values(norm.skills || {})
        .flatMap(arr => (arr || []).map(x => (typeof x === 'string' ? x : x?.name || '')))
        .filter(Boolean).slice(0, 10).join(', ');
      return {
        userName: norm.about.name,
        headline: norm.about.headline,
        essay: norm.about.essay,
        values: norm.about.values,
        goals: norm.about.goals,
        targetCompany: norm.targetCompany,
        targetPosition: norm.targetPosition,
        contact: norm.contact,
        skillsSummary,
      };
    }
    case 'skills': {
      const skillsFlat = Object.values(norm.skills || {})
        .flatMap(arr => (arr || []).map(x => (typeof x === 'string' ? x : x?.name || '')))
        .filter(Boolean);
      return { skills: norm.skills, skillsFlat };
    }
    case 'project_divider':
      return {
        sectionLabel: `Project ${(step.sectionParam ?? 0) + 1}`,
        projectIndex: (step.sectionParam ?? 0) + 1,
        title: proj?.title,
        role: proj?.role,
        period: proj?.period,
        intro: proj?.intro,
        techStack: proj?.techStack,
        keyExperiences: (proj?.keyExperiences || []).slice(0, 2).map(ke => ({
          metric: ke.metric, metricLabel: ke.metricLabel, title: ke.title,
        })),
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
    // project_merged: 독립 슬라이드 — 프로젝트 전체 데이터 포함
    case 'project_merged':
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
    // project_par: project_intro 다음 슬라이드 — intro/overview/techStack 중복 방지를 위해 제외
    case 'project_par':
      return {
        title: proj?.title,
        problem: proj?.problem,
        action: proj?.action,
        process: proj?.process,
        task: proj?.task,
        output: proj?.output,
        growth: proj?.growth,
        competency: proj?.competency,
        keyExperiences: proj?.keyExperiences || [],
      };
    case 'toc':
      return { title: '목차', outline: buildOutlineItems(norm) };
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

// ── 6) 섹션별 매핑 가이드 (참고용) ──────────────────────────────────────────
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
    `  ⚠ 바로 앞 슬라이드(project_intro)에서 소개·기술스택이 이미 표시됐으므로 intro/overview/techStack 절대 반복 금지.\n` +
    `  · "문제/배경/상황" 라벨 박스 → problem (핵심만 1~2문장 — intro/overview 반복 금지)\n` +
    `  · "과정/행동/해결" 라벨 박스 → action 또는 process 또는 task (동사 bullet)\n` +
    `  · "결과/성과/결과물" 라벨 박스 → output + growth 압축 (1~2문장)\n` +
    `  · hint=metric 박스 → keyExperiences[0].metric (강조, emphasis="metric")\n` +
    `  · 나머지 박스 → competency 배분 (techStack/role 반복 금지)\n` +
    `PAR 흐름을 명확히 보여주는 것이 이 슬라이드의 목적. 단정형, 동사 시작 bullet.`,
  toc:
    `이 슬라이드는 목차. outline 배열의 항목을 순서대로 각 행/카드의 제목 박스에 배치.\n` +
    `  · 큰 제목 박스 → "목차" 또는 "Contents"\n` +
    `  · 행별 제목 박스 → outline[i] (행 순서대로 1건씩)\n` +
    `  · 순번 박스(01,02..) → 건드리지 말 것("")\n` +
    `outline 항목 수보다 행이 많으면 남는 행은 "" 로 비워라. 본문/긴 설명 절대 X.`,
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
  const slotsForPrompt = slots.map((s, i) => ({
    box_id: `B${i}`,
    hint: s.hint,
    semanticRole: s.semanticRole,
    char_budget: s.maxChars,
    basePt: s.basePt,
  }));
  return `당신은 FitPoly의 수석 포트폴리오 디렉터이자 PPT 콘텐츠 매핑 모듈입니다.
한 슬라이드의 텍스트 박스에 들어갈 한국어 텍스트를 결정해 JSON 으로 반환하십시오.

━━━ [절대 규칙] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A. char_budget 은 참고 분량이다. 폰트 자동 축소(normAutofit)가 적용되므로 내용이 있으면
   자르지 말고 작성하라. 단, char_budget 의 1.5배를 초과하면 반드시 압축하라.
   char_budget ≤ 15 인 박스는 단어 1~2개 한도. char_budget ≤ 6 인 박스는 "" 로 비워라.
B. 사용자 데이터(아래 [사용자 데이터])에 없는 회사명·숫자·사실·수치 절대 창작 금지.
   데이터에 없는 필드는 빈 문자열("")로 반환. '[작성 필요]', '나의 역할', 'N/A',
   '내용을 입력하세요' 등의 placeholder 텍스트 절대 생성 금지.
C. 같은 슬라이드 내 두 박스에 동일·유사 text 출력 금지 (중복 내용 출력 방지).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[형식 규칙]
1. 모든 slots 항목에 text 필드 포함 필수.
   빈 문자열("") 사용 조건:
   (a) 사용자 데이터에 이 박스 의도에 맞는 값이 없는 경우
   (b) char_budget ≤ 8 인 경우 (아이콘·장식·번호 자리)
2. 한국어 명사형/단정형. 존댓말·이모지 X.
3. 출력은 JSON 만 (마크다운 코드펜스 X).

[박스 hint / semanticRole 가이드]
- hint="title"  : 슬라이드 핵심 제목. 가장 짧고 강한 표현. char_budget 엄수.
- hint="metric" : 숫자/단위/% KPI 값만 (예: "150ms", "+12%", "3배"). emphasis="metric".
                  데이터에 metric 없으면 "" — 절대 창작 금지.
- hint="tag"    : 키워드 한 단어. 긴 텍스트 절대 금지.
- hint="heading": 부제·섹션 헤딩. 한 줄 요약.
- hint="body"   : 본문. 1~3문장 또는 동사 시작 bullet.
                  bullet 줄바꿈은 \\n. 내용을 자르지 말고 자연스럽게 작성.
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

// ── 7-b) 그룹별 데이터 아이템 빌더 ──────────────────────────────────────────
// 섹션 타입과 그룹 수에 따라 "그룹 0→데이터A, 그룹 1→데이터B" 매핑 배열 반환.
// null 반환 시 → 기존 sequential fill 사용 (안전망).
function buildGroupDataItems(step, ctx, groupCount) {
  if (groupCount <= 1) return null;

  switch (step.sectionType) {
    case 'toc': {
      const outline = ctx.outline || [];
      if (outline.length < 2) return null;
      return outline.slice(0, groupCount).map(item => ({ heading: item, body: item }));
    }

    case 'skills': {
      // 열별로 다른 기술 카테고리 (Languages / Frameworks / Tools / Others)
      const SKILL_LABELS = { languages: '언어', frameworks: '프레임워크', tools: '툴', others: '기타' };
      const cats = Object.entries(ctx.skills || {}).map(([key, arr]) => {
        const items = (Array.isArray(arr) ? arr : [])
          .map(x => typeof x === 'string' ? x : (x?.name || '')).filter(Boolean);
        return items.length ? { heading: SKILL_LABELS[key] || key, body: items.join(', '), items } : null;
      }).filter(Boolean);
      return cats.length >= 2 ? cats.slice(0, groupCount) : null;
    }

    case 'project_metric': {
      // 카드/열별로 다른 keyExperience
      const kes = (ctx.keyExperiences || []).slice(0, groupCount);
      if (kes.length < 2) return null;
      return kes.map(ke => ({
        metric:      cleanFill(ke.metric || ke.afterMetric || ''),
        heading:     cleanFill(ke.metricLabel || ke.title || ''),
        body:        cleanFill(ke.result || ke.description || ''),
        beforeMetric:cleanFill(ke.beforeMetric || ''),
        afterMetric: cleanFill(ke.afterMetric || ke.metric || ''),
      }));
    }

    case 'about': {
      // 가치관·목표 카드 분산
      const vals = (ctx.values || [])
        .map(v => cleanFill(typeof v === 'string' ? v : (v?.keyword || v?.title || '')))
        .filter(Boolean);
      const goals = (ctx.goals || [])
        .map(g => cleanFill(typeof g === 'string' ? g : (g?.title || g?.heading || '')))
        .filter(Boolean);
      const all = [...vals, ...goals];
      if (all.length < 2) return null;
      return all.slice(0, groupCount).map(item => ({ heading: item, body: item }));
    }

    case 'project_result': {
      const items = [
        { heading: '결과물',    body: cleanFill(ctx.output || '') },
        { heading: '성장한 점', body: cleanFill(ctx.growth || '') },
        { heading: '역량',      body: cleanFill(ctx.competency || '') },
      ].filter(i => i.body);
      return items.length >= 2 ? items.slice(0, groupCount) : null;
    }

    case 'project_par': {
      const items = [
        { heading: '문제/배경', body: cleanFill(ctx.problem || ctx.task || '') },
        { heading: '핵심행동',  body: cleanFill(ctx.action  || ctx.process || '') },
        { heading: '성과',      body: cleanFill(ctx.output  || ctx.growth || '') },
      ].filter(i => i.body);
      return items.length >= 2 ? items.slice(0, groupCount) : null;
    }

    case 'project_problem': {
      const items = [
        { heading: '문제/배경', body: cleanFill(ctx.problem || ctx.task || '') },
        { heading: '핵심행동',  body: cleanFill(ctx.action  || ctx.process || '') },
      ].filter(i => i.body);
      return items.length >= 2 ? items.slice(0, groupCount) : null;
    }

    default:
      return null;
  }
}

// 그룹별 데이터 아이템으로 슬롯 채우기.
// 각 슬롯의 groupId → groupDataItems[groupId] 에서 role에 맞는 텍스트 선택.
function fillByGroups(slots, groupDataItems) {
  const out = [];
  for (const slot of slots) {
    const gid   = slot.groupId ?? 0;
    const item  = groupDataItems[gid] ?? groupDataItems[0] ?? {};
    const role  = slot.semanticRole || slot.hint || 'body';
    const cap   = slot.maxChars || 120;

    let text = '';
    switch (role) {
      case 'title':
      case 'heading':
      case 'result':
        text = cleanFill(item.heading || item.body || ''); break;
      case 'metric':
        text = cleanFill(item.metric || item.afterMetric || ''); break;
      case 'tag':
      case 'tech':
        text = cleanFill(Array.isArray(item.items)
          ? item.items.slice(0, 6).join(', ')
          : (item.body || item.heading || '')); break;
      case 'body':
        text = cleanFill(item.body || item.heading || ''); break;
      case 'meta':
        text = cleanFill(item.period || item.role || ''); break;
      case 'index':
        text = cleanFill(slot.originalText || ''); break;
      default:
        text = cleanFill(item.body || item.heading || '');
    }

    // cap ≤ 6 장식 박스에 긴 텍스트 주입 방지
    if (text && text.length > cap * 2 && cap <= 6) text = '';

    out.push({ shapeId: slot.shapeId, text, emphasis: role === 'metric' ? 'metric' : 'none' });
  }
  return { slots: out };
}

// ── 8) 결정적 폴백 (AI 실패 시) ──────────────────────────────────────────────
function deterministicFallback(step, ctx, slots, groupMeta = {}) {
  const { groupCount = 1, groupAxis = 'none' } = groupMeta;

  // 목차 전용 결정론 채움: 제목="목차", 순번 박스는 원문 유지,
  // heading 박스(행 라벨)에 아웃라인 항목을 위→아래 순서대로 1건씩 배정.
  if (step.sectionType === 'toc') {
    const outline = (ctx.outline || []).slice();
    const out = slots.map(s => {
      if (s.semanticRole === 'title') return { shapeId: s.shapeId, text: '목차', emphasis: 'none' };
      if (s.semanticRole === 'index') return { shapeId: s.shapeId, text: cleanFill(s.originalText || ''), emphasis: 'none' };
      if (s.semanticRole === 'heading' && outline.length) return { shapeId: s.shapeId, text: outline.shift(), emphasis: 'none' };
      return { shapeId: s.shapeId, text: '', emphasis: 'none' };
    });
    return { slots: out };
  }

  // 그룹 경로: 공간 클러스터가 2개 이상이고 섹션별 데이터 아이템이 준비된 경우만 사용.
  // 실패(null 반환) 시 아래 sequential fill 로 자동 폴백 — 안전망 보장.
  const groupDataItems = buildGroupDataItems(step, ctx, groupCount);
  if (groupDataItems && groupCount >= 2) {
    console.log(`[PPT-Mapper] 그룹 매핑 [${step.sectionType}] ${groupCount}개 ${groupAxis} → ${groupDataItems.length}건 분배`);
    const filled = fillByGroups(slots, groupDataItems);
    // 목차의 큰 제목 박스는 outline 항목이 아니라 "목차" 고정.
    // (LLM 의 "목차" 출력은 원문 복사 가드에 막혀 baseline 이 그대로 노출되므로 여기서 보정)
    if (step.sectionType === 'toc') {
      const titleIds = new Set(slots.filter(s => s.semanticRole === 'title').map(s => s.shapeId));
      for (const s of filled.slots) if (titleIds.has(s.shapeId)) s.text = '목차';
    }
    return filled;
  }

  const pool = [];
  const secondary = [];
  // secondary는 cleanFill 통과한 값만 — [작성 필요] 등 플레이스홀더 원천 차단
  const pushS = (...vs) => vs.forEach(v => { const s = cleanFill(v); if (s) secondary.push(s); });
  pushS(ctx.title, ctx.intro, ctx.overview, ctx.problem, ctx.action, ctx.process,
    ctx.task, ctx.output, ctx.growth, ctx.competency, ctx.role, ctx.period);
  if (Array.isArray(ctx.techStack) && ctx.techStack.length) secondary.push(ctx.techStack.join(', '));
  for (const ke of (ctx.keyExperiences || [])) {
    pushS(ke.metric, ke.title, ke.metricLabel, ke.result, ke.description);
  }

  const push = (...vals) => vals.forEach(v => { const s = cleanFill(v); if (s) pool.push(s); });

  switch (step.sectionType) {
    case 'cover':
      push(ctx.title, ctx.userName, ctx.headline,
        [ctx.targetCompany, ctx.targetPosition].filter(Boolean).join(' · '));
      break;
    case 'about': {
      // headline/essay/values/goals 가 비어있으면 targetPosition, skills, userName 으로 보강
      const valuesLine = (ctx.values || []).slice(0, 5).map(v => typeof v === 'string' ? v : v?.keyword || v?.title || '').filter(Boolean).join(', ');
      const goalsLine  = (ctx.goals  || []).slice(0, 3).map(v => typeof v === 'string' ? v : v?.title || v?.heading || '').filter(Boolean).join(', ');
      push(ctx.headline, ctx.essay, valuesLine, goalsLine,
        ctx.targetPosition, ctx.targetCompany, ctx.skillsSummary, ctx.userName);
      break;
    }
    case 'skills': {
      const s = ctx.skills || {};
      ['languages', 'frameworks', 'tools', 'others'].forEach(k => {
        const arr = Array.isArray(s[k]) ? s[k] : [];
        const line = arr.map(x => typeof x === 'string' ? x : x?.name || '').filter(Boolean).join(', ');
        push(line);
      });
      break;
    }
    case 'project_divider':
      // 구분 카드(챕터 표지)는 라벨/제목/메타만. intro 등 본문을 넣으면 다음 intro 슬라이드와
      // 동일 내용이 중복 생성된다("같은 슬라이드 3번" 버그). 본문은 의도적으로 제외.
      push(ctx.sectionLabel || `Project ${ctx.projectIndex || 1}`, ctx.title,
        [ctx.period, ctx.role].filter(Boolean).join(' · '));
      break;
    case 'project_intro':
      push(ctx.title, ctx.intro, [ctx.period, ctx.role].filter(Boolean).join(' · '),
        (ctx.techStack || []).join(', '));
      break;
    case 'project_overview':
      push(ctx.title, ctx.overview, ctx.intro,
        [ctx.period, ctx.role].filter(Boolean).join(' · '), (ctx.techStack || []).join(', '));
      break;
    case 'project_task':
      push(ctx.title, ctx.task, ctx.role);
      break;
    case 'project_problem':
      push(ctx.title, ctx.problem, ctx.action, ctx.process);
      break;
    case 'project_metric': {
      const kes = ctx.keyExperiences || [];
      for (const ke of kes) {
        push(ke.metric, ke.metricLabel || ke.title, ke.result || ke.description);
      }
      break;
    }
    case 'project_output':
      push(ctx.title, ctx.output, ctx.link);
      break;
    case 'project_growth':
      push(ctx.title, ctx.growth);
      break;
    case 'project_competency':
      push(ctx.title, ctx.competency, (ctx.techStack || []).join(', '));
      break;
    case 'project_result':
      push(ctx.title, ctx.output, ctx.growth, ctx.competency);
      break;
    case 'project': {
      const p = ctx.project || {};
      push(p.title, p.overview || p.intro || p.description, p.problem, p.action,
        p.output || p.result, p.growth || p.learning, (p.techStack || []).join(', '));
      (p.keyExperiences || []).forEach(ke => push(ke.metric, ke.title));
      break;
    }
    case 'toc':
      push('목차', ...(ctx.outline || []));
      break;
    case 'education':
      for (const e of (ctx.education || [])) {
        push(e.school || e.name, [e.major || e.degree, e.period].filter(Boolean).join(' · '));
      }
      break;
    case 'awards':
      for (const a of (ctx.awards || [])) {
        push(a.title || a.name, [a.organization || a.org, a.year || a.date].filter(Boolean).join(' · '));
      }
      break;
    case 'contact':
      push(ctx.contact?.email, ctx.contact?.github, ctx.contact?.website || ctx.contact?.linkedin);
      break;
  }

  const cleanPrimary = pool.filter(Boolean);
  const cleanSecondary = secondary.map(s => cleanFill(s)).filter(Boolean).filter(s => !cleanPrimary.includes(s));
  const merged = [...cleanPrimary, ...cleanSecondary];

  const firstMetric = (ctx.keyExperiences || []).find(ke => ke.metric || ke.beforeMetric || ke.afterMetric) || null;
  const projectMeta = cleanFill([ctx.period, ctx.role].filter(Boolean).join(' · '));
  const techLine    = Array.isArray(ctx.techStack) ? ctx.techStack.slice(0, 6).join(', ') : '';
  // 본문용 우선 콘텐츠: intro/overview 우선 → pool 순서대로 폴백
  // Why: pickForSlot의 merged[index] 방식은 pool이 [title, period, tech] 일 때
  //   body 슬롯(index=1)이 "2026-05"(period)를 받아버리는 문제가 있었음.
  //   intro/overview를 명시적으로 우선하면 올바른 본문이 들어감.
  // 구분 카드는 본문 슬롯을 비워 다음 intro 슬라이드와의 내용 중복(동일 슬라이드 반복)을 차단.
  const isDivider = step.sectionType === 'project_divider';
  const bodyContent  = isDivider ? '' : cleanFill(ctx.intro || ctx.overview || ctx.task || ctx.problem || '');
  const bodyContent2 = isDivider ? '' : cleanFill(ctx.action || ctx.output || ctx.growth || '');
  let bodyIdx = 0;
  const nextBody = () => {
    const candidates = [bodyContent, bodyContent2, ...merged].filter(Boolean);
    const v = candidates[bodyIdx % Math.max(1, candidates.length)] || '';
    bodyIdx++;
    return v;
  };
  const pickForSlot = (slot, index) => {
    const role = slot.semanticRole || slot.hint || 'body';
    if (role === 'title')  return cleanFill(ctx.title  || ctx.userName || ctx.sectionLabel || merged[index] || '');
    if (role === 'metric') return cleanFill(firstMetric?.metric || firstMetric?.afterMetric || '');
    if (role === 'meta')   return cleanFill(projectMeta || '');
    if (role === 'tech' || role === 'tag') return cleanFill(techLine || merged[index] || '');
    if (role === 'link')   return cleanFill(ctx.link || ctx.contact?.github || ctx.contact?.website || '');
    if (role === 'index')  return cleanFill(slot.originalText || '');
    // 구분 카드: 라벨(heading)/제목/메타만 채우고 본문은 비운다(중복 슬라이드 방지).
    if (isDivider && role === 'heading') return cleanFill(ctx.sectionLabel || `Project ${ctx.projectIndex || 1}`);
    if (isDivider && role === 'body')    return '';
    if (role === 'heading') return cleanFill(bodyContent || merged[index] || ctx.title || '');
    if (role === 'body')    return nextBody();
    return cleanFill(merged[index] || '');
  };

  const out = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const cap = slot.maxChars || 120;
    const candidate = pickForSlot(slot, i);
    // cap ≤ 6 인 아이콘·장식용 박스에 긴 텍스트 → 세로 글자 깨짐 방지
    const text = (candidate && candidate.length > cap * 2 && cap <= 6) ? '' : candidate;
    const isMetric = step.sectionType === 'project_metric' && /^[+\-]?\d|%|ms|s$|배|개$/.test(text);
    out.push({ shapeId: slot.shapeId, text, emphasis: isMetric ? 'metric' : 'none' });
  }
  return { slots: out };
}

// AI 출력이 원본 template 더미 텍스트를 그대로 복사했는지 판정.
// - 와전 동일
// - b 가 8~30자: a 가 b 를 포함 (짧은 섹션 라벨 오탐 방지로 4→8로 상향)
// - b 가 31자 이상: a 가 b 의 앞 40% 이상을 포함 (장문 부분 복사)
function looksLikeOriginal(text, originalText) {
  if (!text || !originalText) return false;
  const norm = (s) => String(s).toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '').trim();
  const a = norm(text);
  const b = norm(originalText);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.length >= 8 && b.length <= 30 && a.includes(b)) return true;
  if (b.length > 30 && b.length >= 8) {
    const prefix = b.slice(0, Math.max(8, Math.floor(b.length * 0.4)));
    if (a.includes(prefix)) return true;
  }
  return false;
}

// ── 8-b) 스마트 콘텐츠 피팅 ──────────────────────────────────────────────────
const SUMMARY_MIN_LEN = 70;
const SUMMARY_OVERFLOW_RATIO = 1.15;

function buildSummarizePrompt(jobs) {
  const list = jobs.map(j => ({ key: j.key, max_chars: j.target, text: j.text }));
  return `당신은 합격 포트폴리오 PPT의 콘텐츠 압축 엔진입니다.
아래 각 텍스트를 지정된 max_chars 이내로 압축하십시오.

[절대 규칙]
1. 원문에 있는 사실·고유명사·숫자·수치만 사용. 없는 숫자·회사·성과 절대 창작 금지.
2. 액션 동사 중심의 단정형 비즈니스 문체(명사형 종결 허용). 존댓말·이모지·미사여구 금지.
3. 핵심 1개를 살리고 부연은 버린다. max_chars 를 반드시 지킬 것(초과 금지).
4. 줄바꿈(\\n)은 원문이 여러 항목(bullet)일 때만 사용. 단일 문장이면 한 줄.
5. 의미가 이미 max_chars 이내면 원문을 거의 그대로 정리만 한다.

[압축할 텍스트]
${JSON.stringify(list, null, 2)}

[출력 스키마] JSON 만 반환 (코드펜스 금지):
{ "results": [ { "key": "<입력 key 그대로>", "summary": "<max_chars 이내 압축문>" } ] }`;
}

async function summarizeOverflow(deck) {
  const jobs = [];
  for (let si = 0; si < deck.length; si++) {
    const boxes = deck[si].boxes || [];
    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi];
      const text = (box.text || '').trim();
      if (text.length < SUMMARY_MIN_LEN) continue;
      if (['metric', 'tag', 'index'].includes(box.semanticRole)) continue;
      const basePt = Math.max(box.fontPt || 14, 9);
      const budget = estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt });
      if (text.length <= budget * SUMMARY_OVERFLOW_RATIO) continue;
      jobs.push({ key: `${si}_${bi}`, target: Math.max(40, Math.round(budget)), text });
    }
  }
  if (!jobs.length) return;

  console.log(`[PPT-Mapper] 콘텐츠 피팅: ${jobs.length}개 초과 박스 1회 배치 요약 요청`);
  let parsed = null;
  try {
    const raw = await generateWithRetry(buildSummarizePrompt(jobs), {
      models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      retries: 1,
      callTimeoutMs: 60000,
      config: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    parsed = parseJSON(raw);
  } catch (e) {
    console.warn(`[PPT-Mapper] 요약 실패 → 결정론적 원문 유지: ${e?.message || e}`);
    return;
  }

  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const byKey = new Map(results.filter(r => r && r.key != null).map(r => [String(r.key), String(r.summary || '').trim()]));
  let applied = 0;
  for (const job of jobs) {
    const summary = byKey.get(job.key);
    if (!summary) continue;
    const [si, bi] = job.key.split('_').map(Number);
    const box = deck[si]?.boxes?.[bi];
    if (!box) continue;
    if (summary.length > 0 && summary.length < box.text.length && numbersSubsetOf(summary, job.text)) {
      box.text = summary;
      applied++;
    }
  }
  if (applied) console.log(`[PPT-Mapper] 콘텐츠 피팅 적용: ${applied}/${jobs.length}개 박스 압축 완료`);
}

// ── 8-c) 배치 LLM 매핑 (전체 슬라이드 1회 호출) ──────────────────────────────
// 복잡한 업로드 템플릿(슬라이드당 박스 10+개)을 결정론 규칙만으로는 1~2개 박스만 채우게 된다.
// 전체 슬라이드의 박스 구조 + 섹션 데이터를 한 번의 Gemini 호출로 보내 박스별 텍스트를 받아온다.
// 결과는 "결정론 baseline 위에 검증 통과분만 덮어쓰기" 로 적용 → 호출 실패/누락 시 현행 동작 보장.
function buildBatchMappingPrompt(items) {
  const sections = [...new Set(items.map(it => it.sectionType))];
  const guideLines = sections
    .map(sec => `- ${sec}: ${(SECTION_GUIDE[sec] || '').split('\n')[0]}`)
    .join('\n');
  const slides = items.map(it => ({
    slide_id: it.slideId,
    section: it.sectionType,
    data: it.ctx,
    boxes: it.slots.map((s, i) => ({ box_id: i, hint: s.hint, role: s.semanticRole, char_budget: s.maxChars })),
  }));
  return `당신은 FitPoly의 수석 포트폴리오 디렉터이자 PPT 콘텐츠 매핑 모듈입니다.
아래 여러 슬라이드의 텍스트 박스에 들어갈 한국어 텍스트를 한 번에 결정해 JSON 으로 반환하십시오.

━━━ [절대 규칙] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
A. char_budget 은 권장 분량. 내용이 있으면 자르지 말고 자연스럽게 쓰되 char_budget 의 1.5배 초과 금지.
   char_budget ≤ 6 박스는 "" 로 비워라.
B. 각 슬라이드의 data 에 없는 회사·숫자·사실·수치 절대 창작 금지. data 에 맞는 값이 없으면 "".
   '[작성 필요]','N/A','내용을 입력하세요' 같은 placeholder 절대 생성 금지.
C. 같은 슬라이드 내 두 박스에 동일·유사·부분중복 text 금지. 한 사실/문장을 길이만 바꿔
   여러 박스에 나눠 넣지 말 것. 적합한 내용이 없는 박스는 억지로 채우지 말고 "" 로 비워라.
D. role 우선순위: title=핵심 제목(짧고 강하게) / metric=숫자·단위만(예 "309라인","98%") / tag=키워드 1~2개 /
   heading=부제·카드 제목 / body=1~3문장 또는 동사 시작 bullet(줄바꿈 \\n) / meta="기간 · 역할" /
   index=빈 문자열("")로 두라(템플릿 순번 라벨이므로 건드리지 않음).
   ※ "속도","단축" 같은 단어 조각을 title 에 넣지 말 것 — title 은 완결된 핵심 문구만.
E. 여러 heading/body 박스가 있으면 keyExperiences·problem·action·result 를 "카드별로 1건씩" 나누어
   배치하라(한 카드 = 한 경험). 한 사실을 쪼개 여러 칸을 메우지 말 것. 채울 게 없으면 비워라.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[섹션별 의도]
${guideLines}

[슬라이드들 (각 슬라이드의 boxes 를 채울 것)]
${JSON.stringify(slides)}

[출력 스키마] JSON 만 반환 (마크다운 코드펜스 금지):
{ "slides": [ { "slide_id": <입력 slide_id 그대로>, "boxes": [ { "box_id": <정수>, "text": "<문자열>", "emphasis": "<none|metric|title>" } ] } ] }`;
}

async function aiMapAllSlides(items) {
  const out = new Map(); // `${slideId}:${boxId}` -> { text, emphasis }
  if (!items.length) return out;
  let parsed = null;
  try {
    // flash-lite 를 먼저(빠름 → 타임아웃 회피), flash 를 보강용으로. 큰 프롬프트라 타임아웃·재시도 넉넉히.
    // 모두 실패하면 호출부에서 결정론 baseline 으로 자동 폴백되지만, 그 경우 채움이 희소해지므로
    // 여기서 최대한 성공시키는 것이 "내용이 잘 담기는가"의 핵심.
    const raw = await generateWithRetry(buildBatchMappingPrompt(items), {
      models: ['gemini-2.5-flash-lite', 'gemini-2.5-flash'],
      retries: 2,
      callTimeoutMs: 150000,
      config: { temperature: 0.25, responseMimeType: 'application/json' },
    });
    parsed = parseJSON(raw);
  } catch (e) {
    console.warn(`[PPT-Mapper] LLM 일괄 매핑 실패 → 결정론적 결과 유지: ${e?.message || e}`);
    return out;
  }
  for (const sl of (parsed?.slides || [])) {
    if (sl?.slide_id == null) continue;
    for (const b of (sl.boxes || [])) {
      if (b == null || b.box_id == null) continue;
      out.set(`${sl.slide_id}:${b.box_id}`, { text: String(b.text || ''), emphasis: b.emphasis || 'none' });
    }
  }
  return out;
}

// ── 9) 메인: 결정론 baseline + 배치 LLM 매핑 오버레이 + 스마트 콘텐츠 피팅 ───────
export async function mapDeck({ portfolio, layout }) {
  const { norm, plan } = planDeck(layout, portfolio);

  const normStr = (s) => s.toLowerCase().replace(/\s+/g, '').trim();

  // 1) 각 슬라이드의 컨텍스트/슬롯/결정론 baseline 준비
  const prepared = plan.map((step, si) => {
    const ctx = buildContext(norm, step);
    const { slots, groupCount, groupAxis } = buildSlots(layout, step);
    const det = deterministicFallback(step, ctx, slots, { groupCount, groupAxis });
    return { si, step, ctx, slots, det };
  });

  // 2) 전체 슬라이드 1회 LLM 매핑 (실패 시 빈 Map → 결정론적 결과 그대로 사용)
  console.log(`[PPT-Mapper] ${plan.length}개 슬라이드 LLM 일괄 매핑 시도`);
  const aiMap = await aiMapAllSlides(prepared.map(p => ({
    slideId: p.si, sectionType: p.step.sectionType, ctx: p.ctx, slots: p.slots,
  })));
  if (aiMap.size) console.log(`[PPT-Mapper] LLM 매핑 응답 ${aiMap.size}개 박스 수신 (검증 후 적용)`);

  // 3) deck 빌드: 결정론 baseline 위에 검증 통과한 AI 텍스트만 덮어쓰기
  const deck = prepared.map(({ si, step, ctx, slots, det }) => {
    const detMap = new Map((det.slots || []).map(s => [s.shapeId, s]));
    const roleMap = new Map(slots.map(s => [s.shapeId, s.semanticRole]));
    const ctxStr = JSON.stringify(ctx);
    const ctxLower = ctxStr.toLowerCase();
    // 출처 토큰 가드: 숫자 가드(numbersSubsetOf)만으로는 "정보처리기사", "Python, Django" 같은
    // 비수치 창작(없는 자격증·기술스택)을 못 막는다. 5자 이상 텍스트는 원문 포함이거나
    // 토큰 2개 이상이 섹션 데이터(ctx)에 실제로 존재해야 채택.
    // (4자 이하는 "목표","학사" 같은 표현용 라벨이라 통과 — 사실 주장으로 보기 어려움)
    const isCtxBound = (cand) => {
      const norm = String(cand).toLowerCase().trim();
      if (norm.replace(/\s+/g, '').length <= 4) return true;
      if (ctxLower.includes(norm)) return true;
      const toks = norm.match(/[a-z0-9가-힣]{2,}/gi) || [];
      if (!toks.length) return true;
      const hits = toks.filter(t => ctxLower.includes(t)).length;
      return hits >= Math.min(2, toks.length);
    };

    // shapeId → 최종 {text, emphasis}
    const finalByShape = new Map();
    slots.forEach((slot, i) => {
      const base = detMap.get(slot.shapeId) || { text: '', emphasis: 'none' };
      let text = (base.text || '').trim();
      let emphasis = base.emphasis || 'none';
      const ai = aiMap.get(`${si}:${i}`);
      if (ai) {
        const cand = cleanFill(ai.text);
        const cap = slot.maxChars || 120;
        // 검증: 비어있지 않고 / 장식·번호 박스가 아니고 / 템플릿 원문 복사가 아니고 /
        //       원본 데이터에 없는 숫자·사실을 지어내지 않은 경우에만 채택. 아니면 결정론 baseline 유지.
        const role = slot.semanticRole;
        const ok = cand
          && cap > 6
          && role !== 'index'
          && !looksLikeOriginal(cand, slot.originalText)
          && numbersSubsetOf(cand, ctxStr)
          && isCtxBound(cand);
        if (ok) {
          text = cand;
          if (ai.emphasis === 'metric') emphasis = 'metric';
        }
      }
      // 목차의 제목 박스는 항상 "목차" — LLM 이 outline 항목으로 바꾸거나
      // 원문 복사 가드("목차"="목차")에 막혀 엉뚱한 baseline 이 남는 것 방지.
      if (step.sectionType === 'toc' && slot.semanticRole === 'title') text = '목차';
      finalByShape.set(slot.shapeId, { text, emphasis });
    });

    const tpl = layout.slides[step.templateSlideIndex];
    // 템플릿 원문은 보존하지 않는다(사용자 결정) — 매핑 안 된 박스는 비워서
    // 도형·이미지·배경 등 시각 디자인만 참조하고 글은 전부 사용자 내용으로 채운다.
    const rawBoxes = (tpl.textBoxes || []).map(box => {
      const f = finalByShape.get(box.shapeId);
      return {
        ...box,
        text: (f?.text || '').trim(),
        emphasis: f?.emphasis || 'none',
        semanticRole: roleMap.get(box.shapeId) || box.role,
      };
    });

    // 슬라이드 내 중복 텍스트 제거.
    // 1자 이상으로 낮춰 장식용 반복 숫자("3가지 핵심 문제" 디자인의 큰 "3" 등)도 1개만 남기고 제거한다.
    // (동일 텍스트만 충돌 — "1","2","3"처럼 서로 다르면 모두 유지)
    const seen = new Map();
    const dedupedBoxes = rawBoxes.map(b => {
      const t = b.text || '';
      if (t.length >= 1) {
        const key = normStr(t);
        if (key && seen.has(key)) return { ...b, text: '' };
        if (key) seen.set(key, true);
      }
      return b;
    });

    // 근접 중복 제거: body/heading 박스끼리 한 텍스트가 다른 텍스트에 포함되면(부분문자열)
    // 짧은 쪽을 비운다. LLM이 같은 내용을 길이만 달리해 여러 박스에 넣는 현상 정리.
    // (metric/tag/title/index 는 숫자·키워드 강조용이라 substring 제거에서 제외)
    const DUP_ROLES = new Set(['body', 'heading', 'result']);
    const dupKeys = dedupedBoxes.map(b =>
      (DUP_ROLES.has(b.semanticRole) && (b.text || '').trim().length >= 10) ? normStr(b.text) : null
    );
    for (let a = 0; a < dedupedBoxes.length; a++) {
      if (!dupKeys[a]) continue;
      for (let c = 0; c < dedupedBoxes.length; c++) {
        if (a === c || !dupKeys[c]) continue;
        // dupKeys[c] 가 dupKeys[a] 를 포함하고 더 길면 → a(짧은 쪽) 비움
        if (dupKeys[c].length > dupKeys[a].length && dupKeys[c].includes(dupKeys[a])) {
          dedupedBoxes[a] = { ...dedupedBoxes[a], text: '' };
          dupKeys[a] = null;
          break;
        }
      }
    }

    return {
      planIndex: step.planIndex,
      sectionType: step.sectionType,
      templateSlideIndex: step.templateSlideIndex,
      sectionParam: step.sectionParam,  // cross-slide 중복 제거에 필요
      boxes: dedupedBoxes,
    };
  });

  await summarizeOverflow(deck);

  // Cross-slide dedup: 같은 프로젝트의 연속 슬라이드 간 본문 내용 중복 제거.
  // project_intro 에서 표시된 내용이 project_par/project_overview 에 다시 나오는 경우 제거.
  // 제목(fontPt≥24, role=title) 및 15자 미만 짧은 텍스트는 중복 허용(날짜·라벨 반복 OK).
  const BODY_PROJ_TYPES = new Set([
    'project_intro', 'project_overview', 'project_par', 'project_problem',
    'project_result', 'project_merged', 'project_output', 'project_growth', 'project_competency',
  ]);
  const projBodySeen = new Map(); // sectionParam → Set<normalizedKey>
  for (const slide of deck) {
    const sParam = slide.sectionParam;
    if (sParam == null || !BODY_PROJ_TYPES.has(slide.sectionType)) continue;
    if (!projBodySeen.has(sParam)) projBodySeen.set(sParam, new Set());
    const seenSet = projBodySeen.get(sParam);
    for (const box of (slide.boxes || [])) {
      if ((box.fontPt || 0) >= 24 || box.role === 'title') continue;
      const t = (box.text || '').trim();
      if (t.length < 15) continue;
      const key = normStr(t);
      if (!key) continue;
      if (seenSet.has(key)) {
        console.log(`[PPT-Mapper] 슬라이드 간 중복 제거 [proj${sParam}/${slide.sectionType}]: "${t.slice(0, 40)}"`);
        box.text = '';
      } else {
        seenSet.add(key);
      }
    }
  }

  // Slide Pruning: AI가 아무 내용도 채우지 않은 슬라이드를 최종 덱에서 제거.
  // cover/about/skills/교육/수상/연락처 는 항상 유지.
  const ALWAYS_KEEP = new Set(['cover', 'about', 'skills', 'education', 'awards', 'contact']);
  // project_divider: 1개 이상 박스에 내용 있으면 유지 (챕터 구분자 역할)
  // 일반 콘텐츠 슬라이드: 최소 2개 박스에 내용 있어야 의미있는 슬라이드로 판정 (공백 슬라이드 제거)
  return deck.filter(slide => {
    if (ALWAYS_KEEP.has(slide.sectionType)) return true;
    const contentBoxes = (slide.boxes || []).filter(b => (b.text || '').trim().length > 2);
    const minBoxes = slide.sectionType === 'project_divider' ? 1 : 2;
    const hasContent = contentBoxes.length >= minBoxes;
    if (!hasContent) console.log(`[PPT-Mapper] 빈 슬라이드 제거: ${slide.sectionType}[${slide.templateSlideIndex}] (채워진 박스 ${contentBoxes.length}/${(slide.boxes||[]).length}개)`);
    return hasContent;
  });
}
