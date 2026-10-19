import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { companyDocumentsOf, moveCompanyDocuments } from '../services/companyFolderDocuments.js';

const source = fs.readFileSync(new URL('./companyFolders.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace('export default router;', 'module.exports = router;');
const folderId = company => `owner_${createHash('sha1').update(company).digest('hex').slice(0, 24)}`;

async function harness(t) {
  const data = {
    portfolios: new Map([['portfolio', { userId: 'owner', targetCompany: '이전기업' }]]),
    coverLetters: new Map([
      ['own', { userId: 'owner', targetCompany: '이전기업', analysis: { company: '이전기업' }, questions: [{ answer: '보존할 답변' }] }],
      ['foreign', { userId: 'other', targetCompany: '이전기업', questions: [{ answer: '다른 사용자' }] }],
    ]),
    companyFolders: new Map([[folderId('이전기업'), { userId: 'owner', company: '이전기업', essays: [{ id: 'q', answer: '폴더 문항' }], files: [] }]]),
  };
  const reference = (collection, id) => ({ collection, id, get: async () => snapshot(collection, id) });
  const snapshot = (collection, id) => ({ id, ref: reference(collection, id), exists: data[collection].has(id), data: () => structuredClone(data[collection].get(id)) });
  const adminDb = {
    collection: name => ({ doc: id => reference(name, id), where: (field, operator, uid) => ({ get: async () => ({ docs: [...data[name]].filter(([, row]) => row[field] === uid).map(([id]) => snapshot(name, id)) }) }) }),
    batch: () => {
      const operations = [];
      return {
        update: (ref, patch) => operations.push(() => data[ref.collection].set(ref.id, { ...data[ref.collection].get(ref.id), ...patch })),
        set: (ref, row) => operations.push(() => data[ref.collection].set(ref.id, row)),
        delete: ref => operations.push(() => data[ref.collection].delete(ref.id)),
        commit: async () => operations.forEach(apply => apply()),
      };
    },
  };
  const context = { Router, createHash, randomUUID, adminDb, companyDocumentsOf, moveCompanyDocuments,
    authMiddleware: (req, res, next) => { if (!req.get('x-test-user')) return res.sendStatus(401); req.user = { uid: req.get('x-test-user') }; next(); }, module: { exports: null } };
  vm.runInNewContext(source, context);
  const app = express(); app.use(express.json()); app.use('/folders', context.module.exports);
  app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = async (route, body, user = 'owner') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/folders/${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: response.status === 401 ? null : await response.json() };
  };
  return { data, request };
}

test('rename moves saved cover letters with portfolios and folder essays while preserving answers and other accounts', async t => {
  const app = await harness(t), result = await app.request('rename', { from: '이전기업', to: '새기업' });
  assert.equal(result.status, 200); assert.equal(result.body.movedCoverLetters, 1);
  assert.equal(app.data.coverLetters.get('own').targetCompany, '새기업');
  assert.equal(app.data.coverLetters.get('own').questions[0].answer, '보존할 답변');
  assert.equal(app.data.portfolios.get('portfolio').targetCompany, '새기업');
  assert.equal(app.data.companyFolders.get(folderId('새기업')).essays[0].answer, '폴더 문항');
  assert.equal(app.data.coverLetters.get('foreign').targetCompany, '이전기업');
});

test('folder deletion unassigns saved cover letters without deleting their drafts or original analysis', async t => {
  const app = await harness(t), result = await app.request('delete', { company: '이전기업' });
  assert.equal(result.status, 200); assert.equal(result.body.movedCoverLetters, 1);
  assert.equal(app.data.companyFolders.has(folderId('이전기업')), false);
  assert.equal(app.data.coverLetters.get('own').targetCompany, '');
  assert.equal(app.data.coverLetters.get('own').analysis.company, '이전기업');
  assert.equal(app.data.coverLetters.get('own').questions[0].answer, '보존할 답변');
  assert.equal(app.data.coverLetters.get('foreign').targetCompany, '이전기업');
});

test('anonymous folder operations cannot change saved documents', async t => {
  const app = await harness(t);
  assert.equal((await app.request('rename', { from: '이전기업', to: '새기업' }, null)).status, 401);
  assert.equal(app.data.coverLetters.get('own').targetCompany, '이전기업');
});
