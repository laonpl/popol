import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { segmentExperiencesWithAI, generateImportOnce, SEGMENT_INPUT_LIMIT, SEGMENT_CONFIG } from './importSegmentation.js';
import { structureImportedContent, importFromFile } from './importService.js';
import importRouter from '../routes/import.js';

const DOCUMENT = [
  '예약 개선 프로젝트', '예약 화면을 재설계하고 사용자 테스트를 진행했습니다. 완료율 18% 상승.',
  '중고거래 프로젝트', '학생들을 인터뷰하고 중고 물품 거래 앱을 개발했습니다. MAU 1,200명 달성.',
].join('\n');

test('paste structuring route permits local experience extraction without a credit lookup', async () => {
  const route = importRouter.stack.find(layer => layer.route?.path === '/structure').route;
  const req = { user: { uid: 'no-wallet-test-user' }, body: {
    importedData: { title: '예약 개선', content: DOCUMENT }, targetType: 'experience', preferLocal: true,
  } };
  let proceeded = false;
  await route.stack[1].handle(req, {}, error => { assert.ifError(error); proceeded = true; });
  assert.equal(proceeded, true);
  let result;
  await route.stack[2].handle(req, { json: body => { result = body; } }, error => assert.ifError(error));
  assert.equal(result.structured.processing.method, 'local');
  assert.match(result.structured.content.output, /18%/);
});

test('SDK sends only one HTTP request when the provider returns 429', async t => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousMode = process.env.VERTEX_AI_AUTH_MODE;
  process.env.GEMINI_API_KEY = 'test-import-key';
  process.env.VERTEX_AI_AUTH_MODE = 'api_key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousMode === undefined) delete process.env.VERTEX_AI_AUTH_MODE;
    else process.env.VERTEX_AI_AUTH_MODE = previousMode;
  });
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(JSON.stringify({ error: { code: 429, message: 'test quota exceeded', status: 'RESOURCE_EXHAUSTED' } }), {
      status: 429, headers: { 'content-type': 'application/json' },
    });
  });
  await assert.rejects(generateImportOnce('test outline', SEGMENT_CONFIG));
  assert.equal(requests, 1);
});

test('AI selects boundaries once; all fields and full source come from the document', async () => {
  let calls = 0;
  const result = await segmentExperiencesWithAI(DOCUMENT, async prompt => {
    calls++;
    assert.match(prompt, /4: 학생들을/);
    return JSON.stringify({ ranges: [{ start: 1, end: 2 }, { start: 3, end: 4 }], title: '지어낸 제목', result: '매출 100억' });
  });
  assert.equal(calls, 1);
  assert.equal(result.experiences.length, 2);
  assert.match(result.experiences[0].result, /18%/);
  assert.match(result.experiences[1].sourceText, /1,200명/);
  assert.doesNotMatch(JSON.stringify(result), /지어낸|100억/);
  assert.equal(SEGMENT_CONFIG.httpOptions.retryOptions.attempts, 1);
  assert.equal(SEGMENT_CONFIG.thinkingConfig.thinkingBudget, 0);
});

test('long body lines are compacted for AI but restored in the result', async () => {
  const body = '사용자 의견을 반영해 화면을 개선했습니다. '.repeat(50) + '완료율 18% 상승.';
  const result = await segmentExperiencesWithAI(`예약 개선\n${body}`, async prompt => {
    assert.ok(prompt.length < body.length);
    return '{"ranges":[{"start":1,"end":2}]}';
  });
  assert.ok(result.experiences[0].sourceText.includes(body));
});

test('oversized outlines and single-line documents do not trigger paid calls', async () => {
  const generate = async () => { assert.fail('AI must not be called'); };
  assert.equal(await segmentExperiencesWithAI('본문', generate), null);
  const huge = Array.from({ length: SEGMENT_INPUT_LIMIT / 100 }, () => '본문 '.repeat(80)).join('\n');
  assert.equal(await segmentExperiencesWithAI(huge, generate), null);
});

for (const ranges of [
  [{ start: 0, end: 2 }], [{ start: 1, end: 99 }], [{ start: 1, end: 1 }],
  [{ start: 1, end: 3 }, { start: 3, end: 4 }], [{ start: '1', end: 2 }], [null], [],
]) {
  test(`invalid or overlapping ranges are rejected: ${JSON.stringify(ranges)}`, async () => {
    assert.equal(await segmentExperiencesWithAI(DOCUMENT, async () => JSON.stringify({ ranges })), null);
  });
}

for (const status of [402, 429, 503, 'GEMINI_TIMEOUT', 'INVALID_JSON']) {
  test(`automatic import keeps a reviewable draft after ${status}, with no retry`, async () => {
    let calls = 0;
    const result = await structureImportedContent({ title: '이력서', content: DOCUMENT }, 'resume', {
      segment: text => segmentExperiencesWithAI(text, async () => {
        calls++;
        if (status === 'INVALID_JSON') return 'invalid';
        throw Object.assign(new Error(String(status)), { status });
      }),
    });
    assert.equal(calls, 1);
    assert.ok(result.processing.warning);
    assert.equal(result.processing.method, 'local');
    assert.match(result.experiences[0].sourceText, /예약 개선/);
    assert.match(result.experiences[0].sourceText, /중고거래/);
  });
}

test('education-only documents are empty without AI and normal experience import is free', async () => {
  const options = { segment: async () => { assert.fail('AI must not be called'); } };
  const empty = await structureImportedContent({ content: '학력\n새봄대학교 2020.03 ~ 2025.02\n경영정보학과 학사' }, 'resume', options);
  assert.deepEqual(empty.experiences, []);
  const draft = await structureImportedContent({ content: DOCUMENT, title: '자료' }, 'experience', options);
  assert.equal(draft.processing.method, 'local');
  assert.match(draft.content.output, /18%/);
});

test('both sample PDFs extract and structure locally without an AI request', async () => {
  for (const [name, count] of [['example-resume.pdf', 5], ['sample-project.pdf', 1]]) {
    const buffer = await readFile(new URL(`../../../frontend/public/motion/${name}`, import.meta.url));
    const imported = await importFromFile(buffer, 'application/pdf', name);
    let calls = 0;
    const result = await structureImportedContent(imported, 'resume', { segment: async () => { calls++; return null; } });
    assert.equal(calls, 0, name);
    assert.equal(result.experiences.length, count, name);
    assert.ok(result.experiences.every(exp => exp.sourceText.length > 20));
  }
});
