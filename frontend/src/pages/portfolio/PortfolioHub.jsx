import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Trash2, Edit, Upload, LayoutTemplate, Download, Eye, Camera, Search, Star, Clock } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';
import api from '../../services/api';

export default function PortfolioHub() {
  const { user } = useAuthStore();
  const { portfolios, fetchPortfolios, createPortfolio, deletePortfolio, loading } = usePortfolioStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent'); // 'recent' | 'favorites'

  useEffect(() => {
    if (user?.uid) fetchPortfolios(user.uid);
  }, [user?.uid]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createPortfolio(user.uid, {
        title: '새 포트폴리오',
        userName: user.displayName || '',
      });
      navigate(`/app/portfolio/edit-notion/${id}`);
    } catch (error) {
      console.error(error);
    }
    setCreating(false);
  };

  const handleImport = async ({ imported, structured }) => {
    try {
      const data = structured || {};
      const id = await createPortfolio(user.uid, {
        title: data.title || imported?.title || '임포트된 포트폴리오',
        userName: user.displayName || '',
        sections: data.sections || [],
      });
      navigate(`/app/portfolio/edit-notion/${id}`);
    } catch (error) {
      console.error('임포트 적용 실패:', error);
    }
  };

  // 검색 필터
  const filtered = portfolios.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.targetCompany?.toLowerCase().includes(q) ||
      p.targetPosition?.toLowerCase().includes(q)
    );
  });

  // 정렬
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'favorites') {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
    }
    return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
  });

  return (
    <div className="animate-fadeIn max-w-[1240px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">포트폴리오</h1>
          <p className="text-gray-500 mt-1">경험 DB 기반으로 맞춤형 포트폴리오를 작성하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/portfolio/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} />
            새 포트폴리오
          </Link>
        </div>
      </div>

      {/* 검색 & 정렬 바 */}
      {portfolios.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="포트폴리오 검색..."
              className="w-full pl-9 pr-4 py-2 border border-surface-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div className="flex items-center gap-1 bg-surface-100 rounded-xl p-1">
            <button
              onClick={() => setSortMode('recent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortMode === 'recent' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Clock size={14} /> 최신순
            </button>
            <button
              onClick={() => setSortMode('favorites')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortMode === 'favorites' ? 'bg-white text-amber-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Star size={14} /> 즐겨찾기순
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : portfolios.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold mb-2">아직 포트폴리오가 없습니다</h3>
          <p className="text-gray-400 text-sm mb-6">경험을 먼저 정리한 후 포트폴리오를 작성해보세요</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} /> 첫 포트폴리오 만들기
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20">
          <Search size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">'{searchQuery}'에 대한 검색 결과가 없습니다</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map(p => (
            <PortfolioCard
              key={p.id}
              portfolio={p}
              onDetail={() => setDetailData(p)}
              onExport={() => setExportData(p)}
              onDelete={() => {
                if (confirm('이 포트폴리오를 삭제하시겠습니까?')) deletePortfolio(p.id);
              }}
            />
          ))}
        </div>
      )}

      {showImport && (
        <ImportModal
          targetType="portfolio"
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      {detailData && (
        <DetailModal type="portfolio" data={detailData} onClose={() => setDetailData(null)} />
      )}

      {exportData && (
        <ExportModal type="portfolio" data={exportData} onClose={() => setExportData(null)} />
      )}
    </div>
  );
}

function PortfolioCard({ portfolio, onDelete, onDetail, onExport }) {
  const { id, title, targetCompany, targetPosition, status, createdAt, templateType, thumbnailUrl, isFavorite, headline } = portfolio;
  const { user } = useAuthStore();
  const { updatePortfolio } = usePortfolioStore();
  const date = createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '';
  const isTemplate = ['notion', 'ashley', 'academic', 'timeline'].includes(templateType);
  // 표시 제목: 템플릿은 headline 우선, 일반은 title
  const displayTitle = (isTemplate ? (headline || title) : title) || '제목 없음';
  const TEMPLATE_LABELS = { notion: '템플릿 1', ashley: '템플릿 2', academic: '템플릿 2', timeline: '템플릿 4' };
  const statusMap = {
    draft: { label: '작성 중', color: 'bg-yellow-50 text-yellow-700' },
    review: { label: '검토 중', color: 'bg-blue-50 text-blue-700' },
    exported: { label: '완료', color: 'bg-green-50 text-green-700' },
  };
  const s = statusMap[status] || statusMap.draft;

  const thumbColors = {
    notion: 'bg-slate-100',
    ashley: 'bg-rose-100',
    academic: 'bg-blue-100',
    timeline: 'bg-amber-100',
  };
  const thumbColor = thumbColors[templateType] || 'bg-primary-50';

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [localThumb, setLocalThumb] = useState(thumbnailUrl || null);
  const [favorited, setFavorited] = useState(isFavorite || false);

  const handleThumbnailClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;
      await updatePortfolio(id, { thumbnailUrl: url });
      setLocalThumb(url);
    } catch (err) {
      console.error('썸네일 업로드 실패:', err);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleToggleFavorite = async (e) => {
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    await updatePortfolio(id, { isFavorite: next });
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden hover:shadow-lg transition-all flex flex-col">
      {/* 썸네일 영역 — 클릭 시 자세히 보기 */}
      <div
        className={`relative ${localThumb ? 'bg-gray-100' : thumbColor} cursor-pointer group overflow-hidden`}
        style={{ paddingTop: '56.25%' /* 16:9 비율 */ }}
        onClick={() => {
          if (isTemplate) {
            window.location.href = `/app/portfolio/preview/${id}`;
          } else {
            onDetail();
          }
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {localThumb ? (
            <img src={localThumb} alt="썸네일" className="w-full h-full object-cover" />
          ) : (
            <FileText size={40} className="text-gray-300" />
          )}
        </div>
        {/* 좌측: 사진 업로드 버튼 */}
        <button
          onClick={e => { e.stopPropagation(); handleThumbnailClick(); }}
          className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
          title={localThumb ? '사진 변경' : '사진 업로드'}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
          ) : (
            <Camera size={16} className="text-gray-500" />
          )}
        </button>
        {/* 우측: 즐겨찾기 버튼 */}
        <button
          onClick={handleToggleFavorite}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white transition-colors shadow-sm"
        >
          <Star
            size={16}
            className={favorited ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}
          />
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="p-5 flex flex-col flex-1">
        {/* 날짜 */}
        <div className="flex items-center mb-3">
          <span className="ml-auto text-xs text-gray-400">{date}</span>
        </div>

        {/* 제목 */}
        <h3 className="text-lg font-bold mb-1 line-clamp-1">{displayTitle}</h3>

        {/* 설명 */}
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">
          {targetCompany ? `${targetCompany}${targetPosition ? ` · ${targetPosition}` : ''}` : '지원 회사 미설정'}
        </p>

        {/* 액션 버튼 */}
        <div className="mt-auto space-y-2">
          {/* 주 버튼: 자세히보기(비템플릿) / 미리보기(템플릿) */}
          {isTemplate ? (
            <Link
              to={`/app/portfolio/preview/${id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              자세히 보기
            </Link>
          ) : (
            <button
              onClick={onDetail}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              자세히 보기
            </button>
          )}
          <div className="flex items-center gap-1">
            <Link
              to={`/app/portfolio/edit-notion/${id}`}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <Edit size={14} /> 편집하기
            </Link>
            <button
              onClick={onExport}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-surface-100 rounded-lg transition-colors"
            >
              <Download size={14} />
            </button>
            <button
              onClick={onDelete}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
