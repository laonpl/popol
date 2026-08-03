import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore, { JOB_CATEGORIES } from '../../stores/experienceStore';
import { importFileUpload } from '../../services/importAI';
import { buildDraftStructuredResult, buildInterviewMoment, cleanRawText } from '../../utils/experienceDraft';

/* 작은 CSS 스피너 (아이콘 미사용) */
function Spinner({ light = false, size = 16 }) {
  return (
    <span
      className={`inline-block rounded-full animate-spin ${light ? 'border-white/40 border-t-white' : 'border-primary-200 border-t-primary-600'}`}
      style={{ width: size, height: size, borderWidth: 2 }}
    />
  );
}

/* 대화형 추출 인터뷰 — 초안/파일 → AI가 핵심 정보를 묻고 답을 받아 경험 정리 생성 */
export default function ExperienceInterview() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { generateInterviewQuestions, createExperience, draftAnalyze } = useExperienceStore();

  const [phase, setPhase] = useState('intro'); // intro | interview | review | building
  const [title, setTitle] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [jobCategory, setJobCategory] = useState('common');
  const [braindump, setBraindump] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [sourceText, setSourceText] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState(0);
  const [genLoading, setGenLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const [showExample, setShowExample] = useState(false);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    setShowExample(false);
  }, [current, phase]);

  // 작성 마찰을 낮추는 빠른 시작 문구 (탭하면 답변에 삽입)
  const STARTERS = [
    { label: '+ 수치', text: '수치로 말하면 ' },
    { label: '+ 내가 한 일', text: '제가 직접 한 건 ' },
    { label: '+ 이유', text: '그렇게 한 이유는 ' },
    { label: '+ 어려웠던 점', text: '가장 어려웠던 건 ' },
  ];
  const EXAMPLE = "예) API 응답을 800ms → 480ms로 줄였어요. 제가 Redis 캐싱 로직을 직접 설계·구현했고, Memcached 대신 Redis를 택한 건 자료구조가 유연해서였어요. 캐시 무효화 타이밍이 가장 까다로웠는데 TTL + 이벤트 갱신으로 해결했습니다.";
  const insertStarter = (text) => {
    setAnswers(prev => {
      const cur = prev[current] || '';
      const sep = cur && !cur.endsWith('\n') && !cur.endsWith(' ') ? '\n' : '';
      return { ...prev, [current]: cur + sep + text };
    });
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
    });
  };
  const unansweredIdx = questions.map((_, i) => i).filter(i => !(answers[i] || '').trim());

  const addFiles = (picked) => {
    if (picked.length === 0) return;
    setFiles(prev => {
      const merged = [...prev, ...picked].slice(0, 10);
      if (prev.length + picked.length > 10) toast.error('파일은 최대 10개까지 첨부할 수 있어요');
      return merged;
    });
  };
  const onFilesSelected = (e) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files || []));
  };
  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const startInterview = async () => {
    if (!title.trim()) return toast.error('경험 제목을 입력해주세요');
    if (braindump.trim().length < 20 && files.length === 0) {
      return toast.error('경험을 조금 적거나 자료 파일을 첨부해주세요');
    }
    setGenLoading(true);
    try {
      // 1) 파일에서 텍스트 추출 (기존 import 파이프라인 재사용)
      let fileText = '';
      if (files.length > 0) {
        for (const file of files) {
          setLoadingMsg(`자료 분석 중 — ${file.name}`);
          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('targetType', 'experience');
            const data = await importFileUpload(formData);
            const content = data?.imported?.content || '';
            if (content.trim()) fileText += `\n\n--- ${file.name} ---\n${content.trim()}`;
          } catch {
            toast.error(`${file.name} 분석에 실패해 건너뛰었어요`);
          }
        }
      }

      const combined = `${braindump.trim()}${fileText}`.trim();
      if (!combined) {
        setGenLoading(false);
        return toast.error('자료에서 내용을 읽지 못했어요. 직접 조금 적어주세요');
      }
      setSourceText(combined);

      // 2) 초안+자료 기반 인터뷰 질문 생성
      setLoadingMsg('AI가 질문을 준비하는 중...');
      const plan = await generateInterviewQuestions(combined, jobCategory, 'basic');
      let qs = (plan?.questions || [])
        .map(item => typeof item === 'string' ? item : item?.question)
        .filter(Boolean)
        .slice(0, 5);
      if (!qs || qs.length === 0) {
        qs = [
          '이 경험에서 가장 핵심적인 성과를 수치로 말한다면? (전/후, %, 시간, 규모 등)',
          '팀에서 정확히 본인이 직접 맡아서 한 부분은 무엇이었나요?',
          '여러 선택지 중 지금의 방식을 택한 이유는? 다른 대안은 무엇이었나요?',
          '진행 중 가장 막혔던 지점과, 그걸 어떻게 해결했나요?',
          '이 경험을 통해 새로 배우거나 달라진 생각이 있다면?',
        ];
      }
      setQuestions(qs);
      setCurrent(0);
      setPhase('interview');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI 질문 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setGenLoading(false);
      setLoadingMsg('');
    }
  };

  const goNext = () => {
    if (current < questions.length - 1) setCurrent(c => c + 1);
    else setPhase('review');
  };
  const goPrev = () => { if (current > 0) setCurrent(c => c - 1); };

  const finish = async () => {
    setPhase('building');
    try {
      // AI 보강 단계에서 쓰도록 원본+전체 Q&A는 rawInput에 그대로 보존
      const fullTranscript = questions
        .map((q, i) => `Q. ${q}\n→ ${(answers[i] || '').trim() || '(답변 안 함)'}`)
        .join('\n\n');
      const finalText = `${sourceText}\n\n=== AI 인터뷰 ===\n${fullTranscript}`;

      // 화면에 보이는 초안은 사용자가 실제로 답한 내용을 중심으로 구성한다.
      // (스캔 PDF 등은 본문 없이 "1 of 22" 페이지 마커만 추출돼 그대로 넣으면 깨져 보임)
      const answeredQa = questions
        .map((q, i) => ({ q, a: (answers[i] || '').trim() }))
        .filter(p => p.a);
      const answersOnly = answeredQa.map(p => p.a).join('\n\n');
      const readableTranscript = answeredQa.map(p => `${p.q}\n${p.a}`).join('\n\n');
      const cleanedSource = cleanRawText(sourceText);
      const hasUsableSource = cleanedSource.length >= 40;

      const reviewedMoments = [buildInterviewMoment({
        title: title.trim(),
        sourceText: hasUsableSource ? cleanedSource : '',
        qa: answeredQa,
      })];

      // 1차: 빠른 AI 초안 (flash 1회). 답변/자료의 노이즈를 줄인 텍스트만 전달.
      // 2차(폴백): AI 실패 시 로컬에서 즉시 초안 구성 → 속도 보장.
      let analysis;
      try {
        const draftContent = {
          ...(hasUsableSource ? { 자료: cleanedSource } : {}),
          인터뷰답변: readableTranscript || answersOnly,
          인터뷰구조화: JSON.stringify(reviewedMoments[0], null, 2),
        };
        analysis = await draftAnalyze({ content: draftContent, jobCategory: jobCategory || 'common' });
      } catch (draftErr) {
        console.warn('[Interview] AI 초안 실패 → 로컬 초안 폴백:', draftErr?.message);
        analysis = buildDraftStructuredResult({
          title: title.trim(),
          jobCategory: jobCategory || 'common',
          moments: reviewedMoments,
          collectedText: sourceText,
          content: { rawInput: finalText },
        });
      }

      const experienceId = await createExperience(user.uid, {
        title: title.trim(),
        framework: 'STRUCTURED',
        jobCategory: jobCategory || 'common',
        // 기간을 입력했으면 타임라인이 읽는 형식(period)으로 저장. 비우면 '날짜 미입력'으로 하단 유도.
        period: (startMonth && endMonth) ? `${startMonth}-01 ~ ${endMonth}-28` : undefined,
        content: { rawInput: finalText },
        // 보강(analyze) 시 핵심경험을 1개로 잠그지 않도록 reviewedMoments는 저장하지 않는다.
        // (인터뷰 답변은 content.rawInput에 모두 들어 있어 AI가 여러 핵심경험을 추출 가능)
        momentsCount: 3,
        structuredResult: analysis,
        keywords: analysis.keywords || [],
        analysisMode: 'draft',
      });
      toast.success('빠른 초안이 완성되었습니다. AI로 완성하기를 누르면 더 풍부해져요.');
      navigate(`/app/experience/complete/${experienceId}`, {
        state: {
          analysis,
          title: title.trim(),
          framework: 'STRUCTURED',
          content: { rawInput: finalText },
          showFeedback: true,
          feedbackContext: 'experience_interview_draft_complete',
        },
      });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI 정리에 실패했어요. 다시 시도해주세요.');
      setPhase('interview');
    }
  };

  const answeredCount = Object.values(answers).filter(v => v?.trim()).length;
  const progress = questions.length ? Math.round(((current + 1) / questions.length) * 100) : 0;

  /* ── 빌딩(생성/분석) ── */
  if (phase === 'building') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
        <div className="mb-5"><Spinner size={40} /></div>
        <h2 className="text-[20px] font-extrabold text-bluewood-900 mb-2">답변을 바탕으로 경험을 정리하고 있어요</h2>
        <p className="text-[14px] text-bluewood-400 leading-relaxed">채용 담당자 기준에 맞춰 구조화하는 중이에요.<br />잠시만 기다려 주세요 (최대 1분).</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-24">
      <Link to="/app/experience" className="inline-block text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors mb-5">
        ← 경험 목록으로
      </Link>

      {/* ── 인트로: 초안 + 파일 입력 ── */}
      {phase === 'intro' && (
        <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-[0_10px_40px_rgba(49,65,87,0.06)]">
          <div className="h-1 w-full bg-primary-600" />
          <div className="p-6 sm:p-8">
            <h1 className="text-[20px] font-extrabold text-bluewood-900 mb-1.5">AI 인터뷰로 경험 정리</h1>
            <p className="text-[14px] text-bluewood-400 leading-relaxed mb-6">
              완벽하게 안 써도 괜찮아요. 자료를 올리거나 편하게 적으면, AI가 채용 담당자가 궁금해할 부분을 콕 집어 질문하고 답변을 그대로 정리해 드려요.
            </p>

            <label className="block text-[13px] font-bold text-bluewood-700 mb-1.5">경험 제목</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 이미지 무단학습 방지 시스템 개발"
              className="w-full rounded-xl border border-surface-200 px-4 py-2.5 text-[14px] text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-bluewood-300 mb-4"
            />

            <label className="block text-[13px] font-bold text-bluewood-700 mb-1.5">기간 <span className="text-bluewood-300 font-medium">(선택 — 비워두면 나중에 타임라인에서 추가할 수 있어요)</span></label>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="month"
                value={startMonth}
                onChange={e => setStartMonth(e.target.value)}
                className="flex-1 rounded-xl border border-surface-200 px-4 py-2.5 text-[14px] text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200"
              />
              <span className="text-bluewood-300">~</span>
              <input
                type="month"
                value={endMonth}
                onChange={e => setEndMonth(e.target.value)}
                className="flex-1 rounded-xl border border-surface-200 px-4 py-2.5 text-[14px] text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <label className="block text-[13px] font-bold text-bluewood-700 mb-1.5">직무</label>
            <select
              value={jobCategory}
              onChange={e => setJobCategory(e.target.value)}
              className="w-full rounded-xl border border-surface-200 px-4 py-2.5 text-[14px] text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 mb-4 bg-white"
            >
              {JOB_CATEGORIES.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
                </optgroup>
              ))}
            </select>

            <label className="block text-[13px] font-bold text-bluewood-700 mb-1.5">자료 파일 <span className="text-bluewood-300 font-medium">(선택 — 이력서·기획서·README 등)</span></label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border border-dashed px-4 py-4 mb-4 cursor-pointer transition-colors ${
                isDragging ? 'border-primary-400 bg-primary-50' : 'border-surface-300 bg-surface-50/50 hover:bg-surface-50'
              }`}
            >
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.pptx,.xlsx,.txt,.md,.markdown,.csv,.tsv,.json,.yaml,.yml,.xml,.sql,.zip,.hwp,.hwpx,image/*" onChange={onFilesSelected} className="hidden" />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-4 py-2 rounded-lg border border-surface-200 bg-white text-[13px] font-semibold text-bluewood-700 hover:bg-surface-50 transition-colors"
                >
                  파일 선택
                </button>
                <span className="text-[12px] text-bluewood-400">{isDragging ? '여기에 놓으세요' : '클릭하거나 끌어다 놓으세요 · PDF·문서·이미지 등 최대 10개'}</span>
              </div>
              {files.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-white border border-surface-200 px-3 py-2 text-[13px] text-bluewood-700">
                      <span className="truncate pr-3">{f.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="flex-shrink-0 text-[12px] font-semibold text-bluewood-400 hover:text-red-500 transition-colors">삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="block text-[13px] font-bold text-bluewood-700 mb-1.5">이 경험을 편하게 적어주세요 <span className="text-bluewood-300 font-medium">(파일만 올려도 돼요)</span></label>
            <textarea
              value={braindump}
              onChange={e => setBraindump(e.target.value)}
              rows={5}
              placeholder="무슨 프로젝트였고, 어떤 문제를 어떻게 해결했는지 기억나는 대로 적어주세요. 두서없어도 괜찮아요."
              className="w-full resize-y rounded-xl border border-surface-200 px-4 py-3 text-[14px] leading-relaxed text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-bluewood-300"
            />

            <button
              onClick={startInterview}
              disabled={genLoading}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white rounded-xl text-[15px] font-bold hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm shadow-primary-600/20"
            >
              {genLoading && <Spinner light />}
              {genLoading ? (loadingMsg || 'AI가 질문을 준비하는 중...') : 'AI 인터뷰 시작'}
            </button>
          </div>
        </div>
      )}

      {/* ── 인터뷰: 대화형 질문 ── */}
      {phase === 'interview' && questions.length > 0 && (
        <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-[0_10px_40px_rgba(49,65,87,0.06)]">
          <div className="px-6 sm:px-8 pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-primary-600">AI 인터뷰</span>
              <span className="text-[12px] font-semibold text-bluewood-400 tabular-nums">{current + 1} / {questions.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
              <div className="h-full bg-primary-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* 대화 영역 */}
          <div ref={scrollRef} className="px-6 sm:px-8 py-6 max-h-[44vh] overflow-y-auto space-y-4">
            {questions.slice(0, current).map((q, i) => (
              <div key={i} className="space-y-2 opacity-70">
                <div className="flex gap-2.5">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-50 text-primary-600 text-[11.5px] font-black flex items-center justify-center mt-0.5">AI</span>
                  <p className="text-[13.5px] text-bluewood-600 leading-relaxed pt-1">{q}</p>
                </div>
                <div className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-tr-sm bg-surface-100 px-3.5 py-2 text-[13px] text-bluewood-700 leading-relaxed whitespace-pre-wrap">
                    {(answers[i] || '').trim() || '건너뜀'}
                  </p>
                </div>
              </div>
            ))}

            {/* 현재 질문 */}
            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white text-[11.5px] font-black flex items-center justify-center mt-0.5">AI</span>
              <p className="text-[15px] font-semibold text-bluewood-900 leading-relaxed pt-0.5">{questions[current]}</p>
            </div>
          </div>

          {/* 입력 */}
          <div className="px-6 sm:px-8 pb-6 pt-1">
            <p className="mb-2 text-[12.5px] text-bluewood-400">짧아도 괜찮아요 — <span className="font-semibold text-bluewood-600">키워드만 적어도</span> AI가 문장으로 다듬어요.</p>
            <textarea
              ref={taRef}
              value={answers[current] || ''}
              onChange={e => setAnswers(prev => ({ ...prev, [current]: e.target.value }))}
              rows={3}
              autoFocus
              placeholder="떠오르는 대로 적어보세요. 아래 버튼을 누르면 문장 시작을 도와드려요."
              className="w-full resize-y rounded-xl border border-surface-200 px-4 py-3 text-[14px] leading-relaxed text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-bluewood-300"
            />

            {/* 빠른 시작 칩 + 예시 */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {STARTERS.map(s => (
                <button key={s.label} type="button" onClick={() => insertStarter(s.text)}
                  className="px-2.5 py-1 rounded-full border border-surface-200 bg-surface-50 text-[12px] font-semibold text-bluewood-600 hover:border-primary-300 hover:text-primary-600 transition-colors">
                  {s.label}
                </button>
              ))}
              <button type="button" onClick={() => setShowExample(v => !v)}
                className="ml-auto px-2.5 py-1 text-[12px] font-semibold text-bluewood-400 hover:text-primary-600 transition-colors">
                {showExample ? '예시 닫기' : '예시 보기'}
              </button>
            </div>
            {showExample && (
              <p className="mt-2 rounded-lg bg-primary-50/60 border border-primary-100 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-bluewood-600" style={{ wordBreak: 'keep-all' }}>
                {EXAMPLE}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={goPrev}
                disabled={current === 0}
                className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-bluewood-500 hover:bg-surface-50 disabled:opacity-40 transition-colors"
              >
                ← 이전
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={goNext}
                  className="text-[12px] text-bluewood-300 hover:text-bluewood-500 underline underline-offset-2 transition-colors"
                >
                  건너뛰기
                </button>
                <button
                  onClick={goNext}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[14px] font-bold hover:bg-primary-700 transition-colors shadow-sm"
                >
                  {current < questions.length - 1 ? '다음 →' : '답변 검토하기 →'}
                </button>
              </div>
            </div>
            <p className="mt-3 text-center text-[12px] text-bluewood-300">
              {answeredCount} / {questions.length} 답변 · 마지막에 한 번에 검토·수정할 수 있어요
            </p>
          </div>
        </div>
      )}

      {/* ── 검토: 답한 내용만 확인. 건너뛴 항목은 확인 필요로 보존 ── */}
      {phase === 'review' && (
        <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden shadow-[0_10px_40px_rgba(49,65,87,0.06)]">
          <div className="h-1 w-full bg-primary-600" />
          <div className="px-6 sm:px-8 pt-6 pb-1">
            <h2 className="text-[18px] font-extrabold text-bluewood-900">답변 검토</h2>
            <p className="mt-1 text-[13px] text-bluewood-400 leading-relaxed">
              {unansweredIdx.length > 0
                ? <>건너뛴 <b className="text-primary-600 font-bold">{unansweredIdx.length}개</b>는 지어내지 않고 ‘확인 필요’로 남겨둘게요. 지금 답하고 싶은 것만 수정해도 됩니다.</>
                : '모든 질문에 답했어요. 바로 정리할 수 있어요!'}
            </p>
          </div>
          <div className="px-6 sm:px-8 py-4 space-y-5 max-h-[56vh] overflow-y-auto">
            {questions.map((q, i) => {
              const empty = !(answers[i] || '').trim();
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-50 text-primary-600 text-[11.5px] font-black flex items-center justify-center">{i + 1}</span>
                    <p className="flex-1 text-[13.5px] font-semibold text-bluewood-700 leading-snug" style={{ wordBreak: 'keep-all' }}>{q}</p>
                    {empty && <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-surface-50 border border-surface-200 text-[12px] font-bold text-bluewood-400">확인 필요</span>}
                  </div>
                  <textarea
                    value={answers[i] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    rows={2}
                    placeholder="선택 사항 · 기억나면 적고 아니면 그대로 진행하세요"
                    className="w-full resize-y rounded-xl border border-surface-200 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-bluewood-300"
                  />
                </div>
              );
            })}
          </div>
          <div className="px-6 sm:px-8 py-5 border-t border-surface-100 flex items-center justify-between gap-2">
            <button onClick={() => { setCurrent(0); setPhase('interview'); }}
              className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-bluewood-500 hover:bg-surface-50 transition-colors">
              ← 인터뷰로
            </button>
            <button onClick={finish}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-[14px] font-bold hover:bg-primary-700 transition-colors shadow-sm">
              정리 시작하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
