/**
 * posters.html 의 아트보드 4장을 각각 PNG 로 뽑는다.
 *
 * 실행: backend 에서  node scripts/posters/capture.mjs
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

// 파일명 = 글에서 이 이미지가 들어갈 자리
const POSTERS = [
  ['p1', '01-흩어진-경험-문제'],
  ['p2', '02-입장-차이'],
  ['p3', '03-트랙션-퍼널'],
  ['p4', '04-직군별-차별화'],
  ['p5', '05-문제-한눈에'],
  ['p6', '06-포지션맵'],
  ['p7', '07-시장-규모'],
  ['p8', '08-확장-로드맵'],
  ['p9', '09-주요-산출물'],
];

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
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
  await page.setViewport({ width: 1700, height: 1000, deviceScaleFactor: SCALE });
  await page.goto(pathToFileURL(path.join(HERE, 'posters.html')).href, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  // 웹폰트가 올라오기 전에 찍으면 글자 폭이 달라진다
  await page.evaluate(() => document.fonts.ready);

  for (const [id, name] of POSTERS) {
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
