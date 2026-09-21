// Deterministic source matching, not a claim that the source itself is true.
// No model call, scores, or invented evidence is used in this post-processing step.
import { PM_WORK_PRODUCT_FIELDS, PM_WORK_PRODUCT_LIMITS } from '../prompts/pmWorkProducts.js';
export { matchQuote, planOnly, supported, observedValue };
const DIMENSIONS = new Set(['discovery', 'prioritization', 'delivery', 'validation', 'outcome', 'learning']);
const STAGES = new Set(['planned', 'executed', 'observed', 'changed', 'unknown']);
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const compact = value => text(value).normalize('NFKC').replace(/\s+/g, ' ');
const list = value => Array.isArray(value) ? value : [];
const selfReport = /직접\s*입력|^인터뷰$|AI\s*채팅\s*보완|사용자\s*답변|보강\s*메모|회상/;
const generated = /핵심\s*경험|인터뷰구조화|AI\s*(?:초안|추론|분석)|작성\s*가이드/;
const unread = /(?:직접\s*읽지\s*못|내용을?\s*(?:확인|불러오|읽)지\s*못|접근\s*불가)/;

export function collectPmSources(content = {}) {
  const sources = [];
  const entries = typeof content === 'string' ? [['입력 자료', content]] : Object.entries(content || {});
  for (const [key, value] of entries) {
    if (generated.test(key) || !text(value)) continue;
    const raw = text(value);
    const pattern = /^(?:-{3,}|={3,})[ \t]*(.+?)[ \t]*(?:-{3,}|={3,})[ \t]*\r?$/gm;
    const headings = [...raw.matchAll(pattern)];
    const parts = headings.length ? [
      { name: key, body: raw.slice(0, headings[0].index), artifact: false },
      ...headings.map((match, i) => ({ name: match[1].trim(), body: raw.slice(match.index + match[0].length, headings[i + 1]?.index ?? raw.length), artifact: true })),
    ] : [{ name: key === 'rawInput' ? '입력 자료' : key, body: raw, artifact: false }];
    for (const part of parts) {
      if (!part.body.trim() || generated.test(part.name)) continue;
      sources.push({
        id: `PM-S${sources.length + 1}`, name: part.name.slice(0, 240),
        text: /AI\s*채팅\s*보완/.test(part.name) ? part.body.replace(/^Q\..*$/gm, '').replace(/^→\s*/gm, '').trim() : part.body.trim(),
        kind: unread.test(part.body) && part.body.trim().length < 500 ? 'unread'
          : !part.artifact || selfReport.test(part.name) ? 'self_report' : 'artifact',
      });
    }
  }
  return sources;
}

function matchQuote(value, sourceHint, sources) {
  const quote = text(value).slice(0, 1000);
  const needle = compact(quote);
  if (needle.length < 12) return { quote, basis: 'unlocated', sourceId: '', sourceName: '', location: '' };
  const matches = sources.filter(source => source.kind !== 'unread' && compact(source.text).includes(needle));
  // Duplicate excerpts from different files must not be attributed to an arbitrary source.
  const hinted = matches.filter(source => compact(source.name) === compact(sourceHint));
  const source = matches.length === 1 ? matches[0] : hinted.length === 1 ? hinted[0] : null;
  if (!source) return { quote, basis: 'unlocated', sourceId: '', sourceName: '', location: '' };
  const exactAt = source.text.indexOf(quote);
  const line = exactAt >= 0 ? source.text.slice(0, exactAt).split('\n').length : null;
  return { quote, basis: source.kind === 'artifact' ? 'source_excerpt' : 'self_report', sourceId: source.id, sourceName: source.name, location: line ? `추출 본문 ${line}행` : '추출 본문 (공백 정규화 대조)' };
}

const planOnly = quote => /예정|계획|목표|예상|가설|기대/.test(quote) && !/관찰(?:한|했|값)|측정(?:한|했|값)|실측(?:값|치|[:：])|실제\s*(?:결과|관찰|전환|수치|[:：]?\s*\d)|결과(?:는|:|：)|확인했다/.test(quote);
const supported = (value, quote) => {
  const candidate = compact(value);
  if (!candidate) return '';
  const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 10 must not be accepted from 100, 0.10 or 10,000.
  const prefix = /^\d/.test(candidate) ? '(?<![\\d+−-])(?<!\\d[.,])' : '';
  const suffix = /\d$/.test(candidate) ? '(?!\\d|[.,]\\d)' : '';
  return new RegExp(`${prefix}${escaped}${suffix}`).test(compact(quote)) ? text(value) : '';
};

function observedValue(value, quote) {
  if (!supported(value, quote) || planOnly(quote)) return '';
  // Conservative: keep an actual only in an explicitly observed clause, never a goal clause.
  const clauses = quote.split(/[\n;。]|\.(?!\d)|목표|예상|기대/);
  return clauses.some(clause => /실제|실측|관찰(?:값|한|했)|측정(?:값|한|했)|결과\s*[:：는]/.test(clause)
    && !/예정|계획|미측정|미관찰/.test(clause)
    && supported(value, clause.replace(/^.*?(?:실제|실측|관찰(?:값|한|했)|측정(?:값|한|했)|결과\s*[:：는])/, '')))
    ? text(value) : '';
}

export function groundPmEvidence(analysis, content) {
  if (analysis?.jobCategory !== 'pm') return analysis;
  const sources = collectPmSources(content);
  const keyExperiences = list(analysis.keyExperiences).filter(experience => experience && typeof experience === 'object').map(experience => {
    const jd = experience.jobData && typeof experience.jobData === 'object' ? experience.jobData : {};
    const pmWorkProducts = Object.fromEntries(Object.entries(PM_WORK_PRODUCT_FIELDS).map(([kind, fields]) => [kind,
      list(jd.pmWorkProducts?.[kind]).filter(row => row && fields.some(field => text(row[field]))).slice(0, PM_WORK_PRODUCT_LIMITS[kind]).map(row => {
        const reference = matchQuote(row.quote, row.source, sources);
        const stage = reference.basis === 'unlocated' ? 'unknown' : planOnly(reference.quote) ? 'planned' : STAGES.has(row.stage) ? row.stage : 'unknown';
        const values = Object.fromEntries(fields.map(field => [field, text(row[field]).slice(0, 600)]));
        if (kind === 'alternatives' && !['채택', '보류', '기각', '검토중'].includes(values.disposition)) values.disposition = '미확인';
        if (kind === 'experiments' && (stage === 'planned' || reference.basis === 'unlocated')) { values.observation = ''; values.decision = ''; }
        if (['troubleshooting', 'risks'].includes(kind) && stage === 'planned') values.result = '';
        if (reference.basis === 'unlocated') {
          if (kind === 'requirements') values.owner = '';
          if (kind === 'collaboration') values.myAction = '';
          if (kind === 'troubleshooting') values.result = '';
          if (kind === 'risks') { values.owner = ''; values.result = ''; }
          if (kind === 'releases') values.status = '';
        }
        return { ...values, ...reference, stage };
      }),
    ]));
    const pmEvidence = list(jd.pmEvidence).slice(0, 12).filter(item => item && DIMENSIONS.has(item.dimension) && text(item.claim)).map(item => {
      const reference = matchQuote(item.quote, item.source, sources);
      const located = reference.basis !== 'unlocated';
      return {
        dimension: item.dimension, claim: text(item.claim).slice(0, 800), ...reference,
        stage: !located ? 'unknown' : planOnly(reference.quote) ? 'planned' : STAGES.has(item.stage) ? item.stage : 'unknown',
        ownership: text(item.ownership).slice(0, 400), limitation: text(item.limitation).slice(0, 500),
        missingEvidence: located ? text(item.missingEvidence).slice(0, 400) : text(item.missingEvidence).slice(0, 400) || '이 주장을 확인할 수 있는 원문이나 직접 답변이 필요합니다.',
      };
    });
    const pmMetrics = list(jd.pmMetrics).slice(0, 5).filter(item => item && text(item.name)).map(item => {
      const reference = matchQuote(item.quote, item.source, sources);
      const located = reference.basis !== 'unlocated';
      return {
        name: text(item.name).slice(0, 160), ...reference,
        baseline: located ? supported(item.baseline, reference.quote) : '',
        target: located ? supported(item.target, reference.quote) : '',
        actual: located ? observedValue(item.actual, reference.quote) : '',
        unit: located ? supported(item.unit, reference.quote) : '',
        period: located ? supported(item.period, reference.quote) : '',
        population: located ? supported(item.population, reference.quote) : '',
        method: located ? supported(item.method, reference.quote) : '',
        limitation: text(item.limitation).slice(0, 500),
      };
    });
    const priority = matchQuote(jd.priorityQuote, '', sources);
    const explicitScore = (label, value) => {
      const score = Number(value);
      if (!Number.isInteger(score) || score < 1 || score > 5 || priority.basis === 'unlocated') return '';
      const pattern = new RegExp(`(?:${label})\\s*[:：=]?\\s*${score}\\s*(?:점|/\\s*5)(?!\\d)`, 'i');
      return pattern.test(priority.quote) ? score : '';
    };
    return { ...experience, jobData: { ...jd, pmEvidence, pmMetrics, pmWorkProducts, pmWorkProductsVersion: 2, pmEvidenceVersion: 1,
      impact: explicitScore('impact|임팩트|영향도', jd.impact), effort: explicitScore('effort|노력|난이도|공수', jd.effort),
      priorityQuote: priority.basis !== 'unlocated' ? priority.quote : '',
    } };
  });
  return { ...analysis, keyExperiences, pmEvidenceVersion: 1, pmWorkProductsVersion: 2 };
}
