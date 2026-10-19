import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePerformanceCsv, suggestPerformanceMapping, buildPerformanceSnapshot, performanceExport, figmaEmbedUrl } from './rolePerformance.mjs';
test('CSV accepts BOM, comments, quoted commas, doubled quotes and TSV without inventing cells', () => {
  assert.equal(parsePerformanceCsv('\uFEFFname,value\n"A, B",10').rows[0].name, 'A, B');
  assert.equal(parsePerformanceCsv('# GA4 report\n채널\t클릭수\n검색\t20').rows[0]['클릭수'], '20');
  assert.throws(() => parsePerformanceCsv('a,b\nx,1,2'), /열 수/);
  assert.throws(() => parsePerformanceCsv('a,b\n"x,2'), /따옴표/);
  assert.throws(() => parsePerformanceCsv('a,a\n1,2'), /서로 다른/);
});
test('campaign imports preserve channel data and calculate weighted rates from counts', () => {
  const table = parsePerformanceCsv('date,channel,impressions,clicks,spend,conversions,revenue\n2026-10-01,검색,10000,200,100000,10,500000\n2026-10-02,소셜,5000,100,50000,5,250000\n2026-10-02,total,15000,300,150000,15,750000');
  const data = buildPerformanceSnapshot(table, suggestPerformanceMapping(table, 'marketer'), { name: '광고.csv' });
  assert.equal(data.metrics.find(row => row.name === 'ROAS').actual, '500%');
  assert.equal(data.metrics.find(row => row.name === 'CPA').actual, '10,000원');
  assert.equal(data.metrics.find(row => row.name === 'CTR').actual, '2%');
  assert.equal(data.metrics.find(row => row.name === 'CVR').actual, '5%');
  assert.equal(data.rowCount, 2); assert.equal(data.channels.length, 2);
  assert.deepEqual(data.metrics.find(row => row.name === '클릭').series.map(row => row.value), [200, 100]);
  assert.match(performanceExport(data), /광고비 ÷ 전환/);
});
test('missing denominators and partial fields never produce fabricated ROAS/CPA or zero values', () => {
  for (const csv of ['channel,clicks,spend,conversions\n소셜,10,0,0', 'channel,clicks,spend\n소셜,10,\n검색,20,200']) {
    const table = parsePerformanceCsv(csv), data = buildPerformanceSnapshot(table, suggestPerformanceMapping(table, 'marketer'));
    assert.equal(data.metrics.some(row => ['ROAS', 'CPA'].includes(row.name)), false);
  }
});
test('product metric imports retain baseline, actual, target, chronological observations and explicit aggregation', () => {
  const table = parsePerformanceCsv('날짜,지표,실측,기준,목표,단위\n2026-10-02,작성 완료율,51,38,60,%\n2026-10-01,작성 완료율,38,38,60,%');
  const mapping = suggestPerformanceMapping(table), data = buildPerformanceSnapshot(table, mapping);
  assert.equal(data.metrics[0].actual, '51%'); assert.equal(data.metrics[0].baseline, '38%'); assert.equal(data.metrics[0].target, '60%');
  assert.deepEqual(data.metrics[0].series.map(row => row.value), [38, 51]);
  const mixed = parsePerformanceCsv('metric,value,unit\na,1,%\na,3,명');
  assert.throws(() => buildPerformanceSnapshot(mixed, suggestPerformanceMapping(mixed)), /서로 다른 단위/);
});
test('snapshots keep a bounded true observation series suitable for saved experience documents', () => {
  const table = parsePerformanceCsv('date,value\n' + Array.from({ length: 100 }, (_, i) => `${String(i).padStart(3, '0')},${i}`).join('\n'));
  const data = buildPerformanceSnapshot(table, suggestPerformanceMapping(table));
  assert.equal(data.metrics[0].series.length, 60); assert.equal(data.metrics[0].series[0].value, 40); assert.equal(data.metrics[0].value, 99);
});
test('Figma connections use official embeds and discard unknown URL parameters', () => {
  assert.equal(figmaEmbedUrl('https://www.figma.com/design/AbCd12/Sketch?node-id=1-2&t=secret'), 'https://embed.figma.com/design/AbCd12/Sketch?node-id=1-2&embed-host=fitpoly');
  assert.equal(figmaEmbedUrl('https://www.figma.com/file/Ab12/Old'), 'https://embed.figma.com/design/Ab12/Old?embed-host=fitpoly');
  for (const url of ['javascript:alert(1)', 'https://figma.com.evil.test/design/Ab12', 'https://u:p@figma.com/design/Ab12', 'https://figma.com/not-a-file']) assert.equal(figmaEmbedUrl(url), '');
});
