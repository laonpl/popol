import { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import { readActivationTask } from '../services/activationJourney';
import { trackActivation } from '../services/activationMetrics';

export default function JourneyResumeBanner() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [task, setTask] = useState(() => readActivationTask(user?.uid));
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setTask(readActivationTask(user?.uid));
    setDismissed(false);
  }, [user?.uid, location.pathname]);

  useEffect(() => {
    const handler = event => setTask(event.detail || readActivationTask(user?.uid));
    window.addEventListener('fitpoly-activation-task', handler);
    return () => window.removeEventListener('fitpoly-activation-task', handler);
  }, [user?.uid]);

  if (!task || dismissed || location.pathname === task.to || /^\/app\/(?:experience\/(?:complete|quick)|portfolio\/plan)/.test(location.pathname)) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary-100 bg-primary-50/80 px-4 py-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-primary-500">이어서 할 작업</p>
        <p className="mt-0.5 truncate text-[13.5px] font-bold text-primary-900">{task.label || '포트폴리오 준비를 이어서 완료하세요.'}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          trackActivation('resume_task_opened', { taskType: task.type, destination: task.to });
          navigate(task.to);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-primary-700"
      >
        이어서 하기 <ArrowRight size={14} />
      </button>
      <button type="button" onClick={() => setDismissed(true)} aria-label="이어하기 배너 닫기" className="rounded-lg p-1.5 text-primary-300 hover:bg-white hover:text-primary-500"><X size={15} /></button>
    </div>
  );
}

