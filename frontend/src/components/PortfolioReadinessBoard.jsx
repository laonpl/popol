import { useNavigate } from 'react-router-dom';
import {
  buildPortfolioReadiness,
  PORTFOLIO_SLOT_META,
  PORTFOLIO_SLOT_ORDER,
} from '../utils/experienceReadiness';

/* 포트폴리오를 만들려면 사실 확인을 마친 경험이 최소 몇 개 필요한지.
   이 숫자가 화면 문구·CTA 분기의 기준이 된다. */
const REQUIRED_COUNT = 3;

export default function PortfolioReadinessBoard({ experiences = [], compact = false }) {
  const navigate = useNavigate();
  const summary = buildPortfolioReadiness(experiences);
  const confirmable = summary.items.find(item => item.readiness.requiredComplete && !item.readiness.portfolioReady);
  const nextMeta = summary.nextSlot ? PORTFOLIO_SLOT_META[summary.nextSlot] : null;

  // 포트폴리오·이력서를 만들 수 있는지는 "사실 확인을 마친 경험 수"만으로 판단한다.
  const canBuild = summary.readyCount >= REQUIRED_COUNT;
  const remaining = Math.max(0, REQUIRED_COUNT - summary.readyCount);

  const collectAction = confirmable
    ? { label: `“${confirmable.experience.title || '경험'}” 사실 확인하기`, to: `/app/experience/complete/${confirmable.experience.id}` }
    : { label: '새 경험 정리하기', to: `/app/experience/quick?slot=${summary.nextSlot || 'growth'}` };

  return (
    <section className={`overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-white via-white to-primary-50/60 shadow-sm ${compact ? 'p-5' : 'p-6 md:p-7'}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-primary-500">
            지원 서류 준비
          </p>
          <h2 className={`${compact ? 'text-[20px]' : 'text-[24px]'} font-extrabold tracking-[-0.025em] text-gray-900`}>
            {canBuild
              ? `경험 ${summary.readyCount}개로 포트폴리오를 만들 수 있어요`
              : `경험 ${remaining}개만 더 채우면 포트폴리오를 완성할 수 있어요`}
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-500">
            {canBuild
              ? '정리한 경험을 그대로 써서 포트폴리오와 이력서를 각각 만들 수 있습니다.'
              : nextMeta
                ? `${nextMeta.description}을 정리하면 포트폴리오의 설득력이 더 좋아집니다.`
                : '경험의 사실 확인을 마치면 포트폴리오에 바로 사용할 수 있어요.'}
          </p>
          <p className="mt-2 text-[13px] font-bold text-gray-400">
            바로 쓸 수 있는 경험 <span className="text-primary-600">{summary.readyCount}개</span>
            {summary.draftCount > 0 && <> · 정리 중 {summary.draftCount}개</>}
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

      <div className="mt-6">
        <p className="mb-2.5 text-[13px] font-bold text-gray-600">포트폴리오에 들어갈 이야기</p>
        <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
          {PORTFOLIO_SLOT_ORDER.map(slot => {
            const covered = summary.coveredSlots.includes(slot);
            const meta = PORTFOLIO_SLOT_META[slot];
            return (
              <div key={slot} className={`rounded-xl border px-3.5 py-3 ${covered ? 'border-emerald-200 bg-emerald-50/70' : 'border-gray-200 bg-white'}`}>
                <p className={`text-[13px] font-bold ${covered ? 'text-emerald-800' : 'text-gray-600'}`}>{meta.label}</p>
                <p className={`mt-0.5 truncate text-[11.5px] font-medium ${covered ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {covered ? '준비됨' : '아직 없음'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {canBuild ? (
          <>
            <button
              type="button"
              onClick={() => navigate('/app/portfolio/plan')}
              className="rounded-xl bg-primary-600 px-5 py-3 text-[14px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700"
            >
              포트폴리오 만들기
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/portfolio/plan?output=resume')}
              className="rounded-xl border border-primary-200 bg-white px-5 py-3 text-[14px] font-bold text-primary-600 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              이력서 만들기
            </button>
            <button
              type="button"
              onClick={() => navigate(collectAction.to)}
              className="rounded-xl px-3 py-3 text-[13px] font-bold text-gray-500 transition-colors hover:text-primary-600"
            >
              경험 더 정리하기
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => navigate(collectAction.to)}
              className="rounded-xl bg-primary-600 px-5 py-3 text-[14px] font-bold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700"
            >
              {collectAction.label}
            </button>
            {summary.totalCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/app/portfolio/plan')}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-[13.5px] font-bold text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-600"
              >
                지금까지 만든 뼈대 보기
              </button>
            )}
            {summary.totalCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/app/experience/candidates')}
                className="rounded-xl px-3 py-3 text-[13px] font-bold text-gray-500 transition-colors hover:text-primary-600"
              >
                자료에서 찾은 경험 후보 보기
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
