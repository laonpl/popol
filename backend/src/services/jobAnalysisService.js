import { generateWithRetry, callProFirst, callProFirstWithSearch, parseJSON } from './geminiService.js';
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
  // URL은 job.js의 validateJobUrl()에서 이미 검증됨
  // 로그에 URL 경로를 직접 출력하지 않음 (민감 정보 마스킹)
  let maskedHost;
  try { maskedHost = new URL(url).hostname; } catch { maskedHost = '[unknown]'; }

  try {
    const text = await fetchJobWithHttp(url);
    console.log('[Job] HTTP 스크래핑 성공:', maskedHost, '길이:', text.length);
    return text;
  } catch (httpErr) {
    console.log('[Job] HTTP 스크래핑 실패, Puppeteer로 폴백:', maskedHost, httpErr.code || httpErr.message);
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
6. 산업 트렌드: 해당 기업이 속한 산업의 핵심 트렌드를 5개 이상 상세히 분석. 각 트렌드마다 trend(제목), description(2~3문장의 상세 설명), impact(해당 직무에 미치는 구체적 영향), keywords(관련 키워드 3~5개 배열), level(hot/growing/stable 중 하나), opportunity(해당 트렌드로 인한 기회), threat(주의해야 할 위험 요소)를 모두 작성하세요.
7. 강조 표시: 모든 분석 결과 텍스트 중에서 포트폴리오나 자소서 작성 시 '치트키'가 될 만한 핵심 문구나 키워드는 반드시 <u>강조할내용</u> 태그로 감싸서 응답하세요. (예: <u>업계 1위의 시장 점유율</u>을 기반으로 한...)

반드시 아래 JSON 형식으로만 응답 (마크다운 없이, JSON 값 안에 **, ##, * 등 마크다운 기호 금지, <u> 태그만 허용):
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
  "industryTrends": [{ "trend": "", "description": "", "impact": "", "keywords": [], "level": "growing", "opportunity": "", "threat": "" }],
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

  const raw = await callProFirst(prompt, 'AnalyzeJobPosting', { callTimeoutMs: 180000 });
  const parsed = parseJSON(raw);
  return enrichPortfolioRequirements(parsed, text);
}

// ── 경험-요구사항 매칭 ─────────────────────────────────
export async function analyzeJobPostingFromUrl(url, context = '') {
  const prompt = `채용시장 전문 분석가입니다. 아래 채용공고 URL과 보조 정보를 바탕으로 실제 공고 내용을 찾아 분석해 구조화된 JSON으로 추출하세요.
검색 가능한 공개 정보와 채용공고 페이지의 제목/본문/기업 정보를 우선 활용하세요. 페이지 접근이 제한되면 URL, 기업명, 모집분야, 공개 채용 정보 기반으로 보수적으로 분석하세요.

채용공고 URL:
${url}

보조 정보:
${context || '(없음)'}

분석 지침:
1. company, position, deadline은 URL/공고/보조 정보에서 확인되는 값을 우선 사용하세요.
2. 공고에 명시된 주요업무, 필수요건, 우대요건, 기술스택, 제출서류를 최대한 구체적으로 추출하세요.
3. 공고 원문을 확인하기 어려운 항목은 지어내지 말고 공개 기업 정보와 직무 관행을 기준으로 보수적으로 작성하세요.
4. portfolioRequirements는 required/format/content/submission 항목별로 작성하세요.
5. 산업 트렌드는 해당 기업과 직무 맥락에 맞게 3개 이상 작성하세요.
6. 포트폴리오나 자소서 작성 시 중요한 핵심 문구는 <u>강조 태그</u>를 사용할 수 있습니다.

반드시 아래 JSON 형식으로만 응답:
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
  "industryTrends": [{ "trend": "", "description": "", "impact": "", "keywords": [], "level": "growing", "opportunity": "", "threat": "" }],
  "fitScoreFactors": [
    { "factor": "기술 스택 일치도", "maxScore": 30, "description": "" },
    { "factor": "직무 경험 관련성", "maxScore": 25, "description": "" },
    { "factor": "인재상 부합도", "maxScore": 20, "description": "" },
    { "factor": "성장 잠재력", "maxScore": 15, "description": "" },
    { "factor": "문화 적합도", "maxScore": 10, "description": "" }
  ],
  "portfolioRequirements": {
    "required": [],
    "format": [],
    "content": [],
    "submission": ""
  }
}`;

  const sourceText = [url, context].filter(Boolean).join('\n');
  try {
    const raw = await callProFirstWithSearch(prompt, 'AnalyzeJobPostingFromUrl');
    const parsed = parseJSON(raw);
    return {
      ...enrichPortfolioRequirements(parsed, sourceText),
      _sourceType: 'url-search',
    };
  } catch (err) {
    console.warn('[AnalyzeJobPostingFromUrl] URL 검색 분석 실패, 기본 분석으로 대체:', err.message);
    let hostname = '';
    try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    return buildFallbackJobAnalysis({
      company: hostname || '지원 기업',
      position: '채용공고',
      deadline: '',
      sourceType: 'url-search-fallback',
    });
  }
}

export async function analyzeJobFromDetails({ company, position, deadline }) {
  const normalizedCompany = String(company || '').trim();
  const normalizedPosition = String(position || '').trim();
  const normalizedDeadline = String(deadline || '').trim();
  const syntheticPosting = [
    `기업명: ${normalizedCompany}`,
    `모집분야: ${normalizedPosition}`,
    `지원서 접수 기간: ${normalizedDeadline || '미정'}`,
  ].join('\n');

  const prompt = `채용시장 전문 분석가입니다. 사용자는 채용공고 링크 대신 아래 기본 정보만 입력했습니다.
입력 정보만으로도 포트폴리오 작성에 바로 도움이 되도록 기업/직무 분석을 구조화된 JSON으로 작성하세요.

입력 정보:
${syntheticPosting}

중요 지침:
1. company, position, deadline은 입력값 기준으로 정확히 채우세요.
2. 실제 공고 원문이 없으므로 업무 내용, 요구 역량, 지원 전략은 해당 기업과 모집분야의 일반적인 공개 정보와 채용 관행을 바탕으로 현실적으로 추정하세요.
3. 확인하기 어려운 숫자나 사실은 과장하지 말고, 불확실하면 null 또는 보수적인 서술로 처리하세요.
4. portfolioRequirements는 이 기업/직무 지원자가 준비하면 좋은 포트폴리오 기준으로 구체적으로 작성하세요.
5. 산업 트렌드, 직무 역량, 지원 전략은 포트폴리오 문구에 바로 활용할 수 있을 만큼 실무적으로 작성하세요.
6. 특히 강조할 문구나 키워드는 <u>강조 태그</u>를 사용할 수 있습니다.

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 금지):
{
  "company": "${normalizedCompany}",
  "position": "${normalizedPosition}",
  "tasks": [],
  "requirements": { "essential": [], "preferred": [] },
  "skills": [],
  "skillImportance": [{ "skill": "", "weight": 8, "reason": "" }],
  "applicationFormat": {
    "documents": [],
    "questions": [{ "question": "", "maxLength": 500 }],
    "fileConstraints": { "maxSize": null, "format": null }
  },
  "deadline": "${normalizedDeadline}",
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
  "industryTrends": [{ "trend": "", "description": "", "impact": "", "keywords": [], "level": "growing", "opportunity": "", "threat": "" }],
  "fitScoreFactors": [
    { "factor": "기술 스택 일치도", "maxScore": 30, "description": "" },
    { "factor": "직무 경험 관련성", "maxScore": 25, "description": "" },
    { "factor": "인재상 부합도", "maxScore": 20, "description": "" },
    { "factor": "성장 잠재력", "maxScore": 15, "description": "" },
    { "factor": "문화 적합도", "maxScore": 10, "description": "" }
  ],
  "portfolioRequirements": {
    "required": [],
    "format": [],
    "content": [],
    "submission": ""
  }
}`;

  let enriched;
  try {
    const raw = await callProFirst(prompt, 'AnalyzeJobFromDetails');
    const parsed = parseJSON(raw);
    enriched = enrichPortfolioRequirements(parsed, syntheticPosting);
  } catch (err) {
    console.warn('[AnalyzeJobFromDetails] AI 분석 실패, 기본 분석으로 대체:', err.message);
    enriched = buildFallbackJobAnalysis({
      company: normalizedCompany,
      position: normalizedPosition,
      deadline: normalizedDeadline,
      sourceType: 'manual-entry-fallback',
    });
  }

  return {
    ...enriched,
    company: enriched.company || normalizedCompany,
    position: enriched.position || normalizedPosition,
    deadline: enriched.deadline || normalizedDeadline || null,
    _sourceType: 'manual-entry',
  };
}

function buildFallbackJobAnalysis({ company, position, deadline, sourceType = 'manual-entry' }) {
  const isDevRole = /(개발|엔지니어|프로그래|백엔드|프론트|풀스택|devops|데이터|AI|ML)/i.test(position);
  const isDesignRole = /(디자인|designer|ux|ui|브랜드|콘텐츠)/i.test(position);
  const skills = isDevRole
    ? ['문제 해결', '협업', '기술 문서화', '성능 개선']
    : isDesignRole
      ? ['사용자 이해', '문제 정의', '시각화', '협업']
      : ['문제 해결', '커뮤니케이션', '데이터 기반 의사결정', '협업'];
  const portfolioContent = isDevRole
    ? ['주요 프로젝트 2~3개', '본인 기여 범위와 사용 기술', '성과 지표와 개선 결과', 'GitHub 또는 배포 링크']
    : isDesignRole
      ? ['대표 프로젝트 2~3개', '문제 정의와 리서치 과정', '프로토타입과 결과물', '성과 또는 사용자 피드백']
      : ['직무 관련 프로젝트 또는 활동', '본인 역할과 의사결정 과정', '정량/정성 성과', '지원 직무와의 연결점'];

  return {
    company,
    position,
    tasks: [`${position} 직무와 관련된 핵심 업무 수행`, '부서 및 이해관계자와 협업', '성과 개선을 위한 실행 계획 수립'],
    requirements: {
      essential: skills.slice(0, 3).map(skill => `${skill} 역량`),
      preferred: ['지원 기업/산업에 대한 이해', '관련 프로젝트 경험'],
    },
    skills,
    skillImportance: skills.map((skill, index) => ({ skill, weight: Math.max(6, 9 - index), reason: `${position} 직무 수행에 필요한 기본 역량입니다.` })),
    applicationFormat: {
      documents: ['지원서', '포트폴리오'],
      questions: [],
      fileConstraints: { maxSize: null, format: 'PDF 권장' },
    },
    deadline: deadline || null,
    workConditions: {
      salary: null,
      estimatedSalaryRange: { min: null, max: null, unit: '만원/연봉', basis: '공고 원문 확인 필요' },
      benefits: [],
      location: null,
    },
    coreValues: ['주도성', '협업', '성장 가능성'],
    companyAnalysis: {
      overview: `${company} 지원을 위한 기본 분석입니다. 실제 공고 원문이 없거나 AI 분석이 실패해, 입력한 기업명과 모집분야를 기준으로 보수적으로 정리했습니다.`,
      industry: '',
      businessAreas: [],
      recentTrends: `${company}의 최근 제품, 서비스, 채용 페이지를 확인해 포트폴리오의 문제 정의와 성과 표현을 맞추는 것이 좋습니다.`,
      culture: '공개된 인재상과 채용 안내를 기준으로 협업 방식, 주도성, 성장 가능성을 강조하세요.',
      strengths: [`${company}와 ${position}의 연결점을 포트폴리오 첫 화면에서 명확히 보여줄 수 있습니다.`],
      weaknesses: ['공고 세부 요건이 부족하면 세부 기술 스택과 평가 기준을 놓칠 수 있습니다.'],
      competitors: [],
      companySize: { employees: '', revenue: '', founded: '' },
      homepage: null,
    },
    positionAnalysis: {
      roleDescription: `${position} 직무는 지원 기업의 문제를 실제 결과물로 해결한 경험을 보여주는 것이 중요합니다.`,
      growthPath: '입사 후에는 직무 전문성을 기반으로 프로젝트 리딩과 문제 해결 범위를 넓히는 방향을 제시하세요.',
      keyCompetencies: skills.map((skill, index) => ({ name: skill, weight: Math.max(6, 9 - index), description: `${position} 포트폴리오에서 사례로 증명하면 좋은 역량입니다.` })),
      dailyTasks: `${position} 관련 실행, 협업, 결과 분석 업무가 중심이 될 가능성이 높습니다.`,
      challengeLevel: { score: 7, description: '기업과 직무에 맞는 실무 사례를 구체적으로 제시해야 경쟁력이 생깁니다.' },
    },
    applicationStrategy: {
      motivationPoints: [{ point: `${company}의 서비스/사업 방향과 본인 경험을 연결`, how: '지원동기 첫 문단에서 기업명과 직무 문제를 직접 언급하세요.' }],
      passingStrategy: [{ strategy: '핵심 프로젝트 전면 배치', description: `${position}와 가장 가까운 프로젝트를 앞쪽에 배치하세요.` }],
      appealPoints: skills.slice(0, 3),
      cautionPoints: ['기업명만 바꾼 일반 포트폴리오처럼 보이지 않도록 구체적 연결 문장을 넣으세요.'],
      portfolioTips: portfolioContent,
    },
    industryTrends: [
      { trend: 'AI 기반 업무 생산성', description: '대부분의 직무에서 AI 도구 활용과 자동화 이해가 중요해지고 있습니다.', impact: `${position} 업무에서도 반복 작업 효율화와 데이터 기반 판단을 어필할 수 있습니다.`, keywords: ['AI', '자동화', '생산성'], level: 'growing', opportunity: '도구 활용 경험을 구체적으로 제시하면 차별화됩니다.', threat: '도구 이름만 나열하면 실무 역량으로 보이지 않을 수 있습니다.' },
      { trend: '성과 중심 포트폴리오', description: '채용 과정에서 결과물뿐 아니라 문제 해결 과정과 성과 지표를 함께 봅니다.', impact: '프로젝트의 목표, 역할, 결과를 수치와 함께 정리해야 합니다.', keywords: ['성과', '문제해결', '임팩트'], level: 'stable', opportunity: '정량 지표가 있으면 설득력이 커집니다.', threat: '과장된 수치는 신뢰를 떨어뜨릴 수 있습니다.' },
    ],
    fitScoreFactors: [
      { factor: '직무 경험 관련성', maxScore: 30, description: `${position}와 직접 연결되는 경험 비중` },
      { factor: '기업 이해도', maxScore: 25, description: `${company}의 사업과 인재상 반영 수준` },
      { factor: '성과 증명력', maxScore: 25, description: '결과물과 수치 기반 성과 제시 수준' },
      { factor: '협업/커뮤니케이션', maxScore: 20, description: '팀 내 역할과 의사결정 과정 설명 수준' },
    ],
    portfolioRequirements: {
      required: ['포트폴리오 또는 주요 업무 결과물'],
      format: ['PDF 형식 권장', '링크 제출 가능 여부는 공고 확인 필요'],
      content: portfolioContent,
      submission: '채용 플랫폼의 지원 절차에 따라 제출',
    },
    _sourceType: sourceType,
    _analysisWarning: 'AI 상세 분석에 실패해 기본 분석으로 대체했습니다.',
  };
}

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
특히 recommendedExperiences에는 이 기업에 가장 핵심적인 경험 2~3개만 남기고, 각 경험의 역할(tailoredRole)과 설명(tailoredDescription)을 해당 기업의 요구사항과 직접적으로 연관지어 재작성하세요.

JSON 형식으로만 응답:
{
  "headline": "기업맞춤 추천 헤드라인",
  "recommendedExperiences": [
    {
      "title": "경험 제목", 
      "reason": "추천 이유", 
      "priority": 1,
      "tailoredRole": "해당 기업/직무에 맞게 재작성된 핵심 역할 (예: 데이터 파이프라인 설계 및 최적화)",
      "tailoredDescription": "해당 기업의 비즈니스나 요구사항과 강력하게 연관지어 재작성된 핵심 성과 및 설명 (2~3줄 분량)"
    }
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

  // 기존 핵심 경험 슬라이드 목록 (AI가 이 중에서 선별)
  const existingKeyExps = (sr.keyExperiences || []).map((ke, i) => ({
    slideIndex: i,
    title: ke.title || '',
    metric: ke.metric || '',
    metricLabel: ke.metricLabel || '',
    beforeMetric: ke.beforeMetric || '',
    afterMetric: ke.afterMetric || '',
    chartType: ke.chartType || 'horizontalBar',
    situation: ke.situation || '',
    action: ke.action || '',
    result: ke.result || '',
  }));
  const keyExpsText = existingKeyExps.length > 0
    ? existingKeyExps.map(ke =>
        `[슬라이드 ${ke.slideIndex}] 제목: ${ke.title}\n` +
        (ke.metricLabel ? `지표명: ${ke.metricLabel}\n` : '') +
        (ke.metric ? `지표값: ${ke.metric}\n` : '') +
        (ke.beforeMetric ? `개선 전: ${ke.beforeMetric}\n` : '') +
        (ke.afterMetric ? `개선 후: ${ke.afterMetric}\n` : '') +
        (ke.situation ? `문제상황: ${ke.situation}\n` : '') +
        (ke.action ? `행동: ${ke.action}\n` : '') +
        (ke.result ? `성과: ${ke.result}\n` : '')
      ).join('\n')
    : '(핵심 경험 슬라이드 없음)';

  const prompt = `당신은 취업 컨설턴트입니다.
사용자의 실제 경험 내용을 그대로 보존하면서, 해당 경험이 지원 기업/직무와 어떻게 연결되는지를 보여주는 방식으로 포트폴리오를 작성합니다.

[핵심 원칙]
- 원본 내용(사실, 수치, 기술명, 과정, 결과)은 절대 변경하지 마세요.
- 내용을 '새로 쓰는 것'이 아니라, 원본을 그대로 가져가면서 기업 맥락에서 어떤 의미가 있는지를 연결해주는 것입니다.
- 없는 내용을 만들거나 과장하지 마세요.
- JSON 값 안에 마크다운 기호(**, ##, *, -) 사용 금지.

기업: ${jobAnalysis.company || ''} | 직무: ${jobAnalysis.position || ''}
스킬: ${(jobAnalysis.skills || []).join(', ')} | 인재상: ${(jobAnalysis.coreValues || []).join(', ')}
주요업무: ${(jobAnalysis.tasks || []).slice(0, 4).join(', ')}

===== 원본 경험 =====
제목: ${experience.title || ''} | 역할: ${experience.role || ''} | 스킬: ${(experience.skills || []).join(', ')}
설명: ${(experience.description || '').substring(0, 400)}
${content.substring(0, 800)}

===== 7개 섹션 원본 내용 (sections 작업 시 이 내용을 그대로 유지하세요) =====
${(sectionTexts || '(없음)').substring(0, 2500)}

===== 핵심 경험 슬라이드 목록 (keyExperiences 작업 시 이 중에서만 선별하세요) =====
${keyExpsText.substring(0, 2000)}

JSON으로만 응답:
{
  "sections": {
    "intro": { "content": "원본 내용 보존 + 필요시 기업 연관 맥락 1문장 추가", "reason": "이 섹션이 기업에 연관되는 이유" },
    "overview": { "content": "", "reason": "" },
    "task": { "content": "", "reason": "" },
    "process": { "content": "", "reason": "" },
    "output": { "content": "", "reason": "" },
    "growth": { "content": "", "reason": "" },
    "competency": { "content": "", "reason": "" }
  },
  "keyExperiences": [
    {
      "slideIndex": 0,
      "title": "슬라이드의 원본 제목 그대로",
      "metric": "슬라이드의 원본 지표값 그대로",
      "metricLabel": "슬라이드의 원본 지표명 그대로",
      "beforeMetric": "슬라이드의 원본 개선 전 그대로",
      "afterMetric": "슬라이드의 원본 개선 후 그대로",
      "chartType": "슬라이드의 원본 chartType 그대로",
      "situation": "슬라이드의 원본 문제상황 그대로 (변형 없이)",
      "action": "슬라이드의 원본 행동 그대로 (변형 없이)",
      "result": "슬라이드의 원본 성과 그대로 (변형 없이)",
      "relevance": "이 슬라이드가 [기업명]의 [직무]에 연관되는 이유 (여기서만 기업 연결 해설 작성)"
    }
  ],
  "highlightedSkills": [],
  "relevanceNote": ""
}

요청:
1. sections: 원본 내용을 그대로 유지하면서, 기업과 연관 있는 섹션에만 연관 맥락 1문장을 자연스럽게 추가하세요. 원본 없는 섹션은 빈 문자열.
2. keyExperiences: 위 핵심 경험 슬라이드 목록에서 이 기업/직무와 연관성 높은 슬라이드를 1~3개 선별하세요.
   - slideIndex는 반드시 위 슬라이드 목록의 번호를 그대로 사용
   - situation, action, result는 원본 텍스트 그대로 (또는 거의 그대로) 발췌
   - relevance 필드에만 기업과의 연결 해설을 작성
   - 슬라이드 목록이 비어있으면 keyExperiences는 빈 배열로 응답
   - 원본에 없는 내용은 어떤 필드에도 작성 금지
3. 연관성이 높을수록 더 많이 포함 (최대 3개), 관련이 낮으면 1개만.`;

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

