import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDocumentBoard, documentMoveChange, documentMoveChanges } from './documentBoard.js';

const doc = (boardKey, status, order) => ({ boardKey, status, order });

test('saved progress overrides inferred status without changing publication data', () => {
  const portfolio = { isPublic: true };
  const [item] = applyDocumentBoard([{ boardKey: 'portfolio:p', status: 'public', portfolio }], { 'portfolio:p': { status: 'draft', order: 12 } });
  assert.equal(item.status, 'draft');
  assert.equal(item.order, 12);
  assert.equal(item.portfolio.isPublic, true);
});

test('moves and reorders a document between its visible neighbours without rewriting hidden cards', () => {
  const documents = [doc('a', 'done', 1024), doc('b', 'done', 4096), doc('move', 'draft', 2048)];
  const change = documentMoveChange(documents[2], 'done', 1, documents);
  assert.deepEqual(change, { key: 'move', status: 'done', order: 2560 });
  assert.deepEqual(documents.map(d => d.status), ['done', 'done', 'draft']);
  const moved = { ...documents[2], ...change, boardKey: change.key };
  assert.equal(documentMoveChange(moved, 'done', 0, [...documents, moved]).order, 512);
  assert.equal(documentMoveChange(documents[2], 'done', undefined, documents).order, 5120);
});

test('new and invalid persisted documents keep a usable default order and status', () => {
  const items = applyDocumentBoard([doc('a', 'done'), doc('b', 'draft')], { a: { status: 'bad', order: null } });
  assert.deepEqual(items.map(d => [d.status, d.order]), [['done', 1024], ['draft', 2048]]);
  assert.equal(documentMoveChange(items[0], 'bad', 0, items), null);
});

test('repeated insertion into one gap preserves the requested order after rank precision is exhausted', () => {
  let documents = [doc('anchor', 'done', 1024), doc('a', 'done', 2048), doc('b', 'done', 3072)];
  const entries = Object.fromEntries(documents.map(item => [item.boardKey, { status: item.status, order: item.order }]));
  let rebalances = 0;
  for (let step = 0; step < 120; step += 1) {
    const key = step % 2 === 0 ? 'b' : 'a';
    const moved = documents.find(item => item.boardKey === key);
    const changes = documentMoveChanges(moved, 'done', 1, documents);
    if (changes.length > 1) rebalances += 1;
    changes.forEach(({ key: changedKey, ...entry }) => { entries[changedKey] = entry; });
    documents = applyDocumentBoard(documents, entries).sort((a, b) => a.order - b.order);
    assert.equal(documents[1].boardKey, key);
    assert.ok(documents.every((item, index) => index === 0 || item.order > documents[index - 1].order));
  }
  assert.ok(rebalances > 0, 'The sequence must reach and recover from the numeric boundary');
});

test('rebalancing includes hidden destination cards while preserving their relative order', () => {
  const all = [doc('a', 'done', 1024), doc('hidden', 'done', 1024), doc('b', 'done', 1024), doc('move', 'draft', 4096), doc('other', 'public', 1024)];
  const visible = [all[0], all[2], all[3]];
  const changes = documentMoveChanges(all[3], 'done', 1, visible, all);
  assert.deepEqual(changes, [
    { key: 'a', status: 'done', order: 1024 },
    { key: 'hidden', status: 'done', order: 2048 },
    { key: 'move', status: 'done', order: 3072 },
    { key: 'b', status: 'done', order: 4096 },
  ]);
  assert.deepEqual(all.map(item => item.order), [1024, 1024, 1024, 4096, 1024]);
});

test('appending near the backend rank limit rebalances instead of creating an unsavable move', () => {
  const documents = [doc('last', 'done', 1_000_000_000), doc('move', 'draft', 1024)];
  assert.deepEqual(documentMoveChanges(documents[1], 'done', undefined, documents), [
    { key: 'last', status: 'done', order: 1024 },
    { key: 'move', status: 'done', order: 2048 },
  ]);
  assert.deepEqual(documentMoveChanges(documents[1], 'invalid', 0, documents), []);
});
