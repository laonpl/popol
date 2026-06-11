/**
 * ProjectDetailModal — 프로젝트(경험) 상세 모달 (편집/미리보기/링크공유 공용).
 *
 * 본문은 하나의 자유 노션 캔버스(NotionDocEditor)로 편집한다.
 *  - 좌측: 팔레트(섹션 + 핵심 경험) — 드래그하여 캔버스에 삽입 (편집 모드)
 *  - 중앙: 속성 헤더(기간/역할/기술/키워드/목표/링크 + 핵심경험) + 자유 캔버스
 *  - 우측: AI 첨삭 패널 (jobAnalysis 연결 시, 편집 모드)
 *
 * Props:
 *  - exp: 프로젝트(경험) 객체. 캔버스는 exp.notionDoc(Yoopta JSON)에 저장.
 *  - readOnly: 읽기전용(미리보기·링크공유)
 *  - onUpdate(changes): 편집 모드에서 변경 저장
 *  - onClose, jobAnalysis, resizeToBase64, genericMode
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from '../services/firestoreProxy';
import { db } from '../config/firebase';
import { X, ExternalLink, ImagePlus, Check, Loader2, FileText, GripVertical, Sparkles, Wand2, List, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import KeyExperienceSlider from './KeyExperienceSlider';
import GuidedTutorial from './GuidedTutorial';
import { useOnboarding } from './OnboardingOverlay';
import { NotionDocEditor, CUSTOM_PALETTE_DRAG_TYPE } from './YooptaMiniEditor';
import {
  buildNotionDocFromExperience,
  allKeyExperiencePaletteBlocks,
  blocksToYooptaValue,
  buildRenderableSections,
  sectionPaletteBlocks,
  keyExperiencePaletteBlocks,
  tailoredToBlocks,
  getSectionTemplates,
  extractSectionsFromDoc,
  experienceDraftBlocks,
  extractHeadingsFromDoc,
  emptyNotionDoc,
} from '../utils/projectSections';
import { stripMd } from '../utils/textUtils';

function slatePlainText(node) {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  return (node.children || []).map(slatePlainText).join('');
}

function docHasMeaningfulContent(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(block => {
    if (!block) return false;
    if (block.type === 'Image' || block.type === 'Table' || block.type === 'Divider') return true;
    return (block.value || []).some(node => slatePlainText(node).trim());
  });
}

function PaletteGroup({ title, icon, open, onToggle, children }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[12px] font-bold text-gray-600 hover:bg-white"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
      </button>
      {open && <div className="mt-1.5 space-y-1">{children}</div>}
    </div>
  );
}

function setPaletteDragPayload(event, payload) {
  const json = JSON.stringify(payload);
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData(CUSTOM_PALETTE_DRAG_TYPE, json);
  event.dataTransfer.setData('application/json', json);
  event.dataTransfer.setData('text/plain', `fitpoly-palette:${json}`);
}

const QUICK_MENU_PANEL_WIDTH = 224;

function QuickMenu({ headings, activeId, onSelect, anchorRef, scrollRootRef }) {
  const [position, setPosition] = useState({ left: -9999, top: -9999 });

  useEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const gap = 16;
      // 본문 컬럼 오른쪽 여백(거터)에 두되, 패널이 오른쪽으로 펼쳐질 공간을 확보해
      // 본문을 가리지 않도록 left를 (뷰포트 우측 - 패널 너비) 안쪽으로 제한한다.
      const left = Math.min(rect.right + gap, window.innerWidth - QUICK_MENU_PANEL_WIDTH - 16);
      setPosition({
        left: Math.max(16, left),
        top: Math.max(96, Math.min(rect.top + 120, window.innerHeight - 360)),
      });
    };

    updatePosition();
    const root = scrollRootRef?.current;
    root?.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);
    return () => {
      root?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, scrollRootRef]);

  return (
    <aside
      data-tour="project-detail-quick-menu"
      className="group/quick fixed z-[360] hidden lg:block"
      style={position}
    >
      {/* 접힘: 선 핸들 — 펼칠 때는 사라지고 그 자리에서 목차가 펼쳐진다 */}
      <button
        type="button"
        className="flex h-[78px] w-[34px] flex-col items-center justify-center gap-2.5 rounded-xl border border-transparent opacity-55 transition-opacity duration-200 hover:opacity-100 group-hover/quick:opacity-0 group-focus-within/quick:opacity-0"
        aria-label="Quick Menu 열기"
      >
        <span className="h-[3px] w-[20px] rounded-full bg-primary-500 shadow-[0_0_8px_rgba(0,47,108,0.18)]" />
        <span className="h-[3px] w-[20px] rounded-full bg-bluewood-300/75" />
        <span className="h-[3px] w-[20px] rounded-full bg-bluewood-300/75" />
      </button>

      {/* 펼침: 핸들 자리(좌상단)에서 오른쪽·아래로 펼쳐진다 */}
      <div
        className="pointer-events-none absolute left-0 top-0 -translate-y-1 opacity-0 transition-all duration-200 group-hover/quick:pointer-events-auto group-hover/quick:translate-y-0 group-hover/quick:opacity-100 group-focus-within/quick:pointer-events-auto group-focus-within/quick:translate-y-0 group-focus-within/quick:opacity-100"
        style={{ width: QUICK_MENU_PANEL_WIDTH }}
      >
        <div className="rounded-2xl border border-surface-200 bg-white/98 p-3 shadow-card-hover backdrop-blur">
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-bluewood-300">
            <List size={12} /> Quick
          </div>
          {headings.length === 0 ? (
            <p className="px-1 py-1 text-[12px] leading-relaxed text-bluewood-300">제목 블록을 추가하면 목차가 생깁니다.</p>
          ) : (
            <div className="max-h-[300px] space-y-0.5 overflow-y-auto pr-1">
              {headings.map(item => {
                const active = activeId === item.id;
                const indent = item.level === 1 ? '' : item.level === 2 ? 'pl-3' : 'pl-6';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[12px] font-semibold transition-colors ${indent} ${
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-bluewood-500 hover:bg-surface-50 hover:text-bluewood-800'
                    }`}
                    title={item.text}
                  >
                    {item.text}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function ProjectDetailModal({
  exp,
  readOnly = false,
  onUpdate,
  onClose,
  jobAnalysis,
  resizeToBase64,
  genericMode = false,
}) {
  const structured = exp?.structuredResult || {};
  const overview = structured.projectOverview || {};

  // ── Firestore 섹션 이미지 로드 (마이그레이션 보존용) ──
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [imageConfig, setImageConfig] = useState({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  useEffect(() => {
    const expId = exp?.experienceId;
    if (!expId) { setImagesLoaded(true); return; }
    let alive = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'experiences', expId));
        if (snap.exists() && alive) {
          const data = snap.data();
          setAllImages(data.images || []);
          setSectionImages(data.sectionImages || {});
          setImageConfig(data.imageConfig || {});
        }
      } catch { /* 이미지 로드 실패는 무시 */ }
      if (alive) setImagesLoaded(true);
    })();
    return () => { alive = false; };
  }, [exp?.experienceId]);

  // ── 캔버스 초기 문서: 편집 모드는 저장 문서가 없으면 빈 페이지, 읽기 전용은 기존 섹션을 자동 변환 ──
  const hasSavedDoc = exp?.notionDoc && Object.keys(exp.notionDoc).length > 0;
  const initialDoc = useMemo(() => {
    if (hasSavedDoc) return exp.notionDoc;
    if (!imagesLoaded) return null;
    if (!readOnly) return emptyNotionDoc();
    return buildNotionDocFromExperience(exp, { allImages, sectionImages, imageConfig });
  }, [hasSavedDoc, readOnly, exp, imagesLoaded, allImages, sectionImages, imageConfig]);

  const docValueRef = useRef(initialDoc);
  const [headings, setHeadings] = useState([]);
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState({ sections: true, keyexp: true });
  const [docIsEmpty, setDocIsEmpty] = useState(true);
  useEffect(() => {
    if (!initialDoc) return;
    docValueRef.current = initialDoc;
    setHeadings(extractHeadingsFromDoc(initialDoc));
    setDocIsEmpty(!docHasMeaningfulContent(initialDoc));
  }, [initialDoc]);
  const canvasRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const documentColumnRef = useRef(null);
  const coverInputRef = useRef(null);
  const tutorialRef = useRef(null);
  const tutorial = useOnboarding(!readOnly ? 'project_detail_canvas' : null);

  const handleDocChange = (nextDoc) => {
    docValueRef.current = nextDoc;
    setHeadings(extractHeadingsFromDoc(nextDoc));
    setDocIsEmpty(!docHasMeaningfulContent(nextDoc));
    onUpdate?.({ notionDoc: nextDoc });
  };

  const replaceCanvasWithDraft = () => {
    if (!docIsEmpty && !window.confirm('현재 캔버스 내용을 초안으로 교체할까요?')) return;
    const blocks = experienceDraftBlocks(exp, { allImages, sectionImages, imageConfig });
    const nextDoc = blocksToYooptaValue(blocks);
    canvasRef.current?.replaceBlocks(blocks);
    docValueRef.current = nextDoc;
    setHeadings(extractHeadingsFromDoc(nextDoc));
    setDocIsEmpty(!docHasMeaningfulContent(nextDoc));
    onUpdate?.({ notionDoc: nextDoc });
    toast.success('경험 정리 내용을 바탕으로 초안을 만들었습니다');
  };

  const uploadCoverImage = async (file) => {
    if (!file) return;
    if (!resizeToBase64) {
      toast.error('이미지 업로드를 사용할 수 없습니다');
      return;
    }
    try {
      const url = await resizeToBase64(file, 1400, 0.84);
      onUpdate?.({
        thumbnailUrl: url,
        structuredResult: {
          ...structured,
          exportConfig: { ...(structured.exportConfig || {}), coverImg: url },
        },
      });
      toast.success('커버 사진을 설정했습니다');
    } catch {
      toast.error('이미지 처리에 실패했습니다');
    }
  };

  const removeCoverImage = () => {
    onUpdate?.({
      thumbnailUrl: '',
      structuredResult: {
        ...structured,
        exportConfig: { ...(structured.exportConfig || {}), coverImg: null },
      },
    });
  };

  const scrollToHeading = (id) => {
    if (!id) return;
    setActiveHeadingId(id);
    const target = document.querySelector(`[data-yoopta-block-id="${id}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  };

  const togglePalette = (key) => {
    setPaletteOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── 메타(속성) 인라인 편집 ──
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState(null);
  const openMetaEdit = () => {
    setMetaDraft({
      title: exp?.title || '',
      date: exp?.date || overview.duration || '',
      role: exp?.role || overview.role || '',
      skills: (exp?.skills || []).join(', '),
      keywords: (exp?.keywords || []).map(k => (typeof k === 'string' ? k : k?.name || k?.keyword || '')).join(', '),
      goal: overview.goal || '',
      description: exp?.description || overview.background || overview.summary || '',
      link: exp?.link || '',
      thumbnailUrl: exp?.thumbnailUrl || '',
    });
    setEditingMeta(true);
  };
  const saveMetaEdit = () => {
    if (!metaDraft) return;
    const skills = metaDraft.skills.split(',').map(s => s.trim()).filter(Boolean);
    const keywords = metaDraft.keywords.split(',').map(s => s.trim()).filter(Boolean);
    onUpdate?.({
      title: metaDraft.title,
      date: metaDraft.date,
      role: metaDraft.role,
      skills,
      keywords,
      description: metaDraft.description,
      link: metaDraft.link,
      thumbnailUrl: metaDraft.thumbnailUrl,
      structuredResult: {
        ...structured,
        projectOverview: { ...overview, duration: metaDraft.date, role: metaDraft.role, goal: metaDraft.goal },
      },
    });
    setEditingMeta(false);
  };

  // ── AI 첨삭 ──
  const [tailorOpen, setTailorOpen] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState(null);
  const [appliedSections, setAppliedSections] = useState({});

  const runTailor = async () => {
    if (!jobAnalysis) return;
    setTailoring(true);
    setTailorError(null);
    setAppliedSections({});
    try {
      const sections = extractSectionsFromDoc(docValueRef.current)
        .map((s, i) => ({ key: s.key || `section-${i}`, title: s.label, content: s.content }))
        .filter(s => s.content.trim());
      if (sections.length === 0) {
        setTailorResult({ sections: [], overallNote: '첨삭할 본문 내용이 없습니다.' });
        setTailoring(false);
        return;
      }
      const { data } = await api.post('/job/tailor-portfolio', { jobAnalysis, sections });
      setTailorResult({
        ...data,
        portfolioSections: (data.sections || []).map(item => ({
          ...item,
          label: sections[item.index]?.title,
        })),
      });
    } catch (err) {
      setTailorError(err.response?.data?.error || 'AI 첨삭에 실패했습니다');
    }
    setTailoring(false);
  };

  const openTailor = () => {
    if (tailorOpen) { setTailorOpen(false); return; }
    setTailorOpen(true);
    setTailorResult(null);
    setTailorError(null);
    runTailor();
  };

  const applyTailoredSection = (idx, label, content) => {
    if (!content?.trim()) return;
    canvasRef.current?.insertBlocks(tailoredToBlocks(label, content));
    setAppliedSections(prev => ({ ...prev, [idx]: true }));
  };
  const applyAllTailored = () => {
    const list = (tailorResult?.portfolioSections || []).filter(s => s.tailoredContent?.trim());
    list.forEach((s, i) => canvasRef.current?.insertBlocks(tailoredToBlocks(s.label, s.tailoredContent)));
    setAppliedSections(Object.fromEntries(list.map((_, i) => [i, true])));
  };

  // ── 팔레트 드래그 → 블록 변환 (작성된 섹션/핵심 경험을 캔버스에 재활용) ──
  const resolvePaletteBlocks = (payload) => {
    if (payload?.kind === 'section') return sectionPaletteBlocks(exp, payload.key, payload.label);
    if (payload?.kind === 'all-keyexperiences') return allKeyExperiencePaletteBlocks(exp);
    if (payload?.kind === 'keyexperience') return keyExperiencePaletteBlocks(exp, payload.index);
    return [];
  };

  const insertPalettePayload = (payload) => {
    const blocks = resolvePaletteBlocks(payload);
    if (!Array.isArray(blocks) || blocks.length === 0) {
      toast.error('추가할 내용이 없습니다');
      return;
    }
    if (docIsEmpty) {
      canvasRef.current?.replaceBlocks(blocks);
    } else {
      canvasRef.current?.insertBlocks(blocks);
    }
    toast.success('캔버스에 추가했습니다');
  };

  if (!exp) return null;

  const duration = overview.duration || exp.date || '';
  const role = overview.role || exp.role || '';
  const techStack = (overview.techStack?.length > 0 ? overview.techStack : null) || (exp.skills?.length > 0 ? exp.skills : null) || [];
  const keywords = exp.keywords || [];
  const goal = overview.goal || '';
  const coverImg = structured.exportConfig?.coverImg || exp.thumbnailUrl || null;
  const keyExps = (structured.keyExperiences || []).filter(Boolean);
  const description = exp.description || overview.background || overview.summary || '';
  const sectionTemplates = getSectionTemplates(exp?.jobCategory || structured.exportConfig?.jobCategory);
  const renderedSections = buildRenderableSections(exp);
  const sectionContentMap = new Map(renderedSections.map(section => [section.key, section]));
  const tutorialSteps = [
    {
      selector: '[data-tour="project-detail-palette"]',
      title: '섹션을 끌어와 구성하세요',
      body: '왼쪽 섹션은 제목만이 아니라 경험 정리에서 이미 작성된 본문까지 함께 가져옵니다. 필요한 위치에 드래그해서 넣으면 됩니다.',
    },
    {
      selector: '[data-tour="project-detail-draft"]',
      title: '빈 화면이 부담되면 초안을 만드세요',
      body: '초안 만들기는 속성, 작성된 섹션, 핵심 경험을 한 번에 캔버스에 배치합니다.',
      actionLabel: '초안 만들기',
      onAction: replaceCanvasWithDraft,
    },
    {
      selector: '[data-tour="project-detail-keyexp"]',
      title: '핵심 경험도 블록처럼 추가합니다',
      body: '전체 핵심 경험을 한 번에 넣거나, 특정 경험만 골라서 캔버스 중간에 배치할 수 있습니다.',
    },
    {
      selector: '[data-tour="project-detail-cover"]',
      title: '커버 사진을 설정하세요',
      body: '프로젝트의 첫인상을 보여주는 화면, 결과물, 구조도 이미지를 커버로 지정할 수 있습니다.',
    },
    {
      selector: '[data-tour="project-detail-image"]',
      title: '이미지는 자유롭게 붙여 넣습니다',
      body: '버튼으로 추가해도 되고, 캔버스 중간에 이미지를 붙여넣거나 드롭해도 됩니다.',
    },
    {
      selector: '[data-tour="project-detail-quick-menu"]',
      title: 'Quick Menu가 자동으로 따라옵니다',
      body: '캔버스에 제목 블록을 추가하면 오른쪽 목차가 자동 갱신되어 긴 문서에서도 바로 이동할 수 있습니다.',
    },
  ];

  const showPalette = !readOnly;
  const showTailorPanel = !readOnly && tailorOpen;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-3"
      onClick={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col h-[92vh] transition-all duration-300"
        style={{ width: showTailorPanel ? 'min(1700px, calc(100vw - 24px))' : 'min(1400px, calc(100vw - 24px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate max-w-[520px]">{exp.title || (genericMode ? '카드 상세' : '경험 상세')}</h3>
              {!readOnly && !genericMode && (
                <p className="mt-0.5 truncate text-[12.5px] text-bluewood-400">노션 포트폴리오에 들어갈 프로젝트 화면을 구성하는 곳이에요. 여기서 배치한 그대로 내보내집니다.</p>
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => (editingMeta ? setEditingMeta(false) : openMetaEdit())}
                className={`flex-shrink-0 px-3 py-1 rounded-md text-xs font-medium transition-all border ${editingMeta ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50'}`}
              >
                {editingMeta ? '닫기' : '정보 수정'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && jobAnalysis && !genericMode && (
              <button
                onClick={openTailor}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${tailorOpen ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
              >
                <Sparkles size={13} /> AI 첨삭
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* ── 좌측 팔레트 ── */}
          {showPalette && (
            <div data-tour="project-detail-palette" className="w-[248px] flex-shrink-0 border-r border-gray-100 bg-[#fafaf8] overflow-y-auto p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-bluewood-300">Blocks</p>
                <button
                  type="button"
                  onClick={tutorial.show}
                  className="rounded-md px-2 py-1 text-[11px] font-bold text-primary-600 hover:bg-primary-50"
                >
                  도움말
                </button>
              </div>

              <PaletteGroup
                title="섹션"
                icon={<FileText size={13} />}
                open={paletteOpen.sections}
                onToggle={() => togglePalette('sections')}
              >
                {sectionTemplates.map(tpl => {
                  const filled = !!sectionContentMap.get(tpl.key)?.content?.trim();
                  return (
                    <div
                      key={tpl.key}
                      draggable
                      onDragStart={e => {
                        setPaletteDragPayload(e, { kind: 'section', key: tpl.key, label: tpl.label });
                      }}
                      onDoubleClick={() => insertPalettePayload({ kind: 'section', key: tpl.key, label: tpl.label })}
                      title="드래그하거나 더블클릭해 추가"
                      className="group flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] text-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                    >
                      <GripVertical size={12} className="text-gray-300 group-hover:text-primary-400" />
                      <span className="min-w-0 flex-1 truncate">{tpl.label}</span>
                      {filled && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-600">작성됨</span>}
                    </div>
                  );
                })}
              </PaletteGroup>

              {keyExps.length > 0 && (
                <div data-tour="project-detail-keyexp" className="mt-4">
                  <PaletteGroup
                    title="핵심 경험"
                    icon={<Sparkles size={13} />}
                    open={paletteOpen.keyexp}
                    onToggle={() => togglePalette('keyexp')}
                  >
                    <div
                      draggable
                      onDragStart={e => {
                        setPaletteDragPayload(e, { kind: 'all-keyexperiences' });
                      }}
                      onDoubleClick={() => insertPalettePayload({ kind: 'all-keyexperiences' })}
                      title="드래그하거나 더블클릭해 추가"
                      className="group flex items-center gap-1.5 rounded-md border border-primary-200 bg-primary-50 px-2 py-1.5 text-[13px] font-bold text-primary-700 cursor-grab active:cursor-grabbing hover:bg-primary-100 transition-colors"
                    >
                      <GripVertical size={12} className="text-primary-300" />
                      <span className="min-w-0 flex-1 truncate">전체 핵심 경험</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-black text-primary-500">{keyExps.length}</span>
                    </div>
                    {keyExps.map((item, index) => (
                      <div
                        key={`${item.title || 'keyexp'}-${index}`}
                        draggable
                        onDragStart={e => {
                          setPaletteDragPayload(e, { kind: 'keyexperience', index });
                        }}
                        onDoubleClick={() => insertPalettePayload({ kind: 'keyexperience', index })}
                        title="드래그하거나 더블클릭해 추가"
                        className="group flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[13px] text-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                      >
                        <GripVertical size={12} className="text-gray-300 group-hover:text-primary-400" />
                        <span className="min-w-0 flex-1 truncate">{stripMd(item.title) || `핵심 경험 ${index + 1}`}</span>
                      </div>
                    ))}
                  </PaletteGroup>
                </div>
              )}

            </div>
          )}

          {/* ── 중앙: 속성 헤더 + 캔버스 + Quick Menu ── */}
          <div ref={scrollAreaRef} className="flex-1 min-w-0 overflow-y-auto bg-white">
            <div className="px-5 pb-12 pt-6">
              <div ref={documentColumnRef} className="relative mx-auto max-w-3xl">
                <main data-tour="project-detail-canvas" className="min-w-0 flex-1 max-w-3xl">
                  {(!readOnly || coverImg) && (
                    <div data-tour="project-detail-cover" className={`group relative mb-6 overflow-hidden rounded-lg border border-surface-200 bg-surface-50 ${coverImg ? 'h-40' : 'h-24'}`}>
                      {coverImg ? (
                        <img src={coverImg} alt="cover" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[13px] font-semibold text-bluewood-300">커버 사진</div>
                      )}
                      {!readOnly && (
                        <div className="absolute right-3 top-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => coverInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 rounded-md border border-white/70 bg-white/92 px-2.5 py-1.5 text-[12px] font-bold text-bluewood-700 shadow-sm backdrop-blur hover:bg-white"
                          >
                            <ImagePlus size={13} /> 커버 설정
                          </button>
                          {coverImg && (
                            <button
                              type="button"
                              onClick={removeCoverImage}
                              className="rounded-md border border-white/70 bg-white/92 px-2.5 py-1.5 text-[12px] font-bold text-red-500 shadow-sm backdrop-blur hover:bg-white"
                            >
                              제거
                            </button>
                          )}
                        </div>
                      )}
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={event => {
                          uploadCoverImage(event.target.files?.[0]);
                          event.target.value = '';
                        }}
                      />
                    </div>
                  )}
              {/* 메타 편집 폼 */}
              {editingMeta && metaDraft && (
                <div className="mb-6 bg-surface-50 border border-surface-200 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">제목</label>
                    <input value={metaDraft.title} onChange={e => setMetaDraft(d => ({ ...d, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">기간</label>
                      <input value={metaDraft.date} onChange={e => setMetaDraft(d => ({ ...d, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '보조 정보' : '역할'}</label>
                      <input value={metaDraft.role} onChange={e => setMetaDraft(d => ({ ...d, role: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '태그 (쉼표로 구분)' : '기술 (쉼표로 구분)'}</label>
                    <input value={metaDraft.skills} onChange={e => setMetaDraft(d => ({ ...d, skills: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">키워드 (쉼표로 구분)</label>
                    <input value={metaDraft.keywords} onChange={e => setMetaDraft(d => ({ ...d, keywords: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '메모 / 한줄평' : '목표'}</label>
                    <textarea value={metaDraft.goal} onChange={e => setMetaDraft(d => ({ ...d, goal: e.target.value }))}
                      rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{genericMode ? '상세 내용' : '간단한 소개'}</label>
                    <textarea value={metaDraft.description} onChange={e => setMetaDraft(d => ({ ...d, description: e.target.value }))}
                      rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">링크 (선택)</label>
                    <input value={metaDraft.link} onChange={e => setMetaDraft(d => ({ ...d, link: e.target.value }))} placeholder="https://"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">대표 이미지 (선택)</label>
                    <div className="flex items-center gap-3">
                      {metaDraft.thumbnailUrl && <img src={metaDraft.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />}
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                        <ImagePlus size={14} /> 이미지 선택
                        <input type="file" accept="image/*" className="hidden" onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file || !resizeToBase64) return;
                          try { const url = await resizeToBase64(file, 800, 0.8); setMetaDraft(d => ({ ...d, thumbnailUrl: url })); }
                          catch { toast.error('이미지 처리에 실패했습니다'); }
                        }} />
                      </label>
                      {metaDraft.thumbnailUrl && (
                        <button type="button" onClick={() => setMetaDraft(d => ({ ...d, thumbnailUrl: '' }))} className="text-xs text-gray-400 hover:text-red-500">이미지 제거</button>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingMeta(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">취소</button>
                    <button onClick={saveMetaEdit} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">저장</button>
                  </div>
                </div>
              )}

              {/* 제목 (읽기전용에서만 표시 — 헤더에 이미 있지만 문서 느낌) */}
              {readOnly && (
                <h1 className="text-[28px] font-extrabold text-primary-600 leading-tight mb-5">{exp.title || '(제목 없음)'}</h1>
              )}

              {/* 속성 헤더 */}
              {(duration || role || techStack.length > 0 || keywords.length > 0 || goal || exp.link) && (
                <div className="space-y-2 border-b border-surface-100 pb-5 mb-6">
                  {duration && (
                    <div className="flex items-center gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0">기간</span><span className="text-[15px] text-gray-700">{duration}</span></div>
                  )}
                  {role && (
                    <div className="flex items-start gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">역할</span><span className="text-[15px] text-gray-700 leading-relaxed">{role}</span></div>
                  )}
                  {techStack.length > 0 && (
                    <div className="flex items-start gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">기술</span>
                      <div className="flex flex-wrap gap-1.5">{techStack.map((t, i) => <span key={i} className="px-2 py-0.5 bg-surface-100 text-gray-600 rounded text-[14px]">{typeof t === 'string' ? t : t?.name || ''}</span>)}</div>
                    </div>
                  )}
                  {keywords.length > 0 && (
                    <div className="flex items-start gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">키워드</span>
                      <div className="flex flex-wrap gap-1.5">{keywords.slice(0, 6).map((kw, i) => <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-500 rounded text-[14px] font-medium">{typeof kw === 'string' ? kw : kw?.name || kw?.keyword || ''}</span>)}</div>
                    </div>
                  )}
                  {goal && (
                    <div className="flex items-start gap-4"><span className="w-14 text-[14px] text-gray-400 flex-shrink-0 mt-0.5">목표</span><span className="text-[15px] text-gray-700 leading-relaxed">{goal}</span></div>
                  )}
                  {exp.link && (
                    <div className="flex items-center gap-4">
                      <span className="w-14 text-[14px] text-gray-400 flex-shrink-0">링크</span>
                      <a href={exp.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[15px] text-primary-600 hover:underline break-all"><ExternalLink size={12} /> {exp.link}</a>
                    </div>
                  )}
                </div>
              )}

              {/* 설명 */}
              {description && (
                <p className="text-sm text-gray-600 leading-relaxed bg-surface-50 rounded-xl p-4 mb-6">{description}</p>
              )}

              {/* 핵심 경험 */}
              {keyExps.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-[14px] font-bold uppercase tracking-widest text-gray-400 border-b border-surface-100 pb-2 mb-4">핵심 경험 &amp; 성과</h4>
                  <KeyExperienceSlider
                    keyExperiences={keyExps}
                    onUpdate={readOnly ? undefined : (updated => onUpdate?.({ structuredResult: { ...structured, keyExperiences: updated } }))}
                  />
                </div>
              )}

              {/* ── 자유 캔버스 ── */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-surface-100 pb-2">
                  <h4 className="text-[14px] font-bold uppercase tracking-widest text-gray-400">상세 내용</h4>
                  {!readOnly && (
                    <div className="flex items-center gap-1.5">
                      <button
                        data-tour="project-detail-draft"
                        type="button"
                        onClick={replaceCanvasWithDraft}
                        className="inline-flex items-center gap-1.5 rounded-md bg-bluewood-800 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-bluewood-900 active:scale-95 transition-all"
                      >
                        <Wand2 size={13} /> 초안 만들기
                      </button>
                      <button
                        data-tour="project-detail-image"
                        type="button"
                        onClick={() => canvasRef.current?.openImagePicker()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-surface-200 bg-white px-3 py-1.5 text-[12px] font-bold text-bluewood-600 hover:border-primary-200 hover:bg-primary-50 active:scale-95 transition-all"
                      >
                        <ImagePlus size={13} /> 이미지 추가
                      </button>
                    </div>
                  )}
                </div>
                {!readOnly && docIsEmpty && (
                  <div className="mb-3 rounded-lg border border-dashed border-primary-200 bg-primary-50/45 px-4 py-3 text-[13px] leading-relaxed text-bluewood-500">
                    빈 캔버스입니다. 왼쪽 블록을 드래그하거나 초안 만들기로 시작하세요.
                  </div>
                )}
                {initialDoc ? (
                  <NotionDocEditor
                    key={exp.experienceId || exp.id || exp.title || 'project'}
                    ref={canvasRef}
                    value={initialDoc}
                    onChange={readOnly ? undefined : handleDocChange}
                    readOnly={readOnly}
                    resolvePaletteBlocks={resolvePaletteBlocks}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
                )}
              </div>
                </main>
                <QuickMenu
                  headings={headings}
                  activeId={activeHeadingId}
                  onSelect={scrollToHeading}
                  anchorRef={documentColumnRef}
                  scrollRootRef={scrollAreaRef}
                />
              </div>
            </div>
          </div>

          {/* ── 우측 AI 첨삭 패널 ── */}
          {showTailorPanel && (
            <div className="flex-shrink-0 border-l border-gray-100 overflow-y-auto bg-gradient-to-b from-indigo-50/30 to-white" style={{ width: 'clamp(320px, 34vw, 400px)' }}>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-indigo-800">AI 첨삭</h4>
                  {tailorResult && !tailoring && (
                    <button onClick={runTailor} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">다시 첨삭</button>
                  )}
                </div>
                {jobAnalysis?.company && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-xs font-medium text-blue-800">{jobAnalysis.company}</span>
                    {jobAnalysis.position && <span className="text-xs text-blue-500">· {jobAnalysis.position}</span>}
                  </div>
                )}
                {tailoring && (
                  <div className="flex flex-col items-center py-10">
                    <Loader2 size={24} className="animate-spin text-indigo-400 mb-3" />
                    <p className="text-sm text-gray-500">첨삭 중입니다...</p>
                    <p className="text-xs text-gray-400 mt-1">본문을 기업에 맞게 재구성합니다</p>
                  </div>
                )}
                {tailorError && !tailoring && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-xs text-red-600">{tailorError}</p>
                    <button onClick={runTailor} className="text-xs text-red-500 hover:text-red-700 mt-1 underline">다시 시도</button>
                  </div>
                )}
                {tailorResult && !tailoring && (
                  <div className="space-y-3">
                    {tailorResult.overallNote && (tailorResult.portfolioSections || []).length === 0 && (
                      <p className="text-[12px] text-gray-500 italic bg-gray-50 rounded-xl px-3 py-2">{tailorResult.overallNote}</p>
                    )}
                    {(tailorResult.portfolioSections || []).filter(s => s.tailoredContent?.trim()).length > 0 && (
                      <button onClick={applyAllTailored} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
                        전체 적용 (캔버스에 삽입)
                      </button>
                    )}
                    {(tailorResult.portfolioSections || []).map((section, i) => {
                      const content = section.tailoredContent;
                      if (!content?.trim()) return null;
                      const isApplied = appliedSections[i];
                      return (
                        <div key={i} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                          <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 border-b border-gray-100">
                            <span className="text-xs font-bold text-gray-700 flex-1 truncate">{section.label || '섹션'}</span>
                            <button
                              onClick={() => applyTailoredSection(i, section.label, content)}
                              disabled={isApplied}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-medium transition-colors ${isApplied ? 'bg-green-100 text-green-700 cursor-default' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200'}`}
                            >
                              {isApplied ? <><Check size={10} />적용됨</> : <>적용</>}
                            </button>
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{stripMd(content)}</p>
                            {(section.reason || section.changeReason) && (
                              <p className="text-[12px] text-indigo-500 mt-2 pt-2 border-t border-gray-50 italic">{stripMd(section.reason || section.changeReason)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {tailorResult.highlightedSkills?.length > 0 && (
                      <div className="pt-2">
                        <p className="text-[12px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">기업 어필 스킬</p>
                        <div className="flex flex-wrap gap-1.5">{tailorResult.highlightedSkills.map((s, si) => <span key={si} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[12px] font-medium">{s}</span>)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {!readOnly && (
        <GuidedTutorial
          ref={tutorialRef}
          visible={tutorial.visible}
          steps={tutorialSteps}
          onSkip={() => tutorial.dismiss(false)}
          onNeverShow={() => tutorial.dismiss(true)}
        />
      )}
    </div>
  );
}
