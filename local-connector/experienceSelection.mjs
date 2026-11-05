// Shared by the browser and the local scanner. No model call or invented facts.
import { evidenceSentences, hasActionEvidence, hasPersonalEvidence, isFutureEvidence, isPresentDescription, isExperienceTitle, resolveExperienceIdentity, experienceEvidenceLink, sameExperienceFolder, fileNamedTitle, seriesTitle, projectKey } from './experienceEvidence.mjs';
import { experienceTextLines } from './experienceText.mjs';
export const CORE_EXPERIENCE_LIMIT = 5;
const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const empty = value => !text(value) || /작성\s*(?:필요|예정)|입력\s*(?:필요|예정)|확인\s*필요|작성해\s*주세요|작성하세요|입력하세요|여기에|예\s*[:：]|tbd|placeholder/i.test(text(value));
const actionVerb = /개발|구현|기획|설계|분석|제작|운영|실행|개선|진행|수행|인터뷰|조사|검증|조율|작성|구축|도입|배포|테스트|출시|제안|설문|결정|선택|수립|정의|정리|개편|합의|실험|조정|협상|대응|해결|교육|편집|촬영|모집|상담|자동화|수정|평가|진단|검토|develop|implement|design|analy[sz]|interview|build|built|creat|launch|test|deliver|manag/i;
const past = /했(?:다|습니다|어요|음|으며|고)|하였|하였다|했었|맡았|만들었|바꿨|줄였|늘렸|배포했|설계함|개발함|구현함|제작함|완료|운영함|작성함|검증함|수행함|진행함|기획함|담당함|주도함|참여함|구축함|\b(?:built|created|developed|implemented|designed|analyzed|analysed|launched|led|managed|delivered|improved|tested)\b/i;
const future = /예정|할\s*계획|계획(?:이다|입니다|중)|해야|하고자|할\s*수\s*있|권장|예를\s*들어|가령|예시|예제|작성하세요|입력하세요|you should|for example|will\s/i;
const outcome = /\d[\d.,]*\s*(?:%|명|건|배|시간|분|초|회|원|위|점|개)|완성|완료|제출|배포|출시|통과|선정|수상|확보|개선|감소|증가|단축|피드백|관찰|확인|검증|테스트|결과물|시제품|프로토타입|문서|대시보드|리포트|반영|승인|채택|합의|정착|체결|개최|해소|회복|재사용|사용자\s*반응|built|shipped|delivered|released|validated|feedback|prototype|dashboard/i;
const learning = /배웠|배운|깨달|알게\s*되|교훈|느꼈|중요성을?\s*확인|다음에는|learned|learnt|realized/i;
const lines = value => experienceTextLines(value).flatMap(evidenceSentences);
const cleanLabel = value => text(value).replace(/^(?:내\s*)?(?:역할|담당|배경|상황|목표|한\s*일|행동|수행|결과|성과|배운\s*점|회고|role|action|result|learning)\s*[:：]\s*/i, '');
const distinct = rows => [...new Set(rows.map(text).filter(Boolean))];
const performed = value => !empty(value) && hasActionEvidence(value);
const personalRecord = hasPersonalEvidence;
const thirdParty = /^(?:그\s*회사|해당\s*기업|이\s*회사|저자|보고서|그는|그녀는|they\b|the company\b)/i;
// Third-party subjects, general present-tense explanations and passive facts (영화로 제작되었다) are not my actions.
const notMine = line => thirdParty.test(line) || isPresentDescription(line)
  || (/(?:되었|됐)(?:다|습니다)[.!]?$/.test(text(line)) && !/저는|제가|나는|내가|저희|우리/.test(line));

const evidenceKey = value => text(value).normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
const fusionKey = value => text(cleanLabel(value)).normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}.,%+\-]/gu, '').replace(/(?<!\d)[.,]|[.,](?!\d)/g, '');
// Keep original sentences, choosing the fuller source sentence when another is wholly contained.
// Similar subject words or differing numbers are never enough to discard a contribution.
function fusedSentences(rows) {
  const kept = [];
  for (const value of rows) {
    const sentence = text(value);
    const key = fusionKey(sentence);
    if (!key) continue;
    if (kept.some(row => row.key === key || (key.length >= 12 && row.key.includes(key)))) continue;
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      if (kept[i].key.length >= 12 && key.includes(kept[i].key)) kept.splice(i, 1);
    }
    kept.push({ sentence, key });
  }
  return kept.map(row => row.sentence);
}

export function fuseLocalExperienceFields(parts) {
  return Object.fromEntries(['role', 'context', 'task', 'action', 'result', 'learning'].map(field =>
    [field, fusedSentences(parts.flatMap(part => lines(part[field]))).join('\n')]));
}
const rankingStopWords = new Set('저는 제가 나는 내가 우리는 저희 본인 내 우리 팀 팀원 팀장 담당 담당자 역할 기여 업무 작업 내용 경험 프로젝트 서비스 시스템 플랫폼 사용자 고객 문제 해결 결과 성과 상황 배경 과제 목표 한 일 직접 구체적 구체적인 다양한 좋은 훌륭한 많은 큰 새로운 적극적 적극적으로 성공적 성공적으로 열심히 함께 위해 위한 통해 통한 바탕 바탕으로 관련 대한 해당 모든 이를 이것 그것 것 것을 점 것을 여러 가지 진행 수행 참여 개발 구현 기획 설계 분석 제작 운영 개선 작성 정리 검토 확인 테스트 협업 도입 활용 사용 완료 달성 얻음 배움 배운 the a an i we my our me team project service user customer work task role action result results good great successfully various many much'.split(' '));
for (const word of '실행 인터뷰 조사 검증 조율 구축 배포 출시 제안 설문 결정 선택 수립 정의 개편 합의 실험 조정 협상 대응 교육 편집 촬영 모집 상담 자동화 수정 평가 진단 관찰 측정 계획 수치 지표 develop implement design analyze analyse interview build built create launch test deliver manage validate verify improve plan'.split(' ')) rankingStopWords.add(word);
// These predicates recognize a concrete work subject; extra words or repeated verbs
// never add points. A generic "프로젝트를 기획하고 개발했습니다" has no such subject.
function substantiveTerms(value) {
  return new Set((text(value).toLowerCase().match(/[a-z][a-z0-9+#_-]{1,}|[가-힣]{2,}/g) || [])
    .filter(word => !/(?:습니다|합니다|했다|하였다|했어요|했음|했고|하며|하여|하고)$/.test(word))
    .map(word => word.replace(/(?:에서는|에서|으로|에게|들을|들과|을|를|은|는|이|가|의|와|과|로)$/, ''))
    .filter(word => word.length >= 2 && !rankingStopWords.has(word)));
}
const concreteSubject = value => substantiveTerms(value).size >= 2;
const decisionEvidence = /위해|원인|기준|비교|분류|검증|실험|테스트|인터뷰|피드백|우선순위|결정|선택|조율|합의|때문|바탕|로그|분석해|분석하|분석한|관찰|대신|조정|측정|because|compared|validated|interviewed|tested|measured/i;
const actualOutcome = /개선|줄었|줄어|줄였|늘었|늘어|늘렸|감소|증가|단축|상승|하락|해결|해소|없어졌|확보|달성|기록|회복|통과|수상|선정|승인|채택|정착|체결|재사용|배포|출시|완성|사용할|사용했|반영|확인|검증|피드백|합의|개최|연결|완료|해냈|built|shipped|delivered|released|validated|adopted|resolved|reduced|increased|improved|award/i;
const measuredQuantity = /\d[\d.,]*\s*(?:%|퍼센트|명|건|배|시간|분|초|회|원|위|점|개)|\d\s*(?:ms|seconds?|minutes?|hours?|users?)\b/i;
const impactMeasure = /율|률|시간|속도|지연|비용|매출|수익|방문|가입|이용|신청|참여|관객|회원|사용자|고객|불량|오류|대기|문의|누락|전환|재사용|정확|응답|retention|conversion|latency|revenue|cost|users?|\b(?:ROAS|ROI|CVR|CTR)\b/i;
const recordedOutcome = value => actualOutcome.test(value) || (impactMeasure.test(value) && /\d[^.!?\n]{0,16}(?:→|->|\bto\b|에서)[^.!?\n]{0,16}\d/i.test(value));
const vaguePraise = /^(?:좋은|훌륭한|큰|많은|성공적인?|의미\s*있는)\s*(?:성과|결과|경험|도움)|성공적으로\s*(?:완료|마무리)|많은\s*(?:것|점)을?\s*배/i;

function experienceRecommendation(item, evidence, original, eligible) {
  const source = original.map(cleanLabel).map(evidenceKey).join('');
  const backed = value => !empty(value) && source.includes(evidenceKey(cleanLabel(value)));
  const supported = rows => distinct(rows).filter(backed);
  const actions = supported(evidence.action);
  const specificAction = actions.some(concreteSubject);
  const decision = actions.some(line => concreteSubject(line) && decisionEvidence.test(line));
  const results = supported(evidence.result).filter(line => !vaguePraise.test(line));
  const measuredResult = results.some(line => recordedOutcome(line)
    && measuredQuantity.test(line) && impactMeasure.test(line));
  const specificResult = measuredResult || results.some(line => concreteSubject(line) && recordedOutcome(line));
  const narrative = value => lines(value).some(line => backed(line) && concreteSubject(line)
    && !/고\s*싶|입사\s*후|귀사|지원\s*동기|예시|가상의|for example/i.test(line));
  const context = narrative(item.context);
  const task = narrative(item.task);
  const learned = supported(evidence.learning).some(line => !vaguePraise.test(line) && concreteSubject(line));
  const titleValid = isExperienceTitle(item.title) && !item.needsTitleReview;
  const origin = item.titleOrigin || '';
  const titleBacked = titleValid && source.includes(evidenceKey(item.title));
  const namedTitle = titleBacked && (origin === 'source_project_name' || (item.projectNames || []).some(name => evidenceKey(name) === evidenceKey(item.title)));
  const titleScore = !titleValid ? 0 : namedTitle ? 14 : origin === 'source_description' ? 10
    : titleBacked ? 12 : origin === 'source_heading' || origin === 'source_folder' ? 8 : 4;
  let score = titleScore + (backed(evidence.role) ? 6 : 0) + (actions.length ? 6 : 0)
    + (specificAction ? 18 : 0) + (decision ? 6 : 0)
    + (measuredResult ? 28 : specificResult ? 24 : results.length ? 4 : 0)
    + (context ? 8 : 0) + (task ? 8 : 0) + (learned ? 4 : 0);
  if (!titleValid) score = Math.min(score, 49);
  if (!eligible) score = Math.min(score, 29);
  const recommended = eligible && titleValid && specificAction && (specificResult || (decision && context && task)) && score >= 60;
  const reasons = [
    specificAction && '원문에 구체적인 작업 대상과 직접 수행한 행동이 있어요.',
    measuredResult ? '실제로 달라진 수치와 결과를 확인할 수 있어요.' : specificResult && '실제 완성·활용·개선 결과를 원문에서 확인했어요.',
    decision && '문제를 확인하거나 방법을 선택한 과정이 드러나요.',
    context && task && '해결하려던 상황과 과제가 함께 기록되어 있어요.',
    namedTitle && '프로젝트 이름을 원문에서 확인했어요.',
  ].filter(Boolean);
  if (!titleValid) reasons.push('경험을 대표하는 제목은 확인이 필요해요.');
  if (!reasons.length) reasons.push('구체적인 기여와 실제 결과를 더 확인해 주세요.');
  return { recommended, score, reasons };
}

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
  const grouped = item.localParts?.length > 1;
  evidence.action = fusedSentences([...actions, ...sourceActions].map(cleanLabel)).slice(0, grouped ? Infinity : 16);
  evidence.result = lines(item.result).filter(line => !empty(line) && text(line).length >= 4 && !/목표|예상|기대|가설/.test(line) && !isFutureEvidence(line)
    && !(isPresentDescription(line) && !/\d/.test(line))).map(cleanLabel);
  evidence.result = fusedSentences(evidence.result).slice(0, grouped ? Infinity : 8);
  evidence.learning = lines(item.learning).filter(line => !empty(line) && learning.test(line)
    && (!future.test(line) || /배웠|깨달았|알게\s*되었|learned|learnt|realized/i.test(line))).map(cleanLabel);
  evidence.learning = fusedSentences(evidence.learning).slice(0, grouped ? Infinity : 2);
  const projectRecord = /프로젝트|서비스|공모전|해커톤|인턴|동아리|활동/.test(item.title || '') || item.projectNames?.length;
  const reviewableRecord = projectRecord && (evidence.action.length >= 2 || (evidence.action.length > 0 && evidence.result.length > 0));
  if (!attributed && !original.some(actionLabel) && !reviewableRecord) reasons.push('본인이 맡은 역할·기여를 확인하지 못했어요.');
  if (!evidence.action.length) reasons.push('직접 수행한 구체적인 행동을 확인하지 못했어요.');
  const missing = [item.needsTitleReview && '경험 제목', !evidence.role && '내 역할', !item.context && '상황', !item.task && '과제', !evidence.result.length && '결과'].filter(Boolean);
  const eligible = reasons.length === 0;
  const recommendation = experienceRecommendation(item, evidence, original, eligible);
  return { eligible, score: recommendation.score, recommendation, reasons, evidence, needsReview: missing.length > 0, missing };
}

const PROJECT_TITLE = /프로젝트|서비스|캠페인|해커톤|플랫폼|앱/;
const projectTitle = title => seriesTitle(title)?.numbered ? seriesTitle(title).base : text(title);

// Strongest evidence first: copies, then project identity or shared content, then a shared project folder.
function evidenceLink(left, right, copies) {
  if (left.separateExperience || right.separateExperience) return null;
  if (copies) return { rank: 0, type: 'copy', reason: '같은 본문을 담은 문서 복사본' };
  const matched = experienceEvidenceLink(left, right);
  if (matched) return { ...matched, rank: ['identity', 'project'].includes(matched.type) ? 1 : 2 };
  const folder = sameExperienceFolder(left, right);
  return folder ? { rank: 3, type: 'folder', reason: folder } : null;
}

// A project name in the text wins, then a project-like heading, a shared folder, any heading and the file name.
function groupTitle(parts) {
  const names = distinct(parts.flatMap(part => part.projectNames || []));
  // A merged group has already checked every differing explicit name for an approved alias link.
  if (names.length) return { title: names[0], titleOrigin: 'source_project_name', needsTitleReview: false };
  const headings = parts.filter(part => isExperienceTitle(part.title) && !fileNamedTitle(part)
    && !['source_description', 'source_file', 'source_description_or_file'].includes(part.titleOrigin))
    .map(part => ({ title: projectTitle(part.title), titleOrigin: part.titleOrigin || 'source_heading' }));
  const descriptions = parts.filter(part => isExperienceTitle(part.title) && part.titleOrigin === 'source_description');
  const folders = parts.map(part => part.experienceFolder).filter(Boolean);
  const folder = folders.find(row => isExperienceTitle(row.name) && folders.filter(other => other.key === row.key).length > 1);
  const files = parts.filter(part => isExperienceTitle(part.title)).map(part => ({ title: projectTitle(part.title), titleOrigin: part.titleOrigin || 'source_description_or_file' }));
  const heading = headings.find(part => PROJECT_TITLE.test(part.title));
  const selected = heading || (folder ? { title: folder.name, titleOrigin: 'source_folder' } : null) || headings[0] || descriptions[0] || files[0];
  const { title, titleOrigin } = selected || {};
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
    localDocuments: firstOf(parts.flatMap(part => part.localDocuments || []), doc => `${doc.path}\n${doc.text}`),
    ...groupTitle(parts), ...groupPeriod(parts) };
  Object.assign(group, fuseLocalExperienceFields(parts));
  group.sourceText = unique.map(part => part.sourceText).join('\n\n');
  return group;
}

/**
 * Groups documents into projects. Every pair is compared, links are applied strongest first,
 * Named identities are joined first. Content matches must hold across the whole group,
 * so a document with two different experiences cannot connect their unrelated sources.
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
  const pairLinks = leaves.map(() => new Map());
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const copies = bodies[i].length >= 24 && bodies[i] === bodies[j]
        && lines(leaves[i].sourceText).some(line => hasActionEvidence(line, true) || /^(?:성과|결과|result)\s*[:：]\s*\S.{10}/i.test(line));
      const link = evidenceLink(leaves[i], leaves[j], copies);
      if (link) {
        links.push({ ...link, i, j });
        pairLinks[i].set(j, link); pairLinks[j].set(i, link);
      }
    }
  }
  // Canonical tie breaking also makes ambiguous matches independent of scan order.
  const orderKeys = leaves.map(item => `${projectKey(item.title)}\n${(item.sourcePaths || []).join('|')}\n${item.id || ''}`);
  for (const link of links) link.order = [orderKeys[link.i], orderKeys[link.j]].sort().join('\n');
  links.sort((a, b) => a.rank - b.rank || a.order.localeCompare(b.order));
  const parent = leaves.map((_, i) => i);
  const root = i => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const identities = leaves.map(item => ({
    names: new Set((item.projectNames || []).map(projectKey)),
    titles: new Set(isExperienceTitle(item.title) && PROJECT_TITLE.test(item.title)
      && !['source_description', 'source_file', 'source_description_or_file'].includes(item.titleOrigin)
      ? [projectKey(item.title)] : []),
  }));
  const groups = leaves.map((item, i) => ({
    ...identities[i],
    size: String(item.sourceText || '').length, reasons: [], members: [],
  }));
  groups.forEach((group, i) => { group.members = [i]; });
  const conflicting = (i, j) => {
    const a = identities[i], b = identities[j];
    const different = (left, right) => left.size && right.size && new Set([...left, ...right]).size > 1;
    const evidence = pairLinks[i].get(j);
    // Explicit names require a source-written alias. Descriptive headings can differ
    // when their subject and concrete project facts are corroborated by the matcher.
    if (different(a.names, b.names)) return !(evidence?.type === 'identity' || (evidence?.type === 'project' && !evidence.contextual));
    return different(a.titles, b.titles) && !['identity', 'project'].includes(evidence?.type);
  };
  const folderProjects = new Map();
  leaves.forEach((item, i) => {
    const key = item.experienceFolder?.key;
    if (!key) return;
    if (!folderProjects.has(key)) folderProjects.set(key, []);
    folderProjects.get(key).push(i);
  });
  for (const link of links) {
    const a = root(link.i), b = root(link.j);
    if (a === b) continue;
    const names = new Set([...groups[a].names, ...groups[b].names]);
    const titles = new Set([...groups[a].titles, ...groups[b].titles]);
    const size = groups[a].size + (bodies[link.i] === bodies[link.j] ? 0 : groups[b].size);
    if (groups[a].members.some(i => groups[b].members.some(j => conflicting(i, j)))) continue;
    if (size >= 100000 && !['identity', 'project'].includes(link.type)) continue;
    if (link.type === 'content' && !groups[a].members.every(i => groups[b].members.every(j => {
      const evidence = pairLinks[i].get(j);
      return evidence && evidence.type !== 'folder';
    }))) continue;
    const equivalent = (i, j) => {
      const evidence = pairLinks[i].get(j);
      return evidence && (['copy', 'identity'].includes(evidence.type) || (evidence.type === 'project' && !evidence.contextual));
    };
    if (link.contextual) {
      const direct = (i, j) => pairLinks[i].has(j) && pairLinks[i].get(j).type !== 'folder';
      const supported = (i, j) => direct(i, j)
        || groups[a].members.some(k => equivalent(i, k) && direct(k, j))
        || groups[b].members.some(k => equivalent(j, k) && direct(i, k));
      if (!groups[a].members.every(i => groups[b].members.every(j => supported(i, j)))) continue;
    }
    if (link.type === 'folder') {
      const peers = folderProjects.get(leaves[link.i].experienceFolder?.key) || [];
      if (peers.some((i, index) => peers.slice(index + 1).some(j => conflicting(i, j)))) continue;
    }
    if (link.type === 'folder') {
      // A named project excerpt may live in a portfolio outside the project folder.
      // Its identity-equivalent peer can support it, but another weak folder link cannot.
      const supported = (i, j) => pairLinks[i].has(j)
        || groups[a].members.some(k => equivalent(i, k) && pairLinks[k].has(j))
        || groups[b].members.some(k => equivalent(j, k) && pairLinks[k].has(i));
      if (!groups[a].members.every(i => groups[b].members.every(j => supported(i, j)))) continue;
    }
    parent[b] = a;
    groups[a] = { names, titles, size, reasons: [...groups[a].reasons, ...groups[b].reasons, link.reason], members: [...groups[a].members, ...groups[b].members] };
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

// Explicit selection uses the same recommendation order without dropping incomplete
// records or regrouping a split experience. Reassess rather than trusting stale scores.
export function sortLocalExperiences(candidates) {
  const assessed = candidates.map(item => {
    const coreSelection = assessLocalExperience(item);
    return { ...item, coreSelection, recommendation: coreSelection.recommendation };
  });
  const tier = item => item.recommendation.recommended ? 0 : item.coreSelection.eligible
    ? isExperienceTitle(item.title) && !item.needsTitleReview ? 1 : 2 : 3;
  const key = item => `${item.title || ''}\n${(item.sourcePaths || []).join('|')}\n${item.id || ''}`;
  return assessed.sort((a, b) => tier(a) - tier(b) || b.recommendation.score - a.recommendation.score || key(a).localeCompare(key(b), 'ko'));
}

export function rankCoreExperiences(candidates, { consolidated = false } = {}) {
  return sortLocalExperiences(consolidated ? candidates : consolidateLocalEvidence(candidates)).filter(item => item.coreSelection.eligible).map(item => ({ ...item,
    needsReview: Boolean(item.needsReview || item.coreSelection.needsReview),
    role: item.coreSelection.evidence.role,
    action: item.coreSelection.evidence.action.join('\n'), result: item.coreSelection.evidence.result.join('\n'), learning: item.coreSelection.evidence.learning.join('\n'),
  }));
}
