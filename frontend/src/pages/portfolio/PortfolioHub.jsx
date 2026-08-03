import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, FileText, Trash2, Edit, Download, Search, Star, ExternalLink, ChevronDown, ArrowUpDown } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useAuthGate from '../../hooks/useAuthGate';
import usePortfolioStore from '../../stores/portfolioStore';
import ImportModal from '../../components/ImportModal';
import DetailModal from '../../components/DetailModal';
import ExportModal from '../../components/ExportModal';
import api from '../../services/api';


/* ── 템플릿별 카드 아이덴티티 ──
   기존에는 모든 카드가 같은 네이비 배경 + 클로버 로고여서 어떤 템플릿으로 만든 건지
   목록에서 구분할 수 없었다. 계열별로 색과 "레이아웃 뼈대" 그림을 달리해
   썸네일만 봐도 종류가 보이도록 한다. */
const TEMPLATE_STYLES = {
  notion:   { label: '노션형',     from: '#002F6C', to: '#00214d', ink: '#87add5', layout: 'doc' },
  ashley:   { label: '에디토리얼', from: '#7a1030', to: '#4a0a1d', ink: '#f2a8bb', layout: 'split' },
  academic: { label: '아카데믹',   from: '#123a63', to: '#0a2440', ink: '#8fc0e8', layout: 'paper' },
  timeline: { label: '타임라인형', from: '#7a4a09', to: '#4a2c04', ink: '#f5c775', layout: 'timeline' },
  visual:   { label: '비주얼형',   from: '#0a5f35', to: '#063d22', ink: '#76ffb5', layout: 'grid' },
  web:      { label: '웹사이트형', from: '#3c2a63', to: '#241940', ink: '#c0a8f0', layout: 'web' },
  default:  { label: '기본형',     from: '#314157', to: '#1d2735', ink: '#a4b2c2', layout: 'doc' },
};

function templateStyleOf(templateType) {
  const t = String(templateType || '');
  if (t.startsWith('visual-')) return TEMPLATE_STYLES.visual;
  if (t.startsWith('web-')) return TEMPLATE_STYLES.web;
  return TEMPLATE_STYLES[t] || TEMPLATE_STYLES.default;
}

/* 레이아웃 뼈대 — 색만으로는 구분이 약해서, 템플릿 구조를 단순 도형으로 보여준다 */
function TemplateGlyph({ layout, ink }) {
  const box = (x, y, w, h, o = 0.5, r = 2) =>
    <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={h} rx={r} fill={ink} opacity={o} />;
  const shapes = {
    doc:      [box(18, 14, 64, 6, 0.75), box(18, 26, 44, 4, 0.4), box(18, 40, 64, 3, 0.28), box(18, 48, 64, 3, 0.28), box(18, 56, 40, 3, 0.28)],
    split:    [box(14, 14, 32, 46, 0.55), box(52, 14, 34, 6, 0.75), box(52, 26, 34, 3, 0.3), box(52, 34, 34, 3, 0.3), box(52, 42, 22, 3, 0.3)],
    paper:    [box(30, 12, 40, 5, 0.7), box(18, 24, 64, 3, 0.28), box(18, 32, 64, 3, 0.28), box(18, 40, 30, 3, 0.28), box(54, 40, 28, 3, 0.28), box(18, 52, 64, 3, 0.28)],
    timeline: [box(22, 14, 3, 48, 0.45), box(32, 16, 40, 5, 0.7), box(32, 26, 28, 3, 0.3), box(32, 38, 44, 5, 0.7), box(32, 48, 24, 3, 0.3)],
    grid:     [box(16, 14, 32, 22, 0.6), box(52, 14, 32, 22, 0.4), box(16, 42, 32, 22, 0.4), box(52, 42, 32, 22, 0.6)],
    web:      [box(14, 12, 72, 8, 0.6), box(14, 26, 72, 20, 0.35), box(14, 52, 22, 12, 0.5), box(40, 52, 22, 12, 0.5), box(66, 52, 20, 12, 0.5)],
  };
  return (
    <svg viewBox="0 0 100 76" width="118" height="90" aria-hidden="true">
      {shapes[layout] || shapes.doc}
    </svg>
  );
}

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
  const { isGuest, requireAuth } = useAuthGate();
  const { portfolios, fetchPortfolios, createPortfolio, deletePortfolio, loading, loadError } = usePortfolioStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [exportConfig, setExportConfig] = useState(location.state?.exportConfig || null);
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const sortDropRef = useRef(null);

  useEffect(() => {
    if (user?.uid) fetchPortfolios(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    const h = (e) => {
      if (sortDropRef.current && !sortDropRef.current.contains(e.target)) setSortDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const id = await createPortfolio(user.uid, {
        title: '새 포트폴리오',
        userName: user.displayName || '',
      });
      // 경험 내보내기 중이면 새 포트폴리오에도 경험을 함께 전달해 자동 추가되게 한다.
      if (exportConfig) navigate(`/app/portfolio/edit-notion/${id}`, { state: { exportConfig } });
      else navigate(`/app/portfolio/edit-notion/${id}`);
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

  // 비로그인은 목록을 렌더하지 않는다. 스토어는 그대로 두므로 로그인 사용자의 데이터에 영향이 없다.
  const visiblePortfolios = isGuest ? [] : portfolios;

  // 검색 필터
  const filtered = visiblePortfolios.filter(p => {
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
    <>
    <div className="animate-fadeIn max-w-[1240px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-primary-600 tracking-[-0.02em]">포트폴리오</h1>
          <p className="text-[15px] text-bluewood-400 mt-1">
            <span className="text-primary-600 font-bold">{visiblePortfolios.length}</span>개의 포트폴리오가 있습니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => requireAuth(() => navigate('/app/portfolio/new'))}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-[15px] font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            새 포트폴리오
          </button>
        </div>
      </div>

      {/* 비로그인 안내 — 화면은 보되 저장·생성은 로그인 후 */}
      {isGuest && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-5 py-4">
          <p className="text-[14px] font-medium text-bluewood-700">
            둘러보는 중이에요. 포트폴리오를 만들고 저장하려면 로그인이 필요합니다.
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

      {/* 불러오기 실패 — '데이터 없음'과 구분해서 보여준다 */}
      {loadError && !isGuest && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-[14px] font-medium text-red-700">
            포트폴리오를 불러오지 못했어요. 데이터가 사라진 것이 아니라 불러오기에 실패한 상태입니다.
          </p>
          <button
            type="button"
            onClick={() => user?.uid && fetchPortfolios(user.uid)}
            className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 경험 내보내기 배너 */}
      {exportConfig && (
        <div className="mb-5 flex items-center gap-4 px-5 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <ExternalLink size={17} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-emerald-800">"{exportConfig.title}" 경험을 포트폴리오에 추가합니다</p>
            <p className="text-[14px] text-emerald-600 mt-0.5">아래에서 포트폴리오를 선택하면 {exportConfig.sectionOrder?.length || 0}개 섹션이 자동으로 추가됩니다.</p>
          </div>
          <button onClick={() => { setExportConfig(null); window.history.replaceState({}, '', window.location.pathname); }}
            className="text-emerald-400 hover:text-emerald-600 transition-colors text-xs px-2 py-1">
            취소
          </button>
        </div>
      )}

      {/* 검색 & 정렬 바 */}
      {visiblePortfolios.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-bluewood-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="포트폴리오 검색..."
              className="w-full pl-9 pr-4 py-2 border border-surface-200 rounded-lg text-[13px] text-bluewood-700 placeholder:text-bluewood-300 focus:outline-none focus:ring-2 focus:ring-bluewood-300 transition-all"
            />
          </div>

          {/* 정렬 드롭다운 */}
          <div className="relative" ref={sortDropRef}>
            <button
              onClick={() => setSortDropOpen(v => !v)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-surface-200 rounded-lg text-[13px] font-medium text-bluewood-600 hover:border-surface-300 transition-colors"
            >
              <ArrowUpDown size={13} />
              {sortMode === 'recent' ? '최신순' : '즐겨찾기순'}
              <ChevronDown size={11} className={`transition-transform ${sortDropOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortDropOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg z-30 py-1 min-w-[120px]">
                {[{ value: 'recent', label: '최신순' }, { value: 'favorites', label: '즐겨찾기순' }].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortMode(opt.value); setSortDropOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[13px] font-medium transition-colors ${
                      sortMode === opt.value ? 'text-primary-600 bg-surface-50 font-semibold' : 'text-bluewood-600 hover:bg-surface-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : visiblePortfolios.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="text-bluewood-200 mx-auto mb-3" />
          <h3 className="text-[18px] font-bold text-primary-600 mb-2">아직 포트폴리오가 없습니다</h3>
          <p className="text-bluewood-400 text-[14px] mb-6">경험을 먼저 정리한 후 포트폴리오를 작성해보세요</p>
          <button
            onClick={() => requireAuth(handleCreate)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> 첫 포트폴리오 만들기
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20">
          <Search size={36} className="text-bluewood-200 mx-auto mb-3" />
          <p className="text-bluewood-400 text-[14px]">'{searchQuery}'에 대한 검색 결과가 없습니다</p>
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
        <ExportModal
          type="portfolio"
          data={exportData}
          onClose={() => setExportData(null)}
          onTogglePublic={async (newVal) => {
            await updatePortfolio(exportData.id, { isPublic: newVal });
            setExportData(prev => prev ? { ...prev, isPublic: newVal } : prev);
          }}
        />
      )}
    </div>
    </>
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
        className="w-full flex items-center gap-3 px-2 py-3 hover:bg-surface-50 transition-colors text-left rounded-lg"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-bluewood-800 text-[14px]">
            {positionKey === '미설정' ? '회사 미설정' : positionKey}
          </span>
          <span className="ml-2 text-[13px] text-bluewood-300">{items.length}</span>
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
            <div className="w-6 h-6 rounded-full border border-white bg-surface-200 flex items-center justify-center text-[11px] font-bold text-gray-500 flex-shrink-0">
              +{items.length - 3}
            </div>
          )}
        </div>

        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-bluewood-300 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
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

function CloverIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="22" r="14" fill="white" fillOpacity="0.18" />
      <circle cx="22" cy="46" r="14" fill="white" fillOpacity="0.18" />
      <circle cx="50" cy="46" r="14" fill="white" fillOpacity="0.18" />
      <circle cx="36" cy="38" r="9" fill="white" fillOpacity="0.25" />
      <path d="M36 22 L22 46" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />
      <path d="M36 22 L50 46" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />
      <path d="M22 46 L50 46" stroke="white" strokeWidth="1.5" strokeOpacity="0.2" />
      <path d="M36 52 Q36 63 31 68" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.35" fill="none" />
    </svg>
  );
}

function PortfolioCard({ portfolio, onDelete, onDetail, onExport, exportMode, onSelect }) {
  const { id, title, targetCompany, targetPosition, status, templateType, isFavorite } = portfolio;
  const { updatePortfolio } = usePortfolioStore();
  const isWebTemplate = typeof templateType === 'string' && templateType.startsWith('web-');
  const isTemplate = ['notion', 'ashley', 'academic', 'timeline'].includes(templateType) || (typeof templateType === 'string' && templateType.startsWith('visual-'));

  const displayTitle = title || '제목 없음';
  const subtitle = targetCompany
    ? `${targetCompany}${targetPosition ? ` · ${targetPosition}` : ''}`
    : '지원 회사 미설정';

  const statusMap = {
    draft:    { label: '작성 중', dot: 'bg-amber-400' },
    review:   { label: '검토 중', dot: 'bg-sky-400' },
    exported: { label: '완료',    dot: 'bg-emerald-400' },
  };
  const s = statusMap[status] || statusMap.draft;

  const tpl = templateStyleOf(templateType);

  const [favorited, setFavorited] = useState(isFavorite || false);

  const handleToggleFavorite = async (e) => {
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    await updatePortfolio(id, { isFavorite: next });
  };

  const handleOpen = () => {
    if (exportMode) return onSelect();
    if (isWebTemplate) window.location.href = `/app/portfolio/web-edit/${id}`;
    else if (isTemplate) window.location.href = `/app/portfolio/preview/${id}`;
    else onDetail();
  };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
      style={{ aspectRatio: '3/4' }}
      onClick={handleOpen}
    >
      {/* ── 템플릿별 컬러 배경 + 레이아웃 뼈대 ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ background: `linear-gradient(150deg, ${tpl.from} 0%, ${tpl.to} 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 70% 20%, white 0%, transparent 55%), radial-gradient(circle at 20% 80%, white 0%, transparent 50%)',
          }}
        />
        <TemplateGlyph layout={tpl.layout} ink={tpl.ink} />
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: tpl.ink, opacity: 0.65 }}>
          {tpl.label}
        </p>
      </div>

      {/* 하단 정보 영역 */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-10 bg-gradient-to-t from-black/55 to-transparent">
        <span
          className="mb-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wide"
          style={{ backgroundColor: 'rgba(255,255,255,0.16)', color: tpl.ink }}
        >
          {tpl.label}
        </span>
        <p className="text-white font-bold text-[15px] leading-snug line-clamp-2 drop-shadow">{displayTitle}</p>
        <p className="text-white/60 text-[12px] mt-1 truncate">{subtitle}</p>
      </div>

      {/* 상태 뱃지 (좌상단) */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/20 backdrop-blur-sm rounded-full">
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        <span className="text-white/80 text-[11px] font-medium">{s.label}</span>
      </div>

      {/* 즐겨찾기 버튼 (우상단) */}
      <button
        onClick={handleToggleFavorite}
        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 transition-all"
      >
        <Star size={14} className={favorited ? 'fill-amber-300 text-amber-300' : 'text-white/60'} />
      </button>

      {/* 호버 오버레이: 액션 버튼 */}
      {!exportMode ? (
        <div className="absolute inset-0 bg-primary-900/75 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <Link
            to={`/app/portfolio/edit-notion/${id}`}
            onClick={e => e.stopPropagation()}
            className="flex flex-col items-center gap-1.5 px-4 py-3 bg-white/15 rounded-xl hover:bg-white/30 transition-colors text-white"
          >
            <Edit size={17} />
            <span className="text-[11px] font-semibold">편집</span>
          </Link>
          <button
            onClick={e => { e.stopPropagation(); onExport(); }}
            className="flex flex-col items-center gap-1.5 px-4 py-3 bg-white/15 rounded-xl hover:bg-white/30 transition-colors text-white"
          >
            <Download size={17} />
            <span className="text-[11px] font-semibold">내보내기</span>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="flex flex-col items-center gap-1.5 px-4 py-3 bg-white/15 rounded-xl hover:bg-red-500/60 transition-colors text-white"
          >
            <Trash2 size={17} />
            <span className="text-[11px] font-semibold">삭제</span>
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 bg-primary-900/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
          <span className="px-5 py-2.5 bg-white text-primary-600 font-bold text-[14px] rounded-full shadow">추가</span>
        </div>
      )}
    </div>
  );
}
