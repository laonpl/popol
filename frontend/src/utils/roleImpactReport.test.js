import test from 'node:test';
import assert from 'node:assert/strict';
import { splitProductDecisions, productServiceLayers, metricComparison, campaignMetricStages, marketingChannelLedger, roleReportCounts } from './roleImpactReport.js';

test('MVP board separates adopted, rejected, deferred and undecided work', () => {
  const rows = [{ option: '가입 안내', disposition: '채택' }, { option: '검색', disposition: '기각' }, { option: '추천', disposition: '보류' }, { option: '통계', disposition: '' }];
  const result = splitProductDecisions(rows);
  assert.deepEqual(result.selected.map(row => row.option), ['가입 안내']);
  assert.deepEqual(result.excluded.map(row => row.option), ['검색', '추천']);
  assert.deepEqual(result.undecided.map(row => row.option), ['통계']);
  assert.equal(result.selected[0], rows[0]);
});

test('service report uses actual blueprint layers, otherwise keeps recorded before/after journey', () => {
  const step = { step: '작성', after: '예시 제공' };
  assert.deepEqual(productServiceLayers({ journey: [step] }).steps, [step]);
  assert.equal(productServiceLayers({ journey: [step] }).kind, 'journey');
  const blueprint = { step: '저장', customerAction: '입력', system: '임시 저장', exception: '재로그인' };
  const full = productServiceLayers({ journey: [step], serviceBlueprint: [blueprint] });
  assert.equal(full.kind, 'blueprint');
  assert.deepEqual(full.steps, [blueprint]);
  assert.equal(full.layers.some(([key]) => key === 'exception'), true);
  assert.deepEqual(productServiceLayers({}).steps, []);
});

test('comparison bars retain real values and compare only like recorded units', () => {
  const percent = metricComparison({ name: '전환율', basis: 'self_report', baseline: '2%', actual: '3%', target: '5%' });
  assert.deepEqual(percent.points.map(point => [point.label, point.value, point.width]), [['기준', 2, 40], ['관찰', 3, 60], ['목표', 5, 100]]);
  assert.equal(metricComparison({ actual: '1,500원', baseline: '1,200원', basis: 'source_excerpt' }).points[1].value, 1500);
  assert.equal(metricComparison({ actual: '3%', baseline: '200명', basis: 'self_report' }), null);
  assert.equal(metricComparison({ actual: '3%', target: '5~10%', basis: 'self_report' }), null);
  assert.equal(metricComparison({ target: '5%', basis: 'self_report' }), null);
  assert.equal(metricComparison({ actual: '3%', basis: 'unlocated' }), null);
  assert.equal(metricComparison({ actual: '3%', basis: 'derived' }), null);
});

test('funnel includes recorded actual stages, omits output/plan/stale values without interpolating missing stages', () => {
  const rows = [
    { name: '노출', stage: 'reach', actual: '1000회', basis: 'source_excerpt', kind: 'outcome' },
    { name: '게시물', stage: 'reach', actual: '10개', basis: 'self_report', kind: 'output' },
    { name: '구매', stage: 'conversion', target: '30건', actual: '', basis: 'self_report', kind: 'outcome' },
    { name: '클릭', stage: 'click', actual: '20회', basis: 'unlocated', kind: 'outcome' },
  ];
  assert.deepEqual(campaignMetricStages(rows).map(stage => [stage.key, stage.metrics.map(row => row.name)]), [['reach', ['노출']]]);
});

test('channel ledger never attributes a campaign total or similarly named channel to a creative', () => {
  const item = { workProducts: { channels: [{ channel: '인스타그램' }, { channel: '이메일' }] }, metrics: [
    { name: '전체 전환', actual: '3%', channel: '' }, { name: '클릭', actual: '20회', channel: '인스타그램' }, { name: '광고', actual: '10회', channel: '인스타그램 광고' },
  ] };
  const rows = marketingChannelLedger(item);
  assert.deepEqual(rows[0].metrics.map(row => row.name), ['클릭']);
  assert.deepEqual(rows[1].metrics, []);
  assert.equal(item.workProducts.channels[0].metrics, undefined);
});

test('report counters count saved work and distinct channels instead of competency or impact scores', () => {
  assert.deepEqual(roleReportCounts({ workProducts: {} }, 'pm').map(row => row.value), [0, 0, 0, 0]);
  assert.deepEqual(roleReportCounts({ workProducts: { creatives: [{}], channels: [{ channel: '검색' }, { channel: '검색' }], experiments: [{}] }, metrics: [{ actual: '3%', basis: 'self_report' }, { actual: '99%', basis: 'unlocated' }] }, 'marketer').map(row => row.value), [1, 1, 1, 1]);
});
