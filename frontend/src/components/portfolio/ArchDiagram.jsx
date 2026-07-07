import { useEffect, useRef } from 'react';

/* 시스템 아키텍처 다이어그램 (읽기 전용 SVG 렌더 + 레이아웃 헬퍼) — 개발자 포트폴리오·케이스 스터디 공용 */

const ACCENT = '#002F6C';

function truncate(s, n) {
  const str = String(s || '');
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/* ── SVG 텍스트 폭 추정 & 줄바꿈 (글자 잘림 방지) ── */
function glyphW(ch, fs) {
  // CJK(한글/한자/가나)는 거의 정사각형, 라틴/숫자/기호는 좁게
  return /[ᄀ-ᇿ　-鿿가-힣＀-￯]/.test(ch) ? fs * 1.02 : fs * 0.56;
}
function textWidth(str, fs) {
  let w = 0;
  for (const ch of String(str)) w += glyphW(ch, fs);
  return w;
}
function wrapText(str, fs, maxW, maxLines) {
  const words = String(str || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (!cur || textWidth(test, fs) <= maxW) {
      cur = test;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // 마지막 줄이 여전히 넘치면 말줄임
  if (lines.length) {
    let last = lines[lines.length - 1];
    while (textWidth(last, fs) > maxW && last.length > 1) last = last.slice(0, -1);
    if (last !== lines[lines.length - 1]) lines[lines.length - 1] = `${last.replace(/…$/, '')}…`;
  }
  return lines;
}

/* ── 박스 + 화살표 연결선 레이아웃 상수 ── */
const FS_LABEL = 13, FS_TECH = 10.5, MAX_TEXT_W = 186;
const ROW_GAP = 62, COL_GAP = 34, PAD_X = 16, PAD_Y = 12;
const LINE_LABEL = 17, LINE_TECH = 14;
export const PAD = 18;

// 노드별 텍스트 줄바꿈 + 박스 크기 (커스텀 w/h 우선, 없으면 내용에 맞춰 자동)
export function computeNodeMetrics(nodes) {
  const metrics = {};
  nodes.forEach(n => {
    const customW = Number.isFinite(n.w) ? n.w : null;
    const wrapW = customW ? Math.max(40, customW - PAD_X * 2) : MAX_TEXT_W;
    const maxLines = customW ? 3 : 2;
    const labelLines = wrapText(n.label, FS_LABEL, wrapW, maxLines);
    const techLines = n.tech ? wrapText(n.tech, FS_TECH, wrapW, maxLines) : [];
    const contentW = Math.max(
      1,
      ...labelLines.map(l => textWidth(l, FS_LABEL)),
      ...techLines.map(l => textWidth(l, FS_TECH)),
    );
    const w = customW || Math.min(MAX_TEXT_W + PAD_X * 2, Math.max(120, Math.ceil(contentW) + PAD_X * 2));
    const autoH = PAD_Y * 2 + labelLines.length * LINE_LABEL + (techLines.length ? 4 + techLines.length * LINE_TECH : 0);
    const h = Number.isFinite(n.h) ? Math.max(n.h, autoH) : autoH;
    metrics[n.id] = { w, h, labelLines, techLines };
  });
  return metrics;
}

// x·y 좌표가 없는 노드용 tier(층) 기반 자동 배치 → { id: {x, y} }
export function autoLayoutPositions(nodes, metrics) {
  const tiers = [...new Set(nodes.map(n => Number(n.tier) || 0))].sort((a, b) => a - b);
  const rows = tiers.map(t => nodes.filter(n => (Number(n.tier) || 0) === t));
  const rowW = rows.map(row => row.reduce((s, n) => s + metrics[n.id].w, 0) + Math.max(0, row.length - 1) * COL_GAP);
  const rowH = rows.map(row => Math.max(...row.map(n => metrics[n.id].h)));
  const maxRowW = Math.max(0, ...rowW);
  const pos = {};
  let curY = PAD;
  rows.forEach((row, ri) => {
    let x = PAD + (maxRowW - rowW[ri]) / 2;
    row.forEach(n => {
      const m = metrics[n.id];
      pos[n.id] = { x, y: curY + (rowH[ri] - m.h) / 2 };
      x += m.w + COL_GAP;
    });
    curY += rowH[ri] + ROW_GAP;
  });
  return pos;
}

export const hasXY = (n) => Number.isFinite(n?.x) && Number.isFinite(n?.y);

// 기술스택 → 기본 아키텍처 구조 자동 생성 (AI가 다이어그램을 못 만들었을 때 폴백)
const CLIENT_KW = /react|vue|next|nuxt|vite|tailwind|angular|svelte|redux|zustand|recoil|flutter|swiftui|jetpack|android|ios|html|css|프론트|웹앱/i;
const DATA_KW = /postgre|mysql|mariadb|mongo|redis|firestore|firebase|dynamo|sqlite|elasticsearch|cassandra|storage|데이터베이스|\brds\b|\bdb\b/i;
const EXTERNAL_KW = /gemini|openai|gpt|claude|llm|stripe|oauth|kakao|naver|google\s?api|\bs3\b|\bses\b|\bsns\b|\bsqs\b|kafka|rabbitmq/i;
function classifyTech(t) {
  if (EXTERNAL_KW.test(t)) return 'external';
  if (DATA_KW.test(t)) return 'data';
  if (CLIENT_KW.test(t)) return 'client';
  return 'server';
}
export function buildFallbackDiagram(techs) {
  const list = [...new Set((techs || []).map(s => String(s).trim()).filter(Boolean))];
  if (list.length === 0) return null;
  const buckets = { client: [], server: [], data: [], external: [] };
  list.forEach(t => buckets[classifyTech(t)].push(t));
  const nodes = [];
  const push = (id, label, arr, tier) => { if (arr.length) nodes.push({ id, label, tech: arr.slice(0, 4).join(', '), tier }); };
  push('client', '클라이언트', buckets.client, 0);
  push('server', '서버 / API', buckets.server, 1);
  push('data', '데이터베이스', buckets.data, 2);
  push('external', '외부 서비스', buckets.external, 2);
  if (nodes.length < 2) return null;
  const has = (id) => nodes.some(n => n.id === id);
  const edges = [];
  if (has('client') && has('server')) edges.push({ from: 'client', to: 'server', label: 'API 요청' });
  if (has('server') && has('data')) edges.push({ from: 'server', to: 'data', label: '조회/저장' });
  if (has('server') && has('external')) edges.push({ from: 'server', to: 'external', label: '연동' });
  if (!has('server')) {
    if (has('client') && has('data')) edges.push({ from: 'client', to: 'data', label: '직접 접근' });
    if (has('client') && has('external')) edges.push({ from: 'client', to: 'external', label: '연동' });
  }
  return { nodes, edges };
}

export function ArchitectureDiagram({ diagram, editable = false, canvas = null, onNodeMove }) {
  const nodes = (diagram?.nodes || []).filter(n => n.label);
  const edges = diagram?.edges || [];
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const metrics = computeNodeMetrics(nodes);
  const auto = autoLayoutPositions(nodes, metrics);
  const posOf = (n) => {
    const base = hasXY(n) ? { x: n.x, y: n.y } : (auto[n.id] || { x: PAD, y: PAD });
    const m = metrics[n.id];
    return { x: base.x, y: base.y, w: m.w, h: m.h, cx: base.x + m.w / 2, top: base.y, bottom: base.y + m.h, ...m };
  };

  // 캔버스 크기: 편집 중엔 고정(드래그 중 흔들림 방지), 보기 모드는 내용에 맞춤
  let VW, VH;
  if (editable && canvas) {
    VW = canvas.w; VH = canvas.h;
  } else {
    let maxX = 0, maxY = 0;
    nodes.forEach(n => { const p = posOf(n); maxX = Math.max(maxX, p.x + p.w); maxY = Math.max(maxY, p.y + p.h); });
    VW = Math.max(480, Math.ceil(maxX) + PAD);
    VH = Math.max(120, Math.ceil(maxY) + PAD);
  }

  const toSvg = (clientX, clientY) => {
    const r = svgRef.current.getBoundingClientRect();
    return { x: (clientX - r.left) * (VW / r.width), y: (clientY - r.top) * (VH / r.height) };
  };
  const onMove = (ev) => {
    const d = dragRef.current;
    if (!d) return;
    const s = toSvg(ev.clientX, ev.clientY);
    const nx = Math.max(0, Math.min(VW - d.w, s.x - d.dx));
    const ny = Math.max(0, Math.min(VH - d.h, s.y - d.dy));
    onNodeMove?.(d.id, Math.round(nx), Math.round(ny));
  };
  const onUp = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  const onDown = (ev, n) => {
    if (!editable) return;
    ev.preventDefault();
    const p = posOf(n);
    const s = toSvg(ev.clientX, ev.clientY);
    dragRef.current = { id: n.id, dx: s.x - p.x, dy: s.y - p.y, w: p.w, h: p.h };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }); // 언마운트 시 리스너 정리

  if (nodes.length === 0) return null;
  const topTier = Math.min(...nodes.map(n => Number(n.tier) || 0));

  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50/30 p-4 sm:p-6 overflow-x-auto">
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} width="100%"
        style={{ maxWidth: VW, minWidth: Math.min(VW, 460), display: 'block', margin: '0 auto', touchAction: editable ? 'none' : 'auto' }}>
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* 연결선 */}
        {edges.map((e, i) => {
          const s = posOf(nodes.find(n => n.id === e.from) || {});
          const t = posOf(nodes.find(n => n.id === e.to) || {});
          if (!nodes.find(n => n.id === e.from) || !nodes.find(n => n.id === e.to)) return null;
          const down = t.top >= s.bottom;
          const sy = down ? s.bottom : s.top;
          const ty = down ? t.top : t.bottom;
          // 저장된 제어점(mx,my)이 있으면 그 지점으로 선이 휘고 라벨도 거기에
          const mx = Number.isFinite(e.mx) ? e.mx : (s.cx + t.cx) / 2;
          const my = Number.isFinite(e.my) ? e.my : (sy + ty) / 2;
          const label = e.label ? truncate(e.label, 22) : '';
          const lw = label ? textWidth(label, 10) + 8 : 0;
          const d = `M ${s.cx} ${sy} Q ${mx} ${my} ${t.cx} ${ty}`;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arch-arrow)" />
              {label && (
                <>
                  <rect x={mx - lw / 2} y={my - 9} width={lw} height={14} rx="3" fill="#f8fafc" opacity="0.92" />
                  <text x={mx} y={my + 1} textAnchor="middle" fontSize="10" fill="#64748b">{label}</text>
                </>
              )}
            </g>
          );
        })}

        {/* 노드 박스 (자동 크기 + 줄바꿈, 편집 시 드래그) */}
        {nodes.map((n, i) => {
          const p = posOf(n);
          const accent = (Number(n.tier) || 0) === topTier;
          const ty = p.y + PAD_Y + FS_LABEL - 2;
          return (
            <g key={n.id || i} onPointerDown={editable ? (ev) => onDown(ev, n) : undefined}
              style={editable ? { cursor: 'grab' } : undefined}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="11"
                fill="#ffffff" stroke={accent ? ACCENT : '#cbd5e1'} strokeWidth={accent ? 1.9 : 1.2} />
              {p.labelLines.map((line, li) => (
                <text key={`l${li}`} x={p.cx} y={ty + li * LINE_LABEL} textAnchor="middle" fontSize={FS_LABEL} fontWeight="700" fill="#0f2747" style={{ userSelect: 'none', pointerEvents: 'none' }}>{line}</text>
              ))}
              {p.techLines.map((line, li) => (
                <text key={`t${li}`} x={p.cx} y={p.y + PAD_Y + p.labelLines.length * LINE_LABEL + 4 + FS_TECH + li * LINE_TECH - 3} textAnchor="middle" fontSize={FS_TECH} fill="#64748b" style={{ userSelect: 'none', pointerEvents: 'none' }}>{line}</text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
