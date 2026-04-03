import { create } from 'zustand';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs,
  query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import api from '../services/api';

const usePortfolioStore = create((set, get) => ({
  portfolios: [],
  currentPortfolio: null,
  checklist: {
    fileSize: { passed: false, checking: false, message: '' },
    format: { passed: false, checking: false, message: '' },
    naming: { passed: false, checking: false, message: '' },
    customization: { passed: false, checking: false, message: '' },
    contribution: { passed: false, checking: false, message: '' },
    proofread: { passed: false, checking: false, message: '' },
  },
  exportReady: false,
  loading: false,

  fetchPortfolios: async (userId) => {
    set({ loading: true });
    try {
      const q = query(
        collection(db, 'portfolios'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const portfolios = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      set({ portfolios, loading: false });
    } catch (error) {
      console.error('포트폴리오 로딩 실패:', error);
      set({ loading: false });
    }
  },

  createPortfolio: async (userId, data) => {
    const docData = {
      userId,
      title: data.title || '새 포트폴리오',
      targetCompany: data.targetCompany || '',
      targetPosition: data.targetPosition || '',
      sections: data.sections || [],
      experienceIds: data.experienceIds || [],
      status: 'draft',
      exportFormat: 'PDF',
      userName: data.userName || '',
      checklist: {
        fileSize: false,
        format: false,
        naming: false,
        customization: false,
        contribution: false,
        proofread: false,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    // Notion 템플릿 추가 필드
    const extraFields = [
      'templateType', 'templateId', 'headline', 'education', 'awards', 'experiences',
      'contact', 'skills', 'goals', 'values', 'interests', 'curricular',
      'extracurricular', 'valuesEssay', 'jobAnalysis',
    ];
    extraFields.forEach(key => { if (data[key] !== undefined) docData[key] = data[key]; });
    const docRef = await addDoc(collection(db, 'portfolios'), docData);
    return docRef.id;
  },

  updatePortfolio: async (id, data) => {
    await updateDoc(doc(db, 'portfolios', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    const portfolios = get().portfolios.map(p =>
      p.id === id ? { ...p, ...data } : p
    );
    set({ portfolios });
  },

  deletePortfolio: async (id) => {
    await deleteDoc(doc(db, 'portfolios', id));
    set({ portfolios: get().portfolios.filter(p => p.id !== id) });
  },

  setCurrentPortfolio: (p) => set({ currentPortfolio: p }),

  // ===== Feature 4: 체크리스트 판별 시스템 =====
  runChecklist: async (portfolioId) => {
    const resetChecklist = {
      fileSize: { passed: false, checking: true, message: '용량 확인 중...' },
      format: { passed: false, checking: true, message: '포맷 검증 중...' },
      naming: { passed: false, checking: true, message: '네이밍 룰 확인 중...' },
      customization: { passed: false, checking: true, message: 'AI 맞춤형 검토 중...' },
      contribution: { passed: false, checking: true, message: '기여도 명시 확인 중...' },
      proofread: { passed: false, checking: true, message: '오타/비문 검수 중...' },
    };
    set({ checklist: resetChecklist, exportReady: false });

    try {
      // 1. 프론트엔드 검증: 네이밍 룰
      const portfolio = get().currentPortfolio;
      const namingResult = validateNaming(portfolio);
      set(state => ({
        checklist: { ...state.checklist, naming: namingResult }
      }));

      // 2. 프론트엔드 검증: 포맷
      const formatResult = validateFormat(portfolio);
      set(state => ({
        checklist: { ...state.checklist, format: formatResult }
      }));

      // 3. 백엔드 검증: 나머지 4개 항목 (AI 필요)
      const res = await api.post('/portfolio/validate', { portfolioId });
      const backendResults = res.data;

      set(state => {
        const newChecklist = {
          ...state.checklist,
          fileSize: backendResults.fileSize,
          customization: backendResults.customization,
          contribution: backendResults.contribution,
          proofread: backendResults.proofread,
        };
        const allPassed = Object.values(newChecklist).every(v => v.passed);
        return { checklist: newChecklist, exportReady: allPassed };
      });
    } catch (error) {
      console.error('체크리스트 검증 실패:', error);
    }
  },

  exportPortfolio: async (portfolioId, format) => {
    const portfolio = get().currentPortfolio;
    if (!portfolio) throw new Error('포트폴리오 데이터가 없습니다');

    const exportData = {
      title: portfolio.title || '',
      userName: portfolio.userName || '',
      targetCompany: portfolio.targetCompany || '',
      targetPosition: portfolio.targetPosition || '',
      sections: portfolio.sections || [],
      content: {},
    };

    // STAR 기반 content 합성
    const sections = portfolio.sections || [];
    const experienceSections = sections.filter(s => s.type === 'experience');
    if (experienceSections.length > 0) {
      exportData.content = {
        situation: experienceSections.map(s => s.content).join('\n'),
        task: exportData.targetPosition || '',
        action: experienceSections.map(s => s.role || '').filter(Boolean).join(', '),
        result: '',
      };
    }
    exportData.metadata = {
      techStack: sections.filter(s => s.type === 'skills').map(s => s.content).join(', ').split(',').map(s => s.trim()).filter(Boolean),
    };

    const formatMap = { 'PDF': 'pdf', 'Notion': 'notion', 'GitHub': 'github' };
    const endpoint = formatMap[format] || 'pdf';

    const res = await api.post(`/export/${endpoint}`, { data: exportData }, { timeout: 60000 });
    return res.data;
  },

  resetChecklist: () => {
    set({
      checklist: {
        fileSize: { passed: false, checking: false, message: '' },
        format: { passed: false, checking: false, message: '' },
        naming: { passed: false, checking: false, message: '' },
        customization: { passed: false, checking: false, message: '' },
        contribution: { passed: false, checking: false, message: '' },
        proofread: { passed: false, checking: false, message: '' },
      },
      exportReady: false,
    });
  },
}));

// 프론트엔드 검증 유틸
function validateNaming(portfolio) {
  if (!portfolio) return { passed: false, checking: false, message: '포트폴리오 데이터 없음' };
  const userName = portfolio.userName || '';
  const expectedPattern = /^[가-힣a-zA-Z]+_포트폴리오$/;
  const title = portfolio.title || '';
  if (!userName) {
    return { passed: false, checking: false, message: '사용자 이름이 설정되지 않았습니다.' };
  }
  const expectedName = `${userName}_포트폴리오`;
  if (title === expectedName || expectedPattern.test(title)) {
    return { passed: true, checking: false, message: `✓ 네이밍 룰 통과: ${expectedName}` };
  }
  return { passed: false, checking: false, message: `네이밍 형식 불일치. 권장: ${expectedName}` };
}

function validateFormat(portfolio) {
  if (!portfolio) return { passed: false, checking: false, message: '포트폴리오 데이터 없음' };
  const validFormats = ['PDF', 'Notion', 'GitHub'];
  const format = portfolio.exportFormat || '';
  if (validFormats.includes(format)) {
    return { passed: true, checking: false, message: `✓ ${format} 포맷 확인 완료` };
  }
  return { passed: false, checking: false, message: '지원되지 않는 포맷입니다.' };
}

export default usePortfolioStore;
