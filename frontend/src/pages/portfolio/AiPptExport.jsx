import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Wand2, Download, Upload, X, Check, RefreshCw, Lock, ChevronRight, MousePointerClick } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import api from '../../services/api';
import { getComposedTemplate, buildTemplateFromPptxTheme, SlidePreview, exportDeckToPptx, COLOR_PALETTES, SLIDE_LAYOUTS } from './aiPptTemplates';

const STAGE = { CHOOSE: 'choose', ANALYZING: 'analyzing', PREVIEW: 'preview' };

export default function AiPptExport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(STAGE.CHOOSE);
  const initTemplateParam = searchParams.get('template') || 'beige-minimal';
  const initLayoutParam = searchParams.get('layout') || searchParams.get('layoutId');
  const layoutIds = SLIDE_LAYOUTS.map(layout => layout.id);
  const initTemplateIsLayout = layoutIds.includes(initTemplateParam) && initTemplateParam !== 'standard';
  const initLayout = initLayoutParam || (initTemplateIsLayout ? initTemplateParam : 'standard');
  const initTemplate = initTemplateIsLayout ? 'beige-minimal' : initTemplateParam;
  const autostart = searchParams.get('autostart') === 'true';
  const [templateId, setTemplateId] = useState(initTemplate);
  const [customFile, setCustomFile] = useState(null);
  const [customFileName, setCustomFileName] = useState('');
  // Templates 1/2/3 state
  const [deck, setDeck] = useState(null);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(null);
  const [reviseInput, setReviseInput] = useState('');
  const [revising, setRevising] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Custom template state (구버전 box-mapping 결과 — 하위호환용으로만 유지)
  const [customResult, setCustomResult] = useState(null); // { pptxBase64, deck, slideSize, layoutSlides }
  const [pptxThemeTemplate, setPptxThemeTemplate] = useState(null); // 업로드 PPTX 테마로 만든 내장 템플릿
  const fileInputRef = useRef(null);

  const autoStartFiredRef = useRef(false);
  const [layoutId, setLayoutId] = useState(initLayout);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'portfolios', id));
        if (snap.exists()) setPortfolio({ id: snap.id, ...snap.data() });
      } catch { toast.error('포트폴리오를 불러오지 못했습니다'); }
      setLoading(false);
    })();
  }, [id]);

  // autostart=true 이면 포트폴리오 로드 완료 후 바로 분석 시작
  useEffect(() => {
    if (autostart && portfolio && !loading && !autoStartFiredRef.current) {
      autoStartFiredRef.current = true;
      startAnalyze();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart, portfolio, loading]);

  const handleCustomUpload = (file) => {
    if (!file) return;
    setCustomFile(file);
    setCustomFileName(file.name);
    setTemplateId('custom');
    toast.success(`${file.name} 선택됨`);
  };

  const startAnalyze = async () => {
    if (!portfolio) return;
    setStage(STAGE.ANALYZING);
    try {
      if (templateId === 'custom' && customFile) {
        // 업로드 PPTX에서 색·폰트 추출 → 내장 파이프라인 그대로 사용
        // (box-mapping 방식 제거 — 내장과 동일한 채움 품질 보장)
        const themeForm = new FormData();
        themeForm.append('template', customFile);
        const { data: tokens } = await api.post('/export/ppt-theme', themeForm, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const tpl = buildTemplateFromPptxTheme(tokens, layoutId);
        setPptxThemeTemplate(tpl);
        // 내장 파이프라인과 동일하게 deck 생성
        const { data } = await api.post('/portfolio/ai-ppt-analyze', {
          portfolioId: id,
          templateHint: `${layoutId}:proposal`,
          customTemplate: null,
        });
        if (!data?.deck?.slides?.length) throw new Error('슬라이드 생성 실패');
        setDeck(data.deck);
        setStage(STAGE.PREVIEW);
      } else {
        setPptxThemeTemplate(null);
        // 내장 템플릿 파이프라인
        const { data } = await api.post('/portfolio/ai-ppt-analyze', {
          portfolioId: id,
          templateHint: `${layoutId}:${templateId}`,
          customTemplate: null,
        });
        if (!data?.deck?.slides?.length) throw new Error('슬라이드 생성 실패');
        setDeck(data.deck);
        setStage(STAGE.PREVIEW);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'AI 분석 실패');
      setStage(STAGE.CHOOSE);
    }
  };

  const reviseSlide = async () => {
    if (selectedSlideIdx === null || !reviseInput.trim()) return;
    setRevising(true);
    try {
      const slide = deck.slides[selectedSlideIdx];
      const { data } = await api.post('/portfolio/ai-ppt-revise', {
        portfolioId: id,
        slide,
        instruction: reviseInput.trim(),
      });
      if (!data?.slide) throw new Error('수정 실패');
      setDeck(prev => ({ ...prev, slides: prev.slides.map((s, i) => i === selectedSlideIdx ? data.slide : s) }));
      setReviseInput('');
      toast.success('슬라이드 수정 완료');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || '수정 실패');
    }
    setRevising(false);
  };

  const handleExport = async () => {
    if (!deck) return;
    setExporting(true);
    try {
      // 업로드 PPTX 테마가 있으면 그걸 사용, 없으면 선택한 내장 팔레트 사용
      const template = pptxThemeTemplate || getComposedTemplate(layoutId, templateId);
      const suffix = pptxThemeTemplate ? 'custom' : templateId;
      const fileName = `${(portfolio?.userName || 'portfolio').replace(/\s+/g, '_')}_AI_${suffix}.pptx`;
      await exportDeckToPptx(deck, template, fileName);
      toast.success('PPT 다운로드를 시작합니다');
    } catch (e) {
      toast.error(e.message || '내보내기 실패');
    }
    setExporting(false);
  };

  const handleCustomDownload = () => {
    if (!customResult?.pptxBase64) return;
    try {
      const binary = atob(customResult.pptxBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(portfolio?.userName || 'portfolio').replace(/\s+/g, '_')}_포트폴리오.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PPT 다운로드를 시작합니다');
    } catch (e) {
      toast.error('다운로드 실패: ' + e.message);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600" /></div>;
  if (!portfolio) return <p className="text-center py-20 text-gray-400">포트폴리오를 찾을 수 없습니다</p>;

  return (
    <div className="animate-fadeIn max-w-[1200px] mx-auto">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(autostart ? `/app/portfolio` : `/app/portfolio/preview/${id}`)} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft size={16} /> {autostart ? '포트폴리오 목록으로' : '뒤로'}
        </button>
      </div>

      {stage === STAGE.CHOOSE && (
        <ChooseStage
          layoutId={layoutId}
          setLayoutId={setLayoutId}
          templateId={templateId}
          setTemplateId={setTemplateId}
          customFileName={customFileName}
          fileInputRef={fileInputRef}
          onUpload={handleCustomUpload}
          onClearCustom={() => { setCustomFile(null); setCustomFileName(''); if (templateId === 'custom') setTemplateId('proposal'); }}
          onStart={startAnalyze}
        />
      )}

      {stage === STAGE.ANALYZING && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 size={48} className="animate-spin text-primary-600" />
          <div className="text-lg font-medium text-gray-700">
            {templateId === 'custom' ? '템플릿 디자인 분석 및 포트폴리오 내용 매핑 중…' : 'AI가 슬라이드를 구성 중…'}
          </div>
          <div className="text-sm text-gray-400">최대 60초 소요될 수 있습니다</div>
        </div>
      )}

      {stage === STAGE.PREVIEW && (
        <>
          {templateId === 'custom' && customResult ? (
            <CustomPreviewStage
              result={customResult}
              customFileName={customFileName}
              onDownload={handleCustomDownload}
              onRegenerate={() => { setCustomResult(null); setStage(STAGE.CHOOSE); }}
            />
          ) : deck ? (
            <PreviewStage
              deck={deck}
              template={pptxThemeTemplate || getComposedTemplate(layoutId, templateId)}
              portfolioId={id}
              selectedIdx={selectedSlideIdx}
              setSelectedIdx={setSelectedSlideIdx}
              reviseInput={reviseInput}
              setReviseInput={setReviseInput}
              revising={revising}
              onRevise={reviseSlide}
              onExport={handleExport}
              exporting={exporting}
              onRegenerate={() => { setDeck(null); setSelectedSlideIdx(null); setPptxThemeTemplate(null); setStage(STAGE.CHOOSE); }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

// ── 레이아웃 썸네일 미리보기 ─────────────────────────────────────────────
function LayoutThumb({ layoutId, colors }) {
  const ac = colors?.accent || '#FF4F1A';
  const dk = colors?.headBg || colors?.side || '#1F1D20';
  const bg = colors?.bg || '#F6F6F7';
  const card = colors?.card || '#FFFFFF';
  const line = colors?.line || '#E8E8EA';

  if (layoutId === 'standard') {
    return (
      <div className="w-full h-full p-2 flex flex-col gap-1" style={{ background: bg }}>
        <div className="w-full flex-shrink-0 h-[32%] rounded flex items-end px-2 pb-1.5 gap-1" style={{ background: dk }}>
          <div className="w-10 h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.7)' }} />
          <div className="w-6 h-1 rounded" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="flex gap-1 flex-1">
          {[0, 1].map(i => (
            <div key={i} className="flex-1 rounded p-1.5 flex flex-col gap-0.5" style={{ background: card, border: `1px solid ${line}` }}>
              <div className="w-full h-1 rounded" style={{ background: ac, opacity: 0.7 }} />
              <div className="w-3/4 h-1 rounded" style={{ background: line }} />
              <div className="w-full h-1 rounded" style={{ background: line }} />
              {i === 0 && <div className="w-5/6 h-1 rounded" style={{ background: line }} />}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (layoutId === 'narrative') {
    return (
      <div className="w-full h-full p-2 flex flex-col justify-between" style={{ background: dk }}>
        <div className="flex justify-between items-start">
          <div className="w-14 h-2 rounded" style={{ background: ac }} />
          <div className="w-7 h-1 rounded" style={{ background: 'rgba(255,255,255,0.3)' }} />
        </div>
        <div className="space-y-1">
          <div className="w-24 h-2 rounded" style={{ background: 'rgba(255,255,255,0.9)' }} />
          <div className="w-16 h-1 rounded" style={{ background: 'rgba(255,255,255,0.45)' }} />
        </div>
        <div className="grid grid-cols-4 gap-1 items-end">
          {[2, 3, 4, 5].map((h, i) => (
            <div key={i} className="rounded-t p-1" style={{ height: `${h * 12}px`, background: 'rgba(255,255,255,0.15)' }}>
              <div className="w-3 h-3 rounded-full mb-1" style={{ background: ac }} />
              <div className="w-full h-1 rounded" style={{ background: 'rgba(255,255,255,0.5)' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (layoutId === 'star') {
    return (
      <div className="w-full h-full p-2 grid grid-cols-2 gap-1.5" style={{ background: bg }}>
        {['S', 'T', 'A', 'R'].map((label, i) => (
          <div key={label} className="rounded-lg p-1.5" style={{ background: i === 3 ? ac : card, border: `1px solid ${i === 3 ? ac : line}` }}>
            <div className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold" style={{ background: i === 3 ? 'rgba(255,255,255,0.9)' : dk, color: i === 3 ? ac : '#FFFFFF' }}>{label}</div>
            <div className="mt-2 h-1 rounded" style={{ background: i === 3 ? 'rgba(255,255,255,0.8)' : line }} />
            <div className="mt-1 h-1 rounded w-2/3" style={{ background: i === 3 ? 'rgba(255,255,255,0.5)' : line }} />
          </div>
        ))}
      </div>
    );
  }
  if (layoutId === 'kpi-dashboard') {
    return (
      <div className="w-full h-full p-2 grid grid-cols-3 gap-1.5" style={{ background: '#0E1727' }}>
        <div className="col-span-2 rounded-lg p-2 flex flex-col justify-end" style={{ background: dk }}>
          <div className="w-16 h-4 rounded" style={{ background: 'rgba(255,255,255,0.9)' }} />
          <div className="w-10 h-1 rounded mt-1" style={{ background: 'rgba(255,255,255,0.4)' }} />
        </div>
        <div className="rounded-lg p-2 flex flex-col justify-end" style={{ background: ac }}>
          <div className="w-8 h-4 rounded" style={{ background: 'rgba(255,255,255,0.9)' }} />
        </div>
        <div className="rounded-lg p-1.5" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${ac}33` }}>
          <div className="w-full h-1 rounded mb-1" style={{ background: 'rgba(255,255,255,0.3)' }} />
          <div className="h-8 rounded" style={{ background: `linear-gradient(to top, ${ac}44, ${ac})` }} />
        </div>
        <div className="rounded-lg p-1.5 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${ac}33` }}>
          <div className="w-8 h-8 rounded-full border-4 mx-auto" style={{ borderColor: ac }} />
        </div>
        <div className="rounded-lg p-1.5 flex items-end gap-1" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${ac}33` }}>
          {[5, 8, 4].map((h, i) => <div key={i} className="flex-1 rounded-t" style={{ height: `${h * 4}px`, background: i % 2 ? ac : 'rgba(255,255,255,0.4)' }} />)}
        </div>
      </div>
    );
  }
  if (layoutId === 'timeline') {
    return (
      <div className="w-full h-full p-3 flex items-center" style={{ background: bg }}>
        <div className="relative w-full h-20">
          <div className="absolute left-2 right-2 top-1/2 border-t-2 border-dotted" style={{ borderColor: line }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="absolute -translate-x-1/2" style={{ left: `${10 + i * 27}%`, top: i % 2 ? 44 : 4 }}>
              <div className="w-8 h-8 rounded-full border-4 shadow" style={{ background: i === 2 ? ac : dk, borderColor: bg }} />
              <div className="w-12 h-1 rounded mt-1" style={{ background: line }} />
              <div className="w-8 h-1 rounded mt-1" style={{ background: line }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (layoutId === 'case-study') {
    return (
      <div className="w-full h-full p-2 grid grid-cols-[0.9fr_1.1fr] gap-2" style={{ background: bg }}>
        <div className="rounded-lg p-2 flex flex-col justify-between" style={{ background: dk }}>
          <div className="w-10 h-2 rounded" style={{ background: ac }} />
          <div>
            <div className="w-16 h-2 rounded" style={{ background: 'rgba(255,255,255,0.9)' }} />
            <div className="w-10 h-1 rounded mt-1" style={{ background: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
        <div className="grid grid-rows-3 gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-lg p-1.5" style={{ background: i === 2 ? ac : card, border: `1px solid ${i === 2 ? ac : line}` }}>
              <div className="w-10 h-1 rounded" style={{ background: i === 2 ? 'rgba(255,255,255,0.9)' : dk }} />
              <div className="w-full h-1 rounded mt-1" style={{ background: i === 2 ? 'rgba(255,255,255,0.55)' : line }} />
              <div className="w-2/3 h-1 rounded mt-1" style={{ background: i === 2 ? 'rgba(255,255,255,0.35)' : line }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// ── 템플릿 선택 화면 (2단계: 레이아웃 → 팔레트) ──────────────────────────
function ChooseStage({ layoutId, setLayoutId, templateId, setTemplateId, customFileName, fileInputRef, onUpload, onClearCustom, onStart }) {
  const [step, setStep] = useState('layout');
  const [hoveredPalette, setHoveredPalette] = useState(null);
  const selectedLayout = SLIDE_LAYOUTS.find(l => l.id === layoutId);
  const selectedPalette = COLOR_PALETTES.find(p => p.id === templateId);
  const paletteSwatches = COLOR_PALETTES.map(p => {
    const safeColors = getComposedTemplate(layoutId, p.id).colors;
    return {
      ...p,
      swatches: [safeColors.headBg, safeColors.accentOnBg || safeColors.accent, safeColors.neutral, safeColors.bg],
    };
  });

  // 실시간 미리보기: 호버 중인 팔레트 > 선택된 팔레트
  const previewId = hoveredPalette || templateId;
  const previewTemplate = getComposedTemplate(layoutId, previewId);
  const previewColors = previewTemplate.colors;
  const previewPalette = COLOR_PALETTES.find(p => p.id === previewId);
  const selectedPaletteColors = getComposedTemplate(layoutId, templateId).colors;

  const LAYOUT_SAMPLE_SLIDES = {
    'standard': { layout: 'cover', title: '홍길동', subtitle: '프론트엔드 개발자 · 3년차' },
    'narrative': { layout: 'narrative-cover', title: '홍길동', subtitle: '프론트엔드 개발자 · 3년차', sectionLabel: 'STORY PORTFOLIO' },
    'star': { layout: 'star-cover', title: '홍길동', subtitle: '프론트엔드 개발자 · 3년차', sectionLabel: 'STAT / STAR' },
    'kpi-dashboard': { layout: 'kpi-cover', title: '홍길동', subtitle: 'AI · 풀스택 개발자', sectionLabel: 'PERFORMANCE DASHBOARD' },
    'timeline': { layout: 'timeline-cover', title: '홍길동', subtitle: '성장 곡선을 숫자로 증명합니다', sectionLabel: 'TIMELINE' },
    'case-study': { layout: 'cs-cover', title: '사용자 경험을 기술로 설계하는\n프론트엔드 개발자, 홍길동', subtitle: '단순 구현을 넘어 최적의 의사결정으로 문제를 해결합니다.', sectionLabel: 'TECHNICAL CASE STUDY', bullets: ['홍길동', '프론트엔드'] },
  };
  const SAMPLE_SLIDE = LAYOUT_SAMPLE_SLIDES[layoutId] || LAYOUT_SAMPLE_SLIDES['standard'];
  const PREVIEW_W = 540;

  // ── 팔레트 선택 단계 ────────────────────────────────────────────────────
  if (step === 'palette') {
    return (
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('layout')} className="p-2 rounded-lg hover:bg-surface-100 text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">색상 팔레트를 선택하세요</h2>
            <p className="text-sm text-gray-400 mt-0.5">레이아웃: <span className="font-medium text-gray-600">{selectedLayout?.name}</span></p>
          </div>
        </div>

        {/* 2-column: 스워치 + 실시간 미리보기 */}
        <div className="flex gap-8 items-start">
          {/* Left: 팔레트 스워치 */}
          <div className="flex-shrink-0 w-52 space-y-3">
            <p className="text-xs font-medium text-gray-400">팔레트 — 마우스를 올리면 미리보기</p>
            <div className="flex flex-wrap gap-2">
              {paletteSwatches.map(p => (
                <div key={p.id} className="relative group">
                  <button
                    onClick={() => setTemplateId(p.id)}
                    onMouseEnter={() => setHoveredPalette(p.id)}
                    onMouseLeave={() => setHoveredPalette(null)}
                    className={`flex items-center gap-0.5 p-1.5 rounded-xl border-2 transition-all duration-150 ${
                      templateId === p.id
                        ? 'border-primary-500 shadow-sm scale-105'
                        : 'border-transparent hover:border-surface-300 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {p.swatches.map((c, i) => (
                      <span
                        key={i}
                        style={{ background: c, width: 13, height: 13, borderRadius: 3, display: 'inline-block', border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}
                      />
                    ))}
                  </button>
                  {/* 호버 툴팁 */}
                  <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 hidden group-hover:block bg-gray-900 text-white text-xs px-3 py-2 rounded-xl shadow-2xl" style={{ minWidth: 160 }}>
                    <div className="font-semibold text-white">{p.name}</div>
                    <div className="text-gray-400 mt-0.5 text-[10px] leading-snug">{p.description}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 선택된 팔레트 정보 */}
            {selectedPalette && (
              <div className="mt-3 px-3 py-2.5 bg-surface-50 rounded-xl border border-surface-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Check size={11} className="text-primary-500" />
                  <span className="text-xs font-semibold text-gray-700">{selectedPalette.name}</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">{selectedPalette.description}</p>
              </div>
            )}

            {/* PPTX 직접 업로드 */}
            <div className="pt-1">
              <p className="text-xs font-medium text-gray-400 mb-1.5">또는 PPTX 직접 업로드</p>
              <input ref={fileInputRef} type="file" accept=".pptx" className="hidden" onChange={e => onUpload(e.target.files?.[0])} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-surface-300 rounded-lg text-xs font-medium hover:bg-surface-50 transition-colors"
              >
                <Upload size={12} /> 파일 선택
              </button>
              {customFileName && (
                <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-surface-200 rounded-lg text-xs">
                  <Check size={10} className="text-green-500" />
                  <span className="truncate text-gray-600 flex-1">{customFileName}</span>
                  <button onClick={onClearCustom} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={10} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Right: 실시간 슬라이드 미리보기 */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-gray-400">
                미리보기 — <span className="font-semibold" style={{ color: previewColors?.accent || '#FF4F1A' }}>{previewPalette?.name}</span>
              </p>
              <div className="flex gap-1">
                {[previewColors?.headBg, previewColors?.accent, previewColors?.bg].filter(Boolean).map((c, i) => (
                  <span key={i} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: c, border: '1px solid rgba(0,0,0,0.12)' }} />
                ))}
              </div>
            </div>
            <div
              style={{
                width: PREVIEW_W,
                height: Math.round(PREVIEW_W * 9 / 16),
                overflow: 'hidden',
                borderRadius: 12,
                boxShadow: `0 4px 24px rgba(0,0,0,0.15)`,
                border: `2px solid ${previewColors?.accent || 'rgba(0,0,0,0.07)'}44`,
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              <SlidePreview
                slide={SAMPLE_SLIDE}
                template={previewTemplate}
                scale={PREVIEW_W / 960}
                index={0}
              />
            </div>
            <p className="text-[10px] text-gray-400">커버 슬라이드 미리보기 · 팔레트에 마우스를 올리면 실시간으로 바뀝니다</p>
          </div>
        </div>

        {/* 생성 버튼 */}
        <div className="flex justify-between items-center pt-2">
          <div className="text-sm text-gray-500">
            선택: <span className="font-semibold text-gray-700">{selectedLayout?.name}</span>
            <span className="mx-2 text-gray-300">+</span>
            <span className="font-semibold text-gray-700">{customFileName || selectedPalette?.name}</span>
          </div>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 shadow-sm transition-all"
          >
            AI로 PPT 생성하기 <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── 레이아웃 선택 단계 ──────────────────────────────────────────────────
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">슬라이드 구성 방식을 선택하세요</h2>
        <p className="text-sm text-gray-500">6가지 레이아웃 중 하나를 고르면 AI가 그 구조에 맞게 내용을 생성합니다. 이후 색상 팔레트를 선택할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {SLIDE_LAYOUTS.map(layout => (
          <button
            key={layout.id}
            onClick={() => layout.available && setLayoutId(layout.id)}
            disabled={!layout.available}
            className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
              !layout.available
                ? 'cursor-not-allowed border-surface-100 bg-surface-50 opacity-60'
                : layoutId === layout.id
                  ? 'border-primary-500 bg-primary-50/30'
                  : 'border-surface-200 hover:border-surface-300 bg-white'
            }`}
          >
            {/* 썸네일 */}
            <div className="w-full h-32 rounded-lg mb-3 bg-gray-50 border border-surface-200 overflow-hidden flex items-center justify-center">
              {layout.available
                ? <LayoutThumb layoutId={layout.id} colors={selectedPaletteColors} />
                : <Lock size={22} className="text-gray-300" />
              }
            </div>

            {/* 태그 */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-800">{layout.name}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                layout.available ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-200 text-gray-400'
              }`}>
                {layout.tag}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-snug">{layout.description}</p>

            {layoutId === layout.id && layout.available && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 font-medium">
                <Check size={11} /> 선택됨
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setStep('palette')}
          disabled={!SLIDE_LAYOUTS.find(l => l.id === layoutId)?.available}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          다음: 색상 팔레트 선택 <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── 템플릿 1/2/3 미리보기 (Notion 스타일 슬라이드) ───────────────────────
function PreviewStage({ deck, template, portfolioId, selectedIdx, setSelectedIdx, reviseInput, setReviseInput, revising, onRevise, onExport, exporting, onRegenerate }) {
  const slides = deck.slides || [];
  const [showClickGuide, setShowClickGuide] = useState(true);

  const handleSlideClick = (index) => {
    setShowClickGuide(false);
    setSelectedIdx(selectedIdx === index ? null : index);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">생성된 내용 확인 ({slides.length}장)</h2>
          <p className="text-sm text-gray-500 mt-1">슬라이드를 클릭하면 수정을 요청할 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRegenerate} className="inline-flex items-center gap-2 px-4 py-2 border border-surface-200 rounded-xl text-sm text-gray-600 hover:bg-surface-50">
            <RefreshCw size={14} /> 다시 생성
          </button>
          <button
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold hover:from-red-600 hover:to-red-700 disabled:opacity-50 shadow-md"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            PPT로 추출하기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {slides.map((slide, i) => (
          <SlideCard
            key={slide.id || i}
            slide={slide}
            template={template}
            index={i}
            selected={selectedIdx === i}
            showClickGuide={showClickGuide && i === 0}
            onClick={() => handleSlideClick(i)}
          />
        ))}
      </div>

      {selectedIdx !== null && slides[selectedIdx] && (
        <div className="fixed bottom-6 right-6 left-6 lg:left-auto lg:w-[460px] bg-white border border-surface-200 rounded-2xl shadow-xl p-5 z-30">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-primary-600 font-medium">슬라이드 {selectedIdx + 1} 수정 요청</div>
              <div className="text-sm font-semibold text-gray-800 mt-0.5">{slides[selectedIdx].title}</div>
            </div>
            <button onClick={() => setSelectedIdx(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <textarea
            value={reviseInput}
            onChange={e => setReviseInput(e.target.value)}
            placeholder="예: 글자 더 크게, 첫 번째 경험을 강조해줘, 수치를 더 부각시켜"
            rows={3}
            className="w-full text-sm border border-surface-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={onRevise}
              disabled={revising || !reviseInput.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {revising ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              AI에게 수정 요청
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SlideCard({ slide, template, index, selected, showClickGuide, onClick }) {
  const containerW = 540;
  const scale = containerW / 960;
  return (
    <button
      onClick={onClick}
      className={`relative isolate block text-left bg-white rounded-xl border-2 overflow-visible transition-all hover:-translate-y-0.5 ${selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-surface-200'} ${showClickGuide ? 'animate-ppt-slide-guide' : ''}`}
      style={{ width: '100%' }}
    >
      <div className="overflow-hidden rounded-[10px] bg-white">
        <div style={{ width: '100%', height: 540 * scale, position: 'relative', overflow: 'hidden' }}>
          <SlidePreview slide={slide} template={template} index={index} scale={scale} />
        </div>
        <div className="px-4 py-2 border-t border-surface-100 flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600">{index + 1}. {slide.title}</span>
          <span className="text-gray-400">{slide.layout}</span>
        </div>
      </div>
      {showClickGuide && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[10px] bg-primary-900/10">
          <div className="animate-ppt-guide-card flex items-center gap-3 rounded-2xl border border-primary-100 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm">
            <MousePointerClick size={25} className="animate-ppt-pointer-tap shrink-0 text-primary-600" />
            <div>
              <div className="text-sm font-bold text-gray-800">슬라이드를 클릭해보세요</div>
              <div className="mt-0.5 text-xs font-medium text-gray-500">원하는 부분을 AI에게 수정 요청할 수 있어요</div>
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

// ── 커스텀 템플릿 미리보기 (실제 PPT 화면과 동일) ────────────────────────
function CustomPreviewStage({ result, customFileName, onDownload, onRegenerate }) {
  const { deck, slideSize, layoutSlides } = result;
  const W = slideSize?.widthPt || 720;
  const H = slideSize?.heightPt || 540;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">미리보기 — {customFileName}</h2>
          <p className="text-sm text-gray-500 mt-1">업로드한 템플릿 디자인에 포트폴리오 내용이 채워진 모습입니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRegenerate} className="inline-flex items-center gap-2 px-4 py-2 border border-surface-200 rounded-xl text-sm text-gray-600 hover:bg-surface-50">
            <RefreshCw size={14} /> 다시 생성
          </button>
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold hover:from-red-600 hover:to-red-700 shadow-md"
          >
            <Download size={16} />
            PPT 다운로드
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {deck.map((slidePlan, i) => {
          const layoutSlide = layoutSlides?.find(s => s.index === slidePlan.templateSlideIndex) || {};
          return (
            <CustomSlideCard
              key={i}
              slidePlan={slidePlan}
              layoutSlide={layoutSlide}
              slideW={W}
              slideH={H}
              index={i}
            />
          );
        })}
      </div>
    </div>
  );
}

function hexLuma(hex) {
  if (!hex) return 1;
  const m = String(hex).replace('#', '');
  if (m.length !== 6) return 1;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function findCoveringDecor(box, decorList) {
  const ax2 = box.x + box.w, ay2 = box.y + box.h;
  const area = box.w * box.h;
  if (area <= 0) return null;
  let best = null, bestOv = 0;
  for (const d of decorList) {
    if (!d.fill) continue;
    const ow = Math.max(0, Math.min(ax2, d.x + d.w) - Math.max(box.x, d.x));
    const oh = Math.max(0, Math.min(ay2, d.y + d.h) - Math.max(box.y, d.y));
    const ov = ow * oh;
    if (ov > bestOv && ov >= area * 0.4) { bestOv = ov; best = d; }
  }
  return best;
}

function autoTextColor(bgHex, origColor) {
  const luma = hexLuma(bgHex);
  if (origColor) {
    const fgLuma = hexLuma(origColor);
    if (Math.abs(luma - fgLuma) > 0.35) return origColor;
  }
  return luma < 0.5 ? '#FFFFFF' : '#1F2937';
}

function fitFontSize(text, basePt, boxW, boxH) {
  if (!text || !boxW || !boxH) return basePt || 12;
  const charW = 0.55, lineH = 1.3;
  const inner = Math.max(8, boxW - 8);
  let pt = basePt || 14;
  for (let i = 0; i < 12; i++) {
    const cpl = Math.max(1, Math.floor(inner / (pt * charW)));
    const lines = String(text).split(/\r?\n/).reduce((acc, ln) => acc + Math.max(1, Math.ceil((ln.length || 1) / cpl)), 0);
    if (lines * pt * lineH <= Math.max(8, boxH - 8)) break;
    pt *= 0.9;
    if (pt < 6) { pt = 6; break; }
  }
  return pt;
}

function CustomSlideCard({ slidePlan, layoutSlide, slideW, slideH, index }) {
  const containerW = 520;
  const scale = containerW / slideW;
  const bgColor = layoutSlide.bg || '#FFFFFF';
  const decor = (layoutSlide.decor || []).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const pics = (layoutSlide.pics || []).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const texts = (slidePlan.boxes || []).filter(b => b.text);

  return (
    <div className="block bg-white rounded-xl border-2 border-surface-200 overflow-hidden" style={{ width: '100%' }}>
      <div style={{ width: '100%', height: slideH * scale, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: slideW, height: slideH, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative', background: bgColor }}>
          {decor.map((d, i) => (
            <div
              key={`d-${i}`}
              style={{
                position: 'absolute', left: d.x, top: d.y, width: d.w, height: d.h,
                background: d.fill || undefined,
                border: d.lineColor && d.lineWidthPt > 0 ? `${Math.max(0.5, d.lineWidthPt)}px solid ${d.lineColor}` : undefined,
                zIndex: d.zIndex || 1,
              }}
            />
          ))}
          {pics.map((p, i) => (
            <img
              key={`p-${i}`}
              src={p.dataUrl}
              alt=""
              onError={e => { e.currentTarget.style.display = 'none'; }}
              style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, objectFit: 'cover', zIndex: p.zIndex || 5 }}
            />
          ))}

          {texts.map((box, i) => {
            const cover = findCoveringDecor({ x: box.x, y: box.y, w: box.w, h: box.h }, decor);
            const effectiveBg = cover?.fill || bgColor;
            const color = autoTextColor(effectiveBg, box.color);
            const fontSize = fitFontSize(box.text, box.fontPt, box.w, box.h);
            return (
              <div
                key={`t-${i}`}
                style={{
                  position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h,
                  fontSize, color,
                  fontWeight: box.bold ? 700 : 400,
                  fontFamily: box.fontFace || 'Pretendard, "Malgun Gothic", sans-serif',
                  lineHeight: 1.3,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
                  padding: 4,
                  zIndex: 20,
                }}
              >
                {box.text}
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-2 border-t border-surface-100 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">{index + 1}. {slidePlan.sectionType}</span>
        <span className="text-gray-400">{texts.length}개 텍스트</span>
      </div>
    </div>
  );
}
