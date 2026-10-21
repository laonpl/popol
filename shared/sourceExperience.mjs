import { planningSummary } from './rolePlanning.mjs';
const string = value => typeof value === 'string' ? value.trim() : '';
const guidance = /(?:보강해\s*(?:주세요|주십시오)|보충해\s*주세요|기록해\s*주세요|작성해\s*주세요|한 장 편집에서|실제 성과를 연결하면|직접 입력$|실행한 행동과 의사결정 과정을|측정 가능한 결과나 산출물을|인사이트,?\s*trade[- ]?off)/i;
export function experienceText(value) {
  return string(value).split(/\n/).filter(line => line.trim() && !guidance.test(line)).join('\n').trim();
}
export function planningDocumentText(document) {
  return (document?.sections || []).map(section => `${section.type === 'heading' ? '# ' : ''}${experienceText(section.text)}`).filter(line => line.trim() && line !== '# ').join('\n')
    + (document?.tables || []).map(rows => '\n' + rows.map(row => row.join(' | ')).join('\n')).join('');
}
export function collectExperienceDocuments(sr, item) {
  const experience = sr.keyExperiences?.[item.sourceIndex] || {}, documents = [];
  if (experience.planningConnection) documents.push(experience.planningConnection);
  if (experience.figmaConnection) documents.push(experience.figmaConnection);
  documents.push(...(experience.sourceDocuments || []));
  const bindings = (experience.artifactBindings || []).filter(row => !row.hidden).map(row => row.assetId);
  const exactNames = (item.evidenceRows || []).map(row => row.sourceName).filter(Boolean);
  const files = [...(sr.deliverables || []), ...(sr.pmFiles || [])];
  for (const material of sr.additionalMaterials || []) {
    const file = files.find(file => file.id === material.assetId);
    if (file && (bindings.includes(file.id) || exactNames.includes(file.name)) && experienceText(material.text)) documents.push({ type: 'file', title: file.name, url: file.url, sections: (material.text.slice(0, 50000).match(/[\s\S]{1,14000}/g) || []).map((text, index) => ({ id: `${file.id}-${index}`, type: 'text', text })), tables: [] });
  }
  const seen = new Set(); return documents.filter(document => { const id = document.url || document.assetId || document.title; if (!planningDocumentText(document).trim() || seen.has(id)) return false; seen.add(id); return true; });
}
export function localSourceSummary(documents) {
  const combined = { sections: documents.flatMap(document => document.sections || []) };
  const fields = planningSummary(combined);
  const source = combined.sections.map(section => experienceText(section.text)).filter(Boolean);
  if (!Object.keys(fields).length && source.length) fields.problem = source.find(text => /문제|어려|막막|고통|불편/.test(text)) || '';
  return { ...Object.fromEntries(Object.entries(fields).map(([field, value]) => [field, experienceText(value)])), headline: documents.map(document => document.title).find(title => title && !/제목\s*없음|핵심\s*경험\s*\d|연결된/.test(title)) || '', process: [], decisions: [] };
}
export function sourceSummaryForPage(item, experience) {
  const source = localSourceSummary([experience.planningConnection, experience.figmaConnection].filter(Boolean));
  const manual = experience.roleSummary || {};
  const fields = Object.fromEntries(['headline', 'myRole', 'problem', 'action', 'validation', 'result', 'learning', 'audience', 'channel', 'message', 'subtitle'].map(field => [field, experienceText(manual[field]) || experienceText(source[field])]));
  const record = dimension => experienceText(item.records.find(row => row.dimension === dimension)?.claim);
  return { ...manual, ...fields,
    problem: fields.problem || record('discovery') || record('conversion') || experienceText(experience.context),
    action: fields.action || record('delivery') || record('activation') || experienceText(experience.action),
    result: fields.result || record('outcome') || record('attribution') || experienceText(experience.result),
    learning: fields.learning || record('learning') || experienceText(experience.learning),
    process: (manual.process || []).filter(row => experienceText(row.title)).slice(0, 4), decisions: (manual.decisions || []).filter(row => experienceText(row.title)).slice(0, 3) };
}
