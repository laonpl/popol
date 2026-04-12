import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 모델 우선순위 (에러 발생 시 순서대로 폴백)
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];

// 지수 백오프 재시도 함수
async function generateWithRetry(prompt, retries = 3, delayMs = 2000) {
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
        const retryableStatuses = [503, 500];
        const fallbackStatuses = [404, 400];
        if (status === 429) {
          // Rate limit / quota 소진 → 다음 모델로 즉시 전환
          console.warn(`[Gemini] ${modelName} 429 - 다음 모델로 폴백`);
          break;
        } else if (retryableStatuses.includes(status)) {
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

export async function analyzeExperience(content) {
  // content가 비었는지 검증
  const entries = Object.entries(content).filter(([, val]) => val && String(val).trim().length > 0);
  if (entries.length === 0) {
    throw new Error('분석할 경험 내용이 비어있습니다. 내용을 먼저 작성해주세요.');
  }

  // 내용이 너무 길면 Gemini 토큰 한도 초과 방지를 위해 각 필드 3000자 제한
  const contentText = entries
    .map(([key, val]) => `[${key}]: ${String(val).substring(0, 3000)}`)
    .join('\n');

  const prompt = `당신은 포트폴리오 전문 커리어 코치입니다. 아래 경험/프로젝트 자료를 분석하여 포트폴리오에 바로 사용할 수 있는 형태로 구조화해주세요.

## 핵심 규칙:
- 절대 경험을 만들어내지 마세요. 입력된 내용에서 추출/정리만 하세요.
- 입력 내용에 해당 정보가 없으면 빈 문자열("")로 남겨주세요.
- **핵심경험(keyExperiences)은 반드시 수치/지표를 포함하여 포트폴리오에 바로 쓸 수 있게** 작성하세요.
- 수치가 원문에 없으면 맥락에서 합리적으로 추정하되 "약", "추정" 등을 붙여주세요.

## 경험 내용:
${contentText}

## 응답 구조:

### 1. projectOverview (프로젝트 개요) - 상단에 한눈에 보이는 요약
- summary: 프로젝트를 한 문장으로 설명 (30자 내외)
- background: 프로젝트 배경과 문제 상황 (2~3문장)
- goal: 프로젝트의 핵심 목표
- role: 본인의 역할
- team: 팀 구성 (예: "백엔드 2명, 프론트 2명, 디자이너 1명") - 모르면 ""
- duration: 기간 - 모르면 ""
- techStack: 사용 기술 스택 배열 - 모르면 []

### 2. keyExperiences (핵심 경험 3개) - 포트폴리오의 하이라이트
각 핵심 경험은 다음 형식:
- title: 한 줄 제목 (수치 포함, 예: "로그인 로직 개편으로 사용자 이탈률 12% 감소")
- metric: 핵심 수치/지표 (예: "12%↓", "3배 향상", "200ms→50ms")
- metricLabel: 수치 설명 (예: "사용자 이탈률 감소", "처리 속도 개선")
- beforeMetric: 개선 전 기준 수치 (예: "평균 16시간", "약 6억 원", "이탈률 34%") — 비교 그래프용, 반드시 숫자+단위 형태로
- afterMetric: 개선 후 수치 (예: "평균 2시간", "약 4억 원", "이탈률 22%") — 비교 그래프용, 반드시 숫자+단위 형태로
- situation: 어떤 상황/문제가 있었는지
- action: 본인이 구체적으로 무엇을 했는지
- result: 어떤 결과를 얻었는지
- keywords: 이 경험에서 드러나는 역량 키워드 1~2개

### 3. 기존 7가지 구조화 섹션 (상세 내용)
- intro, overview, task, process, output, growth, competency

### 4. 추가 분석
- keywords: 전체 핵심 역량 키워드 3~5개
- followUpQuestions: 내용 보강을 위한 후속 질문 3개
- highlights: 원문에서 역량이 드러나는 하이라이트 배열

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
{
  "projectOverview": {
    "summary": "프로젝트 한 줄 설명",
    "background": "배경 설명",
    "goal": "핵심 목표",
    "role": "본인 역할",
    "team": "팀 구성",
    "duration": "기간",
    "techStack": ["React", "Node.js"]
  },
  "keyExperiences": [
    {
      "title": "로그인 로직 개편으로 사용자 이탈률 12% 감소",
      "metric": "12%↓",
      "metricLabel": "사용자 이탈률 감소",
      "beforeMetric": "이탈률 34%",
      "afterMetric": "이탈률 22%",
      "situation": "상황 설명",
      "action": "수행한 행동",
      "result": "결과",
      "keywords": ["문제해결", "UX개선"]
    }
  ],
  "intro": "프로젝트 소개",
  "overview": "프로젝트 개요",
  "task": "진행한 일",
  "process": "과정",
  "output": "결과물",
  "growth": "성장한 점",
  "competency": "나의 역량",
  "keywords": ["키워드1", "키워드2"],
  "followUpQuestions": ["질문1", "질문2", "질문3"],
  "highlights": [
    { "field": "intro", "text": "원문 텍스트", "type": "core", "keywords": ["키워드"] }
  ]
}`;

  const text = await generateWithRetry(prompt);

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
