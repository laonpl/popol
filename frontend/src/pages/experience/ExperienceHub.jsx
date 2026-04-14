import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, ChevronDown, Pencil, Trash2, Check, X, GripVertical, CalendarDays, List } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';

/* ── 유틸 ── */
function stripMd(s) { return s ? String(s).replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '') : ''; }

function formatDate(ts) {
  if (!ts) return '';
  const d = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date(ts));
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* period 문자열("2025-01-01 ~ 2025-06-30")에서 {start, end} Date 파싱 */
function parsePeriod(exp) {
  const period = exp.period || exp.structuredResult?.projectOverview?.duration || '';
  // "YYYY-MM-DD ~ YYYY-MM-DD" 또는 "YYYY.MM ~ YYYY.MM" 등
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
  // period 없으면 createdAt 기준 2개월
  const created = exp.createdAt?.toDate?.() ?? (exp.createdAt instanceof Date ? exp.createdAt : new Date(exp.createdAt || Date.now()));
  const end = new Date(created); end.setMonth(end.getMonth() + 2);
  return { start: created, end };
}

/* 3색 팔레트 — 다크 / 블루 / 라이트 */
const BAR_THEMES = [
  { bar: 'bg-slate-700', barText: 'text-white', text: 'text-slate-700', light: 'bg-slate-50', dot: 'bg-slate-700', label: 'text-slate-700' },
  { bar: 'bg-blue-500', barText: 'text-white', text: 'text-blue-600', light: 'bg-blue-50', dot: 'bg-blue-500', label: 'text-blue-600' },
  { bar: 'bg-gray-200', barText: 'text-gray-700', text: 'text-gray-500', light: 'bg-gray-50', dot: 'bg-gray-300', label: 'text-gray-600' },
];

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

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
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const timelineRef = useRef(null);
  const yearDropdownRef = useRef(null);

  /* ── 드래그 앤 드롭 ── */
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
      const ids = experiences.map(e => e.id);
      const [moved] = ids.splice(dragIdx, 1);
      ids.splice(overIdx, 0, moved);
      reorderExperiences(ids);
    }
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, overIdx, experiences, reorderExperiences]);

  /* ── 인라인 편집 ── */
  const startEditing = (exp, e) => {
    e?.stopPropagation();
    const { start, end } = parsePeriod(exp);
    setEditingId(exp.id);
    setEditTitle(exp.title || '');
    setEditStart(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`);
    setEditEnd(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`);
  };

  const cancelEditing = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const saveEditing = async (e) => {
    e?.stopPropagation();
    if (!editingId || !editTitle.trim()) return;
    try {
      const periodStr = `${editStart}-01 ~ ${editEnd}-28`;
      await updateExperience(editingId, {
        title: editTitle.trim(),
        period: periodStr,
      });
      toast.success('수정 완료');
    } catch (err) {
      toast.error('수정 실패');
    }
    setEditingId(null);
  };

  useEffect(() => {
    if (user?.uid) fetchExperiences(user.uid);
  }, [user?.uid]);

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

  /* ── 간트 타임라인 계산 (선택 년도 기준 12개월 고정) ── */
  const ganttData = useMemo(() => {
    if (experiences.length === 0) return null;

    const items = experiences.map((exp, idx) => {
      const { start, end } = parsePeriod(exp);
      return { exp, start, end, theme: BAR_THEMES[idx % BAR_THEMES.length] };
    });

    // 선택 년도 1월 1일 ~ 12월 31일 고정
    const globalStart = new Date(selectedYear, 0, 1);
    const globalEnd = new Date(selectedYear, 11, 31);

    // 12개월 고정 컬럼
    const months = Array.from({ length: 12 }, (_, i) => ({ year: selectedYear, month: i }));

    const totalMs = globalEnd.getTime() - globalStart.getTime();

    // 해당 년도에 걸치는 항목만 필터
    const visibleItems = items.filter(({ start, end }) => {
      return end >= globalStart && start <= globalEnd;
    });

    return { items: visibleItems, allItems: items, globalStart, globalEnd, months, totalMs };
  }, [experiences, selectedYear]);

  /* ── 사용 가능 년도 목록 ── */
  const availableYears = useMemo(() => {
    if (experiences.length === 0) return [new Date().getFullYear()];
    const years = new Set();
    experiences.forEach(exp => {
      const { start, end } = parsePeriod(exp);
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.add(y);
    });
    return [...years].sort((a, b) => b - a);
  }, [experiences]);

  /* ── 년도 드롭다운 외부 클릭 닫기 ── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'timeline' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarDays size={14} />
              타임라인
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={14} />
              표
            </button>
          </div>
          <Link
            to="/app/experience/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            새 경험 추가
          </Link>
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
                  <span className="text-sm font-bold text-gray-700">Product roadmap</span>
                </div>
              </div>

              {/* 간트 본체 — 90% 스케일, 스크롤 없음 */}
              <div ref={timelineRef} style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111.11%', overflow: 'hidden' }}>
                <div>
                  {/* 월 구분 격자 + 헤더 */}
                  <div className="relative">
                    {/* 월 헤더 행 */}
                    <div className="flex border-b border-gray-200/60">
                      {ganttData.months.map((m, i) => (
                        <div key={`${m.year}-${m.month}`}
                          className="flex-1 border-r border-gray-200/40 px-2 pt-1 pb-2">
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
                      {ganttData.items.map(({ exp, start, end, theme }, idx) => {
                        // 클램프: 선택 년도 범위 내로 제한
                        const clampedStart = new Date(Math.max(start.getTime(), ganttData.globalStart.getTime()));
                        const clampedEnd = new Date(Math.min(end.getTime(), ganttData.globalEnd.getTime()));
                        const startOffset = Math.max(0, (clampedStart.getTime() - ganttData.globalStart.getTime()) / ganttData.totalMs * 100);
                        const barWidth = Math.max(4, (clampedEnd.getTime() - clampedStart.getTime()) / ganttData.totalMs * 100);
                        const isSelected = selectedId === exp.id;
                        const keyExps = exp.structuredResult?.keyExperiences || [];
                        const tooltipLines = keyExps.slice(0, 3).map(ke => stripMd(ke.title)).filter(Boolean);
                        const overview = exp.structuredResult?.projectOverview;
                        const tooltipSummary = overview?.summary || overview?.background || '';

                        return (
                          <div key={exp.id}
                            className="absolute group/bar"
                            style={{
                              top: `${idx * 56 + 16}px`,
                              left: `${startOffset}%`,
                              width: `${barWidth}%`,
                              minWidth: '100px',
                            }}>
                            {/* 바 */}
                            <div
                              className={`${theme.bar} rounded-lg px-4 py-2.5 cursor-pointer transition-all duration-200 ${
                                isSelected ? 'ring-2 ring-offset-2 ring-blue-400 shadow-lg' : 'hover:shadow-md'
                              }`}
                              onClick={() => setSelectedId(isSelected ? null : exp.id)}
                              onDoubleClick={() => navigate(`/app/experience/structured/${exp.id}?view=true`)}
                            >
                              <span className={`text-[13px] font-semibold ${theme.barText} truncate block`}>
                                {stripMd(exp.title)}
                              </span>
                            </div>
                            {/* 호버 말풍선 */}
                            <div className="absolute left-0 top-full mt-2 w-[280px] bg-gray-900 text-white rounded-xl px-4 py-3 shadow-xl opacity-0 invisible group-hover/bar:opacity-100 group-hover/bar:visible transition-all duration-200 z-50 pointer-events-none">
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
                              {/* 화살표 */}
                              <div className="absolute -top-1.5 left-6 w-3 h-3 bg-gray-900 rotate-45" />
                            </div>
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
            <div className="grid grid-cols-[24px_40px_1fr_140px_120px_100px_80px] items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
              <span></span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">#</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">프로젝트</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">키워드</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">기간</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">성과</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">관리</span>
            </div>

            {/* 테이블 바디 */}
            <div className="divide-y divide-gray-50">
              {experiences.map((exp, idx) => {
                const theme = BAR_THEMES[idx % BAR_THEMES.length];
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

                return (
                  <div
                    key={exp.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDoubleClick={() => !isEditing && navigate(`/app/experience/structured/${exp.id}?view=true`)}
                    className={`group grid grid-cols-[24px_40px_1fr_140px_120px_100px_80px] items-center gap-3 px-5 py-3.5 cursor-pointer transition-all duration-150 ${
                      isDragging ? 'opacity-40' : ''
                    } ${isOver && !isDragging ? 'border-t-2 border-t-blue-400' : ''
                    } ${isSelected ? `${theme.light}` : 'hover:bg-gray-50/60'
                    }`}
                    onClick={() => !isEditing && setSelectedId(isSelected ? null : exp.id)}
                  >
                    {/* 드래그 핸들 */}
                    <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
                      onMouseDown={e => e.stopPropagation()}>
                      <GripVertical size={14} />
                    </div>

                    {/* # */}
                    <div className={`w-7 h-7 rounded-lg ${theme.bar} flex items-center justify-center`}>
                      <span className={`text-[11px] font-bold ${theme.barText}`}>{String.fromCharCode(65 + idx)}</span>
                    </div>

                    {/* 프로젝트 */}
                    <div className="min-w-0" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditing(e); if (e.key === 'Escape') cancelEditing(e); }}
                          className="w-full text-[13px] font-semibold text-gray-800 bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">{stripMd(exp.title)}</p>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">
                            {overview.role || overview.summary ? stripMd(overview.role || overview.summary) : ''}
                          </p>
                        </>
                      )}
                    </div>

                    {/* 키워드 */}
                    <div className="flex flex-wrap gap-1 overflow-hidden max-h-[36px]">
                      {displayKeywords.slice(0, 2).map((k, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium truncate max-w-[60px]">{k}</span>
                      ))}
                    </div>

                    {/* 기간 */}
                    <div className="min-w-0" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="month"
                            value={editStart}
                            onChange={e => setEditStart(e.target.value)}
                            className="w-full text-[10px] text-gray-600 bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 transition-colors"
                          />
                          <input
                            type="month"
                            value={editEnd}
                            onChange={e => setEditEnd(e.target.value)}
                            className="w-full text-[10px] text-gray-600 bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 transition-colors"
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 font-medium">{periodStr}</span>
                      )}
                    </div>

                    {/* 성과 */}
                    <span className={`text-[11px] font-semibold ${theme.label} truncate`}>
                      {metric ? stripMd(metric) : '–'}
                    </span>

                    {/* 관리 */}
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {isEditing ? (
                        <>
                          <button onClick={saveEditing}
                            className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors" title="저장">
                            <Check size={14} />
                          </button>
                          <button onClick={cancelEditing}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors" title="취소">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e) => startEditing(exp, e)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="이름/기간 수정">
                            <Pencil size={13} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); if (confirm('이 경험을 삭제하시겠습니까?')) deleteExperience(exp.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="삭제">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
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
        <ImportModal
          targetType="experience"
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {detailData && (
        <DetailModal type="experience" data={detailData} onClose={() => setDetailData(null)} />
      )}

      {exportData && (
        <ExportModal type="experience" data={exportData} onClose={() => setExportData(null)} />
      )}
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
      <p className="text-gray-400 text-sm mb-6">
        프레임워크를 선택하고 첫 경험을 정리해보세요
      </p>
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
