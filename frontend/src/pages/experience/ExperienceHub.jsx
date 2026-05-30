import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, FolderOpen, ChevronDown, Pencil, Trash2, Check, X,
  GripVertical, CalendarDays, List, Star, ArrowUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';
import { stripMd } from '../../utils/textUtils';
import { useOnboarding } from '../../components/OnboardingOverlay';
import GuidedTutorial from '../../components/GuidedTutorial';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date(ts));
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* period 문자열에서 {start, end} Date 파싱 */
function parsePeriod(exp) {
  const period = exp.period || exp.structuredResult?.projectOverview?.duration || '';
  const dateRegex = /(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?/g;
  const matches = [...period.matchAll(dateRegex)];
  if (matches.length >= 2) {
    const s = new Date(+matches[0][1], +matches[0][2] - 1, +(matches[0][3] || 1));
    const e = new Date(+matches[1][1], +matches[1][2] - 1, +(matches[1][3] || 28));
    return { start: s, end: e };
  }
  if (matches.length === 1) {
    const s = new Date(+matches[0][1], +matches[0][2] - 1, +(matches[0][3] || 1));
    const e = new Date(s); e.setMonth(e.getMonth() + 2);
    return { start: s, end: e };
  }
  const created = exp.createdAt?.toDate?.() ?? (exp.createdAt instanceof Date ? exp.createdAt : new Date(exp.createdAt || Date.now()));
  const end = new Date(created); end.setMonth(end.getMonth() + 2);
  return { start: created, end };
}

const COLOR_PALETTES = {
  blue: [
    { bar: 'bg-blue-500',  barText: 'text-white',     light: 'bg-blue-50' },
    { bar: 'bg-white',     barText: 'text-blue-600',  light: 'bg-gray-50', border: 'border border-blue-200' },
    { bar: 'bg-gray-200',  barText: 'text-gray-700',  light: 'bg-gray-50' },
  ],
  green: [
    { bar: 'bg-emerald-500', barText: 'text-white',       light: 'bg-emerald-50' },
    { bar: 'bg-white',       barText: 'text-emerald-600', light: 'bg-gray-50', border: 'border border-emerald-200' },
    { bar: 'bg-gray-200',    barText: 'text-gray-700',    light: 'bg-gray-50' },
  ],
  dark: [
    { bar: 'bg-gray-900',  barText: 'text-white',     light: 'bg-gray-100' },
    { bar: 'bg-white',     barText: 'text-gray-800',  light: 'bg-gray-50', border: 'border border-gray-300' },
    { bar: 'bg-gray-300',  barText: 'text-gray-700',  light: 'bg-gray-50' },
  ],
};

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const SORT_OPTIONS = [
  { value: 'custom',    label: '직접 정렬' },
  { value: 'latest',    label: '최신순' },
  { value: 'period',    label: '기간순' },
  { value: 'favorite',  label: '즐겨찾기순' },
];

function createTutorialExperience() {
  const year = new Date().getFullYear();
  return {
    id: 'tutorial-demo-experience',
    isTutorialDemo: true,
    title: '가상 경험: 교내 서비스 개선 프로젝트',
    period: `${year}.03 ~ ${year}.06`,
    createdAt: new Date(),
    status: 'finished',
    classify: ['프로젝트', '팀 리딩'],
    keywords: ['문제정의', '사용자 인터뷰', '프로토타입'],
    skills: ['Figma', 'React', '데이터 분석'],
    structuredResult: {
      projectOverview: {
        role: 'PM / 프론트엔드',
        goal: '학생들이 놓치는 공지를 줄이고 반복 확인 시간을 낮추는 것',
        summary: '학생들이 놓치던 공지 확인 흐름을 개선하기 위해 가설 수립, 인터뷰, 프로토타입 검증을 진행했습니다.',
        duration: `${year}.03 ~ ${year}.06`,
        techStack: ['Figma', 'React', 'Firebase'],
      },
      intro: '학생들이 공지를 확인하는 과정에서 반복적으로 놓치는 지점을 발견하고 개선 프로젝트를 시작했습니다. 여러 채널에 분산된 공지가 문제였습니다.',
      task: '인터뷰 질문 설계, 문제 패턴 정리, 핵심 화면 프로토타입 제작을 맡았습니다. 팀 내에서 PM과 프론트엔드 역할을 겸했습니다.',
      process: '12명의 사용자를 인터뷰하고 주요 불편을 3가지 흐름으로 묶어 우선순위를 정했습니다. 각 흐름별로 핵심 화면을 설계하고 빠르게 프로토타입을 제작했습니다.',
      output: '테스트 만족도 4.6/5를 기록했고 공지 확인 누락률을 32% 낮추는 개선안을 도출했습니다. 팀 전체 리뷰에서 즉시 적용 가능한 안으로 채택되었습니다.',
      growth: '정성 인터뷰를 실제 화면 구조와 성과 지표로 연결하는 경험을 얻었습니다. 수치 없이 체감만으로 문제를 정의했을 때와 달리 설득력이 크게 높아졌습니다.',
      keyExperiences: [
        { title: '인터뷰 12건으로 문제 패턴 정리', metric: '공지 확인 누락률 32% 감소' },
        { title: '핵심 화면 3개를 빠르게 프로토타입 제작', metric: '테스트 만족도 4.6/5' },
      ],
      keywords: ['문제정의', '사용자 인터뷰', '프로토타입'],
    },
  };
}

function TutorialBuildPreview({ status }) {
  const steps = [
    { key: 'collecting', label: '가상 경험 입력값 준비' },
    { key: 'structuring', label: '기간, 키워드, 성과 정리' },
    { key: 'ready', label: '타임라인 맨 위에 추가' },
  ];
  const currentIndex = status === 'ready' ? 2 : status === 'structuring' ? 1 : status === 'collecting' ? 0 : -1;

  return (
    <div className="space-y-2">
      <p className="font-semibold text-bluewood-700">가상 경험 만들기를 눌러서 생성 과정을 확인해보세요.</p>
      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const done = currentIndex > index || status === 'ready';
          const active = currentIndex === index && status !== 'ready';
          return (
            <div key={step.key} className="flex items-center gap-2 text-[13px]">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                done ? 'bg-primary-600 text-white' : active ? 'bg-primary-100 text-primary-700' : 'bg-white text-bluewood-300 border border-surface-200'
              }`}>
                {done ? <Check size={12} /> : active ? <span className="h-2 w-2 rounded-full bg-primary-600 animate-pulse" /> : index + 1}
              </span>
              <span className={done || active ? 'font-semibold text-bluewood-700' : 'text-bluewood-400'}>{step.label}</span>
            </div>
          );
        })}
      </div>
      {status === 'ready' && <p className="text-[13px] font-semibold text-primary-600">완료되었습니다. 다음을 눌러서 생성된 경험을 확인해보세요.</p>}
    </div>
  );
}

/* ── 즐겨찾기 로컬스토리지 헬퍼 ── */
const FAV_KEY = 'exp_favorites';
function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveFavs(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}

export default function ExperienceHub() {
  const { user } = useAuthStore();
  const location = useLocation();
  const tutorialKey = user?.uid ? `experience-flow-tutorial-${user.uid}` : null;
  const forceTutorial = new URLSearchParams(location.search).get('tutorial') === '1';
  const tutorialInitialStep = parseInt(new URLSearchParams(location.search).get('step') || '0', 10) || 0;
  const { visible: tutorialVisible, dismiss: dismissTutorial, show: showTutorial } = useOnboarding(tutorialKey, { force: forceTutorial });
  const { experiences, fetchExperiences, loading, deleteExperience, createExperience, updateExperience, reorderExperiences } = useExperienceStore();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tutorialDemoExperience, setTutorialDemoExperience] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const timelineRef = useRef(null);
  const yearDropdownRef = useRef(null);
  const tutorialDemoTimersRef = useRef([]);
  const tutorialRef = useRef(null);
  const [tutorialCurrentStep, setTutorialCurrentStep] = useState(0);
  const [tutorialDetailOpen, setTutorialDetailOpen] = useState(false);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [colorPalette, setColorPalette] = useState('blue');
  const [tutorialDemoBuildStep, setTutorialDemoBuildStep] = useState('idle');

  /* ── 정렬 & 즐겨찾기 ── */
  const [sortBy, setSortBy] = useState('custom');
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const sortDropRef = useRef(null);
  const [favorites, setFavorites] = useState(loadFavs);

  const displayExperiences = useMemo(() => {
    if (!tutorialDemoExperience) return experiences;
    return [tutorialDemoExperience, ...experiences.filter(exp => exp.id !== tutorialDemoExperience.id)];
  }, [experiences, tutorialDemoExperience]);

  const clearTutorialDemoTimers = useCallback(() => {
    tutorialDemoTimersRef.current.forEach(timer => window.clearTimeout(timer));
    tutorialDemoTimersRef.current = [];
  }, []);

  const showTutorialDemo = useCallback(() => {
    clearTutorialDemoTimers();
    if (tutorialDemoExperience) {
      setTutorialDemoBuildStep('ready');
      setViewMode('timeline');
      setSelectedYear(parsePeriod(tutorialDemoExperience).start.getFullYear());
      setSelectedId(tutorialDemoExperience.id);
      return;
    }

    setTutorialDemoBuildStep('collecting');
    setViewMode('timeline');
    setSelectedId(null);

    const structureTimer = window.setTimeout(() => setTutorialDemoBuildStep('structuring'), 650);
    const completeTimer = window.setTimeout(() => {
      const demo = createTutorialExperience();
      setTutorialDemoExperience(demo);
      setSelectedYear(parsePeriod(demo).start.getFullYear());
      setSelectedId(demo.id);
      setTutorialDemoBuildStep('ready');
    }, 1450);
    tutorialDemoTimersRef.current = [structureTimer, completeTimer];
  }, [clearTutorialDemoTimers, tutorialDemoExperience]);

  useEffect(() => () => clearTutorialDemoTimers(), [clearTutorialDemoTimers]);

  const toggleFavorite = useCallback((id, e) => {
    e?.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFavs(next);
      return next;
    });
  }, []);

  /* 정렬된 경험 목록 */
  const sortedExperiences = useMemo(() => {
    const list = [...displayExperiences];
    if (sortBy === 'latest') {
      return list.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt || 0);
        const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt || 0);
        return tb - ta;
      });
    }
    if (sortBy === 'period') {
      return list.sort((a, b) => parsePeriod(b).start - parsePeriod(a).start);
    }
    if (sortBy === 'favorite') {
      return list.sort((a, b) => {
        const fa = favorites.has(a.id) ? 0 : 1;
        const fb = favorites.has(b.id) ? 0 : 1;
        return fa - fb;
      });
    }
    return list; // custom — 원본 순서 유지
  }, [displayExperiences, sortBy, favorites]);

  /* ── 드래그 앤 드롭 (custom 모드에서만) ── */
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const handleDragStart = useCallback((e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  }, []);

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIdx != null && overIdx != null && dragIdx !== overIdx) {
      // sortedExperiences 기준으로 새 순서를 계산한 뒤 저장
      const ids = sortedExperiences.map(e => e.id);
      const [moved] = ids.splice(dragIdx, 1);
      ids.splice(overIdx, 0, moved);
      reorderExperiences(ids);
      // 드래그 후에는 직접 정렬 모드로 전환
      setSortBy('custom');
    }
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, overIdx, sortedExperiences, reorderExperiences]);

  /* ── 타임라인 인라인 편집 ── */
  const startEditing = (exp, e) => {
    e?.stopPropagation();
    const { start, end } = parsePeriod(exp);
    setEditingId(exp.id);
    setEditTitle(exp.title || '');
    setEditStart(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`);
    setEditEnd(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`);
  };
  const cancelEditing = (e) => { e?.stopPropagation(); setEditingId(null); };
  const saveEditing = async (e) => {
    e?.stopPropagation();
    if (!editingId || !editTitle.trim()) return;
    if (editingId === tutorialDemoExperience?.id) {
      setTutorialDemoExperience(prev => prev ? { ...prev, title: editTitle.trim(), period: `${editStart}-01 ~ ${editEnd}-28` } : prev);
      toast.success('가상 경험이 수정되었습니다');
      setEditingId(null);
      return;
    }
    try {
      await updateExperience(editingId, { title: editTitle.trim(), period: `${editStart}-01 ~ ${editEnd}-28` });
      toast.success('수정 완료');
    } catch { toast.error('수정 실패'); }
    setEditingId(null);
  };

  /* ── 타임라인 바 삭제 ── */
  const handleTimelineDelete = useCallback((exp, e) => {
    e.stopPropagation();
    if (exp.isTutorialDemo) {
      setTutorialDemoBuildStep('idle');
      setTutorialDemoExperience(null);
      setSelectedId(null);
      toast.success('가상 경험을 지웠습니다');
      return;
    }
    if (window.confirm(`"${stripMd(exp.title)}" 경험을 삭제하시겠습니까?`)) {
      deleteExperience(exp.id);
      toast.success('삭제되었습니다');
    }
  }, [deleteExperience]);

  useEffect(() => {
    if (user?.uid) fetchExperiences(user.uid);
  }, [user?.uid]);

  /* 정렬 드롭다운 외부 클릭 닫기 */
  useEffect(() => {
    const h = (e) => {
      if (sortDropRef.current && !sortDropRef.current.contains(e.target)) setSortDropOpen(false);
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) setYearDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleImport = async ({ imported, structured }) => {
    try {
      const data = structured || {};
      const newId = await createExperience(user.uid, {
        title: data.title || imported?.title || '임포트된 경험',
        framework: data.framework || 'STRUCTURED',
        content: data.content || { intro: imported?.content || '' },
      });
      navigate(`/app/experience/edit/${newId}`);
    } catch (error) {
      console.error('임포트 적용 실패:', error);
    }
  };

  /* ── 간트 타임라인 계산 ── */
  const ganttData = useMemo(() => {
    if (sortedExperiences.length === 0) return null;
    const items = sortedExperiences.map(exp => ({ exp, ...parsePeriod(exp) }));
    const globalStart = new Date(selectedYear, 0, 1);
    const globalEnd = new Date(selectedYear, 11, 31);
    const months = Array.from({ length: 12 }, (_, i) => ({ year: selectedYear, month: i }));
    const totalMs = globalEnd.getTime() - globalStart.getTime();
    const visibleItems = items.filter(({ start, end }) => end >= globalStart && start <= globalEnd);
    return { items: visibleItems, allItems: items, globalStart, globalEnd, months, totalMs };
  }, [sortedExperiences, selectedYear]);

  const availableYears = useMemo(() => {
    if (displayExperiences.length === 0) return [new Date().getFullYear()];
    const years = new Set();
    displayExperiences.forEach(exp => {
      const { start, end } = parsePeriod(exp);
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.add(y);
    });
    return [...years].sort((a, b) => b - a);
  }, [displayExperiences]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || '정렬';

  const experienceTutorialSteps = useMemo(() => [
    {
      selector: '[data-tour="experience-new"]',
      title: '새 경험 추가를 눌러서 작성 화면으로 들어가보세요',
      body: '이 버튼을 누르면 실제 새 경험 작성 화면으로 이동하고, 다음 화면에서 가상 경험이 만들어지는 과정을 이어서 보여드립니다.',
      preview: <p>실제 저장이나 AI 호출 없이, 작성 화면 안에서 샘플 경험 생성 흐름을 확인합니다.</p>,
    },
    {
      selector: '[data-tour="experience-demo-bar"]',
      title: '생성된 경험을 눌러서 확인해보세요',
      body: '가상 경험이 타임라인 맨 위에 추가되었습니다. 바를 클릭하면 상세 내용을 볼 수 있고, "경험 전체 보기"를 누르면 실제 경험 편집 화면이 어떻게 구성되는지 확인할 수 있습니다.',
      preview: <p>키워드, 성과, 역할 정보가 함께 들어간 예시라서 저장 없이 전체 화면을 살펴볼 수 있습니다.</p>,
      onEnter: showTutorialDemo,
    },
    {
      selector: '[data-tour="experience-view-toggle"]',
      title: '표 보기를 눌러서 비교해보세요',
      body: '타임라인에서 기간을 확인했다면 표 보기로 바꿔보세요. 키워드와 성과를 한 줄씩 비교하기 좋아집니다.',
      onEnter: () => setViewMode('timeline'),
    },
    {
      selector: '[data-tour="experience-demo-row"]',
      title: '가상 경험 행을 눌러서 내용을 살펴보세요',
      body: '표에서는 제목, 기간, 성과, 키워드가 한 줄로 정리됩니다. 수정 패널을 열어서 바뀌는 위치도 확인해보세요.',
      onEnter: () => {
        const demo = tutorialDemoExperience || createTutorialExperience();
        setTutorialDemoExperience(demo);
        setTutorialDemoBuildStep('ready');
        setEditingId(null);
        setViewMode('table');
      },
      onPrev: () => setViewMode('timeline'),
    },
    {
      selector: '[data-tour="experience-edit-panel"]',
      title: '제목과 기간을 눌러서 수정해보세요',
      body: '튜토리얼의 가상 경험은 화면에서만 바뀝니다. 실제 경험은 여기서 저장을 누르면 내 경험 DB에 반영됩니다.',
      onEnter: () => {
        const demo = tutorialDemoExperience || createTutorialExperience();
        setTutorialDemoExperience(demo);
        setTutorialDemoBuildStep('ready');
        setViewMode('table');
        startEditing(demo);
      },
      onPrev: () => setEditingId(null),
    },
    {
      selector: '[data-tour="experience-sort"]',
      title: '정렬을 눌러서 보는 순서를 바꿔보세요',
      body: '직접 정렬, 최신순, 기간순, 즐겨찾기순을 눌러서 경험 목록을 원하는 관점으로 다시 볼 수 있습니다.',
      onEnter: () => setEditingId(null),
      onPrev: () => {
        const demo = tutorialDemoExperience || createTutorialExperience();
        setTutorialDemoExperience(demo);
        setTutorialDemoBuildStep('ready');
        setViewMode('table');
        startEditing(demo);
      },
    },
  ], [navigate, dismissTutorial, showTutorialDemo, tutorialDemoExperience]);

  return (
    <>
    <GuidedTutorial
      ref={tutorialRef}
      visible={tutorialVisible}
      steps={experienceTutorialSteps}
      onSkip={() => { dismissTutorial(false); setTutorialDemoExperience(null); setTutorialDemoBuildStep('idle'); }}
      onNeverShow={() => { dismissTutorial(true); setTutorialDemoExperience(null); setTutorialDemoBuildStep('idle'); }}
      initialStep={tutorialInitialStep}
      onStepChange={setTutorialCurrentStep}
    />
    <div className="animate-fadeIn max-w-[1240px] mx-auto">
      {/* ═══ 페이지 헤더 ═══ */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[34px] font-extrabold text-gray-900 tracking-[-0.03em] leading-tight">경험 정리</h1>
            <p className="text-[16px] text-gray-500 mt-2 font-medium">
              {displayExperiences.length > 0
                ? <><span className="text-primary-600 font-bold text-[18px]">{displayExperiences.length}</span>개의 경험이 타임라인에 쌓여있어요</>
                : '첫 경험을 추가하고 나만의 아카이브를 시작해보세요'}
            </p>
          </div>
          <Link
            data-tour="experience-new"
            to={tutorialVisible || forceTutorial ? '/app/experience/new?tutorial=1' : '/app/experience/new'}
            onClick={() => {
              if (tutorialVisible && tutorialCurrentStep === 0) {
                dismissTutorial(false);
                setTutorialDemoExperience(null);
                setTutorialDemoBuildStep('idle');
              }
            }}
            className="flex items-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 transition-colors shadow-sm shrink-0"
          >
            <Plus size={16} />
            새 경험 추가
          </Link>
        </div>
        {/* 컨트롤 바 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { navigate('/app/experience?tutorial=1'); showTutorial(); }}
            className="px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-500 hover:border-primary-200 hover:text-primary-600 transition-colors"
          >
            튜토리얼 보기
          </button>
          {/* 정렬 드롭다운 */}
          <div className="relative" ref={sortDropRef}>
            <button
              data-tour="experience-sort"
              onClick={() => setSortDropOpen(v => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:border-gray-300 transition-colors"
            >
              <ArrowUpDown size={13} />
              {currentSortLabel}
              <ChevronDown size={11} className={`transition-transform ${sortDropOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortDropOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1.5 min-w-[130px]">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortDropOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 text-[13px] font-medium transition-colors ${
                      sortBy === opt.value ? 'text-primary-600 bg-primary-50 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 뷰 전환 */}
          <div data-tour="experience-view-toggle" className="flex items-center gap-0.5 border border-gray-200 rounded-xl p-1 bg-white">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                viewMode === 'timeline' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <CalendarDays size={13} />타임라인
            </button>
            <button
              onClick={() => {
                setViewMode('table');
                if (tutorialVisible && tutorialCurrentStep === 2) tutorialRef.current?.next();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                viewMode === 'table' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <List size={13} />표
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : displayExperiences.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ═══ 간트 타임라인 ═══ */}
          {viewMode === 'timeline' && ganttData && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* 타임라인 헤더 */}
              <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  {/* 년도 드롭다운 */}
                  <div className="relative" ref={yearDropdownRef}>
                    <button
                      onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
                      className="flex items-center gap-1.5 text-[13px] font-medium text-bluewood-600 bg-surface-50 px-3 py-1.5 rounded-md border border-surface-200 hover:border-surface-300 transition-colors"
                    >
                      {selectedYear}년
                      <ChevronDown size={12} className={`transition-transform ${yearDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {yearDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg z-20 py-1 min-w-[80px]">
                        {availableYears.map(y => (
                          <button
                            key={y}
                            onClick={() => { setSelectedYear(y); setYearDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-[13px] font-medium transition-colors ${
                              y === selectedYear ? 'text-primary-600 bg-surface-50 font-semibold' : 'text-bluewood-600 hover:bg-surface-50'
                            }`}
                          >
                            {y}년
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[15px] font-bold text-bluewood-700">경험 타임라인</span>
                </div>
                {/* 팔레트 선택 */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: 'blue',  colors: ['bg-blue-500', 'bg-blue-400', 'bg-blue-600'] },
                    { key: 'green', colors: ['bg-emerald-500', 'bg-teal-500', 'bg-green-600'] },
                    { key: 'dark',  colors: ['bg-gray-800', 'bg-gray-600', 'bg-gray-900'] },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => setColorPalette(p.key)}
                      className={`flex items-center gap-0.5 p-1.5 rounded-lg border-2 transition-all ${
                        colorPalette === p.key ? 'border-primary-600 shadow-sm scale-110' : 'border-transparent hover:border-surface-300 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {p.colors.map((c, i) => (
                        <span key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                      ))}
                    </button>
                  ))}
                </div>
              </div>

              {/* 간트 본체 */}
              <div ref={timelineRef} className="overflow-x-auto">
                <div style={{ minWidth: '840px' }}>
                  <div className="relative">
                    {/* 월 헤더 */}
                    <div className="flex border-b border-surface-100">
                      {ganttData.months.map((m, i) => (
                        <div key={`${m.year}-${m.month}`} className="flex-1 border-r border-surface-100 px-2 pt-1 pb-2">
                          <span className="text-[12px] text-gray-500 font-semibold">{MONTH_NAMES[m.month]}</span>
                        </div>
                      ))}
                    </div>

                    {/* 바 렌더 영역 */}
                    <div className="relative" style={{ minHeight: `${ganttData.items.length * 56 + 40}px` }}>
                      {/* 수직 격자선 */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {ganttData.months.map((m, i) => (
                          <div key={i} className="flex-1 border-r border-surface-100" />
                        ))}
                      </div>

                      {/* 간트 바 */}
                      {ganttData.items.map(({ exp, start, end }, idx) => {
                        const theme = COLOR_PALETTES[colorPalette][idx % 3];
                        const clampedStart = new Date(Math.max(start.getTime(), ganttData.globalStart.getTime()));
                        const clampedEnd = new Date(Math.min(end.getTime(), ganttData.globalEnd.getTime()));
                        const startOffset = Math.max(0, (clampedStart.getTime() - ganttData.globalStart.getTime()) / ganttData.totalMs * 100);
                        const barWidth = Math.max(4, (clampedEnd.getTime() - clampedStart.getTime()) / ganttData.totalMs * 100);
                        const isSelected = selectedId === exp.id;
                        const isEditingThis = editingId === exp.id;

                        return (
                          <div
                            key={exp.id}
                            data-tour={exp.isTutorialDemo ? 'experience-demo-bar' : undefined}
                            className="absolute group"
                            style={{ top: `${idx * 56 + 16}px`, left: `${startOffset}%`, width: `${barWidth}%`, minWidth: '120px', zIndex: isEditingThis ? 50 : 1 }}
                            onMouseEnter={(e) => { if (!isEditingThis) setHoveredBar({ exp, rect: e.currentTarget.getBoundingClientRect() }); }}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            {isEditingThis ? (
                              /* ── 인라인 편집 모드 ── */
                              <div className="bg-white border-2 border-blue-400 rounded-lg p-3 shadow-lg relative z-50" style={{ minWidth: '220px' }} onClick={e => e.stopPropagation()}>
                                <input
                                  value={editTitle}
                                  onChange={e => setEditTitle(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEditing(e); if (e.key === 'Escape') cancelEditing(e); }}
                                  className="w-full text-[14px] font-semibold text-gray-800 bg-transparent outline-none border-b border-gray-200 pb-1 mb-2"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1.5 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 w-6 flex-shrink-0">시작</span>
                                    <input type="month" value={editStart} onChange={e => setEditStart(e.target.value)}
                                      className="flex-1 text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 w-6 flex-shrink-0">종료</span>
                                    <input type="month" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                                      className="flex-1 text-[11px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400" />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-1">
                                  <button onClick={saveEditing} className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded">
                                    <Check size={12} />
                                  </button>
                                  <button onClick={cancelEditing} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── 일반 바 ── */
                              <div className="relative">
                                <div
                                  className={`${theme.bar} ${theme.border || ''} rounded-lg px-4 py-2.5 cursor-pointer transition-all duration-200 ${
                                    isSelected ? 'ring-2 ring-offset-1 ring-primary-500 shadow-md' : 'hover:shadow-md'
                                  }`}
                                  onClick={() => {
                                    if (tutorialVisible && tutorialCurrentStep === 1 && exp.isTutorialDemo) {
                                      setHoveredBar(null);
                                      setDetailData(exp);
                                      setTutorialDetailOpen(true);
                                    } else {
                                      setSelectedId(isSelected ? null : exp.id);
                                    }
                                  }}
                                  onDoubleClick={() => {
                                    if (!exp.isTutorialDemo) navigate(`/app/experience/structured/${exp.id}?view=true`);
                                  }}
                                >
                                  <span className={`text-[15px] font-semibold ${theme.barText} truncate block pr-12`}>
                                    {favorites.has(exp.id) && <Star size={10} className="inline mr-1 fill-current text-yellow-400" />}
                                    {stripMd(exp.title)}
                                  </span>
                                </div>
                                {/* 편집/삭제 버튼 오버레이 */}
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => startEditing(exp, e)}
                                    className="p-1.5 bg-white/90 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-white shadow-sm transition-colors"
                                    title="이름/기간 수정"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => handleTimelineDelete(exp, e)}
                                    className="p-1.5 bg-white/90 rounded-lg text-red-400 hover:text-red-600 hover:bg-white shadow-sm transition-colors"
                                    title="삭제"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ 경험 목록 (테이블) ═══ */}
          {viewMode === 'table' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[28px_28px_48px_1fr_160px_140px_72px] items-center gap-3 px-6 py-3.5 border-b border-gray-100 bg-gray-50">
                <span></span>
                <span></span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">#</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">프로젝트</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">키워드</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">기간</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] text-right">관리</span>
              </div>

              {/* 테이블 바디 */}
              <div className="divide-y divide-gray-100">
                {sortedExperiences.map((exp, idx) => {
                  const theme = COLOR_PALETTES[colorPalette][idx % 3];
                  const overview = exp.structuredResult?.projectOverview || {};
                  const displayKeywords = exp.keywords || exp.structuredResult?.keywords || [];
                  const { start, end } = parsePeriod(exp);
                  const periodStr = `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, '0')} – ${end.getFullYear()}.${String(end.getMonth() + 1).padStart(2, '0')}`;
                  const isSelected = selectedId === exp.id;
                  const isEditing = editingId === exp.id;
                  const isDragging = dragIdx === idx;
                  const isOver = overIdx === idx;
                  const isFav = favorites.has(exp.id);

                  /* ── 편집 상태: 그리드를 무너뜨리고 풀 너비 form 패널 ── */
                  if (isEditing) {
                    return (
                      <div key={exp.id} data-tour={exp.isTutorialDemo ? 'experience-edit-panel' : undefined} className="bg-surface-50/60 border-y border-surface-200 px-5 py-5">
                        <p className="text-[12px] font-bold text-bluewood-400 uppercase tracking-[0.14em] mb-4">경험 수정</p>
                        <div className="flex flex-col gap-3">
                          {/* 제목 */}
                          <div>
                            <label className="block text-[13px] text-bluewood-400 mb-1">제목</label>
                            <input
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEditing(e); if (e.key === 'Escape') cancelEditing(e); }}
                              className="w-full text-[15px] font-semibold text-primary-600 bg-white border border-surface-200 rounded-lg px-3 py-2 outline-none focus:border-bluewood-400 transition-colors"
                              autoFocus
                            />
                          </div>
                          {/* 기간 */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="block text-[13px] text-bluewood-400 mb-1">시작</label>
                              <input
                                type="month"
                                value={editStart}
                                onChange={e => setEditStart(e.target.value)}
                                className="w-full text-[14px] text-bluewood-700 bg-white border border-surface-200 rounded-lg px-3 py-2 outline-none focus:border-bluewood-400 transition-colors"
                              />
                            </div>
                            <span className="text-bluewood-300 mt-5">–</span>
                            <div className="flex-1">
                              <label className="block text-[13px] text-bluewood-400 mb-1">종료</label>
                              <input
                                type="month"
                                value={editEnd}
                                onChange={e => setEditEnd(e.target.value)}
                                className="w-full text-[14px] text-bluewood-700 bg-white border border-surface-200 rounded-lg px-3 py-2 outline-none focus:border-bluewood-400 transition-colors"
                              />
                            </div>
                          </div>
                          {/* 버튼 */}
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={cancelEditing}
                              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-bluewood-500 bg-white border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors"
                            >
                              <X size={13} /> 취소
                            </button>
                            <button
                              onClick={saveEditing}
                              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                            >
                              <Check size={13} /> 저장
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  /* ── 일반 행 ── */
                  return (
                    <div
                      key={exp.id}
                      data-tour={exp.isTutorialDemo ? 'experience-demo-row' : undefined}
                      draggable={!isEditing}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => {
                        if (!exp.isTutorialDemo) navigate(`/app/experience/structured/${exp.id}?view=true`);
                      }}
                      className={`group grid grid-cols-[28px_28px_48px_1fr_160px_140px_72px] items-center gap-3 px-6 py-4 cursor-pointer transition-all duration-150 ${
                        isDragging ? 'opacity-40' : ''
                      } ${isOver && !isDragging ? 'border-t-2 border-t-primary-400' : ''
                      } ${isSelected ? 'bg-primary-50/60' : 'hover:bg-gray-50'}`}
                      onClick={() => {
                        if (tutorialVisible && tutorialCurrentStep === 3 && exp.isTutorialDemo) {
                          startEditing(exp);
                          tutorialRef.current?.next();
                        } else {
                          setSelectedId(isSelected ? null : exp.id);
                        }
                      }}
                    >
                      {/* 드래그 핸들 — 모든 모드에서 활성화 */}
                      <div
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-600"
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <GripVertical size={14} />
                      </div>

                      {/* 즐겨찾기 별 */}
                      <button
                        onClick={(e) => toggleFavorite(exp.id, e)}
                        className={`flex items-center justify-center transition-all ${
                          isFav ? 'text-yellow-400' : 'text-gray-200 group-hover:text-gray-300 hover:!text-yellow-300'
                        }`}
                        title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                      >
                        <Star size={14} className={isFav ? 'fill-current' : ''} />
                      </button>

                      {/* # */}
                      <div className={`w-7 h-7 rounded-lg ${theme.bar} ${theme.border || ''} flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-[13px] font-bold ${theme.barText}`}>{idx + 1}</span>
                      </div>

                      {/* 프로젝트 */}
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-[15px] font-bold text-gray-900 truncate leading-tight block w-full">{stripMd(exp.title)}</p>
                        <p className="text-[13px] text-gray-400 truncate mt-0.5 block w-full">
                          {overview.role || overview.summary ? stripMd(overview.role || overview.summary) : ''}
                        </p>
                      </div>

                      {/* 키워드 */}
                      <div className="flex flex-wrap gap-1 overflow-hidden max-h-[36px]">
                        {displayKeywords.slice(0, 2).map((k, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-semibold truncate max-w-[64px]">{k}</span>
                        ))}
                      </div>

                      {/* 기간 */}
                      <span className="text-[13px] text-gray-600 font-medium tabular-nums truncate">{periodStr}</span>

                      {/* 관리 */}
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => startEditing(exp, e)}
                          className="p-1.5 text-gray-300 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="이름/기간 수정"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (exp.isTutorialDemo) {
                              setTutorialDemoBuildStep('idle');
                              setTutorialDemoExperience(null);
                              setSelectedId(null);
                              toast.success('가상 경험을 지웠습니다');
                              return;
                            }
                            if (confirm('이 경험을 삭제하시겠습니까?')) deleteExperience(exp.id);
                          }}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {showImport && (
        <ImportModal targetType="experience" onClose={() => setShowImport(false)} onImport={handleImport} />
      )}
      {detailData && (
        <DetailModal
          type="experience"
          data={detailData}
          closeLabel={tutorialDetailOpen ? '← 돌아가기' : '닫기'}
          onClose={() => {
            setDetailData(null);
            if (tutorialDetailOpen) {
              setTutorialDetailOpen(false);
              tutorialRef.current?.next();
            }
          }}
          onViewFull={detailData.isTutorialDemo ? () => {
            setDetailData(null);
            setTutorialDetailOpen(false);
            navigate('/app/experience/structured/tutorial-demo-experience?view=true', {
              state: {
                analysis: detailData.structuredResult,
                title: detailData.title,
                framework: 'STRUCTURED',
                content: { rawInput: '' },
                isTutorialDemo: true,
                backUrl: '/app/experience?tutorial=1&step=2',
              },
            });
          } : undefined}
        />
      )}
      {exportData && (
        <ExportModal type="experience" data={exportData} onClose={() => setExportData(null)} />
      )}



      {/* 간트 호버 툴팁 */}
      {hoveredBar && (() => {
        const { exp, rect } = hoveredBar;
        const keyExps = exp.structuredResult?.keyExperiences || [];
        const tooltipLines = keyExps.slice(0, 3).map(ke => stripMd(ke.title)).filter(Boolean);
        const overview = exp.structuredResult?.projectOverview;
        const tooltipSummary = overview?.summary || overview?.background || '';
        const showAbove = rect.bottom + 180 > window.innerHeight;
        const top = showAbove ? rect.top - 8 : rect.bottom + 8;
        return (
          <div
            style={{ position: 'fixed', left: rect.left, top, width: 280, zIndex: 9999 }}
            className="bg-gray-900 text-white rounded-xl px-4 py-3 shadow-xl pointer-events-none"
          >
            <p className="text-[14px] font-bold mb-1 truncate">{stripMd(exp.title)}</p>
            {tooltipSummary && (
              <p className="text-[13px] text-gray-300 leading-relaxed line-clamp-2 mb-1.5">{stripMd(tooltipSummary)}</p>
            )}
            {tooltipLines.length > 0 && (
              <div className="border-t border-gray-700 pt-1.5 space-y-0.5">
                {tooltipLines.map((line, i) => (
                  <p key={i} className="text-[12px] text-gray-400 truncate">• {line}</p>
                ))}
              </div>
            )}
            <div className={`absolute ${showAbove ? 'bottom-[-6px]' : 'top-[-6px]'} left-6 w-3 h-3 bg-gray-900 rotate-45`} />
          </div>
        );
      })()}
    </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      {/* 일러스트 영역 */}
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-primary-50 rounded-3xl flex items-center justify-center shadow-sm">
          <FolderOpen size={40} className="text-primary-400" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-50 rounded-xl flex items-center justify-center border-2 border-white shadow-sm">
          <Star size={14} className="text-yellow-400 fill-yellow-400" />
        </div>
      </div>

      <h3 className="text-[24px] font-extrabold text-gray-900 mb-3 tracking-tight">첫 경험을 기록해보세요</h3>
      <p className="text-[16px] text-gray-400 mb-2 font-medium max-w-[360px]">
        경험을 정리하면 AI가 핵심 역량과 성과를 구조화해드립니다
      </p>
      <p className="text-[14px] text-gray-300 mb-8 font-medium">
        프로젝트, 인턴십, 동아리, 수업 모두 경험이에요
      </p>

      {/* 미리보기 힌트 카드들 */}
      <div className="flex gap-3 mb-8 flex-wrap justify-center">
        {['프로젝트', '인턴쉽', '동아리', '수업/강의'].map((tag, i) => (
          <span key={i} className="px-3 py-1.5 bg-gray-50 text-gray-500 rounded-full text-[13px] font-semibold border border-gray-100">
            {tag}
          </span>
        ))}
      </div>

      <Link
        to="/app/experience/new"
        className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 transition-all shadow-sm hover:shadow-md"
      >
        <Plus size={17} />
        첫 경험 추가하기
      </Link>
    </div>
  );
}
