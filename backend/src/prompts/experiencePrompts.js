/**
 * experiencePrompts.js
 * 경험 분석 / 핵심 경험 순간 추출 프롬프트 빌더.
 *
 * ★ 설계 원칙: Pro 모델(2M TPM)의 503 에러를 피하기 위해 프롬프트를 기능별로 분할.
 *   각 빌더는 output JSON 구조를 최소화하여 한 번의 응답이 Pro 한도 내에 들어가도록 함.
 */

const PR_GUIDELINES = `
[10가지 성과 공식 — 가장 잘 맞는 유형으로 분류]
① 성공형(정량성과): 목표 대비 달성률, 매출·사용자 증가 등 수치 성과
② 트러블슈팅형: 장애·버그·병목 문제의 원인 파악→해결→복구 시간 단축
③ 의사결정형: 기술/전략 선택의 논리와 근거, 리소스·리스크 방어
④ 자동화형: 반복 작업 제거, 처리 시간 단축, 인력 절감 효과
⑤ 협업형: 명확한 기여도(%), 이해관계자 조율, 교착 상태 해결
⑥ 무에서유형: 없던 프로세스/시스템/제품을 처음 설계·구축
⑦ 자원부족형: 제약 조건(인력·예산·시간) 안에서 최고 ROI 달성
⑧ 설득형: 데이터/논리로 이해관계자를 설득해 방향 전환 성공
⑨ 피벗형: 계획 변경에도 일정·품질·목표를 지킨 유연한 실행
⑩ 기술형: 성능 최적화, 아키텍처 개선, 기술 부채 해소의 정량 성과
`;

const METRIC_FILTER_GUIDELINES = `
[수치 규칙] 원본에 명시된 %, 시간, 비용, 성능 수치만 사용. 창작 절대 금지.
✅ 허용: 성능(ms/%), 비용(원/$), 시간(일/시간/주), 건수, 비율, 규모(명/개)
❌ 금지: 주관적 표현(만족도↑, 스트레스↓), 의미 없는 양(코드 줄 수), 과장(200% 증가)
※ 원본에 수치가 있으면 반드시 metric/beforeMetric/afterMetric에 채우세요.
`;

// product: 서비스(아이템) 자체 설명 — 포트폴리오 소개의 최우선 블록.
// 개발/테스트/코드 서사가 아니라 "이 서비스가 무엇이고 어떤 사용자 문제를 어떻게 푸는지"를 뽑는다.
const PRODUCT_EXTRACTION_GUIDE = `
[★★ product — 서비스(아이템) 자체 설명 · 소개의 최우선 (가장 중요) ★★]
자료에 발표자료·기획서·PDF의 "Problem/문제" 슬라이드나 시장·사용자 pain point가 있으면 그것이 product의 핵심 재료입니다. 반드시 서비스/사업 관점으로 추출하세요.

- name: 서비스/제품 이름. tagline: 한 줄 소개.
- problem: 이 서비스가 겨냥한 "시장/사용자의 문제". 누가 어떤 상황에서 어떤 불편·비효율을 겪는지, 가능하면 수치 포함.
  ✅ 좋은 예: "취준생이 포트폴리오 제작에 평균 40시간 이상 쓰고, 기업별로 5.2개를 재작성하며, ATS 서류 단계에서 62%가 형식·키워드 미달로 탈락한다"
  ❌ 나쁜 예(개발 서사 절대 금지): "TTV를 측정하려 베타 테스트를 기획했다", "가입~첫 결과 확인 시간을 KPI로 설정했다", "React/Zustand로 상태관리를 최적화했다"
- solution: 그 문제를 서비스가 어떤 방식으로 푸는지 (제품/개념 관점).
  ✅ "경험을 추출·검증·구조화해 재사용 가능한 마스터 DB를 만들고, 이를 바탕으로 다양한 형식의 포트폴리오를 자동 생성한다"
  ❌ "베타 테스트로 검증했다", "온보딩 UI를 최적화했다" (이건 개발/실행 이야기)
- features: 서비스의 핵심 기능 3~6개. 각 { "name": 기능명, "desc": 사용자에게 제공하는 것 한 줄 }.
- outcomes: 정량 성과를 지표/값 쌍으로. 각 { "label": 지표명, "value": 값 }. 원본에 있는 수치만.

⚠ 규칙:
- 개발·테스트·코드·아키텍처·기술스택 이야기는 절대 product.problem/solution에 넣지 마세요. (그건 다른 섹션에서 다룸)
- 자료 어딘가에 서비스/시장 문제 단서가 조금이라도 있으면(특히 "Problem"·"문제 정의"·통계·pain point 슬라이드) 반드시 그것을 problem에 쓰세요. 개발 이야기밖에 없을 때만 빈 값.
`;

const NO_HALLUCINATION_RULES = `
[⛔ 원본에 없는 내용 절대 금지 — 기술명·수치·회사명·역할·상황 창작 불가]
✅ 허용: 원본 내용 요약·재구성·CARL 구조 매핑·명시된 수치 추출
❌ 원본에 없으면: "[작성 필요] (원본에 없음)" 으로 처리
⛔ 이 프롬프트의 예시에 등장하는 수치·기술명·상황(72%, 800ms, 340ms, 1.2s, DAU 120만, 8%, 3일→1일, Redis, 캐시 레이어 등)은 작성 요령을 보여주는 가짜 예시입니다. 원본에 동일한 내용이 없으면 출력에 절대 옮겨 쓰지 마세요.
⛔ 원본에 수치가 없는 문장은 수치 없이 서술하세요. 그럴듯한 수치를 끼워 넣는 것보다 수치 없는 진실한 문장이 훨씬 좋은 포트폴리오입니다.
✅ 시장/업계 자료는 공개 자료 기반의 일반 맥락·벤치마크·의사결정 지표 후보로만 사용
❌ 외부 업계 수치를 사용자의 프로젝트 성과처럼 쓰기 금지. 프로젝트 실제 수치가 없으면 "[검증 필요]" 또는 "[작성 필요]" 로 남김
`;

const MARKET_RESEARCH_RULES = `
[시장·지표 리서치 보강 규칙]
- 가능하면 최신 공개 자료, 공식 문서, 리서치 리포트, 제품 벤치마크, 채용공고/JD에서 확인되는 지표를 참고해 프로젝트 맥락을 풍부하게 만드세요.
- 검색 grounding이 가능하면 sourceNotes에 제목·발행처·URL·확인일을 남기세요. 출처를 확신할 수 없으면 URL을 만들지 말고 "[검증 필요]" 로 표기하세요.
- 채워야 할 것은 "사용자가 실제로 확인하면 좋은 의사결정 지표"입니다. 예: 전환율, 리텐션, 처리시간, 오류율, CAC, ROAS, NPS, 태스크 성공률, 응답시간 p95, 비용/요청, 재작업률 등.
- benchmark나 시장 수치는 "비교 기준"으로만 쓰고, 사용자의 프로젝트 성과로 둔갑시키지 마세요.
- marketResearch.decisionMetrics에는 지표명, 왜 중요한지, 사용자가 확인할 프록시/계산식, 리서치 근거, 신뢰도(high/medium/low)를 넣으세요.
`;

const SLIDE_PORTFOLIO_RULES = `
[슬라이드형 포트폴리오 구성 규칙 — 이미지 레퍼런스 스타일]
- 7개 섹션은 각각 독립적인 한 장의 슬라이드로 읽혀야 합니다.
- 각 슬라이드는 작은 영문 라벨(BACKGROUND/RESEARCH/ACTION/OUTCOME/LEARNING/CAPABILITY), 질문형 또는 문제 제기형 headline, 2~3문장 subcopy, 2~3개의 evidenceCards로 구성하세요.
- evidenceCards는 숫자/근거/의사결정 기준/인사이트를 담되, 원본에 없는 프로젝트 성과 수치는 만들지 마세요. 없으면 "[작성 필요]" 또는 "[검증 필요]"를 명시하세요.
- evidenceCards는 슬라이드마다 같은 카드 제목/본문을 반복하지 마세요. 반드시 해당 섹션 본문에 맞는 서로 다른 역할을 가져야 합니다.
- intro 카드는 프로젝트 배경·목표·기간/팀/역할 같은 소개 정보, overview 카드는 시장/사용자 맥락·검증 지표, task 카드는 담당 과제·문제 상황·오너십, process 카드는 행동·의사결정 기준·대안 비교, output 카드는 산출물·성과·2차 효과, growth 카드는 배운 점·관점 변화, competency 카드는 발휘 역량·입사 후 기여 근거만 담으세요.
- 카드 문장은 1~2줄로 짧게, 슬라이드에 바로 얹을 수 있는 밀도로 작성하세요.
- 디자인 방향은 "흰색/아주 옅은 블루그레이 배경 + 파란 세로 라인 + 정돈된 3열 카드 + 넓은 여백"을 전제로 합니다.
`;

const WRITING_QUALITY_RULES = `
[✍️ 포트폴리오 글쓰기 품질 기준 — 인사담당자 관점]

❌ 즉시 탈락시키는 표현 (절대 사용 금지):
- "열심히", "최선을 다해", "노력했습니다" — 구체성 없는 추상어
- "팀원들과 협력하여" — 나의 기여도가 0%로 보임
- "다양한 경험을 쌓았습니다" — '다양한'은 구체성 없음
- "문제를 해결했습니다" — 어떻게? 결과는? 없음
- "~에 기여했습니다" — 수치·근거 없는 기여 주장
- 수동태 남발 ("~이 진행되었다", "~가 이루어졌다")
- "저는", "안녕하세요", "본 프로젝트는" 으로 시작

✅ 합격하는 포트폴리오의 공통 패턴:
1. 강력한 능동 동사로 시작: 설계·구현·주도·도출·검증·제안·전환·자동화·최적화·구축·분석·기획·리드
2. [구체적 방법] + [측정 가능한 결과]: "캐싱 레이어를 도입해 API 응답 시간을 800ms→320ms(60%)로 단축"
3. 인과관계 명확화: "~하기 위해 ~를 선택했고, 결과적으로 ~을 달성함"
4. 비즈니스 맥락 연결: 기술 작업이 비즈니스에 어떤 가치를 가져왔는지 반드시 포함
5. 수치 없어도 구체화: 건수·기간·규모·빈도·팀 규모라도 반드시 포함
6. 나의 역할을 명확히: "팀 전체"가 아닌 "내가 직접 설계·주도한 것"을 분리해서 서술
`;

// ============================================================
// 국내외 대기업 합격 포트폴리오 기법 (Google/Amazon/Meta/Naver/Kakao/Toss)
// ============================================================
const GLOBAL_PORTFOLIO_TECHNIQUES = `
[🌐 국내외 대기업 합격 포트폴리오 기법 — 아래 기법을 최대한 반영하세요]

【1】 Google XYZ 공식 (Google 공식 채용 가이드)
  패턴: "Accomplished [X] as measured by [Y] by doing [Z]"
  → "캐시 레이어 도입(Z)으로 API 응답 시간을 72% 단축(Y)해 월간 사용자 이탈률 8% 감소(X)를 달성"
  ★ 핵심: 성과(X)를 측정값(Y)으로 증명하고, 방법(Z)을 구체적으로 명시

【2】 Amazon 리더십 원칙 반영 (글로벌 테크 기업 공통 적용)
  - Ownership: "내가 직접 오너십을 가지고 끝까지 책임진 영역"을 명시
  - Bias for Action: "불확실한 상황에서도 빠르게 판단하고 실행한 결정"
  - Frugality: "제한된 리소스(인력/예산/시간)로 최대 성과를 낸 방법" 
  - Think Big: "이 경험이 더 큰 아키텍처/전략에 어떻게 연결되는가"
  → competency 섹션과 action에 이 관점을 녹여 작성하세요.

【3】 Toss/카카오 스타일 — 임팩트 우선 역순 피라미드
  - 첫 문장에 가장 큰 결과·수치를 배치 (피라미드 구조)
  - "이 경험으로 [비즈니스 지표]가 [X] 변했다" 형태로 비즈니스 연결 필수
  - 기술 용어를 쓰더라도 비개발자 면접관이 이해할 수 있도록 임팩트 언어로 번역

【4】 Naver/삼성 스타일 — 스케일과 복잡도 증명
  - 처리한 데이터 규모, 동시 접속자 수, 트래픽 수준 등 "스케일"을 명시
  - 기술적 난이도(복잡도, 레거시 환경, 제약 조건)를 설명해 "이 일이 쉽지 않았음"을 보여줌
  - 여러 부서/팀과의 협업 조율 과정과 이해관계 충돌 해결 방식 포함

【5】 Second-Order Effect (2차 효과) — 상위 5% 포트폴리오의 비밀
  - 직접 성과만 쓰지 말고, 그 성과가 이끌어낸 후속 변화도 서술
  - 패턴: "[직접 성과] → 이로 인해 [팀/조직/서비스에 생긴 변화] → 결과적으로 [비즈니스 임팩트]"
  - 예: "API 72% 단축 → 모바일 이탈률 감소 → 분기 전환율 목표 초과 달성"

【6】 Counter-Intuitive Insight (비상식적 발견) — 차별화 포인트
  - 누구나 하는 결론이 아닌, 이 경험에서 발견한 비직관적 인사이트를 growth/learning에 포함
  - 패턴: "처음에는 [상식적 접근]을 시도했으나, [예상과 다른 발견]을 확인하고 [다른 방향]으로 전환했다"
  - 이 관점이 있는 포트폴리오는 면접관 기억에 남음

【7】 Trade-off 서술 — 엔지니어링/기획 판단력 증명
  - "왜 A가 아닌 B를 선택했는가"를 반드시 포함 (대안 비교)
  - 예: "Redis vs Memcached 중 Redis를 선택한 이유는 Pub/Sub 지원이 필요했기 때문"
  - 선택의 비용과 이점을 명시: "단기 복잡도를 감수하고 장기 확장성을 확보"

【8】 Scope of Impact (영향 범위 명시) — 글로벌 기업 필수 요소
  - 내 작업이 영향을 미친 범위를 구체적으로: 사용자 수, 팀 수, 매출 비율, 글로벌/국내
  - 예: "DAU 120만 서비스에서", "전체 백엔드 팀 6명 중 내가 단독으로", "회사 전체 인프라 비용의 30%를 담당하는 시스템에서"
`;

// ============================================================
// 직군별 특화 섹션 정의 (ex.md 기반)
// ============================================================
const JOB_META = {
  common: { label: '전 직군 공통', sections: [] },
  dev: {
    label: '개발자 (FE/BE)',
    emphasis: '기술 선택의 논리, 트러블슈팅 과정, 수치화된 성능 개선에 집중하세요.',
    sections: [
      { key: 'techStack',       label: '기술 스택 & 기술 선택',  guide: '사용 기술명·버전, 선택 이유(대안과 비교), 기술 선택의 논리적 근거가 핵심.' },
      { key: 'architecture',    label: '시스템 아키텍처 & 설계',  guide: '시스템 구조(컴포넌트/레이어), 데이터 흐름, 주요 설계 결정과 trade-off(확장성·일관성·성능 사이의 선택)를 구체적으로 서술.' },
      { key: 'troubleshooting', label: '트러블슈팅 및 로직',     guide: '발생한 기술 문제(버그·성능병목·메모리 누수 등), 원인 파악 과정, 적용한 해결책, 효과를 단계별로 서술.' },
      { key: 'optimization',    label: '코드 최적화 성과',       guide: '렌더링 속도, API 응답 시간, 메모리·번들 사이즈 등 기술적 지표 before→after 수치로 명시.' },
    ],
  },
  aiml: {
    label: 'AI / ML 엔지니어',
    emphasis: '데이터 전처리 로직, 모델 선택 근거, 정량적 성능 지표, 추론 최적화에 집중하세요.',
    sections: [
      { key: 'datasetArch', label: '데이터셋 및 아키텍처',       guide: '사용 데이터셋 특성·규모, 전처리 로직, 모델 아키텍처 선택 이유(다른 모델과 비교). 학습 환경 포함.' },
      { key: 'evaluation',  label: '학습 및 평가 (Evaluation)',  guide: 'Accuracy·F1·AUC 등 정량 지표, 과적합 통제 방법(드롭아웃·얼리스탑 등), 검증/테스트 설계.' },
      { key: 'serving',     label: '최적화 및 서빙',             guide: '모델 경량화(양자화·프루닝 등), 추론(Inference) 속도 개선, 온디바이스·API 배포 방식과 성과 수치.' },
    ],
  },
  da: {
    label: '데이터 애널리스트',
    emphasis: '데이터 파이프라인 구축, 가설 검증 설계, 비즈니스 의사결정에 연결된 인사이트에 집중하세요.',
    sections: [
      { key: 'pipeline',        label: '데이터 파이프라인 & EDA', guide: '데이터 수집·정제·변환 방법, 사용 툴(SQL·Python·Spark 등), 이상치·결측치 처리 기준, 주요 EDA 발견점.' },
      { key: 'hypothesis',      label: '가설 검증 (A/B Test)',    guide: '검증 가설, 실험 설계(대조군·실험군 분리 방법), 통계적 유의성(p-value·신뢰구간) 검증 결과.' },
      { key: 'businessInsight', label: '비즈니스 인사이트',        guide: '분석 결과에서 도출한 액션 플랜, 실제 의사결정에 반영된 내용, 이후 지표 변화(KPI 개선 등).' },
    ],
  },
  devops: {
    label: '인프라 / 데브옵스',
    emphasis: '인프라 구조 설계 의사결정, 자동화로 인한 리드타임 단축, 비용·트래픽 최적화 수치에 집중하세요.',
    sections: [
      { key: 'infraArch',    label: '시스템 아키텍처',          guide: '클라우드 서비스 구성(AWS·GCP·Azure 등), 주요 컴포넌트 선택 이유, HA·DR·보안 설계 결정 배경.' },
      { key: 'cicd',         label: 'CI/CD 파이프라인',        guide: '구축한 파이프라인 단계(빌드·테스트·배포), 사용 툴(GitHub Actions·Jenkins 등), 배포 주기·리드타임 개선 수치.' },
      { key: 'costOptimize', label: '비용 및 트래픽 최적화',    guide: '클라우드 리소스 비용 절감(금액·%), 오토스케일링·로드밸런싱 전략, 트래픽 급증 대응 결과.' },
    ],
  },
  pm: {
    label: '기획자 / PM',
    emphasis: '문제 정의와 해결 전략의 논리, MSC 달성 여부, 비즈니스 임팩트 데이터에 집중하세요.',
    sections: [
      { key: 'strategy',       label: '해결 전략 및 기획 의도',  guide: '문제 정의, 핵심 기능 선정 기준(우선순위화 방법), 유저 플로우 설계, 이해관계자 설득 과정.' },
      { key: 'msc',            label: 'MSC (최소 성공 기준)',   guide: '처음 설정한 최소 성공 기준(지표·수치 기준), 중간 점검 과정, 최종 달성 여부와 차이가 있었다면 원인 분석.' },
      { key: 'businessImpact', label: '비즈니스 임팩트',        guide: '런칭 후 DAU·전환율·매출 등 유저 데이터 변화, 타 부서(개발·디자인·마케팅) 협업·설득 커뮤니케이션 사례.' },
    ],
  },
  designer: {
    label: '프로덕트 디자이너 (UI/UX)',
    emphasis: '유저 리서치 기반 문제 접근, 사용성 테스트 before/after, 디자인 시스템 체계화에 집중하세요.',
    sections: [
      { key: 'researchApproach', label: '리서치 및 문제 접근',  guide: '사용한 리서치 방법(유저 인터뷰·설문·더블다이아몬드 등), 발견한 Pain Point, 문제 정의 과정.' },
      { key: 'prototyping',      label: '프로토타이핑 및 개선', guide: '프로토타입 단계별 진행, 사용성 테스트 결과(정량·정성), 피드백을 반영한 UI 개선 before/after.' },
      { key: 'designSystem',     label: '디자인 시스템',        guide: '구축한 컴포넌트·토큰(컬러·타이포·여백) 규격, 적용 범위, 팀 협업 효율 개선 효과.' },
    ],
  },
  marketer: {
    label: '마케터 (콘텐츠/퍼포먼스)',
    emphasis: '타겟 페르소나 설정 논리, 채널 믹스 전략, ROAS·CVR·CTR 수치 성과에 집중하세요.',
    sections: [
      { key: 'mediaStrategy', label: '매체 전략 및 타겟팅',    guide: '타겟 페르소나 설정 기준, 채널(메타·구글·카카오 등) 선택 이유와 믹스 비율, 크리에이티브 전략.' },
      { key: 'kpi',           label: '핵심 성과 지표 (KPI)',  guide: 'ROAS·CVR·CTR·CPA·CAC 등 캠페인 목표 지표와 실제 달성 수치, 기간별 추이, 최적화 액션.' },
    ],
  },
  hr: {
    label: '인사 / 채용 담당자',
    emphasis: '채용 리드타임 단축, 퍼널 전환율, 온보딩·리텐션 전략의 구체적 수치에 집중하세요.',
    sections: [
      { key: 'hiringPipeline', label: '채용 파이프라인 기획',  guide: '설계한 채용 단계, 서류·코딩테스트·면접 자동화/효율화 방법, 리드타임 단축 효과(일 기준).' },
      { key: 'funnelData',     label: '퍼널 데이터',          guide: '소싱 채널별 유입 수, 단계별 전환율(서류→면접→합격), 개선 전후 비교 수치.' },
      { key: 'retention',      label: '조직 문화 및 리텐션',  guide: '온보딩 프로그램 설계 내용, 직원 만족도·퇴사율 방어 전략, 실제 리텐션 지표 변화.' },
    ],
  },
  sales: {
    label: 'B2B 세일즈 / 사업개발',
    emphasis: '리드 발굴 전략, 세일즈 퍼널 전환율, 계약 규모(ARR/MRR) 성과에 집중하세요.',
    sections: [
      { key: 'leadGen',        label: '리드 제너레이션 전략',  guide: '인바운드·아웃바운드 방법론, 유효 리드 발굴 채널, 발굴 리드 수·질 개선 방법.' },
      { key: 'salesFunnel',    label: '세일즈 퍼널 데이터',   guide: '초기 미팅→제안→협상→클로징 단계별 전환율, 평균 세일즈 사이클, 이탈 원인 분석.' },
      { key: 'contractResult', label: '계약 성과',            guide: '신규 계약 건수·규모(ARR/MRR), 기존 고객 업셀링 성과, 최대 단일 계약 금액 등 수치 성과.' },
    ],
  },
};

// ============================================================
// 직무별 핵심 경험 추출 스키마 (keyExperiences[].jobData)
//   직무마다 "핵심 경험"의 단위와 구성 요소가 다르다:
//   마케터=캠페인, PM=의사결정, 디자이너=개선 반복, DA=분석, HR=프로그램, 세일즈=딜, AI/ML=실험, 데브옵스=인시던트/개선.
//   개발자가 커밋에서 코드·트러블슈팅을 추출하듯, 각 직무의 고유 요소를 구조화해 추출한다.
// ============================================================
const JOB_KEYEXP_META = {
  marketer: {
    unit: '캠페인/실험',
    guide: '각 핵심 경험을 하나의 캠페인 단위로 추출: 누구에게(타겟)·어디서(채널)·어떤 메시지로 집행해 어떤 KPI를 얻었는지가 반드시 드러나야 합니다.',
    schema: '{ "target": "타겟 페르소나·세그먼트 (예: 2534 직장인 여성)", "channels": ["집행 채널 (예: 메타, 구글)"], "creative": "크리에이티브·메시지 전략 한 줄", "kpis": [ { "name": "ROAS", "value": "350%" } ] }',
  },
  pm: {
    unit: '의사결정',
    guide: '각 핵심 경험을 하나의 프로덕트 의사결정 단위로 추출: 무엇을 하기로 결정했고, 어떤 대안을 왜 기각했으며, 누구를 어떻게 설득했고, 결과를 어떻게 검증했는지.',
    schema: '{ "decision": "내린 핵심 결정 한 문장", "alternatives": "고려한 대안과 기각 이유 1문장", "stakeholders": "설득·협업한 이해관계자와 방법 1문장", "validation": "결정 검증 방법과 결과 (데이터·실험)", "impact": "1~5 정수 — 이 결정의 비즈니스 임팩트 크기", "effort": "1~5 정수 — 투입된 리소스·난이도" }',
  },
  designer: {
    unit: '개선 반복',
    guide: '각 핵심 경험을 하나의 디자인 개선 반복(iteration)으로 추출: 발견한 페인포인트 → 디자인 결정(왜 이 UI인지) → 테스트·검증 결과.',
    schema: '{ "painPoint": "발견한 사용자 페인포인트 1문장", "designDecision": "디자인 결정과 이유 1~2문장", "testResult": "사용성 테스트·검증 결과 (수치 있으면 포함)" }',
  },
  da: {
    unit: '분석',
    guide: '각 핵심 경험을 하나의 분석 단위로 추출: 가설 → 분석 방법·도구 → 데이터에서 발견한 사실 → 실행된 비즈니스 액션.',
    schema: '{ "hypothesis": "검증한 가설 1문장", "method": "분석 방법·도구 (SQL, A/B 테스트, 코호트 등)", "finding": "데이터에서 발견한 사실 (수치 포함)", "businessAction": "이 발견으로 실행된 비즈니스 액션", "control": "대조군(기존) 수치 (예: 2.1%) — A/B 비교가 있을 때만", "variant": "실험군(개선) 수치 (예: 3.4%)", "significance": "통계 유의성 (예: p<0.05, 신뢰수준 95%)" }',
  },
  hr: {
    unit: '프로그램/제도',
    guide: '각 핵심 경험을 하나의 인사 프로그램·제도 단위로 추출: 조직 과제 → 설계한 프로세스 → 퍼널·지표 변화.',
    schema: '{ "goal": "해결하려던 조직·채용 과제 1문장", "program": "설계·운영한 프로그램/프로세스", "funnelChange": "퍼널·지표 변화 (전환율·리드타임 등 수치)" }',
  },
  sales: {
    unit: '딜/계약',
    guide: '각 핵심 경험을 하나의 딜 단위로 추출: 고객(익명화 가능) → 접근·제안 전략 → 협상 포인트 → 계약 성과.',
    schema: '{ "client": "고객사·세그먼트 (예: 제조 대기업 A사)", "approach": "접근·제안 전략 1~2문장", "negotiation": "협상 포인트와 돌파 방법 1문장", "dealSize": "계약 규모 (ARR·MRR·금액, 원본에 있을 때만)", "stage": "딜 진행 단계 (리드·미팅·제안·협상·계약 중 하나, 원본에서 유추 가능할 때만)" }',
  },
  aiml: {
    unit: '실험/모델',
    guide: '각 핵심 경험을 하나의 ML 실험 단위로 추출: 데이터 → 모델 선택(대안 대비 왜) → 평가 지표 결과.',
    schema: '{ "dataset": "데이터셋·규모", "model": "사용 모델/아키텍처", "whyModel": "이 모델을 선택한 이유 (대안 비교)", "metrics": [ { "name": "F1", "value": "0.92", "baseline": "비교 기준(베이스라인) 수치 — 원본에 있을 때만" } ] }',
  },
  devops: {
    unit: '인시던트/개선',
    guide: '각 핵심 경험을 하나의 인시던트 대응 또는 인프라 개선 단위로 추출: 상황 → 원인 분석 → 조치·자동화 → 지표 개선.',
    schema: '{ "incident": "상황 (장애·비용·병목) 1문장", "rootCause": "원인 분석 결과 1문장", "actionTaken": "적용한 조치·자동화", "impact": "지표 개선 (가용성·비용·리드타임)" }',
  },
};
// keyExperience 프롬프트에 붙일 직무별 스키마·지침
function buildKeyExpJobAddon(jobCategory) {
  const m = JOB_KEYEXP_META[jobCategory];
  if (!m) return { schema: '', guide: '' };
  return {
    schema: `,\n  "jobData": ${m.schema}`,
    guide: `\n[★ 직무 특화 추출 — ${m.unit} 단위]\n${m.guide}\njobData의 각 필드는 원본에 근거해 채우고, 근거 없는 필드는 빈 문자열/빈 배열로 두세요. context/action/result도 ${m.unit} 관점으로 서술하세요.\n`,
  };
}

// ============================================================
// 직무별 포트폴리오 시각화 데이터 (portfolioVisuals)
//   각 직무 화면이 퍼널·KPI·덤벨비교·채널믹스·MSC보드·프로세스 중 무엇을 그릴지 다르므로,
//   직무별로 채울 블록만 지시한다. 수치는 반드시 원본에 있는 것만 사용(창작 금지).
// ============================================================
const VISUAL_BLOCK_SCHEMAS = {
  kpis:    '"kpis": [ { "label": "지표명(예: ROAS)", "value": "수치+단위(예: 350%)", "target": "목표치(원본에 있을 때만)", "note": "짧은 맥락(선택)" } ]',
  funnel:  '"funnel": { "stages": [ { "label": "단계명", "value": 숫자 } ] }',
  funnelCompare: '"funnelCompare": { "stages": [ { "label": "단계명", "before": "개선 전 수치(전환율·인원)", "after": "개선 후 수치" } ] }',
  compare: '"compare": [ { "label": "지표명", "before": "개선 전 수치", "after": "개선 후 수치", "unit": "단위(선택)" } ]',
  mix:     '"mix": { "items": [ { "label": "채널/항목명", "pct": 숫자(비중%) } ] }',
  goals:   '"goals": [ { "label": "목표 문장", "target": "목표 수치", "actual": "실제 수치", "achieved": true|false } ]',
  gauges:  '"gauges": [ { "label": "지표명(예: 가용성)", "value": "현재 수치(예: 99.95)", "unit": "단위(예: %)", "target": "목표치(원본에 있을 때만)" } ]',
  timeline: '"timeline": { "phases": [ { "label": "단계명", "start": 시작(숫자, 상대 주·월 등), "span": 기간(숫자), "desc": "1문장(선택)" } ] }',
  process: '"process": { "steps": [ { "label": "단계명", "desc": "1문장 설명" } ] }',
};
const JOB_VISUAL_GUIDES = {
  aiml:     { blocks: ['kpis', 'compare', 'process'], hint: 'kpis=Accuracy·F1·AUC 등 평가 지표, compare=경량화·추론속도 최적화 전후, process=데이터수집→전처리→학습→평가→서빙 실제 수행 단계' },
  da:       { blocks: ['compare', 'kpis', 'funnel'],  hint: 'compare=A/B 실험 지표 전후, kpis=핵심 분석 지표, funnel=사용자 여정 단계별 전환(원본에 단계 수치가 있을 때만)' },
  devops:   { blocks: ['gauges', 'process', 'compare', 'kpis'], hint: 'gauges=가용성·SLA 달성률·MTTR 등 "목표 대비 현재" 게이지 지표(가용성은 %, 목표치 있으면 target), process=CI/CD 파이프라인 단계(빌드→테스트→배포 등 실제 구성), compare=비용·배포 리드타임 전후, kpis=배포 빈도 등 운영 지표' },
  pm:       { blocks: ['goals', 'timeline', 'kpis', 'process'],   hint: 'goals=MSC(최소 성공 기준) 목표별 target/actual/achieved, timeline=프로젝트 로드맵 단계별 start/span(원본에 기간·순서 단서가 있을 때만, 상대 단위 주·월), kpis=DAU·전환율·매출 등 임팩트, process=문제정의→가설→실행→검증 흐름' },
  designer: { blocks: ['process', 'compare', 'kpis'], hint: 'process=실제 수행한 디자인 프로세스(리서치→정의→프로토타입→테스트 등), compare=사용성 테스트 전후 지표, kpis=과업성공률·만족도 등' },
  marketer: { blocks: ['kpis', 'funnel', 'mix', 'compare'], hint: 'kpis=ROAS·CVR·CTR·CPA(목표치 있으면 target), funnel=노출→클릭→전환 수치, mix=채널별 예산/성과 비중(%), compare=최적화 전후' },
  hr:       { blocks: ['funnel', 'funnelCompare', 'kpis', 'compare'],  hint: 'funnel=지원→서류→면접→최종합격 인원, funnelCompare=프로세스 개선 전후의 단계별 전환율·인원(전후 수치가 모두 원본에 있을 때만, 증가 방향 지표 위주), kpis=채용 리드타임·리텐션, compare=프로세스 개선 전후(리드타임 등)' },
  sales:    { blocks: ['funnel', 'kpis', 'compare'],  hint: 'funnel=리드→미팅→제안→계약 건수, kpis=ARR·MRR·계약 건수·평균 계약 규모, compare=전환율·사이클 개선 전후' },
  common:   { blocks: ['kpis', 'compare'],            hint: 'kpis=원본의 정량 성과, compare=개선 전후 수치' },
};
function buildVisualPrompt(jobCategory) {
  const g = JOB_VISUAL_GUIDES[jobCategory];
  if (!g) return { schema: '', guide: '' };
  const schema = ',\n  "portfolioVisuals": {\n    ' + g.blocks.map(b => VISUAL_BLOCK_SCHEMAS[b]).join(',\n    ') + '\n  }';
  const guide = `\n[portfolioVisuals — 직무 전용 시각화 데이터 (이 직군 화면의 차트가 이 데이터로 그려짐)]\n${g.hint}\n- 수치·단계는 반드시 원본 자료에 근거한 것만 넣으세요. 수치를 창작하지 마세요.\n- 근거가 없는 블록은 빈 배열([]) 또는 생략하세요. funnel/process는 단계 2개 이상일 때만.\n`;
  return { schema, guide };
}

// 아키텍처 다이어그램으로 시각화할 직군별 섹션 (dev=architecture, aiml=datasetArch, devops=infraArch)
const DIAGRAM_SECTIONS = {
  architecture: { struct: '시스템',                tierHint: '0=클라이언트, 1=API/서버, 2=DB/캐시/외부연동' },
  datasetArch:  { struct: '모델·데이터 파이프라인', tierHint: '0=데이터 소스·수집, 1=전처리·피처, 2=모델·학습, 3=평가·서빙' },
  infraArch:    { struct: '인프라',                tierHint: '0=사용자·엣지, 1=LB·게이트웨이, 2=서비스·컨테이너, 3=DB·스토리지·모니터링' },
};
function diagramSectionOf(sections) {
  const s = (sections || []).find(x => DIAGRAM_SECTIONS[x.key]);
  return s ? { key: s.key, ...DIAGRAM_SECTIONS[s.key] } : null;
}

// ============================================================
// 빠른 초안(Draft) — 단일 호출용 경량 프롬프트
//   목적: 검색·분할 없이 flash 1회로 "봐줄 수준"의 초안을 빠르게 생성.
//   깊이 있는 보강(시장지표/검색/핵심경험 N개)은 이후 analyze 단계가 담당.
// ============================================================
export function buildDraftAnalysisPrompt(contentText, jobCategory = 'common') {
  const jobInfo = JOB_META[jobCategory] || JOB_META.common;
  const jobSecs = jobInfo.sections || [];
  const diagSec = diagramSectionOf(jobSecs);
  const jobSpecificSchema = jobSecs.length
    ? ',\n  "jobSpecific": {\n' + jobSecs.map(s => `    "${s.key}": "${s.label} 초안 (원본 단서 기반 2~4문장, 단서 없으면 빈 문자열)"`).join(',\n') + '\n  }'
    : '';
  const archSchema = diagSec
    ? ',\n  "architectureDiagram": { "nodes": [ { "id": "영문고유id", "label": "컴포넌트/단계명", "tech": "기술·역할", "tier": 0 } ], "edges": [ { "from": "노드id", "to": "노드id", "label": "관계/흐름(예: REST, 학습 데이터, 배포)" } ] },\n  "flowDiagram": { "nodes": [ { "id": "영문고유id", "label": "흐름 단계명", "tech": "이 단계에서 일어나는 일", "tier": 0 } ], "edges": [ { "from": "노드id", "to": "노드id", "label": "전환 행동/조건" } ] }'
    : '';
  const visual = buildVisualPrompt(jobCategory);
  const keyExpAddon = buildKeyExpJobAddon(jobCategory);
  const jobGuide = jobSecs.length
    ? `\n[직군 특화 섹션 — jobSpecific (면접관이 가장 먼저 보는 핵심)]\n${jobSecs.map(s => `- ${s.key}: ${s.guide}`).join('\n')}\n원본에 단서가 있으면 2~4문장으로 채우고, 전혀 없으면 빈 문자열로 두세요. (정성적 재구성은 권장, 사실 창작은 금지)${diagSec ? `\n[architectureDiagram] ${diagSec.struct} 구조를 박스(nodes)와 연결선(edges)으로 상세히 구조화하세요. 노드 5~9개로 충분히 디테일하게 — 클라이언트/서버뿐 아니라 인증·외부 API·저장소·핵심 도메인 모듈 등 구성요소를 분리하고, 각 노드 tech에는 실제 기술명(예: React, Node.js·Express, Firestore, Google Gemini API)을 적으세요. id는 영문 고유값, tier는 위→아래 0부터(예: ${diagSec.tierHint}). edges의 label에는 관계/흐름(예: API 요청, 조회/저장, 연동)을 적고 from/to는 반드시 존재하는 노드 id여야 합니다. 추론할 단서가 전혀 없으면 nodes/edges를 빈 배열로 두세요.\n[flowDiagram] 기술 컴포넌트가 아니라 "이 서비스(아이템)가 사용자 관점에서 어떻게 흘러가는지"를 단계 박스로 그리세요 (예: 사용자 진입 → QR 교환 → 카드 수집 → 가챠 → 리포트 전달). 노드 3~7개, tier는 흐름 순서대로 0부터 1씩 증가, label은 단계 이름, tech에는 그 단계에서 일어나는 일을 짧게. 자료에 서비스 흐름 단서가 전혀 없으면 nodes/edges를 빈 배열로 두세요.` : ''}${visual.guide}`
    : '';
  return `당신은 포트폴리오 작성을 돕는 커리어 코치입니다.
아래는 지원자의 경험 자료와 인터뷰 답변입니다. 이를 바탕으로 포트폴리오 "초안"을 빠르게 작성하세요.
완성본이 아니라 초안이지만, 그대로 읽어도 어색하지 않은 자연스러운 한국어가 되어야 합니다.
대상 직군: ${jobInfo.label}

${NO_HALLUCINATION_RULES}

${WRITING_QUALITY_RULES}

[초안 작성 규칙]
- 목표: 사용자가 읽고 "이 정도면 AI로 더 다듬고 싶다"는 생각이 들 만큼, 각 섹션에 읽을 수 있는 가닥을 잡아주세요. 초안이라 완벽하지 않아도 되지만 비어 보이면 안 됩니다.
- 자료에 단서가 조금이라도 있으면 그것을 요약·재구성해 해당 섹션을 2~3문장으로 채우세요. 무엇을 했는지·왜 했는지·어떻게 했는지 같은 정성적 내용은 적극적으로 풀어 쓰세요.
- ⛔ 단, 수치·기술명·회사명·고유명사·성과는 자료에 없으면 절대 지어내지 마세요. (정성적 재구성은 권장, 사실 창작은 금지)
- 정말 아무 단서도 없는 섹션만 빈 문자열("")로 두세요. "~을 보강해 주세요" 같은 안내 문구는 넣지 마세요.
- 같은 문장을 여러 섹션에 그대로 복사하지 마세요. 각 섹션의 역할에 맞게 다르게 정리하세요.
- 인터뷰 답변의 구어체("~했어요")는 포트폴리오 문체("~함/~했다")로 자연스럽게 다듬으세요.
- keyExperiences는 자료에서 구분되는 활동·문제·성과를 1~3개로 정리하세요. 수치가 없어도 context/action/result/learning을 정성적으로 채우고, 정말 단서가 없을 때만 빈 배열로 두세요.
- keyExperiences는 수치만 남기지 마세요. 수치는 metric에 넣고, context/action/result/learning에는 답변 속 문제 전후상황, 실행 과정, 결과 해석, 배운 점을 각각 1~3문장으로 보존하세요.
- "인터뷰구조화" 입력이 있으면 그 안의 context/action/result/learning을 우선 사용하되 자연스럽게 다듬으세요.
- 시장/성과 지표는 외부 출처를 지어내지 말고, 사용자가 추가 검증할 decisionMetrics와 portfolioAngles 수준으로만 제안하세요.

[섹션 역할]
- intro: 가장 큰 성과/핵심을 앞세운 2~3문장 요약
- overview: 프로젝트 배경·목적·범위
- task: 내가 직접 맡은 과제와 문제
- process: 행동과 의사결정 과정 (왜 그렇게 했는지)
- output: 결과·산출물 (수치가 있으면 포함)
- growth: 배운 점·관점 변화
- competency: 드러난 역량과 기여

경험 자료:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "product": { "name": "", "tagline": "", "problem": "", "solution": "", "features": [ { "name": "", "desc": "" } ], "outcomes": [ { "label": "", "value": "" } ] },
  "projectOverview": { "summary": "", "background": "", "goal": "", "role": "", "team": "", "duration": "", "techStack": [] },
  "marketResearch": {
    "marketOverview": "",
    "decisionMetrics": [
      { "metric": "", "whyItMatters": "", "recommendedProxy": "", "researchBasis": "인터뷰 답변 기반 또는 [검증 필요]", "confidence": "high|medium|low" }
    ],
    "sourceNotes": [],
    "portfolioAngles": [],
    "limitations": ""
  },
  "intro": "", "overview": "", "task": "", "process": "", "output": "", "growth": "", "competency": "",
  "keyExperiences": [
    { "title": "", "metric": "", "metricLabel": "", "beforeMetric": "", "afterMetric": "", "context": "", "action": "", "result": "", "learning": "", "keywords": [], "chartType": "horizontalBar"${keyExpAddon.schema} }
  ],
  "keywords": []${jobSpecificSchema}${archSchema}${visual.schema}
}
${PRODUCT_EXTRACTION_GUIDE}${jobGuide}${keyExpAddon.guide}
수치·기술명·고유명사·성과는 자료에 없으면 지어내지 마세요. 단, 자료에 단서가 있는 정성적 내용은 최대한 재구성해 채우고, 정말 단서가 없는 필드만 빈 문자열/빈 배열로 두세요.`;
}

// ============================================================
// 분할 Step 1: 프로젝트 개요 + 7개 공통 섹션 + 직군 특화 섹션 추출
// ============================================================
export function buildOverviewPrompt(contentText, jobCategory = 'common') {
  const jobInfo = JOB_META[jobCategory] || JOB_META.common;
  const hasJobSections = jobInfo.sections.length > 0;

  // 직군 특화 섹션 지시문 생성
  const jobSectionGuides = hasJobSections
    ? jobInfo.sections.map(s => `    - "${s.key}": "${s.label}" — ${s.guide}`).join('\n')
    : '';

  // 직군 특화 섹션 JSON 스키마 생성
  const jobSectionSchema = hasJobSections
    ? ',\n  "jobSpecific": {\n' +
      jobInfo.sections.map(s => `    "${s.key}": "상세 내용 (원본 기반, 3~5문장으로 풍부하게)"`).join(',\n') +
      '\n  }'
    : '';

  // 아키텍처 다이어그램 스키마 (다이어그램 섹션이 있는 직군: dev·aiml·devops)
  const diagSec = diagramSectionOf(jobInfo.sections);
  const archSchema = diagSec
    ? ',\n  "architectureDiagram": { "nodes": [ { "id": "영문고유id", "label": "컴포넌트/단계명", "tech": "기술·역할", "tier": 0 } ], "edges": [ { "from": "노드id", "to": "노드id", "label": "관계/흐름" } ] },\n  "flowDiagram": { "nodes": [ { "id": "영문고유id", "label": "흐름 단계명", "tech": "이 단계에서 일어나는 일", "tier": 0 } ], "edges": [ { "from": "노드id", "to": "노드id", "label": "전환 행동/조건" } ] }'
    : '';
  const archGuide = diagSec
    ? `\n[architectureDiagram] ${diagSec.struct} 구조를 박스(nodes)와 연결선(edges)으로 구조화하세요. 노드 3~8개, id는 영문 고유값, tier는 위→아래 0부터(${diagSec.tierHint}). edges의 from/to는 반드시 존재하는 노드 id여야 합니다. 단서가 전혀 없으면 nodes/edges를 빈 배열로 두세요.\n[flowDiagram] 기술 컴포넌트가 아니라 "이 서비스(아이템)가 사용자 관점에서 어떻게 흘러가는지"를 단계 박스로 그리세요 (예: 사용자 진입 → 핵심 행동 → 보상/결과 → 재방문). 노드 3~7개, tier는 흐름 순서대로 0부터 1씩 증가. 서비스 흐름 단서가 전혀 없으면 nodes/edges를 빈 배열로 두세요.\n`
    : '';
  const visual = buildVisualPrompt(jobCategory);

  const jobEmphasis = hasJobSections
    ? `\n[★ 직군 강조 — ${jobInfo.label}]\n${jobInfo.emphasis}\n직군 특화 섹션(jobSpecific)은 면접관이 가장 먼저 보는 핵심 파트입니다. 원본의 관련 내용을 최대한 끌어모아 풍부하게 서술하세요.\n`
    : '';

  const section7Guide = `
[7개 필수 섹션 — 각 섹션을 최소 3문장, 아래 기준으로 작성]
※ Google XYZ 공식("Accomplished X as measured by Y by doing Z")과 Second-Order Effect를 각 섹션에 반영하세요.

1. intro (강렬한 도입부, 3~4문장)
   - 【피라미드 구조】 첫 문장에 가장 큰 결과·수치 배치 (Toss/카카오 스타일)
   - 패턴: "[방법론/기술(Z)]으로 [구체적 문제]를 해결해 [수치로 측정된 성과(Y)] → [비즈니스 임팩트(X)] 달성"
   - 두 번째 문장: 스케일 or 복잡도 ("DAU 120만 서비스에서", "레거시 환경에서 6명이서" 등)
   - 세 번째 문장: 이 경험이 만들어낸 2차 효과 또는 지원 직무와의 연결

2. overview (프로젝트 전체 맥락, 3~5문장)
   - 왜 이 프로젝트가 필요했는가 (비즈니스 문제·기회) → 어떤 목표를 설정했는가 → 전체 범위
   - 【Scope of Impact】 사용자 수, 팀 규모, 기간, 처리 데이터 규모, 매출 영향 등 수치로 스케일 표현
   - 이해관계자는 누구였는가, 왜 이 프로젝트가 비즈니스적으로 중요했는가

3. task (내가 담당한 과제, 3~5문장)
   - "팀이"가 아닌 "내가" 직접 수행한 것 명시 【Amazon Ownership 원칙】
   - 흐름: 배경 → 문제 인식 → 핵심 과제 → 접근 방향
   - 내가 담당한 범위의 복잡도·난이도를 명시 (Naver/삼성 스타일)

4. process (행동과 의사결정 과정, 3~5문장)
   - 【Trade-off 서술】 왜 A가 아닌 B를 선택했는지 대안 비교 포함
   - 【Bias for Action】 불확실한 상황에서도 빠르게 판단하고 실행한 결정 포함
   - 능동 동사로 각 액션 서술: "설계했다", "분석했다", "전환했다", "설득했다"
   - 이해관계자 조율, 반대 의견 극복, 제약 조건 내 창의적 해결 포함

5. output (성과와 산출물, 3~5문장)
   - 【Google XYZ】 수치(Y)를 포함한 성과(X)와 방법(Z)을 연결해 서술
   - 【Second-Order Effect】 직접 성과 → 그로 인한 팀/조직/비즈니스 변화 → 최종 임팩트까지 체인으로 서술
   - 예: "응답 72% 단축 → 이탈률 감소 → 분기 전환율 목표 초과"

6. growth (성장·인사이트, 3~4문장)
   - 【Counter-Intuitive Insight】 "처음에는 ~라고 예상했으나, 실제로는 ~임을 발견해 ~로 전환했다" 패턴 권장
   - 이 경험 전후 나의 역량 변화를 구체적으로
   - "경험을 통해 성장했습니다" 절대 금지 — 무엇이 어떻게 달라졌는지 구체적으로

7. competency (역량과 입사 후 기여, 3~4문장)
   - "협업 능력", "리더십" 같은 추상 키워드 사용 금지
   - 【Amazon LP 연결】 Ownership·Frugality·Think Big 관점에서 입사 후 기여를 서술
   - 구체 패턴: "[이 경험에서 발휘된 구체적 역량]으로, 입사 초기부터 [구체적으로 어떤 문제를 어떻게] 해결할 수 있음"
`;

  return `당신은 Google·Amazon·Meta·Naver·카카오·토스 등 국내외 주요 테크 기업 인사팀에서 연간 수천 건의 포트폴리오를 검토하고 커리어 컨설팅을 진행한 전문가입니다.
"이 사람을 꼭 면접에 불러야 한다"는 판단을 이끌어내는 포트폴리오 섹션을 작성하세요.
대상 직군: ${jobInfo.label}

${NO_HALLUCINATION_RULES}
${MARKET_RESEARCH_RULES}
${SLIDE_PORTFOLIO_RULES}
${WRITING_QUALITY_RULES}
${GLOBAL_PORTFOLIO_TECHNIQUES}
${jobEmphasis}
${section7Guide}
${PRODUCT_EXTRACTION_GUIDE}

경험 내용:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "product": { "name": "", "tagline": "", "problem": "", "solution": "", "features": [ { "name": "", "desc": "" } ], "outcomes": [ { "label": "", "value": "" } ] },
  "projectOverview": {
    "summary": "【XYZ 공식】 핵심 성과(X)를 측정값(Y)으로 증명하고 방법(Z)을 포함한 1~2줄 임팩트 요약",
    "background": "이 프로젝트가 왜 필요했는가 — 비즈니스 문제/기회/맥락 (구체적)",
    "goal": "달성하려 한 목표 (측정 가능한 형태, KPI 포함)",
    "role": "나의 역할과 기여 범위 (팀 내 오너십 영역, 기여도% 포함 가능)",
    "scopeOfImpact": "영향 범위 — 사용자 수/팀 수/매출 비율/서비스 규모 등 스케일 명시",
    "team": "팀 구성 (원본에 있으면)",
    "duration": "기간 (원본에 있으면)",
    "techStack": ["기술1", "기술2"]
  },
  "marketResearch": {
    "marketOverview": "프로젝트와 연결되는 실제 시장/사용자/채용 맥락 요약. 외부 자료는 비교 기준으로만 사용하고 프로젝트 성과로 오해되지 않게 작성",
    "deskResearchInfographic": {
      "title": "",
      "subtitle": "",
      "cards": [],
      "conclusion": "",
      "limitations": "검색으로 실제 URL과 수치가 확인된 경우에만 cards를 채우고, 아니면 빈 배열 유지"
    },
    "decisionMetrics": [
      {
        "metric": "의사결정에 필요한 지표명",
        "whyItMatters": "이 프로젝트/직무에서 중요한 이유",
        "recommendedProxy": "사용자가 확인하거나 계산할 수 있는 프록시/계산식",
        "researchBasis": "공개 자료/JD/업계 관행 기반 근거. 출처 불확실 시 [검증 필요]",
        "confidence": "high|medium|low"
      }
    ],
    "sourceNotes": [
      { "title": "자료 제목 또는 [검증 필요]", "publisher": "발행처", "url": "URL 또는 [검증 필요]", "checkedAt": "${new Date().toISOString().slice(0, 10)}", "usage": "어느 판단에 사용했는지" }
    ],
    "portfolioAngles": ["포트폴리오에서 강조하면 좋은 시장/사용자/비즈니스 관점"],
    "limitations": "자료 부족 또는 검증 필요 항목"
  },
  "sectionSlides": {
    "intro": { "kicker": "BACKGROUND", "headline": "슬라이드 제목", "subcopy": "2~3문장 설명", "evidenceCards": [{ "label": "CONTEXT", "title": "프로젝트 배경/목표/범위 중 하나", "body": "소개 섹션에 맞는 근거", "metric": "기간·팀 규모·스케일 또는 [작성 필요]" }] },
    "overview": { "kicker": "RESEARCH", "headline": "슬라이드 제목", "subcopy": "2~3문장 설명", "evidenceCards": [{ "label": "MARKET", "title": "시장/사용자 맥락 또는 검증 지표", "body": "리서치 근거와 비교 기준", "metric": "검증 지표 또는 [검증 필요]" }] },
    "task": { "kicker": "PROBLEM", "headline": "슬라이드 제목", "subcopy": "2~3문장 설명", "evidenceCards": [{ "label": "OWNERSHIP", "title": "내 담당 과제/문제 상황", "body": "직접 맡은 범위와 난점", "metric": "과제 규모 또는 [작성 필요]" }] },
    "process": { "kicker": "ACTION", "headline": "슬라이드 제목", "subcopy": "2~3문장 설명", "evidenceCards": [{ "label": "DECISION", "title": "행동/의사결정/대안 비교", "body": "왜 그렇게 판단했는지", "metric": "판단 기준 또는 [작성 필요]" }] },
    "output": { "kicker": "OUTCOME", "headline": "슬라이드 제목", "subcopy": "2~3문장 설명", "evidenceCards": [{ "label": "IMPACT", "title": "성과/산출물/2차 효과", "body": "무엇이 달라졌는지", "metric": "성과 수치 또는 [작성 필요]" }] },
    "growth": { "kicker": "LEARNING", "headline": "슬라이드 제목", "subcopy": "2~3문장 설명", "evidenceCards": [{ "label": "INSIGHT", "title": "배운 점/관점 변화", "body": "다음에 다르게 판단할 지점", "metric": "적용 범위 또는 [작성 필요]" }] },
    "competency": { "kicker": "CAPABILITY", "headline": "슬라이드 제목", "subcopy": "2~3문장 설명", "evidenceCards": [{ "label": "VALUE", "title": "발휘 역량/입사 후 기여", "body": "역량의 근거 경험", "metric": "기여 지표 또는 [작성 필요]" }] }
  },
  "intro": "【피라미드+XYZ】 첫 문장에 최대 결과·수치 배치, 스케일 포함, 2차 효과까지 (3~4문장)",
  "overview": "프로젝트 전체 맥락 (배경·목적·범위·스케일, Scope of Impact 포함, 3~5문장)",
  "task": "내가 직접 담당한 과제 (Ownership 명시, 배경→문제→해결 흐름, 3~5문장)",
  "process": "행동과 의사결정 과정 (Trade-off+대안 비교+Bias for Action 포함, 3~5문장)",
  "output": "성과와 산출물 (XYZ 공식+Second-Order Effect 체인으로 서술, 3~5문장)",
  "growth": "성장·인사이트 (Counter-Intuitive Insight 패턴 권장, 역량 변화 구체화, 3~4문장)",
  "competency": "발휘된 역량과 입사 후 기여 (Amazon LP 관점, 구체적 기여 방법, 3~4문장)"${jobSectionSchema}${archSchema}${visual.schema}
}
${hasJobSections ? `\n[직군 특화 섹션 작성 지침 — jobSpecific]\n${jobSectionGuides}\n원본에 관련 내용이 있다면 최대한 끌어모아 3~5문장으로 풍부하게 서술하세요. 원본에 없으면 "[작성 필요] ..." 처리.` : ''}${archGuide}${visual.guide}

원본에 없는 내용은 "[작성 필요] ..." 로 남기세요. 있는 내용은 강력한 능동 동사, XYZ 공식, Second-Order Effect로 재구성하세요.`;
}

// ============================================================
// 분할 Step 2: keyExperience 개별 추출 (1개씩, 매우 작은 output)
// ============================================================
export function buildSingleKeyExperiencePrompt(contentText, momentHint, index, total, jobCategory = 'common') {
  const jobAddon = buildKeyExpJobAddon(jobCategory);
  const hintBlock = momentHint ? `
[이번에 분석할 경험 — ${index + 1}/${total}번째]
${JSON.stringify(momentHint, null, 2)}

위 moment의 title/context/action/result/learning/metric/keywords를 그대로 보존하며 누락 필드만 원본에서 보강하세요.
` : `
[${index + 1}/${total}번째 핵심 경험을 추출하세요]
원본 자료 중 아직 다루지 않은 관점/에피소드를 하나 골라 CARL 구조로 정리하세요.
`;

  return `당신은 Google·Amazon·Meta·Naver·카카오·토스 인사팀 출신 포트폴리오 전문가입니다.
아래 경험 자료에서 ${index + 1}번째 핵심 경험 1건만 추출해, 인사담당자가 "이 사람 꼭 불러야 해"라고 느낄 수준으로 작성하세요.

${NO_HALLUCINATION_RULES}

${PR_GUIDELINES}

${METRIC_FILTER_GUIDELINES}

${WRITING_QUALITY_RULES}

${GLOBAL_PORTFOLIO_TECHNIQUES}
${hintBlock}
[CARL 구조 작성 기준 — 글로벌 기법 적용]
- context (2~3문장): 비즈니스 문제와 스케일(Scope of Impact) 포함
  → "DAU 80만 서비스에서 API 응답 지연이 평균 1.2초를 초과해 모바일 이탈률이 증가하는 상황이었다."
- action (2~3문장): Trade-off 서술 + Bias for Action + Ownership 명시
  → "Memcached 대신 Redis를 선택(Pub/Sub 확장성 확보), 캐시 레이어를 단독으로 설계·적용하고 쿼리 인덱스를 재설계했다."
- result (2~3문장): XYZ 공식 + Second-Order Effect 체인
  → "응답 시간을 1.2s→340ms(72% 단축, X/Y/Z) 달성. 이탈률 감소로 분기 전환율 목표를 8% 초과 달성했다."
- learning (1~2문장): Counter-Intuitive Insight — "배웠습니다" 금지
  → "초기 예상과 달리 DB 쿼리가 아닌 네트워크 왕복 횟수가 병목임을 프로파일링으로 확인, 계층적 캐싱 전략으로 전환했다."

원본 자료:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON, 1개 객체만):
{
  "title": "능동동사+성과가 담긴 20자 이내 제목 (예: 'API 응답 72% 단축 최적화')",
  "metric": "원본의 핵심 수치 (예: 72%, 340ms, 3일→1일). 없으면 빈 문자열",
  "metricLabel": "수치 라벨 (예: 응답 시간 단축, 처리 기간 단축)",
  "beforeMetric": "개선 전 수치 (있으면)",
  "afterMetric": "개선 후 수치 (있으면)",
  "context": "비즈니스 문제+스케일(Scope of Impact) 포함, 2~3문장",
  "action": "Trade-off+Ownership+Bias for Action 포함, 2~3문장",
  "result": "XYZ 공식+Second-Order Effect 체인, 수치 포함, 2~3문장",
  "learning": "Counter-Intuitive Insight 패턴, 역량 변화 구체화, 1~2문장",
  "keywords": ["JD 키워드1", "핵심역량2", "기술/방법론3"],
  "chartType": "horizontalBar"${jobAddon.schema}
}
${jobAddon.guide}
원본에 before/after 수치 패턴("800ms → 480ms", "3일을 1일로 단축")이 있으면 반드시 beforeMetric/afterMetric을 모두 채워 비교 그래프를 그릴 수 있게 하세요.`;
}

// ============================================================
// 분할 Step 3: 메타데이터 (keywords / highlights / followUpQuestions)
// ============================================================
export function buildMetaPrompt(contentText) {
  return `Google·Amazon·Naver·카카오·토스 인사팀 출신 포트폴리오 전문가입니다. 아래 경험 자료에서 메타 정보를 추출하세요.

${NO_HALLUCINATION_RULES}

경험 내용:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "keywords": ["채용 JD에 실제로 등장하는 직무·기술·역량 키워드 5~8개"],
  "competencyTags": ["아래 '직무 역량' 목록에서만 2~4개 선택 (다른 표현 금지, 목록 외 단어 금지)"],
  "workStyleTags": ["아래 '업무 성향' 목록에서만 2~3개 선택 (다른 표현 금지, 목록 외 단어 금지)"],
  "highlights": [
    "【XYZ+2차효과】 임팩트 언어로 3~5개 — 예: 'Redis 캐싱 도입(Z)으로 API 72% 단축(Y) → 이탈률 감소 → 분기 전환율 목표 초과(X)'",
    "수치 있으면 수치+2차효과, 없으면 Scope of Impact나 Trade-off 포인트를 구체적으로"
  ],
  "followUpQuestions": [
    "채용 담당자 평가 기준에서 가장 약한 부분을 메우는, 사용자만 답할 수 있는 구체 질문 3~5개. AI가 지어낼 수 없는 '진짜 정보'를 끌어내는 데 집중.",
    "반드시 다음 4가지를 우선 커버: ① 정량 수치(전/후·%·시간·비용·규모, 예: '응답속도를 몇 ms→몇 ms로 줄였나요?') ② 본인 기여 범위('팀에서 정확히 본인이 직접 한 부분은?') ③ 의사결정·대안('다른 선택지는 무엇이었고 왜 이걸 택했나요?') ④ 트러블슈팅('가장 막혔던 지점과 해결 과정은?')",
    "각 질문은 한 문장, 답하기 쉽게 구체적으로. 원본에 이미 충분히 드러난 항목은 묻지 말 것."
  ]
}

[직무 역량 허용 목록] 기획/전략, 시장·사용자 리서치, 데이터분석, 문제해결, 구현/개발, 디자인/UX, 자동화/효율화, 품질관리, 프로젝트관리, 문서화/기록관리, 프레젠테이션, 콘텐츠제작, 커뮤니케이션, 협업/팀워크, 리더십, 고객/CS, 마케팅, 영업, 재무/회계, 법규/정책
[업무 성향 허용 목록] 분석적, 논리적, 창의적, 목표지향, 전략적, 주도적, 협력적, 꼼꼼함, 도전적, 공감적, 실행지향, 신중함

원본에 있는 내용만 기반으로 추출하세요. competencyTags/workStyleTags는 위 허용 목록의 단어와 정확히 일치해야 합니다.`;
}

// ============================================================
// 역량/성향 태그 (기존 경험 자동 태깅 백필용) — 프론트 competencies.js와 동기화
// ============================================================
export const JOB_COMPETENCIES = [
  '기획/전략', '시장·사용자 리서치', '데이터분석', '문제해결', '구현/개발', '디자인/UX',
  '자동화/효율화', '품질관리', '프로젝트관리', '문서화/기록관리', '프레젠테이션', '콘텐츠제작',
  '커뮤니케이션', '협업/팀워크', '리더십', '고객/CS', '마케팅', '영업', '재무/회계', '법규/정책',
];
export const WORK_STYLES = [
  '분석적', '논리적', '창의적', '목표지향', '전략적', '주도적', '협력적', '꼼꼼함', '도전적', '공감적', '실행지향', '신중함',
];

export function buildTagPrompt(text) {
  return `아래 경험을 읽고 직무 역량과 업무 성향 태그를 분류하세요. 반드시 허용 목록 안의 단어만, 목록과 정확히 일치하게 사용합니다.

[직무 역량 허용 목록] ${JOB_COMPETENCIES.join(', ')}
[업무 성향 허용 목록] ${WORK_STYLES.join(', ')}

경험:
${text}

아래 JSON으로만 응답 (마크다운 없이 순수 JSON):
{"competencyTags": ["역량 2~4개"], "workStyleTags": ["성향 2~3개"]}`;
}

// ============================================================
// 시장/지표 리서치 — 최신 뉴스·지표·논문 검색 그라운딩 기반 추천
// ============================================================
export function buildMetricsResearchPrompt({ title = '', sections = {}, keywords = [], projectOverview = {}, jobCategory = 'common' } = {}) {
  const sectionText = Object.entries(sections || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `[${k}] ${String(v).slice(0, 800)}`)
    .join('\n');
  const ov = projectOverview || {};
  const overviewText = [ov.summary, ov.goal, ov.role, Array.isArray(ov.techStack) ? ov.techStack.join(', ') : '']
    .filter(Boolean).join(' | ');
  const today = new Date().toISOString().slice(0, 10);

  return `당신은 Google·Amazon·Naver·카카오·토스 인사팀 출신 포트폴리오 전문가이자 시장 리서처입니다.
아래 프로젝트/경험을 분석하고, **Google 검색으로 최신(2025~2026년) 뉴스·산업 지표·학술 논문**을 조사해, 이 사람이 포트폴리오와 면접에서 쓸 수 있는 **시장조사 인포그래픽**과 **의사결정 근거 지표**를 만드세요.

${NO_HALLUCINATION_RULES}

${MARKET_RESEARCH_RULES}

[추가 지시]
- 오늘 날짜: ${today}. 가능한 한 최근(최신 1~2년) 자료를 우선하세요.
- 조사 대상: ① 해당 도메인/직무의 최신 뉴스·트렌드 ② 업계 벤치마크·시장 지표 ③ 관련 학술 논문·기술 리포트.
- 추천 지표는 이 프로젝트 도메인과 "${jobCategory}" 직무에서 실제 의사결정에 쓰일 5~8개로, 막연하지 않고 구체적·측정 가능해야 합니다.
- sourceNotes에는 검색으로 확인한 실제 출처만 남기세요(제목·발행처·URL·확인일·어떤 판단에 쓰는지). URL을 확신 못 하면 만들지 말고 "[검증 필요]".
- deskResearchInfographic는 예시 이미지처럼 "이 시장/사용자는 어떤 고민이 있는가?"를 보여주는 2~4개의 시각화 카드입니다.
- 인포그래픽 카드의 수치(value, bars.value)는 반드시 sourceNotes의 실제 URL 자료에서 직접 확인 가능한 숫자만 사용하세요. 추정/상상/일반론/모델 자체 계산 금지.
- 카드마다 sourceUrl 또는 sourceIndex를 반드시 넣으세요. 실제 URL이 없으면 해당 카드를 만들지 마세요.
- 프로젝트 사용자의 성과처럼 보이면 안 됩니다. 외부 시장/사용자/업계 기준이라는 점을 finding 또는 interpretation에 명확히 쓰세요.
- 그래프용 텍스트는 짧게: question 45자 이하, finding 70자 이하, valueLabel 18자 이하, interpretation 55자 이하.

[★ impactBridges — 사용자의 실제 성과를 외부 연구와 연결해 의미를 키우기]
- 경험 내용에 "실제로 명시된" 성과 수치(예: 응답시간 2초 단축, 전환율 5%p 상승, 처리시간 3일→1일)를 찾으세요.
- 각 수치마다 검색으로 확인한 업계 연구/벤치마크(예: "페이지 응답이 1초 늦어질 때마다 이탈률이 X% 증가" 류의 공개 연구)를 연결해, 이 성과가 비즈니스적으로 어떤 의미인지 해석하세요.
- userMetric은 반드시 경험 원문에 있는 수치/문구를 그대로 사용하세요. 경험에 성과 수치가 하나도 없으면 impactBridges는 빈 배열로 두세요.
- benchmark는 sourceNotes의 실제 URL 자료에서 확인된 내용만. 출처를 확신할 수 없으면 그 bridge는 만들지 마세요.
- suggestedSentence는 포트폴리오에 바로 붙여넣을 수 있는 한 문장으로, "업계 연구(발행처) 기준 ~에 해당하는 개선으로 해석할 수 있다"처럼 외부 기준임이 문장 안에 드러나야 합니다.
- 사용자의 성과 수치를 바꾸거나 부풀리지 마세요. 외부 수치는 해석의 근거로만 쓰고, interpretation에 추정임을 명시하세요.

프로젝트 제목: ${title}
프로젝트 개요: ${overviewText}
직무: ${jobCategory}
관련 키워드: ${(keywords || []).join(', ')}
경험 내용:
${sectionText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "marketOverview": "이 프로젝트/직무와 연결되는 최신 시장·사용자·업계 맥락 요약 (조사 기반, 비교 기준으로만)",
  "deskResearchInfographic": {
    "title": "시장조사 인포그래픽 제목",
    "subtitle": "조사 목적 한 문장",
    "cards": [
      {
        "question": "Q1. 사용자는 어떤 문제를 겪는가?",
        "finding": "근거 자료로 확인된 핵심 발견",
        "chartType": "donut|bar|stat",
        "value": 65,
        "unit": "%",
        "valueLabel": "그렇다",
        "remainderLabel": "아니다",
        "sampleBase": "전체 1,000명 / 2025년 조사 등",
        "bars": [{ "label": "항목", "value": 28.9, "unit": "%" }],
        "sourceIndex": 0,
        "sourceTitle": "자료 제목",
        "sourcePublisher": "발행처",
        "sourceUrl": "실제 URL",
        "interpretation": "이 프로젝트에서 왜 이 문제가 중요한지"
      }
    ],
    "conclusion": "이 시장조사가 포트폴리오에서 말해주는 핵심 결론",
    "limitations": "표본/지역/시점 등 해석 한계"
  },
  "impactBridges": [
    {
      "userMetric": "경험 원문에 실제로 있는 성과 수치/문구 그대로 (예: API 응답시간 2초 단축)",
      "benchmark": "검색으로 확인된 외부 연구/벤치마크 요약 (예: ○○ 연구에 따르면 응답 1초 지연 시 이탈률 X% 증가)",
      "interpretation": "이 성과의 비즈니스 의미 — 외부 기준 기반 추정임을 명시",
      "suggestedSentence": "포트폴리오에 바로 쓸 수 있는 한 문장 (외부 연구 기준임이 드러나게)",
      "sourceIndex": 0,
      "sourceUrl": "실제 URL",
      "confidence": "high|medium|low"
    }
  ],
  "decisionMetrics": [
    {
      "metric": "의사결정에 쓸 지표명",
      "whyItMatters": "이 프로젝트/직무에서 왜 중요한지 (최신 트렌드 근거 연결)",
      "recommendedProxy": "사용자가 확인하거나 계산할 수 있는 프록시/계산식",
      "researchBasis": "근거가 된 뉴스/지표/논문 요약 (출처는 sourceNotes로 연결). 불확실 시 [검증 필요]",
      "confidence": "high|medium|low"
    }
  ],
  "sourceNotes": [
    { "title": "자료 제목 또는 [검증 필요]", "publisher": "발행처", "url": "실제 URL 또는 [검증 필요]", "checkedAt": "${today}", "usage": "어느 판단/지표에 사용했는지" }
  ],
  "portfolioAngles": ["포트폴리오에서 강조하면 좋은 최신 시장/기술 관점 2~4개"],
  "limitations": "자료 부족 또는 검증이 필요한 항목"
}

사용자의 프로젝트 성과를 외부 수치로 둔갑시키지 마세요. 순수 JSON만 출력하세요.`;
}

// ============================================================
// 대화형 추출 인터뷰 — 초안에서 핵심 정보를 끌어내는 질문 생성
// ============================================================
export function buildInterviewQuestionsPrompt(braindump = '', jobCategory = 'common') {
  return `당신은 Google·Amazon·Naver·카카오·토스 인사팀 출신 포트폴리오 전문가입니다.
아래는 지원자가 자유롭게 적은 경험 초안입니다. 이 경험을 채용 담당자가 통과시킬 수준으로 끌어올리기 위해,
"지원자 본인만 답할 수 있고 AI가 지어낼 수 없는" 핵심 정보를 끌어내는 인터뷰 질문을 만드세요.

${NO_HALLUCINATION_RULES}

[질문 설계 규칙]
- 5~7개. 반드시 다음을 우선 커버: ① 정량 수치(전/후·%·시간·비용·규모) ② 본인의 구체적 기여 범위(팀에서 정확히 직접 한 일) ③ 의사결정·대안(다른 선택지는? 왜 이걸 택했나) ④ 트러블슈팅(가장 막혔던 지점과 해결 과정).
- 초안에 이미 충분히 드러난 내용은 다시 묻지 말고, 비어 있는 곳을 메우는 질문으로.
- "${jobCategory}" 직무에서 채용 담당자가 가장 주목하는 포인트를 반영.
- 각 질문은 한 문장, 친근하고 쉬운 한국어, 답하기 쉽도록 구체적으로(막연한 추상 질문 금지).

경험 초안:
${braindump}

아래 JSON만 출력 (마크다운 없이 순수 JSON):
{ "questions": ["질문1", "질문2", "질문3", "질문4", "질문5"] }`;
}

// ============================================================
// 경험 순간 추출 (extractMoments) — 이미 작은 prompt
// ============================================================
export function buildExtractMomentsPrompt(rawText, title) {
  return `당신은 Google·Amazon·Meta·Naver·카카오·토스 인사팀 출신 포트폴리오 전문가입니다.
아래 자료에서 포트폴리오에 실제로 쓸 수 있는 핵심 경험 순간들을 추출하세요.
인사담당자가 "이 사람 면접 불러야 해"라고 느낄 수준의 내용만, 국내외 대기업 합격 기법을 적용해 추출합니다.

${NO_HALLUCINATION_RULES}

${PR_GUIDELINES}

${METRIC_FILTER_GUIDELINES}

${WRITING_QUALITY_RULES}

${GLOBAL_PORTFOLIO_TECHNIQUES}

★ 최소 3개 필수, 최대 10개까지 — 임팩트 있는 경험을 모조리 추출하세요 ★
프로젝트명: ${title || '(미상)'}

[추출 원칙 — 글로벌 기법 적용]
1. 10가지 성과 공식 중 가장 잘 맞는 유형을 'type'에 기재
2. 정량 수치(%, 시간, 비용, 건수)가 있는 경험을 가장 먼저 추출 (그래프 시각화 가능하게)
3. 각 CARL 섹션은 2~3문장, 글로벌 합격 패턴으로:
   - Context: Scope of Impact(스케일) 포함 — "DAU X만 서비스에서", "6명 팀에서 단독으로"
   - Action: Trade-off(왜 A 말고 B?) + Ownership(내가 직접) + Bias for Action
   - Result: XYZ 공식 + Second-Order Effect 체인 (직접 성과 → 비즈니스 임팩트)
   - Learning: Counter-Intuitive Insight — "처음 예상과 달리 ~임을 발견, ~로 전환"
4. 원본에 없는 내용 창작 절대 금지 — 없으면 "(미확인: [질문])" 표기

원본 자료:
${rawText.substring(0, 6000)}

반드시 아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "moments": [
    {
      "id": "1",
      "type": "10가지 공식 중 해당 유형명",
      "title": "능동동사+성과가 담긴 20자 이내 제목 (예: 'API 응답 72% 단축 최적화')",
      "description": "Context: ...\\nAction: ...\\nResult: ...\\nLearning: ...\\n(미확인: 선택적)",
      "context": "Scope of Impact 포함, 비즈니스 문제·배경 (2~3문장)",
      "action": "Trade-off+Ownership+Bias for Action 포함 (2~3문장)",
      "result": "XYZ 공식+Second-Order Effect 체인, 원본 수치 반드시 포함 (2~3문장)",
      "learning": "Counter-Intuitive Insight 패턴, 역량 변화 구체화 (1~2문장)",
      "metric": "원본의 핵심 수치 하나 (예: 40% 단축, 3일→1일, 800ms). 없으면 빈 문자열.",
      "metricLabel": "수치 라벨 (예: 응답 시간 단축, 처리 기간). 없으면 빈 문자열.",
      "beforeMetric": "개선 전 수치 (원본에 있을 때만)",
      "afterMetric": "개선 후 수치 (원본에 있을 때만)",
      "keywords": ["JD 키워드", "핵심역량", "기술/방법론"]
    }
  ]
}

[⚠️ 수치 추출 필수 규칙]
- 원본의 숫자(%, 시간, 비용, 건수, 배수)는 반드시 metric/beforeMetric/afterMetric에 채우세요.
- "800ms → 480ms", "3일을 1일로 단축" 같은 before/after가 있으면 둘 다 채워 비교 그래프를 그릴 수 있게 하세요.
- 단일 수치만 있으면(예: "40% 단축") metric에만 넣고 before/after는 비워두세요.
- 원본에 수치 없으면 절대 지어내지 마세요.

moments 배열은 반드시 3개 이상, 가능한 최대 10개까지 추출하세요.`;
}

// ============================================================
// [deprecated] buildAnalyzeExperiencePrompt — 통짜 분석 (503 위험)
// 호환성을 위해 유지하되 analyzeExperience는 분할 방식 사용
// ============================================================
export function buildAnalyzeExperiencePrompt(contentText, maxCount, reviewedMoments = null) {
  const minCount = Math.max(maxCount, 3);
  const hasReviewed = Array.isArray(reviewedMoments) && reviewedMoments.length > 0;
  const momentsJson = hasReviewed ? JSON.stringify(reviewedMoments, null, 2) : '';
  const lockedCount = hasReviewed ? reviewedMoments.length : null;

  const reviewedBlock = hasReviewed ? `
[🔒 사용자 검토 완료 핵심 경험 — 반드시 1:1 매핑할 것]
${momentsJson}
` : '';

  const countDirective = hasReviewed
    ? `★ keyExperiences는 정확히 ${lockedCount}개 ★`
    : `★ keyExperiences 최소 ${minCount}개 ★`;

  return `포트폴리오 분석.

${NO_HALLUCINATION_RULES}
${PR_GUIDELINES}
${METRIC_FILTER_GUIDELINES}
${reviewedBlock}
${countDirective}

경험 내용:
${contentText}

JSON만 응답:
{"projectOverview":{"summary":"","background":"","goal":"","role":"","team":"","duration":"","techStack":[]},"keyExperiences":[{"title":"","metric":"","metricLabel":"","beforeMetric":"","afterMetric":"","context":"","action":"","result":"","learning":"","keywords":[]}],"intro":"","overview":"","task":"","process":"","output":"","growth":"","competency":"","keywords":[],"followUpQuestions":[],"highlights":[]}
`;
}

// ============================================================
// 근거 라벨 자동 판단 — 각 섹션 본문의 주장 성격(사실/추정/가정/해석)과 근거 레벨(A~D)
// ============================================================
export function buildEvidenceLabelPrompt(sections = {}) {
  const body = Object.entries(sections)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `[${k}]\n${String(v).slice(0, 1200)}`)
    .join('\n\n');

  return `당신은 포트폴리오의 신뢰성을 검수하는 전문가입니다.
아래 각 섹션 본문을 읽고, "어떤 성격의 주장인지(label)"와 "근거가 얼마나 단단한지(level)"를 판단해 라벨을 붙이세요.

[주장 성격 label — 정확히 하나]
- 사실: 실제로 일어난 일·확인 가능한 결과. 수치·산출물·로그 등 검증 가능한 근거가 드러남.
- 추정: 정황상 그럴 것이라 보는 내용. 직접 측정·확인되지 않음("~인 것 같다, ~로 보인다, 아마").
- 가정: 전제로 깔고 있는 미검증 내용.
- 해석: 사실을 바탕으로 한 본인의 분석·의미 부여·교훈.

[근거 레벨 level — 정확히 하나]
- A: 시스템 로그·원본 문서·배포물 등 직접 증거
- B: 회의록·피드백·이메일 등 기록
- C: 기억 회상·동료 증언
- D: 근거가 약한 추정치·막연한 표현

[판단 규칙]
- 구체적 수치·산출물이 명시되면 보통 사실 + A 또는 B.
- "~것 같다/보인다/아마" 같은 표현이 핵심이면 추정.
- 전제·조건을 깔면 가정, 의미 부여·교훈·관점이면 해석.
- 근거가 막연하거나 검증이 안 됐으면 level은 C 또는 D.

섹션 본문:
${body}

아래 JSON만 출력하세요 (마크다운 없이). 본문이 있는 섹션 키만 포함:
{ "intro": { "label": "사실", "level": "A" } }
label 후보: 사실|추정|가정|해석, level 후보: A|B|C|D`;
}

// ============================================================
// 자유 프롬프트 기반 핵심 경험 보강 (B 방식)
// ============================================================
export function buildRefineKeyExperiencePrompt(currentExp, freeFormText) {
  return `당신은 Google·Amazon·Meta·Naver·카카오·토스 인사팀 출신 포트폴리오 전문가입니다.
사용자가 입력한 "자유 보강 메모"를 바탕으로, 기존 핵심 경험의 내용을 보완하고 다듬어주세요.

${NO_HALLUCINATION_RULES}
${METRIC_FILTER_GUIDELINES}
${WRITING_QUALITY_RULES}
${GLOBAL_PORTFOLIO_TECHNIQUES}

[기존 핵심 경험 데이터]
${JSON.stringify(currentExp, null, 2)}

[사용자 자유 보강 메모]
${freeFormText}

[지시사항]
1. 기존 데이터(context, action, result, learning 등)를 최대한 보존하되, 사용자의 메모 내용에 맞게 문맥을 자연스럽게 수정/보강하세요.
2. 수치(metric, beforeMetric, afterMetric)가 추가되거나 변경되어야 한다면, 이를 추출해 해당 필드에 반영하세요.
3. 빈 필드가 있다면 자유 보강 메모를 바탕으로 채우되, 없으면 억지로 만들지 마세요.
4. 반드시 CARL 구조(Context, Action, Result, Learning)와 XYZ 공식, 임팩트 위주로 다듬으세요.

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON, 1개 객체만):
{
  "title": "능동동사+성과가 담긴 20자 이내 제목",
  "metric": "원본의 핵심 수치 (예: 72%, 340ms, 3일→1일). 없으면 빈 문자열",
  "metricLabel": "수치 라벨 (예: 응답 시간 단축, 처리 기간 단축)",
  "beforeMetric": "개선 전 수치 (있으면)",
  "afterMetric": "개선 후 수치 (있으면)",
  "context": "비즈니스 문제+스케일(Scope of Impact) 포함, 2~3문장",
  "action": "Trade-off+Ownership+Bias for Action 포함, 2~3문장",
  "result": "XYZ 공식+Second-Order Effect 체인, 수치 포함, 2~3문장",
  "learning": "Counter-Intuitive Insight 패턴, 역량 변화 구체화, 1~2문장",
  "keywords": ["JD 키워드1", "핵심역량2", "기술/방법론3"],
  "chartType": "horizontalBar"
}`;
}
