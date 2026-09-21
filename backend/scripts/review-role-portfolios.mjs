// Synthetic local UI QA. Blocks API calls and never touches an account or production data.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { groundMarketerEvidence } from '../src/services/marketerEvidence.js';
import { groundPmEvidence } from '../src/services/pmEvidence.js';
const origin = process.env.PM_REVIEW_ORIGIN || 'http://localhost:3000';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-role-review-'));
const source = '고객은 가격보다 사용법을 궁금해했다. 나는 사용 장면 중심의 카드뉴스와 카피를 작성했다. 인스타그램에서 가이드 페이지로 연결했다. 기준값 2%, 목표 5%, 실제 전환율 3%. 기간 7일, 대상 100명, 구매 완료 이벤트로 측정했다.';
const planned = '장바구니 이탈 고객에게 다음 날 안내를 발송할 계획이다. 구매하면 종료하고 주 1회로 제한할 예정이다. 아직 미실행이다.';
const raw = `--- 캠페인 기록.pdf ---\n${source}\n--- CRM 설계.pdf ---\n${planned}`;
const ref = { quote: source, source: '캠페인 기록.pdf', stage: 'executed', ownership: '카드뉴스·카피 작성' };
const marketing = groundMarketerEvidence({ jobCategory: 'marketer', keyExperiences: [{ id: 'm1', title: '가격 메시지에서 사용 장면으로', jobData: {
  marketerEvidence: [{ dimension: 'conversion', claim: '사용법에 대한 고객의 장벽을 낮추는 캠페인', ...ref }, { dimension: 'learning', claim: '가격 강조보다 사용 맥락을 먼저 설명하기로 했다.', ...ref }],
  marketerMetrics: [{ name: '구매 완료율', kind: 'outcome', baseline: '2%', target: '5%', actual: '3%', period: '7일', population: '100명', method: '구매 완료 이벤트', ...ref }],
  marketerWorkProducts: {
    audiences: [{ segment: '첫 방문 고객', signal: '사용법 문의', need: '제품을 이해하고 싶음', barrier: '사용 장면이 불명확함', choice: '사용 방법을 먼저 설명', ...ref }],
    positioning: [{ audience: '첫 방문 고객', promise: '사용 장면을 쉽게 이해', proof: '실제 사용 가이드', difference: '가격보다 사용 경험', tone: '구체적인 설명', ...ref }],
    creatives: [{ variant: '카드뉴스', format: '인스타그램 카드뉴스', hook: '처음 쓰는 순간부터', message: '사용 장면을 담은 가이드', cta: '사용 가이드 보기', rationale: '사용법 질문에 먼저 답하기', ...ref }, { variant: '가격안', format: '검토 문안', hook: '지금 시작하는 혜택', message: '가격 중심의 대안', rationale: '검토한 표현이며 집행 여부 미확인', ...ref, stage: 'unknown' }],
    channels: [{ channel: '인스타그램', purpose: '사용 맥락 전달', audience: '첫 방문 고객', period: '7일', handoff: '가이드 페이지', rationale: '사용 방법을 시각적으로 설명', ...ref }, { channel: '가이드 페이지', purpose: '제품 사용 안내', audience: '인스타그램 유입 고객', ...ref }],
    contentSystem: [{ pillar: '제품 사용법', intent: '사용 방법 찾기', format: '카드뉴스', distribution: '인스타그램', reuse: '가이드 페이지', ...ref }],
    crm: [{ segment: '장바구니 이탈 고객', trigger: '장바구니 이탈', timing: '다음 날', message: '사용 안내', exit: '구매 완료', guardrail: '주 1회', quote: planned, source: 'CRM 설계.pdf', stage: 'planned' }],
    experiments: [{ hypothesis: '설명 메시지가 구매를 돕는다', variable: '메시지', control: '비교 조건 미기록', test: '전후 관찰', observation: '실제 전환율 3%', limitation: '동일 대조군 없어 인과 단정 불가', ...ref, stage: 'observed' }],
    measurement: [{ event: '구매 완료', definition: '구매 완료 이벤트', sourceSystem: '캠페인 기록', window: '7일', limitation: '채널 기여는 분리하지 못함', ...ref }],
    optimization: [{ signal: '사용법 질문', diagnosis: '맥락 설명 부족', change: '사용 장면 중심 카피', next: '가이드 표현 비교', ...ref }],
    operations: [{ deliverable: '카드뉴스', stakeholder: '디자인 담당', constraint: '실제 사용 장면 전달', myAction: '카피 작성', ...ref }],
  },
} }, { id: 'm2', title: '다음 CRM 실험', jobData: { marketerMetrics: [{ name: '재구매', actual: '50%', target: '50%', quote: planned }], marketerEvidence: [{ dimension: 'experiment', claim: '아직 실행 전인 CRM 실험', quote: planned, stage: 'planned' }] } }] }, raw);
marketing.deliverables = [{ id: 'creative', name: '카드뉴스.png', ext: 'png', url: '/__role_fixture__.png' }, { id: 'report', name: '캠페인 기록.pdf', ext: 'pdf', url: '/__role_report__.pdf' }];
marketing.keyExperiences[0].artifactBindings = [{ assetId: 'creative', caption: 'QA용 합성 시안 · 실제 지원자 자료 아님', contribution: '테스트용 카피', purpose: '표현 선택' }];
const pm = groundPmEvidence({ jobCategory: 'pm', keyExperiences: [{ id: 'p1', title: '작성 진입 정책 개선', jobData: { pmWorkProducts: { requirements: [{ requirement: '작성 안내', rule: '첫 방문에 사용 가이드 표시', acceptance: '가이드를 확인하고 작성 가능', owner: '정책 작성', ...ref }] } } }] }, raw);
pm.deliverables = marketing.deliverables; pm.keyExperiences[0].artifactBindings = marketing.keyExperiences[0].artifactBindings;
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [], apiRequests = [];
  let mockUploads = false;
  const mockSource = '추가 정책은 입력을 보존하도록 설계했다. 나는 정책 문구와 인수 조건을 작성했다.';
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      apiRequests.push(url);
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
      if (mockUploads && request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
      if (mockUploads && url.endsWith('/api/health')) return request.respond({ contentType: 'application/json', headers, body: JSON.stringify({ features: { documentUpload: true } }) });
      if (mockUploads && url.endsWith('/api/upload/document')) return request.respond({ contentType: 'application/json', headers, body: JSON.stringify({ url: '/uploads/mock-policy.txt', size: 120 }) });
      if (mockUploads && url.endsWith('/api/import/upload')) return request.respond({ contentType: 'application/json', headers, body: JSON.stringify({ imported: { content: mockSource } }) });
      return request.abort();
    }
    if (url === `${origin}/__role_review__`) return request.respond({ contentType: 'text/html', body: '<html><body><div id="test" style="max-width:1060px;margin:auto;padding:24px"></div></body></html>' });
    if (url.endsWith('/__role_fixture__.png')) return request.respond({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#e4eee8"/><text x="45" y="90" fill="#396454" font-size="21">SYNTHETIC QA / NOT APPLICANT WORK</text><text x="45" y="230" fill="#234738" font-size="44">Work sample preview</text><rect x="45" y="310" width="280" height="35" rx="5" fill="#8db6a2"/></svg>' });
    if (url.endsWith('/__missing_preview__.png')) return request.respond({ status: 404, body: '' });
    if (!url.startsWith(origin) && !url.startsWith('data:')) return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${origin}/__role_review__`);
  await page.evaluate(async ({ marketing, pm, raw }) => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import('/node_modules/.vite/deps/react.js'), { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: Marketer } = await import('/src/components/portfolio/MarketerEvidenceCaseStudy.jsx');
    const { default: Pm } = await import('/src/components/portfolio/PmEvidenceCaseStudy.jsx');
    const { PmProfileSidebar, MarketerDoc } = await import('/src/pages/experience/ExperienceResult.jsx');
    const { buildMarketerEvidenceModel } = await import('/src/utils/marketerEvidence.js');
    const { buildPmEvidenceModel } = await import('/src/utils/pmEvidence.js');
    await import('/src/index.css');
    const root = ReactDOM.createRoot(document.getElementById('test'));
    window.renderRole = (data, readOnly = false) => {
      window.roleData = data;
      const role = data.jobCategory, Component = role === 'pm' ? Pm : Marketer;
      const cs = { title: '합성 데이터로 검증 중', summary: '원본과 작업물, 판단의 관계를 확인하는 로컬 QA입니다.', meta: { role: '직접 기획·제작', duration: '7일', team: '테스트 팀' }, body: [{ id: 'body-1', type: 'text', content: '기존 공통 배경을 유지합니다.' }], keyExps: [{ title: '기존 작업', images: [{ url: '/__role_fixture__.png' }] }] };
      if (role === 'marketer' && !readOnly) return root.render(React.createElement(MarketerDoc, { cs, sr: data, sourceText: raw, setField: () => {}, setMeta: () => {}, onPatchSr: next => window.renderRole(next) }));
      root.render(React.createElement('div', { className: role === 'pm' ? 'pm-workspace pm-page-grid' : 'marketing-workspace' }, !readOnly && React.createElement(PmProfileSidebar, { role, sr: data, cs, evidence: buildPmEvidenceModel(data), setField: () => {}, setMeta: () => {}, onPatchSr: next => window.renderRole(next) }), React.createElement('main', { className: role === 'pm' ? 'pm-page-main' : 'marketing-main' }, React.createElement(Component, { sr: data, sourceText: raw, readOnly, onChange: next => window.renderRole(next) }))));
    };
    window.pmFixture = pm; window.marketingFixture = marketing; window.renderRole(marketing);
  }, { marketing, pm, raw });
  await page.waitForSelector('.ma-case-header');
  assert.equal(await page.$$eval('.mk-work-block', els => els.length), 10);
  assert.equal(await page.$$eval('.ma-copy-grid>article', els => els.length), 2);
  assert.equal(await page.$$eval('.mk-channel-table tbody tr', els => els.length), 2);
  assert.equal(await page.$$eval('.role-artifact-card', els => els.length), 2);
  assert.equal(await page.$('.mc-creative-stage'), null);
  assert.equal(await page.$('.mc-copy-poster'), null);
  assert.ok(await page.evaluate(() => document.querySelector('.ma-impact-preview').getBoundingClientRect().top < document.querySelector('.ma-strategy').getBoundingClientRect().top));
  assert.equal(await page.$('.ma-case>.rpm-details'), null);
  assert.equal(await page.$('.rpm-marketing'), null);
  assert.ok(await page.$$eval('.mk-campaign:not(.mk-hidden) .ma-chapter', els => els.every(el => el.getBoundingClientRect().height > 0)));
  assert.equal(await page.$$eval('.marketing-project-notes img', els => els.length), 0, 'connected legacy image is displayed only once');
  assert.match(await page.$eval('.marketing-project-notes textarea', el => el.value), /기존 공통 배경/);
  assert.equal(await page.$('.pd-flow'), null);
  assert.equal(await page.$('.mk-view-nav'), null);
  assert.equal(await page.$('.mk-campaign-brief'), null);
  assert.doesNotMatch(await page.$eval('.mk-campaign:not(.mk-hidden)', el => el.textContent), /A-|B\+|적합도/);
  await page.screenshot({ path: path.join(output, 'marketer-desktop.png'), fullPage: true });
  await page.screenshot({ path: path.join(output, 'marketer-desktop-top.png') });
  await page.waitForFunction(() => document.querySelector('.role-artifact-preview img')?.complete);
  await page.click('.ma-outline a[href$="-creative"]');
  assert.match(await page.$eval('.ma-copy-library', el => el.textContent), /검토 문안|가격안/);
  assert.match(await page.$eval('.ma-copy-library', el => el.textContent), /원본 디자인 아님/);
  await page.screenshot({ path: path.join(output, 'marketer-copy-desktop.png') });
  await page.click('.ma-objective [aria-label="마케팅 판단 수정"]');
  await page.$eval('.ma-narrative-editor textarea', el => { el.focus(); el.select(); });
  await page.keyboard.type('실제 사용법 질문을 바탕으로 캠페인 목표를 정했다.');
  await page.click('.ma-narrative-editor button[type=submit]');
  assert.equal(await page.evaluate(() => window.roleData.keyExperiences[0].jobData.marketerEvidence[0].claim), '실제 사용법 질문을 바탕으로 캠페인 목표를 정했다.');
  assert.equal(await page.evaluate(() => window.roleData.keyExperiences[0].jobData.marketerEvidence[0].userEdited), true);
  assert.match(await page.$eval('.mk-channel-table', el => el.textContent), /가이드 페이지/);
  assert.match(await page.$eval('.mk-work-crm', el => el.textContent), /발송 예정 메시지/);
  await page.click('.mk-campaign:not(.mk-hidden) .role-artifact-tools button');
  await page.$eval('.role-artifact-form label:nth-child(2) textarea', el => { el.focus(); el.select(); });
  await page.keyboard.type('원본과 연결한 설명 검증'); await page.click('.role-artifact-form button[type=submit]');
  assert.equal(await page.evaluate(() => window.roleData.keyExperiences[0].artifactBindings[0].caption), '원본과 연결한 설명 검증');
  await page.click('.mk-campaign:not(.mk-hidden) .work-product-review summary');
  await page.select('.mk-campaign:not(.mk-hidden) .work-product-review select', 'creatives:0');
  await page.$eval('.work-product-review form label:nth-child(3) textarea', el => { el.focus(); el.select(); });
  await page.keyboard.type('수정한 후킹 문구'); await page.click('.work-product-review button[type=submit]');
  assert.equal(await page.evaluate(() => window.roleData.keyExperiences[0].jobData.marketerWorkProducts.creatives[0].hook), '수정한 후킹 문구');
  await page.setViewport({ width: 390, height: 844 });
  for (const key of ['strategy', 'creative', 'activation', 'measurement', 'learning']) {
    await page.click(`.mk-campaign:not(.mk-hidden) .ma-outline a[href$="-${key}"]`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, `marketer-mobile-${key}.png`) });
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, 'marketer-mobile-top.png') });
  await page.focus('.mk-case-tabs [role=tab]'); await page.keyboard.press('End');
  assert.match(await page.$eval('.mk-campaign:not(.mk-hidden)', el => el.textContent), /다음 CRM 실험/);
  assert.match(await page.$eval('.mk-campaign:not(.mk-hidden) .ma-result-grid strong', el => el.textContent), /미확인/);
  await page.emulateMediaType('print');
  assert.equal(await page.$$eval('.mk-campaign', els => els.filter(el => getComputedStyle(el).display !== 'none').length), 2);
  assert.ok(await page.$$eval('.ma-copy-grid>article, .mk-channel-table tbody tr', els => els.every(el => el.getBoundingClientRect().height > 0)));
  assert.ok(await page.$$eval('.ma-measure-detail dl', els => els.every(el => el.getBoundingClientRect().height > 0)));
  assert.ok(await page.$eval('.marketing-print-context', el => el.getBoundingClientRect().height > 0));
  assert.ok(await page.$$eval('.mk-source blockquote', els => els.every(el => el.getBoundingClientRect().height > 0)), 'print includes closed source excerpts');
  const exported = await page.evaluate(async () => {
    const { experienceDraftBlocks } = await import('/src/utils/projectSections.js');
    return JSON.stringify(experienceDraftBlocks({ title: '마케터 QA', jobCategory: 'marketer', structuredResult: window.roleData }));
  });
  assert.match(exported, /수정한 후킹 문구/); assert.match(exported, /원본과 연결한 설명 검증/); assert.match(exported, /CRM 여정과 발송 조건/);
  await page.emulateMediaType('screen');
  await page.evaluate(() => window.renderRole(window.pmFixture)); await page.waitForSelector('.pm-portfolio-board');
  assert.equal(await page.$$eval('.role-artifact-card', els => els.length), 2);
  await page.click('.work-product-review summary'); await page.select('.work-product-review select', 'requirements:0');
  await page.$eval('.work-product-review form label:nth-child(2) textarea', el => { el.focus(); el.select(); });
  await page.keyboard.type('직접 검토한 작성 정책'); await page.click('.work-product-review button[type=submit]');
  assert.equal(await page.evaluate(() => window.roleData.keyExperiences[0].jobData.pmWorkProducts.requirements[0].rule), '직접 검토한 작성 정책');
  assert.equal(await page.evaluate(() => window.roleData.keyExperiences[0].jobData.pmWorkProducts.requirements[0].rule), '직접 검토한 작성 정책');
  await page.click('.pd-document-index a[href$="-spec"]');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'pm-mobile-artifacts.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, 'pm-desktop-artifacts.png'), fullPage: true });
  await page.evaluate(() => window.renderRole(window.roleData, true));
  await page.waitForFunction(() => !document.querySelector('.role-artifact-studio button'));
  assert.equal(await page.$('.work-product-review'), null);
  assert.deepEqual(errors, []); assert.deepEqual(apiRequests, []);
  await page.evaluate(() => window.renderRole({ jobCategory: 'marketer', keyExperiences: [{ title: '기존 브랜드 콘텐츠 경험', context: '브랜드의 첫 사용 경험을 설명하는 콘텐츠', action: '소개 콘텐츠를 제작했다', result: '독자의 질문이 구체적으로 바뀌었다', learning: '다음에는 사용 사례를 더 담기로 했다', jobData: { target: '제품을 처음 접하는 고객', creative: '실제 사용 순서대로 설명했다' } }] }, true));
  await page.waitForFunction(() => document.querySelector('.ma-case-header h2')?.textContent === '기존 브랜드 콘텐츠 경험');
  assert.match(await page.$eval('.ma-strategy', el => el.textContent), /제품을 처음 접하는 고객/);
  assert.match(await page.$eval('.ma-creative', el => el.textContent), /실제 사용 순서대로 설명했다/);
  assert.match(await page.$eval('.ma-measurement', el => el.textContent), /독자의 질문이 구체적으로 바뀌었다/);
  assert.equal(await page.$('.ma-result-grid'), null, 'narrative feedback is not a fabricated numeric KPI');
  assert.equal(await page.$('.ma-originals'), null, 'legacy copy is not a fabricated original');
  assert.equal(await page.$('.ma-activation'), null, 'do not force an unsupported channel plan');
  await page.evaluate(() => { const next = structuredClone(window.marketingFixture); next.deliverables[0].url = '/__missing_preview__.png'; window.renderRole(next, true); });
  await page.waitForSelector('.ma-originals');
  await page.waitForFunction(() => document.querySelector('.role-artifact-preview')?.textContent.includes('미리보기를 불러오지 못했습니다'));
  assert.equal(await page.$eval('.role-artifact-preview', el => el.getAttribute('href')), '/__missing_preview__.png');
  mockUploads = true;
  await page.evaluate(() => window.renderRole(window.pmFixture));
  await page.waitForSelector('.role-artifact-studio button');
  await page.evaluate(mockSource => {
    const transfer = new DataTransfer(); transfer.items.add(new File([mockSource], '추가 정책.txt', { type: 'text/plain' }));
    const input = document.querySelector('.pm-source-vault input[type=file]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  }, mockSource);
  await page.waitForFunction(() => window.roleData.additionalMaterials?.length === 1);
  assert.equal(await page.evaluate(() => window.roleData.additionalMaterials[0].text), mockSource);
  assert.equal(await page.evaluate(() => window.roleData.deliverables.at(-1).name), '추가 정책.txt');
  await page.click('[aria-label="추가 정책.txt 삭제"]');
  await page.waitForFunction(() => window.roleData.additionalMaterials?.length === 0);
  assert.ok(apiRequests.every(url => /\/api\/(health|upload\/document|import\/upload)$/.test(url)));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, screenshots: output, checks: ['full marketing page integration', 'campaign brief and impact preview', '10 marketing artifact types visible without expanding', 'original files and legacy images shown once', 'five mobile chapters', 'narrative editing preserves source', 'PM policy edit regression', 'original image preview and failure', 'caption persistence', 'typed edit persistence', 'legacy qualitative case without fabricated KPI', 'keyboard cases', 'print all cases and excerpts and measurement conditions', 'shared exports', 'read-only', 'planned CRM labels', 'mocked file upload and text extraction', 'removed additional source excluded', 'no real API calls'] }, null, 2));
} finally { await browser.close(); }
