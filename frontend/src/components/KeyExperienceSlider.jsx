import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, PenLine, Check, X, Plus, Trash2, Undo2 } from 'lucide-react';
import { stripMd } from '../utils/textUtils';
import useExperienceStore from '../stores/experienceStore';
import toast from 'react-hot-toast';

/* ================================================================
   KeyExperienceSlider
   - beforeMetric / afterMetric 기반 범용 비교 바 차트
   - 어떤 내용이든 균일하게 비교 그래프 생성
   - 아이콘 없음, 깨지는 글씨 없음
   ================================================================ */

/* ── [작성 필요] 힌트 감지 ── */
function isHint(s) { return s && String(s).startsWith('[작성 필요]'); }

/* ── 힌트 텍스트 렌더러: 클릭하면 편집 모드로 유도 ── */
function HintText({ value, onEdit, className = '' }) {
  if (!value || !isHint(value)) return null;
  const hint = String(value).replace('[작성 필요] ', '').replace('[작성 필요]', '').trim();
  return (
    <button
      onClick={onEdit}
      className={`inline-flex items-start gap-1.5 text-left w-full px-3 py-2 rounded-lg border border-dashed border-orange-300 bg-orange-50 text-orange-600 text-[14px] leading-relaxed hover:bg-orange-100 transition-colors ${className}`}
    >
      <span className="flex-shrink-0 mt-0.5 font-bold">✎</span>
      <span>{hint || '내용을 직접 입력해주세요'}</span>
    </button>
  );
}

/* ── 뷰 모드 텍스트: 힌트면 HintText, 아니면 일반 텍스트 ── */
function ViewText({ value, onEdit, className = '' }) {
  if (isHint(value)) return <HintText value={value} onEdit={onEdit} />;
  return <p className={`text-[15px] text-gray-500 leading-[1.7] max-h-[140px] overflow-y-auto custom-scrollbar pr-1 ${className}`}>{stripMd(value)}</p>;
}

/* 경험 테마 — 사이트 기본(네이비 #002F6C)로 통일 */
const NAVY = '#002F6C';
const THEMES = Array.from({ length: 6 }, (_, i) => ({
  label: `경험 ${String(i + 1).padStart(2, '0')}`,
  color: NAVY,
  accent: NAVY,
}));

/* ══════════════════════════════════════════════════════════════
   읽기 전용 뷰 — 모든 핵심 경험을 한 화면에 표시
   ─ Section 1: 임팩트 수치 대시보드 (성과 수치 한눈에)
   ─ Section 2: CARL 카드 그리드 (모든 경험 동시 표시)
   ─ Section 3: 핵심 역량 추출 (키워드 + 인사이트)
   ══════════════════════════════════════════════════════════════ */

const PRIMARY = '#002F6C';

function DecisionRecordRead({ exp, accent = PRIMARY }) {
  const clean = (v) => (v && !isHint(v) && String(v).trim()) ? stripMd(v) : '';
  const trace = exp?.decisionTrace || {};
  const voice = exp?.voiceRecord || {};
  const identity = exp?.identitySignal || {};
  const evidence = (Array.isArray(exp?.evidenceBundle) ? exp.evidenceBundle : [])
    .filter(item => clean(item?.sourceRef) || clean(item?.whatItProves) || clean(item?.claim))
    .slice(0, 4);
  const alternatives = (Array.isArray(trace.alternatives) ? trace.alternatives : [])
    .map(item => typeof item === 'string'
      ? clean(item)
      : [clean(item?.option), clean(item?.reasonNotChosen) || clean(item?.cons)].filter(Boolean).join(' — '))
    .filter(Boolean);
  const criteria = (Array.isArray(trace.decisionCriteria) ? trace.decisionCriteria : [])
    .map(item => typeof item === 'string'
      ? clean(item)
      : [clean(item?.criterion), clean(item?.why)].filter(Boolean).join(' — '))
    .filter(Boolean);
  const steps = [
    ['문제 판단', clean(trace.problemJudgment) || clean(trace.situation)],
    ['판단 근거', clean(trace.problemEvidence)],
    ['최종 선택', clean(trace.choice)],
    ['바뀐 판단', clean(trace.changedJudgment)],
    ['다음 원칙', clean(trace.newPrinciple)],
  ].filter(([, value]) => value);
  const hasContent = steps.length || alternatives.length || criteria.length || evidence.length
    || clean(voice.originalQuote) || clean(voice.aiMeaning) || clean(identity.sentence);
  if (!hasContent) return null;

  return (
    <details className="mb-4 rounded-xl border border-surface-200 bg-surface-50/70 px-4 py-3">
      <summary className="cursor-pointer list-none text-[12px] font-black uppercase tracking-[0.1em]" style={{ color: accent }}>
        판단 지도 · 실제 말 · 증거
      </summary>
      <div className="mt-3 space-y-3">
        {steps.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white p-3">
                <p className="text-[11.5px] font-black text-bluewood-400">{label}</p>
                <p className="mt-1 text-[12.5px] leading-[1.65] text-bluewood-600">{value}</p>
              </div>
            ))}
          </div>
        )}
        {(alternatives.length > 0 || criteria.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {alternatives.length > 0 && <div><p className="mb-1 text-[11.5px] font-black text-bluewood-400">검토한 대안</p>{alternatives.map((v, i) => <p key={i} className="text-[12px] leading-[1.6] text-bluewood-600">· {v}</p>)}</div>}
            {criteria.length > 0 && <div><p className="mb-1 text-[11.5px] font-black text-bluewood-400">선택 기준</p>{criteria.map((v, i) => <p key={i} className="text-[12px] leading-[1.6] text-bluewood-600">· {v}</p>)}</div>}
          </div>
        )}
        {clean(voice.originalQuote) && (
          <blockquote className="rounded-lg border-l-[3px] bg-white px-3.5 py-3" style={{ borderColor: accent }}>
            <p className="text-[13px] leading-[1.65] text-bluewood-700">“{clean(voice.originalQuote)}”</p>
            {clean(voice.polished) && clean(voice.polished) !== clean(voice.originalQuote) && <p className="mt-1.5 text-[11.5px] text-bluewood-500">최소 교정 · {clean(voice.polished)}</p>}
            {clean(voice.aiMeaning) && <p className="mt-1 text-[12px] text-bluewood-400">AI 해석 · {clean(voice.aiMeaning)}</p>}
          </blockquote>
        )}
        {evidence.length > 0 && (
          <div>
            <p className="mb-1 text-[11.5px] font-black text-bluewood-400">연결된 증거</p>
            {evidence.map((item, index) => (
              <p key={index} className="text-[11.5px] leading-[1.6] text-bluewood-600">
                <span className="font-bold">{clean(item.sourceRef) || clean(item.type) || `근거 ${index + 1}`}</span>
                {(clean(item.whatItProves) || clean(item.claim)) && ` · ${clean(item.whatItProves) || clean(item.claim)}`}
                {clean(item.ownership) && ` · 기여: ${clean(item.ownership)}`}
              </p>
            ))}
          </div>
        )}
        {clean(identity.sentence) && (
          <p className="rounded-lg px-3 py-2.5 text-[12.5px] font-bold leading-[1.6]" style={{ backgroundColor: `${accent}0d`, color: accent }}>
            나를 보여주는 한 문장 · “{clean(identity.sentence)}”
          </p>
        )}
      </div>
    </details>
  );
}

/* ══════════════════════════════════════════════════════════════
   공용 읽기 카드 — 상세 모달 / 공유 링크 / 미리보기 공통 사용
   ─ C/A/R/L 4분할 대신 "핵심 성과 → 맥락 → 배운 점 → 보유 스킬" 순으로
     중요한 내용을 강조해 한 흐름으로 정리
   ══════════════════════════════════════════════════════════════ */
function ExperienceReadCard({ exp, accent = PRIMARY, label }) {
  if (!exp) return null;
  const clean = (v) => (v && !isHint(v) && String(v).trim()) ? stripMd(v) : '';

  const result      = clean(exp.result);
  const learning    = clean(exp.learning);
  const metric      = clean(exp.metric);
  const metricLabel = clean(exp.metricLabel);
  const keywords    = (exp.keywords || []).filter(Boolean);
  const contextItems = [
    { label: '상황', value: clean(exp.situation || exp.context) },
    { label: '행동', value: clean(exp.action) },
  ].filter(item => item.value);

  const hasChart = !!metric || exp.beforeMetric || exp.afterMetric;

  return (
    <div style={{ wordBreak: 'keep-all' }}>
      {/* 헤더: 경험 라벨 + 제목 + 성과 배지 */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="flex-shrink-0 w-7 h-7 rounded-lg text-white text-[12px] font-black flex items-center justify-center mt-0.5"
            style={{ backgroundColor: accent }}>
            ★
          </span>
          <div className="flex-1 min-w-0">
            {label && (
              <span className="text-[11.5px] font-black uppercase tracking-[0.18em] block mb-1" style={{ color: accent }}>{label}</span>
            )}
            <h3 className="text-[21px] sm:text-[25px] font-extrabold text-bluewood-900 leading-[1.24]">
              {stripMd(exp.title) || '—'}
            </h3>
          </div>
        </div>
        {metric && (
          <span className="flex-shrink-0 text-[15px] font-black px-3.5 py-1.5 rounded-lg text-white whitespace-nowrap"
            style={{ backgroundColor: accent }}>
            {metric}
          </span>
        )}
      </div>

      {/* 주인공: 핵심 성과 + 차트 — 같은 행에 배치해 빈 공간 최소화 */}
      {(result || hasChart) && (
        <div className={`grid gap-4 mb-4 items-stretch ${result && hasChart ? 'lg:grid-cols-[1.25fr_0.75fr]' : 'grid-cols-1'}`}>
          {result && (
            <div className="rounded-2xl p-5 flex flex-col justify-center" style={{ backgroundColor: `${accent}0f`, border: `1px solid ${accent}2e` }}>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.12em] mb-2" style={{ color: accent }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} /> 핵심 성과
              </span>
              <p className="text-[17px] font-bold text-bluewood-900 leading-[1.6]">{result}</p>
            </div>
          )}
          {hasChart && (
            <div className="flex flex-col justify-center gap-2 rounded-2xl border border-surface-200 bg-surface-50/50 p-4">
              {metricLabel && <p className="text-[13px] font-bold text-bluewood-700 leading-snug">{metricLabel}</p>}
              <MetricCompareChart exp={exp} accent={accent} />
            </div>
          )}
        </div>
      )}

      {/* 맥락 (상황·행동) — 보조 정보, 2열 압축 */}
      {contextItems.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-4">
          {contextItems.map(item => (
            <div key={item.label}>
              <span className="text-[11.5px] font-black uppercase tracking-[0.12em] text-bluewood-400 block mb-1">{item.label}</span>
              <p className="text-[13.5px] text-bluewood-600 leading-[1.7]">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <DecisionRecordRead exp={exp} accent={accent} />

      {/* 배운 점 + 보유 스킬 */}
      <div className="flex flex-col gap-3">
        {learning && (
          <div className="rounded-xl bg-surface-50 border-l-[3px] px-4 py-3" style={{ borderColor: accent }}>
            <span className="text-[11.5px] font-black uppercase tracking-[0.12em] block mb-1 text-bluewood-500">배운 점</span>
            <p className="text-[14px] text-bluewood-700 leading-[1.7]">{learning}</p>
          </div>
        )}
        {keywords.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] font-black uppercase tracking-[0.12em] text-bluewood-400 mr-1">보유 스킬</span>
            {keywords.map((k, ki) => (
              <span key={ki} className="px-3 py-1 text-[12px] font-semibold rounded-full"
                style={{ backgroundColor: `${accent}12`, color: accent }}>{k}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* 경험 단일 행 — 공용 읽기 카드 사용 */
function ExpRow({ exp, index }) {
  const theme = THEMES[index % THEMES.length];
  return (
    <div className="px-6 py-6">
      <ExperienceReadCard exp={exp} accent={theme.accent} label={theme.label} />
    </div>
  );
}

function ReadOnlyKeyExperiences({ keyExperiences }) {
  if (!keyExperiences || keyExperiences.length === 0) return null;

  const withMetric = keyExperiences.filter(
    e => e.metric && !isHint(e.metric) && e.metric.trim()
  );

  const allKeywords = [...new Set(
    keyExperiences.flatMap(e => (e.keywords || []).filter(Boolean))
  )];

  const allLearnings = keyExperiences
    .map(e => e.learning)
    .filter(l => l && !isHint(l) && l.trim());

  return (
    <div className="space-y-4">

      {/* ─── SECTION 1: 성과 수치 대시보드 ─── */}
      {withMetric.length > 0 && (
        <div>
          <p className="text-[12px] font-black text-bluewood-500 uppercase tracking-[0.1em] mb-3 px-1">성과 수치 요약</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 divide-x divide-y divide-surface-100 border border-surface-100 rounded-xl overflow-hidden">
            {withMetric.map((exp, _i) => {
              const hasBoth = exp.beforeMetric && exp.afterMetric &&
                !isHint(exp.beforeMetric) && !isHint(exp.afterMetric);
              return (
                <div key={_i} className="px-5 py-4 hover:bg-surface-50/60 transition-colors">
                  {exp.metricLabel && (
                    <p className="text-[12px] text-bluewood-400 mb-1">{stripMd(exp.metricLabel)}</p>
                  )}
                  <p className="text-[26px] font-black leading-none mb-1.5" style={{ color: PRIMARY }}>
                    {stripMd(exp.metric)}
                  </p>
                  {hasBoth && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[12px] bg-surface-100 text-bluewood-400 px-1.5 py-0.5 rounded">{exp.beforeMetric}</span>
                      <span className="text-[12px] text-bluewood-300">→</span>
                      <span className="text-[12px] font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${PRIMARY}12`, color: PRIMARY }}>{exp.afterMetric}</span>
                    </div>
                  )}
                  {exp.title && (
                    <p className="text-[12px] text-bluewood-300 mt-1.5">{stripMd(exp.title)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── SECTION 2: 핵심 경험 목록 (구분선만) ─── */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[12px] font-black text-bluewood-500 uppercase tracking-[0.1em]">핵심 경험</p>
          <span className="text-[12px] text-bluewood-300 font-medium">{keyExperiences.length}개</span>
        </div>
        <div className="divide-y divide-surface-200 border border-surface-200 rounded-xl overflow-hidden">
          {keyExperiences.map((exp, i) => (
            <ExpRow key={i} exp={exp} index={i} />
          ))}
        </div>
      </div>

      {/* ─── SECTION 3: 핵심 역량 ─── */}
      {(allKeywords.length > 0 || allLearnings.length > 0) && (
        <div className="border-t border-surface-100 pt-4">
          <p className="text-[12px] font-black text-bluewood-500 uppercase tracking-[0.1em] mb-3 px-1">이 경험으로 쌓은 핵심 역량</p>
          <div className="px-1 space-y-4">
            {allKeywords.length > 0 && (
              <div>
                <p className="text-[11.5px] font-bold text-bluewood-300 uppercase tracking-widest mb-2">역량 스택</p>
                <div className="flex flex-wrap gap-1.5">
                  {allKeywords.map((k, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-[12px] font-semibold bg-surface-50 border border-surface-200 text-bluewood-600">{k}</span>
                  ))}
                </div>
              </div>
            )}
            {allLearnings.length > 0 && (
              <div>
                <p className="text-[11.5px] font-bold text-bluewood-300 uppercase tracking-widest mb-2">핵심 인사이트</p>
                <div className="space-y-2">
                  {allLearnings.map((text, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-[7px]" style={{ backgroundColor: PRIMARY }} />
                      <p className="text-[13px] text-bluewood-600 leading-relaxed" style={{ wordBreak: 'keep-all' }}>{stripMd(text)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
          <span className="text-[14px] text-gray-500 font-semibold">개선 전</span>
          <span className="text-[15px] font-bold text-gray-500">{beforeLabel}</span>
        </div>
        <div className="h-10 bg-gray-100 rounded-lg overflow-hidden relative">
          <div className="h-full bg-[#bcc5d1] rounded-lg transition-all duration-[1200ms] ease-out"
            style={{ width: `${normBefore}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[14px] font-bold" style={{ color: accent }}>개선 후</span>
          <span className="text-[15px] font-black" style={{ color: accent }}>{afterLabel}</span>
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
          <span className="text-[14px] text-gray-500 font-semibold">개선 전</span>
          <span className="text-[15px] font-bold text-gray-500">{beforeLabel}</span>
        </div>
        <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
          <div className="h-full bg-[#bcc5d1] rounded-lg transition-all duration-[1200ms]" style={{ width: `${normBefore}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[14px] font-bold" style={{ color: accent }}>개선 후</span>
          <span className="text-[15px] font-black" style={{ color: accent }}>{afterLabel}</span>
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
    <div className="flex items-end justify-center gap-8 h-[170px]">
      <div className="flex flex-col items-center gap-2">
        <span className="text-[13px] font-bold text-gray-500 whitespace-nowrap">{beforeLabel}</span>
        <div className="w-14 bg-gray-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: '120px' }}>
          <div className="w-full bg-[#bcc5d1] rounded-t-lg transition-all duration-[1200ms]" style={{ height: `${normBefore}%` }} />
        </div>
        <span className="text-[12px] text-gray-400 font-semibold">개선 전</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-[13px] font-black whitespace-nowrap" style={{ color: accent }}>{afterLabel}</span>
        <div className="w-14 bg-gray-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: '120px' }}>
          <div className="w-full rounded-t-lg transition-all duration-[1200ms]" style={{ height: `${normAfter}%`, backgroundColor: accent }} />
        </div>
        <span className="text-[12px] font-bold" style={{ color: accent }}>개선 후</span>
      </div>
    </div>
  );
}

/* 3. lineChart — 꺾은선 */
function ChartLine({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  /* 원(r=5+stroke=2=7)이 잘리지 않도록 y를 10~88 범위로 클램프 */
  const y1 = Math.max(10, Math.min(88, 100 - normBefore));
  const y2 = Math.max(10, Math.min(88, 100 - normAfter));
  return (
    <div className="relative h-[150px]">
      <svg viewBox="-5 -10 210 120" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
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
      <div className="absolute bottom-1 left-4 text-[12px] text-gray-500 font-semibold">개선 전<br/><span className="text-[13px] font-bold">{beforeLabel}</span></div>
      <div className="absolute bottom-1 right-4 text-right text-[12px] font-bold" style={{ color: accent }}>개선 후<br/><span className="text-[13px] font-black">{afterLabel}</span></div>
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
          <span className="text-[20px] font-black" style={{ color: accent }}>{Math.round(normAfter)}%</span>
        </div>
      </div>
      <div className="space-y-2 text-[13px]">
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
      <div className="relative w-[140px] h-[80px]">
        <svg viewBox="-2 -6 104 66" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={halfCirc} strokeDashoffset={stroke} className="transition-all duration-[1200ms]" />
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <span className="text-[20px] font-black" style={{ color: accent }}>{Math.round(normAfter)}%</span>
        </div>
      </div>
      <div className="flex items-center gap-6 mt-2 text-[13px]">
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
      <div className="space-y-2 text-[13px]">
        <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-full bg-[#bcc5d1]" /><span className="text-gray-500">개선 전: <span className="font-bold">{beforeLabel}</span></span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-1.5 rounded-full" style={{ backgroundColor: accent }} /><span style={{ color: accent }}>개선 후: <span className="font-black">{afterLabel}</span></span></div>
      </div>
    </div>
  );
}

/* 7. areaChart — 영역 차트 */
function ChartArea({ beforeLabel, afterLabel, beforePct, afterPct, accent }) {
  const { normBefore, normAfter } = normalizeValues(beforePct, afterPct);
  /* 원(r=4+stroke=2=6)이 잘리지 않도록 y를 8~86 범위로 클램프 */
  const y1 = Math.max(8, Math.min(86, 90 - normBefore * 0.8));
  const y2 = Math.max(8, Math.min(86, 90 - normAfter * 0.8));
  const mid = Math.max(10, ((y1 + y2) / 2) + 5);
  return (
    <div className="relative h-[150px]">
      <svg viewBox="-5 -8 210 118" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
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
      <div className="absolute bottom-1 left-2 text-[12px] text-gray-500 font-semibold">{beforeLabel}</div>
      <div className="absolute bottom-1 right-2 text-[13px] font-black text-right" style={{ color: accent }}>{afterLabel}</div>
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
          <span className="text-[12px] font-bold text-white px-1 truncate">개선 전</span>
        </div>
        <div className="h-full flex items-center justify-center transition-all duration-[1200ms]" style={{ width: `${aPct}%`, backgroundColor: accent }}>
          <span className="text-[12px] font-bold text-white px-1 truncate">개선 후</span>
        </div>
      </div>
      <div className="flex justify-between text-[13px]">
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
        <span className="text-[12px] text-gray-400 font-semibold block mb-1">개선 전</span>
        <span className="text-[20px] font-black text-gray-400 block leading-none">{beforeLabel}</span>
      </div>
      <div className="flex-shrink-0 text-[22px] font-black" style={{ color: accent }}>
        {direction === 'down' ? '↓' : '↑'}
      </div>
      <div className="flex-1 rounded-xl p-4 text-center border-2" style={{ borderColor: `${accent}40`, backgroundColor: `${accent}08` }}>
        <span className="text-[12px] font-semibold block mb-1" style={{ color: accent }}>개선 후</span>
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
          <span className="text-[12px] text-gray-400">개선 전</span>
          <span className="text-[15px] font-bold text-gray-500">{beforeLabel}</span>
        </div>
      </div>
      <div className="text-[20px] font-black" style={{ color: accent }}>→</div>
      <div className="relative w-[80px] h-[80px]">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={accent} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - normAfter / 100)} strokeLinecap="round"
            className="transition-all duration-[1200ms]" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[12px] font-bold" style={{ color: accent }}>개선 후</span>
          <span className="text-[15px] font-black" style={{ color: accent }}>{afterLabel}</span>
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

/* ── 인라인 편집 공통 스타일 ── */
const inlineBase = "bg-white/55 border border-transparent rounded-[6px] px-2 py-1 focus:outline-none focus:bg-white focus:border-primary-100 focus:ring-2 focus:ring-primary-50 transition-all w-full placeholder:text-bluewood-300";

/* ── 편집 가능한 텍스트 필드 (SlideContent 외부 정의 — 렌더링마다 새 타입 생성 방지) ── */
function EditableText({ value, field, placeholder, className, style, tag: Tag = 'p', editing, onChange }) {
  if (editing) {
    const isValHint = isHint(value);
    const displayValue = isValHint ? '' : (value || '');
    const displayPlaceholder = isValHint ? value.replace(/\[작성 필요\]\s*/, '') : placeholder;
    return (
      <input
        value={displayValue}
        onChange={e => onChange(field, e.target.value)}
        placeholder={displayPlaceholder}
        className={`${className} ${inlineBase}`}
        style={style}
      />
    );
  }
  if (isHint(value)) {
    return <HintText value={value} onEdit={() => onChange && onChange('_editHint', field)} />;
  }
  return <Tag className={className} style={style}>{stripMd(value)}</Tag>;
}

/* ── 편집 가능한 textarea (SlideContent 외부 정의 — 렌더링마다 새 타입 생성 방지) ── */
function EditableArea({ value, field, placeholder, rows = 3, editing, onChange }) {
  if (editing) {
    const isValHint = isHint(value);
    const displayValue = isValHint ? '' : (value || '');
    const displayPlaceholder = isValHint ? value.replace(/\[작성 필요\]\s*/, '') : placeholder;
    return (
      <textarea
        value={displayValue}
        onChange={e => onChange(field, e.target.value)}
        placeholder={displayPlaceholder}
        rows={rows}
        className={`text-[13px] text-bluewood-600 resize-none leading-[1.7] ${inlineBase}`}
      />
    );
  }
  return <ViewText value={value} onEdit={() => onChange && onChange('_editHint', field)} />;
}

/* ── 슬라이드 본문 (읽기 + 인라인 편집) ── */
function SlideContent({ exp, theme, editing = false, onChange }) {
  if (!exp) return null;

  const [chartOpen, setChartOpen] = useState(false);
  const isEditing = editing;

  // 읽기 모드: 공용 카드로 통일 (상세 모달 / 공유 링크 / 미리보기 동일)
  if (!isEditing) {
    return <ExperienceReadCard exp={exp} accent={theme.accent || PRIMARY} label={theme.label} />;
  }

  return (
    <div style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }} className="p-0">
      {/* 헤더: 번호(혹은 편집 중 배지) + 제목 편집 + 성과 지표 편집 */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {isEditing ? (
            <span className="flex-shrink-0 px-2.5 py-0.5 rounded-md bg-primary-50 text-primary-600 text-[11.5px] font-black border border-primary-100 uppercase tracking-wider mt-1.5 shadow-sm">
              편집 중
            </span>
          ) : (
            <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-[12px] font-black flex items-center justify-center mt-1" style={{ backgroundColor: theme.accent || PRIMARY }}>
              ★
            </span>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-[11.5px] font-black uppercase tracking-[0.18em] text-bluewood-500 block mb-1">
              {theme.label}
            </span>
            <EditableText
              value={exp.title} field="title" placeholder="제목을 입력하세요" tag="h3"
              className="text-[20px] sm:text-[24px] font-extrabold text-bluewood-900 leading-snug"
              editing={isEditing} onChange={onChange}
            />
          </div>
        </div>
        {/* 성과 지표 편집 */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isEditing ? (
            <div className="flex flex-col gap-1 items-end">
              <span className="text-[11.5px] font-bold text-bluewood-400">성과 지표</span>
              <input
                value={isHint(exp.metric) ? '' : (exp.metric || '')}
                onChange={e => onChange('metric', e.target.value)}
                placeholder={isHint(exp.metric) ? exp.metric.replace(/\[작성 필요\]\s*/, '') : "예: 21% 상승"}
                className={`w-[120px] text-right text-[13px] font-black px-2 py-1 rounded-lg border focus:ring-1 focus:ring-primary-200 outline-none`}
                style={{ color: theme.accent || PRIMARY, borderColor: `${theme.accent || PRIMARY}30` }}
              />
            </div>
          ) : (
            exp.metric && !isHint(exp.metric) && (
              <span className="text-[13px] font-black px-3 py-1 rounded-lg text-white whitespace-nowrap"
                style={{ backgroundColor: theme.accent || PRIMARY }}>
                {stripMd(exp.metric)}
              </span>
            )
          )}
        </div>
      </div>

      {/* 본문: CARL 왼쪽 | 차트 오른쪽 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] gap-6">

        {/* CARL 목록 */}
        <div className="space-y-4">
          {/* C 상황 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex-shrink-0 w-5 h-5 rounded text-[11.5px] font-black text-white flex items-center justify-center mt-1.5"
              style={{ backgroundColor: theme.accent || PRIMARY }}>
              C
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[11.5px] font-black text-bluewood-400 uppercase tracking-[0.12em] block mb-1">상황 (Situation)</span>
              <EditableArea
                value={exp.situation || exp.context} field="situation" placeholder="상황을 입력하세요"
                rows={isEditing ? 3 : 2} editing={isEditing} onChange={onChange}
              />
            </div>
          </div>

          {/* A 행동 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex-shrink-0 w-5 h-5 rounded text-[11.5px] font-black text-white flex items-center justify-center mt-1.5"
              style={{ backgroundColor: theme.accent || PRIMARY }}>
              A
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[11.5px] font-black text-bluewood-400 uppercase tracking-[0.12em] block mb-1">행동 (Action)</span>
              <EditableArea
                value={exp.action} field="action" placeholder="행동을 입력하세요"
                rows={isEditing ? 4 : 3} editing={isEditing} onChange={onChange}
              />
            </div>
          </div>

          {/* R 결과 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex-shrink-0 w-5 h-5 rounded text-[11.5px] font-black text-white flex items-center justify-center mt-1.5"
              style={{ backgroundColor: theme.accent || PRIMARY }}>
              R
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[11.5px] font-black text-bluewood-400 uppercase tracking-[0.12em] block mb-1">결과 (Result)</span>
              <EditableArea
                value={exp.result} field="result" placeholder="결과를 입력하세요"
                rows={isEditing ? 3 : 2} editing={isEditing} onChange={onChange}
              />
            </div>
          </div>

          {/* L 학습 */}
          <div className="flex gap-2.5 items-start">
            <span className="flex-shrink-0 w-5 h-5 rounded text-[11.5px] font-black text-white flex items-center justify-center mt-1.5"
              style={{ backgroundColor: theme.accent || PRIMARY }}>
              L
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[11.5px] font-black text-bluewood-400 uppercase tracking-[0.12em] block mb-1">학습 (Learning)</span>
              <EditableArea
                value={exp.learning} field="learning" placeholder="배운 점을 입력하세요"
                rows={isEditing ? 3 : 2} editing={isEditing} onChange={onChange}
              />
            </div>
          </div>

          {/* 키워드 */}
          <div className="pt-2">
            {isEditing ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-bold text-bluewood-400">키워드 (쉼표로 구분)</span>
                <input
                  value={(exp.keywords || []).join(', ')}
                  onChange={e => onChange('keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))}
                  placeholder="예: 정보 구조, 우선순위, 사용자 경험"
                  className={`w-full text-[13px] px-3 py-1.5 rounded-lg border focus:ring-1 focus:ring-primary-200 outline-none`}
                  style={{ color: theme.accent || PRIMARY, borderColor: `${theme.accent || PRIMARY}30` }}
                />
              </div>
            ) : (
              (exp.keywords || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {exp.keywords.map((k, ki) => (
                    <span key={ki} className="px-2.5 py-1 text-[12px] font-medium bg-surface-50 border border-surface-200 text-bluewood-500 rounded-full">
                      {k}
                    </span>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* 차트 + 지표 설정 */}
        <div className="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-50/40 p-4 h-fit">
          <div className="space-y-2">
            {isEditing ? (
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] font-bold text-bluewood-400">지표 설명</span>
                <input
                  value={exp.metricLabel || ''}
                  onChange={e => onChange('metricLabel', e.target.value)}
                  placeholder="예: API 응답 시간"
                  className={`w-full text-[13px] px-3 py-1 rounded-lg border focus:ring-1 focus:ring-primary-200 outline-none`}
                  style={{ color: theme.accent || PRIMARY, borderColor: `${theme.accent || PRIMARY}30` }}
                />
              </div>
            ) : (
              exp.metricLabel && (
                <p className="text-[14px] font-bold text-bluewood-900 leading-snug">{exp.metricLabel}</p>
              )
            )}
          </div>

          {/* 비교 바 차트 */}
          <div className="pt-2">
            {(isHint(exp.beforeMetric) || isHint(exp.afterMetric)) && !isEditing ? (
              <div className="flex flex-col gap-2">
                <HintText value={isHint(exp.beforeMetric) ? exp.beforeMetric : exp.afterMetric}
                  onEdit={() => onChange && onChange('_editHint', 'beforeMetric')} />
              </div>
            ) : (
              <MetricCompareChart exp={exp} accent={theme.accent || PRIMARY} />
            )}
          </div>

          {/* 차트 설정 토글 */}
          {isEditing && (
            <div className="border-t border-surface-200 mt-2 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-bluewood-400">비교 수치 설정</span>
                <button
                  onClick={() => setChartOpen(o => !o)}
                  className="text-[12px] font-bold text-primary-600 hover:underline"
                >
                  {chartOpen ? '설정 닫기 ▲' : '설정 열기 ▼'}
                </button>
              </div>

              {chartOpen && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-bold text-bluewood-400">개선 전 (Before)</span>
                      <input
                        value={isHint(exp.beforeMetric) ? '' : (exp.beforeMetric || '')}
                        onChange={e => onChange('beforeMetric', e.target.value)}
                        placeholder="예: 800ms"
                        className="text-[12px] px-2.5 py-1.5 border border-surface-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-200"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-bold text-bluewood-400">개선 후 (After)</span>
                      <input
                        value={isHint(exp.afterMetric) ? '' : (exp.afterMetric || '')}
                        onChange={e => onChange('afterMetric', e.target.value)}
                        placeholder="예: 480ms"
                        className="text-[12px] px-2.5 py-1.5 border border-surface-200 rounded-lg outline-none focus:ring-1 focus:ring-primary-200 font-bold"
                        style={{ color: theme.accent || PRIMARY }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {CHART_TYPES.map(ct => (
                      <button key={ct.id}
                        onClick={() => onChange('chartType', ct.id)}
                        className={`px-2 py-0.5 rounded-md border text-[12px] font-medium transition-all ${
                          (exp.chartType || 'horizontalBar') === ct.id
                            ? 'border-primary-200 bg-primary-50 text-primary-700 font-semibold'
                            : 'border-surface-200 bg-white text-bluewood-400 hover:border-bluewood-300'
                        }`}>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   메인 슬라이더
   ══════════════════════════════════════════════ */
const KeyExperienceSlider = forwardRef(function KeyExperienceSlider({
  keyExperiences = [], onUpdate, viewOnly = false,
  hideHeader = false, forceEditing = false, listMode = false, onEditingChange, onCurrentChange, onDeletedCountChange, onDirty,
}, ref) {
  const [current, setCurrent] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localExp, setLocalExp] = useState(null);
  const [deletedStack, setDeletedStack] = useState([]);
  const [freeFormText, setFreeFormText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [collapsedIdx, setCollapsedIdx] = useState({});   // 리스트 모드: 카드별 접힘
  const [listRefine, setListRefine] = useState({});        // 리스트 모드: 카드별 AI 보강 메모
  const [memoOpenIdx, setMemoOpenIdx] = useState({});      // 리스트 모드: 카드별 보강 메모 펼침
  const [listRefiningIdx, setListRefiningIdx] = useState(null);
  const refineKeyExperience = useExperienceStore(s => s.refineKeyExperience);
  const touchStartX = useRef(null);
  const stateRef = useRef({});
  const handlersRef = useRef({});
  stateRef.current = { current, editing, localExp, deletedStack, keyExperiences };

  const handleRefine = async () => {
    if (!freeFormText.trim() || !localExp) return;
    setIsRefining(true);
    try {
      const refined = await refineKeyExperience(localExp, freeFormText);
      onDirty?.();
      setLocalExp(prev => ({ ...prev, ...refined }));
      setFreeFormText('');
    } catch (err) {
      toast.error(err.message || 'AI 보강에 실패했습니다.');
    } finally {
      setIsRefining(false);
    }
  };

  const _setEditing = (val) => { setEditing(val); onEditingChange?.(val); };
  const _setCurrent = (val) => { setCurrent(val); onCurrentChange?.(val); };
  const _setDeletedStack = (updater) => {
    setDeletedStack(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onDeletedCountChange?.(next.length);
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    get editing() { return stateRef.current.editing; },
    get current() { return stateRef.current.current; },
    get deletedCount() { return stateRef.current.deletedStack.length; },
    startEditing: () => handlersRef.current.startEditing?.(),
    saveEditing: () => handlersRef.current.handleSave?.(),
    cancelEditing: () => handlersRef.current.handleCancel?.(),
    deleteSlide: () => handlersRef.current.handleDelete?.(),
    undoDelete: () => handlersRef.current.handleUndo?.(),
    addSlide: () => handlersRef.current.handleAdd?.(),
    goTo: (idx) => handlersRef.current.goTo?.(idx),
    goNext: () => handlersRef.current.goNext?.(),
    goPrev: () => handlersRef.current.goPrev?.(),
  }));

  useEffect(() => {
    if (!forceEditing || !onUpdate || keyExperiences.length === 0) return;
    const safeCurrent = Math.min(current, keyExperiences.length - 1);
    if (safeCurrent !== current) {
      _setCurrent(safeCurrent);
      return;
    }
    if (!editing || !localExp) {
      setLocalExp({ ...(keyExperiences[safeCurrent] || {}) });
      if (!editing) _setEditing(true);
    }
  }, [forceEditing, onUpdate, keyExperiences.length, current, editing, localExp]);

  /* ── 리스트 모드: 모든 핵심 경험을 세로로 쌓아 개별 편집 ── */
  if (listMode && onUpdate && !viewOnly) {
    const blankExp = { title: '', metric: '', metricLabel: '', beforeMetric: '', afterMetric: '', situation: '', action: '', result: '', learning: '', keywords: [] };
    const updateAt = (index, field, val) => {
      if (field === '_editHint') return;
      onDirty?.();
      onUpdate(keyExperiences.map((e, i) => (i === index ? { ...e, [field]: val } : e)));
    };
    const addCard = () => {
      onDirty?.();
      onUpdate([...keyExperiences, { ...blankExp }]);
    };
    const deleteCard = (index) => {
      onDirty?.();
      _setDeletedStack(prev => [...prev, { item: keyExperiences[index], index }]);
      onUpdate(keyExperiences.filter((_, i) => i !== index));
    };
    const undoDelete = () => {
      if (deletedStack.length === 0) return;
      const last = deletedStack[deletedStack.length - 1];
      _setDeletedStack(prev => prev.slice(0, -1));
      const insertIdx = Math.min(last.index, keyExperiences.length);
      onUpdate([...keyExperiences.slice(0, insertIdx), last.item, ...keyExperiences.slice(insertIdx)]);
    };
    const refineCard = async (index) => {
      const text = (listRefine[index] || '').trim();
      if (!text) return;
      setListRefiningIdx(index);
      try {
        const refined = await refineKeyExperience(keyExperiences[index], text);
        onDirty?.();
        onUpdate(keyExperiences.map((e, i) => (i === index ? { ...e, ...refined } : e)));
        setListRefine(prev => ({ ...prev, [index]: '' }));
      } catch (err) {
        toast.error(err.message || 'AI 보강에 실패했습니다.');
      } finally {
        setListRefiningIdx(null);
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-bluewood-400">
            핵심 경험 <span className="font-bold text-bluewood-600">{keyExperiences.length}개</span> · 면접관이 한 화면에서 훑어볼 수 있게 정리하세요
          </p>
          {deletedStack.length > 0 && (
            <button onClick={undoDelete}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all">
              <Undo2 size={12} /> 삭제 되돌리기 ({deletedStack.length})
            </button>
          )}
        </div>

        {keyExperiences.map((e, i) => {
          const t = THEMES[i % THEMES.length];
          const collapsed = !!collapsedIdx[i];
          const title = stripMd(e.title) || `핵심 경험 ${i + 1}`;
          const metric = stripMd(e.metric);
          return (
            <div key={i} className="rounded-2xl border border-surface-100 bg-white overflow-hidden" style={{ boxShadow: '0 6px 24px rgba(15,40,80,0.05)' }}>
              <div className="h-1 w-full" style={{ backgroundColor: NAVY }} />
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-surface-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex-shrink-0 w-7 h-7 rounded-lg text-white text-[12px] font-black flex items-center justify-center" style={{ backgroundColor: t.color }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15px] font-extrabold text-bluewood-900 truncate" style={{ wordBreak: 'keep-all' }}>{title}</span>
                  {metric && <span className="flex-shrink-0 text-[12px] font-black px-2 py-0.5 rounded text-white" style={{ backgroundColor: t.color }}>{metric}</span>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setCollapsedIdx(prev => ({ ...prev, [i]: !collapsed }))} title={collapsed ? '펼치기' : '접기'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-200 text-bluewood-500 hover:bg-surface-50 active:scale-95 transition-all">
                    {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                  </button>
                  <button onClick={() => deleteCard(i)} title="이 핵심 경험 삭제"
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 active:scale-95 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {!collapsed && (
                <div className="px-5 py-5">
                  {/* 경험 내용 먼저 */}
                  <SlideContent exp={e} theme={t} editing onChange={(field, val) => updateAt(i, field, val)} />

                  {/* 자유 보강 메모 — 접이식(기본 숨김)으로 분리 */}
                  <div className="mt-4 border-t border-surface-100 pt-3">
                    <button
                      onClick={() => setMemoOpenIdx(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-bluewood-400 transition-colors hover:text-primary-600"
                    >
                      <ChevronDown size={13} className={`transition-transform ${memoOpenIdx[i] ? 'rotate-180' : ''}`} />
                      자유 보강 메모
                      {listRefine[i]?.trim() && !memoOpenIdx[i] && <span className="text-[12px] font-medium text-primary-500">· 작성됨</span>}
                    </button>
                    {memoOpenIdx[i] && (
                      <div className="mt-2.5 rounded-xl border border-surface-200 bg-surface-50 p-3.5">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="min-w-0 text-[12px] leading-relaxed text-bluewood-400">성과·내용을 자유롭게 적고 ‘보강하기’를 누르면 위 상황·행동·결과·지표에 자동 정리됩니다.</p>
                          <button onClick={() => refineCard(i)} disabled={!listRefine[i]?.trim() || listRefiningIdx === i}
                            className="flex-shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50">
                            {listRefiningIdx === i ? '정리 중...' : '보강하기'}
                          </button>
                        </div>
                        <textarea
                          value={listRefine[i] || ''}
                          onChange={ev => setListRefine(prev => ({ ...prev, [i]: ev.target.value }))}
                          placeholder="예: 매출 30% 증가, 리텐션 20%→45% 개선. 초기 예상과 달리 네트워크 비용이 문제라서..."
                          className="w-full h-16 px-3 py-2 text-[13px] rounded-lg border border-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white resize-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={addCard}
          className="w-full py-3 border-2 border-dashed border-surface-200 rounded-xl text-[14px] font-medium text-bluewood-400 hover:border-primary-300 hover:text-primary-500 transition-colors flex items-center justify-center gap-1.5">
          <Plus size={15} /> 핵심 경험 추가
        </button>
      </div>
    );
  }

  if (keyExperiences.length === 0) return null;

  /* onUpdate 없음 = 읽기 전용 모드 → 모든 경험을 한 화면에 */
  if (!onUpdate) {
    return <ReadOnlyKeyExperiences keyExperiences={keyExperiences} />;
  }

  const exp = keyExperiences[current];
  const theme = THEMES[current % THEMES.length];
  const displayExp = editing && localExp ? localExp : exp;

  const goTo = (idx) => {
    if (isAnimating || idx === current) return;
    const wasEditing = editing;
    let nextExperiences = keyExperiences;
    if (editing && localExp && onUpdate) {
      nextExperiences = keyExperiences.map((e, i) => i === current ? localExp : e);
      onUpdate(nextExperiences);
    }
    if (!forceEditing) {
      _setEditing(false);
      setLocalExp(null);
    }
    setIsAnimating(true);
    setTimeout(() => {
      _setCurrent(idx);
      if (forceEditing && wasEditing && onUpdate) {
        setLocalExp({ ...(nextExperiences[idx] || {}) });
        _setEditing(true);
      }
      setIsAnimating(false);
    }, 250);
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

  const handleFieldChange = (key, val) => {
    if (key === '_editHint') {
      if (!editing) { setLocalExp({ ...exp }); _setEditing(true); }
      return;
    }
    onDirty?.();
    setLocalExp(prev => ({ ...(prev || exp), [key]: val }));
  };

  const handleSave = () => {
    if (!onUpdate) return keyExperiences;
    const next = localExp ? keyExperiences.map((e, i) => i === current ? localExp : e) : keyExperiences;
    if (localExp) onUpdate(next);
    if (forceEditing) {
      setLocalExp({ ...(next[current] || {}) });
      _setEditing(true);
    } else {
      _setEditing(false);
      setLocalExp(null);
    }
    return next;
  };

  const handleCancel = () => {
    if (forceEditing) {
      setLocalExp({ ...(exp || {}) });
      _setEditing(true);
      return;
    }
    _setEditing(false);
    setLocalExp(null);
  };

  const handleDelete = () => {
    if (!onUpdate) return;
    _setDeletedStack(prev => [...prev, { item: exp, index: current }]);
    const next = keyExperiences.filter((_, i) => i !== current);
    onUpdate(next);
    const nextIndex = Math.max(0, current - 1);
    _setCurrent(nextIndex);
    if (forceEditing && next.length > 0) {
      setLocalExp({ ...(next[nextIndex] || {}) });
      _setEditing(true);
    } else {
      _setEditing(false);
      setLocalExp(null);
    }
  };

  const handleUndo = () => {
    if (deletedStack.length === 0 || !onUpdate) return;
    const last = deletedStack[deletedStack.length - 1];
    _setDeletedStack(prev => prev.slice(0, -1));
    const insertIdx = Math.min(last.index, keyExperiences.length);
    const next = [...keyExperiences.slice(0, insertIdx), last.item, ...keyExperiences.slice(insertIdx)];
    onUpdate(next);
    _setCurrent(insertIdx);
  };

  const handleAdd = () => {
    if (!onUpdate) return;
    const next = [...keyExperiences, { title: '', metric: '', metricLabel: '', beforeMetric: '', afterMetric: '', situation: '', action: '', result: '', keywords: [] }];
    onUpdate(next);
    const newIdx = next.length - 1;
    _setCurrent(newIdx);
    setLocalExp({ ...next[newIdx] });
    _setEditing(true);
  };

  const startEditing = () => { setLocalExp({ ...exp }); _setEditing(true); };

  handlersRef.current = { startEditing, handleSave, handleCancel, handleDelete, handleUndo, handleAdd, goTo, goNext, goPrev };

  return (
    <div className="mb-0">
      {/* 헤더 */}
      {!hideHeader && (
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-primary-600">핵심 경험</h2>
          <span className="text-xs text-bluewood-300 hidden sm:inline">포트폴리오용 시각화 자료</span>
          {!viewOnly && onUpdate && deletedStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all"
            >
              <Undo2 size={12} /> 되돌리기 ({deletedStack.length})
            </button>
          )}
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
          {!viewOnly && onUpdate && !editing && (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-bluewood-500 border-surface-200 hover:bg-surface-50 transition-all"
            >
              <PenLine size={13} /> 수정
            </button>
          )}
          {!viewOnly && onUpdate && editing && (
            <>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-red-400 border-red-200 hover:bg-red-50 transition-all"
              >
                <Trash2 size={13} /> 삭제
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-bluewood-400 border-surface-200 hover:bg-surface-50 transition-all"
              >
                <X size={13} /> 취소
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-primary-500 text-white border-primary-500 shadow-sm hover:bg-primary-600 transition-all"
              >
                <Check size={13} /> 저장
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {/* 자유 보강 메모 (편집 모드 시) */}
      {editing && (
        <div className="mb-4 rounded-xl border border-surface-200 bg-surface-50 p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-bluewood-700">자유 보강 메모</p>
              <p className="text-[12px] leading-relaxed text-bluewood-400">성과·내용을 자유롭게 적으면 아래 항목이 자동으로 정리됩니다.</p>
            </div>
            <button
              onClick={handleRefine}
              disabled={!freeFormText?.trim() || isRefining}
              className="flex-shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {isRefining ? '정리 중...' : '보강하기'}
            </button>
          </div>
          <textarea
            value={freeFormText}
            onChange={e => setFreeFormText(e.target.value)}
            placeholder="예: 매출 30% 증가시켰고, 사용자 리텐션은 기존 20%에서 45%로 개선했습니다. 초기 예상과 달리 네트워크 비용이 문제라서..."
            className="w-full h-20 px-3 py-2 text-[13px] rounded-lg border border-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white resize-none"
          />
        </div>
      )}

      {/* 슬라이드 */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        className={`relative overflow-hidden rounded-[14px] border border-surface-200 bg-white transition-all duration-250 ease-out ${
          isAnimating
            ? 'opacity-0 scale-[0.985] translate-y-1'
            : 'opacity-100 scale-100 translate-y-0'
        } ${editing ? 'ring-2 ring-primary-200' : ''}`}
        style={{ boxShadow: '0 10px 40px rgba(49,65,87,0.08)' }}>
        <div className="h-1 w-full" style={{ backgroundColor: NAVY }} />
        <div className="relative px-7 py-6">
          <SlideContent
            exp={displayExp}
            theme={theme}
            editing={editing}
            onChange={handleFieldChange}
          />
        </div>
      </div>

      {/* 하단 썸네일 탭 + 추가 버튼 */}
      {keyExperiences.length > 1 && (
        <div className="flex gap-2 mt-3">
          {keyExperiences.map((e, i) => {
            const t = THEMES[i % THEMES.length];
            const active = i === current;
            return (
              <button key={i} onClick={() => goTo(i)}
                className={`flex-1 rounded-xl p-2.5 border transition-all text-left ${
                  active
                    ? 'shadow-md bg-white'
                    : 'border-transparent bg-surface-50 hover:bg-surface-100 opacity-50 hover:opacity-70'
                }`}
                style={active ? { borderColor: t.color } : {}}>
                <span className="text-[12px] font-bold uppercase tracking-widest block mb-0.5"
                  style={{ color: t.color }}>
                  {t.label}
                </span>
                <span className={`text-[13px] font-semibold line-clamp-1 ${
                  active ? 'text-bluewood-800' : 'text-bluewood-500'
                }`} style={{ wordBreak: 'keep-all' }}>
                  {stripMd(e.title)?.slice(0, 30)}{(stripMd(e.title)?.length || 0) > 30 ? '...' : ''}
                </span>
                <span className="text-[12px] text-bluewood-400 font-medium">{stripMd(e.metric) || ''}</span>
              </button>
            );
          })}
        </div>
      )}

      {!viewOnly && onUpdate && (
        <button
          onClick={handleAdd}
          className="mt-3 w-full py-2.5 border-2 border-dashed border-surface-200 rounded-xl text-[14px] font-medium text-bluewood-400 hover:border-primary-300 hover:text-primary-500 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus size={14} /> 핵심 경험 추가
        </button>
      )}
    </div>
  );
});

export default KeyExperienceSlider;
