import { useState, useRef, useCallback } from 'react';
import { X, Loader2, Sparkles, Link as LinkIcon, Info, Trash2, CheckCircle2, UploadCloud } from 'lucide-react';
import { importFileUpload, importFromUrl, structureImportedData } from '../services/importAI';
import toast from 'react-hot-toast';

export default function ImportModal({ targetType, onClose, onImport }) {
  const [files, setFiles] = useState([]);
  const [url, setUrl] = useState('');
  const [urlType, setUrlType] = useState('notion');
  const [importing, setImporting] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [importedData, setImportedData] = useState(null);
  const [structuredData, setStructuredData] = useState(null);
  const [step, setStep] = useState('upload');
  const [manualText, setManualText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', color: 'bg-red-500' };
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return { label: 'IMG', color: 'bg-blue-500' };
    return { label: 'HWP', color: 'bg-green-700' };
  };

  const addFiles = useCallback((newFiles) => {
    const valid = Array.from(newFiles).filter(f => {
      if (!/\.(pdf|jpg|jpeg|png|webp|hwp|hwpx)$/i.test(f.name)) {
        toast.error(`${f.name}: PDF, 이미지(JPG/PNG), HWP 파일만 업로드할 수 있습니다`);
        return false;
      }
      if (f.size > 25 * 1024 * 1024) {
        toast.error(`${f.name}: 파일 크기는 25MB 이하여야 합니다`);
        return false;
      }
      return true;
    });
    if (!valid.length) return;
    setFiles(prev => [
      ...prev,
      ...valid.map(f => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        name: f.name,
        size: f.size,
      })),
    ]);
  }, []);

  const handleFileInput = (e) => { addFiles(e.target.files); e.target.value = ''; };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); };
  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id));

  const handleImport = async () => {
    const hasFiles = files.length > 0;
    const hasUrl = url.trim().length > 0;
    if (!hasFiles && !hasUrl) {
      toast.error('파일을 업로드하거나 URL을 입력해주세요');
      return;
    }
    setImporting(true);
    try {
      let data;
      if (hasFiles) {
        const formData = new FormData();
        formData.append('file', files[0].file);
        if (targetType) formData.append('targetType', targetType);
        data = await importFileUpload(formData);
      } else {
        const source = urlType === 'github' ? 'github' : 'notion';
        data = await importFromUrl(source, url, targetType);
      }

      const { imported, structured } = data;
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
      const data = await structureImportedData(importedData, targetType);
      setStructuredData(data.structured);
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
        const data = await structureImportedData(updated, targetType);
        setStructuredData(data.structured);
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <UploadCloud size={17} className="text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900">
              {step === 'upload' ? '파일 업로드' : '분석 결과 확인'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {step === 'upload'
                ? `${targetTypeLabel[targetType] || '경험'} 분석에 활용할 파일을 올려주세요`
                : 'AI가 분석한 내용을 확인하고 적용하세요'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
            <X size={17} className="text-gray-500" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto">

          {/* ── STEP: upload ── */}
          {step === 'upload' && (
            <div className="p-6 space-y-4">

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl px-6 py-8 text-center cursor-pointer transition-all select-none ${
                  isDragging
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                }`}
              >
                <UploadCloud
                  size={28}
                  className={`mx-auto mb-3 transition-colors ${isDragging ? 'text-blue-400' : 'text-gray-400'}`}
                />
                <p className="text-sm font-semibold text-gray-700">
                  파일을 선택하거나 드래그해서 올려주세요.
                </p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  PDF, JPG/PNG, HWP 형식 · 최대 25MB
                </p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="mt-4 px-5 py-2 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors shadow-sm"
                >
                  파일 선택
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.hwp,.hwpx"
                onChange={handleFileInput}
                multiple
                className="hidden"
              />

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map(f => {
                    const icon = getFileIcon(f.name);
                    return (
                      <div key={f.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-white shadow-sm">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${icon.color}`}>
                          <span className="text-white text-[9px] font-bold tracking-wide">{icon.label}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{f.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-gray-400">{formatSize(f.size)}</span>
                            <span className="text-gray-300">·</span>
                            <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                              <CheckCircle2 size={11} />
                              준비 완료
                            </span>
                          </div>
                          <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full w-full" />
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(f.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 size={13} className="text-gray-400" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* OR Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium">또는</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* URL Import */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <p className="text-xs font-semibold text-gray-700">URL에서 가져오기</p>
                  <div className="group relative">
                    <Info size={13} className="text-gray-400 cursor-help" />
                    <div className="absolute left-5 -top-1 w-52 bg-gray-800 text-white text-[11px] rounded-lg px-2.5 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 leading-relaxed">
                      Notion 페이지나 GitHub README를 AI로 자동 분석합니다
                    </div>
                  </div>
                </div>

                {/* URL Type Tabs */}
                <div className="flex gap-2 mb-2.5">
                  {[
                    { key: 'notion', label: 'Notion' },
                    { key: 'github', label: 'GitHub' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setUrlType(key)}
                      className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                        urlType === key
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* URL Input */}
                <div className="relative">
                  <LinkIcon size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder={
                      urlType === 'notion'
                        ? 'Notion 페이지 URL 붙여넣기'
                        : 'GitHub 리포지토리 URL 붙여넣기'
                    }
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-400 transition-all placeholder:text-gray-400"
                  />
                </div>
                {urlType === 'github' && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    리포지토리의 README.md를 자동으로 가져옵니다.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── STEP: preview ── */}
          {step === 'preview' && importedData && (
            <div className="p-6 space-y-4">
              {importedData.needsManualInput ? (
                /* Notion 수동 입력 필요 시 */
                <div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <p className="text-sm font-bold text-amber-700 mb-1">Notion 자동 추출 실패</p>
                    <p className="text-xs text-amber-600 leading-relaxed">
                      Notion은 JavaScript 렌더링 방식이라 서버에서 직접 읽을 수 없습니다.
                      브라우저에서 복사해서 아래에 붙여넣으세요.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl mb-3">
                    <p className="text-xs font-bold text-gray-600 mb-2">올바른 복사 방법</p>
                    <ol className="text-xs text-gray-500 space-y-1 ml-4 list-decimal leading-relaxed">
                      <li>브라우저에서 Notion 페이지 열기</li>
                      <li>본문 클릭 후 <b>Ctrl+A</b> → <b>Ctrl+C</b></li>
                      <li>아래 입력란에 <b>Ctrl+V</b> 붙여넣기</li>
                    </ol>
                    <p className="text-xs text-blue-600 mt-2 font-medium">
                      표·목록·제목 서식이 텍스트로 자동 변환됩니다
                    </p>
                  </div>

                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    onPaste={handleManualPaste}
                    placeholder="Notion 페이지 내용을 여기에 붙여넣으세요..."
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-200 resize-y"
                  />
                  {structuring && (
                    <div className="flex items-center justify-center gap-2 mt-3 py-2">
                      <Loader2 size={15} className="animate-spin text-gray-600" />
                      <p className="text-sm text-gray-600">AI가 내용을 분석 중입니다...</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">
                      {manualText ? `${manualText.length}자` : '내용을 붙여넣어 주세요'}
                    </p>
                    <button
                      onClick={handleManualApply}
                      disabled={!manualText.trim() || structuring}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {structuring
                        ? <><Loader2 size={13} className="animate-spin" /> 분석 중...</>
                        : <><Sparkles size={13} /> AI로 분석하기</>
                      }
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Import 완료 */}
                  <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">데이터를 가져왔습니다</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {importedData.source} · {importedData.title}
                      </p>
                    </div>
                  </div>

                  {/* 원본 내용 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-2">가져온 원본 내용</p>
                    <div className="p-3 bg-gray-50 rounded-xl max-h-40 overflow-auto border border-gray-100">
                      <pre className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                        {importedData.content?.substring(0, 2000)}
                        {(importedData.content?.length || 0) > 2000 && '\n...'}
                      </pre>
                    </div>
                  </div>

                  {/* AI 구조화 결과 */}
                  {structuredData ? (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles size={14} className="text-gray-700" />
                        <p className="text-xs font-semibold text-gray-700">AI 구조화 결과</p>
                      </div>
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                        <p className="text-sm font-bold text-gray-800 mb-2">{structuredData.title}</p>
                        {targetType === 'experience' && structuredData.content && (
                          <div className="space-y-1.5">
                            {Object.entries(structuredData.content).map(([key, val]) => (
                              <div key={key}>
                                <span className="text-xs font-semibold text-gray-600">{key}: </span>
                                <span className="text-xs text-gray-500">{val}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {targetType === 'portfolio' && structuredData.sections && (
                          <div className="space-y-1">
                            {structuredData.sections.map((s, i) => (
                              <p key={i} className="text-xs text-gray-500">· {s.title}: {s.content?.substring(0, 80)}...</p>
                            ))}
                          </div>
                        )}
                        {targetType === 'coverletter' && (
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">{structuredData.summary}</p>
                            {structuredData.suggestedQuestions?.map((q, i) => (
                              <p key={i} className="text-xs text-gray-400">· {q}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleStructure}
                      disabled={structuring}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      {structuring
                        ? <><Loader2 size={14} className="animate-spin" /> AI 구조화 중...</>
                        : <><Sparkles size={14} /> AI로 자동 구조화하기</>
                      }
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
          >
            취소
          </button>
          <div className="flex-1" />

          {step === 'upload' && (
            <button
              onClick={handleImport}
              disabled={importing || (files.length === 0 && !url.trim())}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {importing
                ? <><Loader2 size={15} className="animate-spin" /> AI 분석 중...</>
                : <><Sparkles size={15} /> AI로 분석하기</>
              }
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors"
              >
                다시 업로드
              </button>
              {!importedData?.needsManualInput && (
                <button
                  onClick={handleApply}
                  disabled={structuring}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors"
                >
                  적용하기
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
