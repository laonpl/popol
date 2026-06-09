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
import { Bold as BoldIcon, Check, Code as CodeIcon, Eraser, Highlighter, ImagePlus, Italic as ItalicIcon, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { insertYooptaBlocks, blocksToYooptaValue } from '../utils/projectSections';

export const CUSTOM_IMAGE_DRAG_TYPE = 'application/x-fitpoly-custom-image';
export const CUSTOM_PALETTE_DRAG_TYPE = 'application/x-fitpoly-palette';
export const CUSTOM_BLOCK_DRAG_TYPE = 'application/x-fitpoly-block';

const YooptaMiniEditorIdContext = createContext(null);
let activeYooptaImageDrag = null;
// 블록 드래그(핸들로 위/아래 이동) 진행 상태 — 같은 에디터 안에서만 재정렬
let activeBlockDrag = null; // { blockId, editorId }
const BLOCK_DRAG_SCROLL_BAND = 64; // 위/아래 자동 스크롤 존 높이(px)

/** 가장 가까운 스크롤 가능한 조상 요소 (드래그 중 자동 스크롤 대상) */
function findScrollParent(node) {
  let el = node?.parentElement;
  while (el) {
    const style = window.getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function openYooptaContextMenu(event, items) {
  if (!items?.length) return;
  event.preventDefault();
  event.stopPropagation();
  window.dispatchEvent(new CustomEvent('fitpoly:open-context-menu', {
    detail: { x: event.clientX, y: event.clientY, items },
  }));
}

function cloneSlateSelection(selection) {
  if (!selection) return null;
  return {
    anchor: { path: [...selection.anchor.path], offset: selection.anchor.offset },
    focus: { path: [...selection.focus.path], offset: selection.focus.offset },
  };
}

function createContextSelectionSnapshot(editor, root) {
  const domSelection = window.getSelection?.();
  const domRange = domSelection && domSelection.rangeCount > 0 ? domSelection.getRangeAt(0) : null;
  const rootContainsRange = !!domRange && root?.contains(domRange.commonAncestorContainer);
  const selectedPaths = Selection.getSelected(editor);
  const current = Selection.getCurrent(editor);
  return {
    current,
    selectedPaths: Array.isArray(selectedPaths) ? [...selectedPaths] : null,
    slateSelection: cloneSlateSelection(Selection.getSlateSelection(editor)),
    domRange: rootContainsRange ? domRange.cloneRange() : null,
    selectedText: domSelection?.toString?.().trim() || '',
  };
}

function hasContextSelection(snapshot) {
  return !!(
    snapshot?.selectedText
    || snapshot?.domRange
    || snapshot?.slateSelection
    || (Array.isArray(snapshot?.selectedPaths) && snapshot.selectedPaths.length > 0)
  );
}

function hasContextBlockSelection(snapshot) {
  return Array.isArray(snapshot?.selectedPaths) && snapshot.selectedPaths.length > 0;
}

function restoreContextSelection(editor, snapshot) {
  if (!snapshot) return;
  if (hasContextBlockSelection(snapshot)) {
    Selection.setSelected(editor, { at: snapshot.selectedPaths, source: 'context-menu' });
    return;
  } else if (typeof snapshot.current === 'number') {
    Selection.setCurrent(editor, { at: snapshot.current, source: 'context-menu' });
  }
  if (snapshot.slateSelection) {
    Selection.setSlateSelection(editor, {
      selection: snapshot.slateSelection,
      at: typeof snapshot.current === 'number' ? snapshot.current : undefined,
    });
  }
  if (snapshot.domRange) {
    const domSelection = window.getSelection?.();
    domSelection?.removeAllRanges?.();
    domSelection?.addRange?.(snapshot.domRange);
  }
}

// 가로로 넓은 표를 셀에서 드래그하면 슬라이드처럼 가로 스크롤(패닝)한다.
// 단순 클릭(이동 4px 미만)은 그대로 통과해 셀 편집/커서 이동이 가능하고,
// 가로로 끌면 텍스트 선택 대신 표가 좌우로 이동한다.
function useTableDragScroll(wrapperRef) {
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return undefined;
    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      const block = event.target.closest?.('[data-yoopta-block-type="Table"]');
      if (!block) return;
      // 우리 CSS가 이 블록에 overflow-x:auto를 주므로 이 블록이 가로 스크롤 컨테이너.
      // 혹시 다른 요소가 스크롤된다면 target→블록 경로에서 overflow-x auto/scroll인 것을 찾는다.
      let scroller = block;
      let node = event.target;
      while (node && node !== block) {
        if (node.scrollWidth - node.clientWidth > 1) {
          const overflowX = window.getComputedStyle(node).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll') { scroller = node; break; }
        }
        node = node.parentElement;
      }
      if (scroller.scrollWidth - scroller.clientWidth <= 1) return; // 넘칠 내용이 없으면 패닝 불필요
      const startX = event.clientX;
      const startScroll = scroller.scrollLeft;
      let panning = false;
      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        if (!panning && Math.abs(dx) < 4) return;
        panning = true;
        moveEvent.preventDefault();
        window.getSelection?.()?.removeAllRanges?.(); // 드래그 중 텍스트 선택 방지
        scroller.scrollLeft = startScroll - dx;
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove, true);
        window.removeEventListener('mouseup', onUp, true);
        if (panning) window.getSelection?.()?.removeAllRanges?.();
      };
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
    };
    root.addEventListener('mousedown', onMouseDown, true);
    return () => root.removeEventListener('mousedown', onMouseDown, true);
  }, [wrapperRef]);
}

const YOOPTA_TEXT_MARKS = ['bold', 'italic', 'underline', 'strike', 'code', 'highlight'];
const YOOPTA_BLOCK_ELEMENT_TYPES = {
  Paragraph: 'paragraph',
  HeadingOne: 'heading-one',
  HeadingTwo: 'heading-two',
  HeadingThree: 'heading-three',
  BulletedList: 'bulleted-list',
  NumberedList: 'numbered-list',
  TodoList: 'todo-list',
};
const YOOPTA_TEXT_BLOCK_TYPES = new Set(Object.keys(YOOPTA_BLOCK_ELEMENT_TYPES));

function mapYooptaTextLeaves(node, mapper) {
  if (Array.isArray(node)) return node.map(item => mapYooptaTextLeaves(item, mapper));
  if (!node || typeof node !== 'object') return node;
  if (typeof node.text === 'string') return mapper(node);
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, mapYooptaTextLeaves(value, mapper)]),
  );
}

function hasYooptaTextMark(node, mark) {
  if (Array.isArray(node)) return node.some(item => hasYooptaTextMark(item, mark));
  if (!node || typeof node !== 'object') return false;
  if (typeof node.text === 'string') return !!node[mark];
  return Object.values(node).some(value => hasYooptaTextMark(value, mark));
}

function updateYooptaWholeTextMark(value, mark) {
  const isActive = hasYooptaTextMark(value, mark);
  return mapYooptaTextLeaves(value, leaf => {
    const next = { ...leaf };
    if (isActive) {
      delete next[mark];
      return next;
    }
    next[mark] = mark === 'highlight' ? { backgroundColor: '#fef08a' } : true;
    return next;
  });
}

function clearYooptaWholeTextMarks(value) {
  return mapYooptaTextLeaves(value, leaf => {
    const next = { ...leaf };
    YOOPTA_TEXT_MARKS.forEach(mark => delete next[mark]);
    return next;
  });
}

function hasYooptaSelectedTextMark(value, selectedOrders, mark) {
  if (!Array.isArray(selectedOrders) || selectedOrders.length === 0) return false;
  const selected = new Set(selectedOrders);
  return Object.values(value || {}).some(block => (
    selected.has(block?.meta?.order) && hasYooptaTextMark(block.value, mark)
  ));
}

function updateYooptaSelectedTextMark(value, selectedOrders, mark) {
  if (!Array.isArray(selectedOrders) || selectedOrders.length === 0) return value;
  const selected = new Set(selectedOrders);
  const isActive = hasYooptaSelectedTextMark(value, selectedOrders, mark);
  return Object.fromEntries(
    Object.entries(value || {}).map(([blockId, block]) => {
      if (!selected.has(block?.meta?.order)) return [blockId, block];
      return [blockId, {
        ...block,
        value: mapYooptaTextLeaves(block.value, leaf => {
          const next = { ...leaf };
          if (isActive) {
            delete next[mark];
            return next;
          }
          next[mark] = mark === 'highlight' ? { backgroundColor: '#fef08a' } : true;
          return next;
        }),
      }];
    }),
  );
}

function clearYooptaSelectedTextMarks(value, selectedOrders) {
  if (!Array.isArray(selectedOrders) || selectedOrders.length === 0) return value;
  const selected = new Set(selectedOrders);
  return Object.fromEntries(
    Object.entries(value || {}).map(([blockId, block]) => {
      if (!selected.has(block?.meta?.order)) return [blockId, block];
      return [blockId, {
        ...block,
        value: mapYooptaTextLeaves(block.value, leaf => {
          const next = { ...leaf };
          YOOPTA_TEXT_MARKS.forEach(mark => delete next[mark]);
          return next;
        }),
      }];
    }),
  );
}

function updateYooptaWholeBlockType(value, type) {
  const elementType = YOOPTA_BLOCK_ELEMENT_TYPES[type];
  if (!elementType) return value;
  return Object.fromEntries(
    Object.entries(value || {}).map(([blockId, block]) => {
      if (!YOOPTA_TEXT_BLOCK_TYPES.has(block?.type)) return [blockId, block];
      const nextValue = Array.isArray(block.value)
        ? block.value.map(element => ({ ...element, type: elementType }))
        : block.value;
      return [blockId, { ...block, type, value: nextValue }];
    }),
  );
}

function updateYooptaSelectedBlockType(value, selectedOrders, type) {
  const elementType = YOOPTA_BLOCK_ELEMENT_TYPES[type];
  if (!elementType || !Array.isArray(selectedOrders) || selectedOrders.length === 0) return value;
  const selected = new Set(selectedOrders);
  return Object.fromEntries(
    Object.entries(value || {}).map(([blockId, block]) => {
      if (!YOOPTA_TEXT_BLOCK_TYPES.has(block?.type) || !selected.has(block?.meta?.order)) return [blockId, block];
      const nextValue = Array.isArray(block.value)
        ? block.value.map(element => ({ ...element, type: elementType }))
        : block.value;
      return [blockId, { ...block, type, value: nextValue }];
    }),
  );
}

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

function getEditorTopLevelBlockIds(root, value) {
  if (!root) return [];
  const seen = new Set();
  return Array.from(root.querySelectorAll('[data-yoopta-block-id]'))
    .map(node => node.getAttribute('data-yoopta-block-id'))
    .filter(id => {
      if (!id || !value?.[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function getDropIndexFromY(root, value, clientY) {
  const ids = getEditorTopLevelBlockIds(root, value);
  const nodes = ids
    .map(id => root.querySelector(`[data-yoopta-block-id="${id}"]`))
    .filter(Boolean);
  for (let i = 0; i < nodes.length; i += 1) {
    const rect = nodes[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return { ids, index: i };
  }
  return { ids, index: ids.length };
}

function moveYooptaBlock(editor, blockId, insertIndex, idsInOrder) {
  const value = editor.getEditorValue();
  const ids = idsInOrder.filter(id => value[id]);
  const from = ids.indexOf(blockId);
  if (from < 0) return false;
  ids.splice(from, 1);
  let to = insertIndex;
  if (from < insertIndex) to -= 1;
  to = Math.max(0, Math.min(ids.length, to));
  if (to === from) return false;
  ids.splice(to, 0, blockId);
  const next = {};
  ids.forEach((id, order) => {
    next[id] = { ...value[id], meta: { ...value[id].meta, order } };
  });
  Object.values(value).forEach(block => {
    if (!next[block.id]) {
      next[block.id] = { ...block, meta: { ...block.meta, order: ids.length } };
    }
  });
  editor.setEditorValue(next);
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
      onMouseDownCapture={event => {
        if (event.target.closest('button')) return;
        event.stopPropagation();
      }}
      onDragStart={event => {
        if (!element?.props?.src) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
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
      onDragEnd={event => {
        event.stopPropagation();
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

// 이미지 파일 → 압축 base64 (Canvas 리사이즈). 원본 그대로 넣으면 base64가 수 MB가 되어
// Firestore 문서 1MB 한도를 넘겨 저장이 실패하므로, 캔버스 삽입 이미지도 1200px/JPEG로 줄인다.
function readImageFile(file, maxPx = 1200, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (!width || !height) { resolve({ src: '', sizes: { width: 720, height: 420 } }); return; }
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx; }
        else { width = Math.round((width * maxPx) / height); height = maxPx; }
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve({ src: canvas.toDataURL('image/jpeg', quality), sizes: { width, height } });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 불러오지 못했습니다')); };
    img.src = url;
  });
}

/**
 * useBlockDndReorder — 블록 핸들 드래그로 위/아래 자유 이동(이미지 포함 모든 블록).
 *  - 드롭 위치를 가리키는 인디케이터 라인 표시
 *  - 드래그 중 화면 위/아래 끝에 자동 스크롤 존을 보여주고, 그 위로 가져가면 자동 스크롤
 * 같은 에디터 안에서만 재정렬한다(editorId로 구분).
 */
function useBlockDndReorder(editor, editorInstanceIdRef, handleEditorChange) {
  const wrapperRef = useRef(null);
  const scrollParentRef = useRef(null);
  const rafRef = useRef(0);
  const dirRef = useRef(0);     // -1: 위로, +1: 아래로
  const speedRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dropLine, setDropLine] = useState(null);
  const [zones, setZones] = useState(null);

  const stopAuto = useCallback(() => {
    dirRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const tick = useCallback(() => {
    const sp = scrollParentRef.current;
    if (sp && dirRef.current) {
      sp.scrollTop += dirRef.current * speedRef.current;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = 0;
    }
  }, []);
  const runAuto = useCallback(() => { if (!rafRef.current) rafRef.current = requestAnimationFrame(tick); }, [tick]);

  const dimDragged = useCallback((on) => {
    const id = activeBlockDrag?.blockId;
    const root = wrapperRef.current;
    if (!id || !root) return;
    const node = root.querySelector(`[data-yoopta-block-id="${id}"]`);
    if (node) node.style.opacity = on ? '0.4' : '';
  }, []);

  useEffect(() => {
    const onStart = (e) => {
      if (e.detail?.editorId !== editorInstanceIdRef.current) return;
      const sp = findScrollParent(wrapperRef.current);
      scrollParentRef.current = sp;
      const r = sp.getBoundingClientRect();
      setZones({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
      setDragging(true);
      dimDragged(true);
    };
    const onEnd = () => {
      stopAuto();
      dimDragged(false);
      setDragging(false);
      setDropLine(null);
      setZones(null);
    };
    window.addEventListener('fitpoly:block-drag-start', onStart);
    window.addEventListener('fitpoly:block-drag-end', onEnd);
    return () => {
      window.removeEventListener('fitpoly:block-drag-start', onStart);
      window.removeEventListener('fitpoly:block-drag-end', onEnd);
      stopAuto();
    };
  }, [editorInstanceIdRef, stopAuto, dimDragged]);

  // 최상위 블록 DOM 노드만 (중첩/중복 제외)
  const topLevelBlockNodes = useCallback(() => {
    const root = wrapperRef.current;
    if (!root) return [];
    const value = editor.getEditorValue();
    const seen = new Set();
    return Array.from(root.querySelectorAll('[data-yoopta-block-id]')).filter(node => {
      const id = node.getAttribute('data-yoopta-block-id');
      if (!id || !value[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [editor]);

  const insertIndexAt = useCallback((clientY, nodes) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const rect = nodes[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return nodes.length;
  }, []);

  const onDragOver = useCallback((event) => {
    if (!activeBlockDrag || activeBlockDrag.editorId !== editorInstanceIdRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const y = event.clientY;
    const nodes = topLevelBlockNodes();
    const idx = insertIndexAt(y, nodes);
    if (nodes.length === 0) setDropLine(null);
    else if (idx < nodes.length) {
      const rect = nodes[idx].getBoundingClientRect();
      setDropLine({ top: rect.top, left: rect.left, width: rect.width });
    } else {
      const rect = nodes[nodes.length - 1].getBoundingClientRect();
      setDropLine({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    const sp = scrollParentRef.current;
    if (sp) {
      const r = sp.getBoundingClientRect();
      if (y < r.top + BLOCK_DRAG_SCROLL_BAND) {
        dirRef.current = -1; speedRef.current = Math.max(4, Math.ceil((r.top + BLOCK_DRAG_SCROLL_BAND - y) / 5)); runAuto();
      } else if (y > r.bottom - BLOCK_DRAG_SCROLL_BAND) {
        dirRef.current = 1; speedRef.current = Math.max(4, Math.ceil((y - (r.bottom - BLOCK_DRAG_SCROLL_BAND)) / 5)); runAuto();
      } else {
        stopAuto();
      }
    }
    return true;
  }, [editorInstanceIdRef, topLevelBlockNodes, insertIndexAt, runAuto, stopAuto]);

  const reorderById = useCallback((blockId, insertIndex, idsInOrder) => {
    const value = editor.getEditorValue();
    const ids = idsInOrder.filter(id => value[id]);
    const from = ids.indexOf(blockId);
    if (from < 0) return;
    ids.splice(from, 1);
    let to = insertIndex;
    if (from < insertIndex) to -= 1;
    to = Math.max(0, Math.min(ids.length, to));
    if (to === from) return;
    ids.splice(to, 0, blockId);
    const next = {};
    ids.forEach((id, i) => { next[id] = { ...value[id], meta: { ...value[id].meta, order: i } }; });
    Object.values(value).forEach(b => { if (!next[b.id]) next[b.id] = { ...b, meta: { ...b.meta, order: ids.length } }; });
    editor.setEditorValue(next);
    queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
  }, [editor, handleEditorChange]);

  const onDrop = useCallback((event) => {
    if (!activeBlockDrag || activeBlockDrag.editorId !== editorInstanceIdRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    const nodes = topLevelBlockNodes();
    const ids = nodes.map(node => node.getAttribute('data-yoopta-block-id'));
    const idx = insertIndexAt(event.clientY, nodes);
    const blockId = activeBlockDrag.blockId;
    reorderById(blockId, idx, ids);
    activeBlockDrag = null;
    stopAuto();
    dimDragged(false);
    setDragging(false);
    setDropLine(null);
    setZones(null);
    window.dispatchEvent(new CustomEvent('fitpoly:block-drag-end'));
    return true;
  }, [editorInstanceIdRef, topLevelBlockNodes, insertIndexAt, reorderById, stopAuto, dimDragged]);

  const overlay = dragging ? (
    <>
      {zones && (
        <>
          <div className="fixed z-[400] pointer-events-none flex items-start justify-center overflow-hidden" style={{ top: zones.top, left: zones.left, width: zones.width, height: BLOCK_DRAG_SCROLL_BAND }}>
            <div className="absolute inset-0 bg-gradient-to-b from-primary-500/20 to-transparent" />
            <div className="mt-1.5 rounded-full bg-primary-600/95 px-3 py-1 text-[11px] font-bold text-white shadow-lg">▲ 위로 스크롤</div>
          </div>
          <div className="fixed z-[400] pointer-events-none flex items-end justify-center overflow-hidden" style={{ top: zones.bottom - BLOCK_DRAG_SCROLL_BAND, left: zones.left, width: zones.width, height: BLOCK_DRAG_SCROLL_BAND }}>
            <div className="absolute inset-0 bg-gradient-to-t from-primary-500/20 to-transparent" />
            <div className="mb-1.5 rounded-full bg-primary-600/95 px-3 py-1 text-[11px] font-bold text-white shadow-lg">▼ 아래로 스크롤</div>
          </div>
        </>
      )}
      {dropLine && (
        <div className="fixed z-[401] pointer-events-none" style={{ top: dropLine.top - 1.5, left: dropLine.left, width: dropLine.width }}>
          <div className="h-[3px] w-full rounded-full bg-primary-600 shadow-[0_0_8px_rgba(0,47,108,0.5)]" />
        </div>
      )}
    </>
  ) : null;

  return { wrapperRef, onDragOver, onDrop, overlay };
}

function MiniBlockActions({ onEditorChange }) {
  const editor = useYooptaEditor();
  const editorId = useContext(YooptaMiniEditorIdContext);
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
            draggable
            onClick={() => setBlockOptionsOpen(true)}
            onDragStart={event => {
              if (!blockId) return;
              activeBlockDrag = { blockId, editorId };
              event.dataTransfer.effectAllowed = 'move';
              try { event.dataTransfer.setData(CUSTOM_BLOCK_DRAG_TYPE, blockId); } catch { /* noop */ }
              window.dispatchEvent(new CustomEvent('fitpoly:block-drag-start', { detail: { editorId } }));
            }}
            onDragEnd={() => {
              activeBlockDrag = null;
              window.dispatchEvent(new CustomEvent('fitpoly:block-drag-end'));
            }}
            title="드래그하여 이동 · 클릭하여 옵션"
          >
            <span className="text-sm">⠿</span>
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
  const wrapperRef = useRef(null);
  const contextSelectionRef = useRef(null);
  useTableDragScroll(wrapperRef);
  const editorInstanceIdRef = useRef(generateId());
  const editorMinHeight = Math.min(minHeight, 36);
  const initialValue = useMemo(() => textToYooptaValue(value), []);
  const editor = useMemo(() => createYooptaEditor({
    plugins: PLUGINS,
    marks: MARKS,
    value: initialValue,
  }), []);
  const [editorRenderKey, setEditorRenderKey] = useState(0);
  const latestValueRef = useRef(initialValue);
  const pendingValueRef = useRef(null);
  const directUndoStackRef = useRef([]);
  const directRedoStackRef = useRef([]);
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
    if (!options.preserveDirectHistory) {
      directUndoStackRef.current = [];
      directRedoStackRef.current = [];
    }
    if (options.immediate) {
      publishEditorChange(nextValue);
      return;
    }
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => publishEditorChange(pendingValueRef.current), 120);
  }, [publishEditorChange]);

  useEffect(() => {
    const onFlush = () => {
      const nextValue = pendingValueRef.current || editor.getEditorValue();
      publishEditorChange(nextValue);
    };
    window.addEventListener('fitpoly:flush-yoopta-editors', onFlush);
    return () => window.removeEventListener('fitpoly:flush-yoopta-editors', onFlush);
  }, [editor, publishEditorChange]);

  const blockDnd = useBlockDndReorder(editor, editorInstanceIdRef, handleEditorChange);
  // 브라우저 맞춤법 검사(빨간 밑줄) 비활성화 — Slate가 spellCheck=true를 강제하므로 DOM에서 끈다.
  useEffect(() => {
    const root = blockDnd.wrapperRef.current;
    if (!root) return undefined;
    const disable = () => root.querySelectorAll('[contenteditable]').forEach(el => {
      if (el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck', 'false');
    });
    disable();
    const observer = new MutationObserver(disable);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['spellcheck', 'contenteditable'] });
    return () => observer.disconnect();
  }, [blockDnd.wrapperRef]);

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
  const commitContextAction = (action) => {
    restoreContextSelection(editor, contextSelectionRef.current);
    action();
    queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
  };
  const restoreDirectEditorValue = (nextValue) => {
    editor.setEditorValue(nextValue);
    setEditorRenderKey(key => key + 1);
    handleEditorChange(nextValue, { immediate: true, preserveDirectHistory: true });
  };
  const commitWholeEditorValue = (nextValue) => {
    const currentValue = editor.getEditorValue();
    if (JSON.stringify(currentValue) !== JSON.stringify(nextValue)) {
      directUndoStackRef.current = [...directUndoStackRef.current.slice(-49), currentValue];
      directRedoStackRef.current = [];
    }
    editor.setEditorValue(nextValue);
    setEditorRenderKey(key => key + 1);
    handleEditorChange(nextValue, { immediate: true, preserveDirectHistory: true });
  };
  const toggleContextTextMark = (type, selectedText) => {
    const selectedOrders = contextSelectionRef.current?.selectedPaths;
    if (Array.isArray(selectedOrders) && selectedOrders.length > 0) {
      commitWholeEditorValue(updateYooptaSelectedTextMark(editor.getEditorValue(), selectedOrders, type));
      return;
    }
    if (selectedText) {
      commitContextAction(() => Marks.toggle(editor, { type }));
      return;
    }
    commitWholeEditorValue(updateYooptaWholeTextMark(editor.getEditorValue(), type));
  };
  const clearContextTextMarks = (selectedText) => {
    const selectedOrders = contextSelectionRef.current?.selectedPaths;
    if (Array.isArray(selectedOrders) && selectedOrders.length > 0) {
      commitWholeEditorValue(clearYooptaSelectedTextMarks(editor.getEditorValue(), selectedOrders));
      return;
    }
    if (selectedText) {
      commitContextAction(() => Marks.clear(editor));
      return;
    }
    commitWholeEditorValue(clearYooptaWholeTextMarks(editor.getEditorValue()));
  };
  const setWholeContextBlockType = (type) => {
    const selectedOrders = contextSelectionRef.current?.selectedPaths;
    if (Array.isArray(selectedOrders) && selectedOrders.length > 0) {
      commitWholeEditorValue(updateYooptaSelectedBlockType(editor.getEditorValue(), selectedOrders, type));
      return;
    }
    commitWholeEditorValue(updateYooptaWholeBlockType(editor.getEditorValue(), type));
  };
  const keepSelectionOnContextMouseDown = (event) => {
    if (event.button !== 2) return;
    const snapshot = createContextSelectionSnapshot(editor, blockDnd.wrapperRef.current);
    contextSelectionRef.current = snapshot;
    if (!hasContextSelection(snapshot)) return;
    event.preventDefault();
    event.stopPropagation();
    requestAnimationFrame(() => restoreContextSelection(editor, snapshot));
  };
  const openEditorContextMenu = (event) => {
    if (event.target.closest('button, select, input, textarea, label')) return;
    const snapshot = createContextSelectionSnapshot(editor, blockDnd.wrapperRef.current);
    contextSelectionRef.current = hasContextSelection(snapshot) ? snapshot : contextSelectionRef.current;
    restoreContextSelection(editor, contextSelectionRef.current);
    const current = Selection.getCurrent(editor);
    const block = current != null ? editor.getBlock({ at: current }) : null;
    const selectedText = hasContextBlockSelection(contextSelectionRef.current)
      ? ''
      : contextSelectionRef.current?.selectedText || window.getSelection?.()?.toString?.().trim() || '';
    openYooptaContextMenu(event, [
      { label: '글자 굵게', icon: BoldIcon, onClick: () => toggleContextTextMark('bold', selectedText) },
      { label: '기울임', icon: ItalicIcon, onClick: () => toggleContextTextMark('italic', selectedText) },
      { label: '밑줄', icon: UnderlineIcon, onClick: () => toggleContextTextMark('underline', selectedText) },
      { label: '취소선', icon: Strikethrough, onClick: () => toggleContextTextMark('strike', selectedText) },
      { label: '코드', icon: CodeIcon, onClick: () => toggleContextTextMark('code', selectedText) },
      {
        label: '강조',
        icon: Highlighter,
        onClick: () => selectedText
          ? commitContextAction(() => {
              if (Marks.isActive(editor, { type: 'highlight' })) Marks.remove(editor, { type: 'highlight' });
              else Marks.update(editor, { type: 'highlight', value: { backgroundColor: '#fef08a' } });
            })
          : toggleContextTextMark('highlight', selectedText),
      },
      { label: '서식 지우기', icon: Eraser, onClick: () => clearContextTextMarks(selectedText) },
      ...(!selectedText ? [
        { label: '문단', icon: Eraser, onClick: () => setWholeContextBlockType('Paragraph') },
        { label: '제목 1', icon: BoldIcon, onClick: () => setWholeContextBlockType('HeadingOne') },
        { label: '제목 2', icon: BoldIcon, onClick: () => setWholeContextBlockType('HeadingTwo') },
        { label: '제목 3', icon: BoldIcon, onClick: () => setWholeContextBlockType('HeadingThree') },
        { label: '글머리 목록', icon: Check, onClick: () => setWholeContextBlockType('BulletedList') },
        { label: '번호 목록', icon: Check, onClick: () => setWholeContextBlockType('NumberedList') },
        { label: '할 일 목록', icon: Check, onClick: () => setWholeContextBlockType('TodoList') },
        { label: '이미지 추가', icon: ImagePlus, onClick: () => imageInputRef.current?.click() },
        ...(block?.id ? [
          { label: '복제', icon: ImagePlus, onClick: () => commitContextAction(() => Blocks.duplicateBlock(editor, { blockId: block.id })) },
          { label: '삭제', icon: Eraser, danger: true, onClick: () => commitContextAction(() => Blocks.deleteBlock(editor, { blockId: block.id })) },
        ] : []),
      ] : []),
    ]);
  };

  return (
    <div
      ref={(node) => {
        wrapperRef.current = node;
        blockDnd.wrapperRef.current = node;
      }}
      className={`yoopta-mini-editor yoopta-portfolio-wrapper group relative ${className}`}
      style={{ minHeight: editorMinHeight }}
      onMouseDownCapture={keepSelectionOnContextMouseDown}
      onContextMenuCapture={openEditorContextMenu}
      onPaste={event => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.some(file => file.type.startsWith('image/'))) return;
        event.preventDefault();
        insertImageFiles(files);
      }}
      onDragOverCapture={event => {
        if (blockDnd.onDragOver(event)) return;
        const hasExternalImage = Array.from(event.dataTransfer?.types || []).includes(CUSTOM_IMAGE_DRAG_TYPE);
        const hasImageFile = Array.from(event.dataTransfer?.items || []).some(item => item.type.startsWith('image/'));
        if (hasExternalImage || hasImageFile) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDropCapture={async event => {
        if (blockDnd.onDrop(event)) return;
        // Slate(에디터 내부)가 contentEditable에 자체 onDrop을 달아 드롭 데이터를
        // 먼저 가로채므로, 캡처 단계에서 이미지 드롭을 먼저 처리하고 전파를 막는다.
        const externalImage = event.dataTransfer?.getData(CUSTOM_IMAGE_DRAG_TYPE);
        if (externalImage) {
          event.preventDefault();
          event.stopPropagation();
          try {
            const payload = JSON.parse(externalImage);
            // 같은 에디터 안에서는 복제하지 않고 기존 이미지 블록의 위치만 옮긴다.
            if (payload?.source === 'yoopta' && payload?.sourceEditorId === editorInstanceIdRef.current) {
              const sourceBlockId = payload.sourceBlockId;
              const value = editor.getEditorValue();
              const { ids, index } = getDropIndexFromY(blockDnd.wrapperRef.current, value, event.clientY);
              if (sourceBlockId && moveYooptaBlock(editor, sourceBlockId, index, ids)) {
                handleEditorChange(editor.getEditorValue(), { immediate: true });
              }
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
          const nextDirect = directRedoStackRef.current.pop();
          if (nextDirect) {
            directUndoStackRef.current = [...directUndoStackRef.current.slice(-49), editor.getEditorValue()];
            restoreDirectEditorValue(nextDirect);
            return;
          }
          editor.redo();
          queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
          return;
        }
        if (isModifier && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) {
            const nextDirect = directRedoStackRef.current.pop();
            if (nextDirect) {
              directUndoStackRef.current = [...directUndoStackRef.current.slice(-49), editor.getEditorValue()];
              restoreDirectEditorValue(nextDirect);
              return;
            }
            editor.redo();
          }
          else {
            const prevDirect = directUndoStackRef.current.pop();
            if (prevDirect) {
              directRedoStackRef.current = [...directRedoStackRef.current.slice(-49), editor.getEditorValue()];
              restoreDirectEditorValue(prevDirect);
              return;
            }
            editor.undo();
          }
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
          key={editorRenderKey}
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
      {blockDnd.overlay}
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
function readPalettePayload(dataTransfer) {
  const candidates = [
    dataTransfer?.getData(CUSTOM_PALETTE_DRAG_TYPE),
    dataTransfer?.getData('application/json'),
    dataTransfer?.getData('text/plain'),
  ].filter(Boolean);
  for (const raw of candidates) {
    const text = String(raw || '').startsWith('fitpoly-palette:')
      ? String(raw).slice('fitpoly-palette:'.length)
      : raw;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.kind) return parsed;
    } catch {
      // Continue to the next transfer format.
    }
  }
  return null;
}

function yooptaNodeText(node) {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  return (node.children || []).map(yooptaNodeText).join('');
}

function isEditorValueEmpty(value) {
  const blocks = Object.values(value || {});
  if (blocks.length !== 1) return false;
  const block = blocks[0];
  if (!block || block.type !== 'Paragraph') return false;
  return !(block.value || []).some(node => yooptaNodeText(node).trim());
}

export const NotionDocEditor = forwardRef(function NotionDocEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = '내용을 입력하거나 왼쪽에서 섹션을 끌어다 놓으세요...',
  className = '',
  resolvePaletteBlocks,
}, ref) {
  const imageInputRef = useRef(null);
  const wrapperRef = useRef(null);
  const contextSelectionRef = useRef(null);
  useTableDragScroll(wrapperRef);
  const editorInstanceIdRef = useRef(generateId());
  const initialValue = useMemo(() => textToYooptaValue(value), []);
  const editor = useMemo(() => createYooptaEditor({ plugins: PLUGINS, marks: MARKS, value: initialValue }), []);
  const [editorRenderKey, setEditorRenderKey] = useState(0);
  const latestValueRef = useRef(initialValue);
  const pendingValueRef = useRef(null);
  const directUndoStackRef = useRef([]);
  const directRedoStackRef = useRef([]);
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
    if (!options.preserveDirectHistory) {
      directUndoStackRef.current = [];
      directRedoStackRef.current = [];
    }
    if (options.immediate) { publishEditorChange(nextValue); return; }
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => publishEditorChange(pendingValueRef.current), 150);
  }, [publishEditorChange]);

  useEffect(() => {
    const onFlush = () => {
      const nextValue = pendingValueRef.current || editor.getEditorValue();
      publishEditorChange(nextValue);
    };
    window.addEventListener('fitpoly:flush-yoopta-editors', onFlush);
    return () => window.removeEventListener('fitpoly:flush-yoopta-editors', onFlush);
  }, [editor, publishEditorChange]);

  const blockDnd = useBlockDndReorder(editor, editorInstanceIdRef, handleEditorChange);

  // 브라우저 맞춤법 검사(빨간 밑줄) 비활성화 — Slate가 spellCheck=true를 강제하므로 DOM에서 끈다.
  useEffect(() => {
    const root = blockDnd.wrapperRef.current;
    if (!root) return undefined;
    const disable = () => root.querySelectorAll('[contenteditable]').forEach(el => {
      if (el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck', 'false');
    });
    disable();
    const observer = new MutationObserver(disable);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['spellcheck', 'contenteditable'] });
    return () => observer.disconnect();
  }, [blockDnd.wrapperRef]);

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
    // 캔버스 내용을 통째로 교체 (초안 만들기 — 빈 화면에서 시작)
    replaceBlocks: (blocks) => {
      if (!Array.isArray(blocks) || blocks.length === 0) return;
      editor.setEditorValue(blocksToYooptaValue(blocks));
      queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
    },
    // 이미지 파일 선택창 열기 (자유 이미지 추가)
    openImagePicker: () => imageInputRef.current?.click(),
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
  const commitContextAction = (action) => {
    restoreContextSelection(editor, contextSelectionRef.current);
    action();
    queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
  };
  const restoreDirectEditorValue = (nextValue) => {
    editor.setEditorValue(nextValue);
    setEditorRenderKey(key => key + 1);
    handleEditorChange(nextValue, { immediate: true, preserveDirectHistory: true });
  };
  const commitWholeEditorValue = (nextValue) => {
    const currentValue = editor.getEditorValue();
    if (JSON.stringify(currentValue) !== JSON.stringify(nextValue)) {
      directUndoStackRef.current = [...directUndoStackRef.current.slice(-49), currentValue];
      directRedoStackRef.current = [];
    }
    editor.setEditorValue(nextValue);
    setEditorRenderKey(key => key + 1);
    handleEditorChange(nextValue, { immediate: true, preserveDirectHistory: true });
  };
  const toggleContextTextMark = (type, selectedText) => {
    const selectedOrders = contextSelectionRef.current?.selectedPaths;
    if (Array.isArray(selectedOrders) && selectedOrders.length > 0) {
      commitWholeEditorValue(updateYooptaSelectedTextMark(editor.getEditorValue(), selectedOrders, type));
      return;
    }
    if (selectedText) {
      commitContextAction(() => Marks.toggle(editor, { type }));
      return;
    }
    commitWholeEditorValue(updateYooptaWholeTextMark(editor.getEditorValue(), type));
  };
  const clearContextTextMarks = (selectedText) => {
    const selectedOrders = contextSelectionRef.current?.selectedPaths;
    if (Array.isArray(selectedOrders) && selectedOrders.length > 0) {
      commitWholeEditorValue(clearYooptaSelectedTextMarks(editor.getEditorValue(), selectedOrders));
      return;
    }
    if (selectedText) {
      commitContextAction(() => Marks.clear(editor));
      return;
    }
    commitWholeEditorValue(clearYooptaWholeTextMarks(editor.getEditorValue()));
  };
  const setWholeContextBlockType = (type) => {
    const selectedOrders = contextSelectionRef.current?.selectedPaths;
    if (Array.isArray(selectedOrders) && selectedOrders.length > 0) {
      commitWholeEditorValue(updateYooptaSelectedBlockType(editor.getEditorValue(), selectedOrders, type));
      return;
    }
    commitWholeEditorValue(updateYooptaWholeBlockType(editor.getEditorValue(), type));
  };
  const keepSelectionOnContextMouseDown = (event) => {
    if (event.button !== 2) return;
    const snapshot = createContextSelectionSnapshot(editor, blockDnd.wrapperRef.current);
    contextSelectionRef.current = snapshot;
    if (!hasContextSelection(snapshot)) return;
    event.preventDefault();
    event.stopPropagation();
    requestAnimationFrame(() => restoreContextSelection(editor, snapshot));
  };
  const openEditorContextMenu = (event) => {
    if (event.target.closest('button, select, input, textarea, label')) return;
    const snapshot = createContextSelectionSnapshot(editor, blockDnd.wrapperRef.current);
    contextSelectionRef.current = hasContextSelection(snapshot) ? snapshot : contextSelectionRef.current;
    restoreContextSelection(editor, contextSelectionRef.current);
    const current = Selection.getCurrent(editor);
    const block = current != null ? editor.getBlock({ at: current }) : null;
    const selectedText = hasContextBlockSelection(contextSelectionRef.current)
      ? ''
      : contextSelectionRef.current?.selectedText || window.getSelection?.()?.toString?.().trim() || '';
    openYooptaContextMenu(event, [
      { label: '글자 굵게', icon: BoldIcon, onClick: () => toggleContextTextMark('bold', selectedText) },
      { label: '기울임', icon: ItalicIcon, onClick: () => toggleContextTextMark('italic', selectedText) },
      { label: '밑줄', icon: UnderlineIcon, onClick: () => toggleContextTextMark('underline', selectedText) },
      { label: '취소선', icon: Strikethrough, onClick: () => toggleContextTextMark('strike', selectedText) },
      { label: '코드', icon: CodeIcon, onClick: () => toggleContextTextMark('code', selectedText) },
      {
        label: '강조',
        icon: Highlighter,
        onClick: () => selectedText
          ? commitContextAction(() => {
              if (Marks.isActive(editor, { type: 'highlight' })) Marks.remove(editor, { type: 'highlight' });
              else Marks.update(editor, { type: 'highlight', value: { backgroundColor: '#fef08a' } });
            })
          : toggleContextTextMark('highlight', selectedText),
      },
      { label: '서식 지우기', icon: Eraser, onClick: () => clearContextTextMarks(selectedText) },
      ...(!selectedText ? [
        { label: '문단', icon: Eraser, onClick: () => setWholeContextBlockType('Paragraph') },
        { label: '제목 1', icon: BoldIcon, onClick: () => setWholeContextBlockType('HeadingOne') },
        { label: '제목 2', icon: BoldIcon, onClick: () => setWholeContextBlockType('HeadingTwo') },
        { label: '제목 3', icon: BoldIcon, onClick: () => setWholeContextBlockType('HeadingThree') },
        { label: '글머리 목록', icon: Check, onClick: () => setWholeContextBlockType('BulletedList') },
        { label: '번호 목록', icon: Check, onClick: () => setWholeContextBlockType('NumberedList') },
        { label: '할 일 목록', icon: Check, onClick: () => setWholeContextBlockType('TodoList') },
        { label: '이미지 추가', icon: ImagePlus, onClick: () => imageInputRef.current?.click() },
        ...(block?.id ? [
          { label: '복제', icon: ImagePlus, onClick: () => commitContextAction(() => Blocks.duplicateBlock(editor, { blockId: block.id })) },
          { label: '삭제', icon: Eraser, danger: true, onClick: () => commitContextAction(() => Blocks.deleteBlock(editor, { blockId: block.id })) },
        ] : []),
      ] : []),
    ]);
  };

  const handlePaletteDrop = (event) => {
    const payload = readPalettePayload(event.dataTransfer);
    if (!payload || !resolvePaletteBlocks) return false;
    event.preventDefault();
    event.stopPropagation();
    try {
      const blocks = resolvePaletteBlocks(payload);
      if (Array.isArray(blocks) && blocks.length > 0) {
        if (isEditorValueEmpty(editor.getEditorValue())) {
          editor.setEditorValue(blocksToYooptaValue(blocks));
        } else {
          const current = Selection.getCurrent(editor);
          const atOrder = typeof current === 'number' ? current + 1 : null;
          insertYooptaBlocks(editor, blocks, atOrder);
        }
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
      ref={(node) => {
        wrapperRef.current = node;
        blockDnd.wrapperRef.current = node;
      }}
      className={`yoopta-mini-editor yoopta-portfolio-wrapper group relative ${className}`}
      onMouseDownCapture={keepSelectionOnContextMouseDown}
      onContextMenuCapture={openEditorContextMenu}
      onPaste={event => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.some(file => file.type.startsWith('image/'))) return;
        event.preventDefault();
        insertImageFiles(files);
      }}
      onDragOverCapture={event => {
        if (blockDnd.onDragOver(event)) return;
        const types = Array.from(event.dataTransfer?.types || []);
        const hasPalette = types.includes(CUSTOM_PALETTE_DRAG_TYPE) || types.includes('application/json');
        const hasExternalImage = types.includes(CUSTOM_IMAGE_DRAG_TYPE);
        const hasImageFile = Array.from(event.dataTransfer?.items || []).some(item => item.type.startsWith('image/'));
        if (hasPalette || hasExternalImage || hasImageFile) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = hasPalette ? 'copy' : 'move';
        }
      }}
      onDropCapture={async event => {
        if (blockDnd.onDrop(event)) return;
        if (handlePaletteDrop(event)) return;
        const externalImage = event.dataTransfer?.getData(CUSTOM_IMAGE_DRAG_TYPE);
        if (externalImage) {
          event.preventDefault();
          event.stopPropagation();
          try {
            const payload = JSON.parse(externalImage);
            // 같은 에디터 안에서는 복제하지 않고 기존 이미지 블록의 위치만 옮긴다.
            if (payload?.source === 'yoopta' && payload?.sourceEditorId === editorInstanceIdRef.current) {
              const sourceBlockId = payload.sourceBlockId;
              const value = editor.getEditorValue();
              const { ids, index } = getDropIndexFromY(blockDnd.wrapperRef.current, value, event.clientY);
              if (sourceBlockId && moveYooptaBlock(editor, sourceBlockId, index, ids)) {
                handleEditorChange(editor.getEditorValue(), { immediate: true });
              }
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
          const nextDirect = directRedoStackRef.current.pop();
          if (nextDirect) {
            directUndoStackRef.current = [...directUndoStackRef.current.slice(-49), editor.getEditorValue()];
            restoreDirectEditorValue(nextDirect);
            return;
          }
          editor.redo();
          queueMicrotask(() => handleEditorChange(editor.getEditorValue(), { immediate: true }));
          return;
        }
        if (isModifier && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) {
            const nextDirect = directRedoStackRef.current.pop();
            if (nextDirect) {
              directUndoStackRef.current = [...directUndoStackRef.current.slice(-49), editor.getEditorValue()];
              restoreDirectEditorValue(nextDirect);
              return;
            }
            editor.redo();
          } else {
            const prevDirect = directUndoStackRef.current.pop();
            if (prevDirect) {
              directRedoStackRef.current = [...directRedoStackRef.current.slice(-49), editor.getEditorValue()];
              restoreDirectEditorValue(prevDirect);
              return;
            }
            editor.undo();
          }
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
          key={editorRenderKey}
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
      {blockDnd.overlay}
    </div>
  );
});
