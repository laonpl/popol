import { create } from 'zustand';
import api from '../services/api';
import { normalizeExperienceForCurrentJob } from '../utils/experienceCompatibility';

function omitUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.getTime === 'function') return value.getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const FRAMEWORKS = {
  STRUCTURED: {
    name: '경험 구조화',
    description: '직무 맞춤형 커리어 코치 프레임워크로 경험을 체계적으로 정리합니다',
    fields: [
      { key: 'intro', label: '프로젝트 소개', subtitle: '서비스 이름 or 프로젝트 특징 + 소개 한 줄', placeholder: '프로젝트 이름과 한 줄 소개를 입력하세요', color: 'bg-blue-50 border-blue-200' },
      { key: 'overview', label: '프로젝트 개요', subtitle: '배경과 목적', placeholder: '프로젝트의 배경과 목적을 설명해주세요', color: 'bg-indigo-50 border-indigo-200' },
      { key: 'task', label: '진행한 일', subtitle: '배경-문제-(핵심)-해결', placeholder: '어떤 문제를 인식하고 어떻게 해결했는지 설명해주세요', color: 'bg-purple-50 border-purple-200' },
      { key: 'process', label: '과정', subtitle: '나의 직접적인 액션 + 인사이트', placeholder: '직접 수행한 행동과 그 과정에서 얻은 인사이트를 설명해주세요', color: 'bg-violet-50 border-violet-200' },
      { key: 'output', label: '결과물', subtitle: '최종으로 진행한 내용 + 포인트', placeholder: '최종 결과물과 핵심 포인트를 설명해주세요', color: 'bg-pink-50 border-pink-200' },
      { key: 'growth', label: '성장한 점', subtitle: '성과 or 배운 점', placeholder: '이 경험을 통해 성장한 점이나 배운 점을 설명해주세요', color: 'bg-amber-50 border-amber-200' },
      { key: 'competency', label: '나의 역량', subtitle: '입사 시 기여할 수 있는 부분', placeholder: '이 경험에서 얻은 역량과 입사 후 기여할 수 있는 부분을 설명해주세요', color: 'bg-emerald-50 border-emerald-200' },
    ],
  },
};

// 직군 카테고리 정의 (ex.md 기반)
export const JOB_CATEGORIES = [
  {
    group: '전 직군 공통',
    items: [
      { value: 'common', label: '공통 (전직군)', description: '직군 구분 없이 기본 7개 섹션만 정리합니다' },
    ],
  },
  {
    group: '엔지니어링 & 데이터',
    items: [
      { value: 'dev', label: '개발자 (FE/BE)', description: '기술 스택·아키텍처, 트러블슈팅, 코드 최적화 성과' },
      { value: 'aiml', label: 'AI / ML 엔지니어', description: '데이터셋·아키텍처, 학습·평가, 최적화·서빙' },
      { value: 'da', label: '데이터 애널리스트', description: 'EDA·파이프라인, 가설 검증, 비즈니스 인사이트' },
      { value: 'devops', label: '인프라 / 데브옵스', description: '시스템 아키텍처, CI/CD 파이프라인, 비용·트래픽 최적화' },
      { value: 'security', label: '정보보안', description: '위협·위험 판단, 취약점 검증, 완화와 잔여 위험' },
      { value: 'qa', label: 'QA / 테스트', description: '품질 위험, 테스트 추적성, 결함·릴리스 판단' },
      { value: 'engineering', label: '하드웨어 / 제조 R&D', description: '요구조건, 설계 대안, 시험·실패·재설계' },
    ],
  },
  {
    group: '제품, 프로젝트 & 크리에이티브',
    items: [
      { value: 'pm', label: '기획자 / PM', description: '해결 전략·기획 의도, MSC, 비즈니스 임팩트' },
      { value: 'project', label: '프로젝트 / 프로그램 관리', description: '목표·범위, 리스크·변경, 인수·회고' },
      { value: 'designer', label: '프로덕트 디자이너', description: '리서치·문제 접근, 프로토타이핑·개선, 디자인 시스템' },
      { value: 'marketer', label: '마케터 (콘텐츠/퍼포먼스)', description: '매체 전략·타겟팅, KPI (ROAS/CVR/CTR)' },
      { value: 'content', label: '콘텐츠 / 미디어', description: '독자·포맷 판단, 제작·수정, 배포 반응' },
    ],
  },
  {
    group: '비즈니스 & 경영지원',
    items: [
      { value: 'hr', label: '인사 / 채용 담당자', description: '채용 파이프라인 기획, 퍼널 데이터, 조직 문화·리텐션' },
      { value: 'sales', label: 'B2B 세일즈 / 사업개발', description: '리드 제너레이션, 세일즈 퍼널 데이터, 계약 성과' },
      { value: 'customer_success', label: '고객 성공 / 서비스 운영', description: '고객 문제 진단, 해결·예방, 채택·유지' },
      { value: 'finance', label: '재무 / 회계 / 투자', description: '가정·모델, 시나리오·통제, 재무 의사결정' },
      { value: 'strategy', label: '전략 / 컨설팅 / 사업기획', description: '문제 구조, 가설·대안 분석, 실행 가능한 권고' },
      { value: 'operations', label: '운영 / 공급망 / 생산', description: '기준선·근본 원인, 파일럿, 표준화·통제' },
    ],
  },
  {
    group: '연구, 교육 & 공공 전문직',
    items: [
      { value: 'research', label: '연구 / R&D', description: '연구 질문·방법, 검증·재현, 정확한 기여 역할' },
      { value: 'education', label: '교육 / 교수설계', description: '학습자 진단, 목표-활동-평가, 수업 재설계' },
      { value: 'policy', label: '공공 / 정책 / 행정', description: '정책 대안, 논리모형, 평가·형평성·책무성' },
      { value: 'legal', label: '법무 / 컴플라이언스', description: '사실·쟁점·근거, 위험 기반 권고와 통제' },
      { value: 'healthcare', label: '보건의료 / 헬스케어', description: '안전·근거·사람 중심 품질 개선' },
    ],
  },
];

const fieldCard = (key, label, subtitle, color = 'bg-slate-50 border-slate-200') => ({
  key,
  label,
  subtitle,
  placeholder: `${label}에 해당하는 상황, 판단 근거, 직접 실행과 증거를 설명해주세요`,
  color,
});

// 직군별 특화 추가 섹션 (필수 7개 섹션 이후에 렌더링)
export const JOB_SPECIFIC_FIELDS = {
  common: [],
  dev: [
    { key: 'techStack',       label: '기술 스택 & 기술 선택',  subtitle: '기술 선정의 논리적 근거 (왜 이 프레임워크/DB를 썼는가, 대안 비교)',  placeholder: '어떤 기술 스택을 선택했고, 그 이유는 무엇인가요?',               color: 'bg-sky-50 border-sky-200' },
    { key: 'architecture',    label: '시스템 아키텍처 & 설계',  subtitle: '구조도·데이터 흐름·컴포넌트 구성과 설계 결정의 trade-off',          placeholder: '시스템을 어떻게 설계했고, 어떤 설계 결정을 내렸나요? (구조·데이터 흐름·확장성)', color: 'bg-sky-50 border-sky-200' },
    { key: 'troubleshooting', label: '트러블슈팅 및 로직',     subtitle: '한계점 극복 과정 (성능 저하, 메모리 누수 해결 등)',            placeholder: '마주한 기술적 문제와 해결 과정을 설명해주세요',                   color: 'bg-sky-50 border-sky-200' },
    { key: 'optimization',    label: '코드 최적화 성과',       subtitle: '렌더링 속도 개선율 등 기술적 수치',                            placeholder: '성능 개선이나 최적화 작업 결과를 수치로 표현해주세요',           color: 'bg-sky-50 border-sky-200' },
  ],
  aiml: [
    { key: 'datasetArch', label: '데이터셋 및 아키텍처',       subtitle: '데이터 전처리 로직 및 모델(Model) 선택 이유',                  placeholder: '사용한 데이터셋과 모델 아키텍처 선택 이유를 설명해주세요',       color: 'bg-purple-50 border-purple-200' },
    { key: 'evaluation',  label: '학습 및 평가 (Evaluation)',  subtitle: '과적합 통제 과정, Accuracy 등 정량적 지표',                    placeholder: '학습 과정과 성능 평가 지표를 설명해주세요',                     color: 'bg-purple-50 border-purple-200' },
    { key: 'serving',     label: '최적화 및 서빙',             subtitle: '온디바이스 탑재나 추론(Inference) 속도 개선 등 엔지니어링 성과', placeholder: '모델 최적화 및 배포(서빙) 과정을 설명해주세요',                  color: 'bg-purple-50 border-purple-200' },
  ],
  da: [
    { key: 'pipeline',        label: '데이터 파이프라인 & EDA', subtitle: '데이터 수집/정제 환경과 시각화 과정',                          placeholder: '데이터 수집, 정제, 시각화 과정을 설명해주세요',                 color: 'bg-teal-50 border-teal-200' },
    { key: 'hypothesis',      label: '가설 검증 (A/B Test)',   subtitle: '실험 설계 및 통계적 유의성 검증',                              placeholder: '가설 설정부터 검증까지의 과정을 설명해주세요',                   color: 'bg-teal-50 border-teal-200' },
    { key: 'businessInsight', label: '비즈니스 인사이트',       subtitle: '데이터 분석을 통해 도출한 액션 플랜과 실제 지표 변화',           placeholder: '분석 결과에서 도출한 인사이트와 실제 비즈니스 변화를 설명해주세요', color: 'bg-teal-50 border-teal-200' },
  ],
  devops: [
    { key: 'infraArch',    label: '시스템 아키텍처 다이어그램', subtitle: '클라우드(AWS, GCP 등) 인프라 구조 시각화',                      placeholder: '시스템 아키텍처와 클라우드 인프라 구성을 설명해주세요',         color: 'bg-orange-50 border-orange-200' },
    { key: 'cicd',         label: 'CI/CD 파이프라인',          subtitle: '배포 자동화 구축을 통한 리드 타임 단축',                       placeholder: '배포 자동화 파이프라인 구축 과정을 설명해주세요',               color: 'bg-orange-50 border-orange-200' },
    { key: 'costOptimize', label: '비용 및 트래픽 최적화',      subtitle: '클라우드 리소스 비용 절감(%) 및 로드 밸런싱 전략',               placeholder: '비용 절감이나 트래픽 최적화 성과를 수치로 표현해주세요',         color: 'bg-orange-50 border-orange-200' },
  ],
  pm: [
    { key: 'strategy',       label: '해결 전략 및 기획 의도', subtitle: '핵심 기능(Core Feature) 정의 및 유저 플로우',                   placeholder: '문제 해결 전략과 핵심 기능 기획 의도를 설명해주세요',           color: 'bg-indigo-50 border-indigo-200' },
    { key: 'msc',            label: 'MSC (최소 성공 기준)',   subtitle: '초기 설정한 최소 성공 기준 달성 여부',                          placeholder: 'MSC를 어떻게 설정했고, 달성했는지 설명해주세요',               color: 'bg-indigo-50 border-indigo-200' },
    { key: 'businessImpact', label: '비즈니스 임팩트',        subtitle: '런칭 후 유저 데이터 변화 및 타 부서 커뮤니케이션 과정',           placeholder: '출시 후 실제 비즈니스 임팩트와 데이터 변화를 설명해주세요',     color: 'bg-indigo-50 border-indigo-200' },
  ],
  designer: [
    { key: 'researchApproach', label: '리서치 및 문제 접근',  subtitle: '더블 다이아몬드 모델, 유저 인터뷰 등 디자인 프로세스',           placeholder: '유저 리서치 방법론과 문제 접근 과정을 설명해주세요',           color: 'bg-pink-50 border-pink-200' },
    { key: 'prototyping',      label: '프로토타이핑 및 개선', subtitle: '사용성 테스트 전후(Before/After) UI 개선 과정',                 placeholder: '프로토타입 제작부터 사용성 테스트, UI 개선 과정을 설명해주세요', color: 'bg-pink-50 border-pink-200' },
    { key: 'designSystem',     label: '디자인 시스템',        subtitle: '일관된 컴포넌트, 폰트, 컬러 규격화 수립 여부',                  placeholder: '디자인 시스템 구축 과정과 적용 범위를 설명해주세요',           color: 'bg-pink-50 border-pink-200' },
  ],
  marketer: [
    { key: 'funnel',        label: '캠페인 스토리',    subtitle: '문제 → 목표/KPI → 타깃 → 전략 → 실행 → 성과 → 인사이트',           placeholder: '어떤 문제/기회에서 시작해 어떤 전략으로 실행하고 무엇을 배웠는지 흐름으로 설명해주세요', color: 'bg-rose-50 border-rose-200' },
    { key: 'targetChannel', label: '타깃 & 채널 전략', subtitle: '타깃 페르소나 설정 기준과 채널(메타·구글 등) 믹스 전략',              placeholder: '누구를 타깃으로, 어떤 채널을 왜 선택했는지 설명해주세요',                             color: 'bg-rose-50 border-rose-200' },
    { key: 'kpiEvidence',   label: 'KPI & 증거 자료',  subtitle: '확인된 지표 · [확인 필요] 지표 · 대체 지표 · 증거 자료',              placeholder: '확인된 수치와 확보 가능한 증거 자료(캡처·리포트·링크)를 정리해주세요',                 color: 'bg-rose-50 border-rose-200' },
    { key: 'resumeBullets', label: '이력서 bullet',    subtitle: '[강한 동사]+[대상/업무]+[방법/툴]+[성과] 공식 문장',                 placeholder: '이력서에 바로 쓸 수 있는 한 줄 성과 문장을 작성해주세요',                             color: 'bg-rose-50 border-rose-200' },
    { key: 'jdKeywordMap',  label: 'JD 키워드 매핑',   subtitle: '이 경험이 증명하는 직무 키워드와 근거 연결',                         placeholder: '콘텐츠 기획, SNS 운영, 퍼포먼스 최적화 등 증명 가능한 키워드를 연결해주세요',           color: 'bg-rose-50 border-rose-200' },
  ],
  hr: [
    { key: 'hiringPipeline', label: '채용 파이프라인 기획', subtitle: '서류 스크리닝, 자동화 등 채용 리드타임 단축 전략',                 placeholder: '채용 프로세스 설계와 리드타임 단축 전략을 설명해주세요',       color: 'bg-amber-50 border-amber-200' },
    { key: 'funnelData',     label: '퍼널 데이터',         subtitle: '소싱 채널별 유입 및 합격 전환율 데이터',                         placeholder: '채용 퍼널 각 단계별 전환율을 설명해주세요',                   color: 'bg-amber-50 border-amber-200' },
    { key: 'retention',      label: '조직 문화 및 리텐션', subtitle: '온보딩 기획 및 퇴사율 방어 전략',                                placeholder: '온보딩 프로그램이나 직원 리텐션 전략을 설명해주세요',           color: 'bg-amber-50 border-amber-200' },
  ],
  sales: [
    { key: 'leadGen',        label: '리드 제너레이션 전략', subtitle: '인/아웃바운드를 통한 유효 고객(Lead) 발굴 과정',                  placeholder: '리드 발굴 전략과 실행 과정을 설명해주세요',                   color: 'bg-emerald-50 border-emerald-200' },
    { key: 'salesFunnel',    label: '세일즈 퍼널 데이터',  subtitle: '초기 미팅부터 최종 클로징까지의 전환율',                         placeholder: '세일즈 단계별 전환율과 성과를 설명해주세요',                   color: 'bg-emerald-50 border-emerald-200' },
    { key: 'contractResult', label: '계약 성과',           subtitle: '체결 규모(ARR/MRR) 및 기존 고객 업셀링 성과',                    placeholder: '계약 규모와 ARR/MRR 성과를 설명해주세요',                     color: 'bg-emerald-50 border-emerald-200' },
  ],
  security: [
    fieldCard('threatAssessment', '위협·위험 판단', '보호 자산, 공격 경로, 영향·가능성 근거와 우선순위'),
    fieldCard('verification', '검증과 완화', '재현·테스트, 적용한 통제와 수정 후 재검증'),
    fieldCard('securityOwnership', '운영·책임 범위', '권한, 에스컬레이션, 잔여 위험과 공개 범위'),
  ],
  qa: [
    fieldCard('qualityStrategy', '품질 위험과 전략', '테스트 근거, 위험 기반 범위·우선순위·종료 기준'),
    fieldCard('testEvidence', '테스트 설계와 증거', '요구사항 추적, 테스트 데이터, 결함 재현과 결과'),
    fieldCard('releaseImpact', '릴리스 판단과 개선', '릴리스 기여, 자동화 효과, 놓친 결함과 통제'),
  ],
  engineering: [
    fieldCard('requirementsDesign', '요구조건과 설계 판단', '성능·원가·안전 제약, 대안과 trade-off'),
    fieldCard('prototypeTest', '시제품과 검증', '시험 조건·장비·판정 기준과 결과'),
    fieldCard('failureRedesign', '실패 분석과 재설계', '예상 밖 결과, 원인 근거와 변경 사항'),
  ],
  project: [
    fieldCard('planControl', '목표·범위·통제', '베이스라인, 일정·예산·품질 통제'),
    fieldCard('riskDecision', '리스크·변경 판단', '의존성, 대응안 비교, 변경 기준과 승인'),
    fieldCard('deliveryLearning', '인수와 회고', '완료 근거, 편차, 다음 통제 원칙'),
  ],
  content: [
    fieldCard('editorialStrategy', '독자·콘텐츠 전략', '대상·목적, 포맷·채널·톤의 선택 근거'),
    fieldCard('productionRevision', '제작과 수정', '초안-피드백-최종본의 핵심 변화와 기여'),
    fieldCard('distributionLearning', '배포 결과와 다음 판단', '채널 반응, 귀인 한계와 다음 포맷'),
  ],
  customer_success: [
    fieldCard('customerDiagnosis', '고객 문제 진단', '고객 목표, VOC·사용 신호와 반복 원인'),
    fieldCard('serviceIntervention', '해결·운영 판단', '대응안, 에스컬레이션, 예방·셀프서비스'),
    fieldCard('customerOutcome', '가치·유지 결과', '채택·만족·갱신 근거와 한계'),
  ],
  finance: [
    fieldCard('financialLogic', '가정·모델·분석', '의사결정 질문, 출처, 가정과 계산 방법'),
    fieldCard('riskControl', '시나리오·위험·통제', '민감도, 검산·승인·통제와 윤리 판단'),
    fieldCard('decisionImpact', '권고와 결과', '의사결정 반영, 편차와 수정한 가정'),
  ],
  strategy: [
    fieldCard('problemStructure', '문제 구조와 가설', '핵심 질문, 이슈 구조와 우선 검증 가설'),
    fieldCard('optionAnalysis', '대안 분석과 권고', '근거 출처, 평가 기준, 반론·위험'),
    fieldCard('implementationImpact', '실행과 결과', '실행 조건, 의사결정 반영과 예측 편차'),
  ],
  operations: [
    fieldCard('processBaseline', '프로세스·기준선', '고객 요구, 범위, 기준선과 측정 신뢰도'),
    fieldCard('rootCausePilot', '원인·대안·파일럿', '근본 원인, 대안 비교와 시험 적용'),
    fieldCard('controlOutcome', '결과·표준화·통제', '전후 결과, SOP·통제 계획과 부작용'),
  ],
  research: [
    fieldCard('researchQuestion', '질문·가설·방법', '문헌 공백, 연구 질문, 방법 선택 근거'),
    fieldCard('validationFinding', '검증과 발견', '데이터 품질, 재현, 발견과 부정적 결과'),
    fieldCard('researchContribution', '기여·한계·후속 연구', '역할별 본인 기여, 한계와 다음 연구'),
  ],
  education: [
    fieldCard('learningDesign', '학습자·목표·설계', '학습자 진단, 목표와 활동 설계 근거'),
    fieldCard('assessmentEvidence', '평가와 학습 증거', '루브릭, 학습자 결과, 포용성·접근성'),
    fieldCard('teachingIteration', '재설계와 전이', '피드백 후 변화와 실제 적용'),
  ],
  policy: [
    fieldCard('policyDesign', '문제·대상·정책 대안', '대상, 이해관계자, 자료 근거와 선택 기준'),
    fieldCard('resultsFramework', '논리모형과 실행', '투입-활동-산출-성과-영향과 위험'),
    fieldCard('evaluationEquity', '평가·형평성·책무성', '모니터링과 평가, 형평성·부작용'),
  ],
  legal: [
    fieldCard('issueAuthority', '사실·쟁점·근거', '사실관계, 적용 근거와 불확실성'),
    fieldCard('riskRecommendation', '대안·위험·권고', '선택지별 법률·사업 위험과 승인'),
    fieldCard('complianceOutcome', '통제·시정·결과', '정책·계약 통제, 시정 추적과 잔여 위험'),
  ],
  healthcare: [
    fieldCard('careQuality', '문제·근거·안전 기준', '품질 문제, 지침, 안전·형평성 기준'),
    fieldCard('interventionTeam', '중재와 팀 협업', '대안, 역할·에스컬레이션, 개인정보 보호'),
    fieldCard('qualityOutcome', '품질 결과와 한계', '지표 품질, 부작용과 사람 중심 결과'),
  ],
};

const useExperienceStore = create((set, get) => ({
  experiences: [],
  loading: false,
  loadError: null,
  // 경험별 편집 히스토리: { [experienceId]: { past: [], future: [] } }
  // 각 스냅샷: { content, title, structuredResult }
  _editHistory: {},

  // 로그아웃 시 호출 — 스토어는 메모리에만 있어서 비우지 않으면 다음 방문자에게 이전 사용자 데이터가 보인다.
  clearExperiences: () => set({ experiences: [], loading: false, loadError: null, _editHistory: {} }),

  fetchExperiences: async (userId) => {
    set({ loading: true, loadError: null });
    try {
      const { data } = await api.get('/experience/list');
      const experiences = (Array.isArray(data) ? data : [])
        .map(normalizeExperienceForCurrentJob)
        .sort((a, b) => {
          // sortOrder가 있으면 우선, 없으면 createdAt 역순
          if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
          if (a.sortOrder != null) return -1;
          if (b.sortOrder != null) return 1;
          return toMillis(b.createdAt) - toMillis(a.createdAt);
        });
      set({ experiences });
    } catch (error) {
      console.error('경험 목록 불러오기 실패:', error);
      // 실패를 '데이터 없음'으로 오인하면 사용자가 데이터가 사라진 줄 안다. 구분해서 알린다.
      set({ loadError: error?.message || '경험 목록을 불러오지 못했습니다' });
    }
    set({ loading: false });
  },

  createExperience: async (userId, data) => {
    const payload = omitUndefined({
      ...data,
      userId,
      title: data.title || '',
      framework: data.framework || 'STRUCTURED',
      jobCategory: data.jobCategory || 'common',
      careerStage: data.careerStage || 'first',
      content: data.content || {},
      images: data.images || [],
      keywords: data.keywords || [],
    });
    const { data: newExp } = await api.post('/experience', payload);
    set(state => ({ experiences: [newExp, ...state.experiences] }));
    return newExp.id;
  },

  updateExperience: async (id, data) => {
    await api.patch(`/experience/${id}`, data);
    set(state => ({
      experiences: state.experiences.map(e => e.id === id ? { ...e, ...data } : e),
    }));
  },

  // 태그 없는 경험을 AI로 일괄 자동 태깅(백필). 한 번 호출 = 최대 12건.
  autoTagAll: async (force = false) => {
    const { data } = await api.post('/experience/auto-tag-all', { force });
    if (data.results?.length) {
      set(state => ({
        experiences: state.experiences.map(e => {
          const r = data.results.find(x => x.id === e.id);
          return r ? { ...e, competencyTags: r.competencyTags, workStyleTags: r.workStyleTags } : e;
        }),
      }));
    }
    return data; // { tagged, processed, remaining }
  },

  deleteExperience: async (id) => {
    await api.delete(`/experience/${id}`);
    set(state => ({
      experiences: state.experiences.filter(e => e.id !== id),
    }));
  },

  reorderExperiences: async (orderedIds) => {
    // Update local state immediately
    set(state => {
      const map = new Map(state.experiences.map(e => [e.id, e]));
      const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
      // Include any not in orderedIds at the end
      const remaining = state.experiences.filter(e => !orderedIds.includes(e.id));
      return { experiences: [...reordered, ...remaining] };
    });
    // Persist order to Firestore
    try {
      await api.post('/experience/reorder', { orderedIds });
    } catch (err) {
      console.error('순서 저장 실패:', err);
    }
  },

  analyzeExperience: async (experienceId, options = {}) => {
    // AI 분석 전, 현재 structuredResult를 히스토리에 스냅샷 저장
    const current = get().experiences.find(e => e.id === experienceId);
    if (current) {
      get().pushEditSnapshot(experienceId, {
        content: current.content,
        title: current.title,
        structuredResult: current.structuredResult,
      });
    }
    const payload = { experienceId };
    if (options.momentsCount !== undefined) payload.momentsCount = options.momentsCount;
    if (Array.isArray(options.reviewedMoments) && options.reviewedMoments.length > 0) {
      payload.reviewedMoments = options.reviewedMoments;
    }
    const { data } = await api.post('/experience/analyze', payload, { timeout: 300000 });
    set(state => ({
      experiences: state.experiences.map(e =>
        e.id === experienceId ? { ...e, structuredResult: data, keywords: data.keywords || [] } : e
      ),
    }));
    return data;
  },

  /** 빠른 초안 생성 (flash 1회, 검색 없음). 경험 생성 전 호출. 실패 시 throw → 호출부에서 로컬 폴백. */
  draftAnalyze: async ({ content, jobCategory, careerStage, interviewMode = 'basic' }) => {
    const { data } = await api.post('/experience/draft', {
      content, jobCategory, careerStage, interviewMode,
    }, { timeout: 90000 });
    return data;
  },

  /** 빈 섹션 채우기 초안: 경험정리+프로필+공고로 자기소개/스킬/가치관/목표/비교과 생성 */
  generateBoostDraft: async ({ profile, jobAnalysis }) => {
    const { data } = await api.post('/experience/boost-draft', { profile, jobAnalysis }, { timeout: 90000 });
    return data; // { valuesEssay, skills, values, goals, extracurricular }
  },

  /** 자료 텍스트에서 핵심 경험(moments)을 추출. TemplateSelect 자료 수집 플로우용. */
  extractMoments: async (rawText, title) => {
    const { data } = await api.post('/experience/extract-moments', {
      rawText, title,
    }, { timeout: 120000 });
    return data; // { moments: [...] }
  },

  /** 인터뷰 답변 가드레일 — 무의미 답변 판정 + FitPoly 톤 가공. 실패 시 호출부에서 원문 사용. */
  refineAnswer: async ({ question, answer, sectionLabel, jobCategory }) => {
    const { data } = await api.post('/experience/refine-answer', {
      question, answer, sectionLabel, jobCategory,
    }, { timeout: 20000 });
    return data; // { usable, refined }
  },

  /** 자유 텍스트 기반 핵심 경험 보강 */
  refineKeyExperience: async (currentExp, freeFormText) => {
    const { data } = await api.post('/experience/refine-key-experience', {
      currentExp, freeFormText,
    }, { timeout: 120000 });
    return data;
  },

  // AI 시장/지표 리서치 (최신 뉴스·지표·논문 → 의사결정 지표 추천)
  researchMarketMetrics: async (payload) => {
    const { data } = await api.post('/experience/research-metrics', payload, { timeout: 200000 });
    return data;
  },

  // AI 근거 라벨 판단 (섹션별 사실/추정/가정/해석 + 근거 레벨 A~D)
  judgeEvidenceLabels: async (sections) => {
    const { data } = await api.post('/experience/evidence-labels', { sections }, { timeout: 120000 });
    return data || {};
  },

  // 대화형 추출 인터뷰: 초안에서 핵심 정보를 끌어내는 질문 생성
  generateInterviewQuestions: async (braindump, jobCategory, interviewMode = 'basic') => {
    const { data } = await api.post('/experience/interview-questions', {
      braindump, jobCategory, interviewMode,
    }, { timeout: 120000 });
    return data.plan || { questions: data.questions || [] };
  },

  /** 서로 다른 경험에서 반복된 업무 방식 후보 찾기 — 사용자가 눌렀을 때만 실행 */
  suggestIdentityPatterns: async () => {
    const { data } = await api.post('/experience/identity-patterns/suggest', {}, { timeout: 90000 });
    return data;
  },

  /** AI가 찾은 반복 패턴을 사용자가 승인한 뒤에만 프로필 정체성으로 저장 */
  approveIdentityPattern: async (candidateId) => {
    const { data } = await api.post('/experience/identity-patterns/approve', { candidateId });
    return data;
  },

  dismissIdentityPattern: async (candidateId) => {
    const { data } = await api.post('/experience/identity-patterns/dismiss', { candidateId });
    return data;
  },

  // 추출형 인터뷰: 후속 질문 답변을 AI에 되먹여 경험 정리를 보강
  enrichFromInterview: async (experienceId, qa) => {
    const current = get().experiences.find(e => e.id === experienceId);
    if (current) {
      get().pushEditSnapshot(experienceId, {
        content: current.content, title: current.title, structuredResult: current.structuredResult,
      });
    }
    const { data } = await api.post('/experience/enrich-interview', { experienceId, qa }, { timeout: 300000 });
    set(state => ({
      experiences: state.experiences.map(e =>
        e.id === experienceId ? { ...e, structuredResult: data, keywords: data.keywords || [] } : e
      ),
    }));
    return data;
  },

  // ── 히스토리 관련 ──────────────────────────────────
  // 스냅샷을 히스토리에 push (최대 20개 유지)
  pushEditSnapshot: (experienceId, snapshot) => {
    set(state => {
      const history = state._editHistory[experienceId] || { past: [], future: [] };
      const past = [...history.past, snapshot].slice(-20);
      return {
        _editHistory: {
          ...state._editHistory,
          [experienceId]: { past, future: [] },
        },
      };
    });
  },

  // Undo: 직전 스냅샷으로 복원하고 현재 상태를 future에 저장
  undoEdit: (experienceId) => {
    const state = get();
    const history = state._editHistory[experienceId];
    if (!history || history.past.length === 0) return null;

    const current = state.experiences.find(e => e.id === experienceId);
    const past = [...history.past];
    const snapshot = past.pop();
    const future = [
      { content: current?.content, title: current?.title, structuredResult: current?.structuredResult },
      ...(history.future || []),
    ].slice(0, 20);

    set(s => ({
      _editHistory: {
        ...s._editHistory,
        [experienceId]: { past, future },
      },
    }));
    return snapshot;
  },

  // Redo: future 스택에서 복원
  redoEdit: (experienceId) => {
    const state = get();
    const history = state._editHistory[experienceId];
    if (!history || history.future.length === 0) return null;

    const current = state.experiences.find(e => e.id === experienceId);
    const future = [...history.future];
    const snapshot = future.shift();
    const past = [
      ...(history.past || []),
      { content: current?.content, title: current?.title, structuredResult: current?.structuredResult },
    ].slice(-20);

    set(s => ({
      _editHistory: {
        ...s._editHistory,
        [experienceId]: { past, future },
      },
    }));
    return snapshot;
  },

  canUndo: (experienceId) => {
    const h = get()._editHistory[experienceId];
    return (h?.past?.length ?? 0) > 0;
  },

  canRedo: (experienceId) => {
    const h = get()._editHistory[experienceId];
    return (h?.future?.length ?? 0) > 0;
  },
}));

export default useExperienceStore;
