import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExperiencesLocally } from './localExperienceParser.js';
import { structureImportedContent } from './importService.js';

const RESUME = [
  '박서연',
  '서비스 기획자',
  '학력 \tE D U C AT I O N',
  '새봄대학교 \t2020.03 — 2025.02',
  '경영정보학과 학사 · 데이터사이언스 부전공',
  '경력 · 프로젝트 \tE X P E R I E N C E',
  '끼니로그 — 1인 가구 식비 관리 \t2025.08 — 2026.01 · 6개월',
  'Product Manager · 6인 팀',
  '사진 한 장으로 식비를 기록하는 MVP를 기획했습니다. 4주 리텐션',
  '27%와 기록 완료율 71%를 확인했습니다.',
  '클래스온 수강 이탈 개선',
  '2025.06 ~ 현재',
  '서비스 기획 인턴 · Growth Squad',
  '첫 강의 전 이탈 원인을 분석하고 온보딩 체크리스트를 기획했습니다.',
  '이 과정에서 가설을 작게 검증하는 습관의 중요성을 배웠습니다.',
  '자격 · 수상 \tC E R T I F I C AT E S & AWA R D S',
  '제4회 대학생 프로덕트 챌린지 최우수상 \t2025.12',
  'SQLD 데이터분석 준전문가 \t2025.02',
].join('\n');

test('resume text splits into experiences by dated headings and skips education/award sections', () => {
  const { confident, experiences } = parseExperiencesLocally(RESUME);
  assert.equal(confident, true);
  assert.deepEqual(experiences.map(e => e.title), ['끼니로그 — 1인 가구 식비 관리', '클래스온 수강 이탈 개선']);

  const [first, second] = experiences;
  assert.equal(first.startDate, '2025-08');
  assert.equal(first.endDate, '2026-01');
  assert.equal(first.role, 'Product Manager · 6인 팀');
  assert.equal(first.jobCategory, 'pm');
  assert.match(first.action, /MVP를 기획했습니다/);
  assert.equal(first.result, '4주 리텐션 27%와 기록 완료율 71%를 확인했습니다.'); // PDF 줄바꿈으로 끊긴 문장을 잇는다

  // 날짜가 제목 다음 줄에 있어도 같은 경험
  assert.equal(second.startDate, '2025-06');
  assert.equal(second.ongoing, true);
  assert.equal(second.category, '인턴십');
  assert.match(second.learning, /배웠습니다/);
  assert.equal(second.startsWith, '클래스온 수강 이탈 개선');
});

test('resume structuring uses the local parser and keeps the per-experience source text', async () => {
  let aiCalls = 0;
  const { experiences } = await structureImportedContent({ content: RESUME, title: '이력서' }, 'resume', { segment: async () => { aiCalls++; return null; } });
  assert.equal(aiCalls, 0);
  assert.equal(experiences.length, 2);
  assert.equal(experiences[0].period, '2025-08 ~ 2026-01');
  assert.equal(experiences[1].period, '2025-06 ~ 현재');
  assert.match(experiences[0].sourceText, /^끼니로그/);
  assert.doesNotMatch(experiences[0].sourceText, /클래스온/);
});

test('short fragments and section labels retain measurable results and learning', () => {
  const { experiences } = parseExperiencesLocally([
    '01. 예약 개선 프로젝트', '배경', '예약 단계가 복잡했다.', '한 일', 'React 개발',
    '성과', '완료율 18% 상승', '배운 점', '작은 검증부터 시작',
  ].join('\n'));
  assert.match(experiences[0].action, /React 개발/);
  assert.equal(experiences[0].result, '완료율 18% 상승');
  assert.equal(experiences[0].learning, '작은 검증부터 시작');
});

test('dated and undated projects stay separate and excluded sections do not leak into sources', async () => {
  const source = [
    '프로젝트', '결제 개선 2025.01 ~ 2025.03', '결제 단계의 이탈 원인을 조사하고 화면 흐름을 개선했습니다.',
    '02. 캠퍼스 중고거래 앱', '학생들을 인터뷰하고 중고 물품을 거래할 수 있는 웹 앱을 개발했습니다.',
    '학력', '새봄대학교 2020.03 ~ 2025.02', '경영정보학과 학사',
  ].join('\n');
  let aiCalls = 0;
  const result = await structureImportedContent({ content: source }, 'resume', { segment: async () => { aiCalls++; return null; } });
  assert.equal(aiCalls, 0);
  assert.equal(result.experiences.length, 2);
  assert.doesNotMatch(result.experiences[0].sourceText, /중고거래/);
  assert.doesNotMatch(result.experiences[1].sourceText, /학력|새봄대학교/);
});

test('unnumbered additional project headings require review instead of claiming a confident merge', () => {
  const result = parseExperiencesLocally([
    '예약 개선 프로젝트', '예약 화면을 재설계하고 사용자 테스트를 진행했습니다.',
    '중고거래 프로젝트', '중고 물품을 거래할 수 있는 웹 애플리케이션을 개발했습니다.',
  ].join('\n'));
  assert.equal(result.confident, false);
});

test('portfolio without dates splits on numbered project headings; short numbered steps stay in the body', () => {
  const text = [
    '안녕하세요, 기획자 김OO입니다.',
    '01. 결제 전환 개선 프로젝트',
    '결제 단계에서 이탈하는 사용자가 많아 원인을 찾아야 했다.',
    '1. 퍼널 분석',
    '퍼널을 분석해 결제 단계를 3단계에서 1단계로 줄였다. 전환율이 18% 상승했다.',
    '02. 캠퍼스 중고거래 앱',
    '역할: 기획 및 프론트엔드 개발',
    '학생 500명 인터뷰 후 React로 MVP를 만들었다. MAU 1,200명을 달성했다.',
  ].join('\n');
  const { confident, experiences } = parseExperiencesLocally(text);
  assert.equal(confident, true);
  assert.deepEqual(experiences.map(e => e.title), ['결제 전환 개선 프로젝트', '캠퍼스 중고거래 앱']);
  assert.match(experiences[0].context, /이탈하는 사용자/);
  assert.match(experiences[0].result, /18% 상승/);
  assert.equal(experiences[1].role, '기획 및 프론트엔드 개발');
  assert.match(experiences[1].result, /MAU 1,200명/);
  assert.ok(experiences[1].keywords.includes('React'));
});

test('a long document with no split cues is not trusted, so the caller can fall back to AI', () => {
  const longText = '프로젝트를 진행하며 여러 기능을 개발했습니다. '.repeat(200);
  assert.equal(parseExperiencesLocally(longText).confident, false);
  assert.equal(parseExperiencesLocally('짧음').experiences.length, 0);
});

test('single experience import fills STRUCTURED fields from the original sentences without AI', async () => {
  const structured = await structureImportedContent({
    title: '셔틀 예약 개선',
    content: '역할: 서비스 기획\n예약 과정이 복잡해 이탈이 많았다.\n로그를 분석해 예약 흐름을 재설계했다.\n예약 완료율을 63%에서 81%로 높였다.',
  }, 'experience');
  assert.equal(structured.title, '셔틀 예약 개선');
  assert.equal(structured.content.process, '역할: 서비스 기획');
  assert.match(structured.content.overview, /이탈이 많았다/);
  assert.match(structured.content.task, /재설계했다/);
  assert.match(structured.content.output, /81%로 높였다/);
});
