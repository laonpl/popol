// Presentation only: select existing records, never infer causality, proficiency or new results.
const list = value => Array.isArray(value) ? value.filter(Boolean) : [];
const selected = (rows, field) => list(rows).find(row => row[field]) || null;
const claim = (item, dimension) => list(item.records).find(row => row.dimension === dimension) || null;
export function pmProofMap(item) {
  const w = item.workProducts || {};
  return {
    problem: selected(w.problems, 'problem') || selected(w.research, 'observation') || claim(item, 'discovery'),
    alternatives: list(w.alternatives),
    flow: list(w.serviceBlueprint).length ? list(w.serviceBlueprint) : list(w.journey),
    policy: selected(w.requirements, 'rule') || selected(w.requirements, 'requirement'),
    execution: selected(w.collaboration, 'myAction') || selected(w.releases, 'scope') || claim(item, 'delivery'),
    validation: selected(w.experiments, 'observation') || selected(w.experiments, 'hypothesis') || claim(item, 'validation'),
    learning: selected(w.troubleshooting, 'change') || claim(item, 'learning'),
    metrics: list(item.metrics),
  };
}
export function marketingProofMap(item) {
  const w = item.workProducts || {};
  return {
    audience: selected(w.audiences, 'segment') || claim(item, 'targeting'),
    promise: selected(w.positioning, 'promise'),
    creatives: list(w.creatives), channels: list(w.channels),
    content: selected(w.contentSystem, 'pillar'), crm: selected(w.crm, 'trigger'),
    optimization: selected(w.optimization, 'change') || selected(w.experiments, 'decision') || claim(item, 'learning'),
    measurement: selected(w.measurement, 'definition'),
    metrics: list(item.metrics),
  };
}

export function appendReviewedWorkProduct(sr, item, role, group, draft, reference) {
  if (!['pm', 'marketer'].includes(role) || !group?.key || !Array.isArray(group.fields)) return sr;
  const key = role === 'pm' ? 'pmWorkProducts' : 'marketerWorkProducts';
  const experience = sr.keyExperiences?.[item.sourceIndex];
  const rows = list(experience?.jobData?.[key]?.[group.key]);
  if (!experience || rows.length >= group.limit) return sr;
  const fields = Object.fromEntries(group.fields.map(([field]) => [field, String(draft[field] || '').trim().slice(0, 600)]));
  if (!Object.values(fields).some(Boolean)) return sr;
  // Only an already-present, normalized source can be selected. No arbitrary source URL or quote.
  const ref = list(item.evidenceRows).find(row => row === reference && ['source_excerpt', 'self_report'].includes(row.basis) && row.quote?.length >= 12);
  const row = { ...fields, quote: ref?.quote || '', source: ref?.sourceName || '', sourceName: ref?.sourceName || '', sourceId: ref?.sourceId || '', location: ref?.location || '', basis: ref?.basis || 'unlocated', stage: 'unknown', userEdited: true, manuallyAdded: true, manualId: globalThis.crypto.randomUUID() };
  return { ...sr, keyExperiences: sr.keyExperiences.map((entry, index) => index !== item.sourceIndex ? entry : { ...entry, jobData: { ...entry.jobData, [key]: { ...entry.jobData?.[key], [group.key]: [...rows, row] } } }) };
}
