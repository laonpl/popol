/**
 * MissingFieldsPanel — 비어 있는 항목만 모아 한 번에 채우는 화면.
 *
 * 예전에는 값이 없으면 본문에 "[작성 필요] (원본에 없음)"이 그대로 박혀
 * 결과물이 지저분해지고, 정작 무엇을 채워야 하는지는 흩어져 있어 찾기 어려웠다.
 * 이제 본문에서는 그 표기를 지우고, 채울 것은 여기 한곳에 모아 보여준다.
 *
 * "원본에 반영"을 눌러야 저장된다 — 그전까지는 입력만 들고 있는다.
 */
import { useMemo, useState } from 'react';
import { X, Check, Loader2, PencilLine } from 'lucide-react';
import { collectMissingFields, groupMissingFields, applyFilledFields, criticalMissingFields } from '../utils/missingFields';
import useModalBehavior from '../hooks/useModalBehavior';

export default function MissingFieldsPanel({ exp, onApply, onClose }) {
  const { ref: panelRef, backdropProps } = useModalBehavior(true, onClose);
  const fields = useMemo(() => collectMissingFields(exp), [exp]);
  const groups = useMemo(() => groupMissingFields(fields), [fields]);
  const [filled, setFilled] = useState({});
  const [saving, setSaving] = useState(false);

  const filledCount = Object.values(filled).filter(v => String(v ?? '').trim()).length;
  const criticalCount = useMemo(() => criticalMissingFields(fields).length, [fields]);

  const apply = async () => {
    if (filledCount === 0) return;
    setSaving(true);
    try {
      await onApply(applyFilledFields(exp?.structuredResult || {}, filled));
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/40 p-4" {...backdropProps}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="누락 항목 채우기" tabIndex={-1} className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>

        <header className="flex items-start justify-between gap-3 border-b border-surface-200 px-6 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[16px] font-black text-bluewood-900">
              <PencilLine size={17} className="text-primary-600" /> 채우면 좋은 항목
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-bluewood-400">
              AI가 원본 자료에서 근거를 찾지 못한 부분입니다. 아는 것만 채우면 됩니다 —
              <strong className="text-bluewood-600"> 비워 두면 포트폴리오에서 그냥 빠지고, 없는 내용이 지어지지 않습니다.</strong>
            </p>
            {criticalCount > 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-amber-800">
                전부 채울 필요는 없습니다. <strong>먼저 채울 {criticalCount}개</strong>(아래 <span className="font-black">먼저</span> 표시)만 채워도
                서류에서 걸리는 지점은 사라집니다.
              </p>
            )}
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-lg p-1.5 hover:bg-surface-100"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {fields.length === 0 ? (
            <p className="rounded-xl border border-dashed border-surface-200 px-5 py-12 text-center text-[13px] text-bluewood-400">
              비어 있는 항목이 없습니다. 정리가 잘 끝났어요.
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map(({ group, items }) => (
                <section key={group}>
                  <p className="mb-2.5 border-b border-surface-100 pb-1.5 text-[12px] font-black uppercase tracking-wider text-bluewood-400">
                    {group}
                  </p>
                  <div className="space-y-3.5">
                    {items.map(f => (
                      <div key={f.id}>
                        <label className="flex items-baseline gap-2">
                          <span className="text-[12.5px] font-bold text-bluewood-800">{f.label}</span>
                          {f.impact === 'critical' && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-black text-amber-800">먼저</span>
                          )}
                          {String(filled[f.path] ?? '').trim() && (
                            <span className="text-[11.5px] font-black text-caribbean-700">입력됨</span>
                          )}
                        </label>
                        {f.hint && <p className="mt-0.5 text-[12px] leading-snug text-bluewood-400">{f.hint}</p>}
                        <textarea
                          rows={2}
                          value={filled[f.path] ?? ''}
                          onChange={e => setFilled(prev => ({ ...prev, [f.path]: e.target.value }))}
                          placeholder="아는 만큼만 적어주세요. 모르면 비워 두세요."
                          className="mt-1.5 w-full resize-y rounded-lg border border-surface-200 px-3 py-2 text-[13px] leading-relaxed text-bluewood-700 outline-none transition-colors focus:border-primary-400"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-surface-200 bg-surface-50/60 px-6 py-3.5">
          <p className="text-[12px] text-bluewood-400">
            {fields.length === 0
              ? '채울 항목 없음'
              : <>비어 있는 항목 <strong className="text-bluewood-700">{fields.length}개</strong> 중 <strong className="text-primary-600">{filledCount}개</strong> 입력</>}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-bluewood-500 hover:bg-surface-100">
              닫기
            </button>
            <button
              onClick={apply}
              disabled={filledCount === 0 || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-[12.5px] font-bold text-white transition-all hover:bg-primary-700 disabled:opacity-40"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              원본에 반영
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
