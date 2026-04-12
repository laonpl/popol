import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ================================================================
   KeyExperienceSlider
   - beforeMetric / afterMetric 기반 범용 비교 바 차트
   - 어떤 내용이든 균일하게 비교 그래프 생성
   - 아이콘 없음, 깨지는 글씨 없음
   ================================================================ */

const THEMES = [
  { label: 'Background & Problem', color: '#ef4444', accent: '#3b82f6' },
  { label: 'Analysis & Action',    color: '#2563eb', accent: '#2563eb' },
  { label: 'Result & Impact',      color: '#7c3aed', accent: '#7c3aed' },
];

/* ── 문자열에서 숫자 추출 ──
   "평균 16시간" → 16
   "약 6억 원"   → 6
   "이탈률 34%"  → 34
   "200ms"       → 200
*/
function extractNumber(str) {
  if (!str) return null;
  const m = str.replace(/,/g, '').match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

/* ── 방향 판별 (감소인지 증가인지) ──
   metric, metricLabel, beforeMetric, afterMetric 전체를 보고 판별
*/
function detectDirection(exp) {
  const all = `${exp.metric || ''} ${exp.metricLabel || ''} ${exp.beforeMetric || ''} ${exp.afterMetric || ''}`;
  if (/↓|감소|절감|단축|줄|절약|낮/.test(all)) return 'down';
  if (/↑|증가|상승|향상|개선|확대|높/.test(all)) return 'up';
  // beforeMetric과 afterMetric 숫자 비교로도 판별
  const bv = extractNumber(exp.beforeMetric);
  const av = extractNumber(exp.afterMetric);
  if (bv !== null && av !== null) return av < bv ? 'down' : 'up';
  return 'neutral';
}

/* ══════════════════════════════════════════════
   범용 비교 바 차트
   - beforeMetric / afterMetric이 있으면 그 수치 사용
   - 없으면 metric에서 추정
   ══════════════════════════════════════════════ */
function MetricCompareChart({ exp, accent }) {
  const bv = extractNumber(exp.beforeMetric);
  const av = extractNumber(exp.afterMetric);
  const direction = detectDirection(exp);
  const ct = exp.chartType || 'horizontalBar';

  if (bv !== null && av !== null) {
    const maxVal = Math.max(bv, av, 1);
    return (
      <ChartByType chartType={ct} beforeLabel={exp.beforeMetric} afterLabel={exp.afterMetric}
        beforePct={Math.max((bv / maxVal) * 100, 4)} afterPct={Math.max((av / maxVal) * 100, 4)}
        accent={accent} direction={direction} />
    );
  }

  if (bv !== null) {
    const mv = extractNumber(exp.metric || '');
    if (mv !== null) {
      const afterVal = direction === 'down' ? Math.max(bv - mv, 0) : bv + mv;
      const maxVal = Math.max(bv, afterVal, 1);
      return (
        <ChartByType chartType={ct} beforeLabel={exp.beforeMetric} afterLabel={exp.afterMetric || exp.metric}
          beforePct={Math.max((bv / maxVal) * 100, 4)} afterPct={Math.max((afterVal / maxVal) * 100, 4)}
          accent={accent} direction={direction} />
      );
    }
  }

  if (exp.beforeMetric && bv !== null) {
    return (
      <ChartByType chartType={ct} beforeLabel={exp.beforeMetric} afterLabel={exp.metric}
        beforePct={100} afterPct={Math.max(15, 30)} accent={accent} direction={direction} />
    );
  }

  return <MetricOnlyChart metric={exp.metric} metricLabel={exp.metricLabel} accent={accent} chartType={ct} />;
}

function MetricOnlyChart({ metric, metricLabel, accent, chartType = 'horizontalBar' }) {
  if (!metric) return null;
  const s = (metric + ' ' + (metricLabel || '')).replace(/\s+/g, ' ');
  const isDown = /↓|감소|절감|단축|줄|절약/.test(s);
  const isUp = /↑|증가|상승|향상|개선|확대/.test(s);

  const arrowMatch = metric.match(/([\d,.]+)\s*([^\d→\->]*?)\s*[→\->]+\s*([\d,.]+)\s*(.*)/);
  if (arrowMatch) {
    const bv = parseFloat(arrowMatch[1].replace(/,/g, ''));
    const av = parseFloat(arrowMatch[3].replace(/,/g, ''));
    const unit = (arrowMatch[4] || arrowMatch[2] || '').trim();
    const maxVal = Math.max(bv, av, 1);
    return <ChartByType chartType={chartType} beforeLabel={`${bv}${unit}`} afterLabel={`${av}${unit}`}
      beforePct={Math.max((bv / maxVal) * 100, 4)} afterPct={Math.max((av / maxVal) * 100, 4)}
      accent={accent} direction={av < bv ? 'down' : 'up'} />;
  }

  const mulMatch = metric.match(/([\d,.]+)\s*배/);
  if (mulMatch) {
    const mul = parseFloat(mulMatch[1].replace(/,/g, ''));
    return <ChartByType chartType={chartType} beforeLabel="기존 (1x)" afterLabel={`개선 후 (${mul}x)`}
      beforePct={Math.max(100 / mul, 4)} afterPct={100} accent={accent} direction="up" />;
  }

  const pctMatch = metric.match(/([\d,.]+)\s*%/);
  if (pctMatch) {
    const pv = parseFloat(pctMatch[1].replace(/,/g, ''));
    if (isDown) return <ChartByType chartType={chartType} beforeLabel="기존" afterLabel={`${pv}% 감소 후`}
      beforePct={100} afterPct={Math.max(100 - pv, 4)} accent={accent} direction="down" />;
    if (isUp) return <ChartByType chartType={chartType} beforeLabel="기존" afterLabel={`${pv}% 상승 후`}
      beforePct={Math.max(100 - pv, 20)} afterPct={100} accent={accent} direction="up" />;
    return <ChartByType chartType={chartType} beforeLabel="기존" afterLabel={metric}
      beforePct={30} afterPct={Math.min(pv, 100)} accent={accent} direction="up" />;
  }

  const numMatch = metric.match(/(약\s*)?([\d,.]+)\s*(.+)/);
  if (numMatch) {
    const val = parseFloat(numMatch[2].replace(/,/g, ''));
    const rawUnit = numMatch[3].trim();
    const unit = rawUnit.replace(/[↓↑()추정 이내이상약]/g, '').trim() || rawUnit.replace(/[↓↑()추정]/g, '').trim();
    const isTime = /초|ms|시간|분|일/.test(rawUnit);
    const isMoney = /원|억|만/.test(rawUnit);
    if (isDown || /이내/.test(rawUnit)) {
      const beforeVal = isTime ? val * 5 : isMoney ? val * 3 : val * 4;
      const beforeUnit = isMoney ? rawUnit.replace(/[↓↑()추정 이내이상약]/g, '').trim() : unit;
      return <ChartByType chartType={chartType} beforeLabel={`약 ${beforeVal}${beforeUnit}`} afterLabel={metric}
        beforePct={100} afterPct={Math.max((val / beforeVal) * 100, 8)} accent={accent} direction="down" />;
    }
    const beforeVal = Math.max(Math.round(val * 0.25), 1);
    return <ChartByType chartType={chartType} beforeLabel={`약 ${beforeVal}${unit}`} afterLabel={metric}
      beforePct={Math.max((beforeVal / val) * 100, 8)} afterPct={100} accent={accent} direction="up" />;
  }

  return null;
}

/* ── 범용 비교 바 쌍 렌더러 (가로 막대 — 기본) ── */
function CompareBarPair({ beforeLabel, afterLabel, beforePct, afterPct, accent, direction }) {
  const maxPct = Math.max(beforePct, afterPct, 1);
  const normBefore = Math.max((beforePct / maxPct) * 100, 8);
  const normAfter = Math.max((afterPct / maxPct) * 100, 8);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12px] text-gray-500 font-semibold">개선 전</span>
          <span className="text-[13px] font-bold text-gray-500">{beforeLabel}</span>
        </div>
        <div className="h-10 bg-gray-100 rounded-lg overflow-hidden relative">
          <div className="h-full bg-[#bcc5d1] rounded-lg transition-all duration-[1200ms] ease-out"
            style={{ width: `${normBefore}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12px] font-bold" style={{ color: accent }}>개선 후</span>
          <span className="text-[13px] font-black" style={{ color: accent }}>{afterLabel}</span>
        </div>
        <div className="h-10 bg-gray-100 rounded-lg overflow-hidden relative">
          <div className="h-full rounded-lg transition-all duration-[1200ms] ease-out"
            style={{ width: `${normAfter}%`, backgroundColor: accent }} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   10가지 차트 타입 렌더러
   ══════════════════════════════════════════════════════ */

/* normalizeValues: 모든 차트에서 공통 사용 */
function normalizeValues(beforePct, afterPct) {
  const maxPct = Math.max(beforePct, afterPct, 1);
  return {
    normBefore: Math.max((beforePct / maxPct) * 100, 8),
    normAfter: Math.max((afterPct / maxPct) * 100, 8),
  };
}

/* 1. horizontalBar — 가로 막대 (기본) */
function ChartHorizontalBar({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12px] text-gray-500 font-semibold">개선 전</span>
          <span className="text-[13px] font-bold text-gray-500">{beforeLabel}</span>
        </div>
        <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
          <div className="h-full bg-[#bcc5d1] rounded-lg transition-all duration-[1200ms]" style={{ width: `${normBefore}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12px] font-bold" style={{ color: accent }}>개선 후</span>
          <span className="text-[13px] font-black" style={{ color: accent }}>{afterLabel}</span>
        </div>
        <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
          <div className="h-full rounded-lg transition-all duration-[1200ms]" style={{ width: `${normAfter}%`, backgroundColor: accent }} />
        </div>
      </div>
    </div>
  );
}

/* 2. verticalBar — 세로 막대 */
function ChartVerticalBar({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  return (
    <div className="flex items-end justify-center gap-8 h-[140px]">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] font-bold text-gray-500">{beforeLabel}</span>
        <div className="w-14 bg-gray-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: '110px' }}>
          <div className="w-full bg-[#bcc5d1] rounded-t-lg transition-all duration-[1200ms]" style={{ height: `${normBefore}%` }} />
        </div>
        <span className="text-[10px] text-gray-400 font-semibold">개선 전</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] font-black" style={{ color: accent }}>{afterLabel}</span>
        <div className="w-14 bg-gray-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: '110px' }}>
          <div className="w-full rounded-t-lg transition-all duration-[1200ms]" style={{ height: `${normAfter}%`, backgroundColor: accent }} />
        </div>
        <span className="text-[10px] font-bold" style={{ color: accent }}>개선 후</span>
      </div>
    </div>
  );
}

/* 3. lineChart — 꺾은선 */
function ChartLine({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  const y1 = 100 - normBefore;
  const y2 = 100 - normAfter;
  return (
    <div className="relative h-[130px]">
      <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`lineGrad-${accent.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.15" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="95" x2="200" y2="95" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={`40,${y1} 160,${y2} 160,100 40,100`} fill={`url(#lineGrad-${accent.replace('#','')})`} />
        <line x1="40" y1={y1} x2="160" y2={y2} stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy={y1} r="5" fill="#bcc5d1" stroke="white" strokeWidth="2" />
        <circle cx="160" cy={y2} r="5" fill={accent} stroke="white" strokeWidth="2" />
      </svg>
      <div className="absolute bottom-0 left-4 text-[10px] text-gray-500 font-semibold">개선 전<br/><span className="text-[11px] font-bold">{beforeLabel}</span></div>
      <div className="absolute bottom-0 right-4 text-right text-[10px] font-bold" style={{ color: accent }}>개선 후<br/><span className="text-[11px] font-black">{afterLabel}</span></div>
    </div>
  );
}

/* 4. donut — 도넛 차트 */
function ChartDonut({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normAfter } = normalizeValues(beforePct, afterPct);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const stroke = circ * (1 - normAfter / 100);
  return (
    <div className="flex items-center justify-center gap-5">
      <div className="relative w-[110px] h-[110px]">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={accent} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={stroke} strokeLinecap="round"
            className="transition-all duration-[1200ms]" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[18px] font-black" style={{ color: accent }}>{Math.round(normAfter)}%</span>
        </div>
      </div>
      <div className="space-y-2 text-[11px]">
        <div><span className="text-gray-400 font-semibold block">개선 전</span><span className="font-bold text-gray-600">{beforeLabel}</span></div>
        <div><span className="font-semibold block" style={{ color: accent }}>개선 후</span><span className="font-black" style={{ color: accent }}>{afterLabel}</span></div>
      </div>
    </div>
  );
}

/* 5. gauge — 게이지 반원 */
function ChartGauge({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normAfter } = normalizeValues(beforePct, afterPct);
  const r = 45;
  const halfCirc = Math.PI * r;
  const stroke = halfCirc * (1 - normAfter / 100);
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[140px] h-[75px] overflow-hidden">
        <svg viewBox="0 0 100 55" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={halfCirc} strokeDashoffset={stroke} className="transition-all duration-[1200ms]" />
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <span className="text-[20px] font-black" style={{ color: accent }}>{Math.round(normAfter)}%</span>
        </div>
      </div>
      <div className="flex items-center gap-6 mt-3 text-[11px]">
        <span className="text-gray-500 font-semibold">개선 전: <span className="font-bold">{beforeLabel}</span></span>
        <span className="font-bold" style={{ color: accent }}>개선 후: <span className="font-black">{afterLabel}</span></span>
      </div>
    </div>
  );
}

/* 6. radialBar — 방사형 이중 바 */
function ChartRadialBar({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  const outerR = 40, innerR = 28;
  const outerCirc = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;
  return (
    <div className="flex items-center justify-center gap-5">
      <div className="relative w-[110px] h-[110px]">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={outerR} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r={outerR} fill="none" stroke={accent} strokeWidth="8"
            strokeDasharray={outerCirc} strokeDashoffset={outerCirc * (1 - normAfter / 100)} strokeLinecap="round"
            className="transition-all duration-[1200ms]" />
          <circle cx="50" cy="50" r={innerR} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r={innerR} fill="none" stroke="#bcc5d1" strokeWidth="8"
            strokeDasharray={innerCirc} strokeDashoffset={innerCirc * (1 - normBefore / 100)} strokeLinecap="round"
            className="transition-all duration-[1200ms]" />
        </svg>
      </div>
      <div className="space-y-2 text-[11px]">
        <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-full bg-[#bcc5d1]" /><span className="text-gray-500">개선 전: <span className="font-bold">{beforeLabel}</span></span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-full" style={{ backgroundColor: accent }} /><span style={{ color: accent }}>개선 후: <span className="font-black">{afterLabel}</span></span></div>
      </div>
    </div>
  );
}

/* 7. areaChart — 영역 차트 */
function ChartArea({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  const y1 = 90 - normBefore * 0.8;
  const y2 = 90 - normAfter * 0.8;
  const mid = 90 - ((normBefore + normAfter) / 2) * 0.8 + 5;
  return (
    <div className="relative h-[130px]">
      <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`areaGrad-${accent.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={`M 20,${y1} Q 100,${mid} 180,${y2} L 180,95 L 20,95 Z`} fill={`url(#areaGrad-${accent.replace('#','')})`} />
        <path d={`M 20,${y1} Q 100,${mid} 180,${y2}`} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy={y1} r="4" fill="#bcc5d1" stroke="white" strokeWidth="2" />
        <circle cx="180" cy={y2} r="4" fill={accent} stroke="white" strokeWidth="2" />
        <line x1="20" y1="95" x2="180" y2="95" stroke="#e5e7eb" strokeWidth="0.5" />
      </svg>
      <div className="absolute bottom-0 left-2 text-[10px] text-gray-500 font-semibold">{beforeLabel}</div>
      <div className="absolute bottom-0 right-2 text-[11px] font-black text-right" style={{ color: accent }}>{afterLabel}</div>
    </div>
  );
}

/* 8. stackedBar — 스택형 비교 바 */
function ChartStacked({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  const total = normBefore + normAfter;
  const bPct = (normBefore / total) * 100;
  const aPct = (normAfter / total) * 100;
  return (
    <div className="space-y-3">
      <div className="h-12 bg-gray-100 rounded-xl overflow-hidden flex">
        <div className="h-full bg-[#bcc5d1] flex items-center justify-center transition-all duration-[1200ms]" style={{ width: `${bPct}%` }}>
          <span className="text-[10px] font-bold text-white px-1 truncate">개선 전</span>
        </div>
        <div className="h-full flex items-center justify-center transition-all duration-[1200ms]" style={{ width: `${aPct}%`, backgroundColor: accent }}>
          <span className="text-[10px] font-bold text-white px-1 truncate">개선 후</span>
        </div>
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-gray-500 font-semibold">{beforeLabel}</span>
        <span className="font-black" style={{ color: accent }}>{afterLabel}</span>
      </div>
    </div>
  );
}

/* 9. bigNumber — 숫자 비교 카드 */
function ChartBigNumber({ beforeLabel, afterLabel, accent, direction }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
        <span className="text-[10px] text-gray-400 font-semibold block mb-1">개선 전</span>
        <span className="text-[20px] font-black text-gray-400 block leading-none">{beforeLabel}</span>
      </div>
      <div className="flex-shrink-0 text-[22px] font-black" style={{ color: accent }}>
        {direction === 'down' ? '↓' : '↑'}
      </div>
      <div className="flex-1 rounded-xl p-4 text-center border-2" style={{ borderColor: `${accent}40`, backgroundColor: `${accent}08` }}>
        <span className="text-[10px] font-semibold block mb-1" style={{ color: accent }}>개선 후</span>
        <span className="text-[20px] font-black block leading-none" style={{ color: accent }}>{afterLabel}</span>
      </div>
    </div>
  );
}

/* 10. progressCircle — 이중 프로그레스 서클 */
function ChartProgressCircle({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  const r = 32;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center justify-center gap-6">
      <div className="relative w-[80px] h-[80px]">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="#bcc5d1" strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - normBefore / 100)} strokeLinecap="round"
            className="transition-all duration-[1200ms]" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] text-gray-400">개선 전</span>
          <span className="text-[13px] font-bold text-gray-500">{beforeLabel}</span>
        </div>
      </div>
      <div className="text-[18px] font-black" style={{ color: accent }}>→</div>
      <div className="relative w-[80px] h-[80px]">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={accent} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - normAfter / 100)} strokeLinecap="round"
            className="transition-all duration-[1200ms]" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold" style={{ color: accent }}>개선 후</span>
          <span className="text-[13px] font-black" style={{ color: accent }}>{afterLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* ── 차트 타입 목록 (외부에서 import 가능) ── */
export const CHART_TYPES = [
  { id: 'horizontalBar',  label: '가로 막대',   icon: '━' },
  { id: 'verticalBar',    label: '세로 막대',   icon: '┃' },
  { id: 'lineChart',      label: '꺾은선',      icon: '📈' },
  { id: 'donut',          label: '도넛',        icon: '◎' },
  { id: 'gauge',          label: '게이지',      icon: '◑' },
  { id: 'radialBar',      label: '방사형',      icon: '◉' },
  { id: 'areaChart',      label: '영역',        icon: '▤' },
  { id: 'stackedBar',     label: '스택 바',     icon: '▥' },
  { id: 'bigNumber',      label: '숫자 비교',   icon: '#' },
  { id: 'progressCircle', label: '원형 비교',   icon: '●' },
];

const CHART_RENDERERS = {
  horizontalBar:  ChartHorizontalBar,
  verticalBar:    ChartVerticalBar,
  lineChart:      ChartLine,
  donut:          ChartDonut,
  gauge:          ChartGauge,
  radialBar:      ChartRadialBar,
  areaChart:      ChartArea,
  stackedBar:     ChartStacked,
  bigNumber:      ChartBigNumber,
  progressCircle: ChartProgressCircle,
};

/* ── 차트 타입에 따라 렌더링 분기 ── */
function ChartByType({ chartType, beforeLabel, afterLabel, beforePct, afterPct, accent, direction }) {
  const Renderer = CHART_RENDERERS[chartType] || ChartHorizontalBar;
  return <Renderer beforeLabel={beforeLabel} afterLabel={afterLabel} beforePct={beforePct} afterPct={afterPct} accent={accent} direction={direction} />;
}

/* ── 슬라이드 본문 ── */
function SlideContent({ exp, theme }) {
  if (!exp) return null;

  return (
    <div style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      {/* 섹션 라벨 + 헤딩 */}
      <span className="text-[12px] font-extrabold tracking-wider" style={{ color: theme.color }}>
        {theme.label}
      </span>
      <h2 className="text-[22px] sm:text-[26px] font-extrabold text-gray-900 leading-[1.35] mt-2 mb-7">
        {exp.title}
      </h2>

      {/* 카드 레이아웃: 좌측 대형 + 우측 2개 */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* ===== 좌측 대형 카드: 메트릭 + 비교 그래프 ===== */}
        <div className="lg:flex-[1.2] rounded-2xl bg-[#f8f9fb] border border-gray-100 p-6 flex flex-col">
          <p className="text-[16px] sm:text-[18px] font-bold text-gray-800 leading-snug mb-1">
            {exp.metricLabel || '핵심 지표'}
          </p>
          <p className="mb-1">
            <span className="text-[22px] sm:text-[26px] font-black" style={{ color: theme.accent }}>
              {exp.metric}
            </span>
          </p>
          <p className="text-[13px] text-gray-500 leading-[1.7] mb-5">
            {exp.result}
          </p>

          {/* 비교 바 차트 */}
          <div className="mt-auto">
            <MetricCompareChart exp={exp} accent={theme.accent} />
          </div>
        </div>

        {/* ===== 우측 카드 2개 ===== */}
        <div className="lg:flex-[0.8] flex flex-col gap-5">
          {/* 문제 상황 */}
          <div className="flex-1 rounded-2xl bg-[#f8f9fb] border border-gray-100 p-6">
            <p className="text-[15px] sm:text-[16px] font-bold text-gray-800 mb-2">문제 상황</p>
            <p className="text-[13px] text-gray-500 leading-[1.7]">
              {exp.situation}
            </p>
          </div>

          {/* 핵심 행동 */}
          <div className="flex-1 rounded-2xl bg-[#f8f9fb] border border-gray-100 p-6">
            <p className="text-[15px] sm:text-[16px] font-bold text-gray-800 mb-2">핵심 행동</p>
            <p className="text-[13px] text-gray-500 leading-[1.7]">
              {exp.action}
            </p>
          </div>
        </div>
      </div>

      {/* 키워드 */}
      {(exp.keywords || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5">
          {exp.keywords.map((k, i) => (
            <span key={i} className="px-3 py-1 rounded-full text-[11px] font-semibold border"
              style={{
                color: theme.accent,
                borderColor: `${theme.accent}30`,
                backgroundColor: `${theme.accent}08`,
              }}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   메인 슬라이더
   ══════════════════════════════════════════════ */
export default function KeyExperienceSlider({ keyExperiences = [] }) {
  const [current, setCurrent] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(null);

  if (keyExperiences.length === 0) return null;

  const goTo = (idx) => {
    if (isAnimating || idx === current) return;
    setIsAnimating(true);
    setTimeout(() => { setCurrent(idx); setIsAnimating(false); }, 250);
  };
  const goNext = () => goTo((current + 1) % keyExperiences.length);
  const goPrev = () => goTo((current - 1 + keyExperiences.length) % keyExperiences.length);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const d = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(d) > 50) d < 0 ? goNext() : goPrev();
    touchStartX.current = null;
  };

  const exp = keyExperiences[current];
  const theme = THEMES[current % THEMES.length];

  return (
    <div className="mb-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-bluewood-900">핵심 경험</h2>
          <span className="text-xs text-bluewood-300 hidden sm:inline">포트폴리오용 시각화 자료</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            {keyExperiences.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} className="p-0.5">
                <div className={`h-[6px] rounded-full transition-all duration-300 ${
                  i === current ? 'w-6' : 'w-[6px] hover:w-3'
                }`} style={{
                  backgroundColor: i === current ? THEMES[i % THEMES.length].color : '#d1d5db',
                }} />
              </button>
            ))}
          </div>
          <span className="text-xs text-bluewood-400 tabular-nums font-medium">
            {current + 1}/{keyExperiences.length}
          </span>
          <button onClick={goPrev}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-50 active:scale-95 transition-all">
            <ChevronLeft size={16} className="text-bluewood-500" />
          </button>
          <button onClick={goNext}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-surface-200 hover:bg-surface-50 active:scale-95 transition-all">
            <ChevronRight size={16} className="text-bluewood-500" />
          </button>
        </div>
      </div>

      {/* 슬라이드 */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        className={`bg-white rounded-2xl p-6 sm:p-8 lg:p-10 transition-all duration-250 ease-out ${
          isAnimating
            ? 'opacity-0 scale-[0.985] translate-y-1'
            : 'opacity-100 scale-100 translate-y-0'
        }`}
        style={{ boxShadow: '0 2px 24px rgba(0,0,0,0.06)' }}>
        <SlideContent exp={exp} theme={theme} />
      </div>

      {/* 하단 썸네일 탭 */}
      {keyExperiences.length > 1 && (
        <div className="flex gap-3 mt-4">
          {keyExperiences.map((e, i) => {
            const t = THEMES[i % THEMES.length];
            const active = i === current;
            return (
              <button key={i} onClick={() => goTo(i)}
                className={`flex-1 rounded-xl p-3 border-2 transition-all text-left ${
                  active
                    ? 'shadow-md bg-white'
                    : 'border-transparent bg-surface-50 hover:bg-surface-100 opacity-50 hover:opacity-70'
                }`}
                style={active ? { borderColor: t.color } : {}}>
                <span className="text-[9px] font-bold uppercase tracking-widest block mb-0.5"
                  style={{ color: t.color }}>
                  {t.label}
                </span>
                <span className={`text-[11px] font-semibold line-clamp-1 ${
                  active ? 'text-bluewood-800' : 'text-bluewood-500'
                }`} style={{ wordBreak: 'keep-all' }}>
                  {e.title?.slice(0, 30)}{(e.title?.length || 0) > 30 ? '...' : ''}
                </span>
                <span className="text-[10px] text-bluewood-400 font-medium">{e.metric || ''}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
