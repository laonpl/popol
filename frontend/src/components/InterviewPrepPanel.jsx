/**
 * InterviewPrepPanel — 정리된 경험을 면접 대비용으로 보여주는 패널.
 *
 * 지원자 본인용 화면이다. "파고들면 무너지는 지점"은 여기서만 보이고
 * 채용담당자에게 나가는 산출물에는 들어가지 않는다.
 * 내용은 전부 이미 저장된 문장이며, 없는 것은 빈칸으로 표시한다(AI 호출 없음).
 */
import { useMemo, useState } from 'react';
import { X, MessageSquare, AlertTriangle, Mic, Copy, Check } from 'lucide-react';
import { buildInterviewPrep } from '../utils/interviewPrep';

const TABS = [
  { key: 'questions', label: '예상 질문', icon: MessageSquare },
  { key: 'fragile', label: '무너지는 지점', icon: AlertTriangle },
  { key: 'pitch', label: '구두 버전', icon: Mic },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-surface-200 px-2 py-1 text-[11px] font-bold text-bluewood-500 hover:border-primary-300 hover:text-primary-600"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? '복사됨' : '복사'}
    </button>
  );
}

export default function InterviewPrepPanel({ exp, onClose }) {
  const prep = useMemo(() => buildInterviewPrep(exp), [exp]);
  const [tab, setTab] = useState('questions');

  const counts = {
    questions: prep.questions.length,
    fragile: prep.fragile.length,
    pitch: (prep.pitch30 ? 1 : 0) + (prep.pitch120 ? 1 : 0),
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>

        <header className="flex items-start justify-between gap-3 border-b border-surface-200 px-6 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[16px] font-black text-bluewood-900">
              <MessageSquare size={17} className="text-primary-600" /> 면접 준비
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-bluewood-400">
              정리한 판단·근거로 만든 <strong className="text-bluewood-600">본인용</strong> 자료입니다. 포트폴리오 산출물에는 포함되지 않습니다.
              {prep.readiness.total > 0 && (
                <> · 답할 준비된 질문 <strong className="text-primary-600">{prep.readiness.ready}/{prep.readiness.total}</strong></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-bluewood-400 hover:bg-surface-100"><X size={18} /></button>
        </header>

        <div className="flex items-center gap-1 border-b border-surface-100 px-6 py-2.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                tab === key ? 'bg-primary-50 text-primary-700' : 'text-bluewood-400 hover:text-bluewood-700'
              }`}
            >
              <Icon size={12} /> {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${
                tab === key ? 'bg-primary-600 text-white' : 'bg-surface-100 text-bluewood-400'
              }`}>{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'questions' && (
            prep.questions.length === 0
              ? <p className="text-[13px] text-bluewood-400">핵심 경험이 정리되면 예상 질문이 만들어집니다.</p>
              : (
                <div className="space-y-3">
                  {prep.questions.map((q, i) => (
                    <div key={i} className={`rounded-xl border p-4 ${q.ready ? 'border-surface-200 bg-white' : 'border-amber-200 bg-amber-50/40'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13.5px] font-extrabold leading-snug text-bluewood-900" style={{ wordBreak: 'keep-all' }}>{q.q}</p>
                        <span className="shrink-0 rounded-md bg-surface-100 px-2 py-0.5 text-[10.5px] font-bold text-bluewood-400">{q.from}</span>
                      </div>
                      {q.ready ? (
                        <>
                          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-bluewood-600">{q.basis}</p>
                          <div className="mt-2"><CopyButton text={q.basis} /></div>
                        </>
                      ) : (
                        <p className="mt-2 text-[12.5px] font-semibold leading-relaxed text-amber-700">
                          아직 답할 근거가 비어 있습니다 — {q.hint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
          )}

          {tab === 'fragile' && (
            prep.fragile.length === 0
              ? <p className="text-[13px] text-bluewood-400">지금 기준으로 눈에 걸리는 취약 지점이 없습니다.</p>
              : (
                <div className="space-y-3">
                  {prep.fragile.map((f, i) => (
                    <div key={i} className="rounded-xl border border-red-100 bg-red-50/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[13.5px] font-extrabold leading-snug text-bluewood-900" style={{ wordBreak: 'keep-all' }}>{f.claim}</p>
                        <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10.5px] font-bold text-bluewood-400">{f.from}</span>
                      </div>
                      <p className="mt-2 text-[12.5px] font-semibold text-red-700">{f.reason}</p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-bluewood-600">→ {f.fix}</p>
                    </div>
                  ))}
                </div>
              )
          )}

          {tab === 'pitch' && (
            <div className="space-y-4">
              {[
                { label: '30초 버전', text: prep.pitch30, hint: '나를 보여주는 한 문장 + 대표 성과' },
                { label: '2분 버전', text: prep.pitch120, hint: '상황 → 판단·실행 → 결과 → 배운 것' },
              ].map(({ label, text, hint }) => (
                <div key={label} className="rounded-xl border border-surface-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-extrabold text-bluewood-900">{label} <span className="ml-1 font-semibold text-bluewood-300">{hint}</span></p>
                    <CopyButton text={text} />
                  </div>
                  {text
                    ? <p className="mt-2 text-[13px] leading-relaxed text-bluewood-600">{text}</p>
                    : <p className="mt-2 text-[12.5px] font-semibold text-amber-700">아직 재료가 부족합니다 — 핵심 경험의 상황·행동·결과를 채우면 만들어집니다.</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
