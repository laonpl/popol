import { useState, useRef } from 'react';
import { X, Loader2, FileText, UploadCloud, CheckCircle2, Check, AlertCircle, Wand2, ChevronDown } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// PPT 추출 모달 — 업로드한 PPT의 디자인(색·폰트·장식 프레임)을 추출하고,
// 흐름·디자인·표지·컬러 4개 항목의 선택 + 자유 요청에 따라 사람마다 다른
// 합격자 스타일 슬라이드를 새로 구성해 PPTX로 다운로드한다.
const STRUCTURES = [
  { id: 'story', label: '스토리 중심', desc: '문제→해결 서사 먼저' },
  { id: 'metrics', label: '성과 중심', desc: '핵심 지표를 맨 앞에' },
  { id: 'compact', label: '핵심 요약', desc: '프로젝트당 1장 압축' },
  { id: 'detailed', label: '상세 서술', desc: '과정+성과 2장씩' },
];
const DESIGNS = [
  { id: 'editorial', label: '문서형', desc: '라벨+문단 행 쌓기' },
  { id: 'cards', label: '카드형', desc: '문제·해결·성과 가로 카드' },
  { id: 'timeline', label: '타임라인형', desc: '세로 단계 흐름' },
];
const COVERS = [
  { id: 'impact', label: '임팩트형', desc: '큰 이름 + 한 줄 카피' },
  { id: 'profile', label: '프로필형', desc: '기술·학력 정보 카드' },
  { id: 'split', label: '분할형', desc: '좌측 컬러 패널' },
  { id: 'banner', label: '배너형', desc: '상단 컬러 밴드' },
];
const TONES = [
  { id: 'calm', label: '차분하게', desc: '포인트 컬러 절제' },
  { id: 'vivid', label: '강렬하게', desc: '포인트 컬러 가득' },
  { id: 'mono', label: '흑백 톤', desc: '컬러 빼고 잉크 대비' },
];

// 완성형 프리셋 — 한 번 고르면 흐름·배치·표지·톤이 통째로 세팅되고,
// 백엔드가 헤더 스타일·악센트 바·마무리 장까지 바꿔 확연히 다른 덱을 만든다.
// sets 는 4축 칩 자동 세팅용(백엔드 PRESETS 와 id·축이 일치해야 함).
// look: 미리보기 미니목업용 골격(백엔드 PRESETS 의 headerStyle/accentBar 와 일치).
// 실제 색은 업로드 템플릿에서 오므로 색은 흉내내지 않고 배치만 도식화한다.
// look.body = 프로젝트 슬라이드의 "페이지 골격"(배치). 백엔드 projectLayout/design 과 일치:
//  rows=문서형 행 / grid=카드 그리드 / timeline=세로 단계 / split=좌 본문+우 패널 / rail=좌 컬러패널+우 그리드
const PRESETS = [
  { id: 'minimal',  label: '미니멀 문서',   desc: '1장 압축 · 문서형 문단',  sets: { structure: 'compact', design: 'editorial', cover: 'impact', tone: 'mono' },  look: { bar: 'none', body: 'split' } },
  { id: 'cards',    label: '모던 카드',     desc: '상단 헤더 + 카드 그리드',  sets: { structure: 'story', design: 'cards', cover: 'profile', tone: 'calm' },     look: { bar: 'top', body: 'grid' } },
  { id: 'timeline', label: '타임라인 스토리', desc: '세로 단계 노드 흐름',     sets: { structure: 'story', design: 'timeline', cover: 'split', tone: 'calm' },    look: { bar: 'left', body: 'timeline' } },
  { id: 'data',     label: '데이터 리포트',  desc: '좌 본문 + 우 성과 패널',  sets: { structure: 'metrics', design: 'cards', cover: 'profile', tone: 'vivid' }, look: { bar: 'left', body: 'split' } },
  { id: 'magazine', label: '임팩트 매거진',  desc: '좌측 컬러 제목 패널(레일)', sets: { structure: 'detailed', design: 'cards', cover: 'banner', tone: 'vivid' }, look: { bar: 'top', body: 'rail' } },
  { id: 'archive',  label: '상세 아카이브',  desc: '과정 5단 문서형 행',      sets: { structure: 'detailed', design: 'editorial', cover: 'profile', tone: 'calm' }, look: { bar: 'left', body: 'rows' } },
];
const DEFAULT_PRESET = PRESETS[1]; // 모던 카드

// 프리셋의 페이지 골격(배치)을 도식으로 보여주는 미니 슬라이드 목업.
// 색이 아니라 "배치"가 프리셋마다 다르다는 걸 한눈에 보이게 한다.
function PresetPreview({ look, active }) {
  const c = active ? 'bg-emerald-500' : 'bg-gray-300';
  const cL = active ? 'bg-emerald-200' : 'bg-gray-200';
  const cell = `rounded-[2px] ${cL}`;
  return (
    <div className="relative w-full h-11 rounded-md bg-gray-50 border border-gray-200 overflow-hidden mb-1.5">
      {look.bar === 'left' && look.body !== 'rail' && <div className={`absolute left-0 top-0 bottom-0 w-1 ${c}`} />}
      {look.bar === 'top' && <div className={`absolute left-0 right-0 top-0 h-1 z-10 ${c}`} />}

      {look.body === 'rows' && (
        <div className="absolute inset-1.5 flex flex-col justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-1">
              <span className={`h-1.5 w-2.5 rounded-[2px] ${c}`} />
              <span className={`h-1 flex-1 ${cell}`} style={{ maxWidth: `${75 - i * 12}%` }} />
            </div>
          ))}
        </div>
      )}
      {look.body === 'grid' && (
        <div className="absolute inset-1.5 grid grid-cols-2 grid-rows-2 gap-1">
          {[0, 1, 2, 3].map(i => <span key={i} className={`${cell} ${active ? 'border border-emerald-300' : 'border border-gray-200'}`} />)}
        </div>
      )}
      {look.body === 'timeline' && (
        <div className="absolute inset-1.5 flex flex-col justify-center gap-1.5 pl-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
              <span className={`h-1 ${cell}`} style={{ width: `${60 - i * 8}%` }} />
            </div>
          ))}
        </div>
      )}
      {look.body === 'split' && (
        <div className="absolute inset-1.5 flex gap-1">
          <div className="flex flex-col justify-center gap-1 flex-1">
            {[0, 1, 2].map(i => <span key={i} className={`h-1 ${cell}`} style={{ width: `${85 - i * 15}%` }} />)}
          </div>
          <div className={`w-1/3 rounded-[2px] ${active ? 'bg-emerald-100 border border-emerald-300' : 'bg-gray-100 border border-gray-200'} flex flex-col justify-center items-center gap-0.5`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
            <span className={`h-0.5 w-5 rounded-[1px] ${cL}`} />
          </div>
        </div>
      )}
      {look.body === 'rail' && (
        <div className="absolute inset-0 flex">
          <div className={`w-2/5 ${c} flex flex-col justify-center gap-1 px-1.5`}>
            <span className="h-1.5 w-6 rounded-[2px] bg-white/70" />
            <span className="h-1 w-4 rounded-[2px] bg-white/40" />
          </div>
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-1 p-1.5">
            {[0, 1, 2, 3].map(i => <span key={i} className={`${cell}`} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// 한 항목: 선택 칩 + 자유 요청 입력칸
function OptionBlock({ title, options, value, onChange, request, onRequest, placeholder }) {
  const cols = options.length >= 4 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <p className="text-[13px] font-semibold text-gray-700 mb-2">{title}</p>
      <div className={`grid gap-1.5 ${cols}`}>
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-2 py-1.5 rounded-lg border text-left transition-all ${
              value === o.id ? 'border-emerald-500 bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <span className={`block text-[12px] font-semibold ${value === o.id ? 'text-emerald-700' : 'text-gray-700'}`}>{o.label}</span>
            <span className="block text-[10px] text-gray-400 leading-snug mt-0.5">{o.desc}</span>
          </button>
        ))}
      </div>
      <input
        type="text"
        value={request}
        maxLength={120}
        onChange={(e) => onRequest(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 outline-none text-[12.5px] text-gray-700 placeholder:text-gray-300"
      />
    </div>
  );
}

export default function PptExtractModal({ portfolio, onClose }) {
  const [templateFile, setTemplateFile] = useState(null);
  const [preset, setPreset] = useState(DEFAULT_PRESET.id);
  const [structure, setStructure] = useState(DEFAULT_PRESET.sets.structure);
  const [design, setDesign] = useState(DEFAULT_PRESET.sets.design);
  const [cover, setCover] = useState(DEFAULT_PRESET.sets.cover);
  const [tone, setTone] = useState(DEFAULT_PRESET.sets.tone);
  const [emphasis, setEmphasis] = useState('');
  const [tweakOpen, setTweakOpen] = useState(false);

  // 프리셋 선택 → 4축 칩 자동 세팅 (이후 세부 조정으로 개별 덮어쓰기 가능)
  const applyPreset = (p) => {
    setPreset(p.id);
    setStructure(p.sets.structure);
    setDesign(p.sets.design);
    setCover(p.sets.cover);
    setTone(p.sets.tone);
  };
  // 항목별 자유 요청
  const [reqFlow, setReqFlow] = useState('');
  const [reqDesign, setReqDesign] = useState('');
  const [reqCover, setReqCover] = useState('');
  const [reqColor, setReqColor] = useState('');
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef(null);

  const hasRequests = [reqFlow, reqDesign, reqCover, reqColor].some(s => s.trim());

  const handleExport = async () => {
    if (!templateFile) { toast.error('PPTX 템플릿 파일을 업로드해 주세요'); return; }
    setExporting(true);
    try {
      const fd = new FormData();
      fd.append('template', templateFile);
      fd.append('portfolio', JSON.stringify(portfolio));
      fd.append('options', JSON.stringify({
        choices: { preset, structure, design, cover, tone, emphasis: emphasis.trim() },
        requests: { flow: reqFlow.trim(), design: reqDesign.trim(), cover: reqCover.trim(), color: reqColor.trim() },
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] max-h-[92vh] flex flex-col overflow-hidden">

        <div className="px-7 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText size={17} className="text-emerald-600 flex-shrink-0" />
                <h2 className="text-[19px] font-bold text-gray-900 tracking-tight">PPT 추출</h2>
              </div>
              <p className="text-[14px] text-gray-400 leading-snug">
                업로드한 PPT의 디자인을 입히고, 4개 항목의 선택과 요청에 맞춰 나만의 구성으로 만듭니다.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-200 mx-7" />

        <div className="px-7 py-5 flex-1 overflow-auto">
          {done ? (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-green-200 bg-green-50">
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
              <p className="text-[15px] font-medium text-green-700">PPT 다운로드가 시작되었습니다. 다운로드 폴더를 확인하세요.</p>
            </div>
          ) : exporting ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
              <p className="text-[15px] font-medium text-gray-700">디자인 분석 및 슬라이드 구성 중…</p>
              <p className="text-[12.5px] text-gray-400">요청 내용을 반영해 배치를 정하는 중입니다. 보통 10~20초 소요됩니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-2">1. 디자인 PPTX 업로드</p>
                <input ref={fileRef} type="file" accept=".pptx" className="hidden" onChange={(e) => setTemplateFile(e.target.files?.[0] || null)} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/40 rounded-xl text-[14px] text-gray-600"
                >
                  <UploadCloud size={16} />
                  {templateFile ? templateFile.name : '디자인을 가져올 PPTX 파일 선택'}
                </button>
                {templateFile && (
                  <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-green-600">
                    <Check size={12} /> {templateFile.name} 선택됨 — 배경·강조색·폰트·장식 프레임을 가져옵니다
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-gray-200" />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider">2. 스타일 프리셋 선택</p>
                  <span className="text-[11px] text-gray-400">한 번에 다른 느낌의 덱</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      className={`px-2.5 py-2.5 rounded-xl border text-left transition-all ${
                        preset === p.id ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-300' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <PresetPreview look={p.look} active={preset === p.id} />
                      <span className={`block text-[12.5px] font-bold ${preset === p.id ? 'text-emerald-700' : 'text-gray-800'}`}>{p.label}</span>
                      <span className="block text-[10.5px] text-gray-400 leading-snug mt-0.5">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-dashed border-gray-200" />

              <div>
                <button
                  onClick={() => setTweakOpen(v => !v)}
                  className="w-full flex items-center justify-between py-1 text-left"
                >
                  <span className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider">3. 세부 조정 <span className="text-gray-300 normal-case font-normal">(선택)</span></span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${tweakOpen ? 'rotate-180' : ''}`} />
                </button>
                {tweakOpen && (
                  <div className="space-y-2.5 mt-3">
                    <OptionBlock title="흐름 — 어떤 순서로 보여줄까요?" options={STRUCTURES} value={structure} onChange={setStructure}
                      request={reqFlow} onRequest={setReqFlow} placeholder="요청 (예: 성과를 면접관이 먼저 보게 해줘)" />
                    <OptionBlock title="디자인 — 본문 배치 방식은?" options={DESIGNS} value={design} onChange={setDesign}
                      request={reqDesign} onRequest={setReqDesign} placeholder="요청 (예: 단계별 타임라인으로 보여줘)" />
                    <OptionBlock title="표지 — 첫 장 느낌은?" options={COVERS} value={cover} onChange={setCover}
                      request={reqCover} onRequest={setReqCover} placeholder="요청 (예: 이름 크게, 임팩트 있게)" />
                    <OptionBlock title="포인트 컬러 — 색은 어떻게?" options={TONES} value={tone} onChange={setTone}
                      request={reqColor} onRequest={setReqColor} placeholder="요청 (예: 초록색으로, 차분하게)" />
                  </div>
                )}
              </div>

              <div>
                <p className="text-[13px] font-semibold text-gray-700 mb-1.5">
                  강조하고 싶은 한 줄 <span className="text-gray-400 font-normal">(선택 · 표지와 마무리에 반영)</span>
                </p>
                <input
                  type="text"
                  value={emphasis}
                  maxLength={80}
                  onChange={(e) => setEmphasis(e.target.value)}
                  placeholder="예: 데이터로 설득하고 끝까지 책임지는 개발자"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 outline-none text-[13px] text-gray-700 placeholder:text-gray-300"
                />
              </div>

              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800">
                <Wand2 size={15} className="flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] leading-relaxed">
                  {hasRequests
                    ? '프리셋을 기본으로 잡고, 입력한 요청을 AI가 읽어 흐름·배치·표지·색을 덮어씁니다. 세부 조정 칩으로도 바꿀 수 있어요.'
                    : '프리셋만 골라도 표지·배치·헤더·마무리까지 통째로 다른 덱이 됩니다. 세부 조정으로 항목별 미세 조정, 요청칸에 적으면 그대로 반영돼요.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-200 mx-7" />

        <div className="px-7 py-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[15px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200">
            {done ? '닫기' : '취소'}
          </button>
          {!done && (
            <button
              onClick={handleExport}
              disabled={exporting || !templateFile}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-xl transition-colors shadow-sm"
            >
              {exporting ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</> : <><FileText size={14} /> PPT 추출하기</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
