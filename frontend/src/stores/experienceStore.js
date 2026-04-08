import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import api from '../services/api';

export const FRAMEWORKS = {
  STRUCTURED: {
    name: '경험 구조화',
    description: '직무 맞춤형 커리어 코치 프레임워크로 경험을 체계적으로 정리합니다',
    fields: [
      { key: 'projectName', label: '프로젝트명', placeholder: '프로젝트 또는 활동의 이름을 입력하세요', color: 'bg-blue-50 border-blue-200' },
      { key: 'period', label: '기간', placeholder: '프로젝트 진행 기간을 입력하세요 (예: 2024.01 ~ 2024.06)', color: 'bg-indigo-50 border-indigo-200' },
      { key: 'reason', label: 'Overview & Summary / 역할 및 기여도', placeholder: '본인의 역할, 기여도(%), 사용 기술/툴을 작성하세요\n예) 프론트엔드 리드 · 기여도 60% · React, TypeScript, Jira 활용', color: 'bg-purple-50 border-purple-200' },
      { key: 'solution', label: '🏆 Key Result / 핵심 성과 (두괄식)', placeholder: '가장 임팩트 있는 성과를 먼저 작성하세요\n예) 페이지 로딩 속도 40% 단축, MAU 2만 → 3.5만 달성, 사용자 이탈률 15%p 감소', color: 'bg-violet-50 border-violet-200' },
      { key: 'solutionReason', label: '🎯 Problem Definition / 문제 정의 (Why)', placeholder: '왜 이 문제를 풀려 했는지 배경과 이유를 작성하세요\n예) 기존 시스템의 병목 현상으로 이탈률 급증 → 근본 원인 분석 후 개선 착수', color: 'bg-pink-50 border-pink-200' },
      { key: 'skills', label: '💡 Action & Strategy / 실행 전략 (How)', placeholder: '직무에 맞는 핵심 실행 과정을 작성하세요\n[개발자] 아키텍처 결정 이유 + 트러블슈팅 과정\n[기획자·마케터] 가설 수립 + A/B테스트·협업 리딩\n[디자이너] 유저리서치 + 무드보드·유저플로우\n[데이터] 파이프라인 + 시각화 인사이트', color: 'bg-amber-50 border-amber-200' },
      { key: 'result', label: '📊 Insight & Learnings / 인사이트 및 성장', placeholder: '성과 외에 이 경험을 통해 무엇을 배웠는지 작성하세요\n예) 트레이드오프 의사결정 경험, 다음 프로젝트에 적용할 개선점', color: 'bg-emerald-50 border-emerald-200' },
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
