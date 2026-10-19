// Read-only source fixture + mocked AI/API. No writes to user accounts, no paid calls.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { summarizeRoleSources } from '../src/services/roleSourceExperience.js';
const origin = 'http://localhost:3005', output = await mkdtemp(path.join(tmpdir(), 'fitpoly-source-page-'));
const input = process.env.ROLE_SOURCE_FIXTURE;
const document = input ? JSON.parse(await readFile(input, 'utf8')) : { type: 'figma', title: '합성 MVP 검증', url: 'https://www.figma.com/slides/Synthetic/Deck?node-id=1-2', slideCount: 7, sections: [{ id: 'source', type: 'text', text: '인터뷰를 통한 심층 문제 정의: 파편화 된 경험을 다시 모으는 것. 회사에 맞춘 포트폴리오 양산.\n가입 전환율 28.4%(111명 중 39 가입)\n사전예약 51.8%(47명 중 24명 예약)\nMVP 배포 상태이고 39명 중 재접속자 11명\n2.6만 + 릴스 조회 수\n300 + 댓글 수' }], tables: [] };
const drafted = await summarizeRoleSources([document], { role: 'marketer', generate: async () => JSON.stringify({ headline: '취준생의 경험 정리·포트폴리오 수요를 MVP로 검증', subtitle: '인터뷰에서 찾은 경험 재수집과 기업별 포트폴리오 제작 문제를 MVP와 고객 반응으로 확인한 프로젝트', myRole: '', validation: 'MVP와 콘텐츠를 공개한 후 조회·댓글 반응과 가입·예약·재접속 기록을 확인했다.', audience: '경험 정리와 기업별 포트폴리오 제작이 어려운 취준생', problem: '여러 도구에 흩어진 경험을 다시 모으고 지원 회사마다 포트폴리오를 재제작하는 과정이 고객의 핵심 부담이었다.', action: '인터뷰로 문제를 좁히고 경쟁 서비스의 가치를 비교했다. MVP를 배포한 뒤 릴스 반응과 가입·예약·재접속을 관찰했다.', result: '릴스 조회 2.6만+와 댓글 300+를 기록했다. 가입 39명, 사전예약 24명, 재접속 11명을 확인했다.', learning: '', process: [{ title: '고객 인터뷰', description: '파편화된 경험의 재수집과 회사별 포트폴리오 제작 부담 확인' }, { title: '경쟁 서비스 비교', description: '기존 서비스의 제작·전환·코칭 가치를 비교해 접근 방향 탐색' }, { title: 'MVP 수요 검증', description: '배포 후 콘텐츠 반응과 가입·예약·재접속을 관찰' }], decisions: [{ title: '경험 재수집과 기업별 제작에 문제를 집중', reason: '인터뷰로 구체적인 고객 부담을 확인' }], metrics: [{ name: '가입', actual: '39명', unit: '명', kind: 'outcome', quote: '가입 전환율 28.4%(111명 중 39 가입)', sourceIndex: 0 }, { name: '사전예약', actual: '24명', unit: '명', kind: 'outcome', quote: '사전예약 51.8%(47명 중 24명 예약)', sourceIndex: 0 }, { name: '재접속', actual: '11명', unit: '명', kind: 'outcome', quote: 'MVP 배포 상태이고 39명 중 재접속자 11명', sourceIndex: 0 }, { name: '릴스 조회', actual: '2.6만+', unit: '회', kind: 'outcome', quote: '2.6만 + 릴스 조회 수', sourceIndex: 0 }] }) });
assert.equal(drafted.metrics.length, 4);
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [], calls = []; let failSummary = false;
  page.on('pageerror', error => errors.push(error.message)); await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url(), headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
    if (url.endsWith('/api/role-data/figma')) { if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers }); const body = JSON.parse(request.postData()); assert.equal(body.token, 'source-read-token-not-saved'); calls.push('read-figma'); return request.respond({ headers, contentType: 'application/json', body: JSON.stringify({ ...document, url: body.url }) }); }
    if (url.endsWith('/api/role-data/experience-summary')) { if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers }); const body = JSON.parse(request.postData()); assert.equal(JSON.stringify(body).includes('source-read-token-not-saved'), false); assert.match(JSON.stringify(body.documents), /파편화/); calls.push('write-experience'); return request.respond({ status: failSummary ? 503 : 200, headers, contentType: 'application/json', body: JSON.stringify(failSummary ? { error: '합성 정리 실패 · 기존 본문 유지' } : { ...drafted, documents: body.documents }) }); }
    if (url.endsWith('/api/health')) return request.respond({ headers, contentType: 'application/json', body: JSON.stringify({ features: { documentUpload: true } }) });
    if (url.endsWith('/api/import/upload')) { if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers }); calls.push('read-file'); return request.respond({ headers, contentType: 'application/json', body: JSON.stringify({ imported: { content: document.sections.map(section => section.text).join('\n') } }) }); }
    if (url.endsWith('/api/upload/document')) { if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers }); return request.respond({ headers, contentType: 'application/json', body: JSON.stringify({ url: origin + '/source-original.pdf' }) }); }
    if (url.includes('/api/')) return request.abort();
    if (url.endsWith('/__source_experience__')) return request.respond({ contentType: 'text/html', body: '<html><body><div id="root" style="max-width:1280px;margin:auto;padding:20px"></div></body></html>' });
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) return request.abort(); return request.continue();
  });
  await page.setViewport({ width: 1440, height: 1100 }); await page.goto(origin + '/__source_experience__');
  await page.evaluate(async doc => {
    const refresh = await import('/@react-refresh'); refresh.default.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import('/node_modules/.vite/deps/react.js'), { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { MarketerDoc, PmDoc } = await import('/src/pages/experience/ExperienceResult.jsx'); const { default: ReadOnly } = await import('/src/components/portfolio/MarketerEvidenceCaseStudy.jsx'); await import('/src/index.css');
    const root = ReactDOM.createRoot(document.getElementById('root')); let revision = 0;
    window.renderSourceCase = (data, reload = false, readOnly = false) => { window.sourceState = data; if (reload) revision++; root.render(React.createElement(readOnly ? ReadOnly : data.jobCategory === 'pm' ? PmDoc : MarketerDoc, { key: String(revision), sr: data, sourceText: '', cs: { title: '라온플 / FitPoly', summary: '고객 문제 정의와 MVP 수요 검증', meta: { role: '', duration: '2026-02 ~ 2026-06', team: '' }, body: [] }, setField: () => {}, setMeta: () => {}, onChange: readOnly ? undefined : next => window.renderSourceCase(next), onPatchSr: next => window.renderSourceCase(next), readOnly })); };
    window.renderSourceCase({ jobCategory: 'marketer', keyExperiences: [{ id: 'source-case', title: '핵심 경험 3', context: '실행한 행동과 의사결정 과정을 보강해 주세요.\n측정 가능한 결과나 산출물을 보강해 주세요.', action: '실행한 행동과 의사결정 과정을 보강해 주세요.', result: '측정 가능한 결과나 산출물을 보강해 주세요.', learning: '인사이트, trade-off, 다음 적용점을 보강해 주세요.', roleSummary: { figmaUrl: doc.url }, jobData: {} }] });
  }, document);
  await page.waitForSelector('.one-sheet');
  assert.equal(await page.$('.one-sheet iframe'), null); assert.equal(await page.$('.one-sheet .one-no-kpi'), null);
  assert.doesNotMatch(await page.$eval('.one-sheet', element => element.textContent), /보강해 주세요|목표와 결과를 비교하는 경험|실제 성과를 연결하면/);
  await page.click('[aria-label="Figma Notion 자료 연결"]'); await page.type('[aria-label="Figma 파일 읽기 토큰"]', 'source-read-token-not-saved');
  await page.click('.one-planning-connect footer button'); await page.waitForFunction(() => document.querySelector('.one-sheet h2')?.textContent.includes('MVP로 검증'));
  assert.match(await page.$eval('.one-source-steps', element => element.textContent), /고객 인터뷰.*경쟁 서비스 비교.*MVP 수요 검증/s);
  assert.match(await page.$eval('.one-kpis', element => element.textContent), /39명.*24명.*11명.*2.6만/s);
  assert.equal(await page.$('.one-sheet iframe'), null); assert.equal(await page.$eval('.one-source-original', element => element.open), false);
  assert.equal(await page.evaluate(() => JSON.stringify(window.sourceState).includes('source-read-token-not-saved')), false);
  assert.equal(await page.evaluate(() => window.sourceState.keyExperiences[0].context.includes('보강')), false);
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify(window.sourceState))); await page.evaluate(data => window.renderSourceCase(data, true), saved);
  await page.waitForSelector('.one-source-steps'); assert.match(await page.$eval('.one-story', element => element.textContent), /기업별|지원 회사/);
  const exported = await page.evaluate(async () => { const { buildMarketerEvidenceExportSections } = await import('/src/utils/marketerEvidence.js'); return JSON.stringify(buildMarketerEvidenceExportSections(window.sourceState)); });
  assert.match(exported, /39명/); assert.match(exported, /고객 인터뷰/);
  await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(output, 'source-experience-page.png'), fullPage: true }); await (await page.$('.one-sheet')).screenshot({ path: path.join(output, 'source-experience-sheet.png') });
  await page.setViewport({ width: 390, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: path.join(output, 'source-experience-mobile.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 1100 }); await page.emulateMediaType('print');
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } }); await writeFile(path.join(output, 'source-experience.pdf'), pdf);
  const count = await page.evaluate(async bytes => { const pdf = await import('/node_modules/.vite/deps/pdfjs-dist.js'); const worker = await import('/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url'); pdf.GlobalWorkerOptions.workerSrc = worker.default; const document = await pdf.getDocument({ data: new Uint8Array(bytes) }).promise; const count = document.numPages; await document.destroy(); return count; }, Array.from(pdf));
  assert.equal(count, 1, 'source-based experience fits exactly one A4 page'); await page.emulateMediaType('screen');
  const before = await page.evaluate(() => JSON.stringify(window.sourceState)); failSummary = true; await page.click('[aria-label="Figma Notion 자료 연결"]'); await page.click('.one-planning-connect footer button'); await page.waitForSelector('.one-error'); assert.equal(await page.evaluate(() => JSON.stringify(window.sourceState)), before);
  await page.evaluate(data => window.renderSourceCase(data, true, true), saved); await page.waitForSelector('.one-source-steps'); assert.equal(await page.$('.one-tools'), null); assert.equal(await page.$('.one-sheet iframe'), null);
  await page.evaluate(data => window.renderSourceCase({ ...data, jobCategory: 'pm' }, true), saved); await page.waitForSelector('.one-pm .one-source-steps');
  assert.equal(await page.$('.one-sheet iframe'), null); assert.match(await page.$eval('.one-story', element => element.textContent), /MVP/);
  await (await page.$('.one-sheet')).screenshot({ path: path.join(output, 'source-experience-pm-sheet.png') });
  failSummary = false;
  await page.evaluate(() => window.renderSourceCase({ jobCategory: 'marketer', keyExperiences: [{ id: 'pdf-case', title: '파일로 경험 정리', roleSummary: { figmaUrl: 'https://www.figma.com/slides/PdfFallback/Deck' }, jobData: {} }] }, true));
  await page.waitForSelector('.one-tools'); await page.click('[aria-label="Figma Notion 자료 연결"]');
  await (await page.$('.one-source-file-picker input')).uploadFile(path.join(output, 'source-experience.pdf'));
  await page.waitForSelector('.one-source-files'); await page.click('.one-planning-connect footer button'); await page.waitForSelector('.one-source-steps');
  assert.equal(calls.filter(call => call === 'read-figma').length, 1, 'PDF source works without a Figma token or another Figma read');
  assert.equal(await page.evaluate(() => window.sourceState.keyExperiences[0].sourceDocuments[0].type), 'file');
  assert.equal(await page.evaluate(() => window.sourceState.deliverables[0].url), origin + '/source-original.pdf');
  assert.equal(await page.evaluate(() => window.sourceState.keyExperiences[0].artifactBindings[0].assetId === window.sourceState.deliverables[0].id), true);
  assert.deepEqual(errors, []); console.log(JSON.stringify({ ok: true, output, fixture: input ? 'user-provided Figma source, read-only' : 'synthetic', checks: 'internal source to narrative/steps/KPIs; no main iframe/filler/empty KPI; source scope; transient token; persistence/export/mobile; one-page PDF; failed analysis preserves data; read-only; PM; PDF fallback without token; vault source binding; mocked AI/API' }));
} finally { await browser.close(); }
