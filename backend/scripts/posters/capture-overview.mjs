/**
 * overview.html 의 가로형 개요 아트보드를 각각 PNG 로 뽑는다.
 *
 * 실행: backend 에서  node scripts/posters/capture-overview.mjs
 * 옵션: --scale=2  (기본 2배 → 3200x1800)   --out=<디렉터리>
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};

const SCALE = Number(arg('scale', 2));
const OUT = path.resolve(arg('out', path.join(HERE, 'out')));

const BOARDS = [
  ['o1', '10-서비스-한눈에'],
  ['o2', '11-실제-화면-흐름'],
];

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: [
    '--hide-scrollbars',
    '--font-render-hinting=none',
    '--disable-lcd-text',
    '--allow-file-access-from-files',
  ],
});

try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error(`  [페이지 오류] ${e.message}`));
  page.on('requestfailed', r => console.error(`  [불러오기 실패] ${r.url()}`));
  await page.setViewport({ width: 1700, height: 1000, deviceScaleFactor: SCALE });
  await page.goto(pathToFileURL(path.join(HERE, 'overview.html')).href, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  // 웹폰트가 올라오기 전에 찍으면 글자 폭이 달라진다
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));

  for (const [id, name] of BOARDS) {
    const el = await page.$(`#${id}`);
    if (!el) throw new Error(`#${id} 를 찾지 못했습니다`);
    const file = path.join(OUT, `${name}.png`);
    await el.screenshot({ path: file });
    console.log(`✔ ${name}.png  (${1600 * SCALE}x${900 * SCALE})`);
  }
  console.log(`\n→ ${OUT}`);
} finally {
  await browser.close();
}
