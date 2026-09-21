const list = value => Array.isArray(value) ? value : [];
const str = value => typeof value === 'string' ? value.trim() : '';
export function roleSourceText(sr, sourceText) {
  const assets = roleArtifacts(sr);
  const additions = list(sr.additionalMaterials).filter(row => row && assets.some(asset => asset.id === row.assetId) && str(row.text));
  if (sourceText === undefined && !additions.length) return undefined;
  return [sourceText || '', ...additions.map(row => `--- ${row.name} ---\n${row.text}`)].filter(Boolean).join('\n\n');
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
  return caseArtifacts(sr, item).map(file => ['산출물: ' + file.name, file.purpose && '연결한 판단: ' + file.purpose, file.caption && '설명(직접 입력): ' + file.caption, file.contribution && '내 작업 범위(직접 입력): ' + file.contribution, '원본: ' + file.url].filter(Boolean).join('\n'));
}
