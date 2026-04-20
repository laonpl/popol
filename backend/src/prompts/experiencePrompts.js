/**
 * experiencePrompts.js
 * 경험 분석 / 핵심 경험 순간 추출 프롬프트 빌더.
 */

/** 포트폴리오용 경험 구조화 분석 프롬프트. */
export function buildAnalyzeExperiencePrompt(contentText, maxCount) {
  const minCount = Math.max(maxCount, 2);
  return `포트폴리오 커리어 코치입니다. 아래 경험 자료를 분석해 포트폴리오용으로 구조화하세요.

원칙:
1. 입력 자료에 있는 내용만 사용. 없는 내용 창작 금지.
2. 자료에 없는 필드 → "[작성 필요] 간단한 질문" 형식으로 남기기.
3. 수치·성과는 자료에 있을 때만 기재.

★ keyExperiences 최소 ${minCount}개 필수 (절대 1개 이하로 응답하지 마세요) ★

keyExperiences를 충분히 도출하기 위한 전략:
- 하나의 프로젝트/경험 안에서도 서로 다른 관점(기술적 도전, 팀 협업, 문제 해결, 성과 등)을 분리해서 각각 별도의 keyExperience로 만드세요.
- 예: "API 설계 및 구현"과 "팀 커뮤니케이션 개선"은 같은 프로젝트여도 별개의 핵심 경험입니다.
- 자료가 짧더라도 다음 관점에서 최소 2개를 추출하세요:
  (1) 기술적/실무적 기여 — 무엇을 만들거나 해결했는가
  (2) 성장/학습/협업 — 무엇을 배우거나 어떻게 협업했는가

keyExperiences 선정 유형 (우선순위):
- 성공형: 가설→실행→정량성과
- 트러블슈팅형: 실패원인→수습→교훈
- 의사결정형: 데이터→드랍/피벗→리소스절감
- 개선/자동화형: 비효율발견→개선→시간/비용절감
- 협업/기여분리형: 팀목표→나의 구체적 기여
- 심화: 무에서유창조/자원부족/사일로타파/외부피벗/트래픽제로

경험 내용:
${contentText}

반드시 아래 JSON 형식으로만 응답 (마크다운 없이 순수 JSON):
{
  "projectOverview": {
    "summary": "...",
    "background": "...",
    "goal": "...",
    "role": "...",
    "team": "",
    "duration": "",
    "techStack": []
  },
  "keyExperiences": [
    {
      "title": "...",
      "metric": "...",
      "metricLabel": "...",
      "beforeMetric": "...",
      "afterMetric": "...",
      "situation": "...",
      "action": "...",
      "result": "...",
      "keywords": ["키워드1"]
    }
  ],
  "intro": "...",
  "overview": "...",
  "task": "...",
  "process": "...",
  "output": "...",
  "growth": "...",
  "competency": "...",
  "keywords": [],
  "followUpQuestions": [],
  "highlights": [
    { "field": "intro", "text": "원문 텍스트", "type": "core", "keywords": [] }
  ]
}

keyExperiences는 ${minCount}개 이상 필수. 1개만 응답하면 실패로 간주됩니다.
하나의 경험 자료에서도 다른 측면(기술, 협업, 성장, 문제해결)을 분리해 여러 개를 도출하세요.
"=== AI 추출 핵심 경험 ===" 섹션이 있으면 우선 변환. 없으면 자료에서 직접 추출.
부족한 필드는 "[작성 필요] ..." 힌트로 채우고 누락하지 말 것.
followUpQuestions는 자료에서 빠진 정보를 채우기 위한 질문 3~5개.`;
}

/** 원본 자료에서 포트폴리오 가치 있는 "경험 순간" 최대 10개를 추출하는 프롬프트. */
export function buildExtractMomentsPrompt(rawText, title) {
  return `포트폴리오 커리어 코치입니다. 아래 자료에서 포트폴리오 핵심 경험을 최소 2개, 최대 10개 추출하세요.

★ 최소 2개 필수 ★ — 자료가 짧더라도 서로 다른 관점(기술 도전, 협업, 성장, 문제해결)으로 분리해서 2개 이상 도출하세요.

프로젝트명: ${title || '(미상)'}

경험 유형 (type 필드에 기재):
성공형 / 트러블슈팅형 / 의사결정중단형 / 개선자동화형 / 협업기여형 / 무에서유창조형 / 자원부족형 / 사일로타파형 / 외부피벗형 / 트래픽제로형

description 작성 원칙 (중요):
각 섹션을 2~3문장으로 구체적으로 서술하세요.
- Situation: 상황·문제·배경
- Action: 구체적 행동·방법·선택 이유
- Result: 결과·성과·배운 점 (수치 있으면 반드시 포함)
자료에 없는 중요 정보가 있으면 끝에 1개만: (미확인: [질문]. [이유])

절대 원칙: 자료에 있는 내용만 사용. 없는 내용 창작 금지. 포트폴리오 가치 높은 순 정렬.

원본 자료:
${rawText.substring(0, 5000)}

반드시 아래 JSON 형식으로만 응답:
{
  "moments": [
    {
      "id": "1",
      "type": "유형명",
      "title": "경험 제목 (15자 이내)",
      "description": "Situation: ...\\nAction: ...\\nResult: ...\\n(미확인: 선택적)",
      "keywords": ["키워드1", "키워드2"]
    }
  ]
}

moments 배열은 반드시 2개 이상이어야 합니다. 1개만 응답하면 실패로 간주됩니다.`;
}
