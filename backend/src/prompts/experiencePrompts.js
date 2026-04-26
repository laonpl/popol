/**
 * experiencePrompts.js
 * 경험 분석 / 핵심 경험 순간 추출 프롬프트 빌더.
 *
 * ★ 설계 원칙: Pro 모델(2M TPM)의 503 에러를 피하기 위해 프롬프트를 기능별로 분할.
 *   각 빌더는 output JSON 구조를 최소화하여 한 번의 응답이 Pro 한도 내에 들어가도록 함.
 */

const PR_GUIDELINES = `
[10가지 성과 공식]
① 성공형(정량성과) ② 트러블슈팅형(복구시간) ③ 의사결정형(리소스방어) ④ 자동화형(시간절감)
⑤ 협업형(기여도%) ⑥ 무에서유형(프로세스) ⑦ 자원부족형(ROI) ⑧ 설득형(효율성)
⑨ 피벗형(일정준수) ⑩ 기술형(성능최적화) — 이 중 가장 잘 맞는 유형으로 분류하세요.
`;

const METRIC_FILTER_GUIDELINES = `
[수치 규칙] 원본에 있는 %, 시간, 비용, 성능 수치만 추출. 주관적(만족도, 스트레스), 무의미한 양(줄 수), 과대포장(200% 증가) 금지.
✅ 허용: 성능(ms, %), 비용(원/$), 시간(일/시간), 건수/비율
※ 원본의 수치는 무조건 metric/beforeMetric/afterMetric에 채우세요.
`;

const NO_HALLUCINATION_RULES = `
[⛔ 핵심: 원본에 없는 내용 금지 (기술/숫자/회사/역할/상황 창작 금지)]
✅ 허용: 원본 요약·재구성·CARL 구조 매핑 · 명시된 수치 추출
❌ 금지 시 처리: "[작성 필요] (원본에 없음)" 표기
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
      { key: 'techStack',       label: '기술 스택 및 아키텍처',  guide: '사용 기술명·버전, 선택 이유(대안과 비교), 아키텍처 구조 결정 배경을 구체적으로 서술. 기술 선택의 논리적 근거가 핵심.' },
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

  const jobEmphasis = hasJobSections
    ? `\n[★ 직군 강조 — ${jobInfo.label}]\n${jobInfo.emphasis}\n직군 특화 섹션(jobSpecific)은 면접관이 가장 먼저 보는 핵심 파트입니다. 원본의 관련 내용을 최대한 끌어모아 풍부하게 서술하세요.\n`
    : '';

  const section7Guide = `
[7개 필수 섹션 작성 지침 — 각 섹션을 최소 3문장 이상으로 풍부하게 작성하세요]
1. intro      : 프로젝트를 처음 보는 면접관에게 한 눈에 이해시키는 강렬한 도입부. 핵심 성과나 차별점을 앞에 배치.
2. overview   : 프로젝트 배경(왜 필요했는가), 목적(무엇을 달성하려 했는가), 전체 범위를 맥락 있게 서술.
3. task       : 내가 직접 수행한 주요 과제. 배경→문제인식→핵심과제→해결 방향의 흐름으로 서술.
4. process    : 나의 직접적인 액션과 의사결정 과정. 왜 그 방법을 택했는지 판단 근거 포함.
5. output     : 최종 산출물과 핵심 포인트. 수치가 있다면 반드시 포함. 사용자·비즈니스에 미친 영향.
6. growth     : 이 경험을 통해 얻은 역량·인사이트·성장. 수치 성과가 있으면 성과 중심, 없으면 배운 점 중심.
7. competency : 이 경험에서 발휘된 역량이 입사 후 어떻게 기여할 수 있는지 구체적으로 연결.
`;

  return `당신은 포트폴리오 전문 커리어 코치입니다. 아래 경험 자료를 분석해 포트폴리오 섹션을 생성하세요.
대상 직군: ${jobInfo.label}

${NO_HALLUCINATION_RULES}
${jobEmphasis}
${section7Guide}

경험 내용:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "projectOverview": {
    "summary": "프로젝트 1~2줄 핵심 요약 (성과 수치 포함)",
    "background": "배경·문제 의식 (구체적으로)",
    "goal": "달성하려 한 목표",
    "role": "나의 역할과 기여 범위",
    "team": "팀 구성 (원본에 있으면)",
    "duration": "기간 (원본에 있으면)",
    "techStack": ["기술1", "기술2"]
  },
  "intro": "강렬한 도입부 (3~4문장, 성과 앞 배치)",
  "overview": "프로젝트 전체 개요 (배경·목적·범위, 3~5문장)",
  "task": "내가 수행한 주요 과제 (배경→문제→해결 흐름, 3~5문장)",
  "process": "진행 프로세스와 의사결정 (액션+판단 근거, 3~5문장)",
  "output": "최종 산출물과 성과 (수치 포함, 3~5문장)",
  "growth": "성장·인사이트·역량 (3~4문장)",
  "competency": "발휘된 역량과 입사 후 기여 가능성 (3~4문장)"${jobSectionSchema}
}
${hasJobSections ? `\n[직군 특화 섹션 작성 지침 — jobSpecific]\n${jobSectionGuides}\n원본에 관련 내용이 있다면 최대한 끌어모아 3~5문장으로 풍부하게 서술하세요. 원본에 없으면 "[작성 필요] ..." 처리.` : ''}

원본에 없는 내용은 "[작성 필요] ..." 로 남기세요. 있는 내용은 풍부하게 재구성하세요.`;
}

// ============================================================
// 분할 Step 2: keyExperience 개별 추출 (1개씩, 매우 작은 output)
// ============================================================
export function buildSingleKeyExperiencePrompt(contentText, momentHint, index, total) {
  const hintBlock = momentHint ? `
[이번에 분석할 경험 — ${index + 1}/${total}번째]
${JSON.stringify(momentHint, null, 2)}

위 moment의 title/context/action/result/learning/metric/keywords를 그대로 보존하며 누락 필드만 원본에서 보강하세요.
` : `
[${index + 1}/${total}번째 핵심 경험을 추출하세요]
원본 자료 중 아직 다루지 않은 관점/에피소드를 하나 골라 CARL 구조로 정리하세요.
`;

  return `포트폴리오 커리어 코치입니다. 아래 경험 자료에서 ${index + 1}번째 핵심 경험 1건만 추출하세요.

${NO_HALLUCINATION_RULES}

${PR_GUIDELINES}

${METRIC_FILTER_GUIDELINES}
${hintBlock}
원본 자료:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON, 1개 객체만):
{
  "title": "15자 이내 제목",
  "metric": "원본의 핵심 수치 (예: 30%, 800ms). 없으면 빈 문자열",
  "metricLabel": "수치 라벨 (예: 성능 향상)",
  "beforeMetric": "개선 전 수치 (있으면)",
  "afterMetric": "개선 후 수치 (있으면)",
  "context": "배경·맥락·문제 상황 (2~3문장)",
  "action": "구체적 행동·의사결정·방법론 (2~3문장)",
  "result": "결과·성과 (수치 포함, 2~3문장)",
  "learning": "이 경험에서 얻은 인사이트·역량·성장 (1~2문장)",
  "keywords": ["키워드1", "키워드2"],
  "chartType": "horizontalBar"
}

원본 "800ms → 480ms", "3일 → 1일" 같은 before/after 수치 있으면 반드시 beforeMetric/afterMetric에 모두 채우세요.`;
}

// ============================================================
// 분할 Step 3: 메타데이터 (keywords / highlights / followUpQuestions)
// ============================================================
export function buildMetaPrompt(contentText) {
  return `포트폴리오 커리어 코치입니다. 아래 경험 자료에서 메타 정보만 추출하세요.

${NO_HALLUCINATION_RULES}

경험 내용:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "keywords": ["프로젝트 전반을 대표하는 키워드 5~8개"],
  "highlights": ["자랑할 만한 포인트 3~5개 (각 1문장)"],
  "followUpQuestions": ["원본에 부족해 보완이 필요한 정보를 묻는 질문 3~5개"]
}

원본에 있는 내용만 기반으로 추출하세요.`;
}

// ============================================================
// 경험 순간 추출 (extractMoments) — 이미 작은 prompt
// ============================================================
export function buildExtractMomentsPrompt(rawText, title) {
  return `포트폴리오 커리어 코치입니다. 아래 자료에서 포트폴리오 핵심 경험을 추출하세요.

${NO_HALLUCINATION_RULES}

${PR_GUIDELINES}

${METRIC_FILTER_GUIDELINES}

★ 최소 3개 필수, 최대 10개까지 도출 가능한 한 최대한 모조리 추출하세요! ★
프로젝트명: ${title || '(미상)'}

추출 원칙 (중요):
1. 위 10가지 포트폴리오 성과 도출 공식 중 어느 유형에 가장 잘 맞는지 'type' 필드에 정확한 명칭(예: 인프라개선, 비용절감 등 10가지 중 하나)으로 적으세요.
2. 수치화된 그래프를 그려서 포트폴리오에 쓸 수 있도록, 정량적 수치(시간 단축, % 상승, 비용 방어 등)가 존재하는 경험을 가장 먼저, 집중적으로 추출하세요.
3. 각 섹션은 2~3문장으로 구체적으로 서술하세요.
   - Context: 배경·맥락·문제 상황 (왜 이 일이 필요했는가)
   - Action: 구체적 행동·의사결정·방법론 (내가 직접 한 것)
   - Result: 결과·성과 (수치 필수 추출)
   - Learning: 이 경험에서 얻은 인사이트·역량·성장 (입사 후 활용 가능한 부분)
4. 자료에 없는 내용은 절대 창작하지 말고, 필요시 끝에 (미확인: [질문])을 추가.
5. 위 NO_HALLUCINATION 규칙을 무조건 우선하세요. 원본에 없는 숫자·기술스택·회사명·역할은 한 글자도 쓰지 마세요.

원본 자료:
${rawText.substring(0, 5000)}

반드시 아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "moments": [
    {
      "id": "1",
      "type": "위 10가지 공식 중 해당하는 유형명",
      "title": "경험 제목 (15자 이내)",
      "description": "Context: ...\\nAction: ...\\nResult: ...\\nLearning: ...\\n(미확인: 선택적)",
      "context": "배경·맥락·문제 상황 (2~3문장)",
      "action": "구체적 행동·의사결정·방법론 (2~3문장)",
      "result": "결과·성과 (원본의 수치를 여기에 반드시 포함)",
      "learning": "이 경험에서 얻은 인사이트·역량·성장 (1~2문장)",
      "metric": "원본에 있는 핵심 수치 한 가지 (예: 40% 단축, 3일→1일, 800ms, 200만원 절감). 없으면 빈 문자열.",
      "metricLabel": "수치 라벨 (예: 응답 시간 단축, 처리 기간, 비용 절감). 없으면 빈 문자열.",
      "beforeMetric": "개선 전 수치 (예: 800ms, 3일, 100%). 원본에 있을 때만 기재.",
      "afterMetric": "개선 후 수치 (예: 480ms, 1일, 130%). 원본에 있을 때만 기재.",
      "keywords": ["그래프/수치 키워드", "핵심역량"]
    }
  ]
}

[⚠️ 수치 추출 필수 규칙]
- 원본 자료에서 숫자(%, 시간, 비용, 건수, 배수 등)가 발견되면 반드시 metric/beforeMetric/afterMetric에 채우세요.
- "800ms → 480ms", "3일을 1일로 단축", "34% → 12%" 같은 before/after 패턴이 있으면 beforeMetric/afterMetric을 모두 채워 비교 그래프를 그릴 수 있게 하세요.
- 단일 수치만 있는 경우(예: "40% 단축")는 metric에 넣고, beforeMetric/afterMetric은 비워두세요.
- 원본에 수치가 없으면 절대 지어내지 말고 빈 문자열로 두세요.

moments 배열은 반드시 3개 이상이어야 하며, 10가지 유형 공식을 활용해 가능한 한 많이(최대 10개) 뽑아주세요.`;
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
