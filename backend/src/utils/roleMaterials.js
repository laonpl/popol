const list = value => Array.isArray(value) ? value : [];
export function roleAnalysisContent(data) {
  const content = typeof data.content === 'string' ? { rawInput: data.content } : { ...(data.content || {}) };
  if (!['pm', 'marketer'].includes(data.jobCategory || data.structuredResult?.jobCategory)) return content;
  const sr = data.structuredResult || {}, assets = [...list(sr.deliverables), ...list(sr.pmFiles)];
  const additions = list(sr.additionalMaterials).filter(row => row && typeof row.text === 'string' && assets.some(asset => asset.id === row.assetId));
  if (additions.length) content['추가 산출물 원문'] = additions.map(row => `--- ${String(row.name || '추가 자료').replace(/[\r\n]/g, ' ')} ---\n${row.text}`).join('\n\n');
  return content;
}
export function preserveRolePresentation(analysis, previous = {}) {
  if (!['pm', 'marketer'].includes(analysis.jobCategory || previous.jobCategory)) return analysis;
  const old = list(previous.keyExperiences).filter(Boolean);
  const archive = [...list(previous.artifactBindingArchive)];
  const manualEnabled = (analysis.jobCategory || previous.jobCategory) === 'marketer';
  const manualArchive = manualEnabled ? [...list(previous.manualWorkProductArchive)] : [];
  const matched = new Set();
  const workKey = 'marketerWorkProducts';
  const keyExperiences = list(analysis.keyExperiences).map(item => {
    if (!item) return item;
    const matches = old.filter(row => item.id ? row.id === item.id : item.title && row.title === item.title);
    const titleMatches = matches.length ? matches : old.filter(row => item.title && row.title === item.title);
    const match = titleMatches.length === 1 ? titleMatches[0] : null;
    if (!match) return item;
    matched.add(match);
    const manualGroups = manualEnabled ? Object.entries(match.jobData?.[workKey] || {}).map(([key, rows]) => [key, list(rows).filter(row => row?.manuallyAdded)]).filter(([, rows]) => rows.length) : [];
    const work = { ...(item.jobData?.[workKey] || {}) };
    for (const [key, rows] of manualGroups) work[key] = [...rows, ...list(work[key]).filter(row => !rows.some(manual => manual.manualId && manual.manualId === row?.manualId))];
    return { ...item, ...(match.artifactBindings ? { artifactBindings: match.artifactBindings } : {}), ...(manualGroups.length ? { jobData: { ...item.jobData, [workKey]: work } } : {}) };
  });
  for (const item of old) {
    if (manualEnabled && !matched.has(item)) {
      const workProducts = Object.fromEntries(Object.entries(item.jobData?.[workKey] || {}).map(([key, rows]) => [key, list(rows).filter(row => row?.manuallyAdded)]).filter(([, rows]) => rows.length));
      if (Object.keys(workProducts).length) manualArchive.push({ caseId: item.id || '', title: item.title || '', workProducts });
    }
    if (list(item.artifactBindings).length && !keyExperiences.some(row => row?.artifactBindings === item.artifactBindings)) archive.push({ caseId: item.id || '', title: item.title || '', bindings: item.artifactBindings });
  }
  return { ...analysis, keyExperiences, additionalMaterials: list(previous.additionalMaterials), artifactBindingArchive: archive, ...(manualEnabled && manualArchive.length ? { manualWorkProductArchive: manualArchive } : {}) };
}
