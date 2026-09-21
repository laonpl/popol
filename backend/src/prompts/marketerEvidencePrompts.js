import { MARKETER_WORK_PRODUCTS_SCHEMA, MARKETER_WORK_PRODUCTS_GUIDE } from './marketerWorkProducts.js';

export const MARKETER_EVIDENCE_GUIDE = `
[마케터 핵심 경험]
요약보다 실제 산출물과 판단을 우선한다. 브랜드 인식·고객 관계·콘텐츠 자산·효율·사업 결과 중 해당 경험의 가치를 보존한다. 개인 채널·동아리·실패 실험도 유효하다.
marketerEvidence는 conversion(사업/브랜드 목표), targeting(대상 근거), creative(표현 선택), experiment(실행/검증), attribution(성과 해석), learning(판단 변화) 중 자료가 있는 축만 최대 8개다. 모든 축을 강제로 채우지 않는다.
claim 1~2문장, quote 연속 원문 20~800자, 정확한 source, stage(planned|executed|observed|changed|unknown), ownership(내 책임), limitation, missingEvidence를 기록한다.
marketerMetrics 최대 5개: 목표·기준값·실측을 분리하고, kind는 outcome(고객/사업 반응), output(제작·발행량), qualitative(정성 반응)로 구분한다. 산출량으로 사업성과를 대신하지 않는다. 수치가 없으면 []도 정상이다.
실제 관찰이라는 명시적 근거가 없는 수치는 actual에 넣지 않는다. 기간·표본·분모·귀속 조건을 함께 추출하고 없으면 빈 문자열이다. 계획 수치를 성과로 승격하지 않는다. 단순 전후 변화는 증분 효과가 아니다.
${MARKETER_WORK_PRODUCTS_GUIDE}
`;
export const MARKETER_JOB_DATA_SCHEMA = JSON.stringify({
  businessProblem: '', target: '', audienceInsight: '', channels: [], creative: '', experimentOptions: [], kpis: [], attributionLimit: '', nextExperiment: '',
  marketerWorkProducts: MARKETER_WORK_PRODUCTS_SCHEMA,
  marketerEvidence: [{ dimension: 'conversion|targeting|creative|experiment|attribution|learning', claim: '', quote: '', source: '', stage: 'planned|executed|observed|changed|unknown', ownership: '', limitation: '', missingEvidence: '' }],
  marketerMetrics: [{ name: '', kind: 'outcome|output|qualitative', stage: 'reach|click|conversion|retention|cost|qualitative', channel: '', baseline: '', target: '', actual: '', unit: '', period: '', population: '', method: '', quote: '', source: '', limitation: '' }],
});
