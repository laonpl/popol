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
  {
    id: 'modern',
    name: '모던 (Modern)',
    description: '다크 사이드바 + 산세리프, IT/스타트업 합격자 스타일',
    style: 'sidebar',
    colors: { bg: '#FFFFFF', accent: '#0F172A', sub: '#475569', muted: '#94A3B8', line: '#E2E8F0', side: '#0F172A', sideFg: '#FFFFFF', kpi: '#0F172A' },
    fonts: { heading: 'Pretendard', body: 'Pretendard' },
  },
  {
    id: 'classic',
    name: '클래식 (Classic)',
    description: '세리프 + 골드 라인, 대기업/금융 정중한 스타일',
    style: 'centered',
    colors: { bg: '#FBFAF6', accent: '#1F1B16', sub: '#5B5346', muted: '#8C826E', line: '#C9A961', side: '#FBFAF6', sideFg: '#1F1B16', kpi: '#8C6F3A' },
    fonts: { heading: 'Noto Serif KR', body: 'Pretendard' },
  },
  {
    id: 'creative',
    name: '크리에이티브 (Creative)',
    description: '컬러 블록 + 굵은 헤딩, 디자인/마케팅 임팩트',
    style: 'block',
    colors: { bg: '#FFFFFF', accent: '#FF5A5F', sub: '#1F2937', muted: '#9CA3AF', line: '#FFE4E6', side: '#FF5A5F', sideFg: '#FFFFFF', kpi: '#FF5A5F' },
    fonts: { heading: 'Pretendard', body: 'Pretendard' },
  },
];

export function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
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
    if (t.style === 'document') return <div style={wrap}>{renderDocumentCover(slide, t)}</div>;
    return <div style={wrap}>{renderCover(slide, t)}</div>;
  }

  if (t.style === 'sidebar') return <div style={wrap}>{renderModern(slide, t, index)}</div>;
  if (t.style === 'centered') return <div style={wrap}>{renderClassic(slide, t, index)}</div>;
  if (t.style === 'document') return <div style={wrap}>{renderDocument(slide, t, index)}</div>;
  return <div style={wrap}>{renderCreative(slide, t, index)}</div>;
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
  const t = (templateOrId && typeof templateOrId === 'object') ? templateOrId : getTemplate(templateOrId);
  const c = t.colors;
  const M = 0.55;

  for (let i = 0; i < (deck.slides || []).length; i += 1) {
    const slide = deck.slides[i];
    const s = pptx.addSlide();
    s.background = { color: hex(c.bg) };

    if (slide.layout === 'cover' || slide.layout === 'section') {
      drawCover(s, slide, t, W, H);
      if (slide.notes) s.addNotes(slide.notes);
      continue;
    }

    if (t.style === 'sidebar') drawModern(s, slide, t, i, W, H, M);
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
