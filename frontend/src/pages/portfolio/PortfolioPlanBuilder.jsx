import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Briefcase, Check, Circle, FileCheck2, Sparkles, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import {
  buildPortfolioReadiness,
  evaluateExperienceReadiness,
  PORTFOLIO_SLOT_META,
  PORTFOLIO_SLOT_ORDER,
} from '../../utils/experienceReadiness';
import { trackActivation } from '../../services/activationMetrics';
import { clearActivationTask } from '../../services/activationJourney';

export default function PortfolioPlanBuilder() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const profile = useAuthStore(state => state.profile);
  const { experiences, fetchExperiences, loading } = useExperienceStore();
  const initialized = useRef(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [target, setTarget] = useState({
    company: '',
    role: profile?.targetPosition || profile?.jobTitle || '',
    deadline: '',
  });

  useEffect(() => {
    if (user?.uid) fetchExperiences(user.uid);
  }, [user?.uid]);

  const summary = useMemo(() => buildPortfolioReadiness(experiences), [experiences]);

  useEffect(() => {
    if (initialized.current || loading || experiences.length === 0) return;
    const suggested = summary.suggestedExperiences.length
      ? summary.suggestedExperiences
      : [...summary.items]
        .sort((a, b) => b.readiness.score - a.readiness.score)
        .slice(0, 4)
        .map(item => item.experience);
    setSelectedIds(suggested.map(item => item.id));
    initialized.current = true;
    trackActivation('portfolio_skeleton_viewed', {
      experienceCountTotal: experiences.length,
      experienceCountReady: summary.readyCount,
    });
  }, [loading, experiences.length, summary.readyCount]);

  const selectedItems = useMemo(() => selectedIds
    .map(id => experiences.find(item => item.id === id))
    .filter(Boolean)
    .map(experience => ({ experience, readiness: evaluateExperienceReadiness(experience) })), [selectedIds, experiences]);
  const selectedCoverage = new Set(selectedItems.flatMap(item => item.readiness.portfolioRoles));
  const unconfirmedSelected = selectedItems.filter(item => !item.readiness.portfolioReady);

  const toggleExperience = id => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id);
      if (prev.length >= 4) {
        toast.error('포트폴리오에는 핵심 경험을 최대 4개까지 선택해주세요.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const continueToTemplate = () => {
    if (selectedIds.length === 0) {
      toast.error('포트폴리오에 넣을 경험을 한 개 이상 선택해주세요.');
      return;
    }
    const slots = PORTFOLIO_SLOT_ORDER.map(role => {
      const matched = selectedItems.find(item => item.readiness.portfolioRoles.includes(role));
      return {
        role,
        experienceId: matched?.experience.id || null,
        status: matched ? 'covered' : 'missing',
      };
    });
    const portfolioPlan = {
      targetRole: target.role.trim(),
      targetCompany: target.company.trim(),
      deadline: target.deadline || null,
      desiredExperienceCount: selectedIds.length >= 4 ? 4 : 3,
      selectedExperienceIds: selectedIds,
      slots,
      missingSlots: slots.filter(slot => slot.status === 'missing').map(slot => slot.role),
      readinessStatus: selectedIds.length >= 4 && selectedCoverage.size === 4 ? 'strong' : selectedIds.length >= 3 ? 'ready' : 'collecting',
      createdAt: new Date().toISOString(),
      version: 1,
    };
    trackActivation('portfolio_plan_created', {
      experienceCountSelected: selectedIds.length,
      experienceCountReady: selectedItems.filter(item => item.readiness.portfolioReady).length,
      coveredSlots: selectedCoverage.size,
      targetRole: target.role.trim(),
    });
    clearActivationTask(user?.uid);
    sessionStorage.setItem('fitpoly-pending-portfolio-plan', JSON.stringify(portfolioPlan));
    navigate('/app/portfolio/new', { state: { portfolioPlan } });
  };

  if (loading && experiences.length === 0) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-400">경험을 불러오는 중입니다…</div>;
  }

  return (
    <div className="mx-auto max-w-6xl animate-fadeIn pb-20">
      <button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 hover:text-gray-700"><ArrowLeft size={15} /> 돌아가기</button>

      <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-700 via-primary-600 to-indigo-600 px-6 py-8 text-white shadow-xl shadow-primary-900/10 md:px-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[12px] font-bold"><Target size={13} /> Portfolio plan</span>
            <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.035em] md:text-[38px]">강한 경험 3~4개로<br />지원용 스토리를 설계하세요</h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/75">템플릿보다 먼저 어떤 경험을 어떤 역할로 보여줄지 정합니다. 경험이 부족해도 현재 뼈대를 미리 볼 수 있어요.</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-[12px] font-bold text-white/65">선택한 경험</p>
            <p className="mt-1 text-[28px] font-extrabold">{selectedIds.length}<span className="ml-1 text-[15px] text-white/65">/ 4개</span></p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4">
              <h2 className="text-[18px] font-extrabold text-gray-900">1. 지원 목표</h2>
              <p className="mt-1 text-[12.5px] text-gray-400">아직 정하지 않았다면 비워두고 일반 포트폴리오로 진행할 수 있어요.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                <span className="mb-1.5 block text-[12px] font-bold text-gray-500">기업명</span>
                <input value={target.company} onChange={event => setTarget(prev => ({ ...prev, company: event.target.value }))} placeholder="예: 핏폴리" className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-[13.5px] outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-50" />
              </label>
              <label>
                <span className="mb-1.5 block text-[12px] font-bold text-gray-500">지원 직무</span>
                <input value={target.role} onChange={event => setTarget(prev => ({ ...prev, role: event.target.value }))} placeholder="예: 프로덕트 매니저" className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-[13.5px] outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-50" />
              </label>
              <label>
                <span className="mb-1.5 block text-[12px] font-bold text-gray-500">지원 마감일</span>
                <input type="date" value={target.deadline} onChange={event => setTarget(prev => ({ ...prev, deadline: event.target.value }))} className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-[13.5px] outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-50" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[18px] font-extrabold text-gray-900">2. 경험 3~4개 선택</h2>
                <p className="mt-1 text-[12.5px] text-gray-400">같은 이야기보다 서로 다른 강점을 보여주는 경험을 선택하세요.</p>
              </div>
              <button onClick={() => navigate('/app/experience/quick')} className="text-[12.5px] font-bold text-primary-600">+ 부족한 경험 추가</button>
            </div>

            {experiences.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center">
                <p className="text-[14px] font-bold text-gray-600">아직 정리한 경험이 없습니다.</p>
                <button onClick={() => navigate('/app/experience/quick')} className="mt-3 rounded-xl bg-primary-600 px-5 py-3 text-[13px] font-bold text-white">첫 경험 초안 만들기</button>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.items
                  .sort((a, b) => b.readiness.score - a.readiness.score)
                  .map(({ experience, readiness }) => {
                    const selected = selectedIds.includes(experience.id);
                    return (
                      <button key={experience.id} type="button" onClick={() => toggleExperience(experience.id)} className={`w-full rounded-xl border p-4 text-left transition ${selected ? 'border-primary-300 bg-primary-50/60 ring-2 ring-primary-100' : 'border-gray-200 bg-white hover:border-primary-200'}`}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 text-transparent'}`}><Check size={12} /></span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-extrabold text-gray-800">{experience.title || '제목 없는 경험'}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${readiness.portfolioReady ? 'bg-emerald-100 text-emerald-700' : readiness.requiredComplete ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                {readiness.portfolioReady ? '검증 완료' : readiness.requiredComplete ? '사실 확인 필요' : '내용 보완 필요'}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-gray-500">{readiness.preview.context || readiness.preview.action || '아직 상세 내용이 부족합니다.'}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {readiness.portfolioRoles.map(role => <span key={role} className="rounded-md bg-white px-2 py-1 text-[10.5px] font-bold text-primary-600">{PORTFOLIO_SLOT_META[role]?.label}</span>)}
                            </div>
                          </div>
                          <span className="text-[12px] font-extrabold text-gray-400">{readiness.score}%</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </section>
        </main>

        <aside className="self-start lg:sticky lg:top-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><FileCheck2 size={17} className="text-primary-600" /><h2 className="text-[16px] font-extrabold text-gray-900">스토리 커버리지</h2></div>
            <div className="mt-4 space-y-2.5">
              {PORTFOLIO_SLOT_ORDER.map(slot => {
                const covered = selectedCoverage.has(slot);
                return (
                  <div key={slot} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${covered ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                    {covered ? <Check size={15} className="text-emerald-600" /> : <Circle size={14} className="text-gray-300" />}
                    <div><p className={`text-[12.5px] font-bold ${covered ? 'text-emerald-800' : 'text-gray-500'}`}>{PORTFOLIO_SLOT_META[slot].label}</p><p className="text-[10.5px] text-gray-400">{covered ? '선택 경험으로 충족' : '보강 추천'}</p></div>
                  </div>
                );
              })}
            </div>

            {selectedIds.length < 3 && (
              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800">현재 {selectedIds.length}개 경험으로도 초안을 만들 수 있지만, 지원용 완성도를 위해 3개 이상을 권장합니다.</div>
            )}
            {unconfirmedSelected.length > 0 && (
              <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[12px] leading-relaxed text-blue-800">선택한 경험 중 {unconfirmedSelected.length}개는 사실 확인이 남아 있습니다. 템플릿 생성 후에도 보완할 수 있어요.</div>
            )}

            <button onClick={continueToTemplate} disabled={selectedIds.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3.5 text-[14px] font-extrabold text-white hover:bg-primary-700 disabled:opacity-40">
              <Sparkles size={16} /> 다음: 추천 템플릿 <ArrowRight size={15} />
            </button>
            <p className="mt-2 text-center text-[10.5px] text-gray-400">선택한 경험과 순서는 포트폴리오에 자동 반영됩니다.</p>
          </section>

          <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/60 p-4">
            <div className="flex gap-2"><Briefcase size={16} className="mt-0.5 shrink-0 text-primary-600" /><p className="text-[12px] leading-relaxed text-primary-800">경험이 4개를 넘으면 전부 넣기보다 지원 직무에 가장 잘 맞는 3~4개만 선택하는 편이 좋습니다.</p></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
