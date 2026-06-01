import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, PenLine, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, ImagePlus, Target, Globe, X, RotateCcw, RotateCw, ChevronLeft, ChevronRight, Trash2, Plus, Undo2, LayoutGrid, ExternalLink, GripVertical as Grip, MoveUp, MoveDown, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FRAMEWORKS, JOB_CATEGORIES, JOB_SPECIFIC_FIELDS } from '../../stores/experienceStore';
import useExperienceStore from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';
import { JobAnalysisBadge } from '../../components/JobLinkInput';
import { analyzeJobUrl } from '../../services/jobAI';
import toast from 'react-hot-toast';

/* ── 마크다운 **bold** → <strong> 변환 + 불필요 마크다운 제거 ── */
function renderMarkdown(text) {
  if (!text) return '';
  const parts = sanitizeTextValue(text).split(/(\*\*[^*]+\*\*)/g);
  if (parts.length <= 1) return text.replace(/\*\*/g, '');
  return parts.map((seg, i) => {
    const m = seg.match(/^\*\*(.+)\*\*$/);
    if (m) return <strong key={i} className="font-bold">{m[1]}</strong>;
    return seg.replace(/\*\*/g, '');
  });
}
function stripMarkdown(text) {
  if (!text) return '';
  return sanitizeTextValue(text).replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/^[-*]\s/gm, '');
}

function sanitizeTextValue(text) {
  if (text == null) return '';
  return String(text)
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function sanitizeTextObject(obj = {}) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, typeof value === 'string' ? sanitizeTextValue(value) : value]));
}

function makeTextBlock(content = '') {
  return { id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'text', content: sanitizeTextValue(content) };
}

function portfolioBlocksToText(blocks = []) {
  return blocks.map(block => {
    if (block?.type === 'text') return sanitizeTextValue(block.content || '');
    if (block?.type === 'slide') {
      const cardText = (block.cards || []).map(card => [card.label, card.title, card.body, card.metric].filter(Boolean).join(' ')).filter(Boolean).join('\n');
      return [block.title, block.subtitle, block.content, cardText].filter(Boolean).map(sanitizeTextValue).join('\n');
    }
    return '';
  }).filter(Boolean).join('\n\n');
}

function normalizePortfolioBlock(block) {
  if (!block) return null;
  if (block.type === 'image') {
    return {
      id: block.id || `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      content: block.content || block.src || '',
      alt: sanitizeTextValue(block.alt || ''),
      width: block.width || '100%',
    };
  }
  if (block.type === 'slide') {
    return {
      id: block.id || `slide-${block.slideKey || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'slide',
      slideKey: block.slideKey || '',
      label: sanitizeTextValue(block.label || ''),
      kicker: sanitizeTextValue(block.kicker || ''),
      title: sanitizeTextValue(block.title || block.headline || ''),
      subtitle: sanitizeTextValue(block.subtitle || block.subcopy || ''),
      content: sanitizeTextValue(block.content || ''),
      cards: Array.isArray(block.cards) ? block.cards.map(card => sanitizeTextObject(card)) : [],
    };
  }
  return { ...(block || {}), id: block.id || `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'text', content: sanitizeTextValue(block.content || block.text || '') };
}

function normalizeExportSection(section = {}) {
  const rawBlocks = Array.isArray(section.blocks) && section.blocks.length > 0
    ? section.blocks
    : (section.content ? [{ id: `${section.key || 'section'}-text`, type: 'text', content: section.content }] : []);
  const blocks = rawBlocks.map(normalizePortfolioBlock).filter(Boolean);
  const content = sanitizeTextValue(section.content || portfolioBlocksToText(blocks));
  return {
    ...section,
    label: sanitizeTextValue(section.label || ''),
    content,
    blocks,
  };
}

function syncTextBlock(blocks = [], content = '') {
  const cleanContent = sanitizeTextValue(content);
  const normalized = blocks.map(normalizePortfolioBlock).filter(Boolean);
  const textIndex = normalized.findIndex(block => block.type === 'text');
  if (textIndex >= 0) {
    return normalized.map((block, index) => index === textIndex ? { ...block, content: cleanContent } : block);
  }
  return cleanContent ? [makeTextBlock(cleanContent), ...normalized] : normalized;
}

function buildSlideExportBlock(sectionKey, slide, content, label) {
  return normalizePortfolioBlock({
    type: 'slide',
    slideKey: sectionKey,
    label,
    kicker: slide?.kicker || '',
    title: slide?.headline || '',
    subtitle: slide?.subcopy || '',
    content,
    cards: Array.isArray(slide?.cards) ? slide.cards.slice(0, 3) : [],
  });
}

const SLIDE_DECK_SECTION_KEY = 'detail-slides';

function isSlideDeckSection(section = {}) {
  return section.key === SLIDE_DECK_SECTION_KEY || section.type === 'slides';
}

function createSlideDeckSection(blocks = [], enabled = true, label = '상세 슬라이드') {
  const slideBlocks = blocks.map(normalizePortfolioBlock).filter(block => block?.type === 'slide');
  return normalizeExportSection({
    key: SLIDE_DECK_SECTION_KEY,
    label,
    type: 'slides',
    content: portfolioBlocksToText(slideBlocks),
    blocks: slideBlocks,
    enabled,
  });
}

function moveSlidesToStandaloneSection(sections = []) {
  // 원래는 모든 섹션에서 슬라이드를 뽑아내서 맨 뒤로 강제 고정하는 로직이었으나,
  // 이제는 섹션 순서를 사용자가 마음대로 이동할 수 있도록 원본을 그대로 반환합니다.
  return sections.map(normalizeExportSection);
}

function PortfolioBlockViewer({ blocks = [], compact = false }) {
  const normalized = blocks.map(normalizePortfolioBlock).filter(Boolean);
  if (normalized.length === 0) return null;
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {normalized.map(block => {
        if (block.type === 'image') {
          return (
            <figure key={block.id} className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm" style={{ width: block.width || '100%', maxWidth: '100%' }}>
              <img src={block.content} alt={block.alt || ''} className="block max-h-[520px] w-full object-contain" />
            </figure>
          );
        }
        if (block.type === 'slide') {
          return (
            <div key={block.id} className="rounded-xl border border-primary-100 bg-[#f7f9fb] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-surface-200 pb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bluewood-300">{block.kicker || block.label || 'SLIDE'}</p>
                  <h3 className="mt-1 break-words text-[17px] font-extrabold leading-snug text-bluewood-900">{block.title || block.label}</h3>
                </div>
                {block.slideKey && <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-primary-600 ring-1 ring-primary-100">{block.slideKey}</span>}
              </div>
              {block.subtitle && <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-bluewood-600">{block.subtitle}</p>}
              {block.content && <p className="mt-3 whitespace-pre-wrap break-words text-[12px] leading-[1.7] text-bluewood-500">{block.content}</p>}
              {block.cards?.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {block.cards.slice(0, 2).map((card, index) => (
                    <div key={index} className="border-l-[3px] border-primary-500 bg-white px-3 py-2 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-bluewood-300">{card.label || 'POINT'}</p>
                      <p className="mt-1 text-[12px] font-extrabold leading-snug text-bluewood-900">{card.title}</p>
                      {card.body && <p className="mt-1 text-[11px] leading-relaxed text-bluewood-500">{card.body}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return <p key={block.id} className="whitespace-pre-wrap break-words text-[13px] leading-[1.75] text-bluewood-700">{sanitizeTextValue(block.content)}</p>;
      })}
    </div>
  );
}

function PortfolioSlideDeck({ blocks = [], compact = false }) {
  const slides = blocks.map(normalizePortfolioBlock).filter(block => block?.type === 'slide');
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    if (activeIdx > Math.max(slides.length - 1, 0)) setActiveIdx(Math.max(slides.length - 1, 0));
  }, [activeIdx, slides.length]);
  if (slides.length === 0) return null;

  const slide = slides[activeIdx] || slides[0];
  const go = (dir) => setActiveIdx(prev => (prev + dir + slides.length) % slides.length);

  return (
    <div className="rounded-xl border border-primary-100 bg-[#f7f9fb] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-surface-200 pb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bluewood-300">{slide.kicker || slide.label || 'SLIDE'}</p>
          <h3 className="mt-1 break-words text-[17px] font-extrabold leading-snug text-bluewood-900">{slide.title || slide.label}</h3>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button type="button" onClick={event => { event.stopPropagation(); go(-1); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-bluewood-500 ring-1 ring-surface-200 hover:bg-primary-50 hover:text-primary-600" aria-label="이전 슬라이드">
            <ChevronLeft size={15} />
          </button>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-primary-600 ring-1 ring-primary-100">{activeIdx + 1}/{slides.length}</span>
          <button type="button" onClick={event => { event.stopPropagation(); go(1); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-bluewood-500 ring-1 ring-surface-200 hover:bg-primary-50 hover:text-primary-600" aria-label="다음 슬라이드">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      {slide.subtitle && <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-bluewood-600">{slide.subtitle}</p>}
      {slide.content && <p className={`${compact ? 'line-clamp-6' : ''} mt-3 whitespace-pre-wrap break-words text-[12px] leading-[1.7] text-bluewood-500`}>{slide.content}</p>}
      {slide.cards?.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {slide.cards.slice(0, compact ? 2 : 3).map((card, index) => (
            <div key={index} className="border-l-[3px] border-primary-500 bg-white px-3 py-2 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-bluewood-300">{card.label || 'POINT'}</p>
              <p className="mt-1 break-words text-[12px] font-extrabold leading-snug text-bluewood-900">{card.title}</p>
              {card.body && <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-bluewood-500">{card.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 핵심 경험 슬라이드 (미리보기 전용 서브 컴포넌트) ── */
function PreviewKeySlides({ keyExperiences }) {
  const [slideIdx, setSlideIdx] = useState(0);
  if (!keyExperiences || keyExperiences.length === 0) return null;
  const ke = keyExperiences[Math.min(slideIdx, keyExperiences.length - 1)];
  return (
    <div className="mb-8">
      <h2 className="text-[14px] font-bold uppercase tracking-widest text-bluewood-400 border-b border-surface-200 pb-2 mb-4">핵심 경험 &amp; 성과</h2>
      <div className="bg-surface-50 border border-surface-200 rounded-xl overflow-hidden">
        <div className="p-5">
          {ke.title && <p className="text-[14px] font-bold text-primary-600 mb-3">{ke.title}</p>}
          {(ke.metric || ke.afterMetric) && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-surface-100 rounded-lg border border-surface-200">
              {ke.beforeMetric && (
                <>
                  <span className="text-[13px] text-bluewood-400">{ke.metricLabel || ''}</span>
                  <span className="text-[14px] font-bold text-bluewood-500">{ke.beforeMetric}</span>
                  <span className="text-bluewood-300 text-sm">→</span>
                </>
              )}
              <span className="text-[22px] font-extrabold text-primary-600">{ke.afterMetric || ke.metric}</span>
              {!ke.beforeMetric && ke.metricLabel && <span className="text-[14px] text-bluewood-400">{ke.metricLabel}</span>}
            </div>
          )}
          {ke.situation && <p className="text-[13px] text-bluewood-500 leading-relaxed mb-1"><span className="font-semibold text-bluewood-600">상황 </span>{ke.situation}</p>}
          {ke.action && <p className="text-[13px] text-bluewood-500 leading-relaxed mb-1"><span className="font-semibold text-bluewood-600">액션 </span>{ke.action}</p>}
          {ke.result && <p className="text-[13px] text-bluewood-500 leading-relaxed"><span className="font-semibold text-bluewood-600">결과 </span>{ke.result}</p>}
          {ke.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {ke.keywords.map((kw, i) => <span key={i} className="px-2 py-0.5 bg-surface-100 text-bluewood-600 rounded text-[13px] font-medium">{kw}</span>)}
            </div>
          )}
        </div>
        {keyExperiences.length > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-surface-200 bg-white">
            <button onClick={() => setSlideIdx(i => Math.max(0, i - 1))} disabled={slideIdx === 0}
              className="text-[14px] text-bluewood-400 hover:text-bluewood-700 disabled:opacity-30 px-2 py-1">◀ 이전</button>
            <span className="text-[13px] text-bluewood-300">{slideIdx + 1} / {keyExperiences.length}</span>
            <button onClick={() => setSlideIdx(i => Math.min(keyExperiences.length - 1, i + 1))} disabled={slideIdx === keyExperiences.length - 1}
              className="text-[14px] text-bluewood-400 hover:text-bluewood-700 disabled:opacity-30 px-2 py-1">다음 ▶</button>
          </div>
        )}
      </div>
    </div>
  );
}

// 하이라이트 색상 매핑 (밑줄 스타일)
const highlightColors = {
  core:    { underline: '#ef4444', bg: 'bg-red-50',   label: '핵심 역량', desc: '이 경험에서 발휘된 핵심 역량입니다',       dot: 'bg-red-400',   text: 'text-red-700'   },
  derived: { underline: '#f59e0b', bg: 'bg-amber-50', label: '파생 역량', desc: '핵심 역량에서 파생된 부가적인 역량입니다', dot: 'bg-amber-400', text: 'text-amber-700' },
  growth:  { underline: '#22c55e', bg: 'bg-green-50', label: '성장 관점', desc: '이 경험을 통해 성장하거나 배운 내용입니다', dot: 'bg-green-400', text: 'text-green-700' },
};

const SECTION_KEYS = ['intro', 'overview', 'task', 'process', 'output', 'growth', 'competency'];
const SECTION_COUNT = SECTION_KEYS.length;

const SECTION_META = {
  intro:      { num: '01', label: '프로젝트 소개', subtitle: '서비스 이름 or 프로젝트 특징 + 소개 한 줄', accent: 'primary', accentHex: '#6366f1' },
  overview:   { num: '02', label: '프로젝트 개요', subtitle: '배경과 목적', accent: 'primary', accentHex: '#0ea5e9' },
  task:       { num: '03', label: '진행한 일', subtitle: '배경-문제-(핵심)-해결', accent: 'primary', accentHex: '#f59e0b' },
  process:    { num: '04', label: '과정', subtitle: '나의 직접적인 액션 + 인사이트', accent: 'primary', accentHex: '#8b5cf6' },
  output:     { num: '05', label: '결과물', subtitle: '최종으로 진행한 내용 + 포인트', accent: 'primary', accentHex: '#10b981' },
  growth:     { num: '06', label: '성장한 점', subtitle: '성과가 있는 경우: 성과 / 없는 경우: 배운 점', accent: 'primary', accentHex: '#f43f5e' },
  competency: { num: '07', label: '나의 역량', subtitle: '입사 시 기여할 수 있는 부분', accent: 'primary', accentHex: '#0d9488' },
};

/* ── 역량 키워드 카테고리 스타일 ── */
const KW_CATEGORY_STYLES = {
  tech:       { dot: '#0284c7', bg: 'bg-sky-50',      text: 'text-sky-700',      border: 'border-sky-200',     label: '기술'   },
  soft:       { dot: '#059669', bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200', label: '소통'   },
  leadership: { dot: '#7c3aed', bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200',  label: '리더십' },
  planning:   { dot: '#d97706', bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200',   label: '기획'   },
  default:    { dot: '#314157', bg: 'bg-surface-50',  text: 'text-bluewood-700',  border: 'border-surface-200', label: '역량'   },
};
const KW_CATEGORY_ORDER = ['tech', 'soft', 'leadership', 'planning', 'default'];

/* ── 역량 인사이트 카드 ──
   본문 하이라이트(type=핵심/파생/성장 + 근거 문장 + keywords)를 근거 중심 카드로 표시.
   숫자 게이지 없이 "어떤 역량이 어떻게 발휘됐고 무엇을 배웠는지"를 보여준다.
   - 핵심/파생/성장 그룹은 하이라이트 문장이 근거. 성장 그룹은 비면 learning/growth 텍스트로 보강.
   - top-level keywords(기술/JD)는 역량이 아니라 하단 "관련 키워드" 칩으로 분리. */
function CompetencyMeter({ highlights = [], keywords = [], keyExperiences = [], growthText = '' }) {
  const TYPE_ORDER = ['core', 'derived', 'growth'];
  const clean = (s) => stripMarkdown(String(s || '')).trim();
  const isDraft = (s) => !clean(s) || String(s).trim().startsWith('[작성 필요]');

  const cardsByType = { core: [], derived: [], growth: [] };
  const seen = { core: new Set(), derived: new Set(), growth: new Set() };
  const pushCard = (type, text, kws = []) => {
    const body = clean(text);
    if (!body) return;
    const sig = body.replace(/\s+/g, ' ').toLowerCase();
    if (seen[type].has(sig)) return;
    seen[type].add(sig);
    cardsByType[type].push({ body, keywords: (kws || []).map(clean).filter(Boolean) });
  };

  (highlights || []).forEach(h => {
    const t = TYPE_ORDER.includes(h.type) ? h.type : 'core';
    pushCard(t, h.text, h.keywords);
  });

  // 성장 관점 보강: 핵심경험 learning → 없으면 growth 섹션 문장
  (keyExperiences || []).forEach(ke => { if (!isDraft(ke.learning)) pushCard('growth', ke.learning); });
  if (cardsByType.growth.length === 0) splitSentences(growthText, 3).forEach(s => pushCard('growth', s));

  const relatedKeywords = [...new Set((keywords || []).map(clean).filter(Boolean))];

  const groups = TYPE_ORDER
    .map(t => ({ type: t, label: highlightColors[t].label, desc: highlightColors[t].desc, color: highlightColors[t].underline, cards: cardsByType[t] }))
    .filter(g => g.cards.length > 0);

  if (groups.length === 0 && relatedKeywords.length === 0) return null;

  return (
    <div className="border border-surface-100 rounded-[8px] overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-100">
        <span className="px-2.5 py-1 bg-bluewood-800 text-white rounded-md text-[13px] font-bold tracking-wide uppercase">능력치</span>
        <span className="text-[14px] font-semibold text-bluewood-700">역량 인사이트</span>
        <span className="text-[14px] text-bluewood-300 ml-1">— 이 경험에서 발휘한 역량과 배운 점</span>
      </div>

      {groups.length > 0 && (
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
          {groups.map(g => (
            <div key={g.type}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-[13px] font-bold text-bluewood-700">{g.label}</span>
                <span className="text-[12px] text-bluewood-300">{g.cards.length}</span>
              </div>
              <p className="text-[12px] text-bluewood-300 mb-3 leading-snug">{g.desc}</p>
              <div className="space-y-2.5">
                {g.cards.map((c, i) => (
                  <div key={i} className="rounded-[6px] bg-surface-50/70 border-l-[3px] px-3.5 py-2.5" style={{ borderColor: g.color }}>
                    {c.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {c.keywords.map((k, ki) => (
                          <span key={ki} className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: `${g.color}14`, color: g.color }}>{k}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-[13px] text-bluewood-700 leading-[1.7]" style={{ wordBreak: 'keep-all' }}>{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {relatedKeywords.length > 0 && (
        <div className="px-6 py-4 border-t border-surface-100 bg-surface-50/30">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-bluewood-400 mb-2">관련 키워드 · 기술 스택</p>
          <div className="flex flex-wrap gap-1.5">
            {relatedKeywords.map((k, i) => (
              <span key={i} className="px-2.5 py-1 rounded-full text-[12px] font-medium bg-white border border-surface-200 text-bluewood-600">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function pickSectionFields(obj) {
  const result = {};
  for (const key of SECTION_KEYS) {
    const val = obj?.[key];
    result[key] = typeof val === 'string' ? sanitizeTextValue(val) : '';
  }
  return result;
}

function normalizeMarketResearch(value) {
  const src = value || {};
  return {
    marketOverview: typeof src.marketOverview === 'string' ? src.marketOverview : '',
    decisionMetrics: Array.isArray(src.decisionMetrics) ? src.decisionMetrics.map(item => ({
      metric: item?.metric || '',
      whyItMatters: item?.whyItMatters || '',
      recommendedProxy: item?.recommendedProxy || '',
      researchBasis: item?.researchBasis || '',
      confidence: item?.confidence || 'medium',
    })) : [],
    sourceNotes: Array.isArray(src.sourceNotes) ? src.sourceNotes.map(item => ({
      title: item?.title || '',
      publisher: item?.publisher || '',
      url: item?.url || '',
      checkedAt: item?.checkedAt || '',
      usage: item?.usage || '',
    })) : [],
    portfolioAngles: Array.isArray(src.portfolioAngles) ? src.portfolioAngles : [],
    limitations: typeof src.limitations === 'string' ? src.limitations : '',
  };
}

const SECTION_SLIDE_DEFAULTS = {
  intro:      { kicker: 'BACKGROUND',  prompt: '이 프로젝트는 어떤 문제에서 시작됐을까요?' },
  overview:   { kicker: 'RESEARCH',    prompt: '왜 지금 이 프로젝트가 필요했을까요?' },
  task:       { kicker: 'PROBLEM',     prompt: '내가 직접 해결해야 했던 핵심 과제는 무엇이었을까요?' },
  process:    { kicker: 'ACTION',      prompt: '어떤 판단과 액션으로 문제에 접근했을까요?' },
  output:     { kicker: 'OUTCOME',     prompt: '최종적으로 무엇이 달라졌을까요?' },
  growth:     { kicker: 'INSIGHT',     prompt: '이 경험은 어떤 관점을 바꾸었을까요?' },
  competency: { kicker: 'CAPABILITY',  prompt: '이 경험은 어떤 기여 역량으로 이어질까요?' },
};

function splitSentences(text, limit = 3) {
  const clean = stripMarkdown(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?。！？\n]+[.!?。！？]?/g) || [clean];
  return parts.map(s => s.trim()).filter(Boolean).slice(0, limit);
}

function extractMetricToken(text) {
  const match = String(text || '').match(/\d+[\d,.]*\s*(?:%|배|ms|초|분|시간|일|주|개월|년|개|건|명|원|만원|억|회|점)/);
  return match?.[0] || '';
}

function makeSlideCard(label, title, body, metric = '') {
  return {
    label,
    title,
    body: stripMarkdown(body || '').replace(/\s+/g, ' ').trim(),
    metric: metric || extractMetricToken(body),
  };
}

function buildFallbackCards({ key, content, research, keyExperiences, overview }) {
  const sentences = splitSentences(content, 3);
  const experiences = Array.isArray(keyExperiences) ? keyExperiences : [];
  const metrics = Array.isArray(research?.decisionMetrics) ? research.decisionMetrics : [];
  const firstExperience = experiences[0] || {};
  const firstMetric = metrics[0] || {};
  const secondMetric = metrics[1] || {};
  const projectScale = [overview?.scopeOfImpact, overview?.duration, overview?.team].filter(Boolean).join(' · ');
  const stackText = Array.isArray(overview?.techStack) ? overview.techStack.slice(0, 5).join(', ') : '';
  const firstSentence = sentences[0] || content || '';

  const bySection = {
    intro: [
      makeSlideCard('CONTEXT', '프로젝트 배경', overview?.background || firstSentence, extractMetricToken(overview?.background || firstSentence)),
      makeSlideCard('GOAL', '해결 목표', overview?.goal || sentences[1] || '[작성 필요]', ''),
      makeSlideCard('SCOPE', '진행 범위', projectScale || stackText || '[작성 필요]', extractMetricToken(projectScale)),
    ],
    overview: [
      makeSlideCard('MARKET', firstMetric.metric || '시장/사용자 맥락', research?.marketOverview || firstMetric.whyItMatters || firstSentence, firstMetric.confidence || extractMetricToken(research?.marketOverview)),
      makeSlideCard('METRIC', secondMetric.metric || '확인할 지표', secondMetric.recommendedProxy || firstMetric.recommendedProxy || '[검증 필요]', extractMetricToken(secondMetric.recommendedProxy || firstMetric.recommendedProxy) || secondMetric.confidence),
      makeSlideCard('ANGLE', '포트폴리오 관점', research?.portfolioAngles?.[0] || sentences[1] || '[작성 필요]', ''),
    ],
    task: [
      makeSlideCard('OWNERSHIP', '내가 맡은 과제', firstExperience.title || firstSentence, ''),
      makeSlideCard('CONTEXT', '문제 상황', firstExperience.context || sentences[1] || '[작성 필요]', extractMetricToken(firstExperience.context || sentences[1])),
      makeSlideCard('ROLE', '담당 역할', overview?.role || '[작성 필요]', ''),
    ],
    process: [
      makeSlideCard('ACTION', '실행한 행동', firstExperience.action || firstSentence, extractMetricToken(firstExperience.action || firstSentence)),
      makeSlideCard('DECISION', '의사결정 기준', firstMetric.whyItMatters || firstMetric.recommendedProxy || sentences[1] || '[작성 필요]', firstMetric.confidence),
      makeSlideCard('TRADE-OFF', '선택과 조정', sentences[2] || firstExperience.context || '[작성 필요]', ''),
    ],
    output: [
      makeSlideCard('IMPACT', '결과 변화', firstExperience.result || firstSentence, firstExperience.afterMetric || firstExperience.metric || extractMetricToken(firstExperience.result || firstSentence)),
      makeSlideCard('OUTPUT', '만든 산출물', sentences[1] || firstExperience.title || '[작성 필요]', extractMetricToken(sentences[1])),
      makeSlideCard('NEXT', '2차 효과', sentences[2] || '[검증 필요]', extractMetricToken(sentences[2])),
    ],
    growth: [
      makeSlideCard('INSIGHT', '새로 얻은 관점', firstExperience.learning || firstSentence, ''),
      makeSlideCard('CHANGE', '달라진 판단', sentences[1] || '[작성 필요]', ''),
      makeSlideCard('LEARNING', '다음에 적용할 점', sentences[2] || '[작성 필요]', ''),
    ],
    competency: [
      makeSlideCard('CAPABILITY', '발휘한 역량', sentences[0] || firstExperience.keywords?.join(', ') || '[작성 필요]', ''),
      makeSlideCard('VALUE', '입사 후 기여', sentences[1] || firstExperience.learning || '[작성 필요]', ''),
      makeSlideCard('PROOF', '근거 경험', firstExperience.title || overview?.role || '[작성 필요]', firstExperience.metric || firstExperience.afterMetric || ''),
    ],
  };

  const fallback = bySection[key] || sentences.map((sentence, index) => (
    makeSlideCard(['POINT', 'INSIGHT', 'DETAIL'][index] || 'POINT', index === 0 ? SECTION_META[key]?.label : '핵심 근거', sentence)
  ));

  const seen = new Set();
  return fallback
    .filter(item => item.body || item.title || item.metric)
    .filter(item => {
      const signature = `${item.label}|${item.title}|${item.body}`.replace(/\s+/g, ' ').toLowerCase();
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .slice(0, 3);
}

function normalizeSectionSlide({ key, content, structured, research, keyExperiences, overview }) {
  const fromAi = structured?.sectionSlides?.[key] || {};
  const defaults = SECTION_SLIDE_DEFAULTS[key] || {};
  const sentences = splitSentences(content, 4);
  const headline = fromAi.headline || sentences[0] || defaults.prompt || SECTION_META[key]?.label;
  const subcopy = fromAi.subcopy || sentences.slice(1, 4).join(' ') || content || '';
  const fallbackCards = buildFallbackCards({ key, content, research, keyExperiences, overview });
  const aiCards = Array.isArray(fromAi.evidenceCards) && fromAi.evidenceCards.length > 0
    ? fromAi.evidenceCards.slice(0, 3).map(card => ({
      label: card?.label || 'RESEARCH',
      title: card?.title || '핵심 근거',
      body: card?.body || '',
      metric: card?.metric || extractMetricToken(`${card?.title || ''} ${card?.body || ''}`),
    }))
    : [];
  const cardCandidates = fromAi._manual ? [...aiCards, ...fallbackCards] : [...fallbackCards, ...aiCards];
  const cards = cardCandidates
    .filter(item => item.body || item.title || item.metric)
    .reduce((acc, item) => {
      const signature = `${item.label}|${item.title}|${item.body}`.replace(/\s+/g, ' ').toLowerCase();
      if (!acc.seen.has(signature)) {
        acc.seen.add(signature);
        acc.items.push(item);
      }
      return acc;
    }, { seen: new Set(), items: [] }).items
    .slice(0, 3);
  return {
    kicker: fromAi.kicker || defaults.kicker || 'BACKGROUND',
    // 잘림(…) 없이 전체 표시 — 한 화면에 다 보이도록 (스크롤 X)
    headline: stripMarkdown(headline).replace(/\s+/g, ' ').trim(),
    subcopy: stripMarkdown(subcopy).replace(/\s+/g, ' ').trim(),
    cards,
  };
}

function PortfolioSectionSlide({
  sectionKey,
  meta,
  value,
  overview,
  onOverviewChange,
  slide,
  isEditing,
  viewOnly,
  field,
  structured,
  editedKeywords,
  onChange,
  onSlideFieldChange,
  onSlideCardChange,
  onEdit,
  onDone,
  imageProps,
  onAddImage,
  uploadingImage,
  dragInfo,
  dropTarget,
  setDropTarget,
  handleSectionDrop,
}) {
  const isDraft = value?.trim()?.startsWith('[작성 필요]');
  const cleanValue = sanitizeTextValue(value || '');
  const cleanHeadline = sanitizeTextValue(slide.headline || '');
  const cleanSubcopy = sanitizeTextValue(slide.subcopy || '');
  const headlineRows = Math.max(3, Math.min(6, Math.ceil(Math.max(cleanHeadline.length, 1) / 22)));
  const subcopyRows = Math.max(2, Math.min(5, Math.ceil(Math.max(cleanSubcopy.length, 1) / 70)));
  const displayValue = isDraft ? cleanValue.replace(/^\[작성 필요\]\s*/, '').trim() : cleanValue;
  const visibleCards = slide.cards.slice(0, 3);
  const hiddenCardCount = Math.max(0, slide.cards.length - visibleCards.length);
  const accent = '#002F6C'; // 사이트 기본(네이비) — 색상 통일
  const introMetaItems = sectionKey === 'intro'
    ? [
      { key: 'duration', label: '기간', placeholder: '2024.01 - 2024.06' },
      { key: 'role', label: '역할', placeholder: '기획/개발/운영 담당' },
      { key: 'team', label: '팀 구성', placeholder: '개발 3명, 디자인 1명' },
      { key: 'scopeOfImpact', label: '영향 범위', placeholder: '사용자/팀/비즈니스 범위' },
      { key: 'goal', label: '목표', placeholder: '프로젝트의 핵심 목표' },
    ]
    : [];

  return (
    <div className="relative bg-white">
      <div className="relative mx-auto max-w-[1180px] px-5 py-5 lg:px-6 lg:py-6">
        <div className="relative overflow-hidden rounded-[14px] border border-surface-200 bg-white shadow-[0_10px_40px_rgba(49,65,87,0.08)]">
          <div className="h-1 w-full" style={{ backgroundColor: accent }} />
          <div className="relative flex min-h-[460px] flex-col px-8 py-7 lg:px-10 lg:py-9">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                {viewOnly ? (
                  <p className="mb-4 text-[10px] font-black uppercase tracking-[0.18em] text-bluewood-500">{sanitizeTextValue(slide.kicker)}</p>
                ) : (
                  <input
                    value={sanitizeTextValue(slide.kicker || '')}
                    onChange={e => onSlideFieldChange?.(sectionKey, 'kicker', e.target.value.toUpperCase())}
                    className="mb-4 w-full max-w-[220px] bg-transparent text-[10px] font-black uppercase tracking-[0.18em] text-bluewood-500 outline-none placeholder:text-bluewood-300 focus:bg-white/60"
                    placeholder="KICKER"
                  />
                )}
                <div className="flex items-start gap-4">
                  <span className="mt-1 h-14 w-[3px] flex-shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                  <div className="min-w-0">
                    {viewOnly ? (
                      <h3 className="max-w-[780px] break-words text-[25px] font-extrabold leading-[1.28] tracking-normal text-bluewood-900 lg:text-[30px]">
                        {sanitizeTextValue(slide.headline)}
                      </h3>
                    ) : (
                      <textarea
                        rows={headlineRows}
                        value={cleanHeadline}
                        onChange={e => onSlideFieldChange?.(sectionKey, 'headline', e.target.value)}
                        className="w-full max-w-[780px] resize-y overflow-y-auto break-words bg-transparent text-[25px] font-extrabold leading-[1.28] tracking-normal text-bluewood-900 outline-none placeholder:text-bluewood-300 focus:bg-white/60 lg:text-[30px]"
                        placeholder="슬라이드 제목"
                      />
                    )}
                    {(cleanSubcopy || !viewOnly) && (
                      viewOnly ? (
                        <p className="mt-4 max-w-[820px] break-words text-[13px] font-medium leading-[1.65] text-bluewood-600">
                          {renderMarkdown(cleanSubcopy)}
                        </p>
                      ) : (
                        <textarea
                          rows={subcopyRows}
                          value={cleanSubcopy}
                          onChange={e => onSlideFieldChange?.(sectionKey, 'subcopy', e.target.value)}
                          className="mt-4 w-full max-w-[820px] resize-y overflow-y-auto break-words bg-transparent text-[13px] font-medium leading-[1.65] text-bluewood-600 outline-none placeholder:text-bluewood-300 focus:bg-white/60"
                          placeholder="슬라이드 설명"
                        />
                      )
                    )}
                  </div>

                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2 text-right">
                <span className="rounded-full px-3 py-1 text-[11px] font-black text-white" style={{ backgroundColor: accent }}>{meta.num}</span>
                <span className="max-w-[160px] text-[12px] font-bold leading-snug text-bluewood-400">{meta.label}</span>
                {!viewOnly && (
                  <button
                    onClick={onAddImage}
                    disabled={uploadingImage}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-white/80 px-3 py-1.5 text-[12px] font-bold text-bluewood-500 shadow-sm hover:bg-white disabled:opacity-50 transition-colors"
                  >
                    {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                    사진 추가
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid min-h-0 flex-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 flex-col">
                  <div className={`rounded-[10px] border border-surface-200 bg-surface-50/50 p-5 ${isEditing ? 'ring-1 ring-primary-100' : ''}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>DETAIL</p>
                      {!viewOnly && <span className="text-[11px] font-bold text-primary-500">바로 수정 가능</span>}
                    </div>
                    {!viewOnly ? (
                      <textarea
                        value={cleanValue}
                        onChange={e => onChange(e.target.value)}
                        placeholder={field?.placeholder || '내용을 입력하세요'}
                        rows={8}
                        className="min-h-[180px] w-full resize-y overflow-y-auto break-words bg-transparent text-[13px] leading-[1.8] text-bluewood-700 outline-none placeholder:text-bluewood-300 focus:bg-white/50"
                      />
                    ) : displayValue ? (
                      <div className="break-words text-[14px] leading-[1.85] text-bluewood-700 whitespace-pre-wrap">
                        <HighlightedText
                          text={displayValue}
                          highlights={(structured.highlights || []).filter(h => h.field === sectionKey)}
                          keywords={editedKeywords}
                          showKeywordUnderline={true}
                        />
                      </div>
                    ) : (
                      <button onClick={onEdit} className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-surface-300 py-10 text-[13px] font-semibold text-bluewood-400 hover:bg-surface-50 transition-colors">
                        <PenLine size={14} /> 빈칸 채우기
                      </button>
                    )}
                    {introMetaItems.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-surface-200/70 pt-3 lg:grid-cols-3">
                        {introMetaItems.map(item => (
                          <div key={item.label} className="rounded-[6px] bg-white/75 px-2.5 py-2 ring-1 ring-surface-200/80">
                            <p className="text-[10px] font-black tracking-[0.12em] text-bluewood-300">{item.label}</p>
                            {viewOnly ? (
                              <p className="mt-1 break-words text-[12px] font-bold leading-snug text-bluewood-700">{sanitizeTextValue(overview?.[item.key] || item.placeholder)}</p>
                            ) : (
                              <textarea
                                rows={2}
                                value={sanitizeTextValue(overview?.[item.key] || '')}
                                onChange={e => onOverviewChange?.(item.key, sanitizeTextValue(e.target.value))}
                                placeholder={item.placeholder}
                                className="mt-1 min-h-[40px] w-full resize-y overflow-y-auto break-words bg-transparent text-[11px] font-bold leading-snug text-bluewood-700 outline-none placeholder:text-bluewood-300"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <InlineSlideImages
                      sectionKey={sectionKey}
                      sectionImages={imageProps.sectionImages}
                      allImages={imageProps.allImages}
                      imageConfig={imageProps.imageConfig}
                      setImageConfig={imageProps.setImageConfig}
                      handleImageDelete={imageProps.handleImageDelete}
                      viewOnly={viewOnly}
                    />
                  </div>
              </div>

              <div className="flex min-h-0 flex-col gap-2.5">
                {visibleCards.length > 0 ? visibleCards.map((card, index) => (
                  <div key={index} className="min-h-0 rounded-r-[8px] border-l-[3px] bg-white px-3.5 py-3 shadow-sm ring-1 ring-surface-100" style={{ borderColor: accent }}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      {viewOnly ? (
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bluewood-300">{sanitizeTextValue(card.label || 'RESEARCH')}</p>
                      ) : (
                        <input
                          value={sanitizeTextValue(card.label || '')}
                          onChange={e => onSlideCardChange?.(sectionKey, index, 'label', e.target.value.toUpperCase(), card)}
                          className="w-24 bg-transparent text-[10px] font-black uppercase tracking-[0.16em] text-bluewood-300 outline-none placeholder:text-bluewood-200 focus:bg-white/70"
                          placeholder="LABEL"
                        />
                      )}
                    </div>
                    {viewOnly ? (
                      <p className="text-[13px] font-extrabold leading-snug text-bluewood-900">{sanitizeTextValue(card.title)}</p>
                    ) : (
                      <textarea
                        rows={2}
                        value={sanitizeTextValue(card.title || '')}
                        onChange={e => onSlideCardChange?.(sectionKey, index, 'title', e.target.value, card)}
                        className="w-full resize-y overflow-y-auto break-words bg-transparent text-[13px] font-extrabold leading-snug text-bluewood-900 outline-none placeholder:text-bluewood-300 focus:bg-white/70"
                        placeholder="카드 제목"
                      />
                    )}
                    {viewOnly && sanitizeTextValue(card.body) && (
                      <p className="mt-1.5 break-words text-[12px] font-medium leading-[1.55] text-bluewood-500">
                        {sanitizeTextValue(card.body)}
                      </p>
                    )}
                    {!viewOnly && (
                      <textarea
                        rows={4}
                        value={sanitizeTextValue(card.body || '')}
                        onChange={e => onSlideCardChange?.(sectionKey, index, 'body', e.target.value, card)}
                        className="mt-1.5 w-full resize-y overflow-y-auto break-words bg-transparent text-[11px] font-medium leading-[1.45] text-bluewood-500 outline-none placeholder:text-bluewood-300 focus:bg-white/70"
                        placeholder="근거/임팩트 설명"
                      />
                    )}
                  </div>
                )) : (
                  <div className="rounded-r-[8px] border-l-[3px] bg-white px-4 py-5 shadow-sm ring-1 ring-surface-100" style={{ borderColor: accent }}>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-bluewood-300">RESEARCH</p>
                    <p className="mt-2 text-[15px] font-extrabold text-bluewood-900">보강할 근거가 필요합니다</p>
                    <p className="mt-2 text-[12px] leading-[1.65] text-bluewood-500">시장 자료, 사용자 지표, 의사결정 기준을 추가하면 이 슬라이드가 더 설득력 있게 완성됩니다.</p>
                  </div>
                )}
                {hiddenCardCount > 0 && (
                  <div className="rounded-full border border-surface-200 bg-white/78 px-3 py-2 text-center text-[11px] font-bold text-bluewood-400 shadow-sm">
                    추가 근거 {hiddenCardCount}개는 디테일 노트에 반영됨
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-surface-200/80 pt-3">
              {dragInfo && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDropTarget(sectionKey); }}
                  onDragLeave={() => { if (dropTarget === sectionKey) setDropTarget(null); }}
                  onDrop={(e) => handleSectionDrop(e, sectionKey)}
                  className={`mt-2 rounded-lg border-2 border-dashed py-3 text-center text-[13px] font-semibold transition-colors ${
                    dropTarget === sectionKey ? 'border-bluewood-400 bg-bluewood-50/60 text-bluewood-500' : 'border-surface-200 text-bluewood-300'
                  }`}
                >
                  {dragInfo.fromSection === sectionKey ? '끝으로 이동' : '여기로 이미지 이동'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SLIDE_IMAGE_SIZES = [
  { value: 'sm', label: 'S', width: 10 },
  { value: 'md', label: 'M', width: 16 },
  { value: 'lg', label: 'L', width: 24 },
];

const INLINE_IMAGE_SIZES = {
  sm: { label: 'S', width: '34%', minWidth: 140 },
  md: { label: 'M', width: '58%', minWidth: 220 },
  lg: { label: 'L', width: '100%', minWidth: 260 },
};

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function InlineSlideImages({ sectionKey, sectionImages, allImages, imageConfig, setImageConfig, handleImageDelete, viewOnly }) {
  const imgIndices = sectionImages?.[sectionKey] || [];
  const images = imgIndices.map(imgIdx => ({ imgIdx, img: allImages?.[imgIdx] })).filter(item => item.img);
  if (images.length === 0) return null;

  const cycleSize = (cfgKey, currentSize) => {
    const order = Object.keys(INLINE_IMAGE_SIZES);
    const idx = order.indexOf(currentSize || 'lg');
    const next = order[(idx + 1) % order.length];
    setImageConfig(prev => ({
      ...prev,
      [cfgKey]: { ...(prev[cfgKey] || {}), size: next },
    }));
  };

  return (
    <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-surface-200/70 pt-4">
      {images.map(({ imgIdx, img }) => {
        const cfgKey = `${sectionKey}:${imgIdx}`;
        const cfg = imageConfig?.[cfgKey] || {};
        const sizeKey = cfg.size || 'lg';
        const size = INLINE_IMAGE_SIZES[sizeKey] || INLINE_IMAGE_SIZES.lg;

        return (
          <figure
            key={cfgKey}
            className="group relative overflow-hidden rounded-[8px] border border-surface-200 bg-white shadow-sm"
            style={{ width: size.width, minWidth: size.minWidth, maxWidth: '100%' }}
          >
            <img src={img.url} alt={img.name || '이미지'} className="block max-h-[360px] w-full object-contain" />
            {!viewOnly && (
              <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => cycleSize(cfgKey, sizeKey)}
                  className="rounded bg-black/65 px-2 py-1 text-[11px] font-black text-white hover:bg-black/80"
                  title="사진 크기 변경"
                >
                  {size.label}
                </button>
                <button
                  type="button"
                  onClick={() => handleImageDelete(imgIdx)}
                  className="rounded bg-red-500/85 p-1.5 text-white hover:bg-red-600"
                  title="사진 삭제"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </figure>
        );
      })}
    </div>
  );
}

function SlideImageLayer({ sectionKey, sectionImages, allImages, imageConfig, setImageConfig, handleImageDelete }) {
  const layerRef = useRef(null);
  const [moving, setMoving] = useState(null);
  const imgIndices = sectionImages[sectionKey] || [];

  useEffect(() => {
    if (!moving) return undefined;
    const onMove = (event) => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const widthPct = moving.widthPct || 16;
      const x = clampNumber(((event.clientX - rect.left - moving.offsetX) / rect.width) * 100, 2, 98 - widthPct);
      const y = clampNumber(((event.clientY - rect.top - moving.offsetY) / rect.height) * 100, 7, 84);
      setImageConfig(prev => ({
        ...prev,
        [moving.cfgKey]: { ...(prev[moving.cfgKey] || {}), x, y },
      }));
    };
    const onUp = () => setMoving(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [moving, setImageConfig]);

  if (imgIndices.length === 0) return null;

  const cycleSize = (cfgKey, currentSize) => {
    const idx = SLIDE_IMAGE_SIZES.findIndex(size => size.value === currentSize);
    const next = SLIDE_IMAGE_SIZES[(idx + 1) % SLIDE_IMAGE_SIZES.length];
    setImageConfig(prev => ({
      ...prev,
      [cfgKey]: { ...(prev[cfgKey] || {}), size: next.value },
    }));
  };

  return (
    <div ref={layerRef} className="absolute inset-0 z-20 pointer-events-none">
      {imgIndices.map((imgIdx, index) => {
        const img = allImages[imgIdx];
        if (!img) return null;
        const cfgKey = `${sectionKey}:${imgIdx}`;
        const cfg = imageConfig[cfgKey] || {};
        const size = SLIDE_IMAGE_SIZES.find(item => item.value === (cfg.size || 'md')) || SLIDE_IMAGE_SIZES[1];
        const left = cfg.x ?? (7 + (index % 3) * 13);
        const top = cfg.y ?? (67 + Math.floor(index / 3) * 10);

        return (
          <div
            key={`slide-img-${sectionKey}-${imgIdx}`}
            className="group absolute pointer-events-auto select-none"
            style={{ left: `${left}%`, top: `${top}%`, width: `${size.width}%` }}
          >
            <div
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setMoving({ cfgKey, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, widthPct: size.width });
              }}
              className="relative cursor-grab active:cursor-grabbing rounded-[8px] border border-white/90 bg-white/80 p-1 shadow-[0_12px_28px_rgba(49,65,87,0.18)] backdrop-blur-sm"
            >
              <img src={img.url} alt={img.name || '이미지'} className="block w-full rounded-[6px] object-cover" />
              <div className="absolute left-1 top-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded bg-black/60 p-1"><GripVertical size={12} className="text-white" /></span>
              </div>
              <div className="absolute right-1 top-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); cycleSize(cfgKey, size.value); }}
                  className="rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-black text-white hover:bg-black/80"
                >
                  {size.label}
                </button>
                <button
                  onMouseDown={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); handleImageDelete(imgIdx); }}
                  className="rounded bg-red-500/85 p-1 text-white hover:bg-red-600"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StructuredResult() {
  const { id } = useParams();
  const { state: navState } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewOnly = searchParams.get('view') === 'true';
  const { user } = useAuthStore();
  const [experience, setExperience] = useState(null);
  const [loading, setLoading] = useState(!navState?.analysis);
  const [saving, setSaving] = useState(false);
  const [editedContent, setEditedContent] = useState({});
  const [editingSections, setEditingSections] = useState({});
  const [editedTitle, setEditedTitle] = useState('');
  const [editedOverview, setEditedOverview] = useState({ background: '', goal: '', role: '', team: '', duration: '', summary: '', scopeOfImpact: '', techStack: [] });
  const [editedSectionSlides, setEditedSectionSlides] = useState({});
  const [editedResearch, setEditedResearch] = useState(() => normalizeMarketResearch());
  const [editedKeywords, setEditedKeywords] = useState([]);
  const [editedKeyExperiences, setEditedKeyExperiences] = useState([]);
  const [newTechInput, setNewTechInput] = useState('');
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [expandedSections, setExpandedSections] = useState(() => {
    const all = {};
    SECTION_KEYS.forEach(k => { all[k] = true; });
    return all;
  });
  const [allImages, setAllImages] = useState([]);
  const [sectionImages, setSectionImages] = useState({});
  const [dragInfo, setDragInfo] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);
  const [showQualityPanel, setShowQualityPanel] = useState(true);
  const [activeQualityId, setActiveQualityId] = useState('sections');
  const [imageConfig, setImageConfig] = useState({});
  const detailSlidesRef = useRef(null);
  const imageInputRef = useRef(null);
  const [imageUploadTarget, setImageUploadTarget] = useState('_unassigned');
  const sectionTextareaRefs = useRef({});
  // 핵심 경험 슬라이더 ref & 동기화 state
  const sliderRef = useRef(null);
  const [sliderEditing, setSliderEditing] = useState(false);
  const [sliderCurrent, setSliderCurrent] = useState(0);
  const [sliderDeletedCount, setSliderDeletedCount] = useState(0);
  const [sectionSlideIdx, setSectionSlideIdx] = useState(0);

  /* ── 역량 키워드 커스터마이징 ── */
  const [newKeywordIdx, setNewKeywordIdx] = useState(null);     // 팝인 애니메이션 대상 인덱스
  const [kwDragIdx, setKwDragIdx] = useState(null);             // 드래그 중인 키워드 인덱스
  const [kwOverIdx, setKwOverIdx] = useState(null);             // 드롭 대상 인덱스
  const [keywordCategories, setKeywordCategories] = useState({}); // keyword → 카테고리 key
  const [flashedSection, setFlashedSection] = useState(null);   // 섹션 완성 피드백

  /* ── 직군 특화 섹션 ── */
  const [jobCategory, setJobCategory] = useState('common');
  const [editedJobSpecific, setEditedJobSpecific] = useState({});
  const [editingJobSections, setEditingJobSections] = useState({});

  /* ── 포트폴리오 내보내기 커스텀 패널 ── */
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportEnabled, setExportEnabled] = useState({});
  const [exportOrder, setExportOrder] = useState([]);
  const [exportCustomSections, setExportCustomSections] = useState([]);
  const [activeExportSectionKey, setActiveExportSectionKey] = useState(null);
  const [exportCoverImg, setExportCoverImg] = useState(null);
  const [exportDragKey, setExportDragKey] = useState(null);
  const [exportOverKey, setExportOverKey] = useState(null);

  /* ── 프로젝트 타임라인용: 전체 경험 목록 로드 ── */
  const { experiences, fetchExperiences, undoEdit, redoEdit, canUndo, canRedo, pushEditSnapshot, researchMarketMetrics } = useExperienceStore();
  const [researchingMetrics, setResearchingMetrics] = useState(false);
  useEffect(() => {
    if (user?.uid && experiences.length === 0) fetchExperiences(user.uid);
  }, [user?.uid]);

  // 기업 분석 관련 state
  const [jobAnalysis, setJobAnalysis] = useState(null);
  const [jobUrl, setJobUrl] = useState('');
  const [analyzingJob, setAnalyzingJob] = useState(false);
  const [jobError, setJobError] = useState(null);
  const [showJobInput, setShowJobInput] = useState(false);

  useEffect(() => {
    if (navState?.analysis) {
      const structured = navState.analysis;
      setExperience({
        id,
        title: navState.title,
        framework: navState.framework,
        content: navState.content,
        structuredResult: structured,
        keywords: structured.keywords || [],
      });
      const fields = pickSectionFields(structured);
      setEditedContent(fields);
      setEditedTitle(navState.title || '');
      const normStack1 = structured.projectOverview?.techStack;
      setEditedOverview({
        background: sanitizeTextValue(structured.projectOverview?.background || ''),
        goal: sanitizeTextValue(structured.projectOverview?.goal || ''),
        role: sanitizeTextValue(structured.projectOverview?.role || ''),
        team: sanitizeTextValue(structured.projectOverview?.team || ''),
        duration: sanitizeTextValue(structured.projectOverview?.duration || ''),
        summary: sanitizeTextValue(structured.projectOverview?.summary || ''),
        scopeOfImpact: sanitizeTextValue(structured.projectOverview?.scopeOfImpact || ''),
        techStack: Array.isArray(normStack1) ? normStack1 : (normStack1 ? String(normStack1).split(',').map(s => s.trim()).filter(Boolean) : []),
      });
      setEditedResearch(normalizeMarketResearch(structured.marketResearch));
      setEditedSectionSlides(structured.sectionSlides || {});
      setEditedKeywords(structured.keywords || []);
      setEditedKeyExperiences((structured.keyExperiences || []).map(e => ({ ...e })));
      setJobCategory(structured.jobCategory || 'common');
      setEditedJobSpecific(structured.jobSpecific || {});
      if (!viewOnly) {
        // 비어있거나 아니거나 모든 섹션을 즐시 편집 모드로
        const autoEdit = {};
        SECTION_KEYS.forEach(k => { autoEdit[k] = true; });
        setEditingSections(autoEdit);
      }
      // Load images & jobAnalysis from Firestore (navState doesn't include them)
      if (!navState.isTutorialDemo) (async () => {
        try {
          const docSnap = await getDoc(doc(db, 'experiences', id));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const imgs = data.images || [];
            setAllImages(imgs);
            setSectionImages(data.sectionImages || { _unassigned: imgs.map((_, i) => i) });
            setImageConfig(data.imageConfig || {});
            setJobAnalysis(data.jobAnalysis || null);
            if (data.jobCategory) setJobCategory(data.jobCategory);
          }
        } catch (err) {
          console.error('이미지 로딩 실패:', err);
        }
      })();
    } else {
      loadExperience();
    }
  }, [id]);

  const loadExperience = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'experiences', id));
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setExperience(data);
        setJobAnalysis(data.jobAnalysis || null);
        const imgs = data.images || [];
        setAllImages(imgs);
        setSectionImages(data.sectionImages || { _unassigned: imgs.map((_, i) => i) });
        setImageConfig(data.imageConfig || {});
        const fields = pickSectionFields(data.structuredResult || data.content || {});
        setEditedContent(fields);
        const sr = data.structuredResult || {};
        setEditedTitle(data.title || '');
        const normStack2 = sr.projectOverview?.techStack;
        setEditedOverview({
          background: sanitizeTextValue(sr.projectOverview?.background || ''),
          goal: sanitizeTextValue(sr.projectOverview?.goal || ''),
          role: sanitizeTextValue(sr.projectOverview?.role || ''),
          team: sanitizeTextValue(sr.projectOverview?.team || ''),
          duration: sanitizeTextValue(sr.projectOverview?.duration || ''),
          summary: sanitizeTextValue(sr.projectOverview?.summary || ''),
          scopeOfImpact: sanitizeTextValue(sr.projectOverview?.scopeOfImpact || ''),
          techStack: Array.isArray(normStack2) ? normStack2 : (normStack2 ? String(normStack2).split(',').map(s => s.trim()).filter(Boolean) : []),
        });
        setEditedResearch(normalizeMarketResearch(sr.marketResearch));
        setEditedSectionSlides(sr.sectionSlides || {});
        setEditedKeywords(sr.keywords || data.keywords || []);
        setEditedKeyExperiences((sr.keyExperiences || []).map(e => ({ ...e })));
        setJobCategory(data.jobCategory || sr.jobCategory || 'common');
        setEditedJobSpecific(sr.jobSpecific || {});
        setExportCoverImg(sr.exportConfig?.coverImg || null);
        const savedExportSections = Array.isArray(sr.exportConfig?.draftSections) && sr.exportConfig.draftSections.length > 0
          ? sr.exportConfig.draftSections
          : sr.exportConfig?.sections;
        if (Array.isArray(savedExportSections) && savedExportSections.length > 0) {
          const savedSections = moveSlidesToStandaloneSection(savedExportSections.map((section, index) => ({
            key: section.key || `saved-${index}`,
            label: section.label || `섹션 ${index + 1}`,
            type: section.type || 'custom',
            content: sanitizeTextValue(section.content || ''),
            blocks: Array.isArray(section.blocks) ? section.blocks : (section.content ? [makeTextBlock(section.content)] : []),
            enabled: section.enabled !== false,
          })));
          setExportCustomSections(savedSections);
          setActiveExportSectionKey(savedSections.find(section => !isSlideDeckSection(section))?.key || savedSections[0]?.key || null);
        }
        if (!viewOnly) {
          // 모든 섹션 즉시 오픈 (딩칸/채워진 관계없이)
          const autoEdit = {};
          SECTION_KEYS.forEach(k => { autoEdit[k] = true; });
          setEditingSections(autoEdit);
        }
      }
    } catch (error) {
      console.error('경험 로딩 실패:', error);
    }
    setLoading(false);
  };

  const handleFieldChange = (key, value) => {
    const cleanValue = sanitizeTextValue(value);
    // 빈칸/초안 → 충분한 내용으로 완성될 때 섹션 완성 피드백
    const currentVal = editedContent[key];
    const wasEmpty = !currentVal?.trim() || currentVal.trim().startsWith('[작성 필요]');
    const isNowFilled = !!cleanValue.trim() && !cleanValue.trim().startsWith('[작성 필요]') && cleanValue.trim().length > 15;
    setEditedContent(prev => ({ ...prev, [key]: cleanValue }));
    if (wasEmpty && isNowFilled) {
      setFlashedSection(key);
      setTimeout(() => setFlashedSection(null), 1300);
    }
  };

  const handleSlideFieldChange = (sectionKey, field, value) => {
    const cleanValue = sanitizeTextValue(value);
    setEditedSectionSlides(prev => ({
      ...prev,
      [sectionKey]: {
        ...(prev[sectionKey] || {}),
        _manual: true,
        [field]: cleanValue,
      },
    }));
  };

  const handleSlideCardChange = (sectionKey, cardIndex, field, value, baseCard = {}) => {
    const cleanValue = sanitizeTextValue(value);
    setEditedSectionSlides(prev => {
      const currentSlide = prev[sectionKey] || {};
      const currentCards = Array.isArray(currentSlide.evidenceCards) ? currentSlide.evidenceCards : [];
      const nextCards = [...currentCards];
      nextCards[cardIndex] = { ...baseCard, ...(nextCards[cardIndex] || {}), [field]: cleanValue };
      return {
        ...prev,
        [sectionKey]: {
          ...currentSlide,
          _manual: true,
          evidenceCards: nextCards,
        },
      };
    });
  };

  const updateDecisionMetric = (index, field, value) => {
    setEditedResearch(prev => ({
      ...prev,
      decisionMetrics: prev.decisionMetrics.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const addDecisionMetric = () => {
    setEditedResearch(prev => ({
      ...prev,
      decisionMetrics: [...prev.decisionMetrics, { metric: '', whyItMatters: '', recommendedProxy: '', researchBasis: '', confidence: 'medium' }],
    }));
  };

  const removeDecisionMetric = (index) => {
    setEditedResearch(prev => ({
      ...prev,
      decisionMetrics: prev.decisionMetrics.filter((_, i) => i !== index),
    }));
  };

  const updateSourceNote = (index, field, value) => {
    setEditedResearch(prev => ({
      ...prev,
      sourceNotes: prev.sourceNotes.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  /* ── AI 시장/지표 리서치: 최신 자료 조사 → 기존 내용 보존 + 추천 추가 ── */
  const handleResearchMetrics = async () => {
    setResearchingMetrics(true);
    try {
      const res = await researchMarketMetrics({
        title: editedTitle,
        sections: editedContent,
        keywords: editedKeywords,
        projectOverview: editedOverview,
        jobCategory,
      });
      const norm = s => String(s || '').trim().toLowerCase();
      setEditedResearch(prev => {
        const metricKeys = new Set(prev.decisionMetrics.map(m => norm(m.metric)));
        const newMetrics = (res.decisionMetrics || []).filter(m => m.metric && !metricKeys.has(norm(m.metric)));
        const srcKeys = new Set(prev.sourceNotes.map(s => norm(s.url) || norm(s.title)));
        const newSources = (res.sourceNotes || []).filter(s => {
          const k = norm(s.url) || norm(s.title);
          return k && !srcKeys.has(k);
        });
        const angleKeys = new Set((prev.portfolioAngles || []).map(norm));
        const newAngles = (res.portfolioAngles || []).filter(a => a && !angleKeys.has(norm(a)));
        return {
          ...prev,
          marketOverview: prev.marketOverview?.trim() ? prev.marketOverview : (res.marketOverview || ''),
          decisionMetrics: [...prev.decisionMetrics, ...newMetrics],
          sourceNotes: [...prev.sourceNotes, ...newSources],
          portfolioAngles: [...(prev.portfolioAngles || []), ...newAngles],
          limitations: prev.limitations?.trim() ? prev.limitations : (res.limitations || ''),
        };
      });
      const added = (res.decisionMetrics || []).length;
      toast.success(added > 0 ? `AI가 의사결정 지표 ${added}개를 추천했습니다` : 'AI 리서치를 반영했습니다');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI 지표 추천에 실패했습니다');
    } finally {
      setResearchingMetrics(false);
    }
  };

  const toggleEditing = (key) => {
    setEditingSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── 역량 키워드 드래그-재정렬 ── */
  const handleKwDragEnd = () => {
    if (kwDragIdx != null && kwOverIdx != null && kwDragIdx !== kwOverIdx) {
      setEditedKeywords(prev => {
        const next = [...prev];
        const [moved] = next.splice(kwDragIdx, 1);
        next.splice(kwOverIdx, 0, moved);
        return next;
      });
    }
    setKwDragIdx(null);
    setKwOverIdx(null);
  };

  /* ── 역량 카테고리 사이클 ── */
  const cycleKwCategory = (k) => {
    setKeywordCategories(prev => {
      const cur = prev[k] || 'default';
      const idx = KW_CATEGORY_ORDER.indexOf(cur);
      return { ...prev, [k]: KW_CATEGORY_ORDER[(idx + 1) % KW_CATEGORY_ORDER.length] };
    });
  };

  const toggleExpand = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Image drag-and-drop
  const handleDragStart = (e, fromSection, position) => {
    setDragInfo({ fromSection, position });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragEnd = () => {
    setDragInfo(null);
    setDropTarget(null);
  };

  const handleSectionDrop = (e, toSection) => {
    e.preventDefault();
    if (!dragInfo) return;
    const { fromSection, position } = dragInfo;
    setSectionImages(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { next[k] = [...(prev[k] || [])]; });
      if (!next[fromSection]) next[fromSection] = [];
      if (!next[toSection]) next[toSection] = [];
      const [moved] = next[fromSection].splice(position, 1);
      next[toSection].push(moved);
      return next;
    });
    handleDragEnd();
  };

  const handleImageDrop = (e, toSection, toPosition) => {
    e.preventDefault();
    if (!dragInfo) return;
    const { fromSection, position: fromPos } = dragInfo;
    setSectionImages(prev => {
      const next = {};
      Object.keys(prev).forEach(k => { next[k] = [...(prev[k] || [])]; });
      if (!next[fromSection]) next[fromSection] = [];
      if (!next[toSection]) next[toSection] = [];
      const [moved] = next[fromSection].splice(fromPos, 1);
      let insertAt = toPosition;
      if (fromSection === toSection && fromPos < toPosition) insertAt--;
      next[toSection].splice(insertAt, 0, moved);
      return next;
    });
    handleDragEnd();
  };

  // 이미지 → Base64 변환 (Canvas 리사이즈 + 압축)
  const resizeToBase64 = (file, maxPx = 1200, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = url;
    });

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (allImages.length + files.length > 10) {
      toast.error('사진은 최대 10장까지 업로드할 수 있습니다');
      e.target.value = '';
      return;
    }
    setUploadingImage(true);
    try {
      const newImgs = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} 크기 초과 (10MB)`); continue; }
        const base64 = await resizeToBase64(file);
        newImgs.push({ url: base64, name: file.name });
      }
      if (newImgs.length > 0) {
        const startIdx = allImages.length;
        const updatedAll = [...allImages, ...newImgs];
        setAllImages(updatedAll);
        const targetKey = imageUploadTarget || '_unassigned';
        const targetImages = [...(sectionImages[targetKey] || []), ...newImgs.map((_, i) => startIdx + i)];
        const updatedSection = { ...sectionImages, [targetKey]: targetImages };
        const updatedImageConfig = { ...imageConfig };
        if (targetKey !== '_unassigned') {
          newImgs.forEach((_, i) => {
            updatedImageConfig[`${targetKey}:${startIdx + i}`] = { size: 'lg' };
          });
        }
        setSectionImages(updatedSection);
        setImageConfig(updatedImageConfig);
        const docRef = doc(db, 'experiences', id);
        await updateDoc(docRef, { images: updatedAll, sectionImages: updatedSection, imageConfig: updatedImageConfig, updatedAt: new Date() });
        toast.success(`${newImgs.length}장 업로드 완료`);
      }
    } catch (err) {
      console.error('이미지 업로드 실패:', err);
      toast.error('이미지 업로드 실패');
    }
    setUploadingImage(false);
    setImageUploadTarget('_unassigned');
    e.target.value = '';
  };

  const openSlideImagePicker = (sectionKey) => {
    setImageUploadTarget(sectionKey);
    imageInputRef.current?.click();
  };

  const handleImageDelete = async (imgIdx) => {
    const updatedAll = allImages.filter((_, i) => i !== imgIdx);
    const remap = (arr) => arr
      .filter(i => i !== imgIdx)
      .map(i => i > imgIdx ? i - 1 : i);
    const updatedSection = {};
    Object.entries(sectionImages).forEach(([k, v]) => { updatedSection[k] = remap(v); });
    const updatedImageConfig = {};
    Object.entries(imageConfig || {}).forEach(([key, value]) => {
      const [sectionKey, rawIdx] = key.split(':');
      const currentIdx = Number(rawIdx);
      if (!sectionKey || Number.isNaN(currentIdx) || currentIdx === imgIdx) return;
      const nextIdx = currentIdx > imgIdx ? currentIdx - 1 : currentIdx;
      updatedImageConfig[`${sectionKey}:${nextIdx}`] = value;
    });
    setAllImages(updatedAll);
    setSectionImages(updatedSection);
    setImageConfig(updatedImageConfig);
    try {
      const docRef = doc(db, 'experiences', id);
      await updateDoc(docRef, { images: updatedAll, sectionImages: updatedSection, imageConfig: updatedImageConfig, updatedAt: new Date() });
    } catch {}
  };

  // 기업 분석 핸들러
  const handleJobAnalyze = async () => {
    if (!jobUrl.trim()) return;
    setAnalyzingJob(true);
    setJobError(null);
    try {
      const respData = await analyzeJobUrl(jobUrl);
      const analysis = respData.analysis;
      setJobAnalysis(analysis);
      setShowJobInput(false);
      setJobUrl('');
      await updateDoc(doc(db, 'experiences', id), { jobAnalysis: analysis, updatedAt: new Date() });
      toast.success('기업 분석이 완료되었습니다');
    } catch (err) {
      setJobError(err.response?.data?.error || '분석에 실패했습니다');
    }
    setAnalyzingJob(false);
  };

  const handleRemoveJobAnalysis = async () => {
    setJobAnalysis(null);
    try {
      await updateDoc(doc(db, 'experiences', id), { jobAnalysis: null, updatedAt: new Date() });
    } catch {}
  };

  // 모든 섹션 지정 토글 — 빈칸은 자동 폈치되지 않음
  const handleStartEditing = (key) => {
    // 편집 시작 전 히스토리 스냅샷 저장
    if (!editingSections[key]) {
      pushEditSnapshot(id, {
        content: { ...editedContent },
        title: editedTitle,
        structuredResult: experience?.structuredResult,
      });
    }
    // 모든 섹션을 한 번에 편집 모드로 (사용자가 수정 버튼을 누른 의도 매쳩)
    setEditingSections(prev => {
      const allOn = {};
      SECTION_KEYS.forEach(k => { allOn[k] = true; });
      // 이미 모두 열려있으면 클릭한 � 하나만 토글
      const allAlreadyOpen = SECTION_KEYS.every(k => prev[k]);
      if (allAlreadyOpen) {
        return { ...prev, [key]: false };
      }
      // 아니면 모두 열기
      requestAnimationFrame(() => {
        const el = sectionTextareaRefs.current[key];
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
      return allOn;
    });
  };

  // 수정하기 시작 시 모든 섹션 오픈
  const openAllSections = () => {
    pushEditSnapshot(id, {
      content: { ...editedContent },
      title: editedTitle,
      structuredResult: experience?.structuredResult,
    });
    const allOn = {};
    SECTION_KEYS.forEach(k => { allOn[k] = true; });
    setEditingSections(allOn);
  };

  const handleUndo = () => {
    const snapshot = undoEdit(id);
    if (!snapshot) return;
    if (snapshot.content) setEditedContent(snapshot.content);
    if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
    toast('이전 내용으로 되돌렸습니다', { icon: '↩️' });
  };

  const handleRedo = () => {
    const snapshot = redoEdit(id);
    if (!snapshot) return;
    if (snapshot.content) setEditedContent(snapshot.content);
    if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
    toast('다시 실행했습니다', { icon: '↪️' });
  };

  // Ctrl+Z / Ctrl+Y 단축키 — handleUndo/handleRedo 정의 이후에 등록
  useEffect(() => {
    if (viewOnly) return;
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const snapshot = undoEdit(id);
        if (snapshot) {
          if (snapshot.content) setEditedContent(snapshot.content);
          if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
          toast('이전 내용으로 되돌렸습니다', { icon: '↩️' });
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const snapshot = redoEdit(id);
        if (snapshot) {
          if (snapshot.content) setEditedContent(snapshot.content);
          if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
          toast('다시 실행했습니다', { icon: '↪️' });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewOnly, id]);

  // ←/→ 화살표로 섹션 슬라이드 이동 (입력/수정 중에는 무시)
  useEffect(() => {
    const onArrow = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      setSectionSlideIdx(i => e.key === 'ArrowLeft'
        ? Math.max(0, i - 1)
        : Math.min(SECTION_COUNT - 1, i + 1));
    };
    window.addEventListener('keydown', onArrow);
    return () => window.removeEventListener('keydown', onArrow);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const sliderDraft = sliderRef.current?.saveEditing?.();
    const keyExperiencesForSave = Array.isArray(sliderDraft) ? sliderDraft : editedKeyExperiences;
    // 저장 전 현재 상태를 히스토리에 스냅샷 저장 → 저장 후에도 되돌리기 가능
    pushEditSnapshot(id, {
      content: { ...editedContent },
      title: editedTitle,
      structuredResult: experience?.structuredResult,
    });
    try {
      const ref = doc(db, 'experiences', id);
      const cleanEditedContent = sanitizeTextObject(editedContent);
      const cleanOverview = sanitizeTextObject(editedOverview);
      const cleanSectionSlides = Object.fromEntries(Object.entries(editedSectionSlides).map(([key, slide]) => [key, {
        ...slide,
        kicker: sanitizeTextValue(slide?.kicker || ''),
        headline: sanitizeTextValue(slide?.headline || ''),
        subcopy: sanitizeTextValue(slide?.subcopy || ''),
        evidenceCards: Array.isArray(slide?.evidenceCards) ? slide.evidenceCards.map(card => sanitizeTextObject(card)) : slide?.evidenceCards,
      }]));
      const cleanExportSections = moveSlidesToStandaloneSection(exportCustomSections);
      const cleanEnabledExportSections = cleanExportSections.filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image' || block.type === 'slide')));
      const updatedStructured = {
        ...(experience.structuredResult || {}),
        ...cleanEditedContent,
        projectOverview: { ...cleanOverview },
        marketResearch: { ...editedResearch },
        sectionSlides: { ...cleanSectionSlides },
        keywords: editedKeywords,
        keyExperiences: keyExperiencesForSave,
        jobCategory,
        jobSpecific: editedJobSpecific,
        exportConfig: (() => {
          const prevCfg = experience?.structuredResult?.exportConfig || {};
          const sections = cleanEnabledExportSections.map(section => ({
            key: section.key,
            label: section.label,
            type: section.type || 'custom',
            content: section.content,
            blocks: section.blocks || [],
          }));
          return {
            ...prevCfg,
            sectionOrder: cleanExportSections.map(section => section.key),
            enabledMap: Object.fromEntries(cleanExportSections.map(section => [section.key, section.enabled !== false])),
            coverImg: exportCoverImg || prevCfg.coverImg || null,
            sections,
            draftSections: cleanExportSections,
          };
        })(),
      };
      await updateDoc(ref, {
        title: editedTitle,
        structuredResult: updatedStructured,
        keywords: editedKeywords,
        images: allImages,
        sectionImages,
        imageConfig,
        updatedAt: new Date(),
      });
      setExperience(prev => ({ ...prev, title: editedTitle, structuredResult: updatedStructured, keywords: editedKeywords }));
      const newEditing = {};
      SECTION_KEYS.forEach(k => {
        if (!editedContent[k]?.trim()) newEditing[k] = true;
      });
      setEditingSections(newEditing);
      toast.success('저장되었습니다');
      navigate(`/app/experience/structured/${id}?view=true`, { replace: true });
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };

  const filledCount = SECTION_KEYS.filter(k => { const v = editedContent[k]?.trim(); return v && !v.startsWith('[작성 필요]'); }).length;
  const emptyCount = SECTION_KEYS.length - filledCount;
  const firstIncompleteSlideIdx = SECTION_KEYS.findIndex(k => {
    const value = editedContent[k]?.trim();
    return !value || value.startsWith('[작성 필요]');
  });

  const buildDefaultExportSections = () => {
    const metaLines = [
      editedOverview.duration && `기간: ${editedOverview.duration}`,
      editedOverview.role && `역할: ${editedOverview.role}`,
      editedOverview.team && `팀 구성: ${editedOverview.team}`,
      editedOverview.scopeOfImpact && `영향 범위: ${editedOverview.scopeOfImpact}`,
      editedOverview.techStack?.length > 0 && `기술: ${editedOverview.techStack.join(', ')}`,
      editedKeywords.length > 0 && `키워드: ${editedKeywords.map(kw => typeof kw === 'string' ? kw : kw?.name || kw?.keyword || '').filter(Boolean).join(', ')}`,
      editedOverview.goal && `목표: ${editedOverview.goal}`,
    ].filter(Boolean).join('\n');
    const keyExperienceText = editedKeyExperiences.map((item, index) => [
      `${index + 1}. ${item.title || '핵심 경험'}`,
      item.metric || item.afterMetric ? `성과: ${item.afterMetric || item.metric}` : '',
      item.context ? `상황: ${item.context}` : '',
      item.action ? `행동: ${item.action}` : '',
      item.result ? `결과: ${item.result}` : '',
      item.learning ? `학습: ${item.learning}` : '',
    ].filter(Boolean).join('\n')).join('\n\n');
    const researchText = [
      editedResearch.marketOverview,
      ...(editedResearch.decisionMetrics || []).map(item => [
        item.metric && `지표: ${item.metric}`,
        item.whyItMatters && `중요도: ${item.whyItMatters}`,
        item.recommendedProxy && `확인 방법: ${item.recommendedProxy}`,
        item.researchBasis && `근거: ${item.researchBasis}`,
      ].filter(Boolean).join('\n')),
      editedResearch.limitations && `검증 필요: ${editedResearch.limitations}`,
    ].filter(Boolean).join('\n\n');
    const jobSections = (JOB_SPECIFIC_FIELDS[jobCategory] || []).map(field => ({
      key: `job-${field.key}`,
      sourceKey: field.key,
      label: field.label,
      type: 'job',
      content: editedJobSpecific[field.key] || '',
      enabled: !!(editedJobSpecific[field.key] || '').trim(),
    }));
    const baseSections = SECTION_KEYS.map(key => ({
      key,
      sourceKey: key,
      label: SECTION_META[key].label,
      type: 'base',
      content: editedContent[key] || '',
      enabled: true,
    }));
    return [
      { key: 'project-meta', label: '프로젝트 정보', type: 'meta', content: metaLines, enabled: true },
      { key: 'key-experiences', label: '핵심 경험 & 성과', type: 'summary', content: keyExperienceText, enabled: editedKeyExperiences.length > 0 },
      { key: 'market-research', label: '시장/지표 리서치', type: 'research', content: researchText, enabled: !!researchText.trim() },
      ...jobSections,
      ...baseSections,
    ].map(section => normalizeExportSection({ ...section, blocks: section.content ? [makeTextBlock(section.content)] : [] }));
  };

  const normalizedExportSections = moveSlidesToStandaloneSection(exportCustomSections);
  const enabledExportSections = normalizedExportSections
    .filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image' || block.type === 'slide')));
  const activeExportSectionRaw = normalizedExportSections.find(section => section.key === activeExportSectionKey) || normalizedExportSections.find(section => !isSlideDeckSection(section)) || normalizedExportSections[0];
  const activeExportSection = activeExportSectionRaw ? normalizeExportSection(activeExportSectionRaw) : null;
  const activeIsSlideDeck = activeExportSection ? isSlideDeckSection(activeExportSection) : false;
  const slideDeckSection = normalizedExportSections.find(isSlideDeckSection) || createSlideDeckSection([]);
  const slideDeckBlocks = slideDeckSection.blocks.filter(block => block.type === 'slide');

  const updateExportSection = (key, patch) => {
    const cleanPatch = sanitizeTextObject(patch);
    setExportCustomSections(prev => prev.map(section => {
      if (section.key !== key) return section;
      const next = { ...section, ...cleanPatch };
      if (Object.prototype.hasOwnProperty.call(cleanPatch, 'content') && !Object.prototype.hasOwnProperty.call(cleanPatch, 'blocks')) {
        next.blocks = syncTextBlock(section.blocks || [], cleanPatch.content);
      }
      return normalizeExportSection(next);
    }));
  };

  const addExportSection = () => {
    const key = `custom-${Date.now()}`;
    const next = normalizeExportSection({ key, label: '새 섹션', type: 'custom', content: '', blocks: [makeTextBlock('')], enabled: true });
    setExportCustomSections(prev => [...prev, next]);
    setActiveExportSectionKey(key);
  };

  const removeExportSection = (key) => {
    setExportCustomSections(prev => {
      const next = prev.filter(section => section.key !== key);
      if (activeExportSectionKey === key) setActiveExportSectionKey(next[0]?.key || null);
      return next;
    });
  };

  const updateExportBlock = (sectionKey, blockId, patch) => {
    setExportCustomSections(prev => prev.map(section => {
      if (section.key !== sectionKey) return section;
      const blocks = normalizeExportSection(section).blocks.map(normalizePortfolioBlock).filter(Boolean).map(block => {
        if (block.id !== blockId) return block;
        return normalizePortfolioBlock({ ...block, ...patch });
      });
      return normalizeExportSection({ ...section, blocks, content: portfolioBlocksToText(blocks) });
    }));
  };

  const removeExportBlock = (sectionKey, blockId) => {
    setExportCustomSections(prev => prev.map(section => {
      if (section.key !== sectionKey) return section;
      const blocks = normalizeExportSection(section).blocks.map(normalizePortfolioBlock).filter(Boolean).filter(block => block.id !== blockId);
      return normalizeExportSection({ ...section, blocks, content: portfolioBlocksToText(blocks) });
    }));
  };

  const moveExportBlock = (sectionKey, blockId, dir) => {
    setExportCustomSections(prev => prev.map(section => {
      if (section.key !== sectionKey) return section;
      const blocks = normalizeExportSection(section).blocks.map(normalizePortfolioBlock).filter(Boolean);
      const index = blocks.findIndex(block => block.id === blockId);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= blocks.length) return section;
      const nextBlocks = [...blocks];
      [nextBlocks[index], nextBlocks[target]] = [nextBlocks[target], nextBlocks[index]];
      return normalizeExportSection({ ...section, blocks: nextBlocks, content: portfolioBlocksToText(nextBlocks) });
    }));
  };

  const addExportTextBlock = (sectionKey) => {
    setExportCustomSections(prev => prev.map(section => {
      if (section.key !== sectionKey) return section;
      const blocks = [...(normalizeExportSection(section).blocks.map(normalizePortfolioBlock).filter(Boolean)), makeTextBlock('')];
      return normalizeExportSection({ ...section, blocks, content: portfolioBlocksToText(blocks) });
    }));
  };

  const buildCurrentSlideBlock = (slideKey) => {
    const sr = experience?.structuredResult || {};
    const slide = normalizeSectionSlide({
      key: slideKey,
      content: editedContent[slideKey] || '',
      structured: { ...sr, sectionSlides: { ...(sr.sectionSlides || {}), ...editedSectionSlides } },
      research: editedResearch,
      keyExperiences: editedKeyExperiences,
      overview: editedOverview,
    });
    return buildSlideExportBlock(slideKey, slide, editedContent[slideKey] || '', SECTION_META[slideKey]?.label || slideKey);
  };

  const updateSlideDeck = (updater) => {
    setExportCustomSections(prev => {
      const sections = [...prev];
      let deckIndex = -1;
      // 가장 마지막에 있는 슬라이드 섹션을 찾습니다 (가장 최근에 작업한 곳)
      for (let i = sections.length - 1; i >= 0; i--) {
        if (isSlideDeckSection(sections[i])) {
          deckIndex = i;
          break;
        }
      }
      
      if (deckIndex >= 0) {
        const deck = sections[deckIndex];
        const nextDeck = normalizeExportSection(updater(deck));
        return sections.map((section, index) => index === deckIndex ? nextDeck : section);
      } else {
        const nextDeck = normalizeExportSection(updater(createSlideDeckSection([])));
        return [...sections, nextDeck];
      }
    });
  };

  const addExportSlideBlock = (slideKey, mode = 'merge') => {
    const slideBlock = buildCurrentSlideBlock(slideKey);
    
    if (mode === 'new') {
      const key = `slide-${Date.now()}`;
      const newSection = createSlideDeckSection([slideBlock], true, `${SECTION_META[slideKey]?.label || '상세 슬라이드'}`);
      newSection.key = key;
      setExportCustomSections(prev => [...prev, newSection]);
      setActiveExportSectionKey(key);
      toast.success('새 섹션으로 추가되었습니다');
    } else {
      updateSlideDeck(deck => {
        const blocks = [...deck.blocks.filter(block => block.type === 'slide'), slideBlock];
        return createSlideDeckSection(blocks, deck.enabled !== false, deck.label || '상세 슬라이드');
      });
      toast.success('기존 슬라이드 섹션에 추가되었습니다');
    }
  };

  const addAllExportSlideBlocks = () => {
    const blocks = SECTION_KEYS.map(buildCurrentSlideBlock);
    updateSlideDeck(deck => createSlideDeckSection(blocks, deck.enabled !== false, deck.label || '상세 슬라이드'));
    toast.success('7개 상세 슬라이드를 모두 구성했습니다');
  };

  const addExportImageBlock = async (sectionKey, file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    try {
      const base64 = await resizeToBase64(file, 1400, 0.8);
      const imageBlock = normalizePortfolioBlock({ type: 'image', content: base64, alt: file.name, width: '100%' });
      setExportCustomSections(prev => prev.map(section => {
        if (section.key !== sectionKey) return section;
        const blocks = [...(normalizeExportSection(section).blocks.map(normalizePortfolioBlock).filter(Boolean)), imageBlock];
        return normalizeExportSection({ ...section, blocks, content: portfolioBlocksToText(blocks) });
      }));
      toast.success('이미지가 섹션에 추가되었습니다');
    } catch {
      toast.error('이미지 추가에 실패했습니다');
    }
  };

  const moveExportCustomSection = (key, dir) => {
    setExportCustomSections(prev => {
      const index = prev.findIndex(section => section.key === key);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const resetExportSectionsFromPage = () => {
    const defaults = buildDefaultExportSections();
    setExportCustomSections(defaults);
    setActiveExportSectionKey(defaults[0]?.key || null);
  };

  /* ── 포트폴리오 내보내기 섹션 목록 초기화 ── */
  useEffect(() => {
    const jobSects = (JOB_SPECIFIC_FIELDS[jobCategory] || []).map(s => ({ key: `job-${s.key}`, label: s.label, type: 'job' }));
    const baseSects = SECTION_KEYS.map(k => ({ key: k, label: SECTION_META[k].label, type: 'base' }));
    const allSects = [
      { key: 'project-meta', label: '프로젝트 정보', type: 'meta' },
      { key: 'key-experiences', label: '핵심 경험 & 성과', type: 'summary' },
      { key: 'market-research', label: '시장/지표 리서치', type: 'research' },
      ...jobSects, 
      ...baseSects
    ];
    setExportOrder(allSects.map(s => s.key));
    const enabled = {};
    allSects.forEach(s => { enabled[s.key] = true; });
    setExportEnabled(enabled);

    if (!experience?.structuredResult?.exportConfig) {
      const defaults = buildDefaultExportSections();
      setExportCustomSections(defaults);
      setActiveExportSectionKey(prev => prev || defaults[0]?.key || null);
    } else {
      setExportCustomSections(prev => {
        if (prev.length > 0) return prev;
        const defaults = buildDefaultExportSections();
        setActiveExportSectionKey(defaults[0]?.key || null);
        return defaults;
      });
    }
  }, [jobCategory, experience?.id, experience?.structuredResult?.exportConfig, editedContent, editedOverview, editedKeyExperiences, editedResearch, editedJobSpecific, editedKeywords]);

  /* 포트폴리오 내보내기 핸들러 */
  const handleExportToPortfolio = () => {
    const sr = experience?.structuredResult || {};
    const cleanSections = enabledExportSections.map(normalizeExportSection);
    const sections = cleanSections.map(section => ({
      key: section.key,
      label: section.label,
      type: section.type || 'custom',
      content: section.content,
      blocks: section.blocks || [],
    }));

    const exportConfig = {
      experienceId: id,
      title: editedTitle,
      jobCategory,
      sectionOrder: sections.map(section => section.key),
      sections,
      structuredResult: { ...sr, ...editedContent, projectOverview: editedOverview, marketResearch: editedResearch, sectionSlides: editedSectionSlides, jobSpecific: editedJobSpecific },
      keywords: editedKeywords,
      keyExperiences: editedKeyExperiences,
      projectOverview: editedOverview,
      marketResearch: editedResearch,
      coverImg: exportCoverImg || sr.exportConfig?.coverImg || null,
    };

    navigate('/app/portfolio', { state: { exportConfig } });
  };

  /* 포트폴리오 미리보기 - 섹션 구성 Firestore 저장 */
  const handleSaveExportConfig = async () => {
    const cleanExportSections = moveSlidesToStandaloneSection(exportCustomSections);
    const sections = cleanExportSections.filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image' || block.type === 'slide'))).map(section => ({
      key: section.key,
      label: section.label,
      type: section.type || 'custom',
      content: section.content,
      blocks: section.blocks || [],
    }));
    const exportConfigData = {
      sectionOrder: cleanExportSections.map(section => section.key),
      enabledMap: Object.fromEntries(cleanExportSections.map(section => [section.key, section.enabled !== false])),
      sections,
      draftSections: cleanExportSections,
      coverImg: exportCoverImg || null,
      savedAt: new Date(),
    };
    try {
      await updateDoc(doc(db, 'experiences', id), {
        'structuredResult.exportConfig': exportConfigData,
        updatedAt: new Date(),
      });
      setExperience(prev => prev ? {
        ...prev,
        structuredResult: { ...(prev.structuredResult || {}), exportConfig: exportConfigData },
      } : prev);
      toast.success('포트폴리오 구성이 저장되었습니다');
      setShowExportPanel(false);
    } catch {
      toast.error('저장에 실패했습니다');
    }
  };

  /* 포트폴리오 내보내기 패널 - 섹션 이동 */
  const moveExportSection = (idx, dir) => {
    setExportOrder(prev => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  };

  /* ── 포트폴리오 미리보기 패널 D&D 핸들러 ── */
  const handleExportDragStart = (key, e) => {
    setExportDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };
  const handleExportDragOver = (key, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setExportOverKey(key);
  };
  const handleExportDrop = (targetKey, e) => {
    e.preventDefault();
    if (!exportDragKey || exportDragKey === targetKey) { setExportDragKey(null); setExportOverKey(null); return; }
    setExportCustomSections(prev => {
      const fromIdx = prev.findIndex(s => s.key === exportDragKey);
      const toIdx = prev.findIndex(s => s.key === targetKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setExportDragKey(null);
    setExportOverKey(null);
  };
  const handleExportDragEnd = () => {
    setExportDragKey(null);
    setExportOverKey(null);
  };

  /* 페이지 전체 품질 체크리스트 */
  const qualityChecks = [
    { id: 'title',          label: '슬라이드 제목/프로젝트명', targetSlide: 0, check: () => !!editedTitle.trim(), tip: '소개 슬라이드의 제목은 프로젝트명보다 한 단계 구체적으로, 문제와 결과가 보이게 다듬어 주세요.' },
    { id: 'meta',           label: '소개 슬라이드 메타 입력', targetSlide: 0, check: () => !!editedOverview.duration?.trim() && !!editedOverview.role?.trim() && !!editedOverview.team?.trim(), tip: '기간, 역할, 팀 구성은 읽는 사람이 프로젝트 규모와 본인 기여 범위를 바로 판단하는 기준입니다.' },
    { id: 'techStack',      label: '기술 스택 입력', targetSlide: 0, check: () => editedOverview.techStack.length > 0, tip: '기술 스택은 많이 나열하기보다 이 경험의 핵심 판단에 쓰인 도구를 우선 배치해 주세요.' },
    { id: 'keywords',       label: '키워드 3개 이상', targetSlide: 0, check: () => editedKeywords.length >= 3, tip: '키워드는 역할, 문제 해결 방식, 성과 방향이 섞이도록 3개 이상 구성하면 슬라이드 인상이 선명해집니다.' },
    { id: 'keyExperiences', label: '핵심 경험 슬라이드 추가', targetSlide: 3, check: () => editedKeyExperiences.length > 0, tip: '핵심 경험은 행동 나열보다 의사결정의 이유와 trade-off가 보이게 정리하면 좋습니다.' },
    { id: 'research',       label: '시장/지표 근거 보강', targetSlide: 1, check: () => !!editedResearch.marketOverview?.trim() || editedResearch.decisionMetrics.length > 0, tip: '시장/지표 근거는 내 성과로 둔갑시키지 말고, 판단 기준이나 비교 기준으로 연결해 주세요.' },
    { id: 'metrics',        label: '수치/성과 근거 포함', targetSlide: 4, check: () => SECTION_KEYS.some(k => /\d+\s*[%배ms개원만억]/.test(editedContent[k] || '')) || editedKeyExperiences.some(k => k.metric || k.afterMetric), tip: '성과 슬라이드에는 전후 변화, 처리량, 시간 절감, 사용자 반응처럼 검증 가능한 수치를 우선 배치해 주세요.' },
    { id: 'images',         label: '슬라이드 이미지 배치', targetSlide: sectionSlideIdx, check: () => allImages.length > 0, tip: '이미지는 설명을 대신하는 증거로 쓰는 게 좋아요. 현재 슬라이드에서 결과물, 화면, 구조도를 필요한 위치에 배치해 보세요.' },
    { id: 'sections',       label: `${SECTION_COUNT}개 섹션 완성 (${filledCount}/${SECTION_COUNT})`, targetSlide: firstIncompleteSlideIdx >= 0 ? firstIncompleteSlideIdx : 0, check: () => filledCount === SECTION_COUNT, tip: '비어 있는 섹션부터 채우면 전체 흐름이 빨리 안정됩니다. 각 슬라이드는 배경, 문제, 행동, 결과가 겹치지 않게 역할을 나눠 주세요.' },
  ];
  const passedChecks = qualityChecks.filter(c => c.check()).length;
  const qualityPct = Math.round((passedChecks / qualityChecks.length) * 100);
  const activeQualityCheck = qualityChecks.find(item => item.id === activeQualityId) || qualityChecks.find(item => !item.check()) || qualityChecks[0];
  const handleQualityCheckClick = (item) => {
    const nextSlideIdx = Math.min(item.targetSlide ?? 0, SECTION_COUNT - 1);
    setActiveQualityId(item.id);
    setSectionSlideIdx(nextSlideIdx);
    detailSlidesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!experience) {
    return <p className="text-bluewood-400 text-center py-20">경험 데이터를 찾을 수 없습니다.</p>;
  }

  const structured = experience.structuredResult || {};
  const followUpQuestions = structured.followUpQuestions || [];

  /* 작성 완성도 % */
  const completionPct = Math.round((filledCount / SECTION_COUNT) * 100);

  const renderDetailSlides = () => (
    <div ref={detailSlidesRef} className="mb-5 scroll-mt-6">
      <div className="mb-4 border-b border-surface-200 pb-3">
        <h1 className="text-[28px] font-extrabold leading-tight text-bluewood-900 sm:text-[34px]">{editedTitle || experience?.title || '경험 제목'}</h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-200">
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-surface-200 bg-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-bold text-primary-600">
              <span className="tabular-nums">{SECTION_META[SECTION_KEYS[Math.min(sectionSlideIdx, SECTION_COUNT - 1)]].num}</span>
              <span className="text-primary-300">·</span>
              <span className="truncate">{SECTION_META[SECTION_KEYS[Math.min(sectionSlideIdx, SECTION_COUNT - 1)]].label}</span>
            </span>
            <span className="hidden sm:inline text-[13px] text-bluewood-300 font-medium tabular-nums">{filledCount}/{SECTION_COUNT} 완성</span>
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSectionSlideIdx(i => Math.max(0, i - 1))}
            disabled={sectionSlideIdx === 0}
            title="이전 슬라이드 (←)"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-surface-200 bg-white text-bluewood-500 hover:bg-surface-50 hover:border-primary-200 hover:text-primary-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-bluewood-500 transition-all">
            <ChevronLeft size={15} />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            {SECTION_KEYS.map((key, index) => {
              const value = editedContent[key] || '';
              const done = value.trim() && !value.trim().startsWith('[작성 필요]');
              return (
                <button
                  key={key}
                  onClick={() => setSectionSlideIdx(index)}
                  title={`${SECTION_META[key].num} · ${SECTION_META[key].label}`}
                  aria-label={`${SECTION_META[key].label} 슬라이드로 이동`}
                  className={`h-2 rounded-full transition-all duration-300 hover:scale-y-150 ${index === sectionSlideIdx ? 'w-6 bg-primary-600' : done ? 'w-2 bg-caribbean-400' : 'w-2 bg-surface-300 hover:bg-bluewood-300'}`}
                />
              );
            })}
          </div>
          <span className="min-w-[44px] text-center text-[13px] font-semibold text-bluewood-400 tabular-nums">{sectionSlideIdx + 1}/{SECTION_COUNT}</span>
          <button
            onClick={() => setSectionSlideIdx(i => Math.min(SECTION_COUNT - 1, i + 1))}
            disabled={sectionSlideIdx === SECTION_COUNT - 1}
            title="다음 슬라이드 (→)"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-surface-200 bg-white text-bluewood-500 hover:bg-surface-50 hover:border-primary-200 hover:text-primary-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-bluewood-500 transition-all">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {(structured.highlights || []).length > 0 && (
        <div className="flex items-center gap-5 px-6 py-2.5 bg-surface-50/60 border-b border-surface-100">
          {Object.entries(highlightColors).map(([key, color]) => (
            <div key={key} className="flex items-center gap-2 text-[13px] text-bluewood-500">
              <span className="inline-block w-5 h-0" style={{ borderBottom: `2.5px solid ${color.underline}` }} />
              {color.label}
            </div>
          ))}
        </div>
      )}

      <div>
        {[SECTION_KEYS[Math.min(sectionSlideIdx, SECTION_COUNT - 1)]].map(key => {
          const meta = SECTION_META[key];
          const value = editedContent[key] || '';
          const isEditing = editingSections[key];
          const field = FRAMEWORKS.STRUCTURED.fields.find(f => f.key === key);
          const slide = normalizeSectionSlide({
            key,
            content: value,
            structured: { ...structured, sectionSlides: { ...(structured.sectionSlides || {}), ...editedSectionSlides } },
            research: editedResearch,
            keyExperiences: editedKeyExperiences,
            overview: editedOverview,
          });
          const imageProps = {
            sectionImages,
            allImages,
            imageConfig,
            setImageConfig,
            dragInfo,
            dropTarget,
            setDropTarget,
            handleDragStart,
            handleDragEnd,
            handleImageDrop,
            handleImageDelete,
          };

          return (
            <div key={key} className="animate-fadeIn">
            <PortfolioSectionSlide
              sectionKey={key}
              meta={meta}
              overview={editedOverview}
              onOverviewChange={(overviewKey, overviewValue) => setEditedOverview(prev => ({ ...prev, [overviewKey]: sanitizeTextValue(overviewValue) }))}
              value={value}
              slide={slide}
              isEditing={isEditing}
              viewOnly={viewOnly}
              field={field}
              structured={structured}
              editedKeywords={editedKeywords}
              onChange={(nextValue) => handleFieldChange(key, nextValue)}
              onSlideFieldChange={handleSlideFieldChange}
              onSlideCardChange={handleSlideCardChange}
              onEdit={() => handleStartEditing(key)}
              onDone={() => toggleEditing(key)}
              imageProps={imageProps}
              onAddImage={() => openSlideImagePicker(key)}
              uploadingImage={uploadingImage}
              dragInfo={dragInfo}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
              handleSectionDrop={handleSectionDrop}
            />
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="animate-fadeIn w-full max-w-[95%] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 pb-16">
      {/* 상단 네비 + 저장/수정 */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
        {navState?.isTutorialDemo ? (
          <Link to={navState.backUrl || '/app/experience?tutorial=1&step=2'} className="inline-flex items-center gap-2 text-[13px] font-medium text-primary-600 hover:text-primary-700 transition-colors">
            <ArrowLeft size={15} /> 튜토리얼로 돌아가기
          </Link>
        ) : (
          <Link to="/app/experience" className="inline-flex items-center gap-2 text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">
            <ArrowLeft size={15} /> 경험 목록으로
          </Link>
        )}
        {!viewOnly && !navState?.isTutorialDemo && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-bold text-primary-600 ring-1 ring-primary-100">
            <PenLine size={12} /> 편집 중
          </span>
        )}
        </div>
        {navState?.isTutorialDemo ? (
          <span className="px-4 py-2 text-[12px] font-semibold text-primary-600 bg-primary-50 rounded-lg border border-primary-100">
            가상 경험 예시 화면 (저장되지 않음)
          </span>
        ) : viewOnly ? (
          <button
            onClick={() => {
              openAllSections();
              navigate(`/app/experience/structured/${id}`);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-surface-200 text-bluewood-700 rounded-lg text-[13px] font-medium hover:bg-surface-50 transition-colors"
          >
            <PenLine size={14} />
            수정하기
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* 되돌리기/다시실행 그룹 */}
            <div className="inline-flex items-center rounded-xl border border-surface-200 bg-white p-0.5">
              <button onClick={handleUndo} disabled={!canUndo(id)} title="이전으로 되돌리기 (Ctrl+Z)" aria-label="되돌리기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-bluewood-500 hover:bg-surface-50 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all">
                <RotateCcw size={14} />
              </button>
              <button onClick={handleRedo} disabled={!canRedo(id)} title="다시 실행 (Ctrl+Y)" aria-label="다시 실행"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-bluewood-500 hover:bg-surface-50 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all">
                <RotateCw size={14} />
              </button>
            </div>

            {/* 핵심 경험 슬라이더 컨트롤 그룹 */}
            {editedKeyExperiences.length > 0 && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-2.5 py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-bluewood-300">핵심 경험</span>
                {/* 인디케이터 */}
                <div className="flex items-center gap-1">
                  {editedKeyExperiences.map((_, i) => {
                    const colors = ['#ef4444', '#2563eb', '#7c3aed'];
                    return (
                      <button key={i} onClick={() => sliderRef.current?.goTo(i)} className="p-0.5" aria-label={`${i + 1}번 핵심 경험`}>
                        <div className={`h-[6px] rounded-full transition-all duration-300 ${i === sliderCurrent ? 'w-5' : 'w-[6px] hover:w-3'}`}
                          style={{ backgroundColor: i === sliderCurrent ? colors[i % 3] : '#d1d5db' }} />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-bluewood-400 tabular-nums font-medium">{sliderCurrent + 1}/{editedKeyExperiences.length}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => sliderRef.current?.goPrev()} aria-label="이전 핵심 경험"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-surface-200 text-bluewood-500 hover:bg-surface-50 hover:border-primary-200 hover:text-primary-600 active:scale-95 transition-all">
                    <ChevronLeft size={15} />
                  </button>
                  <button onClick={() => sliderRef.current?.goNext()} aria-label="다음 핵심 경험"
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-surface-200 text-bluewood-500 hover:bg-surface-50 hover:border-primary-200 hover:text-primary-600 active:scale-95 transition-all">
                    <ChevronRight size={15} />
                  </button>
                </div>
                <div className="w-px h-5 bg-surface-200" />
                {/* 삭제된 항목 되돌리기 */}
                {sliderDeletedCount > 0 && (
                  <button onClick={() => sliderRef.current?.undoDelete()}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all">
                    <Undo2 size={12} /> ({sliderDeletedCount})
                  </button>
                )}
                <button onClick={() => sliderRef.current?.deleteSlide()} title="현재 핵심 경험 삭제"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-white text-red-400 border-red-200 hover:bg-red-50 active:scale-95 transition-all">
                  <Trash2 size={13} /> 삭제
                </button>
              </div>
            )}

            <button
              onClick={() => setShowExportPanel(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-surface-200 text-bluewood-700 rounded-xl text-[13px] font-medium hover:bg-surface-50 hover:border-bluewood-300 active:scale-95 transition-all">
              <Eye size={14} /> 미리보기
            </button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-[13px] font-semibold shadow-sm shadow-primary-600/20 hover:bg-primary-700 active:scale-95 disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        )}
      </div>

      {renderDetailSlides()}

      {/* ── 메인 + 우측 기업분석 사이드바 ── */}
      <div className="flex gap-6 sm:gap-8 lg:gap-10 items-start">
        {/* 메인 콘텐츠 */}
        <div className="flex-1 min-w-0">

      {/* 핵심 경험 슬라이더 */}
      <div className="mb-5">
        <KeyExperienceSlider
          ref={sliderRef}
          keyExperiences={editedKeyExperiences}
          onUpdate={viewOnly ? undefined : setEditedKeyExperiences}
          viewOnly={viewOnly}
          forceEditing={!viewOnly}
          hideHeader={!viewOnly}
          onEditingChange={setSliderEditing}
          onCurrentChange={setSliderCurrent}
          onDeletedCountChange={setSliderDeletedCount}
        />
      </div>
      <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

      {/* ── 역량 인사이트 (근거·배운점 카드) ── */}
      <CompetencyMeter
        highlights={structured.highlights}
        keywords={editedKeywords}
        keyExperiences={editedKeyExperiences}
        growthText={editedContent.growth}
      />

      {/* ╔══════════════════════════════════════════════╗
         ║  직군 특화 핵심 분석 섹션 (7개 섹션 위)       ║
         ╚══════════════════════════════════════════════╝ */}
      {(() => {
        const jobSections = JOB_SPECIFIC_FIELDS[jobCategory] || [];
        if (jobSections.length === 0) return null;

        const jobMeta = JOB_CATEGORIES.flatMap(g => g.items).find(it => it.value === jobCategory);
        const jobLabel = jobMeta?.label || jobCategory;

        return (
          <div className="border border-surface-100 overflow-hidden">
            {/* 직군 특화 헤더 */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-surface-100">
              <span className="px-2.5 py-1 bg-primary-600 text-white rounded-md text-[13px] font-bold tracking-wide uppercase">직군 특화</span>
              <span className="text-[14px] font-semibold text-bluewood-700">{jobLabel} 핵심 분석 섹션</span>
              <span className="text-[14px] text-bluewood-300 ml-1">— 채용 담당자가 가장 주목하는 항목</span>
            </div>

            <div className="divide-y divide-surface-100">
              {jobSections.map((field, idx) => {
                const val = editedJobSpecific[field.key] || '';
                const isTrulyEmpty = !val.trim();
                const isDraft = !isTrulyEmpty && val.trim().startsWith('[작성 필요]');
                const isEditing = editingJobSections[field.key];

                return (
                  <div key={field.key} className="group">
                    {/* 섹션 헤더 */}
                    <div className="flex items-center gap-4 px-6 py-3 bg-surface-50/30">
                      <span className="flex-shrink-0 w-7 h-7 bg-bluewood-100 text-bluewood-700 flex items-center justify-center text-[13px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-bold text-bluewood-800">{field.label}</span>
                        {field.subtitle && <span className="text-[13px] text-bluewood-300 ml-2">{field.subtitle}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {isTrulyEmpty ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded text-[14px] font-semibold">빈칸</span>
                        ) : isDraft ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded text-[14px] font-semibold">초안</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-caribbean-50 text-caribbean-600 rounded text-[14px] font-semibold">완료</span>
                        )}
                        {!isEditing && !isTrulyEmpty && !viewOnly && (
                          <button
                            onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: true }))}
                            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2 py-1 text-[13px] text-bluewood-400 hover:text-bluewood-700 bg-white rounded-md border border-surface-200 transition-all">
                            <PenLine size={11} /> 수정
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 섹션 본문 */}
                    <div className="px-6 py-4 pl-[60px]">
                      {isEditing ? (
                        <div>
                          <p className="text-[13px] text-bluewood-400 bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 mb-3 leading-relaxed">
                            <strong>{field.subtitle}</strong><br />{field.placeholder}
                          </p>
                          <textarea
                            value={val.startsWith('[작성 필요]') ? val.replace(/^\[작성 필요\]\s*/, '') : val}
                            onChange={e => {
                              const v = e.target.value;
                              setEditedJobSpecific(p => ({ ...p, [field.key]: v }));
                              const t = e.target; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px';
                            }}
                            placeholder={field.placeholder || '내용을 입력하세요'}
                            className="w-full bg-white border border-surface-200 p-4 text-[13px] outline-none focus:ring-2 focus:ring-bluewood-200 transition-shadow resize-none overflow-hidden text-bluewood-800 placeholder-bluewood-300"
                            style={{ minHeight: '7rem' }}
                          />
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: false }))}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-bluewood-700 hover:bg-surface-50 transition-colors">
                              <Check size={13} /> 완료
                            </button>
                          </div>
                        </div>
                      ) : isTrulyEmpty ? (
                        <button
                          onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: true }))}
                          className="w-full py-3 border-2 border-dashed border-surface-200 text-[13px] font-medium text-bluewood-500 hover:bg-surface-50 transition-colors flex items-center justify-center gap-2">
                          <PenLine size={14} /> 빈칸 채우기
                        </button>
                      ) : isDraft ? (
                        <div className="border-l-2 border-surface-200 bg-surface-50/40 px-4 py-3">
                          <p className="text-[13px] text-bluewood-400 font-medium mb-1.5">AI 초안 — 수정해서 완성해보세요</p>
                          <p className="text-[13px] text-bluewood-500 leading-[1.85] whitespace-pre-wrap">{val.replace(/^\[작성 필요\]\s*/,'').trim()}</p>
                          {!viewOnly && (
                            <button onClick={() => setEditingJobSections(p => ({ ...p, [field.key]: true }))}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-bluewood-600 bg-white border border-surface-200 rounded-lg hover:bg-surface-50 transition-colors">
                              <PenLine size={11} /> 수정하기
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-[13px] text-bluewood-700 leading-[1.85] whitespace-pre-wrap">{val}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ╔══════════════════════════════════════════════╗
         ║  시장/지표 리서치 보강                        ║
         ╚══════════════════════════════════════════════╝ */}
      {(editedResearch.marketOverview || editedResearch.decisionMetrics.length > 0 || !viewOnly) && (
        <div className="mt-5 border border-surface-200 overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-4 px-6 sm:px-8 py-5 border-b border-surface-200 bg-white">
            <div>
              <h2 className="text-[14px] font-bold text-primary-600">시장/지표 리서치</h2>
              <p className="mt-1 text-[13px] text-bluewood-400">AI가 최신 뉴스·지표·논문을 조사해 의사결정 지표를 추천합니다. 외부 자료는 비교 기준으로만 쓰고, 실제 프로젝트 수치는 직접 검증하세요.</p>
            </div>
            {!viewOnly && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleResearchMetrics}
                  disabled={researchingMetrics}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {researchingMetrics ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {researchingMetrics ? '리서치 중...' : 'AI 지표 추천'}
                </button>
                <button
                  onClick={addDecisionMetric}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-200 text-[13px] font-semibold text-bluewood-600 hover:bg-surface-50 transition-colors">
                  <Plus size={13} /> 지표 추가
                </button>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div>
              <p className="mb-2 text-[13px] font-bold text-bluewood-700">프로젝트와 연결되는 시장 맥락</p>
              <textarea
                value={editedResearch.marketOverview}
                onChange={e => setEditedResearch(prev => ({ ...prev, marketOverview: e.target.value }))}
                readOnly={viewOnly}
                placeholder="프로젝트와 관련된 시장, 사용자 문제, 채용/JD 맥락이 여기에 정리됩니다."
                className={`w-full min-h-[96px] resize-none rounded-xl border border-surface-200 bg-white p-4 text-[13px] leading-[1.8] text-bluewood-800 outline-none placeholder:text-bluewood-300 ${viewOnly ? '' : 'focus:ring-2 focus:ring-bluewood-200'}`}
              />
            </div>

            {editedResearch.decisionMetrics.length > 0 && (
              <div>
                <p className="mb-3 text-[13px] font-bold text-bluewood-700">의사결정에 사용할 지표 후보</p>
                <div className="grid gap-3 lg:grid-cols-2">
                  {editedResearch.decisionMetrics.map((metric, index) => (
                    <div key={index} className="rounded-xl border border-surface-200 bg-surface-50/40 p-4">
                      <div className="mb-3 flex items-start gap-2">
                        <input
                          value={metric.metric}
                          onChange={e => updateDecisionMetric(index, 'metric', e.target.value)}
                          readOnly={viewOnly}
                          placeholder="지표명"
                          className="flex-1 bg-transparent text-[14px] font-bold text-primary-600 outline-none placeholder:text-bluewood-300"
                        />
                        {!viewOnly && (
                          <button onClick={() => removeDecisionMetric(index)} className="p-1 text-bluewood-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={metric.whyItMatters}
                        onChange={e => updateDecisionMetric(index, 'whyItMatters', e.target.value)}
                        readOnly={viewOnly}
                        placeholder="왜 중요한 지표인가요?"
                        className="mb-2 w-full min-h-[58px] resize-none bg-transparent text-[13px] leading-relaxed text-bluewood-700 outline-none placeholder:text-bluewood-300"
                      />
                      <input
                        value={metric.recommendedProxy}
                        onChange={e => updateDecisionMetric(index, 'recommendedProxy', e.target.value)}
                        readOnly={viewOnly}
                        placeholder="확인할 프록시/계산식"
                        className="mb-2 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-[13px] text-bluewood-700 outline-none placeholder:text-bluewood-300"
                      />
                      <textarea
                        value={metric.researchBasis}
                        onChange={e => updateDecisionMetric(index, 'researchBasis', e.target.value)}
                        readOnly={viewOnly}
                        placeholder="자료 근거 또는 [검증 필요]"
                        className="w-full min-h-[52px] resize-none bg-transparent text-[13px] leading-relaxed text-bluewood-500 outline-none placeholder:text-bluewood-300"
                      />
                      <div className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[12px] font-semibold text-bluewood-400 border border-surface-200">
                        신뢰도 {metric.confidence || 'medium'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(editedResearch.portfolioAngles.length > 0 || editedResearch.sourceNotes.length > 0 || editedResearch.limitations) && (
              <div className="grid gap-4 lg:grid-cols-3">
                {editedResearch.portfolioAngles.length > 0 && (
                  <div className="rounded-xl border border-surface-200 p-4">
                    <p className="mb-2 text-[13px] font-bold text-bluewood-700">강조 관점</p>
                    <ul className="space-y-1.5">
                      {editedResearch.portfolioAngles.map((angle, i) => (
                        <li key={i} className="text-[13px] leading-relaxed text-bluewood-600">{angle}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {editedResearch.sourceNotes.length > 0 && (
                  <div className="rounded-xl border border-surface-200 p-4 lg:col-span-2">
                    <p className="mb-2 text-[13px] font-bold text-bluewood-700">자료 메모</p>
                    <div className="space-y-2">
                      {editedResearch.sourceNotes.map((source, index) => (
                        <div key={index} className="grid gap-2 md:grid-cols-[1fr_120px]">
                          <input
                            value={source.title}
                            onChange={e => updateSourceNote(index, 'title', e.target.value)}
                            readOnly={viewOnly}
                            placeholder="자료 제목"
                            className="rounded-lg border border-surface-200 px-3 py-2 text-[13px] text-bluewood-700 outline-none"
                          />
                          <input
                            value={source.publisher}
                            onChange={e => updateSourceNote(index, 'publisher', e.target.value)}
                            readOnly={viewOnly}
                            placeholder="발행처"
                            className="rounded-lg border border-surface-200 px-3 py-2 text-[13px] text-bluewood-500 outline-none"
                          />
                          {viewOnly && /^https?:\/\//.test(source.url || '') ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="md:col-span-2 inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-[13px] text-primary-600 hover:underline truncate"
                            >
                              <ExternalLink size={12} className="flex-shrink-0" />
                              <span className="truncate">{source.url}</span>
                            </a>
                          ) : (
                            <input
                              value={source.url}
                              onChange={e => updateSourceNote(index, 'url', e.target.value)}
                              readOnly={viewOnly}
                              placeholder="URL 또는 [검증 필요]"
                              className="rounded-lg border border-surface-200 px-3 py-2 text-[13px] text-bluewood-500 outline-none md:col-span-2"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {editedResearch.limitations && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 lg:col-span-3">
                    <p className="mb-1 text-[13px] font-bold text-amber-700">검증 필요</p>
                    <p className="text-[13px] leading-relaxed text-amber-700">{editedResearch.limitations}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

        </div>{/* end 메인 콘텐츠 */}

        {/* ── 우측: 기업 분석 사이드바 (숨김) ── */}
        <div className="w-[300px] flex-shrink-0 hidden">
          <div className="sticky top-5 space-y-3">
            {jobAnalysis ? (
              <JobAnalysisBadge
                analysis={jobAnalysis}
                onRemove={handleRemoveJobAnalysis}
              />
            ) : (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div>
                      <p className="text-sm font-bold text-blue-900">기업 분석</p>
                      <p className="text-[13px] text-blue-400">채용공고 URL을 입력하세요</p>
                    </div>
                  </div>

                  {showJobInput ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="url"
                          value={jobUrl}
                          onChange={e => setJobUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                          placeholder="https:// 채용공고 링크"
                          className="w-full pl-8 pr-3 py-2.5 text-xs border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      {jobError && (
                        <p className="text-[13px] text-red-500 flex items-center gap-1">
                          <X size={11} /> {jobError}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleJobAnalyze}
                          disabled={analyzingJob || !jobUrl.trim()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {analyzingJob ? (
                            <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                          ) : (
                            <><Sparkles size={12} /> 분석하기</>
                          )}
                        </button>
                        <button
                          onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                          className="px-3 py-2 text-gray-400 hover:text-gray-600 text-xs transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowJobInput(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors"
                    >
                      <Sparkles size={13} /> 채용공고 분석하기
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 분석 후 URL 변경 버튼 */}
            {jobAnalysis && !showJobInput && (
              <button
                onClick={() => setShowJobInput(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[13px] text-blue-500 hover:text-blue-700 border border-blue-200 rounded-xl bg-white hover:bg-blue-50 transition-colors"
              >
                <Globe size={11} /> 다른 공고로 변경
              </button>
            )}
            {jobAnalysis && showJobInput && (
              <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-2">
                <p className="text-[13px] font-semibold text-blue-700">새 채용공고로 변경</p>
                <div className="relative">
                  <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={jobUrl}
                    onChange={e => setJobUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                    placeholder="https:// 채용공고 링크"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                {jobError && (
                  <p className="text-[13px] text-red-500 flex items-center gap-1">
                    <X size={11} /> {jobError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleJobAnalyze}
                    disabled={analyzingJob || !jobUrl.trim()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {analyzingJob ? <><Loader2 size={11} className="animate-spin" /> 분석 중...</> : <><Sparkles size={11} /> 분석</>}
                  </button>
                  <button
                    onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                    className="px-2.5 py-1.5 text-gray-400 hover:text-gray-600 text-xs border border-gray-200 rounded-lg transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>{/* end 기업분석 사이드바 */}

      </div>{/* end flex gap-5 */}

    </div>

      {/* 오른쪽: 프로젝트 타임라인 네비게이터 (고정, 접기/펼치기) */}
      <div className="hidden lg:block fixed right-0 top-20 z-30">
        <ProjectTimeline experiences={experiences} currentId={id} />
      </div>

      {/* 작성 완성도 플로팅 패널 */}
      {showQualityPanel ? (
        <div className="animate-fadeIn fixed bottom-5 left-5 z-40 w-[min(340px,calc(100vw-40px))] overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
            <div>
              <p className="text-[13px] font-extrabold text-primary-600">작성 완성도</p>
              <p className="mt-0.5 text-[12px] font-medium text-bluewood-300">슬라이드 품질 체크리스트</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-black text-primary-600">{passedChecks}/{qualityChecks.length}</span>
              <button
                onClick={() => setShowQualityPanel(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-bluewood-300 hover:bg-surface-100 hover:text-bluewood-600"
                aria-label="작성 완성도 패널 닫기"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="px-4 pb-4 pt-3">
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-100">
              <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${qualityPct}%` }} />
            </div>
            <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
              {qualityChecks.map(item => {
                const passed = item.check();
                const active = activeQualityCheck?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleQualityCheckClick(item)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${active ? 'bg-primary-50 ring-1 ring-primary-100' : 'hover:bg-surface-50'}`}
                  >
                    <span className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded ${passed ? 'bg-primary-600 text-white' : 'border border-surface-200 bg-white text-transparent'}`}>
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className={`flex-1 text-[13px] font-semibold leading-snug ${passed ? 'text-bluewood-700' : 'text-bluewood-300'}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
              <p className="text-[12px] font-bold text-amber-700">수정 팁</p>
              <p className="mt-1 text-[12px] leading-relaxed text-amber-700">{activeQualityCheck?.tip || followUpQuestions[0] || '현재 선택한 체크 항목에 맞춰 슬라이드 내용을 보강해 주세요.'}</p>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowQualityPanel(true)}
          className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-4 py-3 text-[13px] font-extrabold text-primary-600 shadow-[0_14px_35px_rgba(15,23,42,0.16)] hover:bg-primary-50 active:scale-95 transition-transform"
        >
          <Check size={15} /> 작성 완성도 {qualityPct}%
        </button>
      )}

      {/* ── 포트폴리오 내보내기 모달 ── */}
      {showExportPanel && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bluewood-900/45 backdrop-blur-sm p-2 sm:p-4" onClick={() => setShowExportPanel(false)}>
          <div
            className="h-[94vh] w-full max-w-[calc(100vw-32px)] bg-white rounded-[18px] shadow-2xl flex flex-col overflow-hidden border border-surface-200"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <h3 className="text-[16px] font-extrabold text-bluewood-900">포트폴리오 미리보기</h3>
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-bold text-primary-600">{enabledExportSections.length}개 선택됨</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveExportConfig}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-700 transition-colors"
                >
                  구성 저장하기
                </button>
                <button
                  onClick={() => setShowExportPanel(false)}
                  className="text-[13px] text-bluewood-400 hover:text-bluewood-700 px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex flex-1 min-h-0">

              {/* 왼쪽: 섹션 구성 */}
              <div className="w-[260px] flex-shrink-0 bg-white border-r border-surface-200 flex flex-col">
                <div className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-surface-100">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-[13px] font-extrabold text-bluewood-800">페이지 구성</p>
                    <button onClick={resetExportSectionsFromPage} className="text-[11px] font-semibold text-bluewood-300 hover:text-primary-600 transition-colors">
                      초기화
                    </button>
                  </div>
                  <button
                    onClick={addExportSection}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-200 bg-primary-50/50 px-3 py-2 text-[12px] font-bold text-primary-600 hover:bg-primary-50 transition-colors"
                  >
                    <Plus size={13} /> 빈 섹션 추가
                  </button>
                  <p className="mt-2 text-[10px] text-bluewood-300 text-center">⠿ 드래그로 순서 변경 · 체크로 표시 여부 설정</p>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                  {normalizedExportSections.map((section, index) => {
                    const normalizedSection = normalizeExportSection(section);
                    const active = activeExportSection?.key === section.key;
                    const enabled = section.enabled !== false;
                    const slideDeck = isSlideDeckSection(normalizedSection);
                    const isDragging = exportDragKey === section.key;
                    const isOver = exportOverKey === section.key && !isDragging;
                    const typeColor = slideDeck ? 'text-primary-500' : section.type === 'custom' ? 'text-amber-600' : section.type === 'job' ? 'text-caribbean-600' : 'text-bluewood-300';
                    const typeLabel = slideDeck ? '슬라이드' : section.type === 'custom' ? '직접' : section.type === 'job' ? '직군' : '경험';
                    return (
                      <div
                        key={section.key}
                        draggable
                        onDragStart={e => handleExportDragStart(section.key, e)}
                        onDragOver={e => handleExportDragOver(section.key, e)}
                        onDrop={e => handleExportDrop(section.key, e)}
                        onDragEnd={handleExportDragEnd}
                        className={`transition-opacity ${isDragging ? 'opacity-30' : ''}`}
                      >
                        <div
                          onClick={() => setActiveExportSectionKey(section.key)}
                          className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-all select-none ${
                            active ? 'bg-primary-50 ring-1 ring-primary-200' :
                            isOver ? 'bg-primary-50/60 ring-1 ring-primary-300' :
                            enabled ? 'hover:bg-surface-50' :
                            'opacity-40 hover:opacity-70'
                          }`}
                        >
                          <GripVertical size={13} className="flex-shrink-0 cursor-grab text-bluewood-200 group-hover:text-bluewood-400 transition-colors" />
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); updateExportSection(section.key, { enabled: !enabled }); }}
                            className={`flex-shrink-0 inline-flex h-4 w-4 items-center justify-center rounded transition-colors ${
                              enabled ? 'bg-primary-600 text-white' : 'border border-surface-300 bg-white hover:border-primary-300'
                            }`}
                          >
                            {enabled && <Check size={9} strokeWidth={3.5} />}
                          </button>
                          <span className="text-[10px] font-black text-bluewood-200 tabular-nums flex-shrink-0">{String(index + 1).padStart(2, '0')}</span>
                          <span className={`flex-1 text-[12px] font-semibold truncate min-w-0 ${active ? 'text-primary-700' : 'text-bluewood-700'}`}>
                            {section.label || '제목 없는 섹션'}
                          </span>
                          <span className={`flex-shrink-0 text-[10px] font-bold ${typeColor}`}>{typeLabel}</span>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeExportSection(section.key); }}
                            className="flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded opacity-0 group-hover:opacity-100 text-bluewood-200 hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 하단 버튼 */}
                <div className="px-3 py-3 border-t border-surface-100 flex-shrink-0 space-y-2">
                  <button
                    onClick={handleSaveExportConfig}
                    className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[13px] font-bold transition-colors shadow-sm shadow-primary-100"
                  >
                    구성 저장하기
                  </button>
                  <button
                    onClick={handleExportToPortfolio}
                    className="w-full py-2 border border-surface-200 bg-white text-bluewood-600 rounded-xl text-[12px] font-bold hover:bg-surface-50 transition-colors"
                  >
                    포트폴리오에 추가하기
                  </button>
                  <button
                    onClick={() => setShowExportPanel(false)}
                    className="w-full py-1.5 text-[12px] text-bluewood-300 hover:text-bluewood-600 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>

              {/* 오른쪽: 편집 + 미리보기 */}
              <div className="flex-1 overflow-y-auto bg-[#f5f6f8]">
                <div className="grid min-h-full grid-cols-1 gap-4 p-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="space-y-3">

                    {/* 섹션 편집 */}
                    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-100 bg-surface-50/60">
                        <div className="flex-1 min-w-0">
                          {activeExportSection ? (
                            <input
                              value={activeExportSection.label || ''}
                              onChange={e => updateExportSection(activeExportSection.key, { label: e.target.value })}
                              className="w-full bg-transparent text-[14px] font-extrabold text-bluewood-900 outline-none placeholder:text-bluewood-300"
                              placeholder="섹션 제목을 입력하세요"
                            />
                          ) : (
                            <p className="text-[13px] font-bold text-bluewood-400">섹션을 선택하세요</p>
                          )}
                        </div>
                        {activeExportSection && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => updateExportSection(activeExportSection.key, { enabled: activeExportSection.enabled === false })}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${activeExportSection.enabled === false ? 'bg-surface-100 text-bluewood-400' : 'bg-primary-50 text-primary-600'}`}
                            >
                              {activeExportSection.enabled === false ? <EyeOff size={11} /> : <Eye size={11} />}
                              {activeExportSection.enabled === false ? '숨김' : '표시'}
                            </button>
                            <button
                              onClick={() => removeExportSection(activeExportSection.key)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-bluewood-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {activeExportSection ? (
                        <div className="p-4 space-y-3">
                          {!activeIsSlideDeck && (
                            <div className="flex gap-2">
                              <button onClick={() => addExportTextBlock(activeExportSection.key)} className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-[12px] font-semibold text-bluewood-500 hover:bg-white hover:border-surface-300 transition-colors">
                                <Plus size={12} /> 텍스트 블록
                              </button>
                              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 text-[12px] font-semibold text-bluewood-500 hover:bg-white hover:border-surface-300 transition-colors">
                                <ImagePlus size={12} /> 사진
                                <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) addExportImageBlock(activeExportSection.key, file); }} />
                              </label>
                            </div>
                          )}
                          {activeIsSlideDeck && (
                            <div className="rounded-xl bg-primary-50 px-3 py-2.5 text-[12px] font-semibold text-primary-600">
                              슬라이드 덱 — {slideDeckBlocks.length}개 구성됨. 아래 슬라이드 추가 패널에서 관리하세요.
                            </div>
                          )}
                          {!activeIsSlideDeck && (
                            <div className="space-y-2">
                              {(activeExportSection.blocks || []).map((block, blockIndex) => {
                                const isFirst = blockIndex === 0;
                                const isLast = blockIndex === activeExportSection.blocks.length - 1;
                                return (
                                  <div key={block.id} className="rounded-xl border border-surface-200 bg-white">
                                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-surface-100">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-bluewood-300">{block.type === 'image' ? '사진' : block.type === 'slide' ? '슬라이드' : '텍스트'}</span>
                                      <div className="flex items-center gap-0.5">
                                        <button onClick={() => moveExportBlock(activeExportSection.key, block.id, -1)} disabled={isFirst} className="inline-flex h-6 w-6 items-center justify-center rounded text-bluewood-300 hover:bg-surface-100 disabled:opacity-20"><MoveUp size={11} /></button>
                                        <button onClick={() => moveExportBlock(activeExportSection.key, block.id, 1)} disabled={isLast} className="inline-flex h-6 w-6 items-center justify-center rounded text-bluewood-300 hover:bg-surface-100 disabled:opacity-20"><MoveDown size={11} /></button>
                                        <button onClick={() => removeExportBlock(activeExportSection.key, block.id)} className="inline-flex h-6 w-6 items-center justify-center rounded text-bluewood-200 hover:bg-red-50 hover:text-red-500"><Trash2 size={11} /></button>
                                      </div>
                                    </div>
                                    <div className="p-3">
                                      {block.type === 'image' ? (
                                        <div className="space-y-2">
                                          <img src={block.content} alt={block.alt || ''} className="max-h-40 w-full rounded-lg border border-surface-200 object-contain" />
                                          <div className="flex items-center gap-1">
                                            {['45%', '70%', '100%'].map(width => (
                                              <button key={width} onClick={() => updateExportBlock(activeExportSection.key, block.id, { width })} className={`rounded px-2 py-0.5 text-[10px] font-bold ${block.width === width ? 'bg-primary-600 text-white' : 'bg-surface-100 text-bluewood-500 hover:bg-surface-200'}`}>{width}</button>
                                            ))}
                                          </div>
                                        </div>
                                      ) : block.type === 'slide' ? (
                                        <div className="rounded-lg bg-surface-50 p-2.5 ring-1 ring-surface-200">
                                          <p className="text-[10px] font-black uppercase text-bluewood-300">{block.kicker || block.label}</p>
                                          <p className="mt-0.5 text-[13px] font-extrabold leading-snug text-bluewood-900">{block.title || block.label}</p>
                                          {block.subtitle && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-bluewood-500">{block.subtitle}</p>}
                                        </div>
                                      ) : (
                                        <textarea
                                          value={sanitizeTextValue(block.content || '')}
                                          onChange={e => updateExportBlock(activeExportSection.key, block.id, { content: e.target.value })}
                                          className="min-h-[120px] w-full resize-y rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-[12px] leading-[1.75] text-bluewood-700 outline-none focus:ring-2 focus:ring-primary-100"
                                          placeholder="포트폴리오에 보여줄 내용을 작성하세요"
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {(activeExportSection.blocks || []).length === 0 && (
                                <button onClick={() => addExportTextBlock(activeExportSection.key)} className="w-full rounded-xl border border-dashed border-surface-300 py-6 text-[12px] font-semibold text-bluewood-300 hover:bg-surface-50">+ 텍스트 블록 추가</button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-4 py-10 text-center text-[12px] font-semibold text-bluewood-300">왼쪽에서 섹션을 클릭하면 여기서 편집할 수 있습니다</div>
                      )}
                    </div>

                    {/* 슬라이드 추가 */}
                    <div className="rounded-2xl border border-surface-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-100 bg-surface-50/60">
                        <div>
                          <p className="text-[13px] font-extrabold text-bluewood-800">슬라이드 추가</p>
                          <p className="text-[11px] text-bluewood-400 mt-0.5">{slideDeckBlocks.length > 0 ? `${slideDeckBlocks.length}개 구성됨` : '아직 없음'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={addAllExportSlideBlocks}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-primary-700 transition-colors"
                        >
                          <LayoutGrid size={11} /> 전체 자동 구성
                        </button>
                      </div>

                      <div className="p-3 space-y-1">
                        <div className="flex items-center gap-2 px-2 pb-2 text-[10px] font-bold text-bluewood-300 border-b border-surface-100 mb-1">
                          <span className="flex-1">섹션</span>
                          <span className="w-14 text-center text-primary-500">개별 추가</span>
                          <span className="w-8 text-center text-bluewood-400">덱 +</span>
                        </div>
                        {SECTION_KEYS.map(slideKey => (
                          <div key={slideKey} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-50 group transition-colors">
                            <span className="text-[10px] font-black text-bluewood-200 tabular-nums w-5">{SECTION_META[slideKey].num}</span>
                            <span className="flex-1 text-[12px] font-semibold text-bluewood-600 truncate">{SECTION_META[slideKey].label}</span>
                            <button
                              type="button"
                              onClick={() => addExportSlideBlock(slideKey, 'new')}
                              className="w-14 rounded-lg border border-surface-200 py-1 text-[11px] font-bold text-bluewood-500 hover:bg-white hover:border-primary-200 hover:text-primary-600 transition-colors text-center"
                            >
                              개별
                            </button>
                            <button
                              type="button"
                              onClick={() => addExportSlideBlock(slideKey, 'merge')}
                              className="inline-flex h-6 w-8 items-center justify-center rounded-lg bg-surface-100 text-bluewood-400 hover:bg-primary-600 hover:text-white transition-colors"
                              title="슬라이드 덱에 합치기"
                            >
                              <Plus size={11} strokeWidth={3} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {slideDeckBlocks.length > 0 && (
                        <div className="border-t border-surface-100 px-3 pb-3 pt-2 space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-bluewood-300 px-1 pb-1">구성된 슬라이드</p>
                          {slideDeckBlocks.map((block, index) => (
                            <div key={block.id} className="flex items-center gap-2 rounded-lg border border-surface-100 bg-surface-50 px-2.5 py-1.5">
                              <span className="text-[10px] font-black text-bluewood-200 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                              <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-bluewood-700">{block.title || block.label || '슬라이드'}</p>
                              <button onClick={() => moveExportBlock(SLIDE_DECK_SECTION_KEY, block.id, -1)} disabled={index === 0} className="inline-flex h-5 w-5 items-center justify-center rounded text-bluewood-300 hover:bg-white disabled:opacity-20"><MoveUp size={10} /></button>
                              <button onClick={() => moveExportBlock(SLIDE_DECK_SECTION_KEY, block.id, 1)} disabled={index === slideDeckBlocks.length - 1} className="inline-flex h-5 w-5 items-center justify-center rounded text-bluewood-300 hover:bg-white disabled:opacity-20"><MoveDown size={10} /></button>
                              <button onClick={() => removeExportBlock(SLIDE_DECK_SECTION_KEY, block.id)} className="inline-flex h-5 w-5 items-center justify-center rounded text-bluewood-200 hover:bg-red-50 hover:text-red-500"><Trash2 size={10} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="rounded-[18px] border border-surface-200 bg-white shadow-sm overflow-hidden">
                    <div className={`relative w-full group ${exportCoverImg ? 'h-48' : 'h-16'} bg-surface-50`}>
                      {exportCoverImg ? (
                        <>
                          <img src={exportCoverImg} alt="cover" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-bluewood-900/25 opacity-0 transition-opacity group-hover:opacity-100">
                            <label className="cursor-pointer rounded-lg bg-white/95 px-3 py-1.5 text-[13px] font-bold text-bluewood-700 hover:bg-white">
                              변경
                              <input type="file" accept="image/*" className="hidden" onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = ev => setExportCoverImg(ev.target.result);
                                reader.readAsDataURL(file);
                              }} />
                            </label>
                            <button onClick={() => setExportCoverImg(null)} className="rounded-lg bg-white/95 px-3 py-1.5 text-[13px] font-bold text-red-600 hover:bg-white">제거</button>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full items-center px-8">
                          <label className="cursor-pointer rounded-lg border border-dashed border-surface-300 px-3 py-2 text-[13px] font-bold text-bluewood-300 hover:border-bluewood-300 hover:text-bluewood-500">
                            + 커버 이미지 추가
                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => setExportCoverImg(ev.target.result);
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="mx-auto max-w-[1040px] px-8 py-8 lg:px-12 lg:py-10">
                      <div className="mb-6 flex items-end gap-3">
                        <input
                          value={editedTitle}
                          onChange={e => setEditedTitle(sanitizeTextValue(e.target.value))}
                          className="flex-1 bg-transparent text-[28px] font-extrabold leading-tight text-primary-700 outline-none placeholder:text-bluewood-200"
                          placeholder="프로젝트 제목"
                        />
                        <span className="flex-shrink-0 mb-1 text-[11px] font-semibold text-bluewood-300 whitespace-nowrap">⠿ 드래그로 순서 변경</span>
                      </div>

                      <div className="space-y-4">
                        {enabledExportSections.map((section, index) => {
                          const slideDeck = isSlideDeckSection(section);
                          const isDraggingRight = exportDragKey === section.key;
                          const isOverRight = exportOverKey === section.key && !isDraggingRight;
                          return (
                            <div
                              key={section.key}
                              role="button"
                              tabIndex={0}
                              draggable
                              onDragStart={e => handleExportDragStart(section.key, e)}
                              onDragOver={e => handleExportDragOver(section.key, e)}
                              onDrop={e => handleExportDrop(section.key, e)}
                              onDragEnd={handleExportDragEnd}
                              onClick={() => setActiveExportSectionKey(section.key)}
                              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setActiveExportSectionKey(section.key); }}
                              className={`group w-full cursor-grab rounded-xl border p-4 text-left transition-all ${
                                isDraggingRight ? 'opacity-40 border-surface-200 bg-white' :
                                isOverRight ? 'border-primary-400 ring-2 ring-primary-200 bg-primary-50/20' :
                                activeExportSection?.key === section.key ? 'border-primary-200 bg-primary-50/40 ring-1 ring-primary-100' :
                                'border-surface-200 bg-white hover:border-bluewood-200'
                              }`}
                            >
                              <div className="mb-3 flex items-center gap-2 border-b border-surface-100 pb-3">
                                <GripVertical size={14} className="flex-shrink-0 text-bluewood-200" />
                                <span className="text-[12px] font-black text-bluewood-300 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                                <h2 className="flex-1 text-[14px] font-extrabold text-bluewood-900">{section.label || '제목 없는 섹션'}</h2>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); removeExportSection(section.key); }}
                                  className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 text-bluewood-300 hover:bg-red-50 hover:text-red-500 transition-all"
                                  title="섹션 삭제"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              {slideDeck ? (
                                <PortfolioSlideDeck blocks={section.blocks || []} compact />
                              ) : (
                                <PortfolioBlockViewer blocks={section.blocks?.length ? section.blocks : [makeTextBlock(section.content)]} compact />
                              )}
                            </div>
                          );
                        })}

                        {enabledExportSections.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-surface-300 py-20 text-center">
                            <p className="text-[14px] font-semibold text-bluewood-300">선택된 섹션이 없습니다</p>
                            <button onClick={addExportSection} className="mt-4 rounded-xl bg-primary-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-primary-700">섹션 추가하기</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ── 프로젝트 타임라인 네비게이터 ── */
function parsePeriodStr(exp) {
  const period = exp.period || exp.structuredResult?.projectOverview?.duration || '';
  const dateRegex = /(\d{4})[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?/g;
  const matches = [...period.matchAll(dateRegex)];
  if (matches.length >= 1) {
    const y = matches[0][1];
    const m = String(matches[0][2]).padStart(2, '0');
    if (matches.length >= 2) {
      const y2 = matches[1][1];
      const m2 = String(matches[1][2]).padStart(2, '0');
      return `${y}.${m} – ${y2}.${m2}`;
    }
    return `${y}.${m}`;
  }
  return '';
}

function ProjectTimeline({ experiences, currentId }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  if (!experiences || experiences.length === 0) return null;

  return (
    <div className={`transition-all duration-300 ease-in-out ${expanded ? 'w-[220px]' : 'w-[52px]'}`}>
      <div className={`bg-white/90 backdrop-blur-sm border-l border-surface-200 shadow-sm h-[calc(100vh-80px)] overflow-y-auto py-4 ${expanded ? 'px-3' : 'px-1.5'}`}>
        {/* 토글 버튼 */}
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? '타임라인 접기' : '타임라인 펼치기'}
          title={expanded ? '접기' : '전체 경험 보기'}
          className={`w-full flex items-center justify-center gap-1.5 mb-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-colors ${
            expanded ? 'text-bluewood-700 hover:bg-surface-100' : 'text-bluewood-400 hover:bg-surface-100'
          }`}
        >
          {expanded ? (<><span>경험</span><ChevronRight size={15} /></>) : <ChevronLeft size={15} />}
        </button>

        <div className="relative">
          {/* 세로 연결선 */}
          <div className={`absolute ${expanded ? 'left-[18px]' : 'left-[17px]'} top-4 bottom-4 w-[2px] bg-surface-100`} />
          <div className="space-y-1">
            {experiences.map((exp, idx) => {
              const isCurrent = exp.id === currentId;
              const title = exp.title ? String(exp.title).replace(/\*\*/g, '') : `P${idx + 1}`;
              const periodLabel = parsePeriodStr(exp);

              return (
                <button
                  key={exp.id}
                  onClick={() => { if (!isCurrent) navigate(`/app/experience/structured/${exp.id}?view=true`); }}
                  title={expanded ? undefined : title}
                  className={`relative w-full flex items-center gap-2.5 rounded-xl text-left transition-all duration-200 ${
                    expanded ? 'px-2 py-3' : 'px-0 py-2 justify-center'
                  } ${
                    isCurrent
                      ? expanded ? 'bg-bluewood-50/80' : ''
                      : 'hover:bg-surface-50 cursor-pointer'
                  }`}
                >
                  {/* 활성 바 */}
                  {isCurrent && expanded && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary-600 rounded-r-full" />
                  )}
                  {/* 번호 원 */}
                  <span className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-200 ${
                    isCurrent
                      ? 'bg-primary-600 text-white shadow-md shadow-bluewood-200/50'
                      : 'bg-surface-100 border-2 border-surface-200 text-bluewood-400'
                  }`}>
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {/* 텍스트 (펼쳐진 상태에만) */}
                  {expanded && (
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14px] leading-tight truncate transition-colors duration-200 ${
                        isCurrent ? 'text-primary-600 font-bold' : 'text-bluewood-600 font-medium'
                      }`}>
                        {title}
                      </p>
                      {periodLabel && (
                        <p className={`text-[13px] mt-0.5 ${isCurrent ? 'text-bluewood-400' : 'text-bluewood-300'}`}>
                          {periodLabel}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// 공백 정규화 후 위치 찾기
function fuzzyIndexOf(text, needle) {
  const exact = text.indexOf(needle);
  if (exact >= 0) return { pos: exact, len: needle.length };

  const normalize = s => s.replace(/\s+/g, ' ').trim();
  const normText = normalize(text);
  const normNeedle = normalize(needle);
  if (!normNeedle) return null;

  const normPos = normText.indexOf(normNeedle);
  if (normPos < 0) {
    const shorter = normNeedle.length > 15 ? normNeedle.slice(0, Math.floor(normNeedle.length * 0.7)) : null;
    if (shorter) {
      const partialPos = normText.indexOf(shorter);
      if (partialPos >= 0) {
        let origPos = 0, normIdx = 0;
        while (normIdx < partialPos && origPos < text.length) {
          if (/\s/.test(text[origPos])) { while (origPos < text.length && /\s/.test(text[origPos])) origPos++; normIdx++; }
          else { origPos++; normIdx++; }
        }
        let endNormIdx = normIdx, endOrigPos = origPos;
        while (endNormIdx < partialPos + normNeedle.length && endOrigPos < text.length) {
          if (/\s/.test(text[endOrigPos])) { while (endOrigPos < text.length && /\s/.test(text[endOrigPos])) endOrigPos++; endNormIdx++; }
          else { endOrigPos++; endNormIdx++; }
        }
        return { pos: origPos, len: endOrigPos - origPos };
      }
    }
    return null;
  }

  let origPos = 0, normIdx = 0;
  while (normIdx < normPos && origPos < text.length) {
    if (/\s/.test(text[origPos])) { while (origPos < text.length && /\s/.test(text[origPos])) origPos++; normIdx++; }
    else { origPos++; normIdx++; }
  }
  let endOrigPos = origPos, endNormIdx = normIdx;
  while (endNormIdx < normPos + normNeedle.length && endOrigPos < text.length) {
    if (/\s/.test(text[endOrigPos])) { while (endOrigPos < text.length && /\s/.test(text[endOrigPos])) endOrigPos++; endNormIdx++; }
    else { endOrigPos++; endNormIdx++; }
  }
  return { pos: origPos, len: endOrigPos - origPos };
}

function SentenceKwSpan({ text, color, keywords }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const spanRef = useRef(null);

  const handleEnter = () => {
    setVisible(true);
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setPos({ left: rect.left + rect.width / 2, top: rect.top - 8 });
    }
  };

  return (
    <span className="relative inline">
      <span
        ref={spanRef}
        className="cursor-help"
        style={{ borderBottom: `2px solid ${color}`, paddingBottom: '1px' }}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setVisible(false)}
      >{text}</span>
      {visible && createPortal(
        <span
          className="fixed z-[9999] whitespace-normal max-w-[240px] bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl pointer-events-none flex flex-col gap-2"
          style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)' }}
        >
          <span className="text-[13px] font-semibold text-gray-100">역량 키워드</span>
          <span className="text-[14px] text-gray-400 leading-relaxed">이 경험 서술 전체를 AI가 분석해 도출한 역량 키워드예요. 밑줄 친 문장에서 해당 역량이 드러납니다.</span>
          <span className="flex flex-wrap gap-1 border-t border-white/10 pt-1.5">
            {keywords.map(k => (
              <span key={k} className="px-1.5 py-0.5 rounded-md text-[14px] leading-tight bg-white/20">{k}</span>
            ))}
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 bg-gray-900 rotate-45" />
        </span>,
        document.body
      )}
    </span>
  );
}

function HighlightSpan({ text, type, keywords }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const spanRef = useRef(null);
  const color = highlightColors[type] || highlightColors.core;

  const handleEnter = () => {
    setVisible(true);
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setPos({ left: rect.left + rect.width / 2, top: rect.top - 8 });
    }
  };

  return (
    <span className="relative inline">
      <span
        ref={spanRef}
        className="cursor-help font-medium transition-colors"
        style={{
          borderBottom: `2.5px solid ${color.underline}`,
          paddingBottom: '1px',
          backgroundColor: `${color.underline}10`,
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setVisible(false)}
      >{text}</span>
      {visible && createPortal(
        <span
          className="fixed z-[9999] whitespace-normal max-w-[260px] bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl pointer-events-none flex flex-col gap-2"
          style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -100%)' }}
        >
          <span className="flex items-center gap-1.5 font-bold text-[14px]">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
            {color.label}
          </span>
          <span className="text-gray-300 text-[13px] leading-relaxed">{color.desc}</span>
          {keywords.length > 0 && (
            <span className="flex flex-wrap gap-1 border-t border-white/10 pt-1.5">
              {keywords.map(k => (
                <span key={k} className="px-1.5 py-0.5 bg-white/20 rounded-md text-[14px] leading-tight">{k}</span>
              ))}
            </span>
          )}
          {/* 말풍선 꼬리 */}
          <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 bg-gray-900 rotate-45" />
        </span>,
        document.body
      )}
    </span>
  );
}

/* 키워드 매칭 색상 (역량 키워드별 색상 로테이션) */
const KEYWORD_COLORS = [
  '#3b82f6', '#ef4444', '#8b5cf6', '#f59e0b', '#22c55e',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

function HighlightedText({ text, highlights, keywords = [], showKeywordUnderline = false }) {
  if (!text) return <p></p>;
  const cleanText = stripMarkdown(text);

  /* 1단계: 구조화 하이라이트 위치 계산 */
  const positioned = (highlights || [])
    .map(h => {
      const needle = stripMarkdown(h.text?.trim() ?? '');
      if (!needle) return null;
      if (h.start != null) return { ...h, pos: h.start, len: needle.length };
      const match = fuzzyIndexOf(cleanText, needle);
      if (!match) return null;
      return { ...h, pos: match.pos, len: match.len };
    })
    .filter(Boolean)
    .sort((a, b) => a.pos - b.pos);

  /* 2단계: 하이라이트 구절 → 문장 단위로 확장 */
  const expandToSentence = (pos, len) => {
    let start = pos;
    while (start > 0 && !/[.!?\n]/.test(cleanText[start - 1])) start--;
    while (start < pos && /\s/.test(cleanText[start])) start++;
    let end = pos + len;
    while (end < cleanText.length && !/[.!?\n]/.test(cleanText[end])) end++;
    if (end < cleanText.length) end++;
    return { start, end };
  };

  // 문장 범위로 확장 후 겹치는 범위 병합
  const typePriority = { core: 0, derived: 1, growth: 2 };
  const sentenceRanges = positioned.map(h => ({ ...h, ...expandToSentence(h.pos, h.len) }));
  const merged = [];
  for (const r of sentenceRanges) {
    if (merged.length > 0 && r.start <= merged[merged.length - 1].end) {
      const last = merged[merged.length - 1];
      last.end = Math.max(last.end, r.end);
      last.keywords = [...new Set([...last.keywords, ...(r.keywords || [])])];
      if ((typePriority[r.type] ?? 99) < (typePriority[last.type] ?? 99)) last.type = r.type;
    } else {
      merged.push({ ...r, keywords: [...(r.keywords || [])] });
    }
  }

  // parts 구성 (문장 단위 하이라이트 적용)
  let parts = [];
  if (merged.length > 0) {
    let lastIndex = 0;
    for (const r of merged) {
      if (r.start < lastIndex) continue;
      if (r.start > lastIndex) parts.push({ text: cleanText.slice(lastIndex, r.start), type: null, keywords: [] });
      parts.push({ text: cleanText.slice(r.start, r.end), type: r.type || 'core', keywords: r.keywords });
      lastIndex = r.end;
    }
    if (lastIndex < cleanText.length) parts.push({ text: cleanText.slice(lastIndex), type: null, keywords: [] });
  } else {
    parts = [{ text: cleanText, type: null, keywords: [] }];
  }

  /* 3단계: 역량 키워드 밑줄 */
  const kwMap = new Map();
  if (showKeywordUnderline && keywords.length > 0) {
    keywords.forEach((kw, i) => {
      kwMap.set(kw.toLowerCase(), KEYWORD_COLORS[i % KEYWORD_COLORS.length]);
    });
  }

  /* 키워드 밑줄 적용 함수: 문장 단위로 확장 후 밑줄 + 말풍선 */
  const applyKeywordUnderlines = (str) => {
    if (kwMap.size === 0) return str;

    // 키워드 위치 수집
    const matches = [];
    for (const [kw, color] of kwMap) {
      const lower = str.toLowerCase();
      let idx = 0;
      while (true) {
        const found = lower.indexOf(kw, idx);
        if (found === -1) break;
        matches.push({ pos: found, len: kw.length, kw, color });
        idx = found + 1;
      }
    }
    if (matches.length === 0) return str;
    matches.sort((a, b) => a.pos - b.pos);

    // 문장 단위로 확장
    const expandSent = (pos, len) => {
      let start = pos;
      while (start > 0 && !/[.!?\n]/.test(str[start - 1])) start--;
      while (start < pos && /\s/.test(str[start])) start++;
      let end = pos + len;
      while (end < str.length && !/[.!?\n]/.test(str[end])) end++;
      if (end < str.length) end++;
      return { start, end };
    };

    // 겹치는 문장 범위 병합
    const sentRanges = matches.map(m => ({ ...m, ...expandSent(m.pos, m.len) }));
    const merged = [];
    for (const r of sentRanges) {
      if (merged.length > 0 && r.start <= merged[merged.length - 1].end) {
        const last = merged[merged.length - 1];
        last.end = Math.max(last.end, r.end);
        if (!last.keywords.includes(r.kw)) last.keywords.push(r.kw);
      } else {
        merged.push({ ...r, keywords: [r.kw] });
      }
    }

    // 결과 조합
    const result = [];
    let lastIdx = 0;
    for (const r of merged) {
      if (r.start > lastIdx) result.push(str.slice(lastIdx, r.start));
      result.push(
        <SentenceKwSpan key={`skw-${r.start}`} text={str.slice(r.start, r.end)} color={r.color} keywords={r.keywords} />
      );
      lastIdx = r.end;
    }
    if (lastIdx < str.length) result.push(str.slice(lastIdx));
    return result;
  };

  return (
    <p>
      {parts.map((part, i) =>
        part.type ? (
          <HighlightSpan key={i} text={part.text} type={part.type} keywords={part.keywords} />
        ) : (
          <span key={i}>{applyKeywordUnderlines(part.text)}</span>
        )
      )}
    </p>
  );
}

const SIZE_OPTIONS = [
  { value: 'sm', label: 'S', w: 'max-w-[140px]' },
  { value: 'md', label: 'M', w: 'max-w-[280px]' },
  { value: 'lg', label: 'L', w: 'max-w-full' },
];

function SectionImageGroup({ sectionKey, position, sectionImages, allImages, imageConfig, setImageConfig, dragInfo, dropTarget, setDropTarget, handleDragStart, handleDragEnd, handleImageDrop }) {
  const imgIndices = sectionImages[sectionKey] || [];
  const filtered = imgIndices.map((imgIdx, pos) => ({ imgIdx, pos })).filter(({ imgIdx }) => {
    const cfg = imageConfig[`${sectionKey}:${imgIdx}`] || {};
    const imgPos = cfg.position || 'below';
    return imgPos === position;
  });
  if (filtered.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-3 ${position === 'above' ? 'mb-3' : 'mt-3'}`}>
      {filtered.map(({ imgIdx, pos }) => {
        const img = allImages[imgIdx];
        if (!img) return null;
        const cfgKey = `${sectionKey}:${imgIdx}`;
        const cfg = imageConfig[cfgKey] || {};
        const size = cfg.size || 'md';
        const sizeOpt = SIZE_OPTIONS.find(s => s.value === size) || SIZE_OPTIONS[1];

        const togglePosition = () => {
          setImageConfig(prev => ({
            ...prev,
            [cfgKey]: { ...(prev[cfgKey] || {}), position: position === 'above' ? 'below' : 'above' },
          }));
        };

        const cycleSize = () => {
          const idx = SIZE_OPTIONS.findIndex(s => s.value === size);
          const next = SIZE_OPTIONS[(idx + 1) % SIZE_OPTIONS.length];
          setImageConfig(prev => ({
            ...prev,
            [cfgKey]: { ...(prev[cfgKey] || {}), size: next.value },
          }));
        };

        return (
          <div
            key={`img-${sectionKey}-${imgIdx}-${position}`}
            className="relative"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(`${sectionKey}:${pos}`); }}
            onDrop={(e) => { e.stopPropagation(); handleImageDrop(e, sectionKey, pos); }}
          >
            {dropTarget === `${sectionKey}:${pos}` && dragInfo && !(dragInfo.fromSection === sectionKey && dragInfo.position === pos) && (
              <div className="absolute -left-1.5 top-0 bottom-0 w-1 bg-bluewood-400 rounded-full z-10" />
            )}
            <div
              draggable
              onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, sectionKey, pos); }}
              onDragEnd={handleDragEnd}
              className={`relative group cursor-grab active:cursor-grabbing ${sizeOpt.w}`}
            >
              <img src={img.url} alt={img.name || '이미지'} className={`w-full rounded-lg border border-surface-200 shadow-sm hover:shadow-md transition-shadow ${size === 'sm' ? 'h-24 object-cover' : ''}`} />
              {/* Overlay controls */}
              <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <div className="bg-black/60 rounded-md p-0.5">
                  <GripVertical size={14} className="text-white" />
                </div>
              </div>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePosition(); }}
                  className="bg-black/60 text-white text-[13px] font-bold px-1.5 py-0.5 rounded-md hover:bg-black/80"
                  title={position === 'above' ? '글 아래로' : '글 위로'}
                >
                  {position === 'above' ? '↓' : '↑'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cycleSize(); }}
                  className="bg-black/60 text-white text-[13px] font-bold px-1.5 py-0.5 rounded-md hover:bg-black/80"
                  title="크기 변경"
                >
                  {sizeOpt.label}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
