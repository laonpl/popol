// Optional typed artifacts, never a checklist to fill with invented work.
export const MARKETER_WORK_PRODUCT_FIELDS = {
  audiences: ['segment', 'signal', 'need', 'barrier', 'choice'],
  positioning: ['audience', 'promise', 'proof', 'difference', 'tone'],
  creatives: ['variant', 'format', 'hook', 'message', 'cta', 'rationale', 'observation'],
  channels: ['channel', 'purpose', 'audience', 'budget', 'period', 'handoff', 'rationale'],
  contentSystem: ['pillar', 'intent', 'format', 'distribution', 'cadence', 'reuse'],
  crm: ['segment', 'trigger', 'timing', 'message', 'exit', 'guardrail'],
  experiments: ['hypothesis', 'variable', 'control', 'test', 'successCriteria', 'observation', 'decision', 'limitation'],
  measurement: ['event', 'definition', 'sourceSystem', 'window', 'attribution', 'limitation'],
  optimization: ['signal', 'diagnosis', 'change', 'observation', 'next'],
  operations: ['deliverable', 'stakeholder', 'constraint', 'myAction', 'agreement'],
};
export const MARKETER_WORK_PRODUCT_LIMITS = { audiences: 3, positioning: 2, creatives: 4, channels: 5, contentSystem: 4, crm: 5, experiments: 3, measurement: 4, optimization: 3, operations: 3 };
export const MARKETER_WORK_PRODUCTS_SCHEMA = Object.fromEntries(Object.entries(MARKETER_WORK_PRODUCT_FIELDS).map(([key, fields]) => [key, [{ ...Object.fromEntries(fields.map(field => [field, ''])), quote: '', source: '', stage: 'planned|executed|observed|changed|unknown', ownership: '' }]]));
export const MARKETER_WORK_PRODUCTS_GUIDE = `
[마케터 전용 산출물 추출 / jobData.marketerWorkProducts]
한 경험은 한 캠페인·브랜드 과제·콘텐츠 운영·CRM 개선 단위다. 모든 경험을 광고 전환율로 평가하지 않는다.
포트폴리오를 읽는 사람이 과제와 본인 역할을 먼저 파악하고, 고객 관찰→메시지/실제 표현→접점 운영→측정과 해석→다음 실행을 따라갈 수 있게 정리한다. marketerEvidence의 대표 판단과 marketerWorkProducts의 작업 세부사항을 같은 문장으로 반복하지 않는다.
브랜드 경험은 고객 인식·콘셉트·톤·접점 일관성과 실제 반응을, 콘텐츠 경험은 독자 의도·주제·문안·배포/재활용과 반응을 보존한다. 퍼포먼스 경험은 채널 선택·예산·소재 변수·집계 기준·변경 판단을, CRM 경험은 세그먼트·트리거·발송/제외 조건·빈도·관계 변화의 기록을 우선한다. 한 경험이 여러 유형에 걸칠 수 있으므로 임의로 단일 전문분야를 단정하지 않는다.
자료가 있는 3~5개 산출물 유형을 깊게 추출한다. 원문이 충분하면 추가 유형도 허용한다. 없는 유형은 []이며, 브랜드·콘텐츠·퍼포먼스·CRM 경험을 억지로 모두 만들지 않는다.
한 페이지에서 타깃 선택, 표현/소재, 접점 운영, 측정 해석과 개선을 구별해 읽을 수 있게 보존한다. 실제 문안·발송 조건·채널 배분·반응 이후 변경처럼 독립적인 근거가 있으면 3~5종 제한 때문에 생략하지 않는다. 소재와 채널·성과의 관계는 원문에 명시된 경우만 기술하고, 파일의 나열 순서나 같은 캠페인이라는 사실로 소재별 기여를 추정하지 않는다.
audiences: 관찰 근거→고객의 필요·장벽→선택한 세그먼트. 가상 페르소나나 인구통계 금지.
positioning: 대상, 전달 약속, 그 약속을 믿을 근거, 차별점, 실제 사용한 톤. 추상적인 '브랜딩 강화' 대신 메시지를 보존.
creatives: 실제 시안별 이름·형식·후킹 문구·본문·CTA·선택 이유·관찰 반응. 원문 카피를 보존하고 없던 A/B안이나 승자를 생성하지 않는다. 시안이 하나면 한 개만. 실제 파일명은 source에 기록하며 이미지 URL은 생성하지 않는다.
channels: 채널별 역할·고객·예산·기간·다음 접점·선택 이유. 단순 채널 나열이 아니라 고객이 다음 행동으로 어떻게 이어졌는지. 금액 없는 경우 빈 문자열.
contentSystem: 콘텐츠 주제 축, 검색/독자 의도, 형식, 배포 방식, 발행 주기, 재활용 구조. 횟수·조회수는 사업성과와 구분.
crm: 대상 조건→진입 트리거→발송 시점→메시지→종료/제외 조건·빈도 안전장치. 실제 조건만 기록. 순서가 없으면 자동으로 시퀀스를 만들지 않는다.
experiments: 가설, 바꾼 변수, 통제 조건, 테스트, 사전 성공 기준, 실제 관찰, 그 결과 내린 결정, 표본·기간·교란 한계. 단순 전후비교는 A/B 또는 인과검증이라고 부르지 않는다.
measurement: 이벤트 정의, 집계 기준, 데이터 도구, 관찰/기여 기간, 기여 방식과 한계. ROAS·CTR·CVR의 분모, 매출/리드 정의를 원문에서 확인한다.
optimization: 이상 신호→진단→소재/예산/타깃 수정→관찰→다음 판단. 실패·중단도 유효한 경험이다.
operations: 제작물, 협업 상대, 일정/예산/브랜드 제약, 내 조율, 합의. 팀 전체 작업을 내 기여로 바꾸지 않는다.
각 행은 이 내용을 뒷받침하는 연속 원문 quote 20~800자, 정확한 출처명 source, 진행 단계 stage와 원문에 적힌 내 역할 ownership을 포함한다. 필드별 내용은 600자 이내. 원문이 없으면 quote는 비우고 원문 미대조 초안으로 남긴다. 다른 캠페인의 수치·자료를 섞지 않는다.
계획서의 예상 반응은 observation에 넣지 않는다. '합격자 포트폴리오' 문구, 자동 적합도 등급, 추정 성과·기여율, 가상 퍼널/추이 그래프를 생성하지 않는다.
`;
