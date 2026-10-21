/**
 * 경험 요약보기 — 정리한 경험을 포트폴리오에 바로 붙일 수 있는 슬라이드로 보여준다.
 * 저장된 덱이 있고 경험 내용이 그대로면 바로 보여주고(크레딧 미사용),
 * 없거나 내용이 바뀌었으면 원문 발췌 덱을 먼저 띄운 뒤 AI 가 문구를 줄인 덱으로 교체한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useModalBehavior from '../../hooks/useModalBehavior';
import SummaryDeckViewer from './SummaryDeckViewer';
import { collectDeckMaterial, deckSourceHash, planSummaryDeck } from '../../../../shared/summaryDeck.mjs';

export default function SummaryDeckModal({ exp, experienceId, unsaved = false, onClose, onDeckChange }) {
  const { ref, backdropProps } = useModalBehavior(true, onClose);
  const material = useMemo(() => collectDeckMaterial(exp || {}), [exp]);
  const saved = exp?.structuredResult?.summaryDeck;
  const fresh = saved?.sourceHash === deckSourceHash(material) && Array.isArray(saved?.slides);
  const [deck, setDeck] = useState(() => (fresh ? saved : { ...planSummaryDeck(material), accent: saved?.accent }));
  const [polishing, setPolishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const isDemo = !experienceId || experienceId === 'demo';

  const generate = async (force = false) => {
    if (isDemo) return;
    setPolishing(true);
    setNotice('');
    try {
      const { data } = await api.post('/experience/summary-deck', { experienceId, force }, { timeout: 180000 });
      const next = { ...data.deck, accent: data.deck.accent || deck.accent };
      setDeck(next);
      setDirty(false);
      onDeckChange?.(next);
      if (next.copy === 'source') setNotice('문구 다듬기가 잠시 안 돼서, 정리한 원문을 그대로 넣었어요.');
    } catch (error) {
      const status = error?.response?.status;
      setNotice(status === 402
        ? '크레딧이 부족해 정리한 원문 그대로 보여드려요. 충전 후 다시 만들면 문구가 짧게 다듬어져요.'
        : (error?.response?.data?.error || '문구 다듬기에 실패해 정리한 원문 그대로 보여드려요.'));
    } finally {
      setPolishing(false);
    }
  };

  useEffect(() => {
    if (!fresh) generate(false);
    // 열 때 한 번만 확인한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = next => { setDeck(next); setDirty(true); };

  const save = async () => {
    if (isDemo) { toast('데모 경험은 저장되지 않아요.'); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/experience/summary-deck', { experienceId, deck });
      setDirty(false);
      onDeckChange?.(data.deck);
      toast.success('요약 슬라이드를 저장했어요');
    } catch (error) {
      toast.error(error?.response?.data?.error || '저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const regenerate = () => {
    if (window.confirm('정리한 경험으로 문구를 다시 만들까요? 크레딧이 조금 사용되고, 직접 고친 문구는 사라집니다.')) generate(true);
  };

  const button = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-50';

  // 앱 본문(.app-shell main) 밖에 그린다 — brand.css 의 "본문 제목은 검정" 규칙이 슬라이드·모달 제목을 덮지 않게.
  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#0b0c0e]/95 p-4 sm:p-8" {...backdropProps}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="경험 요약 슬라이드" tabIndex={-1} className="mx-auto flex max-w-[1280px] flex-col gap-4" onClick={e => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-black text-white">경험 요약 슬라이드</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">
              정리한 경험의 문장과 수치로만 만들었어요. 데이터가 있는 장만 생기고, PNG로 저장해 포트폴리오에 바로 붙일 수 있어요.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={20} /></button>
        </header>

        {(polishing || notice || unsaved || deck.slides.length <= 1) && (
          <div className="flex flex-col gap-1.5">
            {polishing && <p className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-[12.5px] font-semibold text-white/80"><Loader2 size={14} className="animate-spin" /> 정리한 문장을 슬라이드 길이에 맞게 줄이는 중이에요. 지금 보이는 건 원문 그대로예요.</p>}
            {notice && <p className="rounded-lg bg-amber-400/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-amber-200">{notice}</p>}
            {deck.slides.length <= 1 && <p className="rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-[12.5px] font-semibold text-white/70">정리된 내용이 적어 표지만 만들었어요. 경험 정리에서 상황·한 일·결과를 채우면 장이 늘어나요.</p>}
            {unsaved && <p className="rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-[12.5px] font-semibold text-white/70">아직 저장하지 않은 수정은 요약에 반영되지 않아요. 경험을 저장한 뒤 다시 열어주세요.</p>}
          </div>
        )}

        <SummaryDeckViewer
          deck={deck}
          onChange={change}
          jobCategory={exp?.jobCategory || exp?.structuredResult?.jobCategory}
          images={material.images.map(im => im.url)}
          toolbar={!isDemo && (
            <>
              <button type="button" onClick={save} disabled={!dirty || saving} className={`${button} bg-white text-[#0b0c0e] hover:bg-white/90`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
              </button>
              <button type="button" onClick={regenerate} disabled={polishing} className={`${button} bg-white/10 text-white hover:bg-white/15`}>
                <RefreshCw size={14} /> 다시 만들기
              </button>
            </>
          )}
        />
      </div>
    </div>
  , document.body);
}
