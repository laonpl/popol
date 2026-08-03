import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, FolderOpen, ChevronDown, Pencil, Trash2, Check, X,
  GripVertical, Star, ArrowUpDown,
  RotateCcw, Save, Mail, ExternalLink, RefreshCw, Briefcase,
  MapPin, CalendarDays, Sparkles, AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, LabelList,
} from 'recharts';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import CareerNarrativeSections from '../../components/CareerNarrativeSections';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import useAuthGate from '../../hooks/useAuthGate';
import useExperienceStore, { JOB_CATEGORIES } from '../../stores/experienceStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import PortfolioReadinessBoard from '../../components/PortfolioReadinessBoard';
import { stripMd } from '../../utils/textUtils';
import { useOnboarding } from '../../components/OnboardingOverlay';
import GuidedTutorial from '../../components/GuidedTutorial';
import { recommendLiveJobs } from '../../services/jobAI';
import {
  JOB_COMPETENCIES, WORK_STYLES,
  sanitizeCompetencyTags, sanitizeWorkStyleTags,
  COMPETENCY_CHIP, WORKSTYLE_CHIP,
  EXPERIENCE_CATEGORIES, UNCATEGORIZED, readCategory,
  WORK_STYLE_INFO,
} from '../../constants/competencies';
import { recommendJobFamilies, recommendByWorkStyle } from '../../constants/jobFamilies';
import { SKILL_ICONS, matchSkillIcon } from '../../constants/skillIcons';

/* 직무 유형 라벨 — experienceStore의 직군 목록에서 괄호 설명을 뗀 이름 */
const JOB_CATEGORY_LABELS = Object.fromEntries(
  JOB_CATEGORIES.flatMap(group => group.items.map(item => [item.value, item.label.replace(/\s*\(.+\)$/, '')])),
);
function readJobCategoryLabel(exp) {
  const key = exp?.jobCategory || exp?.structuredResult?.jobCategory || 'common';
  return JOB_CATEGORY_LABELS[key] || '공통';
}

/* 경험에서 표준 태그 읽기 (top-level 우선, 없으면 structuredResult) */
function readCompetencyTags(exp) {
  return sanitizeCompetencyTags(exp.competencyTags || exp.structuredResult?.competencyTags || []);
}
function readWorkStyleTags(exp) {
  return sanitizeWorkStyleTags(exp.workStyleTags || exp.structuredResult?.workStyleTags || []);
}

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

/* 타임라인에 표시할 실제 기간(날짜)이 있는지 — 없으면 '날짜 미입력'으로 분류 */
function hasRealPeriod(exp) {
  const period = exp.period || exp.structuredResult?.projectOverview?.duration || '';
  return /(\d{4})[.\-/](\d{1,2})/.test(period);
}

// 타임라인 바 팔레트. chip/chipJob은 바 위에 얹히는 태그 스타일로,
// 어두운 바에서는 흰 배경, 밝은 바에서는 브랜드 톤 배경을 써서 두 경우 모두 읽히게 한다.
const CHIP_ON_DARK = 'bg-white/95 text-bluewood-600';
const CHIP_JOB_ON_DARK = 'bg-white/95 text-primary-600';
const CHIP_ON_LIGHT = 'bg-surface-100 text-bluewood-500';
const CHIP_JOB_ON_LIGHT = 'bg-primary-50 text-primary-700';

const COLOR_PALETTES = {
  blue: [
    { bar: 'bg-primary-600', barText: 'text-white',       light: 'bg-primary-50', chip: CHIP_ON_DARK,  chipJob: CHIP_JOB_ON_DARK },
    { bar: 'bg-white',       barText: 'text-primary-700', light: 'bg-surface-50', border: 'border border-primary-200', chip: CHIP_ON_LIGHT, chipJob: CHIP_JOB_ON_LIGHT },
    { bar: 'bg-surface-200', barText: 'text-bluewood-700', light: 'bg-surface-50', chip: CHIP_ON_LIGHT, chipJob: CHIP_JOB_ON_LIGHT },
  ],
  green: [
    { bar: 'bg-caribbean-600', barText: 'text-white',         light: 'bg-caribbean-50', chip: CHIP_ON_DARK, chipJob: CHIP_JOB_ON_DARK },
    { bar: 'bg-white',         barText: 'text-caribbean-700', light: 'bg-surface-50', border: 'border border-caribbean-200', chip: CHIP_ON_LIGHT, chipJob: CHIP_JOB_ON_LIGHT },
    { bar: 'bg-surface-200',   barText: 'text-bluewood-700',  light: 'bg-surface-50', chip: CHIP_ON_LIGHT, chipJob: CHIP_JOB_ON_LIGHT },
  ],
  dark: [
    { bar: 'bg-bluewood-900', barText: 'text-white',        light: 'bg-bluewood-50', chip: CHIP_ON_DARK, chipJob: CHIP_JOB_ON_DARK },
    { bar: 'bg-white',        barText: 'text-bluewood-800', light: 'bg-surface-50', border: 'border border-bluewood-200', chip: CHIP_ON_LIGHT, chipJob: CHIP_JOB_ON_LIGHT },
    { bar: 'bg-surface-300',  barText: 'text-bluewood-800', light: 'bg-surface-50', chip: CHIP_ON_LIGHT, chipJob: CHIP_JOB_ON_LIGHT },
  ],
};

// 타임라인 행 간격. 카드 실제 높이(태그줄+제목+패딩 ≈ 62px)보다 넉넉해야 겹치지 않는다.
const TIMELINE_ROW_PITCH = 78;
const TIMELINE_ROW_TOP = 20;

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const MONTH_VALUES = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const CURRENT_YEAR = new Date().getFullYear();
const PERIOD_YEAR_OPTIONS = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR + 5 - i);

const SORT_OPTIONS = [
  { value: 'custom',    label: '직접 정렬' },
  { value: 'latest',    label: '최신순' },
  { value: 'period',    label: '기간순' },
  { value: 'favorite',  label: '즐겨찾기순' },
];

function updateYearMonth(value, part, nextValue) {
  const [year = '', month = ''] = String(value || '').split('-');
  const nextYear = part === 'year' ? nextValue : year;
  const nextMonth = part === 'month' ? nextValue : month;
  if (!nextYear && !nextMonth) return '';
  return `${nextYear || CURRENT_YEAR}-${nextMonth || '01'}`;
}

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
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-bold ${
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
  const { user, profile } = useAuthStore();
  const { isGuest, requireAuth } = useAuthGate();
  const location = useLocation();
  const tutorialKey = user?.uid ? `experience-flow-tutorial-${user.uid}` : null;
  const forceTutorial = new URLSearchParams(location.search).get('tutorial') === '1';
  const tutorialInitialStep = parseInt(new URLSearchParams(location.search).get('step') || '0', 10) || 0;
  const { visible: tutorialVisible, dismiss: dismissTutorial, show: showTutorial } = useOnboarding(tutorialKey, { force: forceTutorial });
  const { experiences, fetchExperiences, loading, loadError, deleteExperience, createExperience, updateExperience } = useExperienceStore();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [tutorialDemoExperience, setTutorialDemoExperience] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);   // 삭제 확인 대기 중인 경험

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editTags, setEditTags] = useState([]);     // 직무 역량
  const [editStyles, setEditStyles] = useState([]); // 업무 성향
  const [editCategory, setEditCategory] = useState(''); // 경험 유형(폴더)
  const [compFilter, setCompFilter] = useState('');  // 목록 직무역량 필터
  const [activeFolder, setActiveFolder] = useState('all'); // 목록 좌측 폴더 선택
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState('');
  const [categorySavingId, setCategorySavingId] = useState(null);

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
    // 비로그인은 목록을 렌더하지 않는다. 스토어는 그대로 두므로 로그인 사용자의 데이터에 영향이 없다.
    if (isGuest) return [];
    if (!tutorialDemoExperience) return experiences;
    return [tutorialDemoExperience, ...experiences.filter(exp => exp.id !== tutorialDemoExperience.id)];
  }, [isGuest, experiences, tutorialDemoExperience]);

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

  /* 날짜 보유 여부로 분리 — 타임라인은 날짜 있는 것만, 미입력은 하단에서 유도 */
  const datedExperiences = useMemo(() => sortedExperiences.filter(hasRealPeriod), [sortedExperiences]);
  const undatedExperiences = useMemo(() => sortedExperiences.filter(e => !hasRealPeriod(e)), [sortedExperiences]);

  /* ── 타임라인 인라인 편집 ── */
  const startEditing = (exp, e) => {
    e?.stopPropagation();
    const { start, end } = parsePeriod(exp);
    setEditingId(exp.id);
    setEditTitle(exp.title || '');
    setEditStart(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`);
    setEditEnd(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`);
    setEditTags(readCompetencyTags(exp));
    setEditStyles(readWorkStyleTags(exp));
    setEditCategory(EXPERIENCE_CATEGORIES.includes(exp.category) ? exp.category : '');
  };
  const cancelEditing = (e) => { e?.stopPropagation(); setEditingId(null); };
  const toggleEditTag = (tag) => setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  const toggleEditStyle = (tag) => setEditStyles(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  const saveEditing = async (e) => {
    e?.stopPropagation();
    if (!editingId || !editTitle.trim()) return;
    if (!editStart || !editEnd) {
      toast.error('시작/종료 연도와 월을 선택해주세요');
      return;
    }
    const tagPatch = {
      competencyTags: sanitizeCompetencyTags(editTags),
      workStyleTags: sanitizeWorkStyleTags(editStyles),
      category: editCategory || '',
    };
    if (editingId === tutorialDemoExperience?.id) {
      setTutorialDemoExperience(prev => prev ? { ...prev, title: editTitle.trim(), period: `${editStart}-01 ~ ${editEnd}-28`, ...tagPatch } : prev);
      toast.success('가상 경험이 수정되었습니다');
      setEditingId(null);
      return;
    }
    try {
      await updateExperience(editingId, { title: editTitle.trim(), period: `${editStart}-01 ~ ${editEnd}-28`, ...tagPatch });
      toast.success('수정 완료');
    } catch { toast.error('수정 실패'); }
    setEditingId(null);
  };

  const updateTimelineCategory = useCallback(async (exp, nextCategory, e) => {
    e?.stopPropagation();
    const category = nextCategory || '';
    const current = readCategory(exp) === UNCATEGORIZED ? '' : readCategory(exp);
    if (category === current || categorySavingId === exp.id) return;

    setHoveredBar(null);
    setCategorySavingId(exp.id);
    if (exp.isTutorialDemo) {
      setTutorialDemoExperience(prev => prev ? { ...prev, category } : prev);
      setCategorySavingId(null);
      toast.success(`${category || UNCATEGORIZED}(으)로 분류했어요`);
      return;
    }
    try {
      await updateExperience(exp.id, { category });
      toast.success(`${category || UNCATEGORIZED}(으)로 분류했어요`);
    } catch (error) {
      console.error('활동 유형 저장 실패:', error);
      toast.error('활동 유형을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setCategorySavingId(null);
    }
  }, [categorySavingId, updateExperience]);

  /* ── 타임라인 바 삭제 ── */
  const handleTimelineDelete = useCallback(async (exp, e) => {
    e.stopPropagation();
    if (exp.isTutorialDemo) {
      setTutorialDemoBuildStep('idle');
      setTutorialDemoExperience(null);
      setSelectedId(null);
      toast.success('가상 경험을 지웠습니다');
      return;
    }
    // 브라우저 기본 confirm 대신 브랜드 확인 다이얼로그로 (무엇이 지워지는지 명확히)
    setPendingDelete(exp);
  }, []);

  const confirmDeleteExperience = useCallback(async () => {
    const exp = pendingDelete;
    if (!exp) return;
    setPendingDelete(null);
    // Firestore 삭제가 끝난 뒤에만 성공 처리. 실패 시 안내(낙관적 토스트로 삭제된 것처럼 보이는 문제 방지)
    try {
      await deleteExperience(exp.id);
      if (selectedId === exp.id) setSelectedId(null);
      toast.success('삭제되었습니다');
    } catch (err) {
      console.error('경험 삭제 실패:', err);
      toast.error('삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [deleteExperience, selectedId, pendingDelete]);

  /* ── 날짜 미입력 경험에 기간 추가 → 타임라인 자동 편입 ── */
  const handleAddPeriod = useCallback(async (exp, startM, endM) => {
    if (!startM || !endM) { toast.error('시작/종료 월을 모두 선택해주세요'); return; }
    if (endM < startM) { toast.error('종료 월이 시작 월보다 빠를 수 없어요'); return; }
    const period = `${startM}-01 ~ ${endM}-28`;
    const startYear = parseInt(startM.split('-')[0], 10);
    if (exp.isTutorialDemo) {
      setTutorialDemoExperience(prev => prev ? { ...prev, period } : prev);
      setSelectedYear(startYear);
      toast.success('타임라인에 추가되었습니다');
      return;
    }
    try {
      await updateExperience(exp.id, { period });
      setSelectedYear(startYear); // 새로 들어간 경험이 보이도록 해당 연도로 이동
      toast.success('타임라인에 추가되었습니다');
    } catch (err) {
      console.error('기간 저장 실패:', err);
      toast.error('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [updateExperience]);

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
    if (datedExperiences.length === 0) return null;
    const items = datedExperiences.map(exp => ({ exp, ...parsePeriod(exp) }));
    const globalStart = new Date(selectedYear, 0, 1);
    const globalEnd = new Date(selectedYear, 11, 31);
    const months = Array.from({ length: 12 }, (_, i) => ({ year: selectedYear, month: i }));
    const totalMs = globalEnd.getTime() - globalStart.getTime();
    const visibleItems = items.filter(({ start, end }) => end >= globalStart && start <= globalEnd);
    return { items: visibleItems, allItems: items, globalStart, globalEnd, months, totalMs };
  }, [datedExperiences, selectedYear]);

  const availableYears = useMemo(() => {
    if (datedExperiences.length === 0) return [new Date().getFullYear()];
    const years = new Set();
    datedExperiences.forEach(exp => {
      const { start, end } = parsePeriod(exp);
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.add(y);
    });
    return [...years].sort((a, b) => b - a);
  }, [datedExperiences]);

  const visibleTimelineCategories = useMemo(() => {
    if (!ganttData) return [];
    const visible = new Set(ganttData.items.map(({ exp }) => readCategory(exp)));
    return [...EXPERIENCE_CATEGORIES, UNCATEGORIZED].filter(category => visible.has(category));
  }, [ganttData]);

  const timelineItems = useMemo(() => {
    if (!ganttData) return [];
    if (!timelineCategoryFilter) return ganttData.items;
    return ganttData.items.filter(({ exp }) => readCategory(exp) === timelineCategoryFilter);
  }, [ganttData, timelineCategoryFilter]);

  const filteredUndatedExperiences = useMemo(() => {
    if (!timelineCategoryFilter) return undatedExperiences;
    return undatedExperiences.filter(exp => readCategory(exp) === timelineCategoryFilter);
  }, [timelineCategoryFilter, undatedExperiences]);

  useEffect(() => {
    if (timelineCategoryFilter && !visibleTimelineCategories.includes(timelineCategoryFilter)) {
      setTimelineCategoryFilter('');
    }
  }, [timelineCategoryFilter, visibleTimelineCategories]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || '정렬';
  const headerSummary = useMemo(() => {
    if (displayExperiences.length === 0) {
      return { empty: true, message: '첫 경험을 추가하고 나만의 아카이브를 시작해보세요' };
    }
    if (viewMode === 'timeline') {
      return {
        count: timelineItems.length,
        suffix: `개의 경험이 ${selectedYear}년 타임라인에 표시되어 있어요`,
      };
    }
    if (viewMode === 'profile') {
      return {
        count: displayExperiences.length,
        suffix: '개의 경험이 프로필에 반영되어 있어요',
      };
    }
    return {
      count: displayExperiences.length,
      suffix: '개의 경험이 목록에 정리되어 있어요',
    };
  }, [displayExperiences.length, selectedYear, timelineItems.length, viewMode]);

  const experienceTutorialSteps = useMemo(() => [
    {
      // 이 튜토리얼이 이어서 보여주는 화면은 "자료로 만들기"(TemplateSelect)다.
      // 따라서 하이라이트도 그 버튼을 가리켜야 배운 대로 다시 찾아갈 수 있다.
      selector: '[data-tour="experience-import"]',
      title: '자료로 만들기를 눌러보세요',
      body: '경험을 만드는 방법은 두 가지예요. 파일·링크 같은 자료가 있다면 "자료로 만들기", 자료 없이 대화하며 정리하려면 "새 경험 추가"를 누르면 됩니다. 지금은 자료로 만드는 흐름을 보여드릴게요.',
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
      title: '프로필 보기를 눌러서 나를 한눈에 정리해보세요',
      body: '타임라인에서 기간을 확인했다면 프로필 보기로 바꿔보세요. 한 문장 소개, 대표 역량, 기술 스택, 커리어 요약이 자동으로 정리됩니다.',
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

  /* ── 경험 수정 패널 (목록·폴더 공용) ── */
  const renderEditPanel = (exp) => (
    <div key={exp.id} data-tour={exp.isTutorialDemo ? 'experience-edit-panel' : undefined} className="bg-surface-50/60 border border-surface-200 rounded-xl px-5 py-5">
      <p className="text-[12px] font-bold text-bluewood-400 uppercase tracking-[0.14em] mb-4">경험 수정</p>
      <div className="flex flex-col gap-3">
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
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-[13px] text-bluewood-400 mb-1">시작</label>
            <input type="month" value={editStart} onChange={e => setEditStart(e.target.value)}
              className="w-full text-[14px] text-bluewood-700 bg-white border border-surface-200 rounded-lg px-3 py-2 outline-none focus:border-bluewood-400 transition-colors" />
          </div>
          <span className="text-bluewood-300 mt-5">–</span>
          <div className="flex-1">
            <label className="block text-[13px] text-bluewood-400 mb-1">종료</label>
            <input type="month" value={editEnd} onChange={e => setEditEnd(e.target.value)}
              className="w-full text-[14px] text-bluewood-700 bg-white border border-surface-200 rounded-lg px-3 py-2 outline-none focus:border-bluewood-400 transition-colors" />
          </div>
        </div>
        <div>
          <label className="block text-[13px] text-bluewood-400 mb-1">경험 유형 <span className="text-bluewood-300">(폴더)</span></label>
          <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
            className="w-full text-[14px] text-bluewood-700 bg-white border border-surface-200 rounded-lg px-3 py-2 outline-none focus:border-bluewood-400 transition-colors">
            <option value="">미분류</option>
            {EXPERIENCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[13px] text-bluewood-400 mb-1.5">직무 역량 <span className="text-bluewood-300">(2~4개 권장)</span></label>
          <div className="flex flex-wrap gap-1.5">
            {JOB_COMPETENCIES.map(tag => {
              const on = editTags.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => toggleEditTag(tag)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-semibold border transition-colors ${on ? COMPETENCY_CHIP : 'bg-white text-bluewood-400 border-surface-200 hover:border-caribbean-200'}`}>
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-[13px] text-bluewood-400 mb-1.5">업무 성향 <span className="text-bluewood-300">(2~3개 권장)</span></label>
          <div className="flex flex-wrap gap-1.5">
            {WORK_STYLES.map(tag => {
              const on = editStyles.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => toggleEditStyle(tag)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-semibold border transition-colors ${on ? WORKSTYLE_CHIP : 'bg-white text-bluewood-400 border-surface-200 hover:border-primary-200'}`}>
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={cancelEditing} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-bluewood-500 bg-white border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
            <X size={13} /> 취소
          </button>
          <button onClick={saveEditing} className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
            <Check size={13} /> 저장
          </button>
        </div>
      </div>
    </div>
  );

  /* ── 경험 카드 (폴더 뷰) ── */
  const renderExperienceCard = (exp) => {
    const overview = exp.structuredResult?.projectOverview || {};
    const compTags = readCompetencyTags(exp);
    const styleTags = readWorkStyleTags(exp);
    const isFav = favorites.has(exp.id);
    const isSelected = selectedId === exp.id;
    const dated = hasRealPeriod(exp);
    const { start } = parsePeriod(exp);
    const dateLabel = dated ? `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, '0')}` : '날짜 미입력';
    return (
      <div
        key={exp.id}
        onClick={() => setSelectedId(isSelected ? null : exp.id)}
        onDoubleClick={() => { if (!exp.isTutorialDemo) navigate(`/app/experience/result/${exp.id}`); }}
        className={`group relative flex flex-col gap-2.5 rounded-xl border bg-white p-4 cursor-pointer transition-all ${
          isSelected ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200 hover:border-gray-300 hover:shadow-card-hover'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-[12px] font-bold tabular-nums ${dated ? 'text-primary-600' : 'text-gray-300'}`}>{dateLabel}</span>
          <button
            onClick={(e) => toggleFavorite(exp.id, e)}
            className={`transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
            title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            <Star size={15} className={isFav ? 'fill-current' : ''} />
          </button>
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-2" style={{ wordBreak: 'keep-all' }}>{stripMd(exp.title)}</p>
          {(overview.role || overview.summary) && (
            <p className="mt-1 text-[12.5px] text-gray-400 line-clamp-1">{stripMd(overview.role || overview.summary)}</p>
          )}
        </div>
        {(compTags.length > 0 || styleTags.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {compTags.slice(0, 3).map((t, i) => (
              <span key={`c${i}`} className={`px-2 py-0.5 rounded-md text-[12px] font-semibold ${COMPETENCY_CHIP}`}>{t}</span>
            ))}
            {styleTags.slice(0, 2).map((t, i) => (
              <span key={`s${i}`} className={`px-2 py-0.5 rounded-md text-[12px] font-semibold ${WORKSTYLE_CHIP}`}>{t}</span>
            ))}
          </div>
        )}
        {/* hover 액션 */}
        <div className="absolute right-2 bottom-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={(e) => startEditing(exp, e)} className="p-1.5 text-gray-300 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" title="수정">
            <Pencil size={13} />
          </button>
          <button onClick={(e) => handleTimelineDelete(exp, e)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="삭제">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

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
    <div className="animate-fadeIn max-w-[1320px] mx-auto">
      {/* ═══ 페이지 헤더 ═══ */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[34px] font-extrabold text-gray-900 tracking-[-0.03em] leading-tight">경험 정리</h1>
            <p className="text-[16px] text-gray-500 mt-2 font-medium">
              {headerSummary.empty
                ? headerSummary.message
                : <><span className="text-primary-600 font-bold text-[18px]">{headerSummary.count}</span>{headerSummary.suffix}</>}
            </p>
          </div>
          {/* 경험을 만드는 방법은 두 가지다.
              예전엔 "자료로 만들기"(TemplateSelect) 화면이 튜토리얼에서만 열려서,
              튜토리얼로 그 화면을 배운 사용자가 실제로는 절대 다시 갈 수 없었다. */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              data-tour="experience-import"
              onClick={() => requireAuth(() => {
                if (tutorialVisible && tutorialCurrentStep === 0) {
                  dismissTutorial(false);
                  setTutorialDemoExperience(null);
                  setTutorialDemoBuildStep('idle');
                  navigate('/app/experience/new?tutorial=1');
                  return;
                }
                navigate('/app/experience/new');
              })}
              className="flex items-center gap-1.5 rounded-xl border border-surface-200 bg-white px-4 py-3 text-[14.5px] font-bold text-bluewood-600 transition-colors hover:border-primary-200 hover:text-primary-600"
            >
              <FolderOpen size={16} /> 자료로 만들기
            </button>
            <button
              type="button"
              data-tour="experience-new"
              onClick={() => requireAuth(() => {
                // 튜토리얼 진행 중엔 기존 흐름(직접 작성 화면) 유지
                if (tutorialVisible || forceTutorial) {
                  if (tutorialVisible && tutorialCurrentStep === 0) {
                    dismissTutorial(false);
                    setTutorialDemoExperience(null);
                    setTutorialDemoBuildStep('idle');
                  }
                  navigate('/app/experience/new?tutorial=1');
                  return;
                }
                navigate('/app/experience/chat');
              })}
              className="flex items-center px-5 py-3 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 transition-colors shadow-sm shadow-primary-600/20"
            >
              + 새 경험 추가
            </button>
          </div>
        </div>
        {/* 불러오기 실패 — '데이터 없음'과 구분해서 보여준다 */}
        {loadError && !isGuest && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-[14px] font-medium text-red-700">
              경험 목록을 불러오지 못했어요. 데이터가 사라진 것이 아니라 불러오기에 실패한 상태입니다.
            </p>
            <button
              type="button"
              onClick={() => user?.uid && fetchExperiences(user.uid)}
              className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        )}
        {/* 비로그인 안내 — 화면은 보되 작성·저장은 로그인 후 */}
        {isGuest && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-5 py-4">
            <p className="text-[14px] font-medium text-bluewood-700">
              둘러보는 중이에요. 경험을 정리하고 저장하려면 로그인이 필요합니다.
            </p>
            <button
              type="button"
              onClick={() => requireAuth(() => {})}
              className="rounded-lg bg-primary-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-primary-700"
            >
              로그인하고 시작하기
            </button>
          </div>
        )}
        {!isGuest && experiences.length > 0 && (
          <div className="mb-6">
            <PortfolioReadinessBoard experiences={experiences} />
          </div>
        )}
        {/* 컨트롤 바 */}
        {/* 컨트롤 바 — 전문 라인형 탭 (메인 네이비 밑줄로 섹션 구분) */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-gray-200">
          {/* 뷰 탭 */}
          <div data-tour="experience-view-toggle" className="flex items-center gap-1">
            {[
              { key: 'timeline', label: '타임라인' },
              { key: 'table', label: '목록' },
              { key: 'dashboard', label: '대시보드' },
              { key: 'profile', label: '프로필' },
            ].map(t => {
              const active = viewMode === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setViewMode(t.key);
                    if (t.key === 'profile' && tutorialVisible && tutorialCurrentStep === 2) tutorialRef.current?.next();
                  }}
                  className={`relative px-3.5 pt-1 pb-3 text-[14.5px] font-bold transition-colors ${
                    active ? 'text-primary-700' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {t.label}
                  {active && <span className="absolute -bottom-px left-2 right-2 h-[2.5px] rounded-full bg-primary-600" />}
                </button>
              );
            })}
          </div>

          {/* 우측 컨트롤 */}
          <div className="flex items-center gap-2 pb-2">
            {viewMode === 'table' && (
              <select
                value={compFilter}
                onChange={e => setCompFilter(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:border-gray-300 transition-colors outline-none"
              >
                <option value="">전체 직무역량</option>
                {JOB_COMPETENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <div className="relative" ref={sortDropRef}>
              <button
                data-tour="experience-sort"
                onClick={() => setSortDropOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-600 hover:border-gray-300 transition-colors"
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
            <button
              type="button"
              onClick={() => { navigate('/app/experience?tutorial=1'); showTutorial(); }}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[13px] font-medium text-gray-500 hover:border-primary-200 hover:text-primary-600 transition-colors"
            >
              튜토리얼
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : displayExperiences.length === 0 ? (
        <EmptyState onAdd={() => requireAuth(() => navigate('/app/experience/chat'))} />
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
                  <span className="h-3.5 w-1 rounded-full bg-primary-600" />
                  <span className="text-[15px] font-bold text-bluewood-800">경험 타임라인</span>
                  <span className="text-[12px] font-bold text-bluewood-400 bg-white border border-surface-200 rounded-md px-2 py-1">
                    {timelineItems.length}개
                  </span>
                </div>
                {/* 팔레트 선택 */}
                <div className="flex items-center gap-1.5">
                  {[
                    { key: 'blue',  colors: ['bg-primary-600', 'bg-white border border-primary-200', 'bg-surface-200'] },
                    { key: 'green', colors: ['bg-caribbean-600', 'bg-white border border-caribbean-200', 'bg-surface-200'] },
                    { key: 'dark',  colors: ['bg-bluewood-900', 'bg-white border border-bluewood-200', 'bg-surface-300'] },
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

              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-white px-6 py-3">
                <span className="mr-1 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-gray-300">활동 유형</span>
                <button
                  type="button"
                  onClick={() => setTimelineCategoryFilter('')}
                  aria-pressed={!timelineCategoryFilter}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold transition ${
                    !timelineCategoryFilter
                      ? 'border-primary-300 bg-primary-600 text-white'
                      : 'border-gray-200 bg-white text-gray-400 hover:border-primary-200 hover:text-primary-600'
                  }`}
                >
                  전체 {ganttData.items.length}
                </button>
                {visibleTimelineCategories.map(category => {
                  const active = timelineCategoryFilter === category;
                  const count = ganttData.items.filter(({ exp }) => readCategory(exp) === category).length;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setTimelineCategoryFilter(active ? '' : category)}
                      aria-pressed={active}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] font-extrabold transition ${
                        active
                          ? 'border-primary-300 bg-primary-50 text-primary-700 ring-2 ring-primary-100'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-primary-200 hover:text-primary-600'
                      }`}
                    >
                      {category} {count}
                    </button>
                  );
                })}
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
                    <div className="relative" style={{ minHeight: `${Math.max(timelineItems.length, 1) * TIMELINE_ROW_PITCH + TIMELINE_ROW_TOP * 2}px` }}>
                      {/* 수직 격자선 */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {ganttData.months.map((m, i) => (
                          <div key={i} className="flex-1 border-r border-surface-100" />
                        ))}
                      </div>

                      {/* 간트 바 */}
                      {timelineItems.map(({ exp, start, end }, idx) => {
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
                            style={{ top: `${idx * TIMELINE_ROW_PITCH + TIMELINE_ROW_TOP}px`, left: `${startOffset}%`, width: `${barWidth}%`, minWidth: '150px', zIndex: isEditingThis ? 50 : 1 }}
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
                                    <span className="text-[12px] text-gray-400 w-6 flex-shrink-0">시작</span>
                                    <select
                                      value={editStart.split('-')[0] || ''}
                                      onChange={e => setEditStart(prev => updateYearMonth(prev, 'year', e.target.value))}
                                      className="w-20 text-[12px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400 bg-white"
                                    >
                                      {PERIOD_YEAR_OPTIONS.map(year => <option key={year} value={year}>{year}년</option>)}
                                    </select>
                                    <select
                                      value={editStart.split('-')[1] || ''}
                                      onChange={e => setEditStart(prev => updateYearMonth(prev, 'month', e.target.value))}
                                      className="w-14 text-[12px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400 bg-white"
                                    >
                                      {MONTH_VALUES.map(month => <option key={month} value={month}>{Number(month)}월</option>)}
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] text-gray-400 w-6 flex-shrink-0">종료</span>
                                    <select
                                      value={editEnd.split('-')[0] || ''}
                                      onChange={e => setEditEnd(prev => updateYearMonth(prev, 'year', e.target.value))}
                                      className="w-20 text-[12px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400 bg-white"
                                    >
                                      {PERIOD_YEAR_OPTIONS.map(year => <option key={year} value={year}>{year}년</option>)}
                                    </select>
                                    <select
                                      value={editEnd.split('-')[1] || ''}
                                      onChange={e => setEditEnd(prev => updateYearMonth(prev, 'month', e.target.value))}
                                      className="w-14 text-[12px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400 bg-white"
                                    >
                                      {MONTH_VALUES.map(month => <option key={month} value={month}>{Number(month)}월</option>)}
                                    </select>
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
                                  className={`${theme.bar} ${theme.border || ''} flex h-[62px] flex-col justify-center rounded-xl px-4 py-2 shadow-[0_0_0_2px_rgba(255,255,255,0.9)] cursor-pointer transition-all duration-200 ${
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
                                    if (!exp.isTutorialDemo) navigate(`/app/experience/result/${exp.id}`);
                                  }}
                                >
                                  <span className="mb-1.5 flex items-center gap-1.5 min-w-0">
                                    <select
                                      value={readCategory(exp) === UNCATEGORIZED ? '' : readCategory(exp)}
                                      onMouseDown={() => setHoveredBar(null)}
                                      onClick={e => e.stopPropagation()}
                                      onDoubleClick={e => e.stopPropagation()}
                                      onChange={e => updateTimelineCategory(exp, e.target.value, e)}
                                      disabled={categorySavingId === exp.id}
                                      aria-label={`${stripMd(exp.title)} 활동 유형 변경`}
                                      title="클릭해서 활동 유형 변경"
                                      className={`min-w-0 cursor-pointer appearance-none truncate rounded-md border-0 px-2 py-[3px] text-[11.5px] font-bold outline-none disabled:cursor-wait disabled:opacity-60 ${theme.chip}`}
                                    >
                                      <option value="">{UNCATEGORIZED}</option>
                                      {EXPERIENCE_CATEGORIES.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                      ))}
                                    </select>
                                    <span
                                      className={`max-w-[45%] shrink-0 truncate rounded-md px-2 py-[3px] text-[11.5px] font-bold ${theme.chipJob}`}
                                      title={`직무 · ${readJobCategoryLabel(exp)}`}
                                    >
                                      {readJobCategoryLabel(exp)}
                                    </span>
                                  </span>
                                  <span className={`text-[13px] font-semibold ${theme.barText} truncate block pr-12`}>
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
                      {timelineItems.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="rounded-lg bg-white/90 px-4 py-2 text-[12px] font-semibold text-gray-400">
                            {timelineCategoryFilter} 유형의 경험이 {selectedYear}년에는 없어요.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ 날짜 미입력 경험 — 기간 입력 시 타임라인에 자동 편입 ═══ */}
          {viewMode === 'timeline' && filteredUndatedExperiences.length > 0 && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="px-6 py-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 bg-gray-50/50">
                <span className="h-3.5 w-1 rounded-full bg-primary-600" />
                <span className="text-[15px] font-bold text-bluewood-800">날짜 미입력 경험</span>
                <span className="text-[12px] font-bold text-bluewood-400 bg-white border border-surface-200 rounded-md px-2 py-1">
                  {filteredUndatedExperiences.length}개
                </span>
                <span className="text-[13px] text-gray-400">기간을 입력하면 타임라인에 자동으로 들어가요</span>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredUndatedExperiences.map(exp => (
                  <UndatedExperienceCard key={exp.id} exp={exp} onAdd={handleAddPeriod} />
                ))}
              </div>
            </div>
          )}

          {/* ═══ 경험 목록 (좌측 폴더 메뉴 + 카드) ═══ */}
          {viewMode === 'table' && (() => {
            const list = sortedExperiences.filter(exp => !compFilter || readCompetencyTags(exp).includes(compFilter));
            const counts = {};
            list.forEach(exp => { const c = readCategory(exp); counts[c] = (counts[c] || 0) + 1; });
            const favCount = list.filter(e => favorites.has(e.id)).length;
            const folderItems = [
              { key: 'all', label: '전체', count: list.length },
              { key: 'fav', label: '즐겨찾기', count: favCount },
              ...[...EXPERIENCE_CATEGORIES, UNCATEGORIZED].filter(c => counts[c]).map(c => ({ key: c, label: c, count: counts[c] })),
            ];
            const shown = activeFolder === 'all'
              ? list
              : activeFolder === 'fav'
                ? list.filter(e => favorites.has(e.id))
                : list.filter(e => readCategory(e) === activeFolder);
            return (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[210px_1fr]">
                {/* 좌측 폴더 메뉴 */}
                <aside className="self-start md:sticky md:top-4">
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-2">
                    <p className="px-3 pt-2 pb-1.5 text-[12px] font-bold uppercase tracking-wider text-gray-300">폴더</p>
                    {folderItems.map(it => {
                      const on = activeFolder === it.key;
                      return (
                        <button
                          key={it.key}
                          onClick={() => setActiveFolder(it.key)}
                          className={`group flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                            on ? 'bg-primary-50 text-primary-700' : 'text-bluewood-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`h-3.5 w-1 rounded-full ${on ? 'bg-primary-600' : 'bg-transparent'}`} />
                            <span className="truncate">{it.label}</span>
                          </span>
                          <span className={`text-[12px] tabular-nums ${on ? 'text-primary-500' : 'text-gray-300'}`}>{it.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
                {/* 메인 카드 영역 */}
                <div>
                  {shown.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-[14px] text-gray-400 shadow-sm">이 폴더에 경험이 없어요.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {shown.map(exp => editingId === exp.id ? (
                        <div key={exp.id} className="sm:col-span-2 xl:col-span-3">{renderEditPanel(exp)}</div>
                      ) : renderExperienceCard(exp))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ═══ 대시보드 (커리어 GPS: 직무역량 집계 → 추천 직업군) ═══ */}
          {viewMode === 'dashboard' && (
            <CareerDashboard experiences={displayExperiences} user={user} profile={profile} />
          )}

          {/* ═══ 프로필 (나를 한눈에) ═══ */}
          {viewMode === 'profile' && (
            <ProfileView experiences={sortedExperiences} user={user} profile={profile} />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        tone="danger"
        title={`"${stripMd(pendingDelete?.title || '제목 없음')}" 경험을 삭제할까요?`}
        message="정리한 내용과 AI가 만든 구조화 결과가 모두 사라지고, 되돌릴 수 없어요. 이 경험을 담고 있는 포트폴리오에서도 빠집니다."
        confirmLabel="삭제"
        cancelLabel="그대로 두기"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDeleteExperience}
      />

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
          } : () => {
            setDetailData(null);
            navigate(`/app/experience/result/${detailData.id}`);
          }}
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

/* 실제 소프트웨어/툴만 인정 — 역량 문구(설계서 작성·문제 정의 등)는 제외.
   알려진 소프트웨어이거나, 한글이 아닌 영문 기술명(Figma·Python·SQL 등)만 허용. */
function isSoftwareSkill(name) {
  const s = String(name).trim();
  if (!s || s.length > 24) return false;
  if (matchSkillIcon(s)) return true;        // 카탈로그/별칭에 있는 소프트웨어(노션·피그마 등 한글명 포함)
  if (/[가-힣]/.test(s)) return false;       // 한글 역량 문구 제외
  return /[a-zA-Z]/.test(s);                  // 영문 기술명만 허용
}

/* ── 전체 경험에서 프로필 초안 자동 생성 (블로그 기법: 한 문장 + 역량 3키워드 + 기술 집계) ── */
function buildProfileDraft(experiences = []) {
  const skillCount = new Map();
  const kwCount = new Map();
  const kwProjects = new Map(); // 키워드 → 등장한 프로젝트 제목 Set
  let firstRole = '';

  experiences.forEach(exp => {
    const ov = exp.structuredResult?.projectOverview || {};
    if (!firstRole && ov.role) firstRole = stripMd(ov.role).split(/[,/·]/)[0].trim();
    const stack = Array.isArray(ov.techStack) ? ov.techStack : [];
    const skills = Array.isArray(exp.skills) ? exp.skills : [];
    [...stack, ...skills].forEach(s => {
      const k = String(s).trim();
      if (k && isSoftwareSkill(k)) skillCount.set(k, (skillCount.get(k) || 0) + 1);
    });
    const kws = exp.keywords || exp.structuredResult?.keywords || [];
    kws.forEach(s => {
      const k = String(s).trim();
      if (!k) return;
      kwCount.set(k, (kwCount.get(k) || 0) + 1);
      if (!kwProjects.has(k)) kwProjects.set(k, new Set());
      kwProjects.get(k).add(stripMd(exp.title || ''));
    });
  });

  const skills = [...skillCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const topKw = [...kwCount.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const competencies = topKw.slice(0, 3).map(keyword => {
    const projs = [...(kwProjects.get(keyword) || [])].filter(Boolean).slice(0, 2);
    return { keyword, definition: projs.length ? `${projs.join(', ')} 등에서 발휘한 역량` : '' };
  });
  const oneLiner = topKw.length
    ? `${topKw.slice(0, 2).join('·')}${firstRole ? ` · ${firstRole}` : ''}로 ${experiences.length}개의 경험을 쌓아온 사람`
    : '';

  return { oneLiner, competencies, skills };
}

/* 이력서 섹션 제목 — 파란 굵은 한글 제목 + 하단 구분선 (이미지 톤) */
function ResumeSectionTitle({ ko, en }) {
  return (
    <div className="mb-4 flex items-baseline gap-2 border-b border-gray-200 pb-2.5">
      <h3 className="text-[16px] font-extrabold tracking-tight text-primary-700">{ko}</h3>
      {en && <span className="text-[11.5px] font-bold uppercase tracking-[0.18em] text-gray-300">{en}</span>}
    </div>
  );
}

function cleanProfileText(value) {
  return stripMd(String(value || '')).replace(/\s+/g, ' ').trim();
}

function joinProfileParts(parts) {
  return parts.map(cleanProfileText).filter(Boolean).join(' ');
}

function ProfileResumeSection({ title, children }) {
  return (
    <section className="grid min-w-0 gap-5 border-t border-gray-300 py-9 md:grid-cols-[150px_minmax(0,1fr)]">
      <h3 className="text-[20px] font-extrabold text-primary-600">{title}</h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ProfileRows({ rows, emptyText = '입력된 내용이 없습니다' }) {
  if (!rows.length) {
    return <p className="text-[15px] font-medium text-gray-300">{emptyText}</p>;
  }
  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={row.id || `${row.label || row.date || row.value}-${index}`} className="grid min-w-0 gap-1.5 sm:grid-cols-[minmax(190px,220px)_minmax(0,1fr)] sm:gap-5">
          <p className="min-w-0 whitespace-normal break-words text-[15px] font-extrabold tabular-nums leading-relaxed text-gray-900">{row.label || row.date || ''}</p>
          <p className="min-w-0 text-[15px] font-medium leading-relaxed text-gray-800" style={{ overflowWrap: 'anywhere', wordBreak: 'keep-all' }}>{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function EditableProfileRows({
  rows,
  onChange,
  onAdd,
  onRemove,
  datePlaceholder = '기간',
  valuePlaceholder = '내용',
  addLabel = '항목 추가',
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.id || index} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(170px,210px)_minmax(0,1fr)_32px]">
          <input
            value={row.date || ''}
            onChange={e => onChange(index, 'date', e.target.value)}
            placeholder={datePlaceholder}
            className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-semibold tabular-nums text-gray-700 outline-none focus:border-primary-300"
          />
          <input
            value={row.value || ''}
            onChange={e => onChange(index, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 outline-none focus:border-primary-300"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex h-9 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500"
            aria-label={`${addLabel} 삭제`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-[12px] font-bold text-gray-400 hover:border-primary-300 hover:text-primary-600"
      >
        + {addLabel}
      </button>
    </div>
  );
}

function createProfileRow(prefix = 'row') {
  return {
    id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: '',
    value: '',
  };
}

function normalizeProfileRows(rows, prefix) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => ({
    id: cleanProfileText(row?.id) || `${prefix}-${index}`,
    date: cleanProfileText(row?.date),
    value: cleanProfileText(row?.value),
  }));
}

function seedEducationRows(profile) {
  return (profile?.education || []).map((edu, index) => ({
    id: `education-${index}`,
    date: cleanProfileText(edu.period || edu.date),
    value: joinProfileParts([edu.school || edu.name, edu.major, edu.degree || edu.detail]),
  })).filter(row => row.date || row.value);
}

function seedCertificateRows(profile) {
  return [
    ...(profile?.languageScores || []).map((item, index) => ({
      id: `language-${index}`,
      date: cleanProfileText(item.date),
      value: joinProfileParts([item.name, item.score]),
    })),
    ...(profile?.others || []).map((item, index) => ({
      id: `certificate-${index}`,
      date: '',
      value: cleanProfileText(item),
    })),
  ].filter(row => row.date || row.value);
}

function seedAwardRows(profile) {
  return (profile?.awards || []).map((item, index) => ({
    id: `award-${index}`,
    date: cleanProfileText(item.date),
    value: joinProfileParts([item.title, item.organization]),
  })).filter(row => row.date || row.value);
}

function ProfileView({ experiences, user, profile }) {
  const navigate = useNavigate();
  const uid = user?.uid;
  const draft = useMemo(() => buildProfileDraft(experiences), [experiences]);
  // 개인 설정의 가치관/자기소개 한 줄을 프로필 헤드라인으로 연동 (없으면 경험 기반 초안 사용)
  const settingsIntro = useMemo(() => {
    const essay = cleanProfileText(profile?.valuesEssay);
    if (essay) {
      const firstLine = essay.split('\n')[0].split(/[.!?…]/)[0].trim();
      return firstLine.length > 60 ? `${firstLine.slice(0, 60).trim()}…` : firstLine;
    }
    const vals = (profile?.values || [])
      .map(v => cleanProfileText(v?.keyword))
      .filter(Boolean)
      .slice(0, 3);
    if (vals.length) return `${vals.join(' · ')} 가치를 중요하게 여기는 사람`;
    return '';
  }, [profile]);
  const [saved, setSaved] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [iconPickerFor, setIconPickerFor] = useState(null); // 아이콘 선택 중인 스킬명

  // 저장된 프로필 로드
  useEffect(() => {
    if (!uid) { setLoaded(true); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'profiles', uid));
        if (alive) setSaved(snap.exists() ? (snap.data().careerProfile || null) : null);
      } catch { /* 무시 — 초안으로 시작 */ }
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [uid]);

  // 로드 완료 후 편집 폼 초기화 (저장본 우선, 없으면 초안)
  useEffect(() => {
    if (!loaded || form) return;
    setForm({
      oneLiner: saved?.oneLiner ?? (settingsIntro || draft.oneLiner),
      competencies: (saved?.competencies?.length ? saved.competencies : draft.competencies).slice(0, 3),
      hiddenIds: saved?.hiddenExperienceIds ?? [],   // 이력서에서 숨긴 경험
      basic: {
        name: saved?.basic?.name ?? (profile?.nameKo || user?.displayName || ''),
        birthDate: saved?.basic?.birthDate ?? cleanProfileText(profile?.birthDate),
        location: saved?.basic?.location ?? cleanProfileText(profile?.location),
      },
      educationRows: Array.isArray(saved?.educationRows)
        ? normalizeProfileRows(saved.educationRows, 'education')
        : seedEducationRows(profile),
      certificateRows: Array.isArray(saved?.certificateRows)
        ? normalizeProfileRows(saved.certificateRows, 'certificate')
        : seedCertificateRows(profile),
      awardRows: Array.isArray(saved?.awardRows)
        ? normalizeProfileRows(saved.awardRows, 'award')
        : seedAwardRows(profile),
      activityOverrides: saved?.activityOverrides && typeof saved.activityOverrides === 'object'
        ? saved.activityOverrides
        : {},
      software: saved?.software ?? draft.skills        // 아이콘 있는 실제 소프트웨어만 시드(거짓·무아이콘 제외)
        .map(s => ({ name: s.name, icon: matchSkillIcon(s.name), level: Math.min(5, Math.max(2, s.count + 1)) }))
        .filter(s => s.icon),
    });
  }, [loaded, form, saved, draft, settingsIntro, profile, user?.displayName]);

  const updateOneLiner = (v) => { setForm(f => ({ ...f, oneLiner: v })); setDirty(true); };
  const updateBasic = (field, value) => {
    setForm(f => ({ ...f, basic: { ...(f.basic || {}), [field]: value } }));
    setDirty(true);
  };
  const updateProfileRow = (field, index, key, value) => {
    setForm(f => ({
      ...f,
      [field]: (f[field] || []).map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
    }));
    setDirty(true);
  };
  const addProfileRow = (field, prefix) => {
    setForm(f => ({ ...f, [field]: [...(f[field] || []), createProfileRow(prefix)] }));
    setDirty(true);
  };
  const removeProfileRow = (field, index) => {
    setForm(f => ({ ...f, [field]: (f[field] || []).filter((_, rowIndex) => rowIndex !== index) }));
    setDirty(true);
  };
  const updateActivityOverride = (id, field, value) => {
    setForm(f => ({
      ...f,
      activityOverrides: {
        ...(f.activityOverrides || {}),
        [id]: { ...(f.activityOverrides?.[id] || {}), [field]: value },
      },
    }));
    setDirty(true);
  };
  const updateComp = (i, field, v) => {
    setForm(f => ({ ...f, competencies: f.competencies.map((c, idx) => idx === i ? { ...c, [field]: v } : c) }));
    setDirty(true);
  };
  const toggleHidden = (id) => {
    setForm(f => {
      const set = new Set(f.hiddenIds || []);
      set.has(id) ? set.delete(id) : set.add(id);
      return { ...f, hiddenIds: [...set] };
    });
    setDirty(true);
  };
  const seedSoftware = () => draft.skills
    .map(s => ({ name: s.name, icon: matchSkillIcon(s.name), level: Math.min(5, Math.max(2, s.count + 1)) }))
    .filter(s => s.icon);
  const addSoftware = (nm, icon) => {
    setForm(f => {
      if ((f.software || []).some(s => s.name.toLowerCase() === nm.toLowerCase())) return f;
      return { ...f, software: [...(f.software || []), { name: nm, icon, level: 3 }] };
    });
    setDirty(true);
    setIconPickerFor(null);
  };
  const removeSoftware = (i) => { setForm(f => ({ ...f, software: f.software.filter((_, j) => j !== i) })); setDirty(true); };
  const setSoftwareIcon = (i, icon) => { setForm(f => ({ ...f, software: f.software.map((s, j) => j === i ? { ...s, icon } : s) })); setDirty(true); setIconPickerFor(null); };
  const setSoftwareLevel = (i, level) => { setForm(f => ({ ...f, software: f.software.map((s, j) => j === i ? { ...s, level } : s) })); setDirty(true); };
  const resetToDraft = () => {
    setForm({
      oneLiner: settingsIntro || draft.oneLiner,
      competencies: draft.competencies.slice(0, 3),
      hiddenIds: [],
      basic: {
        name: profile?.nameKo || user?.displayName || '',
        birthDate: cleanProfileText(profile?.birthDate),
        location: cleanProfileText(profile?.location),
      },
      educationRows: seedEducationRows(profile),
      certificateRows: seedCertificateRows(profile),
      awardRows: seedAwardRows(profile),
      activityOverrides: {},
      software: seedSoftware(),
    });
    setDirty(true);
  };
  const save = async () => {
    if (!uid) { toast.error('로그인이 필요합니다'); return; }
    setSaving(true);
    try {
      const careerProfile = {
        oneLiner: form.oneLiner || '',
        competencies: form.competencies || [],
        hiddenExperienceIds: form.hiddenIds || [],
        basic: {
          name: cleanProfileText(form.basic?.name),
          birthDate: cleanProfileText(form.basic?.birthDate),
          location: cleanProfileText(form.basic?.location),
        },
        educationRows: normalizeProfileRows(form.educationRows, 'education'),
        certificateRows: normalizeProfileRows(form.certificateRows, 'certificate'),
        awardRows: normalizeProfileRows(form.awardRows, 'award'),
        activityOverrides: Object.fromEntries(
          Object.entries(form.activityOverrides || {}).map(([id, value]) => [id, {
            date: cleanProfileText(value?.date),
            value: cleanProfileText(value?.value),
          }]),
        ),
        software: form.software || [],
        updatedAt: new Date().toISOString(),
      };
      // profiles 보안 규칙: request.resource.data.uid == userId 필요 → uid 동봉
      await setDoc(doc(db, 'profiles', uid), { uid, careerProfile }, { merge: true });
      setSaved(careerProfile);
      setDirty(false);
      setEditing(false);
      toast.success('프로필이 저장되었습니다');
    } catch {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  const careerItems = useMemo(
    () => [...experiences].map(exp => ({ exp, ...parsePeriod(exp) })).sort((a, b) => b.start - a.start),
    [experiences],
  );

  if (!form) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" /></div>;
  }

  const name = cleanProfileText(form.basic?.name) || profile?.nameKo || user?.displayName || '이름';
  const email = user?.email || profile?.email || '';
  const competencies = form.competencies || [];
  const subtitle = competencies.map(c => c.keyword).filter(Boolean).slice(0, 3).join(' · ');
  const hiddenSet = new Set(form.hiddenIds || []);
  const visibleItems = careerItems.filter(({ exp }) => !hiddenSet.has(exp.id));
  const contact = profile?.contact || {};
  const primaryContact = [
    { label: 'PHONE', value: profile?.phone },
    { label: 'EMAIL', value: email },
    { label: 'SNS', value: contact.instagram || contact.github || contact.linkedin || contact.website },
  ].filter(item => cleanProfileText(item.value));
  const basicRows = [
    { label: '이름', value: name },
    { label: '생년월일', value: form.basic?.birthDate },
    { label: '주소', value: form.basic?.location },
  ].filter(row => cleanProfileText(row.value));
  const educationRows = normalizeProfileRows(form.educationRows, 'education').filter(row => row.date || row.value);
  const certificateRows = normalizeProfileRows(form.certificateRows, 'certificate').filter(row => row.date || row.value);
  const experienceActivityRows = visibleItems.slice(0, 4).map(({ exp, start, end }) => {
    const defaultDate = start.getFullYear() === end.getFullYear()
      ? `${start.getFullYear()}`
      : `${start.getFullYear()} - ${end.getFullYear()}`;
    const override = form.activityOverrides?.[exp.id] || {};
    return {
      id: `experience-${exp.id}`,
      date: override.date ?? defaultDate,
      value: override.value ?? cleanProfileText(exp.title),
    };
  });
  const activityRows = [
    ...normalizeProfileRows(form.awardRows, 'award'),
    ...experienceActivityRows,
  ].filter(row => row.date || row.value);
  const introText = form.oneLiner || settingsIntro || (subtitle ? `${subtitle}을 중심으로 경험을 쌓아온 ${name}입니다.` : `${name}님의 경험을 바탕으로 정리한 프로필입니다.`);
  const software = form.software || [];
  // 헤드라인 조립 — 이름 포함 여부·문장 종결에 따라 줄바꿈/조사가 깨지지 않게 처리
  const nameInIntro = Boolean(name && introText.includes(name));
  const introLead = (nameInIntro ? introText.split(name)[0] : introText).replace(/[\s·,]+$/, '');
  const introTail = nameInIntro
    ? introText.split(name).slice(1).join(name)
    : (/[.!?…]$|[다요함음죠네까]$/.test(introLead) ? '' : '입니다.');
  // 좁은 좌측 컬럼(230px)에서 헤드라인이 길어질수록 폰트를 줄여 정렬이 흐트러지지 않게 처리
  const headlineLen = `${introLead}${name}${introTail}`.length;
  const headlineFontSize = Math.max(16, Math.min(25, Math.round(25 - Math.max(0, headlineLen - 14) * 0.38)));

  return (
    <div className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* ── 편집 툴바 ── */}
      <div className="flex items-center justify-end gap-1.5 rounded-t-2xl border-b border-gray-100 bg-gray-50/60 px-5 py-2.5 sm:px-8">
        {editing ? (
          <>
            <button onClick={resetToDraft} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors" title="자동 초안으로 다시 채우기">
              <RotateCcw size={12} /> 초안
            </button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-40 transition-colors">
              {saving ? <span className="h-3 w-3 animate-spin rounded-full border-b-2 border-white" /> : <Save size={12} />} 저장
            </button>
            <button onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="편집 닫기">
              <X size={14} />
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors">
            <Pencil size={12} /> 편집
          </button>
        )}
      </div>

      <div className="px-7 py-10 sm:px-12 lg:px-16">
        <div className="grid gap-x-16 gap-y-8 pb-10 md:grid-cols-[230px_1fr]">
          <div>
            <h2 className="font-extrabold leading-snug text-gray-950" style={{ wordBreak: 'keep-all', textWrap: 'balance', fontSize: headlineFontSize }}>
              {introLead && <>{introLead}<br /></>}
              <span className="text-primary-600">{name}</span>{introTail}
            </h2>
          </div>
          <div>
            {primaryContact.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-3">
                {primaryContact.map(item => (
                  <div key={item.label}>
                    <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-gray-900">{item.label}</p>
                    <p className="mt-1 text-[16px] font-medium text-gray-800 break-all">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8">
            {editing ? (
              <textarea
                rows={4}
                value={form.oneLiner}
                onChange={e => updateOneLiner(e.target.value)}
                placeholder="나를 소개하는 문장을 입력해주세요"
                className="w-full resize-none border-b border-dashed border-gray-300 bg-transparent pb-2 text-[16px] leading-[1.9] text-gray-700 outline-none transition-colors placeholder:text-gray-300 focus:border-primary-300"
                style={{ wordBreak: 'keep-all' }}
              />
            ) : (
              <p className="text-[16px] font-medium leading-[1.9] text-gray-700" style={{ wordBreak: 'keep-all' }}>{introText}</p>
            )}
            </div>
            {editing && (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {competencies.map((c, i) => (
                  <input
                    key={i}
                    value={c.keyword}
                    onChange={e => updateComp(i, 'keyword', e.target.value)}
                    placeholder={`핵심 키워드 ${i + 1}`}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-[14px] font-bold text-gray-800 outline-none focus:border-primary-300"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:pl-[230px]">
          <ProfileResumeSection title="기본 사항">
            {editing ? (
              <div className="space-y-3">
                {[
                  { field: 'name', label: '이름', placeholder: '이름' },
                  { field: 'birthDate', label: '생년월일', placeholder: '예: 2002.05.05' },
                  { field: 'location', label: '주소', placeholder: '주소' },
                ].map(item => (
                  <label key={item.field} className="grid min-w-0 gap-2 sm:grid-cols-[minmax(170px,210px)_minmax(0,1fr)] sm:items-center">
                    <span className="text-[13px] font-extrabold text-gray-700">{item.label}</span>
                    <input
                      value={form.basic?.[item.field] || ''}
                      onChange={e => updateBasic(item.field, e.target.value)}
                      placeholder={item.placeholder}
                      className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 outline-none focus:border-primary-300"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <ProfileRows rows={basicRows} />
            )}
          </ProfileResumeSection>

          <ProfileResumeSection title="학력 사항">
            {editing ? (
              <EditableProfileRows
                rows={form.educationRows || []}
                onChange={(index, field, value) => updateProfileRow('educationRows', index, field, value)}
                onAdd={() => addProfileRow('educationRows', 'education')}
                onRemove={index => removeProfileRow('educationRows', index)}
                datePlaceholder="재학 기간"
                valuePlaceholder="학교·전공·학위"
                addLabel="학력 추가"
              />
            ) : (
              <ProfileRows rows={educationRows} emptyText="학력 정보가 없습니다" />
            )}
          </ProfileResumeSection>

          <ProfileResumeSection title="자격 사항">
            {editing ? (
              <EditableProfileRows
                rows={form.certificateRows || []}
                onChange={(index, field, value) => updateProfileRow('certificateRows', index, field, value)}
                onAdd={() => addProfileRow('certificateRows', 'certificate')}
                onRemove={index => removeProfileRow('certificateRows', index)}
                datePlaceholder="취득일"
                valuePlaceholder="자격증·어학명과 점수"
                addLabel="자격 추가"
              />
            ) : (
              <ProfileRows rows={certificateRows} emptyText="자격/어학 정보가 없습니다" />
            )}
          </ProfileResumeSection>

          <ProfileResumeSection title="활동 및 수상">
            {editing ? (
              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-[12px] font-extrabold text-gray-500">직접 입력한 활동·수상</p>
                  <EditableProfileRows
                    rows={form.awardRows || []}
                    onChange={(index, field, value) => updateProfileRow('awardRows', index, field, value)}
                    onAdd={() => addProfileRow('awardRows', 'award')}
                    onRemove={index => removeProfileRow('awardRows', index)}
                    datePlaceholder="활동 기간"
                    valuePlaceholder="활동·수상 내용"
                    addLabel="활동·수상 추가"
                  />
                </div>

                {careerItems.length > 0 && (
                  <div>
                    <p className="mb-2 text-[12px] font-extrabold text-gray-500">경험에서 가져온 항목</p>
                    <div className="space-y-3">
                    {careerItems.slice(0, 8).map(({ exp, start, end }) => {
                      const defaultDate = start.getFullYear() === end.getFullYear()
                        ? `${start.getFullYear()}`
                        : `${start.getFullYear()} - ${end.getFullYear()}`;
                      const override = form.activityOverrides?.[exp.id] || {};
                      const hidden = hiddenSet.has(exp.id);
                      return (
                        <div key={exp.id} className={`grid min-w-0 gap-2 rounded-xl border p-2 sm:grid-cols-[minmax(150px,190px)_minmax(0,1fr)_auto] ${
                          hidden ? 'border-gray-200 bg-gray-50 opacity-65' : 'border-primary-100 bg-primary-50/30'
                        }`}>
                          <input
                            value={override.date ?? defaultDate}
                            onChange={e => updateActivityOverride(exp.id, 'date', e.target.value)}
                            disabled={hidden}
                            aria-label={`${cleanProfileText(exp.title)} 기간`}
                            className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-semibold tabular-nums text-gray-700 outline-none focus:border-primary-300 disabled:bg-gray-100"
                          />
                          <input
                            value={override.value ?? cleanProfileText(exp.title)}
                            onChange={e => updateActivityOverride(exp.id, 'value', e.target.value)}
                            disabled={hidden}
                            aria-label={`${cleanProfileText(exp.title)} 내용`}
                            className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 outline-none focus:border-primary-300 disabled:bg-gray-100"
                          />
                          <button
                            type="button"
                            onClick={() => toggleHidden(exp.id)}
                            className={`rounded-lg px-3 py-2 text-[12px] font-bold transition-colors ${
                              hidden
                                ? 'bg-primary-600 text-white hover:bg-primary-700'
                                : 'border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:text-red-500'
                            }`}
                          >
                            {hidden ? '표시' : '숨김'}
                          </button>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ProfileRows rows={activityRows} emptyText="활동 또는 수상 정보가 없습니다" />
            )}
          </ProfileResumeSection>

          <ProfileResumeSection title="소프트웨어">
            {(software.length > 0 || editing) ? (
              <div className="flex flex-wrap gap-5">
                {software.map((sw, i) => (
                  <div key={`${sw.name}-${i}`} className="relative flex flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={!editing}
                    onClick={() => setIconPickerFor(iconPickerFor === `i${i}` ? null : `i${i}`)}
                    className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-none border bg-white ${editing ? 'border-gray-300 hover:border-primary-400 cursor-pointer' : 'border-gray-300'}`}
                    title={editing ? '아이콘 변경' : undefined}
                  >
                    <img src={sw.icon} alt={sw.name} className="h-8 w-8 object-contain" />
                  </button>
                  <span className="max-w-[84px] truncate text-center text-[12px] font-semibold text-gray-500">{sw.name}</span>
                  {editing && <button type="button" onClick={() => removeSoftware(i)} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[16px] leading-none text-gray-300 shadow hover:text-red-500" title="삭제">&times;</button>}

                  {/* 아이콘 변경 팝오버 */}
                  {editing && iconPickerFor === `i${i}` && (
                    <div className="absolute left-0 top-12 z-50 w-[268px] rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl">
                      <p className="mb-1.5 text-[12px] font-bold text-bluewood-600">아이콘 변경</p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {SKILL_ICONS.map(ic => (
                          <button
                            key={ic.id}
                            type="button"
                            onClick={() => setSoftwareIcon(i, ic.src)}
                            title={ic.label}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${sw.icon === ic.src ? 'border-primary-500 bg-primary-50' : 'border-transparent hover:bg-gray-50'}`}
                          >
                            <img src={ic.src} alt={ic.label} className="h-6 w-6 object-contain" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* + 소프트웨어 추가 */}
              {editing && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIconPickerFor(iconPickerFor === 'add' ? null : 'add')}
                    className="flex h-full min-h-[52px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-[13px] font-semibold text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors"
                  >
                    + 소프트웨어 추가
                  </button>
                  {iconPickerFor === 'add' && (
                    <div className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl">
                      <p className="mb-1.5 text-[12px] font-bold text-bluewood-600">소프트웨어 선택</p>
                      <div className="grid grid-cols-5 gap-1">
                        {SKILL_ICONS.map(ic => (
                          <button
                            key={ic.id}
                            type="button"
                            onClick={() => addSoftware(ic.label, ic.src)}
                            title={ic.label}
                            className="flex flex-col items-center gap-1 rounded-lg border border-transparent p-1.5 hover:bg-gray-50"
                          >
                            <img src={ic.src} alt={ic.label} className="h-7 w-7 object-contain" />
                            <span className="w-full truncate text-center text-[10.5px] text-gray-400">{ic.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[15px] font-medium text-gray-300" style={{ wordBreak: 'keep-all' }}>편집에서 다룰 수 있는 소프트웨어를 추가해보세요.</p>
          )}
          </ProfileResumeSection>
        </div>
      </div>
    </div>
  );
}

/* 날짜 미입력 경험 1건 — 기간 입력 후 '타임라인에 추가' */
function UndatedExperienceCard({ exp, onAdd }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    await onAdd(exp, start, end);
    setSaving(false);
  };
  return (
    <div className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-gray-900">
        {stripMd(exp.title)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={start}
          onChange={e => setStart(e.target.value)}
          className="rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[13px] text-bluewood-700 outline-none transition-colors focus:border-primary-400"
        />
        <span className="text-bluewood-300">~</span>
        <input
          type="month"
          value={end}
          onChange={e => setEnd(e.target.value)}
          className="rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[13px] text-bluewood-700 outline-none transition-colors focus:border-primary-400"
        />
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-1.5 text-[13px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {saving && <span className="h-3 w-3 animate-spin rounded-full border-b-2 border-white" />}
          타임라인에 추가
        </button>
      </div>
    </div>
  );
}

/* ── 대시보드 보조 컴포넌트 ── */
// 네이비 액센트 바 + 제목 (라인형 섹션 헤더)
function SectionHead({ title, sub, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-primary-600" />
          <h3 className="text-[18px] font-extrabold text-bluewood-800">{title}</h3>
        </div>
        {sub && <p className="mt-1 ml-3 text-[14px] font-medium text-gray-400" style={{ wordBreak: 'keep-all' }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}
// 보더리스 KPI (세로 라인으로 구분)
function DashStat({ label, value, hint, accent }) {
  return (
    <div className="py-1 sm:px-6 sm:first:pl-0 sm:last:pr-0">
      <p className="text-[12px] font-semibold text-gray-400">{label}</p>
      <p className={`mt-1 text-[20px] font-extrabold ${accent ? 'text-primary-700' : 'text-gray-900'}`} style={{ wordBreak: 'keep-all' }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11.5px] text-gray-400">{hint}</p>}
    </div>
  );
}

/* 커리어 대시보드 — 직무역량 집계 → 추천 직업군 (커리어 GPS) */
function CareerDashboard({ experiences = [], user, profile }) {
  const name = profile?.nameKo || user?.displayName || '회원';
  const autoTagAll = useExperienceStore(s => s.autoTagAll);
  const [tagging, setTagging] = useState(false);
  const [tagDone, setTagDone] = useState(0);
  const [liveJobs, setLiveJobs] = useState(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [expandedJob, setExpandedJob] = useState(null); // 역량 분석 펼친 공고 id

  const runAutoTag = async () => {
    setTagging(true);
    setTagDone(0);
    try {
      let total = 0;
      for (let i = 0; i < 30; i++) { // 안전 상한 (회당 12건)
        const r = await autoTagAll(false);
        total += r.tagged;
        setTagDone(total);
        if (!r.remaining) break;
      }
      toast.success(total > 0 ? `${total}개 경험을 자동 태깅했어요` : '새로 태깅할 경험이 없어요');
    } catch {
      toast.error('자동 태깅에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setTagging(false);
    }
  };

  const stats = useMemo(() => {
    const compCounts = {};
    const styleCounts = {};
    let tagged = 0;
    experiences.forEach(exp => {
      const c = readCompetencyTags(exp);
      const s = readWorkStyleTags(exp);
      if (c.length || s.length) tagged++;
      c.forEach(t => { compCounts[t] = (compCounts[t] || 0) + 1; });
      s.forEach(t => { styleCounts[t] = (styleCounts[t] || 0) + 1; });
    });
    const compTop = Object.entries(compCounts).sort((a, b) => b[1] - a[1]);
    const styleTop = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]);
    return {
      compTop, styleTop,
      families: recommendJobFamilies(compCounts, styleCounts), // 역량+성향 함께 반영
      styleFamilies: recommendByWorkStyle(styleCounts),         // 성향이 잘 맞는 직무
      tagged, total: experiences.length,
    };
  }, [experiences]);

  if (experiences.length === 0) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-[14px] text-gray-400 shadow-sm">경험을 추가하고 역량을 태깅하면 추천 직업군과 강점이 정리됩니다.</div>;
  }

  const topFamily = stats.families[0];
  const topComp = stats.compTop[0]?.[0];
  const presentComp = new Set(stats.compTop.map(([t]) => t));
  const gap = topFamily ? topFamily.competencies.filter(c => !presentComp.has(c)) : [];
  const topComps = stats.compTop.slice(0, 2).map(([t]) => t);
  const topStyles = stats.styleTop.slice(0, 2).map(([t]) => t);
  const headline = stats.total > 0 && topComps.length
    ? `${stats.total}개의 경험에서 ${topComps.join(' · ')} 역량을 중심으로${topStyles.length ? `, ${topStyles.join(' · ')}한 방식으로` : ''} 일해왔어요.`
    : '';
  const styleNames = stats.styleTop.slice(0, 3).map(([t]) => t);
  const styleDesc = styleNames.map(t => WORK_STYLE_INFO[t]).filter(Boolean).join(', ');
  // 차트 데이터 (리포트 느낌)
  const compChart = stats.compTop.slice(0, 7).map(([name, count]) => ({ name, count }));
  const styleChart = stats.styleTop.slice(0, 6).map(([name, value]) => ({ name, value }));
  const STYLE_COLORS = ['#002F6C', '#274d86', '#3a6db0', '#5f92c7', '#87add5', '#cdddee'];
  const chartTooltip = {
    cursor: { fill: 'rgba(0,47,108,0.04)' },
    contentStyle: { borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, padding: '6px 10px', boxShadow: '0 6px 20px rgba(0,47,108,0.10)' },
  };
  const recommendedJobs = liveJobs?.recommendations || [];

  const loadLiveJobs = async () => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const roles = [
        topFamily?.name,
        ...stats.families.slice(1, 3).map(f => f.name),
        ...stats.styleFamilies.slice(0, 2).map(f => f.name),
      ].filter(Boolean);
      const data = await recommendLiveJobs({
        targetRoles: roles,
        locations: ['서울', '경기', '원격'],
        preferences: {
          competencies: stats.compTop.slice(0, 8).map(([name]) => name),
          workStyles: stats.styleTop.slice(0, 8).map(([name]) => name),
          keywords: stats.compTop.slice(0, 4).map(([name]) => name),
        },
        limit: 4,
      });
      setLiveJobs(data);
      setExpandedJob(data?.recommendations?.[0]?.id || data?.recommendations?.[0]?.url || null);
      toast.success('추천 공고를 찾았어요');
    } catch (err) {
      const message = err.response?.data?.error || err.message || '추천 공고를 불러오지 못했어요';
      setJobsError(message);
      toast.error(message);
    } finally {
      setJobsLoading(false);
    }
  };

  return (
    <>
    <div className="rounded-2xl border border-gray-200 bg-white px-8 py-7 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-primary-400">Career Dashboard</p>
          <h2 className="mt-1.5 text-[32px] font-extrabold leading-tight text-gray-900">{name}님의 방향</h2>
          <p className="mt-2 text-[17px] font-semibold text-bluewood-600" style={{ wordBreak: 'keep-all' }}>
            {topFamily ? `${topFamily.name} 중심으로 정리됐어요` : '역량을 태깅하면 방향이 선명해져요'}
          </p>
        </div>
        {(stats.tagged < stats.total || tagging) && (
          <button
            onClick={runAutoTag}
            disabled={tagging}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2.5 text-[14px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {tagging
              ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-white" />태깅 중 {tagDone > 0 ? `${tagDone}건` : ''}</>
              : '자동 태깅'}
          </button>
        )}
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-primary-600 px-6 py-5 text-white">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/60">추천 진로</p>
          <p className="mt-2 text-[28px] font-extrabold leading-tight">{topFamily?.name || '준비 중'}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(topFamily?.matched || topComps).slice(0, 4).map(c => (
              <span key={c} className="rounded-md bg-white/15 px-2.5 py-1 text-[12px] font-bold text-white">{c}</span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-gray-400">대표 역량</p>
          <p className="mt-2 text-[24px] font-extrabold leading-tight text-gray-900" style={{ wordBreak: 'keep-all' }}>
            {topComps.length ? topComps.join(' · ') : '태깅 필요'}
          </p>
          <p className="mt-3 text-[13px] font-semibold text-gray-400">경험 {stats.total}개 · 태깅 {stats.tagged}/{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-gray-400">업무 성향</p>
          <p className="mt-2 text-[24px] font-extrabold leading-tight text-gray-900" style={{ wordBreak: 'keep-all' }}>
            {styleNames.length ? styleNames.slice(0, 2).join(' · ') : '태깅 필요'}
          </p>
          {gap.length > 0 && <p className="mt-3 text-[13px] font-semibold text-caribbean-700">다음 보강: {gap.slice(0, 2).join(' · ')}</p>}
        </div>
      </div>

      {(gap.length > 0 || stats.families.length > 1) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {gap.length > 0 && (
            <div>
              <p className="text-[15px] font-extrabold text-bluewood-800">다음 액션</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {gap.slice(0, 3).map(c => <span key={c} className="rounded-md border border-dashed border-caribbean-300 bg-caribbean-50/50 px-3 py-1.5 text-[13px] font-bold text-caribbean-700">{c}</span>)}
              </div>
            </div>
          )}
          {stats.families.length > 1 && (
            <div>
              <p className="text-[15px] font-extrabold text-bluewood-800">대안 진로</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {stats.families.slice(1, 4).map(f => <span key={f.name} className="rounded-md bg-primary-50 px-3 py-1.5 text-[13px] font-bold text-primary-700">{f.name}</span>)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 pt-8 border-t border-gray-100">
        <SectionHead
          title="실시간 추천 공고"
          sub={liveJobs?.profileSummary || '현재 공개 공고 중 맞는 것만 추립니다'}
          right={(
            <button
              type="button"
              onClick={loadLiveJobs}
              disabled={jobsLoading}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-primary-100 bg-primary-50 px-3.5 py-2 text-[13px] font-bold text-primary-700 transition-colors hover:bg-primary-100 disabled:opacity-60"
            >
              <RefreshCw size={14} className={jobsLoading ? 'animate-spin' : ''} />
              {recommendedJobs.length ? '새로고침' : '추천 공고 찾기'}
            </button>
          )}
        />

        {jobsLoading && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[0, 1].map(i => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-primary-500">
                    <Briefcase size={17} />
                  </span>
                  <div className="flex-1">
                    <div className="h-3 w-2/5 rounded bg-gray-200" />
                    <div className="mt-2 h-3 w-3/4 rounded bg-gray-200" />
                  </div>
                </div>
                <div className="mt-4 h-3 w-full rounded bg-gray-200" />
                <div className="mt-2 h-3 w-4/5 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        )}

        {!jobsLoading && jobsError && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 px-5 py-4 text-[13px] text-rose-700">
            <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
            <p className="font-semibold leading-relaxed" style={{ wordBreak: 'keep-all' }}>{jobsError}</p>
          </div>
        )}

        {!jobsLoading && !jobsError && !liveJobs && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-primary-600 shadow-sm">
                <Sparkles size={18} />
              </span>
              <div>
                <p className="text-[16px] font-extrabold text-bluewood-800">내 경험 기준으로 공고 찾기</p>
                <p className="mt-1 text-[14px] font-medium text-gray-400">실제 채용 링크만 보여줍니다.</p>
              </div>
            </div>
          </div>
        )}

        {!jobsLoading && recommendedJobs.length > 0 && (
          <div className="mt-5 divide-y divide-gray-100">
            {recommendedJobs.map(job => (
              <div key={job.id || job.url} className="py-5 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[11.5px] font-bold text-primary-700">{job.fitScore}점</span>
                      {job.matchLevel && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-emerald-700">{job.matchLevel}</span>}
                      <span className="text-[12px] font-semibold text-gray-400">{job.platform}</span>
                    </div>
                    <p className="mt-2 text-[13px] font-bold text-bluewood-500">{job.company}</p>
                    <h4 className="mt-0.5 text-[20px] font-extrabold leading-snug text-gray-900" style={{ wordBreak: 'keep-all' }}>{job.title}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] font-semibold text-gray-400">
                      {job.location && <span className="inline-flex items-center gap-1"><MapPin size={13} />{job.location}</span>}
                      {job.deadline && <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{job.deadline}</span>}
                    </div>
                    {job.matchingReasons?.length > 0 && (
                      <ul className="mt-3">
                        {job.matchingReasons.slice(0, 1).map(reason => (
                          <li key={reason} className="flex gap-2 text-[15px] font-medium leading-relaxed text-bluewood-700" style={{ wordBreak: 'keep-all' }}>
                            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-caribbean-500" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {job.matchedExperiences?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {job.matchedExperiences.slice(0, 2).map(exp => (
                          <span key={`${job.id}-${exp.title}`} className="rounded-md bg-gray-50 px-2.5 py-1 text-[12.5px] font-bold text-bluewood-500">
                            {exp.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700"
                    >
                      바로가기
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>

                {job.requiredCompetencies?.length > 0 && (() => {
                  const jobKey = job.id || job.url;
                  const open = expandedJob === jobKey;
                  return (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setExpandedJob(prev => (prev === jobKey ? null : jobKey))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-[12.5px] font-bold text-primary-700 transition-colors hover:bg-primary-100"
                      >
                        <Sparkles size={13} />
                        공고에서 뽑아낸 필수 역량 {job.requiredCompetencies.length}개
                        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                      </button>

                      {open && (
                        <div className="mt-4 space-y-3">
                          {job.requiredCompetencies.map((comp, ci) => (
                            <div key={comp.keyword} className="rounded-xl border border-gray-100 bg-gray-50/70 px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-[12px] font-bold text-white">{ci + 1}</span>
                                <h5 className="text-[15px] font-extrabold text-bluewood-800" style={{ wordBreak: 'keep-all' }}>{comp.keyword}</h5>
                              </div>
                              {comp.whatItMeans?.length > 0 && (
                                <ul className="mt-2.5 space-y-1.5 pl-1">
                                  {comp.whatItMeans.map(m => (
                                    <li key={m} className="flex gap-2 text-[13.5px] font-medium leading-relaxed text-gray-600" style={{ wordBreak: 'keep-all' }}>
                                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-300" />
                                      <span>{m}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {comp.howToConnect?.length > 0 && (
                                <div className="mt-3 rounded-lg bg-primary-50/60 px-3.5 py-3">
                                  <p className="text-[12.5px] font-extrabold text-primary-700">내 경험을 이렇게 연결하세요</p>
                                  <ol className="mt-2 space-y-1.5">
                                    {comp.howToConnect.map((h, hi) => (
                                      <li key={h} className="flex gap-2 text-[13.5px] font-semibold leading-relaxed text-bluewood-700" style={{ wordBreak: 'keep-all' }}>
                                        <span className="flex-shrink-0 font-bold text-primary-500">{hi + 1})</span>
                                        <span>{h}</span>
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ③ 분포 — 직무 역량(가로 막대) / 업무 성향(도넛) */}
      <div className="mt-8 pt-8 border-t border-gray-100">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {/* 직무 역량 분포 — 가로 막대 차트 */}
          <section>
            <SectionHead title="직무 역량 분포" sub={topComp ? <>가장 뛰어난 역량은 <span className="font-bold text-caribbean-600">{topComp}</span></> : null} />
            {compChart.length === 0 ? (
              <p className="mt-4 text-[13px] text-gray-300">경험에 직무 역량을 태깅하면 분포가 보여요.</p>
            ) : (
              <div className="mt-4" style={{ width: '100%', height: compChart.length * 42 + 10 }}>
                <ResponsiveContainer>
                  <BarChart data={compChart} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap="28%">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={116} tickLine={false} axisLine={false} tick={{ fontSize: 14, fill: '#445060', fontWeight: 700 }} />
                    <Tooltip {...chartTooltip} formatter={(v) => [`${v}개 경험`, '']} separator="" />
                    <Bar dataKey="count" fill="#09dd6d" radius={[0, 6, 6, 0]} maxBarSize={18}>
                      <LabelList dataKey="count" position="right" fill="#94a3b8" fontSize={12} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* 업무 성향 — 도넛 + 범례 */}
          <section className="lg:border-l lg:border-gray-100 lg:pl-12">
            <SectionHead title="업무 성향" sub={styleNames.length ? <><span className="font-bold text-primary-600">{styleNames.join(' · ')}</span>{styleDesc ? ` · ${styleDesc} 스타일` : ''}</> : null} />
            {styleChart.length === 0 ? (
              <p className="mt-4 text-[13px] text-gray-300">경험에 업무 성향을 태깅하면 분포가 보여요.</p>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
                <div className="relative" style={{ width: 168, height: 168 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={styleChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                        {styleChart.map((e, i) => <Cell key={e.name} fill={STYLE_COLORS[i % STYLE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...chartTooltip} formatter={(v, n) => [`${v}회`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[24px] font-extrabold text-primary-700 leading-none">{styleNames[0] || ''}</span>
                    <span className="mt-1 text-[12px] font-semibold text-gray-400">대표 성향</span>
                  </div>
                </div>
                <ul className="flex-1 space-y-1.5">
                  {styleChart.map((e, i) => (
                    <li key={e.name} className="flex items-center gap-2 text-[14px]">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STYLE_COLORS[i % STYLE_COLORS.length] }} />
                      <span className="font-semibold text-gray-700">{e.name}</span>
                      <span className="ml-auto tabular-nums text-gray-300">{e.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {stats.styleFamilies.length > 0 && (
              <div className="mt-6 border-l-2 border-primary-600 pl-4">
                <p className="mb-1.5 text-[12px] font-semibold text-gray-400">이 성향이 잘 맞는 직무</p>
                <div className="flex flex-wrap gap-1.5">
                  {stats.styleFamilies.slice(0, 4).map(f => <span key={f.name} className="px-2.5 py-1 rounded-md text-[12px] font-semibold bg-primary-50 text-primary-700">{f.name}</span>)}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>

    <CareerNarrativeSections
      experiences={experiences}
      targetCompetencies={topFamily?.competencies || []}
    />
    </>
  );
}

function EmptyState({ onAdd }) {
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

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-7 py-3.5 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 transition-all shadow-sm hover:shadow-md"
      >
        <Plus size={17} />
        첫 경험 추가하기
      </button>
    </div>
  );
}
