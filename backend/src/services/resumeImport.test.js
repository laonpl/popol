import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResumeExperiences } from './importService.js';

test('resume experiences get a timeline-readable period and allowed category/job values', () => {
  const { experiences } = normalizeResumeExperiences({
    experiences: [
      { title: '결제 전환 개선 프로젝트', startDate: '2024-03', endDate: '2024-08', category: '프로젝트', jobCategory: 'pm', keywords: ['A/B 테스트', ''] },
      { title: '네이버 인턴', startDate: '2025-01', ongoing: true, category: '인턴', jobCategory: 'unknown' },
      { title: '날짜 모르는 동아리', startDate: '2023년 봄', endDate: '' },
    ],
  });

  assert.equal(experiences.length, 3);
  assert.equal(experiences[0].period, '2024-03 ~ 2024-08');
  assert.equal(experiences[0].category, '프로젝트');
  assert.equal(experiences[0].jobCategory, 'pm');
  assert.deepEqual(experiences[0].keywords, ['A/B 테스트']);
  assert.equal(experiences[1].period, '2025-01 ~ 현재');
  assert.equal(experiences[1].category, '기타');
  assert.equal(experiences[1].jobCategory, 'common');
  assert.equal(experiences[2].period, '');
  assert.equal(experiences[2].result, '');
});

test('resume experiences drop untitled and duplicate items and cap the list', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ title: `경험 ${i}` }));
  assert.equal(normalizeResumeExperiences({ experiences: many }).experiences.length, 15);

  const { experiences } = normalizeResumeExperiences({
    experiences: [{ title: '' }, { title: 'SW 공모전' }, { title: 'SW  공모전' }, null],
  });
  assert.deepEqual(experiences.map(e => e.title), ['SW 공모전']);
  assert.deepEqual(normalizeResumeExperiences(null), { experiences: [] });
});

test('portfolio projects each get their own original text section, even with PDF line breaks in headings', () => {
  const source = [
    '안녕하세요, 기획자 김OO입니다. 기술 스택: Figma, SQL',
    '01. 결제 전환\n개선 프로젝트',
    '결제 이탈률이 42%였다. 퍼널을 분석해 3단계를 1단계로 줄였다. 전환율 18% 상승.',
    '02. 캠퍼스 중고거래 앱',
    '학생 500명 인터뷰 후 MVP를 만들었다. MAU 1,200 달성.',
  ].join('\n');
  const { experiences } = normalizeResumeExperiences({
    experiences: [
      { title: '결제 전환 개선', startsWith: '01. 결제 전환 개선 프로젝트' },
      { title: '캠퍼스 중고거래 앱', startsWith: '02. 캠퍼스 중고거래 앱' },
      { title: '원문에 없는 제목', startsWith: '존재하지 않는 문구' },
    ],
  }, source);

  assert.match(experiences[0].sourceText, /^01\. 결제 전환/);
  assert.match(experiences[0].sourceText, /전환율 18% 상승/);
  assert.doesNotMatch(experiences[0].sourceText, /중고거래/);
  assert.doesNotMatch(experiences[0].sourceText, /기술 스택/);
  assert.match(experiences[1].sourceText, /MAU 1,200 달성\.$/);
  assert.equal(experiences[2].sourceText, '');
});
