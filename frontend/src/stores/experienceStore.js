import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import api from '../services/api';

export const FRAMEWORKS = {
  STRUCTURED: {
    name: '경험 구조화',
    description: '7가지 섹션으로 경험을 체계적으로 정리합니다',
    fields: [
      { key: 'intro', label: '프로젝트 소개', subtitle: '서비스 이름 or 프로젝트 특징 + 소개 한 줄', placeholder: '프로젝트 이름과 한 줄 소개를 입력하세요', color: 'bg-blue-50 border-blue-200' },
      { key: 'overview', label: '프로젝트 개요', subtitle: '배경과 목적', placeholder: '프로젝트의 배경과 목적을 설명해주세요', color: 'bg-indigo-50 border-indigo-200' },
      { key: 'task', label: '진행한 일', subtitle: '배경-문제-(핵심)-해결', placeholder: '어떤 문제를 인식하고 어떻게 해결했는지 설명해주세요', color: 'bg-purple-50 border-purple-200' },
      { key: 'process', label: '과정', subtitle: '나의 직접적인 액션 + 인사이트', placeholder: '직접 수행한 행동과 그 과정에서 얻은 인사이트를 설명해주세요', color: 'bg-violet-50 border-violet-200' },
      { key: 'output', label: '결과물', subtitle: '최종으로 진행한 내용 + 포인트', placeholder: '최종 결과물과 핵심 포인트를 설명해주세요', color: 'bg-pink-50 border-pink-200' },
      { key: 'growth', label: '성장한 점', subtitle: '성과 or 배운 점', placeholder: '이 경험을 통해 성장한 점이나 배운 점을 설명해주세요', color: 'bg-amber-50 border-amber-200' },
      { key: 'competency', label: '나의 역량', subtitle: '입사 시 기여할 수 있는 부분', placeholder: '이 경험에서 얻은 역량과 입사 후 기여할 수 있는 부분을 설명해주세요', color: 'bg-emerald-50 border-emerald-200' },
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
