import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Sparkles, Upload, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';

const PAGE_SIZE = 9;

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
      const content = data.content || { projectName: imported?.content || '' };
      const newId = await createExperience(user.uid, {
        title: data.title || imported?.title || '임포트된 경험',
        framework: 'STRUCTURED',
        content,
        ...(data.inferredRole && {
          structuredResult: {
            ...content,
            inferredRole: data.inferredRole,
            section1Label: data.section1Label,
            section2Label: data.section2Label,
            section3Label: data.section3Label,
            section4Label: data.section4Label,
            keywords: data.suggestedKeywords || [],
            coachQuestions: data.coachQuestions || [],
          },
          keywords: data.suggestedKeywords || [],
        }),
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
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-surface-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
          >
            <Upload size={16} />
            불러오기
          </button>
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
  const date = createdAt?.toDate?.()?.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) || '';
  const gradient = getGradient(id);
  const displayKeywords = keywords || structuredResult?.keywords || [];
  const summary = structuredResult?.projectName || (content && Object.values(content)[0]?.slice(0, 40)) || '';

  return (
    <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden hover:shadow-lg transition-all flex flex-col">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="text-xs text-gray-400">{date}</span>
        <Link
          to={`/app/experience/structured/${id}`}
          className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
        >
          자세히 보기 →
        </Link>
      </div>

      {/* 제목 */}
      <div className="px-4 pb-3">
        <h3 className="font-bold text-base leading-snug line-clamp-1">{title}</h3>
      </div>

      {/* 그라디언트 썸네일 */}
      <div className={`relative mx-4 rounded-xl overflow-hidden bg-gradient-to-br ${gradient} aspect-square flex flex-col items-center justify-center`}>
        {experience.images?.length > 0 ? (
          <img
            src={experience.images[0].url}
            alt={experience.images[0].name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            {/* 추상 장식 */}
            <div className="absolute top-4 right-6 w-16 h-16 rounded-full bg-white/10 blur-sm" />
            <div className="absolute bottom-6 left-4 w-10 h-10 rounded-lg bg-white/10 rotate-12 blur-sm" />
            <div className="absolute top-1/3 left-1/3 w-20 h-20 rounded-full bg-white/5" />
          </>
        )}
        {/* 프레임워크 배지 */}
        <span className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/40 backdrop-blur-sm text-white text-xs font-semibold rounded-lg">
          {framework}
        </span>
        {summary && (
          <span className="absolute bottom-3 right-3 px-2 py-1 bg-black/30 backdrop-blur-sm text-white/80 text-[10px] rounded-md max-w-[55%] truncate">
            경험 요약
          </span>
        )}
      </div>

      {/* 본문 영역 */}
      <div className="px-4 pt-4 pb-2 flex-1">
        {/* AI 키워드 */}
        {(displayKeywords && displayKeywords.length > 0) ? (
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <Sparkles size={11} className="text-primary-500" />
              AI가 분석한 역량 키워드
            </p>
            <div className="flex flex-wrap gap-1.5">
              {displayKeywords.slice(0, 3).map(k => (
                <span key={k} className="px-2.5 py-1 rounded-full text-xs font-medium border bg-primary-50 text-primary-700 border-primary-200">
                  {k}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <p className="text-xs text-gray-300 flex items-center gap-1">
              <Sparkles size={11} />
              AI 분석 전
            </p>
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
        <div className="flex items-center gap-1">
          <Link
            to={`/app/experience/edit/${id}`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Pencil size={12} />
            편집
          </Link>
          <Link
            to={`/app/experience/structured/${id}`}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:bg-surface-100 rounded-lg transition-colors"
          >
            <Sparkles size={12} />
            AI 분석
          </Link>
        </div>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={12} />
          삭제
        </button>
      </div>
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
