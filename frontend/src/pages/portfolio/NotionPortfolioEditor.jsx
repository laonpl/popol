import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Save, Eye, Download, Plus, Trash2, Loader2,
  GraduationCap, Award, Briefcase, Mail, Phone, Globe,
  MapPin, Calendar, Heart, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X,
  BookOpen, Code, Target, Star, MessageSquare, Upload, Sparkles, ImagePlus,
  PanelLeft, Columns, GripVertical, Type, Image as ImageIcon,
  Mic, Users, Zap, Check, ExternalLink, PenLine, Database, Copy, Camera
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../stores/authStore';
import usePortfolioStore from '../../stores/portfolioStore';
import useExperienceStore, { FRAMEWORKS } from '../../stores/experienceStore';
import JobLinkInput, { JobAnalysisBadge, buildDisplayPortfolioRequirements } from '../../components/JobLinkInput';
import api from '../../services/api';
import toast from 'react-hot-toast';
import YooptaMiniEditor, { CUSTOM_IMAGE_DRAG_TYPE, createYooptaImageValue, createYooptaTableValue, findFirstYooptaImage } from '../../components/YooptaMiniEditor';
import VisualPortfolioRenderer, { VISUAL_TEMPLATE_IDS } from './VisualPortfolioTemplates';
import ProjectDetailModal from '../../components/ProjectDetailModal';

function stripMd(s) {
  return s ? String(s).replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s/gm, '').replace(/^[-•]\s/gm, '').trim() : '';
}

function sanitizePortfolioText(text) {
  if (text == null) return '';
  return String(text)
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function normalizePortfolioBlock(block) {
  if (!block) return null;
  if (block.type === 'image') {
    return {
      id: block.id || `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'image',
      content: block.content || block.src || '',
      alt: sanitizePortfolioText(block.alt || ''),
      width: block.width || '100%',
    };
  }
  if (block.type === 'slide') {
    return {
      id: block.id || `slide-${block.slideKey || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'slide',
      slideKey: block.slideKey || '',
      label: sanitizePortfolioText(block.label || ''),
      kicker: sanitizePortfolioText(block.kicker || ''),
      title: sanitizePortfolioText(block.title || block.headline || ''),
      subtitle: sanitizePortfolioText(block.subtitle || block.subcopy || ''),
      content: sanitizePortfolioText(block.content || ''),
      cards: Array.isArray(block.cards) ? block.cards.map(card => ({
        ...card,
        label: sanitizePortfolioText(card?.label || ''),
        title: sanitizePortfolioText(card?.title || ''),
        body: sanitizePortfolioText(card?.body || ''),
        metric: sanitizePortfolioText(card?.metric || ''),
      })) : [],
    };
  }
  return { id: block.id || `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'text', content: sanitizePortfolioText(block.content || block.text || '') };
}

function portfolioBlocksToText(blocks = []) {
  return blocks.map(block => {
    if (block?.type === 'text') return sanitizePortfolioText(block.content || '');
    if (block?.type === 'slide') {
      const cardText = (block.cards || []).map(card => [card.label, card.title, card.body, card.metric].filter(Boolean).join(' ')).filter(Boolean).join('\n');
      return [block.title, block.subtitle, block.content, cardText].filter(Boolean).map(sanitizePortfolioText).join('\n');
    }
    return '';
  }).filter(Boolean).join('\n\n');
}

function normalizePortfolioSection(section = {}) {
  const blocks = Array.isArray(section.blocks) && section.blocks.length > 0
    ? section.blocks.map(normalizePortfolioBlock).filter(Boolean)
    : (section.content ? [{ id: `${section.key || section.title || 'section'}-text`, type: 'text', content: sanitizePortfolioText(section.content) }] : []);
  return {
    ...section,
    title: sanitizePortfolioText(section.title || section.label || ''),
    label: sanitizePortfolioText(section.label || section.title || ''),
    content: sanitizePortfolioText(section.content || portfolioBlocksToText(blocks)),
    blocks,
  };
}

function recommendationToText(rec) {
  return [rec?.title, rec?.content].filter(Boolean).map(stripMd).join('\n\n');
}

const SECTION_RECOMMEND_APPLY_EVENT = 'fitpoly:apply-section-recommendation';
const DEFAULT_PROJECT_LOGO = '/logo.png';

function toRichTextBlocks(existing, text) {
  const cleanText = stripMd(text);
  if (!cleanText) return Array.isArray(existing) ? existing : [];
  const textBlock = { type: 'text', content: cleanText };
  if (Array.isArray(existing)) {
    const filled = existing.filter(block => block?.type !== 'text' || String(block.content || '').trim());
    return [...filled, textBlock];
  }
  const current = typeof existing === 'string' ? stripMd(existing) : '';
  return current ? [{ type: 'text', content: current }, textBlock] : [textBlock];
}

function appendUniqueItems(items, nextItems) {
  const seen = new Set((items || []).map(item => String(typeof item === 'string' ? item : item?.name || '').trim()).filter(Boolean));
  const additions = nextItems.map(stripMd).filter(Boolean).filter(item => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
  return [...(items || []), ...additions];
}

function applySectionRecommendationToPortfolio(portfolio, sectionType, rec) {
  if (!portfolio || !sectionType || !rec) return portfolio;
  const title = stripMd(rec.title) || '추천 항목';
  const content = stripMd(rec.content) || title;
  const text = recommendationToText(rec);

  switch (sectionType) {
    case 'education':
      return { ...portfolio, education: [...(portfolio.education || []), { name: title, major: '', degree: '', period: '', detail: content }] };
    case 'awards':
      return { ...portfolio, awards: [...(portfolio.awards || []), { date: '', title, organization: '', detail: content }] };
    case 'skills': {
      const skills = portfolio.skills || {};
      return { ...portfolio, skills: { ...skills, others: appendUniqueItems(skills.others || [], [title]) } };
    }
    case 'goals':
      return { ...portfolio, goals: [...(portfolio.goals || []), { title, description: content, blocks: [{ type: 'text', content }], type: 'short', status: 'planned' }] };
    case 'values':
    case 'profile':
      return {
        ...portfolio,
        valuesEssay: [portfolio.valuesEssay, text].filter(Boolean).join('\n\n'),
        valuesEssayBlocks: toRichTextBlocks(portfolio.valuesEssayBlocks || portfolio.valuesEssay, text),
      };
    case 'interviews':
    case 'experiences':
    case 'projects':
      return {
        ...portfolio,
        experiences: [...(portfolio.experiences || []), {
          date: '',
          title,
          description: content,
          status: 'finished',
          classify: [],
          skills: [],
          role: '',
          link: '',
          thumbnailUrl: '',
          sections: [{ title, content }],
          structuredResult: { intro: content, projectOverview: { summary: content } },
        }],
      };
    case 'extracurricular': {
      const extra = portfolio.extracurricular || {};
      return { ...portfolio, extracurricular: { ...extra, details: [...(extra.details || []), { title, period: '', description: content, descriptionBlocks: [{ type: 'text', content }] }] } };
    }
    case 'curricular': {
      const curr = portfolio.curricular || {};
      return { ...portfolio, curricular: { ...curr, summary: { ...(curr.summary || {}), note: [curr.summary?.note, text].filter(Boolean).join('\n\n') } } };
    }
    case 'career':
      return {
        ...portfolio,
        experiences: [...(portfolio.experiences || []), {
          date: '', title, description: content, status: 'finished', classify: ['career'], skills: [], role: '', link: '', thumbnailUrl: '',
          sections: [{ title, content }],
          structuredResult: { intro: content, projectOverview: { summary: content } },
        }],
      };
    case 'introduce':
    case 'resume':
      return {
        ...portfolio,
        valuesEssay: [portfolio.valuesEssay, text].filter(Boolean).join('\n\n'),
        valuesEssayBlocks: toRichTextBlocks(portfolio.valuesEssayBlocks || portfolio.valuesEssay, text),
      };
    case 'contact': {
      const contact = portfolio.contact || {};
      return { ...portfolio, contact: { ...contact, note: [contact.note, text].filter(Boolean).join('\n\n') } };
    }
    default:
      return { ...portfolio, valuesEssayBlocks: toRichTextBlocks(portfolio.valuesEssayBlocks || portfolio.valuesEssay, text) };
  }
}

function getEditableDropTarget(target) {
  if (!(target instanceof Element)) return null;
  return target.closest('textarea,input,[contenteditable="true"]');
}

function insertTextIntoEditable(target, text) {
  if (!target || !text) return false;
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
    const setter = Object.getOwnPropertyDescriptor(target.constructor.prototype, 'value')?.set;
    setter ? setter.call(target, nextValue) : (target.value = nextValue);
    const cursor = start + text.length;
    target.setSelectionRange?.(cursor, cursor);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (target.isContentEditable) {
    target.focus();
    const selection = window.getSelection();
    const rangeIsInsideTarget = selection?.rangeCount && target.contains(selection.getRangeAt(0).commonAncestorContainer);
    if (rangeIsInsideTarget) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      const prefix = target.textContent?.trim() ? '\n' : '';
      target.textContent = `${target.textContent || ''}${prefix}${text}`;
    }
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    target.dispatchEvent(new Event('blur', { bubbles: true }));
    target.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return true;
  }
  return false;
}

function collectRichText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectRichText).join('');
  if (typeof node === 'object') {
    return [node.text, collectRichText(node.children), collectRichText(node.value)]
      .filter(Boolean)
      .join('');
  }
  return '';
}

function richValueToPlainText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .filter(seg => seg?.type !== 'image')
      .map(seg => sanitizePortfolioText(seg?.content || ''))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0))
      .map(block => collectRichText(block?.value || block))
      .map(sanitizePortfolioText)
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

const EMPTY_PORTFOLIO = {
  templateType: 'notion',
  // Profile
  headline: '',
  userName: '',
  nameEn: '',
  location: '',
  birthDate: '',
  profileImageUrl: '',
  values: [],
  // Education
  education: [],
  // Interest
  interests: [],
  // Scholarship & Awards
  awards: [],
  // Experience
  experiences: [],
  // Contact
  contact: { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '' },
  // 교과 활동
  curricular: {
    summary: { credits: '', gpa: '' },
    courses: [],
    creditStatus: [],
  },
  // 비교과 활동
  extracurricular: {
    summary: '',
    badges: [],
    languages: [],
    details: [],
  },
  // 기술
  skills: {
    tools: [],
    languages: [],
    frameworks: [],
    others: [],
  },
  // 목표와 계획
  goals: [],
  // 가치관
  valuesEssay: '',
  // 가치관/자기소개 - Rich 콘텐츠 (텍스트+이미지 혼합)
  valuesEssayBlocks: null,
  // 커버 이미지 (visual 템플릿 공용)
  coverImageUrl: '',
  // 커스텀 블록
  customBlocks: [],
  // 활동 기록 (타임라인)
  activityRecords: [],
  // Ashley 전용
  interviews: [],
  books: [],
  lectures: [],
  funfacts: [],
  // 숨겨진 섹션
  hiddenSections: [],
  // 섹션 순서 (드래그 or 버튼으로 변경)
  sectionOrder: [],
  contentBlockOrder: {},
  // 섹션 이름 커스텀
  customSectionLabels: {},
  customSectionIcons: {},
  customSectionStyles: {},
  customSectionTitleSegments: {},
  tableColumns: {},
  // 스킬 레벨 (퍼센트)
  skillLevels: {},
};

// 컴포넌트 외부 상수 — 렌더링마다 재생성 방지
const SECTION_LABELS = {
  ashley: {
    profile: '프로필',
    education: '학교',
    experiences: '경력 & 프로젝트',
    interviews: '인터뷰',
    books: '저서 & 글쓰기',
    lectures: '강연 & 모더레이터',
    skills: '이런 일을 할 수 있어요',
    values: '나를 들려주는 이야기',
    funfacts: '독특한 경험',
    contact: '연락처',
  },
  academic: {
    profile: '프로필',
    education: '학력',
    awards: '수상/장학금',
    experiences: 'Portfolio & Experience',
    curricular: '교과 활동',
    extracurricular: '비교과 & 자격증',
    skills: 'Skills',
    goals: 'Personal Statement',
    values: '소개글',
    contact: 'Contact',
  },
  notion: {
    profile: '프로필',
    education: '학력',
    awards: '수상/장학금',
    experiences: '경험',
    curricular: '교과 활동',
    extracurricular: '비교과 활동',
    skills: '기술',
    goals: '목표와 계획',
    values: '가치관',
    contact: '연락처',
  },
  timeline: {
    profile: '프로필',
    education: '학력',
    curricular: '학기별 수업',
    experiences: '활동 기록',
    goals: '스터디 계획',
    skills: '기술',
    awards: '수상/장학금',
    contact: '연락처',
  },
};

const TEMPLATE_SECTION_MAP = {
  ashley: ['profile', 'education', 'awards', 'experiences', 'interviews', 'books', 'lectures', 'skills', 'goals', 'values', 'funfacts', 'contact'],
  academic: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  notion: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  timeline: ['profile', 'education', 'curricular', 'experiences', 'goals', 'skills', 'awards', 'contact'],
};

const REORDERABLE_SECTION_MAP = {
  ashley: ['profile', 'education', 'awards', 'experiences', 'interviews', 'books', 'lectures', 'skills', 'goals', 'values', 'funfacts', 'contact'],
  academic: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  notion: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  timeline: ['profile', 'education', 'curricular', 'activities', 'goals', 'skills', 'awards', 'contact'],
};

function createDragPreview(label, tone = 'default') {
  const preview = document.createElement('div');
  preview.textContent = label;
  preview.style.position = 'fixed';
  preview.style.top = '-1000px';
  preview.style.left = '-1000px';
  preview.style.zIndex = '9999';
  preview.style.pointerEvents = 'none';
  preview.style.padding = '10px 14px';
  preview.style.borderRadius = '12px';
  preview.style.fontSize = '13px';
  preview.style.fontWeight = '700';
  preview.style.boxShadow = '0 16px 40px rgba(15, 23, 42, 0.18)';
  preview.style.border = tone === 'warm' ? '1px solid #e8e4dc' : '1px solid #dbeafe';
  preview.style.background = tone === 'warm' ? '#fffaf0' : '#eff6ff';
  preview.style.color = tone === 'warm' ? '#5f4b32' : '#1e3a8a';
  document.body.appendChild(preview);
  requestAnimationFrame(() => preview.remove());
  return preview;
}

function makeSectionOrderManager(templateId, sectionOrder, update) {
  const reorderable = REORDERABLE_SECTION_MAP[templateId] || REORDERABLE_SECTION_MAP.notion;
  const filteredSaved = Array.isArray(sectionOrder)
    ? sectionOrder.filter(key => reorderable.includes(key))
    : [];
  const order = filteredSaved.length > 0
    ? [...filteredSaved, ...reorderable.filter(key => !filteredSaved.includes(key))]
    : reorderable;

  return {
    getOrder: (key) => {
      const index = order.indexOf(key);
      return index >= 0 ? index : order.length;
    },
    move: (fromKey, toKey) => {
      if (!fromKey || fromKey === toKey || !reorderable.includes(fromKey) || !reorderable.includes(toKey)) return;
      const next = [...order];
      const fromIndex = next.indexOf(fromKey);
      const toIndex = next.indexOf(toKey);
      if (fromIndex === -1 || toIndex === -1) return;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      update('sectionOrder', next);
    },
    swap: (fromKey, toKey) => {
      if (!fromKey || fromKey === toKey || !reorderable.includes(fromKey) || !reorderable.includes(toKey)) return;
      const next = [...order];
      const fromIndex = next.indexOf(fromKey);
      const toIndex = next.indexOf(toKey);
      if (fromIndex === -1 || toIndex === -1) return;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      update('sectionOrder', next);
    },
  };
}

function reorderItems(items, fromIndex, toIndex) {
  if (!Array.isArray(items) || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function getDefaultCustomBlockTitle(type) {
  if (type === 'heading') return '제목';
  if (type === 'image') return '이미지';
  if (type === 'divider') return '구분선';
  if (type === 'table') return '표';
  if (type === 'project') return '프로젝트 / 경험';
  return '텍스트';
}

function getCustomBlockLabel(block, index) {
  if (block?.title) return block.title;
  if (block?.type === 'heading') return block.content || '제목 블록';
  if (block?.type === 'image') return '이미지 블록';
  if (block?.type === 'divider') return '구분선 블록';
  if (block?.type === 'table') return '표 블록';
  if (block?.type === 'project') return '프로젝트 블록';
  return `텍스트 블록 ${index + 1}`;
}

const EDITABLE_ICON_MAP = {
  phone: Phone,
  mail: Mail,
  globe: Globe,
  map: MapPin,
  calendar: Calendar,
  heart: Heart,
  book: BookOpen,
  award: Award,
  briefcase: Briefcase,
  star: Star,
  target: Target,
  message: MessageSquare,
  code: Code,
};

const SECTION_TITLE_SIZE_OPTIONS = [
  { value: '', label: '기본' },
  { value: '12px', label: '12' },
  { value: '14px', label: '14' },
  { value: '16px', label: '16' },
  { value: '18px', label: '18' },
  { value: '20px', label: '20' },
  { value: '24px', label: '24' },
  { value: '28px', label: '28' },
  { value: '32px', label: '32' },
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleSegmentsToHtml(segments, fallback) {
  const safeSegments = Array.isArray(segments) && segments.length > 0
    ? segments
    : [{ text: fallback || '', fontSize: '' }];
  return safeSegments.map(segment => {
    const text = escapeHtml(segment?.text || '');
    const fontSize = SECTION_TITLE_SIZE_OPTIONS.some(option => option.value === segment?.fontSize) ? segment.fontSize : '';
    return fontSize ? `<span style="font-size:${fontSize}">${text}</span>` : text;
  }).join('');
}

function readTitleSegmentsFromElement(element) {
  const segments = [];
  const walk = (node, inheritedSize = '') => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent) segments.push({ text: node.textContent, fontSize: inheritedSize });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const size = SECTION_TITLE_SIZE_OPTIONS.some(option => option.value === node.style?.fontSize)
      ? node.style.fontSize
      : inheritedSize;
    Array.from(node.childNodes).forEach(child => walk(child, size));
  };
  Array.from(element.childNodes).forEach(child => walk(child));
  return segments.filter(segment => segment.text.length > 0);
}

function EditableSectionTitle({ portfolio, update, sectionKey, defaultLabel, className = '', hoverClassName = 'hover:bg-primary-50/30' }) {
  const titleRef = useRef(null);
  const savedRangeRef = useRef(null);
  const labels = portfolio.customSectionLabels || {};
  const titleSegments = portfolio.customSectionTitleSegments || {};
  const segments = titleSegments[sectionKey];
  const fallbackLabel = labels[sectionKey] || defaultLabel;
  const updateSegments = () => {
    const nextSegments = readTitleSegmentsFromElement(titleRef.current);
    update('customSectionTitleSegments', { ...titleSegments, [sectionKey]: nextSegments });
    update('customSectionLabels', { ...labels, [sectionKey]: nextSegments.map(segment => segment.text).join('') || defaultLabel });
  };
  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !titleRef.current?.contains(selection.anchorNode)) return;
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  };
  const applyFontSize = (fontSize) => {
    const selection = window.getSelection();
    const liveRange = selection?.rangeCount && titleRef.current?.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : null;
    const range = liveRange || savedRangeRef.current;
    if (!range || !titleRef.current?.contains(range.commonAncestorContainer)) return;
    if (range.collapsed) return;
    const wrapper = document.createElement('span');
    if (fontSize) wrapper.style.fontSize = fontSize;
    try {
      range.surroundContents(wrapper);
    } catch {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }
    titleRef.current.normalize();
    updateSegments();
    selection.removeAllRanges();
  };

  useEffect(() => {
    if (!titleRef.current) return;
    const nextHtml = titleSegmentsToHtml(segments, fallbackLabel);
    if (titleRef.current.innerHTML !== nextHtml) titleRef.current.innerHTML = nextHtml;
  }, [segments, fallbackLabel]);

  return (
    <span className="group/title-size relative inline-flex max-w-full items-center gap-1 align-baseline">
      <span
        ref={titleRef}
        contentEditable
        suppressContentEditableWarning
        onInput={updateSegments}
        onBlur={updateSegments}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onPaste={event => {
          event.preventDefault();
          document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
        }}
        className={`min-w-0 bg-transparent outline-none rounded px-1 ${hoverClassName} ${className}`}
        dangerouslySetInnerHTML={{ __html: titleSegmentsToHtml(segments, fallbackLabel) }}
      />
      <select
        defaultValue=""
        onChange={event => {
          applyFontSize(event.target.value);
          event.target.value = '';
        }}
        className="h-6 rounded border border-surface-200 bg-white px-1 text-[11px] text-gray-500 opacity-0 shadow-sm transition-opacity group-hover/title-size:opacity-100 focus:opacity-100"
        title="선택 글자 크기"
        aria-label="선택 글자 크기"
      >
        {SECTION_TITLE_SIZE_OPTIONS.map(option => (
          <option key={option.value || 'default'} value={option.value}>{option.label}</option>
        ))}
      </select>
    </span>
  );
}

function EditableIcon({ value, onChange, className = 'text-gray-400', size = 14 }) {
  const Icon = EDITABLE_ICON_MAP[value] || Globe;
  return (
    <span className="group/icon relative inline-flex flex-shrink-0 items-center">
      <Icon size={size} className={className} />
      <select
        value={value || 'globe'}
        onChange={event => onChange(event.target.value)}
        className="absolute -inset-1 cursor-pointer opacity-0"
        title="아이콘 변경"
        aria-label="아이콘 변경"
      >
        {Object.keys(EDITABLE_ICON_MAP).map(key => (
          <option key={key} value={key}>{key}</option>
        ))}
      </select>
    </span>
  );
}

function makeSectionPackageBlocks(sectionKey, startOrder = 0) {
  const titles = {
    profile: '프로필 | Profile',
    education: '학력 | Education',
    awards: '수상 | Awards',
    experiences: '프로젝트 / 경험',
    curricular: '교과 활동 | Curricular Activities',
    extracurricular: '비교과 활동 | Extracurricular Activities',
    skills: '기술 | Skills',
    goals: '목표와 계획 | Future Plans',
    values: '가치관 | Values',
    interests: '관심사 | Interest',
    contact: '연락처 | Contact',
  };
  const bodies = {
    profile: '사진\n이름\n소개\n가치관',
    education: '학교명\n기간\n전공\n상세 내용',
    awards: '날짜\n수상명\n기관\n설명',
    experiences: '프로젝트명\n기간\n역할\n설명\n성과',
    curricular: '요약\n이수 학점:\n평점 평균:\n\n교과목 수강 내역',
    extracurricular: '요약\n\n디지털 배지\n\n어학 성적\n\n세부 사항',
    skills: '언어\n도구\n프레임워크\n기타 역량',
    goals: '단기 목표\n중기 목표\n장기 목표\n상세 계획',
    values: '내가 중요하게 생각하는 가치\n\n경험과 연결되는 이야기',
    interests: '관심사\n관심사를 갖게 된 이유\n관련 활동',
    contact: '전화\n이메일\nLinkedIn\nGitHub\n웹사이트',
  };
  const blocks = [
    { type: 'heading', title: titles[sectionKey] || '새 섹션', content: titles[sectionKey] || '새 섹션', order: startOrder },
    { type: 'text', title: '내용', content: bodies[sectionKey] || '', order: startOrder + 0.01 },
  ];
  if (sectionKey === 'curricular') {
    blocks.push(
      { type: 'table', title: '교과목 수강 내역', content: '', contentBlocks: createYooptaTableValue(3, 3), order: startOrder + 0.02 },
      { type: 'table', title: '이수 현황', content: '', contentBlocks: createYooptaTableValue(3, 6), order: startOrder + 0.03 },
    );
  }
  if (sectionKey === 'extracurricular') {
    blocks.push(
      { type: 'table', title: '디지털 배지', content: '', contentBlocks: createYooptaTableValue(3, 2), order: startOrder + 0.02 },
      { type: 'table', title: '어학 성적', content: '', contentBlocks: createYooptaTableValue(3, 3), order: startOrder + 0.03 },
    );
  }
  return blocks;
}

function shouldIgnoreBlockDrag(target) {
  if (!(target instanceof Element)) return true;
  return !!target.closest('input,textarea,select,button,a,label,[contenteditable="true"],[role="textbox"],[data-no-block-drag="true"]');
}

function startCustomBlockDrag(event, index, label, setDragging, tone = 'default') {
  setDragging(index);
  event.dataTransfer.setData('application/x-fitpoly-custom-block', String(index));
  event.dataTransfer.setData('block-idx', String(index));
  event.dataTransfer.setData('blockIdx', String(index));
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setDragImage(createDragPreview(label, tone), 16, 16);
}

function findScrollableAncestor(target) {
  let element = target instanceof Element ? target : null;
  while (element) {
    const { overflowY } = window.getComputedStyle(element);
    if (/(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight) {
      return element;
    }
    element = element.parentElement;
  }
  return document.scrollingElement;
}

function useDragEdgeAutoScroll(active, edgeSize = 180, minSpeed = 8, maxSpeed = 36) {
  const pointerYRef = useRef(null);
  const scrollElementRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    const updatePointer = (event) => {
      pointerYRef.current = event.clientY;
      scrollElementRef.current = findScrollableAncestor(event.target);
    };
    const clearPointer = () => {
      pointerYRef.current = null;
      scrollElementRef.current = null;
    };
    const scrollFrame = () => {
      const pointerY = pointerYRef.current;
      const scrollElement = scrollElementRef.current;
      if (pointerY != null && scrollElement) {
        const isDocument = scrollElement === document.scrollingElement;
        const rect = isDocument
          ? { top: 0, bottom: window.innerHeight, height: window.innerHeight }
          : scrollElement.getBoundingClientRect();
        const activeEdgeSize = Math.min(edgeSize, rect.height / 2);
        let speed = 0;
        if (pointerY < rect.top + activeEdgeSize) {
          const intensity = 1 - Math.max(pointerY - rect.top, 0) / activeEdgeSize;
          speed = -(minSpeed + (maxSpeed - minSpeed) * intensity);
        } else if (pointerY > rect.bottom - activeEdgeSize) {
          const intensity = 1 - Math.max(rect.bottom - pointerY, 0) / activeEdgeSize;
          speed = minSpeed + (maxSpeed - minSpeed) * intensity;
        }
        if (speed) scrollElement.scrollBy(0, speed);
      }
      frameRef.current = requestAnimationFrame(scrollFrame);
    };

    document.addEventListener('dragover', updatePointer, true);
    document.addEventListener('drop', clearPointer, true);
    document.addEventListener('dragend', clearPointer, true);
    frameRef.current = requestAnimationFrame(scrollFrame);

    return () => {
      document.removeEventListener('dragover', updatePointer, true);
      document.removeEventListener('drop', clearPointer, true);
      document.removeEventListener('dragend', clearPointer, true);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      pointerYRef.current = null;
      scrollElementRef.current = null;
    };
  }, [active, edgeSize, minSpeed, maxSpeed]);
}

const SECTIONS_BASE = [
  { id: 'profile', icon: Heart, defaultLabel: '프로필' },
  { id: 'education', icon: GraduationCap, defaultLabel: '학력' },
  { id: 'awards', icon: Award, defaultLabel: '수상/장학금' },
  { id: 'experiences', icon: Briefcase, defaultLabel: '경험' },
  { id: 'interviews', icon: Mic, defaultLabel: '인터뷰' },
  { id: 'books', icon: BookOpen, defaultLabel: '저서' },
  { id: 'lectures', icon: Users, defaultLabel: '강연' },
  { id: 'curricular', icon: BookOpen, defaultLabel: '교과 활동' },
  { id: 'extracurricular', icon: Star, defaultLabel: '비교과 활동' },
  { id: 'skills', icon: Code, defaultLabel: '기술' },
  { id: 'goals', icon: Target, defaultLabel: '목표와 계획' },
  { id: 'values', icon: MessageSquare, defaultLabel: '가치관' },
  { id: 'funfacts', icon: Zap, defaultLabel: '독특한 경험' },
  { id: 'contact', icon: Mail, defaultLabel: '연락처' },
];

export default function NotionPortfolioEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { updatePortfolio, setCurrentPortfolio, exportPortfolio } = usePortfolioStore();

  const [portfolio, setPortfolio] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('profile');
  const [userExperiences, setUserExperiences] = useState([]);
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [editMode, setEditMode] = useState(
    new URLSearchParams(location.search).get('mode') === 'form' ? 'form' : 'visual'
  );
  const [analysisMode, setAnalysisMode] = useState(true);

  // 자동 저장 관련
  const autoSaveTimer = useRef(null);
  const initialLoaded = useRef(false);
  const pendingRef = useRef(false);
  const queuedPortfolioRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isHistoryActionRef = useRef(false);

  const persistPortfolio = useCallback(async (snapshot) => {
    if (!snapshot) return;
    if (pendingRef.current) {
      queuedPortfolioRef.current = snapshot;
      return;
    }
    pendingRef.current = true;
    try {
      const { id: _id, ...data } = snapshot;
      await updatePortfolio(id, data);
    } catch { /* Keep editing available when an automatic save fails. */ }
    finally {
      pendingRef.current = false;
      const queued = queuedPortfolioRef.current;
      queuedPortfolioRef.current = null;
      if (queued && queued !== snapshot) persistPortfolio(queued);
    }
  }, [id, updatePortfolio]);

  useEffect(() => {
    if (!portfolio || !initialLoaded.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => persistPortfolio(portfolio), 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [portfolio, persistPortfolio]);

  const labels = useMemo(() => ({
    ...(SECTION_LABELS[portfolio?.templateId] || SECTION_LABELS.notion),
    ...(portfolio?.customSectionLabels || {}),
  }), [portfolio?.templateId, portfolio?.customSectionLabels]);

  const visibleSections = useMemo(() => {
    const allowed = TEMPLATE_SECTION_MAP[portfolio?.templateId] || TEMPLATE_SECTION_MAP.notion;
    const hidden = portfolio?.hiddenSections || [];
    return SECTIONS_BASE
      .filter(s => allowed.includes(s.id) && !hidden.includes(s.id))
      .map(s => ({ ...s, label: labels[s.id] || s.defaultLabel }));
  }, [portfolio?.templateId, portfolio?.hiddenSections, labels]);

  const removableHiddenSections = useMemo(() => {
    const allowed = TEMPLATE_SECTION_MAP[portfolio?.templateId] || TEMPLATE_SECTION_MAP.notion;
    return SECTIONS_BASE
      .filter(s => allowed.includes(s.id) && (portfolio?.hiddenSections || []).includes(s.id))
      .map(s => ({ ...s, label: labels[s.id] || s.defaultLabel }));
  }, [portfolio?.templateId, portfolio?.hiddenSections, labels]);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const portfolioSnap = await getDoc(doc(db, 'portfolios', id));
      if (portfolioSnap.exists()) {
        const pData = { id: portfolioSnap.id, ...portfolioSnap.data() };
        // Merge with EMPTY_PORTFOLIO defaults
        const merged = { ...EMPTY_PORTFOLIO, ...pData };
        if (!merged.education) merged.education = [];
        if (!merged.awards) merged.awards = [];
        if (!merged.experiences) merged.experiences = [];
        if (!merged.contact) merged.contact = { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '' };
        if (!merged.skills) merged.skills = { tools: [], languages: [], frameworks: [], others: [] };
        if (!merged.goals) merged.goals = [];
        if (!merged.values) merged.values = [];
        if (!merged.interests) merged.interests = [];
        if (!merged.curricular) merged.curricular = { summary: { credits: '', gpa: '' }, courses: [], creditStatus: [] };
        if (!merged.extracurricular) merged.extracurricular = { summary: '', badges: [], languages: [], details: [] };
        if (!merged.interviews) merged.interviews = [];
        if (!merged.books) merged.books = [];
        if (!merged.lectures) merged.lectures = [];
        if (!merged.funfacts) merged.funfacts = [];
        if (!merged.hiddenSections) merged.hiddenSections = [];
        if (!merged.activityRecords) merged.activityRecords = [];
        if (!merged.customSectionLabels) merged.customSectionLabels = {};
        if (!merged.customSectionStyles) merged.customSectionStyles = {};
        if (!merged.customSectionTitleSegments) merged.customSectionTitleSegments = {};
        if (!merged.skillLevels) merged.skillLevels = {};
        setPortfolio(merged);
        setCurrentPortfolio(merged);
      }
      await useExperienceStore.getState().fetchExperiences(user.uid);
      setUserExperiences(useExperienceStore.getState().experiences);
      // 초기 로드 완료 표시 — 자동 저장 활성화
      setTimeout(() => { initialLoaded.current = true; }, 500);

      // 경험 내보내기 config가 있으면 자동 import
      const exportConfig = location.state?.exportConfig;
      if (exportConfig && portfolioSnap.exists()) {
        const mergedPf = { ...EMPTY_PORTFOLIO, ...portfolioSnap.data() };
        if (!mergedPf.customSectionStyles) mergedPf.customSectionStyles = {};
        if (!mergedPf.customSectionTitleSegments) mergedPf.customSectionTitleSegments = {};
        const existing = mergedPf.experiences || [];
        const importedIndex = exportConfig.experienceId
          ? existing.findIndex(e => e.experienceId === exportConfig.experienceId)
          : -1;
        {
          const sr = exportConfig.structuredResult || {};
          const overview = exportConfig.projectOverview || sr.projectOverview || {};
          const importedSections = (exportConfig.sections || []).map(section => normalizePortfolioSection({ ...section, title: section.title || section.label }));
          const carriedNotionDoc = exportConfig.notionDoc || null;
          const newExp = {
            date: overview.duration || '',
            title: exportConfig.title || '',
            description: overview.summary || sr.intro || '',
            experienceId: exportConfig.experienceId || null,
            notionDoc: carriedNotionDoc,
            framework: 'STRUCTURED',
            frameworkContent: {},
            keywords: exportConfig.keywords || [],
            aiSummary: overview.summary || sr.intro || '',
            structuredResult: {
              ...sr,
              projectOverview: overview,
              keyExperiences: exportConfig.keyExperiences || sr.keyExperiences || [],
              exportConfig: {
                sectionOrder: exportConfig.sectionOrder,
                sections: importedSections.map(section => ({ key: section.key, label: section.label || section.title, type: section.type || 'custom', content: section.content, blocks: section.blocks || [] })),
                draftSections: (exportConfig.draftSections || sr.exportConfig?.draftSections || importedSections).map(section => normalizePortfolioSection(section)),
                jobCategory: exportConfig.jobCategory,
                coverImg: exportConfig.coverImg || null,
              },
            },
            thumbnailUrl: '',
            status: 'finished',
            classify: [],
            skills: (overview.techStack || []).length > 0
              ? overview.techStack
              : (exportConfig.keywords || []).slice(0, 8).map(k => typeof k === 'string' ? k : k?.name ?? '').filter(Boolean),
            role: overview.role || '',
            link: '',
            sections: importedSections.map(section => ({ title: section.label || section.title, content: section.content, blocks: section.blocks || [], key: section.key, type: section.type || 'custom' })),
          };
          const updatedExps = importedIndex >= 0
            ? existing.map((item, index) => (index === importedIndex ? { ...item, ...newExp } : item))
            : [...existing, newExp];
          setPortfolio(prev => {
            const next = { ...(prev || mergedPf), experiences: updatedExps };
            setCurrentPortfolio(next);
            return next;
          });
          await updatePortfolio(id, { experiences: updatedExps });
          toast.success(importedIndex >= 0
            ? `"${exportConfig.title}" 경험의 미리보기를 최신 상태로 업데이트했습니다`
            : `"${exportConfig.title}" 경험이 포트폴리오에 추가되었습니다`);
        }
        // state 초기화
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (error) {
      toast.error('데이터를 불러오지 못했습니다');
    }
    setLoading(false);
  };

  const commitPortfolio = useCallback((producer) => {
    setPortfolio(prev => {
      if (!prev) return prev;
      const next = typeof producer === 'function' ? producer(prev) : producer;
      if (!next || next === prev || JSON.stringify(next) === JSON.stringify(prev)) return prev;
      if (!isHistoryActionRef.current) {
        undoStackRef.current = [...undoStackRef.current.slice(-79), prev];
        redoStackRef.current = [];
      }
      return next;
    });
  }, []);

  const update = (field, value) => {
    commitPortfolio(prev => ({ ...prev, [field]: value }));
  };

  // 여러 최상위 필드를 한 번에 갱신 (예: blocks + plain 텍스트 동시 저장)
  const updateMany = (fields) => {
    commitPortfolio(prev => ({ ...prev, ...fields }));
  };

  useEffect(() => {
    if (portfolio) setCurrentPortfolio(portfolio);
  }, [portfolio, setCurrentPortfolio]);

  const updateNested = (parent, field, value) => {
    commitPortfolio(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  // Array helpers
  const addToArray = (field, item) => {
    commitPortfolio(prev => ({
      ...prev,
      [field]: field === 'customBlocks'
        ? [item, ...(prev[field] || [])]
        : [...(prev[field] || []), item]
    }));
  };
  const removeFromArray = (field, index) => {
    commitPortfolio(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };
  const updateArrayItem = (field, index, value) => {
    commitPortfolio(prev => {
      const arr = [...prev[field]];
      arr[index] = typeof value === 'object' ? { ...arr[index], ...value } : value;
      return { ...prev, [field]: arr };
    });
  };

  useEffect(() => {
    const onKeyDown = (event) => {
        const key = event.key.toLowerCase();
        const isMod = event.ctrlKey || event.metaKey;
        if (!isMod || (key !== 'z' && key !== 'y')) return;
        const active = document.activeElement;
        if (
          active?.closest?.('.yoopta-mini-editor') ||
          active?.tagName === 'SELECT'
        ) return;
      event.preventDefault();
      event.stopPropagation();
      if (key === 'z' && !event.shiftKey) {
        const prev = undoStackRef.current.pop();
        if (!prev) return;
        redoStackRef.current = portfolio ? [...redoStackRef.current.slice(-79), portfolio] : redoStackRef.current;
        isHistoryActionRef.current = true;
        setPortfolio(prev);
        queueMicrotask(() => { isHistoryActionRef.current = false; });
        return;
      }
      const next = redoStackRef.current.pop();
      if (!next) return;
      undoStackRef.current = portfolio ? [...undoStackRef.current.slice(-79), portfolio] : undoStackRef.current;
      isHistoryActionRef.current = true;
      setPortfolio(next);
      queueMicrotask(() => { isHistoryActionRef.current = false; });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [portfolio]);

  useEffect(() => {
    const applyRecommendation = (event) => {
      const { sectionType, recommendation } = event.detail || {};
      if (!sectionType || !recommendation) return;
      setPortfolio(prev => applySectionRecommendationToPortfolio(prev, sectionType, recommendation));
      toast.success('추천 내용을 적용했습니다');
    };
    window.addEventListener(SECTION_RECOMMEND_APPLY_EVENT, applyRecommendation);
    return () => window.removeEventListener(SECTION_RECOMMEND_APPLY_EVENT, applyRecommendation);
  }, []);

  // 포트폴리오 요건 체크리스트
  const [reqChecklist, setReqChecklist] = useState(null);
  useEffect(() => {
    if (!reqChecklist) return;
    const t = setTimeout(() => setReqChecklist(null), 10000);
    return () => clearTimeout(t);
  }, [reqChecklist]);

  const checkPortfolioRequirements = (p) => {
    const ja = p.jobAnalysis;
    if (!ja) { setReqChecklist(null); return; }

    // 실제 뱃지에 표시되는 것과 동일한 요건(보강 포함)으로 체크
    const pr = buildDisplayPortfolioRequirements(ja);
    const checks = [];

    // 필수 서류
    (pr.required || []).forEach(req => {
      const lower = req.toLowerCase();
      let passed = false;
      if (/github/i.test(lower)) {
        passed = !!(p.contact?.github);
      } else if (/이력서|자기소개서|cv\b/i.test(lower)) {
        passed = true; // 앱 자체가 포트폴리오/이력서
      } else if (/pdf|포트폴리오|portfolio/i.test(lower)) {
        // 포트폴리오는 경험이 1개 이상 있고 이름/제목이 있어야 통과
        passed = (p.experiences?.length > 0) && !!(p.name || p.headline || p.title);
      } else if (/링크|url|notion/i.test(lower)) {
        passed = !!(p.contact?.website || p.contact?.github);
      } else if (/경력|career/i.test(lower)) {
        passed = (p.experiences?.length > 0);
      } else {
        // 성적증명서, 추천서, 기타 외부서류 등 앱에서 확인 불가 → 미통과
        passed = false;
      }
      checks.push({ label: req, passed, category: 'required' });
    });

    // 포맷/형식
    (pr.format || []).forEach(fmt => {
      const lower = fmt.toLowerCase();
      let passed = false;
      if (/페이지|장|page/i.test(lower)) {
        const numMatch = lower.match(/(\d+)/);
        const maxPages = numMatch ? parseInt(numMatch[1]) : 10;
        passed = (p.experiences?.length || 0) <= maxPages;
      } else if (/pdf/i.test(lower)) {
        passed = true; // 앱에서 PDF 내보내기 지원
      } else if (/파일.{0,5}크기|mb|용량|size/i.test(lower)) {
        passed = true; // 앱에서 내보낼 때 처리됨
      } else if (/형식|format|확장자/i.test(lower)) {
        passed = true; // PDF/링크 형식은 앱에서 지원
      } else {
        // 기타 형식 요건: 앱에서 확인 불가
        passed = false;
      }
      checks.push({ label: fmt, passed, category: 'format' });
    });

    // 담아야 할 내용
    (pr.content || []).forEach(item => {
      let passed = false;
      const lower = item.toLowerCase();
      const expCount = p.experiences?.length || 0;
      if (/프로젝트|경험/i.test(lower)) {
        const numMatch = lower.match(/(\d+)/);
        const minCount = numMatch ? parseInt(numMatch[1]) : 1;
        passed = expCount >= minCount;
      } else if (/기여|역할/i.test(lower)) {
        passed = (p.experiences || []).some(e => e.role || e.description);
      } else if (/기술|스택|skill/i.test(lower)) {
        const sk = p.skills || {};
        const total = [...(sk.languages||[]), ...(sk.frameworks||[]), ...(sk.tools||[]), ...(sk.others||[])];
        passed = total.length > 0;
      } else if (/성과|결과|수치/i.test(lower)) {
        passed = (p.experiences || []).some(e => /\d/.test(e.description || ''));
      } else if (/교훈|배운|성장/i.test(lower)) {
        passed = (p.experiences || []).some(e => {
          const sections = e.sections || [];
          return sections.some(s => s.type === 'growth' && s.content?.trim());
        });
      } else if (/목표|계획|비전|포부/i.test(lower)) {
        passed = !!(p.goals?.trim?.() || p.valuesEssay?.trim?.());
      } else if (/학력|학교|전공/i.test(lower)) {
        passed = (p.education || []).length > 0;
      } else if (/수상|장학/i.test(lower)) {
        passed = (p.awards || []).length > 0;
      } else if (/자격증|인증/i.test(lower)) {
        const extraCerts = p.extracurricular?.certificates || [];
        passed = extraCerts.length > 0;
      } else {
        // 기타 항목: 내용 확인 불가 → 미통과로 표시
        passed = false;
      }
      checks.push({ label: item, passed, category: 'content' });
    });

    // 제출 방법 (항상 통과)
    if (pr.submission) {
      checks.push({ label: pr.submission, passed: true, category: 'submission' });
    }

    setReqChecklist(checks.length > 0 ? checks : null);
  };

  const handleReview = () => {
    checkPortfolioRequirements(portfolio);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { id: _id, ...data } = portfolio;
      await updatePortfolio(id, data);
      setCurrentPortfolio(portfolio);
      toast.success('저장되었습니다');
      navigate(`/app/portfolio/preview/${id}`);
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
    setSaving(false);
  };


  const importExperience = (exp) => {
    const aiResult = exp.structuredResult || {};
    const savedExportCfg = aiResult.exportConfig;

    let sections = [];
    let description = '';
    let contentSource = {};

    if (savedExportCfg?.sections?.length > 0) {
      // 사용자가 미리보기에서 저장한 섹션 구성 사용
      sections = savedExportCfg.sections
        .map(s => normalizePortfolioSection({ ...s, title: s.title || s.label }))
        .filter(s => s.content?.trim() || s.blocks?.some(block => block.type === 'image' || block.type === 'slide'))
        .map(s => ({ title: s.label || s.title, content: s.content, blocks: s.blocks || [], key: s.key, type: s.type || 'custom' }));
      description = aiResult.projectOverview?.summary || aiResult.intro || sections[0]?.content || '';
    } else {
      // 저장된 구성 없으면 프레임워크 기본값 사용
      const frameworkDef = exp.framework ? FRAMEWORKS[exp.framework] : FRAMEWORKS.STRUCTURED;
      const fields = frameworkDef?.fields || FRAMEWORKS.STRUCTURED.fields;
      contentSource = {};
      fields.forEach(field => {
        contentSource[field.key] = aiResult[field.key] || exp.content?.[field.key] || '';
      });
      sections = fields
        .filter(field => contentSource[field.key]?.trim?.())
        .map(field => normalizePortfolioSection({ key: field.key, title: field.label, content: contentSource[field.key] }));
      description =
        aiResult.projectOverview?.summary ||
        aiResult.intro ||
        exp.content?.intro ||
        exp.content?.overview ||
        (sections[0]?.content ?? '');
    }

    // 키워드에서 skills 추출
    const autoSkills = aiResult.keywords || exp.keywords || [];

    const newExp = {
      date: exp.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 7) || exp.updatedAt?.toDate?.()?.toISOString?.()?.slice(0, 7) || '',
      title: exp.title || '',
      description,
      // 원본 경험 ID 보존 (상세 모달에서 이미지 로딩용)
      experienceId: exp.id || null,
      notionDoc: exp.notionDoc || null,
      // 상세 데이터 보존 (AI 분석 결과 우선)
      framework: exp.framework || 'STRUCTURED',
      frameworkContent: contentSource,
      keywords: autoSkills,
      aiSummary: aiResult.projectOverview?.summary || aiResult.intro || '',
      // AI 분석 전체 데이터 보존 (keyExperiences, projectOverview 등)
      structuredResult: savedExportCfg?.sections?.length > 0 ? {
        ...aiResult,
        exportConfig: {
          ...(savedExportCfg || {}),
          sections: sections.map(s => ({ key: s.key, label: s.label || s.title, type: s.type || 'custom', content: s.content, blocks: s.blocks || [] })),
        },
      } : aiResult,
      // Notion 스타일 필드
      thumbnailUrl: exp.images?.[0] || '',
      status: 'finished',
      classify: [],
      skills: (aiResult.projectOverview?.techStack || []).length > 0
        ? aiResult.projectOverview.techStack
        : autoSkills.slice(0, 8).map(k => typeof k === 'string' ? k : k?.name ?? '').filter(Boolean),
      role: aiResult.projectOverview?.role || '',
      link: '',
      sections,
    };
    addToArray('experiences', newExp);
    setShowExpPicker(false);
    toast.success(`"${exp.title}" 경험이 추가되었습니다 (${sections.length}개 섹션)`);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-600" /></div>;
  }
  if (!portfolio) {
    return <p className="text-gray-500 text-center py-20">포트폴리오를 찾을 수 없습니다.</p>;
  }

  return (
    <div className="animate-fadeIn w-full max-w-[1280px] mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/app/portfolio" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-bluewood-400 hover:text-primary-600 transition-colors">
          <ArrowLeft size={14} /> 목록으로
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnalysisMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium transition-all border ${
              analysisMode
                ? 'bg-primary-50 text-primary-700 border-primary-200'
                : 'bg-white text-bluewood-500 border-surface-200 hover:border-bluewood-300 hover:text-bluewood-700'
            }`}
          >
            기업 분석
          </button>
          <button
            onClick={handleReview}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-surface-200 text-bluewood-600 rounded-xl text-[13px] font-medium hover:border-bluewood-300 hover:bg-surface-50 transition-all"
          >
            검토하기
          </button>
          <div className="w-px h-5 bg-surface-200 mx-0.5" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-primary-600 text-white rounded-xl text-[13px] font-semibold hover:bg-primary-700 disabled:opacity-50 transition-all shadow-sm shadow-primary-100"
          >
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>

      {/* 포트폴리오 요건 체크리스트 — floating toast */}
      {reqChecklist && (
        <div className="fixed bottom-6 right-6 z-[9999] w-80 bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-gray-200 overflow-hidden">
          {/* 상단 컬러 헤더 */}
          <div className="bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Target size={15} className="text-white/90" />
              기업 포트폴리오 요건 체크
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">
                <span className="font-bold text-white">{reqChecklist.filter(c => c.passed).length}</span> / {reqChecklist.length} 충족
              </span>
              <button onClick={() => setReqChecklist(null)} className="text-white/70 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
          {/* 프로그레스 바 */}
          <div className="w-full bg-gray-100 h-1.5">
            <div className="bg-green-500 h-1.5 transition-all" style={{ width: `${(reqChecklist.filter(c => c.passed).length / reqChecklist.length) * 100}%` }} />
          </div>
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            {['required', 'format', 'content', 'submission'].map(cat => {
              const items = reqChecklist.filter(c => c.category === cat);
              if (items.length === 0) return null;
              const catLabel = { required: '필수 서류', format: '포맷/형식', content: '담아야 할 내용', submission: '제출 방법' }[cat];
              return (
                <div key={cat}>
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{catLabel}</p>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
                        item.passed ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
                      }`}>
                        {item.passed && <Check size={10} className="text-white" />}
                      </div>
                      <span className={`text-xs leading-relaxed ${item.passed ? 'text-gray-700' : 'text-red-500 font-medium'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {reqChecklist.some(c => !c.passed) && (
            <div className="px-4 pb-3">
              <p className="text-[13px] text-orange-600 bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                미충족 항목을 보완하면 지원 경쟁력이 높아집니다
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Visual Mode: 대시보드 편집 (자세히보기와 동일 레이아웃) ── */}
      <SectionWorkspacePanel
        templateId={portfolio?.templateId}
        sections={visibleSections}
        hiddenSections={removableHiddenSections}
        hiddenSectionKeys={portfolio?.hiddenSections || []}
        sectionOrder={portfolio?.sectionOrder || []}
        labels={portfolio?.customSectionLabels || {}}
        update={update}
      />

      <VisualEditor
        portfolio={portfolio}
        update={update}
        updateMany={updateMany}
        updateNested={updateNested}
        addToArray={addToArray}
        removeFromArray={removeFromArray}
        updateArrayItem={updateArrayItem}
        userId={user.uid}
        portfolioId={id}
        templateId={portfolio?.templateId}
        userExperiences={userExperiences}
        importExperience={importExperience}
        analysisMode={analysisMode}
        onCloseAnalysis={() => setAnalysisMode(prev => !prev)}
      />
    </div>
  );
}

/* ── Inline Editable helpers ── */
function InlineText({ value, onChange, placeholder, className = '', tag: Tag = 'span' }) {
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
        const text = e.currentTarget.textContent;
        if (text !== value) onChange(text);
      }}
      className={`outline-none focus:bg-primary-50/40 focus:ring-1 focus:ring-primary-200 rounded px-0.5 transition-colors ${className}`}
      dangerouslySetInnerHTML={{ __html: value || '' }}
      data-placeholder={placeholder}
      style={!value ? { color: '#c0c0c0' } : undefined}
      onFocus={e => { if (!value) e.currentTarget.textContent = ''; }}
    />
  );
}

function InlineTextarea({ value, onChange, placeholder, className = '' }) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
        const text = e.currentTarget.innerText;
        if (text !== value) onChange(text);
      }}
      className={`outline-none focus:bg-primary-50/40 focus:ring-1 focus:ring-primary-200 rounded px-1 py-0.5 transition-colors whitespace-pre-wrap ${className}`}
      dangerouslySetInnerHTML={{ __html: value || placeholder || '' }}
      style={!value ? { color: '#c0c0c0' } : undefined}
      onFocus={e => { if (!value) e.currentTarget.textContent = ''; }}
    />
  );
}

/* ── 스킬 추가 인풋 (모듈 레벨, 재사용) ── */
function SectionWorkspacePanel({ templateId, sections, hiddenSections, hiddenSectionKeys, sectionOrder, labels, update }) {
  const [draggingKey, setDraggingKey] = useState(null);
  const [dropKey, setDropKey] = useState(null);
  const draggingKeyRef = useRef(null);
  const hoverTargetRef = useRef(null);
  const allowed = TEMPLATE_SECTION_MAP[templateId] || TEMPLATE_SECTION_MAP.notion;
  const hiddenKeys = Array.isArray(hiddenSectionKeys) ? hiddenSectionKeys : [];
  const saved = Array.isArray(sectionOrder) ? sectionOrder.filter(key => allowed.includes(key)) : [];
  const fullOrder = saved.length > 0
    ? [...saved, ...allowed.filter(key => !saved.includes(key))]
    : allowed;
  const orderedSections = [...(sections || [])].sort((a, b) => fullOrder.indexOf(a.id) - fullOrder.indexOf(b.id));

  const moveSection = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const next = [...fullOrder];
    const fromIndex = next.indexOf(fromKey);
    const toIndex = next.indexOf(toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    update('sectionOrder', next);
  };

  return (
    <div className="mb-4 rounded-2xl border border-surface-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {orderedSections.map(section => {
          const Icon = section.icon || Type;
          const labelValue = (labels || {})[section.id] || section.label || section.id;
          return (
            <div
              key={section.id}
              draggable
              onDragStart={e => {
                draggingKeyRef.current = section.id;
                setDraggingKey(section.id);
                e.dataTransfer.setData('application/x-fitpoly-section-outline', section.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setDragImage(createDragPreview(labelValue), 16, 16);
              }}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropKey(section.id);
                const fromKey = draggingKeyRef.current || draggingKey || e.dataTransfer.getData('application/x-fitpoly-section-outline');
                if (fromKey && fromKey !== section.id && hoverTargetRef.current !== section.id) {
                  hoverTargetRef.current = section.id;
                  moveSection(fromKey, section.id);
                }
              }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDropKey(null);
              }}
              onDrop={e => {
                e.preventDefault();
                setDraggingKey(null);
                setDropKey(null);
                draggingKeyRef.current = null;
                hoverTargetRef.current = null;
              }}
              onDragEnd={() => {
                setDraggingKey(null);
                setDropKey(null);
                draggingKeyRef.current = null;
                hoverTargetRef.current = null;
              }}
              className={`group flex min-w-[190px] max-w-full items-center gap-2 rounded-xl border px-2 py-1.5 shadow-sm transition-[transform,opacity,box-shadow,background-color,border-color] duration-200 ease-out ${
                draggingKey === section.id
                  ? 'scale-[0.97] border-primary-300 bg-primary-50/80 opacity-55 shadow-none'
                  : dropKey === section.id
                    ? 'translate-y-0 border-primary-300 bg-primary-50 shadow-md'
                    : 'border-surface-200 bg-surface-50 hover:border-primary-200 hover:bg-white'
              }`}
            >
              <GripVertical size={14} className="flex-shrink-0 cursor-grab text-gray-300 group-hover:text-primary-500" />
              <Icon size={14} className="flex-shrink-0 text-gray-400" />
              <input
                value={labelValue}
                onChange={e => update('customSectionLabels', { ...(labels || {}), [section.id]: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-gray-700 outline-none"
              />
              <button
                type="button"
                onClick={() => update('hiddenSections', [...new Set([...hiddenKeys, section.id])])}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-red-50 hover:text-red-500"
                title="Hide section"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      {hiddenSections?.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-surface-100 pt-3">
          {hiddenSections.map(section => (
            <button
              key={section.id}
              type="button"
              onClick={() => update('hiddenSections', hiddenKeys.filter(key => key !== section.id))}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-surface-200 bg-white px-2.5 py-1 text-[12px] font-medium text-gray-500 hover:border-primary-200 hover:text-primary-600"
            >
              <Plus size={11} /> {(labels || {})[section.id] || section.label || section.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillAddInput({ category, onAdd }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-1.5">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && val.trim()) {
            onAdd(val.trim());
            setVal('');
          }
        }}
        placeholder="스킬 추가 후 Enter"
        className="flex-1 px-2 py-1 text-xs bg-surface-50 border border-surface-200 rounded-md outline-none focus:border-primary-300 placeholder:text-gray-300"
      />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } }}
        className="px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs hover:bg-green-100 transition-colors border border-green-200">
        <Plus size={11} />
      </button>
    </div>
  );
}

/* ── 공용: 우측 기업분석 인라인 사이드패널 (Visual / Ashley / Academic 공유) ── */
function JobAnalysisSidebar({ portfolio, update, updateArrayItem, analysisMode, onClose }) {
  const [jobUrl, setJobUrl] = useState('');
  const [jobText, setJobText] = useState('');
  const [jobInputMode, setJobInputMode] = useState('url');
  const [analyzingJob, setAnalyzingJob] = useState(false);
  const [jobError, setJobError] = useState(null);
  const [showJobInput, setShowJobInput] = useState(false);

  const resetJobInput = () => {
    setShowJobInput(false);
    setJobUrl('');
    setJobText('');
    setJobError(null);
  };

  const handleJobAnalysisComplete = (analysis) => {
    update('jobAnalysis', analysis);
    if (analysis?.company) update('targetCompany', analysis.company);
    if (analysis?.position) update('targetPosition', analysis.position);
    resetJobInput();
    toast.success('기업 분석이 완료되었습니다');
  };

  const handleJobAnalyze = async () => {
    const trimmedUrl = jobUrl.trim();
    const trimmedText = jobText.trim();
    const payload = jobInputMode === 'text'
      ? { text: trimmedText }
      : { url: trimmedUrl };

    if (jobInputMode === 'text' ? trimmedText.length < 100 : !trimmedUrl) return;

    setAnalyzingJob(true);
    setJobError(null);
    try {
      const { data: respData } = await api.post('/job/analyze', payload);
      handleJobAnalysisComplete(respData.analysis);
    } catch (err) {
      setJobError(err.response?.data?.error || '분석에 실패했습니다');
    } finally {
      setAnalyzingJob(false);
    }
  };

  const p = portfolio;

  if (!analysisMode) return null;

  return (
    <div className="w-[300px] flex-shrink-0 sticky top-[76px] self-start max-h-[calc(100vh-96px)] overflow-y-auto pl-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-[11px] font-bold text-bluewood-400 uppercase tracking-[0.1em]">기업 분석 · 첨삭</span>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-100 text-bluewood-300 hover:text-bluewood-500 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* 본문 */}
      <div className="space-y-3">
        {p.jobAnalysis ? (
          <>
            <JobAnalysisBadge
              analysis={p.jobAnalysis}
              onRemove={() => update('jobAnalysis', null)}
              experiences={p.experiences || []}
              onTailorApply={(expIdx, sectionKey, content) => {
                const updated = { ...p.experiences[expIdx] };
                updated.structuredResult = { ...(updated.structuredResult || {}), [sectionKey]: content };
                updateArrayItem('experiences', expIdx, updated);
              }}
            />
            {!showJobInput ? (
              <button onClick={() => setShowJobInput(true)}
                className="w-full py-2 text-[11px] font-bold text-primary-600 border border-primary-200 rounded-lg bg-transparent hover:bg-primary-50 transition-colors tracking-wide uppercase">
                다른 공고로 변경
              </button>
            ) : (
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-3 space-y-2.5">
                <p className="text-[10px] font-bold text-primary-600 uppercase tracking-[0.08em]">새 채용공고로 변경</p>
                <JobPostingInput
                  mode={jobInputMode}
                  onModeChange={setJobInputMode}
                  jobUrl={jobUrl}
                  onJobUrlChange={setJobUrl}
                  jobText={jobText}
                  onJobTextChange={setJobText}
                  onSubmit={handleJobAnalyze}
                />
                {jobError && <p className="text-[11px] text-red-500">{jobError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleJobAnalyze} disabled={analyzingJob || (jobInputMode === 'text' ? jobText.trim().length < 100 : !jobUrl.trim())}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary-600 text-white text-[12px] font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm">
                    {analyzingJob ? <><Loader2 size={12} className="animate-spin" />분석 중...</> : <>분석하기</>}
                  </button>
                  <button onClick={resetJobInput}
                    className="px-3 py-2 text-[12px] text-bluewood-400 border border-surface-200 rounded-lg bg-white hover:bg-surface-50 transition-colors">취소</button>
                </div>
                <div className="border-t border-surface-200 pt-3">
                  <p className="mb-2 text-[10px] font-bold text-bluewood-400 uppercase tracking-[0.08em]">또는 기업 정보 직접 입력</p>
                  <JobLinkInput compact onAnalysisComplete={handleJobAnalysisComplete} />
                </div>
              </div>
            )}
          </>
        ) : !showJobInput ? (
          <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 space-y-2.5">
            <p className="text-[13px] font-bold text-primary-600 tracking-[-0.01em]">채용공고 분석</p>
            <p className="text-[12px] text-bluewood-400 leading-relaxed">
              채용공고 URL이나 본문을 붙여넣거나, 기업명과 모집분야를 직접 입력하면 기업 분석, 직무 분석, 지원 전략, 산업 트렌드를 자동 정리합니다.
            </p>
            <button onClick={() => setShowJobInput(true)}
              className="w-full py-2.5 bg-primary-600 text-white text-[12px] font-bold rounded-lg hover:bg-primary-700 transition-colors shadow-sm shadow-primary-100 tracking-wide">
              채용공고 분석하기
            </button>
          </div>
        ) : (
          <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 space-y-2.5">
            <p className="text-[11px] font-bold text-primary-600 uppercase tracking-[0.1em]">채용공고 입력</p>
            <JobPostingInput
              mode={jobInputMode}
              onModeChange={setJobInputMode}
              jobUrl={jobUrl}
              onJobUrlChange={setJobUrl}
              jobText={jobText}
              onJobTextChange={setJobText}
              onSubmit={handleJobAnalyze}
            />
            {jobError && <p className="text-[12px] text-red-500">{jobError}</p>}
            <div className="flex gap-2">
              <button onClick={handleJobAnalyze} disabled={analyzingJob || (jobInputMode === 'text' ? jobText.trim().length < 100 : !jobUrl.trim())}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-[12px] font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm">
                {analyzingJob ? <><Loader2 size={13} className="animate-spin" />분석 중...</> : <>분석하기</>}
              </button>
              <button onClick={resetJobInput}
                className="px-3 py-2.5 text-[12px] text-bluewood-400 border border-surface-200 rounded-lg bg-white hover:bg-surface-50 transition-colors">취소</button>
            </div>
            <div className="border-t border-surface-200 pt-3">
              <p className="mb-2 text-[10px] font-bold text-bluewood-400 uppercase tracking-[0.08em]">또는 기업 정보 직접 입력</p>
              <JobLinkInput compact onAnalysisComplete={handleJobAnalysisComplete} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JobPostingInput({ mode, onModeChange, jobUrl, onJobUrlChange, jobText, onJobTextChange, onSubmit }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white border border-surface-200 p-1">
        {[
          ['url', 'URL'],
          ['text', '텍스트'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={`py-1.5 rounded-md text-[11px] font-bold transition-colors ${
              mode === value
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-bluewood-400 hover:bg-surface-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'text' ? (
        <>
          <textarea
            value={jobText}
            onChange={e => onJobTextChange(e.target.value)}
            placeholder="채용공고 본문을 붙여넣으세요"
            rows={7}
            className="w-full px-3 py-2.5 text-[12px] border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 text-bluewood-800 placeholder:text-bluewood-300 bg-white resize-none leading-relaxed"
          />
          <p className="text-[10px] text-bluewood-300">{Math.min(jobText.trim().length, 100)}/100자</p>
        </>
      ) : (
        <input
          type="url"
          value={jobUrl}
          onChange={e => onJobUrlChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
          placeholder="https:// 채용공고 링크"
          className="w-full px-3 py-2.5 text-[13px] border border-surface-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 text-bluewood-800 placeholder:text-bluewood-300 bg-white"
        />
      )}
    </div>
  );
}

/* ── Visual Editor 섹션별 AI 내용 추천 버튼 ── */
function VisualSectionRecommend({ sectionType, jobAnalysis }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [show, setShow] = useState(false);
  const [appliedRecommendations, setAppliedRecommendations] = useState({});
  const buttonWrapRef = useRef(null);
  const [portalNode, setPortalNode] = useState(null);

  // show 가 켜지면 섹션 내부(헤더 바로 아래)에 패널을 인라인으로 끼워넣어
  // 기존 섹션 UI는 그대로 유지하면서 섹션이 자연스럽게 늘어나도록 처리
  useEffect(() => {
    if (!show || !buttonWrapRef.current) { setPortalNode(null); return; }
    // 헤더(가까운 justify-between 또는 flex 컨테이너) 찾기
    let header = buttonWrapRef.current.parentElement;
    while (header && header !== document.body) {
      const cls = header.className || '';
      if (typeof cls === 'string' && cls.includes('justify-between')) break;
      header = header.parentElement;
    }
    const sectionParent = header?.parentElement;
    if (!header || !sectionParent) return;
    const portal = document.createElement('div');
    portal.setAttribute('data-recommend-portal', sectionType);
    portal.style.marginBottom = '16px';
    sectionParent.insertBefore(portal, header.nextSibling);
    setPortalNode(portal);
    return () => { portal.remove(); setPortalNode(null); };
  }, [show, sectionType]);

  useEffect(() => {
    if (!show) return;
    const hasRecommendation = (e) => Array.from(e.dataTransfer?.types || []).includes('application/x-fitpoly-recommendation');
    const onDragOver = (e) => {
      if (!hasRecommendation(e)) return;
      if (!getEditableDropTarget(e.target)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = (e) => {
      if (!hasRecommendation(e)) return;
      const editable = getEditableDropTarget(e.target);
      if (!editable) return;
      const raw = e.dataTransfer.getData('application/x-fitpoly-recommendation');
      const fallback = e.dataTransfer.getData('text/plain');
      let text = fallback;
      try { text = JSON.parse(raw)?.text || fallback; } catch { /* use fallback */ }
      if (!text) return;
      e.preventDefault();
      if (insertTextIntoEditable(editable, text)) toast.success('추천 내용을 적용했습니다');
    };
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
    return () => {
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('drop', onDrop, true);
    };
  }, [show]);

  const SECTION_LABELS = {
    education: '교육', awards: '수상', skills: '기술',
    goals: '목표와 계획', values: '가치관',
    interviews: '인터뷰', experiences: '프로젝트/경험',
    profile: '프로필/소개', projects: '프로젝트',
    curricular: '교내 활동', extracurricular: '교외 활동',
    contact: '연락처', introduce: '자기소개', career: '경력', resume: '이력 요약',
  };

  if (!jobAnalysis || !sectionType) return null;

  const fetchRecommendations = async () => {
    setLoading(true);
    setShow(true);
    setAppliedRecommendations({});
    try {
      const { data: resp } = await api.post('/job/recommend-section', { jobAnalysis, sectionType });
      setData(resp);
    } catch { toast.error('내용 추천에 실패했습니다'); setShow(false); }
    setLoading(false);
  };

  const handleClick = () => {
    if (show && data) { setShow(false); return; }
    fetchRecommendations();
  };

  const applyRecommendation = (rec, idx) => {
    window.dispatchEvent(new CustomEvent(SECTION_RECOMMEND_APPLY_EVENT, { detail: { sectionType, recommendation: rec } }));
    setAppliedRecommendations(prev => ({ ...prev, [idx]: true }));
  };

  const startRecommendationDrag = (e, rec) => {
    const text = recommendationToText(rec);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.setData('application/x-fitpoly-recommendation', JSON.stringify({ sectionType, text, title: rec.title || '' }));
  };

  const copyRecommendation = async (rec) => {
    const text = recommendationToText(rec);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('추천 내용을 복사했습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  };

  return (
    <>
      <div ref={buttonWrapRef} className="inline-flex items-center">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            show ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          } disabled:opacity-50`}
        >
          {loading && <Loader2 size={12} className="animate-spin" />}
          내용 추천
        </button>
      </div>
      {show && portalNode && createPortal(
        <div className="w-full rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/40 to-white shadow-sm overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-indigo-800">AI 내용 추천</h4>
                <p className="text-[13px] text-gray-400 mt-0.5 truncate">{SECTION_LABELS[sectionType] || sectionType} 섹션에 바로 적용할 수 있습니다</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {data && !loading && (
                  <button type="button" onClick={fetchRecommendations} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                    다시 추천
                  </button>
                )}
                <button type="button" onClick={() => setShow(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-white"><X size={14} /></button>
              </div>
            </div>

            {jobAnalysis?.company && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-xs font-medium text-blue-800 truncate">{jobAnalysis.company}</span>
                {jobAnalysis.position && <span className="text-xs text-blue-500 flex-shrink-0">· {jobAnalysis.position}</span>}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center py-10">
                <Loader2 size={24} className="animate-spin text-indigo-400 mb-3" />
                <p className="text-sm text-gray-500">추천 내용을 구성 중입니다...</p>
                <p className="text-xs text-gray-400 mt-1">기업 분석과 현재 섹션 목적을 기준으로 정리합니다</p>
              </div>
            ) : data?.recommendations ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-indigo-700">기업 맞춤 추천안</span>
                  <span className="text-[12px] text-indigo-400">{data.recommendations.length}개 생성됨</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.recommendations.map((rec, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                      <div className="flex items-center gap-2 px-3 py-2 bg-surface-50 border-b border-gray-100">
                        <span className="flex-shrink-0 w-5 h-5 rounded-md bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="text-xs font-bold text-gray-700 flex-1 leading-tight truncate select-text">{rec.title}</span>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => startRecommendationDrag(e, rec)}
                          className="mt-0.5 p-1 rounded-md text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 cursor-grab active:cursor-grabbing transition-colors"
                          title="입력칸으로 드래그해 적용"
                        >
                          <GripVertical size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => copyRecommendation(rec)}
                          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                          title="추천 내용 복사"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap select-text cursor-text mb-3">{rec.content}</p>
                        <button
                          type="button"
                          onClick={() => applyRecommendation(rec, i)}
                          disabled={appliedRecommendations[i]}
                          className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                            appliedRecommendations[i]
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {appliedRecommendations[i] ? <><Check size={12} />적용됨</> : <><Check size={12} />섹션에 적용</>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">추천을 불러올 수 없습니다</p>
            )}
          </div>
        </div>,
        portalNode
      )}
    </>
  );
}

/* ── 경험/프로젝트 카드 상세 모달 (모듈 레벨) ── */
function ExpDetailModal({ exp, onUpdate, onClose, resizeToBase64, jobAnalysis, genericMode = false }) {
  return (
    <ProjectDetailModal
      exp={exp}
      onUpdate={onUpdate}
      onClose={onClose}
      resizeToBase64={resizeToBase64}
      jobAnalysis={jobAnalysis}
      genericMode={genericMode}
    />
  );
}

/* ── Visual Inline Editor — 템플릿 자체에서 인라인 편집 ── */
function VisualInlineEditor({ portfolio, update, updateMany, updateNested, addToArray, removeFromArray, updateArrayItem, userId, portfolioId, templateId, userExperiences, importExperience, analysisMode, onCloseAnalysis }) {
  const p = portfolio;
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [selectedExpDetail, setSelectedExpDetail] = useState(null); // { exp, idx }
  const safeUpdateMany = updateMany || ((fields = {}) => {
    Object.entries(fields).forEach(([field, value]) => update(field, value));
  });

  const updateSelectedExpDetail = (changes = {}) => {
    const idx = selectedExpDetail?.idx;
    if (!Number.isInteger(idx) || idx < 0) return;
    setSelectedExpDetail(prev => {
      if (!prev) return prev;
      return { ...prev, exp: { ...(prev.exp || {}), ...changes } };
    });
    updateArrayItem('experiences', idx, changes);
  };

  // 기업 맞춤 경험 추천
  const [recLoading, setRecLoading] = useState(false);
  const [recResults, setRecResults] = useState(null);

  const fetchVisualRecommendations = async () => {
    if (!p.jobAnalysis) { toast.error('연결된 기업 공고가 없습니다'); return; }
    setRecLoading(true);
    try {
      const { data } = await api.post('/job/recommend-experiences', { jobAnalysis: p.jobAnalysis });
      setRecResults(data);
    } catch { toast.error('경험 추천 분석에 실패했습니다'); }
    setRecLoading(false);
  };

  // ec = edit callbacks object passed to visual templates
  const ec = {
    update,
    updateMany: safeUpdateMany,
    updateNested,
    addToArray,
    removeFromArray,
    updateArrayItem,
    portfolio: p,
    jobAnalysis: p?.jobAnalysis,
    onImportExperience: () => setShowExpPicker(true),
    onUploadProfileImage: async (file) => {
      try {
        const b = await resizeToBase64Global(file, 400, 0.7);
        update('profileImageUrl', b);
      } catch { toast.error('이미지 처리 실패'); }
    },
    onUploadCoverImage: async (file) => {
      try {
        const b = await resizeToBase64Global(file, 1200, 0.85);
        update('coverImageUrl', b);
      } catch { toast.error('이미지 처리 실패'); }
    },
    onUploadExpImage: async (file, expIdx) => {
      try {
        const b = await resizeToBase64Global(file, 800, 0.8);
        updateArrayItem('experiences', expIdx, { thumbnailUrl: b });
      } catch { toast.error('이미지 처리 실패'); }
    },
    onOpenExpDetail: (exp, idx) => setSelectedExpDetail({ exp, idx }),
    updateSkillLevel: (name, level) => update('skillLevels', { ...(p.skillLevels || {}), [name]: level }),
    onFetchRecommendations: fetchVisualRecommendations,
    recLoading,
    recResults,
    onCloseRec: () => setRecResults(null),
    onImportRecommendedExp: (rec) => {
      const exp = userExperiences.find(e => e.id === rec.experience?.id);
      if (exp) importExperience(exp);
    },
    hideSection: (sectionKey) => {
      const hidden = [...(p.hiddenSections || [])];
      if (!hidden.includes(sectionKey)) hidden.push(sectionKey);
      update('hiddenSections', hidden);
    },
    showSection: (sectionKey) => {
      update('hiddenSections', (p.hiddenSections || []).filter(s => s !== sectionKey));
    },
    hiddenSections: p.hiddenSections || [],
  };

  return (
    <div className="flex gap-4 items-start">
      {/* ── 메인 영역 ── */}
      <div className="flex-1 min-w-0 max-w-[1100px]">
        {/* 실제 템플릿 (edit mode) */}
        <div className="border border-surface-200 rounded-2xl overflow-hidden">
          <VisualPortfolioRenderer portfolio={p} ec={ec} />
        </div>
      </div>

      {/* ── 우측 기업 분석 Drawer (portal 렌더링) ── */}
      <JobAnalysisSidebar portfolio={p} update={update} updateArrayItem={updateArrayItem} analysisMode={analysisMode} onClose={() => onCloseAnalysis?.()} />
      {showExpPicker && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-sm" onClick={() => setShowExpPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <Database size={16} className="text-primary-500" /> 경험 DB에서 선택
              </h3>
              <button onClick={() => setShowExpPicker(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto space-y-2">
              {userExperiences.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">등록된 경험이 없습니다</p>
              ) : userExperiences.map(exp => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => { importExperience(exp); setShowExpPicker(false); }}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-primary-50 transition-colors border border-transparent hover:border-primary-100"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Briefcase size={14} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{exp.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{exp.framework || 'STRUCTURED'} · {exp.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || ''}</p>
                    {exp.content?.intro && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{exp.content.intro}</p>}
                  </div>
                  <Plus size={14} className="text-primary-400 flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 경험 상세편집 모달 (첨삭 포함) */}
      {selectedExpDetail && (
        <ExpDetailModal
          exp={selectedExpDetail.exp}
          onUpdate={updateSelectedExpDetail}
          onClose={() => setSelectedExpDetail(null)}
          resizeToBase64={resizeToBase64Global}
          jobAnalysis={p?.jobAnalysis}
          analysisMode={analysisMode}
          onTailorApply={(sectionKey, content) => {
            const updated = { ...selectedExpDetail.exp };
            updated.structuredResult = { ...(updated.structuredResult || {}), [sectionKey]: content };
            updateArrayItem('experiences', selectedExpDetail.idx, updated);
          }}
        />
      )}
    </div>
  );
}

/* ── Visual Template Editor Wrapper ── */
function VisualTemplateEditor({ portfolio, update, updateMany, updateNested, addToArray, removeFromArray, updateArrayItem, userId, portfolioId, templateId, userExperiences, importExperience, analysisMode, onCloseAnalysis }) {
  return (
    <VisualInlineEditor
      portfolio={portfolio}
      update={update}
      updateMany={updateMany}
      updateNested={updateNested}
      addToArray={addToArray}
      removeFromArray={removeFromArray}
      updateArrayItem={updateArrayItem}
      userId={userId}
      portfolioId={portfolioId}
      templateId={templateId}
      userExperiences={userExperiences}
      importExperience={importExperience}
      analysisMode={analysisMode}
      onCloseAnalysis={onCloseAnalysis}
    />
  );
}

/* ── Visual Editor (Notion-like inline editing) ── */
function VisualEditor(props) {
  const { templateId } = props;
  if (VISUAL_TEMPLATE_IDS.includes(templateId)) return <VisualTemplateEditor {...props} />;
  if (templateId === 'ashley') return <AshleyVisualEditor {...props} />;
  if (templateId === 'academic') return <AcademicVisualEditor {...props} />;
  if (templateId === 'timeline') return <TimelineVisualEditor {...props} />;
  return <NotionVisualEditor {...props} />;
}

/* ── 공통 유틸: 이미지 base64 변환 ── */
function resizeToBase64Global(file, maxPx = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject; img.src = ev.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

/* ── RichContentEditor: 텍스트와 이미지를 자유롭게 섞는 편집기 ── */
// segments 형식: [{type:'text'|'image', content:string, width?:string}]
const RICH_TEXT_SEGMENT_TYPES = [
  { value: 'paragraph', label: 'Text', rows: 4, className: '' },
  { value: 'heading1', label: 'Heading 1', rows: 1, className: 'text-2xl font-extrabold text-gray-900' },
  { value: 'heading2', label: 'Heading 2', rows: 1, className: 'text-xl font-bold text-gray-900' },
  { value: 'heading3', label: 'Heading 3', rows: 1, className: 'text-base font-bold text-gray-800' },
  { value: 'bullet', label: 'Bullet', rows: 3, className: '' },
  { value: 'numbered', label: 'Numbered', rows: 3, className: '' },
  { value: 'todo', label: 'To-do', rows: 2, className: '' },
  { value: 'quote', label: 'Quote', rows: 3, className: 'border-l-4 border-gray-300 pl-3 italic text-gray-600' },
  { value: 'callout', label: 'Callout', rows: 3, className: 'bg-amber-50 border border-amber-100 text-amber-900' },
  { value: 'code', label: 'Code', rows: 5, className: 'font-mono bg-gray-950 text-gray-100' },
];

function normalizeRichTextSegment(segment) {
  if (!segment) return { type: 'text', variant: 'paragraph', content: '' };
  if (segment.type === 'image') return segment;
  const knownVariant = RICH_TEXT_SEGMENT_TYPES.some(item => item.value === segment.variant);
  return {
    ...segment,
    type: 'text',
    variant: knownVariant ? segment.variant : 'paragraph',
    content: segment.content || '',
    checked: !!segment.checked,
  };
}

function RichContentEditor({ value, onChange, placeholder, textRows = 4, textClassName }) {
  const fileInputRef = useRef(null);
  const pendingInsertAfter = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  // base64가 텍스트 세그먼트에 잘못 들어간 경우 자동 수정
  const rawSegs = Array.isArray(value) && value.length > 0
    ? value
    : [{ type: 'text', variant: 'paragraph', content: typeof value === 'string' ? value : '' }];
  const segments = rawSegs.map(s =>
    s.type === 'text' && typeof s.content === 'string' && s.content.startsWith('data:image')
      ? { ...s, type: 'image' }
      : normalizeRichTextSegment(s)
  );

  const updateSeg = (i, changes) => onChange(segments.map((s, si) => si === i ? { ...s, ...changes } : s));
  const insertSegmentAfter = (afterIdx, segment) => {
    const next = [...segments];
    next.splice(afterIdx + 1, 0, normalizeRichTextSegment(segment));
    onChange(next);
  };

  const insertImageAfter = (afterIdx) => {
    pendingInsertAfter.current = afterIdx;
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const b = await resizeToBase64Global(file);
      const afterIdx = pendingInsertAfter.current ?? segments.length - 1;
      const next = [...segments];
      next.splice(afterIdx + 1, 0, { type: 'image', content: b });
      if (!next[afterIdx + 2] || next[afterIdx + 2].type === 'image') {
        next.splice(afterIdx + 2, 0, { type: 'text', variant: 'paragraph', content: '' });
      }
      onChange(next);
    } catch { toast.error('이미지 처리 실패'); }
    pendingInsertAfter.current = null;
  };

  const removeSeg = (i) => {
    const next = segments.filter((_, si) => si !== i);
    onChange(next.length > 0 ? next : [{ type: 'text', variant: 'paragraph', content: '' }]);
  };

  const moveSeg = (from, to) => {
    if (from === to) return;
    const next = [...segments];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const makeResizeHandler = (i, pos) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const imgDiv = e.currentTarget.closest('[data-rimg]');
    const container = imgDiv?.parentElement?.parentElement;
    if (!imgDiv || !container) return;
    const startX = e.clientX;
    const startW = imgDiv.offsetWidth;
    const maxW = container.offsetWidth;
    const dir = pos.includes('r') ? 1 : -1;
    const onMove = ev => {
      const newW = Math.max(60, Math.min(maxW, startW + dir * (ev.clientX - startX)));
      imgDiv.style.width = newW + 'px';
    };
    const onUp = () => {
      const pct = Math.round((imgDiv.offsetWidth / maxW) * 100);
      updateSeg(i, { width: pct + '%' });
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const defaultTextClass = textClassName || 'w-full text-sm text-gray-700 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-2 py-1 resize-y leading-relaxed';
  const addTextAfter = (i, variant = 'paragraph') => insertSegmentAfter(i, { type: 'text', variant, content: '', checked: false });

  return (
    <div className="space-y-0.5">
      {/* 공유 파일 인풋 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />

      {segments.map((seg, i) => (
        <div
          key={i}
          draggable="true"
          onDragStart={e => {
            e.stopPropagation();
            // 텍스트 선택 중이면 드래그 취소
            const sel = window.getSelection();
            if (sel && sel.toString().length > 0) { e.preventDefault(); return; }
            e.dataTransfer.setData('rce-idx', String(i));
            e.dataTransfer.effectAllowed = 'move';
            e.currentTarget.style.opacity = '0.4';
          }}
          onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(i); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
          onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            const from = parseInt(e.dataTransfer.getData('rce-idx'), 10);
            if (!isNaN(from) && from !== i) moveSeg(from, i);
            setDragOver(null);
          }}
          data-rce-row="1"
          data-no-block-drag="true"
          className={`relative group/rseg flex gap-1 items-start transition-all ${dragOver === i ? 'ring-2 ring-blue-300 rounded-lg bg-blue-50/50' : ''}`}
        >
          {/* 드래그 핸들 아이콘 */}
          <div
            className="flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing text-gray-200 hover:text-gray-400 transition-colors select-none"
            title="드래그하여 이동"
            onMouseDown={e => { /* 핸들 위에서만 드래그 시작 허용 */ }}
          >
            <GripVertical size={14} />
          </div>

          {/* 텍스트 세그먼트 */}
          {seg.type === 'text' && (
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1 opacity-0 transition-opacity group-hover/rseg:opacity-100 focus-within:opacity-100">
                <select
                  value={seg.variant || 'paragraph'}
                  onChange={e => updateSeg(i, { variant: e.target.value })}
                  className="h-7 rounded-md border border-surface-200 bg-white px-2 text-[12px] font-medium text-gray-500 outline-none hover:border-primary-200"
                >
                  {RICH_TEXT_SEGMENT_TYPES.map(item => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                {seg.variant === 'todo' && (
                  <button
                    type="button"
                    onClick={() => updateSeg(i, { checked: !seg.checked })}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${seg.checked ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-surface-200 text-gray-400 hover:text-emerald-600'}`}
                    title="Toggle to-do"
                  >
                    <Check size={13} />
                  </button>
                )}
                <button type="button" onClick={() => addTextAfter(i)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-gray-400 hover:border-primary-200 hover:text-primary-600" title="Add text">
                  <Plus size={13} />
                </button>
                <button type="button" onClick={() => addTextAfter(i, 'todo')} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-gray-400 hover:border-emerald-200 hover:text-emerald-600" title="Add to-do">
                  <Check size={13} />
                </button>
                <button type="button" onClick={() => insertImageAfter(i)} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-surface-200 text-gray-400 hover:border-blue-200 hover:text-blue-600" title="Insert image">
                  <ImageIcon size={13} />
                </button>
              </div>
              {seg.variant === 'todo' && (
                <input
                  type="checkbox"
                  checked={!!seg.checked}
                  onChange={e => updateSeg(i, { checked: e.target.checked })}
                  className="mr-2 inline-block h-4 w-4 rounded border-surface-300 align-middle text-primary-600 focus:ring-primary-200"
                />
              )}
              {seg.variant === 'bullet' && <span className="mr-2 text-gray-400">•</span>}
              {seg.variant === 'numbered' && <span className="mr-2 text-[13px] font-semibold text-gray-400">{i + 1}.</span>}
              <textarea
                value={seg.content || ''}
                onChange={e => updateSeg(i, { content: e.target.value })}
                placeholder={i === 0 ? placeholder : '텍스트 입력...'}
                rows={seg.variant === 'paragraph' ? textRows : (RICH_TEXT_SEGMENT_TYPES.find(item => item.value === seg.variant)?.rows || textRows)}
                className={`${defaultTextClass} ${RICH_TEXT_SEGMENT_TYPES.find(item => item.value === seg.variant)?.className || ''} ${seg.variant === 'todo' && seg.checked ? 'line-through text-gray-400' : ''}`}
              />
              {/* 이미지 삽입 버튼 — 항상 표시 */}
              <button
                type="button"
                onClick={() => insertImageAfter(i)}
                className="hidden"
                title="이미지 삽입"
              >
                <ImageIcon size={11} /> 이미지 삽입
              </button>
              {/* 텍스트 세그먼트 삭제 */}
              {segments.length > 1 && (
                <button type="button" onClick={() => removeSeg(i)}
                  className="absolute top-0 right-0 opacity-0 group-hover/rseg:opacity-100 p-0.5 text-gray-300 hover:text-red-400 bg-white rounded transition-all">
                  <X size={10} />
                </button>
              )}
            </div>
          )}

          {/* 이미지 세그먼트 */}
          {seg.type === 'image' && (
            <div className="flex-1 min-w-0 py-1">
              <div
                data-rimg="1"
                className="relative group/rimg inline-block"
                style={{ width: seg.width || '100%', maxWidth: '100%', verticalAlign: 'top' }}
              >
                <img src={seg.content} alt="" draggable="false" className="w-full rounded-xl block select-none" onDragStart={e => e.preventDefault()} />

                {/* 상단 툴바 */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover/rimg:opacity-100 transition-opacity">
                  <label className="bg-black/60 text-white text-[12px] px-2 py-0.5 rounded cursor-pointer hover:bg-black/80">
                    교체
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      try { const b = await resizeToBase64Global(file); updateSeg(i, { content: b }); } catch { toast.error('이미지 처리 실패'); }
                    }} />
                  </label>
                  <button type="button" onClick={() => removeSeg(i)}
                    className="bg-black/60 text-white p-1 rounded hover:bg-red-500/80 transition-colors">
                    <Trash2 size={10} />
                  </button>
                </div>

                {/* ── 4 코너 리사이즈 핸들 ── */}
                {/* 좌상 */}
                <div onMouseDown={makeResizeHandler(i, 'tl')}
                  className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover/rimg:opacity-100 transition-opacity z-10"
                  style={{ background: 'radial-gradient(circle at 0% 0%, rgba(99,102,241,0.8) 40%, transparent 70%)' }} />
                {/* 우상 */}
                <div onMouseDown={makeResizeHandler(i, 'tr')}
                  className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize opacity-0 group-hover/rimg:opacity-100 transition-opacity z-10"
                  style={{ background: 'radial-gradient(circle at 100% 0%, rgba(99,102,241,0.8) 40%, transparent 70%)' }} />
                {/* 좌하 */}
                <div onMouseDown={makeResizeHandler(i, 'bl')}
                  className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize opacity-0 group-hover/rimg:opacity-100 transition-opacity z-10"
                  style={{ background: 'radial-gradient(circle at 0% 100%, rgba(99,102,241,0.8) 40%, transparent 70%)' }} />
                {/* 우하 */}
                <div onMouseDown={makeResizeHandler(i, 'br')}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover/rimg:opacity-100 transition-opacity z-10"
                  style={{ background: 'radial-gradient(circle at 100% 100%, rgba(99,102,241,0.8) 40%, transparent 70%)' }} />
                {/* 좌 중앙 */}
                <div onMouseDown={makeResizeHandler(i, 'ml')}
                  className="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-8 cursor-ew-resize opacity-0 group-hover/rimg:opacity-100 transition-opacity z-10 rounded-l"
                  style={{ background: 'rgba(99,102,241,0.5)' }} />
                {/* 우 중앙 */}
                <div onMouseDown={makeResizeHandler(i, 'mr')}
                  className="absolute top-1/2 right-0 -translate-y-1/2 w-3 h-8 cursor-ew-resize opacity-0 group-hover/rimg:opacity-100 transition-opacity z-10 rounded-r"
                  style={{ background: 'rgba(99,102,241,0.5)' }} />

                {/* 크기 표시 배지 */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[11px] px-1.5 py-0.5 rounded opacity-0 group-hover/rimg:opacity-100 transition-opacity pointer-events-none">
                  {seg.width || '100%'}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Ashley Visual Editor ── */
function AshleyVisualEditor({ portfolio, update, updateNested, addToArray, removeFromArray, updateArrayItem, userExperiences, importExperience, analysisMode, onCloseAnalysis }) {
  const p = portfolio;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const hiddenSections = p.hiddenSections || [];
  const profileImageInputRef = useRef(null);
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showAddExpMenu, setShowAddExpMenu] = useState(false);
  const [expDetailIdx, setExpDetailIdx] = useState(null);

  // 섹션 이름 편집 헬퍼
  const EditableTitle = ({ sectionKey, defaultLabel, className = '' }) => (
    <EditableSectionTitle portfolio={p} update={update} sectionKey={sectionKey} defaultLabel={defaultLabel} className={className} hoverClassName="hover:bg-[#f7f5f0]" />
  );

  // 섹션 숨기기/보이기 헬퍼
  const hideSection = (key) => update('hiddenSections', [...hiddenSections, key]);
  const showSection = (key) => update('hiddenSections', hiddenSections.filter(s => s !== key));
  const addSectionPackage = (sectionKey) => {
    const startOrder = (p.customBlocks || []).length;
    update('customBlocks', [...(p.customBlocks || []), ...makeSectionPackageBlocks(sectionKey, startOrder)]);
    update('sections', [...new Set([...(p.sections || []), sectionKey])]);
    showSection(sectionKey);
    if (sectionKey === 'education' && !(p.education || []).length) update('education', [{ name: '', period: '', degree: '', detail: '' }]);
    if (sectionKey === 'awards' && !(p.awards || []).length) update('awards', [{ date: '', title: '', organization: '', description: '' }]);
    if (sectionKey === 'experiences' && !(p.experiences || []).length) update('experiences', [{ date: '', title: '', organization: '', description: '', content: '' }]);
    if (sectionKey === 'skills') update('skills', { ...skills, tools: skills.tools || [], languages: skills.languages || [], frameworks: skills.frameworks || [], others: (skills.others || []).length ? skills.others : [''] });
    if (sectionKey === 'goals' && !(p.goals || []).length) update('goals', [{ title: '', description: '', type: 'short', status: 'planned' }]);
    if (sectionKey === 'values' && !p.valuesEssay && !p.valuesEssayBlocks) update('valuesEssay', '');
    if (sectionKey === 'interests' && !(p.interests || []).length) update('interests', ['']);
    if (sectionKey === 'contact') update('contact', { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '', ...(p.contact || {}) });
    setShowCustomBlockMenu(false);
  };

  // 커스텀 블록 관련 state
  const [showCustomBlockMenu, setShowCustomBlockMenu] = useState(false);
  const [projectBlockPickerIdx, setProjectBlockPickerIdx] = useState(null);
  const [addCardMenuIdx, setAddCardMenuIdx] = useState(null);
  const [blockDragging, setBlockDragging] = useState(null);
  const [blockDropTarget, setBlockDropTarget] = useState(null);

  // 기업 맞춤 경험 추천
  const [recLoading, setRecLoading] = useState(false);
  const [recResults, setRecResults] = useState(null);

  const fetchVisualRecommendations = async () => {
    if (!portfolio.jobAnalysis) { toast.error('연결된 기업 공고가 없습니다'); return; }
    setRecLoading(true);
    try {
      const { data } = await api.post('/job/recommend-experiences', { jobAnalysis: portfolio.jobAnalysis });
      setRecResults(data);
    } catch { toast.error('경험 추천 분석에 실패했습니다'); }
    setRecLoading(false);
  };

  const updateSkillCategory = (category, value) => {
    update('skills', { ...skills, [category]: value });
  };

  const ashleySectionOrderManager = makeSectionOrderManager('ashley', p.sectionOrder, update);
  const getAshleySectionOrder = ashleySectionOrderManager.getOrder;
  const moveAshleySectionOrder = ashleySectionOrderManager.move;
  const ashleySectionHoverRef = useRef(null);
  const handleAshleySectionDragOver = (e, sectionKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const from = e.dataTransfer.getData('text/plain');
    if (from && from !== sectionKey && ashleySectionHoverRef.current !== sectionKey) {
      ashleySectionHoverRef.current = sectionKey;
      moveAshleySectionOrder(from, sectionKey);
    }
  };
  const finishAshleySectionDrag = () => {
    ashleySectionHoverRef.current = null;
  };
  const moveAshleyCustomBlock = (from, to) => {
    const blocks = p.customBlocks || [];
    const next = reorderItems(blocks, from, to);
    if (next !== blocks) update('customBlocks', next);
  };
  const getAshleyCustomBlockDndProps = (index, block) => ({
    draggable: true,
    className: `px-10 pb-8 transition-all duration-150 rounded-xl cursor-grab active:cursor-grabbing ${blockDragging === index ? 'opacity-45 scale-[0.99]' : ''} ${blockDropTarget === index && blockDragging !== index ? 'ring-2 ring-[#e8e4dc] bg-[#fffaf0]' : ''}`,
    onDragStart: (event) => {
      if (shouldIgnoreBlockDrag(event.target)) {
        event.preventDefault();
        return;
      }
      startCustomBlockDrag(event, index, getCustomBlockLabel(block, index), setBlockDragging, 'warm');
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setBlockDropTarget(index);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget) && blockDropTarget === index) setBlockDropTarget(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const from = parseInt(e.dataTransfer.getData('application/x-fitpoly-custom-block') || e.dataTransfer.getData('block-idx'), 10);
      if (!isNaN(from)) moveAshleyCustomBlock(from, index);
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
    onDragEnd: () => {
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
  });
  const getAshleyCustomBlockHandleProps = (index, block) => ({
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation();
      startCustomBlockDrag(e, index, getCustomBlockLabel(block, index), setBlockDragging, 'warm');
    },
    onDragEnd: () => {
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
  });

  const resizeToBase64 = (file, maxPx = 800, quality = 0.8) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new window.Image();
        img.onload = () => {
          const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale; canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject; img.src = ev.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });

  return (
    <div className="flex gap-4 items-start">
    <div className="flex-1 min-w-0 max-w-[1100px]">
      <div className="bg-[#f7f5f0] rounded-2xl border border-[#e8e4dc] shadow-sm overflow-hidden">
        {/* Hero */}
        <div className="px-10 pt-10 pb-8">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <input value={p.userName || ''} onChange={e => update('userName', e.target.value)}
                placeholder="이름" className="w-full text-4xl font-bold text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a] mb-2 tracking-tight" />
              <input value={p.nameEn || ''} onChange={e => update('nameEn', e.target.value)}
                placeholder="English Name" className="w-full text-[#8a8578] text-sm outline-none bg-transparent placeholder:text-[#c4b89a] mb-3" />
              <input value={p.headline || ''} onChange={e => update('headline', e.target.value)}
                placeholder="한 줄 소개" className="w-full text-[#5a564e] text-sm outline-none bg-transparent placeholder:text-[#c4b89a] leading-relaxed" />
              <div className="flex items-center gap-4 mt-4 text-xs text-[#8a8578]">
                <input value={contact.email || ''} onChange={e => updateNested('contact', 'email', e.target.value)}
                  placeholder="이메일" className="text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a] w-36" />
                <input value={contact.instagram || ''} onChange={e => updateNested('contact', 'instagram', e.target.value)}
                  placeholder="Instagram" className="text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a] w-28" />
                <input value={contact.linkedin || ''} onChange={e => updateNested('contact', 'linkedin', e.target.value)}
                  placeholder="LinkedIn" className="text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a] w-28" />
                <input value={contact.github || ''} onChange={e => updateNested('contact', 'github', e.target.value)}
                  placeholder="GitHub" className="text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a] w-28" />
                <input value={contact.website || ''} onChange={e => updateNested('contact', 'website', e.target.value)}
                  placeholder="웹사이트" className="text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a] w-28" />
              </div>
            </div>
            {/* Profile Image */}
            <input type="file" ref={profileImageInputRef} accept="image/*" className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try { const b = await resizeToBase64(file, 400, 0.7); update('profileImageUrl', b); } catch { toast.error('이미지 처리 실패'); }
              }} />
            <button onClick={() => profileImageInputRef.current?.click()}
              className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-[#c4b89a] hover:border-[#8a6c4a] transition-colors relative group flex-shrink-0">
              {p.profileImageUrl
                ? <img src={p.profileImageUrl} alt="profile" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-[#e8e4dc] flex items-center justify-center"><Upload size={28} className="text-[#c4b89a]" /></div>}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload size={16} className="text-white" />
              </div>
            </button>
          </div>
        </div>

        {/* 한눈에 보기 + 저는 이런 사람이에요 */}
        <div className="px-10 pb-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
              <h3 className="font-bold text-sm text-[#2d2a26] mb-4">한눈에 보기</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-[#8a8578] text-xs">위치</span>
                  <input value={p.location || ''} onChange={e => update('location', e.target.value)} placeholder="위치"
                    className="text-xs font-medium text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a] text-right w-36" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#8a8578] text-xs">생년월일</span>
                  <input value={p.birthDate || ''} onChange={e => update('birthDate', e.target.value)} placeholder="YYYY.MM.DD"
                    className="text-xs font-medium text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a] text-right w-36" />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#8a8578] text-xs">연락처</span>
                  <input value={contact.phone || ''} onChange={e => updateNested('contact', 'phone', e.target.value)} placeholder="전화번호"
                    className="text-xs font-medium text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a] text-right w-36" />
                </div>
                {(p.education || []).length > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#8a8578] text-xs">학교</span>
                    <span className="text-xs font-medium text-[#2d2a26] text-right">{p.education[0].name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-[#e8e4dc]">
              <h3 className="font-bold text-sm text-[#2d2a26] mb-4">저는 이런 사람이에요</h3>
              <div className="space-y-2">
                {(p.values || []).map((v, i) => (
                  <div key={i} className="flex items-start gap-2.5 group/v">
                    <span className="w-2 h-2 bg-[#c4a882] rounded-full mt-2 flex-shrink-0" />
                    <input value={v.keyword || ''} onChange={e => updateArrayItem('values', i, { keyword: e.target.value })}
                      placeholder="가치 키워드" className="flex-1 text-sm font-medium text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                    <button onClick={() => removeFromArray('values', i)} className="text-[#c4b89a] hover:text-red-400 mt-1"><X size={11} /></button>
                  </div>
                ))}
                <button onClick={() => addToArray('values', { keyword: '' })}
                  className="flex items-center gap-1 text-xs text-[#8a8578] hover:text-[#5a564e] transition-colors mt-1">
                  <Plus size={11} /> 가치 추가
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 인터뷰 (경험 기반) */}
        {!hiddenSections.includes('interviews') && (
        <div className="px-10 pb-8">
          <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
            <div className="flex items-center justify-between mb-5">
              <EditableTitle sectionKey="interviews" defaultLabel="인터뷰" className="font-bold text-lg text-[#2d2a26]" />
              <div className="flex gap-2">
                <VisualSectionRecommend sectionType="interviews" jobAnalysis={portfolio.jobAnalysis} />
                <button onClick={() => hideSection('interviews')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
                {userExperiences.length > 0 && (
                  <div className="relative">
                    <button onClick={() => setShowExpPicker(p => !p)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#f7f5f0] text-[#5a564e] rounded-lg hover:bg-[#e8e4dc] border border-[#e8e4dc]">
                      경험 DB에서 불러오기
                    </button>
                    {showExpPicker && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-[#e8e4dc] rounded-xl shadow-lg z-10 py-1 w-60 max-h-48 overflow-y-auto">
                        {userExperiences.map(exp => (
                          <button key={exp.id} onClick={() => { importExperience(exp); setShowExpPicker(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-[#f7f5f0] text-sm text-[#5a564e] truncate">{exp.title}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-5">
              {(p.experiences || []).slice(0, 3).map((e, i) => (
                <div key={i} className="flex gap-5 group/e relative">
                  <div className="flex-1">
                    <p className="font-medium text-[#2d2a26] text-sm mb-1">Q. {e.title || '(제목 없음)'}에 대해 이야기해주세요.</p>
                    <p className="text-sm text-[#8a8578] leading-relaxed line-clamp-2">{e.description || '설명을 입력하세요.'}</p>
                  </div>
                  {e.thumbnailUrl && <img src={e.thumbnailUrl} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />}
                  <button onClick={() => removeFromArray('experiences', i)}
                    className="absolute -top-1 -right-1 text-[#c4b89a] hover:text-red-400"><X size={13} /></button>
                </div>
              ))}
              {(p.experiences || []).length === 0 && (
                <p className="text-sm text-[#8a8578]">아래 갤러리에서 경험을 추가하면 인터뷰 항목이 표시됩니다.</p>
              )}
            </div>
          </div>
        </div>
        )}

        {/* 학력 */}
        {!hiddenSections.includes('education') && (
        <div className="px-10 pb-8">
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="education" defaultLabel="학력" className="font-bold text-lg text-[#2d2a26]" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="education" jobAnalysis={portfolio.jobAnalysis} />
              <button onClick={() => hideSection('education')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="space-y-2">
            {(p.education || []).map((edu, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-[#e8e4dc] group/edu">
                <GraduationCap size={16} className="text-[#c4a882] flex-shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2">
                    <input value={edu.name || ''} onChange={e => updateArrayItem('education', i, { name: e.target.value })}
                      placeholder="학교명" className="flex-1 text-sm font-medium text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                    <input value={edu.major || ''} onChange={e => updateArrayItem('education', i, { major: e.target.value })}
                      placeholder="전공" className="flex-1 text-sm text-[#5a564e] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <input value={edu.degree || ''} onChange={e => updateArrayItem('education', i, { degree: e.target.value })}
                      placeholder="학위" className="w-20 text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                    <input value={edu.period || ''} onChange={e => updateArrayItem('education', i, { period: e.target.value })}
                      placeholder="기간" className="w-40 text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                  </div>
                  <input value={edu.detail || ''} onChange={e => updateArrayItem('education', i, { detail: e.target.value })}
                    placeholder="상세 내용 (GPA, 관련 과목 등)" className="w-full text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a] mt-1" />
                </div>
                <button onClick={() => removeFromArray('education', i)} className="text-[#c4b89a] hover:text-red-400"><X size={12} /></button>
              </div>
            ))}
            <button onClick={() => addToArray('education', { name: '', major: '', degree: '', period: '', status: '' })}
              className="flex items-center gap-1 text-xs text-[#8a8578] hover:text-[#5a564e]"><Plus size={12} /> 학력 추가</button>
          </div>
        </div>
        )}

        {/* 수상 */}
        {!hiddenSections.includes('awards') && (
        <div className="px-10 pb-8">
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="awards" defaultLabel="수상" className="font-bold text-lg text-[#2d2a26]" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="awards" jobAnalysis={portfolio.jobAnalysis} />
              <button onClick={() => hideSection('awards')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="space-y-2">
            {(p.awards || []).map((a, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-4 border border-[#e8e4dc] group/award">
                <Award size={16} className="text-[#c4a882] flex-shrink-0" />
                <input value={a.date || ''} onChange={e => updateArrayItem('awards', i, { date: e.target.value })}
                  placeholder="날짜" className="w-24 text-xs font-medium text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                <input value={a.title || ''} onChange={e => updateArrayItem('awards', i, { title: e.target.value })}
                  placeholder="수상명" className="flex-1 text-sm font-medium text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                <input value={a.detail || ''} onChange={e => updateArrayItem('awards', i, { detail: e.target.value })}
                  placeholder="상세" className="flex-1 text-sm text-[#5a564e] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                <button onClick={() => removeFromArray('awards', i)} className="text-[#c4b89a] hover:text-red-400"><X size={12} /></button>
              </div>
            ))}
            <button onClick={() => addToArray('awards', { date: '', title: '', detail: '' })}
              className="flex items-center gap-1 text-xs text-[#8a8578] hover:text-[#5a564e]"><Plus size={12} /> 수상 추가</button>
          </div>
        </div>
        )}

        {/* 프로젝트 갤러리 */}
        {!hiddenSections.includes('experiences') && (
        <div className="px-10 pb-8">
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="experiences" defaultLabel="프로젝트" className="font-bold text-lg text-[#2d2a26]" />
            <div className="flex items-center gap-2">
              <button onClick={() => hideSection('experiences')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
              {portfolio.jobAnalysis && (
                <button onClick={fetchVisualRecommendations} disabled={recLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 disabled:opacity-50">
                  {recLoading && <Loader2 size={12} className="animate-spin" />}
                  기업 맞춤 경험 추천
                </button>
              )}

            </div>
          </div>

          {/* 기업 맞춤 경험 추천 결과 */}
          {recResults && (
            <div className="mb-4 border border-indigo-100 rounded-xl bg-indigo-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-indigo-700">{portfolio.jobAnalysis?.company} 맞춤 추천 경험</span>
                <button onClick={() => setRecResults(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
              {(recResults.keywords || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {recResults.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-1 bg-white rounded-lg border border-indigo-200 text-xs">
                      <span className="font-bold text-indigo-700">{kw.keyword}</span>
                      <span className="text-gray-500 ml-1">{kw.description}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {(recResults.recommendations || []).map((rec, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-indigo-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{rec.experience?.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rec.reason}</p>
                      {(rec.matchedKeywords || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rec.matchedKeywords.map((mk, mi) => (
                            <span key={mi} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[12px] font-medium">{mk}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => {
                      const exp = userExperiences.find(e => e.id === rec.experience?.id);
                      if (exp) importExperience(exp);
                      else toast.error('경험 데이터를 찾을 수 없습니다');
                    }}
                      className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
                      추가
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(p.experiences || []).map((e, i) => (
              <div key={i} className="group/exp text-left bg-white rounded-xl border border-[#e8e4dc] overflow-hidden relative hover:shadow-lg transition-all cursor-pointer" onClick={() => setExpDetailIdx(i)}>
                <div className="aspect-[4/3] bg-[#f0ece4] overflow-hidden">
                  <img src={e.thumbnailUrl || DEFAULT_PROJECT_LOGO} alt={e.title || ''} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <input value={e.title || ''} onChange={ev => { ev.stopPropagation(); updateArrayItem('experiences', i, { title: ev.target.value }); }} onClick={ev => ev.stopPropagation()}
                    placeholder="제목" className="w-full text-sm font-bold text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                  <input value={e.date || ''} onChange={ev => { ev.stopPropagation(); updateArrayItem('experiences', i, { date: ev.target.value }); }} onClick={ev => ev.stopPropagation()}
                    placeholder="날짜" className="w-full text-xs text-[#8a8578] outline-none bg-transparent placeholder:text-[#c4b89a] mt-1" />
                  {e.description && <p className="text-[13px] text-[#8a8578] mt-1 line-clamp-2 leading-relaxed">{e.description}</p>}
                  {(e.skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(e.skills || []).slice(0, 3).map((sk, si) => (
                        <span key={si} className="px-1.5 py-0.5 bg-[#f0ece4] text-[#8a6c4a] rounded text-[12px]">{typeof sk === 'string' ? sk : sk?.name}</span>
                      ))}
                      {(e.skills || []).length > 3 && <span className="text-[12px] text-[#8a8578]">+{(e.skills || []).length - 3}</span>}
                    </div>
                  )}
                </div>
                <label onClick={ev => ev.stopPropagation()}
                  className="absolute top-1.5 right-8 bg-white/80 p-1 rounded-full text-[#c4b89a] hover:text-[#8a6c4a] shadow-sm cursor-pointer transition-opacity">
                  <Camera size={11} />
                  <input type="file" accept="image/*" className="hidden" onChange={async ev => {
                    const file = ev.target.files?.[0];
                    if (!file) return;
                    try {
                      const base64 = await resizeToBase64(file, 800, 0.8);
                      updateArrayItem('experiences', i, { thumbnailUrl: base64 });
                    } catch { toast.error('이미지 처리 실패'); }
                    ev.target.value = '';
                  }} />
                </label>
                <button onClick={ev => { ev.stopPropagation(); removeFromArray('experiences', i); }}
                  className="absolute top-1.5 right-1.5 bg-white/80 p-1 rounded-full text-[#c4b89a] hover:text-red-400 shadow-sm transition-opacity">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <div className="relative aspect-[4/3]">
              <button onClick={() => setShowAddExpMenu(prev => !prev)}
                className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#e8e4dc] text-[#c4b89a] hover:border-[#c4a882] hover:text-[#8a6c4a] transition-colors">
                <Plus size={22} /><span className="text-xs">경험 추가</span>
              </button>
              {showAddExpMenu && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-[#e8e4dc] rounded-xl shadow-lg z-20 py-1 w-52">
                  <button onClick={() => { setShowExpPicker(true); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#f7f5f0] text-sm text-[#5a564e] text-left">
                    <span className="w-5 h-5 bg-[#f0ece4] rounded flex items-center justify-center"><Database size={12} className="text-[#8a6c4a]" /></span>
                    경험 DB에서 불러오기
                  </button>
                  <button onClick={() => { addToArray('experiences', { date: '', title: '', description: '', status: 'finished', classify: [], skills: [], role: '', link: '', sections: [], thumbnailUrl: '' }); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#f7f5f0] text-sm text-[#5a564e] text-left">
                    <span className="w-5 h-5 bg-[#f0ece4] rounded flex items-center justify-center"><Plus size={12} className="text-[#8a6c4a]" /></span>
                    직접 작성하기
                  </button>
                </div>
              )}
              {showExpPicker && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-[#e8e4dc] rounded-xl shadow-lg z-30 py-1 w-60 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#e8e4dc]">
                    <span className="text-xs font-bold text-[#5a564e]">경험 DB에서 선택</span>
                    <button onClick={() => setShowExpPicker(false)} className="text-[#c4b89a] hover:text-[#5a564e]"><X size={14} /></button>
                  </div>
                  {userExperiences.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">등록된 경험이 없습니다</p>
                  ) : userExperiences.map(exp => (
                    <button key={exp.id} onClick={() => { importExperience(exp); setShowExpPicker(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-[#f7f5f0] text-sm text-[#5a564e] truncate">{exp.title}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* 재정렬 가능한 섹션들 (기술/목표/가치관) */}
        <div className="flex flex-col">

        {/* 기술 */}
        {!hiddenSections.includes('skills') && (
        <div className="px-10 pb-8" style={{ order: getAshleySectionOrder('skills') }}
          onDragOver={e => handleAshleySectionDragOver(e, 'skills')}
          onDrop={e => { e.preventDefault(); finishAshleySectionDrag(); }}>
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="skills" defaultLabel="이런 일을 할 수 있어요" className="font-bold text-lg text-[#2d2a26]" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="skills" jobAnalysis={portfolio.jobAnalysis} />
              <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'skills'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-[#e8e4dc] bg-white/80 text-[#8a6c4a] hover:bg-[#fffaf0] p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
              <button onClick={() => hideSection('skills')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { category: 'tools',      label: '도구 (Tools)',         placeholder: '기타 도구 입력...',         presets: ['Notion', 'Figma', 'Photoshop', 'Illustrator', 'Canva', 'Slack', 'Jira', 'Excel', 'VS Code', 'GitHub', 'Premiere Pro'] },
              { category: 'languages',  label: '언어',                  placeholder: '기타 언어 입력...',         presets: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'Go', 'Swift', 'Kotlin', 'SQL', 'R'] },
              { category: 'frameworks', label: '프레임워크/라이브러리', placeholder: '기타 프레임워크 입력...', presets: ['React', 'Vue.js', 'Next.js', 'Spring', 'Django', 'Node.js', 'Express.js', 'TensorFlow', 'Flutter', 'Tailwind CSS'] },
              { category: 'others',     label: '기타 역량',             placeholder: '기타 역량 입력...',        presets: ['데이터 분석', 'UI/UX 디자인', '프로젝트 관리', '기획', '마케팅', '글쓰기', '발표', '리더십'] },
            ].map(({ category, label, placeholder, presets }) => (
              <SkillCategoryInput
                key={category}
                category={category}
                label={label}
                placeholder={placeholder}
                items={skills[category] || []}
                presets={presets}
                onUpdate={(val) => updateSkillCategory(category, val)}
              />
            ))}
          </div>
        </div>
        )}

        {/* 목표와 계획 */}
        {!hiddenSections.includes('goals') && (
        <div className="px-10 pb-8" style={{ order: getAshleySectionOrder('goals') }}
          onDragOver={e => handleAshleySectionDragOver(e, 'goals')}
          onDrop={e => { e.preventDefault(); finishAshleySectionDrag(); }}>
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="goals" defaultLabel="목표와 계획" className="font-bold text-lg text-[#2d2a26]" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="goals" jobAnalysis={portfolio.jobAnalysis} />
              <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'goals'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-[#e8e4dc] bg-white/80 text-[#8a6c4a] hover:bg-[#fffaf0] p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
              <button onClick={() => hideSection('goals')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="space-y-3">
            {(p.goals || []).map((g, i) => (
              <div key={i} className="relative group/goal border-b border-[#e8e4dc]/60 py-3 last:border-b-0">
                <button onClick={() => removeFromArray('goals', i)}
                  className="absolute top-2 right-2 text-[#c4b89a] hover:text-red-400"><Trash2 size={12} /></button>
                <input value={g.title || ''} onChange={e => updateArrayItem('goals', i, { title: e.target.value })}
                  placeholder="목표명" className="w-full text-sm font-bold text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a]" />
                <div className="mt-1">
                  <RichContentEditor
                    value={g.blocks || g.description || ''}
                    onChange={v => updateArrayItem('goals', i, { blocks: v, description: Array.isArray(v) ? v.filter(s => s.type==='text').map(s=>s.content).join('\n') : v })}
                    placeholder="상세 계획..."
                    textRows={2}
                  />
                </div>
              </div>
            ))}
            <button onClick={() => addToArray('goals', { title: '', description: '', type: 'short', status: 'planned' })}
              className="flex items-center gap-1 text-xs text-[#8a8578] hover:text-[#5a564e]"><Plus size={12} /> 목표 추가</button>
          </div>
        </div>
        )}

        {/* 가치관 에세이 */}
        {!hiddenSections.includes('values') && (
        <div className="px-10 pb-8" style={{ order: getAshleySectionOrder('values') }}
          onDragOver={e => handleAshleySectionDragOver(e, 'values')}
          onDrop={e => { e.preventDefault(); finishAshleySectionDrag(); }}>
          <div className="bg-white rounded-xl p-6 border border-[#e8e4dc]">
            <div className="flex items-center justify-between mb-4">
              <EditableTitle sectionKey="values" defaultLabel="나를 들려주는 이야기" className="font-bold text-lg text-[#2d2a26]" />
              <div className="flex items-center gap-2">
                <VisualSectionRecommend sectionType="values" jobAnalysis={portfolio.jobAnalysis} />
                <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'values'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-[#e8e4dc] bg-white/80 text-[#8a6c4a] hover:bg-[#fffaf0] p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
                <button onClick={() => hideSection('values')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
              </div>
            </div>
            <RichContentEditor
              value={p.valuesEssayBlocks || p.valuesEssay || ''}
              onChange={v => { update('valuesEssayBlocks', v); update('valuesEssay', richValueToPlainText(v)); }}
              placeholder="가치관 에세이를 작성하세요..."
              textRows={6}
              textClassName="w-full text-sm text-[#5a564e] leading-[1.9] outline-none bg-transparent placeholder:text-[#c4b89a] resize-y"
            />
          </div>
        </div>
        )}

        </div>{/* end flex col wrapper for Ashley reorderable sections */}

        {/* 커스텀 블록 */}
        {(p.customBlocks || []).map((block, i) => (
          <section key={i} {...getAshleyCustomBlockDndProps(i, block)}>
            <div className="bg-white rounded-xl p-6 border border-[#e8e4dc] relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1 items-center">
                  <div {...getAshleyCustomBlockHandleProps(i, block)} className="cursor-grab active:cursor-grabbing text-[#c4b89a] hover:text-[#8a6c4a] transition-colors mr-1" title="드래그하여 이동">
                    <GripVertical size={14} />
                  </div>
                  <button onClick={() => { if (i === 0) return; const b = [...(p.customBlocks||[])]; [b[i-1],b[i]]=[b[i],b[i-1]]; update('customBlocks',b); }}
                    disabled={i===0} className="p-1 text-[#c4b89a] hover:text-[#8a6c4a] disabled:opacity-30 transition-colors"><ChevronUp size={14}/></button>
                  <button onClick={() => { if (i === (p.customBlocks||[]).length-1) return; const b=[...(p.customBlocks||[])]; [b[i+1],b[i]]=[b[i],b[i+1]]; update('customBlocks',b); }}
                    disabled={i===(p.customBlocks||[]).length-1} className="p-1 text-[#c4b89a] hover:text-[#8a6c4a] disabled:opacity-30 transition-colors"><ChevronDown size={14}/></button>
                </div>
                <button onClick={() => removeFromArray('customBlocks', i)} className="text-[#c4b89a] hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
              </div>
              {block.type === 'heading' && (
                <input value={block.content || ''} onChange={e => { const b=[...(p.customBlocks||[])]; b[i]={...b[i],content:e.target.value}; update('customBlocks',b); }}
                  placeholder="제목을 입력하세요"
                  className="w-full text-xl font-bold text-[#2d2a26] outline-none bg-transparent placeholder:text-[#c4b89a]" />
              )}
              {block.type === 'text' && (
                <RichContentEditor
                  value={block.segments || block.content || ''}
                  onChange={v => { const b=[...(p.customBlocks||[])]; b[i]={...b[i],segments:v,content:Array.isArray(v)?v.filter(s=>s.type==='text').map(s=>s.content).join('\n'):v}; update('customBlocks',b); }}
                  placeholder="텍스트를 입력하세요"
                  textRows={4}
                />
              )}
              {block.type === 'image' && (
                <div>
                  {block.content ? (
                    <RichContentEditor
                      value={block.segments || [{ type: 'image', content: block.content, width: block.width }]}
                      onChange={v => { const b=[...(p.customBlocks||[])]; const imgSeg=Array.isArray(v)?v.find(s=>s.type==='image'):null; b[i]={...b[i],segments:v,content:imgSeg?.content??block.content,width:imgSeg?.width}; update('customBlocks',b); }}
                      textRows={2}
                    />
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 w-full h-48 border-2 border-dashed border-[#e8e4dc] rounded-xl cursor-pointer hover:border-[#c4a882] transition-colors">
                      <ImageIcon size={24} className="text-[#c4b89a]" />
                      <span className="text-xs text-[#8a8578]">클릭하여 이미지 업로드</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        try { const base64 = await resizeToBase64Global(file, 1200, 0.8); const b=[...(p.customBlocks||[])]; b[i]={...b[i],content:base64}; update('customBlocks',b); }
                        catch { toast.error('이미지 처리 실패'); }
                      }} />
                    </label>
                  )}
                </div>
              )}
              {block.type === 'divider' && <hr className="border-[#e8e4dc] my-2" />}
              {block.type === 'project' && (() => {
                const cards = Array.isArray(block.content) ? block.content : (block.content && typeof block.content === 'object' && block.content.title !== undefined) ? [block.content] : [];
                const updateCards = (newCards) => { const b=[...(p.customBlocks||[])]; b[i]={...b[i],content:newCards}; update('customBlocks',b); };
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-bold text-[#2d2a26]">프로젝트 / 경험</h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {cards.map((card, ci) => (
                        <div key={ci} className="group/card relative bg-[#f7f5f0] rounded-xl border border-[#e8e4dc] overflow-hidden hover:shadow-md transition-all cursor-pointer"
                          onClick={() => setExpDetailIdx({ blockIdx: i, cardIdx: ci })}>
                          <div className="aspect-[4/3] bg-[#f0ece4] overflow-hidden">
                            <img src={card.thumbnailUrl || DEFAULT_PROJECT_LOGO} alt={card.title || ''} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-bold text-[#2d2a26] truncate">{card.title||'(제목 없음)'}</p>
                            <p className="text-[13px] text-[#8a8578] mt-0.5">{card.date||''}</p>
                          </div>
                          <button onClick={ev=>{ev.stopPropagation();updateCards(cards.filter((_,j)=>j!==ci));}} className="absolute top-1.5 right-1.5 bg-white/80 p-1 rounded-full text-[#c4b89a] hover:text-red-400 shadow-sm opacity-0 group-hover/card:opacity-100 transition-opacity"><Trash2 size={11}/></button>
                        </div>
                      ))}
                      <div className="relative aspect-[4/3]">
                        <button onClick={() => setAddCardMenuIdx(addCardMenuIdx === i ? null : i)}
                          className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#e8e4dc] text-[#c4b89a] hover:border-[#c4a882] hover:text-[#8a6c4a] transition-colors">
                          <Plus size={20}/><span className="text-xs">경험 추가</span>
                        </button>
                        {addCardMenuIdx === i && (
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-[#e8e4dc] rounded-xl shadow-lg z-20 py-1 w-52">
                            <button onClick={() => { setProjectBlockPickerIdx(i); setAddCardMenuIdx(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#f7f5f0] text-sm text-[#5a564e] text-left">
                              <span className="w-5 h-5 bg-[#f0ece4] rounded flex items-center justify-center"><Database size={12} className="text-[#8a6c4a]" /></span>
                              경험 DB에서 불러오기
                            </button>
                            <button onClick={() => { updateCards([...cards,{title:'',date:'',role:'',description:'',skills:[],link:'',thumbnailUrl:''}]); setAddCardMenuIdx(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#f7f5f0] text-sm text-[#5a564e] text-left">
                              <span className="w-5 h-5 bg-[#f0ece4] rounded flex items-center justify-center"><Plus size={12} className="text-[#8a6c4a]" /></span>
                              직접 작성하기
                            </button>
                          </div>
                        )}
                        {projectBlockPickerIdx === i && (
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-[#e8e4dc] rounded-xl shadow-lg z-30 py-1 w-64 max-h-52 overflow-y-auto">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-[#e8e4dc]">
                              <span className="text-xs font-bold text-[#5a564e]">경험 DB에서 선택</span>
                              <button onClick={() => setProjectBlockPickerIdx(null)} className="text-[#c4b89a] hover:text-[#5a564e]"><X size={14} /></button>
                            </div>
                            {userExperiences.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">등록된 경험이 없습니다</p>
                            ) : userExperiences.map(exp => (
                              <button key={exp.id} onClick={() => {
                                const aiResult = exp.structuredResult||{};
                                const autoSkills = (aiResult.keywords||exp.keywords||[]).slice(0,8).map(k=>typeof k==='string'?k:k?.name??'').filter(Boolean);
                                updateCards([...cards,{ title:exp.title||'',date:exp.createdAt?.toDate?.()?.toISOString?.()?.slice(0,7)||'',role:aiResult.projectOverview?.role||'',description:aiResult.projectOverview?.summary||aiResult.intro||exp.description||'',skills:autoSkills,link:'',thumbnailUrl:exp.images?.[0]||'',structuredResult:aiResult,experienceId:exp.id||null }]);
                                setProjectBlockPickerIdx(null);
                              }} className="w-full text-left flex items-start gap-2 px-3 py-2 hover:bg-[#f7f5f0] transition-colors">
                                {exp.images?.[0]||exp.thumbnailUrl ? <img src={exp.images?.[0]||exp.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 mt-0.5" /> : <div className="w-8 h-8 rounded bg-[#f0ece4] flex items-center justify-center flex-shrink-0 mt-0.5"><Briefcase size={14} className="text-[#c4b89a]"/></div>}
                                <div className="min-w-0"><p className="text-sm text-[#2d2a26] font-medium truncate">{exp.title}</p>{exp.date&&<p className="text-[12px] text-[#8a8578]">{exp.date}</p>}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        ))}

        {/* 블록 추가 버튼 */}
        <div className="px-10 pb-8">
          <div className="relative">
            <button onClick={() => setShowCustomBlockMenu(prev => !prev)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[#e8e4dc] rounded-xl text-sm text-[#c4b89a] hover:border-[#c4a882] hover:text-[#8a6c4a] transition-colors">
              <Plus size={16} /> 블록 추가
            </button>
            {showCustomBlockMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-[#e8e4dc] rounded-xl shadow-lg z-20 py-2 w-72 max-h-[70vh] overflow-y-auto">
                <p className="px-3 py-1 text-[12px] text-[#8a8578] font-bold uppercase tracking-wider">기본 블록</p>
                {[
                  { type: 'heading', icon: <Type size={14}/>, label: '제목', desc: '큰 제목 텍스트' },
                  { type: 'text', icon: <MessageSquare size={14}/>, label: '텍스트', desc: '자유 텍스트 블록' },
                  { type: 'image', icon: <ImageIcon size={14}/>, label: '이미지', desc: '사진 첨부' },
                  { type: 'divider', icon: <span className="text-xs">—</span>, label: '구분선', desc: '섹션 구분' },
                ].map(item => (
                  <button key={item.type} onClick={() => { addToArray('customBlocks', { type: item.type, content: '' }); setShowCustomBlockMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f7f5f0] text-left">
                    <span className="w-6 h-6 bg-[#f0ece4] rounded flex items-center justify-center text-[#8a6c4a]">{item.icon}</span>
                    <div><p className="text-sm font-medium text-[#2d2a26]">{item.label}</p><p className="text-[12px] text-[#8a8578]">{item.desc}</p></div>
                  </button>
                ))}
                <div className="border-t border-[#e8e4dc] mt-1 pt-1">
                  <p className="px-3 py-1 text-[12px] text-[#8a8578] font-bold uppercase tracking-wider">콘텐츠 블록</p>
                  <button onClick={() => { addToArray('customBlocks', { type: 'project', content: [] }); setShowCustomBlockMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f7f5f0] text-left">
                    <span className="w-6 h-6 bg-[#f0ece4] rounded flex items-center justify-center text-[#8a6c4a]"><Briefcase size={14}/></span>
                    <div><p className="text-sm font-medium text-[#2d2a26]">프로젝트 / 경험</p><p className="text-[12px] text-[#8a8578]">카드 갤러리, DB에서 불러오기 지원</p></div>
                  </button>
                </div>
                <div className="border-t border-[#e8e4dc] mt-1 pt-1">
                  <p className="px-3 py-1 text-[12px] text-[#8a8578] font-bold uppercase tracking-wider">섹션 패키지</p>
                  {[
                    ['education', '학력'], ['awards', '수상'], ['experiences', '프로젝트 / 경험'],
                    ['curricular', '교과 활동'], ['extracurricular', '비교과 활동'], ['skills', '기술'],
                    ['goals', '목표와 계획'], ['values', '가치관'], ['interests', '관심사'], ['contact', '연락처'],
                  ].map(([key, label]) => (
                    <button key={key} type="button" onClick={() => addSectionPackage(key)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f7f5f0] text-left">
                      <span className="w-6 h-6 bg-[#f0ece4] rounded flex items-center justify-center text-[#8a6c4a]"><Plus size={14}/></span>
                      <div><p className="text-sm font-medium text-[#2d2a26]">{label}</p><p className="text-[12px] text-[#8a8578]">섹션 세트 추가</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 관심사 */}
        {!hiddenSections.includes('interests') && (
        <div className="px-10 pb-8">
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="interests" defaultLabel="관심사" className="font-bold text-lg text-[#2d2a26]" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="values" jobAnalysis={portfolio.jobAnalysis} />
              <button onClick={() => hideSection('interests')} className="text-[#c4b89a] hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(p.interests || []).map((interest, i) => (
              <div key={i} className="group/int flex items-center gap-1 px-4 py-2 bg-white rounded-full border border-[#e8e4dc]">
                <input value={interest || ''} onChange={e => updateArrayItem('interests', i, e.target.value)}
                  className="text-sm text-[#5a564e] outline-none bg-transparent w-20" />
                <button onClick={() => removeFromArray('interests', i)} className="text-[#c4b89a] hover:text-red-400"><X size={10} /></button>
              </div>
            ))}
            <button onClick={() => addToArray('interests', '')}
              className="flex items-center gap-1 px-4 py-2 bg-white rounded-full border-2 border-dashed border-[#e8e4dc] text-xs text-[#8a8578] hover:border-[#c4a882] hover:text-[#5a564e] transition-colors">
              <Plus size={11} /> 추가
            </button>
          </div>
        </div>
        )}

        {/* 숨긴 섹션 복원 */}
        {hiddenSections.length > 0 && (
          <div className="px-10 pb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-[#8a8578]">숨긴 섹션:</span>
              {hiddenSections.map(s => (
                <button key={s} onClick={() => showSection(s)}
                  className="px-3 py-1 text-xs bg-[#f7f5f0] text-[#8a6c4a] rounded-full border border-[#e8e4dc] hover:bg-[#e8e4dc] transition-colors">
                  + {s === 'interviews' ? '인터뷰' : s === 'education' ? '학력' : s === 'awards' ? '수상' : s === 'experiences' ? '프로젝트' : s === 'skills' ? '기술' : s === 'goals' ? '목표' : s === 'values' ? '가치관' : s === 'interests' ? '관심사' : s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-5 border-t border-[#e8e4dc] flex items-center justify-between text-xs text-[#8a8578]">
          <span>POPOL Portfolio · {p.userName || ''}</span>
        </div>
      </div>

      {/* ── 경험 상세 모달 (Ashley) ── */}
      {expDetailIdx !== null && (() => {
        // 커스텀 블록 내 카드 or 기본 경험
        if (expDetailIdx !== null && typeof expDetailIdx === 'object') {
          const { blockIdx, cardIdx } = expDetailIdx;
          const block = p.customBlocks?.[blockIdx];
          const cards = Array.isArray(block?.content) ? block.content : [];
          const card = cards[cardIdx];
          if (!card) return null;
          return (
            <ExpDetailModal
              userExperiences={userExperiences}
              exp={card}
              onUpdate={(changes) => {
                const newCards = cards.map((c, j) => j === cardIdx ? { ...c, ...changes } : c);
                const b = [...(p.customBlocks || [])]; b[blockIdx] = { ...b[blockIdx], content: newCards };
                update('customBlocks', b);
              }}
              onClose={() => setExpDetailIdx(null)}
              resizeToBase64={resizeToBase64}
              jobAnalysis={portfolio.jobAnalysis}
              analysisMode={analysisMode}
              onTailorApply={(sectionKey, content) => {
                const newCards = cards.map((c, j) => j === cardIdx ? { ...c, structuredResult: { ...(c.structuredResult || {}), [sectionKey]: content } } : c);
                const b = [...(p.customBlocks || [])]; b[blockIdx] = { ...b[blockIdx], content: newCards };
                update('customBlocks', b);
              }}
            />
          );
        }
        if (!p.experiences?.[expDetailIdx]) return null;
        return (
          <ExpDetailModal
              userExperiences={userExperiences}
            exp={p.experiences[expDetailIdx]}
            onUpdate={(changes) => updateArrayItem('experiences', expDetailIdx, changes)}
            onClose={() => setExpDetailIdx(null)}
            resizeToBase64={resizeToBase64}
            jobAnalysis={portfolio.jobAnalysis}
            analysisMode={analysisMode}
            onTailorApply={(sectionKey, content) => {
              const updated = { ...p.experiences[expDetailIdx] };
              updated.structuredResult = { ...(updated.structuredResult || {}), [sectionKey]: content };
              updateArrayItem('experiences', expDetailIdx, updated);
            }}
          />
        );
      })()}
    </div>{/* end max-w */}

      {/* ── 우측 기업 분석 사이드바 (공용) ── */}
      <JobAnalysisSidebar portfolio={p} update={update} updateArrayItem={updateArrayItem} analysisMode={analysisMode} onClose={() => onCloseAnalysis?.()} />

    </div>
  );
}
function AcademicVisualEditor({ portfolio, update, updateNested, addToArray, removeFromArray, updateArrayItem, userExperiences, importExperience, analysisMode, onCloseAnalysis }) {
  const p = portfolio;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const hiddenSections = p.hiddenSections || [];
  const sections = [...new Set(['education', 'awards', 'experiences', 'skills', 'goals', 'values', ...(p.sections || [])])];
  const profileImageInputRef = useRef(null);
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showAddExpMenu, setShowAddExpMenu] = useState(false);
  const [expDetailIdx, setExpDetailIdx] = useState(null);
  const [recResults, setRecResults] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [showJobInput, setShowJobInput] = useState(false);
  const [jobUrl, setJobUrl] = useState('');
  const [analyzingJob, setAnalyzingJob] = useState(false);
  const [jobError, setJobError] = useState(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [blockDragging, setBlockDragging] = useState(null);
  const [blockDropTarget, setBlockDropTarget] = useState(null);

  // 섹션 이름 편집 헬퍼
  const EditableTitle = ({ sectionKey, defaultLabel, className = '' }) => (
    <EditableSectionTitle portfolio={p} update={update} sectionKey={sectionKey} defaultLabel={defaultLabel} className={className} />
  );

  const addSectionPackage = (sectionKey) => {
    const startOrder = (p.customBlocks || []).length;
    update('customBlocks', [...(p.customBlocks || []), ...makeSectionPackageBlocks(sectionKey, startOrder)]);
    update('sections', [...new Set([...sections, sectionKey])]);
    update('hiddenSections', hiddenSections.filter(key => key !== sectionKey));
    if (sectionKey === 'education' && !(p.education || []).length) update('education', [{ name: '', period: '', degree: '', detail: '' }]);
    if (sectionKey === 'awards' && !(p.awards || []).length) update('awards', [{ date: '', title: '', organization: '', description: '' }]);
    if (sectionKey === 'experiences' && !(p.experiences || []).length) update('experiences', [{ date: '', title: '', organization: '', description: '', content: '' }]);
    if (sectionKey === 'skills') update('skills', { ...skills, tools: skills.tools || [], languages: skills.languages || [], frameworks: skills.frameworks || [], others: (skills.others || []).length ? skills.others : [''] });
    if (sectionKey === 'goals' && !(p.goals || []).length) update('goals', [{ title: '', description: '', type: 'short', status: 'planned' }]);
    if (sectionKey === 'values' && !p.valuesEssay && !p.valuesEssayBlocks) update('valuesEssay', '');
    if (sectionKey === 'contact') update('contact', { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '', ...(p.contact || {}) });
    setShowBlockMenu(false);
  };

  const resizeToBase64 = (file, maxPx = 800, quality = 0.8) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new window.Image();
        img.onload = () => {
          const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale; canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject; img.src = ev.target.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });

  const academicSectionOrderManager = makeSectionOrderManager('academic', p.sectionOrder, update);
  const getAcademicSectionOrder = academicSectionOrderManager.getOrder;
  const moveAcademicSectionOrder = academicSectionOrderManager.move;
  const academicSectionHoverRef = useRef(null);
  const handleAcademicSectionDragOver = (e, sectionKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const from = e.dataTransfer.getData('text/plain');
    if (from && from !== sectionKey && academicSectionHoverRef.current !== sectionKey) {
      academicSectionHoverRef.current = sectionKey;
      moveAcademicSectionOrder(from, sectionKey);
    }
  };
  const finishAcademicSectionDrag = () => {
    academicSectionHoverRef.current = null;
  };
  const moveAcademicCustomBlock = (from, to) => {
    const blocks = p.customBlocks || [];
    const next = reorderItems(blocks, from, to);
    if (next !== blocks) update('customBlocks', next);
  };
  const getAcademicCustomBlockDndProps = (index, block) => ({
    draggable: true,
    className: `px-10 pb-8 transition-all duration-150 rounded-xl cursor-grab active:cursor-grabbing ${blockDragging === index ? 'opacity-45 scale-[0.99]' : ''} ${blockDropTarget === index && blockDragging !== index ? 'ring-2 ring-primary-200 bg-primary-50/30' : ''}`,
    onDragStart: (event) => {
      if (shouldIgnoreBlockDrag(event.target)) {
        event.preventDefault();
        return;
      }
      startCustomBlockDrag(event, index, getCustomBlockLabel(block, index), setBlockDragging);
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setBlockDropTarget(index);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget) && blockDropTarget === index) setBlockDropTarget(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const from = parseInt(e.dataTransfer.getData('application/x-fitpoly-custom-block') || e.dataTransfer.getData('block-idx'), 10);
      if (!isNaN(from)) moveAcademicCustomBlock(from, index);
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
    onDragEnd: () => {
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
  });
  const getAcademicCustomBlockHandleProps = (index, block) => ({
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation();
      startCustomBlockDrag(e, index, getCustomBlockLabel(block, index), setBlockDragging);
    },
    onDragEnd: () => {
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
  });

  const fetchVisualRecommendations = async () => {
    if (!portfolio.jobAnalysis) { toast.error('기업 분석을 먼저 등록해주세요'); return; }
    setRecLoading(true);
    try {
      const res = await api.post('/job/recommend-experiences', {
        jobAnalysis: portfolio.jobAnalysis,
        experiences: userExperiences,
      });
      setRecResults(res.data);
    } catch { toast.error('추천 불러오기 실패'); }
    finally { setRecLoading(false); }
  };

  const handleJobAnalyze = async () => {
    if (!jobUrl.trim()) return;
    setAnalyzingJob(true);
    setJobError(null);
    try {
      const { data: respData } = await api.post('/job/analyze', { url: jobUrl.trim() });
      update('jobAnalysis', respData.analysis);
      setShowJobInput(false);
      setJobUrl('');
      toast.success('기업 분석이 완료되었습니다');
    } catch (err) {
      setJobError(err.response?.data?.error || '분석에 실패했습니다');
    }
    setAnalyzingJob(false);
  };

  return (
    <div className="relative flex gap-4 items-start">

      {/* ── 사이드바 왼쪽 [비활성화] ── */}
      {false && (
      <div className="w-[360px] flex-shrink-0">
        <div className="sticky top-5">
          <div className="flex items-center gap-2 mb-3 px-1">
            <h3 className="text-sm font-bold text-gray-800">기업 분석</h3>
          </div>
          {p.jobAnalysis ? (
            <div className="space-y-3">
              <JobAnalysisBadge
                analysis={p.jobAnalysis}
                onRemove={() => update('jobAnalysis', null)}
                experiences={p.experiences || []}
                onTailorApply={(expIdx, sectionKey, content) => {
                  const updated = { ...p.experiences[expIdx] };
                  updated.structuredResult = { ...(updated.structuredResult || {}), [sectionKey]: content };
                  updateArrayItem('experiences', expIdx, updated);
                }}
              />
              {!showJobInput ? (
                <button
                  onClick={() => setShowJobInput(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-xl bg-white hover:bg-blue-50 transition-colors font-medium"
                >
                  <Globe size={13} /> 다른 공고로 변경
                </button>
              ) : (
                <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-3 shadow-sm">
                  <p className="text-xs font-semibold text-blue-700">새 채용공고로 변경</p>
                  <div className="relative">
                    <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={e => setJobUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                      placeholder="https:// 채용공고 링크"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  {jobError && <p className="text-xs text-red-500 flex items-center gap-1"><X size={12} />{jobError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleJobAnalyze} disabled={analyzingJob || !jobUrl.trim()}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {analyzingJob ? <><Loader2 size={14} className="animate-spin" />분석 중...</> : <>분석하기</>}
                    </button>
                    <button onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                      className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded-xl transition-colors">취소</button>
                  </div>
                </div>
              )}
            </div>
          ) : !showJobInput ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <p className="text-sm font-bold text-blue-900">채용공고 분석</p>
                  <p className="text-xs text-blue-500">기업·직무·전략을 한눈에</p>
                </div>
              </div>
              <p className="text-xs text-blue-600 leading-relaxed mb-4">
                지원할 기업의 채용공고 URL을 입력하면 기업 분석, 직무 분석, 지원 전략, 산업 트렌드를 자동 정리합니다.
              </p>
              <button
                onClick={() => setShowJobInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                채용공고 분석하기
              </button>
            </div>
          ) : (
            <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe size={14} className="text-blue-500" />
                <p className="text-sm font-semibold text-blue-800">채용공고 URL 입력</p>
              </div>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={jobUrl}
                  onChange={e => setJobUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                  placeholder="https:// 채용공고 링크를 붙여넣으세요"
                  className="w-full pl-9 pr-3 py-3 text-sm border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              {jobError && <p className="text-sm text-red-500 flex items-center gap-1.5"><X size={13} />{jobError}</p>}
              <div className="flex gap-2">
                <button onClick={handleJobAnalyze} disabled={analyzingJob || !jobUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {analyzingJob ? <><Loader2 size={15} className="animate-spin" />분석 중...</> : <>분석하기</>}
                </button>
                <button onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                  className="px-4 py-3 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded-xl transition-colors">취소</button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}{/* end 사이드바 왼쪽 */}

    <div className="flex-1 min-w-0 max-w-[1100px]">
    <div className="w-full">
      <div className="relative rounded-t-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 50%), radial-gradient(circle at 80% 50%, #818cf8 0%, transparent 50%)'}} />
        <div className="relative px-10 pt-12 pb-10 flex items-end gap-6">
          <input type="file" ref={profileImageInputRef} accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              try { const b = await resizeToBase64(file, 400, 0.7); update('profileImageUrl', b); } catch { toast.error('이미지 처리 실패'); }
            }} />
          <button onClick={() => profileImageInputRef.current?.click()}
            className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-white/20 relative group flex-shrink-0">
            {p.profileImageUrl
              ? <img src={p.profileImageUrl} alt="profile" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-white/10 flex items-center justify-center"><Upload size={28} className="text-white/40" /></div>}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload size={18} className="text-white" />
            </div>
          </button>
          <div className="flex-1 pb-1">
            <input value={p.userName || ''} onChange={e => update('userName', e.target.value)}
              placeholder="이름" className="w-full text-3xl font-bold text-white outline-none bg-transparent placeholder:text-blue-300/50 mb-1" />
            <input value={p.nameEn || ''} onChange={e => update('nameEn', e.target.value)}
              placeholder="English Name" className="w-full text-blue-200 text-sm outline-none bg-transparent placeholder:text-blue-300/50" />
            <input value={p.headline || ''} onChange={e => update('headline', e.target.value)}
              placeholder="한 줄 소개" className="w-full text-blue-300/70 text-xs outline-none bg-transparent placeholder:text-blue-300/40 mt-2" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-b-2xl border border-t-0 border-surface-200 shadow-sm">
        {/* 자기소개 */}
        <div className="px-10 py-8 border-b border-surface-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" /><EditableTitle sectionKey="intro" defaultLabel="자기소개" className="text-lg font-bold text-gray-900" />
            </h2>
            <VisualSectionRecommend sectionType="profile" jobAnalysis={portfolio.jobAnalysis} />
          </div>
          <RichContentEditor
            value={p.valuesEssayBlocks || p.valuesEssay || ''}
            onChange={v => { update('valuesEssayBlocks', v); update('valuesEssay', richValueToPlainText(v)); }}
            placeholder="자기소개를 작성하세요..."
            textRows={5}
            textClassName="w-full text-sm text-gray-700 leading-relaxed outline-none bg-transparent placeholder:text-gray-300 resize-y"
          />
        </div>

        {/* 연락처 바 */}
        <div className="px-10 py-4 border-b border-surface-100 flex flex-wrap gap-4 bg-surface-50/50">
          {[['email','이메일',Mail],['phone','연락처',Phone],['github','GitHub',Globe],['linkedin','LinkedIn',Globe]].map(([key, label, Icon]) => (
            <div key={key} className="flex items-center gap-1.5">
              <Icon size={12} className="text-gray-400" />
              <input value={contact[key] || ''} onChange={e => updateNested('contact', key, e.target.value)}
                placeholder={label} className="text-xs text-gray-500 outline-none bg-transparent placeholder:text-gray-300 w-32" />
            </div>
          ))}
        </div>

        {/* 학력 + 수상 */}
        <div className="px-10 py-8 border-b border-surface-100">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block" /><EditableTitle sectionKey="education" defaultLabel="학력" className="text-lg font-bold text-gray-900" />
                </h2>
                <VisualSectionRecommend sectionType="education" jobAnalysis={portfolio.jobAnalysis} />
              </div>
              <div className="space-y-3 relative">
                <div className="absolute left-[7px] top-2 bottom-8 w-0.5 bg-emerald-100" />
                {(p.education || []).map((edu, i) => (
                  <div key={i} className="flex items-start gap-3 group/edu relative">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white z-10 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <input value={edu.name || ''} onChange={e => updateArrayItem('education', i, { name: e.target.value })}
                        placeholder="학교명" className="text-sm font-bold text-gray-800 outline-none bg-transparent placeholder:text-gray-300 w-full" />
                      <input value={edu.degree || ''} onChange={e => updateArrayItem('education', i, { degree: e.target.value })}
                        placeholder="학위 · 전공" className="text-xs text-gray-500 outline-none bg-transparent placeholder:text-gray-300 w-full mt-0.5" />
                      <input value={edu.period || ''} onChange={e => updateArrayItem('education', i, { period: e.target.value })}
                        placeholder="기간" className="text-xs text-gray-400 outline-none bg-transparent placeholder:text-gray-300 w-full mt-0.5" />
                      <input value={edu.detail || ''} onChange={e => updateArrayItem('education', i, { detail: e.target.value })}
                        placeholder="상세 내용" className="w-full text-sm text-gray-500 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 mt-1" />
                    </div>
                    <button onClick={() => removeFromArray('education', i)} className="text-gray-300 hover:text-red-400"><X size={11} /></button>
                  </div>
                ))}
                <button onClick={() => addToArray('education', { name: '', period: '', degree: '', detail: '' })}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 ml-6"><Plus size={11} /> 학력 추가</button>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-amber-500 rounded-full inline-block" /><EditableTitle sectionKey="awards" defaultLabel="수상 / 장학금" className="text-lg font-bold text-gray-900" />
                </h2>
                <VisualSectionRecommend sectionType="awards" jobAnalysis={portfolio.jobAnalysis} />
              </div>
              <div className="space-y-3">
                {(p.awards || []).map((a, i) => (
                  <div key={i} className="flex items-start gap-3 group/aw">
                    <Award size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <input value={a.title || ''} onChange={e => updateArrayItem('awards', i, { title: e.target.value })}
                        placeholder="수상명" className="text-sm font-medium text-gray-800 outline-none bg-transparent placeholder:text-gray-300 w-full" />
                      <input value={a.date || ''} onChange={e => updateArrayItem('awards', i, { date: e.target.value })}
                        placeholder="날짜" className="text-xs text-gray-400 outline-none bg-transparent placeholder:text-gray-300 w-full mt-0.5" />
                    </div>
                    <button onClick={() => removeFromArray('awards', i)} className="text-gray-300 hover:text-red-400"><X size={11} /></button>
                  </div>
                ))}
                <button onClick={() => addToArray('awards', { date: '', title: '' })}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600"><Plus size={11} /> 수상 추가</button>
              </div>
            </div>
          </div>
        </div>

        {/* 활동 기록 (타임라인) */}
        <div className="px-10 py-8 border-b border-surface-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" /><EditableTitle sectionKey="activityRecords" defaultLabel="활동 기록" className="text-lg font-bold text-gray-900" />
            </h2>
            <VisualSectionRecommend sectionType="experiences" jobAnalysis={portfolio.jobAnalysis} />
          </div>
          <div className="relative">
            {(p.activityRecords || []).length > 0 && (
              <div className="absolute left-[7px] top-2 bottom-8 w-0.5 bg-blue-100" />
            )}
            <div className="space-y-4">
              {(p.activityRecords || []).map((act, i) => {
                const categoryColors = {
                  award: 'bg-amber-400',
                  study: 'bg-purple-400',
                  project: 'bg-blue-400',
                  intern: 'bg-green-400',
                  certificate: 'bg-red-400',
                  volunteer: 'bg-pink-400',
                  other: 'bg-gray-400',
                };
                const categoryLabels = {
                  award: 'award',
                  study: 'study',
                  project: 'project',
                  intern: 'intern',
                  certificate: 'certificate',
                  volunteer: 'volunteer',
                  other: 'other',
                };
                const dotColor = categoryColors[act.category] || 'bg-gray-400';
                return (
                  <div key={i} className="flex items-start gap-3 group/act relative">
                    <div className={`w-3.5 h-3.5 rounded-full ${dotColor} border-2 border-white z-10 mt-0.5 flex-shrink-0`} />
                    <div className="flex-1">
                      <input value={act.title || ''} onChange={e => updateArrayItem('activityRecords', i, { title: e.target.value })}
                        placeholder="활동명" className="w-full text-sm font-medium text-gray-800 outline-none bg-transparent placeholder:text-gray-300" />
                      <input value={act.date || ''} onChange={e => updateArrayItem('activityRecords', i, { date: e.target.value })}
                        placeholder="YYYY.MM" className="w-full text-xs text-gray-400 outline-none bg-transparent placeholder:text-gray-300 mt-0.5" />
                    </div>
                    <select
                      value={act.category || 'other'}
                      onChange={e => updateArrayItem('activityRecords', i, { category: e.target.value })}
                      className="text-xs text-gray-500 bg-gray-100 rounded-md px-2 py-1 outline-none border-none"
                    >
                      <option value="award">award</option>
                      <option value="study">study</option>
                      <option value="project">project</option>
                      <option value="intern">intern</option>
                      <option value="certificate">certificate</option>
                      <option value="volunteer">volunteer</option>
                      <option value="other">other</option>
                    </select>
                    <button onClick={() => removeFromArray('activityRecords', i)} className="text-gray-300 hover:text-red-400"><X size={11} /></button>
                  </div>
                );
              })}
              <button onClick={() => addToArray('activityRecords', { date: '', title: '', category: 'other' })}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 ml-6"><Plus size={11} /> 활동 추가</button>
            </div>
          </div>
        </div>

        {/* 경험 */}
        <div className="px-10 py-8 border-b border-surface-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-violet-500 rounded-full inline-block" /><EditableTitle sectionKey="experiences" defaultLabel="프로젝트 / 경험" className="text-lg font-bold text-gray-900" />
            </h2>
            <div className="flex items-center gap-2">
              {portfolio.jobAnalysis && (
                <button onClick={fetchVisualRecommendations} disabled={recLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors font-medium">
                  {recLoading ? <><Loader2 size={12} className="animate-spin" /> 분석 중...</> : '기업 맞춤 경험 추천'}
                </button>
              )}

            </div>
          </div>

          {/* 기업 맞춤 추천 결과 */}
          {recResults && (
            <div className="mb-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-indigo-700 flex items-center gap-1.5"><Sparkles size={14} /> 기업 맞춤 경험 추천</p>
                <button onClick={() => setRecResults(null)} className="text-indigo-400 hover:text-indigo-600"><X size={14} /></button>
              </div>
              {(recResults.keywords || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {recResults.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white rounded-full text-xs border border-indigo-200">
                      <span className="font-bold text-indigo-700">{kw.keyword}</span>
                      <span className="text-gray-500 ml-1">{kw.description}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {(recResults.recommendations || []).map((rec, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-indigo-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{rec.experience?.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rec.reason}</p>
                      {(rec.matchedKeywords || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rec.matchedKeywords.map((mk, mi) => (
                            <span key={mi} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[12px] font-medium">{mk}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => { const exp = userExperiences.find(e => e.id === rec.experience?.id); if (exp) importExperience(exp); else toast.error('경험 데이터를 찾을 수 없습니다'); }}
                      className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                      추가
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {(p.experiences || []).map((e, i) => (
              <div key={i} className="group/exp relative border border-surface-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer" onClick={() => setExpDetailIdx(i)}>
                <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-blue-50 overflow-hidden">
                  <img src={e.thumbnailUrl || DEFAULT_PROJECT_LOGO} alt={e.title || ''} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <input value={e.title || ''} onChange={ev => { ev.stopPropagation(); updateArrayItem('experiences', i, { title: ev.target.value }); }} onClick={ev => ev.stopPropagation()}
                    placeholder="제목" className="w-full text-sm font-bold text-gray-800 outline-none bg-transparent placeholder:text-gray-300" />
                  <input value={e.date || ''} onChange={ev => { ev.stopPropagation(); updateArrayItem('experiences', i, { date: ev.target.value }); }} onClick={ev => ev.stopPropagation()}
                    placeholder="날짜" className="w-full text-xs text-gray-400 outline-none bg-transparent placeholder:text-gray-300 mt-0.5" />
                  {e.description && <p className="text-[13px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{e.description}</p>}
                  {(e.skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(e.skills || []).slice(0, 3).map((sk, si) => (
                        <span key={si} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[12px]">{typeof sk === 'string' ? sk : sk?.name}</span>
                      ))}
                      {(e.skills || []).length > 3 && <span className="text-[12px] text-gray-400">+{(e.skills || []).length - 3}</span>}
                    </div>
                  )}
                </div>
                <button onClick={ev => { ev.stopPropagation(); removeFromArray('experiences', i); }}
                  className="absolute top-1.5 right-1.5 bg-white/80 p-1 rounded-full text-gray-400 hover:text-red-500 shadow-sm">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <div className="relative aspect-[16/10]">
              <button onClick={() => setShowAddExpMenu(prev => !prev)}
                className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-200 text-gray-300 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Plus size={22} /><span className="text-xs">경험 추가</span>
              </button>
              {showAddExpMenu && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-surface-200 rounded-xl shadow-lg z-20 py-1 w-52">
                  <button onClick={() => { setShowExpPicker(true); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                    <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Database size={12} className="text-blue-600" /></span>
                    경험 DB에서 불러오기
                  </button>
                  <button onClick={() => { addToArray('experiences', { date: '', title: '', description: '', status: 'finished', classify: [], skills: [], role: '', link: '', sections: [], thumbnailUrl: '' }); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                    <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Plus size={12} className="text-blue-600" /></span>
                    직접 작성하기
                  </button>
                </div>
              )}
              {showExpPicker && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-surface-200 rounded-xl shadow-lg z-30 py-1 w-60 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100">
                    <span className="text-xs font-bold text-gray-700">경험 DB에서 선택</span>
                    <button onClick={() => setShowExpPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                  {userExperiences.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">등록된 경험이 없습니다</p>
                  ) : userExperiences.map(exp => (
                    <button key={exp.id} onClick={() => { importExperience(exp); setShowExpPicker(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 truncate">{exp.title}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 재정렬 가능한 섹션들 (기술/목표) */}
        <div className="flex flex-col">

        {/* 기술 */}
        <div className="px-10 py-8 border-b border-surface-100" style={{ order: getAcademicSectionOrder('skills') }}
          onDragOver={e => handleAcademicSectionDragOver(e, 'skills')}
          onDrop={e => { e.preventDefault(); finishAcademicSectionDrag(); }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-teal-500 rounded-full inline-block" /><EditableTitle sectionKey="skills" defaultLabel="기술" className="text-lg font-bold text-gray-900" />
            </h2>
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="skills" jobAnalysis={portfolio.jobAnalysis} />
              <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'skills'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100 p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {[
              { category: 'tools', label: '도구 (Tools)', placeholder: '기타 도구 입력...', presets: ['Notion', 'Figma', 'Photoshop', 'Illustrator', 'Canva', 'Slack', 'Jira', 'Excel', 'VS Code', 'GitHub', 'Premiere Pro'] },
              { category: 'languages', label: '언어', placeholder: '기타 언어 입력...', presets: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'Go', 'Swift', 'Kotlin', 'SQL', 'R'] },
              { category: 'frameworks', label: '프레임워크/라이브러리', placeholder: '기타 프레임워크 입력...', presets: ['React', 'Vue.js', 'Next.js', 'Spring', 'Django', 'Node.js', 'Express.js', 'TensorFlow', 'Flutter', 'Tailwind CSS'] },
              { category: 'others', label: '기타 역량', placeholder: '기타 역량 입력...', presets: ['데이터 분석', 'UI/UX 디자인', '프로젝트 관리', '기획', '마케팅', '글쓰기', '발표', '리더십'] },
            ].map(({ category, label, placeholder, presets }) => (
              <SkillCategoryInput
                key={category}
                category={category}
                label={label}
                placeholder={placeholder}
                items={skills[category] || []}
                presets={presets}
                onUpdate={(val) => update('skills', { ...skills, [category]: val })}
              />
            ))}
          </div>
        </div>

        {/* 목표와 계획 */}
        {!hiddenSections.includes('goals') && sections.includes('goals') && (
        <div className="px-10 pb-8" style={{ order: getAcademicSectionOrder('goals') }}
          onDragOver={e => handleAcademicSectionDragOver(e, 'goals')}
          onDrop={e => { e.preventDefault(); finishAcademicSectionDrag(); }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-green-500 rounded-full inline-block" /><EditableTitle sectionKey="goals" defaultLabel="목표와 계획" className="text-lg font-bold text-gray-900" />
            </h2>
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="goals" jobAnalysis={portfolio.jobAnalysis} />
              <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'goals'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100 p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
              <button onClick={() => update('hiddenSections', [...hiddenSections, 'goals'])}
                className="text-gray-300 hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="space-y-3">
            {(p.goals || []).map((g, i) => (
              <div key={i} className="group/goal relative border-b border-surface-100 py-3 last:border-b-0">
                <button onClick={() => removeFromArray('goals', i)}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                <input value={g.title || ''} onChange={e => updateArrayItem('goals', i, { title: e.target.value })}
                  placeholder="목표명" className="w-full text-sm font-bold text-gray-800 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
                <div className="mt-1">
                  <RichContentEditor
                    value={g.blocks || g.description || ''}
                    onChange={v => updateArrayItem('goals', i, { blocks: v, description: Array.isArray(v) ? v.filter(s => s.type==='text').map(s=>s.content).join('\n') : v })}
                    placeholder="상세 계획..."
                    textRows={2}
                    textClassName="w-full text-sm text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 mt-1 resize-none"
                  />
                </div>
              </div>
            ))}
            <button onClick={() => addToArray('goals', { title: '', description: '', type: 'short', status: 'planned' })}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600"><Plus size={12} /> 목표 추가</button>
          </div>
        </div>
        )}

        </div>{/* end flex col wrapper for Academic reorderable sections */}

        {hiddenSections.some(sectionKey => sections.includes(sectionKey)) && (
          <div className="px-10 pb-8">
            <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50/70 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-500">숨긴 섹션</span>
                {hiddenSections.filter(sectionKey => sections.includes(sectionKey)).map(sectionKey => (
                  <button
                    key={sectionKey}
                    type="button"
                    onClick={() => update('hiddenSections', hiddenSections.filter(item => item !== sectionKey))}
                    className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-primary-200 hover:text-primary-600 transition-colors"
                  >
                    <Plus size={11} /> {(p.customSectionLabels || {})[sectionKey] || SECTION_LABELS.academic[sectionKey] || sectionKey}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 커스텀 블록 */}
        {(p.customBlocks || []).map((block, i) => (
          <section key={i} {...getAcademicCustomBlockDndProps(i, block)}>
            <div className="bg-white rounded-xl p-6 border border-surface-200 relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1 items-center">
                  <div {...getAcademicCustomBlockHandleProps(i, block)} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors mr-1" title="드래그하여 이동"><GripVertical size={14} /></div>
                  <button onClick={() => { if (i === 0) return; const b = [...(p.customBlocks||[])]; [b[i-1],b[i]]=[b[i],b[i-1]]; update('customBlocks',b); }}
                    disabled={i===0} className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronUp size={14}/></button>
                  <button onClick={() => { if (i === (p.customBlocks||[]).length-1) return; const b=[...(p.customBlocks||[])]; [b[i+1],b[i]]=[b[i],b[i+1]]; update('customBlocks',b); }}
                    disabled={i===(p.customBlocks||[]).length-1} className="p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30"><ChevronDown size={14}/></button>
                </div>
                <button onClick={() => removeFromArray('customBlocks', i)} className="text-gray-300 hover:text-red-400"><Trash2 size={14}/></button>
              </div>
              {block.type === 'heading' && (
                <input value={block.content || ''} onChange={e => { const b=[...(p.customBlocks||[])]; b[i]={...b[i],content:e.target.value}; update('customBlocks',b); }}
                  placeholder="제목 입력..." className="w-full text-xl font-bold text-gray-800 outline-none bg-transparent placeholder:text-gray-300" />
              )}
              {block.type === 'text' && (
                <RichContentEditor value={block.content || ''} onChange={v => { const b=[...(p.customBlocks||[])]; b[i]={...b[i],content:v}; update('customBlocks',b); }}
                  placeholder="텍스트 입력..." textRows={4} textClassName="w-full text-sm text-gray-700 outline-none bg-transparent placeholder:text-gray-300 resize-y" />
              )}
              {block.type === 'image' && (
                <div className="space-y-2">
                  {block.content ? (
                    <div className="relative group/img">
                      <img src={block.content} alt="block" className="max-w-full rounded-lg" />
                      <button onClick={() => { const b=[...(p.customBlocks||[])]; b[i]={...b[i],content:''}; update('customBlocks',b); }}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover/img:opacity-100"><X size={12}/></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
                      <ImageIcon size={20} className="text-gray-300 mb-1" /><span className="text-xs text-gray-400">이미지 업로드</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async ev => {
                        const f=ev.target.files?.[0]; if(!f) return;
                        try { const b64=await resizeToBase64(f); const nb=[...(p.customBlocks||[])]; nb[i]={...nb[i],content:b64}; update('customBlocks',nb); } catch{}
                      }} />
                    </label>
                  )}
                </div>
              )}
              {block.type === 'divider' && <hr className="border-t-2 border-gray-100 my-2" />}
              {block.type === 'project' && (
                <div>
                  <p className="text-xs text-gray-400 mb-3">프로젝트 카드 블록</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(block.content || []).map((card, ci) => (
                      <div key={ci} className="border border-surface-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => setExpDetailIdx({blockIdx:i,cardIdx:ci})}>
                        <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-blue-50 overflow-hidden">
                          <img src={card.thumbnailUrl || DEFAULT_PROJECT_LOGO} alt={card.title || ''} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2.5">
                          <input value={card.title||''} onChange={ev=>{ev.stopPropagation();const nb=[...(p.customBlocks||[])];const nc=[...(nb[i].content||[])];nc[ci]={...nc[ci],title:ev.target.value};nb[i]={...nb[i],content:nc};update('customBlocks',nb);}} onClick={ev=>ev.stopPropagation()}
                            placeholder="제목" className="w-full text-xs font-bold text-gray-700 outline-none bg-transparent placeholder:text-gray-300"/>
                        </div>
                        <button onClick={ev=>{ev.stopPropagation();const nb=[...(p.customBlocks||[])];const nc=[...(nb[i].content||[])];nc.splice(ci,1);nb[i]={...nb[i],content:nc};update('customBlocks',nb);}}
                          className="absolute top-1 right-1 bg-white/80 p-0.5 rounded-full text-gray-400 hover:text-red-500"><X size={10}/></button>
                      </div>
                    ))}
                    <button onClick={()=>{const nb=[...(p.customBlocks||[])];nb[i]={...nb[i],content:[...(nb[i].content||[]),{title:'',description:'',thumbnailUrl:'',date:''}]};update('customBlocks',nb);}}
                      className="aspect-[16/10] flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-surface-200 text-gray-300 hover:border-blue-300 hover:text-blue-400">
                      <Plus size={18}/><span className="text-xs">카드 추가</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}

        {/* 블록 추가 */}
        <div className="px-10 pb-8">
          <div className="relative">
            <button onClick={() => setShowBlockMenu(m => !m)}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-surface-200 rounded-xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors">
              <Plus size={16} /> 블록 추가
            </button>
            {showBlockMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-2 w-72 max-h-[70vh] overflow-y-auto">
                <p className="px-3 py-1 text-[12px] text-gray-400 font-bold uppercase tracking-wider">기본 블록</p>
                {[
                  { type: 'heading', icon: <Type size={14} />, label: '제목', desc: '큰 제목 텍스트' },
                  { type: 'text', icon: <MessageSquare size={14} />, label: '텍스트', desc: '자유 텍스트 블록' },
                  { type: 'image', icon: <ImageIcon size={14} />, label: '이미지', desc: '사진 쳊부' },
                  { type: 'divider', icon: <span className="text-xs">—</span>, label: '구분선', desc: '섹션 구분' },
                ].map(item => (
                  <button key={item.type} onClick={() => { addToArray('customBlocks', { type: item.type, content: '' }); setShowBlockMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                    <span className="w-6 h-6 bg-surface-100 rounded flex items-center justify-center text-gray-500">{item.icon}</span>
                    <div><p className="text-sm font-medium text-gray-700">{item.label}</p><p className="text-[12px] text-gray-400">{item.desc}</p></div>
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <p className="px-3 py-1 text-[12px] text-gray-400 font-bold uppercase tracking-wider">콘텐츠 블록</p>
                  <button onClick={() => { addToArray('customBlocks', { type: 'project', content: [] }); setShowBlockMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                    <span className="w-6 h-6 bg-surface-100 rounded flex items-center justify-center text-gray-500"><Briefcase size={14}/></span>
                    <div><p className="text-sm font-medium text-gray-700">프로젝트/경험</p><p className="text-[12px] text-gray-400">프로젝트 카드 그리드</p></div>
                  </button>
                </div>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <p className="px-3 py-1 text-[12px] text-gray-400 font-bold uppercase tracking-wider">섹션 패키지</p>
                  {[
                    ['education', '학력'], ['awards', '수상'], ['experiences', '프로젝트 / 경험'],
                    ['curricular', '교과 활동'], ['extracurricular', '비교과 활동'], ['skills', '기술'],
                    ['goals', '목표와 계획'], ['values', '가치관'], ['contact', '연락처'],
                  ].map(([key, label]) => (
                    <button key={key} type="button" onClick={() => addSectionPackage(key)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left">
                      <span className="w-6 h-6 bg-surface-100 rounded flex items-center justify-center text-gray-500"><Plus size={14}/></span>
                      <div><p className="text-sm font-medium text-gray-700">{label}</p><p className="text-[12px] text-gray-400">섹션 세트 추가</p></div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-4 bg-surface-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
          <span>POPOL Portfolio · {p.userName || ''}</span>
        </div>
      </div>
    </div>{/* end max-w */}
    </div>{/* end portfolio col */}

      {/* ── 우측 기업 분석 사이드바 (공용) ── */}
      <JobAnalysisSidebar portfolio={p} update={update} updateArrayItem={updateArrayItem} analysisMode={analysisMode} onClose={() => onCloseAnalysis?.()} />

      {/* ── 경험 상세 모달 (Academic) ── */}
      {expDetailIdx !== null && (() => {
        if (typeof expDetailIdx === 'object') {
          const { blockIdx, cardIdx } = expDetailIdx;
          const cards = p.customBlocks?.[blockIdx]?.content || [];
          const card = cards[cardIdx];
          if (!card) return null;
          return (
            <ExpDetailModal
              userExperiences={userExperiences}
              exp={card}
              onUpdate={(changes) => {
                const newCards = cards.map((c, j) => j === cardIdx ? { ...c, ...changes } : c);
                const b = [...(p.customBlocks || [])]; b[blockIdx] = { ...b[blockIdx], content: newCards };
                update('customBlocks', b);
              }}
              onClose={() => setExpDetailIdx(null)}
              resizeToBase64={resizeToBase64}
              jobAnalysis={portfolio.jobAnalysis}
              analysisMode={analysisMode}
              onTailorApply={(sectionKey, content) => {
                const newCards = cards.map((c, j) => j === cardIdx ? { ...c, structuredResult: { ...(c.structuredResult || {}), [sectionKey]: content } } : c);
                const b = [...(p.customBlocks || [])]; b[blockIdx] = { ...b[blockIdx], content: newCards };
                update('customBlocks', b);
              }}
            />
          );
        }
        if (!p.experiences?.[expDetailIdx]) return null;
        return (
          <ExpDetailModal
              userExperiences={userExperiences}
            exp={p.experiences[expDetailIdx]}
            onUpdate={(changes) => updateArrayItem('experiences', expDetailIdx, changes)}
            onClose={() => setExpDetailIdx(null)}
            resizeToBase64={resizeToBase64}
            jobAnalysis={portfolio.jobAnalysis}
            analysisMode={analysisMode}
            onTailorApply={(sectionKey, content) => {
              const updated = { ...p.experiences[expDetailIdx] };
              updated.structuredResult = { ...(updated.structuredResult || {}), [sectionKey]: content };
              updateArrayItem('experiences', expDetailIdx, updated);
            }}
          />
        );
      })()}
    </div>
  );
}
function TimelineVisualEditor({ portfolio, update, updateNested, addToArray, removeFromArray, updateArrayItem, userExperiences, importExperience, analysisMode, onCloseAnalysis }) {
  const p = portfolio;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || { summary: { credits: '', gpa: '' }, courses: [], creditStatus: [] };
  const profileImageInputRef = useRef(null);
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showAddExpMenu, setShowAddExpMenu] = useState(false);
  const [activeSemester, setActiveSemester] = useState(null);

  const resizeToBase64 = (file, maxPx = 800, quality = 0.8) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new window.Image();
        img.onload = () => {
          const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const timelineSectionOrderManager = makeSectionOrderManager('timeline', p.sectionOrder, update);
  const getTimelineSectionOrder = timelineSectionOrderManager.getOrder;
  const moveTimelineSectionOrder = timelineSectionOrderManager.move;
  const timelineSectionHoverRef = useRef(null);
  const handleTimelineSectionDragOver = (e, sectionKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const from = e.dataTransfer.getData('text/plain');
    if (from && from !== sectionKey && timelineSectionHoverRef.current !== sectionKey) {
      timelineSectionHoverRef.current = sectionKey;
      moveTimelineSectionOrder(from, sectionKey);
    }
  };
  const finishTimelineSectionDrag = () => {
    timelineSectionHoverRef.current = null;
  };

  // 학기별로 courses 그룹핑
  const coursesBySemester = (curr.courses || []).reduce((acc, c) => {
    const sem = c.semester || '기타';
    if (!acc[sem]) acc[sem] = [];
    acc[sem].push(c);
    return acc;
  }, {});
  const semesterKeys = Object.keys(coursesBySemester).sort();

  // 오늘 날짜 기반 캘린더
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = now.getDate();
  const dayNames = ['일','월','화','수','목','금','토'];

  return (
    <div className="flex gap-4 items-start">
      <div className="flex-1 min-w-0 max-w-[1100px] min-h-screen border border-surface-200 rounded-2xl overflow-hidden">
      {/* ── Dark Header with Calendar ── */}
      <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-t-2xl px-10 pt-10 pb-8">
        <div className="flex items-center gap-5 mb-8">
          {/* Profile image */}
          <div className="relative group cursor-pointer" onClick={() => profileImageInputRef.current?.click()}>
            {p.profileImageUrl ? (
              <img src={p.profileImageUrl} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-white/20 shadow-lg" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-3xl ring-4 ring-white/20 shadow-lg">
                <ImagePlus size={24} className="text-white/60" />
              </div>
            )}
            <input
              ref={profileImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const base64 = await resizeToBase64(file);
                update('profileImageUrl', base64);
              }}
            />
          </div>
          <div className="flex-1">
            <input
              value={p.headline || ''}
              onChange={e => update('headline', e.target.value)}
              placeholder="나의 대시보드 제목"
              className="w-full bg-transparent text-2xl font-bold text-white placeholder-white/30 outline-none"
            />
            <input
              value={p.userName || ''}
              onChange={e => update('userName', e.target.value)}
              placeholder="이름"
              className="w-full bg-transparent text-sm text-blue-200/70 placeholder-blue-200/30 outline-none mt-1"
            />
          </div>
          {/* Social links */}
          <div className="flex gap-2 flex-shrink-0">
            {contact.github && <span className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70">GitHub</span>}
            {contact.website && <span className="px-3 py-1 bg-white/10 rounded-lg text-xs text-white/70">Web</span>}
          </div>
        </div>

        {/* Mini calendar */}
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <p className="text-sm text-white/50 mb-3 text-center font-medium">
            {year}년 {month + 1}월
          </p>
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map(d => <div key={d} className="text-xs text-white/30 font-medium pb-1">{d}</div>)}
            {Array.from({ length: firstDay }, (_, i) => <div key={'e'+i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => (
              <div key={i} className={`text-xs py-1.5 rounded-lg ${i + 1 === today ? 'bg-purple-500 text-white font-bold' : 'text-white/40 hover:bg-white/5'}`}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content Body ── */}
      <div className="bg-white rounded-b-2xl border border-t-0 border-surface-200">
        {/* 학기별 수업 */}
        <div className="px-10 py-8 border-b border-surface-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-500 rounded-full" /> 학기별 수업
          </h2>
          {/* Semester tabs */}
          {semesterKeys.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {semesterKeys.map(s => (
                <button key={s} onClick={() => setActiveSemester(activeSemester === s ? null : s)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${activeSemester === s ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {/* Courses list */}
          {(curr.courses || []).length > 0 ? (
            <div className="space-y-2">
              {(activeSemester ? (coursesBySemester[activeSemester] || []) : curr.courses).map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                  <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{c.name || '과목명'}</span>
                    {c.semester && <span className="ml-2 text-xs text-gray-400">{c.semester}</span>}
                    {c.grade && <span className="ml-2 text-xs text-purple-600 font-medium">{c.grade}</span>}
                  </div>
                  <button onClick={() => {
                    const updated = [...curr.courses];
                    updated.splice(i, 1);
                    updateNested('curricular', 'courses', updated);
                  }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">좌측 메뉴의 '학기별 수업' 섹션에서 과목을 추가하세요</p>
          )}
        </div>

        {/* 재정렬 가능한 섹션들 */}
        <div className="flex flex-col">

        {/* 활동 기록 (경험) — Timeline style */}
        <div className="px-10 py-8 border-b border-surface-100" style={{ order: getTimelineSectionOrder('activities') }}
          onDragOver={e => handleTimelineSectionDragOver(e, 'activities')}
          onDrop={e => { e.preventDefault(); finishTimelineSectionDrag(); }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-500 rounded-full" /> 활동 기록
            </h2>
            <div className="flex items-center gap-2">
              <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'activities'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100 p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
              <div className="relative">
                <button onClick={() => setShowAddExpMenu(prev => !prev)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
                  <Plus size={14} /> 경험 추가
                </button>
              {showAddExpMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-surface-200 rounded-xl shadow-lg z-20 py-1 w-52">
                  <button onClick={() => { setShowExpPicker(true); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                    <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Database size={12} className="text-blue-600" /></span>
                    경험 DB에서 불러오기
                  </button>
                  <button onClick={() => { addToArray('experiences', { title: '', period: '', category: 'other', role: '', description: '' }); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                    <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Plus size={12} className="text-blue-600" /></span>
                    직접 작성하기
                  </button>
                </div>
              )}
              {showExpPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-surface-200 rounded-xl shadow-lg z-30 py-1 w-60 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100">
                    <span className="text-xs font-bold text-gray-700">경험 DB에서 선택</span>
                    <button onClick={() => setShowExpPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                  {userExperiences.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">등록된 경험이 없습니다</p>
                  ) : userExperiences.map(exp => (
                    <button key={exp.id} onClick={() => { importExperience(exp); setShowExpPicker(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 truncate">{exp.title}</button>
                  ))}
                </div>
              )}
            </div>{/* closes relative */}
          </div>{/* closes flex items-center gap-2 */}
          </div>{/* closes flex items-center justify-between mb-4 */}

          {(p.experiences || []).length > 0 ? (
            <div className="relative">
              <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {[...p.experiences].sort((a, b) => (b.period || '').localeCompare(a.period || '')).map((exp, i) => (
                  <div key={i} className="flex items-start gap-3 relative group">
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 mt-0.5 z-10 border-2 border-white ${
                      exp.category === 'award' ? 'bg-amber-400' : exp.category === 'study' ? 'bg-purple-400' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{exp.title || '활동명'}</p>
                      <p className="text-xs text-gray-400">{exp.period || ''} {exp.role ? `· ${exp.role}` : ''}</p>
                      {exp.description && <p className="text-xs text-gray-500 mt-1">{exp.description}</p>}
                    </div>
                    <button onClick={() => removeFromArray('experiences', i)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">경험 DB에서 활동을 가져오거나 직접 추가하세요</p>
          )}
        </div>

        {/* 스터디 계획 (goals) */}
        <div className="px-10 py-8 border-b border-surface-100" style={{ order: getTimelineSectionOrder('goals') }}
          onDragOver={e => handleTimelineSectionDragOver(e, 'goals')}
          onDrop={e => { e.preventDefault(); finishTimelineSectionDrag(); }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-emerald-500 rounded-full" /> 스터디 계획
            </h2>
            <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'goals'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100 p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(p.goals || []).map((g, i) => (
              <div key={i} className="group relative border-b border-emerald-100 py-3 last:border-b-0">
                <input
                  value={g.title || ''}
                  onChange={e => updateArrayItem('goals', i, { ...g, title: e.target.value })}
                  placeholder="계획 제목 (예: 2025년 3~6월)"
                  className="w-full bg-transparent text-sm font-bold text-emerald-800 placeholder-emerald-400 outline-none mb-1"
                />
                <textarea
                  value={g.description || ''}
                  onChange={e => updateArrayItem('goals', i, { ...g, description: e.target.value })}
                  placeholder="계획 내용"
                  rows={2}
                  className="w-full bg-transparent text-xs text-emerald-600 placeholder-emerald-300 outline-none resize-none"
                />
                <button onClick={() => removeFromArray('goals', i)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button onClick={() => addToArray('goals', { title: '', description: '' })}
              className="p-4 border-2 border-dashed border-emerald-200 rounded-xl text-emerald-400 hover:border-emerald-400 hover:text-emerald-600 flex items-center justify-center gap-2 text-sm transition-colors">
              <Plus size={16} /> 계획 추가
            </button>
          </div>
        </div>

        {/* Skills */}
        <div className="px-10 py-8 border-b border-surface-100" style={{ order: getTimelineSectionOrder('skills') }}
          onDragOver={e => handleTimelineSectionDragOver(e, 'skills')}
          onDrop={e => { e.preventDefault(); finishTimelineSectionDrag(); }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-teal-500 rounded-full" /> 기술
            </h2>
            <span draggable onDragStart={e => { e.dataTransfer.setData('text/plain', 'skills'); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.closest('div[style]').style.opacity='0.5'; }} onDragEnd={e => { e.currentTarget.closest('div[style]').style.opacity='1'; }} className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100 p-1 transition-colors" title="드래그하여 이동"><GripVertical size={14} /></span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...(skills.tools || []), ...(skills.languages || []), ...(skills.frameworks || []), ...(skills.others || [])].map((s, i) => (
              <span key={i} className="px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-200">{typeof s === 'string' ? s : s.name || s}</span>
            ))}
            {[...(skills.tools || []), ...(skills.languages || []), ...(skills.frameworks || []), ...(skills.others || [])].length === 0 && (
              <p className="text-sm text-gray-400">좌측 메뉴의 '기술' 섹션에서 기술을 추가하세요</p>
            )}
          </div>
        </div>

        </div>{/* end flex col wrapper for Timeline reorderable sections */}

        {/* Footer */}
        <div className="px-10 py-4 bg-surface-50 flex items-center justify-between text-xs text-gray-400 rounded-b-2xl">
          <span>POPOL Dashboard · {p.userName || ''}</span>
        </div>
      </div>
      </div>
      <JobAnalysisSidebar portfolio={p} update={update} updateArrayItem={updateArrayItem} analysisMode={analysisMode} onClose={() => onCloseAnalysis?.()} />
    </div>
  );
}

function EditableDataTable({ columns, rows, onColumnsChange, onRowsChange, addLabel = '행 추가' }) {
  const [draggingColumn, setDraggingColumn] = useState(null);
  const [draggingRow, setDraggingRow] = useState(null);
  const moveItem = (items, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  };
  const updateColumn = (index, label) => {
    const next = [...columns];
    next[index] = { ...next[index], label };
    onColumnsChange(next);
  };
  const removeColumn = (index) => {
    const column = columns[index];
    if (columns.length <= 1) return;
    onColumnsChange(columns.filter((_, columnIndex) => columnIndex !== index));
    onRowsChange(rows.map(row => {
      const next = { ...row };
      delete next[column.key];
      return next;
    }));
  };
  const addColumn = () => {
    const key = `custom_${Date.now()}`;
    onColumnsChange([...columns, { key, label: '새 열' }]);
  };
  const updateCell = (rowIndex, key, value) => {
    const next = [...rows];
    next[rowIndex] = { ...next[rowIndex], [key]: value };
    onRowsChange(next);
  };
  const clearCell = (rowIndex, key) => updateCell(rowIndex, key, '');

  return (
    <div className="editable-data-table group/table mb-4 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm border-collapse mb-2">
        <thead>
          <tr className="bg-surface-50/70">
            {columns.map((column, index) => (
              <th
                key={column.key}
                onDragOver={event => {
                  if (draggingColumn == null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={event => {
                  event.preventDefault();
                  const fromIndex = Number(event.dataTransfer.getData('application/x-fitpoly-table-column'));
                  if (!Number.isNaN(fromIndex)) onColumnsChange(moveItem(columns, fromIndex, index));
                  setDraggingColumn(null);
                }}
                onDragEnd={() => setDraggingColumn(null)}
                className={`group/column min-w-[120px] border-b border-r border-surface-200 px-1 py-1 text-left transition-opacity ${draggingColumn === index ? 'opacity-40' : ''}`}
              >
                <div className="flex items-center gap-1">
                  <span
                    draggable
                    onDragStart={event => {
                      setDraggingColumn(index);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('application/x-fitpoly-table-column', String(index));
                    }}
                    onDragEnd={() => setDraggingColumn(null)}
                    className="cursor-grab text-gray-300 transition-opacity hover:text-primary-500"
                    title="열 이동"
                  >
                    <GripVertical size={12} />
                  </span>
                  <input
                    value={column.label}
                    onChange={event => updateColumn(index, event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-2 py-1 font-semibold outline-none hover:bg-primary-50/30"
                  />
                  {columns.length > 1 && (
                    <button type="button" onClick={() => removeColumn(index)} className="text-gray-300 transition-opacity hover:text-red-400" title="열 삭제">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th className="w-10 border-b border-surface-200 bg-white text-center text-[10px] font-medium text-gray-300">행</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onDragOver={event => {
                if (draggingRow == null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={event => {
                event.preventDefault();
                const fromIndex = Number(event.dataTransfer.getData('application/x-fitpoly-table-row'));
                if (!Number.isNaN(fromIndex)) onRowsChange(moveItem(rows, fromIndex, rowIndex));
                setDraggingRow(null);
              }}
              className={`group/row transition-opacity ${draggingRow === rowIndex ? 'opacity-40' : ''}`}
            >
              {columns.map(column => (
                <td key={column.key} className="group/cell border-b border-r border-surface-200 px-1 py-1">
                  <div className="flex items-center gap-1">
                    <input
                      value={row[column.key] || ''}
                      onChange={event => updateCell(rowIndex, column.key, event.target.value)}
                      placeholder={column.label}
                      className="min-w-0 flex-1 rounded bg-transparent px-2 py-1 outline-none placeholder:text-gray-300 hover:bg-primary-50/30"
                    />
                    {!!row[column.key] && (
                      <button type="button" onClick={() => clearCell(rowIndex, column.key)} className="text-gray-300 opacity-0 transition-opacity hover:text-red-400 group-hover/cell:opacity-100" title="셀 내용 지우기">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </td>
              ))}
              <td className="w-10 border-b border-surface-200 bg-white px-1 py-1 text-center">
                <span
                  draggable
                  onDragStart={event => {
                    setDraggingRow(rowIndex);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('application/x-fitpoly-table-row', String(rowIndex));
                  }}
                  onDragEnd={() => setDraggingRow(null)}
                  className="inline-flex cursor-grab text-gray-300 transition-opacity hover:text-primary-500"
                  title="행 이동"
                >
                  <GripVertical size={12} />
                </span>
                <button type="button" onClick={() => onRowsChange(rows.filter((_, index) => index !== rowIndex))} className="text-gray-300 transition-opacity hover:text-red-400" title="행 삭제">
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onRowsChange([...rows, {}])} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600">
          <Plus size={12} /> {addLabel}
        </button>
        <button type="button" onClick={addColumn} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600">
          <Plus size={12} /> 열 추가
        </button>
      </div>
    </div>
  );
}

/* ── Notion Visual Editor (기존 3컬럼) ── */
function NotionVisualEditor({ portfolio, update, updateNested, addToArray, removeFromArray, updateArrayItem, userId, portfolioId, templateId, userExperiences, importExperience, analysisMode, onCloseAnalysis }) {
  const p = portfolio;
  const contact = p.contact || {};
  const skills = p.skills || {};
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};
  const customIcons = p.customSectionIcons || {};
  const updateIcon = (key, icon) => update('customSectionIcons', { ...(p.customSectionIcons || {}), [key]: icon });
  const tableColumns = p.tableColumns || {};
  const curricularCourseColumns = tableColumns.curricularCourses || [
    { key: 'semester', label: '학기', required: true },
    { key: 'name', label: '과목명', required: true },
    { key: 'grade', label: '성적', required: true },
  ];
  const curricularCreditColumns = tableColumns.curricularCredits || [
    { key: 'category', label: '구분', required: true },
    { key: 'area', label: '영역', required: true },
    { key: 'required', label: '기준 학점', required: true },
    { key: 'earned', label: '취득 학점', required: true },
    { key: 'remaining', label: '잔여 학점', required: true },
    { key: 'rate', label: '달성률', required: true },
  ];
  const extracurricularLanguageColumns = tableColumns.extracurricularLanguages || [
    { key: 'name', label: '시험명', required: true },
    { key: 'score', label: '점수/등급', required: true },
    { key: 'date', label: '취득일', required: true },
  ];
  const extracurricularBadgeColumns = tableColumns.extracurricularBadges || [
    { key: 'name', label: '배지명', required: true },
    { key: 'issuer', label: '발급 기관', required: true },
  ];
  const updateTableColumns = (key, columns) => update('tableColumns', { ...tableColumns, [key]: columns });
  const [hoveredSection, setHoveredSection] = useState(null);
  const [showCustomBlockMenu, setShowCustomBlockMenu] = useState(false);
  const [showAddBlockMenu, setShowAddBlockMenu] = useState(false);
  const [sectionDragging, setSectionDragging] = useState(null);
  const [sectionDropTarget, setSectionDropTarget] = useState(null);
  const sectionHoverTargetRef = useRef(null);
  const [blockDragging, setBlockDragging] = useState(null);
  const [blockDropTarget, setBlockDropTarget] = useState(null);
  const [contentBlockDragging, setContentBlockDragging] = useState(null);
  const [contentBlockDropTarget, setContentBlockDropTarget] = useState(null);
  const profileImageInputRef = useRef(null);

  useDragEdgeAutoScroll(sectionDragging !== null);

  // 섹션 이름 편집 헬퍼
  const EditableTitle = ({ sectionKey, defaultLabel, className = '' }) => (
    <EditableSectionTitle portfolio={p} update={update} sectionKey={sectionKey} defaultLabel={defaultLabel} className={className} />
  );

  // 경험 상세 모달
  const [expDetailIdx, setExpDetailIdx] = useState(null);

  // 프로젝트 블록 DB 불러오기 피커
  const [projectBlockPickerIdx, setProjectBlockPickerIdx] = useState(null);
  const [addCardMenuIdx, setAddCardMenuIdx] = useState(null);

  // 경험 추가 드롭다운
  const [showExpPicker, setShowExpPicker] = useState(false);
  const [showAddExpMenu, setShowAddExpMenu] = useState(false);

  // 기업 분석 관련 state
  const [jobUrl, setJobUrl] = useState('');
  const [analyzingJob, setAnalyzingJob] = useState(false);
  const [jobError, setJobError] = useState(null);
  const [showJobInput, setShowJobInput] = useState(false);

  // 기업 맞춤 경험 추천 (visual mode)
  const [recLoading, setRecLoading] = useState(false);
  const [recResults, setRecResults] = useState(null);

  const fetchVisualRecommendations = async () => {
    if (!portfolio.jobAnalysis) { toast.error('연결된 기업 공고가 없습니다'); return; }
    setRecLoading(true);
    try {
      const { data } = await api.post('/job/recommend-experiences', { jobAnalysis: portfolio.jobAnalysis });
      setRecResults(data);
    } catch { toast.error('경험 추천 분석에 실패했습니다'); }
    setRecLoading(false);
  };

  const handleJobAnalyze = async () => {
    if (!jobUrl.trim()) return;
    setAnalyzingJob(true);
    setJobError(null);
    try {
      const { data: respData } = await api.post('/job/analyze', { url: jobUrl.trim() });
      update('jobAnalysis', respData.analysis);
      setShowJobInput(false);
      setJobUrl('');
      toast.success('기업 분석이 완료되었습니다');
    } catch (err) {
      setJobError(err.response?.data?.error || '분석에 실패했습니다');
    }
    setAnalyzingJob(false);
  };

  const resizeToBase64 = (file, maxPx = 800, quality = 0.8) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new window.Image();
        img.onload = () => {
          const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await resizeToBase64(file, 400, 0.7);
      update('profileImageUrl', base64);
      toast.success('프로필 이미지가 업데이트되었습니다');
    } catch { toast.error('이미지 처리 실패'); }
  };

  const updateSkillCategory = (category, value) => {
    update('skills', { ...skills, [category]: value });
  };

  const SECTION_MAP = {
    ashley: ['profile', 'education', 'experiences', 'interviews', 'books', 'lectures', 'skills', 'values', 'funfacts', 'contact'],
    academic: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
    notion: ['profile', 'education', 'awards', 'experiences', 'curricular', 'extracurricular', 'skills', 'goals', 'values', 'contact'],
  };
  const sections = [...new Set([...(SECTION_MAP[templateId] || SECTION_MAP.notion), ...(p.sections || [])])];
  const hiddenSections = p.hiddenSections || [];

  const sectionOrderManager = makeSectionOrderManager('notion', p.sectionOrder, update);
  const getSectionOrder = sectionOrderManager.getOrder;
  const moveSectionOrder = sectionOrderManager.move;
  const getSectionDndProps = (sectionKey) => ({
    style: { order: getSectionOrder(sectionKey) },
    onDragOver: (e) => {
      if (!sectionDragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setSectionDropTarget(sectionKey);
      if (sectionDragging !== sectionKey && sectionHoverTargetRef.current !== sectionKey) {
        sectionHoverTargetRef.current = sectionKey;
        moveSectionOrder(sectionDragging, sectionKey);
      }
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget) && sectionDropTarget === sectionKey) {
        setSectionDropTarget(null);
      }
    },
    onDrop: (e) => {
      e.preventDefault();
      setSectionDragging(null);
      setSectionDropTarget(null);
      sectionHoverTargetRef.current = null;
    },
    className: `rounded-xl transition-[transform,opacity,box-shadow,background-color] duration-200 ease-out ${sectionDragging === sectionKey ? 'opacity-45 scale-[0.985]' : ''} ${sectionDropTarget === sectionKey && sectionDragging !== sectionKey ? 'translate-y-0 ring-2 ring-primary-200 bg-primary-50/30 shadow-sm' : ''}`,
  });
  const getSectionHandleProps = (sectionKey, label) => ({
    draggable: true,
    onDragStart: (e) => {
      setSectionDragging(sectionKey);
      e.dataTransfer.setData('application/x-fitpoly-section', sectionKey);
      e.dataTransfer.setData('text/plain', sectionKey);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(createDragPreview(label || sectionKey), 16, 16);
    },
    onDragEnd: () => {
      setSectionDragging(null);
      setSectionDropTarget(null);
      sectionHoverTargetRef.current = null;
    },
  });
  const getCustomBlockDndProps = (index, block) => ({
    draggable: true,
    onDragStart: (event) => {
      if (shouldIgnoreBlockDrag(event.target)) {
        event.preventDefault();
        return;
      }
      startCustomBlockDrag(event, index, getCustomBlockLabel(block, index), setBlockDragging);
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setBlockDropTarget(index);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget) && blockDropTarget === index) setBlockDropTarget(null);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      const from = parseInt(e.dataTransfer.getData('application/x-fitpoly-custom-block') || e.dataTransfer.getData('blockIdx'), 10);
      if (!isNaN(from) && from !== index) {
        // 화면은 CSS order로 정렬되므로 드롭한 블록의 order를 대상 위치로 옮긴다
        const band = buildBand();
        const tPos = band.findIndex(it => it.kind === 'block' && it.idx === index);
        const targetOrder = getCustomBlockOrder(index);
        const above = tPos > 0 ? band[tPos - 1] : null;
        const newOrder = above ? (above.order + targetOrder) / 2 : targetOrder - 1;
        const blocks = [...(p.customBlocks || [])];
        blocks[from] = { ...blocks[from], order: newOrder };
        update('customBlocks', blocks);
      }
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
    onDragEnd: () => {
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
    className: `group/cb relative transition-all duration-150 rounded-xl cursor-grab active:cursor-grabbing ${blockDragging === index ? 'opacity-45 scale-[0.99]' : ''} ${blockDropTarget === index && blockDragging !== index ? 'ring-2 ring-primary-200 bg-primary-50/30' : ''}`,
  });
  const getCustomBlockHandleProps = (index, label) => ({
    draggable: true,
    onDragStart: (e) => {
      e.stopPropagation();
      startCustomBlockDrag(e, index, label || getCustomBlockLabel((p.customBlocks || [])[index], index), setBlockDragging);
    },
    onDragEnd: () => {
      setBlockDragging(null);
      setBlockDropTarget(null);
    },
  });
  const sectionHandleClass = 'cursor-grab active:cursor-grabbing inline-flex items-center justify-center rounded-md border border-primary-100 bg-primary-50 text-primary-600 hover:bg-primary-100 hover:text-primary-700 p-1 transition-colors';
  const hiddenSectionKey = (key) => {
    if (!hiddenSections.includes(key)) update('hiddenSections', [...hiddenSections, key]);
  };
  const removeEmbeddedCustomImage = ({ sourceIndex, src }) => {
    const blocks = [...(p.customBlocks || [])];
    if (blocks[sourceIndex]?.type !== 'image' || blocks[sourceIndex]?.content !== src) return;
    blocks.splice(sourceIndex, 1);
    update('customBlocks', blocks);
  };
  const moveContentBlock = (sectionKey, fromKey, toKey, defaultOrder) => {
    if (fromKey === toKey) return;
    const saved = p.contentBlockOrder?.[sectionKey];
    const current = Array.isArray(saved)
      ? [...saved.filter(key => defaultOrder.includes(key)), ...defaultOrder.filter(key => !saved.includes(key))]
      : [...defaultOrder];
    const fromIndex = current.indexOf(fromKey);
    const toIndex = current.indexOf(toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    update('contentBlockOrder', { ...(p.contentBlockOrder || {}), [sectionKey]: current });
  };
  const InlineContentBlock = ({ sectionKey, blockKey, defaultOrder, children }) => {
    const saved = p.contentBlockOrder?.[sectionKey];
    const ordered = Array.isArray(saved)
      ? [...saved.filter(key => defaultOrder.includes(key)), ...defaultOrder.filter(key => !saved.includes(key))]
      : defaultOrder;
    const dragKey = `${sectionKey}:${blockKey}`;
    return (
      <div
        style={{ order: ordered.indexOf(blockKey) }}
        onDragOver={event => {
          if (!contentBlockDragging?.startsWith(`${sectionKey}:`)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          setContentBlockDropTarget(dragKey);
        }}
        onDrop={event => {
          if (!contentBlockDragging?.startsWith(`${sectionKey}:`)) return;
          event.preventDefault();
          event.stopPropagation();
          moveContentBlock(sectionKey, contentBlockDragging.split(':')[1], blockKey, defaultOrder);
          setContentBlockDragging(null);
          setContentBlockDropTarget(null);
        }}
        className={`group/content-block relative transition-all ${contentBlockDragging === dragKey ? 'opacity-40' : ''} ${contentBlockDropTarget === dragKey && contentBlockDragging !== dragKey ? 'bg-primary-50/30' : ''}`}
      >
        <span
          draggable
          onDragStart={event => {
            event.stopPropagation();
            setContentBlockDragging(dragKey);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-fitpoly-content-block', dragKey);
          }}
          onDragEnd={() => {
            setContentBlockDragging(null);
            setContentBlockDropTarget(null);
          }}
          className="absolute -left-6 top-1 inline-flex cursor-grab text-gray-300 opacity-0 transition-opacity hover:text-primary-500 group-hover/content-block:opacity-100"
          title="본문 블록 드래그 이동"
        >
          <GripVertical size={14} />
        </span>
        {children}
      </div>
    );
  };

  // ── 자유 블록을 고정 섹션 사이에 끼워넣기 위한 순서(order) 관리 ──
  // 재정렬 가능한 섹션은 order 0..N, 자유 블록은 숫자 order를 받아 그 사이에 위치.
  const reorderableBandKeys = ['curricular', 'extracurricular', 'skills', 'goals', 'values'];
  const getCustomBlockOrder = (idx) => {
    const block = (p.customBlocks || [])[idx];
    return typeof block?.order === 'number' ? block.order : reorderableBandKeys.length + idx;
  };
  // 밴드(재정렬 섹션 + 자유 블록)를 화면 순서대로 정렬한 목록
  const buildBand = () => {
    const items = [];
    reorderableBandKeys.forEach(key => {
      if (hiddenSections.includes(key) || !sections.includes(key)) return;
      items.push({ kind: 'section', key, order: getSectionOrder(key) });
    });
    (p.customBlocks || []).forEach((_, idx) => items.push({ kind: 'block', idx, order: getCustomBlockOrder(idx) }));
    return items.sort((a, b) => a.order - b.order);
  };
  // 자유 블록을 위(-1)/아래(+1)로 한 칸 이동 — 섹션 order는 건드리지 않고 블록 order만 중간값으로 조정
  const moveCustomBlock = (idx, dir) => {
    const band = buildBand();
    const pos = band.findIndex(it => it.kind === 'block' && it.idx === idx);
    if (pos < 0) return;
    let newOrder;
    if (dir < 0) {
      if (pos === 0) return;
      const above = band[pos - 1];
      const aboveAbove = band[pos - 2];
      newOrder = aboveAbove ? (aboveAbove.order + above.order) / 2 : above.order - 1;
    } else {
      if (pos === band.length - 1) return;
      const below = band[pos + 1];
      const belowBelow = band[pos + 2];
      newOrder = belowBelow ? (below.order + belowBelow.order) / 2 : below.order + 1;
    }
    const blocks = [...(p.customBlocks || [])];
    blocks[idx] = { ...blocks[idx], order: newOrder };
    update('customBlocks', blocks);
  };
  // 새 블록은 밴드 맨 아래에 추가
  const nextBlockOrder = () => buildBand().reduce((max, it) => Math.max(max, it.order), reorderableBandKeys.length - 1) + 1;
  const addSectionPackage = (sectionKey) => {
    const startOrder = nextBlockOrder();
    update('customBlocks', [...(p.customBlocks || []), ...makeSectionPackageBlocks(sectionKey, startOrder)]);
    if (!sections.includes(sectionKey)) update('sections', [...sections, sectionKey]);
    update('hiddenSections', (p.hiddenSections || []).filter(key => key !== sectionKey));
    if (sectionKey === 'profile') update('profileVisible', true);
    if (sectionKey === 'education' && !(p.education || []).length) update('education', [{ name: '', period: '', degree: '', detail: '' }]);
    if (sectionKey === 'awards' && !(p.awards || []).length) update('awards', [{ date: '', title: '', organization: '', description: '' }]);
    if (sectionKey === 'experiences' && !(p.experiences || []).length) update('experiences', [{ date: '', title: '', organization: '', description: '', content: '' }]);
    if (sectionKey === 'curricular') {
      update('curricular', {
        ...curr,
        summary: curr.summary || { credits: '', gpa: '', note: '' },
        courses: (curr.courses || []).length ? curr.courses : [{ semester: '', name: '', grade: '' }],
        creditStatus: (curr.creditStatus || []).length ? curr.creditStatus : [{ category: '', area: '', required: '', earned: '', remaining: '', rate: '' }],
      });
    }
    if (sectionKey === 'extracurricular') {
      update('extracurricular', {
        ...extra,
        summary: extra.summary || '',
        badges: (extra.badges || []).length ? extra.badges : [{ name: '', issuer: '' }],
        languages: (extra.languages || []).length ? extra.languages : [{ name: '', score: '', date: '' }],
        details: (extra.details || []).length ? extra.details : [{ title: '', period: '', description: '' }],
      });
    }
    if (sectionKey === 'skills') update('skills', { ...skills, tools: skills.tools || [], languages: skills.languages || [], frameworks: skills.frameworks || [], others: (skills.others || []).length ? skills.others : [''] });
    if (sectionKey === 'goals' && !(p.goals || []).length) update('goals', [{ title: '', description: '', type: 'short', status: 'planned' }]);
    if (sectionKey === 'values' && !p.valuesEssay && !p.valuesEssayBlocks) update('valuesEssay', '');
    if (sectionKey === 'interests' && !(p.interests || []).length) update('interests', ['']);
    if (sectionKey === 'contact') update('contact', { phone: '', email: '', linkedin: '', instagram: '', github: '', website: '', ...(p.contact || {}) });
    setShowAddBlockMenu(false);
  };

  return (
    <div className="flex gap-4 items-start">
      {/* ── 사이드바 왼쪽 (Notion) [비활성화] ── */}
      {false && (
      <div className="w-[360px] flex-shrink-0">
        <div className="sticky top-5">
          <div className="flex items-center gap-2 mb-3 px-1">
            <h3 className="text-sm font-bold text-gray-800">기업 분석</h3>
          </div>
          {p.jobAnalysis ? (
            <div className="space-y-3">
              <JobAnalysisBadge
                analysis={p.jobAnalysis}
                onRemove={() => update('jobAnalysis', null)}
                experiences={p.experiences || []}
                onTailorApply={(expIdx, sectionKey, content) => {
                  const updated = { ...p.experiences[expIdx] };
                  updated.structuredResult = { ...(updated.structuredResult || {}), [sectionKey]: content };
                  updateArrayItem('experiences', expIdx, updated);
                }}
              />
              {!showJobInput ? (
                <button
                  onClick={() => setShowJobInput(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-xl bg-white hover:bg-blue-50 transition-colors font-medium"
                >
                  <Globe size={13} /> 다른 공고로 변경
                </button>
              ) : (
                <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-3 shadow-sm">
                  <p className="text-xs font-semibold text-blue-700">새 채용공고로 변경</p>
                  <div className="relative">
                    <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      value={jobUrl}
                      onChange={e => setJobUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                      placeholder="https:// 채용공고 링크"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  {jobError && <p className="text-xs text-red-500 flex items-center gap-1"><X size={12} />{jobError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleJobAnalyze} disabled={analyzingJob || !jobUrl.trim()}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {analyzingJob ? <><Loader2 size={14} className="animate-spin" />분석 중...</> : <>분석하기</>}
                    </button>
                    <button onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                      className="px-4 py-2.5 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded-xl transition-colors">취소</button>
                  </div>
                </div>
              )}
            </div>
          ) : !showJobInput ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <p className="text-sm font-bold text-blue-900">채용공고 분석</p>
                  <p className="text-xs text-blue-500">기업·직무·전략을 한눈에</p>
                </div>
              </div>
              <p className="text-xs text-blue-600 leading-relaxed mb-4">
                지원할 기업의 채용공고 URL을 입력하면 기업 분석, 직무 분석, 지원 전략, 산업 트렌드를 자동 정리합니다.
              </p>
              <button
                onClick={() => setShowJobInput(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                채용공고 분석하기
              </button>
            </div>
          ) : (
            <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe size={14} className="text-blue-500" />
                <p className="text-sm font-semibold text-blue-800">채용공고 URL 입력</p>
              </div>
              <div className="relative">
                <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={jobUrl}
                  onChange={e => setJobUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJobAnalyze()}
                  placeholder="https:// 채용공고 링크를 붙여넣으세요"
                  className="w-full pl-9 pr-3 py-3 text-sm border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              {jobError && <p className="text-sm text-red-500 flex items-center gap-1.5"><X size={13} />{jobError}</p>}
              <div className="flex gap-2">
                <button onClick={handleJobAnalyze} disabled={analyzingJob || !jobUrl.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {analyzingJob ? <><Loader2 size={15} className="animate-spin" />분석 중...</> : <>분석하기</>}
                </button>
                <button onClick={() => { setShowJobInput(false); setJobUrl(''); setJobError(null); }}
                  className="px-4 py-3 text-gray-500 hover:text-gray-700 text-sm border border-gray-200 rounded-xl transition-colors">취소</button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}{/* end 사이드바 왼쪽 (Notion) */}

      {/* ── 포트폴리오 카드 ── */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
      {/* Editable Header */}
      <div className="px-10 pt-10 pb-6 border-b border-surface-100 group relative">
        <input
          value={p.headline || ''}
          onChange={e => update('headline', e.target.value)}
          placeholder="포트폴리오 타이틀을 입력하세요"
          className="w-full text-3xl font-bold text-gray-900 outline-none placeholder:text-gray-300 bg-transparent"
        />
        <p className="text-xs text-gray-400 mt-1">본 포트폴리오는 PC 환경에 최적화되어 있습니다.</p>
      </div>

      {/* Quick Menu */}
      <div className="px-10 py-4 border-b border-surface-100 flex gap-3 overflow-x-auto">
        {['교과 활동', '비교과 활동', '기술', '목표와 계획', '가치관'].filter(menu => {
          const sectionMap = { '교과 활동': 'curricular', '비교과 활동': 'extracurricular', '기술': 'skills', '목표와 계획': 'goals', '가치관': 'values' };
          return sections.includes(sectionMap[menu]) && !hiddenSections.includes(sectionMap[menu]);
        }).map(menu => (
          <a key={menu} href={`#editor-section-${menu}`}
            className="px-4 py-2 bg-surface-50 hover:bg-surface-100 rounded-lg text-sm text-gray-600 font-medium whitespace-nowrap transition-colors">
            {menu}
          </a>
        ))}
      </div>

      {/* Three-column layout (Notion style) */}
      <div className="grid grid-cols-[260px_1fr_300px] min-h-[600px]">

        {/* ── Left: Profile ── */}
        <div className="p-6 border-r border-surface-100 bg-[#fafaf8]">
          <EditableTitle sectionKey="profile" defaultLabel="PROFILE" className="text-xs font-bold text-gray-400 tracking-wider mb-4 border-l-2 border-primary-600 pl-2 block w-full" />

          {/* Profile Image - clickable */}
          <input type="file" ref={profileImageInputRef} accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
          <button onClick={() => profileImageInputRef.current?.click()}
            className="w-full aspect-square rounded-xl mb-4 overflow-hidden border-2 border-dashed border-transparent hover:border-primary-300 transition-colors relative group">
            {p.profileImageUrl ? (
              <img src={p.profileImageUrl} alt="profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-emerald-50 flex flex-col items-center justify-center gap-2">
                <ImageIcon size={28} className="text-gray-300" />
                <span className="text-xs text-gray-400">클릭하여 사진 추가</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload size={20} className="text-white" />
            </div>
          </button>

          {/* Name - inline editable */}
          <input value={p.userName || ''} onChange={e => update('userName', e.target.value)}
            placeholder="이름" className="w-full text-lg font-bold outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 transition-colors" />
          <input value={p.nameEn || ''} onChange={e => update('nameEn', e.target.value)}
            placeholder="English Name" className="w-full text-sm text-gray-500 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 mt-1 transition-colors" />
          <div className="flex items-center gap-1 mt-2">
            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
            <input value={p.location || ''} onChange={e => update('location', e.target.value)}
              placeholder="위치" className="flex-1 text-sm text-gray-500 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 transition-colors" />
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Calendar size={12} className="text-gray-400 flex-shrink-0" />
            <input value={p.birthDate || ''} onChange={e => update('birthDate', e.target.value)}
              placeholder="생년월일" className="flex-1 text-sm text-gray-500 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 transition-colors" />
          </div>

          {/* Values */}
          <div className="mt-6">
            <EditableTitle sectionKey="profileValues" defaultLabel="My Own Values" className="text-sm font-bold italic mb-3 block w-full" />
            <div className="space-y-2">
              {(p.values || []).map((v, i) => (
                <div key={i} className="p-2 bg-white rounded-lg border border-surface-100 group/val flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2"></span>
                  <input value={v.keyword || ''} onChange={e => updateArrayItem('values', i, { keyword: e.target.value })}
                    className="flex-1 text-sm font-medium text-gray-700 outline-none bg-transparent" placeholder="가치 키워드" />
                  <button onClick={() => removeFromArray('values', i)} className="text-gray-300 hover:text-red-400 transition-opacity">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={() => addToArray('values', { keyword: '' })}
                className="w-full text-center py-1.5 text-xs text-gray-400 hover:text-primary-600 hover:bg-primary-50/30 rounded-lg border border-dashed border-surface-200 transition-colors">
                <Plus size={12} className="inline mr-1" />가치 추가
              </button>
            </div>
          </div>
        </div>

        {/* ── Center ── */}
        <div className="p-6">
          {/* Education */}
          {sections.includes('education') && (
            <div className="mb-8 group/sec" onMouseEnter={() => setHoveredSection('edu')} onMouseLeave={() => setHoveredSection(null)}>
              <div className="flex items-center justify-between mb-4">
                <EditableTitle sectionKey="education" defaultLabel="Education" className="text-lg font-bold flex items-center gap-2" />
                <VisualSectionRecommend sectionType="education" jobAnalysis={portfolio.jobAnalysis} />
              </div>
              <div className="space-y-4">
                {(p.education || []).map((edu, i) => (
                  <div key={i} className="pb-4 border-b border-surface-100 last:border-0 group/item relative">
                    <button onClick={() => removeFromArray('education', i)}
                      className="absolute -right-2 -top-1 p-1 text-gray-300 hover:text-red-400 transition-opacity"><Trash2 size={12} /></button>
                    <input value={edu.name || ''} onChange={e => updateArrayItem('education', i, { name: e.target.value })}
                      placeholder="학교명" className="w-full text-base font-bold text-gray-900 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
                    <input value={edu.period || ''} onChange={e => updateArrayItem('education', i, { period: e.target.value })}
                      placeholder="기간" className="w-full text-sm text-gray-400 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 mt-1" />
                    <input value={edu.degree || ''} onChange={e => updateArrayItem('education', i, { degree: e.target.value })}
                      placeholder="학위 · 전공" className="w-full text-sm text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 mt-1" />
                    <input value={edu.detail || ''} onChange={e => updateArrayItem('education', i, { detail: e.target.value })}
                      placeholder="상세 내용" className="w-full text-sm text-gray-500 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 mt-1" />
                  </div>
                ))}
              </div>
              <button onClick={() => addToArray('education', { name: '', period: '', degree: '', detail: '' })}
                className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors">
                <Plus size={12} /> 학력 추가
              </button>
            </div>
          )}

          {/* Interests */}
          <div className="mb-8">
            <EditableTitle sectionKey="interests" defaultLabel="Interest" className="text-lg font-bold mb-3 flex items-center gap-2" />
            <div className="space-y-1.5">
              {(p.interests || []).map((interest, i) => (
                <div key={i} className="flex items-start gap-2 group/int">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <input value={interest || ''} onChange={e => updateArrayItem('interests', i, e.target.value)}
                    placeholder="관심사" className="flex-1 text-sm text-gray-700 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
                  <button onClick={() => removeFromArray('interests', i)} className="text-gray-300 hover:text-red-400"><X size={12} /></button>
                </div>
              ))}
              <button onClick={() => addToArray('interests', '')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors">
                <Plus size={12} /> 관심사 추가
              </button>
            </div>
          </div>

          {/* Contact */}
          <div className="mb-8">
            <EditableTitle sectionKey="contact" defaultLabel="Contact" className="text-lg font-bold mb-3 flex items-center gap-2" />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><EditableIcon value={customIcons.contactPhone || 'phone'} onChange={icon => updateIcon('contactPhone', icon)} />
                <input value={contact.phone || ''} onChange={e => updateNested('contact', 'phone', e.target.value)}
                  placeholder="전화번호" className="flex-1 text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
              </div>
              <div className="flex items-center gap-2"><EditableIcon value={customIcons.contactEmail || 'mail'} onChange={icon => updateIcon('contactEmail', icon)} />
                <input value={contact.email || ''} onChange={e => updateNested('contact', 'email', e.target.value)}
                  placeholder="이메일" className="flex-1 text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
              </div>
              <div className="flex items-center gap-2"><EditableIcon value={customIcons.contactLinkedin || 'globe'} onChange={icon => updateIcon('contactLinkedin', icon)} />
                <input value={contact.linkedin || ''} onChange={e => updateNested('contact', 'linkedin', e.target.value)}
                  placeholder="LinkedIn" className="flex-1 text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
              </div>
              <div className="flex items-center gap-2"><EditableIcon value={customIcons.contactInstagram || 'globe'} onChange={icon => updateIcon('contactInstagram', icon)} />
                <input value={contact.instagram || ''} onChange={e => updateNested('contact', 'instagram', e.target.value)}
                  placeholder="Instagram" className="flex-1 text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
              </div>
              <div className="flex items-center gap-2"><EditableIcon value={customIcons.contactGithub || 'globe'} onChange={icon => updateIcon('contactGithub', icon)} />
                <input value={contact.github || ''} onChange={e => updateNested('contact', 'github', e.target.value)}
                  placeholder="GitHub" className="flex-1 text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
              </div>
              <div className="flex items-center gap-2"><EditableIcon value={customIcons.contactWebsite || 'globe'} onChange={icon => updateIcon('contactWebsite', icon)} />
                <input value={contact.website || ''} onChange={e => updateNested('contact', 'website', e.target.value)}
                  placeholder="웹사이트" className="flex-1 text-gray-600 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Awards & Experience Summary ── */}
        <div className="p-6 border-l border-surface-100 bg-[#fafaf8]">
          {/* Awards */}
          {sections.includes('awards') && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <EditableTitle sectionKey="awards" defaultLabel="Awards" className="text-sm font-bold flex items-center gap-2" />
                <VisualSectionRecommend sectionType="awards" jobAnalysis={portfolio.jobAnalysis} />
              </div>
              <div className="space-y-2">
                {(p.awards || []).map((a, i) => (
                  <div key={i} className="text-sm group/aw flex items-start gap-1">
                    <input value={a.date || ''} onChange={e => updateArrayItem('awards', i, { date: e.target.value })}
                      placeholder="날짜" className="w-20 font-semibold text-gray-600 underline outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-0.5" />
                    <input value={a.title || ''} onChange={e => updateArrayItem('awards', i, { title: e.target.value })}
                      placeholder="수상명" className="flex-1 text-gray-700 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-0.5" />
                    <button onClick={() => removeFromArray('awards', i)} className="text-gray-300 hover:text-red-400"><X size={10} /></button>
                  </div>
                ))}
                <button onClick={() => addToArray('awards', { date: '', title: '', detail: '' })}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600"><Plus size={12} /> 수상 추가</button>
              </div>
            </div>
          )}

          {/* Experiences Summary */}
          <div>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">Experiences</h3>
            <div className="space-y-1.5">
              {(p.experiences || []).slice(0, 5).map((e, i) => (
                <div key={i} className="text-sm text-gray-700">
                  <span className="font-semibold text-gray-600 underline">{e.date}</span>{' '}{e.title}
                </div>
              ))}
              {(p.experiences || []).length === 0 && <p className="text-xs text-gray-400">아래 갤러리에서 경험을 추가하세요</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Experience Gallery (editable) ── */}
      {sections.includes('experiences') && (
      <div className="px-10 py-8 border-t border-surface-100">
        <div className="flex items-center justify-between mb-4">
          <EditableTitle sectionKey="experiences" defaultLabel="프로젝트 / 경험" className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block" />
          <div className="flex items-center gap-2">
            <VisualSectionRecommend sectionType="experiences" jobAnalysis={portfolio.jobAnalysis} />
            {/* 기업 맞춤 경험 추천 */}
            {portfolio.jobAnalysis && (
              <button onClick={fetchVisualRecommendations} disabled={recLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors font-medium">
                {recLoading ? <><Loader2 size={12} className="animate-spin" /> 분석 중...</> : <>기업 맞춤 경험 추천</>}
              </button>
            )}
            {userExperiences.length > 0 && (
              <div className="relative">
                <button onClick={() => setShowCustomBlockMenu(prev => !prev)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">
                  경험 DB에서 불러오기
                </button>
                {showCustomBlockMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 w-64 max-h-48 overflow-y-auto">
                    {userExperiences.map(exp => (
                      <button key={exp.id} onClick={() => { importExperience(exp); setShowCustomBlockMenu(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 truncate">
                        {exp.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 기업 맞춤 경험 추천 결과 */}
        {recResults && (
          <div className="mb-4 border border-indigo-100 rounded-xl bg-indigo-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700">{portfolio.jobAnalysis?.company} 맞춤 추천 경험</span>
              </div>
              <button onClick={() => setRecResults(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
            {(recResults.keywords || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {recResults.keywords.map((kw, i) => (
                  <span key={i} className="px-2 py-1 bg-white rounded-lg border border-indigo-200 text-xs">
                    <span className="font-bold text-indigo-700">{kw.keyword}</span>
                    <span className="text-gray-500 ml-1">{kw.description}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {(recResults.recommendations || []).map((rec, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-indigo-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{rec.experience?.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rec.reason}</p>
                    <div className="flex gap-1 mt-1">
                      {(rec.matchedKeywords || []).map((k, ki) => (
                        <span key={ki} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[12px] font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => {
                    const exp = userExperiences.find(e => e.id === rec.experience?.id);
                    if (exp) importExperience(exp);
                    else toast.error('경험 데이터를 찾을 수 없습니다');
                  }}
                    className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
                    추가
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(p.experiences || []).map((exp, i) => (
            <div key={i} onClick={() => setExpDetailIdx(i)} className="group/exp bg-white rounded-xl border border-surface-200 overflow-hidden relative hover:shadow-md transition-all cursor-pointer">
              {/* Thumbnail */}
              <div className="aspect-[4/3] bg-surface-50 overflow-hidden relative">
                <img src={exp.thumbnailUrl || DEFAULT_PROJECT_LOGO} alt={exp.title || ''} className="w-full h-full object-cover" />
              </div>
              {/* Card body inline edit */}
              <div className="p-3">
                <input value={exp.title || ''} onChange={e => updateArrayItem('experiences', i, { title: e.target.value })}
                  placeholder="제목" className="w-full text-sm font-bold text-gray-800 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded" />
                <input value={exp.date || ''} onChange={e => updateArrayItem('experiences', i, { date: e.target.value })}
                  placeholder="날짜" className="w-full text-[13px] text-gray-500 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded mt-1" />
              </div>
              {/* Delete button */}
              <label onClick={e => e.stopPropagation()}
                className="absolute top-1.5 right-8 bg-white/80 p-1 rounded-full text-gray-400 hover:text-gray-700 transition-opacity shadow-sm cursor-pointer">
                <Camera size={12} />
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const base64 = await resizeToBase64(file, 800, 0.8);
                    updateArrayItem('experiences', i, { thumbnailUrl: base64 });
                  } catch { toast.error('이미지 처리 실패'); }
                  e.target.value = '';
                }} />
              </label>
              <button onClick={() => removeFromArray('experiences', i)}
                className="absolute top-1.5 right-1.5 bg-white/80 p-1 rounded-full text-gray-400 hover:text-red-500 transition-opacity shadow-sm">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {/* Add new experience card */}
            <div className="relative aspect-[4/3]">
              <button onClick={() => setShowAddExpMenu(prev => !prev)}
                className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-200 text-gray-300 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Plus size={22} /><span className="text-xs">경험 추가</span>
              </button>
              {showAddExpMenu && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-surface-200 rounded-xl shadow-lg z-20 py-1 w-52">
                  <button onClick={() => { setShowExpPicker(true); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                    <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Database size={12} className="text-blue-600" /></span>
                    경험 DB에서 불러오기
                  </button>
                  <button onClick={() => { addToArray('experiences', { date: '', title: '', description: '', status: 'finished', classify: [], skills: [], role: '', link: '', sections: [], thumbnailUrl: '' }); setShowAddExpMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                    <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Plus size={12} className="text-blue-600" /></span>
                    직접 작성하기
                  </button>
                </div>
              )}
              {showExpPicker && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-surface-200 rounded-xl shadow-lg z-30 py-1 w-60 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100">
                    <span className="text-xs font-bold text-gray-700">경험 DB에서 선택</span>
                    <button onClick={() => setShowExpPicker(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                  {userExperiences.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">등록된 경험이 없습니다</p>
                  ) : userExperiences.map(exp => (
                    <button key={exp.id} onClick={() => { importExperience(exp); setShowExpPicker(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-gray-700 truncate">{exp.title}</button>
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>
      )}

      {/* ── 경험 상세 모달 (공통: 일반 experiences 배열 + project 블록 카드) ── */}
      {expDetailIdx !== null && (() => {
        const isBlockCard = typeof expDetailIdx === 'object' && expDetailIdx !== null;
        let exp, onUpdate;
        if (isBlockCard) {
          const { blockIdx, cardIdx } = expDetailIdx;
          const cards = Array.isArray(p.customBlocks?.[blockIdx]?.content) ? p.customBlocks[blockIdx].content : [];
          exp = cards[cardIdx];
          onUpdate = (changes) => {
            const newBlocks = [...(p.customBlocks || [])];
            const newCards = [...cards];
            newCards[cardIdx] = { ...newCards[cardIdx], ...changes };
            newBlocks[blockIdx] = { ...newBlocks[blockIdx], content: newCards };
            update('customBlocks', newBlocks);
          };
        } else {
          exp = p.experiences?.[expDetailIdx];
          onUpdate = (changes) => updateArrayItem('experiences', expDetailIdx, changes);
        }
        return exp ? (
          <ExpDetailModal
              userExperiences={userExperiences}
            exp={exp}
            onUpdate={onUpdate}
            onClose={() => setExpDetailIdx(null)}
            resizeToBase64={resizeToBase64}
            jobAnalysis={portfolio.jobAnalysis}
            genericMode={isBlockCard}
            onTailorApply={(sectionKey, content) => {
              const updated = { ...exp };
              updated.structuredResult = { ...(updated.structuredResult || {}), [sectionKey]: content };
              onUpdate(updated);
            }}
          />
        ) : null;
      })()}

      {/* ── Full-width sections (Preview 디자인 + 인라인 편집) ── */}
      <div className="px-10 py-8 border-t border-surface-100 flex flex-col gap-10">
        {/* 교과 활동 */}
        {!hiddenSections.includes('curricular') && sections.includes('curricular') && (
        <section id="editor-section-교과 활동" {...getSectionDndProps('curricular')}>
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="curricular" defaultLabel="📝 교과 활동 | Curricular Activities" className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block" />
            <div className="flex items-center gap-1">
              <VisualSectionRecommend sectionType="curricular" jobAnalysis={portfolio.jobAnalysis} />
              <span {...getSectionHandleProps('curricular', '교과 활동')} className={sectionHandleClass} title="드래그하여 순서 변경"><GripVertical size={14} /></span>
              <button onClick={() => hiddenSectionKey('curricular')} className="text-gray-300 hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="flex flex-col">
          <InlineContentBlock sectionKey="curricular" blockKey="summary" defaultOrder={['summary', 'courses', 'credits']}>
          <div className="mb-4 pl-1">
            <EditableTitle sectionKey="curricularSummary" defaultLabel="요약 | Summary" className="text-sm font-bold mb-2 text-gray-600" />
            <div className="flex items-center gap-1 text-sm text-gray-700">
              <EditableTitle sectionKey="curricularCreditsLabel" defaultLabel="📚 이수 학점:" className="inline font-medium" />
              <input value={curr.summary?.credits || ''} onChange={e => update('curricular', { ...curr, summary: { ...curr.summary, credits: e.target.value } })}
                placeholder="학점" className="w-20 outline-none bg-transparent hover:bg-primary-50/30 rounded px-1 placeholder:text-gray-300" />
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-700 mt-1">
              <EditableTitle sectionKey="curricularGpaLabel" defaultLabel="📊 평점 평균:" className="inline font-medium" />
              <input value={curr.summary?.gpa || ''} onChange={e => update('curricular', { ...curr, summary: { ...curr.summary, gpa: e.target.value } })}
                placeholder="GPA" className="w-20 outline-none bg-transparent hover:bg-primary-50/30 rounded px-1 placeholder:text-gray-300" />
            </div>
            <YooptaMiniEditor
              value={curr.summary?.noteBlocks || curr.summary?.note || ''}
              onChange={value => update('curricular', { ...curr, summary: { ...curr.summary, noteBlocks: value, note: richValueToPlainText(value) } })}
              placeholder="교과 활동 요약을 자유롭게 작성하세요..."
              minHeight={60}
              onExternalImageDrop={removeEmbeddedCustomImage}
              className="mt-2 bg-transparent hover:bg-primary-50/10 rounded px-1"
            />
          </div>
          </InlineContentBlock>
          <InlineContentBlock sectionKey="curricular" blockKey="courses" defaultOrder={['summary', 'courses', 'credits']}>
          <EditableTitle sectionKey="curricularCourses" defaultLabel="교과목 수강 내역 | Course History" className="text-sm font-bold mb-2 text-gray-600" />
          <EditableDataTable
            columns={curricularCourseColumns}
            rows={curr.courses || []}
            onColumnsChange={columns => updateTableColumns('curricularCourses', columns)}
            onRowsChange={courses => update('curricular', { ...curr, courses })}
            addLabel="과목 추가"
          />
          </InlineContentBlock>
          <InlineContentBlock sectionKey="curricular" blockKey="credits" defaultOrder={['summary', 'courses', 'credits']}>
          <EditableTitle sectionKey="curricularCredits" defaultLabel="이수 현황 | Credit Status" className="text-sm font-bold mb-2 text-gray-600" />
          <EditableDataTable
            columns={curricularCreditColumns}
            rows={curr.creditStatus || []}
            onColumnsChange={columns => updateTableColumns('curricularCredits', columns)}
            onRowsChange={creditStatus => update('curricular', { ...curr, creditStatus })}
            addLabel="이수 현황 추가"
          />
          </InlineContentBlock>
          </div>
        </section>
        )}

        {/* 비교과 활동 */}
        {!hiddenSections.includes('extracurricular') && sections.includes('extracurricular') && (
        <section id="editor-section-비교과 활동" {...getSectionDndProps('extracurricular')}>
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="extracurricular" defaultLabel="💡 비교과 활동 | Extracurricular Activities" className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block" />
            <div className="flex items-center gap-1">
              <VisualSectionRecommend sectionType="extracurricular" jobAnalysis={portfolio.jobAnalysis} />
              <span {...getSectionHandleProps('extracurricular', '비교과 활동')} className={sectionHandleClass} title="드래그하여 순서 변경"><GripVertical size={14} /></span>
              <button onClick={() => hiddenSectionKey('extracurricular')} className="text-gray-300 hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="flex flex-col">
          <InlineContentBlock sectionKey="extracurricular" blockKey="summary" defaultOrder={['summary', 'badges', 'languages', 'details']}>
          <div className="mb-4 pl-1">
            <EditableTitle sectionKey="extracurricularSummary" defaultLabel="요약 | Summary" className="text-sm font-bold mb-2 text-gray-600" />
            <YooptaMiniEditor value={extra.summaryBlocks || extra.summary || ''} onChange={v => update('extracurricular', { ...extra, summaryBlocks: v, summary: richValueToPlainText(v) })}
              placeholder="비교과 활동 요약을 입력하세요..." rows={2}
              onExternalImageDrop={removeEmbeddedCustomImage}
              minHeight={70}
              className="bg-transparent hover:bg-primary-50/10 rounded px-1" />
          </div>
          </InlineContentBlock>
          <InlineContentBlock sectionKey="extracurricular" blockKey="badges" defaultOrder={['summary', 'badges', 'languages', 'details']}>
          <EditableTitle sectionKey="extracurricularBadges" defaultLabel="디지털 배지 | Digital Badge" className="text-sm font-bold mb-2 text-gray-600" />
          <EditableDataTable
            columns={extracurricularBadgeColumns}
            rows={extra.badges || []}
            onColumnsChange={columns => updateTableColumns('extracurricularBadges', columns)}
            onRowsChange={badges => update('extracurricular', { ...extra, badges })}
            addLabel="배지 추가"
          />
          </InlineContentBlock>
          <InlineContentBlock sectionKey="extracurricular" blockKey="languages" defaultOrder={['summary', 'badges', 'languages', 'details']}>
          <EditableTitle sectionKey="extracurricularLanguages" defaultLabel="어학 성적 | Language Certification" className="text-sm font-bold mb-2 text-gray-600" />
          <EditableDataTable
            columns={extracurricularLanguageColumns}
            rows={extra.languages || []}
            onColumnsChange={columns => updateTableColumns('extracurricularLanguages', columns)}
            onRowsChange={languages => update('extracurricular', { ...extra, languages })}
            addLabel="어학 추가"
          />
          </InlineContentBlock>
          <InlineContentBlock sectionKey="extracurricular" blockKey="details" defaultOrder={['summary', 'badges', 'languages', 'details']}>
          <EditableTitle sectionKey="extracurricularDetails" defaultLabel="세부 사항 | Details" className="text-sm font-bold mb-2 text-gray-600" />
          <div className="space-y-3 mb-3">
            {(extra.details || []).map((d, i) => (
              <div key={i} className="relative py-2 pl-1 group/det">
                <button onClick={() => { const details = (extra.details||[]).filter((_,j) => j !== i); update('extracurricular', { ...extra, details }); }}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400 opacity-0 group-hover/det:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                <div className="flex items-center gap-2 mb-1">
                  <input value={d.title || ''} onChange={e => { const details = [...(extra.details||[])]; details[i] = { ...details[i], title: e.target.value }; update('extracurricular', { ...extra, details }); }}
                    placeholder="활동명" className="text-sm font-bold text-gray-800 outline-none bg-transparent hover:bg-primary-50/30 rounded px-1 placeholder:text-gray-300" />
                  <input value={d.period || ''} onChange={e => { const details = [...(extra.details||[])]; details[i] = { ...details[i], period: e.target.value }; update('extracurricular', { ...extra, details }); }}
                    placeholder="기간" className="text-xs text-gray-400 outline-none bg-transparent hover:bg-primary-50/30 rounded px-1 placeholder:text-gray-300" />
                </div>
                <YooptaMiniEditor
                  value={d.descriptionBlocks || d.description || ''}
                  onChange={v => { const details = [...(extra.details||[])]; details[i] = { ...details[i], descriptionBlocks: v, description: richValueToPlainText(v) }; update('extracurricular', { ...extra, details }); }}
                  placeholder="상세 설명"
                  minHeight={60}
                  onExternalImageDrop={removeEmbeddedCustomImage}
                />
              </div>
            ))}
          </div>
          <button onClick={() => update('extracurricular', { ...extra, details: [...(extra.details||[]), { title: '', period: '', description: '' }] })}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600"><Plus size={12} /> 활동 추가</button>
          </InlineContentBlock>
          </div>
        </section>
        )}

        {/* Skills */}
        {!hiddenSections.includes('skills') && sections.includes('skills') && (
        <section id="editor-section-기술" {...getSectionDndProps('skills')}>
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="skills" defaultLabel="🛠 기술 | Skills" className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="skills" jobAnalysis={portfolio.jobAnalysis} />
              <span {...getSectionHandleProps('skills', '기술')} className={sectionHandleClass} title="드래그하여 순서 변경"><GripVertical size={14} /></span>
              <button onClick={() => hiddenSectionKey('skills')}
                className="text-gray-300 hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {[
              { category: 'tools',      label: '도구 (Tools)',         placeholder: '기타 도구 입력...',         presets: ['Notion', 'Figma', 'Photoshop', 'Illustrator', 'Canva', 'Slack', 'Jira', 'Excel', 'VS Code', 'GitHub', 'Premiere Pro'] },
              { category: 'languages',  label: '프로그래밍 언어',       placeholder: '기타 언어 입력...',         presets: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'Go', 'Swift', 'Kotlin', 'SQL', 'R'] },
              { category: 'frameworks', label: '프레임워크/라이브러리', placeholder: '기타 프레임워크 입력...', presets: ['React', 'Vue.js', 'Next.js', 'Spring', 'Django', 'Node.js', 'Express.js', 'TensorFlow', 'Flutter', 'Tailwind CSS'] },
              { category: 'others',     label: '기타 역량',             placeholder: '기타 역량 입력...',        presets: ['데이터 분석', 'UI/UX 디자인', '프로젝트 관리', '기획', '마케팅', '글쓰기', '발표', '리더십'] },
            ].map(({ category, label, placeholder, presets }) => (
              <SkillCategoryInput
                key={category}
                category={category}
                label={label}
                placeholder={placeholder}
                items={skills[category] || []}
                presets={presets}
                onUpdate={(val) => updateSkillCategory(category, val)}
              />
            ))}
          </div>
        </section>
        )}

        {/* Goals - Preview 디자인 */}
        {!hiddenSections.includes('goals') && sections.includes('goals') && (
        <section id="editor-section-목표와 계획" {...getSectionDndProps('goals')}>
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="goals" defaultLabel="✨ 목표와 계획 | Future Plans" className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="goals" jobAnalysis={portfolio.jobAnalysis} />
              <span {...getSectionHandleProps('goals', '목표와 계획')} className={sectionHandleClass} title="드래그하여 순서 변경"><GripVertical size={14} /></span>
              <button onClick={() => hiddenSectionKey('goals')}
                className="text-gray-300 hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <div className="space-y-3">
            {(p.goals || []).map((g, i) => (
              <div key={i} className="relative group/goal border-b border-surface-100 py-3 last:border-b-0">
                <button onClick={() => removeFromArray('goals', i)}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400 opacity-0 group-hover/goal:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                <div className="flex items-center gap-2 mb-1">
                  <select value={g.type || 'short'} onChange={e => updateArrayItem('goals', i, { type: e.target.value })}
                    className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 outline-none border-none cursor-pointer">
                    <option value="short">단기</option>
                    <option value="mid">중기</option>
                    <option value="long">장기</option>
                  </select>
                  <input value={g.title || ''} onChange={e => updateArrayItem('goals', i, { title: e.target.value })}
                    placeholder="목표를 입력하세요" className="flex-1 text-sm font-bold text-gray-800 outline-none bg-transparent hover:bg-primary-50/30 rounded px-1 placeholder:text-gray-300" />
                  <select value={g.status || 'planned'} onChange={e => updateArrayItem('goals', i, { status: e.target.value })}
                    className={`px-2 py-0.5 rounded text-xs outline-none border-none cursor-pointer ${
                      g.status === 'done' ? 'text-green-600' : g.status === 'ing' ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                    <option value="planned">예정</option>
                    <option value="ing">진행 중</option>
                    <option value="done">완료</option>
                  </select>
                </div>
                <YooptaMiniEditor
                  value={g.descriptionBlocks || g.description || ''}
                  onChange={v => updateArrayItem('goals', i, { descriptionBlocks: v, description: richValueToPlainText(v) })}
                  placeholder="상세 계획을 작성하세요..."
                  minHeight={80}
                  onExternalImageDrop={removeEmbeddedCustomImage}
                  className="mt-1"
                />
              </div>
            ))}
            <button onClick={() => addToArray('goals', { title: '', description: '', type: 'short', status: 'planned' })}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600"><Plus size={12} /> 목표 추가</button>
          </div>
        </section>
        )}

        {/* Values - Preview 디자인 */}
        {!hiddenSections.includes('values') && sections.includes('values') && (
        <section id="editor-section-가치관" {...getSectionDndProps('values')}>
          <div className="flex items-center justify-between mb-4">
            <EditableTitle sectionKey="values" defaultLabel="💬 가치관 | Values" className="text-xl font-bold pb-2 border-b-2 border-green-300 inline-block" />
            <div className="flex items-center gap-2">
              <VisualSectionRecommend sectionType="values" jobAnalysis={portfolio.jobAnalysis} />
              <span {...getSectionHandleProps('values', '가치관')} className={sectionHandleClass} title="드래그하여 순서 변경"><GripVertical size={14} /></span>
              <button onClick={() => hiddenSectionKey('values')}
                className="text-gray-300 hover:text-red-400 transition-colors" title="섹션 숨기기"><X size={14} /></button>
            </div>
          </div>
          <YooptaMiniEditor
            value={p.valuesEssayBlocks || p.valuesEssay || ''}
            onChange={v => { update('valuesEssayBlocks', v); update('valuesEssay', richValueToPlainText(v)); }}
            placeholder="가치관, 자기소개 에세이를 작성하세요..."
            minHeight={180}
            onExternalImageDrop={removeEmbeddedCustomImage}
            className="bg-transparent hover:bg-primary-50/10 rounded px-1"
          />
        </section>
        )}

        {/* Custom Blocks */}
        {(p.customBlocks || []).map((block, i) => (
          <section key={i} {...getCustomBlockDndProps(i, block)} style={{ order: getCustomBlockOrder(i) }}>
            <div className="absolute -top-1 right-0 flex items-center gap-1">
              <span {...getCustomBlockHandleProps(i, getCustomBlockLabel(block, i))} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-opacity" title="드래그하여 이동"><GripVertical size={14} /></span>
              <button onClick={() => moveCustomBlock(i, -1)} className="text-gray-300 hover:text-primary-600 transition-colors" title="위로 이동"><ChevronUp size={14} /></button>
              <button onClick={() => moveCustomBlock(i, 1)} className="text-gray-300 hover:text-primary-600 transition-colors" title="아래로 이동"><ChevronDown size={14} /></button>
              <button onClick={() => {
                const blocks = [...(p.customBlocks || [])]; blocks.splice(i, 1);
                update('customBlocks', blocks);
              }} className="text-gray-300 hover:text-red-400 transition-opacity" title="삭제">
                <Trash2 size={14} />
              </button>
            </div>
            <input
              value={block.title ?? getDefaultCustomBlockTitle(block.type)}
              onChange={e => {
                const blocks = [...(p.customBlocks || [])];
                blocks[i] = { ...blocks[i], title: e.target.value };
                update('customBlocks', blocks);
              }}
              placeholder="소제목을 입력하세요"
              className="w-full text-xl font-bold text-gray-900 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 pb-1 mb-4 border-b-2 border-primary-300"
            />
            {block.type === 'heading' && (
              <input value={block.content || ''} onChange={e => {
                const blocks = [...(p.customBlocks || [])]; blocks[i] = { ...blocks[i], content: e.target.value };
                update('customBlocks', blocks);
              }} placeholder="제목을 입력하세요"
                className="w-full text-xl font-bold text-gray-900 outline-none bg-transparent placeholder:text-gray-300 hover:bg-primary-50/30 rounded px-1 mb-4" />
            )}
            {(block.type === 'text' || block.type === 'table') && (
              <YooptaMiniEditor
                value={block.contentBlocks || block.content || ''}
                onChange={v => {
                  const blocks = [...(p.customBlocks || [])];
                  blocks[i] = { ...blocks[i], contentBlocks: v, content: richValueToPlainText(v) };
                  update('customBlocks', blocks);
                }}
                placeholder="텍스트를 입력하세요"
                onExternalImageDrop={removeEmbeddedCustomImage}
                minHeight={120}
              />
            )}
            {block.type === 'image' && (
              <div
                className="mb-4 cursor-grab active:cursor-grabbing"
                draggable={Boolean(block.content)}
                onDragStartCapture={event => {
                  if (!block.content) return;
                  event.dataTransfer.setData(CUSTOM_IMAGE_DRAG_TYPE, JSON.stringify({
                    sourceIndex: i,
                    src: block.content,
                    alt: block.title || 'image',
                  }));
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragStart={event => event.stopPropagation()}
              >
                {block.content ? (
                  <YooptaMiniEditor
                    value={block.contentBlocks || createYooptaImageValue(block.content, block.title || 'image', undefined, `custom-image-${i}`)}
                    onChange={v => {
                      const blocks = [...(p.customBlocks || [])];
                      const image = findFirstYooptaImage(v);
                      blocks[i] = {
                        ...blocks[i],
                        contentBlocks: v,
                        content: image?.src || '',
                        width: image?.sizes?.width ?? block.width,
                      };
                      update('customBlocks', blocks);
                    }}
                    minHeight={120}
                    className="bg-transparent"
                  />
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-48 border-2 border-dashed border-surface-200 rounded-xl cursor-pointer hover:border-primary-300 transition-colors">
                    <ImageIcon size={24} className="text-gray-300" />
                    <span className="text-xs text-gray-400">클릭하여 이미지 업로드</span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const base64 = await resizeToBase64Global(file, 1200, 0.8);
                        const blocks = [...(p.customBlocks || [])]; blocks[i] = { ...blocks[i], content: base64 };
                        update('customBlocks', blocks);
                      } catch { toast.error('이미지 처리 실패'); }
                    }} />
                  </label>
                )}
              </div>
            )}
            {block.type === 'divider' && <hr className="border-surface-200 my-6" />}
            {block.type === 'project' && (() => {
              // content가 배열이면 신규 카드그리드, 객체이면 레거시 단일항목 → 배열로 정규화
              const cards = Array.isArray(block.content) ? block.content
                : (block.content && typeof block.content === 'object' && block.content.title !== undefined)
                  ? [block.content] : [];
              const updateCards = (newCards) => {
                const blocks = [...(p.customBlocks || [])];
                blocks[i] = { ...blocks[i], content: newCards };
                update('customBlocks', blocks);
              };
              const addCard = (card) => updateCards([...cards, card]);
              const removeCard = (ci) => updateCards(cards.filter((_, j) => j !== ci));
              const updateCard = (ci, changes) => updateCards(cards.map((c, j) => j === ci ? { ...c, ...changes } : c));

              return (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {cards.map((card, ci) => (
                      <div key={ci}
                        onClick={() => setExpDetailIdx({ blockIdx: i, cardIdx: ci })}
                        className="group/card relative bg-white rounded-xl border border-surface-200 overflow-hidden hover:shadow-md transition-all cursor-pointer">
                        <div className="aspect-[4/3] bg-surface-50 overflow-hidden">
                          {card.thumbnailUrl
                            ? <img src={card.thumbnailUrl} alt={card.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-100 to-surface-50">
                                <span className="text-4xl opacity-40"><Briefcase size={28} className="text-gray-300" /></span>
                              </div>}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-bold text-gray-800 truncate">{card.title || '(제목 없음)'}</p>
                          <p className="text-[13px] text-gray-400 mt-0.5">{card.date || ''}</p>
                          {card.description && <p className="text-[13px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{card.description}</p>}
                          {(card.skills || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(card.skills || []).slice(0, 3).map((sk, si) => (
                                <span key={si} className="px-1.5 py-0.5 bg-primary-50 text-primary-700 rounded text-[12px]">{typeof sk === 'string' ? sk : sk?.name}</span>
                              ))}
                              {(card.skills || []).length > 3 && <span className="text-[12px] text-gray-400">+{(card.skills || []).length - 3}</span>}
                            </div>
                          )}
                        </div>
                        <button onClick={ev => { ev.stopPropagation(); removeCard(ci); }}
                          className="absolute top-1.5 right-1.5 bg-white/80 p-1 rounded-full text-gray-400 hover:text-red-500 shadow-sm opacity-0 group-hover/card:opacity-100 transition-opacity">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="relative aspect-[4/3]">
                      <button onClick={() => setAddCardMenuIdx(addCardMenuIdx === i ? null : i)}
                        className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-200 text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors">
                        <Plus size={24} /><span className="text-xs">경험 추가</span>
                      </button>
                      {addCardMenuIdx === i && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-surface-200 rounded-xl shadow-lg z-20 py-1 w-52">
                          <button onClick={() => { setProjectBlockPickerIdx(i); setAddCardMenuIdx(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                            <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Database size={12} className="text-blue-600" /></span>
                            경험 DB에서 불러오기
                          </button>
                          <button onClick={() => { addCard({ title: '', date: '', role: '', description: '', skills: [], link: '', thumbnailUrl: '' }); setAddCardMenuIdx(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 text-left">
                            <span className="w-5 h-5 bg-blue-50 rounded flex items-center justify-center"><Plus size={12} className="text-blue-600" /></span>
                            직접 작성하기
                          </button>
                        </div>
                      )}
                      {projectBlockPickerIdx === i && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-surface-200 rounded-xl shadow-lg z-30 py-1 w-64 max-h-52 overflow-y-auto">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-100">
                            <span className="text-xs font-bold text-gray-700">경험 DB에서 선택</span>
                            <button onClick={() => setProjectBlockPickerIdx(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                          </div>
                          {userExperiences.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">등록된 경험이 없습니다</p>
                          ) : userExperiences.map(exp => (
                            <button key={exp.id} onClick={() => {
                              const aiResult = exp.structuredResult || {};
                              const autoSkills = (aiResult.keywords || exp.keywords || []).slice(0, 8).map(k => typeof k === 'string' ? k : k?.name ?? '').filter(Boolean);
                              addCard({ title: exp.title || '', date: exp.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 7) || '', role: aiResult.projectOverview?.role || '', description: aiResult.projectOverview?.summary || aiResult.intro || exp.description || '', skills: autoSkills, link: '', thumbnailUrl: exp.images?.[0] || '', structuredResult: aiResult, experienceId: exp.id || null });
                              setProjectBlockPickerIdx(null);
                            }} className="w-full text-left flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
                              {exp.images?.[0] || exp.thumbnailUrl
                                ? <img src={exp.images?.[0] || exp.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 mt-0.5" />
                                : <div className="w-8 h-8 rounded bg-surface-100 flex items-center justify-center flex-shrink-0 mt-0.5"><Briefcase size={14} className="text-gray-400" /></div>}
                              <div className="min-w-0">
                                <p className="text-sm text-gray-700 font-medium truncate">{exp.title}</p>
                                {exp.date && <p className="text-[12px] text-gray-400">{exp.date}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        ))}

        {/* 블록/섹션 추가 — 템플릿에 얽매이지 않고 자유롭게 섹션을 늘립니다 */}
        <div className="relative mt-2" style={{ order: 9998 }}>
          <button onClick={() => setShowAddBlockMenu(prev => !prev)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-surface-200 rounded-xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors">
            <Plus size={16} /> 블록 / 섹션 추가
          </button>
          {showAddBlockMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowAddBlockMenu(false)} />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 bg-white border border-surface-200 rounded-xl shadow-lg z-20 py-2 w-80 max-h-[70vh] overflow-y-auto">
                <p className="px-3 py-1 text-[12px] text-gray-400 font-bold uppercase tracking-wider">기본 블록</p>
                {[
                  { type: 'heading', icon: <Type size={14} />, label: '제목', desc: '새 섹션 제목' },
                  { type: 'text', icon: <MessageSquare size={14} />, label: '텍스트', desc: '자유 텍스트 블록' },
                  { type: 'image', icon: <ImageIcon size={14} />, label: '이미지', desc: '사진 첨부' },
                  { type: 'table', icon: <Columns size={14} />, label: '표', desc: '행과 열을 편집할 수 있는 표' },
                  { type: 'divider', icon: <span className="text-xs">―</span>, label: '구분선', desc: '섹션 구분선' },
                ].map(item => (
                  <button key={item.type} onClick={() => { addToArray('customBlocks', { type: item.type, title: getDefaultCustomBlockTitle(item.type), content: '', contentBlocks: item.type === 'table' ? createYooptaTableValue() : undefined, order: nextBlockOrder() }); setShowAddBlockMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-50 text-left">
                    <span className="w-6 h-6 bg-primary-50 rounded flex items-center justify-center text-primary-600">{item.icon}</span>
                    <div><p className="text-sm font-medium text-gray-800">{item.label}</p><p className="text-[12px] text-gray-400">{item.desc}</p></div>
                  </button>
                ))}
                <div className="border-t border-surface-100 mt-1 pt-1">
                  <p className="px-3 py-1 text-[12px] text-gray-400 font-bold uppercase tracking-wider">콘텐츠 블록</p>
                  <button onClick={() => { addToArray('customBlocks', { type: 'project', title: getDefaultCustomBlockTitle('project'), content: [], order: nextBlockOrder() }); setShowAddBlockMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-50 text-left">
                    <span className="w-6 h-6 bg-primary-50 rounded flex items-center justify-center text-primary-600"><Briefcase size={14} /></span>
                    <div><p className="text-sm font-medium text-gray-800">프로젝트 / 경험</p><p className="text-[12px] text-gray-400">카드 갤러리, 경험 DB에서 불러오기</p></div>
                  </button>
                </div>
                <div className="border-t border-surface-100 mt-1 pt-1">
                  <p className="px-3 py-1 text-[12px] text-gray-400 font-bold uppercase tracking-wider">섹션 패키지</p>
                  {[
                    ['profile', '프로필', '사진, 이름, 소개, 가치관'],
                    ['education', '학력', '학교, 기간, 전공, 상세 내용'],
                    ['awards', '수상', '날짜, 수상명, 설명'],
                    ['experiences', '프로젝트 / 경험', '경험 목록과 상세 내용'],
                    ['curricular', '교과 활동', '요약, 이수 학점, 평점, 수강 내역'],
                    ['extracurricular', '비교과 활동', '어학, 자격, 활동 내역'],
                    ['skills', '기술', '언어, 도구, 프레임워크'],
                    ['goals', '목표와 계획', '단기/중기/장기 목표'],
                    ['values', '가치관', '자기소개와 가치관 글'],
                    ['contact', '연락처', '전화, 이메일, 링크'],
                  ].map(([key, label, desc]) => (
                    <button key={key} type="button" onClick={() => addSectionPackage(key)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-50 text-left">
                      <span className="w-6 h-6 bg-primary-50 rounded flex items-center justify-center text-primary-600"><Plus size={14} /></span>
                      <div><p className="text-sm font-medium text-gray-800">{label}</p><p className="text-[12px] text-gray-400">{desc}</p></div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {hiddenSections.some(sectionKey => sections.includes(sectionKey)) && (
          <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50/70 px-4 py-3" style={{ order: 9999 }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">숨긴 섹션</span>
              {hiddenSections.filter(sectionKey => sections.includes(sectionKey)).map(sectionKey => (
                <button
                  key={sectionKey}
                  type="button"
                  onClick={() => update('hiddenSections', hiddenSections.filter(item => item !== sectionKey))}
                  className="inline-flex items-center gap-1 rounded-full border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-primary-200 hover:text-primary-600 transition-colors"
                >
                  <Plus size={11} /> {(p.customSectionLabels || {})[sectionKey] || SECTION_LABELS.notion[sectionKey] || sectionKey}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
      </div>{/* end 포트폴리오 카드 */}

      {/* ── 우측 기업 분석 사이드바 (공용 JobAnalysisSidebar) ── */}
      <JobAnalysisSidebar portfolio={p} update={update} updateArrayItem={updateArrayItem} analysisMode={analysisMode} onClose={() => onCloseAnalysis?.()} />

    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1 font-medium">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
      />
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1 font-medium">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
      />
    </div>
  );
}

function SectionCard({ title, icon: Icon, description, children, sectionType, jobAnalysis }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-50 transition-colors text-left"
      >
        {Icon && <Icon size={18} className="text-primary-500 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          {description && <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>}
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
}

// ── Profile Section ──
function ProfileSection({ portfolio, update, addToArray, removeFromArray, updateArrayItem, userId, portfolioId, templateId, jobAnalysis }) {
  const profileImageInputRef = useRef(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);

  // 이미지 → Base64 변환 (Canvas로 리사이즈 + 압축)
  const resizeToBase64 = (file, maxPx = 800, quality = 0.8) =>
    new Promise((resolve, reject) => {
      const img = new Image();
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

  const handleProfileImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('파일 크기는 10MB 이하여야 합니다');
      return;
    }
    setUploadingProfile(true);
    try {
      // Base64로 변환 (리사이즈 + 압축) — Firebase Storage 불필요
      const base64 = await resizeToBase64(file);
      update('profileImageUrl', base64);
      update('profileImageStoragePath', '');
      toast.success('프로필 이미지가 업로드되었습니다');
    } catch (err) {
      console.error('프로필 이미지 업로드 실패:', err);
      toast.error('이미지 업로드에 실패했습니다');
    }
    setUploadingProfile(false);
    e.target.value = '';
  };

  const handleProfileImageDelete = async () => {
    update('profileImageUrl', '');
    update('profileImageStoragePath', '');
  };

  return (
    <>
      <SectionCard
        title={templateId === 'ashley' ? '기본 정보 & 인적 사항' : templateId === 'academic' ? '기본 정보' : '기본 정보'}
        icon={Heart}
        description={
          templateId === 'ashley'
            ? '이름, 사진, 연락처 채널 등 방문자에게 보여줄 핵심 정보를 입력하세요'
            : templateId === 'academic'
            ? '학적 정보와 함께 표시될 기본 인적 사항입니다'
            : '프로필 좌측에 표시되는 기본 인적 사항입니다'
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <InputField label="이름 (한글)" value={portfolio.userName} onChange={v => update('userName', v)} placeholder="한채영" />
          <InputField label="이름 (영문)" value={portfolio.nameEn} onChange={v => update('nameEn', v)} placeholder="Chae Young Han" />
          {/* 주소 검색 (카카오 우편번호 API) */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">거주지</label>
            <div className="flex gap-2">
              <input
                value={portfolio.location || ''}
                onChange={e => update('location', e.target.value)}
                placeholder="주소를 검색하세요"
                className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                type="button"
                onClick={async () => {
                  // 다음 주소 API 동적 로드
                  if (!window.daum?.Postcode) {
                    await new Promise((resolve) => {
                      const s = document.createElement('script');
                      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
                      s.onload = resolve;
                      document.head.appendChild(s);
                    });
                  }
                  if (!window.daum?.Postcode) {
                    toast.error('주소 검색 서비스를 불러올 수 없습니다');
                    return;
                  }
                  new window.daum.Postcode({
                    oncomplete: (data) => {
                      const addr = data.roadAddress || data.jibunAddress || data.address;
                      update('location', addr);
                    },
                  }).open();
                }}
                className="px-3 py-2 bg-primary-50 text-primary-600 border border-primary-200 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors whitespace-nowrap"
              >
                <MapPin size={13} className="inline mr-1" />주소 검색
              </button>
            </div>
          </div>
          {/* 생년월일 캘린더 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">생년월일</label>
            <input
              type="date"
              value={portfolio.birthDate || ''}
              onChange={e => update('birthDate', e.target.value)}
              className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1 font-medium">프로필 이미지</label>
            {portfolio.profileImageUrl ? (
              <div className="flex items-center gap-3 p-3 border border-surface-200 rounded-lg">
                <img src={portfolio.profileImageUrl} alt="profile" className="w-14 h-14 rounded-xl object-cover border border-surface-200" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-600 truncate">{portfolio.profileImageStoragePath?.split('/').pop() || '업로드된 이미지'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">클릭하여 교체</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => profileImageInputRef.current?.click()}
                    disabled={uploadingProfile}
                    className="px-3 py-1.5 text-xs text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-40 transition-colors">
                    {uploadingProfile ? <Loader2 size={12} className="animate-spin" /> : '교체'}
                  </button>
                  <button type="button" onClick={handleProfileImageDelete}
                    className="px-3 py-1.5 text-xs text-red-400 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    삭제
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => profileImageInputRef.current?.click()}
                disabled={uploadingProfile}
                className="w-full flex items-center gap-3 px-4 py-3 border-2 border-dashed border-surface-300 rounded-lg text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 disabled:opacity-40 transition-all">
                {uploadingProfile ? (
                  <><Loader2 size={18} className="animate-spin" /><span className="text-sm">업로드 중...</span></>
                ) : (
                  <><ImagePlus size={18} /><span className="text-sm">사진 선택 · JPG, PNG, WEBP · 최대 10MB</span></>
                )}
              </button>
            )}
            <input ref={profileImageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleProfileImageUpload} className="hidden" />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={templateId === 'ashley' ? '저는 이런 사람이에요' : templateId === 'academic' ? 'Personal Values' : 'My Own Values'}
        icon={Star}
        description={
          templateId === 'ashley'
            ? '나를 나타내는 개성과 특징을 bullet point로 적어보세요 (alohayoon.oopy.io 스타일)'
            : '나를 나타내는 핵심 가치관 키워드를 추가하세요'
        }
      >
        <div className="space-y-3">
          {(portfolio.values || []).map((val, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="flex-1">
                <InputField label={`${templateId === 'ashley' ? '특징' : '가치'} ${i + 1} - 키워드`} value={val.keyword}
                  onChange={v => updateArrayItem('values', i, { keyword: v })}
                  placeholder={templateId === 'ashley' ? '미국 45개주, 28개국을 여행했어요' : '경험을 더하다'} />
                <div className="mt-2">
                  <TextareaField label="설명" value={val.description}
                    onChange={v => updateArrayItem('values', i, { description: v })}
                    placeholder={templateId === 'ashley' ? '(선택) 부연 설명...' : '이 가치관에 대한 간단한 설명...'} rows={2} />
                </div>
              </div>
              <button onClick={() => removeFromArray('values', i)} className="mt-5 p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => addToArray('values', { keyword: '', description: '' })}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> {templateId === 'ashley' ? '특징 추가' : '가치관 추가'}
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title={templateId === 'ashley' ? '관심사 & 취미' : '관심 분야'}
        icon={Target}
        description={
          templateId === 'ashley'
            ? '음악, 여행, 책 등 나를 표현하는 관심사를 자유롭게 적어보세요 (포트폴리오 하단에 태그로 표시)'
            : 'Interest 영역에 표시됩니다'
        }
      >
        <div className="space-y-2">
          {(portfolio.interests || []).map((interest, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-400">•</span>
              <input value={interest} onChange={e => updateArrayItem('interests', i, e.target.value)}
                className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
                placeholder={templateId === 'ashley' ? '음악, 우주, 여행, 오래된 것' : 'Enumerative Combinatorics (열거 조합론)'} />
              <button onClick={() => removeFromArray('interests', i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => addToArray('interests', '')}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> {templateId === 'ashley' ? '관심사 추가' : '관심 분야 추가'}
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ── Education Section ──
const DEGREE_OPTIONS = [
  '학사 (B.S.)', '학사 (B.A.)', '학사 (B.E.)', '학사 (B.B.A.)',
  '석사 (M.S.)', '석사 (M.A.)', '석사 (M.E.)', '석사 (M.B.A.)',
  '박사 (Ph.D.)', '박사 (D.Eng.)',
  '전문학사', '수료', '재학 중', '졸업 예정', '기타',
];

function EducationSection({ portfolio, addToArray, removeFromArray, updateArrayItem, templateId, jobAnalysis }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  return (
    <SectionCard
      title={templateId === 'ashley' ? '학교 (School)' : '학력 (Education)'}
      icon={GraduationCap}
      sectionType="education"
      jobAnalysis={jobAnalysis}
      description={
        templateId === 'ashley'
          ? '출신 학교를 입력하세요. 클릭하면 세부 정보를 편집할 수 있습니다'
          : '학교 정보를 등록하세요. 클릭하면 세부 정보를 편집할 수 있습니다'
      }
    >
      <div className="space-y-3">
        {(portfolio.education || []).map((edu, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              {/* 접힌 헤더 */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <GraduationCap size={16} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{edu.name || '(학교명 없음)'}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {edu.period || '기간 미입력'}{edu.degree && ` · ${edu.degree}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); removeFromArray('education', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              {/* 펼침: 전체 편집 */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-100 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="학교명 (한글)" value={edu.name} onChange={v => updateArrayItem('education', i, { name: v })}
                      placeholder={templateId === 'ashley' ? 'NYU Stern School of Business' : '성균관대학교'} />
                    <InputField label="학교명 (영문)" value={edu.nameEn} onChange={v => updateArrayItem('education', i, { nameEn: v })}
                      placeholder={templateId === 'ashley' ? 'New York University' : 'Sungkyunkwan University'} />
                    <InputField label="기간" value={edu.period} onChange={v => updateArrayItem('education', i, { period: v })}
                      placeholder={templateId === 'ashley' ? '2006-2010 · 뉴욕' : '2024.02. - ing'} />
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 font-medium">학위/전공</label>
                      <div className="flex gap-2">
                        <select
                          value={DEGREE_OPTIONS.includes(edu.degreeType) ? edu.degreeType : '기타'}
                          onChange={e => updateArrayItem('education', i, { degreeType: e.target.value })}
                          className="px-2 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 bg-white"
                        >
                          {DEGREE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input
                          value={edu.degree || ''}
                          onChange={e => updateArrayItem('education', i, { degree: e.target.value })}
                          placeholder="전공명 (예: 컴퓨터공학과)"
                          className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
                        />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <InputField label={templateId === 'ashley' ? '전공 및 특이사항' : '추가 정보 (GPA, 특이사항 등)'} value={edu.detail}
                        onChange={v => updateArrayItem('education', i, { detail: v })}
                        placeholder={templateId === 'ashley' ? '전공: 마케팅 | 부전공: 미술, 심리학 · 장학생 프로그램' : '4.0/4.5 · 2025 Summer Session'} />
                    </div>
                    <div className="col-span-2">
                      <TextareaField label="활동 / 설명 (선택)" value={edu.description}
                        onChange={v => updateArrayItem('education', i, { description: v })}
                        placeholder="학교에서의 주요 활동, 동아리, 연구 등..." rows={3} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => addToArray('education', { name: '', nameEn: '', period: '', degreeType: '학사 (B.S.)', degree: '', detail: '', description: '' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> {templateId === 'ashley' ? '학교 추가' : '학력 추가'}
        </button>
      </div>
    </SectionCard>
  );
}

// ── Awards Section ──
function AwardsSection({ portfolio, addToArray, removeFromArray, updateArrayItem, jobAnalysis }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  return (
    <SectionCard title="수상 / 장학금 (Scholarship and Awards)" icon={Award} description="수상 및 장학 내역을 입력하세요. 클릭하면 세부 정보를 편집할 수 있습니다" sectionType="awards" jobAnalysis={jobAnalysis}>
      <div className="space-y-3">
        {(portfolio.awards || []).map((award, i) => {
          const isExpanded = expandedIdx === i;
          const displayDate = award.date ? new Date(award.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }) : '날짜 미입력';
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Award size={16} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{award.title || '(수상명 없음)'}</p>
                    <p className="text-xs text-gray-400">{displayDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); removeFromArray('awards', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-100 pt-4">
                  <div className="grid grid-cols-[160px_1fr] gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 font-medium">날짜</label>
                      <input
                        type="date"
                        value={award.date || ''}
                        onChange={e => updateArrayItem('awards', i, { date: e.target.value })}
                        className="w-full px-2 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </div>
                    <InputField label="수상명 / 장학금명" value={award.title} onChange={v => updateArrayItem('awards', i, { title: v })} placeholder="제 43회 대학생 수학 경시대회 제 1분야 동상" />
                  </div>
                  <InputField label="주최 기관" value={award.organization} onChange={v => updateArrayItem('awards', i, { organization: v })} placeholder="한국수학올림피아드위원회" />
                  <TextareaField label="설명 (선택)" value={award.description} onChange={v => updateArrayItem('awards', i, { description: v })}
                    placeholder="수상 경위, 내용, 의미 등..." rows={2} />
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => addToArray('awards', { date: '', title: '', organization: '', description: '' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 수상/장학 추가
        </button>
      </div>
    </SectionCard>
  );
}

// ── Experiences Section ──
const STATUS_OPTIONS = [
  { value: 'expected', label: 'Expected', color: 'bg-blue-100 text-blue-700' },
  { value: 'doing', label: 'Doing', color: 'bg-green-100 text-green-700' },
  { value: 'finished', label: 'Finished', color: 'bg-red-100 text-red-700' },
];
const CLASSIFY_OPTIONS = ['교내 활동', '교외 활동', '동아리', '공모전', '학교 협력 활동', '기술', '발표', '대회', '해외 경험'];

function ExperiencesSection({ portfolio, addToArray, removeFromArray, updateArrayItem, userExperiences, importExperience, showExpPicker, setShowExpPicker, templateId, jobAnalysis }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [tailoringIdx, setTailoringIdx] = useState(null);
  const [tailorResult, setTailorResult] = useState(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendations, setRecommendations] = useState(null);

  const fetchRecommendations = async () => {
    if (!portfolio.jobAnalysis) { toast.error('연결된 기업 공고가 없습니다'); return; }
    setRecommendLoading(true);
    try {
      const { data } = await api.post('/job/recommend-experiences', {
        jobAnalysis: portfolio.jobAnalysis,
      });
      setRecommendations(data);
    } catch { toast.error('경험 추천 분석에 실패했습니다'); }
    setRecommendLoading(false);
  };

  const toggleClassify = (i, tag) => {
    const exp = portfolio.experiences[i];
    const cls = exp.classify || [];
    updateArrayItem('experiences', i, {
      classify: cls.includes(tag) ? cls.filter(c => c !== tag) : [...cls, tag]
    });
  };

  const addSection = (i) => {
    const exp = portfolio.experiences[i];
    const secs = [...(exp.sections || []), { title: '', content: '' }];
    updateArrayItem('experiences', i, { sections: secs });
  };

  const updateSection = (i, si, changes) => {
    const exp = portfolio.experiences[i];
    const secs = [...(exp.sections || [])];
    secs[si] = { ...secs[si], ...changes };
    updateArrayItem('experiences', i, { sections: secs });
  };

  const removeSection = (i, si) => {
    const exp = portfolio.experiences[i];
    updateArrayItem('experiences', i, { sections: exp.sections.filter((_, idx) => idx !== si) });
  };

  const addSkill = (i, skill) => {
    if (!skill.trim()) return;
    const exp = portfolio.experiences[i];
    const sk = [...(exp.skills || []), skill.trim()];
    updateArrayItem('experiences', i, { skills: sk });
  };

  const removeSkill = (i, si) => {
    const exp = portfolio.experiences[i];
    updateArrayItem('experiences', i, { skills: exp.skills.filter((_, idx) => idx !== si) });
  };

  const handleTailorExperience = async (i) => {
    if (!portfolio.jobAnalysis) { toast.error('연결된 기업 공고가 없습니다'); return; }
    setTailoringIdx(i);
    setTailorResult(null);
    try {
      const { data } = await api.post('/job/tailor-experience', {
        jobAnalysis: portfolio.jobAnalysis,
        experience: portfolio.experiences[i],
      });
      setTailorResult({ idx: i, ...data });
    } catch { toast.error('맞춤 변환 실패'); }
    setTailoringIdx(null);
  };

  const applyTailoredResult = (i) => {
    if (!tailorResult || tailorResult.idx !== i) return;
    updateArrayItem('experiences', i, {
      description: tailorResult.tailoredDescription,
      skills: tailorResult.highlightedSkills || portfolio.experiences[i].skills,
    });
    toast.success('기업 맞춤으로 변환 완료!');
    setTailorResult(null);
  };

  return (
    <SectionCard
      title={
        templateId === 'ashley' ? '경력 & 프로젝트 (Career & Projects)' :
        templateId === 'academic' ? 'Portfolio & Experience' :
        '프로젝트 / 경험 (Experience)'
      }
      icon={Briefcase}
      sectionType="experiences"
      jobAnalysis={jobAnalysis}
      description={
        templateId === 'ashley'
          ? '현재/과거 경력, 프리랜서 프로젝트, 독립 프로젝트 등을 입력하세요. 인터뷰 & 프로젝트 갤러리에 카드로 표시됩니다'
          : templateId === 'academic'
          ? 'About me (소개), Portfolio (대표 프로젝트), Experience (활동 이력)에 사용됩니다. 대표 프로젝트 먼저 입력하세요'
          : '갤러리 카드로 표시되는 프로젝트 경험입니다. 클릭하면 상세 편집할 수 있습니다.'
      }
    >
      {/* Ashley: 경력 타임라인 안내 */}
      {templateId === 'ashley' && (
        <div className="mb-4 p-4 bg-[#f7f5f0] border border-[#e8e4dc] rounded-xl text-xs text-[#5a564e] leading-relaxed">
          <p className="font-bold text-[#2d2a26] mb-2">작성 가이드 (alohayoon.oopy.io 참고)</p>
          <ul className="space-y-1">
            <li>• <strong>현재 경력</strong>: 현재 하고 있는 프로젝트, 커뮤니티, 클래스 활동 등</li>
            <li>• <strong>지난 경력(프리워커)</strong>: 독립 후 진행한 프로젝트들</li>
            <li>• <strong>지난 경력(마케터/작가 등)</strong>: 회사 경력, 프리랜서 활동</li>
            <li>• 상위 3개는 <strong>인터뷰 섹션</strong>에, 전체는 <strong>프로젝트 갤러리</strong>에 표시됩니다</li>
          </ul>
        </div>
      )}
      {/* Academic: About me 소개 입력 */}
      {templateId === 'academic' && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-bold text-blue-700 mb-2">Academic 템플릿 구성</p>
          <p className="text-xs text-blue-600 mb-3">경험을 추가하면 <strong>Portfolio(갤러리)</strong>와 <strong>Experience(타임라인)</strong>에 자동으로 표시됩니다. 아래 Classify 태그로 구분하세요:</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg font-medium">Portfolio → 대표 프로젝트</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg font-medium">경험 → 활동 이력</span>
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium">대회 → 수상 연결</span>
          </div>
        </div>
      )}
      {/* 기업 키워드 기반 경험 추천 */}
      {portfolio.jobAnalysis && (
        <div className="mb-6 border border-indigo-100 rounded-xl bg-indigo-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              <span className="text-sm font-bold text-indigo-700">
                {portfolio.jobAnalysis.company} 맞춤 경험 추천
              </span>
            </div>
            <button
              onClick={fetchRecommendations}
              disabled={recommendLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {recommendLoading ? (
                <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
              ) : (
                <><Sparkles size={12} /> {recommendations ? '다시 분석' : '키워드 추출 & 추천'}</>
              )}
            </button>
          </div>

          {recommendations && (
            <div className="space-y-3">
              {/* 핵심 키워드 3개 */}
              <div>
                <p className="text-xs font-bold text-indigo-600 mb-2">핵심 키워드</p>
                <div className="flex flex-wrap gap-2">
                  {(recommendations.keywords || []).map((kw, i) => (
                    <div key={i} className="px-3 py-1.5 bg-white rounded-lg border border-indigo-200 text-sm">
                      <span className="font-bold text-indigo-700">{kw.keyword}</span>
                      <span className="text-gray-500 ml-1.5 text-xs">- {kw.description}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* 추천 경험 */}
              {(recommendations.recommendations || []).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-indigo-600 mb-2">추천 경험</p>
                  <div className="space-y-2">
                    {recommendations.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-indigo-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800">{rec.experience?.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{rec.reason}</p>
                          <div className="flex gap-1 mt-1">
                            {(rec.matchedKeywords || []).map((k, ki) => (
                              <span key={ki} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[12px] font-medium">{k}</span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const exp = userExperiences.find(e => e.id === rec.experience?.id);
                            if (exp) importExperience(exp);
                            else toast.error('경험 데이터를 찾을 수 없습니다');
                          }}
                          className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                        >
                          추가
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {(portfolio.experiences || []).map((exp, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              {/* 접힌 상태: 요약 카드 */}
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {exp.thumbnailUrl ? (
                    <img src={exp.thumbnailUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-200 flex items-center justify-center shrink-0"><Briefcase size={20} className="text-gray-400" /></div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-700 truncate">{exp.title || '(제목 없음)'}</span>
                      {exp.status && (
                        <span className={`px-1.5 py-0.5 rounded text-[12px] font-bold ${(STATUS_OPTIONS.find(s => s.value === exp.status) || STATUS_OPTIONS[2]).color}`}>
                          {(STATUS_OPTIONS.find(s => s.value === exp.status) || STATUS_OPTIONS[2]).label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{exp.date} {exp.role && `· ${exp.role}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); removeFromArray('experiences', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {/* 펼친 상태: 전체 편집 */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-surface-100 pt-4">
                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="제목" value={exp.title} onChange={v => updateArrayItem('experiences', i, { title: v })} placeholder="프로젝트명 / 활동명" />
                    <InputField label="기간" value={exp.date} onChange={v => updateArrayItem('experiences', i, { date: v })} placeholder="2025.03. ~ 2025.06." />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <InputField label="역할" value={exp.role} onChange={v => updateArrayItem('experiences', i, { role: v })} placeholder="팀장 / 개발자" />
                    <InputField label="링크 (선택)" value={exp.link} onChange={v => updateArrayItem('experiences', i, { link: v })} placeholder="https://..." />
                    <InputField label="썸네일 URL (선택)" value={exp.thumbnailUrl} onChange={v => updateArrayItem('experiences', i, { thumbnailUrl: v })} placeholder="https://...jpg" />
                  </div>

                  {/* 상태 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">상태 (Status)</label>
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map(s => (
                        <button key={s.value} onClick={() => updateArrayItem('experiences', i, { status: s.value })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${exp.status === s.value ? `${s.color} border-transparent ring-2 ring-offset-1 ring-gray-300` : 'bg-white border-surface-200 text-gray-400 hover:bg-surface-50'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 분류 태그 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">분류 (Classify)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {CLASSIFY_OPTIONS.map(tag => (
                        <button key={tag} onClick={() => toggleClassify(i, tag)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${(exp.classify || []).includes(tag) ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white border-surface-200 text-gray-400 hover:bg-surface-50'}`}>
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 스킬 태그 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Skills</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(exp.skills || []).map((sk, si) => (
                        <span key={si} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {sk}
                          <button onClick={() => removeSkill(i, si)} className="text-gray-400 hover:text-red-400"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                    <input
                      placeholder="스킬 입력 후 Enter"
                      className="px-3 py-1.5 border border-surface-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary-200 w-48"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(i, e.target.value); e.target.value = ''; } }}
                    />
                  </div>

                  {/* 간단 설명 */}
                  <TextareaField label="소개 (간단 설명)" value={exp.description} onChange={v => updateArrayItem('experiences', i, { description: v })}
                    placeholder="프로젝트에 대한 간단한 소개를 작성하세요..." rows={3} />

                  {/* 상세 섹션들 (소개, 참여 동기, 활동 내용, 느낀 점, ...) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">상세 섹션 (소개, 참여 동기, 활동 내용 등)</label>
                    <div className="space-y-3">
                      {(exp.sections || []).map((sec, si) => (
                        <div key={si} className="p-3 bg-white rounded-xl border border-surface-200">
                          <div className="flex items-center justify-between mb-2">
                            <input
                              value={sec.title}
                              onChange={e => updateSection(i, si, { title: e.target.value })}
                              placeholder="섹션 제목 (예: 참여 동기, 활동 내용, 느낀 점)"
                              className="text-sm font-bold text-gray-700 outline-none flex-1 bg-transparent"
                            />
                            <button onClick={() => removeSection(i, si)} className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                          <textarea
                            value={sec.content}
                            onChange={e => updateSection(i, si, { content: e.target.value })}
                            placeholder="이 섹션의 상세 내용을 작성하세요..."
                            rows={4}
                            className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-y"
                          />
                        </div>
                      ))}
                      <button onClick={() => addSection(i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-surface-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600">
                        <Plus size={12} /> 섹션 추가
                      </button>
                    </div>
                  </div>

                  {/* 기업 맞춤 변환 */}
                  {portfolio.jobAnalysis && (
                    <div className="border-t border-surface-100 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">기업 맞춤 변환</span>
                        <button
                          onClick={() => handleTailorExperience(i)}
                          disabled={tailoringIdx === i}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {tailoringIdx === i ? (
                            <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                          ) : (
                            <><Sparkles size={12} /> {portfolio.jobAnalysis.company}에 맞게 변환</>
                          )}
                        </button>
                      </div>
                      {tailorResult && tailorResult.idx === i && (
                        <div className="bg-indigo-50 rounded-xl p-4 space-y-3 text-xs">
                          <div>
                            <span className="font-bold text-indigo-700">맞춤 소개:</span>
                            <p className="text-gray-700 mt-1 leading-relaxed">{tailorResult.tailoredDescription}</p>
                          </div>
                          {tailorResult.subtitle && (
                            <div>
                              <span className="font-bold text-indigo-700">한줄 소개:</span>
                              <p className="text-gray-700 mt-1">{tailorResult.subtitle}</p>
                            </div>
                          )}
                          {tailorResult.keyAchievements?.length > 0 && (
                            <div>
                              <span className="font-bold text-indigo-700">강조 성과:</span>
                              <ul className="mt-1 space-y-0.5">
                                {tailorResult.keyAchievements.map((a, ai) => (
                                  <li key={ai} className="text-gray-700">✓ {a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {tailorResult.relevanceNote && (
                            <div>
                              <span className="font-bold text-indigo-700">적합도:</span>
                              <p className="text-gray-700 mt-1">{tailorResult.relevanceNote}</p>
                            </div>
                          )}
                          <button
                            onClick={() => applyTailoredResult(i)}
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                          >
                            이 내용으로 적용하기
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-2">
          <button onClick={() => addToArray('experiences', {
            date: '', title: '', description: '', role: '', link: '',
            framework: '', frameworkContent: {}, keywords: [], aiSummary: '',
            thumbnailUrl: '', status: 'doing', classify: [], skills: [], sections: []
          })}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 직접 추가
          </button>
          <div className="relative">
            <button onClick={() => setShowExpPicker(!showExpPicker)}
              className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-violet-300 rounded-xl text-sm text-violet-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all">
              <Upload size={14} /> 경험 DB에서 불러오기
            </button>
            {showExpPicker && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-surface-200 rounded-xl shadow-lg z-20 max-h-60 overflow-auto">
                {userExperiences.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">정리된 경험이 없습니다</p>
                ) : userExperiences.map(ue => (
                  <button key={ue.id} onClick={() => importExperience(ue)}
                    className="w-full text-left px-4 py-3 hover:bg-surface-50 border-b border-surface-100 last:border-0">
                    <p className="text-sm font-medium">{ue.title}</p>
                    <p className="text-xs text-gray-400">{ue.framework}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Curricular Section ──
function CurricularSection({ portfolio, update, updateNested, templateId, jobAnalysis }) {
  const curr = portfolio.curricular || { summary: { credits: '', gpa: '' }, courses: [], creditStatus: [] };
  const [showEveryTimeImport, setShowEveryTimeImport] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const updateCurrField = (field, value) => {
    update('curricular', { ...curr, [field]: value });
  };

  const addCourse = () => {
    updateCurrField('courses', [...(curr.courses || []), { semester: '', name: '', grade: '' }]);
  };
  const removeCourse = (idx) => {
    updateCurrField('courses', curr.courses.filter((_, i) => i !== idx));
  };
  const updateCourse = (idx, changes) => {
    const courses = [...curr.courses];
    courses[idx] = { ...courses[idx], ...changes };
    updateCurrField('courses', courses);
  };

  // 에브리타임 텍스트 파싱
  const parseEveryTimeText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const courses = [];
    const creditStatus = [];

    for (const line of lines) {
      // 탭 또는 여러 공백으로 분리
      const cells = line.split(/\t+|  +/).map(c => c.trim()).filter(Boolean);

      // 헤더 행 건너뛰기
      if (cells.some(c => /^(구분|영역|과목명|학점|등급|기준학점|취득학점|잔여학점|달성률|과목|성적|semester|grade)$/i.test(c))) continue;

      // 이수 현황 행 (구분, 영역, 기준학점, 취득학점, 잔여학점, 달성률 형태)
      if (cells.length >= 4 && /^\d+/.test(cells[2]) && /^\d+/.test(cells[3])) {
        const isCredit = cells.length >= 5 && /\d+/.test(cells[4]);
        if (isCredit) {
          creditStatus.push({
            category: cells[0],
            area: cells[1],
            required: cells[2],
            earned: cells[3],
            remaining: cells[4] || '',
            rate: cells[5] || '',
          });
          continue;
        }
      }

      // 수강 내역 행 파싱
      if (cells.length >= 2) {
        // 다양한 포맷 처리
        // 포맷1: 학기, 과목명, 학점, 성적
        // 포맷2: 구분, 과목명, 학점, 성적
        // 포맷3: 과목명, 성적
        const gradePattern = /^(A\+?|B\+?|C\+?|D\+?|F|P|NP|S|U)$/i;

        let semester = '';
        let name = '';
        let grade = '';

        if (cells.length >= 4 && gradePattern.test(cells[cells.length - 1])) {
          grade = cells[cells.length - 1].toUpperCase();
          name = cells.length >= 5 ? cells[1] : cells[1];
          // 학기 패턴: 2024-1, 1학기, 1-1 등
          if (/\d{4}[-./]\d|[1-8]학기|[1-4]-[12]/.test(cells[0])) {
            semester = cells[0];
            name = cells[1];
          } else {
            semester = cells[0]; // 구분 필드를 학기로 사용
            name = cells[1];
          }
        } else if (cells.length >= 2 && gradePattern.test(cells[cells.length - 1])) {
          name = cells[0];
          grade = cells[cells.length - 1].toUpperCase();
        } else if (cells.length >= 2) {
          name = cells[0];
          grade = cells[1];
        }

        if (name) {
          courses.push({ semester, name, grade });
        }
      }
    }
    return { courses, creditStatus };
  };

  const handleEveryTimeImport = () => {
    if (!pasteText.trim()) return;
    const parsed = parseEveryTimeText(pasteText);
    if (parsed.courses.length > 0) {
      updateCurrField('courses', [...(curr.courses || []), ...parsed.courses]);
    }
    if (parsed.creditStatus.length > 0) {
      updateCurrField('creditStatus', [...(curr.creditStatus || []), ...parsed.creditStatus]);
    }
    const total = parsed.courses.length + parsed.creditStatus.length;
    if (total > 0) {
      toast.success(`${parsed.courses.length}개 과목, ${parsed.creditStatus.length}개 이수현황을 가져왔습니다`);
    } else {
      toast.error('파싱할 수 있는 데이터가 없습니다. 형식을 확인해주세요.');
    }
    setShowEveryTimeImport(false);
    setPasteText('');
  };

  // 이수현황 관리
  const addCreditStatus = () => {
    updateCurrField('creditStatus', [...(curr.creditStatus || []), { category: '', area: '', required: '', earned: '', remaining: '', rate: '' }]);
  };
  const removeCreditStatus = (idx) => {
    updateCurrField('creditStatus', (curr.creditStatus || []).filter((_, i) => i !== idx));
  };
  const updateCreditStatus = (idx, changes) => {
    const list = [...(curr.creditStatus || [])];
    list[idx] = { ...list[idx], ...changes };
    updateCurrField('creditStatus', list);
  };

  return (
    <>
      <SectionCard title="교과 활동 | Curricular Activities" icon={BookOpen} description="이수 학점, 평점, 수강 내역 등을 입력하세요" sectionType="curricular" jobAnalysis={jobAnalysis}>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <InputField label="이수 학점 요약" value={curr.summary?.credits}
            onChange={v => updateCurrField('summary', { ...curr.summary, credits: v })} placeholder="총 00학점 이수" />
          <InputField label="평점 평균 (GPA)" value={curr.summary?.gpa}
            onChange={v => updateCurrField('summary', { ...curr.summary, gpa: v })} placeholder="4.0 / 4.5" />
        </div>

        {/* 에브리타임 가져오기 버튼 */}
        <button
          onClick={() => setShowEveryTimeImport(true)}
          className="flex items-center gap-2 px-4 py-2.5 mb-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all shadow-sm"
        >
          <Upload size={14} /> 에브리타임에서 가져오기
        </button>
      </SectionCard>

      {/* 에브리타임 가져오기 모달 */}
      {showEveryTimeImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEveryTimeImport(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">에브리타임 수강 내역 가져오기</h3>
              <button onClick={() => setShowEveryTimeImport(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-red-800 mb-2">가져오기 방법</p>
              <ol className="text-xs text-red-700 space-y-1 list-decimal list-inside">
                <li>에브리타임 앱 또는 웹에서 <strong>내 학점</strong> 페이지로 이동</li>
                <li>수강 내역 표를 <strong>전체 선택(Ctrl+A)</strong> 후 복사(Ctrl+C)</li>
                <li>아래 입력란에 <strong>붙여넣기(Ctrl+V)</strong></li>
              </ol>
              <p className="text-xs text-red-600 mt-2">지원 형식: 탭/공백으로 구분된 표 (학기, 과목명, 성적 등)</p>
            </div>

            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={`예시:\n전공선택\t컴퓨터네트워크\t3\tA+\n전공필수\t자료구조\t3\tA\n교양필수\t미적분학\t3\tB+\n\n또는:\n2024-1\t컴퓨터네트워크\t3\tA+\n2024-1\t자료구조\t3\tA`}
              rows={10}
              className="w-full px-4 py-3 border border-surface-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-200 resize-none font-mono"
            />

            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-400">
                {pasteText.trim() ? `${pasteText.split('\n').filter(l => l.trim()).length}줄 감지됨` : '데이터를 붙여넣으세요'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowEveryTimeImport(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-surface-200 rounded-xl hover:bg-surface-50">취소</button>
                <button onClick={handleEveryTimeImport}
                  disabled={!pasteText.trim()}
                  className="px-4 py-2 text-sm text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 font-medium">가져오기</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SectionCard title="교과목 수강 내역 | Course History" icon={BookOpen}>
        <div className="space-y-2">
          {(curr.courses || []).map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="grid grid-cols-3 gap-3 flex-1">
                <InputField label="학기" value={c.semester} onChange={v => updateCourse(i, { semester: v })} placeholder="2024-1" />
                <InputField label="과목명" value={c.name} onChange={v => updateCourse(i, { name: v })} placeholder="이산수학" />
                <InputField label="성적" value={c.grade} onChange={v => updateCourse(i, { grade: v })} placeholder="A+" />
              </div>
              <button onClick={() => removeCourse(i)} className="p-1.5 text-gray-300 hover:text-red-400 mt-5"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addCourse}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 과목 추가
          </button>
        </div>
      </SectionCard>

      {/* 이수 현황 */}
      <SectionCard title="이수 현황 | Credit Status" icon={GraduationCap} description="구분별 기준학점, 취득학점, 잔여학점, 달성률을 관리합니다">
        <div className="space-y-2">
          {(curr.creditStatus || []).length > 0 && (
            <div className="grid grid-cols-6 gap-2 px-3 mb-1">
              <span className="text-xs text-gray-400 font-medium">구분</span>
              <span className="text-xs text-gray-400 font-medium">영역</span>
              <span className="text-xs text-gray-400 font-medium">기준학점</span>
              <span className="text-xs text-gray-400 font-medium">취득학점</span>
              <span className="text-xs text-gray-400 font-medium">잔여학점</span>
              <span className="text-xs text-gray-400 font-medium">달성률</span>
            </div>
          )}
          {(curr.creditStatus || []).map((cs, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-surface-50 rounded-xl">
              <div className="grid grid-cols-6 gap-2 flex-1">
                <input value={cs.category || ''} onChange={e => updateCreditStatus(i, { category: e.target.value })} placeholder="전공" className="px-2 py-1.5 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                <input value={cs.area || ''} onChange={e => updateCreditStatus(i, { area: e.target.value })} placeholder="전공선택" className="px-2 py-1.5 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                <input value={cs.required || ''} onChange={e => updateCreditStatus(i, { required: e.target.value })} placeholder="60" className="px-2 py-1.5 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                <input value={cs.earned || ''} onChange={e => updateCreditStatus(i, { earned: e.target.value })} placeholder="45" className="px-2 py-1.5 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                <input value={cs.remaining || ''} onChange={e => updateCreditStatus(i, { remaining: e.target.value })} placeholder="15" className="px-2 py-1.5 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
                <input value={cs.rate || ''} onChange={e => updateCreditStatus(i, { rate: e.target.value })} placeholder="75%" className="px-2 py-1.5 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200" />
              </div>
              <button onClick={() => removeCreditStatus(i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addCreditStatus}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 이수 현황 행 추가
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ── Extracurricular Section ──
function ExtracurricularSection({ portfolio, update, updateNested, templateId, jobAnalysis }) {
  const extra = portfolio.extracurricular || { summary: '', badges: [], languages: [], details: [] };

  const updateExtraField = (field, value) => {
    update('extracurricular', { ...extra, [field]: value });
  };

  const addDetail = () => {
    updateExtraField('details', [...(extra.details || []), { title: '', description: '', period: '' }]);
  };
  const removeDetail = (idx) => {
    updateExtraField('details', extra.details.filter((_, i) => i !== idx));
  };
  const updateDetail = (idx, changes) => {
    const details = [...extra.details];
    details[idx] = { ...details[idx], ...changes };
    updateExtraField('details', details);
  };

  const addBadge = () => {
    updateExtraField('badges', [...(extra.badges || []), { name: '', issuer: '' }]);
  };
  const removeBadge = (idx) => {
    updateExtraField('badges', extra.badges.filter((_, i) => i !== idx));
  };
  const updateBadge = (idx, changes) => {
    const badges = [...extra.badges];
    badges[idx] = { ...badges[idx], ...changes };
    updateExtraField('badges', badges);
  };

  const addLang = () => {
    updateExtraField('languages', [...(extra.languages || []), { name: '', score: '', date: '' }]);
  };
  const removeLang = (idx) => {
    updateExtraField('languages', extra.languages.filter((_, i) => i !== idx));
  };
  const updateLang = (idx, changes) => {
    const languages = [...extra.languages];
    languages[idx] = { ...languages[idx], ...changes };
    updateExtraField('languages', languages);
  };

  return (
    <>
      <SectionCard title={templateId === 'academic' ? '비교과 활동 & 자격증 | Extracurricular' : '비교과 활동 | Extracurricular Activities'} icon={Star} description={templateId === 'academic' ? '뽑낙활동, 디지털 배지, 어학 성적, 자격증 등을 입력하세요' : '비교과 프로그램, 디지털 배지, 어학 성적 등을 입력하세요'} sectionType="extracurricular" jobAnalysis={jobAnalysis}>
        <TextareaField label={templateId === 'academic' ? '비교과 활동 요약' : '비교과 요약'} value={extra.summary} onChange={v => updateExtraField('summary', v)}
          placeholder={templateId === 'academic' ? '동아리, 학생회, 보조교사, 학교 활동 등 비교과 이력을 요약하세요' : '비교과 프로그램 이수 내역, 졸업 요건 충족 현황 등을 자유롭게 적어주세요'} rows={3} />
      </SectionCard>

      <SectionCard title="디지털 배지 | Digital Badge" icon={Award}>
        <div className="space-y-2">
          {(extra.badges || []).map((b, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="grid grid-cols-2 gap-3 flex-1">
                <InputField label="배지명" value={b.name} onChange={v => updateBadge(i, { name: v })} placeholder="SKKU Tutoring: Tutor" />
                <InputField label="발급기관" value={b.issuer} onChange={v => updateBadge(i, { issuer: v })} placeholder="Lecos" />
              </div>
              <button onClick={() => removeBadge(i)} className="p-1.5 text-gray-300 hover:text-red-400 mt-5"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addBadge}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 배지 추가
          </button>
        </div>
      </SectionCard>

      <SectionCard title="어학 성적 | Language Certification" icon={Globe}>
        <div className="space-y-2">
          {(extra.languages || []).map((l, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <div className="grid grid-cols-3 gap-3 flex-1">
                {/* 시험명 드롭다운 + 직접 입력 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-medium">시험명</label>
                  <select
                    value={['TOEIC', 'TOEFL', 'IELTS', 'TOEIC Speaking', 'OPIc', 'JLPT', 'JPT', 'HSK', 'DELF', 'FLEX', 'SNULT'].includes(l.name) ? l.name : '__custom'}
                    onChange={e => {
                      if (e.target.value === '__custom') updateLang(i, { name: '' });
                      else updateLang(i, { name: e.target.value });
                    }}
                    className="w-full px-2 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 bg-white"
                  >
                    <option value="TOEIC">TOEIC</option>
                    <option value="TOEFL">TOEFL</option>
                    <option value="IELTS">IELTS</option>
                    <option value="TOEIC Speaking">TOEIC Speaking</option>
                    <option value="OPIc">OPIc</option>
                    <option value="JLPT">JLPT</option>
                    <option value="JPT">JPT</option>
                    <option value="HSK">HSK</option>
                    <option value="DELF">DELF</option>
                    <option value="FLEX">FLEX</option>
                    <option value="SNULT">SNULT</option>
                    <option value="__custom">직접 입력</option>
                  </select>
                  {!['TOEIC', 'TOEFL', 'IELTS', 'TOEIC Speaking', 'OPIc', 'JLPT', 'JPT', 'HSK', 'DELF', 'FLEX', 'SNULT'].includes(l.name) && (
                    <input
                      value={l.name || ''}
                      onChange={e => updateLang(i, { name: e.target.value })}
                      placeholder="시험명 직접 입력"
                      className="w-full mt-1 px-2 py-1.5 border border-surface-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary-200"
                    />
                  )}
                </div>
                <InputField label="점수/등급" value={l.score} onChange={v => updateLang(i, { score: v })} placeholder="900" />
                {/* 취득일 캘린더 */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1 font-medium">취득일</label>
                  <input
                    type="date"
                    value={l.date || ''}
                    onChange={e => updateLang(i, { date: e.target.value })}
                    className="w-full px-2 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
                  />
                </div>
              </div>
              <button onClick={() => removeLang(i)} className="p-1.5 text-gray-300 hover:text-red-400 mt-5"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={addLang}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 어학 성적 추가
          </button>
        </div>
      </SectionCard>

      <SectionCard title={templateId === 'academic' ? '자격증 & 세부 활동 | Certifications' : '세부 사항 | Details'} icon={Star}>
        <div className="space-y-3">
          {(extra.details || []).map((d, i) => (
            <div key={i} className="p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-700">{templateId === 'academic' ? `자격증/활동 #${i + 1}` : `활동 #${i + 1}`}</span>
                <button onClick={() => removeDetail(i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-3 mb-2">
                <InputField label="기간" value={d.period} onChange={v => updateDetail(i, { period: v })} placeholder="2025.01 - 2025.06" />
                <InputField label={templateId === 'academic' ? '자격증/활동명' : '활동명'} value={d.title} onChange={v => updateDetail(i, { title: v })} placeholder={templateId === 'academic' ? '정보처리기사, SQLD, AWS Solutions Architect...' : '학술동아리 MIMIC'} />
              </div>
              <TextareaField label="설명" value={d.description} onChange={v => updateDetail(i, { description: v })}
                placeholder={templateId === 'academic' ? '취득 기관, 점수/등급, 취득 계기 또는 활동 내용...' : '활동 소개, 참여 동기, 활동 내용 등'} rows={3} />
            </div>
          ))}
          <button onClick={addDetail}
            className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
            <Plus size={14} /> 활동 추가
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ── Skills Section ──
const SKILL_PROFICIENCY_LEVELS = [
  { value: 1, label: '기초', color: 'bg-gray-300' },
  { value: 2, label: '초급', color: 'bg-blue-300' },
  { value: 3, label: '중급', color: 'bg-green-400' },
  { value: 4, label: '상급', color: 'bg-amber-400' },
  { value: 5, label: '전문가', color: 'bg-red-400' },
];

function SkillCategoryInput({ category, label, placeholder, items, presets, onUpdate }) {
  const [customInput, setCustomInput] = useState('');
  const [editingSkill, setEditingSkill] = useState(null);

  const getItemName = (item) => typeof item === 'string' ? item : item.name;
  const getItemProficiency = (item) => typeof item === 'string' ? 0 : (item.proficiency || 0);
  const selectedNames = items.map(getItemName);

  const toggleSkill = (name) => {
    if (selectedNames.includes(name)) {
      onUpdate(items.filter(item => getItemName(item) !== name));
    } else {
      onUpdate([...items, { name, proficiency: 3 }]);
    }
  };

  const setProficiency = (name, level) => {
    onUpdate(items.map(item =>
      getItemName(item) === name
        ? { name: getItemName(item), proficiency: level }
        : (typeof item === 'string' ? { name: item, proficiency: 0 } : item)
    ));
    setEditingSkill(null);
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val || selectedNames.includes(val)) return;
    onUpdate([...items, { name: val, proficiency: 3 }]);
    setCustomInput('');
  };

  return (
    <div className="mb-5">
      <label className="block text-xs text-gray-500 mb-2 font-medium">{label}</label>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {items.map((item, i) => {
            const name = getItemName(item);
            const prof = getItemProficiency(item);
            return (
              <div key={i} className="relative">
                <button
                  type="button"
                  onClick={() => setEditingSkill(editingSkill === name ? null : name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium border border-primary-200 hover:bg-primary-100 transition-colors"
                >
                  {name}
                  {prof > 0 && (
                    <span className="flex gap-0.5 ml-1">
                      {[1,2,3,4,5].map(l => (
                        <span key={l} className={`w-1.5 h-3 rounded-sm ${l <= prof ? SKILL_PROFICIENCY_LEVELS[prof-1].color : 'bg-gray-200'}`} />
                      ))}
                    </span>
                  )}
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); toggleSkill(name); }}
                    className="hover:text-red-500 ml-0.5"
                  >
                    <X size={11} />
                  </span>
                </button>
                {editingSkill === name && (
                  <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-surface-200 rounded-xl shadow-lg p-2 min-w-[160px]">
                    <p className="text-[12px] text-gray-400 mb-1.5 px-1">수준 설정</p>
                    {SKILL_PROFICIENCY_LEVELS.map(lv => (
                      <button
                        key={lv.value}
                        type="button"
                        onClick={() => setProficiency(name, lv.value)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-surface-50 transition-colors ${prof === lv.value ? 'bg-primary-50 text-primary-700' : 'text-gray-600'}`}
                      >
                        <span className="flex gap-0.5">
                          {[1,2,3,4,5].map(l => (
                            <span key={l} className={`w-1.5 h-3 rounded-sm ${l <= lv.value ? lv.color : 'bg-gray-200'}`} />
                          ))}
                        </span>
                        {lv.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {(presets || []).map(name => {
          const isSelected = selectedNames.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleSkill(name)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-primary-100 text-primary-700 border-primary-300'
                  : 'bg-surface-50 text-gray-500 border-surface-200 hover:border-primary-300 hover:text-primary-600'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" onClick={addCustom}
          className="px-3 py-2 bg-surface-100 text-gray-500 rounded-lg text-xs hover:bg-surface-200 transition-colors">
          추가
        </button>
      </div>
    </div>
  );
}

function SkillsSection({ portfolio, update, templateId, jobAnalysis }) {
  const skills = portfolio.skills || { tools: [], languages: [], frameworks: [], others: [] };

  const updateSkillCategory = (category, value) => {
    update('skills', { ...skills, [category]: value });
  };

  const PRESETS = {
    tools: templateId === 'ashley'
      ? ['Notion', 'Figma', 'Photoshop', 'Illustrator', 'InDesign', 'Canva', 'Lightroom', 'Mailchimp', 'Squarespace', 'WordPress', 'Slack', 'Trello']
      : templateId === 'academic'
      ? ['VS Code', 'IntelliJ', 'PyCharm', 'MATLAB', 'Jupyter', 'LaTeX', 'GitHub', 'Excel', 'PowerPoint', 'Notion', 'Figma', 'Slack']
      : ['Notion', 'Figma', 'Photoshop', 'Illustrator', 'Canva', 'Slack', 'Jira', 'Excel', 'PowerPoint', 'Premiere Pro', 'VS Code', 'GitHub'],
    languages: templateId === 'ashley'
      ? ['한국어(원어민)', '영어(유창)', '영어(비즈니스)', '일본어(기초)', '스페인어(기초)', '중국어(기초)', '프랑스어(기초)']
      : ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go', 'Swift', 'Kotlin', 'Ruby', 'SQL', 'R', 'MATLAB'],
    frameworks: templateId === 'ashley'
      ? ['Google Analytics', 'Facebook Ads', 'Instagram Insights', 'Brunch', 'YouTube', 'WordPress', 'Squarespace', 'Airtable', 'Notion']
      : ['React', 'Vue.js', 'Angular', 'Next.js', 'Spring', 'Django', 'Express.js', 'Node.js', 'TensorFlow', 'PyTorch', 'Flutter', 'Tailwind CSS'],
    others: templateId === 'ashley'
      ? ['브랜딩', '스토리텔링', '콘텐츠 기획·제작', '온오프라인 마케팅', 'PR', '굿즈 제작', '강연·모더레이터', '에디팅', '카피라이팅', '커뮤니티 운영']
      : templateId === 'academic'
      ? ['데이터 분석', '수학적 모델링', '논문 작성', '실험 설계', '프로젝트 관리', '발표', '팀 리더십', '연구']
      : ['데이터 분석', '수학적 모델링', 'UI/UX 디자인', '프로젝트 관리', '기획', '마케팅', '글쓰기', '발표', '리더십'],
  };

  return (
    <SectionCard
      title={
        templateId === 'ashley' ? '이런 일을 할 수 있어요 (Skills & Capabilities)' :
        templateId === 'academic' ? 'Skills & Certifications' :
        '기술 | Skills'
      }
      icon={Code}
      sectionType="skills"
      jobAnalysis={jobAnalysis}
      description={
        templateId === 'ashley'
          ? 'Marketing, Creative Cloud, Tools, Entrepreneurial Mind 등 카테고리별로 할 수 있는 일을 입력하세요'
          : templateId === 'academic'
          ? '개발 도구, 프로그래밍 언어, 프레임워크, 기타 역량을 선택하고 수준을 설정하세요'
          : '도구, 프로그래밍 언어, 프레임워크 등을 선택하고 수준을 설정하세요. 클릭하여 선택, 다시 클릭하면 수준 설정이 가능합니다.'
      }
    >
      <SkillCategoryInput category="tools"
        label={templateId === 'ashley' ? 'Tools & Software' : '도구 (Tools)'}
        placeholder={templateId === 'ashley' ? '기타 도구 입력... (예: 먼데이, G Suite)' : '기타 도구 직접 입력...'}
        items={skills.tools || []}
        presets={PRESETS.tools}
        onUpdate={(val) => updateSkillCategory('tools', val)} />
      <SkillCategoryInput category="languages"
        label={templateId === 'ashley' ? '언어 능력' : '프로그래밍 언어'}
        placeholder={templateId === 'ashley' ? '기타 언어 입력...' : '기타 언어 직접 입력...'}
        items={skills.languages || []}
        presets={PRESETS.languages}
        onUpdate={(val) => updateSkillCategory('languages', val)} />
      <SkillCategoryInput category="frameworks"
        label={templateId === 'ashley' ? '플랫폼 & 채널' : '프레임워크/라이브러리'}
        placeholder={templateId === 'ashley' ? '기타 플랫폼 입력...' : '기타 프레임워크 입력...'}
        items={skills.frameworks || []}
        presets={PRESETS.frameworks}
        onUpdate={(val) => updateSkillCategory('frameworks', val)} />
      <SkillCategoryInput category="others"
        label={templateId === 'ashley' ? '전문 역량 (할 수 있는 일)' : templateId === 'academic' ? '기타 역량 & 연구 스킬' : '기타 역량'}
        placeholder={templateId === 'ashley' ? '예: 브랜딩, 콘텐츠 기획, PR...' : '기타 역량 직접 입력...'}
        items={skills.others || []}
        presets={PRESETS.others}
        onUpdate={(val) => updateSkillCategory('others', val)} />
    </SectionCard>
  );
}

// ── Goals Section ──
function GoalsSection({ portfolio, addToArray, removeFromArray, updateArrayItem, templateId, jobAnalysis }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const typeLabel = { short: '단기', mid: '중기', long: '장기' };
  const typeColor = { short: 'bg-blue-100 text-blue-700', mid: 'bg-violet-100 text-violet-700', long: 'bg-teal-100 text-teal-700' };
  const statusColor = { done: 'bg-green-100 text-green-700', ing: 'bg-amber-100 text-amber-700', planned: 'bg-gray-100 text-gray-600' };
  const statusLabel = { done: '완료', ing: '진행 중', planned: '예정' };
  return (
    <SectionCard
      title={templateId === 'academic' ? 'Personal Statement & 목표' : '목표와 계획 | Future Plans'}
      icon={Target}
      sectionType="goals"
      jobAnalysis={jobAnalysis}
      description={
        templateId === 'academic'
          ? '포트폴리오 하단 Personal Statement 영역에 표시됩니다. 클릭하면 세부 편집'
          : '단기/장기 목표를 적어보세요. 클릭하면 세부 편집'
      }
    >
      <div className="space-y-3">
        {(portfolio.goals || []).map((goal, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Target size={16} className="text-teal-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-700 truncate">{goal.title || '(목표 없음)'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[12px] font-medium ${typeColor[goal.type] || typeColor.short}`}>
                        {typeLabel[goal.type] || '단기'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[12px] font-medium ${statusColor[goal.status] || statusColor.planned}`}>
                        {statusLabel[goal.status] || '예정'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); removeFromArray('goals', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-100 pt-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">유형</label>
                      <div className="flex gap-2">
                        {Object.entries(typeLabel).map(([val, lbl]) => (
                          <button key={val} onClick={() => updateArrayItem('goals', i, { type: val })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${goal.type === val ? `${typeColor[val]} border-transparent ring-1 ring-offset-1 ring-gray-300` : 'bg-white border-surface-200 text-gray-400 hover:bg-surface-50'}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">상태</label>
                      <div className="flex gap-2">
                        {Object.entries(statusLabel).map(([val, lbl]) => (
                          <button key={val} onClick={() => updateArrayItem('goals', i, { status: val })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${goal.status === val ? `${statusColor[val]} border-transparent ring-1 ring-offset-1 ring-gray-300` : 'bg-white border-surface-200 text-gray-400 hover:bg-surface-50'}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <InputField label="목표" value={goal.title} onChange={v => updateArrayItem('goals', i, { title: v })}
                    placeholder={templateId === 'academic' ? '예: 열거 조합론 분야 국제 저널 논문 제출' : '목표명'} />
                  <TextareaField label={templateId === 'academic' ? '상세 내용 / 계획' : '상세 계획'} value={goal.description}
                    onChange={v => updateArrayItem('goals', i, { description: v })}
                    placeholder={templateId === 'academic' ? '구체적인 연구 방향, 기대 성과, 준비 과정...' : '구체적인 계획과 기한...'} rows={3} />
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => addToArray('goals', { title: '', description: '', type: 'short', status: 'planned' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> {templateId === 'academic' ? 'Personal Statement / 목표 추가' : '목표 추가'}
        </button>
      </div>
    </SectionCard>
  );
}

// ── Values Section ──
function ValuesSection({ portfolio, update, templateId, jobAnalysis }) {
  const sectionTitle = templateId === 'ashley'
    ? '나를 들려주는 이야기'
    : templateId === 'academic'
      ? '자기소개 에세이 | About Me'
      : '가치관 | Values';
  const sectionDesc = templateId === 'ashley'
    ? '나의 이야기, 독립적인 삶의 방식, 가치관 등을 자유롭게 풀어내는 메인 스토리 섹션'
    : templateId === 'academic'
      ? '포트폴리오 About Me 섹션에 표시됩니다. 학문적 여정, 연구 관심사, 미래 비전을 담아보세요'
      : '포트폴리오 하단에 표시되는 자기소개 에세이를 작성하세요';
  const placeholder = templateId === 'ashley'
    ? '저는 미국 45개주와 28개국을 여행한 적 있어요. 낯선 곳에 뛰어들고, 새로운 사람을 만나고, 그 경험을 글과 콘텐츠로 기록하는 것이 제 삶의 방식이에요...'
    : templateId === 'academic'
      ? '저는 수학의 아름다움에 매료되어 이 길을 선택했습니다. 특히 조합론과 그래프 이론의 교차점에서 연구를 이어가고 있으며, 이론과 응용 사이의 다리를 놓는 연구자가 되는 것이 목표입니다...'
      : '제가 추구하는 가치와 신념에 대해 자유롭게 작성해주세요...';
  const rows = templateId === 'ashley' ? 14 : 10;
  return (
    <SectionCard title={sectionTitle} icon={MessageSquare} description={sectionDesc} sectionType="values" jobAnalysis={jobAnalysis}>
      <label className="block text-xs text-gray-500 mb-1.5 font-medium">
        {templateId === 'ashley' ? '나의 이야기' : templateId === 'academic' ? '자기소개 에세이' : '가치관 에세이'}
      </label>
      <div className="rounded-lg border border-surface-200 px-3 py-2 focus-within:ring-2 focus-within:ring-primary-200 min-h-[140px]">
        <YooptaMiniEditor
          value={portfolio.valuesEssayBlocks || portfolio.valuesEssay || ''}
          onChange={v => { update('valuesEssayBlocks', v); update('valuesEssay', richValueToPlainText(v)); }}
          placeholder={placeholder}
          minHeight={120}
        />
      </div>
    </SectionCard>
  );
}

// ── Contact Section ──
// ── Ashley 전용: 인터뷰 섹션 ──
function InterviewsSection({ portfolio, addToArray, removeFromArray, updateArrayItem, jobAnalysis }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  return (
    <SectionCard title="인터뷰" icon={Mic} description="매체 인터뷰, 팟캐스트 출연 등을 기록하세요. 클릭하면 세부 편집">
      <div className="space-y-3">
        {(portfolio.interviews || []).map((item, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <Mic size={16} className="text-rose-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{item.title || '(제목 없음)'}</p>
                    <p className="text-xs text-gray-400">{item.media && `${item.media}`}{item.year && ` · ${item.year}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); removeFromArray('interviews', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-100 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="매체" value={item.media} onChange={v => updateArrayItem('interviews', i, { media: v })} placeholder="요즘사, 톱클래스, 디렉토리 등" />
                    <InputField label="연도" value={item.year} onChange={v => updateArrayItem('interviews', i, { year: v })} placeholder="2022" />
                    <div className="col-span-2">
                      <InputField label="제목 / 주제" value={item.title} onChange={v => updateArrayItem('interviews', i, { title: v })} placeholder="6번의 퇴사 후 깨달은 것, 다능인으로 사는 법" />
                    </div>
                    <div className="col-span-2">
                      <InputField label="링크 (선택)" value={item.link} onChange={v => updateArrayItem('interviews', i, { link: v })} placeholder="https://" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => addToArray('interviews', { media: '', title: '', link: '', year: '' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 인터뷰 추가
        </button>
      </div>
    </SectionCard>
  );
}

// ── Ashley 전용: 저서 & 글쓰기 섹션 ──
const BOOK_TYPES = ['단독 저서', '공저', '독립출판', '기고/연재', '기타'];
function BooksSection({ portfolio, addToArray, removeFromArray, updateArrayItem, jobAnalysis }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  return (
    <SectionCard title="저서 & 글쓰기" icon={BookOpen} description="출간한 책, 독립출판, 브런치 연재, 기고 등을 기록하세요. 클릭하면 세부 편집" sectionType="books" jobAnalysis={jobAnalysis}>
      <div className="space-y-3">
        {(portfolio.books || []).map((item, i) => {
          const isExpanded = expandedIdx === i;
          const typeColorMap = { '단독 저서': 'bg-blue-100 text-blue-700', '공저': 'bg-purple-100 text-purple-700', '독립출판': 'bg-orange-100 text-orange-700', '기고/연재': 'bg-green-100 text-green-700', '기타': 'bg-gray-100 text-gray-600' };
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={16} className="text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{item.title || '(제목 없음)'}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.type && <span className={`px-1.5 py-0.5 rounded text-[12px] font-medium ${typeColorMap[item.type] || typeColorMap['기타']}`}>{item.type}</span>}
                      {item.year && <span className="text-xs text-gray-400">{item.year}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); removeFromArray('books', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-100 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <InputField label="제목" value={item.title} onChange={v => updateArrayItem('books', i, { title: v })} placeholder="퇴사는 여행 / 오늘도 리추얼" />
                    </div>
                    <InputField label="연도" value={item.year} onChange={v => updateArrayItem('books', i, { year: v })} placeholder="2021" />
                    <div>
                      <label className="block text-xs text-gray-500 mb-1 font-medium">유형</label>
                      <select value={item.type || '단독 저서'} onChange={e => updateArrayItem('books', i, { type: e.target.value })}
                        className="w-full px-2 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200 bg-white">
                        {BOOK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <InputField label="출판사 / 플랫폼" value={item.publisher} onChange={v => updateArrayItem('books', i, { publisher: v })} placeholder="북노마드, 브런치, 텀블벅 등" />
                    <InputField label="링크 (선택)" value={item.link} onChange={v => updateArrayItem('books', i, { link: v })} placeholder="https://yes24.com/..." />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => addToArray('books', { title: '', year: '', publisher: '', type: '단독 저서', link: '' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 저서 추가
        </button>
      </div>
    </SectionCard>
  );
}

// ── Ashley 전용: 강연 & 모더레이터 섹션 ──
function LecturesSection({ portfolio, addToArray, removeFromArray, updateArrayItem, jobAnalysis }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  return (
    <SectionCard title="강연 & 모더레이터" icon={Users} description="강연, 토크, 북토크, 모더레이터 경험을 기록하세요. 클릭하면 세부 편집" sectionType="lectures" jobAnalysis={jobAnalysis}>
      <div className="space-y-3">
        {(portfolio.lectures || []).map((item, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div key={i} className="bg-surface-50 rounded-xl border border-surface-100 overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface-100/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-700 truncate">{item.title || '(강연 제목 없음)'}</p>
                    <p className="text-xs text-gray-400">{item.org && `${item.org}`}{item.year && ` · ${item.year}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); removeFromArray('lectures', i); }} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-100 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="연도" value={item.year} onChange={v => updateArrayItem('lectures', i, { year: v })} placeholder="2021" />
                    <InputField label="주최 / 기관" value={item.org} onChange={v => updateArrayItem('lectures', i, { org: v })} placeholder="헤이조이스, 퍼블리, 커리어리 등" />
                    <div className="col-span-2">
                      <InputField label="강연 제목 / 주제" value={item.title} onChange={v => updateArrayItem('lectures', i, { title: v })} placeholder="브랜딩 마인드셋: 브랜드와 나의 자기다움 찾기" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => addToArray('lectures', { year: '', org: '', title: '' })}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 강연 추가
        </button>
      </div>
    </SectionCard>
  );
}

// ── Ashley 전용: 독특한 경험 / Fun Facts 섹션 ──
function FunFactsSection({ portfolio, addToArray, removeFromArray, updateArrayItem, jobAnalysis }) {
  return (
    <SectionCard title="그 외 독특한 경험 / Fun Facts" icon={Zap} description="특별하거나 재미있는 경험을 자유롭게 기록하세요 (에어비앤비 호스트, 밴드 활동 등)">
      <div className="space-y-2">
        {(portfolio.funfacts || []).map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm text-gray-400">•</span>
            <input value={item} onChange={e => updateArrayItem('funfacts', i, e.target.value)}
              className="flex-1 px-3 py-2 border border-surface-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="에어비앤비 체험 호스트, 밴드 활동 일렉 기타, 미국 45개주 여행 등" />
            <button onClick={() => removeFromArray('funfacts', i)} className="p-1.5 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={() => addToArray('funfacts', '')}
          className="flex items-center gap-1.5 px-4 py-2 border border-dashed border-surface-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all">
          <Plus size={14} /> 독특한 경험 추가
        </button>
      </div>
    </SectionCard>
  );
}

function ContactSection({ portfolio, updateNested, templateId, jobAnalysis }) {
  const contact = portfolio.contact || {};
  const sectionDesc = templateId === 'ashley'
    ? 'SNS, 이메일, 브런치, 유튜브 등 크리에이티브 채널을 입력하세요'
    : templateId === 'academic'
      ? '이메일, LinkedIn, GitHub 등 학술·개발 연락처를 입력하세요'
      : 'SNS, 이메일 등 연락 수단을 입력하세요';
  return (
    <SectionCard title={templateId === 'academic' ? 'Contact Information' : '연락처 | Contact'} icon={Mail} description={sectionDesc} sectionType="contact" jobAnalysis={jobAnalysis}>
      <div className="grid grid-cols-2 gap-4">
        <InputField label="이메일" value={contact.email} onChange={v => updateNested('contact', 'email', v)} placeholder="email@example.com" />
        <InputField label="전화번호" value={contact.phone} onChange={v => updateNested('contact', 'phone', v)} placeholder="+82 10-0000-0000" />
        {templateId === 'ashley' ? (
          <>
            <InputField label="Instagram" value={contact.instagram} onChange={v => updateNested('contact', 'instagram', v)} placeholder="@username" />
            <InputField label="Brunch" value={contact.brunch} onChange={v => updateNested('contact', 'brunch', v)} placeholder="brunch.co.kr/@username" />
            <InputField label="YouTube" value={contact.youtube} onChange={v => updateNested('contact', 'youtube', v)} placeholder="youtube.com/@channel" />
            <InputField label="웹사이트" value={contact.website} onChange={v => updateNested('contact', 'website', v)} placeholder="https://..." />
          </>
        ) : templateId === 'academic' ? (
          <>
            <InputField label="LinkedIn" value={contact.linkedin} onChange={v => updateNested('contact', 'linkedin', v)} placeholder="www.linkedin.com/in/..." />
            <InputField label="GitHub" value={contact.github} onChange={v => updateNested('contact', 'github', v)} placeholder="github.com/username" />
            <InputField label="Google Scholar" value={contact.scholar} onChange={v => updateNested('contact', 'scholar', v)} placeholder="scholar.google.com/..." />
            <InputField label="웹사이트" value={contact.website} onChange={v => updateNested('contact', 'website', v)} placeholder="https://..." />
          </>
        ) : (
          <>
            <InputField label="LinkedIn" value={contact.linkedin} onChange={v => updateNested('contact', 'linkedin', v)} placeholder="www.linkedin.com/in/..." />
            <InputField label="Instagram" value={contact.instagram} onChange={v => updateNested('contact', 'instagram', v)} placeholder="@username" />
            <InputField label="GitHub" value={contact.github} onChange={v => updateNested('contact', 'github', v)} placeholder="github.com/username" />
            <InputField label="웹사이트" value={contact.website} onChange={v => updateNested('contact', 'website', v)} placeholder="https://..." />
          </>
        )}
      </div>
    </SectionCard>
  );
}
