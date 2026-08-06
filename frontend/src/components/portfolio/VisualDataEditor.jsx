// 직군별 차트 데이터 구조화 입력기 — 사용자가 표로 수치를 넣으면 즉시 미리보기 차트로 반영.
// 편집 대상은 structuredResult.portfolioVisuals (AI 자동 생성값을 손으로 보정/추가).
// 각 블록(kpis·funnel·funnelCompare·compare·mix·gauges·goals·timeline)은 행 편집기 + 라이브 프리뷰로 구성.
import { Plus, Trash2, BarChart3 } from 'lucide-react';
import { KpiTileRow, FunnelChart, DumbbellCompare, MixBar, GoalBoard, GaugeRow } from './JobVisuals';
import { PairedBars, RoadmapGantt } from './JobSignature';

// 직군별 편집 가능한 블록 (백엔드 JOB_VISUAL_GUIDES와 대응)
const EDITABLE_BLOCKS = {
  marketer: ['kpis', 'funnel', 'mix', 'compare'],
  hr: ['funnel', 'funnelCompare', 'kpis', 'compare'],
  sales: ['funnel', 'kpis', 'compare'],
  da: ['compare', 'kpis', 'funnel'],
  aiml: ['kpis', 'compare'],
  devops: ['gauges', 'compare', 'kpis'],
  pm: ['goals', 'timeline', 'kpis'],
  designer: ['compare', 'kpis'],
  common: ['kpis', 'compare'],
};

// 블록별 컬럼 정의 + 저장 경로(부모 portfolioVisuals에서의 위치)
const BLOCK_DEFS = {
  kpis: {
    title: '핵심 지표 (KPI)', hint: '헤드라인 수치 — 목표치가 있으면 목표 대비 달성률 미터가 뜹니다.',
    path: ['kpis'], nested: null,
    cols: [
      { key: 'label', label: '지표명', ph: 'ROAS', w: 'flex-[1.2]' },
      { key: 'value', label: '수치', ph: '350%', w: 'flex-1' },
      { key: 'target', label: '목표(선택)', ph: '300%', w: 'flex-1' },
    ],
  },
  funnel: {
    title: '전환 퍼널', hint: '단계별 인원·수치 (2단계 이상). 단계 간 전환율이 자동 계산됩니다.',
    path: ['funnel', 'stages'], nested: 'stages',
    cols: [
      { key: 'label', label: '단계명', ph: '노출', w: 'flex-[1.4]' },
      { key: 'value', label: '수치', ph: '10000', w: 'flex-1', num: true },
    ],
  },
  funnelCompare: {
    title: '퍼널 개선 전/후', hint: '같은 단계의 개선 전·후 수치 (2단계 이상). 단계별 개선율이 표시됩니다.',
    path: ['funnelCompare', 'stages'], nested: 'stages',
    cols: [
      { key: 'label', label: '단계명', ph: '서류 통과율', w: 'flex-[1.4]' },
      { key: 'before', label: '개선 전', ph: '18%', w: 'flex-1' },
      { key: 'after', label: '개선 후', ph: '31%', w: 'flex-1' },
    ],
  },
  compare: {
    title: '개선 성과 (Before → After)', hint: '개선 전·후 대비 지표.',
    path: ['compare'], nested: null,
    cols: [
      { key: 'label', label: '지표명', ph: '응답 속도', w: 'flex-[1.3]' },
      { key: 'before', label: '전', ph: '1200ms', w: 'flex-1' },
      { key: 'after', label: '후', ph: '340ms', w: 'flex-1' },
    ],
  },
  mix: {
    title: '채널 · 구성 믹스', hint: '항목별 비중(%) — 100% 누적 막대로 표시됩니다.',
    path: ['mix', 'items'], nested: 'items',
    cols: [
      { key: 'label', label: '항목명', ph: '메타', w: 'flex-[1.4]' },
      { key: 'pct', label: '비중(%)', ph: '40', w: 'flex-1', num: true },
    ],
  },
  gauges: {
    title: '운영 안정성 게이지', hint: '가용성·SLA 등 "목표 대비 현재" 지표. 가용성은 % 단위로.',
    path: ['gauges'], nested: null,
    cols: [
      { key: 'label', label: '지표명', ph: '가용성', w: 'flex-[1.3]' },
      { key: 'value', label: '현재', ph: '99.95', w: 'flex-1' },
      { key: 'unit', label: '단위', ph: '%', w: 'w-16' },
      { key: 'target', label: '목표(선택)', ph: '99.9', w: 'flex-1' },
    ],
  },
  goals: {
    title: 'MSC 목표 달성', hint: '목표별 target/actual과 달성 여부.',
    path: ['goals'], nested: null,
    cols: [
      { key: 'label', label: '목표', ph: '재방문율 개선', w: 'flex-[1.6]' },
      { key: 'target', label: '목표치', ph: '30%', w: 'flex-1' },
      { key: 'actual', label: '실제', ph: '34%', w: 'flex-1' },
      { key: 'achieved', label: '달성', w: 'w-16', bool: true },
    ],
  },
  timeline: {
    title: '프로덕트 로드맵', hint: '단계별 시작(start)·기간(span)을 상대 단위(주·월)로. 순서만 있으면 비워도 됩니다.',
    path: ['timeline', 'phases'], nested: 'phases',
    cols: [
      { key: 'label', label: '단계명', ph: '리서치', w: 'flex-[1.4]' },
      { key: 'start', label: '시작', ph: '0', w: 'w-16', num: true },
      { key: 'span', label: '기간', ph: '2', w: 'w-16', num: true },
      { key: 'desc', label: '설명(선택)', ph: '유저 인터뷰', w: 'flex-[1.2]' },
    ],
  },
};

// portfolioVisuals에서 블록의 행 배열을 꺼냄 (nested 여부 처리)
function getRows(pv, def) {
  const top = pv?.[def.path[0]];
  if (def.nested) return Array.isArray(top?.[def.nested]) ? top[def.nested] : (Array.isArray(top) ? top : []);
  return Array.isArray(top) ? top : [];
}
// 행 배열을 다시 portfolioVisuals에 반영한 새 객체 반환
function setRows(pv, def, rows) {
  const next = { ...(pv || {}) };
  if (def.nested) next[def.path[0]] = { ...(next[def.path[0]] || {}), [def.nested]: rows };
  else next[def.path[0]] = rows;
  return next;
}

// 블록 rows → 프리뷰 컴포넌트 (라이브)
function BlockPreview({ block, rows, accent }) {
  const nz = (v) => Number(String(v ?? '').replace(/,/g, ''));
  const has = (r, ks) => ks.every(k => String(r[k] ?? '').trim() !== '');
  switch (block) {
    case 'kpis': {
      const items = rows.filter(r => has(r, ['label', 'value']));
      return items.length ? <KpiTileRow title="미리보기 · 핵심 지표" items={items} accent={accent} /> : null;
    }
    case 'funnel': {
      const stages = rows.filter(r => has(r, ['label']) && Number.isFinite(nz(r.value))).map(r => ({ label: r.label, value: nz(r.value), unit: r.unit || '' }));
      return stages.length >= 2 ? <FunnelChart title="미리보기 · 퍼널" stages={stages} accent={accent} /> : null;
    }
    case 'funnelCompare': {
      const rr = rows.filter(r => has(r, ['label', 'before', 'after'])).map(r => ({ label: r.label, a: r.before, b: r.after }));
      return rr.length >= 2 ? <PairedBars title="미리보기 · 퍼널 개선 전/후" rows={rr} aLabel="개선 전" bLabel="개선 후" accent={accent} /> : null;
    }
    case 'compare': {
      const rr = rows.filter(r => has(r, ['label', 'before', 'after']));
      return rr.length ? <DumbbellCompare title="미리보기 · 개선 성과" rows={rr} accent={accent} /> : null;
    }
    case 'mix': {
      const items = rows.filter(r => has(r, ['label']) && Number.isFinite(nz(r.pct))).map(r => ({ label: r.label, pct: nz(r.pct) }));
      return items.length >= 2 ? <MixBar title="미리보기 · 믹스" items={items} accent={accent} /> : null;
    }
    case 'gauges': {
      const items = rows.filter(r => has(r, ['label', 'value']));
      return items.length ? <GaugeRow title="미리보기 · 게이지" items={items} accent={accent} /> : null;
    }
    case 'goals': {
      const goals = rows.filter(r => has(r, ['label'])).map(r => ({ ...r, achieved: r.achieved === true }));
      return goals.length ? <GoalBoard title="미리보기 · MSC" goals={goals} accent={accent} /> : null;
    }
    case 'timeline': {
      const phases = rows.filter(r => has(r, ['label']));
      return phases.length >= 2 ? <RoadmapGantt phases={phases} accent={accent} /> : null;
    }
    default: return null;
  }
}

function BlockEditor({ block, pv, onChange, accent }) {
  const def = BLOCK_DEFS[block];
  const rows = getRows(pv, def);
  const update = (next) => onChange(setRows(pv, def, next));
  // 사용자가 손으로 넣거나 고친 값은 source:'self' 로 표시한다 —
  // AI가 원본 근거에서 뽑은 수치와 근거 강도가 다르므로 차트에서 구분해 그린다(JobVisuals.SelfTag).
  const setCell = (i, key, value) => update(rows.map((r, ri) => (ri === i ? { ...r, [key]: value, source: 'self' } : r)));
  const addRow = () => update([...rows, { ...Object.fromEntries(def.cols.map(c => [c.key, c.bool ? false : ''])), source: 'self' }]);
  const delRow = (i) => update(rows.filter((_, ri) => ri !== i));

  return (
    <div className="rounded-xl border border-surface-200 bg-white">
      <div className="border-b border-surface-100 px-4 py-3">
        <p className="text-[13px] font-bold text-bluewood-800">{def.title}</p>
        <p className="mt-0.5 text-[11.5px] text-bluewood-400">{def.hint}</p>
      </div>
      <div className="p-4">
        {rows.length > 0 && (
          <div className="mb-1 flex items-center gap-2 px-1 text-[11.5px] font-bold uppercase tracking-wide text-bluewood-300">
            {def.cols.map(c => <span key={c.key} className={c.w}>{c.label}</span>)}
            <span className="w-7" />
          </div>
        )}
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              {def.cols.map(c => (
                c.bool ? (
                  <label key={c.key} className={`${c.w} flex items-center justify-center`}>
                    <input type="checkbox" checked={r[c.key] === true} onChange={e => setCell(i, c.key, e.target.checked)}
                      className="h-4 w-4 rounded border-surface-300" style={{ accentColor: accent }} />
                  </label>
                ) : (
                  <input key={c.key} value={r[c.key] ?? ''} placeholder={c.ph}
                    onChange={e => setCell(i, c.key, e.target.value)} inputMode={c.num ? 'decimal' : undefined}
                    className={`${c.w} min-w-0 rounded-md border border-surface-200 px-2.5 py-1.5 text-[12.5px] text-bluewood-800 outline-none focus:ring-2 focus:ring-primary-200`} />
                )
              ))}
              <button type="button" onClick={() => delRow(i)} title="행 삭제"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-bluewood-300 hover:bg-rose-50 hover:text-rose-500">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed border-surface-300 px-3 py-1.5 text-[12px] font-semibold text-bluewood-500 hover:bg-surface-50">
          <Plus size={13} /> 행 추가
        </button>
        <div className="mt-4"><BlockPreview block={block} rows={rows} accent={accent} /></div>
      </div>
    </div>
  );
}

export default function VisualDataEditor({ jobCategory, value, onChange, accent = '#002F6C' }) {
  const blocks = EDITABLE_BLOCKS[jobCategory] || EDITABLE_BLOCKS.common;
  const pv = value || {};
  return (
    <div className="border border-surface-100 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-surface-100 px-6 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-white"><BarChart3 size={16} /></span>
        <div>
          <p className="text-[14px] font-bold text-bluewood-700">차트 데이터 편집</p>
          <p className="text-[12px] text-bluewood-400">표에 수치를 입력하면 포트폴리오 차트에 그대로 반영됩니다 — AI가 채운 값을 보정하거나 직접 추가하세요.</p>
          <p className="mt-0.5 text-[11.5px] text-bluewood-300">직접 입력·수정한 값은 차트에서 점선 + &quot;본인 기재&quot;로 표시됩니다. 자료로 확인되는 수치와 구분하기 위한 표시입니다.</p>
        </div>
      </div>
      <div className="space-y-4 bg-surface-50/30 p-5">
        {blocks.map(b => (
          <BlockEditor key={b} block={b} pv={pv} accent={accent}
            onChange={(nextPv) => onChange(nextPv)} />
        ))}
      </div>
    </div>
  );
}
