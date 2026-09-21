// Local synthetic-data QA only. No login, backend writes or paid model calls.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { groundPmEvidence } from '../src/services/pmEvidence.js';

const origin = process.env.PM_REVIEW_ORIGIN || 'http://localhost:3000';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-pm-review-'));
const sources = [
  ['사용자 인터뷰.pdf', '참여자 5명 중 3명이 첫 화면에서 작성 위치를 찾지 못했다. 탐색 동선을 우선 문제로 정했다.'],
  ['제품 의사결정 회의록.pdf', '검색과 작성 안내를 비교했다. 개발 일정 때문에 검색은 MVP에서 제외하고 작성 안내를 먼저 구현하기로 합의했다.'],
  ['PRD.pdf', '나는 작성 안내의 문구와 예외 정책을 작성했다. 개발 담당자가 구현하고 디자이너가 화면을 설계했다.'],
  ['전환 리포트.pdf', '기준값 38%, 목표 60%, 실제 전환율 51%. 측정 기간 7일, 신규 사용자 100명, 작성 완료 이벤트로 측정했다.'],
  ['회고.pdf', '안내를 읽어도 예시가 없어 망설였다는 피드백을 확인했다. 다음 실험은 안내 길이보다 예시 제공 여부를 비교하기로 변경했다.'],
  ['후속 실험 PRD.pdf', '예시 제공 실험의 목표 전환율은 65%로 설정했다. 다음 달에 관찰할 예정이며 아직 실험을 시작하지 않았다.'],
  ['정책 상세.pdf', '임시 저장은 로그인 사용자에게만 제공한다. 세션이 만료되면 재로그인 후 입력을 복구한다. 새로고침 뒤 작성 내용이 유지되는 것을 인수 기준으로 정했다. 나는 저장 정책을 작성했다.'],
  ['사용자 흐름.pdf', '1. 진입: 신규 사용자가 메뉴를 탐색하던 흐름을 첫 화면의 작성 시작 버튼으로 변경했다. 2. 작성: 빈 입력창을 보던 흐름에 예시를 추가했다. 3. 저장: 수동 저장을 임시 저장으로 변경했다. 실패하면 재시도 버튼을 제공한다.'],
  ['협업 회의록.pdf', '개발팀은 자동 저장의 구현 일정을 우려했다. 나는 저장 간격을 늘리는 범위 조정을 제안했고 팀은 30초 간격 저장으로 합의했다.'],
  ['운영 설계.pdf', '1. 작성 진입: 사용자는 작성 시작 버튼을 누르고 운영팀은 예시를 등록한다. 시스템은 예시 목록을 제공한다. 2. 작성 저장: 사용자는 입력하고 운영팀은 실패 문의를 처리한다. 시스템은 임시 저장하며 세션 만료 시 재로그인을 안내한다.'],
  ['성장 설계.pdf', '작성 시작 행동을 늘려 완료 전환율을 높일 수 있다는 가설이다. 시작 이벤트와 완료 이벤트로 측정하고 저장 실패율을 함께 확인하기로 했다.'],
  ['사업 검토.pdf', '취업준비생에게 작성 시간을 줄이는 가치를 제공한다. 크레딧을 구매한 사용자가 비용을 부담한다. 충전 매출을 얻지만 AI 호출 비용과 결제 부담을 함께 고려해야 한다.'],
  ['출시 계획.pdf', 'MVP에는 작성 안내를 포함하고 검색은 제외한다. 정책 합의가 선행 조건이다. 저장 복구 인수 테스트를 통과한 후 출시할 계획이며 현재 검토 중이다.'],
];
const raw = sources.map(([name, text]) => `--- ${name} ---\n${text}`).join('\n\n');
const records = ['discovery', 'prioritization', 'delivery', 'outcome', 'learning'].map((dimension, i) => ({
  dimension, claim: sources[i][1], quote: sources[i][1], source: sources[i][0], stage: i === 4 ? 'changed' : i === 2 ? 'executed' : 'observed', ownership: i === 2 ? '작성 안내 문구·예외 정책 작성' : '',
}));
const sr = groundPmEvidence({ jobCategory: 'pm', keyExperiences: [
  { title: '작성 흐름을 먼저 개선하기로 결정한 이유', jobData: { pmEvidence: records, pmMetrics: [{ name: '작성 완료 전환율', baseline: '38%', target: '60%', actual: '51%', period: '7일', population: '100명', method: '작성 완료 이벤트', quote: sources[3][1], source: sources[3][0] }] } },
  { title: '다음 실험: 예시 제공 가설', jobData: { pmEvidence: [{ dimension: 'validation', claim: '예시 제공 실험을 계획했다. 아직 실제 효과를 확인하지 않았다.', quote: sources[5][1], source: sources[5][0], stage: 'planned' }], pmMetrics: [{ name: '예시 제공 전환율', target: '65%', actual: '65%', quote: sources[5][1], source: sources[5][0] }] } },
] }, raw);
const ref = (i, stage = 'executed') => ({ quote: sources[i][1], source: sources[i][0], stage });
sr.keyExperiences[0].jobData.pmWorkProducts = {
  research: [{ segment: '첫 방문 사용자 5명', observation: '3명이 작성 위치를 찾지 못함', insight: '작성 진입의 발견 어려움', opportunity: '탐색 동선 개선', limitation: '소규모 인터뷰', ...ref(0, 'observed') }],
  businessModel: [{ customer: '취업준비생', payer: '크레딧 구매 사용자', value: '작성 시간 절감', revenue: '크레딧 충전 매출', cost: 'AI 호출 비용', tradeoff: '결제 부담과 호출 비용의 균형', ...ref(11) }],
  metricLinks: [{ driver: '작성 시작 행동', outcome: '작성 완료 전환율', relationship: '진입 개선이 완료 전환을 높일 것이라는 가설', measurement: '시작·완료 이벤트', guardrail: '저장 실패율', ...ref(10, 'planned') }],
  serviceBlueprint: [{ step: '작성 진입', customerAction: '작성 시작 버튼 클릭', frontstage: '작성 시작 버튼', backstage: '운영팀 예시 등록', system: '예시 목록 제공', ...ref(9) }, { step: '작성 저장', customerAction: '내용 입력', backstage: '실패 문의 처리', system: '임시 저장', exception: '세션 만료 시 재로그인', ...ref(9) }],
  releases: [{ milestone: 'MVP 출시', scope: '작성 안내 포함 · 검색 제외', dependency: '정책 합의', gate: '저장 복구 인수 테스트 통과', status: '검토 중', ...ref(12, 'planned') }],
  risks: [{ risk: '세션 만료로 작성 유실', trigger: '로그인 세션 만료', mitigation: '재로그인 후 입력 복구', owner: '저장 정책 작성', ...ref(6) }],
  problems: [{ user: '신규 사용자', context: '첫 작성 진입', signal: '5명 중 3명이 작성 위치를 찾지 못함', problem: '작성 시작 경로의 발견 어려움', ...ref(0, 'observed') }],
  alternatives: [
    { option: '검색 기능', disposition: '기각', criterion: '개발 일정', tradeoff: '검색 편의보다 빠른 작성 진입에 집중', reason: 'MVP 일정 내 범위 축소', ...ref(1) },
    { option: '작성 안내', disposition: '채택', criterion: 'MVP 구현 범위', reason: '먼저 구현하기로 팀 합의', ...ref(1) },
  ],
  journey: [
    { step: '작성 진입', actor: '신규 사용자', before: '메뉴 탐색', after: '첫 화면의 작성 시작 버튼', ...ref(7) },
    { step: '경험 작성', before: '빈 입력창', after: '예시 제공', ...ref(7) },
    { step: '작성 저장', before: '수동 저장', after: '임시 저장', exception: '실패 시 재시도 버튼', ...ref(7) },
  ],
  requirements: [{ requirement: '로그인 기반 임시 저장', rule: '로그인 사용자만 저장 · 세션 만료 시 재로그인 후 복구', acceptance: '새로고침 뒤 작성 내용 유지', owner: '저장 정책 작성', ...ref(6) }],
  experiments: [{ hypothesis: '예시 제공이 작성에 도움을 줄 것이다', method: '다음 달 실험 예정', successCriteria: '목표 전환율 65%', ...ref(5, 'planned') }],
  collaboration: [{ stakeholder: '개발팀', disagreement: '자동 저장의 구현 일정 우려', myAction: '저장 간격을 늘리는 범위 조정 제안', agreement: '30초 간격 저장', ...ref(8) }],
  troubleshooting: [{ issue: '안내를 읽어도 작성 망설임', cause: '예시가 없다는 피드백', change: '안내 길이 대신 예시 제공 여부 비교로 변경', learning: '문구 길이보다 실제 작성 예시를 검증', ...ref(4, 'changed') }],
};
const groundedSr = groundPmEvidence(sr, raw);

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      return request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="pm-test" style="max-width:1060px;margin:auto;padding:24px"></main></body></html>' });
    }
    if (!request.url().startsWith(origin) || /\/api\//.test(request.url())) return request.abort();
    return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1050, deviceScaleFactor: 1 });
  await page.goto(`${origin}/__pm-review`);
  await page.evaluate(async ({ sr, raw }) => {
    const { default: RefreshRuntime } = await import('/@react-refresh');
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: PmEvidenceCaseStudy } = await import('/src/components/portfolio/PmEvidenceCaseStudy.jsx');
    await import('/src/index.css');
    const { PmDoc } = await import('/src/pages/experience/ExperienceResult.jsx');
    // Match the app's baseline reset without mounting its router or authentication.
    const style = document.createElement('style');
    style.textContent = '*{box-sizing:border-box}body{margin:0;font-family:Arial,"Malgun Gothic",sans-serif}h1,h2,h3,h4,p,blockquote,dl,dd{margin:0}button{font:inherit;cursor:pointer}';
    document.head.append(style);
    window.pmRoot = ReactDOM.createRoot(document.getElementById('pm-test'));
    window.renderPm = data => {
      window.currentPm = data;
      window.pmCs ||= { title: '온보딩 작성 흐름 개선', summary: '신규 사용자가 작성 위치를 찾지 못하는 문제를 발견하고 MVP 범위와 다음 실험을 결정한 경험', meta: { role: 'PM · 문제 정의와 정책 작성', duration: '8주', team: 'PM 1 · 개발 2 · 디자인 1' }, body: [{ id: 'legacy-body', type: 'text', content: '기존에 직접 작성한 공통 배경입니다.' }] };
      window.pmRoot.render(React.createElement(PmDoc, { exp: { content: raw }, cs: window.pmCs, sr: data,
        setField: (key, value) => { window.pmCs = { ...window.pmCs, [key]: value }; window.renderPm(window.currentPm); },
        setMeta: () => {}, onPatchSr: next => window.renderPm(next) }));
    };
    window.renderReadOnlyPm = data => window.pmRoot.render(React.createElement(PmEvidenceCaseStudy, { sr: data, sourceText: raw, readOnly: true }));
    window.renderPm(sr);
    const { buildCoreExperienceSections } = await import('/src/utils/coreExperienceSections.js');
    const sections = buildCoreExperienceSections({ jobCategory: 'pm', sr, keyExperiences: sr.keyExperiences });
    window.pmExportText = sections.map(section => section.content).join('\n');
    const { experienceDraftBlocks } = await import('/src/utils/projectSections.js');
    window.pmDraftText = JSON.stringify(experienceDraftBlocks({ title: 'PM 테스트', jobCategory: 'pm', structuredResult: { ...sr, leanCanvas: { uvp: 'OLD_CANVAS_SENTINEL' }, jobSpecific: { msc: 'OLD_MSC_SENTINEL' } } }));
  }, { sr: groundedSr, raw });
  await page.waitForSelector('.pm-proof-record');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.$$eval('.pm-board-block', elements => elements.length), 12);
  assert.equal(await page.$('.pm-board-nav'), null);
  assert.equal(await page.$('.pm-impact-brief'), null);
  assert.equal(await page.$('.pd-decision-notes'), null);
  assert.doesNotMatch(await page.$eval('body', el => el.innerText), /판단이 실제로 구현된 산출물|판단을 설명하는 산출물/);
  assert.deepEqual(await page.$$eval('.pm-proof-case:not(.pm-proof-inactive) .pd-chapter', nodes => nodes.map(node => node.className.split(' ').find(name => name.startsWith('pd-chapter-')))), ['pd-chapter-context', 'pd-chapter-decisions', 'pd-chapter-spec', 'pd-chapter-release', 'pd-chapter-validation', 'pd-chapter-learning']);
  assert.equal(await page.$$eval('.pm-proof-case:not(.pm-proof-inactive) .pm-proof-record', nodes => nodes.length), 5);
  assert.ok(await page.$('.pd-chapter-spec .pd-flow'));
  assert.match(await page.$eval('.pd-chapter-release', el => el.textContent), /나는 작성 안내의 문구와 예외 정책을 작성했다/);
  assert.match(await page.$eval('.pd-chapter-learning', el => el.textContent), /다음 실험은 안내 길이보다 예시 제공 여부/);
  assert.equal(await page.$$eval('.pd-project-notes', nodes => nodes.length), 1);
  assert.match(await page.$eval('.pd-project-notes textarea', el => el.value), /기존에 직접 작성한 공통 배경/);
  assert.ok(await page.$('.pd-flow-nodes'));
  assert.equal(await page.$$eval('.pm-service-flow>li', elements => elements.length), 3);
  assert.ok(await page.$$eval('.pm-proof-tabs button', elements => elements.every(el => el.getBoundingClientRect().height < 130)));
  assert.match(await page.$eval('.pm-spec', el => el.textContent), /새로고침 뒤 작성 내용 유지/);
  assert.match(await page.evaluate(() => window.pmExportText), /조건 · 분기 · 처리 정책: 로그인 사용자만 저장/);
  assert.match(await page.evaluate(() => window.pmExportText), /목표: 65% \/ 관찰값: 미측정·미기록/);
  assert.match(await page.evaluate(() => window.pmExportText), /전환 리포트.pdf/);
  assert.match(await page.evaluate(() => window.pmDraftText), /전환 리포트.pdf/);
  assert.doesNotMatch(await page.evaluate(() => window.pmDraftText), /OLD_CANVAS_SENTINEL|OLD_MSC_SENTINEL/);
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await page.screenshot({ path: path.join(output, 'desktop-top.png') });
  await page.click('.pm-outcome-dashboard .pm-proof-source-toggle');
  assert.equal(await page.$eval('.pm-outcome-dashboard .pm-proof-source-toggle', el => el.getAttribute('aria-expanded')), 'true');
  await page.click('[aria-label="판단 요약 수정"]');
  await page.$eval('.pm-claim-editor textarea', el => { el.focus(); el.select(); });
  await page.keyboard.type('원문을 확인하고 수정한 판단 요약입니다.');
  await page.click('.pm-claim-editor button:last-child');
  assert.equal(await page.evaluate(() => window.currentPm.keyExperiences[0].jobData.pmEvidence[0].claim), '원문을 확인하고 수정한 판단 요약입니다.');
  assert.equal(await page.evaluate(() => window.currentPm.keyExperiences[0].jobData.pmEvidence[0].userEdited), true);
  await page.$eval('.pd-project-notes textarea', el => { el.focus(); el.select(); });
  await page.keyboard.type('공통 배경 편집 후에도 핵심 경험은 유지됩니다.');
  assert.equal(await page.evaluate(() => window.pmCs.body[0].content), '공통 배경 편집 후에도 핵심 경험은 유지됩니다.');
  await page.focus('[role="tab"]');
  await page.keyboard.press('ArrowRight');
  assert.match(await page.$eval('[aria-selected="true"]', el => el.textContent), /다음 실험/);
  assert.equal(await page.$eval('.pm-proof-case:not(.pm-proof-inactive) .pm-proof-actual strong', el => el.textContent), '미측정·미기록');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: path.join(output, 'mobile-planned.png'), fullPage: true });
  await page.keyboard.press('Home');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  for (const key of ['context', 'spec', 'validation', 'release']) {
    await page.click(`.pm-proof-case:not(.pm-proof-inactive) .pd-document-index a[href$="-${key}"]`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(output, `mobile-${key}.png`) });
  }
  await page.setViewport({ width: 1440, height: 1050 });
  await page.focus('.pd-flow-nodes [role=tab]'); await page.keyboard.press('End');
  assert.ok(await page.$('.pd-flow-nodes button:last-child[aria-selected=true]'));
  assert.equal(await page.$$eval('.pd-inspector:not(.pd-inspector-hidden) dl>div', rows => rows.length), 5);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, 'desktop-design.png'), fullPage: true });
  await page.emulateMediaType('print');
  assert.equal(await page.$$eval('.pm-proof-case', elements => elements.filter(el => getComputedStyle(el).display !== 'none').length), 2);
  assert.ok(await page.$$eval('.pm-proof-source-body', elements => elements.every(el => getComputedStyle(el).display !== 'none')));
  assert.ok(await page.$$eval('.pm-proof-record', elements => elements.every(el => el.getBoundingClientRect().height > 0)));
  assert.ok(await page.$$eval('.pd-inspector', elements => elements.every(el => el.getBoundingClientRect().height > 0)));
  assert.ok(await page.$$eval('.pd-detail .pm-service-flow>li', elements => elements.every(el => el.getBoundingClientRect().height > 0)));
  await page.emulateMediaType('screen');
  await page.evaluate(() => { const next = structuredClone(window.currentPm); next.keyExperiences[0].jobData.pmWorkProducts.serviceBlueprint = []; window.renderPm(next); });
  await page.waitForFunction(() => document.querySelectorAll('.pd-inspector:not(.pd-inspector-hidden) dl>div').length === 4);
  assert.match(await page.$eval('.pd-flow', el => el.textContent), /기존 흐름|설계 · 변경/);
  await page.evaluate(() => window.renderPm({ keyExperiences: [{ title: '기존 PM 경험', context: '기존 사용자 문제 기록', action: '기존 정책 작성과 개발 협의', result: '기존 정성 피드백 결과', learning: '기존 다음 실험 판단' }] }));
  await page.waitForSelector('.pd-missing-design');
  assert.equal(await page.$$eval('.pm-blueprint', elements => elements.length), 0);
  assert.match(await page.$eval('.pd-chapter-context', el => el.textContent), /기존 사용자 문제 기록/);
  assert.match(await page.$eval('.pd-chapter-release', el => el.textContent), /기존 정책 작성과 개발 협의/);
  assert.match(await page.$eval('.pd-chapter-validation', el => el.textContent), /기존 정성 피드백 결과/);
  assert.match(await page.$eval('.pd-chapter-learning', el => el.textContent), /기존 다음 실험 판단/);
  assert.equal(await page.$('.pd-chapter-spec'), null);
  assert.equal(await page.$$eval('.pm-proof-record', elements => elements.length), 4);
  await page.evaluate(() => window.renderReadOnlyPm(window.currentPm));
  await page.waitForFunction(() => !document.querySelector('.pd-completion-guide'));
  assert.equal(await page.$('.work-product-editor'), null);
  assert.equal(await page.$('.pm-claim-edit'), null);
  assert.equal(await page.$$eval('.pm-proof-record', elements => elements.length), 4);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['full PM page integration', 'single case evidence area', 'six chapter narrative order', 'legacy narratives in relevant chapters', 'existing project body preserved and editable', 'desktop', 'mobile width', 'keyboard tabs', 'source disclosure', 'claim editing', 'planned outcome', 'print all cases and sources', 'shared export', 'read-only'], screenshots: output }, null, 2));
} finally {
  await browser.close();
}
