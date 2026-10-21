import { MARKETER_WORK_PRODUCTS_SCHEMA, MARKETER_WORK_PRODUCTS_GUIDE } from './marketerWorkProducts.js';

export const MARKETER_EVIDENCE_GUIDE = `
[마케터 캠페인 요약 — 가장 먼저 채울 칸]
채용 담당자가 마케터 포트폴리오에서 먼저 보는 것은 ① 누구에게: target(고객 구분)과 audienceInsight(그 고객을 고른 관찰·데이터·인터뷰 근거) ② 어디서·왜: channels(채널 이름 문자열 목록)와 marketerWorkProducts.channels의 purpose(채널에 맡긴 역할)·rationale(그 채널을 고른 이유) ③ 무엇을: creative(실제로 내건 핵심 메시지)와 creatives의 hook(실제 문구 원문) ④ 목표 대비 결과: marketerMetrics의 baseline·target·actual이다.
원문에 있으면 다른 산출물보다 먼저 빠짐없이 채운다. 원문에 있는 성과 수치는 marketerMetrics에 빠뜨리지 않는다(최대 5개, 바뀐 전후 수치는 baseline·actual로 함께).
원문에 고객을 고른 근거나 채널을 고른 이유가 없으면 지어내지 말고 빈 문자열로 둔다. "주 사용 채널이라서" 같은 일반론으로 채우지 않는다.

[마케터 핵심 경험]
요약보다 실제 산출물과 판단을 우선한다. 브랜드 인식·고객 관계·콘텐츠 자산·효율·사업 결과 중 해당 경험의 가치를 보존한다. 개인 채널·동아리·실패 실험도 유효하다.
marketerEvidence는 conversion(사업/브랜드 목표), targeting(대상 근거), creative(표현 선택), activation(채널 집행·콘텐츠/CRM 운영), experiment(테스트와 검증), attribution(성과 해석), learning(판단 변화) 중 자료가 있는 축만 최대 8개다. 캠페인 실행을 검증 실험으로 바꾸어 쓰지 않는다. 모든 축을 강제로 채우지 않는다.
claim 1~2문장, quote 연속 원문 20~800자, 정확한 source, stage(planned|executed|observed|changed|unknown), ownership(내 책임), limitation, missingEvidence를 기록한다.
marketerMetrics 최대 5개: 목표·기준값·실측을 분리하고, kind는 outcome(고객/사업 반응), output(제작·발행량), qualitative(정성 반응)로 구분한다. 산출량으로 사업성과를 대신하지 않는다. 수치가 없으면 []도 정상이다.
실제 관찰이라는 명시적 근거가 없는 수치는 actual에 넣지 않는다. 기간·표본·분모·귀속 조건을 함께 추출하고 없으면 빈 문자열이다. 계획 수치를 성과로 승격하지 않는다. 단순 전후 변화는 증분 효과가 아니다.
${MARKETER_WORK_PRODUCTS_GUIDE}
`;
export const MARKETER_JOB_DATA_SCHEMA = JSON.stringify({
  businessProblem: '', target: '', audienceInsight: '', channels: ['채널 이름'], creative: '', experimentOptions: [], kpis: [], attributionLimit: '', nextExperiment: '',
  marketerWorkProducts: MARKETER_WORK_PRODUCTS_SCHEMA,
  marketerEvidence: [{ dimension: 'conversion|targeting|creative|activation|experiment|attribution|learning', claim: '', quote: '', source: '', stage: 'planned|executed|observed|changed|unknown', ownership: '', limitation: '', missingEvidence: '' }],
  marketerMetrics: [{ name: '', kind: 'outcome|output|qualitative', stage: 'reach|click|conversion|retention|cost|qualitative', channel: '', baseline: '', target: '', actual: '', unit: '', period: '', population: '', method: '', quote: '', source: '', limitation: '' }],
});
