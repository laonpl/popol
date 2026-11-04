import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeExperienceForCurrentJob } from '../utils/experienceCompatibility.js';

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}
function harness(name, api) {
  const source = fs.readFileSync(new URL(`./${name}Store.js`, import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '')
    .replace(`default use${name[0].toUpperCase()}${name.slice(1)}Store;`, `module.exports = use${name[0].toUpperCase()}${name.slice(1)}Store;`);
  const context = {
    api, normalizeExperienceForCurrentJob, module: { exports: null },
    console: { error() {} },
    create: initialize => {
      let state;
      const get = () => state;
      const set = value => { state = { ...state, ...(typeof value === 'function' ? value(state) : value) }; };
      state = initialize(set, get);
      return { getState: get };
    },
  };
  vm.runInNewContext(source, context);
  return context.module.exports;
}

for (const [name, list, fetch, clear, remove] of [
  ['experience', 'experiences', 'fetchExperiences', 'clearExperiences', 'deleteExperience'],
  ['portfolio', 'portfolios', 'fetchPortfolios', 'clearPortfolios', 'deletePortfolio'],
]) {
  test(`${name}: successful empty lists refresh without hiding the page`, async () => {
    const request = deferred();
    let calls = 0;
    const store = harness(name, { get: async () => ++calls === 1 ? { data: [] } : request.promise });
    await store.getState()[fetch]('a');
    const reload = store.getState()[fetch]('a');
    assert.equal(store.getState().loading, false);
    request.resolve({ data: [] });
    await reload;
    assert.equal(store.getState().loadError, null);
  });

  test(`${name}: previous data stays visible during refresh and errors`, async () => {
    let fail = false;
    const store = harness(name, { get: async () => {
      if (fail) throw new Error('offline');
      return { data: [{ id: 'saved', title: 'saved' }] };
    } });
    await store.getState()[fetch]('a');
    fail = true;
    const reload = store.getState()[fetch]('a');
    assert.equal(store.getState().loading, false);
    assert.equal(store.getState()[list][0].id, 'saved');
    await reload;
    assert.equal(store.getState().loadError, 'offline');
    assert.equal(store.getState()[list][0].id, 'saved');
  });

  test(`${name}: switching accounts or signing out discards late lists`, async () => {
    const old = deferred();
    let calls = 0;
    const store = harness(name, { get: async () => ++calls === 1 ? old.promise : { data: [{ id: 'b' }] } });
    const first = store.getState()[fetch]('a');
    await store.getState()[fetch]('b');
    old.resolve({ data: [{ id: 'a' }] });
    await first;
    assert.equal(store.getState()[list][0].id, 'b');
    store.getState()[clear]();
    assert.equal(store.getState()[list].length, 0);
    assert.equal(store.getState()._hasLoaded, false);
  });

  test(`${name}: an old refresh cannot restore a deleted document`, async () => {
    const old = deferred();
    let calls = 0;
    const store = harness(name, { get: async () => ++calls === 1 ? { data: [{ id: 'deleted' }] } : old.promise, delete: async () => {} });
    await store.getState()[fetch]('a');
    const reload = store.getState()[fetch]('a');
    await store.getState()[remove]('deleted');
    old.resolve({ data: [{ id: 'deleted' }] });
    await reload;
    assert.equal(store.getState()[list].length, 0);
  });
}
