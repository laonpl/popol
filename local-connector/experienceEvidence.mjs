// Source-backed identity and sentence evidence. Shared by browser extraction and the connector.
const compact = value => String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const genericTitle = /^(?:담당|담당했(?:습니다|다)?|했습니다|하였습니다|진행했습니다|참여했습니다|수행했습니다|개발했습니다|구현했습니다|경험|프로젝트|프로젝트명|자기소개(?:서)?|자소서|지원서|지원동기|성장과정|입사후포부|직무역량|직무경험|도전경험|협업경험|성격장단점|문제해결경험|역량기술서|주요경험|경험정리|최종(?:본)?|회고|성과|결과|자료|문서|이력서|포트폴리오|요약|경력|목차|소개|overview|introduction|resume|portfolio|essay|coverletter|statement)$/i;
const sentenceEnding = /(?:습니다|입니다|했습니다|하였다|했다|했음|하였음|했어요|있었다|합니다|됩니다|싶다|싶습니다|담당함|진행함|수행함|구현함|개발함)[.!。]?$/;
const technical = new Set('ai rag llm api ui ux react node nodejs python java javascript typescript sql aws git html css flutter gpt fine tuning json backend frontend 프로젝트 서비스 개발 기획 구현 설계 분석 데이터 시스템 플랫폼 사용자 결과 성과 역할 담당 작업 진행 경험 개선 운영 구현했습니다 개발했습니다 진행했습니다 담당했습니다 활용했습니다 만들었습니다 통해 위한 위한것 기술 기반 대한 해당 이번 이후 프로젝트에서 프로젝트의 서비스를 사용자가 개발을 데이터를 결과를'.split(' '));
for (const word of 'project service platform application team user data results role action context situation task learning overview introduction ownership university hackathon fine-tuning langchain fastapi django spring pytorch openai gemini pinecone'.split(' ')) technical.add(word);

export function evidenceSentences(value) {
  return String(value || '').split(/\n|(?<=[.!?。])\s+(?=[가-힣A-Za-z\[])/).map(line => line
    .replace(/^(?:[•\-*·]|\d+[.)])\s*/, '').replace(/\[(?:XYZ|STAR|CARL)[^\]]*\]|【(?:XYZ|STAR|CARL)[^】]*】/gi, '')
    .replace(/\([XYZ]\)/g, '').trim()).filter(Boolean);
}

export function isFutureEvidence(value) {
  return /고\s*싶|할\s*(?:예정|계획|것)|(?:예정|계획)(?:입니다|이다|이었)|하겠습니다|(?:개발|구현|구축|운영)하겠|해야\s*(?:했|할|합)|하고자|기대\s*(?:효과|성과)|지원하|귀사|입사\s*후|you should|for example|\bwill\s/i.test(value)
    && !/(?:실제로|하지만|그러나|반면|이후).{0,100}(?:구현했|개발했|진행했|완료했|배포했|만들었)/.test(value);
}

export function hasActionEvidence(value, concise = false) {
  return clean(value).length >= (concise ? 5 : 10)
    && /개발|구현|기획|설계|분석|제작|운영|실행|개선|진행|수행|인터뷰|조사|검증|조율|작성|구축|도입|배포|테스트|출시|제안|설문|결정|선택|수립|정의|정리|개편|합의|실험|조정|협상|대응|해결|교육|편집|촬영|모집|상담|자동화|수정|평가|진단|검토|맡아|만들|책임|담당|주도|개최|develop|implement|design|analy[sz]|interview|built|creat|launch|test|deliver|manag/i.test(value)
    && !isFutureEvidence(value)
    && !/(?:하지\s*못했|하지\s*않았|실행\s*전|아직\s*미수행)[^.!?]*(?:[.!?]|$)/.test(value);
}

// A plain present-tense description (힘쓴다, 중요하다, 책이다, 진행합니다) explains something; it is not a past action.
export function isPresentDescription(value) {
  const line = clean(value).replace(/[.!。]+$/, '');
  if (!line.endsWith('다')) return false;
  const past = char => char !== '있' && char >= '가' && char <= '힣' && (char.charCodeAt(0) - 0xac00) % 28 === 20; // ㅆ 받침
  if (line.endsWith('습니다')) return !past(line.at(-4));
  if (line.endsWith('니다')) return true; // 합니다·됩니다·입니다
  return !past(line.at(-2));
}

export function hasPersonalEvidence(value) {
  return evidenceSentences(value).some(line => /(?:저는|제가|나는|내가|저희|우리\s*팀|본인은)|\bI\s+(?:led|built|designed|developed|managed)/i.test(line) && hasActionEvidence(line))
    || /^(?:내\s*)?(?:역할|기여|담당|담당\s*업무|내가\s*한\s*일|구현\s*내용|개발\s*내용|role)\s*[:：]\s*\S+/im.test(value);
}

export function isExperienceTitle(value) {
  const raw = clean(value);
  const title = raw.replace(/^\d+[.)]\s*/, '').replace(/^[\[({]|[\])}.!。]+$/g, '');
  // Template slots ({프로젝트명}), menu paths (생산관리>품질관리), cut-off fragments (.16 ~ 2026-05.17, 언어의).
  if (/[{}]|[>›»]|O{3}|○{3}|X{3}/.test(raw) || /^[•·▪◦●○■□▶►✓✔*\-.~,:;]/.test(raw)) return false;
  if ((title.match(/\p{L}/gu) || []).length < 2 || /^[가-힣]{1,6}(?:의|을|를|에서|으로|에게)$/.test(title)) return false;
  return title.length >= 2 && title.length <= 80 && !genericTitle.test(compact(title)) && !sentenceEnding.test(title)
    && !/확인\s*필요|작성\s*필요|제목\s*(?:없음|미정)|unknown|untitled/i.test(title)
    && !/^(?:저는|제가|나는|내가|우리\s*팀은)\s/.test(title)
    && !/^(?:상황|과제|역할|성과|배경|한\s*일|행동|S|T|A|R)\s*[:：]/i.test(title)
    && !/^(?:19|20)\d{2}(?:[.\-/]\d{1,2})?$/.test(title);
}

export function projectNames(value) {
  const names = [];
  const add = name => { const title = clean(name).replace(/[()（].*$/, '').replace(/[.!。]+$/, ''); if (isExperienceTitle(title)) names.push(title); };
  for (const match of String(value || '').matchAll(/^(?:\s*)(?:프로젝트|서비스|활동|캠페인|제품)(?:명|\s*이름)?\s*[:：]\s*([^\n]+)/gm)) add(match[1]);
  for (const match of String(value || '').matchAll(/[「『“"']([^\n「『“"'」』”]{2,60})[」』”"']\s*(?:프로젝트|서비스|플랫폼|앱|시스템|캠페인)/g)) add(match[1]);
  for (const match of String(value || '').matchAll(/\b([A-Za-z][A-Za-z0-9_-]{2,30})\s*(?:프로젝트|서비스|플랫폼|앱)(?=[가-힣\s,.]|$)/g)) {
    if (!technical.has(match[1].toLowerCase())) add(match[1]);
  }
  return [...new Set(names)];
}

function filenameTitle(value) {
  return clean(String(value || '').split(/[\\/]/).at(-1)).replace(/\.(?:md|txt|csv|pdf|docx|pptx|hwpx)$/i, '')
    .replace(/[_\- ]*(?:최종본?|수정본?|자기소개서|지원서|직무경험|경험정리|회고|기획서|보고서|결과보고서|발표자료|포트폴리오|v\d+(?:\.\d+)*)(?:[_\- ]*\d+)?$/i, '').trim();
}

export function resolveExperienceIdentity(item, fallbackTitle = '') {
  const body = String(item.sourceText || '');
  const named = projectNames(body);
  const title = clean(item.title);
  let best = named.length === 1 ? named[0] : isExperienceTitle(title) ? title : '';
  if (!best) {
    const described = body.match(/\b(?:AI|LLM|RAG)\s+[A-Za-z가-힣0-9·\- ]{1,35}(?:플랫폼|서비스|시스템|프로젝트)/i)?.[0];
    best = described || [fallbackTitle, ...(item.sourcePaths || [])].map(filenameTitle).find(isExperienceTitle) || '';
  }
  return { ...item, title: best || '경험 제목 확인 필요', needsTitleReview: !best,
    projectNames: named, titleOrigin: named.length === 1 ? 'source_project_name' : best === title ? 'source_heading' : best ? 'source_description_or_file' : 'needs_review' };
}

// Locations, collections and work-type subfolders do not name one experience.
const genericFolder = /^(?:바탕화면|desktop|documents?|downloads?|다운로드|문서|내문서|내파일|onedrive|새폴더\d*|newfolder\d*|취업|취준|구직|대학|학교|수업|강의|과제|공부|스터디|개인|업무|회사|백업|backup|기타|etc|misc|첨부(?:파일)?|사진|이미지|images?|img|assets?|docs?|참고(?:자료)?|references?|발표(?:자료)?|보고서|기획서?|디자인|design|개발|dev|src|산출물|제출용?|final|old|archive|보관|임시|temp|projects?|공모전|대외활동|동아리|인턴|회의록|\d학년(?:\d학기)?|\d학기|(?:19|20)\d{2}년?(?:\d학기|상반기|하반기)?)$/;
const collectionFolder = /자소서|자기소개서|이력서|지원서|포트폴리오|경험정리|resume|portfolio|coverletter/;

// The nearest specific folder below the scan root, e.g. 바탕화면/포트폴리오/쇼핑몰 프로젝트/발표/a.pptx → 쇼핑몰 프로젝트.
export function experienceFolder(path) {
  const parts = String(path || '').split(/[\\/]/).filter(Boolean);
  for (let index = parts.length - 2; index >= 1; index -= 1) {
    const name = clean(parts[index]);
    const key = compact(name);
    if (collectionFolder.test(key)) return null;
    if (isExperienceTitle(name) && !genericFolder.test(key)) return { key: parts.slice(0, index + 1).join('/'), name };
  }
  return null;
}

function nameKey(value) {
  return compact(filenameTitle(value).replace(/\s*프로젝트$/, ''));
}

// One key for every document of a project: 'xx 프로젝트 2주차', 'xx 프로젝트 회고' and 'xx 프로젝트' share 'xx'.
export function projectKey(title) {
  const base = filenameTitle(title);
  return nameKey(seriesTitle(base)?.base || base);
}
function tokens(value) {
  return new Set((String(value || '').toLowerCase().match(/[a-z][a-z0-9_-]{2,}|[가-힣]{2,}/g) || [])
    .map(word => word.replace(/(?:에서는|에서|으로|에게|하고|하며|했고|했던|하는|하기|라는|이란|들을|하여|을|를|은|는|이|가|의|와|과|로)$/, ''))
    .filter(word => word.length >= 2 && !technical.has(word)));
}
function informative(value) {
  return evidenceSentences(value).filter(line => line.length >= 20 && !isFutureEvidence(line) && !/지원\s*동기|입사\s*후|\[작성|원본에\s*없/.test(line));
}

const descriptors = new WeakMap();
function describe(item) {
  const previous = descriptors.get(item);
  if (previous?.source === item.sourceText) return previous;
  const lines = informative(item.sourceText).slice(0, 80);
  const description = { source: item.sourceText, names: projectNames(item.sourceText), body: compact(item.sourceText),
    lines, compactLines: lines.map(compact).filter(line => line.length >= 24), words: tokens(lines.join(' ')) }; // only long lines count as common text
  descriptors.set(item, description);
  return description;
}

// Weekly/round/stage markers in a document name: 1주차, 2회차, 3차, week 4, (2), 중간보고서 ...
// 제3회 같은 대회 회수는 서로 다른 경험이라 제외한다.
const SEQUENCE = /\d{1,3}\s*(?:주\s*차|차시|회\s*차|일\s*차|차|월)|(?:week|wk|part|sprint|round)\s*\.?\s*\d{1,3}|\bw\d{1,2}\b|#\s*\d{1,3}|\(\s*\d{1,3}\s*\)|(?:착수|중간|기말|최종|결과)(?=\s*(?:보고|발표|$))|[_\-\s]\d{1,2}$/gi;
const SERIES_SUFFIX = /(?:\s*(?:보고서|보고|발표\s*자료|발표|회의록|회의|일지|기록|리포트|report|정리|자료|문서|초안|수정본?|최종본?|v\d+(?:\.\d+)*))+$/i;
const genericSeries = /^(?:주간|월간|일일|주간업무|업무|회의|과제|수업|강의|실습|활동|팀|개인|스터디|daily|weekly|monthly|meeting|lab|homework|assignment)$/;

// "xx 보고서 2주차" → { base: 'xx', numbered: true }. A series base must still name a project.
export function seriesTitle(value) {
  const name = clean(String(value || '').split(/[\/]/).at(-1).replace(/\.(?:md|txt|csv|pdf|docx|pptx|hwpx)$/i, ''));
  const stripped = name.replace(SEQUENCE, ' ');
  const base = clean(stripped.replace(/[_\-·|,()[\]]+/g, ' ')).replace(SERIES_SUFFIX, '').trim();
  const key = compact(base);
  if (key.length < 2 || !isExperienceTitle(base) || genericSeries.test(key) || collectionFolder.test(key)) return null;
  return { base, key, numbered: stripped !== name };
}

// Whole-document file names count; a resume's parts share one file name, so only their headings count.
const seriesNames = new WeakMap();
function seriesMatch(left, right) {
  const names = item => {
    if (!seriesNames.has(item)) seriesNames.set(item, [item.title, ...(item.wholeDocument ? item.sourcePaths || [] : [])].map(seriesTitle).filter(Boolean));
    return seriesNames.get(item);
  };
  const bNames = names(right);
  for (const a of names(left)) {
    const b = bNames.find(row => row.key === a.key && (a.numbered || row.numbered));
    if (b) return a.base;
  }
  return null;
}

export function matchExperienceEvidence(left, right) {
  if (left.separateExperience || right.separateExperience) return null;
  if (left.organization && right.organization && compact(left.organization) !== compact(right.organization)) return null;
  const a = describe(left), b = describe(right);
  const aNames = a.names, bNames = b.names;
  if (aNames.length > 1 || bNames.length > 1) return null;
  if (aNames.length && bNames.length && nameKey(aNames[0]) !== nameKey(bNames[0])) return null;
  for (const name of [...aNames, ...bNames]) {
    const key = nameKey(name);
    if (key.length >= 3 && a.body.includes(key) && b.body.includes(key)) return `본문의 프로젝트명 ‘${name}’ 일치`;
  }
  const aTitle = nameKey(left.title), bTitle = nameKey(right.title);
  if (isExperienceTitle(left.title) && isExperienceTitle(right.title) && aTitle && aTitle === bTitle && aTitle.length >= 4) return '문서에서 확인한 프로젝트 이름 일치';
  const series = seriesMatch(left, right);
  if (series) return `같은 프로젝트 ‘${series}’의 주차·회차 문서`;
  // Distinct named project headings remain separate even when a template reused the same body.
  if (isExperienceTitle(left.title) && isExperienceTitle(right.title) && aTitle !== bTitle
    && /프로젝트|서비스|캠페인|해커톤/.test(left.title) && /프로젝트|서비스|캠페인|해커톤/.test(right.title)) return null;
  const aTokens = a.words, bTokens = b.words;
  const shared = [...aTokens].filter(word => bTokens.has(word));
  if (shared.length < 5) return null; // every rule below needs five shared words
  const smaller = Math.min(aTokens.size, bTokens.size);
  const commonLines = a.compactLines.filter(line => b.compactLines.some(other => line.includes(other) || other.includes(line)));
  if ((commonLines.length >= 2 && shared.length >= 5) || (shared.length >= 7 && shared.length / Math.max(1, smaller) >= 0.7 && commonLines.length >= 1)) {
    return `공통 본문 ${Math.max(1, commonLines.length)}개와 구체적인 작업·대상 내용 일치`;
  }
  // A distinctive non-technical name in both documents plus domain evidence can join an essay and a report.
  const names = (String(left.sourceText).replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ').match(/\b[A-Za-z][A-Za-z0-9_-]{3,30}\b/g) || [])
    .filter(word => !technical.has(word.toLowerCase()) && !/^(?:situation|action|result|task|context|learning|ownership|fine|tuning|retrieval|augmented|generation|https?|html?|blog|naver|tistory|youtube)$/i.test(word));
  const commonName = names.find(name => new RegExp(`\\b${name}\\b`, 'i').test(right.sourceText));
  return commonName && shared.length >= 5 ? `본문의 고유 이름 ‘${commonName}’와 작업 내용 일치` : null;
}

// Single-experience documents in one project folder are one experience unless they name different projects.
export function sameExperienceFolder(left, right) {
  if (!left.experienceFolder || left.experienceFolder.key !== right.experienceFolder?.key) return null;
  if (left.separateExperience || right.separateExperience) return null;
  if (left.organization && right.organization && compact(left.organization) !== compact(right.organization)) return null;
  const aNames = describe(left).names, bNames = describe(right).names;
  if (aNames.length > 1 || bNames.length > 1 || (aNames.length && bNames.length && nameKey(aNames[0]) !== nameKey(bNames[0]))) return null;
  const project = /프로젝트|서비스|캠페인|해커톤/;
  if (isExperienceTitle(left.title) && isExperienceTitle(right.title) && project.test(left.title) && project.test(right.title)
    && nameKey(left.title) !== nameKey(right.title)) return null;
  return `같은 폴더 ‘${left.experienceFolder.name}’의 자료`;
}

// A title that only repeats a file name (기획서.docx → 기획서) is replaced by the project folder's name.
export function fileNamedTitle(item) {
  const title = compact(item.title);
  return Boolean(item.needsTitleReview) || (item.sourcePaths || []).some(path => {
    const name = String(path).split(/[\\/]/).at(-1);
    return title === compact(name.replace(/\.[^.]+$/, '')) || title === compact(filenameTitle(name));
  });
}
