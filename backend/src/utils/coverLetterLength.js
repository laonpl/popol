import { countAnswerCharacters } from '../services/coverLetterEvidence.js';

export function coverLetterLengthDistance(charCount, question) {
  return Math.max(0, (question.minLength || 0) - charCount, question.maxLength ? charCount - question.maxLength : 0);
}

export function coverLetterPassages(answer) {
  const source = String(answer || '').replace(/\r\n?/g, '\n').trim();
  return Array.from(new Intl.Segmenter('ko', { granularity: 'sentence' }).segment(source), item => {
    const text = item.segment.trim();
    const start = item.index + item.segment.indexOf(text);
    return { text, start, end: start + text.length };
  }).filter(item => item.text).map((item, index) => ({ ...item, index }));
}

/** Select compatible wording changes by measured length, never by an AI-reported count. */
export function fitCoverLetterEdits(answer, question, edits) {
  const source = String(answer || '').replace(/\r\n?/g, '\n').trim();
  const count = value => countAnswerCharacters(value, question.countSpaces !== false);
  const initialLength = count(source);
  if (!coverLetterLengthDistance(initialLength, question) || !Array.isArray(edits)) return source;
  const target = question.minLength && question.maxLength
    ? Math.floor((question.minLength + question.maxLength) / 2)
    : question.minLength || question.maxLength;
  const rank = (left, right) => coverLetterLengthDistance(left.length, question) - coverLetterLengthDistance(right.length, question)
    || left.changes.length - right.changes.length || Math.abs(left.length - target) - Math.abs(right.length - target);
  const groups = [];
  const passages = coverLetterPassages(source);
  for (const edit of edits.slice(0, 12)) {
    // Sentence IDs refer to the server's original text, so copying mistakes in
    // a model-generated anchor cannot silently discard an otherwise usable edit.
    const passage = Number.isInteger(edit?.sentenceIndex) ? passages.find(item => item.index === edit.sentenceIndex) : null;
    const anchor = typeof edit?.before === 'string' ? edit.before : passage?.text;
    const replacements = typeof edit?.after === 'string' ? [edit.after] : edit?.after;
    if (typeof anchor !== 'string' || !Array.isArray(replacements)) continue;
    const before = anchor.replace(/\r\n?/g, '\n');
    const indexed = passage && typeof edit?.before !== 'string';
    const start = indexed ? passage.start : source.indexOf(before);
    // Exact, unique anchors keep a suggestion from modifying the wrong passage.
    if (!before.trim() || start < 0 || (!indexed && source.indexOf(before, start + 1) !== -1)) continue;
    const end = start + before.length;
    const alternatives = [...new Set(replacements.filter(value => typeof value === 'string' && value.trim() && value.length <= 4000)
      .map(value => value.replace(/\r\n?/g, '\n')))].filter(value => value !== before).slice(0, 6);
    if (!alternatives.length) continue;
    const sameAnchor = groups.find(group => start === group.start && end === group.end);
    if (sameAnchor) {
      sameAnchor.alternatives = [...new Set([...sameAnchor.alternatives, ...alternatives])].slice(0, 12);
      continue;
    }
    if (groups.some(group => start < group.end && end > group.start)) continue;
    groups.push({ start, end, before, alternatives });
  }
  groups.sort((left, right) => left.start - right.start);
  let states = [{ length: initialLength, changes: [] }];
  for (const group of groups) {
    const byLength = new Map(states.map(state => [state.length, state]));
    for (const state of states) {
      for (const after of group.alternatives) {
        const length = state.length + count(after) - count(group.before);
        if (length < 1 || length > 20000) continue;
        const next = { length, changes: [...state.changes, { ...group, after }] };
        const previous = byLength.get(length);
        if (!previous || rank(next, previous) < 0) byLength.set(length, next);
      }
    }
    // Bound work even if a provider returns many alternatives for a long essay.
    states = [...byLength.values()].sort(rank).slice(0, 512);
  }
  let best = { answer: source, length: initialLength, changes: [] };
  for (const state of states) {
    let candidate = source;
    for (const change of [...state.changes].reverse()) {
      candidate = candidate.slice(0, change.start) + change.after + candidate.slice(change.end);
    }
    candidate = candidate.trim();
    const measured = { ...state, answer: candidate, length: count(candidate) };
    if (rank(measured, best) < 0) best = measured;
  }
  return best.answer;
}

export function coverLetterLengthInstruction(question = {}) {
  const { maxLength, minLength, countSpaces } = question;
  const counting = countSpaces === false ? '공백과 줄바꿈 제외' : '공백과 줄바꿈 포함';
  if (!maxLength) return minLength
    ? `${counting} 최소 ${minLength}자 이상으로 작성하세요.`
    : '완결된 본문을 500~800자 정도로 작성하세요.';
  // A bounded range needs margin from both edges, including a close minimum.
  const target = minLength
    ? Math.floor((minLength + maxLength) / 2)
    : Math.max(1, Math.floor(maxLength * 0.9));
  return `${counting} 최대 ${maxLength}자는 넘을 수 없는 상한입니다. 목표 분량은 약 ${target}자입니다.${minLength ? ` 최소 ${minLength}자 이상도 충족하세요.` : ''} 제출할 본문만 세고, 반복이나 새로운 사실로 분량을 채우지 마세요.`;
}

/** Final safety cap after model revision: prefer whole sentences, then word boundaries. */
export function capCoverLetterAnswer(answer, question) {
  const source = String(answer || '').replace(/\r\n?/g, '\n').trim();
  const max = question.maxLength;
  const count = value => countAnswerCharacters(value, question.countSpaces !== false);
  if (!max || count(source) <= max) return source;
  const segments = Array.from(new Intl.Segmenter('ko', { granularity: 'sentence' }).segment(source), item => item.segment);
  let completed = '';
  for (const segment of segments) {
    if (!/[.!?。！？]["'”’\])]*\s*$/.test(segment)) continue;
    const next = completed + segment;
    if (count(next.trim()) > max) break;
    completed = next;
  }
  if (completed.trim()) return completed.trim();
  // An unusually long single sentence has no usable full-sentence boundary.
  // Keep code points intact and indicate the omitted tail rather than inventing an ending.
  let prefix = '', used = 0;
  for (const point of source) {
    const cost = question.countSpaces === false && /\s/u.test(point) ? 0 : 1;
    if (used + cost > max - 1) break;
    prefix += point;
    used += cost;
  }
  const lastSpace = prefix.search(/\s+\S*$/u);
  if (lastSpace > 0) prefix = prefix.slice(0, lastSpace);
  return `${prefix.trimEnd()}…`;
}
