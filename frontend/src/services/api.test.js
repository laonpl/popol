import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import axios from 'axios';
import { createReadCache, isCacheableRead, readResource } from './readCache.js';

const source = fs.readFileSync(new URL('./api.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/import\.meta\.env\.DEV/g, 'false')
  .replace(/export (const|function) /g, '$1 ')
  .replace('export default api;', 'module.exports = { api, clearApiReadCache };');

function harness(respond = config => ({ id: 'doc', title: 'saved' })) {
  const requests = [], events = [];
  const user = uid => ({ uid, getIdToken: async () => `header.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600, uid })).toString('base64')}.signature` });
  const auth = { currentUser: user('a') };
  const context = {
    axios, auth, createReadCache, isCacheableRead, readResource, structuredClone, atob,
    getApiBaseUrl: () => '', reportClientError: () => {},
    window: { dispatchEvent: event => events.push(event.type) }, Event, CustomEvent,
    console: { error() {}, warn() {} }, module: { exports: {} },
  };
  vm.runInNewContext(source, context);
  const { api } = context.module.exports;
  api.defaults.adapter = async config => {
    requests.push(config);
    return { data: await respond(config), status: 200, statusText: 'OK', headers: {}, config };
  };
  return { ...context.module.exports, requests, events, auth, user };
}

test('revisits reuse data, callers get independent copies, and reads do not trigger credit requests', async () => {
  const { api, requests, events } = harness(() => ({ id: 'doc', title: 'original' }));
  const [first, second] = await Promise.all([api.get('/experience/doc'), api.get('/experience/doc')]);
  first.data.title = 'local edit';
  assert.equal(second.data.title, 'original');
  assert.equal((await api.get('/experience/doc')).data.title, 'original');
  assert.equal(requests.length, 1);
  assert.deepEqual(events, []);
});

test('opening an experience or portfolio from a full list needs no duplicate detail request', async () => {
  const { api, requests } = harness(() => [{ id: 'doc', structuredResult: { intro: 'complete document' } }]);
  for (const resource of ['experience', 'portfolio', 'coverletter']) {
    await api.get(`/${resource}/list`);
    assert.equal((await api.get(`/${resource}/doc`)).data.structuredResult.intro, 'complete document');
  }
  assert.deepEqual(requests.map(config => config.url), ['/experience/list', '/portfolio/list', '/coverletter/list']);
});

test('edits invalidate related lists and details while unrelated cached documents stay available', async () => {
  const { api, requests, events } = harness(config => config.url === '/experience/list' ? [] : { id: 'doc' });
  await api.get('/experience/list');
  await api.get('/experience/doc');
  await api.get('/portfolio/doc');
  await api.patch('/experience/doc', { title: 'new' });
  await api.get('/experience/list');
  await api.get('/experience/doc');
  await api.get('/portfolio/doc');
  assert.equal(requests.length, 6);
  assert.deepEqual(events, ['credits:refresh']);
});

test('company-folder renames invalidate cross-document caches and analytics do not refresh credits', async () => {
  const { api, requests, events } = harness();
  await api.get('/experience/doc');
  await api.get('/portfolio/doc');
  await api.post('/company-folders/rename', { from: 'a', to: 'b' });
  await api.get('/experience/doc');
  await api.get('/portfolio/doc');
  await api.post('/analytics/event', { eventName: 'visit' });
  assert.equal(requests.length, 6);
  assert.deepEqual(events, ['credits:refresh']);
});

test('account switching and explicit refresh never reuse another account or old token', async () => {
  const { api, requests, auth, user, clearApiReadCache } = harness();
  await api.get('/experience/doc');
  auth.currentUser = user('b');
  await api.get('/experience/doc');
  assert.notEqual(requests[0].headers.Authorization, requests[1].headers.Authorization);
  await api.get('/experience/doc', { forceRefresh: true });
  clearApiReadCache();
  await api.get('/experience/doc');
  assert.equal(requests.length, 4);
});

test('cancellable reads and downloads keep their independent request lifecycle', async () => {
  const { api, requests } = harness();
  await api.get('/experience/doc', { signal: new AbortController().signal });
  await api.get('/experience/doc', { signal: new AbortController().signal });
  await api.get('/portfolio/doc', { responseType: 'blob' });
  await api.get('/portfolio/doc', { responseType: 'blob' });
  assert.equal(requests.length, 4);
});
