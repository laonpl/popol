// Synthetic local UI QA. Every API request is intercepted; no account, database or AI is contacted.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { importCoverLetterQuestions, generateCoverLetterAnswer } from '../src/services/coverLetterService.js';

const origin = process.env.COVERLETTER_REVIEW_ORIGIN || 'http://127.0.0.1:3004';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-coverletter-review-'));
const user = { uid: 'synthetic-coverletter-user', email: 'qa@example.invalid', displayName: '테스트 지원자' };
const evidenceQuote = '나는 사용자 인터뷰 6건을 진행하고 가입 단계의 안내 문구를 수정했다. 이후 팀에 개선안을 공유했다. 전환율은 측정하지 못했다.';
const experiences = [
  { id: 'exp-interviews', userId: user.uid, title: '가입 안내 개선', jobCategory: 'pm', content: { problem: '첫 가입 방법이 복잡하다는 문의', action: evidenceQuote, result: '팀에 개선안을 공유하고 안내 문구를 반영했다.' } },
  { id: 'exp-collaboration', userId: user.uid, title: '개발자와 협업한 일정 조율', jobCategory: 'pm', content: { action: '나는 개발 담당자와 매주 일정과 작업 범위를 조율했다.', result: '정해진 범위의 기능을 출시했다.' } },
  { id: 'exp-poster', userId: user.uid, title: '행사 포스터 제작', jobCategory: 'designer', keywords: ['디자인'], content: { action: '학교 행사 포스터를 제작하고 인쇄용 파일을 전달했다.' } },
];
const analysis = {
  company: '가상 기업', position: '프로덕트 매니저', summary: '사용자 문제를 분석하고 제품의 개선 순서를 판단하는 역할입니다.',
  business: '사용자의 가입 경험을 개선하는 서비스', rolePriorities: ['사용자 인터뷰', '제품 개선', '협업'],
  companyInsights: [{ text: '사용자의 문제를 직접 확인하는 실행을 중시합니다.', sourceId: 'posting-1', sourceQuote: '담당 업무: 사용자 인터뷰를 통한 제품 개선' }],
  writingPoints: ['문제를 확인한 방법과 직접 한 행동을 연결하세요.'],
  sources: [{ id: 'posting-1', title: '가상 기업 채용 공고', url: 'https://example.invalid/jobs/pm', type: 'posting' }],
  uncertainties: ['경영 성과와 최신 뉴스는 이 공고에서 확인하지 못했습니다.'],
  questions: [
    { id: 'q-official', question: '사용자 인터뷰를 바탕으로 제품을 개선한 경험을 작성해주세요.', maxLength: 500, countSpaces: true, source: 'posting', validation: 'verified', sourceQuote: '1. 사용자 인터뷰를 바탕으로 제품을 개선한 경험을 작성해주세요. (500자 이내)', answer: '', linkedExperienceIds: [] },
    { id: 'q-collaboration', question: '팀과 협업하며 배운 점을 작성해주세요.', maxLength: 400, countSpaces: false, source: 'posting', validation: 'verified', sourceQuote: '2. 팀과 협업하며 배운 점을 작성해주세요. (공백 제외 400자 이내)', answer: '', linkedExperienceIds: [] },
  ],
  questionStatus: 'verified',
  questionNotice: '지원서 원문에서 확인한 자기소개서 문항입니다.',
  sourceText: '가상 기업 프로덕트 매니저 채용\n담당 업무: 사용자 인터뷰를 통한 제품 개선\n1. 사용자 인터뷰를 바탕으로 제품을 개선한 경험을 작성해주세요. (500자 이내)\n2. 팀과 협업하며 배운 점을 작성해주세요. (공백 제외 400자 이내)',
  sourceInputText: '',
  sourceUrl: 'https://example.invalid/jobs/pm',
};
const suppliedUrl = 'https://www.jobkorea.co.kr/Recruit/GI_Read/50122030?Oem_Code=C1&PageGbn=ST&sc=419';
const applicationLinks = [
  { label: '설비 Operation', url: 'https://apply.example.invalid/operations' },
  { label: '제조기술', url: 'https://apply.example.invalid/manufacturing' },
  { label: '기술 엔지니어', url: 'https://apply.example.invalid/engineering' },
];
const missingAnalysis = {
  ...analysis, company: 'SFA반도체', position: '반도체 설비 Operation', sourceUrl: suppliedUrl,
  sourceText: '고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자 우대조건 반도체 후공정 Operator 경험자 우대',
  sources: [{ id: 'posting-1', title: 'SFA반도체 채용 공고', url: suppliedUrl, type: 'posting' }],
  questions: [], questionStatus: 'selection_required', applicationLinks,
  questionNotice: '여러 지원서가 연결되어 있어요. 지원할 모집 분야를 선택하고 실제 지원서 문항을 확인해주세요.',
};
const draftAnswer = '가입 절차를 어려워하는 사용자가 어디에서 막히는지 확인하고자 인터뷰 6건을 진행했습니다. 저는 인터뷰에서 나온 질문을 정리하고 가입 단계의 안내 문구를 수정했습니다. 개선안을 팀에 공유하면서 사용자의 표현을 안내에 반영하는 기준을 배웠습니다. 전환율은 측정하지 못했지만, 문제를 직접 확인하고 수정안을 만드는 과정은 익혔습니다.';
let saved = null, failGeneration = false, failSave = false, analysisResponse = analysis;
const apiRequests = [], errors = [], checks = [];
const browser = await puppeteer.launch({ headless: true, pipe: true, args: ['--no-sandbox'] });
console.log('Synthetic browser started.');

try {
  const page = await browser.newPage();
  page.on('pageerror', error => { errors.push(error.message); console.error(`UI error: ${error.message}`); });
  page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      const pathname = new URL(url).pathname.replace(/^.*\/api/, '');
      const method = request.method();
      let body = {};
      try { body = JSON.parse(request.postData() || '{}'); } catch { /* form data is unused */ }
      if (method !== 'OPTIONS') apiRequests.push({ pathname, method, body });
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
      const respond = (value, status = 200) => request.respond({ status, contentType: 'application/json', headers, body: JSON.stringify(value) });
      if (method === 'OPTIONS') return request.respond({ status: 204, headers });
      if (pathname === '/billing/wallet') return respond({ balance: 1000, totalCharged: 1000, totalUsed: 0 });
      if (pathname === '/experience/list') return respond(experiences);
      if (pathname === '/coverletter/list') return respond(saved ? [saved] : []);
      if (pathname === '/coverletter/analyze') return respond({ analysis: analysisResponse });
      if (pathname === '/coverletter/questions/import') {
        try { return respond(importCoverLetterQuestions(body)); }
        catch (error) { return respond({ error: error.message }, error.status || 400); }
      }
      if (pathname === '/coverletter/generate') {
        if (failGeneration) return respond({ error: '합성 테스트: 잠시 후 다시 작성해주세요.' }, 429);
        if (body.question?.id === 'food-topic') {
          void generateCoverLetterAnswer(body, experiences.filter(item => body.experienceIds?.includes(item.id)), {
            generateAI: async () => JSON.stringify({ status: 'draft', answer: body.additionalContext,
              evidence: [{ experienceId: 'user-input', quote: body.additionalContext }], warnings: [] }),
          }).then(result => respond(result)).catch(error => respond({ error: error.message }, error.status || 500));
          return;
        }
        return respond({ answer: draftAnswer, linkedExperienceIds: ['exp-interviews'], evidence: [{ experienceId: 'exp-interviews', quote: evidenceQuote }], warnings: ['실제 전환율 수치는 기록되지 않았습니다.'], review: { unverifiedNumbers: [], withinLimit: true } });
      }
      if (pathname === '/coverletter' && method === 'POST') {
        if (failSave) return respond({ error: '합성 테스트: 저장에 실패했습니다.' }, 503);
        saved = { ...body, id: 'letter-synthetic', userId: user.uid, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        return respond(saved, 201);
      }
      if (pathname === '/coverletter/letter-synthetic' && method === 'GET') return respond(saved || { error: '없음' }, saved ? 200 : 404);
      if (pathname === '/coverletter/letter-synthetic' && method === 'PATCH') {
        if (failSave) return respond({ error: '합성 테스트: 저장에 실패했습니다.' }, 503);
        saved = { ...saved, ...body, updatedAt: new Date().toISOString() };
        return respond(saved);
      }
      if (pathname === '/coverletter/letter-synthetic' && method === 'DELETE') { saved = null; return respond({ success: true }); }
      if (pathname === '/logs/client') return respond({ success: true });
      return request.abort();
    }
    if (url === `${origin}/__coverletter_review__`) return request.respond({ contentType: 'text/html', body: '<html><body><div id="test"></div></body></html>' });
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) return request.abort();
    return request.continue();
  });

  await page.setViewport({ width: 1440, height: 1050 });
  await page.goto(`${origin}/__coverletter_review__`);
  console.log('Local review shell loaded.');
  await page.evaluate(async ({ user }) => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    // Match Vite's optimized version query so router contexts are not instantiated twice.
    const transformed = await (await fetch('/src/pages/coverletter/CoverLetterWorkspace.jsx')).text();
    const version = transformed.match(/react-router-dom\.js\?v=([^"']+)/)?.[1];
    const suffix = version ? `?v=${version}` : '';
    const { default: React } = await import(`/node_modules/.vite/deps/react.js${suffix}`);
    const { default: ReactDOM } = await import(`/node_modules/.vite/deps/react-dom_client.js${suffix}`);
    const { createMemoryRouter, RouterProvider } = await import(`/node_modules/.vite/deps/react-router-dom.js${suffix}`);
    const { default: Hub } = await import('/src/pages/coverletter/CoverLetterHub.jsx');
    const { default: Workspace } = await import('/src/pages/coverletter/CoverLetterWorkspace.jsx');
    const { default: Layout } = await import('/src/components/Layout.jsx');
    const { default: authStore } = await import('/src/stores/authStore.js');
    const { default: letters } = await import('/src/stores/coverLetterStore.js');
    await import('/src/index.css');
    const root = ReactDOM.createRoot(document.getElementById('test'));
    window.authStore = authStore; window.letterStore = letters; window.qaUser = user;
    authStore.setState({ user: null, profile: null, loading: false, profileLoading: false });
    window.qaRouter = createMemoryRouter([
      { element: React.createElement(Layout), children: [
        { path: '/app/coverletter', element: React.createElement(Hub) },
        { path: '/app/coverletter/new', element: React.createElement(Workspace) },
        { path: '/app/coverletter/edit/:id', element: React.createElement(Workspace) },
        { path: '/app/portfolio', element: React.createElement(Hub) },
        { path: '/app/portfolio/coverletter/new', element: React.createElement(Workspace) },
        { path: '/app/portfolio/coverletter/edit/:id', element: React.createElement(Workspace) },
      ] },
      { path: '/login', element: React.createElement('div', { id: 'login-sentinel' }, 'Synthetic login destination') },
    ], { initialEntries: ['/app/coverletter'] });
    root.render(React.createElement(RouterProvider, { router: window.qaRouter }));
  }, { user });

  await page.waitForSelector('.cl-hub');
  console.log('Cover letter hub mounted.');
  assert.match(await page.$eval('.cl-hub', element => element.textContent), /첫 자기소개서/);
  assert.equal(apiRequests.filter(request => request.pathname.startsWith('/coverletter')).length, 0, 'guest hub makes no private requests');
  await capture(page, 'hub-guest-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'guest hub fits mobile width');
  await capture(page, 'hub-guest-mobile.png');
  await page.setViewport({ width: 1440, height: 1050 });
  await clickButton(page, '공고로 시작하기');
  await page.waitForSelector('#login-sentinel');
  assert.equal(await page.evaluate(() => window.qaRouter.state.location.state.from), '/app/portfolio/coverletter/new');
  checks.push('guest hub and intended login return');

  await page.evaluate(async () => {
    window.authStore.setState({ user: window.qaUser, profile: { nameKo: '테스트 지원자', profileSetupCompleted: true } });
    await window.qaRouter.navigate('/app/coverletter/new');
  });
  await page.waitForSelector('.cl-workspace');
  await clickButton(page, '지원할 공고 찾아보기');
  const portalLinks = await page.$$eval('.cl-input-panel a[target="_blank"]', elements => elements.map(element => ({ href: element.href, rel: element.rel })));
  assert.deepEqual(portalLinks.map(link => link.href), [
    'https://www.jobkorea.co.kr/starter/calendar',
    'https://calendar.saramin.co.kr/',
    'https://jasoseol.com/recruit',
  ]);
  assert.ok(portalLinks.every(link => link.rel.includes('noopener') && link.rel.includes('noreferrer')));
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'job-site dropdown fits mobile width');
  await capture(page, 'job-sites-mobile.png');
  await page.setViewport({ width: 1440, height: 1050 });
  await clickButton(page, '지원할 공고 찾아보기');
  checks.push('cover letter links reuse portfolio recruiting calendars and fit mobile width');

  analysisResponse = missingAnalysis;
  await replaceText(page, '.cl-input-panel input[type=url]', suppliedUrl);
  await clickButton(page, '공고·기업 분석하기');
  await page.waitForSelector('.cl-question-missing');
  assert.equal(await page.$$eval('.cl-question-nav button', elements => elements.length), 0, 'job requirements never populate the question list');
  assert.equal(await page.$$eval('.cl-source-suggested', elements => elements.length), 0, 'missing official questions do not create recommended placeholders');
  assert.equal(await page.$$eval('.cl-application-options a', elements => elements.length), 3);
  assert.deepEqual(await page.$$eval('.cl-application-options a', elements => elements.map(element => element.href)), applicationLinks.map(link => link.url));
  await capture(page, 'questions-select-application-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'application role choices fit mobile width');
  await capture(page, 'questions-select-application-mobile.png');
  await capture(page, 'questions-select-application-mobile-options.png', 'bottom');
  await page.setViewport({ width: 1440, height: 1050 });
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.disabled), false, 'analysis without public questions still allows the writing step');
  await page.click('.cl-steps button:nth-child(3)');
  await page.waitForFunction(() => document.querySelector('.cl-steps button:nth-child(3)')?.getAttribute('aria-current') === 'step');
  assert.equal(await page.$$eval('.cl-next-row button', elements => elements.find(element => element.textContent.includes('자소서 작성하기')).disabled), false, 'the writing CTA remains usable when question extraction is unavailable');
  await clickButton(page, '자소서 작성하기');
  await page.waitForSelector('textarea[aria-label="작성할 자기소개서 문항"]');
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.getAttribute('aria-current')), 'step');
  assert.equal(await page.$eval('textarea[aria-label="작성할 자기소개서 문항"]', element => element.value), '', 'writing starts with an honest empty manual question rather than invented official wording');
  assert.equal(await page.$$eval('.cl-source-posting, .cl-source-suggested', elements => elements.length), 0);
  assert.equal(await page.$$eval('.cl-answer-toolbar button', elements => elements.find(element => element.textContent.includes('경험으로 초안 쓰기')).disabled), true, 'a blank question cannot call generation');
  await capture(page, 'writing-empty-manual-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'direct manual writing intake fits mobile width');
  await capture(page, 'writing-empty-manual-mobile.png');
  await capture(page, 'writing-empty-manual-mobile-input.png', 'bottom');
  await page.setViewport({ width: 1440, height: 1050 });
  await page.click('.cl-steps button:nth-child(2)');
  await page.click('.cl-application-options input[type=radio]');
  analysisResponse = { ...missingAnalysis, questionStatus: 'unavailable', selectedApplicationUrl: applicationLinks[0].url, applicationUrl: applicationLinks[0].url, questionNotice: '지원서는 로그인 후 확인할 수 있어요. 실제 문항을 복사해 붙여넣어주세요.' };
  await clickButton(page, '이 직무 문항 가져오기');
  await page.waitForSelector('.cl-writing-intake-notice');
  const roleRequest = apiRequests.filter(request => request.pathname === '/coverletter/analyze').at(-1);
  assert.equal(roleRequest.body.applicationUrl, applicationLinks[0].url);
  assert.notEqual(roleRequest.body.questionImport, true, 'selecting a role is not a pasted-question import');
  assert.ok(!roleRequest.body.text, 'scraped job body is not resubmitted as user-supplied questions');
  await page.waitForSelector('textarea[aria-label="작성할 자기소개서 문항"]');
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.getAttribute('aria-current')), 'step', 'role lookup without questions goes directly to actionable writing');
  assert.equal(await page.$$eval('.cl-source-posting, .cl-source-suggested', elements => elements.length), 0);
  assert.equal(await page.$eval('textarea[aria-label="작성할 자기소개서 문항"]', element => element.value), '');
  assert.equal(await page.$eval('.cl-writing-intake-notice a.cl-button', element => element.href), applicationLinks[0].url);
  await capture(page, 'questions-login-required-desktop.png');

  await clickButton(page, '저장');
  await page.waitForFunction(() => document.querySelector('.cl-save-state')?.textContent === '저장됨');
  assert.equal(saved.analysis.selectedApplicationUrl, applicationLinks[0].url, 'saving the empty writing intake preserves the selected application role');
  assert.equal(saved.analysis.applicationUrl, applicationLinks[0].url);
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-letter-card');
  await page.click('.cl-card-link');
  await page.waitForSelector('textarea[aria-label="작성할 자기소개서 문항"]');
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.getAttribute('aria-current')), 'step', 'a saved blank writing draft reopens in the writing step');
  assert.equal(await page.$eval('.cl-writing-intake-notice a.cl-button', element => element.href), applicationLinks[0].url, 'reopening preserves the selected role link');
  const manualQuestion = '사용자 인터뷰를 바탕으로 제품을 개선한 경험을 작성해주세요.';
  await replaceText(page, 'textarea[aria-label="작성할 자기소개서 문항"]', manualQuestion);
  await page.waitForSelector('.cl-recommendation-card');
  assert.equal(await page.$eval('.cl-recommendation-card', element => element.dataset.experienceId), 'exp-interviews');
  assert.match(await page.$eval('.cl-recommendation-evidence', element => element.textContent), /사용자 인터뷰 6건/);
  assert.equal(await page.$$eval('.cl-answer-toolbar button', elements => elements.find(element => element.textContent.includes('경험으로 초안 쓰기')).disabled), true, 'typing an actual question still requires choosing an experience');
  const beforeManualGeneration = apiRequests.filter(request => request.pathname === '/coverletter/generate').length;
  await page.click('.cl-recommendation-card:first-child input');
  await clickButton(page, '경험으로 초안 쓰기');
  await page.waitForFunction(answer => document.querySelector('.cl-answer-editor')?.value === answer, {}, draftAnswer);
  const manualGeneration = apiRequests.filter(request => request.pathname === '/coverletter/generate').at(-1);
  assert.equal(apiRequests.filter(request => request.pathname === '/coverletter/generate').length, beforeManualGeneration + 1);
  assert.equal(manualGeneration.body.question.question, manualQuestion);
  assert.equal(manualGeneration.body.question.source, 'manual');
  assert.deepEqual(manualGeneration.body.experienceIds, ['exp-interviews']);
  assert.equal(manualGeneration.body.analysis.selectedApplicationUrl, applicationLinks[0].url);
  await capture(page, 'writing-manual-recommended-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'manual question and inline recommendations fit mobile width');
  await capture(page, 'writing-manual-recommended-mobile.png');
  await page.setViewport({ width: 1440, height: 1050 });
  checks.push('no-question writing CTA and step navigation stay active; role lookup opens manual writing; prompt and experience guard generation; recommendations visible in writing; blank save and role-preserving reopen');

  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-hub');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter/new'));
  await page.waitForSelector('.cl-input-panel');
  analysisResponse = missingAnalysis;
  await replaceText(page, '.cl-input-panel input[type=url]', suppliedUrl);
  await clickButton(page, '공고·기업 분석하기');
  await page.waitForSelector('.cl-application-options');
  await page.click('.cl-application-options input[type=radio]');
  analysisResponse = { ...missingAnalysis, questionStatus: 'unavailable', selectedApplicationUrl: applicationLinks[0].url, applicationUrl: applicationLinks[0].url };
  await clickButton(page, '이 직무 문항 가져오기');
  await page.waitForSelector('.cl-writing-intake-notice');
  await clickButton(page, '지원서 문항 붙여넣기');
  await page.waitForSelector('.cl-question-paste textarea', { visible: true });
  assert.equal(await page.$eval('.cl-question-paste textarea', element => element.value), '', 'pasted-question input excludes scraped requirements');
  const pastedQuestion = '지원 동기 (500자 이내)';
  const importedQuestion = { ...analysis.questions[0], question: '지원 동기', sourceQuote: pastedQuestion };
  await replaceText(page, '.cl-question-paste textarea', pastedQuestion);
  analysisResponse = { ...analysis, questions: [importedQuestion], sourceInputText: pastedQuestion, sourceText: `${missingAnalysis.sourceText}\n[직접 입력한 지원서 문항]\n자기소개서 문항\n${pastedQuestion}`, applicationLinks, applicationUrl: applicationLinks[0].url };
  await clickButton(page, '붙여넣은 문항 가져오기');
  await page.waitForSelector('.cl-answer-panel .cl-source-posting');
  await page.waitForFunction(() => !document.querySelector('.cl-writing-intake-notice'));
  const importRequest = apiRequests.filter(request => request.pathname === '/coverletter/analyze').at(-1);
  assert.equal(importRequest.body.text, pastedQuestion);
  assert.equal(importRequest.body.questionImport, true);
  assert.equal(await page.$$eval('.cl-question-nav button', elements => elements.length), 1);
  assert.equal(await page.$eval('.cl-answer-heading h3', element => element.textContent), importedQuestion.question);
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.getAttribute('aria-current')), 'step', 'pasting actual questions in writing keeps the user in writing');
  await capture(page, 'questions-pasted-confirmed-desktop.png');
  checks.push('provided JobKorea URL: no false or default questions, distinct role selection, login notice, actual pasted question import');

  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-hub');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter/new'));
  await page.waitForSelector('.cl-input-panel');
  analysisResponse = missingAnalysis;
  await replaceText(page, '.cl-input-panel input[type=url]', suppliedUrl);
  await clickButton(page, '공고·기업 분석하기');
  await page.waitForSelector('.cl-application-options');
  await page.click('.cl-application-options label:nth-child(2) input[type=radio]');
  analysisResponse = { ...analysis, sourceUrl: suppliedUrl, position: applicationLinks[1].label, applicationLinks, selectedApplicationUrl: applicationLinks[1].url, applicationUrl: applicationLinks[1].url };
  await clickButton(page, '이 직무 문항 가져오기');
  await page.waitForSelector('.cl-answer-panel .cl-source-posting');
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.getAttribute('aria-current')), 'step', 'verified selected-role questions also open writing immediately');
  assert.equal(apiRequests.filter(request => request.pathname === '/coverletter/analyze').at(-1).body.applicationUrl, applicationLinks[1].url);
  assert.equal(await page.$$eval('.cl-writing-sidebar .cl-question-nav button', elements => elements.length), 2);
  assert.equal(await page.$('textarea[aria-label="작성할 자기소개서 문항"]'), null, 'verified imported questions retain official provenance until the user edits them');
  assert.equal(await page.$$eval('.cl-experience-card.is-selected', elements => elements.length), 0, 'automatic question retrieval never chooses experiences on behalf of the user');
  assert.equal(await page.$$eval('.cl-answer-toolbar button', elements => elements.find(element => element.textContent.includes('경험으로 초안 쓰기')).disabled), true);
  await page.waitForSelector('.cl-recommendation-card');
  await page.click('.cl-recommendation-card:first-child input');
  assert.equal(await page.$$eval('.cl-answer-toolbar button', elements => elements.find(element => element.textContent.includes('경험으로 초안 쓰기')).disabled), false);
  await page.click('.cl-writing-sidebar .cl-question-nav button:nth-child(2)');
  await page.waitForFunction(() => document.querySelector('.cl-recommendation-card')?.dataset.experienceId === 'exp-collaboration');
  assert.equal(await page.$$eval('.cl-experience-card.is-selected', elements => elements.length), 0);
  assert.equal(await page.$$eval('.cl-answer-toolbar button', elements => elements.find(element => element.textContent.includes('경험으로 초안 쓰기')).disabled), true, 'experience linking in direct writing remains isolated per question');
  await capture(page, 'writing-role-verified-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'selected-role questions and inline experience choices fit mobile width');
  await capture(page, 'writing-role-verified-mobile.png');
  await page.setViewport({ width: 1440, height: 1050 });
  checks.push('successful role question retrieval opens writing; preserves official question provenance; per-question recommendation and explicit experience selection remain intact');

  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-hub');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter/new'));
  await page.waitForSelector('.cl-input-panel');
  analysisResponse = analysis;
  await capture(page, 'workspace-empty-desktop.png');
  await replaceText(page, '.cl-input-panel input[type=url]', analysis.sourceUrl);
  await clickButton(page, '공고·기업 분석하기');
  await page.waitForSelector('.cl-analysis-grid');
  assert.match(await page.$eval('.cl-analysis-summary', element => element.textContent), /가상 기업/);
  assert.equal(await page.$eval('.cl-source-links a', element => element.href), analysis.sourceUrl);
  assert.match(await page.$eval('.cl-insight-list', element => element.textContent), /담당 업무: 사용자 인터뷰를 통한 제품 개선/);
  assert.match(await page.$eval('.cl-analysis-sources', element => element.textContent), /最新|최신 뉴스/);
  await capture(page, 'analysis-desktop.png');
  checks.push('analysis sources, source excerpts and uncertainty disclosure');

  await clickButton(page, '문항·경험 연결하기');
  await page.waitForSelector('.cl-mapping-layout');
  assert.equal(await page.$$eval('.cl-question-nav .cl-source-posting', elements => elements.length), 2);
  assert.equal(await page.$$eval('.cl-question-nav .cl-source-suggested', elements => elements.length), 0);
  assert.match(await page.$eval('.cl-notice', element => element.textContent), /지원서 원문에서 확인/);
  await page.click('.cl-question-panel .cl-source-quote summary');
  assert.equal(await page.$eval('.cl-question-panel blockquote', element => element.textContent), analysis.questions[0].sourceQuote);
  await replaceLabeledNumber(page, '최소 글자 수', '100');
  assert.equal(await page.$$eval('.cl-limit-row label', elements => elements.find(element => element.textContent.includes('최소 글자 수')).querySelector('input').value), '100');
  await page.waitForSelector('.cl-experience-card');
  await page.waitForSelector('.cl-recommendation-card');
  assert.equal(await page.$eval('.cl-recommendation-card', element => element.dataset.experienceId), 'exp-interviews');
  assert.match(await page.$eval('.cl-recommendation-reasons', element => element.textContent), /문항 연결.*인터뷰/s);
  assert.match(await page.$eval('.cl-recommendation-evidence', element => element.textContent), /사용자 인터뷰 6건/);
  assert.ok(await page.evaluate(() => Boolean(document.querySelector('.cl-recommended-experiences').compareDocumentPosition(document.querySelector('.cl-other-experiences')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'recommendations appear before other experiences');
  await (await page.$('.cl-recommended-experiences')).screenshot({ path: path.join(output, 'recommended-experiences-desktop.png') });
  await page.click('.cl-question-nav button:nth-child(2)');
  await page.waitForFunction(() => document.querySelector('.cl-recommendation-card')?.dataset.experienceId === 'exp-collaboration');
  assert.match(await page.$eval('.cl-recommendation-reasons', element => element.textContent), /협업|조율/);
  await page.click('.cl-recommendation-card:first-child input');
  await page.click('.cl-question-nav button:first-child');
  await page.waitForFunction(() => document.querySelector('.cl-recommendation-card')?.dataset.experienceId === 'exp-interviews');
  assert.equal(await page.$$eval('.cl-experience-card.is-selected', elements => elements.length), 0, 'experience selection belongs to its own question');
  await replaceText(page, 'input[aria-label="다른 경험 검색"]', '포스터');
  assert.equal(await page.$$eval('.cl-other-experiences .cl-experience-card', elements => elements.length), 1);
  assert.equal(await page.$eval('.cl-other-experiences .cl-experience-card', element => element.dataset.experienceId), 'exp-poster');
  await page.click('.cl-other-experiences .cl-experience-card input');
  assert.equal(await page.$eval('.cl-other-experiences .cl-experience-card input', element => element.checked), true, 'non-recommended experience can still be selected');
  await page.click('.cl-other-experiences .cl-experience-card input');
  await replaceText(page, 'input[aria-label="다른 경험 검색"]', '');
  await page.click('.cl-experience-card:first-child input');
  assert.equal(await page.$$eval('.cl-experience-card.is-selected', elements => elements.length), 1);
  await capture(page, 'mapping-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mapping fits mobile width');
  await (await page.$('.cl-recommended-experiences')).screenshot({ path: path.join(output, 'recommended-experiences-mobile.png') });
  await capture(page, 'mapping-mobile.png');
  await capture(page, 'mapping-mobile-experiences.png', 'bottom');
  checks.push('only verified application questions imported; experience and question source selection');
  checks.push('recommended experience first with visible reason and literal source; question switch changes ranking; searchable other experiences stay selectable');

  await page.setViewport({ width: 1440, height: 1050 });
  await clickButton(page, '자소서 작성하기');
  await page.waitForSelector('.cl-answer-editor');
  await clickButton(page, '경험으로 초안 쓰기');
  await page.waitForFunction(answer => document.querySelector('.cl-answer-editor')?.value === answer, {}, draftAnswer);
  const officialGeneration = apiRequests.find(request => request.pathname === '/coverletter/generate' && request.body.question.id === 'q-official');
  assert.deepEqual(officialGeneration.body.experienceIds, ['exp-interviews']);
  assert.equal(officialGeneration.body.question.id, 'q-official');
  assert.match(await page.$eval('.cl-answer-panel', element => element.textContent), /실제 전환율 수치는 기록되지/);
  await page.click('.cl-answer-panel .cl-source-quote summary');
  assert.match(await page.$eval('.cl-answer-panel .cl-source-quote', element => element.textContent), /전환율은 측정하지 못했다/);
  await capture(page, 'writing-desktop.png');
  await capture(page, 'writing-evidence-desktop.png', 'bottom');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'answer editor fits mobile width');
  await capture(page, 'writing-mobile.png');
  await capture(page, 'writing-mobile-evidence.png', 'bottom');
  checks.push('generation uses selected experience IDs; evidence and missing metric warning rendered');

  await page.setViewport({ width: 1440, height: 1050 });
  const longAnswer = '가'.repeat(510);
  await replaceText(page, '.cl-answer-editor', longAnswer);
  await page.waitForSelector('.cl-answer-count .is-over');
  assert.match(await page.$eval('.cl-answer-count', element => element.textContent), /510\s*\/\s*500/);
  assert.equal(await page.$eval('.cl-next-row input[type=checkbox]', element => element.disabled), true, 'over-limit answers cannot be marked complete');
  assert.equal(await page.$('.cl-answer-panel .cl-source-quote'), null, 'manually edited answer removes stale AI citations');
  failGeneration = true;
  await clickButton(page, '초안 다시 쓰기');
  await page.waitForSelector('[role=alertdialog]');
  await clickButton(page, '계속하기');
  await page.waitForSelector('.cl-error');
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), longAnswer, 'generation failure preserves typed answer');
  assert.match(await page.$eval('.cl-error', element => element.textContent), /합성 테스트/);
  failGeneration = false;
  checks.push('live character limit, completion guard, edited citation reset, retry failure preserves draft');

  const editedAnswer = `${draftAnswer}\n다음에는 인터뷰 내용을 먼저 분류해 팀과 함께 우선순위를 정하겠습니다.`;
  await replaceText(page, '.cl-answer-editor', editedAnswer);
  failSave = true;
  await clickButton(page, '저장');
  await page.waitForFunction(() => document.querySelector('.cl-error')?.textContent.includes('저장에 실패'));
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), editedAnswer, 'save failure preserves typed answer');
  assert.match(await page.$eval('.cl-save-state', element => element.textContent), /저장하지 않은/);
  failSave = false;
  await clickButton(page, '저장');
  await page.waitForFunction(() => document.querySelector('.cl-save-state')?.textContent === '저장됨');
  assert.equal(saved.questions[0].answer, editedAnswer);
  assert.deepEqual(saved.questions[0].linkedExperienceIds, ['exp-interviews']);
  assert.equal(saved.questions[1].source, 'posting');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-letter-card');
  assert.match(await page.$eval('.cl-letter-card', element => element.textContent), /1\/2 문항 작성/);
  await capture(page, 'hub-saved-desktop.png');
  await page.click('.cl-card-link');
  await page.waitForSelector('.cl-answer-editor');
  await page.waitForFunction(answer => document.querySelector('.cl-answer-editor')?.value === answer, {}, editedAnswer);
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), editedAnswer, 'reopen preserves manual revisions');
  await page.click('.cl-writing-sidebar .cl-question-nav button:nth-child(2)');
  const secondAnswer = '팀과 매주 일정과 작업 범위를 조율했습니다. 작업 범위를 먼저 맞추는 것이 협업의 기준임을 배웠습니다.';
  await replaceText(page, '.cl-answer-editor', secondAnswer);
  assert.match(await page.$eval('.cl-answer-count', element => element.textContent), /공백 제외/);
  const expectedWithoutSpaces = Array.from(secondAnswer.replace(/\s/gu, '')).length;
  assert.match(await page.$eval('.cl-answer-count', element => element.textContent), new RegExp(`${expectedWithoutSpaces}\\s*\\/\\s*400`));
  assert.equal(await page.$eval('.cl-next-row input[type=checkbox]', element => element.disabled), false);
  await page.click('.cl-writing-sidebar .cl-question-nav button:first-child');
  await replaceText(page, '.cl-answer-editor', '저는 인터뷰 내용을 정리했습니다.');
  assert.equal(await page.$eval('.cl-next-row input[type=checkbox]', element => element.disabled), true, 'below-minimum answer cannot be marked complete even after every answer is filled');
  assert.match(await page.$eval('.cl-answer-panel', element => element.textContent), /최소 100자 이상/);
  await replaceText(page, '.cl-answer-editor', editedAnswer);
  assert.equal(await page.$eval('.cl-next-row input[type=checkbox]', element => element.disabled), false);
  await page.click('.cl-next-row input[type=checkbox]');
  await clickButton(page, '저장');
  await page.waitForFunction(() => document.querySelector('.cl-save-state')?.textContent === '저장됨');
  assert.equal(saved.status, 'final');
  assert.equal(saved.questions[1].answer, secondAnswer);
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-letter-card');
  assert.match(await page.$eval('.cl-letter-card', element => element.textContent), /작성 완료/);
  checks.push('space-excluded count, minimum length guard, all-answer completion, final state saved and shown in hub');

  const quarantinedAnswer = '이전 분석을 보고 사용자가 이미 작성한 답변입니다. 원문 그대로 보관합니다.';
  const manualAnswer = '직접 입력한 실제 문항에 맞춰 작성한 내 답변입니다.';
  saved = {
    ...saved, sourceUrl: suppliedUrl, sourceInputText: '', sourceText: missingAnalysis.sourceText,
    analysis: { ...missingAnalysis, questionStatus: 'unavailable' }, status: 'draft',
    questions: [
      { id: 'legacy-requirement', source: 'posting', validation: 'unverified', question: missingAnalysis.sourceText, answer: quarantinedAnswer, linkedExperienceIds: ['exp-interviews'], maxLength: null, minLength: null, countSpaces: true },
      { id: 'manual-current', source: 'manual', validation: 'manual', question: '지원 동기를 본인 경험과 연결해 작성해주세요.', answer: manualAnswer, linkedExperienceIds: ['exp-interviews'], maxLength: null, minLength: null, countSpaces: true },
    ],
  };
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter/edit/letter-synthetic'));
  await page.waitForSelector('.cl-question-recovery');
  await page.waitForFunction(answer => document.querySelector('.cl-answer-editor')?.value === answer, {}, manualAnswer);
  assert.equal(await page.$$eval('.cl-question-nav .cl-source-posting', elements => elements.length), 0, 'quarantined job requirements cannot appear as confirmed questions');
  assert.equal(await page.$$eval('.cl-question-nav button', elements => elements.length), 1);
  assert.equal(await page.$$eval('.cl-answer-panel .cl-source-manual', elements => elements.length), 1);
  await page.click('.cl-question-recovery summary');
  assert.match(await page.$eval('.cl-question-recovery', element => element.textContent), new RegExp(quarantinedAnswer));
  await capture(page, 'legacy-question-recovery-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'legacy recovery and manual answer fit mobile width');
  await capture(page, 'legacy-question-recovery-mobile.png');
  await capture(page, 'legacy-manual-answer-mobile.png', 'bottom');
  await page.setViewport({ width: 1440, height: 1050 });
  const revisedManualAnswer = `${manualAnswer} 이후 직접 수정한 문장도 보존됩니다.`;
  await replaceText(page, '.cl-answer-editor', revisedManualAnswer);
  await clickButton(page, '저장');
  await page.waitForFunction(() => document.querySelector('.cl-save-state')?.textContent === '저장됨');
  assert.equal(saved.questions.find(question => question.id === 'legacy-requirement').answer, quarantinedAnswer);
  assert.equal(saved.questions.find(question => question.id === 'manual-current').answer, revisedManualAnswer);
  await clickButton(page, '공고 다시 분석하기');
  await page.waitForSelector('.cl-extra-input textarea');
  assert.equal(await page.$eval('.cl-extra-input textarea', element => element.value), '', 'legacy scraped text is not prefilled as original user input');
  checks.push('old malformed posting questions quarantined with original answer; manual question and edited answer saved intact');

  // The extension boundary is mocked, while the import API uses its real
  // deterministic validator. Existing analysis, drafts and experience links
  // are preserved without another analyze/generate request.
  const officialRole = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537&pg=1';
  const officialForm = 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1537';
  const connectedAnalysis = {
    ...analysis, company: 'SFA반도체', position: '제조본부 · 제조 Operator', sourceUrl: suppliedUrl,
    applicationLinks: [{ label: '제조본부 · 제조 Operator', url: officialRole }],
    selectedApplicationUrl: officialRole, applicationUrl: officialForm,
    questions: [], questionStatus: 'unavailable', applicationAccess: 'login_required',
    questionSourceText: '', questionNotice: '로그인한 지원서에서 실제 문항을 확인해주세요.',
  };
  const existingPrompt = '지원 동기를 본인 경험과 연결해 작성해주세요.';
  const existingOtherPrompt = '팀과 협업하며 배운 점을 작성해주세요.';
  saved = {
    ...saved, targetCompany: connectedAnalysis.company, targetPosition: connectedAnalysis.position,
    sourceUrl: suppliedUrl, sourceInputText: '', sourceText: connectedAnalysis.sourceText,
    analysis: connectedAnalysis, status: 'draft',
    questions: [
      { id: 'existing-connected', source: 'manual', validation: 'manual', question: existingPrompt, answer: revisedManualAnswer, linkedExperienceIds: ['exp-interviews'], notes: '직접 작성한 메모', maxLength: null, minLength: null, countSpaces: true },
      { id: 'retained-other', source: 'manual', validation: 'manual', question: existingOtherPrompt, answer: '다른 문항에 직접 작성한 답변도 유지됩니다.', linkedExperienceIds: ['exp-collaboration'], maxLength: null, minLength: null, countSpaces: true },
    ],
  };
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-hub');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter/edit/letter-synthetic'));
  await page.waitForSelector('.cl-answer-editor');
  await page.waitForFunction(answer => document.querySelector('.cl-answer-editor')?.value === answer, {}, revisedManualAnswer);
  const newPrompt = '최근에 읽은 책이 본인에게 미친 영향을 설명해주세요.';
  const unselectedPrompt = '최근에 도전한 경험과 배운 점을 작성해주세요.';
  const connectorCapture = {
    version: 1, sourceUrl: officialForm, capturedAt: new Date().toISOString(), warnings: [],
    questions: [
      { question: existingPrompt, sourceQuote: `${existingPrompt}\n최대 500자 이내`, maxLength: 500, minLength: null, countSpaces: true },
      { question: newPrompt, sourceQuote: `${newPrompt}\n최대 700자 이내`, maxLength: 700, minLength: null, countSpaces: true },
      { question: unselectedPrompt, sourceQuote: `${unselectedPrompt}\n최대 600자 이내`, maxLength: 600, minLength: null, countSpaces: true },
    ],
  };
  await page.evaluate(capture => {
    window.connectorQa = { mode: 'missing', capture, requests: [] };
    const runtime = {
      sendMessage(extensionId, message, callback) {
        const qa = window.connectorQa;
        qa.requests.push({ extensionId, message });
        if (qa.mode === 'missing') {
          runtime.lastError = { message: 'Synthetic extension is not installed' };
          callback();
          delete runtime.lastError;
          return;
        }
        if (message.type === 'FITPOLY_POLL') {
          callback(qa.mode === 'waiting' ? { status: 'waiting' } : { status: 'captured', capture: { ...qa.capture, capturedAt: new Date().toISOString(), sourceUrl: qa.mode === 'wrong' ? 'https://unrelated.example.com/application' : qa.capture.sourceUrl } });
        } else callback({ status: message.type === 'FITPOLY_CANCEL' ? 'cancelled' : 'waiting' });
      },
    };
    window.chrome = { ...window.chrome, runtime };
  }, connectorCapture);
  const analyzeBeforeConnection = apiRequests.filter(request => request.pathname === '/coverletter/analyze').length;
  const generateBeforeConnection = apiRequests.filter(request => request.pathname === '/coverletter/generate').length;
  const importsBeforeConnection = apiRequests.filter(request => request.pathname === '/coverletter/questions/import').length;
  await clickButton(page, '로그인한 지원서에서 문항 가져오기');
  await page.waitForSelector('.cl-application-connector');
  await clickButton(page, '지원서 화면 연결하기');
  await page.waitForFunction(() => document.querySelector('.cl-application-connector .cl-error')?.textContent.includes('설치'));
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), revisedManualAnswer, 'missing connector preserves the author draft');
  assert.equal(await page.$$eval('.cl-capture-list input', elements => elements.length), 0);
  await capture(page, 'connector-install-recovery-desktop.png');
  await page.evaluate(() => { window.connectorQa.mode = 'waiting'; });
  await clickButton(page, '지원서 화면 연결하기');
  await page.waitForSelector('.cl-connector-wait');
  const cancelsBefore = await page.evaluate(() => window.connectorQa.requests.filter(item => item.message.type === 'FITPOLY_CANCEL').length);
  await clickButton(page, '연결 취소');
  await page.waitForFunction(() => !document.querySelector('.cl-connector-wait'));
  assert.equal(await page.evaluate(() => window.connectorQa.requests.filter(item => item.message.type === 'FITPOLY_CANCEL').length), cancelsBefore + 1, 'explicit cancel revokes the pending extension connection');
  await page.evaluate(() => { window.connectorQa.mode = 'wrong'; });
  await clickButton(page, '지원서 화면 연결하기');
  await page.waitForFunction(() => document.querySelector('.cl-application-connector .cl-error')?.textContent.includes('공식 지원서'));
  assert.equal(apiRequests.filter(request => request.pathname === '/coverletter/questions/import').length, importsBeforeConnection, 'foreign origin never reaches import API');
  assert.equal(await page.$('.cl-capture-list'), null);
  assert.ok(await page.evaluate(() => window.connectorQa.requests.some(item => item.message.type === 'FITPOLY_CANCEL')), 'failed connection is cancelled');
  checks.push('missing extension is recoverable and wrong origin is rejected before preview/import');

  await page.evaluate(() => { window.connectorQa.mode = 'captured'; });
  await clickButton(page, '지원서 화면 연결하기');
  await page.waitForSelector('.cl-capture-list input');
  assert.equal(await page.$$eval('.cl-capture-list input', elements => elements.length), 3);
  assert.match(await page.$eval('.cl-capture-list', element => element.textContent), /500자 이내.*700자 이내/s);
  await page.click('.cl-capture-list label:nth-child(3) input');
  assert.equal(await page.$$eval('.cl-capture-list input:checked', elements => elements.length), 2);
  await capture(page, 'connector-preview-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'application capture preview fits mobile width');
  await capture(page, 'connector-preview-mobile.png');
  await page.$eval('.cl-capture-preview .cl-missing-actions', element => element.scrollIntoView({ block: 'end' }));
  await page.screenshot({ path: path.join(output, 'connector-preview-mobile-actions.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 1050 });
  await clickButton(page, '2개 문항 추가하고 작성하기');
  await page.waitForFunction(() => !document.querySelector('.cl-application-connector'));
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.getAttribute('aria-current')), 'step');
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), revisedManualAnswer, 'matching imported prompt preserves the existing draft');
  assert.equal(await page.$('textarea[aria-label="작성할 자기소개서 문항"]'), null, 'matching manual prompt becomes a verified actual application question');
  assert.equal(await page.$eval('.cl-experience-card.is-selected', element => element.dataset.experienceId), 'exp-interviews');
  assert.equal(await page.$$eval('.cl-writing-sidebar .cl-question-nav button', elements => elements.length), 3, 'new question is appended, the other existing question remains');
  const questionNavText = await page.$eval('.cl-writing-sidebar .cl-question-nav', element => element.textContent);
  assert.ok(questionNavText.includes(newPrompt) && questionNavText.includes(existingOtherPrompt));
  assert.ok(!questionNavText.includes(unselectedPrompt), 'unselected capture question is not imported');
  const connectorImportRequest = apiRequests.filter(request => request.pathname === '/coverletter/questions/import').at(-1);
  assert.equal(connectorImportRequest.body.capture.questions.length, 2);
  assert.equal(connectorImportRequest.body.applicationUrl, officialRole);
  assert.equal(apiRequests.filter(request => request.pathname === '/coverletter/analyze').length, analyzeBeforeConnection);
  assert.equal(apiRequests.filter(request => request.pathname === '/coverletter/generate').length, generateBeforeConnection);
  await clickButton(page, '저장');
  await page.waitForFunction(() => document.querySelector('.cl-save-state')?.textContent === '저장됨');
  assert.equal(saved.analysis.applicationAccess, 'connected');
  assert.equal(saved.analysis.applicationCapture.method, 'browser_extension');
  assert.equal(new URL(saved.analysis.applicationCapture.sourceUrl).origin + new URL(saved.analysis.applicationCapture.sourceUrl).pathname, new URL(officialForm).origin + new URL(officialForm).pathname);
  assert.deepEqual([...new URL(saved.analysis.applicationCapture.sourceUrl).searchParams].sort(), [...new URL(officialForm).searchParams].sort());
  assert.ok(saved.analysis.questionSourceText.includes(newPrompt));
  assert.deepEqual(saved.analysis.companyInsights, connectedAnalysis.companyInsights);
  assert.deepEqual(saved.analysis.rolePriorities, connectedAnalysis.rolePriorities);
  const importedExisting = saved.questions.find(item => item.id === 'existing-connected');
  assert.equal(importedExisting.importMethod, 'browser_extension');
  assert.equal(importedExisting.answer, revisedManualAnswer);
  assert.equal(importedExisting.notes, '직접 작성한 메모');
  assert.deepEqual(importedExisting.linkedExperienceIds, ['exp-interviews']);
  assert.equal(importedExisting.maxLength, 500);
  assert.equal(saved.questions.find(item => item.id === 'retained-other').answer, '다른 문항에 직접 작성한 답변도 유지됩니다.');
  await capture(page, 'connector-imported-writing-desktop.png');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-letter-card');
  await page.click('.cl-card-link');
  await page.waitForSelector('.cl-answer-editor');
  await page.waitForFunction(answer => document.querySelector('.cl-answer-editor')?.value === answer, {}, revisedManualAnswer);
  assert.equal(saved.analysis.applicationAccess, 'connected');
  await page.click('.cl-writing-sidebar .cl-question-nav button:nth-child(3)');
  await page.waitForFunction(prompt => document.querySelector('.cl-answer-panel')?.textContent.includes(prompt), {}, newPrompt);
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), '');
  assert.equal(await page.$$eval('.cl-experience-card.is-selected', elements => elements.length), 0, 'new captured question requires an explicit experience selection');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'connected imported writing fits mobile width');
  await capture(page, 'connector-imported-writing-mobile.png');
  await page.setViewport({ width: 1440, height: 1050 });
  const artifact = await page.evaluate(async () => {
    const response = await fetch('/application-connector/fitpoly-application-connector.zip');
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, length: bytes.length, signature: Array.from(bytes.slice(0, 4)) };
  });
  assert.equal(artifact.status, 200);
  assert.ok(artifact.length > 1000);
  assert.deepEqual(artifact.signature, [80, 75, 3, 4]);
  checks.push('authenticated question preview selection; deterministic import preserves existing analysis/drafts/experience links and opens writing; connected evidence survives save/reopen; extension ZIP is downloadable');

  // Changing a registered role must not reuse the previous role's form or its
  // AI priorities, even when both applications share one employer origin.
  const maintenanceRole = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1539&pg=1';
  const maintenanceForm = 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1539';
  const maintenanceLabel = '제조본부 · 제조기술 Maintenance';
  saved = { ...saved, analysis: { ...saved.analysis, questionStatus: 'unavailable', questions: [],
    applicationLinks: [{ label: connectedAnalysis.position, url: officialRole }, { label: maintenanceLabel, url: maintenanceRole }],
  } };
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-hub');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter/edit/letter-synthetic'));
  await page.waitForSelector('.cl-answer-editor');
  await page.click('.cl-steps button:nth-child(3)');
  await page.waitForSelector('.cl-application-options input');
  await page.click('.cl-application-options label:nth-child(2) input');
  await clickButton(page, '로그인한 지원서에서 문항 가져오기');
  await page.waitForSelector('.cl-application-connector');
  assert.match(await page.$eval('.cl-connector-target', element => element.textContent), /제조기술 Maintenance/);
  await page.evaluate(capture => { window.connectorQa.mode = 'captured'; window.connectorQa.capture = capture; }, { ...connectorCapture, questions: [connectorCapture.questions[0]] });
  const importsBeforeRoleChange = apiRequests.filter(request => request.pathname === '/coverletter/questions/import').length;
  await clickButton(page, '지원서 화면 연결하기');
  await page.waitForFunction(() => document.querySelector('.cl-application-connector .cl-error')?.textContent.includes('다른 지원서'));
  assert.equal(apiRequests.filter(request => request.pathname === '/coverletter/questions/import').length, importsBeforeRoleChange, 'same-origin wrong role is rejected before import');
  await page.evaluate(sourceUrl => { window.connectorQa.capture.sourceUrl = sourceUrl; }, maintenanceForm);
  await clickButton(page, '지원서 화면 연결하기');
  await page.waitForSelector('.cl-capture-list input');
  await clickButton(page, '1개 문항 추가하고 작성하기');
  await page.waitForFunction(() => !document.querySelector('.cl-application-connector'));
  assert.equal(await page.$eval('.cl-steps button:nth-child(4)', element => element.getAttribute('aria-current')), 'step');
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), revisedManualAnswer);
  assert.equal(await page.$eval('.cl-experience-card.is-selected', element => element.dataset.experienceId), 'exp-interviews');
  await clickButton(page, '저장');
  await page.waitForFunction(() => document.querySelector('.cl-save-state')?.textContent === '저장됨');
  assert.equal(saved.targetPosition, maintenanceLabel);
  assert.equal(saved.analysis.position, maintenanceLabel);
  assert.equal(saved.analysis.selectedApplicationUrl, maintenanceRole);
  assert.equal(new URL(saved.analysis.applicationUrl).searchParams.get('rnId'), '1539');
  assert.deepEqual(saved.analysis.rolePriorities, []);
  assert.deepEqual(saved.analysis.writingPoints, []);
  assert.equal(saved.questions.find(item => item.id === 'existing-connected').answer, revisedManualAnswer);
  assert.equal(apiRequests.filter(request => request.pathname === '/coverletter/analyze').length, analyzeBeforeConnection);
  await page.click('.cl-steps button:nth-child(3)');
  await page.waitForSelector('.cl-target-fields');
  assert.equal(await page.$$eval('.cl-target-fields label', elements => elements.find(element => element.textContent.includes('지원 직무')).querySelector('input').value), maintenanceLabel);
  await page.click('.cl-steps button:nth-child(2)');
  await page.waitForSelector('.cl-analysis-summary');
  assert.match(await page.$eval('.cl-analysis-summary', element => element.textContent), /제조기술 Maintenance/);
  await capture(page, 'connector-changed-role-analysis-desktop.png');
  checks.push('same-origin wrong role refused; changing Operator to Maintenance uses selected-role label and form, clears old role priorities, updates application position and preserves author work');

  const foodPrompt = '본인이 경험한 식문화 또는 음식 관련된 경험에 대해 서술하고, 이를 통해 깨달은 점이나 어떤 의미가 있었는지 작성하십시오.';
  const keptDraft = '기존에 직접 작성해 둔 답변입니다.';
  saved = { ...saved, additionalContext: '', questions: [{ id: 'food-topic', question: foodPrompt, source: 'manual',
    answer: keptDraft, linkedExperienceIds: ['exp-interviews'], maxLength: 300, countSpaces: false }] };
  await page.evaluate(() => window.letterStore.getState().clearCoverLetters());
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-hub');
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter/edit/letter-synthetic'));
  await page.waitForFunction(prompt => document.querySelector('.cl-answer-heading h3')?.textContent === prompt, {}, foodPrompt);
  assert.equal(await page.$$eval('.cl-recommendation-card', elements => elements.length), 0, 'generic learning and job fit do not recommend a non-food experience');
  await clickButton(page, '초안 다시 쓰기');
  await page.waitForSelector('[role=alertdialog]');
  await clickButton(page, '계속하기');
  await page.waitForSelector('.cl-context-request');
  assert.equal(await page.$eval('.cl-answer-editor', element => element.value), keptDraft, 'missing topic context keeps the existing draft');
  assert.match(await page.$eval('.cl-context-request', element => element.textContent), /음식·식문화/);
  assert.equal(await page.$('.cl-error'), null, 'a context request is helpful feedback, not a failed API response');
  await capture(page, 'food-context-request-desktop.png');
  await page.setViewport({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await capture(page, 'food-context-request-mobile.png', 'bottom');
  const foodContext = '교환학생 친구와 함께 음식을 만들어 나누었습니다. 각자의 식문화를 이야기하며 서로를 이해하는 계기가 됐습니다.';
  await replaceText(page, '.cl-context-request textarea', foodContext);
  await clickButton(page, '초안 다시 쓰기');
  await page.waitForSelector('[role=alertdialog]');
  await clickButton(page, '계속하기');
  await page.waitForFunction(answer => document.querySelector('.cl-answer-editor')?.value === answer, {}, foodContext);
  assert.equal(await page.$('.cl-context-request'), null);
  assert.equal(await page.$$eval('.cl-linked-chips > span', elements => elements.length), 0, 'user-input-only drafting clears unused experience links');
  await capture(page, 'food-context-answer-mobile.png', 'bottom');
  checks.push('food question refuses unrelated experience; no false recommendations; inline real-context request preserves draft; supplied food context generates a matching answer');

  await page.evaluate(() => window.authStore.setState({ user: null, profile: null }));
  await page.evaluate(() => window.letterStore.getState().clearCoverLetters());
  await page.evaluate(() => window.qaRouter.navigate('/app/coverletter'));
  await page.waitForSelector('.cl-hub');
  assert.equal(await page.$('.cl-letter-card'), null, 'guest hub cannot expose previous account drafts');
  checks.push('save failure recovery, persistence and reopen, guest draft isolation');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, screenshots: output, checks, requests: apiRequests.map(({ pathname, method }) => ({ pathname, method })) }, null, 2));
} finally { await browser.close(); }

async function clickButton(page, label) {
  await page.waitForFunction(label => Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes(label) && !button.disabled), {}, label);
  const found = await page.evaluateHandle(label => Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes(label) && !button.disabled), label);
  await found.asElement().click();
  await found.dispose();
}

async function replaceText(page, selector, value) {
  await page.waitForSelector(selector);
  await page.click(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type(value);
}

async function capture(page, fileName, position = 'top') {
  await page.evaluate(position => {
    const main = document.querySelector('.app-shell > main');
    if (main) main.scrollTop = position === 'bottom' ? main.scrollHeight : 0;
  }, position);
  await page.screenshot({ path: path.join(output, fileName), fullPage: true });
}

async function replaceLabeledNumber(page, label, value) {
  const found = await page.evaluateHandle(label => Array.from(document.querySelectorAll('.cl-limit-row label')).find(element => element.textContent.includes(label))?.querySelector('input'), label);
  assert.ok(found.asElement(), `number field '${label}' exists`);
  await found.asElement().click();
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.type(value);
  await found.dispose();
}
