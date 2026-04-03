import { create } from 'zustand';
import api from '../services/api';

const useJobStore = create((set, get) => ({
  // ── state ──
  step: 'input', // input | analyzing | analysis | matching | matched | generating | result
  loading: false,
  error: null,

  jobAnalysis: null,
  matchResult: null,
  coverLetter: null,
  portfolioSuggestion: null,
  savedItems: [],

  // ── actions ──
  reset: () => set({
    step: 'input', loading: false, error: null,
    jobAnalysis: null, matchResult: null,
    coverLetter: null, portfolioSuggestion: null,
  }),

  // 1단계: 채용공고 분석
  analyzePosting: async (url, text) => {
    set({ loading: true, error: null, step: 'analyzing' });
    try {
      const { data } = await api.post('/job/analyze', { url: url || undefined, text: text || undefined });
      set({ jobAnalysis: data.analysis, step: 'analysis', loading: false });
      return data.analysis;
    } catch (err) {
      set({ error: err.response?.data?.error || '분석 실패', loading: false, step: 'input' });
      return null;
    }
  },

  // 2단계: 매칭 분석
  matchExperiences: async () => {
    const { jobAnalysis } = get();
    if (!jobAnalysis) return null;
    set({ loading: true, error: null, step: 'matching' });
    try {
      const { data } = await api.post('/job/match', { jobAnalysis });
      set({ matchResult: data.matchResult, step: 'matched', loading: false });
      return data.matchResult;
    } catch (err) {
      set({ error: err.response?.data?.error || '매칭 실패', loading: false, step: 'analysis' });
      return null;
    }
  },

  // 3단계: 자소서 생성
  generateCoverLetter: async () => {
    const { jobAnalysis, matchResult } = get();
    if (!jobAnalysis || !matchResult) return null;
    set({ loading: true, error: null, step: 'generating' });
    try {
      const { data } = await api.post('/job/generate-coverletter', { jobAnalysis, matchResult });
      set({ coverLetter: data.coverLetter, step: 'result', loading: false });
      return data.coverLetter;
    } catch (err) {
      set({ error: err.response?.data?.error || '자소서 생성 실패', loading: false, step: 'matched' });
      return null;
    }
  },

  // 포트폴리오 제안
  generatePortfolio: async () => {
    const { jobAnalysis, matchResult } = get();
    if (!jobAnalysis || !matchResult) return null;
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/job/generate-portfolio', { jobAnalysis, matchResult });
      set({ portfolioSuggestion: data.portfolioSuggestion, loading: false });
      return data.portfolioSuggestion;
    } catch (err) {
      set({ error: err.response?.data?.error || '포트폴리오 제안 실패', loading: false });
      return null;
    }
  },

  // 저장
  saveResult: async () => {
    const { jobAnalysis, matchResult, coverLetter, portfolioSuggestion } = get();
    try {
      const { data } = await api.post('/job/save', {
        jobAnalysis, matchResult, coverLetter, portfolioSuggestion,
      });
      return data.id;
    } catch (err) {
      console.error('저장 실패:', err);
      return null;
    }
  },

  // 목록
  fetchSavedItems: async () => {
    try {
      const { data } = await api.get('/job/list');
      set({ savedItems: data.items });
    } catch (err) {
      console.error('목록 조회 실패:', err);
    }
  },
}));

export default useJobStore;
