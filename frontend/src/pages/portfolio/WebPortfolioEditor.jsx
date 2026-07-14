/**
 * WebPortfolioEditor — 웹사이트형 템플릿(web-1/3/4/6) 전용 편집기.
 *
 * - 인라인 클릭 편집(WYSIWYG): 템플릿 화면 그대로 텍스트를 클릭해 수정
 * - 드래그 선택 → 형광펜/굵게/밑줄 플로팅 툴바
 * - 테마 패널: 프리셋 + 배경/글자/포인트 자유 색상 (portfolio.webTheme)
 * - 자동 저장(디바운스), 미리보기 화면과 100% 동일한 렌더러 사용
 * - 공개 발행(webLocked=true) 후에는 편집 잠금 — 잠금 해제 시 발행 취소
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Palette, Eye, Send, Lock, Unlock, Loader2, Check, Bold, Underline, Eraser, X, RotateCcw, Database, Search, Briefcase, Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import useExperienceStore, { FRAMEWORKS } from '../../stores/experienceStore';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { uploadImageDataUrl, uploadImageUrl } from '../../services/uploadImage';
import JobAnalysisDockPanel, { JOB_DOCK_WIDTH } from '../../components/JobAnalysisDockPanel';
import { recommendWebTheme } from '../../services/jobAI';
import { inlineHtmlToPlainText } from './VisualPortfolioTemplates';
import WebPortfolioRenderer, { DEFAULT_WEB_THEMES, WEB_THEME_PRESETS, getWebTheme } from './WebPortfolioTemplates';

const HIGHLIGHT_COLORS = ['#fef08a', '#bbf7d0', '#fbcfe8', '#bae6fd'];
const INLINE_IMAGE_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g;
const WEB_ENTRY_TEXT_FIELDS = [
  'title', 'company', 'role', 'date', 'period', 'tag', 'description', 'link', 'status',
  'jobCategory', 'category', 'aiSummary', 'afterMetric', 'beforeMetric', 'contribution',
];

function stripEmbeddedImages(value) {
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return '';
    return value.includes('data:image/') ? value.replace(INLINE_IMAGE_RE, '') : value;
  }
  if (Array.isArray(value)) return value.map(stripEmbeddedImages).filter(item => item !== '');
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stripEmbeddedImages(item)]));
  }
  return value;
}

function imageUrlOf(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.url === 'string') return value.url;
  return '';
}

function compactNotionDoc(value) {
  const cleaned = stripEmbeddedImages(value || null);
  if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) return cleaned;
  const entries = Object.entries(cleaned).filter(([, block]) => {
    if (block?.type !== 'Image') return true;
    const serialized = JSON.stringify(block);
    return /https?:\/\//i.test(serialized);
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function compactWebSection(section = {}) {
  const blocks = (Array.isArray(section.blocks) ? section.blocks : [])
    .map(block => {
      const content = stripEmbeddedImages(block?.content || block?.src || block?.text || '');
      if (block?.type === 'image' && !content) return null;
      return {
        type: block?.type || 'text',
        content,
        alt: stripEmbeddedImages(block?.alt || ''),
        width: block?.width || undefined,
      };
    })
    .filter(Boolean);
  return {
    key: section.key || '',
    title: stripEmbeddedImages(section.title || section.label || section.key || '내용'),
    label: stripEmbeddedImages(section.label || section.title || section.key || '내용'),
    type: section.type || 'custom',
    content: stripEmbeddedImages(section.content || ''),
    blocks,
  };
}

function compactStructuredResult(source = {}, thumbnailUrl = '') {
  const exportConfig = source.exportConfig || {};
  const compact = {
    projectOverview: stripEmbeddedImages(source.projectOverview || {}),
    keyExperiences: stripEmbeddedImages(source.keyExperiences || []),
    keywords: stripEmbeddedImages(source.keywords || []),
    jobSpecific: stripEmbeddedImages(source.jobSpecific || {}),
    exportConfig: {
      jobCategory: exportConfig.jobCategory || '',
      coverImg: imageUrlOf(thumbnailUrl) && !imageUrlOf(thumbnailUrl).startsWith('data:image/') ? imageUrlOf(thumbnailUrl) : '',
    },
  };
  ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'].forEach(key => {
    if (source[key] != null) compact[key] = stripEmbeddedImages(source[key]);
  });
  return compact;
}

/** 웹 템플릿에 필요한 상세 텍스트는 유지하고 원본 경험의 중복/인라인 이미지 데이터는 제거한다. */
export function compactWebEntry(entry = {}) {
  const sections = (entry.sections || []).map(compactWebSection);
  const thumbnailUrl = imageUrlOf(entry.thumbnailUrl);
  const compact = {
    experienceId: entry.experienceId || entry.id || null,
    framework: entry.framework || 'STRUCTURED',
    frameworkContent: sections.length ? {} : stripEmbeddedImages(entry.frameworkContent || entry.content || {}),
    descriptionBlocks: sections.length ? null : stripEmbeddedImages(entry.descriptionBlocks || null),
    notionDoc: compactNotionDoc(entry.notionDoc),
    skills: stripEmbeddedImages(entry.skills || []),
    keywords: stripEmbeddedImages(entry.keywords || []),
    bullets: stripEmbeddedImages(entry.bullets || entry.details || []),
    details: stripEmbeddedImages(entry.details || entry.bullets || []),
    metrics: stripEmbeddedImages(entry.metrics || []),
    classify: stripEmbeddedImages(entry.classify || []),
    thumbnailUrl,
    sections,
    structuredResult: compactStructuredResult(entry.structuredResult || {}, thumbnailUrl),
    imageStyle: entry.imageStyle || undefined,
    wordmark: entry.wordmark || undefined,
    stamp: entry.stamp || undefined,
  };
  WEB_ENTRY_TEXT_FIELDS.forEach(key => { compact[key] = stripEmbeddedImages(entry[key] || ''); });
  return compact;
}

async function prepareWebEntryForStorage(entry) {
  const compact = compactWebEntry(entry);
  if (!compact.thumbnailUrl.startsWith('data:image/')) return { entry: compact, imageFailed: false };
  try {
    const url = await uploadImageDataUrl(compact.thumbnailUrl, 1400, 0.82);
    compact.thumbnailUrl = url;
    compact.structuredResult = {
      ...compact.structuredResult,
      exportConfig: { ...(compact.structuredResult.exportConfig || {}), coverImg: url },
    };
    return { entry: compact, imageFailed: false };
  } catch {
    compact.thumbnailUrl = '';
    return { entry: compact, imageFailed: true };
  }
}

async function prepareWebPortfolioForStorage(portfolio) {
  const patch = {};
  let imageFailed = false;
  const experiences = [];
  for (const experience of portfolio?.experiences || []) {
    const prepared = await prepareWebEntryForStorage(experience);
    experiences.push(prepared.entry);
    imageFailed = imageFailed || prepared.imageFailed;
  }
  if (JSON.stringify(experiences) !== JSON.stringify(portfolio?.experiences || [])) patch.experiences = experiences;

  for (const field of ['profileImageUrl', 'coverImageUrl']) {
    const current = imageUrlOf(portfolio?.[field]);
    if (!current.startsWith('data:image/')) continue;
    try { patch[field] = await uploadImageDataUrl(current, field === 'profileImageUrl' ? 900 : 1600, 0.82); }
    catch { patch[field] = ''; imageFailed = true; }
  }
  return { portfolio: { ...portfolio, ...patch }, patch, imageFailed };
}

function experienceDate(exp) {
  return exp.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 7)
    || exp.updatedAt?.toDate?.()?.toISOString?.()?.slice(0, 7)
    || '';
}

function normalizeExperienceSections(exp, ai) {
  const exportSections = ai.exportConfig?.sections;
  if (exportSections?.length > 0) {
    return exportSections
      .filter(section => section?.content?.trim?.() || section?.blocks?.length)
      .map(section => ({
        key: section.key || '',
        title: section.title || section.label || section.key || '내용',
        label: section.label || section.title || section.key || '내용',
        type: section.type || 'custom',
        content: section.content || '',
        blocks: section.blocks || [],
      }));
  }

  if (exp.sections?.length > 0) {
    return exp.sections.map(section => ({
      ...section,
      title: section.title || section.label || section.key || '내용',
      label: section.label || section.title || section.key || '내용',
      blocks: section.blocks || [],
    }));
  }

  const framework = FRAMEWORKS[exp.framework] || FRAMEWORKS.STRUCTURED;
  return (framework?.fields || [])
    .map(field => ({
      key: field.key,
      title: field.label,
      label: field.label,
      type: 'custom',
      content: ai[field.key] || exp.content?.[field.key] || '',
      blocks: [],
    }))
    .filter(section => String(section.content || '').trim());
}

/** 경험 DB 항목 → 웹 A·B·C·D/노션 상세 모달 공용 경량 경험 엔트리 */
function buildWebExpEntry(exp) {
  const ai = exp.structuredResult || {};
  const ov = ai.projectOverview || {};
  const sections = normalizeExperienceSections(exp, ai);
  const date = ov.duration || exp.content?.duration || experienceDate(exp);
  const description = ov.summary || ai.intro || exp.content?.intro || exp.content?.overview || sections[0]?.content || '';
  const skills = (ov.techStack?.length > 0 ? ov.techStack : (ai.keywords || exp.keywords || []))
    .slice(0, 8)
    .map(item => typeof item === 'string' ? item : item?.name || item?.keyword || '')
    .filter(Boolean);
  return compactWebEntry({
    experienceId: exp.id || null,
    title: exp.title || '',
    company: exp.title || '',
    role: ov.role || '',
    date,
    period: date,
    tag: exp.category || 'Project',
    description,
    descriptionBlocks: exp.descriptionBlocks || null,
    skills,
    keywords: ai.keywords || exp.keywords || [],
    thumbnailUrl: imageUrlOf(exp.thumbnailUrl) || exp.images?.[0]?.url || (typeof exp.images?.[0] === 'string' ? exp.images[0] : '') || '',
    notionDoc: exp.notionDoc || ai.exportConfig?.notionDoc || null,
    framework: exp.framework || 'STRUCTURED',
    frameworkContent: exp.content || {},
    content: exp.content || {},
    sections,
    link: ov.link || exp.link || '',
    status: exp.status || 'finished',
    classify: exp.classify || [],
    jobCategory: exp.jobCategory || ai.exportConfig?.jobCategory || '',
    structuredResult: ai,
  });
}

function ExperiencePickerModal({ experiences, usedIds, loading, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = experiences.filter(exp => {
    if (!normalizedQuery) return true;
    const haystack = [exp.title, exp.framework, exp.category, ...(exp.keywords || [])]
      .map(value => typeof value === 'string' ? value : value?.name || value?.keyword || '')
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-[17px] font-black text-gray-900"><Database size={17} className="text-primary-600" /> 내 경험정리에서 불러오기</h3>
            <p className="mt-1 text-[12.5px] text-gray-400">상세 본문, 역할, 기간, 기술, 키워드와 이미지까지 함께 연결됩니다.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={17} /></button>
        </div>
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="경험명, 프레임워크, 키워드 검색"
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-[13px] outline-none transition focus:border-primary-300 focus:ring-2 focus:ring-primary-100" />
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> 경험 목록을 불러오는 중</div>
          ) : filtered.length === 0 ? (
            <p className="py-14 text-center text-sm text-gray-400">불러올 경험이 없습니다.</p>
          ) : filtered.map(exp => {
            const used = usedIds.has(exp.id);
            const ai = exp.structuredResult || {};
            const summary = ai.projectOverview?.summary || ai.intro || exp.content?.intro || exp.content?.overview || '';
            return (
              <button key={exp.id} type="button" disabled={used} onClick={() => onSelect(exp)}
                className="flex w-full items-start gap-3 rounded-xl border border-gray-100 p-4 text-left transition hover:border-primary-200 hover:bg-primary-50/50 disabled:cursor-default disabled:bg-gray-50 disabled:opacity-55">
                <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Briefcase size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold text-gray-800">{exp.title || '제목 없는 경험'}</span>
                    {used && <span className="flex-shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">추가됨</span>}
                  </span>
                  <span className="mt-1 block text-[11.5px] font-semibold text-primary-500">{exp.framework || 'STRUCTURED'}{exp.category ? ` · ${exp.category}` : ''}</span>
                  {summary && <span className="mt-1.5 line-clamp-2 block text-[12.5px] leading-relaxed text-gray-500">{summary}</span>}
                </span>
                {!used && <Plus size={16} className="mt-2 flex-shrink-0 text-primary-500" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 드래그 선택 시 뜨는 서식 툴바 — 형광펜/굵게/밑줄/지우기 */
function SelectionToolbar({ accent }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const onSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setPos(null); return; }
      const node = sel.anchorNode;
      const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      if (!el?.closest?.('.fp-rich-inline')) { setPos(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) { setPos(null); return; }
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  if (!pos) return null;

  const run = (cmd, val = null) => {
    try { document.execCommand('styleWithCSS', false, true); } catch { /* 미지원 무시 */ }
    document.execCommand(cmd, false, val);
  };

  const btn = 'w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/15 transition-colors';

  return (
    <div
      className="fixed z-[80] flex items-center gap-0.5 rounded-xl bg-neutral-900/95 backdrop-blur border border-white/15 px-1.5 py-1 shadow-2xl"
      style={{ left: pos.x, top: Math.max(8, pos.y - 8), transform: 'translate(-50%, -100%)' }}
      onMouseDown={e => e.preventDefault()}
    >
      {HIGHLIGHT_COLORS.map(c => (
        <button key={c} type="button" title="형광펜" className={btn} onClick={() => run('hiliteColor', c)}>
          <span className="w-4 h-4 rounded-sm border border-black/20" style={{ background: c }} />
        </button>
      ))}
      <button type="button" title="포인트색 글자" className={btn} onClick={() => run('foreColor', accent)}>
        <span className="text-[13px] font-black" style={{ color: accent }}>가</span>
      </button>
      <span className="w-px h-4 bg-white/15 mx-0.5" />
      <button type="button" title="굵게" className={`${btn} text-white`} onClick={() => run('bold')}><Bold size={13} /></button>
      <button type="button" title="밑줄" className={`${btn} text-white`} onClick={() => run('underline')}><Underline size={13} /></button>
      <button type="button" title="서식 지우기" className={`${btn} text-white/70`} onClick={() => { run('removeFormat'); run('hiliteColor', 'transparent'); }}><Eraser size={13} /></button>
    </div>
  );
}

/** WCAG 명도 대비 비율 — AI 추천 색조합의 가독성 검증용 */
function contrastRatio(hex1, hex2) {
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5]
      .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(hex1), lum(hex2)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 테마(색) 커스터마이즈 패널 */
function ThemePanel({ portfolio, onTheme, onClose }) {
  const th = getWebTheme(portfolio);
  const presets = WEB_THEME_PRESETS[portfolio.templateId] || [];
  const fields = [['bg', '배경'], ['ink', '글자'], ['accent', '포인트']];
  const [aiPalettes, setAiPalettes] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const fetchAiPalettes = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await recommendWebTheme({
        templateId: portfolio.templateId,
        currentTheme: { bg: th.bg, ink: th.ink, accent: th.accent },
        jobAnalysis: portfolio.jobAnalysis || undefined,
      });
      // 글자 가독성이 확보된 조합만 통과 (AI가 대비를 어긴 경우 방어)
      const readable = (data.palettes || []).filter(p => contrastRatio(p.bg, p.ink) >= 3.5);
      if (readable.length === 0) throw new Error('가독성 기준을 통과한 조합이 없습니다');
      setAiPalettes(readable);
    } catch (err) {
      setAiError(err.response?.data?.error || err.message || '색 추천에 실패했습니다');
    }
    setAiLoading(false);
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-[300px] max-h-[72vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 shadow-2xl p-5 z-[70]" onMouseDown={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-black text-gray-800">테마 색상</p>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>

      {/* ── AI 색조합 추천 — 템플릿(+연결된 기업 무드)에 맞춰 분석 ── */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-gray-400">AI 추천 조합</p>
        {aiPalettes && !aiLoading && (
          <button type="button" onClick={fetchAiPalettes} className="text-[11px] font-bold text-primary-500 hover:text-primary-700">다시 추천</button>
        )}
      </div>
      {aiLoading ? (
        <div className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-gray-100 py-4 text-[12px] font-bold text-gray-400">
          <Loader2 size={13} className="animate-spin" /> 템플릿에 맞는 조합 분석 중
        </div>
      ) : aiError ? (
        <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
          <p className="text-[11.5px] text-red-600">{aiError}</p>
          <button type="button" onClick={fetchAiPalettes} className="mt-1 text-[11px] font-bold text-red-500 underline">다시 시도</button>
        </div>
      ) : !aiPalettes ? (
        <button type="button" onClick={fetchAiPalettes}
          className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-200 bg-primary-50/50 py-2.5 text-[12px] font-bold text-primary-600 hover:bg-primary-50 transition-colors">
          <Sparkles size={12} /> 이 템플릿에 어울리는 색 추천받기{portfolio.jobAnalysis ? ' (기업 무드 반영)' : ''}
        </button>
      ) : (
        <div className="mb-5 space-y-2">
          {aiPalettes.map(p => (
            <button key={p.name} type="button" onClick={() => onTheme({ bg: p.bg, ink: p.ink, accent: p.accent })}
              className={`w-full rounded-lg border p-2.5 text-left hover:border-gray-400 transition-colors ${th.bg === p.bg && th.accent === p.accent ? 'border-gray-800 ring-1 ring-gray-800' : 'border-gray-200'}`}>
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-16 shrink-0 rounded overflow-hidden border border-black/5">
                  <span className="flex-1" style={{ background: p.bg }} />
                  <span className="flex-1" style={{ background: p.ink }} />
                  <span className="flex-1" style={{ background: p.accent }} />
                </span>
                <span className="truncate text-[11.5px] font-bold text-gray-700">{p.name}</span>
              </span>
              {p.reason && <span className="mt-1 block text-[10.5px] leading-relaxed text-gray-400" style={{ wordBreak: 'keep-all' }}>{p.reason}</span>}
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] font-bold text-gray-400 mb-2">프리셋</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {presets.map(p => (
          <button key={p.name} type="button" onClick={() => onTheme({ bg: p.bg, ink: p.ink, accent: p.accent })}
            className={`rounded-lg border p-2 text-left hover:border-gray-400 transition-colors ${th.bg === p.bg && th.accent === p.accent ? 'border-gray-800 ring-1 ring-gray-800' : 'border-gray-200'}`}>
            <span className="flex h-5 rounded overflow-hidden border border-black/5">
              <span className="flex-1" style={{ background: p.bg }} />
              <span className="flex-1" style={{ background: p.ink }} />
              <span className="flex-1" style={{ background: p.accent }} />
            </span>
            <span className="block mt-1 text-[10.5px] font-bold text-gray-500 truncate">{p.name}</span>
          </button>
        ))}
      </div>

      <p className="text-[11px] font-bold text-gray-400 mb-2">자유 색상</p>
      <div className="space-y-2.5">
        {fields.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-bold text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-gray-400 uppercase">{th[key]}</span>
              <input type="color" value={th[key]} onChange={e => onTheme({ [key]: e.target.value })}
                className="w-8 h-8 rounded-md border border-gray-200 cursor-pointer p-0.5 bg-white" />
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => onTheme(null)}
        className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-[12px] font-bold text-gray-500 hover:border-gray-500 transition-colors">
        <RotateCcw size={12} /> 기본 테마로 초기화
      </button>
    </div>
  );
}

/** 포트폴리오에서 AI 첨삭 대상 텍스트 섹션을 수집한다. 적용 시 key로 되돌려 쓴다. */
function collectTailorSections(portfolio) {
  const sections = [];
  const push = (key, title, raw) => {
    const content = inlineHtmlToPlainText(String(raw || '')).trim();
    if (content) sections.push({ key, title, content });
  };
  push('headline', '한 줄 소개', portfolio.headline);
  push('webIntro', '첫 화면 소개', portfolio.webIntro);
  push('about', '자기소개', portfolio.about);
  (portfolio.experiences || []).forEach((exp, idx) => {
    push(`exp-${idx}`, inlineHtmlToPlainText(String(exp.company || exp.title || `경험 ${idx + 1}`)), exp.description);
  });
  return sections.slice(0, 20); // 백엔드 섹션 상한
}


/** 공개 발행 확인 모달 */
function PublishModal({ onConfirm, onClose, publishing }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mb-4"><Send size={19} /></div>
        <h3 className="text-[17px] font-black text-gray-900 mb-2">공개 링크로 내보낼까요?</h3>
        <p className="text-[13.5px] leading-relaxed text-gray-500 mb-6" style={{ wordBreak: 'keep-all' }}>
          발행하면 누구나 링크로 볼 수 있고, <b className="text-gray-700">편집이 잠깁니다.</b> 다시 수정하려면 잠금을 해제(발행 취소)하면 됩니다.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-[14px] font-bold text-gray-500 hover:bg-gray-50">취소</button>
          <button type="button" onClick={onConfirm} disabled={publishing}
            className="flex-1 rounded-lg bg-primary-600 py-2.5 text-[14px] font-bold text-white hover:bg-primary-700 disabled:opacity-60 flex items-center justify-center gap-1.5">
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 발행하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebPortfolioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { updatePortfolio } = usePortfolioStore();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('saved'); // 'saved' | 'dirty' | 'saving'
  const [themeOpen, setThemeOpen] = useState(false);
  const [jobPanelOpen, setJobPanelOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [experiencePickerOpen, setExperiencePickerOpen] = useState(false);
  const [experiencePickerLoading, setExperiencePickerLoading] = useState(false);
  const [pickerExperiences, setPickerExperiences] = useState([]);
  const portfolioRef = useRef(null);
  const dirtyKeysRef = useRef(new Set());
  const saveTimerRef = useRef(null);
  portfolioRef.current = portfolio;

  useUnsavedChanges(saveState !== 'saved');

  const locked = !!portfolio?.webLocked;
  const theme = portfolio ? getWebTheme(portfolio) : DEFAULT_WEB_THEMES['web-1'];

  // ── 로드 + 신규 생성 시 경험 자동 채우기 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/portfolio/${id}`);
        if (cancelled) return;
        let p = { id, ...data };
        let loadPatch = {};
        let imageMigrationFailed = false;
        if (p.pendingAutofill && !(p.experiences || []).length && user?.uid) {
          try {
            await useExperienceStore.getState().fetchExperiences(user.uid);
            const exps = [];
            for (const source of useExperienceStore.getState().experiences || []) {
              const prepared = await prepareWebEntryForStorage(buildWebExpEntry(source));
              exps.push(prepared.entry);
              imageMigrationFailed = imageMigrationFailed || prepared.imageFailed;
            }
            p = { ...p, experiences: exps, pendingAutofill: false };
            loadPatch = { ...loadPatch, experiences: exps, pendingAutofill: false };
            if (exps.length > 0) toast.success(`경험 ${exps.length}건이 자동으로 채워졌습니다`);
          } catch { /* 자동 채우기 실패해도 편집은 가능 */ }
        }
        const recovered = await prepareWebPortfolioForStorage(p);
        p = recovered.portfolio;
        loadPatch = { ...loadPatch, ...recovered.patch };
        imageMigrationFailed = imageMigrationFailed || recovered.imageFailed;
        if (cancelled) return;
        if (Object.keys(loadPatch).length > 0) {
          try {
            await updatePortfolio(id, loadPatch);
            toast.success('대용량 이미지와 중복 데이터를 정리했습니다');
          } catch {
            Object.keys(loadPatch).forEach(key => dirtyKeysRef.current.add(key));
            setSaveState('dirty');
            toast.error('용량 정리는 완료했지만 서버 저장을 다시 시도해야 합니다');
          }
        }
        if (imageMigrationFailed) toast.error('일부 기존 이미지는 이전하지 못했습니다. 해당 이미지를 다시 올려주세요.');
        setPortfolio(p);
        setJobPanelOpen(!!p.jobAnalysis); // 기업이 연결돼 있으면 패널 기본 열림
      } catch {
        toast.error('포트폴리오를 불러오지 못했습니다');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user?.uid]);

  // ── 자동 저장 (변경 키만 디바운스 전송) ──
  const flushSave = useCallback(async () => {
    const keys = [...dirtyKeysRef.current];
    const cur = portfolioRef.current;
    if (!keys.length || !cur) return;
    dirtyKeysRef.current = new Set();
    setSaveState('saving');
    try {
      const payload = {};
      keys.forEach(k => { payload[k] = cur[k]; });
      await updatePortfolio(id, payload);
      setSaveState(dirtyKeysRef.current.size ? 'dirty' : 'saved');
    } catch (error) {
      if (error?.response?.status === 413) {
        try {
          const recovered = await prepareWebPortfolioForStorage(cur);
          const retryPayload = { ...recovered.patch };
          keys.forEach(key => { retryPayload[key] = recovered.portfolio[key]; });
          if (Object.keys(retryPayload).length > 0) {
            portfolioRef.current = recovered.portfolio;
            setPortfolio(recovered.portfolio);
            await updatePortfolio(id, retryPayload);
            setSaveState(dirtyKeysRef.current.size ? 'dirty' : 'saved');
            toast.success('용량이 큰 이미지 데이터를 정리하고 저장했습니다');
            if (recovered.imageFailed) toast.error('이전하지 못한 이미지는 다시 올려주세요.');
            return;
          }
        } catch { /* 아래의 일반 저장 실패 처리로 이어진다 */ }
      }
      keys.forEach(k => dirtyKeysRef.current.add(k));
      setSaveState('dirty');
      toast.error('저장에 실패했습니다');
    }
  }, [id, updatePortfolio]);

  const markDirty = useCallback((...keys) => {
    keys.forEach(k => dirtyKeysRef.current.add(k));
    setSaveState('dirty');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, 800);
  }, [flushSave]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    flushSave();
  }, [flushSave]);

  // ── 템플릿에 넘길 편집 API ──
  const update = useCallback((field, value) => {
    setPortfolio(prev => prev ? { ...prev, [field]: value } : prev);
    markDirty(field);
  }, [markDirty]);

  const updateItem = useCallback((listField, idx, patch) => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const arr = [...(prev[listField] || [])];
      if (!arr[idx]) return prev;
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, [listField]: arr };
    });
    markDirty(listField);
  }, [markDirty]);

  const addItem = useCallback((listField, item) => {
    setPortfolio(prev => prev ? { ...prev, [listField]: [...(prev[listField] || []), item] } : prev);
    markDirty(listField);
  }, [markDirty]);

  const removeItem = useCallback((listField, idx) => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const arr = [...(prev[listField] || [])];
      arr.splice(idx, 1);
      return { ...prev, [listField]: arr };
    });
    markDirty(listField);
  }, [markDirty]);

  const updateContact = useCallback((key, value) => {
    setPortfolio(prev => prev ? { ...prev, contact: { ...(prev.contact || {}), [key]: value } } : prev);
    markDirty('contact');
  }, [markDirty]);

  const updateSkill = useCallback((cat, idx, name) => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const skills = { ...(prev.skills || {}) };
      const arr = [...(skills[cat] || [])];
      if (idx < 0 || idx >= arr.length) return prev;
      arr[idx] = typeof arr[idx] === 'object' ? { ...arr[idx], name } : name;
      skills[cat] = arr;
      return { ...prev, skills };
    });
    markDirty('skills');
  }, [markDirty]);

  const removeSkill = useCallback((cat, idx) => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const skills = { ...(prev.skills || {}) };
      const arr = [...(skills[cat] || [])];
      arr.splice(idx, 1);
      skills[cat] = arr;
      return { ...prev, skills };
    });
    markDirty('skills');
  }, [markDirty]);

  const addSkill = useCallback(() => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const skills = { ...(prev.skills || {}) };
      skills.tools = [...(skills.tools || []), '새 스킬'];
      return { ...prev, skills };
    });
    markDirty('skills');
  }, [markDirty]);

  const openExperiencePicker = useCallback(async () => {
    setExperiencePickerOpen(true);
    if (!user?.uid) return;
    setExperiencePickerLoading(true);
    try {
      await useExperienceStore.getState().fetchExperiences(user.uid);
      setPickerExperiences(useExperienceStore.getState().experiences || []);
    } catch {
      toast.error('경험 목록을 불러오지 못했습니다');
    }
    setExperiencePickerLoading(false);
  }, [user?.uid]);

  const importExperience = useCallback(async (experience) => {
    try {
      const prepared = await prepareWebEntryForStorage(buildWebExpEntry(experience));
      addItem('experiences', prepared.entry);
      setExperiencePickerOpen(false);
      toast.success(`“${experience.title || '경험'}”을 포트폴리오에 추가했습니다`);
      if (prepared.imageFailed) toast.error('대표 이미지는 이전하지 못했습니다. 다시 올려주세요.');
    } catch {
      toast.error('경험을 가볍게 변환하지 못했습니다');
    }
  }, [addItem]);

  const uploadProjectImage = useCallback(async (file, idx) => {
    if (!file) return;
    try {
      const url = await uploadImageUrl(file, 1400, 0.84);
      const current = portfolioRef.current?.experiences?.[idx] || {};
      const structuredResult = current.structuredResult || {};
      updateItem('experiences', idx, {
        thumbnailUrl: url,
        structuredResult: {
          ...structuredResult,
          exportConfig: { ...(structuredResult.exportConfig || {}), coverImg: url },
        },
      });
      toast.success('프로젝트 이미지를 변경했습니다');
    } catch {
      toast.error('이미지를 업로드하지 못했습니다');
    }
  }, [updateItem]);

  const removeProjectImage = useCallback((idx) => {
    const current = portfolioRef.current?.experiences?.[idx] || {};
    const structuredResult = current.structuredResult || {};
    updateItem('experiences', idx, {
      thumbnailUrl: '',
      structuredResult: {
        ...structuredResult,
        exportConfig: { ...(structuredResult.exportConfig || {}), coverImg: null },
      },
    });
  }, [updateItem]);

  const uploadProfileImage = useCallback(async (file) => {
    if (!file) return;
    try {
      const url = await uploadImageUrl(file, 900, 0.84);
      update('profileImageUrl', url);
      toast.success('프로필 이미지를 변경했습니다');
    } catch {
      toast.error('이미지를 업로드하지 못했습니다');
    }
  }, [update]);

  const editApi = {
    update,
    updateItem,
    addItem,
    removeItem,
    updateContact,
    updateSkill,
    removeSkill,
    addSkill,
    openExperiencePicker,
    uploadProjectImage,
    removeProjectImage,
    uploadProfileImage,
  };

  const onTheme = useCallback((patch) => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const webTheme = patch === null ? {} : { ...(prev.webTheme || {}), ...patch };
      return { ...prev, webTheme };
    });
    markDirty('webTheme');
  }, [markDirty]);

  // ── 미리보기 / 발행 / 잠금 해제 ──
  const goPreview = async () => { await flushSave(); navigate(`/app/portfolio/web-preview/${id}`); };

  const publish = async () => {
    setPublishing(true);
    try {
      await flushSave();
      await updatePortfolio(id, { isPublic: true, webLocked: true, status: 'exported' });
      setPortfolio(prev => prev ? { ...prev, isPublic: true, webLocked: true } : prev);
      setPublishOpen(false);
      toast.success('공개 링크가 발행되었습니다');
      navigate(`/app/portfolio/web-preview/${id}`);
    } catch {
      toast.error('발행에 실패했습니다');
    }
    setPublishing(false);
  };

  const unlock = async () => {
    try {
      await updatePortfolio(id, { isPublic: false, webLocked: false, status: 'draft' });
      setPortfolio(prev => prev ? { ...prev, isPublic: false, webLocked: false } : prev);
      toast.success('잠금이 해제되었습니다. 공개 링크는 비활성화됩니다.');
    } catch {
      toast.error('잠금 해제에 실패했습니다');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 size={30} className="animate-spin text-primary-600" /></div>;
  }
  if (!portfolio) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">포트폴리오를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── 상단 툴바 ── */}
      <div className="sticky top-0 z-[60] bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/app/portfolio" className="flex items-center gap-1.5 text-[13px] font-bold text-gray-400 hover:text-gray-700 transition-colors shrink-0">
              <ArrowLeft size={15} /> 목록
            </Link>
            <span className="w-px h-4 bg-gray-200" />
            <p className="text-[14px] font-black text-gray-800 truncate">{portfolio.title || '웹 포트폴리오'}</p>
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-0.5 text-[11.5px] font-bold shrink-0">
                <Lock size={11} /> 발행됨 · 편집 잠김
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!locked && (
              <span className="hidden sm:flex items-center gap-1.5 text-[12px] font-bold text-gray-400 mr-1">
                {saveState === 'saving' && <><Loader2 size={12} className="animate-spin" /> 저장 중</>}
                {saveState === 'saved' && <><Check size={13} className="text-emerald-500" /> 저장됨</>}
                {saveState === 'dirty' && <>변경 사항 있음</>}
              </span>
            )}
            {!locked && (
              <div className="relative">
                <button type="button" onClick={() => setThemeOpen(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-600 hover:border-gray-400 transition-colors">
                  <Palette size={14} />
                  <span className="hidden sm:inline">테마</span>
                  <span className="flex gap-0.5 ml-0.5">
                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: theme.bg }} />
                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ background: theme.accent }} />
                  </span>
                </button>
                {themeOpen && <ThemePanel portfolio={portfolio} onTheme={onTheme} onClose={() => setThemeOpen(false)} />}
              </div>
            )}
            <button type="button" onClick={goPreview}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-bold text-gray-600 hover:border-gray-400 transition-colors">
              <Eye size={14} /> <span className="hidden sm:inline">미리보기</span>
            </button>
            {locked ? (
              <button type="button" onClick={unlock}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-amber-600 transition-colors">
                <Unlock size={14} /> 잠금 해제
              </button>
            ) : (
              <button type="button" onClick={() => setPublishOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-[13px] font-bold text-white hover:bg-primary-700 transition-colors">
                <Send size={14} /> 내보내기
              </button>
            )}
          </div>
        </div>
        {!locked && (
          <div className="px-4 md:px-6 pb-2 -mt-1">
            <p className="text-[11.5px] text-gray-400">텍스트를 클릭해 바로 수정하고, 드래그하면 형광펜·굵게 서식을 적용할 수 있어요.</p>
          </div>
        )}
      </div>

      {/* ── 템플릿 (편집 모드) — 기업분석 패널이 열리면 캔버스를 옆으로 밀어 나란히 본다 ── */}
      <div data-web-edit-root className="transition-[margin] duration-300" style={{ marginRight: !locked && jobPanelOpen ? `min(${JOB_DOCK_WIDTH}px, 100vw)` : 0 }}>
        <WebPortfolioRenderer
          portfolio={portfolio}
          edit={locked ? null : editApi}
          embedded
          editorToolbarOffset={locked ? 56 : 80}
          resizeToBase64={uploadImageUrl}
        />
      </div>

      {!locked && (
        <JobAnalysisDockPanel
          open={jobPanelOpen}
          onToggle={setJobPanelOpen}
          analysis={portfolio.jobAnalysis || null}
          onAnalysis={a => update('jobAnalysis', a)}
          collectSections={() => collectTailorSections(portfolioRef.current || portfolio)}
          onApplySection={(key, content) => {
            if (key.startsWith('exp-')) {
              const expIdx = Number(key.slice(4));
              if (!(portfolioRef.current?.experiences || [])[expIdx]) { toast.error('해당 경험을 찾을 수 없습니다'); return; }
              updateItem('experiences', expIdx, { description: content });
            } else {
              update(key, content);
            }
          }}
          topOffset={144} // 앱 헤더(64) + 에디터 툴바(80) 아래에서 시작
        />
      )}
      {!locked && <SelectionToolbar accent={theme.accent} />}
      {publishOpen && <PublishModal onConfirm={publish} onClose={() => setPublishOpen(false)} publishing={publishing} />}
      {experiencePickerOpen && (
        <ExperiencePickerModal
          experiences={pickerExperiences}
          usedIds={new Set((portfolio.experiences || []).map(exp => exp.experienceId).filter(Boolean))}
          loading={experiencePickerLoading}
          onSelect={importExperience}
          onClose={() => setExperiencePickerOpen(false)}
        />
      )}
    </div>
  );
}
