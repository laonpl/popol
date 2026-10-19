import test from 'node:test';
import assert from 'node:assert/strict';
import { googleSheetCsvUrl, fetchGoogleSheet } from './roleDataConnection.js';
import { preserveRolePresentation } from '../utils/roleMaterials.js';
test('only Google Sheets paths are accepted and CSV URL uses the selected worksheet', () => {
  assert.equal(googleSheetCsvUrl('https://docs.google.com/spreadsheets/d/Ab12/edit#gid=42'), 'https://docs.google.com/spreadsheets/d/Ab12/export?format=csv&gid=42');
  assert.equal(googleSheetCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-test/pubhtml?gid=2'), 'https://docs.google.com/spreadsheets/d/e/2PACX-test/pub?output=csv&gid=2');
  for (const url of ['http://127.0.0.1/', 'https://docs.google.com.evil.test/spreadsheets/d/Ab12/edit', 'https://u:p@docs.google.com/spreadsheets/d/Ab12/edit', 'https://docs.google.com/document/d/Ab12/edit']) assert.throws(() => googleSheetCsvUrl(url));
});
test('public CSV is parsed, login/html and external redirects are rejected without a second request', async () => {
  const data = await fetchGoogleSheet('https://docs.google.com/spreadsheets/d/Ab12/edit', { fetchImpl: async () => new Response('metric,value\nDAU,150') });
  assert.equal(data.rows[0].value, '150');
  let calls = 0;
  await assert.rejects(fetchGoogleSheet('https://docs.google.com/spreadsheets/d/Ab12/edit', { fetchImpl: async () => { calls++; return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } }); } }), /공개로/);
  assert.equal(calls, 1);
  await assert.rejects(fetchGoogleSheet('https://docs.google.com/spreadsheets/d/Ab12/edit', { fetchImpl: async () => new Response('<html>Login</html>') }), /읽기 권한/);
});
test('bounded downloads reject oversized responses, and timeout signal and manual redirects are provided', async () => {
  await assert.rejects(fetchGoogleSheet('https://docs.google.com/spreadsheets/d/Ab12/edit', { fetchImpl: async (url, options) => { assert.equal(options.redirect, 'manual'); assert.ok(options.signal); return new Response('x', { headers: { 'content-length': '2000001' } }); } }), /2MB/);
});
test('reanalysis preserves connected metrics and one-page edits for a matching case, archives unmatched data', () => {
  const experience = { id: 'a', title: '첫 작성', roleSummary: { headline: '완료율 개선' }, performanceData: { metrics: [{ name: '완료율', actual: '51%' }] } };
  const previous = { jobCategory: 'pm', keyExperiences: [experience] };
  const matching = preserveRolePresentation({ jobCategory: 'pm', keyExperiences: [{ id: 'a', title: '새 분석' }] }, previous);
  assert.deepEqual(matching.keyExperiences[0].performanceData, experience.performanceData); assert.deepEqual(matching.keyExperiences[0].roleSummary, experience.roleSummary);
  const unmatched = preserveRolePresentation({ jobCategory: 'pm', keyExperiences: [{ id: 'b', title: '다른 경험' }] }, previous);
  assert.equal(unmatched.keyExperiences[0].performanceData, undefined); assert.deepEqual(unmatched.roleSummaryArchive[0].performanceData, experience.performanceData);
});
