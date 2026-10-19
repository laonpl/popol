import { suggestPerformanceMapping, buildPerformanceSnapshot } from './rolePerformance.mjs';
export function planningSummary(document) {
  const fields = [['problem', /문제|배경|과제|problem/i], ['myRole', /내 역할|담당|기여|my role/i], ['action', /해결|의사결정|실행|선택|접근|action/i], ['result', /성과|결과|검증|impact|result/i], ['learning', /회고|배움|교훈|learning/i]];
  const result = {}; let active;
  for (const section of document.sections || []) {
    if (section.type === 'heading') active = fields.find(([, pattern]) => pattern.test(section.text))?.[0];
    else if (active) result[active] = [result[active], section.text].filter(Boolean).join('\n').slice(0, 280);
  }
  return result;
}
export function planningTableMetrics(document, role = 'pm') {
  return (document.tables || []).flatMap((cells, index) => {
    const headers = cells[0] || [];
    if (headers.some(header => !header) || new Set(headers).size !== headers.length || !headers.some(header => /^(실측|실제|값|성과|결과|결과값|관찰값|actual|value)$/i.test(header.trim()))) return [];
    const table = { headers, rows: cells.slice(1).map(cells => Object.fromEntries(headers.map((header, i) => [header, cells[i] || '']))) };
    const mapping = suggestPerformanceMapping(table, role);
    if (!mapping.name || !mapping.value) return [];
    try { return [{ index, snapshot: buildPerformanceSnapshot(table, mapping, { type: 'notion', name: document.title, url: document.url }) }]; } catch { return []; }
  });
}
