import { ArrowRight, Check, Circle, FileCheck2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  buildPortfolioReadiness,
  PORTFOLIO_SLOT_META,
  PORTFOLIO_SLOT_ORDER,
} from '../utils/experienceReadiness';

export default function PortfolioReadinessBoard({ experiences = [], compact = false }) {
  const navigate = useNavigate();
  const summary = buildPortfolioReadiness(experiences);
  const confirmable = summary.items.find(item => item.readiness.requiredComplete && !item.readiness.portfolioReady);
  const nextMeta = summary.nextSlot ? PORTFOLIO_SLOT_META[summary.nextSlot] : null;

  const primaryAction = summary.ready
    ? { label: '포트폴리오 플랜 만들기', to: '/app/portfolio/plan' }
    : confirmable
      ? { label: `“${confirmable.experience.title || '경험'}” 사실 확인하기`, to: `/app/experience/complete/${confirmable.experience.id}` }
      : { label: nextMeta ? `${nextMeta.label} 경험 초안 만들기` : '다음 경험 초안 만들기', to: `/app/experience/quick?slot=${summary.nextSlot || 'growth'}` };

  return (
    <section className={`overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-white to-primary-50/60 shadow-sm ${compact ? 'p-5' : 'p-6 md:p-7'}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-primary-500">
            <FileCheck2 size={15} /> Portfolio readiness
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className={`${compact ? 'text-[20px]' : 'text-[24px]'} font-extrabold tracking-[-0.025em] text-gray-900`}>
              {summary.status === 'strong' ? '지원용 경험 묶음이 탄탄해요' : summary.ready ? '포트폴리오 플랜을 만들 준비가 됐어요' : '지원용 경험 묶음을 만드는 중이에요'}
            </h2>
            <span className="text-[13px] font-bold text-primary-600">검증 완료 {summary.readyCount}개 · 전체 {summary.totalCount}개</span>
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-500">
            {summary.ready
              ? '가장 강한 3~4개 경험을 골라 지원 직무에 맞는 순서와 역할을 정해보세요.'
              : nextMeta
                ? `${nextMeta.description}이 보강되면 포트폴리오의 설득력이 더 좋아집니다.`
                : '경험의 사실을 확인하면 포트폴리오 플랜에 사용할 수 있어요.'}
          </p>
        </div>
        <div className="shrink-0">
          <div className="mb-2 flex items-center justify-between text-[12px] font-bold text-gray-500">
            <span>준비도</span><span className="text-primary-600">{summary.progress}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-100 lg:w-64">
            <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${summary.progress}%` }} />
          </div>
        </div>
      </div>

      <div className={`mt-5 grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
        {PORTFOLIO_SLOT_ORDER.map(slot => {
          const covered = summary.coveredSlots.includes(slot);
          const meta = PORTFOLIO_SLOT_META[slot];
          return (
            <div key={slot} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${covered ? 'border-emerald-100 bg-emerald-50/70' : 'border-gray-200 bg-white'}`}>
              {covered ? <Check size={16} className="shrink-0 text-emerald-600" /> : <Circle size={15} className="shrink-0 text-gray-300" />}
              <div className="min-w-0">
                <p className={`text-[13px] font-bold ${covered ? 'text-emerald-800' : 'text-gray-600'}`}>{meta.label}</p>
                <p className="truncate text-[11.5px] text-gray-400">{covered ? '근거 있음' : '보강 추천'}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(primaryAction.to)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-[14px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700"
        >
          <Sparkles size={16} /> {primaryAction.label} <ArrowRight size={15} />
        </button>
        {!summary.ready && summary.totalCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/app/portfolio/plan')}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13.5px] font-bold text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-600"
          >
            현재 포트폴리오 뼈대 보기
          </button>
        )}
        {!summary.ready && summary.totalCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/app/experience/candidates')}
            className="rounded-xl px-3 py-3 text-[13px] font-bold text-gray-500 transition-colors hover:text-primary-600"
          >
            자료에서 찾은 경험 후보 보기
          </button>
        )}
      </div>
    </section>
  );
}
