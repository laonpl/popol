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
  return {
    id: 'custom',
    name: `내 템플릿 (${fileName || 'custom'})`,
    description: '업로드 템플릿의 색상·폰트로 합격자 도큐먼트 레이아웃 구성',
    style: 'document',
    colors: {
      bg: '#FFFFFF',
      accent,
      titleColor,
      sub: '#374151',
      muted: '#9CA3AF',
      line: hexLighten(accent, 0.85),
      side: accent,
      sideFg: '#FFFFFF',
      kpi: accent,
      footerBg: hexLighten(accent, 0.92),
      footerFg: '#374151',
    },
    fonts: {
      heading: t.fontHeading || 'Pretendard',
      body: t.fontBody || 'Pretendard',
    },
    presenter, // { name, affiliation } 하단 바에 표시
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

// ── Document: 흰 배경 + 상단 라인 + 좌측 반원 + 하단 발표자 바 ──
function renderDocument(slide, t, index) {
  const c = t.colors;
  const sectionLabel = (slide.layout || 'SECTION').toUpperCase();
  return (
    <>
      {/* 상단 가는 라인 */}
      <div style={{ position: 'absolute', left: 80, right: 80, top: 70, height: 1, background: c.line }} />
      {/* 좌측 액센트 반원 */}
      <div style={{ position: 'absolute', left: -38, top: 220, width: 90, height: 90, borderRadius: '50%', background: c.accent }} />
      {/* 헤더: 섹션 라벨 + 타이틀 */}
      <div style={{ position: 'absolute', left: 100, top: 90, right: 100 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, letterSpacing: '0.18em', marginBottom: 8 }}>
          {String(index + 1).padStart(2, '0')} · {sectionLabel}
        </div>
        <div style={{ fontFamily: t.fonts.heading, fontSize: 34, fontWeight: 900, color: c.titleColor || c.accent, lineHeight: 1.15 }}>
          {slide.title || ' '}
        </div>
        {slide.subtitle && (
          <div style={{ marginTop: 8, fontSize: 16, color: c.sub }}>{slide.subtitle}</div>
        )}
      </div>
      {/* 본문 */}
      <div style={{ position: 'absolute', left: 100, right: 80, top: 230, bottom: 110 }}>
        {renderBody(slide, t, 'document')}
      </div>
      {/* 하단 발표자 바 */}
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 35, padding: '10px 16px', background: c.footerBg, display: 'flex', alignItems: 'center', gap: 22, fontSize: 11, color: c.footerFg }}>
        {t.presenter?.name && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 2, height: 12, background: c.accent }} />
            <span style={{ fontWeight: 700 }}>발표자 ·</span>
            <span>{t.presenter.name}</span>
          </div>
        )}
        {t.presenter?.affiliation && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 2, height: 12, background: c.accent }} />
            <span style={{ fontWeight: 700 }}>학과 및 학번 ·</span>
            <span>{t.presenter.affiliation}</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', color: c.muted }}>{index + 1}</div>
      </div>
    </>
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
        <div style={{ background: c.accent, color: '#fff', padding: '10px 18px', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: t.fonts.heading, fontSize: 17, fontWeight: 800 }}>{it.heading || ''}</div>
          <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>{it.period || ''}</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bullets.slice(0, 7).map((b, i) => (
            <div key={i} style={{ background: c.line, padding: '10px 16px', borderRadius: 4, fontSize: 14, color: c.sub, fontWeight: 500 }}>
              {b}
            </div>
          ))}
        </div>
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
    s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.bg) }, line: { color: hex(c.bg) } });
    // 상단 가는 라인
    s.addShape('rect', { x: 0.9, y: 0.85, w: W - 1.8, h: 0.012, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
    // 좌측 액센트 원(반원처럼 보이게 화면 밖까지 확장)
    s.addShape('ellipse', { x: -0.7, y: H / 2 - 0.95, w: 1.9, h: 1.9, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
    // 타이틀
    s.addText(slide.title || '', {
      x: 1.3, y: 1.7, w: W - 2.5, h: 1.6,
      fontFace: t.fonts.heading, fontSize: isCover ? 60 : 44, bold: true,
      color: hex(c.titleColor || c.accent),
    });
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 1.3, y: 3.4, w: W - 2.5, h: 1.0,
        fontFace: t.fonts.heading, fontSize: 28, bold: true, color: '1F2937',
      });
    }
    if (isCover && (t.presenter?.name || t.presenter?.affiliation)) {
      drawPresenterBar(s, t, 0.9, H - 1.0, W - 1.8);
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

// ── Document PPTX ──
function drawDocument(s, slide, t, i, W, H, M) {
  const c = t.colors;
  const sectionLabel = (slide.layout || 'SECTION').toUpperCase();
  // 흰 배경
  s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: hex(c.bg) }, line: { color: hex(c.bg) } });
  // 상단 가는 라인
  s.addShape('rect', { x: 0.9, y: 0.85, w: W - 1.8, h: 0.012, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
  // 좌측 반원
  s.addShape('ellipse', { x: -0.55, y: 2.6, w: 1.3, h: 1.3, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
  // 섹션 라벨
  s.addText(`${String(i + 1).padStart(2, '0')} · ${sectionLabel}`, {
    x: 1.1, y: 1.0, w: W - 2.0, h: 0.3,
    fontFace: t.fonts.body, fontSize: 11, bold: true, color: hex(c.accent), charSpacing: 4,
  });
  // 타이틀
  s.addText(slide.title || '', {
    x: 1.1, y: 1.35, w: W - 2.0, h: 0.7,
    fontFace: t.fonts.heading, fontSize: 26, bold: true, color: hex(c.titleColor || c.accent),
  });
  if (slide.subtitle) {
    s.addText(slide.subtitle, {
      x: 1.1, y: 2.05, w: W - 2.0, h: 0.4,
      fontFace: t.fonts.body, fontSize: 13, color: hex(c.sub),
    });
  }
  // 본문 영역
  const bodyTop = 2.6;
  drawBody(s, slide, t, 1.1, bodyTop, W - 2.0, H - bodyTop - 1.2, 'document');
  // 하단 발표자 바
  drawPresenterBar(s, t, 0.9, H - 0.95, W - 1.8);
  s.addText(String(i + 1), { x: W - 0.7, y: H - 0.95, w: 0.5, h: 0.55, fontFace: t.fonts.body, fontSize: 11, color: hex(c.muted), align: 'right', valign: 'middle' });
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
        s.addShape('rect', { x: x0, y, w, h: 0.5, fill: { color: hex(c.accent) }, line: { color: hex(c.accent) } });
        s.addText(it.heading || '', { x: x0 + 0.2, y: y, w: w * 0.65, h: 0.5, fontFace: t.fonts.heading, fontSize: 15, bold: true, color: 'FFFFFF', valign: 'middle' });
        s.addText(it.period || '', { x: x0 + w * 0.65, y: y, w: w * 0.35 - 0.2, h: 0.5, fontFace: t.fonts.body, fontSize: 11, bold: true, color: 'FFFFFF', valign: 'middle', align: 'right' });
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
      const visible = bullets.slice(0, 6);
      const gap = 0.12;
      const rowH = Math.min(0.55, (h - gap * (visible.length - 1)) / visible.length);
      visible.forEach((b, idx) => {
        const y = y0 + idx * (rowH + gap);
        s.addShape('rect', { x: x0, y, w, h: rowH, fill: { color: hex(c.line) }, line: { color: hex(c.line) } });
        s.addText(b, { x: x0 + 0.2, y, w: w - 0.4, h: rowH, fontFace: t.fonts.body, fontSize: 13, color: hex(c.sub), valign: 'middle' });
      });
      return;
    }
    const bulletObjs = bullets.slice(0, 7).map(b => ({ text: b, options: { bullet: { code: variant === 'classic' ? '2014' : '25CF' } } }));
    s.addText(bulletObjs, { x: x0 + 0.2, y: y0, w: w - 0.2, h, fontFace: t.fonts.body, fontSize: 14, color: hex(c.sub), paraSpaceAfter: 8 });
  }
}

function hex(s) {
  return String(s || '#000000').replace('#', '').toUpperCase();
}
