import test from 'node:test';
import assert from 'node:assert/strict';
import { groundMarketerEvidence } from './marketerEvidence.js';
import { MARKETER_WORK_PRODUCT_FIELDS } from '../prompts/marketerWorkProducts.js';
import { MARKETER_WORK_PRODUCTS } from '../../../frontend/src/utils/marketerWorkProducts.js';
import { buildMarketerEvidenceModel, buildMarketerEvidenceExportSections } from '../../../frontend/src/utils/marketerEvidence.js';
import { roleArtifacts, caseArtifacts, patchArtifactBinding, safeArtifactUrl, roleSourceText } from '../../../frontend/src/utils/roleArtifacts.js';
import { roleAnalysisContent, preserveRolePresentation } from '../utils/roleMaterials.js';
import { CAREER_FIELD_PROFILES } from '../prompts/careerFieldProfiles.js';
const report = '기준값 2%, 목표 5%, 실제 전환율 3%. 기간 7일, 대상 100명, 구매 완료 이벤트로 측정했다.';
const wrap = jd => ({ jobCategory: 'marketer', keyExperiences: [{ id: 'case-a', title: '신규 고객 캠페인', jobData: jd }] });
const grounded = jd => groundMarketerEvidence(wrap(jd), `--- report.pdf ---\n${report}`);
test('marketing and PM work product field contracts stay aligned', () => {
  for (const group of MARKETER_WORK_PRODUCTS) assert.deepEqual(group.fields.map(([key]) => key), MARKETER_WORK_PRODUCT_FIELDS[group.key]);
  assert.ok(JSON.parse(CAREER_FIELD_PROFILES.marketer.schema).marketerWorkProducts.creatives);
});
test('unrelated jobs remain unchanged; null and malformed marketing rows are ignored', () => {
  const dev = { jobCategory: 'dev' }; assert.equal(groundMarketerEvidence(dev, ''), dev);
  assert.doesNotThrow(() => groundMarketerEvidence({ jobCategory: 'marketer', keyExperiences: [null, {}, { jobData: { marketerWorkProducts: { creatives: [null, 'invalid'] } } }] }, ''));
});
test('actuals require the exact matched quote, not a number from another file or target', () => {
  const make = actual => grounded({ marketerMetrics: [{ name: '전환율', actual, target: '5%', baseline: '2%', kind: 'outcome', quote: report }] }).keyExperiences[0].jobData.marketerMetrics[0];
  assert.equal(make('3%').actual, '3%'); assert.equal(make('5%').actual, '');
  assert.equal(make('3%').target, '5%');
  const sr = groundMarketerEvidence(wrap({ marketerMetrics: [{ name: '전환율', actual: '99%', quote: report }] }), `--- report.pdf ---\n${report}\n--- other.pdf ---\n실제 전환율 99%로 관찰했다.`);
  assert.equal(sr.keyExperiences[0].jobData.marketerMetrics[0].actual, '');
});
test('partial or ambiguous quotes cannot certify execution, ownership or results', () => {
  const quote = `${report} 이 문장은 원문에 없다.`;
  const sr = grounded({ marketerEvidence: [{ dimension: 'creative', claim: '성과 주장', quote, stage: 'executed', ownership: '단독 제작' }] });
  assert.equal(sr.keyExperiences[0].jobData.marketerEvidence[0].basis, 'unlocated');
  assert.equal(sr.keyExperiences[0].jobData.marketerEvidence[0].ownership, '');
  const duplicate = groundMarketerEvidence(wrap({ marketerMetrics: [{ name: '전환율', quote: report, actual: '3%' }] }), `--- a.pdf ---\n${report}\n--- b.pdf ---\n${report}`);
  assert.equal(duplicate.keyExperiences[0].jobData.marketerMetrics[0].basis, 'unlocated');
});
test('planned creative and tests cannot become observed winners', () => {
  const quote = '헤드라인 실험을 다음 달 진행할 계획이다. 목표 전환율은 5%이며 아직 미측정 상태다.';
  const sr = groundMarketerEvidence(wrap({ marketerWorkProducts: { experiments: [{ hypothesis: '헤드라인 변경', observation: '승리', decision: '전체 적용', quote, stage: 'observed' }], creatives: [{ variant: 'A', observation: '목표 달성', quote, stage: 'observed' }] }, marketerMetrics: [{ name: '전환율', actual: '5%', target: '5%', quote }] }), quote);
  const jd = sr.keyExperiences[0].jobData;
  assert.equal(jd.marketerWorkProducts.experiments[0].stage, 'planned');
  assert.equal(jd.marketerWorkProducts.experiments[0].decision, '');
  assert.equal(jd.marketerWorkProducts.creatives[0].observation, '');
  assert.equal(jd.marketerMetrics[0].actual, '');
});
test('legacy narratives and metrics survive but do not masquerade as verified impact', () => {
  const sr = wrap({ kpis: [{ name: '발행 수', value: '20개' }] }); sr.keyExperiences[0].action = '콘텐츠를 직접 제작했다';
  const item = buildMarketerEvidenceModel(sr).cases[0];
  assert.equal(item.metrics[0].actual, ''); assert.equal(item.metrics[0].reportedValue, '20개');
  assert.match(buildMarketerEvidenceExportSections(sr)[0].content, /기존 수치\(원문 대조 전\): 20개/);
  assert.ok(item.records.some(row => row.claim === '콘텐츠를 직접 제작했다'));
});
test('stale sources invalidate marketing metric values and observations', () => {
  const sr = grounded({ marketerWorkProducts: { optimization: [{ signal: '전환 변화', observation: '3%', quote: report, stage: 'observed', ownership: '내 분석' }] }, marketerMetrics: [{ name: '전환율', actual: '3%', quote: report }] });
  const item = buildMarketerEvidenceModel(sr, { sourceText: '삭제됨' }).cases[0];
  assert.equal(item.metrics[0].actual, ''); assert.equal(item.workProducts.optimization[0].observation, ''); assert.equal(item.workProducts.optimization[0].ownership, '');
});
test('files link by unique exact source name or explicit case binding only', () => {
  let sr = grounded({ marketerMetrics: [{ name: '전환율', actual: '3%', quote: report }] });
  sr.deliverables = [{ id: 'a', name: 'report.pdf', url: '/uploads/report.pdf' }, { id: 'b', name: 'creative.png', url: '/uploads/creative.png' }, { id: 'bad', name: 'bad', url: 'javascript:alert(1)' }];
  let item = buildMarketerEvidenceModel(sr).cases[0];
  assert.equal(roleArtifacts(sr).length, 2); assert.equal(caseArtifacts(sr, item).length, 1);
  sr = patchArtifactBinding(sr, 0, 'b', { caption: '메시지 초안', contribution: '카피 작성', purpose: '메시지 선택' });
  assert.equal(caseArtifacts(sr, item).length, 2);
  assert.match(buildMarketerEvidenceExportSections(sr)[0].content, /카피 작성/);
  sr = patchArtifactBinding(sr, 0, 'b', { hidden: true }); assert.equal(caseArtifacts(sr, item).length, 1); assert.equal(sr.deliverables.length, 3);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.test']) assert.equal(safeArtifactUrl(url), '');
});
test('additional material flows to backend and frontend only while its file is retained', () => {
  const sr = { deliverables: [{ id: 'a', name: 'report.pdf', url: '/a.pdf' }], additionalMaterials: [{ assetId: 'a', name: 'report.pdf', text: report }, { assetId: 'b', name: 'removed.pdf', text: '삭제된 자료' }] };
  const content = roleAnalysisContent({ jobCategory: 'marketer', structuredResult: sr, content: { rawInput: '기존 자료' } });
  assert.match(content['추가 산출물 원문'], /report.pdf/); assert.doesNotMatch(content['추가 산출물 원문'], /삭제된/);
  assert.match(roleSourceText(sr, ''), /report.pdf/); assert.doesNotMatch(roleSourceText(sr, ''), /삭제된/);
});
test('reanalysis preserves case-linked captions by identity, never an arbitrary new index', () => {
  const previous = { jobCategory: 'pm', keyExperiences: [{ id: 'a', title: '원래', artifactBindings: [{ assetId: '1', caption: '내 설명' }] }] };
  assert.equal(preserveRolePresentation({ jobCategory: 'pm', keyExperiences: [{ id: 'a', title: '수정' }] }, previous).keyExperiences[0].artifactBindings[0].caption, '내 설명');
  const changed = preserveRolePresentation({ jobCategory: 'pm', keyExperiences: [{ id: 'b', title: '다른 경험' }] }, previous);
  assert.equal(changed.keyExperiences[0].artifactBindings, undefined); assert.equal(changed.artifactBindingArchive[0].bindings[0].caption, '내 설명');
});

test('campaign export follows the reading order and preserves every narrative and work product', () => {
  const data = grounded({
    marketerEvidence: ['conversion', 'targeting', 'creative', 'experiment', 'attribution', 'learning'].map(dimension => ({ dimension, claim: `UNIQUE_${dimension}`, quote: report, stage: 'observed' })),
    marketerWorkProducts: {
      channels: [{ channel: '검색 광고', purpose: '관심 고객 유입', quote: report, stage: 'executed' }],
      measurement: [{ event: '구매 완료', definition: '이벤트 기준', quote: report, stage: 'observed' }],
      optimization: [{ signal: '반응 차이', change: '소재 변경', quote: report, stage: 'changed' }],
    },
  });
  const output = buildMarketerEvidenceExportSections(data)[0].content;
  for (const dimension of ['conversion', 'targeting', 'creative', 'experiment', 'attribution', 'learning']) assert.equal(output.split(`UNIQUE_${dimension}`).length - 1, 1);
  const headings = ['고객과 메시지', '크리에이티브', '채널과 운영', '성과와 해석', '테스트와 개선'];
  assert.ok(headings.every(heading => output.includes(heading)));
  assert.ok(headings.every((heading, i) => i === 0 || output.indexOf(headings[i - 1]) < output.indexOf(heading)));
  assert.match(output, /채널: 검색 광고/); assert.match(output, /측정 이벤트: 구매 완료/); assert.match(output, /수정한 것: 소재 변경/);
});
