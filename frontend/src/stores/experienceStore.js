import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import api from '../services/api';

export const FRAMEWORKS = {
  STRUCTURED: {
    name: '경험 구조화',
    description: '7가지 섹션으로 경험을 체계적으로 정리합니다',
    fields: [
      { key: 'projectName', label: '프로젝트명', placeholder: '프로젝트 또는 활동의 이름을 입력하세요', color: 'bg-blue-50 border-blue-200' },
      { key: 'period', label: '기간', placeholder: '프로젝트 진행 기간을 입력하세요 (예: 2024.01 ~ 2024.06)', color: 'bg-indigo-50 border-indigo-200' },
      { key: 'reason', label: '선정이유', placeholder: '이 프로젝트를 선정한 이유를 설명해주세요', color: 'bg-purple-50 border-purple-200' },
      { key: 'solution', label: '솔루션', placeholder: '어떤 솔루션을 제시/구현했는지 설명해주세요', color: 'bg-violet-50 border-violet-200' },
      { key: 'solutionReason', label: '솔루션 채택 이유', placeholder: '해당 솔루션을 선택한 이유를 설명해주세요', color: 'bg-pink-50 border-pink-200' },
      { key: 'skills', label: '사용된 역량', placeholder: '이 경험에서 활용한 핵심 역량을 설명해주세요', color: 'bg-amber-50 border-amber-200' },
      { key: 'result', label: '결과', placeholder: '프로젝트의 결과와 성과를 설명해주세요', color: 'bg-emerald-50 border-emerald-200' },
    ],
  },
};

const useExperienceStore = create((set, get) => ({
  experiences: [],
  loading: false,

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
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0;
          return bTime - aTime;
        });
      set({ experiences });
    } catch (error) {
      console.error('경험 목록 불러오기 실패:', error);
    }
    set({ loading: false });
  },

  createExperience: async (userId, data) => {
    const docRef = await addDoc(collection(db, 'experiences'), {
      userId,
      title: data.title || '',
      framework: data.framework || 'STRUCTURED',
      content: data.content || {},
      images: data.images || [],
      keywords: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const newExp = { id: docRef.id, userId, ...data, createdAt: new Date(), updatedAt: new Date() };
    set(state => ({ experiences: [newExp, ...state.experiences] }));
    return docRef.id;
  },

  updateExperience: async (id, data) => {
    const ref = doc(db, 'experiences', id);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    set(state => ({
      experiences: state.experiences.map(e => e.id === id ? { ...e, ...data } : e),
    }));
  },

  deleteExperience: async (id) => {
    await deleteDoc(doc(db, 'experiences', id));
    set(state => ({
      experiences: state.experiences.filter(e => e.id !== id),
    }));
  },

  analyzeExperience: async (experienceId) => {
    const { data } = await api.post('/experience/analyze', { experienceId }, { timeout: 120000 });
    set(state => ({
      experiences: state.experiences.map(e =>
        e.id === experienceId ? { ...e, structuredResult: data, keywords: data.keywords || [] } : e
      ),
    }));
    return data;
  },
}));

export default useExperienceStore;
