import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRoleSelfReport, validRoleSelfReport, collectRoleSelfReports } from '../../shared/roleSelfReport.mjs';
import { roleAnalysisContent, preserveRolePresentation } from '../src/utils/roleMaterials.js';
import { collectPmSources, groundPmEvidence } from '../src/services/pmEvidence.js';
import { roleFollowUpQuestions } from '../src/prompts/roleExperienceGuidance.js';
import { buildDraftAnalysisPrompt, buildInterviewQuestionsPrompt, buildExtractMomentsPrompt } from '../src/prompts/experiencePrompts.js';

const fields = [['option', '검토한 대안'], ['reason', '선택 이유']];
const manual = () => {
  const values = { option: '가입 단계를 줄인다', reason: '고객이 중간 저장 없이 이탈하는 것을 관찰했다' };
  return { ...values, ...createRoleSelfReport(values, fields), stage: 'observed', manuallyAdded: true, manualId: 'manual-1' };
};
const saved = () => ({
  userId: 'owner', jobCategory: 'pm', content: { rawInput: '기존 조사 내용', 추가인터뷰_보강자료: 'Q. 이전 질문\n→ 내가 흐름을 설계했다.' },
  structuredResult: {
    jobCategory: 'pm', keyExperiences: [{ id: 'case-1', title: '가입 개선', artifactBindings: [{ assetId: 'file-1', caption: '내가 정한 정책' }], jobData: { pmWorkProducts: { alternatives: [manual()] } } }],
    deliverables: [{ id: 'file-1', name: 'PRD.pdf', url: '/uploads/prd.pdf' }],
    pmFiles: [{ id: 'file-2', name: 'research.pdf', url: '/uploads/research.pdf' }],
    additionalMaterials: [{ assetId: 'file-1', name: 'PRD.pdf', text: '나는 로그인한 고객의 임시 저장 정책과 새로고침 복구 조건을 설계했다.' }],
    pmHypotheses: [{ hypothesis: '저장으로 이탈을 줄일 수 있다' }],
  },
});

test('direct role entries remain self reports with a current field snapshot', () => {
  const row = manual();
  assert.equal(validRoleSelfReport(row), true);
  assert.equal(row.basis, 'self_report');
  assert.match(row.quote, /검토한 대안: 가입 단계를 줄인다/);
  assert.equal(validRoleSelfReport({ ...row, reason: '새롭게 수정한 이유' }), false);
  assert.equal(validRoleSelfReport({ ...row, quote: '다른 파일에서 가져온 인용문' }), false);
  assert.equal(validRoleSelfReport({ ...row, manuallyAdded: false }), false);
  assert.equal(validRoleSelfReport({ ...row, sourceName: '외부 보고서.pdf' }), false);
});

test('reanalysis reads current manual work and attached material without treating them as file proof', () => {
  const data = saved(), content = roleAnalysisContent(data);
  assert.match(content['직접 작성한 산출물'], /가입 단계를 줄인다/);
  assert.match(content['추가 산출물 원문'], /새로고침 복구 조건/);
  const report = collectPmSources(content).find(source => source.name === '직접 작성한 경험');
  assert.equal(report.kind, 'self_report');
  const grounded = groundPmEvidence({ jobCategory: 'pm', keyExperiences: [{ jobData: { pmEvidence: [{ dimension: 'prioritization', claim: '가입 흐름을 줄이기로 했다', quote: manual().quote, source: manual().sourceName, stage: 'observed' }] } }] }, content);
  assert.equal(grounded.keyExperiences[0].jobData.pmEvidence[0].basis, 'self_report');
  assert.deepEqual(collectRoleSelfReports(data.structuredResult, 'marketer'), []);
});

test('deleted or stale manual entries cannot survive as cached original material', () => {
  const data = saved();
  data.content = roleAnalysisContent(data);
  data.structuredResult.keyExperiences[0].jobData.pmWorkProducts.alternatives[0].reason = '스냅샷을 갱신하지 않은 수정';
  data.structuredResult.deliverables = [];
  const next = roleAnalysisContent(data);
  assert.equal(next['직접 작성한 산출물'], undefined);
  assert.equal(next['추가 산출물 원문'], undefined);
  assert.equal(next.rawInput, '기존 조사 내용');
});

test('manual CRM sources retain the selected plan stage without rewriting the original quote', () => {
  const values = { segment: '가입 후 첫 구매 전 고객', trigger: '가입 다음 날', message: '첫 구매 안내' };
  const report = createRoleSelfReport(values, [['segment', '대상 고객'], ['trigger', '진입 조건'], ['message', '메시지']]);
  const planned = { ...values, ...report, manuallyAdded: true, manualId: 'crm-plan', stage: 'planned' };
  const executed = { ...planned, manualId: 'crm-execution', stage: 'executed' };
  const sr = { jobCategory: 'marketer', keyExperiences: [{ jobData: { marketerWorkProducts: { crm: [planned, executed, { ...planned, manualId: 'duplicate-plan' }] } } }] };
  const sources = collectRoleSelfReports(sr);
  assert.equal(sources.length, 2);
  assert.match(sources[0].text, /^기록 단계\(본인 선택\): 계획\n/);
  assert.match(sources[1].text, /^기록 단계\(본인 선택\): 실행\n/);
  assert.equal(planned.quote, report.quote);
  assert.equal(validRoleSelfReport(planned), true);
  assert.equal(sources[0].text.slice(sources[0].text.indexOf('\n') + 1), report.quote);
  const content = roleAnalysisContent({ jobCategory: 'marketer', structuredResult: sr });
  assert.match(content['직접 작성한 산출물'], /기록 단계\(본인 선택\): 계획/);
  const unknown = collectRoleSelfReports({ ...sr, keyExperiences: [{ jobData: { marketerWorkProducts: { crm: [{ ...planned, stage: '임의 완료 상태' }] } } }] });
  assert.match(unknown[0].text, /^기록 단계\(본인 선택\): 확인 필요/);
  assert.doesNotMatch(unknown[0].text, /임의 완료 상태/);
});

test('interview questions are excluded from evidence while the actual answer remains a self report', () => {
  const content = { 추가인터뷰_보강자료: 'Q. 전환율이 두 배로 증가했나요?\n→ 아직 출시 전이라 실제 변화는 확인하지 못했습니다.' };
  const sources = collectPmSources(content);
  assert.equal(sources[0].kind, 'self_report');
  assert.doesNotMatch(sources[0].text, /두 배/);
  assert.match(sources[0].text, /아직 출시 전/);
});

test('role prompts preserve distinct work products and ask concrete role decisions', () => {
  const pm = buildInterviewQuestionsPrompt('가입 경험', 'pm');
  const marketer = buildInterviewQuestionsPrompt('뉴스레터', 'marketer');
  assert.match(pm, /MVP|인수 기준/); assert.match(pm, /검증 계획/);
  assert.match(marketer, /후킹 문구·본문·CTA/); assert.match(marketer, /CRM 진입·제외 조건/);
  assert.doesNotMatch(pm, /"pmWorkProducts"/);
  assert.doesNotMatch(marketer, /"marketerWorkProducts"/);
  assert.match(buildDraftAnalysisPrompt('정책을 설계했다', 'pm', 'first', 'basic', 'keyExperiences'), /"pmWorkProducts"/);
  assert.match(buildDraftAnalysisPrompt('소재를 만들었다', 'marketer', 'first', 'basic', 'keyExperiences'), /"marketerWorkProducts"/);
});

const serviceSource = fs.readFileSync(new URL('../src/services/geminiService.js', import.meta.url), 'utf8');
const interviewSource = serviceSource.slice(serviceSource.indexOf('export async function generateInterviewQuestions'), serviceSource.indexOf('export async function generateIdentityPatternCandidates')).replace(/^export /, '');
test('AI outage still offers PM and marketing questions within the interview mode limit', async () => {
  const context = { roleFollowUpQuestions, buildInterviewQuestionsPrompt, callProFirst: async () => { throw new Error('503'); }, console: { warn() {} } };
  vm.runInNewContext(interviewSource, context);
  const pm = await context.generateInterviewQuestions('내용', 'pm', 'basic');
  const marketer = await context.generateInterviewQuestions('내용', 'marketer', 'quick');
  assert.equal(pm.questions.length, 5);
  assert.equal(marketer.questions.length, 3);
  assert.ok(pm.questions.some(row => /서비스 정책/.test(row.question)));
  assert.ok(marketer.questions.some(row => /CTA/.test(row.question)));
});

const routeSource = fs.readFileSync(new URL('../src/routes/experience.js', import.meta.url), 'utf8').replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace('export default router;', '');
async function enrich(data, analyze, userId = 'owner') {
  const routes = new Map(), writes = [], calls = [];
  const router = Object.fromEntries(['post', 'get', 'patch', 'delete'].map(method => [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers.at(-1))]));
  const context = { Router: () => router, authMiddleware() {}, requireCredits() {}, aiRateLimiter() {},
    roleAnalysisContent, preserveRolePresentation,
    adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => data }), update: async value => writes.push(value) }) }) },
    analyzeExperience: async (...args) => { calls.push(args); return analyze(...args); },
    buildFallbackExperienceAnalysis: () => { throw new Error('existing role experience must be retained'); },
  };
  vm.runInNewContext(routeSource, context);
  const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.data = value; return this; } };
  await routes.get('post /enrich-interview')({ user: { uid: userId }, body: { experienceId: 'one', qa: [{ question: '무엇을 제외했나요?', answer: '초기 출시에서 자동 추천을 제외했습니다.' }] } }, response, error => { throw error; });
  return { response, writes, calls };
}

test('interview enrichment preserves role attachments, manual rows and answers for the next analysis', async () => {
  const data = saved();
  const { response, writes, calls } = await enrich(data, () => ({ jobCategory: 'pm', keyExperiences: [{ id: 'case-1', title: '가입 개선', jobData: { pmWorkProducts: { alternatives: [] } } }] }));
  assert.equal(response.statusCode, 200);
  assert.match(calls[0][0]['추가 산출물 원문'], /임시 저장 정책/);
  assert.match(calls[0][0]['직접 작성한 산출물'], /가입 단계를 줄인다/);
  assert.match(writes[0].content.추가인터뷰_보강자료, /내가 흐름을 설계했다/);
  assert.match(writes[0].content.추가인터뷰_보강자료, /자동 추천을 제외/);
  assert.equal(response.data.deliverables[0].id, 'file-1');
  assert.equal(response.data.pmFiles[0].id, 'file-2');
  assert.equal(response.data.keyExperiences[0].artifactBindings[0].caption, '내가 정한 정책');
  assert.equal(validRoleSelfReport(response.data.keyExperiences[0].jobData.pmWorkProducts.alternatives[0]), true);
});

test('provider errors and partial fallback cannot erase prior role analysis or new interview answers', async () => {
  for (const analyze of [() => { throw new Error('503 unavailable'); }, () => ({ _fallback: true, jobCategory: 'pm', keyExperiences: [] })]) {
    const { response, writes } = await enrich(saved(), analyze);
    assert.equal(response.data._fallbackReason, 'reanalysis_failed_preserved');
    assert.equal(response.data.keyExperiences[0].title, '가입 개선');
    assert.equal(response.data.deliverables[0].id, 'file-1');
    assert.match(writes[0].content.추가인터뷰_보강자료, /자동 추천을 제외/);
  }
});

test('enrichment checks ownership before reading attached materials or calling AI', async () => {
  const { response, writes, calls } = await enrich(saved(), () => { throw new Error('should not run'); }, 'someone-else');
  assert.equal(response.statusCode, 403);
  assert.equal(writes.length, 0); assert.equal(calls.length, 0);
});

test('moment extraction carries the selected role from store through route and service into the prompt', async () => {
  const storeSource = fs.readFileSync(new URL('../../frontend/src/stores/experienceStore.js', import.meta.url), 'utf8');
  const actionStart = storeSource.indexOf('extractMoments: async');
  const actionEnd = storeSource.indexOf('/**', actionStart);
  const extractSource = serviceSource.slice(serviceSource.indexOf('export async function extractMoments'), serviceSource.indexOf('export async function generateCoverLetterDraft')).replace(/^export /, '');
  const prompts = [], calls = [], routes = new Map();
  const serviceContext = { buildExtractMomentsPrompt, withTimeout: promise => promise, parseJSON: JSON.parse,
    callProFirst: async prompt => { prompts.push(prompt); return JSON.stringify({ moments: [{ title: '원문 판단', context: '직접 입력한 사실' }] }); },
    groundMomentMetrics: moments => moments, console: { log() {}, warn() {} },
    buildFallbackMoments: () => { throw new Error('unexpected fallback'); },
  };
  vm.runInNewContext(extractSource, serviceContext);
  const router = Object.fromEntries(['post', 'get', 'patch', 'delete'].map(method => [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers.at(-1))]));
  const routeContext = { Router: () => router, authMiddleware() {}, requireCredits() {}, aiRateLimiter() {}, extractMoments: (...args) => { calls.push(args); return serviceContext.extractMoments(...args); } };
  vm.runInNewContext(routeSource, routeContext);
  const api = { post: async (path, body) => {
    assert.equal(path, '/experience/extract-moments');
    const response = { status() { return this; }, json(data) { this.data = data; return this; } };
    await routes.get('post /extract-moments')({ body }, response, error => { throw error; });
    return response;
  } };
  const store = vm.runInNewContext(`({ ${storeSource.slice(actionStart, actionEnd)} })`, { api });
  await store.extractMoments('고객 조사와 소재 운영', '프로젝트', 'pm');
  await store.extractMoments('고객 조사와 소재 운영', '프로젝트', 'marketer');
  await store.extractMoments('개발 과정', '프로젝트');
  assert.deepEqual(calls.map(args => args[2]), ['pm', 'marketer', 'common']);
  assert.match(prompts[0], /제품 의사결정 사례/); assert.match(prompts[0], /MVP 범위 결정/);
  assert.match(prompts[1], /캠페인·콘텐츠·고객 관계 사례/); assert.match(prompts[1], /후킹 문구·CTA/);
  for (const prompt of prompts.slice(0, 2)) {
    assert.match(prompt, /코드 구현·아키텍처·성능 개선을 자동으로 본인의 직군 경험으로 바꾸지 않는다/);
    assert.match(prompt, /하나뿐이면 1개도 정상/);
    assert.doesNotMatch(prompt, /최소 3개 필수/);
  }
  assert.doesNotMatch(prompts[2], /기획\/PM 핵심 경험 추출|마케터 핵심 경험 추출/);
});

test('no relevant role moments does not reframe a generic software source into PM or marketing work', async () => {
  const extractSource = serviceSource.slice(serviceSource.indexOf('export async function extractMoments'), serviceSource.indexOf('export async function generateCoverLetterDraft')).replace(/^export /, '');
  const context = { buildExtractMomentsPrompt, withTimeout: promise => promise, parseJSON: JSON.parse,
    callProFirst: async () => '{"moments":[]}', console: { log() {}, warn() {} },
    buildFallbackMoments: () => { throw new Error('must not manufacture unrelated moments'); },
  };
  vm.runInNewContext(extractSource, context);
  for (const role of ['pm', 'marketer']) assert.equal((await context.extractMoments('API 응답 캐싱 코드만 담긴 자료', '코드', role)).length, 0);
});
