import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, FolderOpen, ChevronDown, Pencil, Trash2, Check, X,
  GripVertical, CalendarDays, List, Star, ArrowUpDown,
  Github, Loader2, ChevronRight, AlertCircle, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';
import { stripMd } from '../../utils/textUtils';
import api from '../../services/api';

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
  const { experiences, fetchExperiences, loading, deleteExperience, createExperience, updateExperience, reorderExperiences } = useExperienceStore();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  /* ── Git 커밋 분석 ── */
  const [showGitModal, setShowGitModal] = useState(false);
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitAuthor, setGitAuthor] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [gitAnalyzing, setGitAnalyzing] = useState(false);
  const [gitResult, setGitResult] = useState(null); // { repoName, totalCommits, experiences[] }
  const [gitSaving, setGitSaving] = useState({}); // { index: true/false }

  const handleGitAnalyze = async () => {
    if (!gitRepoUrl.trim() || !gitAuthor.trim()) {
      toast.error('레포지토리 URL과 GitHub 사용자명을 모두 입력해주세요.');
      return;
    }
    setGitAnalyzing(true);
    setGitResult(null);
    try {
      const { data } = await api.post('/experience/analyze-git', {
        repoUrl: gitRepoUrl.trim(),
        authorParam: gitAuthor.trim(),
        githubToken: gitToken.trim() || undefined,
      });
      setGitResult(data);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || '분석 실패. 잠시 후 다시 시도해주세요.');
    } finally {
      setGitAnalyzing(false);
    }
  };

  const handleSaveGitExperience = async (exp, idx) => {
    setGitSaving(prev => ({ ...prev, [idx]: true }));
    try {
      const content = {
        intro: exp.core_impact || '',
        overview: [exp.problem_definition?.join('\n'), exp.action_and_solution?.join('\n')].filter(Boolean).join('\n\n'),
        task: exp.problem_definition?.join('\n') || '',
        process: exp.action_and_solution?.join('\n') || '',
        output: exp.core_impact || '',
        growth: exp.learning?.join('\n') || '',
        competency: exp.core_tech_stack || '',
      };
      const newId = await createExperience(user.uid, {
        title: exp.project_name || gitResult?.repoName || '깃허브 프로젝트',
        framework: 'STRUCTURED',
        period: exp.period || '',
        skills: exp.core_tech_stack ? exp.core_tech_stack.split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean) : [],
        content,
      });
      toast.success('경험이 저장되었습니다!');
      setGitSaving(prev => ({ ...prev, [idx]: 'done' }));
    } catch (err) {
      toast.error('저장에 실패했습니다.');
      setGitSaving(prev => ({ ...prev, [idx]: false }));
    }
  };
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const timelineRef = useRef(null);
  const yearDropdownRef = useRef(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [colorPalette, setColorPalette] = useState('blue');

  /* ── 정렬 & 즐겨찾기 ── */
  const [sortBy, setSortBy] = useState('custom');
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const sortDropRef = useRef(null);
  const [favorites, setFavorites] = useState(loadFavs);

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
    const list = [...experiences];
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
  }, [experiences, sortBy, favorites]);

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
    try {
      await updateExperience(editingId, { title: editTitle.trim(), period: `${editStart}-01 ~ ${editEnd}-28` });
      toast.success('수정 완료');
    } catch { toast.error('수정 실패'); }
    setEditingId(null);
  };

  /* ── 타임라인 바 삭제 ── */
  const handleTimelineDelete = useCallback((exp, e) => {
    e.stopPropagation();
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
    if (experiences.length === 0) return [new Date().getFullYear()];
    const years = new Set();
    experiences.forEach(exp => {
      const { start, end } = parsePeriod(exp);
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.add(y);
    });
    return [...years].sort((a, b) => b - a);
  }, [experiences]);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || '정렬';

  return (
    <div className="animate-fadeIn max-w-[1240px] mx-auto">
      {/* ═══ 헤더 ═══ */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">경험 정리</h1>
          <p className="text-gray-400 text-sm mt-1">
            <span className="text-primary-600 font-semibold">{experiences.length}</span>개의 경험이 타임라인에 정리되어 있습니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 정렬 드롭다운 */}
          <div className="relative" ref={sortDropRef}>
            <button
              onClick={() => setSortDropOpen(v => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:border-gray-300 transition-colors"
            >
              <ArrowUpDown size={13} />
              {currentSortLabel}
              <ChevronDown size={11} className={`transition-transform ${sortDropOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortDropOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 min-w-[120px]">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortBy(opt.value); setSortDropOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                      sortBy === opt.value ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 뷰 전환 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'timeline' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarDays size={14} />타임라인
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={14} />표
            </button>
          </div>

          {/* Git 커밋 분석 버튼 */}
          <button
            onClick={() => setShowGitModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Github size={15} />
            Git 커밋 분석
          </button>

          {/* 새 경험 추가 버튼 + 말풍선 */}
          <div className="relative" style={{ overflow: 'visible' }}>
            {experiences.length === 0 && !loading && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 pointer-events-none animate-bounce" style={{ width: 'max-content' }}>
                {/* 삼각형 화살표: border 트릭으로 완전한 삼각형 생성 */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
                  <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '9px solid #4f46e5' }} />
                </div>
                {/* 말풍선 본체 */}
                <div style={{ background: '#4f46e5', color: 'white', fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 10, boxShadow: '0 4px 12px rgba(79,70,229,0.3)', whiteSpace: 'nowrap' }}>
                  여기서 첫 경험을 추가해보세요!
                </div>
              </div>
            )}
            <Link
              to="/app/experience/new"
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus size={18} />
              새 경험 추가
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : experiences.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ═══ 간트 타임라인 ═══ */}
          {viewMode === 'timeline' && ganttData && (
            <div className="bg-gray-100 rounded-2xl overflow-hidden">
              {/* 타임라인 헤더 */}
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* 년도 드롭다운 */}
                  <div className="relative" ref={yearDropdownRef}>
                    <button
                      onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white px-3 py-1.5 rounded-md border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      {selectedYear}년
                      <ChevronDown size={12} className={`transition-transform ${yearDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {yearDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[80px]">
                        {availableYears.map(y => (
                          <button
                            key={y}
                            onClick={() => { setSelectedYear(y); setYearDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                              y === selectedYear ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {y}년
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-bold text-gray-700">경험 타임라인</span>
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
                        colorPalette === p.key ? 'border-white shadow-md scale-110' : 'border-transparent hover:border-gray-300 opacity-60 hover:opacity-100'
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
              <div ref={timelineRef} style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111.11%', overflow: 'visible' }}>
                <div>
                  <div className="relative">
                    {/* 월 헤더 */}
                    <div className="flex border-b border-gray-200/60">
                      {ganttData.months.map((m, i) => (
                        <div key={`${m.year}-${m.month}`} className="flex-1 border-r border-gray-200/40 px-2 pt-1 pb-2">
                          <span className="text-[10px] font-medium text-gray-400">{MONTH_NAMES[m.month]}</span>
                        </div>
                      ))}
                    </div>

                    {/* 바 렌더 영역 */}
                    <div className="relative" style={{ minHeight: `${ganttData.items.length * 56 + 40}px` }}>
                      {/* 수직 격자선 */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {ganttData.months.map((m, i) => (
                          <div key={i} className="flex-1 border-r border-gray-200/40" />
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
                                  className="w-full text-[12px] font-semibold text-gray-800 bg-transparent outline-none border-b border-gray-200 pb-1 mb-2"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1.5 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-gray-400 w-6 flex-shrink-0">시작</span>
                                    <input type="month" value={editStart} onChange={e => setEditStart(e.target.value)}
                                      className="flex-1 text-[9px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-gray-400 w-6 flex-shrink-0">종료</span>
                                    <input type="month" value={editEnd} onChange={e => setEditEnd(e.target.value)}
                                      className="flex-1 text-[9px] border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-blue-400" />
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
                                    isSelected ? 'ring-2 ring-offset-2 ring-blue-400 shadow-lg' : 'hover:shadow-md'
                                  }`}
                                  onClick={() => setSelectedId(isSelected ? null : exp.id)}
                                  onDoubleClick={() => navigate(`/app/experience/structured/${exp.id}?view=true`)}
                                >
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ 경험 목록 (테이블) ═══ */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
              {/* 테이블 헤더 */}
              <div className="grid grid-cols-[24px_24px_40px_1fr_140px_120px_100px_80px] items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <span></span>
                <span></span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">순서</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">프로젝트</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">키워드</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">기간</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">성과</span>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">관리</span>
              </div>

              {/* 테이블 바디 */}
              <div className="divide-y divide-gray-50">
                {sortedExperiences.map((exp, idx) => {
                  const theme = COLOR_PALETTES[colorPalette][idx % 3];
                  const overview = exp.structuredResult?.projectOverview || {};
                  const displayKeywords = exp.keywords || exp.structuredResult?.keywords || [];
                  const keyExps = exp.structuredResult?.keyExperiences || [];
                  const metric = keyExps[0]?.metric;
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
                      <div key={exp.id} className="bg-blue-50 border-y border-blue-200 px-5 py-4">
                        <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-3">경험 수정</p>
                        <div className="flex flex-col gap-3">
                          {/* 제목 */}
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">제목</label>
                            <input
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveEditing(e); if (e.key === 'Escape') cancelEditing(e); }}
                              className="w-full text-sm font-semibold text-gray-800 bg-white border border-blue-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
                              autoFocus
                            />
                          </div>
                          {/* 기간 */}
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">시작</label>
                              <input
                                type="month"
                                value={editStart}
                                onChange={e => setEditStart(e.target.value)}
                                className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                              />
                            </div>
                            <span className="text-gray-400 mt-5">–</span>
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">종료</label>
                              <input
                                type="month"
                                value={editEnd}
                                onChange={e => setEditEnd(e.target.value)}
                                className="w-full text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                              />
                            </div>
                          </div>
                          {/* 버튼 */}
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={cancelEditing}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <X size={13} /> 취소
                            </button>
                            <button
                              onClick={saveEditing}
                              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
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
                      draggable={!isEditing}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => navigate(`/app/experience/structured/${exp.id}?view=true`)}
                      className={`group grid grid-cols-[24px_24px_40px_1fr_140px_120px_100px_80px] items-center gap-3 px-5 py-3.5 cursor-pointer transition-all duration-150 ${
                        isDragging ? 'opacity-40' : ''
                      } ${isOver && !isDragging ? 'border-t-2 border-t-blue-400' : ''
                      } ${isSelected ? `${theme.light}` : 'hover:bg-gray-50/60'}`}
                      onClick={() => setSelectedId(isSelected ? null : exp.id)}
                    >
                      {/* 드래그 핸들 — 모든 모드에서 활성화 */}
                      <div
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
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
                        <span className={`text-[11px] font-bold ${theme.barText}`}>{idx + 1}</span>
                      </div>

                      {/* 프로젝트 */}
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight block w-full">{stripMd(exp.title)}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5 block w-full">
                          {overview.role || overview.summary ? stripMd(overview.role || overview.summary) : ''}
                        </p>
                      </div>

                      {/* 키워드 */}
                      <div className="flex flex-wrap gap-1 overflow-hidden max-h-[36px]">
                        {displayKeywords.slice(0, 2).map((k, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium truncate max-w-[60px]">{k}</span>
                        ))}
                      </div>

                      {/* 기간 */}
                      <span className="text-[11px] text-gray-500 font-medium truncate">{periodStr}</span>

                      {/* 성과 */}
                      <span className="text-[11px] font-semibold text-gray-600 truncate">
                        {metric ? stripMd(metric) : '–'}
                      </span>

                      {/* 관리 */}
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => startEditing(exp, e)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="이름/기간 수정"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm('이 경험을 삭제하시겠습니까?')) deleteExperience(exp.id); }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
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
        <DetailModal type="experience" data={detailData} onClose={() => setDetailData(null)} />
      )}
      {exportData && (
        <ExportModal type="experience" data={exportData} onClose={() => setExportData(null)} />
      )}

      {/* ── Git 커밋 분석 모달 ── */}
      {showGitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center">
                  <Github size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Git 커밋 분석</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5">커밋 히스토리를 AI가 포트폴리오 경험으로 변환합니다</p>
                </div>
              </div>
              <button onClick={() => { setShowGitModal(false); setGitResult(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* 입력 폼 */}
              {!gitResult && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">GitHub 레포지토리 URL <span className="text-red-400">*</span></label>
                    <input
                      type="url"
                      value={gitRepoUrl}
                      onChange={e => setGitRepoUrl(e.target.value)}
                      placeholder="https://github.com/username/repo-name"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">GitHub 사용자명 (username) <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={gitAuthor}
                      onChange={e => setGitAuthor(e.target.value)}
                      placeholder="예: octocat"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">GitHub 프로필 URL의 사용자명입니다. (github.com/<strong>username</strong>)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Personal Access Token <span className="text-gray-400 font-normal">(비공개 레포일 경우)</span></label>
                    <input
                      type="password"
                      value={gitToken}
                      onChange={e => setGitToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">공개 레포는 입력하지 않아도 됩니다. 비공개 레포는 <code>repo</code> 권한이 있는 토큰이 필요합니다.</p>
                  </div>

                  <div className="bg-blue-50 rounded-xl px-4 py-3 flex gap-2.5">
                    <AlertCircle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-[11.5px] text-blue-700 space-y-1">
                      <p className="font-semibold">분석 방식 안내</p>
                      <p>최근 커밋 최대 80개를 수집하여 작업 유형별로 그룹핑한 뒤, AI가 각 그룹을 포트폴리오 경험 스토리로 변환합니다.</p>
                      <p>분석에는 30~60초가 소요될 수 있습니다.</p>
                    </div>
                  </div>

                  <button
                    onClick={handleGitAnalyze}
                    disabled={gitAnalyzing || !gitRepoUrl.trim() || !gitAuthor.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {gitAnalyzing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        커밋 분석 중...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        AI로 커밋 분석하기
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 분석 결과 */}
              {gitResult && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{gitResult.repoName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">총 {gitResult.totalCommits}개 커밋 분석 → {gitResult.experiences.length}개 경험 추출</p>
                    </div>
                    <button
                      onClick={() => setGitResult(null)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      다시 분석
                    </button>
                  </div>

                  {gitResult.experiences.map((exp, idx) => (
                    <div key={idx} className="border border-gray-100 rounded-2xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{exp.project_name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {exp.core_tech_stack && exp.core_tech_stack.split(/[,，、\s]+/).filter(Boolean).slice(0, 5).map((t, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-[10px] font-medium">{t}</span>
                            ))}
                            {exp.period && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">{exp.period}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => gitSaving[idx] !== 'done' && handleSaveGitExperience(exp, idx)}
                          disabled={gitSaving[idx] === true || gitSaving[idx] === 'done'}
                          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            gitSaving[idx] === 'done'
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'
                          }`}
                        >
                          {gitSaving[idx] === true ? <Loader2 size={12} className="animate-spin" /> : gitSaving[idx] === 'done' ? <Check size={12} /> : <Plus size={12} />}
                          {gitSaving[idx] === 'done' ? '저장됨' : '경험 저장'}
                        </button>
                      </div>

                      <div className="px-4 py-3 space-y-3">
                        {exp.core_impact && (
                          <div>
                            <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wide mb-1">핵심 성과</p>
                            <p className="text-xs text-gray-700 leading-relaxed">{exp.core_impact}</p>
                          </div>
                        )}
                        {exp.problem_definition?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wide mb-1">문제 정의</p>
                            <ul className="space-y-0.5">
                              {exp.problem_definition.map((p, i) => (
                                <li key={i} className="text-xs text-gray-600 flex gap-1.5"><ChevronRight size={11} className="shrink-0 mt-0.5 text-orange-400" />{p}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {exp.action_and_solution?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-1">해결 방식</p>
                            <ul className="space-y-0.5">
                              {exp.action_and_solution.map((a, i) => (
                                <li key={i} className="text-xs text-gray-600 flex gap-1.5"><ChevronRight size={11} className="shrink-0 mt-0.5 text-blue-400" />{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {exp.learning?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide mb-1">인사이트</p>
                            <ul className="space-y-0.5">
                              {exp.learning.map((l, i) => (
                                <li key={i} className="text-xs text-gray-600 flex gap-1.5"><ChevronRight size={11} className="shrink-0 mt-0.5 text-green-400" />{l}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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
            <p className="text-[12px] font-bold mb-1 truncate">{stripMd(exp.title)}</p>
            {tooltipSummary && (
              <p className="text-[11px] text-gray-300 leading-relaxed line-clamp-2 mb-1.5">{stripMd(tooltipSummary)}</p>
            )}
            {tooltipLines.length > 0 && (
              <div className="border-t border-gray-700 pt-1.5 space-y-0.5">
                {tooltipLines.map((line, i) => (
                  <p key={i} className="text-[10px] text-gray-400 truncate">• {line}</p>
                ))}
              </div>
            )}
            <div className={`absolute ${showAbove ? 'bottom-[-6px]' : 'top-[-6px]'} left-6 w-3 h-3 bg-gray-900 rotate-45`} />
          </div>
        );
      })()}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-100 rounded-2xl mb-4">
        <FolderOpen size={28} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-bold mb-2">아직 정리된 경험이 없습니다</h3>
      <p className="text-gray-400 text-sm mb-6">프레임워크를 선택하고 첫 경험을 정리해보세요</p>
      <Link
        to="/app/experience/new"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
      >
        <Plus size={18} />
        새 경험 추가
      </Link>
    </div>
  );
}
