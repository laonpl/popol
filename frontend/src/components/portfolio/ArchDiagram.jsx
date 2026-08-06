import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/* 시스템 아키텍처 다이어그램 (읽기 전용 SVG 렌더 + 편집 캔버스 + 레이아웃 헬퍼) — 개발자 포트폴리오·케이스 스터디 공용 */

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
  // 언마운트 시에만 리스너 정리 — 의존성 없이 매 렌더 정리하면 드래그 중 상태 갱신마다
  // 리스너가 끊겨 박스가 한 틱씩만 움직인다 (이동/리사이즈가 부드럽게 이어지지 않는 원인)
  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

/* ── 아키텍처 편집 캔버스 (HTML div 박스: 드래그·리사이즈·인라인 편집 + SVG 연결선) ── */
const EDIT_W = 168, EDIT_H = 76, EDIT_MIN_W = 112, EDIT_MIN_H = 64;
const rectOf = (n) => ({
  x: Number.isFinite(n.x) ? n.x : 0,
  y: Number.isFinite(n.y) ? n.y : 0,
  w: Number.isFinite(n.w) ? n.w : EDIT_W,
  h: Number.isFinite(n.h) ? n.h : EDIT_H,
});

export function ArchitectureEditorCanvas({ nodes, edges, canvas, onMoveNode, onResizeNode, onUpdateNode, onRemoveNode, onMoveEdge, onUpdateEdge, onRemoveEdge, onConnect }) {
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const [connect, setConnect] = useState(null); // 포트 드래그로 노드 연결 중 { from, x, y }
  const W = canvas.w, H = canvas.h;

  const toCanvas = (e) => {
    const el = wrapRef.current;
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  };
  const nodeAt = (x, y) => nodes.find(n => { const r = rectOf(n); return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; });

  // 엣지 기하: 시작/끝 앵커 + 제어점(mx,my). 커스텀 mx/my 있으면 그 지점으로 선이 휘고 라벨도 그 자리.
  const edgeGeom = (e) => {
    const sn = nodes.find(n => n.id === e.from), tn = nodes.find(n => n.id === e.to);
    if (!sn || !tn) return null;
    const s = rectOf(sn), t = rectOf(tn);
    const scx = s.x + s.w / 2, tcx = t.x + t.w / 2;
    const down = (t.y + t.h / 2) >= (s.y + s.h / 2);
    const sy = down ? s.y + s.h : s.y;
    const ty = down ? t.y : t.y + t.h;
    const mx = Number.isFinite(e.mx) ? e.mx : (scx + tcx) / 2;
    const my = Number.isFinite(e.my) ? e.my : (sy + ty) / 2;
    return { scx, sy, tcx, ty, mx, my };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    const dx = p.x - d.startX, dy = p.y - d.startY;
    if (d.kind === 'edge') {
      onMoveEdge(d.idx, Math.round(Math.max(0, Math.min(W, d.omx + dx))), Math.round(Math.max(0, Math.min(H, d.omy + dy))));
      return;
    }
    if (d.mode === 'move') {
      const nx = Math.max(0, Math.min(W - d.ow, d.ox + dx));
      const ny = Math.max(0, Math.min(H - d.oh, d.oy + dy));
      onMoveNode(d.id, Math.round(nx), Math.round(ny));
    } else {
      let { ox: nx, oy: ny, ow: nw, oh: nh } = d;
      if (d.mode.includes('e')) nw = Math.min(W - d.ox, Math.max(EDIT_MIN_W, d.ow + dx));
      if (d.mode.includes('s')) nh = Math.min(H - d.oy, Math.max(EDIT_MIN_H, d.oh + dy));
      if (d.mode.includes('w')) { nw = Math.max(EDIT_MIN_W, d.ow - dx); nx = Math.max(0, d.ox + (d.ow - nw)); }
      if (d.mode.includes('n')) { nh = Math.max(EDIT_MIN_H, d.oh - dy); ny = Math.max(0, d.oy + (d.oh - nh)); }
      onResizeNode(d.id, { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) });
    }
  };
  const onPointerUp = () => {
    drag.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };
  const startNodeDrag = (e, n, mode) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e);
    const r = rectOf(n);
    drag.current = { kind: 'node', id: n.id, mode, startX: p.x, startY: p.y, ox: r.x, oy: r.y, ow: r.w, oh: r.h };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };
  const startEdgeDrag = (e, idx, g) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e);
    drag.current = { kind: 'edge', idx, startX: p.x, startY: p.y, omx: g.mx, omy: g.my };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // 포트에서 드래그 → 다른 박스 위에서 놓으면 연결(화살표) 생성
  const onConnectMove = (e) => { const p = toCanvas(e); setConnect(c => (c ? { ...c, x: p.x, y: p.y } : c)); };
  const onConnectUp = (e) => {
    window.removeEventListener('pointermove', onConnectMove);
    window.removeEventListener('pointerup', onConnectUp);
    const p = toCanvas(e);
    const target = nodeAt(p.x, p.y);
    setConnect(c => { if (c && target && target.id !== c.from) onConnect(c.from, target.id); return null; });
  };
  const startConnect = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    const p = toCanvas(e);
    setConnect({ from: nodeId, x: p.x, y: p.y });
    window.addEventListener('pointermove', onConnectMove);
    window.addEventListener('pointerup', onConnectUp);
  };

  // 언마운트 시에만 리스너 정리 — 매 렌더 정리하면 드래그(이동·리사이즈·연결) 중
  // 첫 상태 갱신에서 리스너가 제거돼 한 틱씩만 움직이는 문제가 생긴다
  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointermove', onConnectMove);
    window.removeEventListener('pointerup', onConnectUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const CORNERS = [
    { k: 'nw', cls: 'left-[-5px] top-[-5px] cursor-nwse-resize' },
    { k: 'ne', cls: 'right-[-5px] top-[-5px] cursor-nesw-resize' },
    { k: 'sw', cls: 'left-[-5px] bottom-[-5px] cursor-nesw-resize' },
    { k: 'se', cls: 'right-[-5px] bottom-[-5px] cursor-nwse-resize' },
  ];
  const PORTS = [
    { k: 't', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2' },
    { k: 'b', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2' },
    { k: 'l', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
    { k: 'r', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
  ];

  const connFrom = connect ? rectOf(nodes.find(n => n.id === connect.from) || {}) : null;

  return (
    <div ref={wrapRef} className="relative overflow-auto rounded-2xl border border-surface-200 bg-surface-50/30" style={{ maxHeight: 560 }}>
      <div className="relative" style={{ width: W, height: H }}>
        {/* 연결선 (제어점 통과 곡선) + 연결 중 임시 선 */}
        <svg width={W} height={H} className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          <defs>
            <marker id="edit-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const g = edgeGeom(e);
            if (!g) return null;
            return <path key={i} d={`M ${g.scx} ${g.sy} Q ${g.mx} ${g.my} ${g.tcx} ${g.ty}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#edit-arrow)" />;
          })}
          {connect && connFrom && (
            <line x1={connFrom.x + connFrom.w / 2} y1={connFrom.y + connFrom.h / 2} x2={connect.x} y2={connect.y}
              stroke="#2563eb" strokeWidth="1.8" strokeDasharray="5 4" markerEnd="url(#edit-arrow)" />
          )}
        </svg>

        {/* 박스 */}
        {nodes.map(n => {
          const r = rectOf(n);
          return (
            <div key={n.id}
              onPointerDown={(e) => startNodeDrag(e, n, 'move')}
              className="group absolute flex flex-col overflow-visible rounded-xl border border-primary-300 bg-white shadow-sm"
              style={{ left: r.x, top: r.y, width: r.w, height: r.h, cursor: 'grab', touchAction: 'none' }}>
              {/* 드래그 핸들 바 (확실한 이동 그립) */}
              <div onPointerDown={(e) => startNodeDrag(e, n, 'move')} title="드래그해서 이동"
                className="flex h-4 flex-shrink-0 items-center justify-center gap-[3px] rounded-t-xl bg-surface-100/70 hover:bg-surface-100"
                style={{ cursor: 'grab' }}>
                <span className="h-[3px] w-[3px] rounded-full bg-bluewood-300" />
                <span className="h-[3px] w-[3px] rounded-full bg-bluewood-300" />
                <span className="h-[3px] w-[3px] rounded-full bg-bluewood-300" />
              </div>
              <div className="flex flex-1 flex-col justify-center gap-0.5 px-2.5 py-1">
                <input value={n.label || ''} onChange={(e) => onUpdateNode(n.id, { label: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()} placeholder="컴포넌트명"
                  className="w-full bg-transparent text-center text-[12.5px] font-bold text-bluewood-900 outline-none placeholder:text-bluewood-300" />
                <input value={n.tech || ''} onChange={(e) => onUpdateNode(n.id, { tech: e.target.value })}
                  onPointerDown={(e) => e.stopPropagation()} placeholder="기술·역할"
                  className="w-full bg-transparent text-center text-[11.5px] text-bluewood-500 outline-none placeholder:text-bluewood-300" />
              </div>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onRemoveNode(n.id)}
                className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-surface-200 bg-white text-bluewood-400 shadow-sm hover:text-red-500 group-hover:flex">
                <X size={11} />
              </button>
              {/* 연결 포트 (드래그해서 다른 박스로) */}
              {PORTS.map(pt => (
                <div key={pt.k} onPointerDown={(e) => startConnect(e, n.id)} title="드래그해서 다른 박스로 연결"
                  className={`absolute z-10 h-3 w-3 rounded-full border-2 border-white bg-primary-500 opacity-0 shadow transition-opacity hover:scale-125 group-hover:opacity-100 ${pt.cls}`}
                  style={{ cursor: 'crosshair' }} />
              ))}
              {CORNERS.map(c => (
                <div key={c.k} onPointerDown={(e) => startNodeDrag(e, n, c.k)}
                  className={`absolute h-[10px] w-[10px] rounded-sm border border-primary-400 bg-white opacity-0 transition-opacity group-hover:opacity-100 ${c.cls}`} />
              ))}
            </div>
          );
        })}

        {/* 엣지 컨트롤 (드래그 이동 + 라벨 인라인 편집) */}
        {edges.map((e, i) => {
          const g = edgeGeom(e);
          if (!g) return null;
          return (
            <div key={`e${i}`}
              onPointerDown={(ev) => startEdgeDrag(ev, i, g)}
              title="드래그해서 선 이동"
              className="group absolute flex items-center gap-1 rounded-full border border-primary-300 bg-white/95 py-0.5 pl-1 pr-1.5 shadow-sm"
              style={{ left: g.mx, top: g.my, transform: 'translate(-50%, -50%)', cursor: 'move', touchAction: 'none' }}>
              <span className="flex flex-col gap-[2px] px-0.5 text-bluewood-300" title="드래그해서 선 이동">
                <span className="h-[2px] w-[7px] rounded-full bg-current" />
                <span className="h-[2px] w-[7px] rounded-full bg-current" />
              </span>
              <input value={e.label || ''} onChange={(ev) => onUpdateEdge(i, { label: ev.target.value })}
                onPointerDown={(ev) => ev.stopPropagation()} placeholder="라벨"
                style={{ width: `${Math.max(46, (e.label || '').length * 7 + 16)}px` }}
                className="bg-transparent text-center text-[11.5px] text-bluewood-600 outline-none placeholder:text-bluewood-300" />
              <button onPointerDown={(ev) => ev.stopPropagation()} onClick={() => onRemoveEdge(i)}
                className="hidden text-bluewood-300 hover:text-red-500 group-hover:block"><X size={10} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
