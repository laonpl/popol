import { Copy, Mail, X } from 'lucide-react';
import toast from 'react-hot-toast';

const SUPPORT_EMAIL = 'fitpoly.kr@gmail.com';

export default function CreditDepletedModal({ open, onClose }) {
  if (!open) return null;

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      toast.success('메일 주소를 복사했어요.');
    } catch {
      toast.error('복사에 실패했어요. 메일 주소를 직접 선택해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-bluewood-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-surface-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-500">Credit Notice</p>
            <h2 className="mt-2 text-xl font-extrabold text-bluewood-900">크레딧을 모두 사용했어요</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-bluewood-300 transition-colors hover:bg-surface-100 hover:text-bluewood-700"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-bluewood-500">
          계속 경험 정리와 포트폴리오 생성을 이어가고 싶다면 FitPoly 팀에 메일을 보내주세요.
          확인 후 크레딧 충전 또는 이용 방법을 안내드릴게요.
        </p>

        <div className="mt-4 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2.5 text-sm font-semibold text-primary-700">
          {SUPPORT_EMAIL}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('FitPoly 크레딧 문의')}`}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-700"
          >
            <Mail size={16} />
            메일 보내기
          </a>
          <button
            type="button"
            onClick={copyEmail}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm font-bold text-bluewood-600 transition-colors hover:border-primary-200 hover:text-primary-600"
          >
            <Copy size={16} />
            주소 복사
          </button>
        </div>
      </div>
    </div>
  );
}
