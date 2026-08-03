/**
 * JobAnalysisDockPanel — 우측 도킹 기업분석 · AI 첨삭 패널 (모든 포트폴리오 에디터 공용)
 *
 * - 화면 오른쪽 가장자리의 화살표 손잡이로 열고 닫는다 (닫혀 있어도 손잡이는 항상 표시)
 * - 기업 미연결: JobLinkInput으로 공고 연결 / 연결됨: 기업분석 탭 + AI 첨삭 탭
 * - 첨삭 대상 수집·적용은 에디터별 어댑터(collectSections / onApplySection)로 주입한다
 */
import { useState } from 'react';
import { Briefcase, Check, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import JobLinkInput, { JobAnalysisBadge } from './JobLinkInput';
import { tailorPortfolio } from '../services/jobAI';

/** 패널 폭(px). 에디터가 캔버스를 밀 때 같은 값을 쓴다. */
export const JOB_DOCK_WIDTH = 360;

export default function JobAnalysisDockPanel({
  open,
  onToggle,
  analysis,
  onAnalysis, // (analysis|null) => void — 연결/해제
  collectSections, // () => [{ key, title, content }]
  onApplySection, // (key, content) => void
  topOffset = 64,
}) {
  const [tab, setTab] = useState('analysis'); // 'analysis' | 'tailor'
  const [tailoring, setTailoring] = useState(false);
  const [result, setResult] = useState(null); // { note, items: [{ section, tailoredContent, changeReason, changed }] }
  const [error, setError] = useState(null);
  const [applied, setApplied] = useState({});

  const runTailor = async () => {
    const sections = (collectSections?.() || []).slice(0, 20); // 백엔드 섹션 상한
    if (sections.length === 0) {
      toast.error('첨삭할 텍스트가 없습니다. 소개나 경험 설명을 먼저 작성해주세요.');
      return;
    }
    setTailoring(true);
    setError(null);
    setApplied({});
    try {
      const data = await tailorPortfolio(analysis, sections);
      setResult({
        note: data.overallNote || '',
        items: (data.sections || [])
          .map(item => ({ ...item, section: sections[item.index] }))
          .filter(item => item.section && String(item.tailoredContent || '').trim()),
      });
    } catch (err) {
      setError(err.response?.data?.error || 'AI 첨삭에 실패했습니다');
    }
    setTailoring(false);
  };

  const applyItem = (item, idx) => {
    onApplySection?.(item.section.key, item.tailoredContent);
    setApplied(prev => ({ ...prev, [idx]: true }));
  };

  const changedItems = (result?.items || []).filter(item => item.changed);
  const applyAll = () => {
    (result?.items || []).forEach((item, idx) => {
      if (item.changed && !applied[idx]) applyItem(item, idx);
    });
    toast.success('첨삭 내용을 모두 적용했습니다');
  };

  const removeAnalysis = () => {
    setResult(null);
    setApplied({});
    setError(null);
    setTab('analysis');
    onAnalysis?.(null);
  };

  const tabClass = (active) => `flex-1 py-2.5 text-[12.5px] font-bold border-b-2 transition-colors ${active ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`;

  // ── 닫힘: 가장자리 화살표 손잡이만 표시 ──
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onToggle?.(true)}
        title="기업분석 · AI 첨삭 열기"
        className="fixed right-0 top-1/2 z-[55] flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-gray-200 bg-white px-1.5 py-3.5 text-gray-400 shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-colors hover:text-primary-600"
      >
        <ChevronLeft size={15} />
        {analysis && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      </button>
    );
  }

  return (
    <aside
      className="fixed right-0 bottom-0 z-[55] flex w-full flex-col border-l border-gray-200 bg-white shadow-xl sm:w-[360px]"
      style={{ top: topOffset }}
    >
      {/* 헤더 — 접기 화살표를 헤더 안에 통합, 제목 위에 여유 여백 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 pt-5 pb-3.5">
        <p className="flex items-center gap-2 text-[13.5px] font-black text-gray-800">
          <Briefcase size={15} className="text-primary-600" /> 기업분석 · AI 첨삭
        </p>
        <button
          type="button"
          onClick={() => onToggle?.(false)}
          title="패널 접기"
          className="flex items-center rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {!analysis ? (
        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-4 text-[12.5px] leading-relaxed text-gray-400" style={{ wordBreak: 'keep-all' }}>
            지원할 공고를 연결하면 기업분석 자료를 옆에 두고 편집하고, 문장을 기업 맞춤형으로 첨삭받을 수 있어요.
          </p>
          <JobLinkInput onAnalysisComplete={a => onAnalysis?.(a)} />
        </div>
      ) : (
        <>
          <div className="flex border-b border-gray-100 px-5">
            <button type="button" onClick={() => setTab('analysis')} className={tabClass(tab === 'analysis')}>기업분석</button>
            <button type="button" onClick={() => setTab('tailor')} className={tabClass(tab === 'tailor')}>AI 첨삭</button>
          </div>

          {tab === 'analysis' && (
            <div className="flex-1 overflow-y-auto p-5">
              <JobAnalysisBadge analysis={analysis} onRemove={removeAnalysis} />
            </div>
          )}

          {tab === 'tailor' && (
            <div className="flex-1 overflow-y-auto p-5">
              {tailoring ? (
                <div className="flex flex-col items-center py-14">
                  <Loader2 size={22} className="mb-3 animate-spin text-primary-500" />
                  <p className="text-[13px] font-semibold text-gray-600">첨삭 중입니다...</p>
                  <p className="mt-1 text-[11.5px] text-gray-400">{analysis.company || '기업'} 공고에 맞춰 문장을 재구성합니다</p>
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-[12.5px] text-red-600">{error}</p>
                  <button type="button" onClick={runTailor} className="mt-2 text-[12px] font-bold text-red-500 underline hover:text-red-700">다시 시도</button>
                </div>
              ) : !result ? (
                <div className="space-y-4">
                  <p className="text-[12.5px] leading-relaxed text-gray-400" style={{ wordBreak: 'keep-all' }}>
                    소개·경험 설명을 <b className="text-gray-600">{analysis.company || '기업'} {analysis.position || ''}</b> 공고 기준으로 재작성해 제안해요. 제안을 확인하고 마음에 드는 것만 적용하면 됩니다.
                  </p>
                  <button type="button" onClick={runTailor}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-[13.5px] font-bold text-white shadow-sm hover:bg-primary-700 transition-colors">
                    <Sparkles size={15} /> 기업 맞춤 첨삭 시작 ({(collectSections?.() || []).length}개 섹션)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-gray-400">{result.note}</p>
                    <button type="button" onClick={runTailor} className="shrink-0 text-[12px] font-bold text-primary-500 hover:text-primary-700">다시 첨삭</button>
                  </div>
                  {changedItems.length > 1 && (
                    <button type="button" onClick={applyAll}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 py-2 text-[12.5px] font-bold text-primary-700 hover:bg-primary-100 transition-colors">
                      <Check size={13} /> 변경 제안 모두 적용
                    </button>
                  )}
                  {result.items.length === 0 && <p className="py-10 text-center text-[12.5px] text-gray-400">첨삭 제안이 없습니다.</p>}
                  {result.items.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-gray-100 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-black text-gray-700">{item.section.title}</p>
                        {item.changed ? (
                          applied[idx] ? (
                            <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-emerald-600"><Check size={12} /> 적용됨</span>
                          ) : (
                            <button type="button" onClick={() => applyItem(item, idx)}
                              className="shrink-0 rounded-md bg-primary-600 px-2.5 py-1 text-[12px] font-bold text-white hover:bg-primary-700 transition-colors">적용</button>
                          )
                        ) : (
                          <span className="shrink-0 text-[12px] font-bold text-gray-300">변경 없음</span>
                        )}
                      </div>
                      {item.changed && (
                        <>
                          <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-gray-400 line-through decoration-gray-300">{item.section.content}</p>
                          <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-gray-800">{item.tailoredContent}</p>
                          {item.changeReason && <p className="mt-2 rounded-lg bg-primary-50/60 px-2.5 py-1.5 text-[12px] leading-relaxed text-primary-700">{item.changeReason}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
