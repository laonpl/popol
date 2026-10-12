// Local synthetic data only. No account changes, paid AI calls, or external APIs.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = process.env.PM_REVIEW_ORIGIN || 'http://localhost:3005';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-role-workspaces-'));
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [], apiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) { apiRequests.push(url); return request.abort(); }
    if (url === `${origin}/__role_workspaces__`) return request.respond({ contentType: 'text/html', body: '<html><body><div id="test" style="max-width:1200px;margin:auto;padding:16px"></div></body></html>' });
    if (!url.startsWith(origin) && !url.startsWith('data:')) return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1050 });
  await page.goto(`${origin}/__role_workspaces__`);
  await page.evaluate(async () => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { PmDoc, MarketerDoc } = await import('/src/pages/experience/ExperienceResult.jsx');
    const { default: PmReadOnly } = await import('/src/components/portfolio/PmEvidenceCaseStudy.jsx');
    const { default: MarketingReadOnly } = await import('/src/components/portfolio/MarketerEvidenceCaseStudy.jsx');
    await import('/src/index.css');
    const root = ReactDOM.createRoot(document.getElementById('test'));
    let revision = 0;
    window.renderWorkspace = (data, reload = false, readOnly = false) => {
      if (reload) revision += 1;
      window.roleData = data;
      const cs = { title: data.jobCategory === 'pm' ? '가입 경험 개선' : '첫 구매 캠페인', summary: '합성 자료를 이용한 직군별 직접 기록 검증', meta: { role: data.jobCategory === 'pm' ? '제품 기획' : '콘텐츠 · CRM', duration: '기록된 기간', team: '기획 · 디자인' }, body: [] };
      const Component = readOnly ? data.jobCategory === 'pm' ? PmReadOnly : MarketingReadOnly : data.jobCategory === 'pm' ? PmDoc : MarketerDoc;
      root.render(React.createElement(Component, { key: `${data.jobCategory}-${revision}`, cs, sr: data, exp: { content: '직접 경험한 일을 정리합니다.' }, sourceText: '직접 경험한 일을 정리합니다.', readOnly, setField: () => {}, setMeta: () => {}, onPatchSr: next => window.renderWorkspace(next) }));
    };
    window.renderWorkspace({ jobCategory: 'pm', keyExperiences: [{ id: 'pm-manual', title: '첫 화면의 작성 경로 개선', context: '첫 사용자가 작성 경로를 찾기 어려웠다.', jobData: {} }] });
  });

  const selectStage = async (selector, index) => {
    await page.waitForSelector(selector);
    await page.$$eval(selector, (buttons, index) => buttons[index].click(), index);
  };
  const addRecord = async (group, fields, stage = 'executed') => {
    const base = '.rs-stage-capture .work-product-add';
    await page.waitForSelector(base);
    if (!await page.$eval(base, element => element.open)) await page.click(`${base}>summary`);
    await page.select(`${base}>label select`, group);
    for (const [label, value] of Object.entries(fields)) {
      await page.evaluate(({ base, label, value }) => {
        const target = [...document.querySelectorAll(`${base} form label`)].find(element => element.firstChild?.textContent.trim() === label)?.querySelector('textarea');
        if (!target) throw new Error('Field missing: ' + label);
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(target, value);
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }, { base, label, value });
    }
    await page.select(`${base} form label select`, stage);
    await page.click(`${base} button[type=submit]`);
    await page.waitForFunction(() => document.querySelector('.rs-stage-capture [role=status]')?.textContent.includes('추가했습니다'));
  };

  await selectStage('.rs-pm-nav>button', 1);
  await addRecord('alternatives', { '검토 대안': '검색 기능 추가', '결정': '기각', '판단 기준': 'MVP 일정', '얻는 것 · 감수한 제약': '검색 편의는 다음 범위로 미룸', '선택·제외 이유': '가입 진입 문제를 우선 해결' });
  await addRecord('alternatives', { '검토 대안': '작성 진입 안내', '결정': '채택', '판단 기준': '첫 방문자의 진입 장벽', '얻는 것 · 감수한 제약': '적은 구현 범위로 탐색 개선', '선택·제외 이유': '관찰한 문제를 직접 해결' });
  assert.equal(await page.$$eval('.rs-decision-table tbody tr', rows => rows.length), 2);
  assert.match(await page.$eval('.rs-decision-table', element => element.textContent), /기각[\s\S]*채택/);
  await page.click('.rs-stage-capture .work-product-add>summary');
  await (await page.$('.rs-studio')).screenshot({ path: path.join(output, 'pm-comparison-studio.png') });
  await page.screenshot({ path: path.join(output, 'pm-comparison-desktop.png'), fullPage: true });

  await selectStage('.rs-pm-nav>button', 2);
  await addRecord('requirements', { '요구사항': '실패 뒤 작성 내용 유지', '조건 · 분기 · 처리 정책': '저장 실패 시 기존 입력과 재시도 버튼 표시', '인수 기준': '재시도 뒤 입력 내용 복구', '직접 책임진 범위': '예외 정책과 인수 조건을 직접 작성' });
  await selectStage('.rs-pm-nav>button', 4);
  await addRecord('experiments', { '검증 가설': '작성 위치를 알리면 처음 사용해도 진입할 수 있다', '방법 · 대상 · 기간': '첫 방문 사용자에게 작성 시작 경로 관찰', '사전 성공 기준': '설명 없이 작성 화면 진입', '실제 관찰': '추가 설명 없이 작성 위치를 찾았다', '관찰 후 결정': '다음 검증은 입력 예시 제공 여부' }, 'observed');
  const savedPm = await page.evaluate(() => JSON.parse(JSON.stringify(window.roleData)));
  assert.equal(savedPm.keyExperiences[0].jobData.pmWorkProducts.experiments[0].basis, 'self_report');
  await page.evaluate(data => window.renderWorkspace(data, true), savedPm);
  await selectStage('.rs-pm-nav>button', 4);
  assert.match(await page.$eval('.rs-pm-panel', element => element.textContent), /추가 설명 없이 작성 위치를 찾았다/);
  assert.match(await page.$eval('.pd-chapter-spec', element => element.textContent), /예외 정책과 인수 조건을 직접 작성/);
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval('.rs-studio', element => element.scrollIntoView());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'pm-workspace-mobile.png'), fullPage: true });
  const exportPm = await page.evaluate(async () => {
    const { buildPmEvidenceExportSections } = await import('/src/utils/pmEvidence.js');
    return JSON.stringify(buildPmEvidenceExportSections(window.roleData));
  });
  assert.match(exportPm, /추가 설명 없이 작성 위치를 찾았다/);

  await page.setViewport({ width: 1440, height: 1050 });
  await page.evaluate(() => window.renderWorkspace({ jobCategory: 'marketer', keyExperiences: [{ id: 'campaign-manual', title: '제품 사용법을 알리는 첫 구매 캠페인', context: '가격보다 사용법에 대한 문의가 많았다.', jobData: {} }] }, true));
  await selectStage('.rs-marketing-nav>button', 1);
  await addRecord('creatives', { '소재 이름': '사용 장면 카드뉴스', '형식': '카드뉴스', '후킹 문구': '처음 쓰는 순간을 함께', '메시지 본문': '실제 사용 순서를 보여주는 안내', '행동 유도': '사용 가이드 보기', '표현 선택 이유': '사용법 문의에 먼저 답하기', '실제 반응': '고객이 다음 사용 방법을 문의했다' }, 'observed');
  assert.match(await page.$eval('.rs-marketing-detail', element => element.textContent), /고객이 다음 사용 방법을 문의했다/);
  await selectStage('.rs-marketing-nav>button', 2);
  await addRecord('channels', { '채널': '인스타그램', '맡긴 역할': '사용 장면으로 관심 유도', '도달할 고객': '첫 방문 고객', '기간': '첫 캠페인 주간', '다음 접점': '사용 가이드', '선택 이유': '이미지로 사용법을 전달' });
  await addRecord('channels', { '채널': '사용 가이드', '맡긴 역할': '상세 정보 전달', '도달할 고객': '카드뉴스 유입 고객', '다음 접점': '구매 페이지' });
  assert.equal(await page.$$eval('.rs-channel-map>button', buttons => buttons.length), 2);
  await page.click('.rs-stage-capture .work-product-add>summary');
  await (await page.$('.rs-studio')).screenshot({ path: path.join(output, 'marketer-channel-studio.png') });
  await page.$eval('.rs-channel-map', element => element.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: path.join(output, 'marketer-channel-desktop.png') });
  await selectStage('.rs-marketing-nav>button', 3);
  await addRecord('contentSystem', { '콘텐츠 주제': '처음 사용하는 방법', '검색·독자 의도': '사용 순서 확인', '형식': '블로그', '배포 경로': '가이드 페이지', '발행 주기': '제품 업데이트 때', '재활용 구조': '상담 답변에서 연결' });
  await addRecord('crm', { '대상 조건': '가입 후 미구매 고객', '진입 트리거': '사용 가이드 열람', '발송 시점': '열람 다음 날', '메시지': '사용 장면 안내', '종료·제외 조건': '구매 완료 시 종료', '빈도·안전장치': '동일 안내 중복 발송 제외' }, 'planned');
  assert.equal(await page.$$eval('.rs-marketing-choices>button', buttons => buttons.length), 2);
  await page.$$eval('.rs-marketing-choices>button', buttons => buttons[1].click());
  assert.match(await page.$eval('.rs-marketing-detail', element => element.textContent), /구매 완료 시 종료/);
  await selectStage('.rs-marketing-nav>button', 4);
  await addRecord('optimization', { '변화를 촉발한 신호': '가격 문의보다 사용법 문의가 많음', '진단': '제품 이해가 구매 전 장벽', '수정한 것': '혜택 문구 대신 사용 장면으로 변경', '실제 관찰': '구체적인 사용 질문으로 반응이 바뀜', '다음 판단': '사용 순서를 더 쉽게 설명' }, 'changed');
  const savedMarketing = await page.evaluate(() => JSON.parse(JSON.stringify(window.roleData)));
  await page.evaluate(data => window.renderWorkspace(data, true), savedMarketing);
  await selectStage('.rs-marketing-nav>button', 1);
  assert.match(await page.$eval('.rs-marketing-detail', element => element.textContent), /고객이 다음 사용 방법을 문의했다/);
  await page.setViewport({ width: 390, height: 844 });
  await selectStage('.rs-marketing-nav>button', 2);
  await page.$eval('.rs-studio', element => element.scrollIntoView());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'marketer-workspace-mobile.png'), fullPage: true });
  const exported = await page.evaluate(async () => {
    const { buildMarketerEvidenceExportSections } = await import('/src/utils/marketerEvidence.js');
    return JSON.stringify(buildMarketerEvidenceExportSections(window.roleData));
  });
  assert.match(exported, /구체적인 사용 질문으로 반응이 바뀜/);
  assert.match(exported, /처음 사용하는 방법/);
  assert.match(exported, /구매 완료 시 종료/);

  await page.emulateMediaType('print');
  assert.equal(await page.$eval('.rs-studio', element => getComputedStyle(element).display), 'none');
  assert.ok(await page.$eval('.ma-case-body', element => element.getBoundingClientRect().height > 0));
  await page.emulateMediaType('screen');
  await page.evaluate(data => window.renderWorkspace(data, true, true), savedMarketing);
  await page.waitForSelector('.rs-marketing');
  assert.equal(await page.$('.work-product-add'), null);
  assert.equal(await page.$('.rs-edit-link'), null);
  assert.deepEqual(errors, []);
  assert.deepEqual(apiRequests, []);
  console.log(JSON.stringify({ ok: true, output, assertions: 'PM decisions/policies/observations; marketing creatives/channels/content/CRM/optimization; reload/export/mobile/read-only/print; no API calls' }));
} finally {
  await browser.close();
}
