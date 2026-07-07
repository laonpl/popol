// 직무별 다이어그램 뷰 — 같은 {nodes,edges}(tier 포함)를 직무 골격에 맞는 다른 형태로 렌더.
// dev = 계층 박스(기존 ArchitectureDiagram) / aiml = 좌→우 파이프라인 / devops = 존 레인 토폴로지.
// 편집은 공용 캔버스가 담당하고, 여기서는 보기 전용으로 tier를 축으로 재배치만 한다.
import { ArrowRight, Database, Cpu, GitBranch } from 'lucide-react';
import { tint } from './JobVisuals';

const clean = (v) => String(v ?? '').replace(/\*\*/g, '').trim();
const tierOf = (n) => Number(n.tier) || 0;
// tier별로 노드를 묶어 오름차순 컬럼/레인 배열로
function groupByTier(nodes) {
  const valid = (nodes || []).filter(n => clean(n.label));
  const tiers = [...new Set(valid.map(tierOf))].sort((a, b) => a - b);
  return tiers.map(t => valid.filter(n => tierOf(n) === t));
}

/* ── AI/ML: 좌 → 우 파이프라인 — tier가 곧 처리 단계(데이터→전처리→학습→평가→서빙) ── */
const AIML_STAGE_HINT = ['데이터', '전처리 · 피처', '모델 · 학습', '평가', '서빙'];
export function PipelineDiagram({ diagram, accent = '#002F6C' }) {
  const cols = groupByTier(diagram?.nodes);
  if (!cols.length) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-200 bg-surface-50/30 p-4 sm:p-6">
      <div className="flex items-stretch gap-1.5" style={{ minWidth: cols.length * 150 }}>
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-1 items-stretch gap-1.5">
            <div className="flex-1">
              {/* 단계 헤더 */}
              <div className="mb-2 flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] font-black text-white" style={{ backgroundColor: accent }}>{ci + 1}</span>
                <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: accent }}>
                  {clean(col[0]?.stage) || AIML_STAGE_HINT[ci] || `STAGE ${ci + 1}`}
                </span>
              </div>
              <div className="space-y-2">
                {col.map((n, i) => (
                  <div key={i} className="rounded-xl border bg-white p-3" style={{ borderColor: tint(accent, 0.55) }}>
                    <p className="flex items-center gap-1.5 text-[13px] font-extrabold leading-snug text-bluewood-900">
                      {ci === 0 ? <Database size={12} style={{ color: accent }} /> : ci >= cols.length - 1 ? null : <Cpu size={12} style={{ color: accent }} />}
                      {clean(n.label)}
                    </p>
                    {clean(n.tech) && <p className="mt-1 font-mono text-[11px] leading-[1.5] text-bluewood-500">{clean(n.tech)}</p>}
                  </div>
                ))}
              </div>
            </div>
            {ci < cols.length - 1 && <ArrowRight size={18} className="mt-8 flex-shrink-0 self-start" style={{ color: tint(accent, 0.3) }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 데브옵스: 존 레인 토폴로지 — tier = 인프라 존(엣지→게이트웨이→서비스→데이터). 왼쪽 존 라벨 + 가로 레인 ── */
const DEVOPS_ZONE_HINT = ['엣지 · 사용자', '게이트웨이 · LB', '서비스 · 런타임', '데이터 · 모니터링'];
export function TopologyDiagram({ diagram, accent = '#002F6C' }) {
  const lanes = groupByTier(diagram?.nodes);
  if (!lanes.length) return null;
  const idToLabel = Object.fromEntries((diagram?.nodes || []).map(n => [n.id, clean(n.label)]));
  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-200 bg-[#0e1626] p-4 sm:p-5">
      <div className="space-y-2" style={{ minWidth: 460 }}>
        {lanes.map((lane, li) => {
          const shade = tint(accent, 0.15 + 0.12 * li);
          return (
            <div key={li} className="flex items-stretch gap-3 rounded-xl p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
              {/* 존 라벨 */}
              <div className="flex w-[92px] flex-shrink-0 flex-col justify-center border-r border-white/10 pr-2">
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-wide" style={{ color: shade }}>ZONE {li}</span>
                <span className="mt-0.5 text-[10.5px] font-semibold leading-tight text-white/70">{clean(lane[0]?.zone) || DEVOPS_ZONE_HINT[li] || `계층 ${li}`}</span>
              </div>
              {/* 레인 내 노드 */}
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {lane.map((n, i) => {
                  const outs = (diagram?.edges || []).filter(e => e.from === n.id && idToLabel[e.to]);
                  return (
                    <div key={i} className="rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      <p className="flex items-center gap-1.5 font-mono text-[12px] font-bold text-white">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tint(accent, 0.5) }} />{clean(n.label)}
                      </p>
                      {clean(n.tech) && <p className="mt-0.5 font-mono text-[10px] text-white/45">{clean(n.tech)}</p>}
                      {outs.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {outs.slice(0, 3).map((e, ei) => (
                            <span key={ei} className="inline-flex items-center gap-1 font-mono text-[9.5px] text-white/50">
                              <GitBranch size={9} /> {idToLabel[e.to]}{clean(e.label) ? `·${clean(e.label)}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
