import { compactText, stringList } from '../services/coverLetterEvidence.js';

/** A passing label cannot override missing or fabricated coverage quotations. */
export function coverLetterQualityProblems(review, answer) {
  const problems = stringList(review?.issues, 4, 600);
  if (/…\s*$/.test(String(answer || ''))) problems.push('분량을 맞추느라 생략된 마지막 문장을 완결하고 문항에 대한 결론을 유지하세요.');
  const requirements = Array.isArray(review?.requirements) ? review.requirements.slice(0, 12) : [];
  if (!requirements.length) problems.push('문항의 필수 요구별로 본문이 직접 답하는지 다시 확인하세요.');
  const body = compactText(answer);
  for (const item of requirements) {
    const quote = compactText(item?.answerQuote);
    if (!quote || !body.includes(quote)) {
      problems.push(`문항의 요구에 직접 답하는 내용이 없습니다: ${compactText(item?.requirement) || '필수 요구'}`);
    }
  }
  if (review?.status !== 'pass' && !problems.length) problems.push('문항 적합성과 문장 흐름을 유지해 다시 작성하세요.');
  return [...new Set(problems)].slice(0, 6);
}
