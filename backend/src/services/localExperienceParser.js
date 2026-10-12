/**
 * AI 없이 이력서·포트폴리오 텍스트를 경험 단위로 나누고 필드를 채우는 규칙 기반 파서.
 *
 * - 원문 문장을 옮겨 담기만 한다(재작성·추정 없음). 없는 내용은 빈 문자열.
 * - 결과는 AI 구조화(resume)와 같은 원시 형태라 normalizeResumeExperiences를 그대로 탄다.
 * - confident=false면 문서를 경험 단위로 나누지 못한 것 — 호출부가 AI를 쓸지 판단한다.
 */
import { CAREER_FIELD_PROFILES } from '../prompts/careerFieldProfiles.js';

const DATE = String.raw`((?:19|20)\d{2})\s*(?:[.\-/년]\s*(\d{1,2})\s*월?\.?)?`;
const RANGE_RE = new RegExp(`${DATE}\\s*(?:~|-|–|—|～|to)\\s*(?:${DATE}|(현재|진행\\s*중|재직\\s*중|present|now))?`, 'i');
const MONTH_RE = /((?:19|20)\d{2})\s*[.\-/년]\s*(\d{1,2})\s*월?/;
const DURATION_RE = /[·|(]?\s*\d+\s*(?:개월|주|일|년|months?|weeks?)\s*\)?/gi;
const SENTENCE_END = /(?:[다요음함됨]|니다)\s*[.!]?$|[.!?]$/;
const BULLET_RE = /^(?:[•\-▪◦●○■□▶►✓✔*·]|\d{1,2}[.)])\s*/;
const ROLE_LINE = /인턴|intern|manager|engineer|developer|designer|planner|analyst|리더|팀장|개발자|기획자|디자이너|마케터|\bP[MO]\b/i;
const NUMBERED_HEADING_RE = /^(?:0?\d{1,2}[.)]|\[\d{1,2}\]|#\d{1,2}|(?:project|프로젝트)\s*\d{1,2}[.:)]?)\s*(.{2,50})$/i;

const INCLUDE_SECTIONS = new Set(['경력', '경험', '프로젝트', '활동', '대외활동', '인턴', '인턴십', '동아리', '연구', '공모전', '주요경험', '주요프로젝트', '업무경험', '직무경험', '경력사항', '프로젝트경험', 'experience', 'experiences', 'projects', 'project', 'work', 'career', 'employment', 'activities', 'research', 'internship']);
const EXCLUDE_SECTIONS = new Set(['학력', '교육', '학력사항', '교육사항', '보유기술', '기술', '기술스택', '스킬', '자격', '자격증', '수상', '수상내역', '수상경력', '어학', '외국어', '연락처', '자기소개', '소개', '인적사항', '목차', '병역', '취미', '관심사', '기타', 'education', 'skills', 'skill', 'certificates', 'certificate', 'certifications', 'awards', 'award', 'languages', 'language', 'contact', 'about', 'profile', 'contents', 'interests', 'summary', 'tools']);

const LABEL_RE = /^(역할|담당|포지션|role|배경|문제|목표|상황|과제|과정|수행|한\s*일|주요\s*업무|업무|내용|결과|성과|실적|배운\s*점|느낀\s*점|회고|교훈|사용\s*기술|기술\s*스택|기술|tools?|stack|소속|기관)\s*[:：]\s*(.+)$/i;
const LABEL_FIELD = [
  [/^(역할|담당|포지션|role)/i, 'role'],
  [/^(배경|문제|목표|상황|과제)/, 'context'],
  [/^(과정|수행|한\s*일|주요\s*업무|업무|내용)/, 'action'],
  [/^(결과|성과|실적)/, 'result'],
  [/^(배운\s*점|느낀\s*점|회고|교훈)/, 'learning'],
  [/^(사용\s*기술|기술\s*스택|기술|tools?|stack)/i, 'keywords'],
  [/^(소속|기관)/, 'organization'],
];

const RESULT_NUM = /\d[\d,.]*\s*(?:%|％|배|명|건|원|만|천|억|위|점|시간|분|초|ms|회|개|pp|x)/i;
const RESULT_VERB = /(달성|개선|증가|감소|상승|하락|단축|절감|향상|확보|높였|높이|낮췄|낮추|늘렸|줄였|줄이|기록했|확인했|검증했|돌파|성장)/;
const AWARD = /(수상|선정|입상|최우수|대상|우수상|1위|채택|선발)/;
const LEARNING = /(배웠|배운|깨달|느꼈|느낀|교훈|알게\s*되|회고|다음에는|앞으로는|중요성|아쉬)/;
const CONTEXT = /(위해|문제|불편|어려움|이탈|부족|필요성|필요했|배경|번거|원인|한계|목표로|불안|복잡)/;
const ACTION_END = /(기획|개발|구현|설계|분석|제안|진행|운영|담당|구축|도입|정리|제작|만들|작성|수행|주도|참여|조사|리딩|기여|개선)\S*\s*[.!]?$/;

const CATEGORY_RULES = [
  [/(인턴|intern)/i, '인턴십'],
  [/(공모전|해커톤|hackathon|경진대회|대회|챌린지|competition)/i, '공모전'],
  [/(동아리|club)/i, '동아리'],
  [/(서포터즈|봉사|대외활동|기자단|홍보대사|앰배서더|volunteer)/i, '대외활동'],
  [/(연구|논문|학술|연구실|research|paper)/i, '학업·연구'],
  [/(재직|정규직|계약직|주식회사|\(주\)|㈜)/i, '직무경험'],
  [/(프로젝트|project|mvp|서비스|앱|app|웹|web|개발|기획|팀)/i, '프로젝트'],
];

const METHOD_TERMS = ['사용자 인터뷰', 'A/B 테스트', '프로토타입', '사용성 테스트', '설문', '데이터 분석', '퍼널', '온보딩', '와이어프레임', '대시보드', '리서치', '크롤링', '정책 설계'];
const LATIN_STOP = new Set(['the', 'and', 'of', 'to', 'in', 'for', 'with', 'on', 'at', 'by', 'team', 'intern', 'manager', 'planner', 'analyst']);
const SUBHEADINGS = /^(역할|담당|배경|문제|목표|상황|과제|과정|수행|한 일|주요 업무|업무|내용|결과|성과|실적|배운 점|느낀 점|회고|교훈|기술 스택|사용 기술|소속|기관)$/;

const norm = s => s.replace(/\s+/g, '');

function sectionKind(line) {
  const compact = norm(line);
  if (!compact || compact.length > 40 || MONTH_RE.test(line)) return null;
  const pieces = compact.split(/[·&,/|]|및/).flatMap(t => t.match(/[가-힣]+|[A-Za-z]+/g) || []);
  if (pieces.length === 0) return null;
  const lower = pieces.map(p => p.toLowerCase());
  if (!lower.every(p => INCLUDE_SECTIONS.has(p) || EXCLUDE_SECTIONS.has(p))) return null;
  return lower.some(p => INCLUDE_SECTIONS.has(p)) ? 'include' : 'exclude';
}

const ym = (year, month) => `${year}-${String(Math.min(Math.max(Number(month) || 1, 1), 12)).padStart(2, '0')}`;

function parseDates(line) {
  const range = line.match(RANGE_RE);
  if (range && (range[3] || range[5])) {
    return {
      match: range[0],
      startDate: ym(range[1], range[2]),
      endDate: range[3] ? ym(range[3], range[4]) : '',
      ongoing: Boolean(range[5]),
    };
  }
  const single = line.match(MONTH_RE);
  return single ? { match: single[0], startDate: ym(single[1], single[2]), endDate: '', ongoing: false } : null;
}

function cleanTitle(text) {
  return text.replace(DURATION_RE, ' ').replace(BULLET_RE, '').replace(/[\s|·\-–—~,()[\]]+$/, '').replace(/^[\s|·\-–—~,]+/, '').replace(/\s+/g, ' ').trim();
}

/* 날짜가 붙은 짧은 줄 = 경험 제목 줄. 날짜만 있는 줄이면 바로 윗줄을 제목으로 본다. */
function dateHeading(lines, i) {
  const line = lines[i];
  const dates = parseDates(line);
  if (!dates || line.length > 100 || SENTENCE_END.test(line.replace(dates.match, '').trim())) return null;
  const title = cleanTitle(line.replace(dates.match, ' '));
  if (title.length >= 2 && title.length <= 60) return { start: i, dateLine: i, title, dates };
  const prev = lines[i - 1];
  if (title.length < 2 && prev && prev.length <= 60 && !SENTENCE_END.test(prev) && !parseDates(prev) && !sectionKind(prev)) {
    return { start: i - 1, dateLine: i, title: cleanTitle(prev), dates };
  }
  return null;
}

function toSentences(lines) {
  const units = [];
  let sectionLabel = '';
  let newSection = false;
  for (const line of lines) {
    const heading = line.replace(/^#{1,6}\s*/, '').replace(/[:：]$/, '').trim();
    if (SUBHEADINGS.test(heading)) {
      sectionLabel = heading;
      newSection = true;
      continue;
    }
    if (heading === '검증과 회고') { sectionLabel = '회고'; newSection = true; continue; }
    if (heading === '프로젝트 기록' || heading === '프로젝트 개요') continue;
    const prev = units[units.length - 1];
    if (newSection || BULLET_RE.test(line) || LABEL_RE.test(line) || !prev || prev.labeled || SENTENCE_END.test(prev.text) || prev.text.length <= 20) {
      units.push({ text: line.replace(BULLET_RE, ''), labeled: LABEL_RE.test(line), sectionLabel });
      newSection = false;
    } else {
      prev.text += ` ${line}`; // PDF 줄바꿈으로 끊긴 문장 잇기
    }
  }
  return units.flatMap(u => (u.labeled ? [u.text] : u.text.split(/(?<=[.!?])\s+(?=\S)/).map(s => u.sectionLabel ? `${u.sectionLabel}: ${s}` : s))).map(s => s.trim()).filter(Boolean);
}

function classify(sentence) {
  if (LEARNING.test(sentence)) return 'learning';
  if ((RESULT_VERB.test(sentence) && RESULT_NUM.test(sentence)) || AWARD.test(sentence)) return 'result';
  if (CONTEXT.test(sentence) && !ACTION_END.test(sentence)) return 'context';
  return 'action';
}

function aliasHit(text, alias) {
  if (/^[a-z&\s]+$/i.test(alias)) return new RegExp(`(?<![a-z])${alias.replace(/&/g, '\\&')}(?![a-z])`, 'i').test(text);
  return text.includes(alias);
}

function guessJobCategory(headText, bodyText) {
  let best = 'common';
  let bestScore = 0;
  for (const [key, profile] of Object.entries(CAREER_FIELD_PROFILES)) {
    if (key === 'common') continue;
    let score = 0;
    for (const alias of profile.aliases) {
      if (aliasHit(headText, alias)) score += 3;
      if (aliasHit(bodyText, alias)) score += 1;
    }
    if (score > bestScore) { best = key; bestScore = score; }
  }
  return best;
}

function extractKeywords(text, labeled) {
  const found = [...labeled];
  for (const term of METHOD_TERMS) if (text.includes(term)) found.push(term);
  for (const token of text.match(/[A-Za-z][A-Za-z0-9+#./-]*[A-Za-z0-9+#]/g) || []) {
    if (!LATIN_STOP.has(token.toLowerCase()) && !found.some(f => f.includes(token))) found.push(token);
  }
  const seen = new Set();
  return found.filter(k => { const key = k.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 6);
}

/* 제목 줄 아래 본문 줄들을 경험 하나의 필드로 나눈다. */
export function analyzeBlock(title, bodyLines, { dates = null, startsWith = '' } = {}) {
  const fields = { role: [], context: [], action: [], result: [], learning: [], organization: [] };
  const labeledKeywords = [];
  let body = bodyLines;
  // 제목 바로 아래 문장이 아닌 짧은 줄은 "Product Manager · 6인 팀" 같은 역할 줄
  if (body[0] && body[0].length <= 50 && ROLE_LINE.test(body[0]) && !SENTENCE_END.test(body[0]) && !LABEL_RE.test(body[0]) && body.length > 1) {
    fields.role.push(body[0]);
    body = body.slice(1);
  }
  for (const sentence of toSentences(body)) {
    const label = sentence.match(LABEL_RE);
    if (label) {
      const field = LABEL_FIELD.find(([re]) => re.test(label[1]))?.[1];
      if (field === 'keywords') labeledKeywords.push(...label[2].split(/[,·/]/).map(s => s.trim()).filter(Boolean));
      else fields[field].push(label[2].trim());
      continue;
    }
    fields[classify(sentence)].push(sentence);
  }
  const bodyText = bodyLines.join(' ');
  const headText = `${title} ${fields.role.join(' ')}`;
  const join = list => list.join(' ').trim();
  return {
    title,
    organization: join(fields.organization),
    startDate: dates?.startDate || '',
    endDate: dates?.endDate || '',
    ongoing: dates?.ongoing || false,
    category: CATEGORY_RULES.find(([re]) => re.test(`${headText} ${bodyText}`))?.[1] || '기타',
    jobCategory: guessJobCategory(headText, bodyText),
    role: join(fields.role),
    context: join(fields.context),
    action: join(fields.action),
    result: join(fields.result),
    learning: join(fields.learning),
    keywords: extractKeywords(`${title} ${body.join(' ')}`, labeledKeywords),
    startsWith,
    sourceText: [startsWith || title, ...bodyLines].join('\n'),
  };
}

export function toLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\t/g, ' ').trim())
    .filter(line => line && !/^--\s*\d+\s*of\s*\d+\s*--$/i.test(line) && !/^\[(슬라이드|시트)\s*\d+\]$/.test(line));
}

const bodyLength = lines => lines.join('').replace(/\s/g, '').length;

function numberedHeading(line) {
  const match = line.match(NUMBERED_HEADING_RE);
  if (!match || SENTENCE_END.test(line)) return null;
  // 단순 작업 순서(1. 퍼널 분석)를 별도 프로젝트로 나누지 않는다.
  if (!/^(?:0\d[.)]|\[|#|project|프로젝트)/i.test(line) && !/(프로젝트|서비스|앱|project|app)/i.test(match[1])) return null;
  return cleanTitle(match[1]);
}

/**
 * @returns {{ experiences: object[], confident: boolean }}
 */
export function parseExperiencesLocally(text, fallbackTitle = '') {
  const lines = toLines(text);
  const headings = [];
  const excluded = new Set();
  let section = null;
  lines.forEach((line, i) => {
    const kind = sectionKind(line);
    if (kind) { section = kind; excluded.add(i); return; }
    if (section === 'exclude') { excluded.add(i); return; }
    const heading = dateHeading(lines, i);
    if (heading && !excluded.has(heading.start)) {
      const existing = headings.findIndex(h => h.start === heading.start);
      if (existing >= 0) headings[existing] = heading;
      else headings.push(heading);
    } else {
      const title = numberedHeading(line);
      if (title) headings.push({ start: i, dateLine: i, title, dates: null });
    }
  });

  const uncertainHeading = lines.some((line, i) => i > 0 && !excluded.has(i)
    && !headings.some(h => h.start === i || h.dateLine === i)
    && line.length <= 60 && !/[.!?]/.test(line) && !SENTENCE_END.test(line) && !LABEL_RE.test(line)
    && !SUBHEADINGS.test(line) && !ROLE_LINE.test(line) && !BULLET_RE.test(line)
    && !RESULT_NUM.test(line) && !parseDates(line)
    && !['검증과 회고', '프로젝트 기록', '프로젝트 개요'].includes(line)
    && (lines[i + 1]?.length > 20 || ROLE_LINE.test(lines[i + 1] || '')));

  const blocks = headings.map((h, idx) => {
    const end = headings[idx + 1]?.start ?? lines.length;
    const first = h.dateLine + 1;
    const sectionEnd = lines.findIndex((_, j) => j >= first && j < end && excluded.has(j));
    const body = lines.slice(first, sectionEnd < 0 ? end : sectionEnd);
    return { ...h, body };
  }).filter(b => bodyLength(b.body) >= 20); // 수상·자격 한 줄짜리는 경험이 아니다

  if (blocks.length > 0) {
    return { confident: !uncertainHeading && blocks.length === headings.length, experiences: blocks.map(b => ({
      ...analyzeBlock(b.title, b.body, { dates: b.dates, startsWith: lines[b.start] }),
      sourceText: [...lines.slice(b.start, b.dateLine + 1), ...b.body].join('\n'),
    })) };
  }

  const included = lines.filter((_, i) => !excluded.has(i));

  // 나눌 단서가 없으면 문서 전체를 경험 하나로 본다. 긴 문서면 여러 경험이 섞였을 수 있어 확신하지 않는다.
  if (bodyLength(included) < 20) return { confident: false, experiences: [] };
  const firstLine = included[0];
  const useFirst = firstLine.length <= 40 && !SENTENCE_END.test(firstLine) && !LABEL_RE.test(firstLine);
  const title = useFirst ? cleanTitle(firstLine) : (fallbackTitle || cleanTitle(firstLine.slice(0, 40)));
  return {
    confident: !uncertainHeading && headings.length === 0 && bodyLength(included) <= 3000 && (useFirst || Boolean(fallbackTitle)),
    experiences: [analyzeBlock(title, useFirst ? included.slice(1) : included, { dates: parseDates(included.join('\n')), startsWith: firstLine })],
  };
}
