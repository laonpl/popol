// 노션형 포트폴리오 + 업로드 PPT 템플릿 → 합격자 스타일 PPT 컴포저.
//
// 기존 인플레이스(슬롯 채움) 방식과 완전히 독립된 경로:
//  - 업로드한 PPTX 에서 디자인을 추출: ① 팔레트·폰트(디자인 DNA) ② 슬라이드의
//    장식 프레임(상·하단 밴드, 사이드 레일, 라인, 로고/디자인 이미지, 배경)
//  - 슬라이드는 검증된 구성으로 직접 조립하되, 추출한 프레임을 배경으로 깔고
//    프레임이 차지한 영역(인셋)을 피해서 내용을 배치한다.
//  - 지표가 있는 프로젝트는 "스토리(문제→해결)" / "성과·지표(차트)" 두 장으로
//    분리해 한 장에 욱여넣지 않는다.
// 레이아웃을 코드가 소유하므로 빈 박스·내용 누락·텍스트 잘림이 구조적으로 없다.
// AI 미사용·결정론.
import PptxGenJS from 'pptxgenjs';
import { extractDesignDna, parsePptxLayout } from './templateParser.js';
import { isContentPhoto } from './pptxRendererInPlace.js';

const SLIDE_W = 13.333, SLIDE_H = 7.5; // LAYOUT_WIDE (in)

// ── 공통 헬퍼 ────────────────────────────────────────────────────────────
const skillName = (s) => typeof s === 'string' ? s : (s?.name || '');
const nonEmpty = (arr) => Array.isArray(arr) ? arr.filter(Boolean) : [];

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&middot;': '·', '&hellip;': '…',
};
// 노션/에디터에서 흘러온 HTML 흔적 제거 — pptxgenjs 는 HTML 을 해석하지 않으므로
// <br>·<p> 같은 태그가 그대로 글자로 찍힌다. 줄바꿈은 보존, 태그/엔티티는 정리.
function san(s) {
  let t = String(s ?? '');
  t = t.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  t = t.replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n');
  t = t.replace(/<[^>]+>/g, '');                       // 남은 태그 제거
  t = t.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
  t = t.replace(/&[a-z]+;|&#\d+;/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? '');
  // AI/에디터가 남긴 플레이스홀더·주석 흔적 제거
  t = t.replace(/【[^】]*】/g, '');                      // 【XX 공식】 류 출처 마커
  t = t.replace(/\[[^\]]*?(작성|필요|예시|내용|입력|TODO|todo)[^\]]*?\]/g, ''); // [작성 필요] 류 플레이스홀더
  t = t.replace(/\s*※\s*[^\n]*/g, '');                 // ※주석 (줄 끝까지)
  t = t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n');
  // 바로 잇따라 똑같이 반복된 토큰 제거 — "Generation) Generation)", "장벽을 을" 류 AI 중복
  t = t.replace(/(\S+)\s+\1(?=[\s.,)\]}!?。·]|$)/g, '$1');
  return t.trim();
}


// 긴 제목 정리 — "이름 - 설명" 형태면 구분자 앞부분만, 그래도 길면 절 단위로(‘…’ 없이)
function shortTitle(s, max = 46) {
  const t = san(s);
  if (t.length <= max) return t;
  const head = t.split(/\s[-–—:·]\s/)[0].trim();
  if (head && head.length >= 4 && head.length <= max) return head;
  return summarize(t, max);
}

// "12건 → 0건", "8시간 → 10분" → 전/후 수치 (시간 단위는 분으로 환산)
const TIME_FACTOR = { '시간': 60, '분': 1, '초': 1 / 60, '일': 1440, '주': 10080 };
function parseBeforeAfter(metric) {
  if (!metric) return null;
  const m = String(metric).match(/([\d][\d,.]*)\s*([^\s\d→\-]*)\s*(?:→|->|⇒)\s*([\d][\d,.]*)\s*([^\s\d]*)/);
  if (!m) return null;
  const b = parseFloat(m[1].replace(/,/g, ''));
  const a = parseFloat(m[3].replace(/,/g, ''));
  if (!Number.isFinite(b) || !Number.isFinite(a)) return null;
  const bu = m[2] || m[4] || '';
  const au = m[4] || m[2] || '';
  let bv = b, av = a;
  if (bu !== au) {
    if (TIME_FACTOR[bu] && TIME_FACTOR[au]) { bv = b * TIME_FACTOR[bu]; av = a * TIME_FACTOR[au]; }
    else return null;
  }
  return { beforeRaw: `${m[1]}${bu}`, afterRaw: `${m[3]}${au}`, beforeV: bv, afterV: av };
}

// ── 색 유틸 (입출력 '#RRGGBB') ───────────────────────────────────────────
function norm(c, fallback) {
  if (!c) return fallback;
  const m = String(c).trim().replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(m) ? `#${m.toUpperCase()}` : fallback;
}
function luma(h) {
  const m = h.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function mix(a, b, t) {
  const pa = a.replace('#', ''), pb = b.replace('#', '');
  const ch = (i) => Math.round(
    parseInt(pa.slice(i, i + 2), 16) * (1 - t) + parseInt(pb.slice(i, i + 2), 16) * t
  ).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(2)}${ch(4)}`.toUpperCase();
}

// design → 헤더 스타일 매핑. design 이 본문 배치 패밀리(rows/cards/timeline)를
// 정하고, 헤더 스타일도 함께 정해 슬라이드 전체가 한 디자인 시스템으로 보이게 한다.
const HEADER_STYLE = { editorial: 'underline', cards: 'block', timeline: 'sidebar' };

// 업로드 템플릿의 디자인 DNA → 테마 토큰 (pptxgenjs 용 '#' 없는 hex)
// tone: 'calm'(절제) | 'vivid'(액센트 적극) | 'mono'(흑백)
// design: 'editorial'(행 쌓기) | 'cards'(카드 그리드) | 'timeline'(세로 타임라인)
// accentHex: 사용자/AI 가 지정한 포인트 컬러('#RRGGBB') — 있으면 추출 색 대체
function makeTheme(dna, { tone = 'calm', design = 'editorial', emphasis = '', accentHex = '', headerStyle = '', accentBar = 'left', closing = 'dark', cardStyle = 'pill', bodyText = '' } = {}) {
  const bg = norm(dna?.bg, '#FFFFFF');
  const isDark = luma(bg) < 0.5;
  let accent = norm(accentHex, null) || norm(dna?.accent, '#2563EB');
  if (Math.abs(luma(accent) - luma(bg)) < 0.15) {
    // 지정색이 배경과 너무 비슷하면 명도를 밀어 대비 확보
    accent = isDark ? mix(accent, '#FFFFFF', 0.4) : mix(accent, '#000000', 0.35);
    if (Math.abs(luma(accent) - luma(bg)) < 0.12) accent = norm(dna?.accent2, isDark ? '#60A5FA' : '#2563EB');
  }
  let ink = isDark ? '#FFFFFF' : norm(dna?.heading, '#16202C');
  if (Math.abs(luma(ink) - luma(bg)) < 0.45) ink = isDark ? '#FFFFFF' : '#16202C';
  const closeBg = norm(dna?.dark, isDark ? mix(bg, '#000000', 0.35) : '#101826');
  const onAccent = luma(accent) < 0.55 ? '#FFFFFF' : '#16202C';
  const vivid = tone === 'vivid';
  const mono = tone === 'mono';
  // 프리셋이 헤더 스타일을 지정하면 그것을 쓰고, 없으면 design 에서 파생
  const hdrStyle = ['underline', 'block', 'sidebar'].includes(headerStyle)
    ? headerStyle : (HEADER_STYLE[design] || 'underline');

  // mono 는 컬러를 죽이고 잉크 계열만 — 강조는 채움/굵기/대비로
  const eff = mono ? mix(ink, bg, 0.08) : accent;      // 강조선/번호 색
  const effOnEff = mono ? bg : onAccent;
  const accentSoft = mono ? mix(bg, ink, 0.05) : mix(bg, accent, 0.12);
  const accentLine = mono ? mix(ink, bg, 0.78) : mix(bg, accent, 0.4);

  const strip = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.replace('#', '')]));
  return {
    isDark, vivid, mono, design, headerStyle: hdrStyle,
    accentBar: ['left', 'top', 'none'].includes(accentBar) ? accentBar : 'left',
    closingStyle: ['dark', 'light', 'accent'].includes(closing) ? closing : 'dark',
    cardStyle: ['pill', 'bar', 'numbered'].includes(cardStyle) ? cardStyle : 'pill',
    // 글 형태: editorial(문서형)은 흐르는 문단, cards/timeline 은 스캔용 불릿
    bodyText: bodyText === 'prose' || bodyText === 'bullets' ? bodyText : (design === 'editorial' ? 'prose' : 'bullets'),
    emphasis: san(emphasis).slice(0, 80),
    fontH: dna?.fontHeading || 'Pretendard',
    fontB: dna?.fontBody || 'Pretendard',
    ...strip({
      bg, accent: eff, accentRaw: accent, ink,
      body: mix(ink, bg, 0.22),
      sub: mix(ink, bg, 0.45),
      line: mix(ink, bg, 0.86),
      card: mix(bg, ink, 0.04),
      accentSoft, accentLine, onAccent: effOnEff,
      closeBg,
      barBefore: mix(ink, bg, 0.55),
      onClose: '#FFFFFF',
      onCloseSub: mix('#FFFFFF', closeBg, 0.35),
      // 톤별 토큰 — vivid: 채움 강조 / calm: 옅은 강조 / mono: 윤곽선·잉크
      chipFill: vivid ? eff : accentSoft,
      chipText: vivid ? effOnEff : (mono ? ink : eff),
      chipLine: vivid ? eff : accentLine,
      ruleColor: vivid ? eff : ink,
      outcomeFill: vivid ? eff : accentSoft,
      outcomeLine: vivid ? eff : accentLine,
      outcomeText: vivid ? effOnEff : ink,
      outcomeLabel: vivid ? effOnEff : eff,
    }),
  };
}

// ── 템플릿 장식 프레임 추출 ──────────────────────────────────────────────
// 슬라이드의 도형 중 "프레임"(가장자리 밴드·레일·라인·소형 악센트)만 골라
// 배경으로 재사용하고, 본문이 차지하면 안 되는 영역을 인셋으로 기록한다.
// 중앙의 큰 콘텐츠 박스는 버린다(내용과 겹치는 복잡함의 원인).
function classifyDecor(d, W, H, mode) {
  const area = (d.w * d.h) / (W * H);
  const thin = d.h <= H * 0.014 || d.w <= W * 0.014;
  const nearT = d.y <= H * 0.03, nearB = d.y + d.h >= H * 0.97;
  const nearL = d.x <= W * 0.03, nearR = d.x + d.w >= W * 0.97;
  const fullW = d.x <= W * 0.06 && d.x + d.w >= W * 0.94;
  const fullH = d.y <= H * 0.06 && d.y + d.h >= H * 0.94;
  const bandMax = mode === 'cover' ? 0.5 : 0.22;
  const railMax = mode === 'cover' ? 0.42 : 0.18;
  const nearAnyEdge = d.x <= W * 0.08 || d.y <= H * 0.08 || d.x + d.w >= W * 0.92 || d.y + d.h >= H * 0.92;
  // 중심이 가장자리 띠 안에 있는가 — 중앙을 가로지르는 라인/장식은 본문과 겹친다
  const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
  const inEdgeBand = cy <= H * 0.14 || cy >= H * 0.86 || cx <= W * 0.14 || cx >= W * 0.86;

  if (thin) return { keep: inEdgeBand };
  // 소형 악센트는 가장자리에 붙은 것만
  if (area <= 0.04 && nearAnyEdge) return { keep: true };
  if (fullW && nearT && d.h <= H * bandMax) return { keep: true, inset: ['top', d.y + d.h] };
  if (fullW && nearB && d.h <= H * bandMax) return { keep: true, inset: ['bottom', H - d.y] };
  if (fullH && nearL && d.w <= W * railMax) return { keep: true, inset: ['left', d.x + d.w] };
  if (fullH && nearR && d.w <= W * railMax) return { keep: true, inset: ['right', W - d.x] };
  if ((nearT || nearB) && (nearL || nearR) && area <= 0.1) return { keep: true }; // 코너 악센트
  return { keep: false };
}

// 본문이 비켜 가야 하는 프레임 영역의 최대 깊이(인치). 이 값이 작으면 분류기가
// "유지"로 판정한 밴드·레일도 통째로 버려져 템플릿 디자인이 안 보인다. 커버는
// 큰 헤더 밴드·컬러 패널이 디자인의 핵심이라 더 깊게 허용한다.
const INSET_CAP_CONTENT = { top: 1.7, bottom: 1.2, left: 2.0, right: 2.0 };
const INSET_CAP_COVER = { top: 3.4, bottom: 2.6, left: 5.0, right: 5.0 };

function buildFrame(slide, W, H, picUsage, mode) {
  const kx = SLIDE_W / W, ky = SLIDE_H / H;
  const INSET_CAP = mode === 'cover' ? INSET_CAP_COVER : INSET_CAP_CONTENT;
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const shapes = [];
  let dropped = 0;

  for (const d of [...(slide.decor || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))) {
    const cls = classifyDecor(d, W, H, mode);
    if (!cls.keep) { dropped++; continue; }
    if (cls.inset) {
      const [side, vPt] = cls.inset;
      const vIn = side === 'left' || side === 'right' ? vPt * kx : vPt * ky;
      if (vIn > INSET_CAP[side]) { dropped++; continue; } // 과대 밴드는 통째로 버림
      insets[side] = Math.max(insets[side], vIn);
    }
    shapes.push({
      x: d.x * kx, y: d.y * ky, w: Math.max(0.01, d.w * kx), h: Math.max(0.01, d.h * ky),
      fill: norm(d.fill, null),
      lineColor: norm(d.lineColor, null),
      lineWidthPt: d.lineWidthPt || 0,
    });
  }

  // 장식 로고는 디자인 정체성에 중요하지만 위치가 고정돼 본문과 겹치기 쉽다.
  // → 소형 로고만 남기되, 가장 가까운 가장자리에 인셋을 만들어 본문이 그 영역을
  //   비켜 가게 한다(겹침 0). 인셋이 캡을 넘으면(슬라이드 안쪽이면) 버린다.
  const pics = [];
  let bleed = null;
  for (const p of (slide.pics || [])) {
    const areaRatio = (p.w * p.h) / (W * H);
    if (!p.dataUrl) continue;
    if (isContentPhoto({ areaRatio, bytes: p.mediaBytes || 0, usage: p.mediaPath ? (picUsage.get(p.mediaPath) || 1) : 1 })) continue;
    if (areaRatio >= 0.85) { if (mode === 'cover' && (p.mediaBytes || 0) <= 5 * 1024 * 1024) bleed = { dataUrl: p.dataUrl, x: p.x * kx, y: p.y * ky, w: p.w * kx, h: p.h * ky }; continue; }
    if (areaRatio > 0.05 || (p.mediaBytes || 0) > 2 * 1024 * 1024 || pics.length >= 2) continue; // 소형 로고만, 최대 2개
    // 가장 가까운 가장자리 → 그 변에 인셋
    const dT = p.y, dB = H - (p.y + p.h), dL = p.x, dR = W - (p.x + p.w);
    const m = Math.min(dT, dB, dL, dR);
    const [side, vIn] = m === dT ? ['top', (p.y + p.h) * ky]
      : m === dB ? ['bottom', (H - p.y) * ky]
      : m === dL ? ['left', (p.x + p.w) * kx]
      : ['right', (W - p.x) * kx];
    if (vIn > INSET_CAP[side]) continue;               // 너무 안쪽 → 겹침 위험, 버림
    insets[side] = Math.max(insets[side], vIn);
    pics.push({ dataUrl: p.dataUrl, x: p.x * kx, y: p.y * ky, w: p.w * kx, h: p.h * ky });
  }

  return {
    bg: norm(slide.bg, null),
    bleed, shapes, pics, insets,
    score: shapes.length + pics.length * 0.5 - dropped * 1.5,
  };
}

async function extractFrames(templateBuffer) {
  try {
    const layout = await parsePptxLayout(templateBuffer);
    const W = layout.slideSize.widthPt, H = layout.slideSize.heightPt;
    const picUsage = new Map();
    for (const s of layout.slides) {
      for (const p of (s.pics || [])) {
        if (p.mediaPath) picUsage.set(p.mediaPath, (picUsage.get(p.mediaPath) || 0) + 1);
      }
    }
    const cover = layout.slides[0] ? buildFrame(layout.slides[0], W, H, picUsage, 'cover') : null;
    let content = null;
    for (const s of layout.slides.slice(1)) {
      const f = buildFrame(s, W, H, picUsage, 'content');
      if (!content || f.score > content.score) content = f;
    }
    if (!content && layout.slides[0]) content = buildFrame(layout.slides[0], W, H, picUsage, 'content');
    return { cover, content };
  } catch {
    return { cover: null, content: null };
  }
}

function drawFrame(slide, pptx, T, frame) {
  if (!frame) return;
  if (frame.bleed) {
    slide.addImage({ data: frame.bleed.dataUrl, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
    // 풀블리드 이미지 위 텍스트 가독성용 옅은 베일
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: T.bg, transparency: 35 }, line: { type: 'none' } });
  }
  for (const s of frame.shapes) {
    slide.addShape(pptx.ShapeType.rect, {
      x: s.x, y: s.y, w: s.w, h: s.h,
      fill: s.fill ? { color: s.fill.replace('#', '') } : { type: 'none' },
      line: s.lineColor && s.lineWidthPt > 0
        ? { color: s.lineColor.replace('#', ''), width: Math.max(0.5, s.lineWidthPt) }
        : { type: 'none' },
    });
  }
  for (const p of frame.pics) {
    slide.addImage({ data: p.dataUrl, x: p.x, y: p.y, w: p.w, h: p.h });
  }
}

// 프레임 인셋을 반영한 본문 배치 영역
function frameBounds(frame) {
  const ins = frame?.insets || { top: 0, bottom: 0, left: 0, right: 0 };
  const L = Math.max(0.7, ins.left + 0.3);
  const R = Math.max(0.7, ins.right + 0.3);
  const T = Math.max(0.4, ins.top + 0.18);
  const B = Math.min(SLIDE_H - 0.35, SLIDE_H - ins.bottom - 0.18);
  return { L, T, B, W: SLIDE_W - L - R };
}

// 혼합폭 근사 측정(인치) — 한글 1em·라틴 0.56em
function measure(s, fontPt) {
  let w = 0;
  for (const ch of String(s)) w += /[ᄀ-ᇿ⺀-퟿]/.test(ch) ? 1.0 : 0.56;
  return (w * fontPt) / 72;
}

// 박스(w×h, 인치)에 들어가는 [minPt, maxPt] 중 가장 큰 폰트 — 안 들어가면 null
const FIT_FLOOR = 5;
function ptThatFits(t, w, h, maxPt, minPt, lineH) {
  const innerW = Math.max(0.4, w - 0.14);
  const innerH = Math.max(0.18, h - 0.06);
  const explicitLines = (t.match(/\n/g) || []).length;
  for (let pt = maxPt; pt >= minPt; pt -= 0.5) {
    const lines = Math.ceil(measure(t, pt) / innerW) + explicitLines;
    if (lines * (pt / 72) * lineH <= innerH) return pt;
  }
  return null;
}

// 전체 텍스트를 박스에 맞춰 폰트만 줄임 — 절대 자르지 않는다(최후엔 FLOOR 로 전부).
function fitText(text, w, h, opt = {}) {
  const maxPt = opt.maxPt || 13, lineH = opt.lineH || 1.3;
  const t = san(text);
  if (!t) return { text: '', pt: maxPt };
  return { text: t, pt: ptThatFits(t, w, h, maxPt, FIT_FLOOR, lineH) || FIT_FLOOR };
}

// 한 줄 텍스트(제목·라벨 등) — 폭에 맞게 폰트만 줄여 전부 한 줄로(자르지 않음)
function fitLine(text, w, maxPt, minPt = 8) {
  const t = san(text);
  let pt = maxPt;
  while (pt > minPt && measure(t, pt) > w - 0.08) pt -= 0.5;
  return { text: t, pt };
}

// 문장 단위 적정화 — "읽을 수 있는 크기(minPt 이상)"를 유지하면서 박스에 들어가는
// 만큼만 '완전한 문장'으로 보여준다. 문장 중간에서 끊기지 않고(자연스러움),
// 너무 긴 원문은 앞 문장들만 깔끔히(벽 같은 과밀 방지). 한 문장도 안 맞으면 그 문장만 축소.
const SENT_SPLIT = /(?<=[.!?。]|다\.|요\.|음\.|함\.)\s+/;
function fitSentences(text, w, h, opt = {}) {
  const maxPt = opt.maxPt || 13, minPt = opt.minPt || 9, lineH = opt.lineH || 1.35;
  const t = san(text);
  if (!t) return { text: '', pt: maxPt };
  let sents = t.split(SENT_SPLIT).filter(Boolean);
  if (opt.maxSentences) sents = sents.slice(0, opt.maxSentences); // 공간이 남아도 앞 N문장만(과밀 방지)
  for (let n = sents.length; n >= 1; n--) {
    const sub = sents.slice(0, n).join(' ');
    const pt = ptThatFits(sub, w, h, maxPt, minPt, lineH);
    if (pt) return { text: sub, pt };
  }
  return fitText(sents[0] || t, w, h, { maxPt: minPt, lineH });
}

// 본문 텍스트 박스 — 측정해 맞춘 폰트로 렌더(넘침·겹침·잘림 없음).
// condense:true 면 문장 단위로 적정화(읽을 크기 유지, 과밀 방지).
function bodyBox(slide, T, text, box) {
  const fit = box.condense
    ? fitSentences(text, box.w, box.h, { maxPt: box.maxPt, minPt: box.minPt || 9, lineH: box.lineH || 1.35, maxSentences: box.maxSentences })
    : fitText(text, box.w, box.h, { maxPt: box.maxPt, lineH: box.lineH || 1.3 });
  if (!fit.text) return;
  slide.addText(fit.text, {
    x: box.x, y: box.y, w: box.w, h: box.h,
    fontSize: fit.pt, color: box.color || T.body, bold: !!box.bold, italic: !!box.italic,
    align: box.align || 'left', valign: box.valign || 'top', charSpacing: box.charSpacing,
    lineSpacingMultiple: box.lineH || 1.3, margin: 0, fontFace: box.face || T.fontB, wrap: true,
  });
}

// 문단 텍스트 → 글머리(불릿) 항목 배열. 문장 단위로 쪼개 '나열식 한 덩어리'를 막고,
// 앞 max개만(단답형·깔끔). 각 항목은 완전한 문장이라 중간에서 끊기지 않는다.
function toBullets(text, max = 3) {
  const t = san(text);
  if (!t) return [];
  const sents = t.split(SENT_SPLIT).map(s => s.trim()).filter(Boolean);
  return (sents.length ? sents : [t]).slice(0, max);
}

// 글머리(•) 목록 박스 — 측정해 폰트를 맞추고(잘림 없음) 불릿으로 렌더.
function bulletBox(slide, T, items, box) {
  const its = (items || []).filter(Boolean);
  if (!its.length) return;
  const maxPt = box.maxPt || 12, minPt = box.minPt || 8, lineH = box.lineH || 1.28;
  const innerW = Math.max(0.4, box.w - 0.32);          // 불릿 들여쓰기 여유
  const innerH = Math.max(0.18, box.h - 0.06);
  let pt = maxPt;
  for (; pt >= minPt; pt -= 0.5) {
    let lines = 0;
    for (const it of its) lines += Math.max(1, Math.ceil(measure(it, pt) / innerW));
    if (lines * (pt / 72) * lineH + (its.length - 1) * (pt / 72) * 0.4 <= innerH) break;
  }
  pt = Math.max(pt, minPt);
  const runs = its.map(t => ({
    text: t,
    options: { bullet: { code: '2022', indent: 13 }, breakLine: true, paraSpaceAfter: pt * 0.32 },
  }));
  slide.addText(runs, {
    x: box.x, y: box.y, w: box.w, h: box.h, fontSize: pt,
    color: box.color || T.body, bold: !!box.bold,
    align: box.align || 'left', valign: box.valign || 'top',
    lineSpacingMultiple: lineH, margin: 0, fontFace: box.face || T.fontB, wrap: true,
  });
}

// 칩(알약) 나열 — 줄바꿈 포함, 마지막 y 반환
function drawChips(slide, pptx, T, items, x, y, maxW, opt = {}) {
  const fs = opt.fontSize || 9.5;
  const h = opt.h || 0.3;
  const gap = 0.09;
  let cx = x, cy = y;
  for (const raw of items) {
    const it = san(raw);
    if (!it) continue;                                  // 플레이스홀더가 정리돼 빈 칩이 되면 건너뜀
    // 자르지 않는다 — maxW 를 넘으면 칩 폰트만 줄여 전부 들어가게
    let fsi = fs;
    while (fsi > 6 && measure(it, fsi) + 0.3 > maxW) fsi -= 0.5;
    const w = Math.min(maxW, measure(it, fsi) + 0.3);
    if (cx + w > x + maxW + 0.01) { cx = x; cy += h + gap; }
    slide.addShape(pptx.ShapeType.roundRect, {
      x: cx, y: cy, w, h, rectRadius: h / 2,
      fill: { color: T.chipFill }, line: { color: T.chipLine, width: 0.75 },
    });
    slide.addText(it, {
      x: cx, y: cy - 0.015, w, h: h + 0.03, fontSize: fsi, bold: true, color: T.chipText,
      fontFace: T.fontB, align: 'center', valign: 'middle', margin: 0, wrap: false,
    });
    cx += w + gap;
  }
  return cy + h;
}

// 섹션 헤더 — 테마에 따라 완전히 다른 스타일. 본문 시작 y 반환.
function sectionHeader(slide, pptx, T, B, no, ko, en) {
  const y = B.T;
  if (T.headerStyle === 'sidebar') {
    // 좌측 컬러 탭(번호) + 우측 제목/영문 — 좌앵커 사이드바 느낌, 밑줄 없음
    slide.addShape(pptx.ShapeType.roundRect, { x: B.L, y, w: 0.78, h: 0.78, rectRadius: 0.1, fill: { color: T.accent }, line: { type: 'none' } });
    slide.addText(no, { x: B.L, y: y + 0.02, w: 0.78, h: 0.74, fontSize: 22, bold: true, color: T.onAccent, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontH });
    slide.addText(ko, { x: B.L + 1.0, y: y - 0.02, w: B.W - 1.0, h: 0.5, fontSize: 21, bold: true, color: T.ink, margin: 0, fontFace: T.fontH });
    slide.addText(en.toUpperCase(), { x: B.L + 1.02, y: y + 0.48, w: B.W - 1.0, h: 0.3, fontSize: 9.5, bold: true, color: T.sub, charSpacing: 3, margin: 0, fontFace: T.fontB });
    return y + 1.05;
  }
  if (T.headerStyle === 'block') {
    // 제목을 액센트 블록 안에 — 대담한 매거진 헤더
    const bw = Math.min(B.W, measure(ko, 21) + 1.4);
    slide.addShape(pptx.ShapeType.roundRect, { x: B.L, y, w: bw, h: 0.66, rectRadius: 0.08, fill: { color: T.accent }, line: { type: 'none' } });
    slide.addText(`${no}  ${ko}`, { x: B.L + 0.22, y: y - 0.02, w: bw - 0.3, h: 0.7, fontSize: 19, bold: true, color: T.onAccent, valign: 'middle', margin: 0, fontFace: T.fontH });
    slide.addText(en.toUpperCase(), { x: B.L + bw + 0.25, y: y + 0.02, w: B.W - bw - 0.25, h: 0.66, fontSize: 9.5, bold: true, color: T.sub, align: 'left', valign: 'middle', charSpacing: 3, margin: 0, fontFace: T.fontB });
    return y + 1.0;
  }
  // 기본 underline: 번호 + 제목 + 영문 + 굵은 밑줄
  slide.addText(no, { x: B.L, y, w: 0.65, h: 0.45, fontSize: 16, bold: true, color: T.accent, fontFace: T.fontH });
  slide.addText(ko, { x: B.L + 0.6, y: y - 0.04, w: B.W - 4.6, h: 0.52, fontSize: 21, bold: true, color: T.ink, fontFace: T.fontH });
  slide.addText(en.toUpperCase(), { x: B.L + B.W - 4.0, y: y + 0.08, w: 4.0, h: 0.35, fontSize: 9.5, bold: true, color: T.sub, align: 'right', charSpacing: 3, fontFace: T.fontB });
  slide.addShape(pptx.ShapeType.rect, { x: B.L, y: y + 0.6, w: B.W, h: 0.025, fill: { color: T.ruleColor }, line: { type: 'none' } });
  return y + 0.95;
}

function newSlide(pptx, T, frame) {
  const slide = pptx.addSlide();
  slide.background = { color: (frame?.bg && frame.bg.replace('#', '')) || T.bg };
  drawFrame(slide, pptx, T, frame);
  // 템플릿 프레임이 없을 때만 기본 액센트 바를 그린다 (위치는 프리셋이 정함)
  if ((!frame || (!frame.shapes.length && !frame.pics.length && !frame.bleed)) && T.accentBar !== 'none') {
    if (T.accentBar === 'top') {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: 0.12, fill: { color: T.accent }, line: { type: 'none' } });
    } else {
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: SLIDE_H, fill: { color: T.accent }, line: { type: 'none' } });
    }
  }
  return slide;
}

// ── 슬라이드 빌더 ────────────────────────────────────────────────────────

function coverContactBand(slide, pptx, T, p, L, W, yLine) {
  const contact = p.contact || {};
  const items = [
    contact.email && ['EMAIL', contact.email],
    contact.phone && ['PHONE', contact.phone],
    contact.github && ['GITHUB', contact.github],
    contact.linkedin && ['LINKEDIN', contact.linkedin],
    contact.website && ['WEB', contact.website],
  ].filter(Boolean);
  if (!items.length) return;
  slide.addShape(pptx.ShapeType.rect, { x: L, y: yLine, w: W, h: 0.014, fill: { color: T.line }, line: { type: 'none' } });
  const runs = [];
  items.forEach(([k, v], i) => {
    runs.push({ text: `${i ? '      ' : ''}${k}  `, options: { bold: true, color: T.accent, fontSize: 8.5, fontFace: T.fontB } });
    runs.push({ text: String(v), options: { color: T.body, fontSize: 10, fontFace: T.fontB } });
  });
  slide.addText(runs, { x: L, y: yLine + 0.12, w: W, h: 0.4, valign: 'middle', fit: 'shrink' });
}

function coverTargetPill(slide, pptx, T, p, L, maxW, y) {
  let target = san([p.targetCompany, p.targetPosition].filter(Boolean).join(' · '));
  target = target.replace(/[\s·\-–—]+$/, '');          // 주석 제거 후 남은 꼬리 구분자 정리
  if (!target) return false;
  // 알약 폭 안에서 한 줄로 들어가도록 측정해 잘라(폭 넘침·줄바꿈 방지, '…' 없이)
  const textW = Math.min(maxW, 8.2) - 1.35;
  while (target.length > 6 && measure(target, 11) > textW) target = target.slice(0, -1).trimEnd();
  const tw = Math.min(maxW, measure(target, 11) + 1.35);
  slide.addShape(pptx.ShapeType.roundRect, { x: L, y, w: tw, h: 0.42, rectRadius: 0.21, fill: { color: T.accentSoft }, line: { color: T.accentLine, width: 0.75 } });
  slide.addShape(pptx.ShapeType.roundRect, { x: L + 0.08, y: y + 0.07, w: 0.85, h: 0.28, rectRadius: 0.14, fill: { color: T.accent }, line: { type: 'none' } });
  slide.addText('TARGET', { x: L + 0.08, y: y + 0.06, w: 0.85, h: 0.3, fontSize: 8, bold: true, color: T.onAccent, align: 'center', valign: 'middle', charSpacing: 1.5, margin: 0, fontFace: T.fontB });
  slide.addText(target, { x: L + 1.0, y: y - 0.02, w: tw - 1.0, h: 0.46, fontSize: 11, bold: true, color: T.ink, valign: 'middle', margin: 0, wrap: false, fontFace: T.fontB });
  return true;
}

// coverStyle: 'impact'(큰 이름·카피) | 'profile'(우측 정보 카드) | 'split'(좌측 컬러 패널) | 'banner'(상단 컬러 밴드)
function addCover(pptx, T, F, p, coverStyle = 'impact') {
  const name = p.userName || p.title || '포트폴리오';
  const allSkills = [
    ...nonEmpty(p.skills?.languages), ...nonEmpty(p.skills?.frameworks),
    ...nonEmpty(p.skills?.tools), ...nonEmpty(p.skills?.others),
  ].map(skillName).filter(Boolean);
  const now = new Date();
  const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── split: 좌측 다크 패널(이름·카피) + 우측 기술·연락처 ──
  if (coverStyle === 'split') {
    const slide = pptx.addSlide();
    slide.background = { color: T.bg };
    const panelW = 5.4;
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: panelW, h: SLIDE_H, fill: { color: T.closeBg }, line: { type: 'none' } });
    slide.addShape(pptx.ShapeType.rect, { x: panelW, y: 0, w: 0.08, h: SLIDE_H, fill: { color: T.accent }, line: { type: 'none' } });
    const px = 0.7, pw = panelW - 1.1;
    slide.addText('PORTFOLIO', { x: px, y: 0.7, w: pw, h: 0.35, fontSize: 11, bold: true, color: T.onClose, charSpacing: 5, fontFace: T.fontH });
    let y = 2.0;
    const target = san([p.targetCompany, p.targetPosition].filter(Boolean).join(' · ')).replace(/[\s·\-–—…]+$/, '');
    if (target) {
      bodyBox(slide, T, target.toUpperCase(), { x: px, y, w: pw, h: 0.5, maxPt: 10, bold: true, color: T.accentRaw === T.bg ? T.onClose : T.accent, charSpacing: 2, lineH: 1.15 });
      y += 0.5;
    }
    bodyBox(slide, T, name, { x: px, y, w: pw, h: 1.0, maxPt: 40, bold: true, color: T.onClose, face: T.fontH });
    y += 1.05;
    if (p.nameEn) { slide.addText(p.nameEn, { x: px, y, w: pw, h: 0.35, fontSize: 13, color: T.onCloseSub, fontFace: T.fontB }); y += 0.5; }
    if (p.headline) {
      slide.addShape(pptx.ShapeType.rect, { x: px, y: y + 0.05, w: 0.5, h: 0.045, fill: { color: T.accent }, line: { type: 'none' } });
      bodyBox(slide, T, p.headline, { x: px, y: y + 0.2, w: pw, h: 1.1, maxPt: 13.5, color: T.onClose, lineH: 1.4 });
    }
    if (T.emphasis) {
      bodyBox(slide, T, `“${T.emphasis}”`, { x: px, y: SLIDE_H - 1.0, w: pw, h: 0.6, maxPt: 11, italic: true, color: T.onCloseSub });
    }
    // 우측
    const rx = panelW + 0.6, rw = SLIDE_W - rx - 0.6;
    slide.addText(stamp, { x: rx, y: 0.7, w: rw, h: 0.3, fontSize: 10, color: T.sub, align: 'right', charSpacing: 2, fontFace: T.fontB });
    let ry = 2.0;
    if (allSkills.length) {
      slide.addText('TECH STACK', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 9, bold: true, color: T.accent, charSpacing: 2.5, fontFace: T.fontB });
      ry = drawChips(slide, pptx, T, allSkills.slice(0, 10), rx, ry + 0.35, rw, { fontSize: 10, h: 0.34 }) + 0.5;
    }
    const edu = nonEmpty(p.education)[0];
    if (edu) {
      slide.addText('EDUCATION', { x: rx, y: ry, w: rw, h: 0.3, fontSize: 9, bold: true, color: T.accent, charSpacing: 2.5, fontFace: T.fontB });
      bodyBox(slide, T, `${edu.school || edu.name || ''} ${edu.major || edu.degree || ''}`.trim(), { x: rx, y: ry + 0.32, w: rw, h: 0.34, maxPt: 12, bold: true, color: T.ink });
      ry += 0.85;
    }
    coverContactBand(slide, pptx, T, p, rx, rw, SLIDE_H - 1.0);
    return;
  }

  // ── banner: 상단 컬러 밴드(이름) + 하단 흰 영역(카피·기술·연락처) ──
  if (coverStyle === 'banner') {
    const slide = pptx.addSlide();
    slide.background = { color: T.bg };
    const bandH = 2.9;
    const bandFill = T.mono ? T.closeBg : T.accentRaw;
    const onBand = T.mono ? T.onClose : T.onAccent;
    const onBandSub = T.mono ? T.onCloseSub : mix(`#${bandFill}`, `#${onBand}`, 0.35).replace('#', '');
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SLIDE_W, h: bandH, fill: { color: bandFill }, line: { type: 'none' } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: bandH, w: SLIDE_W, h: 0.07, fill: { color: T.ink }, line: { type: 'none' } });
    const px = 0.9, pw = SLIDE_W - 1.8;
    slide.addText('PORTFOLIO', { x: px, y: 0.55, w: pw, h: 0.35, fontSize: 11, bold: true, color: onBand, charSpacing: 6, fontFace: T.fontH });
    slide.addText(stamp, { x: px, y: 0.55, w: pw, h: 0.35, fontSize: 10, color: onBandSub, align: 'right', charSpacing: 2, fontFace: T.fontB });
    const target = san([p.targetCompany, p.targetPosition].filter(Boolean).join(' · ')).replace(/[\s·\-–—…]+$/, '');
    if (target) { const tl = fitLine(target.toUpperCase(), pw, 10); slide.addText(tl.text, { x: px, y: 1.05, w: pw, h: 0.3, fontSize: tl.pt, bold: true, color: onBandSub, charSpacing: 2, wrap: false, fontFace: T.fontB }); }
    slide.addText([
      { text: name, options: { fontSize: 42, bold: true, color: onBand, fontFace: T.fontH } },
      ...(p.nameEn ? [{ text: `   ${p.nameEn}`, options: { fontSize: 14, bold: true, color: onBandSub, fontFace: T.fontB } }] : []),
    ], { x: px - 0.04, y: 1.45, w: pw, h: 1.05, valign: 'middle', fit: 'shrink' });

    let y = bandH + 0.5;
    if (p.headline) {
      slide.addShape(pptx.ShapeType.rect, { x: px, y: y + 0.06, w: 0.5, h: 0.05, fill: { color: T.accent }, line: { type: 'none' } });
      bodyBox(slide, T, p.headline, { x: px, y: y + 0.2, w: pw, h: 0.8, maxPt: 15, bold: true, color: T.vivid ? T.accent : T.body, lineH: 1.35 });
      y += 1.05;
    }
    if (T.emphasis) {
      bodyBox(slide, T, `“${T.emphasis}”`, { x: px, y, w: pw, h: 0.4, maxPt: 12, italic: true, color: T.sub });
      y += 0.5;
    }
    if (allSkills.length) drawChips(slide, pptx, T, allSkills.slice(0, 8), px, y + 0.05, pw, { fontSize: 10, h: 0.34 });
    coverContactBand(slide, pptx, T, p, px, pw, SLIDE_H - 0.6);
    return;
  }

  const slide = newSlide(pptx, T, F.cover);
  const B = frameBounds(F.cover);
  const L = Math.min(B.L, 2.5);

  slide.addText('PORTFOLIO', { x: L, y: B.T + 0.05, w: 4, h: 0.35, fontSize: 12, bold: true, color: T.ink, charSpacing: 6, fontFace: T.fontH });
  slide.addText(stamp, { x: L + B.W - 2.0, y: B.T + 0.05, w: 2.0, h: 0.35, fontSize: 10, color: T.sub, align: 'right', charSpacing: 2, fontFace: T.fontB });

  if (coverStyle === 'profile') {
    // ── 프로필형: 좌측 이름·헤드라인, 우측 정보 카드 ──
    const cardW = Math.max(3.6, B.W * 0.40);
    const cardX = L + B.W - cardW;
    const leftW = B.W - cardW - 0.5;

    let y = Math.max(1.8, B.T + 1.15);
    if (coverTargetPill(slide, pptx, T, p, L, leftW, y)) y += 0.8;
    slide.addText([
      { text: name, options: { fontSize: 36, bold: true, color: T.ink, fontFace: T.fontH } },
      ...(p.nameEn ? [{ text: `  ${p.nameEn}`, options: { fontSize: 13, bold: true, color: T.sub, fontFace: T.fontB } }] : []),
    ], { x: L - 0.04, y, w: leftW, h: 0.85, valign: 'middle', fit: 'shrink' });
    y += 1.0;
    if (p.headline) {
      bodyBox(slide, T, p.headline, { x: L, y, w: leftW, h: 1.0, maxPt: 14, color: T.body, lineH: 1.35 });
      y += 1.1;
    }
    if (T.emphasis) {
      bodyBox(slide, T, `“${T.emphasis}”`, { x: L, y, w: leftW, h: 0.7, maxPt: 11.5, italic: true, color: T.sub, lineH: 1.3 });
    }

    // 우측 정보 카드
    const cy0 = Math.max(1.55, B.T + 0.9);
    const cardH = Math.min(4.6, B.B - 0.85 - cy0);
    slide.addShape(pptx.ShapeType.roundRect, { x: cardX, y: cy0, w: cardW, h: cardH, rectRadius: 0.12, fill: { color: T.card }, line: { color: T.line, width: 1 } });
    let cy = cy0 + 0.25;
    const pad = 0.3;
    const label = (t) => {
      slide.addText(t, { x: cardX + pad, y: cy, w: cardW - pad * 2, h: 0.24, fontSize: 8.5, bold: true, color: T.accent, charSpacing: 2, margin: 0, fontFace: T.fontB });
      cy += 0.3;
    };
    if (allSkills.length) {
      label('TECH STACK');
      cy = drawChips(slide, pptx, T, allSkills.slice(0, 8), cardX + pad, cy, cardW - pad * 2, { fontSize: 8.5, h: 0.27 }) + 0.22;
    }
    const edu = nonEmpty(p.education)[0];
    if (edu && cy < cy0 + cardH - 0.7) {
      label('EDUCATION');
      bodyBox(slide, T, `${edu.school || edu.name || ''} ${edu.major || edu.degree || ''}`.trim(), { x: cardX + pad, y: cy, w: cardW - pad * 2, h: 0.3, maxPt: 10.5, bold: true, color: T.ink });
      cy += 0.32;
      if (edu.period) {
        slide.addText(edu.period, { x: cardX + pad, y: cy, w: cardW - pad * 2, h: 0.24, fontSize: 9, color: T.sub, margin: 0, fontFace: T.fontB });
        cy += 0.34;
      }
    }
    const award = nonEmpty(p.awards)[0];
    if (award && cy < cy0 + cardH - 0.6) {
      label('AWARD');
      bodyBox(slide, T, award.title || '', { x: cardX + pad, y: cy, w: cardW - pad * 2, h: 0.3, maxPt: 10.5, bold: true, color: T.ink });
    }
  } else {
    // ── 임팩트형: 큰 이름 + 한 줄 카피 ──
    let y = Math.max(1.95, B.T + 1.3);
    if (coverTargetPill(slide, pptx, T, p, L, B.W, y)) y += 0.85;
    slide.addText([
      { text: name, options: { fontSize: 44, bold: true, color: T.ink, fontFace: T.fontH } },
      ...(p.nameEn ? [{ text: `   ${p.nameEn}`, options: { fontSize: 15, bold: true, color: T.sub, fontFace: T.fontB } }] : []),
    ], { x: L - 0.04, y, w: B.W, h: 0.95, valign: 'middle', fit: 'shrink' });
    y += 1.15;
    if (p.headline) {
      slide.addShape(pptx.ShapeType.rect, { x: L + 0.02, y: y + 0.06, w: 0.055, h: 0.62, fill: { color: T.accent }, line: { type: 'none' } });
      bodyBox(slide, T, p.headline, { x: L + 0.25, y, w: B.W - 0.6, h: 0.75, maxPt: 16, bold: true, color: T.vivid ? T.accent : T.body, valign: 'middle' });
      y += 1.05;
    }
    if (T.emphasis) {
      bodyBox(slide, T, `“${T.emphasis}”`, { x: L + 0.02, y, w: B.W - 0.4, h: 0.4, maxPt: 12, italic: true, color: T.sub });
      y += 0.55;
    }
    if (allSkills.length) drawChips(slide, pptx, T, allSkills.slice(0, 8), L + 0.02, y + 0.1, B.W - 0.4, { fontSize: 10, h: 0.34 });
  }

  coverContactBand(slide, pptx, T, p, L, B.W, B.B - 0.55);
}

function addIntro(pptx, T, F, p, no) {
  const keywords = [
    ...nonEmpty(p.values).map(v => v.keyword || v.title),
    ...nonEmpty(p.interests).map(skillName),
  ].filter(Boolean);
  if (!p.headline && !p.valuesEssay && !keywords.length) return false;
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  let y = sectionHeader(slide, pptx, T, B, no, '소개', 'About');
  if (p.headline) {
    bodyBox(slide, T, `“${san(p.headline)}”`, { x: B.L, y, w: B.W, h: 1.0, maxPt: 24, bold: true, color: T.ink, face: T.fontH, lineH: 1.2 });
    y += 1.3;
  }
  if (p.valuesEssay) {
    bodyBox(slide, T, p.valuesEssay, { x: B.L, y, w: B.W - 1.0, h: 1.4, color: T.body, maxPt: 14, lineH: 1.45, condense: true });
    y += 1.65;
  }
  const values = nonEmpty(p.values).map(v => ({ kw: v.keyword || v.title || '', desc: v.description || '' })).filter(v => v.kw);
  if (T.design === 'cards' && values.length) {
    // 가치관 카드 그리드
    const n = Math.min(values.length, 3), gap = 0.3, cw = (B.W - gap * (n - 1)) / n;
    const ch = Math.min(2.0, B.B - y - 0.1);
    values.slice(0, n).forEach((v, i) => {
      const x = B.L + i * (cw + gap);
      slide.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: ch, rectRadius: 0.1, fill: { color: T.card }, line: { color: T.line, width: 0.75 } });
      slide.addText(`0${i + 1}`, { x: x + 0.24, y: y + 0.2, w: cw - 0.48, h: 0.4, fontSize: 16, bold: true, color: T.accent, margin: 0, fontFace: T.fontH });
      bodyBox(slide, T, v.kw, { x: x + 0.24, y: y + 0.64, w: cw - 0.48, h: 0.5, maxPt: 14, bold: true, color: T.ink, face: T.fontH, lineH: 1.1 });
      if (v.desc) bodyBox(slide, T, v.desc, { x: x + 0.24, y: y + 1.2, w: cw - 0.48, h: ch - 1.35, color: T.sub, maxPt: 11 });
    });
  } else if (T.design === 'timeline' && values.length) {
    // 가치관 가로 스텝
    const n = Math.min(values.length, 4), gap = (B.W - n * 1.4) / Math.max(1, n - 1);
    values.slice(0, n).forEach((v, i) => {
      const x = B.L + i * (1.4 + Math.max(0.3, gap));
      slide.addShape(pptx.ShapeType.ellipse, { x, y, w: 0.4, h: 0.4, fill: { color: T.accent }, line: { type: 'none' } });
      slide.addText(String(i + 1), { x, y: y - 0.01, w: 0.4, h: 0.42, fontSize: 12, bold: true, color: T.onAccent, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontB });
      bodyBox(slide, T, v.kw, { x: x - 0.3, y: y + 0.5, w: 2.0, h: 0.5, maxPt: 12, bold: true, color: T.ink, align: 'center', lineH: 1.1 });
    });
  } else if (keywords.length) {
    drawChips(slide, pptx, T, keywords.slice(0, 8), B.L, y + 0.1, B.W, { fontSize: 11, h: 0.4 });
  }
  return true;
}

function skillCategoryRows(p) {
  const skills = p.skills || {};
  const CATEGORY = { languages: '언어', frameworks: '프레임워크 · 라이브러리', tools: '도구 · 인프라', others: '기타' };
  return Object.entries(skills)
    .map(([cat, items]) => [CATEGORY[cat] || cat, nonEmpty(items).map(skillName).filter(Boolean)])
    .filter(([, items]) => items.length);
}

function drawSkillTable(slide, T, rows, x, y, w, opt = {}) {
  const tableRows = rows.map(([cat, items]) => ([
    { text: cat, options: { bold: true, color: T.ink, fill: { color: T.card }, fontSize: opt.fontSize || 12, valign: 'middle' } },
    { text: items.join('   ·   '), options: { color: T.body, fontSize: opt.fontSize || 12, valign: 'middle' } },
  ]));
  slide.addTable(tableRows, {
    x, y, w, colW: [3.0, w - 3.0],
    border: { type: 'solid', color: T.line, pt: 0.75 },
    rowH: opt.rowH || 0.66, margin: 0.14, fontFace: T.fontB,
  });
}

// 기술 — 디자인별 배치: editorial=표 / cards=카테고리 카드 그리드 / timeline=트랙
function drawSkills(slide, pptx, T, rows, B, top) {
  if (T.design === 'cards') {
    const cols = 2, gap = 0.4;
    const cw = (B.W - gap) / cols;
    const nRows = Math.ceil(rows.length / cols);
    const rh = Math.min(1.9, (B.B - top - (nRows - 1) * 0.3) / nRows);
    rows.forEach(([cat, items], i) => {
      const cx = B.L + (i % cols) * (cw + gap);
      const cy = top + Math.floor(i / cols) * (rh + 0.3);
      slide.addShape(pptx.ShapeType.roundRect, { x: cx, y: cy, w: cw, h: rh, rectRadius: 0.1, fill: { color: T.card }, line: { color: T.line, width: 0.75 } });
      slide.addShape(pptx.ShapeType.rect, { x: cx, y: cy + 0.22, w: 0.06, h: 0.34, fill: { color: T.accent }, line: { type: 'none' } });
      bodyBox(slide, T, cat, { x: cx + 0.26, y: cy + 0.2, w: cw - 0.4, h: 0.38, maxPt: 12.5, bold: true, color: T.ink, valign: 'middle', face: T.fontH, lineH: 1.05 });
      drawChips(slide, pptx, T, items, cx + 0.26, cy + 0.72, cw - 0.5, { fontSize: 10, h: 0.32 });
    });
    return;
  }
  if (T.design === 'timeline') {
    const slot = Math.min(1.0, (B.B - top) / rows.length);
    rows.forEach(([cat, items], i) => {
      const ty = top + i * slot;
      slide.addShape(pptx.ShapeType.ellipse, { x: B.L, y: ty + 0.04, w: 0.26, h: 0.26, fill: { color: T.accent }, line: { type: 'none' } });
      if (i < rows.length - 1) slide.addShape(pptx.ShapeType.rect, { x: B.L + 0.117, y: ty + 0.3, w: 0.026, h: slot - 0.28, fill: { color: T.accentLine }, line: { type: 'none' } });
      bodyBox(slide, T, cat, { x: B.L + 0.5, y: ty, w: 3.4, h: 0.36, maxPt: 12.5, bold: true, color: T.ink, valign: 'middle', face: T.fontH, lineH: 1.05 });
      drawChips(slide, pptx, T, items, B.L + 4.0, ty + 0.02, B.W - 4.0, { fontSize: 10, h: 0.32 });
    });
    return;
  }
  drawSkillTable(slide, T, rows, B.L, top, B.W);
}

function addSkills(pptx, T, F, p, no) {
  const rows = skillCategoryRows(p);
  if (!rows.length) return false;
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  const y = sectionHeader(slide, pptx, T, B, no, '기술 역량', 'Skills');
  drawSkills(slide, pptx, T, rows, B, y + 0.1);
  return true;
}

// [compact 구성] 소개 + 기술을 한 장으로 — 짧은 제출용 덱
function addIntroSkillsCombined(pptx, T, F, p, no) {
  const rows = skillCategoryRows(p);
  const keywords = [
    ...nonEmpty(p.values).map(v => v.keyword || v.title),
    ...nonEmpty(p.interests).map(skillName),
  ].filter(Boolean);
  const hasIntro = p.headline || p.valuesEssay || keywords.length;
  if (!hasIntro && !rows.length) return false;
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  let y = sectionHeader(slide, pptx, T, B, no, '소개 & 기술', 'Profile');
  if (p.headline) {
    bodyBox(slide, T, `“${san(p.headline)}”`, { x: B.L, y, w: B.W, h: 0.7, maxPt: 19, bold: true, color: T.ink, face: T.fontH, lineH: 1.15 });
    y += 0.85;
  }
  if (p.valuesEssay) {
    bodyBox(slide, T, p.valuesEssay, { x: B.L, y, w: B.W - 0.5, h: 0.7, color: T.body, maxPt: 12, lineH: 1.3, condense: true });
    y += 0.85;
  }
  if (keywords.length) {
    y = drawChips(slide, pptx, T, keywords.slice(0, 8), B.L, y, B.W, { fontSize: 9.5, h: 0.32 }) + 0.3;
  }
  if (rows.length && y < B.B - 1.2) {
    drawSkillTable(slide, T, rows, B.L, y, B.W, { fontSize: 10.5, rowH: 0.5 });
  }
  return true;
}

// [metrics 구성] 핵심 성과 하이라이트 — 지표가 있으면 정량 차트 그리드,
// 없으면 각 프로젝트의 성과 문장을 카드로(지표 없는 포트폴리오도 성과 선행 흐름 유지)
function addHighlights(pptx, T, F, p, no) {
  const metricsAll = [];
  const outcomes = [];
  for (const e of nonEmpty(p.experiences)) {
    const sr = e.structuredResult || {};
    for (const k of nonEmpty(sr.keyExperiences)) {
      metricsAll.push({ ...k, metricLabel: [k.metricLabel || k.title, shortTitle(e.title || '', 20)].filter(Boolean).join(' · ') });
    }
    const out = sr.output || e.description;
    if (out) outcomes.push({ title: e.title || '프로젝트', text: out });
  }
  const useMetrics = metricsAll.length >= 2;
  if (!useMetrics && outcomes.length < 1) return false;

  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  let y = sectionHeader(slide, pptx, T, B, no, '핵심 성과', 'Highlights');
  slide.addText(useMetrics ? '프로젝트 전반의 정량 성과 요약' : '프로젝트별 핵심 성과', { x: B.L, y, w: B.W, h: 0.3, fontSize: 11, color: T.sub, fontFace: T.fontB });
  y += 0.45;

  if (useMetrics) {
    const qualitative = metricsAll.some(k => {
      const rv = san(k.metric || k.result || '');
      return !parseBeforeAfter(k.metric) && !(rv.length <= 14 && /[0-9]/.test(rv));
    });
    metricsSection(slide, pptx, T, B, metricsAll, qualitative, y, false); // 상단 부제가 라벨 역할
  } else {
    // 성과 문장 카드 — 프로젝트마다 한 줄 성과를 강조
    const items = outcomes.slice(0, 4);
    const ch = Math.min(1.5, (B.B - y - (items.length - 1) * 0.25) / items.length);
    for (const o of items) {
      if (y > B.B - 0.6) break;
      slide.addShape(pptx.ShapeType.roundRect, { x: B.L, y, w: B.W, h: ch, rectRadius: 0.1, fill: { color: T.outcomeFill }, line: { color: T.outcomeLine, width: 0.75 } });
      bodyBox(slide, T, o.title, { x: B.L + 0.3, y: y + 0.14, w: B.W - 0.6, h: 0.32, maxPt: 11, bold: true, color: T.outcomeLabel });
      bulletBox(slide, T, toBullets(o.text, 2), { x: B.L + 0.3, y: y + 0.5, w: B.W - 0.6, h: ch - 0.62, color: T.outcomeText, bold: true, maxPt: 13, minPt: 9 });
      y += ch + 0.25;
    }
  }
  return true;
}

// 지표/핵심경험 카드 — ① 전/후 막대 차트 ② 짧은 정량값(큰 숫자) ③ 정성(긴 문장: 헤딩+본문)
// 정성 항목을 "큰 숫자" 자리에 욱여넣으면 clip 으로 '…' 잘림이 나므로 셋을 분기한다.
function drawMetricCard(slide, pptx, T, k, x, y, w, big = false) {
  const pa = parseBeforeAfter(k.metric);
  const rawVal = san(k.metric || k.result || '');
  const isShortVal = !!rawVal && rawVal.length <= 14 && /[0-9]/.test(rawVal); // "98% 단축", "3" 류
  const fsLabel = big ? 10 : 9, fsVal = big ? 18 : 14, fsBar = big ? 9 : 8;

  // ③ 정성(긴 문장): 라벨을 헤딩으로, 본문은 측정 맞춤으로 전부(자르지 않음)
  if (!pa && !isShortVal) {
    const h = big ? 2.0 : 1.62;
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.09, fill: { color: T.card }, line: { color: T.line, width: 0.75 } });
    slide.addShape(pptx.ShapeType.rect, { x: x + 0.2, y: y + 0.21, w: 0.05, h: 0.24, fill: { color: T.accent }, line: { type: 'none' } });
    bodyBox(slide, T, k.metricLabel || k.title || '핵심 경험', { x: x + 0.36, y: y + 0.16, w: w - 0.56, h: 0.46, color: T.ink, bold: true, maxPt: 12, lineH: 1.15 });
    bulletBox(slide, T, toBullets(rawVal, 2), { x: x + 0.2, y: y + 0.72, w: w - 0.4, h: h - 0.92, color: T.body, maxPt: 11, minPt: 8 });
    return h;
  }

  const h = pa ? (big ? 1.9 : 1.52) : (big ? 1.25 : 1.0);
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.09, fill: { color: T.card }, line: { color: T.line, width: 0.75 } });
  bodyBox(slide, T, k.metricLabel || k.title || '핵심 지표', { x: x + 0.2, y: y + 0.12, w: w - 0.4, h: 0.28, maxPt: fsLabel, bold: true, color: T.sub });
  if (!pa) {
    // ② 짧은 정량값 (이미 짧으므로 clip 불필요)
    slide.addText(rawVal, { x: x + 0.2, y: y + 0.4, w: w - 0.4, h: h - 0.55, fontSize: fsVal + 2, bold: true, color: T.accent, margin: 0, fit: 'shrink', valign: 'middle', fontFace: T.fontH });
    return h;
  }
  slide.addText([
    { text: pa.beforeRaw, options: { fontSize: fsVal, bold: true, color: T.ink } },
    { text: '  →  ', options: { fontSize: fsVal - 2, bold: true, color: T.accent } },
    { text: pa.afterRaw, options: { fontSize: fsVal, bold: true, color: T.accent } },
  ], { x: x + 0.2, y: y + 0.38, w: w - 0.4, h: 0.4, margin: 0, fontFace: T.fontH });

  const max = Math.max(pa.beforeV, pa.afterV, 1);
  const trackX = x + 0.52, trackW = w - 1.65;
  const barH = big ? 0.17 : 0.13;
  const bars = [
    ['전', pa.beforeV / max, T.barBefore, pa.beforeRaw],
    ['후', pa.afterV / max, T.accent, pa.afterRaw],
  ];
  bars.forEach(([lab, ratio, color, val], i) => {
    const by = y + (big ? 0.95 : 0.72) + i * (big ? 0.36 : 0.3);
    slide.addText(lab, { x: x + 0.2, y: by - 0.04, w: 0.3, h: 0.24, fontSize: fsBar, bold: true, color: T.sub, margin: 0, fontFace: T.fontB });
    slide.addShape(pptx.ShapeType.roundRect, { x: trackX, y: by, w: trackW, h: barH, rectRadius: barH / 2, fill: { color: T.line }, line: { type: 'none' } });
    slide.addShape(pptx.ShapeType.roundRect, { x: trackX, y: by, w: Math.max(0.07, trackW * ratio), h: barH, rectRadius: barH / 2, fill: { color }, line: { type: 'none' } });
    slide.addText(val, { x: trackX + trackW + 0.07, y: by - 0.04, w: 1.0, h: 0.26, fontSize: fsBar, bold: true, color: T.ink, margin: 0, fontFace: T.fontB });
  });
  return h;
}

// 프로젝트 헤더(번호·제목·메타·요약·칩) — 본문 시작 y 반환
function projectHeader(slide, pptx, T, B, e, idx, sub) {
  const sr = e.structuredResult || {};
  const ov = sr.projectOverview || {};
  const period = e.period || e.date || ov.period || ov.duration || '';
  // role 은 "백엔드 개발자"처럼 깔끔한 직함일 때만 메타에 넣는다. 실데이터엔 한 문단짜리
  // 설명이 흔한데, 그 첫 절을 떼면 "…참여하여"처럼 미완성 구절이 남아 잘린 듯 보인다.
  // → 짧고(≤24자) 연결어미로 끝나지 않는(문장 조각이 아닌) 경우만 표시, 아니면 생략.
  const roleRaw = san(e.role || ov.role || '');
  const FRAGMENT_END = /(하여|되어|으로서|로서|하며|했고|했으며|하고|위해|통해|면서|에서|으로|보다|는|을|를|이|가|및)$/;
  const role = (roleRaw && roleRaw.length <= 24 && !FRAGMENT_END.test(roleRaw)) ? roleRaw : '';
  const tech = (nonEmpty(e.skills).length ? e.skills : nonEmpty(ov.techStack)).map(skillName).filter(Boolean);

  let y = B.T;
  const tag = `PROJECT ${String(idx + 1).padStart(2, '0')}${sub ? `  ·  ${sub}` : ''}`;
  if (T.headerStyle === 'block') {
    const pw = measure(tag, 9) + 0.4;
    slide.addShape(pptx.ShapeType.roundRect, { x: B.L, y, w: pw, h: 0.32, rectRadius: 0.16, fill: { color: T.accent }, line: { type: 'none' } });
    slide.addText(tag, { x: B.L, y: y - 0.01, w: pw, h: 0.34, fontSize: 9, bold: true, color: T.onAccent, align: 'center', valign: 'middle', charSpacing: 2, margin: 0, fontFace: T.fontB });
  } else if (T.headerStyle === 'sidebar') {
    slide.addShape(pptx.ShapeType.rect, { x: B.L, y: y + 0.04, w: 0.32, h: 0.22, fill: { color: T.accent }, line: { type: 'none' } });
    slide.addText(tag, { x: B.L + 0.44, y, w: B.W - 0.44, h: 0.3, fontSize: 10.5, bold: true, color: T.accent, charSpacing: 3, margin: 0, fontFace: T.fontB });
  } else {
    slide.addText(tag, { x: B.L, y, w: B.W, h: 0.3, fontSize: 10.5, bold: true, color: T.accent, charSpacing: 3, fontFace: T.fontB });
  }
  y += 0.34;
  bodyBox(slide, T, e.title || '프로젝트', { x: B.L, y, w: B.W, h: 0.66, maxPt: 24, bold: true, color: T.ink, face: T.fontH, lineH: 1.08 });
  y += 0.72;
  const meta = [role, period].filter(Boolean).join('   ·   ');
  if (meta) {
    bodyBox(slide, T, meta, { x: B.L, y, w: B.W, h: 0.3, maxPt: 11.5, bold: true, color: T.sub });
    y += 0.36;
  }
  // 요약은 한 줄에 온전히 들어갈 때만 표시 — 길면 생략(상세는 아래 본문 카드가 담당).
  // 중간에 잘린 한 줄(예: "…기술로 처리하여")이 남는 문제를 구조적으로 차단한다.
  const summary = san(ov.summary || '');
  if (summary && measure(summary, 11) <= B.W - 0.2) {
    slide.addText(summary, { x: B.L, y, w: B.W, h: 0.3, fontSize: 11, color: T.sub, fontFace: T.fontB });
    y += 0.36;
  }
  if (tech.length) {
    y = drawChips(slide, pptx, T, tech.slice(0, 6), B.L, y + 0.04, B.W, { fontSize: 9, h: 0.28 }) + 0.12;
  }
  slide.addShape(pptx.ShapeType.rect, { x: B.L, y: y + 0.06, w: B.W, h: 0.018, fill: { color: T.line }, line: { type: 'none' } });
  return y + 0.28;
}

// 배열(AI 불릿)/문자열 → 문단 텍스트(글 형태=prose 일 때)
function valueToProse(value) {
  return Array.isArray(value) ? value.map(s => san(s).replace(/[.。]$/, '')).filter(Boolean).join('. ') : san(value);
}

// 라벨 + 본문 행 그리기. T.bodyText==='prose' 면 흐르는 문단, 아니면 불릿.
function drawStoryRows(slide, pptx, T, B, rows, top) {
  const weights = { '문제 정의': 1, '수행 역할': 0.85, '해결 과정': 1.2, '성과': 1.0, '배운 점': 0.85, '요약': 1.2 };
  const totalW = rows.reduce((a, [l]) => a + (weights[l] || 1), 0) || 1;
  const prose = T.bodyText === 'prose';
  let y = top;
  rows.forEach(([label, value, accent], i) => {
    const h = (B.B - top) * ((weights[label] || 1) / totalW);
    if (accent) {
      slide.addShape(pptx.ShapeType.roundRect, { x: B.L, y: y + 0.06, w: B.W, h: h - 0.16, rectRadius: 0.09, fill: { color: T.outcomeFill }, line: { color: T.outcomeLine, width: 0.75 } });
    } else if (i > 0) {
      slide.addShape(pptx.ShapeType.line, { x: B.L, y, w: B.W, h: 0, line: { color: T.line, width: 0.75, dashType: 'dash' } });
    }
    slide.addText(label, { x: B.L + (accent ? 0.22 : 0), y: y + 0.16, w: 1.15, h: 0.32, fontSize: 10.5, bold: true, color: accent ? T.outcomeLabel : T.accent, margin: 0, fontFace: T.fontB });
    const bx = { x: B.L + 1.35, y: y + 0.12, w: B.W - 1.5 - (accent ? 0.22 : 0), h: h - 0.24 };
    if (prose && !accent) {
      bodyBox(slide, T, valueToProse(value), { ...bx, color: T.body, maxPt: 12.5, minPt: 8.5, lineH: 1.4, valign: 'middle', condense: true });
    } else {
      bulletBox(slide, T, Array.isArray(value) ? value.slice(0, 3) : toBullets(value, 2), {
        ...bx, color: accent ? T.outcomeText : T.body, bold: !!accent, maxPt: 12.5, minPt: 8.5, valign: 'middle',
      });
    }
    y += h;
  });
}

// 카드 그리드 — 가로 카드 컬럼(design='cards'). 5개 이상이면 2행 그리드(detailed 가 더 풍성).
function drawStoryCards(slide, pptx, T, B, rows, top) {
  const n = rows.length;
  const perRow = n <= 4 ? n : Math.ceil(n / 2);       // 5~6단이면 2행
  const nRows = Math.ceil(n / perRow);
  const gap = 0.3, vgap = 0.28;
  const cw = (B.W - gap * (perRow - 1)) / perRow;
  const ch = (B.B - top - 0.1 - (nRows - 1) * vgap) / nRows;
  const maxBullets = nRows > 1 ? 3 : 4;
  rows.forEach(([label, value, accent], i) => {
    const r = Math.floor(i / perRow), c = i % perRow;
    const x = B.L + c * (cw + gap);
    const cy = top + r * (ch + vgap);
    const fill = accent ? T.outcomeFill : T.card;
    const lineC = accent ? T.outcomeLine : T.line;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: cy, w: cw, h: ch, rectRadius: 0.1, fill: { color: fill }, line: { color: lineC, width: 0.75 } });
    // 라벨 영역 — cardStyle 에 따라 알약/좌측바/넘버링으로 다르게
    const lblColor = accent ? T.outcomeLabel : T.accent;
    let bodyTop = cy + 0.9;
    if (T.cardStyle === 'numbered') {
      slide.addText(`0${i + 1}`, { x: x + 0.26, y: cy + 0.22, w: cw - 0.5, h: 0.5, fontSize: 24, bold: true, color: lblColor, margin: 0, fontFace: T.fontH });
      bodyBox(slide, T, label, { x: x + 0.26, y: cy + 0.74, w: cw - 0.5, h: 0.34, maxPt: 11.5, bold: true, color: accent ? T.outcomeText : T.ink, face: T.fontB });
      bodyTop = cy + 1.16;
    } else if (T.cardStyle === 'bar') {
      slide.addShape(pptx.ShapeType.rect, { x: x + 0.26, y: cy + 0.28, w: 0.07, h: 0.32, fill: { color: lblColor }, line: { type: 'none' } });
      bodyBox(slide, T, label, { x: x + 0.44, y: cy + 0.28, w: cw - 0.66, h: 0.34, maxPt: 11.5, bold: true, color: lblColor, valign: 'middle', face: T.fontB });
      bodyTop = cy + 0.82;
    } else {
      const pw = Math.min(cw - 0.44, measure(label, 11) + 0.5);
      slide.addShape(pptx.ShapeType.roundRect, { x: x + 0.22, y: cy + 0.24, w: pw, h: 0.36, rectRadius: 0.18, fill: { color: lblColor }, line: { type: 'none' } });
      slide.addText(label, { x: x + 0.22, y: cy + 0.23, w: pw, h: 0.38, fontSize: 11, bold: true, color: accent ? T.outcomeFill : T.onAccent, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontB });
      bodyTop = cy + 0.86;
    }
    bulletBox(slide, T, Array.isArray(value) ? value.slice(0, maxBullets) : toBullets(value, maxBullets), {
      x: x + 0.28, y: bodyTop, w: cw - 0.56, h: ch - (bodyTop - cy) - 0.22,
      color: accent ? T.outcomeText : T.body, bold: !!accent, maxPt: 12, minPt: 8,
    });
  });
}

// 세로 타임라인 — 문제→해결→성과를 시간순 노드로 (design='timeline')
function drawStoryTimeline(slide, pptx, T, B, rows, top) {
  const n = rows.length;
  const lineX = B.L + 0.34;
  const slot = (B.B - top) / n;
  // 연결선
  slide.addShape(pptx.ShapeType.rect, { x: lineX - 0.014, y: top + 0.2, w: 0.028, h: Math.max(0.1, (n - 1) * slot + 0.05), fill: { color: T.accentLine }, line: { type: 'none' } });
  rows.forEach(([label, value, accent], i) => {
    const ny = top + i * slot + 0.18;
    // 노드 (성과는 채운 액센트, 나머지는 외곽선)
    slide.addShape(pptx.ShapeType.ellipse, { x: lineX - 0.16, y: ny, w: 0.32, h: 0.32, fill: { color: accent ? T.accent : T.bg }, line: { color: T.accent, width: 2 } });
    slide.addText(String(i + 1), { x: lineX - 0.16, y: ny - 0.01, w: 0.32, h: 0.34, fontSize: 10, bold: true, color: accent ? T.onAccent : T.accent, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontB });
    const tx = lineX + 0.5;
    slide.addText(label, { x: tx, y: ny - 0.04, w: B.W - 0.9, h: 0.3, fontSize: 12, bold: true, color: T.accent, margin: 0, fontFace: T.fontB });
    bulletBox(slide, T, Array.isArray(value) ? value.slice(0, 3) : toBullets(value, 2), {
      x: tx, y: ny + 0.34, w: B.W - 0.9, h: slot - 0.58,
      color: accent ? T.ink : T.body, bold: !!accent, maxPt: 12, minPt: 8,
    });
  });
}

// 본문 배치 디스패처 — 디자인 선택에 따라 행/카드/타임라인 중 하나
function drawStoryContent(slide, pptx, T, B, rows, top) {
  if (!rows.length) return;
  if (T.design === 'cards' && rows.length >= 2 && rows.length <= 6) return drawStoryCards(slide, pptx, T, B, rows, top);
  if (T.design === 'timeline') return drawStoryTimeline(slide, pptx, T, B, rows, top);
  return drawStoryRows(slide, pptx, T, B, rows, top);
}

// 흐름(structure)에 따라 프로젝트 본문 "행 구성"을 다르게 만든다 — 지표 유무와 무관.
//  - story: 문제 정의 → 해결 과정(역할+과정) → (성과)         서사 3단
//  - detailed: 문제 정의 → 수행 역할 → 해결 과정 → (성과) → 배운 점   세분 5단
//  - metrics: (성과 먼저) → 접근 방법 → 문제 배경              결과 선행
//  - compact: 문제 → 해결 → 성과 (밀집)
// 문장 단위로 앞부분만 — compact(요약) 모드에서 과밀을 막는다
function summarize(text, maxChars) {
  const t = san(text);
  if (t.length <= maxChars) return t;
  let out = '';
  for (const sent of t.split(/(?<=[.!?。]|다\.|요\.|음\.|함\.)\s+/)) {
    if (out && (out.length + sent.length) > maxChars) break;
    out += (out ? ' ' : '') + sent;
  }
  return (out || t).slice(0, maxChars).trim();
}

// 값이 비었는지 — 문자열/배열(불릿) 공통
const hasVal = (v) => (Array.isArray(v) ? v.length > 0 : !!v);
// 역할+과정 결합 — 배열(불릿)이면 concat, 문자열이면 줄바꿈 join
function combineVals(a, b) {
  const aa = Array.isArray(a) ? a : (a ? [a] : []);
  const bb = Array.isArray(b) ? b : (b ? [b] : []);
  const both = [...aa, ...bb];
  if (!both.length) return '';
  return (Array.isArray(a) || Array.isArray(b)) ? both : both.join('\n');
}

// ab: {intro,task,process,output,growth: string[]} — AI 단답형 불릿(있으면 배열로 사용),
// 없으면 원문 문자열(렌더 시 문장 분리 불릿으로 폴백).
function buildStoryRows(structure, sr, e, includeOutcome, ab) {
  const V = (key, raw) => (ab && Array.isArray(ab[key]) && ab[key].length) ? ab[key] : (raw || '');
  const intro = V('intro', sr.intro);
  const task = V('task', sr.task || sr.role);
  const process = V('process', sr.process);
  const output = V('output', sr.output);
  const growth = V('growth', sr.growth);
  const solve = combineVals(task, process);
  let rows;
  if (structure === 'detailed') {
    rows = [
      ['문제 정의', intro, false],
      ['수행 역할', task, false],
      ['해결 과정', hasVal(process) ? process : solve, false],
      ...(includeOutcome ? [['성과', output, true]] : []),
      ['배운 점', growth, false],
    ];
  } else if (structure === 'metrics') {
    rows = [
      ...(includeOutcome ? [['성과', output, true]] : []),
      ['접근 방법', solve, false],
      ['문제 배경', intro, false],
    ];
  } else if (structure === 'compact') {
    // 1장 압축 — 핵심 3단만(역할은 해결에 흡수, 배운 점 생략)
    rows = [
      ['문제 정의', intro, false],
      ['해결 과정', solve, false],
      ...(includeOutcome ? [['성과', output, true]] : []),
    ];
  } else {
    // story(기본): 서사형 — 역할을 '해결 과정'에 합쳐 간결하게(문제→해결→성과→배운점)
    rows = [
      ['문제 정의', intro, false],
      ['해결 과정', hasVal(solve) ? solve : process, false],
      ...(includeOutcome ? [['성과', output, true]] : []),
      ['배운 점', growth, false],
    ];
  }
  rows = rows.filter(([, v]) => hasVal(v));
  if (!rows.length && e.description) rows = [['요약', e.description, false]];
  // compact 는 한 장에 다 담으므로 문자열은 첫 문장 위주 요약(불릿 배열이면 그대로)
  if (structure === 'compact') rows = rows.map(([l, v, a]) => [l, Array.isArray(v) ? v : summarize(v, 150), a]);
  return rows;
}

// 프로젝트 스토리 슬라이드(범용) — 주어진 rows 를 디자인 레이아웃으로 렌더 (골격=stack)
function addProjectStorySlide(pptx, T, F, e, idx, rows, sub = '') {
  if (!rows.length) return;
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  const top = projectHeader(slide, pptx, T, B, e, idx, sub);
  // story 는 ≤4단(1행 카드), detailed 는 5단(2행 그리드) — 카드는 최대 6단까지 수용
  const rendered = (T.design === 'cards' && rows.length > 6) ? rows.slice(0, 6) : rows;
  drawStoryContent(slide, pptx, T, B, rendered, top + 0.05);
}

// 페이지 골격 ② rail — 좌측 컬러 패널(제목·메타·기술 세로) + 우측 본문.
// 헤더가 위가 아니라 옆에 오므로 stack 과 슬라이드 구도 자체가 다르다.
function addProjectRail(pptx, T, F, e, idx, rows) {
  if (!rows.length) return;
  const frame = F.content;
  const slide = pptx.addSlide();
  slide.background = { color: (frame?.bg && frame.bg.replace('#', '')) || T.bg };
  drawFrame(slide, pptx, T, frame);

  const sr = e.structuredResult || {};
  const ov = sr.projectOverview || {};
  const panelW = 4.0;
  const panelFill = T.vivid ? T.accentRaw : T.closeBg;
  const onPanel = T.vivid ? T.onAccent : T.onClose;
  const onPanelSub = T.vivid ? mix(`#${T.accentRaw}`, `#${onPanel}`, 0.42).replace('#', '') : T.onCloseSub;
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: panelW, h: SLIDE_H, fill: { color: panelFill }, line: { type: 'none' } });
  slide.addShape(pptx.ShapeType.rect, { x: panelW, y: 0, w: 0.07, h: SLIDE_H, fill: { color: T.accent }, line: { type: 'none' } });

  const px = 0.55, pw = panelW - 1.0;
  slide.addText(`PROJECT ${String(idx + 1).padStart(2, '0')}`, { x: px, y: 0.65, w: pw, h: 0.3, fontSize: 11, bold: true, color: onPanelSub, charSpacing: 3, margin: 0, fontFace: T.fontB });
  let y = 1.2;
  bodyBox(slide, T, e.title || '프로젝트', { x: px, y, w: pw, h: 1.7, maxPt: 27, bold: true, color: onPanel, face: T.fontH, lineH: 1.12 });
  y += 1.9;
  const period = e.period || e.date || ov.period || ov.duration || '';
  const roleRaw = san(e.role || ov.role || '');
  const meta = [(roleRaw && roleRaw.length <= 24) ? roleRaw : '', period].filter(Boolean).join('   ·   ');
  if (meta) {
    slide.addShape(pptx.ShapeType.rect, { x: px, y: y - 0.04, w: 0.5, h: 0.04, fill: { color: T.accent }, line: { type: 'none' } });
    bodyBox(slide, T, meta, { x: px, y: y + 0.14, w: pw, h: 0.5, maxPt: 12, bold: true, color: onPanelSub, lineH: 1.25 });
    y += 0.7;
  }
  const tech = (nonEmpty(e.skills).length ? e.skills : nonEmpty(ov.techStack)).map(skillName).filter(Boolean);
  if (tech.length && y < SLIDE_H - 1.0) {
    // 패널 위에서는 칩(테마색)이 배경과 충돌하므로 패널 글자색 텍스트로 표기
    slide.addText('TECH', { x: px, y, w: pw, h: 0.26, fontSize: 8.5, bold: true, color: onPanelSub, charSpacing: 2, margin: 0, fontFace: T.fontB });
    bodyBox(slide, T, tech.slice(0, 6).join('   ·   '), { x: px, y: y + 0.3, w: pw, h: 0.8, maxPt: 11, bold: true, color: onPanel, lineH: 1.4 });
  }

  // 우측 본문 — design 본문배치(카드/행/타임라인)를 그대로 사용
  const B = { L: panelW + 0.5, T: 0.62, B: SLIDE_H - 0.5, W: SLIDE_W - panelW - 0.95 };
  const rendered = (T.design === 'cards' && rows.length > 6) ? rows.slice(0, 6) : rows;
  drawStoryContent(slide, pptx, T, B, rendered, B.T);
}

// 페이지 골격 ③ split — 상단 헤더 + 좌 본문(접근·배경) + 우측 성과 대시보드 패널.
// 한 장에 narrative 와 지표를 나란히 두는 데이터리포트형 구도.
function addProjectSplit(pptx, T, F, e, idx, rows, keyExps, outText) {
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  const top = projectHeader(slide, pptx, T, B, e, idx, '');
  const gap = 0.4, leftW = B.W * 0.55;
  const rightX = B.L + leftW + gap, rightW = B.W - leftW - gap;
  const leftRows = rows.filter(r => !r[2]);            // 성과(accent)는 우측 패널이 담당
  const leftB = { ...B, W: leftW };
  if (leftRows.length) drawStoryRows(slide, pptx, T, leftB, leftRows, top);
  else if (rows.length) drawStoryContent(slide, pptx, T, leftB, rows, top);
  drawStatPanel(slide, pptx, T, rightX, top, rightW, B.B - top, outText, keyExps);
}

// 성과 대시보드 패널 — 채운 패널 안에 성과 불릿 + 지표(전/후 막대·큰 숫자·정성 불릿).
function drawStatPanel(slide, pptx, T, x, y, w, h, outText, keyExps) {
  const fill = T.vivid ? T.accentSoft : T.card;
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: T.accentLine, width: 0.75 } });
  const pad = 0.3, iw = w - pad * 2;
  let cy = y + 0.26;
  slide.addText('RESULTS', { x: x + pad, y: cy, w: iw, h: 0.26, fontSize: 9, bold: true, color: T.accent, charSpacing: 3, margin: 0, fontFace: T.fontB });
  cy += 0.4;
  const bl = toBullets(outText, 2);
  if (bl.length) {
    const bh = Math.min(1.4, 0.44 * bl.length + 0.12);
    bulletBox(slide, T, bl, { x: x + pad, y: cy, w: iw, h: bh, color: T.ink, bold: true, maxPt: 12, minPt: 8.5 });
    cy += bh + 0.16;
  }
  for (const k of (keyExps || []).slice(0, 3)) {
    if (cy > y + h - 0.5) break;
    slide.addShape(pptx.ShapeType.line, { x: x + pad, y: cy - 0.04, w: iw, h: 0, line: { color: T.accentLine, width: 0.75, dashType: 'dash' } });
    cy += 0.12;
    bodyBox(slide, T, san(k.metricLabel || k.title || '핵심 지표'), { x: x + pad, y: cy, w: iw, h: 0.26, maxPt: 9.5, bold: true, color: T.sub });
    cy += 0.3;
    const pa = parseBeforeAfter(k.metric);
    const rv = san(k.metric || k.result || '');
    if (pa) {
      slide.addText([
        { text: pa.beforeRaw, options: { fontSize: 14, bold: true, color: T.barBefore } },
        { text: '  →  ', options: { fontSize: 12, bold: true, color: T.accent } },
        { text: pa.afterRaw, options: { fontSize: 19, bold: true, color: T.accent } },
      ], { x: x + pad, y: cy, w: iw, h: 0.42, margin: 0, fontFace: T.fontH });
      cy += 0.54;
    } else if (rv && rv.length <= 16 && /[0-9]/.test(rv)) {
      bodyBox(slide, T, rv, { x: x + pad, y: cy, w: iw, h: 0.48, maxPt: 22, bold: true, color: T.accent, face: T.fontH, lineH: 1.0 });
      cy += 0.6;
    } else {
      const bh = Math.min(1.0, 0.42 * Math.min(2, toBullets(rv, 2).length) + 0.1);
      bulletBox(slide, T, toBullets(rv, 2), { x: x + pad, y: cy, w: iw, h: bh, color: T.body, maxPt: 10.5, minPt: 8 });
      cy += bh + 0.1;
    }
  }
}

// 성과 리드 — design 별로 완전히 다른 룩. 다음 y 반환.
//  cards=채운 박스 / editorial=좌측 룰+라벨+불릿 / timeline=노드 리드
function outcomeLead(slide, pptx, T, B, outText, y) {
  if (!outText) return y;
  const bl = toBullets(outText, 3);
  if (T.design === 'editorial') {
    slide.addShape(pptx.ShapeType.rect, { x: B.L, y: y + 0.02, w: 0.06, h: 0.3, fill: { color: T.accent }, line: { type: 'none' } });
    slide.addText('성과', { x: B.L + 0.22, y, w: B.W - 0.22, h: 0.3, fontSize: 12, bold: true, color: T.accent, charSpacing: 1, fontFace: T.fontB });
    const by = y + 0.42, bh = Math.min(2.0, 0.42 * bl.length + 0.25);
    bulletBox(slide, T, bl, { x: B.L + 0.22, y: by, w: B.W - 0.22, h: bh, color: T.ink, bold: true, maxPt: 13, minPt: 9 });
    return by + bh + 0.25;
  }
  if (T.design === 'timeline') {
    slide.addShape(pptx.ShapeType.ellipse, { x: B.L, y, w: 0.34, h: 0.34, fill: { color: T.accent }, line: { type: 'none' } });
    slide.addText('★', { x: B.L, y: y - 0.02, w: 0.34, h: 0.36, fontSize: 12, bold: true, color: T.onAccent, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontB });
    slide.addText('성과', { x: B.L + 0.5, y, w: B.W - 0.5, h: 0.3, fontSize: 12, bold: true, color: T.accent, fontFace: T.fontB });
    const by = y + 0.42, bh = Math.min(2.0, 0.42 * bl.length + 0.25);
    bulletBox(slide, T, bl, { x: B.L + 0.5, y: by, w: B.W - 0.5, h: bh, color: T.ink, bold: true, maxPt: 13, minPt: 9 });
    return by + bh + 0.25;
  }
  // cards: 채운 라운드 박스
  const oh = Math.min(2.3, 0.42 * bl.length + 0.7);
  slide.addShape(pptx.ShapeType.roundRect, { x: B.L, y, w: B.W, h: oh, rectRadius: 0.1, fill: { color: T.outcomeFill }, line: { color: T.outcomeLine, width: 0.75 } });
  slide.addText('성과', { x: B.L + 0.25, y: y + 0.16, w: 1.0, h: 0.3, fontSize: 10.5, bold: true, color: T.outcomeLabel, margin: 0, fontFace: T.fontB });
  bulletBox(slide, T, bl, { x: B.L + 1.3, y: y + 0.16, w: B.W - 1.6, h: oh - 0.32, color: T.outcomeText, bold: true, maxPt: 13, minPt: 9, valign: 'middle' });
  return y + oh + 0.25;
}

// 지표/핵심경험 — design 별 배치
//  cards=카드 그리드(전/후 막대) / editorial=가로 통계 스트립(정성은 스택) / timeline=세로 노드
function metricsSection(slide, pptx, T, B, items, qualitative, y, showLabel = true) {
  if (!items.length || y > B.B - 0.9) return;
  if (showLabel) {
    slide.addText(qualitative ? '핵심 경험' : 'KEY METRICS', { x: B.L, y, w: B.W, h: 0.26, fontSize: 9, bold: true, color: T.sub, charSpacing: 2.5, fontFace: T.fontB });
    y += 0.36;
  }
  const valOf = (k) => { const pa = parseBeforeAfter(k.metric); return pa ? `${pa.beforeRaw} → ${pa.afterRaw}` : san(k.metric || k.result || ''); };
  const labOf = (k) => san(k.metricLabel || k.title || '핵심 지표');

  if (T.design === 'timeline') {
    const list = items.slice(0, qualitative ? 3 : 5);
    const slot = Math.min(1.15, Math.max(0.6, (B.B - y - 0.1) / list.length));
    const lineX = B.L + 0.17;
    slide.addShape(pptx.ShapeType.rect, { x: lineX - 0.014, y: y + 0.16, w: 0.028, h: Math.max(0.1, (list.length - 1) * slot + 0.05), fill: { color: T.accentLine }, line: { type: 'none' } });
    list.forEach((k, i) => {
      const ny = y + i * slot, tx = lineX + 0.5;
      slide.addShape(pptx.ShapeType.ellipse, { x: lineX - 0.15, y: ny, w: 0.3, h: 0.3, fill: { color: T.accent }, line: { type: 'none' } });
      if (qualitative) {
        bodyBox(slide, T, labOf(k), { x: tx, y: ny - 0.02, w: B.W - 0.7, h: 0.32, maxPt: 12.5, bold: true, color: T.accent });
        bulletBox(slide, T, toBullets(valOf(k), 2), { x: tx, y: ny + 0.32, w: B.W - 0.7, h: slot - 0.5, color: T.body, maxPt: 11, minPt: 8 });
      } else {
        bodyBox(slide, T, valOf(k), { x: tx, y: ny - 0.04, w: B.W - 0.7, h: 0.4, maxPt: 17, bold: true, color: T.accent, face: T.fontH, valign: 'middle' });
        bodyBox(slide, T, labOf(k), { x: tx, y: ny + 0.37, w: B.W - 0.7, h: 0.24, maxPt: 10, color: T.sub });
      }
    });
    return;
  }

  if (T.design === 'editorial') {
    if (qualitative) {
      let yy = y;
      const each = Math.min(1.5, (B.B - y) / Math.min(items.length, 3));
      for (const k of items.slice(0, 3)) {
        if (yy > B.B - 0.5) break;
        bodyBox(slide, T, labOf(k), { x: B.L, y: yy, w: B.W, h: 0.3, maxPt: 12, bold: true, color: T.accent });
        bulletBox(slide, T, toBullets(valOf(k), 2), { x: B.L + 0.1, y: yy + 0.34, w: B.W - 0.1, h: each - 0.48, color: T.ink, maxPt: 11.5, minPt: 8.5 });
        yy += each;
        slide.addShape(pptx.ShapeType.line, { x: B.L, y: yy - 0.1, w: B.W, h: 0, line: { color: T.line, width: 0.75, dashType: 'dash' } });
      }
    } else {
      const n = Math.min(items.length, 4), cw = B.W / n;
      items.slice(0, n).forEach((k, i) => {
        const x = B.L + i * cw;
        if (i > 0) slide.addShape(pptx.ShapeType.rect, { x, y: y + 0.06, w: 0.014, h: 1.2, fill: { color: T.line }, line: { type: 'none' } });
        bodyBox(slide, T, valOf(k), { x: x + 0.22, y: y + 0.12, w: cw - 0.4, h: 0.64, maxPt: 22, bold: true, color: T.accent, face: T.fontH, valign: 'middle', lineH: 1.0 });
        bodyBox(slide, T, labOf(k), { x: x + 0.22, y: y + 0.84, w: cw - 0.4, h: 0.5, maxPt: 10.5, color: T.sub, lineH: 1.15 });
      });
    }
    return;
  }

  // cards (기본): 2열 카드 그리드(전/후 막대 포함)
  const colW = (B.W - 0.3) / 2;
  let col = 0, rowY = y, rowMaxH = 0;
  for (const k of items.slice(0, qualitative ? 2 : 4)) {
    if (rowY > B.B - 1.0) break;
    const h = drawMetricCard(slide, pptx, T, k, B.L + col * (colW + 0.3), rowY, colW, true);
    rowMaxH = Math.max(rowMaxH, h); col++;
    if (col === 2) { col = 0; rowY += rowMaxH + 0.22; rowMaxH = 0; }
  }
}

// 프로젝트 ② 성과·지표 슬라이드 — 성과 리드 + 지표(둘 다 design 반영)
function addProjectResults(pptx, T, F, e, idx) {
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  const sr = e.structuredResult || {};
  const allKe = nonEmpty(sr.keyExperiences);
  const qualitative = allKe.some(k => {
    const rv = san(k.metric || k.result || '');
    return !parseBeforeAfter(k.metric) && !(rv.length <= 14 && /[0-9]/.test(rv));
  });

  let y = B.T;
  slide.addText(`PROJECT ${String(idx + 1).padStart(2, '0')}  ·  RESULTS`, { x: B.L, y, w: B.W, h: 0.3, fontSize: 10.5, bold: true, color: T.accent, charSpacing: 3, fontFace: T.fontB });
  y += 0.34;
  bodyBox(slide, T, `${shortTitle(e.title || '프로젝트', 40)} — 성과`, { x: B.L, y, w: B.W, h: 0.5, maxPt: 20, bold: true, color: T.ink, face: T.fontH, lineH: 1.05 });
  y += 0.62;
  slide.addShape(pptx.ShapeType.rect, { x: B.L, y, w: B.W, h: 0.018, fill: { color: T.line }, line: { type: 'none' } });
  y += 0.25;

  y = outcomeLead(slide, pptx, T, B, san(sr.output), y);
  metricsSection(slide, pptx, T, B, allKe, qualitative, y);
}

// [compact 구성] 프로젝트 한 장 압축: 좌측 3단 스토리 + 우측 지표 칼럼
function addProjectCompact(pptx, T, F, e, idx, ab) {
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  const sr = e.structuredResult || {};
  const top = projectHeader(slide, pptx, T, B, e, idx, '') + 0.05;
  const keyExps = nonEmpty(sr.keyExperiences).slice(0, 2);
  const rows = buildStoryRows('compact', sr, e, true, ab);

  if (keyExps.length) {
    const leftB = { ...B, W: B.W * 0.62 };
    if (rows.length) drawStoryRows(slide, pptx, T, leftB, rows, top);
    const mx = B.L + B.W * 0.62 + 0.3, mw = B.W * 0.38 - 0.3;
    slide.addText('KEY METRICS', { x: mx, y: top - 0.02, w: mw, h: 0.26, fontSize: 8.5, bold: true, color: T.sub, charSpacing: 2, fontFace: T.fontB });
    let my = top + 0.3;
    for (const k of keyExps) {
      if (my > B.B - 1.0) break;
      my += drawMetricCard(slide, pptx, T, k, mx, my, mw, false) + 0.16;
    }
  } else if (rows.length) {
    drawStoryContent(slide, pptx, T, B, rows, top);
  }
}

function addBackground(pptx, T, F, p, no) {
  const education = nonEmpty(p.education);
  const awards = nonEmpty(p.awards);
  const curr = p.curricular || {};
  const extra = p.extracurricular || {};
  const stats = [
    curr.summary?.credits && `이수 학점 ${curr.summary.credits}`,
    curr.summary?.gpa && `평점 ${curr.summary.gpa}`,
    ...nonEmpty(extra.languages).map(l => [l.name, l.score].filter(Boolean).join(' ')),
    ...nonEmpty(extra.badges).map(b => b.name),
  ].filter(Boolean);
  const details = nonEmpty(extra.details);
  if (!education.length && !awards.length && !stats.length && !details.length) return false;

  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  const top = sectionHeader(slide, pptx, T, B, no, '학력 · 수상 · 활동', 'Background');
  const colW = (B.W - 0.5) / 2;

  const drawList = (title, items, x) => {
    let y = top;
    if (!items.length) return y;
    slide.addText(title, { x, y, w: colW, h: 0.32, fontSize: 13, bold: true, color: T.ink, fontFace: T.fontH });
    y += 0.46;
    for (const [main, sub] of items.slice(0, 4)) {
      bodyBox(slide, T, main, { x, y, w: colW, h: 0.32, maxPt: 12, bold: true, color: T.ink });
      if (sub) {
        bodyBox(slide, T, sub, { x, y: y + 0.3, w: colW, h: 0.26, maxPt: 10, color: T.sub });
        y += 0.66;
      } else y += 0.44;
      slide.addShape(pptx.ShapeType.line, { x, y: y - 0.05, w: colW, h: 0, line: { color: T.line, width: 0.75 } });
    }
    return y;
  };

  const eduItems = education.map(e => [
    `${e.school || e.name || ''}${e.nameEn ? ` (${e.nameEn})` : ''}`,
    [e.major, e.degree, e.period].filter(Boolean).join(' · '),
  ]);
  const awardItems = awards.map(a => [a.title || '', [a.organization, a.date].filter(Boolean).join(' · ')]);
  const yL = drawList('학력', eduItems, B.L);
  const yR = drawList('수상 · 자격', awardItems, B.L + colW + 0.5);

  let y = Math.max(yL, yR) + 0.35;
  if ((stats.length || details.length || extra.summary) && y < B.B - 0.8) {
    slide.addText('활동', { x: B.L, y, w: 5, h: 0.32, fontSize: 13, bold: true, color: T.ink, fontFace: T.fontH });
    y += 0.46;
    if (extra.summary) {
      bodyBox(slide, T, extra.summary, { x: B.L, y, w: B.W, h: 0.34, maxPt: 11, color: T.body });
      y += 0.4;
    }
    if (stats.length) y = drawChips(slide, pptx, T, stats, B.L, y, B.W, { fontSize: 10, h: 0.34 }) + 0.2;
    for (const d of details.slice(0, 2)) {
      if (y > B.B - 0.35) break;
      const dTitle = san(d.title || '');
      if (!dTitle) continue;
      const line = [dTitle, d.period && `(${san(d.period)})`, d.description && `—  ${san(d.description)}`].filter(Boolean).join('  ');
      bodyBox(slide, T, line, { x: B.L, y, w: B.W, h: 0.4, maxPt: 11, color: T.body });
      y += 0.46;
    }
  }
  return true;
}

function addGoals(pptx, T, F, p, no) {
  const goals = nonEmpty(p.goals);
  if (!goals.length) return false;
  const slide = newSlide(pptx, T, F.content);
  const B = frameBounds(F.content);
  const top = sectionHeader(slide, pptx, T, B, no, '목표와 계획', 'Future Plans');
  const TYPE = { short: '단기', mid: '중기', long: '장기' };
  const STATUS = { done: '달성', ing: '진행 중' };
  const items = goals.map(g => ({ ...g, _title: san(g.title || ''), _desc: san(g.description || '') }))
    .filter(g => g._title).slice(0, 6);
  if (!items.length) return false;

  // 카드: 좌→우 카드 그리드
  if (T.design === 'cards') {
    const n = Math.min(items.length, 4);
    const gap = 0.3, cw = (B.W - gap * (n - 1)) / n, ch = Math.min(3.2, B.B - top - 0.1);
    items.slice(0, n).forEach((g, i) => {
      const x = B.L + i * (cw + gap);
      slide.addShape(pptx.ShapeType.roundRect, { x, y: top, w: cw, h: ch, rectRadius: 0.1, fill: { color: T.card }, line: { color: T.line, width: 0.75 } });
      slide.addShape(pptx.ShapeType.roundRect, { x: x + 0.22, y: top + 0.24, w: 0.95, h: 0.34, rectRadius: 0.17, fill: { color: T.accent }, line: { type: 'none' } });
      slide.addText(TYPE[g.type] || '목표', { x: x + 0.22, y: top + 0.23, w: 0.95, h: 0.36, fontSize: 9.5, bold: true, color: T.onAccent, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontB });
      bodyBox(slide, T, g._title, { x: x + 0.24, y: top + 0.72, w: cw - 0.48, h: 0.7, maxPt: 13, bold: true, color: T.ink, face: T.fontH, lineH: 1.1 });
      if (g._desc) bodyBox(slide, T, g._desc, { x: x + 0.24, y: top + 1.45, w: cw - 0.48, h: ch - 1.6, color: T.sub, maxPt: 11 });
    });
    return true;
  }
  // 타임라인: 세로 노드
  if (T.design === 'timeline') {
    const slot = Math.min(1.3, (B.B - top) / items.length);
    const lineX = B.L + 0.5;
    slide.addShape(pptx.ShapeType.rect, { x: lineX - 0.014, y: top + 0.2, w: 0.028, h: Math.max(0.1, (items.length - 1) * slot + 0.05), fill: { color: T.accentLine }, line: { type: 'none' } });
    items.forEach((g, i) => {
      const ny = top + i * slot;
      slide.addShape(pptx.ShapeType.ellipse, { x: lineX - 0.16, y: ny, w: 0.32, h: 0.32, fill: { color: T.accent }, line: { type: 'none' } });
      slide.addText(TYPE[g.type]?.[0] || '·', { x: lineX - 0.16, y: ny - 0.01, w: 0.32, h: 0.34, fontSize: 9, bold: true, color: T.onAccent, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontB });
      bodyBox(slide, T, g._title + (STATUS[g.status] ? `   · ${STATUS[g.status]}` : ''), { x: lineX + 0.5, y: ny - 0.02, w: B.W - 1.0, h: 0.36, maxPt: 13.5, bold: true, color: T.ink, valign: 'middle' });
      if (g._desc) bodyBox(slide, T, g._desc, { x: lineX + 0.5, y: ny + 0.34, w: B.W - 1.0, h: 0.3, maxPt: 10.5, color: T.sub });
    });
    return true;
  }
  // editorial: 라벨 + 텍스트 리스트
  let y = top + 0.1;
  for (const g of items) {
    if (y > B.B - 0.5) break;
    slide.addShape(pptx.ShapeType.roundRect, { x: B.L, y, w: 0.8, h: 0.36, rectRadius: 0.07, fill: { color: T.ink }, line: { type: 'none' } });
    slide.addText(TYPE[g.type] || '목표', { x: B.L, y: y - 0.01, w: 0.8, h: 0.38, fontSize: 9.5, bold: true, color: T.bg, align: 'center', valign: 'middle', margin: 0, fontFace: T.fontB });
    const gline = g._title + (STATUS[g.status] ? `   · ${STATUS[g.status]}` : '') + (g._desc ? `   —  ${g._desc}` : '');
    bodyBox(slide, T, gline, { x: B.L + 1.0, y: y - 0.02, w: B.W - 1.0, h: 0.5, maxPt: 13.5, bold: true, color: T.ink, valign: 'middle', lineH: 1.15 });
    y += 0.7;
  }
  return true;
}

// closingStyle: 'dark'(다크 배경·흰 글씨) | 'light'(밝은 배경·잉크) | 'accent'(포인트 컬러 가득)
function addClosing(pptx, T, p) {
  const style = T.closingStyle || 'dark';
  // 스타일별 팔레트 — 배경/본문/보조/악센트 바/라벨 색
  const pal = style === 'light'
    ? { bg: T.bg, fg: T.ink, sub: T.sub, bar: T.accent, label: T.accent }
    : style === 'accent'
      ? { bg: T.accentRaw, fg: T.onAccent, sub: T.onAccent, bar: T.ink, label: T.onAccent }
      : { bg: T.closeBg, fg: T.onClose, sub: T.onCloseSub, bar: T.accent, label: T.accent };

  const slide = pptx.addSlide();
  slide.background = { color: pal.bg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.16, h: SLIDE_H, fill: { color: pal.bar }, line: { type: 'none' } });
  if (T.emphasis) {
    slide.addText(`“${T.emphasis}”`, { x: 0.8, y: 1.7, w: 11.7, h: 0.7, fontSize: 15, italic: true, color: pal.sub, fit: 'shrink', fontFace: T.fontB });
  }
  slide.addText('감사합니다.', { x: 0.8, y: 2.55, w: 11.7, h: 1.1, fontSize: 40, bold: true, color: pal.fg, fontFace: T.fontH });
  slide.addText([
    { text: p.userName || '', options: { fontSize: 15, bold: true, color: pal.fg } },
    ...(p.nameEn ? [{ text: `   ${p.nameEn}`, options: { fontSize: 11, color: pal.sub } }] : []),
  ], { x: 0.8, y: 3.75, w: 11.7, h: 0.4, fontFace: T.fontB });
  const contact = p.contact || {};
  const items = [
    contact.email && ['EMAIL', contact.email],
    contact.phone && ['PHONE', contact.phone],
    contact.github && ['GITHUB', contact.github],
    contact.linkedin && ['LINKEDIN', contact.linkedin],
  ].filter(Boolean);
  if (items.length) {
    slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 4.5, w: 5.5, h: 0.014, fill: { color: pal.sub }, line: { type: 'none' } });
    const runs = [];
    items.forEach(([k, v], i) => {
      runs.push({ text: `${i ? '      ' : ''}${k}  `, options: { bold: true, color: pal.label, fontSize: 8.5 } });
      runs.push({ text: String(v), options: { color: pal.sub, fontSize: 10 } });
    });
    slide.addText(runs, { x: 0.8, y: 4.62, w: 11.7, h: 0.4, fit: 'shrink', fontFace: T.fontB });
  }
}

// ── 진입점 ───────────────────────────────────────────────────────────────

// options: 사용자가 모달에서 답한 구성(흐름/디자인/표지/컬러) — 사람마다 다른 덱
//  - structure: 'story'(서사) | 'metrics'(성과 선행) | 'compact'(요약) | 'detailed'(상세)
//  - design:    'editorial'(행) | 'cards'(카드 그리드) | 'timeline'(세로 타임라인) — 본문 배치
//  - cover:     'impact'(큰 이름) | 'profile'(정보 카드) | 'split'(좌측 컬러 패널)
//  - tone:      'calm'(절제) | 'vivid'(액센트 적극) | 'mono'(흑백)
//  - accentHex: 포인트 컬러 직접 지정('#RRGGBB')
//  - emphasis:  한 줄 강조 메시지 → 표지·마무리에 반영
export async function composePortfolioPptx(portfolio, templateBuffer, options = {}) {
  const structure = ['story', 'metrics', 'compact', 'detailed'].includes(options.structure) ? options.structure : 'story';
  const design = ['editorial', 'cards', 'timeline'].includes(options.design) ? options.design : 'editorial';
  const coverStyle = ['impact', 'profile', 'split', 'banner'].includes(options.cover) ? options.cover : 'impact';
  const tone = ['calm', 'vivid', 'mono'].includes(options.tone) ? options.tone : 'calm';
  const emphasis = typeof options.emphasis === 'string' ? options.emphasis : '';
  const accentHex = typeof options.accentHex === 'string' ? options.accentHex : '';
  // 프리셋 골격 정체성 — 없으면 기존 동작(헤더는 design 파생, 좌측 바, 다크 마무리)
  const headerStyle = ['underline', 'block', 'sidebar'].includes(options.headerStyle) ? options.headerStyle : '';
  const accentBar = ['left', 'top', 'none'].includes(options.accentBar) ? options.accentBar : 'left';
  const closing = ['dark', 'light', 'accent'].includes(options.closing) ? options.closing : 'dark';
  const cardStyle = ['pill', 'bar', 'numbered'].includes(options.cardStyle) ? options.cardStyle : 'pill';
  // 페이지 골격(배치) — 비어 있으면 structure/design 으로부터 추론(드롭다운 조합도 변주됨)
  let projectLayout = ['stack', 'rail', 'split'].includes(options.projectLayout) ? options.projectLayout : '';
  if (!projectLayout) {
    projectLayout = structure === 'metrics' ? 'split'
      : (structure === 'detailed' && design === 'cards') ? 'rail'
        : 'stack';
  }

  let dna = null;
  let frames = { cover: null, content: null };
  if (templateBuffer) {
    try { dna = await extractDesignDna(templateBuffer); } catch { /* 기본 테마 사용 */ }
    frames = await extractFrames(templateBuffer);
  }
  const T = makeTheme(dna, { tone, design, emphasis, accentHex, headerStyle, accentBar, closing, cardStyle });

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5in (16:9)
  pptx.author = 'Fitpoly';
  pptx.title = `${portfolio?.userName || ''} 포트폴리오`.trim();

  addCover(pptx, T, frames, portfolio, coverStyle);
  let no = 0;
  const num = () => String(no + 1).padStart(2, '0');

  if (structure === 'metrics' && addHighlights(pptx, T, frames, portfolio, num())) no++;
  if (structure === 'compact') {
    if (addIntroSkillsCombined(pptx, T, frames, portfolio, num())) no++;
  } else {
    if (addIntro(pptx, T, frames, portfolio, num())) no++;
    if (addSkills(pptx, T, frames, portfolio, num())) no++;
  }

  const bullets = Array.isArray(options.bullets) ? options.bullets : null; // AI 단답형 불릿(있으면 사용)
  nonEmpty(portfolio?.experiences).forEach((e, i) => {
    const sr = e.structuredResult || {};
    const hasMetrics = nonEmpty(sr.keyExperiences).length > 0;
    const ab = bullets ? bullets[i] : null;

    if (structure === 'compact') {
      // 요약: 프로젝트당 1장 (좌 본문 + 우 지표 — 자체 골격)
      addProjectCompact(pptx, T, frames, e, i, ab);
      return;
    }

    // 페이지 골격(배치)에 따라 슬라이드 구도 분기 — structure 가 facet 구성을 정한다
    if (projectLayout === 'rail') {
      // 좌측 컬러 패널(제목) + 우측 본문. 상세형이면 성과 장을 한 번 더(풍성하게)
      const rows = buildStoryRows(structure, sr, e, !hasMetrics, ab);
      addProjectRail(pptx, T, frames, e, i, rows);
      if (hasMetrics && structure === 'detailed') addProjectResults(pptx, T, frames, e, i);
      return;
    }
    if (projectLayout === 'split') {
      // 좌 본문(접근·배경) + 우측 성과 대시보드를 한 장에
      const rows = buildStoryRows(structure, sr, e, false, ab);
      addProjectSplit(pptx, T, frames, e, i, rows, nonEmpty(sr.keyExperiences), san(sr.output));
      return;
    }

    // stack(기본 골격) — structure 별 기존 동작
    if (structure === 'metrics') {
      // 성과 중심: 지표/성과를 먼저(있으면 RESULTS 장), 그다음 접근·배경
      if (hasMetrics || sr.output) addProjectResults(pptx, T, frames, e, i);
      const rows = buildStoryRows('metrics', sr, e, !(hasMetrics || sr.output), ab);
      addProjectStorySlide(pptx, T, frames, e, i, rows, '접근 & 배경');
      return;
    }
    if (structure === 'detailed') {
      // 상세: 5단 본문(역할/과정/배운 점 분리) + 성과 장 분리
      const rows = buildStoryRows('detailed', sr, e, !hasMetrics, ab);
      addProjectStorySlide(pptx, T, frames, e, i, rows);
      if (hasMetrics || sr.output) addProjectResults(pptx, T, frames, e, i);
      return;
    }
    // 스토리(기본): 문제→해결 서사, 지표 있으면 성과 장 분리
    const rows = buildStoryRows('story', sr, e, !hasMetrics, ab);
    addProjectStorySlide(pptx, T, frames, e, i, rows);
    if (hasMetrics) addProjectResults(pptx, T, frames, e, i);
  });

  if (addBackground(pptx, T, frames, portfolio, num())) no++;
  if (addGoals(pptx, T, frames, portfolio, num())) no++;
  addClosing(pptx, T, portfolio);

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
