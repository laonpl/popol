/**
 * portfolioPrompts.js
 * 자기소개서 초안 / 포트폴리오 검수 / 직무 요건 매칭 프롬프트 빌더.
 */

/** 자기소개서 문항 답변 초안을 생성하는 프롬프트. */
export function buildCoverLetterDraftPrompt(question, experienceText, targetCompany, targetPosition) {
  return `당신은 취업 자소서 전문 컨설턴트입니다. 아래 정보를 바탕으로 자기소개서 답변 초안을 작성해주세요.

## 지원 정보:
- 기업: ${targetCompany || '미정'}
- 직무: ${targetPosition || '미정'}

## 문항:
${question}

## 활용할 경험:
${experienceText || '연결된 경험 없음'}

## 작성 가이드:
- 구체적인 사례와 수치를 포함하세요
- STAR 구조(상황-과제-행동-결과)를 자연스럽게 녹여내세요
- 지원 기업/직무에 맞는 역량을 강조하세요
- 500자 내외로 작성하세요
- 자연스러운 한국어로 작성하세요

답변만 작성하세요 (추가 설명 없이):`;
}

/** 포트폴리오 전체 검수(맞춤형/기여도/오타) 프롬프트. */
export function buildValidatePortfolioPrompt(portfolioData, sectionsText) {
  return `당신은 포트폴리오 검수 전문가입니다. 아래 포트폴리오를 검수해주세요.

## 포트폴리오 정보:
- 제목: ${portfolioData.title}
- 지원 기업: ${portfolioData.targetCompany || '미정'}
- 지원 직무: ${portfolioData.targetPosition || '미정'}

## 섹션 내용:
${sectionsText}

## 검수 항목:
1. **기업 맞춤형 검토**: 지원 기업/직무에 맞게 프로젝트 순서와 강조 포인트가 적절한가?
2. **기여도 명시 검토**: 팀 프로젝트에서 본인 역할(Role)과 기여도(%)가 모든 섹션에 기재되어 있는가?
3. **오타/비문 검수**: 오타, 비문, 어색한 표현이 있는가?

반드시 아래 JSON 형식으로만 응답하세요:
{
  "customization": {
    "passed": true/false,
    "message": "검토 결과 메시지"
  },
  "contribution": {
    "passed": true/false,
    "message": "검토 결과 메시지"
  },
  "proofread": {
    "passed": true/false,
    "message": "검토 결과 메시지",
    "issues": ["발견된 문제 1", "발견된 문제 2"]
  }
}`;
}

/** 섹션별 직무 요건 매칭 분석 프롬프트. */
export function buildMatchSectionsPrompt(targetCompany, targetPosition, sectionsText) {
  return `당신은 취업 포트폴리오 전문 컨설턴트입니다.
아래 포트폴리오 섹션들이 "${targetCompany}" 기업의 "${targetPosition}" 직무 요건에 얼마나 부합하는지 분석해주세요.

[평가 기준]
- matched=true: 해당 직무에 필요하거나 강점을 명확히 보여주는 섹션
- matched=false: 해당 직무와 관련성이 낮거나 내용이 부족한 섹션

[포트폴리오 섹션]
${sectionsText}

반드시 아래 JSON 배열 형식으로만 응답하세요 (마크다운 없이 순수 JSON):
[
  { "index": 0, "matched": true, "relevance": "high", "reason": "이유 한 문장" },
  { "index": 1, "matched": false, "relevance": "low", "reason": "이유 한 문장" }
]`;
}
