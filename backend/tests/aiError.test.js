import test from 'node:test';
import assert from 'node:assert/strict';
import { getAiErrorStatus, isTransientAiError, aiUnavailableError, AI_UNAVAILABLE_MESSAGE } from '../src/utils/aiError.js';

test('Gemini numeric fields and JSON-encoded UNAVAILABLE errors are recognized', () => {
  for (const error of [{ status: 503 }, { code: 503 }, { response: { status: 503 } },
    new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'),
    new Error('{"error":{"status":"UNAVAILABLE"}}'), { status: 'UNAVAILABLE' }]) {
    assert.equal(getAiErrorStatus(error), 503);
    assert.equal(isTransientAiError(error), true);
  }
});

test('billing, authorization, input and parsing failures are not temporary overload', () => {
  for (const error of [{ status: 402 }, { status: 403 }, { status: 400 }, new Error('Invalid JSON'), new Error('503 projects')]) {
    assert.equal(isTransientAiError(error), false);
  }
  assert.equal(getAiErrorStatus(new Error('GEMINI_TIMEOUT')), 504);
});

test('temporary provider errors have a safe Korean message and retain their cause internally', () => {
  const cause = new Error('{"error":{"code":503}}');
  const error = aiUnavailableError(cause);
  assert.equal(error.status, 503);
  assert.equal(error.code, 'AI_TEMPORARILY_UNAVAILABLE');
  assert.equal(error.message, AI_UNAVAILABLE_MESSAGE);
  assert.equal(error.cause, cause);
});
