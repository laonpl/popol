import { useRef, useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import FileCat from './FileCat';
import toast from 'react-hot-toast';
import useModalBehavior from '../hooks/useModalBehavior';
import useAuthStore from '../stores/authStore';
import useExperienceStore from '../stores/experienceStore';
import { importFileUpload } from '../services/importAI';
import { buildDraftStructuredResult } from '../utils/experienceDraft';

/* 이력서·포트폴리오 한 부에서 경험을 여러 개 뽑아 한 번에 경험 정리에 넣는다.
   AI가 뽑은 목록은 사용자가 고른 것만 저장하고, 각 경험은 '확인 필요' 초안으로 남긴다. */

const normalizeTitle = value => String(value || '').replace(/\s+/g, '').toLowerCase();

export default function ResumeImportModal({ onClose, onImported = onClose, embedded = false }) {
  const user = useAuthStore(state => state.user);
  const { experiences, createExperience, fetchExperiences } = useExperienceStore();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState('upload'); // upload → analyzing → review → saving
  const busy = step === 'analyzing' || step === 'saving';
  const { ref: panelRef, backdropProps } = useModalBehavior(!embedded, () => { if (!busy) onClose(); });
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const existingTitles = new Set(experiences.map(exp => normalizeTitle(exp.title)));

  const analyze = async () => {
    if (!file) return;
    setStep('analyzing');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetType', 'resume');
      // A direct visit to the new entry page may not have loaded the hub yet.
      const [{ structured }] = await Promise.all([
        importFileUpload(formData),
        embedded ? fetchExperiences(user.uid) : Promise.resolve(),
      ]);
      const found = structured?.experiences || [];
      if (found.length === 0) {
        toast.error('문서에서 경험을 찾지 못했어요. 다른 파일로 시도하거나 직접 추가해주세요.');
        setStep('upload');
        return;
      }
      setItems(found);
      const knownTitles = new Set(useExperienceStore.getState().experiences.map(exp => normalizeTitle(exp.title)));
      setSelected(new Set(found.map((item, i) => (knownTitles.has(normalizeTitle(item.title)) ? null : i)).filter(i => i !== null)));
      setStep('review');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || '파일 분석에 실패했습니다');
      setStep('upload');
    }
  };

  const toggle = index => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  const save = async () => {
    const chosen = items.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setStep('saving');
    let created = 0;
    for (const item of chosen) {
      const rawInput = [
        `경험: ${item.title}`,
        item.organization && `소속: ${item.organization}`,
        item.period && `기간: ${item.period}`,
        item.role && `역할: ${item.role}`,
        item.context && `배경: ${item.context}`,
        item.action && `한 일: ${item.action}`,
        item.result && `결과: ${item.result}`,
        item.learning && `배운 점: ${item.learning}`,
        // 포트폴리오에서 이 경험에 해당하는 원문 구간 — 'AI로 완성하기'가 요약이 아닌 원래 설명을 보게 한다.
        item.sourceText && `\n=== 원본 문서 발췌 ===\n${item.sourceText}`,
      ].filter(Boolean).join('\n');
      const structuredResult = buildDraftStructuredResult({
        title: item.title,
        period: item.period,
        jobCategory: item.jobCategory,
        collectedText: rawInput,
        content: { rawInput },
        moments: [{
          title: item.title,
          context: item.context,
          action: item.action,
          result: item.result,
          learning: item.learning,
          keywords: item.keywords,
        }],
      });
      structuredResult.projectOverview = { ...(structuredResult.projectOverview || {}), role: item.role };
      try {
        await createExperience(user.uid, {
          title: item.title,
          framework: 'STRUCTURED',
          period: item.period,
          category: item.category,
          jobCategory: item.jobCategory,
          content: { rawInput },
          structuredResult,
          keywords: item.keywords,
          lifecycleStatus: 'needs_confirmation',
          analysisMode: 'resume_import',
        });
        created += 1;
      } catch (error) {
        console.error('이력서 경험 저장 실패:', item.title, error);
      }
    }
    if (created === chosen.length) toast.success(`경험 ${created}개를 추가했어요. 각 경험을 열어 내용을 확인해주세요.`);
    else toast.error(`${chosen.length}개 중 ${created}개만 저장했어요. 나머지는 다시 시도해주세요.`);
    onImported();
  };

  return (
    <div className={embedded ? 'fp-resume-import' : 'fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4'} {...(!embedded ? backdropProps : {})}>
      <div
        ref={panelRef}
        role={embedded ? 'region' : 'dialog'}
        aria-modal={embedded ? undefined : true}
        aria-label="이력서·포트폴리오로 경험 가져오기"
        tabIndex={-1}
        className={embedded ? 'fp-resume-import-panel' : 'bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] outline-none'}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
            <FileText size={17} className="text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900">
              {step === 'review' ? `경험 ${items.length}개를 찾았어요` : '이력서·포트폴리오로 가져오기'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {step === 'review'
                ? '경험 정리에 넣을 항목을 골라주세요'
                : '기존 이력서나 포트폴리오를 올리면 경험을 하나씩 나눠 정리해 드려요'}
            </p>
          </div>
          {!embedded && <button onClick={onClose} disabled={busy} aria-label="가져오기 닫기" className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 disabled:opacity-40">
            <X size={17} className="text-gray-500" />
          </button>}
        </div>

        <div className="flex-1 overflow-auto">
          {step === 'upload' && (
            <div className="p-6 space-y-4">
              <button type="button"
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-2xl px-6 py-8 text-center cursor-pointer transition-all select-none ${
                  isDragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                }`}
              >
                <UploadCloud size={28} className={`mx-auto mb-3 ${isDragging ? 'text-primary-500' : 'text-gray-400'}`} />
                <span className="block text-sm font-semibold text-gray-700">이력서 또는 포트폴리오 파일을 올려주세요</span>
                <span className="block text-xs text-gray-400 mt-1">PDF, Word(DOCX), PPTX, HWP, 이미지 · 최대 25MB</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.pptx,.hwp,.hwpx,.jpg,.jpeg,.png,.webp,.txt,.md"
                onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); e.target.value = ''; }}
                className="hidden"
              />
              {file && (
                <div className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl bg-white shadow-sm">
                  <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-gray-800 truncate flex-1">{file.name}</p>
                  <button onClick={() => setFile(null)} className="text-xs text-gray-400 hover:text-gray-600">삭제</button>
                </div>
              )}
              <p className="text-[12px] text-gray-400 leading-relaxed">
                문서에 적힌 내용만 옮겨요. 없는 성과는 지어내지 않으니, 저장 후 각 경험을 열어 빈 부분을 채워주세요.
              </p>
            </div>
          )}

          {busy && (
            <div className="p-10 flex flex-col items-center gap-3 text-center">
              <FileCat variant={step === 'analyzing' ? 'reading' : 'loading'} withDocuments className="h-32 w-32" />
              <p className="text-sm font-semibold text-gray-700">
                {step === 'analyzing' ? '문서에서 경험을 찾고 있어요' : '경험을 저장하고 있어요'}
              </p>
              {step === 'analyzing' && <p className="text-xs text-gray-400">파일에 따라 1~2분 걸릴 수 있어요</p>}
            </div>
          )}

          {step === 'review' && (
            <ul className="p-4 space-y-2">
              {items.map((item, i) => {
                const duplicate = existingTitles.has(normalizeTitle(item.title));
                return (
                  <li key={i}>
                    <label className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selected.has(i) ? 'border-primary-200 bg-primary-50/40' : 'border-gray-100 hover:bg-gray-50'
                    }`}>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="mt-1 accent-primary-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900">{item.title}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5">
                          {[item.category, item.period || '기간 없음', item.role].filter(Boolean).join(' · ')}
                        </p>
                        {(item.result || item.action) && (
                          <p className="text-[12px] text-gray-600 mt-1 line-clamp-2">{item.result || item.action}</p>
                        )}
                        {duplicate && <p className="text-[12px] text-amber-600 mt-1">이미 같은 이름의 경험이 있어요</p>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {(step === 'upload' || step === 'review') && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            {step === 'review' && (
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
                다른 파일
              </button>
            )}
            <button
              onClick={step === 'upload' ? analyze : save}
              disabled={step === 'upload' ? !file : selected.size === 0}
              className="px-5 py-2 text-sm font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40"
            >
              {step === 'upload' ? '경험 찾기' : `선택한 ${selected.size}개 추가`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
