// Local synthetic QA: all account/API calls are blocked and store actions are mocked.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = process.env.ROLE_INTAKE_ORIGIN || 'http://127.0.0.1:3005';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-intake-review-'));
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/') || (!url.startsWith(origin) && !url.startsWith('data:'))) return request.abort();
    if (url === `${origin}/__role_intake__`) return request.respond({ contentType: 'text/html', body: '<html><body><div id="test"></div></body></html>' });
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${origin}/__role_intake__`);
  await page.evaluate(async () => {
    const refresh = await import('/@react-refresh');
    refresh.default.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const transformed = await (await fetch('/src/pages/experience/ExperienceChat.jsx')).text();
    const routerVersion = transformed.match(/react-router-dom\.js\?v=([^"']+)/)?.[1];
    const { MemoryRouter } = await import(`/node_modules/.vite/deps/react-router-dom.js${routerVersion ? `?v=${routerVersion}` : ''}`);
    const { default: Chat } = await import('/src/pages/experience/ExperienceChat.jsx');
    const { default: Interview } = await import('/src/pages/experience/ExperienceInterview.jsx');
    const experienceStoreUrl = transformed.match(/from\s+["']([^"']*\/stores\/experienceStore[^"']*)["']/)?.[1];
    const authStoreUrl = transformed.match(/from\s+["']([^"']*\/stores\/authStore[^"']*)["']/)?.[1];
    const { default: experiences } = await import(experienceStoreUrl || '/src/stores/experienceStore.js');
    const { default: auth } = await import(authStoreUrl || '/src/stores/authStore.js');
    await import('/src/index.css');
    auth.setState({ user: { uid: 'local-intake-qa' }, profile: { jobCategory: 'pm' }, loading: false });
    experiences.setState({
      extractMoments: async (source, _, role) => { window.capturedSource = source; window.capturedRole = role; return { moments: [{ id: 'test', title: '합성 테스트 기록', description: 'QA용 기록' }] }; },
      generateInterviewQuestions: async (source, role) => { window.interviewSource = { source, role }; return { questions: [] }; },
    });
    const root = ReactDOM.createRoot(document.getElementById('test'));
    let key = 0;
    window.showIntake = component => root.render(React.createElement(MemoryRouter, { key: ++key }, React.createElement(component === 'interview' ? Interview : Chat)));
    window.showIntake('chat');
  });

  const clickText = async text => {
    await page.waitForFunction(text => [...document.querySelectorAll('button')].some(button => button.textContent.includes(text) && !button.disabled), {}, text);
    await page.evaluate(text => [...document.querySelectorAll('button')].find(button => button.textContent.includes(text) && !button.disabled).click(), text);
  };
  const fillNative = async (selector, value) => {
    await page.waitForSelector(selector);
    await page.$eval(selector, (element, value) => {
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  };
  const startMaterials = async (role, title) => {
    await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('어떤 분야의 경험'));
    await page.evaluate(role => [...document.querySelectorAll('[role="radio"]')].find(element => element.textContent.includes(role)).click(), role);
    await clickText('이 경험으로 시작하기');
    if (role === '마케팅') {
      await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('마케팅'));
      await page.$eval('[role="radio"]', element => element.click());
      await clickText('이 경험으로 시작하기');
    }
    await fillNative('input:not([type="month"])', title);
    await clickText('자료 입력으로 넘어가기');
    await page.waitForSelector('details summary');
    await page.click('details summary');
  };

  await startMaterials('기획', '합성 PM 제품 의사결정');
  await fillNative('details textarea', '고객 인터뷰에서 배송비 안내가 늦다는 불편을 확인했다.');
  assert.equal(await page.$$eval('details textarea', elements => elements.length), 5);
  await page.screenshot({ path: path.join(output, 'pm-intake-desktop.png'), fullPage: true });
  await clickText('이 자료로 초안 만들기');
  await page.waitForFunction(() => !!window.capturedSource);
  assert.equal(await page.evaluate(() => window.capturedRole), 'pm');
  assert.match(await page.evaluate(() => window.capturedSource), /고객 문제와 발견 근거\n고객 인터뷰에서 배송비 안내가 늦다는 불편을 확인했다/);
  assert.doesNotMatch(await page.evaluate(() => window.capturedSource), /예시:|우선순위와 포기한 대안/);

  await page.evaluate(() => { window.capturedSource = ''; window.showIntake('chat'); });
  await startMaterials('마케팅', '합성 캠페인 메시지 실험');
  await page.setViewport({ width: 390, height: 844 });
  await fillNative('details label:nth-of-type(3) textarea', '같은 타깃에 가격 소재와 사용 장면 소재를 비교했다.');
  assert.match(await page.$eval('details', element => element.textContent), /메시지·소재와 실험/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(output, 'marketer-intake-mobile.png'), fullPage: true });
  await clickText('이 자료로 초안 만들기');
  await page.waitForFunction(() => !!window.capturedSource);
  assert.equal(await page.evaluate(() => window.capturedRole), 'marketer');
  assert.match(await page.evaluate(() => window.capturedSource), /메시지·소재와 실험\n같은 타깃에 가격 소재와 사용 장면 소재를 비교했다/);

  await page.evaluate(() => window.showIntake('interview'));
  await page.waitForSelector('select');
  await page.select('select', 'marketer');
  await fillNative('input:not([type="month"])', '합성 마케팅 인터뷰');
  await page.click('details summary');
  await fillNative('details textarea', '기존 고객 설문에서 제품 사용법을 알고 싶다는 응답을 확인했다.');
  await clickText('AI 인터뷰 시작');
  await page.waitForFunction(() => !!window.interviewSource);
  assert.equal(await page.evaluate(() => window.interviewSource.role), 'marketer');
  assert.match(await page.evaluate(() => window.interviewSource.source), /타깃 인사이트와 채널 선택/);
  await page.waitForFunction(() => document.body.textContent.includes('어떤 고객의 어떤 니즈를 찾았고'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, scenarios: ['PM source capture', 'marketer source capture', 'mobile layout', 'role interview fallback'], screenshots: output }));
} finally {
  await browser.close();
}
