// Local synthetic browser QA; all APIs intercepted. No AI or production DB calls.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildCatalogEntry, customerCatalogEntry } from '../src/services/coverLetterQuestionCatalog.js';

const origin = process.env.COVERLETTER_REVIEW_ORIGIN || 'http://127.0.0.1:3004';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-question-catalog-'));
const user = { uid: 'synthetic-admin', email: 'qa@example.invalid', displayName: '테스트 운영자' };
const company = '검증 테스트 기업', position = '테스트 Operator';
const sourceUrl = 'https://www.jobkorea.co.kr/Recruit/GI_Read/50122030';
const applicationUrl = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537';
const sourceEvidenceUrl = 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1537';
const sourceQuestionText = '자기소개서 문항\n1. 지원동기 (700자 이내)\n2. 협업한 경험을 구체적으로 설명해주세요. (500자 이내)';
const form = { company, position, sourceUrl, applicationUrl, sourceEvidenceUrl, sourceQuestionText,
  validFrom: new Date(Date.now() - 86400000).toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() };
const kstInput = iso => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 16);
const experiences = [{ id: 'saved-exp', userId: user.uid, title: '동료와 협업한 경험', content: { rawInput: '동료와 의견을 조율하고 공동 작업의 범위를 정해 역할을 나눴습니다.' } }];
const pendingAnalysis = { company, position, sourceUrl, selectedApplicationUrl: applicationUrl, applicationUrl: sourceEvidenceUrl,
  applicationLinks: [{ label: position, url: applicationUrl }], questionStatus: 'unavailable', applicationAccess: 'registration_required',
  questionNotice: '실제 지원서 문항 확인 요청이 접수됐습니다. 확인된 문항이 준비되면 자동으로 불러옵니다.',
  questions: [], questionCatalog: { status: 'pending', requestId: 'synthetic-pending' }, sources: [], sourceText: '검증 테스트 기업의 테스트 Operator 채용 공고입니다.' };
const draft = { id: 'pending-draft', userId: user.uid, title: '작성 중인 지원서', targetCompany: company, targetPosition: position,
  sourceUrl, analysis: pendingAnalysis, questions: [{ id: 'keep-draft', question: '지원동기', source: 'manual', answer: '보존할 작성 중인 답변', linkedExperienceIds: ['saved-exp'], additionalContext: '보존할 내 메모' }] };
let entry = null, denyAdmin = false;
const calls = [], errors = [], checks = [];
const browser = await puppeteer.launch({ headless: true, pipe: true, args: ['--no-sandbox'] });

async function setup(page) {
  page.on('pageerror', err => errors.push(err.message));
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      const route = new URL(url).pathname.replace(/^.*\/api/, '');
      const method = request.method(); let body = {};
      try { body = JSON.parse(request.postData() || '{}'); } catch {}
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
      const respond = (data, status = 200) => request.respond({ status, contentType: 'application/json', headers, body: JSON.stringify(data) });
      if (method === 'OPTIONS') return request.respond({ status: 204, headers });
      calls.push({ route, method, body });
      if (route.startsWith('/coverletter-catalog/admin') && denyAdmin) return respond({ error: '관리자 권한이 없습니다.' }, 403);
      if (route === '/coverletter-catalog/admin') return respond({ entries: entry ? [entry] : [], requests: [{ id: 'synthetic-pending', sourceUrl, applicationUrl, count: 3, updatedAt: new Date().toISOString() }] });
      if (route === '/coverletter-catalog/admin/preview') {
        try { const value = buildCatalogEntry(body, { verifiedBy: user.uid, preview: true }); return respond({ entry: value, questions: value.questions }); }
        catch (error) { return respond({ error: error.message }, error.status || 422); }
      }
      if (route === '/coverletter-catalog/admin/entries') {
        try { entry = buildCatalogEntry(body, { verifiedBy: user.uid }); assert.deepEqual(body.confirmedQuestionIds, entry.questions.map(q => q.id)); return respond({ entry }, 201); }
        catch (error) { return respond({ error: error.message }, error.status || 422); }
      }
      if (route.startsWith('/coverletter-catalog/admin/entries/') && method === 'PATCH') { entry.active = false; return respond({ entry }); }
      if (route === '/coverletter-catalog/lookup') return respond(entry?.active ? { status: 'verified', entry: customerCatalogEntry(entry), questions: entry.questions } : { status: 'pending', entry: null, questions: [] });
      if (route === '/coverletter/pending-draft') return respond(draft);
      if (route === '/coverletter/list') return respond([draft]);
      if (route === '/experience/list') return respond(experiences);
      if (route === '/billing/wallet') return respond({ balance: 1000 });
      if (route === '/logs/client') return respond({ ok: true });
      return request.abort();
    }
    if (url === `${origin}/__catalog_review__`) return request.respond({ contentType: 'text/html', body: '<html><body><div id="test"></div></body></html>' });
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1050 });
  await page.goto(`${origin}/__catalog_review__`);
}

async function mount(page, initial) {
  await page.evaluate(async ({ user, initial }) => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const transformed = await (await fetch('/src/pages/coverletter/QuestionCatalogAdmin.jsx')).text();
    const version = transformed.match(/react-router-dom\.js\?v=([^"']+)/)?.[1]; const suffix = version ? `?v=${version}` : '';
    const { default: React } = await import(`/node_modules/.vite/deps/react.js${suffix}`);
    const { default: ReactDOM } = await import(`/node_modules/.vite/deps/react-dom_client.js${suffix}`);
    const { createMemoryRouter, RouterProvider } = await import(`/node_modules/.vite/deps/react-router-dom.js${suffix}`);
    const { default: Admin } = await import('/src/pages/coverletter/QuestionCatalogAdmin.jsx');
    const { default: Workspace } = await import('/src/pages/coverletter/CoverLetterWorkspace.jsx');
    const { default: authStore } = await import('/src/stores/authStore.js');
    authStore.setState({ user, loading: false, profileLoading: false, profile: { nameKo: '테스트 운영자' } });
    await import('/src/index.css');
    window.qaRouter = createMemoryRouter([{ path: '/admin/application-questions', element: React.createElement(Admin) },
      { path: '/app/coverletter/edit/:id', element: React.createElement(Workspace) }, { path: '/admin', element: React.createElement('div', {}, '관리자 홈') }], { initialEntries: [initial] });
    window.qaAuth = authStore;
    ReactDOM.createRoot(document.getElementById('test')).render(React.createElement(RouterProvider, { router: window.qaRouter }));
  }, { user, initial });
}

async function click(page, title) {
  const found = await page.evaluate(title => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === title); if (!button || button.disabled) return false; button.click(); return true; }, title);
  assert.ok(found, `clickable ${title}`);
}

try {
  const page = await browser.newPage(); await setup(page); await mount(page, '/admin/application-questions');
  await page.waitForSelector('#catalog-form'); await click(page, '이 공고 문항 등록');
  assert.equal(await page.$eval('.qc-grid input[type=url]', input => input.value), sourceUrl);
  const values = [company, position, sourceUrl, applicationUrl, sourceEvidenceUrl, kstInput(form.validFrom), kstInput(form.expiresAt)];
  await page.evaluate(({ values, sourceQuestionText }) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    [...document.querySelectorAll('.qc-grid input')].forEach((input, index) => { setter.call(input, values[index]); input.dispatchEvent(new Event('input', { bubbles: true })); });
    const textarea = document.querySelector('#catalog-form textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, sourceQuestionText); textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, { values, sourceQuestionText });
  await click(page, '문항 미리 확인'); await page.waitForSelector('.qc-preview');
  assert.equal(await page.$$eval('.qc-question', rows => rows.length), 2);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('검증 문항 등록')).disabled));
  assert.equal(entry, null);
  checks.push('pending request prefill, server-backed preview and explicit verification gate');
  await page.screenshot({ path: path.join(output, 'admin-preview-desktop.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(output, 'admin-preview-mobile.png'), fullPage: true });
  checks.push('administrator screen fits mobile width');
  await page.$$eval('.qc-preview input[type=checkbox]', inputs => inputs.forEach(input => input.click()));
  await click(page, '검증 문항 등록'); await page.waitForFunction(() => document.body.textContent.includes('문항을 등록했습니다.'));
  const published = calls.find(c => c.route === '/coverletter-catalog/admin/entries');
  assert.equal(published.body.originalVerified, true); assert.deepEqual(published.body.confirmedQuestionIds, ['q1', 'q2']);
  assert.equal(Date.parse(published.body.validFrom), Date.parse(form.validFrom.slice(0, 16) + ':00.000Z'));
  checks.push('KST dates and confirmed question IDs publish without AI');
  await click(page, '자동 제공 중단'); await page.waitForFunction(() => document.body.textContent.includes('문항 제공을 중단했습니다.'));
  assert.equal(entry.active, false); checks.push('deactivation stops automatic delivery');
  entry.active = true;

  const customer = await browser.newPage(); await setup(customer); await mount(customer, '/app/coverletter/edit/pending-draft');
  await customer.waitForSelector('.cl-workspace');
  await customer.waitForFunction(() => document.body.textContent.includes('지원서 확인 완료'));
  const text = await customer.$eval('.cl-workspace', element => element.textContent);
  assert.ok(text.includes('협업한 경험을 구체적으로 설명해주세요.'));
  assert.ok(await customer.evaluate(() => [...document.querySelectorAll('textarea')].some(input => input.value === '보존할 작성 중인 답변')));
  assert.ok(calls.some(c => c.route === '/coverletter-catalog/lookup' && c.body.applicationUrl === applicationUrl));
  assert.ok(!calls.some(c => c.route === '/coverletter/analyze' || c.route === '/coverletter/generate' || c.route === '/coverletter/questions/import'));
  await customer.screenshot({ path: path.join(output, 'customer-auto-import-desktop.png'), fullPage: true });
  await customer.setViewport({ width: 390, height: 844 });
  assert.ok(await customer.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await customer.screenshot({ path: path.join(output, 'customer-auto-import-mobile.png'), fullPage: true });
  checks.push('pending customer automatically receives registered questions and retains existing answer without AI or extension');
  denyAdmin = true;
  const denied = await browser.newPage(); await setup(denied); await mount(denied, '/admin/application-questions');
  await denied.waitForFunction(() => document.body.textContent.includes('관리자 권한이 없습니다.'));
  assert.equal(await denied.$('#catalog-form'), null); checks.push('forbidden operator account sees no privileged form or catalog');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, pageErrors: errors, screenshots: output }, null, 2));
} finally { await browser.close(); }
