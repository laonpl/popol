import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, FileText, Trash2, Edit, Download, Camera, Search, Star, Clock, ExternalLink, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';
import api from '../../services/api';

/* ── 두들링 배경 SVG ── */
function DoodleBackground({ templateType }) {
  const palettes = {
    notion:   { bg: '#EDF3F9', stroke: '#002F6C', accent: '#5f92c7' },
    ashley:   { bg: '#fff1f2', stroke: '#be123c', accent: '#fb7185' },
    academic: { bg: '#eff6ff', stroke: '#1d4ed8', accent: '#60a5fa' },
    timeline: { bg: '#fffbeb', stroke: '#b45309', accent: '#fbbf24' },
    default:  { bg: '#f0fdf4', stroke: '#166534', accent: '#4ade80' },
  };
  const p = palettes[templateType] || palettes.default;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox="0 0 400 210"
      preserveAspectRatio="xMidYMid slice"
      style={{ background: p.bg, display: 'block' }}
    >
      {/* 배경 원 */}
      <circle cx="320" cy="40"  r="60" fill={p.accent} fillOpacity="0.18" />
      <circle cx="60"  cy="170" r="50" fill={p.stroke} fillOpacity="0.08" />
      <circle cx="200" cy="105" r="80" fill={p.accent} fillOpacity="0.07" />

      {/* 손그림 느낌 선 */}
      <path d="M30,60 Q80,30 130,70 T230,60" stroke={p.stroke} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.35" />
      <path d="M160,150 Q220,120 270,160 T370,145" stroke={p.stroke} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M10,120 Q50,100 80,130" stroke={p.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />

      {/* 작은 도형들 */}
      <rect x="280" y="130" width="22" height="22" rx="4" stroke={p.stroke} strokeWidth="1.8" fill="none" opacity="0.4" transform="rotate(-15 291 141)" />
      <polygon points="350,80 363,105 337,105" stroke={p.stroke} strokeWidth="1.8" fill="none" opacity="0.35" />
      <polygon points="50,40 60,58 40,58"   stroke={p.accent} strokeWidth="1.5" fill="none" opacity="0.45" />

      {/* 점 패턴 */}
      {[0,1,2,3].map(i => (
        <circle key={i} cx={100 + i * 28} cy={185} r="3" fill={p.stroke} opacity="0.25" />
      ))}
      {[0,1,2].map(i => (
        <circle key={i} cx={310 + i * 20} cy={170} r="2.5" fill={p.accent} opacity="0.35" />
      ))}

      {/* 별/십자 */}
      <line x1="180" y1="25" x2="180" y2="45" stroke={p.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="170" y1="35" x2="190" y2="35" stroke={p.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="90"  y1="95" x2="90"  y2="111" stroke={p.accent} strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
      <line x1="82"  y1="103" x2="98" y2="103" stroke={p.accent} strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />

      {/* 물결 */}
      <path d="M230,190 Q250,180 270,190 T310,190" stroke={p.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5" />

      {/* 중앙 아이콘 힌트 */}
      <rect x="170" y="78" width="60" height="52" rx="10" fill="white" fillOpacity="0.55" />
      <path d="M185,102 L215,102 M185,112 L205,112" stroke={p.stroke} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="192" cy="92" r="5" stroke={p.stroke} strokeWidth="1.8" fill="none" opacity="0.5" />
    </svg>
  );
}

export default function PortfolioHub() {
  const { user } = useAuthStore();
  const { portfolios, fetchPortfolios, createPortfolio, deletePortfolio, loading } = usePortfolioStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [exportConfig, setExportConfig] = useState(location.state?.exportConfig || null);

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

  // 회사명별 그룹핑
  const groupMap = {};
  sorted.forEach(p => {
    const key = p.targetCompany?.trim() || '미설정';
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(p);
  });
  const groups = Object.entries(groupMap)
    .sort(([ka, a], [kb, b]) => {
      if (ka === '미설정') return 1;
      if (kb === '미설정') return -1;
      return b.length - a.length;
    })
    .map(([key, items]) => ({ key, items }));

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

      {/* 경험 내보내기 배너 */}
      {exportConfig && (
        <div className="mb-5 flex items-center gap-4 px-5 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <ExternalLink size={17} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-800">"{exportConfig.title}" 경험을 포트폴리오에 추가합니다</p>
            <p className="text-[12px] text-emerald-600 mt-0.5">아래에서 포트폴리오를 선택하면 {exportConfig.sectionOrder?.length || 0}개 섹션이 자동으로 추가됩니다.</p>
          </div>
          <button onClick={() => { setExportConfig(null); window.history.replaceState({}, '', window.location.pathname); }}
            className="text-emerald-400 hover:text-emerald-600 transition-colors text-xs px-2 py-1">
            취소
          </button>
        </div>
      )}

      {/* 검색 & 정렬 바 */}
      {portfolios.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
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
        <div className="flex flex-col w-full">
          {groups.map(({ key, items }, i) => (
            <PositionGroup
              key={key}
              positionKey={key}
              items={items}
              isLast={i === groups.length - 1}
              exportMode={!!exportConfig}
              onSelect={(p) => { if (exportConfig) navigate(`/app/portfolio/edit-notion/${p.id}`, { state: { exportConfig } }); }}
              onDetail={(p) => setDetailData(p)}
              onExport={(p) => setExportData(p)}
              onDelete={(p) => { if (confirm('이 포트폴리오를 삭제하시겠습니까?')) deletePortfolio(p.id); }}
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

/* 지원분야별 고정 색상 (해시 기반 할당) */
const DOT_COLORS = [
  'bg-primary-500', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400',
  'bg-violet-400',  'bg-sky-400',  'bg-orange-400','bg-teal-400',
];
function getDotColor(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffff;
  return DOT_COLORS[hash % DOT_COLORS.length];
}

function PositionGroup({ positionKey, items, isLast, exportMode, onSelect, onDetail, onExport, onDelete }) {
  const [open, setOpen] = useState(false);
  const dotColor = getDotColor(positionKey);
  const previews = items.slice(0, 3);

  return (
    <div>
      {/* ── 세로 목록 행 ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-2 py-3 hover:bg-white/60 transition-colors text-left rounded-lg"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />

        <div className="flex-1 min-w-0">
          <span className="font-medium text-gray-800 text-sm">
            {positionKey === '미설정' ? '회사 미설정' : positionKey}
          </span>
          <span className="ml-2 text-[12px] text-gray-400">{items.length}</span>
        </div>

        {/* 미리보기 썸네일 스택 */}
        <div className="flex items-center -space-x-1.5">
          {previews.map((p, i) => (
            <div
              key={p.id}
              className="w-6 h-6 rounded-full border border-white overflow-hidden bg-surface-100 flex-shrink-0"
              style={{ zIndex: previews.length - i }}
            >
              {p.thumbnailUrl
                ? <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                : <DoodleBackground templateType={p.templateType} />}
            </div>
          ))}
          {items.length > 3 && (
            <div className="w-6 h-6 rounded-full border border-white bg-surface-200 flex items-center justify-center text-[9px] font-bold text-gray-500 flex-shrink-0">
              +{items.length - 3}
            </div>
          )}
        </div>

        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-gray-300 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── 펼침: 컬럼 그리드 ── */}
      <div
        style={{
          maxHeight: open ? '4000px' : '0px',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-2 pt-2 pb-4">
          {items.map(p => (
            <PortfolioCard
              key={p.id}
              portfolio={p}
              exportMode={exportMode}
              onSelect={() => onSelect(p)}
              onDetail={() => onDetail(p)}
              onExport={() => onExport(p)}
              onDelete={() => onDelete(p)}
            />
          ))}
        </div>
      </div>

      {!isLast && <div className="h-px bg-surface-200" />}
    </div>
  );
}

function PortfolioCard({ portfolio, onDelete, onDetail, onExport, exportMode, onSelect }) {
  const { id, title, targetCompany, targetPosition, status, createdAt, templateType, thumbnailUrl, isFavorite, description, sections } = portfolio;
  const { user } = useAuthStore();
  const { updatePortfolio } = usePortfolioStore();
  const date = createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '';
  const isTemplate = ['notion', 'ashley', 'academic', 'timeline'].includes(templateType) || (typeof templateType === 'string' && templateType.startsWith('visual-'));

  // 사용자가 직접 설정한 이름을 메인으로
  const displayTitle = title || '제목 없음';
  const subtitle = targetCompany
    ? `${targetCompany}${targetPosition ? ` · ${targetPosition}` : ''}`
    : '지원 회사 미설정';

  const statusMap = {
    draft:    { label: '작성 중', dot: 'bg-amber-400' },
    review:   { label: '검토 중', dot: 'bg-blue-400' },
    exported: { label: '완료',    dot: 'bg-emerald-400' },
  };
  const s = statusMap[status] || statusMap.draft;

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [localThumb, setLocalThumb] = useState(thumbnailUrl || null);
  const [favorited, setFavorited] = useState(isFavorite || false);
  const [expanded, setExpanded] = useState(false);

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

  const handleOpen = () => {
    if (exportMode) return onSelect();
    if (isTemplate) window.location.href = `/app/portfolio/preview/${id}`;
    else onDetail();
  };

  const sectionCount = Array.isArray(sections) ? sections.length : 0;

  const descText = description
    || (targetCompany && targetPosition
      ? `${targetCompany}의 ${targetPosition} 직무를 위해 작성된 포트폴리오입니다. 경험 DB를 기반으로 맞춤 구성되었습니다.`
      : targetCompany
        ? `${targetCompany} 지원을 위해 작성된 포트폴리오입니다.`
        : '포트폴리오에 대한 설명을 추가해보세요.');

  return (
    <div className="bg-white rounded-3xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl">

      {/* ── 이미지 / 두들 영역 ── */}
      <div
        className="relative cursor-pointer group"
        style={{ paddingTop: '62%' }}
        onClick={handleOpen}
      >
        {/* 배경 */}
        <div className="absolute inset-0">
          {localThumb ? (
            <img src={localThumb} alt="썸네일" className="w-full h-full object-cover" />
          ) : (
            <DoodleBackground templateType={templateType} />
          )}
        </div>

        {/* 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

        {/* 즐겨찾기 */}
        <button
          onClick={handleToggleFavorite}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/40 transition-all"
        >
          <Star size={14} className={favorited ? 'fill-amber-300 text-amber-300' : 'text-white/80'} />
        </button>

        {/* 사진 업로드 — 호버시 노출 */}
        <button
          onClick={e => { e.stopPropagation(); handleThumbnailClick(); }}
          className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/40 text-white/90 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-all"
        >
          {uploading
            ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
            : <Camera size={11} />}
          {localThumb ? '변경' : '사진'}
        </button>

        {/* 하단 오버레이: 제목 + 열기 버튼 */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 px-4 pb-4 pt-8">
          <div className="min-w-0">
            <p className="text-white font-bold text-[15px] leading-tight line-clamp-1 drop-shadow">{displayTitle}</p>
            <p className="text-white/65 text-[11px] mt-0.5 truncate">{subtitle}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); handleOpen(); }}
            className="flex-shrink-0 px-4 py-2 bg-white/15 backdrop-blur-sm border border-white/25 text-white text-[12px] font-semibold rounded-full hover:bg-white/30 transition-all shadow-sm"
          >
            {exportMode ? '추가' : '열기'}
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* ── 펼침 상세 영역 ── */}
      {expanded && (
        <div className="px-5 pt-5 pb-3">
          {/* 제목 + 작성자 */}
          <h3 className="font-bold text-gray-900 text-[15px] leading-snug">{displayTitle}</h3>
          <p className="text-[11px] text-gray-400 mt-1">
            by {user?.displayName || '사용자'}
            {date && <span> &middot; {date}</span>}
          </p>

          {/* 통계 3칸 */}
          <div className="flex items-start gap-6 mt-4">
            <div>
              <p className="text-sm font-bold text-gray-900">{sectionCount || '-'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">섹션</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">상태</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 truncate max-w-[80px]">{targetCompany || '-'}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">지원사</p>
            </div>
          </div>

          {/* 설명 */}
          <p className="text-[12px] text-gray-500 leading-relaxed mt-4">{descText}</p>

          {/* 액션 버튼 */}
          {!exportMode && (
            <div className="flex items-center gap-1 mt-4 pt-3 border-t border-surface-100">
              <Link
                to={`/app/portfolio/edit-notion/${id}`}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-gray-500 hover:bg-surface-100 rounded-lg transition-colors"
              >
                <Edit size={13} /> 편집
              </Link>
              <button
                onClick={e => { e.stopPropagation(); onExport(); }}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-gray-500 hover:bg-surface-100 rounded-lg transition-colors"
              >
                <Download size={13} /> 내보내기
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-50 rounded-lg transition-colors ml-auto"
              >
                <Trash2 size={13} /> 삭제
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 접기/펼치기 버튼 ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-center py-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
    </div>
  );
}
