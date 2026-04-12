import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Sparkles, Upload, ChevronLeft, ChevronRight, Pencil, Trash2, Star } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';

const PAGE_SIZE = 9;

/* ── 마크다운 ** 제거 유틸 ── */
function stripMd(s) { return s ? String(s).replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '') : ''; }

// 카드 배경 그라디언트 팔레트
const CARD_GRADIENTS = [
  'from-indigo-900 via-purple-800 to-pink-700',
  'from-slate-800 via-blue-900 to-indigo-800',
  'from-emerald-800 via-teal-700 to-cyan-600',
  'from-rose-800 via-pink-700 to-fuchsia-600',
  'from-amber-700 via-orange-600 to-red-600',
  'from-violet-900 via-purple-700 to-indigo-600',
  'from-sky-800 via-blue-700 to-indigo-600',
  'from-green-800 via-emerald-600 to-teal-500',
];

function getGradient(id) {
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

export default function ExperienceHub() {
  const { user } = useAuthStore();
  const { experiences, fetchExperiences, loading, deleteExperience, createExperience } = useExperienceStore();
  const navigate = useNavigate();
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [page, setPage] = useState(0);

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

  const totalPages = Math.ceil(experiences.length / PAGE_SIZE);
  const paged = experiences.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">경험 정리</h1>
          <p className="text-gray-500 mt-1">프레임워크로 경험을 체계적으로 정리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/experience/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
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
          <div className="grid grid-cols-3 gap-5">
            {paged.map(exp => (
              <ExperienceCard
                key={exp.id}
                experience={exp}
                onDetail={() => setDetailData(exp)}
                onExport={() => setExportData(exp)}
                onDelete={() => {
                  if (confirm('이 경험을 삭제하시겠습니까?')) deleteExperience(exp.id);
                }}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-surface-200 hover:bg-surface-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${i === page ? 'bg-primary-600 text-white' : 'hover:bg-surface-100 text-gray-500'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-2 rounded-xl border border-surface-200 hover:bg-surface-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
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

function ExperienceCard({ experience, onDelete, onDetail, onExport }) {
  const { id, title, framework, content, keywords, structuredResult, createdAt } = experience;
  const date = createdAt?.toDate?.()?.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) || '';
  const gradient = getGradient(id);
  const displayKeywords = keywords || structuredResult?.keywords || [];
  const projectOverview = structuredResult?.projectOverview || {};
  const keyExperiences = structuredResult?.keyExperiences || [];

  /* ── 미니 슬라이더 상태 ── */
  const [miniSlide, setMiniSlide] = useState(0);
  const timerRef = useRef(null);
  const slideCount = Math.max(keyExperiences.length, 1);

  useEffect(() => {
    if (keyExperiences.length <= 1) return;
    timerRef.current = setInterval(() => {
      setMiniSlide(prev => (prev + 1) % keyExperiences.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [keyExperiences.length]);

  const MINI_THEMES = [
    { color: '#ef4444', accent: '#3b82f6' },
    { color: '#2563eb', accent: '#2563eb' },
    { color: '#7c3aed', accent: '#7c3aed' },
  ];

  const completionScore = keyExperiences.length > 0
    ? Math.min(((keyExperiences.filter(e => e.metric).length / keyExperiences.length) * 5).toFixed(1), 5.0)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">

      {/* ════ 미니어처 슬라이더 영역 (이미지 자리) ════ */}
      <div className="relative mx-3 mt-3 rounded-xl overflow-hidden aspect-[4/3]"
        onMouseEnter={() => { if (timerRef.current) clearInterval(timerRef.current); }}
        onMouseLeave={() => {
          if (keyExperiences.length > 1)
            timerRef.current = setInterval(() => setMiniSlide(prev => (prev + 1) % keyExperiences.length), 4000);
        }}>

        {keyExperiences.length > 0 ? (
          /* ── 핵심 경험 미니어처 ── */
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-gray-100">
            {keyExperiences.map((exp, idx) => {
              const theme = MINI_THEMES[idx % MINI_THEMES.length];
              return (
                <div key={idx}
                  className="absolute inset-0 p-4 flex flex-col transition-all duration-500 ease-out"
                  style={{
                    opacity: idx === miniSlide ? 1 : 0,
                    transform: `translateX(${(idx - miniSlide) * 20}px)`,
                    pointerEvents: idx === miniSlide ? 'auto' : 'none',
                  }}>
                  {/* 미니 라벨 + 메트릭 */}
                  <span className="text-[9px] font-extrabold tracking-widest uppercase mb-2" style={{ color: theme.color }}>
                    {['Background & Problem', 'Analysis & Action', 'Result & Impact'][idx % 3]}
                  </span>
                  <h4 className="text-[13px] font-bold text-gray-800 leading-snug line-clamp-2 mb-2" style={{ wordBreak: 'keep-all' }}>
                    {stripMd(exp.title)}
                  </h4>

                  {/* 미니 메트릭 카드 */}
                  {exp.metric && (
                    <div className="mt-auto">
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200/60 p-2.5">
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-[10px] text-gray-500 font-medium">{stripMd(exp.metricLabel) || '핵심 지표'}</span>
                          <span className="text-[14px] font-black" style={{ color: theme.accent }}>{stripMd(exp.metric)}</span>
                        </div>
                        {/* 미니 비교 바 */}
                        <MiniCompareBar exp={exp} accent={theme.accent} />
                      </div>
                    </div>
                  )}

                  {/* 키워드 칩 */}
                  {(exp.keywords || []).length > 0 && !exp.metric && (
                    <div className="mt-auto flex flex-wrap gap-1">
                      {exp.keywords.slice(0, 2).map((k, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/70 border border-gray-200/60" style={{ color: theme.accent }}>
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 슬라이드 도트 */}
            {keyExperiences.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {keyExperiences.map((_, i) => (
                  <button key={i} onClick={() => setMiniSlide(i)}
                    className={`rounded-full transition-all duration-300 ${i === miniSlide ? 'w-4 h-1.5' : 'w-1.5 h-1.5'}`}
                    style={{ backgroundColor: i === miniSlide ? MINI_THEMES[i % MINI_THEMES.length].color : '#c4c4c4' }} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── 핵심 경험 없을 때 그라디언트 ── */
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            {experience.images?.length > 0 ? (
              <img src={experience.images[0].url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <>
                <div className="absolute top-4 right-6 w-16 h-16 rounded-full bg-white/10 blur-sm" />
                <div className="absolute bottom-6 left-4 w-10 h-10 rounded-lg bg-white/10 rotate-12 blur-sm" />
              </>
            )}
          </div>
        )}

        {/* 왼쪽 하단: 키워드 태그 (카드 이미지 위에 오버레이) */}
        {displayKeywords.length > 0 && keyExperiences.length > 0 && (
          <div className="absolute bottom-2.5 left-2.5 flex gap-1 z-10">
            {displayKeywords.slice(0, 2).map(k => (
              <span key={k} className="px-2 py-0.5 bg-white/80 backdrop-blur-sm text-[10px] font-medium text-gray-700 rounded-md border border-gray-200/40">
                {k}
              </span>
            ))}
          </div>
        )}

        {/* 오른쪽 하단: 완성도 점수 */}
        {completionScore !== null && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 bg-white/80 backdrop-blur-sm rounded-md z-10">
            <Star size={10} className="text-amber-500 fill-amber-500" />
            <span className="text-[10px] font-bold text-gray-700">{completionScore}</span>
          </div>
        )}
      </div>

      {/* ════ 본문 영역 ════ */}
      <div className="px-4 pt-4 pb-2 flex-1 flex flex-col">
        {/* 제목 + Top rated 뱃지 */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[15px] leading-snug line-clamp-1 text-gray-900">{stripMd(title)}</h3>
          {keyExperiences.length >= 3 && (
            <span className="flex-shrink-0 px-2.5 py-0.5 border border-gray-300 rounded-full text-[10px] font-medium text-gray-500 whitespace-nowrap">
              Top rated
            </span>
          )}
        </div>

        {/* 날짜 + 프레임워크 */}
        <p className="text-[11px] text-gray-400 mb-2">
          {date}{projectOverview.role ? ` · ${projectOverview.role}` : ''}
        </p>

        {/* 프로젝트 요약 */}
        {projectOverview.summary && (
          <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-2 mb-3">{stripMd(projectOverview.summary)}</p>
        )}

        {/* 기술스택 */}
        {(projectOverview.techStack || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3 mt-auto">
            {projectOverview.techStack.slice(0, 4).map((tech, i) => (
              <span key={i} className="px-2 py-0.5 bg-surface-100 text-gray-600 rounded text-[10px] font-medium">{tech}</span>
            ))}
            {projectOverview.techStack.length > 4 && (
              <span className="px-2 py-0.5 bg-surface-100 text-gray-400 rounded text-[10px]">+{projectOverview.techStack.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* ════ 하단: 가격행 스타일 → 자세히 보기 + 편집/삭제 ════ */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
        <Link to={`/app/experience/analysis/${id}`}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 rounded-full text-[11px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          자세히 보기
          <ChevronRight size={12} />
        </Link>
        <div className="flex items-center gap-1">
          <Link to={`/app/experience/structured/${id}`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
            <Pencil size={12} />
          </Link>
          <button onClick={onDelete}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 미니 비교 바 (카드 内) ── */
function MiniCompareBar({ exp, accent }) {
  const extractNum = (str) => {
    if (!str) return null;
    const m = str.replace(/,/g, '').match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
  };
  const bv = extractNum(exp.beforeMetric);
  const av = extractNum(exp.afterMetric);

  if (bv !== null && av !== null) {
    const maxVal = Math.max(bv, av, 1);
    const normBefore = Math.max((bv / maxVal) * 100, 8);
    const normAfter = Math.max((av / maxVal) * 100, 8);
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] text-gray-400 w-6 flex-shrink-0">전</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-300 rounded-full" style={{ width: `${normBefore}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold w-6 flex-shrink-0" style={{ color: accent }}>후</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${normAfter}%`, backgroundColor: accent }} />
          </div>
        </div>
      </div>
    );
  }

  // 메트릭만 있을 때 단순 바
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: '70%', backgroundColor: accent }} />
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
