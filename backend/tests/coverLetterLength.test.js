import test from 'node:test';
import assert from 'node:assert/strict';
import { coverLetterLengthInstruction, capCoverLetterAnswer, fitCoverLetterEdits } from '../src/utils/coverLetterLength.js';
import { countAnswerCharacters } from '../src/services/coverLetterEvidence.js';
import { buildCoverLetterLengthRevisionPrompt, buildCoverLetterLengthEditsPrompt } from '../src/prompts/coverLetterPrompts.js';

test('generation targets leave margin below the maximum and honor a close minimum', () => {
  assert.match(coverLetterLengthInstruction({ maxLength: 300 }), /약 270자/);
  assert.match(coverLetterLengthInstruction({ maxLength: 1 }), /약 1자/);
  assert.match(coverLetterLengthInstruction({ minLength: 290, maxLength: 300 }), /약 295자/);
  assert.match(coverLetterLengthInstruction({ minLength: 650, maxLength: 750 }), /약 700자/);
  assert.match(coverLetterLengthInstruction({ minLength: 700, maxLength: 700 }), /약 700자/);
  assert.match(coverLetterLengthInstruction({ maxLength: 300, countSpaces: false }), /공백과 줄바꿈 제외/);
});

test('length revision gives measured expansion or reduction instructions for both bounds', () => {
  const input = { question: { minLength: 650, maxLength: 750 } };
  const shortPrompt = buildCoverLetterLengthRevisionPrompt(input, { answer: '초안' }, 330);
  assert.match(shortPrompt, /현재 본문은 330자/);
  assert.match(shortPrompt, /320자 부족/);
  assert.match(shortPrompt, /확장/);
  assert.doesNotMatch(shortPrompt, /초과했습니다/);
  const longPrompt = buildCoverLetterLengthRevisionPrompt(input, { answer: '초안' }, 800);
  assert.match(longPrompt, /50자 초과/);
  assert.match(longPrompt, /최소 글자 수가 있으면 그보다 짧아지지/);
  assert.match(buildCoverLetterLengthRevisionPrompt({ question: { minLength: 650 } }, {}, 600), /50자 부족/);
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

test('local edits combine independently measured alternatives to satisfy an exact length', () => {
  const answer = '자료를 분석했습니다. 개선안을 제안했습니다.';
  const edits = [
    { before: '분석했습니다', after: ['분석하였습니다', '분석해 보았습니다'] },
    { before: '제안했습니다', after: ['제안하였습니다', '제안해 보았습니다'] },
  ];
  const exact = countAnswerCharacters(answer) + 2;
  assert.equal(fitCoverLetterEdits(answer, { minLength: exact, maxLength: exact }, edits),
    '자료를 분석하였습니다. 개선안을 제안하였습니다.');
});

test('local edits use the configured whitespace and Unicode counting rules', () => {
  for (const countSpaces of [true, false]) {
    const answer = '🙂 고객 인터뷰를 진행했습니다.\r\n개선안을 제안했습니다.';
    const replacement = '고객의 문제를 파악하기 위한 인터뷰';
    const expected = answer.replace(/\r\n/g, '\n').replace('고객 인터뷰', replacement);
    const exact = countAnswerCharacters(expected, countSpaces);
    const result = fitCoverLetterEdits(answer, { minLength: exact, maxLength: exact, countSpaces }, [
      { before: '고객 인터뷰', after: [replacement] },
    ]);
    assert.equal(result, expected);
    assert.equal(countAnswerCharacters(result, countSpaces), exact);
  }
});

test('ambiguous, overlapping or malformed edits are ignored and worsening edits never replace the draft', () => {
  const answer = '고객을 만났습니다. 고객을 조사했습니다.';
  const limits = { minLength: countAnswerCharacters(answer) + 1, maxLength: countAnswerCharacters(answer) + 2 };
  for (const edits of [null, [{}], [{ before: '', after: ['내용'] }],
    [{ before: '없는 문장', after: ['내용'] }], [{ before: '고객을', after: ['고객들을'] }],
    [{ before: '만났습니다', after: ['가'.repeat(100)] }]]) {
    assert.equal(fitCoverLetterEdits(answer, limits, edits), answer);
  }
  assert.equal(fitCoverLetterEdits(answer, limits, [
    { before: '만났습니다', after: ['만나보았습니다'] },
    { before: '고객을 만났습니다', after: ['원문과 겹치는 제안은 무시합니다'] },
  ]), '고객을 만나보았습니다. 고객을 조사했습니다.');
});

test('local reductions keep the conclusion and can meet an exact upper bound', () => {
  const answer = '저는 직접 자료를 분석하였습니다. 개선안을 제안하였습니다.';
  const expected = '자료를 분석했습니다. 개선안을 제안했습니다.';
  const exact = countAnswerCharacters(expected);
  assert.equal(fitCoverLetterEdits(answer, { minLength: exact, maxLength: exact }, [
    { before: '저는 직접 자료를 분석하였습니다.', after: ['자료를 분석했습니다.', '저는 자료를 분석했습니다.'] },
    { before: '제안하였습니다', after: ['제안했습니다'] },
  ]), expected);
});

test('edit prompt describes a measured 6-character shortage and a 56-character maximum increase', () => {
  const prompt = buildCoverLetterLengthEditsPrompt({ question: { minLength: 650, maxLength: 700 } }, { answer: '가'.repeat(643) + '.' });
  assert.match(prompt, /현재 본문은 644자/);
  assert.match(prompt, /6자 이상, 56자 이하/);
  assert.match(prompt, /전체 본문을 다시 쓰지 마세요/);
  assert.match(prompt, /sentenceIndex/);
  assert.match(prompt, /replacementMin/);
  assert.match(prompt, /문장 1~3개/);
});

test('sentence IDs apply single-string edits without depending on copied anchors', () => {
  const answer = '자료를 정리했습니다.\n\n기준을 확인했습니다.';
  const expected = '자료를 주제에 따라 정리했습니다.\n\n기준을 확인했습니다.';
  const exact = countAnswerCharacters(expected);
  assert.equal(fitCoverLetterEdits(answer, { minLength: exact, maxLength: exact }, [
    { sentenceIndex: 0, after: '자료를 주제에 따라 정리했습니다.' },
  ]), expected);
});

test('sentence IDs distinguish repeated sentences and invalid IDs cannot alter the draft', () => {
  const answer = '기준을 확인했습니다.\n\n기준을 확인했습니다.';
  const expected = '기준을 확인했습니다.\n\n기준이 서로 일치하는지 확인했습니다.';
  const exact = countAnswerCharacters(expected);
  assert.equal(fitCoverLetterEdits(answer, { minLength: exact, maxLength: exact }, [
    { sentenceIndex: 1, after: ['기준이 서로 일치하는지 확인했습니다.'] },
  ]), expected);
  for (const sentenceIndex of [-1, 20, '1', 0.5]) {
    assert.equal(fitCoverLetterEdits(answer, { minLength: exact, maxLength: exact }, [
      { sentenceIndex, after: ['없는 위치의 문장은 바꾸지 않습니다.'] },
    ]), answer);
  }
});

test('repeated entries for one anchor combine their alternatives instead of losing useful edits', () => {
  const answer = '자료를 정리했습니다.';
  const expected = '자료를 같은 기준으로 정리했습니다.';
  const exact = countAnswerCharacters(expected);
  assert.equal(fitCoverLetterEdits(answer, { minLength: exact, maxLength: exact }, [
    { before: '정리했습니다', after: ['분류했습니다'] },
    { before: '정리했습니다', after: '같은 기준으로 정리했습니다' },
  ]), expected);
});
