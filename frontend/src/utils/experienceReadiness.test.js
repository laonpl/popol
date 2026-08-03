import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPortfolioReadiness,
  evaluateExperienceReadiness,
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

