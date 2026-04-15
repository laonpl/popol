import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 모델 우선순위 (에러 발생 시 순서대로 폴백)
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
];

// SDK 에러에서 HTTP 상태코드 추출 (메시지 파싱 포함)
function extractStatus(err) {
  // SDK v0.21+ : err.status 에 직접 숫자가 있을 수 있음
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.response?.status === 'number') return err.response.status;
  // 메시지에서 [404 Not Found] 형식 파싱
  const m = String(err?.message || '').match(/\[(\d{3})\s/);
  if (m) return parseInt(m[1], 10);
  return null;
}

// 지수 백오프 재시도 함수 (모델간 폴백 포함)
async function generateWithRetry(prompt, retries = 2, delayMs = 1500) {
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
        const status = extractStatus(err);
        const msg = err?.message || '';
        console.warn(`[Gemini] ${modelName} 실패 (시도 ${attempt + 1}, status=${status}): ${msg.slice(0, 120)}`);

        // API Key 에러 → 즉시 중단 (어떤 모델이든 동일)
        if (status === 400 && (msg.includes('API key') || msg.includes('API Key'))) {
          console.error(`[Gemini] API 키 오류 - 유효한 Gemini API 키를 설정하세요`);
          throw err;
        }

        if (status === 429) {
          // Rate limit → 다음 모델로 즉시 전환
          break;
        } else if (status === 503 || status === 500) {
          // 일시적 서버 오류 → 잠시 대기 후 재시도
          if (attempt < retries - 1) {
            await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
          } else {
            break; // 재시도 소진 → 다음 모델
          }
        } else {
          // 404(모델 미지원), 400(잘못된 요청), 기타 모든 에러 → 다음 모델로
          break;
        }
      }
    }
  }
  throw lastError;
}

export async function analyzeExperience(content, keyExperienceCount = 3) {
  // content가 비었는지 검증
  const entries = Object.entries(content).filter(([, val]) => val && String(val).trim().length > 0);
  if (entries.length === 0) {
    throw new Error('분석할 경험 내용이 비어있습니다. 내용을 먼저 작성해주세요.');
  }

  // 내용이 너무 길면 Gemini 토큰 한도 초과 방지를 위해 각 필드 3000자 제한
  const contentText = entries
    .map(([key, val]) => `[${key}]: ${String(val).substring(0, 3000)}`)
    .join('\n');

  // 사용자가 선택한 경험 수를 상한으로, 실제 자료에서 뽑을 수 있는 만큼만 추출
  const maxCount = Math.min(Math.max(Number(keyExperienceCount) || 3, 1), 10);

  const prompt = `당신은 포트폴리오 전문 커리어 코치입니다. 아래 경험/프로젝트 자료를 분석하여 포트폴리오에 바로 사용할 수 있는 형태로 구조화해주세요.

## 절대 원칙:
1. 오직 입력된 자료에 실제로 언급된 내용만 사용하세요. 자료에 없는 내용은 절대 만들지 마세요.
2. 자료에 해당 정보가 없으면 "[작성 필요] 질문" 형식으로 남겨두세요. (예: "[작성 필요] 개선 전 수치가 있나요?")
3. 수치·성과가 자료에 언급된 경우에만 그대로 사용하세요. 추정·창작 금지.
4. 수치가 없는 경험이라도 유의미하면 포함하되, metric/beforeMetric/afterMetric은 "[작성 필요] 관련 수치나 성과를 적어주세요"로 남기세요.

## keyExperiences 선정 기준 — 아래 5가지 유형 우선 선정:
자료에서 아래 유형에 해당하는 경험을 우선적으로 keyExperiences로 선정하세요.
가치 없는 경험(단순 수행, 역할 불명확, 성과 없음)은 keyExperiences에서 제외하세요.

유형1 - 성공형 [가설→실행→정량성과]
  ✅ 좋음: "CTR 15% 상승 등 수치로 증명되는 성과"
  ❌ 나쁨: "열심히 해서 잘 됐다" (논리 없는 자기자랑)

유형2 - 실패/트러블슈팅형 [실패원인→수습→교훈(Lesson Learned)]
  ✅ 좋음: "N+1 문제 발견→인덱스 재설계→로딩 3초→0.5초"
  ❌ 나쁨: "야심 차게 했는데 아쉬웠다" (반성 없는 실패)

유형3 - 의사결정/중단형 [비효율 데이터→드랍/피벗→리소스 절감]
  ✅ 좋음: "CAC>LTV 데이터로 경영진 설득, 프로젝트 조기 종료로 3개월 리소스 절감"
  ❌ 나쁨: "회사 사정으로 중단됐다" (수동적 종료)

유형4 - 개선/자동화형 [비효율 발견→개선→시간/비용 절감]
  ✅ 좋음: "CS 문의 40% 자동화로 팀 주 10시간 확보"
  ❌ 나쁨: "성실하게 반복 업무 처리" (개선 없는 유지)

유형5 - 협업/기여분리형 [팀목표→나의 구체적 기여]
  ✅ 좋음: "팀 매출 1억 중 내 담당 캠페인이 2천만 원 견인"
  ❌ 나쁨: "팀이 함께 대상을 받았다" (개인 기여 불명확)

심화1 - 무에서 유 창조형 [혼란 상황→기준 수립→자산화]
  트리거 키워드: "처음 만들었다", "체계가 없었다", "사수가 없어서" → 가이드라인/표준 수립 능력으로 재프레이밍.
  누락 데이터 질문: "어떤 외부 레퍼런스나 데이터를 기준으로 초기 가설을 세웠나요?", "이후 팀 작업 시간이 얼마나 단축됐나요?"

심화2 - 극한 자원 부족형 [제약→우선순위→ROI 극대화]
  트리거 키워드: "예산이 없었다", "시간이 촉박했다", "개발자가 퇴사해서" → 우선순위 도출과 최적화 역량으로 재프레이밍.
  누락 데이터 질문: "어떤 기능을 포기하고 어디에 올인했나요?", "투입 대비 최소 결과물 수치는?"

심화3 - 사일로 타파형 [KPI 충돌→데이터 설득→협업 성사]
  트리거 키워드: "개발팀이 안 해준다고 했다", "타 부서와 의견 충돌" → 데이터 기반 협상력으로 재프레이밍.
  누락 데이터 질문: "상대 부서가 반대한 진짜 이유는?", "설득에 사용한 객관적 데이터는?"

심화4 - 외부 요인 피벗형 [요구사항 붕괴→애자일 대응→데드라인 준수]
  트리거 키워드: "갑자기 바꾸라고 했다", "마감 직전에 기획이 엎어졌다" → 애자일 대응력과 리스크 매니지먼트로 재프레이밍.
  누락 데이터 질문: "기존 산출물 중 재활용한 부분은?", "새로 발생한 리스크를 어떻게 통제했나요?"

심화5 - 트래픽 제로형 [가설 수립→기술적 깊이→인사이트 도출]
  트리거 키워드: "출시는 안 했다", "스터디로 만들었다", "실제 사용자는 없다" → 기술적 깊이와 가설 검증 치밀함으로 재프레이밍.
  누락 데이터 질문: "가장 깊게 파고든 기술적 최적화 문제는?", "가상으로 측정하려 했던 핵심 지표는?"

## 경험 내용:
${contentText}

## 응답 구조:

### 1. projectOverview (프로젝트 개요)
- summary: 자료에서 읽히는 한 줄 설명 (없으면 "[작성 필요] 프로젝트를 한 문장으로 설명해주세요")
- background: 자료에서 파악된 배경·문제 (없으면 "[작성 필요] 프로젝트 배경과 해결하려 한 문제를 적어주세요")
- goal: 자료에서 파악된 목표 (없으면 "[작성 필요] 이 프로젝트의 목표는 무엇이었나요?")
- role: 자료에서 파악된 본인 역할 (없으면 "[작성 필요] 본인의 역할·담당 업무를 적어주세요")
- team: 자료에서 파악된 팀 구성 (없으면 "")
- duration: 자료에서 파악된 기간 (없으면 "")
- techStack: 자료에서 언급된 기술 스택 배열 (없으면 [])

### 2. keyExperiences (핵심 경험) — 반드시 ${maxCount}개
- 입력 자료 중 "=== AI 추출 핵심 경험 ===" 섹션에 [경험 1]~[경험 N]으로 명시된 것이 있으면, 각각을 하나의 keyExperience로 변환하세요. 빠짐없이 모두 포함.
- 해당 섹션이 없으면 자료에서 직접 ${maxCount}개를 추출하세요.
- 빈 필드는 "[작성 필요] ..." 힌트로 채우고, 경험 자체를 누락하지 마세요.
- 각 경험 형식:
  - title: 자료에서 읽히는 한 줄 제목. 수치가 있으면 포함, 없으면 행동 중심으로.
  - metric: 자료에 수치가 있으면 기재 (예: "12%↓"), 없으면 "[작성 필요] 핵심 성과 수치를 적어주세요"
  - metricLabel: 수치 설명 (없으면 "[작성 필요] 수치가 의미하는 바를 적어주세요")
  - beforeMetric: 자료에 개선 전 수치가 있으면 기재, 없으면 "[작성 필요] 개선 전 상태/수치는?"
  - afterMetric: 자료에 개선 후 수치가 있으면 기재, 없으면 "[작성 필요] 개선 후 결과/수치는?"
  - situation: 자료에서 파악된 상황·문제 (없으면 "[작성 필요] 어떤 상황이었나요?")
  - action: 자료에서 파악된 본인 행동 (없으면 "[작성 필요] 구체적으로 무엇을 하셨나요?")
  - result: 자료에서 파악된 결과 (없으면 "[작성 필요] 어떤 결과를 얻었나요?")
  - keywords: 자료에서 드러나는 역량 키워드 1~2개

### 3. 7가지 구조화 섹션
- intro, overview, task, process, output, growth, competency
- 각 섹션도 자료에서 파악되는 내용만 작성. 없는 부분은 "[작성 필요] ..." 형태로 유도

### 4. 추가 분석
- keywords: 자료에서 드러나는 핵심 역량 키워드 배열
- followUpQuestions: 자료에서 빠진 정보를 채우기 위한 구체적인 질문 3~5개. 위 심화 유형에서 해당하는 "누락 데이터 질문"을 우선 활용할 것. (예: 심화1에 해당하면 "이후 팀 작업 시간이 얼마나 단축됐나요?" 등을 포함)
- highlights: 자료 원문에서 역량이 드러나는 문장 배열

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON만):
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
}`;

  const text = await generateWithRetry(prompt);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 응답 파싱 실패');
  }
  return JSON.parse(jsonMatch[0]);
}

// 텍스트에서 핵심 경험 순간 10개 추출 (검토 단계용)
export async function extractMoments(rawText, title) {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error('분석할 텍스트가 비어있습니다');
  }

  const prompt = `당신은 포트폴리오 전문 커리어 코치입니다. 아래 자료에서 포트폴리오에 가치 있는 핵심 경험을 추출해주세요.

프로젝트명: ${title || '(미상)'}

## 포트폴리오 가치 있는 경험 유형 (판단 기준):
아래 5가지 유형 중 하나에 해당하면 포트폴리오 경험으로 가치가 있습니다.

유형1 - 성공형: 가설 수립 → 실행/검증 → 정량적 성과. 운이 아닌 논리로 성공했음을 보여주는 경험.
유형2 - 실패/트러블슈팅형: 실패 원인 분석 → 트러블슈팅 → 교훈. 문제를 직면하고 해결한 경험. (성공만 한 사람보다 문제를 해결한 사람이 더 매력적)
유형3 - 의사결정/중단형: 비효율·실현 불가를 데이터로 판단 → 조기 드랍/피벗 → 리소스 절감. 출시 못 했어도 논리적 의사결정이 있으면 가치 있음.
유형4 - 개선/자동화형: 반복·비효율 업무 발견 → 프로세스 개선·자동화 → 시간·비용 절감.
유형5 - 협업/기여도 분리형: 팀 전체 목표 → 나의 구체적 기여 파트를 명확히 드러내는 경험.

심화1 - 무에서 유 창조형: 사수 없음, 체계 없음, 처음 만든 상황 → 외부 레퍼런스/데이터 기반 기준 수립 → 프로세스 자산화 및 시간 단축 성과. (트리거: "처음 만들었다", "체계가 없었다", "사수가 없어서 혼자 했다")
심화2 - 극한 자원 부족형: 예산/시간/인력 부족 → 핵심 지표 달성을 위한 우선순위 도출 및 대체재 발굴 → 투입 대비 ROI 극대화. (트리거: "돈이 없었다", "시간이 촉박했다", "개발자가 퇴사해서")
심화3 - 사일로 타파형: 부서 간 KPI 충돌 → 객관적 데이터 기반 타협점 제시 → 협업 성사 및 딜레이 방어. (트리거: "개발팀이 안 해준다고 했다", "타 부서 의견 충돌", "설득했다")
심화4 - 외부 요인 피벗형: 요구사항 급변 → 기존 산출물 재활용 및 애자일 대응 → 데드라인 준수. (트리거: "갑자기 바꾸라고 했다", "마감 직전에 기획이 엎어졌다")
심화5 - 트래픽 제로형: 사이드/토이 프로젝트 → 기술적 깊이 또는 가설 검증의 치밀함 → 측정 가능한 인사이트 도출. (트리거: "출시는 안 했다", "우리끼리 스터디로 만들었다", "실제 사용자는 없다")

## 제외 기준 (포트폴리오 가치 낮음):
- "열심히 했다", "성실하게 임했다" 수준의 서술만 있고 행동/결과가 없는 것
- 본인의 역할이나 구체적 행동이 전혀 드러나지 않는 것
- 팀 성과만 있고 개인 기여를 분리할 수 없는 것

## 절대 원칙:
- 자료에 실제로 언급된 내용만 사용. 없는 내용 창작 금지.
- 경험이 불완전해도 유형에 해당하면 추출하고, 빠진 정보는 description에 "(미확인: 구체적 수치가 있나요?)" 형태로 표시.

## 원본 자료:
${rawText.substring(0, 8000)}

## 지시:
위 자료에서 포트폴리오 가치가 있는 경험을 최대 10개 추출하세요.
- 각 경험이 위 유형1~5 또는 심화1~5 중 어디에 해당하는지 판단하여 type 필드에 기재 (예: "유형2", "심화1")
- 자료에 없는 정보는 description에 "(미확인: 질문)" 형태로 표시
- 중복·유사한 것은 합쳐서 정리
- 포트폴리오 가치가 높은 순으로 정렬

반드시 아래 JSON 형식으로만 응답하세요:
{
  "moments": [
    {
      "id": "1",
      "type": "유형1",
      "title": "경험 제목 (15자 이내, 결과/행동 중심)",
      "description": "Situation→Action→Result 구조로 작성. 자료에 없는 부분은 (미확인: 질문) 형태로 표시.",
      "keywords": ["키워드1", "키워드2"]
    }
  ]
}`;

  const responseText = await generateWithRetry(prompt);
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답 파싱 실패');
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.moments || [];
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

/**
 * 포트폴리오 섹션별 기업/직무 요건 매칭 분석
 */
export async function matchSectionsToRequirements(sections, targetCompany, targetPosition) {
  const sectionsText = sections.map((s, i) => {
    const content = s.content
      ? s.content.substring(0, 500)
      : (s.projectTechStack ? `기술스택: ${s.projectTechStack.join(', ')}` : '(내용 없음)');
    return `[섹션 ${i}: "${s.title}" (타입: ${s.type})]\n${content}`;
  }).join('\n\n');

  const prompt = `당신은 취업 포트폴리오 전문 컨설턴트입니다.
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

  try {
    const text = await generateWithRetry(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('파싱 실패');
    return JSON.parse(jsonMatch[0]);
  } catch {
    // 폴백: 모든 섹션을 기본 매칭으로 처리
    return sections.map((s, i) => ({
      index: i,
      matched: s.type !== 'custom' && !!(s.content || s.projectTechStack),
      relevance: 'medium',
      reason: '자동 분석 실패 - 수동 검토 권장',
    }));
  }
}
