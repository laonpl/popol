import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPmSources, groundPmEvidence } from './pmEvidence.js';
import { buildDraftAnalysisPrompt, buildSingleKeyExperiencePrompt } from '../prompts/experiencePrompts.js';

const quote = '온보딩 보고서: 기준값 38%, 목표 60%, 실제 전환율 51%. 측정 기간 7일, 신규 사용자 100명.';
const content = { rawInput: `--- report.pdf ---\n${quote}` };
const analysis = (jobData = {}) => ({ jobCategory: 'pm', keyExperiences: [{ title: '가입 단계 축소', jobData }] });
const run = (jd, raw = content) => groundPmEvidence(analysis(jd), raw).keyExperiences[0].jobData;
const record = (overrides = {}) => ({ dimension: 'outcome', claim: '가입 과정의 전환을 관찰했다.', quote, source: 'report.pdf', stage: 'observed', ...overrides });
const metric = (overrides = {}) => ({ name: '전환율', baseline: '38%', target: '60%', actual: '51%', period: '7일', population: '100명', quote, source: 'report.pdf', ...overrides });

test('non-PM analysis is unchanged, including developer data', () => {
  const dev = { jobCategory: 'dev', githubStats: { commits: 4 }, keyExperiences: [{ jobData: { impact: 4 } }] };
  assert.equal(groundPmEvidence(dev, content), dev);
});
test('matches a real excerpt and records source, stage and line', () => {
  const jd = run({ pmEvidence: [record()] });
  assert.equal(jd.pmEvidence[0].basis, 'source_excerpt');
  assert.equal(jd.pmEvidence[0].sourceName, 'report.pdf');
  assert.equal(jd.pmEvidence[0].stage, 'observed');
  assert.match(jd.pmEvidence[0].location, /1행/);
  assert.equal(jd.pmEvidenceVersion, 1);
});
test('separates baseline, target and observation with measurement conditions', () => {
  const value = run({ pmMetrics: [metric()] }).pmMetrics[0];
  assert.deepEqual([value.baseline, value.target, value.actual, value.period, value.population], ['38%', '60%', '51%', '7일', '100명']);
});
test('does not reinterpret the goal in an observed report as an actual', () => {
  assert.equal(run({ pmMetrics: [metric({ actual: '60%' })] }).pmMetrics[0].actual, '');
});
test('a planned observation remains a plan and has no actual value', () => {
  const plan = '온보딩 전환율 목표 60%를 다음 달에 관찰할 예정이며 실험을 계획했다.';
  const jd = run({ pmEvidence: [record({ quote: plan })], pmMetrics: [metric({ quote: plan, actual: '60%' })] }, { 자료: `--- prd.pdf ---\n${plan}` });
  assert.equal(jd.pmEvidence[0].stage, 'planned');
  assert.equal(jd.pmMetrics[0].actual, '');
  assert.equal(jd.pmMetrics[0].target, '60%');
});
test('a number cannot be a substring of another number', () => {
  for (const number of ['100', '0.10', '10,000', '10.5', '-10', '−10']) {
    const q = `실제 전환율 측정값: ${number}이며 보고서에 기록했다.`;
    assert.equal(run({ pmMetrics: [metric({ quote: q, actual: '10' })] }, q).pmMetrics[0].actual, '');
  }
});
test('fabricated and short quotes cannot certify metrics or execution', () => {
  for (const q of ['전환율', '자료에는 없지만 전환율을 크게 올렸다는 가짜 인용문입니다.']) {
    const jd = run({ pmEvidence: [record({ quote: q, basis: 'source_excerpt' })], pmMetrics: [metric({ quote: q })] });
    assert.equal(jd.pmEvidence[0].basis, 'unlocated');
    assert.equal(jd.pmEvidence[0].stage, 'unknown');
    assert.equal(jd.pmMetrics[0].actual, '');
  }
});
test('direct answers are self reports; research interview files remain documents', () => {
  assert.equal(run({ pmEvidence: [record()] }, `--- 직접 입력 ---\n${quote}`).pmEvidence[0].basis, 'self_report');
  assert.equal(run({ pmEvidence: [record()] }, `--- 사용자 인터뷰.pdf ---\n${quote}`).pmEvidence[0].basis, 'source_excerpt');
});
test('AI questions and extracted drafts cannot become applicant evidence', () => {
  const raw = `=== AI 추출 핵심 경험 ===\n${quote}\n=== AI 채팅 보완 ===\nQ. ${quote}\n→ 제가 문구를 정했습니다. 팀이 구현했습니다.`;
  assert.equal(run({ pmEvidence: [record()] }, raw).pmEvidence[0].basis, 'unlocated');
  assert.equal(collectPmSources(raw)[0].kind, 'self_report');
});
test('unread links do not substantiate claims', () => {
  const q = '페이지 내용을 직접 읽지 못했습니다. 이 링크는 사용자의 산출물입니다.';
  assert.equal(run({ pmEvidence: [record({ quote: q })] }, `--- 산출물 링크 ---\n${q}`).pmEvidence[0].basis, 'unlocated');
});
test('ambiguous duplicates require an exact source name', () => {
  const raw = `--- a.pdf ---\n${quote}\n--- b.pdf ---\n${quote}`;
  assert.equal(run({ pmEvidence: [record()] }, raw).pmEvidence[0].basis, 'unlocated');
  assert.equal(run({ pmEvidence: [record({ source: 'b.pdf' })] }, raw).pmEvidence[0].sourceName, 'b.pdf');
});
test('priority scores must be explicit, not estimated', () => {
  assert.equal(run({ impact: 4, effort: 2 }).impact, '');
  const priorityQuote = '가입 단계 변경의 영향도 4점, 공수 2점으로 팀이 평가했다.';
  const jd = run({ impact: 4, effort: 2, priorityQuote }, priorityQuote);
  assert.equal(jd.impact, 4);
  assert.equal(jd.effort, 2);
  assert.equal(run({ impact: 5, effort: 2, priorityQuote }, priorityQuote).impact, '');
});
test('invalid shapes and unknown dimensions cannot break extraction', () => {
  const result = groundPmEvidence({ jobCategory: 'pm', keyExperiences: [null, { jobData: { pmEvidence: [null, { dimension: 'fake', claim: 'x' }], pmMetrics: 'bad' } }] }, null);
  assert.equal(result.keyExperiences.length, 1);
  assert.deepEqual(result.keyExperiences[0].jobData.pmEvidence, []);
});
test('both draft and full key-experience prompts carry the PM evidence contract', () => {
  const prompts = [buildDraftAnalysisPrompt(quote, 'pm', 'first', 'basic', 'keyExperiences'), buildSingleKeyExperiencePrompt(quote, '가입', 0, 1, 'pm')];
  for (const prompt of prompts) { assert.match(prompt, /pmEvidence/); assert.match(prompt, /pmWorkProducts/); assert.match(prompt, /acceptance/); assert.match(prompt, /troubleshooting/); assert.match(prompt, /추정 좌표는 금지/); assert.match(prompt, /목표치≠실측치/); }
  assert.doesNotMatch(buildSingleKeyExperiencePrompt(quote, '코드', 0, 1, 'dev'), /"pmEvidence"/);
});

test('PM work products retain distinct policy fields and matched provenance', () => {
  const q = '임시 저장은 로그인 상태에서만 허용한다. 새로고침 후 내용 복구를 인수 기준으로 정했다. 내가 정책을 작성했다.';
  const jd = run({ pmWorkProducts: { requirements: [{ requirement: '임시 저장', rule: '로그인 상태에서만 허용', acceptance: '새로고침 후 내용 복구', owner: '정책 작성', quote: q, source: 'PRD.pdf', stage: 'executed' }] } }, `--- PRD.pdf ---\n${q}`);
  assert.equal(jd.pmWorkProductsVersion, 2);
  assert.equal(jd.pmWorkProducts.requirements[0].basis, 'source_excerpt');
  assert.equal(jd.pmWorkProducts.requirements[0].acceptance, '새로고침 후 내용 복구');
  assert.deepEqual(jd.pmWorkProducts.journey, []);
});
test('work products never fill unknown arrays or promote plans to results', () => {
  const q = '다음 달에 예시 제공 실험을 계획했다. 아직 실험을 시작하지 않았다.';
  const jd = run({ pmWorkProducts: { experiments: [{ hypothesis: '예시가 작성에 도움을 준다', observation: '전환 상승', decision: '채택', stage: 'observed', quote: q }], troubleshooting: [{ issue: '망설임', result: '해결됨', quote: q }] } }, q);
  assert.equal(jd.pmWorkProducts.experiments[0].stage, 'planned');
  assert.equal(jd.pmWorkProducts.experiments[0].observation, '');
  assert.equal(jd.pmWorkProducts.experiments[0].decision, '');
  assert.equal(jd.pmWorkProducts.troubleshooting[0].result, '');
  assert.deepEqual(run({ action: 'PRD를 작성했다.' }).pmWorkProducts.requirements, []);
});
test('unmatched product claims cannot certify ownership or outcomes', () => {
  const fake = { quote: '원문에 전혀 없는 성과를 확정하는 가짜 인용입니다.', stage: 'observed' };
  const jd = run({ pmWorkProducts: { collaboration: [{ ...fake, stakeholder: '개발팀', myAction: '총괄' }], experiments: [{ ...fake, hypothesis: '개선', observation: '성공' }], requirements: 'bad', journey: [null] } });
  assert.equal(jd.pmWorkProducts.collaboration[0].myAction, '');
  assert.equal(jd.pmWorkProducts.experiments[0].observation, '');
  assert.deepEqual(jd.pmWorkProducts.requirements, []);
  assert.deepEqual(jd.pmWorkProducts.journey, []);
});

test('v2 preserves blueprint layers and does not invent unrecorded lanes', () => {
  const q = '저장 단계에서 사용자는 입력하고 운영팀은 실패 문의를 처리한다. 시스템은 임시 저장을 담당한다.';
  const jd = run({ pmWorkProducts: { serviceBlueprint: [{ step: '저장', customerAction: '내용 입력', backstage: '실패 문의 처리', system: '임시 저장', quote: q, stage: 'executed' }] } }, q);
  assert.equal(jd.pmWorkProductsVersion, 2);
  assert.equal(jd.pmWorkProducts.serviceBlueprint[0].frontstage, '');
  assert.equal(jd.pmWorkProducts.serviceBlueprint[0].system, '임시 저장');
  assert.deepEqual(jd.pmWorkProducts.metricLinks, []);
});
test('v2 planned or unsupported risk and release rows cannot claim completion', () => {
  const q = '다음 달에 복구 정책을 테스트할 예정이며 아직 시작하지 않았다.';
  const jd = run({ pmWorkProducts: { risks: [{ risk: '작성 유실', result: '완전 해결', quote: q, stage: 'observed' }], releases: [{ milestone: '출시', status: '완료', quote: '존재하지 않는 근거로 출시 완료를 주장하는 문장입니다.' }] } }, q);
  assert.equal(jd.pmWorkProducts.risks[0].result, '');
  assert.equal(jd.pmWorkProducts.releases[0].status, '');
});
