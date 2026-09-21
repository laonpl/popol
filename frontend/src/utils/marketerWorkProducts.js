export const MARKETER_WORK_PRODUCTS = [
  { key: 'audiences', label: '고객 선택의 근거', fields: [['segment', '선택한 고객'], ['signal', '관찰 근거'], ['need', '고객의 필요'], ['barrier', '행동을 막는 장벽'], ['choice', '선택 이유']], limit: 3 },
  { key: 'positioning', label: '브랜드 메시지 설계', fields: [['audience', '누구에게'], ['promise', '전달할 약속'], ['proof', '믿을 이유'], ['difference', '다른 선택지와의 차이'], ['tone', '표현과 톤']], limit: 2 },
  { key: 'creatives', label: '소재와 카피 비교', fields: [['variant', '소재 이름'], ['format', '형식'], ['hook', '후킹 문구'], ['message', '메시지 본문'], ['cta', '행동 유도'], ['rationale', '표현 선택 이유'], ['observation', '실제 반응']], limit: 4 },
  { key: 'channels', label: '채널별 역할과 연결', fields: [['channel', '채널'], ['purpose', '맡긴 역할'], ['audience', '도달할 고객'], ['budget', '예산'], ['period', '기간'], ['handoff', '다음 접점'], ['rationale', '선택 이유']], limit: 5 },
  { key: 'contentSystem', label: '콘텐츠 운영 체계', fields: [['pillar', '콘텐츠 주제'], ['intent', '검색·독자 의도'], ['format', '형식'], ['distribution', '배포 경로'], ['cadence', '발행 주기'], ['reuse', '재활용 구조']], limit: 4 },
  { key: 'crm', label: 'CRM 여정과 발송 조건', fields: [['segment', '대상 조건'], ['trigger', '진입 트리거'], ['timing', '발송 시점'], ['message', '메시지'], ['exit', '종료·제외 조건'], ['guardrail', '빈도·안전장치']], limit: 5 },
  { key: 'experiments', label: '실험 설계와 의사결정', fields: [['hypothesis', '검증할 가설'], ['variable', '바꾼 변수'], ['control', '통제 조건'], ['test', '테스트 방법'], ['successCriteria', '사전 성공 기준'], ['observation', '실제 관찰'], ['decision', '관찰 후 결정'], ['limitation', '표본·교란 한계']], limit: 3 },
  { key: 'measurement', label: '측정 정의와 성과 귀속', fields: [['event', '측정 이벤트'], ['definition', '집계·분모 정의'], ['sourceSystem', '데이터 출처'], ['window', '관찰·기여 기간'], ['attribution', '기여 방식'], ['limitation', '해석 한계']], limit: 4 },
  { key: 'optimization', label: '최적화와 실패 학습', fields: [['signal', '변화를 촉발한 신호'], ['diagnosis', '진단'], ['change', '수정한 것'], ['observation', '실제 관찰'], ['next', '다음 판단']], limit: 3 },
  { key: 'operations', label: '제작·협업 운영', fields: [['deliverable', '제작물'], ['stakeholder', '협업 상대'], ['constraint', '일정·예산·브랜드 제약'], ['myAction', '내가 조율한 일'], ['agreement', '합의한 내용']], limit: 3 },
];
export const MARKETER_VIEWS = [
  { key: 'strategy', label: '고객 · 브랜드', question: '누구에게, 왜 이 메시지였을까?', groups: ['audiences', 'positioning'] },
  { key: 'creative', label: '소재 · 콘텐츠', question: '고객의 눈앞에 무엇을 만들었을까?', groups: ['creatives', 'contentSystem'] },
  { key: 'journey', label: '채널 · CRM', question: '접점을 어떻게 이어 설계했을까?', groups: ['channels', 'crm'] },
  { key: 'experiment', label: '검증 · 최적화', question: '반응을 보고 무엇을 바꿨을까?', groups: ['experiments', 'measurement', 'optimization', 'operations'] },
];
export const MARKETER_LENSES = [
  { key: 'all', label: '전체 보기', order: ['strategy', 'creative', 'journey', 'experiment'] },
  { key: 'brand', label: '브랜드 · 콘텐츠', order: ['creative', 'strategy', 'journey', 'experiment'] },
  { key: 'performance', label: '퍼포먼스', order: ['experiment', 'creative', 'journey', 'strategy'] },
  { key: 'crm', label: 'CRM · 리텐션', order: ['journey', 'experiment', 'strategy', 'creative'] },
];
