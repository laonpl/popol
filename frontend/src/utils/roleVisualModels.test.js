import test from 'node:test';
import assert from 'node:assert/strict';
import { productDecisionGraph, campaignRouteGraph, funnelVolumes, metricPercent } from './roleVisualModels.js';

test('product graph traces recorded customer signals, a problem, adopted and rejected choices', () => {
  const problem = { problem: '첫 주문 경로를 찾지 못함', user: '신규 고객' };
  const adopted = { option: '첫 화면 안내', disposition: '채택', criterion: '사용자 진입 장벽' };
  const rejected = { option: '추천 기능', disposition: '보류', reason: 'MVP 범위를 줄임' };
  const input = { workProducts: { problems: [problem], research: [{ observation: '메뉴를 반복 탐색', segment: '첫 방문' }], alternatives: [rejected, adopted] } };
  const before = JSON.stringify(input), graph = productDecisionGraph(input);
  assert.equal(graph.nodes.find(node => node.kind === 'selected').source, adopted);
  assert.equal(graph.nodes.find(node => node.kind === 'excluded').source, rejected);
  assert.equal(graph.nodes.find(node => node.kind === 'problem').source, problem);
  assert.equal(graph.edges.length, 3);
  assert.equal(graph.edges.find(edge => graph.nodes.find(node => node.id === edge.to)?.kind === 'excluded').dashed, true);
  assert.equal(JSON.stringify(input), before);
  assert.ok(graph.nodes.every(node => node.x + 224 <= graph.width && node.y + 97 <= graph.height));
});

test('legacy product narratives are retained without manufacturing adopted choices', () => {
  const graph = productDecisionGraph({ records: [{ dimension: 'discovery', claim: '고객 문의를 확인했다.' }, { dimension: 'prioritization', claim: '대안을 검토했다.' }] });
  assert.equal(graph.nodes.some(node => node.kind === 'selected'), false);
  assert.match(graph.nodes.find(node => node.kind === 'pending').title, /대안을 검토/);
  assert.deepEqual(productDecisionGraph({}).nodes, []);
});

test('campaign routes use each actual channel audience and handoff, with no inferred conversion', () => {
  const source = { channel: '이메일', audience: '첫 가입 고객', handoff: '사용 가이드', purpose: '제품 이해' };
  const graph = campaignRouteGraph({ workProducts: { channels: [source, { channel: '블로그' }] }, metrics: [{ actual: '30%', name: '전체 캠페인 구매율' }] });
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.nodes.find(node => node.kind === 'handoff').title, '사용 가이드');
  assert.equal(graph.nodes.find(node => node.kind === 'handoff').source, source);
  assert.equal(graph.nodes.some(node => node.title.includes('30%')), false);
  assert.equal(graph.nodes.filter(node => node.kind === 'channel').length, 2);
});

test('old campaign text can be read as nodes but does not invent channel edges', () => {
  const graph = campaignRouteGraph({ records: [{ dimension: 'targeting', claim: '신규 고객을 대상으로 했다.' }, { dimension: 'activation', claim: '실제 사용 콘텐츠를 제작했다.' }] });
  assert.equal(graph.nodes.length, 2);
  assert.deepEqual(graph.edges, []);
  assert.deepEqual(campaignRouteGraph({}).nodes, []);
});

test('proportional funnel geometry requires equal unit, population, period and channel', () => {
  const base = { kind: 'outcome', period: '7일', population: '같은 신규 고객 집단', channel: '웹' };
  const stages = [1000, 100, 20].map(value => ({ metrics: [{ ...base, actual: `${value}명` }] }));
  assert.deepEqual(funnelVolumes(stages), [1000, 100, 20]);
  assert.equal(funnelVolumes([stages[0], { metrics: [{ ...base, actual: '3%' }] }]), null);
  assert.equal(funnelVolumes([stages[0], { metrics: [{ ...base, actual: '100명', period: '30일' }] }]), null);
  assert.equal(funnelVolumes([stages[0], { metrics: [{ ...base, actual: '100명', population: '' }] }]), null);
  assert.equal(funnelVolumes([stages[0], { metrics: [{ ...base, actual: '100명', channel: '앱' }] }]), null);
  assert.equal(funnelVolumes([stages[0], { metrics: [{ ...base, actual: '1100명' }] }]), null);
  assert.equal(funnelVolumes([stages[0]]), null);
});

test('percentage rings use only valid recorded rates', () => {
  assert.equal(metricPercent({ basis: 'self_report', actual: '3.5%' }), 3.5);
  assert.equal(metricPercent({ basis: 'source_excerpt', actual: '100%' }), 100);
  for (const actual of ['101%', '-3%', '50명', '목표 30%', '20~30%']) assert.equal(metricPercent({ basis: 'self_report', actual }), null);
  assert.equal(metricPercent({ basis: 'unlocated', actual: '30%' }), null);
  assert.equal(metricPercent({ basis: 'derived', actual: '30%' }), null);
});
