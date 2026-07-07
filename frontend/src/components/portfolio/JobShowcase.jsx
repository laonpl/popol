// 직무별 SaaS 쇼케이스 — 각 직무 페이지의 센터피스. 실제 툴을 옮겨놓은 듯한 라이브 대시보드 모듈.
// aiml=W&B 훈련 모니터(로스 곡선·GPU·RAG 파이프라인) / da=Tableau식 탐색 대시보드(필터·드릴다운·코드)
// devops=Grafana 콘솔(라이브 지표·CI/CD 애니메이션) / pm=인터랙티브 로드맵+Before/After KPI
// designer=리빙 디자인 시스템(토큰↔컴포넌트 스플릿뷰) / marketer=교차채널 광고 대시보드+CTR 히트맵
// hr=리크루팅 퍼널+스케줄링 자동화 / sales=ROI 계산기+아웃바운드 시퀀스.
// 원칙: 실수치(추출 지표)는 배지·위젯에 고정, 시계열이 없는 곡선·히트맵은 결정적 시뮬레이션(연출)로 채워 항상 렌더.
import { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Cpu, Database, Filter, GitBranch, Gauge, CalendarClock, MousePointerClick, Calculator, Palette, Zap, ArrowRight, Users, Slack, Video, Mail, Phone, MonitorPlay } from 'lucide-react';
import { tint } from './JobVisuals';

/* ── 공용 헬퍼 ── */
const numOf = (v) => {
  const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
// 결정적 의사난수 — 렌더마다 흔들리지 않게 seed 고정
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;

// 카운트업 — Before/After KPI 위젯용
function useCountUp(target, dur = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}
const fmt1 = (v) => (Math.round(v * 10) / 10).toLocaleString();

/* ── 쇼케이스 애니메이션 키프레임 (1회 주입) ── */
const SHOWCASE_CSS = `
@keyframes jsDraw { to { stroke-dashoffset: 0; } }
@keyframes jsFlow { to { background-position: 28px 0; } }
@keyframes jsGpu { 0%,100% { transform: scaleY(.45); } 50% { transform: scaleY(1); } }
@keyframes jsSlide { to { transform: translateX(-50%); } }
@keyframes jsStage { 0%,14% { opacity:1; box-shadow:0 0 0 4px rgba(255,255,255,.18);} 20%,100% { opacity:.45; box-shadow:none; } }
@keyframes jsGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes jsGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { .js-anim, .js-anim * { animation: none !important; } }
`;

/* ── SaaS 창 프레임 — 브라우저 크롬 + LIVE 배지로 "제품" 느낌 통일 ── */
function Frame({ title, badge = 'LIVE', accent, dark = false, children }) {
  const dot = dark ? tint(accent, 0.5) : accent;
  return (
    <div className={`js-anim overflow-hidden rounded-2xl border shadow-card ${dark ? 'border-white/10 bg-[#0e1626]' : 'border-surface-200 bg-white'}`}>
      <div className={`flex items-center gap-2.5 border-b px-4 py-2.5 ${dark ? 'border-white/10' : 'border-surface-100 bg-surface-50/60'}`}>
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: dot }} />
        <span className={`truncate font-mono text-[11px] font-bold ${dark ? 'text-white/60' : 'text-bluewood-500'}`}>{title}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-black tracking-wider"
          style={{ backgroundColor: dark ? 'rgba(255,255,255,.08)' : tint(accent, 0.92), color: dot }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: dot }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
          </span>
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── 라인 차트 (SVG) — 호버 크로스헤어 + 그리기 애니메이션 ── */
function LineChart({ series, labels, colors, h = 150, yFmt = (v) => v.toFixed(2), accent }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const W = 560, H = h, L = 38, R = 10, T = 10, B = 20;
  const all = series.flat();
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const n = series[0].length;
  const px = (i) => L + ((W - L - R) * i) / (n - 1);
  const py = (v) => T + (H - T - B) * (1 - (v - min) / span);
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'} ${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((x - L) / (W - L - R)) * (n - 1)))));
  };
  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} width="100%" onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', cursor: 'crosshair' }}>
        {[0, 0.5, 1].map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={T + (H - T - B) * t} y2={T + (H - T - B) * t} stroke="currentColor" strokeOpacity="0.08" />
            <text x={L - 5} y={T + (H - T - B) * t + 3.5} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4">{yFmt(max - span * t)}</text>
          </g>
        ))}
        {series.map((arr, si) => (
          <path key={si} d={path(arr)} fill="none" stroke={colors[si]} strokeWidth="2"
            strokeDasharray="1200" strokeDashoffset="1200" style={{ animation: `jsDraw 1.4s ${si * 0.25}s ease forwards` }} />
        ))}
        {hover != null && (
          <g>
            <line x1={px(hover)} x2={px(hover)} y1={T} y2={H - B} stroke={accent} strokeOpacity="0.4" strokeDasharray="3 3" />
            {series.map((arr, si) => <circle key={si} cx={px(hover)} cy={py(arr[hover])} r="3.5" fill={colors[si]} stroke="#fff" strokeWidth="1.5" />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-[10.5px] shadow-md"
          style={{ left: `${(px(hover) / W) * 100}%`, top: 0, transform: `translateX(${hover > n * 0.6 ? '-108%' : '8%'})` }}>
          <p className="font-mono font-bold text-bluewood-400">step {hover + 1}</p>
          {series.map((arr, si) => (
            <p key={si} className="font-mono font-black" style={{ color: colors[si] }}>{labels[si]} {yFmt(arr[hover])}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════ AI/ML — Experiment Monitor (W&B/MLflow) ════════════ */
function genLoss(seed, n = 56, start = 2.3, floor = 0.32) {
  const rnd = mulberry32(seed);
  const out = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    v = floor + (v - floor) * 0.93 + (rnd() - 0.5) * 0.05 * v;
    out.push(Math.max(floor * 0.92, v));
  }
  return out;
}
function AimlShowcase({ accent, keyExps, techList }) {
  const metrics = (keyExps || []).flatMap(k => (Array.isArray(k.jobData?.metrics) ? k.jobData.metrics : []))
    .filter(m => m?.name && m?.value).slice(0, 4);
  const seed = hashStr((keyExps?.[0]?.title || 'run') + (metrics[0]?.value || ''));
  const train = useMemo(() => genLoss(seed), [seed]);
  const val = useMemo(() => genLoss(seed + 7, 56, 2.45, 0.41), [seed]);
  const gpuRnd = mulberry32(seed + 13);
  const gpus = Array.from({ length: 8 }, () => 0.5 + gpuRnd() * 0.5);
  const RAG_NODES = ['문서', '청킹', '임베딩', 'Vector DB', 'LLM 응답'];
  const NX = [50, 165, 285, 410, 545];
  return (
    <Frame title={`wandb / ${(keyExps?.[0]?.jobData?.model || 'experiment').toString().slice(0, 22)}`} badge="TRAINING" accent={accent}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* 로스 곡선 */}
        <div className="border-b border-surface-100 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-bluewood-700"><Activity size={13} style={{ color: accent }} /> train / val loss</p>
            <div className="flex gap-3 font-mono text-[10px] text-bluewood-400">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ backgroundColor: accent }} /> train</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-bluewood-300" /> val</span>
            </div>
          </div>
          <div className="text-bluewood-600">
            <LineChart series={[train, val]} labels={['train', 'val']} colors={[accent, '#a4b2c2']} accent={accent} />
          </div>
          {metrics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-surface-100 pt-3">
              {metrics.map((m, i) => (
                <span key={i} className="rounded-md px-2.5 py-1 font-mono text-[11.5px] font-black text-white transition-transform hover:scale-105" style={{ backgroundColor: accent }} title={m.baseline ? `baseline ${m.baseline}` : undefined}>
                  {m.name}={m.value}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* GPU 모니터 */}
        <div className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-bold text-bluewood-700"><Cpu size={13} style={{ color: accent }} /> GPU utilization</p>
          <div className="flex h-20 items-end gap-1.5 rounded-xl bg-surface-50 p-3">
            {gpus.map((g, i) => (
              <div key={i} className="group relative flex-1">
                <div className="w-full origin-bottom rounded-t-[3px]" style={{ height: 56 * g, backgroundColor: tint(accent, 0.25), animation: `jsGpu ${2 + (i % 3) * 0.5}s ${i * 0.18}s ease-in-out infinite` }} />
                <span className="pointer-events-none absolute -top-4 left-1/2 hidden -translate-x-1/2 font-mono text-[9px] font-bold text-bluewood-500 group-hover:block">{Math.round(g * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-bluewood-400">
            <span>8× GPU · util avg {Math.round(gpus.reduce((s, g) => s + g, 0) / gpus.length * 100)}%</span>
            <span>VRAM 71%</span>
          </div>
          {techList?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {techList.slice(0, 5).map((t, i) => <span key={i} className="rounded bg-surface-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-bluewood-600">{t}</span>)}
            </div>
          )}
        </div>
      </div>
      {/* RAG / 데이터 파이프라인 — 흐르는 임베딩 애니메이션 */}
      <div className="border-t border-surface-100 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-bluewood-700"><Database size={13} style={{ color: accent }} /> 데이터 → 임베딩 파이프라인</p>
        <svg viewBox="0 0 600 74" width="100%" style={{ display: 'block' }}>
          <path id="ragflow" d="M 50 37 H 550" stroke={tint(accent, 0.75)} strokeWidth="2" fill="none" />
          {[0, 1.3, 2.6].map((d, i) => (
            <circle key={i} r="4" fill={accent}>
              <animateMotion dur="4s" begin={`${d}s`} repeatCount="indefinite" path="M 50 37 H 550" />
            </circle>
          ))}
          {RAG_NODES.map((nm, i) => (
            <g key={i}>
              <rect x={NX[i] - 44} y={i === 3 ? 14 : 18} width="88" height={i === 3 ? 46 : 38} rx="10"
                fill={i === 3 ? tint(accent, 0.9) : '#fff'} stroke={i === 3 ? accent : '#e2e8f0'} strokeWidth={i === 3 ? 1.6 : 1.2} />
              <text x={NX[i]} y={41} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1e293b">{nm}</text>
            </g>
          ))}
        </svg>
        <p className="mt-1 text-right font-mono text-[9px] text-bluewood-300">metrics는 실제 추출 수치 · 곡선은 연출용 시뮬레이션</p>
      </div>
    </Frame>
  );
}

/* ════════════ DA — Analytics Explorer (Tableau/PowerBI) ════════════ */
const DA_PERIODS = ['7일', '30일', '90일'];
const DA_SEGMENTS = ['모바일 웹', 'iOS 앱', 'Android 앱', 'PC 웹'];
function DaShowcase({ accent, visuals, keyExps }) {
  const metricNames = (visuals?.kpis || []).map(k => k.label).filter(Boolean).slice(0, 3);
  const metrics = metricNames.length ? metricNames : ['전환율', '신규 사용자', '매출'];
  const [mi, setMi] = useState(0);
  const [pi, setPi] = useState(1);
  const [drill, setDrill] = useState(null);
  const n = [7, 12, 12][pi];
  const seed = hashStr(metrics[mi] + pi);
  const bars = useMemo(() => {
    const rnd = mulberry32(seed);
    let base = 40 + rnd() * 30;
    return Array.from({ length: n }, () => { base = Math.max(18, base + (rnd() - 0.42) * 16); return Math.round(base); });
  }, [seed, n]);
  const max = Math.max(...bars);
  const segRnd = mulberry32(seed + (drill ?? 0));
  const segs = DA_SEGMENTS.map(s => ({ label: s, v: Math.round(20 + segRnd() * 60) }));
  const segMax = Math.max(...segs.map(s => s.v));
  const ab = (keyExps || []).map(k => k.jobData).find(j => j?.control && j?.variant);
  return (
    <Frame title={`analytics / ${metrics[mi]}`} badge="EXPLORE" accent={accent}>
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-100 px-4 py-2.5">
        <Filter size={12} className="text-bluewood-300" />
        {metrics.map((m, i) => (
          <button key={i} onClick={() => { setMi(i); setDrill(null); }}
            className={`rounded-lg px-2.5 py-1 text-[11.5px] font-bold transition-colors ${i === mi ? 'text-white' : 'bg-surface-100 text-bluewood-500 hover:bg-surface-200'}`}
            style={i === mi ? { backgroundColor: accent } : undefined}>{m}</button>
        ))}
        <span className="ml-auto flex rounded-lg bg-surface-100 p-0.5">
          {DA_PERIODS.map((p, i) => (
            <button key={i} onClick={() => { setPi(i); setDrill(null); }}
              className={`rounded-md px-2 py-0.5 font-mono text-[10.5px] font-bold transition-colors ${i === pi ? 'bg-white text-bluewood-800 shadow-sm' : 'text-bluewood-400'}`}>{p}</button>
          ))}
        </span>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="p-4">
          <p className="mb-2 text-[10.5px] font-bold text-bluewood-400">막대를 클릭하면 세그먼트로 드릴다운됩니다 <MousePointerClick size={11} className="ml-0.5 inline text-bluewood-300" /></p>
          <div className="flex h-36 items-end gap-1.5">
            {bars.map((b, i) => (
              <button key={i} onClick={() => setDrill(drill === i ? null : i)} title={`${metrics[mi]} ${b}`}
                className="group relative flex-1 origin-bottom rounded-t-[4px] transition-all hover:opacity-80"
                style={{ height: `${(b / max) * 100}%`, backgroundColor: drill === i ? accent : tint(accent, drill == null ? 0.35 : 0.75), animation: 'jsGrowY .7s ease both', animationDelay: `${i * 40}ms` }}>
                <span className="pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 rounded bg-bluewood-900 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white group-hover:block" style={{ backgroundColor: '#0f2747' }}>{b}</span>
              </button>
            ))}
          </div>
          {/* 드릴다운 패널 */}
          {drill != null && (
            <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50/60 p-3">
              <p className="mb-2 font-mono text-[10.5px] font-bold" style={{ color: accent }}>▸ {pi === 0 ? `D-${n - drill}` : `${drill + 1}주차`} · 세그먼트 분해</p>
              <div className="space-y-1.5">
                {segs.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-[76px] text-[10.5px] font-semibold text-bluewood-600">{s.label}</span>
                    <div className="h-[12px] rounded-r-[3px]" style={{ width: `${(s.v / segMax) * 70}%`, backgroundColor: tint(accent, 0.3 + i * 0.15) }} />
                    <span className="font-mono text-[10.5px] font-bold text-bluewood-700">{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* 코드 스니펫 + A/B 결과 */}
        <div className="border-t border-surface-100 lg:border-l lg:border-t-0">
          <div className="bg-[#0e1626] p-4 font-mono text-[10.5px] leading-[1.8]">
            <p className="text-white/35"># 전처리 · 세그먼트 분석</p>
            <p><span className="text-primary-300">df</span><span className="text-white/70"> = pd.read_sql(events, conn)</span></p>
            <p><span className="text-white/70">df.groupby(</span><span style={{ color: tint(accent, 0.45) }}>'segment'</span><span className="text-white/70">)[</span><span style={{ color: tint(accent, 0.45) }}>'{metrics[mi]}'</span><span className="text-white/70">]</span></p>
            <p><span className="text-white/70">  .agg([</span><span style={{ color: tint(accent, 0.45) }}>'mean'</span><span className="text-white/70">,</span><span style={{ color: tint(accent, 0.45) }}>'count'</span><span className="text-white/70">]).pipe(zscore)</span></p>
          </div>
          <div className="p-4">
            <p className="mb-2 text-[11px] font-bold text-bluewood-700">A/B 테스트 검증</p>
            {ab ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-xl bg-surface-50 p-3 text-center">
                  <p className="text-[10px] font-bold text-bluewood-400">대조군</p>
                  <p className="mt-1 font-mono text-[18px] font-black text-bluewood-500">{ab.control}</p>
                </div>
                <ArrowRight size={14} className="text-bluewood-300" />
                <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: tint(accent, 0.9) }}>
                  <p className="text-[10px] font-bold" style={{ color: accent }}>실험군</p>
                  <p className="mt-1 font-mono text-[18px] font-black" style={{ color: accent }}>{ab.variant}</p>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-surface-200 p-3 text-[11px] text-bluewood-400">핵심 경험에 대조군/실험군 수치를 추가하면 여기 검증 카드가 채워집니다.</p>
            )}
            {ab?.significance && <p className="mt-2 text-right font-mono text-[10px] font-bold text-caribbean-700">✓ {ab.significance}</p>}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ════════════ DevOps — Ops Console (Grafana + GitOps) ════════════ */
function Spark({ seed, color, warn = false }) {
  const rnd = mulberry32(seed);
  const pts = Array.from({ length: 48 }, (_, i) => 20 + Math.sin(i / 4) * 6 + rnd() * 14);
  const P = (arr, off) => arr.map((v, i) => `${i ? 'L' : 'M'} ${off + i * 6} ${44 - v}`).join(' ');
  return (
    <div className="h-[46px] overflow-hidden">
      <svg viewBox="0 0 576 46" width="200%" style={{ display: 'block', animation: 'jsSlide 9s linear infinite' }}>
        {[0, 288].map(off => (
          <g key={off}>
            <path d={`${P(pts, off)} L ${off + 282} 46 L ${off} 46 Z`} fill={color} opacity="0.14" />
            <path d={P(pts, off)} fill="none" stroke={color} strokeWidth="1.5" />
          </g>
        ))}
        {warn && <line x1="0" x2="576" y1="12" y2="12" stroke="#f87171" strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />}
      </svg>
    </div>
  );
}
function DevopsShowcase({ accent, visuals }) {
  const g = visuals?.gauges || [];
  const panels = [
    { label: g[0]?.label || '가용성', value: g[0] ? `${g[0].value}${g[0].unit || ''}` : '99.95%', color: '#33f58e', seed: 101 },
    { label: g[1]?.label || 'p95 지연', value: g[1] ? `${g[1].value}${g[1].unit || ''}` : '182ms', color: tint(accent, 0.45), seed: 202, warn: true },
    { label: g[2]?.label || 'RPS', value: g[2] ? `${g[2].value}${g[2].unit || ''}` : '1.2k', color: '#a4b2c2', seed: 303 },
  ];
  const stages = (visuals?.process || []).map(s => s.label).slice(0, 5);
  const pipeline = stages.length >= 2 ? stages : ['Build', 'Test', 'Deploy', 'Monitor'];
  return (
    <Frame title="ops-console · production" badge="HEALTHY" accent={accent} dark>
      {/* Grafana식 라이브 패널 */}
      <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3">
        {panels.map((p, i) => (
          <div key={i} className="group bg-[#0e1626] p-4 transition-colors hover:bg-[#131c31]">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/40">{p.label}</p>
              <p className="font-mono text-[20px] font-black" style={{ color: p.color }}>{p.value}</p>
            </div>
            <div className="mt-2"><Spark seed={p.seed} color={p.color} warn={p.warn} /></div>
            <p className="mt-1 hidden font-mono text-[9px] text-white/30 group-hover:block">last 24h · 30s interval</p>
          </div>
        ))}
      </div>
      {/* GitOps CI/CD 파이프라인 애니메이션 */}
      <div className="border-t border-white/10 p-4">
        <p className="mb-3 flex items-center gap-1.5 font-mono text-[11px] font-bold text-white/60"><GitBranch size={12} style={{ color: tint(accent, 0.45) }} /> gitops pipeline</p>
        <div className="flex items-center">
          {pipeline.map((st, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tint(accent, 0.45), animation: `jsStage ${pipeline.length * 1.4}s ${i * 1.4}s infinite` }} />
                <span className="whitespace-nowrap font-mono text-[10.5px] font-bold text-white/80">{st}</span>
              </div>
              {i < pipeline.length - 1 && (
                <div className="mx-2 h-[3px] flex-1 rounded-full"
                  style={{ backgroundImage: `repeating-linear-gradient(90deg, ${tint(accent, 0.35)} 0 8px, rgba(255,255,255,.08) 8px 14px)`, backgroundSize: '28px 3px', animation: 'jsFlow 1s linear infinite' }} />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-right font-mono text-[9px] text-white/25">big number는 실제 운영 지표 · 그래프는 연출용 시뮬레이션</p>
      </div>
    </Frame>
  );
}

/* ════════════ PM — Product Ops (인터랙티브 로드맵 + Before/After KPI) ════════════ */
function KpiWidget({ label, before, after, accent }) {
  const b = numOf(before) ?? 0, a = numOf(after) ?? 0;
  const av = useCountUp(a);
  const up = a >= b;
  const unit = String(after).replace(/[\d,.\s]/g, '').slice(0, 4);
  return (
    <div className="flex-1 rounded-xl border border-surface-200 p-3.5 transition-shadow hover:shadow-md">
      <p className="truncate text-[10.5px] font-bold text-bluewood-400">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[13px] font-semibold text-bluewood-300 line-through">{before}</span>
        <span className="font-mono text-[24px] font-black leading-none" style={{ color: accent }}>{fmt1(av)}{unit}</span>
        <span className={`rounded px-1 py-0.5 text-[10px] font-black ${up ? 'bg-caribbean-50 text-caribbean-700' : 'bg-rose-50 text-rose-500'}`}>
          {b !== 0 ? `${up ? '▲' : '▼'} ${Math.abs(Math.round(((a - b) / Math.abs(b)) * 100))}%` : '—'}
        </span>
      </div>
    </div>
  );
}
const PM_DEFAULT_PHASES = [
  { label: '디스커버리', start: 0, span: 2, desc: '유저 인터뷰 · 문제 정의' },
  { label: 'MVP 설계', start: 2, span: 3, desc: 'MSC 수립 · 스코프 결정' },
  { label: '개발 스프린트', start: 5, span: 4, desc: '2주 스프린트 × 2' },
  { label: '베타 · 검증', start: 9, span: 3, desc: 'A/B 검증 · 지표 추적' },
];
function PmShowcase({ accent, visuals }) {
  const [hover, setHover] = useState(null);
  const raw = (visuals?.timeline || []).map(p => ({ ...p, s: numOf(p.start), sp: numOf(p.span) }));
  const okNums = raw.length >= 2 && raw.every(p => p.s != null && p.sp > 0);
  const phases = okNums ? raw.map(p => ({ label: p.label, start: p.s, span: p.sp, desc: p.desc })) : (raw.length >= 2 ? raw.map((p, i) => ({ label: p.label, start: i * 2, span: 2, desc: p.desc })) : PM_DEFAULT_PHASES);
  const end = Math.max(...phases.map(p => p.start + p.span));
  const compares = (visuals?.compare || []).filter(c => numOf(c.before) != null && numOf(c.after) != null).slice(0, 2);
  const kpis = compares.length ? compares : [{ label: '전환율', before: '2.1%', after: '3.4%' }, { label: '재방문율', before: '18%', after: '31%' }];
  return (
    <Frame title="product-ops · roadmap" badge="ON TRACK" accent={accent}>
      <div className="p-4">
        {/* 인터랙티브 간트 */}
        <div className="relative">
          {/* 분기 눈금 */}
          <div className="mb-1 ml-[110px] flex justify-between font-mono text-[9.5px] text-bluewood-300">
            {Array.from({ length: Math.min(5, end + 1) }, (_, i) => <span key={i}>W{Math.round((end * i) / Math.min(4, end))}</span>)}
          </div>
          <div className="space-y-1.5">
            {phases.slice(0, 6).map((p, i) => (
              <div key={i} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <span className={`w-[102px] flex-shrink-0 truncate text-right text-[11.5px] font-bold transition-colors ${hover === i ? '' : 'text-bluewood-600'}`} style={hover === i ? { color: accent } : undefined}>{p.label}</span>
                <div className="relative h-8 flex-1 rounded-md bg-surface-50">
                  <div className="absolute inset-y-1 flex origin-left cursor-pointer items-center rounded-md px-2 transition-all"
                    style={{ left: `${(p.start / end) * 100}%`, width: `${Math.max(6, (p.span / end) * 100)}%`, backgroundColor: hover === i ? accent : tint(accent, 0.25 + (i % 3) * 0.18), animation: 'jsGrow .8s ease both', animationDelay: `${i * 90}ms` }}>
                    {hover === i && <span className="truncate font-mono text-[9.5px] font-bold text-white">{p.span}주{p.desc ? ` · ${p.desc}` : ''}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* 오늘 라인 */}
          <div className="pointer-events-none absolute inset-y-4" style={{ left: '74%' }}>
            <div className="h-full w-px" style={{ backgroundColor: accent, opacity: 0.5 }} />
            <span className="absolute -top-4 -translate-x-1/2 rounded px-1 font-mono text-[8.5px] font-black text-white" style={{ backgroundColor: accent }}>TODAY</span>
          </div>
        </div>
        {/* Before/After KPI 위젯 */}
        <div className="mt-4 flex flex-col gap-2.5 border-t border-surface-100 pt-4 sm:flex-row">
          {kpis.map((k, i) => <KpiWidget key={i} label={k.label || `지표 ${i + 1}`} before={k.before} after={k.after} accent={accent} />)}
        </div>
        {!compares.length && <p className="mt-2 text-right font-mono text-[9px] text-bluewood-300">예시 지표 — 개선 전후 수치를 입력하면 실제 값으로 대체됩니다</p>}
      </div>
    </Frame>
  );
}

/* ════════════ Designer — Design System Studio (토큰 ↔ 컴포넌트 스플릿뷰) ════════════ */
function DesignerShowcase({ accent, visuals }) {
  const COLORS = [
    { name: 'primary', v: accent }, { name: 'primary/60', v: tint(accent, 0.4) }, { name: 'primary/20', v: tint(accent, 0.8) },
    { name: 'ink', v: '#0f2747' }, { name: 'muted', v: '#64748b' }, { name: 'surface', v: '#f1f5f9' },
  ];
  const TYPES = [{ name: 'display', px: 24 }, { name: 'title', px: 17 }, { name: 'body', px: 13 }];
  const [ci, setCi] = useState(0);
  const [ti, setTi] = useState(1);
  const [after, setAfter] = useState(true);
  const cmp = (visuals?.compare || []).find(c => numOf(c.before) != null && numOf(c.after) != null);
  const cvrB = cmp ? numOf(cmp.before) : 2.4, cvrA = cmp ? numOf(cmp.after) : 4.1;
  const unit = cmp ? String(cmp.after).replace(/[\d,.\s]/g, '').slice(0, 3) : '%';
  const cvr = useCountUp(after ? cvrA : cvrB, 700);
  const sel = COLORS[ci].v;
  return (
    <Frame title="design-system · tokens ↔ components" badge="SYNCED" accent={accent}>
      <div className="grid gap-0 lg:grid-cols-2">
        {/* 좌: 토큰 */}
        <div className="border-b border-surface-100 p-4 lg:border-b-0 lg:border-r">
          <p className="mb-2.5 flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-bluewood-400"><Palette size={12} style={{ color: accent }} /> tokens/color</p>
          <div className="grid grid-cols-3 gap-1.5">
            {COLORS.map((c, i) => (
              <button key={i} onClick={() => setCi(i)}
                className={`rounded-lg border p-1.5 text-left transition-all hover:scale-[1.03] ${ci === i ? 'ring-2 ring-offset-1' : 'border-surface-200'}`}
                style={ci === i ? { borderColor: sel, '--tw-ring-color': sel } : undefined}>
                <span className="block h-6 w-full rounded-md" style={{ backgroundColor: c.v }} />
                <span className="mt-1 block truncate font-mono text-[9px] font-bold text-bluewood-500">{c.name}</span>
              </button>
            ))}
          </div>
          <p className="mb-2 mt-3.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-bluewood-400">tokens/type</p>
          <div className="flex gap-1.5">
            {TYPES.map((t, i) => (
              <button key={i} onClick={() => setTi(i)}
                className={`flex-1 rounded-lg border px-2 py-1.5 font-mono text-[10px] font-bold transition-colors ${ti === i ? 'text-white' : 'border-surface-200 text-bluewood-500 hover:bg-surface-50'}`}
                style={ti === i ? { backgroundColor: sel, borderColor: sel } : undefined}>{t.name} · {t.px}</button>
            ))}
          </div>
        </div>
        {/* 우: 라이브 컴포넌트 */}
        <div className="p-4">
          <p className="mb-2.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-bluewood-400">→ React 컴포넌트 (라이브 매핑)</p>
          <div className="rounded-xl border border-surface-200 bg-surface-50/50 p-4">
            <p className="font-black leading-tight text-bluewood-900 transition-all" style={{ fontSize: TYPES[ti].px }}>결제 완료 화면</p>
            <p className="mt-1 text-[11.5px] text-bluewood-500">토큰을 바꾸면 컴포넌트가 즉시 반영됩니다.</p>
            <div className="mt-3 flex items-center gap-2">
              <button className="rounded-lg px-3.5 py-1.5 text-[12px] font-bold text-white transition-transform hover:scale-105 active:scale-95" style={{ backgroundColor: sel }}>Primary</button>
              <button className="rounded-lg border px-3.5 py-1.5 text-[12px] font-bold transition-colors" style={{ borderColor: sel, color: sel }}>Ghost</button>
              <span className="ml-auto inline-flex h-5 w-9 cursor-pointer items-center rounded-full p-0.5 transition-colors" style={{ backgroundColor: after ? sel : '#cbd5e1' }} onClick={() => setAfter(v => !v)}>
                <span className="h-4 w-4 rounded-full bg-white shadow transition-transform" style={{ transform: after ? 'translateX(16px)' : 'none' }} />
              </span>
            </div>
          </div>
          {/* 개선 전후 마이크로 인터랙션 */}
          <div className="mt-3 flex items-center justify-between rounded-xl p-3.5" style={{ backgroundColor: tint(accent, 0.93) }}>
            <div className="flex gap-1 rounded-lg bg-white/70 p-0.5">
              {['개선 전', '개선 후'].map((t, i) => (
                <button key={i} onClick={() => setAfter(i === 1)}
                  className={`rounded-md px-2.5 py-1 text-[10.5px] font-bold transition-all ${(i === 1) === after ? 'bg-white shadow-sm' : 'text-bluewood-400'}`}
                  style={(i === 1) === after ? { color: accent } : undefined}>{t}</button>
              ))}
            </div>
            <p className="font-mono text-[11px] font-bold text-bluewood-500">{cmp?.label || '전환율'}
              <span className="ml-2 text-[22px] font-black tracking-tight" style={{ color: accent }}>{fmt1(cvr)}{unit}</span>
            </p>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ════════════ Marketer — Ads Performance Center ════════════ */
const MK_SEGS = ['2534 여성', '2534 남성', '3544 여성', '3544 남성', '4554'];
function MarketerShowcase({ accent, visuals, keyExps }) {
  const mixCh = (visuals?.mix || []).map(m => m.label).slice(0, 4);
  const jdCh = [...new Set((keyExps || []).flatMap(k => k.jobData?.channels || []))].slice(0, 4);
  const channels = (mixCh.length ? mixCh : jdCh.length ? jdCh : ['메타', '구글', '네이버']);
  const seed = hashStr(channels.join(''));
  const rnd = mulberry32(seed);
  const rows = channels.map((c, i) => {
    const spendPct = (visuals?.mix?.[i]?.pct) ?? Math.round(20 + rnd() * 40);
    return { ch: c, spend: spendPct, roas: Math.round(150 + rnd() * 260) };
  });
  const realRoas = (visuals?.kpis || []).find(k => /roas/i.test(k.label || ''));
  if (realRoas && numOf(realRoas.value) != null) rows[0].roas = numOf(realRoas.value);
  const maxSpend = Math.max(...rows.map(r => r.spend));
  const creatives = ['소재 A', '소재 B', '소재 C', '소재 D'];
  const hm = creatives.map((_, r) => MK_SEGS.map((_, c) => Math.round((0.6 + mulberry32(seed + r * 7 + c)() * 3.4) * 10) / 10));
  const best = hm.flatMap((row, r) => row.map((v, c) => ({ v, r, c }))).sort((a, b) => b.v - a.v)[0];
  const hmMax = Math.max(...hm.flat());
  const [cell, setCell] = useState(null);
  return (
    <Frame title="ads-center · cross-channel" badge="OPTIMIZING" accent={accent}>
      <div className="grid gap-0 lg:grid-cols-2">
        {/* 채널 성과 테이블 */}
        <div className="border-b border-surface-100 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-2 grid grid-cols-[64px_1fr_66px] gap-2 font-mono text-[9.5px] font-bold uppercase tracking-wider text-bluewood-300">
            <span>Channel</span><span>Spend</span><span className="text-right">ROAS</span>
          </div>
          <div className="space-y-1">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[64px_1fr_66px] items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-surface-50" title={`${r.ch} · Spend ${r.spend}% · ROAS ${r.roas}%`}>
                <span className="truncate text-[11.5px] font-extrabold text-bluewood-800">{r.ch}</span>
                <div className="h-[14px] rounded-r-[4px] origin-left" style={{ width: `${(r.spend / maxSpend) * 96}%`, background: `linear-gradient(90deg, ${tint(accent, 0.15)}, ${tint(accent, 0.5)})`, animation: 'jsGrow .8s ease both', animationDelay: `${i * 100}ms` }} />
                <span className={`text-right font-mono text-[12.5px] font-black ${r.roas >= 250 ? 'text-caribbean-700' : r.roas >= 150 ? 'text-bluewood-700' : 'text-rose-500'}`}>{r.roas}%</span>
              </div>
            ))}
          </div>
          {/* 룰 기반 자동화 플로우 */}
          <p className="mb-1.5 mt-4 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-bluewood-400"><Zap size={11} style={{ color: accent }} /> auto-scaling rules</p>
          <div className="space-y-1 font-mono text-[10.5px]">
            {[['ROAS < 200%', '예산 −20%'], ['ROAS > 350%', '예산 +30%'], ['CTR < 1.0%', '소재 교체']].map(([cond, act], i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="rounded bg-surface-100 px-1.5 py-0.5 font-bold text-bluewood-600">IF {cond}</span>
                <span className="h-px w-4" style={{ backgroundImage: `repeating-linear-gradient(90deg, ${accent} 0 4px, transparent 4px 7px)`, backgroundSize: '28px 1px', animation: 'jsFlow 1.2s linear infinite' }} />
                <span className="rounded px-1.5 py-0.5 font-black" style={{ backgroundColor: tint(accent, 0.9), color: accent }}>{act}</span>
              </div>
            ))}
          </div>
        </div>
        {/* CTR 히트맵 */}
        <div className="p-4">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-bluewood-400">CTR heatmap — 소재 × 타겟</p>
          <div className="grid gap-1" style={{ gridTemplateColumns: `52px repeat(${MK_SEGS.length}, 1fr)` }}>
            <span />
            {MK_SEGS.map((s, i) => <span key={i} className="truncate text-center text-[8.5px] font-bold text-bluewood-400">{s}</span>)}
            {creatives.map((cr, r) => (
              [<span key={`l${r}`} className="flex items-center text-[10px] font-bold text-bluewood-600">{cr}</span>,
              ...hm[r].map((v, c) => (
                <button key={`${r}-${c}`} onMouseEnter={() => setCell({ r, c, v })} onMouseLeave={() => setCell(null)}
                  className={`relative aspect-[2/1] rounded-[5px] transition-transform hover:scale-110 hover:z-10 ${best.r === r && best.c === c ? 'ring-2 ring-offset-1' : ''}`}
                  style={{ backgroundColor: tint(accent, 1 - (v / hmMax) * 0.85), '--tw-ring-color': accent }}>
                  {cell?.r === r && cell?.c === c && (
                    <span className="absolute -top-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-[#0f2747] px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-white">CTR {v}%</span>
                  )}
                </button>
              ))]
            ))}
          </div>
          <p className="mt-2.5 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold" style={{ color: accent }}>★ BEST {creatives[best.r]} × {MK_SEGS[best.c]} — {best.v}%</span>
            <span className="font-mono text-[9px] text-bluewood-300">셀에 호버하면 CTR 표시</span>
          </p>
          <p className="mt-2 text-right font-mono text-[9px] text-bluewood-300">ROAS·채널은 실데이터 우선 · 히트맵은 연출용 시뮬레이션</p>
        </div>
      </div>
    </Frame>
  );
}

/* ════════════ HR — Talent Pipeline (ATS 퍼널 + 스케줄링 자동화) ════════════ */
const HR_DEFAULT = [{ label: '지원', value: 420 }, { label: '서류 통과', value: 180 }, { label: '면접', value: 64 }, { label: '최종 합격', value: 14 }];
function HrShowcase({ accent, visuals }) {
  const [hover, setHover] = useState(null);
  const stages = (visuals?.funnel && visuals.funnel.length >= 2) ? visuals.funnel : HR_DEFAULT;
  const max = Math.max(...stages.map(s => s.value));
  const tth = (visuals?.compare || []).find(c => /일|시간|리드|day/i.test(`${c.label}${c.before}${c.after}`)) || { label: '채용 리드타임', before: '32일', after: '14일' };
  const isReal = Boolean(visuals?.funnel && visuals.funnel.length >= 2);
  const a = useCountUp(numOf(tth.after) ?? 0);
  const FLOW = [{ icon: Mail, t: '지원 접수' }, { icon: Slack, t: '슬랙 알림' }, { icon: CalendarClock, t: '일정 자동 조율' }, { icon: Video, t: '면접 진행' }];
  return (
    <Frame title="talent-pipeline · ats" badge="HIRING" accent={accent}>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* 깔때기 퍼널 */}
        <div className="border-b border-surface-100 p-4 lg:border-b-0 lg:border-r">
          <div className="space-y-1">
            {stages.map((s, i) => {
              const w = Math.max(16, (s.value / max) * 100);
              const conv = i > 0 ? Math.round((s.value / stages[i - 1].value) * 100) : null;
              return (
                <div key={i} className="relative" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <div className="mx-auto flex h-11 cursor-pointer items-center justify-center rounded-lg transition-all"
                    style={{ width: `${w}%`, backgroundColor: tint(accent, 0.62 * (1 - i / Math.max(1, stages.length - 1))), clipPath: `polygon(0 0, 100% 0, ${100 - 5}% 100%, 5% 100%)`, animation: 'jsGrow .7s ease both', animationDelay: `${i * 120}ms`, transform: hover === i ? 'scale(1.03)' : undefined }}>
                    <span className={`text-[12px] font-black ${i > stages.length / 2 ? 'text-white' : 'text-bluewood-800'}`}>{s.label} <span className="font-mono">{s.value.toLocaleString()}</span></span>
                  </div>
                  {hover === i && conv != null && (
                    <span className="absolute -right-1 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 font-mono text-[10px] font-black text-white" style={{ backgroundColor: accent }}>▼ {conv}%</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-center font-mono text-[10.5px] text-bluewood-400">
            전체 전환율 <span className="font-black" style={{ color: accent }}>{Math.round((stages[stages.length - 1].value / stages[0].value) * 1000) / 10}%</span>
            {!isReal && <span className="ml-2 text-[9px] text-bluewood-300">(예시 — 퍼널 수치 입력 시 대체)</span>}
          </p>
        </div>
        {/* Time-to-Hire + 자동화 워크플로우 */}
        <div className="p-4">
          <div className="rounded-xl p-3.5" style={{ backgroundColor: tint(accent, 0.93) }}>
            <p className="text-[10.5px] font-bold" style={{ color: accent }}>{tth.label || 'Time to Hire'}</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-[13px] font-semibold text-bluewood-400 line-through">{tth.before}</span>
              <span className="font-mono text-[26px] font-black leading-none" style={{ color: accent }}>{fmt1(a)}{String(tth.after).replace(/[\d,.\s]/g, '').slice(0, 3)}</span>
            </p>
          </div>
          <p className="mb-2 mt-3.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-bluewood-400"><Zap size={11} style={{ color: accent }} /> 면접 스케줄링 자동화</p>
          <div className="space-y-1.5">
            {FLOW.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: tint(accent, 0.9) }}><f.icon size={13} style={{ color: accent }} /></span>
                <span className="text-[11.5px] font-bold text-bluewood-700">{f.t}</span>
                {i < FLOW.length - 1 && <span className="ml-auto mr-3 h-3 w-px bg-surface-200" />}
                {i === FLOW.length - 1 && <span className="ml-auto rounded bg-caribbean-50 px-1.5 py-0.5 font-mono text-[9.5px] font-black text-caribbean-700">−87% 수작업</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* ════════════ Sales — Revenue Workspace (ROI 계산기 + 아웃바운드 시퀀스) ════════════ */
function SalesShowcase({ accent, keyExps }) {
  const [people, setPeople] = useState(20);
  const [hours, setHours] = useState(10);
  const [rate, setRate] = useState(3);
  const fee = 150; // 월 구독료(만원)
  const save = people * hours * rate; // 만원
  const roi = Math.round(((save - fee) / fee) * 100);
  const saveUp = useCountUp(save, 700);
  const icp = (keyExps || []).map(k => k.jobData?.client).filter(Boolean).slice(0, 3);
  const SEQ = [{ d: 'D0', icon: Mail, t: '콜드메일' }, { d: 'D3', icon: Mail, t: '팔로업' }, { d: 'D7', icon: Phone, t: '디스커버리 콜' }, { d: 'D14', icon: MonitorPlay, t: '맞춤 데모' }];
  const Slider = ({ label, v, set, min, max, unit }) => (
    <label className="block">
      <span className="flex justify-between font-mono text-[10.5px] font-bold text-bluewood-500">
        {label} <b style={{ color: accent }}>{v}{unit}</b>
      </span>
      <input type="range" min={min} max={max} value={v} onChange={e => set(Number(e.target.value))}
        className="mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-200" style={{ accentColor: accent }} />
    </label>
  );
  return (
    <Frame title="revenue-workspace · crm" badge="PIPELINE" accent={accent}>
      <div className="grid gap-0 lg:grid-cols-2">
        {/* ICP + 아웃바운드 시퀀스 */}
        <div className="border-b border-surface-100 p-4 lg:border-b-0 lg:border-r">
          <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-bluewood-400"><Users size={11} style={{ color: accent }} /> ICP 타겟 프로파일</p>
          <div className="flex flex-wrap gap-1.5">
            {(icp.length ? icp : ['제조 대기업', '임직원 1,000+', 'IT 예산 보유']).map((c, i) => (
              <span key={i} className="cursor-default rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors" style={{ borderColor: tint(accent, 0.5), color: accent }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = accent; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = accent; }}>{c}</span>
            ))}
          </div>
          <p className="mb-2 mt-4 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-bluewood-400"><Zap size={11} style={{ color: accent }} /> 아웃바운드 시퀀스</p>
          <div className="space-y-0">
            {SEQ.map((s, i) => (
              <div key={i} className="relative flex items-center gap-2.5 pb-3 last:pb-0">
                {i < SEQ.length - 1 && <span className="absolute left-[13px] top-7 h-3 w-px bg-surface-200" />}
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: tint(accent, 0.4) }}><s.icon size={12} style={{ color: accent }} /></span>
                <span className="w-8 font-mono text-[10px] font-black text-bluewood-300">{s.d}</span>
                <span className="text-[12px] font-bold text-bluewood-700">{s.t}</span>
              </div>
            ))}
          </div>
        </div>
        {/* ROI 계산기 — 방문자가 직접 조작 */}
        <div className="p-4">
          <p className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-bluewood-400"><Calculator size={11} style={{ color: accent }} /> ROI 시뮬레이터 — 직접 조정해 보세요</p>
          <div className="space-y-3">
            <Slider label="도입 팀 인원" v={people} set={setPeople} min={5} max={100} unit="명" />
            <Slider label="인당 월 절감 시간" v={hours} set={setHours} min={2} max={40} unit="h" />
            <Slider label="시간당 인건비" v={rate} set={setRate} min={1} max={10} unit="만원" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-surface-200 bg-surface-200">
            <div className="bg-white p-2.5 text-center">
              <p className="text-[9.5px] font-bold text-bluewood-400">월 절감액</p>
              <p className="mt-0.5 font-mono text-[16px] font-black tracking-tight" style={{ color: accent }}>{Math.round(saveUp).toLocaleString()}만</p>
            </div>
            <div className="bg-white p-2.5 text-center">
              <p className="text-[9.5px] font-bold text-bluewood-400">월 구독료</p>
              <p className="mt-0.5 font-mono text-[16px] font-black tracking-tight text-bluewood-600">{fee}만</p>
            </div>
            <div className="p-2.5 text-center" style={{ backgroundColor: tint(accent, 0.9) }}>
              <p className="text-[9.5px] font-bold" style={{ color: accent }}>ROI</p>
              <p className="mt-0.5 font-mono text-[16px] font-black tracking-tight" style={{ color: accent }}>{roi.toLocaleString()}%</p>
            </div>
          </div>
          <p className="mt-2 text-right font-mono text-[9px] text-bluewood-300">고객 제안에 사용한 ROI 모델 재현</p>
        </div>
      </div>
    </Frame>
  );
}

/* ════════════ 엔트리 ════════════ */
const MODULES = {
  aiml: AimlShowcase, da: DaShowcase, devops: DevopsShowcase, pm: PmShowcase,
  designer: DesignerShowcase, marketer: MarketerShowcase, hr: HrShowcase, sales: SalesShowcase,
};
const TITLES = {
  aiml: '실험 모니터', da: '데이터 탐색 대시보드', devops: '운영 콘솔', pm: '프로덕트 운영 보드',
  designer: '리빙 디자인 시스템', marketer: '광고 퍼포먼스 센터', hr: '리크루팅 파이프라인', sales: '레베뉴 워크스페이스',
};

export default function JobShowcase({ job, accent, visuals, keyExps, jobSpecific, techList }) {
  const Mod = MODULES[job];
  if (!Mod) return null;
  return (
    <section className="mt-8">
      <style>{SHOWCASE_CSS}</style>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-100" style={{ color: accent }}><Gauge size={15} /></span>
        <h2 className="text-[16px] font-extrabold text-bluewood-900">{TITLES[job]}</h2>
        <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black tracking-wider" style={{ backgroundColor: tint(accent, 0.9), color: accent }}>INTERACTIVE</span>
      </div>
      <Mod accent={accent} visuals={visuals} keyExps={keyExps} jobSpecific={jobSpecific} techList={techList} />
    </section>
  );
}
export const hasJobShowcase = (job) => Boolean(MODULES[job]);
