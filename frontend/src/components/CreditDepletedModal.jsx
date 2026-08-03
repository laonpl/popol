import { Copy, Mail, X, WalletCards, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useModalBehavior from '../hooks/useModalBehavior';

const SUPPORT_EMAIL = 'fitpoly.kr@gmail.com';

export default function CreditDepletedModal({ open, onClose, onOpenFeedback }) {
  const navigate = useNavigate();
  const { ref: panelRef, backdropProps } = useModalBehavior(open, onClose);

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
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-bluewood-950/35 px-4 backdrop-blur-sm" {...backdropProps}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="크레딧 안내"
        tabIndex={-1}
        className="w-full max-w-md rounded-lg border border-surface-200 bg-white p-5 shadow-2xl outline-none"
      >
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
          작업하신 내용은 그대로 저장돼 있어요. 아래 방법 중 하나로 크레딧을 채우면
          이어서 계속 진행할 수 있습니다.
        </p>

        {/* 1순위: 스스로 해결 가능한 경로부터 제시.
            예전엔 "메일 보내세요"가 유일한 선택지라, 사용자가 답장을 기다리는 것 말고는
            할 수 있는 게 없었다. */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => { onClose?.(); navigate('/app/settings/credits'); }}
            className="flex w-full items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/60 px-4 py-3 text-left transition-colors hover:bg-primary-50"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
              <WalletCards size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-bluewood-800">크레딧 충전하기</span>
              <span className="block text-[12.5px] text-bluewood-500">패키지를 골라 바로 충전 요청</span>
            </span>
          </button>

          {onOpenFeedback && (
            <button
              type="button"
              onClick={() => { onClose?.(); onOpenFeedback(); }}
              className="flex w-full items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary-200"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-caribbean-50 text-caribbean-700">
                <Gift size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-bluewood-800">피드백 남기고 300C 받기</span>
                <span className="block text-[12.5px] text-bluewood-500">1분이면 끝나요 · 무료</span>
              </span>
            </button>
          )}
        </div>

        <div className="mt-4 border-t border-surface-100 pt-4">
          <p className="text-[12.5px] text-bluewood-400">
            문의가 필요하면 <span className="font-semibold text-bluewood-600">{SUPPORT_EMAIL}</span>
          </p>
          <div className="mt-2 flex gap-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('FitPoly 크레딧 문의')}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-[12.5px] font-semibold text-bluewood-600 transition-colors hover:border-primary-200 hover:text-primary-600"
            >
              <Mail size={14} /> 메일 보내기
            </a>
            <button
              type="button"
              onClick={copyEmail}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-[12.5px] font-semibold text-bluewood-600 transition-colors hover:border-primary-200 hover:text-primary-600"
            >
              <Copy size={14} /> 주소 복사
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
