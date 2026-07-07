// 직무별 시그니처 아티팩트 — 개발자의 "아키텍처 다이어그램·코드 추출"에 해당하는 각 직무의 킬러 시각화.
// PM=우선순위 매트릭스(Impact×Effort)·로드맵 간트 / 디자이너=더블 다이아몬드·작업물 쇼케이스·Before/After 슬라이더
// DA=A/B 실험 비교 차트 / AI/ML=베이스라인 대비 성능 차트
// 마케터=캠페인 전략 맵(타겟→채널→성과) / 세일즈=딜 규모 차트·파이프라인 칸반.
import { useState, useRef } from 'react';
import { Grid2X2, Gem, FlaskConical, Image as ImageIcon, Cpu, Trophy, Share2, Banknote, Building2, GanttChartSquare, KanbanSquare, MoveHorizontal } from 'lucide-react';
import { tint, SectionShell } from './JobVisuals';

const num = (v) => {
  const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

/* ── PM: 우선순위 매트릭스 (Impact × Effort 2×2) — 의사결정들을 좌표에 배치 ── */
const glyphW = (ch) => (/[가-힣ㄱ-ㅎ一-鿿]/.test(ch) ? 11 : 6.4);
const labelW = (t) => [...t].reduce((w, ch) => w + glyphW(ch), 0);
export function PriorityMatrix({ items, accent }) {
  if (!items?.length) return null;
  const W = 620, H = 400, L = 56, R = 20, T = 28, B = 48;
  const px = (effort) => L + ((effort - 0.5) / 5) * (W - L - R);
  const py = (impact) => H - B - ((impact - 0.5) / 5) * (H - T - B);
  const midX = px(3), midY = py(3);
  const QUADS = [
    { x: L, y: T, w: midX - L, h: midY - T, fill: tint(accent, 0.9), label: 'QUICK WIN', lx: L + 10, ly: T + 18 },
    { x: midX, y: T, w: W - R - midX, h: midY - T, fill: tint(accent, 0.96), label: '전략 과제', lx: W - R - 10, ly: T + 18, end: true },
    { x: L, y: midY, w: midX - L, h: H - B - midY, fill: '#f8fafc', label: '점진 개선', lx: L + 10, ly: H - B - 10 },
    { x: midX, y: midY, w: W - R - midX, h: H - B - midY, fill: '#f8fafc', label: '재검토', lx: W - R - 10, ly: H - B - 10, end: true },
  ];

  // 점 좌표가 겹치면 밀어내고, 라벨은 우/좌/하/상 순서로 빈 자리를 찾아 배치 (겹침·잘림 방지)
  const pts = [];
  items.slice(0, 5).forEach((it) => {
    let x = px(it.effort), y = py(it.impact);
    let guard = 0;
    while (guard++ < 12 && pts.some(p => Math.abs(p.x - x) < 26 && Math.abs(p.y - y) < 26)) {
      x += 24; y += 18;
      if (x > W - R - 20) x = L + 24 + (guard * 7) % 60;
      if (y > H - B - 16) y = T + 22 + (guard * 9) % 70;
    }
    pts.push({ ...it, x, y });
  });
  const boxes = pts.map(p => ({ x0: p.x - 11, x1: p.x + 11, y0: p.y - 11, y1: p.y + 11 }));
  const labels = pts.map(p => {
    const text = p.label.length > 17 ? `${p.label.slice(0, 16)}…` : p.label;
    const w = labelW(text), h = 14;
    const cands = [
      { x: p.x + 14, y: p.y + 4, anchor: 'start', x0: p.x + 14, x1: p.x + 14 + w },
      { x: p.x - 14, y: p.y + 4, anchor: 'end', x0: p.x - 14 - w, x1: p.x - 14 },
      { x: p.x, y: p.y + 24, anchor: 'middle', x0: p.x - w / 2, x1: p.x + w / 2 },
      { x: p.x, y: p.y - 16, anchor: 'middle', x0: p.x - w / 2, x1: p.x + w / 2 },
    ].map(c => ({ ...c, y0: c.y - h + 3, y1: c.y + 3 }));
    const fits = (c) => c.x0 >= L + 2 && c.x1 <= W - R - 2 && c.y0 >= T + 2 && c.y1 <= H - B - 2
      && !boxes.some(b => c.x1 > b.x0 && c.x0 < b.x1 && c.y1 > b.y0 && c.y0 < b.y1);
    const pick = cands.find(fits) || cands[0];
    boxes.push({ x0: pick.x0, x1: pick.x1, y0: pick.y0, y1: pick.y1 });
    return { text, ...pick };
  });

  return (
    <SectionShell icon={Grid2X2} title="우선순위 매트릭스 (Impact × Effort)" accent={accent}>
      <div className="overflow-x-auto rounded-2xl border border-surface-200 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 460, display: 'block', margin: '0 auto' }}>
          {QUADS.map((q, i) => (
            <g key={i}>
              <rect x={q.x} y={q.y} width={q.w} height={q.h} fill={q.fill} rx="8" />
              <text x={q.lx} y={q.ly} fontSize="10" fontWeight="800" letterSpacing="1.5" fill="#94a3b8" textAnchor={q.end ? 'end' : 'start'}>{q.label}</text>
            </g>
          ))}
          <line x1={midX} y1={T} x2={midX} y2={H - B} stroke="#e2e8f0" strokeWidth="1" />
          <line x1={L} y1={midY} x2={W - R} y2={midY} stroke="#e2e8f0" strokeWidth="1" />
          <text x={W - R} y={H - 14} fontSize="11" fontWeight="700" fill="#64748b" textAnchor="end">투입 리소스 →</text>
          <text x={14} y={T + 4} fontSize="11" fontWeight="700" fill="#64748b">임팩트 ↑</text>
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="9" fill={accent} stroke="#fff" strokeWidth="2.5" />
              <text x={p.x} y={p.y + 3.5} fontSize="9.5" fontWeight="900" fill="#fff" textAnchor="middle">{p.n}</text>
              <text x={labels[i].x} y={labels[i].y} fontSize="11.5" fontWeight="700" fill="#334155"
                textAnchor={labels[i].anchor} style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3.5 }}>{labels[i].text}</text>
            </g>
          ))}
        </svg>
        <p className="mt-2 text-center text-[10.5px] text-bluewood-300">번호는 아래 핵심 의사결정 카드 순서와 같습니다</p>
      </div>
    </SectionShell>
  );
}

/* ── 퍼포먼스 보드 — 핵심 경험에서 뽑은 대표 수치를 랭킹 보드로 (전 직무 공용, AI 데이터 불필요) ── */
export function MetricLeaderboard({ title, rows, accent, note }) {
  const list = (rows || []).filter(r => r.value).slice(0, 5);
  if (!list.length) return null;
  return (
    <SectionShell icon={Trophy} title={title} accent={accent}>
      <div className="overflow-hidden rounded-2xl border border-surface-200">
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, ${tint(accent, 0.55)})` }} />
        <div className="divide-y divide-surface-100">
          {list.map((r, i) => (
            <div key={i} className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
              <span className="w-9 flex-shrink-0 font-mono text-[19px] font-black leading-none" style={{ color: i === 0 ? accent : '#cbd5e1' }}>
                {String(r.n ?? i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-bluewood-800" title={r.name}>{r.name}</p>
                {r.before && r.after && (
                  <p className="mt-0.5 text-[11px] text-bluewood-400">
                    {r.before} <span className="text-bluewood-300">→</span> <span className="font-bold" style={{ color: accent }}>{r.after}</span>
                  </p>
                )}
              </div>
              <p className="flex-shrink-0 text-[21px] font-black leading-none tracking-tight" style={{ color: accent }}>{r.value}</p>
            </div>
          ))}
        </div>
        {note && <p className="border-t border-surface-100 bg-surface-50/60 px-4 py-2 text-[10.5px] text-bluewood-400 sm:px-5">{note}</p>}
      </div>
    </SectionShell>
  );
}

/* ── 디자이너: 더블 다이아몬드 — 발산·수렴 프로세스에 실제 수행 단계 매핑 ── */
const DD_PHASES = ['Discover', 'Define', 'Develop', 'Deliver'];
export function DoubleDiamond({ steps, accent }) {
  if (!steps || steps.length < 2) return null;
  const W = 680, H = 170, mid = 84, half = 62;
  const d1 = { l: 16, m: 178, r: 340 }, d2 = { l: 356, m: 518, r: 664 };
  const diamond = (d) => `M ${d.l},${mid} L ${d.m},${mid - half} L ${d.r},${mid} L ${d.m},${mid + half} Z`;
  // 실제 수행 단계를 4개 페이즈에 분배
  const cols = [[], [], [], []];
  steps.slice(0, 8).forEach((s, i) => cols[Math.min(3, Math.floor((i * 4) / Math.min(steps.length, 8)))].push({ ...s, n: i + 1 }));
  const centers = [(d1.l + d1.m) / 2, (d1.m + d1.r) / 2, (d2.l + d2.m) / 2, (d2.m + d2.r) / 2];
  return (
    <SectionShell icon={Gem} title="디자인 프로세스 (Double Diamond)" accent={accent}>
      <div className="rounded-2xl border border-surface-200 p-4 sm:p-5">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 560 }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
              <path d={diamond(d1)} fill={tint(accent, 0.93)} stroke={accent} strokeWidth="1.5" />
              <path d={diamond(d2)} fill={tint(accent, 0.93)} stroke={accent} strokeWidth="1.5" />
              <line x1={d1.m} y1={mid - half} x2={d1.m} y2={mid + half} stroke={accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.45" />
              <line x1={d2.m} y1={mid - half} x2={d2.m} y2={mid + half} stroke={accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.45" />
              {DD_PHASES.map((p, i) => (
                <text key={p} x={centers[i]} y={mid + 4} fontSize="13" fontWeight="800" fill="#0f2747" textAnchor="middle">{p}</text>
              ))}
              <text x={(d1.l + d1.r) / 2} y={16} fontSize="10" fontWeight="700" letterSpacing="1.2" fill="#94a3b8" textAnchor="middle">문제 발견 · 정의</text>
              <text x={(d2.l + d2.r) / 2} y={16} fontSize="10" fontWeight="700" letterSpacing="1.2" fill="#94a3b8" textAnchor="middle">해결안 개발 · 전달</text>
              <text x={d1.l} y={mid + half + 20} fontSize="9.5" fill="#94a3b8">발산</text>
              <text x={d1.m} y={mid + half + 20} fontSize="9.5" fill="#94a3b8" textAnchor="middle">수렴</text>
              <text x={d2.m} y={mid + half + 20} fontSize="9.5" fill="#94a3b8" textAnchor="middle">수렴</text>
            </svg>
            {/* 페이즈별 실제 수행 단계 */}
            <div className="mt-2 grid grid-cols-4 gap-2">
              {cols.map((col, ci) => (
                <div key={ci} className="space-y-1.5">
                  {col.map((st, si) => (
                    <div key={si} className="rounded-lg bg-surface-50 px-2 py-1.5" title={st.desc || ''}>
                      <p className="text-[11px] font-bold leading-snug text-bluewood-800">
                        <span className="mr-1 font-black" style={{ color: accent }}>{String(st.n).padStart(2, '0')}</span>{st.label}
                      </p>
                      {st.desc && <p className="mt-0.5 text-[10px] leading-[1.5] text-bluewood-400">{st.desc.length > 42 ? `${st.desc.slice(0, 41)}…` : st.desc}</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ── 디자이너: 작업물 쇼케이스 — 업로드한 화면·결과물 그리드 ── */
export function ImageShowcase({ images, accent }) {
  const list = (images || []).filter(im => im?.url).slice(0, 6);
  if (!list.length) return null;
  return (
    <SectionShell icon={ImageIcon} title="작업물 쇼케이스" accent={accent}>
      <div className={`grid gap-3 ${list.length === 1 ? '' : list.length === 2 ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {list.map((im, i) => (
          <figure key={i} className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
            <img src={im.url} alt={im.name || `작업물 ${i + 1}`} loading="lazy" className="h-44 w-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
            {im.name && <figcaption className="truncate px-3 py-2 text-[11px] font-medium text-bluewood-500">{im.name}</figcaption>}
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

/* ── 페어 비교 막대 — DA(대조군 vs 실험군) · AI/ML(베이스라인 vs 제안 모델) 공용 ── */
const PAIR_A = '#cbd5e1';
export function PairedBars({ title, rows, aLabel, bLabel, accent, icon = FlaskConical }) {
  const list = (rows || []).map(r => ({ ...r, an: num(r.a), bn: num(r.b) })).filter(r => r.an != null && r.bn != null);
  if (!list.length) return null;
  return (
    <SectionShell icon={icon} title={title} accent={accent}>
      <div className="rounded-2xl border border-surface-200 p-5">
        <div className="mb-4 flex items-center gap-4 text-[11.5px] text-bluewood-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PAIR_A }} /> {aLabel}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: accent }} /> {bLabel}</span>
        </div>
        <div className="space-y-4">
          {list.slice(0, 5).map((r, i) => {
            const max = Math.max(r.an, r.bn) || 1;
            const wA = Math.max(4, (r.an / max) * 100), wB = Math.max(4, (r.bn / max) * 100);
            const up = r.bn >= r.an;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="w-[120px] flex-shrink-0 pt-0.5">
                  <p className="truncate text-[12px] font-semibold text-bluewood-700" title={r.label}>{r.label}</p>
                  {r.note && <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">{r.note}</span>}
                </div>
                <div className="flex-1 space-y-[3px]">
                  <div className="flex items-center gap-2">
                    <div className="h-[13px] rounded-r-[4px]" style={{ width: `${wA * 0.82}%`, backgroundColor: PAIR_A }} />
                    <span className="text-[11px] font-semibold text-bluewood-400">{r.a}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-[13px] rounded-r-[4px]" style={{ width: `${wB * 0.82}%`, backgroundColor: accent }} />
                    <span className="text-[11.5px] font-black text-bluewood-800">{r.b}</span>
                    <span className={`text-[10.5px] font-bold ${up ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {r.an !== 0 ? `${up ? '+' : ''}${Math.round(((r.bn - r.an) / Math.abs(r.an)) * 1000) / 10}%` : ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}

/* ── 마케터: 캠페인 전략 맵 — 누구에게(타겟) → 어디서(채널) → 무엇을 얻었나(성과) 연결도 ── */
const truncTo = (text, maxW) => {
  let out = '';
  let w = 0;
  for (const ch of text) {
    w += glyphW(ch);
    if (w > maxW) return `${out}…`;
    out += ch;
  }
  return out;
};
export function CampaignFlow({ campaigns, accent }) {
  const list = (campaigns || []).filter(c => c.label && (c.target || c.channels?.length)).slice(0, 4);
  if (!list.length) return null;
  const targets = [...new Set(list.map(c => c.target).filter(Boolean))].slice(0, 4);
  const channels = [...new Set(list.flatMap(c => c.channels || []))].slice(0, 6);
  if (!channels.length && !targets.length) return null;

  // 컬럼 구성: 타겟·채널 중 데이터가 있는 것 + 캠페인(성과) — 2~3열
  const cols = [];
  if (targets.length) cols.push({ title: 'WHO · 타겟', items: targets.map(t => ({ id: `t:${t}`, label: t })) });
  if (channels.length) cols.push({ title: 'WHERE · 채널', items: channels.map(c => ({ id: `c:${c}`, label: c })) });
  cols.push({ title: 'RESULT · 캠페인 성과', items: list.map((c, i) => ({ id: `k:${i}`, label: c.label, kpi: c.kpi })) });

  const W = 680, headT = 30, pad = 14;
  const maxRows = Math.max(...cols.map(c => c.items.length));
  const H = headT + pad + Math.max(2, maxRows) * 58 + pad;
  const colW = W / cols.length;
  const boxW = (ci) => Math.min(colW - 36, cols[ci].items.some(it => it.kpi) ? 200 : 150);

  // 노드 좌표: 컬럼별 세로 균등 분배
  const pos = {};
  cols.forEach((col, ci) => {
    col.items.forEach((it, ri) => {
      const bw = boxW(ci);
      const bh = it.kpi ? 46 : 30;
      const cx = colW * ci + colW / 2;
      const cy = headT + pad + (H - headT - pad * 2) * ((ri + 0.5) / col.items.length);
      pos[it.id] = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, cx, cy, ...it };
    });
  });

  // 엣지: 타겟→채널(캠페인이 잇는 조합), 채널→캠페인 / 타겟만 있으면 타겟→캠페인
  const edges = [];
  list.forEach((c, i) => {
    const chs = (c.channels || []).filter(ch => pos[`c:${ch}`]);
    if (c.target && pos[`t:${c.target}`]) {
      if (chs.length) chs.forEach(ch => edges.push([`t:${c.target}`, `c:${ch}`]));
      else edges.push([`t:${c.target}`, `k:${i}`]);
    }
    chs.forEach(ch => edges.push([`c:${ch}`, `k:${i}`]));
  });
  const seen = new Set();
  const uniqEdges = edges.filter(([a, b]) => !seen.has(`${a}>${b}`) && seen.add(`${a}>${b}`));

  return (
    <SectionShell icon={Share2} title="캠페인 전략 맵 (타겟 → 채널 → 성과)" accent={accent}>
      <div className="overflow-x-auto rounded-2xl border border-surface-200 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, minWidth: 520, display: 'block', margin: '0 auto' }}>
          {cols.map((col, ci) => (
            <text key={ci} x={colW * ci + colW / 2} y={18} fontSize="10" fontWeight="800" letterSpacing="1.4" fill="#94a3b8" textAnchor="middle">{col.title}</text>
          ))}
          {uniqEdges.map(([a, b], i) => {
            const s0 = pos[a], t0 = pos[b];
            if (!s0 || !t0) return null;
            const x1 = s0.x + s0.w, y1 = s0.cy, x2 = t0.x, y2 = t0.cy;
            const mx = (x1 + x2) / 2;
            return <path key={i} d={`M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={tint(accent, 0.55)} strokeWidth="1.6" opacity="0.65" />;
          })}
          {Object.values(pos).map((p) => (
            <g key={p.id}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="9"
                fill={p.kpi ? tint(accent, 0.93) : '#fff'} stroke={p.kpi ? accent : '#e2e8f0'} strokeWidth={p.kpi ? 1.4 : 1} />
              <text x={p.cx} y={p.kpi ? p.y + 18 : p.cy + 4} fontSize="11.5" fontWeight="700" fill="#1e293b" textAnchor="middle">{truncTo(p.label, p.w - 16)}</text>
              {p.kpi && (
                <text x={p.cx} y={p.y + 36} fontSize="12.5" fontWeight="900" fill={accent} textAnchor="middle">{truncTo(p.kpi, p.w - 16)}</text>
              )}
            </g>
          ))}
        </svg>
        <p className="mt-2 text-center text-[10.5px] text-bluewood-300">핵심 캠페인의 타겟 · 집행 채널 · 대표 성과를 연결한 전략 구조입니다</p>
      </div>
    </SectionShell>
  );
}

/* ── 세일즈: 딜 규모 차트 — 계약 규모를 원화로 환산해 가로 막대로 비교 ── */
export function parseWon(v) {
  const t = String(v ?? '').replace(/,/g, '');
  const m = t.match(/(\d+(?:\.\d+)?)\s*(억|천만|만)?/);
  if (!m) return null;
  const mul = m[2] === '억' ? 1e8 : m[2] === '천만' ? 1e7 : m[2] === '만' ? 1e4 : 1;
  return parseFloat(m[1]) * mul;
}
export function TopDealsChart({ deals, accent }) {
  const list = (deals || []).slice().sort((a, b) => b.won - a.won).slice(0, 5);
  if (!list.length) return null;
  const max = list[0].won || 1;
  return (
    <SectionShell icon={Banknote} title="딜 규모 하이라이트" accent={accent}>
      <div className="rounded-2xl border border-surface-200 p-5">
        <div className="space-y-3.5">
          {list.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-[150px] flex-shrink-0">
                <p className="flex items-center gap-1.5 truncate text-[12px] font-bold text-bluewood-800" title={d.client || d.title}>
                  <Building2 size={12} className="flex-shrink-0" style={{ color: accent }} /> {d.client || d.title}
                </p>
                {d.client && d.title && <p className="mt-0.5 truncate pl-[18px] text-[10.5px] text-bluewood-400" title={d.title}>{d.title}</p>}
              </div>
              <div className="relative h-[22px] flex-1">
                <div className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${Math.max(5, (d.won / max) * 82)}%`, backgroundColor: i === 0 ? accent : tint(accent, 0.45) }} />
                <span className="absolute inset-y-0 flex items-center pl-2 text-[12px] font-black text-bluewood-800" style={{ left: `${Math.max(5, (d.won / max) * 82)}%` }}>{d.size}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3.5 border-t border-surface-100 pt-2.5 text-[10.5px] text-bluewood-400">핵심 딜의 계약 규모(ARR·MRR·계약 금액) 비교 — 아래 딜 카드 상세와 연결됩니다</p>
      </div>
    </SectionShell>
  );
}

/* ── 디자이너: Before/After 이미지 슬라이더 — 두 화면을 한 프레임에서 드래그로 대비 ── */
const BA_RE = { before: /(before|비포|개선\s*전|기존|변경\s*전|as[-\s]?is|old|이전|\b전\b)/i, after: /(after|애프터|개선\s*후|신규|변경\s*후|to[-\s]?be|new|이후|\b후\b)/i };
// 이미지 이름/캡션에서 before/after 쌍을 찾는다 (명시 라벨 → 인접 2장 폴백)
export function pickBeforeAfterPairs(images) {
  const list = (images || []).map((im, i) => ({ ...im, i, tag: String(im?.name || im?.caption || '') }));
  const befores = list.filter(x => BA_RE.before.test(x.tag) && !BA_RE.after.test(x.tag));
  const afters = list.filter(x => BA_RE.after.test(x.tag));
  const pairs = [];
  const used = new Set();
  befores.forEach(b => {
    const a = afters.find(x => !used.has(x.i) && x.i !== b.i);
    if (a) { pairs.push({ before: b, after: a, label: b.tag.replace(BA_RE.before, '').trim() || a.tag.replace(BA_RE.after, '').trim() }); used.add(a.i); used.add(b.i); }
  });
  return pairs.slice(0, 3);
}
function CompareSlider({ before, after, accent }) {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const drag = (clientX) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const onDown = (e) => {
    e.preventDefault();
    const move = (ev) => drag((ev.touches ? ev.touches[0] : ev).clientX);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} className="relative select-none overflow-hidden rounded-2xl border border-surface-200 bg-surface-50" style={{ touchAction: 'none' }}>
      <img src={after.url} alt="개선 후" className="block h-64 w-full object-cover sm:h-80" draggable="false" />
      {/* 개선 전 이미지는 전체 크기 유지, clip-path로 좌측만 노출 (width 클리핑 시 이미지 찌그러짐 방지) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before.url} alt="개선 전" className="block h-64 w-full object-cover sm:h-80" draggable="false" />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white" style={{ opacity: pos > 12 ? 1 : 0 }}>BEFORE</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: accent, opacity: pos < 88 ? 1 : 0 }}>AFTER</span>
      <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5" style={{ backgroundColor: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,.15)' }} />
        <button type="button" onPointerDown={onDown} aria-label="드래그해서 비교"
          className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 bg-white shadow-md"
          style={{ borderColor: accent }}>
          <MoveHorizontal size={16} style={{ color: accent }} />
        </button>
      </div>
    </div>
  );
}
export function BeforeAfterShowcase({ pairs, accent }) {
  const list = (pairs || []).filter(p => p.before?.url && p.after?.url).slice(0, 3);
  if (!list.length) return null;
  return (
    <SectionShell icon={ImageIcon} title="개선 전 · 후 비교" accent={accent}>
      <div className="space-y-4">
        {list.map((p, i) => (
          <figure key={i}>
            <CompareSlider before={p.before} after={p.after} accent={accent} />
            {p.label && <figcaption className="mt-2 text-center text-[12px] font-medium text-bluewood-500">{p.label}</figcaption>}
          </figure>
        ))}
      </div>
      <p className="mt-2 text-center text-[10.5px] text-bluewood-300">가운데 핸들을 드래그하면 개선 전/후가 겹쳐 비교됩니다</p>
    </SectionShell>
  );
}

/* ── PM: 로드맵 간트 — 기획 단계를 기간 막대로 배치 (start·span 상대 단위) ── */
export function RoadmapGantt({ phases, accent }) {
  const raw = (phases || []).map(p => ({ ...p, s: num(p.start), sp: num(p.span) })).filter(p => p.label);
  if (raw.length < 2) return null;
  // start/span 파싱 실패 시 순차 균등 배치로 폴백 (여전히 로드맵처럼 보임)
  const hasNum = raw.every(p => p.s != null && p.sp != null && p.sp > 0);
  const rows = hasNum ? raw : raw.map((p, i) => ({ ...p, s: i, sp: 1 }));
  const end = Math.max(...rows.map(r => r.s + r.sp));
  const start0 = Math.min(...rows.map(r => r.s));
  const total = (end - start0) || 1;
  const ticks = Math.min(6, Math.ceil(total));
  return (
    <SectionShell icon={GanttChartSquare} title="프로덕트 로드맵" accent={accent}>
      <div className="overflow-x-auto rounded-2xl border border-surface-200 p-5">
        <div style={{ minWidth: 460 }}>
          {/* 눈금 */}
          <div className="relative mb-2 ml-[132px] h-4">
            {Array.from({ length: ticks + 1 }).map((_, i) => (
              <span key={i} className="absolute top-0 -translate-x-1/2 text-[10px] font-medium text-bluewood-300" style={{ left: `${(i / ticks) * 100}%` }}>
                {hasNum ? `${Math.round(start0 + (total * i) / ticks)}` : ''}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {rows.slice(0, 8).map((r, i) => {
              const left = ((r.s - start0) / total) * 100;
              const w = Math.max(4, (r.sp / total) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-[120px] flex-shrink-0 truncate text-right text-[12px] font-semibold text-bluewood-700" title={r.label}>{r.label}</span>
                  <div className="relative h-7 flex-1 rounded-md bg-surface-50">
                    <div className="absolute inset-y-1 flex items-center rounded-md px-2 text-[11px] font-bold text-white"
                      style={{ left: `${left}%`, width: `${w}%`, backgroundColor: tint(accent, 0.15 * (i % 3)) }} title={r.desc || r.label}>
                      <span className="truncate">{r.desc ? '' : r.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hasNum && <p className="mt-3 text-center text-[10.5px] text-bluewood-300">가로축은 진행 기간(주·월 등 상대 단위)입니다</p>}
        </div>
      </div>
    </SectionShell>
  );
}

/* ── 세일즈: 파이프라인 칸반 — 딜을 진행 단계 컬럼에 배치 ── */
const KANBAN_STAGES = ['리드', '미팅', '제안', '협상', '계약'];
const STAGE_ALIAS = [
  { re: /계약|클로징|클로즈|won|성사|수주/i, stage: '계약' },
  { re: /협상|negoti/i, stage: '협상' },
  { re: /제안|견적|proposal|quote|pf|pt|데모/i, stage: '제안' },
  { re: /미팅|미터|meeting|상담|컨택|qualif/i, stage: '미팅' },
  { re: /리드|lead|발굴|inbound|아웃바운드|prospect/i, stage: '리드' },
];
export function normalizeStage(v) {
  const t = String(v ?? '');
  if (KANBAN_STAGES.includes(t.trim())) return t.trim();
  const hit = STAGE_ALIAS.find(a => a.re.test(t));
  return hit ? hit.stage : null;
}
export function PipelineKanban({ deals, accent }) {
  const list = (deals || []).filter(d => d.stage && d.label);
  if (list.length < 2) return null;
  const cols = KANBAN_STAGES.map(st => ({ st, items: list.filter(d => d.stage === st) })).filter(c => c.items.length);
  if (cols.length < 2) return null;
  return (
    <SectionShell icon={KanbanSquare} title="세일즈 파이프라인" accent={accent}>
      <div className="overflow-x-auto rounded-2xl border border-surface-200 p-4">
        <div className="flex gap-3" style={{ minWidth: cols.length * 150 }}>
          {cols.map((c, ci) => (
            <div key={ci} className="flex-1" style={{ minWidth: 140 }}>
              <div className="mb-2 flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ backgroundColor: tint(accent, 0.9) }}>
                <span className="text-[11.5px] font-extrabold" style={{ color: accent }}>{c.st}</span>
                <span className="font-mono text-[11px] font-bold text-bluewood-400">{c.items.length}</span>
              </div>
              <div className="space-y-2">
                {c.items.slice(0, 5).map((d, i) => (
                  <div key={i} className="rounded-lg border border-surface-200 bg-white p-2.5">
                    <p className="truncate text-[12px] font-bold text-bluewood-800" title={d.client || d.label}>{d.client || d.label}</p>
                    {d.client && <p className="mt-0.5 truncate text-[10.5px] text-bluewood-400" title={d.label}>{d.label}</p>}
                    {d.size && <p className="mt-1 text-[12px] font-black" style={{ color: accent }}>{d.size}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

export const AimlIcon = Cpu;
