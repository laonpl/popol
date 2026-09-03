import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPortfolioReadiness,
  evaluateExperienceReadiness,
  hasMetricValue,
  readinessPatch,
} from './experienceReadiness.js';

function draftExperience(id = 'experience-1', roles = ['flagship']) {
  return {
    id,
    title: 'Checkout conversion project',
    portfolioRoles: roles,
    structuredResult: {
      projectOverview: {
        background: 'Users abandoned the checkout flow before completing payment.',
        role: 'I owned funnel analysis and experiment prioritization.',
      },
      keyExperiences: [{
        action: 'I analyzed the funnel and coordinated the experiment with engineers.',
        result: 'Conversion improved and the team defined the next decision.',
      }],
    },
  };
}

function confirmedExperience(id, roles) {
  const draft = draftExperience(id, roles);
  return { ...draft, ...readinessPatch(draft, { confirmed: true }), portfolioRoles: roles };
}

test('structured content remains unverified until the user confirms it', () => {
  const result = evaluateExperienceReadiness(draftExperience());
  assert.equal(result.requiredComplete, true);
  assert.equal(result.portfolioReady, false);
  assert.equal(result.lifecycleStatus, 'needs_confirmation');
});

test('confirmation makes a complete experience portfolio-ready', () => {
  const result = evaluateExperienceReadiness(confirmedExperience('e1', ['flagship']));
  assert.equal(result.portfolioReady, true);
  assert.equal(result.checks.evidenceConfirmed, true);
});

test('confirmation cannot bypass missing required content', () => {
  const incomplete = draftExperience();
  incomplete.structuredResult.keyExperiences[0].action = '';
  const patched = { ...incomplete, ...readinessPatch(incomplete, { confirmed: true }) };
  assert.equal(evaluateExperienceReadiness(patched).portfolioReady, false);
});

test('a bundle is ready with three verified experiences and broad story coverage', () => {
  const summary = buildPortfolioReadiness([
    confirmedExperience('e1', ['flagship', 'problem_solving']),
    confirmedExperience('e2', ['collaboration']),
    confirmedExperience('e3', ['growth']),
  ]);
  assert.equal(summary.ready, true);
  assert.equal(summary.readyCount, 3);
  assert.deepEqual(new Set(summary.coveredSlots), new Set(['flagship', 'problem_solving', 'collaboration', 'growth']));
});

test('two strong experiences can be previewed but do not claim default readiness', () => {
  const summary = buildPortfolioReadiness([
    confirmedExperience('e1', ['flagship', 'problem_solving']),
    confirmedExperience('e2', ['collaboration', 'growth']),
  ]);
  assert.equal(summary.ready, false);
  assert.ok(summary.progress > 0 && summary.progress < 100);
});

/* ── 정량화 게이트 ── */

test('숫자와 단위가 붙은 결과만 지표로 인정한다', () => {
  assert.equal(hasMetricValue('전환율을 27% 끌어올렸습니다'), true);
  assert.equal(hasMetricValue('사용성 테스트 24명 중 19명이 혼란'), true);
  assert.equal(hasMetricValue('만족도 4.6/5'), true);
  assert.equal(hasMetricValue('좋은 결과를 얻었습니다'), false);
});

test('연도·날짜 표기는 성과 수치로 세지 않는다', () => {
  assert.equal(hasMetricValue('2024년 3월에 마무리했습니다'), false);
  assert.equal(hasMetricValue('2024.03 ~ 2024.06 진행'), false);
  assert.equal(hasMetricValue('2024년에 응답 시간을 30% 줄였습니다'), true);
});

test('결과에 수치가 없으면 점수가 깎이고 보완 제안이 뜬다', () => {
  const vague = evaluateExperienceReadiness(draftExperience());
  const measured = draftExperience();
  measured.structuredResult.keyExperiences[0].result = '결제 전환율이 12% 올랐고 이탈은 8% 줄었습니다.';

  assert.equal(vague.checks.outcomeMetric, false);
  assert.equal(evaluateExperienceReadiness(measured).checks.outcomeMetric, true);
  assert.ok(evaluateExperienceReadiness(measured).score > vague.score);
  assert.ok(vague.suggestions.some(item => item.key === 'outcomeMetric'));
});

test('수치가 없어도 필수 항목 판정과 확인 가능 여부는 그대로다', () => {
  const result = evaluateExperienceReadiness(draftExperience());
  assert.equal(result.checks.outcomeMetric, false);
  assert.equal(result.requiredComplete, true);
});

/* ── 문제 정의 품질 ── */

test('느낌으로 쓴 문제 정의를 잡아내고, 근거가 붙으면 통과시킨다', () => {
  const vague = draftExperience();
  vague.structuredResult.projectOverview.background = '화면이 복잡하고 불편해 보여서 개선하기로 했습니다.';
  assert.ok(evaluateExperienceReadiness(vague).suggestions.some(item => item.key === 'vagueProblem'));

  const grounded = draftExperience();
  grounded.structuredResult.projectOverview.background = '메뉴가 복잡해 탐색에 평균 15초가 걸렸고 이탈률이 27%였습니다.';
  assert.equal(evaluateExperienceReadiness(grounded).suggestions.some(item => item.key === 'vagueProblem'), false);
});

/* ── 직무별 결정타 ── */

test('개발 경험에 트러블슈팅이 없으면 직무별 보완을 제안한다', () => {
  const withoutTs = { ...draftExperience(), jobCategory: 'dev' };
  const focus = evaluateExperienceReadiness(withoutTs);
  assert.equal(focus.jobFocus.key, 'troubleshooting');
  assert.equal(focus.jobFocus.met, false);
  assert.ok(focus.suggestions.some(item => item.key === 'jobFocus'));

  const withTs = { ...draftExperience(), jobCategory: 'dev' };
  withTs.structuredResult.keyExperiences[0].action = '응답 지연의 근본 원인을 쿼리 병목으로 좁히고 인덱스를 재설계했습니다.';
  assert.equal(evaluateExperienceReadiness(withTs).jobFocus.met, true);
});

test('직무를 고르지 않은 경험에는 직무별 잣대를 들이대지 않는다', () => {
  assert.equal(evaluateExperienceReadiness(draftExperience()).jobFocus, null);
  assert.equal(evaluateExperienceReadiness({ ...draftExperience(), jobCategory: 'marketer' }).jobFocus.key, 'campaign_metric');
});

