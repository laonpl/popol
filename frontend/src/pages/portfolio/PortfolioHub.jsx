import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, FileText, Trash2, Edit, Download, Search, Star, ExternalLink, ChevronDown, ArrowUpDown,
  Globe, Presentation, Link2, Loader2, X, Copy, Check, Wand2, Building2, LayoutGrid, FolderPlus, FolderX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import CompanyFolderPanel from '../../components/portfolio/CompanyFolderPanel';
import useAuthStore from '../../stores/authStore';
import useAuthGate from '../../hooks/useAuthGate';
import usePortfolioStore from '../../stores/portfolioStore';
import DetailModal from '../../components/DetailModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import PortfolioReadinessBoard from '../../components/PortfolioReadinessBoard';
import useExperienceStore from '../../stores/experienceStore';

/* ── 포트폴리오 종류 ──
   노션형·홈페이지는 공개 링크로, PPT는 파일 다운로드로 내보낸다. */
// folder: 폴더 뒷판·앞판·글자색, sheet: 파일 카드 윗부분 색
const KINDS = [
  {
    id: 'notion', label: '노션형', icon: FileText,
    tile: 'bg-slate-100 text-slate-600',
    hint: '공개 링크를 만들어 바로 공유할 수 있어요.',
    folder: { back: '#8EA6CF', front: 'linear-gradient(160deg, #C3D2EC 0%, #A3B8DE 100%)', ink: '#1E3A66' },
    sheet: '#EEF3FA',
  },
  {
    id: 'ppt', label: 'PPT', icon: Presentation,
    tile: 'bg-orange-50 text-orange-600',
    hint: '만든 슬라이드를 PPTX 파일로 바로 내려받을 수 있어요.',
    folder: { back: '#EBA066', front: 'linear-gradient(160deg, #FCD6B0 0%, #F4B67F 100%)', ink: '#7A3B0A' },
    sheet: '#FDF3EA',
  },
  {
    id: 'web', label: '홈페이지', icon: Globe,
    tile: 'bg-violet-50 text-violet-600',
    hint: '홈페이지를 발행하고 공개 링크로 공유할 수 있어요.',
    folder: { back: '#A48DD8', front: 'linear-gradient(160deg, #D6CCF3 0%, #BBA9EA 100%)', ink: '#3F2A78' },
    sheet: '#F4F0FC',
  },
];
const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]));

function kindOf(p) {
  if (String(p.templateType || '').startsWith('web-')) return 'web';
  if (p.outputType === 'ppt') return 'ppt';
  return 'notion';
}

// PPT 표식(outputType)이 생기기 전에 템플릿 선택 PPT 탭으로 만든 포트폴리오 — 자동으로 붙인 제목으로 알아본다.
const LEGACY_PPT_TITLES = new Map([
  ['스토리형 PPT', 'narrative'], ['KPI 대시보드 PPT', 'kpi-dashboard'], ['타임라인 PPT', 'timeline'],
  ['케이스 스터디 PPT', 'case-study'], ['제안서형 PPT', 'standard'], ['STAT/STAR형 PPT', 'star'],
  ['내 PPT 템플릿 업로드', null],
]);
function normalizePortfolio(p) {
  if (p.outputType || p.templateType !== 'notion' || !LEGACY_PPT_TITLES.has(p.title)) return p;
  return { ...p, outputType: 'ppt', pptLayoutId: LEGACY_PPT_TITLES.get(p.title) };
}

// 기업 폴더 색 — 기업명 해시로 고정 배정. 기업 미지정은 회색.
const COMPANY_FOLDER_COLORS = [
  { back: '#7FA7C9', front: 'linear-gradient(160deg, #C4DAEC 0%, #A1C0DD 100%)', ink: '#173E5E' },
  { back: '#79B79A', front: 'linear-gradient(160deg, #C3E6D4 0%, #9ED0B7 100%)', ink: '#14482F' },
  { back: '#D9A05B', front: 'linear-gradient(160deg, #F6D9B1 0%, #EDBF84 100%)', ink: '#6A3D08' },
  { back: '#C98AA6', front: 'linear-gradient(160deg, #EFCCDB 0%, #DFA9C1 100%)', ink: '#5E1D3A' },
  { back: '#9C90D0', front: 'linear-gradient(160deg, #D8D2F1 0%, #BBB1E6 100%)', ink: '#35297A' },
  { back: '#6FB1B5', front: 'linear-gradient(160deg, #C0E3E4 0%, #98CFD2 100%)', ink: '#0F4A4D' },
];
const UNASSIGNED_FOLDER_COLOR = { back: '#A7B0BC', front: 'linear-gradient(160deg, #DDE2E8 0%, #C6CDD6 100%)', ink: '#3A4553' };
function companyColor(name) {
  if (!name) return UNASSIGNED_FOLDER_COLOR;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return COMPANY_FOLDER_COLORS[hash % COMPANY_FOLDER_COLORS.length];
}

// 미리보기 화면이 있는 노션형 템플릿 — 그 외(예전 방식)는 상세 모달로 연다.
function hasNotionPreview(templateType) {
  return ['notion', 'ashley', 'academic', 'timeline'].includes(templateType)
    || String(templateType || '').startsWith('visual-');
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value) {
  const ms = toMillis(value);
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const publicUrlOf = (p) => `${window.location.origin}/p/${p.customSlug || p.id}`;

export default function PortfolioHub() {
  const { user } = useAuthStore();
  const { isGuest, requireAuth } = useAuthGate();
  const { portfolios, fetchPortfolios, deletePortfolio, updatePortfolio, loading, loadError } = usePortfolioStore();
  const { experiences, fetchExperiences } = useExperienceStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [detailData, setDetailData] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);       // 링크 내보내기 모달 대상
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [exportConfig, setExportConfig] = useState(location.state?.exportConfig || null);
  const [viewMode, setViewMode] = useState('company');          // company: 기업별 | kind: 형식별
  const [openCompany, setOpenCompany] = useState(undefined);    // undefined: 첫 폴더 자동 열림, null: 모두 접힘
  const [openKind, setOpenKind] = useState('notion');
  const [folders, setFolders] = useState([]);                   // 기업 폴더(이력서·자소서)
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState(null); // 삭제 확인 대기 중인 기업 폴더
  const [downloadingId, setDownloadingId] = useState(null);
  const sortDropRef = useRef(null);

  useEffect(() => {
    if (user?.uid) {
      fetchPortfolios(user.uid);
      fetchExperiences(user.uid);
      api.get('/company-folders').then(({ data }) => setFolders(Array.isArray(data) ? data : [])).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    const h = (e) => {
      if (sortDropRef.current && !sortDropRef.current.contains(e.target)) setSortDropOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // 비로그인은 목록을 렌더하지 않는다. 스토어는 그대로 두므로 로그인 사용자의 데이터에 영향이 없다.
  const visiblePortfolios = (isGuest ? [] : portfolios).map(normalizePortfolio);
  const visibleFolders = isGuest ? [] : folders;

  const q = searchQuery.trim().toLowerCase();
  const searched = visiblePortfolios.filter(p => !q || (
    p.title?.toLowerCase().includes(q) ||
    p.targetCompany?.toLowerCase().includes(q) ||
    p.targetPosition?.toLowerCase().includes(q)
  ));
  const byRecent = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);
  const sortCards = (list) => [...list].sort((a, b) => {
    if (sortMode === 'favorites' && !!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
    return byRecent(a, b);
  });

  // 형식별 폴더
  const byKind = KINDS.reduce((acc, k) => ({ ...acc, [k.id]: searched.filter(p => kindOf(p) === k.id).sort(byRecent) }), {});

  // 기업별 폴더 — 포트폴리오의 지원 기업 + 직접 만든 기업 폴더. 최근 활동순, '기업 미지정'은 맨 뒤.
  const companyMap = new Map();
  const ensureCompany = (name) => {
    if (!companyMap.has(name)) companyMap.set(name, { key: name, portfolios: [], folder: null });
    return companyMap.get(name);
  };
  searched.forEach(p => ensureCompany((p.targetCompany || '').trim()).portfolios.push(p));
  visibleFolders.forEach(f => {
    if (!q || f.company.toLowerCase().includes(q) || companyMap.has(f.company)) ensureCompany(f.company).folder = f;
  });
  const lastActivity = (g) => Math.max(0, ...g.portfolios.map(p => toMillis(p.createdAt)), toMillis(g.folder?.updatedAt));
  const companyGroups = [...companyMap.values()]
    .map(g => ({ ...g, portfolios: g.portfolios.sort(byRecent) }))
    .sort((a, b) => (a.key === '') - (b.key === '') || lastActivity(b) - lastActivity(a));

  const activeCompanyKey = openCompany === undefined ? companyGroups[0]?.key : openCompany;
  const activeCompany = companyGroups.find(g => g.key === activeCompanyKey) || null;
  const activeMeta = openKind ? KIND_BY_ID[openKind] : null;
  const toggleCompany = (key) => setOpenCompany(activeCompanyKey === key ? null : key);
  const toggleKind = (id) => setOpenKind(openKind === id ? null : id);

  const upsertFolder = (f) => setFolders(prev => [...prev.filter(x => x.id !== f.id), f]);
  const createCompanyFolder = async (name) => {
    const company = name.trim();
    if (!company) return;
    try {
      const { data } = await api.put('/company-folders', { company });
      upsertFolder(data);
      setSearchQuery('');
      setOpenCompany(company);
    } catch {
      toast.error('기업 폴더를 만들지 못했습니다');
    }
  };
  // 기업명 변경 — 포트폴리오의 지원 기업과 이력서·자소서 폴더를 서버에서 한 번에 옮긴다.
  const renameCompanyFolder = async (from, rawTo) => {
    const to = rawTo.trim();
    if (!to || to === from) return true;
    if (companyGroups.some(g => g.key === to)
      && !window.confirm(`"${to}" 폴더가 이미 있어요. 두 폴더를 합칠까요?`)) return false;
    try {
      const { data } = await api.post('/company-folders/rename', { from, to });
      setFolders(prev => {
        const rest = prev.filter(x => x.id !== data.fromId && x.id !== data.folder?.id);
        return data.folder ? [...rest, data.folder] : rest;
      });
      await fetchPortfolios(user.uid);
      setOpenCompany(to);
      toast.success('기업명을 바꿨습니다');
      return true;
    } catch {
      toast.error('기업명을 바꾸지 못했습니다');
      return false;
    }
  };

  // 기업 폴더 삭제 — 이력서·자소서는 지우고, 포트폴리오는 '기업 미지정'으로 옮긴다.
  const deleteCompanyFolder = async (company) => {
    try {
      const { data } = await api.post('/company-folders/delete', { company });
      setFolders(prev => prev.filter(x => x.id !== data.fromId));
      await fetchPortfolios(user.uid);
      setOpenCompany(null);
      toast.success('폴더를 삭제했습니다');
    } catch {
      toast.error('폴더를 삭제하지 못했습니다');
    }
  };

  // ── 행 동작 ──
  const openPortfolio = (p) => {
    if (exportConfig) return navigate(`/app/portfolio/edit-notion/${p.id}`, { state: { exportConfig } });
    const kind = kindOf(p);
    if (kind === 'web') return navigate(`/app/portfolio/web-edit/${p.id}`);
    if (kind === 'ppt') return navigate(pptPageUrl(p));
    if (hasNotionPreview(p.templateType)) return navigate(`/app/portfolio/preview/${p.id}`);
    setDetailData(p);
  };

  const editPortfolio = (p) => navigate(kindOf(p) === 'web' ? `/app/portfolio/web-edit/${p.id}` : `/app/portfolio/edit-notion/${p.id}`);

  // 저장된 슬라이드가 있으면 그 화면을, 없으면 고른 레이아웃·팔레트로 PPT 만들기 화면을 연다.
  const pptPageUrl = (p, { autostart = false } = {}) => {
    const base = `/app/portfolio/ai-ppt/${p.id}`;
    if (p.pptDeck?.slides?.length) return base;
    if (!p.pptLayoutId) return `${base}?upload=1`;
    return `${base}?layout=${p.pptLayoutId}&template=${p.pptPaletteId || 'beige-minimal'}${autostart ? '&autostart=true' : ''}`;
  };

  const downloadPpt = async (p) => {
    if (downloadingId) return;
    setDownloadingId(p.id);
    try {
      // PPT 생성 모듈은 크기가 커서 다운로드할 때만 불러온다.
      const { exportDeckToPptx, prepareDeckForExport, getComposedTemplate } = await import('./aiPptTemplates');
      const deck = prepareDeckForExport(p.pptDeck);
      const template = getComposedTemplate(p.pptLayoutId || 'standard', p.pptPaletteId || 'beige-minimal');
      const fileName = `${(p.title || p.userName || 'portfolio').replace(/\s+/g, '_')}.pptx`;
      await exportDeckToPptx(deck, template, fileName);
      toast.success('PPT 다운로드를 시작합니다');
    } catch (e) {
      toast.error(e?.message || 'PPT 다운로드에 실패했습니다');
    }
    setDownloadingId(null);
  };

  // 홈페이지는 발행(공개+잠금), 노션형은 공개 여부만 바꾼다 — 각 에디터의 기존 동작과 동일.
  const setPublic = async (p, next) => {
    const patch = kindOf(p) === 'web'
      ? { isPublic: next, webLocked: next, status: next ? 'exported' : 'draft' }
      : { isPublic: next };
    await updatePortfolio(p.id, patch);
    setShareTarget(prev => (prev && prev.id === p.id ? { ...prev, ...patch } : prev));
  };

  const renderCards = (list) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.map(p => (
        <PortfolioFileCard
          key={p.id}
          portfolio={p}
          kind={KIND_BY_ID[kindOf(p)]}
          exportMode={!!exportConfig}
          downloading={downloadingId === p.id}
          onOpen={() => openPortfolio(p)}
          onEdit={() => editPortfolio(p)}
          onShare={() => setShareTarget(p)}
          onDownload={() => downloadPpt(p)}
          onMakePpt={() => navigate(pptPageUrl(p, { autostart: true }))}
          onToggleFavorite={() => updatePortfolio(p.id, { isFavorite: !p.isFavorite })}
          onDelete={() => setPendingDelete(p)}
        />
      ))}
    </div>
  );

  return (
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
            className="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-bluewood-600 transition-colors hover:border-primary-200 hover:text-primary-600"
          >
            <Plus size={16} />
            빠르게 만들기
          </button>
          <button
            type="button"
            onClick={() => requireAuth(() => navigate('/app/portfolio/plan'))}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-[15px] font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            포트폴리오 플랜
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

      {!isGuest && (
        <div className="mb-6">
          <PortfolioReadinessBoard experiences={experiences} compact />
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

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : visiblePortfolios.length === 0 && visibleFolders.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={40} className="text-bluewood-200 mx-auto mb-3" />
          <h3 className="text-[18px] font-bold text-primary-600 mb-2">아직 포트폴리오가 없습니다</h3>
          <p className="text-bluewood-400 text-[14px] mb-6">경험을 먼저 정리한 후 포트폴리오를 작성해보세요</p>
          <button
            onClick={() => requireAuth(() => navigate('/app/portfolio/plan'))}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} /> 첫 포트폴리오 만들기
          </button>
        </div>
      ) : (
        <>
          {/* 보기 전환 + 검색·정렬 */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-1 p-1 bg-white border border-surface-200 rounded-xl">
              {[
                { id: 'company', label: '기업별', icon: Building2 },
                { id: 'kind', label: '형식별', icon: LayoutGrid },
              ].map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-semibold transition-colors ${
                    viewMode === v.id ? 'bg-primary-600 text-white' : 'text-bluewood-500 hover:bg-surface-50 hover:text-bluewood-700'
                  }`}
                >
                  <v.icon size={14} /> {v.label}
                </button>
              ))}
            </div>
            <p className="text-[13px] text-bluewood-400">
              {viewMode === 'company'
                ? '지원하는 기업마다 포트폴리오·이력서·자소서를 한 폴더에 모아요.'
                : '노션형·PPT·홈페이지 형식별로 모아 봐요.'}
            </p>

            <div className="flex items-center gap-2 ml-auto">
              <div className="relative w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-bluewood-300" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="제목·기업 검색"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-surface-200 rounded-lg text-[13px] text-bluewood-700 placeholder:text-bluewood-300 focus:outline-none focus:ring-2 focus:ring-bluewood-300 transition-all"
                />
              </div>
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
          </div>

          {viewMode === 'company' ? (
            <>
              {/* 기업 폴더 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {companyGroups.map(g => {
                  const files = g.folder?.files || [];
                  const essayCount = (g.folder?.essays || []).length + files.filter(f => f.category === 'coverLetter').length;
                  const resumeCount = files.filter(f => f.category === 'resume').length;
                  return (
                    <Folder
                      key={g.key || '__none'}
                      label={g.key || '기업 미지정'}
                      icon={g.key ? Building2 : FolderX}
                      colors={companyColor(g.key)}
                      count={g.portfolios.length + resumeCount + essayCount}
                      subtitle={g.key ? `포트폴리오 ${g.portfolios.length} · 이력서 ${resumeCount} · 자소서 ${essayCount}` : `포트폴리오 ${g.portfolios.length}`}
                      papers={[
                        ...g.portfolios.map(p => p.title || '제목 없음'),
                        ...files.map(f => f.name),
                        ...(g.folder?.essays || []).map(e => e.question || '자기소개서'),
                      ].slice(0, 3)}
                      active={activeCompanyKey === g.key}
                      onClick={() => toggleCompany(g.key)}
                    />
                  );
                })}
                <NewCompanyFolder onCreate={createCompanyFolder} existing={companyGroups.map(g => g.key)} />
              </div>

              {activeCompany ? (
                <div className="animate-fadeIn">
                  <OpenFolderHeader
                    icon={activeCompany.key ? Building2 : FolderX}
                    color={companyColor(activeCompany.key).ink}
                    title={activeCompany.key || '기업 미지정'}
                    subtitle={activeCompany.key ? '이 기업에 제출할 서류를 한곳에서 관리해요.' : '지원 기업이 정해지지 않은 포트폴리오예요.'}
                    onClose={() => setOpenCompany(null)}
                    onRename={activeCompany.key ? (to) => renameCompanyFolder(activeCompany.key, to) : null}
                    onDelete={activeCompany.key ? () => setPendingFolderDelete(activeCompany) : null}
                  />
                  {activeCompany.key ? (
                    <CompanyFolderPanel
                      company={activeCompany.key}
                      folder={activeCompany.folder}
                      portfolios={activeCompany.portfolios}
                      onSaved={upsertFolder}
                      onCreatePortfolio={() => navigate('/app/portfolio/new', { state: { targetCompany: activeCompany.key } })}
                    >
                      {renderCards(sortCards(activeCompany.portfolios))}
                    </CompanyFolderPanel>
                  ) : (
                    renderCards(sortCards(activeCompany.portfolios))
                  )}
                </div>
              ) : (
                <ClosedHint />
              )}
            </>
          ) : (
            <>
              {/* 형식 폴더 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                {KINDS.map(k => (
                  <Folder
                    key={k.id}
                    label={k.label}
                    icon={k.icon}
                    colors={k.folder}
                    count={byKind[k.id].length}
                    subtitle={k.hint}
                    papers={byKind[k.id].slice(0, 3).map(p => p.title || '제목 없음')}
                    active={openKind === k.id}
                    onClick={() => toggleKind(k.id)}
                  />
                ))}
              </div>

              {activeMeta ? (
                <div className="animate-fadeIn">
                  <OpenFolderHeader
                    icon={activeMeta.icon}
                    color={activeMeta.folder.ink}
                    title={`${activeMeta.label} ${byKind[openKind].length}`}
                    subtitle={activeMeta.hint}
                    onClose={() => setOpenKind(null)}
                  />
                  {byKind[openKind].length ? renderCards(sortCards(byKind[openKind])) : (
                    <div className="rounded-2xl border border-dashed border-surface-300 bg-white py-14 text-center">
                      <p className="text-bluewood-500 text-[14px] font-medium mb-4">
                        {q ? `'${searchQuery}'에 맞는 ${activeMeta.label} 포트폴리오가 없습니다` : `아직 ${activeMeta.label} 포트폴리오가 없어요`}
                      </p>
                      {!q && (
                        <button
                          onClick={() => requireAuth(() => navigate('/app/portfolio/new'))}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-[13px] font-semibold hover:bg-primary-700 transition-colors"
                        >
                          <Plus size={14} /> {activeMeta.label} 만들기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <ClosedHint />
              )}
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        tone="danger"
        title={`"${pendingDelete?.title || '제목 없음'}"을(를) 삭제할까요?`}
        message="포트폴리오에 담긴 내용과 설정이 모두 사라지고, 되돌릴 수 없어요. 공유한 링크도 열리지 않게 됩니다."
        confirmLabel="삭제"
        cancelLabel="그대로 두기"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => { deletePortfolio(pendingDelete.id); setPendingDelete(null); }}
      />

      <ConfirmDialog
        open={!!pendingFolderDelete}
        tone="danger"
        title={`"${pendingFolderDelete?.key}" 폴더를 삭제할까요?`}
        message={`폴더에 올린 이력서·자소서·기타 서류 목록과 작성한 자소서가 지워집니다. 포트폴리오 ${pendingFolderDelete?.portfolios.length || 0}개는 지워지지 않고 '기업 미지정'으로 옮겨집니다.`}
        confirmLabel="폴더 삭제"
        cancelLabel="그대로 두기"
        onCancel={() => setPendingFolderDelete(null)}
        onConfirm={() => { deleteCompanyFolder(pendingFolderDelete.key); setPendingFolderDelete(null); }}
      />

      {detailData && (
        <DetailModal type="portfolio" data={detailData} onClose={() => setDetailData(null)} />
      )}

      {shareTarget && (
        <LinkShareModal
          portfolio={shareTarget}
          isWeb={kindOf(shareTarget) === 'web'}
          onToggle={(next) => setPublic(shareTarget, next)}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

/* ── 폴더 ──
   뒷판 + 탭 + 삐져나온 종이(안에 든 문서 제목) + 앞판. 열린 폴더는 종이가 올라온 상태.
   다시 누르면 접힌다(부모에서 토글). */
function Folder({ label, icon: Icon, colors, count, subtitle, papers, active, onClick }) {
  const { back, front, ink } = colors;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      title={active ? '눌러서 접기' : '눌러서 열기'}
      className={`group relative block w-full pt-5 text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none ${active ? '' : 'opacity-90 hover:opacity-100'}`}
    >
      {/* 탭 */}
      <div className="absolute left-0 top-0 h-7 w-[42%] rounded-t-xl" style={{ background: back }} />
      {/* 뒷판 */}
      <div
        className={`relative h-44 rounded-2xl rounded-tl-none transition-shadow ${active ? 'shadow-lg' : 'shadow-sm group-hover:shadow-md'}`}
        style={{ background: back }}
      >
        {/* 종이들 */}
        {(papers.length ? papers : [null]).map((title, i) => (
          <div
            key={`${i}-${title}`}
            className={`absolute left-4 right-4 transform rounded-lg bg-white px-3 pt-2 shadow-sm transition-transform duration-300 ${
              active ? '-translate-y-3' : 'group-hover:-translate-y-2'
            }`}
            style={{ top: 12 + i * 11, height: 90, '--tw-rotate': `${[-1.5, 1, -0.5][i]}deg`, opacity: title ? 1 : 0.55, zIndex: i }}
          >
            {title ? (
              <>
                <p className="truncate text-[11.5px] font-semibold text-bluewood-700">{title}</p>
                <div className="mt-1.5 space-y-1">
                  <div className="h-1 w-4/5 rounded-full bg-surface-200" />
                  <div className="h-1 w-3/5 rounded-full bg-surface-200" />
                </div>
              </>
            ) : (
              <div className="mt-1 space-y-1.5">
                <div className="h-1.5 w-1/2 rounded-full bg-surface-200" />
                <div className="h-1 w-4/5 rounded-full bg-surface-100" />
              </div>
            )}
          </div>
        ))}

        {/* 앞판 */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex h-[62%] flex-col justify-end rounded-2xl px-4 pb-3.5"
          style={{ background: front, boxShadow: '0 -2px 10px rgba(0,0,0,0.06)', color: ink }}
        >
          <div className="flex items-end justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/55">
                <Icon size={16} />
              </span>
              <span className="truncate text-[16px] font-bold">{label}</span>
            </div>
            <span className="text-[24px] font-extrabold leading-none">{count}</span>
          </div>
          {subtitle && <p className="mt-1.5 truncate text-[11.5px] font-medium opacity-70">{subtitle}</p>}
        </div>
      </div>
      {/* 열림 표시 */}
      <div className={`mx-auto mt-2.5 h-1 rounded-full transition-all duration-300 ${active ? 'w-12' : 'w-0'}`} style={{ background: back }} />
    </button>
  );
}

/* ── 새 기업 폴더 — 누르면 기업명 입력칸으로 바뀐다 ── */
function NewCompanyFolder({ onCreate, existing }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existing.includes(trimmed)) { toast('이미 있는 기업 폴더예요'); return; }
    onCreate(trimmed);
    setName('');
    setEditing(false);
  };

  return (
    <div className="pt-5">
      <div className="flex h-44 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-300 bg-white/60 px-4 text-center">
        {editing ? (
          <form onSubmit={submit} className="w-full space-y-2">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setEditing(false)}
              placeholder="기업명 (예: 네이버)"
              maxLength={100}
              className="w-full rounded-lg border border-surface-200 px-3 py-2 text-[13.5px] focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-surface-200 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:bg-surface-50">취소</button>
              <button type="submit" className="flex-1 rounded-lg bg-primary-600 py-1.5 text-[12.5px] font-semibold text-white hover:bg-primary-700">만들기</button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="flex flex-col items-center gap-2 text-bluewood-400 hover:text-primary-600">
            <FolderPlus size={26} />
            <span className="text-[13.5px] font-semibold">새 기업 폴더</span>
            <span className="text-[12px] text-bluewood-300">이력서·자소서를 먼저 모아둘 수 있어요</span>
          </button>
        )}
      </div>
    </div>
  );
}

// onRename(새 이름) → 성공하면 true. onRename·onDelete가 없으면(기업 미지정·형식 폴더) 버튼을 숨긴다.
function OpenFolderHeader({ icon: Icon, color, title, subtitle, onClose, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);
  const [saving, setSaving] = useState(false);

  // 다른 폴더를 열면 편집 상태를 닫는다.
  useEffect(() => { setEditing(false); setName(title); }, [title]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await onRename(name);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {editing ? (
          <form onSubmit={submit} className="flex items-center gap-2">
            <Icon size={18} style={{ color }} className="flex-shrink-0" />
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setName(title); } }}
              maxLength={100}
              className="w-[240px] rounded-lg border border-primary-300 px-3 py-1.5 text-[16px] font-bold text-bluewood-800 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <button type="submit" disabled={saving || !name.trim()} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 저장
            </button>
            <button type="button" onClick={() => { setEditing(false); setName(title); }} className="rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-bluewood-400 hover:text-bluewood-600">
              취소
            </button>
          </form>
        ) : (
          <h2 className="flex items-center gap-2 text-[18px] font-bold text-bluewood-800">
            <Icon size={18} style={{ color }} /> {title}
            {onRename && (
              <button type="button" onClick={() => setEditing(true)} aria-label="기업명 수정" title="기업명 수정" className="flex h-7 w-7 items-center justify-center rounded-lg text-bluewood-300 hover:bg-surface-100 hover:text-bluewood-600">
                <Edit size={14} />
              </button>
            )}
          </h2>
        )}
        <p className="mt-0.5 text-[13px] text-bluewood-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {onDelete && (
          <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-400 hover:border-red-200 hover:text-red-500">
            <Trash2 size={13} /> 폴더 삭제
          </button>
        )}
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-500 hover:text-bluewood-700">
          <ChevronDown size={13} className="rotate-180" /> 접기
        </button>
      </div>
    </div>
  );
}

function ClosedHint() {
  return <p className="py-10 text-center text-[13.5px] text-bluewood-300">폴더를 누르면 안에 든 내용이 열려요.</p>;
}

/* ── 폴더 안 파일 카드 ──
   문서 모양 썸네일 · 제목/회사 · 대표 동작(링크 내보내기 또는 PPT 다운로드) · 편집/즐겨찾기/삭제 */
function PortfolioFileCard({ portfolio: p, kind, exportMode, downloading, onOpen, onEdit, onShare, onDownload, onMakePpt, onToggleFavorite, onDelete }) {
  const Icon = kind.icon;
  const company = p.targetCompany ? `${p.targetCompany}${p.targetPosition ? ` · ${p.targetPosition}` : ''}` : '지원 회사 미설정';
  const hasDeck = !!p.pptDeck?.slides?.length;
  const slideCount = p.pptDeck?.slides?.length || 0;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-lg text-bluewood-400 hover:bg-surface-100 hover:text-bluewood-700 transition-colors';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-surface-200 bg-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
    >
      {/* 문서 모양 썸네일 */}
      <div className="relative h-32 px-6 pt-5" style={{ background: kind.sheet }}>
        <div className="relative mx-auto h-full max-w-[210px] rounded-t-lg bg-white shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
          {/* 접힌 모서리 */}
          <div className="absolute right-0 top-0 h-5 w-5 rounded-bl-md" style={{ background: `linear-gradient(225deg, ${kind.sheet} 50%, #E5E9F0 50%)` }} />
          <div className="px-4 pt-4">
            <div className="flex items-center gap-1.5" style={{ color: kind.folder.ink }}>
              <Icon size={13} />
              <span className="text-[10.5px] font-bold tracking-wide">{kind.id === 'ppt' && slideCount ? `슬라이드 ${slideCount}장` : kind.label}</span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-1.5 w-4/5 rounded-full bg-surface-200" />
              <div className="h-1.5 w-3/5 rounded-full bg-surface-200" />
              <div className="h-1.5 w-2/3 rounded-full bg-surface-100" />
            </div>
          </div>
        </div>
        {p.isPublic && kind.id !== 'ppt' && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 공개 중
          </span>
        )}
        <button
          type="button"
          onClick={stop(onToggleFavorite)}
          aria-label="즐겨찾기"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 shadow-sm hover:bg-white"
        >
          <Star size={13} className={p.isFavorite ? 'fill-amber-300 text-amber-300' : 'text-bluewood-300'} />
        </button>
      </div>

      {/* 정보 */}
      <div className="flex flex-1 flex-col px-4 pt-3.5 pb-3">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-bluewood-800">{p.title || '제목 없음'}</p>
        <p className="mt-1 truncate text-[12.5px] text-bluewood-400">{company}</p>
        <p className="mt-0.5 text-[12px] text-bluewood-300">{formatDate(p.updatedAt || p.createdAt)}</p>

        {/* 동작 */}
        <div className="mt-3.5 flex items-center gap-1 border-t border-surface-100 pt-3">
          {exportMode ? (
            <button type="button" onClick={stop(onOpen)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700">
              <Plus size={14} /> 여기에 추가
            </button>
          ) : (
            <>
              {kind.id === 'ppt' ? (
                hasDeck ? (
                  <button type="button" onClick={stop(onDownload)} disabled={downloading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-600 py-2 text-[13px] font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                    {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    PPT 다운로드
                  </button>
                ) : (
                  <button type="button" onClick={stop(onMakePpt)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary-200 py-2 text-[13px] font-semibold text-primary-600 hover:bg-primary-50">
                    <Wand2 size={14} /> PPT 만들기
                  </button>
                )
              ) : (
                <button type="button" onClick={stop(onShare)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-600 py-2 text-[13px] font-semibold text-white hover:bg-primary-700">
                  <Link2 size={14} /> 링크 내보내기
                </button>
              )}
              <button type="button" onClick={stop(onEdit)} aria-label="내용 편집" title="내용 편집" className={iconBtn}>
                <Edit size={15} />
              </button>
              <button type="button" onClick={stop(onDelete)} aria-label="삭제" title="삭제" className={`${iconBtn} hover:!bg-red-50 hover:!text-red-500`}>
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 링크 내보내기 — 공개 켜기/끄기 + 링크 복사 ── */
function LinkShareModal({ portfolio, isWeb, onToggle, onClose }) {
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = publicUrlOf(portfolio);
  const isPublic = !!portfolio.isPublic;

  const toggle = async () => {
    setToggling(true);
    try {
      await onToggle(!isPublic);
      toast.success(isPublic ? '공개 링크를 껐습니다' : '공개 링크가 활성화되었습니다');
    } catch {
      toast.error('공개 설정을 바꾸지 못했습니다');
    }
    setToggling(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('링크가 복사되었습니다');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('복사하지 못했습니다. 링크를 직접 선택해 복사해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-surface-100">
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold text-bluewood-800">링크 내보내기</h2>
            <p className="text-[13px] text-bluewood-400 truncate mt-0.5">{portfolio.title || '제목 없음'}</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1.5 text-bluewood-300 hover:text-bluewood-600 rounded-lg hover:bg-surface-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 bg-surface-50 rounded-xl border border-surface-100">
            <div>
              <p className="text-[14px] font-semibold text-bluewood-800">공개 링크</p>
              <p className="text-[12.5px] text-bluewood-400 mt-0.5">
                {isWeb ? '켜면 홈페이지가 발행되고 편집이 잠깁니다' : '링크를 아는 누구나 볼 수 있어요'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              onClick={toggle}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${isPublic ? 'bg-primary-500' : 'bg-gray-300'} ${toggling ? 'opacity-50' : ''}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {isPublic ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2.5 bg-primary-50 rounded-lg border border-primary-100">
                <span className="block truncate text-[13px] text-primary-700 font-mono select-all">{url}</span>
              </div>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-primary-600 text-white rounded-lg text-[13px] font-semibold hover:bg-primary-700 transition-colors whitespace-nowrap"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? '복사됨' : '복사'}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="새 탭에서 열기"
                className="flex h-10 w-10 items-center justify-center border border-surface-200 text-bluewood-500 rounded-lg hover:bg-surface-50 transition-colors"
              >
                <ExternalLink size={15} />
              </a>
            </div>
          ) : (
            <p className="text-[13px] text-bluewood-400 text-center py-2">공개 링크를 켜면 여기에 주소가 나타납니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
