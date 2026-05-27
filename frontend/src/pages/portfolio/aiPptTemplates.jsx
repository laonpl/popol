/**
 * AI PPT 포트폴리오 — 공유 템플릿 모듈.
 * 같은 슬라이드 JSON을 React 미리보기와 PptxGenJS 출력에서 동일하게 렌더링.
 *
 * Slide schema:
 *   { id, layout, title, subtitle?, bullets?[],
 *     items?[{heading,period,role,body,bullets[],metrics[{label,value,before,after}]}],
 *     notes? }
 *   layout: cover | profile | education | experience | skills | awards | values | contact | closing | section
 */

export const TEMPLATES = [
  // ── 1번 템플릿: 제안서형 아웃소싱 솔루션 스타일 ──
  {
    id: 'proposal',
    name: '제안서형 (Proposal)',
    description: '다크 커버 · 오렌지 액센트 · 컨설팅 제안서형 구조',
    style: 'proposal',
    colors: { bg: '#F6F6F7', accent: '#FF4F1A', sub: '#262629', muted: '#7A7A7D', line: '#E8E8EA', side: '#1F1D20', sideFg: '#FFFFFF', kpi: '#FF4F1A', headBg: '#1F1D20', headFg: '#FFFFFF', card: '#FFFFFF', dark: '#1F1D20', dark2: '#2B292C', neutral: '#7D7D7A' },
    fonts: { heading: 'Pretendard', body: 'Pretendard' },
  },
  // ── 기본 합격자 스타일 (3가지) ──
  {
    id: 'modern',
    name: '모던 (Modern)',
    description: '다크 사이드바 + 산세리프, IT/스타트업 합격자 스타일',
    style: 'sidebar',
    colors: { bg: '#FFFFFF', accent: '#0F172A', sub: '#475569', muted: '#94A3B8', line: '#E2E8F0', side: '#0F172A', sideFg: '#FFFFFF', kpi: '#0F172A', headBg: '#0F172A', headFg: '#FFFFFF' },
    fonts: { heading: 'Pretendard', body: 'Pretendard' },
  },
  {
    id: 'classic',
    name: '클래식 (Classic)',
    description: '세리프 + 골드 라인, 대기업/금융 정중한 스타일',
    style: 'centered',
    colors: { bg: '#FBFAF6', accent: '#1F1B16', sub: '#5B5346', muted: '#8C826E', line: '#C9A961', side: '#FBFAF6', sideFg: '#1F1B16', kpi: '#8C6F3A', headBg: '#EDE8D8', headFg: '#1F1B16' },
    fonts: { heading: 'Noto Serif KR', body: 'Pretendard' },
  },
  {
    id: 'creative',
    name: '크리에이티브 (Creative)',
    description: '컬러 블록 + 굵은 헤딩, 디자인/마케팅 임팩트',
    style: 'block',
    colors: { bg: '#FFFFFF', accent: '#FF5A5F', sub: '#1F2937', muted: '#9CA3AF', line: '#FFE4E6', side: '#FF5A5F', sideFg: '#FFFFFF', kpi: '#FF5A5F', headBg: '#FF5A5F', headFg: '#FFFFFF' },
    fonts: { heading: 'Pretendard', body: 'Pretendard' },
  },
  // ── 직군별 디자인 테마 (10가지) ──
  {
    id: 'lean-dev',
    name: 'Lean Dev',
    description: '가설 검증 · 린 스타트업 엔지니어',
    style: 'sidebar',
    category: 'theme',
    colors: { bg: '#000000', accent: '#FFFFFF', sub: '#F5F5F5', muted: '#737373', line: '#333333', side: '#111111', sideFg: '#F5F5F5', kpi: '#FFFFFF', headBg: '#111111', headFg: '#F5F5F5' },
    fonts: { heading: 'Geist Mono', body: 'Inter' },
  },
  {
    id: 'notion-pm',
    name: 'Notion PM',
    description: '문서화 강점 · 기획자/PM 전용',
    style: 'centered',
    category: 'theme',
    colors: { bg: '#FFFFFF', accent: '#2F2F2F', sub: '#37352F', muted: '#9B9A97', line: '#E8E8E8', side: '#F7F7F5', sideFg: '#37352F', kpi: '#2F2F2F', headBg: '#F7F7F5', headFg: '#37352F' },
    fonts: { heading: 'Pretendard', body: 'Pretendard' },
  },
  {
    id: 'double-diamond',
    name: 'Double Diamond',
    description: '디자인 씽킹 · 프로덕트 디자이너',
    style: 'sidebar',
    category: 'theme',
    colors: { bg: '#FDFDFD', accent: '#4F46E5', sub: '#111827', muted: '#6B7280', line: '#E8E7FF', side: '#4F46E5', sideFg: '#FFFFFF', kpi: '#4F46E5', headBg: '#4F46E5', headFg: '#FFFFFF' },
    fonts: { heading: 'Syne', body: 'Inter' },
  },
  {
    id: 'bento-metric',
    name: 'Bento Metric',
    description: '그로스 해커 · 퍼포먼스 마케터',
    style: 'sidebar',
    category: 'theme',
    colors: { bg: '#F8FAFC', accent: '#2563EB', sub: '#0F172A', muted: '#475569', line: '#DBEAFE', side: '#2563EB', sideFg: '#FFFFFF', kpi: '#2563EB', headBg: '#2563EB', headFg: '#FFFFFF' },
    fonts: { heading: 'Inter', body: 'Inter' },
  },
  {
    id: 'startup-hustler',
    name: 'Startup Hustler',
    description: '창업가 · MVP 14일 출시',
    style: 'block',
    category: 'theme',
    colors: { bg: '#E2E8F0', accent: '#FF3366', sub: '#000000', muted: '#333333', line: '#FFE4EC', side: '#FF3366', sideFg: '#FFFFFF', kpi: '#FF3366', headBg: '#FF3366', headFg: '#FFFFFF' },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
  },
  {
    id: 'research-archival',
    name: 'Research Archival',
    description: '논문형 아카이브 · UX 리서처',
    style: 'centered',
    category: 'theme',
    colors: { bg: '#F7F5F0', accent: '#D9381E', sub: '#1C1917', muted: '#78716C', line: '#FCE8E4', side: '#F7F5F0', sideFg: '#1C1917', kpi: '#D9381E', headBg: '#EDE8E3', headFg: '#1C1917' },
    fonts: { heading: 'Georgia', body: 'Georgia' },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: '백엔드 아키텍트 · 시스템 엔지니어',
    style: 'sidebar',
    category: 'theme',
    colors: { bg: '#030712', accent: '#10B981', sub: '#F3F4F6', muted: '#9CA3AF', line: '#1F2937', side: '#111827', sideFg: '#F3F4F6', kpi: '#10B981', headBg: '#111827', headFg: '#10B981' },
    fonts: { heading: 'Inter', body: 'Inter' },
  },
  {
    id: 'ats-classic',
    name: 'ATS Classic',
    description: 'ATS 최적화 · 대기업 서류 합격',
    style: 'centered',
    category: 'theme',
    colors: { bg: '#FFFFFF', accent: '#000000', sub: '#111111', muted: '#555555', line: '#E5E5E5', side: '#FFFFFF', sideFg: '#111111', kpi: '#000000', headBg: '#F5F5F5', headFg: '#111111' },
    fonts: { heading: 'Georgia', body: 'Arial' },
  },
  {
    id: 'component-creator',
    name: 'Component Creator',
    description: '프론트엔드 · UX 엔지니어',
    style: 'sidebar',
    category: 'theme',
    colors: { bg: '#F4F4F5', accent: '#3B82F6', sub: '#18181B', muted: '#52525B', line: '#DBEAFE', side: '#3B82F6', sideFg: '#FFFFFF', kpi: '#3B82F6', headBg: '#3B82F6', headFg: '#FFFFFF' },
    fonts: { heading: 'Poppins', body: 'Inter' },
  },
  {
    id: 'sustainable',
    name: 'Sustainable Impact',
    description: 'ESG · 소셜 임팩트 기획자',
    style: 'centered',
    category: 'theme',
    colors: { bg: '#F4F1EB', accent: '#4A5D23', sub: '#333333', muted: '#7A7A7A', line: '#E5ECC7', side: '#F4F1EB', sideFg: '#333333', kpi: '#4A5D23', headBg: '#E8E4D9', headFg: '#333333' },
    fonts: { heading: 'Georgia', body: 'Inter' },
  },
];

// ── 색상 팔레트 (TEMPLATES에서 추출, 레이아웃과 독립적으로 조합 가능) ──
export const COLOR_PALETTES = TEMPLATES.map(t => ({
  id: t.id,
  name: t.name,
  description: t.description,
  colors: t.colors,
  fonts: t.fonts,
}));

// ── 합격 포트폴리오형 슬라이드 레이아웃 구조 ──
export const SLIDE_LAYOUTS = [
  {
    id: 'standard',
    name: '제안서형',
    description: '표지 · 목차 · 제안 배경 · 소개 · 서비스 방안 · 계획 및 조건을 제안서 흐름으로 구성',
    tag: '실무 제안',
    available: true,
  },
  {
    id: 'narrative',
    name: '스토리형',
    description: '한 줄 포지셔닝 → 문제의 시작 → 전환점 → 성과 → 다음 기여로 이어지는 성장 서사형',
    tag: '합격 서사',
    available: true,
  },
  {
    id: 'star',
    name: 'STAT/STAR형',
    description: 'Situation · Task · Action · Takeaway/Result를 경험별로 쪼개 면접 질문까지 연결하는 검증형',
    tag: '면접 증거',
    available: true,
  },
  {
    id: 'kpi-dashboard',
    name: 'KPI 대시보드',
    description: '핵심 지표 · Before/After · 프로젝트별 KPI · 성과 리스크까지 숫자로 읽히는 성과형',
    tag: '성과 수치',
    available: true,
  },
  {
    id: 'timeline',
    name: '타임라인',
    description: '마일스톤 · 역할 확장 · 성장 곡선 · 입사 후 90일 계획으로 연결하는 여정형',
    tag: '성장 곡선',
    available: true,
  },
  {
    id: 'case-study',
    name: '케이스 스터디',
    description: '대표 프로젝트 하나를 문제 · 제약 · 의사결정 · 실행 로그 · 결과 · 학습까지 깊게 파는 심화형',
    tag: '대표 사례',
    available: true,
  },
];

export function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}

const SAFE_DARK = '#1F1D20';
const SAFE_DARK_2 = '#2B292C';
const SAFE_NEUTRAL = '#5F5F63';
const SAFE_TEXT_DARK = '#18181B';
const SAFE_TEXT_LIGHT = '#FFFFFF';
const SAFE_MUTED_DARK = '#52525B';
const SAFE_MUTED_LIGHT = '#D4D4D8';

function normalizeHexColor(value, fallback = '#000000') {
  const raw = String(value || fallback).trim();
  const match = raw.match(/^#?([0-9a-fA-F]{6})$/);
  return `#${(match ? match[1] : fallback.replace('#', '')).toUpperCase()}`;
}

function hexToRgb(color) {
  const value = normalizeHexColor(color).slice(1);
  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
  };
}

function relativeLuminance(color) {
  const { red, green, blue } = hexToRgb(color);
  const channels = [red, green, blue].map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function isReadable(foreground, background, minimum = 4.5) {
  return contrastRatio(foreground, background) >= minimum;
}

function readableTextOn(background, preferred = SAFE_TEXT_DARK, minimum = 4.5) {
  const bg = normalizeHexColor(background);
  const preferredText = normalizeHexColor(preferred, SAFE_TEXT_DARK);
  if (isReadable(preferredText, bg, minimum)) return preferredText;
  return contrastRatio(SAFE_TEXT_LIGHT, bg) >= contrastRatio(SAFE_TEXT_DARK, bg) ? SAFE_TEXT_LIGHT : SAFE_TEXT_DARK;
}

function mutedTextOn(background, preferred = SAFE_MUTED_DARK) {
  const bg = normalizeHexColor(background);
  const preferredText = normalizeHexColor(preferred, SAFE_MUTED_DARK);
  if (isReadable(preferredText, bg, 3.2)) return preferredText;
  return readableTextOn(bg, relativeLuminance(bg) > 0.5 ? SAFE_MUTED_DARK : SAFE_MUTED_LIGHT, 3.2);
}

function visibleColorOn(background, preferred, fallback = SAFE_DARK) {
  const bg = normalizeHexColor(background);
  const preferredColor = normalizeHexColor(preferred, fallback);
  if (isReadable(preferredColor, bg, 2.4)) return preferredColor;
  const fallbackColor = normalizeHexColor(fallback, SAFE_DARK);
  if (isReadable(fallbackColor, bg, 2.4)) return fallbackColor;
  return readableTextOn(bg, fallbackColor, 2.4);
}

function darkSurface(color, fallback = SAFE_DARK_2) {
  const normalized = normalizeHexColor(color, fallback);
  if (isReadable(SAFE_TEXT_LIGHT, normalized, 4.5)) return normalized;
  const fallbackColor = normalizeHexColor(fallback, SAFE_DARK_2);
  return isReadable(SAFE_TEXT_LIGHT, fallbackColor, 4.5) ? fallbackColor : SAFE_DARK_2;
}

function normalizeProposalColors(colors = {}, baseColors = {}) {
  const merged = { ...baseColors, ...colors };
  const bg = normalizeHexColor(merged.bg || baseColors.bg || '#F6F6F7', '#F6F6F7');
  const card = normalizeHexColor(merged.card || baseColors.card || '#FFFFFF', '#FFFFFF');
  const accent = normalizeHexColor(merged.accent || baseColors.accent || '#FF4F1A', '#FF4F1A');
  const dark = darkSurface(merged.dark || merged.side || merged.headBg || baseColors.dark, baseColors.dark || SAFE_DARK);
  const dark2 = darkSurface(merged.dark2 || merged.side || merged.headBg || merged.sub || baseColors.dark2, baseColors.dark2 || SAFE_DARK_2);
  const neutral = darkSurface(merged.neutral || merged.muted || baseColors.neutral, SAFE_NEUTRAL);
  const side = darkSurface(merged.side || dark, dark);
  const headBg = darkSurface(merged.headBg || dark, dark);
  const sub = readableTextOn(bg, merged.sub || baseColors.sub || SAFE_TEXT_DARK);
  const muted = mutedTextOn(bg, merged.muted || baseColors.muted || SAFE_MUTED_DARK);

  return {
    ...merged,
    bg,
    card,
    accent,
    sub,
    muted,
    line: normalizeHexColor(merged.line || baseColors.line || '#E8E8EA', '#E8E8EA'),
    side,
    sideFg: readableTextOn(side, merged.sideFg || baseColors.sideFg || SAFE_TEXT_LIGHT),
    kpi: visibleColorOn(bg, merged.kpi || accent, dark),
    headBg,
    headFg: readableTextOn(headBg, merged.headFg || baseColors.headFg || SAFE_TEXT_LIGHT),
    cardFg: readableTextOn(card, sub),
    cardMuted: mutedTextOn(card, muted),
    dark,
    dark2,
    neutral,
    darkFg: readableTextOn(dark, SAFE_TEXT_LIGHT),
    dark2Fg: readableTextOn(dark2, SAFE_TEXT_LIGHT),
    neutralFg: readableTextOn(neutral, SAFE_TEXT_LIGHT),
    accentFg: readableTextOn(accent, SAFE_TEXT_LIGHT),
    accentOnBg: visibleColorOn(bg, accent, dark),
    accentOnCard: visibleColorOn(card, accent, dark),
  };
}

function normalizeProposalTemplate(template, baseTemplate = getTemplate('proposal')) {
  return {
    ...template,
    colors: normalizeProposalColors(template?.colors || {}, baseTemplate.colors || {}),
    fonts: template?.fonts || baseTemplate.fonts,
  };
}

function textClamp(lines = 2) {
  return {
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'keep-all',
    overflowWrap: 'anywhere',
  };
}

function fitText(lines = 2) {
  return { ...textClamp(lines), lineHeight: 1.35 };
}

export function getComposedTemplate(layoutId = 'standard', paletteId = 'proposal') {
  const layoutIds = SLIDE_LAYOUTS.map(layout => layout.id);
  const paletteIsLayout = layoutIds.includes(paletteId) && paletteId !== 'standard';
  const effectiveLayoutId = (layoutId === 'standard' && paletteIsLayout) ? paletteId : layoutId;
  const effectivePaletteId = paletteIsLayout ? 'proposal' : paletteId;
  const layoutBase = layoutId === 'standard' ? getTemplate('proposal') : getTemplate('proposal');
  const palette = getTemplate(effectivePaletteId);
  const layoutMeta = SLIDE_LAYOUTS.find(l => l.id === effectiveLayoutId) || SLIDE_LAYOUTS[0];
  return normalizeProposalTemplate({
    ...layoutBase,
    id: `${effectiveLayoutId}-${palette.id}`,
    name: `${layoutMeta.name} · ${palette.name}`,
    description: `${layoutMeta.description} / ${palette.description}`,
    layoutId: effectiveLayoutId,
    colors: {
      ...layoutBase.colors,
      ...palette.colors,
    },
    fonts: palette.fonts || layoutBase.fonts,
  }, layoutBase);
}

/**
 * 업로드한 PPTX의 디자인 토큰(extractPptxDesignTokens 결과)으로
 * 합격자 레이아웃(modern·sidebar)에 색·폰트를 입힌 가상 템플릿을 만든다.
 * 미리보기와 PptxGenJS 출력 모두 이 템플릿으로 동일하게 렌더링된다.
 */
/**
 * 업로드 PPTX의 디자인 토큰으로 'document' 스타일 템플릿 구성:
 * 흰 배경 + 상단 가는 라인 + 좌측 액센트 반원 + 큰 헤드라인 + 하단 발표자 정보 바
 */
export function buildCustomTemplateFromTokens(tokens, fileName, presenter = {}) {
  const t = tokens || {};
  const accent = t.accent || '#1D4ED8';
  const titleColor = t.title || '#D6202B'; // 제목용 강조색(없으면 기본 레드)
  const hint = t.layoutHint || 'minimal';
  return {
    id: 'custom',
    name: `내 템플릿 (${fileName || 'custom'})`,
    description: '업로드 템플릿의 색상·폰트·구조 추론으로 레이아웃 구성',
    style: 'document',
    layoutHint: hint,
    colors: {
      bg: t.bg || '#FFFFFF',
      titleColor: t.title || '#D6202B',
      accent,
      accent2: t.accent2 || accent,
      side: t.side || accent,
      sideFg: t.sideFg || '#FFFFFF',
      sub: t.sub || '#1F2937',
      muted: '#9CA3AF',
      line: hexLighten(accent, 0.85),
      kpi: accent,
      footerBg: hexLighten(accent, 0.92),
      footerFg: '#374151',
    },
    fonts: {
      heading: t.fontHeading || 'Pretendard',
      body: t.fontBody || 'Pretendard',
    },
    presenter, // { name, affiliation } 하단 바에 표시
    thumbnailBase64: t.thumbnailBase64 || null,
  };
}

function _isLightHex(hex) {
  const c = String(hex || '').replace('#', '');
  if (c.length !== 6) return true;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
}

function hexLighten(hex, amount = 0.8) {
  const c = String(hex || '#0F172A').replace('#', '');
  if (c.length !== 6) return '#E2E8F0';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const mix = (x) => Math.round(x + (255 - x) * amount);
  return `#${[mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// =====================================================================
// React 미리보기 — 16:9 (960×540 base)
// =====================================================================
export function SlidePreview({ slide, template, scale = 1, index = 0 }) {
  const t = template || TEMPLATES[0];
  const W = 960, H = 540;



  const wrap = {
    width: W, height: H, background: t.colors.bg, color: t.colors.accent,
    fontFamily: t.fonts.body, transform: `scale(${scale})`, transformOrigin: 'top left',
    position: 'relative', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };

  if (t.style === 'proposal' && t.layoutId && t.layoutId !== 'standard') {
    return <div style={wrap}>{renderAcceptedPortfolio(slide, t, index)}</div>;
  }

  if (slide.layout === 'cover' || slide.layout === 'section') {
    if (t.style === 'proposal') return <div style={wrap}>{renderProposalCover(slide, t)}</div>;
    if (t.style === 'document') return <div style={wrap}>{renderDocumentCover(slide, t)}</div>;
    return <div style={wrap}>{renderCover(slide, t)}</div>;
  }

  if (t.style === 'proposal') return <div style={wrap}>{renderProposal(slide, t, index)}</div>;
  if (t.style === 'sidebar') return <div style={wrap}>{renderModern(slide, t, index)}</div>;
  if (t.style === 'centered') return <div style={wrap}>{renderClassic(slide, t, index)}</div>;
  if (t.style === 'document') return <div style={wrap}>{renderDocument(slide, t, index)}</div>;
  return <div style={wrap}>{renderCreative(slide, t, index)}</div>;
}

function kpiPaletteColors(t) {
  const c = t.colors || {};
  const paletteAccent = c.accent ? normalizeHexColor(c.accent) : null;
  if (paletteAccent) {
    return { blue: paletteAccent, mint: c.kpi ? normalizeHexColor(c.kpi) : '#19C58E' };
  }
  return { blue: '#3182FF', mint: '#19C58E' };
}

function kpiMetricValueFontPx(text, base = 44) {
  const len = String(text || '').replace(/\s+/g, ' ').trim().length;
  if (len === 0) return base;
  if (len <= 6) return base;
  if (len >= 14) return 16;
  const ratio = (len - 6) / 8;
  return Math.round(base * (1 - ratio * 0.65));
}

// PPTX 포인트 기반 KPI 메트릭 값 폰트 스케일. fit:'shrink'만으로는 PowerPoint에서 한국어 긴 텍스트가
// 박스를 넘쳐서 인접 카드까지 침범하므로 길이별로 pt 자체를 줄여 미리 안전한 크기로 렌더.
function kpiMetricValueFontPt(text, base = 31) {
  const len = String(text || '').replace(/\s+/g, ' ').trim().length;
  if (len === 0) return base;
  if (len <= 5) return base;
  if (len <= 8) return Math.round(base * 0.78);
  if (len <= 12) return Math.round(base * 0.55);
  return Math.round(base * 0.4);
}

// KPI 카드의 '값' 슬롯은 짧은 수치/태그만 표시해야 함.
// Why: 사용자 데이터의 metric.value/label가 긴 한국어 설명("프론트엔드와 백엔드 개발을 모두 담당했습니다...")이면
// 큰 폰트(30~44pt) 박스를 넘쳐서 옆 카드/제목까지 침범. 긴 설명은 m.body로 가야 함.
// 짧은 값을 만들지 못하면 '—'를 반환 — placeholder가 missing 데이터를 명확히 드러내는 게 overflow보다 낫다.
function metricDisplayValue(m, fallback = '—') {
  if (!m) return fallback;
  if (m.before && m.after) {
    const ba = cleanPortfolioText(`${m.before} → ${m.after}`);
    if (ba.length <= 14) return ba;
  }
  const value = cleanPortfolioText(m.value || '').trim();
  if (value && value.length <= 12) return value;
  const tokenSource = `${value} ${cleanPortfolioText(m.label || '')}`;
  const numMatch = tokenSource.match(/[+\-]?\d[\d,.]*\s*[%+]?|\d+\s*[가-힣]{1,3}/);
  if (numMatch) return numMatch[0].trim().slice(0, 12);
  return fallback;
}

function acceptedVisual(t) {
  const id = t.layoutId || 'narrative';
  const c = t.colors || {};
  const map = {
    narrative: { bg: '#FFFFFF', ink: '#0F172A', muted: '#64748B', accent: '#2563EB', soft: '#E2E8F0', dark: '#0F172A', card: '#F8FAFC', font: 'Pretendard' },
    star: { bg: '#EEEEE6', ink: '#1A1A1A', muted: '#4A7878', accent: '#B4F03B', soft: '#DEDDD5', dark: '#1A1A1A', card: '#FFFFFF', font: 'Pretendard' },
    'kpi-dashboard': { bg: '#07111F', ink: '#F8FAFC', muted: '#94A3B8', accent: '#38BDF8', soft: '#0F1E33', dark: '#020617', card: '#102037', font: 'Pretendard' },
    timeline: { bg: '#FFFFFF', ink: '#071225', muted: '#60708A', accent: '#2563EB', soft: '#E3E9F4', dark: '#111827', card: '#F7FAFF', font: 'Pretendard' },
    'case-study': { bg: '#F2EDE4', ink: '#2C2420', muted: '#8B7355', accent: '#C4964A', soft: '#E8E2D5', dark: '#6B7B6E', card: '#EDE7DC', font: 'Noto Serif KR' },
  };
  const visual = map[id] || map.narrative;
  const paletteAccent = c.accent ? normalizeHexColor(c.accent) : null;
  const isNonDefault = !!paletteAccent;
  const accent = isNonDefault ? paletteAccent : visual.accent;
  const bg = (isNonDefault && c.bg) ? normalizeHexColor(c.bg) : visual.bg;
  const ink = isNonDefault ? readableTextOn(bg, c.sub || visual.ink) : visual.ink;
  const muted = isNonDefault ? mutedTextOn(bg, c.muted || visual.muted) : visual.muted;
  const soft = (isNonDefault && c.line) ? normalizeHexColor(c.line) : visual.soft;
  const card = isNonDefault
    ? normalizeHexColor(c.card || (relativeLuminance(bg) > 0.5 ? '#FFFFFF' : hexLighten(bg, 0.15)), relativeLuminance(bg) > 0.5 ? '#FFFFFF' : hexLighten(bg, 0.15))
    : (visual.card || (relativeLuminance(bg) < 0.28 ? c.dark2 : '#FFFFFF'));
  const dark = visual.dark;
  const resolvedDark = (() => {
    if (isNonDefault) {
      const candidates = [c.dark, c.headBg, c.side, c.dark2, paletteAccent]
        .filter(Boolean)
        .map(value => normalizeHexColor(value));
      const readableDark = candidates.find(value => relativeLuminance(value) < 0.5 && isReadable(SAFE_TEXT_LIGHT, value, 4.5));
      if (readableDark) return readableDark;
      return relativeLuminance(bg) < 0.5 ? bg : '#1C1C1E';
    }
    return dark;
  })();
  return {
    ...visual,
    bg,
    ink,
    muted,
    accent,
    paletteAccent: accent,
    soft,
    dark: resolvedDark,
    card,
    font: t.fonts?.heading || visual.font,
  };
}

function usesNonDefaultPalette(t) {
  const c = t?.colors || {};
  const proposal = getTemplate('proposal').colors || {};
  return ['bg', 'accent', 'side', 'headBg', 'dark', 'line'].some(key => {
    const current = c[key] ? normalizeHexColor(c[key]) : null;
    const base = proposal[key] ? normalizeHexColor(proposal[key]) : null;
    return current && base && current !== base;
  });
}

function acceptedLinesLegacy(slide) {
  const items = slide.items || [];
  const bullets = slide.bullets || [];
  if (slide.layout === 'experience' && slide.details) {
    const first = items[0] || {};
    const detailGroups = [
      { heading: '문제 정의', body: (slide.details.problem || []).join(' / ') },
      { heading: '실행 과정', body: (slide.details.action || first.bullets || []).join(' / ') },
      { heading: '성과', body: (slide.details.result || []).join(' / '), metrics: first.metrics || [] },
      { heading: first.heading || slide.title || '대표 경험', body: first.body || slide.subtitle || '', period: first.period || first.role || '' },
    ].filter(line => line.heading || line.body || (line.metrics || []).length);
    if (detailGroups.length) return detailGroups.slice(0, 4).map(compactAcceptedLine);
  }
  if (Array.isArray(slide.table) && slide.table.length > 1) {
    const headers = slide.table[0] || [];
    return slide.table.slice(1, 5).map((row, i) => ({
      heading: row[1] || row[0] || `항목 ${i + 1}`,
      body: row.map((cell, col) => headers[col] ? `${headers[col]}: ${cell}` : cell).filter(Boolean).join(' · '),
      period: row[0] || '',
    }));
  }
  if (Array.isArray(slide.metrics) && slide.metrics.length && !items.length) {
    return slide.metrics.slice(0, 4).map((metric, i) => ({
      heading: metric.label || `성과 ${i + 1}`,
      body: acceptedMetricText(metric),
      metrics: [metric],
    }));
  }
  if (items.length) {
    return items.slice(0, 4).map(item => ({
      heading: item.heading || item.role || '핵심 항목',
      body: item.body || (item.bullets || []).slice(0, 3).join(' / ') || item.role || item.period || '',
      period: item.period || item.role || '',
      metrics: item.metrics || [],
    }));
  }
  return bullets.slice(0, 4).map((body, i) => ({ heading: `Point ${i + 1}`, body }));
}

function cleanPortfolioText(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFC')
    .replace(/\uFFFD/g, '')
    .replace(/[留寃臾吏媛⑹곹됰]/g, ' ')
    .replace(/[?]{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactPortfolioText(value, max = 84) {
  const text = cleanPortfolioText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function cleanPortfolioTextKeepLines(value) {
  if (value == null) return '';
  return String(value)
    .normalize('NFC')
    .replace(/�/g, '')
    .replace(/[留寃쏀뿕臾吏媛곹됰⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽]/g, ' ')
    .replace(/[?]{2,}/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(line => line.trim()).join('\n')
    .trim();
}

function compactPortfolioTextKeepLines(value, max = 240) {
  const text = cleanPortfolioTextKeepLines(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function splitBulletLines(value) {
  const text = cleanPortfolioTextKeepLines(value);
  if (!text) return [];
  return text.split('\n').map(line => line.replace(/^[•·\-–—]\s*/, '').trim()).filter(Boolean);
}

function cleanAcceptedLine(line = {}) {
  return {
    ...line,
    heading: cleanPortfolioText(line.heading),
    body: cleanPortfolioText(line.body),
    period: cleanPortfolioText(line.period),
  };
}

function compactAcceptedLine(line = {}) {
  return {
    ...line,
    heading: compactPortfolioText(line.heading, 32),
    body: compactPortfolioText(line.body, 88),
    period: compactPortfolioText(line.period, 18),
  };
}

function acceptedCleanLines(slide) {
  return acceptedLines(slide).map(cleanAcceptedLine).filter(line => line.heading || line.body || line.period || (line.metrics || []).length);
}

function acceptedMetricTextLegacy(metric) {
  if (!metric) return 'Impact';
  if (metric.before && metric.after) return cleanPortfolioText(`${metric.before} → ${metric.after}`);
  return cleanPortfolioText(metric.value || metric.label || 'Impact');
}

function acceptedSectionKindLegacy(slide) {
  const source = `${slide.sectionLabel || ''} ${slide.title || ''} ${slide.subtitle || ''} ${slide.proposalVariant || ''}`.toLowerCase();
  if (slide.layout === 'cover' || slide.layout === 'section') return 'cover';
  if (slide.layout === 'closing' || slide.proposalVariant === 'closing' || /마무리|thank|closing/.test(source)) return 'closing';
  if (/목차|contents|index/.test(source)) return 'toc';
  if (/포지셔닝|개요|overview|요약|summary|방향|snapshot/.test(source)) return 'intro';
  if (/성과|impact|kpi|metric|지표|증거|result/.test(source)) return 'metric';
  if (/문제|problem|context|상황/.test(source)) return 'problem';
  if (/대표|프로젝트|project|case|execution|build|경험|장면|마일스톤|milestone/.test(source)) return 'project';
  if (/직무|매칭|연결|fit|적합|기여|요구/.test(source)) return 'fit';
  if (/성장|next|다음|계획|90일|roadmap|gantt|온보딩/.test(source)) return 'growth';
  if (/리스크|보완|risk|trade|포기|선택/.test(source)) return 'risk';
  return 'default';
}

function acceptedSlideMood(slide, index) {
  const kind = acceptedSectionKind(slide);
  if (kind === 'cover' || kind === 'closing' || kind === 'toc' || kind === 'metric') return kind;
  if (kind === 'project' || kind === 'growth') return 'process';
  if (kind === 'fit' || kind === 'risk' || kind === 'problem') return 'evidence';
  if (slide.layout === 'cover' || slide.layout === 'section') return 'cover';
  if (slide.layout === 'closing' || slide.proposalVariant === 'closing') return 'closing';
  if (slide.proposalVariant === 'contents') return 'toc';
  if (slide.dark || slide.proposalVariant === 'darkStats' || slide.proposalVariant === 'budget' || (slide.metrics || []).length) return 'metric';
  if (slide.layout === 'experience' || ['timeline', 'gantt', 'stageCards', 'stairSteps', 'roleTable'].includes(slide.proposalVariant)) return 'process';
  if (['comparison', 'venn', 'targetCircle', 'orbit', 'risk', 'criteria', 'pyramid'].includes(slide.proposalVariant)) return 'evidence';
  return index % 3 === 1 ? 'feature' : index % 3 === 2 ? 'process' : 'grid';
}

function acceptedLines(slide) {
  const items = slide.items || [];
  const bullets = slide.bullets || [];
  if (slide.layout === 'experience' && slide.details) {
    const first = items[0] || {};
    const detailGroups = [
      { heading: '문제 정의', body: (slide.details.problem || []).join(' / ') },
      { heading: '실행 과정', body: (slide.details.action || first.bullets || []).join(' / ') },
      { heading: '성과', body: (slide.details.result || []).join(' / '), metrics: first.metrics || [] },
      { heading: first.heading || slide.title || '대표 경험', body: first.body || slide.subtitle || '', period: first.period || first.role || '' },
    ].filter(line => line.heading || line.body || (line.metrics || []).length);
    if (detailGroups.length) return detailGroups.slice(0, 4).map(compactAcceptedLine);
  }
  if (Array.isArray(slide.table) && slide.table.length > 1) {
    const headers = slide.table[0] || [];
    return slide.table.slice(1, 5).map((row, i) => compactAcceptedLine({
      heading: row[1] || row[0] || `항목 ${i + 1}`,
      body: row.map((cell, col) => headers[col] ? `${headers[col]}: ${cell}` : cell).filter(Boolean).join(' · '),
      period: row[0] || '',
    }));
  }
  if (Array.isArray(slide.metrics) && slide.metrics.length && !items.length) {
    return slide.metrics.slice(0, 4).map((metric, i) => compactAcceptedLine({
      heading: metric.label || `성과 ${i + 1}`,
      body: acceptedMetricText(metric),
      metrics: [metric],
    }));
  }
  if (items.length) {
    return items.slice(0, 4).map(item => compactAcceptedLine({
      heading: item.heading || item.role || '핵심 항목',
      body: item.body || (item.bullets || []).slice(0, 3).join(' / ') || item.role || item.period || '',
      period: item.period || item.role || '',
      metrics: item.metrics || [],
    }));
  }
  return bullets.slice(0, 4).map((body, i) => compactAcceptedLine({ heading: `Point ${i + 1}`, body }));
}

function acceptedMetricText(metric) {
  if (!metric) return 'Impact';
  if (metric.before && metric.after) return cleanPortfolioText(`${metric.before} -> ${metric.after}`);
  return cleanPortfolioText(metric.value || metric.label || 'Impact');
}

function acceptedSectionKind(slide) {
  const source = cleanPortfolioText(`${slide.sectionLabel || ''} ${slide.title || ''} ${slide.subtitle || ''} ${slide.proposalVariant || ''}`).toLowerCase();
  const hasAny = (...words) => words.some(word => source.includes(word));
  if (slide.layout === 'cover' || slide.layout === 'section') return 'cover';
  if (slide.layout === 'closing' || slide.proposalVariant === 'closing' || hasAny('thank', 'closing', '마무리')) return 'closing';
  if (slide.proposalVariant === 'contents' || hasAny('contents', 'index', '목차')) return 'toc';
  if (hasAny('overview', 'summary', 'snapshot', 'intro', '개요', '요약', '포지셔닝')) return 'intro';
  if ((slide.metrics || []).length || hasAny('impact', 'kpi', 'metric', 'result', '성과', '지표', '증거')) return 'metric';
  if (hasAny('problem', 'context', 'issue', '문제', '상황', '배경')) return 'problem';
  if (slide.layout === 'experience' || hasAny('project', 'case', 'execution', 'build', 'milestone', '프로젝트', '경험', '실행')) return 'project';
  if (hasAny('fit', 'match', 'role', '직무', '적합', '기여', '요구')) return 'fit';
  if (hasAny('next', 'roadmap', 'gantt', 'growth', '90일', '다음', '성장', '계획')) return 'growth';
  if (hasAny('risk', 'trade', 'response', '리스크', '보완', '대응')) return 'risk';
  return 'default';
}

function prepareAcceptedSlide(slide) {
  const layout = typeof slide.layout === 'string' ? slide.layout : '';
  const isCsLayout = layout.startsWith('cs-');
  const itemLimit = isCsLayout ? 6 : 4;
  const bodyLimit = isCsLayout ? 260 : 88;
  const headingLimit = isCsLayout ? 48 : 32;
  const periodLimit = isCsLayout ? 32 : 18;
  const bulletLimit = isCsLayout ? 64 : 44;
  const cleanBody = (value) => isCsLayout
    ? compactPortfolioTextKeepLines(value, bodyLimit)
    : compactPortfolioText(value, bodyLimit);
  const cleanTitle = (value) => isCsLayout
    ? compactPortfolioTextKeepLines(value, 96)
    : compactPortfolioText(value, 54);
  return {
    ...slide,
    title: cleanTitle(slide.title),
    subtitle: compactPortfolioText(slide.subtitle, 110),
    sectionLabel: compactPortfolioText(slide.sectionLabel || '', 48),
    bullets: (slide.bullets || []).slice(0, 5).map(bullet => compactPortfolioText(bullet, 72)),
    items: (slide.items || []).slice(0, itemLimit).map(item => ({
      ...item,
      heading: compactPortfolioText(item.heading, headingLimit),
      role: compactPortfolioText(item.role, 24),
      period: compactPortfolioText(item.period, periodLimit),
      body: cleanBody(item.body || (item.bullets || []).join(isCsLayout ? '\n' : ' / ')),
      bullets: (item.bullets || []).slice(0, isCsLayout ? 4 : 3).map(bullet => compactPortfolioText(bullet, bulletLimit)),
    })),
  };
}

function renderAcceptedPortfolio(slide, t, index) {
  const prepared = prepareAcceptedSlide(slide);
  const id = t.layoutId;
  const v = acceptedVisual(t);
  if (id === 'narrative') return renderNarrativeSlide(prepared, t, v, index);
  if (id === 'star') return renderStarSlide(prepared, t, v, index);
  if (id === 'kpi-dashboard') return renderKpiSlide(prepared, t, v, index);
  if (id === 'timeline') return renderTimelineSlide(prepared, t, v, index);
  if (id === 'case-study') return renderCaseStudyReferenceSlide(prepared, t, v, index);
  return renderProposal(prepared, t, index);
}

function acceptedVariantIndex(index) {
  return Math.abs(Number(index) || 0) % 30;
}

function composeAcceptedProposalSlide(slide, t, index) {
  const profile = acceptedTemplateProfile(t.layoutId);
  const variant = (acceptedVariantIndex(index) + profile.variantOffset) % 30;
  const bodyVariant = (profile.variants && profile.variants[variant]) || ACCEPTED_BODY_VARIANTS_30[variant] || slide.proposalVariant || '';
  const dark = slide.dark || bodyVariant === 'darkStats' || bodyVariant === 'budget' || (variant + profile.shellOffset) % 9 === 0;
  return {
    ...slide,
    title: cleanPortfolioText(slide.title),
    subtitle: cleanPortfolioText(slide.subtitle),
    sectionLabel: cleanPortfolioText(slide.sectionLabel || slide.layout || ''),
    proposalVariant: slide.proposalVariant === 'contents' || slide.proposalVariant === 'closing' ? slide.proposalVariant : bodyVariant,
    dark: slide.layout === 'cover' || slide.layout === 'section' ? slide.dark : dark,
    bullets: (slide.bullets || []).map(cleanPortfolioText).filter(Boolean),
    items: (slide.items || []).map(item => ({
      ...item,
      heading: cleanPortfolioText(item.heading),
      role: cleanPortfolioText(item.role),
      period: cleanPortfolioText(item.period),
      body: cleanPortfolioText(item.body),
      bullets: (item.bullets || []).map(cleanPortfolioText).filter(Boolean),
    })),
    table: Array.isArray(slide.table) ? slide.table.map(row => row.map(cleanPortfolioText)) : slide.table,
  };
}

const ACCEPTED_BODY_VARIANTS_30 = [
  'threeCards', 'splitPhotoList', 'timeline', 'darkStats', 'bubbleCore',
  'comparison', 'metricBars', 'graphCallout', 'synergy', 'venn',
  'stairSteps', 'roleTable', 'targetCircle', 'caseGrid', 'testimonial',
  'conditionGrid', 'criteria', 'gantt', 'stageCards', 'pyramid',
  'promise', 'budget', 'risk', 'orbit', 'faqCards',
  'threeCards', 'metricBars', 'graphCallout', 'stageCards', 'caseGrid',
];

const ACCEPTED_TEMPLATE_PROFILES = {
  narrative: {
    variantOffset: 0,
    shellOffset: 0,
    heroCount: 5,
    variants: [
      'timeline', 'splitPhotoList', 'graphCallout', 'testimonial', 'venn',
      'stairSteps', 'promise', 'caseGrid', 'comparison', 'gantt',
      'threeCards', 'conditionGrid', 'orbit', 'stageCards', 'pyramid',
      'metricBars', 'bubbleCore', 'criteria', 'risk', 'targetCircle',
      'faqCards', 'darkStats', 'synergy', 'roleTable', 'budget',
      'timeline', 'graphCallout', 'promise', 'caseGrid', 'closing',
    ],
  },
  star: {
    variantOffset: 6,
    shellOffset: 2,
    heroCount: 0,
    variants: [
      'conditionGrid', 'criteria', 'roleTable', 'comparison', 'threeCards',
      'stageCards', 'risk', 'metricBars', 'faqCards', 'targetCircle',
      'pyramid', 'darkStats', 'gantt', 'caseGrid', 'testimonial',
      'orbit', 'splitPhotoList', 'bubbleCore', 'graphCallout', 'synergy',
      'stairSteps', 'budget', 'promise', 'timeline', 'venn',
      'criteria', 'roleTable', 'risk', 'caseGrid', 'closing',
    ],
  },
  'kpi-dashboard': {
    variantOffset: 12,
    shellOffset: 4,
    heroCount: 0,
    variants: [
      'darkStats', 'metricBars', 'graphCallout', 'budget', 'roleTable',
      'targetCircle', 'risk', 'caseGrid', 'threeCards', 'timeline',
      'criteria', 'gantt', 'stageCards', 'conditionGrid', 'comparison',
      'pyramid', 'bubbleCore', 'venn', 'orbit', 'testimonial',
      'splitPhotoList', 'stairSteps', 'promise', 'faqCards', 'synergy',
      'metricBars', 'graphCallout', 'darkStats', 'budget', 'closing',
    ],
  },
  timeline: {
    variantOffset: 18,
    shellOffset: 6,
    heroCount: 0,
    variants: [
      'timeline', 'stairSteps', 'gantt', 'stageCards', 'splitPhotoList',
      'graphCallout', 'threeCards', 'roleTable', 'promise', 'pyramid',
      'orbit', 'caseGrid', 'testimonial', 'conditionGrid', 'comparison',
      'metricBars', 'darkStats', 'criteria', 'risk', 'bubbleCore',
      'venn', 'targetCircle', 'budget', 'faqCards', 'synergy',
      'timeline', 'gantt', 'stageCards', 'promise', 'closing',
    ],
  },
  'case-study': {
    variantOffset: 24,
    shellOffset: 1,
    heroCount: 0,
    variants: [
      'caseGrid', 'comparison', 'conditionGrid', 'roleTable', 'risk',
      'testimonial', 'threeCards', 'splitPhotoList', 'graphCallout', 'metricBars',
      'pyramid', 'stageCards', 'gantt', 'promise', 'criteria',
      'budget', 'darkStats', 'timeline', 'bubbleCore', 'venn',
      'orbit', 'targetCircle', 'faqCards', 'stairSteps', 'synergy',
      'caseGrid', 'testimonial', 'risk', 'promise', 'closing',
    ],
  },
};

function acceptedTemplateProfile(layoutId) {
  return ACCEPTED_TEMPLATE_PROFILES[layoutId] || ACCEPTED_TEMPLATE_PROFILES.narrative;
}

function acceptedHybridData(slide, t, v, index, label) {
  const profile = acceptedTemplateProfile(t.layoutId);
  const variant = (acceptedVariantIndex(index) + profile.variantOffset) % 30;
  const bodyVariant = (profile.variants && profile.variants[variant]) || ACCEPTED_BODY_VARIANTS_30[variant] || '';
  const shell = (variant + profile.shellOffset) % 8;
  const hybridSlide = {
    ...slide,
    proposalVariant: bodyVariant,
    dark: shell === 1 || shell === 5 || bodyVariant === 'darkStats' || bodyVariant === 'budget',
    sectionLabel: slide.sectionLabel || label,
  };
  const isDark = !!hybridSlide.dark;
  return {
    variant,
    bodyVariant,
    shell,
    hybridSlide,
    isDark,
    body: renderProposalBody(hybridSlide, t, isDark),
    title: cleanPortfolioText(slide.title || slide.sectionLabel || label),
    subtitle: cleanPortfolioText(slide.subtitle || `${label} · Slide ${String(index + 1).padStart(2, '0')}`),
    lines: acceptedCleanLines(slide),
    metrics: (slide.metrics || acceptedCleanLines(slide).flatMap(line => line.metrics || [])).slice(0, 4),
  };
}

function renderNarrativeHybrid(slide, t, v, index, label) {
  const d = acceptedHybridData(slide, t, v, index, label);
  const paper = d.shell % 2 ? v.card : '#FFFFFF';
  const body = renderProposalBody({ ...d.hybridSlide, dark: false }, t, false);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(135deg, ${v.bg}, ${v.soft})`, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 34, top: 34, width: 58, height: 472, background: v.accent, borderRadius: 999, opacity: 0.92 }} />
      <div style={{ position: 'absolute', left: 56, top: 64, writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, letterSpacing: '0.22em', fontWeight: 950, color: v.dark }}>STORY ARC {String(index + 1).padStart(2, '0')}</div>
      <div style={{ position: 'absolute', left: 116, top: 44, width: 300, minHeight: 360, background: paper, borderRadius: d.shell % 3 ? 20 : 4, padding: 26, boxShadow: '0 28px 70px rgba(25,18,12,0.16)', transform: `rotate(${d.shell % 2 ? -1.2 : 0.8}deg)` }}>
        <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.18em', fontWeight: 950 }}>{slide.sectionLabel || label}</div>
        <div style={{ marginTop: 16, fontFamily: t.fonts.heading, fontSize: 34, lineHeight: 1.08, letterSpacing: '-0.045em', fontWeight: 950, ...textClamp(4) }}>{d.title}</div>
        <div style={{ marginTop: 16, color: v.muted, fontSize: 12, lineHeight: 1.5, ...textClamp(4) }}>{d.subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: 450, right: 44, top: 58, bottom: 56, overflow: 'hidden' }}>{body}</div>
    </div>
  );
}

function renderStarHybrid(slide, t, v, index, label) {
  const d = acceptedHybridData(slide, t, v, index, label);
  const body = renderProposalBody({ ...d.hybridSlide, dark: false }, t, false);
  const letters = ['S', 'T', 'A', 'R'];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', inset: 32, border: `3px solid ${v.dark}`, borderRadius: d.shell % 2 ? 0 : 28 }} />
      <div style={{ position: 'absolute', left: 56, top: 48, display: 'flex', gap: 8 }}>
        {letters.map((letter, i) => <div key={letter} style={{ width: 40, height: 40, borderRadius: i === d.shell % 4 ? '50%' : 8, background: i === d.shell % 4 ? v.accent : v.dark, color: i === d.shell % 4 ? v.dark : '#FFFFFF', display: 'grid', placeItems: 'center', fontSize: 21, fontWeight: 950 }}>{letter}</div>)}
      </div>
      <div style={{ position: 'absolute', left: 56, top: 106, right: 56 }}>
        <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.2em', fontWeight: 950 }}>EVIDENCE SCORECARD / {String(index + 1).padStart(2, '0')}</div>
        <div style={{ marginTop: 12, fontFamily: t.fonts.heading, fontSize: 31, lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950, ...textClamp(2) }}>{d.title}</div>
      </div>
      <div style={{ position: 'absolute', left: 56, right: 56, top: 210, bottom: 54, borderRadius: 22, background: v.card, padding: 18, boxShadow: '0 18px 48px rgba(0,0,0,0.10)', overflow: 'hidden' }}>{body}</div>
    </div>
  );
}

function renderKpiHybrid(slide, t, v, index, label) {
  const d = acceptedHybridData(slide, t, v, index, label);
  const lines = d.lines.length ? d.lines : [{ heading: '핵심 항목', body: d.subtitle }];
  const metrics = d.metrics.length ? d.metrics : lines.flatMap(line => line.metrics || []).slice(0, 4);
  const titleSize = String(d.title || '').length > 34 ? 24 : 29;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 42, top: 34, right: 42, height: 38, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ color: v.accent, fontSize: 11, letterSpacing: '0.22em', fontWeight: 950 }}>KPI DASHBOARD</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 900 }}>#{String(index + 1).padStart(2, '0')}</div>
      </div>
      <div style={{ position: 'absolute', left: 48, top: 92, width: 300 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: titleSize, lineHeight: 1.09, letterSpacing: '-0.04em', fontWeight: 950, ...textClamp(4) }}>{d.title}</div>
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.5)', fontSize: 11.5, lineHeight: 1.45, ...textClamp(3) }}>{d.subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: 48, bottom: 48, width: 290, height: 74, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.2)' }} />
        {[32, 52, 42, 64].map((h, i) => (
          <div key={i} style={{ flex: 1, height: h, borderRadius: '4px 4px 0 0', background: i === d.shell % 4 ? v.accent : 'rgba(255,255,255,0.15)' }} />
        ))}
      </div>
      <div style={{ position: 'absolute', left: 385, top: 82, right: 42, bottom: 50, borderRadius: 24, background: '#FFFFFF', color: '#111827', padding: 22, overflow: 'hidden', boxShadow: '0 22px 60px rgba(0,0,0,0.22)' }}>
        {metrics.length ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(2, metrics.length)}, 1fr)`, gap: 10, marginBottom: 14 }}>
          {metrics.slice(0, 2).map((metric, i) => <div key={i} style={{ borderRadius: 16, background: i === 0 ? v.accent : '#EAF1FF', color: i === 0 ? v.dark : '#1F2937', padding: 14 }}><div style={{ fontSize: 25, lineHeight: 1, fontWeight: 950, ...textClamp(1) }}>{acceptedMetricText(metric)}</div><div style={{ marginTop: 7, fontSize: 11, fontWeight: 900, ...textClamp(1) }}>{cleanPortfolioText(metric.label || '핵심 지표')}</div></div>)}
        </div> : null}
        <div style={{ display: 'grid', gridTemplateColumns: lines.length > 2 ? '1fr 1fr' : '1fr', gap: 10 }}>
          {lines.slice(0, 4).map((line, i) => <div key={i} style={{ minHeight: 76, borderRadius: 16, background: i === 0 && !metrics.length ? v.accent : '#F3F6FB', color: i === 0 && !metrics.length ? v.dark : '#111827', padding: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 950, lineHeight: 1.25, ...textClamp(2) }}>{line.heading || `Point ${i + 1}`}</div>
            <div style={{ marginTop: 7, fontSize: 10.5, lineHeight: 1.42, color: i === 0 && !metrics.length ? v.dark : '#4B5563', ...textClamp(3) }}>{line.body}</div>
          </div>)}
        </div>
      </div>
    </div>
  );
}

function renderTimelineHybrid(slide, t, v, index, label) {
  const d = acceptedHybridData(slide, t, v, index, label);
  const body = renderProposalBody({ ...d.hybridSlide, dark: false }, t, false);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 80, top: 0, bottom: 0, width: 2, background: v.dark }} />
      <div style={{ position: 'absolute', left: 58, top: 64, width: 46, height: 46, borderRadius: '50%', background: v.accent, border: `6px solid ${v.bg}` }} />
      <div style={{ position: 'absolute', left: 126, top: 58, width: 360 }}>
        <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 950 }}>MILESTONE {String(index + 1).padStart(2, '0')}</div>
        <div style={{ marginTop: 18, fontFamily: t.fonts.heading, fontSize: 40, lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950, ...textClamp(3) }}>{d.title}</div>
      </div>
      <div style={{ position: 'absolute', left: 545, top: 54, bottom: 54, width: 280, borderRadius: d.shell % 2 ? 999 : 34, background: v.dark, color: '#FFFFFF', padding: 28 }}>
        <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.18em', fontWeight: 950 }}>GROWTH NOTE</div>
        <div style={{ marginTop: 22, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.5, ...textClamp(5) }}>{d.subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: 126, right: 84, bottom: 54, height: 230, overflow: 'hidden' }}>{body}</div>
    </div>
  );
}

function renderCaseHybrid(slide, t, v, index, label) {
  const d = acceptedHybridData(slide, t, v, index, label);
  const body = renderProposalBody({ ...d.hybridSlide, dark: false }, t, false);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 42, top: 38, width: 250, height: 456, background: v.card, border: `1px solid ${v.soft}`, borderRadius: 8, boxShadow: '0 20px 55px rgba(0,0,0,0.08)' }}>
        <div style={{ height: 54, background: v.dark, color: '#FFFFFF', padding: '18px 22px', fontSize: 12, letterSpacing: '0.2em', fontWeight: 950 }}>CASE FILE</div>
        <div style={{ padding: 24 }}>
          <div style={{ color: v.accent, fontSize: 44, fontWeight: 950, lineHeight: 1 }}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{ marginTop: 24, fontSize: 18, fontWeight: 950, ...textClamp(4) }}>{slide.sectionLabel || label}</div>
          <div style={{ marginTop: 18, color: v.muted, fontSize: 12, lineHeight: 1.5, ...textClamp(5) }}>{d.subtitle}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 340, top: 58, right: 58 }}>
        <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>PROBLEM · PROCESS · IMPACT</div>
        <div style={{ marginTop: 16, fontFamily: t.fonts.heading, fontSize: 38, lineHeight: 1.08, letterSpacing: '-0.04em', fontWeight: 950, ...textClamp(2) }}>{d.title}</div>
      </div>
      <div style={{ position: 'absolute', left: 340, right: 58, bottom: 54, top: 190, overflow: 'hidden' }}>{body}</div>
    </div>
  );
}

function renderAcceptedProposalHybrid(slide, t, v, index, label) {
  if (t.layoutId === 'narrative') return renderNarrativeHybrid(slide, t, v, index, label);
  if (t.layoutId === 'star') return renderStarHybrid(slide, t, v, index, label);
  if (t.layoutId === 'kpi-dashboard') return renderKpiHybrid(slide, t, v, index, label);
  if (t.layoutId === 'timeline') return renderTimelineHybrid(slide, t, v, index, label);
  if (t.layoutId === 'case-study') return renderCaseHybrid(slide, t, v, index, label);
  const profile = acceptedTemplateProfile(t.layoutId);
  const variant = (acceptedVariantIndex(index) + profile.variantOffset) % 30;
  const bodyVariant = (profile.variants && profile.variants[variant]) || ACCEPTED_BODY_VARIANTS_30[variant] || '';
  const shell = (variant + profile.shellOffset) % 8;
  const hybridSlide = {
    ...slide,
    proposalVariant: bodyVariant,
    dark: shell === 1 || shell === 5 || bodyVariant === 'darkStats' || bodyVariant === 'budget',
    sectionLabel: slide.sectionLabel || label,
  };
  const isDark = !!hybridSlide.dark;
  const bg = isDark ? v.dark : v.bg;
  const fg = isDark ? '#FFFFFF' : v.ink;
  const body = renderProposalBody(hybridSlide, t, isDark);
  const title = slide.title || slide.sectionLabel || label;
  const subtitle = slide.subtitle || `${label} · Slide ${String(index + 1).padStart(2, '0')}`;
  const base = { position: 'absolute', inset: 0, overflow: 'hidden', background: bg, color: fg, fontFamily: t.fonts.body };
  const eyebrow = { fontSize: 11, letterSpacing: '0.22em', fontWeight: 950, color: v.accent, textTransform: 'uppercase' };
  const titleStyle = { fontFamily: t.fonts.heading, fontWeight: 950, letterSpacing: '-0.045em', lineHeight: 1.08 };

  if (shell === 0) {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', left: 54, top: 42, ...eyebrow }}>{label} / {String(index + 1).padStart(2, '0')}</div>
        <div style={{ position: 'absolute', left: 54, top: 82, right: 54, display: 'grid', gridTemplateColumns: '340px 1fr', gap: 38, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 38, ...titleStyle, ...textClamp(3) }}>{title}</div>
            <div style={{ marginTop: 14, color: isDark ? 'rgba(255,255,255,0.62)' : v.muted, fontSize: 13, lineHeight: 1.5, ...textClamp(3) }}>{subtitle}</div>
          </div>
          <div style={{ minHeight: 355 }}>{body}</div>
        </div>
      </div>
    );
  }

  if (shell === 1) {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', left: -80, top: -120, width: 360, height: 360, borderRadius: '50%', background: v.accent }} />
        <div style={{ position: 'absolute', left: 56, top: 58, width: 260, color: v.dark }}>
          <div style={{ fontSize: 70, lineHeight: 1, fontWeight: 950 }}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{ marginTop: 16, fontSize: 15, fontWeight: 950, ...textClamp(3) }}>{slide.sectionLabel || label}</div>
        </div>
        <div style={{ position: 'absolute', left: 330, top: 54, right: 56 }}>
          <div style={{ ...eyebrow }}>{bodyVariant || 'portfolio'}</div>
          <div style={{ marginTop: 14, fontSize: 36, ...titleStyle, ...textClamp(2) }}>{title}</div>
        </div>
        <div style={{ position: 'absolute', left: 330, right: 56, bottom: 52, top: 188 }}>{body}</div>
      </div>
    );
  }

  if (shell === 2) {
    return (
      <div style={{ ...base, background: v.bg }}>
        <div style={{ position: 'absolute', inset: 34, border: `2px solid ${v.dark}`, borderRadius: 30 }} />
        <div style={{ position: 'absolute', left: 82, top: 72, width: 590 }}>
          <div style={eyebrow}>{slide.sectionLabel || label}</div>
          <div style={{ marginTop: 14, fontSize: 42, ...titleStyle, ...textClamp(2) }}>{title}</div>
        </div>
        <div style={{ position: 'absolute', right: 82, top: 82, width: 120, textAlign: 'right', color: v.accent, fontSize: 28, fontWeight: 950 }}>{String(index + 1).padStart(2, '0')}</div>
        <div style={{ position: 'absolute', left: 82, right: 82, bottom: 70, top: 236 }}>{body}</div>
      </div>
    );
  }

  if (shell === 3) {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 245, background: v.dark, color: '#FFFFFF', padding: 40 }}>
          <div style={{ ...eyebrow }}>{label}</div>
          <div style={{ position: 'absolute', left: 40, bottom: 44, fontSize: 52, fontWeight: 950 }}>{String(index + 1).padStart(2, '0')}</div>
        </div>
        <div style={{ position: 'absolute', left: 300, top: 54, right: 58 }}>
          <div style={{ fontSize: 38, ...titleStyle, ...textClamp(2) }}>{title}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: v.muted, ...textClamp(2) }}>{subtitle}</div>
        </div>
        <div style={{ position: 'absolute', left: 300, right: 58, bottom: 52, top: 178 }}>{body}</div>
      </div>
    );
  }

  if (shell === 4) {
    return (
      <div style={{ ...base, background: `linear-gradient(120deg, ${v.bg} 0%, ${v.soft} 100%)` }}>
        <div style={{ position: 'absolute', left: 56, top: 46, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={eyebrow}>{slide.sectionLabel || label}</div>
          <div style={{ color: v.muted, fontWeight: 900 }}>SLIDE {String(index + 1).padStart(2, '0')}</div>
        </div>
        <div style={{ position: 'absolute', left: 56, top: 96, right: 56, height: 82, borderBottom: `1px solid ${v.soft}` }}>
          <div style={{ fontSize: 34, ...titleStyle, ...textClamp(2) }}>{title}</div>
        </div>
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 50, top: 220 }}>{body}</div>
      </div>
    );
  }

  if (shell === 5) {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', right: -120, bottom: -120, width: 420, height: 420, borderRadius: '50%', background: v.accent, opacity: 0.9 }} />
        <div style={{ position: 'absolute', left: 58, top: 54, width: 510 }}>
          <div style={eyebrow}>{label}</div>
          <div style={{ marginTop: 20, fontSize: 44, ...titleStyle, ...textClamp(3) }}>{title}</div>
        </div>
        <div style={{ position: 'absolute', left: 58, right: 58, bottom: 54, height: 250 }}>{body}</div>
      </div>
    );
  }

  if (shell === 6) {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', left: 54, top: 50, width: 260, height: 420, borderRadius: 36, background: v.accent, color: v.dark, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 950 }}>{slide.sectionLabel || label}</div>
          <div style={{ fontSize: 46, fontWeight: 950, lineHeight: 1 }}>{String(index + 1).padStart(2, '0')}</div>
        </div>
        <div style={{ position: 'absolute', left: 360, top: 58, right: 56 }}>
          <div style={{ fontSize: 36, ...titleStyle, ...textClamp(2) }}>{title}</div>
        </div>
        <div style={{ position: 'absolute', left: 360, right: 56, bottom: 50, top: 174 }}>{body}</div>
      </div>
    );
  }

  return (
    <div style={base}>
      <div style={{ position: 'absolute', left: 52, right: 52, top: 36, display: 'grid', gridTemplateColumns: '1fr 160px', gap: 24 }}>
        <div>
          <div style={eyebrow}>{slide.sectionLabel || label}</div>
          <div style={{ marginTop: 12, fontSize: 35, ...titleStyle, ...textClamp(2) }}>{title}</div>
        </div>
        <div style={{ height: 108, borderRadius: 999, background: v.dark, color: v.accent, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 950 }}>{String(index + 1).padStart(2, '0')}</div>
      </div>
      <div style={{ position: 'absolute', left: 52, right: 52, bottom: 50, top: 190 }}>{body}</div>
    </div>
  );
}

function renderVariedAcceptedSlide(slide, t, v, index, label) {
  const lines = acceptedLines(slide);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const profile = acceptedTemplateProfile(t.layoutId);
  const rawVariant = acceptedVariantIndex(index);
  const variant = (rawVariant + profile.variantOffset) % 30;
  const title = slide.title || slide.sectionLabel || 'Portfolio';
  const section = slide.sectionLabel || label || 'Portfolio';
  const metric = metrics[0];
  const stat = metric ? acceptedMetricText(metric) : (lines[0]?.period || String(index + 1).padStart(2, '0'));
  const base = { position: 'absolute', inset: 0, fontFamily: t.fonts.body, overflow: 'hidden' };
  const eyebrow = { fontSize: 12, letterSpacing: '0.2em', fontWeight: 950, color: v.accent, textTransform: 'uppercase' };
  const titleStyle = { fontFamily: t.fonts.heading, fontWeight: 950, letterSpacing: '-0.045em', lineHeight: 1.06 };
  const muted = { color: v.muted, lineHeight: 1.45 };

  if (variant === 0) {
    return (
      <div style={{ ...base, background: v.dark, color: '#FFFFFF' }}>
        <div style={{ position: 'absolute', left: 56, top: 48, ...eyebrow }}>{section}</div>
        <div style={{ position: 'absolute', left: 56, top: 104, width: 510, fontSize: 44, ...titleStyle, ...textClamp(3) }}>{title}</div>
        <div style={{ position: 'absolute', right: 56, top: 68, width: 280, height: 280, borderRadius: '50%', background: v.accent, opacity: 0.95 }} />
        <div style={{ position: 'absolute', right: 96, top: 142, width: 210, color: v.dark }}>
          <div style={{ fontSize: 54, fontWeight: 950, lineHeight: 1, ...textClamp(1) }}>{stat}</div>
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 900, ...textClamp(3) }}>{metric?.label || lines[0]?.heading || '핵심 증거'}</div>
        </div>
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 52, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {lines.slice(0, 3).map((line, i) => <div key={i} style={{ borderTop: `3px solid ${i === 0 ? v.accent : 'rgba(255,255,255,0.18)'}`, paddingTop: 16 }}><div style={{ fontSize: 17, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div><div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.66)', ...textClamp(3) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }

  if (variant === 1) {
    return (
      <div style={{ ...base, background: v.bg, color: v.ink }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 310, background: v.accent }} />
        <div style={{ position: 'absolute', left: 54, top: 52, color: v.dark, fontSize: 13, fontWeight: 950 }}>{String(index + 1).padStart(2, '0')} / {label}</div>
        <div style={{ position: 'absolute', left: 54, bottom: 58, width: 210, color: v.dark, fontSize: 42, ...titleStyle, ...textClamp(4) }}>{title}</div>
        <div style={{ position: 'absolute', left: 360, right: 58, top: 58, bottom: 58, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {lines.slice(0, 4).map((line, i) => <div key={i} style={{ borderRadius: i === 0 ? 28 : 18, background: i === 0 ? v.dark : v.card, color: i === 0 ? '#FFFFFF' : v.ink, padding: 24, boxShadow: '0 16px 40px rgba(18,24,31,0.08)' }}><div style={{ color: i === 0 ? v.accent : v.muted, fontSize: 12, fontWeight: 950 }}>POINT {i + 1}</div><div style={{ marginTop: 24, fontSize: 19, fontWeight: 950, ...textClamp(2) }}>{line.heading}</div><div style={{ marginTop: 9, fontSize: 12.5, ...muted, color: i === 0 ? 'rgba(255,255,255,0.66)' : v.muted, ...textClamp(3) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }

  if (variant === 2) {
    return (
      <div style={{ ...base, background: v.bg, color: v.ink }}>
        <div style={{ position: 'absolute', left: 58, top: 44, ...eyebrow }}>{label}</div>
        <div style={{ position: 'absolute', left: 58, top: 90, width: 610, fontSize: 40, ...titleStyle, ...textClamp(2) }}>{title}</div>
        <div style={{ position: 'absolute', left: 58, right: 58, bottom: 56, height: 250 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 122, height: 2, background: v.soft }} />
          {lines.slice(0, 5).map((line, i) => <div key={i} style={{ position: 'absolute', left: `${i * 20}%`, top: i % 2 ? 126 : 18, width: 170 }}><div style={{ width: 48, height: 48, borderRadius: '50%', background: i === 0 ? v.dark : v.accent, color: i === 0 ? '#FFFFFF' : v.dark, display: 'grid', placeItems: 'center', fontWeight: 950 }}>{i + 1}</div><div style={{ marginTop: 12, fontSize: 16, fontWeight: 950, ...textClamp(2) }}>{line.heading}</div><div style={{ marginTop: 6, fontSize: 11.5, ...muted, ...textClamp(2) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }

  if (variant === 3) {
    return (
      <div style={{ ...base, background: v.dark, color: '#FFFFFF' }}>
        <div style={{ position: 'absolute', left: 54, top: 46, ...eyebrow }}>{section}</div>
        <div style={{ position: 'absolute', left: 54, top: 104, width: 360, fontSize: 34, ...titleStyle, ...textClamp(3) }}>{title}</div>
        <div style={{ position: 'absolute', right: 54, top: 54, bottom: 54, width: 520, display: 'grid', gridTemplateRows: '1.2fr 1fr', gap: 14 }}>
          <div style={{ borderRadius: 34, background: v.accent, color: v.dark, padding: 28 }}><div style={{ fontSize: 62, fontWeight: 950, lineHeight: 1, ...textClamp(1) }}>{stat}</div><div style={{ marginTop: 14, fontSize: 15, fontWeight: 950, ...textClamp(2) }}>{metric?.label || lines[0]?.heading || '대표 성과'}</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {lines.slice(0, 2).map((line, i) => <div key={i} style={{ borderRadius: 24, background: 'rgba(255,255,255,0.08)', padding: 22 }}><div style={{ fontSize: 14, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div><div style={{ marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.64)', ...textClamp(4) }}>{line.body}</div></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 4) {
    return (
      <div style={{ ...base, background: v.bg, color: v.ink }}>
        <div style={{ position: 'absolute', inset: 38, border: `2px solid ${v.dark}`, borderRadius: 34 }} />
        <div style={{ position: 'absolute', left: 84, top: 76, width: 500, fontSize: 39, ...titleStyle, ...textClamp(3) }}>{title}</div>
        <div style={{ position: 'absolute', right: 84, top: 80, width: 210, textAlign: 'right', ...eyebrow }}>{label}<br />{String(index + 1).padStart(2, '0')}</div>
        <div style={{ position: 'absolute', left: 84, right: 84, bottom: 82, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {lines.slice(0, 3).map((line, i) => <div key={i} style={{ minHeight: 150, background: i === 1 ? v.accent : v.card, padding: 22, borderRadius: 4 }}><div style={{ fontSize: 13, color: i === 1 ? v.dark : v.muted, fontWeight: 950 }}>{line.period || `EVIDENCE ${i + 1}`}</div><div style={{ marginTop: 24, fontSize: 18, fontWeight: 950, ...textClamp(2) }}>{line.heading}</div><div style={{ marginTop: 8, fontSize: 12, ...muted, color: i === 1 ? v.dark : v.muted, ...textClamp(3) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }

  const family = Math.floor(variant / 5);
  const slot = variant % 5;
  const posterPalette = [
    [v.bg, v.card, v.soft],
    [v.dark, v.card, v.accent],
    [v.bg, '#FFFFFF', v.accent],
    [v.card, v.bg, v.dark],
    [v.soft, v.card, v.bg],
  ][slot];
  const backgroundAngle = [110, 28, 155, 82, 128, 205][family] + slot * 9;
  const posterRadius = [42, 8, 90, 24, 0][slot] + [0, 14, -18, 6, 28, -4][family];
  const posterX = [64, 520, 94, 600, 410][slot] + [0, -34, 28, -72, 44, -12][family];
  const posterY = [58, 118, 46, 84, 36][slot] + [0, 30, -8, 82, 18, 48][family];
  const posterW = [350, 290, 330, 260, 310][slot] + [0, 42, -34, 70, -10, 24][family];
  const posterH = [360, 300, 335, 285, 330][slot] + [0, -36, 42, -10, 30, -24][family];
  const titleX = [58, 58, 420, 72, 58][slot] + [0, 22, -36, 88, 0, 52][family];
  const titleY = [96, 70, 90, 250, 128][slot] + [0, 26, 52, -62, 18, -30][family];
  const titleW = [470, 390, 430, 760, 330][slot] + [0, 110, -40, -160, 180, 80][family];
  const bottomDirection = family % 2 === 0 ? (slot === 0 ? 'column' : 'row') : (slot < 2 ? 'column' : 'row');
  const darkPoster = (variant + family) % 4 !== 0;
  const titleOnDark = slot === 1 || family === 3;
  const band = [
    { left: -80, top: 420, width: 380, height: 64, rotate: -6 },
    { left: 720, top: -40, width: 310, height: 82, rotate: 13 },
    { left: -40, top: 38, width: 210, height: 300, rotate: 0 },
    { left: 450, top: 410, width: 560, height: 46, rotate: 4 },
    { left: 790, top: 120, width: 120, height: 310, rotate: -8 },
    { left: 80, top: -48, width: 460, height: 54, rotate: -3 },
  ][family];

  return (
    <div style={{ ...base, background: `linear-gradient(${backgroundAngle}deg, ${posterPalette[0]} 0%, ${posterPalette[1]} 52%, ${posterPalette[2]} 100%)`, color: titleOnDark ? '#FFFFFF' : v.ink }}>
      <div style={{ position: 'absolute', left: band.left, top: band.top, width: band.width, height: band.height, borderRadius: family === 2 ? 0 : 999, background: family % 2 ? v.dark : v.accent, opacity: family === 3 ? 0.22 : 0.86, transform: `rotate(${band.rotate}deg)` }} />
      <div style={{ position: 'absolute', left: 58, top: 48, ...eyebrow }}>{label}</div>
      <div style={{ position: 'absolute', left: titleX, top: titleY, width: titleW, fontSize: [46, 38, 42, 34, 40, 36][family], color: titleOnDark ? '#FFFFFF' : v.ink, ...titleStyle, ...textClamp(3) }}>{title}</div>
      <div style={{ position: 'absolute', left: posterX, top: posterY, width: posterW, height: posterH, borderRadius: Math.max(0, posterRadius), background: darkPoster ? v.dark : v.accent, color: darkPoster ? '#FFFFFF' : v.dark, padding: 30, transform: `rotate(${(slot % 2 ? 2 : -2) + family * 0.7}deg)`, clipPath: family === 5 ? 'polygon(0 0, 100% 8%, 92% 100%, 6% 88%)' : undefined }}>
        <div style={{ color: darkPoster ? v.accent : v.dark, fontSize: 12, fontWeight: 950 }}>HIGHLIGHT {String(index + 1).padStart(2, '0')}</div>
        <div style={{ marginTop: family === 1 ? 24 : 42, fontSize: family === 2 ? 34 : 42, fontWeight: 950, lineHeight: 1.02, ...textClamp(family === 1 ? 3 : 2) }}>{lines[0]?.heading || stat}</div>
        <div style={{ marginTop: 18, color: darkPoster ? 'rgba(255,255,255,0.68)' : v.dark, fontSize: 13, lineHeight: 1.5, ...textClamp(4) }}>{lines[0]?.body || metric?.label}</div>
      </div>
      <div style={{ position: 'absolute', left: slot === 2 ? 420 : 58, right: family === 4 ? 250 : 58, bottom: family === 2 ? 78 : 56, display: 'flex', flexDirection: bottomDirection, gap: 10, alignItems: family % 2 ? 'stretch' : 'flex-start' }}>
        {lines.slice(1, 4).map((line, i) => <div key={i} style={{ width: bottomDirection === 'column' ? 260 : 180, minHeight: family === 4 ? 108 : 0, borderRadius: [18, 4, 999, 12, 0, 28][family], background: i === 1 ? v.accent : '#FFFFFF', padding: 18, border: family === 2 ? `1px solid ${v.dark}` : 'none' }}><div style={{ fontSize: 12, fontWeight: 950, color: i === 1 ? v.dark : v.muted }}>0{i + 2}</div><div style={{ marginTop: 14, fontSize: 15, fontWeight: 950, ...textClamp(2) }}>{line.heading}</div></div>)}
      </div>
    </div>
  );
}

function renderAcceptedSectionScene(slide, t, v, index) {
  const kind = acceptedSectionKind(slide);
  const isCover = kind === 'cover';
  const lines = acceptedLines(slide);
  if (isCover || kind === 'toc' || kind === 'metric' || kind === 'project') return null;

  if (kind === 'intro') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -90, top: -110, width: 360, height: 360, borderRadius: '50%', background: v.accent, opacity: 0.22 }} />
        <div style={{ position: 'absolute', left: 58, top: 48, fontSize: 12, color: v.accent, letterSpacing: '0.22em', fontWeight: 900 }}>{slide.sectionLabel || 'OVERVIEW'}</div>
        <div style={{ position: 'absolute', left: 58, top: 96, width: 560, fontFamily: t.fonts.heading, fontSize: 48, lineHeight: 1.04, fontWeight: 950, letterSpacing: '-0.045em', ...textClamp(3) }}>{slide.title}</div>
        {slide.subtitle ? <div style={{ position: 'absolute', left: 62, top: 276, width: 460, fontSize: 15, color: v.muted, lineHeight: 1.55, ...textClamp(3) }}>{slide.subtitle}</div> : null}
        <div style={{ position: 'absolute', right: 66, bottom: 62, width: 350, display: 'grid', gap: 12 }}>
          {lines.slice(0, 3).map((line, i) => (
            <div key={i} style={{ transform: `translateX(${i * -24}px)`, borderRadius: 24, background: i === 0 ? v.dark : v.card, color: i === 0 ? '#FFFFFF' : v.ink, padding: '18px 22px', boxShadow: '0 16px 38px rgba(0,0,0,0.09)' }}>
              <div style={{ fontSize: 11, color: i === 0 ? v.accent : v.muted, fontWeight: 900 }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ marginTop: 6, fontSize: 17, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div>
              <div style={{ marginTop: 5, fontSize: 11.5, lineHeight: 1.4, opacity: 0.72, ...textClamp(2) }}>{line.body}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'fit' || kind === 'problem') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: kind === 'fit' ? v.dark : v.bg, color: kind === 'fit' ? '#FFFFFF' : v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 48, fontSize: 12, color: v.accent, letterSpacing: '0.22em', fontWeight: 900 }}>{kind === 'fit' ? 'FIT MAP' : 'PROBLEM FRAMING'}</div>
        <div style={{ position: 'absolute', left: 54, top: 94, width: 420, fontFamily: t.fonts.heading, fontSize: 40, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.04em', ...textClamp(3) }}>{slide.title}</div>
        <div style={{ position: 'absolute', right: 60, top: 86, width: 380, height: 300 }}>
          <div style={{ position: 'absolute', left: 14, top: 45, width: 190, height: 190, borderRadius: '50%', background: kind === 'fit' ? 'rgba(255,255,255,0.12)' : v.soft, border: `2px solid ${v.accent}`, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 32, fontSize: 17, fontWeight: 900, ...textClamp(3) }}>{lines[0]?.heading || '나의 경험'}</div>
          <div style={{ position: 'absolute', right: 14, top: 45, width: 190, height: 190, borderRadius: '50%', background: kind === 'fit' ? 'rgba(255,255,255,0.12)' : v.card, border: `2px solid ${v.accent}`, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 32, fontSize: 17, fontWeight: 900, ...textClamp(3) }}>{lines[1]?.heading || '직무 요구'}</div>
          <div style={{ position: 'absolute', left: 142, top: 120, width: 96, height: 58, borderRadius: 999, background: v.accent, color: v.dark, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 950 }}>MATCH</div>
        </div>
        <div style={{ position: 'absolute', left: 54, right: 60, bottom: 52, display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, lines.length))}, 1fr)`, gap: 12 }}>
          {lines.slice(0, 3).map((line, i) => <div key={i} style={{ borderTop: `4px solid ${i === 1 ? v.accent : kind === 'fit' ? 'rgba(255,255,255,0.18)' : v.soft}`, paddingTop: 14 }}><div style={{ fontSize: 15, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div><div style={{ marginTop: 7, color: kind === 'fit' ? 'rgba(255,255,255,0.62)' : v.muted, fontSize: 11.5, lineHeight: 1.45, ...textClamp(3) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }

  if (kind === 'growth') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 58, top: 48, width: 360 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 900 }}>NEXT ROADMAP</div>
          <div style={{ marginTop: 18, fontFamily: t.fonts.heading, fontSize: 38, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.04em', ...textClamp(3) }}>{slide.title}</div>
          {slide.subtitle ? <div style={{ marginTop: 14, color: v.muted, fontSize: 13, lineHeight: 1.5, ...textClamp(3) }}>{slide.subtitle}</div> : null}
        </div>
        <div style={{ position: 'absolute', left: 460, right: 58, top: 66, bottom: 56, display: 'grid', gridTemplateRows: `repeat(${Math.min(4, Math.max(1, lines.length))}, 1fr)`, gap: 12 }}>
          {lines.slice(0, 4).map((line, i) => <div key={i} style={{ borderRadius: 22, background: i === lines.slice(0, 4).length - 1 ? v.accent : v.card, color: i === lines.slice(0, 4).length - 1 ? v.dark : v.ink, padding: '18px 22px', display: 'grid', gridTemplateColumns: '86px 1fr', gap: 18, alignItems: 'center', boxShadow: '0 12px 30px rgba(0,0,0,0.06)' }}><div style={{ fontSize: 13, fontWeight: 950 }}>{line.period || `STEP ${i + 1}`}</div><div><div style={{ fontSize: 17, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div><div style={{ marginTop: 5, fontSize: 11.5, lineHeight: 1.4, opacity: 0.72, ...textClamp(2) }}>{line.body}</div></div></div>)}
        </div>
      </div>
    );
  }

  if (kind === 'risk') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 46, color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 900 }}>TRADE-OFF / RISK</div>
        <div style={{ position: 'absolute', left: 54, top: 92, width: 620, fontSize: 42, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 54, right: 54, bottom: 54, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {(lines.length ? lines : [{ heading: 'Risk', body: '약해질 수 있는 지점' }, { heading: 'Response', body: '보완하는 방식' }]).slice(0, 4).map((line, i) => <div key={i} style={{ minHeight: 126, borderRadius: 20, background: i % 2 ? v.accent : 'rgba(255,255,255,0.08)', color: i % 2 ? v.dark : '#FFFFFF', padding: 22 }}><div style={{ fontSize: 12, fontWeight: 950, opacity: 0.72 }}>{i % 2 ? 'RESPONSE' : 'RISK'}</div><div style={{ marginTop: 16, fontSize: 18, fontWeight: 900, ...textClamp(2) }}>{line.heading}</div><div style={{ marginTop: 7, fontSize: 11.5, lineHeight: 1.45, opacity: 0.72, ...textClamp(3) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }

  if (kind === 'closing') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.28em', fontWeight: 900 }}>END OF PORTFOLIO</div>
          <div style={{ marginTop: 22, fontSize: 58, fontWeight: 950, letterSpacing: '-0.05em' }}>{slide.title || 'Thank You'}</div>
          {slide.subtitle ? <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.62)', fontSize: 17 }}>{slide.subtitle}</div> : null}
          <div style={{ marginTop: 28, color: v.accent, fontSize: 13, fontWeight: 900 }}>{(slide.bullets || []).slice(0, 3).join(' · ')}</div>
        </div>
      </div>
    );
  }

  return null;
}

function narrAccent(v) { return v.accent || '#2563EB'; }
function narrRule(v) { return <div style={{ width: 52, height: 4, background: narrAccent(v), borderRadius: 2, margin: '14px 0 20px' }} />; }
function narrLabel(text, v) { return <div style={{ color: narrAccent(v), fontSize: 12, letterSpacing: '0.22em', fontWeight: 850, textTransform: 'uppercase' }}>{text}</div>; }
function narrShell(children, bg = '#FFFFFF') { return <div style={{ position: 'absolute', inset: 0, background: bg, fontFamily: 'Pretendard, sans-serif', overflow: 'hidden' }}>{children}</div>; }

function renderNarrativeCover(slide, t, v) {
  const acc = narrAccent(v);
  const chips = (slide.bullets || ['React', 'Node.js', 'Firebase', 'AI API', 'TypeScript']).slice(0, 6);
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: 'Pretendard, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, left: 0, right: '38%', background: '#F8FAFC' }} />
      <div style={{ position: 'absolute', inset: 0, left: '62%', background: '#0F172A' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '58%', width: 72, background: acc, transform: 'skewX(-4deg)', transformOrigin: 'top' }} />
      <div style={{ position: 'absolute', left: 62, top: 58, right: '42%' }}>
        <div style={{ fontSize: dynamicFontPx(slide.title || '', 46, { min: 32, max: 52 }), lineHeight: 1.12, fontWeight: 950, color: '#0F172A', whiteSpace: 'pre-line', ...textClamp(4) }}>{slide.title}</div>
        <div style={{ width: 52, height: 4, background: acc, borderRadius: 2, margin: '18px 0 16px' }} />
        <div style={{ fontSize: 15, color: '#475569', fontWeight: 700 }}>{slide.subtitle}</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#94A3B8' }}>{(slide.bullets || []).slice(0, 1)[0] ? '경험을 제품으로 바꾸는 개발자' : ''}</div>
      </div>
      <div style={{ position: 'absolute', left: 62, bottom: 46 }}>
        <div style={{ color: acc, fontSize: 13, fontWeight: 850, letterSpacing: '0.12em' }}>{(slide.sectionLabel || 'KIM YUSHIN PORTFOLIO').toUpperCase()}</div>
      </div>
      <div style={{ position: 'absolute', right: 60, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 10, width: 200 }}>
        {chips.map((chip, i) => <div key={i} style={{ background: '#1E2D3D', color: '#E2E8F0', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, padding: '10px 14px', borderRadius: 4 }}>{chip}</div>)}
      </div>
    </div>
  );
}

function renderNarrativeProfile(slide, t, v) {
  const acc = narrAccent(v);
  const edu = (slide.items || []).filter(Boolean);
  const awardList = (slide.metrics || []).slice(0, 3);
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 32, { min: 24, max: 36 }), fontWeight: 950, color: '#0F172A', lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, top: 188, width: 370, bottom: 60 }}>
      {narrLabel('PROFILE', v)}
      <div style={{ marginTop: 14, fontSize: 20, fontWeight: 950 }}>{edu[0]?.heading || slide.title?.split(' ')[0] || 'Name'}</div>
      {edu.map((item, i) => <div key={i} style={{ marginTop: 14 }}><div style={{ color: acc, fontSize: 10, letterSpacing: '0.2em', fontWeight: 850 }}>{(item.role || item.period || 'EDUCATION').toUpperCase()}</div><div style={{ marginTop: 6, fontSize: 14, fontWeight: 850 }}>{item.heading}</div><div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>{item.body}</div></div>)}
    </div>
    <div style={{ position: 'absolute', left: 468, top: 188, right: 60, bottom: 60 }}>
      {narrLabel('AWARDS & ACHIEVEMENTS', v)}
      {awardList.map((m, i) => <div key={i} style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}><div style={{ fontSize: 18, marginTop: 2 }}>{'🏆🥈📖'[i] || '🏅'}</div><div><div style={{ fontSize: 14, fontWeight: 900 }}>{m.label}</div><div style={{ marginTop: 3, fontSize: 11.5, color: '#64748B' }}>{m.body}</div></div></div>)}
      {slide.subtitle ? <><div style={{ marginTop: 20, height: 1, background: '#E2E8F0' }} /><div style={{ marginTop: 16, fontSize: 13.5, fontStyle: 'italic', color: '#0F172A', lineHeight: 1.55, ...textClamp(3) }}>{slide.subtitle}</div></> : null}
    </div>
  </>);
}

function renderNarrativePhilosophy(slide, t, v) {
  const acc = narrAccent(v);
  const items = (slide.items || []).slice(0, 3);
  const icons = ['+', '—', '×'];
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 34, { min: 26, max: 38 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 188, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
      {items.map((item, i) => <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '24px 20px', borderTop: `3px solid ${acc}` }}>
        <div style={{ color: acc, fontSize: 28, fontWeight: 950, lineHeight: 1 }}>{icons[i]}</div>
        <div style={{ marginTop: 14, fontSize: 13, fontWeight: 950, letterSpacing: '0.04em' }}>{item.heading?.toUpperCase()}</div>
        <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: '#334155', ...textClamp(4) }}>{item.body}</div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#0F172A', padding: '14px 60px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ color: acc, fontSize: 20, fontWeight: 950 }}>"</div>
      <div style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 1.55, ...textClamp(2) }}>{slide.subtitle}</div>
    </div>
  </>);
}

function renderNarrativeSkills(slide, t, v) {
  const acc = narrAccent(v);
  const groups = (slide.items || []).slice(0, 6);
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: 34, fontWeight: 950 }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 160, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
      {groups.map((g, i) => <div key={i}>
        <div style={{ color: acc, fontSize: 11, letterSpacing: '0.18em', fontWeight: 850 }}>{(g.period || g.heading || `GROUP ${i+1}`).toUpperCase()}</div>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(g.bullets?.length ? g.bullets : [g.heading, g.body].filter(Boolean)).map((b, j) => <span key={j} style={{ border: '1px solid #CBD5E1', borderLeft: `3px solid ${acc}`, borderRadius: 3, padding: '3px 8px', fontSize: 11.5, fontFamily: 'monospace', color: '#334155' }}>{b}</span>)}
        </div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#0F172A', padding: '14px 60px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ color: acc, fontSize: 15, fontFamily: 'monospace', fontWeight: 950 }}>{'</>'}</div>
      <div style={{ color: '#E2E8F0', fontSize: 13, ...textClamp(1) }}>{slide.subtitle}</div>
    </div>
  </>);
}

function renderNarrativeProblem(slide, t, v) {
  const acc = narrAccent(v);
  const problems = (slide.items || []).slice(0, 3);
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 32, { min: 24, max: 36 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, top: 190, width: 380 }}>
      {narrLabel('THE PROBLEM', v)}
      {problems.map((p, i) => <div key={i} style={{ marginTop: 16, display: 'flex', gap: 10 }}>
        <div style={{ color: acc, fontSize: 16, marginTop: 2 }}>{'⚠️📄🔍'[i] || '•'}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#334155', ...textClamp(3) }}>{p.body}</div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', right: 60, top: 190, width: 260, background: '#F8FAFC', borderRadius: 8, padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, color: '#64748B', lineHeight: 2.2 }}>시간 낭비</div>
      <div style={{ fontSize: 22, color: acc, fontWeight: 950 }}>+</div>
      <div style={{ fontSize: 16, color: '#64748B', lineHeight: 2.2 }}>일관성 부족</div>
      <div style={{ fontSize: 22, color: acc, fontWeight: 950 }}>=</div>
      <div style={{ fontSize: 15, color: acc, fontWeight: 950, lineHeight: 1.4 }}>취업 준비의<br/>가장 큰 장벽</div>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#0F172A', padding: '14px 60px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 16 }}>💡</div>
      <div style={{ color: '#E2E8F0', fontSize: 13, ...textClamp(1) }}>{slide.subtitle}</div>
    </div>
  </>);
}

function renderNarrativeProject(slide, t, v) {
  const acc = narrAccent(v);
  const details = (slide.items || []).slice(0, 3);
  const chips = (slide.bullets || []).slice(0, 9);
  return (
    <div style={{ position: 'absolute', inset: 0, fontFamily: 'Pretendard, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '38%', background: '#0F172A' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '33%', width: 60, background: acc, transform: 'skewX(-3deg)', transformOrigin: 'top' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '36%', right: 0, background: '#FFFFFF' }} />
      <div style={{ position: 'absolute', left: 40, top: 60, width: '28%' }}>
        <div style={{ color: acc, fontSize: 11, letterSpacing: '0.22em', fontWeight: 850 }}>{slide.sectionLabel?.toUpperCase()}</div>
        <div style={{ marginTop: 14, fontSize: 42, fontWeight: 950, color: '#FFFFFF', lineHeight: 1.1, ...textClamp(3) }}>{slide.title}</div>
        <div style={{ marginTop: 14, fontSize: 12.5, color: '#94A3B8', lineHeight: 1.55, ...textClamp(3) }}>{slide.subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: '40%', top: 52, right: 52, bottom: 52 }}>
        {details.map((d, i) => <div key={i} style={{ marginBottom: 18 }}>
          {narrLabel(d.heading, v)}
          <div style={{ marginTop: 4, height: 1, background: '#E2E8F0' }} />
          {i === 0 ? <div style={{ marginTop: 8, fontSize: 13.5, color: '#334155', lineHeight: 1.55, ...textClamp(3) }}>{d.body}</div>
            : <div style={{ marginTop: 8, fontSize: 13, color: '#0F172A' }}><span style={{ fontWeight: 950, marginRight: 8 }}>{d.heading}</span>{d.body}</div>}
        </div>)}
        {chips.length > 0 && <>
          {narrLabel('TECH STACK', v)}
          <div style={{ marginTop: 4, height: 1, background: '#E2E8F0' }} />
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {chips.map((c, i) => <span key={i} style={{ border: '1px dashed #CBD5E1', borderRadius: 3, padding: '4px 10px', fontSize: 11, fontFamily: 'monospace', color: '#475569' }}>{c}</span>)}
          </div>
        </>}
      </div>
    </div>
  );
}

function renderNarrativeChallenge(slide, t, v) {
  const acc = narrAccent(v);
  const all = (slide.items || []).slice(0, 6);
  const problems = all.filter(it => it.heading?.startsWith('Problem'));
  const actions = all.filter(it => it.heading?.startsWith('Action') || it.heading?.startsWith('Solution'));
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 30, { min: 22, max: 34 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, top: 188, width: 360 }}>
      {narrLabel('THE PROBLEM', v)}
      {problems.map((p, i) => <div key={i} style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 15, marginTop: 1 }}>{'🕐📄🤖'[i] || '•'}</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: '#334155', ...textClamp(3) }}>{p.body}</div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', right: 60, top: 188, width: 300, borderLeft: `2px solid ${acc}`, paddingLeft: 20 }}>
      {narrLabel('CORE TASKS', v)}
      {actions.map((a, i) => <div key={i} style={{ marginTop: 12, background: '#F8FAFC', borderRadius: 4, padding: '10px 12px' }}>
        <div style={{ color: acc, fontSize: 11, fontWeight: 950 }}>{String(i+1).padStart(2,'0')}</div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 900 }}>{a.body?.split(' → ')[0] || a.body?.split('→')[0] || a.body}</div>
        {a.body?.includes('→') ? <div style={{ marginTop: 2, fontSize: 11, color: '#64748B' }}>→ {a.body.split('→').slice(1).join('→').trim()}</div> : null}
      </div>)}
    </div>
    {slide.subtitle ? <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#0F172A', padding: '14px 60px', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ fontSize: 16 }}>📈</div><div style={{ color: '#E2E8F0', fontSize: 13, ...textClamp(1) }}>{slide.subtitle}</div></div> : null}
  </>);
}

function renderNarrativeArchitecture(slide, t, v) {
  const acc = narrAccent(v);
  const items = (slide.items || []).slice(0, 4);
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 30, { min: 22, max: 34 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 188, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {items.map((item, i) => <div key={i} style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 6 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ background: '#0F172A', color: acc, fontSize: 11, fontWeight: 950, padding: '3px 8px', borderRadius: 3, flexShrink: 0 }}>{String(i+1).padStart(2,'0')}</div>
          <div style={{ color: acc, fontSize: 13, fontWeight: 900 }}>{item.heading}</div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12.5, color: '#64748B', lineHeight: 1.5, ...textClamp(2) }}>{item.body?.split(' → ')[0] || item.body}</div>
        {item.body?.includes('→') ? <div style={{ marginTop: 6, fontSize: 12, fontWeight: 850, color: '#0F172A' }}>→ {item.body.split('→').slice(1).join('→').trim()}</div> : null}
      </div>)}
    </div>
    {slide.subtitle ? <div style={{ position: 'absolute', left: 60, right: 60, bottom: 16, borderLeft: `3px solid ${acc}`, paddingLeft: 14, background: '#F8FAFC', padding: '10px 14px' }}><div style={{ color: '#64748B', fontSize: 10, letterSpacing: '0.18em', fontWeight: 850 }}>CORE INSIGHT</div><div style={{ marginTop: 4, fontSize: 13, color: acc, fontWeight: 850, ...textClamp(2) }}>{slide.subtitle}</div></div> : null}
  </>);
}

function renderNarrativeResults(slide, t, v) {
  const acc = narrAccent(v);
  const all = (slide.items || []).slice(0, 7);
  const deliverables = all.slice(0, 4);
  const growth = all.slice(4, 7);
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 30, { min: 22, max: 34 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, top: 190, width: 360 }}>
      {narrLabel('KEY DELIVERABLES', v)}
      {deliverables.map((d, i) => <div key={i} style={{ marginTop: 12, display: 'flex', gap: 10 }}><div style={{ color: acc, fontSize: 15, marginTop: 1 }}>✓</div><div style={{ fontSize: 13.5, fontWeight: 850, color: '#0F172A', ...textClamp(2) }}>{d.heading}</div></div>)}
    </div>
    <div style={{ position: 'absolute', right: 60, top: 190, width: 310, background: '#0F172A', borderRadius: 8, padding: '20px 22px' }}>
      <div style={{ color: '#94A3B8', fontSize: 11, letterSpacing: '0.18em', fontWeight: 850 }}>GROWTH POINTS</div>
      {growth.map((g, i) => <div key={i} style={{ marginTop: 14, display: 'flex', gap: 8 }}><div style={{ color: acc, fontSize: 13, marginTop: 2 }}>→</div><div style={{ fontSize: 12.5, color: '#E2E8F0', lineHeight: 1.5, ...textClamp(3) }}>{g.heading}</div></div>)}
    </div>
  </>);
}

function renderNarrativeAwards(slide, t, v) {
  const acc = narrAccent(v);
  const all = (slide.items || []);
  const awards = all.filter(a => !a.period?.toLowerCase().includes('language') && !a.heading?.toLowerCase().includes('toeic') && !a.heading?.toLowerCase().includes('language'));
  const lang = all.find(a => a.period?.toLowerCase().includes('language') || a.heading?.toLowerCase().includes('toeic') || a.heading?.toLowerCase().includes('language')) || all.slice(-1)[0];
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: 32, fontWeight: 950 }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, top: 185, width: 360 }}>
      {narrLabel('AWARDS', v)}
      {(awards.length ? awards : all.slice(0, 2)).map((a, i) => <div key={i} style={{ marginTop: 14, background: '#F8FAFC', borderLeft: `3px solid ${acc}`, borderRadius: '0 6px 6px 0', padding: '12px 16px' }}><div style={{ display: 'flex', gap: 8 }}><div style={{ fontSize: 16 }}>🏆</div><div style={{ fontSize: 14, fontWeight: 900 }}>{a.heading}</div></div><div style={{ marginTop: 4, fontSize: 12, color: '#64748B', paddingLeft: 24 }}>{a.body}</div></div>)}
    </div>
    <div style={{ position: 'absolute', right: 60, top: 185, width: 280 }}>
      {narrLabel('LANGUAGE', v)}
      {lang ? <div style={{ marginTop: 14, background: '#F8FAFC', borderLeft: `3px solid ${acc}`, borderRadius: '0 6px 6px 0', padding: '14px 16px' }}><div style={{ display: 'flex', gap: 8 }}><div style={{ fontSize: 16 }}>📚</div><div style={{ fontSize: 14, fontWeight: 900 }}>{lang.heading}</div></div><div style={{ marginTop: 6, fontSize: 12, color: '#64748B', paddingLeft: 24, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{lang.body}</div></div> : null}
    </div>
  </>);
}

function renderNarrativeTimeline(slide, t, v) {
  const acc = narrAccent(v);
  const items = (slide.items || []).slice(0, 5);
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 30, { min: 22, max: 34 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 188, bottom: 64 }}>
      {items.map((item, i) => <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
        <div style={{ width: 70, flexShrink: 0, color: acc, fontSize: 15, fontWeight: 950, paddingTop: 2 }}>{item.period || `202${1+i}`}</div>
        <div style={{ width: 4, flexShrink: 0, background: acc, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 }} />
        <div><div style={{ fontSize: 14, fontWeight: 900, color: '#0F172A' }}>{item.heading}</div><div style={{ marginTop: 4, fontSize: 12.5, color: '#64748B', ...textClamp(2) }}>{item.body}</div></div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#0F172A', padding: '12px 60px', display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ fontSize: 15 }}>🚀</div><div style={{ color: '#E2E8F0', fontSize: 13, ...textClamp(1) }}>{slide.subtitle}</div></div>
  </>);
}

function renderNarrativeSummary(slide, t, v) {
  const acc = narrAccent(v);
  const items = (slide.items || []).slice(0, 3);
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 30, { min: 22, max: 34 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 188, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
      {items.map((item, i) => <div key={i} style={{ background: '#F8FAFC', borderRadius: 8, padding: '20px 18px', borderTop: `3px solid ${acc}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: acc, fontSize: 26, fontWeight: 950, lineHeight: 1 }}>{String(i+1).padStart(2,'0')}</div>
        <div style={{ marginTop: 12, fontSize: 14, fontWeight: 950, lineHeight: 1.4, ...textClamp(3) }}>{item.heading}</div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#64748B', lineHeight: 1.6, flex: 1, ...textClamp(5) }}>{item.body}</div>
        <div style={{ marginTop: 14, background: '#0F172A', color: '#E2E8F0', fontSize: 10, fontWeight: 950, padding: '5px 8px', letterSpacing: '0.1em', borderRadius: 3, alignSelf: 'flex-start' }}>PROVEN IN: {(item.period || item.role || '').toUpperCase()}</div>
      </div>)}
    </div>
  </>);
}

function renderNarrativeConnection(slide, t, v) {
  const acc = narrAccent(v);
  const items = (slide.items || []).slice(0, 3);
  const headers = ['PROJECT', 'CORE TECH', 'WHAT I LEARNED', 'CONNECTION TO NEXT'];
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 30, { min: 22, max: 34 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 188 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.3fr 1.3fr', background: '#0F172A', borderRadius: '6px 6px 0 0', padding: '10px 0' }}>
        {headers.map((h, i) => <div key={i} style={{ padding: '0 14px', color: '#94A3B8', fontSize: 10.5, fontWeight: 850, letterSpacing: '0.12em' }}>{h}</div>)}
      </div>
      {items.map((item, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.3fr 1.3fr', borderBottom: '1px solid #E2E8F0', padding: '12px 0' }}>
        <div style={{ padding: '0 14px', fontSize: 14, fontWeight: 950 }}>{item.heading}</div>
        <div style={{ padding: '0 14px', fontSize: 11, color: acc, whiteSpace: 'pre-line', lineHeight: 1.6 }}>{item.body}</div>
        <div style={{ padding: '0 14px', fontSize: 12.5, fontWeight: 850, color: '#0F172A', ...textClamp(2) }}>{item.period}</div>
        <div style={{ padding: '0 14px', fontSize: 12, color: acc, display: 'flex', gap: 5, alignItems: 'flex-start' }}><span>🔗</span><span style={{ ...textClamp(2) }}>{item.role}</span></div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#0F172A', padding: '12px 60px', display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ fontSize: 16 }}>🔗</div><div style={{ color: '#E2E8F0', fontSize: 13, ...textClamp(1) }}>{slide.subtitle}</div></div>
  </>);
}

function renderNarrativeRoadmap(slide, t, v) {
  const acc = narrAccent(v);
  const items = (slide.items || []).slice(0, 3);
  const labels = ['SHORT-TERM', 'MID-TERM', 'LONG-TERM'];
  return narrShell(<>
    <div style={{ position: 'absolute', left: 60, top: 52, right: 60 }}>
      <div style={{ fontSize: dynamicFontPx(slide.title || '', 30, { min: 22, max: 34 }), fontWeight: 950, lineHeight: 1.18, ...textClamp(2) }}>{slide.title}</div>
      {narrRule(v)}
    </div>
    <div style={{ position: 'absolute', left: 60, right: 60, top: 190, bottom: 80 }}>
      {items.map((item, i) => <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 14, borderLeft: `3px solid ${acc}`, paddingLeft: 16, paddingTop: 6, paddingBottom: 6 }}>
        <div style={{ width: 90, flexShrink: 0, color: acc, fontSize: 11, fontWeight: 950, letterSpacing: '0.1em', paddingTop: 2 }}>{(item.period || item.role || labels[i]).toUpperCase()}</div>
        <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.55, ...textClamp(2) }}>{item.body}</div>
      </div>)}
    </div>
    {slide.subtitle ? <div style={{ position: 'absolute', left: 60, right: 60, bottom: 14, background: '#0F172A', borderRadius: 6, padding: '16px 20px' }}><div style={{ color: acc, fontSize: 16, fontWeight: 950, lineHeight: 1 }}>"</div><div style={{ marginTop: 6, color: '#E2E8F0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line', ...textClamp(3) }}>{slide.subtitle}</div></div> : null}
  </>);
}

function renderNarrativeClosing(slide, t, v) {
  const acc = narrAccent(v);
  const contacts = (slide.bullets || []).slice(0, 3);
  const chips = (slide.items || []).slice(0, 7);
  const contactIcons = ['✉', '📞', '🎓'];
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0F172A', fontFamily: 'Pretendard, sans-serif', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 60, right: 60, top: '50%', transform: 'translateY(-50%)', textAlign: 'center' }}>
        <div style={{ fontSize: dynamicFontPx(slide.title || '', 32, { min: 24, max: 38 }), fontWeight: 950, color: '#FFFFFF', lineHeight: 1.3, fontStyle: 'italic', whiteSpace: 'pre-line', ...textClamp(4) }}>{slide.title}</div>
        <div style={{ margin: '20px auto', width: 52, height: 4, background: acc, borderRadius: 2 }} />
        <div style={{ fontSize: 15, color: acc, fontWeight: 850 }}>{slide.subtitle}</div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 32 }}>
          {contacts.map((c, i) => <div key={i} style={{ textAlign: 'center' }}><div style={{ fontSize: 16 }}>{contactIcons[i]}</div><div style={{ marginTop: 6, color: '#CBD5E1', fontSize: 12.5, ...textClamp(1) }}>{c}</div></div>)}
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {chips.map((chip, i) => <div key={i} style={{ border: `1px solid ${i === 2 ? acc : '#334155'}`, color: i === 2 ? acc : '#CBD5E1', borderRadius: 4, padding: '5px 12px', fontSize: 12, fontFamily: 'monospace' }}>{chip.heading}</div>)}
        </div>
      </div>
    </div>
  );
}

function renderNarrativeSlide(slide, t, v, index) {
  const NARR_KIND = {
    'narrative-cover': 'cover', 'narrative-profile': 'profile', 'narrative-philosophy': 'philosophy',
    'narrative-skills': 'skills', 'narrative-problem': 'problem', 'narrative-project': 'project',
    'narrative-challenge': 'challenge', 'narrative-architecture': 'architecture', 'narrative-results': 'results',
    'narrative-awards': 'awards', 'narrative-timeline': 'timeline', 'narrative-summary': 'summary',
    'narrative-connection': 'connection', 'narrative-roadmap': 'roadmap', 'narrative-closing': 'closing',
  };
  const nkind = NARR_KIND[slide.layout];
  if (nkind === 'cover') return renderNarrativeCover(slide, t, v);
  if (nkind === 'profile') return renderNarrativeProfile(slide, t, v);
  if (nkind === 'philosophy') return renderNarrativePhilosophy(slide, t, v);
  if (nkind === 'skills') return renderNarrativeSkills(slide, t, v);
  if (nkind === 'problem') return renderNarrativeProblem(slide, t, v);
  if (nkind === 'project') return renderNarrativeProject(slide, t, v);
  if (nkind === 'challenge') return renderNarrativeChallenge(slide, t, v);
  if (nkind === 'architecture') return renderNarrativeArchitecture(slide, t, v);
  if (nkind === 'results') return renderNarrativeResults(slide, t, v);
  if (nkind === 'awards') return renderNarrativeAwards(slide, t, v);
  if (nkind === 'timeline') return renderNarrativeTimeline(slide, t, v);
  if (nkind === 'summary') return renderNarrativeSummary(slide, t, v);
  if (nkind === 'connection') return renderNarrativeConnection(slide, t, v);
  if (nkind === 'roadmap') return renderNarrativeRoadmap(slide, t, v);
  if (nkind === 'closing') return renderNarrativeClosing(slide, t, v);
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = acceptedLines(slide);
  const mood = acceptedSlideMood(slide, index);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return renderVariedAcceptedSlide(slide, t, v, index, 'STORY PORTFOLIO');
  if (!isCover && mood === 'toc') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 60, top: 54, fontFamily: v.font, fontSize: 54, fontWeight: 900, lineHeight: 1.05, width: 360 }}>{slide.title}</div>
        <div style={{ position: 'absolute', right: 60, top: 54, bottom: 50, width: 430, display: 'grid', gridTemplateRows: `repeat(${Math.min(5, Math.max(1, lines.length))}, 1fr)`, gap: 10 }}>
          {lines.slice(0, 5).map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 18, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.16)' }}>
              <div style={{ color: v.accent, fontSize: 24, fontWeight: 900 }}>{String(i + 1).padStart(2, '0')}</div>
              <div><div style={{ fontSize: 19, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div><div style={{ marginTop: 5, color: 'rgba(255,255,255,0.58)', fontSize: 12, ...textClamp(1) }}>{line.body}</div></div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 60, bottom: 58, color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 900 }}>CONTENTS</div>
      </div>
    );
  }
  if (!isCover && mood === 'metric') {
    const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 3);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 62, top: 54, fontSize: 12, color: v.accent, letterSpacing: '0.2em', fontWeight: 900 }}>{slide.sectionLabel || 'IMPACT'}</div>
        <div style={{ position: 'absolute', left: 62, top: 104, width: 520, fontFamily: v.font, fontSize: 48, lineHeight: 1.06, fontWeight: 900, ...textClamp(3) }}>{slide.title}</div>
        {slide.subtitle ? <div style={{ position: 'absolute', left: 62, top: 280, width: 420, fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.62)', ...textClamp(3) }}>{slide.subtitle}</div> : null}
        <div style={{ position: 'absolute', right: 62, top: 80, bottom: 62, width: 300, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {(metrics.length ? metrics : [{ label: lines[0]?.heading, value: lines[0]?.body }]).slice(0, 3).map((m, i) => (
            <div key={i} style={{ borderLeft: `5px solid ${i === 0 ? v.accent : 'rgba(255,255,255,0.18)'}`, paddingLeft: 20 }}>
              <div style={{ fontSize: 46, lineHeight: 1, color: i === 0 ? v.accent : '#FFFFFF', fontWeight: 300, ...textClamp(1) }}>{acceptedMetricText(m)}</div>
              <div style={{ marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.68)', fontWeight: 800, ...textClamp(2) }}>{m?.label || '핵심 성과'}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', right: -80, bottom: -90, width: 260, height: 260, borderRadius: '50%', border: `44px solid ${v.accent}`, opacity: 0.28 }} />
      </div>
    );
  }
  if (!isCover && mood === 'process') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 48, right: 54, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: v.accent, letterSpacing: '0.2em', fontWeight: 900 }}>{slide.sectionLabel || 'PROCESS'}</div>
          <div style={{ fontSize: 11, color: v.muted, fontWeight: 800 }}>{String(index + 1).padStart(2, '0')}</div>
        </div>
        <div style={{ position: 'absolute', left: 54, top: 96, width: 350, fontFamily: v.font, fontSize: 35, lineHeight: 1.12, fontWeight: 900, ...textClamp(3) }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 430, right: 58, top: 98, bottom: 58 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: `2px solid ${v.soft}` }} />
          {lines.slice(0, 4).map((line, i) => (
            <div key={i} style={{ position: 'absolute', left: `${i * 24}%`, top: i % 2 ? '52%' : '8%', width: 150 }}>
              <div style={{ width: 54, height: 54, borderRadius: '50%', background: i === 0 ? v.accent : v.dark, color: i === 0 ? v.dark : '#FFFFFF', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{i + 1}</div>
              <div style={{ marginTop: 12, fontSize: 16, fontWeight: 900, ...textClamp(2) }}>{line.heading}</div>
              <div style={{ marginTop: 7, fontSize: 11.5, lineHeight: 1.4, color: v.muted, ...textClamp(3) }}>{line.body}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!isCover) return renderVariedAcceptedSlide(slide, t, v, index, 'STORY PORTFOLIO');
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 46, top: 38, bottom: 38, width: 92, borderRight: `1px solid ${v.soft}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, letterSpacing: '0.22em', color: v.muted, fontWeight: 800 }}>STORY PORTFOLIO</div>
        <div style={{ fontFamily: v.font, fontSize: 42, color: v.accent, fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</div>
      </div>
      <div style={{ position: 'absolute', left: 178, right: 64, top: isCover ? 96 : 54 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.2em', color: v.accent, fontWeight: 900, textTransform: 'uppercase' }}>{slide.sectionLabel || 'Narrative'}</div>
        <div style={{ marginTop: 14, fontFamily: v.font, fontSize: isCover ? 58 : 38, lineHeight: 1.08, fontWeight: 900, color: v.ink, ...textClamp(isCover ? 3 : 2) }}>{slide.title}</div>
        {slide.subtitle ? <div style={{ marginTop: 14, width: 620, fontSize: 16, color: v.muted, lineHeight: 1.5, ...textClamp(2) }}>{slide.subtitle}</div> : null}
      </div>
      {!isCover && (
        <div style={{ position: 'absolute', left: 178, right: 64, bottom: 50, display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, lines.length))}, 1fr)`, gap: 18 }}>
          {lines.slice(0, 3).map((line, i) => (
            <div key={i} style={{ minHeight: 150, background: i === 0 ? v.dark : v.card, color: i === 0 ? '#FFFFFF' : v.ink, borderRadius: 22, padding: 22, boxShadow: '0 18px 44px rgba(45,34,24,0.08)' }}>
              <div style={{ fontSize: 12, color: i === 0 ? v.accent : v.muted, fontWeight: 900 }}>{line.period || `CHAPTER ${i + 1}`}</div>
              <div style={{ marginTop: 18, fontSize: 20, fontWeight: 900, lineHeight: 1.2, ...textClamp(2) }}>{line.heading}</div>
              <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.55, opacity: 0.82, ...textClamp(4) }}>{line.body}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'absolute', right: 58, bottom: 30, width: 160, height: 6, borderRadius: 999, background: v.soft }}><div style={{ width: `${Math.min(100, (index + 1) * 10)}%`, height: '100%', borderRadius: 999, background: v.accent }} /></div>
    </div>
  );
}

function renderStarPhaseBadge(v, phase, label) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ background: v.accent, color: v.dark, fontSize: 10, fontWeight: 950, padding: '4px 14px', borderRadius: 999 }}>{label}</div>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: v.dark, display: 'grid', placeItems: 'center', color: v.accent, fontSize: 13, fontWeight: 950 }}>{phase}</div>
    </div>
  );
}

function renderStarCover(slide, t, v) {
  const items = (slide.items || []).slice(0, 4);
  const fills = [v.dark, v.card, v.card, v.accent];
  const borders = ['none', `1px solid ${v.soft}`, `1px solid ${v.soft}`, 'none'];
  const fgs = ['#FFFFFF', v.ink, v.ink, v.dark];
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 34, fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: v.muted }}>STAT / STAR</div>
      <div style={{ position: 'absolute', left: 44, top: 72, width: 356 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 52, fontWeight: 950, lineHeight: 1.02, letterSpacing: '-0.04em', color: v.dark, ...textClamp(2) }}>{slide.title}</div>
        {slide.subtitle && <div style={{ marginTop: 14, fontSize: 13, color: v.muted, lineHeight: 1.55, ...textClamp(3) }}>{slide.subtitle}</div>}
        <div style={{ marginTop: 26, display: 'flex', gap: 8 }}>
          {['S', 'T', 'A', 'R'].map(l => (
            <div key={l} style={{ width: 36, height: 36, borderRadius: '50%', background: v.accent, color: v.dark, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 950 }}>{l}</div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 40, top: 54, bottom: 38, width: 484, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ borderRadius: 22, background: fills[i], color: fgs[i], padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: borders[i], overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: i === 3 ? v.dark : v.accent, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 950, color: i === 3 ? v.accent : v.dark, flexShrink: 0 }}>{['S', 'T', 'A', 'R'][i]}</div>
              <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.55 }}>{['Situation', 'Task', 'Action', 'Result'][i]}</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2, ...textClamp(2) }}>{item.heading}</div>
              <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.45, opacity: 0.72, ...textClamp(3) }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarIdentity(slide, t, v) {
  const items = (slide.items || []).slice(0, 3);
  const icons = ['🎓', '🎯', '⚡'];
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 32, fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: v.muted }}>{(slide.sectionLabel || 'PROFESSIONAL IDENTITY').toUpperCase()}</div>
      <div style={{ position: 'absolute', left: 44, top: 62, right: 44 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 34, fontWeight: 950, letterSpacing: '-0.03em', color: v.dark, lineHeight: 1.1, ...textClamp(2) }}>{slide.title}</div>
        {slide.subtitle && <div style={{ marginTop: 7, fontSize: 13, color: v.muted }}>{slide.subtitle}</div>}
      </div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 182, bottom: 38, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: v.card, borderRadius: 22, padding: 24, border: `1px solid ${v.soft}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: v.accent, display: 'grid', placeItems: 'center', fontSize: 20 }}>{icons[i]}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: v.dark, ...textClamp(2) }}>{item.heading}</div>
            <div style={{ fontSize: 12, color: v.muted, lineHeight: 1.5, ...textClamp(5) }}>{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarTimeline(slide, t, v) {
  const items = (slide.items || []).slice(0, 4);
  const n = Math.max(1, items.length);
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 32, fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: v.muted }}>{(slide.sectionLabel || 'EXPERIENCE TIMELINE').toUpperCase()}</div>
      <div style={{ position: 'absolute', left: 44, top: 62, right: 44, fontFamily: t.fonts.heading, fontSize: 32, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em', ...textClamp(2) }}>{slide.title}</div>
      <div style={{ position: 'absolute', left: 52, right: 52, top: 148, height: 3, background: v.soft, borderRadius: 999 }} />
      <div style={{ position: 'absolute', left: 44, right: 44, top: 140, bottom: 36, display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: i === 0 ? v.accent : v.soft, border: `3px solid ${v.accent}`, flexShrink: 0, marginTop: 3 }} />
            <div style={{ background: v.card, borderRadius: 18, padding: 16, border: `1px solid ${v.soft}`, flex: 1, width: '100%', marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: v.muted, letterSpacing: '0.1em' }}>{item.period}</div>
              <div style={{ marginTop: 5, fontSize: 14, fontWeight: 900, color: v.dark, lineHeight: 1.2, ...textClamp(2) }}>{item.heading}</div>
              <div style={{ marginTop: 6, fontSize: 11, color: v.muted, lineHeight: 1.45, ...textClamp(3) }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarSituation(slide, t, v) {
  const metrics = (slide.metrics || []).slice(0, 2);
  const hasMetrics = metrics.length > 0;
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 30 }}>{renderStarPhaseBadge(v, 'S', slide.sectionLabel || 'SITUATION')}</div>
      <div style={{ position: 'absolute', left: 44, top: 80, right: 44 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 32, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em', lineHeight: 1.1, ...textClamp(2) }}>{slide.title}</div>
        {slide.subtitle && <div style={{ marginTop: 5, fontSize: 13, color: v.muted }}>{slide.subtitle}</div>}
      </div>
      <div style={{ position: 'absolute', left: 44, top: 185, right: hasMetrics ? 222 : 44, bottom: 38, background: v.dark, borderRadius: 22, padding: '22px 26px', color: '#FFFFFF' }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: v.accent, letterSpacing: '0.15em' }}>SITUATION</div>
        <div style={{ marginTop: 11, fontSize: 13.5, lineHeight: 1.7, opacity: 0.9, ...textClamp(7) }}>{slide.body || slide.subtitle || ''}</div>
      </div>
      {hasMetrics && (
        <div style={{ position: 'absolute', right: 44, top: 185, width: 162, bottom: 38, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ flex: 1, background: i === 0 ? v.accent : v.card, borderRadius: 18, padding: '16px 16px', border: i === 1 ? `1px solid ${v.soft}` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em' }}>{m.value || m.label}</div>
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: v.dark, opacity: i === 0 ? 0.8 : 0.6 }}>{m.label || m.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderStarTask(slide, t, v) {
  const items = (slide.items || []).slice(0, 3);
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 30 }}>{renderStarPhaseBadge(v, 'T', slide.sectionLabel || 'TASK')}</div>
      <div style={{ position: 'absolute', left: 44, top: 80, right: 44, fontFamily: t.fonts.heading, fontSize: 30, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em', ...textClamp(2) }}>{slide.title}</div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 172, bottom: 38, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: v.card, borderRadius: 20, padding: 22, border: `2px solid ${v.accent}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: v.muted, letterSpacing: '0.1em' }}>{item.period || `TASK ${String(i + 1).padStart(2, '0')}`}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: v.dark, lineHeight: 1.2, ...textClamp(2) }}>{item.heading}</div>
            <div style={{ fontSize: 12, color: v.muted, lineHeight: 1.5, ...textClamp(5) }}>{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarAction(slide, t, v) {
  const items = (slide.items || []).slice(0, 3);
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 30 }}>{renderStarPhaseBadge(v, 'A', slide.sectionLabel || 'ACTION')}</div>
      <div style={{ position: 'absolute', left: 44, top: 80, right: 44, fontFamily: t.fonts.heading, fontSize: 30, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em', ...textClamp(2) }}>{slide.title}</div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 170, bottom: 38, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item, i) => (
          <div key={i} style={{ flex: 1, background: v.card, borderRadius: 16, padding: '0 20px', border: `1px solid ${v.soft}`, display: 'grid', gridTemplateColumns: '52px 1fr', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: v.dark, display: 'grid', placeItems: 'center', color: v.accent, fontSize: 13, fontWeight: 950 }}>
              {item.period || String(i + 1).padStart(2, '0')}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: v.dark, ...textClamp(1) }}>{item.heading}</div>
              <div style={{ marginTop: 4, fontSize: 11.5, color: v.muted, lineHeight: 1.45, ...textClamp(2) }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarResult(slide, t, v) {
  const metrics = (slide.metrics || []).slice(0, 3);
  const hasBody = !!slide.body;
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 30 }}>{renderStarPhaseBadge(v, 'R', slide.sectionLabel || 'RESULT')}</div>
      <div style={{ position: 'absolute', left: 44, top: 80, right: 44, fontFamily: t.fonts.heading, fontSize: 30, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em', ...textClamp(2) }}>{slide.title}</div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 170, bottom: hasBody ? 112 : 38, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {(metrics.length ? metrics : [{ label: '성과', value: '달성' }]).slice(0, 3).map((m, i) => (
          <div key={i} style={{ background: v.accent, borderRadius: 20, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 950, color: v.dark, letterSpacing: '-0.04em' }}>{m.value}</div>
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 900, color: v.dark }}>{m.label}</div>
            {m.body && <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(0,0,0,0.55)', lineHeight: 1.4, ...textClamp(2) }}>{m.body}</div>}
          </div>
        ))}
      </div>
      {hasBody && (
        <div style={{ position: 'absolute', left: 44, right: 44, bottom: 36, height: 66, background: v.dark, borderRadius: 18, padding: '12px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: v.accent, letterSpacing: '0.15em' }}>KEY TAKEAWAY</div>
          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: '#FFFFFF', opacity: 0.9, ...textClamp(2) }}>{slide.body}</div>
        </div>
      )}
    </div>
  );
}

function renderStarQA(slide, t, v) {
  const items = (slide.items || []).slice(0, 2);
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 32, fontSize: 10, fontWeight: 900, letterSpacing: '0.2em', color: v.muted }}>{(slide.sectionLabel || 'PREDICTED Q&A').toUpperCase()}</div>
      <div style={{ position: 'absolute', left: 44, top: 62, right: 44, fontFamily: t.fonts.heading, fontSize: 28, fontWeight: 950, color: v.dark, ...textClamp(2) }}>{slide.title}</div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 150, bottom: 38, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: v.card, borderRadius: 20, padding: 24, border: `1px solid ${v.soft}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: v.dark, color: v.accent, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 950, flexShrink: 0 }}>Q</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: v.dark, lineHeight: 1.35, ...textClamp(3) }}>{item.heading}</div>
            </div>
            <div style={{ height: 1, background: v.soft }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: v.accent, color: v.dark, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 950, flexShrink: 0 }}>A</div>
              <div style={{ fontSize: 11.5, color: v.muted, lineHeight: 1.55, ...textClamp(6) }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarAwards(slide, t, v) {
  const items = (slide.items || []).slice(0, 3);
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 26, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: v.accent, display: 'grid', placeItems: 'center', fontSize: 20 }}>🏆</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: v.muted, letterSpacing: '0.2em' }}>{(slide.sectionLabel || 'HONORS & RECOGNITION').toUpperCase()}</div>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 26, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em', ...textClamp(1) }}>{slide.title}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 120, bottom: 38, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: v.card, borderRadius: 20, padding: 22, border: `1px solid ${v.soft}` }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: v.muted }}>{item.period || item.role}</div>
            <div style={{ marginTop: 8, fontSize: 17, fontWeight: 950, color: v.dark, ...textClamp(2) }}>{item.heading}</div>
            <div style={{ marginTop: 9, fontSize: 12, color: v.muted, lineHeight: 1.5, ...textClamp(5) }}>{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarRoadmap(slide, t, v) {
  const items = (slide.items || []).slice(0, 3);
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 44, top: 26, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: v.accent, display: 'grid', placeItems: 'center', fontSize: 20 }}>🚀</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: v.muted, letterSpacing: '0.2em' }}>{(slide.sectionLabel || 'FUTURE ROADMAP').toUpperCase()}</div>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 26, fontWeight: 950, color: v.dark, letterSpacing: '-0.03em', ...textClamp(1) }}>{slide.title}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 44, right: 44, top: 120, bottom: 38, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: v.accent, borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: v.dark, opacity: 0.65 }}>{item.period || `Phase ${String(i + 1).padStart(2, '0')}`}</div>
            <div style={{ fontSize: 17, fontWeight: 950, color: v.dark, ...textClamp(2) }}>{item.heading}</div>
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)', lineHeight: 1.5, ...textClamp(5) }}>{item.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStarClosing(slide, t, v) {
  const bullets = slide.bullets || [];
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.dark, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '82%' }}>
        <div style={{ display: 'inline-block', background: v.accent, color: v.dark, fontSize: 10, fontWeight: 950, padding: '5px 18px', borderRadius: 999, letterSpacing: '0.2em', marginBottom: 20 }}>THANK YOU</div>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 58, fontWeight: 950, color: v.accent, letterSpacing: '-0.04em', lineHeight: 1.0 }}>{slide.title}</div>
        {slide.subtitle && <div style={{ marginTop: 15, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{slide.subtitle}</div>}
        {bullets.length > 0 && (
          <div style={{ marginTop: 26, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', fontSize: 11, padding: '7px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)' }}>{b}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderStarSlide(slide, t, v, index) {
  const l = slide.layout;
  if (l === 'star-cover') return renderStarCover(slide, t, v);
  if (l === 'star-identity') return renderStarIdentity(slide, t, v);
  if (l === 'star-timeline') return renderStarTimeline(slide, t, v);
  if (l === 'star-situation') return renderStarSituation(slide, t, v);
  if (l === 'star-task') return renderStarTask(slide, t, v);
  if (l === 'star-action') return renderStarAction(slide, t, v);
  if (l === 'star-result') return renderStarResult(slide, t, v);
  if (l === 'star-qa') return renderStarQA(slide, t, v);
  if (l === 'star-awards') return renderStarAwards(slide, t, v);
  if (l === 'star-roadmap') return renderStarRoadmap(slide, t, v);
  if (l === 'star-closing') return renderStarClosing(slide, t, v);
  const isCover = l === 'cover' || l === 'section';
  const lines = acceptedLines(slide);
  const labels = ['S', 'T', 'A', 'R'];
  const mood = acceptedSlideMood(slide, index);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return renderVariedAcceptedSlide(slide, t, v, index, 'STAT / STAR');
  if (!isCover && mood === 'toc') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 48, top: 48, right: 48, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 40, height: 440 }}>
          <div style={{ borderRadius: 30, background: v.dark, color: '#FFFFFF', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.2em', fontWeight: 900 }}>EVIDENCE MAP</div>
            <div style={{ fontSize: 38, lineHeight: 1.08, fontWeight: 950, ...textClamp(4) }}>{slide.title}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {lines.slice(0, 4).map((line, i) => (
              <div key={i} style={{ borderRadius: 24, background: i === 3 ? v.accent : v.card, color: i === 3 ? v.dark : v.ink, padding: 24, border: i === 3 ? 'none' : `1px solid ${v.soft}` }}>
                <div style={{ fontSize: 34, fontWeight: 950 }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ marginTop: 18, fontSize: 18, fontWeight: 900, ...textClamp(2) }}>{line.heading}</div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, opacity: 0.72, ...textClamp(3) }}>{line.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!isCover && mood === 'process') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 50, top: 48, width: 450 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.2em', fontWeight: 900 }}>{slide.sectionLabel || 'STAR DETAIL'}</div>
          <div style={{ marginTop: 18, fontSize: 40, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.04em', ...textClamp(3) }}>{slide.title}</div>
          {slide.subtitle ? <div style={{ marginTop: 16, fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.5, ...textClamp(2) }}>{slide.subtitle}</div> : null}
        </div>
        <div style={{ position: 'absolute', left: 530, right: 50, top: 64, bottom: 50, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {labels.map((label, i) => {
            const line = lines[i] || {};
            return <div key={label} style={{ flex: 1, display: 'grid', gridTemplateColumns: '64px 1fr', gap: 16, alignItems: 'center', borderRadius: 18, background: i === 3 ? v.accent : 'rgba(255,255,255,0.08)', color: i === 3 ? v.dark : '#FFFFFF', padding: '12px 18px' }}><div style={{ width: 48, height: 48, borderRadius: '50%', background: i === 3 ? v.dark : v.accent, color: i === 3 ? v.accent : v.dark, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 950 }}>{label}</div><div><div style={{ fontSize: 15, fontWeight: 900, ...textClamp(1) }}>{line.heading || ['상황', '과제', '행동', '결과'][i]}</div><div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.35, opacity: 0.74, ...textClamp(2) }}>{line.body}</div></div></div>;
          })}
        </div>
      </div>
    );
  }
  if (!isCover) return renderVariedAcceptedSlide(slide, t, v, index, 'STAT / STAR');
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 42, top: 34, fontSize: 12, fontWeight: 900, letterSpacing: '0.18em' }}>STAT / STAR</div>
      <div style={{ position: 'absolute', right: 42, top: 34, fontSize: 13, color: v.muted, fontWeight: 800 }}>{String(index + 1).padStart(2, '0')}</div>
      <div style={{ position: 'absolute', left: 42, top: 84, width: 330 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: isCover ? 50 : 34, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.04em', ...textClamp(isCover ? 4 : 3) }}>{slide.title}</div>
        {slide.subtitle ? <div style={{ marginTop: 18, color: v.muted, fontSize: 14, lineHeight: 1.5, ...textClamp(3) }}>{slide.subtitle}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 420, right: 42, top: 82, bottom: 42, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {labels.map((label, i) => {
          const line = lines[i] || {};
          const fill = i === 3 ? v.accent : i === 0 ? v.dark : v.card;
          const fg = i === 3 ? '#111827' : i === 0 ? '#FFFFFF' : v.ink;
          return (
            <div key={label} style={{ borderRadius: 26, background: fill, color: fg, padding: 24, overflow: 'hidden', border: i === 1 || i === 2 ? `1px solid ${v.soft}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: i === 3 ? '#111827' : v.accent, color: i === 3 ? v.accent : '#111827', fontSize: 26, fontWeight: 950 }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 900, opacity: 0.55 }}>{['Situation', 'Task', 'Action', 'Result'][i]}</div>
              </div>
              <div style={{ marginTop: 22, fontSize: 18, fontWeight: 900, lineHeight: 1.22, ...textClamp(2) }}>{line.heading || ['상황', '과제', '행동', '결과'][i]}</div>
              <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, opacity: 0.78, ...textClamp(4) }}>{line.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KPI Dashboard dedicated render functions ────────────────────────────────

function kpiGrid(t) {
  const { blue } = t ? kpiPaletteColors(t) : { blue: '#3182FF' };
  const rgb = hexToRgb(blue);
  const gl = `rgba(${rgb.red},${rgb.green},${rgb.blue},0.055)`;
  return {
    backgroundColor: '#0E1727',
    backgroundImage: `linear-gradient(${gl} 1px, transparent 1px), linear-gradient(90deg, ${gl} 1px, transparent 1px)`,
    backgroundSize: '40px 40px',
  };
}

function renderKpiCover(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)';
  const title = cleanPortfolioText(slide.title || 'Portfolio');
  const subtitle = cleanPortfolioText(slide.subtitle || '');
  const facts = [
    ['VERSION', (slide.bullets || [])[0] || '3.0.0-PRO'],
    ['CORE COMPETENCY', (slide.bullets || [])[1] || 'AI Architecture & Full-Stack'],
    ['FOCUS AREA', (slide.bullets || [])[2] || subtitle || 'Growth Metrics'],
    ['STATUS', (slide.bullets || [])[3] || 'Ready for Impact'],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 20, color: blue, fontFamily: mono, fontSize: 13, letterSpacing: '0.34em', fontWeight: 800 }}>PERFORMANCE DASHBOARD</div>
      <div style={{ position: 'absolute', left: 58, top: 50, width: 10, height: 10, borderRadius: '50%', background: mint, boxShadow: `0 0 16px ${mint}` }} />
      <div style={{ position: 'absolute', left: 78, top: 46, color: muted, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>SYSTEM ONLINE</div>
      <div style={{ position: 'absolute', left: 410, top: 46, color: muted, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>DATA SYNCED</div>
      <div style={{ position: 'absolute', right: 58, top: 46, color: muted, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>SECURE ACCESS</div>
      <div style={{ position: 'absolute', left: 58, top: 70, width: 710, fontFamily: t.fonts.heading, fontSize: 62, lineHeight: 1.03, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, top: 282, color: mint, fontFamily: mono, fontSize: 20, fontWeight: 900, ...textClamp(1) }}>{subtitle || '2021-2026 Growth Metrics & Strategic Impact'}</div>
      <div style={{ position: 'absolute', left: 58, top: 448, right: 58, height: 1, background: line }} />
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 44, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }}>
        {facts.map(([h, b]) => <div key={h}><div style={{ color: muted, fontFamily: mono, fontSize: 9, letterSpacing: '0.08em' }}>{h}</div><div style={{ marginTop: 8, color: '#FFFFFF', fontFamily: mono, fontSize: 14, fontWeight: 900, ...textClamp(1) }}>{b}</div></div>)}
      </div>
    </div>
  );
}

function renderKpiExecutive(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)'; const panel = 'rgba(23,35,56,0.78)';
  const title = cleanPortfolioText(slide.title || 'Performance Overview');
  const label = cleanPortfolioText(slide.sectionLabel || 'EXECUTIVE SUMMARY').toUpperCase();
  const cards = (slide.metrics || []).slice(0, 4);
  const defaults = [
    { label: 'Projects', value: '03', body: '주요 포트폴리오 프로젝트' },
    { label: 'Awards', value: '02', body: '수상 및 인증 내역' },
    { label: 'Skills', value: '12+', body: '기술 스택 및 역량' },
    { label: 'Contact', value: 'ON', body: '연락처 정보' },
  ];
  const items = cards.length ? cards : defaults;
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 230, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22 }}>
        {items.slice(0, 4).map((m, i) => (
          <div key={i} style={{ background: panel, border: `1px solid ${line}`, padding: '20px 18px', minHeight: 120 }}>
            <div style={{ color: blue, fontFamily: mono, fontSize: 9, letterSpacing: '0.1em', fontWeight: 800 }}>{cleanPortfolioText(m.label || `KPI ${i + 1}`).toUpperCase()}</div>
            <div style={{ marginTop: 12, color: mint, fontFamily: t.fonts.heading, fontSize: kpiMetricValueFontPx(metricDisplayValue(m), 36), lineHeight: 1.2, fontWeight: 950, ...textClamp(2) }}>{metricDisplayValue(m)}</div>
            <div style={{ marginTop: 8, color: muted, fontSize: 11, lineHeight: 1.35, ...textClamp(2) }}>{cleanPortfolioText(m.body || '')}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 42 }}>
        <div style={{ color: muted, fontFamily: mono, fontSize: 9, letterSpacing: '0.08em' }}>COMPETENCY DISTRIBUTION</div>
        <div style={{ marginTop: 12, height: 28, background: 'rgba(126,147,179,0.14)' }}>
          <div style={{ width: '78%', height: '100%', background: `linear-gradient(90deg, ${blue}, ${mint})` }} />
        </div>
      </div>
    </div>
  );
}

function renderKpiSkills(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t);
  const line = 'rgba(126,147,179,0.28)';
  const title = cleanPortfolioText(slide.title || 'Core Competency Analysis');
  const label = cleanPortfolioText(slide.sectionLabel || 'SKILL ARCHITECTURE').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  const data = items.length ? items : [
    { heading: 'Frontend', period: 'UI/UX', bullets: ['React', 'TypeScript'] },
    { heading: 'Backend', period: 'API', bullets: ['Node.js', 'Express'] },
    { heading: 'AI/ML', period: 'Engine', bullets: ['Gemini API', 'LangChain'] },
    { heading: 'DevOps', period: 'Infra', bullets: ['Docker', 'Firebase'] },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 222, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 38 }}>
        {data.slice(0, 4).map((item, i) => (
          <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 18, minHeight: 104 }}>
            <div style={{ color: i % 2 ? mint : blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', fontWeight: 800 }}>{(item.period || item.role || `COMPETENCY ${i + 1}`).toUpperCase()}</div>
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              {[item.heading, ...(item.bullets || []), item.body].filter(Boolean).slice(0, 2).map((skill, j) => (
                <div key={j}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFFFFF', fontSize: 13 }}><span>{skill}</span><span>{95 - i * 3 - j * 5}%</span></div>
                  <div style={{ marginTop: 6, height: 3, background: 'rgba(126,147,179,0.18)' }}><div style={{ width: `${95 - i * 3 - j * 5}%`, height: '100%', background: i % 2 ? mint : blue }} /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderKpiTimeline(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t);
  const title = cleanPortfolioText(slide.title || 'Performance Timeline');
  const label = cleanPortfolioText(slide.sectionLabel || 'GROWTH ANALYTICS').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  const data = items.length ? items : [
    { heading: 'Foundation', body: '기반 역량 구축', period: '2021' },
    { heading: 'Full-Stack Shift', body: '서비스 구현 범위 확장', period: '2023' },
    { heading: 'Scale & Standards', body: 'AI 최적화 경험 축적', period: '2025' },
    { heading: 'Innovation', body: '실전 성과 검증', period: '2026' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 248, height: 2, background: 'rgba(49,130,255,0.32)' }} />
      {data.slice(0, 4).map((item, i) => {
        const x = 70 + i * 220;
        const abv = i % 2 === 0;
        return (
          <div key={i} style={{ position: 'absolute', left: x - 54, top: abv ? 182 : 286, width: 190, textAlign: 'center' }}>
            <div style={{ position: 'absolute', left: 80, top: abv ? 58 : -44, width: 18, height: 18, borderRadius: '50%', background: blue, border: '4px solid #081326', boxShadow: `0 0 20px ${blue}` }} />
            <div style={{ color: mint, fontFamily: mono, fontSize: 16, fontWeight: 900 }}>{item.period || `0${i + 1}`}</div>
            <div style={{ marginTop: 22, color: '#FFFFFF', fontSize: 16, fontWeight: 900, ...textClamp(1) }}>{item.heading}</div>
            <div style={{ marginTop: 12, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35, ...textClamp(2) }}>{item.body}</div>
          </div>
        );
      })}
    </div>
  );
}

function renderKpiProject(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)';
  const title = cleanPortfolioText(slide.title || 'Project');
  const subtitle = cleanPortfolioText(slide.subtitle || '');
  const label = cleanPortfolioText(slide.sectionLabel || 'PROJECT CASE').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  const data = items.length ? items : [{ heading: 'Core Mission', body: subtitle || title }];
  const side = data.slice(1, 4);
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, width: 720, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, top: 196, color: mint, fontFamily: mono, fontSize: 16, fontWeight: 900, ...textClamp(1) }}>{subtitle || data[0]?.period || 'AI-Driven Platform'}</div>
      <div style={{ position: 'absolute', left: 58, top: 248, right: 390, height: 1, background: line }} />
      <div style={{ position: 'absolute', left: 58, top: 270, width: 520 }}>
        <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>CORE MISSION</div>
        <div style={{ marginTop: 24, color: '#FFFFFF', fontSize: 19, lineHeight: 1.55, fontWeight: 700, ...textClamp(4) }}>{data[0]?.body || data[0]?.heading || subtitle}</div>
      </div>
      <div style={{ position: 'absolute', right: 58, top: 250, width: 330, border: '1px solid rgba(49,130,255,0.28)', background: 'rgba(23,35,56,0.38)', padding: 20 }}>
        <div style={{ color: blue, fontSize: 21, fontWeight: 950 }}>{side[0]?.heading || 'Lead Developer'}</div>
        {(side.length ? side : data).slice(0, 3).map((item, i) => <div key={i} style={{ marginTop: 12, color: '#A9C7E8', fontSize: 14 }}>✓ {item.body || item.heading}</div>)}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 80, height: 1, background: line }} />
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 38, display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1.2fr', gap: 30 }}>
        {['TIMELINE', 'TECH STACK', 'STATUS', 'IMPACT'].map((h, i) => (
          <div key={h}><div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>{h}</div><div style={{ marginTop: 10, color: '#FFFFFF', fontFamily: mono, fontSize: 13, fontWeight: 900, ...textClamp(1) }}>{data[i]?.period || data[i]?.heading || ['2026.04-2026.05', 'React, Node.js', 'Production', 'Impact Verified'][i]}</div></div>
        ))}
      </div>
    </div>
  );
}

function renderKpiMetrics(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)'; const panel = 'rgba(23,35,56,0.78)';
  const title = cleanPortfolioText(slide.title || 'KPI Dashboard');
  const label = cleanPortfolioText(slide.sectionLabel || 'KPI METRICS').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Efficiency', value: '85%', body: 'Measured performance' },
    { label: 'Reliability', value: '99.9%', body: 'System stability' },
    { label: 'Impact', value: '94%', body: 'Business impact' },
  ];
  const chartTitle = cleanPortfolioText((slide.items || [])[0]?.heading || 'VALUE DELIVERY TREND').toUpperCase();
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 218, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {metricCards.map((m, i) => (
          <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 18, minHeight: 108 }}>
            <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 800 }}>{cleanPortfolioText(m.label || `KPI ${i + 1}`).toUpperCase()}</div>
            <div style={{ marginTop: 14, color: mint, fontFamily: t.fonts.heading, fontSize: kpiMetricValueFontPx(metricDisplayValue(m), 42), lineHeight: 1.12, fontWeight: 950, ...textClamp(2) }}>{metricDisplayValue(m)}</div>
            <div style={{ marginTop: 8, color: muted, fontSize: 12, lineHeight: 1.3, ...textClamp(2) }}>{cleanPortfolioText(m.body || '')}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 34, height: 150, border: `1px solid ${line}`, background: panel, padding: '16px 22px' }}>
        <div style={{ color: '#A9C7E8', fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', fontWeight: 800 }}>{chartTitle}</div>
        <div style={{ position: 'absolute', right: 22, top: 16, color: mint, fontFamily: mono, fontSize: 10, fontWeight: 800 }}>TOTAL IMPACT VERIFIED</div>
        <div style={{ position: 'absolute', left: 42, right: 26, bottom: 24, height: 82 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: i * 18, height: 1, background: 'rgba(126,147,179,0.18)' }} />)}
          {[38, 58, 72, 52].map((h, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, bottom: 0 }}>
              <div style={{ position: 'absolute', left: 64 + i * 160, bottom: 0, width: 76, height: h, background: i % 2 ? mint : blue }} />
              <div style={{ position: 'absolute', left: 64 + i * 160 + 86, bottom: 0, width: 76, height: Math.max(18, h - 24), background: 'rgba(126,147,179,0.34)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderKpiComparison(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)';
  const title = cleanPortfolioText(slide.title || 'Before vs After');
  const label = cleanPortfolioText(slide.sectionLabel || 'COMPARISON').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  const lhs = items.slice(0, 2);
  const rhs = items.slice(2, 4);
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 88, top: 204, width: 385 }}>
        <div style={{ color: muted, fontFamily: mono, fontSize: 14, fontWeight: 900 }}>BEFORE: MANUAL PROCESS</div>
        {lhs.map((item, i) => (
          <div key={i} style={{ marginTop: 34, display: 'grid', gridTemplateColumns: '44px 1fr', gap: 16 }}>
            <div style={{ width: 34, height: 34, border: `1px solid ${line}`, display: 'grid', placeItems: 'center', color: muted }}>□</div>
            <div><div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 900 }}>{item.heading}</div><div style={{ marginTop: 8, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35 }}>{item.body}</div></div>
          </div>
        ))}
        <div style={{ marginTop: 34, borderTop: `1px solid ${line}`, paddingTop: 22 }}>
          <div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>AVERAGE PROCESSING TIME</div>
          <div style={{ marginTop: 34, color: '#FFFFFF', fontSize: 28, fontWeight: 950 }}>300 MIN</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 480, top: 198, bottom: 48, width: 2, background: 'rgba(49,130,255,0.12)' }} />
      <div style={{ position: 'absolute', right: 88, top: 204, width: 385 }}>
        <div style={{ color: mint, fontFamily: mono, fontSize: 14, fontWeight: 900 }}>AFTER: AI-DRIVEN WORKFLOW</div>
        {(rhs.length ? rhs : lhs).map((item, i) => (
          <div key={i} style={{ marginTop: 34, display: 'grid', gridTemplateColumns: '44px 1fr', gap: 16 }}>
            <div style={{ width: 34, height: 34, border: `1px solid ${blue}`, display: 'grid', placeItems: 'center', color: blue }}>✓</div>
            <div><div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 900 }}>{item.heading}</div><div style={{ marginTop: 8, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35 }}>{item.body}</div></div>
          </div>
        ))}
        <div style={{ marginTop: 34, borderTop: `1px solid ${line}`, paddingTop: 22 }}>
          <div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>AVERAGE PROCESSING TIME</div>
          <div style={{ marginTop: 34, color: mint, fontSize: 28, fontWeight: 950 }}>10 MIN</div>
          <div style={{ marginTop: 16, display: 'inline-block', padding: '7px 12px', background: 'rgba(25,197,142,0.14)', color: mint, fontFamily: mono, fontSize: 11, fontWeight: 900 }}>96.7% TIME REDUCTION</div>
        </div>
      </div>
    </div>
  );
}

function renderKpiTechnical(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)'; const panel = 'rgba(23,35,56,0.78)';
  const title = cleanPortfolioText(slide.title || 'Technical Performance KPI');
  const label = cleanPortfolioText(slide.sectionLabel || 'TECHNICAL KPI').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'System Uptime', value: '99.9%', body: 'High availability' },
    { label: 'API Success', value: '99.95%', body: 'Error-free operations' },
    { label: 'Security Score', value: 'A+', body: 'Zero vulnerabilities' },
  ];
  const pts = [30, 55, 42, 70, 60, 85, 78].map((h, i) => ({ x: 42 + i * 130, y: 100 - h }));
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: muted, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 218, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {metricCards.map((m, i) => (
          <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 18, minHeight: 108 }}>
            <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 800 }}>{cleanPortfolioText(m.label || `KPI ${i + 1}`).toUpperCase()}</div>
            <div style={{ marginTop: 14, color: mint, fontFamily: t.fonts.heading, fontSize: kpiMetricValueFontPx(metricDisplayValue(m), 42), lineHeight: 1.12, fontWeight: 950, ...textClamp(2) }}>{metricDisplayValue(m)}</div>
            <div style={{ marginTop: 8, color: muted, fontSize: 12, lineHeight: 1.3, ...textClamp(2) }}>{cleanPortfolioText(m.body || '')}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 34, height: 150, border: `1px solid ${line}`, background: panel, padding: '16px 22px', overflow: 'hidden' }}>
        <div style={{ color: '#A9C7E8', fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', fontWeight: 800 }}>RESPONSE LATENCY TREND</div>
        <div style={{ position: 'absolute', right: 22, top: 16, color: mint, fontFamily: mono, fontSize: 10, fontWeight: 800 }}>PERFORMANCE OPTIMIZED</div>
        <svg style={{ position: 'absolute', left: 22, bottom: 20, width: '92%', height: 86 }} viewBox="0 0 900 110">
          {[0, 1, 2, 3, 4].map(i => <line key={i} x1="0" y1={20 + i * 22} x2="900" y2={20 + i * 22} stroke="rgba(126,147,179,0.18)" strokeWidth="1" />)}
          <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={blue} strokeWidth="2.5" />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="5" fill={mint} />)}
        </svg>
      </div>
    </div>
  );
}

function renderKpiRisk(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3'; const amber = '#F59E0B';
  const line = 'rgba(126,147,179,0.28)';
  const title = cleanPortfolioText(slide.title || 'Risk Management & Mitigation');
  const label = cleanPortfolioText(slide.sectionLabel || 'RISK MANAGEMENT').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  const data = items.length ? items : [
    { heading: 'Security Risk', body: '보안 취약점 분석 및 대응 방안', period: 'Verified' },
    { heading: 'Technical Debt', body: '기술 부채 관리 및 코드 품질 유지', period: 'Managed' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: amber, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 230, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 44 }}>
        {data.slice(0, 2).map((item, i) => (
          <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 24 }}>
            <div style={{ color: i ? mint : amber, fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', fontWeight: 900 }}>{i ? 'TECHNICAL CONSTRAINT' : 'SECURITY THREAT'}</div>
            <div style={{ marginTop: 28, color: '#FFFFFF', fontSize: 20, fontWeight: 950 }}>{item.heading}</div>
            <div style={{ marginTop: 18, color: '#A9C7E8', fontSize: 14, lineHeight: 1.55, ...textClamp(3) }}>{item.body}</div>
            <div style={{ marginTop: 22, border: `1px solid ${line}`, padding: '14px 16px', color: blue, fontFamily: mono, fontSize: 11, fontWeight: 900 }}>
              MITIGATION: {item.period || 'Verified control'}<br />RESULT: {i ? '80% Risk Reduction' : '100% Prevention'}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 78 }}>
        <div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>SYSTEM INTEGRITY INDEX</div>
        <div style={{ marginTop: 16, height: 32, background: 'rgba(126,147,179,0.18)' }}>
          <div style={{ width: '92%', height: '100%', background: `linear-gradient(90deg, ${blue}, ${mint})` }} />
        </div>
      </div>
    </div>
  );
}

function renderKpiCumulative(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)'; const panel = 'rgba(23,35,56,0.78)';
  const title = cleanPortfolioText(slide.title || 'Cumulative Impact Analysis');
  const label = cleanPortfolioText(slide.sectionLabel || 'CUMULATIVE IMPACT').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Projects', value: '03', body: '포트폴리오 주요 경험' },
    { label: 'Skills', value: '12+', body: '기술 스택' },
    { label: 'Awards', value: '02', body: '수상/인증' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 218, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {metricCards.map((m, i) => (
          <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 18, minHeight: 108 }}>
            <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 800 }}>{cleanPortfolioText(m.label || `KPI ${i + 1}`).toUpperCase()}</div>
            <div style={{ marginTop: 14, color: mint, fontFamily: t.fonts.heading, fontSize: kpiMetricValueFontPx(metricDisplayValue(m), 42), lineHeight: 1.12, fontWeight: 950, ...textClamp(2) }}>{metricDisplayValue(m)}</div>
            <div style={{ marginTop: 8, color: muted, fontSize: 12, lineHeight: 1.3, ...textClamp(2) }}>{cleanPortfolioText(m.body || '')}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 34, height: 150, border: `1px solid ${line}`, background: panel, padding: '16px 22px' }}>
        <div style={{ color: '#A9C7E8', fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', fontWeight: 800 }}>CUMULATIVE PERFORMANCE COMPARISON</div>
        <div style={{ position: 'absolute', right: 22, top: 16, color: mint, fontFamily: mono, fontSize: 10, fontWeight: 800 }}>3 PROJECTS VERIFIED</div>
        <div style={{ position: 'absolute', left: 42, right: 26, bottom: 24, height: 82 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: i * 18, height: 1, background: 'rgba(126,147,179,0.18)' }} />)}
          {[54, 68, 74].map((h, i) => (
            <div key={i} style={{ position: 'absolute', bottom: 0 }}>
              <div style={{ position: 'absolute', left: 30 + i * 270, bottom: 0, width: 58, height: h, background: blue }} />
              <div style={{ position: 'absolute', left: 100 + i * 270, bottom: 0, width: 58, height: Math.max(20, h - 20), background: mint }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderKpiRoadmap(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)'; const panel = 'rgba(23,35,56,0.78)';
  const title = cleanPortfolioText(slide.title || 'Future Growth KPI & Roadmap');
  const label = cleanPortfolioText(slide.sectionLabel || 'VISION & GROWTH').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Next Milestone', value: 'Q3', body: '다음 성장 목표' },
    { label: 'Skill Target', value: 'AI+', body: '확장할 기술 스택' },
    { label: 'Project Impact', value: '×3', body: '목표 임팩트' },
  ];
  const phases = (slide.items || []).slice(0, 3);
  const phaseData = phases.length ? phases : [
    { heading: 'Scale Architecture', body: '대규모 시스템 설계 역량 확장', period: 'PHASE 1' },
    { heading: 'AI Integration', body: 'LLM 기반 서비스 고도화', period: 'PHASE 2' },
    { heading: 'Product Leadership', body: '제품 방향성 리드 및 팀 성장', period: 'PHASE 3' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 58, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 96, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, right: 58, top: 218, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {metricCards.map((m, i) => (
          <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 18, minHeight: 108 }}>
            <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 800 }}>{cleanPortfolioText(m.label || `GOAL ${i + 1}`).toUpperCase()}</div>
            <div style={{ marginTop: 14, color: mint, fontFamily: t.fonts.heading, fontSize: kpiMetricValueFontPx(metricDisplayValue(m), 42), lineHeight: 1.12, fontWeight: 950, ...textClamp(2) }}>{metricDisplayValue(m)}</div>
            <div style={{ marginTop: 8, color: muted, fontSize: 12, lineHeight: 1.3, ...textClamp(2) }}>{cleanPortfolioText(m.body || '')}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 34, height: 150, border: `1px solid ${line}`, background: panel, padding: '18px 26px' }}>
        <div style={{ color: '#A9C7E8', fontFamily: mono, fontSize: 11, letterSpacing: '0.08em' }}>TECHNICAL GROWTH ROADMAP</div>
        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
          {phaseData.map((phase, i) => (
            <div key={i} style={{ borderLeft: `2px solid ${blue}`, paddingLeft: 18 }}>
              <div style={{ color: blue, fontFamily: mono, fontSize: 11 }}>{phase.period || `PHASE ${i + 1}`}</div>
              <div style={{ marginTop: 8, color: '#FFFFFF', fontSize: 15, fontWeight: 900 }}>{phase.heading}</div>
              <div style={{ marginTop: 8, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35, ...textClamp(2) }}>{phase.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderKpiClosing(slide, t) {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const ink = '#EAF2FF'; const { blue, mint } = kpiPaletteColors(t); const muted = '#7E93B3';
  const line = 'rgba(126,147,179,0.28)';
  const title = cleanPortfolioText(slide.title || 'Thank You for Your Time');
  const subtitle = cleanPortfolioText(slide.subtitle || '');
  const label = cleanPortfolioText(slide.sectionLabel || 'FINAL REPORT').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Total Efficiency', value: '85% UP' },
    { label: 'System Stability', value: '99.9%' },
    { label: 'AI Innovation', value: '94% ACC' },
  ];
  const bullets = slide.bullets || [];
  return (
    <div style={{ position: 'absolute', inset: 0, ...kpiGrid(t), color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 58, top: 94, color: blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ position: 'absolute', left: 58, top: 132, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      {subtitle && <div style={{ position: 'absolute', left: 58, top: 298, color: mint, fontFamily: mono, fontSize: 16, fontWeight: 900 }}>{subtitle}</div>}
      <div style={{ position: 'absolute', left: 58, right: 58, top: 374, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {metricCards.map((m, i) => (
          <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 24 }}>
            <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 800 }}>{cleanPortfolioText(m.label || `KPI ${i + 1}`).toUpperCase()}</div>
            <div style={{ marginTop: 18, color: mint, fontFamily: t.fonts.heading, fontSize: kpiMetricValueFontPx(metricDisplayValue(m), 44), lineHeight: 1, fontWeight: 950, ...textClamp(1) }}>{metricDisplayValue(m)}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 80, height: 1, background: line }} />
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 44, display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1fr', gap: 40 }}>
        {(bullets.length ? bullets : ['yushin.kim@example.com', 'github.com/yushinkim', 'portfolio link', 'Seoul, KR']).slice(0, 4).map((item, i) => (
          <div key={i}>
            <div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>{['EMAIL', 'GITHUB', 'PORTFOLIO', 'LOCATION'][i]}</div>
            <div style={{ marginTop: 10, color: blue, fontFamily: mono, fontSize: 13, fontWeight: 900, ...textClamp(1) }}>{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const KPI_REFERENCE_KIND_SEQUENCE = [
  'cover', 'dashboard', 'skills', 'timeline',
  'project', 'dashboard', 'beforeAfter', 'dashboard', 'risk',
  'project', 'dashboard', 'beforeAfter', 'dashboard', 'risk',
  'project', 'dashboard', 'beforeAfter', 'dashboard', 'risk',
  'dashboard', 'roadmap', 'closing',
];

function kpiReferenceSequenceKind(index) {
  return KPI_REFERENCE_KIND_SEQUENCE[Math.abs(Number(index) || 0) % KPI_REFERENCE_KIND_SEQUENCE.length] || 'dashboard';
}

function renderKpiReferenceSlide(slide, t, v, index) {
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = acceptedLines(slide);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const mood = acceptedSlideMood(slide, index);
  const source = cleanPortfolioText(`${slide.layout || ''} ${slide.sectionLabel || ''} ${slide.title || ''} ${slide.subtitle || ''} ${slide.proposalVariant || ''}`).toLowerCase();
  const hasAny = (...words) => words.some(word => source.includes(word));
  const title = cleanPortfolioText(slide.title || 'Performance Dashboard');
  const subtitle = cleanPortfolioText(slide.subtitle || '');
  const label = cleanPortfolioText(slide.sectionLabel || (isCover ? 'Performance Dashboard' : 'Executive Summary')).toUpperCase();
  const data = lines.length ? lines : [
    { heading: 'Efficiency', body: subtitle || title, period: '85%' },
    { heading: 'Reliability', body: 'System stability and operational quality', period: '99.9%' },
    { heading: 'Impact', body: 'Business impact and technical execution', period: '94%' },
  ];
  let kind = kpiReferenceSequenceKind(index);
  if (isCover) kind = 'cover';
  else if (slide.layout === 'closing' || slide.proposalVariant === 'closing' || mood === 'closing' || hasAny('thank', 'final')) kind = 'closing';
  else if (hasAny('before', 'after', 'workflow', 'transformation', 'manual', 'traditional')) kind = 'beforeAfter';
  else if (hasAny('risk', 'audit', 'mitigation', 'security', 'integrity', 'vulnerability', 'bias', 'debt')) kind = 'risk';
  else if (hasAny('timeline', 'growth analytics', 'milestone')) kind = 'timeline';
  else if (hasAny('skill', 'competency', 'architecture', 'stack')) kind = 'skills';
  else if (hasAny('project case', 'case ', 'core mission', 'platform') || slide.layout === 'experience') kind = 'project';
  else if (hasAny('roadmap', 'future', 'vision', 'growth')) kind = 'roadmap';
  else if (metrics.length || mood === 'metric' || hasAny('kpi', 'dashboard', 'performance', 'impact', 'overview', 'summary')) kind = kpiReferenceSequenceKind(index) === 'closing' ? 'dashboard' : kpiReferenceSequenceKind(index);

  const ink = '#EAF2FF';
  const muted = '#7E93B3';
  const { blue, mint } = kpiPaletteColors(t);
  const amber = '#F59E0B';
  const panel = 'rgba(23,35,56,0.78)';
  const line = 'rgba(126,147,179,0.28)';
  const gridBg = '#0E1727';
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const blueRgb = hexToRgb(blue);
  const gridLineColor = `rgba(${blueRgb.red},${blueRgb.green},${blueRgb.blue},0.055)`;
  const grid = {
    backgroundColor: gridBg,
    backgroundImage: `linear-gradient(${gridLineColor} 1px, transparent 1px), linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)`,
    backgroundSize: '40px 40px',
  };
  const shell = children => (
    <div style={{ position: 'absolute', inset: 0, ...grid, color: ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      {children}
    </div>
  );
  const header = (y = 58, w = 760) => (
    <div style={{ position: 'absolute', left: 58, top: y, width: w }}>
      <div style={{ color: kind === 'risk' ? amber : blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.34em', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 38, fontFamily: t.fonts.heading, fontSize: dynamicFontPx(title, 42, { min: 32, max: 48 }), lineHeight: 1.05, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
    </div>
  );
  const divider = (x, y, w) => <div style={{ position: 'absolute', left: x, top: y, width: w, height: 1, background: line }} />;
  const metricText = (metric, fallback) => cleanPortfolioText(metric ? acceptedMetricText(metric) : fallback);
  const metricCards = (metrics.length ? metrics : data.map((line, i) => ({
    label: line.heading || ['Efficiency', 'Reliability', 'Impact'][i],
    value: line.period || ['85%', '99.9%', '94%'][i],
  }))).slice(0, 3);

  const metricRow = (top = 218) => (
    <div style={{ position: 'absolute', left: 58, right: 58, top, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
      {metricCards.map((m, i) => (
        <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 18, minHeight: 108 }}>
          <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.12em', fontWeight: 800 }}>{cleanPortfolioText(m.label || data[i]?.heading || `KPI ${i + 1}`).toUpperCase()}</div>
          <div style={{ marginTop: 14, color: mint, fontFamily: t.fonts.heading, fontSize: kpiMetricValueFontPx(metricText(m, ['85%', '99.9%', '94%'][i]), 42), lineHeight: 1.12, fontWeight: 950, ...textClamp(2) }}>{metricText(m, ['85%', '99.9%', '94%'][i])}</div>
          <div style={{ marginTop: 8, color: muted, fontSize: 12, lineHeight: 1.3, ...textClamp(2) }}>{data[i]?.body || subtitle || 'Measured portfolio performance signal'}</div>
        </div>
      ))}
    </div>
  );

  const chartPanel = (titleText = 'PERFORMANCE TREND', note = 'TOTAL IMPACT VERIFIED') => (
    <div style={{ position: 'absolute', left: 58, right: 58, bottom: 34, height: 150, border: `1px solid ${line}`, background: panel, padding: '16px 22px' }}>
      <div style={{ color: '#A9C7E8', fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', fontWeight: 800 }}>{titleText}</div>
      <div style={{ position: 'absolute', right: 22, top: 16, color: mint, fontFamily: mono, fontSize: 10, fontWeight: 800 }}>{note}</div>
      <div style={{ position: 'absolute', left: 42, right: 26, bottom: 24, height: 82 }}>
        {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: i * 18, height: 1, background: 'rgba(126,147,179,0.18)' }} />)}
        {[38, 58, 72, 52].map((h, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, bottom: 0 }}>
            <div style={{ position: 'absolute', left: 64 + i * 160, bottom: 0, width: 76, height: h, background: i % 2 ? mint : blue }} />
            <div style={{ position: 'absolute', left: 64 + i * 160 + 86, bottom: 0, width: 76, height: Math.max(18, h - 24), background: 'rgba(126,147,179,0.34)' }} />
          </div>
        ))}
      </div>
    </div>
  );

  if (kind === 'cover') {
    const facts = [
      ['VERSION', (slide.bullets || [])[0] || '3.0.0-PRO'],
      ['CORE COMPETENCY', (slide.bullets || [])[1] || 'AI Architecture & Full-Stack'],
      ['FOCUS AREA', (slide.bullets || [])[2] || subtitle || 'Growth Metrics'],
      ['STATUS', (slide.bullets || [])[3] || 'Ready for Impact'],
    ];
    return shell(<>
      <div style={{ position: 'absolute', left: 58, top: 20, color: blue, fontFamily: mono, fontSize: 13, letterSpacing: '0.34em', fontWeight: 800 }}>PERFORMANCE DASHBOARD</div>
      <div style={{ position: 'absolute', left: 58, top: 50, width: 10, height: 10, borderRadius: '50%', background: mint, boxShadow: `0 0 16px ${mint}` }} />
      <div style={{ position: 'absolute', left: 78, top: 46, color: muted, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>SYSTEM ONLINE</div>
      <div style={{ position: 'absolute', left: 410, top: 46, color: muted, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>DATA SYNCED</div>
      <div style={{ position: 'absolute', right: 58, top: 46, color: muted, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>SECURE ACCESS</div>
      <div style={{ position: 'absolute', left: 58, top: 70, width: 710, fontFamily: t.fonts.heading, fontSize: 62, lineHeight: 1.03, fontWeight: 950, color: ink, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 58, top: 282, color: mint, fontFamily: mono, fontSize: 20, fontWeight: 900, ...textClamp(1) }}>{subtitle || '2021-2026 Growth Metrics & Strategic Impact'}</div>
      {divider(58, 448, 844)}
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 44, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }}>
        {facts.map(([h, b]) => <div key={h}><div style={{ color: muted, fontFamily: mono, fontSize: 9, letterSpacing: '0.08em' }}>{h}</div><div style={{ marginTop: 8, color: '#FFFFFF', fontFamily: mono, fontSize: 14, fontWeight: 900, ...textClamp(1) }}>{b}</div></div>)}
      </div>
    </>);
  }

  if (kind === 'timeline') {
    return shell(<>
      {header(58, 780)}
      <div style={{ position: 'absolute', left: 58, right: 58, top: 248, height: 2, background: 'rgba(49,130,255,0.32)' }} />
      {data.slice(0, 4).map((lineItem, i) => {
        const x = 70 + i * 220;
        const top = i % 2 === 0;
        return <div key={i} style={{ position: 'absolute', left: x - 54, top: top ? 182 : 286, width: 190, textAlign: 'center' }}>
          <div style={{ position: 'absolute', left: 80, top: top ? 58 : -44, width: 18, height: 18, borderRadius: '50%', background: blue, border: '4px solid #081326', boxShadow: `0 0 20px ${blue}` }} />
          <div style={{ color: mint, fontFamily: mono, fontSize: 16, fontWeight: 900 }}>{lineItem.period || ['2021', '2023', '2025', '2026'][i]}</div>
          <div style={{ marginTop: 22, color: '#FFFFFF', fontSize: 16, fontWeight: 900, ...textClamp(1) }}>{lineItem.heading}</div>
          <div style={{ marginTop: 12, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35, ...textClamp(2) }}>{lineItem.body}</div>
        </div>;
      })}
    </>);
  }

  if (kind === 'skills') {
    return shell(<>
      {header(58, 780)}
      <div style={{ position: 'absolute', left: 58, right: 58, top: 222, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 38 }}>
        {data.slice(0, 4).map((lineItem, i) => <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 18, minHeight: 104 }}>
          <div style={{ color: i % 2 ? mint : blue, fontFamily: mono, fontSize: 12, letterSpacing: '0.08em', fontWeight: 800 }}>{(lineItem.period || lineItem.role || `COMPETENCY ${i + 1}`).toUpperCase()}</div>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            {[lineItem.heading, ...(lineItem.bullets || []), lineItem.body].filter(Boolean).slice(0, 2).map((item, j) => (
              <div key={j}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FFFFFF', fontSize: 13 }}><span>{item}</span><span>{95 - i * 3 - j * 5}%</span></div>
                <div style={{ marginTop: 6, height: 3, background: 'rgba(126,147,179,0.18)' }}><div style={{ width: `${95 - i * 3 - j * 5}%`, height: '100%', background: i % 2 ? mint : blue }} /></div>
              </div>
            ))}
          </div>
        </div>)}
      </div>
    </>);
  }

  if (kind === 'project') {
    const side = data.slice(1, 4);
    return shell(<>
      {header(58, 720)}
      <div style={{ position: 'absolute', left: 58, top: 196, color: mint, fontFamily: mono, fontSize: 16, fontWeight: 900, ...textClamp(1) }}>{subtitle || data[0]?.period || 'AI-Driven Platform'}</div>
      {divider(58, 248, 520)}
      <div style={{ position: 'absolute', left: 58, top: 270, width: 520 }}>
        <div style={{ color: blue, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em' }}>CORE MISSION</div>
        <div style={{ marginTop: 24, color: '#FFFFFF', fontSize: 19, lineHeight: 1.55, fontWeight: 700, ...textClamp(4) }}>{data[0]?.body || data[0]?.heading || subtitle}</div>
      </div>
      <div style={{ position: 'absolute', right: 58, top: 250, width: 330, border: `1px solid rgba(49,130,255,0.28)`, background: 'rgba(23,35,56,0.38)', padding: 20 }}>
        <div style={{ color: blue, fontSize: 21, fontWeight: 950 }}>{side[0]?.heading || 'Lead Developer'}</div>
        {(side.length ? side : data).slice(0, 3).map((lineItem, i) => <div key={i} style={{ marginTop: 12, color: '#A9C7E8', fontSize: 14 }}>✓ {lineItem.body || lineItem.heading}</div>)}
      </div>
      {divider(58, 462, 844)}
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 38, display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1.2fr', gap: 30 }}>
        {['TIMELINE', 'TECH STACK', 'STATUS', 'IMPACT'].map((h, i) => <div key={h}><div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>{h}</div><div style={{ marginTop: 10, color: '#FFFFFF', fontFamily: mono, fontSize: 13, fontWeight: 900, ...textClamp(1) }}>{data[i]?.period || data[i]?.heading || ['2026.04 - 2026.05', 'React, Node.js, Firebase', 'Production Ready', 'Impact Verified'][i]}</div></div>)}
      </div>
    </>);
  }

  if (kind === 'beforeAfter') {
    const left = data.slice(0, 2);
    const right = data.slice(2, 4);
    return shell(<>
      {header(58, 820)}
      <div style={{ position: 'absolute', left: 88, top: 205, bottom: 48, width: 1, background: 'transparent' }} />
      <div style={{ position: 'absolute', left: 88, top: 204, width: 385 }}>
        <div style={{ color: muted, fontFamily: mono, fontSize: 14, fontWeight: 900 }}>BEFORE: MANUAL PROCESS</div>
        {left.map((lineItem, i) => <div key={i} style={{ marginTop: 34, display: 'grid', gridTemplateColumns: '44px 1fr', gap: 16 }}><div style={{ width: 34, height: 34, border: `1px solid ${line}`, display: 'grid', placeItems: 'center', color: muted }}>□</div><div><div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 900 }}>{lineItem.heading}</div><div style={{ marginTop: 8, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35 }}>{lineItem.body}</div></div></div>)}
        <div style={{ marginTop: 34, borderTop: `1px solid ${line}`, paddingTop: 22 }}><div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>AVERAGE PROCESSING TIME</div><div style={{ marginTop: 34, color: '#FFFFFF', fontSize: 28, fontWeight: 950 }}>300 MIN</div></div>
      </div>
      <div style={{ position: 'absolute', left: 480, top: 198, bottom: 48, width: 2, background: 'rgba(49,130,255,0.12)' }} />
      <div style={{ position: 'absolute', right: 88, top: 204, width: 385 }}>
        <div style={{ color: mint, fontFamily: mono, fontSize: 14, fontWeight: 900 }}>AFTER: AI-DRIVEN WORKFLOW</div>
        {(right.length ? right : data.slice(0, 2)).map((lineItem, i) => <div key={i} style={{ marginTop: 34, display: 'grid', gridTemplateColumns: '44px 1fr', gap: 16 }}><div style={{ width: 34, height: 34, border: `1px solid ${blue}`, display: 'grid', placeItems: 'center', color: blue }}>✓</div><div><div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 900 }}>{lineItem.heading}</div><div style={{ marginTop: 8, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35 }}>{lineItem.body}</div></div></div>)}
        <div style={{ marginTop: 34, borderTop: `1px solid ${line}`, paddingTop: 22 }}><div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>AVERAGE PROCESSING TIME</div><div style={{ marginTop: 34, color: mint, fontSize: 28, fontWeight: 950 }}>10 MIN</div><div style={{ marginTop: 34, display: 'inline-block', padding: '7px 12px', background: 'rgba(25,197,142,0.14)', color: mint, fontFamily: mono, fontSize: 11, fontWeight: 900 }}>96.7% TIME REDUCTION</div></div>
      </div>
    </>);
  }

  if (kind === 'risk') {
    return shell(<>
      {header(58, 800)}
      <div style={{ position: 'absolute', left: 58, right: 58, top: 230, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 44 }}>
        {data.slice(0, 2).map((lineItem, i) => <div key={i} style={{ borderTop: `1px solid ${line}`, paddingTop: 24 }}>
          <div style={{ color: i ? mint : amber, fontFamily: mono, fontSize: 11, letterSpacing: '0.08em', fontWeight: 900 }}>{i ? 'TECHNICAL CONSTRAINT' : 'SECURITY THREAT'}</div>
          <div style={{ marginTop: 28, color: '#FFFFFF', fontSize: 20, fontWeight: 950 }}>{lineItem.heading}</div>
          <div style={{ marginTop: 18, color: '#A9C7E8', fontSize: 14, lineHeight: 1.55, ...textClamp(3) }}>{lineItem.body}</div>
          <div style={{ marginTop: 22, border: `1px solid ${line}`, padding: '14px 16px', color: blue, fontFamily: mono, fontSize: 11, fontWeight: 900 }}>MITIGATION: {lineItem.period || 'Verified control'}<br />RESULT: {i ? '80% Risk Reduction' : '100% Prevention'}</div>
        </div>)}
      </div>
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 78 }}>
        <div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>SYSTEM INTEGRITY INDEX</div>
        <div style={{ marginTop: 16, height: 32, background: 'rgba(126,147,179,0.18)' }}><div style={{ width: '92%', height: '100%', background: `linear-gradient(90deg, ${blue}, ${mint})` }} /></div>
      </div>
    </>);
  }

  if (kind === 'roadmap') {
    return shell(<>
      {header(58, 800)}
      {metricRow(218)}
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 50, height: 140, border: `1px solid ${line}`, background: panel, padding: '22px 26px' }}>
        <div style={{ color: '#A9C7E8', fontFamily: mono, fontSize: 11, letterSpacing: '0.08em' }}>TECHNICAL GROWTH ROADMAP</div>
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
          {data.slice(0, 3).map((lineItem, i) => <div key={i} style={{ borderLeft: `2px solid ${blue}`, paddingLeft: 18 }}><div style={{ color: blue, fontFamily: mono, fontSize: 11 }}>{lineItem.period || `PHASE ${i + 1}`}</div><div style={{ marginTop: 8, color: '#FFFFFF', fontSize: 15, fontWeight: 900 }}>{lineItem.heading}</div><div style={{ marginTop: 8, color: '#A9C7E8', fontSize: 12, lineHeight: 1.35, ...textClamp(2) }}>{lineItem.body}</div></div>)}
        </div>
      </div>
    </>);
  }

  if (kind === 'closing') {
    return shell(<>
      {header(94, 820)}
      <div style={{ position: 'absolute', left: 58, top: 298, color: mint, fontFamily: mono, fontSize: 16, fontWeight: 900 }}>{subtitle || 'Full-Stack Engineer & System Architect'}</div>
      {metricRow(374)}
      {divider(58, 486, 844)}
      <div style={{ position: 'absolute', left: 58, right: 58, bottom: 44, display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1fr', gap: 40 }}>
        {(slide.bullets?.length ? slide.bullets : ['yushin.kim@example.com', 'github.com/yushinkim', 'portfolio link', 'Seoul, South Korea']).slice(0, 4).map((item, i) => <div key={i}><div style={{ color: muted, fontFamily: mono, fontSize: 10 }}>{['EMAIL', 'GITHUB', 'PORTFOLIO', 'LOCATION'][i]}</div><div style={{ marginTop: 10, color: blue, fontFamily: mono, fontSize: 13, fontWeight: 900, ...textClamp(1) }}>{item}</div></div>)}
      </div>
    </>);
  }

  return shell(<>
    {header(58, 800)}
    {metricRow(218)}
    {chartPanel(hasAny('recruitment') ? 'RECRUITMENT FUNNEL EFFICIENCY' : 'VALUE DELIVERY TREND', 'TOTAL IMPACT VERIFIED')}
  </>);
}

function renderKpiSlide(slide, t, v, index) {
  const l = slide.layout;
  if (l === 'kpi-cover') return renderKpiCover(slide, t);
  if (l === 'kpi-executive') return renderKpiExecutive(slide, t);
  if (l === 'kpi-skills') return renderKpiSkills(slide, t);
  if (l === 'kpi-timeline') return renderKpiTimeline(slide, t);
  if (l === 'kpi-project') return renderKpiProject(slide, t);
  if (l === 'kpi-metrics') return renderKpiMetrics(slide, t);
  if (l === 'kpi-comparison') return renderKpiComparison(slide, t);
  if (l === 'kpi-technical') return renderKpiTechnical(slide, t);
  if (l === 'kpi-risk') return renderKpiRisk(slide, t);
  if (l === 'kpi-cumulative') return renderKpiCumulative(slide, t);
  if (l === 'kpi-roadmap') return renderKpiRoadmap(slide, t);
  if (l === 'kpi-closing') return renderKpiClosing(slide, t);
  return renderKpiReferenceSlide(slide, t, v, index);
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const metrics = (slide.metrics || acceptedLines(slide).flatMap(line => line.metrics || [])).slice(0, 4);
  const lines = acceptedLines(slide);
  const mood = acceptedSlideMood(slide, index);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return renderVariedAcceptedSlide(slide, t, v, index, 'KPI DASHBOARD');
  if (!isCover && (mood === 'toc' || mood === 'process')) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 44, top: 38, right: 44, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 900 }}>{mood === 'toc' ? 'DASHBOARD INDEX' : 'KPI BREAKDOWN'}</div>
          <div style={{ color: v.muted, fontSize: 12 }}>#{String(index + 1).padStart(2, '0')}</div>
        </div>
        <div style={{ position: 'absolute', left: 44, top: 82, width: 380, fontSize: 34, lineHeight: 1.1, fontWeight: 950, letterSpacing: '-0.04em', ...textClamp(3) }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 470, right: 44, top: 92, bottom: 48, display: 'grid', gridTemplateRows: `repeat(${Math.min(5, Math.max(1, lines.length))}, 1fr)`, gap: 8 }}>
          {lines.slice(0, 5).map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px', gap: 14, alignItems: 'center', borderRadius: 16, background: i === 0 ? v.accent : v.card, color: i === 0 ? '#06121F' : v.ink, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.68 }}>{line.period || `KPI ${i + 1}`}</div>
              <div><div style={{ fontSize: 15, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div><div style={{ marginTop: 4, fontSize: 11, opacity: 0.7, ...textClamp(1) }}>{line.body}</div></div>
              <div style={{ height: 7, borderRadius: 999, background: i === 0 ? 'rgba(6,18,31,0.2)' : '#22324A' }}><div style={{ width: `${45 + i * 11}%`, height: '100%', borderRadius: 999, background: i === 0 ? '#06121F' : v.accent }} /></div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 44, bottom: 54, width: 340, height: 160, borderRadius: 28, background: v.card, padding: 24 }}>
          <div style={{ fontSize: 12, color: v.muted, fontWeight: 900 }}>READING GUIDE</div>
          <div style={{ marginTop: 18, color: v.accent, fontSize: 42, lineHeight: 1, fontWeight: 950 }}>{metrics[0] ? acceptedMetricText(metrics[0]) : 'Impact'}</div>
          <div style={{ marginTop: 10, fontSize: 13, color: v.muted, ...textClamp(2) }}>{metrics[0]?.label || '숫자와 실행 근거를 함께 읽도록 구성했습니다.'}</div>
        </div>
      </div>
    );
  }
  if (!isCover && mood === 'evidence') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 46, fontSize: 12, color: v.accent, letterSpacing: '0.22em', fontWeight: 900 }}>{slide.sectionLabel || 'INSIGHT'}</div>
        <div style={{ position: 'absolute', left: 54, top: 92, width: 560, fontSize: 42, lineHeight: 1.08, fontWeight: 950, ...textClamp(3) }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 54, bottom: 54, right: 54, display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, lines.length))}, 1fr)`, gap: 14 }}>
          {lines.slice(0, 3).map((line, i) => <div key={i} style={{ minHeight: 150, borderRadius: 24, background: i === 1 ? v.accent : v.card, color: i === 1 ? '#06121F' : '#FFFFFF', padding: 22 }}><div style={{ fontSize: 13, fontWeight: 950 }}>{line.heading}</div><div style={{ marginTop: 34, fontSize: 12.5, lineHeight: 1.48, opacity: 0.74, ...textClamp(4) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }
  if (!isCover) return renderVariedAcceptedSlide(slide, t, v, index, 'KPI DASHBOARD');
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 46, top: 34, right: 46, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: v.accent, fontWeight: 900, letterSpacing: '0.2em' }}>KPI DASHBOARD</div>
        <div style={{ fontSize: 12, color: v.muted }}>Slide {String(index + 1).padStart(2, '0')}</div>
      </div>
      <div style={{ position: 'absolute', left: 46, top: 78, width: isCover ? 650 : 520 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: isCover ? 54 : 34, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.04em', ...textClamp(isCover ? 3 : 2) }}>{slide.title}</div>
        {slide.subtitle ? <div style={{ marginTop: 12, color: v.muted, fontSize: 14, lineHeight: 1.45, ...textClamp(2) }}>{slide.subtitle}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 46, right: 46, bottom: 42, display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gridTemplateRows: '130px 130px', gap: 14 }}>
        <div style={{ gridRow: 'span 2', borderRadius: 28, background: `linear-gradient(150deg, ${v.card}, ${v.dark})`, padding: 26, overflow: 'hidden' }}>
          <div style={{ fontSize: 12, color: v.muted, fontWeight: 900 }}>PRIMARY METRIC</div>
          <div style={{ marginTop: 24, fontSize: 56, lineHeight: 1, fontWeight: 950, color: v.accent, ...textClamp(1) }}>{acceptedMetricText(metrics[0])}</div>
          <div style={{ marginTop: 12, fontSize: 18, fontWeight: 900, ...textClamp(2) }}>{metrics[0]?.label || lines[0]?.heading || '핵심 성과'}</div>
          <div style={{ position: 'absolute', left: 74, bottom: 78, width: 250, height: 100, borderBottom: `2px solid ${v.muted}` }}>
            {[0, 1, 2, 3].map(i => <span key={i} style={{ position: 'absolute', left: i * 58, bottom: 0, width: 30, height: 28 + i * 18, borderRadius: '8px 8px 0 0', background: i === 3 ? v.accent : '#28435F' }} />)}
          </div>
        </div>
        {[1, 2, 3].map((n, i) => <div key={n} style={{ borderRadius: 24, background: v.card, padding: 22, overflow: 'hidden' }}><div style={{ fontSize: 32, color: v.accent, fontWeight: 950, ...textClamp(1) }}>{acceptedMetricText(metrics[n])}</div><div style={{ marginTop: 8, color: v.ink, fontSize: 14, fontWeight: 900, ...textClamp(2) }}>{metrics[n]?.label || lines[i]?.heading || '보조 지표'}</div><div style={{ marginTop: 12, height: 7, borderRadius: 999, background: '#22324A' }}><div style={{ width: `${55 + i * 14}%`, height: '100%', borderRadius: 999, background: v.accent }} /></div></div>)}
        <div style={{ borderRadius: 24, background: v.accent, color: '#03101C', padding: 22, overflow: 'hidden' }}><div style={{ fontSize: 15, fontWeight: 950 }}>Insight</div><div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.45, fontWeight: 700, ...textClamp(4) }}>{lines[0]?.body || '성과를 만든 실행 근거를 함께 제시합니다.'}</div></div>
      </div>
    </div>
  );
}

function renderTimelineReferenceSlide(slide, t, v, index) {
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = acceptedLines(slide);
  const mood = acceptedSlideMood(slide, index);
  const source = cleanPortfolioText(`${slide.sectionLabel || ''} ${slide.title || ''} ${slide.subtitle || ''} ${slide.proposalVariant || ''}`).toLowerCase();
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const entries = (slide.items?.length ? slide.items : lines).filter(Boolean);
  const hasAny = (...words) => words.some(word => source.includes(word));
  const TL_KIND = { 'timeline-cover': 'cover', 'timeline-philosophy': 'philosophy', 'timeline-profile': 'profile', 'timeline-master': 'timeline', 'timeline-stack': 'stack', 'timeline-project': 'project', 'timeline-architecture': 'detail', 'timeline-challenge': 'detail', 'timeline-detail': 'detail', 'timeline-outcomes': 'metrics', 'timeline-awards': 'awards', 'timeline-growth': 'detail', 'timeline-roadmap': 'roadmap', 'timeline-closing': 'closing' };
  let kind = TL_KIND[slide.layout];
  if (!kind) {
    kind = index % 4 === 0 ? 'detail' : index % 4 === 1 ? 'stack' : index % 4 === 2 ? 'project' : 'metrics';
    if (isCover) kind = 'cover';
    else if (mood === 'closing' || slide.layout === 'closing' || slide.proposalVariant === 'closing') kind = 'closing';
    else if (slide.proposalVariant === 'contents' || mood === 'toc') kind = 'philosophy';
    else if (hasAny('profile', 'key metrics', 'education', 'language', 'focus')) kind = 'profile';
    else if (slide.proposalVariant === 'timeline' || hasAny('timeline', 'milestone', 'growth curve')) kind = 'timeline';
    else if (hasAny('roadmap', 'vision', 'next', 'phase') || slide.proposalVariant === 'gantt' || slide.proposalVariant === 'stageCards') kind = 'roadmap';
    else if (hasAny('award', 'honor', 'recognition')) kind = 'awards';
    else if (hasAny('stack', 'skill', 'frontend', 'backend', 'technical')) kind = 'stack';
    else if (hasAny('architecture', 'challenge', 'security', 'learning', 'principle', 'integration', 'optimization')) kind = 'detail';
    else if (hasAny('project') || slide.layout === 'experience') kind = 'project';
    else if (metrics.length || mood === 'metric' || hasAny('outcome', 'result', 'metric', 'achievement', 'proof')) kind = 'metrics';
  }
  const label = (slide.sectionLabel || (kind === 'cover' ? '2021 - 2026 Growth Archive' : 'Growth Timeline')).toUpperCase();
  const title = slide.title || 'Growth Timeline';
  const subtitle = slide.subtitle || '';
  const topRule = <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 6, background: v.accent }} />;
  const logo = <div style={{ position: 'absolute', left: 734, bottom: 6, width: 22, height: 22, borderRadius: '50%', border: '3px solid #1597A5', color: '#1597A5', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 950, lineHeight: 1 }}>G</div>;
  const shell = (children, bg = '#FFFFFF') => (
    <div style={{ position: 'absolute', inset: 0, background: bg, color: v.ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
      {kind !== 'cover' && kind !== 'closing' ? topRule : null}
      {children}
      {kind !== 'cover' ? logo : null}
    </div>
  );
  const header = (x = 62, y = 78, w = 800) => (
    <div style={{ position: 'absolute', left: x, top: y, width: w }}>
      <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.32em', fontWeight: 850 }}>{label}</div>
      <div style={{ marginTop: 26, fontFamily: t.fonts.heading, fontSize: dynamicFontPx(title, 38, { min: 30, max: 42 }), lineHeight: 1.08, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 14, color: v.muted, fontSize: 15, lineHeight: 1.45, fontWeight: 600, ...textClamp(2) }}>{subtitle}</div> : null}
    </div>
  );
  const data = entries.length ? entries : [{ heading: 'Experience', body: subtitle || title }];

  if (kind === 'closing') {
    const contact = (slide.bullets || []).slice(0, 3);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 452, top: 102, width: 60, height: 4, background: v.accent }} />
        <div style={{ position: 'absolute', left: 170, right: 170, top: 176, textAlign: 'center' }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 45, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{title || 'Thank You for Your Time'}</div>
          <div style={{ marginTop: 28, color: '#B8CCE8', fontSize: 18, lineHeight: 1.55, ...textClamp(2) }}>{subtitle || '함께 성장하며 미래를 설계할 기회를 기다리겠습니다.'}</div>
        </div>
        <div style={{ position: 'absolute', left: 138, right: 138, top: 346, height: 1, background: 'rgba(184,204,232,0.22)' }} />
        <div style={{ position: 'absolute', left: 150, right: 150, top: 390, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, textAlign: 'center' }}>
          {['EMAIL', 'GITHUB', 'PORTFOLIO'].map((h, idx) => <div key={h}><div style={{ color: v.accent, letterSpacing: '0.26em', fontSize: 12, fontWeight: 950 }}>{h}</div><div style={{ marginTop: 18, color: '#FFFFFF', fontSize: 15, fontWeight: 800, ...textClamp(1) }}>{contact[idx] || ['yushin@example.com', 'github.com/yushin-dev', 'portfolio link'][idx]}</div></div>)}
        </div>
        {logo}
      </div>
    );
  }

  if (kind === 'cover') {
    const facts = [
      { h: 'CANDIDATE', b: (slide.bullets || [])[0] || cleanPortfolioText(title).split(' ')[0] || 'Candidate' },
      { h: 'ROLE', b: subtitle || 'Full-Stack Developer' },
      { h: 'EDUCATION', b: (slide.bullets || [])[1] || 'Portfolio' },
    ];
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 9, top: 0, width: 7, height: 540, background: v.accent }} />
        <div style={{ position: 'absolute', right: -20, bottom: -10, width: 300, height: 300, background: '#F5F8FC', transform: 'skewX(-12deg)' }} />
        <div style={{ position: 'absolute', left: 78, top: 62, color: v.accent, fontSize: 14, letterSpacing: '0.32em', fontWeight: 850 }}>2021 - 2026 GROWTH ARCHIVE</div>
        <div style={{ position: 'absolute', left: 78, top: 136, width: 620, fontFamily: t.fonts.heading, fontSize: 54, lineHeight: 1.08, fontWeight: 950, ...textClamp(3) }}>{title}</div>
        <div style={{ position: 'absolute', left: 78, top: 294, width: 620, color: v.muted, fontSize: 19, lineHeight: 1.42, ...textClamp(2) }}>{subtitle || '미래를 설계하는 개발자의 성장 타임라인'}</div>
        <div style={{ position: 'absolute', left: 78, bottom: 62, display: 'grid', gridTemplateColumns: 'repeat(3, 170px)', gap: 34 }}>
          {facts.map(f => <div key={f.h} style={{ borderTop: `1px solid ${v.soft}`, paddingTop: 22 }}><div style={{ color: v.muted, fontSize: 9, letterSpacing: '0.18em', fontWeight: 850 }}>{f.h}</div><div style={{ marginTop: 14, fontSize: 14, fontWeight: 900, ...textClamp(1) }}>{f.b}</div></div>)}
        </div>
        {logo}
      </div>
    );
  }

  if (kind === 'profile') {
    const metricCards = (metrics.length ? metrics : [
      { label: 'Production Projects', value: '5+' },
      { label: 'TOEIC Score', value: '900' },
      { label: 'Documentation Rate', value: '100%' },
    ]).slice(0, 3);
    const profileItems = data.slice(0, 3);
    return shell(<>
      <div style={{ position: 'absolute', left: 60, top: 78, bottom: 70, width: 404, borderRight: `1px solid ${v.soft}` }}>
        <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.32em', fontWeight: 850 }}>PROFILE</div>
        <div style={{ marginTop: 16, fontFamily: t.fonts.heading, fontSize: 34, lineHeight: 1.08, fontWeight: 950, color: v.ink, ...textClamp(1) }}>{title}</div>
        {profileItems.map((item, idx) => (
          <div key={idx} style={{ marginTop: idx === 0 ? 18 : 16 }}>
            <div style={{ color: v.muted, fontSize: 9, letterSpacing: '0.16em', fontWeight: 850 }}>{(item.period || item.role || ['EDUCATION', 'LANGUAGE', 'FOCUS'][idx]).toUpperCase()}</div>
            <div style={{ marginTop: 10, color: v.ink, fontSize: 17, fontWeight: 900, ...textClamp(1) }}>{item.heading}</div>
            <div style={{ marginTop: 10, color: v.muted, fontSize: 12.5, lineHeight: 1.45, ...textClamp(2) }}>{item.body}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 508, top: 78, right: 62, bottom: 70 }}>
        <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.32em', fontWeight: 850 }}>KEY METRICS</div>
        {metricCards.map((metric, idx) => (
          <div key={idx} style={{ marginTop: idx === 0 ? 46 : 42 }}>
            <div style={{ color: v.accent, fontSize: 38, lineHeight: 1, fontWeight: 950 }}>{acceptedMetricText(metric)}</div>
            <div style={{ marginTop: 18, color: v.ink, fontSize: 14.5, fontWeight: 900 }}>{metric.label}</div>
            <div style={{ marginTop: 12, color: v.muted, fontSize: 11.5, lineHeight: 1.45, ...textClamp(2) }}>{metric.body || data[idx]?.body || subtitle}</div>
          </div>
        ))}
      </div>
    </>);
  }

  if (kind === 'philosophy') {
    return shell(<>
      {header(78, 94, 680)}
      <div style={{ position: 'absolute', left: 78, right: 78, top: 264, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
        {data.slice(0, 3).map((line, idx) => <div key={idx} style={{ borderTop: `1px solid ${v.soft}`, paddingTop: 16 }}><div style={{ color: v.accent, fontSize: 16, fontWeight: 950 }}>{['EXPERIENCE', 'MEMORY', 'VALUE'][idx] || line.heading}</div><div style={{ marginTop: 18, fontSize: 14, lineHeight: 1.6, color: v.ink, ...textClamp(4) }}>{line.body || line.heading}</div></div>)}
      </div>
    </>);
  }

  if (kind === 'timeline') {
    const marks = data.slice(0, 5);
    const lineY = 318;
    const upperTop = 204;
    const lowerTop = 344;
    return shell(<>
      <div style={{ position: 'absolute', left: 62, top: 82, color: v.accent, fontSize: 12, letterSpacing: '0.32em', fontWeight: 850 }}>MASTER TIMELINE</div>
      <div style={{ position: 'absolute', left: 62, top: 120, width: 520, fontFamily: t.fonts.heading, fontSize: 32, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{title}</div>
      <div style={{ position: 'absolute', left: 62, right: 62, top: lineY, height: 2, background: v.soft }} />
      {marks.map((line, idx) => {
        const x = 126 + idx * 158;
        const top = idx % 2 === 0;
        const cardTop = top ? upperTop : lowerTop;
        return <div key={idx} style={{ position: 'absolute', left: x - 80, top: cardTop, width: 170, textAlign: 'center' }}>
          <div style={{ position: 'absolute', left: 80, top: lineY - cardTop - 4, width: 10, height: 10, borderRadius: '50%', background: v.accent }} />
          <div style={{ minHeight: 20, color: v.accent, fontSize: 15, lineHeight: 1.15, fontWeight: 950, ...textClamp(1) }}>{line.period || `Phase ${idx + 1}`}</div>
          <div style={{ marginTop: 12, minHeight: 34, fontSize: 13.5, lineHeight: 1.22, fontWeight: 900, ...textClamp(2) }}>{line.heading}</div>
          <div style={{ marginTop: 8, color: v.muted, fontSize: 11.5, lineHeight: 1.38, ...textClamp(3) }}>{line.body}</div>
        </div>;
      })}
    </>);
  }

  if (kind === 'metrics') {
    const metricCards = (metrics.length ? metrics : data.map((line, idx) => ({ label: line.heading, value: idx === 0 ? '80%' : idx === 1 ? '99.9%' : '4.8/5' }))).slice(0, 3);
    return shell(<>
      {header(62, 80, 780)}
      <div style={{ position: 'absolute', left: 62, right: 62, top: 190, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
        {metricCards.map((m, idx) => <div key={idx} style={{ borderTop: `1px solid ${v.soft}`, paddingTop: 46 }}><div style={{ color: v.accent, fontSize: 44, lineHeight: 1, fontWeight: 950 }}>{acceptedMetricText(m)}</div><div style={{ marginTop: 18, fontSize: 16, fontWeight: 900 }}>{m.label || data[idx]?.heading}</div><div style={{ marginTop: 10, color: v.muted, fontSize: 12.5, lineHeight: 1.45, ...textClamp(2) }}>{data[idx]?.body || subtitle}</div></div>)}
      </div>
      <div style={{ position: 'absolute', left: 62, right: 62, top: 334, height: 1, background: v.soft }} />
    </>);
  }

  if (kind === 'roadmap') {
    return shell(<>
      {header(60, 78, 780)}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 186, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26 }}>
        {data.slice(0, 3).map((line, idx) => <div key={idx} style={{ borderTop: `1px solid ${v.soft}`, paddingTop: 24 }}><div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.08em', fontWeight: 950 }}>PHASE {String(idx + 1).padStart(2, '0')}</div><div style={{ marginTop: 12, fontSize: 20, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div>{(line.bullets?.length ? line.bullets : [line.body, line.period, subtitle].filter(Boolean)).slice(0, 3).map((b, bi) => <div key={bi} style={{ marginTop: 14, color: v.ink, fontSize: 13.2, lineHeight: 1.45 }}>› {b}</div>)}</div>)}
      </div>
    </>);
  }

  if (kind === 'awards') {
    const first = data[0] || {};
    return shell(<>
      {header(62, 82, 760)}
      <div style={{ position: 'absolute', left: 62, right: 62, top: 214, height: 172, background: '#F6F8FC', borderLeft: `5px solid ${v.accent}`, padding: '28px 34px' }}>
        <div style={{ color: v.accent, fontSize: 14, fontWeight: 950 }}>{first.period || '2026.05'}</div>
        <div style={{ marginTop: 26, fontSize: 24, fontWeight: 950 }}>{first.heading || title}</div>
        <div style={{ marginTop: 16, color: v.muted, fontSize: 14, lineHeight: 1.5, ...textClamp(3) }}>{first.body || subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: 62, right: 62, top: 396, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 42 }}>
        {data.slice(1, 5).map((line, idx) => <div key={idx} style={{ borderBottom: `1px solid ${v.soft}`, paddingBottom: 8 }}><div style={{ fontSize: 15, fontWeight: 900 }}>{line.heading}</div><div style={{ color: v.muted, fontSize: 12 }}>{line.period || line.body}</div></div>)}
      </div>
    </>);
  }

  const threeCol = kind === 'stack' || kind === 'project';
  return shell(<>
    {header(62, 78, 800)}
    <div style={{ position: 'absolute', left: 62, right: 62, top: threeCol ? 198 : 188, display: 'grid', gridTemplateColumns: threeCol ? 'repeat(3, 1fr)' : '1fr 1fr', gap: threeCol ? 28 : 42 }}>
      {data.slice(0, threeCol ? 3 : 4).map((line, idx) => <div key={idx} style={{ borderTop: `1px solid ${idx === 1 && !threeCol ? v.accent : v.soft}`, paddingTop: 20, minHeight: threeCol ? 180 : 132 }}>
        <div style={{ color: idx % 2 === 0 ? v.accent : v.muted, fontSize: 13, fontWeight: 950, letterSpacing: '0.04em' }}>{threeCol ? ['CONCEPT', 'PROBLEM', 'SOLUTION'][idx] || line.role : line.role || line.period || `SECTION ${idx + 1}`}</div>
        <div style={{ marginTop: 16, fontSize: 18, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div>
        <div style={{ marginTop: 14, color: v.ink, fontSize: 13.4, lineHeight: 1.55, ...textClamp(threeCol ? 5 : 4) }}>{line.body || (line.bullets || []).join(' / ')}</div>
        {kind === 'stack' ? <div style={{ marginTop: 14, height: 3, background: '#EEF3FA' }}><div style={{ width: `${78 - idx * 8}%`, height: '100%', background: v.accent }} /></div> : null}
      </div>)}
    </div>
  </>);
}

function renderTimelineSlide(slide, t, v, index) {
  return renderTimelineReferenceSlide(slide, t, v, index);
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = acceptedLines(slide);
  const mood = acceptedSlideMood(slide, index);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return renderVariedAcceptedSlide(slide, t, v, index, 'CAREER TIMELINE');
  if (!isCover && mood === 'toc') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 58, top: 58, fontFamily: v.font, fontSize: 52, lineHeight: 1.05, fontWeight: 900, width: 360 }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 500, top: 68, bottom: 64, width: 2, background: 'rgba(255,255,255,0.2)' }} />
        {lines.slice(0, 5).map((line, i) => (
          <div key={i} style={{ position: 'absolute', left: i % 2 ? 520 : 600, top: 72 + i * 78, width: 280 }}>
            <div style={{ color: v.accent, fontSize: 18, fontWeight: 900 }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ marginTop: 2, fontSize: 18, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div>
            <div style={{ marginTop: 5, fontSize: 11.5, color: 'rgba(255,255,255,0.58)', ...textClamp(2) }}>{line.body}</div>
          </div>
        ))}
      </div>
    );
  }
  if (!isCover && mood === 'metric') {
    const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 58, top: 44, color: v.accent, fontSize: 12, letterSpacing: '0.2em', fontWeight: 900 }}>GROWTH SNAPSHOT</div>
        <div style={{ position: 'absolute', left: 58, top: 92, width: 470, fontFamily: v.font, fontSize: 38, lineHeight: 1.08, fontWeight: 900, ...textClamp(3) }}>{slide.title}</div>
        <div style={{ position: 'absolute', right: 58, top: 74, bottom: 58, width: 330, borderRadius: 36, background: v.dark, color: '#FFFFFF', padding: 34 }}>
          {(metrics.length ? metrics : [{ label: lines[0]?.heading, value: lines[0]?.body }]).slice(0, 3).map((m, i) => <div key={i} style={{ marginBottom: 28 }}><div style={{ fontSize: 42, color: i === 0 ? v.accent : '#FFFFFF', fontWeight: 300, lineHeight: 1 }}>{acceptedMetricText(m)}</div><div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.64)', fontWeight: 800 }}>{m?.label || '성장 지표'}</div></div>)}
        </div>
      </div>
    );
  }
  if (!isCover) return renderVariedAcceptedSlide(slide, t, v, index, 'CAREER TIMELINE');
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 62, top: 48, width: 270 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.18em', color: v.accent, fontWeight: 900 }}>CAREER TIMELINE</div>
        <div style={{ marginTop: 14, fontFamily: v.font, fontSize: isCover ? 48 : 34, lineHeight: 1.12, fontWeight: 900, ...textClamp(isCover ? 4 : 3) }}>{slide.title}</div>
        {slide.subtitle ? <div style={{ marginTop: 14, fontSize: 13.5, color: v.muted, lineHeight: 1.55, ...textClamp(4) }}>{slide.subtitle}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 390, top: 74, bottom: 58, width: 2, background: v.soft }} />
      <div style={{ position: 'absolute', left: 356, right: 56, top: 64, bottom: 42, display: 'grid', gridTemplateRows: `repeat(${Math.min(5, Math.max(1, lines.length))}, 1fr)`, gap: 8 }}>
        {lines.slice(0, 5).map((line, i) => (
          <div key={i} style={{ position: 'relative', paddingLeft: 70, display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: '50%', background: i === 0 ? v.accent : v.card, border: `5px solid ${v.dark}` }} />
            <div style={{ width: '100%', borderRadius: 18, background: i === 0 ? v.dark : v.card, color: i === 0 ? '#FFFFFF' : v.ink, padding: '16px 20px', boxShadow: '0 12px 32px rgba(54,42,27,0.08)' }}>
              <div style={{ fontSize: 11, color: i === 0 ? v.accent : v.muted, fontWeight: 900 }}>{line.period || `MILESTONE ${i + 1}`}</div>
              <div style={{ marginTop: 5, fontSize: 17, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div>
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4, opacity: 0.78, ...textClamp(2) }}>{line.body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', right: 50, top: 38, fontFamily: v.font, fontSize: 28, color: v.soft, fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</div>
    </div>
  );
}

function renderCaseStudySlide(slide, t, v, index) {
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = acceptedLines(slide);
  const mood = acceptedSlideMood(slide, index);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return renderVariedAcceptedSlide(slide, t, v, index, 'CASE STUDY');
  if (!isCover && mood === 'toc') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 50, top: 42, right: 50, height: 120, borderBottom: `1px solid ${v.soft}` }}>
          <div style={{ fontSize: 12, color: v.accent, letterSpacing: '0.2em', fontWeight: 900 }}>CASE FILE INDEX</div>
          <div style={{ marginTop: 14, fontSize: 40, lineHeight: 1.05, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 50, right: 50, bottom: 48, display: 'grid', gridTemplateColumns: `repeat(${Math.min(5, Math.max(1, lines.length))}, 1fr)`, gap: 10 }}>
          {lines.slice(0, 5).map((line, i) => <div key={i} style={{ height: 260, borderRadius: 8, background: i === 0 ? v.dark : v.card, color: i === 0 ? '#FFFFFF' : v.ink, border: `1px solid ${i === 0 ? v.dark : v.soft}`, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><div style={{ color: i === 0 ? v.accent : v.muted, fontSize: 12, fontWeight: 900 }}>FILE {String(i + 1).padStart(2, '0')}</div><div><div style={{ fontSize: 16, fontWeight: 900, ...textClamp(2) }}>{line.heading}</div><div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.45, opacity: 0.72, ...textClamp(5) }}>{line.body}</div></div></div>)}
        </div>
      </div>
    );
  }
  if (!isCover && mood === 'metric') {
    const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 48, color: v.accent, fontSize: 12, letterSpacing: '0.2em', fontWeight: 900 }}>CASE IMPACT</div>
        <div style={{ position: 'absolute', left: 54, top: 94, width: 520, fontSize: 42, lineHeight: 1.08, fontWeight: 950, ...textClamp(3) }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 54, bottom: 58, display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, metrics.length || 4))}, 1fr)`, gap: 12, right: 54 }}>
          {(metrics.length ? metrics : [{ label: 'Problem', value: '정의' }, { label: 'Action', value: '실행' }, { label: 'Impact', value: '성과' }, { label: 'Learning', value: '학습' }]).slice(0, 4).map((m, i) => <div key={i} style={{ borderTop: `4px solid ${i === 2 ? v.accent : 'rgba(255,255,255,0.18)'}`, paddingTop: 18 }}><div style={{ fontSize: 36, color: i === 2 ? v.accent : '#FFFFFF', fontWeight: 300 }}>{acceptedMetricText(m)}</div><div style={{ marginTop: 8, color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: 800 }}>{m?.label || '근거'}</div></div>)}
        </div>
      </div>
    );
  }
  if (!isCover && mood === 'process') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 52, top: 48, width: 350 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.2em', fontWeight: 900 }}>{slide.sectionLabel || 'BUILD LOG'}</div>
          <div style={{ marginTop: 18, fontSize: 36, lineHeight: 1.08, fontWeight: 950, ...textClamp(3) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 450, right: 58, top: 70, bottom: 56 }}>
          {lines.slice(0, 4).map((line, i) => <div key={i} style={{ position: 'absolute', left: i % 2 ? 230 : 0, top: Math.floor(i / 2) * 190, width: 220, height: 160, borderRadius: 18, background: i === 0 ? v.dark : v.card, color: i === 0 ? '#FFFFFF' : v.ink, border: `1px solid ${i === 0 ? v.dark : v.soft}`, padding: 20 }}><div style={{ color: i === 0 ? v.accent : v.muted, fontSize: 12, fontWeight: 900 }}>{['01 DISCOVER', '02 DECIDE', '03 BUILD', '04 VERIFY'][i]}</div><div style={{ marginTop: 18, fontSize: 17, fontWeight: 900, ...textClamp(2) }}>{line.heading}</div><div style={{ marginTop: 8, color: i === 0 ? 'rgba(255,255,255,0.65)' : v.muted, fontSize: 11.5, lineHeight: 1.45, ...textClamp(3) }}>{line.body}</div></div>)}
        </div>
      </div>
    );
  }
  if (!isCover) return renderVariedAcceptedSlide(slide, t, v, index, 'CASE STUDY');
  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 250, background: v.dark, color: '#FFFFFF', padding: 42 }}>
        <div style={{ fontSize: 12, color: v.accent, letterSpacing: '0.18em', fontWeight: 900 }}>CASE STUDY</div>
        <div style={{ position: 'absolute', left: 42, bottom: 42, right: 42 }}>
          <div style={{ fontSize: 54, fontWeight: 950, lineHeight: 1 }}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.5, opacity: 0.65 }}>{slide.sectionLabel || 'Problem / Process / Impact'}</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 302, right: 58, top: 52 }}>
        <div style={{ display: 'inline-flex', padding: '7px 12px', border: `1px solid ${v.soft}`, borderRadius: 999, fontSize: 11, color: v.accent, fontWeight: 900 }}>{slide.sectionLabel || 'Project Evidence'}</div>
        <div style={{ marginTop: 18, fontFamily: t.fonts.heading, fontSize: isCover ? 48 : 34, lineHeight: 1.1, fontWeight: 950, letterSpacing: '-0.03em', ...textClamp(isCover ? 3 : 2) }}>{slide.title}</div>
        {slide.subtitle ? <div style={{ marginTop: 12, color: v.muted, fontSize: 14, lineHeight: 1.5, ...textClamp(2) }}>{slide.subtitle}</div> : null}
      </div>
      {!isCover && (
        <div style={{ position: 'absolute', left: 302, right: 58, bottom: 46, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {lines.slice(0, 4).map((line, i) => (
            <div key={i} style={{ minHeight: 118, borderRadius: 14, background: v.card, border: `1px solid ${v.soft}`, padding: 18, boxShadow: '0 12px 30px rgba(20,20,20,0.04)', position: 'relative' }}>
              <div style={{ position: 'absolute', right: 16, top: 14, width: 28, height: 28, borderRadius: '50%', background: i === 2 ? v.accent : v.soft }} />
              <div style={{ fontSize: 12, color: v.accent, fontWeight: 950 }}>{['Problem', 'Decision', 'Build', 'Impact'][i] || `Step ${i + 1}`}</div>
              <div style={{ marginTop: 13, fontSize: 17, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div>
              <div style={{ marginTop: 7, color: v.muted, fontSize: 12, lineHeight: 1.5, ...textClamp(3) }}>{line.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderCaseStudyDeckSlide(slide, t, v, index) {
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const mood = acceptedSlideMood(slide, index);
  const lines = acceptedLines(slide);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const leftLines = lines.slice(0, 2);
  const rightLines = lines.slice(2, 4);
  const label = slide.sectionLabel || 'CASE STUDY';
  const metricCards = (metrics.length ? metrics : [
    { label: 'Impact', value: leftLines[0]?.heading || '성과 요약' },
    { label: 'Flow', value: rightLines[0]?.heading || '프로세스 정리' },
  ]).slice(0, 2);

  const renderGlow = () => (
    <>
      <div style={{ position: 'absolute', left: -80, top: -90, width: 240, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,30,0,0.34), rgba(120,30,0,0))' }} />
      <div style={{ position: 'absolute', right: -40, bottom: -50, width: 280, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(130,0,255,0.28), rgba(130,0,255,0))' }} />
      <div style={{ position: 'absolute', left: 250, top: 130, width: 360, height: 360, borderRadius: '50%', border: '28px solid rgba(82, 132, 255, 0.1)' }} />
      <div style={{ position: 'absolute', left: 420, top: 190, width: 260, height: 260, borderRadius: '50%', border: '28px solid rgba(255, 132, 44, 0.1)' }} />
    </>
  );

  const renderMockPanel = (title, captions, y, tall = false) => (
    <div style={{ position: 'absolute', left: 842, top: y, width: 438, height: tall ? 238 : 184, borderRadius: 20, background: 'rgba(252,252,255,0.92)', boxShadow: '0 14px 28px rgba(35,44,86,0.1)', border: `1px solid rgba(216,221,240,0.7)`, padding: '22px 20px' }}>
      <div style={{ textAlign: 'center', fontFamily: t.fonts.heading, fontSize: 19, fontWeight: 900, color: v.ink }}>{title}</div>
      <div style={{ marginTop: 10, height: 2, width: 170, background: 'rgba(216,221,240,0.92)', marginLeft: 'auto', marginRight: 'auto' }} />
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: tall ? `repeat(${Math.min(2, Math.max(1, captions.length))}, 1fr)` : `repeat(${Math.min(3, Math.max(1, captions.length))}, 1fr)`, gap: 18, alignItems: 'end' }}>
        {captions.map((caption, idx) => (
          <div key={`${title}-${idx}`} style={{ textAlign: 'center' }}>
            <div style={{ height: tall ? 108 : 126, borderRadius: tall ? 18 : 20, background: idx % 3 === 0 ? 'linear-gradient(180deg, #F9F2FF, #E5EBFF)' : idx % 3 === 1 ? 'linear-gradient(180deg, #FFF6E9, #F4F7FF)' : 'linear-gradient(180deg, #F4F7FF, #FFFFFF)', boxShadow: '0 10px 20px rgba(35,44,86,0.12)', border: '1px solid rgba(210,216,236,0.9)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 14, borderRadius: 14, background: idx % 3 === 0 ? 'linear-gradient(135deg, rgba(108,62,255,0.12), rgba(63,160,255,0.18))' : idx % 3 === 1 ? 'linear-gradient(135deg, rgba(255,162,41,0.14), rgba(255,90,90,0.16))' : 'linear-gradient(135deg, rgba(26,36,108,0.08), rgba(255,255,255,0.24))' }} />
              <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, height: 8, borderRadius: 999, background: idx % 2 ? 'rgba(40,50,122,0.18)' : 'rgba(63,160,255,0.24)' }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: v.muted, fontWeight: 700, ...textClamp(1) }}>{caption}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (mood === 'closing' || isCover) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body, overflow: 'hidden' }}>
        {renderGlow()}
        {mood !== 'closing' && <div style={{ position: 'absolute', left: 242, top: 208, width: 76, height: 28, borderRadius: 8, background: 'linear-gradient(90deg, rgba(255,255,255,0.95), rgba(201,210,224,0.8), rgba(255,255,255,0.95))', boxShadow: '0 8px 18px rgba(255,255,255,0.12)' }} />}
        <div style={{ position: 'absolute', left: 0, right: 0, top: mood === 'closing' ? 238 : 252, textAlign: 'center' }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: mood === 'closing' ? 64 : 52, lineHeight: 1.08, fontWeight: 950, letterSpacing: '-0.03em', ...textClamp(2) }}>
            {mood === 'closing' ? (slide.title || 'THANK YOU') : slide.title}
          </div>
          {mood !== 'closing' && slide.subtitle ? <div style={{ marginTop: 16, fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: 700, ...textClamp(1) }}>{slide.subtitle}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 50, top: 38, right: 50 }}>
        <div style={{ display: 'inline-block', minWidth: 104, height: 34, borderRadius: 10, background: 'linear-gradient(90deg, rgba(255,255,255,0.96), rgba(236,240,249,0.88))', boxShadow: '0 8px 20px rgba(20,28,65,0.08)' }} />
        <div style={{ marginTop: 14, color: v.ink, fontFamily: t.fonts.heading, fontSize: slide.title && slide.title.length > 26 ? 34 : 42, lineHeight: 1.06, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
      </div>
      <div style={{ position: 'absolute', left: 42, top: 158, width: 850, height: 515, borderRadius: 26, background: v.card, boxShadow: '0 18px 36px rgba(35,44,86,0.12)', border: '1px solid rgba(216,221,240,0.72)' }}>
        <div style={{ position: 'absolute', left: 68, top: 70, width: 250 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 28, fontWeight: 900, color: v.ink }}>문제정의</div>
          <div style={{ marginTop: 90, display: 'grid', gap: 28 }}>
            {leftLines.map((line, idx) => (
              <div key={`left-${idx}`} style={{ color: idx === 0 ? v.ink : v.muted }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 18, height: 18, marginTop: 6, borderRadius: 4, border: `3px solid ${idx === 0 ? v.muted : v.soft}` }} />
                  <div>
                    <div style={{ fontSize: 15, lineHeight: 1.58, fontWeight: 700, ...textClamp(3) }}>{line.body || line.heading}</div>
                    {line.heading && line.body && line.heading !== line.body ? <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: v.ink, fontWeight: 800, ...textClamp(1) }}>{line.heading}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 424, top: 99, width: 3, height: 286, background: v.soft }} />
        <div style={{ position: 'absolute', left: 506, top: 70, width: 286 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 28, fontWeight: 900, color: v.ink }}>전략 Strategies/Objectives</div>
          <div style={{ marginTop: 74, display: 'grid', gap: 20 }}>
            {rightLines.map((line, idx) => (
              <div key={`right-${idx}`} style={{ color: v.muted }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 22, lineHeight: 1, color: v.ink, fontWeight: 900 }}>›</div>
                  <div>
                    <div style={{ fontSize: 15, lineHeight: 1.55, fontWeight: 700, color: v.ink, ...textClamp(3) }}>{line.heading || line.body}</div>
                    {line.body && line.body !== line.heading ? <div style={{ marginTop: 12, paddingLeft: 14, borderLeft: `4px solid ${v.soft}`, fontSize: 13.2, lineHeight: 1.55, color: v.muted, ...textClamp(4) }}>{line.body}</div> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {mood === 'toc'
        ? renderMockPanel('MAIN PROJECTS', lines.slice(0, 3).map(line => line.heading || line.period || '프로젝트'), 206)
        : mood === 'metric'
          ? renderMockPanel('성과 화면', lines.slice(0, 2).map(line => line.heading || '성과 요약'), 206, true)
          : renderMockPanel(mood === 'process' ? '프로젝트 진행 화면' : label, lines.slice(0, 3).map(line => line.heading || '핵심 포인트'), 206, mood !== 'process')}
      {mood === 'metric'
        ? <div style={{ position: 'absolute', left: 842, top: 452, width: 438, height: 184, borderRadius: 20, background: 'rgba(252,252,255,0.92)', boxShadow: '0 14px 28px rgba(35,44,86,0.1)', border: '1px solid rgba(216,221,240,0.7)', padding: '24px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, height: '100%', alignItems: 'center' }}>
              {metricCards.map((metric, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'center', columnGap: 16 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: idx === 0 ? 'radial-gradient(circle at 32% 28%, #6EC1FF, #2B90FF)' : 'radial-gradient(circle at 38% 32%, #8F96FF, #4A4FCA)', boxShadow: '0 14px 22px rgba(63,160,255,0.24)' }} />
                  <div>
                    <div style={{ fontSize: 22, lineHeight: 1.05, color: idx === 0 ? '#2B90FF' : '#4A4FCA', fontWeight: 950, ...textClamp(1) }}>{acceptedMetricText(metric)}</div>
                    <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.35, color: v.ink, fontWeight: 800, ...textClamp(2) }}>{metric.label || (idx === 0 ? '리소스 효율' : '핵심 변화')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        : renderMockPanel(mood === 'process' ? '대시보드와 주요 기능' : '결과 Key Result', lines.slice(1, 3).map(line => line.heading || line.period || '핵심 포인트'), 452, true)}
    </div>
  );
}

function proposalTextParts(text, accent) {
  const value = String(text || '').trim();
  if (!value) return null;
  const words = value.split(' ');
  if (words.length < 2) return value;
  const last = words.pop();
  return <>{words.join(' ')} <span style={{ color: accent }}>{last}</span></>;
}

function renderCaseStudyProposalSlide(slide, t, v, index) {
  const mood = acceptedSlideMood(slide, index);
  const proposalSlide = composeAcceptedProposalSlide({
    ...slide,
    sectionLabel: slide.sectionLabel || '케이스 스터디',
    proposalVariant: mood === 'toc' ? 'contents' : slide.proposalVariant,
    dark: mood === 'metric' ? false : slide.dark,
  }, t, index);

  if (proposalSlide.layout === 'cover' || proposalSlide.layout === 'section') {
    return renderProposalCover({
      ...proposalSlide,
      bullets: (proposalSlide.bullets && proposalSlide.bullets.length ? proposalSlide.bullets : ['CASE STUDY', 'PROBLEM SOLVING', 'IMPACT']).slice(0, 3),
    }, t);
  }

  if (mood === 'closing') {
    return renderProposal({
      ...proposalSlide,
      layout: 'closing',
      dark: true,
      title: proposalSlide.title || 'THANK YOU',
    }, t, index);
  }

  return renderProposal(proposalSlide, t, index);
}

const CASE_STUDY_REFERENCE_VARIANTS = [
  'profile',
  'projects-3',
  'projects-2',
  'dark-title-1',
  'split-image',
  'result-gallery',
  'split-large-image',
  'result-dashboard',
  'dark-title-2',
  'problem-strategy',
  'result-guide',
  'problem-strategy-simple',
  'result-dashboard-metric',
  'dark-title-3',
  'problem-strategy-service',
  'result-customer',
  'problem-strategy-policy',
  'result-table',
  'dark-title-4',
  'problem-strategy-channel',
  'result-review',
  'problem-strategy-ue',
  'result-chart',
  'closing',
];

function caseStudyVariantForIndex(slide, index) {
  if (slide.layout === 'closing') return 'closing';
  if (slide.layout === 'cover' || slide.layout === 'section') return 'dark-title-1';
  const source = cleanPortfolioText(`${slide.sectionLabel || ''} ${slide.title || ''} ${slide.subtitle || ''} ${slide.proposalVariant || ''}`).toLowerCase();
  const hasAny = (...words) => words.some(word => source.includes(word));
  if (slide.proposalVariant === 'contents' || hasAny('contents', 'index', 'toc')) return 'case-toc';
  if (slide.layout === 'experience' || hasAny('execution', 'build log', 'build', 'project', 'process log', 'representative experience')) return 'case-project';
  if ((slide.metrics || []).length || hasAny('impact', 'metric', 'kpi', 'result', 'proof', 'before / after', 'before/after', 'evidence')) return 'case-impact';
  if (hasAny('problem', 'context', 'user insight', 'constraint')) return 'case-problem';
  if (hasAny('decision', 'trade-off', 'tradeoff', 'risk')) return 'case-decision';
  if (hasAny('learning', 'growth point', 'case note')) return 'case-learning';
  if (hasAny('next', 'roadmap', 'next move')) return 'case-next';
  if (hasAny('fit', 'role scope', 'skill match', 'interview hook', 'collaboration')) return 'case-fit';
  if (hasAny('overview', 'snapshot', 'opening signal')) return 'case-snapshot';
  const fallback = ['case-snapshot', 'case-problem', 'case-decision', 'case-impact', 'case-learning', 'case-next', 'case-fit'];
  return fallback[Math.abs(Number(index) || 0) % fallback.length] || CASE_STUDY_REFERENCE_VARIANTS[Math.abs(Number(index) || 0) % CASE_STUDY_REFERENCE_VARIANTS.length];
}

function renderCaseStudyReferenceSlide(slide, t, v, index) {
  const variant = caseStudyVariantForIndex(slide, index);
  const lines = acceptedLines(slide);
  const items = slide.items || [];
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const left = lines.slice(0, 2);
  const right = lines.slice(2, 4);
  const cardShadow = '0 14px 30px rgba(35,44,86,0.12)';
  const panelBorder = '1px solid rgba(216,221,240,0.82)';
  const header = (
    <div style={{ position: 'absolute', left: 40, top: 26, right: 40 }}>
      <div style={{ width: 76, height: 18, borderRadius: 8, background: 'linear-gradient(90deg, #FFFFFF, #E6EBF8)', boxShadow: '0 8px 18px rgba(35,44,86,0.08)' }} />
      <div style={{ marginTop: 14, fontFamily: t.fonts.heading, fontSize: 30, lineHeight: 1.08, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{slide.title}</div>
    </div>
  );

  const darkTitle = title => {
    const acRgb = hexToRgb(v.accent);
    const acGlow = `rgba(${acRgb.red},${acRgb.green},${acRgb.blue},0.4)`;
    const acGlow2 = `rgba(${acRgb.red},${acRgb.green},${acRgb.blue},0.25)`;
    return (
    <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', overflow: 'hidden', fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: -60, top: -60, width: 180, height: 120, borderRadius: '50%', background: `radial-gradient(circle, ${acGlow}, rgba(0,0,0,0))` }} />
      <div style={{ position: 'absolute', right: -10, bottom: -20, width: 220, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${acGlow2}, rgba(0,0,0,0))` }} />
      <div style={{ position: 'absolute', left: 276, top: 222, width: 64, height: 22, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,255,255,0.92), rgba(211,219,236,0.78))' }} />
      <div style={{ position: 'absolute', left: 100, right: 100, top: 246, textAlign: 'center' }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 44, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{title || slide.title}</div>
      </div>
    </div>
    );
  };

  const statPill = (value, label, accentOverride) => {
    const pillAccent = accentOverride || v.accent;
    return (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '58px 1fr', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: pillAccent }} />
        <div>
          <div style={{ fontSize: 18, lineHeight: 1.05, fontWeight: 950, color: pillAccent, ...textClamp(1) }}>{value}</div>
          <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.35, fontWeight: 800, color: v.ink, ...textClamp(2) }}>{label}</div>
        </div>
      </div>
    );
  };

  const mockCard = (caption, height = 112, tone = 0) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ height, borderRadius: 18, background: tone === 0 ? 'linear-gradient(180deg, #F6F0FF, #E8EEFF)' : tone === 1 ? 'linear-gradient(180deg, #FFF5E7, #F7FAFF)' : 'linear-gradient(180deg, #F6F8FF, #FFFFFF)', border: panelBorder, boxShadow: '0 10px 18px rgba(35,44,86,0.1)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 12, borderRadius: 12, background: tone === 0 ? 'linear-gradient(135deg, rgba(120,88,255,0.16), rgba(63,160,255,0.14))' : tone === 1 ? 'linear-gradient(135deg, rgba(255,167,55,0.14), rgba(255,92,92,0.14))' : 'linear-gradient(135deg, rgba(40,50,122,0.08), rgba(255,255,255,0.18))' }} />
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, height: 7, borderRadius: 999, background: tone === 1 ? 'rgba(40,50,122,0.18)' : 'rgba(63,160,255,0.24)' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: v.muted, fontWeight: 700, ...textClamp(1) }}>{caption}</div>
    </div>
  );

  const mainBoard = (leftTitle = '문제정의', rightTitle = '전략 Strategies/Objectives') => (
    <div style={{ position: 'absolute', left: 40, top: 130, width: 520, height: 300, borderRadius: 24, background: v.card, border: panelBorder, boxShadow: cardShadow }}>
      <div style={{ position: 'absolute', left: 34, top: 36, width: 180 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 21, fontWeight: 900, color: v.ink }}>{leftTitle}</div>
        <div style={{ marginTop: 60, display: 'grid', gap: 24 }}>
          {left.map((line, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 12 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, border: `3px solid ${idx === 0 ? v.muted : v.soft}`, marginTop: 4 }} />
              <div>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, fontWeight: 700, color: idx === 0 ? v.ink : v.muted, ...textClamp(3) }}>{line.body || line.heading}</div>
                {line.heading && line.body && line.heading !== line.body ? <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: v.ink, ...textClamp(1) }}>{line.heading}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 260, top: 66, width: 2, height: 190, background: v.soft }} />
      <div style={{ position: 'absolute', left: 300, top: 36, width: 184 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 21, fontWeight: 900, color: v.ink }}>{rightTitle}</div>
        <div style={{ marginTop: 48, display: 'grid', gap: 18 }}>
          {right.map((line, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '12px 1fr', gap: 12 }}>
              <div style={{ fontSize: 18, lineHeight: 1, fontWeight: 900, color: v.ink }}>›</div>
              <div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 800, color: v.ink, ...textClamp(2) }}>{line.heading || line.body}</div>
                {line.body && line.body !== line.heading ? <div style={{ marginTop: 8, paddingLeft: 10, borderLeft: `3px solid ${v.soft}`, fontSize: 11.5, lineHeight: 1.5, color: v.muted, ...textClamp(3) }}>{line.body}</div> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const caseLines = lines.length ? lines : [{ heading: slide.sectionLabel || 'Case', body: slide.subtitle || slide.title || 'Evidence' }];
  const caseMetrics = metrics.length ? metrics : [
    { label: 'Problem', value: caseLines[0]?.heading || 'Defined' },
    { label: 'Action', value: caseLines[1]?.heading || 'Built' },
    { label: 'Result', value: caseLines[2]?.heading || 'Verified' },
  ];

  if (variant === 'closing') return darkTitle(slide.title || 'THANK YOU');
  if (variant.startsWith('dark-title')) return darkTitle();

  if (slide.layout === 'cs-closing') return darkTitle(slide.title || 'THANK YOU');

  if (slide.layout === 'cs-cover') {
    const acRgb = hexToRgb(v.accent);
    const acGlow = `rgba(${acRgb.red},${acRgb.green},${acRgb.blue},0.4)`;
    const acGlow2 = `rgba(${acRgb.red},${acRgb.green},${acRgb.blue},0.22)`;
    const titleLines = (slide.title || '').split('\n');
    const tagBullets = (slide.bullets || []).filter(Boolean).slice(0, 4);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', overflow: 'hidden', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: -70, top: -50, width: 220, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${acGlow}, rgba(0,0,0,0))` }} />
        <div style={{ position: 'absolute', right: -30, bottom: -40, width: 260, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${acGlow2}, rgba(0,0,0,0))` }} />
        <div style={{ position: 'absolute', left: 64, top: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 14, borderRadius: 4, background: v.accent, boxShadow: `0 0 14px ${v.accent}66` }} />
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.32em', fontWeight: 950 }}>{slide.sectionLabel || 'CASE STUDY'}</div>
        </div>
        <div style={{ position: 'absolute', left: 64, right: 64, top: 188 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 48, lineHeight: 1.1, fontWeight: 950, letterSpacing: '-0.01em', whiteSpace: 'pre-line', ...textClamp(4) }}>{titleLines.join('\n')}</div>
          {slide.subtitle ? <div style={{ marginTop: 18, fontSize: 15, lineHeight: 1.55, color: 'rgba(255,255,255,0.7)', fontWeight: 700, maxWidth: 720, ...textClamp(3) }}>{slide.subtitle}</div> : null}
        </div>
        {tagBullets.length ? (
          <div style={{ position: 'absolute', left: 64, right: 64, bottom: 56, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {tagBullets.map((bullet, idx) => (
              <div key={idx} style={{ padding: '8px 16px', borderRadius: 999, background: idx === 0 ? v.accent : 'rgba(255,255,255,0.08)', color: idx === 0 ? '#FFFFFF' : 'rgba(255,255,255,0.78)', fontSize: 11.5, fontWeight: 900, letterSpacing: '0.14em', border: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.18)' }}>{String(bullet).toUpperCase()}</div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (slide.layout === 'cs-contents') {
    const tocItems = items.length ? items : caseLines;
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 54, bottom: 54, width: 220, borderRight: '1px solid rgba(255,255,255,0.16)' }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.28em', fontWeight: 950 }}>CASE FILE</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, fontFamily: t.fonts.heading, fontSize: 64, lineHeight: 0.92, fontWeight: 950, letterSpacing: '-0.02em' }}>INDEX</div>
        </div>
        <div style={{ position: 'absolute', left: 316, top: 62, right: 54, bottom: 54 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 38, lineHeight: 1.06, fontWeight: 950, ...textClamp(2) }}>{slide.title || 'Contents'}</div>
          <div style={{ marginTop: 22, display: 'grid', gap: 8 }}>
            {tocItems.slice(0, 6).map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 10, alignItems: 'center', minHeight: 46, padding: '8px 0', borderBottom: idx < Math.min(tocItems.length, 6) - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 950, color: idx === 0 ? v.accent : 'rgba(255,255,255,0.42)' }}>{String(idx + 1).padStart(2, '0')}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, ...textClamp(1) }}>{item.heading || item.title}</div>
                  {item.body ? <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.55)', fontWeight: 700, ...textClamp(1) }}>{item.body}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (slide.layout === 'cs-technical') {
    const techItems = items.slice(0, 6);
    const heroMetric = metrics[0] || null;
    const cols = techItems.length > 4 ? 2 : techItems.length <= 2 ? 1 : 2;
    const rows = Math.max(1, Math.ceil(techItems.length / cols));
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 44, right: 54 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>{slide.sectionLabel || 'TECHNICAL EXCELLENCE'}</div>
          <div style={{ marginTop: 12, fontFamily: t.fonts.heading, fontSize: 32, lineHeight: 1.1, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{slide.title}</div>
        </div>
        {heroMetric ? (
          <div style={{ position: 'absolute', left: 54, top: 170, width: 290, bottom: 54, borderRadius: 22, background: v.dark, color: '#FFFFFF', padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: cardShadow }}>
            <div>
              <div style={{ color: v.accent, fontSize: 11, letterSpacing: '0.22em', fontWeight: 950 }}>HERO METRIC</div>
              <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.72)', fontWeight: 800, ...textClamp(3) }}>{heroMetric.label || 'Impact'}</div>
            </div>
            <div>
              <div style={{ fontFamily: t.fonts.heading, fontSize: 32, lineHeight: 1.12, fontWeight: 950, color: v.accent, ...textClamp(3) }}>{acceptedMetricText(heroMetric)}</div>
              {heroMetric.before && heroMetric.after ? (
                <div style={{ marginTop: 8, fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', fontWeight: 850 }}>BEFORE → AFTER</div>
              ) : null}
            </div>
          </div>
        ) : null}
        <div style={{ position: 'absolute', left: heroMetric ? 368 : 54, right: 54, top: 170, bottom: 54, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 12 }}>
          {techItems.map((item, idx) => {
            const icon = item.role || item.period || '';
            return (
              <div key={idx} style={{ borderRadius: 16, background: v.card, border: `1px solid ${v.soft}`, padding: '14px 16px', boxShadow: cardShadow, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: `${v.accent}1f`, color: v.accent, display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 950 }}>{icon || (idx + 1)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 950, color: v.ink, ...textClamp(1) }}>{item.heading}</div>
                  <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.5, color: v.muted, fontWeight: 700, ...textClamp(3) }}>{item.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.layout === 'cs-skillmap') {
    const skillItems = items.slice(0, 4);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 44, right: 54 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>{slide.sectionLabel || 'TECHNICAL SUMMARY'}</div>
          <div style={{ marginTop: 12, fontFamily: t.fonts.heading, fontSize: 32, lineHeight: 1.1, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 54, right: 54, top: 168, bottom: 50, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 14 }}>
          {skillItems.map((item, idx) => {
            const icon = item.role || item.period || '';
            const bullets = splitBulletLines(item.body);
            const isPrimary = idx === 0;
            return (
              <div key={idx} style={{ borderRadius: 18, background: isPrimary ? v.dark : v.card, color: isPrimary ? '#FFFFFF' : v.ink, border: `1px solid ${isPrimary ? v.dark : v.soft}`, padding: '18px 20px', boxShadow: cardShadow, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: isPrimary ? `${v.accent}33` : `${v.accent}1f`, color: v.accent, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 950 }}>{icon || (idx + 1)}</div>
                  <div style={{ fontSize: 16, fontWeight: 950, ...textClamp(1) }}>{item.heading}</div>
                </div>
                <div style={{ marginTop: 12, display: 'grid', gap: 6, overflow: 'hidden' }}>
                  {bullets.slice(0, 4).map((line, lineIdx) => (
                    <div key={lineIdx} style={{ display: 'grid', gridTemplateColumns: '8px 1fr', gap: 8, alignItems: 'start' }}>
                      <div style={{ marginTop: 6, width: 5, height: 5, borderRadius: '50%', background: v.accent }} />
                      <div style={{ fontSize: 11.5, lineHeight: 1.5, fontWeight: 700, color: isPrimary ? 'rgba(255,255,255,0.78)' : v.muted, ...textClamp(2) }}>{line}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.layout === 'cs-journey') {
    const phases = items.slice(0, 3);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 44, right: 54 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>{slide.sectionLabel || 'GROWTH NARRATIVE'}</div>
          <div style={{ marginTop: 10, fontFamily: t.fonts.heading, fontSize: 30, lineHeight: 1.1, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{slide.title}</div>
          {slide.subtitle ? <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: v.muted, fontWeight: 700, ...textClamp(2) }}>{slide.subtitle}</div> : null}
        </div>
        <div style={{ position: 'absolute', left: 54, right: 54, top: 220, bottom: 50, display: 'grid', gap: 12 }}>
          {phases.map((phase, idx) => {
            const tag = phase.role || phase.period || `PHASE 0${idx + 1}`;
            const isAccent = idx === 1;
            const isDarkRow = idx === 0;
            return (
              <div key={idx} style={{ borderRadius: 16, background: isDarkRow ? v.dark : isAccent ? v.accent : v.card, color: isDarkRow || isAccent ? '#FFFFFF' : v.ink, border: `1px solid ${isDarkRow ? v.dark : isAccent ? v.accent : v.soft}`, padding: '16px 22px', boxShadow: cardShadow, display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18, alignItems: 'center' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.22em', fontWeight: 950, color: isDarkRow ? v.accent : isAccent ? '#FFFFFF' : v.accent, ...textClamp(1) }}>{tag}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 950, ...textClamp(1) }}>{phase.heading}</div>
                  <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, fontWeight: 700, color: isDarkRow ? 'rgba(255,255,255,0.74)' : isAccent ? 'rgba(255,255,255,0.88)' : v.muted, ...textClamp(2) }}>{phase.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.layout === 'cs-contribution') {
    const contribItems = items.slice(0, 3);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 44, right: 54 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>{slide.sectionLabel || 'NEXT CONTRIBUTION'}</div>
          <div style={{ marginTop: 12, fontFamily: t.fonts.heading, fontSize: 30, lineHeight: 1.1, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 54, right: 54, top: 184, bottom: 50, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {contribItems.map((item, idx) => {
            const tag = item.role || item.period || `Commit ${idx + 1}`;
            const isPrimary = idx === 1;
            return (
              <div key={idx} style={{ borderRadius: 20, background: isPrimary ? v.dark : v.card, color: isPrimary ? '#FFFFFF' : v.ink, border: `1px solid ${isPrimary ? v.dark : v.soft}`, padding: '22px 22px 24px', boxShadow: cardShadow, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 999, background: isPrimary ? `${v.accent}33` : `${v.accent}1f`, color: v.accent, fontSize: 10.5, letterSpacing: '0.16em', fontWeight: 950, ...textClamp(1) }}>{tag}</div>
                <div style={{ marginTop: 16, fontFamily: t.fonts.heading, fontSize: 19, lineHeight: 1.18, fontWeight: 950, ...textClamp(3) }}>{item.heading}</div>
                <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.55, fontWeight: 700, color: isPrimary ? 'rgba(255,255,255,0.74)' : v.muted, flex: 1, ...textClamp(7) }}>{item.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.layout === 'cs-retrospective') {
    const retroItems = items.slice(0, 3);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 44, right: 54 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>{slide.sectionLabel || 'RETROSPECTIVE'}</div>
          <div style={{ marginTop: 12, fontFamily: t.fonts.heading, fontSize: 32, lineHeight: 1.1, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 54, right: 54, top: 180, bottom: 50, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {retroItems.map((item, idx) => {
            const icon = item.role || item.period || '';
            return (
              <div key={idx} style={{ borderRadius: 18, background: v.card, border: `1px solid ${v.soft}`, padding: '22px 22px 24px', boxShadow: cardShadow, display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${v.accent}1f`, color: v.accent, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 950 }}>{icon || '•'}</div>
                <div style={{ marginTop: 16, fontFamily: t.fonts.heading, fontSize: 17, lineHeight: 1.2, fontWeight: 950, color: v.ink, ...textClamp(3) }}>{item.heading}</div>
                <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55, fontWeight: 700, color: v.muted, flex: 1, ...textClamp(8) }}>{item.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'case-toc') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 42, top: 42, bottom: 42, width: 210, borderRight: '1px solid rgba(255,255,255,0.16)' }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>CASE FILE</div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, fontFamily: t.fonts.heading, fontSize: 60, lineHeight: 0.92, fontWeight: 950 }}>INDEX</div>
        </div>
        <div style={{ position: 'absolute', left: 306, top: 54, right: 54 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 42, lineHeight: 1.05, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
          <div style={{ marginTop: 26, display: 'grid', gap: 12 }}>
            {caseLines.slice(0, 5).map((line, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 160px', alignItems: 'center', minHeight: 56, borderBottom: '1px solid rgba(255,255,255,0.14)' }}>
                <div style={{ fontSize: 18, color: idx === 0 ? v.accent : 'rgba(255,255,255,0.42)', fontWeight: 950 }}>{String(idx + 1).padStart(2, '0')}</div>
                <div style={{ fontSize: 19, fontWeight: 900, ...textClamp(1) }}>{line.heading}</div>
                <div style={{ fontSize: 12, lineHeight: 1.35, color: 'rgba(255,255,255,0.58)', textAlign: 'right', ...textClamp(2) }}>{line.body || line.period}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'case-snapshot') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 46, width: 86, height: 12, borderRadius: 999, background: v.accent }} />
        <div style={{ position: 'absolute', left: 54, top: 84, width: 500 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 950 }}>{slide.sectionLabel || 'CASE SNAPSHOT'}</div>
          <div style={{ marginTop: 16, fontFamily: t.fonts.heading, fontSize: 42, lineHeight: 1.06, fontWeight: 950, ...textClamp(3) }}>{slide.title}</div>
          {slide.subtitle ? <div style={{ marginTop: 14, color: v.muted, fontSize: 14, lineHeight: 1.5, ...textClamp(3) }}>{slide.subtitle}</div> : null}
        </div>
        <div style={{ position: 'absolute', left: 612, top: 64, right: 56, bottom: 58, display: 'grid', gridTemplateRows: 'repeat(3, 1fr)', gap: 14 }}>
          {caseLines.slice(0, 3).map((line, idx) => (
            <div key={idx} style={{ borderRadius: idx === 1 ? 8 : 24, background: idx === 0 ? v.dark : v.card, color: idx === 0 ? '#FFFFFF' : v.ink, border: `1px solid ${idx === 0 ? v.dark : v.soft}`, padding: 22, boxShadow: cardShadow }}>
              <div style={{ color: idx === 0 ? v.accent : v.muted, fontSize: 11, letterSpacing: '0.16em', fontWeight: 950 }}>SIGNAL {idx + 1}</div>
              <div style={{ marginTop: 10, fontSize: 20, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div>
              <div style={{ marginTop: 7, fontSize: 12, lineHeight: 1.45, opacity: 0.72, ...textClamp(2) }}>{line.body || line.period}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'case-problem') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 338, background: v.dark, color: '#FFFFFF', padding: '48px 42px' }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 950 }}>PROBLEM</div>
          <div style={{ marginTop: 28, fontFamily: t.fonts.heading, fontSize: 34, lineHeight: 1.08, fontWeight: 950, ...textClamp(4) }}>{slide.title}</div>
          <div style={{ position: 'absolute', left: 42, right: 42, bottom: 44, color: 'rgba(255,255,255,0.64)', fontSize: 13, lineHeight: 1.55, ...textClamp(5) }}>{slide.subtitle || caseLines[0]?.body}</div>
        </div>
        <div style={{ position: 'absolute', left: 398, top: 62, right: 64, bottom: 58 }}>
          {caseLines.slice(0, 4).map((line, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', minHeight: 92, alignItems: 'start', borderBottom: idx < 3 ? `1px solid ${v.soft}` : 'none', padding: '0 0 20px 0', marginBottom: 18 }}>
              <div style={{ width: 42, height: 42, borderRadius: idx === 0 ? '50%' : 10, background: idx === 0 ? v.accent : v.soft, display: 'grid', placeItems: 'center', color: idx === 0 ? '#FFFFFF' : v.ink, fontWeight: 950 }}>{idx + 1}</div>
              <div>
                <div style={{ fontSize: 21, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div>
                <div style={{ marginTop: 8, color: v.muted, fontSize: 13, lineHeight: 1.5, ...textClamp(3) }}>{line.body || line.period}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'case-decision') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 42, right: 54 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>{slide.sectionLabel || 'DECISION LOG'}</div>
          <div style={{ marginTop: 14, fontFamily: t.fonts.heading, fontSize: 36, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 54, right: 54, top: 166, bottom: 58, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {caseLines.slice(0, 2).map((line, idx) => (
            <div key={idx} style={{ borderRadius: idx === 0 ? 26 : 6, background: idx === 0 ? v.card : v.dark, color: idx === 0 ? v.ink : '#FFFFFF', padding: 28, border: `1px solid ${idx === 0 ? v.soft : v.dark}`, boxShadow: cardShadow }}>
              <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.18em', fontWeight: 950 }}>{idx === 0 ? 'CHOSEN' : 'TRADE-OFF'}</div>
              <div style={{ marginTop: 56, fontSize: 28, lineHeight: 1.1, fontWeight: 950, ...textClamp(2) }}>{line.heading}</div>
              <div style={{ marginTop: 16, color: idx === 0 ? v.muted : 'rgba(255,255,255,0.64)', fontSize: 13, lineHeight: 1.5, ...textClamp(5) }}>{line.body || line.period}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'case-project') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 42, top: 38, bottom: 38, width: 194, borderRadius: 24, background: v.dark, color: '#FFFFFF', padding: 24 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 950 }}>PROJECT</div>
          <div style={{ position: 'absolute', left: 24, right: 24, bottom: 26, fontSize: 26, lineHeight: 1.05, fontWeight: 950, ...textClamp(4) }}>{slide.sectionLabel || 'Execution'}</div>
        </div>
        <div style={{ position: 'absolute', left: 278, top: 46, right: 54 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 34, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
          {slide.subtitle ? <div style={{ marginTop: 10, color: v.muted, fontSize: 13, ...textClamp(1) }}>{slide.subtitle}</div> : null}
        </div>
        <div style={{ position: 'absolute', left: 278, right: 54, top: 166, bottom: 54, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {caseLines.slice(0, 4).map((line, idx) => (
            <div key={idx} style={{ borderRadius: 18, background: idx === 0 ? v.dark : v.card, color: idx === 0 ? '#FFFFFF' : v.ink, border: `1px solid ${idx === 0 ? v.dark : v.soft}`, padding: 20, boxShadow: cardShadow }}>
              <div style={{ color: idx === 0 ? v.accent : v.muted, fontSize: 11, letterSpacing: '0.16em', fontWeight: 950 }}>{['DEFINE', 'BUILD', 'VERIFY', 'SHIP'][idx] || `STEP ${idx + 1}`}</div>
              <div style={{ marginTop: 16, fontSize: 20, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div>
              <div style={{ marginTop: 8, color: idx === 0 ? 'rgba(255,255,255,0.68)' : v.muted, fontSize: 12, lineHeight: 1.45, ...textClamp(3) }}>{line.body || line.period}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'case-impact') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: '#FFFFFF', fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 48, color: v.accent, fontSize: 12, letterSpacing: '0.24em', fontWeight: 950 }}>IMPACT PROOF</div>
        <div style={{ position: 'absolute', left: 54, top: 96, width: 470, fontFamily: t.fonts.heading, fontSize: 40, lineHeight: 1.08, fontWeight: 950, ...textClamp(3) }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 560, right: 54, top: 82, bottom: 62, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {caseMetrics.slice(0, 4).map((metric, idx) => (
            <div key={idx} style={{ borderTop: `4px solid ${idx === 0 ? v.accent : 'rgba(255,255,255,0.16)'}`, paddingTop: 18 }}>
              <div style={{ fontSize: 34, lineHeight: 1.05, fontWeight: 300, color: idx === 0 ? v.accent : '#FFFFFF', ...textClamp(1) }}>{acceptedMetricText(metric)}</div>
              <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 1.35, fontWeight: 850, ...textClamp(2) }}>{metric.label || 'Result'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'case-learning') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 44, right: 54 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 950 }}>{slide.sectionLabel || 'LEARNING'}</div>
          <div style={{ marginTop: 12, fontFamily: t.fonts.heading, fontSize: 36, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 108, right: 108, top: 176, display: 'grid', gap: 12 }}>
          {caseLines.slice(0, 3).map((line, idx) => (
            <div key={idx} style={{ marginLeft: idx * 54, marginRight: idx * 54, minHeight: 82, borderRadius: 18, background: idx === 0 ? v.dark : idx === 1 ? v.accent : v.card, color: idx === 0 ? '#FFFFFF' : idx === 1 ? '#FFFFFF' : v.ink, padding: '18px 24px', boxShadow: cardShadow }}>
              <div style={{ fontSize: 18, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div>
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.45, opacity: 0.72, ...textClamp(2) }}>{line.body || line.period}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'case-next') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 54, top: 48, width: 310 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 950 }}>NEXT STEP</div>
          <div style={{ marginTop: 18, fontFamily: t.fonts.heading, fontSize: 36, lineHeight: 1.08, fontWeight: 950, ...textClamp(3) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 410, right: 58, top: 100, height: 330 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 164, height: 3, background: v.soft }} />
          {caseLines.slice(0, 4).map((line, idx) => (
            <div key={idx} style={{ position: 'absolute', left: idx * 126, top: idx % 2 ? 188 : 44, width: 118 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: idx === 0 ? v.accent : v.dark, marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 950, ...textClamp(2) }}>{line.heading}</div>
              <div style={{ marginTop: 8, color: v.muted, fontSize: 11.5, lineHeight: 1.42, ...textClamp(3) }}>{line.body || line.period}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'case-fit') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 52, top: 44, right: 52 }}>
          <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.22em', fontWeight: 950 }}>{slide.sectionLabel || 'ROLE FIT'}</div>
          <div style={{ marginTop: 12, fontFamily: t.fonts.heading, fontSize: 34, lineHeight: 1.08, fontWeight: 950, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 78, top: 190, width: 270, height: 270, borderRadius: '50%', background: v.dark, color: '#FFFFFF', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 34 }}>
          <div>
            <div style={{ color: v.accent, fontSize: 12, letterSpacing: '0.18em', fontWeight: 950 }}>FIT</div>
            <div style={{ marginTop: 12, fontSize: 24, lineHeight: 1.1, fontWeight: 950, ...textClamp(3) }}>{caseLines[0]?.heading || slide.sectionLabel}</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 428, right: 62, top: 182, display: 'grid', gap: 12 }}>
          {caseLines.slice(1, 4).map((line, idx) => (
            <div key={idx} style={{ borderRadius: 16, background: v.card, border: `1px solid ${v.soft}`, padding: '18px 22px', boxShadow: cardShadow }}>
              <div style={{ fontSize: 18, fontWeight: 950, ...textClamp(1) }}>{line.heading}</div>
              <div style={{ marginTop: 6, color: v.muted, fontSize: 12.5, lineHeight: 1.45, ...textClamp(2) }}>{line.body || line.period}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'profile') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.dark, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 28, top: 28, width: 262, height: 484, borderRadius: 140, background: `${v.accent}22` }} />
        <div style={{ position: 'absolute', left: 326, top: 34, width: 594, height: 448, borderRadius: 36, background: 'rgba(255,255,255,0.88)', boxShadow: cardShadow }} />
        <div style={{ position: 'absolute', left: 80, top: 86, width: 170, height: 170, borderRadius: '50%', background: v.accent }} />
        <div style={{ position: 'absolute', left: 128, top: 58, width: 74, height: 74, borderRadius: '50%', background: '#0B0D12' }} />
        <div style={{ position: 'absolute', left: 74, top: 322, width: 190, fontFamily: t.fonts.heading, fontSize: 34, lineHeight: 1.04, fontWeight: 950, color: '#FFFFFF', ...textClamp(2) }}>{slide.title}</div>
        <div style={{ position: 'absolute', left: 54, bottom: 56, width: 212, fontSize: 14, lineHeight: 1.35, color: 'rgba(255,255,255,0.62)', fontWeight: 700 }}>#사용자중심 #입체적사고 #문제정의 #목적지향 #회복탄력성 #팀워크</div>
        <div style={{ position: 'absolute', left: 152, top: 236, width: 258, borderRadius: 18, background: '#FFFFFF', padding: '14px 16px', boxShadow: '0 12px 22px rgba(35,44,86,0.14)' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: v.accent, textAlign: 'center' }}>나의 경력과 강점 요약</div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.55, fontWeight: 700, color: '#404762', textAlign: 'center', ...textClamp(3) }}>{slide.subtitle || '경력, 역할, 툴, 프로젝트 요약을 한 장에서 안정적으로 보여주는 소개형 슬라이드'}</div>
        </div>
        <div style={{ position: 'absolute', left: 372, top: 76, width: 516, display: 'grid', gap: 22 }}>
          <div>
            <div style={{ fontFamily: t.fonts.heading, fontSize: 28, fontWeight: 900, color: v.accent }}>Work</div>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {lines.slice(0, 4).map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 12, alignItems: 'start' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: v.accent }} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#21264F', ...textClamp(1) }}>{line.heading}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#6B7395', fontWeight: 800, ...textClamp(2) }}>{line.body || line.period}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: t.fonts.heading, fontSize: 28, fontWeight: 900, color: v.accent }}>Tools</div>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {['Figma', 'GA', 'DataGrip', 'Notion', 'Channel', 'Power BI', 'Jira', 'Slack'].map((tool, idx) => (
                <div key={tool} style={{ borderRadius: 12, background: 'rgba(255,255,255,0.82)', padding: '12px 10px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: idx % 2 ? '#6B7395' : '#404762' }}>{tool}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'projects-3' || variant === 'projects-2') {
    const count = variant === 'projects-3' ? 3 : 2;
    const source = (items.length ? items : lines).slice(0, count);
    return (
      <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
        <div style={{ position: 'absolute', left: 52, top: 44 }}>
          <div style={{ fontSize: 22, fontWeight: 950, color: v.accent }}>{variant === 'projects-3' ? 'MAIN PROJECTS' : 'SIDE PROJECTS'}</div>
          <div style={{ marginTop: 6, fontFamily: t.fonts.heading, fontSize: 34, lineHeight: 1.06, fontWeight: 950, color: v.ink, ...textClamp(2) }}>{slide.title}</div>
        </div>
        <div style={{ position: 'absolute', left: 130, right: 130, top: 180, display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 44 }}>
          {source.map((entry, idx) => (
            <div key={idx} style={{ position: 'relative', textAlign: 'center' }}>
              {idx < count - 1 ? <div style={{ position: 'absolute', right: -22, top: 10, width: 2, height: 240, background: 'rgba(184,191,220,0.7)' }} /> : null}
              <div style={{ width: 150, height: 150, margin: '0 auto', borderRadius: '50%', background: '#FFFFFF', boxShadow: cardShadow, display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 118, height: 118, borderRadius: '50%', background: '#080A10' }} />
              </div>
              <div style={{ marginTop: 28, fontFamily: t.fonts.heading, fontSize: 22, fontWeight: 900, color: v.ink, ...textClamp(2) }}>{entry.heading || entry.role}</div>
              <div style={{ marginTop: 18, fontSize: 13, lineHeight: 1.55, color: v.muted, fontWeight: 700, whiteSpace: 'pre-line', ...textClamp(4) }}>{entry.body || (entry.bullets || []).join('\n')}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const rightTopPanel = (
    <div style={{ position: 'absolute', left: 590, top: 130, width: 330, height: variant === 'split-large-image' ? 300 : 154, borderRadius: 22, background: 'rgba(252,252,255,0.95)', border: panelBorder, boxShadow: cardShadow, padding: 18 }}>
      <div style={{ textAlign: 'center', fontFamily: t.fonts.heading, fontSize: 16, fontWeight: 900, color: v.ink }}>{variant === 'result-guide' ? '글로벌 가이드 페이지' : variant === 'result-dashboard' ? '기능 / 이벤트 / 캘린더' : variant === 'split-large-image' ? '프로젝트 화면' : '예시 화면'}</div>
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: variant === 'split-large-image' ? '1fr' : variant === 'result-guide' ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 14 }}>
        {(variant === 'result-guide' ? ['가이드', '현지화'] : variant === 'result-dashboard' ? ['기능', '이벤트', '캘린더'] : lines.slice(0, variant === 'split-large-image' ? 1 : 3).map(line => line.heading || '화면')).map((caption, idx) => (
          <div key={idx}>{mockCard(caption, variant === 'split-large-image' ? 208 : 104, idx)}</div>
        ))}
      </div>
    </div>
  );

  const rightBottomPanel = (
    <div style={{ position: 'absolute', left: 590, top: 304, width: 330, height: 126, borderRadius: 22, background: 'rgba(252,252,255,0.95)', border: panelBorder, boxShadow: cardShadow, padding: 18 }}>
      {variant === 'result-customer' || variant === 'result-chart'
        ? <div style={{ display: 'flex', gap: 20, height: '100%', alignItems: 'center' }}>
            {statPill(acceptedMetricText(metrics[0] || { value: '300%' }), metrics[0]?.label || '리소스 효율')}
            {statPill(acceptedMetricText(metrics[1] || { value: '97.8%' }), metrics[1]?.label || '동일 건 감소')}
          </div>
        : variant === 'result-table'
          ? <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 11, fontWeight: 900, color: v.ink, textAlign: 'center' }}>
                <div>AA</div><div>기업명</div><div>BB</div>
              </div>
              {['국가', '인력', '비교'].map((row, idx) => (
                <div key={row} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 11, fontWeight: 700, color: v.muted, textAlign: 'center', paddingTop: 6, borderTop: idx ? '1px solid rgba(216,221,240,0.82)' : 'none' }}>
                  <div>{idx === 0 ? '해외' : idx === 1 ? '3' : '0.9'}</div><div>{row}</div><div>{idx === 0 ? '서울, 부산' : idx === 1 ? '유' : '비'}</div>
                </div>
              ))}
            </div>
          : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '100%', alignItems: 'center' }}>
              {statPill(acceptedMetricText(metrics[0] || { value: '5→25명' }), metrics[0]?.label || '팀 증원')}
              {statPill(acceptedMetricText(metrics[1] || { value: 'KR to Global' }), metrics[1]?.label || '선례 확산')}
            </div>}
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, background: v.bg, color: v.ink, fontFamily: t.fonts.body }}>
      {header}
      {mainBoard(
        variant.includes('policy') || variant.includes('service') || variant.includes('channel') || variant.includes('ue') ? '문제정의' : '문제정의',
        variant === 'problem-strategy-simple' ? '전략 Strategies/Objectives' : '전략 Strategies/Objectives'
      )}
      {variant === 'split-image' || variant === 'split-large-image'
        ? <div style={{ position: 'absolute', left: 590, top: 130, width: 330, height: variant === 'split-large-image' ? 300 : 300, borderRadius: 22, background: 'rgba(252,252,255,0.95)', border: panelBorder, boxShadow: cardShadow, padding: 18 }}>
            {mockCard(lines[0]?.heading || '프로젝트 화면', variant === 'split-large-image' ? 232 : 170, 0)}
          </div>
        : rightTopPanel}
      {variant === 'result-gallery' || variant === 'result-dashboard' || variant === 'result-dashboard-metric' || variant === 'result-guide' || variant === 'result-customer' || variant === 'result-table' || variant === 'result-review' || variant === 'result-chart'
        ? rightBottomPanel
        : <div style={{ position: 'absolute', left: 590, top: 304, width: 330, height: 126, borderRadius: 22, background: 'rgba(252,252,255,0.95)', border: panelBorder, boxShadow: cardShadow, padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {metrics.slice(0, 2).map((metric, idx) => <div key={idx}>{statPill(acceptedMetricText(metric), metric.label || '핵심 성과')}</div>)}
          </div>}
    </div>
  );
}

function ProposalDots({ color, right = 70, top = 292 }) {
  const dots = [];
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 21; col += 1) {
      if (col < row * 1.35) continue;
      dots.push({ row, col });
    }
  }
  return (
    <div style={{ position: 'absolute', right, top, width: 260, height: 160, overflow: 'hidden' }}>
      {dots.map(({ row, col }) => (
        <span
          key={`${row}-${col}`}
          style={{
            position: 'absolute',
            left: col * 10,
            top: row * 10,
            width: 6 + Math.min(row, 6) * 0.45,
            height: 6 + Math.min(row, 6) * 0.45,
            borderRadius: '50%',
            background: color,
            opacity: Math.max(0.14, 0.95 - col * 0.035),
          }}
        />
      ))}
    </div>
  );
}

function proposalPill(label, c) {
  const textColor = readableTextOn('#FFFFFF', c.sub);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#FFFFFF', borderRadius: 999, padding: '6px 14px', color: textColor, fontSize: 12, fontWeight: 700, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.accent }} />
      {label}
    </div>
  );
}

function renderProposalCover(slide, t) {
  const c = t.colors;
  const onDark = readableTextOn(c.dark, c.headFg || SAFE_TEXT_LIGHT);
  const accentOnDark = visibleColorOn(c.dark, c.accent, SAFE_TEXT_LIGHT);
  const tags = (slide.bullets && slide.bullets.length ? slide.bullets : ['EXPERIENCE', 'IMPACT', 'SCALABILITY']).slice(0, 3);
  return (
    <div style={{ position: 'absolute', inset: 0, background: c.dark, color: onDark, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 66, top: 64, color: accentOnDark, fontFamily: t.fonts.heading, fontSize: 40, fontWeight: 900 }}>FITPOLY</div>
      <div style={{ position: 'absolute', right: 66, top: 62, fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>{new Date().toISOString().slice(0, 10).replace(/-/g, '.')}</div>
      <div style={{ position: 'absolute', left: 66, top: 142, width: 560 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 48, fontWeight: 300, lineHeight: 1.2, color: onDark, ...textClamp(2) }}>{slide.subtitle || '경험을 기준으로'}</div>
        <div style={{ marginTop: 8, fontFamily: t.fonts.heading, fontSize: 42, fontWeight: 900, lineHeight: 1.2, color: onDark, ...textClamp(3) }}>{proposalTextParts(slide.title || '포트폴리오 솔루션', accentOnDark)}</div>
      </div>
      <ProposalDots color={accentOnDark} />
      <div style={{ position: 'absolute', left: 66, bottom: 58, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 800, color: onDark }}>
        {tags.map((tag, i) => <span key={i}>{tag}{i < tags.length - 1 ? ' ·' : ''}</span>)}
      </div>
    </div>
  );
}

function renderProposal(slide, t, index) {
  const c = t.colors;
  const isDark = slide.dark || slide.layout === 'closing' || (slide.layout === 'experience' && slide.layout_type === 'CENTER_METRIC');
  const bg = isDark ? c.dark : c.bg;
  const titleColor = readableTextOn(bg, isDark ? SAFE_TEXT_LIGHT : c.sub);
  const bodyColor = mutedTextOn(bg, isDark ? SAFE_MUTED_LIGHT : c.muted);
  const accentColor = visibleColorOn(bg, c.accent, isDark ? SAFE_TEXT_LIGHT : c.dark);
  const section = slide.sectionLabel || (slide.layout === 'closing' ? '마무리' : '제안서');
  const titleSize = dynamicFontPx(slide.title, 34, { min: 24, max: 38 });
  const bodyTop = slide.subtitle || String(slide.title || '').length > 28 ? 218 : 204;

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, color: titleColor, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 52, top: 28 }}>{proposalPill(section, c)}</div>
      {isDark && <ProposalDots color={accentColor} right={70} top={55} />}
      <div style={{ position: 'absolute', left: 52, right: 52, top: 78 }}>
        <div style={{ width: 'min(820px, 100%)', margin: slide.layout === 'profile' ? 0 : '0 auto', fontFamily: t.fonts.heading, fontSize: titleSize, fontWeight: 900, color: titleColor, lineHeight: 1.22, textAlign: slide.layout === 'profile' ? 'left' : 'center', ...textClamp(2) }}>
          {proposalTextParts(slide.title || section, accentColor)}
        </div>
        {slide.subtitle ? <div style={{ width: 'min(720px, 100%)', margin: slide.layout === 'profile' ? '10px 0 0' : '10px auto 0', fontSize: 13, fontWeight: 600, color: bodyColor, lineHeight: 1.45, textAlign: slide.layout === 'profile' ? 'left' : 'center', ...textClamp(2) }}>{slide.subtitle}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 52, right: 52, top: bodyTop, bottom: 44 }}>
        {renderProposalBody(slide, t, isDark)}
      </div>
      <div style={{ position: 'absolute', right: 52, bottom: 24, color: isDark ? 'rgba(255,255,255,0.42)' : c.muted, fontSize: 10 }}>{String(index + 1).padStart(2, '0')}</div>
    </div>
  );
}

function renderProposalBody(slide, t, isDark) {
  const c = t.colors;
  const bullets = slide.bullets || [];
  const items = slide.items || [];
  const variant = slide.proposalVariant || '';
  const pageBg = isDark ? c.dark : c.bg;
  const pageText = readableTextOn(pageBg, isDark ? SAFE_TEXT_LIGHT : c.sub);
  const pageMuted = mutedTextOn(pageBg, isDark ? SAFE_MUTED_LIGHT : c.muted);
  const accentText = readableTextOn(c.accent, SAFE_TEXT_LIGHT);
  const darkText = readableTextOn(c.dark, SAFE_TEXT_LIGHT);
  const dark2Text = readableTextOn(c.dark2, SAFE_TEXT_LIGHT);
  const neutralText = readableTextOn(c.neutral, SAFE_TEXT_LIGHT);
  const cardText = readableTextOn(c.card, c.sub);
  const cardMuted = mutedTextOn(c.card, c.muted);
  const accentOnPage = visibleColorOn(pageBg, c.accent, isDark ? SAFE_TEXT_LIGHT : c.dark);
  const accentOnCard = visibleColorOn(c.card, c.accent, c.dark);

  if (variant === 'contents') {
    return (
      <div style={{ position: 'relative', height: '100%', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, items.length)}, 1fr)`, gap: 28, alignItems: 'end' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, height: 2, background: c.neutral || c.line, opacity: 0.5 }} />
        {items.map((item, i) => (
          <div key={i} style={{ position: 'relative', paddingBottom: 42 }}>
            <div style={{ color: accentOnPage, fontSize: 16, fontWeight: 900, marginBottom: 10 }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: pageText, lineHeight: 1.18, ...textClamp(2) }}>{item.heading}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: pageMuted, ...textClamp(1) }}>{item.role}</div>
            <div style={{ position: 'absolute', left: 0, bottom: 64, width: 9, height: 9, borderRadius: '50%', background: accentOnPage }} />
            <div style={{ position: 'absolute', left: 0, bottom: 12, fontSize: 11, color: pageMuted, lineHeight: 1.45, ...textClamp(3) }}>{item.body}</div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'threeCards') {
    return <ProposalThreeCards items={items} c={c} isDark={isDark} />;
  }

  if (variant === 'splitPhotoList') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '42% 1fr', gap: 42, height: '100%', alignItems: 'center' }}>
        <div style={{ height: 275, borderRadius: 18, background: `linear-gradient(135deg, ${c.dark} 0%, ${c.neutral || c.muted} 100%)`, filter: 'grayscale(1)', opacity: 0.88 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {items.slice(0, 4).map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: i === items.length - 1 ? c.accent : c.dark, color: i === items.length - 1 ? accentText : darkText, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: pageText, ...textClamp(1) }}>{item.heading}</div>
                <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.45, color: pageMuted, ...textClamp(2) }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'timeline') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {items.slice(0, 5).map((item, i) => (
          <div key={i} style={{ width: 150, textAlign: 'center', position: 'relative' }}>
            {i < items.length - 1 && <div style={{ position: 'absolute', left: 112, top: 66, width: 90, borderTop: `2px dotted ${c.muted}` }} />}
            <div style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 14px', background: i % 2 ? c.dark : c.neutral, border: `5px solid ${i === 1 ? c.accent : '#FFFFFF'}` }} />
            <div style={{ color: accentOnPage, fontSize: 15, fontWeight: 900, ...textClamp(1) }}>{item.period || `STEP ${i + 1}`}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: pageText, lineHeight: 1.2, ...textClamp(2) }}>{item.heading}</div>
            <div style={{ marginTop: 5, fontSize: 11, color: pageMuted, lineHeight: 1.35, ...textClamp(3) }}>{item.body}</div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'darkStats') {
    const metrics = slide.metrics || [];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px 1fr', gap: 28, height: '100%', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 34 }}>{metrics.slice(0, 2).map((m, i) => <ProposalBigMetric key={i} metric={m} c={c} />)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ height: 112, borderRadius: 9, background: i === 2 ? c.accent : '#FFFFFF', opacity: i === 2 ? 1 : 0.88 }} />)}</div>
        <div style={{ display: 'grid', gap: 34, textAlign: 'right' }}>{metrics.slice(2, 4).map((m, i) => <ProposalBigMetric key={i} metric={m} c={c} align="right" />)}</div>
      </div>
    );
  }

  if (variant === 'bubbleCore') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '48% 1fr', gap: 30, height: '100%', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{bullets.slice(0, 3).map((bullet, i) => <div key={i}><div style={{ fontSize: 18, fontWeight: 900, color: pageText, ...textClamp(2) }}>{bullet}</div><div style={{ marginTop: 8, fontSize: 12, color: pageMuted, lineHeight: 1.5, ...textClamp(2) }}>경험정리에서 반복적으로 확인된 핵심 강점입니다.</div></div>)}</div>
        <div style={{ position: 'relative', height: 300 }}>
          {[{ x: 70, y: 20, s: 120, t: 'Expertise', bg: c.accent }, { x: 220, y: 90, s: 130, t: 'Operational\nStability', bg: c.dark }, { x: 135, y: 205, s: 90, t: 'Talent\nNetwork', bg: c.dark }].map((bubble, i) => <div key={i} style={{ position: 'absolute', left: bubble.x, top: bubble.y, width: bubble.s, height: bubble.s, borderRadius: '50%', background: bubble.bg, color: readableTextOn(bubble.bg, SAFE_TEXT_LIGHT), display: 'grid', placeItems: 'center', textAlign: 'center', whiteSpace: 'pre-line', fontSize: 15, padding: 12, ...textClamp(3) }} >{bubble.t}</div>)}
        </div>
      </div>
    );
  }

  if (variant === 'comparison') {
    return <ProposalComparison items={items} c={c} />;
  }

  if (variant === 'metricBars') {
    const values = ['80%', '50%', '50%', '70%'];
    return <ProposalMetricBars bullets={bullets} values={values} c={c} />;
  }

  if (variant === 'graphCallout') {
    return <ProposalGraph bullets={bullets} c={c} />;
  }

  if (variant === 'synergy') {
    return <ProposalSynergy items={items} c={c} />;
  }

  if (variant === 'venn') {
    return <ProposalVenn items={items} c={c} />;
  }

  if (variant === 'stairSteps') {
    return <ProposalStairs items={items} c={c} />;
  }

  if (variant === 'roleTable') {
    return <ProposalTable rows={slide.table || []} c={c} />;
  }

  if (variant === 'targetCircle' || variant === 'orbit') {
    return <ProposalOrbit items={items} c={c} />;
  }

  if (variant === 'caseGrid') {
    return <ProposalCaseGrid items={items} c={c} />;
  }

  if (variant === 'testimonial') {
    return <ProposalTestimonials bullets={bullets} c={c} />;
  }

  if (variant === 'conditionGrid' || variant === 'faqCards') {
    return <ProposalConditionGrid items={items} c={c} />;
  }

  if (variant === 'criteria') {
    return <ProposalCriteria items={items} c={c} />;
  }

  if (variant === 'gantt') {
    return <ProposalGantt items={items} c={c} />;
  }

  if (variant === 'stageCards') {
    return <ProposalStageCards items={items} c={c} />;
  }

  if (variant === 'pyramid') {
    return <ProposalPyramid items={items} c={c} />;
  }

  if (variant === 'promise') {
    return <ProposalPromise bullets={bullets} c={c} />;
  }

  if (variant === 'budget') {
    return <ProposalBudget items={items} c={c} />;
  }

  if (variant === 'risk') {
    return <ProposalRisk items={items} c={c} />;
  }

  if (variant === 'closing') {
    return <div style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#FFFFFF', fontSize: 18, lineHeight: 1.7 }}>{bullets.join(' · ')}</div>;
  }

  if (slide.layout === 'experience') return renderProposalExperience(slide, t, isDark);

  if (items.length) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, height: '100%' }}>
        {items.slice(0, 3).map((item, i) => (
          <div key={i} style={{ background: i === 2 ? c.accent : (isDark ? c.dark2 : c.card), color: i === 2 ? accentText : (isDark ? dark2Text : cardText), borderRadius: 10, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', boxShadow: isDark ? 'none' : '0 6px 24px rgba(20,20,20,0.06)', overflow: 'hidden' }}>
            <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.25, ...textClamp(2) }}>{item.heading}</div>
            {item.role ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>{item.role}</div> : null}
            {item.body ? <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.55, opacity: 0.86, ...textClamp(5) }}>{item.body}</div> : null}
          </div>
        ))}
      </div>
    );
  }

  if (bullets.length) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: bullets.length > 3 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12 }}>
        {bullets.slice(0, 6).map((bullet, i) => (
          <div key={i} style={{ background: i === 0 ? c.accent : (isDark ? c.dark2 : c.card), color: i === 0 ? accentText : (isDark ? dark2Text : cardText), borderRadius: 10, padding: '18px 22px', minHeight: 104, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: isDark ? 'none' : '0 6px 24px rgba(20,20,20,0.05)', overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: i === 0 ? accentText : accentOnCard, marginBottom: 8 }}>0{i + 1}</div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.35, ...textClamp(3) }}>{bullet}</div>
          </div>
        ))}
      </div>
    );
  }

  return <div style={{ color: isDark ? '#FFFFFF' : c.muted, fontSize: 14 }}>내용을 생성하는 중입니다.</div>;
}

function ProposalBigMetric({ metric, c, align = 'left' }) {
  const onDark = readableTextOn(c.dark, SAFE_TEXT_LIGHT);
  return <div style={{ textAlign: align }}><div style={{ fontSize: 52, fontWeight: 300, color: onDark, lineHeight: 1, ...textClamp(1) }}>{metric.value}</div><div style={{ marginTop: 8, fontSize: 17, fontWeight: 900, color: onDark, ...textClamp(2) }}>{metric.label}</div></div>;
}

function ProposalThreeCards({ items, c, isDark }) {
  const cardFill = isDark ? c.dark2 : c.card;
  const cardText = readableTextOn(cardFill, isDark ? SAFE_TEXT_LIGHT : c.sub);
  const cardMuted = mutedTextOn(cardFill, isDark ? SAFE_MUTED_LIGHT : c.muted);
  const visible = items.slice(0, 3);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, visible.length)}, 1fr)`, gap: 18, height: '100%', alignItems: 'stretch' }}>
      {visible.map((item, i) => {
        const featured = i === visible.length - 1;
        const fill = featured ? c.accent : cardFill;
        const fg = readableTextOn(fill, featured ? SAFE_TEXT_LIGHT : cardText);
        const muted = featured ? readableTextOn(fill, SAFE_TEXT_LIGHT, 3.2) : cardMuted;
        return (
          <div key={i} style={{ minHeight: 0, borderRadius: 12, background: fill, color: fg, padding: 24, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 14, boxShadow: isDark ? '0 18px 40px rgba(0,0,0,0.22)' : '0 14px 34px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: featured ? 'rgba(255,255,255,0.2)' : c.line, color: featured ? fg : visibleColorOn(c.line, c.accent, c.dark), fontSize: 11, fontWeight: 900 }}>{String(i + 1).padStart(2, '0')}</span>
              <span style={{ flex: 1, height: 2, background: featured ? 'rgba(255,255,255,0.24)' : c.line }} />
            </div>
            <div style={{ alignSelf: 'end' }}>
              <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.25, ...textClamp(2) }}>{item.heading}</div>
              <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.55, color: muted, opacity: 0.94, ...textClamp(5) }}>{item.body}</div>
            </div>
            <div style={{ height: 4, width: '42%', borderRadius: 999, background: featured ? 'rgba(255,255,255,0.42)' : visibleColorOn(fill, c.accent, c.dark) }} />
          </div>
        );
      })}
    </div>
  );
}

function ProposalComparison({ items, c }) {
  const cardText = readableTextOn('#FFFFFF', c.sub);
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, height: '100%', alignItems: 'center' }}>
      {items.slice(0, 2).map((item, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '48% 1fr', background: '#FFFFFF', borderRadius: 16, overflow: 'hidden', minHeight: 210 }}>
          <div style={{ background: i ? c.dark : c.neutral, filter: 'grayscale(1)' }} />
          <div style={{ padding: 28, textAlign: 'center', color: cardText }}><div style={{ display: 'inline-block', padding: '8px 28px', borderRadius: 999, background: i ? c.dark : c.accent, color: readableTextOn(i ? c.dark : c.accent, SAFE_TEXT_LIGHT), fontWeight: 900, maxWidth: '100%', ...textClamp(1) }}>{item.heading}</div><div style={{ marginTop: 24, fontSize: 13, color: cardMuted, lineHeight: 1.75, ...textClamp(5) }}>{item.body}</div></div>
        </div>
      ))}
    </div>
  );
}

function ProposalMetricBars({ bullets, values, c }) {
  const cardText = readableTextOn('#FFFFFF', c.sub);
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  const accentOnCard = visibleColorOn('#FFFFFF', c.accent, c.dark);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '42% 1fr', gap: 28, height: '100%' }}>
      <div style={{ display: 'grid', gap: 10 }}>{bullets.slice(0, 2).map((bullet, i) => { const fill = i ? c.dark : c.accent; return <div key={i} style={{ borderRadius: 12, padding: 22, background: fill, color: readableTextOn(fill, SAFE_TEXT_LIGHT), overflow: 'hidden' }}><div style={{ fontSize: 18, fontWeight: 900, ...textClamp(1) }}>{i ? '비즈니스 측면' : '외부환경 측면'}</div><div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55, opacity: 0.9, ...textClamp(4) }}>{bullet}</div></div>; })}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, background: '#FFFFFF', borderRadius: 14, padding: 28, color: cardText }}>{values.map((value, i) => <div key={i}><div style={{ fontSize: 36, color: i < 2 ? accentOnCard : readableTextOn('#FFFFFF', c.dark, 3), fontWeight: 300, ...textClamp(1) }}>{value}</div><div style={{ height: 10, background: c.line, borderRadius: 999, margin: '8px 0' }}><div style={{ width: value, height: '100%', borderRadius: 999, background: i < 2 ? accentOnCard : c.dark }} /></div><div style={{ fontSize: 12, color: cardMuted, ...textClamp(2) }}>{bullets[i] || '성과 지표'}</div></div>)}</div>
    </div>
  );
}

function ProposalGraph({ bullets, c }) {
  const accentText = readableTextOn(c.accent, SAFE_TEXT_LIGHT);
  const graphInk = visibleColorOn('#FFFFFF', c.dark, SAFE_DARK);
  const barMuted = visibleColorOn('#FFFFFF', c.neutral, c.dark);
  const lineAccent = visibleColorOn('#FFFFFF', c.accent, c.dark);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '36% 1fr', gap: 34, height: '100%', alignItems: 'center' }}>
      <div style={{ background: c.accent, color: accentText, borderRadius: 12, padding: 28, overflow: 'hidden' }}><div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, ...textClamp(1) }}>경험 기반 전략</div><div style={{ fontSize: 13, lineHeight: 1.65, ...textClamp(6) }}>{bullets[0] || '경험정리를 바탕으로 직무 적합성을 선명하게 제시합니다.'}</div></div>
      <div style={{ position: 'relative', height: 250, borderBottom: `2px solid ${graphInk}` }}>{[0, 1, 2, 3, 4].map((_, i) => <div key={i} style={{ position: 'absolute', left: 40 + i * 92, bottom: 0, width: 42, height: 50 + i * 35, background: i > 1 ? graphInk : barMuted }} />)}<svg viewBox="0 0 520 250" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}><polyline points="60,200 155,175 250,110 345,72 440,45" fill="none" stroke={lineAccent} strokeWidth="4" />{[[60,200],[155,175],[250,110],[345,72],[440,45]].map(([pointX, pointY], i)=><circle key={i} cx={pointX} cy={pointY} r="7" fill="#fff" stroke={lineAccent} strokeWidth="4" />)}</svg></div>
    </div>
  );
}

function ProposalSynergy({ items, c }) {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>{items.slice(0, 4).map((item, i) => { const fill = i === 0 ? c.accent : i === 3 ? c.dark : '#FFFFFF'; return <div key={i} style={{ width: i === 0 || i === 3 ? 130 : 150, height: i === 0 || i === 3 ? 130 : 150, borderRadius: '50%', background: fill, color: readableTextOn(fill, i === 0 || i === 3 ? SAFE_TEXT_LIGHT : c.sub), display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 900, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: 16, ...textClamp(3) }}>{item.heading}</div>; })}</div>;
}

function ProposalVenn({ items, c }) {
  const cardText = readableTextOn('#FFFFFF', c.sub);
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  const darkText = readableTextOn(c.dark, SAFE_TEXT_LIGHT);
  const accentText = readableTextOn(c.accent, SAFE_TEXT_LIGHT);
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateRows: '1fr 58px', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.28fr 1fr', gap: 18, alignItems: 'center', minHeight: 0 }}>
        <div style={{ minHeight: 150, borderRadius: 12, background: '#FFFFFF', color: cardText, padding: 18, boxShadow: '0 16px 34px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
          <div style={{ display: 'inline-flex', maxWidth: '100%', padding: '7px 14px', borderRadius: 999, background: c.dark, color: darkText, fontSize: 12, fontWeight: 900, ...textClamp(1) }}>{items[0]?.heading}</div>
          <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.58, color: cardMuted, ...textClamp(5) }}>{items[0]?.body}</div>
        </div>
        <div style={{ position: 'relative', height: 206, alignSelf: 'center' }}>
          <div style={{ position: 'absolute', left: 24, top: 18, width: 150, height: 150, borderRadius: '50%', background: '#FFFFFF', color: cardText, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 14, fontWeight: 900, padding: 22, boxShadow: '0 18px 48px rgba(255,255,255,0.12)', ...textClamp(3) }}>{items[0]?.heading || '후보자 강점'}</div>
          <div style={{ position: 'absolute', right: 24, top: 18, width: 150, height: 150, borderRadius: '50%', background: '#FFFFFF', color: cardText, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 14, fontWeight: 900, padding: 22, boxShadow: '0 18px 48px rgba(255,255,255,0.12)', ...textClamp(3) }}>{items[1]?.heading || '기업 니즈'}</div>
          <div style={{ position: 'absolute', left: '50%', top: 72, transform: 'translateX(-50%)', width: 94, height: 48, borderRadius: 999, background: c.accent, color: accentText, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 11, fontWeight: 900, boxShadow: '0 10px 28px rgba(0,0,0,0.2)' }}>교집합</div>
        </div>
        <div style={{ minHeight: 150, borderRadius: 12, background: '#FFFFFF', color: cardText, padding: 18, boxShadow: '0 16px 34px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
          <div style={{ display: 'inline-flex', maxWidth: '100%', padding: '7px 14px', borderRadius: 999, background: c.dark, color: darkText, fontSize: 12, fontWeight: 900, ...textClamp(1) }}>{items[1]?.heading}</div>
          <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.58, color: cardMuted, ...textClamp(5) }}>{items[1]?.body}</div>
        </div>
      </div>
      <div style={{ borderRadius: 8, background: c.accent, color: accentText, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 28px', fontSize: 14, fontWeight: 900, ...textClamp(2) }}>{items[2]?.body || '강점과 요구사항이 만나는 지점에서 실행 가능한 해답을 제시합니다'}</div>
    </div>
  );
}

function ProposalStairs({ items, c }) {
  const visible = items.slice(0, 5);
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, visible.length)}, 1fr)`, gap: 10, height: '100%', alignItems: 'end' }}>{visible.map((item, i) => { const fill = i === visible.length - 1 ? c.accent : i < 2 ? c.neutral : c.dark; const fg = readableTextOn(fill, SAFE_TEXT_LIGHT); return <div key={i} style={{ height: 116 + i * 22, minHeight: 0, background: fill, color: fg, borderRadius: '12px 12px 0 0', padding: '16px 14px', display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 10, overflow: 'hidden', boxShadow: '0 14px 28px rgba(0,0,0,0.16)' }}><div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>{String(i + 1).padStart(2, '0')}</div><div style={{ fontWeight: 900, fontSize: 14, lineHeight: 1.25, ...textClamp(2) }}>{item.heading}</div><div style={{ fontSize: 10.5, lineHeight: 1.42, opacity: 0.9, ...textClamp(5) }}>{item.body}</div></div>; })}</div>;
}

function ProposalTable({ rows, c }) {
  return <div style={{ display: 'grid', gridTemplateRows: `repeat(${Math.max(1, rows.length)}, 1fr)`, height: '100%', borderRadius: 14, overflow: 'hidden' }}>{rows.map((row, rowIndex) => <div key={rowIndex} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.7fr 1.7fr' }}>{row.map((cell, colIndex) => { const fill = rowIndex === 0 ? (colIndex < 2 ? c.dark : c.accent) : colIndex < 2 ? '#FFFFFF' : colIndex === 2 ? c.accent : c.dark; return <div key={colIndex} style={{ background: fill, color: rowIndex === 0 || colIndex >= 2 ? readableTextOn(fill, SAFE_TEXT_LIGHT) : mutedTextOn(fill, c.muted), borderBottom: '1px solid rgba(255,255,255,0.22)', padding: '10px 12px', fontSize: 11, display: 'grid', placeItems: 'center', textAlign: 'center', ...fitText(3) }}>{cell}</div>; })}</div>)}</div>;
}

function ProposalOrbit({ items, c }) {
  const cardText = readableTextOn('#FFFFFF', c.sub);
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  return <div style={{ position: 'relative', height: '100%' }}><div style={{ position: 'absolute', left: '50%', top: '48%', transform: 'translate(-50%,-50%)', width: 230, height: 230, borderRadius: '50%', background: c.dark, display: 'grid', placeItems: 'center', color: readableTextOn(c.dark, SAFE_TEXT_LIGHT), fontWeight: 900 }}><div style={{ width: 118, height: 118, borderRadius: '50%', background: c.accent, color: readableTextOn(c.accent, SAFE_TEXT_LIGHT), display: 'grid', placeItems: 'center', textAlign: 'center', padding: 12, ...textClamp(3) }}>{items[1]?.heading || '공동 목표'}</div></div>{items.slice(0, 4).map((item, i) => <div key={i} style={{ position: 'absolute', left: [60, 610, 115, 690][i] || 100, top: [70, 70, 250, 250][i] || 80, width: 180, padding: 16, borderRadius: 12, background: '#FFFFFF', color: cardText, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', overflow: 'hidden' }}><div style={{ fontWeight: 900, ...textClamp(2) }}>{item.heading}</div><div style={{ marginTop: 8, fontSize: 11, color: cardMuted, lineHeight: 1.5, ...textClamp(3) }}>{item.body}</div></div>)}</div>;
}

function ProposalCaseGrid({ items, c }) {
  const pageText = readableTextOn(c.dark, SAFE_TEXT_LIGHT);
  return <div style={{ display: 'grid', gridTemplateColumns: '38% 1fr', gap: 24, height: '100%' }}><div style={{ color: pageText, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><div style={{ fontSize: 17, lineHeight: 1.6, ...textClamp(8) }}>{items[0]?.body}</div></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{items.slice(0, 4).map((item, i) => { const fill = i === 2 ? c.accent : i === 0 ? '#FFFFFF' : c.dark2; return <div key={i} style={{ borderRadius: 10, background: fill, color: readableTextOn(fill, i === 0 ? c.sub : SAFE_TEXT_LIGHT), padding: 20, overflow: 'hidden' }}><div style={{ fontSize: 17, fontWeight: 900, ...textClamp(2) }}>{item.heading}</div><div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, opacity: 0.88, ...textClamp(4) }}>{item.body}</div></div>; })}</div></div>;
}

function ProposalTestimonials({ bullets, c }) {
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  const accentOnCard = visibleColorOn('#FFFFFF', c.accent, c.dark);
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, height: '100%', alignItems: 'center' }}>{bullets.slice(0, 3).map((bullet, i) => { const badgeFill = i === 0 ? c.accent : c.dark; return <div key={i} style={{ borderRadius: 12, background: '#FFFFFF', padding: 24, minHeight: 210, textAlign: 'center', overflow: 'hidden' }}><div style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, background: badgeFill, color: readableTextOn(badgeFill, SAFE_TEXT_LIGHT), fontSize: 10, fontWeight: 900 }}>{i === 0 ? 'SURVEY' : `INTERVIEW ${i}`}</div><div style={{ margin: '22px auto', width: 70, height: 70, borderRadius: '50%', background: c.line }} /><div style={{ color: accentOnCard, fontSize: 12, fontWeight: 900, ...textClamp(2) }}>#{bullet}</div><p style={{ fontSize: 12, color: cardMuted, lineHeight: 1.6, ...textClamp(3) }}>경험 정리 기반으로 확인된 주요 강점입니다.</p></div>; })}</div>;
}

function ProposalConditionGrid({ items, c }) {
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, items.length)}, 1fr)`, gap: 10, height: '100%' }}>{items.slice(0, 4).map((item, i) => { const fill = i === 0 || i === 3 ? c.accent : i === 1 ? c.dark : c.neutral; return <div key={i} style={{ display: 'grid', gridTemplateRows: '48% 1fr', borderRadius: 10, overflow: 'hidden', background: '#FFFFFF' }}><div style={{ background: fill, color: readableTextOn(fill, SAFE_TEXT_LIGHT), display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 16, fontWeight: 900, padding: 14, ...textClamp(3) }}>{item.heading}</div><div style={{ padding: 18, fontSize: 12, color: cardMuted, lineHeight: 1.7, textAlign: 'center', ...textClamp(6) }}>{item.body}</div></div>; })}</div>;
}

function ProposalCriteria({ items, c }) {
  const pageText = readableTextOn(c.bg, c.sub);
  const pageMuted = mutedTextOn(c.bg, c.muted);
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 50px', height: '100%', alignItems: 'center' }}>{items.slice(0, 4).map((item, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 18, alignItems: 'center' }}><div style={{ width: 72, height: 72, borderRadius: '50%', border: `8px solid ${visibleColorOn(c.bg, i % 2 ? c.dark : c.accent, c.dark)}`, background: '#FFFFFF' }} /><div><div style={{ fontSize: 18, fontWeight: 900, color: pageText, ...textClamp(2) }}>{item.heading}</div><div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: pageMuted, ...textClamp(3) }}>{item.body}</div></div></div>)}</div>;
}

function ProposalGantt({ items, c }) {
  const headers = ['단계', '일정', 'Week 1', 'Week 2-3', 'Week 3-5', 'Week 5-6'];
  const gridMuted = mutedTextOn('#FFFFFF', c.muted);
  return <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1.2fr 1.9fr repeat(4, 1fr)', gridTemplateRows: `44px repeat(${items.length}, 1fr)`, borderTop: `1px solid ${c.muted}`, borderLeft: `1px solid ${c.muted}` }}>{headers.map((header, i) => <div key={header} style={{ gridColumn: i + 1, gridRow: 1, borderRight: `1px solid ${c.line}`, borderBottom: `1px solid ${c.muted}`, display: 'grid', placeItems: 'center', color: gridMuted, fontSize: 12 }}>{header}</div>)}{items.map((item, rowIndex) => <div key={rowIndex} style={{ display: 'contents' }}>{[item.heading, item.body, '', '', '', ''].map((cell, colIndex) => { const fill = colIndex === 0 ? c.neutral : '#FFFFFF'; return <div key={colIndex} style={{ gridColumn: colIndex + 1, gridRow: rowIndex + 2, borderRight: `1px solid ${c.line}`, borderBottom: `1px solid ${c.muted}`, padding: 10, fontSize: 11, color: colIndex === 0 ? readableTextOn(fill, SAFE_TEXT_LIGHT) : gridMuted, background: fill, position: 'relative', ...fitText(3) }}>{cell}{colIndex === rowIndex + 2 && <span style={{ position: 'absolute', left: 10, right: 10, top: '45%', height: 14, borderRadius: 999, background: visibleColorOn('#FFFFFF', rowIndex % 2 ? c.dark : c.accent, c.dark) }} />}</div>; })}</div>)}</div>;
}

function ProposalStageCards({ items, c }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 8, height: '100%', alignItems: 'center' }}>{items.slice(0, 5).map((item, i) => { const fill = i === items.length - 1 ? c.accent : i < 2 ? c.neutral : c.dark; return <div key={i} style={{ height: 210, borderRadius: 12, background: fill, color: readableTextOn(fill, SAFE_TEXT_LIGHT), padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}><div style={{ fontSize: 17, fontWeight: 900, ...textClamp(2) }}>{item.heading}</div><div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.45, opacity: 0.9, ...textClamp(5) }}>{item.body}</div></div>; })}</div>;
}

function ProposalPyramid({ items, c }) {
  const cardText = readableTextOn('#FFFFFF', c.sub);
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  return <div style={{ display: 'grid', gridTemplateColumns: '38% 1fr', gap: 36, height: '100%', alignItems: 'center' }}><div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 4 }}>{items.slice(0, 3).map((item, i) => { const fill = i === 2 ? c.accent : c.dark; return <div key={i} style={{ margin: '0 auto', width: `${90 - i * 22}%`, height: 82, clipPath: 'polygon(12% 0, 88% 0, 100% 100%, 0 100%)', background: fill, color: readableTextOn(fill, SAFE_TEXT_LIGHT), display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 900, padding: 14, ...textClamp(2) }}>{item.heading}</div>; })}</div><div style={{ display: 'grid', gap: 14 }}>{items.slice(0, 3).map((item, i) => <div key={i} style={{ background: '#FFFFFF', borderRadius: 12, padding: 20, overflow: 'hidden' }}><div style={{ fontSize: 17, fontWeight: 900, color: cardText, ...textClamp(2) }}>{item.body}</div><div style={{ marginTop: 6, fontSize: 12, color: cardMuted, ...textClamp(1) }}>경험정리 기반으로 도출된 지향점</div></div>)}</div></div>;
}

function ProposalPromise({ bullets, c }) {
  const pageText = readableTextOn(c.bg, c.sub);
  const pageMuted = mutedTextOn(c.bg, c.muted);
  return <div style={{ display: 'grid', gridTemplateColumns: '46% 1fr', gap: 36, height: '100%', alignItems: 'center' }}><div style={{ position: 'relative', height: 285 }}><div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: c.line }} /><div style={{ position: 'absolute', left: 42, top: 30, width: 210, height: 210, borderRadius: '50%', background: c.neutral }} /><div style={{ position: 'absolute', right: 38, top: 12, width: 110, height: 110, borderRadius: '50%', background: c.accent, color: readableTextOn(c.accent, SAFE_TEXT_LIGHT), display: 'grid', placeItems: 'center', textAlign: 'center', padding: 12 }}>키워드</div></div><div style={{ display: 'grid', gap: 20 }}>{bullets.slice(0, 3).map((bullet, i) => <div key={i}><div style={{ fontSize: 18, fontWeight: 900, color: pageText, ...textClamp(2) }}>{bullet}</div><div style={{ marginTop: 8, fontSize: 12, color: pageMuted, lineHeight: 1.5, ...textClamp(2) }}>경험 기반 수행을 통해 안정적인 결과를 지원합니다.</div></div>)}</div></div>;
}

function ProposalBudget({ items, c }) {
  const cardText = readableTextOn('#FFFFFF', c.sub);
  const accentOnCard = visibleColorOn('#FFFFFF', c.accent, c.dark);
  return <div style={{ display: 'grid', gridTemplateColumns: '58% 1fr', gap: 22, height: '100%', alignItems: 'center' }}><div style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>{items.slice(0, 4).map((item, i) => <div key={i} style={{ overflow: 'hidden' }}><div style={{ fontSize: 34, color: i === 0 ? accentOnCard : i === 1 ? visibleColorOn('#FFFFFF', c.dark, SAFE_DARK) : visibleColorOn('#FFFFFF', c.neutral, c.dark), fontWeight: 300, ...textClamp(1) }}>{item.heading}</div><div style={{ fontSize: 15, fontWeight: 900, color: cardText, ...textClamp(2) }}>{item.body}</div></div>)}</div><div style={{ width: 260, height: 260, borderRadius: '50%', background: `conic-gradient(${accentOnCard} 0 45%, ${c.dark} 45% 80%, ${visibleColorOn('#FFFFFF', c.neutral, c.dark)} 80% 100%)`, display: 'grid', placeItems: 'center' }}><div style={{ width: 105, height: 105, borderRadius: '50%', background: '#FFFFFF', display: 'grid', placeItems: 'center', color: accentOnCard, fontWeight: 900 }}>Budget</div></div></div>;
}

function ProposalRisk({ items, c }) {
  const cardText = readableTextOn('#FFFFFF', c.sub);
  const cardMuted = mutedTextOn('#FFFFFF', c.muted);
  return <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 22, height: '100%' }}><div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12 }}>{items.map((item, i) => { const badgeFill = i === 2 ? c.accent : c.dark; return <div key={i} style={{ background: '#FFFFFF', borderRadius: 10, padding: 20, textAlign: 'center', overflow: 'hidden' }}><div style={{ display: 'inline-block', padding: '5px 10px', borderRadius: 999, background: badgeFill, color: readableTextOn(badgeFill, SAFE_TEXT_LIGHT), fontSize: 10, fontWeight: 900 }}>RISK {i + 1}</div><div style={{ marginTop: 14, fontSize: 17, fontWeight: 900, color: cardText, ...textClamp(2) }}>{item.heading}</div><div style={{ marginTop: 10, fontSize: 12, color: cardMuted, ...textClamp(2) }}>{item.body}</div></div>; })}</div><div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 12 }}>{items.map((item, i) => { const fill = i === 2 ? c.accent : c.dark; return <div key={i} style={{ background: fill, color: readableTextOn(fill, SAFE_TEXT_LIGHT), borderRadius: 10, padding: 24, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 13, lineHeight: 1.5, ...textClamp(4) }}>해당 리스크에 대한 구체적인 대응 전략과 실행 방안을 작성</div>; })}</div></div>;
}

function renderProposalExperience(slide, t, isDark) {
  const c = t.colors;
  const pageBg = isDark ? c.dark : c.bg;
  const pageText = readableTextOn(pageBg, isDark ? SAFE_TEXT_LIGHT : c.sub);
  const pageMuted = mutedTextOn(pageBg, isDark ? SAFE_MUTED_LIGHT : c.muted);
  const accentText = readableTextOn(c.accent, SAFE_TEXT_LIGHT);
  const cardText = readableTextOn(c.card, c.sub);
  const darkText = readableTextOn(c.dark, SAFE_TEXT_LIGHT);
  const accentOnCard = visibleColorOn(c.card, c.accent, c.dark);
  const item = (slide.items || [])[0] || {};
  const det = slide.details || {};
  const metric = slide.highlight_metric || (item.metrics || [])[0];
  const metricText = metric ? (metric.before && metric.after ? `${metric.before} → ${metric.after}` : metric.value) : '';
  const groups = [
    { title: '문제 정의', items: det.problem || [] },
    { title: '해결 과정', items: det.action || item.bullets || [] },
    { title: '성과', items: det.result || [] },
  ].filter(g => g.items.length);

  if (isDark) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px 1fr', gap: 28, alignItems: 'center', height: '100%' }}>
        <div>
          <div style={{ color: pageText, fontSize: 54, fontWeight: 300, lineHeight: 1, ...textClamp(1) }}>{metricText || 'Impact'}</div>
          <div style={{ color: pageText, fontSize: 17, fontWeight: 900, marginTop: 8, ...textClamp(2) }}>{metric?.label || item.heading}</div>
          <div style={{ color: pageMuted, fontSize: 12, lineHeight: 1.5, marginTop: 10, ...textClamp(4) }}>{item.body}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 106, borderRadius: 8, background: i === 2 ? c.accent : '#FFFFFF', opacity: i === 2 ? 1 : 0.86 }} />)}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: pageText, fontSize: 54, fontWeight: 300, lineHeight: 1, ...textClamp(1) }}>{(item.metrics || [])[1]?.value || 'Growth'}</div>
          <div style={{ color: pageText, fontSize: 17, fontWeight: 900, marginTop: 8, ...textClamp(2) }}>{(item.metrics || [])[1]?.label || '핵심 결과'}</div>
          <div style={{ color: pageMuted, fontSize: 12, lineHeight: 1.5, marginTop: 10, ...textClamp(2) }}>{item.role || item.period}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'stretch', height: '100%' }}>
      <div style={{ background: c.accent, color: accentText, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.25, ...textClamp(3) }}>{item.heading || slide.title}</div>
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, ...textClamp(2) }}>{item.period || item.role}</div>
        </div>
        {metric ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.9, ...textClamp(2) }}>{metric.label}</div>
            <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1.05, marginTop: 4, ...textClamp(2) }}>{metricText}</div>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, groups.length)}, 1fr)`, gap: 12 }}>
        {groups.map((group, i) => (
          <div key={group.title} style={{ background: i === groups.length - 1 ? c.dark : c.card, color: i === groups.length - 1 ? darkText : cardText, borderRadius: 12, padding: 20, boxShadow: '0 6px 24px rgba(20,20,20,0.05)', overflow: 'hidden' }}>
            <div style={{ color: i === groups.length - 1 ? visibleColorOn(c.dark, c.accent, SAFE_TEXT_LIGHT) : accentOnCard, fontSize: 13, fontWeight: 900, marginBottom: 12 }}>{group.title}</div>
            {group.items.slice(0, 4).map((line, j) => (
              <div key={j} style={{ fontSize: 12, lineHeight: 1.55, marginBottom: 8, opacity: 0.9, ...textClamp(3) }}>{line}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}



function renderCover(slide, t) {
  const c = t.colors;
  const isCover = slide.layout === 'cover';
  if (t.style === 'document') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: c.bg }}>
        {/* 상단 가는 라인 */}
        <div style={{ position: 'absolute', left: 80, right: 80, top: 70, height: 1, background: c.line }} />
        {/* 좌측 액센트 반원 */}
        <div style={{ position: 'absolute', left: -50, top: '40%', transform: 'translateY(-50%)', width: 130, height: 130, borderRadius: '50%', background: c.accent }} />
        {/* 타이틀 */}
        <div style={{ position: 'absolute', left: 100, top: 130, right: 100 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: isCover ? 76 : 56, fontWeight: 900, color: c.titleColor || c.accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {slide.title || ' '}
          </div>
          {slide.subtitle && (
            <div style={{ marginTop: 28, fontFamily: t.fonts.heading, fontSize: 36, fontWeight: 700, color: '#1F2937', lineHeight: 1.25 }}>
              {slide.subtitle}
            </div>
          )}
        </div>
        {/* 하단 발표자 바 (cover 전용) */}
        {isCover && (
          <div style={{ position: 'absolute', left: 80, right: 80, bottom: 50, padding: '14px 20px', background: c.footerBg, display: 'flex', alignItems: 'center', gap: 22, fontSize: 14, color: c.footerFg }}>
            {(t.presenter?.name || t.presenter?.affiliation) ? (
              <>
                {t.presenter?.name && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ width: 3, height: 16, background: c.accent }} />
                    <span style={{ fontWeight: 700 }}>발표자 ·</span>
                    <span>{t.presenter.name}</span>
                  </div>
                )}
                {t.presenter?.affiliation && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ width: 3, height: 16, background: c.accent }} />
                    <span style={{ fontWeight: 700 }}>학과 및 학번 ·</span>
                    <span>{t.presenter.affiliation}</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: c.muted, fontSize: 12 }}>Portfolio</div>
            )}
          </div>
        )}
      </div>
    );
  }
  if (t.style === 'centered') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: c.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 80px', textAlign: 'center' }}>
        <div style={{ width: 120, height: 1, background: c.line, marginBottom: 24 }} />
        <div style={{ fontFamily: t.fonts.heading, fontSize: isCover ? 56 : 44, fontWeight: 700, color: c.accent, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{slide.title || ' '}</div>
        {slide.subtitle ? <div style={{ marginTop: 22, fontSize: 18, color: c.sub, fontStyle: 'italic' }}>{slide.subtitle}</div> : null}
        <div style={{ width: 120, height: 1, background: c.line, marginTop: 24 }} />
      </div>
    );
  }
  if (t.style === 'block') {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ width: '45%', background: c.side, color: c.sideFg, display: 'flex', alignItems: 'flex-end', padding: 60, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 60, left: 60, fontSize: 80, fontWeight: 900, opacity: 0.2 }}>P</div>
          <div style={{ fontFamily: t.fonts.heading, fontSize: isCover ? 50 : 40, fontWeight: 900, lineHeight: 1.1 }}>{slide.title || ' '}</div>
        </div>
        <div style={{ flex: 1, padding: '60px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {slide.subtitle ? <div style={{ fontSize: 20, color: c.sub, lineHeight: 1.5 }}>{slide.subtitle}</div> : null}
        </div>
      </div>
    );
  }
  // modern
  return (
    <div style={{ position: 'absolute', inset: 0, background: c.side, color: c.sideFg, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px' }}>
      <div style={{ width: 60, height: 4, background: c.sideFg, marginBottom: 32, opacity: 0.5 }} />
      <div style={{ fontFamily: t.fonts.heading, fontSize: isCover ? 56 : 44, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{slide.title || ' '}</div>
      {slide.subtitle ? <div style={{ marginTop: 20, fontSize: 20, opacity: 0.85 }}>{slide.subtitle}</div> : null}
    </div>
  );
}

// ── Document: layoutHint에 따라 sidebar / header / minimal 분기 ──
function renderDocument(slide, t, index) {
  const c = t.colors;
  const hint = t.layoutHint || 'header-top';
  const sideColor = c.side || c.accent;
  const sideFg = c.sideFg || '#FFFFFF';

  if (hint === 'sidebar-left' || hint === 'sidebar-right') {
    const isLeft = hint === 'sidebar-left';
    const SIDE_W = 240;
    return (
      <>
        <div style={{ position: 'absolute', top: 0, bottom: 0, [isLeft ? 'left' : 'right']: 0, width: SIDE_W, background: sideColor, color: sideFg, padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.2em' }}>{String(index + 1).padStart(2, '0')}</div>
            <div style={{ width: 32, height: 3, background: c.accent2 || sideFg, opacity: 0.85, margin: '14px 0 18px' }} />
            <div style={{ fontFamily: t.fonts.heading, fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>{slide.title || ' '}</div>
            {slide.subtitle && <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>{slide.subtitle}</div>}
          </div>
          <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{slide.layout}</div>
        </div>
        <div style={{ position: 'absolute', top: 50, bottom: 50, [isLeft ? 'left' : 'right']: SIDE_W + 50, [isLeft ? 'right' : 'left']: 50 }}>
          {renderBody(slide, t, 'document')}
        </div>
      </>
    );
  }

  if (hint === 'header-top' || hint === 'block') {
    return (
      <>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 110, background: sideColor, display: 'flex', alignItems: 'center', padding: '0 56px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: sideFg, opacity: 0.7, letterSpacing: '0.18em', marginBottom: 4 }}>{String(index + 1).padStart(2, '0')}</div>
            <div style={{ fontFamily: t.fonts.heading, fontSize: 30, fontWeight: 800, color: sideFg, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{slide.title || ' '}</div>
          </div>
          <div style={{ width: 4, height: 60, background: c.accent2 || c.accent, opacity: 0.9, marginLeft: 24 }} />
        </div>
        {slide.subtitle && (
          <div style={{ position: 'absolute', left: 56, right: 56, top: 130, fontSize: 16, color: c.sub, lineHeight: 1.4, fontFamily: t.fonts.body }}>{slide.subtitle}</div>
        )}
        <div style={{ position: 'absolute', left: 56, right: 56, top: slide.subtitle ? 175 : 140, bottom: 40 }}>
          {renderBody(slide, t, 'document')}
        </div>
      </>
    );
  }

  // minimal: 색 도형 없는 깔끔한 텍스트 중심 레이아웃
  return (
    <>
      <div style={{ position: 'absolute', left: 64, right: 64, top: 60 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.accent, letterSpacing: '0.2em', marginBottom: 10 }}>{String(index + 1).padStart(2, '0')}</div>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 36, fontWeight: 800, color: c.titleColor || c.accent, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{slide.title || ' '}</div>
        {slide.subtitle && <div style={{ marginTop: 10, fontSize: 17, color: c.sub, lineHeight: 1.4 }}>{slide.subtitle}</div>}
        <div style={{ marginTop: 16, width: 56, height: 3, background: c.accent }} />
      </div>
      <div style={{ position: 'absolute', left: 64, right: 64, top: 180, bottom: 50 }}>
        {renderBody(slide, t, 'document')}
      </div>
    </>
  );
}

function renderDocumentCover(slide, t) {
  const c = t.colors;
  const hint = t.layoutHint || 'block';
  const sideColor = c.side || c.accent;
  const sideFg = c.sideFg || '#FFFFFF';

  if (hint === 'sidebar-right') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: c.bg, display: 'flex' }}>
        <div style={{ flex: 1, padding: '60px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ width: 60, height: 5, background: c.accent, marginBottom: 24 }} />
          <div style={{ fontFamily: t.fonts.heading, fontSize: 50, fontWeight: 900, color: c.titleColor || c.accent, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{slide.title || ' '}</div>
          {slide.subtitle && <div style={{ marginTop: 18, fontSize: 20, color: c.sub, lineHeight: 1.45 }}>{slide.subtitle}</div>}
        </div>
        <div style={{ width: '38%', background: sideColor }} />
      </div>
    );
  }

  if (hint === 'header-top' || hint === 'footer-bottom') {
    const isTop = hint !== 'footer-bottom';
    return (
      <div style={{ position: 'absolute', inset: 0, background: c.bg, display: 'flex', flexDirection: 'column' }}>
        {isTop && <div style={{ height: 90, background: sideColor }} />}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, letterSpacing: '0.25em', marginBottom: 14 }}>PORTFOLIO</div>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 56, fontWeight: 900, color: c.titleColor || c.accent, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{slide.title || ' '}</div>
          {slide.subtitle && <div style={{ marginTop: 22, fontSize: 22, color: c.sub, lineHeight: 1.45 }}>{slide.subtitle}</div>}
          <div style={{ marginTop: 28, width: 80, height: 4, background: c.accent }} />
        </div>
        {!isTop && <div style={{ height: 90, background: sideColor }} />}
      </div>
    );
  }

  if (hint === 'minimal') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: c.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 90px' }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 64, fontWeight: 900, color: c.titleColor || c.accent, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{slide.title || ' '}</div>
        {slide.subtitle && <div style={{ marginTop: 24, fontSize: 24, color: c.sub, lineHeight: 1.4 }}>{slide.subtitle}</div>}
        <div style={{ marginTop: 28, width: 80, height: 4, background: c.accent }} />
      </div>
    );
  }

  // sidebar-left / block 기본
  return (
    <div style={{ position: 'absolute', inset: 0, background: c.bg, display: 'flex' }}>
      <div style={{ width: '42%', background: sideColor, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 60 }}>
        <div style={{ position: 'absolute', top: 50, left: 60, fontSize: 14, fontWeight: 700, color: sideFg, opacity: 0.7, letterSpacing: '0.25em' }}>PORTFOLIO</div>
        <div style={{ width: 60, height: 5, background: c.accent2 || sideFg, opacity: 0.9, marginBottom: 24 }} />
        <div style={{ fontFamily: t.fonts.heading, fontSize: 44, fontWeight: 900, color: sideFg, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{slide.title || ' '}</div>
      </div>
      <div style={{ flex: 1, padding: '60px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {slide.subtitle && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, letterSpacing: '0.2em', marginBottom: 12 }}>SUBTITLE</div>
            <div style={{ fontSize: 22, color: c.sub, lineHeight: 1.45, fontFamily: t.fonts.body }}>{slide.subtitle}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modern: 좌측 다크 사이드바 ─────────────────────────────────
function renderModern(slide, t, index) {
  const c = t.colors;
  const SIDE = 220;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDE, background: c.side, color: c.sideFg, padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: '0.18em' }}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{ width: 30, height: 3, background: c.sideFg, opacity: 0.7, margin: '12px 0 16px' }} />
          <div style={{ fontFamily: t.fonts.heading, fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{slide.title || ' '}</div>
          {slide.subtitle ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>{slide.subtitle}</div> : null}
        </div>
        <div style={{ fontSize: 10, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{slide.layout}</div>
      </div>
      <div style={{ position: 'absolute', left: SIDE + 50, right: 50, top: 50, bottom: 50 }}>
        {renderBody(slide, t, 'modern')}
      </div>
    </>
  );
}

// ── Classic: 중앙 정렬 + 골드 라인 ─────────────────────────────
function renderClassic(slide, t, index) {
  const c = t.colors;
  return (
    <>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 50, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: c.muted, letterSpacing: '0.25em', textTransform: 'uppercase' }}>Chapter {index + 1}</div>
        <div style={{ width: 80, height: 1, background: c.line, margin: '14px auto 8px' }} />
        <div style={{ fontFamily: t.fonts.heading, fontSize: 28, fontWeight: 700, color: c.accent }}>{slide.title || ' '}</div>
        <div style={{ width: 80, height: 1, background: c.line, margin: '8px auto 0' }} />
        {slide.subtitle ? <div style={{ marginTop: 8, fontSize: 14, color: c.sub, fontStyle: 'italic' }}>{slide.subtitle}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 90, right: 90, top: 180, bottom: 60 }}>
        {renderBody(slide, t, 'classic')}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 24, textAlign: 'center', fontSize: 11, color: c.muted, fontFamily: t.fonts.heading }}>— {index + 1} —</div>
    </>
  );
}

// ── Creative: 좌측 컬러 블록 ─────────────────────────────────
function renderCreative(slide, t, index) {
  const c = t.colors;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 280, bottom: 0, background: c.side, color: c.sideFg, padding: 36, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
        <div>
          <div style={{ fontSize: 100, fontWeight: 900, lineHeight: 1, opacity: 0.18 }}>{String(index + 1).padStart(2, '0')}</div>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 26, fontWeight: 900, lineHeight: 1.2, marginTop: 8 }}>{slide.title || ' '}</div>
          {slide.subtitle ? <div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>{slide.subtitle}</div> : null}
        </div>
        <div style={{ width: 60, height: 6, background: c.sideFg, opacity: 0.9 }} />
      </div>
      <div style={{ position: 'absolute', left: 320, right: 50, top: 50, bottom: 50 }}>
        {renderBody(slide, t, 'creative')}
      </div>
    </>
  );
}

// ── 본문(items / bullets / metrics) — 템플릿 변형 인자로 분기 ──────
function renderBody(slide, t, variant) {
  const c = t.colors;
  const items = slide.items || [];
  const bullets = slide.bullets || [];

  // [Phase 3] experience 슬라이드 → layout_type에 따라 합격자 스타일 분기
  if (slide.layout === 'experience' && slide.layout_type && slide.details) {
    const fancy = renderExperienceLayout(slide, t, variant);
    if (fancy) return fancy; // null 반환 시 STACK_LIST → 아래 items 렌더링으로 폴스루
  }

  const itemBox = (it, idx) => {
    const metrics = Array.isArray(it.metrics) ? it.metrics.filter(m => m.value || m.label) : [];
    let header, headBg, body;
    if (variant === 'classic') {
      header = (
        <div style={{ borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}`, padding: '8px 0', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 16, fontWeight: 700, color: c.accent }}>{it.heading || ''}</div>
          <div style={{ fontSize: 11, color: c.muted, fontStyle: 'italic' }}>{it.period || ''}</div>
        </div>
      );
    } else if (variant === 'creative') {
      header = (
        <div style={{ background: c.line, padding: '8px 12px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 16, fontWeight: 800, color: c.accent }}>{it.heading || ''}</div>
          <div style={{ fontSize: 11, color: c.accent, fontWeight: 600 }}>{it.period || ''}</div>
        </div>
      );
    } else if (variant === 'document') {
      header = (
        <div style={{ borderLeft: `4px solid ${c.accent}`, paddingLeft: 16, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 20, fontWeight: 800, color: c.titleColor || c.accent, lineHeight: 1.25 }}>{it.heading || ''}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.sub, whiteSpace: 'nowrap' }}>{it.period || ''}</div>
        </div>
      );
    } else {
      header = (
        <div style={{ borderLeft: `3px solid ${c.accent}`, paddingLeft: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontFamily: t.fonts.heading, fontSize: 16, fontWeight: 700, color: c.accent }}>{it.heading || ''}</div>
            <div style={{ fontSize: 11, color: c.muted, whiteSpace: 'nowrap' }}>{it.period || ''}</div>
          </div>
        </div>
      );
    }
    const padLeft = variant === 'modern' ? 17 : 0;
    return (
      <div key={idx} style={{ marginBottom: 14 }}>
        {header}
        <div style={{ paddingLeft: padLeft, marginTop: 6 }}>
          {it.role ? <div style={{ fontSize: 11, color: c.sub, fontWeight: 600 }}>{it.role}</div> : null}
          {it.body ? <div style={{ fontSize: 12, color: c.sub, marginTop: 4, lineHeight: 1.5 }}>{it.body}</div> : null}
          {Array.isArray(it.bullets) && it.bullets.length > 0 ? (
            <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none' }}>
              {it.bullets.slice(0, 3).map((b, j) => (
                <li key={j} style={{ fontSize: 12, color: c.sub, lineHeight: 1.5, paddingLeft: 12, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, top: 7, width: 4, height: 4, background: c.accent, borderRadius: variant === 'classic' ? 0 : '50%' }} />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
          {metrics.length > 0 ? <MetricRow metrics={metrics} t={t} variant={variant} /> : null}
        </div>
      </div>
    );
  };

  if (items.length > 0) {
    return <div style={{ height: '100%', overflow: 'hidden' }}>{items.slice(0, 2).map(itemBox)}</div>;
  }

  // bullets only
  if (bullets.length > 0) {
    if (variant === 'document') {
      return (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {bullets.slice(0, 7).map((b, i) => (
            <li key={i} style={{ fontSize: 17, color: c.sub, lineHeight: 1.55, paddingLeft: 22, position: 'relative', fontFamily: t.fonts.body }}>
              <span style={{ position: 'absolute', left: 0, top: 9, width: 8, height: 8, background: c.accent, borderRadius: '50%' }} />
              {b}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bullets.slice(0, 7).map((b, i) => (
          <li key={i} style={{ fontSize: 15, color: c.sub, lineHeight: 1.55, paddingLeft: 22, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 9, width: variant === 'classic' ? 14 : 8, height: variant === 'classic' ? 1 : 8, background: c.accent, borderRadius: variant === 'classic' ? 0 : '50%' }} />
            {b}
          </li>
        ))}
      </ul>
    );
  }

  return <div style={{ color: c.muted, fontSize: 14 }}>(내용 없음)</div>;
}

function MetricRow({ metrics, t, variant }) {
  const c = t.colors;
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      {metrics.slice(0, 3).map((m, i) => {
        const hasArrow = m.before && m.after;
        if (variant === 'classic') {
          return (
            <div key={i} style={{ border: `1px solid ${c.line}`, padding: '6px 10px', minWidth: 90 }}>
              <div style={{ fontSize: 9, color: c.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{m.label}</div>
              <div style={{ fontFamily: t.fonts.heading, fontSize: 14, fontWeight: 700, color: c.kpi, marginTop: 2 }}>
                {hasArrow ? `${m.before} → ${m.after}` : m.value}
              </div>
            </div>
          );
        }
        if (variant === 'creative') {
          return (
            <div key={i} style={{ background: c.kpi, color: '#fff', padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ opacity: 0.85 }}>{m.label}</span>
              <span>{hasArrow ? `${m.before}→${m.after}` : m.value}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ background: '#F8FAFC', border: `1px solid ${c.line}`, padding: '6px 10px', borderRadius: 6, minWidth: 90 }}>
            <div style={{ fontSize: 9, color: c.muted }}>{m.label}</div>
            <div style={{ fontFamily: t.fonts.heading, fontSize: 13, fontWeight: 800, color: c.kpi, marginTop: 1 }}>
              {hasArrow ? `${m.before} → ${m.after}` : m.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// [Phase 2] 동적 레이아웃 엔진 — 합격자 PPT 스타일 헬퍼
// =====================================================================

// 텍스트 길이로 적정 폰트 크기 계산 (글이 짧으면 키우고, 길면 줄임)
// baseSize: 기본 px, minSize/maxSize: 클램프 범위
function dynamicFontPx(text, baseSize, { min = 11, max = 28 } = {}) {
  const len = String(text || '').replace(/\s+/g, ' ').trim().length;
  if (len === 0) return baseSize;
  // 24자 이하면 max에 가깝게, 80자 이상이면 min에 가깝게 (선형 보간)
  if (len <= 24) return Math.min(max, Math.round(baseSize * 1.15));
  if (len >= 80) return Math.max(min, Math.round(baseSize * 0.78));
  const t = (len - 24) / 56;
  return Math.round(baseSize * (1.15 - t * 0.37));
}

// 텍스트 배열의 예상 높이(px). 글자수/박스폭 기반으로 줄 수 계산.
function estimateBlockHeightPx(lines, fontSize, boxW, lineHeight = 1.5) {
  const charW = fontSize * 0.58; // 한글/영문 평균 글자폭
  const charsPerLine = Math.max(1, Math.floor(boxW / charW));
  let total = 0;
  for (const ln of (lines || [])) {
    const len = String(ln || '').length;
    const rows = Math.max(1, Math.ceil(len / charsPerLine));
    total += rows * fontSize * lineHeight;
  }
  return total;
}

// [Phase 3] experience 슬라이드 — layout_type별 React 미리보기
function renderExperienceLayout(slide, t, variant) {
  const c = t.colors;
  const layoutType = slide.layout_type;
  const hm = slide.highlight_metric;
  const det = slide.details || {};
  const item = (slide.items || [])[0] || {};

  const hmDisplay = hm
    ? (hm.before && hm.after ? `${hm.before} → ${hm.after}` : (hm.value || ''))
    : '';

  // ── CENTER_METRIC: 중앙에 거대한 지표, 아래 짧은 설명 ──
  if (layoutType === 'CENTER_METRIC' && hm) {
    const summary = [...(det.problem || []), ...(det.action || []), ...(det.result || [])].slice(0, 2);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.muted, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{hm.label || 'KEY METRIC'}</div>
        <div style={{ fontFamily: t.fonts.heading, fontSize: dynamicFontPx(hmDisplay, 60, { min: 36, max: 84 }), fontWeight: 900, color: c.kpi, lineHeight: 1.05, marginTop: 14, letterSpacing: '-0.02em' }}>
          {hmDisplay}
        </div>
        <div style={{ width: 80, height: 4, background: c.accent, marginTop: 18 }} />
        <div style={{ marginTop: 18, fontSize: 15, color: c.sub, lineHeight: 1.55, maxWidth: 560 }}>
          {summary.join(' · ')}
        </div>
      </div>
    );
  }

  // ── SPLIT_HALF: 좌측 핵심 지표 + 우측 STAR auto-Y ──
  if (layoutType === 'SPLIT_HALF') {
    const sections = [
      { key: 'problem', label: 'Problem', items: det.problem || [] },
      { key: 'action', label: 'Action', items: det.action || [] },
      { key: 'result', label: 'Result', items: det.result || [] },
    ].filter(s => s.items.length);
    return (
      <div style={{ height: '100%', display: 'flex', gap: 28 }}>
        {/* 좌측: 프로젝트명 + 큰 지표 */}
        <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: dynamicFontPx(item.heading, 22, { min: 16, max: 28 }), fontWeight: 800, color: c.accent, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            {item.heading || ''}
          </div>
          {item.period && <div style={{ marginTop: 6, fontSize: 12, color: c.muted }}>{item.period}</div>}
          {hm && (
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `2px solid ${c.line}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.muted, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{hm.label}</div>
              <div style={{ fontFamily: t.fonts.heading, fontSize: dynamicFontPx(hmDisplay, 32, { min: 22, max: 44 }), fontWeight: 900, color: c.kpi, lineHeight: 1.05, marginTop: 6, letterSpacing: '-0.02em' }}>
                {hmDisplay}
              </div>
            </div>
          )}
        </div>
        {/* 우측: STAR auto-stack */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>
          {sections.map(sec => (
            <div key={sec.key}>
              <div style={{ fontSize: 11, fontWeight: 800, color: c.accent, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>{sec.label}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {sec.items.slice(0, 3).map((b, i) => (
                  <li key={i} style={{ fontSize: dynamicFontPx(b, 13, { min: 11, max: 15 }), color: c.sub, lineHeight: 1.5, paddingLeft: 14, position: 'relative', marginBottom: 2 }}>
                    <span style={{ position: 'absolute', left: 0, top: 8, width: 5, height: 5, background: c.accent, borderRadius: '50%' }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── STACK_LIST: 기존 items 렌더링으로 위임 ──
  return null;
}

// =====================================================================
// PptxGenJS 출력
// =====================================================================
export async function exportDeckToPptx(deck, templateOrId, fileName) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 × 7.5 in
  const W = 13.333, H = 7.5;
  const baseTemplate = (templateOrId && typeof templateOrId === 'object') ? templateOrId : getTemplate(templateOrId);
  const t = withPptSafeFonts(baseTemplate);
  const c = t.colors;
  const M = 0.55;

  for (let i = 0; i < (deck.slides || []).length; i += 1) {
    const slide = deck.slides[i];
    const s = pptx.addSlide();
    s.background = { color: hex(c.bg) };

    if (t.style === 'proposal' && t.layoutId && t.layoutId !== 'standard') {
      drawAcceptedPortfolioPptx(s, slide, t, i, W, H);
      if (slide.notes) s.addNotes(slide.notes);
      continue;
    }

    if (slide.layout === 'cover' || slide.layout === 'section') {
      if (t.style === 'proposal') drawProposalCover(s, slide, t, W, H);
      else drawCover(s, slide, t, W, H);
      if (slide.notes) s.addNotes(slide.notes);
      continue;
    }

    if (t.style === 'proposal') drawProposal(s, slide, t, i, W, H, M);
    else if (t.style === 'sidebar') drawModern(s, slide, t, i, W, H, M);
    else if (t.style === 'centered') drawClassic(s, slide, t, i, W, H, M);
    else if (t.style === 'document') drawDocument(s, slide, t, i, W, H, M);
    else drawCreative(s, slide, t, i, W, H, M);

    if (slide.notes) s.addNotes(slide.notes);
  }

  await pptx.writeFile({ fileName: fileName || 'ai_portfolio.pptx' });
}

function drawCover(s, slide, t, W, H) {
  const c = t.colors;
  const isCover = slide.layout === 'cover';
  if (t.style === 'document') {
    const hint = t.layoutHint || 'block';
    const sideColor = c.side || c.accent;
    const sideFg = c.sideFg || '#FFFFFF';
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.bg) }, line: { color: hex(c.bg) } });

    if (hint === 'sidebar-right') {
      s.addShape('rect', { x: W * 0.62, y: 0, w: W * 0.38, h: H, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
      s.addShape('rect', { x: 0.7, y: H / 2 - 1.0, w: 0.7, h: 0.07, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
      s.addText(slide.title || '', { x: 0.7, y: H / 2 - 0.8, w: W * 0.6 - 1.0, h: 2.0, fontFace: t.fonts.heading, fontSize: isCover ? 44 : 34, bold: true, color: hex(c.titleColor || c.accent), fit: 'shrink' });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 0.7, y: H / 2 + 1.0, w: W * 0.6 - 1.0, h: 1.0, fontFace: t.fonts.body, fontSize: 18, color: hex(c.sub), fit: 'shrink' });
      return;
    }
    if (hint === 'header-top' || hint === 'footer-bottom') {
      const isTop = hint !== 'footer-bottom';
      s.addShape('rect', { x: 0, y: isTop ? 0 : H - 1.2, w: W, h: 1.2, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
      const cy = H / 2 - 1.0;
      s.addText('PORTFOLIO', { x: 1.0, y: cy, w: 4, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.accent), charSpacing: 5 });
      s.addText(slide.title || '', { x: 1.0, y: cy + 0.4, w: W - 2.0, h: 1.4, fontFace: t.fonts.heading, fontSize: isCover ? 50 : 40, bold: true, color: hex(c.titleColor || c.accent), fit: 'shrink' });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 1.0, y: cy + 1.9, w: W - 2.0, h: 1.0, fontFace: t.fonts.body, fontSize: 20, color: hex(c.sub), fit: 'shrink' });
      s.addShape('rect', { x: 1.0, y: cy + 2.85, w: 0.8, h: 0.05, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
      return;
    }
    if (hint === 'minimal') {
      s.addText(slide.title || '', { x: 1.1, y: H / 2 - 1.2, w: W - 2.2, h: 1.6, fontFace: t.fonts.heading, fontSize: isCover ? 50 : 40, bold: true, color: hex(c.titleColor || c.accent), fit: 'shrink' });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 1.1, y: H / 2 + 0.4, w: W - 2.2, h: 0.8, fontFace: t.fonts.body, fontSize: 20, color: hex(c.sub), fit: 'shrink' });
      s.addShape('rect', { x: 1.1, y: H / 2 + 1.3, w: 0.8, h: 0.05, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
      return;
    }
    // sidebar-left / block (기본)
    s.addShape('rect', { x: 0, y: 0, w: W * 0.42, h: H, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
    s.addText('PORTFOLIO', { x: 0.7, y: 0.7, w: 4, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(sideFg), transparency: 30, charSpacing: 6 });
    s.addShape('rect', { x: 0.7, y: H - 3.4, w: 0.7, h: 0.07, fill: { color: hex(c.accent2 || sideFg) }, line: { color: hex(c.accent2 || sideFg) } });
    s.addText(slide.title || '', { x: 0.7, y: H - 3.2, w: W * 0.42 - 1.0, h: 2.6, fontFace: t.fonts.heading, fontSize: isCover ? 40 : 32, bold: true, color: hex(sideFg), valign: 'top', fit: 'shrink' });
    if (slide.subtitle) {
      s.addText('SUBTITLE', { x: W * 0.42 + 0.6, y: H / 2 - 0.8, w: 4, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.accent), charSpacing: 5 });
      s.addText(slide.subtitle, { x: W * 0.42 + 0.6, y: H / 2 - 0.4, w: W * 0.58 - 1.2, h: 1.6, fontFace: t.fonts.body, fontSize: 18, color: hex(c.sub), fit: 'shrink' });
    }
    return;
  }
  if (t.style === 'centered') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.bg) }, line: { color: hex(c.bg) } });
    s.addShape('rect', { x: W / 2 - 0.8, y: H / 2 - 1.0, w: 1.6, h: 0.02, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
    s.addText(slide.title || '', { x: 1, y: H / 2 - 0.7, w: W - 2, h: 1.5, fontFace: t.fonts.heading, fontSize: isCover ? 44 : 36, bold: true, color: hex(c.accent), align: 'center', fit: 'shrink' });
    if (slide.subtitle) s.addText(slide.subtitle, { x: 1, y: H / 2 + 0.5, w: W - 2, h: 0.6, fontFace: t.fonts.body, fontSize: 16, italic: true, color: hex(c.sub), align: 'center', fit: 'shrink' });
    s.addShape('rect', { x: W / 2 - 0.8, y: H / 2 + 1.2, w: 1.6, h: 0.02, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
    return;
  }
  if (t.style === 'block') {
    s.addShape('rect', { x: 0, y: 0, w: W * 0.45, h: H, fill: { color: hex(c.side) }, line: { color: hex(c.side) } });
    s.addText(slide.title || '', { x: 0.5, y: H - 2.2, w: W * 0.45 - 1, h: 1.6, fontFace: t.fonts.heading, fontSize: isCover ? 40 : 32, bold: true, color: hex(c.sideFg), fit: 'shrink' });
    if (slide.subtitle) s.addText(slide.subtitle, { x: W * 0.45 + 0.5, y: H / 2 - 0.5, w: W * 0.55 - 1, h: 1.2, fontFace: t.fonts.body, fontSize: 16, color: hex(c.sub), fit: 'shrink' });
    return;
  }
  // modern
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.side) }, line: { color: hex(c.side) } });
  s.addShape('rect', { x: 0.7, y: H / 2 - 1.4, w: 0.6, h: 0.05, fill: { color: hex(c.sideFg) }, line: { color: hex(c.sideFg) } });
  s.addText(slide.title || '', { x: 0.7, y: H / 2 - 1.2, w: W - 1.4, h: 1.6, fontFace: t.fonts.heading, fontSize: isCover ? 40 : 32, bold: true, color: hex(c.sideFg), fit: 'shrink' });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.7, y: H / 2 + 0.5, w: W - 1.4, h: 0.6, fontFace: t.fonts.body, fontSize: 16, color: hex(c.sideFg), fit: 'shrink' });
}

function drawProposalDots(s, colorHex, W, x = 9.0, y = 4.2) {
  for (let row = 0; row < 11; row += 1) {
    for (let col = 0; col < 18; col += 1) {
      if (col < row * 1.25) continue;
      const size = 0.055 + Math.min(row, 6) * 0.006;
      s.addShape('ellipse', {
        x: x + col * 0.13,
        y: y + row * 0.13,
        w: size,
        h: size,
        fill: { color: colorHex, transparency: Math.min(82, col * 4) },
        line: { color: colorHex, transparency: 100 },
      });
    }
  }
}

function drawProposalCoverLegacy(s, slide, t, W, H) {
  const c = t.colors;
  const tags = (slide.bullets && slide.bullets.length ? slide.bullets : ['EXPERIENCE', 'IMPACT', 'SCALABILITY']).slice(0, 3).join(' · ');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.dark) }, line: { color: hex(c.dark) } });
  const accentOnDark = pptVisibleOn(c.dark, c.accent, SAFE_TEXT_LIGHT);
  s.addText('FITPOLY', { x: 0.9, y: 0.78, w: 2.0, h: 0.45, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: accentOnDark });
  s.addText(new Date().toISOString().slice(0, 10).replace(/-/g, '.'), { x: W - 2.2, y: 0.78, w: 1.4, h: 0.25, fontFace: t.fonts.body, fontSize: 8, color: 'CFCFD2', align: 'right' });
  s.addText(slide.subtitle || '경험을 기준으로', { x: 0.9, y: 1.85, w: 6.8, h: 0.55, fontFace: t.fonts.heading, fontSize: 28, color: 'FFFFFF', fit: 'shrink' });
  s.addText(pptProposalTextParts(slide.title || '포트폴리오 솔루션', 'FFFFFF', accentOnDark, { fontFace: t.fonts.heading }), { x: 0.9, y: 2.45, w: 7.0, h: 1.25, fontSize: 34, bold: true, fit: 'shrink' });
  drawProposalDots(s, accentOnDark, W);
  s.addText(tags, { x: 0.9, y: H - 0.92, w: 6.5, h: 0.25, fontFace: t.fonts.body, fontSize: 9, bold: true, color: 'FFFFFF' });
}

function drawAcceptedPortfolioPptx(s, slide, t, i, W, H) {
  const prepared = prepareAcceptedSlide(slide);
  const id = t.layoutId;
  const v = acceptedVisual(t);
  if (id === 'narrative') return drawNarrativePptx(s, prepared, t, v, i, W, H);
  if (id === 'star') return drawStarPptx(s, prepared, t, v, i, W, H);
  if (id === 'kpi-dashboard') return drawKpiDashboardPptx(s, prepared, t, v, i, W, H);
  if (id === 'timeline') return drawTimelinePptx(s, prepared, t, v, i, W, H);
  if (id === 'case-study') return drawCaseStudyReferencePptx(s, prepared, t, v, i, W, H);
  return drawProposal(s, prepared, t, i, W, H);
}

function drawProposalCover(s, slide, t, W, H) {
  const c = t.colors;
  const tags = (slide.bullets && slide.bullets.length ? slide.bullets : ['EXPERIENCE', 'IMPACT', 'SCALABILITY']).slice(0, 3).join(' · ');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.dark) }, line: { color: hex(c.dark) } });
  const accentOnDark = pptVisibleOn(c.dark, c.accent, SAFE_TEXT_LIGHT);
  s.addText('FITPOLY', { x: 0.9, y: 0.78, w: 2.0, h: 0.45, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: accentOnDark });
  s.addText(new Date().toISOString().slice(0, 10).replace(/-/g, '.'), { x: W - 2.2, y: 0.78, w: 1.4, h: 0.25, fontFace: t.fonts.body, fontSize: 8, color: 'CFCFD2', align: 'right' });
  s.addText(slide.subtitle || '경험과 성과를 기반으로', { x: 0.9, y: 1.85, w: 6.8, h: 0.55, fontFace: t.fonts.heading, fontSize: 28, color: 'FFFFFF', fit: 'shrink' });
  s.addText(pptProposalTextParts(slide.title || '포트폴리오', 'FFFFFF', accentOnDark, { fontFace: t.fonts.heading }), { x: 0.9, y: 2.45, w: 7.0, h: 1.25, fontSize: 34, bold: true, fit: 'shrink' });
  drawProposalDots(s, accentOnDark, W);
  s.addText(tags, { x: 0.9, y: H - 0.92, w: 6.5, h: 0.25, fontFace: t.fonts.body, fontSize: 9, bold: true, color: 'FFFFFF' });
}

function pptAcceptedLines(slide) {
  return acceptedLines(slide).map(line => ({
    heading: safePptText(line.heading),
    body: safePptText(line.body),
    period: safePptText(line.period),
    metrics: line.metrics || [],
  }));
}

function pptAcceptedMetricText(metric) {
  return safePptText(acceptedMetricText(metric));
}

function drawVariedAcceptedPptx(s, slide, t, v, i, W, H, label) {
  const lines = pptAcceptedLines(slide);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const profile = acceptedTemplateProfile(t.layoutId);
  const rawVariant = acceptedVariantIndex(i);
  const variant = (rawVariant + profile.variantOffset) % 30;
  const title = safePptText(slide.title || slide.sectionLabel || 'Portfolio');
  const section = safePptText(slide.sectionLabel || label || 'Portfolio');
  const metric = metrics[0];
  const stat = metric ? pptAcceptedMetricText(metric) : (lines[0]?.period || String(i + 1).padStart(2, '0'));

  if (false && rawVariant >= (profile.heroCount || 0)) {
    const bodyVariant = (profile.variants && profile.variants[variant]) || ACCEPTED_BODY_VARIANTS_30[variant] || '';
    const shell = (variant + profile.shellOffset) % 8;
    const framedSlide = {
      ...slide,
      proposalVariant: bodyVariant,
      dark: shell === 1 || shell === 5 || ['darkStats', 'budget'].includes(bodyVariant),
      sectionLabel: slide.sectionLabel || label,
    };
    if (t.layoutId === 'narrative') {
      s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
      s.addShape('roundRect', { x: 0.55, y: 0.45, w: 0.8, h: 6.3, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.35 });
      addPptText(s, 'STORY ARC', { x: 0.72, y: 0.95, w: 0.25, h: 1.6, rotate: 270, fontFace: t.fonts.body, fontSize: 7, bold: true, color: hex(v.dark), charSpacing: 2 });
      addPptText(s, title, { x: 1.65, y: 0.72, w: 4.1, h: 1.5, fontFace: t.fonts.heading, fontSize: 25, bold: true, color: hex(v.ink), fit: 'shrink' });
      return drawProposal(s, framedSlide, t, i, W, H);
    }
    if (t.layoutId === 'star') {
      s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
      ['S', 'T', 'A', 'R'].forEach((letter, idx) => s.addShape('roundRect', { x: 0.65 + idx * 0.58, y: 0.5, w: 0.42, h: 0.42, fill: { color: idx === variant % 4 ? hex(v.accent) : hex(v.dark) }, line: { color: idx === variant % 4 ? hex(v.accent) : hex(v.dark) }, rectRadius: 0.08 }));
      return drawProposal(s, framedSlide, t, i, W, H);
    }
    if (t.layoutId === 'kpi-dashboard') {
      framedSlide.dark = true;
      return drawProposal(s, framedSlide, t, i, W, H);
    }
    if (t.layoutId === 'timeline') {
      s.addShape('rect', { x: 0.75, y: 0, w: 0.02, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
      s.addShape('ellipse', { x: 0.58, y: 0.85, w: 0.36, h: 0.36, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
      return drawProposal(s, framedSlide, t, i, W, H);
    }
    if (t.layoutId === 'case-study') {
      s.addShape('rect', { x: 0, y: 0, w: 2.7, h: H, fill: { color: hex(v.card) }, line: { color: hex(v.soft) } });
      s.addShape('rect', { x: 0, y: 0, w: 2.7, h: 0.72, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
      return drawProposal(s, framedSlide, t, i, W, H);
    }
    return drawProposal(s, framedSlide, t, i, W, H);
  }

  if (variant === 0) {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, section, { x: 0.72, y: 0.55, w: 3.0, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, title, { x: 0.72, y: 1.18, w: 6.2, h: 1.65, fontFace: t.fonts.heading, fontSize: 30, bold: true, color: 'FFFFFF', fit: 'shrink' });
    s.addShape('ellipse', { x: 8.7, y: 0.75, w: 3.0, h: 3.0, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
    addPptText(s, stat, { x: 9.25, y: 1.65, w: 1.95, h: 0.55, fontFace: t.fonts.heading, fontSize: 25, bold: true, color: hex(v.dark), align: 'center', fit: 'shrink' });
    addPptText(s, metric?.label || lines[0]?.heading || '핵심 증거', { x: 9.22, y: 2.35, w: 2.0, h: 0.35, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.dark), align: 'center', fit: 'shrink' });
    lines.slice(0, 3).forEach((line, idx) => {
      const x = 0.72 + idx * 4.1;
      s.addShape('rect', { x, y: 5.05, w: 3.0, h: 0.04, fill: { color: idx === 0 ? hex(v.accent) : 'FFFFFF', transparency: idx === 0 ? 0 : 80 }, line: { color: idx === 0 ? hex(v.accent) : 'FFFFFF', transparency: 100 } });
      addPptText(s, line.heading, { x, y: 5.28, w: 3.0, h: 0.24, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: 'FFFFFF' });
      addPptText(s, line.body, { x, y: 5.62, w: 3.0, h: 0.38, fontFace: t.fonts.body, fontSize: 7.2, color: 'BDBDBD', fit: 'shrink' });
    });
    return;
  }

  if (variant === 1) {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    s.addShape('rect', { x: 0, y: 0, w: 3.45, h: H, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
    addPptText(s, `${String(i + 1).padStart(2, '0')} / ${label}`, { x: 0.72, y: 0.7, w: 2.2, h: 0.24, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.dark) });
    addPptText(s, title, { x: 0.72, y: 4.15, w: 2.2, h: 1.45, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.dark), fit: 'shrink' });
    lines.slice(0, 4).forEach((line, idx) => {
      const x = 4.05 + (idx % 2) * 4.15;
      const y = 0.7 + Math.floor(idx / 2) * 2.85;
      const fill = idx === 0 ? v.dark : v.card;
      s.addShape('roundRect', { x, y, w: 3.75, h: 2.35, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.18 });
      addPptText(s, `POINT ${idx + 1}`, { x: x + 0.25, y: y + 0.25, w: 1.2, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: idx === 0 ? hex(v.accent) : hex(v.muted) });
      addPptText(s, line.heading, { x: x + 0.25, y: y + 0.9, w: 3.1, h: 0.45, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: idx === 0 ? 'FFFFFF' : hex(v.ink), fit: 'shrink' });
      addPptText(s, line.body, { x: x + 0.25, y: y + 1.45, w: 3.1, h: 0.5, fontFace: t.fonts.body, fontSize: 7.3, color: idx === 0 ? 'BDBDBD' : hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  if (variant === 2) {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, label, { x: 0.78, y: 0.58, w: 2.6, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, title, { x: 0.78, y: 1.08, w: 7.0, h: 1.1, fontFace: t.fonts.heading, fontSize: 28, bold: true, color: hex(v.ink), fit: 'shrink' });
    s.addShape('rect', { x: 0.78, y: 4.12, w: 11.6, h: 0.02, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
    lines.slice(0, 5).forEach((line, idx) => {
      const x = 0.95 + idx * 2.25;
      const y = idx % 2 ? 4.35 : 2.72;
      s.addShape('ellipse', { x, y, w: 0.5, h: 0.5, fill: { color: idx === 0 ? hex(v.dark) : hex(v.accent) }, line: { color: idx === 0 ? hex(v.dark) : hex(v.accent) } });
      addPptText(s, String(idx + 1), { x, y: y + 0.13, w: 0.5, h: 0.15, fontFace: t.fonts.heading, fontSize: 9, bold: true, color: idx === 0 ? 'FFFFFF' : hex(v.dark), align: 'center' });
      addPptText(s, line.heading, { x, y: y + 0.68, w: 1.65, h: 0.35, fontFace: t.fonts.heading, fontSize: 9.5, bold: true, color: hex(v.ink), fit: 'shrink' });
      addPptText(s, line.body, { x, y: y + 1.08, w: 1.65, h: 0.4, fontFace: t.fonts.body, fontSize: 6.8, color: hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  if (variant === 3) {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, section, { x: 0.72, y: 0.58, w: 2.7, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, title, { x: 0.72, y: 1.15, w: 4.3, h: 1.35, fontFace: t.fonts.heading, fontSize: 25, bold: true, color: 'FFFFFF', fit: 'shrink' });
    s.addShape('roundRect', { x: 7.1, y: 0.75, w: 4.7, h: 3.0, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.28 });
    addPptText(s, stat, { x: 7.5, y: 1.55, w: 3.7, h: 0.62, fontFace: t.fonts.heading, fontSize: 31, bold: true, color: hex(v.dark), fit: 'shrink' });
    addPptText(s, metric?.label || lines[0]?.heading || '대표 성과', { x: 7.5, y: 2.35, w: 3.5, h: 0.35, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.dark), fit: 'shrink' });
    lines.slice(0, 2).forEach((line, idx) => {
      const x = 7.1 + idx * 2.45;
      s.addShape('roundRect', { x, y: 4.35, w: 2.2, h: 1.35, fill: { color: 'FFFFFF', transparency: 92 }, line: { color: 'FFFFFF', transparency: 100 }, rectRadius: 0.14 });
      addPptText(s, line.heading, { x: x + 0.18, y: 4.6, w: 1.75, h: 0.22, fontFace: t.fonts.heading, fontSize: 8.7, bold: true, color: 'FFFFFF' });
      addPptText(s, line.body, { x: x + 0.18, y: 4.95, w: 1.75, h: 0.35, fontFace: t.fonts.body, fontSize: 6.6, color: 'CFCFCF', fit: 'shrink' });
    });
    return;
  }

  if (variant === 4) {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    s.addShape('roundRect', { x: 0.55, y: 0.45, w: W - 1.1, h: H - 0.9, fill: { color: hex(v.bg), transparency: 100 }, line: { color: hex(v.dark), width: 1.4 }, rectRadius: 0.28 });
    addPptText(s, title, { x: 1.05, y: 0.9, w: 6.2, h: 1.25, fontFace: t.fonts.heading, fontSize: 27, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, `${label}\n${String(i + 1).padStart(2, '0')}`, { x: 9.2, y: 0.95, w: 2.5, h: 0.5, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), align: 'right', charSpacing: 2 });
    lines.slice(0, 3).forEach((line, idx) => {
      const x = 1.05 + idx * 3.8;
      const fill = idx === 1 ? v.accent : v.card;
      s.addShape('rect', { x, y: 4.35, w: 3.25, h: 1.55, fill: { color: hex(fill) }, line: { color: hex(fill) } });
      addPptText(s, line.period || `EVIDENCE ${idx + 1}`, { x: x + 0.22, y: 4.58, w: 1.7, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: idx === 1 ? hex(v.dark) : hex(v.muted) });
      addPptText(s, line.heading, { x: x + 0.22, y: 5.05, w: 2.6, h: 0.28, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: hex(v.ink), fit: 'shrink' });
      addPptText(s, line.body, { x: x + 0.22, y: 5.42, w: 2.6, h: 0.28, fontFace: t.fonts.body, fontSize: 6.8, color: idx === 1 ? hex(v.dark) : hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  const family = Math.floor(variant / 5);
  const slot = variant % 5;
  const titleXs = [0.78, 0.88, 5.2, 0.95, 0.78, 1.45];
  const titleYs = [1.1, 0.86, 1.22, 2.65, 1.55, 0.95];
  const titleWs = [5.3, 6.25, 4.6, 7.6, 4.2, 6.0];
  const cardXs = [8.35, 7.7, 0.95, 8.85, 6.8, 7.95];
  const cardYs = [0.75, 1.32, 0.62, 0.95, 0.48, 1.12];
  const cardWs = [3.55, 4.05, 3.7, 3.0, 4.25, 3.55];
  const cardHs = [4.2, 3.25, 4.55, 3.55, 3.9, 4.0];
  const isDarkStage = slot === 1 || family === 3;
  const highlightFill = (variant + family) % 4 === 0 ? v.accent : v.dark;
  const highlightText = highlightFill === v.accent ? hex(v.dark) : 'FFFFFF';
  const bgFill = isDarkStage ? v.dark : v.bg;
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(bgFill) }, line: { color: hex(bgFill) } });
  if (family === 1) {
    s.addShape('rect', { x: 0, y: 5.75, w: W, h: 0.55, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rotate: -4 });
  } else if (family === 2) {
    s.addShape('rect', { x: 0.6, y: 0.42, w: 0.18, h: 6.35, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
    s.addShape('rect', { x: 4.82, y: 0.42, w: 0.02, h: 6.35, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
  } else if (family === 3) {
    s.addShape('ellipse', { x: 8.9, y: -0.55, w: 3.25, h: 3.25, fill: { color: hex(v.accent), transparency: 12 }, line: { color: hex(v.accent), transparency: 100 } });
  } else if (family === 4) {
    s.addShape('rect', { x: 9.75, y: 0, w: 1.65, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
  } else if (family === 5) {
    s.addShape('rect', { x: 0, y: 0.42, w: W, h: 0.55, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rotate: 2 });
  }
  s.addShape('roundRect', { x: cardXs[family], y: cardYs[family], w: cardWs[family], h: cardHs[family], fill: { color: hex(highlightFill) }, line: { color: hex(highlightFill) }, rectRadius: [0.24, 0.06, 0.38, 0.16, 0, 0.28][family], rotate: (slot % 2 ? 2 : -2) + family * 0.6 });
  addPptText(s, label, { x: 0.78, y: 0.6, w: 2.8, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
  addPptText(s, title, { x: titleXs[family], y: titleYs[family], w: titleWs[family], h: 1.55, fontFace: t.fonts.heading, fontSize: [27, 25, 27, 24, 26, 25][family], bold: true, color: isDarkStage ? 'FFFFFF' : hex(v.ink), fit: 'shrink' });
  addPptText(s, 'HIGHLIGHT', { x: cardXs[family] + 0.35, y: cardYs[family] + 0.4, w: 1.4, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: highlightFill === v.accent ? hex(v.dark) : hex(v.accent) });
  addPptText(s, lines[0]?.heading || stat, { x: cardXs[family] + 0.35, y: cardYs[family] + 1.2, w: cardWs[family] - 0.75, h: 0.8, fontFace: t.fonts.heading, fontSize: family === 2 ? 18 : 20, bold: true, color: highlightText, fit: 'shrink' });
  addPptText(s, lines[0]?.body || metric?.label || '', { x: cardXs[family] + 0.35, y: cardYs[family] + 2.25, w: cardWs[family] - 0.75, h: 0.7, fontFace: t.fonts.body, fontSize: 7.5, color: highlightFill === v.accent ? hex(v.dark) : 'BDBDBD', fit: 'shrink' });
  lines.slice(1, 4).forEach((line, idx) => {
    const horizontal = family % 2 === 0;
    const x = horizontal ? 0.78 + idx * 2.05 + (family === 4 ? 0.55 : 0) : 0.78;
    const y = horizontal ? (family === 2 ? 5.2 : 5.0) : 4.1 + idx * 0.78;
    const chipW = horizontal ? 1.75 : 2.8;
    const chipH = horizontal ? 0.95 : 0.62;
    s.addShape('roundRect', { x, y, w: chipW, h: chipH, fill: { color: idx === 1 ? hex(v.accent) : 'FFFFFF' }, line: { color: idx === 1 ? hex(v.accent) : 'FFFFFF' }, rectRadius: [0.14, 0.02, 0.28, 0.08, 0, 0.18][family] });
    addPptText(s, `0${idx + 2}`, { x: x + 0.16, y: y + 0.18, w: 0.4, h: 0.12, fontFace: t.fonts.body, fontSize: 6.5, bold: true, color: hex(v.dark) });
    addPptText(s, line.heading, { x: x + 0.16, y: y + (horizontal ? 0.47 : 0.26), w: chipW - 0.36, h: horizontal ? 0.24 : 0.18, fontFace: t.fonts.heading, fontSize: horizontal ? 8.2 : 7.8, bold: true, color: hex(v.dark), fit: 'shrink' });
  });
}

function drawAcceptedSectionScenePptx(s, slide, t, v, i, W, H) {
  const kind = acceptedSectionKind(slide);
  const lines = pptAcceptedLines(slide);
  if (['cover', 'toc', 'metric', 'project'].includes(kind)) return false;

  if (kind === 'intro') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    s.addShape('ellipse', { x: W - 2.6, y: -1.0, w: 3.4, h: 3.4, fill: { color: hex(v.accent), transparency: 78 }, line: { color: hex(v.accent), transparency: 100 } });
    addPptText(s, slide.sectionLabel || 'OVERVIEW', { x: 0.8, y: 0.65, w: 2.8, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.8, y: 1.25, w: 7.0, h: 1.8, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: hex(v.ink) });
    if (slide.subtitle) addPptText(s, slide.subtitle, { x: 0.85, y: 3.45, w: 5.6, h: 0.55, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
    lines.slice(0, 3).forEach((line, idx) => {
      const x = 7.35 - idx * 0.35;
      const y = 4.2 + idx * 0.62;
      const fill = idx === 0 ? v.dark : v.card;
      s.addShape('roundRect', { x, y, w: 4.35, h: 0.95, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.16 });
      addPptText(s, String(idx + 1).padStart(2, '0'), { x: x + 0.22, y: y + 0.18, w: 0.4, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: idx === 0 ? hex(v.accent) : hex(v.muted) });
      addPptText(s, line.heading, { x: x + 0.75, y: y + 0.15, w: 3.1, h: 0.22, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: idx === 0 ? 'FFFFFF' : hex(v.ink) });
      addPptText(s, line.body, { x: x + 0.75, y: y + 0.46, w: 3.1, h: 0.22, fontFace: t.fonts.body, fontSize: 7.2, color: idx === 0 ? 'BDBDBD' : hex(v.muted) });
    });
    return true;
  }

  if (kind === 'fit' || kind === 'problem') {
    const dark = kind === 'fit';
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(dark ? v.dark : v.bg) }, line: { color: hex(dark ? v.dark : v.bg) } });
    addPptText(s, dark ? 'FIT MAP' : 'PROBLEM FRAMING', { x: 0.72, y: 0.65, w: 2.5, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.72, y: 1.2, w: 5.4, h: 1.55, fontFace: t.fonts.heading, fontSize: 29, bold: true, color: dark ? 'FFFFFF' : hex(v.ink) });
    s.addShape('ellipse', { x: 7.0, y: 1.25, w: 2.25, h: 2.25, fill: { color: dark ? 'FFFFFF' : hex(v.soft), transparency: dark ? 88 : 0 }, line: { color: hex(v.accent), width: 1.5 } });
    s.addShape('ellipse', { x: 8.95, y: 1.25, w: 2.25, h: 2.25, fill: { color: dark ? 'FFFFFF' : hex(v.card), transparency: dark ? 88 : 0 }, line: { color: hex(v.accent), width: 1.5 } });
    s.addShape('roundRect', { x: 8.57, y: 2.08, w: 1.0, h: 0.48, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.2 });
    addPptText(s, 'MATCH', { x: 8.66, y: 2.22, w: 0.82, h: 0.1, fontFace: t.fonts.body, fontSize: 7, bold: true, color: hex(v.dark), align: 'center' });
    lines.slice(0, 3).forEach((line, idx) => {
      const x = 0.72 + idx * 4.1;
      s.addShape('rect', { x, y: 5.05, w: 2.9, h: 0.04, fill: { color: idx === 1 ? hex(v.accent) : dark ? 'FFFFFF' : hex(v.soft), transparency: idx === 1 ? 0 : dark ? 80 : 0 }, line: { color: idx === 1 ? hex(v.accent) : dark ? 'FFFFFF' : hex(v.soft), transparency: 100 } });
      addPptText(s, line.heading, { x, y: 5.28, w: 3.0, h: 0.22, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: dark ? 'FFFFFF' : hex(v.ink) });
      addPptText(s, line.body, { x, y: 5.62, w: 3.0, h: 0.32, fontFace: t.fonts.body, fontSize: 7.2, color: dark ? 'BDBDBD' : hex(v.muted) });
    });
    return true;
  }

  if (kind === 'growth') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, 'NEXT ROADMAP', { x: 0.78, y: 0.62, w: 2.5, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.78, y: 1.2, w: 4.5, h: 1.5, fontFace: t.fonts.heading, fontSize: 27, bold: true, color: hex(v.ink) });
    lines.slice(0, 4).forEach((line, idx) => {
      const y = 0.85 + idx * 1.35;
      const fill = idx === Math.min(3, lines.length - 1) ? v.accent : v.card;
      s.addShape('roundRect', { x: 6.0, y, w: 5.7, h: 0.95, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.16 });
      addPptText(s, line.period || `STEP ${idx + 1}`, { x: 6.28, y: y + 0.28, w: 1.0, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: hex(v.dark) });
      addPptText(s, line.heading, { x: 7.45, y: y + 0.18, w: 3.4, h: 0.22, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: hex(v.dark) });
      addPptText(s, line.body, { x: 7.45, y: y + 0.48, w: 3.4, h: 0.2, fontFace: t.fonts.body, fontSize: 7.2, color: hex(v.dark), transparency: 28 });
    });
    return true;
  }

  if (kind === 'risk') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, 'TRADE-OFF / RISK', { x: 0.72, y: 0.65, w: 2.7, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.72, y: 1.25, w: 7.1, h: 1.25, fontFace: t.fonts.heading, fontSize: 30, bold: true, color: 'FFFFFF' });
    (lines.length ? lines : [{ heading: 'Risk', body: '약해질 수 있는 지점' }, { heading: 'Response', body: '보완하는 방식' }]).slice(0, 4).forEach((line, idx) => {
      const x = 0.72 + (idx % 2) * 6.1;
      const y = 4.35 + Math.floor(idx / 2) * 1.05;
      const fill = idx % 2 ? v.accent : 'FFFFFF';
      s.addShape('roundRect', { x, y, w: 5.5, h: 0.82, fill: { color: hex(fill), transparency: idx % 2 ? 0 : 92 }, line: { color: hex(fill), transparency: idx % 2 ? 0 : 100 }, rectRadius: 0.12 });
      addPptText(s, idx % 2 ? 'RESPONSE' : 'RISK', { x: x + 0.22, y: y + 0.14, w: 1.2, h: 0.12, fontFace: t.fonts.body, fontSize: 6.5, bold: true, color: idx % 2 ? hex(v.dark) : 'BDBDBD' });
      addPptText(s, line.heading, { x: x + 1.6, y: y + 0.13, w: 3.4, h: 0.18, fontFace: t.fonts.heading, fontSize: 9.5, bold: true, color: idx % 2 ? hex(v.dark) : 'FFFFFF' });
      addPptText(s, line.body, { x: x + 1.6, y: y + 0.4, w: 3.4, h: 0.18, fontFace: t.fonts.body, fontSize: 7, color: idx % 2 ? hex(v.dark) : 'BDBDBD' });
    });
    return true;
  }

  if (kind === 'closing') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, 'END OF PORTFOLIO', { x: 0, y: 2.25, w: W, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3, align: 'center' });
    addPptText(s, slide.title || 'Thank You', { x: 1.2, y: 2.75, w: W - 2.4, h: 0.8, fontFace: t.fonts.heading, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center' });
    if (slide.subtitle) addPptText(s, slide.subtitle, { x: 1.8, y: 3.75, w: W - 3.6, h: 0.3, fontFace: t.fonts.body, fontSize: 11, color: 'BDBDBD', align: 'center' });
    addPptText(s, (slide.bullets || []).slice(0, 3).join(' · '), { x: 1.8, y: 4.45, w: W - 3.6, h: 0.25, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.accent), align: 'center' });
    return true;
  }

  return false;
}

function narrPptBase(s, W, H, darkBg = false) {
  const bg = darkBg ? '0F172A' : 'FFFFFF';
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: bg }, line: { color: bg } });
}
function narrPptRule(s, acc, x, y) { s.addShape('rect', { x, y, w: 0.68, h: 0.05, fill: { color: acc }, line: { color: acc } }); }
function narrPptLabel(s, text, t, acc, x, y) { addPptText(s, text.toUpperCase(), { x, y, w: 3.5, h: 0.16, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: acc, charSpacing: 2.5, fit: 'shrink' }); }

function drawNarrativeCoverPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  s.addShape('rect', { x: 0, y: 0, w: W * 0.62, h: H, fill: { color: 'F8FAFC' }, line: { color: 'F8FAFC' } });
  s.addShape('rect', { x: W * 0.62, y: 0, w: W * 0.38, h: H, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  s.addShape('rect', { x: W * 0.56, y: 0, w: 0.65, h: H, fill: { color: acc }, line: { color: acc } });
  addPptText(s, safePptText(slide.title || ''), { x: 0.82, y: 0.75, w: W * 0.52, h: 2.8, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: '0F172A', fit: 'shrink' });
  s.addShape('rect', { x: 0.82, y: 3.7, w: 0.68, h: 0.05, fill: { color: acc }, line: { color: acc } });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 0.82, y: 3.88, w: W * 0.5, h: 0.28, fontFace: t.fonts.body, fontSize: 11, color: '475569', fit: 'shrink' });
  addPptText(s, safePptText((slide.sectionLabel || 'KIM YUSHIN PORTFOLIO').toUpperCase()), { x: 0.82, y: H - 0.95, w: 3.5, h: 0.22, fontFace: t.fonts.body, fontSize: 8.5, bold: true, color: acc, charSpacing: 1.5 });
  const chips = (slide.bullets || ['React', 'Node.js', 'Firebase', 'AI API', 'TypeScript']).slice(0, 6);
  chips.forEach((chip, idx) => {
    const y = 0.72 + idx * 0.88;
    s.addShape('rect', { x: W * 0.68, y, w: 2.6, h: 0.6, fill: { color: '1E2D3D' }, line: { color: '1E2D3D' } });
    addPptText(s, safePptText(chip), { x: W * 0.68 + 0.18, y: y + 0.17, w: 2.2, h: 0.26, fontFace: 'Courier New', fontSize: 10.5, bold: true, color: 'E2E8F0', fit: 'shrink' });
  });
}

function drawNarrativeProfilePptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.68, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.6);
  narrPptLabel(s, 'PROFILE', t, acc, 0.8, 1.95);
  const edu = (slide.items || []).filter(Boolean);
  edu.slice(0, 2).forEach((item, idx) => {
    const y = 2.3 + idx * 1.1;
    narrPptLabel(s, item.role || item.period || 'EDUCATION', t, acc, 0.8, y);
    addPptText(s, safePptText(item.heading || ''), { x: 0.8, y: y + 0.25, w: 4.8, h: 0.3, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(item.body || ''), { x: 0.8, y: y + 0.62, w: 4.8, h: 0.28, fontFace: t.fonts.body, fontSize: 8.2, color: hex(v.muted), fit: 'shrink' });
  });
  narrPptLabel(s, 'AWARDS & ACHIEVEMENTS', t, acc, 6.2, 1.95);
  const awards = (slide.metrics || []).slice(0, 3);
  awards.forEach((m, idx) => {
    const y = 2.3 + idx * 1.25;
    addPptText(s, safePptText(m.label || ''), { x: 6.2, y, w: 5.4, h: 0.3, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(m.body || ''), { x: 6.2, y: y + 0.35, w: 5.4, h: 0.24, fontFace: t.fonts.body, fontSize: 8, color: hex(v.muted), fit: 'shrink' });
  });
  if (slide.subtitle) {
    s.addShape('rect', { x: 6.2, y: 5.05, w: 5.8, h: 0.012, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
    addPptText(s, safePptText(slide.subtitle), { x: 6.2, y: 5.3, w: 5.6, h: 0.9, fontFace: t.fonts.body, fontSize: 9.5, italic: true, color: hex(v.ink), fit: 'shrink' });
  }
}

function drawNarrativePhilosophyPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.68, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.58);
  const items = (slide.items || []).slice(0, 3);
  const icons = ['+', '—', '×'];
  items.forEach((item, idx) => {
    const x = 0.8 + idx * 3.95;
    s.addShape('rect', { x, y: 2.05, w: 3.65, h: 3.15, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    s.addShape('rect', { x, y: 2.05, w: 3.65, h: 0.04, fill: { color: acc }, line: { color: acc } });
    addPptText(s, icons[idx], { x: x + 0.25, y: 2.35, w: 0.6, h: 0.5, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: acc });
    addPptText(s, (item.heading || '').toUpperCase(), { x: x + 0.25, y: 3.05, w: 3.2, h: 0.22, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.ink), charSpacing: 0.8 });
    addPptText(s, safePptText(item.body || ''), { x: x + 0.25, y: 3.42, w: 3.15, h: 1.55, fontFace: t.fonts.body, fontSize: 9, color: '334155', fit: 'shrink' });
  });
  s.addShape('rect', { x: 0, y: H - 0.82, w: W, h: 0.82, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 0.8, y: H - 0.68, w: W - 1.6, h: 0.48, fontFace: t.fonts.body, fontSize: 9, color: 'E2E8F0', fit: 'shrink' });
}

function drawNarrativeSkillsPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.68, w: W - 1.6, h: 0.55, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.38);
  const groups = (slide.items || []).slice(0, 6);
  groups.forEach((g, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 0.8 + col * 3.95;
    const y = 1.8 + row * 2.0;
    narrPptLabel(s, g.period || g.heading || `GROUP ${idx+1}`, t, acc, x, y);
    const bullets = (g.bullets?.length ? g.bullets : [g.heading, g.body].filter(Boolean)).slice(0, 4);
    bullets.forEach((b, bi) => {
      const bx = x + (bi % 2) * 1.75;
      const by = y + 0.28 + Math.floor(bi / 2) * 0.42;
      s.addShape('rect', { x: bx, y: by, w: 1.6, h: 0.3, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.5 } });
      s.addShape('rect', { x: bx, y: by, w: 0.04, h: 0.3, fill: { color: acc }, line: { color: acc } });
      addPptText(s, safePptText(b), { x: bx + 0.1, y: by + 0.06, w: 1.45, h: 0.18, fontFace: 'Courier New', fontSize: 7.2, color: '334155', fit: 'shrink' });
    });
  });
  s.addShape('rect', { x: 0, y: H - 0.75, w: W, h: 0.75, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 0.8, y: H - 0.62, w: W - 1.6, h: 0.42, fontFace: t.fonts.body, fontSize: 8.5, color: 'E2E8F0', fit: 'shrink' });
}

function drawNarrativeProblemPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.68, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.55);
  narrPptLabel(s, 'THE PROBLEM', t, acc, 0.8, 1.88);
  const problems = (slide.items || []).slice(0, 3);
  problems.forEach((p, idx) => {
    const y = 2.2 + idx * 1.0;
    addPptText(s, safePptText(p.body || ''), { x: 1.05, y, w: 4.4, h: 0.72, fontFace: t.fonts.body, fontSize: 9.5, color: '334155', fit: 'shrink' });
  });
  s.addShape('rect', { x: 6.1, y: 1.88, w: 3.9, h: 4.0, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
  [['시간 낭비', '+'], ['일관성 부족', '='], ['취업 준비의\n가장 큰 장벽', '']].forEach(([text, op], idx) => {
    addPptText(s, text, { x: 6.4, y: 2.3 + idx * 1.08, w: 3.2, h: 0.55, fontFace: t.fonts.body, fontSize: 10.5, color: idx === 2 ? acc : '64748B', bold: idx === 2, align: 'center', fit: 'shrink' });
    if (op) addPptText(s, op, { x: 7.5, y: 2.78 + idx * 1.08, w: 1.0, h: 0.28, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: acc, align: 'center' });
  });
  s.addShape('rect', { x: 0, y: H - 0.72, w: W, h: 0.72, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 0.8, y: H - 0.6, w: W - 1.6, h: 0.42, fontFace: t.fonts.body, fontSize: 8.8, color: 'E2E8F0', fit: 'shrink' });
}

function drawNarrativeProjectPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  s.addShape('rect', { x: 0, y: 0, w: W * 0.38, h: H, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  s.addShape('rect', { x: W * 0.34, y: 0, w: 0.55, h: H, fill: { color: acc }, line: { color: acc } });
  s.addShape('rect', { x: W * 0.38, y: 0, w: W * 0.62, h: H, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } });
  addPptText(s, safePptText((slide.sectionLabel || '').toUpperCase()), { x: 0.5, y: 0.75, w: W * 0.3, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: acc, charSpacing: 2 });
  addPptText(s, safePptText(slide.title || ''), { x: 0.5, y: 1.2, w: W * 0.3, h: 2.5, fontFace: t.fonts.heading, fontSize: 32, bold: true, color: 'FFFFFF', fit: 'shrink' });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 0.5, y: 3.85, w: W * 0.3, h: 0.75, fontFace: t.fonts.body, fontSize: 9, color: '94A3B8', fit: 'shrink' });
  const details = (slide.items || []).slice(0, 3);
  const startX = W * 0.4 + 0.2;
  details.forEach((d, idx) => {
    const y = 0.65 + idx * 1.35;
    narrPptLabel(s, d.heading || '', t, acc, startX, y);
    s.addShape('rect', { x: startX, y: y + 0.22, w: W * 0.55, h: 0.012, fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0' } });
    addPptText(s, safePptText(d.body || ''), { x: startX, y: y + 0.38, w: W * 0.55, h: 0.65, fontFace: t.fonts.body, fontSize: 9.5, color: idx === 0 ? '334155' : hex(v.ink), bold: idx > 0, fit: 'shrink' });
  });
  narrPptLabel(s, 'TECH STACK', t, acc, startX, 4.6);
  s.addShape('rect', { x: startX, y: 4.82, w: W * 0.55, h: 0.012, fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0' } });
  const chips = (slide.bullets || []).slice(0, 9);
  chips.forEach((chip, ci) => {
    const cx = startX + (ci % 3) * 2.1;
    const cy = 4.98 + Math.floor(ci / 3) * 0.48;
    s.addShape('rect', { x: cx, y: cy, w: 1.9, h: 0.32, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', width: 0.5 } });
    addPptText(s, safePptText(chip), { x: cx + 0.08, y: cy + 0.07, w: 1.74, h: 0.18, fontFace: 'Courier New', fontSize: 7.5, color: '475569', fit: 'shrink' });
  });
}

function drawNarrativeChallengePptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.78, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.55);
  const all = (slide.items || []).slice(0, 6);
  const problems = all.filter(it => it.heading?.startsWith('Problem'));
  const actions = all.filter(it => it.heading?.startsWith('Action') || it.heading?.startsWith('Solution'));
  narrPptLabel(s, 'THE PROBLEM', t, acc, 0.8, 1.88);
  problems.forEach((p, idx) => {
    addPptText(s, safePptText(p.body || ''), { x: 1.05, y: 2.2 + idx * 1.0, w: 4.5, h: 0.72, fontFace: t.fonts.body, fontSize: 9.5, color: '334155', fit: 'shrink' });
  });
  s.addShape('rect', { x: 5.85, y: 1.82, w: 0.03, h: 4.5, fill: { color: acc }, line: { color: acc } });
  narrPptLabel(s, 'CORE TASKS', t, acc, 6.1, 1.88);
  actions.forEach((a, idx) => {
    const y = 2.2 + idx * 1.2;
    s.addShape('rect', { x: 6.1, y, w: 5.5, h: 1.0, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    addPptText(s, String(idx+1).padStart(2,'0'), { x: 6.28, y: y + 0.1, w: 0.42, h: 0.22, fontFace: t.fonts.body, fontSize: 9, bold: true, color: acc });
    const parts = (a.body || '').split('→');
    addPptText(s, safePptText(parts[0] || ''), { x: 6.28, y: y + 0.38, w: 5.1, h: 0.28, fontFace: t.fonts.heading, fontSize: 9.5, bold: true, color: hex(v.ink), fit: 'shrink' });
    if (parts[1]) addPptText(s, '→ ' + parts[1].trim(), { x: 6.28, y: y + 0.68, w: 5.1, h: 0.22, fontFace: t.fonts.body, fontSize: 8.2, color: hex(v.muted), fit: 'shrink' });
  });
}

function drawNarrativeArchitecturePptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.52);
  const items = (slide.items || []).slice(0, 4);
  items.forEach((item, idx) => {
    const col = idx % 2, row = Math.floor(idx / 2);
    const x = 0.8 + col * 6.1, y = 1.88 + row * 1.82;
    s.addShape('rect', { x, y, w: 5.8, h: 1.6, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    s.addShape('rect', { x: x + 0.18, y: y + 0.18, w: 0.55, h: 0.34, fill: { color: '0F172A' }, line: { color: '0F172A' } });
    addPptText(s, String(idx+1).padStart(2,'0'), { x: x + 0.18, y: y + 0.22, w: 0.55, h: 0.2, fontFace: t.fonts.body, fontSize: 9, bold: true, color: acc, align: 'center' });
    addPptText(s, safePptText(item.heading || ''), { x: x + 0.9, y: y + 0.22, w: 4.65, h: 0.28, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: acc, fit: 'shrink' });
    const parts = (item.body || '').split('→');
    addPptText(s, safePptText(parts[0] || ''), { x: x + 0.18, y: y + 0.72, w: 5.4, h: 0.38, fontFace: t.fonts.body, fontSize: 9, color: '64748B', fit: 'shrink' });
    if (parts[1]) addPptText(s, '→ ' + parts[1].trim(), { x: x + 0.18, y: y + 1.15, w: 5.4, h: 0.3, fontFace: t.fonts.heading, fontSize: 9.5, bold: true, color: hex(v.ink), fit: 'shrink' });
  });
  if (slide.subtitle) {
    s.addShape('rect', { x: 0.8, y: H - 0.92, w: W - 1.6, h: 0.72, fill: { color: 'F8FAFC' }, line: { color: acc } });
    s.addShape('rect', { x: 0.8, y: H - 0.92, w: 0.04, h: 0.72, fill: { color: acc }, line: { color: acc } });
    addPptText(s, 'CORE INSIGHT', { x: 0.98, y: H - 0.88, w: 2.0, h: 0.18, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.muted), charSpacing: 1.5 });
    addPptText(s, safePptText(slide.subtitle), { x: 0.98, y: H - 0.65, w: W - 2.1, h: 0.32, fontFace: t.fonts.body, fontSize: 9, bold: true, color: acc, fit: 'shrink' });
  }
}

function drawNarrativeResultsPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.52);
  const all = (slide.items || []).slice(0, 7);
  const deliverables = all.slice(0, 4);
  const growth = all.slice(4, 7);
  narrPptLabel(s, 'KEY DELIVERABLES', t, acc, 0.8, 1.85);
  deliverables.forEach((d, idx) => {
    addPptText(s, '✓', { x: 0.8, y: 2.18 + idx * 0.88, w: 0.28, h: 0.28, fontFace: t.fonts.body, fontSize: 11, bold: true, color: acc });
    addPptText(s, safePptText(d.heading || ''), { x: 1.2, y: 2.18 + idx * 0.88, w: 5.0, h: 0.55, fontFace: t.fonts.body, fontSize: 9.5, bold: true, color: hex(v.ink), fit: 'shrink' });
  });
  s.addShape('rect', { x: 6.6, y: 1.82, w: 5.0, h: 4.8, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  addPptText(s, 'GROWTH POINTS', { x: 6.85, y: 2.05, w: 4.2, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: '94A3B8', charSpacing: 2 });
  growth.forEach((g, idx) => {
    addPptText(s, '→', { x: 6.85, y: 2.55 + idx * 1.1, w: 0.3, h: 0.28, fontFace: t.fonts.body, fontSize: 12, bold: true, color: acc });
    addPptText(s, safePptText(g.heading || ''), { x: 7.28, y: 2.55 + idx * 1.1, w: 4.1, h: 0.72, fontFace: t.fonts.body, fontSize: 9, color: 'E2E8F0', fit: 'shrink' });
  });
}

function drawNarrativeAwardsPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.55, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.35);
  const all = (slide.items || []);
  const awards = all.filter(a => !a.heading?.toLowerCase().includes('toeic') && !a.heading?.toLowerCase().includes('language')).slice(0, 3);
  const lang = all.find(a => a.heading?.toLowerCase().includes('toeic') || a.period?.toLowerCase().includes('language')) || all.slice(-1)[0];
  narrPptLabel(s, 'AWARDS', t, acc, 0.8, 1.72);
  awards.forEach((a, idx) => {
    const y = 2.05 + idx * 1.38;
    s.addShape('rect', { x: 0.8, y, w: 5.5, h: 1.18, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    s.addShape('rect', { x: 0.8, y, w: 0.04, h: 1.18, fill: { color: acc }, line: { color: acc } });
    addPptText(s, safePptText(a.heading || ''), { x: 1.08, y: y + 0.2, w: 4.95, h: 0.32, fontFace: t.fonts.heading, fontSize: 11.5, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(a.body || ''), { x: 1.08, y: y + 0.58, w: 4.95, h: 0.45, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted), fit: 'shrink' });
  });
  narrPptLabel(s, 'LANGUAGE', t, acc, 6.7, 1.72);
  if (lang) {
    s.addShape('rect', { x: 6.7, y: 2.05, w: 4.9, h: 2.5, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    s.addShape('rect', { x: 6.7, y: 2.05, w: 0.04, h: 2.5, fill: { color: acc }, line: { color: acc } });
    addPptText(s, safePptText(lang.heading || ''), { x: 6.98, y: 2.28, w: 4.3, h: 0.32, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(lang.body || ''), { x: 6.98, y: 2.76, w: 4.3, h: 1.5, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted), fit: 'shrink' });
  }
}

function drawNarrativeTimelinePptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.52);
  const items = (slide.items || []).slice(0, 5);
  items.forEach((item, idx) => {
    const y = 1.85 + idx * 0.9;
    addPptText(s, safePptText(item.period || `202${1+idx}`), { x: 0.8, y, w: 1.0, h: 0.28, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: acc, fit: 'shrink' });
    s.addShape('rect', { x: 1.98, y, w: 0.05, h: 0.62, fill: { color: acc }, line: { color: acc } });
    addPptText(s, safePptText(item.heading || ''), { x: 2.2, y, w: 9.2, h: 0.28, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(item.body || ''), { x: 2.2, y: y + 0.32, w: 9.2, h: 0.28, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted), fit: 'shrink' });
  });
  s.addShape('rect', { x: 0, y: H - 0.72, w: W, h: 0.72, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 0.8, y: H - 0.6, w: W - 1.6, h: 0.42, fontFace: t.fonts.body, fontSize: 8.8, color: 'E2E8F0', fit: 'shrink' });
}

function drawNarrativeSummaryPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.52);
  const items = (slide.items || []).slice(0, 3);
  items.forEach((item, idx) => {
    const x = 0.8 + idx * 3.95;
    s.addShape('rect', { x, y: 1.88, w: 3.65, h: 4.5, fill: { color: 'F8FAFC' }, line: { color: 'E2E8F0' } });
    s.addShape('rect', { x, y: 1.88, w: 3.65, h: 0.042, fill: { color: acc }, line: { color: acc } });
    addPptText(s, String(idx+1).padStart(2,'0'), { x: x + 0.2, y: 2.12, w: 0.7, h: 0.4, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: acc });
    addPptText(s, safePptText(item.heading || ''), { x: x + 0.2, y: 2.72, w: 3.25, h: 0.62, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(item.body || ''), { x: x + 0.2, y: 3.52, w: 3.25, h: 1.62, fontFace: t.fonts.body, fontSize: 8.8, color: hex(v.muted), fit: 'shrink' });
    s.addShape('rect', { x: x + 0.2, y: 5.28, w: 2.8, h: 0.38, fill: { color: '0F172A' }, line: { color: '0F172A' } });
    addPptText(s, 'PROVEN IN: ' + (item.period || item.role || '').toUpperCase(), { x: x + 0.28, y: 5.36, w: 2.62, h: 0.22, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: 'E2E8F0', fit: 'shrink' });
  });
}

function drawNarrativeConnectionPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.55, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.32);
  const headers = ['PROJECT', 'CORE TECH', 'WHAT I LEARNED', 'CONNECTION TO NEXT'];
  const colW = [1.6, 2.2, 2.8, 3.4];
  let cx = 0.8;
  s.addShape('rect', { x: 0.8, y: 1.65, w: W - 1.6, h: 0.48, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  headers.forEach((h, hi) => {
    addPptText(s, h, { x: cx + 0.14, y: 1.72, w: colW[hi] - 0.2, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: '94A3B8', charSpacing: 1 });
    cx += colW[hi];
  });
  const items = (slide.items || []).slice(0, 3);
  items.forEach((item, idx) => {
    const y = 2.25 + idx * 1.15;
    s.addShape('rect', { x: 0.8, y: y + 0.92, w: W - 1.6, h: 0.012, fill: { color: 'E2E8F0' }, line: { color: 'E2E8F0' } });
    let rowX = 0.8;
    addPptText(s, safePptText(item.heading || ''), { x: rowX + 0.14, y, w: colW[0] - 0.2, h: 0.38, fontFace: t.fonts.heading, fontSize: 11.5, bold: true, color: hex(v.ink), fit: 'shrink' });
    rowX += colW[0];
    addPptText(s, safePptText(item.body || ''), { x: rowX + 0.14, y, w: colW[1] - 0.2, h: 0.72, fontFace: t.fonts.body, fontSize: 8.5, color: acc, fit: 'shrink' });
    rowX += colW[1];
    addPptText(s, safePptText(item.period || ''), { x: rowX + 0.14, y, w: colW[2] - 0.2, h: 0.52, fontFace: t.fonts.body, fontSize: 9.5, bold: true, color: hex(v.ink), fit: 'shrink' });
    rowX += colW[2];
    addPptText(s, safePptText(item.role || ''), { x: rowX + 0.14, y, w: colW[3] - 0.2, h: 0.52, fontFace: t.fonts.body, fontSize: 9, color: acc, fit: 'shrink' });
  });
  s.addShape('rect', { x: 0, y: H - 0.72, w: W, h: 0.72, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 0.8, y: H - 0.6, w: W - 1.6, h: 0.42, fontFace: t.fonts.body, fontSize: 8.8, color: 'E2E8F0', fit: 'shrink' });
}

function drawNarrativeRoadmapPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  narrPptBase(s, W, H);
  addPptText(s, safePptText(slide.title || ''), { x: 0.8, y: 0.65, w: W - 1.6, h: 0.75, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink), fit: 'shrink' });
  narrPptRule(s, acc, 0.8, 1.52);
  const items = (slide.items || []).slice(0, 3);
  items.forEach((item, idx) => {
    const y = 1.88 + idx * 1.0;
    s.addShape('rect', { x: 0.8, y, w: 0.04, h: 0.72, fill: { color: acc }, line: { color: acc } });
    addPptText(s, (item.period || item.role || ['SHORT-TERM', 'MID-TERM', 'LONG-TERM'][idx]).toUpperCase(), { x: 1.1, y, w: 1.4, h: 0.22, fontFace: t.fonts.body, fontSize: 8.2, bold: true, color: acc, charSpacing: 1 });
    addPptText(s, safePptText(item.body || ''), { x: 2.75, y, w: 8.8, h: 0.58, fontFace: t.fonts.body, fontSize: 11, color: hex(v.ink), fit: 'shrink' });
  });
  if (slide.subtitle) {
    s.addShape('rect', { x: 0.8, y: 5.1, w: W - 1.6, h: 1.6, fill: { color: '0F172A' }, line: { color: '0F172A' } });
    addPptText(s, safePptText(slide.subtitle), { x: 1.1, y: 5.3, w: W - 2.2, h: 1.2, fontFace: t.fonts.body, fontSize: 11, italic: true, color: 'E2E8F0', fit: 'shrink', align: 'left' });
  }
}

function drawNarrativeClosingPptx(s, slide, t, v, W, H) {
  const acc = hex(v.accent);
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: '0F172A' }, line: { color: '0F172A' } });
  addPptText(s, safePptText(slide.title || ''), { x: 1.2, y: 1.05, w: W - 2.4, h: 1.85, fontFace: t.fonts.heading, fontSize: 28, bold: true, italic: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
  s.addShape('rect', { x: W / 2 - 0.38, y: 3.08, w: 0.76, h: 0.05, fill: { color: acc }, line: { color: acc } });
  addPptText(s, safePptText(slide.subtitle || ''), { x: 1.5, y: 3.35, w: W - 3.0, h: 0.4, fontFace: t.fonts.body, fontSize: 11.5, bold: true, color: acc, align: 'center', fit: 'shrink' });
  const contacts = (slide.bullets || []).slice(0, 3);
  contacts.forEach((c, idx) => {
    const cx = 2.2 + idx * 3.35;
    addPptText(s, safePptText(c), { x: cx, y: 4.05, w: 3.0, h: 0.35, fontFace: t.fonts.body, fontSize: 9.5, color: 'CBD5E1', align: 'center', fit: 'shrink' });
  });
  const chips = (slide.items || []).slice(0, 7);
  chips.forEach((chip, idx) => {
    const cx = 1.0 + (idx % 4) * 2.65;
    const cy = 4.85 + Math.floor(idx / 4) * 0.62;
    s.addShape('rect', { x: cx, y: cy, w: 2.4, h: 0.42, fill: { color: '0F172A' }, line: { color: idx === 2 ? acc : '334155' } });
    addPptText(s, safePptText(chip.heading || ''), { x: cx + 0.1, y: cy + 0.1, w: 2.2, h: 0.22, fontFace: 'Courier New', fontSize: 8.5, color: idx === 2 ? acc : 'CBD5E1', align: 'center', fit: 'shrink' });
  });
}

function drawNarrativePptx(s, slide, t, v, i, W, H) {
  const NARR_PPT = {
    'narrative-cover': drawNarrativeCoverPptx, 'narrative-profile': drawNarrativeProfilePptx,
    'narrative-philosophy': drawNarrativePhilosophyPptx, 'narrative-skills': drawNarrativeSkillsPptx,
    'narrative-problem': drawNarrativeProblemPptx, 'narrative-project': drawNarrativeProjectPptx,
    'narrative-challenge': drawNarrativeChallengePptx, 'narrative-architecture': drawNarrativeArchitecturePptx,
    'narrative-results': drawNarrativeResultsPptx, 'narrative-awards': drawNarrativeAwardsPptx,
    'narrative-timeline': drawNarrativeTimelinePptx, 'narrative-summary': drawNarrativeSummaryPptx,
    'narrative-connection': drawNarrativeConnectionPptx, 'narrative-roadmap': drawNarrativeRoadmapPptx,
    'narrative-closing': drawNarrativeClosingPptx,
  };
  if (!usesNonDefaultPalette(t) && NARR_PPT[slide.layout]) return NARR_PPT[slide.layout](s, slide, t, v, W, H);
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = pptAcceptedLines(slide);
  const mood = acceptedSlideMood(slide, i);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'STORY PORTFOLIO');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
  if (!isCover && mood === 'toc') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, slide.title || 'Contents', { x: 0.8, y: 0.75, w: 4.4, h: 1.6, fontFace: t.fonts.heading, fontSize: 38, bold: true, color: 'FFFFFF' });
    lines.slice(0, 5).forEach((line, idx) => {
      const y = 0.78 + idx * 1.12;
      addPptText(s, String(idx + 1).padStart(2, '0'), { x: 7.0, y, w: 0.55, h: 0.28, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: hex(v.accent) });
      addPptText(s, line.heading, { x: 7.85, y, w: 4.0, h: 0.3, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: 'FFFFFF' });
      addPptText(s, line.body, { x: 7.85, y: y + 0.34, w: 4.0, h: 0.25, fontFace: t.fonts.body, fontSize: 8, color: 'AFAFAF' });
      s.addShape('rect', { x: 7.0, y: y + 0.86, w: 4.8, h: 0.01, fill: { color: 'FFFFFF', transparency: 82 }, line: { color: 'FFFFFF', transparency: 100 } });
    });
    return;
  }
  if (!isCover && mood === 'metric') {
    const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 3);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, slide.sectionLabel || 'IMPACT', { x: 0.82, y: 0.72, w: 2.5, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.82, y: 1.28, w: 6.4, h: 1.7, fontFace: t.fonts.heading, fontSize: 32, bold: true, color: 'FFFFFF' });
    (metrics.length ? metrics : [{ label: lines[0]?.heading, value: lines[0]?.body }]).slice(0, 3).forEach((m, idx) => {
      const y = 1.0 + idx * 1.7;
      s.addShape('rect', { x: 8.4, y, w: 0.06, h: 0.9, fill: { color: idx === 0 ? hex(v.accent) : 'FFFFFF', transparency: idx === 0 ? 0 : 80 }, line: { color: idx === 0 ? hex(v.accent) : 'FFFFFF', transparency: idx === 0 ? 0 : 100 } });
      addPptText(s, pptAcceptedMetricText(m), { x: 8.7, y, w: 3.3, h: 0.45, fontFace: t.fonts.heading, fontSize: 28, bold: false, color: idx === 0 ? hex(v.accent) : 'FFFFFF' });
      addPptText(s, m?.label || '핵심 성과', { x: 8.7, y: y + 0.58, w: 3.3, h: 0.28, fontFace: t.fonts.body, fontSize: 9, bold: true, color: 'BDBDBD' });
    });
    s.addShape('arc', { x: 11.2, y: 5.65, w: 2.5, h: 2.5, line: { color: hex(v.accent), width: 18, transparency: 55 }, adjustPoint: 0.25 });
    return;
  }
  if (!isCover && mood === 'process') {
    addPptText(s, slide.sectionLabel || 'PROCESS', { x: 0.72, y: 0.55, w: 2.4, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.72, y: 1.1, w: 4.5, h: 1.4, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink) });
    s.addShape('rect', { x: 5.6, y: 3.65, w: 6.4, h: 0.02, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
    lines.slice(0, 4).forEach((line, idx) => {
      const x = 5.5 + idx * 1.7;
      const y = idx % 2 ? 3.9 : 1.65;
      s.addShape('ellipse', { x, y, w: 0.62, h: 0.62, fill: { color: idx === 0 ? hex(v.accent) : hex(v.dark) }, line: { color: idx === 0 ? hex(v.accent) : hex(v.dark) } });
      addPptText(s, String(idx + 1), { x, y: y + 0.15, w: 0.62, h: 0.2, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: idx === 0 ? hex(v.dark) : 'FFFFFF', align: 'center' });
      addPptText(s, line.heading, { x, y: y + 0.82, w: 1.45, h: 0.45, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: hex(v.ink) });
      addPptText(s, line.body, { x, y: y + 1.32, w: 1.5, h: 0.5, fontFace: t.fonts.body, fontSize: 7.3, color: hex(v.muted) });
    });
    return;
  }
  if (!isCover) return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'STORY PORTFOLIO');
  s.addShape('rect', { x: 1.9, y: 0.5, w: 0.01, h: H - 1.0, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
  s.addText('STORY PORTFOLIO', { x: 0.55, y: 0.55, w: 0.35, h: 2.4, rotate: 270, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.muted), charSpacing: 2 });
  s.addText(String(i + 1).padStart(2, '0'), { x: 0.6, y: H - 1.35, w: 0.8, h: 0.5, fontFace: t.fonts.heading, fontSize: 28, bold: true, color: hex(v.accent) });
  addPptText(s, slide.sectionLabel || 'Narrative', { x: 2.45, y: isCover ? 1.25 : 0.72, w: 3.4, h: 0.25, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.accent), charSpacing: 3 });
  addPptText(s, slide.title || '', { x: 2.45, y: isCover ? 1.65 : 1.1, w: 9.5, h: isCover ? 2.0 : 1.1, fontFace: t.fonts.heading, fontSize: isCover ? 39 : 26, bold: true, color: hex(v.ink), fit: 'shrink' });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 2.45, y: isCover ? 3.65 : 2.15, w: 8.5, h: 0.55, fontFace: t.fonts.body, fontSize: 11, color: hex(v.muted), fit: 'shrink' });
  if (!isCover) {
    const count = Math.min(3, Math.max(1, lines.length));
    const cardW = (W - 3.0) / count - 0.18;
    lines.slice(0, 3).forEach((line, idx) => {
      const fill = idx === 0 ? v.dark : v.card;
      const fg = idx === 0 ? 'FFFFFF' : hex(v.ink);
      const x = 2.45 + idx * (cardW + 0.25);
      s.addShape('roundRect', { x, y: 4.0, w: cardW, h: 2.05, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.16 });
      addPptText(s, line.period || `CHAPTER ${idx + 1}`, { x: x + 0.25, y: 4.23, w: cardW - 0.5, h: 0.25, fontFace: t.fonts.body, fontSize: 8, bold: true, color: idx === 0 ? hex(v.accent) : hex(v.muted) });
      addPptText(s, line.heading, { x: x + 0.25, y: 4.62, w: cardW - 0.5, h: 0.52, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: fg });
      addPptText(s, line.body, { x: x + 0.25, y: 5.18, w: cardW - 0.5, h: 0.62, fontFace: t.fonts.body, fontSize: 8.5, color: idx === 0 ? 'D8D8D8' : hex(v.muted) });
    });
  }
}

function drawStarBg(s, v, W, H) {
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
}

function drawStarCoverPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  addPptText(s, 'STAT / STAR', { x: 0.62, y: 0.44, w: 2.2, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.muted), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 0.62, y: 0.95, w: 4.9, h: 1.95, fontFace: t.fonts.heading, fontSize: 44, bold: true, color: hex(v.dark), fit: 'shrink' });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 0.62, y: 3.1, w: 4.8, h: 0.65, fontFace: t.fonts.body, fontSize: 10.5, color: hex(v.muted) });
  ['S', 'T', 'A', 'R'].forEach((lbl, idx) => {
    s.addShape('ellipse', { x: 0.62 + idx * 0.66, y: 4.0, w: 0.46, h: 0.46, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
    addPptText(s, lbl, { x: 0.62 + idx * 0.66, y: 4.08, w: 0.46, h: 0.2, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.dark), align: 'center' });
  });
  const items = slide.items || [];
  const fills = [v.dark, v.card, v.card, v.accent];
  const fgColors = ['FFFFFF', hex(v.ink), hex(v.ink), hex(v.dark)];
  items.slice(0, 4).forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 6.35 + col * 3.55;
    const y = 0.62 + row * 3.25;
    s.addShape('roundRect', { x, y, w: 3.25, h: 2.9, fill: { color: hex(fills[idx]) }, line: { color: idx === 1 || idx === 2 ? hex(v.soft) : hex(fills[idx]) }, rectRadius: 0.2 });
    s.addShape('ellipse', { x: x + 0.28, y: y + 0.28, w: 0.48, h: 0.48, fill: { color: idx === 3 ? hex(v.dark) : hex(v.accent) }, line: { color: idx === 3 ? hex(v.dark) : hex(v.accent) } });
    addPptText(s, ['S', 'T', 'A', 'R'][idx], { x: x + 0.28, y: y + 0.33, w: 0.48, h: 0.2, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: idx === 3 ? hex(v.accent) : hex(v.dark), align: 'center' });
    addPptText(s, ['Situation', 'Task', 'Action', 'Result'][idx], { x: x + 0.95, y: y + 0.35, w: 1.8, h: 0.18, fontFace: t.fonts.body, fontSize: 7, bold: true, color: fgColors[idx], transparency: 40 });
    addPptText(s, item.heading || '', { x: x + 0.28, y: y + 1.1, w: 2.65, h: 0.45, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: fgColors[idx] });
    addPptText(s, item.body || '', { x: x + 0.28, y: y + 1.6, w: 2.65, h: 0.88, fontFace: t.fonts.body, fontSize: 8.5, color: fgColors[idx], transparency: 18 });
  });
}

function drawStarIdentityPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  addPptText(s, (slide.sectionLabel || 'PROFESSIONAL IDENTITY').toUpperCase(), { x: 0.62, y: 0.42, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.muted), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 0.62, y: 0.82, w: 11.8, h: 1.1, fontFace: t.fonts.heading, fontSize: 30, bold: true, color: hex(v.dark) });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 0.62, y: 2.1, w: 7.0, h: 0.25, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
  const items = slide.items || [];
  const cW = (W - 1.54) / 3;
  const icons = ['🎓', '🎯', '⚡'];
  items.slice(0, 3).forEach((item, idx) => {
    const x = 0.62 + idx * (cW + 0.15);
    s.addShape('roundRect', { x, y: 2.55, w: cW, h: H - 3.0, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.18 });
    s.addShape('roundRect', { x: x + 0.28, y: 2.82, w: 0.62, h: 0.62, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.1 });
    addPptText(s, icons[idx] || '■', { x: x + 0.28, y: 2.9, w: 0.62, h: 0.3, fontFace: t.fonts.body, fontSize: 13, align: 'center' });
    addPptText(s, item.heading || '', { x: x + 0.28, y: 3.65, w: cW - 0.56, h: 0.52, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: hex(v.dark) });
    addPptText(s, item.body || '', { x: x + 0.28, y: 4.25, w: cW - 0.56, h: H - 4.72, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
  });
}

function drawStarTimelinePptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  addPptText(s, (slide.sectionLabel || 'EXPERIENCE TIMELINE').toUpperCase(), { x: 0.62, y: 0.42, w: 5.0, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.muted), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 0.62, y: 0.82, w: 11.8, h: 1.0, fontFace: t.fonts.heading, fontSize: 28, bold: true, color: hex(v.dark) });
  s.addShape('rect', { x: 0.82, y: 2.45, w: W - 1.64, h: 0.04, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
  const items = slide.items || [];
  const n = Math.max(1, Math.min(4, items.length));
  const cW = (W - 1.44) / n;
  items.slice(0, 4).forEach((item, idx) => {
    const x = 0.62 + idx * (cW + 0.05);
    const cx = x + cW / 2;
    s.addShape('ellipse', { x: cx - 0.1, y: 2.36, w: 0.2, h: 0.2, fill: { color: idx === 0 ? hex(v.accent) : hex(v.soft) }, line: { color: hex(v.accent) } });
    s.addShape('roundRect', { x, y: 2.75, w: cW - 0.05, h: H - 3.22, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.15 });
    addPptText(s, item.period || `Phase ${idx + 1}`, { x: x + 0.22, y: 3.0, w: cW - 0.44, h: 0.22, fontFace: t.fonts.body, fontSize: 8.5, bold: true, color: hex(v.muted), charSpacing: 1 });
    addPptText(s, item.heading || '', { x: x + 0.22, y: 3.28, w: cW - 0.44, h: 0.52, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.dark) });
    addPptText(s, item.body || '', { x: x + 0.22, y: 3.86, w: cW - 0.44, h: H - 4.32, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted) });
  });
}

function drawStarPhaseBadgePptx(s, t, v, x, y, phase, label) {
  const badgeW = Math.min(4.2, (label || '').length * 0.115 + 0.9);
  s.addShape('roundRect', { x, y, w: badgeW, h: 0.32, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.16 });
  addPptText(s, label || phase, { x: x + 0.1, y: y + 0.05, w: badgeW - 0.2, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.dark), charSpacing: 0.5 });
  s.addShape('ellipse', { x: x + badgeW + 0.1, y: y - 0.02, w: 0.34, h: 0.34, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
  addPptText(s, phase, { x: x + badgeW + 0.1, y: y + 0.05, w: 0.34, h: 0.18, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: hex(v.accent), align: 'center' });
}

function drawStarSituationPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  drawStarPhaseBadgePptx(s, t, v, 0.62, 0.38, 'S', slide.sectionLabel || 'SITUATION');
  addPptText(s, slide.title || '', { x: 0.62, y: 0.9, w: 11.8, h: 1.1, fontFace: t.fonts.heading, fontSize: 28, bold: true, color: hex(v.dark) });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 0.62, y: 2.1, w: 7.5, h: 0.28, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
  const metrics = (slide.metrics || []).slice(0, 2);
  const bodyW = metrics.length ? W - 3.15 : W - 1.24;
  s.addShape('roundRect', { x: 0.62, y: 2.55, w: bodyW, h: H - 3.0, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.2 });
  addPptText(s, 'SITUATION', { x: 0.9, y: 2.85, w: 2.5, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.accent), charSpacing: 2 });
  addPptText(s, slide.body || slide.subtitle || '', { x: 0.9, y: 3.2, w: bodyW - 0.56, h: H - 3.66, fontFace: t.fonts.body, fontSize: 11, color: 'FFFFFF' });
  if (metrics.length) {
    metrics.forEach((m, idx) => {
      const mH = (H - 3.1) / 2 - 0.08;
      const my = 2.55 + idx * (mH + 0.08);
      const mx = W - 2.55;
      s.addShape('roundRect', { x: mx, y: my, w: 2.16, h: mH, fill: { color: idx === 0 ? hex(v.accent) : hex(v.card) }, line: { color: idx === 0 ? hex(v.accent) : hex(v.soft) }, rectRadius: 0.16 });
      addPptText(s, m.value || '', { x: mx + 0.18, y: my + 0.22, w: 1.8, h: 0.55, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.dark) });
      addPptText(s, m.label || '', { x: mx + 0.18, y: my + 0.82, w: 1.8, h: 0.28, fontFace: t.fonts.body, fontSize: 9, bold: true, color: idx === 0 ? hex(v.dark) : hex(v.muted) });
    });
  }
}

function drawStarTaskPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  drawStarPhaseBadgePptx(s, t, v, 0.62, 0.38, 'T', slide.sectionLabel || 'TASK');
  addPptText(s, slide.title || '', { x: 0.62, y: 0.9, w: 11.8, h: 1.1, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(v.dark) });
  const items = slide.items || [];
  const cW = (W - 1.54) / 3;
  items.slice(0, 3).forEach((item, idx) => {
    const x = 0.62 + idx * (cW + 0.15);
    s.addShape('roundRect', { x, y: 2.3, w: cW, h: H - 2.75, fill: { color: hex(v.card) }, line: { color: hex(v.accent), size: 1.2 }, rectRadius: 0.18 });
    addPptText(s, item.period || `TASK ${String(idx + 1).padStart(2, '0')}`, { x: x + 0.24, y: 2.58, w: cW - 0.48, h: 0.22, fontFace: t.fonts.body, fontSize: 8.5, bold: true, color: hex(v.muted), charSpacing: 1 });
    addPptText(s, item.heading || '', { x: x + 0.24, y: 2.88, w: cW - 0.48, h: 0.55, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(v.dark) });
    addPptText(s, item.body || '', { x: x + 0.24, y: 3.5, w: cW - 0.48, h: H - 3.98, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
  });
}

function drawStarActionPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  drawStarPhaseBadgePptx(s, t, v, 0.62, 0.38, 'A', slide.sectionLabel || 'ACTION');
  addPptText(s, slide.title || '', { x: 0.62, y: 0.9, w: 11.8, h: 1.1, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(v.dark) });
  const items = slide.items || [];
  const rH = (H - 3.0) / 3 - 0.1;
  items.slice(0, 3).forEach((item, idx) => {
    const y = 2.35 + idx * (rH + 0.1);
    s.addShape('roundRect', { x: 0.62, y, w: W - 1.24, h: rH, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.14 });
    s.addShape('roundRect', { x: 0.86, y: y + (rH - 0.52) / 2, w: 0.65, h: 0.52, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.1 });
    addPptText(s, item.period || String(idx + 1).padStart(2, '0'), { x: 0.86, y: y + (rH - 0.52) / 2 + 0.12, w: 0.65, h: 0.22, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: hex(v.accent), align: 'center' });
    addPptText(s, item.heading || '', { x: 1.72, y: y + 0.1, w: W - 2.56, h: 0.3, fontFace: t.fonts.heading, fontSize: 12.5, bold: true, color: hex(v.dark) });
    addPptText(s, item.body || '', { x: 1.72, y: y + 0.44, w: W - 2.56, h: rH - 0.56, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
  });
}

function drawStarResultPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  drawStarPhaseBadgePptx(s, t, v, 0.62, 0.38, 'R', slide.sectionLabel || 'RESULT');
  addPptText(s, slide.title || '', { x: 0.62, y: 0.9, w: 11.8, h: 1.1, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(v.dark) });
  const metrics = (slide.metrics || []).slice(0, 3);
  const hasBody = !!slide.body;
  const metricH = hasBody ? H - 4.28 : H - 2.78;
  const mCards = metrics.length ? metrics : [{ label: '성과', value: '달성' }];
  const cW = (W - 1.54) / Math.min(3, mCards.length);
  mCards.slice(0, 3).forEach((m, idx) => {
    const x = 0.62 + idx * (cW + 0.05);
    s.addShape('roundRect', { x, y: 2.35, w: cW - 0.05, h: metricH, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.18 });
    addPptText(s, m.value || '', { x: x + 0.26, y: 2.7, w: cW - 0.57, h: 0.72, fontFace: t.fonts.heading, fontSize: 28, bold: true, color: hex(v.dark) });
    addPptText(s, m.label || '', { x: x + 0.26, y: 3.5, w: cW - 0.57, h: 0.28, fontFace: t.fonts.body, fontSize: 10.5, bold: true, color: hex(v.dark) });
    if (m.body) addPptText(s, m.body, { x: x + 0.26, y: 3.85, w: cW - 0.57, h: metricH - 1.62, fontFace: t.fonts.body, fontSize: 9, color: hex(v.dark), transparency: 40 });
  });
  if (hasBody) {
    s.addShape('roundRect', { x: 0.62, y: H - 1.6, w: W - 1.24, h: 1.22, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.16 });
    addPptText(s, 'KEY TAKEAWAY', { x: 0.9, y: H - 1.46, w: 2.5, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.accent), charSpacing: 2 });
    addPptText(s, slide.body, { x: 0.9, y: H - 1.22, w: W - 1.8, h: 0.72, fontFace: t.fonts.body, fontSize: 11, color: 'FFFFFF' });
  }
}

function drawStarQAPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  addPptText(s, (slide.sectionLabel || 'PREDICTED Q&A').toUpperCase(), { x: 0.62, y: 0.44, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.muted), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 0.62, y: 0.84, w: 11.8, h: 0.95, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.dark) });
  const items = slide.items || [];
  const hW = (W - 1.74) / 2;
  items.slice(0, 2).forEach((item, idx) => {
    const x = 0.62 + idx * (hW + 0.1);
    s.addShape('roundRect', { x, y: 2.0, w: hW, h: H - 2.45, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.18 });
    s.addShape('roundRect', { x: x + 0.24, y: 2.26, w: 0.42, h: 0.38, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.08 });
    addPptText(s, 'Q', { x: x + 0.24, y: 2.31, w: 0.42, h: 0.22, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: hex(v.accent), align: 'center' });
    addPptText(s, item.heading || '', { x: x + 0.82, y: 2.26, w: hW - 1.06, h: 0.72, fontFace: t.fonts.heading, fontSize: 11.5, bold: true, color: hex(v.dark) });
    s.addShape('rect', { x: x + 0.24, y: 3.1, w: hW - 0.48, h: 0.02, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
    s.addShape('roundRect', { x: x + 0.24, y: 3.26, w: 0.42, h: 0.38, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.08 });
    addPptText(s, 'A', { x: x + 0.24, y: 3.31, w: 0.42, h: 0.22, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: hex(v.dark), align: 'center' });
    addPptText(s, item.body || '', { x: x + 0.82, y: 3.26, w: hW - 1.06, h: H - 3.8, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
  });
}

function drawStarAwardsPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  s.addShape('ellipse', { x: 0.62, y: 0.28, w: 0.56, h: 0.56, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
  addPptText(s, '🏆', { x: 0.62, y: 0.36, w: 0.56, h: 0.28, fontFace: t.fonts.body, fontSize: 13, align: 'center' });
  addPptText(s, (slide.sectionLabel || 'HONORS & RECOGNITION').toUpperCase(), { x: 1.35, y: 0.38, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.muted), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 1.35, y: 0.6, w: 10.5, h: 0.62, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.dark) });
  const items = slide.items || [];
  const cW = (W - 1.54) / 3;
  items.slice(0, 3).forEach((item, idx) => {
    const x = 0.62 + idx * (cW + 0.15);
    s.addShape('roundRect', { x, y: 1.52, w: cW, h: H - 1.97, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.18 });
    addPptText(s, item.period || item.role || '', { x: x + 0.24, y: 1.78, w: cW - 0.48, h: 0.22, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.muted), charSpacing: 1 });
    addPptText(s, item.heading || '', { x: x + 0.24, y: 2.06, w: cW - 0.48, h: 0.55, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: hex(v.dark) });
    addPptText(s, item.body || '', { x: x + 0.24, y: 2.68, w: cW - 0.48, h: H - 3.15, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
  });
}

function drawStarRoadmapPptx(s, slide, t, v, W, H) {
  drawStarBg(s, v, W, H);
  s.addShape('ellipse', { x: 0.62, y: 0.28, w: 0.56, h: 0.56, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
  addPptText(s, '🚀', { x: 0.62, y: 0.36, w: 0.56, h: 0.28, fontFace: t.fonts.body, fontSize: 13, align: 'center' });
  addPptText(s, (slide.sectionLabel || 'FUTURE ROADMAP').toUpperCase(), { x: 1.35, y: 0.38, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.muted), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 1.35, y: 0.6, w: 10.5, h: 0.62, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.dark) });
  const items = slide.items || [];
  const cW = (W - 1.54) / 3;
  items.slice(0, 3).forEach((item, idx) => {
    const x = 0.62 + idx * (cW + 0.15);
    s.addShape('roundRect', { x, y: 1.52, w: cW, h: H - 1.97, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.18 });
    addPptText(s, item.period || `Phase ${String(idx + 1).padStart(2, '0')}`, { x: x + 0.24, y: 1.78, w: cW - 0.48, h: 0.22, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.dark), transparency: 30, charSpacing: 1 });
    addPptText(s, item.heading || '', { x: x + 0.24, y: 2.06, w: cW - 0.48, h: 0.58, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: hex(v.dark) });
    addPptText(s, item.body || '', { x: x + 0.24, y: 2.72, w: cW - 0.48, h: H - 3.18, fontFace: t.fonts.body, fontSize: 10, color: hex(v.dark), transparency: 38 });
  });
}

function drawStarClosingPptx(s, slide, t, v, W, H) {
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
  const bW = 2.1;
  s.addShape('roundRect', { x: (W - bW) / 2, y: 1.35, w: bW, h: 0.4, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.2 });
  addPptText(s, 'THANK YOU', { x: (W - bW) / 2, y: 1.42, w: bW, h: 0.24, fontFace: t.fonts.body, fontSize: 8.5, bold: true, color: hex(v.dark), align: 'center', charSpacing: 3 });
  addPptText(s, slide.title || '감사합니다', { x: 0.9, y: 2.05, w: W - 1.8, h: 1.65, fontFace: t.fonts.heading, fontSize: 52, bold: true, color: hex(v.accent), align: 'center' });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 1.0, y: 3.95, w: W - 2.0, h: 0.42, fontFace: t.fonts.body, fontSize: 11.5, color: 'CFCFCF', align: 'center' });
  const bullets = slide.bullets || [];
  if (bullets.length) {
    const bItemW = Math.min(2.6, (W - 1.4) / bullets.length);
    const startX = (W - bItemW * bullets.length - 0.1 * (bullets.length - 1)) / 2;
    bullets.slice(0, 5).forEach((b, idx) => {
      const bx = startX + idx * (bItemW + 0.1);
      s.addShape('roundRect', { x: bx, y: 4.72, w: bItemW, h: 0.4, fill: { color: 'FFFFFF', transparency: 88 }, line: { color: 'FFFFFF', transparency: 78 }, rectRadius: 0.2 });
      addPptText(s, b, { x: bx, y: 4.78, w: bItemW, h: 0.26, fontFace: t.fonts.body, fontSize: 8.5, color: 'FFFFFF', align: 'center', transparency: 20 });
    });
  }
}

function drawStarPptx(s, slide, t, v, i, W, H) {
  const l = slide.layout;
  if (l === 'star-cover') return drawStarCoverPptx(s, slide, t, v, W, H);
  if (l === 'star-identity') return drawStarIdentityPptx(s, slide, t, v, W, H);
  if (l === 'star-timeline') return drawStarTimelinePptx(s, slide, t, v, W, H);
  if (l === 'star-situation') return drawStarSituationPptx(s, slide, t, v, W, H);
  if (l === 'star-task') return drawStarTaskPptx(s, slide, t, v, W, H);
  if (l === 'star-action') return drawStarActionPptx(s, slide, t, v, W, H);
  if (l === 'star-result') return drawStarResultPptx(s, slide, t, v, W, H);
  if (l === 'star-qa') return drawStarQAPptx(s, slide, t, v, W, H);
  if (l === 'star-awards') return drawStarAwardsPptx(s, slide, t, v, W, H);
  if (l === 'star-roadmap') return drawStarRoadmapPptx(s, slide, t, v, W, H);
  if (l === 'star-closing') return drawStarClosingPptx(s, slide, t, v, W, H);
  const isCover = l === 'cover' || l === 'section';
  const lines = pptAcceptedLines(slide);
  const mood = acceptedSlideMood(slide, i);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'STAT / STAR');
  drawStarBg(s, v, W, H);
  if (!isCover && mood === 'toc') {
    s.addShape('roundRect', { x: 0.65, y: 0.65, w: 3.9, h: 6.1, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.22 });
    addPptText(s, 'EVIDENCE MAP', { x: 1.0, y: 1.0, w: 2.2, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 1.0, y: 4.0, w: 2.8, h: 1.3, fontFace: t.fonts.heading, fontSize: 25, bold: true, color: 'FFFFFF' });
    lines.slice(0, 4).forEach((line, idx) => {
      const x = 5.0 + (idx % 2) * 3.65;
      const y = 0.8 + Math.floor(idx / 2) * 2.95;
      const fill = idx === 3 ? v.accent : v.card;
      s.addShape('roundRect', { x, y, w: 3.25, h: 2.55, fill: { color: hex(fill) }, line: { color: idx === 3 ? hex(fill) : hex(v.soft) }, rectRadius: 0.18 });
      addPptText(s, String(idx + 1).padStart(2, '0'), { x: x + 0.25, y: y + 0.25, w: 0.7, h: 0.32, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.dark) });
      addPptText(s, line.heading, { x: x + 0.25, y: y + 1.15, w: 2.55, h: 0.42, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.dark) });
      addPptText(s, line.body, { x: x + 0.25, y: y + 1.65, w: 2.55, h: 0.45, fontFace: t.fonts.body, fontSize: 7.5, color: hex(v.dark), transparency: 25 });
    });
    return;
  }
  if (!isCover) return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'STAT / STAR');
  addPptText(s, 'STAT / STAR', { x: 0.58, y: 0.48, w: 2.2, h: 0.25, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.ink), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 0.58, y: 1.15, w: 4.5, h: 2.4, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: hex(v.ink), fit: 'shrink' });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 0.58, y: 3.8, w: 4.2, h: 0.75, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted) });
  const labels = ['S', 'T', 'A', 'R'];
  labels.forEach((label, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 5.55 + col * 3.75;
    const y = 1.1 + row * 2.6;
    const fill = idx === 3 ? v.accent : idx === 0 ? v.dark : v.card;
    const fg = idx === 3 ? hex(v.dark) : idx === 0 ? 'FFFFFF' : hex(v.ink);
    s.addShape('roundRect', { x, y, w: 3.45, h: 2.25, fill: { color: hex(fill) }, line: { color: idx === 1 || idx === 2 ? hex(v.soft) : hex(fill) }, rectRadius: 0.18 });
    s.addShape('ellipse', { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: idx === 3 ? hex(v.dark) : hex(v.accent) }, line: { color: idx === 3 ? hex(v.dark) : hex(v.accent) } });
    addPptText(s, label, { x: x + 0.25, y: y + 0.31, w: 0.55, h: 0.24, fontFace: t.fonts.heading, fontSize: 17, bold: true, color: idx === 3 ? hex(v.accent) : hex(v.dark), align: 'center' });
    addPptText(s, ['Situation', 'Task', 'Action', 'Result'][idx], { x: x + 1.0, y: y + 0.34, w: 1.9, h: 0.2, fontFace: t.fonts.body, fontSize: 7, bold: true, color: fg, transparency: 40 });
    addPptText(s, lines[idx]?.heading || ['상황', '과제', '행동', '결과'][idx], { x: x + 0.28, y: y + 1.05, w: 2.9, h: 0.38, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: fg });
    addPptText(s, lines[idx]?.body || '', { x: x + 0.28, y: y + 1.48, w: 2.9, h: 0.5, fontFace: t.fonts.body, fontSize: 8, color: fg, transparency: idx === 3 ? 15 : 25 });
  });
}

// ── KPI Dashboard dedicated PPTX draw functions ─────────────────────────────

function kpiPptColors(t) {
  const c = t?.colors || {};
  const { blue, mint } = kpiPaletteColors(t);
  const bg = c.dark || c.side || '#0E1727';
  const panel = c.dark2 || hexLighten(bg, 0.08);
  const line = c.line || hexLighten(blue, 0.55);
  const muted = c.muted || '#7E93B3';
  return {
    bg: hex(bg),
    blue: hex(blue),
    mint: hex(mint),
    muted: hex(muted),
    panel: hex(panel),
    line: hex(line),
    ink: hex(readableTextOn(bg, '#EAF2FF')),
    title: hex(readableTextOn(bg, c.sub || '#EAF2FF')),
  };
}

function kpiPptBase(s, W, H, t) {
  const { bg, blue } = kpiPptColors(t);
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: bg }, line: { color: bg } });
  for (let gx = 0; gx <= W; gx += 0.42) s.addShape('rect', { x: gx, y: 0, w: 0.003, h: H, fill: { color: blue, transparency: 94 }, line: { color: blue, transparency: 100 } });
  for (let gy = 0; gy <= H; gy += 0.42) s.addShape('rect', { x: 0, y: gy, w: W, h: 0.003, fill: { color: blue, transparency: 94 }, line: { color: blue, transparency: 100 } });
}

function kpiPptHeader(s, t, label, title, y = 0.62, w = 8.5, labelColor = '3182FF') {
  const mono = 'Consolas'; const { title: ink, blue } = kpiPptColors(t);
  const resolvedLabelColor = labelColor === '3182FF' ? blue : labelColor;
  addPptText(s, label, { x: 0.82, y, w: 5.0, h: 0.18, fontFace: mono, fontSize: 8.4, bold: true, color: resolvedLabelColor, charSpacing: 2.4, fit: 'shrink' });
  addPptText(s, title, { x: 0.82, y: y + 0.64, w, h: 0.72, fontFace: t.fonts.heading || 'Malgun Gothic', fontSize: dynamicFontPt(title, 30, { min: 22, max: 34 }), bold: true, color: ink, fit: 'shrink' });
}

function kpiPptRule(s, x, y, w, color = '31405A') {
  s.addShape('rect', { x, y, w, h: 0.01, fill: { color, transparency: 8 }, line: { color, transparency: 100 } });
}

function kpiPptMetricRow(s, t, cards, dataRows, top) {
  const mono = 'Consolas'; const { blue, mint, muted } = kpiPptColors(t);
  const tf = t.fonts.heading || 'Malgun Gothic'; const tb = t.fonts.body || 'Malgun Gothic';
  cards.forEach((m, idx) => {
    const x = 0.82 + idx * 4.05;
    const dv = safePptText(metricDisplayValue(m));
    kpiPptRule(s, x, top, 3.45);
    addPptText(s, safePptText(m.label || `KPI ${idx + 1}`).toUpperCase(), { x, y: top + 0.2, w: 2.8, h: 0.16, fontFace: mono, fontSize: 7.2, bold: true, color: blue, charSpacing: 0.8, fit: 'shrink' });
    addPptText(s, dv, { x, y: top + 0.62, w: 2.5, h: 0.5, fontFace: tf, fontSize: kpiMetricValueFontPt(dv, 29), bold: true, color: mint, fit: 'shrink' });
    addPptText(s, safePptText(dataRows[idx]?.body || m.body || ''), { x, y: top + 1.22, w: 3.1, h: 0.28, fontFace: tb, fontSize: 7.8, color: muted, fit: 'shrink' });
  });
}

function drawKpiCoverPptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tf = t.fonts.heading || 'Malgun Gothic';
  const { blue, mint, muted, title: ink } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Portfolio');
  const subtitle = safePptText(slide.subtitle || '');
  kpiPptBase(s, W, H, t);
  addPptText(s, 'PERFORMANCE DASHBOARD', { x: 0.82, y: 0.22, w: 4.2, h: 0.18, fontFace: mono, fontSize: 9, bold: true, color: blue, charSpacing: 2.8 });
  s.addShape('ellipse', { x: 0.83, y: 0.5, w: 0.08, h: 0.08, fill: { color: mint }, line: { color: mint } });
  addPptText(s, 'SYSTEM ONLINE', { x: 0.98, y: 0.47, w: 1.5, h: 0.14, fontFace: mono, fontSize: 6.5, color: muted, charSpacing: 0.6 });
  addPptText(s, 'DATA SYNCED', { x: 5.35, y: 0.47, w: 1.8, h: 0.14, fontFace: mono, fontSize: 6.5, color: muted, charSpacing: 0.6 });
  addPptText(s, 'SECURE ACCESS', { x: 10.65, y: 0.47, w: 1.5, h: 0.14, fontFace: mono, fontSize: 6.5, color: muted, charSpacing: 0.6, align: 'right' });
  addPptText(s, title, { x: 0.82, y: 0.8, w: 8.2, h: 1.55, fontFace: tf, fontSize: 44, bold: true, color: ink, fit: 'shrink' });
  addPptText(s, subtitle || '2021-2026 Growth Metrics & Strategic Impact', { x: 0.82, y: 2.95, w: 6.9, h: 0.24, fontFace: mono, fontSize: 14, bold: true, color: mint, fit: 'shrink' });
  kpiPptRule(s, 0.82, 6.15, 11.7);
  ['VERSION', 'CORE COMPETENCY', 'FOCUS AREA', 'STATUS'].forEach((h, idx) => {
    const x = 0.82 + idx * 3.05;
    addPptText(s, h, { x, y: 6.45, w: 1.5, h: 0.13, fontFace: mono, fontSize: 6.4, color: muted });
    addPptText(s, (slide.bullets || [])[idx] || ['3.0.0-PRO', 'AI Architecture & Full-Stack', 'Growth Metrics', 'Ready for Impact'][idx], { x, y: 6.68, w: 2.4, h: 0.18, fontFace: mono, fontSize: 9, bold: true, color: 'FFFFFF', fit: 'shrink' });
  });
}

function drawKpiExecutivePptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tf = t.fonts.heading || 'Malgun Gothic'; const tb = t.fonts.body || 'Malgun Gothic';
  const { blue, mint, muted, panel, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Performance Overview');
  const label = safePptText(slide.sectionLabel || 'EXECUTIVE SUMMARY').toUpperCase();
  const cards = (slide.metrics || []).slice(0, 4);
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.62, 8.5);
  cards.forEach((m, idx) => {
    const x = 0.82 + idx * 3.05;
    const dv = safePptText(metricDisplayValue(m));
    s.addShape('rect', { x, y: 2.45, w: 2.82, h: 1.35, fill: { color: panel, transparency: 10 }, line: { color: line, transparency: 8 } });
    addPptText(s, safePptText(m.label || `KPI ${idx + 1}`).toUpperCase(), { x: x + 0.18, y: 2.65, w: 2.2, h: 0.14, fontFace: mono, fontSize: 7, bold: true, color: blue, charSpacing: 0.8 });
    addPptText(s, dv, { x: x + 0.18, y: 3.0, w: 2.2, h: 0.42, fontFace: tf, fontSize: kpiMetricValueFontPt(dv, 26), bold: true, color: mint, fit: 'shrink' });
    addPptText(s, safePptText(m.body || ''), { x: x + 0.18, y: 3.52, w: 2.4, h: 0.18, fontFace: tb, fontSize: 7.5, color: muted, fit: 'shrink' });
  });
  addPptText(s, 'COMPETENCY DISTRIBUTION', { x: 0.82, y: 6.25, w: 3.0, h: 0.13, fontFace: mono, fontSize: 6.8, color: muted });
  s.addShape('rect', { x: 0.82, y: 6.55, w: 11.7, h: 0.28, fill: { color: '1E2E45' }, line: { color: '1E2E45' } });
  s.addShape('rect', { x: 0.82, y: 6.55, w: 9.1, h: 0.28, fill: { color: mint }, line: { color: mint } });
}

function drawKpiSkillsPptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tb = t.fonts.body || 'Malgun Gothic';
  const { blue, mint, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Core Competency Analysis');
  const label = safePptText(slide.sectionLabel || 'SKILL ARCHITECTURE').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.62, 8.5);
  items.forEach((item, idx) => {
    const x = 0.82 + (idx % 2) * 6.0;
    const y = 2.45 + Math.floor(idx / 2) * 1.65;
    kpiPptRule(s, x, y, 5.55, line);
    addPptText(s, (item.period || item.role || `COMPETENCY ${idx + 1}`).toUpperCase(), { x, y: y + 0.25, w: 3.0, h: 0.14, fontFace: mono, fontSize: 7.2, bold: true, color: idx % 2 ? mint : blue, charSpacing: 0.8 });
    [item.heading, item.body].filter(Boolean).slice(0, 2).forEach((skill, j) => {
      const pct = 95 - idx * 3 - j * 5;
      addPptText(s, safePptText(skill), { x, y: y + 0.62 + j * 0.42, w: 3.9, h: 0.16, fontFace: tb, fontSize: 8.8, color: 'FFFFFF', fit: 'shrink' });
      addPptText(s, `${pct}%`, { x: x + 4.65, y: y + 0.62 + j * 0.42, w: 0.7, h: 0.16, fontFace: tb, fontSize: 8.2, color: 'FFFFFF', align: 'right' });
      s.addShape('rect', { x, y: y + 0.86 + j * 0.42, w: 5.35, h: 0.035, fill: { color: '24344D' }, line: { color: '24344D' } });
      s.addShape('rect', { x, y: y + 0.86 + j * 0.42, w: 5.35 * pct / 100, h: 0.035, fill: { color: idx % 2 ? mint : blue }, line: { color: idx % 2 ? mint : blue } });
    });
  });
}

function drawKpiTimelinePptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tf = t.fonts.heading || 'Malgun Gothic'; const tb = t.fonts.body || 'Malgun Gothic';
  const { blue, mint } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Performance Timeline');
  const label = safePptText(slide.sectionLabel || 'GROWTH ANALYTICS').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 7.8);
  kpiPptRule(s, 0.85, 3.45, 11.4, blue);
  items.forEach((item, idx) => {
    const x = 1.0 + idx * 3.0;
    const top = idx % 2 === 0;
    s.addShape('ellipse', { x: x - 0.08, y: 3.35, w: 0.2, h: 0.2, fill: { color: blue }, line: { color: '081326', width: 2 } });
    addPptText(s, safePptText(item.period || `0${idx + 1}`), { x: x - 0.55, y: top ? 2.05 : 3.75, w: 1.2, h: 0.2, fontFace: mono, fontSize: 11, bold: true, color: mint, align: 'center' });
    addPptText(s, safePptText(item.heading), { x: x - 0.9, y: top ? 2.48 : 4.18, w: 1.9, h: 0.24, fontFace: tf, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
    addPptText(s, safePptText(item.body), { x: x - 0.9, y: top ? 2.85 : 4.55, w: 1.9, h: 0.32, fontFace: tb, fontSize: 7.2, color: 'A9C7E8', align: 'center', fit: 'shrink' });
  });
}

function drawKpiProjectPptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tf = t.fonts.heading || 'Malgun Gothic'; const tb = t.fonts.body || 'Malgun Gothic';
  const { blue, mint, muted, panel, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Project');
  const subtitle = safePptText(slide.subtitle || '');
  const label = safePptText(slide.sectionLabel || 'PROJECT CASE').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 7.2);
  addPptText(s, subtitle || items[0]?.period || 'AI-Driven Platform', { x: 0.82, y: 2.2, w: 6.5, h: 0.22, fontFace: mono, fontSize: 11, bold: true, color: mint, fit: 'shrink' });
  kpiPptRule(s, 0.82, 2.75, 6.8, line);
  addPptText(s, 'CORE MISSION', { x: 0.82, y: 2.95, w: 1.6, h: 0.13, fontFace: mono, fontSize: 6.8, color: blue, charSpacing: 0.5 });
  addPptText(s, safePptText(items[0]?.body || items[0]?.heading || subtitle), { x: 0.82, y: 3.35, w: 6.6, h: 0.82, fontFace: tb, fontSize: 13, bold: true, color: 'FFFFFF', fit: 'shrink' });
  s.addShape('rect', { x: 7.9, y: 2.75, w: 4.5, h: 1.45, fill: { color: panel, transparency: 32 }, line: { color: blue, transparency: 65 } });
  addPptText(s, safePptText(items[1]?.heading || 'Lead Developer'), { x: 8.1, y: 2.97, w: 2.8, h: 0.24, fontFace: tf, fontSize: 14, bold: true, color: blue, fit: 'shrink' });
  items.slice(1, 4).forEach((item, idx) => addPptText(s, `✓ ${safePptText(item.body || item.heading)}`, { x: 8.1, y: 3.32 + idx * 0.28, w: 3.8, h: 0.16, fontFace: tb, fontSize: 8.8, color: 'A9C7E8', fit: 'shrink' }));
  kpiPptRule(s, 0.82, 6.15, 11.7, line);
  ['TIMELINE', 'TECH STACK', 'STATUS', 'IMPACT'].forEach((h, idx) => {
    const x = 0.82 + idx * 3.1;
    addPptText(s, h, { x, y: 6.35, w: 1.4, h: 0.13, fontFace: mono, fontSize: 6.5, color: muted });
    addPptText(s, safePptText(items[idx]?.period || items[idx]?.heading || ['2026.04-2026.05', 'React, Node.js', 'Production Ready', 'Impact Verified'][idx]), { x, y: 6.62, w: 2.5, h: 0.18, fontFace: mono, fontSize: 8.5, bold: true, color: 'FFFFFF', fit: 'shrink' });
  });
}

function drawKpiMetricsPptx(s, slide, t, W, H) {
  const mono = 'Consolas';
  const { blue, mint, muted, panel, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'KPI Dashboard');
  const label = safePptText(slide.sectionLabel || 'KPI METRICS').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Efficiency', value: '85%', body: 'Measured performance' },
    { label: 'Reliability', value: '99.9%', body: 'System stability' },
    { label: 'Impact', value: '94%', body: 'Business impact' },
  ];
  const chartTitle = safePptText((slide.items || [])[0]?.heading || 'VALUE DELIVERY TREND').toUpperCase();
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 8.4);
  kpiPptMetricRow(s, t, metricCards, metricCards, 2.25);
  s.addShape('rect', { x: 0.82, y: 4.85, w: 11.7, h: 1.75, fill: { color: panel, transparency: 8 }, line: { color: line, transparency: 8 } });
  addPptText(s, chartTitle, { x: 1.05, y: 5.07, w: 5.0, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: 'A9C7E8', charSpacing: 0.8 });
  addPptText(s, 'TOTAL IMPACT VERIFIED', { x: 9.45, y: 5.07, w: 2.6, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: mint, align: 'right', fit: 'shrink' });
  [0, 1, 2, 3, 4].forEach(row => kpiPptRule(s, 1.35, 6.22 - row * 0.24, 10.45, '2C3B55'));
  [0.45, 0.65, 0.86, 0.58].forEach((h, idx) => {
    const x = 1.72 + idx * 2.25;
    s.addShape('rect', { x, y: 6.22 - h, w: 0.76, h, fill: { color: idx % 2 ? mint : blue }, line: { color: idx % 2 ? mint : blue } });
    s.addShape('rect', { x: x + 0.92, y: 6.22 - Math.max(0.2, h - 0.18), w: 0.76, h: Math.max(0.2, h - 0.18), fill: { color: muted, transparency: 55 }, line: { color: muted, transparency: 100 } });
  });
}

function drawKpiComparisonPptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tf = t.fonts.heading || 'Malgun Gothic'; const tb = t.fonts.body || 'Malgun Gothic';
  const { blue, mint, muted, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Before vs After');
  const label = safePptText(slide.sectionLabel || 'COMPARISON').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 8.8);
  const drawSide = (x, heading, sideItems, good) => {
    addPptText(s, heading, { x, y: 2.28, w: 3.8, h: 0.18, fontFace: mono, fontSize: 9, bold: true, color: good ? mint : muted, fit: 'shrink' });
    sideItems.slice(0, 2).forEach((item, idx) => {
      const y = 2.92 + idx * 0.92;
      s.addShape('rect', { x, y, w: 0.45, h: 0.45, fill: { color: '0E1727', transparency: 100 }, line: { color: good ? blue : line, transparency: 0 } });
      addPptText(s, good ? '✓' : '□', { x: x + 0.12, y: y + 0.13, w: 0.18, h: 0.12, fontFace: mono, fontSize: 8, color: good ? blue : muted });
      addPptText(s, safePptText(item.heading), { x: x + 0.65, y: y + 0.06, w: 3.4, h: 0.2, fontFace: tf, fontSize: 11, bold: true, color: 'FFFFFF', fit: 'shrink' });
      addPptText(s, safePptText(item.body), { x: x + 0.65, y: y + 0.36, w: 3.5, h: 0.22, fontFace: tb, fontSize: 7.5, color: 'A9C7E8', fit: 'shrink' });
    });
    kpiPptRule(s, x, 4.4, 4.9, line);
    addPptText(s, 'AVERAGE PROCESSING TIME', { x, y: 4.68, w: 2.4, h: 0.13, fontFace: mono, fontSize: 6.8, color: muted });
    addPptText(s, good ? '10 MIN' : '300 MIN', { x, y: 5.45, w: 2.2, h: 0.32, fontFace: tf, fontSize: 20, bold: true, color: good ? mint : 'FFFFFF' });
  };
  drawSide(1.12, 'BEFORE: MANUAL PROCESS', items.slice(0, 2), false);
  s.addShape('rect', { x: 6.55, y: 2.05, w: 0.02, h: 4.15, fill: { color: '172338' }, line: { color: '172338' } });
  drawSide(7.05, 'AFTER: AI-DRIVEN WORKFLOW', items.slice(2, 4).length ? items.slice(2, 4) : items.slice(0, 2), true);
}

function drawKpiTechnicalPptx(s, slide, t, W, H) {
  const mono = 'Consolas';
  const { blue, mint, muted, panel, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Technical Performance KPI');
  const label = safePptText(slide.sectionLabel || 'TECHNICAL KPI').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'System Uptime', value: '99.9%', body: 'High availability' },
    { label: 'API Success', value: '99.95%', body: 'Error-free operations' },
    { label: 'Security Score', value: 'A+', body: 'Zero vulnerabilities' },
  ];
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 8.4, muted);
  kpiPptMetricRow(s, t, metricCards, metricCards, 2.25);
  s.addShape('rect', { x: 0.82, y: 4.85, w: 11.7, h: 1.75, fill: { color: panel, transparency: 8 }, line: { color: line, transparency: 8 } });
  addPptText(s, 'RESPONSE LATENCY TREND', { x: 1.05, y: 5.07, w: 4.0, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: 'A9C7E8', charSpacing: 0.8 });
  addPptText(s, 'PERFORMANCE OPTIMIZED', { x: 9.45, y: 5.07, w: 2.6, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: mint, align: 'right', fit: 'shrink' });
  const lineY = [6.22, 5.98, 5.74, 5.5, 5.26];
  lineY.forEach(y => kpiPptRule(s, 1.35, y, 10.45, '2C3B55'));
  [30, 55, 42, 70, 60, 85, 78].forEach((h, idx) => {
    const normH = h / 100 * 0.95;
    const x = 1.6 + idx * 1.45;
    s.addShape('ellipse', { x, y: 6.22 - normH, w: 0.08, h: 0.08, fill: { color: mint }, line: { color: mint } });
    if (idx < 6) {
      const nx = 1.6 + (idx + 1) * 1.45;
      const ny = 6.22 - [30, 55, 42, 70, 60, 85][idx + 1 < 7 ? idx + 1 : idx] / 100 * 0.95;
      s.addShape('rect', { x, y: 6.22 - normH, w: nx - x, h: 0.015, fill: { color: blue }, line: { color: blue } });
    }
  });
}

function drawKpiRiskPptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tf = t.fonts.heading || 'Malgun Gothic'; const tb = t.fonts.body || 'Malgun Gothic';
  const { blue, mint, muted, line } = kpiPptColors(t); const amber = 'F59E0B';
  const title = safePptText(slide.title || 'Risk Management & Mitigation');
  const label = safePptText(slide.sectionLabel || 'RISK MANAGEMENT').toUpperCase();
  const items = (slide.items || []).slice(0, 4);
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 8.3, amber);
  items.slice(0, 2).forEach((item, idx) => {
    const x = 0.82 + idx * 6.15;
    kpiPptRule(s, x, 2.55, 5.55, line);
    addPptText(s, idx ? 'TECHNICAL CONSTRAINT' : 'SECURITY THREAT', { x, y: 2.88, w: 2.6, h: 0.15, fontFace: mono, fontSize: 7.2, bold: true, color: idx ? mint : amber, charSpacing: 0.7 });
    addPptText(s, safePptText(item.heading), { x, y: 3.45, w: 4.7, h: 0.26, fontFace: tf, fontSize: 14, bold: true, color: 'FFFFFF', fit: 'shrink' });
    addPptText(s, safePptText(item.body), { x, y: 3.95, w: 5.2, h: 0.52, fontFace: tb, fontSize: 9.2, color: 'A9C7E8', fit: 'shrink' });
    s.addShape('rect', { x, y: 4.85, w: 5.55, h: 0.52, fill: { color: '0E1727', transparency: 100 }, line: { color: line, transparency: 4 } });
    addPptText(s, `MITIGATION: ${safePptText(item.period || 'Verified control')}\nRESULT: ${idx ? '80% Risk Reduction' : '100% Prevention'}`, { x: x + 0.18, y: 5.0, w: 4.9, h: 0.2, fontFace: mono, fontSize: 7.5, bold: true, color: blue, fit: 'shrink' });
  });
  addPptText(s, 'SYSTEM INTEGRITY INDEX', { x: 0.82, y: 6.05, w: 2.2, h: 0.13, fontFace: mono, fontSize: 6.8, color: muted });
  s.addShape('rect', { x: 0.82, y: 6.35, w: 11.7, h: 0.32, fill: { color: '223149' }, line: { color: '223149' } });
  s.addShape('rect', { x: 0.82, y: 6.35, w: 10.7, h: 0.32, fill: { color: mint }, line: { color: mint } });
}

function drawKpiCumulativePptx(s, slide, t, W, H) {
  const mono = 'Consolas';
  const { blue, mint, panel, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Cumulative Impact Analysis');
  const label = safePptText(slide.sectionLabel || 'CUMULATIVE IMPACT').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Projects', value: '03', body: '주요 경험' },
    { label: 'Skills', value: '12+', body: '기술 스택' },
    { label: 'Awards', value: '02', body: '수상/인증' },
  ];
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 8.4);
  kpiPptMetricRow(s, t, metricCards, metricCards, 2.25);
  s.addShape('rect', { x: 0.82, y: 4.85, w: 11.7, h: 1.75, fill: { color: panel, transparency: 8 }, line: { color: line, transparency: 8 } });
  addPptText(s, 'CUMULATIVE PERFORMANCE COMPARISON', { x: 1.05, y: 5.07, w: 5.5, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: 'A9C7E8', charSpacing: 0.8 });
  addPptText(s, '3 PROJECTS VERIFIED', { x: 9.45, y: 5.07, w: 2.6, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: mint, align: 'right', fit: 'shrink' });
  [0, 1, 2, 3, 4].forEach(row => kpiPptRule(s, 1.35, 6.22 - row * 0.24, 10.45, '2C3B55'));
  [65, 82, 90].forEach((h, idx) => {
    const bh = h / 100 * 1.15;
    const mh = Math.max(0.2, bh - 0.2);
    const x = 1.72 + idx * 3.5;
    s.addShape('rect', { x, y: 6.22 - bh, w: 0.76, h: bh, fill: { color: blue }, line: { color: blue } });
    s.addShape('rect', { x: x + 0.92, y: 6.22 - mh, w: 0.76, h: mh, fill: { color: mint }, line: { color: mint } });
  });
}

function drawKpiRoadmapPptx(s, slide, t, W, H) {
  const mono = 'Consolas'; const tf = t.fonts.heading || 'Malgun Gothic'; const tb = t.fonts.body || 'Malgun Gothic';
  const { blue, mint, panel, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Future Growth KPI & Roadmap');
  const label = safePptText(slide.sectionLabel || 'VISION & GROWTH').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Next Milestone', value: 'Q3', body: '다음 성장 목표' },
    { label: 'Skill Target', value: 'AI+', body: '확장할 기술 스택' },
    { label: 'Project Impact', value: '×3', body: '목표 임팩트' },
  ];
  const phases = (slide.items || []).slice(0, 3);
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 0.8, 8.4);
  kpiPptMetricRow(s, t, metricCards, metricCards, 2.25);
  s.addShape('rect', { x: 0.82, y: 4.85, w: 11.7, h: 1.55, fill: { color: panel, transparency: 10 }, line: { color: line, transparency: 8 } });
  addPptText(s, 'TECHNICAL GROWTH ROADMAP', { x: 1.08, y: 5.08, w: 3.0, h: 0.16, fontFace: mono, fontSize: 7.5, bold: true, color: 'A9C7E8', charSpacing: 0.8 });
  phases.forEach((phase, idx) => {
    const x = 1.15 + idx * 3.75;
    s.addShape('rect', { x, y: 5.55, w: 0.02, h: 0.5, fill: { color: blue }, line: { color: blue } });
    addPptText(s, safePptText(phase.period || `PHASE ${idx + 1}`), { x: x + 0.18, y: 5.4, w: 1.5, h: 0.13, fontFace: mono, fontSize: 6.8, color: blue });
    addPptText(s, safePptText(phase.heading), { x: x + 0.18, y: 5.62, w: 2.7, h: 0.2, fontFace: tf, fontSize: 10.5, bold: true, color: 'FFFFFF', fit: 'shrink' });
    addPptText(s, safePptText(phase.body), { x: x + 0.18, y: 5.88, w: 2.8, h: 0.28, fontFace: tb, fontSize: 7.2, color: 'A9C7E8', fit: 'shrink' });
  });
}

function drawKpiClosingPptx(s, slide, t, W, H) {
  const mono = 'Consolas';
  const { blue, mint, muted, line } = kpiPptColors(t);
  const title = safePptText(slide.title || 'Thank You for Your Time');
  const subtitle = safePptText(slide.subtitle || '');
  const label = safePptText(slide.sectionLabel || 'FINAL REPORT').toUpperCase();
  const rawMetrics = (slide.metrics || []).slice(0, 3);
  const metricCards = rawMetrics.length ? rawMetrics : [
    { label: 'Total Efficiency', value: '85% UP' },
    { label: 'System Stability', value: '99.9%' },
    { label: 'AI Innovation', value: '94% ACC' },
  ];
  const bullets = slide.bullets || [];
  kpiPptBase(s, W, H, t);
  kpiPptHeader(s, t, label, title, 1.18, 8.6);
  if (subtitle) addPptText(s, subtitle, { x: 0.82, y: 3.25, w: 7.2, h: 0.24, fontFace: mono, fontSize: 12, bold: true, color: mint, fit: 'shrink' });
  kpiPptMetricRow(s, t, metricCards, metricCards, 4.0);
  kpiPptRule(s, 0.82, 6.2, 11.7, line);
  (bullets.length ? bullets : ['yushin.kim@example.com', 'github.com/yushinkim', 'portfolio link', 'Seoul, KR']).slice(0, 4).forEach((item, idx) => {
    const x = 0.82 + idx * 3.0;
    addPptText(s, ['EMAIL', 'GITHUB', 'PORTFOLIO', 'LOCATION'][idx], { x, y: 6.45, w: 1.3, h: 0.13, fontFace: mono, fontSize: 6.5, color: muted });
    addPptText(s, safePptText(item), { x, y: 6.68, w: 2.45, h: 0.18, fontFace: mono, fontSize: 8.8, bold: true, color: blue, fit: 'shrink' });
  });
}

function drawKpiReferencePptx(s, slide, t, v, i, W, H) {
  const lines = pptAcceptedLines(slide);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const mood = acceptedSlideMood(slide, i);
  const source = safePptText(`${slide.layout || ''} ${slide.sectionLabel || ''} ${slide.title || ''} ${slide.subtitle || ''} ${slide.proposalVariant || ''}`).toLowerCase();
  const hasAny = terms => terms.some(term => source.includes(term));
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const title = safePptText(slide.title || 'Performance Dashboard');
  const subtitle = safePptText(slide.subtitle || '');
  const label = safePptText(slide.sectionLabel || (isCover ? 'PERFORMANCE DASHBOARD' : 'EXECUTIVE SUMMARY')).toUpperCase();
  const data = lines.length ? lines : [
    { heading: 'Efficiency', body: subtitle || title, period: '85%' },
    { heading: 'Reliability', body: 'System stability and operational quality', period: '99.9%' },
    { heading: 'Impact', body: 'Business impact and technical execution', period: '94%' },
  ];
  let kind = kpiReferenceSequenceKind(i);
  if (isCover) kind = 'cover';
  else if (slide.layout === 'closing' || slide.proposalVariant === 'closing' || mood === 'closing' || hasAny(['thank', 'final'])) kind = 'closing';
  else if (hasAny(['before', 'after', 'workflow', 'transformation', 'manual', 'traditional'])) kind = 'beforeAfter';
  else if (hasAny(['risk', 'audit', 'mitigation', 'security', 'integrity', 'vulnerability', 'bias', 'debt'])) kind = 'risk';
  else if (hasAny(['timeline', 'growth analytics', 'milestone'])) kind = 'timeline';
  else if (hasAny(['skill', 'competency', 'architecture', 'stack'])) kind = 'skills';
  else if (hasAny(['project case', 'case ', 'core mission', 'platform']) || slide.layout === 'experience') kind = 'project';
  else if (hasAny(['roadmap', 'future', 'vision', 'growth'])) kind = 'roadmap';
  else if (metrics.length || mood === 'metric' || hasAny(['kpi', 'dashboard', 'performance', 'impact', 'overview', 'summary'])) kind = kpiReferenceSequenceKind(i) === 'closing' ? 'dashboard' : kpiReferenceSequenceKind(i);

  const { bg, title: ink, muted, blue, mint, panel, line } = kpiPptColors(t);
  const amber = 'F59E0B';
  const mono = 'Consolas';
  const titleFont = t.fonts.heading || 'Malgun Gothic';

  const addBase = () => {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: bg }, line: { color: bg } });
    for (let x = 0; x <= W; x += 0.42) {
      s.addShape('rect', { x, y: 0, w: 0.003, h: H, fill: { color: blue, transparency: 94 }, line: { color: blue, transparency: 100 } });
    }
    for (let y = 0; y <= H; y += 0.42) {
      s.addShape('rect', { x: 0, y, w: W, h: 0.003, fill: { color: blue, transparency: 94 }, line: { color: blue, transparency: 100 } });
    }
  };
  const addHeader = (y = 0.62, w = 8.5) => {
    addPptText(s, label, { x: 0.82, y, w: 4.5, h: 0.18, fontFace: mono, fontSize: 8.4, bold: true, color: kind === 'risk' ? amber : blue, charSpacing: 2.4, fit: 'shrink' });
    addPptText(s, title, { x: 0.82, y: y + 0.64, w, h: 0.72, fontFace: titleFont, fontSize: dynamicFontPt(title, 30, { min: 22, max: 34 }), bold: true, color: ink, fit: 'shrink' });
  };
  const addRule = (x, y, w, color = line) => s.addShape('rect', { x, y, w, h: 0.01, fill: { color, transparency: 8 }, line: { color, transparency: 100 } });
  const metricCards = (metrics.length ? metrics : data.map((lineItem, idx) => ({
    label: lineItem.heading || ['Efficiency', 'Reliability', 'Impact'][idx],
    value: lineItem.period || ['85%', '99.9%', '94%'][idx],
  }))).slice(0, 3);
  const addMetricRow = (top = 2.25) => {
    metricCards.forEach((m, idx) => {
      const x = 0.82 + idx * 4.05;
      addRule(x, top, 3.45);
      addPptText(s, safePptText(m.label || `KPI ${idx + 1}`).toUpperCase(), { x, y: top + 0.2, w: 2.8, h: 0.16, fontFace: mono, fontSize: 7.2, bold: true, color: blue, charSpacing: 0.8, fit: 'shrink' });
      { const dv = safePptText(metricDisplayValue(m)); addPptText(s, dv, { x, y: top + 0.62, w: 2.5, h: 0.5, fontFace: titleFont, fontSize: kpiMetricValueFontPt(dv, 29), bold: true, color: mint, fit: 'shrink' }); }
      addPptText(s, data[idx]?.body || subtitle || 'Measured portfolio performance signal', { x, y: top + 1.22, w: 3.1, h: 0.28, fontFace: t.fonts.body, fontSize: 7.8, color: muted, fit: 'shrink' });
    });
  };
  const addChart = (chartTitle = 'VALUE DELIVERY TREND', note = 'TOTAL IMPACT VERIFIED') => {
    s.addShape('rect', { x: 0.82, y: 4.85, w: 11.7, h: 1.75, fill: { color: panel, transparency: 8 }, line: { color: line, transparency: 8 } });
    addPptText(s, chartTitle, { x: 1.05, y: 5.07, w: 4.5, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: 'A9C7E8', charSpacing: 0.8 });
    addPptText(s, note, { x: 9.45, y: 5.07, w: 2.6, h: 0.16, fontFace: mono, fontSize: 7.4, bold: true, color: mint, align: 'right', fit: 'shrink' });
    [0, 1, 2, 3, 4].forEach(row => addRule(1.35, 6.22 - row * 0.24, 10.45, '2C3B55'));
    [0.45, 0.65, 0.86, 0.58].forEach((h, idx) => {
      const x = 1.72 + idx * 2.25;
      s.addShape('rect', { x, y: 6.22 - h, w: 0.76, h, fill: { color: idx % 2 ? mint : blue }, line: { color: idx % 2 ? mint : blue } });
      s.addShape('rect', { x: x + 0.92, y: 6.22 - Math.max(0.2, h - 0.18), w: 0.76, h: Math.max(0.2, h - 0.18), fill: { color: muted, transparency: 55 }, line: { color: muted, transparency: 100 } });
    });
  };

  addBase();

  if (kind === 'cover') {
    addPptText(s, 'PERFORMANCE DASHBOARD', { x: 0.82, y: 0.22, w: 4.2, h: 0.18, fontFace: mono, fontSize: 9, bold: true, color: blue, charSpacing: 2.8 });
    s.addShape('ellipse', { x: 0.83, y: 0.5, w: 0.08, h: 0.08, fill: { color: mint }, line: { color: mint } });
    addPptText(s, 'SYSTEM ONLINE', { x: 0.98, y: 0.47, w: 1.5, h: 0.14, fontFace: mono, fontSize: 6.5, color: muted, charSpacing: 0.6 });
    addPptText(s, 'DATA SYNCED', { x: 5.35, y: 0.47, w: 1.8, h: 0.14, fontFace: mono, fontSize: 6.5, color: muted, charSpacing: 0.6 });
    addPptText(s, 'SECURE ACCESS', { x: 10.65, y: 0.47, w: 1.5, h: 0.14, fontFace: mono, fontSize: 6.5, color: muted, charSpacing: 0.6, align: 'right' });
    addPptText(s, title, { x: 0.82, y: 0.8, w: 8.2, h: 1.55, fontFace: titleFont, fontSize: 44, bold: true, color: ink, fit: 'shrink' });
    addPptText(s, subtitle || '2021-2026 Growth Metrics & Strategic Impact', { x: 0.82, y: 2.95, w: 6.9, h: 0.24, fontFace: mono, fontSize: 14, bold: true, color: mint, fit: 'shrink' });
    addRule(0.82, 6.15, 11.7);
    ['VERSION', 'CORE COMPETENCY', 'FOCUS AREA', 'STATUS'].forEach((h, idx) => {
      const x = 0.82 + idx * 3.05;
      addPptText(s, h, { x, y: 6.45, w: 1.5, h: 0.13, fontFace: mono, fontSize: 6.4, color: muted });
      addPptText(s, (slide.bullets || [])[idx] || ['3.0.0-PRO', 'AI Architecture & Full-Stack', 'Growth Metrics', 'Ready for Impact'][idx], { x, y: 6.68, w: 2.4, h: 0.18, fontFace: mono, fontSize: 9, bold: true, color: 'FFFFFF', fit: 'shrink' });
    });
    return;
  }

  if (kind === 'timeline') {
    addHeader(0.8, 7.8);
    addRule(0.85, 3.45, 11.4, blue);
    data.slice(0, 4).forEach((lineItem, idx) => {
      const x = 1.0 + idx * 3.0;
      const top = idx % 2 === 0;
      s.addShape('ellipse', { x: x - 0.08, y: 3.35, w: 0.2, h: 0.2, fill: { color: blue }, line: { color: '081326', width: 2 } });
      addPptText(s, lineItem.period || ['2021', '2023', '2025', '2026'][idx], { x: x - 0.55, y: top ? 2.05 : 3.75, w: 1.2, h: 0.2, fontFace: mono, fontSize: 11, bold: true, color: mint, align: 'center' });
      addPptText(s, lineItem.heading, { x: x - 0.9, y: top ? 2.48 : 4.18, w: 1.9, h: 0.24, fontFace: titleFont, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
      addPptText(s, lineItem.body, { x: x - 0.9, y: top ? 2.85 : 4.55, w: 1.9, h: 0.32, fontFace: t.fonts.body, fontSize: 7.2, color: 'A9C7E8', align: 'center', fit: 'shrink' });
    });
    return;
  }

  if (kind === 'skills') {
    addHeader(0.8, 7.8);
    data.slice(0, 4).forEach((lineItem, idx) => {
      const x = 0.82 + (idx % 2) * 6.0;
      const y = 2.45 + Math.floor(idx / 2) * 1.65;
      addRule(x, y, 5.55);
      addPptText(s, (lineItem.period || lineItem.role || `COMPETENCY ${idx + 1}`).toUpperCase(), { x, y: y + 0.25, w: 3.0, h: 0.14, fontFace: mono, fontSize: 7.2, bold: true, color: idx % 2 ? mint : blue, charSpacing: 0.8 });
      [lineItem.heading, lineItem.body].filter(Boolean).slice(0, 2).forEach((item, j) => {
        const pct = 95 - idx * 3 - j * 5;
        addPptText(s, item, { x, y: y + 0.62 + j * 0.42, w: 3.9, h: 0.16, fontFace: t.fonts.body, fontSize: 8.8, color: 'FFFFFF', fit: 'shrink' });
        addPptText(s, `${pct}%`, { x: x + 4.65, y: y + 0.62 + j * 0.42, w: 0.7, h: 0.16, fontFace: t.fonts.body, fontSize: 8.2, color: 'FFFFFF', align: 'right' });
        s.addShape('rect', { x, y: y + 0.86 + j * 0.42, w: 5.35, h: 0.035, fill: { color: '24344D' }, line: { color: '24344D' } });
        s.addShape('rect', { x, y: y + 0.86 + j * 0.42, w: 5.35 * pct / 100, h: 0.035, fill: { color: idx % 2 ? mint : blue }, line: { color: idx % 2 ? mint : blue } });
      });
    });
    return;
  }

  if (kind === 'project') {
    addHeader(0.8, 7.2);
    addPptText(s, subtitle || data[0]?.period || 'AI-Driven Platform', { x: 0.82, y: 2.2, w: 6.5, h: 0.22, fontFace: mono, fontSize: 11, bold: true, color: mint, fit: 'shrink' });
    addRule(0.82, 2.75, 6.8);
    addPptText(s, 'CORE MISSION', { x: 0.82, y: 2.95, w: 1.6, h: 0.13, fontFace: mono, fontSize: 6.8, color: blue, charSpacing: 0.5 });
    addPptText(s, data[0]?.body || data[0]?.heading || subtitle, { x: 0.82, y: 3.35, w: 6.6, h: 0.82, fontFace: t.fonts.body, fontSize: 13, bold: true, color: 'FFFFFF', fit: 'shrink' });
    s.addShape('rect', { x: 7.9, y: 2.75, w: 4.5, h: 1.45, fill: { color: panel, transparency: 32 }, line: { color: blue, transparency: 65 } });
    addPptText(s, data[1]?.heading || 'Lead Developer', { x: 8.1, y: 2.97, w: 2.8, h: 0.24, fontFace: titleFont, fontSize: 14, bold: true, color: blue, fit: 'shrink' });
    data.slice(1, 4).forEach((lineItem, idx) => addPptText(s, `✓ ${lineItem.body || lineItem.heading}`, { x: 8.1, y: 3.32 + idx * 0.28, w: 3.8, h: 0.16, fontFace: t.fonts.body, fontSize: 8.8, color: 'A9C7E8', fit: 'shrink' }));
    addRule(0.82, 6.15, 11.7);
    ['TIMELINE', 'TECH STACK', 'STATUS', 'IMPACT'].forEach((h, idx) => {
      const x = 0.82 + idx * 3.1;
      addPptText(s, h, { x, y: 6.35, w: 1.4, h: 0.13, fontFace: mono, fontSize: 6.5, color: muted });
      addPptText(s, data[idx]?.period || data[idx]?.heading || ['2026.04 - 2026.05', 'React, Node.js, Firebase', 'Production Ready', 'Impact Verified'][idx], { x, y: 6.62, w: 2.5, h: 0.18, fontFace: mono, fontSize: 8.5, bold: true, color: 'FFFFFF', fit: 'shrink' });
    });
    return;
  }

  if (kind === 'beforeAfter') {
    addHeader(0.8, 8.8);
    const drawSide = (x, heading, sideLines, good) => {
      addPptText(s, heading, { x, y: 2.28, w: 3.8, h: 0.18, fontFace: mono, fontSize: 9, bold: true, color: good ? mint : muted, fit: 'shrink' });
      sideLines.slice(0, 2).forEach((lineItem, idx) => {
        const y = 2.92 + idx * 0.92;
        s.addShape('rect', { x, y, w: 0.45, h: 0.45, fill: { color: bg, transparency: 100 }, line: { color: good ? blue : line, transparency: 0 } });
        addPptText(s, good ? '✓' : '□', { x: x + 0.12, y: y + 0.13, w: 0.18, h: 0.12, fontFace: mono, fontSize: 8, color: good ? blue : muted });
        addPptText(s, lineItem.heading, { x: x + 0.65, y: y + 0.06, w: 3.4, h: 0.2, fontFace: titleFont, fontSize: 11, bold: true, color: 'FFFFFF', fit: 'shrink' });
        addPptText(s, lineItem.body, { x: x + 0.65, y: y + 0.36, w: 3.5, h: 0.22, fontFace: t.fonts.body, fontSize: 7.5, color: 'A9C7E8', fit: 'shrink' });
      });
      addRule(x, 4.4, 4.9);
      addPptText(s, 'AVERAGE PROCESSING TIME', { x, y: 4.68, w: 2.4, h: 0.13, fontFace: mono, fontSize: 6.8, color: muted });
      addPptText(s, good ? '10 MIN' : '300 MIN', { x, y: 5.45, w: 2.2, h: 0.32, fontFace: titleFont, fontSize: 20, bold: true, color: good ? mint : 'FFFFFF' });
    };
    drawSide(1.12, 'BEFORE: MANUAL PROCESS', data.slice(0, 2), false);
    s.addShape('rect', { x: 6.55, y: 2.05, w: 0.02, h: 4.15, fill: { color: '172338' }, line: { color: '172338' } });
    drawSide(7.05, 'AFTER: AI-DRIVEN WORKFLOW', data.slice(2, 4).length ? data.slice(2, 4) : data.slice(0, 2), true);
    return;
  }

  if (kind === 'risk') {
    addHeader(0.8, 8.3);
    data.slice(0, 2).forEach((lineItem, idx) => {
      const x = 0.82 + idx * 6.15;
      addRule(x, 2.55, 5.55);
      addPptText(s, idx ? 'TECHNICAL CONSTRAINT' : 'SECURITY THREAT', { x, y: 2.88, w: 2.6, h: 0.15, fontFace: mono, fontSize: 7.2, bold: true, color: idx ? mint : amber, charSpacing: 0.7 });
      addPptText(s, lineItem.heading, { x, y: 3.45, w: 4.7, h: 0.26, fontFace: titleFont, fontSize: 14, bold: true, color: 'FFFFFF', fit: 'shrink' });
      addPptText(s, lineItem.body, { x, y: 3.95, w: 5.2, h: 0.52, fontFace: t.fonts.body, fontSize: 9.2, color: 'A9C7E8', fit: 'shrink' });
      s.addShape('rect', { x, y: 4.85, w: 5.55, h: 0.52, fill: { color: bg, transparency: 100 }, line: { color: line, transparency: 4 } });
      addPptText(s, `MITIGATION: ${lineItem.period || 'Verified control'}\nRESULT: ${idx ? '80% Risk Reduction' : '100% Prevention'}`, { x: x + 0.18, y: 5.0, w: 4.9, h: 0.2, fontFace: mono, fontSize: 7.5, bold: true, color: blue, fit: 'shrink' });
    });
    addPptText(s, 'SYSTEM INTEGRITY INDEX', { x: 0.82, y: 6.05, w: 2.2, h: 0.13, fontFace: mono, fontSize: 6.8, color: muted });
    s.addShape('rect', { x: 0.82, y: 6.35, w: 11.7, h: 0.32, fill: { color: '223149' }, line: { color: '223149' } });
    s.addShape('rect', { x: 0.82, y: 6.35, w: 10.7, h: 0.32, fill: { color: mint }, line: { color: mint } });
    return;
  }

  if (kind === 'roadmap') {
    addHeader(0.8, 8.4);
    addMetricRow(2.25);
    s.addShape('rect', { x: 0.82, y: 4.75, w: 11.7, h: 1.55, fill: { color: panel, transparency: 10 }, line: { color: line, transparency: 8 } });
    addPptText(s, 'TECHNICAL GROWTH ROADMAP', { x: 1.08, y: 5.02, w: 3.0, h: 0.16, fontFace: mono, fontSize: 7.5, bold: true, color: 'A9C7E8', charSpacing: 0.8 });
    data.slice(0, 3).forEach((lineItem, idx) => {
      const x = 1.15 + idx * 3.75;
      s.addShape('rect', { x, y: 5.55, w: 0.02, h: 0.55, fill: { color: blue }, line: { color: blue } });
      addPptText(s, lineItem.period || `PHASE ${idx + 1}`, { x: x + 0.18, y: 5.42, w: 1.5, h: 0.13, fontFace: mono, fontSize: 6.8, color: blue });
      addPptText(s, lineItem.heading, { x: x + 0.18, y: 5.65, w: 2.7, h: 0.2, fontFace: titleFont, fontSize: 10.5, bold: true, color: 'FFFFFF', fit: 'shrink' });
      addPptText(s, lineItem.body, { x: x + 0.18, y: 5.92, w: 2.8, h: 0.28, fontFace: t.fonts.body, fontSize: 7.2, color: 'A9C7E8', fit: 'shrink' });
    });
    return;
  }

  if (kind === 'closing') {
    addHeader(1.18, 8.6);
    addPptText(s, subtitle || 'Full-Stack Engineer & System Architect', { x: 0.82, y: 3.25, w: 7.2, h: 0.24, fontFace: mono, fontSize: 12, bold: true, color: mint, fit: 'shrink' });
    addMetricRow(4.0);
    addRule(0.82, 6.2, 11.7);
    (slide.bullets?.length ? slide.bullets : ['yushin.kim@example.com', 'github.com/yushinkim', 'portfolio link', 'Seoul, South Korea']).slice(0, 4).forEach((item, idx) => {
      const x = 0.82 + idx * 3.0;
      addPptText(s, ['EMAIL', 'GITHUB', 'PORTFOLIO', 'LOCATION'][idx], { x, y: 6.45, w: 1.3, h: 0.13, fontFace: mono, fontSize: 6.5, color: muted });
      addPptText(s, item, { x, y: 6.68, w: 2.45, h: 0.18, fontFace: mono, fontSize: 8.8, bold: true, color: blue, fit: 'shrink' });
    });
    return;
  }

  addHeader(0.8, 8.4);
  addMetricRow(2.25);
  addChart(hasAny(['recruitment']) ? 'RECRUITMENT FUNNEL EFFICIENCY' : 'VALUE DELIVERY TREND', 'TOTAL IMPACT VERIFIED');
}

function drawKpiDashboardPptx(s, slide, t, v, i, W, H) {
  const l = slide.layout;
  if (l === 'kpi-cover') return drawKpiCoverPptx(s, slide, t, W, H);
  if (l === 'kpi-executive') return drawKpiExecutivePptx(s, slide, t, W, H);
  if (l === 'kpi-skills') return drawKpiSkillsPptx(s, slide, t, W, H);
  if (l === 'kpi-timeline') return drawKpiTimelinePptx(s, slide, t, W, H);
  if (l === 'kpi-project') return drawKpiProjectPptx(s, slide, t, W, H);
  if (l === 'kpi-metrics') return drawKpiMetricsPptx(s, slide, t, W, H);
  if (l === 'kpi-comparison') return drawKpiComparisonPptx(s, slide, t, W, H);
  if (l === 'kpi-technical') return drawKpiTechnicalPptx(s, slide, t, W, H);
  if (l === 'kpi-risk') return drawKpiRiskPptx(s, slide, t, W, H);
  if (l === 'kpi-cumulative') return drawKpiCumulativePptx(s, slide, t, W, H);
  if (l === 'kpi-roadmap') return drawKpiRoadmapPptx(s, slide, t, W, H);
  if (l === 'kpi-closing') return drawKpiClosingPptx(s, slide, t, W, H);
  return drawKpiReferencePptx(s, slide, t, v, i, W, H);
  const metrics = (slide.metrics || pptAcceptedLines(slide).flatMap(line => line.metrics || [])).slice(0, 4);
  const lines = pptAcceptedLines(slide);
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const mood = acceptedSlideMood(slide, i);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'KPI DASHBOARD');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
  if (!isCover && (mood === 'toc' || mood === 'process')) {
    addPptText(s, mood === 'toc' ? 'DASHBOARD INDEX' : 'KPI BREAKDOWN', { x: 0.62, y: 0.42, w: 2.8, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.62, y: 1.05, w: 4.6, h: 1.25, fontFace: t.fonts.heading, fontSize: 25, bold: true, color: hex(v.ink) });
    s.addShape('roundRect', { x: 0.62, y: 4.4, w: 3.8, h: 1.75, fill: { color: hex(v.card) }, line: { color: hex(v.card) }, rectRadius: 0.18 });
    { const dv = metrics[0] ? safePptText(metricDisplayValue(metrics[0])) : 'Impact'; addPptText(s, dv, { x: 0.95, y: 4.8, w: 2.9, h: 0.42, fontFace: t.fonts.heading, fontSize: kpiMetricValueFontPt(dv, 26), bold: true, color: hex(v.accent), fit: 'shrink' }); }
    addPptText(s, metrics[0]?.label || '성과와 실행 근거를 함께 읽습니다.', { x: 0.95, y: 5.35, w: 2.9, h: 0.28, fontFace: t.fonts.body, fontSize: 8, color: hex(v.muted) });
    lines.slice(0, 5).forEach((line, idx) => {
      const y = 1.0 + idx * 0.98;
      const fill = idx === 0 ? v.accent : v.card;
      s.addShape('roundRect', { x: 5.35, y, w: 6.9, h: 0.72, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.12 });
      addPptText(s, line.period || `KPI ${idx + 1}`, { x: 5.6, y: y + 0.18, w: 1.15, h: 0.14, fontFace: t.fonts.body, fontSize: 6.8, bold: true, color: idx === 0 ? '06121F' : hex(v.muted) });
      addPptText(s, line.heading, { x: 6.9, y: y + 0.13, w: 3.2, h: 0.2, fontFace: t.fonts.heading, fontSize: 9.2, bold: true, color: idx === 0 ? '06121F' : hex(v.ink) });
      s.addShape('rect', { x: 10.45, y: y + 0.34, w: 0.9 + idx * 0.18, h: 0.05, fill: { color: idx === 0 ? '06121F' : hex(v.accent) }, line: { color: idx === 0 ? '06121F' : hex(v.accent) } });
    });
    return;
  }
  if (!isCover && mood === 'evidence') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, slide.sectionLabel || 'INSIGHT', { x: 0.72, y: 0.65, w: 2.3, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.72, y: 1.25, w: 7.0, h: 1.45, fontFace: t.fonts.heading, fontSize: 29, bold: true, color: 'FFFFFF' });
    lines.slice(0, 3).forEach((line, idx) => {
      const x = 0.72 + idx * 4.1;
      const fill = idx === 1 ? v.accent : v.card;
      s.addShape('roundRect', { x, y: 4.6, w: 3.65, h: 1.55, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.14 });
      addPptText(s, line.heading, { x: x + 0.22, y: 4.88, w: 3.0, h: 0.28, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: idx === 1 ? '06121F' : 'FFFFFF' });
      addPptText(s, line.body, { x: x + 0.22, y: 5.3, w: 3.0, h: 0.38, fontFace: t.fonts.body, fontSize: 7.5, color: idx === 1 ? '06121F' : 'CFCFCF' });
    });
    return;
  }
  if (!isCover) return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'KPI DASHBOARD');
  addPptText(s, 'KPI DASHBOARD', { x: 0.62, y: 0.42, w: 2.5, h: 0.25, fontFace: t.fonts.body, fontSize: 9, bold: true, color: hex(v.accent), charSpacing: 3 });
  addPptText(s, `Slide ${String(i + 1).padStart(2, '0')}`, { x: W - 1.5, y: 0.42, w: 0.9, h: 0.22, fontFace: t.fonts.body, fontSize: 8, color: hex(v.muted), align: 'right' });
  addPptText(s, slide.title || '', { x: 0.62, y: 1.05, w: isCover ? 8.7 : 6.6, h: isCover ? 1.4 : 0.9, fontFace: t.fonts.heading, fontSize: isCover ? 35 : 24, bold: true, color: hex(v.ink) });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 0.62, y: isCover ? 2.35 : 1.95, w: 6.8, h: 0.42, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted) });
  s.addShape('roundRect', { x: 0.62, y: 3.35, w: 4.8, h: 3.15, fill: { color: hex(v.card) }, line: { color: hex(v.card) }, rectRadius: 0.2 });
  addPptText(s, 'PRIMARY METRIC', { x: 0.95, y: 3.72, w: 2.2, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.muted) });
  { const dv = safePptText(metricDisplayValue(metrics[0])); addPptText(s, dv, { x: 0.95, y: 4.18, w: 3.9, h: 0.7, fontFace: t.fonts.heading, fontSize: kpiMetricValueFontPt(dv, 34), bold: true, color: hex(v.accent), fit: 'shrink' }); }
  addPptText(s, metrics[0]?.label || lines[0]?.heading || '핵심 성과', { x: 0.95, y: 5.0, w: 3.7, h: 0.42, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.ink) });
  [0, 1, 2, 3].forEach(idx => s.addShape('rect', { x: 1.0 + idx * 0.65, y: 6.0 - idx * 0.22, w: 0.35, h: 0.42 + idx * 0.22, fill: { color: idx === 3 ? hex(v.accent) : '28435F' }, line: { color: idx === 3 ? hex(v.accent) : '28435F' } }));
  [1, 2, 3].forEach((n, idx) => {
    const x = 5.7 + (idx % 2) * 3.2;
    const y = 3.35 + Math.floor(idx / 2) * 1.55;
    s.addShape('roundRect', { x, y, w: 2.9, h: 1.35, fill: { color: hex(v.card) }, line: { color: hex(v.card) }, rectRadius: 0.16 });
    { const dv = safePptText(metricDisplayValue(metrics[n])); addPptText(s, dv, { x: x + 0.24, y: y + 0.22, w: 2.3, h: 0.35, fontFace: t.fonts.heading, fontSize: kpiMetricValueFontPt(dv, 20), bold: true, color: hex(v.accent), fit: 'shrink' }); }
    addPptText(s, metrics[n]?.label || lines[idx]?.heading || '보조 지표', { x: x + 0.24, y: y + 0.68, w: 2.3, h: 0.28, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.ink) });
    s.addShape('rect', { x: x + 0.24, y: y + 1.08, w: 1.4 + idx * 0.3, h: 0.06, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
  });
  s.addShape('roundRect', { x: 8.9, y: 4.9, w: 3.25, h: 1.6, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.16 });
  addPptText(s, 'Insight', { x: 9.2, y: 5.15, w: 2.4, h: 0.24, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: '03101C' });
  addPptText(s, lines[0]?.body || '성과를 만든 실행 근거를 함께 제시합니다.', { x: 9.2, y: 5.5, w: 2.45, h: 0.5, fontFace: t.fonts.body, fontSize: 8.5, bold: true, color: '03101C' });
}

function drawTimelineReferencePptx(s, slide, t, v, i, W, H) {
  const lines = pptAcceptedLines(slide);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const mood = acceptedSlideMood(slide, i);
  const source = safePptText(`${slide.layout || ''} ${slide.sectionLabel || ''} ${slide.title || ''} ${slide.subtitle || ''} ${slide.proposalVariant || ''}`).toLowerCase();
  const hasAny = terms => terms.some(term => source.includes(term));
  const title = safePptText(slide.title || 'Portfolio');
  const subtitle = safePptText(slide.subtitle || '');
  const label = safePptText(slide.sectionLabel || 'GROWTH ARCHIVE');
  const data = lines.length ? lines : [
    { heading: 'Experience', body: subtitle || title, period: '' },
    { heading: 'Memory', body: 'Structured records and reusable evidence', period: '' },
    { heading: 'Value', body: 'Practical impact for teams and users', period: '' },
  ];

  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const TL_KIND_PPT = { 'timeline-cover': 'cover', 'timeline-philosophy': 'philosophy', 'timeline-profile': 'profile', 'timeline-master': 'timeline', 'timeline-stack': 'stack', 'timeline-project': 'project', 'timeline-architecture': 'detail', 'timeline-challenge': 'detail', 'timeline-detail': 'detail', 'timeline-outcomes': 'metrics', 'timeline-awards': 'awards', 'timeline-growth': 'detail', 'timeline-roadmap': 'roadmap', 'timeline-closing': 'closing' };
  let kind = TL_KIND_PPT[slide.layout];
  if (!kind) {
    kind = 'detail';
    if (isCover) kind = 'cover';
    else if (slide.layout === 'closing' || slide.proposalVariant === 'closing' || hasAny(['thank', 'closing'])) kind = 'closing';
    else if (hasAny(['profile', 'key metrics', 'education', 'language', 'focus'])) kind = 'profile';
    else if (hasAny(['timeline', 'journey', 'archive', 'history', 'milestone'])) kind = 'timeline';
    else if (hasAny(['roadmap', 'vision', 'future', 'phase'])) kind = 'roadmap';
    else if (hasAny(['award', 'honor', 'recognition', 'prize'])) kind = 'awards';
    else if (hasAny(['metric', 'outcome', 'result', 'score', 'kpi', 'satisfaction']) || metrics.length) kind = 'metrics';
    else if (hasAny(['stack', 'frontend', 'backend', 'engineering', 'technical'])) kind = 'stack';
    else if (hasAny(['project', 'case', 'launch', 'development'])) kind = 'project';
    else if (mood === 'toc') kind = 'philosophy';
    else if (mood === 'metric') kind = 'metrics';
  }

  const bg = hex(v.bg);
  const ink = hex(v.ink);
  const muted = hex(v.muted);
  const accent = hex(v.accent);
  const soft = hex(v.soft);
  const card = hex(v.card || '#F7FAFF');
  const dark = hex(v.dark);

  const addBase = (darkMode = false) => {
    const base = darkMode ? dark : bg;
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: base }, line: { color: base } });
    if (!darkMode) s.addShape('rect', { x: 0, y: 0, w: W, h: 0.07, fill: { color: accent }, line: { color: accent } });
    if (!darkMode) {
      s.addShape('ellipse', { x: W / 2 - 0.11, y: H - 0.28, w: 0.22, h: 0.22, fill: { color: bg, transparency: 100 }, line: { color: '0F9AAA', width: 1.4 } });
      addPptText(s, 'G', { x: W / 2 - 0.075, y: H - 0.255, w: 0.15, h: 0.08, fontFace: t.fonts.heading, fontSize: 7, bold: true, color: '0F9AAA', align: 'center' });
    }
  };

  const addHeader = (y = 0.9, width = 8.4) => {
    addPptText(s, label.toUpperCase(), { x: 0.85, y, w: 4.4, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: accent, charSpacing: 3, fit: 'shrink' });
    addPptText(s, title, { x: 0.85, y: y + 0.5, w: width, h: 0.88, fontFace: t.fonts.heading, fontSize: dynamicFontPt(title, 28, { min: 20, max: 34 }), bold: true, color: ink, fit: 'shrink' });
    if (subtitle) addPptText(s, subtitle, { x: 0.85, y: y + 1.34, w: width - 0.4, h: 0.36, fontFace: t.fonts.body, fontSize: 10.5, color: muted, fit: 'shrink' });
  };

  const addTopRule = (x, y, w, color = soft) => {
    s.addShape('rect', { x, y, w, h: 0.012, fill: { color }, line: { color } });
  };

  if (kind === 'closing') {
    addBase(true);
    s.addShape('rect', { x: W / 2 - 0.42, y: 1.42, w: 0.84, h: 0.04, fill: { color: accent }, line: { color: accent } });
    addPptText(s, title || 'Thank You for Your Time', { x: 1.35, y: 2.35, w: W - 2.7, h: 0.72, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
    addPptText(s, subtitle || data[0]?.body || '', { x: 2.1, y: 3.35, w: W - 4.2, h: 0.52, fontFace: t.fonts.body, fontSize: 13, color: 'A9C7E8', align: 'center', fit: 'shrink' });
    s.addShape('rect', { x: 1.95, y: 4.75, w: W - 3.9, h: 0.01, fill: { color: '31405A' }, line: { color: '31405A' } });
    data.slice(0, 3).forEach((line, idx) => {
      const x = 2.25 + idx * 3.35;
      addPptText(s, (line.period || line.heading || ['EMAIL', 'GITHUB', 'PORTFOLIO'][idx]).toUpperCase(), { x, y: 5.3, w: 2.35, h: 0.16, fontFace: t.fonts.body, fontSize: 7.8, bold: true, color: accent, charSpacing: 3, align: 'center' });
      addPptText(s, line.body || line.heading || '', { x: x - 0.35, y: 5.75, w: 3.05, h: 0.2, fontFace: t.fonts.body, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
    });
    return;
  }

  addBase(false);

  if (kind === 'cover') {
    s.addShape('rect', { x: 0.13, y: 0, w: 0.08, h: H, fill: { color: accent }, line: { color: accent } });
    addPptText(s, label.toUpperCase() || '2021 - 2026 GROWTH ARCHIVE', { x: 1.15, y: 0.86, w: 5.2, h: 0.2, fontFace: t.fonts.body, fontSize: 10, bold: true, color: accent, charSpacing: 3 });
    addPptText(s, title, { x: 1.15, y: 1.8, w: 6.5, h: 1.55, fontFace: t.fonts.heading, fontSize: 37, bold: true, color: ink, fit: 'shrink' });
    if (subtitle) addPptText(s, subtitle, { x: 1.15, y: 4.08, w: 6.5, h: 0.35, fontFace: t.fonts.body, fontSize: 14, color: muted, fit: 'shrink' });
    data.slice(0, 3).forEach((line, idx) => {
      const x = 1.15 + idx * 2.15;
      addTopRule(x, 5.55, 1.12, soft);
      addPptText(s, (line.period || ['CANDIDATE', 'ROLE', 'EDUCATION'][idx]).toUpperCase(), { x, y: 5.88, w: 1.6, h: 0.15, fontFace: t.fonts.body, fontSize: 6.7, bold: true, color: muted, charSpacing: 1.5 });
      addPptText(s, line.heading || line.body || '', { x, y: 6.22, w: 1.85, h: 0.22, fontFace: t.fonts.heading, fontSize: 9.5, bold: true, color: ink, fit: 'shrink' });
    });
    s.addShape('freeform', { x: W - 3.3, y: 3.3, w: 3.3, h: 4.2, fill: { color: 'F6F9FD' }, line: { color: 'F6F9FD' }, pptxShape: 'rtTriangle' });
    return;
  }

  if (kind === 'profile') {
    addPptText(s, 'PROFILE', { x: 0.85, y: 1.05, w: 1.6, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: accent, charSpacing: 3 });
    addPptText(s, title, { x: 0.85, y: 1.45, w: 4.6, h: 0.48, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: ink, fit: 'shrink' });
    s.addShape('rect', { x: 6.45, y: 0.9, w: 0.01, h: 5.7, fill: { color: soft }, line: { color: soft } });
    data.slice(0, 3).forEach((line, idx) => {
      const y = 2.25 + idx * 1.05;
      addPptText(s, (line.period || line.role || ['EDUCATION', 'LANGUAGE', 'FOCUS'][idx]).toUpperCase(), { x: 0.85, y, w: 2.0, h: 0.14, fontFace: t.fonts.body, fontSize: 6.7, bold: true, color: muted, charSpacing: 1.5, fit: 'shrink' });
      addPptText(s, line.heading, { x: 0.85, y: y + 0.28, w: 4.3, h: 0.24, fontFace: t.fonts.heading, fontSize: 12.5, bold: true, color: ink, fit: 'shrink' });
      addPptText(s, line.body, { x: 0.85, y: y + 0.68, w: 4.4, h: 0.26, fontFace: t.fonts.body, fontSize: 8.2, color: muted, fit: 'shrink' });
    });
    addPptText(s, 'KEY METRICS', { x: 6.7, y: 1.05, w: 2.2, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: accent, charSpacing: 3 });
    const metricList = (metrics.length ? metrics : [
      { label: 'Production Projects', value: '5+' },
      { label: 'TOEIC Score', value: '900' },
      { label: 'Documentation Rate', value: '100%' },
    ]).slice(0, 3);
    metricList.forEach((metric, idx) => {
      const y = 1.9 + idx * 1.55;
      addPptText(s, pptAcceptedMetricText(metric), { x: 6.7, y, w: 2.3, h: 0.44, fontFace: t.fonts.heading, fontSize: 27, bold: true, color: accent, fit: 'shrink' });
      addPptText(s, metric.label || data[idx]?.heading || 'Metric', { x: 6.7, y: y + 0.68, w: 3.0, h: 0.2, fontFace: t.fonts.heading, fontSize: 9.4, bold: true, color: ink, fit: 'shrink' });
      addPptText(s, metric.body || data[idx]?.body || '', { x: 6.7, y: y + 1.02, w: 4.0, h: 0.26, fontFace: t.fonts.body, fontSize: 7.6, color: muted, fit: 'shrink' });
    });
    return;
  }

  if (kind === 'timeline') {
    addPptText(s, 'MASTER TIMELINE', { x: 0.85, y: 1.1, w: 2.2, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: accent, charSpacing: 3 });
    addPptText(s, title, { x: 0.85, y: 1.6, w: 7.1, h: 0.62, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: ink, fit: 'shrink' });
    s.addShape('rect', { x: 0.85, y: 4.02, w: W - 1.7, h: 0.018, fill: { color: soft }, line: { color: soft } });
    data.slice(0, 5).forEach((line, idx) => {
      const x = 1.65 + idx * ((W - 3.3) / 4);
      const top = idx % 2 === 0;
      const itemY = top ? 2.58 : 4.48;
      s.addShape('ellipse', { x: x - 0.065, y: 3.955, w: 0.13, h: 0.13, fill: { color: accent }, line: { color: accent } });
      addPptText(s, line.period || `STEP ${idx + 1}`, { x: x - 0.82, y: itemY, w: 1.65, h: 0.22, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: accent, align: 'center', fit: 'shrink' });
      addPptText(s, line.heading, { x: x - 0.95, y: itemY + 0.36, w: 1.9, h: 0.4, fontFace: t.fonts.heading, fontSize: 8.4, bold: true, color: ink, align: 'center', fit: 'shrink' });
      addPptText(s, line.body, { x: x - 0.95, y: itemY + 0.86, w: 1.9, h: 0.48, fontFace: t.fonts.body, fontSize: 7.1, color: muted, align: 'center', fit: 'shrink' });
    });
    return;
  }

  if (kind === 'metrics') {
    addHeader(1.0, 7.4);
    const metricList = metrics.length ? metrics : data.slice(0, 3).map(line => ({ label: line.heading, value: line.period || line.body }));
    metricList.slice(0, 3).forEach((m, idx) => {
      const x = 0.85 + idx * 4.0;
      addTopRule(x, 2.35, 3.2, soft);
      addPptText(s, pptAcceptedMetricText(m), { x, y: 3.02, w: 2.7, h: 0.48, fontFace: t.fonts.heading, fontSize: 31, bold: true, color: accent, fit: 'shrink' });
      addPptText(s, m?.label || data[idx]?.heading || 'Result', { x, y: 3.8, w: 2.7, h: 0.24, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: ink, fit: 'shrink' });
      addPptText(s, data[idx]?.body || '', { x, y: 4.25, w: 2.95, h: 0.32, fontFace: t.fonts.body, fontSize: 8.2, color: muted, fit: 'shrink' });
    });
    s.addShape('rect', { x: 0.85, y: 5.0, w: W - 1.7, h: 0.01, fill: { color: soft }, line: { color: soft } });
    data.slice(0, 2).forEach((line, idx) => {
      const x = 0.85 + idx * 6.0;
      addPptText(s, idx === 0 ? 'TECHNICAL ACHIEVEMENTS' : 'QUALITATIVE FEEDBACK', { x, y: 5.38, w: 3.6, h: 0.2, fontFace: t.fonts.heading, fontSize: 10.5, bold: true, color: idx === 0 ? muted : accent, charSpacing: 1, fit: 'shrink' });
      addPptText(s, line.body || line.heading, { x, y: 5.75, w: 4.8, h: 0.48, fontFace: t.fonts.body, fontSize: 8.8, color: ink, fit: 'shrink' });
    });
    return;
  }

  if (kind === 'roadmap') {
    addHeader(1.0, 8.5);
    data.slice(0, 3).forEach((line, idx) => {
      const x = 0.85 + idx * 4.0;
      addTopRule(x, 2.5, 3.25, soft);
      addPptText(s, `PHASE ${String(idx + 1).padStart(2, '0')}`, { x, y: 2.88, w: 2.8, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: accent, charSpacing: 1.4, fit: 'shrink' });
      addPptText(s, line.heading, { x, y: 3.22, w: 3.1, h: 0.32, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: ink, fit: 'shrink' });
      const bullets = (line.body || '').split(/[\/;•]/).filter(Boolean).slice(0, 3);
      (bullets.length ? bullets : [line.body]).slice(0, 3).forEach((bullet, bIdx) => {
        addPptText(s, '›', { x, y: 3.85 + bIdx * 0.55, w: 0.18, h: 0.18, fontFace: t.fonts.heading, fontSize: 16, color: accent });
        addPptText(s, bullet, { x: x + 0.28, y: 3.86 + bIdx * 0.55, w: 2.85, h: 0.34, fontFace: t.fonts.body, fontSize: 8.6, color: ink, fit: 'shrink' });
      });
    });
    return;
  }

  if (kind === 'awards') {
    addHeader(1.05, 8.0);
    const first = data[0] || {};
    s.addShape('rect', { x: 0.9, y: 2.45, w: W - 1.8, h: 2.38, fill: { color: 'F6F8FC' }, line: { color: 'F6F8FC' } });
    s.addShape('rect', { x: 0.9, y: 2.45, w: 0.055, h: 2.38, fill: { color: accent }, line: { color: accent } });
    addPptText(s, first.period || '2026.05', { x: 1.2, y: 2.8, w: 1.6, h: 0.2, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: accent });
    addPptText(s, first.heading || title, { x: 1.2, y: 3.35, w: 6.2, h: 0.36, fontFace: t.fonts.heading, fontSize: 16, bold: true, color: ink, fit: 'shrink' });
    addPptText(s, first.body || subtitle, { x: 1.2, y: 4.0, w: 10.4, h: 0.46, fontFace: t.fonts.body, fontSize: 8.6, color: ink, fit: 'shrink' });
    data.slice(1, 5).forEach((line, idx) => {
      const x = 0.9 + (idx % 2) * 5.8;
      const y = 5.05 + Math.floor(idx / 2) * 0.58;
      addPptText(s, line.heading, { x, y, w: 3.8, h: 0.2, fontFace: t.fonts.heading, fontSize: 9.8, bold: true, color: ink, fit: 'shrink' });
      addPptText(s, line.period || line.body, { x, y: y + 0.25, w: 4.8, h: 0.16, fontFace: t.fonts.body, fontSize: 7.6, color: muted, fit: 'shrink' });
      addTopRule(x, y + 0.48, 4.9, soft);
    });
    return;
  }

  const threeCol = kind === 'stack' || kind === 'project' || kind === 'philosophy';
  addHeader(1.0, 8.9);
  const cols = threeCol ? 3 : 2;
  const gap = threeCol ? 0.32 : 0.58;
  const colW = threeCol ? 3.55 : 5.3;
  const startY = threeCol ? 2.55 : 2.48;
  data.slice(0, threeCol ? 3 : 4).forEach((line, idx) => {
    const x = 0.85 + (idx % cols) * (colW + gap);
    const y = startY + Math.floor(idx / cols) * 1.7;
    const role = kind === 'project' ? ['CONCEPT', 'PROBLEM', 'SOLUTION'][idx] : (kind === 'philosophy' ? ['EXPERIENCE', 'MEMORY', 'VALUE'][idx] : (line.period || line.role || `SECTION ${idx + 1}`));
    addTopRule(x, y, colW, idx === 1 && !threeCol ? accent : soft);
    addPptText(s, role || `SECTION ${idx + 1}`, { x, y: y + 0.25, w: colW, h: 0.18, fontFace: t.fonts.heading, fontSize: 9.5, bold: true, color: idx % 2 === 0 ? accent : muted, charSpacing: 0.5, fit: 'shrink' });
    addPptText(s, line.heading, { x, y: y + 0.65, w: colW - 0.1, h: 0.28, fontFace: t.fonts.heading, fontSize: 12.2, bold: true, color: ink, fit: 'shrink' });
    addPptText(s, line.body || '', { x, y: y + 1.05, w: colW - 0.1, h: threeCol ? 0.72 : 0.54, fontFace: t.fonts.body, fontSize: 8.3, color: ink, fit: 'shrink' });
    if (kind === 'stack') {
      s.addShape('rect', { x, y: y + 1.64, w: colW, h: 0.035, fill: { color: 'EEF3FA' }, line: { color: 'EEF3FA' } });
      s.addShape('rect', { x, y: y + 1.64, w: colW * (0.92 - idx * 0.07), h: 0.035, fill: { color: accent }, line: { color: accent } });
    }
  });
}

function drawTimelinePptx(s, slide, t, v, i, W, H) {
  return drawTimelineReferencePptx(s, slide, t, v, i, W, H);
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = pptAcceptedLines(slide);
  const mood = acceptedSlideMood(slide, i);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'CAREER TIMELINE');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
  if (!isCover && mood === 'toc') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, slide.title || '', { x: 0.75, y: 0.8, w: 4.6, h: 1.5, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: 'FFFFFF' });
    s.addShape('rect', { x: 6.2, y: 0.8, w: 0.02, h: 5.9, fill: { color: 'FFFFFF', transparency: 75 }, line: { color: 'FFFFFF', transparency: 100 } });
    lines.slice(0, 5).forEach((line, idx) => {
      const y = 0.95 + idx * 1.05;
      addPptText(s, String(idx + 1).padStart(2, '0'), { x: idx % 2 ? 6.45 : 7.4, y, w: 0.5, h: 0.22, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.accent) });
      addPptText(s, line.heading, { x: idx % 2 ? 7.1 : 8.05, y, w: 3.2, h: 0.22, fontFace: t.fonts.heading, fontSize: 11.5, bold: true, color: 'FFFFFF' });
      addPptText(s, line.body, { x: idx % 2 ? 7.1 : 8.05, y: y + 0.3, w: 3.2, h: 0.28, fontFace: t.fonts.body, fontSize: 7.2, color: 'AFAFAF' });
    });
    return;
  }
  if (!isCover && mood === 'metric') {
    const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 3);
    addPptText(s, 'GROWTH SNAPSHOT', { x: 0.78, y: 0.58, w: 2.6, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.78, y: 1.15, w: 5.4, h: 1.35, fontFace: t.fonts.heading, fontSize: 27, bold: true, color: hex(v.ink) });
    s.addShape('roundRect', { x: 8.2, y: 0.9, w: 3.8, h: 5.6, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.24 });
    (metrics.length ? metrics : [{ label: lines[0]?.heading, value: lines[0]?.body }]).slice(0, 3).forEach((m, idx) => {
      const y = 1.35 + idx * 1.55;
      addPptText(s, pptAcceptedMetricText(m), { x: 8.65, y, w: 2.8, h: 0.42, fontFace: t.fonts.heading, fontSize: 25, bold: false, color: idx === 0 ? hex(v.accent) : 'FFFFFF' });
      addPptText(s, m?.label || '성장 지표', { x: 8.65, y: y + 0.52, w: 2.5, h: 0.24, fontFace: t.fonts.body, fontSize: 8, bold: true, color: 'BDBDBD' });
    });
    return;
  }
  if (!isCover) return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'CAREER TIMELINE');
  addPptText(s, 'CAREER TIMELINE', { x: 0.82, y: 0.7, w: 2.5, h: 0.25, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 2 });
  addPptText(s, slide.title || '', { x: 0.82, y: 1.12, w: 3.8, h: isCover ? 2.3 : 1.35, fontFace: t.fonts.heading, fontSize: isCover ? 31 : 22, bold: true, color: hex(v.ink) });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 0.82, y: isCover ? 3.75 : 2.62, w: 3.4, h: 0.85, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted) });
  s.addShape('rect', { x: 5.35, y: 1.0, w: 0.025, h: 5.65, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
  lines.slice(0, 5).forEach((line, idx) => {
    const y = 0.95 + idx * 1.13;
    const fill = idx === 0 ? v.dark : v.card;
    const fg = idx === 0 ? 'FFFFFF' : hex(v.ink);
    s.addShape('ellipse', { x: 5.17, y: y + 0.38, w: 0.38, h: 0.38, fill: { color: idx === 0 ? hex(v.accent) : hex(v.card) }, line: { color: hex(v.dark), width: 2 } });
    s.addShape('roundRect', { x: 5.85, y, w: 6.55, h: 0.95, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.12 });
    addPptText(s, line.period || `MILESTONE ${idx + 1}`, { x: 6.1, y: y + 0.13, w: 2.4, h: 0.18, fontFace: t.fonts.body, fontSize: 7, bold: true, color: idx === 0 ? hex(v.accent) : hex(v.muted) });
    addPptText(s, line.heading, { x: 6.1, y: y + 0.37, w: 5.7, h: 0.24, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: fg });
    addPptText(s, line.body, { x: 6.1, y: y + 0.64, w: 5.7, h: 0.18, fontFace: t.fonts.body, fontSize: 7.4, color: idx === 0 ? 'D8D8D8' : hex(v.muted) });
  });
  addPptText(s, String(i + 1).padStart(2, '0'), { x: W - 1.1, y: 0.4, w: 0.6, h: 0.35, fontFace: t.fonts.heading, fontSize: 20, bold: true, color: hex(v.soft), align: 'right' });
}

function drawCaseStudyPptx(s, slide, t, v, i, W, H) {
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const lines = pptAcceptedLines(slide);
  const mood = acceptedSlideMood(slide, i);
  if (!isCover && mood !== 'toc' && mood !== 'closing') return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'CASE STUDY');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
  if (!isCover && mood === 'toc') {
    addPptText(s, 'CASE FILE INDEX', { x: 0.68, y: 0.58, w: 2.3, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.68, y: 1.05, w: 7.5, h: 0.95, fontFace: t.fonts.heading, fontSize: 28, bold: true, color: hex(v.ink) });
    lines.slice(0, 5).forEach((line, idx) => {
      const x = 0.7 + idx * 2.45;
      const fill = idx === 0 ? v.dark : v.card;
      s.addShape('roundRect', { x, y: 3.25, w: 2.12, h: 3.35, fill: { color: hex(fill) }, line: { color: idx === 0 ? hex(fill) : hex(v.soft) }, rectRadius: 0.06 });
      addPptText(s, `FILE ${String(idx + 1).padStart(2, '0')}`, { x: x + 0.22, y: 3.55, w: 1.3, h: 0.18, fontFace: t.fonts.body, fontSize: 7, bold: true, color: idx === 0 ? hex(v.accent) : hex(v.muted) });
      addPptText(s, line.heading, { x: x + 0.22, y: 4.55, w: 1.55, h: 0.5, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: idx === 0 ? 'FFFFFF' : hex(v.ink) });
      addPptText(s, line.body, { x: x + 0.22, y: 5.25, w: 1.55, h: 0.72, fontFace: t.fonts.body, fontSize: 7.2, color: idx === 0 ? 'BDBDBD' : hex(v.muted) });
    });
    return;
  }
  if (!isCover && mood === 'metric') {
    const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, 'CASE IMPACT', { x: 0.72, y: 0.65, w: 2.2, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.72, y: 1.25, w: 6.9, h: 1.4, fontFace: t.fonts.heading, fontSize: 29, bold: true, color: 'FFFFFF' });
    (metrics.length ? metrics : [{ label: 'Problem', value: '정의' }, { label: 'Action', value: '실행' }, { label: 'Impact', value: '성과' }, { label: 'Learning', value: '학습' }]).slice(0, 4).forEach((m, idx) => {
      const x = 0.72 + idx * 3.1;
      s.addShape('rect', { x, y: 5.0, w: 2.45, h: 0.05, fill: { color: idx === 2 ? hex(v.accent) : 'FFFFFF', transparency: idx === 2 ? 0 : 80 }, line: { color: idx === 2 ? hex(v.accent) : 'FFFFFF', transparency: 100 } });
      addPptText(s, pptAcceptedMetricText(m), { x, y: 5.25, w: 2.3, h: 0.35, fontFace: t.fonts.heading, fontSize: 21, color: idx === 2 ? hex(v.accent) : 'FFFFFF' });
      addPptText(s, m?.label || '근거', { x, y: 5.75, w: 2.3, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: 'BDBDBD' });
    });
    return;
  }
  if (!isCover && mood === 'process') {
    addPptText(s, slide.sectionLabel || 'BUILD LOG', { x: 0.72, y: 0.6, w: 2.1, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 3 });
    addPptText(s, slide.title || '', { x: 0.72, y: 1.1, w: 4.3, h: 1.3, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink) });
    lines.slice(0, 4).forEach((line, idx) => {
      const x = 5.6 + (idx % 2) * 3.0;
      const y = 0.95 + Math.floor(idx / 2) * 2.5;
      const fill = idx === 0 ? v.dark : v.card;
      s.addShape('roundRect', { x, y, w: 2.55, h: 2.05, fill: { color: hex(fill) }, line: { color: idx === 0 ? hex(fill) : hex(v.soft) }, rectRadius: 0.14 });
      addPptText(s, ['01 DISCOVER', '02 DECIDE', '03 BUILD', '04 VERIFY'][idx], { x: x + 0.22, y: y + 0.22, w: 1.6, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: idx === 0 ? hex(v.accent) : hex(v.muted) });
      addPptText(s, line.heading, { x: x + 0.22, y: y + 0.85, w: 1.85, h: 0.38, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: idx === 0 ? 'FFFFFF' : hex(v.ink) });
      addPptText(s, line.body, { x: x + 0.22, y: y + 1.3, w: 1.9, h: 0.38, fontFace: t.fonts.body, fontSize: 7.2, color: idx === 0 ? 'BDBDBD' : hex(v.muted) });
    });
    return;
  }
  if (!isCover) return drawVariedAcceptedPptx(s, slide, t, v, i, W, H, 'CASE STUDY');
  s.addShape('rect', { x: 0, y: 0, w: 3.35, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
  addPptText(s, 'CASE STUDY', { x: 0.55, y: 0.65, w: 1.8, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpacing: 2 });
  addPptText(s, String(i + 1).padStart(2, '0'), { x: 0.55, y: H - 1.45, w: 1.3, h: 0.55, fontFace: t.fonts.heading, fontSize: 36, bold: true, color: 'FFFFFF' });
  addPptText(s, slide.sectionLabel || 'Problem / Process / Impact', { x: 0.55, y: H - 0.82, w: 2.0, h: 0.3, fontFace: t.fonts.body, fontSize: 8, color: 'BDBDBD' });
  s.addShape('roundRect', { x: 4.05, y: 0.75, w: 2.15, h: 0.34, fill: { color: hex(v.bg) }, line: { color: hex(v.soft) }, rectRadius: 0.16 });
  addPptText(s, slide.sectionLabel || 'Project Evidence', { x: 4.18, y: 0.83, w: 1.8, h: 0.14, fontFace: t.fonts.body, fontSize: 7, bold: true, color: hex(v.accent) });
  addPptText(s, slide.title || '', { x: 4.05, y: 1.35, w: 8.0, h: isCover ? 1.85 : 1.05, fontFace: t.fonts.heading, fontSize: isCover ? 33 : 23, bold: true, color: hex(v.ink) });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 4.05, y: isCover ? 3.25 : 2.42, w: 7.3, h: 0.45, fontFace: t.fonts.body, fontSize: 9, color: hex(v.muted) });
  if (!isCover) {
    lines.slice(0, 4).forEach((line, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = 4.05 + col * 4.15;
      const y = 4.0 + row * 1.35;
      s.addShape('roundRect', { x, y, w: 3.8, h: 1.13, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.1 });
      s.addShape('ellipse', { x: x + 3.35, y: y + 0.16, w: 0.28, h: 0.28, fill: { color: idx === 2 ? hex(v.accent) : hex(v.soft) }, line: { color: idx === 2 ? hex(v.accent) : hex(v.soft) } });
      addPptText(s, ['Problem', 'Decision', 'Build', 'Impact'][idx] || `Step ${idx + 1}`, { x: x + 0.2, y: y + 0.18, w: 1.6, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: hex(v.accent) });
      addPptText(s, line.heading, { x: x + 0.2, y: y + 0.45, w: 2.8, h: 0.22, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: hex(v.ink) });
      addPptText(s, line.body, { x: x + 0.2, y: y + 0.72, w: 3.1, h: 0.24, fontFace: t.fonts.body, fontSize: 7.3, color: hex(v.muted) });
    });
  }
}

function drawCaseStudyDeckPptx(s, slide, t, v, i, W, H) {
  const isCover = slide.layout === 'cover' || slide.layout === 'section';
  const mood = acceptedSlideMood(slide, i);
  const lines = pptAcceptedLines(slide);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const leftLines = lines.slice(0, 2);
  const rightLines = lines.slice(2, 4);
  const label = safePptText(slide.sectionLabel || 'CASE STUDY');
  const metricCards = (metrics.length ? metrics : [
    { label: 'Impact', value: leftLines[0]?.heading || '성과 요약' },
    { label: 'Flow', value: rightLines[0]?.heading || '프로세스 정리' },
  ]).slice(0, 2);

  if (mood === 'closing' || isCover) {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    s.addShape('ellipse', { x: -0.7, y: -0.45, w: 2.7, h: 1.7, fill: { color: '7A1F00', transparency: 72 }, line: { color: '7A1F00', transparency: 100 } });
    s.addShape('ellipse', { x: W - 2.4, y: H - 1.85, w: 3.0, h: 2.0, fill: { color: '6C00D8', transparency: 76 }, line: { color: '6C00D8', transparency: 100 } });
    s.addShape('ellipse', { x: 4.2, y: 1.6, w: 2.8, h: 2.8, line: { color: '5284FF', transparency: 86, width: 18 }, fill: { color: hex(v.dark), transparency: 100 } });
    s.addShape('ellipse', { x: 7.0, y: 2.35, w: 2.0, h: 2.0, line: { color: 'FF842C', transparency: 88, width: 18 }, fill: { color: hex(v.dark), transparency: 100 } });
    if (mood !== 'closing') s.addShape('roundRect', { x: 2.4, y: 2.1, w: 0.72, h: 0.24, fill: { color: 'FFFFFF', transparency: 3 }, line: { color: 'FFFFFF', transparency: 100 }, rectRadius: 0.05 });
    addPptText(s, mood === 'closing' ? safePptText(slide.title || 'THANK YOU') : safePptText(slide.title || label), { x: 1.3, y: mood === 'closing' ? 3.0 : 3.15, w: W - 2.6, h: 0.95, fontFace: t.fonts.heading, fontSize: mood === 'closing' ? 34 : 30, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
    if (mood !== 'closing' && slide.subtitle) addPptText(s, slide.subtitle, { x: 2.4, y: 4.1, w: W - 4.8, h: 0.28, fontFace: t.fonts.body, fontSize: 9, color: 'D1D5E6', align: 'center', fit: 'shrink' });
    return;
  }

  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
  s.addShape('roundRect', { x: 0.72, y: 0.38, w: 1.0, h: 0.3, fill: { color: 'FFFFFF', transparency: 4 }, line: { color: 'FFFFFF', transparency: 100 }, rectRadius: 0.08 });
  addPptText(s, safePptText(slide.title || label), { x: 0.72, y: 0.86, w: 6.5, h: 0.9, fontFace: t.fonts.heading, fontSize: slide.title && String(slide.title).length > 26 ? 24 : 30, bold: true, color: hex(v.ink), fit: 'shrink' });
  s.addShape('roundRect', { x: 0.62, y: 2.2, w: 7.02, h: 4.68, fill: { color: hex(v.card) }, line: { color: 'D8DDF0', transparency: 24 }, rectRadius: 0.18, shadow: { type: 'outer', color: 'B9C0DA', blur: 2, angle: 45, distance: 2, opacity: 0.12 } });
  addPptText(s, '문제정의', { x: 1.2, y: 2.75, w: 1.8, h: 0.26, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: hex(v.ink) });
  addPptText(s, '전략 Strategies/Objectives', { x: 4.5, y: 2.75, w: 2.6, h: 0.26, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: hex(v.ink) });
  s.addShape('rect', { x: 3.92, y: 3.12, w: 0.02, h: 2.6, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
  leftLines.forEach((line, idx) => {
    const y = 4.0 + idx * 1.15;
    s.addShape('roundRect', { x: 1.24, y: y + 0.02, w: 0.14, h: 0.14, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: idx === 0 ? hex(v.muted) : hex(v.soft), width: 2 }, rectRadius: 0.02 });
    addPptText(s, safePptText(line.body || line.heading), { x: 1.55, y, w: 2.0, h: 0.54, fontFace: t.fonts.body, fontSize: 10, bold: true, color: idx === 0 ? hex(v.ink) : hex(v.muted), fit: 'shrink' });
    if (line.heading && line.body && line.heading !== line.body) addPptText(s, safePptText(line.heading), { x: 1.55, y: y + 0.55, w: 1.7, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.ink), fit: 'shrink' });
  });
  rightLines.forEach((line, idx) => {
    const y = 3.95 + idx * 1.05;
    addPptText(s, '›', { x: 4.5, y, w: 0.14, h: 0.24, fontFace: t.fonts.heading, fontSize: 16, bold: true, color: hex(v.ink) });
    addPptText(s, safePptText(line.heading || line.body), { x: 4.8, y, w: 2.05, h: 0.32, fontFace: t.fonts.body, fontSize: 10, bold: true, color: hex(v.ink), fit: 'shrink' });
    if (line.body && line.body !== line.heading) {
      s.addShape('rect', { x: 4.8, y: y + 0.42, w: 0.03, h: 0.46, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
      addPptText(s, safePptText(line.body), { x: 5.0, y: y + 0.38, w: 1.9, h: 0.42, fontFace: t.fonts.body, fontSize: 8, color: hex(v.muted), fit: 'shrink' });
    }
  });

  const drawPanel = (title, captions, x, y, w, h, tall = false) => {
    s.addShape('roundRect', { x, y, w, h, fill: { color: 'FCFCFF', transparency: 6 }, line: { color: 'D8DDF0', transparency: 18 }, rectRadius: 0.14, shadow: { type: 'outer', color: 'B9C0DA', blur: 2, angle: 45, distance: 2, opacity: 0.12 } });
    addPptText(s, safePptText(title), { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.22, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: hex(v.ink), align: 'center', fit: 'shrink' });
    s.addShape('rect', { x: x + (w - 1.3) / 2, y: y + 0.38, w: 1.3, h: 0.01, fill: { color: 'D8DDF0' }, line: { color: 'D8DDF0' } });
    const cols = tall ? Math.min(2, Math.max(1, captions.length)) : Math.min(3, Math.max(1, captions.length));
    captions.forEach((caption, idx) => {
      const cw = tall ? 1.45 : 1.0;
      const gap = tall ? 0.24 : 0.18;
      const sx = x + 0.2 + idx * (cw + gap);
      const sy = y + 0.62;
      s.addShape('roundRect', { x: sx, y: sy, w: cw, h: tall ? 1.05 : 1.25, fill: { color: idx % 3 === 0 ? 'F3EDFF' : idx % 3 === 1 ? 'FFF5E8' : 'F4F7FF' }, line: { color: 'D6DDF1', transparency: 10 }, rectRadius: 0.12 });
      s.addShape('roundRect', { x: sx + 0.1, y: sy + 0.1, w: cw - 0.2, h: tall ? 0.78 : 0.98, fill: { color: idx % 3 === 0 ? 'E5EBFF' : idx % 3 === 1 ? 'F8FAFF' : 'EFF3FF' }, line: { color: idx % 2 ? 'E8ECF8' : 'D8E6FF', transparency: 8 }, rectRadius: 0.1 });
      s.addShape('roundRect', { x: sx + 0.16, y: sy + (tall ? 0.84 : 1.04), w: cw - 0.32, h: 0.06, fill: { color: idx % 2 ? 'B7C3E3' : 'AED3FF', transparency: 15 }, line: { color: idx % 2 ? 'B7C3E3' : 'AED3FF', transparency: 100 }, rectRadius: 0.03 });
      addPptText(s, safePptText(caption), { x: sx, y: sy + (tall ? 1.12 : 1.32), w: cw, h: 0.16, fontFace: t.fonts.body, fontSize: 7, color: hex(v.muted), align: 'center', fit: 'shrink' });
    });
  };

  if (mood === 'metric') {
    drawPanel('성과 화면', lines.slice(0, 2).map(line => line.heading || '성과 요약'), 7.25, 2.1, 3.72, 2.08, true);
    s.addShape('roundRect', { x: 7.25, y: 4.38, w: 3.72, h: 1.62, fill: { color: 'FCFCFF', transparency: 6 }, line: { color: 'D8DDF0', transparency: 18 }, rectRadius: 0.14, shadow: { type: 'outer', color: 'B9C0DA', blur: 2, angle: 45, distance: 2, opacity: 0.12 } });
    metricCards.forEach((metric, idx) => {
      const x = 7.55 + idx * 1.8;
      s.addShape('ellipse', { x, y: 4.78, w: 0.58, h: 0.58, fill: { color: idx === 0 ? '2B90FF' : '4A4FCA', transparency: 8 }, line: { color: idx === 0 ? '2B90FF' : '4A4FCA', transparency: 100 } });
      addPptText(s, pptAcceptedMetricText(metric), { x: x + 0.7, y: 4.78, w: 1.0, h: 0.22, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: idx === 0 ? '2B90FF' : '4A4FCA', fit: 'shrink' });
      addPptText(s, safePptText(metric.label || (idx === 0 ? '리소스 효율' : '핵심 변화')), { x: x + 0.7, y: 5.08, w: 1.2, h: 0.26, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.ink), fit: 'shrink' });
    });
    return;
  }

  drawPanel(mood === 'toc' ? 'MAIN PROJECTS' : mood === 'process' ? '프로젝트 진행 화면' : label, lines.slice(0, 3).map(line => line.heading || '핵심 포인트'), 7.25, 2.1, 3.72, mood === 'process' ? 1.66 : 2.08, mood !== 'process');
  drawPanel(mood === 'process' ? '대시보드와 주요 기능' : '결과 Key Result', lines.slice(1, 3).map(line => line.heading || line.period || '핵심 포인트'), 7.25, 4.38, 3.72, 1.62, true);
}

function drawProposalHeader(s, slide, t, i, W, isDark) {
  const c = t.colors;
  const section = slide.sectionLabel || (slide.layout === 'closing' ? '마무리' : '제안서');
  const titleColor = isDark ? 'FFFFFF' : hex(c.sub);
  const titleSize = dynamicFontPt(slide.title, 24, { min: 18, max: 25 });
  const bg = isDark ? c.dark : c.bg;
  const accentColor = pptVisibleOn(bg, c.accent, isDark ? SAFE_TEXT_LIGHT : c.dark);
  
  s.addShape('roundRect', { x: 0.72, y: 0.35, w: 1.45, h: 0.32, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.14 });
  s.addShape('ellipse', { x: 0.82, y: 0.46, w: 0.08, h: 0.08, fill: { color: accentColor }, line: { color: accentColor } });
  s.addText(section, { x: 0.95, y: 0.4, w: 1.0, h: 0.18, fontFace: t.fonts.body, fontSize: 7, bold: true, color: pptTextOn('#FFFFFF', c.sub) });
  
  s.addText(pptProposalTextParts(slide.title || section, titleColor, accentColor, { fontFace: t.fonts.heading }), { x: 0.95, y: 0.88, w: W - 1.9, h: 0.88, fontSize: titleSize, bold: true, align: slide.layout === 'profile' ? 'left' : 'center', valign: 'middle', fit: 'shrink' });
  if (slide.subtitle) addPptText(s, slide.subtitle, { x: 1.65, y: 1.82, w: W - 3.3, h: 0.34, fontFace: t.fonts.body, fontSize: 8.8, bold: true, color: isDark ? 'D4D4D8' : hex(c.sub), align: 'center', fit: 'shrink' });
}

function drawCaseStudyProposalPptx(s, slide, t, v, i, W, H) {
  const mood = acceptedSlideMood(slide, i);
  const proposalSlide = composeAcceptedProposalSlide({
    ...slide,
    sectionLabel: slide.sectionLabel || '케이스 스터디',
    proposalVariant: mood === 'toc' ? 'contents' : slide.proposalVariant,
    dark: mood === 'metric' ? false : slide.dark,
  }, t, i);

  if (proposalSlide.layout === 'cover' || proposalSlide.layout === 'section') {
    return drawProposalCover(s, {
      ...proposalSlide,
      bullets: (proposalSlide.bullets && proposalSlide.bullets.length ? proposalSlide.bullets : ['CASE STUDY', 'PROBLEM SOLVING', 'IMPACT']).slice(0, 3),
    }, t, W, H);
  }

  if (mood === 'closing') {
    return drawProposal(s, {
      ...proposalSlide,
      layout: 'closing',
      dark: true,
      title: proposalSlide.title || 'THANK YOU',
    }, t, i, W, H);
  }

  return drawProposal(s, proposalSlide, t, i, W, H);
}

function drawCaseStudyReferencePptx(s, slide, t, v, i, W, H) {
  const variant = caseStudyVariantForIndex(slide, i);
  const lines = pptAcceptedLines(slide);
  const items = normalizePptItems(slide.items || []);
  const metrics = (slide.metrics || lines.flatMap(line => line.metrics || [])).slice(0, 4);
  const left = lines.slice(0, 2);
  const right = lines.slice(2, 4);

  const addDarkTitle = (title) => {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    s.addShape('ellipse', { x: -0.5, y: -0.3, w: 2.2, h: 1.2, fill: { color: hex(v.accent), transparency: 58 }, line: { color: hex(v.accent), transparency: 100 } });
    s.addShape('ellipse', { x: W - 2.0, y: H - 1.35, w: 2.6, h: 1.5, fill: { color: hex(v.accent), transparency: 68 }, line: { color: hex(v.accent), transparency: 100 } });
    s.addShape('roundRect', { x: 3.85, y: 3.15, w: 0.62, h: 0.2, fill: { color: 'FFFFFF', transparency: 6 }, line: { color: 'FFFFFF', transparency: 100 }, rectRadius: 0.04 });
    addPptText(s, safePptText(title || slide.title || 'CASE STUDY'), { x: 1.4, y: 3.45, w: W - 2.8, h: 0.8, fontFace: t.fonts.heading, fontSize: 28, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
  };

  const caseLines = lines.length ? lines : [{ heading: slide.sectionLabel || 'Case', body: slide.subtitle || slide.title || 'Evidence' }];
  const caseMetrics = metrics.length ? metrics : [
    { label: 'Problem', value: caseLines[0]?.heading || 'Defined' },
    { label: 'Action', value: caseLines[1]?.heading || 'Built' },
    { label: 'Result', value: caseLines[2]?.heading || 'Verified' },
  ];

  if (variant === 'closing') return addDarkTitle(slide.title || 'THANK YOU');
  if (variant.startsWith('dark-title')) return addDarkTitle();

  // ── cs-* explicit layouts (buildCaseStudyReferenceDeck) ──
  if (slide.layout === 'cs-closing') return addDarkTitle(slide.title || 'THANK YOU');

  if (slide.layout === 'cs-cover') {
    const titleText = safePptText(slide.title);
    const tagBullets = (slide.bullets || []).filter(Boolean).slice(0, 4).map(safePptText).filter(Boolean);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    s.addShape('ellipse', { x: -1.0, y: -0.7, w: 3.0, h: 2.2, fill: { color: hex(v.accent), transparency: 60 }, line: { color: hex(v.accent), transparency: 100 } });
    s.addShape('ellipse', { x: W - 2.4, y: H - 1.95, w: 3.6, h: 2.8, fill: { color: hex(v.accent), transparency: 78 }, line: { color: hex(v.accent), transparency: 100 } });
    s.addShape('roundRect', { x: 0.89, y: 0.78, w: 0.78, h: 0.19, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.05 });
    addPptText(s, safePptText(slide.sectionLabel || 'CASE STUDY'), { x: 1.83, y: 0.74, w: 6.0, h: 0.24, fontFace: t.fonts.body, fontSize: 10.5, bold: true, color: hex(v.accent), charSpace: 4 });
    addPptText(s, titleText, { x: 0.89, y: 2.55, w: W - 1.78, h: 2.5, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: 'FFFFFF', valign: 'top', breakLine: true });
    if (slide.subtitle) {
      addPptText(s, safePptText(slide.subtitle), { x: 0.89, y: 5.15, w: 10.0, h: 1.0, fontFace: t.fonts.body, fontSize: 11, color: 'B8C0D5' });
    }
    if (tagBullets.length) {
      let pillX = 0.89;
      tagBullets.forEach((bullet, idx) => {
        const isPrimary = idx === 0;
        const text = bullet.toUpperCase();
        const pillW = Math.min(2.6, 0.55 + text.length * 0.13);
        if (pillX + pillW > W - 0.89) return;
        s.addShape('roundRect', { x: pillX, y: 6.72, w: pillW, h: 0.36, fill: { color: isPrimary ? hex(v.accent) : 'FFFFFF', transparency: isPrimary ? 0 : 92 }, line: { color: isPrimary ? hex(v.accent) : 'FFFFFF', transparency: isPrimary ? 100 : 82 }, rectRadius: 0.18 });
        addPptText(s, text, { x: pillX, y: 6.75, w: pillW, h: 0.3, fontFace: t.fonts.body, fontSize: 8, bold: true, color: isPrimary ? 'FFFFFF' : 'D8DEEA', align: 'center', charSpace: 1.6 });
        pillX += pillW + 0.14;
      });
    }
    return;
  }

  if (slide.layout === 'cs-contents') {
    const tocItems = items.length ? items : caseLines.map(line => ({ heading: line.heading, body: line.body }));
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    s.addShape('rect', { x: 3.8, y: 0.75, w: 0.012, h: H - 1.5, fill: { color: 'FFFFFF', transparency: 84 }, line: { color: 'FFFFFF', transparency: 100 } });
    addPptText(s, 'CASE FILE', { x: 0.75, y: 0.78, w: 2.5, h: 0.2, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(v.accent), charSpace: 3.5 });
    addPptText(s, 'INDEX', { x: 0.75, y: 5.8, w: 3.0, h: 0.86, fontFace: t.fonts.heading, fontSize: 50, bold: true, color: 'FFFFFF' });
    addPptText(s, safePptText(slide.title || 'Contents'), { x: 4.4, y: 0.86, w: W - 5.2, h: 0.86, fontFace: t.fonts.heading, fontSize: 30, bold: true, color: 'FFFFFF' });
    tocItems.slice(0, 6).forEach((item, idx) => {
      const y = 1.95 + idx * 0.75;
      addPptText(s, String(idx + 1).padStart(2, '0'), { x: 4.4, y, w: 0.6, h: 0.3, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: idx === 0 ? hex(v.accent) : 'FFFFFF', transparency: idx === 0 ? 0 : 58 });
      addPptText(s, safePptText(item.heading || item.title), { x: 5.05, y, w: 5.8, h: 0.3, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: 'FFFFFF' });
      if (item.body) {
        addPptText(s, safePptText(item.body), { x: 5.05, y: y + 0.32, w: 7.4, h: 0.26, fontFace: t.fonts.body, fontSize: 9, color: 'AEB7C7' });
      }
      if (idx < Math.min(tocItems.length, 6) - 1) {
        s.addShape('rect', { x: 4.4, y: y + 0.7, w: W - 5.2, h: 0.005, fill: { color: 'FFFFFF', transparency: 88 }, line: { color: 'FFFFFF', transparency: 100 } });
      }
    });
    return;
  }

  if (slide.layout === 'cs-technical') {
    const techItems = items.slice(0, 6);
    const heroMetric = metrics[0] || null;
    const cols = techItems.length > 4 ? 2 : techItems.length <= 2 ? 1 : 2;
    const rows = Math.max(1, Math.ceil(techItems.length / cols));
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'TECHNICAL EXCELLENCE'), { x: 0.75, y: 0.62, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 10.5, bold: true, color: hex(v.accent), charSpace: 3 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 0.92, w: W - 1.5, h: 0.92, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink) });
    const gridLeft = heroMetric ? 5.15 : 0.75;
    const gridW = W - gridLeft - 0.75;
    const gridTop = 2.36, gridBottom = H - 0.75;
    const gridH = gridBottom - gridTop;
    if (heroMetric) {
      s.addShape('roundRect', { x: 0.75, y: gridTop, w: 4.0, h: gridH, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.22 });
      addPptText(s, 'HERO METRIC', { x: 1.05, y: gridTop + 0.32, w: 3.4, h: 0.2, fontFace: t.fonts.body, fontSize: 9.5, bold: true, color: hex(v.accent), charSpace: 3 });
      addPptText(s, safePptText(heroMetric.label || 'Impact'), { x: 1.05, y: gridTop + 0.7, w: 3.4, h: 0.8, fontFace: t.fonts.body, fontSize: 10.5, color: 'B8C0D5' });
      addPptText(s, safePptText(acceptedMetricText(heroMetric)), { x: 1.05, y: gridTop + gridH - 1.55, w: 3.4, h: 0.95, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(v.accent) });
      if (heroMetric.before && heroMetric.after) {
        addPptText(s, 'BEFORE → AFTER', { x: 1.05, y: gridTop + gridH - 0.5, w: 3.4, h: 0.2, fontFace: t.fonts.body, fontSize: 9, bold: true, color: 'FFFFFF', transparency: 50, charSpace: 2 });
      }
    }
    const cellW = (gridW - (cols - 1) * 0.18) / cols;
    const cellH = (gridH - (rows - 1) * 0.18) / rows;
    techItems.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = gridLeft + col * (cellW + 0.18);
      const y = gridTop + row * (cellH + 0.18);
      const icon = safePptText(item.role || item.period || '') || String(idx + 1);
      s.addShape('roundRect', { x, y, w: cellW, h: cellH, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.18 });
      s.addShape('roundRect', { x: x + 0.22, y: y + 0.22, w: 0.5, h: 0.5, fill: { color: hex(v.accent), transparency: 80 }, line: { color: hex(v.accent), transparency: 80 }, rectRadius: 0.1 });
      addPptText(s, icon, { x: x + 0.22, y: y + 0.32, w: 0.5, h: 0.3, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.accent), align: 'center' });
      addPptText(s, safePptText(item.heading), { x: x + 0.85, y: y + 0.22, w: cellW - 1.07, h: 0.34, fontFace: t.fonts.heading, fontSize: 12.5, bold: true, color: hex(v.ink) });
      addPptText(s, safePptText(item.body), { x: x + 0.85, y: y + 0.6, w: cellW - 1.07, h: cellH - 0.82, fontFace: t.fonts.body, fontSize: 8.5, color: hex(v.muted) });
    });
    return;
  }

  if (slide.layout === 'cs-skillmap') {
    const skillItems = items.slice(0, 4);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'TECHNICAL SUMMARY'), { x: 0.75, y: 0.62, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 10.5, bold: true, color: hex(v.accent), charSpace: 3 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 0.92, w: W - 1.5, h: 0.92, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink) });
    const gridTop = 2.33, gridBottom = H - 0.7;
    const gridLeft = 0.75, gridRight = W - 0.75;
    const cellW = (gridRight - gridLeft - 0.2) / 2;
    const cellH = (gridBottom - gridTop - 0.2) / 2;
    skillItems.forEach((item, idx) => {
      const col = idx % 2, row = Math.floor(idx / 2);
      const x = gridLeft + col * (cellW + 0.2);
      const y = gridTop + row * (cellH + 0.2);
      const isPrimary = idx === 0;
      const icon = safePptText(item.role || item.period || '') || String(idx + 1);
      const bullets = splitBulletLines(item.body);
      s.addShape('roundRect', { x, y, w: cellW, h: cellH, fill: { color: isPrimary ? hex(v.dark) : hex(v.card) }, line: { color: isPrimary ? hex(v.dark) : hex(v.soft) }, rectRadius: 0.22 });
      s.addShape('roundRect', { x: x + 0.28, y: y + 0.28, w: 0.46, h: 0.46, fill: { color: hex(v.accent), transparency: isPrimary ? 70 : 82 }, line: { color: hex(v.accent), transparency: isPrimary ? 70 : 82 }, rectRadius: 0.1 });
      addPptText(s, icon, { x: x + 0.28, y: y + 0.37, w: 0.46, h: 0.3, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.accent), align: 'center' });
      addPptText(s, safePptText(item.heading), { x: x + 0.86, y: y + 0.32, w: cellW - 1.1, h: 0.4, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: isPrimary ? 'FFFFFF' : hex(v.ink) });
      bullets.slice(0, 4).forEach((line, bi) => {
        const by = y + 0.96 + bi * 0.34;
        s.addShape('ellipse', { x: x + 0.32, y: by + 0.11, w: 0.08, h: 0.08, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
        addPptText(s, safePptText(line), { x: x + 0.5, y: by - 0.02, w: cellW - 0.7, h: 0.32, fontFace: t.fonts.body, fontSize: 9, color: isPrimary ? 'D8DEEA' : hex(v.muted) });
      });
    });
    return;
  }

  if (slide.layout === 'cs-journey') {
    const phases = items.slice(0, 3);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'GROWTH NARRATIVE'), { x: 0.75, y: 0.62, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 10.5, bold: true, color: hex(v.accent), charSpace: 3 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 0.9, w: W - 1.5, h: 0.78, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink) });
    if (slide.subtitle) {
      addPptText(s, safePptText(slide.subtitle), { x: 0.75, y: 1.78, w: W - 1.5, h: 0.5, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
    }
    const rowTop = 2.6, rowBottom = H - 0.7;
    const rowGap = 0.18;
    const rowH = (rowBottom - rowTop - rowGap * 2) / 3;
    phases.forEach((phase, idx) => {
      const y = rowTop + idx * (rowH + rowGap);
      const isAccent = idx === 1;
      const isDarkRow = idx === 0;
      const fill = isDarkRow ? hex(v.dark) : isAccent ? hex(v.accent) : hex(v.card);
      const border = isDarkRow ? hex(v.dark) : isAccent ? hex(v.accent) : hex(v.soft);
      const fg = isDarkRow || isAccent ? 'FFFFFF' : hex(v.ink);
      const muted = isDarkRow ? 'B8C0D5' : isAccent ? 'FFFFFF' : hex(v.muted);
      const tagColor = isDarkRow ? hex(v.accent) : isAccent ? 'FFFFFF' : hex(v.accent);
      const tag = safePptText(phase.role || phase.period || '') || `PHASE 0${idx + 1}`;
      s.addShape('roundRect', { x: 0.75, y, w: W - 1.5, h: rowH, fill: { color: fill }, line: { color: border }, rectRadius: 0.18 });
      addPptText(s, tag, { x: 1.05, y: y + 0.32, w: 1.85, h: 0.3, fontFace: t.fonts.body, fontSize: 9.5, bold: true, color: tagColor, charSpace: 2.8 });
      addPptText(s, safePptText(phase.heading), { x: 3.0, y: y + 0.22, w: W - 3.75, h: 0.42, fontFace: t.fonts.heading, fontSize: 14.5, bold: true, color: fg });
      addPptText(s, safePptText(phase.body), { x: 3.0, y: y + 0.72, w: W - 3.75, h: rowH - 0.92, fontFace: t.fonts.body, fontSize: 10, color: muted });
    });
    return;
  }

  if (slide.layout === 'cs-contribution') {
    const contribItems = items.slice(0, 3);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'NEXT CONTRIBUTION'), { x: 0.75, y: 0.62, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 10.5, bold: true, color: hex(v.accent), charSpace: 3 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 0.92, w: W - 1.5, h: 0.92, fontFace: t.fonts.heading, fontSize: 22, bold: true, color: hex(v.ink) });
    const colTop = 2.56, colBottom = H - 0.7;
    const colLeft = 0.75, colRight = W - 0.75;
    const gap = 0.2;
    const colW = (colRight - colLeft - gap * 2) / 3;
    const colH = colBottom - colTop;
    contribItems.forEach((item, idx) => {
      const x = colLeft + idx * (colW + gap);
      const isPrimary = idx === 1;
      const fill = isPrimary ? hex(v.dark) : hex(v.card);
      const border = isPrimary ? hex(v.dark) : hex(v.soft);
      const fg = isPrimary ? 'FFFFFF' : hex(v.ink);
      const muted = isPrimary ? 'B8C0D5' : hex(v.muted);
      const tag = safePptText(item.role || item.period || '') || `Commit ${idx + 1}`;
      s.addShape('roundRect', { x, y: colTop, w: colW, h: colH, fill: { color: fill }, line: { color: border }, rectRadius: 0.24 });
      const tagW = Math.min(colW - 0.6, 1.5 + tag.length * 0.06);
      s.addShape('roundRect', { x: x + 0.32, y: colTop + 0.3, w: tagW, h: 0.3, fill: { color: hex(v.accent), transparency: isPrimary ? 70 : 82 }, line: { color: hex(v.accent), transparency: isPrimary ? 70 : 82 }, rectRadius: 0.14 });
      addPptText(s, tag, { x: x + 0.32, y: colTop + 0.34, w: tagW, h: 0.22, fontFace: t.fonts.body, fontSize: 8.5, bold: true, color: hex(v.accent), align: 'center', charSpace: 1.8 });
      addPptText(s, safePptText(item.heading), { x: x + 0.32, y: colTop + 0.88, w: colW - 0.64, h: 1.1, fontFace: t.fonts.heading, fontSize: 16, bold: true, color: fg });
      addPptText(s, safePptText(item.body), { x: x + 0.32, y: colTop + 2.1, w: colW - 0.64, h: colH - 2.3, fontFace: t.fonts.body, fontSize: 10, color: muted });
    });
    return;
  }

  if (slide.layout === 'cs-retrospective') {
    const retroItems = items.slice(0, 3);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'RETROSPECTIVE'), { x: 0.75, y: 0.62, w: 5.5, h: 0.2, fontFace: t.fonts.body, fontSize: 10.5, bold: true, color: hex(v.accent), charSpace: 3 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 0.92, w: W - 1.5, h: 0.92, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink) });
    const colTop = 2.5, colBottom = H - 0.7;
    const colLeft = 0.75, colRight = W - 0.75;
    const gap = 0.2;
    const colW = (colRight - colLeft - gap * 2) / 3;
    const colH = colBottom - colTop;
    retroItems.forEach((item, idx) => {
      const x = colLeft + idx * (colW + gap);
      const icon = safePptText(item.role || item.period || '') || '•';
      s.addShape('roundRect', { x, y: colTop, w: colW, h: colH, fill: { color: hex(v.card) }, line: { color: hex(v.soft) }, rectRadius: 0.22 });
      s.addShape('roundRect', { x: x + 0.32, y: colTop + 0.3, w: 0.6, h: 0.6, fill: { color: hex(v.accent), transparency: 82 }, line: { color: hex(v.accent), transparency: 82 }, rectRadius: 0.14 });
      addPptText(s, icon, { x: x + 0.32, y: colTop + 0.42, w: 0.6, h: 0.36, fontFace: t.fonts.heading, fontSize: 16, bold: true, color: hex(v.accent), align: 'center' });
      addPptText(s, safePptText(item.heading), { x: x + 0.32, y: colTop + 1.18, w: colW - 0.64, h: 0.96, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(v.ink) });
      addPptText(s, safePptText(item.body), { x: x + 0.32, y: colTop + 2.28, w: colW - 0.64, h: colH - 2.48, fontFace: t.fonts.body, fontSize: 10, color: hex(v.muted) });
    });
    return;
  }

  if (variant === 'case-toc') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    s.addShape('rect', { x: 2.95, y: 0.6, w: 0.01, h: H - 1.2, fill: { color: 'FFFFFF', transparency: 84 }, line: { color: 'FFFFFF', transparency: 100 } });
    addPptText(s, 'CASE FILE', { x: 0.58, y: 0.62, w: 1.6, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 2, fit: 'shrink' });
    addPptText(s, 'INDEX', { x: 0.58, y: 5.6, w: 2.0, h: 0.56, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: 'FFFFFF', fit: 'shrink' });
    addPptText(s, safePptText(slide.title), { x: 3.55, y: 0.72, w: 8.8, h: 0.76, fontFace: t.fonts.heading, fontSize: 27, bold: true, color: 'FFFFFF', fit: 'shrink' });
    caseLines.slice(0, 5).forEach((line, idx) => {
      const y = 1.9 + idx * 0.72;
      s.addShape('rect', { x: 3.55, y: y + 0.58, w: 8.6, h: 0.01, fill: { color: 'FFFFFF', transparency: 84 }, line: { color: 'FFFFFF', transparency: 100 } });
      addPptText(s, String(idx + 1).padStart(2, '0'), { x: 3.55, y, w: 0.46, h: 0.18, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: idx === 0 ? hex(v.accent) : '888888' });
      addPptText(s, safePptText(line.heading), { x: 4.18, y: y - 0.02, w: 4.8, h: 0.26, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: 'FFFFFF', fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x: 9.25, y: y - 0.02, w: 2.8, h: 0.26, fontFace: t.fonts.body, fontSize: 7.2, color: 'AEB7C7', align: 'right', fit: 'shrink' });
    });
    return;
  }

  if (variant === 'case-snapshot') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    s.addShape('roundRect', { x: 0.75, y: 0.62, w: 1.18, h: 0.12, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) }, rectRadius: 0.04 });
    addPptText(s, safePptText(slide.sectionLabel || 'CASE SNAPSHOT'), { x: 0.75, y: 1.12, w: 2.2, h: 0.16, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: hex(v.accent), charSpace: 1.4 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 1.48, w: 5.9, h: 1.12, fontFace: t.fonts.heading, fontSize: 27, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(slide.subtitle), { x: 0.75, y: 2.78, w: 5.4, h: 0.56, fontFace: t.fonts.body, fontSize: 8.2, color: hex(v.muted), fit: 'shrink' });
    caseLines.slice(0, 3).forEach((line, idx) => {
      const y = 0.85 + idx * 1.78;
      const dark = idx === 0;
      s.addShape('roundRect', { x: 8.1, y, w: 4.25, h: 1.38, fill: { color: dark ? hex(v.dark) : hex(v.card) }, line: { color: dark ? hex(v.dark) : hex(v.soft), transparency: 10 }, rectRadius: idx === 1 ? 0.05 : 0.16 });
      addPptText(s, `SIGNAL ${idx + 1}`, { x: 8.38, y: y + 0.22, w: 1.5, h: 0.14, fontFace: t.fonts.body, fontSize: 6.8, bold: true, color: dark ? hex(v.accent) : hex(v.muted), charSpace: 1 });
      addPptText(s, safePptText(line.heading), { x: 8.38, y: y + 0.52, w: 3.65, h: 0.24, fontFace: t.fonts.heading, fontSize: 12.5, bold: true, color: dark ? 'FFFFFF' : hex(v.ink), fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x: 8.38, y: y + 0.86, w: 3.55, h: 0.28, fontFace: t.fonts.body, fontSize: 7.2, color: dark ? 'B8C0D5' : hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  if (variant === 'case-problem') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    s.addShape('rect', { x: 0, y: 0, w: 4.7, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, 'PROBLEM', { x: 0.58, y: 0.68, w: 1.3, h: 0.16, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 1.6 });
    addPptText(s, safePptText(slide.title), { x: 0.58, y: 1.34, w: 3.45, h: 1.28, fontFace: t.fonts.heading, fontSize: 23, bold: true, color: 'FFFFFF', fit: 'shrink' });
    addPptText(s, safePptText(slide.subtitle || caseLines[0]?.body), { x: 0.58, y: 5.45, w: 3.45, h: 0.7, fontFace: t.fonts.body, fontSize: 8, color: 'B8C0D5', fit: 'shrink' });
    caseLines.slice(0, 4).forEach((line, idx) => {
      const y = 0.88 + idx * 1.35;
      s.addShape('ellipse', { x: 5.45, y, w: 0.45, h: 0.45, fill: { color: idx === 0 ? hex(v.accent) : hex(v.soft) }, line: { color: idx === 0 ? hex(v.accent) : hex(v.soft) } });
      addPptText(s, String(idx + 1), { x: 5.45, y: y + 0.12, w: 0.45, h: 0.12, fontFace: t.fonts.heading, fontSize: 7, bold: true, color: idx === 0 ? 'FFFFFF' : hex(v.ink), align: 'center' });
      addPptText(s, safePptText(line.heading), { x: 6.2, y: y - 0.02, w: 5.5, h: 0.24, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.ink), fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x: 6.2, y: y + 0.34, w: 5.45, h: 0.36, fontFace: t.fonts.body, fontSize: 7.6, color: hex(v.muted), fit: 'shrink' });
      if (idx < 3) s.addShape('rect', { x: 6.2, y: y + 0.92, w: 5.45, h: 0.01, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
    });
    return;
  }

  if (variant === 'case-decision') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'DECISION LOG'), { x: 0.75, y: 0.62, w: 2.3, h: 0.16, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 1.5 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 1.0, w: 8.7, h: 0.68, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink), fit: 'shrink' });
    caseLines.slice(0, 2).forEach((line, idx) => {
      const x = 0.75 + idx * 6.0;
      const dark = idx === 1;
      s.addShape('roundRect', { x, y: 2.25, w: 5.55, h: 3.95, fill: { color: dark ? hex(v.dark) : hex(v.card) }, line: { color: dark ? hex(v.dark) : hex(v.soft), transparency: 10 }, rectRadius: dark ? 0.04 : 0.2 });
      addPptText(s, idx === 0 ? 'CHOSEN' : 'TRADE-OFF', { x: x + 0.35, y: 2.62, w: 1.6, h: 0.14, fontFace: t.fonts.body, fontSize: 7.2, bold: true, color: hex(v.accent), charSpace: 1.3 });
      addPptText(s, safePptText(line.heading), { x: x + 0.35, y: 3.52, w: 4.7, h: 0.62, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: dark ? 'FFFFFF' : hex(v.ink), fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x: x + 0.35, y: 4.42, w: 4.72, h: 0.85, fontFace: t.fonts.body, fontSize: 8, color: dark ? 'B8C0D5' : hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  if (variant === 'case-project') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    s.addShape('roundRect', { x: 0.58, y: 0.55, w: 2.72, h: 6.25, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) }, rectRadius: 0.18 });
    addPptText(s, 'PROJECT', { x: 0.9, y: 0.88, w: 1.4, h: 0.16, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 1.5 });
    addPptText(s, safePptText(slide.sectionLabel || 'Execution'), { x: 0.9, y: 5.55, w: 1.92, h: 0.62, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: 'FFFFFF', fit: 'shrink' });
    addPptText(s, safePptText(slide.title), { x: 3.8, y: 0.7, w: 8.4, h: 0.72, fontFace: t.fonts.heading, fontSize: 23, bold: true, color: hex(v.ink), fit: 'shrink' });
    addPptText(s, safePptText(slide.subtitle), { x: 3.8, y: 1.46, w: 7.8, h: 0.26, fontFace: t.fonts.body, fontSize: 8, color: hex(v.muted), fit: 'shrink' });
    caseLines.slice(0, 4).forEach((line, idx) => {
      const x = 3.8 + (idx % 2) * 4.45;
      const y = 2.15 + Math.floor(idx / 2) * 1.95;
      const dark = idx === 0;
      s.addShape('roundRect', { x, y, w: 4.0, h: 1.55, fill: { color: dark ? hex(v.dark) : hex(v.card) }, line: { color: dark ? hex(v.dark) : hex(v.soft), transparency: 10 }, rectRadius: 0.12 });
      addPptText(s, ['DEFINE', 'BUILD', 'VERIFY', 'SHIP'][idx] || `STEP ${idx + 1}`, { x: x + 0.22, y: y + 0.22, w: 1.5, h: 0.14, fontFace: t.fonts.body, fontSize: 6.8, bold: true, color: dark ? hex(v.accent) : hex(v.muted), charSpace: 1 });
      addPptText(s, safePptText(line.heading), { x: x + 0.22, y: y + 0.58, w: 3.45, h: 0.24, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: dark ? 'FFFFFF' : hex(v.ink), fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x: x + 0.22, y: y + 0.92, w: 3.4, h: 0.32, fontFace: t.fonts.body, fontSize: 7, color: dark ? 'B8C0D5' : hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  if (variant === 'case-impact') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, 'IMPACT PROOF', { x: 0.75, y: 0.72, w: 2.0, h: 0.16, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 1.6 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 1.28, w: 5.6, h: 1.05, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: 'FFFFFF', fit: 'shrink' });
    caseMetrics.slice(0, 4).forEach((metric, idx) => {
      const x = 7.05 + (idx % 2) * 2.7;
      const y = 1.05 + Math.floor(idx / 2) * 2.25;
      s.addShape('rect', { x, y, w: 2.1, h: 0.04, fill: { color: idx === 0 ? hex(v.accent) : 'FFFFFF', transparency: idx === 0 ? 0 : 82 }, line: { color: 'FFFFFF', transparency: 100 } });
      addPptText(s, pptAcceptedMetricText(metric), { x, y: y + 0.35, w: 2.3, h: 0.36, fontFace: t.fonts.heading, fontSize: 20, color: idx === 0 ? hex(v.accent) : 'FFFFFF', fit: 'shrink' });
      addPptText(s, safePptText(metric.label || 'Result'), { x, y: y + 0.92, w: 2.2, h: 0.32, fontFace: t.fonts.body, fontSize: 7.5, bold: true, color: 'AEB7C7', fit: 'shrink' });
    });
    return;
  }

  if (variant === 'case-learning') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'LEARNING'), { x: 0.75, y: 0.62, w: 2.2, h: 0.16, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 1.5 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 0.98, w: 10.8, h: 0.72, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink), fit: 'shrink' });
    caseLines.slice(0, 3).forEach((line, idx) => {
      const x = 1.55 + idx * 0.7;
      const y = 2.2 + idx * 1.15;
      const w = 10.2 - idx * 1.4;
      const fill = idx === 0 ? hex(v.dark) : idx === 1 ? hex(v.accent) : hex(v.card);
      s.addShape('roundRect', { x, y, w, h: 0.92, fill: { color: fill }, line: { color: fill }, rectRadius: 0.12 });
      addPptText(s, safePptText(line.heading), { x: x + 0.28, y: y + 0.18, w: w - 0.56, h: 0.2, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: idx === 2 ? hex(v.ink) : 'FFFFFF', fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x: x + 0.28, y: y + 0.48, w: w - 0.56, h: 0.22, fontFace: t.fonts.body, fontSize: 7.2, color: idx === 2 ? hex(v.muted) : 'E9EEF8', fit: 'shrink' });
    });
    return;
  }

  if (variant === 'case-next') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, 'NEXT STEP', { x: 0.75, y: 0.72, w: 1.8, h: 0.16, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 1.5 });
    addPptText(s, safePptText(slide.title), { x: 0.75, y: 1.18, w: 3.65, h: 1.05, fontFace: t.fonts.heading, fontSize: 23, bold: true, color: hex(v.ink), fit: 'shrink' });
    s.addShape('rect', { x: 5.25, y: 3.72, w: 6.75, h: 0.03, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
    caseLines.slice(0, 4).forEach((line, idx) => {
      const x = 5.25 + idx * 1.75;
      const y = idx % 2 ? 4.05 : 2.1;
      s.addShape('ellipse', { x, y: idx % 2 ? 3.58 : 3.45, w: 0.24, h: 0.24, fill: { color: idx === 0 ? hex(v.accent) : hex(v.dark) }, line: { color: idx === 0 ? hex(v.accent) : hex(v.dark) } });
      addPptText(s, safePptText(line.heading), { x, y, w: 1.35, h: 0.36, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: hex(v.ink), fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x, y: y + 0.5, w: 1.35, h: 0.42, fontFace: t.fonts.body, fontSize: 6.8, color: hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  if (variant === 'case-fit') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, safePptText(slide.sectionLabel || 'ROLE FIT'), { x: 0.72, y: 0.62, w: 2.2, h: 0.16, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), charSpace: 1.5 });
    addPptText(s, safePptText(slide.title), { x: 0.72, y: 1.0, w: 10.8, h: 0.68, fontFace: t.fonts.heading, fontSize: 23, bold: true, color: hex(v.ink), fit: 'shrink' });
    s.addShape('ellipse', { x: 1.05, y: 2.65, w: 2.7, h: 2.7, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    addPptText(s, 'FIT', { x: 1.82, y: 3.3, w: 1.15, h: 0.18, fontFace: t.fonts.body, fontSize: 8, bold: true, color: hex(v.accent), align: 'center', charSpace: 1.4 });
    addPptText(s, safePptText(caseLines[0]?.heading || slide.sectionLabel), { x: 1.42, y: 3.68, w: 1.95, h: 0.55, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
    caseLines.slice(1, 4).forEach((line, idx) => {
      const y = 2.45 + idx * 1.15;
      s.addShape('roundRect', { x: 5.2, y, w: 6.7, h: 0.86, fill: { color: hex(v.card) }, line: { color: hex(v.soft), transparency: 10 }, rectRadius: 0.1 });
      addPptText(s, safePptText(line.heading), { x: 5.48, y: y + 0.16, w: 5.9, h: 0.18, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: hex(v.ink), fit: 'shrink' });
      addPptText(s, safePptText(line.body || line.period), { x: 5.48, y: y + 0.44, w: 5.85, h: 0.22, fontFace: t.fonts.body, fontSize: 7.2, color: hex(v.muted), fit: 'shrink' });
    });
    return;
  }

  if (variant === 'profile') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.dark) }, line: { color: hex(v.dark) } });
    s.addShape('roundRect', { x: 3.2, y: 0.45, w: 5.95, h: 6.0, fill: { color: 'FFFFFF', transparency: 10 }, line: { color: 'FFFFFF', transparency: 100 }, rectRadius: 0.22 });
    s.addShape('ellipse', { x: 0.82, y: 1.15, w: 1.45, h: 1.45, fill: { color: hex(v.accent) }, line: { color: hex(v.accent) } });
    addPptText(s, safePptText(slide.title || '프로필 소개'), { x: 0.72, y: 4.0, w: 2.1, h: 0.72, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.accent), fit: 'shrink' });
    addPptText(s, '#사용자중심 #문제정의 #팀워크', { x: 0.72, y: 6.15, w: 2.2, h: 0.42, fontFace: t.fonts.body, fontSize: 8, color: 'DFE3EF', fit: 'shrink' });
    addPptText(s, 'Work', { x: 3.65, y: 0.95, w: 1.0, h: 0.22, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: hex(v.accent) });
    lines.slice(0, 4).forEach((line, idx) => {
      const x = 3.65 + (idx % 2) * 2.55;
      const y = 1.45 + Math.floor(idx / 2) * 1.05;
      s.addShape('roundRect', { x, y, w: 2.25, h: 0.8, fill: { color: 'FFFFFF', transparency: 18 }, line: { color: 'D8DDF0', transparency: 30 }, rectRadius: 0.08 });
      addPptText(s, line.heading, { x: x + 0.15, y: y + 0.14, w: 1.8, h: 0.18, fontFace: t.fonts.heading, fontSize: 9, bold: true, color: '21264F', fit: 'shrink' });
      addPptText(s, line.body || line.period, { x: x + 0.15, y: y + 0.38, w: 1.85, h: 0.22, fontFace: t.fonts.body, fontSize: 7, color: '6B7395', fit: 'shrink' });
    });
    addPptText(s, 'Tools', { x: 3.65, y: 4.95, w: 1.0, h: 0.22, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: '28327A' });
    ['Figma', 'GA', 'DataGrip', 'Notion', 'Channel', 'Power BI', 'Jira', 'Slack'].forEach((tool, idx) => {
      const x = 3.65 + (idx % 4) * 1.35;
      const y = 5.35 + Math.floor(idx / 4) * 0.7;
      s.addShape('roundRect', { x, y, w: 1.08, h: 0.42, fill: { color: 'FFFFFF', transparency: 20 }, line: { color: 'D8DDF0', transparency: 24 }, rectRadius: 0.06 });
      addPptText(s, tool, { x, y: y + 0.09, w: 1.08, h: 0.12, fontFace: t.fonts.body, fontSize: 6.8, bold: true, color: idx % 2 ? '6B7395' : '28327A', align: 'center', fit: 'shrink' });
    });
    return;
  }

  if (variant === 'projects-3' || variant === 'projects-2') {
    const count = variant === 'projects-3' ? 3 : 2;
    const source = (items.length ? items : lines).slice(0, count);
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
    addPptText(s, variant === 'projects-3' ? 'MAIN PROJECTS' : 'SIDE PROJECTS', { x: 0.72, y: 0.62, w: 2.0, h: 0.22, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(v.accent) });
    addPptText(s, safePptText(slide.title || '프로젝트 요약'), { x: 0.72, y: 0.92, w: 4.0, h: 0.62, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink), fit: 'shrink' });
    source.forEach((entry, idx) => {
      const colW = count === 3 ? 3.3 : 4.8;
      const x = 1.4 + idx * colW;
      if (idx < count - 1) s.addShape('rect', { x: x + colW - 0.25, y: 2.5, w: 0.02, h: 3.0, fill: { color: 'B8BFDC' }, line: { color: 'B8BFDC' } });
      s.addShape('ellipse', { x: x + 0.65, y: 1.95, w: 1.2, h: 1.2, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } });
      s.addShape('ellipse', { x: x + 0.9, y: 2.18, w: 0.7, h: 0.7, fill: { color: '080A10' }, line: { color: '080A10' } });
      addPptText(s, safePptText(entry.heading || entry.role), { x, y: 3.55, w: 2.5, h: 0.38, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: hex(v.ink), align: 'center', fit: 'shrink' });
      addPptText(s, safePptText(entry.body || ''), { x: x + 0.15, y: 4.25, w: 2.2, h: 0.8, fontFace: t.fonts.body, fontSize: 8, color: hex(v.muted), align: 'center', fit: 'shrink' });
    });
    return;
  }

  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(v.bg) }, line: { color: hex(v.bg) } });
  s.addShape('roundRect', { x: 0.72, y: 0.38, w: 0.78, h: 0.18, fill: { color: 'FFFFFF', transparency: 6 }, line: { color: 'FFFFFF', transparency: 100 }, rectRadius: 0.04 });
  addPptText(s, safePptText(slide.title || '케이스 스터디'), { x: 0.72, y: 0.74, w: 4.3, h: 0.62, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(v.ink), fit: 'shrink' });
  s.addShape('roundRect', { x: 0.72, y: 1.8, w: 6.9, h: 4.15, fill: { color: hex(v.card) }, line: { color: 'D8DDF0', transparency: 24 }, rectRadius: 0.16, shadow: { type: 'outer', color: 'B9C0DA', blur: 2, angle: 45, distance: 2, opacity: 0.12 } });
  addPptText(s, '문제정의', { x: 1.1, y: 2.25, w: 1.2, h: 0.22, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: hex(v.ink) });
  addPptText(s, '전략 Strategies/Objectives', { x: 4.05, y: 2.25, w: 2.2, h: 0.22, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: hex(v.ink) });
  s.addShape('rect', { x: 3.7, y: 2.75, w: 0.02, h: 2.35, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
  left.forEach((line, idx) => {
    const y = 3.45 + idx * 1.05;
    s.addShape('roundRect', { x: 1.12, y: y + 0.03, w: 0.12, h: 0.12, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: idx === 0 ? hex(v.muted) : hex(v.soft), width: 2 }, rectRadius: 0.02 });
    addPptText(s, safePptText(line.body || line.heading), { x: 1.42, y, w: 1.9, h: 0.44, fontFace: t.fonts.body, fontSize: 9, bold: true, color: idx === 0 ? hex(v.ink) : hex(v.muted), fit: 'shrink' });
    if (line.heading && line.body && line.heading !== line.body) addPptText(s, safePptText(line.heading), { x: 1.42, y: y + 0.45, w: 1.5, h: 0.16, fontFace: t.fonts.body, fontSize: 7, bold: true, color: hex(v.ink), fit: 'shrink' });
  });
  right.forEach((line, idx) => {
    const y = 3.38 + idx * 0.95;
    addPptText(s, '›', { x: 4.05, y, w: 0.12, h: 0.18, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: hex(v.ink) });
    addPptText(s, safePptText(line.heading || line.body), { x: 4.28, y, w: 2.05, h: 0.26, fontFace: t.fonts.body, fontSize: 8.5, bold: true, color: hex(v.ink), fit: 'shrink' });
    if (line.body && line.body !== line.heading) {
      s.addShape('rect', { x: 4.28, y: y + 0.32, w: 0.02, h: 0.34, fill: { color: hex(v.soft) }, line: { color: hex(v.soft) } });
      addPptText(s, safePptText(line.body), { x: 4.42, y: y + 0.28, w: 1.82, h: 0.32, fontFace: t.fonts.body, fontSize: 7.3, color: hex(v.muted), fit: 'shrink' });
    }
  });
  const panel = (title, captions, x, y, w, h, tall = false) => {
    s.addShape('roundRect', { x, y, w, h, fill: { color: 'FCFCFF', transparency: 4 }, line: { color: 'D8DDF0', transparency: 18 }, rectRadius: 0.14, shadow: { type: 'outer', color: 'B9C0DA', blur: 2, angle: 45, distance: 2, opacity: 0.12 } });
    addPptText(s, safePptText(title), { x: x + 0.12, y: y + 0.12, w: w - 0.24, h: 0.18, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: hex(v.ink), align: 'center', fit: 'shrink' });
    const cols = tall ? Math.min(2, Math.max(1, captions.length)) : Math.min(3, Math.max(1, captions.length));
    captions.forEach((caption, idx) => {
      const cw = tall ? 1.35 : 0.92;
      const sx = x + 0.18 + idx * (cw + 0.16);
      const sy = y + 0.48;
      s.addShape('roundRect', { x: sx, y: sy, w: cw, h: tall ? 0.86 : 1.02, fill: { color: idx % 3 === 0 ? 'F3EDFF' : idx % 3 === 1 ? 'FFF5E8' : 'F4F7FF' }, line: { color: 'D6DDF1', transparency: 8 }, rectRadius: 0.1 });
      s.addShape('roundRect', { x: sx + 0.08, y: sy + 0.08, w: cw - 0.16, h: tall ? 0.62 : 0.78, fill: { color: idx % 3 === 0 ? 'E5EBFF' : idx % 3 === 1 ? 'F8FAFF' : 'EFF3FF' }, line: { color: idx % 2 ? 'E8ECF8' : 'D8E6FF', transparency: 8 }, rectRadius: 0.08 });
      addPptText(s, safePptText(caption), { x: sx, y: sy + (tall ? 0.9 : 1.06), w: cw, h: 0.12, fontFace: t.fonts.body, fontSize: 6.5, color: hex(v.muted), align: 'center', fit: 'shrink' });
    });
  };

  if (variant === 'split-image' || variant === 'split-large-image') {
    panel('프로젝트 화면', [lines[0]?.heading || '화면'], 8.0, 1.8, 4.1, 4.15, true);
    return;
  }
  panel(
    variant === 'result-guide' ? '글로벌 가이드 페이지' : variant === 'result-dashboard' ? '기능 / 이벤트 / 캘린더' : '예시 화면',
    (variant === 'result-guide' ? ['가이드', '현지화'] : variant === 'result-dashboard' ? ['기능', '이벤트', '캘린더'] : lines.slice(0, 3).map(line => line.heading || '화면')),
    8.0, 1.8, 4.1, 2.1, variant !== 'result-dashboard'
  );
  if (variant === 'result-customer' || variant === 'result-chart') {
    s.addShape('roundRect', { x: 8.0, y: 4.2, w: 4.1, h: 1.75, fill: { color: 'FCFCFF', transparency: 4 }, line: { color: 'D8DDF0', transparency: 18 }, rectRadius: 0.14, shadow: { type: 'outer', color: 'B9C0DA', blur: 2, angle: 45, distance: 2, opacity: 0.12 } });
    [
      { metric: metrics[0] || { value: '300%', label: '리소스 효율' }, color: '2B90FF', x: 8.32 },
      { metric: metrics[1] || { value: '97.8%', label: '동일 건 감소' }, color: '4A4FCA', x: 10.08 },
    ].forEach(({ metric, color, x }) => {
      s.addShape('ellipse', { x, y: 4.62, w: 0.54, h: 0.54, fill: { color, transparency: 10 }, line: { color, transparency: 100 } });
      addPptText(s, pptAcceptedMetricText(metric), { x: x + 0.62, y: 4.62, w: 1.0, h: 0.18, fontFace: t.fonts.heading, fontSize: 11, bold: true, color, fit: 'shrink' });
      addPptText(s, safePptText(metric.label), { x: x + 0.62, y: 4.9, w: 1.2, h: 0.2, fontFace: t.fonts.body, fontSize: 6.6, bold: true, color: hex(v.ink), fit: 'shrink' });
    });
    return;
  }
  if (variant === 'result-table') {
    s.addShape('roundRect', { x: 8.0, y: 4.2, w: 4.1, h: 1.75, fill: { color: 'FCFCFF', transparency: 4 }, line: { color: 'D8DDF0', transparency: 18 }, rectRadius: 0.14 });
    ['AA', '기업명', 'BB'].forEach((h, idx) => addPptText(s, h, { x: 8.24 + idx * 1.25, y: 4.44, w: 0.9, h: 0.14, fontFace: t.fonts.heading, fontSize: 7, bold: true, color: hex(v.ink), align: 'center' }));
    ['국가', '인력', '비교'].forEach((row, ridx) => {
      const y = 4.74 + ridx * 0.34;
      addPptText(s, ridx === 0 ? '해외' : ridx === 1 ? '3' : '0.9', { x: 8.24, y, w: 0.9, h: 0.12, fontFace: t.fonts.body, fontSize: 6.6, color: hex(v.muted), align: 'center' });
      addPptText(s, row, { x: 9.49, y, w: 0.9, h: 0.12, fontFace: t.fonts.body, fontSize: 6.6, color: hex(v.muted), align: 'center' });
      addPptText(s, ridx === 0 ? '서울, 부산' : ridx === 1 ? '유' : '비', { x: 10.74, y, w: 0.9, h: 0.12, fontFace: t.fonts.body, fontSize: 6.6, color: hex(v.muted), align: 'center' });
    });
    return;
  }
  s.addShape('roundRect', { x: 8.0, y: 4.2, w: 4.1, h: 1.75, fill: { color: 'FCFCFF', transparency: 4 }, line: { color: 'D8DDF0', transparency: 18 }, rectRadius: 0.14, shadow: { type: 'outer', color: 'B9C0DA', blur: 2, angle: 45, distance: 2, opacity: 0.12 } });
  [
    { metric: metrics[0] || { value: '5→25명', label: '팀 증원' }, color: '2B90FF', x: 8.32 },
    { metric: metrics[1] || { value: 'KR to Global', label: '선례 확산' }, color: '4A4FCA', x: 10.08 },
  ].forEach(({ metric, color, x }) => {
    s.addShape('ellipse', { x, y: 4.62, w: 0.54, h: 0.54, fill: { color, transparency: 10 }, line: { color, transparency: 100 } });
    addPptText(s, pptAcceptedMetricText(metric), { x: x + 0.62, y: 4.62, w: 1.0, h: 0.18, fontFace: t.fonts.heading, fontSize: 11, bold: true, color, fit: 'shrink' });
    addPptText(s, safePptText(metric.label), { x: x + 0.62, y: 4.9, w: 1.2, h: 0.2, fontFace: t.fonts.body, fontSize: 6.6, bold: true, color: hex(v.ink), fit: 'shrink' });
  });
}

function drawProposal(s, slide, t, i, W, H) {
  const c = t.colors;
  const isDark = slide.dark || slide.layout === 'closing' || (slide.layout === 'experience' && slide.layout_type === 'CENTER_METRIC');
  const bg = isDark ? c.dark : c.bg;
  const accentColor = pptVisibleOn(bg, c.accent, isDark ? SAFE_TEXT_LIGHT : c.dark);
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: isDark ? hex(c.dark) : hex(c.bg) }, line: { color: isDark ? hex(c.dark) : hex(c.bg) } });
  if (isDark) drawProposalDots(s, accentColor, W, 9.4, 0.9);
  drawProposalHeader(s, slide, t, i, W, isDark);
  const x = 0.72, y = 2.7, w = W - 1.44, h = H - 3.2;
  if (drawProposalVariantPptx(s, slide, t, x, y, w, h, isDark)) {
    // variant 전용 렌더러에서 처리됨
  } else if (slide.layout === 'experience') {
    drawProposalExperience(s, slide, t, x, y, w, h, isDark);
  } else if (Array.isArray(slide.table) && slide.table.length) {
    drawProposalTablePptx(s, slide.table, t, x, y, w, h);
  } else if (Array.isArray(slide.metrics) && slide.metrics.length) {
    drawProposalMetricsPptx(s, slide.metrics, t, x, y, w, h, isDark);
  } else if ((slide.items || []).length) {
    drawProposalItemCards(s, slide.items.slice(0, 3), t, x, y, w, h, isDark);
  } else {
    drawProposalBulletCards(s, (slide.bullets || []).slice(0, 6), t, x, y, w, h, isDark);
  }
  s.addText(String(i + 1).padStart(2, '0'), { x: W - 0.9, y: H - 0.45, w: 0.4, h: 0.18, fontFace: t.fonts.body, fontSize: 7, color: isDark ? '777777' : hex(c.muted), align: 'right' });
}

function drawProposalVariantPptx(s, slide, t, x, y, w, h, isDark) {
  const variant = slide.proposalVariant || '';
  if (!variant || slide.layout === 'experience') return false;
  const c = t.colors;
  const pageBg = isDark ? c.dark : c.bg;
  const pageText = pptTextOn(pageBg, isDark ? SAFE_TEXT_LIGHT : c.sub);
  const pageMuted = pptMutedOn(pageBg, isDark ? SAFE_MUTED_LIGHT : c.muted);
  const accentOnPage = pptVisibleOn(pageBg, c.accent, isDark ? SAFE_TEXT_LIGHT : c.dark);
  const items = normalizePptItems(slide.items || []);
  const bullets = normalizePptLines(slide.bullets || []);

  if (variant === 'contents') {
    const count = Math.max(1, items.length);
    const colW = w / count;
    s.addShape('rect', { x, y: y + h - 1.05, w, h: 0.02, fill: { color: hex(c.neutral || c.line), transparency: 45 }, line: { color: hex(c.neutral || c.line), transparency: 100 } });
    items.forEach((item, idx) => {
      const cx = x + idx * colW + 0.08;
      addPptText(s, String(idx + 1).padStart(2, '0'), { x: cx, y: y + h - 2.45, w: colW - 0.16, h: 0.25, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: accentOnPage });
      addPptText(s, item.heading, { x: cx, y: y + h - 2.08, w: colW - 0.16, h: 0.7, fontFace: t.fonts.heading, fontSize: dynamicFontPt(item.heading, 19, { min: 12, max: 20 }), bold: true, color: pageText, fit: 'shrink' });
      addPptText(s, item.role, { x: cx, y: y + h - 1.24, w: colW - 0.16, h: 0.25, fontFace: t.fonts.body, fontSize: 8, color: pageMuted, fit: 'shrink' });
      s.addShape('ellipse', { x: cx, y: y + h - 1.14, w: 0.1, h: 0.1, fill: { color: accentOnPage }, line: { color: accentOnPage } });
      addPptText(s, item.body, { x: cx, y: y + h - 0.72, w: colW - 0.16, h: 0.42, fontFace: t.fonts.body, fontSize: 8, color: pageMuted, fit: 'shrink' });
    });
    return true;
  }

  if (variant === 'threeCards') {
    drawThreeCardsPptx(s, items.slice(0, 3), t, x, y, w, h, isDark);
    return true;
  }

  if (variant === 'splitPhotoList') {
    s.addShape('roundRect', { x, y: y + 0.25, w: w * 0.4, h: h - 0.5, fill: { color: hex(c.dark), transparency: 10 }, line: { color: hex(c.dark), transparency: 100 }, rectRadius: 0.16 });
    drawListWithBadges(s, items.slice(0, 4), t, x + w * 0.46, y + 0.25, w * 0.5, h - 0.5);
    return true;
  }

  if (variant === 'timeline') {
    const visible = items.slice(0, 5);
    const gap = visible.length > 1 ? w / (visible.length - 1) : 0;
    visible.forEach((item, idx) => {
      const cx = visible.length > 1 ? x + idx * gap : x + w / 2;
      if (idx < visible.length - 1) s.addShape('rect', { x: cx + 0.45, y: y + 1.35, w: gap - 0.9, h: 0.02, fill: { color: hex(c.muted), transparency: 45 }, line: { color: hex(c.muted), transparency: 100 } });
      s.addShape('ellipse', { x: cx - 0.42, y: y + 0.78, w: 0.84, h: 0.84, fill: { color: hex(idx % 2 ? c.dark : c.neutral) }, line: { color: idx === 1 ? accentOnPage : 'FFFFFF', width: 2 } });
      addPptText(s, item.period || `STEP ${idx + 1}`, { x: cx - 0.72, y: y + 1.82, w: 1.44, h: 0.24, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: accentOnPage, align: 'center', fit: 'shrink' });
      addPptText(s, item.heading, { x: cx - 0.82, y: y + 2.12, w: 1.64, h: 0.45, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: pageText, align: 'center', fit: 'shrink' });
      addPptText(s, item.body, { x: cx - 0.82, y: y + 2.62, w: 1.64, h: 0.58, fontFace: t.fonts.body, fontSize: 7, color: pageMuted, align: 'center', fit: 'shrink' });
    });
    return true;
  }

  if (variant === 'darkStats') {
    drawProposalMetricsPptx(s, slide.metrics || items.flatMap(item => item.metrics || []).slice(0, 4), t, x, y, w, h, true);
    return true;
  }

  if (variant === 'bubbleCore' || variant === 'targetCircle' || variant === 'orbit' || variant === 'promise') {
    drawCircleDiagramPptx(s, items, bullets, t, x, y, w, h, variant);
    return true;
  }

  if (variant === 'comparison') {
    drawComparisonPptx(s, items.slice(0, 2), t, x, y, w, h);
    return true;
  }

  if (variant === 'metricBars') {
    drawMetricBarsPptx(s, bullets, t, x, y, w, h);
    return true;
  }

  if (variant === 'graphCallout') {
    drawGraphCalloutPptx(s, bullets, t, x, y, w, h);
    return true;
  }

  if (variant === 'synergy') {
    drawSynergyPptx(s, items, t, x, y, w, h);
    return true;
  }

  if (variant === 'venn') {
    drawVennPptx(s, items, t, x, y, w, h, true);
    return true;
  }

  if (variant === 'stairSteps') {
    drawStairsPptx(s, items, t, x, y, w, h);
    return true;
  }

  if (variant === 'roleTable') {
    drawProposalTablePptx(s, slide.table || [], t, x, y, w, h);
    return true;
  }

  if (variant === 'caseGrid') {
    drawCaseGridPptx(s, items, t, x, y, w, h, isDark);
    return true;
  }

  if (variant === 'testimonial') {
    drawTestimonialsPptx(s, bullets, t, x, y, w, h);
    return true;
  }

  if (variant === 'conditionGrid' || variant === 'faqCards' || variant === 'stageCards') {
    drawConditionGridPptx(s, items, t, x, y, w, h, variant === 'stageCards');
    return true;
  }

  if (variant === 'criteria') {
    drawCriteriaPptx(s, items, t, x, y, w, h);
    return true;
  }

  if (variant === 'gantt') {
    drawGanttPptx(s, items, t, x, y, w, h);
    return true;
  }

  if (variant === 'pyramid') {
    drawPyramidPptx(s, items, t, x, y, w, h);
    return true;
  }

  if (variant === 'budget') {
    drawBudgetPptx(s, items, t, x, y, w, h);
    return true;
  }

  if (variant === 'risk') {
    drawRiskPptx(s, items, t, x, y, w, h);
    return true;
  }

  if (variant === 'closing') {
    addPptText(s, bullets.join(' · '), { x: x + 1.2, y: y + 1.3, w: w - 2.4, h: 1.1, fontFace: t.fonts.heading, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fit: 'shrink' });
    return true;
  }

  return false;
}

function drawListWithBadges(s, items, t, x, y, w, h) {
  const c = t.colors;
  const rowH = h / Math.max(1, items.length);
  items.forEach((item, idx) => {
    const cy = y + idx * rowH + 0.05;
    const active = idx === items.length - 1;
    s.addShape('ellipse', { x, y: cy + 0.08, w: 0.55, h: 0.55, fill: { color: hex(active ? c.accent : c.dark) }, line: { color: hex(active ? c.accent : c.dark) } });
    addPptText(s, String(idx + 1), { x, y: cy + 0.19, w: 0.55, h: 0.2, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center' });
    addPptText(s, item.heading, { x: x + 0.75, y: cy, w: w - 0.75, h: 0.28, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: hex(c.sub), fit: 'shrink' });
    addPptText(s, item.body, { x: x + 0.75, y: cy + 0.32, w: w - 0.75, h: 0.42, fontFace: t.fonts.body, fontSize: 8, color: hex(c.muted), fit: 'shrink' });
  });
}

function drawThreeCardsPptx(s, items, t, x, y, w, h, isDark) {
  const c = t.colors;
  const visible = items.slice(0, 3);
  const cardW = (w - 0.26 * (visible.length - 1)) / Math.max(1, visible.length);
  visible.forEach((item, idx) => {
    const featured = idx === visible.length - 1;
    const fill = featured ? c.accent : (isDark ? c.dark2 : c.card);
    const fg = pptTextOn(fill, featured || isDark ? SAFE_TEXT_LIGHT : c.sub);
    const muted = pptMutedOn(fill, featured || isDark ? SAFE_MUTED_LIGHT : c.muted);
    const cx = x + idx * (cardW + 0.26);
    s.addShape('roundRect', { x: cx, y, w: cardW, h, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.1 });
    s.addShape('ellipse', { x: cx + 0.28, y: y + 0.28, w: 0.34, h: 0.34, fill: { color: featured ? 'FFFFFF' : hex(c.line), transparency: featured ? 78 : 0 }, line: { color: featured ? 'FFFFFF' : hex(c.line), transparency: featured ? 100 : 0 } });
    addPptText(s, String(idx + 1).padStart(2, '0'), { x: cx + 0.28, y: y + 0.36, w: 0.34, h: 0.1, fontFace: t.fonts.heading, fontSize: 6.5, bold: true, color: fg, align: 'center', fit: 'shrink' });
    s.addShape('rect', { x: cx + 0.78, y: y + 0.44, w: cardW - 1.08, h: 0.02, fill: { color: featured ? fg : hex(c.line), transparency: featured ? 70 : 0 }, line: { color: featured ? fg : hex(c.line), transparency: 100 } });
    addPptText(s, item.heading, { x: cx + 0.28, y: y + h - 1.42, w: cardW - 0.56, h: 0.42, fontFace: t.fonts.heading, fontSize: 12.5, bold: true, color: fg, fit: 'shrink' });
    addPptText(s, item.body, { x: cx + 0.28, y: y + h - 0.88, w: cardW - 0.56, h: 0.52, fontFace: t.fonts.body, fontSize: 8, color: muted, fit: 'shrink' });
    s.addShape('roundRect', { x: cx + 0.28, y: y + h - 0.22, w: cardW * 0.34, h: 0.05, fill: { color: featured ? fg : pptVisibleOn(fill, c.accent, c.dark), transparency: featured ? 55 : 0 }, line: { color: featured ? fg : pptVisibleOn(fill, c.accent, c.dark), transparency: 100 }, rectRadius: 0.03 });
  });
}

function drawComparisonPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const cardW = (w - 0.35) / 2;
  items.forEach((item, idx) => {
    const cx = x + idx * (cardW + 0.35);
    s.addShape('roundRect', { x: cx, y: y + 0.45, w: cardW, h: h - 0.9, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.14 });
    s.addShape('rect', { x: cx, y: y + 0.45, w: cardW * 0.45, h: h - 0.9, fill: { color: hex(idx ? c.dark : c.neutral) }, line: { color: hex(idx ? c.dark : c.neutral) } });
    s.addShape('roundRect', { x: cx + cardW * 0.52, y: y + 1.0, w: cardW * 0.36, h: 0.35, fill: { color: hex(idx ? c.dark : c.accent) }, line: { color: hex(idx ? c.dark : c.accent) }, rectRadius: 0.16 });
    addPptText(s, item.heading, { x: cx + cardW * 0.52, y: y + 1.08, w: cardW * 0.36, h: 0.14, fontFace: t.fonts.heading, fontSize: 8, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink' });
    addPptText(s, item.body, { x: cx + cardW * 0.52, y: y + 1.62, w: cardW * 0.38, h: h - 2.2, fontFace: t.fonts.body, fontSize: 9, color: hex(c.muted), align: 'center', fit: 'shrink' });
  });
}

function drawMetricBarsPptx(s, bullets, t, x, y, w, h) {
  const c = t.colors;
  const leftW = w * 0.4;
  bullets.slice(0, 2).forEach((bullet, idx) => {
    const cy = y + idx * ((h - 0.25) / 2 + 0.25);
    const fill = idx ? c.dark : c.accent;
    s.addShape('roundRect', { x, y: cy, w: leftW, h: (h - 0.25) / 2, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.1 });
    const fillText = pptTextOn(fill, SAFE_TEXT_LIGHT);
    addPptText(s, idx ? '비즈니스 측면' : '외부환경 측면', { x: x + 0.25, y: cy + 0.25, w: leftW - 0.5, h: 0.28, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: fillText, fit: 'shrink' });
    addPptText(s, bullet, { x: x + 0.25, y: cy + 0.72, w: leftW - 0.5, h: 0.7, fontFace: t.fonts.body, fontSize: 8, color: fillText, fit: 'shrink' });
  });
  const values = ['80%', '50%', '50%', '70%'];
  const gridX = x + leftW + 0.35;
  const accentOnCard = pptVisibleOn('#FFFFFF', c.accent, c.dark);
  const darkOnCard = pptVisibleOn('#FFFFFF', c.dark, SAFE_DARK);
  s.addShape('roundRect', { x: gridX, y, w: w - leftW - 0.35, h, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.12 });
  values.forEach((value, idx) => {
    const cellW = (w - leftW - 0.75) / 2;
    const cx = gridX + 0.22 + (idx % 2) * (cellW + 0.18);
    const cy = y + 0.35 + Math.floor(idx / 2) * ((h - 0.75) / 2);
    addPptText(s, value, { x: cx, y: cy, w: cellW, h: 0.45, fontFace: t.fonts.heading, fontSize: 23, bold: false, color: idx < 2 ? accentOnCard : darkOnCard, fit: 'shrink' });
    s.addShape('roundRect', { x: cx, y: cy + 0.55, w: cellW, h: 0.1, fill: { color: hex(c.line) }, line: { color: hex(c.line) }, rectRadius: 0.05 });
    s.addShape('roundRect', { x: cx, y: cy + 0.55, w: cellW * (parseInt(value, 10) / 100), h: 0.1, fill: { color: idx < 2 ? accentOnCard : darkOnCard }, line: { color: idx < 2 ? accentOnCard : darkOnCard }, rectRadius: 0.05 });
    addPptText(s, bullets[idx] || '성과 지표', { x: cx, y: cy + 0.78, w: cellW, h: 0.38, fontFace: t.fonts.body, fontSize: 7, color: pptMutedOn('#FFFFFF', c.muted), fit: 'shrink' });
  });
}

function drawGraphCalloutPptx(s, bullets, t, x, y, w, h) {
  const c = t.colors;
  const leftW = w * 0.34;
  const accentText = pptTextOn(c.accent, SAFE_TEXT_LIGHT);
  const graphInk = pptVisibleOn('#FFFFFF', c.dark, SAFE_DARK);
  const graphMuted = pptVisibleOn('#FFFFFF', c.neutral, c.dark);
  const graphAccent = pptVisibleOn('#FFFFFF', c.accent, c.dark);
  s.addShape('roundRect', { x, y: y + 0.45, w: leftW, h: h - 0.9, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) }, rectRadius: 0.12 });
  addPptText(s, '경험 기반 전략', { x: x + 0.25, y: y + 0.85, w: leftW - 0.5, h: 0.32, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: accentText, fit: 'shrink' });
  addPptText(s, bullets[0] || '경험정리를 바탕으로 직무 적합성을 선명하게 제시합니다.', { x: x + 0.25, y: y + 1.35, w: leftW - 0.5, h: 1.2, fontFace: t.fonts.body, fontSize: 9, color: accentText, fit: 'shrink' });
  const gx = x + leftW + 0.55;
  const gw = w - leftW - 0.7;
  s.addShape('rect', { x: gx, y: y + h - 0.45, w: gw, h: 0.03, fill: { color: graphInk }, line: { color: graphInk } });
  [0, 1, 2, 3, 4].forEach((_, idx) => {
    const barH = 0.65 + idx * 0.38;
    const bx = gx + 0.35 + idx * (gw - 1.2) / 4;
    s.addShape('rect', { x: bx, y: y + h - 0.45 - barH, w: 0.42, h: barH, fill: { color: idx > 1 ? graphInk : graphMuted }, line: { color: idx > 1 ? graphInk : graphMuted } });
    if (idx > 0) {
      const px = gx + 0.56 + (idx - 1) * (gw - 1.2) / 4;
      const py = y + h - 0.75 - (idx - 1) * 0.45;
      const nx = gx + 0.56 + idx * (gw - 1.2) / 4;
      const ny = y + h - 0.75 - idx * 0.45;
      s.addShape('line', { x: px, y: py, w: nx - px, h: ny - py, line: { color: graphAccent, width: 2 } });
    }
    s.addShape('ellipse', { x: bx + 0.13, y: y + h - 0.84 - idx * 0.45, w: 0.14, h: 0.14, fill: { color: 'FFFFFF' }, line: { color: graphAccent, width: 1.5 } });
  });
}

function drawVennPptx(s, items, t, x, y, w, h, withText) {
  const c = t.colors;
  const cardText = pptTextOn('#FFFFFF', c.sub);
  const cardMuted = pptMutedOn('#FFFFFF', c.muted);
  const accentText = pptTextOn(c.accent, SAFE_TEXT_LIGHT);
  if (!withText) {
    items.slice(0, 4).forEach((item, idx) => {
      drawMiniCircle(s, item.heading, t, x + idx * (w / 4) + 0.25, y + h - 1.15, 0.9, idx === 0 ? c.accent : idx === 3 ? c.dark : 'FFFFFF', idx === 0 || idx === 3 ? 'FFFFFF' : hex(c.sub));
    });
    return;
  }
  const sideW = w * 0.26;
  const centerW = w - sideW * 2 - 0.5;
  const centerX = x + sideW + 0.25;
  [0, 1].forEach((idx) => {
    const cx = idx === 0 ? x : x + w - sideW;
    s.addShape('roundRect', { x: cx, y: y + 0.32, w: sideW, h: h - 1.12, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.1 });
    s.addShape('roundRect', { x: cx + 0.18, y: y + 0.55, w: sideW - 0.36, h: 0.3, fill: { color: hex(c.dark) }, line: { color: hex(c.dark) }, rectRadius: 0.12 });
    addPptText(s, items[idx]?.heading || (idx === 0 ? '후보자 강점' : '기업 니즈'), { x: cx + 0.22, y: y + 0.62, w: sideW - 0.44, h: 0.1, fontFace: t.fonts.heading, fontSize: 6.8, bold: true, color: pptTextOn(c.dark, SAFE_TEXT_LIGHT), align: 'center', fit: 'shrink' });
    addPptText(s, items[idx]?.body || '', { x: cx + 0.22, y: y + 1.02, w: sideW - 0.44, h: h - 1.95, fontFace: t.fonts.body, fontSize: 7.2, color: cardMuted, align: 'center', fit: 'shrink' });
  });
  s.addShape('ellipse', { x: centerX + centerW * 0.12, y: y + 0.35, w: 1.55, h: 1.55, fill: { color: 'FFFFFF' }, line: { color: hex(c.line), transparency: 25 } });
  s.addShape('ellipse', { x: centerX + centerW * 0.5 - 0.15, y: y + 0.35, w: 1.55, h: 1.55, fill: { color: 'FFFFFF' }, line: { color: hex(c.line), transparency: 25 } });
  s.addShape('roundRect', { x: centerX + centerW * 0.5 - 0.4, y: y + 1.03, w: 0.95, h: 0.36, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) }, rectRadius: 0.16 });
  addPptText(s, '교집합', { x: centerX + centerW * 0.5 - 0.36, y: y + 1.14, w: 0.87, h: 0.08, fontFace: t.fonts.heading, fontSize: 6.6, bold: true, color: accentText, align: 'center', fit: 'shrink' });
  addPptText(s, items[0]?.heading || '후보자 강점', { x: centerX + centerW * 0.12 + 0.2, y: y + 0.88, w: 1.15, h: 0.26, fontFace: t.fonts.heading, fontSize: 7.8, bold: true, color: cardText, align: 'center', fit: 'shrink' });
  addPptText(s, items[1]?.heading || '기업 니즈', { x: centerX + centerW * 0.5 + 0.05, y: y + 0.88, w: 1.15, h: 0.26, fontFace: t.fonts.heading, fontSize: 7.8, bold: true, color: cardText, align: 'center', fit: 'shrink' });
  addPptText(s, items[2]?.body || '강점과 요구사항이 만나는 지점에서 실행 가능한 해답을 제시합니다', { x: x + 1.1, y: y + h - 0.58, w: w - 2.2, h: 0.36, fontFace: t.fonts.heading, fontSize: 9.3, bold: true, color: accentText, align: 'center', valign: 'middle', fit: 'shrink', fill: c.accent });
}

function drawSynergyPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const visible = items.slice(0, 4);
  const gap = w / Math.max(1, visible.length);
  visible.forEach((item, idx) => {
    const size = idx === 0 || idx === visible.length - 1 ? 1.35 : 1.6;
    const cx = x + idx * gap + gap / 2 - size / 2;
    const cy = y + h / 2 - size / 2;
    const fill = idx === 0 ? c.accent : idx === visible.length - 1 ? c.dark : '#FFFFFF';
    const fg = pptTextOn(fill, idx === 0 || idx === visible.length - 1 ? SAFE_TEXT_LIGHT : c.sub);
    if (idx > 0) s.addShape('rect', { x: cx - gap + size + 0.1, y: y + h / 2 - 0.01, w: gap - size - 0.2, h: 0.02, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
    s.addShape('ellipse', { x: cx, y: cy, w: size, h: size, fill: { color: hex(fill) }, line: { color: hex(fill) } });
    addPptText(s, item.heading, { x: cx + 0.12, y: cy + size * 0.34, w: size - 0.24, h: size * 0.32, fontFace: t.fonts.heading, fontSize: 8, bold: true, color: fg, align: 'center', fit: 'shrink' });
  });
}

function drawCircleDiagramPptx(s, items, bullets, t, x, y, w, h, variant) {
  const c = t.colors;
  const left = variant === 'promise';
  const circleX = left ? x : x + w * 0.52;
  const textX = left ? x + w * 0.48 : x;
  const textW = w * 0.44;
  const centerY = y + h * 0.45;
  s.addShape('ellipse', { x: circleX + 0.35, y: centerY - 1.35, w: 2.7, h: 2.7, fill: { color: hex(c.line), transparency: 12 }, line: { color: hex(c.line), transparency: 100 } });
  s.addShape('ellipse', { x: circleX + 0.85, y: centerY - 0.95, w: 1.9, h: 1.9, fill: { color: hex(c.neutral) }, line: { color: hex(c.neutral) } });
  s.addShape('ellipse', { x: circleX + 2.1, y: centerY - 1.35, w: 1.05, h: 1.05, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
  addPptText(s, variant === 'promise' ? '키워드' : items[1]?.heading || '공동 목표', { x: circleX + 2.1, y: centerY - 1.02, w: 1.05, h: 0.25, fontFace: t.fonts.heading, fontSize: 9, bold: true, color: pptTextOn(c.accent, SAFE_TEXT_LIGHT), align: 'center', fit: 'shrink' });
  const lines = (items.length ? items.map(item => item.heading || item.body) : bullets).slice(0, 3);
  lines.forEach((line, idx) => {
    addPptText(s, line, { x: textX, y: y + 0.55 + idx * 0.95, w: textW, h: 0.3, fontFace: t.fonts.heading, fontSize: 13, bold: true, color: pptTextOn(c.bg, c.sub), fit: 'shrink' });
    addPptText(s, items[idx]?.body || '경험 기반 수행을 통해 안정적인 결과를 지원합니다.', { x: textX, y: y + 0.9 + idx * 0.95, w: textW, h: 0.35, fontFace: t.fonts.body, fontSize: 8, color: pptMutedOn(c.bg, c.muted), fit: 'shrink' });
  });
}

function drawStairsPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const visible = items.slice(0, 5);
  const stepW = (w - 0.14 * (visible.length - 1)) / Math.max(1, visible.length);
  visible.forEach((item, idx) => {
    const stepH = 1.18 + idx * 0.27;
    const cx = x + idx * (stepW + 0.14);
    const cy = y + h - stepH;
    const fill = idx === visible.length - 1 ? c.accent : idx < 2 ? c.neutral : c.dark;
    s.addShape('roundRect', { x: cx, y: cy, w: stepW, h: stepH, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.08 });
    const fillText = pptTextOn(fill, SAFE_TEXT_LIGHT);
    s.addShape('ellipse', { x: cx + 0.18, y: cy + 0.18, w: 0.32, h: 0.32, fill: { color: 'FFFFFF', transparency: 78 }, line: { color: 'FFFFFF', transparency: 100 } });
    addPptText(s, String(idx + 1).padStart(2, '0'), { x: cx + 0.18, y: cy + 0.26, w: 0.32, h: 0.08, fontFace: t.fonts.heading, fontSize: 6.4, bold: true, color: fillText, align: 'center', fit: 'shrink' });
    addPptText(s, item.heading, { x: cx + 0.18, y: cy + 0.62, w: stepW - 0.36, h: 0.36, fontFace: t.fonts.heading, fontSize: 8.8, bold: true, color: fillText, fit: 'shrink' });
    addPptText(s, item.body, { x: cx + 0.18, y: cy + 1.02, w: stepW - 0.36, h: stepH - 1.14, fontFace: t.fonts.body, fontSize: 6.4, color: fillText, fit: 'shrink' });
  });
}

function drawCaseGridPptx(s, items, t, x, y, w, h, isDark) {
  const c = t.colors;
  addPptText(s, items[0]?.body || '', { x, y: y + 0.65, w: w * 0.35, h: h - 1.3, fontFace: t.fonts.body, fontSize: 12, color: isDark ? pptTextOn(c.dark, SAFE_TEXT_LIGHT) : pptTextOn(c.bg, c.sub), fit: 'shrink' });
  const gridX = x + w * 0.4;
  const cellW = (w * 0.6 - 0.18) / 2;
  const cellH = (h - 0.18) / 2;
  items.slice(0, 4).forEach((item, idx) => {
    const cx = gridX + (idx % 2) * (cellW + 0.18);
    const cy = y + Math.floor(idx / 2) * (cellH + 0.18);
    const fill = idx === 2 ? c.accent : idx === 0 ? '#FFFFFF' : c.dark2;
    const fg = pptTextOn(fill, idx === 0 ? c.sub : SAFE_TEXT_LIGHT);
    s.addShape('roundRect', { x: cx, y: cy, w: cellW, h: cellH, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.08 });
    addPptText(s, item.heading, { x: cx + 0.22, y: cy + 0.25, w: cellW - 0.44, h: 0.32, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: fg, fit: 'shrink' });
    addPptText(s, item.body, { x: cx + 0.22, y: cy + 0.7, w: cellW - 0.44, h: cellH - 0.9, fontFace: t.fonts.body, fontSize: 8, color: fg, fit: 'shrink' });
  });
}

function drawTestimonialsPptx(s, bullets, t, x, y, w, h) {
  const c = t.colors;
  const visible = bullets.slice(0, 3);
  const cardW = (w - 0.34) / Math.max(1, visible.length);
  visible.forEach((bullet, idx) => {
    const cx = x + idx * (cardW + 0.17);
    s.addShape('roundRect', { x: cx, y: y + 0.35, w: cardW, h: h - 0.7, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.1 });
    const badgeFill = idx === 0 ? c.accent : c.dark;
    s.addShape('roundRect', { x: cx + 0.35, y: y + 0.72, w: 1.0, h: 0.24, fill: { color: hex(badgeFill) }, line: { color: hex(badgeFill) }, rectRadius: 0.1 });
    addPptText(s, idx === 0 ? 'SURVEY' : `INTERVIEW ${idx}`, { x: cx + 0.35, y: y + 0.76, w: 1.0, h: 0.1, fontFace: t.fonts.heading, fontSize: 6, bold: true, color: pptTextOn(badgeFill, SAFE_TEXT_LIGHT), align: 'center' });
    s.addShape('ellipse', { x: cx + cardW / 2 - 0.35, y: y + 1.35, w: 0.7, h: 0.7, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
    addPptText(s, `#${bullet}`, { x: cx + 0.25, y: y + 2.25, w: cardW - 0.5, h: 0.35, fontFace: t.fonts.heading, fontSize: 9, bold: true, color: pptVisibleOn('#FFFFFF', c.accent, c.dark), align: 'center', fit: 'shrink' });
    addPptText(s, '경험 정리 기반으로 확인된 주요 강점입니다.', { x: cx + 0.25, y: y + 2.75, w: cardW - 0.5, h: 0.58, fontFace: t.fonts.body, fontSize: 8, color: pptMutedOn('#FFFFFF', c.muted), align: 'center', fit: 'shrink' });
  });
}

function drawConditionGridPptx(s, items, t, x, y, w, h, stageStyle = false) {
  const c = t.colors;
  const visible = items.slice(0, stageStyle ? 5 : 4);
  const cardW = (w - 0.12 * (visible.length - 1)) / Math.max(1, visible.length);
  visible.forEach((item, idx) => {
    const cx = x + idx * (cardW + 0.12);
    const fill = stageStyle ? (idx === visible.length - 1 ? c.accent : idx < 2 ? c.neutral : c.dark) : '#FFFFFF';
    s.addShape('roundRect', { x: cx, y: stageStyle ? y + 0.45 : y, w: cardW, h: stageStyle ? h - 0.9 : h, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.08 });
    if (!stageStyle) s.addShape('rect', { x: cx, y, w: cardW, h: h * 0.48, fill: { color: hex(idx === 0 || idx === 3 ? c.accent : idx === 1 ? c.dark : c.neutral) }, line: { color: hex(idx === 0 || idx === 3 ? c.accent : idx === 1 ? c.dark : c.neutral) } });
    const headingFill = stageStyle ? fill : (idx === 0 || idx === 3 ? c.accent : idx === 1 ? c.dark : c.neutral);
    addPptText(s, item.heading, { x: cx + 0.16, y: stageStyle ? y + 1.25 : y + 0.72, w: cardW - 0.32, h: 0.42, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: stageStyle ? pptTextOn(fill, SAFE_TEXT_LIGHT) : pptTextOn(headingFill, SAFE_TEXT_LIGHT), align: 'center', fit: 'shrink' });
    addPptText(s, item.body, { x: cx + 0.16, y: stageStyle ? y + 1.82 : y + h * 0.55, w: cardW - 0.32, h: stageStyle ? 0.85 : h * 0.38, fontFace: t.fonts.body, fontSize: 8, color: stageStyle ? pptTextOn(fill, SAFE_TEXT_LIGHT) : pptMutedOn('#FFFFFF', c.muted), align: 'center', fit: 'shrink' });
  });
}

function drawCriteriaPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const cellW = (w - 0.55) / 2;
  const cellH = (h - 0.35) / 2;
  items.slice(0, 4).forEach((item, idx) => {
    const cx = x + (idx % 2) * (cellW + 0.55);
    const cy = y + Math.floor(idx / 2) * (cellH + 0.35);
    s.addShape('ellipse', { x: cx, y: cy + 0.45, w: 0.72, h: 0.72, fill: { color: 'FFFFFF' }, line: { color: pptVisibleOn(c.bg, idx % 2 ? c.dark : c.accent, c.dark), width: 3 } });
    addPptText(s, item.heading, { x: cx + 0.95, y: cy + 0.35, w: cellW - 0.95, h: 0.32, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: pptTextOn(c.bg, c.sub), fit: 'shrink' });
    addPptText(s, item.body, { x: cx + 0.95, y: cy + 0.78, w: cellW - 0.95, h: 0.56, fontFace: t.fonts.body, fontSize: 8, color: pptMutedOn(c.bg, c.muted), fit: 'shrink' });
  });
}

function drawGanttPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const headers = ['단계', '일정', 'Week 1', 'Week 2-3', 'Week 3-5', 'Week 5-6'];
  const rows = items.slice(0, 4);
  const rowH = h / (rows.length + 1);
  const colWs = [w * 0.17, w * 0.25, w * 0.145, w * 0.145, w * 0.145, w * 0.145];
  let cx = x;
  headers.forEach((header, idx) => {
    const fill = idx < 2 ? c.dark : c.accent;
    s.addShape('rect', { x: cx, y, w: colWs[idx], h: rowH, fill: { color: hex(fill) }, line: { color: 'FFFFFF', transparency: 65 } });
    addPptText(s, header, { x: cx + 0.05, y: y + 0.1, w: colWs[idx] - 0.1, h: rowH - 0.2, fontFace: t.fonts.heading, fontSize: 8, bold: true, color: pptTextOn(fill, SAFE_TEXT_LIGHT), align: 'center', fit: 'shrink' });
    cx += colWs[idx];
  });
  rows.forEach((item, row) => {
    cx = x;
    [item.heading, item.body, '', '', '', ''].forEach((cell, idx) => {
      const fill = idx === 0 ? c.neutral : '#FFFFFF';
      s.addShape('rect', { x: cx, y: y + rowH * (row + 1), w: colWs[idx], h: rowH, fill: { color: hex(fill) }, line: { color: hex(c.line) } });
      if (cell) addPptText(s, cell, { x: cx + 0.06, y: y + rowH * (row + 1) + 0.08, w: colWs[idx] - 0.12, h: rowH - 0.16, fontFace: t.fonts.body, fontSize: 7, color: idx === 0 ? pptTextOn(fill, SAFE_TEXT_LIGHT) : pptMutedOn(fill, c.muted), fit: 'shrink' });
      if (idx === row + 2) { const barFill = row % 2 ? c.dark : c.accent; s.addShape('roundRect', { x: cx + 0.13, y: y + rowH * (row + 1) + rowH * 0.38, w: colWs[idx] - 0.26, h: 0.14, fill: { color: hex(barFill) }, line: { color: hex(barFill) }, rectRadius: 0.06 }); }
      cx += colWs[idx];
    });
  });
}

function drawPyramidPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const pyramidX = x + 0.2;
  const pyramidW = w * 0.36;
  items.slice(0, 3).forEach((item, idx) => {
    const level = 2 - idx;
    const levelW = pyramidW * (0.95 - level * 0.22);
    const cx = pyramidX + (pyramidW - levelW) / 2;
    const cy = y + 0.85 + idx * 0.8;
    const fill = idx === 2 ? c.accent : c.dark;
    s.addShape('roundRect', { x: cx, y: cy, w: levelW, h: 0.68, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.05 });
    addPptText(s, item.heading, { x: cx + 0.1, y: cy + 0.2, w: levelW - 0.2, h: 0.2, fontFace: t.fonts.heading, fontSize: 9, bold: true, color: pptTextOn(fill, SAFE_TEXT_LIGHT), align: 'center', fit: 'shrink' });
  });
  items.slice(0, 3).forEach((item, idx) => {
    const cy = y + 0.25 + idx * 1.05;
    s.addShape('roundRect', { x: x + w * 0.44, y: cy, w: w * 0.52, h: 0.82, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.08 });
    addPptText(s, item.body || item.heading, { x: x + w * 0.46, y: cy + 0.16, w: w * 0.48, h: 0.28, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: pptTextOn('#FFFFFF', c.sub), fit: 'shrink' });
    addPptText(s, '경험정리 기반으로 도출된 지향점', { x: x + w * 0.46, y: cy + 0.5, w: w * 0.48, h: 0.16, fontFace: t.fonts.body, fontSize: 7, color: pptMutedOn('#FFFFFF', c.muted), fit: 'shrink' });
  });
}

function drawBudgetPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const gridW = w * 0.58;
  const accentOnCard = pptVisibleOn('#FFFFFF', c.accent, c.dark);
  const darkOnCard = pptVisibleOn('#FFFFFF', c.dark, SAFE_DARK);
  const neutralOnCard = pptVisibleOn('#FFFFFF', c.neutral, c.dark);
  s.addShape('roundRect', { x, y: y + 0.25, w: gridW, h: h - 0.5, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.12 });
  items.slice(0, 4).forEach((item, idx) => {
    const cellW = (gridW - 0.75) / 2;
    const cx = x + 0.28 + (idx % 2) * (cellW + 0.2);
    const cy = y + 0.65 + Math.floor(idx / 2) * ((h - 1.2) / 2);
    addPptText(s, item.heading, { x: cx, y: cy, w: cellW, h: 0.42, fontFace: t.fonts.heading, fontSize: 20, color: idx === 0 ? accentOnCard : idx === 1 ? darkOnCard : neutralOnCard, fit: 'shrink' });
    addPptText(s, item.body, { x: cx, y: cy + 0.52, w: cellW, h: 0.38, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: pptTextOn('#FFFFFF', c.sub), fit: 'shrink' });
  });
  const pieX = x + gridW + 0.8;
  s.addShape('ellipse', { x: pieX, y: y + 0.75, w: 2.3, h: 2.3, fill: { color: accentOnCard }, line: { color: accentOnCard } });
  s.addShape('ellipse', { x: pieX + 0.28, y: y + 0.75, w: 2.0, h: 1.45, fill: { color: hex(c.dark), transparency: 12 }, line: { color: hex(c.dark), transparency: 100 } });
  s.addShape('ellipse', { x: pieX + 0.7, y: y + 1.45, w: 0.9, h: 0.9, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } });
  addPptText(s, 'Budget', { x: pieX + 0.65, y: y + 1.75, w: 1.0, h: 0.18, fontFace: t.fonts.heading, fontSize: 8, bold: true, color: accentOnCard, align: 'center' });
}

function drawRiskPptx(s, items, t, x, y, w, h) {
  const c = t.colors;
  const visible = items.slice(0, 3);
  const cardW = (w - 0.28) / Math.max(1, visible.length);
  visible.forEach((item, idx) => {
    const cx = x + idx * (cardW + 0.14);
    s.addShape('roundRect', { x: cx, y, w: cardW, h: h * 0.48, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.08 });
    const fill = idx === 2 ? c.accent : c.dark;
    const fillText = pptTextOn(fill, SAFE_TEXT_LIGHT);
    s.addShape('roundRect', { x: cx + 0.28, y: y + 0.3, w: 0.72, h: 0.24, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.1 });
    addPptText(s, `RISK ${idx + 1}`, { x: cx + 0.28, y: y + 0.35, w: 0.72, h: 0.1, fontFace: t.fonts.heading, fontSize: 5.8, bold: true, color: fillText, align: 'center' });
    addPptText(s, item.heading, { x: cx + 0.22, y: y + 0.78, w: cardW - 0.44, h: 0.32, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: pptTextOn('#FFFFFF', c.sub), align: 'center', fit: 'shrink' });
    addPptText(s, item.body, { x: cx + 0.22, y: y + 1.2, w: cardW - 0.44, h: 0.45, fontFace: t.fonts.body, fontSize: 8, color: pptMutedOn('#FFFFFF', c.muted), align: 'center', fit: 'shrink' });
    s.addShape('roundRect', { x: cx, y: y + h * 0.56, w: cardW, h: h * 0.38, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.08 });
    addPptText(s, '해당 리스크에 대한 구체적인 대응 전략과 실행 방안을 작성', { x: cx + 0.22, y: y + h * 0.66, w: cardW - 0.44, h: 0.55, fontFace: t.fonts.body, fontSize: 8, color: fillText, align: 'center', fit: 'shrink' });
  });
}

function drawMiniCallout(s, item, t, x, y, w, h, fill) {
  const c = t.colors;
  s.addShape('roundRect', { x, y, w, h, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.08 });
  s.addShape('roundRect', { x: x + 0.25, y: y + 0.15, w: w - 0.5, h: 0.28, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.12 });
  addPptText(s, item?.heading || '', { x: x + 0.28, y: y + 0.21, w: w - 0.56, h: 0.12, fontFace: t.fonts.heading, fontSize: 7, bold: true, color: pptTextOn(fill, SAFE_TEXT_LIGHT), align: 'center', fit: 'shrink' });
  addPptText(s, item?.body || '', { x: x + 0.22, y: y + 0.52, w: w - 0.44, h: h - 0.62, fontFace: t.fonts.body, fontSize: 7, color: pptMutedOn('#FFFFFF', c.muted), align: 'center', fit: 'shrink' });
}

function drawMiniCircle(s, text, t, x, y, size, fill, color) {
  s.addShape('ellipse', { x, y, w: size, h: size, fill: { color: hex(fill) }, line: { color: hex(fill) } });
  addPptText(s, text || '', { x: x + 0.08, y: y + size * 0.35, w: size - 0.16, h: size * 0.3, fontFace: t.fonts.heading, fontSize: 7, bold: true, color, align: 'center', fit: 'shrink' });
}

function drawProposalTablePptx(s, rows, t, x, y, w, h) {
  const c = t.colors;
  if (!Array.isArray(rows) || rows.length === 0) {
    drawProposalBulletCards(s, ['표에 표시할 항목이 없습니다'], t, x, y, w, h, false);
    return;
  }
  const rowH = h / rows.length;
  const colCount = Math.max(...rows.map(r => r.length));
  const colW = w / colCount;
  rows.forEach((row, r) => {
    row.forEach((cell, col) => {
      const darkCell = r === 0 || col >= 2;
      const fill = r === 0 ? (col < 2 ? c.dark : c.accent) : col < 2 ? '#FFFFFF' : col === 2 ? c.accent : c.dark;
      s.addShape('rect', { x: x + col * colW, y: y + r * rowH, w: colW, h: rowH, fill: { color: hex(fill) }, line: { color: 'E5E5E5', transparency: 35 } });
      addPptText(s, cell, { x: x + col * colW + 0.08, y: y + r * rowH + 0.08, w: colW - 0.16, h: rowH - 0.16, fontFace: t.fonts.body, fontSize: r === 0 ? 9 : 8, bold: r === 0, color: darkCell ? pptTextOn(fill, SAFE_TEXT_LIGHT) : pptMutedOn(fill, c.muted), align: 'center', valign: 'middle', fit: 'shrink' });
    });
  });
}

function drawProposalMetricsPptx(s, metrics, t, x, y, w, h, isDark) {
  const c = t.colors;
  const cardW = (w - 0.25) / 2;
  const cardH = (h - 0.25) / 2;
  metrics.slice(0, 4).forEach((metric, i) => {
    const cx = x + (i % 2) * (cardW + 0.25);
    const cy = y + Math.floor(i / 2) * (cardH + 0.25);
    const fill = i === 0 ? c.accent : isDark ? c.dark2 : '#FFFFFF';
    s.addShape('roundRect', { x: cx, y: cy, w: cardW, h: cardH, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.1 });
    addPptText(s, metric.value || '', { x: cx + 0.25, y: cy + 0.35, w: cardW - 0.5, h: 0.6, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: i === 0 || isDark ? pptTextOn(fill, SAFE_TEXT_LIGHT) : pptVisibleOn(fill, c.accent, c.dark), fit: 'shrink' });
    addPptText(s, metric.label || '', { x: cx + 0.25, y: cy + 1.0, w: cardW - 0.5, h: 0.4, fontFace: t.fonts.body, fontSize: 11, bold: true, color: i === 0 || isDark ? pptTextOn(fill, SAFE_TEXT_LIGHT) : pptTextOn(fill, c.sub), fit: 'shrink' });
  });
}

function drawProposalItemCards(s, items, t, x, y, w, h, isDark) {
  const c = t.colors;
  const cardW = (w - 0.22 * (items.length - 1)) / Math.max(1, items.length);
  items.forEach((item, idx) => {
    const fill = idx === items.length - 1 ? c.accent : (isDark ? c.dark2 : c.card);
    const fg = pptTextOn(fill, idx === items.length - 1 || isDark ? SAFE_TEXT_LIGHT : c.sub);
    const cx = x + idx * (cardW + 0.22);
    s.addShape('roundRect', { x: cx, y, w: cardW, h, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.1 });
    addPptText(s, item.heading || '', { x: cx + 0.28, y: y + h - 1.45, w: cardW - 0.56, h: 0.35, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: fg, fit: 'shrink' });
    if (item.role) addPptText(s, item.role, { x: cx + 0.28, y: y + h - 1.0, w: cardW - 0.56, h: 0.25, fontFace: t.fonts.body, fontSize: 8, color: fg, transparency: 15 });
    if (item.body) addPptText(s, item.body, { x: cx + 0.28, y: y + h - 0.68, w: cardW - 0.56, h: 0.45, fontFace: t.fonts.body, fontSize: 8, color: fg, transparency: 15, fit: 'shrink' });
  });
}

function drawProposalBulletCards(s, bullets, t, x, y, w, h, isDark) {
  const c = t.colors;
  const cols = bullets.length > 3 ? 2 : Math.max(1, bullets.length);
  const rows = Math.ceil(bullets.length / cols) || 1;
  const cardW = (w - 0.18 * (cols - 1)) / cols;
  const cardH = Math.min(1.2, (h - 0.18 * (rows - 1)) / rows);
  bullets.forEach((bullet, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = x + col * (cardW + 0.18);
    const cy = y + row * (cardH + 0.18);
    const active = idx === 0;
    const fill = active ? c.accent : (isDark ? c.dark2 : c.card);
    const fg = pptTextOn(fill, active || isDark ? SAFE_TEXT_LIGHT : c.sub);
    s.addShape('roundRect', { x: cx, y: cy, w: cardW, h: cardH, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.08 });
    addPptText(s, `0${idx + 1}`, { x: cx + 0.22, y: cy + 0.16, w: 0.45, h: 0.2, fontFace: t.fonts.body, fontSize: 8, bold: true, color: active ? fg : pptVisibleOn(fill, c.accent, c.dark) });
    addPptText(s, bullet, { x: cx + 0.22, y: cy + 0.48, w: cardW - 0.44, h: cardH - 0.58, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: fg, fit: 'shrink' });
  });
}

function drawProposalExperience(s, slide, t, x, y, w, h, isDark) {
  const c = t.colors;
  const item = (slide.items || [])[0] || {};
  const metric = slide.highlight_metric || (item.metrics || [])[0];
  const metricText = metric ? (metric.before && metric.after ? `${metric.before} → ${metric.after}` : metric.value) : '';
  if (isDark) {
    addPptText(s, metricText || 'Impact', { x, y: y + 0.8, w: 3.6, h: 0.8, fontFace: t.fonts.heading, fontSize: 34, color: pptTextOn(c.dark, SAFE_TEXT_LIGHT), fit: 'shrink' });
    addPptText(s, metric?.label || item.heading || '', { x, y: y + 1.65, w: 3.6, h: 0.3, fontFace: t.fonts.body, fontSize: 12, bold: true, color: pptTextOn(c.dark, SAFE_TEXT_LIGHT) });
    addPptText(s, item.body || '', { x, y: y + 2.05, w: 3.6, h: 0.7, fontFace: t.fonts.body, fontSize: 8, color: pptMutedOn(c.dark, SAFE_MUTED_LIGHT), fit: 'shrink' });
    [0, 1, 2, 3].forEach(idx => {
      const cx = x + 4.35 + (idx % 2) * 1.25;
      const cy = y + 0.65 + Math.floor(idx / 2) * 1.2;
      s.addShape('roundRect', { x: cx, y: cy, w: 1.05, h: 0.95, fill: { color: idx === 2 ? hex(c.accent) : 'FFFFFF', transparency: idx === 2 ? 0 : 14 }, line: { color: idx === 2 ? hex(c.accent) : 'FFFFFF' }, rectRadius: 0.08 });
    });
    drawProposalBulletCards(s, [...(slide.details?.problem || []), ...(slide.details?.action || []), ...(slide.details?.result || [])].slice(0, 4), t, x + 7.0, y + 0.4, w - 7.0, h - 0.8, true);
    return;
  }
  const accentText = pptTextOn(c.accent, SAFE_TEXT_LIGHT);
  s.addShape('roundRect', { x, y, w: 3.8, h, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) }, rectRadius: 0.12 });
  addPptText(s, item.heading || slide.title || '', { x: x + 0.28, y: y + 0.35, w: 3.2, h: 0.6, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: accentText, fit: 'shrink' });
  addPptText(s, item.period || item.role || '', { x: x + 0.28, y: y + 1.0, w: 3.2, h: 0.25, fontFace: t.fonts.body, fontSize: 8, color: accentText, transparency: 15 });
  if (metric) {
    addPptText(s, metric.label || '', { x: x + 0.28, y: y + h - 1.25, w: 3.2, h: 0.22, fontFace: t.fonts.body, fontSize: 8, bold: true, color: accentText, transparency: 10 });
    addPptText(s, metricText, { x: x + 0.28, y: y + h - 0.95, w: 3.2, h: 0.65, fontFace: t.fonts.heading, fontSize: 24, color: accentText, fit: 'shrink' });
  }
  const groups = [
    { title: '문제 정의', items: slide.details?.problem || [] },
    { title: '해결 과정', items: slide.details?.action || item.bullets || [] },
    { title: '성과', items: slide.details?.result || [] },
  ].filter(g => g.items.length);
  const cardW = (w - 4.1 - 0.18 * (groups.length - 1)) / Math.max(1, groups.length);
  groups.forEach((group, idx) => {
    const cx = x + 4.1 + idx * (cardW + 0.18);
    const darkCard = idx === groups.length - 1;
    s.addShape('roundRect', { x: cx, y, w: cardW, h, fill: { color: darkCard ? hex(c.dark) : hex(c.card) }, line: { color: darkCard ? hex(c.dark) : hex(c.card) }, rectRadius: 0.12 });
    const fill = darkCard ? c.dark : c.card;
    s.addText(group.title, { x: cx + 0.25, y: y + 0.35, w: cardW - 0.5, h: 0.25, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: pptVisibleOn(fill, c.accent, darkCard ? SAFE_TEXT_LIGHT : c.dark) });
    addPptText(s, group.items.slice(0, 4).join('\n'), { x: cx + 0.25, y: y + 0.82, w: cardW - 0.5, h: h - 1.0, fontFace: t.fonts.body, fontSize: 8, color: pptTextOn(fill, darkCard ? SAFE_TEXT_LIGHT : c.sub), breakLine: false, fit: 'shrink' });
  });
}

function drawPresenterBar(s, t, x, y, w) {
  const c = t.colors;
  s.addShape('rect', { x, y, w, h: 0.55, fill: { color: hex(c.footerBg) }, line: { color: hex(c.footerBg) } });
  let cx = x + 0.3;
  if (t.presenter?.name) {
    s.addShape('rect', { x: cx, y: y + 0.13, w: 0.04, h: 0.3, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
    s.addText([
      { text: '발표자 · ', options: { bold: true, color: hex(c.footerFg) } },
      { text: t.presenter.name, options: { color: hex(c.footerFg) } },
    ], { x: cx + 0.12, y, w: 3.0, h: 0.55, fontFace: t.fonts.body, fontSize: 13, valign: 'middle' });
    cx += 3.4;
  }
  if (t.presenter?.affiliation) {
    s.addShape('rect', { x: cx, y: y + 0.13, w: 0.04, h: 0.3, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
    s.addText([
      { text: '학과 및 학번 · ', options: { bold: true, color: hex(c.footerFg) } },
      { text: t.presenter.affiliation, options: { color: hex(c.footerFg) } },
    ], { x: cx + 0.12, y, w: 5.0, h: 0.55, fontFace: t.fonts.body, fontSize: 13, valign: 'middle' });
  }
}

// ── Document PPTX (layoutHint 분기) ──
function drawDocument(s, slide, t, i, W, H, M) {
  const c = t.colors;
  const hint = t.layoutHint || 'header-top';
  const sideColor = c.side || c.accent;
  const sideFg = c.sideFg || '#FFFFFF';
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.bg) }, line: { color: hex(c.bg) } });

  if (hint === 'sidebar-left' || hint === 'sidebar-right') {
    const isLeft = hint === 'sidebar-left';
    const SIDE_W = 3.4;
    const sideX = isLeft ? 0 : W - SIDE_W;
    const bodyX = isLeft ? SIDE_W + 0.5 : 0.5;
    const bodyW = W - SIDE_W - 1.0;
    s.addShape('rect', { x: sideX, y: 0, w: SIDE_W, h: H, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
    s.addText(String(i + 1).padStart(2, '0'), { x: sideX + 0.4, y: 0.5, w: 1, h: 0.3, fontFace: t.fonts.body, fontSize: 11, color: hex(sideFg), charSpacing: 4 });
    s.addShape('rect', { x: sideX + 0.4, y: 0.95, w: 0.4, h: 0.04, fill: { color: hex(c.accent2 || sideFg) }, line: { color: hex(c.accent2 || sideFg) } });
    s.addText(slide.title || '', { x: sideX + 0.4, y: 1.1, w: SIDE_W - 0.8, h: 1.6, fontFace: t.fonts.heading, fontSize: 20, bold: true, color: hex(sideFg), valign: 'top', fit: 'shrink' });
    if (slide.subtitle) s.addText(slide.subtitle, { x: sideX + 0.4, y: 2.7, w: SIDE_W - 0.8, h: 0.8, fontFace: t.fonts.body, fontSize: 11, color: hex(sideFg), fit: 'shrink' });
    drawBody(s, slide, t, bodyX, M, bodyW, H - M * 2, 'document');
    return;
  }

  if (hint === 'header-top' || hint === 'block' || hint === 'footer-bottom') {
    const isFooter = hint === 'footer-bottom';
    const headerH = 1.3;
    const headerY = isFooter ? H - headerH : 0;
    s.addShape('rect', { x: 0, y: headerY, w: W, h: headerH, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
    s.addText(String(i + 1).padStart(2, '0'), { x: 0.7, y: headerY + 0.2, w: 1.5, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(sideFg), transparency: 40, charSpacing: 4 });
    s.addText(slide.title || '', { x: 0.7, y: headerY + 0.45, w: W - 1.6, h: 0.8, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(sideFg), valign: 'middle', fit: 'shrink' });
    s.addShape('rect', { x: W - 0.85, y: headerY + 0.35, w: 0.06, h: 0.6, fill: { color: hex(c.accent2 || c.accent) }, line: { color: hex(c.accent2 || c.accent) } });
    const bodyTop = isFooter ? 0.6 : headerH + 0.3;
    let by = bodyTop;
    if (slide.subtitle) {
      s.addText(slide.subtitle, { x: 0.7, y: by, w: W - 1.4, h: 0.45, fontFace: t.fonts.body, fontSize: 14, color: hex(c.sub), italic: true, fit: 'shrink' });
      by += 0.55;
    }
    const bodyBottom = isFooter ? H - headerH - 0.3 : H - 0.4;
    drawBody(s, slide, t, 0.7, by, W - 1.4, bodyBottom - by, 'document');
    return;
  }

  // minimal
  s.addText(String(i + 1).padStart(2, '0'), { x: 0.9, y: 0.7, w: 1, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.accent), charSpacing: 4 });
  s.addText(slide.title || '', { x: 0.9, y: 1.0, w: W - 1.8, h: 0.9, fontFace: t.fonts.heading, fontSize: 30, bold: true, color: hex(c.titleColor || c.accent), fit: 'shrink' });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.9, y: 1.95, w: W - 1.8, h: 0.45, fontFace: t.fonts.body, fontSize: 14, color: hex(c.sub), fit: 'shrink' });
  s.addShape('rect', { x: 0.9, y: 2.5, w: 0.5, h: 0.04, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
  drawBody(s, slide, t, 0.9, 2.75, W - 1.8, H - 3.15, 'document');
}

// ── Modern PPTX ──
function drawModern(s, slide, t, i, W, H, M) {
  const c = t.colors;
  const SIDE = 2.6;
  s.addShape('rect', { x: 0, y: 0, w: SIDE, h: H, fill: { color: hex(c.side) }, line: { color: hex(c.side) } });
  s.addText(String(i + 1).padStart(2, '0'), { x: 0.4, y: 0.5, w: 1, h: 0.3, fontFace: t.fonts.body, fontSize: 10, color: hex(c.sideFg), charSpacing: 3 });
  s.addShape('rect', { x: 0.4, y: 0.85, w: 0.4, h: 0.04, fill: { color: hex(c.sideFg) }, line: { color: hex(c.sideFg) } });
  s.addText(slide.title || '', { x: 0.4, y: 1.0, w: SIDE - 0.6, h: 1.6, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: hex(c.sideFg), valign: 'top', fit: 'shrink' });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.4, y: 2.5, w: SIDE - 0.6, h: 0.6, fontFace: t.fonts.body, fontSize: 10, color: hex(c.sideFg), fit: 'shrink' });
  drawBody(s, slide, t, SIDE + 0.4, M, W - SIDE - 0.8, H - M * 2, 'modern');
  s.addText(String(i + 1), { x: W - 0.7, y: H - 0.4, w: 0.5, h: 0.25, fontFace: t.fonts.body, fontSize: 9, color: hex(c.muted), align: 'right' });
}

// ── Classic PPTX ──
function drawClassic(s, slide, t, i, W, H, M) {
  const c = t.colors;
  s.addText(`Chapter ${i + 1}`, { x: M, y: M, w: W - M * 2, h: 0.3, fontFace: t.fonts.body, fontSize: 9, color: hex(c.muted), align: 'center', charSpacing: 4 });
  s.addShape('rect', { x: W / 2 - 0.5, y: M + 0.4, w: 1, h: 0.015, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
  s.addText(slide.title || '', { x: M, y: M + 0.5, w: W - M * 2, h: 0.7, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(c.accent), align: 'center', fit: 'shrink' });
  s.addShape('rect', { x: W / 2 - 0.5, y: M + 1.25, w: 1, h: 0.015, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
  if (slide.subtitle) s.addText(slide.subtitle, { x: M, y: M + 1.35, w: W - M * 2, h: 0.4, fontFace: t.fonts.body, fontSize: 12, italic: true, color: hex(c.sub), align: 'center', fit: 'shrink' });
  drawBody(s, slide, t, M + 0.3, M + 2.0, W - (M + 0.3) * 2, H - M - 2.4, 'classic');
  s.addText(`— ${i + 1} —`, { x: 0, y: H - 0.4, w: W, h: 0.25, fontFace: t.fonts.heading, fontSize: 10, color: hex(c.muted), align: 'center' });
}

// ── Creative PPTX ──
function drawCreative(s, slide, t, i, W, H, M) {
  const c = t.colors;
  const SIDE = 3.6;
  s.addShape('rect', { x: 0, y: 0, w: SIDE, h: H, fill: { color: hex(c.side) }, line: { color: hex(c.side) } });
  s.addText(String(i + 1).padStart(2, '0'), { x: 0.4, y: 0.4, w: SIDE - 0.6, h: 1.5, fontFace: t.fonts.heading, fontSize: 80, bold: true, color: hex(c.sideFg), transparency: 80 });
  s.addText(slide.title || '', { x: 0.4, y: 1.7, w: SIDE - 0.6, h: 1.4, fontFace: t.fonts.heading, fontSize: 20, bold: true, color: hex(c.sideFg), fit: 'shrink' });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.4, y: 3.0, w: SIDE - 0.6, h: 0.6, fontFace: t.fonts.body, fontSize: 11, color: hex(c.sideFg), fit: 'shrink' });
  s.addShape('rect', { x: 0.4, y: H - 0.8, w: 0.6, h: 0.06, fill: { color: hex(c.sideFg) }, line: { color: hex(c.sideFg) } });
  drawBody(s, slide, t, SIDE + 0.4, M, W - SIDE - 0.8, H - M * 2, 'creative');
}

// ── 본문 그리기(공통) ──
function drawBody(s, slide, t, x0, y0, w, h, variant) {
  const c = t.colors;
  const items = slide.items || [];
  const bullets = slide.bullets || [];

  // [Phase 3] experience 슬라이드 → layout_type에 따라 합격자 스타일 분기
  if (slide.layout === 'experience' && slide.layout_type && slide.details) {
    const handled = drawExperienceLayout(s, slide, t, x0, y0, w, h);
    if (handled) return; // STACK_LIST 등 미지원이면 false → 기존 items 렌더링으로 폴스루
  }

  if (items.length > 0) {
    const visible = items.slice(0, 2);
    const rowH = h / visible.length;
    visible.forEach((it, idx) => {
      const y = y0 + idx * rowH;
      const innerX = x0 + (variant === 'modern' ? 0.2 : 0);
      const innerW = w - (variant === 'modern' ? 0.2 : 0);

      // 헤더
      if (variant === 'classic') {
        s.addShape('rect', { x: x0, y, w, h: 0.012, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
        s.addText(it.heading || '', { x: x0, y: y + 0.05, w: w * 0.7, h: 0.35, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(c.accent), fit: 'shrink' });
        s.addText(it.period || '', { x: x0 + w * 0.7, y: y + 0.05, w: w * 0.3, h: 0.35, fontFace: t.fonts.body, fontSize: 10, italic: true, color: hex(c.muted), align: 'right', fit: 'shrink' });
        s.addShape('rect', { x: x0, y: y + 0.45, w, h: 0.012, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
      } else if (variant === 'creative') {
        s.addShape('roundRect', { x: x0, y, w, h: 0.42, fill: { color: hex(c.line) }, line: { color: hex(c.line) }, rectRadius: 0.06 });
        s.addText(it.heading || '', { x: x0 + 0.15, y: y, w: w * 0.7, h: 0.42, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(c.accent), valign: 'middle', fit: 'shrink' });
        s.addText(it.period || '', { x: x0 + w * 0.7, y: y, w: w * 0.3 - 0.15, h: 0.42, fontFace: t.fonts.body, fontSize: 10, bold: true, color: hex(c.accent), valign: 'middle', align: 'right', fit: 'shrink' });
      } else if (variant === 'document') {
        s.addShape('rect', { x: x0, y, w: 0.06, h: 0.5, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
        s.addText(it.heading || '', { x: x0 + 0.2, y: y, w: w * 0.7, h: 0.5, fontFace: t.fonts.heading, fontSize: 17, bold: true, color: hex(c.titleColor || c.accent), valign: 'middle', fit: 'shrink' });
        s.addText(it.period || '', { x: x0 + w * 0.7, y: y, w: w * 0.3, h: 0.5, fontFace: t.fonts.body, fontSize: 12, color: hex(c.sub), valign: 'middle', align: 'right', fit: 'shrink' });
      } else {
        s.addShape('rect', { x: x0, y, w: 0.04, h: 0.42, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
        s.addText(it.heading || '', { x: innerX, y, w: innerW * 0.7, h: 0.4, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(c.accent), fit: 'shrink' });
        s.addText(it.period || '', { x: innerX + innerW * 0.7, y, w: innerW * 0.3, h: 0.4, fontFace: t.fonts.body, fontSize: 10, color: hex(c.muted), align: 'right', fit: 'shrink' });
      }

      let cy = y + 0.55;
      if (it.role) { s.addText(it.role, { x: innerX, y: cy, w: innerW, h: 0.28, fontFace: t.fonts.body, fontSize: 10, bold: true, color: hex(c.sub), fit: 'shrink' }); cy += 0.28; }
      if (it.body) { s.addText(it.body, { x: innerX, y: cy, w: innerW, h: 0.5, fontFace: t.fonts.body, fontSize: 11, color: hex(c.sub), fit: 'shrink' }); cy += 0.45; }

      if (Array.isArray(it.bullets) && it.bullets.length) {
        const bulletObjs = it.bullets.slice(0, 3).map(b => ({ text: b, options: { bullet: { code: variant === 'classic' ? '2014' : '25CF' } } }));
        const bH = Math.min(0.85, rowH - (cy - y) - 0.4);
        s.addText(bulletObjs, { x: innerX + 0.15, y: cy, w: innerW - 0.15, h: bH, fontFace: t.fonts.body, fontSize: 10, color: hex(c.sub), paraSpaceAfter: 3 });
        cy += bH;
      }

      const metrics = Array.isArray(it.metrics) ? it.metrics.filter(m => m.value || m.label).slice(0, 3) : [];
      if (metrics.length) {
        const tileW = Math.min(1.6, (innerW - 0.2 * (metrics.length - 1)) / metrics.length);
        metrics.forEach((m, mi) => {
          const mx = innerX + mi * (tileW + 0.15);
          const my = Math.min(cy, y + rowH - 0.55);
          const display = (m.before && m.after) ? `${m.before} → ${m.after}` : (m.value || '');
          if (variant === 'creative') {
            s.addShape('roundRect', { x: mx, y: my, w: tileW, h: 0.4, fill: { color: hex(c.kpi) }, line: { color: hex(c.kpi) }, rectRadius: 0.2 });
            s.addText([
              { text: (m.label || '') + '  ', options: { color: 'FFFFFF', fontSize: 9 } },
              { text: display, options: { color: 'FFFFFF', fontSize: 10, bold: true } },
            ], { x: mx + 0.1, y: my, w: tileW - 0.2, h: 0.4, fontFace: t.fonts.body, valign: 'middle' });
          } else if (variant === 'classic') {
            s.addShape('rect', { x: mx, y: my, w: tileW, h: 0.5, fill: { color: hex(c.bg) }, line: { color: hex(c.line), width: 0.75 } });
            s.addText(m.label || '', { x: mx + 0.08, y: my + 0.04, w: tileW - 0.16, h: 0.2, fontFace: t.fonts.body, fontSize: 8, color: hex(c.muted), charSpacing: 2 });
            s.addText(display, { x: mx + 0.08, y: my + 0.22, w: tileW - 0.16, h: 0.25, fontFace: t.fonts.heading, fontSize: 12, bold: true, color: hex(c.kpi) });
          } else {
            s.addShape('roundRect', { x: mx, y: my, w: tileW, h: 0.5, fill: { color: 'F8FAFC' }, line: { color: hex(c.line), width: 0.75 }, rectRadius: 0.05 });
            s.addText(m.label || '', { x: mx + 0.08, y: my + 0.04, w: tileW - 0.16, h: 0.18, fontFace: t.fonts.body, fontSize: 8, color: hex(c.muted) });
            s.addText(display, { x: mx + 0.08, y: my + 0.22, w: tileW - 0.16, h: 0.25, fontFace: t.fonts.heading, fontSize: 11, bold: true, color: hex(c.kpi) });
          }
        });
      }
    });
    return;
  }

  if (bullets.length > 0) {
    if (variant === 'document') {
      const bulletObjs = bullets.slice(0, 7).map(b => ({ text: b, options: { bullet: { code: '25CF' } } }));
      s.addText(bulletObjs, { x: x0 + 0.1, y: y0, w: w - 0.1, h, fontFace: t.fonts.body, fontSize: 16, color: hex(c.sub), paraSpaceAfter: 10 });
      return;
    }
    const bulletObjs = bullets.slice(0, 7).map(b => ({ text: b, options: { bullet: { code: variant === 'classic' ? '2014' : '25CF' } } }));
    s.addText(bulletObjs, { x: x0 + 0.2, y: y0, w: w - 0.2, h, fontFace: t.fonts.body, fontSize: 14, color: hex(c.sub), paraSpaceAfter: 8 });
  }
}

function withPptSafeFonts(template) {
  // 미리보기와 동일한 폰트를 사용해 배치·글자크기가 일치하도록 보존.
  // Pretendard가 설치되지 않은 PC에서는 맑은 고딕으로 자동 폴백.
  const heading = template.fonts?.heading || 'Pretendard';
  const body = template.fonts?.body || 'Pretendard';
  return {
    ...template,
    fonts: {
      ...template.fonts,
      heading,
      body,
    },
  };
}

function safePptText(value) {
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const label = value.label || value.heading || value.title || '';
    const metric = value.before && value.after ? `${value.before} → ${value.after}` : (value.value || value.body || '');
    return [label, metric].filter(Boolean).join(' ');
  }
  return String(value)
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/�/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pptProposalTextParts(text, defaultColor, accentColor, baseOpts = {}) {
  const value = safePptText(text);
  if (!value) return '';
  const words = value.split(' ');
  if (words.length < 2) return [{ text: value, options: { ...baseOpts, color: defaultColor } }];
  const last = words.pop();
  return [
    { text: words.join(' ') + ' ', options: { ...baseOpts, color: defaultColor } },
    { text: last, options: { ...baseOpts, color: accentColor } }
  ];
}

function normalizePptLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map(safePptText)
    .filter(Boolean);
}

function normalizePptItems(items) {
  return (Array.isArray(items) ? items : []).map(item => ({
    ...item,
    heading: safePptText(item?.heading),
    period: safePptText(item?.period),
    role: safePptText(item?.role),
    body: safePptText(item?.body),
    bullets: normalizePptLines(item?.bullets || []),
    metrics: Array.isArray(item?.metrics) ? item.metrics.map(metric => ({
      ...metric,
      label: safePptText(metric?.label),
      value: safePptText(metric?.value),
      before: safePptText(metric?.before),
      after: safePptText(metric?.after),
    })) : [],
  }));
}

function addPptText(s, value, options = {}) {
  const { fill, rectRadius = 0.06, ...textOptions } = options;
  if (fill) {
    s.addShape('roundRect', {
      x: options.x,
      y: options.y,
      w: options.w,
      h: options.h,
      fill: { color: hex(fill) },
      line: { color: hex(fill) },
      rectRadius,
    });
  }
  s.addText(safePptText(value), {
    ...textOptions,
    fontFace: textOptions.fontFace || 'Pretendard',
    fit: textOptions.fit || 'shrink',
  });
}

function pptTextOn(background, preferred = SAFE_TEXT_DARK, minimum = 4.5) {
  return hex(readableTextOn(background, preferred, minimum));
}

function pptMutedOn(background, preferred = SAFE_MUTED_DARK) {
  return hex(mutedTextOn(background, preferred));
}

function pptVisibleOn(background, preferred, fallback = SAFE_DARK) {
  return hex(visibleColorOn(background, preferred, fallback));
}

function hex(s) {
  return String(s || '#000000').replace('#', '').toUpperCase();
}

// =====================================================================
// [Phase 2/3] PPTX 출력용 — 동적 폰트 + Auto-Y + experience layout
// =====================================================================

// 텍스트 길이로 PPTX 폰트 크기(pt) 결정
function dynamicFontPt(text, baseSize, { min = 10, max = 24 } = {}) {
  const len = String(text || '').replace(/\s+/g, ' ').trim().length;
  if (len === 0) return baseSize;
  if (len <= 24) return Math.min(max, Math.round(baseSize * 1.15));
  if (len >= 80) return Math.max(min, Math.round(baseSize * 0.78));
  const t = (len - 24) / 56;
  return Math.round(baseSize * (1.15 - t * 0.37));
}

// 텍스트 라인 묶음의 예상 높이(inch) — Auto-Y 스택용
function estimateBlockHeightIn(lines, fontSizePt, boxWIn, lineHeight = 1.4) {
  // 1pt ≈ 1/72 in. 글자폭 ≈ fontSize * 0.0058 in (한글/영문 평균)
  const charWIn = fontSizePt * 0.0058;
  const charsPerLine = Math.max(1, Math.floor(boxWIn / charWIn));
  let totalRows = 0;
  for (const ln of (lines || [])) {
    totalRows += Math.max(1, Math.ceil(String(ln || '').length / charsPerLine));
  }
  return (totalRows * fontSizePt * lineHeight) / 72;
}

// experience 슬라이드를 layout_type에 따라 그림. 처리되면 true.
function drawExperienceLayout(s, slide, t, x0, y0, w, h) {
  const c = t.colors;
  const layoutType = slide.layout_type;
  const hm = slide.highlight_metric;
  const det = slide.details || {};
  const item = (slide.items || [])[0] || {};
  const hmDisplay = hm
    ? (hm.before && hm.after ? `${hm.before} → ${hm.after}` : (hm.value || ''))
    : '';

  // ── CENTER_METRIC ──
  if (layoutType === 'CENTER_METRIC' && hm) {
    const summary = [...(det.problem || []), ...(det.action || []), ...(det.result || [])].slice(0, 2).join(' · ');
    const cy = y0 + h / 2 - 1.0;
    s.addText(hm.label || 'KEY METRIC', {
      x: x0, y: cy, w, h: 0.3,
      fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.muted),
      align: 'center', charSpacing: 4,
    });
    const metricFs = dynamicFontPt(hmDisplay, 54, { min: 30, max: 72 });
    s.addText(hmDisplay, {
      x: x0, y: cy + 0.4, w, h: 1.5,
      fontFace: t.fonts.heading, fontSize: metricFs, bold: true, color: hex(c.kpi),
      align: 'center', valign: 'middle',
    });
    s.addShape('rect', { x: x0 + w / 2 - 0.4, y: cy + 2.0, w: 0.8, h: 0.05, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
    if (summary) {
      s.addText(summary, {
        x: x0 + w * 0.1, y: cy + 2.2, w: w * 0.8, h: 0.8,
        fontFace: t.fonts.body, fontSize: 14, color: hex(c.sub), align: 'center',
      });
    }
    return true;
  }

  // ── SPLIT_HALF ──
  if (layoutType === 'SPLIT_HALF') {
    const leftW = w * 0.42;
    const rightX = x0 + leftW + 0.35;
    const rightW = w - leftW - 0.35;

    // 좌측: 프로젝트명 + 기간 + 큰 지표
    const headFs = dynamicFontPt(item.heading, 22, { min: 16, max: 28 });
    s.addText(item.heading || '', {
      x: x0, y: y0 + 0.4, w: leftW, h: 1.0,
      fontFace: t.fonts.heading, fontSize: headFs, bold: true, color: hex(c.accent),
      valign: 'top',
    });
    if (item.period) {
      s.addText(item.period, {
        x: x0, y: y0 + 1.5, w: leftW, h: 0.3,
        fontFace: t.fonts.body, fontSize: 11, color: hex(c.muted),
      });
    }
    if (hm) {
      s.addShape('rect', { x: x0, y: y0 + 2.05, w: leftW * 0.7, h: 0.03, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
      s.addText(hm.label || '', {
        x: x0, y: y0 + 2.2, w: leftW, h: 0.28,
        fontFace: t.fonts.body, fontSize: 10, bold: true, color: hex(c.muted), charSpacing: 3,
      });
      const mFs = dynamicFontPt(hmDisplay, 30, { min: 20, max: 42 });
      s.addText(hmDisplay, {
        x: x0, y: y0 + 2.5, w: leftW, h: 1.0,
        fontFace: t.fonts.heading, fontSize: mFs, bold: true, color: hex(c.kpi),
      });
    }

    // 우측: STAR auto-stack
    const sections = [
      { key: 'problem', label: 'PROBLEM', items: det.problem || [] },
      { key: 'action', label: 'ACTION', items: det.action || [] },
      { key: 'result', label: 'RESULT', items: det.result || [] },
    ].filter(sec => sec.items.length);
    let cy = y0;
    const safeBottom = y0 + h - 0.15; // 안전 영역
    for (const sec of sections) {
      if (cy >= safeBottom - 0.3) break;
      // 라벨
      s.addText(sec.label, {
        x: rightX, y: cy, w: rightW, h: 0.28,
        fontFace: t.fonts.body, fontSize: 10, bold: true, color: hex(c.accent), charSpacing: 4,
      });
      cy += 0.32;
      // bullets — 각 항목의 글자수에 따라 폰트 결정 (한 섹션 내 최소값으로 통일)
      const bullets = sec.items.slice(0, 3);
      const fs = Math.min(...bullets.map(b => dynamicFontPt(b, 13, { min: 10, max: 15 })));
      const blockH = estimateBlockHeightIn(bullets, fs, rightW - 0.25, 1.45) + 0.05;
      const drawH = Math.min(blockH, safeBottom - cy);
      const objs = bullets.map(b => ({ text: b, options: { bullet: { code: '25CF' } } }));
      s.addText(objs, {
        x: rightX + 0.1, y: cy, w: rightW - 0.1, h: drawH,
        fontFace: t.fonts.body, fontSize: fs, color: hex(c.sub), paraSpaceAfter: 4,
      });
      cy += drawH + 0.15; // Auto-Y: 다음 섹션을 바로 아래에
    }
    return true;
  }

  return false; // STACK_LIST 등 → 기본 items 렌더링으로 폴스루
}
