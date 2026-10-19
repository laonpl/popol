/**
 * 경험 요약 슬라이드 템플릿 — shared/summaryDeck.mjs 가 만든 덱(slides)을 1600×900 다크 슬라이드로 그린다.
 * 문구는 덱의 칸(slot.text)만 쓰고, 차트는 사용자가 정리한 수치 그대로 그린다(비율·증가율을 새로 계산해 적지 않음).
 */
import { useState } from 'react';
import './summaryDeck.css';

export const DECK_ACCENTS = [
  { key: 'mint', label: '민트', color: '#4fe3a1' },
  { key: 'green', label: '그린', color: '#22c55e' },
  { key: 'teal', label: '틸', color: '#2dd4bf' },
  { key: 'orange', label: '오렌지', color: '#ff6a2c' },
  { key: 'blue', label: '블루', color: '#5b8cff' },
];
export const accentColor = key => (DECK_ACCENTS.find(a => a.key === key) || DECK_ACCENTS[0]).color;

const KICKERS = { problem: 'Problem', research: 'Background', process: 'Process', solution: 'Solution', result: 'Result' };

const num = value => {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const fmt = value => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);

// 편집 가능한 문구. slot 은 { text } 칸이거나 문자열.
function E({ slot, path, ctx, as: Tag = 'span', className = '', style }) {
  const text = typeof slot === 'string' ? slot : slot?.text || '';
  const target = typeof slot === 'string' ? path : `${path}.text`;
  if (!ctx.editable) return <Tag className={className} style={style}>{text}</Tag>;
  return (
    <Tag
      className={`${className} sd-editable`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
        const value = e.currentTarget.innerText.replace(/\s+/g, ' ').trim();
        if (value !== text) ctx.onEdit(target, value);
      }}
    >{text}</Tag>
  );
}

function Header({ slide, i, ctx, center = false, lead = true }) {
  return (
    <div className={center ? 'sd-center' : ''}>
      <p className="sd-kicker">{KICKERS[slide.type]}</p>
      <E as="h2" className="sd-title" slot={slide.title} path={`slides.${i}.title`} ctx={ctx} />
      {lead && slide.lead?.text && <E as="p" className="sd-lead" slot={slide.lead} path={`slides.${i}.lead`} ctx={ctx} />}
    </div>
  );
}

function Footer({ deck, i }) {
  return (
    <div className="sd-footer">
      <span>{deck.title}</span>
      <span>{String(i + 1).padStart(2, '0')} / {String(deck.slides.length).padStart(2, '0')}</span>
    </div>
  );
}

/* ───────────── 차트 ───────────── */

// 차트 도형은 완성된 SVG 이미지(data URL)로 넣는다 — html2canvas 가 인라인 SVG 를 빠뜨리거나
// CSS 변수·웹폰트를 못 읽는 경우가 있어서. 글자는 전부 이미지 위에 HTML 로 겹친다.
const svgUrl = (w, h, inner) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`)}`;
const SvgImg = ({ w, h, inner, style }) => <img src={svgUrl(w, h, inner)} width={w} height={h} alt="" style={{ display: 'block', position: 'absolute', left: 0, top: 0, ...style }} />;

const centerBox = { display: 'flex', alignItems: 'center', justifyContent: 'center' };

function Label({ children, accent = false }) {
  return <p className={`sd-label ${accent ? 'sd-label-accent' : ''}`}><i className="sd-dot" />{children}</p>;
}

// 단계별 감소 곡선 (레퍼런스: 퍼널 영역 차트 + 가장 많이 빠진 지점 표시)
function FunnelArea({ data, color }) {
  const W = 500, H = 310, top = 54, right = 92, bottom = 44;
  const max = Math.max(...data.map(d => d.value), 1);
  const xs = data.map((_, i) => (i / (data.length - 1)) * (W - right));
  const ys = data.map(d => top + (1 - d.value / max) * (H - top - bottom - 24));
  let drop = 1;
  for (let i = 1; i < data.length; i++) if (data[i - 1].value - data[i].value > data[drop - 1].value - data[drop].value) drop = i;
  const line = xs.map((x, i) => (i === 0 ? `M${x},${ys[i]}` : `C${(xs[i - 1] + x) / 2},${ys[i - 1]} ${(xs[i - 1] + x) / 2},${ys[i]} ${x},${ys[i]}`)).join(' ');
  const base = H - bottom;
  const strong = j => j === drop - 1 || j === drop;
  // 오른쪽 수치 라벨: 강조 구간을 먼저 놓고, 이미 놓인 라벨과 22px 안으로 겹치는 라벨은 생략
  const valueLabels = [];
  [...ys.keys()].sort((a, b) => strong(b) - strong(a)).forEach(i => {
    if (valueLabels.every(k => Math.abs(ys[k] - ys[i]) >= 22)) valueLabels.push(i);
  });
  const inner = `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.55"/><stop offset="1" stop-color="${color}" stop-opacity="0.04"/></linearGradient></defs>`
    + ys.map(y => `<line x1="0" x2="${W - right + 18}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,0.13)" stroke-dasharray="5 6"/>`).join('')
    + `<path d="${line} L${xs.at(-1)},${base} L${xs[0]},${base} Z" fill="url(#f)"/>`
    + xs.slice(1, -1).map((x, i) => `<line x1="${x}" x2="${x}" y1="${ys[i + 1]}" y2="${base}" stroke="rgba(0,0,0,0.55)" stroke-width="2"/>`).join('')
    + `<path d="${line}" fill="none" stroke="${color}" stroke-width="3.5"/>`
    + `<line x1="0" x2="${W - right + 18}" y1="${base}" y2="${base}" stroke="rgba(255,255,255,0.25)"/>`
    + `<circle cx="${xs[drop]}" cy="${ys[drop]}" r="10" fill="#141518" stroke="${color}" stroke-width="4"/>`;
  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <SvgImg w={W} h={H} inner={inner} />
      {valueLabels.map(i => (
        <span key={`v${i}`} style={{ position: 'absolute', left: W - right + 28, top: ys[i] - 13, lineHeight: '26px', fontSize: 17, fontWeight: 700, color: strong(i) ? '#f3f4f6' : '#6b717c' }}>{fmt(data[i].value)}</span>
      ))}
      <span style={{ ...centerBox, position: 'absolute', left: Math.max(0, Math.min(xs[drop] - 66, W - right - 132)), top: ys[drop] - 58, width: 132, height: 38, borderRadius: 12, background: color, color: '#0e1013', fontSize: 16, fontWeight: 800 }}>가장 큰 감소</span>
      {data.map((d, i) => (
        <span key={`l${i}`} style={{
          position: 'absolute', top: H - 32, lineHeight: '26px', fontSize: 16, whiteSpace: 'nowrap',
          left: i === 0 ? 0 : undefined, right: i === data.length - 1 ? right : undefined,
          transform: i > 0 && i < data.length - 1 ? 'translateX(-50%)' : undefined,
          ...(i > 0 && i < data.length - 1 ? { left: xs[i] } : {}),
          fontWeight: strong(i) ? 800 : 600, color: strong(i) ? '#f3f4f6' : '#8a909a',
        }}>{d.label}</span>
      ))}
    </div>
  );
}

// 개선 전·후 막대 (수치는 사용자가 적은 문자열 그대로 표시)
function CompareBars({ data, width = 560 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30, height: '100%', padding: '10px 6px' }}>
      {data.map((c, i) => {
        const b = num(c.before), a = num(c.after), max = Math.max(b ?? 0, a ?? 0, 1);
        const bar = v => Math.max(16, ((v ?? 0) / max) * (width - 190));
        return (
          <div key={i}>
            <p className="sd-cmp-label">{c.label}</p>
            <div className="sd-cmp-row"><span className="sd-cmp-tag">전</span><div className="sd-cmp-bar" style={{ width: bar(b), background: '#474b53' }} /><span className="sd-cmp-val" style={{ color: '#aab0b9' }}>{c.before}</span></div>
            <div className="sd-cmp-row"><span className="sd-cmp-tag" style={{ color: 'var(--sd-accent)' }}>후</span><div className="sd-cmp-bar" style={{ width: bar(a), background: 'var(--sd-accent)' }} /><span className="sd-cmp-val">{c.after}</span></div>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ value, unit, label, color }) {
  const pct = unit === '%' ? Math.max(0, Math.min(100, Number(value) || 0)) : null;
  const R = 92, C = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: 240, height: 240 }}>
      <SvgImg w={240} h={240} inner={`<circle cx="120" cy="120" r="${R}" fill="none" stroke="#3a3d44" stroke-width="26"/>`
        + (pct != null ? `<circle cx="120" cy="120" r="${R}" fill="none" stroke="${color}" stroke-width="26" stroke-dasharray="${(pct / 100) * C} ${C}" transform="rotate(-90 120 120)"/>` : '')} />
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <strong style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmt(value)}{unit}</strong>
        {label && <span style={{ marginTop: 6, fontSize: 15, color: '#9aa0aa', fontWeight: 600, maxWidth: 150, textAlign: 'center', lineHeight: 1.35 }}>{label}</span>}
      </div>
    </div>
  );
}

function HBars({ bars }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 120, flex: 'none', fontSize: 14.5, fontWeight: i === 0 ? 800 : 600, color: i === 0 ? 'var(--sd-accent)' : '#b4b9c1', textAlign: 'right', lineHeight: 1.3 }}>{b.label}</span>
          <div style={{ height: 26, width: `${(b.value / max) * 52}%`, minWidth: 10, borderRadius: 6, background: i === 0 ? 'var(--sd-accent)' : '#e9ebee' }} />
          <span style={{ fontSize: 15, fontWeight: 800 }}>{fmt(b.value)}{b.unit}</span>
        </div>
      ))}
    </div>
  );
}

// 사용자가 올린 결과물 이미지 — 세로면 휴대폰 틀, 가로면 창 틀 (html2canvas 호환을 위해 object-fit 대신 크기 계산)
function ShotFrame({ src, maxW, maxH }) {
  const [size, setSize] = useState(null);
  const portrait = size ? size.h > size.w * 1.15 : false;
  const ratio = size ? size.h / size.w : 0.62;
  const w = portrait ? Math.min(maxW, 300) : maxW;
  const innerH = Math.min(portrait ? maxH - 18 : maxH - 34, w * ratio);
  return (
    <div className={`sd-frame ${portrait ? 'sd-frame-phone' : 'sd-frame-window'}`} style={{ width: w + (portrait ? 18 : 3) }}>
      {!portrait && <div className="sd-frame-bar"><i /><i /><i /></div>}
      <div style={{ width: w, height: innerH || 200, overflow: 'hidden' }}>
        <img src={src} alt="" width={w} onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      </div>
    </div>
  );
}

/* ───────────── 장별 템플릿 ───────────── */

function Cover({ slide, deck, i, ctx, kicker }) {
  return (
    <div className={`sd-slide sd-cover ${slide.kpis?.length ? '' : 'sd-cover-plain'}`}>
      <div className="sd-glow" />
      <p className="sd-kicker" style={{ position: 'relative' }}>{kicker}</p>
      <E as="h1" className="sd-title" slot={slide.title} path={`slides.${i}.title`} ctx={ctx} style={{ position: 'relative' }} />
      {slide.subtitle?.text && <E as="p" className="sd-cover-sub" slot={slide.subtitle} path={`slides.${i}.subtitle`} ctx={ctx} />}
      {slide.meta?.length > 0 && (
        <div className="sd-meta">
          {slide.meta.map((m, j) => (
            <div key={j} className="sd-meta-item"><span>{m.label}</span><E as="strong" slot={m.value} path={`slides.${i}.meta.${j}.value`} ctx={ctx} /></div>
          ))}
        </div>
      )}
      {slide.kpis?.length > 0 && (
        <div className="sd-kpis">
          {slide.kpis.map((k, j) => (
            <div key={j} className="sd-card sd-kpi"><E as="strong" slot={k.value} path={`slides.${i}.kpis.${j}.value`} ctx={ctx} /><E as="span" slot={k.label} path={`slides.${i}.kpis.${j}.label`} ctx={ctx} /></div>
          ))}
        </div>
      )}
      <Footer deck={deck} i={i} />
    </div>
  );
}

function Problem({ slide, deck, i, ctx }) {
  const voices = slide.voices || [];
  const voiceSpan = j => (voices.length === 1 || voices.length === 2 || (voices.length === 3 && j === 2) ? 'sd-span-2' : '');
  return (
    <div className="sd-slide">
      <Header slide={slide} i={i} ctx={ctx} />
      <div className="sd-problem-body" style={{ top: slide.lead?.text ? 330 : 270 }}>
        {slide.chart && (
          <div className="sd-col" style={{ width: 500, flex: 'none' }}>
            <Label>{slide.chart.kind === 'funnel' ? '단계별 변화' : '개선 전후 수치'}</Label>
            <div className="sd-chart-box">
              {slide.chart.kind === 'funnel' ? <FunnelArea data={slide.chart.data} color={ctx.color} /> : <CompareBars data={slide.chart.data} width={480} />}
            </div>
            <E as="div" className="sd-pill" slot={slide.chart.caption} path={`slides.${i}.chart.caption`} ctx={ctx} />
          </div>
        )}
        {slide.statement?.text && (
          <div className="sd-col" style={{ flex: 1 }}>
            <Label>상황</Label>
            <div className="sd-card sd-statement">
              <E as="p" slot={slide.statement} path={`slides.${i}.statement`} ctx={ctx} />
            </div>
          </div>
        )}
        {voices.length > 0 && (
          <div className="sd-col" style={{ flex: 1 }}>
            <Label>직접 확인한 근거</Label>
            <div className="sd-voices">
              {voices.map((v, j) => (
                <div key={j} className={`sd-voice ${voiceSpan(j)}`}>
                  {v.text.kind === 'quote'
                    ? <p className="sd-voice-quote">“<E slot={v.text} path={`slides.${i}.voices.${j}.text`} ctx={ctx} />”</p>
                    : <E as="p" className="sd-voice-text" slot={v.text} path={`slides.${i}.voices.${j}.text`} ctx={ctx} />}
                  <E as="span" className="sd-voice-who" slot={v.who} path={`slides.${i}.voices.${j}.who`} ctx={ctx} />
                </div>
              ))}
            </div>
            {slide.voicesCaption?.text && <E as="div" className="sd-pill" slot={slide.voicesCaption} path={`slides.${i}.voicesCaption`} ctx={ctx} />}
          </div>
        )}
        {slide.hypothesis?.text && (
          <div className="sd-hypo" style={{ marginLeft: 12, width: slide.chart ? 260 : 330 }}>
            <span className="sd-hypo-label">{slide.hypothesisLabel || '가설'}</span>
            <E as="p" className="sd-hypo-text" slot={slide.hypothesis} path={`slides.${i}.hypothesis`} ctx={ctx} />
          </div>
        )}
      </div>
      <Footer deck={deck} i={i} />
    </div>
  );
}

function Research({ slide, deck, i, ctx }) {
  return (
    <div className="sd-slide">
      <Header slide={slide} i={i} ctx={ctx} center lead={false} />
      <div className="sd-research-grid">
        {slide.cards.map((c, j) => (
          <div key={j} className="sd-card sd-rcard">
            <p className="sd-rcard-q">{c.question}</p>
            <div className="sd-rcard-chart">
              {c.chartType === 'bar' && c.bars?.length ? <HBars bars={c.bars} />
                : c.chartType === 'donut' ? <Donut value={c.value} unit={c.unit} label={c.valueLabel} color={ctx.color} />
                  : <div style={{ textAlign: 'center' }}><strong style={{ fontSize: 76, fontWeight: 800, color: 'var(--sd-accent)', letterSpacing: '-0.03em' }}>{fmt(c.value)}{c.unit}</strong>{c.valueLabel && <p style={{ marginTop: 8, fontSize: 17, color: '#9aa0aa', fontWeight: 600 }}>{c.valueLabel}</p>}</div>}
            </div>
            {c.finding?.text && <E as="p" className="sd-rcard-finding" slot={c.finding} path={`slides.${i}.cards.${j}.finding`} ctx={ctx} />}
            <p className="sd-rcard-src">{[c.checkedAt, c.source && `출처: ${c.source}`].filter(Boolean).join(' | ')}</p>
          </div>
        ))}
      </div>
      <Footer deck={deck} i={i} />
    </div>
  );
}

function ProcessPairs({ slide, deck, i, ctx }) {
  return (
    <div className="sd-slide">
      <Header slide={slide} i={i} ctx={ctx} lead={false} />
      <div className="sd-pairs-head"><Label>한 일</Label><span /><Label accent>바뀐 것</Label></div>
      <div className="sd-pairs" style={{ top: 312 }}>
        {slide.pairs.map((p, j) => [
          <div key={`l${j}`} className="sd-pair-l">
            <E as="p" className="sd-pair-title" slot={p.action.title} path={`slides.${i}.pairs.${j}.action.title`} ctx={ctx} />
            {p.action.desc?.text && <E as="p" className="sd-pair-desc" slot={p.action.desc} path={`slides.${i}.pairs.${j}.action.desc`} ctx={ctx} />}
            <span className="sd-pair-no">{String(j + 1).padStart(2, '0')}</span>
          </div>,
          <div key={`c${j}`} className="sd-chev">›</div>,
          <div key={`r${j}`} className="sd-pair-r">
            <E as="p" className="sd-pair-title" slot={p.outcome.title} path={`slides.${i}.pairs.${j}.outcome.title`} ctx={ctx} />
            {p.outcome.desc?.text && p.outcome.desc.text !== p.outcome.title?.text && <E as="p" className="sd-pair-desc" slot={p.outcome.desc} path={`slides.${i}.pairs.${j}.outcome.desc`} ctx={ctx} />}
          </div>,
        ])}
      </div>
      <Footer deck={deck} i={i} />
    </div>
  );
}

function ProcessPyramid({ slide, deck, i, ctx }) {
  const steps = slide.steps;
  const H = 520, W = 640, n = steps.length, band = H / n;
  const half = y => (y / H) * (W / 2);
  return (
    <div className="sd-slide">
      <Header slide={slide} i={i} ctx={ctx} lead={false} />
      <div className="sd-pyramid-wrap">
        {steps.map((s, j) => (
          <div key={j} className="sd-step-row" style={{ top: j * band, height: band }}>
            <span className="sd-step-no">{String(j + 1).padStart(2, '0')}</span>
            <E as="p" className="sd-step-title" slot={s.title} path={`slides.${i}.steps.${j}.title`} ctx={ctx} />
            {s.desc?.text && <E as="p" className="sd-step-desc" slot={s.desc} path={`slides.${i}.steps.${j}.desc`} ctx={ctx} />}
          </div>
        ))}
        <SvgImg w={W} h={H} style={{ left: 'auto', right: 20 }} inner={
          '<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a9adb5"/></linearGradient>'
          + '<linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4e56"/><stop offset="1" stop-color="#1c1e22"/></linearGradient></defs>'
          + steps.map((_, j) => {
            const y0 = j * band, y1 = (j + 1) * band, cx = W / 2;
            return `<polygon points="${cx - half(y0)},${y0} ${cx + half(y0)},${y0} ${cx + half(y1)},${y1} ${cx - half(y1)},${y1}" fill="url(#${j === 0 ? 't' : 'l'})" stroke="#141518" stroke-width="3"/>`;
          }).join('')
        } />
        {steps.map((s, j) => (
          <span key={`t${j}`} style={{
            position: 'absolute', right: 20, width: W, textAlign: 'center', lineHeight: '30px',
            top: j === 0 ? band * 0.6 : j * band + band / 2 - 15,
            fontSize: j === 0 ? 18 : 22, fontWeight: 800, color: j === 0 ? '#16181c' : '#f3f4f6',
          }}>{s.title?.text}</span>
        ))}
      </div>
      <Footer deck={deck} i={i} />
    </div>
  );
}

function ProcessFlow({ slide, deck, i, ctx }) {
  return (
    <div className="sd-slide">
      <Header slide={slide} i={i} ctx={ctx} lead={false} />
      <div className="sd-flow">
        {slide.steps.map((s, j) => (
          <div key={j} className="sd-flow-item">
            {j < slide.steps.length - 1 && <div className="sd-flow-line" />}
            <div className="sd-flow-dot">{String(j + 1).padStart(2, '0')}</div>
            <div className="sd-flow-card">
              <E as="p" className="sd-flow-title" slot={s.title} path={`slides.${i}.steps.${j}.title`} ctx={ctx} />
              {s.desc?.text && <E as="p" className="sd-flow-desc" slot={s.desc} path={`slides.${i}.steps.${j}.desc`} ctx={ctx} />}
            </div>
          </div>
        ))}
      </div>
      <Footer deck={deck} i={i} />
    </div>
  );
}

function Solution({ slide, deck, i, ctx }) {
  const { asIs, toBe } = slide;
  // 덱에는 이미지 번호(재료 이미지 순서)가 저장된다. 예전 덱의 주소 문자열도 그대로 받는다.
  const resolve = ref => (typeof ref === 'number' ? ctx.images?.[ref] : ref) || '';
  const asIsImage = resolve(asIs.image);
  const images = (toBe.images || []).map(resolve).filter(Boolean);
  return (
    <div className="sd-slide sd-solution">
      <div className="sd-asis">
        <span className="sd-tag">AS-IS</span>
        <E as="h3" className="sd-sol-title" slot={asIs.title} path={`slides.${i}.asIs.title`} ctx={ctx} />
        {asIs.desc?.text && <E as="p" className="sd-sol-desc" slot={asIs.desc} path={`slides.${i}.asIs.desc`} ctx={ctx} />}
        {asIsImage && <div style={{ marginTop: 40 }}><ShotFrame src={asIsImage} maxW={368} maxH={430} /></div>}
      </div>
      <div className="sd-tobe">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="sd-tag sd-tag-accent">TO-BE</span>
          <E as="h3" className="sd-sol-title" slot={toBe.title} path={`slides.${i}.toBe.title`} ctx={ctx} />
          {toBe.desc?.text && <E as="p" className="sd-sol-desc" slot={toBe.desc} path={`slides.${i}.toBe.desc`} ctx={ctx} />}
          {toBe.points?.length > 0 && (
            <div className="sd-points">
              {toBe.points.map((p, j) => (
                <div key={j}>
                  <E className="sd-point-tag" slot={p.tag} path={`slides.${i}.toBe.points.${j}.tag`} ctx={ctx} />
                  <E as="p" className="sd-point-text" slot={p.text} path={`slides.${i}.toBe.points.${j}.text`} ctx={ctx} />
                </div>
              ))}
            </div>
          )}
        </div>
        {images.length > 0 && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 24, paddingBottom: 90 }}>
            {images.map((src, j) => <ShotFrame key={j} src={src} maxW={images.length > 1 ? 300 : 460} maxH={640} />)}
          </div>
        )}
      </div>
      <Footer deck={deck} i={i} />
    </div>
  );
}

function Result({ slide, deck, i, ctx }) {
  const hasCompare = slide.compares?.length > 0;
  return (
    <div className="sd-slide">
      <Header slide={slide} i={i} ctx={ctx} lead={false} />
      <div className="sd-result-body" style={{ bottom: slide.learning?.text ? 220 : 96 }}>
        {hasCompare && <div className="sd-card sd-compare"><CompareBars data={slide.compares} width={760} /></div>}
        {slide.kpis?.length > 0 && (
          <div className={hasCompare ? 'sd-kpi-col' : 'sd-kpi-row'}>
            {slide.kpis.map((k, j) => (
              <div key={j} className="sd-card sd-kpi"><E as="strong" slot={k.value} path={`slides.${i}.kpis.${j}.value`} ctx={ctx} /><E as="span" slot={k.label} path={`slides.${i}.kpis.${j}.label`} ctx={ctx} /></div>
            ))}
          </div>
        )}
        {slide.notes?.length > 0 && (
          <div className="sd-notes">
            {slide.notes.map((n, j) => (
              <div key={j} className="sd-card sd-note">
                <E as="span" className="sd-note-label" slot={n.label} path={`slides.${i}.notes.${j}.label`} ctx={ctx} />
                <E as="p" className="sd-note-text" slot={n.text} path={`slides.${i}.notes.${j}.text`} ctx={ctx} />
              </div>
            ))}
          </div>
        )}
      </div>
      {slide.learning?.text && (
        <div className="sd-learning"><b>배운 점</b><E slot={slide.learning} path={`slides.${i}.learning`} ctx={ctx} /></div>
      )}
      <Footer deck={deck} i={i} />
    </div>
  );
}

/**
 * 슬라이드 한 장. accent 는 DECK_ACCENTS 의 key.
 * editable 이면 문구를 바로 고칠 수 있고, 고친 값은 onEdit(경로, 값)으로 올라간다.
 */
export function SummaryDeckSlide({ deck, index, accent, kicker, images = [], editable = false, onEdit }) {
  const slide = deck.slides[index];
  const color = accentColor(accent);
  const ctx = { editable, onEdit, color, images };
  const props = { slide, deck, i: index, ctx };
  let body = null;
  if (slide.type === 'cover') body = <Cover {...props} kicker={kicker} />;
  else if (slide.type === 'problem') body = <Problem {...props} />;
  else if (slide.type === 'research') body = <Research {...props} />;
  else if (slide.type === 'process') body = slide.variant === 'pairs' ? <ProcessPairs {...props} /> : slide.variant === 'pyramid' ? <ProcessPyramid {...props} /> : <ProcessFlow {...props} />;
  else if (slide.type === 'solution') body = <Solution {...props} />;
  else if (slide.type === 'result') body = <Result {...props} />;
  return <div style={{ '--sd-accent': color }}>{body}</div>;
}
