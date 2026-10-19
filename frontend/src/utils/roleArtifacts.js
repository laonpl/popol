import { collectRoleSelfReports } from '../../../shared/roleSelfReport.mjs';
import { performanceExport } from '../../../shared/rolePerformance.mjs';
import { planningDocumentText } from '../../../shared/sourceExperience.mjs';

const list = value => Array.isArray(value) ? value : [];
const str = value => typeof value === 'string' ? value.trim() : '';
export function roleSourceText(sr, sourceText) {
  const assets = roleArtifacts(sr);
  const additions = list(sr.additionalMaterials).filter(row => row && assets.some(asset => asset.id === row.assetId) && str(row.text));
  const selfReports = collectRoleSelfReports(sr);
  const connected = list(sr.keyExperiences).flatMap(experience => [experience?.planningConnection, experience?.figmaConnection, ...list(experience?.sourceDocuments)]).filter(Boolean).map(document => planningDocumentText(document)).filter(Boolean);
  if (sourceText === undefined && !connected.length && !additions.length && !selfReports.length) return undefined;
  return [sourceText || '', ...connected, ...additions.map(row => `--- ${row.name} ---\n${row.text}`), ...selfReports.map(row => `--- ${row.name} ---\n${row.text}`)].filter(Boolean).join('\n\n');
}
export function safeArtifactUrl(value) {
  const url = str(value);
  if (/^\/(?!\/)/.test(url)) return url;
  try { const parsed = new URL(url); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; }
}
export function roleArtifacts(sr = {}) {
  const seen = new Set();
  return [...list(sr.deliverables), ...list(sr.pmFiles)].filter(item => item && safeArtifactUrl(item.url)).map(item => ({ ...item, url: safeArtifactUrl(item.url), id: str(item.id) || safeArtifactUrl(item.url), name: str(item.name) || '연결된 산출물' })).filter(item => { if (seen.has(item.url)) return false; seen.add(item.url); return true; });
}
export function caseArtifacts(sr, item) {
  const files = roleArtifacts(sr), bindings = list(sr.keyExperiences?.[item.sourceIndex]?.artifactBindings);
  const rows = item.evidenceRows || [...(item.records || []), ...Object.values(item.workProducts || {}).flat(), ...(item.metrics || [])];
  // Exact, unique filename matches only. A file association is not proof of authorship.
  return files.flatMap(file => {
    const binding = bindings.find(row => row?.assetId === file.id);
    const uniqueName = files.filter(other => other.name === file.name).length === 1;
    const matches = rows.filter(row => row && row.basis === 'source_excerpt' && uniqueName && row.sourceName === file.name);
    if (binding?.hidden || (!binding && !matches.length)) return [];
    return [{ ...file, binding, automatic: !binding, matches, image: /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(file.url) || /^(png|jpe?g|webp|gif)$/i.test(file.ext || ''), caption: str(binding?.caption), contribution: str(binding?.contribution), purpose: str(binding?.purpose) }];
  });
}
export function patchArtifactBinding(sr, sourceIndex, assetId, patch) {
  return { ...sr, keyExperiences: list(sr.keyExperiences).map((item, index) => {
    if (index !== sourceIndex || !item) return item;
    const previous = list(item.artifactBindings), binding = previous.find(row => row?.assetId === assetId);
    return { ...item, artifactBindings: [...previous.filter(row => row?.assetId !== assetId), { ...binding, assetId, ...patch }] };
  }) };
}
export function artifactExport(sr, item) {
  const experience = sr.keyExperiences?.[item.sourceIndex] || {}, summary = experience.roleSummary || {};
  return [...caseArtifacts(sr, item).map(file => ['산출물: ' + file.name, file.purpose && '연결한 판단: ' + file.purpose, file.caption && '설명(직접 입력): ' + file.caption, file.contribution && '내 작업 범위(직접 입력): ' + file.contribution, '원본: ' + file.url].filter(Boolean).join('\n')),
    experience.performanceData?.metrics?.length ? performanceExport(experience.performanceData) : '',
    experience.planningConnection ? ['Notion 연결 기획서: ' + experience.planningConnection.title, '원본: ' + experience.planningConnection.url, '갱신: ' + experience.planningConnection.updatedAt, ...(experience.planningConnection.sections || []).map(section => section.text)].join('\n') : '',
    ...[experience.figmaConnection, ...list(experience.sourceDocuments)].filter(Boolean).map(document => `경험 정리에 읽은 자료: ${document.title}\n원본: ${document.url || '가져온 파일'}\n${planningDocumentText(document)}`),
    ...list(summary.process).map(step => `실행 단계: ${step.title} · ${step.description || ''}`), ...list(summary.decisions).map(decision => `내린 선택: ${decision.title} · ${decision.reason || ''}`),
    ['headline', 'myRole', 'problem', 'action', 'validation', 'result', 'learning', 'figmaUrl'].map(field => summary[field] ? `한 장 정리 · ${field}: ${summary[field]}` : '').filter(Boolean).join('\n'),
    ...(summary.manualMetrics || []).filter(row => row.name && row.actual).map(row => `직접 입력 지표 · ${row.name}: ${row.actual}${row.baseline ? ` · 기준 ${row.baseline}` : ''}${row.target ? ` · 목표 ${row.target}` : ''}`)].filter(Boolean);
}
