import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ScrollText, PenLine, Paperclip, Upload, Trash2, Plus, Loader2, ExternalLink, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import ResumeExportModal from '../ResumeExportModal';
import DocumentFileIcon from '../DocumentFileIcon';

// 기업 폴더 안쪽 — 이력서 · 자소서 · 기타 서류를 관리한다. 포트폴리오는 위쪽 서류 보드에 나온다.
// 파일은 /upload/document 로 올리고, 목록과 자소서 답변은 /company-folders 에 저장한다.

const ACCEPT = '.pdf,.doc,.docx,.hwp,.hwpx,.txt,.md,.ppt,.pptx,.jpg,.jpeg,.png';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export default forwardRef(function CompanyFolderPanel({ company, folder, portfolios, coverLetters = [], onCreateCoverLetter, onOpenCoverLetter, onSaved }, ref) {
  const files = folder?.files || [];
  const [essays, setEssays] = useState(folder?.essays || []);
  const [essayState, setEssayState] = useState('idle'); // idle | saving | saved | error
  const [uploading, setUploading] = useState(null);     // 업로드 중인 category
  const [resumeFrom, setResumeFrom] = useState(null);   // 이력서로 만들 포트폴리오
  const saveTimer = useRef(null);
  const pendingSave = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const revision = useRef(0);
  const mounted = useRef(true);

  useImperativeHandle(ref, () => ({
    async flush() {
      clearTimeout(saveTimer.current);
      pendingSave.current?.();
      return (await saveQueue.current) !== false;
    },
  }), []);

  // The parent keys this editor by company. Late saves can refresh an untouched editor.
  useEffect(() => {
    if (revision.current === 0) setEssays(folder?.essays || []);
  }, [folder?.essays]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(saveTimer.current);
      // Switching folders must flush the last keystrokes, not discard the debounce.
      pendingSave.current?.();
    };
  }, []);

  const save = async (patch) => {
    const { data } = await api.put('/company-folders', { company, ...patch });
    onSaved(data);
    return data;
  };

  const upload = async (category, file) => {
    if (!file) return;
    setUploading(category);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/document', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      await save({
        files: [...files, {
          id: newId(), category, name: file.name || data.originalName, url: data.url,
          size: data.size || file.size, uploadedAt: new Date().toISOString(),
        }],
      });
      toast.success('파일을 올렸습니다');
    } catch (e) {
      toast.error(e?.response?.data?.error || '파일을 올리지 못했습니다');
    }
    setUploading(null);
  };

  const removeFile = async (file) => {
    if (!window.confirm(`"${file.name}" 파일을 이 폴더에서 뺄까요?`)) return;
    try {
      await save({ files: files.filter(f => f.id !== file.id) });
    } catch {
      toast.error('파일을 빼지 못했습니다');
    }
  };

  // 자소서는 입력이 멈추면 자동 저장
  const updateEssays = (next) => {
    setEssays(next);
    setEssayState('saving');
    clearTimeout(saveTimer.current);
    const version = ++revision.current;
    const flush = () => {
      pendingSave.current = null;
      // Requests stay in order even when a slow save overlaps the next edit.
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await save({ essays: next });
          if (mounted.current && revision.current === version) setEssayState('saved');
          return true;
        } catch {
          if (mounted.current && revision.current === version) {
            setEssayState('error');
            pendingSave.current = flush;
          }
          toast.error(`${company} 자소서를 저장하지 못했습니다`);
          return false;
        }
      });
    };
    pendingSave.current = flush;
    saveTimer.current = setTimeout(flush, 800);
  };
  const patchEssay = (id, patch) => updateEssays(essays.map(e => (e.id === id ? { ...e, ...patch } : e)));
  const addEssay = () => updateEssays([...essays, { id: newId(), question: '', answer: '', limit: 0 }]);
  const removeEssay = (id) => {
    const target = essays.find(e => e.id === id);
    if ((target?.answer || target?.question) && !window.confirm('이 문항을 삭제할까요?')) return;
    updateEssays(essays.filter(e => e.id !== id));
  };

  const filesOf = (category) => files.filter(f => f.category === category);

  return (
    <div className="space-y-5">
      {/* 이력서 */}
      <Section
        icon={ScrollText}
        title="이력서"
        count={filesOf('resume').length}
        action={(
          <div className="flex flex-wrap items-center gap-3">
            {portfolios.length > 0 && (
              <button type="button" onClick={() => setResumeFrom(portfolios[0])} className="text-[13px] font-semibold text-bluewood-500 hover:text-primary-600">
                포트폴리오로 이력서 만들기
              </button>
            )}
            <UploadButton busy={!!uploading} onFile={f => upload('resume', f)} />
          </div>
        )}
      >
        <FileList files={filesOf('resume')} onRemove={removeFile} emptyText="이력서 파일(PDF·DOCX·HWP)을 올려 두세요." />
      </Section>

      {/* 자소서 */}
      <Section
        id="company-essays"
        icon={PenLine}
        title="자기소개서"
        count={coverLetters.length + essays.length + filesOf('coverLetter').length}
        action={(
          <div className="flex flex-wrap items-center gap-3">
            {onCreateCoverLetter && <button type="button" onClick={onCreateCoverLetter} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-600 hover:text-primary-700"><Plus size={14} /> 공고로 자소서 쓰기</button>}
            <span className="text-[12px] text-bluewood-300" role="status">
              {essayState === 'saving' ? '저장 중…' : essayState === 'saved' ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={12} /> 저장됨</span> : essayState === 'error' ? <button type="button" className="text-red-600 underline" onClick={() => { setEssayState('saving'); pendingSave.current?.(); }}>저장 실패 · 다시 시도</button> : ''}
            </span>
            <button type="button" onClick={addEssay} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary-600 hover:text-primary-700">
              <Plus size={14} /> 문항 추가
            </button>
            <UploadButton busy={!!uploading} onFile={f => upload('coverLetter', f)} />
          </div>
        )}
      >
        {coverLetters.length > 0 && <ul className="mb-4 divide-y divide-surface-100 rounded-xl border border-surface-100">{coverLetters.map(letter => <li key={letter.id}><button type="button" onClick={() => onOpenCoverLetter?.(letter)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-50"><DocumentFileIcon kind="cover" className="document-file-icon--small" /><span className="min-w-0 flex-1"><b className="block truncate text-[13px] text-bluewood-700">{letter.title || '새 자기소개서'}</b><small className="text-bluewood-400">{[letter.targetPosition, letter.status === 'final' ? '작성 완료' : '작성 중'].filter(Boolean).join(' · ')}</small></span><ExternalLink size={14} className="text-bluewood-400" /></button></li>)}</ul>}
        {essays.length === 0 && filesOf('coverLetter').length === 0 ? (
          !coverLetters.length && <Empty text="공고로 자소서를 시작하거나, 문항을 직접 쓰고 기존 파일을 올려 두세요." />
        ) : (
          <div className="space-y-3">
            {essays.map((e, i) => (
              <EssayItem key={e.id} index={i} essay={e} onChange={patch => patchEssay(e.id, patch)} onRemove={() => removeEssay(e.id)} />
            ))}
            {filesOf('coverLetter').length > 0 && (
              <FileList files={filesOf('coverLetter')} onRemove={removeFile} />
            )}
          </div>
        )}
      </Section>

      {/* 기타 서류 */}
      <Section
        icon={Paperclip}
        title="기타 서류"
        count={filesOf('etc').length}
        action={<UploadButton busy={!!uploading} onFile={f => upload('etc', f)} />}
      >
        <FileList files={filesOf('etc')} onRemove={removeFile} emptyText="성적증명서, 자격증, 경력기술서 등을 함께 보관하세요." />
      </Section>

      {resumeFrom && (
        <ResumeExportModal portfolio={resumeFrom} onClose={() => setResumeFrom(null)} />
      )}
    </div>
  );
});

function Section({ id, icon: Icon, title, count, action, children }) {
  return (
    <section id={id} className="fp-company-section scroll-mt-24 rounded-2xl border border-surface-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-bluewood-800">
          <Icon size={16} className="text-bluewood-400" />
          {title}
          <span className="text-[13px] font-semibold text-bluewood-300">{count}</span>
        </h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ text }) {
  return <p className="py-3 text-center text-[13px] text-bluewood-300">{text}</p>;
}

function UploadButton({ busy, onFile }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-[12.5px] font-semibold text-bluewood-600 hover:border-primary-300 hover:text-primary-600 disabled:opacity-60"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} 파일 올리기
      </button>
    </>
  );
}

function FileList({ files, onRemove, emptyText }) {
  if (!files.length) return emptyText ? <Empty text={emptyText} /> : null;
  return (
    <ul className="divide-y divide-surface-100 rounded-xl border border-surface-100">
      {files.map(f => (
        <li key={f.id} className="flex items-center gap-3 px-3.5 py-2.5">
          <DocumentFileIcon file={f} className="document-file-icon--small" />
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-bluewood-700 hover:text-primary-600">
            {f.name}
          </a>
          <span className="flex-shrink-0 text-[12px] text-bluewood-300">
            {[formatSize(f.size), f.uploadedAt ? f.uploadedAt.slice(0, 10).replace(/-/g, '.') : ''].filter(Boolean).join(' · ')}
          </span>
          <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label="열기" className="flex h-8 w-8 items-center justify-center rounded-lg text-bluewood-400 hover:bg-surface-100 hover:text-bluewood-700">
            <ExternalLink size={14} />
          </a>
          <button type="button" onClick={() => onRemove(f)} aria-label="폴더에서 빼기" className="flex h-8 w-8 items-center justify-center rounded-lg text-bluewood-400 hover:bg-red-50 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function EssayItem({ index, essay, onChange, onRemove }) {
  const len = (essay.answer || '').length;
  const over = essay.limit > 0 && len > essay.limit;
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50/40 p-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-2 flex-shrink-0 text-[12px] font-bold text-bluewood-400">Q{index + 1}</span>
        <input
          value={essay.question}
          onChange={e => onChange({ question: e.target.value })}
          placeholder="문항을 입력하세요 (예: 지원 동기와 입사 후 포부)"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[14px] font-semibold text-bluewood-800 placeholder:font-normal placeholder:text-bluewood-300 hover:border-surface-200 focus:border-primary-300 focus:bg-white focus:outline-none"
        />
        <button type="button" onClick={onRemove} aria-label="문항 삭제" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-bluewood-300 hover:bg-red-50 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>
      <textarea
        value={essay.answer}
        onChange={e => onChange({ answer: e.target.value })}
        placeholder="답변을 작성하세요"
        rows={5}
        className="mt-2 w-full resize-y rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-[14px] leading-relaxed text-bluewood-700 placeholder:text-bluewood-300 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
      />
      <div className="mt-1.5 flex items-center justify-end gap-2 text-[12px]">
        <span className={over ? 'font-semibold text-red-500' : 'text-bluewood-400'}>
          {len.toLocaleString()}자{essay.limit > 0 ? ` / ${essay.limit.toLocaleString()}자` : ''}
        </span>
        <label className="flex items-center gap-1 text-bluewood-300">
          제한
          <input
            type="number"
            min={0}
            value={essay.limit || ''}
            onChange={e => onChange({ limit: Math.max(0, Number(e.target.value) || 0) })}
            placeholder="없음"
            className="w-16 rounded-md border border-surface-200 bg-white px-1.5 py-0.5 text-right text-bluewood-600 focus:border-primary-300 focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}
