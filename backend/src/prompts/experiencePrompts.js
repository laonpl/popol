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
// 분할 Step 1: 프로젝트 개요만 추출 (작은 output)
// ============================================================
export function buildOverviewPrompt(contentText) {
  return `포트폴리오 커리어 코치입니다. 아래 경험 자료에서 프로젝트 개요만 추출하세요.

${NO_HALLUCINATION_RULES}

경험 내용:
${contentText}

아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "projectOverview": {
    "summary": "프로젝트 1~2줄 요약",
    "background": "배경·문제 의식",
    "goal": "목표",
    "role": "나의 역할",
    "team": "팀 구성 (원본에 있으면)",
    "duration": "기간 (원본에 있으면)",
    "techStack": ["기술1", "기술2"]
  },
  "intro": "자기소개형 한 문단 도입부",
  "overview": "프로젝트 전체 개요 한 문단",
  "task": "내가 수행한 주요 과제",
  "process": "진행 프로세스 요약",
  "output": "최종 산출물",
  "growth": "성장·교훈",
  "competency": "발휘한 역량"
}

원본에 없는 내용은 "[작성 필요] ..." 로 남기세요.`;
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
