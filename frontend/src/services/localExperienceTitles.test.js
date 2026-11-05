import test from 'node:test';
import assert from 'node:assert/strict';
import { organizeLocalFiles, findCoreLocalExperiences } from './localExperienceFiles.js';
import { parseExperiencesLocally } from '../../../shared/localExperienceParser.mjs';

const source = (name, content) => ({ id: name, name, path: `내 파일/${name}`, size: new TextEncoder().encode(content).length,
  getFile: async () => ({ name, size: new TextEncoder().encode(content).length, arrayBuffer: async () => new TextEncoder().encode(content).buffer }) });

const marketing = [
  '기간', '2025.01 ~ 2025.03', '내 역할', 'Marketing Intern · 캠페인 오너',
  '저당간식 신제품런칭 캠페인',
  '상황: 건강 간식 시장에서 신제품의 인지도가 낮고 신규 구매자 확보가 필요했습니다.',
  '과제: 저당간식 신제품런칭 캠페인의 광고 효율과 첫달 매출을 검증해야 했습니다.',
  '한 일: 고객 인터뷰와 경쟁 제품 분석으로 광고 메시지를 정리하고 소재별 A/B 테스트를 운영했습니다.',
  '성과: ROAS 405%를 달성하고 첫달 매출 4,860만원을 기록했습니다.',
].join('\n');

const hackathon = [
  '해커톤 팀의 백엔드/AI 개발자로 참여하여',
  '2026.05.16 ~ 2026.05.17',
  '저는 해커톤 팀의 백엔드/AI 개발자로 참여하여 3만 건의 학술 데이터를 처리하는 AI 페르소나 네트워킹 플랫폼의 RAG 파이프라인을 설계하고 구축했습니다.',
  '상황: 학내 구성원이 서로의 연구 관심사를 쉽게 찾기 어려웠습니다.',
  '과제: 교수별 설명 방식과 연구 분야를 반영하는 검색 파이프라인이 필요했습니다.',
  '한 일: 교수별 벡터 색인을 구성하고 검색 결과에 근거 출처를 표시하는 API를 구현했습니다.',
  '성과: 3만 건의 학술 자료를 검색하는 시제품을 완성하고 해커톤에서 2등을 수상했습니다.',
].join('\n');

test('period-first marketing portfolio card uses its campaign name and retains the period and metrics', async () => {
  const result = await organizeLocalFiles([source('마케팅 포트폴리오.md', marketing)], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  const [item] = result.items;
  assert.equal(item.title, '저당간식 신제품런칭 캠페인');
  assert.equal(item.period, '2025-01 ~ 2025-03');
  assert.match(item.result, /ROAS 405%/);
  assert.match(item.result, /4,860만원/);
  assert.equal(item.sourceText, marketing);
  assert.equal(item.needsTitleReview, false);
});

test('a backend participant sentence gives way to the actual platform described in its source', async () => {
  const result = await organizeLocalFiles([source('개발 회고.md', hackathon)], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  const [item] = result.items;
  assert.equal(item.title, 'AI 페르소나 네트워킹 플랫폼');
  assert.doesNotMatch(item.title, /참여하여|개발자로|학술 데이터|3만/);
  assert.doesNotMatch(item.role, /참여하여/);
  assert.match(item.action, /RAG 파이프라인/);
  assert.match(item.result, /2등/);
  assert.equal(item.sourceText, hackathon);
  assert.equal(item.needsTitleReview, false);
});

test('a flattened PDF card derives the campaign title from prose rather than the period or role label', async () => {
  const text = '기간: 2025.01 ~ 2025.03 내 역할: Marketing Intern · 캠페인 오너 상황: 저당간식 신제품런칭 캠페인에서 신규 구매자 확보가 필요했습니다. 과제: 첫달 광고 효율을 검증해야 했습니다. 한 일: 고객 인터뷰와 광고 소재 A/B 테스트를 운영했습니다. 성과: ROAS 405%를 달성하고 첫달 매출 4,860만원을 기록했습니다.';
  const result = await organizeLocalFiles([source('캠페인 정리.md', text)], { experienceOnly: true });
  assert.equal(result.items.length, 1);
  const [item] = result.items;
  assert.equal(item.title, '저당간식 신제품런칭 캠페인');
  assert.equal(item.period, '2025-01 ~ 2025-03');
  assert.match(item.role, /Marketing Intern/);
  assert.match(item.result, /405%/);
  assert.equal(item.sourceText, text);
});

test('automatic scanning keeps the marketing campaign and academic platform as separately titled experiences', async () => {
  const result = await findCoreLocalExperiences([source('마케팅 포트폴리오.md', marketing), source('개발 회고.md', hackathon)]);
  assert.deepEqual(result.items.map(item => item.title).sort(), ['AI 페르소나 네트워킹 플랫폼', '저당간식 신제품런칭 캠페인'].sort());
  assert.ok(result.items.every(item => item.sourcePaths.length === 1));
});

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
