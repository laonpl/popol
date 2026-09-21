// PM evidence dimensions: GOV.UK Product Manager capability framework, service discovery,
// and SVPG's value / usability / feasibility / viability risks. See docs/pm-evidence.md.
import { PM_WORK_PRODUCT_GUIDE, PM_WORK_PRODUCT_SCHEMA } from './pmWorkProducts.js';

export const PM_EVIDENCE_GUIDE = PM_WORK_PRODUCT_GUIDE + `
[PM 전용 산출물: 제품 의사결정의 근거 사슬]
기획/PM의 핵심 가치는 기능 수나 회의 횟수가 아니라 사용자·사업의 불확실성을 줄인 판단이다.
각 핵심 경험은 하나의 제품 문제·개선 사례로 묶는다. 같은 문제를 둘러싼 발견·대안·설계·실험·협업·후속 판단은 함께 추출하며, 서로 무관한 프로젝트를 섞지 않는다. 출시 전 기획, 실패한 실험도 유효하다.
아래 6개 렌즈에서 자료에 있는 것만 jobData.pmEvidence로 추출한다. 경험당 최대 12개로, 한 렌즈에 서로 다른 근거가 있으면 2개 이상 추출할 수 있다. 렌즈를 모두 채울 필요는 없다.
- discovery: 누구의 어떤 문제인가? 인터뷰 발화·VOC·행동/퍼널·기존 대안의 한계가 문제 정의를 어떻게 바꿨나?
- prioritization: 어떤 대안을 비교하고 왜 선택/제외했나? 사용자 가치·사업 가치·개발 비용·일정·위험 사이의 선택 기준과 MVP 제외 범위.
- delivery: 내가 직접 작성/결정/합의한 PRD·정책·예외 흐름·수용 기준과 이해관계자의 이견. 팀 실행과 본인 기여를 분리.
- validation: 검증 전 가설, 방법, 성공/반증 기준, 실제 관찰, 유지/수정/중단 판단. 실험 계획을 실험 결과로 바꾸지 않는다.
- outcome: 실제 사용자/사업 변화 또는 정성 피드백. 목표치≠실측치, 출시≠사용 효과, 전후 변화≠내 결정의 인과효과.
- learning: 예상과 달랐던 결과로 무엇을 폐기·수정했고 다음 판단 원칙이 어떻게 바뀌었나? 일반적인 소감은 제외.
각 항목의 claim은 1~2문장, quote는 자료에서 연속된 원문 20~350자 그대로 복사, source는 실제 파일명/입력 구분명이다.
quote를 만들거나 서로 다른 문장을 이어 붙이지 않는다. 원문 없는 주장은 quote=""로 두고 missingEvidence에 필요한 자료를 적는다.
직접 입력/인터뷰는 자기 진술이다. 파일 소유만으로 저자·기여를 확정하지 않는다. 읽지 못한 링크는 내용 근거로 사용하지 않는다.
stage는 planned(계획), executed(실행), observed(관찰 결과), changed(판단 변경), unknown 중 원문이 확인하는 단계까지만.
pmMetrics는 최대 5개. 획득·활성화·전환·잔존·매출 같은 서로 다른 제품 신호를 한 지표로 합치지 않는다. baseline/target/actual을 분리하고 기간·표본/대상·정의/측정 방법을 함께 추출한다. 숫자가 없는 칸은 빈 문자열.
우선순위 impact/effort는 원문에 1~5 척도 점수가 명시된 경우만 그대로 기록하고 priorityQuote에 해당 문장을 복사한다. 추정 좌표는 금지.
자료에 없는 RICE 점수·가설·검증·로드맵·성과를 형식상 채우지 않는다. 회의 참여를 리드/조율 성과로 확대하지 않는다.
PRD는 범위·정책·인수 조건, 회의록은 대안·결정·담당자, 리서치는 발화·패턴·한계, 지표 보고서는 정의·기간·대상·관찰값을 우선 읽는다.
`;

export const PM_JOB_DATA_SCHEMA = JSON.stringify({
  pmWorkProducts: PM_WORK_PRODUCT_SCHEMA,
  problemSignal: '', hypothesis: '', successCriteria: '', decision: '', alternatives: '',
  stakeholders: '', obstacle: '', resolution: '', validation: '', impact: '', effort: '', priorityQuote: '',
  pmEvidence: [{
    dimension: 'discovery|prioritization|delivery|validation|outcome|learning',
    claim: '', quote: '', source: '', stage: 'planned|executed|observed|changed|unknown',
    ownership: '본인 역할이 원문에 있을 때만', limitation: '', missingEvidence: '',
  }],
  pmMetrics: [{ name: '', baseline: '', target: '', actual: '', unit: '', period: '', population: '', method: '', quote: '', source: '', limitation: '' }],
});
