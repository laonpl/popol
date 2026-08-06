import { useEffect, useRef } from 'react';

/**
 * 모달/오버레이 공통 동작을 한 번에 붙인다.
 *
 * 1) ESC 키로 닫기        — 가장 위에 열린 모달 하나만 반응 (중첩 모달 안전)
 * 2) 배경 스크롤 잠금      — 모달 뒤 페이지가 같이 스크롤되던 문제 방지
 * 3) 열릴 때 포커스 이동   — 키보드/스크린리더 사용자가 모달 안에서 시작
 * 4) 닫힐 때 포커스 복귀   — 모달을 연 버튼으로 되돌아감
 * 5) Tab 포커스 가둠       — 모달 밖 요소로 탭이 새어나가지 않게
 *
 * @param {boolean}  open      모달 표시 여부
 * @param {Function} onClose   닫기 콜백 (ESC / 배경 클릭에서 호출)
 * @param {object}   options
 * @param {boolean}  options.closeOnEsc     기본 true
 * @param {boolean}  options.lockScroll     기본 true
 * @param {boolean}  options.trapFocus      기본 true
 * @returns {{ ref: React.RefObject, backdropProps: object }}
 *   ref           — 모달 컨테이너(패널)에 연결
 *   backdropProps — 배경 div에 스프레드하면 "배경 클릭 시 닫기"가 붙는다
 */

// 현재 열려 있는 모달 스택 — ESC는 최상단 모달에만 전달된다.
const modalStack = [];

export default function useModalBehavior(open, onClose, options = {}) {
  const {
    closeOnEsc = true,
    lockScroll = true,
    trapFocus = true,
  } = options;

  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocused = useRef(null);

  // onClose가 매 렌더 새 함수여도 effect가 재실행되지 않도록 ref로 최신값만 유지
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // ── 모달 스택 등록 (ESC 대상 판별용) ──
  // 이 모달 인스턴스의 고유 토큰. 스택 맨 위일 때만 ESC에 반응한다.
  const tokenRef = useRef(null);
  if (tokenRef.current === null) tokenRef.current = Symbol('fp-modal');

  useEffect(() => {
    if (!open) return undefined;
    const token = tokenRef.current;
    modalStack.push(token);
    return () => {
      const i = modalStack.indexOf(token);
      if (i !== -1) modalStack.splice(i, 1);
    };
  }, [open]);

  // ── 배경 스크롤 잠금 ──
  useEffect(() => {
    if (!open || !lockScroll) return undefined;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    // 스크롤바가 사라지며 생기는 가로 흔들림 보정
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open, lockScroll]);

  // ── ESC 닫기 + Tab 포커스 가둠 ──
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEsc) {
        // 중첩된 경우 맨 위 모달만 닫는다
        if (modalStack[modalStack.length - 1] !== tokenRef.current) return;
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (e.key === 'Tab' && trapFocus && ref.current) {
        const focusables = ref.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEsc, trapFocus]);

  // ── 포커스 이동 / 복귀 ──
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;

    // 렌더 직후 모달 안 첫 요소로 포커스
    const t = window.setTimeout(() => {
      if (!ref.current) return;
      const target = ref.current.querySelector(
        '[data-autofocus], a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
      );
      (target || ref.current).focus?.();
    }, 0);

    return () => {
      window.clearTimeout(t);
      const prev = previouslyFocused.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [open]);

  // 배경 클릭으로 닫기 — 배경 자신을 눌렀을 때만 (드래그로 새어나온 클릭 무시)
  const backdropProps = {
    onMouseDown: (e) => {
      if (e.target === e.currentTarget) e.currentTarget.dataset.fpBackdropDown = '1';
    },
    onClick: (e) => {
      if (e.target !== e.currentTarget) return;
      if (e.currentTarget.dataset.fpBackdropDown !== '1') return;
      delete e.currentTarget.dataset.fpBackdropDown;
      onCloseRef.current?.();
    },
  };

  return { ref, backdropProps };
}
