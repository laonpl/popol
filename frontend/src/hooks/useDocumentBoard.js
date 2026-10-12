import { useEffect } from 'react';
import { create } from 'zustand';
import api from '../services/api';
import useAuthStore from '../stores/authStore';

// The queue lives beyond the hub component. Opening a document while saves are
// pending must not cancel the remaining moves.
const useBoardStore = create(() => ({ userId: null, entries: {}, ready: true, error: '', saving: false }));
let confirmed = {};
let pending = [];
let queue = Promise.resolve();
let epoch = 0;
let sequence = 0;

// Account changes clear the cached board even while the hub is not mounted.
const unsubscribeAuth = useAuthStore.subscribe((state, previous) => {
  if (state.user?.uid === previous.user?.uid) return;
  epoch += 1;
  confirmed = {};
  pending = [];
  queue = Promise.resolve();
  useBoardStore.setState({ userId: null, entries: {}, ready: true, error: '', saving: false });
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribeAuth);

function publish(patch = {}) {
  const entries = { ...confirmed };
  pending.forEach(op => op.changes.forEach(({ key, ...value }) => { entries[key] = value; }));
  useBoardStore.setState({ ...patch, entries, saving: pending.length > 0 });
}

async function load(userId, refresh = false) {
  if (!refresh && useBoardStore.getState().userId === userId) return;
  if (refresh && pending.length) return;
  const generation = ++epoch;
  confirmed = {};
  pending = [];
  queue = Promise.resolve();
  useBoardStore.setState({ userId, entries: {}, ready: !userId, error: '', saving: false });
  if (!userId) return;
  try {
    const { data } = await api.get('/document-board');
    if (generation !== epoch) return;
    confirmed = data.entries || {};
    publish({ ready: true, error: '' });
  } catch {
    if (generation === epoch) publish({ ready: false, error: '서류 상태를 불러오지 못했어요.' });
  }
}

function update(changes) {
  const { userId, ready } = useBoardStore.getState();
  if (!userId || !ready || !changes.length) return Promise.resolve(false);
  const generation = epoch;
  const op = { id: ++sequence, changes };
  pending.push(op);
  publish({ error: '' });
  const task = queue.then(async () => {
    if (generation !== epoch || useAuthStore.getState().user?.uid !== userId) return false;
    let success = false;
    try {
      for (let index = 0; index < changes.length; index += 100) {
        if (generation !== epoch || useAuthStore.getState().user?.uid !== userId) return false;
        const part = changes.slice(index, index + 100);
        const { data } = await api.patch('/document-board', { changes: part });
        if (generation !== epoch) return false;
        Object.assign(confirmed, data.entries || Object.fromEntries(part.map(({ key, ...value }) => [key, value])));
      }
      success = true;
    } catch {
      if (generation !== epoch) return false;
    }
    pending = pending.filter(item => item.id !== op.id);
    publish({ error: success ? '' : '변경을 저장하지 못해 이전 위치로 돌렸어요.' });
    return success;
  });
  queue = task;
  return task;
}

export default function useDocumentBoard(userId) {
  const state = useBoardStore();
  useEffect(() => { load(userId || null); }, [userId]);
  const visible = state.userId === (userId || null) ? state : { entries: {}, ready: !userId, error: '', saving: false };
  return { ...visible, update, reload: () => load(userId || null, true) };
}
