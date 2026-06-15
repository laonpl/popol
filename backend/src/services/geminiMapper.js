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
  const s = String(value || '')
    .replace(/<[^>]*>/g, ' ')            // 인라인 HTML(<br> 등)이 리터럴로 노출되는 것 차단
    .replace(/\s*[-–—]?\s*※[\s\S]*$/, '') // "※공고의 ... 기반 분석" 류 꼬리 주석 제거
    .replace(/\s+/g, ' ')
    .trim();
  return PLACEHOLDER_RE.test(s) ? '' : s;
}

// 제목·헤딩·메타처럼 "짧아야 하는" 박스에 본문급 텍스트가 들어가 9pt 로 구겨지는 것 방지.
// 예산을 크게 넘으면 절/문장 경계에서 잘라낸다 (본문 박스는 폰트 축소로 전량 보존 — 여긴 라벨 자리).
function clipShort(value, cap) {
  const t = cleanFill(value);
  if (!t || !cap || t.length <= cap * 1.6) return t;
  const slice = t.slice(0, Math.max(8, Math.round(cap * 1.4)));
  const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf(' '));
  return (cut > 8 ? slice.slice(0, cut) : slice).replace(/[,.\s]+$/, '').trim();
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
  // 문제 정의/배경 — "왜 이 프로젝트가 필요했는가". 합격자 서사의 출발점.
  const background = overview.background || sr.background || exp.background
    || byKey('background') || findSectionByLabel(subSections, '배경', 'background') || '';
  const problem    = background || carl.context || carl.problem || carl.background || exp.problem || findSectionByLabel(subSections, '문제', 'problem') || '';
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
    background,
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

  // 앱 내부 명칭("템플릿 1" 등)이 포트폴리오 제목으로 저장된 경우 — 슬라이드에 노출 금지
  const rawTitle = String(p.title || '').trim();
  const JUNK_TITLE_RE = /^(템플릿\s*\d+|template\s*\d+|무제|untitled|새\s*포트폴리오|포트폴리오)$/i;
  const safeTitle = (!rawTitle || JUNK_TITLE_RE.test(rawTitle))
    ? [p.userName, '포트폴리오'].filter(Boolean).join(' ') || '포트폴리오'
    : rawTitle;

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
    title: safeTitle,
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

// ── 3-d) 2차원 유닛(카드) 클러스터링 ────────────────────────────────────────
// 1-D 그룹(열/행)으로는 "이 라벨이 어느 값 박스에 붙는가"를 모른다 — (9)/(10)에서
// 라벨↔값이 뒤섞인 근본 원인. 근접성(상하 인접 + 가로 겹침 / 좌우 인접 + 세로 겹침)으로
// 박스를 "카드 유닛"으로 묶고, 내용 1건을 유닛 1개에 통째로 배정한다.
function buildUnits(slots, slideW = 720, slideH = 540) {
  const rects = slots.filter(s => s.semanticRole !== 'title' && s.semanticRole !== 'index');
  if (!rects.length) return [];
  const parent = rects.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

  const adjacent = (a, b) => {
    const vGap = Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height);
    const hGap = Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width);
    const hOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const vOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    // 상하 인접(라벨이 값 위/아래) — 가로로 충분히 겹쳐야 같은 카드
    if (vGap <= slideH * 0.035 && hOverlap >= 0.25 * Math.min(a.width, b.width)) return true;
    // 좌우 인접(라벨: 값 행) — 세로로 충분히 겹쳐야 같은 행
    if (hGap <= slideW * 0.025 && vOverlap >= 0.5 * Math.min(a.height, b.height)) return true;
    return false;
  };
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (adjacent(rects[i], rects[j])) union(i, j);
    }
  }
  const byRoot = new Map();
  rects.forEach((s, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(s);
  });

  const makeUnit = (members) => {
    const maxPt = Math.max(...members.map(m => m.basePt || 12));
    const anatomy = members.map(m => {
      const cap = m.maxChars || 0;
      const fit = m.fitCap || cap;
      let kind;
      if (m.semanticRole === 'metric' || ((m.basePt || 0) >= maxPt * 0.95 && cap <= 20 && members.length > 1)) kind = 'value';
      else if (fit <= 30 && (m.basePt || 0) <= maxPt * 0.8) kind = 'label';
      else if (fit >= 50) kind = 'body';
      else kind = 'heading';
      return { slot: m, kind };
    });
    return {
      members,
      minY: Math.min(...members.map(m => m.y)),
      minX: Math.min(...members.map(m => m.x)),
      maxY: Math.max(...members.map(m => m.y + m.height)),
      maxX: Math.max(...members.map(m => m.x + m.width)),
      valueSlot: anatomy.filter(a => a.kind === 'value').sort((a, b) => (b.slot.basePt || 0) - (a.slot.basePt || 0))[0]?.slot || null,
      labelSlots: anatomy.filter(a => a.kind === 'label').map(a => a.slot).sort((a, b) => (a.y - b.y) || (a.x - b.x)),
      bodySlots: anatomy.filter(a => a.kind === 'body').map(a => a.slot).sort((a, b) => ((b.maxChars || 0) - (a.maxChars || 0))),
      headingSlots: anatomy.filter(a => a.kind === 'heading').map(a => a.slot).sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    };
  };
  let units = [...byRoot.values()].map(makeUnit);

  // 라벨 전용 유닛(본문 없는 작은 라벨/헤딩 묶음)을 본문 유닛에 결합.
  // 두 패턴: ① "라벨(좌) ←넓은 간격→ 본문(우)" 같은 행 ② "라벨(위) / 본문(아래)" 스택.
  // 라벨이 고아로 남으면 (9)/(10)처럼 라벨만 찍히고 내용이 사라진다.
  const isLabelOnly = (u) => !u.bodySlots.length && !u.valueSlot
    && u.members.every(m => (m.fitCap || m.maxChars || 0) <= 34);
  const merged = [];
  const labelOnly = units.filter(isLabelOnly);
  const contentful = units.filter(u => !isLabelOnly(u));
  for (const lu of labelOnly) {
    const luCy = (lu.minY + lu.maxY) / 2;
    const sameRow = contentful.filter(u => {
      const cy = (u.minY + u.maxY) / 2;
      const vClose = Math.abs(cy - luCy) <= Math.max(u.maxY - u.minY, lu.maxY - lu.minY) * 0.7;
      const hGap = Math.max(lu.minX, u.minX) - Math.min(lu.maxX, u.maxX);
      return vClose && hGap <= slideW * 0.14;
    });
    const xOverlapRatio = (a, b) => {
      const ov = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      return ov / Math.max(1, Math.min(a.maxX - a.minX, b.maxX - b.minX));
    };
    const below = contentful.filter(u =>
      u.minY >= lu.maxY - 4
      && u.minY - lu.maxY <= slideH * 0.09
      && xOverlapRatio(lu, u) >= 0.3
    );
    const dist = (u) => {
      const cy = (u.minY + u.maxY) / 2;
      const cx = (u.minX + u.maxX) / 2;
      const lcx = (lu.minX + lu.maxX) / 2;
      return Math.abs(cy - luCy) + Math.abs(cx - lcx) * 0.5;
    };
    const host = [...sameRow, ...below].sort((a, b) => dist(a) - dist(b))[0];
    if (host) merged.push([lu, host]);
  }
  if (merged.length) {
    const absorbed = new Set(merged.map(([lu]) => lu));
    units = units.filter(u => !absorbed.has(u));
    for (const [lu, host] of merged) {
      const idx = units.indexOf(host);
      if (idx >= 0) units[idx] = makeUnit([...host.members, ...lu.members]);
    }
  }

  units.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));
  return units;
}

// ── 3-e) 섹션별 구조화 아이템 (합격자 서사 모델) ─────────────────────────────
// 각 아이템 = { label(짧은 카드 라벨), heading(짧은 강조문), body(본문), metric(수치) }.
// "문제 정의 → 해결 아이디어 → 성과" 순서를 모든 프로젝트 섹션의 기본 서사로 강제한다.
function buildSectionItems(step, ctx) {
  const items = [];
  const push = (label, body, metric = '', heading = '') => {
    const b = cleanFill(body), m = cleanFill(metric), h = cleanFill(heading);
    if (b || m || h) items.push({ label: cleanFill(label), body: b, metric: m, heading: h });
  };
  const meta = [ctx.period, ctx.role].filter(Boolean).join(' · ');
  const techLine = Array.isArray(ctx.techStack) ? ctx.techStack.slice(0, 8).join(', ') : '';
  const firstMetric = (ctx.keyExperiences || []).find(ke => ke.metric || ke.afterMetric) || null;

  switch (step.sectionType) {
    case 'cover':
      // userName 은 제목 슬롯(sectionTitleFor)이 항상 표시하므로 아이템으로 중복 배치하지 않음
      push('', ctx.headline, '', ctx.title || ctx.userName);
      push('TARGET', [ctx.targetCompany, ctx.targetPosition].filter(Boolean).join(' · '));
      break;
    case 'about': {
      const valuesLine = (ctx.values || []).slice(0, 5)
        .map(v => typeof v === 'string' ? v : v?.keyword || v?.title || '').filter(Boolean).join(', ');
      const goalsLine = (ctx.goals || []).slice(0, 3)
        .map(g => typeof g === 'string' ? g : g?.title || g?.heading || '').filter(Boolean).join(', ');
      push('가치관', ctx.essay || valuesLine);
      push('목표', goalsLine || [ctx.targetCompany, ctx.targetPosition].filter(Boolean).join(' '));
      push('강점', ctx.headline);
      push('기술 요약', ctx.skillsSummary);
      break;
    }
    case 'skills': {
      const SKILL_LABELS = { languages: '언어', frameworks: '프레임워크', tools: '툴', others: '기타' };
      for (const [key, arr] of Object.entries(ctx.skills || {})) {
        const list = (Array.isArray(arr) ? arr : [])
          .map(x => typeof x === 'string' ? x : x?.name || '').filter(Boolean);
        if (list.length) push(SKILL_LABELS[key] || key, list.join(', '));
      }
      break;
    }
    case 'project_divider':
      push(ctx.sectionLabel || `Project ${(ctx.projectIndex || 1)}`, meta, '', ctx.title);
      break;
    case 'project_intro':
    case 'project_overview': {
      const problem = ctx.background || ctx.problem || '';
      push('문제 정의', problem || ctx.intro);
      if (ctx.intro && ctx.intro !== problem) push('프로젝트 소개', ctx.intro);
      else if (ctx.overview && ctx.overview !== problem) push('프로젝트 개요', ctx.overview);
      push('기간 · 역할', meta);
      push('기술 스택', techLine);
      break;
    }
    case 'project_task':
      push('진행한 일', ctx.task);
      push('역할', ctx.role);
      break;
    case 'project_problem':
    case 'project_par':
      push('문제 정의', ctx.background || ctx.problem || ctx.task);
      push('해결 아이디어', ctx.action || ctx.process);
      push('성과', ctx.output || ctx.growth, firstMetric?.metric || '');
      break;
    case 'project_merged':
      push('문제 정의', ctx.background || ctx.problem || ctx.intro);
      push('해결 아이디어', ctx.action || ctx.process || ctx.task);
      push('성과', ctx.output || ctx.growth, firstMetric?.metric || '');
      push('기간 · 역할', meta);
      push('기술 스택', techLine);
      break;
    case 'project_metric':
      for (const ke of (ctx.keyExperiences || [])) {
        push(ke.metricLabel || ke.title, ke.result || ke.description || ke.action, ke.metric || ke.afterMetric);
      }
      break;
    case 'project_output':
      push('결과물', ctx.output);
      push('링크', ctx.link);
      break;
    case 'project_growth':
      push('성장한 점', ctx.growth);
      break;
    case 'project_competency':
      push('나의 역량', ctx.competency);
      push('기술 스택', techLine);
      break;
    case 'project_result':
      push('결과물', ctx.output);
      push('성장한 점', ctx.growth);
      push('역량', ctx.competency);
      break;
    case 'education':
      for (const e of (ctx.education || [])) {
        push('학력', [e.major || e.degree, e.period].filter(Boolean).join(' · '), '', e.school || e.name);
      }
      break;
    case 'awards':
      for (const a of (ctx.awards || [])) {
        push('수상', [a.organization || a.org, a.year || a.date].filter(Boolean).join(' · '), '', a.title || a.name);
      }
      break;
    case 'contact':
      if (ctx.contact?.email) push('EMAIL', ctx.contact.email);
      if (ctx.contact?.github) push('GITHUB', ctx.contact.github);
      if (ctx.contact?.website || ctx.contact?.linkedin) push('LINK', ctx.contact.website || ctx.contact.linkedin);
      break;
    default:
      break;
  }
  return items;
}

// 슬라이드 제목 박스(role=title)에 들어갈 텍스트 — 섹션 의미 기준
function sectionTitleFor(step, ctx) {
  switch (step.sectionType) {
    case 'cover': return cleanFill(ctx.userName || ctx.title || '');
    case 'toc': return '목차';
    case 'about': return '소개';
    case 'skills': return '기술 스택';
    case 'education': return '학력';
    case 'awards': return '수상 및 자격';
    case 'contact': return '연락처';
    case 'project_divider': return cleanFill(ctx.title || ctx.sectionLabel || '');
    default: return cleanFill(ctx.title || '');
  }
}

// ── 3-f) 유닛 채움 — 아이템 1건 = 카드 1개 ──────────────────────────────────
// 유닛 내부 배치는 "본문 먼저, 가장 잘 맞는 슬롯에" 원칙:
//   본문(최대 수용 슬롯) → 수치(값 슬롯) → 라벨(남은 작은 슬롯) → 헤딩.
// 라벨은 본문이 자리잡은 뒤에만 들어가므로 "라벨만 찍히고 내용 실종" 이 구조적으로 불가능.
function fillByUnits(step, ctx, slots, units, items) {
  const textByShape = new Map(); // shapeId -> { text, emphasis }
  const set = (slot, text, emphasis = 'none') => {
    if (!slot) return false;
    const cap = slot.maxChars || 120;
    const t = cleanFill(text);
    if (!t || (cap <= 6 && t.length > cap * 2)) return false;
    textByShape.set(slot.shapeId, { text: t, emphasis });
    return true;
  };
  const fitCapOf = (s) => s.fitCap || s.maxChars || 0;

  // 제목/순번 박스
  const title = sectionTitleFor(step, ctx);
  for (const s of slots) {
    if (s.semanticRole === 'title') set(s, clipShort(title, Math.max(s.fitCap || 0, s.maxChars || 40)));
    else if (s.semanticRole === 'index') set(s, s.originalText || '');
  }

  const fillable = units.filter(u => u.members.length);
  if (!fillable.length || !items.length) return textByShape;

  // 유닛 하나에 아이템 하나를 통째로 배치
  const fillUnit = (u, it) => {
    const taken = new Set();
    const free = () => u.members.filter(m => !taken.has(m.shapeId) && !textByShape.has(m.shapeId));
    let labelEmbedded = false;
    // 1) 본문 — 수용량 최대 슬롯 (metric 이 쓸 값 슬롯은 아껴둔다)
    if (it.body) {
      const cand = free()
        .filter(s => !(it.metric && s === u.valueSlot))
        .sort((a, b) => fitCapOf(b) - fitCapOf(a))[0];
      if (cand && fitCapOf(cand) * 2 >= Math.min(it.body.length, 40)) {
        // 라벨을 받아줄 작은 슬롯이 없는 단독 본문 슬롯 → 라벨을 본문 첫 줄로 결합
        const others = u.members.filter(m => m !== cand);
        const embed = it.label && fitCapOf(cand) >= 60
          && !others.some(m => !textByShape.has(m.shapeId) && fitCapOf(m) * 1.6 >= it.label.length);
        if (set(cand, embed ? `${it.label}\n${it.body}` : it.body)) {
          taken.add(cand.shapeId);
          labelEmbedded = embed;
        }
      }
    }
    // 2) 수치 — 값 슬롯 우선
    if (it.metric) {
      const cand = (u.valueSlot && !taken.has(u.valueSlot.shapeId) && !textByShape.has(u.valueSlot.shapeId))
        ? u.valueSlot
        : free().sort((a, b) => fitCapOf(a) - fitCapOf(b)).find(s => fitCapOf(s) >= Math.min(it.metric.length, 6));
      if (cand && set(cand, it.metric, 'metric')) taken.add(cand.shapeId);
    }
    // 3) 라벨 — 남은 가장 작은 슬롯
    if (it.label && !labelEmbedded) {
      const cand = free().sort((a, b) => fitCapOf(a) - fitCapOf(b)).find(s => fitCapOf(s) * 1.6 >= it.label.length);
      if (cand && set(cand, it.label)) taken.add(cand.shapeId);
    }
    // 4) 헤딩 — 남은 슬롯 1개 (라벨과 다를 때만)
    if (it.heading && it.heading !== it.label) {
      const cand = free().sort((a, b) => fitCapOf(b) - fitCapOf(a)).find(s => fitCapOf(s) * 1.6 >= Math.min(it.heading.length, 24));
      if (cand) set(cand, clipShort(it.heading, Math.max(cand.fitCap || 0, cand.maxChars || 24)));
    }
  };

  // 매칭: metric 아이템 → 값 슬롯 보유 유닛 우선, 나머지는 "본문이 들어가는" 유닛에 순서대로
  const isMetricUnit = (u) => u.valueSlot && (u.valueSlot.maxChars || 99) <= 20;
  const unitBestCap = (u) => Math.max(...u.members.map(fitCapOf));
  const itemQueue = [...items];
  const assigned = new Map(); // unit -> item
  if (itemQueue.some(it => it.metric)) {
    for (const u of fillable.filter(isMetricUnit)) {
      const mi = itemQueue.findIndex(it => it.metric);
      if (mi < 0) break;
      assigned.set(u, itemQueue.splice(mi, 1)[0]);
    }
  }
  for (const u of fillable) {
    if (assigned.has(u) || !itemQueue.length) continue;
    // 작은 박스에 장문을 욱여넣지 않도록, 이 유닛이 감당 가능한 아이템을 고른다
    const cap = unitBestCap(u);
    const idx = itemQueue.findIndex(it => !it.body || cap >= 60 || it.body.length <= cap * 2);
    if (idx < 0) continue;
    assigned.set(u, itemQueue.splice(idx, 1)[0]);
  }
  for (const [u, it] of assigned) fillUnit(u, it);

  // 남은 아이템 1차: 아직 빈 본문급 슬롯(fitCap≥40)에 읽기 순서대로 분배
  if (itemQueue.length) {
    const freeBodySlots = fillable
      .flatMap(u => u.members)
      .filter(s => !textByShape.has(s.shapeId) && fitCapOf(s) >= 40)
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
    for (const s of freeBodySlots) {
      if (!itemQueue.length) break;
      const it = itemQueue.shift();
      const head = [it.label, it.metric].filter(Boolean).join(' · ');
      const text = head && fitCapOf(s) >= 60 ? `${head}\n${it.body || it.heading}` : (it.body || it.heading || head);
      set(s, text, it.metric ? 'metric' : 'none');
    }
  }

  // 남은 아이템 2차: 가장 큰 본문 슬롯에 서사로 결합 — 거대 본문 장표가
  // "수치 한 줄"로 끝나는 배치 붕괴 방지. (문제 정의 → 해결 → 성과가 한 패널에 이어짐)
  if (itemQueue.length) {
    const bigSlot = fillable
      .flatMap(u => u.members)
      .filter(s => fitCapOf(s) >= 120)
      .sort((a, b) => fitCapOf(b) - fitCapOf(a))[0];
    if (bigSlot) {
      const joined = itemQueue
        .map(it => {
          const head = [it.label, it.metric].filter(Boolean).join(' · ');
          return head ? `${head}\n${it.body || it.heading}` : (it.body || it.heading);
        })
        .filter(Boolean)
        .join('\n\n');
      const existing = textByShape.get(bigSlot.shapeId);
      if (existing) textByShape.set(bigSlot.shapeId, { ...existing, text: `${existing.text}\n\n${joined}` });
      else set(bigSlot, joined);
      itemQueue.length = 0;
    }
  }
  return textByShape;
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
  // 프로젝트가 4개 이상이면 divider 생략 — 8장짜리 템플릿이 30장+로 비대해지는 주범
  const needsDivider = totalProjects > 1 && totalProjects <= 3;

  // ─ 케이스 A: 매우 짧음 → divider + 통합 1장 ────────────────────────────────
  // (1.5 → 1.0 하향: 합격자 서사(문제 정의 → 아이디어 → 성과)가 통합 1장에서는 뭉개지므로
  //  내용이 조금이라도 있으면 intro + PAR 2장 분리를 우선한다)
  if (estimatedSlides <= 1.0) {
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

  const scale = Math.max(1, (layout.slideSize?.heightPt || 540) / 540);
  const tplKinds = (layout.slides || []).map((s, i) => {
    let kind = classifySlideKind(s);
    // 구조 prior: 첫 슬라이드는 사실상 항상 표지. 키워드 분류는 표지 샘플 문구(전공·학번 등)에
    // 끌려 education 등으로 오분류된다 — toc 가 아닌 한 cover 로 고정.
    if (i === 0 && kind !== 'toc') kind = 'cover';
    // 큰 폰트 + 짧은 수용량 = KPI 값 자리 — metric 섹션 배치 적합도 판단용
    const metricBoxes = (s.textBoxes || []).filter(b =>
      (b.fontPt || 0) >= 24 * scale
      && _estimateMaxChars({ boxWidthPt: b.w, boxHeightPt: b.h, basePt: b.fontPt || 14 }) <= 18
    ).length;
    return { index: i, kind, boxCount: (s.textBoxes || []).length, metricBoxes };
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
    // 같은 템플릿 슬라이드 4회 이상 재사용 금지(하드캡) — (10)의 "시나리오 장표 4연속" 차단.
    // 모든 슬라이드가 캡에 걸린 극단(섹션 수 ≫ 템플릿 수)에만 전체 풀로 폴백.
    const underCap = tplKinds.filter(t => (usedCount.get(t.index) || 0) < 3);
    const pool = underCap.length ? underCap : tplKinds;
    for (const t of pool) {
      const aff = (KIND_MATCH[d.kind] || {})[t.kind];
      const base = (aff != null) ? aff : 30;
      const reuse = usedCount.get(t.index) || 0;
      // divider 는 텍스트가 적은 슬라이드를 선호 — 본문형 슬라이드에 배정되면 내용 중복 발생.
      const sparseBias = d.kind === 'project_divider' ? t.boxCount * 2 : 0;
      // 표지/목차 슬라이드는 다른 섹션에 재사용 금지 — 수상이 96pt 표지에, 연락처가 목차에
      // 배정되는 오용 방지. 본문 슬라이드 재사용(페널티 누적)이 항상 더 낫다.
      const structuralBias = ((t.kind === 'cover' && d.kind !== 'cover') || (t.kind === 'toc' && d.kind !== 'toc')) ? 500 : 0;
      // KPI 섹션은 "큰 숫자 자리"가 있는 슬라이드에 — 거대 본문 장표에 수치 한 줄만 들어가는 배치 붕괴 방지
      const metricBias = d.kind === 'project_metric'
        ? Math.min(t.metricBoxes || 0, 3) * 12 - ((t.metricBoxes || 0) === 0 ? 25 : 0)
        : 0;
      const adjusted = base - reuse * REUSE_PENALTY - sparseBias - structuralBias + metricBias;
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

  // 덱 길이 상한: 8장 템플릿이 30장+로 늘어나면 "같은 디자인 반복" 인상 + 내용 희석.
  // 우선순위 낮은 섹션부터 뒤에서부터 제거.
  const MAX_DECK_SLIDES = 22;
  if (plan.length > MAX_DECK_SLIDES) {
    const before = plan.length;
    for (const dropType of ['project_divider', 'project_metric', 'project_overview', 'project_result']) {
      for (let i = plan.length - 1; i >= 0 && plan.length > MAX_DECK_SLIDES; i--) {
        if (plan[i].sectionType === dropType) plan.splice(i, 1);
      }
      if (plan.length <= MAX_DECK_SLIDES) break;
    }
    plan.forEach((p, i) => { p.planIndex = i; });
    console.log(`[PPT-Mapper] 덱 길이 상한 적용: ${before} → ${plan.length}장`);
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
  const scale = Math.max(1, slideH / 540);
  const slots = boxes.map(box => {
    const fontPt = Math.round(box.fontPt || 14);
    // 템플릿 폰트가 9pt 미만인 박스는 9pt 기준으로 char_budget 계산 → 현실적인 수용량 보장
    const effectivePt = Math.max(box.fontPt || 14, 9);
    const maxChars = estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt: effectivePt });
    // 축소-후 수용량: 렌더러가 shrinkToFit 으로 폰트를 줄여 채우므로,
    // "이 박스가 본문을 담을 수 있는가"는 원본 폰트가 아니라 가독 하한 크기 기준으로 판단.
    // (72pt 표지 박스도 21pt 로 줄이면 400자 본문 슬롯이다 — 원본 기준 cap19 로는 항상 라벨 취급되는 버그)
    const fitPt = Math.max(9, Math.min(box.fontPt || 14, 14 * scale));
    const fitCap = estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt: fitPt });
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
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.w),
      height: Math.round(box.h),
      basePt: fontPt,
      maxChars,
      fitCap,
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

  return { slots, groupCount, groupAxis, slideW, slideH };
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
        background: proj?.background,
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
        background: proj?.background,
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
        background: proj?.background,
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
        background: proj?.background,
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
    `이 슬라이드는 프로젝트 소개 — 합격자 서사의 시작(왜 이 프로젝트가 필요했는가). 박스 의도에 맞춰 분배:\n` +
    `  · 큰 제목 박스 → title\n` +
    `  · 본문/요약 박스 → background(문제 정의·배경 1~2문장) 우선, 없으면 intro\n` +
    `  · 부제 박스 → intro (서비스/특징 한 줄)\n` +
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
    `이 슬라이드는 프로젝트 전체를 한 장에 담는 통합 카드 — "문제 정의 → 해결 아이디어 → 성과" 순서로 읽히게 배치:\n` +
    `  · 가장 큰/상단 박스 → title (프로젝트명)\n` +
    `  · 메타 박스 → "period · role" 한 줄\n` +
    `  · 기술 박스 → techStack 3~6개\n` +
    `  · 첫 본문 박스 → "문제 정의": background 우선(없으면 problem/intro) 1~2문장\n` +
    `  · 다음 본문 박스 → "해결 아이디어·실행": action 또는 task (1~2문장 압축)\n` +
    `  · 마지막 본문 박스 → "성과": output 또는 growth (수치 포함 1~2문장)\n` +
    `  · hint=metric 박스 → keyExperiences[0].metric (없으면 "")\n` +
    `박스가 남으면 growth / competency 내용도 채워 넣어. 빈 박스로 남기지 말 것.`,
  project_par:
    `이 슬라이드는 "문제 정의 → 해결 아이디어 → 성과" 합격자 서사 카드.\n` +
    `  ⚠ 바로 앞 슬라이드(project_intro)에서 소개·기술스택이 이미 표시됐으므로 intro/overview/techStack 절대 반복 금지.\n` +
    `  · 첫 번째 본문/카드 박스 → "문제 정의": background 우선(없으면 problem) 1~2문장\n` +
    `  · 두 번째 본문/카드 박스 → "해결 아이디어·실행": action 또는 process (동사 bullet)\n` +
    `  · 세 번째 본문/카드 박스 → "성과": output + growth 압축 (수치 포함, 1~2문장)\n` +
    `  · 카드에 제목 라벨 박스가 따로 있으면 "문제 정의"/"해결 아이디어"/"성과" 라벨을 써라\n` +
    `  · hint=metric 박스 → keyExperiences[0].metric (강조, emphasis="metric")\n` +
    `  · 나머지 박스 → competency 배분 (techStack/role 반복 금지)\n` +
    `서사 순서(문제→아이디어→성과)가 읽히는 것이 이 슬라이드의 목적. 단정형, 동사 시작 bullet.`,
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
        { heading: '문제 정의', body: cleanFill(ctx.background || ctx.problem || ctx.task || '') },
        { heading: '해결 아이디어', body: cleanFill(ctx.action || ctx.process || '') },
        { heading: '성과', body: cleanFill(ctx.output || ctx.growth || '') },
      ].filter(i => i.body);
      return items.length >= 2 ? items.slice(0, groupCount) : null;
    }

    case 'project_problem': {
      const items = [
        { heading: '문제 정의', body: cleanFill(ctx.background || ctx.problem || ctx.task || '') },
        { heading: '해결 아이디어', body: cleanFill(ctx.action || ctx.process || '') },
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

// ── 8) 결정적 채움 (유닛 기반 — 카드 단위 의미 보존) ─────────────────────────
function deterministicFallback(step, ctx, slots, groupMeta = {}) {
  const { groupCount = 1, groupAxis = 'none', slideW = 720, slideH = 540 } = groupMeta;

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

  // 유닛 경로(기본): 카드 단위 클러스터에 구조화 아이템을 1:1 배정.
  // 라벨↔값↔본문이 같은 카드에 묶여 나가므로 (9)/(10)의 뒤섞임이 구조적으로 불가능.
  const sectionItems = buildSectionItems(step, ctx);
  if (sectionItems.length) {
    const units = buildUnits(slots, slideW, slideH);
    if (units.length) {
      const filled = fillByUnits(step, ctx, slots, units, sectionItems);
      return {
        slots: slots.map(s => {
          const f = filled.get(s.shapeId);
          return { shapeId: s.shapeId, text: f?.text || '', emphasis: f?.emphasis || 'none' };
        }),
      };
    }
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
      push(ctx.title, ctx.background || ctx.intro, ctx.intro, [ctx.period, ctx.role].filter(Boolean).join(' · '),
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
      push(ctx.title, ctx.background || ctx.problem, ctx.action, ctx.process);
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
  // 서사 순서: 문제 정의/배경 → 해결 아이디어(개요) → 실행/성과
  const bodyContent  = isDivider ? '' : cleanFill(ctx.background || ctx.intro || ctx.overview || ctx.task || ctx.problem || '');
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
    const cap = slot.maxChars || 120;
    if (role === 'title')  return clipShort(ctx.title || ctx.userName || ctx.sectionLabel || merged[index] || '', cap);
    if (role === 'metric') return cleanFill(firstMetric?.metric || firstMetric?.afterMetric || '');
    if (role === 'meta')   return clipShort(projectMeta || '', cap);
    // tag: 기술 키워드 전용 — merged 폴백을 주면 내비 라벨 자리에 무관한 짧은 텍스트가 박힌다
    if (role === 'tech' || role === 'tag') return clipShort(techLine || '', cap);
    if (role === 'link')   return cleanFill(ctx.link || ctx.contact?.github || ctx.contact?.website || '');
    if (role === 'index')  return cleanFill(slot.originalText || '');
    // 구분 카드: 라벨(heading)/제목/메타만 채우고 본문은 비운다(중복 슬라이드 방지).
    if (isDivider && role === 'heading') return cleanFill(ctx.sectionLabel || `Project ${ctx.projectIndex || 1}`);
    if (isDivider && role === 'body')    return '';
    if (role === 'heading') return clipShort(bodyContent || merged[index] || ctx.title || '', cap);
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

// ── 8-b) AI 카피 리파인 (합격자 문체 변환) ───────────────────────────────────
// 결정론 매핑은 노션 원문을 거의 그대로 싣는다 — 정확하지만 "합격자 포트폴리오" 의
// 문체(수치 선행, 동사 시작 불렛, 군더더기 제거)가 아니다. 덱 전체 본문 박스를
// 1회 배치 호출로 재작성하고, 숫자 창작·길이 초과·placeholder 가드를 통과한
// 결과만 적용한다. 실패 시 결정론 원문 유지 — 디자인·안정성 무손상.
const REFINE_MIN_LEN = 40;
// 본문 성격 역할만 재작성. 단, metric 슬롯이라도 40자 이상이면 사실상 본문이
// 잘못 배정된 것이므로 포함 (진짜 KPI 값 "85%" 류는 길이 가드에 걸리지 않음).
const REFINE_ROLES = new Set(['body', 'result', 'heading', 'metric']);

// 템플릿 디자인 DNA → 문체 지시. 어두운 배경/고채도 강조색 = 임팩트 톤,
// 밝은 배경 = 신뢰감 있는 차분한 톤 (블루프린트의 "톤앤매너 동기화").
function toneGuideFromDna(designDna) {
  const lum = (hex) => {
    const c = String(hex || '').replace('#', '');
    if (c.length !== 6) return 1;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
      .map(n => (n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  if (designDna && lum(designDna.bg) < 0.35) {
    return '강렬하고 도전적인 톤 — 임팩트 있는 단문, 성과·수치를 문장 맨 앞에 배치';
  }
  return '신뢰감 있는 차분한 전문가 톤 — 정제된 단문, 근거와 과정이 읽히게';
}

function buildRefinePrompt(jobs, toneGuide) {
  const list = jobs.map(j => ({ key: j.key, section: j.section, max_chars: j.target, text: j.text }));
  return `당신은 IT 기업 서류전형을 통과시키는 합격자 포트폴리오 카피라이터입니다.
아래 각 텍스트를 채용 담당자가 5초 안에 강점을 파악할 수 있는 문장으로 다듬으십시오.

[톤앤매너] ${toneGuide}

[절대 규칙]
1. 원문에 있는 사실·고유명사·숫자·수치만 사용. 없는 숫자·회사·성과·기술 절대 창작 금지.
2. 원문에 수치(%·배·ms·명·원 등)가 있으면 그 수치가 문장 앞쪽에서 먼저 읽히게 재배치.
3. 반드시 명사형 종결 (예: "8시간 → 10분, 작성 시간 단축" / "한글 전각 폭 모델로 축소 로직 통일" / "36시간 내 구현, 대상 수상").
   "~했습니다", "~합니다", "~였다", "~함" 등 서술형·존댓말 종결 절대 금지. 이모지·미사여구·"저는" 금지.
4. 내용이 2가지 이상이면 줄바꿈(\\n)으로 분리한 불렛. 각 줄 60자 이내. 불렛 기호(·,-)는 붙이지 말 것.
5. max_chars 초과 금지. 이미 간결한 텍스트는 최소 수정만.
6. section 은 이 텍스트가 놓이는 슬라이드 맥락이다. 의미를 벗어난 재해석 금지.

[다듬을 텍스트]
${JSON.stringify(list, null, 2)}

[출력 스키마] JSON 만 반환 (코드펜스 금지):
{ "results": [ { "key": "<입력 key 그대로>", "text": "<max_chars 이내 재작성문>" } ] }`;
}

async function refineDeckCopy(deck, { billingStore = null, designDna = null } = {}) {
  const jobs = [];
  for (let si = 0; si < deck.length; si++) {
    const boxes = deck[si].boxes || [];
    for (let bi = 0; bi < boxes.length; bi++) {
      const box = boxes[bi];
      const text = (box.text || '').trim();
      if (text.length < REFINE_MIN_LEN) continue;
      if (!REFINE_ROLES.has(box.semanticRole)) continue;
      const basePt = Math.max(box.fontPt || 14, 9);
      const budget = estimateMaxChars({ boxWidthPt: box.w, boxHeightPt: box.h, basePt });
      jobs.push({
        key: `${si}_${bi}`,
        section: deck[si].sectionType,
        target: Math.max(60, Math.min(Math.round(budget), Math.round(text.length * 1.1))),
        text,
      });
    }
  }
  if (!jobs.length) return;

  console.log(`[PPT-Mapper] 카피 리파인: ${jobs.length}개 본문 박스 합격자 문체 변환 요청`);
  let parsed = null;
  try {
    const raw = await generateWithRetry(buildRefinePrompt(jobs, toneGuideFromDna(designDna)), {
      models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      retries: 1,
      callTimeoutMs: 90000,
      config: { temperature: 0.3, responseMimeType: 'application/json' },
      billingStore,
    });
    parsed = parseJSON(raw);
  } catch (e) {
    console.warn(`[PPT-Mapper] 카피 리파인 실패 → 결정론 원문 유지: ${e?.message || e}`);
    return;
  }

  const results = Array.isArray(parsed?.results) ? parsed.results : [];
  const byKey = new Map(results.filter(r => r && r.key != null).map(r => [String(r.key), String(r.text || '').trim()]));
  let applied = 0;
  // cleanFill 은 \s+ 를 공백으로 접어 불렛 줄바꿈이 사라진다 — 줄바꿈 보존 정리.
  const sanitizeRefined = (v) => {
    const s = String(v || '')
      .replace(/<[^>]*>/g, ' ')
      .split('\n')
      .map(line => line.replace(/^\s*[·•\-]\s*/, '').replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
      .trim();
    return PLACEHOLDER_RE.test(s) ? '' : s;
  };
  for (const job of jobs) {
    const refined = sanitizeRefined(byKey.get(job.key));
    if (!refined) continue;
    // 가드: 숫자 창작 금지 + 길이 상한 — 하나라도 어기면 결정론 원문 유지
    if (!numbersSubsetOf(refined, job.text)) continue;
    if (refined.length > job.target * 1.25) continue;
    const [si, bi] = job.key.split('_').map(Number);
    const box = deck[si]?.boxes?.[bi];
    if (!box) continue;
    box.text = refined;
    applied++;
  }
  if (applied) console.log(`[PPT-Mapper] 카피 리파인 적용: ${applied}/${jobs.length}개 박스`);
}

// ── 8-c) 스마트 콘텐츠 피팅 ──────────────────────────────────────────────────
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

async function summarizeOverflow(deck, billingStore = null) {
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
      billingStore,
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

// 내부 점검용 (테스트 스크립트 전용 — 런타임 미사용)
export const __mapperInternals = { buildSlots, buildUnits, buildSectionItems, fillByUnits, buildContext, normalizePortfolio };

// ── 9) 메인: 결정론(유닛) 채움 + 카피 리파인 + 스마트 콘텐츠 피팅 ─────────────
export async function mapDeck({ portfolio, layout, billingStore = null, designDna = null }) {
  const { norm, plan } = planDeck(layout, portfolio);

  const normStr = (s) => s.toLowerCase().replace(/\s+/g, '').trim();

  // 1) 각 슬라이드의 컨텍스트/슬롯/결정론 baseline 준비
  const prepared = plan.map((step, si) => {
    const ctx = buildContext(norm, step);
    const { slots, groupCount, groupAxis, slideW, slideH } = buildSlots(layout, step);
    const det = deterministicFallback(step, ctx, slots, { groupCount, groupAxis, slideW, slideH });
    return { si, step, ctx, slots, det };
  });

  // 2) deck 빌드 — 결정론(유닛) 채움이 단일 소스.
  // 이전의 "전 슬라이드 1회 LLM 박스 배정 + 가드 검증" 오버레이는 제거:
  // 가드를 통과한 재작성조차 라벨 자리에 날짜를 쓰거나 기술 목록을 한 단어로
  // 줄이는 등 슬롯 의미를 깨는 사례가 실파일 (9)/(10)에서 반복 확인됨.
  // LLM 은 summarizeOverflow(초과 본문의 제자리 압축, 숫자·길이 검증)에만 사용한다.
  const deck = prepared.map(({ step, slots, det }) => {
    const detMap = new Map((det.slots || []).map(s => [s.shapeId, s]));
    const roleMap = new Map(slots.map(s => [s.shapeId, s.semanticRole]));

    // shapeId → 최종 {text, emphasis}
    const finalByShape = new Map();
    slots.forEach((slot) => {
      const base = detMap.get(slot.shapeId) || { text: '', emphasis: 'none' };
      let text = (base.text || '').trim();
      if (step.sectionType === 'toc' && slot.semanticRole === 'title') text = '목차';
      finalByShape.set(slot.shapeId, { text, emphasis: base.emphasis || 'none' });
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

  // 카피 리파인(합격자 문체) → 콘텐츠 피팅(초과분 압축) 순서.
  // 리파인 결과가 박스를 넘치면 summarizeOverflow 가 제자리 압축으로 받아낸다.
  await refineDeckCopy(deck, { billingStore, designDna });
  await summarizeOverflow(deck, billingStore);

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
