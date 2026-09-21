import test from 'node:test';
import assert from 'node:assert/strict';
import { pmProofMap, marketingProofMap, appendReviewedWorkProduct } from './roleProofMap.js';
import { PM_WORK_PRODUCTS } from './pmWorkProducts.js';
import { MARKETER_WORK_PRODUCTS } from './marketerWorkProducts.js';
import { buildPmEvidenceModel } from './pmEvidence.js';
import { buildMarketerEvidenceModel } from './marketerEvidence.js';
import { preserveRolePresentation } from '../../../backend/src/utils/roleMaterials.js';

test('PM map exposes actual product rules and ordered flow without rewriting them', () => {
  const flow = [{ step: '시작', system: '입력', stage: 'planned' }, { step: '저장', exception: '재로그인' }];
  const policy = { requirement: '저장 정책', rule: '로그인 사용자만 저장', acceptance: '다시 접속해 내용 확인' };
  const item = { workProducts: { serviceBlueprint: flow, requirements: [policy], alternatives: [{ option: '즉시 저장', disposition: '보류' }] }, metrics: [{ name: '완료율', actual: '', target: '60%' }] };
  const result = pmProofMap(item);
  assert.deepEqual(result.flow, flow); assert.equal(result.policy, policy);
  assert.equal(result.metrics[0].actual, ''); assert.equal(result.alternatives[0].disposition, '보류');
  assert.equal(result.validation, null);
});
test('marketing map does not turn campaign metrics into creative winners or invent a funnel', () => {
  const creative = { variant: 'A', hook: '메시지', observation: '' };
  const item = { workProducts: { creatives: [creative], channels: [{ channel: '검색', handoff: '' }] }, metrics: [{ actual: '30%', name: '전체 전환' }] };
  const result = marketingProofMap(item);
  assert.equal(result.creatives[0], creative); assert.equal(result.creatives[0].observation, '');
  assert.equal(result.channels[0].handoff, ''); assert.equal(result.crm, null); assert.equal(result.measurement, null);
});
test('legacy narratives are kept as narratives; no synthetic policy, copy or channel', () => {
  const item = { records: [{ dimension: 'discovery', claim: '문제를 발견했다' }, { dimension: 'targeting', claim: '고객을 관찰했다' }] };
  assert.equal(pmProofMap(item).problem.claim, '문제를 발견했다');
  assert.equal(pmProofMap(item).policy, null);
  assert.equal(marketingProofMap(item).audience.claim, '고객을 관찰했다');
  assert.deepEqual(marketingProofMap(item).creatives, []);
});
test('adding a PM draft preserves existing fields and never certifies an unsupported source', () => {
  const sr = { jobCategory: 'pm', keyExperiences: [{ id: '1', title: '기존', artifactBindings: [{ assetId: 'a' }], jobData: { unrelated: 'keep' } }] };
  const item = buildPmEvidenceModel(sr).cases[0];
  const next = appendReviewedWorkProduct(sr, item, 'pm', PM_WORK_PRODUCTS.find(g => g.key === 'requirements'), { requirement: '저장', rule: '로그인 시 저장', acceptance: '다시 열어 내용 확인', owner: '내가 전부 제작' }, { quote: '위조된 임의 원문을 선택한 경우', basis: 'source_excerpt' });
  const row = next.keyExperiences[0].jobData.pmWorkProducts.requirements[0];
  assert.equal(row.basis, 'unlocated'); assert.equal(row.quote, ''); assert.equal(row.stage, 'unknown');
  assert.ok(row.userEdited && row.manuallyAdded && row.manualId);
  assert.equal(sr.keyExperiences[0].jobData.pmWorkProducts, undefined);
  assert.equal(next.keyExperiences[0].jobData.unrelated, 'keep');
  assert.deepEqual(next.keyExperiences[0].artifactBindings, sr.keyExperiences[0].artifactBindings);
  assert.equal(buildPmEvidenceModel(next).cases[0].workProducts.requirements[0].owner, '');
});
test('existing excerpt selection stays traceable and source removal invalidates it', () => {
  const reference = { basis: 'source_excerpt', quote: '고객 안내 문안을 직접 작성하고 검토했다.', sourceName: '카피.txt', stage: 'executed' };
  const sr = { jobCategory: 'marketer', keyExperiences: [{ id: 'm', jobData: {} }] };
  const next = appendReviewedWorkProduct(sr, { sourceIndex: 0, evidenceRows: [reference] }, 'marketer', MARKETER_WORK_PRODUCTS.find(g => g.key === 'creatives'), { variant: '직접 정리', hook: '고객 안내', observation: '반응 기록' }, reference);
  const row = next.keyExperiences[0].jobData.marketerWorkProducts.creatives[0];
  assert.equal(row.quote, reference.quote); assert.equal(row.stage, 'unknown');
  assert.equal(buildMarketerEvidenceModel(next, { sourceText: reference.quote }).cases[0].workProducts.creatives[0].basis, 'source_excerpt');
  assert.equal(buildMarketerEvidenceModel(next, { sourceText: '' }).cases[0].workProducts.creatives[0].observation, '');
});
test('empty drafts, unrelated jobs and full groups do not mutate the analysis', () => {
  const group = MARKETER_WORK_PRODUCTS.find(g => g.key === 'crm');
  const sr = { keyExperiences: [{ jobData: { marketerWorkProducts: { crm: Array.from({ length: group.limit }, () => ({ segment: '기존' })) } } }] };
  assert.equal(appendReviewedWorkProduct(sr, { sourceIndex: 0 }, 'marketer', group, { segment: '새 항목' }), sr);
  assert.equal(appendReviewedWorkProduct(sr, { sourceIndex: 0 }, 'developer', group, { segment: '새 항목' }), sr);
  const empty = { keyExperiences: [{}] };
  assert.equal(appendReviewedWorkProduct(empty, { sourceIndex: 0 }, 'marketer', group, {}), empty);
});
test('reanalyzing preserves marketer manual work on matching cases; unmatched work is archived, not reassigned', () => {
  const manual = { manualId: 'manual1', manuallyAdded: true, message: '사용자 작성 문안', basis: 'unlocated' };
  const old = { jobCategory: 'marketer', keyExperiences: [{ id: '1', title: '원래 경험', jobData: { marketerWorkProducts: { creatives: [manual] } } }] };
  const same = preserveRolePresentation({ jobCategory: 'marketer', keyExperiences: [{ id: '1', jobData: { marketerWorkProducts: { creatives: [{ message: '새 분석' }] } } }] }, old);
  assert.equal(same.keyExperiences[0].jobData.marketerWorkProducts.creatives[0], manual);
  const repeated = preserveRolePresentation(same, same);
  assert.equal(repeated.keyExperiences[0].jobData.marketerWorkProducts.creatives.filter(row => row.manualId === 'manual1').length, 1);
  const other = preserveRolePresentation({ jobCategory: 'marketer', keyExperiences: [{ id: '2', title: '다른 경험' }] }, old);
  assert.equal(other.keyExperiences[0].jobData, undefined);
  assert.equal(other.manualWorkProductArchive[0].workProducts.creatives[0], manual);
});
