import { useState, useRef } from 'react';
import { X, Loader2, Copy, Download, FileText, Globe, Github } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const FORMATS = [
  { key: 'Notion', label: 'Notion 페이지', icon: Globe, desc: 'Notion에 복사하여 붙여넣기', color: 'bg-gray-900 text-white' },
  { key: 'GitHub', label: 'GitHub README', icon: Github, desc: 'README.md 다운로드', color: 'bg-gray-800 text-white' },
  { key: 'PDF', label: 'PDF 파일', icon: FileText, desc: '실제 PDF 파일 다운로드', color: 'bg-red-500 text-white' },
];

function markdownToHtml(md) {
  return md
    .split('\n')
    .map(line => {
      const t = line.trim();
      if (!t) return '<br/>';
      if (t.startsWith('# ')) return `<h1 style="font-size:22px;font-weight:bold;margin:16px 0 8px;border-bottom:2px solid #333;padding-bottom:6px">${t.slice(2)}</h1>`;
      if (t.startsWith('## ')) return `<h2 style="font-size:17px;font-weight:bold;margin:14px 0 6px;color:#1a1a1a">${t.slice(3)}</h2>`;
      if (t.startsWith('### ')) return `<h3 style="font-size:14px;font-weight:bold;margin:10px 0 4px;color:#333">${t.slice(4)}</h3>`;
      if (t.startsWith('---')) return '<hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>';
      if (t.startsWith('- ') || t.startsWith('• ')) return `<p style="font-size:12px;margin:3px 0;padding-left:16px;line-height:1.6">• ${t.slice(2).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`;
      return `<p style="font-size:12px;margin:4px 0;line-height:1.7">${t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`;
    })
    .join('');
}

export default function ExportModal({ type, data, onClose }) {
  const [format, setFormat] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const pdfRef = useRef(null);

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
    setExporting(true);
    try {
      const exportData = buildExportData();
      const isTemplate = ['notion', 'ashley', 'academic', 'timeline'].includes(data.templateType);
      let endpoint;
      if (isTemplate && format === 'Notion') {
        endpoint = '/export/notion-portfolio';
      } else {
        const formatMap = { 'PDF': 'pdf', 'Notion': 'notion', 'GitHub': 'github' };
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

  const handleDownloadPDF = async () => {
    if (!result || !pdfRef.current) return;
    toast.loading('PDF 생성 중...', { id: 'pdf' });
    try {
      const el = pdfRef.current;
      el.style.display = 'block';
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      el.style.display = 'none';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      let y = 0;
      let remaining = imgHeight;
      const usableHeight = pageHeight - margin * 2;

      while (remaining > 0) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, margin - y, contentWidth, imgHeight);
        y += usableHeight;
        remaining -= usableHeight;
      }

      pdf.save(`${data.title || 'export'}.pdf`);
      toast.success('PDF 파일이 다운로드되었습니다', { id: 'pdf' });
    } catch (e) {
      toast.error('PDF 생성에 실패했습니다', { id: 'pdf' });
    }
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
              <div className="grid grid-cols-3 gap-3">
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
                    {format === 'GitHub' && '💡 GitHub README.md에 최적화된 형식으로 변환합니다. 파일을 다운로드하여 리포지토리에 추가하세요.'}
                    {format === 'PDF' && '💡 A4 사이즈에 최적화된 PDF 파일을 생성합니다. 인쇄/제출용으로 활용하세요.'}
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
                {(format === 'Notion' || format === 'GitHub') && (
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
                  >
                    <Copy size={16} /> 클립보드 복사
                  </button>
                )}
                {format === 'GitHub' && (
                  <button
                    onClick={handleDownloadMD}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 transition-colors"
                  >
                    <Download size={16} /> README.md 다운로드
                  </button>
                )}
                {format === 'Notion' && (
                  <button
                    onClick={handleDownloadMD}
                    className="flex items-center justify-center gap-2 px-5 py-3 border border-surface-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-surface-50 transition-colors"
                  >
                    <Download size={16} /> .md 다운로드
                  </button>
                )}
                {format === 'PDF' && (
                  <button
                    onClick={handleDownloadPDF}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    <Download size={16} /> PDF 다운로드
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

      {/* Hidden div for PDF rendering via html2canvas */}
      {result && (
        <div
          ref={pdfRef}
          style={{ display: 'none', position: 'absolute', left: '-9999px', width: '794px', padding: '40px 50px', fontFamily: 'sans-serif', background: '#fff', color: '#222' }}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(result) }}
        />
      )}
    </div>
  );
}
