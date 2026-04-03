import { create } from 'zustand';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs,
  query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import api from '../services/api';

const useCoverLetterStore = create((set, get) => ({
  coverLetters: [],
  currentCoverLetter: null,
  loading: false,

  fetchCoverLetters: async (userId) => {
    set({ loading: true });
    try {
      const q = query(
        collection(db, 'coverLetters'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const coverLetters = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      set({ coverLetters, loading: false });
    } catch (error) {
      console.error('자소서 로딩 실패:', error);
      set({ loading: false });
    }
  },

  createCoverLetter: async (userId, data) => {
    const docData = {
      userId,
      title: data.title || '새 자기소개서',
      targetCompany: data.targetCompany || '',
      targetPosition: data.targetPosition || '',
      questions: data.questions || [
        { question: '', answer: '', linkedExperienceIds: [], wordCount: 0, maxWordCount: 500 }
      ],
      experienceIds: [],
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (data.jobAnalysis) docData.jobAnalysis = data.jobAnalysis;
    const docRef = await addDoc(collection(db, 'coverLetters'), docData);
    return docRef.id;
  },

  updateCoverLetter: async (id, data) => {
    await updateDoc(doc(db, 'coverLetters', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    const coverLetters = get().coverLetters.map(c =>
      c.id === id ? { ...c, ...data } : c
    );
    set({ coverLetters });
  },

  deleteCoverLetter: async (id) => {
    await deleteDoc(doc(db, 'coverLetters', id));
    set({ coverLetters: get().coverLetters.filter(c => c.id !== id) });
  },

  setCurrentCoverLetter: (c) => set({ currentCoverLetter: c }),

  // AI 기반 자소서 초안 생성 (경험 DB 연동)
  generateDraft: async (coverLetterId, questionIndex) => {
    set({ loading: true });
    try {
      const res = await api.post('/coverletter/generate', {
        coverLetterId,
        questionIndex,
      });
      set({ loading: false });
      return res.data.draft;
    } catch (error) {
      console.error('자소서 초안 생성 실패:', error);
      set({ loading: false });
      throw error;
    }
  },

  // 경험 카드와 자소서 문항 연결
  linkExperience: async (coverLetterId, questionIndex, experienceId) => {
    const cl = get().currentCoverLetter;
    if (!cl) return;
    const questions = [...cl.questions];
    const linked = questions[questionIndex].linkedExperienceIds || [];
    if (!linked.includes(experienceId)) {
      questions[questionIndex] = {
        ...questions[questionIndex],
        linkedExperienceIds: [...linked, experienceId],
      };
      await get().updateCoverLetter(coverLetterId, { questions });
      set({ currentCoverLetter: { ...cl, questions } });
    }
  },
}));

export default useCoverLetterStore;
