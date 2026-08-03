import { AlertTriangle, Trash2, X } from 'lucide-react';
import useModalBehavior from '../hooks/useModalBehavior';

/**
 * 브랜드 확인 다이얼로그 — 브라우저 기본 confirm() 대체.
 *
 * 기본 confirm()은 OS 스타일이라 서비스와 이질적이고, 무엇을 지우는지
 * 강조할 수 없으며, 취소가 기본값인지도 알기 어렵다.
 *
 * @param {boolean}  open
 * @param {string}   title      무엇을 하려는지
 * @param {string}   message    결과 설명 (되돌릴 수 있는지)
 * @param {string}   confirmLabel
 * @param {string}   cancelLabel
 * @param {'danger'|'default'} tone
 * @param {Function} onConfirm
 * @param {Function} onCancel
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'default',
  onConfirm,
  onCancel,
}) {
  const { ref: panelRef, backdropProps } = useModalBehavior(open, onCancel);
  if (!open) return null;

  const danger = tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-bluewood-950/40 px-4 backdrop-blur-sm"
      {...backdropProps}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-[420px] rounded-2xl border border-surface-200 bg-white p-5 shadow-2xl outline-none"
      >
        <div className="flex items-start gap-3.5">
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
              danger ? 'bg-red-50 text-red-500' : 'bg-primary-50 text-primary-600'
            }`}
          >
            {danger ? <Trash2 size={18} /> : <AlertTriangle size={18} />}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-extrabold leading-snug text-bluewood-900">{title}</h2>
            {message && (
              <p className="mt-1.5 text-[13.5px] leading-6 text-bluewood-500">{message}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="닫기"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-bluewood-300 transition-colors hover:bg-surface-50 hover:text-bluewood-700"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          {/* 취소를 먼저 두고 기본 포커스를 준다 — 실수로 Enter를 눌러 삭제되지 않게 */}
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="flex-1 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-[14px] font-bold text-bluewood-600 transition-colors hover:bg-surface-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
