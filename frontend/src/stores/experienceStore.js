import { create } from 'zustand';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import api from '../services/api';

export const FRAMEWORKS = {
  STRUCTURED: {
    name: '경험 구조화',
    description: '직무 맞춤형 커리어 코치 프레임워크로 경험을 체계적으로 정리합니다',
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

// 직군 카테고리 정의 (ex.md 기반)
export const JOB_CATEGORIES = [
  {
    group: '전 직군 공통',
    items: [
      { value: 'common', label: '공통 (전직군)', description: '직군 구분 없이 기본 7개 섹션만 정리합니다' },
    ],
  },
  {
    group: '엔지니어링 & 데이터',
    items: [
      { value: 'dev', label: '개발자 (FE/BE)', description: '기술 스택·아키텍처, 트러블슈팅, 코드 최적화 성과' },
      { value: 'aiml', label: 'AI / ML 엔지니어', description: '데이터셋·아키텍처, 학습·평가, 최적화·서빙' },
      { value: 'da', label: '데이터 애널리스트', description: 'EDA·파이프라인, 가설 검증, 비즈니스 인사이트' },
      { value: 'devops', label: '인프라 / 데브옵스', description: '시스템 아키텍처, CI/CD 파이프라인, 비용·트래픽 최적화' },
    ],
  },
  {
    group: '기획, 디자인 & 비즈니스',
    items: [
      { value: 'pm', label: '기획자 / PM', description: '해결 전략·기획 의도, MSC, 비즈니스 임팩트' },
      { value: 'designer', label: '프로덕트 디자이너', description: '리서치·문제 접근, 프로토타이핑·개선, 디자인 시스템' },
      { value: 'marketer', label: '마케터 (콘텐츠/퍼포먼스)', description: '매체 전략·타겟팅, KPI (ROAS/CVR/CTR)' },
      { value: 'hr', label: '인사 / 채용 담당자', description: '채용 파이프라인 기획, 퍼널 데이터, 조직 문화·리텐션' },
      { value: 'sales', label: 'B2B 세일즈 / 사업개발', description: '리드 제너레이션, 세일즈 퍼널 데이터, 계약 성과' },
    ],
  },
];

// 직군별 특화 추가 섹션 (필수 7개 섹션 이후에 렌더링)
export const JOB_SPECIFIC_FIELDS = {
  common: [],
  dev: [
    { key: 'techStack',       label: '기술 스택 및 아키텍처',  subtitle: '기술 선정의 논리적 근거 (왜 이 프레임워크/DB를 썼는가)',      placeholder: '어떤 기술 스택을 선택했고, 그 이유는 무엇인가요?',               color: 'bg-sky-50 border-sky-200' },
    { key: 'troubleshooting', label: '트러블슈팅 및 로직',     subtitle: '한계점 극복 과정 (성능 저하, 메모리 누수 해결 등)',            placeholder: '마주한 기술적 문제와 해결 과정을 설명해주세요',                   color: 'bg-sky-50 border-sky-200' },
    { key: 'optimization',    label: '코드 최적화 성과',       subtitle: '렌더링 속도 개선율 등 기술적 수치',                            placeholder: '성능 개선이나 최적화 작업 결과를 수치로 표현해주세요',           color: 'bg-sky-50 border-sky-200' },
  ],
  aiml: [
    { key: 'datasetArch', label: '데이터셋 및 아키텍처',       subtitle: '데이터 전처리 로직 및 모델(Model) 선택 이유',                  placeholder: '사용한 데이터셋과 모델 아키텍처 선택 이유를 설명해주세요',       color: 'bg-purple-50 border-purple-200' },
    { key: 'evaluation',  label: '학습 및 평가 (Evaluation)',  subtitle: '과적합 통제 과정, Accuracy 등 정량적 지표',                    placeholder: '학습 과정과 성능 평가 지표를 설명해주세요',                     color: 'bg-purple-50 border-purple-200' },
    { key: 'serving',     label: '최적화 및 서빙',             subtitle: '온디바이스 탑재나 추론(Inference) 속도 개선 등 엔지니어링 성과', placeholder: '모델 최적화 및 배포(서빙) 과정을 설명해주세요',                  color: 'bg-purple-50 border-purple-200' },
  ],
  da: [
    { key: 'pipeline',        label: '데이터 파이프라인 & EDA', subtitle: '데이터 수집/정제 환경과 시각화 과정',                          placeholder: '데이터 수집, 정제, 시각화 과정을 설명해주세요',                 color: 'bg-teal-50 border-teal-200' },
    { key: 'hypothesis',      label: '가설 검증 (A/B Test)',   subtitle: '실험 설계 및 통계적 유의성 검증',                              placeholder: '가설 설정부터 검증까지의 과정을 설명해주세요',                   color: 'bg-teal-50 border-teal-200' },
    { key: 'businessInsight', label: '비즈니스 인사이트',       subtitle: '데이터 분석을 통해 도출한 액션 플랜과 실제 지표 변화',           placeholder: '분석 결과에서 도출한 인사이트와 실제 비즈니스 변화를 설명해주세요', color: 'bg-teal-50 border-teal-200' },
  ],
  devops: [
    { key: 'infraArch',    label: '시스템 아키텍처 다이어그램', subtitle: '클라우드(AWS, GCP 등) 인프라 구조 시각화',                      placeholder: '시스템 아키텍처와 클라우드 인프라 구성을 설명해주세요',         color: 'bg-orange-50 border-orange-200' },
    { key: 'cicd',         label: 'CI/CD 파이프라인',          subtitle: '배포 자동화 구축을 통한 리드 타임 단축',                       placeholder: '배포 자동화 파이프라인 구축 과정을 설명해주세요',               color: 'bg-orange-50 border-orange-200' },
    { key: 'costOptimize', label: '비용 및 트래픽 최적화',      subtitle: '클라우드 리소스 비용 절감(%) 및 로드 밸런싱 전략',               placeholder: '비용 절감이나 트래픽 최적화 성과를 수치로 표현해주세요',         color: 'bg-orange-50 border-orange-200' },
  ],
  pm: [
    { key: 'strategy',       label: '해결 전략 및 기획 의도', subtitle: '핵심 기능(Core Feature) 정의 및 유저 플로우',                   placeholder: '문제 해결 전략과 핵심 기능 기획 의도를 설명해주세요',           color: 'bg-indigo-50 border-indigo-200' },
    { key: 'msc',            label: 'MSC (최소 성공 기준)',   subtitle: '초기 설정한 최소 성공 기준 달성 여부',                          placeholder: 'MSC를 어떻게 설정했고, 달성했는지 설명해주세요',               color: 'bg-indigo-50 border-indigo-200' },
    { key: 'businessImpact', label: '비즈니스 임팩트',        subtitle: '런칭 후 유저 데이터 변화 및 타 부서 커뮤니케이션 과정',           placeholder: '출시 후 실제 비즈니스 임팩트와 데이터 변화를 설명해주세요',     color: 'bg-indigo-50 border-indigo-200' },
  ],
  designer: [
    { key: 'researchApproach', label: '리서치 및 문제 접근',  subtitle: '더블 다이아몬드 모델, 유저 인터뷰 등 디자인 프로세스',           placeholder: '유저 리서치 방법론과 문제 접근 과정을 설명해주세요',           color: 'bg-pink-50 border-pink-200' },
    { key: 'prototyping',      label: '프로토타이핑 및 개선', subtitle: '사용성 테스트 전후(Before/After) UI 개선 과정',                 placeholder: '프로토타입 제작부터 사용성 테스트, UI 개선 과정을 설명해주세요', color: 'bg-pink-50 border-pink-200' },
    { key: 'designSystem',     label: '디자인 시스템',        subtitle: '일관된 컴포넌트, 폰트, 컬러 규격화 수립 여부',                  placeholder: '디자인 시스템 구축 과정과 적용 범위를 설명해주세요',           color: 'bg-pink-50 border-pink-200' },
  ],
  marketer: [
    { key: 'mediaStrategy', label: '매체 전략 및 타겟팅',    subtitle: '타겟 페르소나 설정 및 채널(메타, 구글 등) 믹스 전략',            placeholder: '타겟 설정과 매체 믹스 전략을 설명해주세요',                   color: 'bg-rose-50 border-rose-200' },
    { key: 'kpi',           label: '핵심 성과 지표 (KPI)',  subtitle: 'ROAS, CVR, CTR 등 캠페인 결과 데이터 시각화',                  placeholder: '캠페인 성과 지표와 달성 결과를 구체적으로 설명해주세요',         color: 'bg-rose-50 border-rose-200' },
  ],
  hr: [
    { key: 'hiringPipeline', label: '채용 파이프라인 기획', subtitle: '서류 스크리닝, 자동화 등 채용 리드타임 단축 전략',                 placeholder: '채용 프로세스 설계와 리드타임 단축 전략을 설명해주세요',       color: 'bg-amber-50 border-amber-200' },
    { key: 'funnelData',     label: '퍼널 데이터',         subtitle: '소싱 채널별 유입 및 합격 전환율 데이터',                         placeholder: '채용 퍼널 각 단계별 전환율을 설명해주세요',                   color: 'bg-amber-50 border-amber-200' },
    { key: 'retention',      label: '조직 문화 및 리텐션', subtitle: '온보딩 기획 및 퇴사율 방어 전략',                                placeholder: '온보딩 프로그램이나 직원 리텐션 전략을 설명해주세요',           color: 'bg-amber-50 border-amber-200' },
  ],
  sales: [
    { key: 'leadGen',        label: '리드 제너레이션 전략', subtitle: '인/아웃바운드를 통한 유효 고객(Lead) 발굴 과정',                  placeholder: '리드 발굴 전략과 실행 과정을 설명해주세요',                   color: 'bg-emerald-50 border-emerald-200' },
    { key: 'salesFunnel',    label: '세일즈 퍼널 데이터',  subtitle: '초기 미팅부터 최종 클로징까지의 전환율',                         placeholder: '세일즈 단계별 전환율과 성과를 설명해주세요',                   color: 'bg-emerald-50 border-emerald-200' },
    { key: 'contractResult', label: '계약 성과',           subtitle: '체결 규모(ARR/MRR) 및 기존 고객 업셀링 성과',                    placeholder: '계약 규모와 ARR/MRR 성과를 설명해주세요',                     color: 'bg-emerald-50 border-emerald-200' },
  ],
};

const useExperienceStore = create((set, get) => ({
  experiences: [],
  loading: false,
  // 경험별 편집 히스토리: { [experienceId]: { past: [], future: [] } }
  // 각 스냅샷: { content, title, structuredResult }
  _editHistory: {},

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
          // sortOrder가 있으면 우선, 없으면 createdAt 역순
          if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
          if (a.sortOrder != null) return -1;
          if (b.sortOrder != null) return 1;
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
      jobCategory: data.jobCategory || 'common',
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

  reorderExperiences: async (orderedIds) => {
    // Update local state immediately
    set(state => {
      const map = new Map(state.experiences.map(e => [e.id, e]));
      const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
      // Include any not in orderedIds at the end
      const remaining = state.experiences.filter(e => !orderedIds.includes(e.id));
      return { experiences: [...reordered, ...remaining] };
    });
    // Persist order to Firestore
    try {
      await Promise.all(orderedIds.map((id, idx) => {
        const ref = doc(db, 'experiences', id);
        return updateDoc(ref, { sortOrder: idx });
      }));
    } catch (err) {
      console.error('순서 저장 실패:', err);
    }
  },

  analyzeExperience: async (experienceId, options = {}) => {
    // AI 분석 전, 현재 structuredResult를 히스토리에 스냅샷 저장
    const current = get().experiences.find(e => e.id === experienceId);
    if (current) {
      get().pushEditSnapshot(experienceId, {
        content: current.content,
        title: current.title,
        structuredResult: current.structuredResult,
      });
    }
    const payload = { experienceId };
    if (options.momentsCount !== undefined) payload.momentsCount = options.momentsCount;
    if (Array.isArray(options.reviewedMoments) && options.reviewedMoments.length > 0) {
      payload.reviewedMoments = options.reviewedMoments;
    }
    const { data } = await api.post('/experience/analyze', payload, { timeout: 300000 });
    set(state => ({
      experiences: state.experiences.map(e =>
        e.id === experienceId ? { ...e, structuredResult: data, keywords: data.keywords || [] } : e
      ),
    }));
    return data;
  },

  /** 자료 텍스트에서 핵심 경험(moments)을 추출. TemplateSelect 자료 수집 플로우용. */
  extractMoments: async (rawText, title) => {
    const { data } = await api.post('/experience/extract-moments', {
      rawText, title,
    }, { timeout: 120000 });
    return data; // { moments: [...] }
  },

  // ── 히스토리 관련 ──────────────────────────────────
  // 스냅샷을 히스토리에 push (최대 20개 유지)
  pushEditSnapshot: (experienceId, snapshot) => {
    set(state => {
      const history = state._editHistory[experienceId] || { past: [], future: [] };
      const past = [...history.past, snapshot].slice(-20);
      return {
        _editHistory: {
          ...state._editHistory,
          [experienceId]: { past, future: [] },
        },
      };
    });
  },

  // Undo: 직전 스냅샷으로 복원하고 현재 상태를 future에 저장
  undoEdit: (experienceId) => {
    const state = get();
    const history = state._editHistory[experienceId];
    if (!history || history.past.length === 0) return null;

    const current = state.experiences.find(e => e.id === experienceId);
    const past = [...history.past];
    const snapshot = past.pop();
    const future = [
      { content: current?.content, title: current?.title, structuredResult: current?.structuredResult },
      ...(history.future || []),
    ].slice(0, 20);

    set(s => ({
      _editHistory: {
        ...s._editHistory,
        [experienceId]: { past, future },
      },
    }));
    return snapshot;
  },

  // Redo: future 스택에서 복원
  redoEdit: (experienceId) => {
    const state = get();
    const history = state._editHistory[experienceId];
    if (!history || history.future.length === 0) return null;

    const current = state.experiences.find(e => e.id === experienceId);
    const future = [...history.future];
    const snapshot = future.shift();
    const past = [
      ...(history.past || []),
      { content: current?.content, title: current?.title, structuredResult: current?.structuredResult },
    ].slice(-20);

    set(s => ({
      _editHistory: {
        ...s._editHistory,
        [experienceId]: { past, future },
      },
    }));
    return snapshot;
  },

  canUndo: (experienceId) => {
    const h = get()._editHistory[experienceId];
    return (h?.past?.length ?? 0) > 0;
  },

  canRedo: (experienceId) => {
    const h = get()._editHistory[experienceId];
    return (h?.future?.length ?? 0) > 0;
  },
}));

export default useExperienceStore;
