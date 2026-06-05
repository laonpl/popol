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
import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import YooptaEditor, { Blocks, Elements, Marks, Selection, createYooptaEditor, generateId, useYooptaEditor } from '@yoopta/editor';
import Paragraph from '@yoopta/paragraph';
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings';
import { BulletedList, NumberedList, TodoList } from '@yoopta/lists';
import Blockquote from '@yoopta/blockquote';
import { Code } from '@yoopta/code';
import Callout from '@yoopta/callout';
import Divider from '@yoopta/divider';
import Image, { ImageCommands } from '@yoopta/image';
import Link from '@yoopta/link';
import Table from '@yoopta/table';
import { Bold, Italic, Underline, Strike, CodeMark, Highlight } from '@yoopta/marks';
import { BlockOptions, FloatingBlockActions, FloatingToolbar, SlashCommandMenu } from '@yoopta/ui';
import { ParagraphUI } from '@yoopta/themes-shadcn/paragraph';
import { HeadingsUI } from '@yoopta/themes-shadcn/headings';
import { ListsUI } from '@yoopta/themes-shadcn/lists';
import { BlockquoteUI } from '@yoopta/themes-shadcn/blockquote';
import { CodeUI } from '@yoopta/themes-shadcn/code';
import { CalloutUI } from '@yoopta/themes-shadcn/callout';
import { DividerUI } from '@yoopta/themes-shadcn/divider';
import { LinkUI } from '@yoopta/themes-shadcn/link';
import { ImageUI } from '@yoopta/themes-shadcn/image';
import '@yoopta/themes-shadcn/variables.css';
import { Bold as BoldIcon, Code as CodeIcon, Eraser, Highlighter, ImagePlus, Italic as ItalicIcon, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { insertYooptaBlocks } from '../utils/projectSections';

export const CUSTOM_IMAGE_DRAG_TYPE = 'application/x-fitpoly-custom-image';
export const CUSTOM_PALETTE_DRAG_TYPE = 'application/x-fitpoly-palette';

const YooptaMiniEditorIdContext = createContext(null);
let activeYooptaImageDrag = null;

function deleteYooptaBlockById(editor, blockId) {
  const value = editor.getEditorValue();
  const block = value?.[blockId];
  if (typeof block?.meta?.order === 'number') {
    editor.deleteBlock({ at: block.meta.order });
    return true;
  }
  const orderedBlocks = Object.values(value || {}).sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0));
  const index = orderedBlocks.findIndex(item => item?.id === blockId);
  if (index < 0) return false;
  editor.deleteBlock({ at: index });
  return true;
}

export function createYooptaImageValue(src, alt = 'image', sizes = { width: 720, height: 420 }, idSeed = null) {
  const blockId = idSeed ? `${idSeed}-block` : generateId();
  return {
    [blockId]: {
      id: blockId,
      type: 'Image',
      value: [{
        id: idSeed ? `${idSeed}-element` : generateId(),
        type: 'image',
        children: [{ text: '' }],
        props: {
          src,
          alt,
          sizes,
          fit: 'contain',
          nodeType: 'void',
        },
      }],
      meta: { order: 0, depth: 0, align: 'center' },
    },
  };
}

export function createYooptaTableValue(rows = 3, columns = 3) {
  const blockId = generateId();
  return {
    [blockId]: {
      id: blockId,
      type: 'Table',
      value: [{
        id: generateId(),
        type: 'table',
        props: { headerRow: true, headerColumn: false, columnWidths: Array(columns).fill(200) },
        children: Array.from({ length: rows }, (_, rowIndex) => ({
          id: generateId(),
          type: 'table-row',
          children: Array.from({ length: columns }, () => ({
            id: generateId(),
            type: 'table-data-cell',
            props: { asHeader: rowIndex === 0 },
            children: [{ text: '' }],
          })),
        })),
      }],
      meta: { order: 0, depth: 0 },
    },
  };
}

export function findFirstYooptaImage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const block of Object.values(value)) {
    if (block?.type !== 'Image') continue;
    const image = Array.isArray(block.value) ? block.value.find(element => element?.type === 'image') : null;
    if (image?.props?.src) return image.props;
  }
  return null;
}

const ShadcnImageElement = ImageUI.image.render;

function CornerResizableImageElement(props) {
  const { blockId, element } = props;
  const editor = useYooptaEditor();
  const editorInstanceId = useContext(YooptaMiniEditorIdContext);
  const wrapperRef = useRef(null);
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const image = wrapper?.querySelector('img');
    if (!wrapper || !image) return undefined;
    const syncFrame = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const next = {
        left: imageRect.left - wrapperRect.left,
        top: imageRect.top - wrapperRect.top,
        width: imageRect.width,
        height: imageRect.height,
      };
      // 값이 실질적으로 같으면 setState를 생략해 ResizeObserver 무한 루프를 막는다.
      setFrame(prev => (prev
        && Math.abs(prev.left - next.left) < 0.5
        && Math.abs(prev.top - next.top) < 0.5
        && Math.abs(prev.width - next.width) < 0.5
        && Math.abs(prev.height - next.height) < 0.5)
        ? prev : next);
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
    if (!wrapper || !image) return;
    const startX = event.clientX;
    const startWidth = image.offsetWidth;
    const startHeight = image.offsetHeight;
    let nextSizes = { width: startWidth, height: startHeight };
    const onMove = moveEvent => {
      const width = Math.max(100, Math.min(wrapper.offsetWidth, startWidth + ((moveEvent.clientX - startX) * direction)));
      const height = Math.round(width * startHeight / startWidth);
      nextSizes = { width: Math.round(width), height };
      // 폭만 CSS 변수로 제어하고 높이는 auto(원본 비율)로 둔다. shadcn 내부 크기와 충돌하지 않는다.
      wrapper.style.setProperty('--fp-img-w', `${nextSizes.width}px`);
      setFrame(current => current ? { ...current, width: nextSizes.width, height: nextSizes.height } : current);
    };
    const onUp = () => {
      Elements.updateElement(editor, {
        blockId,
        type: 'image',
        props: { ...element.props, sizes: nextSizes },
      });
      // 크기 변경을 래퍼가 onChange로 발행하도록 알림 (발행 누락 시 재렌더에서 원본 크기로 되돌아가는 문제 방지)
      window.dispatchEvent(new CustomEvent('fitpoly:yoopta-editor-touched', {
        detail: { editorId: editorInstanceId },
      }));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={wrapperRef}
      className="yoopta-corner-image group/corner-image relative"
      style={element.props.sizes?.width ? { '--fp-img-w': `${element.props.sizes.width}px` } : undefined}
      draggable
      onDragStart={event => {
        if (!element?.props?.src) {
          event.preventDefault();
          return;
        }
        const payload = {
          src: element.props.src,
          alt: element.props.alt || 'image',
          sizes: element.props.sizes,
          source: 'yoopta',
          sourceEditorId: editorInstanceId,
          sourceBlockId: blockId,
          dragId: generateId(),
        };
        activeYooptaImageDrag = payload;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(CUSTOM_IMAGE_DRAG_TYPE, JSON.stringify(payload));
        event.dataTransfer.setData('text/plain', element.props.src);
      }}
      onDragEnd={() => {
        activeYooptaImageDrag = null;
      }}
    >
      <style>{`
        .yoopta-corner-image [style*="outline"] {
          outline: none !important;
          padding: 0 !important;
        }
        .yoopta-corner-image .h-10.w-1\\.5.rounded-full {
          display: none !important;
        }
        /* 저장된 폭(CSS 변수)으로 이미지 크기를 결정하고 높이는 비율 유지. shadcn 내부 크기를 덮어쓴다. */
        .yoopta-corner-image img {
          width: var(--fp-img-w, auto) !important;
          height: auto !important;
          max-width: 100% !important;
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
  Paragraph.extend({ elements: ParagraphUI }),
  HeadingOne.extend({ elements: HeadingsUI.HeadingOne }),
  HeadingTwo.extend({ elements: HeadingsUI.HeadingTwo }),
  HeadingThree.extend({ elements: HeadingsUI.HeadingThree }),
  BulletedList.extend({ elements: ListsUI.BulletedList }),
  NumberedList.extend({ elements: ListsUI.NumberedList }),
  TodoList.extend({ elements: ListsUI.TodoList }),
  Blockquote.extend({ elements: BlockquoteUI }),
  Code.extend({ elements: CodeUI }),
  Callout.extend({ elements: CalloutUI }),
  Divider.extend({ elements: DividerUI }),
  imagePlugin,
  Table,
  Link.extend({ elements: LinkUI }),
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

function MiniBlockActions({ onEditorChange }) {
  const editor = useYooptaEditor();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [blockOptionsOpen, setBlockOptionsOpen] = useState(false);
  const addButtonRef = useRef(null);
  const dragHandleRef = useRef(null);
  const applyToCurrentBlock = (blockId, type) => {
    if (!blockId) return;
    const block = Blocks.getBlock(editor, { id: blockId });
    if (block) {
      editor.toggleBlock(type, {
        at: block.meta.order,
        scope: 'block',
        preserveContent: true,
        focus: true,
      });
      queueMicrotask(() => onEditorChange?.(editor.getEditorValue(), { immediate: true }));
    }
    setAddMenuOpen(false);
  };
  const addItems = [
    ['Paragraph', 'Text'],
    ['HeadingOne', 'Heading 1'],
    ['HeadingTwo', 'Heading 2'],
    ['HeadingThree', 'Heading 3'],
    ['BulletedList', 'Bulleted list'],
    ['NumberedList', 'Numbered list'],
    ['TodoList', 'To-do list'],
    ['Blockquote', 'Quote'],
    ['Callout', 'Callout'],
    ['Code', 'Code'],
    ['Divider', 'Divider'],
    ['Image', 'Image'],
    ['Table', 'Table'],
  ];

  return (
    <FloatingBlockActions frozen={addMenuOpen || blockOptionsOpen}>
      {({ blockId }) => (
        <>
          <FloatingBlockActions.Button
            ref={addButtonRef}
            onClick={() => setAddMenuOpen(true)}
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
            open={addMenuOpen}
            onOpenChange={setAddMenuOpen}
            anchor={addButtonRef.current}
          >
            <BlockOptions.Content>
              <BlockOptions.Group>
                {addItems.map(([type, label]) => (
                  <BlockOptions.Item key={type} onClick={() => applyToCurrentBlock(blockId, type)}>
                    {label}
                  </BlockOptions.Item>
                ))}
              </BlockOptions.Group>
            </BlockOptions.Content>
          </BlockOptions>
          <BlockOptions
            open={blockOptionsOpen}
            onOpenChange={setBlockOptionsOpen}
            anchor={dragHandleRef.current}
          >
            <BlockOptions.Content>
              <BlockOptions.Group>
                <BlockOptions.Item
                  onClick={() => {
                    if (blockId) {
                      Blocks.duplicateBlock(editor, { blockId });
                      queueMicrotask(() => onEditorChange?.(editor.getEditorValue(), { immediate: true }));
                    }
                    setBlockOptionsOpen(false);
                  }}
                >
                  Duplicate
                </BlockOptions.Item>
                <BlockOptions.Item
                  onClick={() => {
                    if (blockId) {
                      Blocks.deleteBlock(editor, { blockId });
                      queueMicrotask(() => onEditorChange?.(editor.getEditorValue(), { immediate: true }));
                    }
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

function MiniFloatingToolbar({ onEditorChange }) {
  const editor = useYooptaEditor();
  const [, refresh] = useState(0);
  const items = [
    ['bold', '굵게', BoldIcon],
    ['italic', '기울임', ItalicIcon],
    ['underline', '밑줄', UnderlineIcon],
    ['strike', '취소선', Strikethrough],
    ['code', '코드', CodeIcon],
  ];
  const commit = (action) => {
    action();
    refresh(value => value + 1);
    queueMicrotask(() => onEditorChange?.(editor.getEditorValue(), { immediate: true }));
  };

  return (
    <FloatingToolbar>
      <FloatingToolbar.Content>
        <FloatingToolbar.Group>
          {items.map(([type, label, Icon]) => (
            <FloatingToolbar.Button
              key={type}
              active={Marks.isActive(editor, { type })}
              onClick={() => commit(() => Marks.toggle(editor, { type }))}
              title={label}
              aria-label={label}
            >
              <Icon size={15} />
            </FloatingToolbar.Button>
          ))}
          <FloatingToolbar.Button
            active={Marks.isActive(editor, { type: 'highlight' })}
            onClick={() => commit(() => {
              if (Marks.isActive(editor, { type: 'highlight' })) {
                Marks.remove(editor, { type: 'highlight' });
              } else {
                Marks.update(editor, { type: 'highlight', value: { backgroundColor: '#fef08a' } });
              }
            })}
            title="강조"
            aria-label="강조"
          >
            <Highlighter size={15} />
          </FloatingToolbar.Button>
          <FloatingToolbar.Separator />
          <FloatingToolbar.Button
            onClick={() => commit(() => Marks.clear(editor))}
            title="서식 초기화"
            aria-label="서식 초기화"
          >
            <Eraser size={15} />
          </FloatingToolbar.Button>
        </FloatingToolbar.Group>
      </FloatingToolbar.Content>
    </FloatingToolbar>
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
  const editorInstanceIdRef = useRef(generateId());
  const editorMinHeight = Math.min(minHeight, 36);
  const initialValue = useMemo(() => textToYooptaValue(value), []);
  const editor = useMemo(() => createYooptaEditor({
    plugins: PLUGINS,
    marks: MARKS,
    value: initialValue,
  }), []);
  const latestValueRef = useRef(initialValue);
  const pendingValueRef = useRef(null);
  const changeTimerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const publishEditorChange = useCallback((nextValue) => {
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = null;
    pendingValueRef.current = null;
    latestValueRef.current = nextValue;
    onChangeRef.current?.(nextValue);
  }, []);
  const handleEditorChange = useCallback((nextValue, options = {}) => {
    latestValueRef.current = nextValue;
    pendingValueRef.current = nextValue;
    if (options.immediate) {
      publishEditorChange(nextValue);
      return;
    }
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => publishEditorChange(pendingValueRef.current), 120);
  }, [publishEditorChange]);

  useEffect(() => () => {
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    if (pendingValueRef.current) onChangeRef.current?.(pendingValueRef.current);
  }, []);

  useEffect(() => {
    const onMoved = (event) => {
      const detail = event.detail || {};
      if (detail.editorId !== editorInstanceIdRef.current || !detail.blockId) return;
      // 드롭 이벤트/커밋 사이클 밖에서 삭제한다. 선택된 이미지의 floating 툴바(@floating-ui)가
      // 언마운트되며 ref detach 중 setState를 호출해 무한 업데이트가 나는 것을 막는다.
      setTimeout(() => {
        if (!deleteYooptaBlockById(editor, detail.blockId)) return;
        handleEditorChange(editor.getEditorValue(), { immediate: true });
      }, 0);
    };
    window.addEventListener('fitpoly:yoopta-image-moved', onMoved);
    return () => window.removeEventListener('fitpoly:yoopta-image-moved', onMoved);
  }, [editor, handleEditorChange]);

  useEffect(() => {
    const onTouched = (event) => {
      if (event.detail?.editorId !== editorInstanceIdRef.current) return;
      handleEditorChange(editor.getEditorValue(), { immediate: true });
    };
    window.addEventListener('fitpoly:yoopta-editor-touched', onTouched);
    return () => window.removeEventListener('fitpoly:yoopta-editor-touched', onTouched);
  }, [editor, handleEditorChange]);

  useEffect(() => {
    if (pendingValueRef.current) return;
    if (value === latestValueRef.current) return;
    const nextValue = textToYooptaValue(value);
    if (JSON.stringify(nextValue) === JSON.stringify(editor.getEditorValue())) {
      latestValueRef.current = value;
      return;
    }
    latestValueRef.current = nextValue;
    editor.setEditorValue(nextValue);
  }, [editor, value]);

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
    queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
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
      className={`yoopta-mini-editor yoopta-portfolio-wrapper group relative ${className}`}
      style={{ minHeight: editorMinHeight }}
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
            // 같은 에디터(섹션) 내 드롭은 복제가 되므로 무시한다. (섹션 내 위치 이동은 블록 핸들 `::` 사용)
            if (payload?.source === 'yoopta' && payload?.sourceEditorId === editorInstanceIdRef.current) {
              return;
            }
            if (payload?.src && await insertImageSources([{ src: payload.src, alt: payload.alt || 'image', sizes: payload.sizes }])) {
              if (payload.source === 'yoopta' && payload.sourceEditorId && payload.sourceEditorId !== editorInstanceIdRef.current) {
                window.dispatchEvent(new CustomEvent('fitpoly:yoopta-image-moved', {
                  detail: { editorId: payload.sourceEditorId, blockId: payload.sourceBlockId, dragId: payload.dragId },
                }));
              } else {
                onExternalImageDrop?.(payload);
              }
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
        const isModifier = event.ctrlKey || event.metaKey;
        if (isModifier && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          event.stopPropagation();
          editor.redo();
          queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
          return;
        }
        if (isModifier && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) editor.redo();
          else editor.undo();
          queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
          return;
        }
        if (event.key === 'Backspace') {
          const current = Selection.getCurrent(editor);
          const block = editor.getBlock({ at: current });
          const selection = Selection.getSlateSelection(editor);
          const listTypes = ['BulletedList', 'NumberedList', 'TodoList'];
          if (
            block
            && listTypes.includes(block.type)
            && selection
            && selection.anchor.offset === 0
            && selection.focus.offset === 0
          ) {
            event.preventDefault();
            event.stopPropagation();
            editor.toggleBlock('Paragraph', {
              at: current,
              scope: 'block',
              preserveContent: true,
              focus: true,
            });
            queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
            return;
          }
        }
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        const selected = Selection.getSelected(editor);
        const orders = Array.isArray(selected) && selected.length > 0
          ? selected
          : [Selection.getCurrent(editor)].filter(order => order != null);
        const imageOrders = orders.filter(order => editor.getBlock({ at: order })?.type === 'Image');
        if (imageOrders.length === 0) return;
        event.preventDefault();
        [...imageOrders].sort((a, b) => b - a).forEach(order => editor.deleteBlock({ at: order }));
        queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
      }}
    >
      <YooptaMiniEditorIdContext.Provider value={editorInstanceIdRef.current}>
        <YooptaEditor
          editor={editor}
          onChange={handleEditorChange}
          autoFocus={false}
          placeholder={placeholder}
          style={{ minHeight: editorMinHeight, fontSize: 14, lineHeight: 1.7 }}
        >
          <MiniFloatingToolbar onEditorChange={handleEditorChange} />
          <MiniBlockActions onEditorChange={handleEditorChange} />
          <SlashCommandMenu />
        </YooptaEditor>
      </YooptaMiniEditorIdContext.Provider>
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
        className="absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition-opacity hover:border-blue-300 hover:text-blue-600 focus:opacity-100 group-hover:opacity-100"
        title="이미지 추가"
        aria-label="이미지 추가"
      >
        <ImagePlus size={15} />
      </button>
    </div>
  );
}

/**
 * NotionDocEditor — 전체 페이지를 하나의 자유 Yoopta 캔버스로 편집하는 래퍼.
 * 프로젝트 상세 모달의 본문에서 사용한다(편집/읽기전용 공용).
 *
 * Props:
 *  - value / onChange: Yoopta JSON
 *  - readOnly: 읽기전용(미리보기·링크공유)
 *  - resolvePaletteBlocks(payload): 팔레트에서 드롭한 항목을 Yoopta 블록 배열로 변환
 */
export const NotionDocEditor = forwardRef(function NotionDocEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = '내용을 입력하거나 왼쪽에서 섹션을 끌어다 놓으세요...',
  className = '',
  resolvePaletteBlocks,
}, ref) {
  const imageInputRef = useRef(null);
  const editorInstanceIdRef = useRef(generateId());
  const initialValue = useMemo(() => textToYooptaValue(value), []);
  const editor = useMemo(() => createYooptaEditor({ plugins: PLUGINS, marks: MARKS, value: initialValue }), []);
  const latestValueRef = useRef(initialValue);
  const pendingValueRef = useRef(null);
  const changeTimerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const publishEditorChange = useCallback((nextValue) => {
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = null;
    pendingValueRef.current = null;
    latestValueRef.current = nextValue;
    onChangeRef.current?.(nextValue);
  }, []);
  const handleEditorChange = useCallback((nextValue, options = {}) => {
    latestValueRef.current = nextValue;
    pendingValueRef.current = nextValue;
    if (options.immediate) { publishEditorChange(nextValue); return; }
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => publishEditorChange(pendingValueRef.current), 150);
  }, [publishEditorChange]);

  useEffect(() => () => {
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    if (pendingValueRef.current) onChangeRef.current?.(pendingValueRef.current);
  }, []);

  useEffect(() => {
    const onMoved = (event) => {
      const detail = event.detail || {};
      if (detail.editorId !== editorInstanceIdRef.current || !detail.blockId) return;
      // 드롭 이벤트/커밋 사이클 밖에서 삭제한다. 선택된 이미지의 floating 툴바(@floating-ui)가
      // 언마운트되며 ref detach 중 setState를 호출해 무한 업데이트가 나는 것을 막는다.
      setTimeout(() => {
        if (!deleteYooptaBlockById(editor, detail.blockId)) return;
        handleEditorChange(editor.getEditorValue(), { immediate: true });
      }, 0);
    };
    window.addEventListener('fitpoly:yoopta-image-moved', onMoved);
    return () => window.removeEventListener('fitpoly:yoopta-image-moved', onMoved);
  }, [editor, handleEditorChange]);

  useEffect(() => {
    const onTouched = (event) => {
      if (event.detail?.editorId !== editorInstanceIdRef.current) return;
      handleEditorChange(editor.getEditorValue(), { immediate: true });
    };
    window.addEventListener('fitpoly:yoopta-editor-touched', onTouched);
    return () => window.removeEventListener('fitpoly:yoopta-editor-touched', onTouched);
  }, [editor, handleEditorChange]);

  // 외부 value 변경 동기화 (읽기전용 뷰에서 다른 프로젝트로 전환 시 중요)
  useEffect(() => {
    if (pendingValueRef.current) return;
    if (value === latestValueRef.current) return;
    const nextValue = textToYooptaValue(value);
    if (JSON.stringify(nextValue) === JSON.stringify(editor.getEditorValue())) {
      latestValueRef.current = value;
      return;
    }
    latestValueRef.current = nextValue;
    editor.setEditorValue(nextValue);
  }, [editor, value]);

  useImperativeHandle(ref, () => ({
    insertBlocks: (blocks) => {
      if (!Array.isArray(blocks) || blocks.length === 0) return;
      insertYooptaBlocks(editor, blocks, null);
      queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
    },
  }), [editor, handleEditorChange]);

  const insertImageSources = async (images) => {
    if (images.length === 0) return false;
    const blockCount = Object.keys(editor.getEditorValue()).length;
    let insertAt = (Selection.getCurrent(editor) ?? blockCount - 1) + 1;
    const resolvedImages = await Promise.all(images.map(async image => ({
      ...image,
      sizes: image.sizes || await getImageSizes(image.src).catch(() => ({ width: 720, height: 420 })),
    })));
    resolvedImages.forEach(({ src, alt, sizes }) => {
      ImageCommands.insertImage(editor, { at: insertAt, focus: true, props: { src, alt, sizes } });
      insertAt += 1;
    });
    queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
    return true;
  };

  const insertImageFiles = async (files) => {
    const imageFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return false;
    const images = await Promise.all(imageFiles.map(async file => ({ ...await readImageFile(file), alt: file.name })));
    return insertImageSources(images);
  };

  const handlePaletteDrop = (event) => {
    const raw = event.dataTransfer?.getData(CUSTOM_PALETTE_DRAG_TYPE);
    if (!raw || !resolvePaletteBlocks) return false;
    event.preventDefault();
    event.stopPropagation();
    try {
      const payload = JSON.parse(raw);
      const blocks = resolvePaletteBlocks(payload);
      if (Array.isArray(blocks) && blocks.length > 0) {
        const current = Selection.getCurrent(editor);
        const atOrder = typeof current === 'number' ? current + 1 : null;
        insertYooptaBlocks(editor, blocks, atOrder);
        queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
      }
    } catch { /* 잘못된 드래그 페이로드는 무시 */ }
    return true;
  };

  if (readOnly) {
    return (
      <div className={`yoopta-mini-editor yoopta-portfolio-wrapper yoopta-readonly ${className}`}>
        <YooptaMiniEditorIdContext.Provider value={editorInstanceIdRef.current}>
          <YooptaEditor
            editor={editor}
            readOnly
            autoFocus={false}
            style={{ fontSize: 16, lineHeight: 1.8 }}
          />
        </YooptaMiniEditorIdContext.Provider>
      </div>
    );
  }

  return (
    <div
      className={`yoopta-mini-editor yoopta-portfolio-wrapper group relative ${className}`}
      onPaste={event => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.some(file => file.type.startsWith('image/'))) return;
        event.preventDefault();
        insertImageFiles(files);
      }}
      onDragOverCapture={event => {
        const types = Array.from(event.dataTransfer?.types || []);
        const hasPalette = types.includes(CUSTOM_PALETTE_DRAG_TYPE);
        const hasExternalImage = types.includes(CUSTOM_IMAGE_DRAG_TYPE);
        const hasImageFile = Array.from(event.dataTransfer?.items || []).some(item => item.type.startsWith('image/'));
        if (hasPalette || hasExternalImage || hasImageFile) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = hasPalette ? 'copy' : 'move';
        }
      }}
      onDropCapture={async event => {
        if (handlePaletteDrop(event)) return;
        const externalImage = event.dataTransfer?.getData(CUSTOM_IMAGE_DRAG_TYPE);
        if (externalImage) {
          event.preventDefault();
          event.stopPropagation();
          try {
            const payload = JSON.parse(externalImage);
            // 같은 에디터(섹션) 내 드롭은 복제가 되므로 무시한다. (섹션 내 위치 이동은 블록 핸들 `::` 사용)
            if (payload?.source === 'yoopta' && payload?.sourceEditorId === editorInstanceIdRef.current) {
              return;
            }
            if (payload?.src && await insertImageSources([{ src: payload.src, alt: payload.alt || 'image', sizes: payload.sizes }])) {
              if (payload.source === 'yoopta' && payload.sourceEditorId && payload.sourceEditorId !== editorInstanceIdRef.current) {
                window.dispatchEvent(new CustomEvent('fitpoly:yoopta-image-moved', {
                  detail: { editorId: payload.sourceEditorId, blockId: payload.sourceBlockId, dragId: payload.dragId },
                }));
              }
            }
          } catch { /* 잘못된 드래그 페이로드는 원본 유지 */ }
          return;
        }
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.some(file => file.type.startsWith('image/'))) return;
        event.preventDefault();
        event.stopPropagation();
        insertImageFiles(files);
      }}
      onKeyDownCapture={event => {
        const isModifier = event.ctrlKey || event.metaKey;
        if (isModifier && event.key.toLowerCase() === 'y') {
          event.preventDefault();
          event.stopPropagation();
          editor.redo();
          queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
          return;
        }
        if (isModifier && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) editor.redo(); else editor.undo();
          queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
          return;
        }
        if (event.key === 'Backspace') {
          const current = Selection.getCurrent(editor);
          const block = editor.getBlock({ at: current });
          const selection = Selection.getSlateSelection(editor);
          const listTypes = ['BulletedList', 'NumberedList', 'TodoList'];
          if (block && listTypes.includes(block.type) && selection && selection.anchor.offset === 0 && selection.focus.offset === 0) {
            event.preventDefault();
            event.stopPropagation();
            editor.toggleBlock('Paragraph', { at: current, scope: 'block', preserveContent: true, focus: true });
            queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
            return;
          }
        }
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        const selected = Selection.getSelected(editor);
        const orders = Array.isArray(selected) && selected.length > 0
          ? selected
          : [Selection.getCurrent(editor)].filter(order => order != null);
        const imageOrders = orders.filter(order => editor.getBlock({ at: order })?.type === 'Image');
        if (imageOrders.length === 0) return;
        event.preventDefault();
        [...imageOrders].sort((a, b) => b - a).forEach(order => editor.deleteBlock({ at: order }));
        queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
      }}
    >
      <YooptaMiniEditorIdContext.Provider value={editorInstanceIdRef.current}>
        <YooptaEditor
          editor={editor}
          onChange={handleEditorChange}
          autoFocus={false}
          placeholder={placeholder}
          style={{ minHeight: 360, fontSize: 16, lineHeight: 1.8 }}
        >
          <MiniFloatingToolbar onEditorChange={handleEditorChange} />
          <MiniBlockActions onEditorChange={handleEditorChange} />
          <SlashCommandMenu />
        </YooptaEditor>
      </YooptaMiniEditorIdContext.Provider>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={event => { insertImageFiles(event.target.files); event.target.value = ''; }}
      />
    </div>
  );
});
