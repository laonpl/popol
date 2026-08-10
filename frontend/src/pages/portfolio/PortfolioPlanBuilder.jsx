import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import FlowSteps from '../../components/FlowSteps';
import {
  buildPortfolioReadiness,
  evaluateExperienceReadiness,
  PORTFOLIO_SLOT_META,
  PORTFOLIO_SLOT_ORDER,
} from '../../utils/experienceReadiness';
import { trackActivation } from '../../services/activationMetrics';
import { clearActivationTask } from '../../services/activationJourney';

/* 목록에서 경험을 고를 때는 전문이 아니라 판단에 필요한 만큼만 보여준다.
   첫 문장만 잘라 한 줄로 만든다. */
function oneLine(value, max = 92) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const match = text.match(/^.*?(?:다\.|\.|!|\?)(?=\s|$)/);
  const sentence = (match ? match[0] : text).trim();
  return sentence.length > max ? `${sentence.slice(0, max).trim()}…` : sentence;
}

/** 역량·기술 태그 — 경험마다 필드가 제각각이라 있는 것만 모아 쓴다. */
function pickTags(experience, readiness, max = 4) {
  const roleLabels = readiness.portfolioRoles
    .map(role => PORTFOLIO_SLOT_META[role]?.label)
    .filter(Boolean);
  const extra = [
    ...(Array.isArray(experience.competencyTags) ? experience.competencyTags : []),
    ...(Array.isArray(experience.keywords) ? experience.keywords : []),
    ...(Array.isArray(experience.classify) ? experience.classify : []),
  ]
    .map(tag => String(typeof tag === 'string' ? tag : tag?.name || '').trim())
    .filter(Boolean);
  return [...new Set([...roleLabels, ...extra])].slice(0, max);
}

/* 참조 디자인의 폼 스타일 — 작은 회색 라벨 + 밑줄 입력. 테두리 상자를 쓰지 않는다. */
const UNDERLINE_INPUT = 'w-full border-0 border-b border-gray-200 bg-transparent px-0 pb-2 pt-1 text-[14.5px] text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-primary-500';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-gray-400">{label}</span>
      {children}
    </label>
  );
}

/** 섹션 제목 — 참조 디자인처럼 흐린 회색으로 구획만 알려준다. */
function SectionTitle({ children, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[17px] font-bold text-gray-300">{children}</h2>
      {action}
    </div>
  );
}

export default function PortfolioPlanBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 같은 플랜 화면에서 포트폴리오와 이력서 중 무엇을 만들지만 갈라진다.
  // 선택한 경험은 동일하게 쓰이고, 이력서는 생성된 포트폴리오에서 바로 내보내진다.
  const outputType = searchParams.get('output') === 'resume' ? 'resume' : 'portfolio';
  const isResume = outputType === 'resume';
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
      outputType,
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
      <div className="py-6">
        <FlowSteps current={3} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <main className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-9">
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-gray-900 md:text-[30px]">
            {isResume ? '이력서에 넣을 경험' : '포트폴리오에 넣을 경험'}
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-gray-500">
            {isResume
              ? '선택한 경험으로 포트폴리오를 만든 뒤, 이력서 내보내기 화면이 바로 열립니다.'
              : '템플릿보다 먼저 어떤 경험을 어떤 역할로 보여줄지 정합니다. 경험이 부족해도 현재 뼈대를 미리 볼 수 있어요.'}
          </p>

          <div className="mt-9">
            <SectionTitle>지원 목표</SectionTitle>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Field label="기업명">
                <input
                  value={target.company}
                  onChange={event => setTarget(prev => ({ ...prev, company: event.target.value }))}
                  placeholder="예: 핏폴리"
                  className={UNDERLINE_INPUT}
                />
              </Field>
              <Field label="지원 직무">
                <input
                  value={target.role}
                  onChange={event => setTarget(prev => ({ ...prev, role: event.target.value }))}
                  placeholder="예: 프로덕트 매니저"
                  className={UNDERLINE_INPUT}
                />
              </Field>
              <Field label="지원 마감일">
                <input
                  type="date"
                  value={target.deadline}
                  onChange={event => setTarget(prev => ({ ...prev, deadline: event.target.value }))}
                  className={UNDERLINE_INPUT}
                />
              </Field>
            </div>
            <p className="mt-4 text-[12px] text-gray-400">아직 정하지 않았다면 비워두고 일반 포트폴리오로 진행할 수 있어요.</p>
          </div>

          <div className="mt-11 border-t border-gray-100 pt-9">
            <SectionTitle
              action={(
                <button onClick={() => navigate('/app/experience/quick')} className="text-[12.5px] font-bold text-primary-600 hover:text-primary-700">
                  부족한 경험 추가
                </button>
              )}
            >
              경험 선택 · 최대 4개
            </SectionTitle>

            {experiences.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-6 py-14 text-center">
                <p className="text-[14px] font-bold text-gray-600">아직 정리한 경험이 없습니다.</p>
                <button onClick={() => navigate('/app/experience/quick')} className="mt-4 rounded-full bg-primary-600 px-6 py-3 text-[13px] font-bold text-white transition-colors hover:bg-primary-700">
                  첫 경험 초안 만들기
                </button>
              </div>
            ) : (
              <div>
                {summary.items
                  .sort((a, b) => b.readiness.score - a.readiness.score)
                  .map(({ experience, readiness }) => {
                    const selected = selectedIds.includes(experience.id);
                    const summary = oneLine(readiness.preview.context || readiness.preview.outcome);
                    const did = [oneLine(readiness.preview.role, 26), oneLine(readiness.preview.action, 64)]
                      .filter(Boolean)
                      .join(' · ');
                    const tags = pickTags(experience, readiness);
                    return (
                      <button
                        key={experience.id}
                        type="button"
                        onClick={() => toggleExperience(experience.id)}
                        className="flex w-full items-start gap-3.5 border-b border-gray-100 py-3.5 text-left transition-colors hover:bg-gray-50/80"
                      >
                        {/* 참조 디자인의 라디오처럼 CSS 도형만 쓴다 */}
                        <span className={`mt-[3px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition-colors ${selected ? 'border-primary-600' : 'border-gray-300'}`}>
                          {selected && <span className="h-[7px] w-[7px] rounded-full bg-primary-600" />}
                        </span>

                        {/* 4줄 고정 — 무슨 경험인지 / 핵심 / 무엇을 했는지 / 태그 */}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={`truncate text-[14.5px] font-bold ${selected ? 'text-gray-900' : 'text-gray-700'}`}>
                              {experience.title || '제목 없는 경험'}
                            </span>
                            <span className={`shrink-0 text-[11.5px] font-medium ${readiness.portfolioReady ? 'text-emerald-600' : readiness.requiredComplete ? 'text-amber-600' : 'text-gray-400'}`}>
                              {readiness.portfolioReady ? '검증 완료' : readiness.requiredComplete ? '사실 확인 필요' : '내용 보완 필요'}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-[12.5px] text-gray-500">
                            {summary || '아직 상세 내용이 부족합니다.'}
                          </span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-gray-400">
                            {did || '역할과 행동이 아직 정리되지 않았습니다.'}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1 overflow-hidden">
                            {tags.length > 0 ? tags.map(tag => (
                              <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">{tag}</span>
                            )) : <span className="text-[11px] text-gray-300">태그 없음</span>}
                          </span>
                        </span>

                        <span className="shrink-0 pt-0.5 text-[12.5px] font-bold text-gray-300">{readiness.score}%</span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </main>

        <aside className="self-start lg:sticky lg:top-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-[15px] font-bold text-gray-300">선택 요약</h2>

            <div className="mt-5">
              <p className="text-[15px] font-bold text-gray-900">스토리 커버리지</p>
              <div className="mt-3 space-y-2">
                {PORTFOLIO_SLOT_ORDER.map(slot => {
                  const covered = selectedCoverage.has(slot);
                  return (
                    <div key={slot} className="flex items-baseline justify-between gap-3">
                      <span className={`text-[13px] ${covered ? 'text-gray-700' : 'text-gray-400'}`}>{PORTFOLIO_SLOT_META[slot].label}</span>
                      <span className={`shrink-0 text-[12.5px] font-medium ${covered ? 'text-emerald-600' : 'text-gray-300'}`}>
                        {covered ? '충족' : '보강 추천'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t border-gray-100 pt-4">
              <span className="text-[14px] font-bold text-gray-900">선택한 경험</span>
              <span className="text-[15px] font-extrabold text-primary-600">{selectedIds.length} / 4개</span>
            </div>

            {selectedIds.length < 3 && (
              <p className="mt-4 text-[12px] leading-relaxed text-amber-700">
                현재 {selectedIds.length}개 경험으로도 초안을 만들 수 있지만, 지원용 완성도를 위해 3개 이상을 권장합니다.
              </p>
            )}
            {unconfirmedSelected.length > 0 && (
              <p className="mt-3 text-[12px] leading-relaxed text-gray-500">
                선택한 경험 중 {unconfirmedSelected.length}개는 사실 확인이 남아 있습니다. 템플릿 생성 후에도 보완할 수 있어요.
              </p>
            )}

            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => navigate(-1)}
                className="rounded-full bg-gray-100 px-6 py-3 text-[13px] font-bold text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
              >
                뒤로
              </button>
              <button
                onClick={continueToTemplate}
                disabled={selectedIds.length === 0}
                className="flex-1 rounded-full bg-primary-600 px-5 py-3 text-[13px] font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
              >
                다음: 추천 템플릿
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-gray-400">선택한 경험과 순서는 포트폴리오에 자동 반영됩니다.</p>
          </section>

          <p className="mt-4 px-1 text-[12px] leading-relaxed text-gray-400">
            경험이 4개를 넘으면 전부 넣기보다 지원 직무에 가장 잘 맞는 3~4개만 선택하는 편이 좋습니다.
          </p>
        </aside>
      </div>
    </div>
  );
}
