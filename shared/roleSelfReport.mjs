// A user's work-product entry is a self report, never a verified file excerpt.
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, 600) : '';
const list = value => Array.isArray(value) ? value : [];
const sourceName = '직접 작성한 경험';
const stageLabels = { planned: '계획', executed: '실행', observed: '관찰', changed: '판단 변경', unknown: '확인 필요' };

export function createRoleSelfReport(values = {}, fields = []) {
  const entries = fields.map(field => Array.isArray(field) ? field : [field, field])
    .filter(([key]) => typeof key === 'string' && key);
  const selfReportFields = Object.fromEntries(entries.map(([key]) => [key, text(values[key])]));
  const selfReportLabels = Object.fromEntries(entries.map(([key, label]) => [key, text(label) || key]));
  const quote = entries.filter(([key]) => selfReportFields[key]).map(([key]) => `${selfReportLabels[key]}: ${selfReportFields[key]}`).join('\n');
  return { basis: 'self_report', quote, source: sourceName, sourceName, sourceId: '', location: '', selfReportVersion: 1, selfReportFields, selfReportLabels };
}

export function validRoleSelfReport(row) {
  if (!row?.manuallyAdded || row.selfReportVersion !== 1 || row.basis !== 'self_report'
    || !row.selfReportFields || !row.selfReportLabels) return false;
  const fields = Object.keys(row.selfReportFields);
  if (!fields.length || !fields.every(key => text(row[key]) === row.selfReportFields[key])) return false;
  const expected = createRoleSelfReport(row, fields.map(key => [key, row.selfReportLabels[key]]));
  return !!expected.quote && row.quote === expected.quote && row.sourceName === sourceName;
}

// Reanalysis sees the exact same current direct input as the editor; AI-generated
// rows, deleted entries and stale snapshots never become new original material.
export function collectRoleSelfReports(sr = {}, role = sr.jobCategory) {
  const keys = role === 'pm' ? ['pmWorkProducts'] : role === 'marketer' ? ['marketerWorkProducts'] : ['pmWorkProducts', 'marketerWorkProducts'];
  const seen = new Set();
  return list(sr.keyExperiences).flatMap(experience => keys.flatMap(key => Object.values(experience?.jobData?.[key] || {}).flatMap(rows => list(rows)))).filter(validRoleSelfReport).flatMap(row => {
    const stage = Object.hasOwn(stageLabels, row.stage) ? row.stage : 'unknown';
    const identity = `${stage}\n${row.quote}`;
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [{ name: sourceName, text: `기록 단계(본인 선택): ${stageLabels[stage]}\n${row.quote}` }];
  });
}
