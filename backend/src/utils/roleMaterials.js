import { collectRoleSelfReports } from '../../../shared/roleSelfReport.mjs';
import { planningDocumentText } from '../../../shared/sourceExperience.mjs';
const list = value => Array.isArray(value) ? value : [];
export function roleAnalysisContent(data) {
  const content = typeof data.content === 'string' ? { rawInput: data.content } : { ...(data.content || {}) };
  if (!['pm', 'marketer'].includes(data.jobCategory || data.structuredResult?.jobCategory)) return content;
  // These derived source blocks are rebuilt from retained assets/current entries.
  delete content['추가 산출물 원문'];
  delete content['직접 작성한 산출물'];
  delete content['연결 기획 자료 원문'];
  const sr = data.structuredResult || {}, assets = [...list(sr.deliverables), ...list(sr.pmFiles)];
  const additions = list(sr.additionalMaterials).filter(row => row && typeof row.text === 'string' && assets.some(asset => asset.id === row.assetId));
  if (additions.length) content['추가 산출물 원문'] = additions.map(row => `--- ${String(row.name || '추가 자료').replace(/[\r\n]/g, ' ')} ---\n${row.text}`).join('\n\n');
  const selfReports = collectRoleSelfReports(sr, data.jobCategory || sr.jobCategory);
  const connected = list(sr.keyExperiences).flatMap(experience => [experience?.planningConnection, experience?.figmaConnection, ...list(experience?.sourceDocuments)]).filter(document => document && planningDocumentText(document).trim());
  if (connected.length) content['연결 기획 자료 원문'] = connected.map(document => `--- ${String(document.title || '연결 자료').replace(/[\r\n]/g, ' ')} ---\n${planningDocumentText(document)}`).join('\n\n').slice(0, 70000);
  if (selfReports.length) content['직접 작성한 산출물'] = selfReports.map(row => `--- ${row.name} ---\n${row.text}`).join('\n\n');
  return content;
}
export function preserveRolePresentation(analysis, previous = {}) {
  if (!['pm', 'marketer'].includes(analysis.jobCategory || previous.jobCategory)) return analysis;
  const old = list(previous.keyExperiences).filter(Boolean);
  const archive = [...list(previous.artifactBindingArchive)];
  const role = analysis.jobCategory || previous.jobCategory;
  const manualArchive = [...list(previous.manualWorkProductArchive)];
  const summaryArchive = [...list(previous.roleSummaryArchive)];
  const matched = new Set();
  const workKey = role === 'pm' ? 'pmWorkProducts' : 'marketerWorkProducts';
  const keyExperiences = list(analysis.keyExperiences).map(item => {
    if (!item) return item;
    const matches = old.filter(row => item.id ? row.id === item.id : item.title && row.title === item.title);
    const titleMatches = matches.length ? matches : old.filter(row => item.title && row.title === item.title);
    const match = titleMatches.length === 1 ? titleMatches[0] : null;
    if (!match) return item;
    matched.add(match);
    const manualGroups = Object.entries(match.jobData?.[workKey] || {}).map(([key, rows]) => [key, list(rows).filter(row => row?.manuallyAdded)]).filter(([, rows]) => rows.length);
    const work = { ...(item.jobData?.[workKey] || {}) };
    for (const [key, rows] of manualGroups) work[key] = [...rows, ...list(work[key]).filter(row => !rows.some(manual => manual.manualId && manual.manualId === row?.manualId))];
    return { ...item, ...(match.artifactBindings ? { artifactBindings: match.artifactBindings } : {}), ...(match.roleSummary ? { roleSummary: match.roleSummary } : {}), ...(match.planningConnection ? { planningConnection: match.planningConnection } : {}), ...(match.figmaConnection ? { figmaConnection: match.figmaConnection } : {}), ...(match.sourceDocuments ? { sourceDocuments: match.sourceDocuments } : {}), ...(match.performanceData !== undefined ? { performanceData: match.performanceData } : {}), ...(manualGroups.length ? { jobData: { ...item.jobData, [workKey]: work } } : {}) };
  });
  for (const item of old) {
    if (!matched.has(item)) {
      if (item.roleSummary || item.performanceData || item.planningConnection || item.figmaConnection || item.sourceDocuments) summaryArchive.push({ caseId: item.id || '', title: item.title || '', ...(item.roleSummary ? { roleSummary: item.roleSummary } : {}), ...(item.performanceData ? { performanceData: item.performanceData } : {}), ...(item.planningConnection ? { planningConnection: item.planningConnection } : {}), ...(item.figmaConnection ? { figmaConnection: item.figmaConnection } : {}), ...(item.sourceDocuments ? { sourceDocuments: item.sourceDocuments } : {}) });
      const workProducts = Object.fromEntries(Object.entries(item.jobData?.[workKey] || {}).map(([key, rows]) => [key, list(rows).filter(row => row?.manuallyAdded)]).filter(([, rows]) => rows.length));
      if (Object.keys(workProducts).length) manualArchive.push({ caseId: item.id || '', title: item.title || '', workProducts });
    }
    if (list(item.artifactBindings).length && !keyExperiences.some(row => row?.artifactBindings === item.artifactBindings)) archive.push({ caseId: item.id || '', title: item.title || '', bindings: item.artifactBindings });
  }
  return { ...analysis, keyExperiences,
    deliverables: list(previous.deliverables ?? analysis.deliverables), pmFiles: list(previous.pmFiles ?? analysis.pmFiles),
    additionalMaterials: list(previous.additionalMaterials), artifactBindingArchive: archive,
    ...(previous.pmHypotheses ? { pmHypotheses: previous.pmHypotheses } : {}),
    ...(previous.interviewSession ? { interviewSession: previous.interviewSession } : {}),
    ...(manualArchive.length ? { manualWorkProductArchive: manualArchive } : {}), ...(summaryArchive.length ? { roleSummaryArchive: summaryArchive } : {}) };
}
