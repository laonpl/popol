/**
 * PM·마케터 '핵심 경험 한 장' 데이터 — 개발자 화면(githubStats·gitAnalysis)에 대응한다.
 * 저장된 전용 분석(sr.pmOnePage / sr.campaignOnePage, POST /experience/analyze-role)을 우선 쓰고,
 * 빈 칸은 이 경험의 정리 내용(핵심 경험·jobData·product·portfolioVisuals·marketerKit)에서 채운다.
 * ⚠ 수치 패턴(리서치 규모·산출물 분량·캠페인 규모)은 원문 전체가 아니라 정리된 경험 문장에서만 찾는다 —
 *   원문에는 서비스 소개 자료 속 예시 화면 같은 남의 숫자가 섞여 있다(2026-10-19 '모닝빈 4,860만원' 오인).
 */

const text = (v) => String(v ?? '').replace(/\*\*/g, '').trim();
const list = (v) => (Array.isArray(v) ? v : []);
const firstText = (...values) => values.map(text).find(Boolean) || '';
const splitItems = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/\n|;|·|\s\/\s/)).map(text).filter(Boolean);
// 채널처럼 짧은 이름 목록은 쉼표로도 나눈다 (문장인 대안 목록에는 쓰지 않는다)
const splitNames = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/\n|;|·|,|\s\/\s/)).map(text).filter(Boolean);

const filled = (v) => {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.values(v).some(filled);
  return text(v) !== '';
};

// "핵심 경험 1", "경험 2", "프로젝트 3" 같은 자리표시 제목
const isPlaceholderTitle = (v) => /^(?:핵심\s*)?(?:경험|프로젝트|사례|항목)\s*\d+$/.test(text(v));

/**
 * 저장된 칸을 우선하고 빈 칸만 파생 값으로 채운다. 사용자가 한 번 편집한 한 장(edited)은 그대로 존중한다
 * — 지운 행이 기존 데이터로 다시 채워지지 않게. source: 'analysis'(전용 분석) | 'derived'(기존 정리에서 채움)
 */
function resolve(saved, derived) {
  const ok = saved && typeof saved === 'object';
  const base = Object.fromEntries(Object.keys(derived).map(key => [key,
    ok && (saved.edited ? saved[key] !== undefined : filled(saved[key])) ? saved[key] : derived[key]]));
  return { ...base, source: (ok && saved.source) || 'derived', edited: !!(ok && saved.edited), analyzed: ok && saved.source === 'analysis' };
}

/** "120만" "3.4만" "1,200만원" "1.1천" "405%" → 숫자 (막대 길이용) */
export function parseAmount(value) {
  const s = String(value ?? '').replace(/,/g, '');
  const m = s.match(/(\d+(?:\.\d+)?)\s*(억|만|천)?/);
  if (!m) return null;
  const unit = { 억: 1e8, 만: 1e4, 천: 1e3 }[m[2]] || 1;
  return Number(m[1]) * unit;
}

/** 이 경험으로 정리된 문장만 — 원문(rawInput)은 넣지 않는다 */
function corpusOf({ sr = {}, cs = {} }) {
  const ov = sr.projectOverview || {};
  return [
    sr.product?.problem, sr.product?.solution, ov.background, ov.goal, ov.summary, cs.summary,
    ...list(sr.keyExperiences).flatMap(k => [k?.context, k?.situation, k?.action, k?.result, k?.learning]),
    ...list(cs.keyExps).flatMap(k => [k?.problem, k?.action, k?.result]),
  ].map(text).filter(Boolean).join('\n');
}

const RESEARCH_LABEL = [
  [/심층\s*인터뷰|사용자\s*인터뷰|인터뷰/, '사용자 인터뷰'],
  [/설문/, '설문'],
  [/VOC|고객\s*문의|문의/, 'VOC·문의'],
  [/리뷰/, '리뷰 분석'],
  [/사용성\s*테스트|테스트\s*사용자/, '사용성 테스트'],
  [/현장\s*관찰/, '현장 관찰'],
  [/로그/, '로그 분석'],
];
const RESEARCH_TERM = '심층\\s*인터뷰|사용자\\s*인터뷰|인터뷰|설문|VOC|고객\\s*문의|문의|리뷰|사용성\\s*테스트|테스트\\s*사용자|현장\\s*관찰|로그';

/** "인터뷰 15명", "설문 126명", "VOC 312건", "15명 인터뷰" 처럼 숫자와 붙은 조사 규모만 */
export function findResearchScale(corpus) {
  const found = new Map();
  const add = (term, num, unit) => {
    const label = RESEARCH_LABEL.find(([re]) => re.test(term))?.[1];
    if (label && !found.has(label)) found.set(label, `${num}${unit}`);
  };
  // "15명 인터뷰"를 먼저 읽고, 용어 뒤 숫자는 공백·기호로만 붙은 것 — "인터뷰에서 11명이" 같은 문장 속 다른 숫자를 규모로 읽지 않게
  for (const m of corpus.matchAll(new RegExp(`(\\d[\\d,]*)\\s*(명|건|회)\\s*(?:대상\\s*)?(?:을|를|의)?\\s*(${RESEARCH_TERM})`, 'g'))) add(m[3], m[1], m[2]);
  for (const m of corpus.matchAll(new RegExp(`(${RESEARCH_TERM})[\\s:：·(]{0,3}(\\d[\\d,]*)\\s*(명|건|회)`, 'g'))) add(m[1], m[2], m[3]);
  return [...found].slice(0, 4).map(([label, value]) => ({ label, value }));
}

const DELIVERABLE_TERM = 'PRD|기획서|요구사항\\s*정의서|와이어프레임|프로토타입|화면\\s*설계서|정책서|정책표|테스트\\s*케이스|테스트케이스|QA\\s*체크리스트|이벤트\\s*명세|유저\\s*플로우|사용자\\s*흐름도|리서치\\s*리포트|제안서|대시보드|문제\\s*정의서|운영자\\s*화면\\s*명세|도움말\\s*문서';

/** "PRD 24쪽", "와이어프레임 32화면", "QA 테스트케이스 86개", "15장 제안서" */
export function findDeliverables(corpus) {
  const found = new Map();
  const add = (name, value) => {
    const key = name.replace(/\s+/g, ' ').trim();
    if (!found.has(key) || (!found.get(key) && value)) found.set(key, value);
  };
  for (const m of corpus.matchAll(new RegExp(`(${DELIVERABLE_TERM})[^\\d\\n,.]{0,4}?(\\d[\\d,]*)\\s*(쪽|페이지|화면|개|건|장|종|편)`, 'g'))) add(m[1], `${m[2]}${m[3]}`);
  for (const m of corpus.matchAll(new RegExp(`(\\d[\\d,]*)\\s*(쪽|장|개|편)\\s*(?:분량의\\s*)?(${DELIVERABLE_TERM})`, 'g'))) add(m[3], `${m[1]}${m[2]}`);
  if (found.size < 3) for (const m of corpus.matchAll(new RegExp(`(${DELIVERABLE_TERM})`, 'g'))) if (found.size < 5) add(m[1], '');
  return [...found].slice(0, 5).map(([name, value]) => ({ name, value }));
}

/** "평균 40시간 이상 → 12분" 처럼 한 칸에 전후가 같이 적힌 값은 이전/이후로 나눈다 */
export function splitChange(metric = {}) {
  const value = text(metric.value);
  const m = value.match(/^(.+?)\s*(?:→|->|⇒)\s*(.+)$/);
  if (!m || text(metric.before)) return { label: text(metric.label), value, before: text(metric.before), target: text(metric.target) };
  return { label: text(metric.label), value: m[2].trim(), before: m[1].trim(), target: text(metric.target) };
}

const keMetric = (k) => ({
  label: firstText(k?.metricLabel, isPlaceholderTitle(k?.title) ? '' : k?.title),
  value: firstText(k?.afterMetric, k?.metric),
  before: text(k?.beforeMetric),
  target: '',
});

const numTokens = (v) => (String(v ?? '').match(/\d[\d,.]*/g) || []).map(n => n.replace(/,/g, '').replace(/\.$/, ''));
const keResults = (sr) => list(sr.keyExperiences).map(keMetric).filter(m => m.value);

/**
 * 서비스 소개(product.outcomes)에는 자료 속 수치가 전부 들어온다 — 문제 정의의 현황 통계('취준생 평균 40시간 이상')도 섞인다.
 * 결과값의 숫자가 문제·배경 문장에 그대로 나오면 문제 통계로 보고 성과에서 뺀다 (2026-10-20 'DD' 화면 회귀).
 */
function productResults(sr) {
  const problemNums = new Set(numTokens([sr.product?.problem, sr.projectOverview?.background].map(text).join(' ')));
  return list(sr.product?.outcomes).filter(o => text(o?.label) && text(o?.value))
    .map(o => splitChange({ label: text(o.label), value: text(o.value) }))
    .filter(m => { const nums = numTokens(m.value); return !nums.length || !nums.every(n => problemNums.has(n)); });
}

// 핵심 경험의 결과를 먼저 — 서비스 소개 수치는 그다음. useProduct=false: 마케터 — 서비스 소개(product)의 성과는 캠페인 성과가 아니다
function headlineFrom(sr, extraKpis = [], useProduct = true) {
  const kes = keResults(sr);
  const product = useProduct ? productResults(sr) : [];
  const kpis = [...extraKpis, ...list(sr.portfolioVisuals?.kpis)].filter(k => text(k?.value))
    .map(k => splitChange({ label: firstText(k.label, k.name), value: text(k.value), target: text(k.target) }));
  return [...kes, ...product, ...kpis].find(m => m.before) || kes[0] || product[0] || kpis[0] || { label: '', value: '', before: '', target: '' };
}

function outcomesFrom(sr, extra = [], useProduct = true) {
  const seen = new Set();
  return [
    ...keResults(sr).filter(m => m.label),
    ...(useProduct ? productResults(sr) : []),
    ...extra.filter(o => o.label && o.value).map(splitChange),
  ].filter(m => !seen.has(m.value) && seen.add(m.value))
    .map(m => ({ label: m.label, value: m.before ? `${m.before} → ${m.value}` : m.value })).slice(0, 5);
}

/* 기술 스택 칸에는 도구·채널·일반 단어가 섞여 들어온다 — 이름으로 알아볼 수 있는 것만 나눠 쓴다 */
const CHANNEL_WORD = /인스타|instagram|블로그|blog|유튜브|youtube|틱톡|tiktok|페이스북|facebook|메타|meta(?!\s*ads)|네이버|카카오|kakao|스레드|threads|링크드인|linkedin|트위터|twitter|당근|이메일|email|뉴스레터|문자|sms|앱\s*푸시|커뮤니티|오프라인/i;
const TOOL_WORD = /ga4|google\s*analytics|구글\s*애널리틱스|meta\s*ads|광고\s*관리자|google\s*ads|구글\s*애즈|네이버\s*광고|카카오\s*모먼트|canva|캔바|figma|피그마|notion|노션|jira|지라|confluence|컨플루언스|amplitude|앰플리튜드|mixpanel|믹스패널|miro|미로|maze|slack|슬랙|excel|엑셀|sheets|스프레드시트|sql|python|looker|tableau|hubspot|mailchimp|braze|airbridge|appsflyer|capcut|캡컷|premiere|프리미어|photoshop|포토샵|illustrator|일러스트|chatgpt|search\s*console|hotjar|zeplin|제플린|protopie|프로토파이/i;
const stackOf = (sr, cs) => [...new Set([
  ...list(cs?.tech), ...list(sr.projectOverview?.techStack).map(t => (typeof t === 'string' ? t : t?.name)),
].map(text).filter(Boolean))];
const toolsFrom = (sr, cs) => stackOf(sr, cs).filter(w => TOOL_WORD.test(w)).slice(0, 8);

/* 사례 공통 칸 — 요약 한 줄 · 목표 · 내 역할 · 회고 */
function caseFieldsFrom(sr, cs, goalFallback = '') {
  const kes = list(sr.keyExperiences);
  const summaries = kes.map(k => k?.roleSummary || {});
  const ov = sr.projectOverview || {};
  const myRole = summaries.flatMap(r => splitItems(r.myRole));
  return {
    summary: firstText(...summaries.map(r => r.headline), ov.summary, cs.summary),
    goal: firstText(ov.goal, goalFallback, ...kes.map(k => k?.jobData?.successCriteria)),
    // 실행 문장은 첫 문장을 통째로 — 글자 수로 자르지 않는다
    contribution: (myRole.length ? myRole : kes.map(k => brief(k?.action, Infinity))).filter(Boolean).slice(0, 5),
    retrospective: firstText(...summaries.map(r => r.learning), ...kes.map(k => k?.learning)),
  };
}

/* ════════ 기획/PM ════════ */

function flowFrom(sr) {
  const nodes = list(sr.flowDiagram?.nodes);
  if (!nodes.length) return [];
  return [...nodes].sort((a, b) => (Number(a?.tier) || 0) - (Number(b?.tier) || 0))
    .map(n => ({ label: text(n?.label), desc: text(n?.tech) })).filter(s => s.label).slice(0, 6);
}

function pmDecisionFrom(k = {}) {
  const jd = k.jobData || {};
  const summary = k.roleSummary || {};
  const chosen = text(jd.decision);
  const rejected = splitItems(jd.alternatives).filter(a => a !== chosen);
  const evidence = list(jd.pmEvidence).find(e => e?.dimension === 'discovery' && text(e?.claim));
  return {
    title: isPlaceholderTitle(k.title) ? '' : text(k.title),
    step: '', // 화면이 결정 글에 나온 플로우 단계명으로 읽는다
    tags: list(k.keywords).map(text).filter(Boolean).slice(0, 3),
    problem: firstText(summary.problem, k.context, k.situation, jd.problemSignal),
    evidence: firstText(evidence?.quote, evidence?.claim, jd.problemSignal !== firstText(k.context, k.situation) ? jd.problemSignal : ''),
    options: [
      ...(chosen ? [{ label: chosen, chosen: true, reason: text(jd.hypothesis) }] : []),
      ...rejected.slice(0, 2).map(label => ({ label, chosen: false, reason: '' })),
    ],
    result: { label: firstText(k.metricLabel), before: text(k.beforeMetric), after: firstText(k.afterMetric, k.metric) },
    spec: { story: '', criteria: splitItems(jd.successCriteria).slice(0, 4), policies: [] },
    issue: { signal: text(jd.obstacle), cause: '', fix: text(jd.resolution) },
    learning: firstText(summary.learning, k.learning),
    action: firstText(summary.action, k.action),
    validation: firstText(summary.validation, jd.validation),
    outcome: firstText(summary.result, k.result),
  };
}

const sameTitle = (a, b) => {
  const x = text(a).replace(/\s+/g, '');
  const y = text(b).replace(/\s+/g, '');
  return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))));
};

/** 저장된 의사결정의 판단과 실행·검증 칸을 제목이 같은 핵심 경험에서 채운다 — 순서로 짝짓지 않는다(엉뚱한 경험 내용이 붙지 않게).
 *  사용자가 편집한 한 장은 지운 칸을 되살리지 않도록 원래 없던 칸(undefined)만 채운다 */
function withExperienceFields(decisions, fromExperiences, edited) {
  return list(decisions).map(d => {
    const match = fromExperiences.find(e => sameTitle(e.title, d?.title));
    if (!match) return d;
    return { ...d, ...Object.fromEntries(['action', 'validation', 'outcome'].map(k => [k, (edited ? d?.[k] !== undefined : text(d?.[k])) ? d[k] : match[k]])) };
  });
}

export function buildPmOnePage({ sr = {}, cs = {} } = {}) {
  const corpus = corpusOf({ sr, cs });
  const derived = {
    ...caseFieldsFrom(sr, cs),
    headline: headlineFrom(sr),
    research: findResearchScale(corpus),
    deliverables: findDeliverables(corpus),
    role: firstText(cs.meta?.role, sr.projectOverview?.role),
    team: firstText(cs.meta?.team, sr.projectOverview?.team),
    tools: toolsFrom(sr, cs),
    problem: firstText(sr.product?.problem, sr.projectOverview?.background, cs.keyExps?.[0]?.problem),
    solution: firstText(sr.product?.solution, sr.projectOverview?.goal, cs.keyExps?.[0]?.action),
    outcomes: outcomesFrom(sr),
    flow: flowFrom(sr),
    exceptions: [],
    decisions: list(sr.keyExperiences).map(pmDecisionFrom).filter(d => d.title || d.problem).slice(0, 4),
  };
  const page = resolve(sr.pmOnePage, derived);
  return { ...page, decisions: withExperienceFields(page.decisions, list(sr.keyExperiences).map(pmDecisionFrom), page.edited) };
}

/* ════════ 마케터 ════════ */

const STAT_TERM = '예산|광고비|집행비|매출|도달|노출|팔로워|조회수|구매|신규\\s*고객';
function findCampaignStats(corpus) {
  const found = new Map();
  for (const m of corpus.matchAll(new RegExp(`(${STAT_TERM})[\\s:：·은는이가]{0,3}(\\d[\\d,.]*\\s*(?:억|만|천)?\\s*(?:원|명|회|건|개|%)?)`, 'g'))) {
    const label = m[1].replace(/\s+/g, ' ');
    if (!found.has(label) && /[1-9]/.test(m[2])) found.set(label, m[2].trim());
  }
  return [...found].slice(0, 4).map(([label, value]) => ({ label, value }));
}

function marketerExecutionFrom(k = {}) {
  const jd = k.jobData || {};
  const summary = k.roleSummary || {};
  return {
    title: isPlaceholderTitle(k.title) ? '' : text(k.title),
    stage: '', // 화면이 결과 지표 이름으로 퍼널 단계를 읽는다
    tags: list(k.keywords).map(text).filter(Boolean).slice(0, 3),
    insight: firstText(jd.audienceInsight, k.context, k.situation),
    action: firstText(summary.action, k.action, jd.creative),
    result: { label: firstText(k.metricLabel), before: text(k.beforeMetric), after: firstText(k.afterMetric, k.metric) },
    creatives: [],
    issue: { signal: '', diagnosis: '', fix: '' },
    learning: firstText(summary.learning, k.learning, jd.nextExperiment),
  };
}

export function buildCampaignOnePage({ sr = {}, cs = {} } = {}) {
  const corpus = corpusOf({ sr, cs });
  const kit = sr.marketerKit || {};
  const funnelKit = kit.funnel || {};
  const jd = list(sr.keyExperiences).map(k => k?.jobData || {});
  const summaries = list(sr.keyExperiences).map(k => k?.roleSummary || {});
  const kitKpis = list(kit.kpis).map(k => ({ label: text(k?.name), value: text(k?.value) }));
  const mix = list(sr.portfolioVisuals?.mix);
  const mixTotal = mix.reduce((sum, m) => sum + (parseAmount(m?.value) || 0), 0);
  const stackChannels = stackOf(sr, cs).filter(w => CHANNEL_WORD.test(w));
  const channelNames = [...new Set([...jd.flatMap(d => splitNames(d.channels)), ...stackChannels])];
  const duration = firstText(cs.meta?.duration, sr.projectOverview?.duration);
  const derived = {
    ...caseFieldsFrom(sr, cs, funnelKit.goal),
    headline: headlineFrom(sr, kitKpis, false),
    stats: [...findCampaignStats(corpus), ...(duration ? [{ label: '기간', value: duration }] : [])].slice(0, 4),
    channels: mix.length
      ? mix.map(m => ({ name: firstText(m?.label, m?.name), share: mixTotal ? Math.round(((parseAmount(m?.value) || 0) / mixTotal) * 100) : 0 })).filter(c => c.name).slice(0, 6)
      : channelNames.map(name => ({ name, share: 0 })).slice(0, 6),
    funnel: list(sr.portfolioVisuals?.funnel).map(f => ({ label: text(f?.label), value: `${/^\d+$/.test(text(f?.value)) ? Number(f.value).toLocaleString('ko-KR') : text(f?.value)}${text(f?.unit)}` })).filter(f => f.label && f.value).slice(0, 4),
    role: firstText(cs.meta?.role, sr.projectOverview?.role),
    tools: toolsFrom(sr, cs),
    // 마케터 과제·성과는 캠페인 기준 — 서비스 소개(product)의 문제·성과는 캠페인 것이 아니라 쓰지 않는다
    problem: firstText(...summaries.map(s => s.problem), funnelKit.problem, jd.map(d => d.businessProblem).find(text), cs.keyExps?.[0]?.problem),
    strategy: firstText(...summaries.map(s => s.channel), funnelKit.strategy, kit.positioning),
    outcomes: outcomesFrom(sr, kitKpis, false),
    structure: {
      target: firstText(...summaries.map(s => s.audience), funnelKit.target, jd.map(d => d.target).find(text)),
      insight: firstText(jd.map(d => d.audienceInsight).find(text), funnelKit.insight),
      message: firstText(...summaries.map(s => s.message), jd.map(d => d.creative).find(text)),
      channels: channelNames.length ? channelNames.slice(0, 5) : mix.map(m => firstText(m?.label, m?.name)).filter(Boolean).slice(0, 5),
      conversion: firstText(funnelKit.goal),
    },
    executions: list(sr.keyExperiences).map(marketerExecutionFrom).filter(x => x.title || x.action).slice(0, 4),
  };
  return resolve(sr.campaignOnePage, derived);
}

/** 화면 편집 결과를 저장 형태로 — 파생 표시 값도 첫 편집 때 함께 고정한다 */
export function toSavedPage(page) {
  const { analyzed, ...rest } = page; // eslint-disable-line no-unused-vars
  return { ...rest, edited: true };
}

/* ════════ 표시 도우미 ════════ */

/** 첫 문장만, 길면 자른다 (구형 Safari 호환을 위해 lookbehind 없이) */
export function brief(value, max = 48) {
  let s = text(value).split('\n')[0];
  const end = s.search(/[.!?。](\s|$)/);
  if (end > 0) s = s.slice(0, end + 1);
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
}

/** "2026-02 ~ 2026-06", "2025.09 — 2025.12 · 4개월" → "5개월" / "4개월" (못 읽으면 원문) */
export function periodLength(value) {
  const s = text(value);
  const stated = s.match(/(\d+)\s*개월/);
  if (stated) return `${stated[1]}개월`;
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[^\d]+(\d{4})[.\-/](\d{1,2})/);
  if (!m) return s;
  const months = (Number(m[3]) - Number(m[1])) * 12 + (Number(m[4]) - Number(m[2])) + 1;
  return months > 0 && months < 120 ? `${months}개월` : s;
}
