import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalExperiences } from './localExperienceAnalysis.js';
import { buildLocalExperienceDraft } from '../utils/localExperienceDraft.js';

const candidate = id => ({ id, title: `프로젝트 ${id}`, period: '2025-01 ~ 2025-03', role: '직접 검토한 역할',
  context: '가입 단계에서 고객의 이탈을 발견했다.', action: '인터뷰 결과로 가입 화면을 바꿨다.', result: '전환율 18% 개선',
  learning: '사용자의 행동을 먼저 관찰했다.', keywords: ['사용자 인터뷰'], sourcePaths: [`자료/${id}.md`],
  sourceText: `프로젝트 ${id}\n원문: 고객 인터뷰로 가입 단계의 문제를 발견하고 화면을 수정했다.`,
});
const analysis = role => ({ jobCategory: role, keyExperiences: [{ title: '직군별 의사결정 장면', jobData: { role } }] });

test('local intake sends originals and reviewed answers to the existing role analyzer without locking scenes', async () => {
  for (const jobCategory of ['pm', 'dev', 'marketer']) {
    const created = [], analyzed = [];
    const result = await analyzeLocalExperiences({ items: [candidate('one')], jobCategory, careerStage: 'experienced', momentsCount: 5,
      createExperience: async payload => { created.push(payload); return 'experience-1'; },
      analyzeExperience: async (...args) => { analyzed.push(args); return analysis(jobCategory); },
    });
    assert.equal(created[0].jobCategory, jobCategory);
    assert.equal(created[0].careerStage, 'experienced');
    assert.equal(created[0].momentsCount, 5);
    assert.equal(created[0].reviewedMoments, undefined);
    assert.match(created[0].content.rawInput, /직접 검토한 역할/);
    assert.match(created[0].content['로컬 파일 원문'], /--- 자료\/one.md ---\n프로젝트 one/);
    assert.deepEqual(analyzed, [['experience-1', { momentsCount: 5 }]]);
    assert.equal(result.records.one.status, 'complete');
  }
});

test('analysis retry reuses the persisted draft ID and skips completed experiences', async () => {
  let creations = 0;
  const first = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')], jobCategory: 'pm',
    createExperience: async () => `saved-${++creations}`,
    analyzeExperience: async id => { if (id === 'saved-2') throw new Error('temporary failure'); return analysis('pm'); },
  });
  assert.equal(first.records.one.status, 'complete');
  assert.equal(first.records.two.status, 'draft');
  const analyzed = [];
  const second = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')], jobCategory: 'pm', records: first.records,
    createExperience: async () => { throw Error('must reuse draft'); },
    analyzeExperience: async id => { analyzed.push(id); return analysis('pm'); },
  });
  assert.equal(creations, 2);
  assert.deepEqual(analyzed, ['saved-2']);
  assert.equal(second.records.two.status, 'complete');
});

test('fallback, generic drafts, and empty analysis are not presented as completed role analysis', async () => {
  for (const response of [{ ...analysis('pm'), _fallback: true }, { ...analysis('pm'), _draft: true }, { keyExperiences: [] }]) {
    let creations = 0;
    const result = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')], jobCategory: 'pm',
      createExperience: async () => { creations += 1; return 'saved'; }, analyzeExperience: async () => response,
    });
    assert.equal(result.records.one.status, 'draft');
    assert.equal(result.failures.length, 1);
    assert.equal(result.stopped, true);
    assert.equal(creations, 1);
  }
});

test('credit/rate limits and provider outages stop further paid work and leave drafts retryable', async () => {
  for (const status of [402, 429, 503]) {
    let creations = 0;
    const result = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')], jobCategory: 'dev',
      createExperience: async () => { creations += 1; return 'saved'; },
      analyzeExperience: async () => { throw Object.assign(new Error('limit'), { response: { status, data: { error: '다시 시도해주세요' } } }); },
    });
    assert.equal(creations, 1);
    assert.equal(result.stopped, true);
    assert.equal(result.records.one.experienceId, 'saved');
    assert.equal(result.records.two, undefined);
  }
});

test('genuine partial analysis is available as a result instead of failing the whole batch', async () => {
  const result = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')], jobCategory: 'pm',
    createExperience: async payload => payload.title,
    analyzeExperience: async () => ({ ...analysis('pm'), _partial: true, _analysisIssues: [{ code: 'AI_TIMEOUT' }] }),
  });
  assert.equal(result.failures.length, 0);
  assert.equal(result.warnings.length, 2);
  assert.equal(result.records.one.status, 'complete');
  assert.equal(result.records.two.status, 'complete');
});

test('a source-specific extraction failure continues the batch and reports the server cause', async () => {
  let calls = 0;
  const result = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')],
    createExperience: async payload => payload.title,
    analyzeExperience: async () => {
      if (++calls === 1) throw Object.assign(new Error('error'), { response: { status: 422, data: { error: '핵심 경험을 추출하지 못했어요.', stopBatch: false } } });
      return analysis('common');
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.failures[0].message, '핵심 경험을 추출하지 못했어요.');
  assert.equal(result.records.one.status, 'draft');
  assert.equal(result.records.two.status, 'complete');
  assert.equal(result.stopped, false);
});

test('provider authentication failures stop the batch while retaining any genuine partial result', async () => {
  let creations = 0;
  const result = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')],
    createExperience: async () => `saved-${++creations}`,
    analyzeExperience: async () => ({ ...analysis('common'), _partial: true,
      _analysisIssues: [{ code: 'AI_CONFIGURATION', stopBatch: true }] }),
  });
  assert.equal(creations, 1);
  assert.equal(result.records.one.status, 'complete');
  assert.equal(result.records.two, undefined);
  assert.equal(result.stopped, true);
  assert.equal(result.warnings.length, 1);
});

test('stopping finishes the active analysis and does not start the next candidate', async () => {
  let stop = false;
  const result = await analyzeLocalExperiences({ items: [candidate('one'), candidate('two')], jobCategory: 'marketer',
    createExperience: async () => 'saved', analyzeExperience: async () => { stop = true; return analysis('marketer'); }, shouldStop: () => stop,
  });
  assert.equal(result.records.one.status, 'complete');
  assert.equal(result.records.two, undefined);
  assert.equal(result.stopped, true);
});

test('long sources retain middle and final evidence; oversized merged experiences fail explicitly', () => {
  const item = candidate('long');
  item.sourceText = `${'앞부분'.repeat(7000)}중간 증거 문장${'중간'.repeat(5000)}마지막 성과 근거`;
  const draft = buildLocalExperienceDraft(item, 'pm');
  assert.match(draft.content['로컬 파일 원문'], /중간 증거 문장/);
  assert.match(draft.content['로컬 파일 원문'], /마지막 성과 근거$/);
  assert.equal(draft.content.rawInput.includes('마지막 성과 근거'), false, 'original evidence is separate from reviewed self report');
  assert.throws(() => buildLocalExperienceDraft({ ...item, sourceText: '가'.repeat(120001) }), /12만 자/);
});
