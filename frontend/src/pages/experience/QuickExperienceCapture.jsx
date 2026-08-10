import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import FlowSteps from '../../components/FlowSteps';
import { buildDraftStructuredResult } from '../../utils/experienceDraft';
import { evaluateExperienceReadiness, PORTFOLIO_SLOT_META } from '../../utils/experienceReadiness';
import { trackActivation } from '../../services/activationMetrics';
import { saveActivationTask } from '../../services/activationJourney';

/* 빈 칸 다섯 개만 놓여 있으면 무엇을 어느 정도로 써야 할지 알 수 없다.
   그래서 이미 정리한 경험 하나를 옆에 띄워 같은 깊이로 쓰게 하고,
   확실히 아는 값(역할)만 미리 채운다. 경험 내용 자체는 지어내지 않는다 —
   검증되지 않은 문장이 들어가면 이 서비스가 파는 '검증된 경험'이 무너진다. */

const FIELDS = [
  {
    key: 'title',
    label: '어떤 경험인가요?',
    placeholder: '예: 결제 전환 개선 프로젝트',
    hints: ['프로젝트·활동 이름', '소속이나 기간을 붙여도 좋아요'],
    rows: 1,
    required: true,
  },
  {
    key: 'context',
    label: '어떤 문제나 목표가 있었나요?',
    placeholder: '당시 상황과 해결해야 했던 문제를 한두 문장으로 적어주세요.',
    hints: ['언제·어디서', '무엇이 문제였는지', '왜 중요했는지'],
    rows: 3,
    required: true,
  },
  {
    key: 'role',
    label: '내가 맡은 역할은 무엇이었나요?',
    placeholder: '팀 전체가 아니라 내가 직접 책임진 범위를 적어주세요.',
    hints: ['담당 범위', '팀 규모', '내가 책임진 부분'],
    rows: 2,
  },
  {
    key: 'action',
    label: '내가 실제로 한 가장 중요한 행동은?',
    placeholder: '분석, 결정, 제작, 조율처럼 직접 한 행동을 적어주세요.',
    hints: ['분석·결정·제작·조율', '왜 그렇게 판단했는지'],
    rows: 3,
    required: true,
  },
  {
    key: 'outcome',
    label: '결과 또는 배운 점은 무엇인가요?',
    placeholder: '수치가 없어도 산출물, 반응, 변화, 다음 판단을 적을 수 있어요.',
    hints: ['수치·산출물·반응', '수치가 없으면 변화나 다음 판단'],
    rows: 3,
  },
];

const truncate = (value, max = 150) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
};

export default function QuickExperienceCapture() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const slot = searchParams.get('slot') || 'growth';
  const fromExperienceId = searchParams.get('from') || '';
  const slotMeta = PORTFOLIO_SLOT_META[slot] || PORTFOLIO_SLOT_META.growth;
  const user = useAuthStore(state => state.user);
  const profile = useAuthStore(state => state.profile);
  const { experiences, fetchExperiences, createExperience } = useExperienceStore();
  const [saving, setSaving] = useState(false);
  const [autoRole, setAutoRole] = useState('');
  const prefilled = useRef(false);
  const [form, setForm] = useState(() => ({
    title: location.state?.prefill?.title || '',
    context: location.state?.prefill?.context || '',
    role: location.state?.prefill?.role || '',
    action: location.state?.prefill?.action || '',
    outcome: location.state?.prefill?.outcome || '',
  }));

  useEffect(() => {
    if (user?.uid) fetchExperiences(user.uid);
  }, [user?.uid]);

  /* 옆에 띄울 참고 경험 — 방금 정리한 경험이 있으면 그것을, 없으면 가장 잘 정리된 것을 쓴다. */
  const reference = useMemo(() => {
    if (experiences.length === 0) return null;
    const source = experiences.find(item => item.id === fromExperienceId)
      || [...experiences]
        .map(item => ({ item, readiness: evaluateExperienceReadiness(item) }))
        .sort((a, b) => b.readiness.score - a.readiness.score)[0]?.item;
    if (!source) return null;
    return { experience: source, readiness: evaluateExperienceReadiness(source) };
  }, [experiences, fromExperienceId]);

  /* 확실히 아는 값만 채운다. 사용자가 이미 입력한 칸은 건드리지 않는다. */
  useEffect(() => {
    if (prefilled.current || !reference) return;
    const suggested = truncate(
      (reference.readiness.preview.role || profile?.targetPosition || profile?.jobTitle || '').trim(),
      80,
    );
    if (!suggested) return;
    prefilled.current = true;
    setForm(prev => (prev.role.trim() ? prev : { ...prev, role: suggested }));
    setAutoRole(suggested);
  }, [reference, profile?.targetPosition, profile?.jobTitle]);

  // 값을 저장하는 대신 비교로 판단한다 — 사용자가 고치는 순간 안내가 자동으로 사라진다.
  const roleAutoFilled = Boolean(autoRole) && form.role === autoRole;

  const completed = useMemo(() => Object.values(form).filter(value => value.trim()).length, [form]);
  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const saveDraft = async event => {
    event.preventDefault();
    if (!form.title.trim() || !form.context.trim() || !form.action.trim()) {
      toast.error('제목, 문제·배경, 행동은 먼저 적어주세요.');
      return;
    }
    setSaving(true);
    try {
      const rawInput = [
        `경험: ${form.title}`,
        `문제와 배경: ${form.context}`,
        `나의 역할: ${form.role}`,
        `행동과 판단: ${form.action}`,
        `결과 또는 배운 점: ${form.outcome}`,
      ].join('\n');
      const structuredResult = buildDraftStructuredResult({
        title: form.title.trim(),
        jobCategory: profile?.jobCategory || profile?.targetJobCategory || 'common',
        collectedText: rawInput,
        content: { rawInput },
        moments: [{
          title: form.title.trim(),
          context: form.context.trim(),
          action: form.action.trim(),
          result: form.outcome.trim(),
          learning: form.outcome.trim(),
          keywords: [slotMeta.label],
        }],
      });
      structuredResult.projectOverview = {
        ...(structuredResult.projectOverview || {}),
        background: form.context.trim(),
        goal: form.context.trim(),
        role: form.role.trim(),
        summary: form.context.trim(),
      };
      const id = await createExperience(user.uid, {
        title: form.title.trim(),
        framework: 'STRUCTURED',
        jobCategory: profile?.jobCategory || profile?.targetJobCategory || 'common',
        content: {
          rawInput,
          problem: form.context.trim(),
          role: form.role.trim(),
          action: form.action.trim(),
          outcome: form.outcome.trim(),
        },
        structuredResult,
        keywords: [slotMeta.label],
        portfolioRoles: [slot],
        lifecycleStatus: 'needs_confirmation',
        analysisMode: 'quick_capture',
      });
      trackActivation('next_experience_draft_saved', {
        experienceId: id,
        fromExperienceId,
        nextSlot: slot,
      });
      saveActivationTask(user.uid, {
        type: 'confirm_experience',
        to: `/app/experience/complete/${id}`,
        label: `“${form.title.trim()}” 초안을 확인해 포트폴리오 경험으로 완성하세요.`,
      });
      toast.success('경험 초안을 저장했어요.');
      navigate(`/app/experience/complete/${id}`);
    } catch (error) {
      toast.error(error?.response?.data?.error || '초안 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn pb-16">
      <div className="py-6">
        <FlowSteps current={1} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <main className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-9">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-extrabold tracking-[-0.03em] text-gray-900 md:text-[28px]">
                {slotMeta.label} 경험을 하나 정리해요
              </h1>
              <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-gray-500">
                {slotMeta.description}. 완벽하게 쓰지 않아도 됩니다 — 저장한 뒤 언제든 보완할 수 있어요.
              </p>
            </div>
            <span className="shrink-0 text-[12px] font-bold text-gray-400">{completed} / 5 작성</span>
          </div>

          <form onSubmit={saveDraft} className="mt-9">
            {FIELDS.map(field => (
              <label key={field.key} className="mb-7 block">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13.5px] font-bold text-gray-800">{field.label}</span>
                  {!field.required && <span className="text-[11.5px] text-gray-300">선택</span>}
                  {field.key === 'role' && roleAutoFilled && (
                    <span className="text-[11.5px] font-medium text-primary-600">이전 경험에서 가져왔어요 · 다르면 고쳐주세요</span>
                  )}
                </span>
                <span className="mt-1 mb-2 block text-[11.5px] text-gray-400">{field.hints.join(' · ')}</span>
                {field.rows === 1 ? (
                  <input
                    value={form[field.key]}
                    onChange={event => setField(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="w-full border-0 border-b border-gray-200 bg-transparent px-0 pb-2 pt-1 text-[14.5px] text-gray-800 outline-none transition-colors placeholder:text-gray-300 focus:border-primary-500"
                  />
                ) : (
                  <textarea
                    rows={field.rows}
                    value={form[field.key]}
                    onChange={event => setField(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-[14px] leading-relaxed text-gray-800 outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-50"
                  />
                )}
              </label>
            ))}

            <div className="flex flex-wrap items-center gap-2.5 border-t border-gray-100 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-primary-600 px-6 py-3 text-[13px] font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '저장 중…' : '초안 저장하고 확인하기'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/experience')}
                className="rounded-full border border-gray-200 px-6 py-3 text-[13px] font-bold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
              >
                나중에 이어서 하기
              </button>
            </div>
          </form>
        </main>

        <aside className="self-start lg:sticky lg:top-5">
          <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-[15px] font-bold text-gray-300">참고할 내 경험</h2>

            {!reference ? (
              <p className="mt-4 text-[12.5px] leading-relaxed text-gray-500">
                아직 정리한 경험이 없어요. 위 칸을 한 문장씩만 채워도 초안이 만들어집니다.
              </p>
            ) : (
              <>
                <p className="mt-4 text-[15px] font-bold text-gray-900">{reference.experience.title || '제목 없는 경험'}</p>
                <p className="mt-1 text-[11.5px] text-gray-400">이 정도 길이면 충분합니다. 같은 깊이로 적어보세요.</p>

                <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
                  {[
                    ['문제·배경', reference.readiness.preview.context],
                    ['나의 역할', reference.readiness.preview.role],
                    ['행동·판단', reference.readiness.preview.action],
                    ['결과·배움', reference.readiness.preview.outcome],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-gray-100 py-3 last:border-b-0">
                      <p className="mb-1 text-[11.5px] text-gray-400">{label}</p>
                      <p className="text-[12.5px] leading-relaxed text-gray-600">
                        {truncate(value) || '아직 비어 있는 항목입니다.'}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/app/experience/result/${reference.experience.id}`)}
                  className="mt-4 w-full rounded-full border border-gray-200 px-5 py-2.5 text-[12.5px] font-bold text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
                >
                  이 경험 전체 보기
                </button>
              </>
            )}
          </section>

          <p className="mt-4 px-1 text-[12px] leading-relaxed text-gray-400">
            내용은 자동으로 지어내지 않습니다. 직접 적은 사실만 포트폴리오에 들어가야 채용 담당자 앞에서 설명할 수 있어요.
          </p>
        </aside>
      </div>
    </div>
  );
}
