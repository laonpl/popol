import test from 'node:test';
import assert from 'node:assert/strict';
import { startDevelopmentConnector } from './localExperienceConnector.js';

test('local development prepares the connector through its own server without a picker or executable', async () => {
  const calls = [];
  await startDevelopmentConnector({ development: true, location: { hostname: 'localhost' },
    fetchRequest: async (...args) => { calls.push(args); return { ok: true, json: async () => ({ ready: true }) }; } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/__fitpoly/local-experience/connect');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].headers['X-FitPoly-Client'], 'fitpoly-local-experience-v1');
});

test('production and remote development never try to start a connector on the website server', async () => {
  for (const [development, hostname] of [[false, 'localhost'], [false, 'fitpoly.kr'], [true, '192.168.1.20']]) {
    await startDevelopmentConnector({ development, location: { hostname }, fetchRequest: () => { throw Error('must not request startup'); } });
  }
});

test('startup errors are reported without asking local development users to download a helper', async () => {
  await assert.rejects(startDevelopmentConnector({ development: true, location: { hostname: '127.0.0.1' },
    fetchRequest: async () => ({ ok: false, json: async () => ({ error: '로컬 연결 포트 사용 여부를 확인해주세요.' }) }),
  }), error => error.code === 'LOCAL_CONNECTOR_START_FAILED' && /포트/.test(error.message));
});

test('cancellation before connecting does not start local discovery', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(startDevelopmentConnector({ development: true, location: { hostname: 'localhost' }, signal: controller.signal,
    fetchRequest: () => { throw Error('must not start after cancellation'); },
  }), { name: 'AbortError' });
});
