import { useState, useRef } from 'react';
import { X, Loader2, FileText, UploadCloud, CheckCircle2, Check, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// PPT 추출 — 업로드한 PPT의 디자인(색·폰트·장식 프레임)을 입히고, 클로드식 질의응답
// (대상·발표시간·톤·색상·강조점)으로 발표 맥락을 받아 고객마다 다른 합격자 스타일
// 슬라이드를 새로 구성해 PPTX로 다운로드한다. 답변은 백엔드 resolveComposition({qa})가
// composer 옵션(structure/design/cover/tone/accentHex/emphasis…)으로 번역한다.

import useModalBehavior from '../hooks/useModalBehavior';
const Q_AUDIENCE = [
  { id: 'campus',    label: '교내·공모전',   desc: '대학·창업 프로그램, 경진대회' },
  { id: 'corporate', label: '기업 면접·채용', desc: '채용 담당자·면접관 대상' },
  { id: 'startup',   label: '투자·IR',       desc: '투자자·데모데이 발표' },
  { id: 'client',    label: '고객·제안',     desc: '클라이언트·외주 제안' },
];
const Q_DURATION = [
  { id: 'short',  label: '~3분',  desc: '핵심만 압축 · 프로젝트당 1장' },
  { id: 'medium', label: '~5분',  desc: '균형 잡힌 서사 (권장)' },
  { id: 'long',   label: '10분+', desc: '과정·성과 상세 서술' },
];
const Q_TONE = [
  { id: 'professional', label: '깔끔·전문',     desc: '비즈니스/IR 느낌, 신뢰감' },
  { id: 'minimal',      label: '미니멀',        desc: '여백 많고 절제된 디자인' },
  { id: 'friendly',     label: '친근·부드러움', desc: '따뜻하고 편안한 인상' },
  { id: 'bold',         label: '강렬·임팩트',   desc: '시선을 끄는 대담한 구성' },
];
const Q_COLOR = [
  { id: 'auto',  label: '템플릿 색 그대로', desc: '업로드한 템플릿의 강조색 사용 (권장)' },
  { id: 'mono',  label: '블랙 & 화이트',   desc: '무채색 미니멀' },
  { id: 'brand', label: '브랜드 컬러',     desc: '원하는 색을 직접 지정' },
  { id: 'warm',  label: '따뜻한 톤',       desc: '오렌지·레드 계열' },
  { id: 'cool',  label: '차분한 톤',       desc: '블루·네이비 계열' },
];

// 단계 정의: 0=업로드, 1~5=질문
const STEPS = [
  { key: 'upload',   title: '디자인 PPTX 업로드',        sub: '디자인(배경·강조색·폰트·장식)을 가져올 템플릿' },
  { key: 'audience', title: '누구에게 발표하나요?',       sub: '대상에 맞춰 표지와 강조를 다르게 구성합니다' },
  { key: 'duration', title: '발표 시간은 얼마나 되나요?', sub: '시간에 맞춰 분량과 서술 밀도를 정합니다' },
  { key: 'tone',     title: '어떤 분위기를 원하세요?',    sub: '본문 배치·표지·헤더 스타일이 함께 바뀝니다' },
  { key: 'color',    title: '색상 톤은 어떻게 할까요?',   sub: '포인트 컬러를 정합니다' },
  { key: 'emphasis', title: '가장 강조하고 싶은 점은?',   sub: '표지와 마무리에 한 줄 슬로건으로 들어갑니다' },
];

// 질문 칩 그리드 (선택 시 다음 단계로 자동 진행)
function ChoiceGrid({ options, value, onPick, cols = 2 }) {
  return (
    <div className={`grid gap-2.5 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onPick(o.id)}
          className={`px-3.5 py-3 rounded-xl border text-left transition-all ${
            value === o.id ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-300' : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 bg-white'
          }`}
        >
          <span className={`flex items-center gap-1.5 text-[14px] font-bold ${value === o.id ? 'text-emerald-700' : 'text-gray-800'}`}>
            {o.label}
            {value === o.id && <Check size={13} className="text-emerald-600" />}
          </span>
          <span className="block text-[11.5px] text-gray-400 leading-snug mt-1">{o.desc}</span>
        </button>
      ))}
    </div>
  );
}

export default function PptExtractModal({ portfolio, onClose }) {
  const { ref: panelRef, backdropProps } = useModalBehavior(true, onClose);
  const [step, setStep] = useState(0);
  const [templateFile, setTemplateFile] = useState(null);
  const [audience, setAudience] = useState('');
  const [duration, setDuration] = useState('');
  const [tone, setTone] = useState('');
  const [color, setColor] = useState('');
  const [brandHex, setBrandHex] = useState('#2563EB');
  const [emphasis, setEmphasis] = useState('');
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  const TOTAL = STEPS.length;
  const cur = STEPS[step];
  const next = () => setStep(s => Math.min(TOTAL - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  // 칩 선택 → 값 저장 후 자동으로 다음 질문 (브랜드 색은 hex 입력이 필요해 자동 진행 안 함)
  const pickAdvance = (setter) => (id) => { setter(id); next(); };
  const pickColor = (id) => { setColor(id); if (id !== 'brand') next(); };

  const canNext = (() => {
    switch (cur.key) {
      case 'upload': return !!templateFile;
      case 'audience': return !!audience;
      case 'duration': return !!duration;
      case 'tone': return !!tone;
      case 'color': return !!color;
      default: return true; // emphasis 는 선택
    }
  })();

  const handleExport = async () => {
    if (!templateFile) { toast.error('PPTX 템플릿 파일을 업로드해 주세요'); return; }
    setExporting(true);
    try {
      const fd = new FormData();
      fd.append('template', templateFile);
      fd.append('portfolio', JSON.stringify(portfolio));
      fd.append('options', JSON.stringify({
        qa: {
          audience, duration, tone, color,
          brandHex: color === 'brand' ? brandHex : '',
          emphasis: emphasis.trim(),
        },
      }));
      const { data } = await api.post('/export/ppt-compose', fd, {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!data?.pptxBase64) throw new Error(data?.message || 'PPT 생성에 실패했습니다');
      const binary = atob(data.pptxBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (portfolio?.userName || portfolio?.title || 'portfolio').replace(/[^\w가-힣]+/g, '_').slice(0, 40);
      a.href = url;
      a.download = `${safeName}_포트폴리오.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
      toast.success('PPT 다운로드를 시작합니다');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'PPT 생성에 실패했습니다';
      toast.error(msg);
    }
    setExporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4" {...backdropProps}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="PPT 추출" tabIndex={-1} className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[92vh] flex flex-col overflow-hidden">

        <div className="px-7 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText size={17} className="text-emerald-600 flex-shrink-0" />
                <h2 className="text-[19px] font-bold text-gray-900 tracking-tight">PPT 추출 — 질의응답</h2>
              </div>
              <p className="text-[14px] text-gray-400 leading-snug">
                내 템플릿 디자인을 입히고, 몇 가지 질문에 답하면 발표 맥락에 맞춰 나만의 구성으로 만듭니다.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 진행 표시 */}
        {!done && !exporting && (
          <div className="px-7 pb-4">
            <div className="flex items-center gap-1.5">
              {STEPS.map((s, i) => (
                <div key={s.key} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              ))}
            </div>
            <p className="text-[11.5px] text-gray-400 mt-1.5">{step + 1} / {TOTAL} 단계</p>
          </div>
        )}

        <div className="border-t border-dashed border-gray-200 mx-7" />

        <div className="px-7 py-5 flex-1 overflow-auto">
          {done ? (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-green-200 bg-green-50">
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
              <p className="text-[15px] font-medium text-green-700">PPT 다운로드가 시작되었습니다. 다운로드 폴더를 확인하세요.</p>
            </div>
          ) : exporting ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
              <p className="text-[15px] font-medium text-gray-700">디자인 분석 및 슬라이드 구성 중…</p>
              <p className="text-[12.5px] text-gray-400">답변을 반영해 배치를 정하는 중입니다. 보통 10~20초 소요됩니다.</p>
            </div>
          ) : (
            <div className="space-y-4 min-h-[230px]">
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">{cur.title}</h3>
                <p className="text-[12.5px] text-gray-400 mt-0.5">{cur.sub}</p>
              </div>

              {cur.key === 'upload' && (
                <div>
                  <input ref={fileRef} type="file" accept=".pptx" className="hidden" onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-7 border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/40 rounded-xl text-[14px] text-gray-600"
                  >
                    <UploadCloud size={18} />
                    {templateFile ? templateFile.name : '디자인을 가져올 PPTX 파일 선택'}
                  </button>
                  {templateFile && (
                    <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-green-600">
                      <Check size={12} /> {templateFile.name} — 배경·강조색·폰트·장식 프레임을 가져옵니다
                    </div>
                  )}
                </div>
              )}

              {cur.key === 'audience' && <ChoiceGrid options={Q_AUDIENCE} value={audience} onPick={pickAdvance(setAudience)} />}
              {cur.key === 'duration' && <ChoiceGrid options={Q_DURATION} value={duration} onPick={pickAdvance(setDuration)} cols={3} />}
              {cur.key === 'tone' && <ChoiceGrid options={Q_TONE} value={tone} onPick={pickAdvance(setTone)} />}

              {cur.key === 'color' && (
                <div className="space-y-3">
                  <ChoiceGrid options={Q_COLOR} value={color} onPick={pickColor} />
                  {color === 'brand' && (
                    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-emerald-200 bg-emerald-50/40">
                      <input
                        type="color"
                        value={brandHex}
                        onChange={(e) => setBrandHex(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-gray-200 bg-white cursor-pointer p-0.5"
                      />
                      <div className="flex-1">
                        <p className="text-[12.5px] font-semibold text-gray-700">브랜드 포인트 컬러</p>
                        <p className="text-[12px] text-gray-400">{brandHex.toUpperCase()} — 헤더·강조·차트에 사용됩니다</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cur.key === 'emphasis' && (
                <div className="space-y-3">
                  <textarea
                    value={emphasis}
                    maxLength={80}
                    rows={3}
                    onChange={(e) => setEmphasis(e.target.value)}
                    placeholder="예: 결제 시스템·수익 검증으로 끝까지 책임지는 개발자"
                    className="w-full px-3.5 py-3 rounded-xl border border-gray-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 outline-none text-[13.5px] text-gray-700 placeholder:text-gray-300 resize-none"
                  />
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800">
                    <Wand2 size={15} className="flex-shrink-0 mt-0.5" />
                    <p className="text-[12.5px] leading-relaxed">
                      비워 두어도 됩니다. 적어 주시면 발표 대상에 맞춰 표지·마무리용 한 줄 슬로건으로 다듬어 넣습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-200 mx-7" />

        <div className="px-7 py-4 flex items-center justify-between gap-2">
          {done ? (
            <button onClick={onClose} className="ml-auto px-4 py-2 text-[15px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200">
              닫기
            </button>
          ) : exporting ? (
            <span className="ml-auto text-[13px] text-gray-400">생성 중…</span>
          ) : (
            <>
              <button
                onClick={step === 0 ? onClose : back}
                className="inline-flex items-center gap-1 px-4 py-2 text-[15px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
              >
                {step === 0 ? '취소' : <><ChevronLeft size={15} /> 이전</>}
              </button>
              {step < TOTAL - 1 ? (
                <button
                  onClick={next}
                  disabled={!canNext}
                  className="inline-flex items-center gap-1 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-xl transition-colors shadow-sm"
                >
                  다음 <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  onClick={handleExport}
                  disabled={!templateFile}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <FileText size={14} /> PPT 만들기
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
