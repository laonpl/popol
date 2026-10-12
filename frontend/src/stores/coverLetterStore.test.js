import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeCoverLetter, normalizeQuestions, stripUndefined } from '../utils/coverLetter.js';

// Inject the REST proxy so these tests cannot access Firebase or charge AI credits.
const source = fs.readFileSync(new URL('./coverLetterStore.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default useCoverLetterStore;', 'module.exports = useCoverLetterStore;');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness(overrides = {}) {
  const proxy = {
    collection: (_db, collectionName) => ({ collectionName }),
    doc: (_db, collectionName, id) => ({ collectionName, id }),
    where: (field, operator, value) => ({ field, operator, value }),
    query: (ref, ...constraints) => ({ ...ref, constraints }),
    getDocs: async () => ({ docs: [] }),
    getDoc: async ref => ({ id: ref.id, exists: () => true, data: () => ({ userId: 'user-a', title: '저장된 글' }) }),
    addDoc: async (_ref, data) => ({ id: 'new', data: { ...data, id: 'new' } }),
    updateDoc: async (_ref, data) => data,
    deleteDoc: async () => ({}),
    ...overrides,
  };
  const context = {
    ...proxy, normalizeCoverLetter, normalizeQuestions, stripUndefined,
    create: initialize => {
      let state;
      const get = () => state;
      const set = patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; };
      state = initialize(set, get);
      return { getState: get };
    },
    module: { exports: null },
  };
  vm.runInNewContext(source, context, { filename: 'coverLetterStore.js' });
  return context.module.exports;
}

const snapshot = letters => ({ docs: letters.map(letter => ({ id: letter.id, data: () => letter })) });

test('a late list from another signed-in user cannot restore their drafts', async () => {
  const previous = deferred();
  let requests = 0;
  const store = harness({ getDocs: async () => ++requests === 1 ? previous.promise : snapshot([{ id: 'b', userId: 'user-b', title: '새 계정' }]) });
  const first = store.getState().fetchCoverLetters('user-a');
  await store.getState().fetchCoverLetters('user-b');
  previous.resolve(snapshot([{ id: 'a', userId: 'user-a', title: '이전 계정' }]));
  await first;
  assert.equal(store.getState().coverLetters.length, 1);
  assert.equal(store.getState().coverLetters[0].id, 'b');
  assert.equal(store.getState()._userId, 'user-b');
});

test('sign out prevents in-flight create and get requests from repopulating local data', async () => {
  const creation = deferred();
  const lookup = deferred();
  const store = harness({ addDoc: async () => creation.promise, getDoc: async () => lookup.promise });
  const creating = store.getState().createCoverLetter('user-a', { title: '임시 글' });
  const getting = store.getState().getCoverLetter('old');
  store.getState().clearCoverLetters();
  creation.resolve({ id: 'new', data: { userId: 'user-a' } });
  lookup.resolve({ id: 'old', exists: () => true, data: () => ({ userId: 'user-a' }) });
  await Promise.all([creating, getting]);
  assert.equal(store.getState().coverLetters.length, 0);
  assert.equal(store.getState().currentLetter, null);
  assert.equal(store.getState()._userId, null);
});

test('draft updates remove unsupported ownership edits and preserve answers and saved evidence', async () => {
  let sent;
  const store = harness({ updateDoc: async (_ref, data) => { sent = data; return { ...data, updatedAt: '2026-10-07T01:00:00Z' }; } });
  await store.getState().createCoverLetter('user-a', { title: '내 글' });
  await store.getState().updateCoverLetter('new', {
    userId: 'other', id: 'other', createdAt: 'fake',
    questions: [{ id: 'q', question: '협업', source: 'posting', sourceQuote: '원문 질문', answer: '내가 직접 작성한 글', evidence: [{ experienceId: 'e', quote: '내 기록', extra: undefined }] }],
  });
  assert.equal(sent.userId, undefined);
  assert.equal(sent.id, undefined);
  assert.equal(sent.createdAt, undefined);
  assert.equal(sent.questions[0].evidence[0].extra, undefined);
  assert.equal(store.getState().currentLetter.userId, 'user-a');
  assert.equal(store.getState().currentLetter.questions[0].answer, '내가 직접 작성한 글');
  assert.equal(store.getState().currentLetter.questions[0].evidence[0].quote, '내 기록');
});

test('a stale list cannot bring a deleted draft back into the hub', async () => {
  const oldList = deferred();
  const store = harness({ getDocs: async () => oldList.promise });
  await store.getState().createCoverLetter('user-a', { title: '삭제할 글' });
  const fetching = store.getState().fetchCoverLetters('user-a');
  await store.getState().deleteCoverLetter('new');
  oldList.resolve(snapshot([{ id: 'new', userId: 'user-a', title: '오래된 응답' }]));
  await fetching;
  assert.equal(store.getState().coverLetters.length, 0);
  assert.equal(store.getState().currentLetter, null);
  assert.equal(store.getState().loading, false);
});

test('list failures remain distinguishable from a successful empty list', async () => {
  const store = harness({ getDocs: async () => { throw new Error('서버 연결 실패'); } });
  await store.getState().fetchCoverLetters('user-a');
  assert.equal(store.getState().loadError, '서버 연결 실패');
  assert.equal(store.getState().loading, false);
});
