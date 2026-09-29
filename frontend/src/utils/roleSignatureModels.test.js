import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPmDecisionStages, buildMarketingStudioStages, stageEvidenceLabel } from './roleSignatureModels.js';
import { buildPmEvidenceModel } from './pmEvidence.js';
import { buildMarketerEvidenceModel } from './marketerEvidence.js';
import { appendReviewedWorkProduct } from './roleProofMap.js';
import { PM_WORK_PRODUCTS } from './pmWorkProducts.js';

test('PM decision studio uses the actual problem, alternatives, policy and validation records', () => {
  const sr = { keyExperiences: [{ title: '가입 개선', context: '가입 중 이탈이 있었다.', action: '가입 정책을 설계했다.', jobData: { pmWorkProducts: {
    alternatives: [{ option: '검색부터 개선', disposition: '기각', reason: '가입 이탈이 우선', basis: 'unlocated' }, { option: '가입 안내 개선', disposition: '채택', criterion: '고객 이탈', basis: 'unlocated' }],
    requirements: [{ requirement: '가입 안내', rule: '미완료 시 안내', acceptance: '안내 표시 확인', basis: 'unlocated' }],
    collaboration: [{ stakeholder: '개발팀', disagreement: '일정 범위', myAction: '정책 범위를 합의했다.', basis: 'unlocated' }],
  } } }] };
  const stages = buildPmDecisionStages(buildPmEvidenceModel(sr).cases[0]);
  assert.deepEqual(stages.map(row => row.key), ['discovery', 'decision', 'design', 'execution', 'validation']);
  assert.equal(stages[1].choices.length, 2);
  assert.equal(stages[1].fields.find(row => row.label === '선택한 방향').value, '가입 안내 개선');
  assert.equal(stages[2].fields.find(row => row.label === '처리 정책').value, '미완료 시 안내');
  assert.equal(stages[3].fields.find(row => row.label === '조율한 이견').value, '일정 범위');
  assert.equal(stages[4].fields.length, 0);
  assert.equal(stageEvidenceLabel(stages[2]), '원문 확인 필요');
});

test('marketing studio separates creative, distribution and measured reaction', () => {
  const sr = { keyExperiences: [{ title: '신규 고객 캠페인', action: '검색 광고를 집행했다.', jobData: { marketerWorkProducts: {
    creatives: [{ variant: 'A', hook: '첫 방문 혜택', message: '7일 무료', basis: 'unlocated' }],
    channels: [{ channel: '검색 광고', purpose: '관심 고객 유입', handoff: '랜딩 페이지', basis: 'unlocated' }],
    crm: [{ segment: '신규 고객', trigger: '가입 1일 후', timing: '오전', exit: '구매 완료', basis: 'unlocated' }],
  }, marketerMetrics: [{ name: '전환율', actual: '3%', basis: 'unlocated' }] } }] };
  const stages = buildMarketingStudioStages(buildMarketerEvidenceModel(sr).cases[0]);
  assert.deepEqual(stages.map(row => row.key), ['audience', 'creative', 'activation', 'lifecycle', 'measurement']);
  assert.equal(stages[1].choices[0].hook, '첫 방문 혜택');
  assert.equal(stages[2].choices[0].handoff, '랜딩 페이지');
  assert.equal(stages[3].fields.find(row => row.label === 'CRM 진입 조건').value, '가입 1일 후');
  assert.equal(stages[4].fields.some(row => row.value.includes('3%')), false);
});

test('PM can manually add a missing policy as an unverified draft', () => {
  const sr = { keyExperiences: [{ title: '정책 설계', jobData: {} }] };
  const item = buildPmEvidenceModel(sr).cases[0];
  const group = PM_WORK_PRODUCTS.find(row => row.key === 'requirements');
  const updated = appendReviewedWorkProduct(sr, item, 'pm', group, { requirement: '예외 상태 안내', rule: '실패 시 재시도' }, null);
  const row = updated.keyExperiences[0].jobData.pmWorkProducts.requirements[0];
  assert.equal(row.basis, 'unlocated');
  assert.equal(row.stage, 'unknown');
  assert.equal(row.manuallyAdded, true);
  assert.equal(buildPmDecisionStages(buildPmEvidenceModel(updated).cases[0])[2].fields.find(field => field.label === '처리 정책').value, '실패 시 재시도');
});

test('a fallback claim keeps its own source status when another work product is present', () => {
  const data = { keyExperiences: [{ context: '가입 이탈을 발견했다.', jobData: { pmWorkProducts: { problems: [{ signal: 'VOC', basis: 'unlocated' }] } } }] };
  const fields = buildPmDecisionStages(buildPmEvidenceModel(data).cases[0])[0].fields;
  assert.equal(fields.find(row => row.label === '정의한 문제').source.derivedLegacy, true);
  assert.equal(stageEvidenceLabel({ fields: [{ source: { basis: 'source_excerpt' } }, { source: { basis: 'unlocated' } }], choices: [] }), '일부 원문 연결');
});
