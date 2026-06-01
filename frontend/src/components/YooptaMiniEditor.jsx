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
import { useMemo, useRef, useState } from 'react';
import YooptaEditor, { Blocks, createYooptaEditor, useYooptaEditor } from '@yoopta/editor';
import Paragraph from '@yoopta/paragraph';
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings';
import { BulletedList, NumberedList, TodoList } from '@yoopta/lists';
import Blockquote from '@yoopta/blockquote';
import { Code } from '@yoopta/code';
import Callout from '@yoopta/callout';
import Divider from '@yoopta/divider';
import Image from '@yoopta/image';
import Link from '@yoopta/link';
import { Bold, Italic, Underline, Strike, CodeMark, Highlight } from '@yoopta/marks';
import { BlockOptions, FloatingBlockActions, FloatingToolbar, SlashCommandMenu } from '@yoopta/ui';

const imagePlugin = Image.extend({
  options: {
    async onUpload(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          src: reader.result,
          alt: file.name,
          sizes: { width: 720, height: 420 },
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
  },
});

const PLUGINS = [
  Paragraph,
  HeadingOne,
  HeadingTwo,
  HeadingThree,
  BulletedList,
  NumberedList,
  TodoList,
  Blockquote,
  Code,
  Callout,
  Divider,
  imagePlugin,
  Link,
];

const MARKS = [Bold, Italic, Underline, Strike, CodeMark, Highlight];

function MiniBlockActions() {
  const editor = useYooptaEditor();
  const [blockOptionsOpen, setBlockOptionsOpen] = useState(false);
  const dragHandleRef = useRef(null);

  return (
    <FloatingBlockActions frozen={blockOptionsOpen}>
      {({ blockId }) => (
        <>
          <FloatingBlockActions.Button
            onClick={() => {
              if (!blockId) return;
              const block = Blocks.getBlock(editor, { id: blockId });
              if (block) editor.insertBlock('Paragraph', { at: block.meta.order + 1, focus: true });
            }}
            title="Add block"
          >
            <span className="text-lg leading-none">+</span>
          </FloatingBlockActions.Button>
          <FloatingBlockActions.Button
            ref={dragHandleRef}
            onClick={() => setBlockOptionsOpen(true)}
            title="Block options"
          >
            <span className="text-sm">::</span>
          </FloatingBlockActions.Button>
          <BlockOptions
            open={blockOptionsOpen}
            onOpenChange={setBlockOptionsOpen}
            anchor={dragHandleRef.current}
          >
            <BlockOptions.Content>
              <BlockOptions.Group>
                <BlockOptions.Item
                  onClick={() => {
                    if (blockId) Blocks.duplicateBlock(editor, { blockId });
                    setBlockOptionsOpen(false);
                  }}
                >
                  Duplicate
                </BlockOptions.Item>
                <BlockOptions.Item
                  onClick={() => {
                    if (blockId) Blocks.deleteBlock(editor, { blockId });
                    setBlockOptionsOpen(false);
                  }}
                >
                  Delete
                </BlockOptions.Item>
              </BlockOptions.Group>
            </BlockOptions.Content>
          </BlockOptions>
        </>
      )}
    </FloatingBlockActions>
  );
}

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
  if (Array.isArray(text)) {
    return textToYooptaValue(text.map(item => item?.content || '').filter(Boolean).join('\n'));
  }
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
        <MiniBlockActions />
        <SlashCommandMenu />
      </YooptaEditor>
    </div>
  );
}
