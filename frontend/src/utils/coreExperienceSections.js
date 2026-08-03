/**
 * coreExperienceSections — 직군별 핵심 경험 페이지(간략 보기, ExperienceResult) 데이터를
 * 내보내기/포트폴리오 섹션(text·image 블록)으로 변환한다.
 *
 * 내보내기 기본 틀이 핵심 경험 페이지 구성을 따르도록,
 *  - 자세히 보기의 포트폴리오 내보내기 패널(StructuredResult)
 *  - 노션 프로젝트 화면 구성(ProjectDetailModal 팔레트·초안·기본 렌더링, projectSections)
 * 이 같은 섹션 목록을 공유한다. 섹션 type은 'core'.
 */
import { buildJdEvidenceMap } from './jdEvidenceMap';

function sanitizeText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function isDraftCoreText(value) {
  const t = String(value || '').trim();
  return !t || t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]') || /【[^】]*】/.test(t);
}
const coreText = (value) => (isDraftCoreText(value) ? '' : sanitizeText(value).replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '').trim());
const coreLine = (label, value) => (coreText(value) ? `${label}: ${coreText(value)}` : '');
const coreLineList = (value) => (Array.isArray(value) ? value : String(value || '').split('\n')).map(coreText).filter(Boolean);
const joinCoreLines = (lines) => lines.filter(Boolean).join('\n');

const blockId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const makeTextBlock = (content) => ({ id: blockId('text'), type: 'text', content: sanitizeText(content) });
const makeImageBlock = (url, alt = '', width = '100%') => ({ id: blockId('image'), type: 'image', content: url, alt: sanitizeText(alt), width: width || '100%' });
const blocksToText = (blocks) => blocks.map(b => (b?.type === 'text' ? b.content : '')).filter(Boolean).join('\n\n');

// GitHub 중심 개발 임팩트 묶음은 FE/BE 개발자 전용이다.
// AI/ML·DevOps는 JOB_SPECIFIC_FIELDS와 전용 JobShowcase 구성을 사용한다.
const CORE_DEV_GIT_JOBS = ['dev'];

/* 핵심 경험 & 성과 — 핵심 경험 페이지 카드(성과 전/후·문제·행동·결과·배움 + 사진)를 그대로 옮긴다.
   기획/PM은 같은 데이터가 의사결정 기록이므로 jobData(채택/기각 대안·검증·임팩트)를 함께 담는다. */
function buildKeyExperienceExportSection(keyExperiences = [], keyExpImages = {}, jobCategory = 'common') {
  const isPm = jobCategory === 'pm';
  const blocks = [];
  keyExperiences.forEach((item, index) => {
    const jd = item?.jobData || {};
    const hr = item?.honestReview || {};
    const trace = item?.decisionTrace || {};
    const voice = item?.voiceRecord || {};
    const identity = item?.identitySignal || {};
    const alternatives = (Array.isArray(trace.alternatives) ? trace.alternatives : [])
      .map(option => typeof option === 'string'
        ? coreText(option)
        : [coreText(option?.option), coreText(option?.reasonNotChosen) || coreText(option?.cons)].filter(Boolean).join(' — '))
      .filter(Boolean);
    const criteria = (Array.isArray(trace.decisionCriteria) ? trace.decisionCriteria : [])
      .map(criterion => typeof criterion === 'string'
        ? coreText(criterion)
        : [coreText(criterion?.criterion), coreText(criterion?.why)].filter(Boolean).join(' — '))
      .filter(Boolean);
    const evidence = (Array.isArray(item?.evidenceBundle) ? item.evidenceBundle : [])
      .map(source => {
        const name = coreText(source?.sourceRef) || coreText(source?.type);
        const proof = coreText(source?.whatItProves) || coreText(source?.claim);
        const ownership = coreText(source?.ownership);
        return [name, proof, ownership && `기여: ${ownership}`].filter(Boolean).join(' · ');
      })
      .filter(Boolean);
    const before = coreText(item?.beforeMetric);
    const after = coreText(item?.afterMetric) || coreText(item?.metric);
    const impact = Number(jd.impact), effort = Number(jd.effort);
    const text = joinCoreLines([
      `${index + 1}. ${coreText(item?.title) || (isPm ? `의사결정 ${index + 1}` : `핵심 경험 ${index + 1}`)}`,
      after ? `성과: ${before ? `${before} → ${after}` : after}` : '',
      coreLine('상황', item?.context || item?.situation),
      // 경험 맥락 — 같은 직무도 팀 규모·권한·규모가 다르면 다른 경험이다 (이식성 판단 축)
      coreLine('팀 구성', item?.scope?.teamSize),
      coreLine('내 결정 권한', item?.scope?.myAuthority),
      coreLine('다룬 규모', item?.scope?.scale),
      coreLine('당시 제약', item?.scope?.constraints),
      ...(isPm ? [
        coreLine('의사결정', jd.decision),
        coreLine('기각한 대안', jd.alternatives),
        coreLine('이해관계자', jd.stakeholders),
        coreLine('검증 방법', jd.validation),
        impact >= 1 && effort >= 1 ? `임팩트/리소스: Impact ${impact} · Effort ${effort}` : '',
      ] : []),
      coreLine(isPm ? '실행·돌파' : '행동', item?.action),
      coreLine('결과', item?.result),
      coreLine('배운 점', item?.learning),
      coreLine('문제 판단', trace.problemJudgment),
      coreLine('판단 근거', trace.problemEvidence),
      alternatives.length ? `검토한 대안:\n${alternatives.map(line => `- ${line}`).join('\n')}` : '',
      criteria.length ? `선택 기준:\n${criteria.map(line => `- ${line}`).join('\n')}` : '',
      coreLine('최종 선택', trace.choice),
      coreLine('직접 실행', trace.execution),
      coreLine('결과의 근거', trace.outcomeEvidence),
      coreLine('바뀐 판단', trace.changedJudgment),
      coreLine('다음 판단 원칙', trace.newPrinciple),
      /* 말투 보존 — 산출물에는 originalQuote를 인용부호로 그대로 싣는다.
         polished(AI가 다듬은 문장)는 내보내지 않는다: 원문을 애써 보존한 설계가
         마지막 한 걸음에서 "AI가 쓴 매끈한 문장"으로 바뀌는 것을 막기 위함이다.
         polished는 화면 편집 보조로만 남는다. */
      coreText(voice.originalQuote) ? `본인의 말: "${coreText(voice.originalQuote)}"` : '',
      coreLine('이 말이 보여주는 것', voice.aiMeaning),
      evidence.length ? `증거 자료:\n${evidence.map(line => `- ${line}`).join('\n')}` : '',
      coreLine('나를 보여주는 한 문장', identity.sentence),
      // 솔직 회고 — 성과만 나열된 결과물이 "너무 완벽해 보인다"는 피드백에 대응하는 블록
      coreLine('막혔던 지점', hr.struggle),
      coreLine('예상과 달랐던 점', hr.misjudgment),
      coreLine('남은 한계', hr.limitation),
      coreLine('다시 한다면', hr.nextTime),
    ]);
    if (text) blocks.push(makeTextBlock(text));
    (keyExpImages?.[String(index)] || []).forEach(img => {
      if (img?.url) blocks.push(makeImageBlock(img.url, coreText(item?.title) || `핵심 경험 ${index + 1}`, img.width));
    });
  });
  return {
    key: 'key-experiences',
    label: isPm ? '의사결정 & 어려움 해결' : '핵심 경험 & 성과',
    type: 'summary',
    content: blocksToText(blocks),
    blocks,
    enabled: blocks.length > 0,
  };
}

/* 개발 직군 — 개발 임팩트의 서비스 소개(product: 이름·문제 정의·해결 방법·주요 성과·핵심 기능) */
function buildProductIntroSection(sr = {}) {
  const product = sr.product || {};
  const outcomes = (Array.isArray(product.outcomes) ? product.outcomes : []).filter(o => coreText(o?.label) || coreText(o?.value));
  const features = (Array.isArray(product.features) ? product.features : []).filter(f => coreText(f?.name) || coreText(f?.desc));
  const headline = [coreText(product.name), coreText(product.tagline)].filter(Boolean).join(' — ');
  const content = joinCoreLines([
    headline,
    coreLine('문제 정의', product.problem),
    coreLine('해결 방법', product.solution),
    outcomes.length ? `주요 성과:\n${outcomes.map(o => `- ${[coreText(o.label), coreText(o.value)].filter(Boolean).join(': ')}`).join('\n')}` : '',
    features.length ? `핵심 기능:\n${features.map(f => `- ${[coreText(f.name), coreText(f.desc)].filter(Boolean).join(': ')}`).join('\n')}` : '',
  ]);
  return { key: 'core-product', label: '서비스 소개 · 문제 해결', type: 'core', content, enabled: !!content };
}

/* 개발 직군 — 핵심 경험 페이지의 기여도·영향력(GitHub 통계) 블록 */
function buildGitImpactSection(sr = {}) {
  const stats = sr.githubStats || {};
  const pct = Number(stats.contributionPct) || 0;
  const langs = (Array.isArray(stats.languages) ? stats.languages : []).filter(l => l?.name);
  const types = (Array.isArray(stats.commitTypes) ? stats.commitTypes : []).filter(t => t?.type).slice(0, 5);
  const lines = joinCoreLines([
    pct > 0
      ? `커밋 기여 비중: ${pct}% (내 커밋 ${stats.myCommits ?? '—'} / 전체 ${stats.totalCommits ?? '—'})`
      : (stats.myCommits ? `내 커밋: ${stats.myCommits}건` : ''),
    stats.activePeriod?.first ? `활동 기간: ${stats.activePeriod.first} ~ ${stats.activePeriod.last || ''}` : '',
    langs.length ? `언어 구성: ${langs.map(l => `${l.name} ${l.pct}%`).join(', ')}` : '',
    types.length ? `커밋 유형: ${types.map(t => `${t.type} ${t.count}건`).join(', ')}` : '',
  ]);
  const content = lines ? `${lines}\nGitHub 기여자 통계(기본 브랜치) 기준` : '';
  return { key: 'core-git-impact', label: '개발 임팩트 · 기여도', type: 'core', content, enabled: !!content };
}

/* 개발 직군 — 개발 임팩트의 문제 해결 기록(gitAnalysis.experiences) */
function buildGitProblemSection(sr = {}) {
  const exps = Array.isArray(sr.gitAnalysis?.experiences) ? sr.gitAnalysis.experiences : [];
  const blocks = exps.map((exp, index) => {
    const problems = coreLineList(exp?.problem_definition);
    const solutions = coreLineList(exp?.troubleshooting);
    const text = joinCoreLines([
      `${index + 1}. ${coreText(exp?.project_name) || `프로젝트 ${index + 1}`}`,
      coreLine('기간', exp?.period),
      coreLine('기술', exp?.core_tech_stack),
      coreLine('임팩트', exp?.core_impact),
      problems.length ? `문제 정의:\n${problems.map(line => `- ${line}`).join('\n')}` : '',
      solutions.length ? `해결 과정:\n${solutions.map(line => `- ${line}`).join('\n')}` : '',
    ]);
    return text ? makeTextBlock(text) : null;
  }).filter(Boolean);
  return {
    key: 'core-git-problems',
    label: '문제 해결 기록',
    type: 'core',
    content: blocksToText(blocks),
    blocks,
    enabled: blocks.length > 0,
  };
}

/* 기획/PM — 린 캔버스(문제·기존 솔루션·고유 가치·고객·얼리어답터·핵심지표) 한 장 요약 */
function buildLeanCanvasSection(sr = {}) {
  const product = sr.product || {};
  const canvas = sr.leanCanvas || {};
  const pv = sr.portfolioVisuals || {};
  const metricItems = [
    ...(Array.isArray(pv.kpis) ? pv.kpis : []).map(k => ({ label: coreText(k?.label), value: coreText(k?.value) })),
    ...(Array.isArray(pv.goals) ? pv.goals : []).map(g => ({ label: coreText(g?.label), value: coreText(g?.actual) || coreText(g?.target) })),
  ].filter(m => m.label || m.value).slice(0, 3);
  const content = joinCoreLines([
    coreLine('문제', product.problem),
    coreLine('기존 솔루션', canvas.existingAlternatives || product.solution),
    coreLine('고유 가치 제안', canvas.uvp),
    coreLine('고객 세그먼트', canvas.customers),
    coreLine('얼리어답터', canvas.earlyAdopters),
    metricItems.length ? `핵심지표: ${metricItems.map(m => [m.label, m.value].filter(Boolean).join(' ')).join(', ')}` : '',
  ]);
  return { key: 'core-lean-canvas', label: '린 캔버스 요약', type: 'core', content, enabled: !!content };
}

/* 기획/PM — 가설 검증 설계 표 (저장된 pmHypotheses 우선, 없으면 경험별 jobData에서 유도) */
function buildPmValidationSection(sr = {}, keyExperiences = []) {
  const stored = Array.isArray(sr.pmHypotheses) ? sr.pmHypotheses : [];
  const rows = stored.length ? stored : keyExperiences.map(ke => {
    const jd = ke?.jobData || {};
    return {
      hypothesis: jd.hypothesis,
      kpi: ke?.metricLabel,
      kpiRationale: jd.validation,
      achievement: ke?.afterMetric || ke?.metric,
      note: jd.note || jd.failureReason,
    };
  });
  const content = rows.map((row, index) => joinCoreLines([
    coreText(row?.hypothesis) ? `H${index + 1}. ${coreText(row.hypothesis)}` : '',
    coreLine('핵심 KPI', row?.kpi),
    coreLine('설정 근거', row?.kpiRationale),
    coreLine('목표', row?.target),
    coreLine('달성', row?.achievement || row?.actual),
    coreLine('비고', row?.note),
  ])).filter(Boolean).join('\n\n');
  return { key: 'core-pm-validation', label: '가설 및 검증', type: 'core', content, enabled: !!content };
}

/* 직군별 시그니처 산출물 — 개발자의 '문제 해결 기록', PM의 '가설 및 검증'처럼
   나머지 직군도 자기 직무의 언어로 된 고유 산출물을 갖게 한다.
   AI가 keyExperiences[].jobData에 직무 단위(개선 반복·분석·실험·인시던트·프로그램·딜)로 추출한 값을 그대로 쓴다. */
const JOB_SIGNATURE = {
  designer: { key: 'core-design-iterations', label: '디자인 개선 반복 기록', unit: '개선',
    rows: [['페인포인트', 'painPoint'], ['디자인 결정', 'designDecision'], ['테스트 결과', 'testResult']] },
  da: { key: 'core-da-analyses', label: '분석 기록', unit: '분석',
    rows: [['가설', 'hypothesis'], ['분석 방법', 'method'], ['발견', 'finding'], ['비즈니스 액션', 'businessAction'], ['대조군', 'control'], ['실험군', 'variant'], ['통계 유의성', 'significance']] },
  aiml: { key: 'core-aiml-experiments', label: '실험 기록', unit: '실험',
    rows: [['데이터셋', 'dataset'], ['모델', 'model'], ['선택 이유', 'whyModel'], ['평가 지표', 'metrics']] },
  devops: { key: 'core-devops-incidents', label: '인시던트 · 개선 기록', unit: '개선',
    rows: [['상황', 'incident'], ['원인', 'rootCause'], ['조치', 'actionTaken'], ['지표 개선', 'impact']] },
  hr: { key: 'core-hr-programs', label: '프로그램 운영 기록', unit: '프로그램',
    rows: [['조직 과제', 'goal'], ['설계·운영', 'program'], ['퍼널 변화', 'funnelChange']] },
  sales: { key: 'core-sales-deals', label: '딜 기록', unit: '딜',
    rows: [['고객', 'client'], ['접근·제안', 'approach'], ['협상 돌파', 'negotiation'], ['계약 규모', 'dealSize'], ['진행 단계', 'stage']] },
  security: { key: 'core-security-cases', label: '위협 검증 · 완화 기록', unit: '보안 판단',
    rows: [['보호 자산', 'asset'], ['위협·발견', 'threat'], ['재현', 'reproduction'], ['위험 판단', 'riskAssessment'], ['완화', 'mitigation'], ['재검증', 'verification'], ['잔여 위험', 'residualRisk']] },
  qa: { key: 'core-qa-cases', label: '품질 위험 · 테스트 기록', unit: '품질 판단',
    rows: [['품질 위험', 'qualityRisk'], ['테스트 근거', 'testBasis'], ['우선순위', 'prioritization'], ['추적성', 'traceability'], ['결함 근거', 'defectEvidence'], ['릴리스 판단', 'releaseDecision'], ['남은 위험', 'remainingRisk']] },
  engineering: { key: 'core-engineering-tests', label: '설계 · 시험 · 재설계 기록', unit: '설계 판단',
    rows: [['요구조건', 'requirement'], ['분석', 'analysis'], ['설계 대안', 'designAlternatives'], ['설계 결정', 'designDecision'], ['시험 방법', 'testMethod'], ['시험 결과', 'testResult'], ['실패·재설계', 'redesign']] },
  project: { key: 'core-project-decisions', label: '프로젝트 통제 · 변경 기록', unit: '프로젝트 판단',
    rows: [['목표', 'objective'], ['범위', 'scope'], ['베이스라인', 'baseline'], ['의존성', 'dependencies'], ['리스크', 'risk'], ['변경 결정', 'changeDecision'], ['인수 근거', 'deliveryEvidence'], ['편차·회고', 'retrospective']] },
  content: { key: 'core-content-decisions', label: '콘텐츠 제작 · 편집 기록', unit: '콘텐츠 판단',
    rows: [['대상', 'audience'], ['목표', 'contentGoal'], ['조사', 'research'], ['포맷 대안', 'formatOptions'], ['편집 결정', 'editorialDecision'], ['수정 근거', 'revisionEvidence'], ['배포 반응', 'response'], ['다음 포맷', 'nextFormat']] },
  customer_success: { key: 'core-customer-success', label: '고객 가치 · 운영 개선 기록', unit: '고객 판단',
    rows: [['고객 목표', 'customerGoal'], ['문제 신호', 'signal'], ['근본 원인', 'rootCause'], ['대응', 'intervention'], ['에스컬레이션', 'escalation'], ['채택 근거', 'adoptionEvidence'], ['유지 근거', 'retentionEvidence'], ['예방', 'prevention']] },
  finance: { key: 'core-finance-decisions', label: '재무 판단 · 통제 기록', unit: '재무 판단',
    rows: [['의사결정 질문', 'decisionQuestion'], ['출처', 'dataSources'], ['가정', 'assumptions'], ['모델', 'modelMethod'], ['민감도', 'scenarioSensitivity'], ['통제', 'controls'], ['권고', 'recommendation'], ['실제 활용', 'decisionUse'], ['편차·위험', 'variance']] },
  strategy: { key: 'core-strategy-cases', label: '가설 · 대안 · 권고 기록', unit: '전략 판단',
    rows: [['핵심 질문', 'decisionQuestion'], ['문제 구조', 'issueStructure'], ['가설', 'hypotheses'], ['조사 근거', 'researchEvidence'], ['대안', 'options'], ['평가 기준', 'evaluationCriteria'], ['권고', 'recommendation'], ['반론', 'counterarguments'], ['실행·결과', 'outcome']] },
  operations: { key: 'core-operations-improvements', label: '프로세스 개선 · 통제 기록', unit: '운영 개선',
    rows: [['프로세스 범위', 'processScope'], ['기준선', 'baseline'], ['측정 품질', 'measurementQuality'], ['근본 원인', 'rootCause'], ['파일럿', 'pilot'], ['개선', 'improvement'], ['통제 계획', 'controlPlan'], ['결과', 'result'], ['부작용', 'unintendedEffect']] },
  research: { key: 'core-research-cases', label: '연구 질문 · 검증 · 기여 기록', unit: '연구 판단',
    rows: [['연구 질문', 'researchQuestion'], ['문헌 공백', 'literatureGap'], ['가설', 'hypothesis'], ['방법 대안', 'methodAlternatives'], ['방법', 'method'], ['검증', 'validation'], ['발견', 'finding'], ['한계', 'limitations'], ['기여 역할', 'contributionRoles']] },
  education: { key: 'core-education-designs', label: '학습 설계 · 평가 기록', unit: '교육 판단',
    rows: [['학습자 맥락', 'learnerContext'], ['학습 필요', 'learningNeed'], ['학습목표', 'objectives'], ['학습 설계', 'learningDesign'], ['평가', 'assessment'], ['포용성', 'inclusion'], ['학습 증거', 'learnerEvidence'], ['재설계', 'iteration'], ['전이', 'transfer']] },
  policy: { key: 'core-policy-cases', label: '정책 설계 · 평가 기록', unit: '정책 판단',
    rows: [['정책 문제', 'policyProblem'], ['대상', 'population'], ['이해관계자', 'stakeholders'], ['근거', 'evidence'], ['대안', 'options'], ['선택 기준', 'criteria'], ['논리모형', 'theoryOfChange'], ['모니터링', 'monitoring'], ['평가', 'evaluation'], ['형평성 위험', 'equityRisk']] },
  legal: { key: 'core-legal-reviews', label: '쟁점 · 위험 · 통제 기록', unit: '법률 판단',
    rows: [['사실관계', 'facts'], ['쟁점', 'legalIssues'], ['적용 근거', 'authorities'], ['불확실성', 'uncertainty'], ['대안', 'options'], ['위험 판단', 'riskAssessment'], ['권고', 'recommendation'], ['통제', 'control'], ['결과', 'outcome']] },
  healthcare: { key: 'core-healthcare-quality', label: '안전 · 품질 개선 기록', unit: '품질 판단',
    rows: [['진료·서비스 맥락', 'careContext'], ['품질 문제', 'qualityProblem'], ['근거·지침', 'evidenceGuideline'], ['안전 기준', 'safetyCriteria'], ['중재', 'intervention'], ['측정 품질', 'measurementQuality'], ['결과', 'outcome'], ['부작용', 'unintendedEffect'], ['개인정보 경계', 'privacyBoundary']] },
};

/* jobData 값 → 한 줄 텍스트 (문자열 / 문자열 배열 / {name,value,baseline} 배열 모두 처리) */
function jobDataValue(value) {
  if (!Array.isArray(value)) return coreText(value);
  return value
    .map(item => (typeof item === 'string'
      ? coreText(item)
      : [coreText(item?.name), coreText(item?.value), coreText(item?.baseline) && `(기준 ${coreText(item.baseline)})`].filter(Boolean).join(' ')))
    .filter(Boolean)
    .join(', ');
}

function buildJobSignatureSection(jobCategory, keyExperiences = []) {
  const meta = JOB_SIGNATURE[jobCategory];
  if (!meta) return null;
  const content = keyExperiences
    .map((item, index) => {
      const jd = item?.jobData || {};
      const lines = meta.rows.map(([label, key]) => coreLine(label, jobDataValue(jd[key]))).filter(Boolean);
      if (lines.length === 0) return '';
      return joinCoreLines([`${index + 1}. ${coreText(item?.title) || `${meta.unit} ${index + 1}`}`, ...lines]);
    })
    .filter(Boolean)
    .join('\n\n');
  return { key: meta.key, label: meta.label, type: 'core', content, enabled: !!content };
}

function buildArtifactEvidenceSection(sr = {}) {
  const analysis = sr.artifactAnalysis || {};
  const artifacts = Array.isArray(analysis.detectedArtifacts) ? analysis.detectedArtifacts : [];
  const byId = Object.fromEntries(artifacts.map(item => [item?.id, item]));
  const rows = (Array.isArray(analysis.evidenceLedger) ? analysis.evidenceLedger : [])
    .map(row => {
      const refs = (Array.isArray(row?.artifactIds) ? row.artifactIds : [])
        .map(id => coreText(byId[id]?.name) || coreText(id))
        .filter(Boolean)
        .join(', ');
      return joinCoreLines([
        coreText(row?.claim) ? `주장: ${coreText(row.claim)}` : '',
        refs ? `근거 자료: ${refs}` : '',
        coreLine('원본 위치', row?.location),
        coreLine('직접 확인', row?.directObservation),
        coreLine('근거 등급', row?.proofLevel),
        coreLine('본인 기여', row?.ownership),
        coreLine('확인 필요', row?.gap),
      ]);
    })
    .filter(Boolean)
    .slice(0, 10);
  const content = rows.join('\n\n');
  return { key: 'core-artifact-evidence', label: '자료 판독 · 근거 장부', type: 'core', content, enabled: !!content };
}

/* 전 직군 공통 — 채용공고 요구 역량 × 그것을 증명하는 내 증거 × 공백.
   스킬 기반 채용에서 심사자가 보는 단위가 "경험"이 아니라 "역량↔근거"라서,
   기업 분석(jobAnalysis)이 있을 때만 만들어진다.
   ⚠️ 근거 등급(A~D)은 여기 싣지 않는다 — 심사자에게는 등급이 감점 신호로 읽힌다.
      확인 가능한 근거가 붙은 역량을 앞에 세우고, 공백은 "보완 필요"로만 남긴다. */
function buildJdEvidenceSection(sr = {}, jobAnalysis = null, expTitle = '') {
  if (!jobAnalysis) return { key: 'core-jd-evidence', label: '역량 · 증거 매핑', type: 'core', content: '', enabled: false };
  const { rows, summary } = buildJdEvidenceMap({
    jobAnalysis,
    experiences: [{ title: expTitle, structuredResult: sr }],
  });
  if (!rows.length) return { key: 'core-jd-evidence', label: '역량 · 증거 매핑', type: 'core', content: '', enabled: false };

  const evidenced = rows.filter(row => row.status === '근거 있음');
  const narrative = rows.filter(row => row.status === '서술만 있음');
  const gaps = rows.filter(row => row.status === '공백');

  const renderRow = (row) => joinCoreLines([
    `${row.kind} · ${coreText(row.requirement)}`,
    ...row.matched.map(m => `- ${coreText(m.text)}${m.source ? ` (${coreText(m.source)})` : ''}`),
  ]);

  const content = joinCoreLines([
    summary ? `요구 역량 ${summary.total}개 중 근거 확인 ${summary.evidenced} · 서술만 ${summary.narrativeOnly} · 보완 필요 ${summary.gaps}` : '',
    evidenced.length ? `[근거로 확인되는 역량]\n${evidenced.map(renderRow).join('\n\n')}` : '',
    narrative.length ? `[경험은 있으나 자료 보강이 필요한 역량]\n${narrative.map(row => `- ${coreText(row.requirement)}`).join('\n')}` : '',
    gaps.length ? `[보완 필요]\n${gaps.map(row => `- ${row.kind} · ${coreText(row.requirement)}`).join('\n')}` : '',
  ]);
  return { key: 'core-jd-evidence', label: '역량 · 증거 매핑', type: 'core', content, enabled: !!content };
}

/* 마케터 — marketerKit의 캠페인 스토리(퍼널)와 KPI */
function buildMarketerCampaignSection(sr = {}) {
  const kit = sr.marketerKit || {};
  const funnel = kit.funnel || {};
  const kpis = (Array.isArray(kit.kpis) ? kit.kpis : []).filter(k => coreText(k?.name));
  const content = joinCoreLines([
    coreLine('포지셔닝', kit.positioning),
    coreLine('문제', funnel.problem),
    coreLine('목표', funnel.goal),
    coreLine('타깃', funnel.target),
    coreLine('전략', funnel.strategy),
    coreLine('실행', funnel.execution),
    coreLine('성과', funnel.result),
    coreLine('인사이트', funnel.insight),
    kpis.length ? `캠페인 KPI:\n${kpis.map(k => `- ${coreText(k.name)}${coreText(k.value) ? `: ${coreText(k.value)}` : ''}${coreText(k.status) ? ` (${coreText(k.status)})` : ''}`).join('\n')}` : '',
  ]);
  return { key: 'core-marketer-campaign', label: '캠페인 스토리', type: 'core', content, enabled: !!content };
}

/* 마케터 — 이력서 문장 (resumeVariants 우선, 없으면 resumeBullets) */
function buildMarketerResumeSection(sr = {}) {
  const kit = sr.marketerKit || {};
  const variants = (Array.isArray(kit.resumeVariants) ? kit.resumeVariants : [])
    .map(v => coreText(v?.sentence)).filter(Boolean);
  const bullets = variants.length ? variants : (Array.isArray(kit.resumeBullets) ? kit.resumeBullets : []).map(coreText).filter(Boolean);
  const content = bullets.map(line => `- ${line}`).join('\n');
  return { key: 'core-marketer-resume', label: '이력서 문장', type: 'core', content, enabled: !!content };
}

/* 간략 보기 자유 본문(caseStudy.body) — 텍스트·사진 세그먼트를 블록으로 (내용 있을 때만) */
function buildCaseBodySection(caseStudy, jobCategory = 'common') {
  const segs = Array.isArray(caseStudy?.body) ? caseStudy.body : [];
  const blocks = [];
  let buffer = [];
  const flush = () => {
    const text = joinCoreLines(buffer);
    if (text) blocks.push(makeTextBlock(text));
    buffer = [];
  };
  segs.forEach(seg => {
    if (seg?.type === 'image') {
      if (seg.content) { flush(); blocks.push(makeImageBlock(seg.content, '', seg.width)); }
    } else {
      const text = sanitizeText(seg?.content || '').trim();
      if (text) buffer.push(text);
    }
  });
  flush();
  if (blocks.length === 0) return null;
  return {
    key: 'core-case-body',
    label: jobCategory === 'common' ? '케이스 스터디 본문' : '첨부 · 부가 자료',
    type: 'core',
    content: blocksToText(blocks),
    blocks,
    enabled: true,
  };
}

/* 섹션 마무리 — blocks 보정(내용만 있으면 텍스트 블록 생성) */
function finalizeSection(section) {
  if (!section) return null;
  const blocks = Array.isArray(section.blocks) && section.blocks.length > 0
    ? section.blocks
    : (section.content ? [makeTextBlock(section.content)] : []);
  return { ...section, content: sanitizeText(section.content || blocksToText(blocks)), blocks };
}

/**
 * 직군별 핵심 경험 페이지 전체 → 내보내기 기본 틀 섹션 목록 (핵심 경험 페이지의 읽기 순서 유지).
 * key-experiences 섹션을 포함하며, 노션 캔버스처럼 핵심 경험을 따로 다루는 화면은 key로 걸러 쓴다.
 */
export function buildCoreExperienceSections({ jobCategory = 'common', sr = {}, caseStudy = null, keyExperiences = [], keyExpImages = {}, jobAnalysis = null, expTitle = '' } = {}) {
  const keyExpSection = buildKeyExperienceExportSection(keyExperiences, keyExpImages, jobCategory);
  let sections;
  if (CORE_DEV_GIT_JOBS.includes(jobCategory)) {
    sections = [buildProductIntroSection(sr), buildGitImpactSection(sr), buildGitProblemSection(sr), keyExpSection];
  } else if (jobCategory === 'pm') {
    sections = [buildLeanCanvasSection(sr), keyExpSection, buildPmValidationSection(sr, keyExperiences)];
  } else if (jobCategory === 'marketer') {
    sections = [keyExpSection, buildMarketerCampaignSection(sr), buildMarketerResumeSection(sr)];
  } else if (JOB_SIGNATURE[jobCategory]) {
    sections = [keyExpSection, buildJobSignatureSection(jobCategory, keyExperiences)];
  } else {
    sections = [keyExpSection];
  }
  sections.push(buildJdEvidenceSection(sr, jobAnalysis, expTitle));
  sections.push(buildArtifactEvidenceSection(sr));
  sections.push(buildCaseBodySection(caseStudy, jobCategory));
  return sections.map(finalizeSection).filter(Boolean);
}

/** 경험 객체에서 바로 핵심 경험 섹션 목록을 만든다 (노션 구성 팔레트·초안·미리보기용). */
export function buildCoreSectionsForExperience(exp = {}) {
  const sr = exp?.structuredResult || {};
  return buildCoreExperienceSections({
    jobCategory: exp?.jobCategory || sr.jobCategory || 'common',
    sr,
    caseStudy: exp?.caseStudy || null,
    keyExperiences: Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [],
    keyExpImages: exp?.keyExpImages || {},
    jobAnalysis: exp?.jobAnalysis || sr.jobAnalysis || null,
    expTitle: exp?.title || '',
  });
}

/** 내용이 있는 섹션만 (팔레트 노출·기본 렌더링용) */
export function contentBearingCoreSections(exp = {}) {
  return buildCoreSectionsForExperience(exp)
    .filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image')));
}
