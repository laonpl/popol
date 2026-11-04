import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildLocalExperienceDraft } from '../../frontend/src/utils/localExperienceDraft.js';
import { roleAnalysisContent, preserveRolePresentation } from '../src/utils/roleMaterials.js';
import { collectPmSources } from '../src/services/pmEvidence.js';
import { experienceAnalysisIssue, experienceAnalysisError, hasExtractedExperience } from '../src/utils/experienceAnalysisStatus.js';

const routeSource = fs.readFileSync(new URL('../src/routes/experience.js', import.meta.url), 'utf8')
  .replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace('export default router;', '');
const original = '사용자 인터뷰에서 가입 단계가 복잡하다는 응답을 확인했고 필수 입력 항목을 줄였다.';
const dataFor = jobCategory => ({ userId: 'owner', ...buildLocalExperienceDraft({
  title: '가입 개선 프로젝트', role: '기획 담당', context: '고객이 가입을 어려워했다.', action: '필수 항목을 줄였다.',
  result: '', learning: '', sourceText: original, sourcePaths: ['학교/가입정책.md'],
}, jobCategory, { careerStage: 'experienced', momentsCount: 4 }) });

async function run(data, analyze, uid = 'owner') {
  const routes = new Map(), calls = [], writes = [];
  const router = Object.fromEntries(['post', 'get', 'put', 'patch', 'delete'].map(method => [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers.at(-1))]));
  const context = { Router: () => router, authMiddleware() {}, requireCredits() {}, aiRateLimiter() {},
    roleAnalysisContent, preserveRolePresentation,
    experienceAnalysisIssue, experienceAnalysisError, hasExtractedExperience,
    adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => data }), update: async value => writes.push(value) }) }) },
    analyzeExperience: async (...args) => { calls.push(args); return analyze(...args); },
    buildFallbackExperienceAnalysis() { throw new Error('local PM draft must be preserved on failure'); },
  };
  vm.runInNewContext(routeSource, context);
  const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.data = value; return this; } };
  await routes.get('post /analyze')({ user: { uid }, body: { experienceId: 'local-1', momentsCount: 4 } }, response, error => { throw error; });
  return { response, calls, writes };
}

test('local files enter the existing job-specific analysis route with source provenance and unlocked moments', async () => {
  for (const jobCategory of ['pm', 'dev', 'marketer']) {
    const data = dataFor(jobCategory);
    const { response, calls, writes } = await run(data, () => ({ jobCategory, keyExperiences: [{ title: '가입 흐름 결정', jobData: { decision: '필수 항목 축소' } }], keywords: ['판단'] }));
    assert.equal(response.statusCode, 200);
    assert.equal(calls[0][1], 4);
    assert.equal(calls[0][2], null, 'the common-parser candidate does not become a locked reviewed moment');
    assert.equal(calls[0][3], jobCategory);
    assert.equal(calls[0][4], 'experienced');
    assert.equal(calls[0][5].framework, 'STAR');
    const source = collectPmSources(calls[0][0]).find(row => row.name === '학교/가입정책.md');
    assert.equal(source.kind, 'artifact');
    assert.equal(source.text, original);
    assert.equal(writes[0].structuredResult.jobCategory, jobCategory);
    assert.equal(writes[0].structuredResult._draft, undefined);
    assert.equal(writes[0].lifecycleStatus, 'needs_confirmation');
    assert.equal(data.content['로컬 파일 원문'].includes(original), true);
  }
});

test('failed local analysis returns a non-success response and preserves originals and draft for every role', async () => {
  for (const role of ['common', 'dev', 'pm', 'marketer']) {
    const data = dataFor(role);
    const { response, writes } = await run(data, () => { throw Object.assign(new Error('private provider text'), { status: 429 }); });
    assert.equal(response.statusCode, 429);
    assert.equal(response.data.code, 'AI_RATE_LIMIT');
    assert.equal(response.data.stopBatch, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].structuredResult, undefined);
    assert.equal(writes[0].content, undefined);
    assert.equal(data.structuredResult._draft, true);
    assert.doesNotMatch(JSON.stringify(response.data), /private provider text/);
  }
});

test('empty success is rejected instead of overwriting the QRious-style common-role draft', async () => {
  const { response, writes } = await run(dataFor('common'), () => ({ keyExperiences: [], overview: 'overview succeeded' }));
  assert.equal(response.statusCode, 422);
  assert.equal(response.data.code, 'AI_EMPTY_EXPERIENCES');
  assert.equal(response.data.stopBatch, false);
  assert.equal(writes[0].structuredResult, undefined);
});

test('genuine partial analysis replaces a local draft and clears a previous failure', async () => {
  const issue = experienceAnalysisIssue({ status: 504 });
  const result = { _partial: true, _analysisIssues: [issue], keyExperiences: [{ title: '가입 결정', action: '필수 항목을 줄였다' }] };
  const { response, writes } = await run(dataFor('pm'), () => result);
  assert.equal(response.statusCode, 200);
  assert.equal(response.data._partial, true);
  assert.equal(response.data._fallback, undefined);
  assert.equal(writes[0].structuredResult.keyExperiences.length, 1);
  assert.equal(writes[0].analysisFailure, null);
});

test('partial reanalysis cannot overwrite a completed local role analysis', async () => {
  const data = dataFor('pm');
  delete data.structuredResult._draft;
  const { response, writes } = await run(data, () => ({ _partial: true,
    _analysisIssues: [experienceAnalysisIssue({ status: 504 })], keyExperiences: [{ title: '부분 결과' }] }));
  assert.equal(response.statusCode, 504);
  assert.equal(writes[0].structuredResult, undefined);
  assert.equal(writes[0].analysisFailure.code, 'AI_TIMEOUT');
});

test('local role analysis respects existing experience ownership checks', async () => {
  const { response, calls, writes } = await run(dataFor('pm'), () => { throw Error('must not call AI'); }, 'another-user');
  assert.equal(response.statusCode, 403);
  assert.equal(calls.length, 0);
  assert.equal(writes.length, 0);
});
