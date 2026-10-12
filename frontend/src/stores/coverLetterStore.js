import { create } from 'zustand';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from '../services/firestoreProxy';
import { normalizeCoverLetter, normalizeQuestions, stripUndefined } from '../utils/coverLetter';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.getTime === 'function') return value.getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const sortLetters = letters => [...letters].sort((a, b) =>
  toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
const draftError = error => error.response?.data?.error || error.message || '자기소개서를 불러오지 못했어요.';

const useCoverLetterStore = create((set, get) => ({
  coverLetters: [],
  currentLetter: null,
  loading: false,
  loadError: null,
  _userId: null,
  _scopeVersion: 0,
  _fetchVersion: 0,
  _getVersion: 0,

  clearCoverLetters: () => set(state => ({
    coverLetters: [], currentLetter: null, loading: false, loadError: null,
    _userId: null, _scopeVersion: state._scopeVersion + 1, _fetchVersion: state._fetchVersion + 1, _getVersion: state._getVersion + 1,
  })),

  setCurrentLetter: letter => set(state => ({ currentLetter: letter ? normalizeCoverLetter(letter) : null, _getVersion: state._getVersion + 1 })),

  fetchCoverLetters: async userId => {
    if (!userId) {
      get().clearCoverLetters();
      return [];
    }
    if (get()._userId !== userId) get().clearCoverLetters();
    set(state => ({ _userId: userId, loading: true, loadError: null, _fetchVersion: state._fetchVersion + 1 }));
    const { _scopeVersion: scopeVersion, _fetchVersion: fetchVersion } = get();
    try {
      const snapshot = await getDocs(query(collection(null, 'coverLetters'), where('userId', '==', userId)));
      const coverLetters = sortLetters(snapshot.docs
        .map(item => normalizeCoverLetter({ ...item.data(), id: item.id }))
        .filter(item => item.userId === userId));
      if (get()._scopeVersion === scopeVersion && get()._fetchVersion === fetchVersion) {
        set({ coverLetters, loading: false });
      }
      return coverLetters;
    } catch (error) {
      if (get()._scopeVersion === scopeVersion && get()._fetchVersion === fetchVersion) {
        set({ loading: false, loadError: draftError(error) });
      }
      return [];
    }
  },

  getCoverLetter: async id => {
    set(state => ({ _getVersion: state._getVersion + 1 }));
    const { _scopeVersion: scopeVersion, _userId: userId } = get();
    const getVersion = get()._getVersion;
    const snapshot = await getDoc(doc(null, 'coverLetters', id));
    if (!snapshot.exists()) return null;
    const letter = normalizeCoverLetter({ ...snapshot.data(), id: snapshot.id });
    if (userId && letter.userId !== userId) throw new Error('이 자기소개서에 접근할 수 없어요.');
    if (get()._scopeVersion === scopeVersion && get()._getVersion === getVersion) set({ currentLetter: letter });
    return letter;
  },

  createCoverLetter: async (userId, data = {}) => {
    if (!userId) throw new Error('로그인 후 자기소개서를 저장할 수 있어요.');
    if (get()._userId !== userId) get().clearCoverLetters();
    set({ _userId: userId });
    const scopeVersion = get()._scopeVersion;
    const payload = normalizeCoverLetter({ ...data, userId });
    delete payload.id;
    delete payload.createdAt;
    delete payload.updatedAt;
    const created = await addDoc(collection(null, 'coverLetters'), payload);
    const letter = normalizeCoverLetter({ ...payload, ...created.data, id: created.id });
    if (get()._scopeVersion === scopeVersion) {
      set(state => ({
        coverLetters: sortLetters([letter, ...state.coverLetters.filter(item => item.id !== letter.id)]), currentLetter: letter,
        loading: false, loadError: null, _fetchVersion: state._fetchVersion + 1, _getVersion: state._getVersion + 1,
      }));
    }
    return letter.id;
  },

  updateCoverLetter: async (id, data = {}, prevSnapshot) => {
    const scopeVersion = get()._scopeVersion;
    const payload = stripUndefined({ ...data });
    ['id', 'userId', 'createdAt', 'updatedAt'].forEach(key => { delete payload[key]; });
    if (payload.questions !== undefined) payload.questions = normalizeQuestions(payload.questions);
    const updates = prevSnapshot
      ? Object.fromEntries(Object.entries(payload).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(prevSnapshot[key])))
      : payload;
    if (Object.keys(updates).length === 0) return;
    const saved = await updateDoc(doc(null, 'coverLetters', id), updates);
    if (get()._scopeVersion === scopeVersion) {
      const merge = letter => normalizeCoverLetter({ ...letter, ...updates, ...(saved || {}), id });
      set(state => ({
        coverLetters: sortLetters(state.coverLetters.map(letter => letter.id === id ? merge(letter) : letter)),
        currentLetter: state.currentLetter?.id === id ? merge(state.currentLetter) : state.currentLetter,
        loading: false, loadError: null, _fetchVersion: state._fetchVersion + 1,
      }));
    }
    return saved;
  },

  deleteCoverLetter: async id => {
    const scopeVersion = get()._scopeVersion;
    await deleteDoc(doc(null, 'coverLetters', id));
    if (get()._scopeVersion === scopeVersion) {
      set(state => ({
        coverLetters: state.coverLetters.filter(letter => letter.id !== id),
        currentLetter: state.currentLetter?.id === id ? null : state.currentLetter,
        loading: false, loadError: null, _fetchVersion: state._fetchVersion + 1,
      }));
    }
  },
}));

export default useCoverLetterStore;
