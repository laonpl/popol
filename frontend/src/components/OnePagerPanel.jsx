/**
 * OnePagerPanel — 60초 안에 읽히는 한 장. 인쇄하면 A4 한 장으로 나간다.
 *
 * 상세 문서(노션·웹)는 "읽어야 아는" 산출물이라 서류 검토 첫 1분에는 쓰이지 않는다.
 * 이 화면은 요구 역량 순서대로 "근거 한 줄"만 세운다.
 * 공백(gaps)은 지원자에게만 보여주고 인쇄에서는 빠진다 (print:hidden).
 */
import { useMemo } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { buildOnePager } from '../utils/onePager';

export default function OnePagerPanel({ exp, profile, onClose }) {
  const data = useMemo(() => buildOnePager({
    profile: profile || {},
    experiences: [exp],
    jobAnalysis: exp?.jobAnalysis || exp?.structuredResult?.jobAnalysis || null,
  }), [exp, profile]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 print:static print:bg-white print:p-0" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl print:max-h-none print:shadow-none" onClick={e => e.stopPropagation()}>

        <header className="flex items-start justify-between gap-3 border-b border-surface-200 px-6 py-4 print:hidden">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[16px] font-black text-bluewood-900">
              <FileText size={17} className="text-primary-600" /> 한 장 요약
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-bluewood-400">
              {data.target
                ? <>「{data.target}」 요구 역량 순서로 세운 근거 요약입니다.</>
                : '근거가 확인되는 순서로 세운 요약입니다. 채용공고를 연결하면 그 요구 역량 순서로 재배치됩니다.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-[12.5px] font-bold text-bluewood-600 hover:bg-surface-50">
              <Printer size={13} /> 인쇄 · PDF
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-bluewood-400 hover:bg-surface-100"><X size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-7 print:overflow-visible">
          <div className="border-b-2 border-bluewood-900 pb-3">
            <p className="text-[24px] font-black leading-tight text-bluewood-900">{data.name || '이름'}</p>
            {data.headline && <p className="mt-1 text-[13.5px] font-semibold text-bluewood-500">{data.headline}</p>}
            {data.target && <p className="mt-1.5 text-[12px] font-bold text-primary-600">{data.target} 지원</p>}
          </div>

          {data.lines.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-surface-200 px-5 py-10 text-center text-[13px] text-bluewood-400">
              아직 한 줄로 세울 근거가 없습니다. 핵심 경험의 실행·결과를 채우면 만들어집니다.
            </p>
          ) : (
            <ol className="mt-5 space-y-4">
              {data.lines.map((line, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[12px] font-black text-bluewood-300">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-extrabold leading-snug text-bluewood-900" style={{ wordBreak: 'keep-all' }}>
                      {line.requirement}
                      {line.confirmed && <span className="ml-2 align-middle text-[10px] font-bold text-caribbean-700">근거 확인</span>}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-bluewood-600" style={{ wordBreak: 'keep-all' }}>{line.proof}</p>
                    {line.source && <p className="mt-0.5 text-[11px] text-bluewood-300">확인: {line.source}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {data.summary && (
            <p className="mt-6 border-t border-surface-100 pt-3 text-[11.5px] text-bluewood-400 print:hidden">
              요구 역량 {data.summary.total}개 · 근거 확인 {data.summary.evidenced} · 서술만 {data.summary.narrativeOnly} · 공백 {data.summary.gaps}
            </p>
          )}

          {data.gaps.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 print:hidden">
              <p className="text-[12px] font-bold text-amber-800">아직 근거가 없는 요구 역량 (본인 확인용 · 인쇄에서 제외)</p>
              <ul className="mt-1.5 space-y-1">
                {data.gaps.map((g, i) => <li key={i} className="text-[12.5px] text-amber-800">· {g}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
