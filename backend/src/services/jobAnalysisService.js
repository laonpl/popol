import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

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
        if ([429, 503, 500].includes(status)) {
          if (attempt < retries - 1) {
            const wait = delayMs * Math.pow(2, attempt);
            console.warn(`[Job] ${modelName} ${status} - 재시도 ${attempt + 1} (${wait}ms)`);
            await new Promise(r => setTimeout(r, wait));
          } else break;
        } else if ([404, 400].includes(status)) {
          break;
        } else throw err;
      }
    }
  }
  throw lastError;
}

// ── 채용공고 스크래핑 ──────────────────────────────────
export async function scrapeJobPosting(url) {
  // puppeteer로 JS 렌더링 후 텍스트 추출
  let browser;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // 불필요한 요소 제거 후 텍스트 추출
    const text = await page.evaluate(() => {
      ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript'].forEach(tag => {
        document.querySelectorAll(tag).forEach(el => el.remove());
      });
      return document.body.innerText.substring(0, 15000); // 15k자 제한
    });
    return text;
  } catch (err) {
    console.error('[Job] 스크래핑 실패:', err.message);
    throw new Error('채용공고 페이지를 불러올 수 없습니다. URL을 확인하거나 직접 텍스트를 붙여넣어주세요.');
  } finally {
    if (browser) await browser.close();
  }
}

// ── 채용공고 분석 (Gemini) ─────────────────────────────
export async function analyzeJobPosting(text) {
  const prompt = `당신은 한국 채용시장 전문 분석가이자 기업분석 전문가입니다. 아래 채용공고 텍스트를 분석해서 구조화된 JSON으로 추출하세요.
채용공고 텍스트에 없더라도 해당 기업에 대한 공개적으로 알려진 정보(사업 내용, 산업 트렌드, 기업 문화 등)를 기반으로 가능한 풍부하게 작성하세요.

## 채용공고 텍스트:
${text.substring(0, 12000)}

## 추출 및 분석 항목:
1. 기본 채용 정보 (기업명, 직무, 업무, 요건, 스킬, 서류형식, 마감일, 근무조건, 인재상)
2. **기업 분석**: 기업 소개, 주요 사업 내용, 산업 분야, 최근 동향/성장세, 기업 문화/가치
3. **직무 분석**: 해당 직무가 기업에서 어떤 역할인지, 성장 가능성, 필요 역량 상세
4. **지원 전략**: 지원동기 포인트, 면접 예상 질문, 어필 포인트
5. **산업 트렌드**: 해당 산업의 최신 동향, 기술 트렌드

텍스트에 없는 정보는 기업명이 식별되면 공개 정보 기반으로 추론하세요. 그래도 모르면 null. 반드시 아래 JSON 형식으로만 응답 (마크다운 없이):
{
  "company": "기업명",
  "position": "직무/포지션",
  "tasks": ["주요업무1", "주요업무2"],
  "requirements": {
    "essential": ["필수요건1", "필수요건2"],
    "preferred": ["우대요건1", "우대요건2"]
  },
  "skills": ["스킬1", "스킬2"],
  "applicationFormat": {
    "documents": ["이력서", "자기소개서"],
    "questions": [
      {"question": "자소서 문항 텍스트", "maxLength": 500}
    ],
    "fileConstraints": {"maxSize": null, "format": null}
  },
  "deadline": "마감일 텍스트 또는 null",
  "workConditions": {
    "salary": "급여 정보 또는 null",
    "benefits": ["복리후생1"],
    "location": "근무지 또는 null"
  },
  "coreValues": ["인재상 키워드1", "인재상 키워드2"],
  "companyAnalysis": {
    "overview": "기업 소개 및 현황 (3-5문장)",
    "industry": "산업 분야",
    "businessAreas": ["주요 사업 영역1", "주요 사업 영역2"],
    "recentTrends": "최근 동향/성장세 (2-3문장)",
    "culture": "기업 문화/특징 (2-3문장)",
    "strengths": ["기업 강점1", "기업 강점2"],
    "homepage": "홈페이지 URL 또는 null"
  },
  "positionAnalysis": {
    "roleDescription": "이 직무가 기업 내에서 담당하는 역할 상세 설명 (3-5문장)",
    "growthPath": "커리어 성장 가능성 및 경로",
    "keyCompetencies": ["핵심역량1", "핵심역량2", "핵심역량3"],
    "dailyTasks": "실제 일상 업무 예상 설명"
  },
  "applicationStrategy": {
    "motivationPoints": ["지원동기에 녹일 포인트1", "포인트2"],
    "interviewQuestions": ["면접 예상 질문1", "예상 질문2", "예상 질문3"],
    "appealPoints": ["어필 포인트1", "어필 포인트2"],
    "cautionPoints": ["주의할 점1"]
  },
  "industryTrends": ["산업 트렌드1", "트렌드2", "트렌드3"]
}`;

  const raw = await generateWithRetry(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('채용공고 분석 결과 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

// ── 경험-요구사항 매칭 ─────────────────────────────────
export async function matchExperiencesToJob(jobAnalysis, experiences, portfolio) {
  const expSummaries = experiences.map((exp, i) => {
    const content = exp.content
      ? Object.entries(exp.content).map(([k, v]) => `${k}: ${v}`).join('\n')
      : '';
    const sections = (exp.sections || []).map(s => `${s.title}: ${s.content}`).join('\n');
    return `[경험 ${i + 1}: ${exp.title}]
설명: ${exp.description || ''}
역할: ${exp.role || ''}
스킬: ${(exp.skills || []).join(', ')}
키워드: ${(exp.keywords || []).join(', ')}
분류: ${(exp.classify || []).join(', ')}
${content}
${sections}`;
  }).join('\n\n');

  const portfolioSummary = portfolio ? `
스킬: ${JSON.stringify(portfolio.skills || {})}
학력: ${JSON.stringify(portfolio.education || [])}
수상: ${JSON.stringify(portfolio.awards || [])}
목표: ${JSON.stringify(portfolio.goals || [])}
가치관: ${portfolio.valuesEssay || ''}` : '포트폴리오 없음';

  const prompt = `당신은 취업 컨설턴트입니다. 채용공고 요구사항과 사용자의 경험/포트폴리오를 매칭해주세요.

## 채용공고 분석:
${JSON.stringify(jobAnalysis, null, 2)}

## 사용자 경험:
${expSummaries || '등록된 경험 없음'}

## 사용자 포트폴리오:
${portfolioSummary}

## 요청:
1. 각 필수/우대 요건에 대해 가장 부합하는 경험을 매칭하세요
2. 사용자의 강점과 약점을 분석하세요
3. 면접/자소서에서 강조할 포인트를 추천하세요
4. 부족한 부분에 대한 보완 전략을 제시하세요

반드시 아래 JSON으로만 응답 (마크다운 없이):
{
  "matchResults": [
    {
      "requirement": "요구사항 텍스트",
      "type": "essential 또는 preferred",
      "matchedExperiences": [
        {"experienceIndex": 0, "title": "경험 제목", "relevance": "높음/보통/낮음", "reason": "매칭 이유"}
      ],
      "coverageScore": 80
    }
  ],
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "emphasisPoints": ["강조포인트1", "강조포인트2"],
  "improvementStrategy": ["보완전략1", "보완전략2"],
  "overallFitScore": 75
}`;

  const raw = await generateWithRetry(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('매칭 분석 실패');
  return JSON.parse(jsonMatch[0]);
}

// ── 맞춤형 자소서 생성 ─────────────────────────────────
export async function generateTailoredCoverLetter(jobAnalysis, matchResult, experiences, portfolio) {
  const questions = jobAnalysis.applicationFormat?.questions || [];
  const coreValues = jobAnalysis.coreValues || [];

  const expTextMap = {};
  experiences.forEach((exp, i) => {
    const content = exp.content
      ? Object.entries(exp.content).map(([k, v]) => `${k}: ${v}`).join('\n')
      : '';
    const sections = (exp.sections || []).map(s => `${s.title}: ${s.content}`).join('\n');
    expTextMap[i] = `[${exp.title}] ${exp.description || ''}\n${content}\n${sections}`;
  });

  // 문항이 있으면 문항별, 없으면 일반 자소서 구조
  const questionsPrompt = questions.length > 0
    ? questions.map((q, i) =>
      `### 문항 ${i + 1}: ${q.question}\n글자수 제한: ${q.maxLength || '제한없음'}자`
    ).join('\n\n')
    : `### 일반 자소서 구조로 작성:
1. 지원 동기 (500자)
2. 성장 과정 또는 직무 관련 경험 (500자)
3. 입사 후 포부 (500자)`;

  const prompt = `당신은 대한민국 최고의 자소서 컨설턴트입니다. 기업 맞춤형 자기소개서를 작성하세요.

## 기업 정보:
- 기업: ${jobAnalysis.company}
- 직무: ${jobAnalysis.position}
- 인재상: ${coreValues.join(', ') || '정보 없음'}
- 요구 스킬: ${(jobAnalysis.skills || []).join(', ')}

## 자소서 문항:
${questionsPrompt}

## 매칭 분석:
- 강점: ${(matchResult.strengths || []).join(', ')}
- 강조 포인트: ${(matchResult.emphasisPoints || []).join(', ')}

## 활용 가능한 경험:
${Object.values(expTextMap).join('\n\n') || '등록된 경험 없음'}

## 작성 지침:
- 각 문항에 대해 기업의 인재상과 직무 요구사항에 맞춰 작성
- 글자수 제한이 있으면 반드시 준수
- 구체적인 수치와 사례를 포함
- STAR 구조를 자연스럽게 활용
- 기업의 핵심가치/인재상 키워드를 자연스럽게 반영
- 자연스러운 한국어 톤

반드시 아래 JSON 형식으로만 응답:
{
  "answers": [
    {
      "question": "문항 텍스트",
      "answer": "작성된 답변",
      "wordCount": 487,
      "maxWordCount": 500,
      "usedExperiences": ["경험1 제목"],
      "highlightedValues": ["반영된 인재상 키워드"]
    }
  ],
  "tips": ["팁1", "팁2"]
}`;

  const raw = await generateWithRetry(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('자소서 생성 실패');
  return JSON.parse(jsonMatch[0]);
}

// ── 맞춤형 포트폴리오 제안 ─────────────────────────────
export async function generateTailoredPortfolio(jobAnalysis, matchResult, experiences, portfolio) {
  const prompt = `당신은 포트폴리오 컨설턴트입니다. 기업 맞춤형 포트폴리오 구성을 제안하세요.

## 기업 분석:
${JSON.stringify(jobAnalysis, null, 2)}

## 매칭 결과:
${JSON.stringify(matchResult, null, 2)}

## 현재 포트폴리오:
${JSON.stringify(portfolio, null, 2)}

## 현재 경험 목록:
${experiences.map((e, i) => `${i + 1}. ${e.title} - ${e.description || ''} [스킬: ${(e.skills || []).join(',')}]`).join('\n')}

## 요청:
기업에 맞게 포트폴리오에서 강조할 항목, 순서 변경, 추가할 내용을 제안하세요.

JSON 형식으로만 응답:
{
  "headline": "기업맞춤 추천 헤드라인",
  "recommendedExperiences": [
    {"title": "경험 제목", "reason": "추천 이유", "priority": 1}
  ],
  "skillsToHighlight": ["강조할 스킬1", "강조할 스킬2"],
  "sections": [
    {"section": "섹션명", "action": "강조/수정/추가", "suggestion": "구체적 제안"}
  ],
  "overallAdvice": "전체적인 포트폴리오 조정 조언"
}`;

  const raw = await generateWithRetry(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('포트폴리오 제안 생성 실패');
  return JSON.parse(jsonMatch[0]);
}

// ── 경험 내용을 기업에 맞게 재작성 ─────────────────────
export async function tailorExperienceContent(jobAnalysis, experience) {
  const content = experience.content
    ? Object.entries(experience.content).map(([k, v]) => `${k}: ${v}`).join('\n')
    : '';
  const sections = (experience.sections || []).map(s => `${s.title}: ${s.content}`).join('\n');

  const prompt = `당신은 취업 컨설턴트입니다. 사용자의 프로젝트/경험을 지원 기업과 직무에 최적화되도록 재작성해주세요.
원래 내용의 사실을 유지하되, 기업이 원하는 역량과 가치를 강조하도록 표현을 조정하세요.

## 지원 기업 정보:
- 기업: ${jobAnalysis.company || ''}
- 직무: ${jobAnalysis.position || ''}
- 요구 스킬: ${(jobAnalysis.skills || []).join(', ')}
- 인재상: ${(jobAnalysis.coreValues || []).join(', ')}
- 주요 업무: ${(jobAnalysis.tasks || []).join(', ')}

## 원본 경험:
- 제목: ${experience.title || ''}
- 설명: ${experience.description || ''}
- 역할: ${experience.role || ''}
- 스킬: ${(experience.skills || []).join(', ')}
${content}
${sections}

## 재작성 요청:
1. 경험 설명을 기업이 원하는 역량을 부각하도록 재작성
2. 프로젝트 제목은 유지하되, 기업에 어필하는 부제/한줄소개 추가
3. 이 경험에서 기업이 관심 가질 성과/수치를 강조

JSON으로만 응답:
{
  "tailoredDescription": "기업 맞춤 재작성된 경험 설명",
  "subtitle": "기업 어필용 한줄 소개",
  "highlightedSkills": ["이 경험에서 기업에 어필할 스킬"],
  "keyAchievements": ["강조할 성과1", "성과2"],
  "relevanceNote": "이 경험이 해당 기업/직무에 왜 적합한지 설명"
}`;

  const raw = await generateWithRetry(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('경험 맞춤화 실패');
  return JSON.parse(jsonMatch[0]);
}
