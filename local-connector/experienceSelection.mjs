// Shared by the browser and the local scanner. No model call or invented facts.
import { evidenceSentences, hasActionEvidence, hasPersonalEvidence, isFutureEvidence, isPresentDescription, isExperienceTitle, resolveExperienceIdentity, matchExperienceEvidence, sameExperienceFolder, fileNamedTitle, seriesTitle, projectKey } from './experienceEvidence.mjs';
export const CORE_EXPERIENCE_LIMIT = 5;
const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const empty = value => !text(value) || /작성\s*(?:필요|예정)|입력\s*(?:필요|예정)|확인\s*필요|작성해\s*주세요|작성하세요|입력하세요|여기에|예\s*[:：]|tbd|placeholder/i.test(text(value));
const actionVerb = /개발|구현|기획|설계|분석|제작|운영|실행|개선|진행|수행|인터뷰|조사|검증|조율|작성|구축|도입|배포|테스트|출시|제안|설문|결정|선택|수립|정의|정리|개편|합의|실험|조정|협상|대응|해결|교육|편집|촬영|모집|상담|자동화|수정|평가|진단|검토|develop|implement|design|analy[sz]|interview|build|built|creat|launch|test|deliver|manag/i;
const past = /했(?:다|습니다|어요|음|으며|고)|하였|하였다|했었|맡았|만들었|바꿨|줄였|늘렸|배포했|설계함|개발함|구현함|제작함|완료|운영함|작성함|검증함|수행함|진행함|기획함|담당함|주도함|참여함|구축함|\b(?:built|created|developed|implemented|designed|analyzed|analysed|launched|led|managed|delivered|improved|tested)\b/i;
const future = /예정|할\s*계획|계획(?:이다|입니다|중)|해야|하고자|할\s*수\s*있|권장|예를\s*들어|가령|예시|예제|작성하세요|입력하세요|you should|for example|will\s/i;
const outcome = /\d[\d.,]*\s*(?:%|명|건|배|시간|분|초|회|원|위|점|개)|완성|완료|제출|배포|출시|통과|선정|수상|확보|개선|감소|증가|단축|피드백|관찰|확인|검증|테스트|결과물|시제품|프로토타입|문서|대시보드|리포트|반영|승인|채택|합의|정착|체결|개최|해소|회복|재사용|사용자\s*반응|built|shipped|delivered|released|validated|feedback|prototype|dashboard/i;
const learning = /배웠|배운|깨달|알게\s*되|교훈|느꼈|중요성을?\s*확인|다음에는|learned|learnt|realized/i;
const lines = evidenceSentences;
const cleanLabel = value => text(value).replace(/^(?:내\s*)?(?:역할|담당|배경|상황|목표|한\s*일|행동|수행|결과|성과|배운\s*점|회고|role|action|result|learning)\s*[:：]\s*/i, '');
const distinct = rows => [...new Set(rows.map(text).filter(Boolean))];
const performed = value => !empty(value) && hasActionEvidence(value);
const personalRecord = hasPersonalEvidence;
const thirdParty = /^(?:그\s*회사|해당\s*기업|이\s*회사|저자|보고서|그는|그녀는|they\b|the company\b)/i;
// Third-party subjects, general present-tense explanations and passive facts (영화로 제작되었다) are not my actions.
const notMine = line => thirdParty.test(line) || isPresentDescription(line)
  || (/(?:되었|됐)(?:다|습니다)[.!]?$/.test(text(line)) && !/저는|제가|나는|내가|저희|우리/.test(line));

export function localSourceKind(name = '', path = '', content = '') {
  const file = `${name} ${String(path).split(/[\\/]/).at(-1)}`;
  const opening = String(content).slice(0, 1200);
  const templateProduct = /(?:템플릿|template)\s*(?:생성기|generator|builder|플랫폼)/i.test(file);
  if (/(?:^|[\\/])(?:examples?|samples?|templates?|예시|예제|템플릿)(?:[\\/]|$)/i.test(path)
    || (!templateProduct && /(?:^|[\s_\-()[\].])(?:예시|예제|샘플|템플릿|sample|example|template|prompt)(?:$|[\s_\-()[\].\d])/i.test(file))
    || /(?:프롬프트|prompt)[ _-]*(?:\.[a-z]+|$)/i.test(file)
    || /예시\s*답변|가상의?\s*(?:경험|프로젝트)|few.shot|당신은.{0,40}(?:전문가|분석가|AI|코치)/i.test(opening)
    // Prompt slots ({지원 직무}), output instructions and blank-form guides.
    || (opening.match(/\{[^{}\n]{1,20}\}/g) || []).length >= 2 || /(?:출력|답변|응답)\s*형식\s*[:：]|기본\s*양식|작성\s*(?:요령|방법|가이드)/.test(opening)) return 'template';
  const bookMarks = new Set(opening.match(/저자|지은이|출판사|줄거리|작품|소설|도서|책이다|읽고|독후감|서평/g) || []);
  if ((/독후감|서평|독서\s*(?:기록|노트|감상)|book[ _-]*(?:report|review)/i.test(file) || bookMarks.size >= 3) && !/프로젝트|project/i.test(file)) return 'reference';
  if (/릴스|reels?|ASMR|영상[ _-]*대본|발표[ _-]*(?:대본|스크립트)|홍보[ _-]*(?:대본|스크립트)|나레이션|내레이션|shot[ _-]*list|storyboard|보이스오버/i.test(file) && !personalRecord(content)) return 'script';
  if (/student[ _-]*survey|industry[ _-]*report|salary[ _-]*survey|market[ _-]*outlook|NACE|시장[ _-]*조사|시장[ _-]*리포트|벤치마크|참고[ _-]*자료|강의[ _-]*자료|채용[ _-]*공고|레퍼런스|reference|benchmark/i.test(file) && !personalRecord(content)) return 'reference';
  if (/^(?:readme|changelog|license|contributing|api[ _-]*reference)/i.test(name) && /installation|npm\s+install|사용\s*방법|설치\s*방법|라이선스/i.test(opening) && !personalRecord(content)) return 'manual';
  return 'experience';
}

export const SOURCE_KIND_REASON = {
  template: '템플릿·예시·AI 작성 지침은 본인 경험에서 제외했어요.',
  script: '영상·발표 대본은 경험 자체의 기록이 아닌 보조 산출물이에요.',
  reference: '외부 조사·강의·참고자료·독후감은 본인 경험에서 제외했어요.',
  manual: '설치·사용 안내 문서는 경험에서 제외했어요.',
};

export function assessLocalExperience(item, source = {}) {
  const body = String(item.sourceText || '');
  const path = source.path || item.sourcePaths?.[0] || '';
  const kind = localSourceKind(source.name || path.split('/').at(-1), path, body);
  const evidence = { role: '', action: [], result: [], learning: [] };
  const reasons = [];
  if (kind !== 'experience') reasons.push(SOURCE_KIND_REASON[kind]);
  if (!isExperienceTitle(item.title) && !item.needsTitleReview) reasons.push('독립된 프로젝트·활동 이름을 확인하지 못했어요.');

  const original = lines(body);
  const roleLine = original.find(line => /^(?:내\s*)?(?:역할|담당|담당\s*업무|포지션|role)\s*[:：]/i.test(line) && !empty(cleanLabel(line)) && !future.test(line));
  const firstPerson = original.find(line => /(?:^|[\s,.])(?:저는|제가|나는|내가|본인은)|\bI\s+(?:led|built|designed|developed|managed)/i.test(line) && performed(line) && past.test(line));
  evidence.role = !empty(item.role) && !future.test(item.role) ? text(item.role) : roleLine ? cleanLabel(roleLine) : firstPerson || '';
  const attributed = Boolean(evidence.role || firstPerson || personalRecord(body) || item.personalSource);
  const conciseAction = line => !empty(line) && hasActionEvidence(line, true);
  const actionLabel = row => /^(?:한\s*일|행동|수행|주요\s*업무|담당\s*업무|내\s*기여|기여|구현\s*내용|개발\s*내용|action|A)\s*[:：]/i.test(row);
  const actions = lines(item.action).filter(line => !notMine(line) &&((performed(line) && past.test(line))
    || (conciseAction(line) && (attributed || original.some(row => actionLabel(row) && row.includes(line))))));
  const sourceActions = original.filter(line => !/^(?:결과|성과|배운\s*점|역할|배경|상황|문제|과제|목표|role|result|learning|situation|context|task|S|T)\s*[:：]/i.test(line) && !notMine(line)
    && ((performed(line) && past.test(line)) || ((actionLabel(line) || attributed) && conciseAction(line))));
  evidence.action = distinct([...actions, ...sourceActions].map(cleanLabel)).slice(0, 16);
  evidence.result = lines(item.result).filter(line => !empty(line) && text(line).length >= 4 && !/목표|예상|기대|가설/.test(line) && !isFutureEvidence(line)
    && !(isPresentDescription(line) && !/\d/.test(line))).map(cleanLabel).slice(0, 8);
  evidence.learning = lines(item.learning).filter(line => !empty(line) && learning.test(line)
    && (!future.test(line) || /배웠|깨달았|알게\s*되었|learned|learnt|realized/i.test(line))).map(cleanLabel).slice(0, 2);
  const projectRecord = /프로젝트|서비스|공모전|해커톤|인턴|동아리|활동/.test(item.title || '') || item.projectNames?.length;
  const reviewableRecord = projectRecord && (evidence.action.length >= 2 || (evidence.action.length > 0 && evidence.result.length > 0));
  if (!attributed && !original.some(actionLabel) && !reviewableRecord) reasons.push('본인이 맡은 역할·기여를 확인하지 못했어요.');
  if (!evidence.action.length) reasons.push('직접 수행한 구체적인 행동을 확인하지 못했어요.');
  const missing = [item.needsTitleReview && '경험 제목', !evidence.role && '내 역할', !item.context && '상황', !item.task && '과제', !evidence.result.length && '결과'].filter(Boolean);
  const score = (evidence.role ? 25 : 0) + (evidence.action.length ? 35 : 0)
    + (evidence.result.length ? 25 : evidence.learning.length ? 20 : 0)
    + (!empty(item.context) ? 10 : 0) + (evidence.learning.length ? 5 : 0);
  return { eligible: reasons.length === 0, score, reasons, evidence, needsReview: missing.length > 0, missing };
}

const PROJECT_TITLE = /프로젝트|서비스|캠페인|해커톤|플랫폼|앱/;
const projectTitle = title => seriesTitle(title)?.numbered ? seriesTitle(title).base : text(title);

// Strongest evidence first: copies, then project identity or shared content, then a shared project folder.
function evidenceLink(left, right, copies) {
  if (left.separateExperience || right.separateExperience) return null;
  if (copies) return { rank: 0, reason: '같은 본문을 담은 문서 복사본' };
  const matched = matchExperienceEvidence(left, right);
  if (matched) return { rank: 1, reason: matched };
  const folder = sameExperienceFolder(left, right);
  return folder ? { rank: 2, reason: folder } : null;
}

// A project name in the text wins, then a project-like heading, a shared folder, any heading and the file name.
function groupTitle(parts) {
  const names = distinct(parts.flatMap(part => part.projectNames || []));
  if (names.length && new Set(names.map(projectKey)).size === 1) return { title: names[0], titleOrigin: 'source_project_name', needsTitleReview: false };
  const headings = parts.filter(part => isExperienceTitle(part.title) && !fileNamedTitle(part)).map(part => projectTitle(part.title));
  const folders = parts.map(part => part.experienceFolder).filter(Boolean);
  const folder = folders.find(row => folders.filter(other => other.key === row.key).length > 1);
  const files = parts.map(part => projectTitle(part.title)).filter(isExperienceTitle);
  const heading = headings.find(title => PROJECT_TITLE.test(title));
  const [title, titleOrigin] = heading ? [heading, 'source_heading'] : folder ? [folder.name, 'source_folder']
    : headings[0] ? [headings[0], 'source_heading'] : files[0] ? [files[0], 'source_description_or_file'] : [];
  return title ? { title, titleOrigin, needsTitleReview: false } : { title: '경험 제목 확인 필요', titleOrigin: 'needs_review', needsTitleReview: true };
}

// The project spans from its earliest to its latest dated document.
function groupPeriod(parts) {
  const starts = parts.map(part => part.startDate).filter(Boolean).sort();
  if (!starts.length) return {};
  const ongoing = parts.some(part => part.ongoing);
  const latest = [...starts, ...parts.map(part => part.endDate).filter(Boolean)].sort().at(-1);
  const endDate = ongoing || latest === starts[0] ? '' : latest;
  return { startDate: starts[0], endDate, ongoing, period: `${starts[0]}${ongoing ? ' ~ 현재' : endDate ? ` ~ ${endDate}` : ''}` };
}

function buildGroup(parts, reasons) {
  const [first] = parts;
  if (parts.length === 1) return { ...first, localParts: [first], mergeReasons: [] };
  const firstOf = (rows, body) => { const seen = new Set(); return rows.filter(row => { const key = text(body(row)); return !seen.has(key) && seen.add(key); }); };
  const unique = firstOf(parts, part => part.sourceText);
  const group = { ...first, localParts: parts, mergeReasons: distinct(reasons),
    sourcePaths: distinct(parts.flatMap(part => part.sourcePaths || [])),
    localDocuments: firstOf(parts.flatMap(part => part.localDocuments || []), doc => doc.text),
    ...groupTitle(parts), ...groupPeriod(parts) };
  if (unique.length > 1) {
    for (const field of ['role', 'action', 'result', 'learning', 'context', 'task']) group[field] = distinct(unique.flatMap(part => lines(part[field]))).join('\n');
    group.sourceText = unique.map(part => part.sourceText).join('\n\n');
  }
  return group;
}

/**
 * Groups documents into projects. Every pair is compared, links are applied strongest first,
 * and two groups never join when they name different projects (by project name, or by
 * project-like heading when neither has a name), so a chain of weak links cannot bridge projects.
 */
export function consolidateLocalEvidence(candidates) {
  const leaves = [];
  const seen = new Set();
  for (const original of candidates.flatMap(item => item.localParts?.length ? item.localParts : [item])) {
    const { localParts, coreSelection, ...raw } = original;
    const item = resolveExperienceIdentity(raw);
    const signature = `${item.id || ''}\n${(item.sourcePaths || []).join('|')}\n${text(item.sourceText)}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    leaves.push(item);
  }
  const bodies = leaves.map(item => text(item.sourceText));
  const links = [];
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const link = evidenceLink(leaves[i], leaves[j], bodies[i] === bodies[j]);
      if (link) links.push({ ...link, i, j });
    }
  }
  links.sort((a, b) => a.rank - b.rank);
  const parent = leaves.map((_, i) => i);
  const root = i => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const groups = leaves.map(item => ({
    names: new Set((item.projectNames || []).map(projectKey)),
    titles: new Set(isExperienceTitle(item.title) && PROJECT_TITLE.test(item.title) ? [projectKey(item.title)] : []),
    size: item.sourceText.length, reasons: [],
  }));
  for (const link of links) {
    const a = root(link.i), b = root(link.j);
    if (a === b) continue;
    const names = new Set([...groups[a].names, ...groups[b].names]);
    const titles = new Set([...groups[a].titles, ...groups[b].titles]);
    const size = groups[a].size + (bodies[link.i] === bodies[link.j] ? 0 : groups[b].size);
    if (names.size > 1 || (!names.size && titles.size > 1) || size >= 100000) continue;
    parent[b] = a;
    groups[a] = { names, titles, size, reasons: [...groups[a].reasons, ...groups[b].reasons, link.reason] };
  }
  const members = new Map();
  leaves.forEach((item, i) => {
    const key = root(i);
    if (!members.has(key)) members.set(key, []);
    members.get(key).push(item);
  });
  return [...members.entries()].map(([key, parts]) => buildGroup(parts, groups[key].reasons)).map(item => ({ ...item, situation: item.context || '',
    star: { situation: item.context || '', task: item.task || '', action: item.action || '', result: item.result || '' }, coreSelection: assessLocalExperience(item) }));
}

export function rankCoreExperiences(candidates, { consolidated = false } = {}) {
  return (consolidated ? candidates : consolidateLocalEvidence(candidates)).filter(item => item.coreSelection.eligible).map(item => ({ ...item,
    needsReview: Boolean(item.needsReview || item.coreSelection.needsReview),
    role: item.coreSelection.evidence.role,
    action: item.coreSelection.evidence.action.join('\n'), result: item.coreSelection.evidence.result.join('\n'), learning: item.coreSelection.evidence.learning.join('\n'),
  })).sort((a, b) => b.coreSelection.score - a.coreSelection.score || (a.title || '').localeCompare(b.title || '', 'ko'));
}
