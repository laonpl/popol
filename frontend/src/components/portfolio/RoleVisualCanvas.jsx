import { useId, useState } from 'react';
import { ArrowRight, Check, Circle, Flag, Layers, MapPin, MousePointer2, Network, ScanEye, Target, User, Workflow, X } from 'lucide-react';
import { productDecisionGraph, campaignRouteGraph, funnelVolumes, metricPercent } from '../../utils/roleVisualModels';
import { productServiceLayers, campaignMetricStages, metricComparison, splitProductDecisions } from '../../utils/roleImpactReport';
import { PM_STAGE_LABELS } from '../../utils/pmEvidence';
import { Source as MarketingSource } from './MarketerWorkProductBlocks';
import './RoleVisualCanvas.css';

const icons = { signal: ScanEye, problem: Target, selected: Check, excluded: X, pending: Flag, audience: User, channel: MousePointer2, handoff: MapPin, execution: Workflow, response: ScanEye };
const labels = { signal: '고객 신호', problem: '문제 정의', selected: 'MVP 채택', excluded: '보류 · 제외', pending: '의사결정', audience: '타깃 고객', channel: '운영 채널', handoff: '다음 접점', execution: '실행 기록', response: '관찰 · 학습' };

function GraphCanvas({ graph, role, Source, title, columnLabels }) {
  const [active, setActive] = useState(null);
  const id = useId().replaceAll(':', '');
  const selected = graph.nodes.find(node => node.id === active);
  if (!graph.nodes.length) return <div className="vc-empty"><Network size={37} /><b>{title}</b><p>{role === 'pm' ? '고객 관찰과 실제 비교한 대안을 추가하면 연결된 제품 판단 지도가 나타납니다.' : '채널의 타깃과 다음 접점을 기록하면 캠페인 경로가 연결됩니다.'}</p></div>;
  const point = nodeId => graph.nodes.find(node => node.id === nodeId);
  return <div className={`vc-graph vc-${role}`}>
    <div className="vc-scroll" role="region" aria-label={title} tabIndex={0}>
      <div className="vc-surface" style={{ height: graph.height }}>
        <div className="vc-columns">{columnLabels.map(label => <span key={label}>{label}</span>)}</div>
        <svg viewBox={`0 0 ${graph.width} ${graph.height}`} preserveAspectRatio="none" aria-hidden="true" className="vc-edges"><defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="currentColor" strokeWidth="1.2" /></marker></defs>{graph.edges.map((edge, index) => {
          const from = point(edge.from), to = point(edge.to); if (!from || !to) return null;
          const x = from.x + 224, y = from.y + 47, endX = to.x - 8, endY = to.y + 47;
          return <g key={index} data-active={active === from.id || active === to.id}><path d={`M${x} ${y} C${x + 34} ${y},${endX - 34} ${endY},${endX} ${endY}`} strokeDasharray={edge.dashed ? '4 5' : undefined} markerEnd={`url(#${id}-arrow)`} /><text x={(x + endX) / 2} y={(y + endY) / 2 - 11} textAnchor="middle">{edge.label}</text></g>;
        })}</svg>
        {graph.nodes.map(node => { const Icon = icons[node.kind] || Circle; return <button type="button" key={node.id} className="vc-node" data-kind={node.kind} aria-pressed={selected?.id === node.id} style={{ left: `${node.x / graph.width * 100}%`, width: `${224 / graph.width * 100}%`, top: node.y }} onClick={() => setActive(current => current === node.id ? null : node.id)}><span><Icon size={14} />{labels[node.kind]}</span><b>{node.title}</b>{node.subtitle && <small>{node.subtitle}</small>}</button>; })}
      </div>
    </div>
    <div className="vc-legend"><span><i />{graph.edges.length ? '기록된 흐름' : '기록된 작업'}</span>{role === 'pm' && <span><i className="is-dashed" />보류 · 미결정</span>}<small>노드를 선택하면 판단과 원문을 확인할 수 있습니다.</small></div>
    {selected && <div className="vc-inspector" role="region" aria-label="선택한 작업의 상세 기록"><header><small>{labels[selected.kind]}</small><h4>{selected.title}</h4></header><dl>{(selected.fields || []).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{Source ? <Source record={selected.source} /> : <MarketingSource row={selected.source} />}</div>}
    <div className="vc-print-evidence">{graph.nodes.map(node => <article key={node.id}><b>{labels[node.kind]} · {node.title}</b><dl>{(node.fields || []).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{Source ? <Source record={node.source} /> : <MarketingSource row={node.source} />}</article>)}</div>
  </div>;
}

export function ProductDecisionCanvas({ item, Source }) { return <GraphCanvas graph={productDecisionGraph(item)} Source={Source} role="pm" title="고객 문제와 MVP 의사결정 지도" columnLabels={['OBSERVE · 고객 관찰', 'DEFINE · 문제 정의', 'DECIDE · 선택과 포기']} />; }
export function CampaignRouteCanvas({ item }) { return <GraphCanvas graph={campaignRouteGraph(item)} role="marketing" title="타깃에서 채널과 다음 접점까지" columnLabels={['AUDIENCE · 타깃', 'CHANNEL · 접점', 'ACTION · 다음 행동']} />; }

export function MvpScopeCanvas({ rows, Source }) {
  const scope = splitProductDecisions(rows);
  return <div className="vc-mvp"><div className="vc-mvp-column" data-scope="included"><header><Check size={15} /><b>이번 MVP에 포함</b><span>{scope.selected.length}</span></header>{scope.selected.map((row, i) => <article key={i}><h4>{row.option}</h4><p>{row.criterion || row.reason}</p><Source record={row} /></article>)}</div><div className="vc-mvp-center"><div><Target size={25} /><b>MVP</b><small>선택한 제품 범위</small></div><i className="vc-mvp-ring" /><span>{scope.selected.length}개의 채택 기록</span></div><div className="vc-mvp-column" data-scope="excluded"><header><X size={15} /><b>제외 · 보류</b><span>{scope.excluded.length}</span></header>{scope.excluded.map((row, i) => <article key={i}><h4>{row.option}</h4><p>{row.reason || row.tradeoff || row.criterion}</p><Source record={row} /></article>)}</div>{scope.undecided.length > 0 && <div className="vc-mvp-pending">{scope.undecided.map((row, i) => <span key={i}><Flag size={11} />{row.option} · 판단 미기록</span>)}</div>}</div>;
}

export function PolicyCanvas({ rows, Source }) {
  return <div className="vc-policy">{rows.map((row, i) => <article key={i}><header><code>POLICY {String(i + 1).padStart(2, '0')}</code><h4>{row.requirement}</h4>{row.owner && <small>내 책임 · {row.owner}</small>}</header><div><section><Workflow size={20} /><small>RULE · 처리 정책</small><p>{row.rule || '처리 정책 미기록'}</p></section><ArrowRight size={22} /><section><Check size={20} /><small>ACCEPTANCE · 인수 기준</small><p>{row.acceptance || '인수 기준 미기록'}</p></section></div><Source record={row} /></article>)}</div>;
}

export function ServiceDesignCanvas({ workProducts, Source }) {
  const service = productServiceLayers(workProducts);
  const [active, setActive] = useState(0);
  const id = useId().replaceAll(':', '');
  const rows = service.steps, width = Math.max(620, rows.length * 218 + 30);
  if (!rows.length) return <div className="vc-empty"><Workflow size={37} /><b>서비스 동작을 설계한 기록</b><p>실제 사용자 흐름과 화면·운영·시스템·예외 처리 단계를 연결하세요.</p></div>;
  const selected = Math.min(active, rows.length - 1);
  return <div className="vc-service">
    <div className="vc-scroll" role="region" aria-label="서비스 동작 다이어그램" tabIndex={0}>
      <div className="vc-service-path" style={{ width }}><svg viewBox={`0 0 ${width} 135`} aria-hidden="true"><defs><marker id={`${id}-service-arrow`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0 L5 3 L0 6" fill="none" stroke="#90a8d1" /></marker></defs>{rows.slice(1).map((_, i) => <path key={i} d={`M${i * 218 + 197} 70 L${i * 218 + 228} 70`} stroke="#9aafd0" markerEnd={`url(#${id}-service-arrow)`} />)}</svg>
        {rows.map((row, i) => <button type="button" key={i} aria-pressed={selected === i} onClick={() => setActive(i)} style={{ left: i * 218 + 20 }}><span>{String(i + 1).padStart(2, '0')}</span><Workflow size={19} /><b>{row.step || `단계 ${i + 1}`}</b><small>{row.customerAction || row.after || row.actor || '작업 상세 확인'}</small></button>)}
      </div>
    </div>
    <div className="vc-service-layers">{rows.map((row, i) => <section key={i} className={selected === i ? '' : 'vc-service-hidden'}><header><Layers size={16} /><h4>{row.step}</h4><span>{PM_STAGE_LABELS[row.stage]}</span></header><div>{service.layers.filter(([field]) => row[field]).map(([field, label], index) => <article key={field} data-layer={field}><small>{String(index + 1).padStart(2, '0')} / {label}</small><p>{row[field]}</p></article>)}</div><Source record={row} /></section>)}</div>
  </div>;
}

export function ReleaseTimeline({ rows, Source }) {
  if (!rows.length) return null;
  return <div className="vc-release-timeline">{rows.map((row, i) => <article key={i} data-stage={row.stage}><div className="vc-milestone"><span>{i + 1}</span>{i < rows.length - 1 && <i />}</div><small>{row.status || PM_STAGE_LABELS[row.stage]}</small><h4>{row.milestone}</h4><p>{row.scope}</p><dl>{[['dependency', '의존성'], ['gate', '출시 조건']].filter(([key]) => row[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{row[key]}</dd></div>)}</dl><Source record={row} /></article>)}</div>;
}

export function MetricGraphic({ metric }) {
  const percentage = metricPercent(metric), comparison = metricComparison(metric);
  const id = useId().replaceAll(':', '');
  if (percentage !== null) return <div className="vc-metric-graphic"><svg viewBox="0 0 190 170" role="img" aria-label={`${metric.name} 실제 ${metric.actual}`}><circle cx="95" cy="80" r="58" className="vc-ring-track" /><circle cx="95" cy="80" r="58" className="vc-ring-value" pathLength="100" strokeDasharray={`${percentage} ${100 - percentage}`} transform="rotate(-90 95 80)" /><text x="95" y="82" textAnchor="middle" className="vc-ring-number">{metric.actual}</text><text x="95" y="103" textAnchor="middle" className="vc-ring-label">실제 관찰</text></svg><dl>{[['baseline', '기준'], ['target', '목표']].filter(([key]) => metric[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{metric[key]}</dd></div>)}</dl></div>;
  if (!comparison) return <div className="vc-metric-text"><b>{metric.actual || '실측 미기록'}</b><small>{metric.target ? `목표 ${metric.target}` : '목표 미기록'}</small></div>;
  return <svg viewBox={`0 0 360 ${comparison.points.length * 44 + 16}`} className="vc-bullet-chart" role="img" aria-label={`${metric.name}: ${comparison.points.map(point => `${point.label} ${point.raw}`).join(', ')}`}><defs><pattern id={`${id}-target-hatch`} width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 L7 0" stroke="#aac0b7" /></pattern></defs>{comparison.points.map((point, i) => <g key={point.key}><text x="0" y={i * 44 + 27}>{point.label}</text><rect x="44" y={i * 44 + 13} width="228" height="17" rx="4" className="vc-chart-track" /><rect x="44" y={i * 44 + 13} width={point.width * 2.28} height="17" rx="4" data-kind={point.key} fill={point.key === 'target' ? `url(#${id}-target-hatch)` : undefined} /><text x="285" y={i * 44 + 27} className="vc-chart-number">{point.raw}</text></g>)}</svg>;
}

export function CampaignFunnelGraphic({ item }) {
  const stages = campaignMetricStages(item.metrics), values = funnelVolumes(stages);
  const gradientId = `${useId().replaceAll(':', '')}-funnel`;
  if (!stages.length) return <div className="vc-empty"><Target size={37} /><b>고객 반응과 전환 퍼널</b><p>노출·유입·전환·재구매 중 실제로 확인한 단계의 지표를 연결하세요.</p></div>;
  const height = stages.length * 100 + 20;
  return <div className="vc-funnel"><svg viewBox={`0 0 700 ${height}`} role="img" aria-label="기록된 퍼널 단계별 실측"><defs><linearGradient id={gradientId} x1="0" x2="1"><stop stopColor="#d9efd6" /><stop offset="1" stopColor="#b3d2af" /></linearGradient></defs>{stages.map((stage, i) => {
    const top = values ? values[i] / values[0] * 400 : 400;
    const bottom = values && values[i + 1] !== undefined ? values[i + 1] / values[0] * 400 : top;
    const y = i * 100 + 12;
    const name = stage.metrics.map(row => row.name).join(' · ');
    return <g key={stage.key}><title>{stage.label} · {name} · {stage.metrics.map(row => row.actual).join(' / ')}</title><text x="10" y={y + 20} className="vc-funnel-step">{String(i + 1).padStart(2, '0')}</text><text x="10" y={y + 44} className="vc-funnel-label">{stage.label}</text><path d={`M${340 - top / 2} ${y} L${340 + top / 2} ${y} L${340 + bottom / 2} ${y + 74} L${340 - bottom / 2} ${y + 74} Z`} fill={`url(#${gradientId})`} opacity={1 - i * .06} /><text x="340" y={y + 42} textAnchor="middle" className="vc-funnel-value">{stage.metrics.map(row => row.actual).join(' / ')}</text><text x="565" y={y + 28} className="vc-funnel-metric">{name.length > 13 ? `${name.slice(0, 12)}…` : name}</text><text x="565" y={y + 50} className="vc-funnel-period">{[stage.metrics[0].channel, stage.metrics[0].period].filter(Boolean).join(' · ')}</text>{i < stages.length - 1 && <path d={`M340 ${y + 82} l0 10 m-4 -4 l4 4 l4 -4`} stroke="#8aa78b" fill="none" />}</g>;
  })}</svg><p>{values ? '동일 채널·기간·대상의 실측 수량에 비례한 흐름' : '각 단계에서 기록한 지표 · 구간 간 전환율은 별도 측정'}</p></div>;
}

export function ExperimentStoryboard({ rows, role = 'pm', Source }) {
  return <div className={`vc-experiments vc-${role}`}>{rows.map((row, i) => <article key={i}><header><span>EXPERIMENT {String(i + 1).padStart(2, '0')}</span><h4>{row.hypothesis}</h4></header><div className="vc-test-flow"><section><small>DESIGN · 검증 설계</small><b>{row.variable || row.method || '검증 방법 미기록'}</b><p>{row.control || row.successCriteria}</p></section><ArrowRight size={24} /><section><small>OBSERVE · 실제 관찰</small><b>{row.observation || '관찰 결과 미기록'}</b><p>{row.test || row.method}</p></section><ArrowRight size={24} /><section><small>DECIDE · 다음 선택</small><b>{row.decision || '후속 결정 미기록'}</b><p>{row.limitation}</p></section></div>{Source ? <Source record={row} /> : <MarketingSource row={row} />}</article>)}</div>;
}

export function ImprovementTrail({ rows, Source }) {
  return <div className="vc-improvement">{rows.map((row, i) => <article key={i}><header><span>ITERATION {String(i + 1).padStart(2, '0')}</span><h4>{row.issue || row.signal}</h4></header><ol>{[[row.cause || row.diagnosis, '발견한 원인'], [row.change, '바꾼 선택'], [row.result || row.observation, '확인한 반응'], [row.learning || row.next, '다음 판단']].filter(([value]) => value).map(([value, label], index) => <li key={label}><span>{index + 1}</span><small>{label}</small><p>{value}</p></li>)}</ol>{Source ? <Source record={row} /> : <MarketingSource row={row} />}</article>)}</div>;
}
