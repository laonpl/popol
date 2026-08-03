import { useState, useRef } from 'react';
import { X, Loader2, Copy, Download, FileText, FileDown, ScrollText, Globe, Link2, Check, ExternalLink, Info, HelpCircle, AlertCircle, CheckCircle2, Lock, Unlock, UploadCloud } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { trackExport } from '../services/outcomeMetrics';

const FORMATS = [
  {
    key: 'Link',
    label: '링크 공유',
    icon: Link2,
    desc: '공개 링크로 포트폴리오를 공유',
    info: '링크를 아는 누구나 포트폴리오를 열람할 수 있습니다. 포트폴리오가 공개로 설정됩니다.',
  },
  {
    key: 'PPT',
    label: 'PPT 파일',
    icon: FileText,
    desc: '내 PPT 템플릿에 자동 매핑',
    info: '디자인을 가져올 PPTX 템플릿을 업로드하면, 노션형 포트폴리오의 모든 섹션을 AI가 분석해 그 디자인 위에 채워 다운로드합니다.',
  },
  {
    key: 'PDF',
    label: 'PDF 파일',
    icon: FileDown,
    desc: '합격자 스타일 PDF 문서',
    info: '포트폴리오 전체 내용(소개·기술·프로젝트 성과·학력·수상·목표)을 합격자 포트폴리오 스타일의 A4 PDF 문서로 만들어 다운로드합니다.',
  },
  {
    key: 'Resume',
    label: '이력서',
    icon: ScrollText,
    desc: '채용용 이력서 PDF·텍스트',
    info: '포트폴리오 내용에서 인적사항·학력·경력·기술·어학·수상만 추려 격식 있는 채용용 이력서로 변환합니다. PDF 파일(A4 문서) 또는 텍스트(.txt)로 다운로드할 수 있습니다.',
  },
];

export default function ExportModal({ type, data, onClose, onTogglePublic }) {
  const [format, setFormat] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(!!data?.isPublic);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [resumeFileType, setResumeFileType] = useState('pdf');
  const fileRef = useRef(null);

  const step = result ? 2 : 1;

  const buildExportData = () => {
    if (type === 'portfolio') {
      return {
        title: data.title || '',
        userName: data.userName || '',
        nameEn: data.nameEn || '',
        headline: data.headline || '',
        targetCompany: data.targetCompany || '',
        targetPosition: data.targetPosition || '',
        templateType: data.templateType,
        contact: data.contact || {},
        education: data.education || [],
        experiences: data.experiences || [],
        awards: data.awards || [],
        skills: data.skills || {},
        goals: data.goals || [],
        interests: data.interests || [],
        values: data.values || [],
        valuesEssay: data.valuesEssay || '',
        sections: data.sections || [],
      };
    }
    return data;
  };

  const handleExport = async () => {
    if (!format) return;
    // 어떤 산출물이 실제로 쓰이는지 기록 (숫자·식별자만, 본문 없음)
    trackExport({ format, templateId: data?.templateType || data?.templateId, jobCategory: data?.jobCategory });

    if (format === 'Link') {
      if (data.id) setResult(`https://fitpoly.kr/p/${data.id}`);
      else toast.error('공유 링크를 생성할 수 없습니다');
      return;
    }

    if (format === 'Resume') {
      const isPdf = resumeFileType === 'pdf';
      setExporting(true);
      try {
        const payload = { data: { ...buildExportData(), extracurricular: data.extracurricular || {} } };
        let blob;
        if (isPdf) {
          const { data: resData } = await api.post('/export/resume-pdf', payload, { timeout: 120000 });
          const base64 = resData?.pdfBase64;
          if (!base64) throw new Error(resData?.message || '이력서 PDF 생성에 실패했습니다');
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          blob = new Blob([bytes], { type: 'application/pdf' });
        } else {
          const { data: resData } = await api.post('/export/resume', payload, { timeout: 120000 });
          const content = resData?.content;
          if (!content) throw new Error(resData?.message || '이력서 생성에 실패했습니다');
          blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (data.userName || data.title || 'resume').replace(/[^\w가-힣]+/g, '_').slice(0, 40);
        a.href = url;
        a.download = `${safeName}_이력서.${isPdf ? 'pdf' : 'txt'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setResult('downloaded');
        toast.success('이력서 다운로드를 시작합니다');
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || '이력서 생성에 실패했습니다';
        toast.error(msg);
      }
      setExporting(false);
      return;
    }

    if (format === 'PPT' || format === 'PDF') {
      const isPdf = format === 'PDF';
      if (!isPdf && !templateFile) { toast.error('PPTX 템플릿 파일을 업로드해 주세요'); return; }
      setExporting(true);
      try {
        let resData;
        if (isPdf) {
          // PDF: 업로드 불필요 — 포트폴리오 내용을 서버가 합격자 스타일 문서로 렌더
          ({ data: resData } = await api.post('/export/portfolio-pdf', { portfolio: buildExportData() }, { timeout: 120000 }));
        } else {
          const fd = new FormData();
          fd.append('template', templateFile);
          fd.append('portfolio', JSON.stringify(buildExportData()));
          // 라우트는 JSON({ pptxBase64, ... })을 반환한다 — blob 으로 받으면
          // JSON 텍스트가 .pptx 로 저장되어 열리지 않는 파일이 된다.
          ({ data: resData } = await api.post('/export/ppt', fd, {
            timeout: 600000,
            headers: { 'Content-Type': 'multipart/form-data' },
          }));
        }
        const base64 = isPdf ? resData?.pdfBase64 : resData?.pptxBase64;
        if (!base64) throw new Error(resData?.message || `${format} 생성에 실패했습니다`);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], {
          type: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (data.userName || data.title || 'portfolio').replace(/[^\w가-힣]+/g, '_').slice(0, 40);
        a.href = url;
        a.download = `${safeName}.${isPdf ? 'pdf' : 'pptx'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setResult('downloaded');
        toast.success(`${format} 다운로드를 시작합니다`);
      } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || `${format} 생성에 실패했습니다`;
        toast.error(msg);
      }
      setExporting(false);
    }
  };

  const selectedMeta = FORMATS.find(f => f.key === format);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[580px] flex flex-col overflow-hidden">

        <div className="px-7 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[19px] font-bold text-gray-900 tracking-tight">내보내기</h2>
                <Info size={14} className="text-gray-400 flex-shrink-0" />
              </div>
              <p className="text-[15px] text-gray-400 leading-snug">
                {data.title || '포트폴리오'}를 원하는 형식으로 내보냅니다.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${(step / 2) * 100}%` }} />
                </div>
                <span className="text-[14px] text-gray-400 whitespace-nowrap">{step}/2 완료</span>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                <X size={17} />
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-200 mx-7" />

        <div className="px-7 py-5 flex-1 overflow-auto">
          {!result ? (
            <div className="space-y-5">
              <div>
                <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-3">내보내기 형식 선택</p>
                <div className="grid grid-cols-4 gap-3">
                  {FORMATS.map(({ key, label, icon: Icon, desc }) => {
                    const selected = format === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setFormat(key)}
                        className={`group relative p-4 rounded-xl border text-left transition-all duration-150 ${
                          selected
                            ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                        }`}
                      >
                        {selected && (
                          <span className="absolute top-3 right-3"><CheckCircle2 size={15} className="text-blue-500" /></span>
                        )}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                          selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <p className={`text-[15px] font-semibold mb-0.5 ${selected ? 'text-blue-700' : 'text-gray-800'}`}>{label}</p>
                        <p className="text-[11.5px] text-gray-400 leading-snug">{desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {format === 'PPT' && (
                <>
                  <div className="border-t border-dashed border-gray-200" />
                  <div>
                    <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-3">PPTX 템플릿 업로드</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pptx"
                      className="hidden"
                      onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl text-[14px] text-gray-600"
                    >
                      <UploadCloud size={16} />
                      {templateFile ? templateFile.name : '디자인을 가져올 PPTX 파일 선택'}
                    </button>
                    <p className="text-[11.5px] text-gray-400 mt-2 leading-relaxed">
                      업로드 파일의 텍스트는 무시되고, 슬라이드 레이아웃·색상·폰트만 참조됩니다.
                      모든 섹션이 누락 없이 들어가며 프로젝트는 문제정의·역할·성과·지표 4구획으로 자동 구성됩니다.
                    </p>
                  </div>
                </>
              )}

              {format === 'Resume' && (
                <div>
                  <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-3">파일 형식</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[['pdf', 'PDF 파일', 'A4 이력서 문서'], ['txt', '텍스트', '.txt 파일']].map(([val, label, sub]) => {
                      const on = resumeFileType === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setResumeFileType(val)}
                          className={`px-4 py-3 rounded-xl border text-left transition-all ${
                            on ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50/60'
                          }`}
                        >
                          <p className={`text-[14px] font-semibold ${on ? 'text-blue-700' : 'text-gray-800'}`}>{label}</p>
                          <p className="text-[11.5px] text-gray-400 mt-0.5">{sub}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-dashed border-gray-200" />

              {selectedMeta ? (
                <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${
                  format === 'PPT' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <p className="text-[12.5px] leading-relaxed">{selectedMeta.info}</p>
                </div>
              ) : (
                <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500">
                  <Info size={15} className="flex-shrink-0 mt-0.5" />
                  <p className="text-[12.5px] leading-relaxed">내보내기 형식을 선택하면 자세한 안내가 표시됩니다.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-green-200 bg-green-50">
                <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                <p className="text-[15px] font-medium text-green-700">
                  {format === 'Link' ? '공개 링크가 생성되었습니다' : `${format === 'Resume' ? '이력서' : format} 다운로드가 시작되었습니다`}
                </p>
              </div>

              <div className="border-t border-dashed border-gray-200" />

              {format === 'Link' && (
                <div className="space-y-4">
                  {onTogglePublic && (
                    <div className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors ${
                      isPublic ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {isPublic ? <Unlock size={15} className="text-blue-500 flex-shrink-0" /> : <Lock size={15} className="text-gray-400 flex-shrink-0" />}
                        <div>
                          <p className={`text-[15px] font-semibold ${isPublic ? 'text-blue-700' : 'text-gray-600'}`}>
                            {isPublic ? '링크 공개 중' : '링크 비공개'}
                          </p>
                          <p className="text-[11.5px] text-gray-400 mt-0.5">
                            {isPublic ? '링크를 아는 누구나 열람 가능합니다' : '켜면 링크로 포트폴리오를 공유할 수 있습니다'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setTogglingPublic(true);
                          const newVal = !isPublic;
                          try {
                            await onTogglePublic(newVal);
                            setIsPublic(newVal);
                            toast.success(newVal ? '포트폴리오가 공개되었습니다' : '공개가 해제되었습니다');
                          } catch { toast.error('설정 변경에 실패했습니다'); }
                          setTogglingPublic(false);
                        }}
                        disabled={togglingPublic}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                          isPublic ? 'bg-blue-500' : 'bg-gray-300'
                        } ${togglingPublic ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isPublic ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-2">공유 링크</p>
                    <div className="flex items-center gap-2 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                      <Globe size={14} className="text-blue-400 flex-shrink-0" />
                      <span className="text-[12.5px] text-gray-700 truncate font-mono flex-1">{result}</span>
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(result);
                          setLinkCopied(true);
                          toast.success('링크가 복사되었습니다!');
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[15px] font-medium transition-colors"
                      >
                        {linkCopied ? <Check size={15} /> : <Copy size={15} />}
                        {linkCopied ? '복사됨!' : '링크 복사'}
                      </button>
                      <a
                        href={result}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-[15px] font-medium transition-colors"
                      >
                        <ExternalLink size={15} /> 미리보기
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {(format === 'PPT' || format === 'PDF' || format === 'Resume') && (
                <div className="text-[13px] text-gray-500 leading-relaxed">
                  브라우저의 다운로드 폴더에서 파일을 확인하세요.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-200 mx-7" />

        <div className="px-7 py-4 flex items-center justify-between">
          <a
            href="mailto:support@fitpoly.kr"
            className="flex items-center gap-1.5 text-[12.5px] text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
          >
            <HelpCircle size={13} /> 도움이 필요하신가요?
          </a>
          <div className="flex items-center gap-2">
            {result ? (
              <button
                onClick={() => { setResult(null); setFormat(null); setTemplateFile(null); }}
                className="px-4 py-2 text-[15px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
              >
                다시 선택
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-[15px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
              >
                취소
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={!format || exporting || (format === 'PPT' && !templateFile)}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-xl transition-colors shadow-sm"
            >
              {exporting ? (
                <><Loader2 size={14} className="animate-spin" /> 처리 중...</>
              ) : result ? (
                <>완료</>
              ) : (
                <><Download size={14} /> 내보내기</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
