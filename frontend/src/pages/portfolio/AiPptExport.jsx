import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Wand2, Download, Upload, X, Check, RefreshCw, Lock, ChevronRight, MousePointerClick, FileDown, CheckCircle2, Eye } from 'lucide-react';
import { doc, getDoc } from '../../services/firestoreProxy';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import api from '../../services/api';
import { getComposedTemplate, SlidePreview, exportDeckToPptx, prepareDeckForExport, analyzeDeckQuality, COLOR_PALETTES, SLIDE_LAYOUTS } from './aiPptTemplates';
import PptExtractModal from '../../components/PptExtractModal';

const STAGE = { CHOOSE: 'choose', ANALYZING: 'analyzing', PREVIEW: 'preview' };
const DEFAULT_LAYOUT_ID = SLIDE_LAYOUTS[0]?.id || 'narrative';

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
  const initTemplateIsLayout = layoutIds.includes(initTemplateParam);
  const initLayout = initLayoutParam || (initTemplateIsLayout ? initTemplateParam : DEFAULT_LAYOUT_ID);
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
  // Custom template state — 인플레이스(디자인 보존) 매핑 결과
  const [customResult, setCustomResult] = useState(null); // { pptxBase64, deck, slideSize, layoutSlides }
  const [pptxThemeTemplate, setPptxThemeTemplate] = useState(null); // (구버전 테마 추출 경로 잔존)
  const fileInputRef = useRef(null);

  const autoStartFiredRef = useRef(false);
  const [layoutId, setLayoutId] = useState(initLayout);
  // 내보내기 형식: 가로형(PPT 슬라이드) | 세로형(PDF 문서)
  const [exportFormat, setExportFormat] = useState('ppt');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);
  // 직접 템플릿 업로드하기 — 업로드 PPT 디자인 기반 자체 조립(PPT 추출) 모달
  const [showPptExtractModal, setShowPptExtractModal] = useState(false);

  // 세로형 PDF: 합격자 스타일 A4 문서로 즉시 생성·다운로드 (업로드·AI 불필요)
  const handlePdfExport = async () => {
    if (!portfolio || pdfExporting) return;
    setPdfExporting(true);
    setPdfDone(false);
    try {
      const { data } = await api.post('/export/portfolio-pdf', { portfolio }, { timeout: 120000 });
      if (!data?.pdfBase64) throw new Error(data?.message || 'PDF 생성에 실패했습니다');
      const binary = atob(data.pdfBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(portfolio?.userName || 'portfolio').replace(/\s+/g, '_')}_포트폴리오.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPdfDone(true);
      toast.success('PDF 다운로드를 시작합니다');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'PDF 생성에 실패했습니다';
      toast.error(msg);
    }
    setPdfExporting(false);
  };

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
        // 인플레이스 방식: 업로드한 PPTX 원본의 디자인(배경·도형·이미지·폰트·배치)을
        // 그대로 두고 텍스트 박스에 포트폴리오 내용만 채워 넣는다. (사용자 요구:
        // "업로드한 템플릿의 디자인을 기반으로" — 색·폰트만 추출하는 방식은 부족)
        const form = new FormData();
        form.append('template', customFile);
        form.append('portfolio', JSON.stringify(portfolio));
        const { data } = await api.post('/export/ppt', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 600000,
        });
        if (!data?.deck?.length || !data?.pptxBase64) throw new Error('템플릿 매핑 실패');
        setPptxThemeTemplate(null);
        setCustomResult(data);
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
      const preparedDeck = prepareDeckForExport(deck);
      const quality = analyzeDeckQuality(preparedDeck);
      setDeck(preparedDeck);
      if (!quality.passed) toast(`자동 보정 후에도 ${quality.warnings.length}개 항목을 확인해 주세요.`);
      // 업로드 PPTX 테마가 있으면 그걸 사용, 없으면 선택한 내장 팔레트 사용
      const template = pptxThemeTemplate || getComposedTemplate(layoutId, templateId);
      const suffix = pptxThemeTemplate ? 'custom' : templateId;
      const fileName = `${(portfolio?.userName || 'portfolio').replace(/\s+/g, '_')}_AI_${suffix}.pptx`;
      const exportResult = await exportDeckToPptx(preparedDeck, template, fileName);
      if (exportResult?.imageWarnings?.length) {
        toast(`이미지 ${exportResult.imageWarnings.length}개를 불러오지 못해 디자인 카드로 대체했습니다.`);
      }
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
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          onPdfExport={handlePdfExport}
          pdfExporting={pdfExporting}
          pdfDone={pdfDone}
          onOpenPptExtract={() => setShowPptExtractModal(true)}
        />
      )}

      {showPptExtractModal && (
        <PptExtractModal portfolio={portfolio} onClose={() => setShowPptExtractModal(false)} />
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

// ── 레이아웃 카드 미리보기 — 실제 슬라이드(960×540)를 컨테이너 폭에 맞춰 축소 렌더 ──
function LayoutPreviewThumb({ template, sampleSlide, index = 0 }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.33);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => { if (el.clientWidth) setScale(el.clientWidth / 960); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
      <div style={{ position: 'absolute', top: 0, left: 0 }}>
        <SlidePreview slide={sampleSlide} template={template} scale={scale} index={index} />
      </div>
    </div>
  );
}

// ── 템플릿 선택 화면 (형식 선택 → 레이아웃 → 팔레트) ─────────────────────
function ChooseStage({ layoutId, setLayoutId, templateId, setTemplateId, customFileName, fileInputRef, onUpload, onClearCustom, onStart, exportFormat, setExportFormat, onPdfExport, pdfExporting, pdfDone, onOpenPptExtract }) {
  const [step, setStep] = useState('layout');
  const [hoveredPalette, setHoveredPalette] = useState(null);
  const [previewLayoutId, setPreviewLayoutId] = useState(null);
  const [previewDeck, setPreviewDeck] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 디자인 미리보기: 고정 샘플로 결정적(비-AI) 덱을 받아 레이아웃 디자인만 보여준다.
  const openLayoutPreview = async (id) => {
    setPreviewLayoutId(id);
    setPreviewDeck(null);
    setPreviewLoading(true);
    try {
      const { data } = await api.post('/portfolio/ppt-preview-deck', {
        templateHint: `${id}:${templateId}`,
      });
      setPreviewDeck(data?.deck?.slides || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || '미리보기를 불러오지 못했습니다');
      setPreviewDeck([]);
    }
    setPreviewLoading(false);
  };
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
                    <div className="text-gray-400 mt-0.5 text-[11.5px] leading-snug">{p.description}</div>
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
                <p className="text-[11.5px] text-gray-400 leading-snug">{selectedPalette.description}</p>
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
              <p className="mt-1.5 text-[11.5px] text-gray-400 leading-snug">
                업로드한 PPT의 디자인(배경·도형·이미지·폰트)을 그대로 유지하고 내용만 채웁니다.
              </p>
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
            <p className="text-[11.5px] text-gray-400">커버 슬라이드 미리보기 · 팔레트에 마우스를 올리면 실시간으로 바뀝니다</p>
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

  // ── 형식 선택(가로형 PPT / 세로형 PDF) + 레이아웃 선택 단계 ─────────────
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">내보내기 형식을 선택하세요</h2>
        <p className="text-sm text-gray-500">발표용 가로형 PPT 슬라이드, 또는 제출용 세로형 PDF 문서로 만들 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-[680px]">
        <button
          onClick={() => setExportFormat('ppt')}
          className={`flex items-center gap-4 text-left rounded-2xl border-2 p-4 transition-all ${
            exportFormat === 'ppt' ? 'border-primary-500 bg-primary-50/30' : 'border-surface-200 hover:border-surface-300 bg-white'
          }`}
        >
          <div className={`w-14 h-9 rounded-md border-2 grid place-items-center flex-shrink-0 text-[10.5px] font-bold ${
            exportFormat === 'ppt' ? 'border-primary-500 text-primary-600' : 'border-surface-300 text-gray-400'
          }`}>16:9</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">가로형 · PPT 슬라이드</span>
              {exportFormat === 'ppt' && <Check size={13} className="text-primary-600" />}
            </div>
            <p className="text-xs text-gray-500 leading-snug mt-0.5">발표용 슬라이드. 레이아웃·색상을 고르거나 내 PPT 템플릿을 업로드해 만듭니다.</p>
          </div>
        </button>
        <button
          onClick={() => setExportFormat('pdf')}
          className={`flex items-center gap-4 text-left rounded-2xl border-2 p-4 transition-all ${
            exportFormat === 'pdf' ? 'border-rose-500 bg-rose-50/30' : 'border-surface-200 hover:border-surface-300 bg-white'
          }`}
        >
          <div className={`w-9 h-12 rounded-md border-2 grid place-items-center flex-shrink-0 text-[10.5px] font-bold ${
            exportFormat === 'pdf' ? 'border-rose-500 text-rose-600' : 'border-surface-300 text-gray-400'
          }`}>A4</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">세로형 · PDF 문서</span>
              {exportFormat === 'pdf' && <Check size={13} className="text-rose-600" />}
            </div>
            <p className="text-xs text-gray-500 leading-snug mt-0.5">제출용 A4 문서. 포트폴리오 전체 내용을 합격자 스타일로 정리해 바로 다운로드합니다.</p>
          </div>
        </button>
      </div>

      {exportFormat === 'pdf' ? (
        <div className="max-w-[680px] space-y-4">
          <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">세로형 PDF에 담기는 내용</p>
            <ul className="text-[13px] text-gray-500 leading-relaxed list-disc pl-5 space-y-1">
              <li>표지 — 이름 · 지원 목표 · 핵심 기술 · 연락처</li>
              <li>소개 · 가치관 · 기술 역량</li>
              <li>프로젝트별 문제 정의 → 역할 → 과정 → 성과(수치 강조) + 지표 카드</li>
              <li>학력 · 수상 · 활동 · 목표와 계획</li>
            </ul>
            <p className="text-[12px] text-gray-400 mt-3">포트폴리오에 작성된 내용이 그대로 들어갑니다. 업로드나 추가 설정 없이 약 10초 안에 완성됩니다.</p>
          </div>
          {pdfDone && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} /> PDF 다운로드가 시작되었습니다. 다운로드 폴더를 확인하세요.
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={onPdfExport}
              disabled={pdfExporting}
              className="inline-flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              {pdfExporting
                ? <><Loader2 size={16} className="animate-spin" /> PDF 생성 중…</>
                : <><FileDown size={16} /> 세로형 PDF 만들기</>}
            </button>
          </div>
        </div>
      ) : (
      <>
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
            {/* 썸네일 — 실제 커버 슬라이드 디자인 미리보기 + 확대 미리보기 버튼 */}
            <div className="relative w-full rounded-lg mb-3 bg-gray-50 border border-surface-200 overflow-hidden">
              {layout.available
                ? <LayoutPreviewThumb template={getComposedTemplate(layout.id, templateId)} sampleSlide={LAYOUT_SAMPLE_SLIDES[layout.id] || LAYOUT_SAMPLE_SLIDES.standard} />
                : <div className="aspect-[16/9] flex items-center justify-center"><Lock size={22} className="text-gray-300" /></div>
              }
              {layout.available && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); openLayoutPreview(layout.id); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); openLayoutPreview(layout.id); } }}
                  className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur border border-surface-200 rounded-md text-[12px] font-medium text-gray-600 hover:text-primary-600 hover:border-primary-300 shadow-sm cursor-pointer transition-colors"
                >
                  <Eye size={11} /> 미리보기
                </span>
              )}
            </div>

            {/* 태그 */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-800">{layout.name}</span>
              <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-medium ${
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

      <div className="flex justify-between items-center gap-3">
        <button
          onClick={onOpenPptExtract}
          className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-surface-300 text-gray-700 rounded-xl font-semibold hover:bg-surface-50 hover:border-surface-400 transition-colors"
        >
          <Upload size={16} /> 직접 템플릿 업로드하기
        </button>
        <button
          onClick={() => setStep('palette')}
          disabled={!SLIDE_LAYOUTS.find(l => l.id === layoutId)?.available}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          다음: 색상 팔레트 선택 <ChevronRight size={16} />
        </button>
      </div>

      {/* 레이아웃 확대 미리보기 모달 — 실제 포트폴리오 내용으로 전체 구성을 보여줌 */}
      {previewLayoutId && (() => {
        const pl = SLIDE_LAYOUTS.find(l => l.id === previewLayoutId);
        const previewTmpl = getComposedTemplate(previewLayoutId, templateId);
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setPreviewLayoutId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full mx-4 max-h-[92vh] overflow-hidden border border-surface-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-surface-50/60">
                <div>
                  <h3 className="font-bold text-[17px] text-gray-800">
                    {pl?.name}
                    {pl?.tag && <span className="ml-2 text-xs font-medium text-gray-400">· {pl.tag}</span>}
                    {previewDeck && <span className="ml-2 text-xs font-medium text-gray-400">· 총 {previewDeck.length}장</span>}
                  </h3>
                  <p className="text-[12px] text-gray-400 mt-0.5">샘플 내용으로 보여주는 레이아웃 디자인 예시입니다 · 실제 내용은 생성 시 채워집니다</p>
                </div>
                <button onClick={() => setPreviewLayoutId(null)} className="p-2 hover:bg-surface-100 rounded-lg transition-colors">
                  <X size={17} className="text-gray-400" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(92vh-150px)] bg-surface-50/40">
                {previewLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
                    <Loader2 size={28} className="animate-spin text-primary-500" />
                    <span className="text-sm">디자인을 불러오는 중…</span>
                  </div>
                ) : previewDeck && previewDeck.length ? (
                  <div className="grid grid-cols-2 gap-4">
                    {previewDeck.map((s, i) => (
                      <div key={s.id || i} className="rounded-lg border border-surface-200 overflow-hidden shadow-sm bg-white">
                        <LayoutPreviewThumb template={previewTmpl} sampleSlide={s} index={i} />
                        <div className="px-3 py-1.5 border-t border-surface-100 flex items-center justify-between text-[12px]">
                          <span className="font-medium text-gray-500 truncate">{i + 1}. {s.title || s.sectionLabel || '슬라이드'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-24 text-sm text-gray-400">미리보기를 불러오지 못했습니다</div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-surface-200 bg-surface-50/60 flex items-center justify-between gap-3">
                <p className="text-[13px] text-gray-400">색상 팔레트는 다음 단계에서 변경할 수 있습니다</p>
                <button
                  onClick={() => { setLayoutId(previewLayoutId); setPreviewLayoutId(null); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-[14px] font-bold hover:bg-primary-700 transition-colors"
                >
                  <Check size={15} /> 이 레이아웃 선택
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      </>
      )}
    </div>
  );
}

// ── 템플릿 1/2/3 미리보기 (Notion 스타일 슬라이드) ───────────────────────
function PreviewStage({ deck, template, portfolioId, selectedIdx, setSelectedIdx, reviseInput, setReviseInput, revising, onRevise, onExport, exporting, onRegenerate }) {
  const slides = deck.slides || [];
  const quality = analyzeDeckQuality(deck);
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

      <div className={`rounded-xl border px-4 py-3 ${quality.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className={`text-sm font-semibold ${quality.passed ? 'text-emerald-700' : 'text-amber-800'}`}>
          {quality.passed ? '가독성 검사 통과' : `가독성 확인 필요 ${quality.warnings.length}건`}
        </div>
        {!quality.passed && (
          <div className="mt-2 space-y-1 text-xs text-amber-700">
            {quality.warnings.slice(0, 6).map((warning, index) => (
              <div key={`${warning.slide}-${warning.type}-${index}`}>슬라이드 {warning.slide}: {warning.message}</div>
            ))}
          </div>
        )}
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
