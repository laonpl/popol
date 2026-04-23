import { useState } from 'react';
import { X, Loader2, Copy, Download, FileText, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const FORMATS = [
  { key: 'Notion', label: 'Notion 페이지', icon: Globe, desc: 'Notion에 복사하여 붙여넣기', color: 'bg-gray-900 text-white' },
  { key: 'PPT', label: 'PPT 파일', icon: FileText, desc: '고퀄리티 기업 제출용 PPT', color: 'bg-red-500 text-white' },
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

export default function ExportModal({ type, data, onClose }) {
  const [format, setFormat] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

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
        // 템플릿 포트폴리오: education/experiences/awards/skills 등 별도 필드에 실제 내용 있음
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

    // 템플릿 포트폴리오의 PPT 내보내기 → 전용 PPT 페이지로 이동
    const isTemplate = ['notion', 'ashley', 'academic', 'timeline'].includes(data.templateType);
    if (isTemplate && format === 'PPT' && data.id) {
      onClose();
      window.location.href = `/app/portfolio/pdf/${data.id}`;
      return;
    }

    setExporting(true);
    try {
      const exportData = buildExportData();
      let endpoint;
      if (isTemplate && format === 'Notion') {
        endpoint = '/export/notion-portfolio';
      } else {
        const formatMap = { 'PPT': 'ppt', 'Notion': 'notion', 'GitHub': 'github' };
        endpoint = `/export/${formatMap[format]}`;
      }
      const res = await api.post(endpoint, { data: exportData }, { timeout: 60000 });
      if (res.data.content) {
        setResult(res.data.content);
      }
    } catch (error) {
      toast.error('내보내기에 실패했습니다');
    }
    setExporting(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    toast.success('클립보드에 복사되었습니다! Notion/GitHub에 붙여넣기하세요.');
  };

  const handleDownloadMD = () => {
    if (!result) return;
    const ext = format === 'GitHub' ? 'md' : 'md';
    const blob = new Blob([result], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${data.title || 'export'}.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('파일이 다운로드되었습니다');
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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <div>
            <h2 className="text-lg font-bold">내보내기</h2>
            <p className="text-sm text-gray-400 mt-0.5">{data.title || '내보내기'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!result ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700 mb-3">내보내기 형식 선택</p>
              <div className="grid grid-cols-2 gap-3">
                {FORMATS.map(({ key, label, icon: Icon, desc, color }) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                      format === key ? 'border-primary-400 bg-primary-50' : 'border-surface-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}>
                      <Icon size={18} />
                    </div>
                    <h4 className="font-bold text-sm">{label}</h4>
                    <p className="text-xs text-gray-400 mt-1">{desc}</p>
                  </button>
                ))}
              </div>

              {format && (
                <div className="p-4 bg-surface-50 rounded-xl">
                  <p className="text-xs text-gray-500">
                    {format === 'Notion' && '💡 Notion에 최적화된 Markdown으로 변환합니다. 복사 후 Notion에 붙여넣기하세요.'}
                    {format === 'PPT' && '💡 원티드 합격 포트폴리오 기반의 고퀄리티 PPT를 생성합니다. 직무별 최적화 레이아웃을 지원합니다.'}
                  </p>
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={!format || exporting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {exporting ? (
                  <><Loader2 size={18} className="animate-spin" /> AI 변환 중...</>
                ) : (
                  <><Download size={18} /> 내보내기</>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-sm font-bold text-green-700">✓ {format} 형식으로 변환 완료</p>
              </div>

              <div className="flex gap-2">
                {format === 'Notion' && (
                  <>
                    <button
                      onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Copy size={16} /> 클립보드 복사
                    </button>
                    <button
                      onClick={handleDownloadMD}
                      className="flex items-center justify-center gap-2 px-5 py-3 border border-surface-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
                    >
                      <Download size={16} /> .md 다운로드
                    </button>
                  </>
                )}
                {format === 'PPT' && (
                  <button
                    onClick={handleDownloadPDF}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    <Download size={16} /> PPT 다운로드
                  </button>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2">미리보기</p>
                <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-surface-50 rounded-xl p-4 max-h-64 overflow-auto border border-surface-100">
                  {result}
                </pre>
              </div>

              <button
                onClick={() => { setResult(null); setFormat(null); }}
                className="w-full py-2.5 text-sm text-gray-500 hover:bg-surface-100 rounded-xl transition-colors"
              >
                다른 형식으로 내보내기
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-surface-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-500 hover:bg-surface-100 rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
