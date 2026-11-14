// Exercise the real React screens and browser file readers with synthetic documents that contain
// pictures. The AI endpoints and account writes are mocked; no paid AI request is made.
import puppeteer from 'puppeteer';
import JSZip from 'jszip';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createLocalConnector } from '../../local-connector/server.mjs';
import { assignLocalImages } from '../src/services/localExperienceAI.js';

const origin = process.env.LOCAL_REVIEW_ORIGIN || 'http://localhost:3000';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-local-experience-'));
const discoverBodies = [], organizeBodies = [], uploads = [], writes = [], errors = [];
let connectorAvailable = false, websiteMode = false;
const fixtureDirectory = path.join(output, 'synthetic-personal-files');
await mkdir(fixtureDirectory, { recursive: true });
const connector = createLocalConnector({ roots: async () => [{ path: fixtureDirectory, label: 'D: 드라이브', driveCode: 'D:' }] });
connector.listen(0, '127.0.0.1'); await once(connector, 'listening');
const connectorEndpoint = `http://127.0.0.1:${connector.address().port}`;
const browser = await puppeteer.launch({ headless: true });
try {
  // Real raster pictures: a result chart, an app screen and a tiny icon that must be dropped.
  const painter = await browser.newPage();
  await painter.setViewport({ width: 800, height: 900 });
  const shot = async (html, width, height) => { await painter.setContent(`<body style="margin:0">${html}</body>`); return painter.screenshot({ clip: { x: 0, y: 0, width, height } }); };
  const chart = await shot('<div style="width:600px;height:400px;background:#fff;font:20px sans-serif;padding:20px;box-sizing:border-box"><b>가입 전환율</b><div style="display:flex;gap:40px;align-items:flex-end;height:300px"><div style="width:120px;height:90px;background:#999">12%</div><div style="width:120px;height:240px;background:#222;color:#fff">30%</div></div></div>', 600, 400);
  const screen = await shot('<div style="width:420px;height:640px;background:#f4f4f4;font:18px sans-serif;padding:24px;box-sizing:border-box"><h2>FitPoly 업로드</h2><p>파일을 올리면 경험을 정리해요</p><div style="height:300px;border:2px dashed #888"></div></div>', 420, 640);
  const icon = await shot('<div style="width:40px;height:40px;background:red"></div>', 40, 40);
  await painter.setContent(`<meta charset="utf-8"><h1>FitPoly 결과 보고서</h1><p>베타 테스트 결과 가입 전환율이 개선됐다.</p><img src="data:image/png;base64,${Buffer.from(chart).toString('base64')}" width="600">`);
  const pdf = Buffer.from(await painter.pdf());
  await painter.close();

  const xml = text => `<root xmlns:a="urn:a">${text.split('\n').map(line => `<a:p><a:r><a:t>${line}</a:t></a:r></a:p>`).join('')}</root>`;
  const pptx = await new JSZip()
    .file('ppt/slides/slide1.xml', xml('FitPoly 기획서\n취준생의 포트폴리오 제작 부담을 줄이기 위한 서비스'))
    .file('ppt/slides/slide2.xml', xml('베타 결과\n가입 전환율 12% → 30%'))
    .file('ppt/slides/_rels/slide2.xml.rels', '<Relationships><Relationship Id="rId2" Target="../media/image1.png"/><Relationship Id="rId3" Target="../media/image2.png"/></Relationships>')
    .file('ppt/media/image1.png', chart).file('ppt/media/image2.png', icon)
    .generateAsync({ type: 'nodebuffer' });
  const docx = await new JSZip().file('word/document.xml', xml('FitPoly 화면 설계서\n업로드 화면을 설계하고 사용자 인터뷰 12회를 진행했다.'))
    .file('word/media/image1.png', screen).generateAsync({ type: 'nodebuffer' });
  const resume = '김유신 이력서\nFitPoly 3명 (기획 1, 개발 2) 2차 베타 성공 기준 설계\n디지털 트윈 기반 시뮬레이션으로 운영 리스크 제거 및 OPEX 40% 절감 설계';
  const fixtures = [
    { name: 'FitPoly 기획서.pptx', bytes: pptx }, { name: 'FitPoly 화면 설계서.docx', bytes: docx }, { name: 'FitPoly 결과 보고서.pdf', bytes: pdf },
    { name: '김유신_이력서.txt', bytes: Buffer.from(resume) }, { name: '김유신_이력서 (1).txt', bytes: Buffer.from(resume) },
    { name: '마케팅 강의자료.txt', bytes: Buffer.from('마케팅 원론 3주차 강의 자료입니다. 4P와 STP를 설명한다.') },
  ];
  for (const fixture of fixtures) await writeFile(path.join(fixtureDirectory, fixture.name), fixture.bytes);

  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    const respond = (data, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const body = () => JSON.parse(request.postData() || '{}');
    if (url.pathname.startsWith('/__test-images/')) return request.respond({ contentType: 'image/png', body: chart });
    if (websiteMode && ['/src/services/localExperienceConnector.js', '/src/components/LocalExperienceImport.jsx'].includes(url.pathname)) {
      const module = await (await fetch(request.url())).text();
      return request.respond({ contentType: 'application/javascript', body: module.replace(/import\.meta\.env\??\.DEV/g, 'false') });
    }
    // Firestore is not reachable here: the result page's document read goes to the mock API instead.
    if (url.pathname === '/src/pages/experience/ExperienceResult.jsx') {
      const module = await (await fetch(request.url())).text();
      const rerouted = module.replace(/await getDoc\(doc\(db, ["']experiences["'], id\)\)/g, () => "await fetch('/api/experience/' + id).then(r => r.json()).then(d => ({ exists: () => true, data: () => d }))");
      assert.notEqual(rerouted, module, 'result page document read is rerouted');
      return request.respond({ contentType: 'application/javascript', body: rerouted });
    }
    if (url.pathname === '/__fitpoly/local-experience/connect') return respond({ ready: true, version: 3 });
    if (url.origin === 'http://127.0.0.1:43127') {
      if (!connectorAvailable) return request.abort('connectionrefused');
      const headers = { ...request.headers() }; delete headers.host; delete headers['content-length'];
      const upstream = await fetch(connectorEndpoint + url.pathname, { method: request.method(), headers, ...(request.method() === 'POST' ? { body: request.postData() || '{}' } : {}) });
      return request.respond({ status: upstream.status, headers: Object.fromEntries(upstream.headers), body: Buffer.from(await upstream.arrayBuffer()) });
    }
    if (url.pathname === '/src/services/apiBase.js') return request.respond({ contentType: 'application/javascript', body: "export function getApiBaseUrl(){return '/api';}" });
    if (url.pathname === '/src/stores/authStore.js') return request.respond({ contentType: 'application/javascript', body: "import {create} from '/node_modules/.vite/deps/zustand.js';export default create(()=>({user:{uid:'local-fixture',displayName:'테스트'},profile:{nameKo:'테스트',jobCategory:'pm'},loading:false,profileLoading:false,init:()=>()=>{}}));" });
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/experience/local-discover') {
        const input = body(); discoverBodies.push(input);
        const ids = pattern => input.documents.filter(doc => pattern.test(doc.text)).map(doc => doc.id);
        const fit = ids(/FitPoly/), twin = ids(/디지털 트윈/);
        const primary = input.documents.find(doc => /기획서/.test(doc.path))?.id || fit[0];
        return respond({ experiences: [
          { title: 'FitPoly — 경험 정리 서비스 기획·개발', period: '2026-02 ~ 2026-06', summary: '취준생 경험 정리 서비스', core: '베타 성공 기준을 세우고 업로드 흐름을 설계해 가입 전환율을 높였다.', documentIds: [primary, ...fit.filter(id => id !== primary)], primaryDocumentId: primary, anchors: ['FitPoly'], strength: 5 },
          { title: '디지털 트윈 융설 시뮬레이션', summary: '융설 시스템 시뮬레이션', core: '시뮬레이션으로 OPEX 절감안을 설계했다.', documentIds: twin, primaryDocumentId: twin[0], anchors: ['디지털 트윈'], strength: 3 },
        ], updates: [], excluded: ids(/강의/).map(documentId => ({ documentId, reason: '강의 자료(참고자료)' })) });
      }
      if (url.pathname === '/api/experience/local-organize') {
        const input = body(); organizeBodies.push(input);
        return respond({ experience: /FitPoly/.test(input.experience.title) ? {
          title: 'FitPoly — 경험 정리 서비스 기획·개발', period: '2026-02 ~ 2026-06', role: '3인 팀 · 기획 담당',
          context: '취준생은 포트폴리오 제작에 40시간 이상을 쓰고 있었다.', task: '경험 정리 시간을 줄이는 서비스를 기획해야 했다.',
          action: '• 사용자 인터뷰 12회를 진행해 업로드 단계의 불편을 확인했다\n• 2차 베타 성공 기준과 Go/No-Go 기준을 설계했다',
          result: '• 가입 전환율 12% → 30%', keywords: ['사용자 인터뷰'], category: '프로젝트', core: '베타 성공 기준 설계로 전환율을 높였다.', missing: [],
        } : { title: '디지털 트윈 융설 시뮬레이션', context: '겨울철 도로 결빙 문제가 있었다.', action: '• 디지털 트윈 시뮬레이션을 설계했다', result: '• OPEX 40% 절감 설계', missing: ['role', 'task'] },
        images: input.images.map((image, index) => ({ id: image.id, analyzed: true, kind: index ? 'screen' : 'result', relevance: index ? 'supporting' : 'core',
          caption: index ? `화면 ${index}` : '가입 전환율 그래프', description: index ? '업로드 화면 설계' : '베타 전후 가입 전환율 막대 그래프', text: index ? '' : '12% → 30%' })) });
      }
      if (url.pathname === '/api/upload/image') { uploads.push(request.postData()?.length || 0); return respond({ url: `${origin}/__test-images/${uploads.length}.png` }); }
      if (url.pathname === '/api/experience/list') return respond(writes.map((saved, i) => ({ ...saved, id: `saved-${i + 1}` })));
      if (url.pathname === '/api/experience' && request.method() === 'POST') { const saved = body(); writes.push(saved); return respond({ ...saved, id: `saved-${writes.length}` }, 201); }
      if (url.pathname === '/api/experience/analyze') {
        const { experienceId, momentsCount } = body();
        const saved = writes[Number(experienceId.split('-')[1]) - 1];
        const keyExperiences = [{ id: 'k1', title: '베타 성공 기준 설계', context: '베타 판단 기준이 없었다', action: '성공 기준 설계', result: '가입 전환율 12% → 30%' },
          { id: 'k2', title: '업로드 화면 설계', action: '인터뷰로 업로드 화면 설계' }, { id: 'k3', title: '인터뷰 운영', action: '인터뷰 12회' }].slice(0, momentsCount);
        saved.structuredResult = { ...saved.structuredResult, _draft: undefined, keyExperiences, jobCategory: saved.jobCategory };
        saved.keyExpImages = assignLocalImages(keyExperiences, saved.images); // same placement as the server route
        return respond(saved.structuredResult);
      }
      if (/^\/api\/experience\/saved-\d+$/.test(url.pathname)) return respond({ ...writes[Number(url.pathname.split('-').at(-1)) - 1], id: url.pathname.split('/').at(-1) });
      if (url.pathname === '/api/experience/analyze-role') return respond({ pmOnePage: { title: '로컬 자료의 기획 임팩트', source: 'analysis' } });
      return respond({ balance: 1000, feedbackRewardGranted: true });
    }
    if (url.origin !== origin && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) return request.abort();
    return request.continue();
  });
  const click = async (selector, label) => assert.equal(await page.$$eval(selector, (nodes, label) => { const node = nodes.find(node => node.textContent.includes(label) && !node.disabled); node?.click(); return Boolean(node); }, label), true, `Missing button: ${label}`);
  const organized = () => page.waitForFunction(() => document.querySelectorAll('.fp-local-candidate .fp-local-fields').length === 2 && !document.querySelector('.fp-local-body > .fp-local-organizing'));

  // 1. A browser-granted folder: AI finds, organizes with pictures, and the chosen photos reach the result.
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`${origin}/app/experience/start?method=local`);
  await page.waitForSelector('.fp-local-choose');
  await page.evaluate(fixtures => {
    const files = fixtures.map(fixture => new File([Uint8Array.from(atob(fixture.base64), ch => ch.charCodeAt(0))], fixture.name, { lastModified: Date.now() }));
    const dir = (name, rows) => ({ kind: 'directory', name, async *values() { yield* rows; } });
    const entry = file => ({ kind: 'file', name: file.name, getFile: async () => file });
    window.showDirectoryPicker = async () => dir('내 자료', [dir('FitPoly', files.slice(0, 3).map(entry)), ...files.slice(3).map(entry)]);
  }, fixtures.map(fixture => ({ name: fixture.name, base64: fixture.bytes.toString('base64') })));
  await click('button', '설치 없이 폴더 접근 허용');
  await page.waitForSelector('.fp-local-candidate');
  await organized();
  const sent = discoverBodies[0].documents;
  assert.equal(sent.length, 5, 'an identical résumé copy is read once');
  assert.ok(!JSON.stringify(discoverBodies[0]).includes('"data"'), 'no picture bytes are sent for discovery');
  const imageCount = name => sent.find(doc => doc.path.includes(name)).imageCount;
  assert.deepEqual([imageCount('기획서.pptx'), imageCount('화면 설계서.docx'), imageCount('결과 보고서.pdf')], [1, 1, 1], 'PPTX, DOCX and PDF pictures are read; the icon is dropped');
  assert.ok(sent.findIndex(doc => doc.path.includes('기획서')) < sent.findIndex(doc => doc.path.includes('이력서')), 'project documents are read before the résumé');
  const fitOrganize = organizeBodies.find(input => /FitPoly/.test(input.experience.title));
  assert.equal(fitOrganize.documents.length, 4);
  assert.ok(fitOrganize.images.length === 3 && fitOrganize.images.every(image => image.mimeType === 'image/jpeg' && image.data.length > 1000));
  assert.match(fitOrganize.images.find(image => image.path.includes('pptx')).context, /^슬라이드 2: 베타 결과/);
  assert.match(fitOrganize.images.find(image => image.path.includes('pdf')).context, /^1쪽/);
  const card = await page.$eval('.fp-local-candidate', node => ({ title: node.querySelector('.fp-local-title input').value,
    result: node.querySelectorAll('.fp-local-fields textarea')[5].value, images: node.querySelectorAll('.fp-local-images li').length,
    loaded: [...node.querySelectorAll('.fp-local-images img')].every(img => img.complete && img.naturalWidth > 0) }));
  assert.deepEqual(card, { title: 'FitPoly — 경험 정리 서비스 기획·개발', result: '• 가입 전환율 12% → 30%', images: 3, loaded: true });
  assert.match(await page.$eval('.fp-local-filter-summary', node => node.textContent), /강의자료/);
  assert.match(await page.$$eval('.fp-local-candidate', nodes => nodes[1].textContent), /원문에서 확인되지 않은 항목: 내 역할 · 과제/);
  assert.equal(writes.length, 0, 'finding and organizing write nothing to the account');
  await page.$eval('.fp-local-images', node => node.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: path.join(output, 'review-images-desktop.png') });
  await page.setViewport({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal overflow on mobile');
  await page.screenshot({ path: path.join(output, 'review-images-mobile.png') });
  await page.setViewport({ width: 1280, height: 1000 });
  await page.$$eval('.fp-local-candidate', nodes => nodes[0].querySelectorAll('.fp-local-images input[type=checkbox]')[2].click());
  await click('button', '선택 해제');
  await page.$eval('.fp-local-candidate .fp-local-candidate-top input', node => node.click());
  await click('button', '직군별 분석 시작');
  await page.waitForFunction(() => location.pathname.startsWith('/app/experience/result/'));
  assert.equal(uploads.length, 2, 'only the two pictures left in the card are uploaded');
  assert.ok(writes[0].images.length === 2 && writes[0].images.every(image => image.localImage && image.caption));
  assert.match(writes[0].content['문서 속 이미지 분석'], /가입 전환율 그래프/);
  assert.ok(!JSON.stringify(writes[0]).includes('base64'), 'the saved experience keeps URLs, not picture bytes');
  await page.waitForFunction(() => [...document.querySelectorAll('img')].some(img => img.src.includes('/__test-images/') && img.complete && img.naturalWidth > 0), { timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('img')].find(img => img.src.includes('/__test-images/')).scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: path.join(output, 'result-photos.png') });

  // 2. Full-PC automatic search through the local connector reads the same pictures from file bytes.
  connectorAvailable = true;
  discoverBodies.length = 0;
  await page.goto(`${origin}/app/experience/start?method=local`);
  await page.waitForSelector('.fp-local-choose');
  await click('button', '내 컴퓨터 자동 찾기');
  await page.waitForSelector('.fp-local-auto-summary');
  await organized();
  assert.match(await page.$eval('.fp-local-root-status', node => node.textContent), /D: 드라이브/);
  assert.equal(discoverBodies[0].documents.find(doc => doc.path.includes('기획서.pptx')).imageCount, 1);
  assert.equal(await page.$eval('.fp-local-candidate', node => node.querySelectorAll('.fp-local-images li').length), 3);

  // 3. The deployed site without a connector explains the one-time setup.
  websiteMode = true; connectorAvailable = false;
  await page.goto(`${origin}/app/experience/start?method=local`);
  await page.waitForSelector('.fp-local-choose');
  await click('button', '내 컴퓨터 자동 찾기');
  await page.waitForSelector('.fp-local-setup');
  assert.match(await page.$eval('.fp-local-setup', node => node.textContent), /FitPoly-자동연결-설정.cmd/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, pictures: { pptx: 1, docx: 1, pdf: 1, iconDropped: true }, uploads: uploads.length, keyExpImages: writes[0].keyExpImages, screenshots: output }));
} finally {
  await browser.close();
  connector.closeAllConnections(); await new Promise(resolve => connector.close(resolve));
}
