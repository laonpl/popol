import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import FlowSteps from '../../components/FlowSteps';
import {
  buildPortfolioReadiness,
  evaluateExperienceReadiness,
  PORTFOLIO_SLOT_META,
  PORTFOLIO_SLOT_ORDER,
  readinessPatch,
} from '../../utils/experienceReadiness';
import { trackActivation } from '../../services/activationMetrics';
import { saveActivationTask } from '../../services/activationJourney';

const truncate = (value, max = 170) => {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
};

export default function ExperienceCompletion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { experiences, fetchExperiences, updateExperience, loading } = useExperienceStore();
  const [attested, setAttested] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.uid && !experiences.some(item => item.id === id)) fetchExperiences(user.uid);
  }, [user?.uid, id]);

  const experience = experiences.find(item => item.id === id);
  const readiness = useMemo(() => evaluateExperienceReadiness(experience || {}), [experience]);
  const bundle = useMemo(() => buildPortfolioReadiness(experiences), [experiences]);

  useEffect(() => {
    if (!experience) return;
    trackActivation('experience_completion_screen_viewed', {
      experienceId: id,
      experienceCountTotal: experiences.length,
      experienceCountReady: bundle.readyCount,
      readinessScore: readiness.score,
    });
    if (!readiness.portfolioReady) {
      saveActivationTask(user?.uid, {
        type: 'confirm_experience',
        to: `/app/experience/complete/${id}`,
        label: `“${experience.title || '경험'}”의 사실을 확인하면 포트폴리오에 사용할 수 있어요.`,
      });
    }
  }, [experience?.id]);

  const confirmExperience = async () => {
    if (!readiness.requiredComplete) {
      toast.error('배경, 역할, 행동, 결과를 먼저 보완해주세요.');
      navigate(`/app/experience/result/${id}`);
      return;
    }
    if (!attested) {
      toast.error('사실 확인 항목에 체크해주세요.');
      return;
    }
    setSaving(true);
    try {
      const patch = readinessPatch(experience, { confirmed: true });
      await updateExperience(id, patch);
      trackActivation('experience_portfolio_ready', {
        experienceId: id,
        experienceCountTotal: experiences.length,
        experienceCountReady: bundle.readyCount + (readiness.portfolioReady ? 0 : 1),
        portfolioRoles: patch.portfolioRoles.join(','),
      });
      const coveredAfter = new Set([...bundle.coveredSlots, ...patch.portfolioRoles]);
      const readyCountAfter = bundle.readyCount + (readiness.portfolioReady ? 0 : 1);
      const bundleReadyAfter = readyCountAfter >= 3 && coveredAfter.size >= 3;
      const nextSlotAfter = PORTFOLIO_SLOT_ORDER.find(slot => !coveredAfter.has(slot)) || 'growth';
      saveActivationTask(user?.uid, bundleReadyAfter ? {
        type: 'create_portfolio_plan',
        to: '/app/portfolio/plan',
        label: '검증된 경험 묶음이 준비됐어요. 포트폴리오 플랜을 만들어보세요.',
      } : {
        type: 'add_next_experience',
        to: `/app/experience/quick?from=${id}&slot=${nextSlotAfter}`,
        label: `${PORTFOLIO_SLOT_META[nextSlotAfter].label} 경험을 하나 더 정리하면 포트폴리오가 더 탄탄해져요.`,
      });
      toast.success('이 경험을 포트폴리오에 사용할 준비가 됐어요.');
    } catch (error) {
      toast.error(error?.response?.data?.error || '확인 상태 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !experience) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-400">경험을 불러오는 중입니다…</div>;
  }
  if (!experience) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
        <p className="font-bold text-gray-700">경험을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/app/experience')} className="mt-4 text-sm font-bold text-primary-600">경험 목록으로</button>
      </div>
    );
  }

  const confirmed = readiness.portfolioReady;
  const nextSlot = bundle.nextSlot || 'growth';
  const nextMeta = PORTFOLIO_SLOT_META[nextSlot];
  const readyAfterConfirmation = bundle.readyCount + (confirmed ? 0 : 1);

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn pb-16">
      <div className="py-6">
        <FlowSteps current={2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <main className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-9">
          <h1 className="text-[26px] font-extrabold leading-snug tracking-[-0.03em] text-gray-900 md:text-[30px]">
            “{experience.title || '나의 경험'}”이<br className="hidden sm:block" /> 포트폴리오 카드로 바뀌었습니다
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-gray-500">
            내용을 한 번 확인하면 첫 번째 검증 경험이 됩니다. 다음에는 부족한 역할에 맞는 경험 하나만 이어서 정리해요.
          </p>

          <div className="mt-9 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-bold text-gray-300">포트폴리오 카드</h2>
            <span className="text-[12.5px] font-bold text-primary-600">준비도 {readiness.score}%</span>
          </div>

          <div className="mt-4">
            {[
              ['문제·배경', readiness.preview.context],
              ['나의 역할', readiness.preview.role],
              ['행동·판단', readiness.preview.action],
              ['결과·배움', readiness.preview.outcome],
            ].map(([label, value]) => (
              <div key={label} className="border-b border-gray-100 py-4">
                <p className="mb-1.5 text-[12px] text-gray-400">{label}</p>
                <p className={`text-[13.5px] leading-relaxed ${value ? 'text-gray-800' : 'text-amber-600'}`}>
                  {truncate(value) || '확인이 필요한 내용입니다.'}
                </p>
              </div>
            ))}
          </div>

          {!confirmed && (
            <label className="mt-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={attested}
                onChange={event => setAttested(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary-600"
              />
              <span className="text-[12.5px] leading-relaxed text-gray-600">
                위 내용이 실제 경험과 나의 기여를 바탕으로 작성됐음을 확인했습니다. 확인되지 않은 수치나 표현은 수정했습니다.
              </span>
            </label>
          )}

          <div className="mt-7 flex flex-wrap gap-2.5">
            {!confirmed ? (
              <button
                onClick={confirmExperience}
                disabled={saving}
                className="rounded-full bg-primary-600 px-6 py-3 text-[13px] font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '저장 중…' : readiness.requiredComplete ? '사실 확인 완료' : '내용을 보완하고 확인하기'}
              </button>
            ) : (
              <span className="rounded-full bg-emerald-50 px-6 py-3 text-[13px] font-bold text-emerald-700">검증 완료</span>
            )}
            <button
              onClick={() => navigate(`/app/experience/result/${id}`)}
              className="rounded-full border border-gray-200 px-6 py-3 text-[13px] font-bold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
            >
              내용 자세히 보기·수정
            </button>
          </div>
        </main>

        <aside className="self-start lg:sticky lg:top-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-[15px] font-bold text-gray-300">진행 상황</h2>

            <div className="mt-5 flex items-baseline justify-between">
              <span className="text-[14px] font-bold text-gray-900">검증한 경험</span>
              <span className="text-[15px] font-extrabold text-primary-600">{Math.min(readyAfterConfirmation, 3)} / 3</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${Math.min(100, readyAfterConfirmation / 3 * 100)}%` }} />
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-gray-500">
              {bundle.ready ? '경험 묶음이 준비됐습니다. 이제 포트폴리오 플랜을 만드세요.' : `${nextMeta.label}을 보여줄 경험을 다음으로 정리하면 좋아요.`}
            </p>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-[15px] font-bold text-gray-900">
                {bundle.ready ? '경험 3~4개를 지원용으로 배치하기' : `${nextMeta.label} 경험을 3분 초안으로 저장하기`}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500">
                {bundle.ready ? '지원 직무에 맞는 대표 순서와 부족한 근거를 확인합니다.' : nextMeta.description}
              </p>
              <button
                type="button"
                onClick={() => {
                  const to = bundle.ready ? '/app/portfolio/plan' : `/app/experience/quick?from=${id}&slot=${nextSlot}`;
                  trackActivation('next_experience_started', { fromExperienceId: id, nextSlot, experienceCountReady: bundle.readyCount });
                  navigate(to);
                }}
                className="mt-5 w-full rounded-full bg-primary-600 px-5 py-3 text-[13px] font-bold text-white transition-colors hover:bg-primary-700"
              >
                {bundle.ready ? '포트폴리오 플랜 만들기' : '다음 경험 3분 초안'}
              </button>
              {!bundle.ready && (
                <button
                  onClick={() => navigate('/app/portfolio/plan')}
                  className="mt-2 w-full py-2.5 text-[12.5px] font-bold text-primary-600 hover:text-primary-700"
                >
                  현재 포트폴리오 뼈대 보기
                </button>
              )}
            </div>
          </section>

          <button
            onClick={() => navigate('/app/experience')}
            className="mt-4 w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-[12.5px] font-bold text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
          >
            경험 목록에서 보기
          </button>
        </aside>
      </div>
    </div>
  );
}
