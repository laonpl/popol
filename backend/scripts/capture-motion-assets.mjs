// Capture the real upload component and result renderers with public example data.
// No authentication, AI requests, uploads to a server, or production writes.
import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildResumeHtml } from '../src/services/resumePdfService.js';
import { PORTFOLIO_EXAMPLES } from '../../frontend/src/pages/portfolio/portfolioExampleData.js';

const out = fileURLToPath(new URL('../../frontend/public/motion/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('Capture page:', error.message));
  // Headless Chrome otherwise paints an unstyled body dark, which hid the resume text.
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 3 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const ImportModal = (await import('/src/components/ImportModal.jsx')).default;
    document.getElementById('root').style.display = 'none';
    const container = document.createElement('div');
    container.id = 'motion-capture-root';
    document.body.append(container);
    window.motionCaptureRoot = createRoot(container);
    window.motionCaptureRoot.render(React.createElement(ImportModal, { targetType: 'experience', onClose() {}, onImport() {} }));
  });
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() => document.fonts.ready);
  await (await page.$('[role="dialog"]')).screenshot({ path: out + 'actual-upload-empty.png' });
  const sourcePage = await browser.newPage();
  await sourcePage.setContent('<html lang="ko"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;padding:50px"><h1>캠퍼스 서비스 기획 프로젝트</h1><h2>프로젝트 기록</h2><p>학생 인터뷰를 통해 서비스 이용 과정의 불편을 조사했습니다.</p><p>역할: 사용자 조사, 서비스 흐름 기획, 화면 디자인</p><p>과정: 인터뷰 → 인사이트 정리 → 프로토타입 → 사용성 검증</p><h2>검증과 회고</h2><p>팀원들과 테스트 결과를 검토하고 개선 근거를 문서에 기록했습니다.</p></body></html>');
  const sourcePdf = Buffer.from(await sourcePage.pdf({ format: 'A4', printBackground: true }));
  await sourcePage.close();
  await writeFile(out + 'sample-project.pdf', sourcePdf);
  await page.evaluate(base64 => {
    const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0));
    const file = new File([bytes], '캠퍼스_서비스기획_최종.pdf', { type: 'application/pdf' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, sourcePdf.toString('base64'));
  await page.waitForFunction(() => document.querySelector('[role="dialog"]').innerText.includes('준비 완료'));
  await (await page.$('[role="dialog"]')).screenshot({ path: out + 'actual-upload-ready.png' });
  console.log('Captured actual ImportModal in empty and selected-file states.');

  // The 자료 입력 step of the real ExperienceChat flow, driven through its own UI.
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clickText = needle => page.evaluate(text => {
    const hit = [...document.querySelectorAll('#motion-capture-root button')].find(node => node.innerText.includes(text));
    if (!hit) throw new Error(`No button matching ${text}`);
    hit.click();
  }, needle);
  const setValue = (selector, value) => page.evaluate(([sel, val]) => {
    const input = document.querySelector(sel);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, [selector, value]);
  await page.setViewport({ width: 1240, height: 1180, deviceScaleFactor: 4 });
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const routerModule = performance.getEntriesByType('resource').find(entry => /react-router-dom\.js\?v=/.test(entry.name))?.name;
    const { createMemoryRouter, RouterProvider } = await import(routerModule);
    const ExperienceChat = (await import('/src/pages/experience/ExperienceChat.jsx')).default;
    const router = createMemoryRouter([{ path: '/', element: React.createElement(ExperienceChat) }], { initialEntries: ['/'] });
    window.motionCaptureRoot.render(React.createElement(RouterProvider, { router, key: 'materials' }));
  });
  await wait(1500);
  await clickText('개발자');
  await wait(700);
  await page.evaluate(() => document.fonts.ready);
  await wait(400);
  // Button rectangles are measured here rather than eyeballed off the PNG later.
  const rectOf = text => page.evaluate(label => {
    const node = [...document.querySelectorAll('#motion-capture-root button')].find(b => b.innerText.includes(label));
    if (!node) throw new Error(`No button matching ${label}`);
    const box = node.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y + window.scrollY), w: Math.round(box.width), h: Math.round(box.height) };
  }, text);
  const hotspots = { select: await rectOf('이 경험으로 시작하기') };
  await page.screenshot({ path: out + 'actual-chat-select.png' });
  console.log('Captured the real 경험 선택 step.');
  await clickText('이 경험으로 시작하기');
  await wait(1200);
  await setValue('#motion-capture-root input[type="text"], #motion-capture-root input:not([type])', '캠퍼스 서비스 개선 프로젝트');
  await wait(400);
  await clickText('자료 입력으로 넘어가기');
  await page.waitForFunction(() => document.querySelector('#motion-capture-root').innerText.includes('자료를 올리면'));
  await page.evaluate(() => document.fonts.ready);
  await wait(600);
  await page.screenshot({ path: out + 'actual-chat-materials.png' });
  await page.evaluate(() => {
    const file = new File([new Uint8Array(2048).fill(37)], '캠퍼스_서비스개선_README.md', { type: 'text/markdown' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = document.querySelector('#motion-capture-root input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await setValue('#motion-capture-root input[placeholder*="github.com"]', 'https://github.com/seoyeon/campus-project');
  await wait(900);
  await page.screenshot({ path: out + 'actual-chat-materials-ready.png' });
  hotspots.draft = await rectOf('초안 만들기');
  console.log('Captured the real 자료 입력 step, empty and filled.');
  await page.setRequestInterception(true);
  const stall = request => {
    if (request.method() === 'POST' || /\/api\/|experience|analy/i.test(request.url())) return;
    request.continue().catch(() => {});
  };
  page.on('request', stall);
  await clickText('초안 만들기');
  await page.waitForFunction(() => /자료에서 경험 조각을 찾는 중|경험 초안을 만드는 중/.test(document.querySelector('#motion-capture-root').innerText), { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await wait(1200);
  await page.screenshot({ path: out + 'actual-chat-loading.png' });
  page.off('request', stall);
  await page.setRequestInterception(false);
  await writeFile(out + 'motion-hotspots.json', JSON.stringify(hotspots, null, 2));
  console.log('Captured the real 분석 중 screen without answering the analysis request.');
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 3 });

  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const routerModule = performance.getEntriesByType('resource').find(entry => /react-router-dom\.js\?v=/.test(entry.name))?.name;
    if (!routerModule) throw new Error('Cannot find the active router module.');
    const { createMemoryRouter, RouterProvider } = await import(routerModule);
    const ExperienceResult = (await import('/src/pages/experience/ExperienceResult.jsx')).default;
    const router = createMemoryRouter([{ path: '/:id', element: React.createElement(ExperienceResult) }], { initialEntries: ['/demo'] });
    window.motionCaptureRoot.render(React.createElement(RouterProvider, { router, key: 'experience' }));
  });
  await new Promise(resolve => setTimeout(resolve, 2500));
  await page.waitForFunction(() => {
    const content = document.querySelector('#motion-capture-root').innerText;
    if (content.includes('Unexpected Application Error')) throw new Error(content.slice(0, 250));
    return content.length > 500;
  }, { timeout: 10000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(resolve => setTimeout(resolve, 1200));
  await page.screenshot({ path: out + 'actual-experience-top.png' });
  await page.evaluate(() => window.scrollTo(0, 730));
  await new Promise(resolve => setTimeout(resolve, 300));
  await page.screenshot({ path: out + 'actual-experience-detail.png' });
  // The whole result page in one tall image, so the film can sweep it end to end.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.6) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 220));
    }
    window.scrollTo(0, 0);
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  await page.screenshot({ path: out + 'actual-experience-full.png', fullPage: true });
  console.log('Captured actual ExperienceResult using its built-in demo data.');

  await page.goto('http://127.0.0.1:3000/example2', { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out + 'actual-portfolio-top.png' });
  await page.evaluate(() => window.scrollTo(0, 760));
  await new Promise(resolve => setTimeout(resolve, 400));
  await page.screenshot({ path: out + 'actual-portfolio-projects.png' });
  // The whole page in one tall image, so the film can scroll it end to end. Every section
  // fades in on scroll, so walk the page first or the tall capture is blank below the fold.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.6) {
      window.scrollTo(0, y);
      await new Promise(resolve => setTimeout(resolve, 220));
    }
    window.scrollTo(0, 0);
  });
  await new Promise(resolve => setTimeout(resolve, 700));
  await page.screenshot({ path: out + 'actual-portfolio-full.png', fullPage: true });
  console.log('Captured public /example2 using the actual web portfolio renderer.');

  const resume = buildResumeHtml(PORTFOLIO_EXAMPLES.example2);
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });
  await page.goto('about:blank');
  await page.setContent(resume, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5000))]));
  await page.screenshot({ path: out + 'actual-resume.png' });
  await page.pdf({ path: out + 'example-resume.pdf', format: 'A4', printBackground: true });
  await writeFile(out + 'capture-sources.json', JSON.stringify({
    upload: 'frontend/src/components/ImportModal.jsx (local file selection only)',
    experience: 'frontend/src/pages/experience/ExperienceResult.jsx (id=demo)',
    portfolio: '/example2 — WebPortfolioTemplates.jsx with PORTFOLIO_EXAMPLES.example2',
    resume: 'backend/src/services/resumePdfService.js — buildResumeHtml(PORTFOLIO_EXAMPLES.example2)',
    note: 'Actual product components with example data. File processing was not sent to an AI or server.',
  }, null, 2));
  console.log('Captured actual resume PDF renderer.');

  // Derived assets, made in the page's own canvas so no image library is needed.
  // -preview copies keep the live /motion page smooth; the MP4 renderer uses the originals.
  // crop-* files are the regions the film magnifies, so blowing one up never forces the
  // browser to resample a forty-megapixel bitmap mid-scroll.
  const derive = async (source, target, box, width) => {
    const data = await page.evaluate(async ([src, area, w]) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const [sx, sy, sw, sh] = area || [0, 0, image.naturalWidth, image.naturalHeight];
      const canvas = document.createElement('canvas');
      canvas.width = w || sw;
      canvas.height = Math.round((w || sw) * sh / sw);
      const context = canvas.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
    }, [`/motion/${source}.png`, box, width]);
    await writeFile(`${out}${target}.png`, Buffer.from(data, 'base64'));
  };
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
  for (const name of ['actual-experience-full', 'actual-portfolio-full'])
    await derive(name, `${name}-preview`, null, 1920);
  for (const name of ['actual-chat-select', 'actual-chat-materials', 'actual-chat-materials-ready', 'actual-chat-loading'])
    await derive(name, `${name}-preview`, null, 1800);
  await derive('actual-experience-full', 'crop-metrics', [520, 1545, 1700, 460]);
  await derive('actual-experience-full', 'crop-strengths', [640, 2900, 1060, 490]);
  await derive('actual-experience-full', 'crop-results', [2400, 4230, 1170, 890]);
  await derive('actual-resume', 'crop-resume-entry', [176, 1272, 1120, 310]);
  await derive('actual-portfolio-full', 'crop-portfolio-card', [690, 3090, 950, 640]);
  console.log('Derived preview copies and callout crops. All assets saved.');
} finally {
  await browser.close();
}

