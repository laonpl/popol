import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Save, Loader2, PenLine, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, ImagePlus, Target, Globe, X, RotateCcw, RotateCw, ChevronLeft, ChevronRight, Trash2, Plus, LayoutGrid, ExternalLink, GripVertical as Grip, MoveUp, MoveDown, Eye, EyeOff } from 'lucide-react';
import { doc, getDoc, updateDoc } from '../../services/firestoreProxy';
import { db } from '../../config/firebase';
import { FRAMEWORKS, JOB_CATEGORIES, JOB_SPECIFIC_FIELDS } from '../../stores/experienceStore';
import { computeDevDiagnostic, getJobPortfolioMeta } from '../../utils/devPortfolio';
import VisualDataEditor from '../../components/portfolio/VisualDataEditor';
import useExperienceStore from '../../stores/experienceStore';
import useAuthStore from '../../stores/authStore';
import KeyExperienceSlider from '../../components/KeyExperienceSlider';
import ProjectDetailModal from '../../components/ProjectDetailModal';
import { JobAnalysisBadge } from '../../components/JobLinkInput';
import { mergeStructuredIntoCaseStudy } from '../../utils/caseStudySync';
import { normalizeExperienceForCurrentJob } from '../../utils/experienceCompatibility';
import { analyzeJobUrl } from '../../services/jobAI';
import FeedbackModal, { isFeedbackSnoozed } from '../../components/FeedbackModal';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
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

/* AI가 빈약한 입력에서 프롬프트 지시문/예시를 그대로 뱉는 경우가 있어,
   표시 단계에서 "지시문/플레이스홀더"를 감지해 비운다. */
function isInstructionLike(text) {
  const t = stripMarkdown(text || '').trim();
  if (!t) return true;
  if (t.startsWith('[작성 필요]') || t.startsWith('[검증 필요]')) return true;
  if (/\(예시\)/.test(t)) return true;                 // (예시) 표기
  if (/【[^】]*】/.test(t)) return true;                // 【XYZ 공식】 등 지시 블록
  if (/(공식에 맞춰|작성하세요|반영하세요|포함하세요|서술하세요|남기세요|적어주세요)/.test(t)) return true;
  if (/^\[[^\]]{1,20}\]\s*\S/.test(t) && /(구조|형식|공식|패턴|가이드)/.test(t.slice(0, 24))) return true; // [파이프라인 구조] ...
  return false;
}
/* 표시용 정리: 지시문/플레이스홀더면 빈 문자열, 아니면 마크다운 제거 텍스트 */
function cleanForDisplay(text) {
  return isInstructionLike(text) ? '' : stripMarkdown(text).trim();
}

function sanitizeTextObject(obj = {}) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, typeof value === 'string' ? sanitizeTextValue(value) : value]));
}

function makeTextBlock(content = '') {
  return { id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'text', content: sanitizeTextValue(content) };
}

function isValidHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function normalizeInfographicCard(card = {}, index = 0) {
  const bars = Array.isArray(card.bars) ? card.bars.map(bar => ({
    label: sanitizeTextValue(bar?.label || '').slice(0, 40),
    value: numberOrNull(bar?.value),
    unit: sanitizeTextValue(bar?.unit || card.unit || '%').slice(0, 8),
  })).filter(bar => bar.label && bar.value != null).slice(0, 5) : [];
  const value = numberOrNull(card.value);
  const chartType = ['donut', 'bar', 'stat'].includes(card.chartType)
    ? card.chartType
    : (bars.length ? 'bar' : 'stat');
  return {
    id: card.id || `research-card-${index + 1}`,
    question: sanitizeTextValue(card.question || '').slice(0, 90),
    finding: sanitizeTextValue(card.finding || '').slice(0, 160),
    chartType,
    value,
    unit: sanitizeTextValue(card.unit || '%').slice(0, 8),
    valueLabel: sanitizeTextValue(card.valueLabel || '').slice(0, 44),
    remainderLabel: sanitizeTextValue(card.remainderLabel || '').slice(0, 44),
    sampleBase: sanitizeTextValue(card.sampleBase || '').slice(0, 90),
    bars,
    sourceTitle: sanitizeTextValue(card.sourceTitle || '').slice(0, 140),
    sourcePublisher: sanitizeTextValue(card.sourcePublisher || '').slice(0, 80),
    sourceUrl: sanitizeTextValue(card.sourceUrl || ''),
    checkedAt: sanitizeTextValue(card.checkedAt || '').slice(0, 24),
    interpretation: sanitizeTextValue(card.interpretation || '').slice(0, 140),
  };
}

function normalizeDeskResearchInfographic(value = {}) {
  const cards = Array.isArray(value.cards)
    ? value.cards.map(normalizeInfographicCard).filter(card => (
      isValidHttpUrl(card.sourceUrl)
      && (card.value != null || card.bars.length > 0)
    )).slice(0, 4)
    : [];
  return {
    title: sanitizeTextValue(value.title || '').slice(0, 100),
    subtitle: sanitizeTextValue(value.subtitle || '').slice(0, 180),
    cards,
    conclusion: sanitizeTextValue(value.conclusion || '').slice(0, 220),
    limitations: sanitizeTextValue(value.limitations || '').slice(0, 220),
  };
}

function infographicToText(infographic = {}) {
  const info = normalizeDeskResearchInfographic(infographic);
  return [
    info.title,
    info.subtitle,
    ...info.cards.map(card => [
      card.question,
      card.finding,
      card.value != null ? `${card.valueLabel || '수치'}: ${card.value}${card.unit || ''}` : '',
      card.bars.map(bar => `${bar.label} ${bar.value}${bar.unit}`).join(', '),
      card.sourcePublisher || card.sourceTitle ? `출처: ${[card.sourcePublisher, card.sourceTitle].filter(Boolean).join(' · ')}` : '',
      card.sourceUrl,
      card.interpretation,
    ].filter(Boolean).join('\n')),
    info.conclusion,
    info.limitations && `한계: ${info.limitations}`,
  ].filter(Boolean).join('\n\n');
}

function makeInfographicBlock(infographic = {}) {
  return {
    id: `infographic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'infographic',
    infographic: normalizeDeskResearchInfographic(infographic),
  };
}

function portfolioBlocksToText(blocks = []) {
  return blocks.map(block => {
    if (block?.type === 'text') return sanitizeTextValue(block.content || '');
    if (block?.type === 'slide') {
      const cardText = (block.cards || []).map(card => [card.label, card.title, card.body, card.metric].filter(Boolean).join(' ')).filter(Boolean).join('\n');
      return [block.title, block.subtitle, block.content, cardText].filter(Boolean).map(sanitizeTextValue).join('\n');
    }
    if (block?.type === 'infographic') return infographicToText(block.infographic);
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
  if (block.type === 'infographic') {
    return {
      id: block.id || `infographic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'infographic',
      infographic: normalizeDeskResearchInfographic(block.infographic || block),
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

function clampPercent(value) {
  const n = numberOrNull(value);
  if (n == null) return 0;
  return Math.max(0, Math.min(100, n));
}

function ResearchDonut({ card }) {
  const value = clampPercent(card.value);
  const rest = Math.max(0, 100 - value);
  return (
    <div className="flex items-center justify-center gap-4">
      <div
        className="relative h-28 w-28 flex-shrink-0 rounded-full"
        style={{ background: `conic-gradient(#6947f5 0 ${value}%, #c9c5ce ${value}% 100%)` }}
        aria-label={`${card.valueLabel || '값'} ${card.value}${card.unit || ''}`}
      >
        <div className="absolute inset-[24px] rounded-full bg-[#f1eff3]" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-black text-[#6947f5]">{card.valueLabel || '주요 응답'}</p>
        <p className="mt-0.5 text-[30px] font-black leading-none text-[#6947f5]">{card.value}{card.unit || ''}</p>
        {card.remainderLabel && (
          <p className="mt-2 text-[12px] font-bold text-bluewood-300">{card.remainderLabel} {Math.round(rest * 10) / 10}{card.unit || ''}</p>
        )}
      </div>
    </div>
  );
}

function ResearchBars({ card }) {
  const bars = card.bars || [];
  const max = Math.max(...bars.map(bar => Math.abs(bar.value || 0)), 1);
  return (
    <div className="space-y-2.5">
      {bars.map((bar, index) => {
        const width = Math.max(7, Math.min(100, Math.abs(bar.value || 0) / max * 100));
        const active = index === 0;
        return (
          <div key={`${bar.label}-${index}`}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={`truncate text-[12px] font-black ${active ? 'text-white' : 'text-bluewood-600'}`}>{bar.label}</span>
              <span className={`text-[12px] font-black ${active ? 'text-[#6947f5]' : 'text-bluewood-400'}`}>{bar.value}{bar.unit || card.unit || ''}</span>
            </div>
            <div className="h-8 rounded-md bg-[#cbc7cd]">
              <div
                className={`flex h-8 items-center rounded-md px-3 text-[12px] font-black text-white ${active ? 'bg-[#6947f5]' : 'bg-[#a9a5ac]'}`}
                style={{ width: `${width}%`, minWidth: '64px' }}
              >
                {bar.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResearchStat({ card }) {
  return (
    <div className="rounded-xl bg-white/70 px-4 py-5 text-center">
      <p className="text-[13px] font-black text-bluewood-400">{card.valueLabel || '핵심 수치'}</p>
      <p className="mt-2 text-[38px] font-black leading-none text-[#6947f5]">{card.value}{card.unit || ''}</p>
      {card.sampleBase && <p className="mt-2 text-[12px] font-semibold text-bluewood-400">{card.sampleBase}</p>}
    </div>
  );
}

function ResearchChart({ card }) {
  if (card.chartType === 'bar' && card.bars?.length) return <ResearchBars card={card} />;
  if (card.chartType === 'stat') return <ResearchStat card={card} />;
  return <ResearchDonut card={card} />;
}

function DeskResearchInfographic({ infographic, compact = false }) {
  const info = normalizeDeskResearchInfographic(infographic);
  if (info.cards.length === 0) return null;
  return (
    <section className={`overflow-hidden rounded-[8px] bg-[#f7f6f8] ${compact ? 'p-5' : 'p-8'} text-bluewood-900`}>
      <div className="mb-7">
        <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#6947f5]">Desk Research</p>
        <h3 className={`${compact ? 'mt-2 text-[22px]' : 'mt-3 text-[31px]'} font-black leading-tight tracking-normal text-bluewood-950`} style={{ wordBreak: 'keep-all' }}>
          {info.title || '이 프로젝트와 연결되는 시장 문제는 무엇일까요?'}
        </h3>
        {info.subtitle && <p className="mt-4 text-[13.5px] font-medium leading-relaxed text-bluewood-500">{info.subtitle}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {info.cards.map((card, index) => (
          <article key={card.id || index} className="rounded-[18px] bg-[#ebe9ee] p-5 shadow-sm">
            <div className="min-h-[86px]">
              <p className="text-[15px] font-black leading-snug text-bluewood-950" style={{ wordBreak: 'keep-all' }}>{card.question || `Q${index + 1}. 시장 근거`}</p>
              {card.finding && <p className="mt-1.5 text-[14px] font-bold leading-snug text-[#6947f5]" style={{ wordBreak: 'keep-all' }}>{card.finding}</p>}
              <p className="mt-3 text-[11.5px] font-semibold text-bluewood-400">
                출처: {card.sourcePublisher || card.sourceTitle || '확인된 자료'}
              </p>
            </div>
            <div className="mt-4">
              <ResearchChart card={card} />
            </div>
            {card.sampleBase && <p className="mt-3 text-right text-[11.5px] font-semibold text-bluewood-400">{card.sampleBase}</p>}
            {card.interpretation && (
              <div className="mt-4 rounded-[10px] bg-[#4f4852] px-4 py-3 text-center text-[13px] font-black leading-snug text-white" style={{ wordBreak: 'keep-all' }}>
                {card.interpretation}
              </div>
            )}
            {isValidHttpUrl(card.sourceUrl) && (
              <a href={card.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex max-w-full items-center gap-1 text-[11.5px] font-semibold text-primary-600 underline">
                <ExternalLink size={11} /> <span className="truncate">{card.sourceTitle || card.sourceUrl}</span>
              </a>
            )}
          </article>
        ))}
      </div>

      {info.conclusion && (
        <div className="mt-5 rounded-[14px] bg-[#4f4852] px-5 py-4 text-center text-[15px] font-black leading-relaxed text-white" style={{ wordBreak: 'keep-all' }}>
          {info.conclusion}
        </div>
      )}
      {info.limitations && (
        <p className="mt-3 text-[12px] leading-relaxed text-bluewood-400" style={{ wordBreak: 'keep-all' }}>해석 한계: {info.limitations}</p>
      )}
    </section>
  );
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
        if (block.type === 'infographic') {
          return <DeskResearchInfographic key={block.id} infographic={block.infographic} compact={compact} />;
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
  core:    { underline: '#ef4444', hl: 'rgba(239,68,68,0.30)',  bg: 'bg-red-50',   label: '핵심 역량', desc: '이 경험에서 발휘된 핵심 역량입니다',       dot: 'bg-red-400',   text: 'text-red-700'   },
  derived: { underline: '#f59e0b', hl: 'rgba(245,158,11,0.32)', bg: 'bg-amber-50', label: '파생 역량', desc: '핵심 역량에서 파생된 부가적인 역량입니다', dot: 'bg-amber-400', text: 'text-amber-700' },
  growth:  { underline: '#22c55e', hl: 'rgba(34,197,94,0.30)',  bg: 'bg-green-50', label: '성장 관점', desc: '이 경험을 통해 성장하거나 배운 내용입니다', dot: 'bg-green-400', text: 'text-green-700' },
};
// 형광펜 스타일 — 글자 아래쪽만 마커로 덮음 (밑줄 대신)
const hlMarker = (rgba) => ({
  background: `linear-gradient(180deg, transparent 40%, ${rgba} 40%)`,
  padding: '0 3px 1px',
  borderRadius: '2px',
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
});

/* ── 근거 레벨 (A~D) — 주장의 증거 강도. 보고서: A 직접증거 ~ D 추정 ── */
const EVIDENCE_LEVELS = {
  A: { name: '직접 증거', desc: '시스템 로그·원본 문서·배포물', color: '#16a34a', bg: 'bg-green-50',  text: 'text-green-700',  ring: 'ring-green-200'  },
  B: { name: '기록 증거', desc: '회의록·피드백·이메일',       color: '#0284c7', bg: 'bg-sky-50',    text: 'text-sky-700',    ring: 'ring-sky-200'    },
  C: { name: '회상·증언', desc: '기억 회상·동료 증언',         color: '#d97706', bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200'  },
  D: { name: '추정',     desc: '근거가 약한 추정치·가정',     color: '#dc2626', bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-200'    },
};
const EVIDENCE_ORDER = ['A', 'B', 'C', 'D'];

/* ── 인라인 사실/추정 라벨 — 본문에 [사실]/[추정]/[가정]/[해석] 토큰을 칩으로 표시 ── */
const EVIDENCE_TAGS = {
  사실: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-200' },
  추정: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  가정: { bg: 'bg-red-50',   text: 'text-red-700',   ring: 'ring-red-200'   },
  해석: { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200' },
};
const EVIDENCE_TAG_SPLIT_RE = /(\[(?:사실|추정|가정|해석)\])/g;

function EvidenceTag({ kind }) {
  const t = EVIDENCE_TAGS[kind];
  if (!t) return null;
  return <span className={`mx-0.5 inline-flex items-center rounded px-1 py-px align-middle text-[11px] font-bold ${t.bg} ${t.text} ring-1 ${t.ring}`}>{kind}</span>;
}

/* ── 섹션 근거 바: 주장 성격(사실/추정/가정/해석) + 근거 레벨(A~D) 단일 선택 ── */
function SectionEvidenceBar({ claim, level, onClaim, onLevel, viewOnly }) {
  if (viewOnly) {
    if (!claim && !level) return null;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {claim && <EvidenceTag kind={claim} />}
        {level && EVIDENCE_LEVELS[level] && (
          <span
            className={`inline-flex items-center rounded px-1.5 py-px text-[11px] font-bold ${EVIDENCE_LEVELS[level].bg} ${EVIDENCE_LEVELS[level].text} ring-1 ${EVIDENCE_LEVELS[level].ring}`}
            title={EVIDENCE_LEVELS[level].desc}
          >
            근거 {level} · {EVIDENCE_LEVELS[level].name}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* 주장 성격 */}
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-surface-200 bg-white p-0.5">
        <span className="px-1.5 text-[10px] font-bold text-bluewood-300">성격</span>
        {Object.keys(EVIDENCE_TAGS).map(kind => {
          const on = claim === kind;
          const t = EVIDENCE_TAGS[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onClaim(kind)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-all ${on ? `${t.bg} ${t.text} ring-1 ${t.ring}` : 'text-bluewood-300 hover:bg-surface-50 hover:text-bluewood-500'}`}
            >
              {kind}
            </button>
          );
        })}
      </div>
      {/* 근거 레벨 */}
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-surface-200 bg-white p-0.5" title="근거 강도 (A 직접증거 ~ D 추정)">
        <span className="px-1.5 text-[10px] font-bold text-bluewood-300">근거</span>
        {EVIDENCE_ORDER.map(lv => {
          const on = level === lv;
          const m = EVIDENCE_LEVELS[lv];
          return (
            <button
              key={lv}
              type="button"
              onClick={() => onLevel(lv)}
              title={`${m.name} — ${m.desc}`}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black transition-all ${on ? `${m.bg} ${m.text} ring-1 ${m.ring}` : 'text-bluewood-300 hover:bg-surface-50 hover:text-bluewood-500'}`}
            >
              {lv}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

  // 각 역량을 "어디서 얻었는지(source) + 근거(evidence) + 역량 키워드"로 정리
  const items = [];
  const seen = new Set();
  const push = (type, source, evidence, kws = []) => {
    const body = clean(evidence);
    if (!body) return;
    const t = TYPE_ORDER.includes(type) ? type : 'core';
    const sig = `${t}|${clean(source)}|${body}`.replace(/\s+/g, ' ').toLowerCase();
    if (seen.has(sig)) return;
    seen.add(sig);
    items.push({ type: t, source: clean(source) || '본문', evidence: body, keywords: (kws || []).map(clean).filter(Boolean) });
  };

  // 본문 하이라이트: 어느 섹션에서 나온 근거인지 함께 표시
  (highlights || []).forEach(h => push(h.type, SECTION_META[h.field]?.label || '본문', h.text, h.keywords));
  // 핵심 경험에서 배운 점: 어떤 경험에서 얻은 역량인지 표시
  (keyExperiences || []).forEach(ke => { if (!isDraft(ke.learning)) push('growth', clean(ke.title) || '핵심 경험', ke.learning, ke.keywords); });
  if (items.filter(i => i.type === 'growth').length === 0) splitSentences(growthText, 2).forEach(s => push('growth', '성장 경험', s));

  const relatedKeywords = [...new Set((keywords || []).map(clean).filter(Boolean))];

  const groups = TYPE_ORDER
    .map(t => ({ type: t, label: highlightColors[t].label, desc: highlightColors[t].desc, color: highlightColors[t].underline, items: items.filter(i => i.type === t) }))
    .filter(g => g.items.length > 0);

  // ── 요약용 집계 (실제 데이터 기반, 수치 조작 없음) ──
  const typeStats = groups.map(g => ({ type: g.type, label: g.label, color: g.color, count: g.items.length }));
  const kwFreq = {};
  items.forEach(it => it.keywords.forEach(k => { kwFreq[k] = (kwFreq[k] || 0) + 1; }));
  const topKeywords = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (groups.length === 0 && relatedKeywords.length === 0) return null;

  return (
    <div className="border border-surface-100 rounded-lg overflow-hidden mb-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-4 border-b border-surface-100">
        <span className="text-[17px] font-extrabold text-bluewood-900">핵심 역량</span>
        <span className="text-[13.5px] text-bluewood-400">— 어떤 경험에서 어떤 역량을 얻었는지 근거와 함께 정리했습니다</span>
      </div>

      {/* ── 나의 역량 한눈에 (요약 칩) ── */}
      {(typeStats.length > 0 || topKeywords.length > 0) && (
        <div className="px-6 py-5 border-b border-surface-100 bg-surface-50/40">
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-bluewood-400">나의 역량 한눈에</p>
          {typeStats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {typeStats.map(s => (
                <span key={s.type} className="inline-flex items-center gap-1.5 rounded-md border border-surface-200 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-bluewood-600">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                  <span className="font-extrabold tabular-nums" style={{ color: s.color }}>{s.count}</span>
                </span>
              ))}
            </div>
          )}
          {topKeywords.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold text-bluewood-400">발휘한 역량 키워드</p>
              <div className="flex flex-wrap gap-1.5">
                {topKeywords.map(([k, c]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-surface-200 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-bluewood-700">
                    {k}
                    {c >= 2 && <span className="rounded-full bg-primary-50 px-1.5 py-px text-[11px] font-bold tabular-nums text-primary-700">×{c}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {groups.length > 0 && (
        <div className="divide-y divide-surface-100">
          {groups.map(g => (
            <div key={g.type} className="px-6 py-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-[15px] font-bold text-bluewood-800">{g.label}</span>
                <span className="text-[13px] text-bluewood-300">· {g.desc}</span>
              </div>
              <div className="space-y-3">
                {g.items.map((it, i) => (
                  <div key={i} className="rounded-md border-l-[3px] bg-surface-50/60 px-4 py-3.5" style={{ borderColor: g.color }}>
                    {/* 어디서 → 어떤 역량 */}
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-extrabold" style={{ color: g.color }}>
                        <span className="rounded bg-white px-2 py-0.5 ring-1" style={{ color: g.color, borderColor: g.color }}>{it.source}</span>
                        에서
                      </span>
                      {it.keywords.length > 0 && <span className="text-[12px] text-bluewood-300">→</span>}
                      {it.keywords.map((k, ki) => (
                        <span key={ki} className="rounded-full px-2.5 py-0.5 text-[12.5px] font-bold" style={{ backgroundColor: `${g.color}1a`, color: g.color }}>{k}</span>
                      ))}
                    </div>
                    {/* 근거 */}
                    <p className="text-[14.5px] leading-[1.8] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>{it.evidence}</p>
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

function CompetencyMeterCompact({ highlights = [], keywords = [], keyExperiences = [], growthText = '' }) {
  const TYPE_ORDER = ['core', 'derived', 'growth'];
  const TYPE_META = {
    core: { label: '핵심 역량', shortLabel: '핵심', desc: '가장 직접적으로 드러난 강점', color: '#ef4444', bg: '#fef2f2' },
    derived: { label: '파생 역량', shortLabel: '파생', desc: '핵심 행동에서 함께 확장된 역량', color: '#f59e0b', bg: '#fffbeb' },
    growth: { label: '성장 관점', shortLabel: '성장', desc: '배운 점과 다음 적용점', color: '#22c55e', bg: '#f0fdf4' },
  };
  const SECTION_LABELS = {
    intro: '프로젝트 소개',
    overview: '프로젝트 개요',
    task: '진행한 일',
    process: '과정',
    output: '결과물',
    growth: '성장한 점',
    competency: '나의 역량',
  };
  const clean = (s) => stripMarkdown(String(s || '')).replace(/\s+/g, ' ').trim();
  const isDraft = (s) => !clean(s) || String(s).trim().startsWith('[작성 필요]');
  const shorten = (s, max = 128) => {
    const v = clean(s);
    return v.length > max ? `${v.slice(0, max - 1).trim()}…` : v;
  };

  const items = [];
  const seen = new Set();
  const push = (type, source, evidence, kws = []) => {
    const body = clean(evidence);
    if (!body) return;
    const t = TYPE_ORDER.includes(type) ? type : 'core';
    const signature = `${t}|${clean(source)}|${body}`.toLowerCase();
    if (seen.has(signature)) return;
    seen.add(signature);
    items.push({
      type: t,
      source: clean(source) || '본문',
      evidence: body,
      keywords: (kws || []).map(clean).filter(Boolean),
    });
  };

  (highlights || []).forEach(h => push(h.type, SECTION_LABELS[h.field] || '본문', h.text, h.keywords));
  (keyExperiences || []).forEach(ke => {
    if (!isDraft(ke.learning)) push('growth', clean(ke.title) || '핵심 경험', ke.learning, ke.keywords);
  });
  if (!items.some(item => item.type === 'growth')) {
    splitSentences(growthText, 2).forEach(sentence => push('growth', '성장한 점', sentence));
  }

  const relatedKeywords = [...new Set((keywords || []).map(clean).filter(Boolean))];
  const groups = TYPE_ORDER
    .map(type => ({ type, ...TYPE_META[type], items: items.filter(item => item.type === type) }))
    .filter(group => group.items.length > 0);
  const keywordCounts = {};
  items.forEach(item => item.keywords.forEach(keyword => { keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1; }));
  const topKeywords = Object.entries(keywordCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const totalEvidence = items.length;

  if (groups.length === 0 && relatedKeywords.length === 0) return null;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-surface-100 bg-white shadow-[0_6px_24px_rgba(15,40,80,0.05)]">
      <div className="flex flex-col gap-4 border-b border-surface-200 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary-600">Competency Map</p>
          <h2 className="mt-1 text-[20px] font-black text-bluewood-950">핵심 역량 한눈에 보기</h2>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
            경험에서 드러난 역량을 요약 보드로 압축했어요. 대표 근거만 먼저 보여주고, 긴 설명은 스토리 본문에서 확인할 수 있습니다.
          </p>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-4 lg:max-w-[520px]">
          <div className="rounded-lg border border-surface-200 bg-bluewood-950 px-3 py-2.5 text-white">
            <span className="text-[12px] font-bold text-white/70">근거</span>
            <p className="mt-1 text-[22px] font-black leading-none tabular-nums">{totalEvidence}</p>
          </div>
          {TYPE_ORDER.map(type => {
            const meta = TYPE_META[type];
            const count = groups.find(group => group.type === type)?.items.length || 0;
            return (
              <div key={type} className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-bluewood-500">{meta.shortLabel}</span>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
                </div>
                <p className="mt-1 text-[22px] font-black leading-none tabular-nums" style={{ color: meta.color }}>{count}</p>
              </div>
            );
          })}
        </div>
      </div>

      {(topKeywords.length > 0 || relatedKeywords.length > 0) && (
        <div className="border-b border-surface-200 bg-surface-50/50 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            {topKeywords.length > 0 && (
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-bluewood-400">반복해서 드러난 역량</p>
                <div className="flex flex-wrap gap-1.5">
                  {topKeywords.map(([keyword, count]) => (
                    <span key={keyword} className="inline-flex items-center gap-1.5 rounded-md border border-surface-200 bg-white px-2.5 py-1 text-[12.5px] font-bold text-bluewood-700">
                      {keyword}
                      {count >= 2 && <span className="rounded bg-primary-50 px-1.5 py-px text-[11px] font-black tabular-nums text-primary-700">x{count}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {relatedKeywords.length > 0 && (
              <div className="min-w-0 flex-1 lg:border-l lg:border-surface-200 lg:pl-5">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-bluewood-400">전체 키워드</p>
                <div className="flex flex-wrap gap-1.5">
                  {relatedKeywords.slice(0, 12).map((keyword, index) => (
                    <span key={`${keyword}-${index}`} className="rounded-full border border-surface-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-bluewood-600">{keyword}</span>
                  ))}
                  {relatedKeywords.length > 12 && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-bluewood-300">+{relatedKeywords.length - 12}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {groups.length > 0 ? (
        <div className="grid gap-3 p-5 lg:grid-cols-3">
          {groups.map(group => {
            const visibleItems = group.items.slice(0, 3);
            const hiddenCount = Math.max(0, group.items.length - visibleItems.length);
            const groupKeywords = [...new Set(group.items.flatMap(item => item.keywords || []))].slice(0, 5);

            return (
              <article key={group.type} className="min-w-0 overflow-hidden rounded-lg border border-surface-200 bg-white">
                <div className="border-b border-surface-100 px-4 py-3" style={{ backgroundColor: group.bg }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-black text-bluewood-950">{group.label}</h3>
                      <p className="mt-0.5 truncate text-[12px] font-medium text-bluewood-500">{group.desc}</p>
                    </div>
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[13px] font-black text-white tabular-nums" style={{ backgroundColor: group.color }}>
                      {group.items.length}
                    </span>
                  </div>
                  {groupKeywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {groupKeywords.map(keyword => (
                        <span key={keyword} className="rounded-full bg-white/80 px-2 py-0.5 text-[11.5px] font-bold" style={{ color: group.color }}>{keyword}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="divide-y divide-surface-100">
                  {visibleItems.map((item, index) => (
                    <div key={`${item.source}-${index}`} className="px-4 py-3">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                        <span className="truncate text-[12.5px] font-extrabold" style={{ color: group.color }}>{item.source}</span>
                      </div>
                      <p className="line-clamp-2 text-[13px] leading-[1.6] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>{shorten(item.evidence, 160)}</p>
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <div className="px-4 py-2.5 text-[12px] font-bold text-bluewood-300">대표 근거 외 {hiddenCount}개는 본문 하이라이트에서 확인</div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-4 text-[13.5px] leading-relaxed text-bluewood-500">
          아직 문장 근거가 충분하지 않아 키워드만 표시하고 있어요. 스토리 탭에서 행동, 결과, 배운 점을 더 채우면 역량 근거 카드가 자동으로 생성됩니다.
        </div>
      )}
    </section>
  );
}

function pickSectionFields(obj) {
  const result = {};
  for (const key of SECTION_KEYS) {
    const val = obj?.[key];
    const sv = typeof val === 'string' ? sanitizeTextValue(val) : '';
    // AI가 뱉은 지시문/예시 텍스트는 비워서 깨끗한 빈칸으로 시작
    result[key] = isInstructionLike(sv) ? '' : sv;
  }
  return result;
}

function normalizeMarketResearch(value) {
  const src = value || {};
  return {
    marketOverview: typeof src.marketOverview === 'string' ? src.marketOverview : '',
    deskResearchInfographic: normalizeDeskResearchInfographic(src.deskResearchInfographic),
    decisionMetrics: Array.isArray(src.decisionMetrics) ? src.decisionMetrics.map(item => ({
      metric: item?.metric || '',
      whyItMatters: item?.whyItMatters || '',
      recommendedProxy: item?.recommendedProxy || '',
      researchBasis: item?.researchBasis || '',
      confidence: item?.confidence || 'medium',
    })) : [],
    impactBridges: Array.isArray(src.impactBridges) ? src.impactBridges.map(item => ({
      userMetric: item?.userMetric || '',
      benchmark: item?.benchmark || '',
      interpretation: item?.interpretation || '',
      suggestedSentence: item?.suggestedSentence || '',
      sourceTitle: item?.sourceTitle || '',
      sourcePublisher: item?.sourcePublisher || '',
      sourceUrl: item?.sourceUrl || '',
      confidence: item?.confidence || 'medium',
    })).filter(item => item.userMetric && item.benchmark) : [],
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
  const cleanBody = cleanForDisplay(body).replace(/\s+/g, ' ').trim();
  return {
    label,
    title: cleanForDisplay(title),
    body: cleanBody,
    metric: (metric && !isInstructionLike(metric)) ? metric : extractMetricToken(cleanBody),
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
  // 지시문/예시 노출 방지: 정화 후 비면 라벨/빈값으로 폴백
  const headline = cleanForDisplay(fromAi.headline) || cleanForDisplay(sentences[0]) || SECTION_META[key]?.label || '';
  const subcopy = cleanForDisplay(fromAi.subcopy) || cleanForDisplay(sentences.slice(1, 4).join(' ')) || cleanForDisplay(content) || '';
  const fallbackCards = buildFallbackCards({ key, content, research, keyExperiences, overview });
  const aiCards = Array.isArray(fromAi.evidenceCards) && fromAi.evidenceCards.length > 0
    ? fromAi.evidenceCards.slice(0, 3).map(card => ({
      label: card?.label || 'RESEARCH',
      title: cleanForDisplay(card?.title),
      body: cleanForDisplay(card?.body),
      metric: (card?.metric && !isInstructionLike(card.metric)) ? card.metric : extractMetricToken(`${card?.title || ''} ${card?.body || ''}`),
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

/* 포트폴리오용 이미지 역할 — 면접관이 "무엇을 보여주는 사진인지" 바로 알 수 있게 */
const IMAGE_ROLES = ['화면', '결과물', '구조도', '데이터', '기타'];

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
  const updateCfg = (cfgKey, patch) => setImageConfig(prev => ({
    ...prev,
    [cfgKey]: { ...(prev[cfgKey] || {}), ...patch },
  }));

  return (
    <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-surface-200/70 pt-4">
      {images.map(({ imgIdx, img }) => {
        const cfgKey = `${sectionKey}:${imgIdx}`;
        const cfg = imageConfig?.[cfgKey] || {};
        const sizeKey = cfg.size || 'lg';
        const size = INLINE_IMAGE_SIZES[sizeKey] || INLINE_IMAGE_SIZES.lg;
        const showCaptionBar = !viewOnly || !!cfg.caption;

        return (
          <figure
            key={cfgKey}
            className="group flex flex-col overflow-hidden rounded-[8px] border border-surface-200 bg-white shadow-sm"
            style={{ width: size.width, minWidth: size.minWidth, maxWidth: '100%' }}
          >
            <div className="relative">
              <img src={img.url} alt={cfg.caption || img.name || '이미지'} className="block max-h-[360px] w-full object-contain" />
              {viewOnly && cfg.role && (
                <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">{cfg.role}</span>
              )}
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
            </div>
            {showCaptionBar && (
              <figcaption className="border-t border-surface-100 px-2.5 py-2">
                {!viewOnly ? (
                  <>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {IMAGE_ROLES.map(role => {
                        const on = cfg.role === role;
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => updateCfg(cfgKey, { role: on ? '' : role })}
                            className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold transition-colors ${on ? 'bg-primary-600 text-white' : 'bg-surface-100 text-bluewood-400 hover:bg-surface-200'}`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      value={cfg.caption || ''}
                      onChange={e => updateCfg(cfgKey, { caption: e.target.value })}
                      placeholder="이미지 설명(캡션)을 입력하세요"
                      className="w-full bg-transparent text-[12px] leading-snug text-bluewood-600 outline-none placeholder:text-bluewood-300"
                    />
                  </>
                ) : (
                  <p className="text-[12px] leading-snug text-bluewood-500">{cfg.caption}</p>
                )}
              </figcaption>
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
  const [dirty, setDirty] = useState(false);
  const [editedContent, setEditedContent] = useState({});
  const [evidenceLevels, setEvidenceLevels] = useState({}); // sectionKey → 'A'|'B'|'C'|'D'
  const [evidenceTags, setEvidenceTags] = useState({});     // sectionKey → '사실'|'추정'|'가정'|'해석'
  const [judgingLabels, setJudgingLabels] = useState(false);
  const [editingSections, setEditingSections] = useState({});
  const [editedTitle, setEditedTitle] = useState('');
  const [editedLink, setEditedLink] = useState('');
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
  const [showQualityPanel, setShowQualityPanel] = useState(false);
  const [activeQualityId, setActiveQualityId] = useState('sections');
  const [imageConfig, setImageConfig] = useState({});
  const [keyExpImages, setKeyExpImages] = useState({}); // 케이스 스터디에서 추가한 핵심 경험 사진 (index → [{url,width}])
  const detailSlidesRef = useRef(null);
  const imageInputRef = useRef(null);
  const [imageUploadTarget, setImageUploadTarget] = useState('_unassigned');
  const sectionTextareaRefs = useRef({});
  // 핵심 경험 리스트 ref (저장 시 편집 커밋용)
  const sliderRef = useRef(null);
  const [sectionSlideIdx, setSectionSlideIdx] = useState(0);
  // 고급수정 4탭: 스토리 / 핵심경험 / 분석 / 리서치
  // 진입 탭: 직군 특화 경험(포트폴리오)에서 '편집'으로 들어오면 역량·시장 근거 탭(직군 특화 섹션·차트 편집)으로 바로
  const initialTab = ['story', 'keyexp', 'analysis', 'coverletter'].includes(navState?.tab) ? navState.tab : 'story';
  const [activeTab, setActiveTab] = useState(initialTab);
  const mobileDefaultTabAppliedRef = useRef(false);

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
  const [editedVisuals, setEditedVisuals] = useState({}); // portfolioVisuals 차트 데이터 편집

  /* ── 포트폴리오 내보내기 커스텀 패널 ── */
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false); // 내보내기: 알려진 섹션 추가 드롭다운
  const [showProjectPreviewEditor, setShowProjectPreviewEditor] = useState(false);
  const [exportEnabled, setExportEnabled] = useState({});
  const [exportOrder, setExportOrder] = useState([]);
  const [exportCustomSections, setExportCustomSections] = useState([]);
  const [activeExportSectionKey, setActiveExportSectionKey] = useState(null);
  const [exportCoverImg, setExportCoverImg] = useState(null);
  const [projectNotionDoc, setProjectNotionDoc] = useState(null);
  const [exportDragKey, setExportDragKey] = useState(null);
  const [exportOverKey, setExportOverKey] = useState(null);
  const hasUnsavedChanges = dirty;

  // 편집 중 이탈 방지 (앱 내부 이동 + 브라우저 탭 닫기/새로고침)
  useUnsavedChanges(hasUnsavedChanges);

  const markDirty = () => {
    if (!viewOnly && !navState?.isTutorialDemo) setDirty(true);
  };
  // 이탈 방지는 useUnsavedChanges(useBlocker)가 앱 전역에서 일괄 처리한다.
  // 아래 개별 가드는 이중 확인창을 막기 위해 no-op으로 둔다(기존 호출부 호환).
  const confirmDiscardChanges = () => true;
  const handleGuardedLinkClick = () => {};
  const handleKeyExperiencesChange = (next) => {
    markDirty();
    setEditedKeyExperiences(next);
  };
  const handleImageConfigChange = (updater) => {
    markDirty();
    setImageConfig(updater);
  };

  /* ── 프로젝트 타임라인용: 전체 경험 목록 로드 ── */
  const { experiences, fetchExperiences, undoEdit, redoEdit, canUndo, canRedo, pushEditSnapshot, researchMarketMetrics, analyzeExperience, judgeEvidenceLabels } = useExperienceStore();
  const [researchingMetrics, setResearchingMetrics] = useState(false);
  const [enhancingDraft, setEnhancingDraft] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackPromptKey = `fitpoly-feedback:${id}:experience_enhance_complete`;
  const feedbackTimerRef = useRef(null);
  useEffect(() => () => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
  }, []);
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
      const normalizedNavExperience = normalizeExperienceForCurrentJob({
        title: navState.title,
        jobCategory: navState.jobCategory,
        structuredResult: navState.analysis,
        content: navState.content,
      });
      const structured = normalizedNavExperience.structuredResult;
      setExperience({
        id,
        title: navState.title,
        framework: navState.framework,
        content: navState.content,
        jobCategory: normalizedNavExperience.jobCategory,
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
      setEvidenceLevels(structured.evidenceLevels || {});
      setEvidenceTags(structured.evidenceTags || {});
      setEditedKeywords(structured.keywords || []);
      setEditedKeyExperiences((structured.keyExperiences || []).map(e => ({ ...e })));
      setJobCategory(structured.jobCategory || 'common');
      setEditedJobSpecific(structured.jobSpecific || {});
      setEditedVisuals(structured.portfolioVisuals || {});
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
            setKeyExpImages(data.keyExpImages || {});
            setProjectNotionDoc(data.notionDoc || null);
            setJobAnalysis(data.jobAnalysis || null);
            setEditedLink(data.link || '');
            // 간략 보기(caseStudy) 동기화를 위해 저장본을 experience에 보관
            if (data.caseStudy) setExperience(prev => ({ ...(prev || {}), caseStudy: data.caseStudy }));
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
        const data = normalizeExperienceForCurrentJob({ id: docSnap.id, ...docSnap.data() });
        setExperience(data);
        setJobAnalysis(data.jobAnalysis || null);
        const imgs = data.images || [];
        setAllImages(imgs);
        setSectionImages(data.sectionImages || { _unassigned: imgs.map((_, i) => i) });
        setImageConfig(data.imageConfig || {});
        setKeyExpImages(data.keyExpImages || {});
        setProjectNotionDoc(data.notionDoc || null);
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
        setEvidenceLevels(sr.evidenceLevels || {});
        setEvidenceTags(sr.evidenceTags || {});
        setEditedKeywords(sr.keywords || data.keywords || []);
        setEditedKeyExperiences((sr.keyExperiences || []).map(e => ({ ...e })));
        setJobCategory(data.jobCategory || sr.jobCategory || 'common');
        setEditedJobSpecific(sr.jobSpecific || {});
        setEditedVisuals(sr.portfolioVisuals || {});
        setEditedLink(data.link || '');
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
          // 저장 구성에 없는 직군 특화 경험 섹션을 병합 — 이 기능 추가 이전 경험도 포트폴리오 부분이 내보내기 목록에 뜨도록
          const jc = data.jobCategory || sr.jobCategory || 'common';
          const js = sr.jobSpecific || {};
          const existingKeys = new Set(savedSections.map(s => s.key));
          const missingJobSections = (JOB_SPECIFIC_FIELDS[jc] || [])
            .filter(f => !existingKeys.has(`job-${f.key}`))
            .map(f => {
              const content = sanitizeTextValue(js[f.key] || '');
              return normalizeExportSection({
                key: `job-${f.key}`, sourceKey: f.key, label: f.label, type: 'job',
                content, blocks: content ? [makeTextBlock(content)] : [], enabled: !!content.trim(),
              });
            });
          const mergedSections = missingJobSections.length ? [...savedSections, ...missingJobSections] : savedSections;
          setExportCustomSections(mergedSections);
          setActiveExportSectionKey(mergedSections.find(section => !isSlideDeckSection(section))?.key || mergedSections[0]?.key || null);
        }
        if (!viewOnly) {
          // 모든 섹션 즉시 오픈 (딩칸/채워진 관계없이)
          const autoEdit = {};
          SECTION_KEYS.forEach(k => { autoEdit[k] = false; });
          setEditingSections(autoEdit);
        }
      }
    } catch (error) {
      console.error('경험 로딩 실패:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (mobileDefaultTabAppliedRef.current || loading || activeTab !== 'story' || editedKeyExperiences.length === 0) return;
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setActiveTab('keyexp');
    }
    mobileDefaultTabAppliedRef.current = true;
  }, [activeTab, editedKeyExperiences.length, loading]);

  // 직군 특화 경험(포트폴리오) '편집'으로 진입하면 직군 특화 섹션으로 스크롤
  const jobEditScrolledRef = useRef(false);
  useEffect(() => {
    if (jobEditScrolledRef.current || loading || navState?.tab !== 'analysis') return;
    const el = document.getElementById('job-specific-edit');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      jobEditScrolledRef.current = true;
    }
  }, [loading, activeTab, navState?.tab]);

  const handleFieldChange = (key, value) => {
    const cleanValue = sanitizeTextValue(value);
    // 빈칸/초안 → 충분한 내용으로 완성될 때 섹션 완성 피드백
    const currentVal = editedContent[key];
    const wasEmpty = !currentVal?.trim() || currentVal.trim().startsWith('[작성 필요]');
    const isNowFilled = !!cleanValue.trim() && !cleanValue.trim().startsWith('[작성 필요]') && cleanValue.trim().length > 15;
    markDirty();
    setEditedContent(prev => ({ ...prev, [key]: cleanValue }));
    if (wasEmpty && isNowFilled) {
      setFlashedSection(key);
      setTimeout(() => setFlashedSection(null), 1300);
    }
  };

  /* ── 근거 레벨 토글 (같은 레벨 다시 누르면 해제) ── */
  const setEvidenceLevel = (key, level) => {
    markDirty();
    setEvidenceLevels(prev => {
      const next = { ...prev };
      if (next[key] === level) delete next[key];
      else next[key] = level;
      return next;
    });
  };

  /* ── 주장 성격 라벨 토글 (같은 라벨 다시 누르면 해제) ── */
  const setEvidenceTag = (key, kind) => {
    markDirty();
    setEvidenceTags(prev => {
      const next = { ...prev };
      if (next[key] === kind) delete next[key];
      else next[key] = kind;
      return next;
    });
  };

  /* ── AI가 각 섹션 본문을 보고 근거 라벨(성격 + 레벨)을 자동 판단 ── */
  const handleJudgeLabels = async () => {
    const sections = {};
    SECTION_KEYS.forEach(k => {
      const v = editedContent[k];
      if (v && !isInstructionLike(v) && v.trim()) sections[k] = stripMarkdown(v);
    });
    if (Object.keys(sections).length === 0) { toast.error('먼저 섹션 내용을 입력해주세요'); return; }
    setJudgingLabels(true);
    try {
      const result = await judgeEvidenceLabels(sections);
      if (!result || Object.keys(result).length === 0) { toast('판단할 근거가 충분하지 않았어요', { icon: 'ℹ️' }); return; }
      setEvidenceTags(prev => {
        const next = { ...prev };
        Object.entries(result).forEach(([k, v]) => { if (v?.label) next[k] = v.label; });
        return next;
      });
      setEvidenceLevels(prev => {
        const next = { ...prev };
        Object.entries(result).forEach(([k, v]) => { if (v?.level) next[k] = v.level; });
        return next;
      });
      markDirty();
      toast.success('AI가 근거 라벨을 판단했어요');
    } catch {
      toast.error('근거 판단에 실패했어요');
    } finally {
      setJudgingLabels(false);
    }
  };

  const updateDecisionMetric = (index, field, value) => {
    markDirty();
    setEditedResearch(prev => ({
      ...prev,
      decisionMetrics: prev.decisionMetrics.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const addDecisionMetric = () => {
    markDirty();
    setEditedResearch(prev => ({
      ...prev,
      decisionMetrics: [...prev.decisionMetrics, { metric: '', whyItMatters: '', recommendedProxy: '', researchBasis: '', confidence: 'medium' }],
    }));
  };

  const removeDecisionMetric = (index) => {
    markDirty();
    setEditedResearch(prev => ({
      ...prev,
      decisionMetrics: prev.decisionMetrics.filter((_, i) => i !== index),
    }));
  };

  const removeImpactBridge = (index) => {
    markDirty();
    setEditedResearch(prev => ({
      ...prev,
      impactBridges: (prev.impactBridges || []).filter((_, i) => i !== index),
    }));
  };

  const updateSourceNote = (index, field, value) => {
    markDirty();
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
        const bridgeKeys = new Set((prev.impactBridges || []).map(b => norm(b.userMetric)));
        const newBridges = (res.impactBridges || []).filter(b => b.userMetric && !bridgeKeys.has(norm(b.userMetric)));
        const prevInfographic = normalizeDeskResearchInfographic(prev.deskResearchInfographic);
        const nextInfographic = normalizeDeskResearchInfographic(res.deskResearchInfographic);
        const cardKeys = new Set(prevInfographic.cards.map(card => norm(card.sourceUrl) || norm(card.question)));
        const mergedCards = [
          ...prevInfographic.cards,
          ...nextInfographic.cards.filter(card => {
            const key = norm(card.sourceUrl) || norm(card.question);
            return key && !cardKeys.has(key);
          }),
        ].slice(0, 4);
        return {
          ...prev,
          marketOverview: prev.marketOverview?.trim() ? prev.marketOverview : (res.marketOverview || ''),
          deskResearchInfographic: {
            title: prevInfographic.title || nextInfographic.title,
            subtitle: prevInfographic.subtitle || nextInfographic.subtitle,
            cards: mergedCards,
            conclusion: prevInfographic.conclusion || nextInfographic.conclusion,
            limitations: prevInfographic.limitations || nextInfographic.limitations,
          },
          decisionMetrics: [...prev.decisionMetrics, ...newMetrics],
          impactBridges: [...(prev.impactBridges || []), ...newBridges],
          sourceNotes: [...prev.sourceNotes, ...newSources],
          portfolioAngles: [...(prev.portfolioAngles || []), ...newAngles],
          limitations: prev.limitations?.trim() ? prev.limitations : (res.limitations || ''),
        };
      });
      markDirty();
      const added = (res.decisionMetrics || []).length;
      const cardCount = normalizeDeskResearchInfographic(res.deskResearchInfographic).cards.length;
      const bridgeCount = (res.impactBridges || []).length;
      toast.success(bridgeCount > 0
        ? `AI가 내 성과를 외부 연구와 연결한 해석 ${bridgeCount}개를 추가했습니다`
        : cardCount > 0
          ? `AI가 시장조사 카드 ${cardCount}개와 지표 ${added}개를 반영했습니다`
          : (added > 0 ? `AI가 의사결정 지표 ${added}개를 추천했습니다` : 'AI 리서치를 반영했습니다'));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI 지표 추천에 실패했습니다');
    } finally {
      setResearchingMetrics(false);
    }
  };

  const applyStructuredResult = (structured) => {
    const fields = pickSectionFields(structured);
    setExperience(prev => ({ ...(prev || {}), structuredResult: structured, keywords: structured.keywords || [] }));
    setEditedContent(fields);
    setEditedOverview({
      background: sanitizeTextValue(structured.projectOverview?.background || ''),
      goal: sanitizeTextValue(structured.projectOverview?.goal || ''),
      role: sanitizeTextValue(structured.projectOverview?.role || ''),
      team: sanitizeTextValue(structured.projectOverview?.team || ''),
      duration: sanitizeTextValue(structured.projectOverview?.duration || ''),
      summary: sanitizeTextValue(structured.projectOverview?.summary || ''),
      scopeOfImpact: sanitizeTextValue(structured.projectOverview?.scopeOfImpact || ''),
      techStack: Array.isArray(structured.projectOverview?.techStack)
        ? structured.projectOverview.techStack
        : (structured.projectOverview?.techStack ? String(structured.projectOverview.techStack).split(',').map(s => s.trim()).filter(Boolean) : []),
    });
    setEditedResearch(normalizeMarketResearch(structured.marketResearch));
    setEditedSectionSlides(structured.sectionSlides || {});
    if (structured.evidenceLevels) setEvidenceLevels(structured.evidenceLevels);
    if (structured.evidenceTags) setEvidenceTags(structured.evidenceTags);
    setEditedKeywords(structured.keywords || []);
    setEditedKeyExperiences((structured.keyExperiences || []).map(e => ({ ...e })));
    setJobCategory(structured.jobCategory || 'common');
    setEditedJobSpecific(structured.jobSpecific || {});
  };

  const handleEnhanceDraft = async () => {
    if (!id || enhancingDraft) return;
    setEnhancingDraft(true);
    try {
      const reviewedMoments = editedKeyExperiences.map((item, index) => ({
        id: item.id || `reviewed-${index + 1}`,
        title: item.title || `핵심 경험 ${index + 1}`,
        metric: item.metric || '',
        metricLabel: item.metricLabel || '',
        beforeMetric: item.beforeMetric || '',
        afterMetric: item.afterMetric || '',
        context: item.context || item.situation || '',
        action: item.action || '',
        result: item.result || '',
        learning: item.learning || '',
        keywords: item.keywords || [],
      }));
      const structured = await analyzeExperience(id, {
        momentsCount: reviewedMoments.length || undefined,
        reviewedMoments: reviewedMoments.length > 0 ? reviewedMoments : undefined,
      });
      applyStructuredResult(structured);
      if (structured?._fallback) {
        toast('AI 보강이 일시적으로 불안정해 초안을 유지했습니다. 다시 시도할 수 있어요.');
      } else {
        toast.success('AI 보강이 완료되었습니다');
        if (!isFeedbackSnoozed() && window.localStorage.getItem(feedbackPromptKey) !== '1') {
          if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = window.setTimeout(() => {
            if (!document.hidden) setFeedbackOpen(true);
          }, 30000);
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'AI 보강에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setEnhancingDraft(false);
    }
  };

  const toggleEditing = (key) => {
    setEditingSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── 역량 키워드 드래그-재정렬 ── */
  const handleKwDragEnd = () => {
    if (kwDragIdx != null && kwOverIdx != null && kwDragIdx !== kwOverIdx) {
      markDirty();
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
    markDirty();
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
    markDirty();
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
    markDirty();
    toast('이전 내용으로 되돌렸습니다', { icon: '↩️' });
  };

  const handleRedo = () => {
    const snapshot = redoEdit(id);
    if (!snapshot) return;
    if (snapshot.content) setEditedContent(snapshot.content);
    if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
    markDirty();
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
          markDirty();
          toast('이전 내용으로 되돌렸습니다', { icon: '↩️' });
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const snapshot = redoEdit(id);
        if (snapshot) {
          if (snapshot.content) setEditedContent(snapshot.content);
          if (snapshot.title !== undefined) setEditedTitle(snapshot.title);
          markDirty();
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
      const cleanEnabledExportSections = cleanExportSections.filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image' || block.type === 'slide' || block.type === 'infographic')));
      const updatedStructured = {
        ...(experience.structuredResult || {}),
        ...cleanEditedContent,
        projectOverview: { ...cleanOverview },
        marketResearch: { ...editedResearch },
        sectionSlides: { ...cleanSectionSlides },
        evidenceLevels: { ...evidenceLevels },
        evidenceTags: { ...evidenceTags },
        keywords: editedKeywords,
        keyExperiences: keyExperiencesForSave,
        jobCategory,
        jobSpecific: editedJobSpecific,
        portfolioVisuals: editedVisuals,
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
      const savePayload = {
        title: editedTitle,
        link: editedLink || null,
        notionDoc: projectNotionDoc || null,
        structuredResult: updatedStructured,
        keywords: editedKeywords,
        images: allImages,
        sectionImages,
        imageConfig,
        updatedAt: new Date(),
      };
      // 자세히 보기의 공통 필드를 간략 보기(caseStudy)에도 반영 (저장된 간략 보기가 있을 때만)
      const syncedCaseStudy = experience?.caseStudy
        ? mergeStructuredIntoCaseStudy(experience.caseStudy, updatedStructured, editedTitle)
        : null;
      if (syncedCaseStudy) savePayload.caseStudy = syncedCaseStudy;
      // Firestore 문서 한도(1MB) 초과 시 updateDoc이 실패하므로 미리 안내한다.
      const approxBytes = new Blob([JSON.stringify(savePayload)]).size;
      if (approxBytes > 1_000_000) {
        toast.error('내용·이미지 용량이 너무 큽니다(1MB 초과). 이미지 개수를 줄이거나 더 작은 이미지를 사용해 주세요.');
        setSaving(false);
        return;
      }
      await updateDoc(ref, savePayload);
      setExperience(prev => ({ ...prev, title: editedTitle, link: editedLink || '', notionDoc: projectNotionDoc || null, structuredResult: updatedStructured, keywords: editedKeywords, ...(syncedCaseStudy ? { caseStudy: syncedCaseStudy } : {}) }));
      const newEditing = {};
      SECTION_KEYS.forEach(k => {
        if (!editedContent[k]?.trim()) newEditing[k] = true;
      });
      setEditingSections(newEditing);
      setDirty(false);
      toast.success('저장되었습니다');
      navigate(`/app/experience/structured/${id}?view=true`, { replace: true });
    } catch (error) {
      console.error('저장 실패:', error);
      const tooLarge = /longer than|exceeds the maximum|1048487|invalid-argument/i.test(error?.message || '');
      toast.error(tooLarge
        ? '이미지 용량이 너무 커서 저장에 실패했습니다. 이미지 수나 크기를 줄여 주세요.'
        : `저장에 실패했습니다${error?.message ? ` (${error.message})` : ''}`);
    }
    setSaving(false);
  };

  useEffect(() => {
    if (viewOnly || navState?.isTutorialDemo) return undefined;
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (hasUnsavedChanges && !saving) handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, hasUnsavedChanges, navState?.isTutorialDemo, saving, viewOnly]);

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
    const researchInfographic = normalizeDeskResearchInfographic(editedResearch.deskResearchInfographic);
    const researchBlocks = [
      ...(researchInfographic.cards.length > 0 ? [makeInfographicBlock(researchInfographic)] : []),
      ...(researchText.trim() ? [makeTextBlock(researchText)] : []),
    ];
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
      { key: 'market-research', label: '시장/지표 리서치', type: 'research', content: researchText, blocks: researchBlocks, enabled: !!researchText.trim() || researchInfographic.cards.length > 0 },
      ...jobSections,
      ...baseSections,
    ].map(section => normalizeExportSection({ ...section, blocks: section.blocks || (section.content ? [makeTextBlock(section.content)] : []) }));
  };

  const normalizedExportSections = moveSlidesToStandaloneSection(exportCustomSections);
  const enabledExportSections = normalizedExportSections
    .filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image' || block.type === 'slide' || block.type === 'infographic')));
  const activeExportSectionRaw = normalizedExportSections.find(section => section.key === activeExportSectionKey) || normalizedExportSections.find(section => !isSlideDeckSection(section)) || normalizedExportSections[0];
  const activeExportSection = activeExportSectionRaw ? normalizeExportSection(activeExportSectionRaw) : null;
  const activeIsSlideDeck = activeExportSection ? isSlideDeckSection(activeExportSection) : false;
  const slideDeckSection = normalizedExportSections.find(isSlideDeckSection) || createSlideDeckSection([]);
  const slideDeckBlocks = slideDeckSection.blocks.filter(block => block.type === 'slide');
  const projectDetailExperience = experience ? {
    ...experience,
    id,
    experienceId: id,
    title: editedTitle || experience.title || '',
    date: editedOverview.duration || '',
    role: editedOverview.role || '',
    skills: editedOverview.techStack || [],
    keywords: editedKeywords || [],
    description: editedOverview.summary || editedOverview.background || editedContent.intro || '',
    link: editedLink || experience.link || '',
    thumbnailUrl: exportCoverImg || experience.thumbnailUrl || '',
    notionDoc: projectNotionDoc || experience.notionDoc || null,
    jobCategory,
    structuredResult: {
      ...(experience.structuredResult || {}),
      ...editedContent,
      projectOverview: { ...editedOverview },
      marketResearch: editedResearch,
      sectionSlides: editedSectionSlides,
      keywords: editedKeywords,
      keyExperiences: editedKeyExperiences,
      jobCategory,
      jobSpecific: editedJobSpecific,
      exportConfig: {
        ...(experience.structuredResult?.exportConfig || {}),
        coverImg: exportCoverImg || experience.structuredResult?.exportConfig?.coverImg || null,
        sections: enabledExportSections.map(section => ({
          key: section.key,
          label: section.label,
          type: section.type || 'custom',
          content: section.content,
          blocks: section.blocks || [],
        })),
        draftSections: normalizedExportSections,
      },
    },
  } : null;

  const handleProjectPreviewUpdate = (changes = {}) => {
    markDirty();
    if (Object.prototype.hasOwnProperty.call(changes, 'title')) {
      setEditedTitle(sanitizeTextValue(changes.title));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'date')) {
      setEditedOverview(prev => ({ ...prev, duration: sanitizeTextValue(changes.date) }));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'role')) {
      setEditedOverview(prev => ({ ...prev, role: sanitizeTextValue(changes.role) }));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'description')) {
      setEditedOverview(prev => ({ ...prev, summary: sanitizeTextValue(changes.description) }));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'skills')) {
      setEditedOverview(prev => ({ ...prev, techStack: Array.isArray(changes.skills) ? changes.skills : [] }));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'keywords')) {
      setEditedKeywords(Array.isArray(changes.keywords) ? changes.keywords : []);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'thumbnailUrl')) {
      setExportCoverImg(changes.thumbnailUrl || null);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'link')) {
      setEditedLink(sanitizeTextValue(changes.link || ''));
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'notionDoc')) {
      setProjectNotionDoc(changes.notionDoc || null);
    }

    const nextStructured = changes.structuredResult;
    if (nextStructured) {
      if (nextStructured.projectOverview) {
        setEditedOverview(prev => ({
          ...prev,
          ...sanitizeTextObject(nextStructured.projectOverview),
          techStack: Array.isArray(nextStructured.projectOverview.techStack)
            ? nextStructured.projectOverview.techStack
            : prev.techStack,
        }));
      }
      if (Array.isArray(nextStructured.keyExperiences)) {
        setEditedKeyExperiences(nextStructured.keyExperiences.map(item => ({ ...item })));
      }
      if (nextStructured.marketResearch) {
        setEditedResearch(normalizeMarketResearch(nextStructured.marketResearch));
      }
      if (nextStructured.sectionSlides) {
        setEditedSectionSlides(nextStructured.sectionSlides);
      }
      if (nextStructured.jobSpecific) {
        setEditedJobSpecific(nextStructured.jobSpecific);
      }
      const nextFields = pickSectionFields(nextStructured);
      const hasSectionContent = Object.values(nextFields).some(value => String(value || '').trim());
      if (hasSectionContent) {
        setEditedContent(prev => ({ ...prev, ...nextFields }));
      }
    }
  };

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

  // 내보내기 목록에 아직 없는 "알려진 섹션"(직군 특화 경험·기본 섹션 등)을 다시 추가할 수 있게
  const availableKnownSections = () => {
    const present = new Set(exportCustomSections.map(s => s.key));
    return buildDefaultExportSections().filter(s => !present.has(s.key));
  };
  const addKnownSection = (key) => {
    const found = buildDefaultExportSections().find(s => s.key === key);
    if (!found) return;
    setExportCustomSections(prev => (prev.some(s => s.key === key) ? prev : [...prev, found]));
    setActiveExportSectionKey(key);
    setShowSectionPicker(false);
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
    if (!confirmDiscardChanges()) return;
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
      notionDoc: projectNotionDoc || experience?.notionDoc || null,
    };

    navigate('/app/portfolio', { state: { exportConfig } });
  };

  /* 포트폴리오 미리보기 - 섹션 구성 Firestore 저장 */
  const handleSaveExportConfig = async () => {
    const cleanExportSections = moveSlidesToStandaloneSection(exportCustomSections);
    const sections = cleanExportSections.filter(section => section.enabled !== false && (section.content?.trim() || section.blocks?.some(block => block.type === 'image' || block.type === 'slide' || block.type === 'infographic'))).map(section => ({
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
    { id: 'keyExperiences', label: '핵심 경험 추가 (2~3개 권장)', targetSlide: 3, check: () => editedKeyExperiences.length > 0, tip: '핵심 경험은 행동 나열보다 의사결정의 이유와 trade-off가 보이게, 2~3개로 정리하면 면접관이 한눈에 보기 좋습니다.' },
    { id: 'research',       label: '시장/지표 근거 보강', targetSlide: 1, check: () => !!editedResearch.marketOverview?.trim() || editedResearch.decisionMetrics.length > 0 || normalizeDeskResearchInfographic(editedResearch.deskResearchInfographic).cards.length > 0, tip: '시장/지표 근거는 내 성과로 둔갑시키지 말고, 출처가 확인된 시장 기준이나 비교 기준으로 연결해 주세요.' },
    { id: 'metrics',        label: '수치/성과 근거 포함', targetSlide: 4, check: () => SECTION_KEYS.some(k => /\d+\s*[%배ms개원만억]/.test(editedContent[k] || '')) || editedKeyExperiences.some(k => k.metric || k.afterMetric), tip: '성과 슬라이드에는 전후 변화, 처리량, 시간 절감, 사용자 반응처럼 검증 가능한 수치를 우선 배치해 주세요.' },
    { id: 'images',         label: '결과물/화면 이미지 배치', targetSlide: sectionSlideIdx, check: () => allImages.length > 0, tip: '이미지는 설명을 대신하는 증거예요. 각 섹션에 결과물·화면·구조도를 넣고, 캡션과 역할 라벨(화면/결과물/구조도)을 붙이면 면접관이 바로 이해합니다.' },
    { id: 'sections',       label: `${SECTION_COUNT}개 섹션 완성 (${filledCount}/${SECTION_COUNT})`, targetSlide: firstIncompleteSlideIdx >= 0 ? firstIncompleteSlideIdx : 0, check: () => filledCount === SECTION_COUNT, tip: '비어 있는 섹션부터 채우면 전체 흐름이 빨리 안정됩니다. 각 슬라이드는 배경, 문제, 행동, 결과가 겹치지 않게 역할을 나눠 주세요.' },
  ];
  const passedChecks = qualityChecks.filter(c => c.check()).length;
  const qualityPct = Math.round((passedChecks / qualityChecks.length) * 100);
  const activeQualityCheck = qualityChecks.find(item => item.id === activeQualityId) || qualityChecks.find(item => !item.check()) || qualityChecks[0];
  const handleQualityCheckClick = (item) => {
    const nextSlideIdx = Math.min(item.targetSlide ?? 0, SECTION_COUNT - 1);
    setActiveQualityId(item.id);
    setSectionSlideIdx(nextSlideIdx);
    // 스토리 섹션으로 스크롤 (탭 제거로 스토리/자소서만 노출)
    requestAnimationFrame(() => {
      const sectionKey = SECTION_KEYS[nextSlideIdx];
      const target = (sectionKey && document.getElementById(`story-${sectionKey}`)) || detailSlidesRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

  // ── 스토리: 7개 섹션을 슬라이드가 아닌 "한 편의 문서"로 흐르게 표시 ──
  const autoGrow = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 8}px`; } };
  const INTRO_META = [
    { key: 'duration', label: '기간', placeholder: '2024.01 - 2024.06' },
    { key: 'role', label: '역할', placeholder: '기획/개발/운영 담당' },
    { key: 'team', label: '팀 구성', placeholder: '개발 3명, 디자인 1명' },
    { key: 'scopeOfImpact', label: '영향 범위', placeholder: '사용자/팀/비즈니스 범위' },
    { key: 'goal', label: '목표', placeholder: '프로젝트의 핵심 목표' },
  ];

  const renderDetailSlides = () => (
    <div ref={detailSlidesRef} className="w-full scroll-mt-6">
      <div className="divide-y divide-surface-200">
        {SECTION_KEYS.map((key) => {
          const meta = SECTION_META[key];
          const value = editedContent[key] || '';
          const field = FRAMEWORKS.STRUCTURED.fields.find(f => f.key === key);
          const display = isInstructionLike(value) ? '' : sanitizeTextValue(value);
          const sectionHighlights = (structured.highlights || []).filter(h => h.field === key);

          return (
            <section key={key} className="py-7 first:pt-1 scroll-mt-20" id={`story-${key}`}>
              <div className="flex gap-3 sm:gap-5">
                {/* 좌측 번호 거터 — 본문은 오른쪽으로 들여써 왼쪽 여백 확보 */}
                <span className="shrink-0 w-6 pt-0.5 text-right text-[14px] font-black tabular-nums" style={{ color: '#002F6C' }}>{meta.num}</span>
                <div className="min-w-0 flex-1">
              {/* 섹션 헤더 — 제목 + 오른쪽으로 뻗는 얇은 선 (결과 페이지와 동일한 문법) */}
              <div className="mb-3.5 flex items-center gap-3.5">
                <h3 className="flex-shrink-0 text-[19px] sm:text-[21px] font-extrabold leading-snug tracking-tight text-bluewood-900">{meta.label}</h3>
                <span className="h-px flex-1 bg-surface-200" />
              </div>

              {/* 프로젝트 소개에만: 기간/역할/팀/범위/목표 — 보기 모드는 한 줄 인라인으로 압축 */}
              {key === 'intro' && (
                viewOnly ? (
                  (() => {
                    const items = INTRO_META.map(m => [m.label, cleanForDisplay(editedOverview?.[m.key])]).filter(([, v]) => v);
                    if (items.length === 0) return null;
                    return (
                      <div className="mb-3.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] leading-snug">
                        {items.map(([label, v], i) => (
                          <span key={i} style={{ wordBreak: 'keep-all' }}><span className="font-bold text-bluewood-400">{label}</span> <span className="font-semibold text-bluewood-700">{v}</span></span>
                        ))}
                      </div>
                    );
                  })()
                ) : (
                  <dl className="mb-4 grid grid-cols-2 gap-x-5 gap-y-1 rounded-lg border border-surface-200 bg-surface-50/50 px-3.5 py-2 sm:grid-cols-3">
                    {INTRO_META.map(item => (
                      <div key={item.key} className="flex min-w-0 items-baseline gap-2">
                        <dt className="w-[48px] shrink-0 text-[11px] font-bold text-bluewood-400">{item.label}</dt>
                        <textarea
                          rows={1}
                          ref={el => autoGrow(el)}
                          value={isInstructionLike(editedOverview?.[item.key]) ? '' : sanitizeTextValue(editedOverview?.[item.key] || '')}
                          onChange={e => { markDirty(); setEditedOverview(prev => ({ ...prev, [item.key]: sanitizeTextValue(e.target.value) })); autoGrow(e.target); }}
                          placeholder={item.placeholder}
                          className="min-w-0 flex-1 resize-none break-words rounded-md bg-transparent px-1 -mx-1 text-[13px] font-semibold leading-snug text-bluewood-800 outline-none transition-colors placeholder:text-bluewood-300 focus:bg-white"
                          style={{ overflow: 'hidden', overflowWrap: 'anywhere', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </dl>
                )
              )}

              {/* 본문 — 편집 모드에서도 형광펜 하이라이트를 보여주고, 클릭하면 편집 */}
              {(() => {
                const editing = !viewOnly && (editingSections[key] || !display);
                if (editing) {
                  return (
                    <textarea
                      rows={1}
                      ref={el => autoGrow(el)}
                      autoFocus={!!editingSections[key]}
                      value={display}
                      onChange={e => { handleFieldChange(key, e.target.value); autoGrow(e.target); }}
                      onBlur={() => setEditingSections(prev => ({ ...prev, [key]: false }))}
                      placeholder={field?.placeholder || '내용을 입력하세요'}
                      className="w-full resize-none break-words rounded-md bg-transparent px-1 -mx-1 text-[14.5px] leading-[1.9] text-bluewood-600 outline-none transition-colors placeholder:text-bluewood-300 focus:bg-primary-50/40"
                      style={{ overflow: 'hidden', overflowWrap: 'anywhere', minHeight: '3.2rem', boxSizing: 'border-box' }}
                    />
                  );
                }
                if (!display) return <p className="text-[15px] text-bluewood-300">아직 내용이 없습니다.</p>;
                return (
                  <div
                    className={`whitespace-pre-wrap break-words rounded-md text-[14.5px] leading-[1.9] text-bluewood-600 ${!viewOnly ? 'cursor-text px-1 -mx-1 transition-colors hover:bg-surface-50/70' : ''}`}
                    style={{ overflowWrap: 'anywhere' }}
                    onClick={!viewOnly ? () => setEditingSections(prev => ({ ...prev, [key]: true })) : undefined}
                    title={!viewOnly ? '클릭해서 편집' : undefined}
                  >
                    <HighlightedText text={display} highlights={sectionHighlights} keywords={editedKeywords} showKeywordUnderline={true} />
                  </div>
                );
              })()}

              {/* 섹션 이미지 + 추가 */}
              <InlineSlideImages
                sectionKey={key}
                sectionImages={sectionImages}
                allImages={allImages}
                imageConfig={imageConfig}
                setImageConfig={handleImageConfigChange}
                handleImageDelete={handleImageDelete}
                viewOnly={viewOnly}
              />
              {!viewOnly && (
                <button
                  onClick={() => openSlideImagePicker(key)}
                  disabled={uploadingImage}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-surface-200 px-2.5 py-1 text-[12px] font-semibold text-bluewood-400 hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 transition-colors"
                >
                  {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                  사진 추가
                </button>
              )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
    <FeedbackModal
      open={feedbackOpen}
      onClose={() => {
        if (id) window.localStorage.setItem(feedbackPromptKey, '1');
        setFeedbackOpen(false);
      }}
      context="experience_enhance_complete"
      experienceId={id}
      title={editedTitle || experience?.title || ''}
    />
    <div className="experience-edit-surface animate-fadeIn w-full max-w-[1100px] mx-auto px-4 sm:px-6 pb-16">
      {/* 상단 네비 + 저장/수정 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
        {navState?.isTutorialDemo ? (
          <Link to={navState.backUrl || '/app/experience?tutorial=1&step=2'} onClick={handleGuardedLinkClick} className="inline-flex items-center gap-2 text-[13px] font-medium text-primary-600 hover:text-primary-700 transition-colors">
            <ArrowLeft size={15} /> 튜토리얼로 돌아가기
          </Link>
        ) : (
          <Link to="/app/experience" onClick={handleGuardedLinkClick} className="inline-flex items-center gap-2 text-[13px] font-medium text-bluewood-400 hover:text-bluewood-700 transition-colors">
            <ArrowLeft size={15} /> 경험 목록으로
          </Link>
        )}
        {!navState?.isTutorialDemo && (
          <div className="inline-flex items-center gap-0.5 rounded-xl bg-surface-100 p-1">
            <Link to={`/app/experience/result/${id}`} onClick={handleGuardedLinkClick} className="rounded-lg px-3 sm:px-3.5 py-1.5 text-[13px] font-semibold text-bluewood-400 hover:text-bluewood-700 transition-colors">
              {jobCategory === 'common' ? '케이스 스터디' : '핵심 경험'}
            </Link>
            <span className="rounded-lg bg-white px-3 sm:px-3.5 py-1.5 text-[13px] font-bold text-bluewood-900 shadow-sm">자세히 보기</span>
          </div>
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
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            {/* 되돌리기/다시실행 그룹 */}
            <div className="inline-flex items-center rounded-lg border border-surface-200 bg-white p-0.5">
              <button onClick={handleUndo} disabled={!canUndo(id)} title="이전으로 되돌리기 (Ctrl+Z)" aria-label="되돌리기"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-bluewood-500 hover:bg-surface-50 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all">
                <RotateCcw size={14} />
              </button>
              <button onClick={handleRedo} disabled={!canRedo(id)} title="다시 실행 (Ctrl+Y)" aria-label="다시 실행"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-bluewood-500 hover:bg-surface-50 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all">
                <RotateCw size={14} />
              </button>
            </div>

            {hasUnsavedChanges && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-[12px] font-bold text-bluewood-500 ring-1 ring-surface-200">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                저장되지 않음
              </span>
            )}

            {experience?.structuredResult?._draft && (
              <button
                onClick={handleEnhanceDraft}
                disabled={enhancingDraft}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-200 text-primary-700 rounded-lg text-[13px] font-semibold hover:bg-primary-50 active:scale-95 disabled:opacity-50 transition-all"
              >
                {enhancingDraft ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {enhancingDraft ? 'AI 보강 중...' : 'AI로 보강하기'}
              </button>
            )}

            <button
              onClick={() => setShowProjectPreviewEditor(true)}
              title="포트폴리오에 내보낼 화면을 미리 구성합니다"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-surface-200 text-bluewood-700 rounded-lg text-[13px] font-medium hover:bg-surface-50 hover:border-bluewood-300 active:scale-95 transition-all">
              <Eye size={14} /> 내보낼 화면 구성
            </button>
            <button onClick={handleSave} disabled={saving} title="저장 (Ctrl+S / ⌘S)"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-[13px] font-semibold shadow-sm shadow-primary-600/20 hover:bg-primary-700 active:scale-95 disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        )}
      </div>

      {/* 제목 + 탭 — 한 덩어리의 헤더 (밑줄은 탭 아래 하나만) */}
      <h1 className="mb-3 text-[28px] font-extrabold leading-tight text-bluewood-900 sm:text-[34px]">{editedTitle || experience?.title || '경험 제목'}</h1>

      {/* ── 스토리 / 자소서 활용 2개 메뉴 ── */}
      <div className="mb-6 border-b border-surface-200">
        <nav className="-mb-px flex gap-1">
          {[
            { key: 'story', label: '스토리' },
            { key: 'coverletter', label: '활용' },
          ].map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap border-b-2 px-1 pb-2 pt-1.5 transition-colors ${active ? 'border-primary-600' : 'border-transparent hover:border-surface-300'}`}
              >
                <span className={`rounded-md px-3.5 py-1.5 text-[16px] transition-colors ${active ? 'font-extrabold text-bluewood-900' : 'font-semibold text-bluewood-400 hover:bg-surface-50 hover:text-bluewood-700'}`}>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 섹션 바로가기 — 어디까지 썼는지 + 클릭 시 해당 섹션으로 이동 */}
      {activeTab === 'story' && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {SECTION_KEYS.map(key => {
            const meta = SECTION_META[key];
            const v = editedContent[key] || '';
            const filled = !isInstructionLike(v) && !!sanitizeTextValue(v).trim();
            return (
              <button
                key={key}
                type="button"
                onClick={() => document.getElementById(`story-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${filled ? 'border-surface-200 bg-white text-bluewood-700 hover:border-bluewood-300' : 'border-dashed border-surface-300 bg-surface-50/50 text-bluewood-300 hover:text-bluewood-500'}`}
              >
                <span className={`text-[11px] font-black tabular-nums ${filled ? 'text-primary-600' : 'text-bluewood-300'}`}>{meta.num}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'story' && renderDetailSlides()}

      {/* ── 메인 + 우측 기업분석 사이드바 ── */}
      <div className="flex gap-6 sm:gap-8 lg:gap-10 items-start">
        {/* 메인 콘텐츠 */}
        <div className="flex-1 min-w-0">

      <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

      {/* 핵심 경험 슬라이더 */}
      {activeTab === 'keyexp' && (
      <div className="mb-5">
        <KeyExperienceSlider
          ref={sliderRef}
          keyExperiences={editedKeyExperiences}
          onUpdate={viewOnly ? undefined : handleKeyExperiencesChange}
          viewOnly={viewOnly}
          listMode={!viewOnly}
          onDirty={markDirty}
        />
      </div>
      )}

      {/* 케이스 스터디에서 추가한 핵심 경험 사진 — 자세히보기에도 자연스럽게 반영 */}
      {activeTab === 'keyexp' && Object.keys(keyExpImages).length > 0 && (
        <div className="mb-6 border-t border-surface-200 pt-6">
          <div className="mb-4 flex items-center gap-3.5">
            <h3 className="flex-shrink-0 text-[16px] font-extrabold tracking-tight text-bluewood-900">핵심 경험 사진</h3>
            <span className="h-px flex-1 bg-surface-200" />
            <span className="hidden flex-shrink-0 text-[12px] text-bluewood-300 sm:block">케이스 스터디에서 추가한 사진이 함께 반영됩니다</span>
          </div>
          <div className="space-y-6">
            {Object.entries(keyExpImages).map(([idx, imgs]) => {
              if (!Array.isArray(imgs) || imgs.length === 0) return null;
              const title = stripMarkdown(editedKeyExperiences[+idx]?.title || '') || `핵심 경험 ${+idx + 1}`;
              return (
                <div key={idx}>
                  <p className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-bluewood-700">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-black text-white" style={{ backgroundColor: '#002F6C' }}>{+idx + 1}</span>
                    {title}
                  </p>
                  <div className="flex flex-col gap-3">
                    {imgs.map((im, ii) => (
                      <figure key={ii} className="overflow-hidden rounded-lg border border-surface-200 bg-white" style={{ width: im.width || '100%', maxWidth: '100%' }}>
                        <img src={im.url} alt={title} className="block w-full object-contain" />
                      </figure>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 분석 탭: 역량 인사이트 + 직군 특화 분석 ── */}
      {activeTab === 'analysis' && (<>
      <CompetencyMeterCompact
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
          <div id="job-specific-edit" className="scroll-mt-20 overflow-hidden rounded-2xl border border-surface-100 bg-white shadow-[0_6px_24px_rgba(15,40,80,0.05)]">
            {/* 직군 특화 헤더 — 제목 + 가로선 (통일 문법) */}
            <div className="flex flex-wrap items-center gap-3 border-b border-surface-100 px-6 py-4">
              <span className="rounded-md bg-primary-600 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-white">직군 특화</span>
              <span className="text-[15px] font-extrabold tracking-tight text-bluewood-900">{jobLabel} 핵심 분석 섹션</span>
              <span className="hidden h-px flex-1 bg-surface-200 sm:block" />
              <span className="text-[12.5px] text-bluewood-300">채용 담당자가 가장 주목하는 항목</span>
            </div>

            {/* 완성도 진단 카드 */}
            {(() => {
              const diag = computeDevDiagnostic({
                jobSpecific: editedJobSpecific,
                content: editedContent,
                keyExperiences: editedKeyExperiences,
                jobSections,
              });
              const barColor = diag.score >= 80 ? 'bg-caribbean-500' : diag.score >= 50 ? 'bg-amber-400' : 'bg-rose-400';
              const scoreColor = diag.score >= 80 ? 'text-caribbean-600' : diag.score >= 50 ? 'text-amber-600' : 'text-rose-500';
              return (
                <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/30">
                  <div className="flex items-center gap-3 mb-2.5">
                    <span className="text-[13px] font-bold text-bluewood-800">포트폴리오 완성도</span>
                    <span className={`text-[15px] font-extrabold ${scoreColor}`}>{diag.score}점</span>
                    <span className="text-[12px] text-bluewood-400">({diag.passed}/{diag.total} 항목 충족)</span>
                  </div>
                  <div className="h-2 w-full bg-surface-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${diag.score}%` }} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
                    {diag.checks.map((c, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[12px]">
                        {c.ok
                          ? <Check size={14} className="text-caribbean-500 mt-[1px] flex-shrink-0" />
                          : <X size={14} className="text-bluewood-300 mt-[1px] flex-shrink-0" />}
                        <span className={c.ok ? 'text-bluewood-600' : 'text-bluewood-400'}>
                          {c.label}
                          {!c.ok && <span className="block text-[11px] text-amber-600/90">{c.hint}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                              markDirty();
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

      {/* ── 차트 데이터 편집 (직군별 시각화 입력기) — 편집 모드에서만 ── */}
      {!viewOnly && (JOB_SPECIFIC_FIELDS[jobCategory] || []).length > 0 && (
        <div className="mt-6">
          <VisualDataEditor
            jobCategory={jobCategory}
            value={editedVisuals}
            accent={getJobPortfolioMeta(jobCategory).accent}
            onChange={(nextPv) => { markDirty(); setEditedVisuals(nextPv); }}
          />
        </div>
      )}
      </>)}

      {/* ╔══════════════════════════════════════════════╗
         ║  리서치 탭: 시장/지표 리서치 보강            ║
         ╚══════════════════════════════════════════════╝ */}
      {activeTab === 'analysis' && (editedResearch.marketOverview || editedResearch.decisionMetrics.length > 0 || (editedResearch.impactBridges || []).length > 0 || editedResearch.deskResearchInfographic?.cards?.length > 0 || !viewOnly) && (() => {
        const R = editedResearch;
        const confMeta = { high: { label: '신뢰 높음', dot: '#10b981' }, medium: { label: '신뢰 보통', dot: '#cbd5e1' }, low: { label: '참고', dot: '#cbd5e1' } };
        const validSources = (R.sourceNotes || []).filter(s => (s.title && s.title.trim()) || /^https?:\/\//.test(s.url || ''));
        const infographic = normalizeDeskResearchInfographic(R.deskResearchInfographic);
        return (
        <div className="mt-2">
          {/* 헤더 — 제목 + 가로선 (결과 페이지와 동일한 문법) */}
          <div className="mb-7">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="flex-shrink-0 text-[16px] font-extrabold tracking-tight text-bluewood-900">시장 · 지표 근거</h2>
              <span className="h-px flex-1 bg-surface-200" />
            <p className="order-last w-full pt-2 text-[13px] leading-relaxed text-bluewood-400">AI가 실제 출처 기반 시장조사 인포그래픽과 의사결정 지표를 정리합니다. 외부 수치는 비교 기준으로만 사용합니다.</p>
            {!viewOnly && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleResearchMetrics} disabled={researchingMetrics}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13.5px] font-bold text-white bg-primary-600 shadow-sm shadow-primary-600/20 hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {researchingMetrics && <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                  {researchingMetrics ? '리서치 중...' : '시장조사 만들기'}
                </button>
                <button onClick={addDecisionMetric}
                  className="px-3 py-2 rounded-lg border border-surface-200 text-[13.5px] font-semibold text-bluewood-600 hover:bg-surface-50 transition-colors">지표 추가</button>
              </div>
            )}
            </div>
          </div>

          <div className="space-y-9">
            {/* 시장 맥락 */}
            {(R.marketOverview || !viewOnly) && (
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-primary-500">시장 맥락</p>
                {viewOnly ? (
                  <p className="text-[15.5px] leading-[1.85] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>{R.marketOverview || '—'}</p>
                ) : (
                  <textarea
                    value={R.marketOverview}
                    onChange={e => { markDirty(); setEditedResearch(prev => ({ ...prev, marketOverview: e.target.value })); }}
                    placeholder="프로젝트와 관련된 시장·사용자·채용 맥락이 여기에 정리됩니다. '지표 추천받기'를 누르면 자동으로 채워집니다."
                    className="w-full min-h-[88px] resize-y border-0 border-l-2 border-surface-200 bg-transparent pl-4 py-1 text-[15.5px] leading-[1.85] text-bluewood-800 outline-none placeholder:text-bluewood-300 focus:border-primary-300"
                  />
                )}
              </div>
            )}

            {infographic.cards.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary-500">시장조사 인포그래픽</p>
                  <span className="text-[12px] font-semibold text-bluewood-300">출처 URL이 확인된 수치만 표시</span>
                </div>
                <DeskResearchInfographic infographic={infographic} />
              </div>
            )}

            {/* 내 성과 × 외부 연구 — 실제 성과 수치를 시장 벤치마크와 연결한 해석 */}
            {(R.impactBridges || []).length > 0 && (
              <div>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary-500">내 성과 × 외부 연구</p>
                  <span className="text-[12px] font-semibold text-bluewood-300">내 실제 수치는 그대로, 의미는 출처 있는 연구로 해석한 추정입니다</span>
                </div>
                <div className="border-t border-surface-200 divide-y divide-surface-200">
                  {R.impactBridges.map((bridge, index) => {
                    const cm = confMeta[bridge.confidence] || confMeta.medium;
                    return (
                      <div key={index} className="py-5">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <span className="rounded-md bg-primary-50 px-2.5 py-1 text-[13.5px] font-extrabold text-primary-700">{bridge.userMetric}</span>
                          <span className="text-[13px] font-bold text-bluewood-300">×</span>
                          <span className="min-w-0 flex-1 text-[14px] font-semibold leading-[1.6] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>{bridge.benchmark}</span>
                          <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-bluewood-400">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cm.dot }} />
                            {cm.label}
                          </span>
                        </div>
                        {bridge.interpretation && (
                          <p className="mt-2 text-[14px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{bridge.interpretation}</p>
                        )}
                        {bridge.suggestedSentence && (
                          <div className="mt-2.5 rounded-lg border border-surface-200 bg-surface-50/60 px-3.5 py-2.5">
                            <span className="mb-0.5 block text-[11.5px] font-bold text-bluewood-400">포트폴리오 제안 문장</span>
                            <p className="text-[14px] leading-[1.7] text-bluewood-800" style={{ wordBreak: 'keep-all' }}>{bridge.suggestedSentence}</p>
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {/^https?:\/\//.test(bridge.sourceUrl || '') && (
                            <a href={bridge.sourceUrl} target="_blank" rel="noopener noreferrer" className="max-w-full truncate text-[12.5px] font-medium text-primary-600 underline underline-offset-2">
                              출처: {bridge.sourceTitle || bridge.sourcePublisher || bridge.sourceUrl}
                            </a>
                          )}
                          {!viewOnly && (
                            <button onClick={() => removeImpactBridge(index)} className="text-[12.5px] font-semibold text-bluewood-300 hover:text-red-500 transition-colors">삭제</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 의사결정 지표 — 깔끔한 목록형 */}
            {R.decisionMetrics.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary-500">의사결정에 쓸 지표</p>
                <div className="border-t border-surface-200 divide-y divide-surface-200">
                  {R.decisionMetrics.map((metric, index) => {
                    const cm = confMeta[metric.confidence] || confMeta.medium;
                    return (
                      <div key={index} className="py-5">
                        <div className="flex items-baseline justify-between gap-3">
                          <input
                            value={metric.metric}
                            onChange={e => updateDecisionMetric(index, 'metric', e.target.value)}
                            readOnly={viewOnly}
                            placeholder="지표명"
                            className="flex-1 min-w-0 bg-transparent text-[17.5px] font-extrabold text-bluewood-900 outline-none placeholder:text-bluewood-300"
                          />
                          <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-bluewood-400">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cm.dot }} />
                            {cm.label}
                          </span>
                        </div>
                        <textarea
                          value={metric.whyItMatters}
                          onChange={e => updateDecisionMetric(index, 'whyItMatters', e.target.value)}
                          readOnly={viewOnly}
                          placeholder="왜 중요한 지표인가요?"
                          className="mt-1.5 w-full min-h-[44px] resize-none bg-transparent text-[14.5px] leading-[1.7] text-bluewood-700 outline-none placeholder:text-bluewood-300"
                        />
                        <div className="mt-2.5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                          <div className="min-w-0">
                            <span className="block mb-0.5 text-[11.5px] font-bold text-bluewood-400">확인 방법</span>
                            {viewOnly ? (
                              <p className="text-[13.5px] font-semibold text-bluewood-700 leading-[1.6] whitespace-pre-wrap" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{metric.recommendedProxy || '—'}</p>
                            ) : (
                              <textarea
                                value={metric.recommendedProxy}
                                onChange={e => updateDecisionMetric(index, 'recommendedProxy', e.target.value)}
                                placeholder="확인할 프록시/계산식"
                                rows={2}
                                className="w-full resize-y bg-transparent text-[13.5px] font-semibold text-bluewood-700 leading-[1.6] outline-none placeholder:text-bluewood-300"
                                style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}
                              />
                            )}
                          </div>
                          {(metric.researchBasis || !viewOnly) && (
                            <div className="min-w-0">
                              <span className="block mb-0.5 text-[11.5px] font-bold text-bluewood-400">근거</span>
                              {viewOnly ? (
                                <p className="text-[13.5px] leading-[1.6] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{metric.researchBasis || '—'}</p>
                              ) : (
                                <textarea
                                  value={metric.researchBasis}
                                  onChange={e => updateDecisionMetric(index, 'researchBasis', e.target.value)}
                                  placeholder="자료 근거 또는 [검증 필요]"
                                  className="w-full min-h-[40px] resize-none bg-transparent text-[13.5px] leading-[1.6] text-bluewood-500 outline-none placeholder:text-bluewood-300"
                                />
                              )}
                            </div>
                          )}
                        </div>
                        {!viewOnly && (
                          <button onClick={() => removeDecisionMetric(index)} className="mt-2 text-[12.5px] font-semibold text-bluewood-300 hover:text-red-500 transition-colors">삭제</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 강조 관점 — 목록형 */}
            {R.portfolioAngles.length > 0 && (
              <div>
                <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-primary-500">포트폴리오에서 강조할 관점</p>
                <ul className="space-y-2.5">
                  {R.portfolioAngles.map((angle, i) => (
                    <li key={i} className="flex gap-2.5 text-[14.5px] leading-[1.7] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: '#002F6C' }} />
                      {angle}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 근거 자료 (출처) */}
            {validSources.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-primary-500">근거 자료 {validSources.length}건</p>
                <div className="border-t border-surface-200 divide-y divide-surface-200">
                  {validSources.map((source, index) => {
                    const hasUrl = /^https?:\/\//.test(source.url || '');
                    return (
                      <div key={index} className="py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-[14.5px] font-bold text-bluewood-800 truncate">{source.title || source.url}</p>
                          {source.publisher && <span className="flex-shrink-0 text-[12.5px] font-semibold text-bluewood-400">{source.publisher}</span>}
                        </div>
                        {hasUrl && (
                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-[12.5px] text-primary-600 underline truncate max-w-full">
                            {source.url}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 검증 필요 */}
            {R.limitations && (
              <div className="border-l-2 border-surface-300 pl-4">
                <p className="mb-0.5 text-[12.5px] font-bold text-bluewood-500">검증 필요</p>
                <p className="text-[14px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{R.limitations}</p>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* ── 자소서 활용 가이드 (비마케터 — 마케터는 아래 통합 활용 킷으로 대체) ── */}
      {activeTab === 'coverletter' && !experience?.structuredResult?.marketerKit && (() => {
        const ov = editedOverview || {};
        const clean = (v) => stripMarkdown(sanitizeTextValue(v || '')).replace(/\s+/g, ' ').trim();
        const clip = (v, max = 120) => {
          const s = clean(v);
          return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
        };
        const experienceName = clip(editedTitle || ov.summary || '이 경험', 38);
        const primaryKeyExp = editedKeyExperiences[0] || {};
        const intro = clean(editedContent.intro) || clean(ov.summary) || clean(primaryKeyExp.context) || clean(editedContent.task);
        const problem = clean(ov.background) || clean(ov.goal) || clean(primaryKeyExp.context) || intro;
        const action = clean(editedContent.process) || clean(primaryKeyExp.action) || clean(primaryKeyExp.title);
        const result = clean(editedContent.output) || clean(primaryKeyExp.result) || clean(primaryKeyExp.metric) || clean(primaryKeyExp.afterMetric);
        const growth = clean(editedContent.growth) || clean(primaryKeyExp.learning);
        const role = clean(ov.role);
        const text = [
          intro, problem, action, result, growth, role, clean(editedContent.competency),
          ...(editedKeyExperiences || []).flatMap(k => [k.title, k.metric, k.context, k.action, k.result, k.learning].map(clean)),
        ].join(' ');
        const metrics = [...new Set((text.match(/\d[\d,.]*\s*(?:%|배|ms|초|분|시간|일|주|개월|년|개|건|명|원|만원|억|회|점|위)/g) || []).map(s => s.trim()))].slice(0, 6);
        const kws = [...new Set((editedKeywords || []).map(k => stripMarkdown(String(k)).trim()).filter(Boolean))].slice(0, 6);
        const hasProblem = /문제|해결|개선|한계|이슈|불편|충돌|검증|실험|전환|구조/.test(text);
        const hasTeam = /팀|협업|리드|소통|함께|동료|조율|이해관계/.test(text);
        const hasMetrics = metrics.length > 0;
        const questionTypes = [
          '직무역량 문항',
          hasProblem ? '문제해결 경험 문항' : '강점/역량 문항',
          hasTeam ? '협업·조율 문항' : '성장 경험 문항',
          growth ? '성장·배운 점 문항' : '지원동기 연결 문항',
        ];
        const assetList = [
          {
            title: '문제 정의 역량',
            body: problem
              ? `${clip(problem, 92)}라는 맥락을 단순 상황이 아니라 해결해야 할 구조로 해석한 점을 강조하세요.`
              : '왜 이 경험이 필요했는지, 누구의 어떤 불편을 해결하려 했는지부터 제시하세요.',
          },
          {
            title: '서비스/실행 기획력',
            body: action
              ? `${clip(action, 92)}처럼 실행 방식과 판단 기준을 함께 보여주면 설계 역량이 드러납니다.`
              : '기능이나 활동 나열보다 핵심 루프, 우선순위, 의사결정 기준을 중심으로 정리하세요.',
          },
          {
            title: '검증 중심 사고',
            body: hasMetrics
              ? `${metrics.slice(0, 3).join(', ')} 같은 수치와 근거를 성과 문장에 배치하세요.`
              : '성과 수치가 아직 부족하다면 완주율, 채택률, 재방문율처럼 검증할 지표를 함께 제시하세요.',
          },
          {
            title: '정보 구조화 역량',
            body: '원본 경험을 상황, 행동, 결과, 배운 점으로 분리해 면접과 포트폴리오에서 재사용 가능한 자산으로 만들었다는 관점이 좋습니다.',
          },
          {
            title: '채용 맥락 이해',
            body: '지원자가 말하고 싶은 정보와 평가자가 빠르게 판단하고 싶은 정보 사이의 간극을 줄였다는 메시지로 연결하세요.',
          },
        ];
        const strategyList = [
          {
            title: '직무역량 문항',
            tag: '대표 사례로 배치',
            body: '좋은 아이디어를 냈다는 표현보다 문제를 어떤 기준으로 정의했고, 어떤 정보 구조로 실행했는지를 중심으로 쓰는 것이 좋습니다.',
          },
          {
            title: '지원동기 문항',
            tag: '관점의 예시로 압축',
            body: '사용자 요구와 운영 현실 사이의 차이를 구조적으로 해석하는 사람이라는 메시지와 지원 직무를 연결하기 좋습니다.',
          },
          {
            title: hasTeam ? '협업·조율 문항' : '문제해결 경험 문항',
            tag: hasTeam ? '시선 차이 조정' : '원인-행동-근거',
            body: hasTeam
              ? '서로 다른 기준을 가진 사람들의 요구를 서비스 기준이나 실행 기준으로 바꾼 과정을 강조하세요.'
              : '문제를 발견한 뒤 어떤 가설을 세웠고, 어떤 행동으로 검증했는지 순서가 보이게 구성하세요.',
          },
        ];
        const paragraphFlow = [
          { label: '1문단 · 배경/문제', body: `${clip(problem || intro, 110) || '이 경험이 시작된 배경과 해결해야 할 문제'}를 먼저 제시하세요.` },
          { label: '2문단 · 행동/설계', body: `${clip(action, 110) || '본인이 직접 선택한 실행 방식, 기준, 우선순위'}를 구체적으로 풀어주세요.` },
          { label: '3문단 · 성과/의미', body: `${clip(result, 110) || '산출물, 변화, 검증 지표'}를 통해 경험의 차별점을 설명하세요.` },
          { label: '4문단 · 교훈/직무 연결', body: `${clip(growth, 110) || '이 경험으로 얻은 일하는 방식'}을 지원 직무에서 어떻게 재현할지 연결하세요.` },
        ];
        const sentenceIdeas = [
          `${experienceName} 경험은 단순한 활동 수행이 아니라, 흩어진 문제와 실행 내용을 채용 맥락에서 설명 가능한 경험 자산으로 구조화한 사례입니다.`,
          problem
            ? `${clip(problem, 78)}라는 문제를 발견한 뒤, 이를 해결 기준과 실행 순서로 전환한 문제 정의 경험으로 제시할 수 있습니다.`
            : '사용자와 평가자 관점의 차이를 해석하고, 이를 정보 설계 기준으로 통합한 사례로 제시하기 좋습니다.',
          action
            ? `${clip(action, 82)} 과정에서 실행 기준을 세우고 근거를 남긴 점을 기획 역량으로 연결할 수 있습니다.`
            : '원본 경험을 후속 질문과 근거 확인을 통해 상황, 행동, 결과 중심 정보로 정제한 역량을 드러낼 수 있습니다.',
          result
            ? `${clip(result, 82)}라는 결과를 통해 결과물의 외형보다 신뢰 가능한 실행 근거를 만든 사례로 활용할 수 있습니다.`
            : '완성된 성과를 과장하기보다 핵심 루프, 검증 지표, 다음 실험 계획을 함께 보여주는 사례로 적합합니다.',
          kws.length
            ? `${kws.slice(0, 3).join(', ')} 역량이 실제 행동과 판단 기준 속에서 드러난 경험으로 정리할 수 있습니다.`
            : '좋은 결과를 만들었다는 주장보다 왜 그렇게 판단했고 무엇을 검증했는지가 보이게 쓰는 것이 좋습니다.',
        ];
        const expressionGuide = [
          { good: '~문제를 발견했다', better: '~의 구조적 충돌을 정의했다' },
          { good: '정리했다', better: '검증 가능한 기준으로 구조화했다' },
          { good: '차별화했다', better: '핵심 가치를 ~로 재정의했다' },
          { good: '도와주는 서비스/활동', better: '재사용 가능한 경험 자산을 구축하는 과정' },
        ];
        const avoidList = [
          '완전히 혁신했다처럼 검증 전 성과를 확정하는 표현',
          '사용자 중심적으로 고민했다처럼 근거가 빠진 추상 표현',
          '맞춤형, 효율적, 체계적 같은 단어의 반복',
          '베타 단계의 가설을 이미 달성한 성과처럼 쓰는 방식',
        ];
        const interviewQuestions = [
          `왜 ${experienceName}에서 결과물 자체보다 문제 정의와 검증 구조가 더 중요하다고 판단했는지 설명해보라는 질문이 나올 수 있습니다.`,
          `사실, 추정, 가정을 어떻게 구분했고 신뢰 가능한 정보만 남기기 위해 어떤 기준을 적용했는지 구체 사례를 준비하세요.`,
          hasMetrics
            ? `${metrics[0]} 같은 지표를 어떤 방식으로 측정했고, 왜 그 지표를 우선순위로 삼았는지 후속 질문이 이어질 수 있습니다.`
            : '완주율, 재방문율, 채택률, 만족도 등 여러 검증 지표 중 무엇을 먼저 볼 것인지 이유를 준비하세요.',
        ];
        // 자소서 예시 — 한 덩어리 대신 문단별로 나눠 추천 (자연스러운 1인칭 어투)
        const draftParagraphs = [
          {
            label: '1문단 · 문제를 마주한 순간',
            body: `${problem ? `${clip(problem, 92)} 상황에서도` : '눈에 띄는 문제를 그냥 넘기지 않고'} 저는 무엇이 진짜 원인인지부터 확인하려 했습니다. 보기 좋은 결과를 서두르기보다, 문제를 정확히 정의하는 일이 먼저라고 생각했기 때문입니다.`,
          },
          {
            label: '2문단 · 어떻게 움직였는가',
            body: `${role ? `${role}로서 ` : ''}${action ? clip(action, 100) : '가설을 세우고 우선순위를 정해 하나씩 실행했습니다'}. 여러 선택지 중 왜 이 방법을 골랐는지 기준을 먼저 세웠고, 판단의 근거를 기록으로 남겨 다음 결정에 다시 활용했습니다.`,
          },
          {
            label: '3문단 · 결과와 그 근거',
            body: `${result ? `그 결과 ${clip(result, 100)}` : '그 결과 눈에 보이는 변화를 만들 수 있었습니다'}. ${metrics.length ? `${metrics.slice(0, 2).join(', ')} 같은 수치는 운이 아니라 반복 가능한 과정에서 나왔다고 생각합니다.` : '숫자로 다 담기는 어려웠지만, 같은 방식이라면 다시 만들 수 있다는 확신을 얻었습니다.'}`,
          },
          {
            label: '4문단 · 배운 점과 직무 연결',
            body: `${growth ? `이 경험은 저에게 ${clip(growth, 88)}를 남겼습니다.` : '이 경험은 문제를 구조로 바라보는 습관을 남겼습니다.'} 앞으로 ${role || '지원한 직무'}에서도 과제를 빠르게 쳐내기보다, 무엇을 왜 하는지부터 정의하고 검증하며 일하겠습니다.`,
          },
        ];
        if (!(intro || action || result || kws.length)) return null;
        return (
          <section className="rounded-2xl border border-surface-100 bg-white shadow-[0_6px_24px_rgba(15,40,80,0.05)]">
            <div className="border-b border-surface-200 px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary-600">Cover Letter Guide</p>
                  <h3 className="mt-1 text-[22px] font-black leading-tight text-bluewood-950">자기소개서 활용 가이드</h3>
                  <p className="mt-2 max-w-3xl text-[14px] leading-[1.75] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                    {experienceName} 경험을 자소서 문항에 바로 옮길 수 있도록 핵심 자산, 구성 전략, 문장 표현, 면접 확장 포인트로 정리했어요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 lg:max-w-[360px] lg:justify-end">
                  {questionTypes.map(q => <span key={q} className="rounded-md border border-primary-100 bg-primary-50 px-2.5 py-1 text-[12px] font-bold text-primary-700">{q}</span>)}
                </div>
              </div>
            </div>

            <div className="divide-y divide-surface-200">
              <div className="px-5 py-6 sm:px-7">
                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <div>
                    <p className="flex items-baseline gap-2.5"><span className="text-[24px] font-extrabold leading-none text-primary-500">1</span><span className="text-[14.5px] font-extrabold text-bluewood-900">경험 요약 및 핵심 자산화</span></p>
                    <h4 className="mt-2 text-[18px] font-extrabold text-bluewood-900">이 경험을 어떻게 자소서 소재로 볼 것인가</h4>
                    <p className="mt-3 text-[14.5px] leading-[1.85] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>
                      {experienceName} 경험은 단순한 결과물 제작 사례가 아니라, 문제를 정의하고 실행 기준을 세운 뒤 검증 가능한 경험으로 구조화한 기획 사례입니다. 핵심은 많이 보여주고 싶은 경험을 평가자가 빠르게 판단할 수 있는 정보로 바꿨다는 점입니다.
                    </p>
                    {(metrics.length > 0 || kws.length > 0) && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {metrics.map(m => <span key={m} className="rounded-md bg-bluewood-900 px-2.5 py-1 text-[12px] font-bold text-white">{m}</span>)}
                        {kws.map(k => <span key={k} className="rounded-md border border-surface-200 bg-surface-50 px-2.5 py-1 text-[12px] font-semibold text-bluewood-600">{k}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {assetList.map(asset => (
                      <div key={asset.title} className="rounded-lg border border-surface-200 bg-surface-50/70 p-4">
                        <p className="text-[13px] font-extrabold text-bluewood-900">{asset.title}</p>
                        <p className="mt-1.5 text-[13px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{asset.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-6 sm:px-7">
                <p className="flex items-baseline gap-2.5"><span className="text-[24px] font-extrabold leading-none text-primary-500">2</span><span className="text-[14.5px] font-extrabold text-bluewood-900">추천 구성 전략</span></p>
                <div className="mt-4 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="space-y-3">
                    {strategyList.map(item => (
                      <div key={item.title} className="rounded-lg border border-surface-200 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-extrabold text-bluewood-900">{item.title}</p>
                          <span className="rounded-md bg-primary-50 px-2 py-0.5 text-[11.5px] font-bold text-primary-700">{item.tag}</span>
                        </div>
                        <p className="mt-2 text-[13.5px] leading-[1.75] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{item.body}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-[17px] font-extrabold text-bluewood-900">문단 흐름</h4>
                    <div className="mt-3 border-l-2 border-primary-200 pl-4">
                      {paragraphFlow.map((item, index) => (
                        <div key={item.label} className={index === paragraphFlow.length - 1 ? 'pb-0' : 'pb-4'}>
                          <p className="text-[13px] font-bold text-bluewood-800">{item.label}</p>
                          <p className="mt-1 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{item.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-6 sm:px-7">
                <p className="flex items-baseline gap-2.5"><span className="text-[24px] font-extrabold leading-none text-primary-500">3</span><span className="text-[14.5px] font-extrabold text-bluewood-900">문장 아이디어와 표현 가이드</span></p>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  <div>
                    <h4 className="text-[17px] font-extrabold text-bluewood-900">핵심 문장 아이디어</h4>
                    <ol className="mt-3 space-y-2.5">
                      {sentenceIdeas.map((sentence, index) => (
                        <li key={index} className="flex gap-3 text-[13.5px] leading-[1.75] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-bluewood-900 text-[11px] font-black text-white">{index + 1}</span>
                          <span>{sentence}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="grid gap-4">
                    <div>
                      <h4 className="text-[17px] font-extrabold text-bluewood-900">추천 표현 방식</h4>
                      <div className="mt-3 divide-y divide-surface-100 rounded-lg border border-surface-200">
                        {expressionGuide.map(item => (
                          <div key={item.good} className="grid grid-cols-[0.82fr_1fr] gap-3 px-3.5 py-3 text-[13px]">
                            <span className="text-bluewood-300">{item.good}</span>
                            <span className="font-semibold text-bluewood-700">{item.better}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[17px] font-extrabold text-bluewood-900">피해야 할 문장 유형</h4>
                      <ul className="mt-3 space-y-2">
                        {avoidList.map(item => (
                          <li key={item} className="flex gap-2 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-6 sm:px-7">
                <p className="flex items-baseline gap-2.5"><span className="text-[24px] font-extrabold leading-none text-primary-500">4</span><span className="text-[14.5px] font-extrabold text-bluewood-900">면접 확장 포인트</span></p>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div className="space-y-3">
                    {interviewQuestions.map((question, index) => (
                      <div key={question} className="flex gap-3 rounded-lg border border-surface-200 p-4">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary-600 text-[12px] font-black text-white">Q{index + 1}</span>
                        <p className="text-[13.5px] leading-[1.75] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>{question}</p>
                      </div>
                    ))}
                  </div>
                  {draftParagraphs.length > 0 && (
                    <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[17px] font-extrabold text-bluewood-900">예시 자소서 문단</h4>
                        <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-primary-600 ring-1 ring-primary-100">직무역량 문항 기준</span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {draftParagraphs.map((p, i) => (
                          <div key={i}>
                            <p className="text-[11.5px] font-bold text-primary-500">{p.label}</p>
                            <p className="mt-0.5 text-[13.5px] leading-[1.8] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>{p.body}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 border-l-2 border-primary-500 pl-3 text-[12.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                        그대로 옮기기보다 문단마다 본인의 구체 수치·고민·선택하지 않은 대안을 한두 문장 더 얹어 주세요. 담백한 '~했습니다' 어투로 한 문장에 한 가지 메시지만 담으면 훨씬 사람이 쓴 것처럼 읽힙니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ── 취업 활용 킷 (마케터) — 이력서·자소서·면접 작성법을 적용한 통합 페이지 ── */}
      {activeTab === 'coverletter' && experience?.structuredResult?.marketerKit && (() => {
        const kit = experience.structuredResult.marketerKit || {};
        const kt = (v) => stripMarkdown(sanitizeTextValue(String(v ?? ''))).trim();
        const clip = (v, m = 92) => { const s = kt(v); return s.length > m ? `${s.slice(0, m - 1).trim()}…` : s; };

        // ── AI 산출물 ──
        const resumeVariants = (Array.isArray(kit.resumeVariants) && kit.resumeVariants.length
          ? kit.resumeVariants.map(r => ({ sentence: kt(r?.sentence || r?.text) }))
          : (Array.isArray(kit.resumeBullets) ? kit.resumeBullets.map(s => ({ sentence: kt(s) })) : [])
        ).filter(r => r.sentence);
        const mappings = (Array.isArray(kit.coverLetter?.mappings) ? kit.coverLetter.mappings : [])
          .map(m => ({ questionType: kt(m?.questionType), fit: kt(m?.fit), reason: kt(m?.reason) })).filter(m => m.questionType || m.reason);
        const drafts = (Array.isArray(kit.coverLetter?.drafts) ? kit.coverLetter.drafts : [])
          .map(d => ({ questionType: kt(d?.questionType), text: kt(d?.text) })).filter(d => d.text);
        const warning = kt(kit.coverLetter?.warning);
        const answers = (Array.isArray(kit.interviewScripts?.answers) ? kit.interviewScripts.answers : [])
          .map(a => ({
            question: kt(a?.question), answer30: kt(a?.answer30), answer60: kt(a?.answer60),
            answer180: kt(a?.answer180), defense: kt(a?.defense),
            followUps: (Array.isArray(a?.followUps) ? a.followUps : []).map(kt).filter(Boolean),
          })).filter(a => a.question || a.answer30);
        const plan = ((Array.isArray(kit.actionPlan) && kit.actionPlan.length)
          ? kit.actionPlan.map(p => ({ action: kt(p?.action), why: kt(p?.why), how: kt(p?.how), evidence: (Array.isArray(p?.evidenceToCollect) ? p.evidenceToCollect : []).map(kt).filter(Boolean) }))
          : (Array.isArray(kit.evidenceChecklist) ? kit.evidenceChecklist : []).map(item => ({ action: kt(item), why: '이력서·자소서 문장의 근거를 보강하기 위해', how: '캡처·링크·기획안·리포트로 정리', evidence: [] }))
        ).filter(p => p.action);

        // ── 경험 맥락 (예시·핵심 자산용) ──
        const ov = editedOverview || {};
        const pk = editedKeyExperiences[0] || {};
        const intro = kt(editedContent.intro) || kt(ov.summary) || kt(pk.context);
        const problem = kt(ov.background) || kt(ov.goal) || kt(pk.context) || intro;
        const action = kt(editedContent.process) || kt(pk.action) || kt(pk.title);
        const result = kt(editedContent.output) || kt(pk.result) || kt(pk.metric) || kt(pk.afterMetric);
        const growth = kt(editedContent.growth) || kt(pk.learning);
        const role = kt(ov.role);
        const allText = [intro, problem, action, result, growth,
          ...editedKeyExperiences.flatMap(k => [k.title, k.metric, k.context, k.action, k.result, k.learning].map(kt))].join(' ');
        const metrics = [...new Set((allText.match(/\d[\d,.]*\s*(?:%|배|ms|초|분|시간|일|주|개월|년|개|건|명|원|만원|억|회|점|위)/g) || []).map(s => s.trim()))].slice(0, 6);
        const kws = [...new Set([...(Array.isArray(kit.jdKeywords) ? kit.jdKeywords : []), ...(editedKeywords || [])].map(kt).filter(Boolean))].slice(0, 8);

        // ── 취업 자료 작성 팁 (간결) ──
        const STRONG_VERBS = ['주도', '설계', '구축', '개선', '전환', '달성', '단축', '검증'];
        const EXPR_GUIDE = [
          { bad: '담당했다 / 참여했다', good: '주도해 ~을 만들었다' },
          { bad: '문제를 발견했다', good: '~의 구조적 원인을 정의했다' },
          { bad: '열심히 / 최선을 다했다', good: '~기준으로 우선순위를 정해 실행했다' },
          { bad: '정리했다', good: '검증 가능한 기준으로 구조화했다' },
          { bad: '많이 배웠다', good: '~을 다음 프로젝트에 적용했다' },
        ];
        const AVOID = [
          '열정·노력·최선처럼 근거 없는 추상 표현',
          '검증 전 성과를 확정하는 표현 (예: 완전히 혁신했다)',
          '맞춤형·효율적·체계적 같은 단어의 반복',
          '한 문장에 여러 메시지를 몰아넣는 긴 문장',
        ];
        const experienceName = clip(editedTitle || ov.summary || '이 경험', 34);
        const draftParagraphs = [
          { label: '1문단 · 문제를 마주한 순간', body: `${problem ? `${clip(problem, 90)} 상황에서도` : '눈에 띄는 문제를 그냥 넘기지 않고'} 저는 무엇이 진짜 원인인지부터 확인하려 했습니다. 보기 좋은 결과를 서두르기보다, 문제를 정확히 정의하는 일이 먼저라고 생각했기 때문입니다.` },
          { label: '2문단 · 어떻게 움직였는가', body: `${role ? `${role}로서 ` : ''}${action ? clip(action, 96) : '가설을 세우고 우선순위를 정해 하나씩 실행했습니다'}. 여러 선택지 중 왜 이 방법을 골랐는지 기준을 먼저 세웠고, 판단의 근거를 기록으로 남겨 다음 결정에 다시 활용했습니다.` },
          { label: '3문단 · 결과와 그 근거', body: `${result ? `그 결과 ${clip(result, 96)}` : '그 결과 눈에 보이는 변화를 만들 수 있었습니다'}. ${metrics.length ? `${metrics.slice(0, 2).join(', ')} 같은 수치는 운이 아니라 반복 가능한 과정에서 나왔다고 생각합니다.` : '숫자로 다 담기는 어려웠지만, 같은 방식이라면 다시 만들 수 있다는 확신을 얻었습니다.'}` },
          { label: '4문단 · 배운 점과 직무 연결', body: `${growth ? `이 경험은 저에게 ${clip(growth, 84)}를 남겼습니다.` : '이 경험은 문제를 구조로 바라보는 습관을 남겼습니다.'} 앞으로 ${role || '지원한 직무'}에서도 과제를 빠르게 쳐내기보다, 무엇을 왜 하는지부터 정의하고 검증하며 일하겠습니다.` },
        ];

        const EmptyHint = ({ children }) => (
          <p className="mt-3 rounded-lg border border-dashed border-surface-200 bg-surface-50/50 px-4 py-3 text-[13.5px] leading-[1.75] text-bluewood-400" style={{ wordBreak: 'keep-all' }}>{children}</p>
        );
        const TipLine = ({ children }) => (
          <p className="mt-2 flex gap-1.5 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}><span className="flex-shrink-0">💡</span><span>{children}</span></p>
        );

        return (
          <section className="mt-8 overflow-hidden rounded-2xl border border-surface-100 bg-white shadow-[0_6px_24px_rgba(15,40,80,0.05)]">
            <div className="border-b border-surface-200 bg-gradient-to-br from-primary-50/70 to-white px-6 py-6 sm:px-8">
              <p className="text-[12.5px] font-black uppercase tracking-[0.18em] text-primary-600">Application Kit</p>
              <h3 className="mt-1.5 text-[27px] font-black leading-tight text-bluewood-950">취업 활용 킷</h3>
              <p className="mt-2 max-w-3xl text-[14.5px] leading-[1.75] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{experienceName} 경험을 이력서·자기소개서·면접에 바로 옮길 수 있게 정리했어요.</p>
              {(metrics.length > 0 || kws.length > 0) && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {metrics.map(m => <span key={m} className="rounded-md bg-bluewood-900 px-2.5 py-1 text-[13.5px] font-black text-white">{m}</span>)}
                  {kws.map(k => <span key={k} className="rounded-md border border-primary-100 bg-white px-2.5 py-1 text-[13px] font-bold text-primary-700">{k}</span>)}
                </div>
              )}
            </div>

            <div className="divide-y divide-surface-200">
              {/* 이력서 — 내 문장 위주, 팁은 한 줄 */}
              <div className="px-6 py-6 sm:px-8">
                <h4 className="text-[18px] font-extrabold text-bluewood-900">이력서 · 경력기술서 문장</h4>
                <TipLine><b className="text-bluewood-800">XYZ 공식</b> — [성과]를 [수치]만큼, [방법]을 통해. {STRONG_VERBS.slice(0, 6).join('·')} 같은 강한 동사로 시작하세요.</TipLine>
                {resumeVariants.length > 0 ? (
                  <ol className="mt-4 space-y-2.5">
                    {resumeVariants.map((r, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-bluewood-900 text-[12px] font-black text-white">{i + 1}</span>
                        <p className="text-[15px] font-bold leading-[1.75] text-bluewood-800" style={{ wordBreak: 'keep-all' }}>{r.sentence}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <EmptyHint>아직 추출된 이력서 문장이 없어요. 핵심 경험 페이지에서 AI로 보강하면 성과 수치가 담긴 문장이 채워집니다.</EmptyHint>
                )}
              </div>

              {/* 자기소개서 — 내 자료(추천 문항·초안·예시) 위주, 가이드는 접이식 */}
              <div className="px-6 py-6 sm:px-8">
                <h4 className="text-[18px] font-extrabold text-bluewood-900">자기소개서</h4>
                <TipLine><b className="text-bluewood-800">두괄식</b>으로 결론 먼저 → <b className="text-bluewood-800">STAR</b>(상황·과제·행동·결과)로 근거. 담백한 ‘~했습니다’ 어투, 한 문장에 한 메시지.</TipLine>

                {(mappings.length > 0 || drafts.length > 0 || warning) && (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    {mappings.length > 0 && (
                      <div className="space-y-2.5">
                        <p className="text-[13px] font-bold text-bluewood-400">추천 문항</p>
                        {mappings.map((m, i) => (
                          <div key={i} className="rounded-lg border border-surface-200 p-3.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[14px] font-extrabold text-bluewood-900">{m.questionType}</p>
                              {m.fit && <span className="rounded bg-primary-50 px-2 py-0.5 text-[11.5px] font-bold text-primary-700">{m.fit}</span>}
                            </div>
                            {m.reason && <p className="mt-1.5 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{m.reason}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-3">
                      {drafts.length > 0 && <p className="text-[13px] font-bold text-bluewood-400">AI 초안</p>}
                      {drafts.map((d, i) => (
                        <div key={i} className="relative overflow-hidden rounded-lg border border-surface-200 p-4">
                          <span className="absolute left-0 top-0 h-full w-1 bg-primary-500" />
                          {d.questionType && <p className="text-[13px] font-black text-primary-600">{d.questionType}</p>}
                          <p className="mt-1.5 text-[14px] leading-[1.8] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>{d.text}</p>
                        </div>
                      ))}
                      {warning && <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-3 text-[13.5px] font-bold leading-[1.7] text-amber-800" style={{ wordBreak: 'keep-all' }}>{warning}</p>}
                    </div>
                  </div>
                )}

                {/* 예시 자소서 (문단별) */}
                <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50/50 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-[15px] font-extrabold text-bluewood-900">예시 자소서 (문단별)</h5>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[12px] font-bold text-primary-600 ring-1 ring-primary-100">직무역량 문항</span>
                  </div>
                  <div className="mt-3.5 space-y-3.5">
                    {draftParagraphs.map((p, i) => (
                      <div key={i}>
                        <p className="text-[12.5px] font-bold text-primary-500">{p.label}</p>
                        <p className="mt-1 text-[14.5px] leading-[1.85] text-bluewood-700" style={{ wordBreak: 'keep-all' }}>{p.body}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 border-l-2 border-primary-500 pl-3.5 text-[13px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                    그대로 옮기기보다 문단마다 본인의 구체 수치·고민·선택하지 않은 대안을 한두 문장 더 얹으면 훨씬 진짜 경험처럼 읽힙니다.
                  </p>
                </div>

                {/* 표현 가이드 — 접이식으로 접어 시야에서 뺌 */}
                <details className="group mt-4 rounded-lg border border-surface-200 px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-bold text-bluewood-600">
                    <span>표현 업그레이드 · 피해야 할 표현 보기</span>
                    <span className="text-bluewood-300 transition-transform group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-3 grid gap-5 lg:grid-cols-2">
                    <div className="divide-y divide-surface-100 overflow-hidden rounded-lg border border-surface-200">
                      {EXPR_GUIDE.map((e, i) => (
                        <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5">
                          <span className="text-[13px] text-bluewood-300 line-through">{e.bad}</span>
                          <span className="text-[12px] text-primary-400">→</span>
                          <span className="text-[13px] font-bold text-bluewood-800" style={{ wordBreak: 'keep-all' }}>{e.good}</span>
                        </div>
                      ))}
                    </div>
                    <ul className="space-y-2">
                      {AVOID.map((a, i) => (
                        <li key={i} className="flex gap-2.5 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>
                          <span className="mt-[8px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />{a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </div>

              {/* 면접 — 내 답변 위주, 팁은 한 줄 */}
              <div className="px-6 py-6 sm:px-8">
                <h4 className="text-[18px] font-extrabold text-bluewood-900">면접 답변</h4>
                <TipLine><b className="text-bluewood-800">STAR</b>(상황·과제·행동·결과)로 구조 잡고, 30초 → 1분 → 3분으로 확장하세요.</TipLine>
                {answers.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {answers.map((a, i) => (
                      <div key={i} className="rounded-lg border border-surface-200 p-5">
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-bluewood-900 text-[12px] font-black text-white">Q</span>
                          <p className="pt-0.5 text-[15.5px] font-extrabold leading-snug text-bluewood-950" style={{ wordBreak: 'keep-all' }}>{a.question}</p>
                        </div>
                        {a.answer30 && (
                          <div className="mt-3.5 rounded-lg bg-indigo-50/60 px-4 py-3 ring-1 ring-indigo-100/70">
                            <p className="text-[11px] font-black uppercase tracking-wide text-indigo-500">30초 · 핵심</p>
                            <p className="mt-1 text-[14.5px] font-bold leading-[1.7] text-indigo-950" style={{ wordBreak: 'keep-all' }}>{a.answer30}</p>
                          </div>
                        )}
                        {(a.answer60 || a.answer180) && (
                          <div className="mt-2.5">
                            <p className="text-[11px] font-black uppercase tracking-wide text-bluewood-400">1~3분 · 상세</p>
                            <p className="mt-1 text-[14px] leading-[1.85] text-bluewood-600" style={{ wordBreak: 'keep-all' }}>{[a.answer60, a.answer180].filter(Boolean).join(' ')}</p>
                          </div>
                        )}
                        {a.followUps.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-bold text-bluewood-400">예상 꼬리질문</span>
                            {a.followUps.map((f, fi) => <span key={fi} className="rounded-full bg-amber-50 px-2.5 py-1 text-[12.5px] font-bold text-amber-700 ring-1 ring-amber-100">{f}</span>)}
                          </div>
                        )}
                        {a.defense && <p className="mt-3 border-l-2 border-red-200 pl-3.5 text-[13.5px] font-semibold leading-[1.7] text-red-900/70" style={{ wordBreak: 'keep-all' }}>압박 방어 — {a.defense}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyHint>면접 답변 스크립트가 아직 없어요. 핵심 경험 페이지에서 AI로 보강하면 예상 질문과 STAR 답변이 채워집니다.</EmptyHint>
                )}
              </div>

              {/* 보완 액션 — 내 할 일 위주 */}
              <div className="px-6 py-6 sm:px-8">
                <h4 className="text-[18px] font-extrabold text-bluewood-900">부족한 부분 보완</h4>
                <p className="mt-1.5 text-[13.5px] text-bluewood-400">지금 이 자료를 더 강하게 만들 일들이에요.</p>
                <div className="mt-4" />
                {plan.length > 0 ? (
                  <div className="space-y-3">
                    {plan.map((p, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-bluewood-900 text-[12px] font-black text-white">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14.5px] font-bold leading-snug text-bluewood-900" style={{ wordBreak: 'keep-all' }}>{p.action}</p>
                          {(p.why || p.how) && <p className="mt-1 text-[13.5px] leading-[1.7] text-bluewood-500" style={{ wordBreak: 'keep-all' }}>{[p.why, p.how].filter(Boolean).join(' · ')}</p>}
                          {p.evidence.length > 0 && <p className="mt-1 text-[12.5px] font-bold text-bluewood-400">확보 자료: {p.evidence.join(' · ')}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyHint>보완 액션이 아직 없어요. 성과 캡처·본인 역할 정리처럼 증거를 모을 일들이 이곳에 정리됩니다.</EmptyHint>
                )}
              </div>
            </div>
          </section>
        );
      })()}

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
        <ProjectTimeline experiences={experiences} currentId={id} onBeforeNavigate={confirmDiscardChanges} />
      </div>

      {/* 작성 완성도 패널 — 페이지 톤에 맞춘 진행 링 + 체크리스트 */}
      {showQualityPanel ? (
        <div className="animate-fadeIn fixed bottom-5 left-5 z-40 w-[min(336px,calc(100vw-40px))] overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl shadow-bluewood-900/10">
          <div className="flex items-center gap-3 border-b border-surface-100 px-4 py-3.5">
            <span className="relative inline-flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
                <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3.5" className="stroke-surface-100" />
                <circle cx="20" cy="20" r="17" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-primary-600 transition-all duration-500" strokeDasharray={2 * Math.PI * 17} strokeDashoffset={2 * Math.PI * 17 * (1 - qualityPct / 100)} />
              </svg>
              <span className="absolute text-[11px] font-black tabular-nums text-primary-700">{qualityPct}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-bluewood-700">작성 완성도</p>
              <p className="mt-0.5 text-[12px] font-medium text-bluewood-300">{passedChecks}/{qualityChecks.length}개 항목 완료</p>
            </div>
            <button
              onClick={() => setShowQualityPanel(false)}
              className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-bluewood-300 transition-colors hover:bg-surface-100 hover:text-bluewood-600"
              aria-label="작성 완성도 패널 접기"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="px-3 pb-3.5 pt-2.5">
            <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
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
            <div className="mt-2.5 flex gap-2 rounded-xl bg-surface-50 px-3 py-2.5">
              <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-primary-500" />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-bluewood-600">{activeQualityCheck?.label || '수정 팁'}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-bluewood-400">{activeQualityCheck?.tip || followUpQuestions[0] || '현재 선택한 체크 항목에 맞춰 슬라이드 내용을 보강해 주세요.'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowQualityPanel(true)}
          className="animate-fadeIn fixed bottom-5 left-5 z-40 inline-flex items-center gap-2.5 rounded-full border border-surface-200 bg-white/95 py-2 pl-2 pr-4 shadow-lg shadow-bluewood-900/5 backdrop-blur transition-all hover:border-primary-200 hover:shadow-primary-600/10 active:scale-95"
          aria-label="작성 완성도 열기"
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-surface-100" />
              <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-primary-600 transition-all duration-500" strokeDasharray={2 * Math.PI * 15} strokeDashoffset={2 * Math.PI * 15 * (1 - qualityPct / 100)} />
            </svg>
            <span className="absolute text-[10px] font-black tabular-nums text-primary-700">{qualityPct}</span>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-extrabold text-bluewood-700">작성 완성도</span>
            <span className="block text-[11px] font-semibold text-bluewood-300">{passedChecks}/{qualityChecks.length}개 완료</span>
          </span>
        </button>
      )}

      {showProjectPreviewEditor && projectDetailExperience && (
        <ProjectDetailModal
          exp={projectDetailExperience}
          readOnly={viewOnly}
          onUpdate={viewOnly ? undefined : handleProjectPreviewUpdate}
          onClose={() => setShowProjectPreviewEditor(false)}
          resizeToBase64={resizeToBase64}
          jobAnalysis={jobAnalysis}
        />
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
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={addExportSection}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-200 bg-primary-50/50 px-2 py-2 text-[11.5px] font-bold text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <Plus size={13} /> 빈 섹션
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setShowSectionPicker(v => !v)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-white px-2 py-2 text-[11.5px] font-bold text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        <Plus size={13} /> 구성에서 추가
                      </button>
                      {showSectionPicker && (() => {
                        const avail = availableKnownSections();
                        return (
                          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-surface-200 bg-white p-1 shadow-lg">
                            {avail.length === 0 ? (
                              <p className="px-2 py-3 text-center text-[11px] text-bluewood-400">추가할 섹션이 없습니다.<br />모두 목록에 있어요.</p>
                            ) : avail.map(s => (
                              <button
                                key={s.key}
                                onClick={() => addKnownSection(s.key)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-bluewood-700 hover:bg-surface-50 transition-colors"
                              >
                                <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold ${s.type === 'job' ? 'bg-caribbean-50 text-caribbean-700' : s.type === 'base' ? 'bg-primary-50 text-primary-600' : 'bg-surface-100 text-bluewood-500'}`}>
                                  {s.type === 'job' ? '직군' : s.type === 'base' ? '본문' : s.type === 'summary' ? '경험' : s.type === 'research' ? '리서치' : s.type === 'meta' ? '정보' : '섹션'}
                                </span>
                                <span className="truncate font-semibold">{s.label}</span>
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
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
                          onChange={e => { markDirty(); setEditedTitle(sanitizeTextValue(e.target.value)); }}
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

function ProjectTimeline({ experiences, currentId, onBeforeNavigate = () => true }) {
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
                  onClick={() => { if (!isCurrent && onBeforeNavigate()) navigate(`/app/experience/structured/${exp.id}?view=true`); }}
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
        className="cursor-help font-semibold text-bluewood-900"
        style={hlMarker(`${color}40`)}
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
        className="cursor-help font-semibold text-bluewood-900 transition-colors"
        style={hlMarker(color.hl || `${color.underline}4d`)}
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

  /* 평문 조각 안의 [사실]/[추정]/[가정]/[해석] 토큰을 칩으로 렌더 (인라인 유지) */
  const renderWithLabels = (str) => {
    const segs = str.split(EVIDENCE_TAG_SPLIT_RE);
    if (segs.length === 1) return applyKeywordUnderlines(str);
    return segs.map((seg, si) => {
      const m = seg.match(/^\[(사실|추정|가정|해석)\]$/);
      if (m) return <EvidenceTag key={`lbl-${si}`} kind={m[1]} />;
      if (!seg) return null;
      return <span key={`seg-${si}`}>{applyKeywordUnderlines(seg)}</span>;
    });
  };

  return (
    <p>
      {parts.map((part, i) =>
        part.type ? (
          <HighlightSpan key={i} text={part.text} type={part.type} keywords={part.keywords} />
        ) : (
          <span key={i}>{renderWithLabels(part.text)}</span>
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
