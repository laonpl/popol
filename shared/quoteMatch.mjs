// 인용(quote)이 원문에 그대로 있는지 — 백엔드 근거 대조와 화면의 재확인이 같은 규칙을 쓴다.
// 공백 차이는 무시한다. AI가 원문 문장 두세 개를 이어 붙이거나 끝 문장부호·괄호를 바꾼 인용도,
// 조각이 모두 같은 원문 안에 그대로 있으면 있는 것으로 본다. 원문에 없는 문장이 하나라도 섞이면 없는 것이다.
const compact = value => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '').normalize('NFKC').replace(/\s+/g, ' ');
const pieces = needle => needle.split(/(?<=[.!?。])\s+/)
  .map(piece => piece.replace(/^[\s([「『"'“‘]+|[\s.,!?。)\]」』"'”’]+$/g, ''))
  .filter(piece => piece.length >= 6);

export function quoteInSource(sourceText, quote) {
  const haystack = compact(sourceText), needle = compact(quote);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  const parts = pieces(needle);
  return parts.join('').length >= 12 && parts.every(part => haystack.includes(part));
}
