import test from 'node:test';
import assert from 'node:assert/strict';
import { coverLetterLengthInstruction, capCoverLetterAnswer } from '../src/utils/coverLetterLength.js';
import { countAnswerCharacters } from '../src/services/coverLetterEvidence.js';

test('generation targets leave margin below the maximum and honor a close minimum', () => {
  assert.match(coverLetterLengthInstruction({ maxLength: 300 }), /약 270자/);
  assert.match(coverLetterLengthInstruction({ minLength: 290, maxLength: 300 }), /약 290자/);
  assert.match(coverLetterLengthInstruction({ maxLength: 300, countSpaces: false }), /공백과 줄바꿈 제외/);
});

test('the safety cap prefers full sentences and retains text that already fits', () => {
  const first = '고객 인터뷰를 진행했습니다.';
  const answer = `${first} 문제 유형을 분류하고 개선안을 제안했습니다.`;
  assert.equal(capCoverLetterAnswer(answer, { maxLength: first.length }), first);
  assert.equal(capCoverLetterAnswer(answer, { maxLength: 300 }), answer);
  assert.equal(capCoverLetterAnswer(answer, {}), answer);
});

test('the final cap follows space exclusion, normalizes CRLF and preserves emoji code points', () => {
  for (const countSpaces of [true, false]) {
    for (const maxLength of [1, 5, 12]) {
      const result = capCoverLetterAnswer('🙂 고객 문제를\r\n조사하고 개선안을 작성했습니다.', { maxLength, countSpaces });
      assert.ok(countAnswerCharacters(result, countSpaces) <= maxLength);
      assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(result));
    }
  }
});
