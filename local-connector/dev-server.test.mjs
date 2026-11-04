import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createDevConnectorManager, isLocalConnectorStartRequest, localExperienceDevPlugin, LOCAL_CONNECTOR_START_PATH } from './dev-server.mjs';
import { createLocalConnector } from './server.mjs';

const startRequest = (override = {}) => ({ method: 'POST', url: LOCAL_CONNECTOR_START_PATH,
  socket: { remoteAddress: '127.0.0.1' },
  headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'x-fitpoly-client': 'fitpoly-local-experience-v1' }, ...override });

test('automatic start accepts only a same-origin local browser with the client header', () => {
  assert.equal(isLocalConnectorStartRequest(startRequest()), true);
  for (const req of [
    startRequest({ socket: { remoteAddress: '192.168.1.20' } }),
    startRequest({ headers: { ...startRequest().headers, origin: 'https://evil.example' } }),
    startRequest({ headers: { ...startRequest().headers, origin: 'http://localhost:3001' } }),
    startRequest({ headers: { ...startRequest().headers, host: 'evil.example' } }),
    startRequest({ headers: { ...startRequest().headers, 'x-fitpoly-client': undefined } }),
    startRequest({ headers: { ...startRequest().headers, origin: undefined } }),
  ]) assert.equal(isLocalConnectorStartRequest(req), false);
});

test('button requests share one connector and do not scan until an explicit scan request', async t => {
  let server, rootLookups = 0, starts = 0;
  const manager = createDevConnectorManager({ port: 0, fetchHealth: async () => { throw Error('not running'); },
    createConnector: () => {
      starts++;
      server = createLocalConnector({ roots: async () => { rootLookups++; return []; } });
      return server;
    } });
  t.after(() => manager.close());
  await Promise.all([manager.ensureStarted(), manager.ensureStarted(), manager.ensureStarted()]);
  assert.equal(starts, 1);
  assert.equal(rootLookups, 0);
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await (await fetch(endpoint + '/health')).json()).product, 'fitpoly-local-experience');
  await manager.ensureStarted();
  assert.equal(starts, 1);
  await manager.close();
  assert.equal(server.listening, false);
  await assert.rejects(manager.ensureStarted(), /종료/);
});

test('an existing compatible connector is reused and never stopped with the development server', async () => {
  const manager = createDevConnectorManager({ fetchHealth: async () => ({ ok: true, json: async () => ({ product: 'fitpoly-local-experience', version: 3 }) }),
    createConnector: () => { throw Error('must reuse existing connector'); } });
  assert.equal((await manager.ensureStarted()).ready, true);
  await manager.close();
});

test('a foreign or outdated service is not replaced', async () => {
  for (const health of [{ product: 'other-app', version: 3 }, { product: 'fitpoly-local-experience', version: 2 }]) {
    const manager = createDevConnectorManager({ fetchHealth: async () => ({ ok: true, json: async () => health }),
      createConnector: () => { throw Error('must not start another connector'); } });
    await assert.rejects(manager.ensureStarted(), /다른 프로그램이나 이전 탐색기/);
    await manager.close();
  }
});

test('middleware starts only on an authorized POST; errors remain actionable', async () => {
  let middleware, starts = 0, closes = 0;
  const plugin = localExperienceDevPlugin({ manager: {
    async ensureStarted() { starts++; return { ready: true, version: 3 }; }, async close() { closes++; },
  } });
  plugin.configureServer({ middlewares: { use(value) { middleware = value; } } });
  async function request(req) {
    let next = false;
    const res = { setHeader() {}, end(text) { this.body = JSON.parse(text); } };
    await middleware(req, res, () => { next = true; });
    // The start promise is resolved before the next microtask.
    await Promise.resolve();
    return { res, next };
  }
  assert.equal((await request(startRequest({ method: 'GET' }))).res.statusCode, 405);
  assert.equal((await request(startRequest({ headers: {} }))).res.statusCode, 403);
  assert.equal((await request(startRequest({ url: '/api/experience' }))).next, true);
  assert.equal(starts, 0);
  const result = await request(startRequest());
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body.ready, true);
  assert.equal(starts, 1);
  await plugin.closeBundle();
  assert.equal(closes, 1);
});

test('a busy port fails without terminating the listening program', async t => {
  const other = http.createServer((_req, res) => res.end('other app'));
  other.listen(0, '127.0.0.1'); await once(other, 'listening');
  t.after(() => new Promise(resolve => other.close(resolve)));
  const manager = createDevConnectorManager({ port: other.address().port, fetchHealth: async () => { throw Error('unrecognized'); } });
  await assert.rejects(manager.ensureStarted(), /포트 사용 여부/);
  assert.equal(other.listening, true);
  await manager.close();
});
