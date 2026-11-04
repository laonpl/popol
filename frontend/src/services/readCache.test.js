import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadCache } from './readCache.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('concurrent reads share a request, successful empty data expires, and force refresh bypasses it', async () => {
  let time = 0, requests = 0;
  const cache = createReadCache({ getScope: () => 'a', now: () => time, ttl: 30 });
  const pending = deferred();
  const load = () => { requests++; return pending.promise; };
  const first = cache.read('list', load);
  const second = cache.read('list', load);
  pending.resolve([]);
  await Promise.all([first, second]);
  assert.equal(requests, 1);
  await cache.read('list', load);
  assert.equal(requests, 1);
  time = 30;
  await cache.read('list', load);
  assert.equal(requests, 2);
  await cache.read('list', load, { force: true });
  assert.equal(requests, 3);
});

test('failed reads can be retried immediately', async () => {
  const cache = createReadCache({ getScope: () => 'a' });
  await assert.rejects(cache.read('doc', () => Promise.reject(new Error('offline'))));
  assert.equal(cache.peek('doc'), undefined);
  assert.equal(await cache.read('doc', () => 'recovered'), 'recovered');
});

test('saving during an in-flight read prevents the old response from repopulating the cache', async () => {
  const cache = createReadCache({ getScope: () => 'a' });
  const old = deferred();
  const first = cache.read('doc', () => old.promise);
  cache.invalidate();
  assert.equal(await cache.read('doc', () => 'saved'), 'saved');
  old.resolve('old');
  await first;
  assert.equal(cache.peek('doc'), 'saved');
});

test('account changes discard cached data and reject late responses from the old account', async () => {
  let user = 'a';
  const cache = createReadCache({ getScope: () => user });
  await cache.read('list', () => ['a']);
  const old = deferred();
  const pending = cache.read('doc', () => old.promise);
  user = 'b';
  assert.equal(cache.peek('list'), undefined);
  old.resolve('private a');
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cache.peek('doc'), undefined);
});

test('the least recently used documents are evicted to bound memory', async () => {
  const cache = createReadCache({ getScope: () => 'a', maxEntries: 2 });
  await cache.read('a', () => 'a');
  await cache.read('b', () => 'b');
  cache.peek('a');
  await cache.read('c', () => 'c');
  assert.equal(cache.peek('b'), undefined);
  assert.equal(cache.peek('a'), 'a');
});
