import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getAiErrorStatus } from '../src/utils/aiError.js';

// Exercise the real retry loop with no provider calls, credits or waiting timers.
const source = fs.readFileSync(new URL('../src/config/geminiClient.js', import.meta.url), 'utf8');
const retrySource = source.slice(source.indexOf('export async function generateWithRetry'))
  .replace('export async function', 'async function') + '\nmodule.exports = generateWithRetry;';
const models = ['gemini-2.5-flash', 'gemini-3.1-flash-lite'];
const overloaded = () => new Error('{"error":{"code":503,"message":"high demand","status":"UNAVAILABLE"}}');

function runner(call, blocked = []) {
  const calls = [], waits = [];
  let released = 0;
  const context = {
    MODEL_FALLBACKS: models, getBillingStore: () => ({}), assertHasCredits: async () => {},
    acquireSemaphore: async () => {}, releaseSemaphore: () => { released++; },
    isModelTemporarilyBlocked: model => blocked.includes(model),
    recordModelError: () => {}, recordModelSuccess: () => {}, extractStatus: getAiErrorStatus,
    callGeminiModel: async model => { calls.push(model); return call(model, calls.length); },
    callGitHubModelsFallback: async () => { throw new Error('Unexpected cross-provider fallback'); },
    sleep: async ms => { waits.push(ms); }, console: { warn() {}, error() {} },
    module: { exports: null },
  };
  vm.runInNewContext(retrySource, context);
  return { generate: prompt => context.module.exports(prompt, { models, retries: 2, delayMs: 1200, githubFallback: false }),
    calls, waits, released: () => released };
}

test('JSON 503 from the first model switches promptly to the other model', async () => {
  const run = runner(async (_model, count) => { if (count === 1) throw overloaded(); return 'draft'; });
  assert.equal(await run.generate('prompt'), 'draft');
  assert.deepEqual(run.calls, models);
  assert.deepEqual(run.waits, []);
  assert.equal(run.released(), 1);
});

test('the last model retries temporary overload once with bounded jitter', async () => {
  const run = runner(async (_model, count) => { if (count < 3) throw overloaded(); return 'draft'; });
  assert.equal(await run.generate('prompt'), 'draft');
  assert.deepEqual(run.calls, [models[0], models[1], models[1]]);
  assert.equal(run.waits.length, 1);
  assert.ok(run.waits[0] >= 960 && run.waits[0] <= 1440);
});

test('exhausted overload releases the queue and does not wait after the final attempt', async () => {
  const run = runner(async () => { throw overloaded(); });
  await assert.rejects(run.generate('prompt'), error => getAiErrorStatus(error) === 503);
  assert.equal(run.calls.length, 3);
  assert.equal(run.waits.length, 1);
  assert.equal(run.released(), 1);
});

test('temporarily blocked models retain a retriable status even without a provider call', async () => {
  const run = runner(async () => { throw new Error('Unexpected call'); }, models);
  await assert.rejects(run.generate('prompt'), error => error.status === 503);
  assert.equal(run.calls.length, 0);
});

test('billing failure stops immediately without retrying another model', async () => {
  const error = Object.assign(new Error('Insufficient credits'), { status: 402, code: 'CREDIT_INSUFFICIENT' });
  const run = runner(async () => { throw error; });
  await assert.rejects(run.generate('prompt'), candidate => candidate === error);
  assert.deepEqual(run.calls, [models[0]]);
  assert.equal(run.released(), 1);
});
