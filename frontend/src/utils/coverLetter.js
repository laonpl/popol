import { coverLetterQuestionFocus, questionFocusWords } from '../../../shared/coverLetterQuestionFocus.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' ? value : '';
const strings = values => (Array.isArray(values) ? values : []).filter(value => typeof value === 'string' && value.trim());

/** Firestore and the REST proxy both reject undefined values in nested drafts. */
export function stripUndefined(value) {
  if (Array.isArray(value)) return value.filter(item => item !== undefined).map(stripUndefined);
  if (isObject(value) && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefined(item)]));
  }
  return value;
}

/** Count Unicode code points; treat Windows and browser line breaks alike. */
export function countCharacters(value, countSpaces = true) {
  const normalized = String(value ?? '').replace(/\r\n?/g, '\n');
  return Array.from(countSpaces ? normalized : normalized.replace(/\s/gu, '')).length;
}

function normalizeLimit(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? Math.floor(number) : null;
}

export function normalizeQuestions(values = []) {
  if (!Array.isArray(values)) return [];
  const usedIds = new Set();
  return values.filter(value => typeof value === 'string' || isObject(value)).map((value, index) => {
    const item = typeof value === 'string' ? { question: value, source: 'manual' } : value;
    const baseId = text(item.id) || `question-${index + 1}`;
    let id = baseId;
    let duplicate = 2;
    while (usedIds.has(id)) id = `${baseId}-${duplicate++}`;
    usedIds.add(id);
    return stripUndefined({
      ...item,
      id,
      question: text(item.question || item.text),
      maxLength: normalizeLimit(item.maxLength),
      minLength: normalizeLimit(item.minLength),
      countSpaces: item.countSpaces !== false,
      source: ['posting', 'suggested', 'manual'].includes(item.source) ? item.source : 'manual',
      sourceQuote: text(item.sourceQuote),
      answer: text(item.answer),
      linkedExperienceIds: [...new Set(strings(item.linkedExperienceIds))],
    });
  });
}

export function normalizeAnalysis(result = {}) {
  const item = isObject(result?.analysis) ? result.analysis : (isObject(result) ? result : {});
  const questions = normalizeQuestions(item.questions);
  return stripUndefined({
    ...item,
    company: text(item.company),
    position: text(item.position),
    summary: text(item.summary),
    business: text(item.business),
    rolePriorities: strings(item.rolePriorities),
    companyInsights: (Array.isArray(item.companyInsights) ? item.companyInsights : [])
      .filter(isObject).map(insight => ({ text: text(insight.text), sourceId: text(insight.sourceId), sourceQuote: text(insight.sourceQuote) })),
    writingPoints: strings(item.writingPoints),
    sources: (Array.isArray(item.sources) ? item.sources : []).filter(isObject).map((source, index) => ({
      id: text(source.id) || `source-${index + 1}`,
      title: text(source.title),
      url: text(source.url),
      type: source.type === 'research' ? 'research' : 'posting',
    })),
    uncertainties: strings(item.uncertainties),
    questions,
    questionStatus: ['verified', 'selection_required', 'unavailable'].includes(item.questionStatus)
      ? item.questionStatus
      : (questions.some(question => question.source === 'posting' && question.validation !== 'unverified') ? 'verified' : 'unavailable'),
    questionNotice: text(item.questionNotice),
    applicationLinks: (Array.isArray(item.applicationLinks) ? item.applicationLinks : [])
      .filter(isObject).map(link => ({ label: text(link.label), url: text(link.url) })).filter(link => link.url),
    applicationUrl: text(item.applicationUrl),
    selectedApplicationUrl: text(item.selectedApplicationUrl),
    applicationAccess: ['public', 'connected', 'login_required', 'registration_required', 'unavailable'].includes(item.applicationAccess) ? item.applicationAccess : 'unavailable',
    sourceInputText: text(item.sourceInputText),
    questionSourceText: text(item.questionSourceText),
    sourceText: text(item.sourceText),
    sourceUrl: text(item.sourceUrl),
  });
}

export function normalizeCoverLetter(value = {}) {
  const item = isObject(value) ? value : {};
  const analysis = item.analysis ? normalizeAnalysis(item.analysis) : null;
  return stripUndefined({
    ...item,
    title: text(item.title) || '새 자기소개서',
    targetCompany: text(item.targetCompany) || analysis?.company || '',
    targetPosition: text(item.targetPosition) || analysis?.position || '',
    sourceUrl: text(item.sourceUrl) || analysis?.sourceUrl || '',
    sourceText: text(item.sourceText) || analysis?.sourceText || '',
    sourceInputText: item.sourceInputText !== undefined ? text(item.sourceInputText) : analysis?.sourceInputText || '',
    analysis,
    questions: normalizeQuestions(item.questions ?? analysis?.questions),
    style: ['plain', 'story', 'concise'].includes(item.style) ? item.style : 'plain',
    voiceSample: text(item.voiceSample),
    additionalContext: text(item.additionalContext),
    status: text(item.status) || 'draft',
  });
}

/** Merge a generated answer without replacing the user's edited prompt or limits. */
export function normalizeGeneratedAnswer(result = {}, question = {}) {
  result = typeof result === 'string' || isObject(result) ? result : {};
  const normalizedQuestion = normalizeQuestions([question])[0];
  const answer = typeof result === 'string' ? result : text(result.answer);
  const charCount = countCharacters(answer, normalizedQuestion.countSpaces);
  return stripUndefined({
    ...normalizedQuestion,
    answer,
    linkedExperienceIds: Array.isArray(result.linkedExperienceIds)
      ? [...new Set(strings(result.linkedExperienceIds))]
      : normalizedQuestion.linkedExperienceIds,
    evidence: (Array.isArray(result.evidence) ? result.evidence : []).filter(isObject)
      .map(item => ({ experienceId: text(item.experienceId), quote: text(item.quote) }))
      .filter(item => item.experienceId && item.quote),
    warnings: strings(result.warnings),
    review: {
      ...(isObject(result.review) ? result.review : {}),
      charCount,
      withinLimit: (!normalizedQuestion.maxLength || charCount <= normalizedQuestion.maxLength)
        && (!normalizedQuestion.minLength || charCount >= normalizedQuestion.minLength),
      unverifiedNumbers: strings(result.review?.unverifiedNumbers),
    },
  });
}

export function normalizeGeneratedAnswers(result = {}, questions = []) {
  result = typeof result === 'string' || isObject(result) || Array.isArray(result) ? result : {};
  const normalized = normalizeQuestions(questions);
  if (typeof result === 'string' || typeof result.answer === 'string') {
    return normalized.map((question, index) => index === 0 ? normalizeGeneratedAnswer(result, question) : question);
  }
  const answers = Array.isArray(result) ? result : (Array.isArray(result.answers) ? result.answers : []);
  return normalized.map(question => {
    const answer = answers.find(item => item?.id === question.id || item?.questionId === question.id);
    return answer ? normalizeGeneratedAnswer(answer, question) : question;
  });
}

const STOPWORDS = new Set(['경험', '본인', '자신', '관련', '작성', '기술', '설명', '지원', '동기', '직무', '기업', '회사', '업무', '수행', '역할', '필수', '우대', '조건', '사항', '담당', '주요', '담당업무', '주요업무', '업무수행', '역량', '능력', '대해', '대하여', '통해', '위해', '하는', '있는', '했던', '주세요', '구체적으로', '사례', '바탕', '이내', '이상', '배운', '경험한', '자기소개서']);
function keywords(value) {
  return [...new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}+#]+/gu) || [])]
    .map(word => word.replace(/(으로|에서|에게|하고|하며|이며|했던|하는|했는지|하세요|해주세요|해주십시오|과|와|을|를|은|는|이|가|의)$/u, ''))
    .filter(word => word.length > 1 && !/^\d+$/u.test(word) && !STOPWORDS.has(word));
}

const GENERATED_SOURCE = /핵심\s*경험|인터뷰\s*구조화|AI\s*(?:초안|추론|분석)|작성\s*가이드|^(?:structuredResult|aiAnalysis|keywords|competencyTags|questions?|prompt|suggestions?)$/i;
const SOURCE_LABELS = { action: '직접 입력한 행동', problem: '직접 입력한 문제 상황', context: '직접 입력한 배경', situation: '직접 입력한 상황', role: '직접 입력한 역할', result: '직접 입력한 결과', learning: '직접 입력한 배운 점', rawInput: '경험 원문', intro: '직접 입력한 경험' };

function sourceSections(value, label) {
  const raw = text(value).slice(0, 60000);
  const headings = [...raw.matchAll(/^(?:-{3,}|={3,})[ \t]*(.+?)[ \t]*(?:-{3,}|={3,})[ \t]*\r?$/gm)];
  const sections = headings.length ? [
    { label, body: raw.slice(0, headings[0].index) },
    ...headings.map((heading, index) => ({ label: heading[1].trim(), body: raw.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? raw.length) })),
  ] : [{ label, body: raw }];
  return sections.filter(section => !GENERATED_SOURCE.test(section.label)).flatMap(section => section.body.split(/\n+/)
    .map(line => line.trim()).filter(line => line && !/^(?:Q\.|질문\s*[:：]|https?:|data:)/i.test(line))
    .map(line => ({ sourceLabel: section.label, text: line.replace(/^→\s*/, '') }))
    .filter(record => record.text.length >= 8 && !/(?:직접\s*읽지\s*못|내용을?\s*(?:확인|불러오|읽)지\s*못|접근\s*불가)/.test(record.text)));
}

function contentSources(value, label = '직접 입력한 경험', depth = 0) {
  if (depth > 6) return [];
  if (typeof value === 'string') return sourceSections(value, label);
  if (Array.isArray(value)) return value.slice(0, 40).flatMap(item => contentSources(item, label, depth + 1));
  if (!isObject(value)) return [];
  return Object.entries(value).filter(([key]) => !GENERATED_SOURCE.test(key) && !/^(?:id|userId|url|images?|createdAt|updatedAt|assetId|sourceRef|status|type|jobCategory|careerStage|framework|question)$/i.test(key))
    .flatMap(([key, item]) => contentSources(item, SOURCE_LABELS[key] || (/[가-힣]|\.[a-z\d]{2,6}$/i.test(key) ? key : '직접 입력한 경험'), depth + 1));
}

/** Original material and the applicant's answers only; titles, tags and AI summaries are not evidence. */
export function experienceSourceRecords(experience = {}) {
  const raw = text(experience.content?.rawInput) || text(experience.rawInput) || text(experience.structuredResult?.rawInput);
  const records = raw ? sourceSections(raw, '경험 원문') : contentSources(experience.content);
  records.push(...(Array.isArray(experience.followupAnswers) ? experience.followupAnswers : []).flatMap(item => sourceSections(item?.answer, '추가 질문에 직접 답한 내용')));
  return [...new Map(records.map(record => [record.text, record])).values()].slice(0, 150);
}

const QUESTION_PURPOSES = [
  { label: '협업·조율', prompt: /협업|협력|팀워크|팀원|팀과|갈등|의견\s*차|이견|소통|조율/, strong: /협업|협력|조율|합의|의견|소통|갈등|이견/g, support: /함께|공유|동료|담당자|팀원/g },
  { label: '사용자·고객 조사', prompt: /인터뷰|사용자\s*조사|고객\s*조사|설문|voc/i, strong: /인터뷰|설문|voc|고객\s*문의|사용자\s*조사|고객\s*조사/gi, support: /관찰|사용자|고객/g },
  { label: '문제 해결·개선', prompt: /문제|해결|개선/, strong: /해결|개선|수정|원인|오류|검증|테스트/g, support: /문제|분석|비교/g },
  { label: '어려움과 재시도', prompt: /실패|실수|좌절|어려움|어려웠|극복/, strong: /실패|실수|좌절|어려|재시도|중단|극복|다시\s*시도/g, support: /오류|수정|문제/g },
  { label: '주도한 역할', prompt: /리더십|리더|이끌|주도|책임/, strong: /주도|이끌|팀장|리더|총괄|책임/g, support: /주도|이끌|팀장|리더|총괄|책임/g },
  { label: '판단과 선택', prompt: /판단|의사\s*결정|우선\s*순위|선택|결정/, strong: /판단|결정|선택|우선\s*순위|기준/g, support: /비교|검토|대안/g },
  { label: '배움과 성장', prompt: /배운|성장|교훈|깨달|학습/, strong: /배웠|배운|깨달|학습|연습|회고|교훈/g, support: /수정|다음|다시/g },
];

const matchingWords = (pattern, value) => [...new Set([...value.matchAll(new RegExp(pattern.source, pattern.flags))].map(match => match[0]))];
function quoteFromRecord(record, needles) {
  if (record.text.length <= 300) return record.text;
  const lower = record.text.toLowerCase();
  const positions = needles.map(needle => lower.indexOf(needle.toLowerCase())).filter(position => position >= 0);
  const first = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, first - 65);
  return record.text.slice(start, start + 300).trim();
}

/** Question fit ranks before job fit; every visible explanation is backed by literal original excerpts. */
export function recommendExperiences(question, experiences = [], analysis = {}, limit = 3) {
  const prompt = text(typeof question === 'string' ? question : question?.question);
  if (!prompt.trim() || !Array.isArray(experiences)) return [];
  const questionTerms = keywords(prompt);
  const focus = coverLetterQuestionFocus(prompt);
  const jobTerms = keywords(strings(analysis.rolePriorities).join(' '));
  const purposes = QUESTION_PURPOSES.filter(purpose => purpose.prompt.test(prompt));
  return experiences.filter(experience => experience?.id).map(experience => {
    const records = experienceSourceRecords(experience).map(record => {
      const lower = record.text.toLowerCase();
      const promptWords = questionTerms.filter(term => lower.includes(term));
      const jobWords = jobTerms.filter(term => lower.includes(term));
      const focusWords = questionFocusWords(prompt, record.text);
      const purposeMatches = purposes.map(purpose => {
        const strong = matchingWords(purpose.strong, record.text);
        const support = matchingWords(purpose.support, record.text);
        return { label: purpose.label, words: strong.length ? strong : support, weight: strong.length ? 16 : support.length ? 4 : 0 };
      }).filter(match => match.weight);
      return { ...record, promptWords, jobWords, focusWords, purposeMatches,
        questionScore: focusWords.length * 30 + promptWords.length * 10 + purposeMatches.reduce((sum, match) => sum + match.weight, 0) };
    });
    if (focus && !records.some(record => record.focusWords.length)) return null;
    const promptWords = [...new Set(records.flatMap(record => record.promptWords))];
    const jobWords = [...new Set(records.flatMap(record => record.jobWords))];
    const purposeMatches = purposes.map(purpose => records.flatMap(record => record.purposeMatches).filter(match => match.label === purpose.label)
      .sort((left, right) => right.weight - left.weight)[0]).filter(Boolean);
    const focusWords = [...new Set(records.flatMap(record => record.focusWords))];
    const questionScore = focusWords.length * 30 + promptWords.length * 10 + purposeMatches.reduce((sum, match) => sum + match.weight, 0);
    const selected = records.filter(record => record.questionScore || record.jobWords.length)
      .sort((left, right) => Number(!!right.focusWords.length) - Number(!!left.focusWords.length)
        || right.questionScore - left.questionScore || right.jobWords.length - left.jobWords.length).slice(0, 2);
    const evidenceSources = selected.map(record => ({ sourceLabel: record.sourceLabel,
      quote: quoteFromRecord(record, [...record.focusWords, ...record.promptWords, ...record.purposeMatches.flatMap(match => match.words), ...record.jobWords]) }));
    const proof = evidenceSources.map(record => record.quote).join(' ').toLowerCase();
    const visiblePromptWords = promptWords.filter(word => proof.includes(word));
    const visibleJobWords = jobWords.filter(word => proof.includes(word));
    const visiblePurpose = [...purposeMatches].sort((left, right) => right.weight - left.weight).find(match => match.words.some(word => proof.includes(word.toLowerCase())));
    const literalPurposeWords = visiblePurpose?.words.filter(word => proof.includes(word.toLowerCase())).slice(0, 2) || [];
    const questionReason = focus && focusWords.some(word => proof.includes(word.toLowerCase())) ? `문항에서 묻는 ‘${focus.label}’와 관련된 실제 경험 기록이 있어요.`
      : visiblePurpose ? `문항에서 묻는 ‘${visiblePurpose.label}’에 쓸 수 있는 ${literalPurposeWords.map(word => `‘${word}’`).join('·')} 기록이 있어요.`
      : visiblePromptWords.length ? `문항과 경험 원문에 공통으로 나오는 내용: ${visiblePromptWords.slice(0, 2).map(word => `‘${word}’`).join('·')}.` : '';
    const jobReason = visibleJobWords.length ? `직무 요구사항의 ${visibleJobWords.slice(0, 2).map(word => `‘${word}’`).join('·')}에 연결할 수 있는 기록이 있어요.` : '';
    return {
      id: experience.id, experienceId: experience.id, experience, title: text(experience.title),
      score: questionScore * 10 + Math.min(jobWords.length, 6), questionScore, jobScore: jobWords.length,
      questionReason, jobReason, reason: [questionReason, jobReason].filter(Boolean).join(' '),
      matchedKeywords: [...new Set([...visiblePromptWords, ...literalPurposeWords, ...visibleJobWords])],
      evidence: evidenceSources.map(record => record.quote), evidenceSources,
    };
  }).filter(item => item && item.score > 0 && item.reason && item.evidence.length)
    .sort((left, right) => right.questionScore - left.questionScore || right.jobScore - left.jobScore)
    .slice(0, Math.max(0, Math.min(3, limit)));
}
