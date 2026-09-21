import { collectPmSources, matchQuote, planOnly, supported, observedValue } from './pmEvidence.js';
import { MARKETER_WORK_PRODUCT_FIELDS, MARKETER_WORK_PRODUCT_LIMITS } from '../prompts/marketerWorkProducts.js';
const text = v => typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
const list = v => Array.isArray(v) ? v : [];
const stages = new Set(['planned', 'executed', 'observed', 'changed', 'unknown']);
const dimensions = new Set(['conversion', 'targeting', 'creative', 'experiment', 'attribution', 'learning']);
export function groundMarketerEvidence(analysis, content) {
  if (analysis?.jobCategory !== 'marketer') return analysis;
  const sources = collectPmSources(content);
  const referenceFor = row => matchQuote(row.quote, row.source || row.sourceName, sources);
  const stageFor = (row, ref) => ref.basis === 'unlocated' ? 'unknown' : planOnly(ref.quote) ? 'planned' : stages.has(row.stage) ? row.stage : 'unknown';
  const keyExperiences = list(analysis.keyExperiences).filter(row => row && typeof row === 'object').map(experience => {
    const jd = experience.jobData || {};
    const marketerWorkProducts = Object.fromEntries(Object.entries(MARKETER_WORK_PRODUCT_FIELDS).map(([kind, fields]) => [kind,
      list(jd.marketerWorkProducts?.[kind]).filter(row => row && fields.some(field => text(row[field]))).slice(0, MARKETER_WORK_PRODUCT_LIMITS[kind]).map(row => {
        const ref = referenceFor(row), stage = stageFor(row, ref);
        const values = Object.fromEntries(fields.map(field => [field, text(row[field]).slice(0, 600)]));
        if (stage === 'planned' || ref.basis === 'unlocated') {
          if ('observation' in values) values.observation = '';
          if (kind === 'experiments') values.decision = '';
          if (kind === 'operations') { values.myAction = ''; values.agreement = ''; }
        }
        if (kind === 'channels') values.budget = ref.basis === 'unlocated' ? '' : supported(row.budget, ref.quote);
        return { ...values, ...ref, stage, ownership: ref.basis === 'unlocated' ? '' : text(row.ownership).slice(0, 400) };
      }),
    ]));
    const marketerEvidence = list(jd.marketerEvidence).filter(row => row && dimensions.has(row.dimension) && text(row.claim)).slice(0, 8).map(row => {
      const ref = referenceFor(row);
      return { dimension: row.dimension, claim: text(row.claim).slice(0, 800), ...ref, stage: stageFor(row, ref), ownership: ref.basis === 'unlocated' ? '' : text(row.ownership).slice(0, 400), limitation: text(row.limitation).slice(0, 500), missingEvidence: text(row.missingEvidence).slice(0, 400) };
    });
    const marketerMetrics = list(jd.marketerMetrics).filter(row => row && text(row.name)).slice(0, 5).map(row => {
      const ref = referenceFor(row), located = ref.basis !== 'unlocated';
      return { name: text(row.name).slice(0, 160), ...ref, kind: ['outcome', 'output', 'qualitative'].includes(row.kind) ? row.kind : 'unclassified', stage: ['reach', 'click', 'conversion', 'retention', 'cost', 'qualitative'].includes(row.stage) ? row.stage : 'qualitative', channel: text(row.channel).slice(0, 100),
        ...Object.fromEntries(['baseline', 'target', 'unit', 'period', 'population', 'method'].map(field => [field, located ? supported(row[field], ref.quote) : ''])),
        actual: located ? observedValue(row.actual, ref.quote) : '', limitation: text(row.limitation).slice(0, 500) };
    });
    return { ...experience, jobData: { ...jd, marketerEvidence, marketerMetrics, marketerWorkProducts, marketerEvidenceVersion: 2, marketerWorkProductsVersion: 1 } };
  });
  return { ...analysis, keyExperiences, marketerEvidenceVersion: 2, marketerWorkProductsVersion: 1 };
}
