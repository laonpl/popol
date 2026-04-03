import { create } from 'zustand';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs,
  query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import api from '../services/api';

const FRAMEWORKS = {
  STAR: {
    name: 'STAR 기법',
    description: '구조화된 경험 정리 - 상황, 과제, 행동, 결과',
    fields: [
      { key: 'situation', label: '상황 (S)', placeholder: '어떤 상황이었나요? 배경과 맥락을 설명해주세요.', color: 'bg-red-50 border-red-200' },
      { key: 'task', label: '과제 (T)', placeholder: '해결해야 할 과제나 목표는 무엇이었나요?', color: 'bg-yellow-50 border-yellow-200' },
      { key: 'action', label: '행동 (A)', placeholder: '구체적으로 어떤 행동을 취했나요?', color: 'bg-green-50 border-green-200' },
      { key: 'result', label: '결과 (R)', placeholder: '어떤 결과를 얻었나요? 정량적 성과가 있다면 포함해주세요.', color: 'bg-blue-50 border-blue-200' },
    ],
  },
  '5F': {
    name: '5F 회고',
    description: '사실-감정-발견-미래-피드백 기반 성찰',
    fields: [
      { key: 'fact', label: '사실 (Fact)', placeholder: '객관적인 사실을 기술해주세요.', color: 'bg-slate-50 border-slate-200' },
      { key: 'feeling', label: '느낌 (Feeling)', placeholder: '어떤 감정을 느꼈나요?', color: 'bg-pink-50 border-pink-200' },
      { key: 'finding', label: '교훈 (Finding)', placeholder: '무엇을 배우고 발견했나요?', color: 'bg-purple-50 border-purple-200' },
      { key: 'future', label: '향후 계획 (Future)', placeholder: '앞으로 어떻게 적용할 건가요?', color: 'bg-indigo-50 border-indigo-200' },
      { key: 'feedback', label: '피드백 (Feedback)', placeholder: '타인이나 본인에게 어떤 피드백이 있었나요?', color: 'bg-cyan-50 border-cyan-200' },
    ],
  },
  PMI: {
    name: 'PMI 회고',
    description: '긍정적인 면, 부정적인 면, 흥미로운 점',
    fields: [
      { key: 'plus', label: 'Plus (긍정적인 면)', placeholder: '좋았던 점, 잘된 점을 적어주세요.', color: 'bg-green-50 border-green-200' },
      { key: 'minus', label: 'Minus (부정적인 면)', placeholder: '아쉬웠거나 부족했던 점을 적어주세요.', color: 'bg-red-50 border-red-200' },
      { key: 'interesting', label: 'Interesting (흥미로운 점)', placeholder: '새롭게 발견하거나 흥미로웠던 점을 적어주세요.', color: 'bg-yellow-50 border-yellow-200' },
    ],
  },
  KPT: {
    name: 'KPT 회고',
    description: '유지할 점, 문제점, 시도할 점',
    fields: [
      { key: 'keep', label: 'Keep (유지할 점)', placeholder: '계속 유지하고 싶은 것을 적어주세요.', color: 'bg-green-50 border-green-200' },
      { key: 'problem', label: 'Problem (문제점)', placeholder: '문제가 되었던 것을 적어주세요.', color: 'bg-red-50 border-red-200' },
      { key: 'try', label: 'Try (시도할 점)', placeholder: '새롭게 시도해볼 것을 적어주세요.', color: 'bg-blue-50 border-blue-200' },
    ],
  },
  '4L': {
    name: '4L 회고',
    description: '좋았던 것, 배운 것, 부족했던 것, 바라는 것',
    fields: [
      { key: 'liked', label: 'Liked (좋았던 것)', placeholder: '좋았던 경험을 적어주세요.', color: 'bg-green-50 border-green-200' },
      { key: 'learned', label: 'Learned (배운 것)', placeholder: '배운 점을 적어주세요.', color: 'bg-blue-50 border-blue-200' },
      { key: 'lacked', label: 'Lacked (부족했던 것)', placeholder: '부족했던 점을 적어주세요.', color: 'bg-orange-50 border-orange-200' },
      { key: 'longedFor', label: 'Longed For (바라는 것)', placeholder: '앞으로 바라는 것을 적어주세요.', color: 'bg-purple-50 border-purple-200' },
    ],
  },
};

const useExperienceStore = create((set, get) => ({
  experiences: [],
  currentExperience: null,
  frameworks: FRAMEWORKS,
  loading: false,
  analysisResult: null,

  fetchExperiences: async (userId) => {
    set({ loading: true });
    try {
      const q = query(
        collection(db, 'experiences'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const experiences = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      set({ experiences, loading: false });
    } catch (error) {
      console.error('경험 목록 로딩 실패:', error);
      set({ loading: false });
    }
  },

  createExperience: async (userId, data) => {
    const docRef = await addDoc(collection(db, 'experiences'), {
      userId,
      ...data,
      keywords: [],
      highlights: [],
      aiAnalysis: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  updateExperience: async (id, data) => {
    await updateDoc(doc(db, 'experiences', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    const experiences = get().experiences.map(e =>
      e.id === id ? { ...e, ...data } : e
    );
    set({ experiences });
  },

  deleteExperience: async (id) => {
    await deleteDoc(doc(db, 'experiences', id));
    set({ experiences: get().experiences.filter(e => e.id !== id) });
  },

  analyzeExperience: async (experienceId) => {
    set({ loading: true });
    try {
      const res = await api.post('/experience/analyze', { experienceId });
      const analysis = res.data;
      await updateDoc(doc(db, 'experiences', experienceId), {
        aiAnalysis: analysis,
        keywords: analysis.competencyKeywords || [],
        updatedAt: serverTimestamp(),
      });
      set({ analysisResult: analysis, loading: false });
      return analysis;
    } catch (error) {
      console.error('AI 분석 실패:', error);
      set({ loading: false });
      throw error;
    }
  },

  setCurrentExperience: (exp) => set({ currentExperience: exp }),
  clearAnalysis: () => set({ analysisResult: null }),
}));

export default useExperienceStore;
export { FRAMEWORKS };
