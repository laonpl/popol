const VALID_JOB_CATEGORIES = new Set(['common', 'dev', 'aiml', 'da', 'devops', 'pm', 'designer', 'marketer', 'hr', 'sales']);

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

export function resolveExperienceJobCategory(data = {}) {
  const sr = data.structuredResult || {};
  const explicit = [data.jobCategory, sr.jobCategory, data.content?.jobCategory, data.jobType]
    .map(value => text(value).toLowerCase())
    .find(value => VALID_JOB_CATEGORIES.has(value));
  if (explicit) return explicit;
  if (sr.marketerKit) return 'marketer';
  if (sr.gitAnalysis || sr.githubStats) return 'dev';
  const jobSpecific = sr.jobSpecific || {};
  const inferred = Object.entries(JOB_SPECIFIC_KEYS)
    .map(([category, keys]) => ({ category, score: keys.filter(key => text(jobSpecific[key])).length }))
    .sort((a, b) => b.score - a.score)[0];
  return inferred?.score > 0 ? inferred.category : 'common';
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
