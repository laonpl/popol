// Source-backed identity and sentence evidence. Shared by browser extraction and the connector.
import { experienceTextLines } from './experienceText.mjs';
const compact = value => String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const genericTitle = /^(?:담당|담당했(?:습니다|다)?|했습니다|하였습니다|진행했습니다|참여했습니다|수행했습니다|개발했습니다|구현했습니다|경험|프로젝트|프로젝트명|자기소개(?:서)?|자소서|지원서|지원동기|성장과정|입사후포부|직무역량|직무경험|도전경험|협업경험|성격장단점|문제해결경험|역량기술서|주요경험|경험정리|최종(?:본)?|회고|성과|결과|자료|문서|이력서|포트폴리오|요약|경력|목차|소개|overview|introduction|resume|portfolio|essay|coverletter|statement)$/i;
// Section labels, business categories and tools identify neither a project nor an activity.
// Match the whole label: "B2B 고객 상담 절차 개선" is still a useful title.
const genericLabel = /^(?:b2[bc]|saas|highlights?|points?|daily|marketing|branding|media|appendix(?:key)?|problem|content|google|figma|roas|tvcf|name|value|tensorflow|master|side|experiences?|debate|design|components?|email|firebase|test|notion|export|dart|boolean|contact|about(?:me)?|profile|summary|skills?|education|awards?|projects?|work(?:experience)?|selectedworks?|casestud(?:y|ies)|github|links?|overview|introduction|contents?|index|기획서|보고서|결과보고서|발표자료|회의록|회의메모|메모|기록|개발기록|업무일지|참고자료|주요업무|주요기능|개요|배경|상황|과제|목표|역할|행동|사용기술|기술스택|부록|연락처)\d*$/i;
const sentenceEnding = /(?:습니다|입니다|했습니다|하였다|했다|했음|하였음|했어요|있었다|합니다|됩니다|싶다|싶습니다|담당함|진행함|수행함|구현함|개발함)[.!。]?$/;
const fieldTitle = /^(?:(?:활동|프로젝트|참여|수행|진행|재직|근무|개발)?기간|일정|일자|날짜|직무|담당업무|팀구성|참여인원|핵심지표|핵심역량|타깃|대상|목적|개발환경|구현내용|세부내용|주요내용|인사이트|기여도|duration|period|dates?|team|position|responsibilities|metrics|kpi)$/i;
const roleTitle = /^(?:(?:백엔드|프론트엔드|풀스택|ai|서버|웹|앱|서비스|마케팅|프로덕트|데이터|ui|ux|backend|frontend|fullstack|marketing|product|data|cloud|software))*(?:개발자|개발담당|기획자|기획담당|엔지니어|디자이너|마케터|연구원|팀장|팀원|운영담당|개발|기획|인턴|developer|engineer|designer|manager|intern|pm|po)(?:인턴|intern|캠페인오너)?$/i;
const narrativeTitle = /(?:하여|하며|하고|해서|했고|였고|었고|되어|되고|되며|으로서|로서|고자|하기\s*위해|위하여)[,.]?$/;
const technical = new Set('ai rag llm api ui ux react node nodejs python java javascript typescript sql aws git html css flutter gpt fine tuning json backend frontend 프로젝트 서비스 개발 기획 구현 설계 분석 데이터 시스템 플랫폼 사용자 결과 성과 역할 담당 작업 진행 경험 개선 운영 구현했습니다 개발했습니다 진행했습니다 담당했습니다 활용했습니다 만들었습니다 통해 위한 위한것 기술 기반 대한 해당 이번 이후 프로젝트에서 프로젝트의 서비스를 사용자가 개발을 데이터를 결과를'.split(' '));
for (const word of 'project service platform application team user data results role action context situation task learning overview introduction ownership university hackathon fine-tuning langchain fastapi django spring pytorch openai gemini pinecone'.split(' ')) technical.add(word);
for (const word of '고객 팀원 팀장 팀원들 담당자 업무 내용 주요 직접 구체적인 다양한 협업 회의 일정 피드백 바탕 문제 해결 수행 사용 활용 확인 성과를 역할을 프로젝트를 프로젝트에서 서비스에서 고객을 고객이 자료 통해 함께 위해 있었습니다 했습니다 통해서'.split(' ')) technical.add(word);

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
    && /개발|구현|기획|설계|분석|제작|운영|실행|개선|진행|수행|인터뷰|조사|검증|조율|작성|구축|도입|배포|테스트|출시|제안|설문|결정|선택|수립|정의|정리|개편|합의|실험|조정|협상|대응|해결|교육|편집|촬영|모집|상담|자동화|수정|분리|평가|진단|검토|맡아|만들|책임|담당|주도|개최|develop|implement|design|analy[sz]|interview|built|creat|launch|test|deliver|manag/i.test(value)
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
  return title.length >= 2 && title.length <= 80 && !genericTitle.test(compact(title)) && !genericLabel.test(compact(title))
    && !fieldTitle.test(compact(title)) && !roleTitle.test(compact(title)) && !narrativeTitle.test(title)
    && !/(?:개발자|기획자|디자이너|마케터|엔지니어|담당자|팀원|팀장)(?:로|으로)(?:서)?\s*(?:참여|담당|수행|합류|활동|근무)/.test(title)
    && !technical.has(compact(title)) && !sentenceEnding.test(title)
    && !/확인\s*필요|작성\s*필요|제목\s*(?:없음|미정)|unknown|untitled/i.test(title)
    && !/^(?:저는|제가|나는|내가|우리\s*팀은)\s/.test(title)
    && !/^(?:기간|참여\s*기간|수행\s*기간|직무|팀\s*구성|상황|과제|역할|성과|배경|한\s*일|행동|S|T|A|R)\s*[:：]/i.test(title)
    && !/^(?:(?:활동|프로젝트|참여|수행|진행|재직|근무)?\s*기간|일자|날짜)\s*(?:[·|]|(?:19|20)\d{2})/i.test(title)
    && !/^(?:19|20)\d{2}(?:[.\-/]\d{1,2})?$/.test(title);
}

export function projectNames(value) {
  const body = experienceTextLines(value).join('\n');
  const names = [];
  const add = name => { const title = clean(name).replace(/[()（].*$/, '').replace(/[.!。]+$/, '').trim(); if (isExperienceTitle(title)) names.push(title); };
  for (const match of body.matchAll(/^(?:\s*)(?:프로젝트|서비스|활동|캠페인|제품)(?:명|\s*이름)?\s*[:：]\s*([^\n]+)/gm)) add(match[1]);
  for (const match of body.matchAll(/[「『“"']([^\n「『“"'」』”]{2,60})[」』”"']\s*(?:프로젝트|서비스|플랫폼|앱|시스템|캠페인)/g)) add(match[1]);
  for (const match of body.matchAll(/\b([A-Za-z][A-Za-z0-9_-]{2,30})\s*(?:프로젝트|서비스|플랫폼|앱)(?=[가-힣\s,.]|$)/g)) {
    if (!technical.has(match[1].toLowerCase())) add(match[1]);
  }
  const unique = [...new Set(names)];
  const aliases = writtenAliases(body, unique);
  return unique.filter(name => !aliases.some(([primary, alias]) => projectKey(name) === projectKey(alias)
    && projectKey(primary) !== projectKey(alias)));
}

function filenameTitle(value) {
  return clean(String(value || '').split(/[\\/]/).at(-1)).replace(/\.(?:md|txt|csv|pdf|docx|pptx|hwpx)$/i, '')
    .replace(/[_\- ]*(?:최종본?|수정본?|자기소개서|지원서|직무경험|경험정리|회고|기획서|보고서|결과보고서|발표자료|포트폴리오|v\d+(?:\.\d+)*)(?:[_\- ]*\d+)?$/i, '').trim();
}

// Use a complete noun phrase already written in the source, rather than truncating
// a participation sentence or substituting a file name for the work it describes.
function sourceDescription(body) {
  const source = evidenceSentences(body).filter(line => !isFutureEvidence(line)).join('\n');
  const patterns = [
    /(?=\b((?:AI|LLM|RAG)\s+[A-Za-z가-힣0-9·/\- ]{1,45}?(?:플랫폼|서비스|시스템|프로젝트)))/gi,
    /((?:[A-Za-z가-힣0-9·/\-]+\s+){0,2}(?:신제품|제품|브랜드|서비스)\s*(?:런칭|론칭|출시)[A-Za-z가-힣0-9·/\- ]{0,35}?(?:캠페인|프로젝트))/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const phrase = clean(match[1]).replace(/^(?:저는|제가|나는|내가|이번에?|이후|한\s*일)\s+/, '');
      if (isExperienceTitle(phrase) && !/^(?:AI|LLM|RAG)\s*(?:플랫폼|서비스|시스템|프로젝트)$/i.test(phrase)) return phrase;
    }
  }
  return '';
}

export function resolveExperienceIdentity(item, fallbackTitle = '') {
  const body = experienceTextLines(item.sourceText).join('\n');
  const named = projectNames(body);
  const title = clean(item.title);
  const validTitle = isExperienceTitle(title);
  const inferred = /^(?:source_file|source_description_or_file|source_description|needs_review)$/.test(item.titleOrigin || '');
  let best = named.length === 1 ? named[0] : validTitle && !inferred ? title : '';
  let origin = named.length === 1 ? 'source_project_name' : best ? item.titleOrigin || 'source_heading' : '';
  if (!best) {
    const described = sourceDescription(body);
    if (described) { best = described; origin = 'source_description'; }
    else if (validTitle) { best = title; origin = item.titleOrigin || 'source_heading'; }
    else {
      best = [fallbackTitle, ...(item.sourcePaths || [])].map(filenameTitle).find(isExperienceTitle) || '';
      origin = best ? 'source_file' : 'needs_review';
    }
  }
  return { ...item, title: best || '경험 제목 확인 필요', needsTitleReview: !best,
    projectNames: named, titleOrigin: origin };
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
    .filter(word => !/(?:습니다|합니다|했다|하였다|했어요|했음|했고|하며|하여|하고)$/.test(word))
    .map(word => word.replace(/(?:에서는|에서|으로|에게|하고|하며|했고|했던|하는|하기|라는|이란|들을|하여|을|를|은|는|이|가|의|와|과|로)$/, ''))
    .filter(word => word.length >= 2 && !technical.has(word)));
}
function informative(value) {
  return experienceTextLines(value).flatMap(evidenceSentences).filter(line => line.length >= 20 && !isFutureEvidence(line)
    && !isPresentDescription(line) && !/지원\s*동기|입사\s*후|\[작성|원본에\s*없|저작권|무단\s*복제|copyright|all rights reserved/i.test(line));
}

// Aliases count only when the source explicitly puts the two names together.
// Merely finding two project names in a portfolio must never make them aliases.
function writtenAliases(value, names) {
  const pairs = [];
  const body = experienceTextLines(value).join('\n');
  for (const match of body.matchAll(/(?:프로젝트|서비스|활동|캠페인|제품)(?:명|\s*이름)?\s*[:：]\s*([^\n()（]{2,60})\s*[（(]([^\n)）]{2,40})[)）]/g)) {
    const primary = clean(match[1]), alias = clean(match[2]);
    // Parenthetical dates, technologies and role descriptions are not alternative names.
    if (isExperienceTitle(primary) && isExperienceTitle(alias) && !hasActionEvidence(alias)
      && !/\d{4}|\d\s*(?:인|명|개월)|담당|참여|개발자|기획자|엔지니어/.test(alias)
      && names.some(name => projectKey(name) === projectKey(primary))) pairs.push([primary, alias]);
  }
  return pairs;
}

const contextStop = new Set('한 일 연구자들 교수님들 백엔드 프론트엔드 개발자 기획자 담당 역할 팀원 팀장 해커톤 공모전 동아리 활동 학교 시제품 프로토타입 완성 수상 결과 발표 구현 설계 구축 조정 수정 문서 자료 방법 방식 대상 기준 내용 주요 직접 진행 이틀간 열린 위한 통해 통해서 기반 경우 과정 단위 각각 이후 이번 저는 제가 우리 저희 필요 문제 확인 활용 만들 만드는 연결 연결하는 표시 검색결과 결과에'.split(' '));
function contextWords(value) {
  return new Set([...tokens(value)].map(word => word
    .replace(/(?:들|별|에게|에서는|에서|으로|들을|들의|에)$/, '')
    .replace(/(?:이라는|이란|하려는|하려고|하는|되는)$/, ''))
    .filter(word => word.length >= 2 && !technical.has(word) && !contextStop.has(word) && !genericLabel.test(word) && !fieldTitle.test(word)));
}

function sourceFacts(value) {
  const facts = new Set();
  for (const match of String(value).matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(만|천|억)?\s*(건|명|%|등|위|원|분|초|배)/g)) {
    const amount = Number(match[1].replaceAll(',', '')) * ({ 만: 10000, 천: 1000, 억: 100000000 }[match[2]] || 1);
    facts.add(`${amount}:${match[3]}`);
  }
  return facts;
}

const descriptors = new WeakMap();
function describe(item) {
  const previous = descriptors.get(item);
  if (previous?.source === item.sourceText) return previous;
  const lines = informative(item.sourceText).slice(0, 80);
  const description = { source: item.sourceText, names: projectNames(item.sourceText), body: compact(experienceTextLines(item.sourceText).join('\n')),
    lines, compactLines: lines.map(compact).filter(line => line.length >= 24), words: tokens(lines.join(' ')) }; // only long lines count as common text
  description.aliases = writtenAliases(item.sourceText, description.names);
  description.context = contextWords(lines.join(' '));
  description.facts = sourceFacts(lines.join(' '));
  descriptors.set(item, description);
  return description;
}

// Weekly/round/stage markers in a document name: 1주차, 2회차, 3차, week 4, (2), 중간보고서 ...
// 제3회 같은 대회 회수는 서로 다른 경험이라 제외한다.
const SEQUENCE = /\d{1,3}\s*(?:주\s*차|차시|회\s*차|일\s*차|차|월)|(?:week|wk|part|sprint|round)\s*\.?\s*\d{1,3}|\bw\d{1,2}\b|#\s*\d{1,3}|\(\s*\d{1,3}\s*\)|(?:착수|중간|기말|최종|결과)(?=\s*(?:보고|발표|$))/gi;
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

function projectContextLink(a, b) {
  const shared = [...a.context].filter(word => b.context.has(word));
  // Both sides must substantially describe the same work. This also prevents a
  // summary containing unrelated projects from connecting their separate reports.
  if (shared.length < 6 || shared.length / Math.max(1, a.context.size) < 0.45
    || shared.length / Math.max(1, b.context.size) < 0.45) return null;
  const facts = [...a.facts].filter(fact => b.facts.has(fact));
  const sameDescription = sourceDescription(a.source) && compact(sourceDescription(a.source)) === compact(sourceDescription(b.source));
  if (!facts.length && !(sameDescription && shared.length >= 8)) return null;
  if (!a.lines.some(line => hasActionEvidence(line)) || !b.lines.some(line => hasActionEvidence(line))) return null;
  return { type: 'project', contextual: true, reason: facts.length
    ? '같은 작업 대상·구현 내용과 원문 수치·성과가 일치하는 프로젝트 자료'
    : '같은 프로젝트 설명과 구체적인 작업·대상 내용 일치' };
}

// Return the evidence type as well as its explanation so clustering can keep identity
// matches ahead of content similarity and cannot turn a weak chain into a project.
export function experienceEvidenceLink(left, right) {
  if (left.separateExperience || right.separateExperience) return null;
  if (left.organization && right.organization && compact(left.organization) !== compact(right.organization)) return null;
  const a = describe(left), b = describe(right);
  const aNames = a.names, bNames = b.names;
  if (aNames.length > 1 || bNames.length > 1) return null;
  if (aNames.length && bNames.length) {
    if (projectKey(aNames[0]) !== projectKey(bNames[0])) {
      const keys = [projectKey(aNames[0]), projectKey(bNames[0])];
      const alias = [...a.aliases, ...b.aliases].find(pair => keys.every(key => pair.some(name => projectKey(name) === key)));
      return alias ? { type: 'project', reason: `원문에 함께 표기된 프로젝트 이름 ‘${alias.join(' / ')}’ 일치` } : null;
    }
    return { type: 'identity', reason: `본문의 프로젝트명 ‘${aNames[0]}’ 일치` };
  }
  for (const name of [...aNames, ...bNames]) {
    const key = nameKey(name);
    if (key.length >= 3 && a.body.includes(key) && b.body.includes(key)) return { type: 'identity', reason: `본문의 프로젝트명 ‘${name}’ 일치` };
  }
  const aTitle = nameKey(left.title), bTitle = nameKey(right.title);
  const inferredTitle = item => /^(?:source_file|source_description_or_file)$/.test(item.titleOrigin || '') || fileNamedTitle(item);
  const titleInBoth = a.body.includes(aTitle) && b.body.includes(bTitle);
  if (isExperienceTitle(left.title) && isExperienceTitle(right.title) && aTitle && aTitle === bTitle && aTitle.length >= 4
    && left.titleOrigin !== 'source_description' && right.titleOrigin !== 'source_description'
    && (!(inferredTitle(left) || inferredTitle(right)) || titleInBoth)) {
    return { type: 'identity', reason: '문서에서 확인한 프로젝트 이름 일치' };
  }
  const series = seriesMatch(left, right);
  if (series) return { type: 'identity', reason: `같은 프로젝트 ‘${series}’의 주차·회차 문서` };
  // Reused report templates can have identical body text for different named
  // projects. Actual source headings still need a common subject, and bare
  // project IDs remain different even when every sentence below was copied.
  const protectedHeading = item => !/^(?:source_description|source_file|source_description_or_file|needs_review)$/.test(item.titleOrigin || '')
    && isExperienceTitle(item.title) && /프로젝트|서비스|캠페인|해커톤/.test(item.title);
  if (aTitle !== bTitle && protectedHeading(left) && protectedHeading(right)) {
    const aSubjects = contextWords(left.title), bSubjects = contextWords(right.title);
    const sharedSubject = [...aSubjects].some(word => bSubjects.has(word));
    const aNumber = clean(left.title).match(/^(.*?)\s+(\d+)$/), bNumber = clean(right.title).match(/^(.*?)\s+(\d+)$/);
    if (!sharedSubject || (aNumber && bNumber && compact(aNumber[1]) === compact(bNumber[1]) && aNumber[2] !== bNumber[2])) return null;
  }
  const project = projectContextLink(a, b);
  if (project) return project;
  // Distinct named project headings remain separate even when a template reused the same body.
  if (isExperienceTitle(left.title) && isExperienceTitle(right.title) && aTitle !== bTitle
    && /프로젝트|서비스|캠페인|해커톤/.test(left.title) && /프로젝트|서비스|캠페인|해커톤/.test(right.title)) return null;
  const aTokens = a.words, bTokens = b.words;
  const shared = [...aTokens].filter(word => bTokens.has(word));
  if (shared.length < 5) return null;
  const smaller = Math.min(aTokens.size, bTokens.size);
  const commonLines = a.compactLines.filter(line => b.compactLines.some(other => line.includes(other) || other.includes(line)));
  const commonAction = a.lines.some(line => hasActionEvidence(line) && commonLines.includes(compact(line)));
  // Shared text must describe performed work, and cover both documents. A portfolio
  // containing two different projects is not a copy of either individual report.
  const coverage = item => {
    const total = item.compactLines.reduce((sum, line) => sum + line.length, 0);
    const matched = item.compactLines.filter(line => commonLines.some(other => line.includes(other) || other.includes(line)))
      .reduce((sum, line) => sum + line.length, 0);
    return total ? matched / total : 0;
  };
  if (commonAction && coverage(a) >= 0.6 && coverage(b) >= 0.6
    && ((commonLines.length >= 2) || (shared.length >= 7 && shared.length / Math.max(1, smaller) >= 0.7 && commonLines.length >= 1))) {
    return { type: 'content', reason: `공통 본문 ${commonLines.length}개와 구체적인 작업·대상 내용 일치` };
  }
  return null;
}

export function matchExperienceEvidence(left, right) {
  return experienceEvidenceLink(left, right)?.reason || null;
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
  // A folder can contain unrelated coursework and drafts. Require its name to agree
  // with a source project, or a shared subject in the actual work/outcome sentences.
  const folderKey = projectKey(left.experienceFolder.name);
  const folderProject = [...aNames, ...bNames, left.title, right.title].filter(isExperienceTitle).some(name => {
    const key = projectKey(name);
    return folderKey.length >= 3 && (key === folderKey || key.replace(/(?:서비스|플랫폼|캠페인|앱)$/, '') === folderKey);
  });
  const aWords = describe(left).words, bWords = describe(right).words;
  if (!folderProject && ![...aWords].some(word => bWords.has(word))) return null;
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
