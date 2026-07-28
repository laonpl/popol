/**
 * 취업 분야별 경험 추출 렌즈와 범용 산출물 판독 규칙.
 *
 * 설계 원칙
 * 1) 파일 형식이 아니라 산출물의 기능(계획/실행/검증/결과)을 먼저 판별한다.
 * 2) 하나의 자료가 증명할 수 있는 범위를 넘겨 성과나 기여를 추정하지 않는다.
 * 3) 공통 판단 기록 위에 직군별 평가 단위·증거·주의점을 덧씌운다.
 *
 * 세부 직무는 끝없이 늘어나므로, 채용 평가 방식이 유사한 23개 대분야와 alias로
 * 라우팅한다. 등록되지 않은 직무는 common 렌즈로도 증거 중심 추출이 가능하다.
 */

const section = (key, label, guide) => ({ key, label, guide });

export const CAREER_FIELD_PROFILES = {
  common: {
    label: '전 직군 공통',
    unit: '판단이 바뀐 사건',
    aliases: [],
    emphasis: '맡은 일보다 문제 판단, 선택 기준, 직접 기여, 검증 근거, 판단의 변화를 찾으세요.',
    artifacts: ['작업 문서', '발표 자료', '회의 기록', '결과 화면', '피드백', '수정 이력'],
    proofSignals: ['문제의 구체성', '선택과 포기의 근거', '본인 기여 범위', '결과를 확인한 직접 자료', '이후 달라진 원칙'],
    metrics: ['기간', '범위', '처리량', '완료율', '전후 변화', '이해관계자/사용자 반응'],
    cautions: ['파일 보유를 작성자·의사결정자 증거로 간주하지 않기', '계획과 실행, 산출과 효과를 분리하기'],
    schema: '{ "initialBelief": "", "turningPoint": "", "decision": "", "criterion": "", "verification": "" }',
    sections: [],
  },
  dev: {
    label: '소프트웨어 개발',
    unit: '기술 의사결정/트러블슈팅',
    aliases: ['frontend', 'backend', 'fullstack', 'mobile', 'software', 'developer', 'engineer', '개발', '개발자'],
    emphasis: '코드 양보다 재현, 원인 가설, 설계 대안, 테스트와 운영 검증을 보여주세요.',
    artifacts: ['Git 저장소/커밋/PR', 'README', '아키텍처 문서', '이슈', '테스트 결과', '로그/프로파일', '배포 기록'],
    proofSignals: ['재현 가능한 증상', '원인 가설을 버린 근거', '기술 선택 trade-off', '테스트/모니터링 결과', '남은 기술 부채'],
    metrics: ['응답 시간', '처리량', '오류율', '메모리/번들', '테스트 커버리지', '배포·복구 시간'],
    cautions: ['기술 스택 나열을 역량으로 간주하지 않기', '커밋 수를 기여 품질로 해석하지 않기'],
    schema: '{ "symptom": "", "reproduction": "", "rootCauseHypotheses": [], "diagnosticEvidence": "", "options": [], "technicalDecision": "", "verification": "", "remainingDebt": "" }',
    sections: [],
  },
  aiml: {
    label: 'AI / ML',
    unit: '모델/실험',
    aliases: ['ai', 'ml', 'machine learning', 'data scientist', '인공지능', '머신러닝'],
    emphasis: '점수 하나보다 데이터 분리, 베이스라인, 오류 분석, 운영 제약과 모델 선택 이유를 보여주세요.',
    artifacts: ['노트북/실험 로그', '데이터셋/데이터 카드', '모델 카드', '평가 리포트', '학습 코드', '서빙/모니터링 기록'],
    proofSignals: ['데이터·라벨 품질 점검', '독립된 검증/테스트', '베이스라인 비교', '오류·편향 분석', '버전·배포·롤백'],
    metrics: ['업무 적합 평가 지표', '베이스라인 대비 변화', '추론 지연', '처리량', '비용', '드리프트/온라인 품질'],
    cautions: ['테스트셋 누수 확인', '오프라인 점수를 사용자 가치로 단정하지 않기', '훈련·서빙 차이를 숨기지 않기'],
    schema: '{ "objective": "", "dataset": "", "dataIssues": "", "baseline": "", "model": "", "alternatives": [], "whyModel": "", "metrics": [], "errorAnalysis": "", "servingConstraint": "", "nextExperiment": "" }',
    sections: [],
  },
  da: {
    label: '데이터 분석 / BI',
    unit: '분석과 의사결정',
    aliases: ['data', 'analyst', 'bi', 'analytics', '데이터', '데이터분석'],
    emphasis: '차트보다 질문·지표 정의·데이터 품질·경쟁 가설·실제 의사결정 연결을 보여주세요.',
    artifacts: ['SQL/노트북', '대시보드', '데이터 사전', '분석 리포트', '실험 설계/결과', '의사결정 문서'],
    proofSignals: ['분모·분자·기간이 명확한 지표', '결측/중복/편향 점검', '대안 설명 검토', '재현 가능한 쿼리', '분석 후 실행'],
    metrics: ['전환/잔존/코호트', '신뢰구간/효과크기', '데이터 품질', '예측 오차', '업무 변화'],
    cautions: ['상관을 인과로 쓰지 않기', '예쁜 대시보드를 분석 임팩트로 대체하지 않기'],
    schema: '{ "businessQuestion": "", "metricDefinition": "", "hypothesis": "", "competingHypotheses": [], "dataQuality": "", "method": "", "finding": "", "businessAction": "", "limitations": "" }',
    sections: [],
  },
  devops: {
    label: '인프라 / 데브옵스 / SRE',
    unit: '인시던트/운영 개선',
    aliases: ['infra', 'sre', 'platform', 'cloud', '인프라', '클라우드'],
    emphasis: '구성도보다 서비스 영향, 탐지·복구·영구 개선, 변경 안전성과 운영 지표를 보여주세요.',
    artifacts: ['IaC/파이프라인', '아키텍처', '런북', '모니터링/알람', '장애 회고', '비용 리포트', '배포 이력'],
    proofSignals: ['영향 범위', '탐지 신호', '근본 원인 근거', '롤아웃/롤백', '재발 방지'],
    metrics: ['변경 리드타임', '배포 빈도', '실패 배포 복구 시간', '변경 실패율', '재작업률', '비용/가용성'],
    cautions: ['도구 도입을 개선으로 단정하지 않기', '평균만으로 장애 꼬리를 숨기지 않기'],
    schema: '{ "incident": "", "detection": "", "blastRadius": "", "rootCauseHypotheses": [], "rootCause": "", "options": [], "decisionCriteria": "", "actionTaken": "", "rolloutRollback": "", "impact": "", "prevention": "" }',
    sections: [],
  },
  security: {
    label: '정보보안',
    unit: '위험 식별/검증/완화',
    aliases: ['cybersecurity', 'appsec', 'infosec', 'security', '보안', '정보보안'],
    emphasis: '도구 결과보다 위협 모델, 재현, 위험도 판단, 완화 조치와 재검증을 보여주세요.',
    artifacts: ['위협 모델', '보안 요구사항', '취약점 리포트', 'PoC', '침해 대응 기록', '감사/통제 문서', '재검증 결과'],
    proofSignals: ['영향·공격 가능성', '재현 조건', '보안 요구사항 추적', '수정 검증', '잔여 위험과 공개 범위'],
    metrics: ['위험도', '탐지/대응 시간', '수정 리드타임', '재발률', '통제 적용률'],
    cautions: ['스캐너 경고를 검증된 취약점으로 단정하지 않기', '민감한 공격 세부정보와 개인정보 비식별화'],
    schema: '{ "asset": "", "threat": "", "finding": "", "reproduction": "", "riskAssessment": "", "alternatives": [], "mitigation": "", "verification": "", "residualRisk": "", "disclosureBoundary": "" }',
    sections: [
      section('threatAssessment', '위협·위험 판단', '보호 자산, 공격 경로, 영향·가능성 근거와 우선순위 판단.'),
      section('verification', '검증과 완화', '재현/테스트 근거, 적용한 통제, 수정 후 재검증과 잔여 위험.'),
      section('securityOwnership', '운영·책임 범위', '본인 권한, 협업/에스컬레이션, 공개 가능한 범위와 재발 방지.'),
    ],
  },
  qa: {
    label: 'QA / 소프트웨어 테스트',
    unit: '품질 위험과 검증',
    aliases: ['tester', 'testing', 'quality assurance', 'qa engineer', '테스트', '품질보증'],
    emphasis: '테스트 건수보다 품질 위험, 요구사항 추적, 결함 발견 논리, 릴리스 판단 기여를 보여주세요.',
    artifacts: ['테스트 계획/케이스', '요구사항 추적표', '결함 티켓', '자동화 코드', '실행 결과', '릴리스 리포트'],
    proofSignals: ['테스트 근거와 목적', '위험 기반 우선순위', '요구사항-테스트-결함 추적', '재현/심각도', '종료·릴리스 기준'],
    metrics: ['요구사항/위험 커버리지', '결함 누출', '재오픈율', '실행 시간', '자동화 안정성'],
    cautions: ['테스트 케이스 수를 품질로 단정하지 않기', '테스트와 디버깅/수정을 본인 기여로 혼합하지 않기'],
    schema: '{ "qualityRisk": "", "testBasis": "", "scope": "", "prioritization": "", "testDesign": "", "traceability": "", "defectEvidence": "", "releaseDecision": "", "automation": "", "remainingRisk": "" }',
    sections: [
      section('qualityStrategy', '품질 위험과 전략', '제품 맥락, 핵심 품질 위험, 범위·우선순위와 종료 기준.'),
      section('testEvidence', '테스트 설계와 증거', '테스트 근거, 케이스/데이터, 추적성, 결함 재현과 실행 결과.'),
      section('releaseImpact', '릴리스 판단과 개선', '릴리스 판단 기여, 자동화 효과, 놓친 결함과 이후 통제.'),
    ],
  },
  pm: {
    label: '서비스 기획 / 프로덕트 매니지먼트',
    unit: '제품 의사결정',
    aliases: ['product manager', 'product owner', 'planner', 'service planning', '기획', '서비스기획'],
    emphasis: '기능 목록보다 사용자 문제, 가설, 제외 범위, 성공·반증 기준과 판단 업데이트를 보여주세요.',
    artifacts: ['PRD/요구사항', '로드맵', '사용자 리서치', '와이어프레임', '실험/지표', '회의·결정 로그', '릴리스 기록'],
    proofSignals: ['사용자 근거', '목표와 범위 밖 항목', '대안과 trade-off', '성공/반증 기준', '출시 후 판단 변화'],
    metrics: ['활성화/잔존/전환', '핵심 과업 성공', '가치 도달 시간', '수익/비용', '정성 신호'],
    cautions: ['PRD를 출시·사용 효과의 증거로 쓰지 않기', '팀 실행을 PM 단독 성과로 쓰지 않기'],
    schema: '{ "problemSignal": "", "hypothesis": "", "successCriteria": "", "decision": "", "alternatives": "", "stakeholders": "", "obstacle": "", "resolution": "", "validation": "", "impact": "", "effort": "" }',
    sections: [],
  },
  project: {
    label: '프로젝트 / 프로그램 관리',
    unit: '프로젝트 통제와 의사결정',
    aliases: ['project manager', 'program manager', 'pmo', '프로젝트관리', '사업관리'],
    emphasis: '일정표보다 목표·범위·리스크·의존성·이해관계자 판단과 통제 결과를 보여주세요.',
    artifacts: ['프로젝트 헌장', 'WBS/일정', 'RAID 로그', '예산', '상태 보고', '회의/변경 기록', '회고'],
    proofSignals: ['명확한 목표/범위', '베이스라인과 변경', '리스크 대응', '의존성 해결', '완료 기준과 인수'],
    metrics: ['일정/예산 편차', '마일스톤', '리스크 소진', '변경 요청', '품질/인수'],
    cautions: ['회의 횟수를 조율 역량으로 쓰지 않기', '최종 성공만으로 통제 능력을 역산하지 않기'],
    schema: '{ "objective": "", "scope": "", "baseline": "", "dependencies": [], "risk": "", "options": [], "changeDecision": "", "stakeholderAlignment": "", "deliveryEvidence": "", "variance": "", "retrospective": "" }',
    sections: [
      section('planControl', '목표·범위·통제', '목표와 범위, 베이스라인, 일정·예산·품질 통제 방식.'),
      section('riskDecision', '리스크·변경 판단', '주요 리스크/의존성, 비교한 대응안, 변경 기준과 승인.'),
      section('deliveryLearning', '인수와 회고', '완료·인수 근거, 편차, 이해관계자 결과와 다음 통제 원칙.'),
    ],
  },
  designer: {
    label: 'UX/UI / 프로덕트 디자인',
    unit: '리서치 기반 개선 반복',
    aliases: ['ux', 'ui', 'product design', 'designer', '디자인', '디자이너'],
    emphasis: '완성 화면보다 사용자 행동 근거가 문제 정의와 시안을 어떻게 바꿨는지 보여주세요.',
    artifacts: ['리서치 계획/원문', '여정/플로우', '와이어프레임', '프로토타입', '사용성 테스트', '디자인 시스템', '이전 버전'],
    proofSignals: ['사용자 맥락/발화', '문제 해석', '시안 비교', '과업 기반 테스트', '반복 전후와 접근성'],
    metrics: ['과업 성공/시간/오류', '이해도/만족도', '컴포넌트 재사용', '디자인 부채', '정성 패턴'],
    cautions: ['미적 완성도를 사용자 문제 해결로 단정하지 않기', '팀 산출물에서 본인 화면·판단 범위 분리'],
    schema: '{ "userContext": "", "researchEvidence": "", "painPoint": "", "variants": [], "designDecision": "", "testCriteria": "", "testResult": "", "iteration": "", "edgeCases": "" }',
    sections: [],
  },
  marketer: {
    label: '마케팅 / 그로스 / CRM / 브랜드',
    unit: '캠페인/실험',
    aliases: ['marketing', 'growth', 'crm', 'brand', '마케팅', '마케터'],
    emphasis: '노출량보다 타깃 관찰, 메시지·채널 가설, 전환 행동, 귀인 한계와 다음 실험을 보여주세요.',
    artifacts: ['캠페인 브리프', '콘텐츠/소재', '미디어 플랜', '채널 리포트', '전환/CRM 분석', 'A/B 테스트', 'VOC'],
    proofSignals: ['목표 전환 행동', '타깃 근거', '소재/채널 대안', '실험 기준', '고객 경로와 귀인 한계'],
    metrics: ['도달/CTR/CVR', 'CPA/CAC/ROAS', '잔존/재구매', '증분 효과', '브랜드/정성 반응'],
    cautions: ['마지막 접점을 전체 성과 원인으로 단정하지 않기', '조회수와 비즈니스 성과 분리'],
    schema: '{ "businessProblem": "", "target": "", "audienceInsight": "", "channels": [], "creative": "", "experimentOptions": [], "kpis": [], "attributionLimit": "", "nextExperiment": "" }',
    sections: [],
  },
  content: {
    label: '콘텐츠 / 미디어 / 에디팅',
    unit: '콘텐츠 판단과 제작',
    aliases: ['editor', 'writer', 'copywriter', 'media', 'video', '콘텐츠', '에디터', '영상'],
    emphasis: '결과물 모음보다 독자/시청자 문제, 편집 판단, 제작 제약, 배포 반응과 다음 포맷 판단을 보여주세요.',
    artifacts: ['콘텐츠 브리프', '대본/원고', '스토리보드', '초안/수정본', '발행물', '편집 피드백', '채널 분석'],
    proofSignals: ['대상/목적', '자료 조사', '편집·톤 판단', '수정 이력', '배포 맥락과 반응'],
    metrics: ['완독/시청 유지', '저장/공유', '검색/유입', '발행 주기', '제작 리드타임', '정성 피드백'],
    cautions: ['조회수를 콘텐츠 품질 하나의 결과로 단정하지 않기', '초안과 최종본 사이 본인 기여 명시'],
    schema: '{ "audience": "", "contentGoal": "", "research": "", "formatOptions": [], "editorialDecision": "", "productionConstraint": "", "revisionEvidence": "", "distribution": "", "response": "", "nextFormat": "" }',
    sections: [
      section('editorialStrategy', '독자·콘텐츠 전략', '대상과 목적, 자료 조사, 포맷·채널·톤 선택 근거.'),
      section('productionRevision', '제작과 수정', '본인 제작 범위, 초안-피드백-최종본의 핵심 변화.'),
      section('distributionLearning', '배포 결과와 다음 판단', '채널 반응, 귀인 한계, 다음에 바꿀 포맷/메시지.'),
    ],
  },
  hr: {
    label: '인사 / 채용 / 조직문화',
    unit: '사람 제도/프로그램',
    aliases: ['human resources', 'recruiting', 'talent', 'people', '인사', '채용'],
    emphasis: '행사 운영보다 진단 근거, 공정성·윤리·법규·수용성 기준과 사람/사업 결과를 보여주세요.',
    artifacts: ['직무기술서', '채용 퍼널/스코어카드', '서베이', '인터뷰/VOC', '제도 기획안', '온보딩/교육', '운영 리포트'],
    proofSignals: ['구성원/후보자/현업 근거', '공정성·윤리', '사업 맥락', '도입 과정', '부작용/리텐션'],
    metrics: ['채용 리드타임/전환', '수락률', '조기 이탈', '참여/완료', '만족/성과', '공정성 점검'],
    cautions: ['민감 개인정보 비식별화', '상관관계를 제도 효과로 단정하지 않기'],
    schema: '{ "goal": "", "diagnosisEvidence": "", "alternatives": [], "decisionCriteria": "", "program": "", "adoption": "", "funnelChange": "", "sideEffects": "" }',
    sections: [],
  },
  sales: {
    label: '영업 / 사업개발',
    unit: '고객 기회/딜',
    aliases: ['sales', 'business development', 'bd', 'account executive', '영업', '사업개발'],
    emphasis: '매출 숫자보다 계정 우선순위, 고객 문제, 구매 기준, 반대·협상과 장기 관계를 보여주세요.',
    artifacts: ['계정 조사', 'CRM 파이프라인', '디스커버리 노트', '제안서/데모', '협상/계약 기록', '갱신/업셀 기록'],
    proofSignals: ['리드 자격 근거', '고객 pain/의사결정자', '경쟁 대안', '반대 처리', '계약·실주 학습'],
    metrics: ['단계별 전환', '세일즈 사이클', '파이프라인/계약', '갱신/확장', '예측 정확도'],
    cautions: ['팀 매출과 개인 기여 분리', '계약서·고객 정보 비식별화', '실주 경험을 삭제하지 않기'],
    schema: '{ "client": "", "qualification": "", "stakeholderMap": "", "customerAlternatives": [], "buyingCriteria": "", "approach": "", "objections": "", "negotiation": "", "dealSize": "", "stage": "", "accountLearning": "" }',
    sections: [],
  },
  customer_success: {
    label: '고객 성공 / 서비스 운영',
    unit: '고객 가치 실현/운영 개선',
    aliases: ['customer success', 'cs', 'cx', 'service operation', '고객성공', '고객지원', '서비스운영'],
    emphasis: '문의 처리량보다 고객 목표, 반복 이슈의 원인, 해결·예방, 채택·유지 변화를 보여주세요.',
    artifacts: ['티켓/VOC', '고객 여정', '헬프센터/런북', '온보딩 계획', '사용/헬스 스코어', 'QBR/갱신 기록'],
    proofSignals: ['고객 목표와 세그먼트', '이슈 패턴/근본 원인', '에스컬레이션', '셀프서비스/예방', '채택·갱신'],
    metrics: ['첫 응답/해결 시간', '재문의', 'CSAT/NPS', '기능 채택', '잔존/갱신', '지원 비용'],
    cautions: ['만족도 하나로 고객 성공을 단정하지 않기', '개별 고객·개인정보 비식별화'],
    schema: '{ "customerGoal": "", "segment": "", "signal": "", "rootCause": "", "options": [], "intervention": "", "escalation": "", "adoptionEvidence": "", "retentionEvidence": "", "prevention": "" }',
    sections: [
      section('customerDiagnosis', '고객 문제 진단', '고객 목표, 세그먼트, VOC/사용 신호와 반복 원인.'),
      section('serviceIntervention', '해결·운영 판단', '대응안 비교, 직접 해결/에스컬레이션, 예방·셀프서비스.'),
      section('customerOutcome', '가치·유지 결과', '채택·만족·갱신 근거, 귀인 한계와 다음 운영 원칙.'),
    ],
  },
  finance: {
    label: '재무 / 회계 / 투자',
    unit: '재무 판단/통제',
    aliases: ['accounting', 'investment', 'fp&a', 'audit', 'finance', '재무', '회계', '투자'],
    emphasis: '숫자 결과보다 가정, 계산 근거, 시나리오·위험, 통제, 윤리적 판단을 보여주세요.',
    artifacts: ['재무 모델', '예산/예측', '재무제표', '밸류에이션/투자 메모', '감사 조서', '리스크/통제 문서', '경영 보고'],
    proofSignals: ['출처와 가정', '검산/조정', '시나리오·민감도', '통제/승인', '의사결정 연결'],
    metrics: ['예산/예측 편차', '현금흐름', '수익성/단위경제', '밸류에이션 범위', '오류/조정', '위험 노출'],
    cautions: ['성과 수익률만으로 역량 단정하지 않기', '미공개 재무정보 비식별화', '규정·윤리·독립성 명시'],
    schema: '{ "decisionQuestion": "", "dataSources": "", "assumptions": [], "modelMethod": "", "alternatives": [], "scenarioSensitivity": "", "controls": "", "recommendation": "", "decisionUse": "", "variance": "", "ethicsRisk": "" }',
    sections: [
      section('financialLogic', '가정·모델·분석', '의사결정 질문, 출처, 핵심 가정과 계산/모델 방법.'),
      section('riskControl', '시나리오·위험·통제', '대안·민감도, 검산·승인·통제, 규정·윤리 판단.'),
      section('decisionImpact', '권고와 결과', '권고안, 실제 의사결정 반영, 편차와 이후 수정한 가정.'),
    ],
  },
  strategy: {
    label: '전략 / 컨설팅 / 사업기획',
    unit: '구조화된 문제 해결',
    aliases: ['consulting', 'corporate strategy', 'business planning', '컨설팅', '전략', '사업기획'],
    emphasis: '프레임워크 이름보다 핵심 질문, 가설 우선순위, 분석 근거, 실행 가능한 권고와 반론을 보여주세요.',
    artifacts: ['문제 정의/워크플랜', '시장·고객 리서치', '인터뷰', '분석 모델', '전략 제안서', '경영진 의사결정/실행 추적'],
    proofSignals: ['의사결정 질문', '가설 트리', '자료 신뢰도', '선택지 비교', '권고의 실행 조건'],
    metrics: ['시장/고객/경제성', '시나리오', '실행 마일스톤', '사업 결과', '예측 편차'],
    cautions: ['프레임워크를 분석 그 자체로 쓰지 않기', '제안을 실행 결과처럼 쓰지 않기'],
    schema: '{ "decisionQuestion": "", "issueStructure": "", "hypotheses": [], "researchEvidence": "", "options": [], "evaluationCriteria": "", "recommendation": "", "counterarguments": "", "implementation": "", "outcome": "" }',
    sections: [
      section('problemStructure', '문제 구조와 가설', '핵심 의사결정 질문, 이슈 구조, 우선 검증한 가설.'),
      section('optionAnalysis', '대안 분석과 권고', '근거 출처, 선택지, 평가 기준, 반론·위험과 권고.'),
      section('implementationImpact', '실행과 결과', '실행 조건·마일스톤, 의사결정 반영, 결과와 예측 편차.'),
    ],
  },
  operations: {
    label: '운영 / 공급망 / 생산 / 품질',
    unit: '프로세스 개선',
    aliases: ['supply chain', 'logistics', 'manufacturing', 'procurement', 'operations', '물류', '생산', '구매', '운영'],
    emphasis: '업무량보다 프로세스 범위, 기준선, 병목·근본 원인, 파일럿과 통제 계획을 보여주세요.',
    artifacts: ['프로세스 맵/SOP', '수요·생산 계획', '재고/물류 데이터', '품질 리포트', '원인 분석', '파일럿 결과', '통제 계획'],
    proofSignals: ['고객/VOC와 범위', '측정 가능한 기준선', '근본 원인', '대안 파일럿', '표준화·반응 계획'],
    metrics: ['리드타임/처리량', '재고/결품', '수율/불량', '원가', '납기', '안전/재작업'],
    cautions: ['계절성·믹스 변화 등 외부 변수를 분리', '개선 후 유지 여부를 통제 자료로 확인'],
    schema: '{ "processScope": "", "customerNeed": "", "baseline": "", "measurementQuality": "", "rootCause": "", "alternatives": [], "pilot": "", "improvement": "", "controlPlan": "", "result": "", "unintendedEffect": "" }',
    sections: [
      section('processBaseline', '프로세스·기준선', '고객 요구, 프로세스 범위, 기준선과 측정 신뢰도.'),
      section('rootCausePilot', '원인·대안·파일럿', '병목/근본 원인 근거, 대안 비교와 파일럿 설계.'),
      section('controlOutcome', '결과·표준화·통제', '전후 결과, SOP/통제 계획, 부작용과 유지 여부.'),
    ],
  },
  engineering: {
    label: '하드웨어 / 제조 R&D / 엔지니어링',
    unit: '설계·검증 반복',
    aliases: ['mechanical', 'electrical', 'electronics', 'hardware', 'r&d', '기계', '전기', '전자', '하드웨어'],
    emphasis: '완성품보다 요구조건, 계산·시뮬레이션, 설계 대안, 시험·실패 분석과 안전 여유를 보여주세요.',
    artifacts: ['요구사항/사양', 'CAD/회로/도면', '계산/시뮬레이션', 'BOM', '시험 계획/결과', 'FMEA/고장 분석', '변경 이력'],
    proofSignals: ['요구사항 추적', '설계 trade-off', '허용오차/안전', '시험 조건', '실패와 재설계'],
    metrics: ['성능/효율', '정확도/공차', '내구/신뢰성', '원가/중량', '수율', '안전 계수'],
    cautions: ['시뮬레이션과 실물 검증 분리', '팀 도면·특허·기밀정보 공개 범위 확인'],
    schema: '{ "requirement": "", "constraints": [], "analysis": "", "designAlternatives": [], "designDecision": "", "prototype": "", "testMethod": "", "testResult": "", "failureAnalysis": "", "redesign": "", "safetyMargin": "" }',
    sections: [
      section('requirementsDesign', '요구조건과 설계 판단', '성능·원가·안전 제약, 분석, 설계 대안과 선택 근거.'),
      section('prototypeTest', '시제품과 검증', '시제품 범위, 시험 조건·장비·판정 기준과 결과.'),
      section('failureRedesign', '실패 분석과 재설계', '예상 밖 결과, 원인 근거, 변경 사항과 잔여 위험.'),
    ],
  },
  research: {
    label: '연구 / R&D',
    unit: '연구 질문/검증',
    aliases: ['researcher', 'scientist', 'academic', '연구', '연구원'],
    emphasis: '논문 제목보다 연구 질문, 방법의 타당성, 재현성, 한계와 정확한 본인 기여를 보여주세요.',
    artifacts: ['연구계획/프로토콜', '실험/랩 노트', '데이터/코드', '분석', '논문/포스터', '리뷰 코멘트', '재현 자료'],
    proofSignals: ['문헌 공백/질문', '방법 선택', '검증/재현', '부정적 결과', 'CRediT 역할별 기여'],
    metrics: ['효과크기/불확실성', '재현/반복', '표본/품질', '연구 산출', '후속 활용'],
    cautions: ['저자 순서를 기여 범위로 추정하지 않기', '유의성만으로 의미를 단정하지 않기', '부정 결과 숨기지 않기'],
    schema: '{ "researchQuestion": "", "literatureGap": "", "hypothesis": "", "methodAlternatives": [], "method": "", "dataQuality": "", "validation": "", "finding": "", "limitations": "", "contributionRoles": [], "nextStudy": "" }',
    sections: [
      section('researchQuestion', '질문·가설·방법', '문헌 공백, 연구 질문/가설, 방법 대안과 선택 근거.'),
      section('validationFinding', '검증과 발견', '데이터/실험 품질, 분석·재현, 발견과 부정적 결과.'),
      section('researchContribution', '기여·한계·후속 연구', 'CRediT 역할별 본인 기여, 한계, 다음 연구.'),
    ],
  },
  education: {
    label: '교육 / 교수설계 / 강의',
    unit: '학습 설계/평가',
    aliases: ['teacher', 'instructional design', 'training', '교사', '교육', '강의'],
    emphasis: '수업 진행보다 학습자 진단, 학습목표-활동-평가 정렬, 포용성, 평가 후 재설계를 보여주세요.',
    artifacts: ['요구 분석', '학습목표/수업안', '교재/활동', '평가 루브릭', '학습자 결과물', '피드백', '수업 개선 기록'],
    proofSignals: ['학습자·맥락 진단', '명시적 목표', '활동-평가 정렬', '다양한 학습자 지원', '데이터 기반 재설계'],
    metrics: ['목표 달성/숙달', '완료/참여', '사전-사후', '전이/적용', '정성 피드백'],
    cautions: ['만족도를 학습 성과로 대체하지 않기', '학생 개인정보와 결과물 동의 확인'],
    schema: '{ "learnerContext": "", "learningNeed": "", "objectives": [], "designAlternatives": [], "learningDesign": "", "assessment": "", "inclusion": "", "learnerEvidence": "", "iteration": "", "transfer": "" }',
    sections: [
      section('learningDesign', '학습자·목표·설계', '학습자 맥락, 학습 필요, 목표와 활동 설계 근거.'),
      section('assessmentEvidence', '평가와 학습 증거', '평가/루브릭, 학습자 결과, 포용성·접근성.'),
      section('teachingIteration', '재설계와 전이', '피드백 후 바꾼 점, 실제 적용/전이와 남은 한계.'),
    ],
  },
  policy: {
    label: '공공 / 정책 / 행정',
    unit: '정책 설계/평가',
    aliases: ['public policy', 'government', 'public administration', '공공', '정책', '행정'],
    emphasis: '사업 소개보다 정책 문제, 대상·이해관계, 논리모형, 근거의 신뢰도, 형평성과 책무성을 보여주세요.',
    artifacts: ['정책 메모/보고서', '법령/공공데이터', '이해관계자 의견', '논리모형', '예산/집행', '모니터링/평가 리포트'],
    proofSignals: ['문제·대상 정의', '가정/위험', '투입-산출-성과-영향', '모니터링과 평가 구분', '형평성/투명성'],
    metrics: ['도달/집행', '산출', '단기·중기 성과', '비용효과', '형평성', '의도치 않은 결과'],
    cautions: ['산출량을 사회적 영향으로 쓰지 않기', '모니터링 변화와 정책 인과효과 분리'],
    schema: '{ "policyProblem": "", "population": "", "stakeholders": [], "evidence": "", "options": [], "criteria": "", "theoryOfChange": "", "implementation": "", "monitoring": "", "evaluation": "", "equityRisk": "" }',
    sections: [
      section('policyDesign', '문제·대상·정책 대안', '문제와 대상, 이해관계자, 자료 근거, 대안과 선택 기준.'),
      section('resultsFramework', '논리모형과 실행', '투입-활동-산출-성과-영향, 가정·위험과 실행 책임.'),
      section('evaluationEquity', '평가·형평성·책무성', '모니터링과 평가, 형평성/부작용, 공개·책무성.'),
    ],
  },
  legal: {
    label: '법무 / 컴플라이언스',
    unit: '쟁점 분석/위험 통제',
    aliases: ['law', 'legal', 'compliance', '법무', '컴플라이언스'],
    emphasis: '결론보다 사실관계, 쟁점, 권위 있는 근거, 대안별 위험과 실행 통제를 보여주세요.',
    artifacts: ['법률 검토 메모', '계약서/조항 비교', '규정/정책', '실사 자료', '컴플라이언스 점검', '교육/시정 기록'],
    proofSignals: ['사실-쟁점 분리', '법령/판례/규정 출처', '불확실성', '위험 기반 대안', '승인·시정 추적'],
    metrics: ['검토/시정 리드타임', '통제 적용', '예외/위반', '계약 위험', '교육/점검'],
    cautions: ['법률 자문 비밀·개인정보 비식별화', '현재 법령 여부 확인', '승소/무사고만으로 역량 단정 금지'],
    schema: '{ "facts": "", "legalIssues": [], "authorities": [], "uncertainty": "", "options": [], "riskAssessment": "", "recommendation": "", "stakeholderDecision": "", "control": "", "outcome": "" }',
    sections: [
      section('issueAuthority', '사실·쟁점·근거', '사실관계, 법적/규정 쟁점, 적용 근거와 불확실성.'),
      section('riskRecommendation', '대안·위험·권고', '대안별 법률/사업 위험, 권고와 승인 과정.'),
      section('complianceOutcome', '통제·시정·결과', '계약/정책/교육 통제, 시정 추적과 남은 위험.'),
    ],
  },
  healthcare: {
    label: '보건의료 / 헬스케어',
    unit: '안전한 서비스/품질 개선',
    aliases: ['healthcare', 'health', 'clinical', 'medical', '보건', '의료', '헬스케어'],
    emphasis: '사례의 극적 결과보다 안전성, 근거, 사람 중심성, 형평성, 데이터 품질과 개인정보 보호를 보여주세요.',
    artifacts: ['비식별 사례/프로토콜', '품질지표', '프로세스 맵', '환자/사용자 피드백', '개선 계획', '안전사건/감사', '교육 자료'],
    proofSignals: ['안전/효과/사람 중심', '가이드라인·근거', '팀 협업/에스컬레이션', '지표 품질', '부작용/형평성'],
    metrics: ['안전사건', '과정/결과 품질', '대기/적시성', '환자경험', '형평성', '효율'],
    cautions: ['개인정보 완전 비식별화', '개별 결과를 일반 효과로 확대하지 않기', '허가·역할 범위 명시'],
    schema: '{ "careContext": "", "qualityProblem": "", "evidenceGuideline": "", "stakeholders": [], "options": [], "safetyCriteria": "", "intervention": "", "measurementQuality": "", "outcome": "", "unintendedEffect": "", "privacyBoundary": "" }',
    sections: [
      section('careQuality', '문제·근거·안전 기준', '대상/맥락, 품질 문제, 근거·지침, 안전·형평성 기준.'),
      section('interventionTeam', '중재와 팀 협업', '대안 비교, 역할 범위, 실행·에스컬레이션과 개인정보 보호.'),
      section('qualityOutcome', '품질 결과와 한계', '지표 품질, 결과·부작용, 사람 중심성과 다음 개선.'),
    ],
  },
};

const ALIAS_TO_FIELD = Object.entries(CAREER_FIELD_PROFILES).reduce((map, [key, profile]) => {
  map[key] = key;
  profile.aliases.forEach(alias => { map[String(alias).toLowerCase()] = key; });
  return map;
}, {});

export function normalizeCareerField(value = 'common') {
  const raw = String(value || '').trim().toLowerCase();
  return ALIAS_TO_FIELD[raw] || (CAREER_FIELD_PROFILES[raw] ? raw : 'common');
}

export function getCareerFieldProfile(value = 'common') {
  return CAREER_FIELD_PROFILES[normalizeCareerField(value)] || CAREER_FIELD_PROFILES.common;
}

export const ARTIFACT_ANALYSIS_SCHEMA = `, 
  "artifactAnalysis": {
    "detectedArtifacts": [
      {
        "id": "ART-001",
        "name": "원본에 나온 파일·링크·화면·문서 이름",
        "kind": "code|commit_pr|architecture|test_report|incident|experiment|dataset|dashboard|analysis|prd|research|prototype|design_system|campaign|content|crm|hr_record|proposal|contract|financial_model|policy|sop_process|engineering_design|lesson_assessment|clinical_quality|feedback|other",
        "stage": "계획|실행|검증|결과|회고|복합",
        "authorRelation": "본인 작성|공동 작성|팀 산출물|외부 자료|불명",
        "dateOrVersion": "원본에 있을 때만",
        "summary": "이 자료에서 직접 확인되는 사실",
        "privacy": "공개 가능|비식별 필요|공개 확인 필요"
      }
    ],
    "evidenceLedger": [
      {
        "claim": "포트폴리오에서 할 수 있는 주장",
        "artifactIds": ["ART-001"],
        "location": "페이지·슬라이드·시트·커밋·화면·문단 등 원본 위치",
        "directObservation": "자료에서 직접 보이는 내용",
        "proofLevel": "A|B|C|D",
        "ownership": "이 자료가 확인하는 본인 기여 범위",
        "confidence": "high|medium|low",
        "gap": "이 주장에 아직 부족한 증거"
      }
    ],
    "experienceCandidates": [
      {
        "title": "하나의 판단 사건",
        "artifactIds": ["ART-001"],
        "whyRelevant": "대상 직군의 어떤 평가 기준을 증명하는지",
        "status": "계획만 확인|실행 확인|결과 확인|판단 변화 확인",
        "missingQuestions": ["지원자만 답할 수 있는 빈칸"]
      }
    ],
    "conflicts": [
      { "claim": "자료끼리 다른 주장", "artifactIds": [], "resolution": "최신 버전·직접 기록 우선 등 처리 또는 [확인 필요]" }
    ]
  }`;

export function buildArtifactIntelligenceGuide(jobCategory = 'common') {
  const profile = getCareerFieldProfile(jobCategory);
  return `
[★★ 산출물 판독 → 근거 장부 → ${profile.label} 경험 추출]
입력은 완성된 포트폴리오가 아니라 코드, 화면, 기획서, 초안, 데이터, 회의록, 제안서, 보고서처럼 서로 다른 산출물의 묶음일 수 있습니다. 문장을 쓰기 전에 다음 순서로 판독하세요.

1. 자료 경계 보존
- 파일·링크·화면·시트·버전마다 ART-001부터 별도 id를 붙이세요. 서로 다른 프로젝트나 시점의 내용을 하나의 경험으로 합치지 마세요.
- 확장자만 보고 종류를 정하지 말고 실제 내용을 보고 kind와 stage(계획/실행/검증/결과/회고)를 판별하세요.
- 같은 자료 안에 계획과 결과가 섞이면 stage="복합"으로 두고, evidenceLedger에서 각각의 위치를 분리하세요.

2. 사실 상태 분리
- 제안했다 ≠ 승인됐다 ≠ 실행했다 ≠ 효과가 검증됐다. 자료가 확인하는 단계까지만 status로 기록하세요.
- 화면/프로토타입은 설계·제작 증거이지 출시·사용 효과의 증거가 아닙니다.
- 대시보드/그래프는 값의 증거가 될 수 있지만 지표 정의·기간·비교군이 없으면 인과효과의 증거가 아닙니다.
- 파일을 가지고 있다는 사실만으로 본인 작성·의사결정·전체 기여를 추정하지 마세요.

3. 근거 강도
- A: 시스템 로그, 배포/발행물, 원데이터, 실제 계약·시험 결과처럼 직접 확인 가능한 기록.
- B: 본인 작성 초안/버전 이력, 승인 문서, 회의록, 피드백처럼 과정과 기여를 확인하는 기록.
- C: 날짜·작성자·원본 위치가 불완전한 캡처나 정리본.
- D: 지원자의 회상만 있고 현재 연결된 자료가 없는 주장.
- 직접Observation과 해석을 한 문장에 섞지 말고, 모든 핵심 주장에 artifactIds와 location을 연결하세요.

4. 대상 직군 렌즈
- 경험 단위: ${profile.unit}
- 중요 산출물: ${profile.artifacts.join(' · ')}
- 강한 증거: ${profile.proofSignals.join(' · ')}
- 확인할 지표: ${profile.metrics.join(' · ')}
- 특히 주의: ${profile.cautions.join(' · ')}
- 같은 산출물도 이 렌즈로 다시 읽되, 자료에 없는 직무 활동을 만들어 번역하지 마세요.

5. 경험 후보 선택
- 산출물별 요약이 아니라 여러 자료가 함께 증명하는 하나의 판단 사건을 후보로 만드세요.
- 문제 신호 → 해석 → 실제 대안 → 선택 기준 → 본인 실행 → 결과 증거 → 한계/판단 변화 중 확인되는 연결이 긴 후보를 우선하세요.
- 결과가 없어도 판단과 실행이 확인되면 후보가 될 수 있습니다. 반대로 결과 숫자만 있고 본인 판단·기여가 없으면 우선순위를 낮추세요.
- 개인정보·고객정보·회사 기밀·환자/학생 정보는 원문을 복사하지 말고 privacy에 표시하고 비식별 표현만 사용하세요.

artifactAnalysis는 내부 메모가 아니라 이후 모든 경험 카드가 참조하는 근거 장부입니다. 빈칸을 추정으로 채우지 말고 missingQuestions/gap으로 남기세요.
`;
}

export function buildFieldKeyExperienceAddon(jobCategory = 'common') {
  const profile = getCareerFieldProfile(jobCategory);
  return {
    schema: `,\n  "jobData": ${profile.schema},\n  "artifactRefs": ["이 경험을 증명하는 ART id"]`,
    guide: `\n[★ 직무 특화 추출 — ${profile.unit} 단위]\n${profile.emphasis}\n중요 증거: ${profile.proofSignals.join(' · ')}\njobData와 artifactRefs는 artifactAnalysis의 근거 장부에 연결하고, 원본에 없는 값은 빈 문자열/빈 배열로 두세요.\n`,
  };
}
