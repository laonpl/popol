import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock3, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useExperienceStore from '../../stores/experienceStore';
import { buildDraftStructuredResult } from '../../utils/experienceDraft';
import { PORTFOLIO_SLOT_META } from '../../utils/experienceReadiness';
import { trackActivation } from '../../services/activationMetrics';
import { saveActivationTask } from '../../services/activationJourney';

export default function QuickExperienceCapture() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const slot = searchParams.get('slot') || 'growth';
  const fromExperienceId = searchParams.get('from') || '';
  const slotMeta = PORTFOLIO_SLOT_META[slot] || PORTFOLIO_SLOT_META.growth;
  const user = useAuthStore(state => state.user);
  const profile = useAuthStore(state => state.profile);
  const createExperience = useExperienceStore(state => state.createExperience);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    title: location.state?.prefill?.title || '',
    context: location.state?.prefill?.context || '',
    role: location.state?.prefill?.role || '',
    action: location.state?.prefill?.action || '',
    outcome: location.state?.prefill?.outcome || '',
  }));

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
      toast.success('두 번째 경험 초안을 저장했어요.');
      navigate(`/app/experience/complete/${id}`);
    } catch (error) {
      toast.error(error?.response?.data?.error || '초안 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: 'title', label: '어떤 경험인가요?', placeholder: '예: 결제 전환 개선 프로젝트', rows: 1 },
    { key: 'context', label: '어떤 문제나 목표가 있었나요?', placeholder: '당시 상황과 해결해야 했던 문제를 한두 문장으로 적어주세요.', rows: 3 },
    { key: 'role', label: '내가 맡은 역할은 무엇이었나요?', placeholder: '팀 전체가 아니라 내가 직접 책임진 범위를 적어주세요.', rows: 2 },
    { key: 'action', label: '내가 실제로 한 가장 중요한 행동은?', placeholder: '분석, 결정, 제작, 조율처럼 직접 한 행동을 적어주세요.', rows: 3 },
    { key: 'outcome', label: '결과 또는 배운 점은 무엇인가요?', placeholder: '수치가 없어도 산출물, 반응, 변화, 다음 판단을 적을 수 있어요.', rows: 3 },
  ];

  return (
    <div className="mx-auto max-w-3xl animate-fadeIn pb-16">
      <button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-bold text-gray-400 hover:text-gray-700"><ArrowLeft size={15} /> 돌아가기</button>
      <div className="rounded-3xl border border-primary-100 bg-gradient-to-br from-white to-primary-50/60 p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-[12px] font-extrabold text-primary-700"><Clock3 size={13} /> 약 3분</span>
            <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-gray-900">다음 경험을 초안으로 잡아둘게요</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-500">이번에는 <strong className="text-primary-700">{slotMeta.label}</strong>을 보여줄 경험이 좋습니다. 완벽하게 쓰지 않아도 저장 후 다시 보완할 수 있어요.</p>
          </div>
          <span className="text-[12px] font-bold text-gray-400">{completed} / 5 작성</span>
        </div>

        <form onSubmit={saveDraft} className="mt-7 space-y-5">
          {fields.map(field => (
            <label key={field.key} className="block">
              <span className="mb-2 block text-[13.5px] font-extrabold text-gray-700">{field.label}</span>
              {field.rows === 1 ? (
                <input value={form[field.key]} onChange={event => setField(field.key, event.target.value)} placeholder={field.placeholder} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[14px] text-gray-800 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-50" />
              ) : (
                <textarea rows={field.rows} value={form[field.key]} onChange={event => setField(field.key, event.target.value)} placeholder={field.placeholder} className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[14px] leading-relaxed text-gray-800 outline-none transition focus:border-primary-300 focus:ring-4 focus:ring-primary-50" />
              )}
            </label>
          ))}

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-[14px] font-extrabold text-white shadow-sm shadow-primary-600/20 hover:bg-primary-700 disabled:opacity-50">
              <Sparkles size={16} /> {saving ? '저장 중…' : '초안 저장하고 확인하기'} <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => navigate('/app/experience')} className="px-3 py-3 text-[13px] font-bold text-gray-400 hover:text-gray-600">나중에 이어서 하기</button>
          </div>
        </form>
      </div>
    </div>
  );
}
