const text = value => String(value ?? '').trim();
const key = value => text(value).toLowerCase().replace(/[\s_()·-]/g, '');
export function parsePerformanceCsv(input) {
  if (typeof input !== 'string' || input.length > 2_000_000) throw new Error('CSV는 2MB 이하로 가져오세요.');
  const delimiter = input.split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'))?.includes('\t') ? '\t' : ',';
  const records = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (ch === delimiter || ch === '\n')) { row.push(cell.trim()); cell = ''; if (ch === '\n') { records.push(row); row = []; } }
    else if (ch !== '\r' || quoted) cell += ch;
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다. 파일을 확인하세요.');
  row.push(cell.trim()); records.push(row);
  const data = records.filter(row => row.some(Boolean) && !row[0].startsWith('#'));
  const headers = (data.shift() || []).map(header => header.replace(/^\uFEFF/, '').trim());
  if (headers.length < 2 || headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error('서로 다른 열 이름이 있는 CSV가 필요합니다.');
  if (!data.length || data.length > 5000) throw new Error('데이터가 있는 5,000행 이하의 CSV를 사용하세요.');
  if (data.some(row => row.length !== headers.length)) throw new Error('행마다 열 수가 다릅니다. 쉼표가 포함된 값은 따옴표로 감싸세요.');
  return { headers, rows: data.map(row => Object.fromEntries(headers.map((header, i) => [header, row[i]]))) };
}
export function performanceNumber(raw) {
  const value = text(raw).replace(/[,₩$€\s]/g, '').replace(/(?:%|원|명|건|회|초|분|시간|개|배)$/, '');
  return /^-?\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}
const aliases = {
  date: ['date', '날짜', '일자', 'day'], channel: ['channel', '채널', 'source', 'session source', '세션 소스', '매체'],
  name: ['metric', '지표', '지표명', 'name'], value: ['actual', 'value', '실측', '실제', '값', '성과', '결과', '결과값', '관찰값'],
  baseline: ['baseline', '기준', '이전', '기준값'], target: ['target', 'goal', '목표'], unit: ['unit', '단위'],
  impressions: ['impressions', '노출', '노출수'], clicks: ['clicks', '클릭', '클릭수'],
  spend: ['spend', 'cost', 'amount spent', '비용', '광고비', '지출금액'],
  conversions: ['conversions', 'key events', '전환', '전환수', '주요이벤트'], revenue: ['revenue', 'purchase revenue', '매출', '매출액', '구매수익'],
};
export function suggestPerformanceMapping(table, role = 'pm') {
  const found = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, table.headers.find(header => names.some(name => key(name) === key(header))) || '']));
  return { ...found, mode: role === 'marketer' && !found.value && (found.clicks || found.impressions || found.spend) ? 'campaign' : 'metric',
    value: found.value || table.headers.find(header => ![found.date, found.channel, found.name, found.unit, found.baseline, found.target].includes(header) && table.rows.some(row => performanceNumber(row[header]) !== null)) || '',
    metricName: '', aggregation: 'latest', currency: '원', direction: 'up' };
}
const format = (value, unit = '') => `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value)}${unit}`;
const numeric = (rows, field) => field && rows.every(row => performanceNumber(row[field]) !== null && performanceNumber(row[field]) >= 0) ? rows.reduce((sum, row) => sum + performanceNumber(row[field]), 0) : null;
export function buildPerformanceSnapshot(table, mapping, source = {}) {
  const rows = table.rows.filter(row => !mapping.channel || !/^(총계|합계|total|grand total)$/i.test(text(row[mapping.channel])));
  const dates = [...new Set(rows.map(row => text(row[mapping.date])).filter(Boolean))].sort();
  const period = dates.length ? `${dates[0]} ~ ${dates.at(-1)}` : text(source.period) || '기간 미지정';
  const metrics = [], channels = [];
  if (mapping.mode === 'campaign') {
    const summarize = group => Object.fromEntries(['impressions', 'clicks', 'spend', 'conversions', 'revenue'].map(field => [field, numeric(group, mapping[field])]));
    const totals = summarize(rows);
    const add = (name, value, unit, stage, method) => { if (value !== null) metrics.push({ id: name, name, actual: format(value, unit), value, unit, stage, kind: 'outcome', period, method, direction: ['CPA', '광고비'].includes(name) ? 'down' : 'up' }); };
    add('노출', totals.impressions, '회', 'reach', '노출 합계'); add('클릭', totals.clicks, '회', 'click', '클릭 합계');
    add('광고비', totals.spend, mapping.currency || '원', 'cost', '광고비 합계'); add('전환', totals.conversions, '건', 'conversion', '전환 합계'); add('매출', totals.revenue, mapping.currency || '원', 'conversion', '매출 합계');
    if (totals.impressions > 0 && totals.clicks !== null) add('CTR', totals.clicks / totals.impressions * 100, '%', 'click', '클릭 ÷ 노출 × 100');
    if (totals.clicks > 0 && totals.conversions !== null) add('CVR', totals.conversions / totals.clicks * 100, '%', 'conversion', '전환 ÷ 클릭 × 100');
    if (totals.conversions > 0 && totals.spend !== null) add('CPA', totals.spend / totals.conversions, mapping.currency || '원', 'cost', '광고비 ÷ 전환');
    if (totals.spend > 0 && totals.revenue !== null) add('ROAS', totals.revenue / totals.spend * 100, '%', 'cost', '매출 ÷ 광고비 × 100');
    if (mapping.channel) for (const name of [...new Set(rows.map(row => row[mapping.channel]).filter(Boolean))]) channels.push({ name, ...summarize(rows.filter(row => row[mapping.channel] === name)) });
    for (const metric of metrics) {
      const field = { 노출: 'impressions', 클릭: 'clicks', 광고비: 'spend', 전환: 'conversions', 매출: 'revenue' }[metric.name];
      metric.series = field && mapping.date ? dates.map(date => ({ date, value: summarize(rows.filter(row => row[mapping.date] === date))[field] })).filter(point => point.value !== null) : [];
    }
  } else {
    if (!mapping.value || !table.headers.includes(mapping.value)) throw new Error('실측 값에 해당하는 열을 선택하세요.');
    const groups = [...new Set(rows.map(row => mapping.name ? text(row[mapping.name]) : text(mapping.metricName) || mapping.value))];
    for (const name of groups.filter(Boolean)) {
      const group = rows.filter(row => (mapping.name ? text(row[mapping.name]) : text(mapping.metricName) || mapping.value) === name);
      const parsed = group.map(row => ({ row, value: performanceNumber(row[mapping.value]) })).filter(row => row.value !== null);
      if (!parsed.length) continue;
      const sorted = mapping.date ? [...parsed].sort((a, b) => text(a.row[mapping.date]).localeCompare(text(b.row[mapping.date]))) : parsed;
      const last = sorted.at(-1), first = sorted[0];
      const unit = text(last.row[mapping.unit]) || text(mapping.unitLiteral) || (text(last.row[mapping.value]).endsWith('%') ? '%' : '');
      if (parsed.some(entry => text(entry.row[mapping.unit]) && text(entry.row[mapping.unit]) !== unit)) throw new Error(`${name}에 서로 다른 단위가 있습니다. 단위를 분리해 가져오세요.`);
      const value = mapping.aggregation === 'sum' ? parsed.reduce((sum, entry) => sum + entry.value, 0) : mapping.aggregation === 'average' ? parsed.reduce((sum, entry) => sum + entry.value, 0) / parsed.length : last.value;
      const baseline = performanceNumber(last.row[mapping.baseline]);
      const target = performanceNumber(last.row[mapping.target]);
      metrics.push({ id: name, name, value, actual: format(value, unit), unit, baseline: baseline !== null ? format(baseline, unit) : mapping.aggregation === 'latest' && sorted.length > 1 ? format(first.value, unit) : '', target: target !== null ? format(target, unit) : '',
        period, direction: mapping.direction || 'up', kind: 'outcome', stage: 'conversion', method: { latest: '마지막 관찰값', sum: '선택 열의 합계', average: '선택 열의 단순 평균' }[mapping.aggregation] || '마지막 관찰값',
        series: mapping.date ? sorted.map(entry => ({ date: text(entry.row[mapping.date]), value: entry.value })).filter(point => point.date) : [] });
    }
  }
  if (!metrics.length) throw new Error('선택한 열에서 수치를 찾지 못했습니다. 열 연결을 확인하세요.');
  return { version: 1, source: { type: source.type || 'csv', name: text(source.name) || '성과 CSV', url: text(source.url), updatedAt: new Date().toISOString() }, mapping, period, rowCount: rows.length,
    metrics: metrics.slice(0, 24).map(metric => ({ ...metric, series: metric.series.slice(-60) })), channels: channels.slice(0, 30) };
}
export function performanceExport(data) {
  if (!data?.metrics?.length) return [];
  return ['연결한 성과 데이터: ' + text(data.source?.name), '데이터 갱신: ' + text(data.source?.updatedAt), '집계 기간: ' + text(data.period), ...data.metrics.map(metric => [metric.name + ': ' + metric.actual, metric.baseline && '기준 ' + metric.baseline, metric.target && '목표 ' + metric.target, '집계/계산: ' + metric.method].filter(Boolean).join(' · ')), ...data.channels.map(row => `채널: ${row.name} · ${['impressions', 'clicks', 'spend', 'conversions', 'revenue'].filter(field => row[field] !== null).map(field => `${field} ${row[field]}`).join(' / ')}`)].join('\n');
}
export function figmaEmbedUrl(input) {
  try { const url = new URL(input); if (url.protocol !== 'https:' || !['www.figma.com', 'figma.com', 'embed.figma.com'].includes(url.hostname) || url.username || url.password || url.port) return '';
    if (!/^\/(design|file|proto|board|slides)\/[a-zA-Z0-9]+(?:\/|$)/.test(url.pathname)) return '';
    url.hostname = 'embed.figma.com'; url.pathname = url.pathname.replace(/^\/file\//, '/design/');
    const allowed = new URLSearchParams(); for (const field of ['node-id', 'page-id', 'starting-point-node-id', 'scaling']) if (url.searchParams.has(field)) allowed.set(field, url.searchParams.get(field));
    allowed.set('embed-host', 'fitpoly'); url.search = allowed.toString(); url.hash = ''; return url.href;
  } catch { return ''; }
}
