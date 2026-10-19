// Local synthetic data only. No account changes, paid AI calls, or external APIs.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = process.env.PM_REVIEW_ORIGIN || 'http://localhost:3005';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-role-workspaces-'));
function syntheticPdf() {
  const content = 'BT /F1 20 Tf 65 710 Td (SYNTHETIC CAMPAIGN REPORT) Tj 0 -42 Td /F1 12 Tf (Local browser QA - not applicant material) Tj ET\n0.88 0.94 0.86 rg 65 410 480 180 re f\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [], apiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/')) { apiRequests.push(url); return request.abort(); }
    if (url === `${origin}/__role_workspaces__`) return request.respond({ contentType: 'text/html', body: '<html><body><div id="test" style="max-width:1200px;margin:auto;padding:16px"></div></body></html>' });
    if (url.endsWith('/__creative_fixture__.svg')) return request.respond({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="#e5ecd6"/><text x="40" y="80" fill="#637851" font-size="20">SYNTHETIC QA / NOT APPLICANT WORK</text><text x="40" y="210" fill="#2a4939" font-size="42">CREATIVE SAMPLE</text><rect x="40" y="290" width="300" height="55" rx="7" fill="#adc593"/></svg>' });
    if (url.endsWith('/__pdf_fixture__.pdf')) return request.respond({ contentType: 'application/pdf', body: syntheticPdf() });
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
      const source = data.reportSource || '직접 경험한 일을 정리합니다.';
      root.render(React.createElement(Component, { key: `${data.jobCategory}-${revision}`, cs, sr: data, exp: { content: source }, sourceText: source, readOnly, setField: () => {}, setMeta: () => {}, onPatchSr: next => window.renderWorkspace(next) }));
    };
    window.renderWorkspace({ jobCategory: 'pm', keyExperiences: [{ id: 'pm-manual', title: '첫 화면의 작성 경로 개선', context: '첫 사용자가 작성 경로를 찾기 어려웠다.', jobData: {} }] });
  });

  const selectStage = async (selector, index) => {
    const role = selector.includes('pm') ? 'pir' : 'mir';
    const chapterIndex = role === 'mir' && index === 3 ? 2 : index;
    await page.waitForSelector(`.${role}-report`);
    await page.$$eval('.one-full-detail', nodes => nodes.forEach(node => { node.open = true; }));
    await page.$$eval(`.${role}-report .ir-chapter`, (chapters, index) => {
      chapters.forEach(chapter => chapter.removeAttribute('data-capture'));
      const chapter = chapters[index]; chapter.dataset.capture = 'active';
      const button = chapter.querySelector('.ir-chapter-heading>button');
      if (button.getAttribute('aria-expanded') !== 'true') button.click();
    }, chapterIndex);
  };
  const addRecord = async (group, fields, stage = 'executed') => {
    const base = '.ir-chapter[data-capture=active] .work-product-add';
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
    await page.waitForFunction(() => document.querySelector('.ir-chapter[data-capture=active] [role=status]')?.textContent.includes('추가했습니다'));
  };

  await selectStage('.rs-pm-nav>button', 1);
  await addRecord('alternatives', { '검토 대안': '검색 기능 추가', '결정': '기각', '판단 기준': 'MVP 일정', '얻는 것 · 감수한 제약': '검색 편의는 다음 범위로 미룸', '선택·제외 이유': '가입 진입 문제를 우선 해결' });
  await addRecord('alternatives', { '검토 대안': '작성 진입 안내', '결정': '채택', '판단 기준': '첫 방문자의 진입 장벽', '얻는 것 · 감수한 제약': '적은 구현 범위로 탐색 개선', '선택·제외 이유': '관찰한 문제를 직접 해결' });
  assert.equal(await page.$$eval('.vc-mvp-column article', rows => rows.length), 2);
  assert.match(await page.$eval('[data-scope=included]', element => element.textContent), /작성 진입 안내/);
  assert.match(await page.$eval('[data-scope=excluded]', element => element.textContent), /검색 기능 추가/);
  assert.equal(await page.$('.rs-studio'), null, 'the new report replaces the old stage studio');
  await selectStage('.rs-pm-nav>button', 0);
  await addRecord('problems', { '대상 고객': '신규 사용자', '사용 맥락': '첫 경험 작성', '발견한 신호': '작성 위치를 찾지 못하는 사용자를 관찰', '정의한 문제': '첫 방문에서 작성 시작 경로를 찾기 어렵다', '사업적 이유': '첫 작성까지의 진입 장벽을 줄이기' }, 'observed');
  await addRecord('research', { '조사 대상': '첫 방문 사용자', '관찰': '첫 화면에서 메뉴를 반복해서 탐색했다', '해석': '기능의 부재보다 시작 위치의 발견이 어려웠다', '제품 기회': '첫 화면에 작성 시작 버튼과 안내 제공', '반례 · 한계': '관찰한 신규 사용자의 경험에 한정' }, 'observed');
  await page.click('[data-capture=active] .ir-chapter-heading>button');
  await (await page.$('.vc-mvp')).screenshot({ path: path.join(output, 'pm-mvp-board.png') });
  assert.equal(await page.$('.pm-judgment-profile'), null, 'sidebar keeps the light introduction and source vault');
  assert.ok(await page.$eval('.vc-graph .vc-scroll', element => element.scrollWidth <= element.clientWidth + 1), 'desktop shows the full decision map without horizontal scrolling');
  await page.click('.vc-node[data-kind=selected]');
  assert.match(await page.$eval('.vc-inspector', element => element.textContent), /첫 방문자의 진입 장벽/);
  await (await page.$('.vc-graph')).screenshot({ path: path.join(output, 'pm-decision-map.png') });
  await page.screenshot({ path: path.join(output, 'pm-comparison-desktop.png'), fullPage: true });

  await selectStage('.rs-pm-nav>button', 2);
  await addRecord('requirements', { '요구사항': '실패 뒤 작성 내용 유지', '조건 · 분기 · 처리 정책': '저장 실패 시 기존 입력과 재시도 버튼 표시', '인수 기준': '재시도 뒤 입력 내용 복구', '직접 책임진 범위': '예외 정책과 인수 조건을 직접 작성' });
  await addRecord('serviceBlueprint', { '단계': '작성 진입', '사용자 행동': '작성 시작 버튼 선택', '화면 · 접점': '첫 화면의 시작 안내', '운영 · 파트너': '운영자가 예시 문구 등록', '시스템': '예시 목록 제공', '예외 처리': '예시가 없어도 빈 초안 시작' });
  await addRecord('serviceBlueprint', { '단계': '작성 저장', '사용자 행동': '경험 내용 입력', '화면 · 접점': '저장 상태 안내', '운영 · 파트너': '저장 실패 문의 확인', '시스템': '임시 저장과 재시도', '예외 처리': '세션 만료 시 재로그인 후 입력 복구' });
  await page.$$eval('.vc-service-path>button', nodes => nodes[1].click());
  assert.match(await page.$eval('.vc-service-layers section:not(.vc-service-hidden)', element => element.textContent), /세션 만료 시 재로그인 후 입력 복구/);
  await selectStage('.rs-pm-nav>button', 3);
  await addRecord('releases', { '이정표': '작성 안내 MVP', '포함 · 제외 범위': '작성 안내 포함 · 검색 제외', '선행 의존성': '정책 문구와 화면 합의', '출시 · 인수 기준': '입력 복구 테스트 통과', '기록된 상태': '시범 운영' });
  await selectStage('.rs-pm-nav>button', 4);
  await addRecord('experiments', { '검증 가설': '작성 위치를 알리면 처음 사용해도 진입할 수 있다', '방법 · 대상 · 기간': '첫 방문 사용자에게 작성 시작 경로 관찰', '사전 성공 기준': '설명 없이 작성 화면 진입', '실제 관찰': '추가 설명 없이 작성 위치를 찾았다', '관찰 후 결정': '다음 검증은 입력 예시 제공 여부' }, 'observed');
  const savedPm = await page.evaluate(() => JSON.parse(JSON.stringify(window.roleData)));
  savedPm.reportSource = '기준 작성 완료율 38%, 목표 60%, 실제 관찰 51%. 신규 사용자 100명, 관찰 기간 7일, 작성 완료 이벤트로 측정했다.';
  savedPm.keyExperiences[0].jobData.pmMetrics = [{ name: '작성 완료율', baseline: '38%', target: '60%', actual: '51%', period: '7일', population: '100명', method: '작성 완료 이벤트', basis: 'self_report', quote: savedPm.reportSource, sourceName: '직접 입력', stage: 'observed' }];
  assert.equal(savedPm.keyExperiences[0].jobData.pmWorkProducts.experiments[0].basis, 'self_report');
  await page.evaluate(data => window.renderWorkspace(data, true), savedPm);
  await selectStage('.rs-pm-nav>button', 4);
  assert.match(await page.$eval('.vc-experiments', element => element.textContent), /추가 설명 없이 작성 위치를 찾았다/);
  assert.match(await page.$eval('.vc-policy', element => element.textContent), /예외 정책과 인수 조건을 직접 작성/);
  assert.match(await page.$eval('.pir-metrics .vc-metric-graphic', node => node.textContent), /51%/);
  await page.click('[data-capture=active] .ir-chapter-heading>button');
  await page.$eval('.pir-hero', element => element.scrollIntoView());
  await page.screenshot({ path: path.join(output, 'pm-report-desktop-top.png') });
  await (await page.$('.vc-service')).screenshot({ path: path.join(output, 'pm-service-blueprint.png') });
  await page.setViewport({ width: 390, height: 844 });
  await page.$eval('.pir-hero', element => element.scrollIntoView());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, 'pm-workspace-mobile.png'), fullPage: true });
  const exportPm = await page.evaluate(async () => {
    const { buildPmEvidenceExportSections } = await import('/src/utils/pmEvidence.js');
    return JSON.stringify(buildPmEvidenceExportSections(window.roleData));
  });
  assert.match(exportPm, /추가 설명 없이 작성 위치를 찾았다/);

  await page.setViewport({ width: 1440, height: 1050 });
  await page.evaluate(() => window.renderWorkspace({ jobCategory: 'marketer', keyExperiences: [{ id: 'campaign-manual', title: '제품 사용법을 알리는 첫 구매 캠페인', context: '가격보다 사용법에 대한 문의가 많았다.', jobData: {} }] }, true));
  await selectStage('.rs-marketing-nav>button', 0);
  await addRecord('audiences', { '선택한 고객': '제품을 처음 접하는 고객', '관찰 근거': '구매 전에 사용 방법을 묻는 문의', '고객의 필요': '처음 사용하는 장면을 이해하고 싶음', '행동을 막는 장벽': '사용 방법의 불명확함', '선택 이유': '가격 강조보다 실제 사용을 설명' }, 'observed');
  await addRecord('positioning', { '누구에게': '처음 방문한 고객', '전달할 약속': '처음 쓰는 순간부터 쉽게 시작', '믿을 이유': '단계별 사용 가이드', '다른 선택지와의 차이': '혜택보다 사용 맥락을 전달', '표현과 톤': '친절하고 구체적인 안내' });
  await selectStage('.rs-marketing-nav>button', 1);
  await addRecord('creatives', { '소재 이름': '사용 장면 카드뉴스', '형식': '카드뉴스', '후킹 문구': '처음 쓰는 순간을 함께', '메시지 본문': '실제 사용 순서를 보여주는 안내', '행동 유도': '사용 가이드 보기', '표현 선택 이유': '사용법 문의에 먼저 답하기', '실제 반응': '고객이 다음 사용 방법을 문의했다' }, 'observed');
  assert.match(await page.$eval('.mir-copy-ledger', element => element.textContent), /고객이 다음 사용 방법을 문의했다/);
  await selectStage('.rs-marketing-nav>button', 2);
  await addRecord('channels', { '채널': '인스타그램', '맡긴 역할': '사용 장면으로 관심 유도', '도달할 고객': '첫 방문 고객', '기간': '첫 캠페인 주간', '다음 접점': '사용 가이드', '선택 이유': '이미지로 사용법을 전달' });
  await addRecord('channels', { '채널': '사용 가이드', '맡긴 역할': '상세 정보 전달', '도달할 고객': '카드뉴스 유입 고객', '다음 접점': '구매 페이지' });
  assert.equal(await page.$$eval('.vc-marketing .vc-node[data-kind=channel]', nodes => nodes.length), 2);
  assert.ok(await page.$eval('.vc-marketing .vc-scroll', element => element.scrollWidth <= element.clientWidth + 1), 'desktop shows every campaign route node');
  await page.click('[data-capture=active] .ir-chapter-heading>button');
  await (await page.$('.vc-marketing.vc-graph')).screenshot({ path: path.join(output, 'marketer-channel-ledger.png') });
  await page.$eval('.vc-marketing.vc-graph', element => element.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: path.join(output, 'marketer-channel-desktop.png') });
  await selectStage('.rs-marketing-nav>button', 3);
  await addRecord('contentSystem', { '콘텐츠 주제': '처음 사용하는 방법', '검색·독자 의도': '사용 순서 확인', '형식': '블로그', '배포 경로': '가이드 페이지', '발행 주기': '제품 업데이트 때', '재활용 구조': '상담 답변에서 연결' });
  await addRecord('crm', { '대상 조건': '가입 후 미구매 고객', '진입 트리거': '사용 가이드 열람', '발송 시점': '열람 다음 날', '메시지': '사용 장면 안내', '종료·제외 조건': '구매 완료 시 종료', '빈도·안전장치': '동일 안내 중복 발송 제외' }, 'planned');
  assert.match(await page.$eval('.mir-editorial', element => element.textContent), /처음 사용하는 방법/);
  assert.match(await page.$eval('.mir-crm', element => element.textContent), /구매 완료 시 종료/);
  await selectStage('.rs-marketing-nav>button', 4);
  await addRecord('optimization', { '변화를 촉발한 신호': '가격 문의보다 사용법 문의가 많음', '진단': '제품 이해가 구매 전 장벽', '수정한 것': '혜택 문구 대신 사용 장면으로 변경', '실제 관찰': '구체적인 사용 질문으로 반응이 바뀜', '다음 판단': '사용 순서를 더 쉽게 설명' }, 'changed');
  const savedMarketing = await page.evaluate(() => JSON.parse(JSON.stringify(window.roleData)));
  savedMarketing.reportSource = '캠페인의 실제 노출 1,000회, 클릭 50회, 구매 완료율 기준 2%, 목표 5%, 관찰 3%. 제작한 카드뉴스 2개. 집계 기간은 7일이며 구매 완료 이벤트로 확인했다.';
  const reference = { basis: 'self_report', quote: savedMarketing.reportSource, sourceName: '직접 입력', period: '7일' };
  savedMarketing.keyExperiences[0].jobData.marketerEvidenceVersion = 2;
  savedMarketing.keyExperiences[0].jobData.marketerMetrics = [
    { name: '콘텐츠 노출', kind: 'outcome', stage: 'reach', channel: '인스타그램', actual: '1,000회', ...reference },
    { name: '가이드 클릭', kind: 'outcome', stage: 'click', channel: '인스타그램', actual: '50회', ...reference },
    { name: '구매 완료율', kind: 'outcome', stage: 'conversion', channel: '', baseline: '2%', target: '5%', actual: '3%', method: '구매 완료 이벤트', ...reference },
    { name: '제작 소재', kind: 'output', stage: 'reach', actual: '2개', ...reference },
  ];
  savedMarketing.deliverables = [{ id: 'creative-1', name: '합성 시안.svg', url: '/__creative_fixture__.svg', ext: 'png' }, { id: 'report-1', name: '합성 캠페인 리포트.pdf', url: '/__pdf_fixture__.pdf', ext: 'pdf' }];
  savedMarketing.keyExperiences[0].artifactBindings = [{ assetId: 'creative-1', caption: '브라우저 검증용 합성 시안', contribution: '검증용 문안' }, { assetId: 'report-1', caption: '브라우저 검증용 PDF' }];
  await page.evaluate(data => window.renderWorkspace(data, true), savedMarketing);
  await selectStage('.rs-marketing-nav>button', 1);
  assert.match(await page.$eval('.mir-copy-ledger', element => element.textContent), /고객이 다음 사용 방법을 문의했다/);
  assert.equal(await page.$$eval('.vc-funnel .vc-funnel-value', nodes => nodes.length), 3);
  assert.equal(await page.$$eval('.vc-funnel .vc-funnel-value', nodes => nodes.some(node => node.textContent === '2개')), false, 'production volume is not a conversion stage');
  assert.ok(await page.$('.pm-source-vault'), 'marketing also retains the source vault in its left sidebar');
  await page.click('.role-artifact-filmstrip>button:last-child');
  await page.waitForSelector('.role-pdf-preview[data-state=ready]', { timeout: 30000 });
  assert.ok(await page.$eval('.role-pdf-preview canvas', canvas => canvas.width > 0 && canvas.height > 0), 'the actual PDF first page is rendered');
  await (await page.$('.role-artifact-preview.is-pdf')).screenshot({ path: path.join(output, 'marketer-pdf-preview.png') });
  await page.click('.role-artifact-filmstrip>button:first-child');
  await page.click('[data-capture=active] .ir-chapter-heading>button');
  await page.$eval('.role-artifact-preview img', element => element.scrollIntoView());
  await page.waitForFunction(() => document.querySelector('.role-artifact-preview img')?.complete);
  await page.$eval('.mir-hero', element => element.scrollIntoView());
  await page.screenshot({ path: path.join(output, 'marketer-report-desktop-top.png') });
  await (await page.$('.mir-report .ir-chapter:nth-of-type(2)')).screenshot({ path: path.join(output, 'marketer-brief-and-creative.png') });
  await (await page.$('.vc-funnel')).screenshot({ path: path.join(output, 'marketer-funnel.png') });
  await page.setViewport({ width: 390, height: 844 });
  await selectStage('.rs-marketing-nav>button', 2);
  await page.$eval('.mir-hero', element => element.scrollIntoView());
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
  assert.equal(await page.$eval('.ir-records', element => getComputedStyle(element).display), 'none');
  assert.ok(await page.$eval('.one-sheet', element => element.getBoundingClientRect().height > 0));
  await page.emulateMediaType('screen');
  await page.evaluate(data => window.renderWorkspace(data, true, true), savedMarketing);
  await page.waitForSelector('.mir-report');
  assert.equal(await page.$('.work-product-add'), null);
  assert.equal(await page.$('.rs-edit-link'), null);
  assert.deepEqual(errors, []);
  assert.deepEqual(apiRequests, []);
  console.log(JSON.stringify({ ok: true, output, assertions: 'PM decision graph/service flow/policies/observations; marketing route graph/creative gallery/PDF/content/CRM/funnel; sidebar; reload/export/mobile/read-only/print; no API calls' }));
} finally {
  await browser.close();
}
