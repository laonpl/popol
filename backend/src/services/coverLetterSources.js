import { createPublicFetchSession, validatePublicUrl } from './publicWebFetch.js';
import { extractPostingQuestions } from './coverLetterEvidence.js';

// A vacancy can list many more roles than the 12 questions allowed in one application.
export const MAX_APPLICATION_LINKS = 64;

const BLOCK_END = /<\/(?:p|div|li|dt|dd|tr|td|th|h[1-6]|section|article|table|label|legend|textarea)>/gi;
const PRIVATE_OR_ARCHIVE = /(?:passassay|passessay|합격\s*자소서|자소서\s*(?:예시|샘플)|interview|banner|advertis|related|recommend)/i;

function decodeEntities(value = '') {
  return String(value).replace(/&#(?:x([a-f\d]+)|(\d+));/gi, (_, hex, number) => {
    const code = parseInt(hex || number, hex ? 16 : 10);
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'");
}

function attr(tag, name) {
  return decodeEntities(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '');
}

/**
 * Next.js pages (JobKorea's detail iframe) ship the posting HTML as an escaped string inside
 * `self.__next_f.push([1,"..."])`. Decode those raw-HTML chunks so the body survives script removal.
 * Only JSON.parse is used; the page's JavaScript is never executed.
 */
function withNextFlightHtml(html) {
  const chunks = [];
  for (const match of String(html || '').matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      const chunk = JSON.parse(match[1]);
      // Rows such as `5:["$",...]` are React tree data; text rows hold the posting markup itself.
      if (!/^[\da-f]+:/i.test(chunk) && /<[a-z][\s\S]*>/i.test(chunk)) chunks.push(chunk);
    } catch { /* Malformed payload: keep the plain HTML. */ }
  }
  return chunks.length ? `${html}\n${chunks.join('\n')}` : html;
}

function withoutScripts(html) {
  return String(html || '').replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)>/gi, '');
}

/** Select balanced elements, including their nested children; stop sidebar material at the actual element boundary. */
function selectElements(html, matches) {
  const tokens = [...html.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)];
  const selected = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (/^<\//.test(token[0]) || !matches(token[0], token[1])) continue;
    const tag = token[1].toLowerCase();
    let depth = 1;
    for (let endIndex = index + 1; endIndex < tokens.length; endIndex += 1) {
      const end = tokens[endIndex];
      if (end[1].toLowerCase() !== tag) continue;
      depth += /^<\//.test(end[0]) ? -1 : /\/>$/.test(end[0]) ? 0 : 1;
      if (depth === 0) {
        selected.push(html.slice(token.index, end.index + end[0].length));
        index = endIndex;
        break;
      }
    }
  }
  return selected;
}

export function postingHtmlToText(html) {
  return decodeEntities(withoutScripts(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<img\b[^>]*>/gi, tag => ` ${attr(tag, 'alt')} `)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span\b[^>]*class=["'][^"']*\bbr\b[^"']*["'][^>]*>/gi, '\n')
    .replace(BLOCK_END, '\n').replace(/<[^>]+>/g, ' '))
    .split(/\n+/).map(line => line.replace(/[\t\r ]+/g, ' ').trim()).filter(Boolean).join('\n');
}

function withoutUnrelatedBlocks(rawHtml, keepHeader = false) {
  let html = withoutScripts(rawHtml);
  const discarded = selectElements(html, (tag, name) => /^(?:nav|footer|aside)$/i.test(name)
    || (!keepHeader && /^header$/i.test(name))
    || PRIVATE_OR_ARCHIVE.test([attr(tag, 'id'), attr(tag, 'class'), attr(tag, 'data-sentry-component')].join(' ')));
  for (const block of discarded) html = html.replace(block, '');
  return html;
}

/** Current job/form content only: archive widgets and global application navigation are not proof of today's questions. */
export function scopePostingHtml(rawHtml, sourceUrl) {
  const html = withoutUnrelatedBlocks(rawHtml);
  const host = new URL(sourceUrl).hostname;
  if (/(^|\.)jobkorea\.co\.kr$/i.test(host)) {
    const sections = selectElements(html, tag => /^(?:atf|recruitment_info|qualification|application_info|company_info)$/.test(attr(tag, 'data-jobview-section'))
      || /^(?:detail-content|secDetailRead|details-section)$/.test(attr(tag, 'id')));
    if (sections.length) return sections.join('\n');
  }
  const main = selectElements(html, (tag, name) => /^(?:main|article)$/i.test(name)
    || /^(?:contents|content|main|detail-content|job-content|job-detail|recruit-detail|view-detail)$/.test(attr(tag, 'id')));
  return main.length ? main.join('\n') : html;
}

function safeUrl(raw, base) {
  if (!String(raw || '').trim()) return '';
  try {
    let url = new URL(decodeEntities(raw), base);
    // JobKorea's public outgoing redirect wraps the employer URL in `home` (the wrapper can be HTTP).
    if (/(^|\.)jobkorea\.co\.kr$/i.test(url.hostname) && /Co_HomePage_Open\.asp$/i.test(url.pathname)) {
      url = new URL(url.searchParams.get('home') || url.searchParams.get('Home') || '');
    }
    return validatePublicUrl(url.href);
  } catch { return ''; }
}

function specificApplication(url) {
  const parsed = new URL(url);
  if ([...parsed.searchParams.keys()].some(key => /^(?:id|rnId|gno|rec_idx|job_id|jobId|recruit_id|employment_id|ec)$/i.test(key))) return true;
  if (/\/(?:resume|login|register|registration|signup|sign-up|join|new|index|create)\/?$/i.test(parsed.pathname)) return false;
  return /\/(?:[\da-f-]{6,}|[^/]{12,})\/?$/i.test(parsed.pathname)
    || /\/(?:apply|application|resume)\/[^/]+/i.test(parsed.pathname)
    || /\/(?:jobs?|recruit|recruitment|apply|application)\/\d+\/?$/i.test(parsed.pathname)
    || /\/(?:recruitment|job|detail)\/[^/]+/i.test(parsed.hash);
}

function applicationAccessFor(html, text) {
  // A public form may also ask for contact details. Real question evidence takes precedence.
  if (extractPostingQuestions(text).length) return 'public';
  const forms = selectElements(withoutScripts(html), (_tag, name) => name.toLowerCase() === 'form');
  for (const form of forms) {
    const formTag = form.match(/^<form\b[^>]*>/i)?.[0] || '';
    const inputs = [...form.matchAll(/<(?:input|select)\b[^>]*>/gi)].map(match => match[0]);
    const hasPassword = inputs.some(input => attr(input, 'type').toLowerCase() === 'password');
    const personalFields = inputs.filter(input => /^(?:name|birthday|birthdate|hp[123]|phone|mobile|email(?:_id|_domain)?)$/i.test(attr(input, 'name')));
    const registrationAction = /(?:^|\/)(?:resumesave|register|registration|signup|sign-up|join)(?:[.?/]|$)/i.test(attr(formTag, 'action'));
    const registrationLabel = /(?:지원자\s*등록|지원서\s*최초\s*등록|회원\s*가입|create\s+(?:an?\s+)?account)/i.test(postingHtmlToText(form));
    if (hasPassword && personalFields.length >= 2 && (registrationAction || registrationLabel)) return 'registration_required';
  }
  return /(?:로그인|본인\s*인증|sign\s*in)/i.test(text) && !/<textarea\b/i.test(html) ? 'login_required' : 'public';
}

export function extractApplicationLinks(html, sourceUrl) {
  const links = [];
  const collect = scoped => {
    for (const match of scoped.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const label = postingHtmlToText(match[2]);
      if (!/(?:지원(?:하기|서|신청)?|입사|apply|application|apply\s*now)/i.test(label)) continue;
      const url = safeUrl(match[1], sourceUrl);
      if (!url || url === sourceUrl || PRIVATE_OR_ARCHIVE.test(url) || !specificApplication(url)) continue;
      // A per-role table row gives the user the actual position, rather than three identical '지원하기' choices.
      const preceding = scoped.slice(0, match.index);
      const rowStart = preceding.lastIndexOf('<tr');
      const rowEnd = preceding.lastIndexOf('</tr');
      const cells = rowStart > rowEnd ? [...preceding.slice(rowStart).matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)] : [];
      const positionLabel = cells.slice(0, 2).map(cell => postingHtmlToText(cell[1]).replace(/\n/g, ' ')).filter(Boolean).join(' · ');
      if (!links.some(link => link.url === url)) links.push({ label: (positionLabel || label).slice(0, 200), url });
    }
  };
  collect(scopePostingHtml(html, sourceUrl));
  // Some employers place the vacancy's apply button in a header or a sibling of main.
  // Only use this fallback when the scoped posting has no link; generic site navigation,
  // archives and recommendation sidebars still cannot supply application candidates.
  if (!links.length) collect(withoutUnrelatedBlocks(html, true));
  return links.slice(0, MAX_APPLICATION_LINKS);
}

function detailUrls(html, sourceUrl) {
  const candidates = [];
  const parsed = new URL(sourceUrl);
  for (const match of html.matchAll(/<iframe\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const url = safeUrl(match[1], sourceUrl);
    if (url && new URL(url).hostname === parsed.hostname && /(?:detail|content|recruit|jobs|view|Ifrm)/i.test(url)) candidates.push(url);
  }
  if (/(^|\.)jobkorea\.co\.kr$/i.test(parsed.hostname)) {
    const id = parsed.searchParams.get('Gno') || parsed.searchParams.get('gno') || parsed.pathname.match(/\/GI_Read\/(\d+)/i)?.[1];
    if (id) candidates.push(`https://www.jobkorea.co.kr/Recruit/GI_Read_Comt_Ifrm?Gno=${encodeURIComponent(id)}`);
  }
  // Saramin sets the detail iframe src from script, so the posting body (and its questions) never appears in the page HTML.
  if (/(^|\.)saramin\.co\.kr$/i.test(parsed.hostname)) {
    const id = parsed.searchParams.get('rec_idx');
    if (/^\d+$/.test(id || '')) candidates.push(`https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=${id}&rec_seq=0`);
  }
  return [...new Set(candidates)].filter(url => url !== sourceUrl).slice(0, 3);
}

function structuredQuestions(value, context = '', depth = 0) {
  if (!value || typeof value !== 'object' || depth > 7) return [];
  if (Array.isArray(value)) return value.flatMap(item => structuredQuestions(item, context, depth + 1));
  if (PRIVATE_OR_ARCHIVE.test(context)) return [];
  const question = value.question || value.question_text || value.prompt;
  if (typeof question === 'string' && /(?:questions?|essays?|cover_?letter|self_?introduction|resume|자기소개|자소서)/i.test(context)) {
    // Numeric API fields aren't literal units. Keep limits only when the provider exposes the unit explicitly.
    const limit = value.max_length || value.maxLength || value.character_limit;
    const unit = value.length_unit || value.limit_unit || value.unit;
    return [`${question}${limit && /^(?:characters?|char|자|글자)$/i.test(unit || '') ? ` (${limit}자 이내)` : ''}`];
  }
  return Object.entries(value).flatMap(([key, child]) => structuredQuestions(child, `${context}.${key}`, depth + 1));
}

const HYDRATION_JOB_KEYS = /^(?:id|rnId|gno|rec_idx|job_?id|recruit_?id|recruitment_?id|posting_?id|employment_company_id|employmentCompanyId|ec)$/i;
const HYDRATION_ROLE_KEYS = /^(?:e|employment_?id|role_?id|position_?id)$/i;
const HYDRATION_JOB_CONTEXT = /^(?:jobs?|postings?|recruits?|recruitments?|vacanc(?:y|ies)|employment_compan(?:y|ies)|employmentCompanies)$/i;
const HYDRATION_ROLE_CONTEXT = /^(?:roles?|positions?|employments?)$/i;
const HYDRATION_APPLICATION_CONTEXT = /^(?:applications?|resumes?|self_?introduction|cover_?letter|essays?)$/i;
const HYDRATION_QUESTION_KEYS = /^(?:(?:application|resume|self_?introduction|cover_?letter|essay)_?questions?)$/i;
const HYDRATION_ARCHIVE = /^(?:archives?|history|historical|past|previous|old|templates?|samples?|examples?|guides?|suggestions?|suggested|recommendations?|recommended|related|interviews?|faqs?)$/i;

function excludedHydrationContext(context) {
  return HYDRATION_ARCHIVE.test(context) || PRIVATE_OR_ARCHIVE.test(context)
    || /^(?:archiv|histor|past|previous|old|template|sample|example|guide|suggest|faq)/i.test(context);
}

function identityValue(value) {
  return (typeof value === 'string' || typeof value === 'number') && String(value).trim().length <= 200
    ? String(value).trim() : '';
}

function hydrationUrlIdentity(rawUrl) {
  const url = new URL(rawUrl);
  const jobs = new Set();
  const roles = new Set();
  for (const [key, value] of url.searchParams) {
    if (HYDRATION_JOB_KEYS.test(key) && value) jobs.add(value);
    else if (HYDRATION_ROLE_KEYS.test(key) && value) roles.add(value);
  }
  const pathId = url.pathname.match(/\/(?:recruit|jobs?|postings?|vacancies|GI_Read|apply|application|resume)\/([^/]+)\/?$/i)?.[1];
  if (pathId) {
    try { jobs.add(decodeURIComponent(pathId)); } catch { jobs.add(pathId); }
  }
  url.searchParams.sort();
  return { jobs, roles, href: url.href, origin: url.origin };
}

function hydrationQuestionLine(value) {
  const row = typeof value === 'string' ? { question: value } : value;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  const rawQuestion = row.question || row.question_text || row.prompt;
  if (typeof rawQuestion !== 'string' || rawQuestion.length > 2200) return '';
  const question = postingHtmlToText(rawQuestion).trim();
  if (!question || question.length > 1600) return '';
  const unit = row.length_unit || row.limit_unit || row.unit;
  const limit = Number(row.max_length ?? row.maxLength ?? row.character_limit);
  const minimum = Number(row.min_length ?? row.minLength);
  const explicitCharacters = /^(?:characters?|char|자|글자)$/i.test(String(unit || ''));
  const explicitBytes = /^(?:bytes?|바이트)$/i.test(String(unit || ''));
  const countSpaces = row.include_space !== false && row.count_spaces !== false && row.countSpaces !== false;
  // Unknown and byte units never become customary character limits.
  const validMaximum = Number.isInteger(limit) && limit >= 1 && limit <= 10000;
  const validMinimum = Number.isInteger(minimum) && minimum >= 1 && minimum <= 10000;
  let suffix = '';
  if (explicitCharacters && (validMaximum || validMinimum) && (!validMaximum || !validMinimum || minimum <= limit)) {
    const length = validMaximum && validMinimum ? `${minimum}~${limit}자` : validMaximum ? `${limit}자 이내` : `${minimum}자 이상`;
    suffix = ` (${length}${countSpaces ? '' : ', 공백 제외'})`;
  } else if (explicitBytes && validMaximum) suffix = ` (${limit}바이트 이내)`;
  return question + suffix;
}

/** Read inert JSON only. An explicit current job identity is required before application questions become proof. */
function hydrationQuestionSection(html, sourceUrl, selectedApplicationUrl = '') {
  const expected = hydrationUrlIdentity(sourceUrl);
  if (!expected.jobs.size && !specificApplication(sourceUrl)) return '';
  if (selectedApplicationUrl) {
    const selected = hydrationUrlIdentity(selectedApplicationUrl);
    if (selected.origin === expected.origin && selected.roles.size
      && (!selected.jobs.size || [...selected.jobs].some(id => expected.jobs.has(id)))) expected.roles = selected.roles;
  }
  const lines = [];
  let visited = 0;
  const addQuestions = value => {
    for (const row of (Array.isArray(value) ? value : [value]).slice(0, 24)) {
      if (row && typeof row === 'object') {
        if (row.isArchived === true || row.is_archived === true || /^(?:archived|past|historical)$/i.test(String(row.status || ''))) continue;
        const jobs = Object.entries(row).filter(([key]) => key !== 'id' && HYDRATION_JOB_KEYS.test(key)).map(([, child]) => identityValue(child)).filter(Boolean);
        const roles = Object.entries(row).filter(([key]) => HYDRATION_ROLE_KEYS.test(key)).map(([, child]) => identityValue(child)).filter(Boolean);
        if (jobs.some(id => !expected.jobs.has(id)) || (roles.length && (!expected.roles.size || roles.some(id => !expected.roles.has(id))))) continue;
      }
      const line = hydrationQuestionLine(row);
      if (line && !lines.includes(line)) lines.push(line);
    }
  };
  const walk = (value, context = '', provenJob = false, applicationContext = false, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 10 || ++visited > 4096 || lines.length >= 12) return;
    if (excludedHydrationContext(context)) return;
    if (Array.isArray(value)) {
      for (const child of value.slice(0, 200)) walk(child, context, provenJob, applicationContext, depth + 1);
      return;
    }
    if (value.isArchived === true || value.is_archived === true || /^(?:archived|past|historical)$/i.test(String(value.status || ''))) return;
    const jobContext = HYDRATION_JOB_CONTEXT.test(context)
      || (Array.isArray(value['@type']) ? value['@type'] : [value['@type']]).includes('JobPosting');
    const roleContext = HYDRATION_ROLE_CONTEXT.test(context);
    const declaredJobs = Object.entries(value).filter(([key]) => key !== 'id' && HYDRATION_JOB_KEYS.test(key))
      .map(([, child]) => identityValue(child)).filter(Boolean);
    if (jobContext && identityValue(value.id)) declaredJobs.push(identityValue(value.id));
    if (jobContext && identityValue(value.identifier?.value)) declaredJobs.push(identityValue(value.identifier.value));
    if (declaredJobs.length) {
      if (!expected.jobs.size || declaredJobs.some(id => !expected.jobs.has(id))) return;
      provenJob = true;
    }
    if (!provenJob && jobContext) {
      const currentUrl = value.url || value.canonicalUrl || value.canonical_url;
      try { provenJob = typeof currentUrl === 'string' && hydrationUrlIdentity(new URL(currentUrl, sourceUrl).href).href === expected.href; } catch { /* Invalid metadata is not identity proof. */ }
    }
    const declaredRoles = Object.entries(value).filter(([key]) => HYDRATION_ROLE_KEYS.test(key))
      .map(([, child]) => identityValue(child)).filter(Boolean);
    if (roleContext && identityValue(value.id)) declaredRoles.push(identityValue(value.id));
    if (roleContext || declaredRoles.length) {
      if (!expected.roles.size || !declaredRoles.length || declaredRoles.some(id => !expected.roles.has(id))) return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (excludedHydrationContext(key)) continue;
      if (provenJob && (HYDRATION_QUESTION_KEYS.test(key) || (applicationContext && /^questions?$/i.test(key)))) addQuestions(child);
      else {
        // Identity does not spread into arbitrary nested company, sidebar, or other-job data.
        const nextApplication = HYDRATION_APPLICATION_CONTEXT.test(key) || (applicationContext && /^(?:forms?|schema)$/i.test(key));
        walk(child, key, provenJob && (nextApplication || HYDRATION_ROLE_CONTEXT.test(key)), nextApplication, depth + 1);
      }
    }
  };
  for (const match of [...String(html || '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].slice(0, 64)) {
    const tag = `<script ${match[1]}>`;
    if (!/^application\/(?:json|ld\+json)$/i.test(attr(tag, 'type')) || match[2].length > 1_000_000) continue;
    try { walk(JSON.parse(match[2])); } catch { /* Never execute JavaScript hydration or repair malformed JSON. */ }
  }
  if (!lines.length) return '';
  const section = `자기소개서 문항\n${lines.slice(0, 12).map((line, index) => /^(?:\d{1,2}[.)]|(?:Q|문항)\s*\d{1,2})\s*/i.test(line) ? line : `${index + 1}. ${line}`).join('\n')}`;
  // Existing literal prompt validation still rejects qualifications and form UI.
  const questions = extractPostingQuestions(section);
  return questions.length ? `[현재 공고의 지원 페이지]\n자기소개서 문항\n${questions.map(question => question.sourceQuote).join('\n')}` : '';
}

function boundedQuestionProof(text, max = 50000) {
  if (text.length <= max) return text;
  const questions = extractPostingQuestions(text);
  // Clipping a long invalid prompt can turn its prefix into a different, apparently valid question.
  // Company/job material remains in text; question proof retains only complete verified excerpts.
  if (!questions.length) return '';
  return `[현재 공고의 지원 페이지]\n자기소개서 문항\n${questions.map(question => question.sourceQuote).join('\n')}`;
}

async function jasoseolSource(url, fetchText) {
  const parsed = new URL(url);
  if (!/(^|\.)jasoseol\.com$/i.test(parsed.hostname)) return null;
  const id = parsed.pathname.match(/\/recruit\/(\d+)/)?.[1] || parsed.searchParams.get('ec') || parsed.searchParams.get('recruit_id');
  if (!/^\d+$/.test(id || '')) return null;
  try {
    const apiUrl = `https://jasoseol.com/api/v1/employment_companies/${id}`;
    const data = JSON.parse(await fetchText(apiUrl, { headers: { Referer: url } }));
    const questions = structuredQuestions({ questions: data.questions, resume_questions: data.resume_questions });
    const text = [data.name ? `기업명: ${data.name}` : '', data.title ? `공고명: ${data.title}` : '',
      data.employments?.length ? `모집 직무: ${data.employments.map(item => item?.field).filter(Boolean).join(', ')}` : '',
      data.content ? postingHtmlToText(scopePostingHtml(data.content, url)) : '',
      questions.length ? `자기소개서 문항\n${questions.map((question, index) => `${index + 1}. ${question}`).join('\n')}` : ''].filter(Boolean).join('\n');
    const applicationUrl = safeUrl(data.employment_page_url || '', url);
    const roles = (Array.isArray(data.employments) ? data.employments : []).filter(item => /^\d+$/.test(String(item.id)) && item.has_resume);
    return { text, apiUrl, officialApplicationUrl: applicationUrl,
      roles,
      applicationLinks: roles.length ? roles.map(role => ({ label: role.field || '지원 직무', url: `https://jasoseol.com/resume_list?ec=${id}&e=${role.id}` }))
        : applicationUrl && specificApplication(applicationUrl) ? [{ label: data.title || '공식 지원 페이지', url: applicationUrl }] : [] };
  } catch { return null; }
}

/** "(주)이마트 채용 - ㈜이마트 27년 신입사원 채용 | 잡코리아" / "[(주)아성테크노] 미디어팀 채용(D-4) - 사람인" → company and posting title. */
export function portalPostingIdentity(pageTitle, sourceUrl) {
  const host = new URL(sourceUrl).hostname;
  const match = /(^|\.)jobkorea\.co\.kr$/i.test(host) ? pageTitle.match(/^(.+?)\s*채용\s*-\s*(.+?)\s*\|\s*잡코리아/)
    : /(^|\.)saramin\.co\.kr$/i.test(host) ? pageTitle.match(/^\[(.+?)\]\s*(.+?)(?:\s*\((?:D-\d+|[^()]*마감|상시[^()]*)\))?\s*-\s*사람인/) : null;
  if (!match) return null;
  const company = match[1].replace(/\(\s*(?:주|유|사|재)\s*\)|㈜|주식회사/g, '').trim();
  return company ? { company, title: match[2].trim() } : null;
}

function titleSimilarity(left, right, names) {
  const normalize = value => names.reduce((text, name) => text.split(name.toLowerCase()).join(''), value.normalize('NFKC').toLowerCase())
    .replace(/\(\s*(?:주|유|사|재)\s*\)|㈜|주식회사/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
  const bigrams = value => { const list = []; for (let i = 0; i < value.length - 1; i += 1) list.push(value.slice(i, i + 2)); return list; };
  const a = bigrams(normalize(left));
  const b = bigrams(normalize(right));
  if (!a.length || !b.length) return 0;
  const pool = [...b];
  let shared = 0;
  for (const gram of a) {
    const index = pool.indexOf(gram);
    if (index >= 0) { shared += 1; pool.splice(index, 1); }
  }
  return (2 * shared) / (a.length + b.length);
}

/**
 * JobKorea/Saramin often link to an employer form that only shows questions after registration.
 * Jasoseol publishes the same open recruitment with per-role questions; match it by company and title.
 * Its search only returns currently open postings, and an ambiguous or dissimilar title is not used.
 */
async function jasoseolCounterpart(identity, fetchText) {
  try {
    const results = JSON.parse(await fetchText(`https://jasoseol.com/api/v1/employment_companies?q=${encodeURIComponent(identity.company)}`));
    const scored = (Array.isArray(results) ? results : []).filter(item => /^\d+$/.test(String(item?.id)))
      .map(item => ({ id: item.id, score: titleSimilarity(identity.title, String(item.title || ''), [identity.company, String(item.name || '')].filter(Boolean)) }))
      .sort((a, b) => b.score - a.score);
    if (!scored.length || scored[0].score < 0.5 || (scored[1] && scored[1].score >= scored[0].score - 0.1)) return null;
    const source = await jasoseolSource(`https://jasoseol.com/recruit/${scored[0].id}`, fetchText);
    return source ? { ...source, counterpart: true } : null;
  } catch { return null; }
}

/** All fetches use the existing public HTTPS/DNS-pinned client. Only links attached to this exact posting can be followed. */
export async function scrapeCoverLetterPosting(rawUrl, options = {}) {
  const sourceUrl = validatePublicUrl(rawUrl);
  // The employer can use an anonymous company/session cookie before exposing its form.
  // This jar exists only for this scrape, never for another user or saved document.
  const fetchText = options.safeFetch || createPublicFetchSession();
  const initialHtml = withNextFlightHtml(await fetchText(sourceUrl));
  const title = postingHtmlToText(initialHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const documents = [{ url: sourceUrl, html: initialHtml }];
  for (const url of detailUrls(initialHtml, sourceUrl)) {
    try { documents.push({ url, html: withNextFlightHtml(await fetchText(url, { headers: { Referer: sourceUrl } })) }); } catch { /* Keep accessible current posting. */ }
  }
  let structured = await jasoseolSource(sourceUrl, fetchText);
  const postingText = documents.map(document => postingHtmlToText(scopePostingHtml(document.html, document.url))).filter(Boolean);
  const hydrationSections = documents.map(document => hydrationQuestionSection(document.html, document.url, options.applicationUrl)).filter(Boolean);
  const identity = !structured && portalPostingIdentity(title, sourceUrl);
  if (identity && !extractPostingQuestions([...hydrationSections, ...postingText].join('\n\n')).length) {
    structured = await jasoseolCounterpart(identity, fetchText);
  }
  const currentText = structured?.counterpart ? [...postingText, `[자소설닷컴에 등록된 같은 공고]\n${structured.text}`]
    : structured?.text ? [structured.text] : postingText;
  currentText.push(...hydrationSections);
  const applicationLinks = [];
  for (const link of [...(structured?.applicationLinks || []), ...documents.flatMap(document => extractApplicationLinks(document.html, document.url))]) {
    if (!applicationLinks.some(existing => existing.url === link.url)) applicationLinks.push(link);
    if (applicationLinks.length >= MAX_APPLICATION_LINKS) break;
  }
  const requested = options.applicationUrl ? validatePublicUrl(options.applicationUrl) : '';
  if (requested && !applicationLinks.some(link => link.url === requested)) {
    const error = new Error('이 공고에 연결된 지원 페이지를 선택해주세요.');
    error.status = 400;
    throw error;
  }
  let applicationUrl = requested || (applicationLinks.length === 1 ? applicationLinks[0].url : '');
  let questionText = hydrationSections.length ? `${hydrationSections.join('\n\n')}\n\n[채용 공고 원문]\n${currentText.join('\n\n')}` : currentText.join('\n\n');
  const sources = documents.slice(1).map((document, index) => ({ id: `posting-detail-${index + 1}`, title: '현재 채용 공고 상세', url: document.url, type: 'posting' }));
  if (structured) sources.push({ id: 'posting-api', title: structured.counterpart ? '자소설닷컴에 등록된 같은 공고' : '현재 공고 문항 API', url: structured.apiUrl, type: 'posting' });
  let applicationAccess = 'unavailable';
  const selectedLink = applicationLinks.find(link => link.url === applicationUrl);
  const selectedRole = selectedLink && structured?.roles.find(role => new URL(selectedLink.url).searchParams.get('e') === String(role.id));
  const selectedPosition = selectedRole?.field || selectedLink?.label || '';
  const roleText = selectedLink ? documents.flatMap(document => selectElements(withoutScripts(document.html), (_tag, name) => name.toLowerCase() === 'tr')
    .filter(row => extractApplicationLinks(row, document.url).some(link => link.url === selectedLink.url))
    .map(postingHtmlToText)) : [];
  if (selectedRole) {
    try {
      // Verified in the provider's public getEmploymentQuestions repository: this POST only reads the selected role's questions.
      const endpoint = 'https://jasoseol.com/employment/employment_question.json';
      const data = JSON.parse(await fetchText(endpoint, { method: 'POST', body: JSON.stringify({ employment_id: selectedRole.id }), headers: { Referer: sourceUrl } }));
      const questions = (Array.isArray(data.employment_question) ? data.employment_question : []).filter(item => typeof item.question === 'string').map(item => {
        const limit = Number(item.total_count);
        const explicitCharacters = item.is_character === true && Number.isInteger(limit) && limit >= 1 && limit <= 10000;
        // A line break inside one prompt would separate it from its own "(최대 700자)" note.
        return `${item.question.trim().replace(/\s*\r?\n\s*/g, ' ')}${explicitCharacters ? ` (${limit}자 이내${item.include_space === false ? ', 공백 제외' : ''})` : ''}`;
      });
      if (questions.length) {
        const section = `[현재 공고의 지원 페이지]\n모집 직무: ${selectedRole.field}\n자기소개서 문항\n${questions.join('\n')}`;
        currentText.push(section);
        questionText = `${section}\n\n[채용 공고 원문]\n${questionText}`;
        applicationAccess = 'public';
        sources.push({ id: 'application-questions-api', title: `${structured.counterpart ? '자소설닷컴 등록 문항 · ' : ''}${selectedRole.field} 지원서 문항`, url: selectedLink.url, type: 'posting' });
      }
    } catch { /* Public access can change. Never substitute another vacancy's questions. */ }
    applicationUrl = structured.officialApplicationUrl || applicationUrl;
  }
  const seen = new Set([sourceUrl]);
  // Follow the chosen role to a role-specific public form, never another role or a login action.
  for (let hop = 0; !selectedRole && applicationUrl && hop < 2 && !seen.has(applicationUrl); hop += 1) {
    seen.add(applicationUrl);
    try {
      const html = withNextFlightHtml(await fetchText(applicationUrl, { headers: { Referer: hop ? [...seen][seen.size - 2] : sourceUrl } }));
      const scoped = scopePostingHtml(html, applicationUrl);
      const hydrationSection = hydrationQuestionSection(html, applicationUrl, requested);
      const plainText = postingHtmlToText(scoped);
      const text = hydrationSection ? `${hydrationSection}\n\n[채용 공고 원문]\n${plainText}` : plainText;
      if (text) {
        currentText.push(`[현재 공고의 지원 페이지]\n${text}`);
        roleText.push(text);
        questionText = `[현재 공고의 지원 페이지]\n${text}\n\n[채용 공고 원문]\n${questionText}`;
        sources.push({ id: `application-${hop + 1}`, title: selectedLink?.label || '현재 공고의 지원서', url: applicationUrl, type: 'posting' });
        applicationAccess = applicationAccessFor(scoped, text);
      }
      const next = extractApplicationLinks(scoped, applicationUrl).filter(link => new URL(link.url).origin === new URL(applicationUrl).origin && !seen.has(link.url));
      if (next.length !== 1) break;
      applicationUrl = next[0].url;
    } catch { applicationAccess = 'unavailable'; break; }
  }
  const text = [title ? `[페이지 제목] ${title}` : '', selectedPosition ? `[선택한 지원 직무]\n모집 직무: ${selectedPosition}` : '', ...currentText].filter(Boolean).join('\n\n').slice(0, 30000);
  if (text.length < 100 && !(structured?.text && applicationLinks.length)) {
    const error = new Error('공고 원문을 읽지 못했습니다. 공고 내용을 직접 붙여넣어주세요.');
    error.status = 422;
    throw error;
  }
  return { text, questionText: boundedQuestionProof(questionText), applicationUrl, applicationLinks, applicationAccess, sources, selectedPosition, roleSourceText: roleText.join('\n\n').slice(0, 30000),
    ...(structured?.counterpart ? { questionOrigin: 'jasoseol_counterpart' } : {}),
    questionStatus: applicationLinks.length > 1 && !requested ? 'selection_required' : 'unavailable' };
}
