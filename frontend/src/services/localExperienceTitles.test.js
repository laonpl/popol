import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExperiencesLocally } from '../../../shared/localExperienceParser.mjs';

test('a structural project heading after a long metadata block is preferred to file-name fallback', () => {
  const text = ['기간', '2025.01 ~ 2025.03', '내 역할', 'Marketing Intern · 캠페인 오너',
    ...Array.from({ length: 12 }, (_, i) => `문서 정보 ${i + 1}: 내부 검토용`),
    '저당간식 신제품런칭 캠페인', '한 일: 광고 소재별 실험을 설계하고 운영했습니다.', '성과: ROAS 405%를 달성했습니다.'].join('\n');
  const { experiences } = parseExperiencesLocally(text, '마케팅 기록', { single: true, personalDocument: true });
  assert.equal(experiences[0].title, '저당간식 신제품런칭 캠페인');
  assert.equal(experiences[0].sourceText, text);
});

test('role words inside a project name do not invalidate a useful work-object heading', () => {
  const text = '개발자 네트워킹 서비스\n역할: 개발 담당\n한 일: 개발자별 관심사를 연결하는 검색 API를 구현했습니다.\n성과: 시제품을 완성했습니다.';
  const { experiences } = parseExperiencesLocally(text, '개발 기록', { single: true });
  assert.equal(experiences[0].title, '개발자 네트워킹 서비스');
});
