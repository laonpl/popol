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

// ── 슬라이드 레이아웃 구조 6가지 (추후 추가 예정) ──
export const SLIDE_LAYOUTS = [
  {
    id: 'standard',
    name: '제안서형',
    description: '표지 · 목차 · 제안 배경 · 소개 · 서비스 방안 · 계획 및 조건을 제안서 흐름으로 구성',
    tag: '1번 템플릿',
    available: true,
  },
  {
    id: 'narrative',
    name: '스토리형',
    description: '도입 → 문제 → 해결 → 성과의 내러티브 흐름',
    tag: '준비 중',
    available: false,
  },
  {
    id: 'star',
    name: 'STAR 프레임',
    description: 'Situation · Task · Action · Result 구조로 각 경험 전개',
    tag: '준비 중',
    available: false,
  },
  {
    id: 'kpi-dashboard',
    name: 'KPI 대시보드',
    description: '성과 수치를 시각적으로 강조하는 메트릭 중심 구성',
    tag: '준비 중',
    available: false,
  },
  {
    id: 'timeline',
    name: '타임라인',
    description: '시간 순서로 커리어 여정을 시각화한 구성',
    tag: '준비 중',
    available: false,
  },
  {
    id: 'case-study',
    name: '케이스 스터디',
    description: '문제 → 리서치 → 설계 → 개발 → 학습의 깊은 탐구형',
    tag: '준비 중',
    available: false,
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
  const layoutBase = layoutId === 'standard' ? getTemplate('proposal') : getTemplate('proposal');
  const palette = getTemplate(paletteId);
  return normalizeProposalTemplate({
    ...layoutBase,
    id: `${layoutBase.id}-${palette.id}`,
    name: `${layoutBase.name} · ${palette.name}`,
    description: `${layoutBase.description} / ${palette.description}`,
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

function proposalTextParts(text, accent) {
  const value = String(text || '').trim();
  if (!value) return null;
  const words = value.split(' ');
  if (words.length < 2) return value;
  const last = words.pop();
  return <>{words.join(' ')} <span style={{ color: accent }}>{last}</span></>;
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

  return (
    <div style={{ position: 'absolute', inset: 0, background: bg, color: titleColor, fontFamily: t.fonts.body }}>
      <div style={{ position: 'absolute', left: 52, top: 28 }}>{proposalPill(section, c)}</div>
      {isDark && <ProposalDots color={accentColor} right={70} top={55} />}
      <div style={{ position: 'absolute', left: 52, right: 52, top: 86 }}>
        <div style={{ fontFamily: t.fonts.heading, fontSize: dynamicFontPx(slide.title, 36, { min: 26, max: 42 }), fontWeight: 900, color: titleColor, lineHeight: 1.22, textAlign: slide.layout === 'profile' ? 'left' : 'center' }}>
          {proposalTextParts(slide.title || section, accentColor)}
        </div>
        {slide.subtitle ? <div style={{ marginTop: 12, fontSize: 15, fontWeight: 600, color: bodyColor, lineHeight: 1.45, textAlign: slide.layout === 'profile' ? 'left' : 'center' }}>{slide.subtitle}</div> : null}
      </div>
      <div style={{ position: 'absolute', left: 52, right: 52, top: 188, bottom: 44 }}>
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
  return <div style={{ position: 'relative', height: '100%' }}><div style={{ position: 'absolute', left: 285, top: 62, width: 190, height: 190, borderRadius: '50%', background: '#FFFFFF', color: cardText, boxShadow: '0 0 45px rgba(255,79,26,0.22)', display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 900, padding: 18, ...textClamp(3) }}>{items[0]?.heading}</div><div style={{ position: 'absolute', left: 430, top: 62, width: 190, height: 190, borderRadius: '50%', background: '#FFFFFF', color: cardText, boxShadow: '0 0 45px rgba(255,79,26,0.22)', display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 900, padding: 18, ...textClamp(3) }}>{items[1]?.heading}</div><div style={{ position: 'absolute', left: 410, top: 100, width: 82, height: 150, borderRadius: '50%', background: c.accent, opacity: 0.95 }} /><div style={{ position: 'absolute', left: 40, top: 80, width: 220, textAlign: 'center' }}><div style={{ padding: '10px 22px', borderRadius: 999, background: c.dark, color: darkText, fontWeight: 900, ...textClamp(1) }}>{items[0]?.heading}</div><p style={{ fontSize: 12, color: cardMuted, lineHeight: 1.6, ...textClamp(4) }}>{items[0]?.body}</p></div><div style={{ position: 'absolute', right: 40, top: 80, width: 220, textAlign: 'center' }}><div style={{ padding: '10px 22px', borderRadius: 999, background: c.dark, color: darkText, fontWeight: 900, ...textClamp(1) }}>{items[1]?.heading}</div><p style={{ fontSize: 12, color: cardMuted, lineHeight: 1.6, ...textClamp(4) }}>{items[1]?.body}</p></div><div style={{ position: 'absolute', left: 120, right: 120, bottom: 20, padding: 16, borderRadius: 8, background: c.accent, color: accentText, textAlign: 'center', fontWeight: 900, ...textClamp(2) }}>{items[2]?.body}</div></div>;
}

function ProposalStairs({ items, c }) {
  return <div style={{ display: 'flex', alignItems: 'end', gap: 10, height: '100%' }}>{items.slice(0, 5).map((item, i) => { const fill = i === 4 ? c.accent : i < 2 ? c.neutral : c.dark; return <div key={i} style={{ flex: 1, height: 105 + i * 38, background: fill, color: readableTextOn(fill, SAFE_TEXT_LIGHT), borderRadius: '9px 9px 0 0', padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'end', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', top: -48, left: 12, color: visibleColorOn(c.bg, i === 4 ? c.accent : c.dark, SAFE_DARK), fontSize: 42, fontWeight: 300 }}>{String(i + 1).padStart(2, '0')}</div><div style={{ fontWeight: 900, fontSize: 15, ...textClamp(2) }}>{item.heading}</div><div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.35, opacity: 0.9, ...textClamp(4) }}>{item.body}</div></div>; })}</div>;
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
      s.addText(slide.title || '', { x: 0.7, y: H / 2 - 0.8, w: W * 0.6 - 1.0, h: 2.0, fontFace: t.fonts.heading, fontSize: isCover ? 44 : 34, bold: true, color: hex(c.titleColor || c.accent) });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 0.7, y: H / 2 + 1.0, w: W * 0.6 - 1.0, h: 1.0, fontFace: t.fonts.body, fontSize: 18, color: hex(c.sub) });
      return;
    }
    if (hint === 'header-top' || hint === 'footer-bottom') {
      const isTop = hint !== 'footer-bottom';
      s.addShape('rect', { x: 0, y: isTop ? 0 : H - 1.2, w: W, h: 1.2, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
      const cy = H / 2 - 1.0;
      s.addText('PORTFOLIO', { x: 1.0, y: cy, w: 4, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.accent), charSpacing: 5 });
      s.addText(slide.title || '', { x: 1.0, y: cy + 0.4, w: W - 2.0, h: 1.4, fontFace: t.fonts.heading, fontSize: isCover ? 50 : 40, bold: true, color: hex(c.titleColor || c.accent) });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 1.0, y: cy + 1.9, w: W - 2.0, h: 1.0, fontFace: t.fonts.body, fontSize: 20, color: hex(c.sub) });
      s.addShape('rect', { x: 1.0, y: cy + 2.85, w: 0.8, h: 0.05, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
      return;
    }
    if (hint === 'minimal') {
      s.addText(slide.title || '', { x: 1.1, y: H / 2 - 1.2, w: W - 2.2, h: 1.6, fontFace: t.fonts.heading, fontSize: isCover ? 50 : 40, bold: true, color: hex(c.titleColor || c.accent) });
      if (slide.subtitle) s.addText(slide.subtitle, { x: 1.1, y: H / 2 + 0.4, w: W - 2.2, h: 0.8, fontFace: t.fonts.body, fontSize: 20, color: hex(c.sub) });
      s.addShape('rect', { x: 1.1, y: H / 2 + 1.3, w: 0.8, h: 0.05, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
      return;
    }
    // sidebar-left / block (기본)
    s.addShape('rect', { x: 0, y: 0, w: W * 0.42, h: H, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
    s.addText('PORTFOLIO', { x: 0.7, y: 0.7, w: 4, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(sideFg), transparency: 30, charSpacing: 6 });
    s.addShape('rect', { x: 0.7, y: H - 3.4, w: 0.7, h: 0.07, fill: { color: hex(c.accent2 || sideFg) }, line: { color: hex(c.accent2 || sideFg) } });
    s.addText(slide.title || '', { x: 0.7, y: H - 3.2, w: W * 0.42 - 1.0, h: 2.6, fontFace: t.fonts.heading, fontSize: isCover ? 40 : 32, bold: true, color: hex(sideFg), valign: 'top' });
    if (slide.subtitle) {
      s.addText('SUBTITLE', { x: W * 0.42 + 0.6, y: H / 2 - 0.8, w: 4, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.accent), charSpacing: 5 });
      s.addText(slide.subtitle, { x: W * 0.42 + 0.6, y: H / 2 - 0.4, w: W * 0.58 - 1.2, h: 1.6, fontFace: t.fonts.body, fontSize: 18, color: hex(c.sub) });
    }
    return;
  }
  if (t.style === 'centered') {
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.bg) }, line: { color: hex(c.bg) } });
    s.addShape('rect', { x: W / 2 - 0.8, y: H / 2 - 1.0, w: 1.6, h: 0.02, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
    s.addText(slide.title || '', { x: 1, y: H / 2 - 0.7, w: W - 2, h: 1.5, fontFace: t.fonts.heading, fontSize: isCover ? 44 : 36, bold: true, color: hex(c.accent), align: 'center' });
    if (slide.subtitle) s.addText(slide.subtitle, { x: 1, y: H / 2 + 0.5, w: W - 2, h: 0.6, fontFace: t.fonts.body, fontSize: 16, italic: true, color: hex(c.sub), align: 'center' });
    s.addShape('rect', { x: W / 2 - 0.8, y: H / 2 + 1.2, w: 1.6, h: 0.02, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
    return;
  }
  if (t.style === 'block') {
    s.addShape('rect', { x: 0, y: 0, w: W * 0.45, h: H, fill: { color: hex(c.side) }, line: { color: hex(c.side) } });
    s.addText(slide.title || '', { x: 0.5, y: H - 2.2, w: W * 0.45 - 1, h: 1.6, fontFace: t.fonts.heading, fontSize: isCover ? 40 : 32, bold: true, color: hex(c.sideFg) });
    if (slide.subtitle) s.addText(slide.subtitle, { x: W * 0.45 + 0.5, y: H / 2 - 0.5, w: W * 0.55 - 1, h: 1.2, fontFace: t.fonts.body, fontSize: 16, color: hex(c.sub) });
    return;
  }
  // modern
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.side) }, line: { color: hex(c.side) } });
  s.addShape('rect', { x: 0.7, y: H / 2 - 1.4, w: 0.6, h: 0.05, fill: { color: hex(c.sideFg) }, line: { color: hex(c.sideFg) } });
  s.addText(slide.title || '', { x: 0.7, y: H / 2 - 1.2, w: W - 1.4, h: 1.6, fontFace: t.fonts.heading, fontSize: isCover ? 40 : 32, bold: true, color: hex(c.sideFg) });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.7, y: H / 2 + 0.5, w: W - 1.4, h: 0.6, fontFace: t.fonts.body, fontSize: 16, color: hex(c.sideFg) });
}

function drawProposalDots(s, c, W, x = 9.0, y = 4.2) {
  for (let row = 0; row < 11; row += 1) {
    for (let col = 0; col < 18; col += 1) {
      if (col < row * 1.25) continue;
      const size = 0.055 + Math.min(row, 6) * 0.006;
      s.addShape('ellipse', {
        x: x + col * 0.13,
        y: y + row * 0.13,
        w: size,
        h: size,
        fill: { color: hex(c.accent), transparency: Math.min(82, col * 4) },
        line: { color: hex(c.accent), transparency: 100 },
      });
    }
  }
}

function drawProposalCover(s, slide, t, W, H) {
  const c = t.colors;
  const tags = (slide.bullets && slide.bullets.length ? slide.bullets : ['EXPERIENCE', 'IMPACT', 'SCALABILITY']).slice(0, 3).join(' · ');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.dark) }, line: { color: hex(c.dark) } });
  s.addText('FITPOLY', { x: 0.9, y: 0.78, w: 2.0, h: 0.45, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: pptVisibleOn(c.dark, c.accent, SAFE_TEXT_LIGHT) });
  s.addText(new Date().toISOString().slice(0, 10).replace(/-/g, '.'), { x: W - 2.2, y: 0.78, w: 1.4, h: 0.25, fontFace: t.fonts.body, fontSize: 8, color: 'CFCFD2', align: 'right' });
  s.addText(slide.subtitle || '경험을 기준으로', { x: 0.9, y: 1.85, w: 6.8, h: 0.55, fontFace: t.fonts.heading, fontSize: 28, color: 'FFFFFF' });
  s.addText(slide.title || '포트폴리오 솔루션', { x: 0.9, y: 2.45, w: 7.0, h: 1.25, fontFace: t.fonts.heading, fontSize: 34, bold: true, color: 'FFFFFF', fit: 'shrink' });
  drawProposalDots(s, c, W);
  s.addText(tags, { x: 0.9, y: H - 0.92, w: 6.5, h: 0.25, fontFace: t.fonts.body, fontSize: 9, bold: true, color: 'FFFFFF' });
}

function drawProposalHeader(s, slide, t, i, W, isDark) {
  const c = t.colors;
  const section = slide.sectionLabel || (slide.layout === 'closing' ? '마무리' : '제안서');
  const titleColor = isDark ? 'FFFFFF' : hex(c.sub);
  s.addShape('roundRect', { x: 0.72, y: 0.35, w: 1.45, h: 0.32, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, rectRadius: 0.14 });
  s.addShape('ellipse', { x: 0.82, y: 0.46, w: 0.08, h: 0.08, fill: { color: pptVisibleOn('#FFFFFF', c.accent, c.dark) }, line: { color: pptVisibleOn('#FFFFFF', c.accent, c.dark) } });
  s.addText(section, { x: 0.95, y: 0.4, w: 1.0, h: 0.18, fontFace: t.fonts.body, fontSize: 7, bold: true, color: pptTextOn('#FFFFFF', c.sub) });
  s.addText(slide.title || section, { x: 0.7, y: 1.0, w: W - 1.4, h: 0.72, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: titleColor, align: slide.layout === 'profile' ? 'left' : 'center', fit: 'shrink' });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 1.5, y: 1.75, w: W - 3.0, h: 0.35, fontFace: t.fonts.body, fontSize: 10, bold: true, color: isDark ? 'D4D4D8' : hex(c.sub), align: 'center', fit: 'shrink' });
}

function drawProposal(s, slide, t, i, W, H) {
  const c = t.colors;
  const isDark = slide.dark || slide.layout === 'closing' || (slide.layout === 'experience' && slide.layout_type === 'CENTER_METRIC');
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: isDark ? hex(c.dark) : hex(c.bg) }, line: { color: isDark ? hex(c.dark) : hex(c.bg) } });
  if (isDark) drawProposalDots(s, c, W, 9.4, 0.9);
  drawProposalHeader(s, slide, t, i, W, isDark);
  const x = 0.72, y = 2.45, w = W - 1.44, h = H - 2.95;
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
  const centerX = x + w * 0.5;
  const cardText = pptTextOn('#FFFFFF', c.sub);
  const cardMuted = pptMutedOn('#FFFFFF', c.muted);
  const accentText = pptTextOn(c.accent, SAFE_TEXT_LIGHT);
  s.addShape('ellipse', { x: centerX - 1.6, y: y + 0.75, w: 2.3, h: 2.3, fill: { color: 'FFFFFF', transparency: withText ? 0 : 10 }, line: { color: hex(c.line), transparency: 35 } });
  s.addShape('ellipse', { x: centerX - 0.35, y: y + 0.75, w: 2.3, h: 2.3, fill: { color: 'FFFFFF', transparency: withText ? 0 : 10 }, line: { color: hex(c.line), transparency: 35 } });
  s.addShape('ellipse', { x: centerX - 0.1, y: y + 1.15, w: 0.9, h: 1.45, fill: { color: hex(c.accent), transparency: 8 }, line: { color: hex(c.accent), transparency: 100 } });
  addPptText(s, items[0]?.heading || '핵심 역량', { x: centerX - 1.35, y: y + 1.55, w: 1.2, h: 0.42, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: cardText, align: 'center', fit: 'shrink' });
  addPptText(s, items[1]?.heading || '실행 역량', { x: centerX + 0.05, y: y + 1.55, w: 1.2, h: 0.42, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: cardText, align: 'center', fit: 'shrink' });
  if (withText) {
    drawMiniCallout(s, items[0], t, x, y + 0.95, 2.8, 1.2, c.dark);
    drawMiniCallout(s, items[1], t, x + w - 2.8, y + 0.95, 2.8, 1.2, c.dark);
    addPptText(s, items[2]?.body || '', { x: x + 1.4, y: y + h - 0.75, w: w - 2.8, h: 0.35, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: accentText, align: 'center', fit: 'shrink', fill: c.accent });
  } else {
    items.slice(0, 4).forEach((item, idx) => {
      drawMiniCircle(s, item.heading, t, x + idx * (w / 4) + 0.25, y + h - 1.15, 0.9, idx === 0 ? c.accent : idx === 3 ? c.dark : 'FFFFFF', idx === 0 || idx === 3 ? 'FFFFFF' : hex(c.sub));
    });
  }
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
  const stepW = (w - 0.12 * (visible.length - 1)) / Math.max(1, visible.length);
  visible.forEach((item, idx) => {
    const stepH = 1.15 + idx * 0.42;
    const cx = x + idx * (stepW + 0.12);
    const cy = y + h - stepH;
    const fill = idx === visible.length - 1 ? c.accent : idx < 2 ? c.neutral : c.dark;
    addPptText(s, String(idx + 1).padStart(2, '0'), { x: cx + 0.08, y: cy - 0.52, w: 0.8, h: 0.38, fontFace: t.fonts.heading, fontSize: 22, color: pptVisibleOn(c.bg, idx === visible.length - 1 ? c.accent : c.dark, c.dark), fit: 'shrink' });
    s.addShape('roundRect', { x: cx, y: cy, w: stepW, h: stepH, fill: { color: hex(fill) }, line: { color: hex(fill) }, rectRadius: 0.08 });
    const fillText = pptTextOn(fill, SAFE_TEXT_LIGHT);
    addPptText(s, item.heading, { x: cx + 0.18, y: cy + stepH - 0.9, w: stepW - 0.36, h: 0.32, fontFace: t.fonts.heading, fontSize: 10, bold: true, color: fillText, fit: 'shrink' });
    addPptText(s, item.body, { x: cx + 0.18, y: cy + stepH - 0.52, w: stepW - 0.36, h: 0.35, fontFace: t.fonts.body, fontSize: 7, color: fillText, fit: 'shrink' });
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
    s.addText(slide.title || '', { x: sideX + 0.4, y: 1.1, w: SIDE_W - 0.8, h: 1.6, fontFace: t.fonts.heading, fontSize: 20, bold: true, color: hex(sideFg), valign: 'top' });
    if (slide.subtitle) s.addText(slide.subtitle, { x: sideX + 0.4, y: 2.7, w: SIDE_W - 0.8, h: 0.8, fontFace: t.fonts.body, fontSize: 11, color: hex(sideFg) });
    drawBody(s, slide, t, bodyX, M, bodyW, H - M * 2, 'document');
    return;
  }

  if (hint === 'header-top' || hint === 'block' || hint === 'footer-bottom') {
    const isFooter = hint === 'footer-bottom';
    const headerH = 1.3;
    const headerY = isFooter ? H - headerH : 0;
    s.addShape('rect', { x: 0, y: headerY, w: W, h: headerH, fill: { color: hex(sideColor) }, line: { color: hex(sideColor) } });
    s.addText(String(i + 1).padStart(2, '0'), { x: 0.7, y: headerY + 0.2, w: 1.5, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(sideFg), transparency: 40, charSpacing: 4 });
    s.addText(slide.title || '', { x: 0.7, y: headerY + 0.45, w: W - 1.6, h: 0.8, fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(sideFg), valign: 'middle' });
    s.addShape('rect', { x: W - 0.85, y: headerY + 0.35, w: 0.06, h: 0.6, fill: { color: hex(c.accent2 || c.accent) }, line: { color: hex(c.accent2 || c.accent) } });
    const bodyTop = isFooter ? 0.6 : headerH + 0.3;
    let by = bodyTop;
    if (slide.subtitle) {
      s.addText(slide.subtitle, { x: 0.7, y: by, w: W - 1.4, h: 0.45, fontFace: t.fonts.body, fontSize: 14, color: hex(c.sub), italic: true });
      by += 0.55;
    }
    const bodyBottom = isFooter ? H - headerH - 0.3 : H - 0.4;
    drawBody(s, slide, t, 0.7, by, W - 1.4, bodyBottom - by, 'document');
    return;
  }

  // minimal
  s.addText(String(i + 1).padStart(2, '0'), { x: 0.9, y: 0.7, w: 1, h: 0.3, fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.accent), charSpacing: 4 });
  s.addText(slide.title || '', { x: 0.9, y: 1.0, w: W - 1.8, h: 0.9, fontFace: t.fonts.heading, fontSize: 30, bold: true, color: hex(c.titleColor || c.accent) });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.9, y: 1.95, w: W - 1.8, h: 0.45, fontFace: t.fonts.body, fontSize: 14, color: hex(c.sub) });
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
  s.addText(slide.title || '', { x: 0.4, y: 1.0, w: SIDE - 0.6, h: 1.6, fontFace: t.fonts.heading, fontSize: 18, bold: true, color: hex(c.sideFg), valign: 'top' });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.4, y: 2.5, w: SIDE - 0.6, h: 0.6, fontFace: t.fonts.body, fontSize: 10, color: hex(c.sideFg) });
  drawBody(s, slide, t, SIDE + 0.4, M, W - SIDE - 0.8, H - M * 2, 'modern');
  s.addText(String(i + 1), { x: W - 0.7, y: H - 0.4, w: 0.5, h: 0.25, fontFace: t.fonts.body, fontSize: 9, color: hex(c.muted), align: 'right' });
}

// ── Classic PPTX ──
function drawClassic(s, slide, t, i, W, H, M) {
  const c = t.colors;
  s.addText(`Chapter ${i + 1}`, { x: M, y: M, w: W - M * 2, h: 0.3, fontFace: t.fonts.body, fontSize: 9, color: hex(c.muted), align: 'center', charSpacing: 4 });
  s.addShape('rect', { x: W / 2 - 0.5, y: M + 0.4, w: 1, h: 0.015, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
  s.addText(slide.title || '', { x: M, y: M + 0.5, w: W - M * 2, h: 0.7, fontFace: t.fonts.heading, fontSize: 24, bold: true, color: hex(c.accent), align: 'center' });
  s.addShape('rect', { x: W / 2 - 0.5, y: M + 1.25, w: 1, h: 0.015, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
  if (slide.subtitle) s.addText(slide.subtitle, { x: M, y: M + 1.35, w: W - M * 2, h: 0.4, fontFace: t.fonts.body, fontSize: 12, italic: true, color: hex(c.sub), align: 'center' });
  drawBody(s, slide, t, M + 0.3, M + 2.0, W - (M + 0.3) * 2, H - M - 2.4, 'classic');
  s.addText(`— ${i + 1} —`, { x: 0, y: H - 0.4, w: W, h: 0.25, fontFace: t.fonts.heading, fontSize: 10, color: hex(c.muted), align: 'center' });
}

// ── Creative PPTX ──
function drawCreative(s, slide, t, i, W, H, M) {
  const c = t.colors;
  const SIDE = 3.6;
  s.addShape('rect', { x: 0, y: 0, w: SIDE, h: H, fill: { color: hex(c.side) }, line: { color: hex(c.side) } });
  s.addText(String(i + 1).padStart(2, '0'), { x: 0.4, y: 0.4, w: SIDE - 0.6, h: 1.5, fontFace: t.fonts.heading, fontSize: 80, bold: true, color: hex(c.sideFg), transparency: 80 });
  s.addText(slide.title || '', { x: 0.4, y: 1.7, w: SIDE - 0.6, h: 1.4, fontFace: t.fonts.heading, fontSize: 20, bold: true, color: hex(c.sideFg) });
  if (slide.subtitle) s.addText(slide.subtitle, { x: 0.4, y: 3.0, w: SIDE - 0.6, h: 0.6, fontFace: t.fonts.body, fontSize: 11, color: hex(c.sideFg) });
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
        s.addText(it.heading || '', { x: x0, y: y + 0.05, w: w * 0.7, h: 0.35, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(c.accent) });
        s.addText(it.period || '', { x: x0 + w * 0.7, y: y + 0.05, w: w * 0.3, h: 0.35, fontFace: t.fonts.body, fontSize: 10, italic: true, color: hex(c.muted), align: 'right' });
        s.addShape('rect', { x: x0, y: y + 0.45, w, h: 0.012, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
      } else if (variant === 'creative') {
        s.addShape('roundRect', { x: x0, y, w, h: 0.42, fill: { color: hex(c.line) }, line: { color: hex(c.line) }, rectRadius: 0.06 });
        s.addText(it.heading || '', { x: x0 + 0.15, y: y, w: w * 0.7, h: 0.42, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(c.accent), valign: 'middle' });
        s.addText(it.period || '', { x: x0 + w * 0.7, y: y, w: w * 0.3 - 0.15, h: 0.42, fontFace: t.fonts.body, fontSize: 10, bold: true, color: hex(c.accent), valign: 'middle', align: 'right' });
      } else if (variant === 'document') {
        s.addShape('rect', { x: x0, y, w: 0.06, h: 0.5, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
        s.addText(it.heading || '', { x: x0 + 0.2, y: y, w: w * 0.7, h: 0.5, fontFace: t.fonts.heading, fontSize: 17, bold: true, color: hex(c.titleColor || c.accent), valign: 'middle' });
        s.addText(it.period || '', { x: x0 + w * 0.7, y: y, w: w * 0.3, h: 0.5, fontFace: t.fonts.body, fontSize: 12, color: hex(c.sub), valign: 'middle', align: 'right' });
      } else {
        s.addShape('rect', { x: x0, y, w: 0.04, h: 0.42, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
        s.addText(it.heading || '', { x: innerX, y, w: innerW * 0.7, h: 0.4, fontFace: t.fonts.heading, fontSize: 14, bold: true, color: hex(c.accent) });
        s.addText(it.period || '', { x: innerX + innerW * 0.7, y, w: innerW * 0.3, h: 0.4, fontFace: t.fonts.body, fontSize: 10, color: hex(c.muted), align: 'right' });
      }

      let cy = y + 0.55;
      if (it.role) { s.addText(it.role, { x: innerX, y: cy, w: innerW, h: 0.28, fontFace: t.fonts.body, fontSize: 10, bold: true, color: hex(c.sub) }); cy += 0.28; }
      if (it.body) { s.addText(it.body, { x: innerX, y: cy, w: innerW, h: 0.5, fontFace: t.fonts.body, fontSize: 11, color: hex(c.sub) }); cy += 0.45; }

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
  const safeFont = 'Malgun Gothic';
  return {
    ...template,
    fonts: {
      ...template.fonts,
      heading: safeFont,
      body: safeFont,
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
    fontFace: textOptions.fontFace || 'Malgun Gothic',
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
