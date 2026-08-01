import { generateWithRetry, callProFirst, callProFirstWithSearch, parseJSON } from './geminiService.js';
import {
  buildSingleSectionTailorPrompt,
  buildSingleCoverLetterAnswerPrompt,
  buildExperienceCompositionPrompt,
  COMPOSABLE_SOURCES,
  ARTIFACT_VARIANTS,
  ARTIFACT_BLOCKS,
  ARTIFACT_TONES,
} from '../prompts/portfolioPrompts.js';

export { generateWithRetry };

function toCleanList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
}

function hasAnyTerm(text = '', terms = []) {
  const source = String(text || '').toLowerCase();
  return terms.some(term => source.includes(String(term).toLowerCase()));
}

function hasAiProviderConfigured() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GITHUB_MODELS_TOKEN
  );
}

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(text = '') {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ');
}

function decodeJsStringLiteral(text = '') {
  try {
    return JSON.parse(`"${String(text || '').replace(/"/g, '\\"')}"`);
  } catch {
    return String(text || '')
      .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/');
  }
}

function extractScriptDataText(html = '') {
  const chunks = [];

  const nextData = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData?.[1]) chunks.push(nextData[1]);

  const nextFlightRe = /self\.__next_f\.push\(\[\d+\s*,\s*"([\s\S]*?)"\]\)<\/script>/gi;
  let flightMatch;
  while ((flightMatch = nextFlightRe.exec(html)) !== null) {
    chunks.push(decodeJsStringLiteral(flightMatch[1]));
  }

  const jsonScriptRe = /<script[^>]+type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch;
  while ((jsonMatch = jsonScriptRe.exec(html)) !== null) {
    chunks.push(jsonMatch[1]);
  }

  return chunks
    .map(chunk => {
      // 문자열을 그대로 넘기면 jsonToReadableText가 원문을 되돌려주기만 해서
      // 광고·배너 키 필터가 적용되지 않는다. 먼저 파싱한 뒤 변환한다.
      try {
        return jsonToReadableText(JSON.parse(chunk)).join('\n');
      } catch {
        return chunk; // JSON이 아니면(예: Next flight 조각) 기존대로 원문 유지
      }
    })
    .map(decodeHtmlEntities)
    .join('\n');
}

function splitSourceSentences(text = '') {
  const normalized = String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/[|•·]/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

  const chunks = normalized
    .split(/(?<=[.!?。]|다\.|요\.|함\.|됨\.|음\.|임\.)\s+|\n+|(?=\s*(?:제출서류|제출 서류|지원방법|지원 방법|전형절차|전형 절차|모집분야|모집 분야|자격요건|자격 요건|우대사항|우대 사항)\s*[:：])/g)
    .map(compactText)
    .filter(v => v.length >= 4 && v.length <= 500);

  if (chunks.length > 0) return chunks;
  return normalized.match(/.{1,260}/g)?.map(compactText).filter(Boolean) || [];
}

function extractPortfolioHintLines(text = '') {
  const lines = splitSourceSentences(text);
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

function extractPortfolioRequirementsFromText(text = '') {
  if (!/(포트폴리오|portfolio)/i.test(text)) {
    return { required: [], format: [], content: [], submission: '' };
  }

  const sentences = splitSourceSentences(text);
  const relevant = sentences.filter(s =>
    /(포트폴리오|portfolio)/i.test(s)
  );

  const required = [];
  const format = [];
  const content = [];
  let submission = '';

  relevant.forEach(sentence => {
    const value = sentence.substring(0, 180);
    if (/(포트폴리오|portfolio|제출\s*서류|제출서류|이력서|자기소개서|자소서|필수|required|document|resume)/i.test(sentence)) {
      required.push(value);
    }
    if (/(pdf|hwp|docx?|pptx?|zip|png|jpe?g|url|링크|github|notion|behance|자유\s*양식|자유양식|파일|형식|용량|mb|kb|페이지|\d+\s*(?:mb|kb|p|page|장))/i.test(sentence)) {
      format.push(value);
    }
    if (/(프로젝트|portfolio|포트폴리오|성과|기여|역할|작업물|산출물|경험|내용|구성)/i.test(sentence)) {
      content.push(value);
    }
    if (!submission && /(제출|첨부|업로드|지원서|지원\s*방법|채용\s*사이트|홈페이지|email|이메일|apply)/i.test(sentence)) {
      submission = value;
    }
  });

  return {
    required: [...new Set(required)].slice(0, 5),
    format: [...new Set(format)].slice(0, 5),
    content: [...new Set(content)].slice(0, 5),
    submission,
  };
}

function enrichPortfolioRequirements(analysis, postingText = '') {
  const current = analysis?.portfolioRequirements || {};
  const required = toCleanList(current.required);
  const format = toCleanList(current.format);
  const content = toCleanList(current.content);
  let submission = typeof current.submission === 'string' ? current.submission.trim() : '';
  const extracted = extractPortfolioRequirementsFromText(postingText);
  const addUnique = (target, values) => {
    values.forEach(value => {
      if (value && !target.includes(value)) target.push(value);
    });
  };
  const removeUnknownPlaceholders = () => {
    if (extracted.required.length > 0) {
      for (let i = required.length - 1; i >= 0; i -= 1) {
        if (/공고 원문 확인 필요|확인하지 못했습니다/.test(required[i])) required.splice(i, 1);
      }
    }
    if (extracted.submission && /공고 원문 확인 필요|확인하지 못했습니다/.test(submission)) {
      submission = '';
    }
  };

  // 공고 원문을 실제로 확보하지 못한 경우(검색 폴백 등)에는 일반론 기본값을 지어내지 않는다.
  // 지어낸 "PDF 권장/페이지 수/프로젝트 2~3개" 등이 실제 공고(예: 자유양식·제출 필수)와 모순되어
  // 사용자를 오도하기 때문이다. AI가 실제로 추출한 값만 남기고, 비면 정직한 안내를 넣는다.
  if (!looksLikeJobPosting(postingText)) {
    addUnique(required, extracted.required);
    addUnique(format, extracted.format);
    addUnique(content, extracted.content);
    removeUnknownPlaceholders();
    if (!submission) submission = extracted.submission;

    return {
      ...analysis,
      portfolioRequirements: {
        required: required.length
          ? required
          : ['공고 원문에서 포트폴리오 제출 요건을 확인하지 못했습니다. 공고를 직접 확인하거나 ‘내용 붙여넣기’로 다시 분석해 주세요.'],
        format,
        content,
        submission: submission || '공고 원문 확인 필요',
      },
    };
  }

  const docs = toCleanList(analysis?.applicationFormat?.documents);
  const fileConstraints = analysis?.applicationFormat?.fileConstraints || {};
  const portfolioTips = toCleanList(analysis?.applicationStrategy?.portfolioTips);
  const hintLines = extractPortfolioHintLines(postingText);

  // 채용공고에서 추출된 포트폴리오 요건이 샘플 텍스트 그대로인 경우만 제거한다.
  // 공고에 없는 PDF/페이지/프로젝트 개수 같은 기본값은 만들지 않는다.
  const isBarelyFilled =
    required.length + format.length + content.length < 2 ||
    required.some(r => r.includes('예:') || r.includes('서류1') || r.includes('서류2'));

  if (isBarelyFilled) {
    if (docs.length > 0 && /(포트폴리오|portfolio)/i.test(postingText)) {
      const portfolioDocs = docs.filter(d => /(포트폴리오|portfolio|github|링크|url)/i.test(d));
      if (portfolioDocs.length > 0) {
        portfolioDocs.forEach(d => { if (!required.includes(d)) required.push(d); });
      }
    }

    if (format.length === 0) {
      if (fileConstraints.format && postingText.includes(String(fileConstraints.format).replace(/\s*권장$/, ''))) {
        format.push(`허용 형식: ${fileConstraints.format}`);
      }
      if (fileConstraints.maxSize && postingText.includes(String(fileConstraints.maxSize))) {
        format.push(`최대 파일 크기: ${fileConstraints.maxSize}`);
      }
      hintLines.forEach(h => {
        if (/(pdf|hwp|docx?|pptx?|zip|url|링크|자유\s*양식|자유양식|mb|kb|페이지|\d+p\b|파일\s*크기|용량)/i.test(h) && !format.includes(h)) {
          format.push(h);
        }
      });
    }

    if (content.length === 0 && portfolioTips.length > 0) {
      content.push(...portfolioTips.filter(t => postingText.includes(t)).slice(0, 5));
    }
  }

  addUnique(required, extracted.required);
  addUnique(format, extracted.format);
  addUnique(content, extracted.content);
  removeUnknownPlaceholders();

  if (!submission) {
    const subHint = hintLines.find(h => /(이메일|첨부|플랫폼|지원|제출)/i.test(h));
    submission = extracted.submission || subHint || '';
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

function sanitizeAnalysisAgainstSource(analysis, postingText = '', options = {}) {
  const source = String(postingText || '');
  const preserveCompanyResearch = Boolean(options.preserveCompanyResearch);
  const safe = analysis && typeof analysis === 'object' ? analysis : {};
  const companyAnalysis = safe.companyAnalysis && typeof safe.companyAnalysis === 'object' ? { ...safe.companyAnalysis } : {};
  const workConditions = safe.workConditions && typeof safe.workConditions === 'object' ? { ...safe.workConditions } : {};

  if (!hasAnyTerm(source, ['연봉', '급여', '보상', 'salary', 'pay'])) {
    workConditions.salary = null;
    workConditions.estimatedSalaryRange = { min: null, max: null, unit: '', basis: '공고에 급여 정보가 명시되지 않았습니다.' };
  }

  if (!preserveCompanyResearch && !hasAnyTerm(source, ['직원', '임직원', '구성원', 'employees', '매출', 'revenue', '설립', 'founded', '창업'])) {
    companyAnalysis.companySize = { employees: '', revenue: '', founded: '' };
  }

  if (!preserveCompanyResearch && !hasAnyTerm(source, ['경쟁', '경쟁사', 'competitor', '비교'])) {
    companyAnalysis.competitors = [];
  }

  if (!preserveCompanyResearch && !hasAnyTerm(source, ['투자', '인수', '합병', 'm&a', 'ipo', '시리즈', 'series', '최근', '뉴스'])) {
    companyAnalysis.recentTrends = '';
  }

  return {
    ...safe,
    companyAnalysis,
    workConditions,
    _sourceType: safe._sourceType || (preserveCompanyResearch ? 'job-posting-with-company-research' : 'job-posting-text'),
    _sourceConfidence: looksLikeJobPosting(source) ? 'posting_text' : 'limited_text',
  };
}

// 채용공고 본문으로 보이는지 판별(플랫폼 껍데기/로그인 화면 거르기)
const JD_TERMS = [
  '자격요건', '자격 요건', '우대사항', '우대 사항', '담당업무', '담당 업무',
  '주요업무', '주요 업무', '모집부문', '모집 부문', '모집요강', '지원자격', '지원 자격',
  '근무조건', '근무 조건', '직무내용', '전형절차', '복리후생', '경력사항', '모집분야',
  '모집 직무', '모집직무', '채용공고', '자기소개서 문항', '자소서 문항',
  '제출서류', '제출 서류', '포트폴리오', '이력서',
  'responsibilities', 'qualifications', 'requirements',
];
function looksLikeJobPosting(text = '') {
  if (!text || text.length < 200) return false;
  const hits = JD_TERMS.filter(term => text.includes(term)).length;
  return hits >= 2;
}
// jasoseol 등 SPA/로그인 사이트에서 본문 대신 플랫폼 껍데기만 받은 경우 true
function isLikelyShell(url, text) {
  let host = '';
  try { host = new URL(url).hostname; } catch { /* noop */ }
  const SPA_HOSTS = /jasoseol\.com|wanted\.co\.kr|rallit\.com|programmers\.co\.kr|greetinghr\.com|ghr\.kr/i;
  if (!SPA_HOSTS.test(host)) return false;
  return !looksLikeJobPosting(text);
}

function prioritizeJobPostingText(text = '') {
  const source = compactText(text);
  if (!source) return '';

  const priorityTerms = [
    '모집부문', '모집분야', '담당업무', '주요업무', '자격요건', '지원자격',
    '우대사항', '필수요건', '근무조건', '전형절차', '접수기간', '접수방법',
    '제출서류', '자기소개서', '포트폴리오', 'responsibilities', 'requirements',
    'qualifications',
  ];

  const windows = [];
  for (const term of priorityTerms) {
    const idx = source.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) continue;
    windows.push(source.slice(Math.max(0, idx - 700), idx + 3500));
  }

  const lead = source.slice(0, 2200);
  const prioritized = [...windows, lead]
    .map(compactText)
    .filter(Boolean)
    .filter((chunk, index, arr) => arr.findIndex(prev => prev.slice(0, 300) === chunk.slice(0, 300)) === index)
    .join('\n\n');

  return [prioritized, source]
    .filter(Boolean)
    .join('\n\n--- 원문 전체 ---\n\n')
    .substring(0, 18000);
}

// ── HTTP 기반 스크래핑 (빠름, Chrome 불필요) ─────────
async function fetchRawHtml(url, referer) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function htmlToText(html) {
  const embeddedText = [];
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) embeddedText.push(titleMatch[1]);

  const metaRe = /<meta\b[^>]*>/gi;
  let metaMatch;
  while ((metaMatch = metaRe.exec(html)) !== null) {
    const tag = metaMatch[0];
    const key = tag.match(/\b(?:name|property)=["']([^"']+)["']/i)?.[1] || '';
    if (!/(?:title|description|keywords|og:title|og:description|twitter:title|twitter:description)/i.test(key)) continue;
    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
    if (content) embeddedText.push(content);
  }

  embeddedText.push(extractScriptDataText(html));

  return [
    ...embeddedText,
    html,
  ].join(' ')
    .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|table)>/gi, '\n')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/display\s*:\s*none/gi, ' ')
    .split(/\n+/)
    .map(decodeHtmlEntities)
    .map(compactText)
    .filter(Boolean)
    .join('\n')
    .replace(/\s+/g, ' ').trim();
}

function jsonToReadableText(value, prefix = '') {
  if (value == null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = compactText(value);
    return text ? [`${prefix ? `${prefix}: ` : ''}${text}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => jsonToReadableText(item, `${prefix}[${index + 1}]`));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => {
      // 광고·배너 키는 다른 기업(광고주) 이름을 실어 나른다. 분석 대상 기업이 뒤바뀌는 원인이라 통째로 제외한다.
      // (loadingAdvertises 처럼 이름이 조금씩 달라 개별 나열 대신 패턴으로 거른다)
      if (/advertis|banner/i.test(key)) return [];
      if (/^(id|created_at|updated_at|image|image_url|webp_image_url|view_count|favorite_count|resumes_count|chat)$/i.test(key)) {
        return [];
      }
      return jsonToReadableText(child, prefix ? `${prefix}.${key}` : key);
    });
  }
  return [];
}

async function fetchJasoseolStructuredText(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return ''; }
  if (!/jasoseol\.com$/i.test(parsed.hostname)) return '';
  // 자소설닷컴은 /recruit/{id} 외에 /recruit?ec={id} 형태의 링크도 쓴다.
  // 쿼리 형태를 놓치면 공고 API를 못 불러 광고 배너 JSON만 분석되는 문제가 생긴다.
  const recruitId = parsed.pathname.match(/\/recruit\/(\d+)/)?.[1]
    || parsed.searchParams.get('ec')
    || parsed.searchParams.get('recruit_id')
    || parsed.searchParams.get('employment_id');
  if (!recruitId || !/^\d+$/.test(recruitId)) return '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`https://jasoseol.com/api/v1/employment_companies/${recruitId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer': url,
      },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const employmentFields = Array.isArray(data.employments)
      ? data.employments.map(item => item?.field).filter(Boolean).join(', ')
      : '';
    const lines = [
      `채용공고 API: 자소설닷컴 employment_companies/${recruitId}`,
      data.name ? `기업명: ${data.name}` : '',
      data.title ? `공고명: ${data.title}` : '',
      data.start_time ? `접수 시작: ${data.start_time}` : '',
      data.end_time ? `접수 마감: ${data.end_time}` : '',
      data.employment_page_url ? `채용 홈페이지: ${data.employment_page_url}` : '',
      employmentFields ? `모집 직무: ${employmentFields}` : '',
      data.content ? `공고 상세 HTML: ${htmlToText(data.content)}` : '',
      ...jsonToReadableText({
        employments: data.employments,
        company_group: data.company_group,
        attached_file_url: data.attached_file_url,
        direct_apply: data.direct_apply,
        is_receive_applicant: data.is_receive_applicant,
      }),
    ];
    return lines.map(compactText).filter(Boolean).join('\n');
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

function buildJobkoreaDetailUrls(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return []; }
  if (!/jobkorea\.co\.kr$/i.test(parsed.hostname)) return [];

  const gno =
    parsed.searchParams.get('Gno') ||
    parsed.searchParams.get('gno') ||
    parsed.pathname.match(/\/(\d{5,})(?:\/)?$/)?.[1] ||
    '';
  if (!gno) return [];

  return [
    `https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=${encodeURIComponent(gno)}`,
    `https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Worknet_Ifrm?Gno=${encodeURIComponent(gno)}`,
  ].filter(candidate => candidate !== url);
}

function buildSaraminDetailUrls(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return []; }
  if (!/saramin\.co\.kr$/i.test(parsed.hostname)) return [];

  const recIdx =
    parsed.searchParams.get('rec_idx') ||
    parsed.pathname.match(/\/(\d{5,})(?:\/)?$/)?.[1] ||
    '';
  if (!recIdx) return [];

  return [
    `https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=${encodeURIComponent(recIdx)}`,
    `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${encodeURIComponent(recIdx)}&view_type=etc`,
    `https://m.saramin.co.kr/job-search/view?rec_idx=${encodeURIComponent(recIdx)}`,
  ].filter(candidate => candidate !== url);
}

async function fetchAdditionalDetailText(url, html) {
  const candidates = [
    ...extractJobIframeUrls(html, url),
    ...buildJobkoreaDetailUrls(url),
    ...buildSaraminDetailUrls(url),
  ];

  const texts = [];
  for (const detailUrl of [...new Set(candidates)].slice(0, 6)) {
    try {
      const detailHtml = await fetchRawHtml(detailUrl, url);
      const detailText = htmlToText(detailHtml);
      if (detailText.length > 100) texts.push(`상세 공고 URL: ${detailUrl}\n${detailText}`);
    } catch {
      // 상세 후보 중 일부가 막혀도 다른 후보를 계속 시도한다.
    }
  }
  return texts.join('\n');
}

// 사람인 등은 채용 상세가 <iframe>(예: view-detail) 안에 들어있어 본문이 보이지 않는다.
// HTML에서 채용 상세로 보이는 iframe src를 찾아 절대 URL로 반환한다.
function extractJobIframeUrls(html, baseUrl) {
  const urls = [];
  const re = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const abs = new URL(m[1], baseUrl);
      if (abs.protocol === 'https:' && /(view-detail|relay|jobs|recruit|view|detail|content)/i.test(abs.pathname + abs.search)) {
        urls.push(abs.href);
      }
    } catch { /* 잘못된 src 무시 */ }
  }
  return [...new Set(urls)].slice(0, 3);
}

async function fetchJobWithHttp(url) {
  const html = await fetchRawHtml(url);
  const structuredText = await fetchJasoseolStructuredText(url);
  let text = [structuredText, htmlToText(html)].filter(Boolean).join('\n');

  // 본문이 짧거나 주요 채용 플랫폼이면 iframe/API/모바일 상세 후보를 함께 합친다.
  if (text.length < 2500 || /saramin\.co\.kr|jobkorea\.co\.kr/i.test(url)) {
    const detailText = await fetchAdditionalDetailText(url, html);
    if (detailText) text += '\n' + detailText;
  }

  text = prioritizeJobPostingText(text).substring(0, 15000);
  // 너무 짧거나, SPA 플랫폼 껍데기(실제 공고 본문 아님)면 실패 처리 → Puppeteer/검색 폴백
  if (text.length < 300 || isLikelyShell(url, text)) throw new Error('CONTENT_TOO_SHORT');
  // 제목에 담긴 기업명을 맨 앞에 고정 (추천 공고의 다른 기업명과 혼동 방지)
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim();
  return title ? `[페이지 제목] ${title}\n\n${text}` : text;
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

  // 메모리 제약 호스트(예: Render 무료 512MB) 보호 스위치.
  // PUPPETEER_DISABLED=true 면 OOM 위험이 큰 Chromium 실행을 건너뛰고
  // 사용자에게 직접 붙여넣기를 안내한다. (미설정 시 기존 동작 유지)
  if (process.env.PUPPETEER_DISABLED === 'true') {
    console.log('[Job] PUPPETEER_DISABLED=true → 브라우저 스크래핑 생략:', maskedHost);
    throw new Error('채용공고 자동 수집을 사용할 수 없습니다. 공고 내용을 직접 붙여넣어주세요.');
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
        // SPA(자소설닷컴 등)는 본문이 JS로 늦게 로드되므로 네트워크가 잠잠해질 때까지 대기
        try {
          if (typeof page.waitForNetworkIdle === 'function') {
            await page.waitForNetworkIdle({ idleTime: 800, timeout: 9000 });
          }
        } catch { /* 타임아웃이어도 계속 진행 */ }
        await new Promise(r => setTimeout(r, 1500));
        // 메인 프레임 + 모든 iframe(사람인 상세 본문 등)의 텍스트를 모두 수집
        const frameTexts = await Promise.all(
          page.frames().map(async (frame) => {
            try {
              return await frame.evaluate(() => {
                ['script', 'style', 'nav', 'footer', 'header', 'noscript'].forEach(tag => {
                  document.querySelectorAll(tag).forEach(el => el.remove());
                });
                return document.body ? document.body.innerText : '';
              });
            } catch {
              return '';
            }
          })
        );
        return frameTexts
          .map(t => (t || '').trim())
          .filter(t => t.length > 40)
          .join('\n')
          .substring(0, 15000);
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SCRAPE_TIMEOUT')), SCRAPE_TIMEOUT_MS)
      ),
    ]);

    const rawText = await scrapeWithTimeout;
    // HTTP 경로와 동일하게 공고 본문 구간을 앞으로 끌어올린다.
    // (이 처리가 없으면 사이드바·추천 공고가 앞에 남아 다른 기업이 분석되는 원인이 된다)
    const scraped = prioritizeJobPostingText(rawText);
    // 로그인 벽/빈 SPA 또는 플랫폼 껍데기만 받았으면 원문 수집 실패로 처리한다.
    if (!scraped || scraped.length < 200 || isLikelyShell(url, scraped)) throw new Error('CONTENT_TOO_SHORT');
    // 페이지는 정상적으로 읽혔지만 채용공고가 아닌 경우(회사 홈페이지·기사 등).
    // 이때 추정으로 분석하면 엉뚱한 결과가 나오므로 여기서 끊는다.
    if (!looksLikeJobPosting(scraped)) throw new Error('NOT_JOB_POSTING');

    // 페이지 제목은 해당 공고의 기업명을 가장 안정적으로 담고 있어(예: "○○ 채용공고 - 직무 | 잡코리아")
    // 프롬프트 맨 앞에 고정해 추천 공고의 다른 기업명과 혼동되지 않게 한다.
    let pageTitle = '';
    try { pageTitle = (await page.title()) || ''; } catch { /* 제목을 못 읽어도 계속 진행 */ }

    console.log('[Job] Puppeteer 스크래핑 성공:', maskedHost, '길이:', scraped.length);
    return pageTitle ? `[페이지 제목] ${pageTitle.trim()}\n\n${scraped}` : scraped;
  } catch (err) {
    console.error('[Job] Puppeteer 스크래핑 실패:', err.message);
    if (err.message === 'NOT_JOB_POSTING') {
      // 폴백(검색 기반 추정)으로 넘기면 안 되는 경우라 별도 코드로 구분해 올린다.
      const e = new Error('채용공고 페이지가 아닌 것 같습니다. 공고 상세 페이지 링크를 넣거나 공고 내용을 직접 붙여넣어주세요.');
      e.code = 'NOT_JOB_POSTING';
      e.status = 400;
      throw e;
    }
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
export async function analyzeJobPosting(text, options = {}) {
  const sourceUrl = options.sourceUrl || '';
  const useCompanyResearch = options.useCompanyResearch !== false;
  if (!hasAiProviderConfigured()) {
    return buildDeterministicPostingAnalysis(text, sourceUrl);
  }

  const prompt = `채용공고 분석가이자 기업 리서처입니다. 아래 채용공고 원문을 우선 분석하고, 기업 분석은 공개 검색으로 보강해 구조화된 JSON으로 추출하세요.
단, 채용공고 사실과 기업 공개정보를 섞어 단정하지 마세요.

채용공고:
${text.substring(0, 8000)}

채용공고 URL:
${sourceUrl || '(직접 붙여넣기 또는 URL 없음)'}

분석 지침:
0. [기업 확정 규칙 — 최우선] 이 공고를 낸 기업은 하나뿐입니다.
   - 원문 맨 앞의 "[페이지 제목]" 줄이 있으면 그 제목에 적힌 기업명을 company로 쓰세요. 채용 플랫폼 이름(잡코리아, 사람인, 자소설닷컴, 워티드, 인크루트 등)은 기업명이 아닙니다.
   - 페이지에는 "추천 공고", "이 공고를 본 사람이 본 공고", "관련 채용", 배너·광고 형태로 **다른 기업의 공고**가 함께 섞여 있습니다. 그 기업명은 절대 company로 쓰지 마세요.
   - 제목과 본문의 기업명이 다르면 제목을 우선하세요.
   - 어떤 기업의 공고인지 원문에서 확정할 수 없으면 company를 빈 문자열("")로 두세요. 검색으로 추측해서 채우지 마세요.
   - companyAnalysis는 위에서 확정한 그 기업에 대해서만 작성하세요. 다른 기업 정보를 섞지 마세요.
1. company, position, deadline, tasks, requirements, skills, documents, questions, workConditions는 공고 원문에서 확인되는 문장만 바탕으로 작성하세요.
2. 직무 적합도 weight/reason은 원문 요구사항의 반복, 필수/우대 구분, 담당업무와의 직접 관련성만 근거로 부여하세요.
3. 급여 정보가 원문에 없으면 salary와 estimatedSalaryRange의 min/max는 null로 두고 basis에 "공고에 급여 정보가 명시되지 않았습니다."라고 쓰세요.
4. companyAnalysis는 기업명과 채용공고 URL을 기준으로 공개 검색 가능한 공식 홈페이지, 채용 페이지, 뉴스, 기업 소개 자료를 활용해 충분히 작성하세요.
   - overview, industry, businessAreas, culture, strengths, recentTrends는 비어두지 말고 공개정보 기반으로 작성하세요.
   - 직원수/매출/설립연도처럼 숫자는 공식/신뢰 가능한 자료에서 확인될 때만 쓰고, 불확실하면 빈 문자열로 두세요.
   - competitors는 명확한 업종/서비스 맥락이 확인될 때만 작성하세요.
   - companyAnalysis.sourceNotes에 사용한 공개 출처의 제목/매체 또는 URL 단서를 2~5개 남기세요. 출처를 확신할 수 없으면 "[검증 필요]"라고 쓰세요.
5. 포트폴리오 요건(portfolioRequirements): 반드시 공고 원문에 적힌 사실만 충실히 추출하세요. 지어내지 마세요.
   - 공고에 "포트폴리오 제출 필수" 같은 문구가 있으면 그 문장을 required에 그대로 넣고 필수임을 분명히 하세요. 임의로 "필수 아님"이라고 쓰지 마세요.
   - 양식이 "자유양식"이면 format에 "자유 양식"이라고 적으세요. 공고에 PDF/페이지 수/파일 개수/용량 같은 형식 제한이 명시돼 있지 않으면 그런 제약을 절대 만들어내지 말고 format은 비워두세요.
   - content/submission도 공고에 적힌 내용만 사용하고, 공고에 없는 일반론(예: "PDF 10페이지 권장", "프로젝트 2~3개")은 넣지 마세요.
6. applicationStrategy는 공고 원문의 요구사항과 공개 기업 리서치를 함께 반영해 작성하세요. 단, "공고에 명시됨"처럼 표현하려면 실제 원문에 있어야 합니다.
7. industryTrends는 기업의 업종/서비스가 확인되면 공개정보 기반으로 3개 이상 작성하세요.
8. 강조 표시: 원문에 실제로 나온 핵심 문구만 <u>강조할내용</u> 태그로 감싸세요.

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
    "estimatedSalaryRange": { "min": null, "max": null, "unit": "", "basis": "" },
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
    "homepage": null,
    "sourceNotes": []
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

  try {
    const raw = useCompanyResearch
      ? await callProFirstWithSearch(prompt, 'AnalyzeJobPostingWithCompanyResearch')
      : await callProFirst(prompt, 'AnalyzeJobPosting', { callTimeoutMs: 180000 });
    const parsed = parseJSON(raw);
    return sanitizeAnalysisAgainstSource(enrichPortfolioRequirements(parsed, text), text, {
      preserveCompanyResearch: useCompanyResearch,
    });
  } catch (err) {
    console.warn('[AnalyzeJobPosting] AI 분석 실패, 공고 메타 기반 분석으로 대체:', err.message);
    return buildDeterministicPostingAnalysis(text, sourceUrl);
  }
}

export async function analyzeJobPostingFromUrl(url, context = '') {
  if (!hasAiProviderConfigured()) {
    const company = inferCompanyFromContext(context, url);
    const fallback = buildFallbackJobAnalysis({
      company,
      position: /대졸|신입|인턴/i.test(context) ? '대졸신입/인턴 채용' : '채용공고',
      deadline: '',
      sourceType: 'url-search-fallback',
    });
    return ensureSearchedUrlAnalysisUsable({
      ...fallback,
      company,
      _analysisWarning: 'AI 검색 분석 API 키가 설정되지 않아 URL과 입력 단서를 바탕으로 기본 준비 가이드를 표시합니다.',
    }, url);
  }

  const prompt = `채용공고 URL과 공개 검색 정보를 바탕으로 기업/직무 분석 JSON을 작성하세요.
이 경로는 채용공고 원문 자동 수집이 실패했을 때 사용됩니다. 따라서 확인된 정보와 추정/가이드를 반드시 구분하세요.

채용공고 URL:
${url}

사용자 보조 정보:
${context || '(없음)'}

작성 지침:
1. 채용공고 URL이 검색 결과에서 접근되면 company, position, deadline, tasks, requirements를 가능한 한 추출하세요.
2. URL의 공고 내용을 확인할 수 없으면 company/position은 URL, 보조 정보, 검색 결과에서 확인되는 범위만 쓰고, tasks/requirements는 빈 배열 또는 보수적 가이드로 작성하세요.
3. companyAnalysis는 공식 홈페이지/채용페이지/뉴스/기업 소개 등 공개 검색으로 충분히 작성하세요. overview, industry, businessAreas, culture, strengths, recentTrends는 비어두지 마세요.
4. portfolioRequirements는 공고 원문에서 확인된 경우에만 작성하세요. 확인되지 않으면 required에 "공고 원문 확인 필요", submission에 "공고 원문 확인 필요"를 넣으세요.
5. applicationStrategy와 industryTrends는 공개 기업 정보와 직무명 기반 준비 가이드로 작성하되, 실제 공고에 적힌 사실처럼 표현하지 마세요.
6. companyAnalysis.sourceNotes에 참고한 출처 제목/매체 또는 URL 단서를 2~5개 남기세요.

반드시 JSON만 응답하세요. 마크다운 금지:
{
  "company": "",
  "position": "",
  "tasks": [],
  "requirements": { "essential": [], "preferred": [] },
  "skills": [],
  "skillImportance": [{ "skill": "", "weight": 8, "reason": "" }],
  "applicationFormat": {
    "documents": [],
    "questions": [],
    "fileConstraints": { "maxSize": null, "format": null }
  },
  "deadline": null,
  "workConditions": {
    "salary": null,
    "estimatedSalaryRange": { "min": null, "max": null, "unit": "", "basis": "공고 원문 확인 필요" },
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
    "homepage": null,
    "sourceNotes": []
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
    { "factor": "직무 경험 관련성", "maxScore": 30, "description": "" },
    { "factor": "기업 이해도", "maxScore": 25, "description": "" },
    { "factor": "성과 증명력", "maxScore": 25, "description": "" },
    { "factor": "협업/커뮤니케이션", "maxScore": 20, "description": "" }
  ],
  "portfolioRequirements": {
    "required": [],
    "format": [],
    "content": [],
    "submission": ""
  }
}`;

  try {
    const raw = await callProFirstWithSearch(prompt, 'AnalyzeJobPostingFromUrlWithSearch');
    const parsed = parseJSON(raw);
    const enriched = enrichPortfolioRequirements(parsed, context || '');
    return ensureSearchedUrlAnalysisUsable(
      sanitizeAnalysisAgainstSource(enriched, context || '', { preserveCompanyResearch: true }),
      url
    );
  } catch (err) {
    console.warn('[AnalyzeJobPostingFromUrl] 검색 분석 실패, URL 기반 준비 가이드로 대체:', err.message);
    const company = inferCompanyFromContext(context, url);
    const fallback = buildFallbackJobAnalysis({
      company,
      position: /대졸|신입|인턴/i.test(context) ? '대졸신입/인턴 채용' : '채용공고',
      deadline: '',
      sourceType: 'url-search-fallback',
    });
    return ensureSearchedUrlAnalysisUsable({
      ...fallback,
      company,
      _analysisWarning: 'AI 검색 분석에 실패해 URL과 입력 단서를 바탕으로 기본 준비 가이드를 표시합니다. API 설정과 공고 원문을 확인해 주세요.',
    }, url);
  }
}

function inferCompanyFromUrl(url = '') {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const parts = host.split('.');
    const root = parts.length >= 2 ? parts[parts.length - 2] : host;
    return root.replace(/[-_]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
  } catch {
    return '지원 기업';
  }
}

function inferCompanyFromContext(context = '', url = '') {
  const text = String(context || '').replace(/\s+/g, ' ').trim();
  const explicit = text.match(/(?:기업명|회사명|기업)\s*[:：]\s*([^|\n\r]+)/i);
  if (explicit?.[1]) return explicit[1].trim().slice(0, 80);
  const ti = text.match(/\bT\.?\s*I\.?\s*Korea\b|TI\s*Korea|Texas\s*Instruments\s*Korea/i);
  if (ti) return 'TI Korea';
  const leading = text.match(/^([A-Za-z0-9가-힣㈜()&.\-\s]{2,40})(?:\s+(?:채용|모집|대졸|신입|인턴)|$)/);
  if (leading?.[1] && !/채용공고|사용자 입력|지원서|모집분야/i.test(leading[1])) return leading[1].trim();
  return inferCompanyFromUrl(url);
}

function extractSimplePostingFacts(text = '', sourceUrl = '') {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  const titleMatch = source.match(/([A-Za-z0-9가-힣㈜()&.\-\s]{2,80})\s+채용공고\s*-\s*([^|]+?)(?:\s*\||\s+-\s+자소설닷컴|$)/i);
  const company = titleMatch?.[1]?.trim() || inferCompanyFromContext(source, sourceUrl);
  const position = titleMatch?.[2]?.trim() || (source.match(/모집분야\s*[:：]\s*([^|\n\r]+)/i)?.[1] || '채용공고').trim();
  const roleMatch = source.match(/모집\s*직무\s*[:：]\s*([^|]+?)(?:\s+-\s+자소설닷컴|자기소개서|채용공고|$)/i);
  const roles = roleMatch?.[1]
    ? roleMatch[1].split(/,|ㆍ|·|\//).map(v => v.trim()).filter(Boolean).slice(0, 10)
    : [];
  return { company, position, roles };
}

function buildDeterministicPostingAnalysis(text = '', sourceUrl = '') {
  const { company, position, roles } = extractSimplePostingFacts(text, sourceUrl);
  const isTi = /^(?:TI|T\.I\.|Texas Instruments)\s*Korea/i.test(company) || /Texas Instruments/i.test(text);
  const normalizedCompany = isTi ? 'TI Korea' : company;
  const normalizedPosition = position || (roles[0] || '채용공고');
  const fallback = buildFallbackJobAnalysis({
    company: normalizedCompany,
    position: normalizedPosition,
    deadline: '',
    sourceType: 'posting-metadata-fallback',
  });

  const companyAnalysis = {
    ...fallback.companyAnalysis,
    overview: isTi
      ? 'TI Korea는 글로벌 반도체 기업 Texas Instruments의 한국 조직으로 볼 수 있으며, 아날로그 및 임베디드 프로세싱 반도체를 중심으로 고객 기술 지원, 품질, 영업/운영 직무 역량이 중요합니다.'
      : `${normalizedCompany} 채용공고에서 확인된 회사명과 모집 정보를 바탕으로 작성한 기본 기업 분석입니다. 공식 홈페이지와 채용 원문을 함께 확인해 사업 영역과 평가 기준을 보강하세요.`,
    industry: isTi ? '반도체 · 전자부품 · 기술영업/애플리케이션 엔지니어링' : fallback.companyAnalysis.industry,
    businessAreas: isTi ? ['아날로그 반도체', '임베디드 프로세싱', '고객 기술 지원', '품질/운영', '기술영업'] : fallback.companyAnalysis.businessAreas,
    recentTrends: isTi
      ? '반도체 업계는 전력 효율, 차량/산업용 전장, 엣지 디바이스, 고객 맞춤형 기술 지원의 중요성이 커지고 있습니다. 지원 포트폴리오는 회로/시스템 이해, 문제 해결 과정, 고객 관점 커뮤니케이션을 함께 보여주는 방향이 좋습니다.'
      : fallback.companyAnalysis.recentTrends,
    culture: isTi
      ? '기술 전문성과 고객 문제 해결력을 함께 요구하는 조직으로 해석할 수 있습니다. 협업, 빠른 학습, 데이터 기반 커뮤니케이션을 경험 근거로 보여주는 것이 유리합니다.'
      : fallback.companyAnalysis.culture,
    strengths: isTi
      ? [
          '글로벌 반도체 기업 맥락에서 기술 깊이와 고객 접점 역량을 동시에 어필할 수 있습니다.',
          'FAE, Quality, Operations, Technical Sales 등 모집 직무가 다양해 전공/프로젝트 경험을 직무별로 정교하게 매칭하기 좋습니다.',
        ]
      : fallback.companyAnalysis.strengths,
    weaknesses: ['공고 상세 원문을 완전히 확인하지 못한 경우, 실제 필수요건·제출서류·마감 정보는 지원 전 반드시 다시 확인해야 합니다.'],
    competitors: isTi
      ? [
          { name: 'Analog Devices', comparison: '아날로그/혼합신호 반도체 분야에서 비교되는 글로벌 기업입니다.' },
          { name: 'STMicroelectronics', comparison: '산업용·차량용 반도체와 임베디드 솔루션 영역에서 비교될 수 있습니다.' },
        ]
      : [],
    companySize: { employees: '', revenue: '', founded: '' },
    sourceNotes: [
      sourceUrl || '채용공고 URL',
      roles.length ? `공고 메타 모집 직무: ${roles.slice(0, 6).join(', ')}` : '공고 메타 정보 기반',
      isTi ? 'Texas Instruments/TI Korea 공개 기업 맥락 기반' : '공식 기업 정보 추가 확인 필요',
    ],
  };

  const roleSkills = roles.length
    ? roles.flatMap(role => {
        if (/application|FAE|engineer|technical|quality/i.test(role)) return ['기술 문제 해결', '전자/반도체 이해', '고객 커뮤니케이션'];
        if (/operation|analyst/i.test(role)) return ['운영 분석', '데이터 정리', '프로세스 개선'];
        if (/sales/i.test(role)) return ['기술영업', '고객 니즈 분석', '솔루션 제안'];
        return [];
      })
    : fallback.skills;
  const skills = [...new Set(roleSkills.length ? roleSkills : fallback.skills)].slice(0, 8);

  return ensureSearchedUrlAnalysisUsable(enrichPortfolioRequirements({
    ...fallback,
    company: normalizedCompany,
    position: normalizedPosition,
    tasks: roles.length ? roles.map(role => `${role} 직무 관련 업무 수행`) : fallback.tasks,
    requirements: {
      essential: skills.slice(0, 4).map(skill => `${skill} 역량`),
      preferred: roles.length ? roles.slice(0, 4).map(role => `${role} 관련 프로젝트/인턴 경험`) : fallback.requirements.preferred,
    },
    skills,
    skillImportance: skills.map((skill, index) => ({ skill, weight: Math.max(6, 9 - index), reason: `${normalizedPosition} 지원 포트폴리오에서 근거 사례로 보여주면 좋은 역량입니다.` })),
    companyAnalysis,
    positionAnalysis: {
      ...fallback.positionAnalysis,
      roleDescription: roles.length
        ? `이번 공고는 ${roles.slice(0, 5).join(', ')} 등 여러 직무를 포함합니다. 지원자는 선택 직무에 맞춰 기술 이해, 문제 해결, 고객/조직 커뮤니케이션 경험을 선별해야 합니다.`
        : fallback.positionAnalysis.roleDescription,
      dailyTasks: roles.length ? roles.map(role => `${role} 관련 업무`).join(', ') : fallback.positionAnalysis.dailyTasks,
      keyCompetencies: skills.map((skill, index) => ({ name: skill, weight: Math.max(6, 9 - index), description: `${skill}을 보여주는 프로젝트/경험 근거를 준비하세요.` })),
    },
    applicationStrategy: {
      ...fallback.applicationStrategy,
      motivationPoints: [
        { point: `${normalizedCompany}의 산업/제품 맥락과 본인 경험 연결`, how: '지원 직무와 가장 가까운 프로젝트를 첫 문단 또는 첫 카드에 배치하세요.' },
        { point: roles.length ? `모집 직무(${roles.slice(0, 3).join(', ')}) 중 선택 직무 명확화` : `${normalizedPosition} 직무 적합성 명확화`, how: '직무별 요구 역량이 다르므로 포트폴리오 제목과 프로젝트 순서를 선택 직무 기준으로 맞추세요.' },
      ],
      passingStrategy: [
        { strategy: '직무별 프로젝트 매칭', description: '지원 직무와 직접 연결되는 프로젝트를 1순위로 배치하고, 문제-역할-결과를 짧게 보여주세요.' },
        { strategy: '기술+커뮤니케이션 동시 어필', description: '기술 직무라도 고객/협업/문서화 역량이 함께 보이면 차별화됩니다.' },
      ],
      appealPoints: skills.slice(0, 5),
      portfolioTips: [
        '지원 직무 하나를 먼저 정하고 관련 프로젝트만 앞쪽에 배치',
        '반도체/전자/데이터/고객 문제 해결과 연결되는 경험을 STAR 구조로 정리',
        '결과 수치가 없으면 문제 난이도, 의사결정 기준, 협업 범위를 구체화',
        '공고 원문에서 요구하는 제출 형식과 자소서 문항은 지원 직전에 다시 확인',
      ],
      cautionPoints: [
        '모든 모집 직무를 한 포트폴리오에 평면적으로 나열하면 초점이 흐려질 수 있습니다.',
        '공고 메타 기반 분석이므로 실제 필수요건과 제출 조건은 원문으로 재확인하세요.',
      ],
    },
    industryTrends: isTi
      ? [
          { trend: '전력 효율과 아날로그 반도체 수요', description: '산업용·차량용·모바일 기기에서 전력 효율과 안정성이 중요해지고 있습니다.', impact: '회로/시스템 관점의 문제 해결 경험을 보여주면 FAE·기술영업 직무에서 설득력이 커집니다.', keywords: ['Analog', 'Power', 'Efficiency'], level: 'growing', opportunity: '전공 프로젝트를 제품/고객 문제와 연결하기 좋습니다.', threat: '부품명 나열만으로는 실무 이해가 약해 보일 수 있습니다.' },
          { trend: '고객 기술지원형 엔지니어 역할 확대', description: '반도체 기업의 엔지니어는 제품 이해뿐 아니라 고객 문제를 빠르게 정의하고 해결하는 역량이 중요합니다.', impact: '프로젝트에서 요구사항 파악, 디버깅, 문서화, 커뮤니케이션 과정을 강조하세요.', keywords: ['FAE', 'Debugging', 'Customer'], level: 'stable', opportunity: '기술과 커뮤니케이션을 동시에 어필할 수 있습니다.', threat: '기술 설명만 길고 고객/문제 맥락이 없으면 직무 연결성이 약해집니다.' },
          { trend: '품질/운영 데이터 기반 개선', description: '품질과 운영 직무에서는 이슈 추적, 데이터 정리, 프로세스 개선 역량이 중요합니다.', impact: 'Quality/Operations 직무 지원자는 데이터 기반 개선 사례를 앞쪽에 배치하는 것이 좋습니다.', keywords: ['Quality', 'Operations', 'Data'], level: 'stable', opportunity: '정량 지표를 만들기 좋은 직무군입니다.', threat: '정성적 표현만 있으면 분석 역량이 약해 보일 수 있습니다.' },
        ]
      : fallback.industryTrends,
    _sourceType: 'posting-metadata-fallback',
    _analysisWarning: '공고 HTML 메타 정보와 공개 기업 맥락을 바탕으로 분석했습니다. 상세 제출 조건은 공고 원문에서 재확인해 주세요.',
  }, text), sourceUrl);
}

function ensureSearchedUrlAnalysisUsable(analysis, url) {
  const safe = analysis && typeof analysis === 'object' ? analysis : {};
  const company = safe.company || inferCompanyFromUrl(url);
  const position = safe.position || '채용공고';
  const fallback = buildFallbackJobAnalysis({
    company,
    position,
    deadline: safe.deadline || '',
    sourceType: 'url-search-guide',
  });
  const companyAnalysis = safe.companyAnalysis && typeof safe.companyAnalysis === 'object' ? safe.companyAnalysis : {};
  const positionAnalysis = safe.positionAnalysis && typeof safe.positionAnalysis === 'object' ? safe.positionAnalysis : {};
  const applicationStrategy = safe.applicationStrategy && typeof safe.applicationStrategy === 'object' ? safe.applicationStrategy : {};

  const listOrFallback = (value, fallbackValue) => toCleanList(value).length ? toCleanList(value) : fallbackValue;
  const objListOrFallback = (value, fallbackValue) => Array.isArray(value) && value.length ? value : fallbackValue;
  const textOrFallback = (value, fallbackValue) => (typeof value === 'string' && value.trim()) ? value.trim() : fallbackValue;

  return {
    ...fallback,
    ...safe,
    company,
    position,
    tasks: listOrFallback(safe.tasks, fallback.tasks),
    requirements: {
      essential: listOrFallback(safe.requirements?.essential, fallback.requirements.essential),
      preferred: listOrFallback(safe.requirements?.preferred, fallback.requirements.preferred),
    },
    skills: listOrFallback(safe.skills, fallback.skills),
    skillImportance: objListOrFallback(safe.skillImportance, fallback.skillImportance),
    coreValues: listOrFallback(safe.coreValues, fallback.coreValues),
    companyAnalysis: {
      ...fallback.companyAnalysis,
      ...companyAnalysis,
      overview: textOrFallback(companyAnalysis.overview, fallback.companyAnalysis.overview),
      industry: textOrFallback(companyAnalysis.industry, fallback.companyAnalysis.industry),
      businessAreas: listOrFallback(companyAnalysis.businessAreas, fallback.companyAnalysis.businessAreas),
      recentTrends: textOrFallback(companyAnalysis.recentTrends, fallback.companyAnalysis.recentTrends),
      culture: textOrFallback(companyAnalysis.culture, fallback.companyAnalysis.culture),
      strengths: listOrFallback(companyAnalysis.strengths, fallback.companyAnalysis.strengths),
      weaknesses: listOrFallback(companyAnalysis.weaknesses, fallback.companyAnalysis.weaknesses),
      competitors: Array.isArray(companyAnalysis.competitors) ? companyAnalysis.competitors : [],
      sourceNotes: listOrFallback(companyAnalysis.sourceNotes, [`${company} 공개 검색 기반`, url]),
    },
    positionAnalysis: {
      ...fallback.positionAnalysis,
      ...positionAnalysis,
      roleDescription: textOrFallback(positionAnalysis.roleDescription, fallback.positionAnalysis.roleDescription),
      growthPath: textOrFallback(positionAnalysis.growthPath, fallback.positionAnalysis.growthPath),
      dailyTasks: textOrFallback(positionAnalysis.dailyTasks, fallback.positionAnalysis.dailyTasks),
      keyCompetencies: objListOrFallback(positionAnalysis.keyCompetencies, fallback.positionAnalysis.keyCompetencies),
    },
    applicationStrategy: {
      ...fallback.applicationStrategy,
      ...applicationStrategy,
      motivationPoints: objListOrFallback(applicationStrategy.motivationPoints, fallback.applicationStrategy.motivationPoints),
      passingStrategy: objListOrFallback(applicationStrategy.passingStrategy, fallback.applicationStrategy.passingStrategy),
      appealPoints: listOrFallback(applicationStrategy.appealPoints, fallback.applicationStrategy.appealPoints),
      cautionPoints: listOrFallback(applicationStrategy.cautionPoints, [
        '공고 원문에서 확인되지 않은 담당업무·제출 조건은 지원 전 반드시 원문으로 재확인하세요.',
        ...fallback.applicationStrategy.cautionPoints,
      ]),
      portfolioTips: listOrFallback(applicationStrategy.portfolioTips, fallback.applicationStrategy.portfolioTips),
    },
    industryTrends: objListOrFallback(safe.industryTrends, fallback.industryTrends),
    fitScoreFactors: objListOrFallback(safe.fitScoreFactors, fallback.fitScoreFactors),
    portfolioRequirements: {
      required: toCleanList(safe.portfolioRequirements?.required).length ? toCleanList(safe.portfolioRequirements.required) : ['공고 원문 확인 필요'],
      format: toCleanList(safe.portfolioRequirements?.format),
      content: toCleanList(safe.portfolioRequirements?.content),
      submission: safe.portfolioRequirements?.submission || '공고 원문 확인 필요',
    },
    _sourceType: safe._sourceType || 'url-search-guide',
    _analysisWarning: safe._analysisWarning || '공고 원문 자동 수집이 제한되어 공개 검색과 URL 단서를 바탕으로 작성했습니다. 제출 조건은 공고 원문으로 확인해 주세요.',
  };
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
4. portfolioRequirements는 실제 공고 원문이 없으므로 제출 필수 여부·파일 형식·용량 제한을 지어내지 말고 비워두세요.
   대신 applicationStrategy.portfolioTips에 준비 가이드를 작성하세요.
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
    "estimatedSalaryRange": { "min": null, "max": null, "unit": "", "basis": "공고 원문 확인 필요" },
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
    enriched = ensureManualAnalysisUsable(
      enrichPortfolioRequirements(parsed, syntheticPosting),
      { company: normalizedCompany, position: normalizedPosition, deadline: normalizedDeadline }
    );
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
    _analysisWarning: enriched._analysisWarning || '공고 원문 없이 기업명/모집분야/접수 기간을 바탕으로 작성한 준비 가이드입니다. 담당업무·제출 조건은 실제 공고 원문으로 확인해 주세요.',
  };
}

function ensureManualAnalysisUsable(analysis, { company, position, deadline }) {
  const fallback = buildFallbackJobAnalysis({
    company,
    position,
    deadline,
    sourceType: 'manual-entry-guide',
  });
  const safe = analysis && typeof analysis === 'object' ? analysis : {};
  const companyAnalysis = safe.companyAnalysis && typeof safe.companyAnalysis === 'object' ? safe.companyAnalysis : {};
  const positionAnalysis = safe.positionAnalysis && typeof safe.positionAnalysis === 'object' ? safe.positionAnalysis : {};
  const applicationStrategy = safe.applicationStrategy && typeof safe.applicationStrategy === 'object' ? safe.applicationStrategy : {};

  const listOrFallback = (value, fallbackValue) => toCleanList(value).length ? toCleanList(value) : fallbackValue;
  const objListOrFallback = (value, fallbackValue) => Array.isArray(value) && value.length ? value : fallbackValue;
  const textOrFallback = (value, fallbackValue) => (typeof value === 'string' && value.trim()) ? value.trim() : fallbackValue;

  return {
    ...fallback,
    ...safe,
    tasks: listOrFallback(safe.tasks, fallback.tasks),
    requirements: {
      essential: listOrFallback(safe.requirements?.essential, fallback.requirements.essential),
      preferred: listOrFallback(safe.requirements?.preferred, fallback.requirements.preferred),
    },
    skills: listOrFallback(safe.skills, fallback.skills),
    skillImportance: objListOrFallback(safe.skillImportance, fallback.skillImportance),
    coreValues: listOrFallback(safe.coreValues, fallback.coreValues),
    workConditions: {
      ...fallback.workConditions,
      ...(safe.workConditions || {}),
      estimatedSalaryRange: {
        min: null,
        max: null,
        unit: '',
        basis: safe.workConditions?.estimatedSalaryRange?.basis || '공고 원문 확인 필요',
      },
    },
    companyAnalysis: {
      ...fallback.companyAnalysis,
      ...companyAnalysis,
      overview: textOrFallback(companyAnalysis.overview, fallback.companyAnalysis.overview),
      recentTrends: textOrFallback(companyAnalysis.recentTrends, fallback.companyAnalysis.recentTrends),
      culture: textOrFallback(companyAnalysis.culture, fallback.companyAnalysis.culture),
      strengths: listOrFallback(companyAnalysis.strengths, fallback.companyAnalysis.strengths),
      weaknesses: listOrFallback(companyAnalysis.weaknesses, fallback.companyAnalysis.weaknesses),
      competitors: Array.isArray(companyAnalysis.competitors) ? companyAnalysis.competitors : [],
      companySize: { employees: '', revenue: '', founded: '' },
    },
    positionAnalysis: {
      ...fallback.positionAnalysis,
      ...positionAnalysis,
      roleDescription: textOrFallback(positionAnalysis.roleDescription, fallback.positionAnalysis.roleDescription),
      growthPath: textOrFallback(positionAnalysis.growthPath, fallback.positionAnalysis.growthPath),
      dailyTasks: textOrFallback(positionAnalysis.dailyTasks, fallback.positionAnalysis.dailyTasks),
      keyCompetencies: objListOrFallback(positionAnalysis.keyCompetencies, fallback.positionAnalysis.keyCompetencies),
    },
    applicationStrategy: {
      ...fallback.applicationStrategy,
      ...applicationStrategy,
      motivationPoints: objListOrFallback(applicationStrategy.motivationPoints, fallback.applicationStrategy.motivationPoints),
      passingStrategy: objListOrFallback(applicationStrategy.passingStrategy, fallback.applicationStrategy.passingStrategy),
      appealPoints: listOrFallback(applicationStrategy.appealPoints, fallback.applicationStrategy.appealPoints),
      cautionPoints: listOrFallback(applicationStrategy.cautionPoints, fallback.applicationStrategy.cautionPoints),
      portfolioTips: listOrFallback(applicationStrategy.portfolioTips, fallback.applicationStrategy.portfolioTips),
    },
    industryTrends: objListOrFallback(safe.industryTrends, fallback.industryTrends),
    fitScoreFactors: objListOrFallback(safe.fitScoreFactors, fallback.fitScoreFactors),
    portfolioRequirements: {
      required: ['공고 원문 확인 필요'],
      format: [],
      content: [],
      submission: '공고 원문 확인 필요',
    },
    _sourceType: 'manual-entry-guide',
    _analysisWarning: '공고 원문 없이 기업명/모집분야/접수 기간을 바탕으로 작성한 준비 가이드입니다. 담당업무·제출 조건은 실제 공고 원문으로 확인해 주세요.',
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
      required: ['공고 원문 확인 필요'],
      format: [],
      content: [],
      submission: '공고 원문 확인 필요',
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


// ============================================================
// 경험 구성 계획 — 경험/직군/경력단계/기업분석을 종합해 "배치 설계도"를 만든다.
// 실제 문장 생성이 아니라 어떤 블록을 어떤 순서·제목으로 놓을지만 결정한다.
// 실패해도 사용자 흐름을 막지 않도록 결정론적 폴백 계획을 돌려준다.
// ============================================================
const NARRATIVES = new Set(['problem-first', 'outcome-first', 'decision-first', 'process-first', 'build-first']);
const SOURCE_KEYS = new Set(COMPOSABLE_SOURCES.map(s => s.key));

/** 직군·경력단계만으로 만드는 폴백 구성 (AI 실패 시에도 고정 7섹션으로 되돌아가지 않게) */
function fallbackComposition(jobCategory = 'common', careerStage = 'first') {
  const byJob = {
    dev: ['product', 'jobSpecific', 'keyExperiences', 'decisionTrace', 'githubStats', 'honestReview'],
    aiml: ['product', 'jobSpecific', 'keyExperiences', 'decisionTrace', 'honestReview'],
    da: ['task', 'keyExperiences', 'decisionTrace', 'evidenceBundle', 'honestReview'],
    devops: ['task', 'keyExperiences', 'decisionTrace', 'portfolioVisuals', 'honestReview'],
    pm: ['product', 'leanCanvas', 'keyExperiences', 'decisionTrace', 'honestReview'],
    designer: ['task', 'jobSpecific', 'keyExperiences', 'evidenceBundle', 'honestReview'],
    marketer: ['task', 'marketerKit', 'keyExperiences', 'portfolioVisuals', 'honestReview'],
    hr: ['task', 'keyExperiences', 'portfolioVisuals', 'honestReview'],
    sales: ['output', 'keyExperiences', 'decisionTrace', 'honestReview'],
    common: ['intro', 'task', 'process', 'output', 'keyExperiences', 'honestReview'],
  };
  const order = byJob[jobCategory] || byJob.common;
  // 경력직은 성과를 앞으로, 첫 취업은 판단 과정을 앞으로
  const sources = careerStage === 'experienced'
    ? ['output', ...order.filter(k => k !== 'output')]
    : order;
  return {
    narrative: careerStage === 'experienced' ? 'outcome-first' : 'problem-first',
    artifactVariant: (ARTIFACT_VARIANTS[jobCategory] || [])[0]?.id || '',
    artifactRecipe: null,
    artifactReason: '',
    narrativeReason: 'AI 구성 실패 — 직군·경력단계 기본 배치를 사용했습니다.',
    headline: '',
    sections: sources.map(source => ({ source, title: '', emphasis: 'normal', why: '' })),
    keyExperienceOrder: [],
    keyExperienceReason: '',
    omitted: [],
    jdAlignment: [],
    _fallback: true,
  };
}

/** 히어로 레시피 정규화 — 모르는 블록 타입·톤은 버린다 (프론트 렌더러가 아는 값만 통과) */
const BLOCK_TYPES = new Set(ARTIFACT_BLOCKS.map(b => b.type));
const TONES = new Set(ARTIFACT_TONES);
function normalizeRecipe(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const seen = new Set();
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
    .filter(b => b && BLOCK_TYPES.has(b.type) && !seen.has(b.type) && seen.add(b.type))
    .slice(0, 3)
    .map((b, i) => ({
      type: b.type,
      title: String(b.title || '').trim().slice(0, 40),
      span: i === 0 ? 'main' : (b.span === 'main' ? 'main' : 'side'),
    }));
  if (blocks.length === 0) return null;
  return {
    kicker: String(raw.kicker || '').trim().slice(0, 40),
    title: String(raw.title || '').trim().slice(0, 60),
    badge: String(raw.badge || '').trim().slice(0, 20),
    tone: TONES.has(raw.tone) ? raw.tone : 'navy',
    blocks,
  };
}

/** AI 응답을 렌더 가능한 형태로 정규화 — 모르는 source·중복은 버린다. */
function normalizeComposition(raw, jobCategory, careerStage) {
  if (!raw || typeof raw !== 'object') return fallbackComposition(jobCategory, careerStage);
  const seen = new Set();
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .filter(s => s && SOURCE_KEYS.has(s.source) && !seen.has(s.source) && seen.add(s.source))
    .slice(0, 8)
    .map(s => ({
      source: s.source,
      title: String(s.title || '').trim().slice(0, 60),
      emphasis: s.emphasis === 'high' ? 'high' : 'normal',
      why: String(s.why || '').trim().slice(0, 200),
    }));
  if (sections.length === 0) return fallbackComposition(jobCategory, careerStage);
  const allowedVariants = new Set((ARTIFACT_VARIANTS[jobCategory] || []).map(v => v.id));
  const artifactVariant = allowedVariants.has(raw.artifactVariant) ? raw.artifactVariant : '';
  // 전용 변형이 있는 직군은 그 변형을 쓰고, 없는 직군만 데이터 주도 레시피를 사용한다.
  const artifactRecipe = artifactVariant ? null : normalizeRecipe(raw.artifactRecipe);
  return {
    artifactRecipe,
    narrative: NARRATIVES.has(raw.narrative) ? raw.narrative : 'problem-first',
    artifactVariant,
    artifactReason: artifactVariant ? String(raw.artifactReason || '').slice(0, 200) : '',
    narrativeReason: String(raw.narrativeReason || '').slice(0, 300),
    headline: String(raw.headline || '').slice(0, 200),
    sections,
    keyExperienceOrder: (Array.isArray(raw.keyExperienceOrder) ? raw.keyExperienceOrder : [])
      .map(Number).filter(n => Number.isInteger(n) && n >= 0).slice(0, 10),
    keyExperienceReason: String(raw.keyExperienceReason || '').slice(0, 300),
    omitted: (Array.isArray(raw.omitted) ? raw.omitted : []).slice(0, 8)
      .map(o => ({ source: String(o?.source || ''), reason: String(o?.reason || '').slice(0, 200) }))
      .filter(o => o.source),
    jdAlignment: (Array.isArray(raw.jdAlignment) ? raw.jdAlignment : []).slice(0, 10)
      .map(a => ({
        requirement: String(a?.requirement || '').slice(0, 160),
        coveredBy: String(a?.coveredBy || '').slice(0, 160),
        strength: ['strong', 'weak', 'missing'].includes(a?.strength) ? a.strength : 'weak',
        note: String(a?.note || '').slice(0, 200),
      }))
      .filter(a => a.requirement),
  };
}

export async function composeExperienceLayout({ experience, jobCategory = 'common', careerStage = 'first', jobAnalysis = null }) {
  const prompt = buildExperienceCompositionPrompt({ experience, jobCategory, careerStage, jobAnalysis });
  try {
    const raw = await callProFirst(prompt, 'ComposeExperience');
    return normalizeComposition(parseJSON(raw, /\{[\s\S]*\}/), jobCategory, careerStage);
  } catch (err) {
    console.warn('[ComposeExperience] 구성 생성 실패, 폴백 사용:', err.message);
    return fallbackComposition(jobCategory, careerStage);
  }
}
