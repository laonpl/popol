import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Files, Lightbulb, X } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import { buildPortfolioReadiness, evaluateExperienceReadiness, PORTFOLIO_SLOT_META } from '../../utils/experienceReadiness';
import { trackActivation } from '../../services/activationMetrics';

const clean = value => String(value || '').replace(/[#*_>`~]/g, '').replace(/\s+/g, ' ').trim();

export default function ExperienceCandidateInbox() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { experiences, fetchExperiences, loading } = useExperienceStore();
  const storageKey = `fitpoly-dismissed-experience-candidates-${user?.uid || 'anonymous'}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); } catch { return new Set(); }
  });

  useEffect(() => {
    if (user?.uid) fetchExperiences(user.uid);
  }, [user?.uid]);

  const summary = useMemo(() => buildPortfolioReadiness(experiences), [experiences]);
  const reviewItems = summary.items.filter(item => !item.readiness.portfolioReady);
  const candidates = useMemo(() => {
    const seen = new Set(experiences.map(item => clean(item.title).toLowerCase()).filter(Boolean));
    const rows = [];
    for (const experience of experiences) {
      const sr = experience.structuredResult || {};
      const moments = Array.isArray(experience.reviewedMoments) && experience.reviewedMoments.length
        ? experience.reviewedMoments
        : Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
      moments.forEach((moment, index) => {
        const title = clean(moment?.title || moment?.name);
        const key = `${experience.id}:${index}:${title}`;
        if (!title || dismissed.has(key) || seen.has(title.toLowerCase())) return;
        rows.push({
          key,
          sourceExperience: experience,
          title,
          context: clean(moment?.context || moment?.situation || sr.projectOverview?.background),
          role: clean(sr.projectOverview?.role),
          action: clean(moment?.action),
          outcome: clean(moment?.result || moment?.learning || moment?.metric),
        });
      });
    }
    return rows.slice(0, 12);
  }, [experiences, dismissed]);

  useEffect(() => {
    if (candidates.length > 0) {
      trackActivation('experience_candidate_detected', {
        candidateCount: candidates.length,
        experienceCountTotal: experiences.length,
      });
    }
  }, [candidates.length]);

  const dismiss = key => {
    setDismissed(prev => {
      const next = new Set(prev); next.add(key);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
    trackActivation('experience_candidate_dismissed', { candidateId: key });
  };

  const accept = candidate => {
    const nextSlot = summary.nextSlot || 'growth';
    trackActivation('experience_candidate_accepted', {
      candidateId: candidate.key,
      sourceExperienceId: candidate.sourceExperience.id,
      nextSlot,
    });
    navigate(`/app/experience/quick?from=${candidate.sourceExperience.id}&slot=${nextSlot}`, {
      state: { prefill: candidate },
    });
  };

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn pb-16">
      <button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 hover:text-gray-700"><ArrowLeft size={15} /> 돌아가기</button>
      <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-white to-primary-50/70 p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[12px] font-extrabold text-primary-700"><Files size={13} /> Experience inbox</span>
            <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] text-gray-900">이미 정리한 자료에서<br />다음 경험 후보를 확인하세요</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-gray-500">기존 분석에서 별도 장면으로 쓸 만한 내용을 모았습니다. 같은 프로젝트를 억지로 나누지 말고, 독립된 배경·역할·결과가 있을 때만 새 경험으로 선택하세요.</p>
          </div>
          {summary.nextSlot && <span className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-primary-700 shadow-sm">다음 추천: {PORTFOLIO_SLOT_META[summary.nextSlot].label}</span>}
        </div>
      </div>

      {reviewItems.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
          <h2 className="text-[16px] font-extrabold text-amber-900">먼저 확인하면 바로 쓸 수 있는 경험 {reviewItems.length}개</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {reviewItems.slice(0, 4).map(({ experience, readiness }) => (
              <button key={experience.id} onClick={() => navigate(`/app/experience/complete/${experience.id}`)} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3 text-left hover:border-amber-300">
                <div className="min-w-0"><p className="truncate text-[13px] font-bold text-gray-800">{experience.title || '제목 없는 경험'}</p><p className="mt-0.5 text-[11px] text-amber-700">{readiness.requiredComplete ? '사실 확인만 남았어요' : '내용 보완이 필요해요'}</p></div><ArrowRight size={14} className="shrink-0 text-amber-500" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between"><div><h2 className="text-[20px] font-extrabold text-gray-900">자료에서 찾은 장면 후보</h2><p className="mt-1 text-[12px] text-gray-400">별도 경험으로 사용할지 직접 결정합니다.</p></div><span className="text-[12px] font-bold text-gray-400">{candidates.length}개</span></div>
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">후보를 불러오는 중입니다…</div>
        ) : candidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <Lightbulb size={28} className="mx-auto text-primary-300" />
            <p className="mt-3 text-[14px] font-bold text-gray-700">추가로 분리할 후보가 없습니다.</p>
            <p className="mt-1 text-[12.5px] text-gray-400">새 경험을 빠르게 기억나는 만큼만 적어둘 수 있어요.</p>
            <button onClick={() => navigate(`/app/experience/quick?slot=${summary.nextSlot || 'growth'}`)} className="mt-4 rounded-xl bg-primary-600 px-5 py-3 text-[13px] font-bold text-white">3분 초안 만들기</button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {candidates.map(candidate => (
              <article key={candidate.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold text-gray-400">{candidate.sourceExperience.title}에서 발견</p><h3 className="mt-1 text-[16px] font-extrabold text-gray-900">{candidate.title}</h3></div><button onClick={() => dismiss(candidate.key)} title="후보 숨기기" className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500"><X size={15} /></button></div>
                <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-gray-500">{candidate.context || candidate.action || candidate.outcome || '세부 내용을 확인해 독립된 경험인지 판단해주세요.'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => accept(candidate)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-[12.5px] font-bold text-white hover:bg-primary-700"><CheckCircle2 size={14} /> 별도 경험 초안으로</button>
                  <button onClick={() => navigate(`/app/experience/result/${candidate.sourceExperience.id}`)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] font-bold text-gray-500 hover:text-gray-700">기존 경험에서 보강</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
