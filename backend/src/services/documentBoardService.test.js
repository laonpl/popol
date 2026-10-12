import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boardDocumentId,
  boardEntries,
  createDocumentBoardService,
  validateBoardChanges,
} from './documentBoardService.js';

const change = (key = 'portfolio:one', status = 'draft', order = 0) => ({ key, status, order });
const jsonEntries = entries => JSON.parse(JSON.stringify(entries));

function memoryDb() {
  const stored = new Map();
  const writes = [];
  let commits = 0;
  let failure = null;

  return {
    stored,
    writes,
    get commits() { return commits; },
    failCommit(error) { failure = error; },
    collection(name) {
      assert.equal(name, 'documentBoards');
      return {
        doc(uid) {
          return {
            collection(subcollection) {
              assert.equal(subcollection, 'documents');
              return {
                doc(id) { return { uid, id }; },
                async get() {
                  return {
                    docs: [...(stored.get(uid) || new Map()).values()]
                      .map(value => ({ data: () => ({ ...value }) })),
                  };
                },
              };
            },
          };
        },
      };
    },
    batch() {
      const pending = [];
      return {
        set(ref, data, options) { pending.push({ ref, data, options }); },
        async commit() {
          if (failure) throw failure;
          commits += 1;
          for (const item of pending) {
            assert.deepEqual(item.options, { merge: true });
            const records = stored.get(item.ref.uid) || new Map();
            records.set(item.ref.id, { ...records.get(item.ref.id), ...item.data });
            stored.set(item.ref.uid, records);
            writes.push(item);
          }
        },
      };
    },
  };
}

test('accepts supported stages and exact key/order boundaries without coercion', () => {
  const changes = [change('a', 'draft'), change('b'.repeat(200), 'done', 1e9), change('한글:문서', 'public', 1.5)];
  assert.deepEqual(validateBoardChanges({ changes }), changes);
  assert.equal(validateBoardChanges({ changes: Array.from({ length: 100 }, (_, i) => change(`key:${i}`)) }).length, 100);
});

test('rejects malformed requests, unknown fields, duplicate keys, and invalid values with 400', () => {
  const invalidBodies = [
    null, [], {}, { changes: null }, { changes: {}, },
    { changes: [], uid: 'someone-else' },
    { changes: Array.from({ length: 101 }, (_, i) => change(`key:${i}`)) },
    { changes: [change(), change()] },
    { changes: [null] }, { changes: [change('', 'draft')] },
    { changes: [change('a'.repeat(201))] },
    ...['\n', '\u0000', '\u007f', '\u0085'].map(control => ({ changes: [change(`key${control}`)] })),
    { changes: [change(5)] },
    ...['published', 'Done', '', null].map(status => ({ changes: [change('key', status)] })),
    ...[-1, 1e9 + 1, NaN, Infinity, '1', null].map(order => ({ changes: [change('key', 'draft', order)] })),
    { changes: [{ key: 'key', status: 'draft' }] },
    { changes: [{ ...change(), isPublic: true }] },
  ];
  for (const body of invalidBodies) {
    assert.throws(() => validateBoardChanges(body), error => error.status === 400);
  }
});

test('hashed document ids safely handle slash-containing and long document keys', () => {
  const key = 'file:company/name/' + '문'.repeat(100);
  const id = boardDocumentId(key);
  assert.match(id, /^[a-f0-9]{64}$/);
  assert.equal(boardDocumentId(key), id);
  assert.notEqual(boardDocumentId(`${key}1`), id);
});

test('entry serialization handles special object keys and skips corrupt stored metadata', () => {
  const entries = boardEntries([
    change('__proto__', 'public', 2), change('constructor', 'done', 1),
    change('good', 'draft', 0), null, change('bad', 'published', 0),
    change('bad-order', 'draft', Infinity), { status: 'draft', order: 0 },
  ]);
  assert.equal(Object.getPrototypeOf(entries), null);
  assert.deepEqual(jsonEntries(entries), JSON.parse('{"__proto__":{"status":"public","order":2},"constructor":{"status":"done","order":1},"good":{"status":"draft","order":0}}'));
  assert.equal({}.status, undefined);
});

test('partial batch updates persist per user and leave unrelated metadata and stages intact', async () => {
  const db = memoryDb();
  const board = createDocumentBoardService(db);
  await board.patchEntries('alice', { changes: [change('p:one'), change('p:two', 'done', 10)] });
  await board.patchEntries('bob', { changes: [change('p:one', 'public', 20)] });
  db.stored.get('alice').get(boardDocumentId('p:one')).note = 'preserve extra metadata';

  const updated = await board.patchEntries('alice', { changes: [change('p:one', 'public', 3)] });
  assert.deepEqual(jsonEntries(updated), { 'p:one': { status: 'public', order: 3 } });
  assert.deepEqual(jsonEntries(await board.getEntries('alice')), {
    'p:one': { status: 'public', order: 3 }, 'p:two': { status: 'done', order: 10 },
  });
  assert.deepEqual(jsonEntries(await board.getEntries('bob')), { 'p:one': { status: 'public', order: 20 } });
  assert.equal(db.stored.get('alice').get(boardDocumentId('p:one')).note, 'preserve extra metadata');
  assert.equal(db.commits, 3);
  assert.ok(db.writes.every(write => !Object.hasOwn(write.data, 'isPublic')));
});

test('rejects a mixed valid/invalid batch before any Firestore writes', async () => {
  const db = memoryDb();
  const board = createDocumentBoardService(db);
  await assert.rejects(board.patchEntries('alice', { changes: [change(), change('bad', 'invalid')] }), error => error.status === 400);
  assert.equal(db.commits, 0);
  assert.equal(db.writes.length, 0);
  assert.deepEqual(jsonEntries(await board.getEntries('alice')), {});
});

test('empty patches are harmless and failed commits propagate without success data', async () => {
  const db = memoryDb();
  const board = createDocumentBoardService(db);
  assert.deepEqual(jsonEntries(await board.patchEntries('alice', { changes: [] })), {});
  assert.equal(db.commits, 0);
  db.failCommit(new Error('unavailable'));
  await assert.rejects(board.patchEntries('alice', { changes: [change()] }), /unavailable/);
  assert.equal(db.writes.length, 0);
});
