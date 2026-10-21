import { useEffect, useLayoutEffect, useRef } from 'react';

/* 자동 높이 조절 + 자동 줄바꿈 인라인 텍스트 (글자 잘림 방지) — 경험 결과 화면 공용 */
export default function AutoText({ value, onChange, placeholder, className = '', dark = false, prose = false, dense = false, autoFocus = false, onBlur }) {
  const ref = useRef(null);
  const resize = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; } };
  // 값이 바뀔 때마다 페인트 전에 높이를 글자량에 맞춘다.
  useLayoutEffect(() => { resize(ref.current); }, [value]);
  // 너비가 바뀔 때(아코디언 펼침·반응형 등) 다시 측정 — 좁은 상태에서 잘못 측정돼 박스가 커지는 문제 방지.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // 그리드 폭 확정 전에 좁은 폭으로 측정돼 부풀어 있을 수 있으므로, 레이아웃이 안정된 뒤 한 번 더 측정
    resize(el);
    const raf = requestAnimationFrame(() => resize(el));
    if (typeof document !== 'undefined' && document.fonts?.ready) document.fonts.ready.then(() => resize(el));
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf);
    let lastW = el.offsetWidth;
    const ro = new ResizeObserver(() => {
      if (el.offsetWidth !== lastW) { lastW = el.offsetWidth; resize(el); }
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  const tone = dark
    ? 'border border-white/10 bg-white/[0.06] placeholder:text-white/45 hover:bg-white/[0.1] focus:bg-white/[0.14] focus:border-white/30'
    : prose
      // 큰 본문·제목: 점선 밑줄 + hover (문서 느낌 유지)
      ? 'border border-transparent border-dashed border-b-bluewood-200 placeholder:text-bluewood-300 hover:bg-surface-50 focus:bg-surface-50/70 focus:border-b-primary-400'
      : dense
        // 촘촘한 본문 필드: 평문처럼 보이다가 hover/포커스에만 강조 (회색 박스 없음)
        ? 'border border-transparent bg-transparent placeholder:text-bluewood-300 hover:bg-surface-100/60 focus:bg-surface-50 focus:border-surface-200'
        // 짧은 입력 필드: 은은한 회색 필드
        : 'border border-transparent bg-surface-50/70 placeholder:text-bluewood-300 hover:bg-surface-100 hover:border-surface-200 focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100';
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      onBlur={onBlur}
      onChange={(e) => { onChange(e.target.value); resize(e.target); }}
      className={`w-full resize-none whitespace-pre-wrap break-words rounded-md -ml-2 px-2 ${dense ? 'py-0.5' : 'py-1'} outline-none transition-colors duration-150 cursor-text ${tone} ${className}`}
      // 글자량에 맞춰 높이를 정하므로 전역 textarea 최소 높이(index.css 100px)를 받지 않는다
      style={{ overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word', boxSizing: 'border-box', minHeight: 0 }}
    />
  );
}
