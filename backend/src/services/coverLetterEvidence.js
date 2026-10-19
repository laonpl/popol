import { coverLetterQuestionFocus, questionFocusWords } from '../../../shared/coverLetterQuestionFocus.mjs';

export const cleanText = (value, max = 20000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const compactText = value => cleanText(value, 100000).normalize('NFKC').replace(/\s+/g, ' ').trim();
export const stringList = (value, max = 8, length = 600) => Array.isArray(value) ? [...new Set(value.map(item => cleanText(item, length)).filter(Boolean))].slice(0, max) : [];

export function countAnswerCharacters(value, countSpaces = true) {
  const normalized = String(value || '').replace(/\r\n?/g, '\n');
  return Array.from(countSpaces ? normalized : normalized.replace(/\s/g, '')).length;
}

export function quotedInSource(quote, source) {
  const needle = compactText(quote);
  return needle.length >= 8 && compactText(source).includes(needle);
}

/** Limits come from the literal excerpt; a model's customary 500/1000 is never trusted. */
export function questionLimits(excerpt) {
  // Line breaks separate the independent maximum/minimum labels of a form.
  // Collapsing them can make "700자\n최소 100자" assign 최소 to the first number.
  const source = cleanText(excerpt, 10000).normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').trim();
  const range = source.match(/(\d[\d,]*)\s*자?\s*(?:~|〜|-|–)\s*(\d[\d,]*)\s*(?:자|글자|characters?)/i);
  const toLimit = value => {
    const number = Number(String(value).replace(/,/g, ''));
    return Number.isInteger(number) && number >= 1 && number <= 10000 ? number : null;
  };
  let minLength = range ? toLimit(range[1]) : null;
  let maxLength = range ? toLimit(range[2]) : null;
  if (!range) {
    const matches = [...source.matchAll(/(\d[\d,]*)[ \t]*(?:자|글자|characters?)[ \t]*(이상|이내|이하|내외|미만|초과|최대(?![ \t]*\d)|최소(?![ \t]*\d))?/gi)];
    for (const match of matches) {
      if (match[2] === '내외') continue;
      if (match[2] === '초과') minLength = toLimit(Number(match[1].replace(/,/g, '')) + 1);
      else if (match[2] === '이상' || match[2] === '최소' || /최소\s*$/.test(source.slice(0, match.index))) minLength = toLimit(match[1]);
      else maxLength = match[2] === '미만' ? toLimit(Number(match[1].replace(/,/g, '')) - 1) : toLimit(match[1]);
    }
  }
  if (maxLength && minLength && maxLength < minLength) return { maxLength: null, minLength: null, countSpaces: !/공백\s*제외|without\s*spaces/i.test(source) };
  return { maxLength, minLength, countSpaces: !/공백\s*제외|without\s*spaces/i.test(source) };
}

const CANONICAL_SHORT_QUESTION = /^(?:지원\s*동기(?:\s*및\s*입사\s*후\s*포부)?|성장\s*과정(?:\s*및\s*가족\s*사항)?|성장\s*배경|성격(?:의)?\s*(?:장단점|장점\s*(?:및|과)\s*단점)(?:\s*및\s*생활\s*신조)?|장단점|입사\s*후\s*포부|직무\s*역량)$/;
const QUESTION_SECTION = /(?:(?:자기\s*소개서|자소서|지원서|에세이|essay)\s*(?:(?:작성|입력|답변)\s*)?(?:문항|항목|질문)|(?:서술형|주관식|추가)\s*(?:문항|질문)|자기소개\s*(?:문항|질문))/gi;
const ARCHIVE_SECTION = /(?:합격\s*(?:자기\s*소개서|자소서)|자소서\s*(?:샘플|예시|모음|꿀팁|작성\s*(?:팁|가이드))|취업\s*전략|합격\s*(?:후기|수기)|면접\s*후기|직무\s*인터뷰|기출\s*(?:문항|질문)|추천\s*(?:공고|채용)|연관\s*(?:공고|채용)|다른\s*채용\s*공고|지난\s*(?:채용|공고))/gi;
const FORM_UI = /(?:제출\s*서류|구비\s*서류|첨부\s*파일|파일\s*(?:업로드|첨부)|지원\s*방법|접수\s*(?:방법|기간)|제출\s*방법|로그인|회원\s*가입|개인정보\s*(?:수집|처리|동의)|약관\s*동의|다운로드|인스타그램|공유하기|작성하기\s*버튼|지원서\s*(?:제출|확인)\s*(?:버튼|해주세요|하세요))/i;
const REQUIREMENT_TEXT = /(?:졸업\s*이상(?:인)?\s*자|전문학사\s*이상(?:인)?\s*자|업무\s*수행\s*가능자|경험자\s*우대|관련\s*경력\s*\d|교대\s*근무\s*가능자|자격\s*요건|우대\s*(?:조건|사항)|필수\s*요건)/;
// A noun such as 제조기술 or 경험자 is not a request to the applicant.
const ANSWER_REQUEST = /(?:기술|서술|설명|작성|소개|말씀|제시|기재|논술|묘사|정리|답변|이야기)(?:\s*(?:해\s*(?:주\s*)?(?:세요|십시오|시기\s*바랍니다|시기\s*바람)|해\s*주시(?:기\s*바랍니다|오)|하(?:세요|십시오|시오|라|기\s*바랍니다|기\s*바람)|하여\s*(?:주십시오|주시기\s*바랍니다)|\s*바랍니다))|(?:적어|써)\s*(?:주\s*)?(?:세요|십시오)|\b(?:describe|explain|tell\s+us|please\s+(?:write|share|describe))\b/i;
const INTERROGATIVE = /(?:무엇|어떤|어떻게|왜|언제|얼마나|있|했|인가|생각)[^?？]{0,500}(?:나요|니까|가요|인가요|일까요|는지|었는지)\s*[?？]/;
const APPLICANT_ADDRESS = /(?:본인|자신|지원자|귀하|당신|지원\s*(?:직무|분야|기업|회사)|우리\s*(?:회사|기업)|당사)/;
const QUESTION_PREFIX = /^(?:문항\s*\d{1,2}\s*[.):：]?\s*|(?:질문|Q)\s*\d{1,2}\s*[.):：]?\s*|\d{1,2}[.)]\s*)/i;
const LIMIT_SUFFIX = /\s*[([](?:[^()[\]]*\d[\d,]*\s*(?:자|글자|bytes?|바이트)[^()[\]]*)[)\]]\s*$/i;
const POSTING_METADATA = /^(?:(?:기업명|회사명|모집\s*(?:직무|분야)|담당\s*업무|지원\s*자격|근무\s*조건|접수\s*기간|전형\s*절차|기업\s*정보|회사\s*소개)\s*[:：]|\[(?:현재\s*)?채용\s*공고\s*원문\]|(?:이전|다음|임시\s*저장|저장|제출|지원)하기$)/;

// "아래 문항에 맞춰 작성해 주십시오" asks for writing, but it introduces the questions rather than being one.
const QUESTION_INTRO = /(?:아래|다음|하기)\s*(?:의\s*)?(?:문항|질문|항목)/;

function questionText(value) {
  return cleanText(value, 2200).replace(/^[*※ㆍ·•▶\-]\s*/, '').replace(QUESTION_PREFIX, '').replace(LIMIT_SUFFIX, '').trim();
}

function latestMatch(value, pattern) {
  let latest = -1;
  for (const match of value.matchAll(new RegExp(pattern.source, pattern.flags))) latest = match.index;
  return latest;
}

function questionContext(source, offset) {
  const before = source.slice(0, offset);
  const section = latestMatch(before, QUESTION_SECTION);
  const standaloneSection = latestMatch(before, /(?:^|\n)\s*(?:자기\s*소개서|자소서|지원서\s*작성)\s*(?:\n|$)/gi);
  const reset = latestMatch(before, /\[(?:직접\s*입력한|실제\s*지원\s*페이지|현재\s*지원서|현재\s*공고의\s*지원\s*페이지|지원서\s*원문)[^\]]*\]/gi);
  const archive = latestMatch(before, ARCHIVE_SECTION);
  const sectionEnd = Math.max(latestMatch(before, new RegExp(POSTING_METADATA.source, 'gm')),
    latestMatch(before, /(?:^|\n)\s*(?:담당\s*업무|지원\s*자격|자격\s*요건|우대\s*사항|근무\s*조건|접수\s*기간|접수\s*방법|제출\s*서류|전형\s*절차|기업\s*정보|회사\s*소개)\s*[:：]?\s*(?:\n|$)/gi));
  const currentSection = Math.max(section, standaloneSection);
  return {
    inQuestionSection: currentSection >= 0 && currentSection > Math.max(archive, sectionEnd, reset),
    // Archived essays often contain their own '자기소개서 문항' heading. It cannot prove
    // these are the questions for the current vacancy; only a distinct source resets it.
    inArchive: archive >= 0 && archive > reset,
  };
}

export function isRecognizedQuestionHeading(value) {
  return CANONICAL_SHORT_QUESTION.test(cleanText(value, 1600));
}

/** Verify the meaning and section, independently of whether a passage was quoted literally. */
export function isApplicationQuestion(value, sourceText = '', sourceQuote = '') {
  const question = questionText(value);
  if (!question || question.length > 1600 || FORM_UI.test(question) || QUESTION_INTRO.test(question.split('\n')[0]) || latestMatch(question, ARCHIVE_SECTION) >= 0) return false;
  const request = ANSWER_REQUEST.test(question);
  if (!request && REQUIREMENT_TEXT.test(question)) return false;
  const canonical = isRecognizedQuestionHeading(question);
  const interrogative = INTERROGATIVE.test(question);
  // Ordinary repeated notice lines cannot be questions. Avoid scanning every
  // occurrence and its section history for each of those lines on long forms.
  if (!request && !canonical && !interrogative) return false;
  const source = String(sourceText || sourceQuote || '');
  // Use original whitespace for section boundaries; NFKC/whitespace matching below allows wraps.
  const normalizedSource = source.normalize('NFKC');
  const needle = compactText(question);
  const words = needle.split(' ').map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const occurrences = [...normalizedSource.matchAll(new RegExp(words.join('\\s+'), 'g'))];
  const contexts = occurrences.map(match => questionContext(normalizedSource, match.index));
  if (source && (!contexts.length || contexts.every(context => context.inArchive))) return false;
  const inSection = contexts.some(context => context.inQuestionSection && !context.inArchive);
  if (canonical) return inSection;
  if (question.length < 8) return false;
  // Prompts can ask about any topic. A fixed experience/motivation vocabulary loses real questions.
  return request || (interrogative && (inSection || APPLICANT_ADDRESS.test(question)));
}

export function normalizePostingQuestions(candidates, sourceText) {
  const seen = new Set();
  return (Array.isArray(candidates) ? candidates : []).map(item => {
    if (!item || typeof item !== 'object') return null;
    const question = questionText(item.question || item.text);
    const sourceQuote = cleanText(item.sourceQuote || item.sourceExcerpt || question, 2200);
    const canonical = isRecognizedQuestionHeading(question);
    const exactShortProof = canonical && compactText(sourceText).includes(compactText(question)) && compactText(sourceText).includes(compactText(sourceQuote));
    if (latestMatch(sourceQuote, ARCHIVE_SECTION) >= 0 || !isApplicationQuestion(question, sourceText, sourceQuote)
      || (!exactShortProof && (!quotedInSource(question, sourceText) || !quotedInSource(sourceQuote, sourceText)))) return null;
    // The question must be wholly contained in its quoted proof, not another passage.
    if (!compactText(sourceQuote).includes(compactText(question))) return null;
    const key = compactText(question).replace(/^\d+[.)]\s*/, '');
    if (seen.has(key)) return null;
    seen.add(key);
    return { id: `q${seen.size}`, question, ...questionLimits(sourceQuote), source: 'posting', sourceQuote };
  }).filter(Boolean).slice(0, 12);
}

export function extractPostingQuestions(sourceText) {
  const source = String(sourceText || '');
  // "문항 1." stays one piece; splitting before "1." too would leave a bare "문항" glued to the previous question.
  const lines = source.split(/\n+|(?=(?:(?<!(?:문항|질문|Q)\s*)\b\d{1,2}[.)](?=\s*[가-힣A-Za-z])|문항\s*\d{1,2}\s*[.):：]?\s*|Q\s*\d{1,2}\s*[.:：]?\s+))/i).map(line => line.trim()).filter(Boolean);
  let cursor = 0;
  const offsets = lines.map(line => {
    const offset = source.indexOf(line, cursor);
    if (offset >= 0) cursor = offset + line.length;
    return offset;
  });
  const isLimit = line => line?.length <= 150 && /^[\s([]*(?:(?:최소|최대)\s*)?\d[\d,]*\s*(?:자|글자|characters?|[~〜-]\s*\d)/i.test(line);
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.length < 4 || line.length > 2200 || isLimit(line)) continue;
    let excerpt = line;
    let question = questionText(line);
    // Public forms often wrap an unnumbered label into several block elements.
    // Recover an unfinished applicant-directed clause through its answer request,
    // without merging separate finished prompts or crossing form/section boundaries.
    const offset = offsets[index];
    const numbered = QUESTION_PREFIX.test(line);
    const unfinished = !numbered
      && !ANSWER_REQUEST.test(question) && !INTERROGATIVE.test(question) && !isRecognizedQuestionHeading(question)
      && !FORM_UI.test(question) && !REQUIREMENT_TEXT.test(question) && !POSTING_METADATA.test(question)
      && latestMatch(question, QUESTION_SECTION) < 0
      && (APPLICANT_ADDRESS.test(question) || /(?:[을를은는이가의과와]|대해|대하여|위해|통해|하며|하고|또는|및)$/.test(question));
    // Avoid rescanning section history for every ordinary notice on long forms.
    const context = offset >= 0 && (numbered || unfinished) ? questionContext(source, offset) : {};
    if (unfinished && context.inQuestionSection && !context.inArchive) {
      let wrapped = line;
      for (let next = index + 1; next < Math.min(index + 8, lines.length); next += 1) {
        const continuation = lines[next];
        if (QUESTION_PREFIX.test(continuation) || isLimit(continuation) || FORM_UI.test(continuation)
          || REQUIREMENT_TEXT.test(continuation) || POSTING_METADATA.test(continuation)
          || isRecognizedQuestionHeading(questionText(continuation))
          || latestMatch(continuation, QUESTION_SECTION) >= 0 || latestMatch(continuation, ARCHIVE_SECTION) >= 0
          || /^(?:담당\s*업무|지원\s*자격|자격\s*요건|우대\s*사항|근무\s*조건|전형\s*절차|기업\s*정보|회사\s*소개)\s*[:：]?$/.test(continuation)
          || wrapped.length + continuation.length + 1 > 1600) break;
        wrapped += `\n${continuation}`;
        if (ANSWER_REQUEST.test(wrapped) || INTERROGATIVE.test(wrapped)) {
          excerpt = wrapped;
          question = questionText(wrapped);
          index = next;
          break;
        }
      }
    }
    // Keep all lines of the numbered prompt, including follow-up instructions after its first request.
    if (numbered) {
      if (context.inQuestionSection && !context.inArchive) {
        const end = Math.min(index + 8, lines.length);
        for (let next = index + 1; next < end; next += 1) {
          const continuation = lines[next];
          if (QUESTION_PREFIX.test(continuation) || isLimit(continuation) || FORM_UI.test(continuation) || POSTING_METADATA.test(continuation)
            || isRecognizedQuestionHeading(questionText(continuation))
            || (!ANSWER_REQUEST.test(continuation) && REQUIREMENT_TEXT.test(continuation))
            || /^(?:담당\s*업무|근무\s*조건|전형\s*절차|기업\s*정보|회사\s*소개)\s*[:：]?$/.test(continuation)
            || latestMatch(continuation, QUESTION_SECTION) >= 0 || latestMatch(continuation, ARCHIVE_SECTION) >= 0
            || excerpt.length + continuation.length > 1600
            // After a finished request, only notes (※, *, (…)) or further requests belong to it; a company name or URL does not.
            || (/[.?？다요]\s*$/.test(excerpt) && ANSWER_REQUEST.test(excerpt) && !/^[*※(\[ㆍ·•\-]/.test(continuation)
              && !ANSWER_REQUEST.test(continuation) && !INTERROGATIVE.test(continuation))) break;
          excerpt += `\n${continuation}`;
          question = questionText(excerpt);
          index = next;
        }
      }
    }
    if (isLimit(lines[index + 1])) excerpt += `\n${lines[index + 1]}`;
    candidates.push({ question, sourceQuote: excerpt });
  }
  return normalizePostingQuestions(candidates, sourceText);
}

export function suggestedQuestions() {
  return [
    '이 기업과 직무에 지원한 이유를 본인의 경험과 연결해 작성해주세요.',
    '지원 직무와 관련해 직접 문제를 해결한 경험을 역할과 행동 중심으로 작성해주세요.',
    '다른 사람과 협업하면서 의견 차이를 조율한 경험과 배운 점을 작성해주세요.',
  ].map((question, index) => ({ id: `suggested-${index + 1}`, question, maxLength: null, minLength: null, countSpaces: true, source: 'suggested', sourceQuote: '' }));
}

function factualStrings(value, depth = 0) {
  if (depth > 7 || value == null) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.slice(0, 30).flatMap(item => factualStrings(item, depth + 1));
  if (typeof value !== 'object') return [];
  return Object.entries(value).filter(([key]) => !/images?|url|base64|html|prompt|suggest|draft|AI.*(?:추론|초안|분석)|핵심\s*경험|작성\s*가이드/i.test(key))
    .flatMap(([, child]) => factualStrings(child, depth + 1));
}

export function experienceSource(experience) {
  // The interview/chat flows put AI-generated questions and extracted moments in rawInput.
  // Keep user answers and original material, excluding the generated sections.
  const originalContent = collectPmSources(experience.content || {}).filter(source => source.kind !== 'unread')
    .map(source => source.text.replace(/^Q\..*$/gm, '').replace(/^→\s*/gm, ''));
  const legacyMaterial = [experience.rawInput, experience.structuredResult?.rawInput].filter(value => typeof value === 'string' && value.trim());
  const legacySources = legacyMaterial.flatMap(value => collectPmSources(value)).filter(source => source.kind !== 'unread')
    .map(source => source.text.replace(/^Q\..*$/gm, '').replace(/^→\s*/gm, ''));
  const followupAnswers = (Array.isArray(experience.followupAnswers) ? experience.followupAnswers : [])
    .map(item => cleanText(item?.answer, 8000)).filter(Boolean);
  const facts = [...originalContent, ...legacySources, ...followupAnswers].join('\n').trim().slice(0, 24000);
  const narrativeContext = factualStrings(experience.structuredResult).join('\n').trim().slice(0, 12000);
  return { id: experience.id, title: cleanText(experience.title, 300), facts, narrativeContext, source: facts ? 'original' : 'saved-summary' };
}

export function validateGeneratedAnswer(proposed, { experiences, additionalContext = '', question }) {
  const answer = cleanText(proposed?.answer, 20000);
  const allSources = experiences.map(item => ({ id: item.id, text: item.facts || item.narrativeContext }));
  if (additionalContext) allSources.push({ id: 'user-input', text: additionalContext });
  const evidence = (Array.isArray(proposed?.evidence) ? proposed.evidence : []).map(item => ({ experienceId: cleanText(item?.experienceId, 128), quote: cleanText(item?.quote, 1800) }))
    .filter(item => allSources.some(source => source.id === item.experienceId && quotedInSource(item.quote, source.text))).slice(0, 12);
  const referencedIds = new Set(evidence.map(item => item.experienceId));
  // Citations are optional display metadata. Keep declared source links even
  // when a model omits a verbatim quote, but never accept an unowned ID.
  const declaredIds = new Set(Array.isArray(proposed?.linkedExperienceIds) ? proposed.linkedExperienceIds : []);
  const linkedExperienceIds = experiences.filter(item => referencedIds.has(item.id) || declaredIds.has(item.id)).map(item => item.id);
  const charCount = countAnswerCharacters(answer, question.countSpaces !== false);
  const withinLimit = (!question.maxLength || charCount <= question.maxLength) && (!question.minLength || charCount >= question.minLength);
  const warnings = stringList(proposed?.warnings, 12, 500);
  if (experiences.some(item => item.source === 'saved-summary')) warnings.push('원문이 없는 경험은 저장된 정리 내용을 사용했습니다. 역할과 성과를 제출 전에 확인해주세요.');
  const problems = [];
  problems.push(...stringList(proposed?.qualityIssues, 4, 600));
  if (!answer) problems.push('작성할 사실이 부족합니다. 경험의 역할·행동·결과를 보강해주세요.');
  const focus = coverLetterQuestionFocus(question.question);
  if (answer && focus && !questionFocusWords(question.question, answer).length) {
    problems.push(`문항에서 요구하는 ${focus.label} 경험에 답하지 않았습니다. 원문 자료의 관련 경험과 깨달은 점을 중심으로 다시 작성하세요. 관련 원문이 부족하면 status="needs_context"와 구체적인 followUpQuestion을 반환하세요.`);
  }
  // Length is editing feedback, so keep the full draft even when it needs resizing.
  // Keep the saved review shape compatible, but citation snippets are not a numeric gate.
  return { answer, linkedExperienceIds, evidence, warnings: [...new Set(warnings)], review: { charCount, withinLimit, unverifiedNumbers: [] }, problems };
}

export function groundCompanyInsights(candidates, sourceText, groundingMetadata = null) {
  const chunks = groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((chunk, index) => ({ id: `research-${index + 1}`, title: cleanText(chunk.web?.title, 300) || '기업 공개 자료', url: cleanText(chunk.web?.uri, 2000), type: 'research' }))
    .filter(source => /^https:\/\//i.test(source.url));
  const insights = [];
  for (const item of Array.isArray(candidates) ? candidates.slice(0, 8) : []) {
    const text = cleanText(item?.text, 800);
    const sourceQuote = cleanText(item?.sourceQuote, 1800);
    if (!text) continue;
    if (sourceQuote && quotedInSource(sourceQuote, sourceText)) {
      insights.push({ text: sourceQuote.slice(0, 800), sourceQuote, sourceId: 'posting' });
      continue;
    }
    // A returned URL alone does not prove a claim. Require a supported response span.
    const support = (groundingMetadata?.groundingSupports || []).find(supported => {
      const segment = compactText(supported.segment?.text);
      return segment.includes(compactText(text)) || (segment.length >= 20 && compactText(text).includes(segment));
    });
    const chunkIndex = support?.groundingChunkIndices?.find(index => sources.some(candidate => candidate.id === `research-${index + 1}`));
    const source = sources.find(candidate => candidate.id === `research-${chunkIndex + 1}`);
    // Provider-supported synthesis is not a literal quote from the original webpage.
    if (source) insights.push({ text, sourceQuote: '', sourceId: source.id });
  }
  const usedIds = new Set(insights.map(item => item.sourceId));
  return { insights, sources: sources.filter(source => usedIds.has(source.id)) };
}
import { collectPmSources } from './pmEvidence.js';

