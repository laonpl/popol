import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPmEvidenceModel, buildPmEvidenceExportSections, getPmPriorityItems } from './pmEvidence.js';
import { PM_VIEWS, PM_LENSES, PM_COMPANY_REFERENCES, pmBrief, pmViewCount } from './pmPortfolioViews.js';
import { PM_WORK_PRODUCTS } from './pmWorkProducts.js';
import { PM_WORK_PRODUCT_FIELDS } from '../../../backend/src/prompts/pmWorkProducts.js';
import { mergeCaseStudyIntoStructured } from './caseStudySync.js';

const quote = '개발 일정 때문에 검색은 MVP에서 제외하고 작성 흐름만 먼저 구현하기로 결정했다.';
const sr = { jobCategory: 'pm', pmEvidenceVersion: 1, keyExperiences: [{ title: 'MVP 범위 결정', jobData: {
  pmEvidenceVersion: 1, pmEvidence: [{ dimension: 'prioritization', claim: '검색을 제외하고 작성 흐름을 선택했다.', quote, sourceName: '회의록.pdf', basis: 'source_excerpt', stage: 'executed', ownership: '범위 합의' }],
  pmMetrics: [{ name: '완료율', target: '60%', actual: '', baseline: '', quote, sourceName: '회의록.pdf', basis: 'source_excerpt', period: '1주' }],
} }] };
test('coverage measures linked material, not made-up competency scores', () => {
  const model = buildPmEvidenceModel(sr, { sourceText: quote });
  assert.equal(model.documented, 1);
  assert.equal(model.dimensions.length, 6);
  assert.equal(model.dimensions.filter(d => !d.missing).length, 2);
  assert.equal(model.dimensions.find(d => d.key === 'outcome').missing, true);
  assert.equal(model.legacy, false);
});
test('changed source invalidates stages, ownership and all metric fields', () => {
  const model = buildPmEvidenceModel(sr, { sourceText: '수정된 원문' });
  assert.equal(model.cases[0].records[0].stage, 'unknown');
  assert.equal(model.cases[0].records[0].ownership, '');
  assert.equal(model.metrics[0].target, '');
  assert.equal(model.metrics[0].period, '');
});
test('exports keep quote and goal separate from observed results', () => {
  const output = buildPmEvidenceExportSections(sr)[0].content;
  assert.match(output, /회의록.pdf/);
  assert.match(output, /목표: 60% \/ 관찰값: 미측정·미기록/);
  assert.match(output, /원문 발췌/);
});
test('legacy data remains identifiable without manufacturing evidence', () => {
  const legacy = { keyExperiences: [{ title: '기존 경험', jobData: { impact: 4, effort: 2 } }] };
  assert.equal(buildPmEvidenceModel(legacy).legacy, true);
  assert.deepEqual(buildPmEvidenceExportSections(legacy), []);
  assert.deepEqual(getPmPriorityItems(legacy.keyExperiences), []);
});
test('stale or edited scores do not silently regain matrix coordinates', () => {
  const ke = { jobData: { pmEvidenceVersion: 1, impact: 4, effort: 2, priorityQuote: '영향도 4점, 공수 2점으로 팀이 평가했다.' } };
  assert.equal(getPmPriorityItems([ke]).length, 1);
  assert.equal(getPmPriorityItems([ke], { sourceText: '삭제된 원문' }).length, 0);
  assert.equal(getPmPriorityItems([{ jobData: { ...ke.jobData, impact: 5 } }]).length, 0);
});
test('case-study editing preserves grounded PM fields', () => {
  const merged = mergeCaseStudyIntoStructured(sr, { keyExps: [{ title: '수정한 제목' }] });
  assert.deepEqual(merged.keyExperiences[0].jobData, sr.keyExperiences[0].jobData);
  assert.equal(merged.pmEvidenceVersion, 1);
});
test('malformed rows are ignored', () => {
  assert.equal(buildPmEvidenceModel({ keyExperiences: [null, { jobData: { pmEvidence: [null] } }] }).documented, 0);
  const model = buildPmEvidenceModel({ keyExperiences: [null, { jobData: { pmEvidence: [null, sr.keyExperiences[0].jobData.pmEvidence[0]] } }] });
  assert.equal(model.cases[0].sourceIndex, 1);
  assert.equal(model.cases[0].records[0].sourceRecordIndex, 1);
});
test('legacy narratives use the new decision layout without gaining evidence status', () => {
  const legacy = { keyExperiences: [{ title: '기존 기획', context: '가입 단계를 찾기 어렵다는 의견을 받았다.', action: '가입 안내 문구를 작성했다.', jobData: { decision: '검색보다 가입 안내를 먼저 제공했다.' } }] };
  const model = buildPmEvidenceModel(legacy);
  assert.equal(model.cases[0].records.length, 3);
  assert.equal(model.documented, 0);
  assert.ok(model.cases[0].records.every(row => row.basis === 'unlocated' && row.derivedLegacy));
  assert.match(buildPmEvidenceExportSections(legacy)[0].content, /근거 확인 필요/);
});

test('typed artifacts reach the model and export without requiring old narrative records', () => {
  const data = { keyExperiences: [{ title: '정책 설계', jobData: { pmWorkProductsVersion: 1, pmWorkProducts: { requirements: [{ requirement: '임시 저장', rule: '로그인 상태에서만 허용', acceptance: '새로고침 후 복구', quote, sourceName: '정책.pdf', basis: 'source_excerpt', stage: 'executed' }] } } }] };
  const model = buildPmEvidenceModel(data, { sourceText: quote });
  assert.equal(model.cases[0].hasWorkProducts, true);
  assert.equal(model.documented, 1);
  assert.equal(model.dimensions.find(d => d.key === 'delivery').missing, false);
  assert.equal(model.cases[0].workProductsVersion, 1);
  assert.match(buildPmEvidenceExportSections(data)[0].content, /인수 기준: 새로고침 후 복구/);
  assert.match(buildPmEvidenceExportSections(data)[0].content, /정책.pdf/);
});
test('artifact source removal clears actual observation and personal ownership', () => {
  const row = { quote, basis: 'source_excerpt', stage: 'observed' };
  const data = { keyExperiences: [{ jobData: { pmWorkProducts: { experiments: [{ ...row, hypothesis: '개선', observation: '성공', decision: '유지' }], requirements: [{ ...row, requirement: '정책', owner: '총괄' }] } } }] };
  const products = buildPmEvidenceModel(data, { sourceText: '원문 삭제' }).cases[0].workProducts;
  assert.equal(products.experiments[0].observation, '');
  assert.equal(products.experiments[0].decision, '');
  assert.equal(products.requirements[0].owner, '');
  assert.equal(products.requirements[0].basis, 'unlocated');
});

test('reading lenses reorder the same complete set without inventing evidence', () => {
  for (const lens of PM_LENSES) assert.deepEqual([...lens.order].sort(), PM_VIEWS.map(view => view.key).sort());
  assert.equal(new Set(PM_COMPANY_REFERENCES.map(row => row[0])).size, 6);
  const item = buildPmEvidenceModel({ keyExperiences: [{ title: '기존 경험', action: '기획서 작성', context: '기존 관찰' }] }).cases[0];
  assert.equal(pmBrief(item)[0][1], '기존 관찰');
  assert.equal(pmBrief(item)[2][1], '');
  assert.ok(PM_VIEWS.every(view => pmViewCount(item, view) === 0));
});
test('all v2 product fields agree between extraction, display and exports', () => {
  for (const group of PM_WORK_PRODUCTS) assert.deepEqual(group.fields.map(([key]) => key), PM_WORK_PRODUCT_FIELDS[group.key]);
  const data = { keyExperiences: [{ jobData: { pmWorkProductsVersion: 2, pmWorkProducts: {
    serviceBlueprint: [{ step: '저장', backstage: '운영자 문의 처리', quote, basis: 'source_excerpt', stage: 'executed' }],
    metricLinks: [{ driver: '작성 시작', outcome: '작성 완료', relationship: '가설', guardrail: '저장 실패율', quote, basis: 'source_excerpt', stage: 'planned' }],
    releases: [{ milestone: 'MVP', dependency: '정책 합의', gate: '복구 테스트', quote, basis: 'source_excerpt', stage: 'planned' }],
  } } }] };
  const result = buildPmEvidenceExportSections(data)[0].content;
  assert.match(result, /운영 · 파트너: 운영자 문의 처리/);
  assert.match(result, /보호 지표: 저장 실패율/);
  assert.match(result, /선행 의존성: 정책 합의/);
});
