/**
 * sampleOutputData — /sample 라우트에서 쓰는 예시 산출물 데이터.
 *
 * 인사담당자 피드백 대응으로 새로 만든 필드를 전부 채운 샘플이다.
 *   jobData        직군별 경험 단위 (캠페인·의사결정·분석·실험·딜 …)
 *   decisionTrace  판단 지도 (문제판단 → 대안 → 선택기준 → 바뀐 원칙)
 *   voiceRecord    사용자의 실제 말투 보존
 *   evidenceBundle 주장 옆의 증거
 *   identitySignal 나를 보여주는 한 문장
 *   honestReview   솔직 회고 (막힌 지점·오판·한계·다시 한다면)
 *
 * ⚠️ AI 출력물이 아니라 손으로 쓴 예시다. 실제 화면과 동일한 컴포넌트로 렌더해
 *    "새 산출물이 어떻게 보이는지"를 크레딧 소모 없이 확인하는 용도.
 */

/* 전 직군 공통으로 붙는 4묶음. 직군별로 문구만 갈아끼운다. */
const record = ({ trace, quote, polished, meaning, evidence, identity, review }) => ({
  decisionTrace: trace,
  voiceRecord: { originalQuote: quote, polished, aiMeaning: meaning },
  evidenceBundle: evidence,
  identitySignal: identity,
  honestReview: review,
});

export const SAMPLE_EXPERIENCES = {
  designer: {
    label: '프로덕트 디자이너',
    stage: 'first',
    title: '온보딩 3주차 이탈 개선',
    metric: '4/5', metricLabel: '첫 과제 완료', beforeMetric: '1/5', afterMetric: '4/5',
    context: '교내 스터디 매칭 서비스에서 가입한 사람 중 절반이 첫 주에 안 들어왔다.',
    action: '가입 직후 화면을 체크리스트 카드 하나로 바꿨다.',
    result: '사용성 테스트에서 5명 중 4명이 첫 과제를 끝까지 했다. 이전엔 1명이었다.',
    learning: '화면을 예쁘게 만드는 문제가 아니라 첫 문장을 정하는 문제였다.',
    jobData: {
      painPoint: '가입 직후 화면에서 뭘 먼저 해야 할지 몰라서 그냥 나갔다',
      designDecision: '할 일을 5개 보여주던 걸 버리고 "스터디 1개 찜하기" 하나만 남겼다',
      testResult: '5명 중 4명이 첫 과제 완료 (기존 1명)',
    },
    ...record({
      trace: {
        situation: '가입자 절반이 첫 주에 안 들어왔다.',
        problemJudgment: '화면이 복잡한 게 아니라, 첫 행동이 뭔지 안 알려준 게 문제라고 봤다.',
        problemEvidence: '인터뷰 6명 중 4명이 "뭘 눌러야 하는지 몰랐다"고 했다.',
        alternatives: [
          { option: '색 대비를 높여 버튼 강조', cons: '왜 눌러야 하는지는 설명 안 됨', reasonNotChosen: '버튼을 못 본 게 아니라 이유를 모른다고 했다' },
          { option: '온보딩 튜토리얼 3단계 추가', cons: '단계가 늘어 이탈 지점이 더 생김', reasonNotChosen: '2주 안에 검증할 수 없는 규모였다' },
        ],
        decisionCriteria: [
          { criterion: '2주 안에 테스트 가능한가', why: '학기 중 프로젝트라 일정이 고정이었다' },
          { criterion: '첫 행동을 하나로 줄일 수 있는가', why: '인터뷰에서 나온 문제가 선택지 과다였다' },
        ],
        choice: '할 일 5개를 지우고 "스터디 1개 찜하기" 하나만 남겼다.',
        execution: '화면 설계와 카피는 내가 썼고, 프로토타입 제작과 테스트 진행도 직접 했다.',
        outcomeEvidence: '사용성 테스트 녹화 5건과 참가자 메모에서 확인했다.',
        changedJudgment: '색 대비 문제일 거라 생각했는데 카피 문제였다.',
        newPrinciple: '화면을 그리기 전에 첫 문장부터 검증한다.',
      },
      quote: '뭘 눌러야 되는지 모르겠어서 그냥 껐어요',
      polished: '무엇을 눌러야 할지 몰라서 그냥 종료했다',
      meaning: '문제를 화면이 아니라 사용자의 말에서 찾아 정의하는 방식',
      evidence: [
        { claim: '첫 행동을 하나로 줄여 완료율이 올랐다', type: '화면', sourceRef: 'onboarding_v2.fig', whatItProves: '변경 전후 화면 비교', ownership: '화면·카피 전부 직접 작업', status: '확보됨' },
        { claim: '사용자가 첫 행동을 몰랐다', type: '피드백', sourceRef: '사용자 인터뷰 노트 6건', whatItProves: '문제 정의의 근거', ownership: '인터뷰 진행·정리 직접', status: '확보됨' },
        { claim: '완료율 개선', type: '데이터', sourceRef: '사용성 테스트 녹화', whatItProves: '5명 중 4명 완료', ownership: '테스트 설계·진행 직접', status: '확인 필요' },
      ],
      identity: { pattern: '화면을 고치기 전에 사용자가 쓴 단어부터 확인한다', sentence: '저는 디자인을 바꾸기 전에 사람들이 쓰는 말을 먼저 봅니다', proof: '색 대비 가설을 버리고 카피 문제로 방향을 튼 판단', confidence: 'medium' },
      review: {
        struggle: '테스트 참가자를 5명밖에 못 모아서 결과를 일반화하기 어려웠다.',
        misjudgment: '색 대비 문제일 줄 알았는데 실제로는 문구가 문제였다.',
        limitation: '정량 지표로는 검증하지 못했고 정성 테스트에서 멈췄다.',
        nextTime: '프로토타입을 만들기 전에 카피 문안부터 A/B로 검증하겠다.',
      },
    }),
  },

  da: {
    label: '데이터 애널리스트',
    stage: 'newgrad',
    title: '3주차 이탈 코호트 분석',
    metric: '2.1배', metricLabel: '이탈률 격차', beforeMetric: '18%', afterMetric: '38%',
    context: '인턴으로 들어간 팀에서 3주차 이탈 원인을 아무도 특정하지 못하고 있었다.',
    action: '가입 주차별 코호트를 나눠 알림 수신 여부와 교차해봤다.',
    result: '알림 미수신 그룹의 이탈률이 2.1배 높았고, 이 결과로 알림 기본값이 on으로 바뀌었다.',
    learning: '이탈은 기능 부족이 아니라 재방문 트리거 부재 문제였다.',
    jobData: {
      hypothesis: '3주차 이탈은 알림 미수신과 관련 있다',
      method: 'SQL 코호트 분리 + 카이제곱 검정',
      finding: '알림 미수신 그룹 이탈률 38% vs 수신 그룹 18%',
      businessAction: '알림 기본값을 on으로 변경 (팀 결정, 나는 근거 제공)',
      control: '18%', variant: '38%', significance: 'p<0.05',
    },
    ...record({
      trace: {
        situation: '3주차 이탈이 반복되는데 원인 가설이 없었다.',
        problemJudgment: '기능 만족도가 아니라 재방문 트리거 문제라고 봤다.',
        problemEvidence: '이탈자 로그에서 마지막 세션 이후 앱 알림 수신 기록이 없었다.',
        alternatives: [
          { option: '기능별 사용률로 원인 찾기', cons: '이탈자는 기능을 거의 안 써서 신호가 약함', reasonNotChosen: '표본이 너무 적었다' },
          { option: '설문으로 이탈 사유 수집', cons: '이미 떠난 사용자라 응답률이 낮음', reasonNotChosen: '2주 안에 표본 확보가 불가능' },
        ],
        decisionCriteria: [
          { criterion: '기존 로그로 검증 가능한가', why: '추가 수집 없이 빠르게 답을 내야 했다' },
        ],
        choice: '알림 수신 여부를 축으로 코호트를 갈랐다.',
        execution: '쿼리 작성과 검정은 내가 했고, 지표 정의는 사수와 합의했다.',
        outcomeEvidence: '카이제곱 p<0.05, 코호트 대시보드에 기록.',
        changedJudgment: '',
        newPrinciple: '이탈 분석은 기능 사용률보다 재방문 경로부터 본다.',
      },
      quote: '기능이 별로라서 나간 게 아닌 것 같은데 확인할 방법이 없었어요',
      polished: '기능 불만이 원인은 아닌 듯했지만 확인할 방법이 없었다',
      meaning: '가설을 세우기 전에 기존 데이터로 검증 가능한지부터 따지는 습관',
      evidence: [
        { claim: '알림 미수신 그룹의 이탈률이 유의하게 높다', type: '데이터', sourceRef: 'cohort_retention.sql', whatItProves: '코호트별 이탈률 산출 과정', ownership: '쿼리 직접 작성', status: '확보됨' },
        { claim: '결과가 의사결정에 반영됨', type: '피드백', sourceRef: '스프린트 회고 노트', whatItProves: '알림 기본값 변경 결정', ownership: '근거 제공 (결정은 팀)', status: '확인 필요' },
      ],
      identity: { pattern: '추가 수집 전에 이미 있는 로그로 답이 나오는지 먼저 확인한다', sentence: '저는 새로 모으기 전에 있는 데이터부터 끝까지 봅니다', proof: '설문 대신 기존 로그 코호트로 2주 안에 결론을 낸 선택', confidence: 'medium' },
      review: {
        struggle: '알림 수신 여부와 활성 사용자 성향이 섞여 있어 인과로 단정하기 어려웠다.',
        misjudgment: '기능 사용률에서 답이 나올 줄 알았는데 신호가 거의 없었다.',
        limitation: '상관까지만 확인했고 A/B로 인과 검증은 못 했다.',
        nextTime: '알림 기본값을 바꿀 때 실험군을 나눠 인과까지 확인하겠다.',
      },
    }),
  },

  pm: {
    label: '기획자 / PM',
    stage: 'first',
    title: '첫 화면 CTA 단일화 결정',
    metric: '4/5', metricLabel: '첫 과제 완료',
    context: '팀 안에서 첫 화면에 기능을 더 넣자는 의견과 줄이자는 의견이 갈렸다.',
    action: '인터뷰 원문을 근거로 CTA를 하나로 줄이는 쪽을 제안하고 합의를 받았다.',
    result: '사용성 테스트에서 완주율이 올랐고, 다음 스프린트 기준으로 채택됐다.',
    learning: '설득은 내 주장이 아니라 사용자 문장을 보여줄 때 됐다.',
    jobData: {
      hypothesis: '사용자는 첫 화면에서 할 일이 하나면 끝까지 한다',
      decision: '홈 상단을 찜하기 단일 CTA로 변경',
      alternatives: '튜토리얼 3단계 추가 — 일정 초과로 기각',
      stakeholders: '개발 2명에게 인터뷰 원문을 근거로 설득',
      validation: '사용성 테스트 5명',
      impact: 4, effort: 2,
    },
    ...record({
      trace: {
        situation: '첫 화면 구성을 두고 팀 의견이 갈렸다.',
        problemJudgment: '기능 개수가 아니라 첫 행동의 모호함이 문제라고 봤다.',
        problemEvidence: '인터뷰 6건 중 4건에서 같은 표현이 반복됐다.',
        alternatives: [
          { option: '기능 3개를 균등 배치', cons: '선택지가 늘어 결정 비용 증가', reasonNotChosen: '문제가 선택지 과다였다' },
          { option: '튜토리얼 3단계 추가', cons: '개발 공수 2주 초과', reasonNotChosen: '학기 일정 안에 검증 불가' },
        ],
        decisionCriteria: [
          { criterion: '2주 안에 검증 가능한가', why: '남은 스프린트가 하나였다' },
          { criterion: '되돌리기 쉬운가', why: '틀렸을 때 복구 비용을 낮추고 싶었다' },
        ],
        choice: 'CTA를 찜하기 하나로 줄였다.',
        execution: '기획안 작성과 팀 설득은 내가 했고, 구현은 개발 2명이 맡았다.',
        outcomeEvidence: '사용성 테스트 5건 기록.',
        changedJudgment: '기능을 더 보여주면 더 쓸 거라 생각했는데 반대였다.',
        newPrinciple: '기능을 더할지 말지는 선택지 개수부터 본다.',
      },
      quote: '이거 다 뭐 하는 건지 모르겠어서 일단 나갔어요',
      polished: '각 기능이 무엇인지 몰라서 일단 나갔다',
      meaning: '팀 내 의견 충돌을 사용자 발화로 환원해 정리하는 방식',
      evidence: [
        { claim: '첫 행동 모호함이 이탈 원인', type: '피드백', sourceRef: '사용자 인터뷰 노트 6건', whatItProves: '반복된 표현 4건', ownership: '인터뷰 직접 진행', status: '확보됨' },
        { claim: '팀 합의 도출', type: '기획서', sourceRef: '스프린트 기획안 v3', whatItProves: '대안 비교와 최종 결정 근거', ownership: '문서 직접 작성', status: '확보됨' },
      ],
      identity: { pattern: '주장 대신 사용자 문장을 근거로 합의를 만든다', sentence: '저는 제 의견보다 사용자가 한 말을 먼저 꺼냅니다', proof: '개발 2명을 인터뷰 원문으로 설득한 과정', confidence: 'low' },
      review: {
        struggle: '개발 공수를 내가 잘못 추정해서 첫 제안이 한 번 반려됐다.',
        misjudgment: '기능을 더 보여주면 더 쓸 줄 알았는데 반대였다.',
        limitation: '표본 5명이라 팀 안에서도 근거가 약하다는 지적이 있었다.',
        nextTime: '제안 전에 개발자와 공수부터 맞춰보고 들어가겠다.',
      },
    }),
  },

  devops: {
    label: '인프라 / 데브옵스',
    stage: 'experienced',
    title: '배포 직후 로그인 API 장애 대응',
    metric: '8분', metricLabel: 'MTTR', beforeMetric: '42분', afterMetric: '8분',
    context: '금요일 야간 배포 후 로그인 API가 5분간 502를 반환했다. 피크 시간 동시 접속 4천 명 규모였다.',
    action: '커넥션 풀 상한을 올리고 헬스체크 지연을 조정한 뒤, 롤백 스크립트를 자동화했다.',
    result: '동일 유형 장애의 평균 복구 시간이 42분에서 8분으로 줄었다.',
    learning: '오토스케일 설정만 보고 풀 상한을 같이 안 본 게 원인이었다.',
    jobData: {
      incident: '금요일 배포 후 로그인 API 5분간 502',
      rootCause: '커넥션 풀 상한이 새로 뜬 인스턴스 수를 따라가지 못함',
      actionTaken: '풀 상한 상향, 헬스체크 지연 조정, 롤백 스크립트 자동화',
      impact: 'MTTR 42분 → 8분',
    },
    ...record({
      trace: {
        situation: '배포 직후 로그인 API가 502를 반환했다.',
        problemJudgment: '애플리케이션 버그가 아니라 인스턴스 증설과 커넥션 풀 상한의 불일치라고 판단했다.',
        problemEvidence: 'APM에서 앱 에러율은 정상인데 DB 커넥션 대기 큐만 급증했다.',
        alternatives: [
          { option: '즉시 전체 롤백', cons: '원인 미상인 채로 재발 가능', reasonNotChosen: '같은 배포가 다음 주에 다시 나가야 했다' },
          { option: 'DB 인스턴스 스케일업', cons: '월 비용 증가, 근본 원인 아님', reasonNotChosen: '병목이 DB 성능이 아니라 풀 설정이었다' },
        ],
        decisionCriteria: [
          { criterion: '재발을 막는 조치인가', why: '같은 배포가 반복 예정이었다' },
          { criterion: '비용 증가 없이 가능한가', why: '인프라 예산이 분기 한도에 근접해 있었다' },
        ],
        choice: '풀 상한을 인스턴스 수에 연동하고 헬스체크 지연을 늘렸다.',
        execution: '원인 분석과 설정 변경은 내가 단독으로, 롤백 자동화는 팀 2명과 함께 했다.',
        outcomeEvidence: '이후 동일 유형 인시던트 3건의 복구 로그.',
        changedJudgment: '배포 체크리스트가 앱 레벨만 보고 있었다는 걸 이때 알았다.',
        newPrinciple: '오토스케일 변경 시 연결 자원 상한을 항상 같이 검토한다.',
      },
      quote: '앱은 멀쩡한데 왜 502가 나는지 처음엔 아무도 몰랐어요',
      polished: '애플리케이션은 정상인데 502가 발생하는 원인을 초기에 특정하지 못했다',
      meaning: '증상 레이어와 원인 레이어를 분리해 좁혀가는 디버깅 방식',
      evidence: [
        { claim: '병목은 DB 성능이 아니라 커넥션 풀 설정', type: '그래프', sourceRef: 'APM 커넥션 대기 큐 대시보드', whatItProves: '에러율 정상 / 대기 큐 급증', ownership: '분석 직접', status: '확보됨' },
        { claim: 'MTTR 개선', type: '데이터', sourceRef: '인시던트 리포트 3건', whatItProves: '복구 시간 42분 → 8분', ownership: '리포트 작성 직접', status: '확보됨' },
        { claim: '롤백 자동화', type: '코드', sourceRef: 'rollback.yml', whatItProves: '자동 롤백 파이프라인', ownership: '설계 주도, 구현은 공동', status: '확보됨' },
      ],
      identity: { pattern: '증상이 난 레이어와 원인 레이어를 먼저 분리한다', sentence: '저는 증상이 보이는 곳부터 의심하지 않습니다', proof: '앱 롤백 대신 커넥션 풀 상한으로 원인을 좁힌 판단', confidence: 'high' },
      review: {
        struggle: '금요일 야간이라 의사결정권자와 연락이 닿지 않아 롤백 여부를 혼자 판단해야 했다.',
        misjudgment: '오토스케일만 보면 된다고 생각했는데 연결 자원 상한이 빠져 있었다.',
        limitation: '헬스체크 지연을 늘린 만큼 장애 감지가 느려지는 트레이드오프가 남아 있다.',
        nextTime: '배포 체크리스트에 연결 자원 상한 항목을 넣고, 야간 배포 승인 기준을 문서화하겠다.',
      },
    }),
  },

  hr: {
    label: '인사 / 채용',
    stage: 'experienced',
    title: '신입 온보딩 프로그램 재설계',
    metric: '88%', metricLabel: '3개월 리텐션', beforeMetric: '71%', afterMetric: '88%',
    context: '입사 3개월 내 조기 퇴사가 2개 분기 연속 반복됐다.',
    action: '2주 버디 제도와 4주차 1:1 체크인을 설계하고 직접 운영했다.',
    result: '3개월 리텐션이 71%에서 88%로 올랐다.',
    learning: '퇴사 사유는 업무 난이도가 아니라 초기 소속감 부재였다.',
    jobData: {
      goal: '입사 3개월 내 조기 퇴사가 반복됨',
      program: '2주 버디 제도 + 4주차 1:1 체크인 설계·운영',
      funnelChange: '3개월 리텐션 71% → 88%',
    },
    ...record({
      trace: {
        situation: '조기 퇴사가 2개 분기 연속 발생했다.',
        problemJudgment: '업무 난이도가 아니라 초기 관계 형성 실패가 원인이라고 봤다.',
        problemEvidence: '퇴사 인터뷰 9건 중 6건에서 "물어볼 사람이 없었다"는 표현이 나왔다.',
        alternatives: [
          { option: '온보딩 교육 콘텐츠 확대', cons: '정보량은 늘지만 관계는 안 생김', reasonNotChosen: '퇴사 사유가 정보 부족이 아니었다' },
          { option: '수습 기간 연장', cons: '불안감 증가', reasonNotChosen: '리텐션 개선과 무관하다고 판단' },
        ],
        decisionCriteria: [
          { criterion: '현업 부담을 얼마나 늘리는가', why: '팀장들의 반발이 예상됐다' },
        ],
        choice: '버디 제도와 정기 1:1을 도입했다.',
        execution: '제도 설계와 팀장 설득은 내가 주도했고, 운영은 각 팀과 분담했다.',
        outcomeEvidence: '분기 리텐션 리포트와 버디 만족도 설문.',
        changedJudgment: '교육 콘텐츠를 늘리는 게 답일 거라 생각했는데 아니었다.',
        newPrinciple: '온보딩 문제는 정보량보다 관계 경로부터 본다.',
      },
      quote: '모르는 걸 누구한테 물어봐야 할지를 몰랐어요',
      polished: '궁금한 점을 누구에게 물어야 할지 알기 어려웠다',
      meaning: '제도를 만들기 전에 퇴사자의 표현에서 원인을 정의하는 방식',
      evidence: [
        { claim: '초기 관계 부재가 조기 퇴사 원인', type: '피드백', sourceRef: '퇴사 인터뷰 기록 9건', whatItProves: '반복 표현 6건', ownership: '인터뷰 직접 진행', status: '확보됨' },
        { claim: '리텐션 개선', type: '데이터', sourceRef: '분기 리텐션 리포트', whatItProves: '71% → 88%', ownership: '집계 직접', status: '확보됨' },
      ],
      identity: { pattern: '제도를 설계하기 전에 떠난 사람의 말부터 모은다', sentence: '저는 제도보다 사람들이 실제로 막힌 지점을 먼저 찾습니다', proof: '교육 확대 대신 관계 경로를 택한 판단', confidence: 'high' },
      review: {
        struggle: '팀장 3명이 버디 제도를 추가 업무로 받아들여 초기 참여율이 낮았다.',
        misjudgment: '교육 콘텐츠를 늘리면 될 줄 알았는데 관계 문제였다.',
        limitation: '리텐션 개선에 채용 기준 변경 효과가 섞여 있어 프로그램 단독 효과는 분리하지 못했다.',
        nextTime: '제도 도입 전후로 팀별 대조군을 나눠 효과를 분리해 보겠다.',
      },
    }),
  },

  sales: {
    label: 'B2B 세일즈',
    stage: 'experienced',
    title: '제조사 A사 파일럿 전환 계약',
    metric: '4,800만원', metricLabel: '연 계약 규모',
    context: '수기 집계 공정을 쓰던 중견 제조사가 연 단위 결제에 부담을 느껴 3개월간 멈춰 있던 딜이었다.',
    action: '분기 결제와 3개월 파일럿으로 구조를 바꿔 재제안했다.',
    result: '파일럿 후 연 4,800만원 규모로 계약이 체결됐다.',
    learning: '가격이 아니라 실패했을 때의 리스크가 걸림돌이었다.',
    jobData: {
      client: '제조 중견기업 A사',
      approach: '수기 집계 공정을 대시보드로 치환하는 시나리오로 제안',
      negotiation: '연 단위 결제 부담 → 분기 결제 + 3개월 파일럿으로 전환',
      dealSize: '4,800만원',
      stage: '계약',
    },
    ...record({
      trace: {
        situation: '3개월간 진전이 없던 딜이었다.',
        problemJudgment: '가격 저항이 아니라 도입 실패 리스크가 진짜 장벽이라고 봤다.',
        problemEvidence: '실무 담당자가 "위에 보고할 근거가 없다"고 반복해서 말했다.',
        alternatives: [
          { option: '20% 할인 제안', cons: '마진 훼손, 재계약 시 기준가 하락', reasonNotChosen: '가격이 원인이 아니라고 판단했다' },
          { option: '경쟁사 비교 자료 보강', cons: '이미 비교는 끝난 단계', reasonNotChosen: '의사결정 단계가 달랐다' },
        ],
        decisionCriteria: [
          { criterion: '고객이 내부 보고에 쓸 근거가 생기는가', why: '실무자가 승인권자를 설득해야 하는 구조였다' },
          { criterion: '마진을 지키는가', why: '분기 목표에 직접 영향이 있었다' },
        ],
        choice: '3개월 파일럿과 분기 결제로 리스크를 쪼갰다.',
        execution: '제안 구조 설계와 협상은 단독으로, 파일럿 범위는 CS팀과 합의했다.',
        outcomeEvidence: '계약서와 파일럿 종료 리포트.',
        changedJudgment: '멈춘 딜은 가격 문제라고 넘겨짚었는데 아니었다.',
        newPrinciple: '멈춘 딜은 할인 전에 의사결정 구조부터 확인한다.',
      },
      quote: '위에 보고할 근거가 없어서 저도 못 밀어붙이겠어요',
      polished: '내부 보고에 쓸 근거가 없어 추진하기 어렵다',
      meaning: '고객사 내부의 의사결정 구조를 파악해 제안 형태를 바꾸는 방식',
      evidence: [
        { claim: '장벽은 가격이 아니라 도입 리스크', type: '피드백', sourceRef: '미팅 노트 4회차', whatItProves: '반복된 보고 근거 부재 언급', ownership: '미팅 진행·기록 직접', status: '확보됨' },
        { claim: '계약 체결', type: '데이터', sourceRef: '계약서 / 파일럿 종료 리포트', whatItProves: '연 4,800만원 규모', ownership: '협상 단독 진행', status: '확보됨' },
      ],
      identity: { pattern: '멈춘 딜에서 가격 대신 의사결정 구조를 먼저 본다', sentence: '저는 깎아주기 전에 고객이 누구를 설득해야 하는지를 봅니다', proof: '할인 대신 파일럿으로 구조를 바꾼 판단', confidence: 'high' },
      review: {
        struggle: '파일럿 범위를 좁히는 과정에서 CS팀과 리소스 배분을 두고 두 번 조율이 깨졌다.',
        misjudgment: '멈춘 딜이라 가격 문제일 거라고 처음엔 넘겨짚었다.',
        limitation: '파일럿 전환 방식이 다른 딜에서도 통하는지는 아직 표본이 이 건 하나뿐이다.',
        nextTime: '파일럿 리소스 기준을 먼저 문서로 합의하고 제안에 들어가겠다.',
      },
    }),
  },

  aiml: {
    label: 'AI / ML 엔지니어',
    stage: 'newgrad',
    title: '이탈 예측 모델 경량화',
    metric: '0.82', metricLabel: 'F1', beforeMetric: '0.74', afterMetric: '0.82',
    context: '이탈 예측 배치가 매일 새벽 2시간씩 돌아 운영팀 확인이 늦어졌다.',
    action: 'RandomForest 대신 LightGBM으로 바꾸고 피처를 12개로 줄였다.',
    result: 'F1이 0.74에서 0.82로 올랐고 학습 시간은 30분 줄었다.',
    learning: '피처를 늘릴수록 좋아질 거라는 가정이 틀렸다.',
    jobData: {
      dataset: '사내 이용 로그 12만 건',
      model: 'LightGBM',
      whyModel: 'RandomForest 대비 학습 30분 단축, 피처 중요도 해석이 쉬움',
      metrics: [{ name: 'F1', value: '0.82', baseline: '0.74' }, { name: 'AUC', value: '0.89' }],
    },
    ...record({
      trace: {
        situation: '배치 학습이 2시간 걸려 운영 확인이 늦어졌다.',
        problemJudgment: '모델 성능보다 피처 수에서 오는 학습 비용이 문제라고 봤다.',
        problemEvidence: '피처 중요도 상위 12개가 전체 기여도의 대부분을 차지했다.',
        alternatives: [
          { option: '학습 인스턴스 스케일업', cons: '비용 증가, 근본 개선 아님', reasonNotChosen: '피처 과다가 원인이라고 봤다' },
          { option: '딥러닝 모델로 교체', cons: '해석 어려움, 운영팀이 근거를 못 봄', reasonNotChosen: '운영팀이 예측 근거를 확인해야 했다' },
        ],
        decisionCriteria: [
          { criterion: '운영팀이 예측 근거를 볼 수 있는가', why: '이탈 예측 결과로 직접 연락을 돌리는 구조였다' },
        ],
        choice: 'LightGBM + 상위 12개 피처로 재학습했다.',
        execution: '피처 선택과 학습은 내가, 배치 파이프라인 반영은 사수와 함께 했다.',
        outcomeEvidence: '실험 기록표와 배치 실행 로그.',
        changedJudgment: '피처를 늘릴수록 좋아질 거라 생각했는데 아니었다.',
        newPrinciple: '성능을 올리기 전에 기여도 낮은 피처부터 덜어낸다.',
      },
      quote: '피처를 계속 넣었는데 어느 순간부터 안 좋아지더라고요',
      polished: '피처를 추가했지만 일정 시점부터 성능이 개선되지 않았다',
      meaning: '가정을 실험 기록으로 반증하고 방향을 바꾸는 방식',
      evidence: [
        { claim: '피처 12개로 성능·속도 동시 개선', type: '데이터', sourceRef: '실험 기록 시트', whatItProves: 'F1 0.74 → 0.82, 학습 30분 단축', ownership: '실험 설계·수행 직접', status: '확보됨' },
        { claim: '운영 반영', type: '코드', sourceRef: 'batch_predict.py', whatItProves: '배치 파이프라인 적용', ownership: '모델 부분 직접, 파이프라인은 공동', status: '확보됨' },
      ],
      identity: { pattern: '더하기 전에 빼보고 실험 기록으로 판단한다', sentence: '저는 성능을 올릴 때 먼저 덜어내 봅니다', proof: '피처 확대 가정을 실험으로 뒤집은 과정', confidence: 'medium' },
      review: {
        struggle: '피처를 줄이자 특정 세그먼트에서만 성능이 떨어져 원인을 찾는 데 오래 걸렸다.',
        misjudgment: '피처가 많을수록 좋아질 거라 생각했다.',
        limitation: '신규 가입 코호트에서는 아직 검증하지 못했다.',
        nextTime: '피처를 덜어낼 때 세그먼트별 성능을 같이 보겠다.',
      },
    }),
  },

  marketer: {
    label: '마케터',
    stage: 'first',
    title: '개강 시즌 시간표 인증 챌린지',
    metric: '6.2%', metricLabel: '가입 전환율',
    context: '동아리 서비스 홍보 예산이 30만원뿐이었다.',
    action: '광고 대신 에브리타임과 인스타그램에서 시간표 인증 챌린지를 돌렸다.',
    result: '게시물 유입에서 가입 전환율 6.2%가 나왔다.',
    learning: '노출을 늘리는 것보다 인증할 이유를 만드는 게 효율이 높았다.',
    jobData: {
      target: '수도권 대학생 1~2학년',
      channels: ['인스타그램', '에브리타임'],
      creative: '시간표 인증 챌린지',
      kpis: [{ name: '가입 전환', value: '6.2%' }, { name: '참여 게시물', value: '84건' }],
    },
    ...record({
      trace: {
        situation: '홍보 예산이 30만원으로 제한돼 있었다.',
        problemJudgment: '노출 부족이 아니라 공유할 이유가 없는 게 문제라고 봤다.',
        problemEvidence: '이전 게시물은 도달은 났는데 저장·공유가 거의 없었다.',
        alternatives: [
          { option: '인스타 광고 집행', cons: '예산 대비 도달이 짧고 끝나면 0', reasonNotChosen: '30만원으로는 지속이 안 됐다' },
          { option: '학과 단톡방 홍보', cons: '스팸으로 인식될 위험', reasonNotChosen: '기존 시도에서 반응이 나빴다' },
        ],
        decisionCriteria: [
          { criterion: '사용자가 스스로 올릴 이유가 있는가', why: '예산 없이 확산되려면 그것뿐이었다' },
        ],
        choice: '시간표 인증 챌린지로 사용자 게시물을 유도했다.',
        execution: '기획·콘텐츠 제작·운영을 혼자 했고, 경품은 동아리 예산으로 처리했다.',
        outcomeEvidence: '참여 게시물 84건과 유입 링크 클릭 기록.',
        changedJudgment: '도달만 늘리면 될 줄 알았는데 저장·공유가 핵심이었다.',
        newPrinciple: '예산이 없을 땐 노출보다 올릴 이유부터 설계한다.',
      },
      quote: '광고는 돈 떨어지면 그냥 끝나잖아요',
      polished: '광고는 예산이 소진되면 효과가 함께 끊긴다',
      meaning: '지속 가능한 확산 구조를 기준으로 채널을 고르는 방식',
      evidence: [
        { claim: '사용자 게시물로 확산', type: '화면', sourceRef: '참여 게시물 캡처 84건', whatItProves: '자발적 인증 참여', ownership: '기획·운영 직접', status: '확보됨' },
        { claim: '가입 전환 6.2%', type: '데이터', sourceRef: '유입 링크 클릭·가입 집계 시트', whatItProves: '채널별 전환율', ownership: '집계 직접', status: '확인 필요' },
      ],
      identity: { pattern: '예산이 없을수록 사용자가 움직일 이유부터 설계한다', sentence: '저는 돈으로 노출을 사기 전에 올릴 이유를 먼저 만듭니다', proof: '광고 대신 인증 챌린지를 택한 판단', confidence: 'low' },
      review: {
        struggle: '초반 2주는 참여가 5건뿐이라 중간에 경품 구성을 한 번 갈아엎었다.',
        misjudgment: '도달을 늘리면 가입도 늘 줄 알았는데 저장·공유가 핵심이었다.',
        limitation: '전환율은 자체 집계라 유입 경로가 겹치는 부분을 걸러내지 못했다.',
        nextTime: '채널별 링크를 분리해 유입을 정확히 나눠 보겠다.',
      },
    }),
  },

  dev: {
    label: '개발자 (FE/BE)',
    stage: 'newgrad',
    title: '공지 목록 조회 응답 개선',
    metric: '310ms', metricLabel: '평균 응답', beforeMetric: '1.4s', afterMetric: '310ms',
    context: '공지 목록 화면이 느리다는 제보가 반복됐다. 학기 초 동시 접속이 몰릴 때 특히 심했다.',
    action: 'N+1 쿼리를 조인으로 바꾸고 목록 응답에 캐시를 붙였다.',
    result: '평균 응답이 1.4초에서 310ms로 줄었다.',
    learning: '느린 원인이 렌더링이라고 생각했는데 쿼리 횟수였다.',
    jobData: {},
    ...record({
      trace: {
        situation: '학기 초에 공지 목록이 눈에 띄게 느려졌다.',
        problemJudgment: '프론트 렌더링이 아니라 서버 쿼리 횟수가 문제라고 봤다.',
        problemEvidence: '요청 1건에 쿼리가 40회 넘게 찍혔다.',
        alternatives: [
          { option: '프론트에서 가상 스크롤 적용', cons: '서버 부하는 그대로', reasonNotChosen: '병목이 서버였다' },
          { option: '페이지 크기 축소', cons: '사용자가 더 많이 스크롤해야 함', reasonNotChosen: '근본 원인이 아니었다' },
        ],
        decisionCriteria: [
          { criterion: '학기 초 트래픽에서도 견디는가', why: '피크가 명확한 서비스였다' },
        ],
        choice: 'N+1을 조인으로 바꾸고 목록에 캐시를 붙였다.',
        execution: '쿼리 개선은 내가 했고, 캐시 무효화 정책은 사수와 정했다.',
        outcomeEvidence: '개선 전후 APM 응답 시간 그래프.',
        changedJudgment: '렌더링 문제로 넘겨짚고 프론트부터 본 게 시간 낭비였다.',
        newPrinciple: '느리다는 제보가 오면 쿼리 로그부터 확인한다.',
      },
      quote: '공지 누르면 한참 기다려야 돼요',
      polished: '공지를 선택한 뒤 대기 시간이 길다',
      meaning: '체감 증상을 계측 지표로 옮겨 확인하는 습관',
      evidence: [
        { claim: '병목은 쿼리 횟수', type: '그래프', sourceRef: 'APM 쿼리 로그', whatItProves: '요청당 40회 이상 쿼리', ownership: '분석 직접', status: '확보됨' },
        { claim: '응답 개선', type: '코드', sourceRef: 'NoticeRepository.java', whatItProves: 'N+1 → 조인 변경', ownership: '직접 작성', status: '확보됨' },
      ],
      identity: { pattern: '체감 문제를 먼저 숫자로 바꿔 확인한다', sentence: '저는 느리다는 말을 들으면 로그부터 켭니다', proof: '프론트 가설을 버리고 쿼리 로그로 원인을 좁힌 과정', confidence: 'medium' },
      review: {
        struggle: '캐시를 붙인 뒤 공지 수정이 바로 반영되지 않아 무효화 정책을 다시 잡았다.',
        misjudgment: '렌더링이 느린 줄 알고 프론트부터 봤다.',
        limitation: '캐시 무효화가 아직 시간 기반이라 즉시 반영은 안 된다.',
        nextTime: '캐시를 붙이기 전에 무효화 시나리오부터 정리하겠다.',
      },
    }),
  },
};

export const SAMPLE_JOBS = Object.entries(SAMPLE_EXPERIENCES).map(([value, v]) => ({
  value, label: v.label, stage: v.stage,
}));

/**
 * 구성 계획(composition plan) 예시 — 같은 경험이 지원처에 따라 어떻게 다르게 조립되는지.
 * 실제로는 POST /job/compose-experience 가 이 모양의 JSON을 돌려준다.
 */
export const SAMPLE_PLANS = {
  hr: [
    {
      target: '전용 변형 없는 직군 — 데이터 주도 레시피',
      plan: {
        narrative: 'process-first',
        narrativeReason: '단일 성과보다 온보딩 프로그램을 설계·운영한 절차 자체가 강점입니다.',
        artifactVariant: '',
        artifactRecipe: {
          kicker: 'ONBOARDING PROGRAM', title: '입사 3개월을 버티게 만든 설계', badge: '3 STEPS', tone: 'forest',
          blocks: [
            { type: 'process', title: '버디 → 체크인 → 정착', span: 'main' },
            { type: 'compare', title: '리텐션 변화', span: 'side' },
          ],
        },
        artifactReason: '프로그램 설계 절차가 핵심이라 프로세스 흐름을 크게, 리텐션 변화를 옆에 붙였습니다.',
        headline: '조기 퇴사를 막은 건 교육이 아니라 물어볼 사람이었다',
        sections: [
          { source: 'process', title: '버디 제도와 4주차 1:1', emphasis: 'high', why: '제도 설계가 핵심 역량' },
          { source: 'decisionTrace', title: '왜 교육 확대를 접었나', emphasis: 'high', why: '대안 기각 근거' },
          { source: 'portfolioVisuals', title: '3개월 리텐션 변화', emphasis: 'normal', why: '결과 확인' },
          { source: 'honestReview', title: '효과를 분리하지 못했다', emphasis: 'normal', why: '측정 한계 명시' },
        ],
        keyExperienceOrder: [0], omitted: [], jdAlignment: [],
      },
    },
    {
      target: '같은 직군, 채용 퍼널 경험이면',
      plan: {
        narrative: 'outcome-first',
        narrativeReason: '퍼널 단계별 전환 수치가 뚜렷해 결과를 앞세웠습니다.',
        artifactVariant: '',
        artifactRecipe: {
          kicker: 'HIRING FUNNEL', title: '지원 1,240명에서 최종 12명까지', badge: '', tone: 'navy',
          blocks: [
            { type: 'funnel', title: '채용 퍼널', span: 'main' },
            { type: 'kpis', title: '리드타임 지표', span: 'side' },
          ],
        },
        artifactReason: '같은 HR이어도 퍼널 경험이면 단계 흐름이 가장 강한 한 장입니다.',
        headline: '서류 검토 리드타임을 12일에서 4일로',
        sections: [
          { source: 'portfolioVisuals', title: '단계별 전환', emphasis: 'high', why: '퍼널 수치가 강점' },
          { source: 'keyExperiences', title: '스크리닝 기준을 다시 짠 과정', emphasis: 'normal', why: '실행 근거' },
          { source: 'honestReview', title: '합격자 품질은 아직 못 봤다', emphasis: 'normal', why: '한계' },
        ],
        keyExperienceOrder: [0], omitted: [], jdAlignment: [],
      },
    },
  ],
  marketer: [
    {
      target: '신제품 런칭 캠페인',
      plan: {
        narrative: 'outcome-first',
        narrativeReason: 'ROAS 405%·첫 달 매출처럼 정량 성과가 뚜렷해 결과를 맨 앞에 세웠습니다.',
        artifactVariant: 'launch-dashboard',
        artifactReason: '런칭 캠페인이라 KPI 대시보드와 전환 퍼널을 한 장에 보여주는 것이 가장 강합니다.',
        headline: '1,200만원으로 만든 첫 달 매출 4,860만원',
        sections: [
          { source: 'portfolioVisuals', title: '핵심 KPI 대시보드', emphasis: 'high', why: '성과가 강점이라 수치를 먼저 노출' },
          { source: 'marketerKit', title: '타깃을 다시 정의한 지점', emphasis: 'high', why: '메시지 전환 판단이 이 캠페인의 핵심' },
          { source: 'keyExperiences', title: '소재 24종으로 찾은 승자', emphasis: 'normal', why: '실행 밀도 증명' },
          { source: 'honestReview', title: '예산이 끝나면 남는 것', emphasis: 'normal', why: '지속성 한계를 스스로 밝힘' },
        ],
        keyExperienceOrder: [0],
        omitted: [{ source: 'decisionTrace', reason: '성과 서사가 이미 판단 과정을 담고 있어 중복' }],
        jdAlignment: [],
      },
    },
    {
      target: 'CRM 리텐션 캠페인 (같은 직군, 다른 경험)',
      plan: {
        narrative: 'process-first',
        narrativeReason: '단일 성과보다 세그먼트별 3단계 여정 설계라는 과정 자체가 강점입니다.',
        artifactVariant: 'crm-journey',
        artifactReason: '휴면 고객을 단계별로 되살린 여정이라 저니 다이어그램이 구조를 가장 잘 보여줍니다.',
        headline: '휴면 고객을 5개로 나눠 재구매율을 8.1%로',
        sections: [
          { source: 'process', title: '행동 기준으로 나눈 5개 세그먼트', emphasis: 'high', why: '세그먼테이션 설계가 핵심 역량' },
          { source: 'decisionTrace', title: '같은 쿠폰을 멈춘 이유', emphasis: 'high', why: '기존 방식을 바꾼 판단 근거' },
          { source: 'portfolioVisuals', title: '재구매율과 클릭률 변화', emphasis: 'normal', why: '결과 확인' },
          { source: 'honestReview', title: '중복 접촉을 다 막지는 못했다', emphasis: 'normal', why: '남은 한계 명시' },
        ],
        keyExperienceOrder: [0],
        omitted: [{ source: 'product', reason: '자사몰 소개는 이 경험의 판단과 무관' }],
        jdAlignment: [],
      },
    },
  ],
  designer: [
    {
      target: '지원처 없음',
      plan: {
        narrative: 'problem-first',
        narrativeReason: '정량 성과가 약한 대신 문제 정의 과정이 이 경험의 가장 큰 강점입니다.',
        artifactVariant: '',
        artifactReason: '디자이너 직군은 아직 히어로 아티팩트 변형이 없습니다.',
        headline: '색 대비가 아니라 첫 문장이 문제였다',
        sections: [
          { source: 'task', title: '절반이 첫 주에 사라졌다', emphasis: 'high', why: '문제 규모를 먼저 세워야 이후 판단이 설득력을 가짐' },
          { source: 'decisionTrace', title: '왜 색 대비가 아니라 문구였나', emphasis: 'high', why: '대안을 기각한 기준이 이 지원자의 핵심 강점' },
          { source: 'keyExperiences', title: '체크리스트 하나로 줄인 첫 화면', emphasis: 'normal', why: '실행과 결과' },
          { source: 'evidenceBundle', title: '확인 가능한 자료', emphasis: 'normal', why: '주장 옆에 근거를 붙여 검증 가능하게' },
          { source: 'honestReview', title: '표본 5명으로 말할 수 있는 것', emphasis: 'normal', why: '한계를 먼저 밝혀 신뢰 확보' },
        ],
        keyExperienceOrder: [0],
        omitted: [
          { source: 'portfolioVisuals', reason: '정량 지표가 정성 테스트 수준이라 차트로 만들면 과장으로 보임' },
          { source: 'githubStats', reason: '디자이너 직군과 무관' },
        ],
        jdAlignment: [],
      },
    },
    {
      target: '토스 · 프로덕트 디자이너',
      plan: {
        narrative: 'decision-first',
        narrativeReason: '공고가 "가설 검증 경험"과 "데이터 기반 의사결정"에 가중치를 두어 판단 과정을 맨 앞으로 옮겼습니다.',
        artifactVariant: '',
        artifactReason: '디자이너 직군은 아직 히어로 아티팩트 변형이 없습니다.',
        headline: '사용자 발화에서 문제를 다시 정의해 첫 행동 완주율을 바꾼 경험',
        sections: [
          { source: 'decisionTrace', title: '가설을 버린 지점', emphasis: 'high', why: '필수요건 "가설 검증 경험"에 직접 대응' },
          { source: 'voiceRecord', title: '사용자가 실제로 한 말', emphasis: 'high', why: '인재상 "사용자 관점"을 원문으로 증명' },
          { source: 'keyExperiences', title: '체크리스트 하나로 줄인 첫 화면', emphasis: 'normal', why: '실행 역량 증명' },
          { source: 'evidenceBundle', title: '검증 자료', emphasis: 'normal', why: '우대요건 "사용성 테스트 경험" 근거' },
          { source: 'honestReview', title: '표본 5명으로 말할 수 있는 것', emphasis: 'high', why: '공고 주의사항에 "과장된 성과 경계"가 있어 앞으로 이동' },
        ],
        keyExperienceOrder: [0],
        omitted: [
          { source: 'overview', reason: '공고가 프로젝트 배경보다 판단 근거를 요구해 뒤로 밀림' },
          { source: 'competency', reason: '역량 나열은 공고 주의사항의 "추상적 표현" 항목에 해당' },
        ],
        jdAlignment: [
          { requirement: '가설 수립과 검증 경험', coveredBy: '가설을 버린 지점', strength: 'strong', note: '' },
          { requirement: '사용성 테스트 설계', coveredBy: '검증 자료', strength: 'weak', note: '표본 5명 — 정량 검증 사례를 하나 더 추가하면 강해짐' },
          { requirement: '디자인 시스템 구축 경험', coveredBy: '', strength: 'missing', note: '이 경험엔 없음. 다른 경험에서 보완하거나 컴포넌트 정리 경험을 추가할 것' },
        ],
      },
    },
  ],
};

/** 레시피 히어로 렌더용 시각화 데이터 (normalizePortfolioVisuals 출력과 같은 모양) */
export const SAMPLE_VISUALS = {
  hr: {
    kpis: [
      { label: '3개월 리텐션', value: '88%' },
      { label: '서류 리드타임', value: '4일' },
    ],
    compare: [
      { label: '3개월 리텐션', before: '71%', after: '88%' },
      { label: '조기 퇴사', before: '9명', after: '3명' },
    ],
    funnel: [
      { label: '지원', value: 1240 }, { label: '서류 통과', value: 310 },
      { label: '면접', value: 86 }, { label: '최종 합격', value: 12 },
    ],
    steps: [
      { label: '버디 매칭', desc: '입사 첫날 같은 팀 선배를 1:1로 연결' },
      { label: '4주차 체크인', desc: '적응 상태와 막힌 지점을 정해진 질문으로 확인' },
      { label: '정착 리뷰', desc: '3개월 시점에 직무 적합도와 잔여 과제를 정리' },
    ],
    goals: [], gauges: [], mix: [],
  },
};
