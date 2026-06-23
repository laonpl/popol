import { useState } from 'react';
import { X, Loader2, ScrollText, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// 이력서 내보내기 모달 — 포트폴리오 내용에서 인적사항·학력·경력·기술·어학·수상만
// 추려 채용용 이력서로 변환한다. PDF(A4 문서) 또는 텍스트(.txt)로 다운로드한다.
export default function ResumeExportModal({ portfolio, onClose }) {
  const [fileType, setFileType] = useState('pdf');
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  // 사용자가 직접 붙여넣은 이력서 텍스트 — 있으면 포트폴리오 대신 이 텍스트로 추출
  const [customText, setCustomText] = useState('');

  // 이력서에 필요한 필드만 추려 보낸다.
  //  - 포트폴리오 원본을 통째로 보내면 profileImageUrl(base64)·customBlocks 등
  //    무거운 필드 때문에 백엔드의 8000자 입력 절단에서 경력이 밀려 누락된다.
  //  - 경력 내용은 structuredResult(intro/output 등) 안에 있는데 txt·PDF 모두
  //    top-level description/role/achievements 만 읽으므로 평면 필드로 펼쳐 준다.
  const buildResumeData = () => ({
    title: portfolio?.title || '',
    userName: portfolio?.userName || '',
    nameEn: portfolio?.nameEn || '',
    headline: portfolio?.headline || '',
    contact: portfolio?.contact || {},
    education: portfolio?.education || [],
    experiences: (portfolio?.experiences || []).map(e => {
      const sr = e.structuredResult || {};
      const ov = sr.projectOverview || {};
      return {
        title: e.title,
        date: e.date || e.period || ov.duration,
        period: e.period || e.date || ov.duration,
        role: e.role || ov.role,
        description: e.description || sr.intro || ov.summary || '',
        achievements: (e.achievements && e.achievements.length)
          ? e.achievements
          : [sr.output, sr.growth].filter(Boolean),
      };
    }),
    awards: portfolio?.awards || [],
    skills: portfolio?.skills || {},
    extracurricular: portfolio?.extracurricular || {},
  });

  const handleExport = async () => {
    const isPdf = fileType === 'pdf';
    const pasted = customText.trim();
    setExporting(true);
    try {
      let blob;
      if (pasted && !isPdf) {
        // 붙여넣은 텍스트를 그대로 .txt 로 저장
        blob = new Blob([customText], { type: 'text/plain;charset=utf-8' });
      } else if (isPdf) {
        // 붙여넣은 텍스트가 있으면 그 텍스트를, 없으면 포트폴리오 데이터를 같은 PDF 스타일로 렌더
        const body = pasted ? { rawText: customText } : { data: buildResumeData() };
        const { data: resData } = await api.post('/export/resume-pdf', body, { timeout: 120000 });
        const base64 = resData?.pdfBase64;
        if (!base64) throw new Error(resData?.message || '이력서 PDF 생성에 실패했습니다');
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: 'application/pdf' });
      } else {
        const { data: resData } = await api.post('/export/resume', { data: buildResumeData() }, { timeout: 120000 });
        const content = resData?.content;
        if (!content) throw new Error(resData?.message || '이력서 생성에 실패했습니다');
        blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (portfolio?.userName || portfolio?.title || 'resume').replace(/[^\w가-힣]+/g, '_').slice(0, 40);
      a.href = url;
      a.download = `${safeName}_이력서.${isPdf ? 'pdf' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
      toast.success('이력서 다운로드를 시작합니다');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || '이력서 생성에 실패했습니다';
      toast.error(msg);
    }
    setExporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] flex flex-col overflow-hidden">

        <div className="px-7 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ScrollText size={17} className="text-emerald-600 flex-shrink-0" />
                <h2 className="text-[19px] font-bold text-gray-900 tracking-tight">이력서 내보내기</h2>
              </div>
              <p className="text-[14px] text-gray-400 leading-snug">
                인적사항·학력·경력·기술·어학·수상만 추려 격식 있는 채용용 이력서로 변환합니다.
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
              <p className="text-[15px] font-medium text-green-700">이력서 다운로드가 시작되었습니다. 다운로드 폴더를 확인하세요.</p>
            </div>
          ) : exporting ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 size={36} className="animate-spin text-emerald-600" />
              <p className="text-[15px] font-medium text-gray-700">이력서를 만드는 중…</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-3">파일 형식</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['pdf', 'PDF 파일', 'A4 이력서 문서'], ['txt', '텍스트', '.txt 파일']].map(([val, label, sub]) => {
                    const on = fileType === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setFileType(val)}
                        className={`px-4 py-3 rounded-xl border text-left transition-all ${
                          on ? 'border-emerald-500 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50/60'
                        }`}
                      >
                        <p className={`text-[14px] font-semibold ${on ? 'text-emerald-700' : 'text-gray-800'}`}>{label}</p>
                        <p className="text-[11.5px] text-gray-400 mt-0.5">{sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-dashed border-gray-200" />

              <div>
                <p className="text-[14px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  직접 텍스트 붙여넣기 <span className="normal-case font-normal text-gray-400">(선택)</span>
                </p>
                <p className="text-[12px] text-gray-400 leading-snug mb-2">
                  내용을 붙여넣으면 포트폴리오 대신 이 텍스트로 이력서를 만듭니다. 구분선(──)으로 섹션을 나누고,
                  줄 앞에 • 또는 - 로 항목을 적으면 PDF에서 깔끔하게 정리됩니다.
                </p>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  rows={7}
                  placeholder={'김유신\n- Email: name@example.com\n──────────\n경력 및 프로젝트\n프로젝트명 | 2025.11 ~ 2026.03 | 기획, 개발 담당\n• 핵심 성과 한 줄\n• 또 다른 성과'}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-300 outline-none text-[13px] text-gray-700 placeholder:text-gray-300 resize-y leading-relaxed"
                />
                {customText.trim() && (
                  <p className="text-[11.5px] text-emerald-600 mt-1.5">붙여넣은 텍스트로 내보냅니다 (포트폴리오 데이터는 사용하지 않음)</p>
                )}
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
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[15px] font-semibold rounded-xl transition-colors shadow-sm"
            >
              {exporting ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</> : <><ScrollText size={14} /> 이력서 내보내기</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
