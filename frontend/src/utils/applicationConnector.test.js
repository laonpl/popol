import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICATION_CONNECTION_TTL, connectionTarget, newApplicationConnection, validateApplicationCapture, mergeApplicationQuestions, loadConnectorConfig, sendConnectorMessage } from './applicationConnector.js';

const now = Date.parse('2026-10-08T02:00:00Z');
const target = { expectedOrigin: 'https://recruit.sfa.co.kr' };
const connection = newApplicationConnection(target, { company: 'SFA반도체', position: '제조 Operator' }, now, () => '12345678-1234-1234-1234-123456789012');
const capture = { version: 1, sourceUrl: 'https://recruit.sfa.co.kr/apply/resume?rnId=1537&token=secret#private', capturedAt: new Date(now).toISOString(),
  questions: [{ question: '지원동기', sourceQuote: '지원동기 (최대 500자)', maxLength: 500, minLength: null, countSpaces: true }] };

test('connection uses the analyzed role final form and requires a multi-role choice', () => {
  const analysis = { applicationUrl: 'https://recruit.sfa.co.kr/apply/resume?rnId=1537', selectedApplicationUrl: 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537', applicationLinks: [{ url: 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537' }, { url: 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1539' }] };
  assert.throws(() => connectionTarget(analysis), /직무/);
  assert.equal(connectionTarget(analysis, analysis.selectedApplicationUrl).url, analysis.applicationUrl);
  assert.equal(connectionTarget(analysis, analysis.applicationLinks[1].url).url, analysis.applicationLinks[1].url);
  assert.throws(() => connectionTarget({ applicationUrl: 'https://user:pass@example.com/apply' }), /HTTPS/);
});

test('fresh capture keeps only question metadata and strips session-bearing URL parameters', () => {
  const result = validateApplicationCapture({ ...capture, password: 'never retain', cookies: 'never retain', questions: capture.questions.map(item => ({ ...item, answer: 'never retain', email: 'never retain' })) }, connection, now);
  assert.equal(connection.nonce.length, 32);
  assert.equal(result.sourceUrl, 'https://recruit.sfa.co.kr/apply/resume?rnId=1537');
  assert.deepEqual(Object.keys(result.questions[0]).sort(), ['countSpaces', 'maxLength', 'minLength', 'question', 'sourceQuote']);
  assert.equal(JSON.stringify(result).includes('never retain'), false);
});

test('another origin, stale capture, expired connection, malformed proof and limits are refused', () => {
  assert.throws(() => validateApplicationCapture({ ...capture, sourceUrl: 'https://unrelated.example.com/apply' }, connection, now), /공식/);
  assert.throws(() => validateApplicationCapture({ ...capture, sourceUrl: 'https://recruit.sfa.co.kr/apply/resume?rnId=1539' }, { ...connection, targetUrl: 'https://recruit.sfa.co.kr/sfasemicon/recruit?id=1537' }, now), /다른 지원서/);
  assert.throws(() => validateApplicationCapture(capture, connection, now + APPLICATION_CONNECTION_TTL), /시간/);
  assert.throws(() => validateApplicationCapture({ ...capture, capturedAt: new Date(now - 120000).toISOString() }, connection, now), /이전/);
  assert.throws(() => validateApplicationCapture({ ...capture, questions: [{ ...capture.questions[0], sourceQuote: '다른 문구' }] }, connection, now), /원문/);
  assert.throws(() => validateApplicationCapture({ ...capture, questions: [{ ...capture.questions[0], maxLength: 10001 }] }, connection, now), /원문/);
});

test('import merges the same prompt without losing written answers or linked experiences', () => {
  const existing = [{ id: 'old', question: '지원 동기', answer: '직접 작성한 답변', linkedExperienceIds: ['my-exp'], source: 'manual', validation: 'manual', maxLength: 300 },
    { id: 'empty', question: '', answer: '', source: 'manual' }, { id: 'recovery', question: '반도체 설비 Operation 업무 수행 가능자', answer: '기존 보관 답변', source: 'posting', validation: 'unverified' }];
  const incoming = [{ id: 'q1', ...capture.questions[0], source: 'posting', validation: 'verified' }, { id: 'old', question: '팀과 협업한 경험을 작성해주세요.', sourceQuote: '팀과 협업한 경험을 작성해주세요.', source: 'posting', validation: 'verified' }];
  const result = mergeApplicationQuestions(existing, incoming);
  assert.equal(result.questions.length, 3);
  assert.equal(result.questions[0].answer, '직접 작성한 답변');
  assert.deepEqual(result.questions[0].linkedExperienceIds, ['my-exp']);
  assert.equal(result.questions[0].maxLength, 500);
  assert.equal(result.questions[1].answer, '기존 보관 답변');
  assert.equal(result.importedIds[0], 'old');
  assert.notEqual(result.importedIds[1], 'old');
  assert.equal(existing[0].maxLength, 300);
});

test('a full draft is not mutated when imported prompts exceed twelve', () => {
  const existing = Array.from({ length: 12 }, (_, index) => ({ id: `old-${index}`, question: `직접 작성한 문항 ${index}`, answer: `답변 ${index}`, source: 'manual' }));
  const before = JSON.stringify(existing);
  assert.throws(() => mergeApplicationQuestions(existing, [{ question: '지원동기', source: 'posting' }]), /12개/);
  assert.equal(JSON.stringify(existing), before);
});

test('connector configuration cannot replace the downloadable tool or extension ID', async () => {
  await assert.rejects(loadConnectorConfig(async () => ({ ok: true, json: async () => ({ extensionId: 'ficfdhlefepmnpmaebbneljgopoelani', downloadUrl: 'https://bad.example/tool.zip' }) })), /설정/);
  await assert.rejects(loadConnectorConfig(async () => ({ ok: false })), /불러오/);
});

test('missing extension and extension failures are recoverable rather than successful connections', async () => {
  await assert.rejects(sendConnectorMessage('id', {}, {}), /설치/);
  await assert.rejects(sendConnectorMessage('id', {}, { sendMessage: (_id, _message, callback) => callback({ status: 'error', error: '등록 화면을 열어주세요.' }) }), /등록/);
  assert.deepEqual(await sendConnectorMessage('id', {}, { sendMessage: (_id, _message, callback) => callback({ status: 'waiting' }) }), { status: 'waiting' });
});
