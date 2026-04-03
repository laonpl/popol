import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 모델 우선순위 (에러 발생 시 순서대로 폴백)
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

// 지수 백오프 재시도 함수
async function generateWithRetry(prompt, retries = 5, delayMs = 3000) {
  let lastError;
  for (let modelIdx = 0; modelIdx < MODEL_FALLBACKS.length; modelIdx++) {
    const modelName = MODEL_FALLBACKS[modelIdx];
    const model = genAI.getGenerativeModel({ model: modelName });
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const status = err?.status ?? err?.response?.status;
        const retryableStatuses = [429, 503, 500];
        const fallbackStatuses = [404, 400];
        if (retryableStatuses.includes(status)) {
          if (attempt < retries - 1) {
            const wait = delayMs * Math.pow(2, attempt);
            console.warn(`[Gemini] ${modelName} ${status} - ${attempt + 1}번째 재시도 (${wait}ms 대기)`);
            await new Promise(r => setTimeout(r, wait));
          } else {
            console.warn(`[Gemini] ${modelName} 재시도 소진 - 다음 모델로 전환`);
            break; // 다음 모델로
          }
        } else if (fallbackStatuses.includes(status)) {
          console.warn(`[Gemini] ${modelName} ${status} - 다음 모델로 전환`);
          break; // 다음 모델로
        } else {
          throw err;
        }
      }
    }
  }
  throw lastError;
}

export async function analyzeExperience(content, framework) {
  const contentText = Object.entries(content)
    .map(([key, val]) => `[${key}]: ${val}`)
    .join('\n');

  const prompt = `당신은 HR 전문가이자 취업 컨설턴트입니다. 아래의 ${framework} 프레임워크로 작성된 경험을 분석해주세요.

## 경험 내용:
${contentText}

## 분석 요청사항:
1. **역량 키워드 추출**: 이 경험에서 드러나는 핵심 역량 키워드를 3-5개 추출 (예: 문제해결, 협업 능력, 리더십, 도전/열정 등)
2. **텍스트 하이라이팅**: 각 필드에서 핵심적인 문장/구절을 찾아서 하이라이트 정보 제공
   - type: "core" (핵심 역량), "derived" (파생 역량), "growth" (성장 관점)
   - field 값은 반드시 위 경험 내용의 [key] 부분을 그대로 사용 (예: situation, fact, keep 등)
   - text 값은 위 경험 내용에 있는 문장을 **그대로** 복사 (수정 없이)
   - keywords 값은 해당 문장/구절이 나타내는 역량 키워드를 1-2개만 (competencyKeywords 중에서 선택)
3. **추천 자소서 문항**: 이 경험을 활용할 수 있는 자기소개서 문항 3개 추천
4. **HR Insight**: HR 담당자 관점에서의 평가 한 줄

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "competencyKeywords": ["키워드1", "키워드2", "키워드3"],
  "highlights": [
    {"field": "필드키", "text": "경험 내용에서 그대로 복사한 텍스트", "type": "core", "keywords": ["이 구절에 해당하는 키워드"]},
    {"field": "필드키", "text": "경험 내용에서 그대로 복사한 텍스트", "type": "derived", "keywords": ["이 구절에 해당하는 키워드"]}
  ],
  "suggestedQuestions": ["문항1", "문항2", "문항3"],
  "hrInsight": "HR 관점 평가",
  "summary": "경험 요약 한 줄"
}`;

  const text = await generateWithRetry(prompt);

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 응답 파싱 실패');
  }
  return JSON.parse(jsonMatch[0]);
}

export async function generateCoverLetterDraft(question, linkedExperiences, targetCompany, targetPosition) {
  const experienceText = linkedExperiences.map((exp, i) => {
    const content = Object.entries(exp.content || {})
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    return `[경험 ${i + 1}: ${exp.title}]\n${content}`;
  }).join('\n\n');

  // Gemini AI 시도
  try {
    const prompt = `당신은 취업 자소서 전문 컨설턴트입니다. 아래 정보를 바탕으로 자기소개서 답변 초안을 작성해주세요.

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

    return (await generateWithRetry(prompt)).trim();
  } catch (err) {
    console.warn('Gemini 자소서 초안 생성 실패, 템플릿 폴백 사용:', err.message);
    // 폴백: 경험 기반 템플릿 초안 생성
    return generateFallbackDraft(question, linkedExperiences, targetCompany, targetPosition);
  }
}

function generateFallbackDraft(question, linkedExperiences, targetCompany, targetPosition) {
  const company = targetCompany || '귀사';
  const position = targetPosition || '해당 직무';

  if (!linkedExperiences.length) {
    return `[${company} 지원 - ${position}]\n\n문항: ${question || '(문항 없음)'}\n\n저는 ${company}에 ${position} 직무로 지원하게 되었습니다.\n\n(여기에 관련 경험과 역량을 작성해주세요. 경험 카드를 연결하면 더 구체적인 초안이 생성됩니다.)`;
  }

  let draft = '';
  const firstExp = linkedExperiences[0];
  const content = firstExp.content || {};

  // STAR 구조로 초안 작성
  if (content.situation) {
    draft += content.situation.substring(0, 200);
    if (content.situation.length > 200) draft += '...';
    draft += '\n\n';
  }

  if (content.task) {
    draft += `이를 해결하기 위해 목표로 삼은 것은 다음과 같습니다. ${content.task.substring(0, 150)}`;
    draft += '\n\n';
  }

  if (content.action) {
    draft += `구체적으로 ${content.action.substring(0, 200)}`;
    if (content.action.length > 200) draft += '...';
    draft += '\n\n';
  }

  if (content.result) {
    draft += `그 결과, ${content.result.substring(0, 150)}`;
    draft += '\n\n';
  }

  draft += `이 경험을 통해 얻은 역량을 ${company}의 ${position} 직무에서 적극 발휘하겠습니다.`;

  return draft.trim() || `${company}에 ${position}(으)로 지원합니다.\n\n(연결된 경험을 바탕으로 직접 작성해주세요.)`;
}

export async function validatePortfolioWithAI(portfolioData, experiencesData) {
  const sectionsText = (portfolioData.sections || []).map((s, i) =>
    `[섹션 ${i + 1}: ${s.title}]\n역할: ${s.role || '미기재'}\n기여도: ${s.contribution || '미기재'}%\n내용: ${s.content || '(비어있음)'}`
  ).join('\n\n');

  const prompt = `당신은 포트폴리오 검수 전문가입니다. 아래 포트폴리오를 검수해주세요.

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

  const result2 = await generateWithRetry(prompt);
  const jsonMatch = result2.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 검수 응답 파싱 실패');
  }
  return JSON.parse(jsonMatch[0]);
}
