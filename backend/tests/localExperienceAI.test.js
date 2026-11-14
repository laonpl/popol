import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDiscoverInput, discoverLocalExperiences, sanitizeOrganizeInput, organizeLocalExperience, assignLocalImages } from '../src/services/localExperienceAI.js';

const parse = value => JSON.parse(value);
const documents = [
  { id: 'resume', path: '다운로드/김유신_이력서.hwpx', text: 'FitPoly 3명 (기획 1, 개발 2) 2차 베타 성공 기준 설계\n디지털 트윈 기반 시뮬레이션으로 OPEX 40% 절감 설계' },
  { id: 'plan', path: '바탕화면/FitPoly/기획서.pptx', imageCount: 4, text: 'FitPoly 기획서\n취준생의 포트폴리오 제작 부담을 줄이기 위해 경험 추출 서비스를 기획했다.' },
  { id: 'lecture', path: '문서/강의자료.pdf', text: '마케팅 원론 3주차 강의 자료' },
];

test('discovery maps document keys back to ids, keeps excluded references and drops unknown documents', async () => {
  const prompts = [];
  const generate = async (prompt, options) => {
    prompts.push({ prompt, options });
    return JSON.stringify({
      experiences: [
        { title: 'FitPoly — 경험 정리 서비스 기획', documents: ['D1', 'D2', 'D9'], primary: 'D2', anchors: ['FitPoly'], strength: 5, summary: '서비스 기획' },
        { title: '디지털 트윈 융설 시뮬레이션', documents: ['D1'], strength: 3 },
        { title: '', documents: ['D2'] },
      ],
      excluded: [{ document: 'D3', reason: '강의 자료' }, { document: 'D1', reason: '잘못된 제외' }],
    });
  };
  const result = await discoverLocalExperiences(sanitizeDiscoverInput({ documents }), { generate, parse });
  assert.equal(prompts.length, 1, 'one batch is grouped by the discovery call itself');
  assert.equal(prompts[0].options.tier, 'standard');
  assert.match(prompts[0].prompt, /\[D2\] 파일: 바탕화면\/FitPoly\/기획서\.pptx · 문서 속 이미지 4장/);
  assert.deepEqual(result.experiences.map(row => [row.title, row.documentIds, row.primaryDocumentId]), [
    ['FitPoly — 경험 정리 서비스 기획', ['plan', 'resume'], 'plan'],
    ['디지털 트윈 융설 시뮬레이션', ['resume'], 'resume'],
  ]);
  assert.deepEqual(result.excluded, [{ documentId: 'lecture', reason: '강의 자료' }]);
});

test('a document that never names the project is not kept as its source', async () => {
  const input = sanitizeDiscoverInput({ documents: [
    { id: 'resume', path: '이력서.pdf', text: 'Fit Poly 가천대 창업경진대회 참가\nSolarTech 수상태양광 발전량 예측' },
    { id: 'solar', path: 'SolarTech_가천대_창업경진대회.hwpx', text: '가천대 창업경진대회 신청서. SolarTech는 수상태양광 발전량을 예측한다.' },
  ] });
  const generate = async () => JSON.stringify({ experiences: [
    { title: 'FitPoly — 경험 정리 서비스 기획', documents: ['D1', 'D2'], primary: 'D2' },
    { title: '이름이 원문에 없는 경험 — 발전량 예측', documents: ['D1', 'D2'], primary: 'D2' },
  ] });
  const result = await discoverLocalExperiences(input, { generate, parse });
  assert.deepEqual(result.experiences.map(row => [row.documentIds, row.primaryDocumentId]), [[['resume'], 'resume'], [['solar', 'resume'], 'solar']]);
});

test('consolidation attaches a new finding to an earlier experience and merges duplicates across batches', async () => {
  const big = 'FitPoly 회고 '.repeat(4000);
  const input = sanitizeDiscoverInput({
    documents: [{ id: 'a', path: 'a.md', text: big }, { id: 'b', path: 'b.md', text: big }, { id: 'c', path: 'c.md', text: big }, { id: 'd', path: 'd.md', text: big }, { id: 'e', path: 'e.md', text: big }, { id: 'f', path: 'f.md', text: big }],
    known: [{ id: 'saved-card', title: 'FitPoly', summary: '경험 정리 서비스' }],
  });
  const generate = async (prompt, options) => {
    if (options.tier === 'fast') {
      assert.match(prompt, /K1: FitPoly/);
      return JSON.stringify({ groups: [['K1', 'N1'], ['N2', 'N3', 'K9'], ['N1', 'N4']] });
    }
    const keys = [...prompt.matchAll(/\[(D\d+)\] 파일/g)].map(match => match[1]);
    return JSON.stringify({ experiences: keys.map(key => ({ title: `경험 ${key}`, documents: [key], strength: Number(key.slice(1)) })) });
  };
  const result = await discoverLocalExperiences(input, { generate, parse });
  assert.deepEqual(result.updates, [{ id: 'saved-card', documentIds: ['a'], anchors: [] }]);
  const merged = result.experiences.find(row => row.documentIds.length === 2);
  assert.deepEqual(merged.documentIds.sort(), ['b', 'c']);
  assert.equal(result.experiences.length, 4, 'N1 is used once, N4 stays separate');
});

test('discovery fails only when every batch fails, and the consolidation failure keeps findings separate', async () => {
  await assert.rejects(discoverLocalExperiences(sanitizeDiscoverInput({ documents }), {
    generate: async () => { throw Object.assign(new Error('limit'), { status: 429 }); }, parse,
  }), /limit/);
  const result = await discoverLocalExperiences(sanitizeDiscoverInput({ documents, known: [{ id: 'saved-card', title: 'C 프로젝트' }] }), {
    generate: async (_prompt, options) => {
      if (options.tier === 'fast') throw new Error('consolidation down');
      return JSON.stringify({ experiences: [{ title: 'A 프로젝트', documents: ['D1'] }, { title: 'B 프로젝트', documents: ['D2'] }] });
    }, parse,
  });
  assert.equal(result.experiences.length, 2);
});

test('long documents are shortened for discovery, except résumés that list many experiences', async () => {
  const long = '가나다라마바사아자차'.repeat(1000);
  let prompt;
  await discoverLocalExperiences(sanitizeDiscoverInput({ documents: [{ id: 'a', path: '기획서.md', text: long }, { id: 'b', path: '이력서.md', text: long }] }),
    { parse, generate: async value => { prompt = value; return '{"experiences":[{"title":"A","documents":["D1"]}]}'; } });
  const [, plan, resume] = prompt.split(/\[D\d\] 파일/);
  assert.ok(plan.length < 3200 && resume.length > 7000 && resume.length < 7600);
});

test('organize reads pictures and originals in one call and fills STAR with image findings', async () => {
  const calls = [];
  const generate = async (prompt, options) => {
    calls.push({ prompt, options });
    return JSON.stringify({ title: 'FitPoly — 경험 정리 서비스', role: '3인 팀 · 기획', situation: '취준생이 포트폴리오에 40시간을 썼다.',
      task: '경험 정리 시간을 줄여야 했다.', action: ['- 사용자 인터뷰 12회 진행', '2. 업로드 흐름 설계'], result: ['가입 전환율 12% → 30%'],
      keywords: ['인터뷰'], category: '없는 분류', missing: ['learning', 'role'],
      images: [
        { id: 'I1', kind: 'result', relevance: 'core', description: '가입 전환율 그래프', text: '12% → 30%', caption: '전환율 변화' },
        { id: 'I2', kind: 'decoration', relevance: 'none', description: '로고' },
      ] });
  };
  const input = sanitizeOrganizeInput({
    experience: { title: 'FitPoly', anchors: ['FitPoly'] },
    documents: [{ id: 'plan', path: '기획서.pptx', text: 'FitPoly 기획서 본문' }],
    images: [
      { id: 'plan#1', path: '기획서.pptx', context: '슬라이드 5', mimeType: 'image/jpeg', data: 'QUJD' },
      { id: 'plan#2', path: '기획서.pptx', mimeType: 'image/jpeg', data: 'REVG' },
      { id: 'bad', path: 'x', mimeType: 'image/svg+xml', data: 'PHN2Zz4=' },
    ],
  });
  assert.equal(input.images.length, 2, 'only raster images are forwarded');
  const result = await organizeLocalExperience(input, { generate, parse });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.tier, 'vision');
  assert.deepEqual(calls[0].prompt.filter(part => part.inlineData).map(part => part.inlineData.data), ['QUJD', 'REVG']);
  assert.match(calls[0].prompt.at(-1), /FitPoly 기획서 본문[\s\S]*## 첨부 이미지 \(I1, I2\)[\s\S]*"images"/);
  assert.equal(result.experience.action, '• 사용자 인터뷰 12회 진행\n• 업로드 흐름 설계');
  assert.equal(result.experience.context, '취준생이 포트폴리오에 40시간을 썼다.');
  assert.equal(result.experience.category, '기타');
  assert.deepEqual(result.experience.missing, ['role']);
  assert.deepEqual(result.images.map(image => [image.id, image.relevance, image.caption]), [['plan#1', 'core', '전환율 변화'], ['plan#2', 'none', '']]);
});

test('organize uses the standard tier without pictures, falls back to text when pictures fail and rejects an empty STAR', async () => {
  const input = sanitizeOrganizeInput({ experience: { title: 'A' }, documents: [{ id: 'a', path: 'a.md', text: '본문' }],
    images: [{ id: 'i', mimeType: 'image/png', data: 'QUJD' }] });
  const tiers = [];
  const result = await organizeLocalExperience(input, { parse, generate: async (prompt, options) => {
    tiers.push(options.tier);
    if (options.tier === 'vision') throw new Error('vision down');
    assert.doesNotMatch(prompt, /첨부 이미지|"images"/);
    return JSON.stringify({ situation: '상황', action: ['행동'] });
  } });
  assert.deepEqual(tiers, ['vision', 'standard']);
  assert.equal(result.imageFailed, true);
  assert.deepEqual(result.images, []);
  await assert.rejects(organizeLocalExperience({ ...input, images: [] }, { parse, generate: async () => '{"title":"A"}' }), error => error.code === 'AI_EMPTY_EXPERIENCES');
});

test('organize reports files about another project by path, unless that would remove every file', async () => {
  const input = sanitizeOrganizeInput({ experience: { title: 'FitPoly' }, documents: [{ path: '이력서.pdf', text: 'FitPoly 기획' }, { path: '제안서.pdf', text: '수상태양광 예측' }] });
  let prompt;
  const ask = unrelated => organizeLocalExperience(input, { parse, generate: async value => { prompt = value; return JSON.stringify({ situation: '상황', unrelated }); } });
  assert.deepEqual((await ask(['F2', 'F9', 'F2'])).unrelated, ['제안서.pdf']);
  assert.match(prompt, /--- F2 · 파일: 제안서\.pdf ---/);
  assert.deepEqual((await ask(['F1', 'F2'])).unrelated, []);
  assert.deepEqual((await ask(undefined)).unrelated, []);
});

test('a long résumé is cut down to the parts about this experience; a dedicated document keeps head and tail', async () => {
  const filler = name => Array.from({ length: 120 }, (_, index) => `${name} 프로젝트 설명 ${index}번째 줄입니다. `.repeat(8)).join('\n');
  const resume = [filler('알파'), 'FitPoly 서비스 기획\n핵심문장: 인터뷰로 문제를 정의했다.', filler('베타')].join('\n');
  const prompts = [];
  const generate = async prompt => { prompts.push(prompt); return JSON.stringify({ situation: '상황' }); };
  await organizeLocalExperience(sanitizeOrganizeInput({ experience: { title: 'FitPoly — 서비스 기획', anchors: [] }, documents: [{ id: 'r', path: '이력서.md', text: resume }] }), { generate, parse });
  assert.match(prompts[0], /핵심문장: 인터뷰로 문제를 정의했다\./);
  assert.ok(prompts[0].length < 9000, 'unrelated projects are left out');
  await organizeLocalExperience(sanitizeOrganizeInput({ experience: { title: '알파', anchors: [] }, documents: [{ id: 'r', path: '보고서.md', text: `${filler('알파')}\n맺음말` }] }), { generate, parse });
  assert.match(prompts[1], /알파 프로젝트 설명 0번째[\s\S]*자료 중간 생략[\s\S]*맺음말/);
});

test('local images are spread across key experiences without exceeding the per-experience limit', () => {
  const images = Array.from({ length: 5 }, (_, index) => ({ url: `u${index}`, caption: '무관한 사진', localImage: true }));
  const placed = assignLocalImages([{ title: 'A' }, { title: 'B' }], [...images, { url: 'manual' }], 2);
  assert.deepEqual(Object.fromEntries(Object.entries(placed).map(([key, rows]) => [key, rows.map(row => row.url)])), { 0: ['u0', 'u2'], 1: ['u1', 'u3'] });
  assert.deepEqual(assignLocalImages([], images), {});
});
