import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLocalStar } from '../../../shared/localExperienceStar.mjs';
import { organizeLocalFiles } from './localExperienceFiles.js';
import { buildLocalExperienceDraft } from '../utils/localExperienceDraft.js';

test('STAR separates source situation and task, retaining qualitative results without inventing metrics', () => {
  const item = extractLocalStar({ title: '학교 공지 개선', sourceText: '학교 공지 개선\n상황: 학생들이 공지를 놓치고 있었다.\n과제: 중요한 공지를 빠르게 찾도록 해야 했다.\n행동: 검색 필터를 구현했다.\n결과: 팀원들이 찾기 편하다고 답했다.\n배운 점: 작은 화면부터 검증하는 법을 배웠다.' });
  assert.equal(item.context, '학생들이 공지를 놓치고 있었다.');
  assert.equal(item.task, '중요한 공지를 빠르게 찾도록 해야 했다.');
  assert.equal(item.action, '검색 필터를 구현했다.');
  assert.equal(item.result, '팀원들이 찾기 편하다고 답했다.');
  assert.equal(item.framework, 'STAR');
  const draft = buildLocalExperienceDraft(item, 'dev');
  assert.equal(draft.framework, 'STAR');
  assert.equal(draft.structuredResult.star.task, item.task);
  assert.equal(draft.structuredResult.keyExperiences[0].task, item.task);
  assert.match(draft.content.rawInput, /T · 과제/);
  assert.doesNotMatch(draft.content.rawInput, /\d+%/);
});

test('English STAR and standalone headings work; unknown task and expected results stay empty', () => {
  const item = extractLocalStar({ sourceText: 'S (Situation): 회원이 공지를 놓쳤다.\nT (Task): 공지 탐색 문제 해결\nA (Action): 검색 필터를 구현했다.\nR (Result): 다음 달 사용자 1000명 확보 목표' });
  assert.equal(item.task, '공지 탐색 문제 해결');
  assert.equal(item.result, '');
  const incomplete = extractLocalStar({ sourceText: '상황\n검색이 느렸다.\n행동\n색인을 수정했다.\n배운 점\n테스트의 중요성을 배웠다.' });
  assert.equal(incomplete.task, '');
  assert.equal(incomplete.action, '색인을 수정했다.');
  assert.equal(incomplete.result, '');
});

const document = (name, content) => ({ id: name, name, path: `내 기록/${name}`, size: 100,
  getFile: async () => ({ name, size: 100, arrayBuffer: async () => new TextEncoder().encode(content).buffer }) });

test('real incomplete and concise contribution records survive as reviewable candidates', async () => {
  const result = await organizeLocalFiles([
    document('API 개선.md', 'API 개선 프로젝트\n역할: 백엔드 담당\n한 일: 인증 API 설계 및 오류 로그 수집'),
    document('축제 운영.md', '학교 축제 운영\n한 일: 관객 안내 표지 제작 및 안내 동선 조정'),
    document('시장 조사.md', '동아리 시장 조사\n역할: 조사 담당\n한 일: 사용자 인터뷰를 진행하고 응답을 정리했다.\n성과: 팀원들이 방향을 이해하기 쉬워졌다고 답했다.'),
  ], { experienceOnly: true });
  assert.equal(result.items.length, 3);
  const api = result.items.find(row => row.title.includes('API'));
  assert.equal(api.result, '');
  assert.equal(api.task, '');
  assert.equal(api.coreSelection.needsReview, true);
  assert.ok(api.coreSelection.missing.includes('결과'));
  const festival = result.items.find(row => row.title.includes('축제'));
  assert.equal(festival.role, '');
  assert.ok(festival.coreSelection.missing.includes('내 역할'));
});

test('an assigned task alone is not mistaken for a performed action', async () => {
  const result = await organizeLocalFiles([document('서비스 계획.md', '알림 서비스 프로젝트\n역할: 개발 담당\n과제: 알림 API를 개발해야 했습니다.\n목표: 가입자 1000명 확보')], { experienceOnly: true });
  assert.equal(result.items.length, 0);
});

test('the screenshot-style narrative gets a source-backed title and actual work, not a career wish', async () => {
  const body = '담당했습니다.\n2026.05\n상황: 새로운 데이터가 추가될 때마다 높은 재학습 비용이 발생했습니다.\n과제: 3만 건의 비정형 학술 데이터를 바탕으로 교수의 전문성과 설명 방식을 반영해야 했습니다.\n한 일: 이 경험을 바탕으로 귀사에서 개인화 서비스를 구현하고 비즈니스 임팩트를 만들고 싶습니다.\n해결 과정에서 저는 이 프로젝트에서 백엔드/AI 개발자로서 AI 페르소나의 RAG 파이프라인 설계 및 구축을 완전히 책임졌습니다.\n결과: [XYZ 공식] 3만 건의 학술 데이터를 처리해 AI 페르소나 네트워킹 플랫폼을 구축했습니다.';
  const result = await organizeLocalFiles([document('담당했습니다.md', body)], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.notEqual(item.title, '담당했습니다.');
  assert.match(item.title, /AI 페르소나.*플랫폼/);
  assert.match(item.role, /백엔드\/AI 개발자/);
  assert.match(item.action, /RAG 파이프라인/);
  assert.doesNotMatch(item.action, /싶습니다|귀사/);
  assert.doesNotMatch(item.result, /XYZ 공식/);
  assert.match(item.sourceText, /만들고 싶습니다/, 'the exact original remains available for review');
});

test('an unnamed personal experience is kept for review without treating its placeholder as a verified title', async () => {
  const result = await organizeLocalFiles([document('자소서.md', '자기소개\n저는 백엔드 개발자로서 인증 API를 설계하고 오류 로그 수집을 구현했습니다.')], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].needsTitleReview, true);
  assert.equal(result.items[0].title, '경험 제목 확인 필요');
  assert.ok(result.items[0].coreSelection.missing.includes('경험 제목'));
});

test('portfolio page code, contact headers and career wishes never populate STAR fields', async () => {
  const body = [
    'HIGHLIGHTS', 'portfolio@example.com · github.com/example · 010-1234-5678',
    '학교 공지 검색 프로젝트', '역할: 백엔드 개발자',
    '상황: 회원들이 중요한 공지를 놓치고 있었습니다.',
    '과제: 공지 탐색 시간을 줄여야 했습니다.',
    "description: '사용자들이 쉽게 접근하고 효율적으로 사용할 수 있는 앱을 만드는 데 집중할 것입니다.',",
    "id: 3, image: '/goal_3.jpg', description: '운동과 식습관을 관리하고 싶습니다.'",
    '다양한 문화를 경험하고 싶습니다.',
    '한 일: 공지 검색 필터를 구현하고 오류 로그를 분류했습니다.',
    'portfolio@example.com · github.com/example · 010-1234-5678',
    'const result = projects.map(project => project.description);',
    '성과: 검색 시간을 5분에서 1분으로 단축했습니다.',
  ].join('\n');
  const result = await organizeLocalFiles([document('공지 검색 회고.md', body)], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  const item = result.items[0];
  assert.match(item.title, /학교 공지 검색/);
  assert.equal(item.task, '공지 탐색 시간을 줄여야 했습니다.');
  assert.match(item.action, /검색 필터/);
  assert.match(item.result, /1분/);
  for (const field of ['role', 'context', 'task', 'action', 'result']) {
    assert.doesNotMatch(item[field], /example|description|goal_3|const |싶습니다|HIGHLIGHTS/);
  }
  assert.match(item.sourceText, /description:/, 'the original code remains in the source for review');
  assert.match(item.sourceText, /portfolio@example.com/);
});

test('portfolio introduction and contact information are not emitted as an additional experience', async () => {
  const body = ['HIGHLIGHTS', 'portfolio@example.com · github.com/example · 010-1234-5678',
    '문제를 정의하고 끝까지 검증하는 프론트엔드 개발자',
    '01. 학교 공지 검색 프로젝트', '역할: 개발 담당', '한 일: 회원별 공지 검색 필터를 설계하고 구현했습니다.',
    '02. 동아리 회계 정리 프로젝트', '역할: 운영 담당', '한 일: 영수증 대장을 만들고 월별 결산을 자동화했습니다.'].join('\n');
  const result = await organizeLocalFiles([document('개발자 포트폴리오.md', body)], { experienceOnly: true });
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every(item => !/HIGHLIGHTS|example/.test(item.title)));
  assert.ok(result.items.every(item => !/프론트엔드 개발자/.test(item.role)));
});

test('fenced code with natural-language strings is excluded from direct STAR extraction', () => {
  const item = extractLocalStar({ sourceText: ['과제: 검색 지연을 해결해야 했습니다.', '```js',
    "const labels = { description: '다양한 경험을 하고 싶습니다.' };", '```',
    '한 일: 검색 색인을 수정했습니다.', '성과: 응답 시간을 2초에서 1초로 단축했습니다.'].join('\n') });
  assert.equal(item.task, '검색 지연을 해결해야 했습니다.');
  assert.equal(item.action, '검색 색인을 수정했습니다.');
  assert.doesNotMatch(JSON.stringify(item.star), /const|description|다양한 경험/);
});
