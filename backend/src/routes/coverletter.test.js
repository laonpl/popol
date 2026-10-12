import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express, { Router } from 'express';
import * as evidence from '../services/coverLetterEvidence.js';
import { validatePublicUrl } from '../services/publicWebFetch.js';
import { createQuestionCatalog } from '../services/coverLetterQuestionCatalog.js';
import { MAX_APPLICATION_LINKS } from '../services/coverLetterSources.js';
import { isTransientAiError, aiUnavailableError } from '../utils/aiError.js';

const withoutImports = source => source.replace(/^import\s[\s\S]*?;\r?\n/gm, '');
const serviceSource = withoutImports(fs.readFileSync(new URL('../services/coverLetterService.js', import.meta.url), 'utf8'))
  .replace(/\bexport (?=(?:async )?function|const|let|class)/g, '')
  + '\nmodule.exports = { buildCoverLetterDocument, validateExperienceIds, importCoverLetterQuestions, inputError };';
const serviceContext = { ...evidence, validatePublicUrl, MAX_APPLICATION_LINKS, isTransientAiError, aiUnavailableError, URL, Buffer, module: { exports: null } };
// Real input/document sanitizers, with provider clients and Firebase imports removed.
vm.runInNewContext(serviceSource, serviceContext, { filename: 'coverLetterService.js' });
const sanitizers = serviceContext.module.exports;
const routeSource = withoutImports(fs.readFileSync(new URL('./coverletter.js', import.meta.url), 'utf8'))
  .replace(/\bexport (?=(?:async )?function|const|let|class)/g, '')
  .replace('export default router;', 'module.exports = router;');

function memoryDatabase(seed = {}) {
  const records = new Map(Object.entries(seed).map(([name, rows]) => [name, new Map(Object.entries(rows))]));
  const reads = [];
  let sequence = 0;
  const dataMap = name => {
    if (!records.has(name)) records.set(name, new Map());
    return records.get(name);
  };
  const snapshot = (id, data) => ({ id, exists: !!data, data: () => data && structuredClone(data) });
  const adminDb = {
    collection: name => ({
      doc: id => ({
        get: async () => { reads.push({ name, id }); return snapshot(id, dataMap(name).get(id)); },
        set: async data => { dataMap(name).set(id, structuredClone(data)); },
        delete: async () => { dataMap(name).delete(id); },
      }),
      add: async data => {
        const id = `created-${++sequence}`;
        dataMap(name).set(id, structuredClone(data));
        return { id };
      },
      where: (field, operator, value) => ({
        get: async () => {
          assert.equal(operator, '==');
          return { docs: [...dataMap(name)].filter(([, data]) => data[field] === value).map(([id, data]) => snapshot(id, data)) };
        },
      }),
    }),
  };
  return { adminDb, records, reads };
}

async function withServer(t, seed = {}) {
  const database = memoryDatabase(seed);
  const calls = { analyze: 0, generate: [], credits: 0 };
  const noop = (_req, _res, next) => next();
  const context = {
    Router, ...sanitizers, normalizePostingQuestions: evidence.normalizePostingQuestions, createQuestionCatalog, adminDb: database.adminDb,
    authMiddleware: (req, res, next) => {
      const uid = req.get('x-test-user');
      if (!uid) return res.status(401).json({ error: 'Authentication required' });
      req.user = { uid };
      next();
    },
    globalAiRateLimiter: noop, aiRateLimiter: noop,
    requireCredits: (_req, _res, next) => { calls.credits += 1; next(); },
    analyzeCoverLetter: async () => { calls.analyze += 1; return { company: '예시기업', questions: [] }; },
    generateCoverLetterAnswer: async (_body, experiences) => {
      calls.generate.push(experiences);
      return { answer: '저장한 사실로 작성한 초안', linkedExperienceIds: experiences.map(item => item.id) };
    },
    module: { exports: null },
  };
  vm.runInNewContext(routeSource, context, { filename: 'coverletter.js' });
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/coverletter', context.module.exports);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/coverletter`;
  const request = async (method, path = '', body, user = 'owner') => {
    const headers = { 'Content-Type': 'application/json' };
    if (user) headers['x-test-user'] = user;
    const response = await fetch(`${baseUrl}${path}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };
  return { ...database, calls, request };
}

test('every document and AI route rejects unauthenticated requests before reading data or generating', async t => {
  const app = await withServer(t);
  for (const [method, path] of [
    ['GET', '/list'], ['POST', ''], ['GET', '/saved'], ['PATCH', '/saved'], ['DELETE', '/saved'],
    ['POST', '/analyze'], ['POST', '/generate'], ['POST', '/questions/import'],
  ]) {
    const response = await app.request(method, path, method === 'GET' || method === 'DELETE' ? undefined : {}, null);
    assert.equal(response.status, 401, `${method} ${path}`);
  }
  assert.equal(app.reads.length, 0);
  assert.equal(app.calls.analyze, 0);
  assert.equal(app.calls.generate.length, 0);
});

test('authenticated question import uses no AI credits or database access and rejects mismatched sources', async t => {
  const app = await withServer(t);
  const question = '지원동기 및 입사 후 포부';
  const applicationUrl = 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537&pg=1';
  const body = { applicationUrl, analysis: { company: 'SFA반도체', position: '제조 Operator', applicationLinks: [{ url: applicationUrl }], selectedApplicationUrl: applicationUrl },
    capture: { version: 1, sourceUrl: 'https://recruit.sfa.co.kr/apply/resume?gbn=1&rnId=1537', capturedAt: '2026-10-08T12:00:00.000Z', questions: [{ question, sourceQuote: `${question} (500자 이내)`, maxLength: 500 }] } };
  const response = await app.request('POST', '/questions/import', body);
  assert.equal(response.status, 200);
  assert.equal(response.data.questions[0].question, question);
  assert.equal(response.data.questions[0].maxLength, 500);
  assert.equal(response.data.questions[0].importMethod, 'browser_extension');
  assert.equal(response.data.analysis.applicationAccess, 'connected');
  assert.equal(app.reads.length, 0);
  const saved = await app.request('POST', '', { analysis: response.data.analysis, questions: [{ ...response.data.questions[0], answer: '경험을 바탕으로 제가 직접 작성한 답변' }] });
  assert.equal(saved.status, 201);
  const reopened = await app.request('GET', `/${saved.data.id}`);
  assert.equal(reopened.status, 200);
  assert.equal(reopened.data.questions[0].importMethod, 'browser_extension');
  assert.equal(reopened.data.questions[0].validation, 'verified');
  assert.equal(reopened.data.questions[0].answer, '경험을 바탕으로 제가 직접 작성한 답변');
  assert.equal(reopened.data.analysis.applicationCapture.method, 'browser_extension');
  const readsAfterReopen = app.reads.length;
  body.capture.sourceUrl = 'https://unrelated.example.com/apply';
  assert.equal((await app.request('POST', '/questions/import', body)).status, 422);
  assert.equal(app.reads.length, readsAfterReopen);
  assert.equal(app.calls.analyze, 0);
  assert.equal(app.calls.generate.length, 0);
  assert.equal(app.calls.credits, 0);
});

test('owned CRUD preserves edited answers, evidence and a 60k source while ignoring identity overrides', async t => {
  const app = await withServer(t, { coverLetters: { foreign: { userId: 'someone-else', title: '다른 사람의 지원서' } } });
  const sourceText = '채'.repeat(60000);
  const create = await app.request('POST', '', {
    id: 'forged', userId: 'someone-else', createdAt: 'forged', title: '예시기업 지원서',
    sourceText, analysis: { sourceText }, status: 'draft', questions: [{
      id: 'q1', question: '지원 동기를 경험과 연결해 작성해주세요.', maxLength: 700, countSpaces: false,
      source: 'posting', sourceQuote: '지원 동기를 경험과 연결해 작성해주세요. (700자 이내, 공백 제외)',
      answer: '고객 조사를 직접 수행했습니다.', linkedExperienceIds: ['my-experience'],
      evidence: [{ experienceId: 'my-experience', quote: '고객 조사를 직접 수행했습니다.' }], warnings: ['제출 전 확인'],
    }],
  });
  assert.equal(create.status, 201);
  assert.equal(create.data.userId, 'owner');
  assert.notEqual(create.data.id, 'forged');
  assert.notEqual(create.data.createdAt, 'forged');
  assert.equal(create.data.sourceText.length, 60000);
  const id = create.data.id;
  const list = await app.request('GET', '/list');
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.map(item => item.id), [id]);
  const get = await app.request('GET', `/${id}`);
  assert.equal(get.status, 200);
  assert.equal(get.data.questions[0].answer, '고객 조사를 직접 수행했습니다.');
  assert.equal(get.data.questions[0].source, 'posting');
  const update = await app.request('PATCH', `/${id}`, { title: '최종 지원서', status: 'final', userId: 'someone-else', createdAt: 'forged' });
  assert.equal(update.status, 200);
  assert.equal(update.data.title, '최종 지원서');
  assert.equal(update.data.status, 'final');
  assert.equal(update.data.userId, 'owner');
  assert.equal(update.data.createdAt, create.data.createdAt);
  assert.equal(update.data.questions[0].answer, get.data.questions[0].answer);
  assert.deepEqual(update.data.questions[0].evidence, get.data.questions[0].evidence);
  assert.equal(update.data.sourceText.length, 60000);
  assert.equal((await app.request('DELETE', `/${id}`)).status, 200);
  assert.equal((await app.request('GET', `/${id}`)).status, 404);
  assert.deepEqual((await app.request('GET', '/list')).data, []);
  assert.equal(app.records.get('coverLetters').get('foreign').title, '다른 사람의 지원서');
});

test('other users documents deny read, update and delete and missing documents return 404', async t => {
  const foreign = { userId: 'someone-else', title: '보호할 지원서' };
  const app = await withServer(t, { coverLetters: { foreign } });
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const response = await app.request(method, '/foreign', method === 'PATCH' ? { userId: 'owner', title: '덮어쓰기' } : undefined);
    assert.equal(response.status, 403, method);
  }
  assert.equal((await app.request('GET', '/missing')).status, 404);
  assert.deepEqual(app.records.get('coverLetters').get('foreign'), foreign);
});

test('legacy wrong questions are quarantined without changing stored answers and scoped application evidence wins over archive text', async t => {
  const real = '지원한 직무에 관심을 갖게 된 계기를 경험과 연결해 작성해주세요.';
  const archived = '성장 과정에서 가장 큰 영향을 준 경험을 설명해주세요.';
  const wrong = '고등학교 졸업 이상인 자 반도체 설비 Operation 업무 수행 가능자';
  const sourceText = `자기소개서 문항\n${real}\n2018년 상반기 합격자소서\n${archived}\n${wrong}`;
  const rows = [
    { id: 'real', source: 'posting', question: real, sourceQuote: real, answer: '제가 직접 작성한 답변' },
    { id: 'wrong', source: 'posting', question: wrong, sourceQuote: wrong, answer: '삭제하면 안 되는 기존 답변' },
    { id: 'archived', source: 'posting', question: archived, sourceQuote: archived, answer: '과거 문항에 쓴 답변' },
    { id: 'suggested', source: 'suggested', question: '지원동기', answer: '추천 문항에 쓴 답변' },
  ];
  const stored = { userId: 'owner', questions: rows, analysis: { questions: rows, sourceText, questionSourceText: `자기소개서 문항\n${real}`, questionStatus: 'verified' } };
  const app = await withServer(t, { coverLetters: { old: stored } });
  for (const response of [(await app.request('GET', '/old')).data, (await app.request('GET', '/list')).data[0]]) {
    assert.equal(response.questions.length, 4);
    assert.deepEqual(response.questions.map(question => question.validation), ['verified', 'unverified', 'unverified', 'unverified']);
    assert.deepEqual(response.questions.map(question => question.answer), rows.map(question => question.answer));
    assert.deepEqual(response.analysis.questions.map(question => question.id), ['real']);
    assert.equal(response.analysis.questionStatus, 'verified');
  }
  assert.deepEqual(app.records.get('coverLetters').get('old'), stored);
  await app.request('PATCH', '/old', { questions: rows.slice(1), analysis: { ...stored.analysis, questions: rows.slice(1) } });
  const quarantined = (await app.request('GET', '/old')).data;
  assert.equal(quarantined.analysis.questionStatus, 'unavailable');
  assert.deepEqual(quarantined.analysis.questions, []);
  assert.equal(quarantined.questions[0].answer, rows[1].answer);
});

test('foreign and missing selected experiences fail before AI can read or generate with them', async t => {
  const app = await withServer(t, { experiences: {
    owned: { userId: 'owner', content: { rawInput: '내가 직접 작성한 경험' } },
    foreign: { userId: 'someone-else', content: { rawInput: '다른 사람의 경험' } },
  } });
  const question = { id: 'q1', question: '협업 경험을 설명해주세요.' };
  assert.equal((await app.request('POST', '/generate', { question, experienceIds: ['owned', 'foreign'] })).status, 403);
  assert.equal((await app.request('POST', '/generate', { question, experienceIds: ['missing'] })).status, 404);
  assert.equal((await app.request('POST', '/generate', { question: { ...question, linkedExperienceIds: ['foreign'] } })).status, 403);
  assert.equal(app.calls.generate.length, 0);
});

test('generation receives only owned saved experience content and analysis uses its authenticated envelope', async t => {
  const app = await withServer(t, { experiences: {
    owned: { userId: 'owner', title: '고객 조사', content: { rawInput: '저장한 실제 인터뷰 기록' } },
  } });
  const response = await app.request('POST', '/generate', {
    experienceIds: ['owned'], question: { id: 'q1', question: '경험을 설명해주세요.' },
    experiences: [{ id: 'owned', userId: 'owner', content: { rawInput: '클라이언트가 만들어낸 성과' } }],
  });
  assert.equal(response.status, 200);
  assert.equal(app.calls.generate.length, 1);
  assert.equal(app.calls.generate[0][0].content.rawInput, '저장한 실제 인터뷰 기록');
  assert.deepEqual(response.data.linkedExperienceIds, ['owned']);
  const analyzed = await app.request('POST', '/analyze', { text: '공고 자료' });
  assert.equal(analyzed.status, 200);
  assert.equal(analyzed.data.analysis.company, '예시기업');
  assert.equal(app.calls.analyze, 1);
});

test('saramin detail iframe is read and inline "문항 N." prompts are split without intro or trailing lines', async () => {
  const { scrapeCoverLetterPosting } = await import('../services/coverLetterSources.js');
  const detail = '<div class="user_content"><p>근무지: 서울</p><p>자기소개서 문항 (각 700자)</p><p>* 자기소개서 작성 시 반드시 아래 문항에 맞춰 작성해 주십시오.</p>'
    + '<p>문항 1. 새로운 도구를 익혀 적용한 경험을 구체적으로 서술해 주세요.문항 2. 본인의 강점을 활용한 사례를 서술해 주세요.</p><p>가상 법무법인 자문팀</p><p>example-law.com</p></div>';
  const fetched = [];
  const safeFetch = async url => {
    fetched.push(url);
    return url.includes('view-detail') ? detail : '<html><title>가상 채용 - 사람인</title><body>로그인</body></html>';
  };
  const result = await scrapeCoverLetterPosting('https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=123', { safeFetch });
  assert.ok(fetched.includes('https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=123&rec_seq=0'));
  assert.deepEqual(evidence.extractPostingQuestions(result.questionText).map(item => item.question), [
    '새로운 도구를 익혀 적용한 경험을 구체적으로 서술해 주세요.',
    '본인의 강점을 활용한 사례를 서술해 주세요.',
  ]);
});

test('jobkorea posting without public questions borrows the matching open Jasoseol posting, never a dissimilar or ambiguous one', async () => {
  const { scrapeCoverLetterPosting, portalPostingIdentity } = await import('../services/coverLetterSources.js');
  const postingUrl = 'https://www.jobkorea.co.kr/Recruit/GI_Read/777';
  assert.deepEqual(portalPostingIdentity('(주)가상마트 채용 - ㈜가상마트 27년 신입사원 채용 | 잡코리아', postingUrl), { company: '가상마트', title: '㈜가상마트 27년 신입사원 채용' });
  assert.deepEqual(portalPostingIdentity('[(주)가상테크] 미디어팀 채용(D-4) - 사람인', 'https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1'), { company: '가상테크', title: '미디어팀 채용' });
  const scrapeWith = (searchResults, options = {}) => scrapeCoverLetterPosting(postingUrl, { ...options, safeFetch: async (url, request = {}) => {
    if (url.startsWith('https://jasoseol.com/api/v1/employment_companies?q=')) return JSON.stringify(searchResults);
    if (url === 'https://jasoseol.com/api/v1/employment_companies/10') return JSON.stringify({ name: '가상마트', title: '27년 신입사원 채용', employments: [{ id: 21, field: 'MD', has_resume: true }, { id: 22, field: '영업', has_resume: true }] });
    if (url.endsWith('/employment/employment_question.json')) {
      assert.equal(JSON.parse(request.body).employment_id, 21);
      return JSON.stringify({ employment_question: [{ question: '지원 직무에서 가장 중요한 역량을\r\n본인 경험으로 설명하십시오.', is_character: true, total_count: 700 }] });
    }
    return '<html><title>(주)가상마트 채용 - ㈜가상마트 27년 신입사원 채용 | 잡코리아</title><body><main>모집 직무: MD, 영업. 서류전형 후 면접을 진행합니다. 근무지는 서울이며 입사 후 교육을 진행합니다.</main></body></html>';
  } });

  const unrelated = await scrapeWith([{ id: 11, name: '가상마트', title: '대학생 서포터즈 모집' }]);
  assert.equal(unrelated.questionOrigin, undefined);
  const ambiguous = await scrapeWith([{ id: 13, name: '가상마트', title: '27년 신입사원 채용(MD)' }, { id: 14, name: '가상마트', title: '27년 신입사원 채용(물류)' }]);
  assert.equal(ambiguous.questionOrigin, undefined);

  const matched = await scrapeWith([{ id: 10, name: '가상마트', title: '27년 신입사원 채용' }, { id: 11, name: '가상마트', title: '대학생 서포터즈 모집' }]);
  assert.equal(matched.questionOrigin, 'jasoseol_counterpart');
  assert.equal(matched.questionStatus, 'selection_required');
  const role = matched.applicationLinks.find(link => link.label === 'MD');
  const selected = await scrapeWith([{ id: 10, name: '가상마트', title: '27년 신입사원 채용' }], { applicationUrl: role.url });
  const [question] = evidence.extractPostingQuestions(selected.questionText);
  assert.equal(question.question, '지원 직무에서 가장 중요한 역량을 본인 경험으로 설명하십시오.');
  assert.equal(question.maxLength, 700);
});
