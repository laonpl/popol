import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import YooptaEditor, { createYooptaEditor, Blocks, Marks as MarksAPI, useYooptaEditor } from '@yoopta/editor';
import Paragraph from '@yoopta/paragraph';
import Headings from '@yoopta/headings';
import Lists from '@yoopta/lists';
import Blockquote from '@yoopta/blockquote';
import { Code } from '@yoopta/code';
import Image from '@yoopta/image';
import Callout from '@yoopta/callout';
import Divider from '@yoopta/divider';
import Table from '@yoopta/table';
import Accordion from '@yoopta/accordion';
import Embed from '@yoopta/embed';
import Link from '@yoopta/link';
import { Bold, Italic, Underline, Strike, CodeMark, Highlight } from '@yoopta/marks';
import { FloatingToolbar, FloatingBlockActions, BlockOptions, SlashCommandMenu } from '@yoopta/ui';
import '@yoopta/themes-shadcn/variables.css';
import {
  Save, Eye, ArrowLeft, Undo2, Redo2, Download, Loader2,
  FileText, Type, Heading1, List, Quote, Code2, ImageIcon,
  AlertCircle, Minus, Table2, ChevronDown, Link2, Layout
} from 'lucide-react';

// ─── 플러그인 설정 ───────────────────────────────────────
const RAW_PLUGINS = [
  Paragraph,
  Headings.HeadingOne,
  Headings.HeadingTwo,
  Headings.HeadingThree,
  Lists.BulletedList,
  Lists.NumberedList,
  Lists.TodoList,
  Blockquote,
  Code,
  Image.extend({
    options: {
      async onUpload(file) {
        // Base64 인코딩 (서버 업로드 없이 로컬 처리)
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            src: reader.result,
            alt: file.name,
            sizes: { width: 600, height: 400 },
          });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      },
    },
  }),
  Callout,
  Divider,
  Table,
  Accordion,
  Embed,
  Link,
];

const PLUGINS = RAW_PLUGINS;
const MARKS = [Bold, Italic, Underline, Strike, CodeMark, Highlight];

// ─── 기본 초기값 (빈 포트폴리오 템플릿) ─────────────────
const DEFAULT_INITIAL_VALUE = {};

// ─── 포맷팅 툴바 ────────────────────────────────────────
function EditorToolbar() {
  const editor = useYooptaEditor();

  return (
    <FloatingToolbar>
      <FloatingToolbar.Content>
        <FloatingToolbar.Group>
          {editor.formats.bold && (
            <FloatingToolbar.Button
              onClick={() => MarksAPI.toggle(editor, { type: 'bold' })}
              active={MarksAPI.isActive(editor, { type: 'bold' })}
              title="굵게 (Ctrl+B)"
            >
              <span className="font-bold">B</span>
            </FloatingToolbar.Button>
          )}
          {editor.formats.italic && (
            <FloatingToolbar.Button
              onClick={() => MarksAPI.toggle(editor, { type: 'italic' })}
              active={MarksAPI.isActive(editor, { type: 'italic' })}
              title="기울임 (Ctrl+I)"
            >
              <span className="italic">I</span>
            </FloatingToolbar.Button>
          )}
          {editor.formats.underline && (
            <FloatingToolbar.Button
              onClick={() => MarksAPI.toggle(editor, { type: 'underline' })}
              active={MarksAPI.isActive(editor, { type: 'underline' })}
              title="밑줄 (Ctrl+U)"
            >
              <span className="underline">U</span>
            </FloatingToolbar.Button>
          )}
          {editor.formats.strike && (
            <FloatingToolbar.Button
              onClick={() => MarksAPI.toggle(editor, { type: 'strike' })}
              active={MarksAPI.isActive(editor, { type: 'strike' })}
              title="취소선"
            >
              <span className="line-through">S</span>
            </FloatingToolbar.Button>
          )}
          {editor.formats.code && (
            <FloatingToolbar.Button
              onClick={() => MarksAPI.toggle(editor, { type: 'code' })}
              active={MarksAPI.isActive(editor, { type: 'code' })}
              title="인라인 코드 (Ctrl+E)"
            >
              <Code2 size={14} />
            </FloatingToolbar.Button>
          )}
          {editor.formats.highlight && (
            <FloatingToolbar.Button
              onClick={() => MarksAPI.toggle(editor, { type: 'highlight' })}
              active={MarksAPI.isActive(editor, { type: 'highlight' })}
              title="하이라이트"
            >
              <span className="bg-yellow-200 px-0.5 rounded">H</span>
            </FloatingToolbar.Button>
          )}
        </FloatingToolbar.Group>
      </FloatingToolbar.Content>
    </FloatingToolbar>
  );
}

// ─── 블록 액션 (좌측 + 드래그 핸들) ─────────────────────
function EditorBlockActions() {
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
            title="블록 추가"
          >
            <span className="text-lg leading-none">+</span>
          </FloatingBlockActions.Button>
          <FloatingBlockActions.Button
            ref={dragHandleRef}
            onClick={() => setBlockOptionsOpen(true)}
            title="블록 옵션 / 드래그"
          >
            <span className="text-sm">⋮⋮</span>
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
                    if (blockId) Blocks.deleteBlock(editor, { blockId });
                    setBlockOptionsOpen(false);
                  }}
                >
                  삭제
                </BlockOptions.Item>
                <BlockOptions.Item
                  onClick={() => {
                    if (blockId) Blocks.duplicateBlock(editor, { blockId });
                    setBlockOptionsOpen(false);
                  }}
                >
                  복제
                </BlockOptions.Item>
              </BlockOptions.Group>
            </BlockOptions.Content>
          </BlockOptions>
        </>
      )}
    </FloatingBlockActions>
  );
}

// ─── 상단 고정 통계바 ───────────────────────────────────
function EditorStats({ value }) {
  const blockCount = Object.keys(value || {}).length;
  return (
    <div className="flex items-center gap-3 text-xs text-gray-400">
      <span>{blockCount}개 블록</span>
    </div>
  );
}

// ─── 메인 에디터 컴포넌트 ────────────────────────────────
export default function YooptaPortfolioEditor({
  initialValue,
  onSave,
  onPreview,
  onBack,
  onExport,
  title = '포트폴리오',
  saving = false,
  readOnly = false,
  portfolioId,
}) {
  const [currentValue, setCurrentValue] = useState(initialValue || DEFAULT_INITIAL_VALUE);
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimerRef = useRef(null);

  const editor = useMemo(
    () => createYooptaEditor({
      plugins: PLUGINS,
      marks: MARKS,
      value: initialValue || DEFAULT_INITIAL_VALUE,
    }),
    [],
  );

  // initialValue가 나중에 로드될 때 에디터에 반영
  useEffect(() => {
    if (initialValue && Object.keys(initialValue).length > 0) {
      editor.setEditorValue(initialValue);
      setCurrentValue(initialValue);
    }
  }, [initialValue, editor]);

  const handleChange = useCallback((value) => {
    setCurrentValue(value);
    setHasChanges(true);

    // 자동저장 디바운스 (3초)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (onSave) onSave(value, true); // true = 자동저장
    }, 3000);
  }, [onSave]);

  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (onSave) onSave(currentValue, false);
    setHasChanges(false);
  }, [onSave, currentValue]);

  const handleUndo = useCallback(() => editor.undo(), [editor]);
  const handleRedo = useCallback(() => editor.redo(), [editor]);

  const handleExportHTML = useCallback(() => {
    const html = editor.getHTML(currentValue);
    if (onExport) onExport('html', html);
  }, [editor, currentValue, onExport]);

  const handleExportMarkdown = useCallback(() => {
    const md = editor.getMarkdown(currentValue);
    if (onExport) onExport('markdown', md);
  }, [editor, currentValue, onExport]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ─── 헤더 바 ─── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* 좌측: 뒤로가기 + 제목 */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                title="뒤로가기"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-base font-semibold text-gray-800 truncate max-w-[200px]">
              {title}
            </h1>
            {hasChanges && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                수정됨
              </span>
            )}
          </div>

          {/* 중앙: 통계 */}
          <EditorStats value={currentValue} />

          {/* 우측: 액션 버튼들 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="실행 취소 (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={handleRedo}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              title="다시 실행 (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>

            <div className="w-px h-5 bg-gray-200 mx-1" />

            {/* 내보내기 드롭다운 */}
            <div className="relative group">
              <button
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                title="내보내기"
              >
                <Download size={16} />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={handleExportHTML}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText size={14} /> HTML
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText size={14} /> Markdown
                </button>
              </div>
            </div>

            {onPreview && (
              <button
                onClick={() => onPreview(currentValue)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                title="미리보기"
              >
                <Eye size={16} />
              </button>
            )}

            <button
              onClick={handleManualSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </button>
          </div>
        </div>
      </header>

      {/* ─── 에디터 본문 ─── */}
      <main className="flex-1 flex justify-center py-8">
        <div className="w-full max-w-3xl px-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[600px]">
            <div className="yoopta-portfolio-wrapper p-6 md:p-10">
              <YooptaEditor
                editor={editor}
                onChange={handleChange}
                autoFocus
                placeholder="/ 를 입력하면 블록을 추가할 수 있어요"
                style={{ width: '100%', paddingBottom: 150 }}
              >
                <EditorToolbar />
                <EditorBlockActions />
                <SlashCommandMenu />
              </YooptaEditor>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
