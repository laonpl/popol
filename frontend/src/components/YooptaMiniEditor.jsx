/**
 * YooptaMiniEditor — 자동 리사이징 텍스트 에디터
 *
 * Props:
 *  - value: Yoopta JSON (object) 또는 plain text (string)
 *  - onChange(text): 텍스트 문자열 전달
 *  - placeholder: string
 *  - minHeight: number (px, 기본 120)
 *  - className: wrapper 추가 클래스
 */
import { useRef, useEffect } from 'react';

/** Yoopta 블록 객체 → 평문 텍스트 변환 */
function blocksToText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || Array.isArray(value)) return '';
  try {
    return Object.values(value)
      .sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0))
      .map(block => {
        if (!block?.value || !Array.isArray(block.value)) return '';
        return block.value
          .map(el => (el?.children ?? []).map(c => c?.text ?? '').join(''))
          .join('');
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

export default function YooptaMiniEditor({
  value,
  onChange,
  placeholder = '내용을 입력하세요...',
  minHeight = 120,
  className = '',
}) {
  const textareaRef = useRef(null);
  const textValue = blocksToText(value);

  // 내용에 따라 높이 자동 조절
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(minHeight, el.scrollHeight) + 'px';
  }, [textValue, minHeight]);

  function handleChange(e) {
    onChange?.(e.target.value);
  }

  return (
    <textarea
      ref={textareaRef}
      value={textValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={`w-full resize-none bg-transparent outline-none text-sm leading-relaxed text-gray-700 placeholder:text-gray-300 hover:bg-primary-50/10 rounded px-1 py-1 ${className}`}
      style={{ minHeight, fontSize: 14, lineHeight: 1.7 }}
    />
  );
}
