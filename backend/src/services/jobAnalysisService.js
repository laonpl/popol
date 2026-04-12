import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];

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
        if (status === 429) {
          // Rate limit / quota 소진 → 다음 모델로 즉시 전환
          console.warn(`[Job] ${modelName} 429 - 다음 모델로 폴백`);
          break;
        } else if ([503, 500].includes(status)) {
          if (attempt < retries - 1) {
            const wait = delayMs * Math.pow(2, attempt);
            console.warn(`[Job] ${modelName} ${status} - 재시도 ${attempt + 1} (${wait}ms)`);
            await new Promise(r => setTimeout(r, wait));
          } else break;
        } else if ([404, 400].includes(status)) {
          break; // 해당 모델 미지원 → 다음 모델
        } else throw err;
      }
    }
  }
  throw lastError;
}

export { generateWithRetry };

function toCleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
}

function extractPortfolioHintLines(text = '') {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const hints = [];

  // 파일 형식
  const formatLine = lines.find(l => /(pdf|hwp|doc|ppt|zip|png|jpg|파일\s*형식|형식\s*제한)/i.test(l));
  if (formatLine) hints.push(formatLine.substring(0, 80));

  // 용량 제한
  const sizeLine = lines.find(l => /(mb|kb|용량|파일\s*크기|\d+\s*mb)/i.test(l));
  if (sizeLine) hints.push(sizeLine.substring(0, 80));

  // 페이지 제한
  const pageLine = lines.find(l => /(페이지|\d+\s*p|장\s*이내|\d+장)/i.test(l));
  if (pageLine) hints.push(pageLine.substring(0, 80));

  // GitHub/Notion/링크
  const linkLine = lines.find(l => /(github|gitlab|notion|behance|링크|url|http)/i.test(l));
  if (linkLine) hints.push(linkLine.substring(0, 80));

  // 포트폴리오 필수 여부
  const reqLine = lines.find(l => /(포트폴리오.*필수|필수.*포트폴리오|반드시.*제출)/i.test(l));
  if (reqLine) hints.push(reqLine.substring(0, 80));

  return [...new Set(hints)].filter(Boolean).slice(0, 5);
}

function enrichPortfolioRequirements(analysis, postingText = '') {
  const current = analysis?.portfolioRequirements || {};
  const required = toCleanList(current.required);
  const format = toCleanList(current.format);
  const content = toCleanList(current.content);
  let submission = typeof current.submission === 'string' ? current.submission.trim() : '';

  const docs = toCleanList(analysis?.applicationFormat?.documents);
  const fileConstraints = analysis?.applicationFormat?.fileConstraints || {};
  const portfolioTips = toCleanList(analysis?.applicationStrategy?.portfolioTips);
  const hintLines = extractPortfolioHintLines(postingText);

  // 채용공고에서 추출된 포트폴리오 요건이 너무 부실하거나 샘플 텍스트 그대로인 경우 보강
  const isBarelyFilled =
    required.length + format.length + content.length < 2 ||
    required.some(r => r.includes('예:') || r.includes('서류1') || r.includes('서류2'));

  if (isBarelyFilled) {
    // required 보강
    if (docs.length > 0) {
      const portfolioDocs = docs.filter(d => /(포트폴리오|portfolio|github|링크|url)/i.test(d));
      if (portfolioDocs.length > 0) {
        portfolioDocs.forEach(d => { if (!required.includes(d)) required.push(d); });
      } else {
        const existing = docs.join(', ');
        if (!required.some(r => r.includes(existing.substring(0, 10)))) {
          required.push(`제출 서류: ${existing}`);
        }
      }
    }
    if (required.length === 0) {
      // 직무 기반 기본 가이드
      const isDevRole = /(개발|엔지니어|프로그래|백엔드|프론트|풀스택|devops|devOps)/i.test(
        (analysis?.position || '') + (analysis?.skills || []).join('')
      );
      const isDesignRole = /(디자인|designer|ux|ui|브랜드)/i.test(analysis?.position || '');
      if (isDevRole) {
        required.push('PDF 포트폴리오 또는 GitHub 프로필 링크');
      } else if (isDesignRole) {
        required.push('PDF 포트폴리오 필수');
        required.push('Behance / 개인 사이트 링크 (선택)');
      } else {
        required.push('포트폴리오 또는 업무 결과물 파일');
      }
    }

    // format 보강
    if (format.length === 0) {
      if (fileConstraints.format) format.push(`허용 형식: ${fileConstraints.format}`);
      if (fileConstraints.maxSize) format.push(`최대 파일 크기: ${fileConstraints.maxSize}`);
      // 힌트라인에서 형식 관련 추출
      hintLines.forEach(h => {
        if (/(pdf|mb|kb|페이지|\d+p\b|파일\s*크기|용량)/i.test(h) && !format.includes(h)) {
          format.push(h);
        }
      });
      if (format.length === 0) {
        format.push('PDF 형식 권장 (링크 제출 가능한 경우 URL 기재)');
        format.push('파일 크기 10MB 이하 권장');
      }
    }

    // content 보강
    if (content.length === 0 && portfolioTips.length > 0) {
      content.push(...portfolioTips.slice(0, 5));
    }
    if (content.length === 0) {
      content.push('본인이 참여한 주요 프로젝트 2~3개 이상');
      content.push('각 프로젝트의 본인 기여 범위 및 역할 명시');
      content.push('사용 기술 스택 목록 기재');
      content.push('정량적 성과 또는 결과 포함 (가능한 경우 수치 제시)');
    }
  }

  if (!submission) {
    // 힌트라인에서 제출 방법 추출
    const subHint = hintLines.find(h => /(이메일|첨부|플랫폼|지원|제출)/i.test(h));
    if (subHint) {
      submission = subHint;
    } else if (docs.length > 0) {
      submission = '지원서 파일 첨부란 또는 링크 입력란에 기재';
    } else {
      submission = '채용 플랫폼의 지원 절차에 따라 제출';
    }
  }

  return {
    ...analysis,
    portfolioRequirements: {
      required: [...new Set(required)].filter(Boolean),
      format: [...new Set(format)].filter(Boolean),
      content: [...new Set(content)].filter(Boolean),
      submission,
    },
  };
}

// ── 채용공고 스크래핑 ──────────────────────────────────
export async function scrapeJobPosting(url) {
  const SCRAPE_TIMEOUT_MS = 45000;
  let browser;

  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 전체 스크래핑에 타임아웃 래퍼
    const scrapeWithTimeout = Promise.race([
      (async () => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        // 추가 렌더링 대기 (짧게)
        await new Promise(r => setTimeout(r, 2000));
        const text = await page.evaluate(() => {
          ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript'].forEach(tag => {
            document.querySelectorAll(tag).forEach(el => el.remove());
          });
          return document.body.innerText.substring(0, 15000);
        });
        return text;
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SCRAPE_TIMEOUT')), SCRAPE_TIMEOUT_MS)
      ),
    ]);

    return await scrapeWithTimeout;
  } catch (err) {
    console.error('[Job] 스크래핑 실패:', err.message);
    if (err.message === 'SCRAPE_TIMEOUT') {
      throw new Error('채용공고 페이지 로딩 시간이 초과됐습니다. 직접 텍스트를 붙여넣어주세요.');
    }
    throw new Error('채용공고 페이지를 불러올 수 없습니다. URL을 확인하거나 직접 텍스트를 붙여넣어주세요.');
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { browser.process()?.kill('SIGKILL'); }
    }
  }
}

// ── 채용공고 분석 (Gemini) ─────────────────────────────
export async function analyzeJobPosting(text) {
  const prompt = `당신은 한국 최고의 채용시장 전문 분석가이자 기업 리서치 전문가입니다. TIO Korea 수준의 상세 기업 분석을 수행하세요.
아래 채용공고 텍스트를 분석해서 구조화된 JSON으로 추출하되, 채용공고에 없는 정보라도 기업명이 식별되면 공개된 사업보고서, IR 자료, 뉴스, Glassdoor/크레딧잡 등의 정보를 기반으로 최대한 풍부하게 작성하세요.

## 채용공고 텍스트:
${text.substring(0, 14000)}

## 분석 지침:
1. **기업 분석**: 단순 소개가 아니라 투자자 관점의 사업 분석 수준으로. 매출 규모, 직원 수, 설립연도, 경쟁사 대비 포지셔닝, 최근 M&A/투자/신사업 동향을 포함
2. **직무 적합도 스코어**: 각 요구사항에 대해 중요도(weight) 점수를 1-10으로 부여하고, 해당 직무의 기여 가치를 정량적으로 표현
3. **경쟁력 분석**: 이 기업의 동종 업계 대비 강점/약점을 SWOT 형태로 분석
4. **급여 수준 추정**: 직급, 경력, 업종 기반으로 시장 급여 범위를 추정
5. **면접 전략**: 예상 질문은 5개 이상, 기업 특성 반영한 답변 포인트도 함께 제시
6. **산업 분석**: 시장 규모, 성장률, 주요 플레이어, 기술 트렌드를 수치와 함께 제시
7. **포트폴리오 요건 추출 (매우 중요)**: 채용공고에서 포트폴리오 관련 조건을 아래 항목별로 세밀하게 추출하세요.
   - **required**: 제출이 필수인 항목 (예: "PDF 포트폴리오 필수", "GitHub 링크 필수", "포트폴리오 URL 첨부 필수" 등)
   - **format**: 파일/제출 형식 조건 (예: "PDF만 허용", "10MB 이하", "A4 10페이지 이내", "링크(Notion/GitHub/개인사이트) 허용", "파일명: 이름_포지션" 등)
   - **content**: 포트폴리오에 꼭 담아야 할 내용 (예: "주요 프로젝트 3개 이상", "본인 기여 부분 명시", "사용 기술 스택 기재", "결과/성과 수치화", "UI/UX 결과물 포함" 등)
   - **submission**: 제출 방법/경로/플랫폼 (예: "지원서 파일 첨부", "이메일 별도 첨부", "지원 플랫폼 내 링크 입력란" 등)
   채용공고에 명시되지 않은 경우라도 해당 직무/기업 관행을 기반으로 일반적으로 요구되는 최선의 가이드를 작성하세요.

반드시 아래 JSON 형식으로만 응답 (마크다운 없이):
{
  "company": "기업명",
  "position": "직무/포지션",
  "tasks": ["주요업무1", "주요업무2"],
  "requirements": {
    "essential": ["필수요건1", "필수요건2"],
    "preferred": ["우대요건1", "우대요건2"]
  },
  "skills": ["스킬1", "스킬2"],
  "skillImportance": [
    {"skill": "스킬1", "weight": 9, "reason": "핵심 업무에 필수"},
    {"skill": "스킬2", "weight": 6, "reason": "우대 사항"}
  ],
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
    "estimatedSalaryRange": {"min": 3500, "max": 5000, "unit": "만원/연봉", "basis": "업종·직급·경력 기반 시장 추정"},
    "benefits": ["복리후생1"],
    "location": "근무지 또는 null"
  },
  "coreValues": ["인재상 키워드1", "인재상 키워드2"],
  "companyAnalysis": {
    "overview": "기업 소개 및 현황 - 설립연도, 직원 수, 매출 규모 등 포함 (5-8문장 상세하게)",
    "industry": "산업 분야",
    "businessAreas": ["주요 사업 영역1", "주요 사업 영역2"],
    "recentTrends": "최근 2년 동향 - M&A, 신사업, 투자유치, 실적 변화 등 (3-5문장)",
    "culture": "기업 문화/특징 - 조직 구조, 워라밸, 성장 환경 (3-5문장)",
    "strengths": ["기업 강점1", "기업 강점2"],
    "weaknesses": ["기업 약점/리스크1", "약점2"],
    "competitors": [
      {"name": "경쟁사1", "comparison": "우리 기업 대비 차이점/유사점"}
    ],
    "companySize": {"employees": "직원 수 추정", "revenue": "매출 규모 추정", "founded": "설립연도"},
    "homepage": "홈페이지 URL 또는 null"
  },
  "positionAnalysis": {
    "roleDescription": "이 직무가 기업 내에서 담당하는 역할 상세 설명 (5-8문장)",
    "growthPath": "커리어 성장 가능성 및 경로 (주니어→시니어→리드 등)",
    "keyCompetencies": [
      {"name": "핵심역량1", "weight": 9, "description": "왜 중요한지 설명"},
      {"name": "핵심역량2", "weight": 7, "description": "설명"}
    ],
    "dailyTasks": "실제 일상 업무 예상 설명 (3-5문장)",
    "teamStructure": "예상 팀 구조/규모",
    "challengeLevel": {"score": 7, "description": "난이도와 그 이유"}
  },
  "applicationStrategy": {
    "motivationPoints": [
      {"point": "지원동기 포인트1", "how": "구체적으로 어떻게 녹일지 가이드"},
      {"point": "포인트2", "how": "가이드"}
    ],
    "interviewQuestions": [
      {"question": "면접 예상 질문1", "intent": "면접관의 의도", "answerTip": "답변 전략"},
      {"question": "예상 질문2", "intent": "의도", "answerTip": "전략"}
    ],
    "appealPoints": ["어필 포인트1", "어필 포인트2"],
    "cautionPoints": ["주의할 점1"],
    "portfolioTips": ["포트폴리오에서 강조할 점1", "강조할 점2"]
  },
  "industryTrends": [
    {"trend": "트렌드명", "description": "상세 설명 2-3문장", "impact": "이 직무에 미치는 영향"},
    {"trend": "트렌드2", "description": "설명", "impact": "영향"}
  ],
  "fitScoreFactors": [
    {"factor": "기술 스택 일치도", "maxScore": 30, "description": "요구 스킬과 지원자 보유 스킬 비교"},
    {"factor": "직무 경험 관련성", "maxScore": 25, "description": "관련 프로젝트/경력 존재 여부"},
    {"factor": "인재상 부합도", "maxScore": 20, "description": "기업 핵심가치와의 정합성"},
    {"factor": "성장 잠재력", "maxScore": 15, "description": "학습 능력, 신기술 적응력"},
    {"factor": "문화 적합성", "maxScore": 10, "description": "기업 문화와의 적합도"}
  ],
  "portfolioRequirements": {
    "required": [
      "PDF 포트폴리오 필수 제출 (개발자 직군 관행)",
      "GitHub 프로필 링크 첨부 권장"
    ],
    "format": [
      "PDF 단일 파일 형식 권장",
      "파일 크기 10MB 이하",
      "A4 기준 10페이지 이내"
    ],
    "content": [
      "본인이 개발한 주요 프로젝트 2~3개 이상",
      "각 프로젝트별 사용 기술 스택 명시",
      "본인 기여도/역할 구체적으로 기재",
      "성과 및 결과를 수치로 표현"
    ],
    "submission": "지원서 파일 첨부 또는 링크 입력란에 URL 기재 (채용 플랫폼에 따라 다름)"
  }
}`;

  const raw = await generateWithRetry(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('채용공고 분석 결과 파싱 실패');
  const parsed = JSON.parse(jsonMatch[0]);
  return enrichPortfolioRequirements(parsed, text);
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
