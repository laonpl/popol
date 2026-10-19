// Real app routes and stores; all account APIs, Firebase and model requests stay mocked/blocked.
import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const origin = process.env.DOCUMENT_REVIEW_ORIGIN || 'http://127.0.0.1:3100';
const output = await mkdtemp(path.join(tmpdir(), 'fitpoly-integrated-documents-'));
const user = { uid: 'integrated-fixture', displayName: '테스트 지원자' };
let letters = [
  { id: 'existing-letter', userId: user.uid, title: '기존에 작성한 자기소개서', targetCompany: '테스트기업', targetPosition: '서비스 기획', status: 'draft', questions: [{ id: 'q', question: '고객 문제를 해결한 경험을 작성하세요.', answer: '기존에 저장한 답변입니다.', source: 'manual', validation: 'manual', maxLength: 500 }], updatedAt: '2026-10-15' },
  { id: 'unassigned', userId: user.uid, title: '기업 미지정 자기소개서', targetCompany: '', questions: [], updatedAt: '2026-10-14' },
];
const folders = [{ id: 'folder', company: '테스트기업', files: [{ id: 'file', name: '기존 자소서.pdf', category: 'coverLetter', url: 'https://example.invalid/cover.pdf' }], essays: [{ id: 'old', question: '직접 입력한 기존 문항', answer: '기존 폴더 답변', limit: 500 }] }];
folders[0].files[0].uploadedAt = '2026-10-15T01:58:00Z';
folders[0].files.push(
  { id: 'resume-hwp', name: '서비스 기획자 이력서.HWP', category: 'resume', url: 'https://example.invalid/resume.hwp', uploadedAt: '2026-10-15T02:00:00Z' },
  { id: 'resume-word', name: '영문 이력서.docx', category: 'resume', url: 'https://example.invalid/resume.docx', uploadedAt: '2026-10-15T01:56:00Z' },
  { id: 'resume-pdf', name: '제출용 이력서.pdf', category: 'resume', url: 'https://example.invalid/resume.pdf', uploadedAt: '2026-10-15T02:02:00Z' },
  { id: 'proposal-pptx', name: '프로젝트 제안서.pptx', category: 'etc', url: 'https://example.invalid/proposal.pptx', uploadedAt: '2026-10-15T01:55:00Z' },
);
const writes = [], errors = []; let failList = false, boardRequests = 0;
const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url()), method = request.method();
    const respond = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/src/services/apiBase.js') return request.respond({ contentType: 'application/javascript', body: "export function getApiBaseUrl(){return '/api';}" });
    if (url.pathname === '/src/stores/authStore.js') return request.respond({ contentType: 'application/javascript', body: `import {create} from '/node_modules/.vite/deps/zustand.js'; const store=create(()=>({user:${JSON.stringify(user)},profile:{nameKo:'테스트 지원자'},loading:false,profileLoading:false,init:()=>()=>{}})); window.fixtureAuth=store; export default store;` });
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/coverletter/list') return respond(failList ? { error: '테스트: 목록을 다시 불러오세요' } : letters, failList ? 503 : 200);
      if (url.pathname === '/api/coverletter' && method === 'POST') {
        const body = JSON.parse(request.postData()); writes.push({ method, body });
        const letter = { ...body, id: 'new-letter', userId: user.uid }; letters.push(letter); return respond(letter, 201);
      }
      if (url.pathname.startsWith('/api/coverletter/')) {
        const id = url.pathname.split('/').at(-1), found = letters.find(letter => letter.id === id);
        if (method === 'PATCH') { const body = JSON.parse(request.postData()); writes.push({ method, id, body }); Object.assign(found, body); }
        if (method === 'DELETE') { letters = letters.filter(letter => letter.id !== id); return respond({ success: true }); }
        return respond(found || { error: '없음' }, found ? 200 : 404);
      }
      if (url.pathname === '/api/company-folders') {
        if (method === 'PUT') { const body = JSON.parse(request.postData()); writes.push({ method, body }); Object.assign(folders[0], body); return respond(folders[0]); }
        return respond(folders);
      }
      if (url.pathname === '/api/portfolio/list') return respond([
        { id: 'p', title: '프로젝트 경험 포트폴리오', templateType: 'notion', targetCompany: '테스트기업', updatedAt: '2026-10-15T01:57:00Z' },
        { id: 'web', title: '프로덕트 디자이너 웹 포트폴리오', templateType: 'web-minimal', targetCompany: '테스트기업', updatedAt: '2026-10-15T02:01:00Z' },
        { id: 'ppt', title: '서비스 기획 포트폴리오', templateType: 'notion', outputType: 'ppt', pptDeck: { slides: [{}, {}, {}] }, targetCompany: '테스트기업', updatedAt: '2026-10-15T01:59:00Z' },
      ]);
      if (url.pathname === '/api/experience/list') return respond([]);
      if (url.pathname === '/api/document-board') { boardRequests++; return respond({ entries: {} }); }
      if (url.pathname === '/api/billing/wallet') return respond({ balance: 1000, feedbackRewardGranted: true });
      if (url.pathname === '/api/logs/client') return respond({ success: true });
      return request.abort();
    }
    if (url.origin !== origin && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) return request.abort();
    request.continue();
  });
  const clickText = async (selector, label) => {
    const found = await page.$$eval(selector, (nodes, label) => { const node = nodes.find(node => node.textContent.includes(label)); node?.click(); return !!node; }, label);
    assert.ok(found, `Missing ${selector}: ${label}`);
  };
  const navigate = async target => { await page.goto(origin + target); await page.waitForSelector('.ws, .cl-workspace'); };
  const waitForDocumentPreview = async () => page.waitForFunction(() => {
    const list = document.querySelector('.ws-list-scroll');
    if (!list) return false;
    const folder = list.closest('.ws-open-folder');
    if (folder && Math.abs(folder.getBoundingClientRect().width - folder.parentElement.getBoundingClientRect().width) > 1) return false;
    const viewport = list.getBoundingClientRect();
    return [...list.querySelectorAll('.ws-document-row')].slice(0, 3).every(row => {
      const bounds = row.getBoundingClientRect();
      return bounds.top >= viewport.top - 1 && bounds.bottom <= viewport.top + list.clientHeight + 1;
    });
  });
  await page.setViewport({ width: 1440, height: 1000 });
  await navigate('/app/coverletter');
  assert.equal(new URL(page.url()).pathname, '/app/portfolio');
  assert.equal(new URL(page.url()).searchParams.get('type'), 'cover');
  const nav = await page.$$eval('header nav a', nodes => nodes.map(node => node.textContent));
  assert.deepEqual(nav, ['경험 정리', '포트폴리오 · 자기소개서']);
  const navigation = await page.$eval('header nav', element => ({ border: parseFloat(getComputedStyle(element).borderTopWidth), background: getComputedStyle(element).backgroundColor, gap: parseFloat(getComputedStyle(element).gap), shadow: getComputedStyle(element).boxShadow, borders: [...element.querySelectorAll('a')].map(link => parseFloat(getComputedStyle(link).borderTopWidth)) }));
  assert.equal(navigation.border, 0, 'no shared border around the two navigation buttons');
  assert.equal(navigation.shadow, 'none');
  assert.equal(navigation.background, 'rgba(0, 0, 0, 0)'); assert.ok(navigation.gap >= 12); assert.ok(navigation.borders.every(width => width >= 1));
  await clickText('.ws-folder-item', '테스트기업');
  await page.waitForSelector('[data-document-key="coverletter:existing-letter"]');
  assert.equal(await page.$eval('.ws-tabs button[aria-pressed="true"]', node => node.textContent), '자기소개서');
  assert.equal(await page.$('[data-document-type="portfolio"]'), null);
  assert.ok(await page.$('[data-document-key="file:file"]'));
  assert.ok(await page.$('[data-document-key="essays:folder"]'));
  assert.equal(await page.$eval('[data-document-key="file:file"] .document-file-icon img', image => new URL(image.src).pathname), '/brand-icons/pdf.svg');
  assert.equal(await page.$eval('[data-document-key="coverletter:existing-letter"] .ws-row-category', element => element.textContent), '자기소개서');
  assert.equal(await page.$('.ws-board, .ws-lane, .ws-stages, [aria-label="진행 단계"]'), null, 'milestone board is removed');
  assert.equal(await page.$$eval('.ws-document-row', nodes => nodes.length), 3);
  await page.select('[aria-label="서류 정렬"]', 'name');
  const titles = await page.$$eval('.ws-row-name strong', nodes => nodes.map(node => node.textContent));
  assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b, 'ko')));
  await page.type('[aria-label="기업 또는 서류 검색"]', '기존에 작성한');
  await page.waitForFunction(() => document.querySelectorAll('.ws-document-row').length === 1);
  await page.click('[aria-label="검색 지우기"]'); await page.waitForFunction(() => document.querySelectorAll('.ws-document-row').length === 3);
  await page.select('[aria-label="서류 정렬"]', 'recent');
  await page.waitForFunction(() => document.querySelector('.ws-document-row')?.dataset.documentKey === 'file:file');
  await page.click('[data-document-key="coverletter:existing-letter"] .ws-card-menu'); await page.waitForSelector('[role="menu"]');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role="menu"]'));
  await page.focus('.ws-folder-item.is-open'); await page.keyboard.press('ArrowRight');
  await page.waitForSelector('[data-document-key="coverletter:unassigned"]');
  await clickText('.ws-folder-item', '테스트기업'); await page.waitForSelector('[data-document-key="coverletter:existing-letter"]');
  await page.screenshot({ path: path.join(output, 'integrated-library.png'), fullPage: true });
  await page.click('.ws-manage-toggle'); await page.waitForSelector('#folder-management:not([hidden])');
  assert.match(await page.$eval('#company-essays', node => node.textContent), /기존에 작성한 자기소개서/);
  assert.equal(await page.$eval('#company-essays .document-file-icon--pdf img', image => new URL(image.src).pathname), '/brand-icons/pdf.svg');
  assert.equal(await page.$eval('#company-essays textarea', node => node.value), '기존 폴더 답변');
  await page.type('#company-essays textarea', ' 이동 전 저장할 내용.');
  await clickText('#company-essays button', '공고로 자소서 쓰기');
  await page.waitForSelector('.cl-workspace');
  assert.equal(new URL(page.url()).pathname, '/app/portfolio/coverletter/new');
  assert.equal(await page.$eval('input[placeholder="예: 지원 기업"]', node => node.value), '테스트기업');
  assert.match(folders[0].essays[0].answer, /이동 전 저장할 내용/);
  await page.click('.cl-back'); await page.waitForSelector('.ws');
  assert.equal(new URL(page.url()).searchParams.get('company'), '테스트기업');
  await page.waitForSelector('[data-document-key="coverletter:existing-letter"]');
  await page.click('[data-document-key="coverletter:existing-letter"] .ws-document-open');
  await page.waitForSelector('.cl-answer-editor');
  assert.equal(new URL(page.url()).pathname, '/app/portfolio/coverletter/edit/existing-letter');
  assert.equal(await page.$eval('.cl-answer-editor', node => node.value), '기존에 저장한 답변입니다.');
  assert.equal(await page.$eval('header nav a[aria-current="page"]', node => node.textContent), '포트폴리오 · 자기소개서');
  await page.type('.cl-answer-editor', ' 통합 화면에서 이어 쓴 답변.');
  await clickText('.cl-workspace-heading button', '저장');
  await page.waitForFunction(() => document.querySelector('.cl-workspace-heading .cl-save-state')?.textContent === '저장됨');
  assert.match(letters[0].questions[0].answer, /통합 화면/);
  await page.click('.cl-back'); await page.waitForSelector('[data-document-key="coverletter:existing-letter"]');
  await navigate('/app/coverletter/edit/existing-letter?review=1#answer');
  await page.waitForSelector('.cl-answer-editor');
  assert.equal(new URL(page.url()).pathname, '/app/portfolio/coverletter/edit/existing-letter');
  assert.equal(new URL(page.url()).search, '?review=1'); assert.equal(new URL(page.url()).hash, '#answer');
  assert.match(await page.$eval('.cl-answer-editor', node => node.value), /통합 화면/);
  await navigate('/app/coverletter/new?company=새기업');
  assert.equal(await page.$eval('input[placeholder="예: 지원 기업"]', node => node.value), '새기업');
  await navigate('/app/portfolio?type=cover&company=테스트기업');
  await page.waitForSelector('[data-document-key="coverletter:existing-letter"]');
  for (const width of [768, 390, 320]) {
    await page.setViewport({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `page fits ${width}px`);
    await page.waitForFunction(() => { const list = document.querySelector('.ws-list-scroll'); return list && list.scrollWidth <= list.clientWidth + 1; });
    await waitForDocumentPreview();
  }
  await page.click('[aria-label="메뉴 열기"]');
  assert.deepEqual(await page.$$eval('[role="dialog"][aria-label="메뉴"] nav a', nodes => nodes.map(node => node.textContent)), ['경험 정리', '포트폴리오 · 자기소개서']);
  await page.click('[aria-label="메뉴 닫기"]'); await page.screenshot({ path: path.join(output, 'integrated-mobile.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 1000 });
  failList = true; await navigate('/app/portfolio?type=cover');
  await page.waitForSelector('[role="alert"]'); assert.match(await page.$eval('[role="alert"]', node => node.textContent), /목록을 다시/);
  failList = false; await clickText('[role="alert"] button', '다시 불러오기'); await page.waitForSelector('[data-document-key="coverletter:existing-letter"]');
  await navigate('/app/portfolio?company=테스트기업'); await page.waitForSelector('[data-document-key="file:resume-hwp"]');
  for (const [key, asset, category] of [
    ['file:resume-hwp', 'hwp', '이력서'], ['file:resume-word', 'google-docs', '이력서'], ['file:resume-pdf', 'pdf', '이력서'],
    ['file:proposal-pptx', 'powerpoint', '기타 서류'], ['portfolio:ppt', 'powerpoint', '포트폴리오'],
  ]) {
    assert.equal(await page.$eval(`[data-document-key="${key}"] .document-file-icon img`, image => new URL(image.src).pathname), `/brand-icons/${asset}.svg`);
    assert.equal(await page.$eval(`[data-document-key="${key}"] .ws-row-category`, element => element.textContent), category);
  }
  await page.waitForFunction(() => [...document.querySelectorAll('.document-file-icon img')].every(image => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: path.join(output, 'file-icons-desktop.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForFunction(() => { const list = document.querySelector('.ws-list-scroll'); return list && list.scrollWidth <= list.clientWidth + 1; });
  await page.waitForFunction(() => {
    const cabinet = document.querySelector('.ws-cabinet'), selected = cabinet?.querySelector('.ws-folder-slot.is-open');
    if (!selected) return false;
    const viewport = cabinet.getBoundingClientRect(), folder = selected.getBoundingClientRect();
    return folder.left >= viewport.left - 2 && folder.right <= viewport.right + 2;
  });
  await page.screenshot({ path: path.join(output, 'file-icons-mobile.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.setViewport({ width: 1440, height: 1000 });
  await navigate('/app/portfolio?type=portfolio&company=테스트기업');
  await page.waitForFunction(() => document.querySelectorAll('.ws-document-row').length === 3);
  await waitForDocumentPreview();
  await page.waitForFunction(() => [...document.querySelectorAll('.document-file-icon img')].every(image => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: path.join(output, 'portfolio-icons-desktop.png'), fullPage: true });
  await page.setViewport({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const cabinet = document.querySelector('.ws-cabinet'), selected = cabinet?.querySelector('.ws-folder-slot.is-open');
    if (!selected) return false;
    const viewport = cabinet.getBoundingClientRect(), folder = selected.getBoundingClientRect();
    return folder.left >= viewport.left - 2 && folder.right <= viewport.right + 2;
  });
  await waitForDocumentPreview();
  await page.screenshot({ path: path.join(output, 'portfolio-icons-mobile.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 1000 });
  await navigate('/app/portfolio?type=resume&company=테스트기업');
  await page.waitForFunction(() => document.querySelectorAll('.ws-document-row').length === 3);
  for (const [width, height] of [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [390, 844], [320, 844]]) {
    await page.setViewport({ width, height });
    await waitForDocumentPreview();
    assert.ok(await page.$eval('.ws-list-scroll', list => list.scrollHeight <= list.clientHeight + 1), `all three files fit without list scroll at ${width}x${height}`);
  }
  await page.setViewport({ width: 1366, height: 768 });
  await waitForDocumentPreview();
  await page.waitForFunction(() => [...document.querySelectorAll('.document-file-icon img')].every(image => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: path.join(output, 'resume-icons-desktop.png'), fullPage: true });
  letters.push(...Array.from({ length: 25 }, (_, index) => ({ id: `many-${index}`, userId: user.uid, title: `추가 자기소개서 ${String(index + 1).padStart(2, '0')}`, targetCompany: '테스트기업', questions: [] })));
  await navigate('/app/portfolio?type=cover&company=테스트기업'); await page.waitForFunction(() => document.querySelectorAll('.ws-document-row').length === 28);
  assert.ok(await page.$eval('.ws-list-scroll', element => element.scrollHeight > element.clientHeight), 'many documents scroll in one list');
  await page.$eval('.ws-list-scroll', element => { element.scrollTop = element.scrollHeight; });
  assert.ok(await page.$eval('.ws-list-scroll', element => element.querySelector('li:last-child').getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1));
  await page.evaluate(() => window.fixtureAuth.setState({ user: null, profile: null }));
  await page.waitForSelector('.fp-guest-card');
  assert.equal(await page.$('[data-document-key="coverletter:existing-letter"]'), null);
  await clickText('.ws-header-actions button', '자기소개서 쓰기'); await page.waitForFunction(() => location.pathname === '/login');
  assert.match(await page.evaluate(() => history.state.usr.from), /^\/app\/portfolio\/coverletter\/new/);
  assert.deepEqual(errors, []);
  assert.equal(boardRequests, 0, 'opening a folder never reads or changes old milestone state');
  console.log(JSON.stringify({ ok: true, output, writes: writes.length, checks: 'separate desktop nav buttons without shared border/shadow; landing SVG assets for PDF/PPTX/HWP/Word; clear resume/portfolio/cover-letter labels; single document list; sort/search; old URL redirects; folder autosave; saved draft edit/save/return; responsive 320/390/768; load error/retry; guest login; mocked account APIs' }));
} finally { await browser.close(); }
