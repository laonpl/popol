import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogLookupTarget, mergeCatalogEntry } from './questionCatalog.js';

const question = { id: 'q1', question: '지원동기', source: 'posting', validation: 'verified', maxLength: 700, minLength: null, countSpaces: true, sourceQuote: '지원동기 (700자)' };
const entry = { id: 'entry-42', company: '예시기업', position: '개발', sourceEvidenceUrl: 'https://careers.example.com/apply/42',
  questionSourceText: '자기소개서 문항\n지원동기 (700자)', questions: [question], verifiedAt: '2026-10-08T00:00:00Z', expiresAt: '2026-10-14T00:00:00Z' };

test('catalog lookup uses exact selected role and never defaults a multiple-role selection', () => {
  assert.equal(catalogLookupTarget({ sourceUrl: 'https://example.com/jobs/42', questionStatus: 'selection_required' }), null);
  assert.deepEqual(catalogLookupTarget({ sourceUrl: 'https://example.com/jobs/42', selectedApplicationUrl: 'https://careers.example.com/roles/43', applicationUrl: 'https://careers.example.com/apply/old' }),
    { sourceUrl: 'https://example.com/jobs/42', applicationUrl: 'https://careers.example.com/roles/43' });
});

test('catalog arrival preserves edited answers, selected experiences and notes while attaching verified source', () => {
  const old = { ...question, id: 'existing', answer: '직접 작성한 답변', linkedExperienceIds: ['saved-experience'], additionalContext: '내 메모', warnings: ['확인할 내용'], review: { charCount: 20 } };
  const letter = { title: '내 지원서', targetCompany: '예시기업', targetPosition: '개발', analysis: { sourceUrl: 'https://example.com/jobs/42', sources: [{ id: 'posting', title: '공고' }] }, questions: [old] };
  const merged = mergeCatalogEntry(letter, entry);
  assert.equal(merged.questions.length, 1); assert.equal(merged.questions[0].id, 'existing');
  assert.equal(merged.questions[0].answer, old.answer); assert.deepEqual(merged.questions[0].linkedExperienceIds, old.linkedExperienceIds);
  assert.equal(merged.questions[0].additionalContext, old.additionalContext); assert.equal(merged.questions[0].importMethod, 'question_catalog');
  assert.equal(merged.analysis.questionCatalog.status, 'verified'); assert.equal(merged.analysis.sources.at(-1).url, entry.sourceEvidenceUrl);
  assert.equal(merged.analysis.sourceUrl, letter.analysis.sourceUrl); assert.equal(letter.questions[0].importMethod, undefined);
});

test('blank shells are replaced, quarantined answers remain quarantined and unrelated manual answers are preserved', () => {
  const letter = { analysis: {}, questions: [{ id: 'blank', question: '', answer: '' },
    { id: 'old', question: '고등학교 졸업 이상인 자', source: 'posting', validation: 'unverified', answer: '보존할 예전 답변', sourceQuote: '틀린 업무 문구' },
    { id: 'manual', question: '협업한 경험을 작성해주세요.', source: 'manual', answer: '작성 중인 협업 이야기' }] };
  const merged = mergeCatalogEntry(letter, entry);
  assert.ok(!merged.questions.some(q => q.id === 'blank'));
  assert.equal(merged.questions.find(q => q.id === 'old').validation, 'unverified');
  assert.equal(merged.questions.find(q => q.id === 'manual').answer, '작성 중인 협업 이야기');
  assert.ok(!merged.analysis.questionSourceText.includes('틀린 업무 문구'));
});

test('catalog import fails atomically when the active question limit would be exceeded', () => {
  const letter = { analysis: {}, questions: Array.from({ length: 12 }, (_, index) => ({ id: `m${index}`, source: 'manual', question: `다른 문항 ${index}`, answer: '기존 답변' })) };
  assert.throws(() => mergeCatalogEntry(letter, entry), /12/);
  assert.equal(letter.questions.length, 12); assert.ok(letter.questions.every(q => q.answer === '기존 답변'));
});
