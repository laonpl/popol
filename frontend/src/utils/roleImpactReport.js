const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

export function splitProductDecisions(rows = []) {
  return list(rows).reduce((result, row) => {
    const state = text(row.disposition);
    const key = /^(채택|선택|포함|진행|adopted|selected)$/i.test(state) ? 'selected'
      : /^(기각|제외|보류|포기|중단|rejected|deferred)$/i.test(state) ? 'excluded' : 'undecided';
    result[key].push(row);
    return result;
  }, { selected: [], excluded: [], undecided: [] });
}

export function productServiceLayers(work = {}) {
  const blueprint = list(work.serviceBlueprint);
  if (blueprint.length) return { kind: 'blueprint', steps: blueprint, layers: [
    ['customerAction', '사용자 행동'], ['frontstage', '화면 · 접점'],
    ['backstage', '운영 · 협업'], ['system', '시스템 동작'], ['exception', '예외 · 복구'],
  ] };
  return { kind: 'journey', steps: list(work.journey), layers: [
    ['actor', '사용자'], ['before', '변경 전'], ['after', '설계 · 변경 후'], ['exception', '예외 · 복구'],
  ] };
}

// Comparison bars share a scale only when the recorded units agree. Neither
// missing values nor quantities such as "목표 10~20" become measured points.
export function metricComparison(metric = {}) {
  const parse = raw => {
    const match = text(raw).match(/^(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(%|원|명|건|회|개|일|시간|분|초|배)?$/);
    return match ? { value: Number(match[1].replaceAll(',', '')), unit: match[2] || text(metric.unit) } : null;
  };
  if (!metric.actual || ['unlocated', 'derived'].includes(metric.basis)) return null;
  const points = [['baseline', '기준'], ['actual', '관찰'], ['target', '목표']]
    .map(([key, label]) => ({ key, label, raw: text(metric[key]), parsed: parse(metric[key]) }));
  const actual = points.find(point => point.key === 'actual').parsed;
  if (!actual || actual.value < 0) return null;
  const present = points.filter(point => point.raw);
  if (present.some(point => !point.parsed || point.parsed.value < 0 || point.parsed.unit !== actual.unit)) return null;
  const maximum = Math.max(...present.map(point => point.parsed.value), 1);
  return { unit: actual.unit, points: present.map(point => ({ ...point, value: point.parsed.value, width: point.parsed.value / maximum * 100 })) };
}

export function campaignMetricStages(metrics = []) {
  const labels = { reach: '도달 · 인지도', click: '클릭 · 유입', conversion: '전환', retention: '관계 · 재구매', cost: '비용 효율', qualitative: '고객 반응' };
  return Object.entries(labels).map(([key, label]) => ({ key, label,
    metrics: list(metrics).filter(row => row.stage === key && row.kind !== 'output' && !['unlocated', 'derived'].includes(row.basis) && text(row.actual)),
  })).filter(stage => stage.metrics.length);
}

export function marketingChannelLedger(item = {}) {
  const channels = list(item.workProducts?.channels);
  const metrics = list(item.metrics);
  return channels.map(channel => ({ ...channel,
    // Exact channel names only; a campaign total never becomes a channel result.
    metrics: metrics.filter(metric => text(metric.channel) && text(metric.channel).normalize('NFKC') === text(channel.channel).normalize('NFKC')),
  }));
}

export function roleReportCounts(item = {}, role = 'pm') {
  const w = item.workProducts || {};
  if (role === 'pm') return [
    { label: '고객 관찰', value: list(w.problems).length + list(w.research).length },
    { label: '비교한 대안', value: list(w.alternatives).length },
    { label: '설계한 정책', value: list(w.requirements).length },
    { label: '검증 기록', value: list(w.experiments).length },
  ];
  return [
    { label: '소재 버전', value: list(w.creatives).length },
    { label: '운영 채널', value: new Set(list(w.channels).map(row => text(row.channel)).filter(Boolean)).size },
    { label: '실험 · 개선', value: list(w.experiments).length + list(w.optimization).length },
    { label: '관찰 지표', value: list(item.metrics).filter(row => row.actual && !['unlocated', 'derived'].includes(row.basis)).length },
  ];
}
