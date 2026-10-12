import test from 'node:test';
import assert from 'node:assert/strict';
import { pmProofMap, marketingProofMap, appendReviewedWorkProduct, updateReviewedWorkProduct } from './roleProofMap.js';
import { PM_WORK_PRODUCTS } from './pmWorkProducts.js';
import { MARKETER_WORK_PRODUCTS } from './marketerWorkProducts.js';
import { buildPmEvidenceModel } from './pmEvidence.js';
import { buildMarketerEvidenceModel } from './marketerEvidence.js';
import { preserveRolePresentation } from '../../../backend/src/utils/roleMaterials.js';
import { roleSourceText } from './roleArtifacts.js';
import { validRoleSelfReport } from '../../../shared/roleSelfReport.mjs';

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
  assert.equal(row.basis, 'self_report'); assert.match(row.quote, /직접 책임진 범위: 내가 전부 제작/); assert.equal(row.stage, 'unknown');
  assert.equal(row.referenceQuote, undefined);
  assert.ok(row.userEdited && row.manuallyAdded && row.manualId);
  assert.equal(sr.keyExperiences[0].jobData.pmWorkProducts, undefined);
  assert.equal(next.keyExperiences[0].jobData.unrelated, 'keep');
  assert.deepEqual(next.keyExperiences[0].artifactBindings, sr.keyExperiences[0].artifactBindings);
  assert.equal(buildPmEvidenceModel(next, { sourceText: '' }).cases[0].workProducts.requirements[0].owner, '내가 전부 제작');
});
test('existing excerpt selection remains a reference; the new work is an explicit self report', () => {
  const reference = { basis: 'source_excerpt', quote: '고객 안내 문안을 직접 작성하고 검토했다.', sourceName: '카피.txt', stage: 'executed' };
  const sr = { jobCategory: 'marketer', keyExperiences: [{ id: 'm', jobData: {} }] };
  const next = appendReviewedWorkProduct(sr, { sourceIndex: 0, evidenceRows: [reference] }, 'marketer', MARKETER_WORK_PRODUCTS.find(g => g.key === 'creatives'), { variant: '직접 정리', hook: '고객 안내', observation: '반응 기록' }, reference);
  const row = next.keyExperiences[0].jobData.marketerWorkProducts.creatives[0];
  assert.equal(row.referenceQuote, reference.quote); assert.equal(row.stage, 'unknown');
  assert.notEqual(row.quote, reference.quote);
  assert.equal(row.referenceSourceName, '카피.txt');
  assert.equal(buildMarketerEvidenceModel(next, { sourceText: reference.quote }).cases[0].workProducts.creatives[0].basis, 'self_report');
  assert.equal(buildMarketerEvidenceModel(next, { sourceText: '' }).cases[0].workProducts.creatives[0].observation, '반응 기록');
  assert.match(roleSourceText(next, ''), /실제 반응: 반응 기록/);
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

test('PM observations survive save and reload as self reports with a chosen stage', () => {
  const sr = { jobCategory: 'pm', keyExperiences: [{ id: '1', jobData: {} }] };
  const group = PM_WORK_PRODUCTS.find(g => g.key === 'experiments');
  const added = appendReviewedWorkProduct(sr, buildPmEvidenceModel(sr).cases[0], 'pm', group, { hypothesis: '안내 문구를 바꾸면 혼란이 줄 것이다.', observation: '인터뷰에서 고객이 안내를 이해했다고 답했다.', decision: '변경한 문구를 유지했다.', stage: 'observed' });
  const restored = JSON.parse(JSON.stringify(added));
  const row = buildPmEvidenceModel(restored, { sourceText: '기존 프로젝트 자료' }).cases[0].workProducts.experiments[0];
  assert.equal(row.basis, 'self_report');
  assert.equal(row.stage, 'observed');
  assert.equal(row.observation, '인터뷰에서 고객이 안내를 이해했다고 답했다.');
  assert.equal(row.decision, '변경한 문구를 유지했다.');
  assert.equal(validRoleSelfReport(row), true);
});

test('editing manual work refreshes its statement while imported excerpts remain immutable', () => {
  const group = MARKETER_WORK_PRODUCTS.find(g => g.key === 'optimization');
  const sr = { jobCategory: 'marketer', keyExperiences: [{ id: '1', jobData: {} }] };
  const added = appendReviewedWorkProduct(sr, buildMarketerEvidenceModel(sr).cases[0], 'marketer', group, { signal: '링크 안내를 찾기 어려웠다.', change: '버튼 위치 변경', observation: '추가 문의가 줄었다.', stage: 'observed' });
  const oldRow = added.keyExperiences[0].jobData.marketerWorkProducts.optimization[0];
  const edited = updateReviewedWorkProduct(added, buildMarketerEvidenceModel(added).cases[0], 'marketer', group, 0, { ...oldRow, observation: '대상 고객의 버튼 클릭을 관찰했다.', stage: 'changed' });
  const row = buildMarketerEvidenceModel(edited, { sourceText: '' }).cases[0].workProducts.optimization[0];
  assert.equal(validRoleSelfReport(row), true);
  assert.equal(row.manualId, oldRow.manualId);
  assert.equal(row.stage, 'changed');
  assert.match(row.quote, /대상 고객의 버튼 클릭을 관찰했다/);
  assert.doesNotMatch(roleSourceText(edited, ''), /추가 문의가 줄었다/);
  assert.match(oldRow.quote, /추가 문의가 줄었다/);

  const imported = { jobCategory: 'marketer', keyExperiences: [{ jobData: { marketerWorkProducts: { optimization: [{ signal: '고객 의견을 확인했다.', quote: '고객 의견을 확인하고 링크 안내를 개선했다.', sourceName: '회의록.txt', basis: 'source_excerpt', stage: 'executed' }] } } }] };
  const original = imported.keyExperiences[0].jobData.marketerWorkProducts.optimization[0];
  const revised = updateReviewedWorkProduct(imported, { sourceIndex: 0 }, 'marketer', group, 0, { signal: '요약을 보완했다.', stage: 'observed' });
  const preserved = revised.keyExperiences[0].jobData.marketerWorkProducts.optimization[0];
  assert.equal(preserved.quote, original.quote);
  assert.equal(preserved.sourceName, original.sourceName);
  assert.equal(preserved.stage, 'executed');
  assert.equal(preserved.selfReportVersion, undefined);
});

test('a stale manual snapshot cannot certify altered observations or leak into new source text', () => {
  const group = MARKETER_WORK_PRODUCTS.find(g => g.key === 'creatives');
  const sr = { keyExperiences: [{ jobData: {} }] };
  const added = appendReviewedWorkProduct(sr, { sourceIndex: 0 }, 'marketer', group, { variant: '실제 소재', observation: '실제 반응을 기록했다.' });
  added.keyExperiences[0].jobData.marketerWorkProducts.creatives[0].observation = '수정된 값을 기존 원문으로 인증하려 함';
  const row = buildMarketerEvidenceModel(added).cases[0].workProducts.creatives[0];
  assert.equal(row.basis, 'unlocated');
  assert.equal(row.observation, '');
  assert.equal(roleSourceText(added, ''), '');
});

test('choosing the plan stage does not erase a users own preliminary observation or responsibility', () => {
  const sr = { jobCategory: 'pm', keyExperiences: [{ jobData: {} }] };
  const next = appendReviewedWorkProduct(sr, { sourceIndex: 0 }, 'pm', PM_WORK_PRODUCTS.find(g => g.key === 'experiments'), { hypothesis: '문구 개선 계획', observation: '사전 인터뷰에서 안내가 어렵다는 응답을 들었다.', stage: 'planned' });
  const row = buildPmEvidenceModel(next, { sourceText: '' }).cases[0].workProducts.experiments[0];
  assert.equal(row.stage, 'planned');
  assert.equal(row.observation, '사전 인터뷰에서 안내가 어렵다는 응답을 들었다.');
  assert.equal(validRoleSelfReport(row), true);

  const campaign = appendReviewedWorkProduct({ keyExperiences: [{}] }, { sourceIndex: 0 }, 'marketer', MARKETER_WORK_PRODUCTS.find(g => g.key === 'operations'), { deliverable: '캠페인 집행 계획', myAction: '초안 작성과 외주 일정을 조율했다.', stage: 'planned' });
  const work = buildMarketerEvidenceModel(campaign, { sourceText: '' }).cases[0].workProducts.operations[0];
  assert.equal(work.myAction, '초안 작성과 외주 일정을 조율했다.');
  assert.equal(work.stage, 'planned');
});
