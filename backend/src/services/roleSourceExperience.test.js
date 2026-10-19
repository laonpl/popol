import test from 'node:test';
import assert from 'node:assert/strict';
import { figmaFileReference, figmaDocumentFromTree, fetchFigmaSource } from './figmaSourceConnection.js';
import { readFigmaRenderText, summarizeRoleSources } from './roleSourceExperience.js';
import { experienceText, sourceSummaryForPage, collectExperienceDocuments } from '../../../shared/sourceExperience.mjs';
import { roleAnalysisContent, preserveRolePresentation } from '../utils/roleMaterials.js';
const url = 'https://www.figma.com/slides/SyntheticFile/Planning?node-id=1-85';
const document = { type: 'figma', title: 'MVP 고객 검증', url, sections: [{ id: 'h', type: 'heading', text: '문제 정의', frameId: 'slide1' }, { id: 'p', type: 'text', text: '고객은 여러 도구에 흩어진 경험을 다시 모으는 데 어려움을 겪었다.', frameId: 'slide1' }, { id: 'h2', type: 'heading', text: '가설 검증', frameId: 'slide2' }, { id: 'p2', type: 'text', text: '가입 전환율 28.4%(111명 중 39 가입)\n사전예약 51.8%(47명 중 24명 예약)\nMVP 배포 상태이고 39명 중 재접속자 11명', frameId: 'slide2' }, { id: 'market', type: 'heading', text: '경쟁 시장', frameId: 'slide3' }, { id: 'comp', type: 'text', text: '경쟁사 사이트는 1분 안에 포트폴리오를 만든다.', frameId: 'slide3' }], tables: [] };
test('Figma source reader validates Slides URLs and traverses visible internal text instead of iframe markup', () => {
  assert.equal(figmaFileReference(url).key, 'SyntheticFile'); assert.equal(figmaFileReference(url).nodeId, '1:85');
  assert.throws(() => figmaFileReference('https://figma.com.evil.test/slides/x'));
  const file = { name: '중간 발표', document: { type: 'DOCUMENT', children: [{ type: 'SLIDE', id: 'slide', name: '검증', children: [{ type: 'TEXT', id: 'text', characters: '가설 검증', style: { fontSize: 96 } }, { type: 'FRAME', id: 'nested', children: [{ type: 'RECTANGLE', fills: [{ type: 'IMAGE' }] }] }, { type: 'TEXT', id: 'hidden', visible: false, characters: '숨긴 내용' }] }] } };
  const result = figmaDocumentFromTree(file, { url, key: 'SyntheticFile' });
  assert.equal(result.sections.length, 1); assert.equal(result.sections[0].text, '가설 검증'); assert.deepEqual(result.imageNodeIds, ['slide']); assert.equal(result.slideCount, 1);
});
test('Figma reader sends a transient token only to official endpoints and never returns it', async () => {
  await assert.rejects(fetchFigmaSource(url), /파일 읽기 토큰/);
  const result = await fetchFigmaSource(url, { token: 'test-secret', fetchImpl: async (url, options) => { assert.equal(url, 'https://api.figma.com/v1/files/SyntheticFile'); assert.equal(options.headers['X-Figma-Token'], 'test-secret'); assert.equal(options.redirect, 'error'); return Response.json({ name: '기획서', document: { type: 'DOCUMENT', children: [{ type: 'TEXT', id: 'p', characters: '신규 고객의 첫 구매 흐름을 검증했다.' }] } }); } });
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});
test('large Figma files keep a bounded source snapshot that can be saved with an experience', () => {
  const result = figmaDocumentFromTree({ document: { type: 'DOCUMENT', children: Array.from({ length: 100 }, (_, i) => ({ type: 'TEXT', id: String(i), characters: 'x'.repeat(4000) })) } }, { url, key: 'SyntheticFile' });
  assert.equal(result.sections.reduce((size, section) => size + section.text.length, 0), 60000);
  assert.equal(result.truncated, true);
});
test('images inside Figma are read as source text, using bounded trusted image hosts', async () => {
  let fetched = 0, generated = 0;
  const result = await readFigmaRenderText({ ...document, renders: [{ id: 'chart', url: 'https://s3-alpha.figma.com/chart.png' }, { id: 'private', url: 'http://127.0.0.1/private' }] }, {
    fetchImpl: async () => { fetched++; return new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/png' } }); }, generate: async parts => { generated++; assert.ok(parts.some(part => part.inlineData)); return JSON.stringify({ pages: [{ id: 'chart', text: '릴스 조회 수 2.6만+ · 댓글 수 300+' }] }); } });
  assert.equal(fetched, 1); assert.equal(generated, 1); assert.match(result.sections.at(-1).text, /2.6만/); assert.equal(result.renders, undefined);
});
test('source-based drafting preserves reported values, omits invented/competitor metrics, and emits an actual story', async () => {
  const result = await summarizeRoleSources([document], { role: 'marketer', generate: async prompt => { assert.match(prompt, /자료에 없는 경험/); assert.match(prompt, /여러 도구에 흩어진 경험/); return JSON.stringify({ headline: '인터뷰와 MVP로 고객 수요를 검증', problem: '파편화된 경험을 다시 모으는 고객의 어려움을 발견했다.', action: 'MVP를 배포하고 가입과 재접속을 관찰했다.', result: '가입과 사전예약에서 서비스 수요를 확인했다.', learning: '인사이트, trade-off, 다음 적용점을 보강해 주세요.', process: [{ title: '인터뷰', description: '경험 재수집 문제 확인' }, { title: 'MVP 검증', description: '가입과 재접속 관찰' }], metrics: [{ name: '가입 전환율', actual: '28.4%', quote: document.sections[3].text, sourceIndex: 0 }, { name: '가입자', actual: '39명', quote: '가입 전환율 28.4%(111명 중 39 가입)', sourceIndex: 0 }, { name: '매출', actual: '9000원', quote: document.sections[3].text, sourceIndex: 0 }, { name: '제작 시간', actual: '1분', quote: document.sections[5].text, sourceIndex: 0 }] }); } });
  assert.equal(result.summary.process.length, 2); assert.equal(result.summary.learning, ''); assert.equal(result.metrics[0].actual, '28.4%'); assert.equal(result.metrics[1].actual, '39명'); assert.equal(result.metrics.length, 2);
});
test('AI unavailable preserves real source excerpts without producing filler or stopping for absent metrics', async () => {
  const result = await summarizeRoleSources([document], { generate: async () => { throw new Error('503'); } });
  assert.equal(result.processing.method, 'source_excerpt'); assert.match(result.summary.problem, /여러 도구/); assert.doesNotMatch(JSON.stringify(result), /보강해 주세요/); assert.deepEqual(result.metrics, []);
});
test('legacy guidance is not experience content, while real written experience remains readable', () => {
  assert.equal(experienceText('실행한 행동과 의사결정 과정을 보강해 주세요.\n측정 가능한 결과나 산출물을 보강해 주세요.'), '');
  const result = sourceSummaryForPage({ records: [] }, { context: '실행한 행동과 의사결정 과정을 보강해 주세요.', roleSummary: { problem: '고객 인터뷰에서 첫 구매의 장벽을 발견했다.' } });
  assert.equal(result.problem, '고객 인터뷰에서 첫 구매의 장벽을 발견했다.'); assert.equal(result.action, '');
});
test('connected internal sources survive reanalysis and feed the same source collection used by later experience analysis', () => {
  const previous = { jobCategory: 'pm', keyExperiences: [{ id: 'case', title: '검증', figmaConnection: document, sourceDocuments: [{ type: 'file', title: '검증 PDF', sections: [{ id: 'a', type: 'text', text: '가입 결과를 관찰했다.' }] }] }] };
  const next = preserveRolePresentation({ jobCategory: 'pm', keyExperiences: [{ id: 'case', title: '검증' }] }, previous);
  assert.deepEqual(next.keyExperiences[0].figmaConnection, document); assert.equal(collectExperienceDocuments(next, { sourceIndex: 0 }).length, 2);
  const content = roleAnalysisContent({ jobCategory: 'pm', structuredResult: next }); assert.match(content['연결 기획 자료 원문'], /28.4%/);
});
test('long vault material is split for the analysis endpoint and stays scoped to its linked experience', () => {
  const sr = { keyExperiences: [{ artifactBindings: [{ assetId: 'own' }] }], deliverables: [{ id: 'own', name: '검증 PDF' }, { id: 'other', name: '다른 경험' }], additionalMaterials: [{ assetId: 'own', text: '실제 검증 기록 '.repeat(2000) }, { assetId: 'other', text: '다른 경험의 자료' }] };
  const documents = collectExperienceDocuments(sr, { sourceIndex: 0 });
  assert.equal(documents.length, 1); assert.ok(documents[0].sections.length > 1);
  assert.ok(documents[0].sections.every(section => section.text.length <= 14000));
  assert.equal(documents[0].sections.map(section => section.text).join(''), sr.additionalMaterials[0].text);
});
