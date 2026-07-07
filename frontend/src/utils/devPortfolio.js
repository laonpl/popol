// 개발자 포트폴리오 공용 로직 — 완성도 진단 + 데이터 파생.
// StructuredResult(편집 화면)와 DeveloperPortfolio(직군 인식형 포트폴리오 뷰)가 공유한다.

export const DEV_BASE_SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];

// ── 직군별 포트폴리오 개성 메타 ──
// accent: 강조색 — 전 직군 케이스 스터디와 동일한 브랜드 네이비(#002F6C)로 통일. 직무 개성은 색이 아니라 레이아웃·모듈로 낸다.
// kicker: 히어로 라벨 / diagramKey·Title: 다이어그램 섹션 / visuals: 직무 전용 시각화 구성(종류·순서·제목이 직무마다 다름)
const BRAND_ACCENT = '#002F6C';
export const JOB_PORTFOLIO_META = {
  dev: {
    accent: BRAND_ACCENT, kicker: 'DEV PORTFOLIO', diagramKey: 'architecture', diagramTitle: '시스템 아키텍처',
    visuals: [], // 개발자는 GitHub 기여도·코드·아키텍처가 개성
  },
  aiml: {
    accent: BRAND_ACCENT, kicker: 'AI/ML PORTFOLIO', diagramKey: 'datasetArch', diagramTitle: '모델 · 데이터 아키텍처',
    visuals: [
      { type: 'kpis',    title: '모델 평가 지표' },
      { type: 'compare', title: '최적화 성과 (Before → After)' },
      { type: 'process', title: 'ML 파이프라인' },
    ],
  },
  da: {
    accent: BRAND_ACCENT, kicker: 'DATA PORTFOLIO', diagramKey: null, diagramTitle: null,
    visuals: [
      { type: 'compare', title: '실험 결과 (Before → After)' },
      { type: 'kpis',    title: '핵심 분석 지표' },
      { type: 'funnel',  title: '전환 퍼널 분석' },
    ],
  },
  devops: {
    accent: BRAND_ACCENT, kicker: 'DEVOPS PORTFOLIO', diagramKey: 'infraArch', diagramTitle: '인프라 아키텍처',
    visuals: [
      { type: 'process', title: 'CI/CD 파이프라인' },
      { type: 'compare', title: '비용 · 리드타임 개선' },
      { type: 'kpis',    title: '운영 지표' },
    ],
  },
  pm: {
    accent: BRAND_ACCENT, kicker: 'PM PORTFOLIO', diagramKey: null, diagramTitle: null,
    visuals: [
      { type: 'goals',   title: 'MSC 달성 현황' },
      { type: 'kpis',    title: '비즈니스 임팩트' },
      { type: 'process', title: '문제 해결 플로우' },
    ],
  },
  designer: {
    accent: BRAND_ACCENT, kicker: 'DESIGN PORTFOLIO', diagramKey: null, diagramTitle: null,
    visuals: [
      { type: 'process', title: '디자인 프로세스' },
      { type: 'compare', title: '사용성 개선 (Before → After)' },
      { type: 'kpis',    title: '디자인 성과 지표' },
    ],
  },
  marketer: {
    accent: BRAND_ACCENT, kicker: 'MARKETING PORTFOLIO', diagramKey: null, diagramTitle: null,
    visuals: [
      { type: 'kpis',    title: '캠페인 KPI' },
      { type: 'funnel',  title: '전환 퍼널' },
      { type: 'mix',     title: '채널 믹스' },
      { type: 'compare', title: '성과 개선 (Before → After)' },
    ],
  },
  hr: {
    accent: BRAND_ACCENT, kicker: 'HR PORTFOLIO', diagramKey: null, diagramTitle: null,
    visuals: [
      { type: 'funnel',  title: '채용 퍼널' },
      { type: 'kpis',    title: '채용 · 리텐션 지표' },
      { type: 'compare', title: '개선 성과 (Before → After)' },
    ],
  },
  sales: {
    accent: BRAND_ACCENT, kicker: 'SALES PORTFOLIO', diagramKey: null, diagramTitle: null,
    visuals: [
      { type: 'funnel',  title: '세일즈 퍼널' },
      { type: 'kpis',    title: '계약 성과 (ARR · MRR)' },
      { type: 'compare', title: '성과 개선 (Before → After)' },
    ],
  },
  common: {
    accent: BRAND_ACCENT, kicker: 'PORTFOLIO', diagramKey: null, diagramTitle: null,
    visuals: [
      { type: 'kpis',    title: '핵심 성과 지표' },
      { type: 'compare', title: '개선 성과 (Before → After)' },
    ],
  },
};
export const getJobPortfolioMeta = (jobCategory) => JOB_PORTFOLIO_META[jobCategory] || JOB_PORTFOLIO_META.common;

/**
 * AI가 생성한 structuredResult.portfolioVisuals를 렌더 가능한 형태로 정규화.
 * 블록이 비어 있으면 텍스트 추출 폴백(kpis←extractMetricTiles, compare←extractBeforeAfter)으로 채운다.
 */
export function normalizePortfolioVisuals(sr, { jobSections = [], keyExperiences = [], texts = [], jobSpecific = null } = {}) {
  const pv = sr?.portfolioVisuals || {};
  const js = jobSpecific || sr?.jobSpecific || {};
  const str = (v) => String(v ?? '').trim();
  const numOk = (v) => Number.isFinite(Number(String(v ?? '').replace(/,/g, '')));

  let kpis = (Array.isArray(pv.kpis) ? pv.kpis : [])
    .filter(k => k && str(k.label || k.name) && str(k.value))
    .map(k => ({ label: str(k.label || k.name).slice(0, 30), value: str(k.value).slice(0, 18), target: str(k.target), note: str(k.note) }));

  const rawStages = Array.isArray(pv.funnel?.stages) ? pv.funnel.stages : (Array.isArray(pv.funnel) ? pv.funnel : []);
  const stages = rawStages
    .filter(s => s && str(s.label || s.stage) && numOk(s.value))
    .map(s => ({ label: str(s.label || s.stage).slice(0, 20), value: Number(String(s.value).replace(/,/g, '')), unit: str(s.unit).slice(0, 6) }));
  const funnel = stages.length >= 2 ? stages : null;

  let compare = (Array.isArray(pv.compare) ? pv.compare : [])
    .filter(c => c && str(c.before) && str(c.after))
    .map(c => ({
      label: str(c.label).slice(0, 22),
      before: str(c.before) + (c.unit && !/[%a-z가-힣]/i.test(str(c.before)) ? str(c.unit) : ''),
      after: str(c.after) + (c.unit && !/[%a-z가-힣]/i.test(str(c.after)) ? str(c.unit) : ''),
    }));

  // 개선 전/후 이중 퍼널 (HR 채용 프로세스 개선 등) — 단계별 before/after 쌍
  const fcRaw = Array.isArray(pv.funnelCompare?.stages) ? pv.funnelCompare.stages : (Array.isArray(pv.funnelCompare) ? pv.funnelCompare : []);
  const fcStages = fcRaw
    .filter(s => s && str(s.label || s.stage) && numOk(s.before) && numOk(s.after))
    .map(s => ({ label: str(s.label || s.stage).slice(0, 20), a: str(s.before).slice(0, 14), b: str(s.after).slice(0, 14) }));
  const funnelCompare = fcStages.length >= 2 ? fcStages : null;

  const mixItems = (Array.isArray(pv.mix?.items) ? pv.mix.items : (Array.isArray(pv.mix) ? pv.mix : []))
    .filter(x => x && str(x.label || x.name) && numOk(x.pct))
    .map(x => ({ label: str(x.label || x.name).slice(0, 16), pct: Number(x.pct) }));
  const mix = mixItems.length >= 2 ? mixItems : null;

  const goals = (Array.isArray(pv.goals) ? pv.goals : [])
    .filter(g => g && str(g.label))
    .map(g => ({ label: str(g.label).slice(0, 60), target: str(g.target).slice(0, 20), actual: str(g.actual).slice(0, 20), achieved: g.achieved === true }));

  // 게이지(가용성·SLA 등) — 데브옵스
  const gauges = (Array.isArray(pv.gauges) ? pv.gauges : [])
    .filter(g => g && str(g.label || g.name) && str(g.value))
    .map(g => ({ label: str(g.label || g.name).slice(0, 20), value: str(g.value).slice(0, 12), unit: str(g.unit).slice(0, 6), target: str(g.target).slice(0, 12) }));

  // 로드맵 타임라인(간트) — PM
  const timeline = (Array.isArray(pv.timeline?.phases) ? pv.timeline.phases : (Array.isArray(pv.timeline) ? pv.timeline : []))
    .filter(p => p && str(p.label || p.phase))
    .map(p => ({ label: str(p.label || p.phase).slice(0, 24), start: p.start, span: p.span, desc: str(p.desc).slice(0, 40) }));

  let steps = (Array.isArray(pv.process?.steps) ? pv.process.steps : (Array.isArray(pv.process) ? pv.process : []))
    .filter(s => s && str(s.label || s.step))
    .map(s => ({ label: str(s.label || s.step).slice(0, 24), desc: str(s.desc).slice(0, 70) }));

  // 폴백: AI 블록이 없으면 기존 저장 텍스트에서 도출 (재분석 없이도 화면이 차게)
  if (!kpis.length) {
    kpis = extractMetricTiles({ keyExperiences, jobSpecific: js, jobSections });
  }
  if (!compare.length) {
    compare = extractBeforeAfter(texts);
  }
  if (steps.length < 2 && jobSections.length >= 2) {
    // 직군 특화 섹션 자체를 수행 단계로 — 라벨=섹션명, 설명=본문 첫 문장
    steps = jobSections
      .map(f => {
        const t = str(js[f.key]);
        if (!t || t.startsWith('[작성 필요]')) return null;
        const first = t.replace(/\*\*/g, '').split(/(?<=[.!?다요음됨함])\s+/)[0] || '';
        return { label: str(f.label).replace(/\s*\(.*\)$/, '').slice(0, 18), desc: first.slice(0, 70) };
      })
      .filter(Boolean);
  }
  const process = steps.length >= 2 ? steps : null;

  return { kpis, funnel, funnelCompare, compare, mix, goals: goals.length ? goals : null, gauges: gauges.length ? gauges : null, timeline: timeline.length >= 2 ? timeline : null, process };
}

// 수치 구절: KPI 약어(ROAS 등) 또는 숫자+단위
const METRIC_PHRASE = /(?:ROAS|CVR|CTR|CPA|CAC|ARR|MRR|DAU|MAU|WAU|NPS)\s*[:\-]?\s*\d[\d,.]*\s*%?|\d[\d,.]*\s*(?:%|배|건|명|억원|억|만원|천만원|원|일|시간|분|초|ms|점|위|개|pt|건|TPS|RPS)/i;

/**
 * 핵심 성과 지표(KPI) 타일 추출 — 마케터·세일즈·PM·데이터 등 수치 중심 직군의 개성.
 * 1) 핵심 경험의 정량 지표(afterMetric/metric)  2) jobSpecific 섹션의 강한 수치 구절.
 */
export function extractMetricTiles({ keyExperiences = [], jobSpecific = {}, jobSections = [] }, max = 4) {
  const tiles = [];
  const seen = new Set();
  const add = (value, label) => {
    const v = String(value || '').trim();
    const l = String(label || '').trim();
    if (!v || !/\d/.test(v) || seen.has(v)) return;
    seen.add(v);
    tiles.push({ value: v.slice(0, 18), label: l.slice(0, 30) });
  };
  for (const k of keyExperiences) {
    // 라벨은 지표 라벨(예: '응답 시간 단축')을 우선 — 문장형 제목이 그대로 라벨로 붙는 것 방지
    add(k.afterMetric || k.metric, k.metricLabel || k.title || '핵심 성과');
  }
  for (const f of jobSections) {
    const m = String(jobSpecific[f.key] || '').match(METRIC_PHRASE);
    if (m) add(m[0], f.label);
  }
  return tiles.slice(0, max);
}

/**
 * Before → After 개선 쌍 추출 — 디자이너(UI 개선)·퍼널 전환율 등 개선 서사의 개성.
 * "A → B", "A에서 B로" 패턴을 잡고, 연도 범위(2024→2025) 같은 오탐은 제외.
 */
export function extractBeforeAfter(texts, max = 4) {
  const out = [];
  const seen = new Set();
  const leadNum = (s) => (String(s).match(/^\d[\d,.]*/) || [''])[0];
  const isYearish = (s) => /^(?:19|20)\d{2}$/.test(leadNum(s)); // 1900~2099 연도 토큰
  const push = (label, before, after) => {
    const b = before.trim(), a = after.trim();
    const key = `${b}|${a}`;
    if (seen.has(key) || b === a) return;
    if (isYearish(b) && isYearish(a)) return; // 연도 범위(2024→2025) 오탐 제외
    seen.add(key);
    out.push({
      label: (label || '').trim().replace(/[:：\-·]+$/, '').trim().slice(0, 22),
      before: b.slice(0, 14),
      after: a.slice(0, 14),
    });
  };
  const arrow = /([가-힣A-Za-z][가-힣A-Za-z0-9 %()/]{0,20}?)?\s*(\d[\d,.]*\s*%?[가-힣A-Za-z]{0,4})\s*(?:→|->|=>|~>)\s*(\d[\d,.]*\s*%?[가-힣A-Za-z]{0,4})/g;
  const eseo = /([가-힣A-Za-z][가-힣A-Za-z0-9 %()/]{0,20}?)?\s*(\d[\d,.]*\s*%?[가-힣A-Za-z]{0,4})\s*에서\s*(\d[\d,.]*\s*%?[가-힣A-Za-z]{0,4})\s*으?로/g;
  for (const t of texts) {
    const s = String(t || '');
    for (const re of [arrow, eseo]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s)) && out.length < max) push(m[1], m[2], m[3]);
    }
  }
  return out.slice(0, max);
}

const DIAG_HAS_NUMBER = /\d+\s*(%|배|건|ms|초|분|시간|만원|억|명|TPS|RPS|KB|MB|GB|회|x)/i;

export function devSectionFilled(v) {
  const t = (v || '').trim();
  return Boolean(t) && !t.startsWith('[작성 필요]');
}

/**
 * 개발자 포트폴리오 완성도 진단 — 채용 담당자 관점 체크리스트.
 * @param jobSections JOB_SPECIFIC_FIELDS[jobCategory] (직군 특화 섹션 정의 배열)
 */
export function computeDevDiagnostic({ jobSpecific = {}, content = {}, keyExperiences = [], jobSections = [] }) {
  const checks = [];
  // 직군 특화 섹션별 작성 여부 (최적화 섹션은 정량 수치까지 요구)
  jobSections.forEach(f => {
    const v = jobSpecific[f.key];
    let ok = devSectionFilled(v);
    let hint = `‘${f.label}’ 섹션을 채우면 변별력이 올라가요`;
    if (f.key === 'optimization' && ok && !DIAG_HAS_NUMBER.test(v)) {
      ok = false;
      hint = '개선율·응답속도 등 숫자(before→after)를 넣으면 강해져요';
    }
    checks.push({ label: f.label, ok, hint });
  });
  // 정량 성과 지표 (핵심 경험 또는 기본 섹션에 수치)
  const anyMetric = keyExperiences.some(k => DIAG_HAS_NUMBER.test([k.metric, k.afterMetric, k.result].filter(Boolean).join(' ')))
    || DEV_BASE_SECTION_KEYS.some(k => DIAG_HAS_NUMBER.test(content[k] || ''));
  checks.push({ label: '정량 성과 지표', ok: anyMetric, hint: '수치로 표현된 성과가 있으면 신뢰도가 올라가요' });
  // 핵심 프로젝트 경험
  checks.push({ label: '핵심 프로젝트 경험', ok: keyExperiences.length > 0, hint: '대표 프로젝트를 1건 이상 추가하세요' });
  // 기본 7개 섹션 충실도
  const baseFilled = DEV_BASE_SECTION_KEYS.filter(k => devSectionFilled(content[k])).length;
  checks.push({ label: `기본 7개 섹션 (${baseFilled}/${DEV_BASE_SECTION_KEYS.length})`, ok: baseFilled >= DEV_BASE_SECTION_KEYS.length - 1, hint: '비어있는 섹션을 채워 완성도를 높이세요' });

  const passed = checks.filter(c => c.ok).length;
  const score = Math.round((passed / checks.length) * 100);
  return { score, checks, passed, total: checks.length };
}
