import { useState } from 'react';
import { X, Loader2, Copy, Download, FileText, Globe, Link2, Check, ExternalLink, Info, HelpCircle, AlertCircle, CheckCircle2, Lock, Unlock } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const FORMATS = [
  {
    key: 'Link',
    label: '링크 공유',
    icon: Link2,
    desc: '공개 링크로 포트폴리오를 공유',
    badge: null,
    info: '링크를 아는 누구나 포트폴리오를 열람할 수 있습니다. 포트폴리오가 공개로 설정됩니다.',
  },
  {
    key: 'PPT',
    label: 'PPT 파일',
    icon: FileText,
    desc: '기업 제출용 프리미엄 PPT',
    badge: '준비중',
    info: 'PPT 내보내기 기능은 현재 개발 중입니다. 업데이트 시 알려드릴게요!',
  },
];

function markdownToHtml(md) {
  if (!md) return '';
  const inline = (t) =>
    t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
     .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
     .replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:10.5px">$1</code>');
  return md
    .split('\n')
    .map(line => {
      const t = line.trim();
      if (!t) return '<div style="height:5px"></div>';
      if (t.startsWith('# ')) return `<h1 style="font-size:20px;font-weight:700;margin:14px 0 6px;border-bottom:2px solid #333;padding-bottom:6px">${inline(t.slice(2))}</h1>`;
      if (t.startsWith('## ')) return `<h2 style="font-size:16px;font-weight:700;margin:12px 0 5px;color:#111">${inline(t.slice(3))}</h2>`;
      if (t.startsWith('### ')) return `<h3 style="font-size:13px;font-weight:600;margin:8px 0 3px;color:#333">${inline(t.slice(4))}</h3>`;
      if (t.startsWith('---') || t.startsWith('___')) return '<hr style="border:none;border-top:1px solid #ddd;margin:8px 0"/>';
      if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* '))
        return `<p style="font-size:11.5px;margin:2px 0;padding-left:14px;line-height:1.65">• ${inline(t.slice(2))}</p>`;
      if (/^\d+\.\s/.test(t)) {
        const m = t.match(/^(\d+)\.\s(.+)/);
        return `<p style="font-size:11.5px;margin:2px 0;padding-left:14px;line-height:1.65">${m?.[1]}. ${inline(m?.[2] || '')}</p>`;
      }
      const lm = t.match(/^\[([^\]]+)\](.*)/);
      if (lm)
        return `<div style="margin:8px 0 2px"><span style="font-size:11px;font-weight:700;background:#eef2ff;color:#3730a3;padding:2px 7px;border-radius:4px">${lm[1]}</span>${lm[2].trim() ? `<span style="font-size:11.5px;margin-left:6px">${inline(lm[2].trim())}</span>` : ''}</div>`;
      return `<p style="font-size:11.5px;margin:2px 0;line-height:1.7">${inline(t)}</p>`;
    })
    .join('\n');
}

export default function ExportModal({ type, data, onClose, onTogglePublic }) {
  const [format, setFormat] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(!!data?.isPublic);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const step = result ? 2 : 1;
  const totalSteps = 2;

  const buildExportData = () => {
    if (type === 'experience') {
      return {
        title: data.title || '',
        framework: data.framework || 'STAR',
        content: data.content || {},
        keywords: data.keywords || [],
        metadata: {
          duration: data.duration || '',
          role: data.role || '',
          techStack: data.techStack || [],
        },
      };
    }
    if (type === 'portfolio') {
      const isTemplate = ['notion', 'ashley', 'academic', 'timeline'].includes(data.templateType);
      if (isTemplate) {
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
          curricular: data.curricular || {},
          extracurricular: data.extracurricular || {},
          interviews: data.interviews || [],
          books: data.books || [],
          lectures: data.lectures || [],
        };
      }
      return {
        title: data.title || '',
        userName: data.userName || '',
        targetCompany: data.targetCompany || '',
        targetPosition: data.targetPosition || '',
        sections: data.sections || [],
        metadata: {
          techStack: (data.sections || [])
            .filter(s => s.type === 'skills')
            .map(s => s.content)
            .join(', ')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
        },
      };
    }
    if (type === 'coverletter') {
      return {
        title: data.title || '',
        targetCompany: data.targetCompany || '',
        targetPosition: data.targetPosition || '',
        questions: (data.questions || []).map(q => ({
          question: q.question,
          answer: q.answer,
        })),
        summary: (data.questions || []).map(q => q.answer).filter(Boolean).join('\n\n'),
      };
    }
    return data;
  };

  const handleExport = async () => {
    if (!format) return;

    if (format === 'PPT') {
      toast('PPT 내보내기는 추후 업데이트 예정입니다', { style: { borderRadius: '12px', padding: '12px 16px', fontSize: '14px', background: '#1e293b', color: '#fff' } });
      return;
    }

    if (format === 'Link') {
      if (data.id) {
        setResult(`https://fitpoly.kr/p/${data.id}`);
      } else {
        toast.error('공유 링크를 생성할 수 없습니다');
      }
      return;
    }

    setExporting(true);
    try {
      const exportData = buildExportData();
      const formatMap = { PPT: 'ppt', GitHub: 'github' };
      const endpoint = `/export/${formatMap[format]}`;
      const res = await api.post(endpoint, { data: exportData }, { timeout: 60000 });
      if (res.data.content) setResult(res.data.content);
    } catch {
      toast.error('내보내기에 실패했습니다');
    }
    setExporting(false);
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const htmlContent = markdownToHtml(result);
    const printHtml = `<!DOCTYPE html><html lang="ko"><head>
  <meta charset="UTF-8">
  <title>${data.title || '포트폴리오'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Noto Sans KR','Malgun Gothic','맑은 고딕',sans-serif;max-width:794px;margin:0 auto;padding:25px 40px;color:#1a1a1a;font-size:12px;line-height:1.6}
    h1{font-size:20px;font-weight:700;margin-bottom:10px;border-bottom:2px solid #333;padding-bottom:6px}
    h2{font-size:15px;font-weight:700;margin-top:14px;margin-bottom:5px}
    h3{font-size:13px;font-weight:600;margin-top:9px;margin-bottom:3px;color:#333}
    hr{border:none;border-top:1px solid #ddd;margin:8px 0}
    p{font-size:11.5px;line-height:1.7;margin:2px 0}
    strong,b{font-weight:700}em{font-style:italic}
    code{background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:10.5px}
    @page{margin:12mm;size:A4}
    @media print{body{max-width:100%;padding:0}}
  </style>
</head><body>
${htmlContent}
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},600)})</script>
</body></html>`;
    const pw = window.open('', '_blank');
    if (!pw) { toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
    pw.document.write(printHtml);
    pw.document.close();
  };

  const selectedMeta = FORMATS.find(f => f.key === format);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[580px] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="px-7 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            {/* 타이틀 + 설명 */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">내보내기</h2>
                <Info size={14} className="text-gray-400 flex-shrink-0" />
              </div>
              <p className="text-[13px] text-gray-400 leading-snug">
                {data.title || '포트폴리오'}를 원하는 형식으로 내보냅니다.
              </p>
            </div>

            {/* 진행 상태 + 닫기 */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(step / totalSteps) * 100}%` }}
                  />
                </div>
                <span className="text-[12px] text-gray-400 whitespace-nowrap">{step}/{totalSteps} 완료</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-dashed border-gray-200 mx-7" />

        {/* ── Body ── */}
        <div className="px-7 py-5 flex-1 overflow-auto">
          {!result ? (
            <div className="space-y-5">
              {/* 형식 선택 */}
              <div>
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  내보내기 형식 선택
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {FORMATS.map(({ key, label, icon: Icon, desc, badge }) => {
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
                        {badge && (
                          <span className="absolute top-3 right-3 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-md">
                            {badge}
                          </span>
                        )}
                        {selected && (
                          <span className="absolute top-3 right-3">
                            <CheckCircle2 size={15} className="text-blue-500" />
                          </span>
                        )}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${
                          selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <p className={`text-[13px] font-semibold mb-0.5 ${selected ? 'text-blue-700' : 'text-gray-800'}`}>
                          {label}
                        </p>
                        <p className="text-[11.5px] text-gray-400 leading-snug">{desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-dashed border-gray-200" />

              {/* 형식 안내 배너 */}
              {selectedMeta ? (
                <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border ${
                  format === 'PPT'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
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
            /* ── 결과 화면 ── */
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-green-200 bg-green-50">
                <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                <p className="text-[13px] font-medium text-green-700">
                  {format === 'Link' ? '공개 링크가 생성되었습니다' : `${format} 형식으로 변환이 완료되었습니다`}
                </p>
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-dashed border-gray-200" />

              {format === 'Link' && (
                <div className="space-y-4">
                  {/* 공개 설정 토글 */}
                  {onTogglePublic && (
                    <div className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors ${
                      isPublic ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {isPublic
                          ? <Unlock size={15} className="text-blue-500 flex-shrink-0" />
                          : <Lock size={15} className="text-gray-400 flex-shrink-0" />
                        }
                        <div>
                          <p className={`text-[13px] font-semibold ${isPublic ? 'text-blue-700' : 'text-gray-600'}`}>
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
                          } catch {
                            toast.error('설정 변경에 실패했습니다');
                          }
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

                  {/* 링크 표시 + 복사 */}
                  <div>
                    <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">공유 링크</p>
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
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-medium transition-colors"
                      >
                        {linkCopied ? <Check size={15} /> : <Copy size={15} />}
                        {linkCopied ? '복사됨!' : '링크 복사'}
                      </button>
                      <a
                        href={result}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-[13px] font-medium transition-colors"
                      >
                        <ExternalLink size={15} /> 미리보기
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {format !== 'Link' && (
                <div>
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">미리보기</p>
                  <pre className="whitespace-pre-wrap text-[11.5px] text-gray-600 bg-gray-50 rounded-xl p-4 max-h-56 overflow-auto border border-gray-200">
                    {result}
                  </pre>
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full flex items-center justify-center gap-2 mt-3 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-[13px] font-medium transition-colors"
                  >
                    <Download size={15} /> 다운로드
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-dashed border-gray-200 mx-7" />

        {/* ── Footer ── */}
        <div className="px-7 py-4 flex items-center justify-between">
          {/* 도움말 */}
          <a
            href="mailto:support@fitpoly.kr"
            className="flex items-center gap-1.5 text-[12.5px] text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
          >
            <HelpCircle size={13} /> 도움이 필요하신가요?
          </a>

          {/* 액션 버튼 */}
          <div className="flex items-center gap-2">
            {result ? (
              <button
                onClick={() => { setResult(null); setFormat(null); }}
                className="px-4 py-2 text-[13px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
              >
                다시 선택
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-[13px] text-gray-500 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
              >
                취소
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={!format || exporting}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-xl transition-colors shadow-sm"
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
