import { useState, useRef } from 'react';
import { X, Upload, Globe, Github, FileText, Type, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const SOURCES = [
  { key: 'notion', label: 'Notion', icon: Globe, color: 'bg-gray-900 text-white', desc: 'Notion 페이지 URL에서 자동으로 내용을 추출합니다' },
  { key: 'github', label: 'GitHub', icon: Github, color: 'bg-gray-800 text-white', desc: 'GitHub README를 자동으로 분석합니다' },
  { key: 'file', label: '파일 업로드', icon: FileText, color: 'bg-red-500 text-white', desc: 'PDF, 이미지, HWP를 AI가 분석합니다' },
  { key: 'text', label: '직접 입력', icon: Type, color: 'bg-blue-500 text-white', desc: '내용을 직접 붙여넣거나 작성하세요' },
];

export default function ImportModal({ targetType, onClose, onImport }) {
  const [source, setSource] = useState(null);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileObj, setFileObj] = useState(null);
  const [importing, setImporting] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [importedData, setImportedData] = useState(null);
  const [structuredData, setStructuredData] = useState(null);
  const [step, setStep] = useState('select');
  const [manualText, setManualText] = useState('');
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validExts = /\.(pdf|jpg|jpeg|png|webp|hwp|hwpx)$/i;
    if (!validExts.test(file.name)) {
      toast.error('PDF, 이미지(JPG/PNG), HWP 파일만 업로드할 수 있습니다');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('파일 크기는 25MB 이하여야 합니다');
      return;
    }
    setFileObj(file);
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
    const ext = file.name.split('.').pop()?.toLowerCase();
    const typeLabel = ext === 'pdf' ? 'PDF' : ['jpg','jpeg','png','webp'].includes(ext) ? '이미지' : 'HWP';
    toast.success(`${typeLabel} 파일이 선택되었습니다`);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      let response;
      switch (source) {
        case 'notion':
          if (!url.trim()) { toast.error('URL을 입력해주세요'); setImporting(false); return; }
          response = await api.post('/import/notion', { url: url.trim(), targetType }, { timeout: 120000 });
          break;
        case 'github':
          if (!url.trim()) { toast.error('URL을 입력해주세요'); setImporting(false); return; }
          response = await api.post('/import/github', { url: url.trim(), targetType }, { timeout: 120000 });
          break;
        case 'file': {
          if (!fileObj) { toast.error('파일을 업로드해주세요'); setImporting(false); return; }
          const formData = new FormData();
          formData.append('file', fileObj);
          if (targetType) formData.append('targetType', targetType);
          response = await api.post('/import/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
          });
          break;
        }
        case 'text':
          if (!text.trim()) { toast.error('내용을 입력해주세요'); setImporting(false); return; }
          response = await api.post('/import/text', { text: text.trim(), title: title.trim(), targetType }, { timeout: 120000 });
          break;
        default:
          toast.error('소스를 선택해주세요');
          setImporting(false);
          return;
      }

      const { imported, structured } = response.data;
      setImportedData(imported);
      setStructuredData(structured);
      setStep('preview');
      toast.success(structured ? 'AI가 문서를 분석하여 경험을 정리했습니다!' : '데이터를 가져왔습니다!');
    } catch (error) {
      toast.error(error.response?.data?.error || '임포트에 실패했습니다');
    }
    setImporting(false);
  };

  const handleStructure = async () => {
    if (!importedData) return;
    setStructuring(true);
    try {
      const response = await api.post('/import/structure', { importedData, targetType }, { timeout: 60000 });
      setStructuredData(response.data.structured);
      toast.success('AI 구조화가 완료되었습니다!');
    } catch (error) {
      if (error.response?.status === 429) {
        toast.error('AI 요청이 너무 많습니다. 10초 후 다시 시도해주세요.');
      } else {
        toast.error('AI 구조화에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
    setStructuring(false);
  };

  const handleApply = () => {
    // 수동 입력 상태에서 바로 적용하기를 누른 경우, manualText를 반영
    if (importedData?.needsManualInput && manualText.trim()) {
      const updated = {
        ...importedData,
        content: manualText.trim(),
        rawText: manualText.trim(),
        needsManualInput: false,
      };
      onImport({ imported: updated, structured: structuredData });
    } else {
      onImport({ imported: importedData, structured: structuredData });
    }
    onClose();
  };

  const handleManualApply = async () => {
    if (!manualText.trim()) {
      toast.error('내용을 붙여넣어 주세요');
      return;
    }
    const updated = {
      ...importedData,
      content: manualText.trim(),
      rawText: manualText.trim(),
      needsManualInput: false,
    };
    setImportedData(updated);
    setManualText('');

    // PDF처럼 자동으로 AI 구조화 실행
    if (targetType) {
      setStructuring(true);
      try {
        const response = await api.post('/import/structure', { importedData: updated, targetType }, { timeout: 60000 });
        setStructuredData(response.data.structured);
        toast.success('AI 구조화가 완료되었습니다!');
      } catch (error) {
        if (error.response?.status === 429) {
          toast.error('AI 요청이 너무 많습니다. 10초 후 다시 시도해주세요.');
        } else {
          toast.error('AI 구조화에 실패했습니다. 수동으로 편집할 수 있습니다.');
        }
      }
      setStructuring(false);
    }
  };

  // Notion 클립보드 paste 핸들러 — HTML을 우선 파싱하여 구조화된 텍스트 추출
  const handleManualPaste = (e) => {
    const html = e.clipboardData.getData('text/html');
    if (html && html.trim().length > 50) {
      e.preventDefault();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // script / style 제거
      tempDiv.querySelectorAll('script, style, svg, [aria-hidden="true"]').forEach(el => el.remove());

      // 블록 요소들 사이에 줄바꿈 삽입
      tempDiv.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, tr, br').forEach(el => {
        el.insertAdjacentText('afterend', '\n');
      });

      const raw = tempDiv.textContent || tempDiv.innerText || '';
      // 중복 공백·빈줄 정리
      const cleaned = raw
        .split('\n')
        .map(l => l.replace(/\s+/g, ' ').trim())
        .filter(l => l.length > 0)
        .join('\n');

      setManualText(cleaned);
      return;
    }

    // HTML이 없거나 너무 짧을 때: plain text 기본 동작
    const plainText = e.clipboardData.getData('text/plain');
    if (plainText && plainText.trim()) {
      e.preventDefault();
      setManualText(plainText.trim());
    }
  };

  const targetTypeLabel = {
    experience: '경험 정리',
    portfolio: '포트폴리오',
    coverletter: '자기소개서',
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-200">
          <div>
            <h2 className="text-lg font-bold">외부 데이터 불러오기</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {targetTypeLabel[targetType] || '데이터'}에 활용할 내용을 가져옵니다
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'select' && (
            <div className="space-y-6">
              {/* Source Selection */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">데이터 소스 선택</p>
                <div className="grid grid-cols-2 gap-3">
                  {SOURCES.map(({ key, label, icon: Icon, color, desc }) => (
                    <button
                      key={key}
                      onClick={() => { setSource(key); setStep('input'); }}
                      className={`p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        source === key ? 'border-primary-400 bg-primary-50' : 'border-surface-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                        <Icon size={20} />
                      </div>
                      <h4 className="font-bold text-sm mb-1">{label}</h4>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'input' && (
            <div className="space-y-4">
              <button
                onClick={() => { setStep('select'); setSource(null); }}
                className="text-sm text-gray-400 hover:text-gray-600 mb-2"
              >
                ← 소스 다시 선택
              </button>

              <div className="flex items-center gap-2 mb-4">
                {(() => {
                  const s = SOURCES.find(s => s.key === source);
                  const Icon = s?.icon || Globe;
                  return (
                    <>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s?.color || 'bg-gray-500 text-white'}`}>
                        <Icon size={16} />
                      </div>
                      <h3 className="font-bold">{s?.label}에서 가져오기</h3>
                    </>
                  );
                })()}
              </div>

              {/* Notion / GitHub: URL Input */}
              {(source === 'notion' || source === 'github') && (
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    {source === 'notion' ? 'Notion 페이지 URL' : 'GitHub 리포지토리 URL'}
                  </label>
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder={
                      source === 'notion'
                        ? 'https://www.notion.so/your-page-id'
                        : 'https://github.com/username/repository'
                    }
                    className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  {source === 'github' && (
                    <p className="text-xs text-gray-400 mt-2">
                      리포지토리의 README.md를 자동으로 가져옵니다. 특정 파일 URL도 지원합니다.
                    </p>
                  )}
                </div>
              )}

              {/* File Upload (PDF, 이미지, HWP) */}
              {source === 'file' && (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all"
                  >
                    <Upload size={32} className="text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                      {fileName || '파일을 선택하세요'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF, 이미지(JPG/PNG), HWP · 최대 25MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.hwp,.hwpx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {fileObj && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-xs text-green-700 font-medium">✓ {fileName} 선택됨</p>
                      <p className="text-xs text-green-600 mt-1">
                        AI가 서버에서 문서를 분석하여 텍스트를 추출하고 경험을 정리합니다.
                        {fileObj.name.match(/\.(jpg|jpeg|png|webp)$/i) && ' (OCR로 이미지 텍스트 인식)'}
                        {fileObj.name.match(/\.(hwp|hwpx)$/i) && ' (HWP 문서 분석)'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Text: Direct Input */}
              {source === 'text' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">제목 (선택)</label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="내용 제목"
                      className="w-full px-4 py-2.5 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">내용</label>
                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder="포트폴리오, 프로젝트 설명, 경험, 이력서 등의 내용을 붙여넣거나 직접 작성하세요..."
                      rows={10}
                      className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
                    />
                    {text && (
                      <p className="text-xs text-gray-400 mt-1 text-right">{text.length}자</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && importedData && (
            <div className="space-y-4">
              {/* Notion 수동 입력 필요 시 */}
              {importedData.needsManualInput ? (
                <div>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-4">
                    <p className="text-sm font-bold text-yellow-700 mb-1">⚠ Notion 페이지 자동 추출에 실패했습니다</p>
                    <p className="text-xs text-yellow-600">
                      Notion은 JavaScript로 렌더링되어 서버에서 직접 읽을 수 없습니다. 브라우저에서 복사해서 붙여넣으세요 — HTML 서식도 자동으로 텍스트로 변환됩니다.
                    </p>
                  </div>

                  <div className="p-4 bg-surface-50 rounded-xl mb-3">
                    <p className="text-xs font-bold text-gray-600 mb-2">💡 올바른 복사 방법:</p>
                    <ol className="text-xs text-gray-500 space-y-1.5 ml-4 list-decimal">
                      <li>브라우저에서 Notion 페이지를 열어주세요</li>
                      <li>페이지 본문 아무 곳이나 클릭하여 포커스를 맞추세요</li>
                      <li><b>Ctrl + A</b>로 전체 선택</li>
                      <li><b>Ctrl + C</b>로 복사 (HTML 서식 포함됨)</li>
                      <li>아래 입력란 클릭 후 <b>Ctrl + V</b>로 붙여넣기</li>
                    </ol>
                    <p className="text-xs text-primary-600 mt-2 font-medium">✓ 붙여넣기하면 표·목록·제목 등의 서식이 텍스트로 자동 변환됩니다</p>
                  </div>

                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    onPaste={handleManualPaste}
                    placeholder="Notion 페이지 내용을 여기에 붙여넣으세요...&#10;&#10;프로젝트 설명, 기술 스택, 역할, 성과 등의 내용을 포함해주세요."
                    rows={10}
                    className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
                  />
                  {structuring && (
                    <div className="flex items-center justify-center gap-2 mt-3 py-3">
                      <Loader2 size={16} className="animate-spin text-primary-600" />
                      <p className="text-sm text-primary-600">AI가 내용을 분석 중입니다...</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">{manualText ? `${manualText.length}자` : '내용을 붙여넣어 주세요'}</p>
                    <button
                      onClick={handleManualApply}
                      disabled={!manualText.trim() || structuring}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {structuring ? (
                        <><Loader2 size={14} className="animate-spin" /> AI 분석 중...</>
                      ) : (
                        <><Sparkles size={14} /> AI로 분석하기</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Import Summary */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm font-bold text-green-700 mb-1">✓ 데이터를 가져왔습니다</p>
                    <p className="text-xs text-green-600">
                      소스: {importedData.source} | 제목: {importedData.title}
                    </p>
                  </div>

                  {/* Raw Content */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">가져온 원본 내용</p>
                    <div className="p-4 bg-surface-50 rounded-xl max-h-40 overflow-auto">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {importedData.content?.substring(0, 2000)}
                        {(importedData.content?.length || 0) > 2000 && '...'}
                      </pre>
                    </div>
                  </div>

              {/* Structured Result */}
              {structuredData ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-primary-600" />
                    <p className="text-sm font-medium text-gray-700">AI 구조화 결과</p>
                  </div>
                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl">
                    <p className="text-sm font-bold text-primary-700 mb-2">{structuredData.title}</p>
                    {targetType === 'experience' && structuredData.content && (
                      <div className="space-y-2">
                        {Object.entries(structuredData.content).map(([key, val]) => (
                          <div key={key}>
                            <span className="text-xs font-bold text-primary-600">{key}: </span>
                            <span className="text-xs text-gray-600">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {targetType === 'portfolio' && structuredData.sections && (
                      <div className="space-y-1">
                        {structuredData.sections.map((s, i) => (
                          <p key={i} className="text-xs text-gray-600">• {s.title}: {s.content?.substring(0, 80)}...</p>
                        ))}
                      </div>
                    )}
                    {targetType === 'coverletter' && (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-600">{structuredData.summary}</p>
                        {structuredData.suggestedQuestions?.map((q, i) => (
                          <p key={i} className="text-xs text-gray-500">• {q}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleStructure}
                  disabled={structuring}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-primary-300 rounded-xl text-sm text-primary-600 hover:bg-primary-50 transition-all"
                >
                  {structuring ? (
                    <><Loader2 size={16} className="animate-spin" /> AI 구조화 중...</>
                  ) : (
                    <><Sparkles size={16} /> AI로 자동 구조화하기</>
                  )}
                </button>
              )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-surface-200 flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-500 hover:bg-surface-100 rounded-xl transition-colors"
          >
            취소
          </button>
          <div className="flex-1" />
          {step === 'input' && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {importing ? (
                <><Loader2 size={16} className="animate-spin" /> AI 분석 중...</>
              ) : (
                <><Upload size={16} /> AI로 불러오기</>
              )}
            </button>
          )}
          {step === 'preview' && (
            <button
              onClick={handleApply}
              disabled={structuring || (importedData?.needsManualInput && !manualText.trim())}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRight size={16} /> 적용하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
