import { countAnswerCharacters } from '../services/coverLetterEvidence.js';

export function coverLetterLengthInstruction(question = {}) {
  const { maxLength, minLength, countSpaces } = question;
  const counting = countSpaces === false ? '공백과 줄바꿈 제외' : '공백과 줄바꿈 포함';
  if (!maxLength) return minLength
    ? `${counting} 최소 ${minLength}자 이상으로 작성하세요.`
    : '완결된 본문을 500~800자 정도로 작성하세요.';
  // Leave room for the model's approximate counting and final wording changes.
  const target = Math.min(maxLength, Math.max(minLength || 1, Math.floor(maxLength * 0.9)));
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
