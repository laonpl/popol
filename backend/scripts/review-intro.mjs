// Visual and playback checks for /video. Screenshots are written outside the repository.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer';

const output = process.argv[2] || await mkdtemp(path.join(tmpdir(), 'fitpoly-intro-review-'));
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ['--hide-scrollbars'] });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:3000/video?capture=1', { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  const timeline = await page.evaluate(() => window.__introTimeline);
  assert.equal(await page.evaluate(() => window.__engReelDurationMs), 60000);
  assert.equal(await page.$('.iv-controls'), null);
  for (const [index, scene] of timeline.entries()) {
    await page.evaluate(time => window.__engSeek(time), scene.start + scene.duration * .65);
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.$eval('.mg-body', el => el.className), `mg-body scene-${scene.key}`);
    const broken = await page.evaluate(() => [...document.querySelectorAll('.iv-stage img')].filter(img => !img.complete || !img.naturalWidth).map(img => img.src));
    assert.deepEqual(broken, [], `${scene.key}: missing image`);
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.sp-line,.sp-tags')].filter(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth || r.left < 0 || r.bottom > innerHeight; }).map(el => el.textContent));
    assert.deepEqual(overflow, [], `${scene.key}: text outside frame`);
    await page.screenshot({ path: path.join(output, `${String(index).padStart(2, '0')}-${scene.key}.png`) });
    await page.evaluate(time => window.__engSeek(time), scene.start);
    assert.equal(await page.$eval('.mg-body', el => el.className), `mg-body scene-${scene.key}`);
  }
  // Seeking backwards must produce an identical frame, including nested icon transitions.
  for (const time of [15000, 52000]) {
    await page.evaluate(t => window.__engSeek(t), time);
    const first = await page.screenshot({ path: path.join(output, `seek-${time}-first.png`) });
    await page.evaluate(() => window.__engSeek(1000));
    await page.evaluate(t => window.__engSeek(t), time);
    const second = await page.screenshot({ path: path.join(output, `seek-${time}-second.png`) });
    assert.equal(Buffer.compare(first, second), 0, `Non-deterministic frame at ${time}`);
  }
  await page.evaluate(() => window.__engSeek(60000));
  assert.equal(await page.$eval('.mg-body', el => el.className), 'mg-body scene-outro');
  await page.goto('http://localhost:3000/video', { waitUntil: 'networkidle0' });
  await page.click('button[aria-label="일시정지"]');
  const paused = await page.$eval('input[type=range]', el => el.value);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await page.$eval('input[type=range]', el => el.value), paused);
  await page.focus('input[type=range]');
  await page.keyboard.press('End');
  assert.equal(await page.$eval('.mg-body', el => el.className), 'mg-body scene-outro');
  await page.click('button[aria-label="다시 재생"]');
  assert.equal(await page.$eval('.mg-body', el => el.className), 'mg-body scene-intro');
  await page.click('button[aria-label="일시정지"]');
  await page.click('button[aria-label="배경음악 켜기"]');
  await page.click('button[aria-label="재생"]');
  await page.waitForFunction(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime > 0; });
  await page.click('button[aria-label="일시정지"]');
  assert.equal(await page.$eval('audio', a => a.paused), true);
  assert.equal(await page.$('.iv-notice'), null, 'Pausing must not show an audio error');
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    await page.setViewport(viewport);
    const rect = await page.$eval('.iv-stage', el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
    assert.ok(rect.left >= -1 && rect.top >= -1 && rect.left + rect.width <= viewport.width + 1 && rect.top + rect.height <= viewport.height + 1, `Stage cropped: ${JSON.stringify(rect)}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, `viewport-${viewport.width}.png`) });
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.reload({ waitUntil: 'networkidle0' });
  assert.ok(await page.$('button[aria-label="재생"]'));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ success: true, scenes: timeline.length, duration: 60, output, checks: ['assets', 'text bounds', 'scene boundaries', 'deterministic seek', 'pause', 'end/replay', 'sound', 'mobile/desktop', 'reduced motion', 'runtime errors'] }, null, 2));
} finally {
  await browser.close();
}
