import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Wand2, Download, Upload, X, Check, Sparkles, RefreshCw } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../config/firebase';
import api from '../../services/api';
import { TEMPLATES, getTemplate, SlidePreview, exportDeckToPptx } from './aiPptTemplates';

const STAGE = { CHOOSE: 'choose', ANALYZING: 'analyzing', PREVIEW: 'preview' };

export default function AiPptExport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(STAGE.CHOOSE);
  const [templateId, setTemplateId] = useState('modern');
  const [customFile, setCustomFile] = useState(null);
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

  const handleCustomUpload = (file) => {
    if (!file) return;
    setCustomFile(file);
    setCustomFileName(file.name);
    setTemplateId('custom');
    toast.success(`${file.name} 업로드 완료`);
  };

  const startAnalyze = async () => {
    if (!portfolio) return;
    setStage(STAGE.ANALYZING);
    try {
      if (templateId === 'custom' && customFile) {
        // 새 파이프라인: templateParser → geminiMapper → pptxRenderer (백엔드)
        const form = new FormData();
        form.append('template', customFile);
        form.append('portfolio', JSON.stringify(portfolio));

        const res = await api.post('/export/ppt', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          responseType: 'blob',
        });

        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(portfolio.userName || 'portfolio').replace(/\s+/g, '_')}_포트폴리오.pptx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PPT 다운로드를 시작합니다');
        setStage(STAGE.CHOOSE);
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

  const activeTemplate = getTemplate(templateId === 'custom' ? 'modern' : templateId);

  const handleExport = async () => {
    if (!deck) return;
    setExporting(true);
    try {
      const fileName = `${(portfolio?.userName || 'portfolio').replace(/\s+/g, '_')}_AI_${templateId}.pptx`;
      await exportDeckToPptx(deck, activeTemplate, fileName);
      toast.success('PPT 다운로드를 시작합니다');
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
          customFileName={customFileName}
          fileInputRef={fileInputRef}
          onUpload={handleCustomUpload}
          onClearCustom={() => { setCustomFile(null); setCustomFileName(''); if (templateId === 'custom') setTemplateId('modern'); }}
          onStart={startAnalyze}
        />
      )}

      {stage === STAGE.ANALYZING && (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 size={48} className="animate-spin text-primary-600" />
          <div className="text-lg font-medium text-gray-700">
            {templateId === 'custom'
              ? '템플릿 디자인을 분석하고 포트폴리오 내용을 매핑 중…'
              : '템플릿 슬라이드를 분류하고 사용자 데이터에 맞게 재조립 중…'}
          </div>
          <div className="text-sm text-gray-400">최대 60초 소요될 수 있습니다</div>
        </div>
      )}

      {stage === STAGE.PREVIEW && deck && (
        <PreviewStage
          deck={deck}
          template={activeTemplate}
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

function ChooseStage({ templateId, setTemplateId, customFileName, fileInputRef, onUpload, onClearCustom, onStart }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">템플릿을 선택하세요</h2>
        <p className="text-sm text-gray-500">3개의 합격자 스타일 중 하나를 고르거나, 원하는 PPT 파일을 업로드해 그 톤에 맞춰 생성할 수 있습니다.</p>
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
            <p className="text-sm text-gray-500">원하는 디자인의 .pptx 파일을 올리면 그 슬라이드 디자인을 100% 보존한 채 포트폴리오 내용이 채워집니다.</p>
            {customFileName && (
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
              accept=".pptx"
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

function PreviewStage({ deck, template, selectedIdx, setSelectedIdx, reviseInput, setReviseInput, revising, onRevise, onExport, exporting, onRegenerate }) {
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
            onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
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

function SlideCard({ slide, template, index, selected, onClick }) {
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
