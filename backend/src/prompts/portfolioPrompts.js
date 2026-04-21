/**
 * portfolioPrompts.js
 * 자기소개서 초안 / 포트폴리오 검수 / 직무 요건 매칭 프롬프트 빌더.
 */

/** 자기소개서 문항 답변 초안을 생성하는 프롬프트. */
export function buildCoverLetterDraftPrompt(question, experienceText, targetCompany, targetPosition) {
  return `자소서 전문 컨설턴트입니다. 아래 정보로 자기소개서 답변 초안을 작성하세요.

지원: ${targetCompany || '미정'} / ${targetPosition || '미정'}
문항: ${question}
활용 경험: ${experienceText ? experienceText.substring(0, 2000) : '없음'}

작성 기준: STAR 구조, 구체적 수치 포함, 500자 내외, 자연스러운 한국어.
답변만 작성 (추가 설명 없이):`;
}

/** 포트폴리오 전체 검수(맞춤형/기여도/오타) 프롬프트. */
export function buildValidatePortfolioPrompt(portfolioData, sectionsText) {
  return `포트폴리오 검수 전문가입니다.

제목: ${portfolioData.title} | 기업: ${portfolioData.targetCompany || '미정'} | 직무: ${portfolioData.targetPosition || '미정'}

섹션 내용:
${sectionsText.substring(0, 3000)}

검수 항목:
1. 기업/직무 맞춤형 (프로젝트 순서·강조 포인트 적절성)
2. 기여도 명시 (팀 프로젝트 역할·기여도% 기재 여부)
3. 오타/비문

반드시 아래 JSON으로만 응답:
{
  "customization": { "passed": true, "message": "..." },
  "contribution": { "passed": true, "message": "..." },
  "proofread": { "passed": true, "message": "...", "issues": [] }
}`;
}

/** 섹션별 직무 요건 매칭 분석 프롬프트. */
export function buildMatchSectionsPrompt(targetCompany, targetPosition, sectionsText) {
  return `포트폴리오 컨설턴트입니다.
"${targetCompany}" "${targetPosition}" 직무에 아래 섹션들이 부합하는지 분석하세요.

평가: matched=true(직무 강점 명확), matched=false(관련성 낮음/내용 부족)

섹션:
${sectionsText.substring(0, 3000)}

JSON 배열로만 응답:
[{ "index": 0, "matched": true, "relevance": "high", "reason": "한 문장" }]`;
}

/** 포트폴리오 섹션 1개를 기업 맞춤형으로 재작성하는 프롬프트 (병렬 처리용). */
export function buildSingleSectionTailorPrompt(section, index, jobAnalysis) {
  return `취업 전문 컨설턴트입니다. 포트폴리오 섹션 1개를 기업 맞춤형으로 재작성하세요.
사실을 유지하되 기업이 원하는 역량·가치관 강조 방향으로 표현만 조정. 내용 없는 섹션은 그대로 반환.
JSON 값 안에 마크다운 기호(**, ##, *, -) 사용 금지.

기업: ${jobAnalysis.company || ''} | 직무: ${jobAnalysis.position || ''}
스킬: ${(jobAnalysis.skills || []).join(', ')} | 인재상: ${(jobAnalysis.coreValues || []).join(', ')}
필수요건: ${(jobAnalysis.requirements?.essential || []).slice(0, 4).join(', ')}

섹션 정보:
타입: ${section.type || ''} | 제목: ${section.title || ''}
내용: ${(section.content || '(내용 없음)').substring(0, 600)}

반드시 아래 JSON으로만 응답:
{ "index": ${index}, "tailoredContent": "재작성된 내용", "changeReason": "변경 이유 한 줄", "changed": true }`;
}

/** 자소서 문항 1개에 대한 답변 초안을 생성하는 프롬프트 (병렬 처리용). */
export function buildSingleCoverLetterAnswerPrompt(question, maxLength, expText, jobAnalysis) {
  return `자소서 전문 컨설턴트입니다. 자기소개서 문항 1개에 대한 답변을 작성하세요.

기업: ${jobAnalysis.company || '미정'} | 직무: ${jobAnalysis.position || '미정'}
인재상: ${(jobAnalysis.coreValues || []).join(', ')} | 스킬: ${(jobAnalysis.skills || []).slice(0, 6).join(', ')}

문항: ${question}
글자 수 제한: ${maxLength || '제한 없음'}자 내외

활용 경험:
${(expText || '등록된 경험 없음').substring(0, 2000)}

작성 기준: 인재상 맞춤, 글자수 준수, 구체적 수치·사례 포함, STAR 구조, 자연스러운 한국어.

반드시 아래 JSON으로만 응답:
{ "question": "${question.replace(/"/g, '\\"').substring(0, 100)}", "answer": "작성된 답변", "wordCount": 0, "highlightedValues": [] }`;
}
