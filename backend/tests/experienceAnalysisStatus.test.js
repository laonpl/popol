import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { experienceAnalysisIssue, experienceAnalysisError, hasExtractedExperience } from '../src/utils/experienceAnalysisStatus.js';

const source = fs.readFileSync(new URL('../src/services/geminiService.js', import.meta.url), 'utf8');
const start = source.indexOf('export async function analyzeExperience(');
const analyzer = source.slice(start, source.indexOf('\n/**', start)).replace('export ', '');
async function analyze({ fail = [], empty = false, reviewed = null, role = 'common', overviewFails = false, framework = 'CARL' } = {}) {
  const context = { experienceAnalysisIssue, experienceAnalysisError, hasExtractedExperience,
    console: { log() {}, warn() {} }, clampMaterial: value => value,
    buildOverviewPrompt: () => 'overview', buildMetaPrompt: () => 'meta',
    buildSingleKeyExperiencePrompt: (_content, _hint, index) => String(index),
    callProFirstWithSearch: async () => {
      if (overviewFails) throw Object.assign(new Error('GEMINI_TIMEOUT'), { status: 504 });
      return '{}';
    },
    callProFirst: async prompt => {
      if (fail.includes(Number(prompt))) throw Object.assign(new Error('private source/provider error'), { status: 429 });
      return JSON.stringify(empty ? {} : { title: `선택 ${prompt}`, situation: '학생이 공지를 놓쳤다', task: '공지 탐색 문제 해결', action: '직접 실행한 작업', jobData: { reason: '원문 근거' } });
    },
    generateWithRetry: async () => '{}', withTimeout: value => value, parseJSON: JSON.parse,
    firstPlainObject: (...values) => values.find(value => value && typeof value === 'object') || null,
    buildFallbackExperienceAnalysis: () => ({ overview: 'source-based overview' }),
    buildFallbackMarketerKit: () => ({}), normalizeProduct: value => value || null,
    normalizeArchitectureDiagram: value => value || null, groundAnalysisMetrics: value => value,
    sanitizeArtifactsDeep: value => value, groundPmEvidence: value => value, groundMarketerEvidence: value => value,
    LITE_ONLY_OPTIONS: {}, FAST_LITE_OPTIONS: {},
  };
  context.callFastLite = prompt => prompt === 'overview' ? context.callProFirstWithSearch() : context.callProFirst(prompt);
  vm.runInNewContext(analyzer, context);
  return context.analyzeExperience({ rawInput: '원문에서 확인한 본인의 작업과 결과' }, 3, reviewed, role, 'first', { framework });
}

test('STAR extraction retains separate situation and task through AI result normalization', async () => {
  const result = await analyze({ framework: 'STAR' });
  assert.equal(result.framework, 'STAR');
  assert.equal(result.keyExperiences[0].situation, '학생이 공지를 놓쳤다');
  assert.equal(result.keyExperiences[0].task, '공지 탐색 문제 해결');
});

test('all extraction calls failing throw the real safe cause for every role, never an empty success', async () => {
  for (const role of ['common', 'dev', 'pm', 'marketer']) {
    await assert.rejects(analyze({ fail: [0, 1, 2], role }), error => {
      assert.equal(error.status, 429);
      assert.equal(error.code, 'AI_RATE_LIMIT');
      assert.equal(error.analysisIssues.length, 3);
      assert.doesNotMatch(JSON.stringify(error.analysisIssues), /private source/);
      return true;
    });
  }
});

test('empty JSON objects do not count as extracted experiences', async () => {
  await assert.rejects(analyze({ empty: true }), error => error.code === 'AI_EMPTY_EXPERIENCES' && error.status === 422);
});

test('independent failed calls leave genuine successful scenes available with partial diagnostics', async () => {
  for (const role of ['common', 'dev', 'pm', 'marketer']) {
    const result = await analyze({ fail: [1, 2], role });
    assert.equal(result._partial, true);
    assert.equal(result._fallback, undefined);
    assert.equal(result.keyExperiences.length, 1);
    assert.equal(result.keyExperiences[0].jobData.reason, '원문 근거');
    assert.equal(result._analysisSummary.extracted, 1);
    assert.equal(result._analysisSummary.requested, 3);
  }
});

test('a failed overview does not disguise source fallback as a fully completed analysis', async () => {
  const result = await analyze({ overviewFails: true });
  assert.equal(result._partial, true);
  assert.equal(result.keyExperiences.length, 3);
  assert.equal(result._analysisIssues[0].stage, 'overview');
  assert.equal(result._analysisIssues[0].code, 'AI_TIMEOUT');
});

test('failed reviewed hints remain visibly fallback and cannot claim fresh AI extraction', async () => {
  await assert.rejects(analyze({ fail: [0, 1, 2], reviewed: [{ title: '직접 검토한 경험' }], role: 'pm' }), error => error.code === 'AI_RATE_LIMIT');
});

test('provider diagnostics classify errors without exposing provider text or misreporting auth as a login failure', () => {
  for (const [error, code, status] of [
    [{ status: 401 }, 'AI_CONFIGURATION', 503], [{ status: 403 }, 'AI_CONFIGURATION', 503],
    [{ status: 402 }, 'CREDITS_REQUIRED', 402], [{ message: 'GEMINI_TIMEOUT' }, 'AI_TIMEOUT', 504],
    [{ message: 'AI response JSON parse failed: secret source' }, 'AI_INVALID_RESPONSE', 502],
  ]) {
    const issue = experienceAnalysisIssue(error);
    assert.equal(issue.code, code); assert.equal(issue.status, status);
    assert.equal(issue.stopBatch, true);
    assert.doesNotMatch(issue.message, /secret source/);
  }
});

test('permanent authentication and billing errors do not retry the same credentials through Lite', async () => {
  const proSource = source.slice(source.indexOf('async function callProFirst('), source.indexOf('async function callFastLite('));
  for (const status of [401, 402, 403]) {
    let calls = 0;
    const error = Object.assign(new Error('provider rejected credentials'), { status });
    const context = { PRO_FIRST_OPTIONS: {}, LITE_FALLBACK_OPTIONS: {},
      console: { log() {}, warn() {} }, generateWithRetry: async () => { calls++; throw error; } };
    vm.runInNewContext(proSource, context);
    await assert.rejects(context.callProFirstWithSearch('자료', 'test'), candidate => candidate === error);
    assert.equal(calls, 1);
  }
});

test('an unsupported search skips redundant Lite and falls back to one ordinary analysis call', async () => {
  const proSource = source.slice(source.indexOf('async function callProFirst('), source.indexOf('async function callFastLite('));
  let calls = 0;
  const context = { PRO_FIRST_OPTIONS: {}, LITE_FALLBACK_OPTIONS: {}, console: { log() {}, warn() {} },
    generateWithRetry: async (_prompt, options) => {
      calls++;
      if (options.config?.tools) throw Object.assign(new Error('search unsupported'), { status: 501, code: 'SEARCH_UNSUPPORTED' });
      return 'analysis';
    } };
  vm.runInNewContext(proSource, context);
  assert.equal(await context.callProFirstWithSearch('자료', 'test'), 'analysis');
  assert.equal(calls, 2);
});

test('a malformed fallback response fails safely before recording billable usage', async () => {
  const clientSource = fs.readFileSync(new URL('../src/config/geminiClient.js', import.meta.url), 'utf8');
  const fallbackSource = clientSource.slice(clientSource.indexOf('export async function callGitHubModelsFallback('), clientSource.indexOf('const MODEL_FALLBACKS')).replace('export ', '');
  let charged = 0;
  const context = { getBillingStore: () => ({}), assertHasCredits: async () => {},
    console: { log() {} }, recordAiUsage: async () => { charged++; },
    getOpenAIClient: () => ({ chat: { completions: { create: async () => ({}) } } }),
  };
  vm.runInNewContext(fallbackSource, context);
  await assert.rejects(context.callGitHubModelsFallback('자료'), error => error.code === 'AI_INVALID_RESPONSE' && error.status === 502);
  assert.equal(charged, 0);
});
