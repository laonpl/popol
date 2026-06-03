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
import { useEffect, useMemo, useRef, useState } from 'react';
import YooptaEditor, { Blocks, Elements, Selection, createYooptaEditor, useYooptaEditor } from '@yoopta/editor';
import Paragraph from '@yoopta/paragraph';
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings';
import { BulletedList, NumberedList, TodoList } from '@yoopta/lists';
import Blockquote from '@yoopta/blockquote';
import { Code } from '@yoopta/code';
import Callout from '@yoopta/callout';
import Divider from '@yoopta/divider';
import Image, { ImageCommands } from '@yoopta/image';
import Link from '@yoopta/link';
import { Bold, Italic, Underline, Strike, CodeMark, Highlight } from '@yoopta/marks';
import { BlockOptions, FloatingBlockActions, FloatingToolbar, SlashCommandMenu } from '@yoopta/ui';
import { ImageUI } from '@yoopta/themes-shadcn/image';
import { ImagePlus } from 'lucide-react';

export const CUSTOM_IMAGE_DRAG_TYPE = 'application/x-fitpoly-custom-image';

const ShadcnImageElement = ImageUI.image.render;

function CornerResizableImageElement(props) {
  const { blockId, element } = props;
  const editor = useYooptaEditor();
  const wrapperRef = useRef(null);
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const image = wrapper?.querySelector('img');
    if (!wrapper || !image) return undefined;
    const syncFrame = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      setFrame({
        left: imageRect.left - wrapperRect.left,
        top: imageRect.top - wrapperRect.top,
        width: imageRect.width,
        height: imageRect.height,
      });
    };
    const normalizeAspectRatio = () => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const width = Number(element.props.sizes?.width) || image.naturalWidth;
      const height = Math.round(width * image.naturalHeight / image.naturalWidth);
      if (Math.abs(height - Number(element.props.sizes?.height || 0)) < 2) return;
      Elements.updateElement(editor, {
        blockId,
        type: 'image',
        props: { ...element.props, sizes: { width, height } },
      });
    };
    syncFrame();
    if (image.complete) normalizeAspectRatio();
    else image.addEventListener('load', normalizeAspectRatio);
    const observer = new ResizeObserver(syncFrame);
    observer.observe(image);
    window.addEventListener('resize', syncFrame);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncFrame);
      image.removeEventListener('load', normalizeAspectRatio);
    };
  }, [blockId, editor, element.props]);

  const startResize = (event, direction) => {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = wrapperRef.current;
    const image = wrapper?.querySelector('img');
    const resizeTarget = image?.parentElement;
    if (!wrapper || !image || !resizeTarget) return;
    const startX = event.clientX;
    const startWidth = image.offsetWidth;
    const startHeight = image.offsetHeight;
    let nextSizes = { width: startWidth, height: startHeight };
    const onMove = moveEvent => {
      const width = Math.max(100, Math.min(wrapper.offsetWidth, startWidth + ((moveEvent.clientX - startX) * direction)));
      const height = Math.round(width * startHeight / startWidth);
      nextSizes = { width: Math.round(width), height };
      resizeTarget.style.width = `${nextSizes.width}px`;
      resizeTarget.style.height = `${nextSizes.height}px`;
      setFrame(current => current ? { ...current, width: nextSizes.width, height: nextSizes.height } : current);
    };
    const onUp = () => {
      Elements.updateElement(editor, {
        blockId,
        type: 'image',
        props: { ...element.props, sizes: nextSizes },
      });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={wrapperRef} className="yoopta-corner-image group/corner-image relative">
      <style>{`
        .yoopta-corner-image [style*="outline"] {
          outline: none !important;
          padding: 0 !important;
        }
        .yoopta-corner-image .h-10.w-1\\.5.rounded-full {
          display: none !important;
        }
      `}</style>
      <ShadcnImageElement {...props} />
      {frame && (
        <div className="pointer-events-none absolute z-10" style={frame}>
          {[
            ['left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize', -1],
            ['right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize', 1],
            ['bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize', -1],
            ['bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize', 1],
          ].map(([position, direction]) => (
            <button
              key={position}
              type="button"
              onMouseDown={event => startResize(event, direction)}
              className={`pointer-events-auto absolute h-3 w-3 border border-slate-500 bg-white opacity-0 shadow-sm transition-opacity group-hover/corner-image:opacity-100 ${position}`}
              title="드래그하여 이미지 크기 조절"
            />
          ))}
        </div>
      )}
    </div>
  );
}

const imagePlugin = Image.extend({
  elements: {
    ...ImageUI,
    image: { ...ImageUI.image, render: CornerResizableImageElement },
  },
  options: {
    async upload(file) {
      const image = await readImageFile(file);
      return { ...image, alt: file.name };
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

function getImageSizes(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = src;
  });
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result || '');
      try {
        resolve({ src, sizes: await getImageSizes(src) });
      } catch {
        resolve({ src, sizes: { width: 720, height: 420 } });
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  onExternalImageDrop,
}) {
  const imageInputRef = useRef(null);
  const initialValue = useMemo(() => textToYooptaValue(value), []);
  const editor = useMemo(() => createYooptaEditor({
    plugins: PLUGINS,
    marks: MARKS,
    value: initialValue,
  }), []);

  const insertImageSources = async (images) => {
    if (images.length === 0) return false;
    const blockCount = Object.keys(editor.getEditorValue()).length;
    let insertAt = (Selection.getCurrent(editor) ?? blockCount - 1) + 1;
    const resolvedImages = await Promise.all(images.map(async image => ({
      ...image,
      sizes: image.sizes || await getImageSizes(image.src).catch(() => ({ width: 720, height: 420 })),
    })));
    resolvedImages.forEach(({ src, alt, sizes }) => {
      ImageCommands.insertImage(editor, {
        at: insertAt,
        focus: true,
        props: {
          src,
          alt,
          sizes,
        },
      });
      insertAt += 1;
    });
    return true;
  };

  const insertImageFiles = async (files) => {
    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return false;
    const images = await Promise.all(imageFiles.map(async file => ({
      ...await readImageFile(file),
      alt: file.name,
    })));
    return insertImageSources(images);
  };

  return (
    <div
      className={`yoopta-mini-editor relative ${className}`}
      style={{ minHeight }}
      onPaste={event => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.some(file => file.type.startsWith('image/'))) return;
        event.preventDefault();
        insertImageFiles(files);
      }}
      onDragOverCapture={event => {
        const hasExternalImage = Array.from(event.dataTransfer?.types || []).includes(CUSTOM_IMAGE_DRAG_TYPE);
        const hasImageFile = Array.from(event.dataTransfer?.items || []).some(item => item.type.startsWith('image/'));
        if (hasExternalImage || hasImageFile) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDropCapture={async event => {
        // Slate(에디터 내부)가 contentEditable에 자체 onDrop을 달아 드롭 데이터를
        // 먼저 가로채므로, 캡처 단계에서 이미지 드롭을 먼저 처리하고 전파를 막는다.
        const externalImage = event.dataTransfer?.getData(CUSTOM_IMAGE_DRAG_TYPE);
        if (externalImage) {
          event.preventDefault();
          event.stopPropagation();
          try {
            const payload = JSON.parse(externalImage);
            if (payload?.src && await insertImageSources([{ src: payload.src, alt: payload.alt || 'image' }])) {
              onExternalImageDrop?.(payload);
            }
          } catch {
            // Keep the source block when a drag payload is invalid.
          }
          return;
        }
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.some(file => file.type.startsWith('image/'))) return;
        event.preventDefault();
        event.stopPropagation();
        insertImageFiles(files);
      }}
      onKeyDownCapture={event => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        const selected = Selection.getSelected(editor);
        const orders = Array.isArray(selected) && selected.length > 0
          ? selected
          : [Selection.getCurrent(editor)].filter(order => order != null);
        const imageOrders = orders.filter(order => editor.getBlock({ at: order })?.type === 'Image');
        if (imageOrders.length === 0) return;
        event.preventDefault();
        [...imageOrders].sort((a, b) => b - a).forEach(order => editor.deleteBlock({ at: order }));
      }}
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
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={event => {
          insertImageFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => imageInputRef.current?.click()}
        className="absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-blue-300 hover:text-blue-600"
        title="이미지 추가"
        aria-label="이미지 추가"
      >
        <ImagePlus size={15} />
      </button>
    </div>
  );
}
