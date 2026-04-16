/**
 * YooptaMiniEditor — Preview 디자인 레이아웃 안에서 텍스트 영역을
 * Yoopta 블록 에디터로 대체하는 경량 래퍼 컴포넌트.
 *
 * Props:
 *  - value: Yoopta JSON (object) 또는 plain text (string)
 *  - onChange(yooptaValue): Yoopta JSON 저장
 *  - placeholder: string
 *  - minHeight: number (px, 기본 120)
 *  - className: wrapper 추가 클래스
 */
import { useMemo } from 'react';
import YooptaEditor, { createYooptaEditor } from '@yoopta/editor';
import Paragraph from '@yoopta/paragraph';
import { HeadingTwo, HeadingThree } from '@yoopta/headings';
import { BulletedList, NumberedList } from '@yoopta/lists';
import Blockquote from '@yoopta/blockquote';
import Link from '@yoopta/link';
import { Bold, Italic, Underline, Strike, Highlight } from '@yoopta/marks';
import { FloatingToolbar } from '@yoopta/ui';

const PLUGINS = [
  Paragraph,
  HeadingTwo,
  HeadingThree,
  BulletedList,
  NumberedList,
  Blockquote,
  Link,
];

const MARKS = [Bold, Italic, Underline, Strike, Highlight];

/** 일반 문자열 → Yoopta 초기값 변환 */
function textToYooptaValue(text) {
  // 빈 값이면 빈 단락 블록 하나 반환
  const makeEmpty = () => {
    const id = `block-init`;
    return {
      [id]: {
        id,
        type: 'Paragraph',
        value: [{ id: `el-init`, type: 'paragraph', children: [{ text: '' }] }],
        meta: { order: 0, depth: 0 },
      },
    };
  };
  if (!text) return makeEmpty();
  if (typeof text === 'object') return text;   // 이미 Yoopta JSON
  // 줄 단위로 Paragraph 블록 생성
  const blocks = {};
  const lines = String(text).split('\n').filter(Boolean);
  if (lines.length === 0) return makeEmpty();
  lines.forEach((line, i) => {
    const id = `block-${i}`;
    blocks[id] = {
      id,
      type: 'Paragraph',
      value: [{ id: `el-${i}`, type: 'paragraph', children: [{ text: line }] }],
      meta: { order: i, depth: 0 },
    };
  });
  return blocks;
}

export default function YooptaMiniEditor({
  value,
  onChange,
  placeholder = '내용을 입력하세요...',
  minHeight = 120,
  className = '',
}) {
  const initialValue = useMemo(() => textToYooptaValue(value), []);
  const editor = useMemo(() => createYooptaEditor({
    plugins: PLUGINS,
    marks: MARKS,
    value: initialValue,
  }), []);
  const isInternalChange = useMemo(() => ({ current: false }), []);

  return (
    <div
      className={`yoopta-mini-editor relative ${className}`}
      style={{ minHeight }}
    >
      <YooptaEditor
        editor={editor}
        onChange={(val) => onChange?.(val)}
        autoFocus={false}
        placeholder={placeholder}
        style={{ minHeight, fontSize: 14, lineHeight: 1.7 }}
      >
        <FloatingToolbar />
      </YooptaEditor>
    </div>
  );
}
