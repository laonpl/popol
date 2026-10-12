import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicCookieStore, createPublicFetchSession } from '../src/services/publicWebFetch.js';

const roleUrl = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537';
const formUrl = 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1537';

test('anonymous cookies stay on the exact issuing hostname, including across redirect targets', () => {
  const store = createPublicCookieStore();
  store.store(roleUrl, ['SESSID=anonymous; Path=/; Secure; HttpOnly', 'MATCH=ok; Domain=.recruit.sfa.co.kr; Path=/']);
  assert.equal(store.header(formUrl), 'SESSID=anonymous; MATCH=ok');
  for (const target of ['https://sfa.co.kr/apply/resume', 'https://www.recruit.sfa.co.kr/apply/resume', 'https://recruit.sfa.co.kr.evil.example/apply/resume']) {
    assert.equal(store.header(target), '');
  }
  store.store(roleUrl, ['PARENT=ok; Domain=.sfa.co.kr; Path=/', 'FOREIGN=bad; Domain=example.com; Path=/']);
  assert.equal(store.header(formUrl), 'SESSID=anonymous; MATCH=ok; PARENT=ok');
  for (const target of ['https://sfa.co.kr/apply/resume', 'https://www.sfa.co.kr/apply/resume']) {
    assert.equal(store.header(target), '');
  }
});

test('genuine parent Domain cookies establish an issuer-only anonymous session', () => {
  const store = createPublicCookieStore();
  store.store('https://careers.example.com/jobs/42', [
    'PARENT=anonymous; Domain=.example.com; Path=/; Secure',
    'CASE=accepted; Domain=EXAMPLE.COM; Path=/',
    'DEEP=accepted; Domain=.careers.example.com; Path=/apply',
  ]);
  assert.equal(store.header('https://careers.example.com/apply/42'), 'DEEP=accepted; PARENT=anonymous; CASE=accepted');
  for (const target of ['https://example.com/apply/42', 'https://jobs.example.com/apply/42', 'https://www.careers.example.com/apply/42']) {
    assert.equal(store.header(target), '');
  }
  store.store('https://careers.example.com/apply/42', 'PARENT=deleted; Domain=example.com; Path=/; Max-Age=0');
  assert.equal(store.header('https://careers.example.com/apply/42'), 'DEEP=accepted; CASE=accepted');
});

test('Domain requires a well-formed issuer ancestor and excludes registry suffixes and IPs', () => {
  const store = createPublicCookieStore();
  const rejectedDomains = ['com', '.com', '.co.kr', '.co.uk', '.com.au', 'other.com',
    'evil-example.com', 'careers.example.com.evil.com', '..example.com', 'example.com.',
    'bad_label.example.com', '-example.com', `${'x'.repeat(64)}.com`, '', '.', '127.0.0.1'];
  for (const domain of rejectedDomains) {
    store.store('https://careers.example.com/apply', `INVALID=x; Domain=${domain}; Path=/`);
  }
  assert.equal(store.header('https://careers.example.com/apply'), '');
  for (const issuer of ['https://careers.example.co.kr', 'https://careers.example.co.uk', 'https://careers.example.com.au']) {
    const suffix = new URL(issuer).hostname.split('.').slice(-2).join('.');
    store.store(issuer, `SUFFIX=x; Domain=.${suffix}; Path=/`);
    assert.equal(store.header(issuer), '');
  }
  store.store('https://93.184.216.34/apply', 'IP=x; Domain=93.184.216.34; Path=/');
  assert.equal(store.header('https://93.184.216.34/apply'), '');
});

test('cookie Path uses directory defaults and exact segment boundaries', () => {
  const store = createPublicCookieStore();
  store.store(formUrl, ['STEP=one', 'STEP=root; Path=/', 'DEEP=two; Path=/apply/resume/']);
  assert.equal(store.header(formUrl), 'STEP=one; STEP=root');
  assert.equal(store.header('https://recruit.sfa.co.kr/apply/resume/next'), 'DEEP=two; STEP=one; STEP=root');
  assert.equal(store.header('https://recruit.sfa.co.kr/application'), 'STEP=root');
  assert.equal(store.header(roleUrl), 'STEP=root');
  store.store('https://recruit.sfa.co.kr', 'DEFAULT=at-root');
  assert.ok(store.header(roleUrl).includes('DEFAULT=at-root'));
});

test('Secure cookies and cookie-name prefixes keep their declared restrictions', () => {
  const store = createPublicCookieStore();
  store.store(roleUrl, [
    'SECURE=value; Secure; Path=/', 'PLAIN=value; Path=/',
    '__Secure-valid=yes; Secure; Path=/', '__Secure-invalid=no; Path=/',
    '__Host-valid=yes; Secure; Path=/', '__Host-domain=no; Secure; Path=/; Domain=recruit.sfa.co.kr',
    '__Host-path=no; Secure; Path=/apply', '__Host-missingPath=no; Secure',
  ]);
  assert.equal(store.header(formUrl), 'SECURE=value; PLAIN=value; __Secure-valid=yes; __Host-valid=yes');
  assert.equal(store.header('http://recruit.sfa.co.kr/apply/resume'), 'PLAIN=value');
  store.store('http://recruit.sfa.co.kr/apply/resume', 'REJECT=yes; Secure; Path=/');
  assert.ok(!store.header(formUrl).includes('REJECT'));
});

test('expiry, Max-Age precedence, and deletion apply to the matching host/path/name only', () => {
  let instant = Date.parse('2026-10-08T00:00:00Z');
  const store = createPublicCookieStore({ now: () => instant });
  store.store(roleUrl, [
    'SHORT=one; Path=/; Max-Age=2; Expires=Fri, 09 Oct 2026 00:00:00 GMT',
    'EXPIRED=gone; Path=/; Expires=Wed, 07 Oct 2026 00:00:00 GMT',
    'PRIORITY=live; Path=/; Max-Age=20; Expires=Wed, 07 Oct 2026 00:00:00 GMT',
    'SESSID=root; Path=/', 'SESSID=step; Path=/apply',
  ]);
  assert.equal(store.header(formUrl), 'SESSID=step; SHORT=one; PRIORITY=live; SESSID=root');
  instant += 2000;
  assert.ok(!store.header(formUrl).includes('SHORT'));
  store.store(formUrl, 'SESSID=deleted; Path=/apply; Max-Age=0');
  assert.equal(store.header(formUrl), 'PRIORITY=live; SESSID=root');
  store.store(formUrl, 'SESSID=deleted; Path=/; Max-Age=-1');
  assert.equal(store.header(formUrl), 'PRIORITY=live');
  instant += 18_000;
  assert.equal(store.header(formUrl), '');
});

test('replacement, missing Set-Cookie, and malformed cookie headers never inject request headers', () => {
  const store = createPublicCookieStore();
  store.store(roleUrl, undefined);
  store.store(roleUrl, ['SESSID=one; Path=/', 'SESSID=two; Path=/', 'empty=; Path=/', 'quoted="value"; Path=/']);
  store.store(roleUrl, ['bad name=value; Path=/', 'INJECT=x\r\nAuthorization: secret; Path=/', 'space=bad value; Path=/', '=unnamed', 'SEMICOLON=x; Path=/apply\nCookie: x']);
  assert.equal(store.header(formUrl), 'SESSID=two; empty=; quoted=value');
});

test('cookie storage caps the number and byte size of provider-controlled values', () => {
  const store = createPublicCookieStore();
  store.store(roleUrl, `TOO_BIG=${'x'.repeat(2200)}; Path=/`);
  assert.equal(store.header(formUrl), '');
  store.store(roleUrl, Array.from({ length: 40 }, (_, index) => `c${index}=${'x'.repeat(700)}; Path=/`));
  const header = store.header(formUrl);
  assert.ok(Buffer.byteLength(header) < 8192);
  assert.ok(header.split('; ').length <= 24);
  assert.ok(!header.includes('c0='));
  assert.ok(header.includes('c39='));
  const smallStore = createPublicCookieStore();
  smallStore.store(roleUrl, Array.from({ length: 40 }, (_, index) => `c${index}=small; Path=/`));
  assert.equal(smallStore.header(formUrl).split('; ').length, 24);
  assert.ok(smallStore.header(formUrl).startsWith('c16='));
});

test('fresh scrape stores and session factories are independent', () => {
  const firstStore = createPublicCookieStore();
  const secondStore = createPublicCookieStore();
  firstStore.store(roleUrl, 'SESSID=first; Path=/');
  assert.equal(secondStore.header(formUrl), '');
  assert.notEqual(createPublicFetchSession(), createPublicFetchSession());
});

test('anonymous session transport still rejects private URLs and unsupported registration POSTs', async () => {
  const session = createPublicFetchSession();
  await assert.rejects(session('https://127.0.0.1/resume'), error => error.status === 400);
  await assert.rejects(session('https://recruit.sfa.co.kr/apply/resumesave', { method: 'POST', body: '{}' }), error => error.status === 400);
  await assert.rejects(session('https://jasoseol.com/employment/employment_question.json', { method: 'POST', body: 'x'.repeat(2001) }), error => error.status === 400);
});
