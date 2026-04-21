import { generateWithRetry, callProFirst, parseJSON } from './geminiService.js';
import {
  buildSingleSectionTailorPrompt,
  buildSingleCoverLetterAnswerPrompt,
} from '../prompts/portfolioPrompts.js';

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

// ── HTTP 기반 스크래핑 (빠름, Chrome 불필요) ─────────
async function fetchJobWithHttp(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#[0-9]+;/g, ' ').replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ').trim()
      .substring(0, 15000);
    if (text.length < 300) throw new Error('CONTENT_TOO_SHORT');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ── 채용공고 스크래핑 (Puppeteer 동시 인스턴스 제한) ──────
const MAX_PUPPETEER = 2;   // 동시 최대 2개 브라우저 (메모리 보호)
let puppeteerActive = 0;
const puppeteerQueue = [];

function acquirePuppeteer(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (puppeteerActive < MAX_PUPPETEER) {
      puppeteerActive++;
      return resolve();
    }
    const entry = { resolve, reject, timer: null };
    entry.timer = setTimeout(() => {
      const idx = puppeteerQueue.indexOf(entry);
      if (idx !== -1) puppeteerQueue.splice(idx, 1);
      reject(new Error('PUPPETEER_QUEUE_TIMEOUT'));
    }, timeoutMs);
    puppeteerQueue.push(entry);
  });
}

function releasePuppeteer() {
  if (puppeteerQueue.length > 0) {
    const next = puppeteerQueue.shift();
    clearTimeout(next.timer);
    next.resolve();
  } else {
    puppeteerActive--;
  }
}

export async function scrapeJobPosting(url) {
  try {
    const text = await fetchJobWithHttp(url);
    console.log('[Job] HTTP 스크래핑 성공, 길이:', text.length);
    return text;
  } catch (httpErr) {
    console.log('[Job] HTTP 스크래핑 실패, Puppeteer로 폴백:', httpErr.message);
  }

  // Puppeteer 동시 인스턴스 제한
  try {
    await acquirePuppeteer();
  } catch {
    throw new Error('스크래핑 서버가 혼잡합니다. 직접 텍스트를 붙여넣어주세요.');
  }

  const SCRAPE_TIMEOUT_MS = 45000;
  let browser;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--single-process',
        '--disable-extensions',
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const scrapeWithTimeout = Promise.race([
      (async () => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
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
    console.error('[Job] Puppeteer 스크래핑 실패:', err.message);
    if (err.message === 'SCRAPE_TIMEOUT') {
      throw new Error('채용공고 페이지 로딩 시간이 초과됐습니다. 직접 텍스트를 붙여넣어주세요.');
    }
    throw new Error('채용공고 페이지를 불러올 수 없습니다. URL을 확인하거나 직접 텍스트를 붙여넣어주세요.');
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) { browser.process()?.kill('SIGKILL'); }
    }
    releasePuppeteer();
  }
}

// ── 채용공고 분석 (Gemini) ─────────────────────────────
export async function analyzeJobPosting(text) {
  const prompt = `채용시장 전문 분석가입니다. 아래 채용공고를 분석해 구조화된 JSON으로 추출하세요.
기업명이 식별되면 공개 정보(사업보고서·IR·뉴스)를 기반으로 풍부하게 작성하세요.

채용공고:
${text.substring(0, 8000)}

분석 지침:
1. 기업 분석: 매출·직원수·설립연도·경쟁사 포지셔닝·최근 M&A/투자 동향 포함
2. 직무 적합도: 각 요구사항 중요도(weight 1~10) 부여
3. 급여 추정: 직급·경력·업종 기반 시장 급여 범위
4. 합격 전략: 직무 및 기업 특성을 반영한 핵심 합격 전략 (면접 예상 질문 제외)
5. 포트폴리오 요건: required/format/content/submission 항목별 세밀하게 추출 (명시 없으면 직무 관행 기반 가이드 작성)

반드시 아래 JSON 형식으로만 응답 (마크다운 없이, JSON 값 안에 **, ##, * 등 마크다운 기호 금지):
{
  "company": "",
  "position": "",
  "tasks": [],
  "requirements": { "essential": [], "preferred": [] },
  "skills": [],
  "skillImportance": [{ "skill": "", "weight": 8, "reason": "" }],
  "applicationFormat": {
    "documents": [],
    "questions": [{ "question": "", "maxLength": 500 }],
    "fileConstraints": { "maxSize": null, "format": null }
  },
  "deadline": null,
  "workConditions": {
    "salary": null,
    "estimatedSalaryRange": { "min": 3500, "max": 5000, "unit": "만원/연봉", "basis": "" },
    "benefits": [],
    "location": null
  },
  "coreValues": [],
  "companyAnalysis": {
    "overview": "",
    "industry": "",
    "businessAreas": [],
    "recentTrends": "",
    "culture": "",
    "strengths": [],
    "weaknesses": [],
    "competitors": [{ "name": "", "comparison": "" }],
    "companySize": { "employees": "", "revenue": "", "founded": "" },
    "homepage": null
  },
  "positionAnalysis": {
    "roleDescription": "",
    "growthPath": "",
    "keyCompetencies": [{ "name": "", "weight": 8, "description": "" }],
    "dailyTasks": "",
    "challengeLevel": { "score": 7, "description": "" }
  },
  "applicationStrategy": {
    "motivationPoints": [{ "point": "", "how": "" }],
    "passingStrategy": [{ "strategy": "", "description": "" }],
    "appealPoints": [],
    "cautionPoints": [],
    "portfolioTips": []
  },
  "industryTrends": [{ "trend": "", "description": "", "impact": "" }],
  "fitScoreFactors": [
    { "factor": "기술 스택 일치도", "maxScore": 30, "description": "" },
    { "factor": "직무 경험 관련성", "maxScore": 25, "description": "" },
    { "factor": "인재상 부합도", "maxScore": 20, "description": "" },
    { "factor": "성장 잠재력", "maxScore": 15, "description": "" },
    { "factor": "문화 적합성", "maxScore": 10, "description": "" }
  ],
  "portfolioRequirements": {
    "required": [],
    "format": [],
    "content": [],
    "submission": ""
  }
}`;

  const raw = await callProFirst(prompt, 'AnalyzeJobPosting');
  const parsed = parseJSON(raw);
  return enrichPortfolioRequirements(parsed, text);
}

// ── 경험-요구사항 매칭 ─────────────────────────────────
export async function matchExperiencesToJob(jobAnalysis, experiences, portfolio) {
  const expSummaries = experiences.slice(0, 6).map((exp, i) => {
    const content = exp.content
      ? Object.entries(exp.content).map(([k, v]) => `${k}: ${String(v).substring(0, 150)}`).join('\n')
      : '';
    return `[경험 ${i + 1}: ${exp.title}]
설명: ${(exp.description || '').substring(0, 200)}
역할: ${exp.role || ''} | 스킬: ${(exp.skills || []).join(', ')} | 키워드: ${(exp.keywords || []).join(', ')}
${content}`.substring(0, 600);
  }).join('\n\n');

  const portfolioSummary = portfolio
    ? `스킬: ${JSON.stringify(portfolio.skills || {})} | 학력: ${(portfolio.education || []).map(e => e.school).join(', ')} | 목표: ${(portfolio.goals || []).slice(0, 2).join(', ')}`
    : '포트폴리오 없음';

  const jobSummary = `기업: ${jobAnalysis.company} | 직무: ${jobAnalysis.position}
필수요건: ${(jobAnalysis.requirements?.essential || []).slice(0, 5).join(', ')}
우대요건: ${(jobAnalysis.requirements?.preferred || []).slice(0, 3).join(', ')}
요구스킬: ${(jobAnalysis.skills || []).join(', ')}
인재상: ${(jobAnalysis.coreValues || []).join(', ')}`;

  const prompt = `취업 컨설턴트입니다. 채용공고 요구사항과 사용자 경험/포트폴리오를 매칭하세요.

채용공고:
${jobSummary}

사용자 경험:
${expSummaries || '등록된 경험 없음'}

사용자 포트폴리오:
${portfolioSummary}

요청:
1. 각 필수/우대 요건에 가장 부합하는 경험 매칭
2. 강점/약점 분석
3. 면접·자소서에서 강조할 포인트 추천
4. 부족한 부분 보완 전략

반드시 아래 JSON으로만 응답 (마크다운 없이):
{
  "matchResults": [
    {
      "requirement": "",
      "type": "essential",
      "matchedExperiences": [{ "experienceIndex": 0, "title": "", "relevance": "높음", "reason": "" }],
      "coverageScore": 80
    }
  ],
  "strengths": [],
  "weaknesses": [],
  "emphasisPoints": [],
  "improvementStrategy": [],
  "overallFitScore": 75
}`;

  const raw = await callProFirst(prompt, 'MatchExperiences');
  return parseJSON(raw);
}

// ── 맞춤형 자소서 생성 (문항별 병렬 호출) ─────────────────────────────────
export async function generateTailoredCoverLetter(jobAnalysis, matchResult, experiences, portfolio) {
  const rawQuestions = jobAnalysis.applicationFormat?.questions || [];

  // 문항이 없으면 일반 3문항으로 대체
  const questions = rawQuestions.length > 0
    ? rawQuestions
    : [
        { question: '지원 동기', maxLength: 500 },
        { question: '직무 관련 경험', maxLength: 500 },
        { question: '입사 후 포부', maxLength: 500 },
      ];

  const expText = experiences.slice(0, 5).map((exp, i) => {
    const content = exp.content
      ? Object.entries(exp.content).map(([k, v]) => `${k}: ${String(v).substring(0, 150)}`).join('\n')
      : '';
    const sr = exp.structuredResult || {};
    const srText = ['task', 'process', 'output', 'growth'].filter(k => sr[k]?.trim()).map(k => sr[k]).join(' ').substring(0, 300);
    return `[${exp.title}] ${(exp.description || '').substring(0, 200)}\n${content}\n${srText}`.substring(0, 600);
  }).join('\n\n');

  console.log(`[CoverLetter] 병렬 호출 시작: 문항 ${questions.length}개`);
  const t0 = Date.now();

  // 문항별 독립 프롬프트로 분할 → Promise.all 병렬 실행
  const answerResults = await Promise.all(
    questions.map(async (q, i) => {
      const questionText = typeof q === 'string' ? q : q.question;
      const maxLength = typeof q === 'object' ? (q.maxLength || 500) : 500;
      const prompt = buildSingleCoverLetterAnswerPrompt(questionText, maxLength, expText, jobAnalysis);
      try {
        const raw = await callProFirst(prompt, `CoverLetter[Q${i + 1}/${questions.length}]`);
        const parsed = parseJSON(raw, /\{[\s\S]*\}/);
        return {
          question: questionText,
          answer: parsed.answer || '',
          wordCount: (parsed.answer || '').length,
          maxWordCount: maxLength,
          usedExperiences: parsed.usedExperiences || [],
          highlightedValues: parsed.highlightedValues || [],
        };
      } catch (err) {
        console.warn(`[CoverLetter[Q${i + 1}]] 실패:`, err.message);
        return { question: questionText, answer: '', wordCount: 0, maxWordCount: maxLength, usedExperiences: [], highlightedValues: [] };
      }
    })
  );

  console.log(`[CoverLetter] 병렬 완료: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  return {
    answers: answerResults,
    tips: [
      `${jobAnalysis.company || '해당 기업'}의 인재상(${(jobAnalysis.coreValues || []).slice(0, 2).join(', ')})에 맞는 키워드를 자연스럽게 녹여주세요.`,
      '구체적인 수치와 성과를 포함하면 신뢰도가 높아집니다.',
    ],
  };
}

// ── 맞춤형 포트폴리오 제안 ─────────────────────────────
export async function generateTailoredPortfolio(jobAnalysis, matchResult, experiences, portfolio) {
  const jobKey = `기업: ${jobAnalysis.company} | 직무: ${jobAnalysis.position}
스킬: ${(jobAnalysis.skills || []).join(', ')} | 인재상: ${(jobAnalysis.coreValues || []).join(', ')}`;

  const matchKey = `강점: ${(matchResult.strengths || []).join(', ')}
약점: ${(matchResult.weaknesses || []).join(', ')} | 적합도: ${matchResult.overallFitScore || '?'}점`;

  const portfolioKey = portfolio
    ? `헤드라인: ${portfolio.headline || ''} | 스킬: ${JSON.stringify(portfolio.skills || {}).substring(0, 200)}`
    : '포트폴리오 없음';

  const prompt = `포트폴리오 컨설턴트입니다. 기업 맞춤형 포트폴리오 구성을 제안하세요.

기업 정보:
${jobKey}

매칭 결과:
${matchKey}

현재 포트폴리오: ${portfolioKey}

경험 목록:
${experiences.slice(0, 8).map((e, i) => `${i + 1}. ${e.title} [스킬: ${(e.skills || []).join(', ')}]`).join('\n')}

요청: 기업에 맞게 강조할 항목, 순서 변경, 추가할 내용 제안.

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

  const raw = await callProFirst(prompt, 'GenerateTailoredPortfolio');
  return parseJSON(raw);
}

// ── 경험 내용을 기업에 맞게 재작성 ─────────────────────
export async function tailorExperienceContent(jobAnalysis, experience) {
  const content = experience.content
    ? Object.entries(experience.content).map(([k, v]) => `${k}: ${v}`).join('\n')
    : '';
  const sections = (experience.sections || []).map(s => `${s.title}: ${s.content}`).join('\n');

  // structuredResult에서 7개 섹션 내용 추출
  const sr = experience.structuredResult || {};
  const sectionKeys = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];
  const sectionLabels = {
    intro: '프로젝트 소개', overview: '프로젝트 개요', task: '진행한 일',
    process: '과정', output: '결과물', growth: '성장한 점', competency: '나의 역량'
  };
  const sectionTexts = sectionKeys
    .filter(k => sr[k]?.trim())
    .map(k => `[${sectionLabels[k]}]\n${sr[k]}`)
    .join('\n\n');

  const prompt = `취업 컨설턴트입니다. 사용자 경험을 지원 기업/직무에 최적화되도록 7개 섹션별로 재작성하세요.
원본 사실을 유지하되 기업이 원하는 역량·가치를 강조하도록 표현 조정. 원본 없는 섹션은 빈 문자열.
JSON 값 안에 마크다운 기호(**, ##, *, -) 절대 사용 금지.

기업: ${jobAnalysis.company || ''} | 직무: ${jobAnalysis.position || ''}
스킬: ${(jobAnalysis.skills || []).join(', ')} | 인재상: ${(jobAnalysis.coreValues || []).join(', ')}
주요업무: ${(jobAnalysis.tasks || []).slice(0, 4).join(', ')}

원본 경험:
제목: ${experience.title || ''} | 역할: ${experience.role || ''} | 스킬: ${(experience.skills || []).join(', ')}
설명: ${(experience.description || '').substring(0, 300)}
${content.substring(0, 800)}

7개 섹션 원본:
${(sectionTexts || '(없음)').substring(0, 2000)}

JSON으로만 응답:
{
  "sections": {
    "intro": { "content": "", "reason": "" },
    "overview": { "content": "", "reason": "" },
    "task": { "content": "", "reason": "" },
    "process": { "content": "", "reason": "" },
    "output": { "content": "", "reason": "" },
    "growth": { "content": "", "reason": "" },
    "competency": { "content": "", "reason": "" }
  },
  "highlightedSkills": [],
  "relevanceNote": ""
}`;

  const raw = await callProFirst(prompt, 'TailorExperienceContent');
  return parseJSON(raw);
}

// ── 포트폴리오 전체 섹션을 기업 맞춤형으로 재작성 (섹션별 병렬 호출) ───────
export async function tailorPortfolioSections(jobAnalysis, sections) {
  console.log(`[TailorPortfolio] 병렬 호출 시작: 섹션 ${sections.length}개`);
  const t0 = Date.now();

  // 섹션별 독립 프롬프트로 분할 → Promise.all 병렬 실행
  const sectionResults = await Promise.all(
    sections.map(async (section, i) => {
      const prompt = buildSingleSectionTailorPrompt(section, i, jobAnalysis);
      try {
        const raw = await callProFirst(prompt, `TailorSection[${i}/${sections.length}]`);
        const parsed = parseJSON(raw, /\{[\s\S]*\}/);
        return {
          index: i,
          tailoredContent: parsed.tailoredContent || section.content || '',
          changeReason: parsed.changeReason || '',
          changed: parsed.changed !== false && !!(parsed.tailoredContent),
        };
      } catch (err) {
        console.warn(`[TailorSection[${i}]] 실패, 원본 유지:`, err.message);
        return {
          index: i,
          tailoredContent: section.content || '',
          changeReason: '맞춤화 실패 — 원본 유지',
          changed: false,
        };
      }
    })
  );

  console.log(`[TailorPortfolio] 병렬 완료: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  return {
    sections: sectionResults,
    overallNote: `${jobAnalysis.company || '기업'} ${jobAnalysis.position || '직무'} 맞춤형으로 ${sectionResults.filter(s => s.changed).length}개 섹션이 수정되었습니다.`,
  };
}

