import test from 'node:test';
import assert from 'node:assert/strict';
import { notionPageId, fetchNotionPlanning } from './rolePlanningConnection.js';
import { planningSummary, planningTableMetrics } from '../../../shared/rolePlanning.mjs';
const id = '01234567-89ab-cdef-0123-456789abcdef', url = `https://workspace.notion.site/Planning-${id.replaceAll('-', '')}`;
const rt = text => [{ plain_text: text }];
test('Notion IDs are parsed only from HTTPS Notion page URLs, not arbitrary hosts or query parameters', () => {
  assert.equal(notionPageId(url), id);
  for (const input of [`https://evil.test/${id}`, `https://notion.site.evil.test/${id}`, `https://u:p@www.notion.so/${id}`, 'https://www.notion.so/page?x=0123456789abcdef0123456789abcdef']) assert.throws(() => notionPageId(input));
});
test('official token connection reads ordered text and nested tables without returning credentials', async () => {
  const requests = [];
  const document = await fetchNotionPlanning(url, { token: 'synthetic-test-token', fetchImpl: async (url, options) => {
    requests.push(url); assert.equal(options.headers.Authorization, 'Bearer synthetic-test-token'); assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    if (url.includes('/v1/pages/')) return Response.json({ properties: { Name: { type: 'title', title: rt('작성 경로 기획서') } } });
    if (url.includes('/blocks/table/')) return Response.json({ results: [{ id: 'tr1', type: 'table_row', table_row: { cells: ['지표', '기준', '실측', '목표', '단위'].map(rt) } }, { id: 'tr2', type: 'table_row', table_row: { cells: ['완료율', '38', '51', '60', '%'].map(rt) } }] });
    return Response.json({ results: [{ id: 'h', type: 'heading_2', heading_2: { rich_text: rt('문제 정의') } }, { id: 'p', type: 'paragraph', paragraph: { rich_text: rt('첫 사용자가 작성 위치를 찾지 못했다.') } }, { id: 'table', type: 'table', has_children: true, table: {} }] });
  } });
  assert.equal(requests.length, 3); assert.equal(document.title, '작성 경로 기획서'); assert.equal(document.sections[0].text, '문제 정의');
  assert.equal(JSON.stringify(document).includes('synthetic-test-token'), false);
  assert.equal(planningSummary(document).problem, '첫 사용자가 작성 위치를 찾지 못했다.');
  assert.equal(planningTableMetrics(document)[0].snapshot.metrics[0].actual, '51%');
});
test('public connections use known Notion hosts and only traverse the requested page, never unrelated records', async () => {
  const blocks = { [id]: { value: { type: 'page', properties: { title: [['공개 기획서']] }, content: ['h', 'p'] } }, h: { value: { type: 'header', properties: { title: [['회고']] } } }, p: { value: { type: 'text', properties: { title: [['다음 검증은 첫 화면 예시 제공이다.']] } } }, unrelated: { value: { type: 'text', properties: { title: [['다른 프로젝트의 비공개 내용']] } } } };
  const document = await fetchNotionPlanning(url, { fetchImpl: async url => { assert.equal(url, 'https://www.notion.so/api/v3/getPublicPageData'); return Response.json({ recordMap: { block: blocks } }); } });
  assert.equal(document.sections.length, 2); assert.equal(JSON.stringify(document).includes('비공개 내용'), false); assert.equal(document.access, 'public');
  const nested = Object.fromEntries(Object.entries(blocks).map(([id, row]) => [id, { value: { value: row.value, role: 'reader' } }]));
  const updated = await fetchNotionPlanning(url, { fetchImpl: async () => Response.json({ recordMap: { block: nested } }) });
  assert.deepEqual(updated.sections, document.sections);
});
test('section mapping preserves source text and does not turn priority/status tables into business KPIs', () => {
  const document = { sections: [{ type: 'heading', text: '내 역할' }, { type: 'text', text: '정책과 인수 기준을 직접 작성했다.' }, { type: 'heading', text: '기타' }, { type: 'text', text: '삼성 합격이라는 표현을 생성하지 않는다.' }], tables: [[['기능', '우선순위'], ['검색', '1']]] };
  assert.deepEqual(planningSummary(document), { myRole: '정책과 인수 기준을 직접 작성했다.' }); assert.deepEqual(planningTableMetrics(document), []);
});
