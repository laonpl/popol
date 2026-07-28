const VALID_JOB_CATEGORIES = new Set([
  'common', 'dev', 'aiml', 'da', 'devops', 'security', 'qa', 'engineering',
  'pm', 'project', 'designer', 'marketer', 'content',
  'hr', 'sales', 'customer_success', 'finance', 'strategy', 'operations',
  'research', 'education', 'policy', 'legal', 'healthcare',
]);
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
  security: 'security', cybersecurity: 'security', appsec: 'security', '보안': 'security', '정보보안': 'security',
  qa: 'qa', tester: 'qa', testing: 'qa', '테스트': 'qa', '품질보증': 'qa',
  hardware: 'engineering', mechanical: 'engineering', electrical: 'engineering', '기계': 'engineering', '전기': 'engineering', '전자': 'engineering',
  project: 'project', pmo: 'project', '프로젝트관리': 'project', '사업관리': 'project',
  content: 'content', editor: 'content', media: 'content', '콘텐츠': 'content', '에디터': 'content',
  cs: 'customer_success', cx: 'customer_success', 'customer success': 'customer_success', '고객성공': 'customer_success', '고객지원': 'customer_success',
  finance: 'finance', accounting: 'finance', investment: 'finance', '재무': 'finance', '회계': 'finance', '투자': 'finance',
  strategy: 'strategy', consulting: 'strategy', '전략': 'strategy', '컨설팅': 'strategy',
  operations: 'operations', logistics: 'operations', manufacturing: 'operations', '운영': 'operations', '물류': 'operations', '생산': 'operations',
  research: 'research', researcher: 'research', '연구': 'research', '연구원': 'research',
  education: 'education', teacher: 'education', training: 'education', '교육': 'education', '교사': 'education',
  policy: 'policy', government: 'policy', '정책': 'policy', '공공': 'policy', '행정': 'policy',
  legal: 'legal', compliance: 'legal', '법무': 'legal', '컴플라이언스': 'legal',
  healthcare: 'healthcare', clinical: 'healthcare', medical: 'healthcare', '보건': 'healthcare', '의료': 'healthcare',
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
  security: ['threatAssessment', 'verification', 'securityOwnership'],
  qa: ['qualityStrategy', 'testEvidence', 'releaseImpact'],
  engineering: ['requirementsDesign', 'prototypeTest', 'failureRedesign'],
  project: ['planControl', 'riskDecision', 'deliveryLearning'],
  content: ['editorialStrategy', 'productionRevision', 'distributionLearning'],
  customer_success: ['customerDiagnosis', 'serviceIntervention', 'customerOutcome'],
  finance: ['financialLogic', 'riskControl', 'decisionImpact'],
  strategy: ['problemStructure', 'optionAnalysis', 'implementationImpact'],
  operations: ['processBaseline', 'rootCausePilot', 'controlOutcome'],
  research: ['researchQuestion', 'validationFinding', 'researchContribution'],
  education: ['learningDesign', 'assessmentEvidence', 'teachingIteration'],
  policy: ['policyDesign', 'resultsFramework', 'evaluationEquity'],
  legal: ['issueAuthority', 'riskRecommendation', 'complianceOutcome'],
  healthcare: ['careQuality', 'interventionTeam', 'qualityOutcome'],
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
  if (/보안|security|cyber|appsec/.test(raw)) return 'security';
  if (/\bqa\b|테스트|tester|quality assurance/.test(raw)) return 'qa';
  if (/하드웨어|기계|전기|전자|mechanical|electrical|hardware/.test(raw)) return 'engineering';
  if (/프로젝트.?관리|사업.?관리|program manager|\bpmo\b/.test(raw)) return 'project';
  if (/콘텐츠|에디터|영상|copywriter|editor|media/.test(raw)) return 'content';
  if (/고객.?성공|고객.?지원|customer success|service operation|\bcx\b/.test(raw)) return 'customer_success';
  if (/재무|회계|투자|finance|accounting|investment/.test(raw)) return 'finance';
  if (/전략|컨설팅|consulting|corporate strategy/.test(raw)) return 'strategy';
  if (/운영|공급망|물류|생산|operations|supply chain|logistics|manufacturing/.test(raw)) return 'operations';
  if (/연구|research|scientist/.test(raw)) return 'research';
  if (/교육|교사|강의|instructional|teacher/.test(raw)) return 'education';
  if (/정책|공공|행정|public policy|government/.test(raw)) return 'policy';
  if (/법무|컴플라이언스|legal|compliance/.test(raw)) return 'legal';
  if (/보건|의료|헬스케어|healthcare|clinical|medical/.test(raw)) return 'healthcare';
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
