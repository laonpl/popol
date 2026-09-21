// Typed PM work products. Each row has its own source excerpt, not a synthetic score.
export const PM_WORK_PRODUCT_FIELDS = {
  research: ['segment', 'observation', 'insight', 'opportunity', 'limitation'],
  businessModel: ['customer', 'payer', 'value', 'revenue', 'cost', 'tradeoff'],
  metricLinks: ['driver', 'outcome', 'relationship', 'measurement', 'guardrail'],
  serviceBlueprint: ['step', 'customerAction', 'frontstage', 'backstage', 'system', 'exception'],
  releases: ['milestone', 'scope', 'dependency', 'gate', 'status'],
  risks: ['risk', 'trigger', 'mitigation', 'owner', 'result'],
  problems: ['user', 'context', 'signal', 'problem', 'businessReason'],
  alternatives: ['option', 'disposition', 'criterion', 'tradeoff', 'reason'],
  journey: ['step', 'actor', 'before', 'after', 'exception'],
  requirements: ['requirement', 'rule', 'acceptance', 'owner'],
  experiments: ['hypothesis', 'method', 'successCriteria', 'observation', 'decision'],
  collaboration: ['stakeholder', 'disagreement', 'myAction', 'agreement'],
  troubleshooting: ['issue', 'cause', 'change', 'result', 'learning'],
};
export const PM_WORK_PRODUCT_LIMITS = { research: 3, businessModel: 2, metricLinks: 4, serviceBlueprint: 5, releases: 4, risks: 3, problems: 2, alternatives: 4, journey: 6, requirements: 4, experiments: 3, collaboration: 3, troubleshooting: 3 };
export const PM_WORK_PRODUCT_SCHEMA = Object.fromEntries(Object.entries(PM_WORK_PRODUCT_FIELDS).map(([key, fields]) => [key, [Object.fromEntries([...fields.map(field => [field, '']), ['quote', ''], ['source', ''], ['stage', 'planned|executed|observed|changed|unknown']])]]));
export const PM_WORK_PRODUCT_GUIDE = `
[PM 핵심 경험은 실제 작업 산출물로 추출 — jobData.pmWorkProducts]
이 구조는 단일 기업의 정답이 아니다. 당근 광고의 다면 가치 균형, 쿠팡 SCM의 운영·명세·인수 검증, 채널톡의 NSM/선행지표·GTM, 네이버웹툰의 세그먼트·리텐션 실험, LY의 신규사업·서비스 생애주기, Atlassian의 고객·실질 결과·협업 관점을 구분해 적용한다.
시니어 공고의 조직 총괄 범위를 신입에게 요구하지 않는다. 작은 프로젝트는 직접 발견하고 검증한 범위만 보여준다. 출시 전이라면 실험 학습·정책 설계가 결과이며 매출 성과를 꾸미지 않는다.
자료에 맞는 모듈만 선택해 채워라. 모든 배열을 채우지 말고 가장 중요한 산출물 3~5종을 깊이 추출한다. 같은 내용을 새 배열과 기존 배열에 중복하지 않는다. 사용자 흐름에 운영 주체가 기록돼 있으면 journey 대신 serviceBlueprint를 사용한다.
추가 모듈:
- research: segment 실제 조사 대상/구간, observation 관찰, insight 해석, opportunity 그 근거에서 정한 기회, limitation 표본·반례·한계. 가상의 페르소나를 만들지 않는다.
- businessModel: customer 사용자, payer 비용 부담 주체, value 전달 가치, revenue 수익/사업 기여 경로, cost 비용·운영 부담, tradeoff 서로 충돌하는 가치. 가상의 가격·시장규모를 넣지 않는다.
- metricLinks: driver 선행지표/행동, outcome 연결된 결과지표, relationship 원문에 설명된 관계(가설은 가설이라고 표시), measurement 이벤트/분모/관찰 방식, guardrail 함께 지켜야 할 품질·비용 지표. 실제 관계가 기록된 경우만 추출하고 임의 NSM 트리를 만들지 않는다. 수치 실적은 pmMetrics에만 저장한다.
- serviceBlueprint: 원문의 순서대로 step, customerAction 사용자 행동, frontstage 접점/화면, backstage 운영자·파트너의 처리, system 시스템 지원, exception 실패·권한·예외. 역할이 미기록이면 빈값, 연결을 창작하지 않는다.
- releases: milestone 실제 계획/출시 이정표, scope 포함·제외 범위, dependency 선행 의존성, gate 인수·출시 기준, status 원문 상태. 임의 날짜·간트 기간·완료 상태를 만들지 않는다.
- risks: risk 사업·운영·신뢰 위험, trigger 발생 조건, mitigation 대응, owner 본인/팀 책임, result 실제 확인 결과(계획은 빈값). 법규 준수를 AI가 인증하지 않는다.
각 경험은 하나의 제품 문제/개선 프로젝트 단위다. 아래 배열의 항목은 해당 경험에서 실제로 수행한 작업만 담는다.
1. problems(최대2): user 대상 고객, context 사용 맥락, signal 인터뷰/VOC/로그의 관찰, problem 정의한 문제, businessReason 지금 해결할 사업적 이유.
2. alternatives(최대4): option 실제 검토 대안, disposition 채택/보류/기각/검토중(원문 없으면 미확인), criterion 판단 기준, tradeoff 얻는 것과 감수한 제약, reason 선택/제외 이유. RICE나 임의 점수로 채우지 않는다.
3. journey(최대6): 실제 사용자/운영 흐름 순서대로 step 단계명, actor 행동 주체, before 기존 행동/막힌 지점, after 설계·변경한 행동, exception 실패/권한/빈 상태 예외. 자료에 있는 순서만 표현하며 순서가 없으면 이 배열은 비운다. 화면을 그렸다는 말만으로 사용자 흐름을 창작하지 않는다. after는 설계안일 수 있고 출시 성과를 뜻하지 않는다.
4. requirements(최대4): requirement 요구사항 이름, rule 조건·분기·권한·처리 정책, acceptance 테스트 가능한 인수 기준, owner 직접 책임진 범위. PRD·정책 문서에서 구체적인 규칙을 추출한다. 'PRD 작성'이라는 활동명만 있으면 세부 규칙을 만들지 않는다.
5. experiments(최대3): hypothesis 검증 가설, method 방법/대상/기간, successCriteria 사전 성공·실패 기준, observation 실제 관찰(계획만 있으면 빈값), decision 관찰 후 채택·수정·중단. 출시 전 실험 계획은 stage=planned, observation="".
6. collaboration(최대3): stakeholder 실제 협업 직군/관계자, disagreement 이견·의존성·제약, myAction 본인이 조율한 행동, agreement 합의 내용. 참여 사실만으로 리드했다고 쓰지 않는다.
7. troubleshooting(최대3): issue 출시/운영/검증 중 문제, cause 확인된 원인(추정이면 추정임을 표시), change 실제 수정, result 관찰한 결과, learning 다음 판단에 적용한 교훈. 실패나 중단한 경험도 포함한다.
각 행은 quote(연속된 원문 20~800자), source(원래 파일명/입력 구분), stage를 갖는다. 한 행의 내용은 해당 인용이 뒷받침하는 범위에 한한다. 여러 출처를 억지로 한 행에 합치지 않는다.
근거가 없는 배열은 []로 둔다. 같은 정성 요약을 모든 칸에 반복하지 않는다. pmEvidence는 대표 판단 요약, pmWorkProducts는 구체적인 산출물이므로 용도가 다르다.
정량 결과는 pmMetrics에 기준값/목표/실측/기간/대상/방법을 분리해 담고, 임의로 지표 트리·퍼널 단계·인과효과를 생성하지 않는다.
`;
