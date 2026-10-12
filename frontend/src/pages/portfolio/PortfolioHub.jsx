import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import BrandLoader from '../../components/BrandLoader';
import {
  Plus, FileText, Trash2, Edit, Download, Search, Star, ExternalLink, ArrowUpRight,
  Globe, Presentation, Link2, Loader2, X, Copy, Check, Wand2, Folder, FolderOpen, MoreHorizontal,
  ScrollText, PenLine, Paperclip, ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { db } from '../../config/firebase';
import CompanyFolderPanel from '../../components/portfolio/CompanyFolderPanel';
import FolderCatTransition from '../../components/portfolio/FolderCatTransition';
import useAuthStore from '../../stores/authStore';
import useAuthGate from '../../hooks/useAuthGate';
import useDocumentBoard from '../../hooks/useDocumentBoard';
import { applyDocumentBoard, documentMoveChanges } from '../../utils/documentBoard';
import usePortfolioStore from '../../stores/portfolioStore';
import DetailModal from '../../components/DetailModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import './portfolio-hub.css';
import './document-cabinet.css';

/* ── 포트폴리오 종류 ──
   노션형·홈페이지는 공개 링크로, PPT는 파일 다운로드로 내보낸다. */
const KINDS = [
  { id: 'notion', label: '노션형', icon: FileText },
  { id: 'ppt', label: 'PPT', icon: Presentation },
  { id: 'web', label: '홈페이지', icon: Globe },
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

// 미리보기 화면이 있는 노션형 템플릿 — 그 외(예전 방식)는 상세 모달로 연다.
function hasNotionPreview(templateType) {
  return ['notion', 'ashley', 'academic', 'timeline'].includes(templateType)
    || String(templateType || '').startsWith('visual-');
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
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

/* ── 서류 ──
   포트폴리오 · 이력서 · 자기소개서를 한 형태로 모은다. company: 지원 기업('' = 미지정)
   status: draft(작성 중) | done(완성) | public(공개 중) — 보드의 세 칸을 정한다. */
const DOC_TYPES = [
  { key: 'all', label: '전체' },
  { key: 'portfolio', label: '포트폴리오' },
  { key: 'resume', label: '이력서' },
  { key: 'cover', label: '자기소개서' },
  { key: 'etc', label: '기타 서류' },
];

const COLUMNS = [
  { key: 'draft', title: '작성 중', description: '이어서 작성할 서류' },
  { key: 'done', title: '완성', description: '제출하기 전 최종 확인' },
  { key: 'public', title: '제출 · 공개', description: '제출했거나 공유한 서류' },
];

function portfolioDoc(p) {
  const kind = kindOf(p);
  const hasDeck = !!p.pptDeck?.slides?.length;
  const status = kind === 'ppt' ? (hasDeck ? 'done' : 'draft') : (p.isPublic ? 'public' : 'draft');
  const at = toMillis(p.updatedAt || p.createdAt);
  return {
    key: p.id, boardKey: `portfolio:${p.id}`, docType: 'portfolio', title: p.title || '제목 없음', company: (p.targetCompany || '').trim(),
    icon: KIND_BY_ID[kind].icon, label: kind === 'ppt' && hasDeck ? `PPT · ${p.pptDeck.slides.length}장` : KIND_BY_ID[kind].label,
    meta: at ? `${formatDate(at)} 수정` : '', updatedAt: at, status, favorite: !!p.isFavorite, portfolio: p,
  };
}

// 답변이 있고 글자 수 제한을 넘지 않으면 완성한 문항
const essayDone = (e) => !!(e.answer || '').trim() && !(e.limit > 0 && e.answer.length > e.limit);

function folderDocs(f) {
  const folderAt = toMillis(f.updatedAt);
  const fileDoc = (file, docType) => {
    const at = toMillis(file.uploadedAt) || folderAt;
    return {
      key: `${f.id}-${file.id}`, boardKey: `file:${file.id}`, docType, title: file.name, company: f.company, icon: Paperclip,
      label: docType === 'resume' ? '이력서 파일' : docType === 'cover' ? '자소서 파일' : '첨부 파일', meta: at ? `${formatDate(at)} 올림` : '',
      updatedAt: at, status: 'done', file,
    };
  };
  const files = f.files || [];
  const essays = f.essays || [];
  const done = essays.filter(essayDone).length;
  return [
    ...files.filter(x => x.category === 'resume').map(x => fileDoc(x, 'resume')),
    ...files.filter(x => x.category === 'coverLetter').map(x => fileDoc(x, 'cover')),
    ...files.filter(x => x.category === 'etc').map(x => fileDoc(x, 'etc')),
    ...(essays.length ? [{
      key: `${f.id}-essays`, boardKey: `essays:${f.boardId || f.id}`, docType: 'cover', title: `${f.company} 자기소개서`, company: f.company, icon: PenLine,
      label: '자기소개서', meta: `${essays.length}문항 중 ${done}문항 작성`, updatedAt: folderAt,
      status: done === essays.length ? 'done' : 'draft', essays: true,
    }] : []),
  ];
}

// 기본 이력서 — 경험 정리 > 이력서 탭에서 만드는 사용자당 1개 이력서(profiles.careerProfile)
function baseResumeDoc(profile) {
  return {
    key: 'base-resume', boardKey: 'base-resume', docType: 'resume', title: '기본 이력서', company: '', icon: ScrollText, label: '이력서',
    meta: profile ? '경험 정리 › 이력서 탭' : '아직 만들지 않았어요', updatedAt: toMillis(profile?.updatedAt),
    status: profile ? 'done' : 'draft', base: true,
  };
}

const byFavoriteThenRecent = (a, b) => (b.favorite === true) - (a.favorite === true) || b.updatedAt - a.updatedAt;

export default function PortfolioHub() {
  const { user } = useAuthStore();
  const { isGuest, requireAuth } = useAuthGate();
  const board = useDocumentBoard(user?.uid);
  const { portfolios, fetchPortfolios, deletePortfolio, updatePortfolio, loading, loadError } = usePortfolioStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [detailData, setDetailData] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);       // 링크 내보내기 모달 대상
  const [searchQuery, setSearchQuery] = useState('');
  const [docType, setDocType] = useState('all');
  const [exportConfig, setExportConfig] = useState(location.state?.exportConfig || null);
  // 열린 폴더 id — null이면 첫 기업 폴더 (이력서 저장함에서 오면 그 기업 폴더)
  const [selected, setSelected] = useState(location.state?.openCompany ? `c:${location.state.openCompany}` : null);
  const [folders, setFolders] = useState([]);                   // 기업 폴더(이력서·자소서)
  const [baseResume, setBaseResume] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState(null); // 삭제 확인 대기 중인 기업 폴더
  const [downloadingId, setDownloadingId] = useState(null);
  const [stage, setStage] = useState('all');
  const [sort, setSort] = useState('manual');
  const [managing, setManaging] = useState(false);
  const folderEditorRef = useRef(null);
  const cabinetRef = useRef(null);
  const folderSwitchRef = useRef(0);
  const [cabinetWidth, setCabinetWidth] = useState(1180);
  const [switchingTo, setSwitchingTo] = useState(null);
  const [folderMotion, setFolderMotion] = useState(null);
  const [cabinetHeight, setCabinetHeight] = useState(480);
  const frozenScroll = useRef([]);

  useEffect(() => {
    if (user?.uid) {
      fetchPortfolios(user.uid);
      api.get('/company-folders').then(({ data }) => setFolders(Array.isArray(data) ? data : [])).catch(() => {});
      getDoc(doc(db, 'profiles', user.uid))
        .then(snap => setBaseResume(snap.exists() ? (snap.data().careerProfile || null) : null))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // 비로그인은 목록을 렌더하지 않는다. 스토어는 그대로 두므로 로그인 사용자의 데이터에 영향이 없다.
  const visiblePortfolios = (isGuest ? [] : portfolios).map(normalizePortfolio);
  const visibleFolders = isGuest ? [] : folders;
  const docs = applyDocumentBoard([...visiblePortfolios.map(portfolioDoc), ...visibleFolders.flatMap(folderDocs)].sort(byFavoriteThenRecent), board.entries);

  // 저장할 때 폴더 위치가 바뀌지 않도록 기업명순을 유지한다.
  const companyNames = [...new Set([...visibleFolders.map(f => f.company), ...docs.map(d => d.company)].filter(Boolean))];
  const companyFolders = companyNames.map(name => {
    const folder = visibleFolders.find(f => f.company === name) || null;
    const list = docs.filter(d => d.company === name);
    return { id: `c:${name}`, name, company: name, folder, docs: list, at: Math.max(toMillis(folder?.updatedAt), ...list.map(d => d.updatedAt)) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const allFolders = [
    ...(isGuest ? [] : [{ id: 'base', name: '기본 서류', docs: applyDocumentBoard([baseResumeDoc(baseResume)], board.entries) }]),
    ...companyFolders,
    { id: 'none', name: '기업 미지정', docs: docs.filter(d => !d.company) },
  ];
  const q = searchQuery.trim().toLowerCase();
  const matches = (text) => !q || (text || '').toLowerCase().includes(q);
  const cabinet = allFolders.filter(f => matches(f.name) || f.docs.some(d => matches(d.title)));
  const current = cabinet.find(f => f.id === selected) || cabinet[0] || null;
  const activeIndex = cabinet.indexOf(current);
  const compactCabinet = window.matchMedia('(max-width: 760px)').matches;
  const panelWidth = compactCabinet ? Math.max(200, cabinetWidth - 50) : Math.max(640, cabinetWidth - cabinet.length * 56);
  const visibleDocs = (current?.docs || [])
    .filter(d => (docType === 'all' || d.docType === docType) && (matches(current.name) || matches(d.title)))
    .sort(sort === 'name' ? (a, b) => a.title.localeCompare(b.title, 'ko') : sort === 'recent' ? byFavoriteThenRecent : (a, b) => a.order - b.order || byFavoriteThenRecent(a, b));

  useEffect(() => {
    setStage('all');
    setManaging(false);
    // Search, renaming and deletion can change the active folder without a handoff.
    setFolderMotion(motion => motion?.folderId === current?.id ? motion : null);
  }, [current?.id]);

  useEffect(() => () => { folderSwitchRef.current += 1; }, []);

  useEffect(() => {
    const container = cabinetRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(([entry]) => setCabinetWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, [loading, !!current]);

  useEffect(() => {
    const container = cabinetRef.current;
    const main = container?.closest('main');
    if (!container || !main) return undefined;
    const measure = () => {
      const mainTop = main.getBoundingClientRect().top;
      const cabinetTop = container.getBoundingClientRect().top - mainTop + main.scrollTop;
      const hub = container.closest('.ws');
      const footer = hub?.querySelector('.ws-cabinet-footer');
      const number = value => parseFloat(value) || 0;
      const footerSpace = footer ? footer.getBoundingClientRect().height + number(getComputedStyle(footer).marginTop) : 0;
      const bottomSpace = footerSpace + number(getComputedStyle(hub).paddingBottom)
        + number(getComputedStyle(hub.parentElement).paddingBottom) + 8;
      // Use the available workspace directly, including the footer and page
      // gutters. Narrow screens retain enough room for a complete document card.
      const available = main.clientHeight - cabinetTop - bottomSpace;
      setCabinetHeight(Math.max(compactCabinet ? 520 : 420, Math.min(680, available)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    container.closest('.ws')?.querySelectorAll('.ws-header, .ws-toolbar, .ws-section-label').forEach(element => observer.observe(element));
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [loading, !!current, compactCabinet, exportConfig, isGuest]);

  const restoreDragScrolling = () => {
    frozenScroll.current.forEach(({ element, overflow }) => { element.style.overflow = overflow; });
    frozenScroll.current = [];
  };
  useEffect(() => () => restoreDragScrolling(), []);

  const captureDragScrolling = () => {
    setFolderMotion(null);
    restoreDragScrolling();
    const container = cabinetRef.current;
    [container, container?.closest('main'), container?.querySelector('.ws-board')].filter(Boolean).forEach(element => {
      frozenScroll.current.push({ element, overflow: element.style.overflow });
      element.style.overflow = 'hidden';
    });
  };

  const moveDocument = async (document, destination, index) => {
    if (!board.ready || isGuest || exportConfig) return;
    if (document.status === destination && index === undefined) return;
    const target = sort === 'manual' ? visibleDocs : [...visibleDocs].sort((a, b) => a.order - b.order);
    const changes = documentMoveChanges(document, destination, index, target, current?.docs || target);
    if (!changes.length) return;
    const changedKeys = new Set(changes.map(change => change.key));
    // Freeze the inferred initial order once the user starts arranging a folder.
    // Later edits, favourites and new documents cannot reshuffle existing cards.
    const initialPositions = (current?.docs || [])
      .filter(item => !changedKeys.has(item.boardKey) && !board.entries[item.boardKey])
      .map(item => ({ key: item.boardKey, status: item.status, order: item.order }));
    const success = await board.update([...initialPositions, ...changes]);
    if (!success) toast.error('서류 이동을 저장하지 못했어요. 다시 시도해 주세요.');
  };

  useEffect(() => {
    const container = cabinetRef.current;
    if (!container) return undefined;
    // Wait for the accordion width to settle; only scroll its own horizontal viewport.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      const spine = container.querySelector('.ws-folder-slot.is-open');
      if (!spine) return;
      const left = spine.offsetLeft;
      const right = left + spine.offsetWidth;
      if (left < container.scrollLeft || right > container.scrollLeft + container.clientWidth + 1) {
        container.scrollTo({ left: Math.max(0, left - (compactCabinet ? 0 : 12)), behavior: reduced ? 'instant' : 'smooth' });
      }
    }, reduced ? 0 : 280);
    return () => clearTimeout(timer);
  }, [current?.id, cabinetWidth, cabinet.length, compactCabinet]);

  const selectFolder = async (id) => {
    const request = ++folderSwitchRef.current;
    if (id === current?.id) { setSwitchingTo(null); return; }
    setSwitchingTo(id);
    const saved = await folderEditorRef.current?.flush();
    if (request !== folderSwitchRef.current) return;
    setSwitchingTo(null);
    if (saved === false) { setManaging(true); return; }
    setSelected(id);
    setFolderMotion({ request, folderId: id, direction: cabinet.findIndex(folder => folder.id === id) < activeIndex ? -1 : 1 });
    setDocType('all');
    setStage('all');
  };

  const onFolderKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? cabinet.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + cabinet.length) % cabinet.length;
    cabinetRef.current?.querySelectorAll('.ws-folder-item')[next]?.focus({ preventScroll: true });
    selectFolder(cabinet[next].id);
  };

  const upsertFolder = (f) => setFolders(prev => [...prev.filter(x => x.id !== f.id), f]);
  const createCompanyFolder = async (name) => {
    const company = name.trim();
    if (!company) return false;
    if (companyNames.includes(company)) { toast('이미 있는 기업 폴더예요'); return false; }
    try {
      const { data } = await api.put('/company-folders', { company });
      upsertFolder(data);
      setSearchQuery('');
      setSelected(`c:${company}`);
      return true;
    } catch {
      toast.error('기업 폴더를 만들지 못했습니다');
      return false;
    }
  };
  // 기업명 변경 — 포트폴리오의 지원 기업과 이력서·자소서 폴더를 서버에서 한 번에 옮긴다.
  const renameCompanyFolder = async (from, rawTo) => {
    const to = rawTo.trim();
    if (!to || to === from) return true;
    if (await folderEditorRef.current?.flush() === false) return false;
    if (companyNames.includes(to)
      && !window.confirm(`"${to}" 폴더가 이미 있어요. 두 폴더를 합칠까요?`)) return false;
    try {
      const { data } = await api.post('/company-folders/rename', { from, to });
      setFolders(prev => {
        const rest = prev.filter(x => x.id !== data.fromId && x.id !== data.folder?.id);
        return data.folder ? [...rest, data.folder] : rest;
      });
      await fetchPortfolios(user.uid);
      if (current?.company === from) setSelected(`c:${to}`); // 열려 있던 폴더면 새 이름으로 계속 열어 둔다
      toast.success('기업명을 바꿨습니다');
      return true;
    } catch {
      toast.error('기업명을 바꾸지 못했습니다');
      return false;
    }
  };

  // 기업 폴더 삭제 — 이력서·자소서는 지우고, 포트폴리오는 '기업 미지정'으로 옮긴다.
  const deleteCompanyFolder = async (company) => {
    if (await folderEditorRef.current?.flush() === false) return;
    try {
      const { data } = await api.post('/company-folders/delete', { company });
      setFolders(prev => prev.filter(x => x.id !== data.fromId));
      await fetchPortfolios(user.uid);
      if (current?.company === company) setSelected(null);
      toast.success('폴더를 삭제했습니다');
    } catch {
      toast.error('폴더를 삭제하지 못했습니다');
    }
  };

  // ── 서류 동작 ──
  const openPortfolio = (p) => {
    if (exportConfig) return navigate(`/app/portfolio/edit-notion/${p.id}`, { state: { exportConfig } });
    const kind = kindOf(p);
    if (kind === 'web') return navigate(`/app/portfolio/web-edit/${p.id}`);
    if (kind === 'ppt') return navigate(pptPageUrl(p));
    if (hasNotionPreview(p.templateType)) return navigate(`/app/portfolio/preview/${p.id}`);
    setDetailData(p);
  };

  const openDoc = (d) => {
    if (d.portfolio) return openPortfolio(d.portfolio);
    if (d.file) return window.open(d.file.url, '_blank', 'noopener,noreferrer');
    if (d.base) return navigate('/app/experience?view=resume');
    // 자소서 문항은 보드 아래 편집 영역에서 쓴다.
    setManaging(true);
    requestAnimationFrame(() => {
      document.getElementById('company-essays')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
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

  // 카드 ⋯ 메뉴 — 경험 내보내기 중에는 카드를 눌러 추가만 한다.
  const actionsOf = (d) => {
    const p = d.portfolio;
    if (!p || exportConfig) return null;
    const isPpt = kindOf(p) === 'ppt';
    return [
      isPpt
        ? (p.pptDeck?.slides?.length
          ? { label: downloadingId === p.id ? 'PPT 내려받는 중…' : 'PPT 다운로드', icon: Download, run: () => downloadPpt(p) }
          : { label: 'PPT 만들기', icon: Wand2, run: () => navigate(pptPageUrl(p, { autostart: true })) })
        : { label: '링크 내보내기', icon: Link2, run: () => setShareTarget(p) },
      { label: '내용 편집', icon: Edit, run: () => editPortfolio(p) },
      { label: p.isFavorite ? '즐겨찾기 해제' : '즐겨찾기', icon: Star, run: () => updatePortfolio(p.id, { isFavorite: !p.isFavorite }) },
      { label: '삭제', icon: Trash2, danger: true, run: () => setPendingDelete(p) },
    ];
  };

  const createPortfolio = (company) => requireAuth(() => navigate('/app/portfolio/new', company ? { state: { targetCompany: company } } : undefined));

  const folderButton = (folder, index) => {
    const active = folder.id === current?.id;
    const Icon = active ? FolderOpen : Folder;
    return (
      <button type="button" className={`ws-folder-item ${active ? 'is-open' : ''}`} aria-expanded={active} aria-label={`${folder.name}, 서류 ${folder.docs.length}개`} aria-controls={active ? 'cabinet-documents' : undefined} onClick={() => selectFolder(folder.id)} onKeyDown={event => onFolderKeyDown(event, index)} title={folder.name}>
        <span className="ws-spine-number">{String(index + 1).padStart(2, '0')}</span>
        {switchingTo === folder.id ? <Loader2 size={19} className="animate-spin" /> : <Icon size={19} strokeWidth={1.5} />}
        <span className="ws-folder-name">{folder.name}</span>
        <span className="ws-folder-count">{folder.docs.length}</span>
      </button>
    );
  };

  const count = (type) => current.docs.filter(d => d.docType === type).length;
  const missing = current?.company
    ? [['portfolio', '포트폴리오'], ['resume', '이력서'], ['cover', '자소서']].filter(([type]) => !count(type)).map(([, label]) => label)
    : [];

  return (
    <div className="ws fp-portfolio-hub">
      <header className="ws-header">
        <div>
          <h1>서류 보관함</h1>
          <p>지원할 기업을 고르고, 필요한 서류를 꺼내 보세요.</p>
        </div>
        <div className="ws-header-actions">
          <button type="button" className="ws-btn" onClick={() => createPortfolio()}>
            <Plus size={17} /> 빠르게 만들기
          </button>
          <button type="button" className="ws-btn ws-btn--primary" onClick={() => requireAuth(() => navigate('/app/portfolio/plan'))}>
            <Plus size={17} /> 포트폴리오 만들기
          </button>
        </div>
      </header>

      {/* 비로그인 안내 — 화면은 보되 저장·생성은 로그인 후 */}
      {isGuest && (
        <div className="fp-guest-card mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50 px-5 py-4">
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

      <div className="ws-toolbar">
        <div className="ws-tabs" role="group" aria-label="서류 종류">
          {DOC_TYPES.map(t => <button key={t.key} type="button" aria-pressed={docType === t.key} onClick={() => { setDocType(t.key); setStage('all'); }}>{t.label}</button>)}
        </div>
        <div className="ws-filter-tools">
          <label className="ws-search">
            <Search size={17} />
            <input type="search" aria-label="기업 또는 서류 검색" placeholder="기업·서류 검색" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setStage('all'); }} />
            {searchQuery && <button type="button" aria-label="검색 지우기" onClick={() => setSearchQuery('')}><X size={15} /></button>}
          </label>
        </div>
      </div>

      <div className="ws-section-label">
        <span>내 폴더 <b>{allFolders.length}</b></span>
        {folderMotion?.folderId === current?.id && (
          <span className="ws-folder-mascot" aria-hidden="true" data-folder-id={folderMotion.folderId}>
            <FolderCatTransition
              key={folderMotion.request}
              direction={folderMotion.direction}
              onComplete={() => setFolderMotion(motion => motion?.request === folderMotion.request ? null : motion)}
            />
          </span>
        )}
        <div className="ws-section-actions">
          {current && <div className="ws-folder-pagination"><span>{String(activeIndex + 1).padStart(2, '0')} <i>/ {String(cabinet.length).padStart(2, '0')}</i></span>
            <button type="button" aria-label="이전 폴더" disabled={activeIndex <= 0} onClick={() => selectFolder(cabinet[activeIndex - 1].id)}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="다음 폴더" disabled={activeIndex >= cabinet.length - 1} onClick={() => selectFolder(cabinet[activeIndex + 1].id)}><ChevronRight size={16} /></button>
          </div>}
          {!isGuest && <NewCompanyFolder onCreate={createCompanyFolder} />}
        </div>
      </div>

      {loading ? (
        <BrandLoader label="포트폴리오를 불러오는 중" />
      ) : current ? (
        <div ref={cabinetRef} className="ws-cabinet" style={{ '--panel-width': `${panelWidth}px`, '--cabinet-height': `${cabinetHeight}px` }} role="group" aria-label="가로 폴더 보관함">
          <div className="ws-cabinet-track">
          {cabinet.map((folder, index) => (
            <div key={folder.id} className={`ws-folder-slot ${folder.id === current.id ? 'is-open' : ''}`}>
              {folderButton(folder, index)}
              <div className="ws-folder-body">
              {folder.id === current.id && (
                <section className="ws-open-folder" id="cabinet-documents" aria-label={`${current.name} 폴더`}>
                  {current.company ? (
                    <>
                      <FolderHeading
                        key={current.company}
                        title={current.company}
                        description="이 기업에 제출할 서류를 한곳에서 관리해요."
                        onRename={(to) => renameCompanyFolder(current.company, to)}
                        onDelete={() => setPendingFolderDelete(current)}
                      />
                      <div className="ws-folder-meta">
                        <span>포트폴리오 {count('portfolio')} · 이력서 {count('resume')} · 자소서 {count('cover')}</span>
                        <span>{missing.length ? `${missing.join(' · ')} 추가해 보세요` : '모든 종류의 서류를 모았어요'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                    <FolderHeading
                      title={current.name}
                      description={current.id === 'base' ? '모든 지원에 기본으로 쓰는 서류예요. 경험 정리의 이력서 탭에서 고칠 수 있어요.' : '지원 기업을 정하기 전의 서류예요.'}
                    />
                    <div className="ws-folder-meta"><span>포트폴리오 {count('portfolio')} · 이력서 {count('resume')} · 자소서 {count('cover')}</span><span>{current.id === 'base' ? '지원할 때 공통으로 쓰는 서류' : '기업을 정하면 폴더로 모을 수 있어요'}</span></div>
                    </>
                  )}
                  <StatusBoard
                    documents={visibleDocs}
                    stage={stage}
                    onStageChange={setStage}
                    sort={sort}
                    onSortChange={setSort}
                    onOpen={openDoc}
                    actionsOf={actionsOf}
                    onAdd={current.id === 'base' || !['all', 'portfolio'].includes(docType) ? null : () => createPortfolio(current.company)}
                    filtered={!!q || docType !== 'all'}
                    onReset={() => { setSearchQuery(''); setDocType('all'); setStage('all'); }}
                    canMove={board.ready && !isGuest && !exportConfig}
                    onMove={moveDocument}
                    onBeforeCapture={captureDragScrolling}
                    onDragFinished={restoreDragScrolling}
                    saving={board.saving}
                    error={board.error}
                    onRetry={board.reload}
                    boardReady={board.ready}
                  />
                  {current.company && (
                    <div className="ws-folder-panel" key={current.company}>
                      <button type="button" className="ws-manage-toggle" aria-expanded={managing} aria-controls="folder-management" onClick={() => setManaging(!managing)}>
                        <span className="ws-manage-icon"><SlidersHorizontal size={18} /></span>
                        <span><strong>서류 추가 · 자기소개서 작성</strong><small>파일을 올리거나, 자소서 문항을 직접 작성하세요.</small></span>
                        <ChevronDown size={18} className={managing ? 'is-open' : ''} />
                      </button>
                    </div>
                  )}
                </section>
              )}
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : (
        <div className="ws-empty">
          <Search size={28} strokeWidth={1.4} />
          <p>검색에 맞는 폴더가 없어요.</p>
          <span>기업명이나 서류 제목으로 다시 찾아보세요.</span>
          <button type="button" className="ws-btn" onClick={() => setSearchQuery('')}>검색 지우기</button>
        </div>
      )}

      {current && <div className="ws-cabinet-footer"><p>폴더를 눌러 펼치고, 서류를 끌어 상태와 순서를 정리하세요.</p></div>}
      {current?.company && <div id="folder-management" hidden={!managing} className="ws-management-drawer" key={current.company}>
        <div className="ws-management-heading"><strong>{current.company} · 서류 관리</strong><button type="button" className="ws-btn ws-btn--sm" onClick={() => setManaging(false)}><X size={14} /> 접기</button></div>
        <CompanyFolderPanel
          ref={folderEditorRef}
          company={current.company}
          folder={current.folder}
          portfolios={current.docs.filter(d => d.portfolio).map(d => d.portfolio)}
          onSaved={upsertFolder}
        />
      </div>}

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
        title={`"${pendingFolderDelete?.company}" 폴더를 삭제할까요?`}
        message={`폴더에 올린 이력서·자소서·기타 서류 목록과 작성한 자소서가 지워집니다. 포트폴리오 ${pendingFolderDelete?.docs.filter(d => d.portfolio).length || 0}개는 지워지지 않고 '기업 미지정'으로 옮겨집니다.`}
        confirmLabel="폴더 삭제"
        cancelLabel="그대로 두기"
        onCancel={() => setPendingFolderDelete(null)}
        onConfirm={() => { deleteCompanyFolder(pendingFolderDelete.company); setPendingFolderDelete(null); }}
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

/* ── 기업 추가 — 누르면 기업명 입력칸으로 바뀐다. onCreate(이름) → 성공하면 true ── */
function NewCompanyFolder({ onCreate }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const close = () => { setEditing(false); setName(''); };
  const submit = async (e) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    const ok = await onCreate(name);
    setSaving(false);
    if (ok) close();
  };

  if (!editing) {
    return <button type="button" className="ws-add-folder" onClick={() => setEditing(true)}><Plus size={16} /> 새 기업 폴더</button>;
  }
  return (
    <form className="ws-inline-form ws-new-folder" onSubmit={submit}>
      <input
        autoFocus
        disabled={saving}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') close(); }}
        placeholder="기업명 (예: 네이버)"
        aria-label="기업명"
        maxLength={100}
      />
      <button type="button" onClick={close} disabled={saving}>취소</button>
      <button type="submit" className="ws-btn ws-btn--primary ws-btn--sm" disabled={saving || !name.trim()}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 만들기
      </button>
    </form>
  );
}

/* ── 열린 폴더 머리 — onRename(새 이름) → 성공하면 true. onRename·onDelete가 없으면(기본 서류·기업 미지정) 버튼을 숨긴다 ── */
function FolderHeading({ title, description, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    setSaving(true);
    const ok = await onRename(name);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <header className="ws-folder-heading">
      <div className="min-w-0">
        {editing ? (
          <form onSubmit={submit} className="ws-inline-form ws-rename-form">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setName(title); } }}
              aria-label="기업명"
              maxLength={100}
            />
            <button type="button" onClick={() => { setEditing(false); setName(title); }}>취소</button>
            <button type="submit" className="ws-btn ws-btn--primary ws-btn--sm" disabled={saving || !name.trim()}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} 저장
            </button>
          </form>
        ) : (
          <h2 title={title}>{title}</h2>
        )}
        <p>{description}</p>
      </div>
      {(onRename || onDelete) && !editing && (
        <div className="ws-folder-tools">
          {onRename && <button type="button" aria-label="폴더 이름 수정" onClick={() => setEditing(true)}><Edit size={15} /><span>이름 수정</span></button>}
          {onDelete && <button type="button" aria-label="폴더 삭제" className="is-danger" onClick={onDelete}><Trash2 size={15} /><span>폴더 삭제</span></button>}
        </div>
      )}
    </header>
  );
}

/* ── 상태 보드 — 작성 중 · 완성 · 제출·공개. 좁은 화면에서는 한 칸씩 골라 본다 ── */
function StatusBoard({ documents, stage, onStageChange, sort, onSortChange, onOpen, actionsOf, onAdd, filtered, onReset, canMove, onMove, onBeforeCapture, onDragFinished, saving, error, onRetry, boardReady }) {
  const columns = COLUMNS.filter(column => stage === 'all' || column.key === stage);
  const finishDrag = (result, { announce }) => {
    onDragFinished();
    if (!result.destination) { announce('서류 이동을 취소했습니다.'); return; }
    const document = documents.find(d => d.boardKey === result.draggableId);
    const target = result.destination.droppableId;
    if (!document || (result.source.droppableId === target && result.source.index === result.destination.index)) return;
    if (sort !== 'manual' && result.source.droppableId === target) { announce('직접 정렬을 선택하면 순서를 바꿀 수 있습니다.'); return; }
    onMove(document, target, sort === 'manual' ? result.destination.index : undefined);
    announce(`${document.title}을 ${COLUMNS.find(c => c.key === target)?.title} 칸으로 옮겼습니다.`);
  };
  return (
    <div className="ws-status-board">
      <div className="ws-board-toolbar">
      <div className="ws-document-controls">
        <div className="ws-stages" role="group" aria-label="진행 단계">
          {[{ key: 'all', title: '전체 상태' }, ...COLUMNS].map(column => (
            <button key={column.key} type="button" className={`ws-stage--${column.key}`} aria-pressed={stage === column.key} onClick={() => onStageChange(column.key)}>
              {column.key !== 'all' && <i />}{column.title}<span>{column.key === 'all' ? documents.length : documents.filter(d => d.status === column.key).length}</span>
            </button>
          ))}
        </div>
        <select className="ws-sort" aria-label="서류 정렬" value={sort} onChange={e => onSortChange(e.target.value)}>
          <option value="manual">직접 정렬</option><option value="recent">즐겨찾기 · 최신순</option><option value="name">이름순</option>
        </select>
      </div>
      <div className="ws-board-help"><span>{sort === 'manual' ? '끌어서 상태와 순서를 바꿀 수 있어요' : '끌거나 카드 아래에서 상태를 바꿀 수 있어요'}</span><span role="status" className={error ? 'is-error' : ''}>{saving ? <><Loader2 size={12} className="animate-spin" /> 저장 중</> : error ? <>{error}{!boardReady && <button type="button" onClick={onRetry}>다시 시도</button>}</> : boardReady ? '자동 저장' : '불러오는 중…'}</span></div>
      </div>
      {filtered && !documents.length ? (
        <div className="ws-empty ws-empty--documents">
          <FileText size={30} strokeWidth={1.3} />
          <p>조건에 맞는 서류가 없어요</p>
          <span>다른 서류 종류나 검색어로 찾아보세요.</span>
          <button type="button" className="ws-btn ws-btn--sm" onClick={onReset}>모든 서류 보기</button>
        </div>
      ) : (
        <DragDropContext onBeforeCapture={onBeforeCapture} onDragEnd={finishDrag}
          dragHandleUsageInstructions="스페이스 키로 서류를 잡고, 방향키로 이동한 뒤 스페이스 키로 내려놓으세요. Escape 키로 취소할 수 있습니다."
          onDragStart={(start, { announce }) => announce(`${documents.find(d => d.boardKey === start.draggableId)?.title || '서류'}을 잡았습니다.`)}>
          <div className={`ws-board ${stage !== 'all' ? 'is-filtered' : ''}`}>
            {columns.map(column => {
              const items = documents.filter(d => d.status === column.key);
              return <section key={column.key} className={`ws-lane ws-lane--${column.key}`} aria-label={column.title}>
                <header><h3><i />{column.title}<span>{items.length}</span>{column.key === 'draft' && onAdd && <button type="button" className="ws-lane-add" onClick={onAdd} aria-label="포트폴리오 만들기" title="포트폴리오 만들기"><Plus size={15} /></button>}</h3><p>{column.description}</p></header>
                <Droppable droppableId={column.key} isDropDisabled={!canMove}>
                  {(provided, snapshot) => <div className={`ws-lane-scroll ${snapshot.isDraggingOver ? 'is-drag-over' : ''}`} ref={provided.innerRef} {...provided.droppableProps}>
                    <ul>
                      {items.map((d, index) => <Draggable key={d.boardKey} draggableId={d.boardKey} index={index} isDragDisabled={!canMove} disableInteractiveElementBlocking>
                        {(drag, dragState) => {
                          const card = <li ref={drag.innerRef} {...drag.draggableProps} style={drag.draggableProps.style} className={dragState.isDragging ? 'ws-card-dragging' : ''}>
                            <BoardCard doc={d} onOpen={() => onOpen(d)} actions={actionsOf(d)} dragHandleProps={canMove ? drag.dragHandleProps : null} dragging={dragState.isDragging} canMove={canMove} onMove={state => onMove(d, state)} />
                          </li>;
                          return dragState.isDragging ? createPortal(card, document.body) : card;
                        }}
                      </Draggable>)}
                      {provided.placeholder}
                      {!items.length && <li className="ws-lane-empty"><FileText size={23} strokeWidth={1.3} /><p>{column.key === 'draft' ? '새 서류를 준비해 보세요' : column.key === 'done' ? '완성한 서류를 옮겨두세요' : '제출한 서류를 옮겨두세요'}</p><small>서류를 이곳에 놓아주세요</small></li>}
                    </ul>
                  </div>}
                </Droppable>
              </section>;
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}

function BoardCard({ doc: d, onOpen, actions, dragHandleProps, dragging, canMove, onMove }) {
  const Icon = d.icon;
  const changeState = event => {
    const focused = document.activeElement === event.currentTarget;
    const hub = event.currentTarget.closest('.ws');
    const focusMovedCard = () => {
      if (!hub?.isConnected) return;
      const card = [...hub.querySelectorAll('.ws-board-card')].find(node => node.dataset.documentKey === d.boardKey);
      const target = card?.querySelector('.ws-card-status select') || hub.querySelector('.ws-stages [aria-pressed="true"]');
      target?.focus({ preventScroll: true });
      const scroller = card?.closest('.ws-lane-scroll');
      if (scroller) {
        const viewport = scroller.getBoundingClientRect();
        const rect = card.getBoundingClientRect();
        if (rect.top < viewport.top) scroller.scrollTop -= viewport.top - rect.top;
        else if (rect.bottom > viewport.bottom) scroller.scrollTop += rect.bottom - viewport.bottom;
      }
    };
    const saved = onMove(event.target.value);
    // Moving between columns remounts the card. Keep keyboard navigation with it.
    if (focused) {
      requestAnimationFrame(focusMovedCard);
      Promise.resolve(saved).then(() => {
        if (document.activeElement === document.body) requestAnimationFrame(focusMovedCard);
      });
    }
  };
  return (
    <div className={`ws-board-card ${dragging ? 'is-dragging' : ''}`} data-document-key={d.boardKey} data-document-type={d.docType} data-status={d.status}>
      <button type="button" className="ws-board-card-main" onClick={onOpen}>
        <span className="ws-board-card-top">
          <span className={`ws-document-icon ws-document-icon--${d.docType}`}><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span>
          <span>{d.label}</span>
          {d.favorite && <Star size={13} className="ws-card-star" aria-label="즐겨찾기" />}
        </span>
        <strong title={d.title}>{d.title}</strong>
        {d.meta && <span className="ws-board-company">{d.meta}</span>}
        <ArrowUpRight size={14} className="ws-card-open-arrow" aria-hidden="true" />
      </button>
      {dragHandleProps && <button type="button" {...dragHandleProps} className={`ws-card-drag-handle ${actions ? '' : 'ws-card-drag-handle--solo'}`} aria-label={`${d.title} 이동`} title="끌어서 이동"><GripVertical size={16} /></button>}
      {actions && <CardMenu title={d.title} actions={actions} />}
      <div className="ws-card-status"><label><span>상태</span><select aria-label={`${d.title} 상태`} value={d.status} disabled={!canMove} onChange={changeState}>{COLUMNS.map(column => <option key={column.key} value={column.key}>{column.title}</option>)}</select></label>{d.portfolio?.isPublic && <span className="ws-link-live" title="공유 링크가 공개되어 있어요"><Globe size={11} /> 링크 공개 중</span>}</div>
    </div>
  );
}

/* ── 카드 ⋯ 메뉴 — 서류함이 넘치는 부분을 잘라내므로 화면 기준(fixed)으로 띄운다 ── */
function CardMenu({ title, actions }) {
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    menuRef.current?.querySelector('button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); buttonRef.current?.focus(); }
      if (e.key === 'Tab') close();
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const items = [...(menuRef.current?.querySelectorAll('button') || [])];
        const index = items.indexOf(document.activeElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) { setPos(null); return; }
    const r = buttonRef.current.getBoundingClientRect();
    const { clientWidth, clientHeight } = document.documentElement;
    const right = Math.max(8, Math.min(clientWidth - 190, clientWidth - r.right));
    setPos(clientHeight - r.bottom < 220 ? { bottom: clientHeight - r.top + 4, right } : { top: r.bottom + 4, right });
  };

  return (
    <>
      <button ref={buttonRef} type="button" className="ws-card-menu" aria-label={`${title} 메뉴`} aria-haspopup="menu" aria-expanded={!!pos} onClick={toggle}>
        <MoreHorizontal size={16} />
      </button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setPos(null)} />
          <div ref={menuRef} role="menu" aria-label={`${title} 작업`} className="ws-card-menu-list" style={pos}>
            {actions.map(a => (
              <button key={a.label} type="button" role="menuitem" className={a.danger ? 'is-danger' : ''} onClick={() => { setPos(null); buttonRef.current?.focus(); a.run(); }}>
                <a.icon size={14} /> {a.label}
              </button>
            ))}
          </div>
        </>, document.body
      )}
    </>
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
