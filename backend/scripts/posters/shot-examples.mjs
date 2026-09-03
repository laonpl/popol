/**
 * /example4~6 (직무별 경험정리 결과 예시) 상단을 PNG 로 찍어 posters/shots 에 넣는다.
 * 준비: frontend 에서 npm run dev
 * 실행: backend 에서  node scripts/posters/shot-examples.mjs
 */
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
/* 직무 특화 산출물 블록이 화면에 오도록 스크롤 위치를 함께 준다 */
const PAGES = [
  ['http://localhost:3000/example4', 'out-dev.jpg', 1780],
  ['http://localhost:3000/example6', 'out-pm.jpg', 1830],
  ['http://localhost:3000/example5', 'out-mkt.jpg', 2040],
];

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error(`  [페이지 오류] ${e.message}`));
  await page.setViewport({ width: 1760, height: 880, deviceScaleFactor: 2 });
  for (const [url, name, scrollY] of PAGES) {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await new Promise(r => setTimeout(r, 700));
    // 좌우 여백까지 찍히면 포스터에서 회색 띠로 보인다 — 본문 폭만 잘라낸다
    const clip = await page.evaluate(() => {
      let left = Infinity, right = 0;
      document.querySelectorAll('section, article').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 240 || r.height < 80 || r.bottom < 0 || r.top > innerHeight) return;
        left = Math.min(left, r.left); right = Math.max(right, r.right);
      });
      if (!isFinite(left) || right <= left) return null;
      const pad = 14;
      const x = Math.max(0, Math.floor(left - pad));
      // clip 좌표는 뷰포트가 아니라 문서 기준이라 스크롤량을 더해 준다
      return { x, y: window.scrollY, width: Math.min(innerWidth - x, Math.ceil(right - left + pad * 2)), height: innerHeight };
    });
    await page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 92, ...(clip ? { clip } : {}) });
    console.log(`✔ ${name}`);
  }
} finally {
  await browser.close();
}
