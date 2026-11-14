import test from 'node:test';
import assert from 'node:assert/strict';
import { readLocalDocuments, discoverCandidates, organizeCandidate, attachDocuments, imagesForAnalysis, mergeCandidates, splitCandidate, shouldStopOrganizing, cachedRequest, splitSeries, relatedLocalFiles, addDocuments } from './localExperienceAI.js';
import { collapseSeries, sameLook } from './localExperienceFiles.js';
import { buildLocalExperienceDraft, savedLocalImages } from '../utils/localExperienceDraft.js';

const image = (documentId, index) => ({ id: `${documentId}#${index}`, documentId, path: `${documentId}.pptx`, context: `슬라이드 ${index}: 화면`,
  blob: new Blob([Uint8Array.from([65, 66, 67])], { type: 'image/jpeg' }) });
const documents = [
  { id: 'plan', path: '바탕화면/FitPoly/기획서.pptx', paths: ['바탕화면/FitPoly/기획서.pptx'], lastModified: Date.UTC(2026, 4, 2), text: 'FitPoly 기획서 본문', images: [image('plan', 1), image('plan', 2), image('plan', 3)] },
  { id: 'resume', path: '다운로드/이력서.hwpx', paths: ['다운로드/이력서.hwpx'], lastModified: 0, text: 'FitPoly 3명 2차 베타\n디지털 트윈 시뮬레이션', images: [image('resume', 1)] },
];

test('documents are read with their pictures and identical copies collapse into one source', async () => {
  const records = [{ id: 'a', path: 'a.md' }, { id: 'b', path: '복사/a.md' }, { id: 'c', path: 'c.pdf' }, { id: 'd', path: 'd.txt' }];
  const read = async record => {
    if (record.id === 'c') throw new Error('읽을 수 있는 본문이 부족해요.');
    return { text: record.id === 'd' ? '다른 문서' : '같은  본문', images: record.id === 'a' ? [image('a', 1)] : [] };
  };
  const result = await readLocalDocuments(records, { read });
  assert.deepEqual(result.documents.map(document => [document.id, document.paths, document.images.length]), [['a', ['a.md', '복사/a.md'], 1], ['d', ['d.txt'], 0]]);
  assert.deepEqual(result.failures, [{ path: 'c.pdf', message: '읽을 수 있는 본문이 부족해요.' }]);
});

test('discovery sends text and image counts, never picture bytes, and builds cards from the AI grouping', async () => {
  const calls = [];
  const request = async (path, body) => {
    calls.push({ path, body });
    return { experiences: [
      { title: 'FitPoly — 경험 정리 서비스 기획', documentIds: ['1', '2'], primaryDocumentId: '1', strength: 5, summary: '서비스 기획', anchors: ['FitPoly'] },
      { title: '사라진 문서', documentIds: ['9'] },
    ], updates: [{ id: 'old-card', documentIds: ['2'] }], excluded: [{ documentId: '2', reason: '테스트' }], partial: true };
  };
  const result = await discoverCandidates(documents, { request, known: [{ id: 'old-card', title: '이전 경험', core: '핵심' }] });
  assert.equal(calls[0].path, '/experience/local-discover');
  assert.deepEqual(calls[0].body.documents[0], { id: '1', path: '바탕화면/FitPoly/기획서.pptx', modified: '2026-05', imageCount: 3, text: 'FitPoly 기획서 본문' });
  assert.deepEqual(calls[0].body.known, [{ id: 'old-card', title: '이전 경험', summary: '핵심', period: '' }]);
  assert.doesNotMatch(JSON.stringify(calls[0].body), /blob|QUJD/);
  assert.equal(result.items.length, 1);
  const [card] = result.items;
  assert.deepEqual(card.sourcePaths, ['바탕화면/FitPoly/기획서.pptx', '다운로드/이력서.hwpx']);
  assert.equal(card.images.length, 4);
  assert.equal(card.organizeState, 'pending');
  assert.deepEqual(result.updates[0].documents.map(document => document.id), ['resume']);
  assert.deepEqual(result.excluded, [{ path: '다운로드/이력서.hwpx', reason: '테스트' }]);
  assert.equal(result.partial, true);
});

test('organizing sends originals and spread-out pictures, then fills STAR and keeps only relevant pictures', async () => {
  const { items: [card] } = await discoverCandidates(documents, { request: async () => ({ experiences: [{ title: 'FitPoly', documentIds: ['1', '2'], primaryDocumentId: '1', strength: 4 }] }) });
  assert.deepEqual(imagesForAnalysis(card, 3).map(row => row.id), ['plan#1', 'resume#1', 'plan#2']);
  let body;
  const organized = await organizeCandidate({ ...card, localEdits: { role: '직접 쓴 역할' } }, { request: async (path, payload) => {
    body = payload;
    assert.equal(path, '/experience/local-organize');
    return { experience: { title: 'FitPoly — 경험 정리 서비스', role: '3인 팀 · 기획', context: '취준생이 포트폴리오에 40시간을 썼다.', action: '• 인터뷰 12회', result: '• 전환율 12% → 30%', missing: ['task'] },
      images: [
        { id: '1', analyzed: true, kind: 'result', relevance: 'core', caption: '전환율 그래프', description: '전환율 변화' },
        { id: '3', analyzed: true, kind: 'decoration', relevance: 'none', caption: '로고' },
        { id: '2', analyzed: false, relevance: 'none' },
      ] };
  } });
  assert.deepEqual(body.documents.map(document => document.path), ['바탕화면/FitPoly/기획서.pptx', '다운로드/이력서.hwpx']);
  assert.deepEqual(body.images[0], { id: '1', path: 'plan.pptx', context: '슬라이드 1: 화면', mimeType: 'image/jpeg', data: 'QUJD' });
  assert.equal(organized.title, 'FitPoly — 경험 정리 서비스');
  assert.equal(organized.organizeState, 'done');
  assert.deepEqual(organized.localEdits, {});
  assert.equal(organized.needsReview, true);
  assert.deepEqual(organized.images.filter(row => row.include).map(row => row.id), ['plan#1']);
  assert.deepEqual(savedLocalImages(organized).map(row => row.id), ['plan#1']);
});

test('new evidence attaches to an existing card, and merge/split rebuild sources for another AI pass', async () => {
  const { items } = await discoverCandidates(documents, { request: async () => ({ experiences: [
    { title: 'A', documentIds: ['1'], strength: 3 }, { title: 'B', documentIds: ['2'], strength: 5 }] }) });
  const [a, b] = items;
  const attached = attachDocuments(a, [documents[1]], ['FitPoly']);
  assert.deepEqual(attached.documentIds, ['plan', 'resume']);
  assert.equal(attached.hasNewLocalSources, true);
  assert.equal(attachDocuments(attached, [documents[1]]), attached, 'a known document changes nothing');
  const merged = mergeCandidates([a, b]);
  assert.deepEqual(merged.sourcePaths, ['바탕화면/FitPoly/기획서.pptx', '다운로드/이력서.hwpx']);
  assert.equal(merged.strength, 5);
  assert.equal(merged.organizeState, 'pending');
  assert.deepEqual(splitCandidate(merged).map(part => part.id), [a.id, b.id], 'a manual merge returns to its original cards');
  const parts = splitCandidate(attached);
  assert.deepEqual(parts.map(part => [part.documentIds, part.organizeState]), [[['plan'], 'pending'], [['resume'], 'pending']]);
  assert.ok(parts.every(part => part.images.every(row => row.documentId === part.documentIds[0])));
});

test('the same request reuses the stored AI result until a fresh one is asked for; partial results are not kept', async () => {
  const store = new Map();
  const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  let calls = 0;
  const request = cachedRequest(async (_path, body) => { calls += 1; return { calls, partial: body.partial }; }, storage);
  assert.equal((await request('/a', { text: '본문' })).calls, 1);
  assert.equal((await request('/a', { text: '본문' })).calls, 1);
  assert.equal((await request('/a', { text: '다른 본문' })).calls, 2);
  assert.equal((await request('/a', { text: '본문' }, { fresh: true })).calls, 3);
  assert.equal((await request('/a', { text: '본문' })).calls, 3, 'a fresh answer replaces the stored one');
  await request('/b', { partial: true });
  assert.equal((await request('/b', { partial: true })).calls, 5);
  const broken = cachedRequest(async () => ({ ok: true }), { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } });
  assert.deepEqual(await broken('/a', {}), { ok: true });
});

test('numbered reports of one project are found through the newest one and all join the experience', async () => {
  const file = (path, lastModified) => ({ id: path, path, name: path.split('/').at(-1), lastModified });
  const files = [file('브릿지/브릿지_3회차_주간활동보고서_20261008-1014.docx', 3), file('브릿지/기획서.pptx', 9), file('브릿지/브릿지_7회차_주간활동보고서_20261105-1111.docx', 7),
    file('다른폴더/브릿지_1회차_주간활동보고서_20260901-0907.docx', 1), file('브릿지/브릿지_6회차_주간활동보고서_20261029-1104.docx', 6), file('문서/4주 완성 계획.md', 2)];
  const collapsed = collapseSeries(files);
  assert.deepEqual(collapsed.map(row => [row.name.slice(0, 8), (row.series || []).map(member => member.lastModified)]),
    [['브릿지_7회차_', [6, 3]], ['기획서.pptx', []], ['브릿지_1회차_', []], ['4주 완성 계획', []]]);
  const source = id => ({ id, path: id, paths: [id], text: id, images: [] });
  const { leads, followers } = splitSeries(collapsed, files.filter(row => row.lastModified !== 7).map(row => source(row.id)));
  assert.deepEqual(leads.map(row => row.id), [files[4].id, files[1].id, files[3].id, files[5].id], 'an unreadable newest report hands over to the next one');
  let sent;
  const { items: [card] } = await discoverCandidates(leads, { followers, request: async (_path, body) => {
    sent = body.documents.map(row => row.path);
    return { experiences: [{ title: '브릿지', documentIds: ['1', '2'] }] };
  } });
  assert.deepEqual(sent, leads.map(row => row.path), 'only one report of the series is sent to discovery');
  assert.deepEqual(card.documentIds, [files[4].id, files[0].id, files[1].id]);
  assert.deepEqual(imagesForAnalysis({ documentIds: ['uuid-a', 'uuid-b'], images: [{ id: 1, documentId: 'uuid-a', path: 'a.docx' }, { id: 2, documentId: 'uuid-b', path: 'b.pptx' }] }, 1).map(row => row.id), [2]);
});

test('files that carry a found project name join that experience; shared or general names do not', () => {
  const file = path => ({ id: path, path });
  const pool = ['바탕화면/포트폴리오 프로젝트/FitPoly_2026.10_중간발표_v3.pptx', '다운로드/SolarTech_사업계획서_9차_FitPoly식.hwpx', '다운로드/SolarTech 중간발표.pdf',
    '다운로드/fitpolygon 논문.pdf', '바탕화면/Tech For Impact/브릿지_유난_5주차_주간활동보고서.docx', '문서/프로젝트 계획서.docx', ...Array.from({ length: 6 }, (_, index) => `문서/FitPoly/회의록 ${index}.md`)].map(file);
  const items = [{ id: 'fit', title: 'FitPoly — 경험 정리 서비스 기획·개발' }, { id: 'solar', title: 'SolarTech — 수상태양광 발전량 예측' },
    { id: 'bridge', title: '브릿지 — 역할 추리형 토론 수업 서비스' }, { id: 'general', title: '프로젝트 — 팀 과제' }, { id: 'short', title: 'AI — 실습' }];
  const related = relatedLocalFiles(items, pool);
  assert.deepEqual(related.get('fit').map(row => row.path), [pool[0].path, pool[6].path, pool[7].path, pool[8].path], 'at most four, and never a file that also names SolarTech');
  assert.deepEqual(related.get('solar').map(row => row.path), [pool[2].path]);
  assert.deepEqual(related.get('bridge').map(row => row.path), [pool[4].path]);
  assert.equal(related.has('general') || related.has('short'), false);
  const source = (id, text) => ({ id, path: id, paths: [id], text, images: [] });
  const card = addDocuments({ documents: [source('a', '같은 본문')], images: [] }, [source('copy', '같은 본문'), source('b', '새 본문')]);
  assert.deepEqual(card.documentIds, ['a', 'b'], 'a copy of a source already attached adds nothing');
});

test('stored results survive a new scan: requests carry positions, not the scan\'s file ids', async () => {
  const scan = prefix => documents.map(document => ({ ...document, id: `${prefix}-${document.id}`, images: document.images.map(row => ({ ...row, id: `${prefix}-${row.id}`, documentId: `${prefix}-${document.id}` })) }));
  const bodies = [];
  const request = async (path, body) => {
    bodies.push(JSON.stringify(body));
    return path.endsWith('discover') ? { experiences: [{ title: 'FitPoly', documentIds: ['1'] }] } : { experience: { context: '상황' }, images: [{ id: '2', analyzed: true, kind: 'screen', relevance: 'core' }] };
  };
  for (const prefix of ['first', 'second']) {
    const { items: [card] } = await discoverCandidates(scan(prefix), { request });
    const organized = await organizeCandidate(card, { request });
    assert.deepEqual(organized.images.filter(row => row.include).map(row => row.id), [`${prefix}-plan#2`]);
  }
  assert.equal(bodies[0], bodies[2]);
  assert.equal(bodies[1], bodies[3]);
});

test('a picture that looks the same in another file is held once, and other versions of one deck are not read again', async () => {
  const flat = value => Array.from({ length: 256 }, () => value);
  assert.equal(sameLook(flat(100), flat(102)), true);
  assert.equal(sameLook(flat(100), flat(114)), false, 'different slides stay apart');
  assert.equal(sameLook(undefined, flat(100)), false);
  const deck = (id, looks) => ({ id, path: `${id}.pptx`, paths: [`${id}.pptx`], text: id, images: looks.map((look, index) => ({ id: `${id}#${index}`, documentId: id, path: `${id}.pptx`, look: flat(look) })) });
  const card = addDocuments(addDocuments({ documents: [], images: [] }, [deck('v3', [10, 200])]), [deck('v2', [11, 200, 90])]);
  assert.deepEqual(card.images.map(row => row.id), ['v3#0', 'v3#1', 'v2#2']);
  const file = path => ({ id: path, path });
  const pool = ['바탕화면/FitPoly_2026.10_중간발표_v3.pptx', '다운로드/FitPoly_2026.10_중간발표_v3.pptx', '다운로드/FitPoly_2026.10_중간발표_v2.pptx', '다운로드/FitPoly_2026.10_중간발표_v3 (1).pptx', '바탕화면/FitPoly_신청서.pdf'].map(file);
  assert.deepEqual(relatedLocalFiles([{ id: 'fit', title: 'FitPoly — 경험 정리 서비스' }], pool).get('fit').map(row => row.path), [pool[0].path, pool[4].path]);
});

test('files named after the subject of an experience join it with the documents of their own small folder', () => {
  const file = path => ({ id: path, path });
  const pool = ['바탕화면 (C:)/포트폴리오 자료 모음/02 자료/구현_O2_발표자료.pdf', '바탕화면 (C:)/포트폴리오 자료 모음/02 자료/구현트랙_보고서_시각장애인_실내대피_AI내비게이션.pdf',
    '다운로드 (C:)/구현트랙_보고서_시각장애인_실내대피_AI내비게이션 (1).pdf', '다운로드 (C:)/강의계획서.pdf', '바탕화면 (C:)/해커톤/docs/설계서_시각장애인_실내대피_AI내비게이션_v1.1.pdf',
    '바탕화면 (C:)/해커톤/docs/설계서_시각장애인_실내대피_AI내비게이션_v1.1.docx', '문서 (C:)/실내 인테리어 견적.pdf', '문서 (C:)/수업/화재 안전 교육.pdf',
    ...Array.from({ length: 7 }, (_, index) => `문서 (C:)/수업/강의 ${index}.pdf`)].map(file);
  const items = [{ id: 'fire', title: '화재 대피 AI 내비게이션 — 시각장애인용 실내 대피 시스템 개발', anchors: [] },
    { id: 'team', title: '캡스톤 디자인 — 팀 프로젝트', anchors: [], searchTerms: ['강의', '수업'] }];
  const related = relatedLocalFiles(items, pool);
  assert.deepEqual(related.get('fire').map(row => row.path), [pool[1].path, pool[4].path, pool[0].path],
    'the report, the design document once (not its copy or its other format), then the deck beside the report');
  assert.equal(related.get('team').length, 4, 'search words from AI count like title words; one shared word is not enough for 화재 안전 교육');
  assert.ok(related.get('team').every(row => row.path.includes('강의 ')));
});

test('a file AI found to be another project leaves the experience with its pictures', async () => {
  const { items: [card] } = await discoverCandidates(documents, { request: async () => ({ experiences: [{ title: 'FitPoly', documentIds: ['1', '2'] }] }) });
  const answer = unrelated => organizeCandidate(card, { request: async () => ({ experience: { context: '상황' }, unrelated,
    images: [{ id: '1', analyzed: true, kind: 'screen', relevance: 'core' }, { id: '2', analyzed: true, kind: 'document', relevance: 'supporting' }] }) });
  const organized = await answer(['다운로드/이력서.hwpx']);
  assert.deepEqual(organized.sourcePaths, ['바탕화면/FitPoly/기획서.pptx']);
  assert.deepEqual(organized.localDocuments.map(row => row.path), ['바탕화면/FitPoly/기획서.pptx']);
  assert.deepEqual(organized.images.map(row => [row.id, row.include]), [['plan#1', true], ['plan#2', false], ['plan#3', false]]);
  assert.equal((await answer(['바탕화면/FitPoly/기획서.pptx', '다운로드/이력서.hwpx'])).documents.length, 2, 'an answer that removes every file is ignored');
});

test('account and rate limits stop further organizing', () => {
  assert.equal(shouldStopOrganizing({ response: { status: 402, data: { code: 'CREDITS_REQUIRED' } } }), true);
  assert.equal(shouldStopOrganizing({ response: { status: 503, data: { code: 'AI_RATE_LIMIT' } } }), true);
  assert.equal(shouldStopOrganizing({ response: { status: 422, data: { code: 'AI_EMPTY_EXPERIENCES' } } }), false);
});

test('saved drafts carry chosen photos and their AI findings as evidence for role analysis', () => {
  const picture = (id, relevance, kind, include = true) => ({ id, path: `자료/${id}.pptx`, context: '슬라이드 2: 결과', include,
    analysis: { relevance, kind, caption: `${id} 캡션`, description: `${id} 설명`, text: id === 'chart' ? '12% → 30%' : '' } });
  const item = { title: 'FitPoly', action: '• 인터뷰', localDocuments: [{ path: '기획서.pptx', text: '원문' }], sourcePaths: ['기획서.pptx'],
    images: [picture('screen', 'supporting', 'screen'), picture('chart', 'core', 'result'), picture('skip', 'core', 'photo', false), ...Array.from({ length: 6 }, (_, i) => picture(`extra${i}`, 'supporting', 'photo'))] };
  const draft = buildLocalExperienceDraft(item, 'pm', { imageUrls: { chart: 'https://files/chart', screen: 'https://files/screen' } });
  assert.match(draft.content['문서 속 이미지 분석'], /^\[이미지 1 · 성과 · 자료\/chart\.pptx · 슬라이드 2: 결과\] chart 캡션 — chart 설명 \/ 보이는 글자: 12% → 30%/);
  assert.doesNotMatch(draft.content['문서 속 이미지 분석'], /skip/);
  assert.equal(draft.content['문서 속 이미지 분석'].split('\n').length, 6, 'at most six photos are kept');
  assert.deepEqual(draft.images.map(row => [row.url, row.caption, row.localImage]), [['https://files/chart', 'chart 캡션', true], ['https://files/screen', 'screen 캡션', true]]);
  assert.equal(buildLocalExperienceDraft({ ...item, images: [] }).images, undefined);
});
