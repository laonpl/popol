import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const backendRequire = createRequire(path.join(project, 'backend', 'package.json'));
const frontendRequire = createRequire(path.join(project, 'frontend', 'package.json'));
const puppeteer = backendRequire('puppeteer');
const JSZip = frontendRequire('jszip');
const artifacts = await mkdtemp(path.join(os.tmpdir(), 'fitpoly-connector-review-'));
const archive = await JSZip.loadAsync(await readFile(path.join(project, 'frontend', 'public', 'application-connector', 'fitpoly-application-connector.zip')));
for (const [file, entry] of Object.entries(archive.files)) {
  assert.ok(!entry.dir && !file.includes('/') && !file.includes('\\'));
  await writeFile(path.join(artifacts, file), await entry.async('nodebuffer'));
}
const config = JSON.parse(await readFile(path.join(project, 'frontend', 'public', 'application-connector', 'config.json'), 'utf8'));
const server = http.createServer((_, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end('<!doctype html><html><body>FitPoly extension connection fixture</body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({
    headless: true, pipe: true, enableExtensions: true,
    args: ['--no-sandbox', `--disable-extensions-except=${artifacts}`, `--load-extension=${artifacts}`],
    dumpio: process.env.FITPOLY_CONNECTOR_DEBUG === '1',
  });
  const extensions = await browser.extensions();
  const extension = extensions.get(config.extensionId);
  assert.ok(extension, `Expected fixed ID ${config.extensionId}`);
  const errors = [];
  const fitpoly = await browser.newPage();
  fitpoly.on('pageerror', error => errors.push(error.message));
  await fitpoly.goto(origin);
  const send = message => fitpoly.evaluate((id, payload) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(id, payload, result => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(result);
    });
  }), config.extensionId, message);
  const nonce = 'a'.repeat(64);
  const expectedOrigin = 'https://application.example';
  const start = await send({
    type: 'FITPOLY_CONNECT', nonce, expectedOrigin, company: '테스트 기업', position: '테스트 직무',
    expiresAt: Date.now() + 14 * 60 * 1000,
  });
  assert.equal(start.status, 'waiting');
  const application = await browser.newPage();
  await application.setRequestInterception(true);
  application.on('request', request => request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html>
    <html lang="ko"><body><h1>자기소개서</h1><form>
    <label>이름 <input value="private applicant name"></label>
    <label>연락처 <input value="private phone number"></label>
    <div><label for="motivation">지원동기를 작성해주세요.</label><small>최대 500자 · 공백 포함</small>
    <textarea id="motivation" maxlength="500">private answer one</textarea></div>
    <div><label for="teamwork">협업 경험을 설명해주세요.</label><small>최대 800자 · 공백 제외</small>
    <textarea id="teamwork" maxlength="800">private answer two</textarea></div>
    </form></body></html>` }));
  await application.goto(`${expectedOrigin}/apply/resume?rnId=1537&token=private`);
  await application.bringToFront();
  await application.triggerExtensionAction(extension);
  const popupTarget = await browser.waitForTarget(target => target.type() === 'page'
    && target.url() === `chrome-extension://${config.extensionId}/popup.html`);
  const popup = await popupTarget.asPage();
  popup.on('pageerror', error => errors.push(error.message));
  try {
    await popup.waitForFunction(() => !document.getElementById('read').disabled, { timeout: 5000 });
  } catch (error) {
    console.log(JSON.stringify({ popupStatus: await popup.$eval('#status', element => element.textContent),
      errors, artifacts,
      tabs: await popup.evaluate(() => chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs.map(tab => ({ id: tab.id, url: tab.url })))),
    }, null, 2));
    throw error;
  }
  await popup.click('#read');
  try {
    await popup.waitForFunction(() => document.querySelectorAll('.question').length === 2, { timeout: 5000 });
  } catch (error) {
    await popup.screenshot({ path: path.join(artifacts, 'popup-failed.png') });
    console.log(JSON.stringify({ popupStatus: await popup.$eval('#status', element => element.textContent),
      questionCount: await popup.$$eval('.question', elements => elements.length), errors, artifacts }, null, 2));
    throw error;
  }
  assert.equal(await popup.$eval('#questions', element => element.textContent.includes('private')), false);
  await popup.click('#question-1');
  await popup.screenshot({ path: path.join(artifacts, 'popup-preview.png') });
  await popup.click('#import');
  await popup.waitForFunction(() => document.getElementById('status').textContent.includes('문항을 보냈어요'));
  const result = await send({ type: 'FITPOLY_POLL', nonce });
  assert.equal(result.status, 'captured');
  assert.equal(result.capture.questions.length, 1);
  assert.equal(result.capture.questions[0].question, '지원동기를 작성해주세요.');
  assert.equal(result.capture.questions[0].maxLength, 500);
  assert.equal(result.capture.sourceUrl, `${expectedOrigin}/apply/resume?rnId=1537`);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal((await send({ type: 'FITPOLY_POLL', nonce })).status, 'expired');
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ status: 'passed', extensionId: config.extensionId,
    checks: ['real unpacked install', 'allowed external webpage messaging', 'activeTab popup capture',
      'reviewed selection', 'limits preserved', 'answers and URL tokens excluded', 'capture consumed once', 'zero page errors'],
    artifacts }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
