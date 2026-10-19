import test from 'node:test';
import assert from 'node:assert/strict';
import { companyDocumentsOf, moveCompanyDocuments } from './companyFolderDocuments.js';

test('company operations find only the owner’s matching portfolios and saved cover letters, including legacy drafts', async () => {
  const seed = {
    portfolios: [{ id: 'p', userId: 'owner', targetCompany: ' 예시기업 ' }, { id: 'foreign', userId: 'other', targetCompany: '예시기업' }],
    coverLetters: [{ id: 'letter', userId: 'owner', targetCompany: '예시기업', questions: [{ answer: '기존 답변' }] }, { id: 'legacy', userId: 'owner', analysis: { company: '예시기업' } }, { id: 'cleared', userId: 'owner', targetCompany: '', analysis: { company: '예시기업' } }, { id: 'elsewhere', userId: 'owner', targetCompany: '다른 기업' }],
  };
  const db = { collection: name => ({ where(field, operator, uid) {
    assert.equal(field, 'userId'); assert.equal(operator, '=='); assert.equal(uid, 'owner');
    return { get: async () => ({ docs: seed[name].filter(row => row.userId === uid).map(row => ({ ref: row.id, data: () => row })) }) };
  } }) };
  const documents = await companyDocumentsOf(db, 'owner', '예시기업');
  assert.deepEqual(documents.portfolios.map(doc => doc.ref), ['p']);
  assert.deepEqual(documents.coverLetters.map(doc => doc.ref), ['letter', 'legacy']);
  const updates = [], batch = { update: (ref, patch) => updates.push({ ref, patch }) };
  assert.deepEqual(moveCompanyDocuments(batch, documents, '새 기업'), { movedPortfolios: 1, movedCoverLetters: 2 });
  assert.ok(updates.every(row => row.patch.targetCompany === '새 기업'));
  assert.ok(updates.every(row => Object.keys(row.patch).sort().join(',') === 'targetCompany,updatedAt'));
  assert.equal(seed.coverLetters[0].questions[0].answer, '기존 답변');
  updates.length = 0;
  moveCompanyDocuments(batch, documents, '');
  assert.ok(updates.every(row => row.patch.targetCompany === ''), 'folder removal clears assignment without deleting saved drafts');
});
