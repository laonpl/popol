import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSearchProfile, findExperienceJobs } from './liveJobSearchService.js';

const experience = { total: 2, skills: [{ name: 'React' }], summaries: [
  { id: 'a', title: '웹 서비스 개발', description: 'React TypeScript로 화면 개발', skills: ['React'] },
  { id: 'b', title: '행사 운영', description: '참가자 일정 관리', skills: [] },
] };
test('dashboard role alias maps to a searchable role; experience count is not career years', () => {
  const profile = makeSearchProfile(experience, { targetRoles: ['기획 / PM'] });
  assert.equal(profile.role, '서비스 기획자');
  assert.equal(profile.level, '전체');
  assert.equal(profile.years, undefined);
  assert.ok(profile.skills.includes('React'));
});
test('explicit filters are preserved and invalid conditions rejected', () => {
  const search = { role: '프론트엔드 개발자', level: '경력', years: 2, location: '서울', recentDays: 7, sort: 'latest' };
  const profile = makeSearchProfile(experience, { search });
  for (const [key, value] of Object.entries(search)) assert.equal(profile[key], value);
  for (const invalid of [{ years: -1 }, { recentDays: 1 }, { role: '' }, { level: 'unknown' }, { sort: 'random' }]) {
    assert.throws(() => makeSearchProfile(experience, { search: { ...search, ...invalid } }), { status: 400 });
  }
});
test('matching links only supporting experiences and preserves source/date verification', async () => {
  const result = await findExperienceJobs(experience, { search: { role: '프론트엔드 개발자' } }, async () => ({
    jobs: [{ id: '1', title: '프론트엔드 개발자', company: 'Example', source: '원티드', url: 'https://www.wanted.co.kr/wd/123', skills: ['React'], description: 'React 개발. 제출 서류: 포트폴리오', score: 75, reason: 'React 경험', verification: 'listing' }],
    sources: [{ name: '원티드', status: 'ok', count: 1 }, { name: '잡코리아', status: 'failed', count: 0 }], checkedAt: '2026-09-30T00:00:00Z',
  }));
  assert.equal(result.unavailable, false);
  assert.deepEqual(result.recommendations[0].matchedExperiences.map(exp => exp.id), ['a']);
  assert.equal(result.recommendations[0].verification, 'listing');
  assert.equal(result.recommendations[0].postedAt, undefined);
  assert.equal(result.recommendations[0].fitScore, 75);
  assert.ok(result.recommendations[0].documents.includes('포트폴리오'));
});
test('zero matches differs from all channels unavailable', async () => {
  for (const status of ['ok', 'failed']) {
    const result = await findExperienceJobs(experience, { search: { role: '프론트엔드 개발자' } }, async () => ({ jobs: [], sources: [{ name: '원티드', status, count: 0 }] }));
    assert.equal(result.unavailable, status === 'failed');
    assert.deepEqual(result.recommendations, []);
  }
});
