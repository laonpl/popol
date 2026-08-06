// 직무별 포트폴리오 시각화 — KPI 스탯 타일, 퍼널 차트, 덤벨 비교, 채널 믹스, MSC 보드, 프로세스 플로우.
// dataviz 원칙: 형태 먼저(헤드라인=타일, 크기비교=막대, 전후=덤벨, 구성비=누적막대),
// 막대 ≤24px·데이터 끝만 4px 라운드, 텍스트는 잉크 토큰(시리즈 색 금지), 2시리즈 이상엔 범례.
import { BarChart3, Filter, PieChart, Target, Workflow, TrendingUp, CheckCircle2, XCircle, ArrowRight, Gauge } from 'lucide-react';

/* hex 색을 흰색 쪽으로 t(0~1)만큼 섞기 — 직무 액센트 하나로 램프 단계 생성 */
export function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * t);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const num = (v) => {
  const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

/* ── 자기기재 수치 표시 ─────────────────────────────────────────────
   AI가 원본 자료에서 근거와 함께 뽑은 수치와, 사용자가 빈칸을 기억으로 채운 수치는
   근거 강도가 다르다. 둘을 같은 모양으로 그리면 안티-과장 장치(원본 없으면 비워라)가
   시각화 단계에서 우회된다. source === 'self' 인 값은 점선 + "본인 기재"로 구분한다.
   값을 지우거나 낮춰 보이게 하지는 않는다 — 숨기는 게 아니라 표시하는 것이 목적이다. */
export const isSelfReported = (row) => row?.source === 'self';
const countSelf = (rows = []) => rows.filter(isSelfReported).length;

export function SelfTag() {
  return (
    <span className="mt-1.5 inline-block rounded border border-dashed border-bluewood-300 px-1.5 py-0.5 text-[9.5px] font-bold text-bluewood-400">
      본인 기재
    </span>
  );
}

/** 막대·퍼널처럼 행마다 라벨을 붙이기 어려운 차트용 각주 */
export function SelfNote({ rows }) {
  const n = countSelf(rows);
  if (!n) return null;
  return (
    <p className="mt-3 border-t border-dashed border-surface-200 pt-2 text-[11.5px] text-bluewood-400">
      이 중 {n}개 값은 본인이 직접 기재한 수치입니다 (원본 자료 미연결)
    </p>
  );
}

export function SectionShell({ icon: Icon, title, accent, children }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-100" style={{ color: accent }}><Icon size={15} /></span>
        <h2 className="text-[16px] font-extrabold text-bluewood-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ── KPI 스탯 타일 행 — 헤드라인 수치는 차트가 아니라 타일 (+ 목표 대비 미터) ── */
export function KpiTileRow({ title, items, accent }) {
  if (!items?.length) return null;
  return (
    <SectionShell icon={BarChart3} title={title} accent={accent}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.slice(0, 4).map((k, i) => {
          const v = num(k.value), t = num(k.target);
          const pct = v != null && t ? Math.max(0, Math.min(100, (v / t) * 100)) : null;
          return (
            <div key={i} className={`rounded-2xl border border-surface-200 bg-surface-50/50 p-4 ${isSelfReported(k) ? 'border-dashed' : ''}`}>
              <p className="text-[11.5px] font-medium leading-snug text-bluewood-500">{k.label}</p>
              <p className="mt-1.5 text-[24px] font-black leading-none" style={{ color: accent }}>{k.value}</p>
              {pct != null && (
                <div className="mt-2.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: tint(accent, 0.85) }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-bluewood-400">목표 {k.target} 대비 {Math.round(pct)}%</p>
                </div>
              )}
              {k.note && pct == null && <p className="mt-1.5 text-[11.5px] text-bluewood-400">{k.note}</p>}
              {isSelfReported(k) && <SelfTag />}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

/* ── 퍼널 차트 — 단계별 가로 막대(단일 색상 램프, 첫 단계가 가장 밝음) + 단계 간 전환율 ── */
export function FunnelChart({ title, stages, accent }) {
  if (!stages || stages.length < 2) return null;
  const max = Math.max(...stages.map(s => s.value), 1);
  const n = stages.length;
  return (
    <SectionShell icon={Filter} title={title} accent={accent}>
      <div className="rounded-2xl border border-surface-200 p-5">
        <div className="space-y-0.5">
          {stages.map((s, i) => {
            const w = Math.max(3, (s.value / max) * 100);
            const conv = i > 0 && stages[i - 1].value > 0 ? Math.round((s.value / stages[i - 1].value) * 1000) / 10 : null;
            // 첫 단계 밝게 → 마지막 단계 액센트 원색 (ordinal 램프)
            const fill = tint(accent, 0.55 * (1 - i / Math.max(1, n - 1)));
            return (
              <div key={i}>
                {conv != null && (
                  <p className="py-0.5 pl-[112px] text-[11.5px] text-bluewood-400">↓ 전환율 {conv}%</p>
                )}
                <div className="flex items-center gap-3">
                  <span className="w-[100px] flex-shrink-0 truncate text-right text-[12px] font-semibold text-bluewood-700">{s.label}</span>
                  <div className="relative h-[22px] flex-1">
                    <div className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${w}%`, backgroundColor: fill }} title={`${s.label} ${s.value.toLocaleString()}`} />
                    <span className="absolute inset-y-0 flex items-center pl-2 text-[11.5px] font-bold text-bluewood-800" style={{ left: `${w}%` }}>
                      {s.value.toLocaleString()}{s.unit || ''}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <SelfNote rows={stages} />
        {stages[0].value > 0 && (
          <p className="mt-3.5 border-t border-surface-100 pt-2.5 text-[11.5px] text-bluewood-500">
            전체 전환율 <span className="font-bold text-bluewood-800">{Math.round((stages[n - 1].value / stages[0].value) * 1000) / 10}%</span>
            <span className="text-bluewood-300"> ({stages[0].label} → {stages[n - 1].label})</span>
          </p>
        )}
      </div>
    </SectionShell>
  );
}

/* ── Before → After 덤벨 비교 — 1색 2단계, 행별 자체 스케일(단위가 달라 축 공유 금지) ── */
const BEFORE_DOT = '#94a3b8';
export function DumbbellCompare({ title, rows, accent }) {
  if (!rows?.length) return null;
  return (
    <SectionShell icon={TrendingUp} title={title} accent={accent}>
      <div className="rounded-2xl border border-surface-200 p-5">
        {/* 2개 시리즈 → 범례 필수 */}
        <div className="mb-4 flex items-center gap-4 text-[11.5px] text-bluewood-500">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BEFORE_DOT }} /> Before</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} /> After</span>
        </div>
        <div className="space-y-4">
          {rows.slice(0, 5).map((r, i) => {
            const b = num(r.before), a = num(r.after);
            if (b == null || a == null || b === a) {
              // 수치 파싱 불가 → 칩 폴백
              return (
                <div key={i} className="flex items-center gap-3 text-[13px]">
                  <span className="w-[110px] flex-shrink-0 truncate text-[12px] font-semibold text-bluewood-700">{r.label || `항목 ${i + 1}`}</span>
                  <span className="rounded-lg bg-surface-100 px-2.5 py-1 font-bold text-bluewood-500">{r.before}</span>
                  <ArrowRight size={14} className="text-bluewood-300" />
                  <span className="rounded-lg px-2.5 py-1 font-black" style={{ backgroundColor: tint(accent, 0.9), color: accent }}>{r.after}</span>
                </div>
              );
            }
            const lo = Math.min(b, a), hi = Math.max(b, a);
            const span = hi - lo || 1;
            // 행별 정규화 (좌우 14% 패딩) — 라벨이 트랙 밖으로 나가지 않게
            const pos = (v) => 14 + ((v - lo) / span) * 72;
            const fmt = (v, raw) => String(raw ?? v);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-[110px] flex-shrink-0 truncate text-[12px] font-semibold text-bluewood-700" title={r.label}>{r.label || `지표 ${i + 1}`}</span>
                <div className="relative h-9 flex-1">
                  {/* 연결선 2px */}
                  <div className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-surface-200"
                    style={{ left: `${Math.min(pos(b), pos(a))}%`, width: `${Math.abs(pos(a) - pos(b))}%` }} />
                  {/* Before 점 (표면 링 2px) */}
                  <span className="absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${pos(b)}%`, backgroundColor: BEFORE_DOT, boxShadow: '0 0 0 2px #fff' }} />
                  <span className="absolute top-0 -translate-x-1/2 text-[11.5px] font-semibold text-bluewood-400" style={{ left: `${pos(b)}%` }}>{fmt(b, r.before)}</span>
                  {/* After 점 */}
                  <span className="absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: `${pos(a)}%`, backgroundColor: accent, boxShadow: '0 0 0 2px #fff' }} />
                  <span className="absolute bottom-0 -translate-x-1/2 text-[11.5px] font-black text-bluewood-800" style={{ left: `${pos(a)}%` }}>{fmt(a, r.after)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <SelfNote rows={rows} />
      </div>
    </SectionShell>
  );
}

/* ── 채널 믹스 — 100% 누적 가로 막대 (브랜드 액센트 단색 램프, 2px 표면 간격, 범례 병기) ── */
export function MixBar({ title, items, accent }) {
  if (!items || items.length < 2) return null;
  const total = items.reduce((s, x) => s + x.pct, 0) || 100;
  // 세그먼트를 액센트 한 색의 명도 단계로 구분 (다색 팔레트 대신 브랜드 단색 유지)
  const MIX_PALETTE = items.map((_, i) => tint(accent, (i / Math.max(1, items.length - 1)) * 0.72));
  return (
    <SectionShell icon={PieChart} title={title} accent={accent}>
      <div className="rounded-2xl border border-surface-200 p-5">
        <div className="flex h-4 w-full overflow-hidden rounded-full" style={{ gap: 2 }}>
          {items.slice(0, 6).map((x, i) => (
            <div key={i} style={{ width: `${(x.pct / total) * 100}%`, backgroundColor: MIX_PALETTE[i % MIX_PALETTE.length] }} title={`${x.label} ${x.pct}%`} />
          ))}
        </div>
        {/* 대비 낮은 슬롯 보완: 라벨+수치를 범례에 항상 병기 (relief rule) */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {items.slice(0, 6).map((x, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[12px] text-bluewood-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MIX_PALETTE[i % MIX_PALETTE.length] }} />
              {x.label} <span className="font-bold text-bluewood-800">{x.pct}%</span>
            </span>
          ))}
        </div>
        <SelfNote rows={items} />
      </div>
    </SectionShell>
  );
}

/* ── MSC 달성 보드 — 상태는 아이콘+라벨 병기 (색만으로 전달 금지) ── */
export function GoalBoard({ title, goals, accent }) {
  if (!goals?.length) return null;
  return (
    <SectionShell icon={Target} title={title} accent={accent}>
      <div className="grid gap-3 sm:grid-cols-2">
        {goals.slice(0, 4).map((g, i) => (
          <div key={i} className={`rounded-2xl border border-surface-200 p-4 ${isSelfReported(g) ? 'border-dashed' : ''}`}>
            <div className="flex items-center gap-1.5">
              {g.achieved
                ? <CheckCircle2 size={15} style={{ color: '#0ca30c' }} />
                : <XCircle size={15} style={{ color: '#d03b3b' }} />}
              <span className={`text-[12px] font-bold ${g.achieved ? 'text-emerald-700' : 'text-red-600'}`}>{g.achieved ? '달성' : '미달성'}</span>
            </div>
            <p className="mt-1.5 text-[13.5px] font-bold leading-snug text-bluewood-900">{g.label}</p>
            {(g.target || g.actual) && (
              <p className="mt-1.5 text-[12px] text-bluewood-500">
                {g.target && <>목표 <span className="font-semibold text-bluewood-700">{g.target}</span></>}
                {g.target && g.actual && <span className="mx-1.5 text-bluewood-300">·</span>}
                {g.actual && <>실제 <span className="font-black" style={{ color: accent }}>{g.actual}</span></>}
              </p>
            )}
            {isSelfReported(g) && <SelfTag />}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ── 게이지 행 — 가용성·SLA·MTTR 달성률 등 "목표 대비 현재" 반원 게이지 (데브옵스) ── */
function ArcGauge({ label, value, unit, target, accent, self = false }) {
  const v = num(value);
  // 게이지 채움 비율: 목표가 있으면 목표 대비, 없으면 %값은 그대로·그 외는 90% 가정
  const pct = v == null ? 0
    : target && num(target) ? Math.max(0, Math.min(100, (v / num(target)) * 100))
    : unit === '%' || /%/.test(String(value)) ? Math.max(0, Math.min(100, v))
    : 90;
  const R = 46, C = Math.PI * R; // 반원 둘레
  const dash = (pct / 100) * C;
  return (
    <div className={`flex flex-col items-center rounded-2xl border border-surface-200 bg-surface-50/50 p-4 ${self ? 'border-dashed' : ''}`}>
      <svg viewBox="0 0 120 66" width="118" style={{ display: 'block' }}>
        <path d="M 14 60 A 46 46 0 0 1 106 60" fill="none" stroke={tint(accent, 0.85)} strokeWidth="10" strokeLinecap="round" />
        <path d="M 14 60 A 46 46 0 0 1 106 60" fill="none" stroke={accent} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`} />
        <text x="60" y="52" textAnchor="middle" fontSize="20" fontWeight="900" fill={accent}>{value}{unit && !/%|[가-힣a-z]/i.test(String(value)) ? unit : ''}</text>
      </svg>
      <p className="mt-1 text-center text-[12px] font-semibold text-bluewood-700">{label}</p>
      {target && <p className="mt-0.5 text-[11.5px] text-bluewood-400">목표 {target}</p>}
      {self && <SelfTag />}
    </div>
  );
}
export function GaugeRow({ title, items, accent }) {
  const list = (items || []).filter(g => g && (g.label || g.name) && (g.value || g.value === 0));
  if (!list.length) return null;
  return (
    <SectionShell icon={Gauge} title={title} accent={accent}>
      <div className={`grid gap-3 ${list.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : list.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {list.slice(0, 4).map((g, i) => (
          <ArcGauge key={i} label={g.label || g.name} value={g.value} unit={g.unit} target={g.target} accent={accent} self={isSelfReported(g)} />
        ))}
      </div>
    </SectionShell>
  );
}

/* ── 프로세스 플로우 — 수행 단계 다이어그램 (디자인 프로세스, CI/CD 등) ── */
export function ProcessFlow({ title, steps, accent }) {
  if (!steps || steps.length < 2) return null;
  return (
    <SectionShell icon={Workflow} title={title} accent={accent}>
      <div className="overflow-x-auto rounded-2xl border border-surface-200 p-5">
        <div className="flex items-stretch gap-2" style={{ minWidth: steps.length * 150 }}>
          {steps.slice(0, 6).map((s, i) => (
            <div key={i} className="flex flex-1 items-stretch gap-2">
              <div className="flex-1 rounded-xl bg-surface-50 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-black text-white" style={{ backgroundColor: accent }}>{i + 1}</span>
                <p className="mt-2 text-[13px] font-extrabold leading-snug text-bluewood-900">{s.label}</p>
                {s.desc && <p className="mt-1 text-[11.5px] leading-[1.55] text-bluewood-500">{s.desc}</p>}
              </div>
              {i < Math.min(steps.length, 6) - 1 && <ArrowRight size={16} className="self-center flex-shrink-0 text-bluewood-300" />}
            </div>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
