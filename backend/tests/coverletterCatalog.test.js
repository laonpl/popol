import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express, { Router } from 'express';
import { buildCatalogEntry, createQuestionCatalog, catalogIdentity, applyCatalogEntry, customerCatalogEntry } from '../src/services/coverLetterQuestionCatalog.js';
import { analyzeCoverLetter, buildCoverLetterDocument } from '../src/services/coverLetterService.js';

const timestamp = Date.now();
const now = () => timestamp;
const sourceUrl = 'https://www.jobkorea.co.kr/Recruit/GI_Read/50122030?Oem_Code=C1&PageGbn=ST&sc=419';
const applicationUrl = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537&pg=1';
const sourceEvidenceUrl = 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1537';
// These are synthetic test prompts, never a seed for the current SFA vacancy.
const fixture = () => ({ company: '예시기업', position: '예시 Operator', sourceUrl, applicationUrl, sourceEvidenceUrl,
  validFrom: new Date(timestamp - 86400000).toISOString(), expiresAt: new Date(timestamp + 7 * 86400000).toISOString(),
  sourceQuestionText: '자기소개서 문항\n1. 지원동기 (100~700자, 공백 제외)\n2. 본인의 협업 경험을 설명해주세요. (1,000 bytes 이내)', originalVerified: true });

function memoryDatabase() {
  const records = new Map(); const calls = { reads: 0, writes: 0 };
  const rows = name => { if (!records.has(name)) records.set(name, new Map()); return records.get(name); };
  const snapshot = (name, id) => ({ id, exists: rows(name).has(id), data: () => structuredClone(rows(name).get(id)) });
  const write = (ref, data, options) => { calls.writes++; rows(ref.name).set(ref.id, structuredClone(options?.merge ? { ...rows(ref.name).get(ref.id), ...data } : data)); };
  const query = (name, conditions = [], order = null, cap = 100) => ({
    doc: id => ({ name, id, get: async () => { calls.reads++; return snapshot(name, id); }, set: async (data, options) => write({ name, id }, data, options) }),
    where: (field, operator, value) => { assert.equal(operator, '=='); return query(name, [...conditions, [field, value]], order, cap); },
    orderBy: (field, direction) => query(name, conditions, [field, direction], cap),
    limit: limit => query(name, conditions, order, limit),
    get: async () => { calls.reads++; let result = [...rows(name)].filter(([, row]) => conditions.every(([field, value]) => row[field] === value));
      if (order) result.sort((a, b) => (order[1] === 'desc' ? -1 : 1) * String(a[1][order[0]]).localeCompare(String(b[1][order[0]])));
      return { docs: result.slice(0, cap).map(([id]) => snapshot(name, id)) }; },
  });
  return { records, calls, db: { collection: name => query(name),
    runTransaction: async callback => callback({ get: async ref => { calls.reads++; return snapshot(ref.name, ref.id); }, set: write }),
    batch: () => { const pending = []; return { set: (...args) => pending.push(args), commit: async () => pending.forEach(args => write(...args)) }; },
  } };
}

test('catalog identity preserves exact selected role and normalizes tracking and SFA form URLs', () => {
  const base = catalogIdentity(fixture());
  assert.deepEqual(base, catalogIdentity({ sourceUrl: 'https://www.jobkorea.co.kr/Recruit/GI_Read/50122030', applicationUrl: sourceEvidenceUrl }));
  assert.notEqual(base.id, catalogIdentity({ sourceUrl, applicationUrl: applicationUrl.replace('1537', '1539') }).id);
  assert.notEqual(base.id, catalogIdentity({ sourceUrl: sourceUrl.replace('50122030', '99999999'), applicationUrl }).id);
  assert.notEqual(base.id, catalogIdentity({ sourceUrl }).id);
});

test('only literal current prompts and explicit limits are stored; applicant fields are discarded', () => {
  const payload = { ...fixture(), password: 'private-password', cookies: 'private-cookie', answers: ['private-answer'],
    sourceQuestionText: `이름: private-name\n${fixture().sourceQuestionText}` };
  const entry = buildCatalogEntry(payload, { now, verifiedBy: 'signed-admin' });
  assert.equal(entry.questions.length, 2);
  assert.deepEqual([entry.questions[0].minLength, entry.questions[0].maxLength, entry.questions[0].countSpaces], [100, 700, false]);
  assert.equal(entry.questions[1].maxLength, null);
  assert.ok(!JSON.stringify(entry).includes('private-'));
  assert.ok(entry.questions.every(q => q.importMethod === 'question_catalog'));
  assert.throws(() => buildCatalogEntry({ ...fixture(), sourceEvidenceUrl: sourceEvidenceUrl.replace('1537', '1539') }, { now, verifiedBy: 'admin' }));
  assert.throws(() => buildCatalogEntry({ ...fixture(), sourceQuestionText: '고등학교 졸업 이상인 자 반도체 설비 업무 수행 가능자' }, { now, verifiedBy: 'admin' }));
  assert.throws(() => buildCatalogEntry({ ...fixture(), sourceQuestionText: '합격자소서\n자기소개서 문항\n지원동기' }, { now, verifiedBy: 'admin' }));
});

test('unverified originals, invalid recruitment periods and unsafe source URLs cannot be published', () => {
  for (const override of [{ originalVerified: false }, { validFrom: '2026-10-08' },
    { expiresAt: new Date(timestamp - 1).toISOString() }, { validFrom: new Date(timestamp + 10 * 86400000).toISOString() },
    { sourceUrl: 'https://127.0.0.1/job/42' }, { applicationUrl: 'http://careers.example.com/jobs/42' }]) {
    assert.throws(() => buildCatalogEntry({ ...fixture(), ...override }, { now, verifiedBy: 'admin' }));
  }
});

test('missing questions queue only posting metadata and become available for all later customers after admin publication', async () => {
  const memory = memoryDatabase(); const catalog = createQuestionCatalog(memory.db, { now });
  const first = await catalog.lookup({ sourceUrl, applicationUrl, userId: 'private-user', answers: 'private-answer' });
  assert.equal(first.status, 'pending'); assert.equal(first.entry, null);
  await catalog.lookup({ sourceUrl, applicationUrl });
  const request = memory.records.get('coverLetterQuestionCatalogRequests').get(first.requestId);
  assert.equal(request.count, 2); assert.ok(!JSON.stringify(request).includes('private-'));
  const entry = await catalog.publish({ ...fixture(), sourceAliases: ['https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537&pg=1'] }, { verifiedBy: 'admin' });
  const fetched = await catalog.lookup({ sourceUrl, applicationUrl: sourceEvidenceUrl });
  assert.equal(fetched.entry.id, entry.id); assert.equal(fetched.status, 'verified');
  assert.equal((await catalog.lookup({ sourceUrl: applicationUrl, applicationUrl })).status, 'verified');
  assert.equal((await catalog.lookup({ sourceUrl, applicationUrl: applicationUrl.replace('1537', '1539') })).status, 'pending');
  const safe = customerCatalogEntry(fetched.entry);
  assert.equal(safe.verifiedBy, undefined); assert.equal(safe.aliases, undefined); assert.equal(safe.questions.length, 2);
});

test('inactive, future, expired and corrupted catalog entries are never served', async () => {
  const memory = memoryDatabase(); const catalog = createQuestionCatalog(memory.db, { now });
  const entry = await catalog.publish(fixture(), { verifiedBy: 'admin' });
  const map = memory.records.get('coverLetterQuestionCatalog');
  for (const mutate of [e => { e.active = false; }, e => { e.validFrom = new Date(timestamp + 1).toISOString(); },
    e => { e.expiresAt = new Date(timestamp).toISOString(); }, e => { e.questions[0].maxLength = 9999; }]) {
    const invalid = structuredClone(entry); mutate(invalid); map.set(entry.id, invalid);
    assert.equal((await catalog.lookup({ sourceUrl, applicationUrl })).status, 'pending');
  }
  map.set(entry.id, entry); await catalog.setActive(entry.id, false, { verifiedBy: 'operator' });
  assert.equal(map.get(entry.id).deactivatedBy, 'operator');
  assert.equal((await catalog.lookup({ sourceUrl, applicationUrl })).status, 'pending');
});

const generateAI = async () => { throw new Error('unavailable'); };
const blockedScrape = async () => ({ text: '기업명: 예시기업\n모집 직무: 예시 Operator\n설비 운영과 품질 확인 담당자를 모집합니다.', questionText: '지원자 등록\n개인정보 동의',
  applicationLinks: [{ label: '예시 Operator', url: applicationUrl }], applicationUrl: sourceEvidenceUrl, applicationAccess: 'registration_required' });

test('analysis automatically uses verified catalog questions and saved drafts retain literal proof', async () => {
  const memory = memoryDatabase(); const catalog = createQuestionCatalog(memory.db);
  const published = await catalog.publish(fixture(), { verifiedBy: 'admin' });
  const result = await analyzeCoverLetter({ url: sourceUrl }, { scrape: blockedScrape, generateAI, lookupQuestions: value => catalog.lookup(value) });
  assert.equal(result.questions.length, 2); assert.equal(result.questionStatus, 'verified'); assert.equal(result.questionCatalog.status, 'verified');
  assert.equal(result.sources.at(-1).url, sourceEvidenceUrl);
  const document = buildCoverLetterDocument({ analysis: result, questions: result.questions }, 'customer');
  assert.ok(document.questions.every(q => q.validation === 'verified' && q.importMethod === 'question_catalog'));
  assert.throws(() => applyCatalogEntry({ ...result, selectedApplicationUrl: applicationUrl.replace('1537', '1539') }, published), /공고|직무/);
});

test('missing catalog requests are automatic and public/manual questions or unselected multiple roles take precedence', async () => {
  let calls = 0; const lookupQuestions = async () => { calls++; return { status: 'pending', entry: null, requestId: 'pending-42' }; };
  const result = await analyzeCoverLetter({ url: sourceUrl }, { scrape: blockedScrape, generateAI, lookupQuestions });
  assert.equal(calls, 1); assert.equal(result.questionCatalog.status, 'pending'); assert.equal(result.questions.length, 0);
  assert.ok(result.questionNotice.includes('개인정보 동의와 지원자 등록'));
  assert.ok(result.questionNotice.includes('문항 확인 요청이 접수'));
  for (const [body, scrape] of [
    [{ url: sourceUrl }, async () => ({ ...await blockedScrape(), questionText: fixture().sourceQuestionText })],
    [{ url: sourceUrl, text: fixture().sourceQuestionText, questionImport: true }, blockedScrape],
    [{ url: sourceUrl }, async () => ({ ...await blockedScrape(), questionStatus: 'selection_required', applicationLinks: [{ url: applicationUrl }, { url: applicationUrl.replace('1537', '1539') }] })],
  ]) await analyzeCoverLetter(body, { scrape, generateAI, lookupQuestions });
  assert.equal(calls, 1);
});

test('exact verified catalog source can recover a temporarily inaccessible posting without fabricating company facts', async () => {
  const entry = buildCatalogEntry(fixture(), { now, verifiedBy: 'admin' });
  const result = await analyzeCoverLetter({ url: sourceUrl, applicationUrl }, { scrape: async () => { throw new Error('temporary fetch error'); }, generateAI,
    lookupQuestions: async () => ({ status: 'verified', entry }) });
  assert.equal(result.questions.length, 2); assert.equal(result.summary, ''); assert.equal(result.business, '');
  assert.equal(result.questionCatalog.status, 'verified');
  assert.ok(result.questions.every(q => q.importMethod === 'question_catalog'));
  assert.ok(result.uncertainties.some(value => value.includes('원문을 다시 읽지 못해')));
});

async function routeServer(t) {
  const memory = memoryDatabase();
  const code = fs.readFileSync(new URL('../src/routes/coverletterCatalog.js', import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace('export default router;', 'module.exports = router;');
  const decoded = token => ({ uid: token, email: token === 'admin' || token === 'unverified' ? 'fitpoly.kr@gmail.com' : 'user@example.com', email_verified: token !== 'unverified' });
  const context = { Router, createQuestionCatalog, buildCatalogEntry, customerCatalogEntry, adminDb: memory.db, process,
    adminAuth: { verifyIdToken: async (token, revoked) => { assert.equal(revoked, true); if (token === 'revoked') throw new Error('revoked'); return decoded(token); } },
    authMiddleware: (req, res, next) => { const token = req.get('authorization')?.replace(/^Bearer /, ''); if (!token) return res.status(401).json({ error: 'Authentication required' }); req.user = { uid: token }; next(); }, module: { exports: null } };
  vm.runInNewContext(code, context);
  const app = express(); app.use(express.json()); app.use('/catalog', context.module.exports);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: err.message }));
  const server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = async (method, path, body, token = 'admin') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/catalog${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  return { ...memory, request };
}

test('catalog routes deny unauthenticated customers and nonadmin/unverified/revoked publishing before DB access', async t => {
  const app = await routeServer(t);
  for (const [method, path] of [['POST', '/lookup'], ['GET', '/admin'], ['POST', '/admin/preview'], ['POST', '/admin/entries'], ['PATCH', '/admin/entries/abc']]) {
    assert.equal((await app.request(method, path, fixture(), null)).status, 401);
  }
  for (const token of ['user', 'unverified', 'revoked']) assert.equal((await app.request('POST', '/admin/entries', { ...fixture(), isAdmin: true }, token)).status, 403);
  assert.equal(app.calls.reads, 0); assert.equal(app.calls.writes, 0);
});

test('admin previews are read-only, confirmation is required, and publication makes customer lookup available until deactivation', async t => {
  const app = await routeServer(t);
  const preview = await app.request('POST', '/admin/preview', fixture());
  assert.equal(preview.status, 200); assert.equal(app.calls.writes, 0);
  assert.equal((await app.request('POST', '/admin/entries', fixture())).status, 422);
  const registered = await app.request('POST', '/admin/entries', { ...fixture(), verifiedBy: 'attacker', confirmedQuestionIds: preview.data.questions.map(q => q.id) });
  assert.equal(registered.status, 201); assert.equal(registered.data.entry.verifiedBy, 'admin');
  const response = await app.request('POST', '/lookup', { sourceUrl, applicationUrl }, 'user');
  assert.equal(response.status, 200); assert.equal(response.data.questions.length, 2); assert.equal(response.data.entry.verifiedBy, undefined);
  assert.equal((await app.request('PATCH', `/admin/entries/${registered.data.entry.id}`, { active: true })).status, 422);
  assert.equal((await app.request('PATCH', `/admin/entries/${registered.data.entry.id}`, { active: false })).status, 200);
  assert.equal((await app.request('POST', '/lookup', { sourceUrl, applicationUrl }, 'user')).data.status, 'pending');
});
