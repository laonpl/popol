import { splitProductDecisions } from './roleImpactReport.js';

const rows = value => Array.isArray(value) ? value.filter(Boolean) : [];
const string = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const firstRecord = (item, dimensions) => rows(item.records).find(row => dimensions.includes(row.dimension) && row.claim);

export function productDecisionGraph(item = {}) {
  const w = item.workProducts || {};
  const research = rows(w.research), problems = rows(w.problems), alternatives = rows(w.alternatives);
  const signals = research.length ? research : problems.filter(row => row.signal);
  const discovery = firstRecord(item, ['discovery']);
  const problem = problems[0] || discovery;
  const choices = splitProductDecisions(alternatives);
  const order = [...choices.selected, ...choices.excluded, ...choices.undecided];
  const count = Math.max(signals.length, order.length, 1);
  const height = Math.max(320, count * 128 + 88);
  const nodes = [], edges = [];
  const place = (id, kind, title, subtitle, source, x, y, fields = []) => nodes.push({ id, kind, title: string(title), subtitle: string(subtitle), source, x, y, fields });
  signals.forEach((row, i) => place(`signal-${i}`, 'signal', row.observation || row.signal, row.segment || row.user, row, 28, 52 + i * 128,
    [['관찰', row.observation || row.signal], ['인사이트', row.insight], ['제품 기회', row.opportunity], ['한계', row.limitation]]));
  if (!signals.length && discovery) place('signal-story', 'signal', discovery.claim, '기존 고객 발견 기록', discovery, 28, height / 2 - 48);
  if (problem) place('problem', 'problem', problem.problem || problem.claim, problem.context || problem.user || '정의한 고객 문제', problem, 318, height / 2 - 48,
    [['문제', problem.problem || problem.claim], ['사용자', problem.user], ['맥락', problem.context], ['사업적 이유', problem.businessReason]]);
  order.forEach((row, i) => place(`option-${i}`, choices.selected.includes(row) ? 'selected' : choices.excluded.includes(row) ? 'excluded' : 'pending', row.option, row.disposition || '판단 미기록', row, 608, 52 + i * 128,
    [['판단 기준', row.criterion], ['선택·제외 이유', row.reason], ['감수한 제약', row.tradeoff]]));
  if (!order.length) {
    const decision = firstRecord(item, ['prioritization']);
    if (decision) place('decision-story', 'pending', decision.claim, '기존 의사결정 기록', decision, 608, height / 2 - 48);
  }
  if (nodes.some(node => node.id === 'problem')) {
    nodes.filter(node => node.kind === 'signal').forEach(node => edges.push({ from: node.id, to: 'problem', label: '문제 정의' }));
    nodes.filter(node => ['selected', 'excluded', 'pending'].includes(node.kind)).forEach(node => edges.push({ from: 'problem', to: node.id, label: '대안 검토', dashed: node.kind !== 'selected' }));
  }
  return { width: 880, height, nodes, edges };
}

// Every edge represents the audience, purpose, or next touchpoint written on
// that channel record. No campaign KPI is silently attached to a channel.
export function campaignRouteGraph(item = {}) {
  const channels = rows(item.workProducts?.channels);
  const nodes = [], edges = [];
  channels.forEach((row, i) => {
    const y = 52 + i * 136;
    if (row.audience) nodes.push({ id: `audience-${i}`, kind: 'audience', title: string(row.audience), subtitle: '이 채널의 고객', source: row, x: 28, y });
    nodes.push({ id: `channel-${i}`, kind: 'channel', title: string(row.channel) || '채널 이름 미기록', subtitle: string(row.purpose), source: row, x: 318, y,
      fields: [['선택 이유', row.rationale], ['예산', row.budget], ['기간', row.period], ['다음 접점', row.handoff]] });
    if (row.handoff) nodes.push({ id: `handoff-${i}`, kind: 'handoff', title: string(row.handoff), subtitle: '의도한 다음 행동 · 접점', source: row, x: 608, y });
    if (row.audience) edges.push({ from: `audience-${i}`, to: `channel-${i}`, label: '도달' });
    if (row.handoff) edges.push({ from: `channel-${i}`, to: `handoff-${i}`, label: '다음 접점' });
  });
  if (!channels.length) {
    const candidates = [
      ['audience-story', 'audience', firstRecord(item, ['targeting']), 28],
      ['execution-story', 'execution', firstRecord(item, ['activation', 'creative']), 318],
      ['response-story', 'response', firstRecord(item, ['attribution', 'learning']), 608],
    ];
    candidates.forEach(([id, kind, source, x]) => {
      if (source) nodes.push({ id, kind, title: string(source.claim), subtitle: '기존 경험에 기록한 내용', source, x, y: 70 });
    });
  }
  return { width: 880, height: Math.max(260, channels.length * 136 + 64), nodes, edges };
}

export function funnelVolumes(stages = []) {
  if (stages.length < 2) return null;
  const metrics = stages.map(stage => stage.metrics?.length === 1 ? stage.metrics[0] : null);
  if (metrics.some(metric => !metric || !metric.period || !metric.population || !metric.channel || metric.kind !== 'outcome')) return null;
  const parsed = metrics.map(metric => string(metric.actual).match(/^(\d{1,3}(?:,\d{3})+|\d+)\s*(명|건|회)$/));
  if (parsed.some(value => !value)) return null;
  const reference = metrics[0];
  if (metrics.some((metric, i) => metric.period !== reference.period || metric.population !== reference.population || metric.channel !== reference.channel || parsed[i][2] !== parsed[0][2])) return null;
  const values = parsed.map(value => Number(value[1].replaceAll(',', '')));
  if (values[0] <= 0 || values.some((value, i) => i > 0 && value > values[i - 1])) return null;
  return values;
}

export function metricPercent(metric = {}) {
  if (['unlocated', 'derived'].includes(metric.basis)) return null;
  const match = string(metric.actual).match(/^(\d+(?:\.\d+)?)\s*%$/);
  return match && Number(match[1]) <= 100 ? Number(match[1]) : null;
}
