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

export async function analyzeExperience(content) {
  const contentText = Object.entries(content)
    .map(([key, val]) => `[${key}]: ${val}`)
    .join('\n');

  const prompt = `당신은 실리콘밸리 탑티어 기업의 수석 채용 담당자이자, 취준생의 파편화된 경험을 '합격률 1%의 직무 맞춤형 포트폴리오'로 변환해 주는 최고의 커리어 컨설턴트입니다.

## 경험 내용 (Raw Data):
${contentText}

## 핵심 원칙:
1. **두괄식 어필**: 프로젝트 핵심 성과(Key Result)를 가장 먼저 제시하세요 — 구체적인 수치가 있으면 반드시 포함
2. **Why-How 연결**: '무엇을 했는가(What)'의 나열을 피하고, '왜(Why)'와 '어떻게(How)'를 논리적으로 연결하세요
3. **명확한 기여도**: 팀 프로젝트라면 본인이 직접 수행한 역할과 기여도(%)를 명확히 분리하세요
4. **문체**: 프로페셔널한 비즈니스 톤, 개조식 문장(~함, ~구축, ~달성) 사용

## 작업 지시:
1. 경험 내용에서 **희망 직무(inferredRole)**를 유추하세요
   - 개발자(프론트/백엔드) / 기획자·PM·PO / 마케터 / 디자이너 / 데이터 분석가 중 하나
2. 유추한 직무에 따라 **직무별 Action & Strategy 프레임워크**를 엄격히 적용하세요
3. 수치나 논리가 부족한 부분은 절대 지어내지 말고 coachQuestions에 꼬리질문을 포함하세요

## 직무별 Action & Strategy 프레임워크 (skills 섹션에 적용):

### A. 개발자 (프론트/백엔드)
- 포커스: 기술적 깊이와 문제 해결 능력
- section3Label: "Architecture & Troubleshooting / 기술 결정 및 문제 해결"
- 필수 포함: ① 아키텍처 구조 및 기술 채택의 논리적 배경 ② 개발 중 병목·버그 등 문제와 코드 레벨 해결 과정 ③ 테스트 방법론

### B. 기획자 (PM/PO) & 마케터
- 포커스: 데이터 기반 의사결정과 전략적 기획 흐름
- section3Label: "Strategy & Execution / 전략 수립 및 실행"
- 필수 포함: ① 지표/VoC 기반 가설("A하면 B할 것이다") ② A/B 테스트, 매체 믹스, 타 부서 협업 리딩 과정

### C. 디자이너 (프로덕트/브랜드)
- 포커스: 논리적 디자인 도출 프로세스
- section3Label: "Concept & Design System / 컨셉 및 설계 과정"
- 필수 포함: ① 데이터 기반 유저 페인포인트 파악 ② 무드보드·유저 플로우·컴포넌트화 과정

### D. 데이터 분석가
- 포커스: 데이터 파이프라인 및 시각화 인사이트
- section3Label: "Pipeline & Insight / 분석 과정 및 인사이트"
- 필수 포함: ① 데이터 수집·가공 파이프라인 ② 시각화를 통해 도출한 비즈니스 해결 방안

## 섹션 구성 (JSON 필드 매핑):

- **projectName**: 경험/프로젝트의 핵심을 담은 명확한 제목
- **period**: 활동 기간 (추정 가능하면 작성, 없으면 빈 문자열)
- **reason**: [Overview & Summary] 본인의 역할, 기여도(%), 사용 기술·툴을 개조식으로 정리
- **solution**: [🏆 Key Result — 두괄식] 가장 눈에 띄는 정량적 성과 1~2줄을 가장 먼저 제시. 수치가 없으면 정성적 성과라도 임팩트 있게 작성
- **solutionReason**: [🎯 Problem Definition / Why] 진행 배경, 해결하고자 했던 핵심 문제, 문제를 선정한 이유
- **skills**: [💡 Action & Strategy / How] 직무별 프레임워크를 엄격히 적용한 실행 과정. 이미지 삽입이 필요한 위치에 "📎 [이미지 추천: (구체적 추천 내용)]" 텍스트 삽입
- **result**: [📊 Insight & Learnings] 성과 외에 프로젝트를 통해 개인적으로 성장한 부분, 인사이트, 다음에 적용할 점
- **others**: [🌱 Others] 메인 프로젝트 외 오픈소스 기여·테크 블로그·스터디·사이드 프로젝트 등 성장 태도 증명 활동. 없으면 빈 문자열

## 섹션 레이블 (직무에 따라 아래처럼 설정):
- **section1Label**: "Key Result / 핵심 성과" (고정)
- **section2Label**: "Problem Definition / 문제 정의 (Why)" (고정)
- **section3Label**: 직무별 프레임워크에서 지정한 레이블 (예: "Architecture & Troubleshooting / 기술 결정 및 문제 해결")
- **section4Label**: "Insight & Learnings / 인사이트 및 성장" (고정)

## 추가 필드:
- **inferredRole**: 유추된 직무명 (예: "프론트엔드 개발자", "PM", "퍼포먼스 마케터", "프로덕트 디자이너", "데이터 분석가")
- **keywords**: 이 경험에서 드러나는 핵심 역량 키워드 3~5개
- **highlights**: 각 섹션(reason, solution, solutionReason, skills, result)의 핵심 문장/구절
  - field: 섹션 key
  - text: 해당 섹션 내용에서 그대로 복사한 문장 (수정 없이)
  - type: "core" | "derived" | "growth"
  - keywords: 해당 구절이 나타내는 역량 키워드 1~2개
- **imageTips**: 직무에 맞는 섹션별 이미지 첨부 팁
  - 개발자: skills(코드 스니펫·ERD·아키텍처 다이어그램), solution(성능 측정 결과 캡처)
  - 기획자·마케터: solutionReason(지표 하락 대시보드), skills(A/B테스트 결과·기획서)
  - 디자이너: skills(와이어프레임·무드보드·유저플로우), result(최종 결과물 목업)
  - 데이터 분석가: skills(파이프라인 다이어그램·시각화 차트)
- **coachQuestions**: 직무별 필수 포인트가 누락된 경우 날카로운 꼬리질문 2~4개
  - 형식: "[누락 항목] 질문 내용"
  - 예: "[기여도 검증] 팀 프로젝트라면, 본인이 100% 직접 구현/기획한 부분은 정확히 어디인가요?"
  - 예: "[수치화 요구] 성과가 있다고 하셨는데, 구체적으로 몇 % 개선되었나요? 대략적인 수치라도 있으신가요?"

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
{
  "inferredRole": "유추된 직무명",
  "projectName": "프로젝트 제목",
  "period": "기간",
  "reason": "Overview: 역할, 기여도(%), 사용 기술·툴 정리",
  "solution": "Key Result: 두괄식 핵심 성과 (수치 포함)",
  "solutionReason": "Problem Definition: 진행 배경 및 핵심 문제 정의 (Why)",
  "skills": "Action & Strategy: 직무별 프레임워크 적용 실행 과정 (How)",
  "result": "Insight & Learnings: 성장 포인트 및 인사이트",
  "others": "기타 활동 (없으면 빈 문자열)",
  "section1Label": "Key Result / 핵심 성과",
  "section2Label": "Problem Definition / 문제 정의 (Why)",
  "section3Label": "직무별 프레임워크 레이블",
  "section4Label": "Insight & Learnings / 인사이트 및 성장",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "highlights": [
    {"field": "solution", "text": "섹션 내용에서 그대로 복사한 텍스트", "type": "core", "keywords": ["키워드"]},
    {"field": "skills", "text": "섹션 내용에서 그대로 복사한 텍스트", "type": "derived", "keywords": ["키워드"]}
  ],
  "imageTips": {
    "reason": "팁",
    "solution": "팁",
    "solutionReason": "팁",
    "skills": "팁",
    "result": "팁"
  },
  "coachQuestions": ["[기여도 검증] 질문1", "[수치화 요구] 질문2"],
  "followUpQuestions": ["질문1", "질문2", "질문3"]
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
