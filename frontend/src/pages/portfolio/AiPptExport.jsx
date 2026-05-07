import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Wand2, Download, Upload, X, Check, Sparkles, RefreshCw } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import api from '../../services/api';
import { TEMPLATES, getTemplate, SlidePreview, exportDeckToPptx, buildCustomTemplateFromTokens } from './aiPptTemplates';
import { extractDirectTemplateFromFile, directTemplateSpecToText, analyzeAndPreviewTemplate, fillUploadedPptxTemplate } from '../../utils/directTemplate';

const STAGE = { CHOOSE: 'choose', ANALYZING: 'analyzing', PREVIEW: 'preview' };

export default function AiPptExport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(STAGE.CHOOSE);
  const [templateId, setTemplateId] = useState('modern');
  const [customTemplate, setCustomTemplate] = useState(null); // { title, outline, sections, designTokens }
  const [customFileName, setCustomFileName] = useState('');
  const [deck, setDeck] = useState(null);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(null);
  const [reviseInput, setReviseInput] = useState('');
  const [revising, setRevising] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'portfolios', id));
        if (snap.exists()) setPortfolio({ id: snap.id, ...snap.data() });
      } catch { toast.error('포트폴리오를 불러오지 못했습니다'); }
      setLoading(false);
    })();
  }, [id]);

  const handleCustomUpload = async (file) => {
    if (!file) return;
    const loadingId = toast.loading('템플릿 분석 중...');
    try {
      const spec = await extractDirectTemplateFromFile(file);
      let designTokens = spec.designTokens || null;

      // Gemini 2.5 Pro Vision으로 썸네일 직접 분석 — 색상/레이아웃 정확도 ↑
      if (designTokens?.thumbnailBase64) {
        try {
          const { data } = await api.post('/portfolio/analyze-template-design', {
            thumbnailBase64: designTokens.thumbnailBase64,
            mimeType: 'image/jpeg',
          });
          if (data?.tokens) {
            designTokens = { ...designTokens, ...data.tokens };
            console.log('[Vision] 토큰', data.tokens);
          }
        } catch (visionErr) {
          console.warn('[Vision] 분석 실패, XML 추출 토큰 사용:', visionErr?.message);
        }
      }

      setCustomTemplate({
        title: spec.title || file.name,
        outline: directTemplateSpecToText(spec),
        sections: spec.sections || [],
        designTokens,
        arrayBuffer: spec.arrayBuffer,
      });
      setCustomFileName(file.name);
      setTemplateId('custom');
      toast.dismiss(loadingId);
      toast.success(designTokens
        ? `템플릿 분석 완료 (액센트 ${designTokens.accent}, ${designTokens.layoutHint || '?'})`
        : '템플릿 분석 완료');
    } catch (e) {
      toast.dismiss(loadingId);
      toast.error(e.message || '템플릿 분석 실패');
    }
  };

  const startAnalyze = async () => {
    if (!portfolio) return;
    setStage(STAGE.ANALYZING);
    try {
      if (templateId === 'custom' && customTemplate?.arrayBuffer) {
        // 커스텀 템플릿(레고 아키텍처):
        //   1) 템플릿 슬라이드 분류 → 2) 포트폴리오 기반 플랜 → 3) PPTX 슬라이드 복제/삭제 →
        //   4) 재구성된 zip 에서 AI 매핑 → 디자인은 100% 보존된 상태로 슬라이드 개수가 사용자에 맞춰짐.
        const result = await analyzeAndPreviewTemplate(
          customTemplate.arrayBuffer,
          portfolio,
          customTemplate.outline,
          customTemplate.designTokens,
        );
        const { slides: mappedSlides, materializedArrayBuffer, plan, classifications, contentPack } = result;
        setDeck({
          isCustomMapped: true,
          slides: mappedSlides,
          materializedArrayBuffer,
          plan,
          classifications,
          contentPack,
        });
        setStage(STAGE.PREVIEW);
      } else {
        const { data } = await api.post('/portfolio/ai-ppt-analyze', {
          portfolioId: id,
          templateHint: templateId,
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
      const next = { ...deck, slides: deck.slides.map((s, i) => (i === selectedSlideIdx ? data.slide : s)) };
      setDeck(next);
      setReviseInput('');
      toast.success('슬라이드 수정 완료');
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || '수정 실패');
    }
    setRevising(false);
  };

  // 발표자 정보(템플릿 하단 바용) — 학과/학번을 education에서 추출
  const presenter = portfolio ? (() => {
    const name = portfolio.userName || '';
    const edu = (portfolio.education || [])[0] || {};
    const major = edu.major || edu.degree || '';
    const studentId = portfolio.studentId || edu.studentId || '';
    const affiliation = [major, studentId].filter(Boolean).join(' ') || edu.school || '';
    return { name, affiliation };
  })() : {};

  // custom이면 항상 buildCustomTemplateFromTokens 사용 (토큰 없으면 기본 블루로 폴백)
  const activeTemplate = templateId === 'custom'
    ? buildCustomTemplateFromTokens(customTemplate?.designTokens || null, customFileName, presenter)
    : getTemplate(templateId);

  const handleExport = async () => {
    if (!deck) return;
    setExporting(true);
    try {
      if (templateId === 'custom' && customTemplate?.arrayBuffer && deck.isCustomMapped) {
        await fillUploadedPptxTemplate(
          customTemplate.arrayBuffer,
          portfolio,
          customTemplate.outline,
          deck.slides,
          customTemplate.designTokens,
          deck.materializedArrayBuffer,
          deck.contentPack,
        );
        toast.success('PPT 다운로드를 시작합니다');
      } else {
        const fileName = `${(portfolio?.userName || 'portfolio').replace(/\s+/g, '_')}_AI_${templateId}.pptx`;
        await exportDeckToPptx(deck, activeTemplate, fileName);
        toast.success('PPT 다운로드를 시작합니다');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || '내보내기 실패');
    }
    setExporting(false);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600" /></div>;
  }
  if (!portfolio) return <p className="text-center py-20 text-gray-400">포트폴리오를 찾을 수 없습니다</p>;

  return (
    <div className="animate-fadeIn max-w-[1200px] mx-auto">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(`/app/portfolio/preview/${id}`)} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft size={16} /> 뒤로
        </button>
      </div>

      {stage === STAGE.CHOOSE && (
        <ChooseStage
          templateId={templateId}
          setTemplateId={setTemplateId}
          customTemplate={customTemplate}
          customFileName={customFileName}
          fileInputRef={fileInputRef}
          onUpload={handleCustomUpload}
          onClearCustom={() => { setCustomTemplate(null); setCustomFileName(''); if (templateId === 'custom') setTemplateId('modern'); }}
          onStart={startAnalyze}
        />
      )}

      {stage === STAGE.ANALYZING && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 size={48} className="animate-spin text-primary-600" />
          <div className="text-lg font-medium text-gray-700">템플릿 슬라이드를 분류하고 사용자 데이터에 맞게 재조립 중…</div>
          <div className="text-sm text-gray-400">프로젝트 개수만큼 슬라이드를 복제하고 빈 슬라이드는 제거합니다 · 최대 60초</div>
        </div>
      )}

      {stage === STAGE.PREVIEW && deck && (
        <PreviewStage
          deck={deck}
          template={activeTemplate}
          isCustom={templateId === 'custom'}
          customFileName={customFileName}
          selectedIdx={selectedSlideIdx}
          setSelectedIdx={setSelectedSlideIdx}
          reviseInput={reviseInput}
          setReviseInput={setReviseInput}
          revising={revising}
          onRevise={reviseSlide}
          onExport={handleExport}
          exporting={exporting}
          onRegenerate={() => { setDeck(null); setSelectedSlideIdx(null); setStage(STAGE.CHOOSE); }}
        />
      )}
    </div>
  );
}

function ChooseStage({ templateId, setTemplateId, customTemplate, customFileName, fileInputRef, onUpload, onClearCustom, onStart }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">템플릿을 선택하세요</h2>
        <p className="text-sm text-gray-500">3개의 합격자 스타일 중 하나를 고르거나, 원하는 PPT/PDF 파일을 업로드해 그 톤에 맞춰 생성할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => setTemplateId(t.id)}
            className={`text-left rounded-2xl border-2 p-5 transition-all ${templateId === t.id ? 'border-primary-500 bg-primary-50/40' : 'border-surface-200 hover:border-surface-300 bg-white'}`}
          >
            <div className="aspect-video rounded-lg mb-4 overflow-hidden border border-surface-200" style={{ background: t.colors.bg }}>
              <div style={{ height: '40%', background: t.colors.headBg, color: t.colors.headFg, padding: '8px 10px', fontFamily: t.fonts.heading, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'flex-end' }}>
                {t.name}
              </div>
              <div style={{ padding: '10px', fontSize: 9, color: t.colors.sub }}>
                <div style={{ width: 30, height: 2, background: t.colors.accent, marginBottom: 4 }} />
                <div style={{ fontFamily: t.fonts.heading, fontWeight: 700, color: t.colors.accent, fontSize: 11 }}>슬라이드 제목</div>
                <div style={{ marginTop: 4 }}>• 합격자 스타일 bullet</div>
                <div>• 수치·기여도 강조</div>
              </div>
            </div>
            <div className="font-semibold text-gray-800 text-sm">{t.name}</div>
            <div className="text-xs text-gray-500 mt-1 leading-relaxed">{t.description}</div>
            {templateId === t.id && (
              <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary-600 font-medium">
                <Check size={12} /> 선택됨
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border-2 border-dashed border-surface-300 p-6 bg-surface-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <Upload size={16} /> 내 템플릿 업로드 (선택)
            </h3>
            <p className="text-sm text-gray-500">합격자 PPT나 원하는 디자인의 .pptx / .pdf를 올리면 그 슬라이드 흐름에 맞춰 내용이 채워집니다.</p>
            {customTemplate && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-surface-200 rounded-lg text-xs">
                <Check size={12} className="text-green-600" />
                <span className="font-medium text-gray-700">{customFileName}</span>
                <button onClick={onClearCustom} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,.pdf"
              className="hidden"
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-surface-300 rounded-lg text-sm font-medium hover:bg-surface-100"
            >
              파일 선택
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-medium hover:from-primary-700 hover:to-primary-800 shadow-sm"
        >
          해당 템플릿으로 PPT 제작하기
        </button>
      </div>
    </div>
  );
}

function PreviewStage({ deck, template, isCustom, customFileName, selectedIdx, setSelectedIdx, reviseInput, setReviseInput, revising, onRevise, onExport, exporting, onRegenerate }) {
  const slides = deck.slides || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">생성된 내용 확인 ({slides.length}장)</h2>
          <p className="text-sm text-gray-500 mt-1">AI가 추천하는 내용 구성을 확인하세요. 슬라이드를 클릭하면 수정을 요청할 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRegenerate} className="inline-flex items-center gap-2 px-4 py-2 border border-surface-200 rounded-xl text-sm text-gray-600 hover:bg-surface-50">
            <RefreshCw size={14} /> 다시 생성
          </button>
          <button
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold hover:from-red-600 hover:to-red-700 disabled:opacity-50 shadow-md shadow-red-500/20 transform hover:-translate-y-0.5 transition-all"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isCustom ? '내 원본 템플릿으로 PPT 다운로드' : 'PPT로 추출하기'}
          </button>
        </div>
      </div>

      {isCustom && (
        <div className="mt-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-600 shrink-0" />
            <b>{customFileName}</b> 원본 디자인이 100% 보존된 채, 사용자 데이터 개수에 맞춰 슬라이드가 자동 복제·정리됩니다.
          </div>
          {Array.isArray(deck?.plan) && deck.plan.length > 0 && (
            <div className="text-xs text-emerald-700 ml-6">
              <b>레고 플랜:</b> {deck.plan.map(p => p.intent).join(' → ')} ({deck.plan.length}장)
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {slides.map((slide, i) => (
          isCustom ? (
            <CustomSlideVisualCard
              key={i}
              slide={slide}
              template={template}
              index={i}
              selected={selectedIdx === i}
              onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
            />
          ) : (
            <SlideCard
              key={slide.id || i}
              slide={slide}
              template={template}
              index={i}
              selected={selectedIdx === i}
              onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
            />
          )
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
            onChange={(e) => setReviseInput(e.target.value)}
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

// 색상 hex → 휘도 (0=검정, 1=흰색). 어두운 배경 위에는 밝은 글자, 밝은 배경 위에는 어두운 글자.
function hexLuma(hex) {
  if (!hex) return 1;
  const m = String(hex).replace('#', '');
  if (m.length !== 6) return 1;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// 사각형 두 개의 겹침 면적이 a 영역 대비 절반 이상이면 "뒤덮인 것"으로 판단
function findCoveringDecor(textBox, decorShapes) {
  const ax2 = textBox.x + textBox.w;
  const ay2 = textBox.y + textBox.h;
  const aArea = textBox.w * textBox.h;
  if (aArea <= 0) return null;
  let best = null;
  let bestOverlap = 0;
  for (const d of decorShapes) {
    const dx = d.x_pt || 0;
    const dy = d.y_pt || 0;
    const dx2 = dx + (d.width_pt || 0);
    const dy2 = dy + (d.height_pt || 0);
    const ow = Math.max(0, Math.min(ax2, dx2) - Math.max(textBox.x, dx));
    const oh = Math.max(0, Math.min(ay2, dy2) - Math.max(textBox.y, dy));
    const overlap = ow * oh;
    if (overlap > bestOverlap && overlap >= aArea * 0.5) {
      bestOverlap = overlap;
      best = d;
    }
  }
  return best;
}

// 미리보기에서 텍스트가 도형 박스를 넘치지 않도록 글자 수/박스 크기에 맞춰 폰트 크기를 줄여주는 헬퍼
// (실제 PPT 다운로드는 원본 폰트 크기 그대로 — 미리보기 가독성만 개선)
function fitFontSize(text, baseFs, w, h) {
  if (!text || !w || !h || !baseFs) return baseFs || 12;
  const lineHeight = 1.3;
  // 한글/영문 혼합 평균 글자 폭 비율 (대략 fontSize * 0.58)
  const charWidthRatio = 0.58;
  const lines = String(text).split(/\r?\n/);
  let fs = baseFs;
  for (let i = 0; i < 12; i++) {
    const charsPerLine = Math.max(1, Math.floor(w / (fs * charWidthRatio)));
    const totalLines = lines.reduce((acc, ln) => acc + Math.max(1, Math.ceil((ln.length || 1) / charsPerLine)), 0);
    const needH = totalLines * fs * lineHeight;
    if (needH <= h) break;
    fs *= 0.9;
    if (fs < 6) { fs = 6; break; }
  }
  return fs;
}

function CustomSlideVisualCard({ slide, template, index, selected, onClick }) {
  const SLIDE_W = slide.slideW || 960;
  const SLIDE_H = slide.slideH || 540;
  const containerW = 540;
  const scale = containerW / SLIDE_W;
  const c = template?.colors || {};
  // [WYSIWYG] 미리보기와 PPTX 출력의 글자 폭을 일치시키기 위해 폰트를 Pretendard 로 통일.
  // 원본 템플릿 폰트(fonts.heading/body)는 시스템에 없을 수 있어 글자 폭이 달라짐 → 의도적으로 무시.
  const PREVIEW_FONT = 'Pretendard, "Pretendard Variable", "Malgun Gothic", "맑은 고딕", system-ui, sans-serif';
  const fonts = { heading: PREVIEW_FONT, body: PREVIEW_FONT };
  // 슬라이드 전체를 덮는 큰 도형(85% 이상)은 배경으로 처리해 텍스트 가림 방지
  const allDecors = slide.decorShapes || [];
  const bgDecors = allDecors.filter(d => d.width_pt >= SLIDE_W * 0.85 && d.height_pt >= SLIDE_H * 0.85);
  const decorShapes = allDecors.filter(d => !(d.width_pt >= SLIDE_W * 0.85 && d.height_pt >= SLIDE_H * 0.85));
  // 배경 도형의 fill을 배경색으로 승격 (가장 마지막 배경 도형 사용)
  const effectiveBg = bgDecors.length > 0
    ? bgDecors[bgDecors.length - 1].fill
    : (slide.slideBg || c.bg || '#FFFFFF');

  const pics = slide.pics || [];
  const staticTexts = slide.staticTexts || [];
  // AI 매핑된 텍스트가 있으면 그것을, 없으면 원본 템플릿 텍스트를 fallback
  const textShapes = (slide.layoutShapes || []).map(sh => {
    const aiText = (slide.shapeMap?.[sh.shape_id] || '').trim();
    const originalText = (sh.original_text || '').trim();
    const text = aiText || originalText;
    return { ...sh, displayText: text };
  }).filter(sh => sh.displayText);
  const isTitle = (h = '') => /title|heading|제목|타이틀/i.test(h);

  return (
    <button
      onClick={onClick}
      className={`block text-left bg-white rounded-xl border-2 overflow-hidden transition-all hover:-translate-y-0.5 ${selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-surface-200'}`}
      style={{ width: '100%' }}
    >
      <div style={{ width: '100%', height: SLIDE_H * scale, position: 'relative', overflow: 'hidden', background: effectiveBg }}>
        <div style={{ width: SLIDE_W, height: SLIDE_H, position: 'relative', transform: `scale(${scale})`, transformOrigin: 'top left', background: effectiveBg }}>
          {/* 1) 데코 도형 — z-index로 master(1)→layout(2)→slide(3) 순서 보장 */}
          {decorShapes.map((d, di) => (
            <div
              key={`d-${di}`}
              style={{
                position: 'absolute',
                left: d.x_pt,
                top: d.y_pt,
                width: d.width_pt,
                height: d.height_pt,
                background: d.fill,
                zIndex: d.zIndex || 1,
              }}
            />
          ))}
          {/* 2) 이미지(p:pic) — z-index 4~6 */}
          {pics.map((p, pi) => (
            <img
              key={`pic-${pi}`}
              src={p.dataUrl}
              alt=""
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              style={{
                position: 'absolute',
                left: p.x_pt,
                top: p.y_pt,
                width: p.width_pt,
                height: p.height_pt,
                objectFit: 'cover',
                pointerEvents: 'none',
                zIndex: p.zIndex || 5,
              }}
            />
          ))}
          {/* 3) 마스터/레이아웃의 정적 텍스트 — z-index 7~8 */}
          {staticTexts.map((st, si) => {
            const innerW = Math.max(1, (st.width_pt || 100) - 4);
            const innerH = Math.max(1, (st.height_pt || 20) - 4);
            const fs = fitFontSize(st.text, st.fontSize || 12, innerW, innerH);
            const cover = findCoveringDecor(
              { x: st.x_pt || 0, y: st.y_pt || 0, w: st.width_pt || 100, h: st.height_pt || 20 },
              decorShapes
            );
            const finalColor = cover && hexLuma(cover.fill) < 0.5 ? '#FFFFFF' : (st.color || '#1F2937');
            return (
              <div
                key={`st-${si}`}
                style={{
                  position: 'absolute',
                  left: st.x_pt,
                  top: st.y_pt,
                  width: st.width_pt,
                  height: st.height_pt,
                  fontSize: fs,
                  color: finalColor,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  padding: 2,
                  fontFamily: fonts.body || 'Pretendard',
                  fontWeight: 600,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  zIndex: st.zIndex || 7,
                }}
              >
                {st.text}
              </div>
            );
          })}
          {/* 4) AI 매핑된 슬라이드 텍스트 — z-index 10으로 항상 최상위 */}
          {textShapes.map(sh => {
            const text = sh.displayText;
            const baseFontSize = (slide.fontMap?.[sh.shape_id]) || sh.original_font_size_pt || (isTitle(sh.role_hint) ? 28 : 14);
            const isT = isTitle(sh.role_hint);
            const boxW = sh.width_pt || 200;
            const boxH = sh.height_pt || 30;
            const innerW = Math.max(1, boxW - 8);
            const innerH = Math.max(1, boxH - 8);
            const fontSize = fitFontSize(text, baseFontSize, innerW, innerH);
            // 자동 명암: 텍스트 박스 뒤에 어두운 데코 fill 이 깔려 있으면 글자색을 밝게
            const cover = findCoveringDecor(
              { x: sh.x_pt || 0, y: sh.y_pt || 0, w: boxW, h: boxH },
              decorShapes
            );
            const baseColor = isT ? (c.titleColor || c.accent || '#111827') : (c.sub || '#1F2937');
            const finalColor = cover && hexLuma(cover.fill) < 0.5 ? '#FFFFFF' : baseColor;
            return (
              <div
                key={sh.shape_id}
                style={{
                  position: 'absolute',
                  left: sh.x_pt || 0,
                  top: sh.y_pt || 0,
                  width: boxW,
                  height: boxH,
                  fontSize,
                  fontFamily: isT ? (fonts.heading || 'Pretendard') : (fonts.body || 'Pretendard'),
                  fontWeight: isT ? 800 : 500,
                  color: finalColor,
                  lineHeight: 1.3,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  overflow: 'hidden',
                  letterSpacing: '-0.01em',
                  padding: 4,
                  zIndex: 10,
                }}
              >
                {text}
              </div>
            );
          })}
          {/* 5) textShapes가 없고 lines 데이터가 있을 때 간단 텍스트 폴백 (미리보기용) */}
          {textShapes.length === 0 && (slide.lines || []).length > 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              padding: Math.round(SLIDE_W * 0.04),
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: Math.round(SLIDE_H * 0.015),
              zIndex: 10,
            }}>
              {(slide.lines || []).slice(0, 8).map((line, li) => (
                <div key={li} style={{
                  fontSize: li === 0 ? Math.round(SLIDE_H * 0.06) : Math.round(SLIDE_H * 0.032),
                  fontWeight: li === 0 ? 800 : 400,
                  color: effectiveBg && hexLuma(effectiveBg) < 0.45 ? '#FFFFFF' : (c.sub || '#1F2937'),
                  fontFamily: fonts.body,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-2 border-t border-surface-100 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">{index + 1}. 슬라이드 {index + 1}</span>
        <span className="text-gray-400">{textShapes.length}개 텍스트 · {pics.length}개 이미지</span>
      </div>
    </button>
  );
}

function SlideCard({ slide, template, index, selected, onClick }) {
  // 미리보기 카드: 540x ~304 영역에 960x540 슬라이드를 scale해서 표시
  const containerW = 540;
  const scale = containerW / 960;
  return (
    <button
      onClick={onClick}
      className={`block text-left bg-white rounded-xl border-2 overflow-hidden transition-all hover:-translate-y-0.5 ${selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-surface-200'}`}
      style={{ width: '100%' }}
    >
      <div style={{ width: '100%', height: 540 * scale, position: 'relative', overflow: 'hidden' }}>
        <SlidePreview slide={slide} template={template} index={index} scale={scale} />
      </div>
      <div className="px-4 py-2 border-t border-surface-100 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-600">{index + 1}. {slide.title}</span>
        <span className="text-gray-400">{slide.layout}</span>
      </div>
    </button>
  );
}
