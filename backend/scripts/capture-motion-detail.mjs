// Refresh magnified product regions at 6x CSS resolution and split full-page
// captures into native-resolution tiles. No synthetic upscaling or AI calls.
import puppeteer from 'puppeteer';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildResumeHtml } from '../src/services/resumePdfService.js';
import { PORTFOLIO_EXAMPLES } from '../../frontend/src/pages/portfolio/portfolioExampleData.js';

const base = process.env.MOTION_BASE_URL || 'http://127.0.0.1:3001';
const out = fileURLToPath(new URL('../../frontend/public/motion/', import.meta.url));
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const details = {};
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return request.abort();
    return request.continue();
  });
  page.on('pageerror', error => console.error(error.message));
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 6 });
  await page.goto(base + '/motion?capture=1', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const module = performance.getEntriesByType('resource').find(entry => /react-router-dom\.js\?v=/.test(entry.name))?.name;
    const { createMemoryRouter, RouterProvider } = await import(module);
    const ExperienceResult = (await import('/src/pages/experience/ExperienceResult.jsx')).default;
    document.getElementById('root').style.display = 'none';
    const container = document.createElement('div');
    container.id = 'motion-capture-root';
    document.body.append(container);
    const router = createMemoryRouter([{ path: '/:id', element: React.createElement(ExperienceResult) }], { initialEntries: ['/demo'] });
    createRoot(container).render(React.createElement(RouterProvider, { router }));
  });
  await page.waitForFunction(() => document.querySelector('#motion-capture-root')?.innerText.length > 500);
  const settle = async () => {
    // Element screenshots scroll the page internally. Smooth scrolling otherwise
    // moves the target between measuring its rectangle and capturing the pixels.
    await page.addStyleTag({ content: '* { scroll-behavior: auto !important; }' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise(resolve => setTimeout(resolve, 180));
      }
      window.scrollTo(0, 0);
    });
    await wait(1200);
  };
  const crop = async (name, [x, y, width, height]) => {
    await page.screenshot({ path: out + name + '-hd.png', captureBeyondViewport: true,
      clip: { x: x / 3, y: y / 3, width: width / 3, height: height / 3 } });
    console.log(`Captured ${name} at ${width * 2} × ${height * 2}`);
    details[name] = { width: width * 2, height: height * 2 };
  };
  const captureElement = async (element, name) => {
    const box = await element.evaluate(el => {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      const plate = document.createElement('div');
      plate.id = 'motion-detail-plate';
      Object.assign(plate.style, { position: 'fixed', zIndex: 2147483647, left: '0', top: '0',
        padding: '12px', background: 'white', width: `${rect.width + 24}px`,
        fontFamily: style.fontFamily, fontSize: style.fontSize, boxSizing: 'border-box' });
      const clone = el.cloneNode(true);
      const originals = [el, ...el.querySelectorAll('*')];
      const copies = [clone, ...clone.querySelectorAll('*')];
      originals.forEach((original, i) => {
        const computed = getComputedStyle(original);
        for (const property of computed) copies[i].style.setProperty(property, computed.getPropertyValue(property));
      });
      plate.append(clone);
      document.body.append(plate);
      const bound = plate.getBoundingClientRect();
      return { width: Math.ceil(bound.width), height: Math.ceil(bound.height) };
    });
    await page.screenshot({ path: out + name + '-hd.png', clip: { x: 0, y: 0, ...box }, captureBeyondViewport: false });
    details[name] = { width: box.width * 6, height: box.height * 6 };
    await page.evaluate(() => document.getElementById('motion-detail-plate').remove());
  };
  await settle();
  const measured = await page.evaluate(() => {
    const union = elements => {
      const rects = elements.map(el => el.getBoundingClientRect());
      const x = Math.min(...rects.map(r => r.left)) - 4;
      const y = Math.min(...rects.map(r => r.top)) + window.scrollY - 4;
      const right = Math.max(...rects.map(r => r.right)) + 4;
      const bottom = Math.max(...rects.map(r => r.bottom)) + window.scrollY + 4;
      return [x, y, right - x, bottom - y].map(v => Math.round(v * 3));
    };
    const grid = [...document.querySelectorAll('#motion-capture-root div.grid')].find(el =>
      el.children.length === 4 && el.children[0].innerText.includes('800') && el.children[1].innerText.includes('12'));
    const strengths = [...document.querySelectorAll('#motion-capture-root p')].find(el => el.textContent.trim() === '핵심 강점');
    if (!grid || !strengths) throw new Error('Demo detail layout changed; remeasure before capturing.');
    return { metrics: union([...grid.children].slice(0, 2)), strengths: union([strengths.parentElement]) };
  });
  await crop('crop-metrics', measured.metrics);
  const strengthElement = await page.evaluateHandle(() => [...document.querySelectorAll('#motion-capture-root p')]
    .find(el => el.textContent.trim() === '핵심 강점').parentElement);
  await captureElement(strengthElement, 'crop-strengths');
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);
  await crop('crop-results', [2400, 4230, 1170, 890]);
  await page.goto(base + '/example2', { waitUntil: 'networkidle0' });
  await settle();
  await crop('crop-portfolio-card', [720, 3090, 880, 730]);
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 6 });
  await page.goto('about:blank');
  await page.setContent(buildResumeHtml(PORTFOLIO_EXAMPLES.example2), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  const resumeElement = await page.evaluateHandle(() => [...document.querySelectorAll('.item')]
    .find(el => el.textContent.includes('끼니로그')));
  await captureElement(resumeElement, 'crop-resume-entry');
  await writeFile(out + 'detail-crops.json', JSON.stringify(details, null, 2));

  await page.setViewport({ width: 1440, height: 810, deviceScaleFactor: 1 });
  await page.goto(base + '/motion?capture=1', { waitUntil: 'networkidle0' });
  const manifest = {};
  for (const source of ['actual-experience-full', 'actual-portfolio-full']) {
    const result = await page.evaluate(async source => {
      const sourceImage = new Image();
      sourceImage.src = `/motion/${source}.png`;
      await sourceImage.decode();
      const { naturalWidth: width, naturalHeight: height } = sourceImage;
      const tileHeight = 1536;
      const tiles = [];
      const canvas = document.createElement('canvas');
      canvas.width = width;
      for (let y = 0; y < height; y += tileHeight) {
        canvas.height = Math.min(tileHeight, height - y);
        canvas.getContext('2d').drawImage(sourceImage, 0, y, width, canvas.height, 0, 0, width, canvas.height);
        tiles.push(canvas.toDataURL('image/png').split(',')[1]);
      }
      return { width, height, tileHeight, tiles };
    }, source);
    const tiles = [];
    for (let i = 0; i < result.tiles.length; i++) {
      const filename = `${source}-tile-${i}.png`;
      await writeFile(out + filename, Buffer.from(result.tiles[i], 'base64'));
      tiles.push('/motion/' + filename);
    }
    manifest[source] = { width: result.width, height: result.height, tileHeight: result.tileHeight, tiles };
    console.log(`Tiled ${source}: ${tiles.length} native-resolution tiles`);
  }
  await writeFile(out + 'page-tiles.json', JSON.stringify(manifest, null, 2));
} finally {
  await browser.close();
}
