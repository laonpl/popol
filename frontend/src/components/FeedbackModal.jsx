import { useEffect, useState } from 'react';
import { Loader2, Star, X, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const RATING_LABELS = {
  1: '많이 아쉬워요',
  2: '조금 아쉬워요',
  3: '괜찮았어요',
  4: '좋았어요',
  5: '정말 좋았어요',
};

// 피드백 창 전역 스누즈 — "하루 동안 안 보기" 선택 시 24시간 동안 안 띄운다.
const FEEDBACK_SNOOZE_KEY = 'fitpoly-feedback-snooze-until';
const FEEDBACK_SNOOZE_MS = 24 * 60 * 60 * 1000;

export function isFeedbackSnoozed() {
  try {
    return Date.now() < Number(window.localStorage.getItem(FEEDBACK_SNOOZE_KEY) || 0);
  } catch {
    return false;
  }
}

function snoozeFeedbackForADay() {
  try {
    window.localStorage.setItem(FEEDBACK_SNOOZE_KEY, String(Date.now() + FEEDBACK_SNOOZE_MS));
  } catch {
    /* localStorage 사용 불가 시 무시 */
  }
}

export default function FeedbackModal({
  open,
  onClose,
  context = 'experience_complete',
  experienceId = '',
  title = '',
}) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(0);
    setFeedback('');
  }, [open]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) {
      toast.error('별점을 선택해주세요.');
      return;
    }
    if (!feedback.trim()) {
      toast.error('짧게라도 피드백을 남겨주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/feedback', {
        rating,
        feedback: feedback.trim(),
        context,
        experienceId,
        sourcePath: window.location.pathname,
      });
      const reward = response.data?.reward;
      if (reward?.granted) {
        toast.success(`피드백 감사합니다! ${reward.amount} 크레딧이 지급됐어요.`);
      } else {
        toast.success('피드백을 보내주셔서 감사합니다.');
      }
      onClose?.({ submitted: true });
    } catch (error) {
      toast.error(error.response?.data?.error || '피드백 전송에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-bluewood-950/35 px-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg border border-surface-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">Feedback</p>
            <h2 className="mt-2 text-xl font-extrabold text-bluewood-900">방금 만든 경험은 어땠나요?</h2>
            {title && <p className="mt-1 text-sm font-medium text-bluewood-400 line-clamp-1">{title}</p>}
          </div>
          <button
            type="button"
            onClick={() => onClose?.({ submitted: false })}
            className="rounded-md p-1.5 text-bluewood-300 transition-colors hover:bg-surface-100 hover:text-bluewood-700"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-primary-100 bg-primary-50/70 px-3.5 py-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
            <Gift size={17} />
          </span>
          <p className="text-[13px] font-semibold text-bluewood-700">
            피드백을 남겨주시면 <span className="font-extrabold text-primary-600">300 크레딧</span>을 드려요! <span className="font-normal text-bluewood-400">(최초 1회)</span>
          </p>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-bold text-bluewood-700">별점</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(value => {
              const active = value <= rating;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`rounded-md p-1.5 transition-colors ${active ? 'text-amber-400' : 'text-bluewood-200 hover:text-amber-300'}`}
                  aria-label={`${value}점`}
                >
                  <Star size={26} fill={active ? 'currentColor' : 'none'} />
                </button>
              );
            })}
            <span className="ml-2 text-sm font-semibold text-bluewood-400">
              {rating ? RATING_LABELS[rating] : '선택해주세요'}
            </span>
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-bold text-bluewood-700">피드백</span>
          <textarea
            value={feedback}
            onChange={event => setFeedback(event.target.value)}
            rows={5}
            maxLength={1200}
            placeholder="좋았던 점, 아쉬웠던 점, 다음에 더 좋아졌으면 하는 점을 적어주세요."
            className="mt-2 w-full resize-none rounded-lg border border-surface-200 px-3 py-3 text-sm leading-6 text-bluewood-700 outline-none transition-shadow placeholder:text-bluewood-300 focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
          />
        </label>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => { snoozeFeedbackForADay(); onClose?.({ submitted: false, snoozed: true }); }}
            className="text-sm font-medium text-bluewood-300 transition-colors hover:text-bluewood-500"
          >
            하루 동안 안 보기
          </button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onClose?.({ submitted: false })}
              className="rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-bold text-bluewood-500 transition-colors hover:bg-surface-50"
            >
              나중에 하기
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              피드백 보내기
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
