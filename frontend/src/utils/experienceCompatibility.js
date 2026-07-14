const VALID_JOB_CATEGORIES = new Set(['common', 'dev', 'aiml', 'da', 'devops', 'pm', 'designer', 'marketer', 'hr', 'sales']);
const JOB_CATEGORY_ALIASES = {
  developer: 'dev', frontend: 'dev', backend: 'dev', engineer: 'dev', '개발': 'dev', '개발자': 'dev',
  ai: 'aiml', ml: 'aiml', 'ai/ml': 'aiml', '인공지능': 'aiml',
  data: 'da', analyst: 'da', '데이터': 'da', '데이터분석': 'da',
  infra: 'devops', infrastructure: 'devops', '인프라': 'devops',
  planner: 'pm', planning: 'pm', product: 'pm', '기획': 'pm', '기획자': 'pm',
  design: 'designer', '디자인': 'designer', '디자이너': 'designer',
  marketing: 'marketer', '마케팅': 'marketer', '마케터': 'marketer',
  recruit: 'hr', recruiting: 'hr', '인사': 'hr', '채용': 'hr',
  business: 'sales', bd: 'sales', '사업개발': 'sales', '영업': 'sales',
};

const JOB_SPECIFIC_KEYS = {
  dev: ['techStack', 'architecture', 'troubleshooting', 'optimization'],
  aiml: ['datasetArch', 'evaluation', 'serving'],
  da: ['pipeline', 'hypothesis', 'businessInsight'],
  devops: ['infraArch', 'cicd', 'costOptimize'],
  pm: ['strategy', 'msc', 'businessImpact'],
  designer: ['researchApproach', 'prototyping', 'designSystem'],
  marketer: ['funnel', 'targetChannel', 'kpiEvidence', 'resumeBullets', 'jdKeywordMap'],
  hr: ['hiringPipeline', 'funnelData', 'retention'],
  sales: ['leadGen', 'salesFunnel', 'contractResult'],
};

const text = (value) => String(value ?? '').trim();
const first = (...values) => values.find(value => text(value)) ?? '';
const normalizeCategory = (value) => {
  const raw = text(value).toLowerCase();
  if (VALID_JOB_CATEGORIES.has(raw)) return raw;
  if (JOB_CATEGORY_ALIASES[raw]) return JOB_CATEGORY_ALIASES[raw];
  if (/개발|front.?end|back.?end|software/.test(raw)) return 'dev';
  if (/ai\s*[/·&]?\s*ml|머신러닝|인공지능/.test(raw)) return 'aiml';
  if (/데이터.*(분석|애널)|data.*analy/.test(raw)) return 'da';
  if (/devops|인프라/.test(raw)) return 'devops';
  if (/기획|product\s*manager|\bpm\b/.test(raw)) return 'pm';
  if (/디자인|designer/.test(raw)) return 'designer';
  if (/마케팅|마케터|market/.test(raw)) return 'marketer';
  if (/인사|채용|recruit|human resource/.test(raw)) return 'hr';
  if (/세일즈|영업|사업.?개발|sales|business development/.test(raw)) return 'sales';
  return '';
};

function inferCategoryFromContent(sr = {}) {
  const jobSpecific = sr.jobSpecific || {};
  const bySections = Object.entries(JOB_SPECIFIC_KEYS)
    .map(([category, keys]) => ({ category, score: keys.filter(key => text(jobSpecific[key])).length }))
    .sort((a, b) => b.score - a.score)[0];
  if (bySections?.score > 0) return bySections.category;
  if (sr.marketerKit) return 'marketer';
  if (sr.gitAnalysis || sr.githubStats) return 'dev';
  const jobDataKeys = (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [])
    .flatMap(experience => Object.keys(experience?.jobData || {}));
  if (jobDataKeys.some(key => ['decision', 'alternatives', 'stakeholders', 'impact', 'effort'].includes(key))) return 'pm';
  if (jobDataKeys.some(key => ['channels', 'creative', 'kpis'].includes(key))) return 'marketer';
  if (jobDataKeys.some(key => ['method', 'finding', 'businessAction', 'significance'].includes(key))) return 'da';
  if (jobDataKeys.some(key => ['painPoint', 'designDecision', 'testResult'].includes(key))) return 'designer';
  return '';
}

export function resolveExperienceJobCategory(data = {}) {
  const sr = data.structuredResult || {};
  const explicitCategories = [data.jobCategory, sr.jobCategory, data.content?.jobCategory, data.jobType]
    .map(normalizeCategory)
    .filter(Boolean);
  // 과거 최상위 값이 common이어도, 내부에 저장된 구체 직군은 우선 보존한다.
  const explicitJob = explicitCategories.find(category => category !== 'common');
  if (explicitJob) return explicitJob;
  // GitHub·직군 특화 필드는 과거 common 기본값보다 강한 근거다.
  const inferred = inferCategoryFromContent(sr);
  if (inferred) return inferred;
  return explicitCategories.includes('common') ? 'common' : 'common';
}

function legacyJobData(category, experience = {}) {
  const current = experience.jobData && typeof experience.jobData === 'object' ? experience.jobData : {};
  const mapped = category === 'pm' ? {
    hypothesis: first(current.hypothesis, experience.hypothesis, experience.assumption),
    decision: first(current.decision, experience.decision),
    alternatives: first(current.alternatives, experience.alternatives),
    stakeholders: first(current.stakeholders, experience.stakeholders),
    obstacle: first(current.obstacle, experience.obstacle),
    resolution: first(current.resolution, experience.resolution),
    validation: first(current.validation, experience.validation),
    impact: first(current.impact, experience.impact),
    effort: first(current.effort, experience.effort),
  } : category === 'marketer' ? {
    target: first(current.target, experience.target),
    channels: current.channels || experience.channels || [],
    creative: first(current.creative, experience.creative),
    kpis: current.kpis || experience.kpis || [],
  } : category === 'da' ? {
    hypothesis: first(current.hypothesis, experience.hypothesis),
    method: first(current.method, experience.method),
    finding: first(current.finding, experience.finding),
    businessAction: first(current.businessAction, experience.businessAction),
    control: first(current.control, experience.control),
    variant: first(current.variant, experience.variant),
    significance: first(current.significance, experience.significance),
  } : category === 'designer' ? {
    painPoint: first(current.painPoint, experience.painPoint),
    designDecision: first(current.designDecision, experience.designDecision),
    testResult: first(current.testResult, experience.testResult),
  } : category === 'hr' ? {
    goal: first(current.goal, experience.goal),
    program: first(current.program, experience.program),
    funnelChange: first(current.funnelChange, experience.funnelChange),
  } : category === 'sales' ? {
    client: first(current.client, experience.client),
    dealSize: first(current.dealSize, experience.dealSize),
    stage: first(current.stage, experience.stage),
    strategy: first(current.strategy, experience.strategy),
  } : category === 'aiml' ? {
    model: first(current.model, experience.model),
    dataset: first(current.dataset, experience.dataset),
    baseline: first(current.baseline, experience.baseline),
    result: first(current.result, experience.result),
  } : category === 'devops' ? {
    incident: first(current.incident, experience.incident),
    rootCause: first(current.rootCause, experience.rootCause),
    remediation: first(current.remediation, experience.remediation),
  } : {};
  return Object.fromEntries(Object.entries({ ...mapped, ...current }).filter(([, value]) => (
    Array.isArray(value) ? value.length > 0 : text(value)
  )));
}

/** 과거 경험 문서를 현재 직군별 화면이 읽을 수 있는 형태로 비파괴 정규화한다. */
export function normalizeExperienceForCurrentJob(data = {}) {
  const category = resolveExperienceJobCategory(data);
  const sr = data.structuredResult && typeof data.structuredResult === 'object' ? data.structuredResult : {};
  const keyExperiences = (Array.isArray(sr.keyExperiences) ? sr.keyExperiences : []).map(experience => {
    const jobData = legacyJobData(category, experience);
    return Object.keys(jobData).length ? { ...experience, jobData } : experience;
  });
  return {
    ...data,
    jobCategory: category,
    structuredResult: {
      ...sr,
      jobCategory: category,
      keyExperiences,
      jobSpecific: sr.jobSpecific && typeof sr.jobSpecific === 'object' ? sr.jobSpecific : {},
    },
  };
}
