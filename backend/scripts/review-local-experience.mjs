// Exercise real React screens and browser parsers with synthetic files; account writes are mocked.
import puppeteer from 'puppeteer';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createLocalConnector } from '../../local-connector/server.mjs';

const origin = process.env.LOCAL_REVIEW_ORIGIN || 'http://127.0.0.1:3000';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-local-experience-'));
const sample = name => `${name}\n역할: 서비스 기획자\n배경: 사용자가 자료를 찾기 어려운 문제가 있었습니다.\n과제: 검색 과정을 단순하게 만들어야 했습니다.\n한 일: 사용자 인터뷰를 진행하고 검색 화면을 개선했습니다.\n성과: 검색 완료율 18% 개선\n배운 점: 작은 가설부터 검증하는 습관을 배웠습니다.`;
const xml = text => `<root xmlns:x="urn:fixture">${text.split('\n').map(line => `<x:p><x:r><x:t>${line}</x:t></x:r></x:p>`).join('')}</root>`;
async function zipped(name, text) { return new JSZip().file(name, xml(text)).generateAsync({ type: 'base64' }); }
const fixtures = [
  { name: '프로젝트.txt', text: '<h2>검색 개선 프로젝트</h2>' + sample('검색 개선 프로젝트').split('\n').slice(1).map(line => `<li><strong>${line.split(':')[0]}:</strong>${line.slice(line.indexOf(':') + 1)}</li>`).join('') },
  { name: '복사본.md', text: sample('검색 개선 프로젝트') },
  { name: '성과.csv', text: sample('동아리 운영 프로젝트') },
  { name: '기획서.docx', base64: await zipped('word/document.xml', sample('수업 기획 프로젝트')) },
  { name: '발표.pptx', base64: await zipped('ppt/slides/slide1.xml', sample('해커톤 프로젝트')) },
  { name: '보고서.hwpx', base64: await zipped('Contents/section0.xml', sample('연구 프로젝트')) },
  { name: '깨진파일.pdf', text: 'This is deliberately not a valid PDF document.' },
  { name: '구형문서.hwp', text: 'unsupported' },
];
const writes = [], errors = [], prohibited = [], analysisCalls = [];
let failNextAnalysis = false;
let failWithConfigurationError = false;
let connectorAvailable = false;
let autoStartRequests = 0;
let websiteMode = false;
const fixtureDirectory = path.join(output, 'synthetic-personal-files');
const fixtureC = path.join(fixtureDirectory, 'drive-c'), fixtureD = path.join(fixtureDirectory, 'drive-d');
await mkdir(fixtureC, { recursive: true }); await mkdir(fixtureD, { recursive: true });
const connector = createLocalConnector({ roots: async () => [{ path: fixtureD, label: 'D: 드라이브', driveCode: 'D:' }, { path: fixtureC, label: 'C: 드라이브', driveCode: 'C:' }] });
connector.listen(0, '127.0.0.1'); await once(connector, 'listening');
const connectorEndpoint = `http://127.0.0.1:${connector.address().port}`;
const browser = await puppeteer.launch({ headless: true });
try {
  const fixturePage = await browser.newPage();
  await fixturePage.setContent('<meta charset="utf-8"><h1>연구 발표 프로젝트</h1><p>역할: 연구원</p><p>한 일: 사용자 25명을 인터뷰하고 검색 대시보드를 개발했습니다.</p><p>성과: 과제 완료율 18% 개선</p>');
  const pdf = await fixturePage.pdf();
  fixtures.push({ name: '연구발표.pdf', base64: Buffer.from(pdf).toString('base64') });
  for (const fixture of fixtures) await writeFile(path.join(fixtureD, fixture.name), fixture.base64 ? Buffer.from(fixture.base64, 'base64') : fixture.text);
  await writeFile(path.join(fixtureD, 'README.txt'), '이 설명서는 소프트웨어 라이선스와 일반적인 설치 방법을 안내합니다.');
  for (let i = 0; i < 35; i += 1) await writeFile(path.join(i % 2 ? fixtureD : fixtureC, `추가 프로젝트 ${i}.txt`), sample(`자동 탐색 프로젝트 ${i}`));
  await writeFile(path.join(fixtureD, '검색 개선 회고.md'), sample('검색 개선 프로젝트 회고'));
  for (const [name, body] of [
    ['FitPoly_릴스_07.txt', 'FitPoly 릴스 07\n프로젝트 파일과 경험을 분석해 성과를 정리하세요. 화면 전환과 후킹 카피를 보여준다.'],
    ['NACE_Student_Survey.md', 'NACE Student Survey\n학생 취업 준비 활동과 인턴 프로젝트의 결과를 분석했다. 응답자 중 65%가 채용 지원 경험이 있었다.'],
    ['장애 이론의 종류.txt', '장애 이론의 종류\n기획 프로젝트 과제로 이론을 분석했다. 의료 모델과 사회 모델의 학습 내용을 정리했다.'],
    ['경험_예시.md', sample('가상 프로젝트')],
  ]) await writeFile(path.join(fixtureD, name), body);
  await fixturePage.close();
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    const respond = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (websiteMode && ['/src/services/localExperienceConnector.js', '/src/components/LocalExperienceImport.jsx'].includes(url.pathname)) {
      const module = await (await fetch(request.url())).text();
      return request.respond({ contentType: 'application/javascript', body: module.replace(/import\.meta\.env\??\.DEV/g, 'false') });
    }
    if (url.pathname === '/__fitpoly/local-experience/connect') {
      autoStartRequests++;
      return respond({ ready: true, version: 3 });
    }
    if (url.origin === 'http://127.0.0.1:43127') {
      if (!connectorAvailable) return request.abort('connectionrefused');
      const headers = { ...request.headers() }; delete headers.host; delete headers['content-length'];
      const upstream = await fetch(connectorEndpoint + url.pathname, { method: request.method(), headers, ...(['POST'].includes(request.method()) ? { body: request.postData() || '{}' } : {}) });
      return request.respond({ status: upstream.status, headers: Object.fromEntries(upstream.headers), body: Buffer.from(await upstream.arrayBuffer()) });
    }
    if (url.pathname === '/src/services/apiBase.js') return request.respond({ contentType: 'application/javascript', body: "export function getApiBaseUrl(){return '/api';}" });
    if (url.pathname === '/src/stores/authStore.js') return request.respond({ contentType: 'application/javascript', body: "import {create} from '/node_modules/.vite/deps/zustand.js';export default create(()=>({user:{uid:'local-fixture',displayName:'테스트'},profile:{nameKo:'테스트',jobCategory:'pm'},loading:false,profileLoading:false,init:()=>()=>{}}));" });
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/experience/list') return respond(writes.map((body, i) => ({ ...body, id: `saved-${i}` })));
      if (url.pathname === '/api/experience' && request.method() === 'POST') {
        const body = JSON.parse(request.postData()); writes.push(body); return respond({ ...body, id: `saved-${writes.length}` }, 201);
      }
      if (url.pathname === '/api/experience/analyze') {
        const body = JSON.parse(request.postData()); analysisCalls.push(body);
        if (failWithConfigurationError) return respond({ error: 'AI 서버의 인증 또는 모델 접근 설정 문제로 분석하지 못했어요.', code: 'AI_CONFIGURATION', stopBatch: true }, 503);
        if (failNextAnalysis) { failNextAnalysis = false; return respond({ error: '테스트 분석 실패' }, 400); }
        const saved = writes[Number(body.experienceId.split('-').at(-1)) - 1];
        assert.equal('reviewedMoments' in body, false);
        const next = { ...saved.structuredResult,
          keyExperiences: Array.from({ length: body.momentsCount }, (_, i) => ({ ...saved.structuredResult.keyExperiences[0], id: `case-${i}`, title: `${saved.jobCategory} 핵심 판단 ${i + 1}`, jobData: saved.jobCategory === 'pm' ? { pmWorkProducts: { alternatives: [] } } : { techStack: 'React', troubleshooting: '검색 지연 개선' } })),
          jobSpecific: saved.jobCategory === 'pm' ? { strategy: '가설과 우선순위 결정' } : { architecture: '검색 구조 설계' },
        };
        delete next._draft;
        saved.structuredResult = next;
        return respond(next);
      }
      if (/^\/api\/experience\/saved-\d+$/.test(url.pathname)) {
        const saved = writes[Number(url.pathname.split('-').at(-1)) - 1];
        return respond({ ...saved, id: url.pathname.split('/').at(-1) });
      }
      if (url.pathname === '/api/experience/analyze-role') return respond({ pmOnePage: { title: '로컬 자료의 기획 임팩트', source: 'analysis' } });
      if (/import|upload|analyze|draft/.test(url.pathname)) prohibited.push(url.pathname);
      return respond({ balance: 1000, feedbackRewardGranted: true });
    }
    if (url.origin !== origin && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) return request.abort();
    return request.continue();
  });
  const click = async (selector, label) => {
    assert.equal(await page.$$eval(selector, (nodes, label) => { const node = nodes.find(node => node.textContent.includes(label)); node?.click(); return Boolean(node); }, label), true, `Missing button: ${label}`);
  };
  await page.setViewport({ width: 1440, height: 1080 });
  await page.goto(`${origin}/app/experience/start`);
  await page.waitForSelector('[data-method="local"]');
  assert.equal(await page.$$eval('.fp-method-card', nodes => nodes.length), 4);
  await page.screenshot({ path: path.join(output, 'start-desktop.png'), fullPage: true });
  await page.click('[data-method="local"]');
  await page.waitForSelector('.fp-local-choose');
  await page.evaluate(fixtures => {
    const files = fixtures.map(fixture => {
      const bytes = fixture.base64 ? Uint8Array.from(atob(fixture.base64), ch => ch.charCodeAt(0)) : fixture.text;
      return new File([bytes], fixture.name);
    });
    window.fixtureLocalFiles = files;
    const entries = files.map(file => ({ kind: 'file', name: file.name, getFile: async () => file }));
    const dir = (name, rows) => ({ kind: 'directory', name, async *values() { yield* rows; } });
    window.showDirectoryPicker = async () => dir('경험자료', [dir('학교활동', entries), dir('node_modules', [{ kind: 'file', name: 'secret.md', getFile() { throw Error('Must not read'); } }])]);
  }, fixtures);
  await click('button', '폴더 선택하기');
  await page.waitForSelector('.fp-local-files');
  assert.equal(await page.$$eval('.fp-local-files li', nodes => nodes.length), 8);
  await page.type('[aria-label="파일 목록 검색"]', '보고서');
  assert.equal(await page.$$eval('.fp-local-files li', nodes => nodes.length), 1);
  await page.$eval('[aria-label="파일 목록 검색"]', input => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelectorAll('.fp-local-files li').length === 8);
  await click('button', '검색 결과 선택');
  await page.screenshot({ path: path.join(output, 'files-desktop.png'), fullPage: true });
  await click('button', '개 파일 정리');
  await page.waitForSelector('.fp-local-candidate');
  assert.equal(await page.$$eval('.fp-local-candidate', nodes => nodes.length), 6, 'PDF, DOCX, PPTX, HWPX and text parsed in browser; exact copies deduplicated');
  assert.ok(await page.$$eval('.fp-local-title input, .fp-local-fields textarea', nodes => nodes.every(node => !/<\/?(?:li|h[1-6]|strong|ul|p)>|\*\*/.test(node.value))), 'HTML and Markdown do not leak into editable fields');
  const pdfCandidate = await page.$$eval('.fp-local-candidate', nodes => nodes.filter(node => node.textContent.includes('연구발표.pdf')).map(node => ({ title: node.querySelector('.fp-local-title input').value, source: node.querySelector('pre').textContent })));
  assert.ok(pdfCandidate.some(item => item.title.includes('연구 발표 프로젝트')), `Korean PDF text is retained: ${JSON.stringify(pdfCandidate)}`);
  assert.match(await page.$eval('.fp-local-warning', node => node.textContent), /깨진파일.pdf/);
  assert.equal(writes.length, 0, 'reading and review send no account writes');
  assert.deepEqual(prohibited, [], 'no upload endpoint used');
  assert.equal(analysisCalls.length, 0, 'only discovery and local extraction happen before analysis is requested');
  assert.equal(await page.$eval('[aria-label="분석할 직군"]', select => select.value), 'pm');
  assert.match(await page.$eval('.fp-local-fields', node => node.textContent), /T · 과제/);
  assert.ok(await page.$$eval('.fp-local-candidate', nodes => nodes.some(node => [...node.querySelectorAll('label')].some(label => label.textContent.includes('T · 과제') && label.querySelector('textarea')?.value.includes('검색 과정을 단순')))));
  await page.select('[aria-label="분석 경력 단계"]', 'experienced');
  await page.screenshot({ path: path.join(output, 'review-desktop.png'), fullPage: true });
  await page.$eval('.fp-local-candidate', node => node.scrollIntoView());
  await page.screenshot({ path: path.join(output, 'candidate-desktop.png') });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'mobile page has no horizontal overflow');
  await page.screenshot({ path: path.join(output, 'review-mobile.png'), fullPage: true });
  await page.$eval('.fp-local-candidate', node => node.scrollIntoView());
  await page.screenshot({ path: path.join(output, 'candidate-mobile.png') });
  await click('button', '선택 해제');
  await page.$$eval('.fp-local-candidate', nodes => {
    for (const name of ['프로젝트.txt', '성과.csv']) nodes.find(node => node.querySelector('.fp-local-source').textContent.includes(name)).querySelector('.fp-local-candidate-top input').click();
  });
  await click('button', '선택한 후보 하나로 합치기');
  await page.waitForFunction(() => document.querySelectorAll('.fp-local-candidate').length === 5);
  const mergedSources = await page.$$eval('.fp-local-source', nodes => nodes.map(node => node.textContent));
  assert.ok(mergedSources.some(text => text.includes('프로젝트.txt') && text.includes('복사본.md') && text.includes('성과.csv')));
  await click('button', '모두 선택');
  failNextAnalysis = true;
  await click('button', '직군별 분석 시작');
  await page.waitForSelector('[role="alert"]');
  assert.equal(writes.length, 5);
  assert.equal(analysisCalls.length, 5);
  assert.equal(await page.$$eval('.fp-local-candidate-top label', nodes => nodes.filter(node => node.textContent.includes('직군별 분석 완료')).length), 4);
  assert.equal(await page.$eval('[aria-label="분석할 직군"]', select => select.disabled), true);
  const failedId = analysisCalls[0].experienceId;
  await click('button', '직군별 분석 시작');
  await page.waitForFunction(() => location.pathname.startsWith('/app/experience/result/'));
  await page.waitForFunction(() => !document.querySelector('.fp-local-import'));
  assert.equal(new URL(page.url()).pathname, `/app/experience/result/${failedId}`, 'a single analysis opens the existing result screen');
  assert.equal(writes.length, 5, 'analysis retry reuses the original saved draft');
  assert.equal(analysisCalls.at(-1).experienceId, failedId);
  assert.ok(writes.every(body => body.analysisMode === 'local_folder' && body.lifecycleStatus === 'needs_confirmation' && body.localSources.length));
  assert.ok(writes.every(body => body.jobCategory === 'pm' && body.careerStage === 'experienced' && body.structuredResult.keyExperiences.length === 3));
  assert.ok(writes.every(body => body.content['로컬 파일 원문'].includes('--- 경험자료/학교활동/')));
  assert.ok(writes.every(body => !('file' in body) && !('base64' in body)));
  assert.ok(writes.some(body => body.content.rawInput.includes('18%')));
  await page.waitForFunction(() => document.body.textContent.includes('pm 핵심 판단'));
  await page.waitForSelector('[aria-label="STAR 경험 정리"]');
  assert.match(await page.$eval('[aria-label="STAR 경험 정리"]', node => node.textContent), /과제·목표/);
  await page.screenshot({ path: path.join(output, 'role-result-mobile.png') });
  // The FileList fallback follows the same local discovery flow.
  await page.goto(`${origin}/app/experience/start?method=local`);
  await page.waitForSelector('.fp-local-choose');
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    const file = new File(['로컬 경험\n한 일: 동아리 발표 자료를 만들고 발표회를 운영했습니다.'], '회고.md');
    Object.defineProperty(file, 'webkitRelativePath', { value: '다른폴더/회고.md' });
    transfer.items.add(file);
    const input = document.querySelector('input[webkitdirectory]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForSelector('.fp-local-files');
  assert.match(await page.$eval('.fp-local-files', node => node.textContent), /다른폴더\/회고.md/);
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => ({ kind: 'directory', name: 'slow', async *values() {
      await new Promise(resolve => setTimeout(resolve, 500));
      yield { kind: 'file', name: '경험.md', getFile: async () => window.fixtureLocalFiles[0] };
    } });
  });
  await click('button', '다른 폴더 선택');
  await page.waitForSelector('.fp-local-progress');
  await click('button', '중단하기');
  await page.waitForSelector('.fp-local-files');
  assert.match(await page.$eval('.fp-local-files', node => node.textContent), /다른폴더\/회고.md/, 'cancel preserves previous inventory');
  await click('button', '개 파일 정리');
  await page.waitForSelector('.fp-local-analysis-options');
  await page.select('[aria-label="분석할 직군"]', 'dev');
  await page.select('[aria-label="분석 경력 단계"]', 'newgrad');
  await page.select('[aria-label="핵심경험 수"]', '5');
  await click('button', '직군별 분석 시작');
  await page.waitForFunction(() => location.pathname.startsWith('/app/experience/result/'));
  await page.waitForFunction(() => document.body.textContent.includes('dev 핵심 판단'));
  assert.equal(writes.at(-1).jobCategory, 'dev');
  assert.equal(writes.at(-1).careerStage, 'newgrad');
  assert.equal(writes.at(-1).structuredResult.keyExperiences.length, 5);
  assert.equal(analysisCalls.at(-1).momentsCount, 5);
  // Automatic discovery goes from the primary button directly to experience candidates.
  await page.goto(`${origin}/app/experience/start?method=local`);
  await page.waitForSelector('.fp-local-choose');
  await page.evaluate(() => { window.pickerCalls = 0; window.showDirectoryPicker = () => { window.pickerCalls += 1; throw Error('automatic search must not open a picker'); }; });
  const hosting = JSON.parse(await readFile(new URL('../../frontend/vercel.json', import.meta.url), 'utf8'));
  const productionCsp = hosting.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value;
  assert.match(productionCsp, /connect-src[^;]*http:\/\/127\.0\.0\.1:43127/);
  await page.evaluate(() => { const meta = document.createElement('meta'); meta.httpEquiv = 'Content-Security-Policy'; meta.content = "connect-src 'self' http://127.0.0.1:43127"; document.head.append(meta); });
  await click('button', '내 컴퓨터 자동 찾기');
  await page.waitForSelector('[role="alert"]');
  assert.match(await page.$eval('[role="alert"]', node => node.textContent), /로컬 네트워크 권한/);
  assert.equal(await page.$('.fp-local-setup'), null, 'local development never asks users to run or download a helper');
  connectorAvailable = true;
  await click('button', '내 컴퓨터 자동 찾기');
  await page.waitForSelector('.fp-local-auto-summary');
  assert.equal(await page.$('.fp-local-files'), null, 'no folder/file selection step');
  assert.equal(await page.evaluate(() => window.pickerCalls), 0);
  assert.equal(autoStartRequests, 2, 'each click automatically prepares the connector before connecting');
  assert.match(await page.$eval('.fp-local-auto-summary', node => node.textContent), /49개 자동 확인/);
  const rootSummary = await page.$eval('.fp-local-root-status', node => node.textContent);
  assert.match(rootSummary, /C: 드라이브/); assert.match(rootSummary, /D: 드라이브/); assert.match(rootSummary, /탐색 완료/);
  const firstSources = await page.$$eval('.fp-local-source', nodes => nodes.map(node => node.textContent).join('\n'));
  assert.match(firstSources, /C: 드라이브/); assert.match(firstSources, /D: 드라이브/);
  const roleField = (await page.$$('.fp-local-fields textarea'))[1];
  await roleField.click(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await roleField.type('직접 맡은 역할');
  assert.equal(await roleField.evaluate(node => node.value), '직접 맡은 역할', 'plain-text editing keeps spaces');
  await page.$eval('.fp-local-auto-summary', node => node.scrollIntoView());
  await page.screenshot({ path: path.join(output, 'automatic-candidates-mobile.png') });
  assert.equal(await page.$('.fp-local-auto-summary button'), null, 'all documents are checked instead of stopping after five candidates');
  assert.equal(await page.$$eval('.fp-local-candidate', nodes => nodes.length), 5, 'only five evidence-backed experiences are expanded');
  assert.match(await page.$eval('.fp-local-filter-summary', node => node.textContent), /NACE|릴스|예시/);
  assert.ok(await page.$$eval('.fp-local-title input', nodes => nodes.every(node => !/NACE|릴스|가상|장애 이론/.test(node.value))));
  assert.equal(await (await page.$$('.fp-local-fields textarea'))[1].evaluate(node => node.value), '직접 맡은 역할', 'review keeps user edits');
  assert.ok(Number((await page.$eval('.fp-local-footer .fp-local-primary', node => node.textContent)).match(/\d+/)[0]) <= 5, 'hidden candidates are not silently selected for paid analysis');
  assert.ok(await page.$$eval('.fp-local-experience-index li', nodes => nodes.length) > 5, 'all found experience titles are discoverable above the cards');
  await click('button', '모두 선택');
  await page.$eval('.fp-local-filter-summary', node => node.scrollIntoView());
  await page.screenshot({ path: path.join(output, 'core-experience-filter-mobile.png') });
  await click('button', '근거 있는 다른 핵심경험 더 보기');
  assert.equal(await page.$$eval('.fp-local-candidate', nodes => nodes.length), 10);
  assert.equal(writes.length, 6, 'automatic local discovery does not write to the account before analysis');
  // A provider authentication failure shows its actual cause and stops the paid batch.
  failWithConfigurationError = true;
  const beforeCalls = analysisCalls.length;
  await click('button', '직군별 분석 시작');
  await page.waitForSelector('[role="alert"]');
  assert.match(await page.$eval('[role="alert"]', node => node.textContent), /인증 또는 모델 접근 설정 문제/);
  assert.equal(analysisCalls.length, beforeCalls + 1);
  assert.equal(writes.length, 7, 'provider outage leaves one saved draft and does not create the rest');
  const failedConfigurationId = analysisCalls.at(-1).experienceId;
  failWithConfigurationError = false;
  await click('button', '직군별 분석 시작');
  await page.waitForFunction(() => document.querySelectorAll('.fp-local-candidate-top label').length > 0
    && [...document.querySelectorAll('.fp-local-candidate-top label')].filter(node => node.textContent.includes('직군별 분석 완료')).length === 5);
  assert.equal(analysisCalls[beforeCalls + 1].experienceId, failedConfigurationId, 'retry reuses the saved experience after an authentication failure');
  assert.equal(writes.length, 11, 'only the remaining four drafts are created');
  // Visitors can use a browser-granted folder without installing or starting an app.
  await page.goto(`${origin}/app/experience/start?method=local`);
  await page.waitForSelector('.fp-local-choose');
  await page.evaluate(() => {
    window.showDirectoryPicker = async () => ({ name: '내 경험', kind: 'directory', async *values() {
      const text = '프로젝트명: 학교 공지 검색\n역할: 개발 담당\n상황: 회원이 공지를 놓치고 있었다.\n과제: 필요한 공지를 찾도록 해야 했다.\n한 일: 검색 필터를 구현했다.';
      yield { kind: 'file', name: '공지 검색.md', getFile: async () => new File([text], '공지 검색.md') };
      yield { kind: 'file', name: '활동 후기.md', getFile: async () => new File(['결과 회고\n결과: 학교 공지 검색 시제품을 배포하고 팀원들이 찾기 편하다고 답했다.'], '활동 후기.md') };
    } });
  });
  await click('button', '설치 없이 폴더 접근 허용');
  await page.waitForSelector('.fp-local-candidate');
  assert.equal(await page.$('.fp-local-files'), null, 'folder permission goes directly to automatic STAR candidates');
  assert.match(await page.$eval('.fp-local-auto-summary', node => node.textContent), /허용한 폴더/);
  assert.equal(await page.$$eval('.fp-local-candidate', nodes => nodes.length), 1, 'different document names with the same project in their body become one experience');
  assert.match(await page.$eval('.fp-local-candidate', node => node.textContent), /관련 자료 2개/);
  assert.match(await page.$eval('.fp-local-source', node => node.textContent), /공지 검색.md/);
  assert.match(await page.$eval('.fp-local-source', node => node.textContent), /활동 후기.md/);
  await page.screenshot({ path: path.join(output, 'merged-star-experience.png'), fullPage: true });
  await click('button', '다른 경험이면 묶음 나누기');
  await page.waitForFunction(() => document.querySelectorAll('.fp-local-candidate').length === 2);
  assert.equal(writes.length, 11);
  // Exercise the production connection branch. Never invoke an OS protocol during QA.
  websiteMode = true; connectorAvailable = false;
  await page.goto(`${origin}/app/experience/start?method=local`);
  await page.waitForSelector('.fp-local-choose');
  await page.evaluate(() => { window.pickerCalls = 0; window.showDirectoryPicker = () => { window.pickerCalls++; throw Error('full PC connection must not invoke a folder picker'); }; });
  await click('button', '내 컴퓨터 자동 찾기');
  await page.waitForSelector('.fp-local-setup');
  assert.match(await page.$eval('.fp-local-setup', node => node.textContent), /방문자 본인의 Windows 계정/);
  assert.match(await page.$eval('.fp-local-setup', node => node.textContent), /FitPoly-자동연결-설정.cmd/);
  assert.equal(await page.$eval('a[download]', node => node.getAttribute('href')), '/local-experience-connector/fitpoly-local-connector-win.zip');
  await page.screenshot({ path: path.join(output, 'website-connection-setup.png'), fullPage: true });
  await page.$eval('a[href="fitpoly-local://connect"]', node => node.addEventListener('click', event => event.preventDefault()));
  connectorAvailable = true;
  await click('a', '설정한 PC 연결 열기');
  await page.waitForSelector('.fp-local-candidate');
  assert.equal(await page.$('.fp-local-setup'), null);
  assert.equal(writes.length, 11);
  assert.equal(await page.evaluate(() => window.pickerCalls), 0);
  assert.deepEqual(prohibited, []);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, automaticDiscovery: { pickerCalls: 0, documents: 49, expandedCoreExperiences: 5, noiseFiltered: true, readsPastFirstFive: true }, contentMerging: { differentFileNames: true, canSeparate: true }, parsedFormats: ['TXT', 'MD', 'CSV', 'PDF', 'DOCX', 'PPTX', 'HWPX'], roles: ['pm', 'dev'], experiences: writes.length, analysisRequests: analysisCalls.length, prohibitedRequests: prohibited, screenshots: output }));
} finally {
  await browser.close();
  connector.closeAllConnections(); await new Promise(resolve => connector.close(resolve));
}
