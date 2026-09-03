import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJdKeywords, matchExperienceToJd, summarizeJdCoverage } from './jdMatch.js';

const JD = `
  [백엔드 개발자 채용]
  주요 업무
  - 결제 시스템 API 설계와 개발
  - 대용량 트래픽 처리와 성능 최적화
  - 결제 데이터 파이프라인 운영
  자격 요건
  - Node.js 또는 Java 개발 경험 3년 이상
  - 데이터베이스 설계 경험
  우대 사항
  - 결제 도메인 이해
  - Kubernetes 운영 경험
`;

const paymentExperience = {
  title: '결제 API 재설계',
  keywords: ['결제', '성능'],
  structuredResult: {
    intro: '결제 시스템의 응답 지연을 줄이기 위해 API를 다시 설계했습니다.',
    output: '트래픽이 몰리는 시간대의 응답을 30% 줄였습니다.',
  },
};

const unrelatedExperience = {
  title: '교내 홍보 부스 운영',
  structuredResult: { intro: '학교 축제에서 홍보 부스를 기획하고 운영했습니다.' },
};

test('공고에서 직무 키워드를 뽑고 상용구는 걸러낸다', () => {
  const keywords = extractJdKeywords(JD).map(item => item.keyword);
  assert.ok(keywords.includes('결제'));
  assert.ok(keywords.includes('설계'));
  // '업무', '요건', '우대', '경험'은 어느 공고에나 있는 상용구다
  assert.equal(keywords.includes('업무'), false);
  assert.equal(keywords.includes('우대'), false);
  assert.equal(keywords.includes('경험'), false);
});

test('조사를 떼어 같은 단어로 묶는다', () => {
  const keywords = extractJdKeywords('결제를 결제가 결제는 데이터의 데이터를').map(item => item.keyword);
  assert.deepEqual(keywords, ['결제', '데이터']);
});

test('공고와 가까운 경험이 더 높은 일치 점수를 받는다', () => {
  const keywords = extractJdKeywords(JD);
  const close = matchExperienceToJd(paymentExperience, keywords);
  const far = matchExperienceToJd(unrelatedExperience, keywords);

  assert.ok(close.score > far.score);
  assert.ok(close.matched.includes('결제'));
  assert.equal(far.matched.includes('결제'), false);
});

test('공고를 붙여넣지 않으면 아무 점수도 매기지 않는다', () => {
  assert.deepEqual(extractJdKeywords(''), []);
  assert.deepEqual(matchExperienceToJd(paymentExperience, []), { matched: [], score: 0 });
});

test('선택한 경험이 덮지 못한 공고 키워드를 짚어준다', () => {
  const keywords = extractJdKeywords(JD);
  const coverage = summarizeJdCoverage([paymentExperience], keywords);
  assert.ok(coverage.covered.includes('결제'));
  assert.ok(coverage.uncovered.length > 0);
  assert.equal(coverage.covered.length + coverage.uncovered.length, keywords.length);
});
