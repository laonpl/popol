import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

// The extension directory is deliberately package-manager independent.
const moduleText = await readFile(new URL('./protocol.js', import.meta.url), 'utf8');
const { createConnection, matchesConnection, sanitizeCapture, senderOrigin } =
  await import(`data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`);
const now = Date.now();
const sender = { url: 'https://fitpoly.kr/app/coverletter/new' };
const message = {
  type: 'FITPOLY_CONNECT', nonce: 'a'.repeat(64), expectedOrigin: 'https://recruit.sfa.co.kr',
  company: 'SFA반도체', position: '제조 Operator', expiresAt: now + 14 * 60 * 1000,
};
const capture = {
  version: 1, sourceUrl: 'https://recruit.sfa.co.kr/apply/resume?rnId=1537&gbn=1&token=private#answer', capturedAt: now,
  questions: [{ question: '지원동기를 작성해주세요.', sourceQuote: '지원동기를 작성해주세요. 최대 500자', maxLength: 500, countSpaces: true }],
  warnings: [],
};

test('only explicit FitPoly or local development origins can create a finite connection', () => {
  assert.equal(senderOrigin(sender), 'https://fitpoly.kr');
  assert.equal(senderOrigin({ url: 'http://localhost:5173/app' }), 'http://localhost:5173');
  assert.equal(senderOrigin({ url: 'https://evil.fitpoly.kr/app' }), null);
  assert.equal(senderOrigin({ url: 'https://fitpoly.kr.evil.example/app' }), null);
  assert.equal(senderOrigin({ url: 'http://fitpoly.kr/app' }), null);
  for (const change of [{ nonce: 'short' }, { expectedOrigin: 'http://recruit.sfa.co.kr' },
    { expectedOrigin: 'https://recruit.sfa.co.kr/apply' }, { expiresAt: now + 16 * 60 * 1000 }, { expiresAt: now - 1 }]) {
    assert.equal(createConnection({ ...message, ...change }, sender, now), null);
  }
});

test('poll requests must match the exact requesting origin, nonce and connection age', () => {
  const connection = createConnection(message, sender, now);
  assert.ok(matchesConnection(connection, { nonce: message.nonce }, sender, now));
  assert.equal(matchesConnection(connection, { nonce: 'b'.repeat(64) }, sender, now), false);
  assert.equal(matchesConnection(connection, { nonce: message.nonce }, { url: 'https://www.fitpoly.kr/app' }, now), false);
  assert.equal(matchesConnection(connection, { nonce: message.nonce }, sender, message.expiresAt), false);
});

test('capture accepts reviewed question metadata only and strips URL tokens and unknown fields', () => {
  const connection = createConnection(message, sender, now);
  const sanitized = sanitizeCapture({ ...capture, cookie: 'never retain', answers: ['private'],
    questions: [{ ...capture.questions[0], answer: 'private', name: 'private', value: 'private' }],
    warnings: ['바이트 제한은 글자 수로 바꾸지 않았어요. 지원서의 제한을 확인해주세요.', 'private page text'] }, connection, now);
  assert.equal(sanitized.sourceUrl, 'https://recruit.sfa.co.kr/apply/resume?rnId=1537&gbn=1');
  assert.equal(sanitized.capturedAt, new Date(now).toISOString());
  assert.deepEqual(sanitized.questions, capture.questions);
  assert.deepEqual(sanitized.warnings, ['바이트 제한은 글자 수로 바꾸지 않았어요. 지원서의 제한을 확인해주세요.']);
  assert.equal(JSON.stringify(sanitized).includes('private'), false);
  assert.equal(sanitizeCapture({ ...capture, sourceUrl: 'https://other.example/form' }, connection, now), null);
  assert.equal(sanitizeCapture({ ...capture, questions: Array(13).fill(capture.questions[0]) }, connection, now), null);
  assert.equal(sanitizeCapture({ ...capture, questions: [{ ...capture.questions[0], minLength: 600 }] }, connection, now), null);
});

test('background consumes a capture once and rejects external capture messages', async () => {
  let stored;
  const listeners = {};
  const chrome = {
    runtime: {
      id: 'testextensionid', getURL: (file) => `chrome-extension://testextensionid/${file}`,
      onMessageExternal: { addListener: (listener) => { listeners.external = listener; } },
      onMessage: { addListener: (listener) => { listeners.internal = listener; } },
    },
    storage: { session: {
      get: async (key) => ({ [key]: stored }), set: async (value) => { stored = Object.values(value)[0]; },
      remove: async () => { stored = undefined; },
    } },
  };
  const background = (await readFile(new URL('./background.js', import.meta.url), 'utf8'))
    .replace(/^import\s*\{[\s\S]*?\}\s*from\s*'\.\/protocol\.js';\s*/, '');
  vm.runInNewContext(background, {
    chrome, CONNECTION_KEY: 'connection', connectionIsLive: (value) => !!value && value.expiresAt > Date.now(),
    createConnection, matchesConnection, sanitizeCapture,
  });
  const send = (handler, value, from) => new Promise((resolve) => listeners[handler](value, from, resolve));
  assert.equal((await send('external', message, sender)).status, 'waiting');
  assert.equal((await send('external', { type: 'FITPOLY_CAPTURE', nonce: message.nonce, capture }, sender)).status, 'error');
  const popup = { id: chrome.runtime.id, url: chrome.runtime.getURL('popup.html') };
  assert.equal((await send('internal', { type: 'FITPOLY_CAPTURE', nonce: message.nonce, capture }, { ...popup, url: 'https://evil.example' })).status, 'error');
  assert.equal((await send('internal', { type: 'FITPOLY_CAPTURE', nonce: message.nonce, capture }, popup)).status, 'captured');
  const result = await send('external', { type: 'FITPOLY_POLL', nonce: message.nonce }, sender);
  assert.equal(result.status, 'captured');
  assert.equal(result.capture.questions.length, 1);
  assert.equal((await send('external', { type: 'FITPOLY_POLL', nonce: message.nonce }, sender)).status, 'expired');
  assert.equal((await send('external', message, sender)).status, 'waiting');
  assert.equal((await send('external', { type: 'FITPOLY_CANCEL', nonce: 'b'.repeat(64) }, sender)).status, 'expired');
  assert.ok(stored, 'A different nonce must not remove the valid connection.');
  assert.equal((await send('external', { type: 'FITPOLY_CANCEL', nonce: message.nonce }, sender)).status, 'cancelled');
  assert.equal(stored, undefined);
  stored = { ...createConnection(message, sender), expiresAt: Date.now() - 1 };
  assert.equal((await send('external', { type: 'FITPOLY_POLL', nonce: message.nonce }, sender)).status, 'expired');
  assert.equal(stored, undefined);
});
