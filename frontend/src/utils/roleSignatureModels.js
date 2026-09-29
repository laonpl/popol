const first = (rows = [], field) => rows.find(row => row?.[field]) || null;
const record = (item, dimension) => first(item.records?.filter(row => row.dimension === dimension), 'claim');
const field = (label, value, source) => value ? { label, value, source } : null;
const fieldFrom = (label, ...candidates) => {
  const found = candidates.find(([value]) => value);
  return found ? field(label, found[0], found[1]) : null;
};
const stage = (key, label, title, prompt, fields, choices = []) => ({
  key, label, title, prompt, fields: fields.filter(Boolean), choices,
});
export function stageEvidenceLabel(entry) {
  const rows = [...entry.fields.map(item => item.source), ...entry.choices].filter(Boolean);
  if (!entry.fields.length && !entry.choices.length) return '기록 필요';
  if (rows.length && rows.every(row => row.basis === 'source_excerpt') && entry.fields.every(item => item.source)) return '원문 연결';
  if (rows.some(row => row.basis === 'source_excerpt')) return '일부 원문 연결';
  if (rows.some(row => row.basis === 'self_report')) return '본인 진술';
  return '원문 확인 필요';
}

export function buildPmDecisionStages(item) {
  const w = item.workProducts;
  const problem = w.problems?.[0], research = w.research?.[0];
  const business = w.businessModel?.[0], metricLink = w.metricLinks?.[0];
  const alternatives = w.alternatives || [], selected = alternatives.find(row => row.disposition === '채택') || first(alternatives, 'option');
  const discovery = record(item, 'discovery'), prioritization = record(item, 'prioritization');
  const delivery = record(item, 'delivery'), validation = record(item, 'validation');
  const outcome = record(item, 'outcome'), learning = record(item, 'learning');
  const requirement = w.requirements?.[0];
  const flow = w.serviceBlueprint?.length ? w.serviceBlueprint : w.journey || [];
  const experiment = w.experiments?.[0];
  const release = w.releases?.[0], collaboration = w.collaboration?.[0], risk = w.risks?.[0];
  const metric = item.metrics?.find(row => row.actual) || item.metrics?.[0];
  return [
    stage('discovery', '문제 발견', '왜 이 문제부터 풀었나', '인터뷰·VOC·행동 기록에서 문제를 발견한 근거를 남겨주세요.', [
      fieldFrom('대상 사용자', [problem?.user, problem], [research?.segment, research]),
      fieldFrom('관찰한 신호', [problem?.signal, problem], [research?.observation, research]),
      fieldFrom('정의한 문제', [problem?.problem, problem], [discovery?.claim, discovery]),
      field('사업적 이유', problem?.businessReason, problem),
      field('고객에게 전달한 가치', business?.value, business),
      field('비용·사업 제약', business?.cost || business?.tradeoff, business),
    ]),
    stage('decision', '선택과 포기', '무엇을 선택하고 무엇을 제외했나', '검토한 대안, 선택 기준, MVP에서 제외한 범위를 기록해 주세요.', [
      fieldFrom('선택한 방향', [selected?.option, selected], [prioritization?.claim, prioritization]),
      field('판단 기준', selected?.criterion, selected),
      field('감수한 제약', selected?.tradeoff, selected),
      field('MVP 범위', release?.scope, release),
      field('변화를 기대한 행동', metricLink?.driver, metricLink),
    ], alternatives),
    stage('design', '정책과 흐름', '결정을 어떻게 작동하는 제품으로 만들었나', '사용자 흐름, 정책 분기, 예외와 인수 조건을 정리해 주세요.', [
      field('직접 설계·실행한 범위', delivery?.claim, delivery),
      field('요구사항', requirement?.requirement, requirement),
      field('처리 정책', requirement?.rule, requirement),
      field('완료 조건', requirement?.acceptance, requirement),
    ], flow),
    stage('execution', '협업과 출시', '누구와 합의하고 어디까지 책임졌나', '이해관계자의 이견, 내 조율 범위, 출시 조건과 리스크를 구분해 기록해 주세요.', [
      fieldFrom('직접 책임진 실행', [collaboration?.myAction, collaboration], [delivery?.claim, delivery]),
      field('조율한 이견', collaboration?.disagreement, collaboration),
      field('출시·인수 조건', release?.gate, release),
      field('남은 위험과 대응', risk?.risk ? [risk.risk, risk.mitigation].filter(Boolean).join(' → ') : '', risk),
    ], [...(w.releases || []), ...(w.collaboration || [])]),
    stage('validation', '검증과 다음 결정', '어떤 신호로 판단을 바꿨나', '사전 가설과 실제 관찰을 구분하고, 다음 결정의 근거를 남겨주세요.', [
      fieldFrom('가설·검증 계획', [experiment?.hypothesis, experiment], [validation?.claim, validation]),
      field('사전 성공 기준', experiment?.successCriteria, experiment),
      field('관찰한 결과', experiment?.observation || (metric?.actual ? `${metric.name} ${metric.actual}` : '') || outcome?.claim, experiment?.observation ? experiment : metric?.actual ? metric : outcome),
      fieldFrom('다음 판단', [experiment?.decision, experiment], [learning?.claim, learning]),
      field('지표 연결 근거', metricLink?.relationship, metricLink),
    ]),
  ];
}

export function buildMarketingStudioStages(item) {
  const w = item.workProducts;
  const audience = w.audiences?.[0], positioning = w.positioning?.[0];
  const targeting = record(item, 'targeting'), creativeRecord = record(item, 'creative');
  const activation = record(item, 'activation'), attribution = record(item, 'attribution');
  const learning = record(item, 'learning'), experiment = record(item, 'experiment');
  const creatives = w.creatives || [], channels = w.channels || [];
  const creative = creatives[0], channel = channels[0];
  const metric = item.metrics?.find(row => row.actual && row.kind === 'outcome') || item.metrics?.find(row => row.actual);
  const measurement = w.measurement?.[0], content = w.contentSystem?.[0], crm = w.crm?.[0];
  const optimization = w.optimization?.[0], operations = w.operations?.[0];
  return [
    stage('audience', '고객 선택', '누구의 어떤 행동을 바꾸려 했나', '고객의 관찰 신호, 장벽과 선택 근거를 기록해 주세요.', [
      fieldFrom('고객군', [audience?.segment, audience], [targeting?.claim, targeting]),
      field('관찰 신호', audience?.signal, audience),
      field('행동 장벽', audience?.barrier, audience),
      field('전달할 약속', positioning?.promise, positioning),
      field('믿을 이유', positioning?.proof, positioning),
    ]),
    stage('creative', '메시지와 소재', '왜 이 표현을 만들었나', '실제 카피·소재와 표현을 선택한 이유를 기록해 주세요.', [
      field('표현 방향', creativeRecord?.claim, creativeRecord),
      field('후킹 문구', creative?.hook, creative),
      field('메시지', creative?.message, creative),
      field('선택 이유', creative?.rationale, creative),
    ], creatives),
    stage('activation', '채널과 운영', '고객에게 어떻게 닿았나', '채널별 역할, 연결 접점, 직접 집행한 범위를 기록해 주세요.', [
      field('운영한 일', activation?.claim, activation),
      field('채널', channel?.channel, channel),
      field('채널 역할', channel?.purpose, channel),
      field('다음 접점', channel?.handoff, channel),
    ], channels),
    stage('lifecycle', '콘텐츠와 CRM', '한 번의 접촉을 어떻게 이어 갔나', '콘텐츠 운영 구조와 CRM 대상·발송·종료 조건을 기록해 주세요.', [
      field('콘텐츠 주제', content?.pillar, content),
      field('배포·재활용', [content?.distribution, content?.reuse].filter(Boolean).join(' · '), content),
      field('CRM 진입 조건', crm?.trigger, crm),
      field('발송·종료 조건', [crm?.timing, crm?.exit, crm?.guardrail].filter(Boolean).join(' · '), crm),
      field('직접 제작·조율한 일', operations?.myAction || operations?.deliverable, operations),
    ], w.crm?.length ? w.crm : w.contentSystem || []),
    stage('measurement', '반응과 개선', '무엇을 관찰하고 다음에 무엇을 바꿨나', '목표와 실측을 구분하고 측정 조건·한계를 함께 남겨주세요.', [
      field('실측 반응', metric ? `${metric.name} ${metric.actual}` : attribution?.claim, metric || attribution),
      field('측정 정의', measurement?.definition, measurement),
      field('테스트·검증', experiment?.claim, experiment),
      fieldFrom('성과 해석의 한계', [item.attributionLimit, null], [measurement?.limitation, measurement]),
      fieldFrom('바꾼 선택', [optimization?.change, optimization], [learning?.claim, learning]),
      fieldFrom('다음 실행', [optimization?.next, optimization], [item.nextExperiment, null]),
    ]),
  ];
}
