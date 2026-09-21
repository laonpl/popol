import { normalizePmWorkProducts, pmWorkProductExport } from './pmWorkProducts.js';
import { artifactExport } from './roleArtifacts.js';

export const PM_DIMENSIONS = [
  { key: 'discovery', label: '고객 문제 발견', question: '어떤 사용자 발화나 행동을 보고 이 문제를 먼저 풀기로 했나요?', material: '인터뷰 원문 · VOC · 행동/퍼널 기록' },
  { key: 'prioritization', label: '우선순위와 포기', question: '비교한 대안은 무엇이고, 어떤 기준으로 선택하거나 제외했나요?', material: '대안 비교 · MVP 범위 · 의사결정 회의록' },
  { key: 'delivery', label: '설계와 실행 기여', question: '본인이 결정·작성·합의한 범위와 팀이 실행한 범위는 어디까지인가요?', material: 'PRD · 정책/예외 흐름 · 인수 조건 · 변경 이력' },
  { key: 'validation', label: '가설 검증', question: '실행 전에 세운 기준과 실제로 관찰한 결과는 각각 무엇인가요?', material: '실험 설계 · 사용성 테스트 · 관찰 기록' },
  { key: 'outcome', label: '사용자·사업 변화', question: '목표가 아닌 실제 변화는 무엇이며, 기간과 대상은 어떻게 되나요?', material: '지표 보고서 · 전후 비교 · 정성 피드백' },
  { key: 'learning', label: '판단의 변화', question: '예상과 달라서 중단·수정한 것은 무엇이고 다음 결정에 어떻게 적용했나요?', material: '회고 · 가설 폐기 · 후속 결정 기록' },
];
export const PM_STAGE_LABELS = { planned: '계획', executed: '실행', observed: '관찰 결과', changed: '판단 변경', unknown: '단계 확인 필요' };
export const PM_BASIS_LABELS = { source_excerpt: '자료 원문 대조', self_report: '본인 진술', unlocated: '근거 확인 필요' };
const string = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const array = value => Array.isArray(value) ? value : [];
const compact = value => string(value).normalize('NFKC').replace(/\s+/g, ' ');

function currentBasis(row, sourceText) {
  if (!['source_excerpt', 'self_report'].includes(row.basis) || compact(row.quote).length < 12) return 'unlocated';
  // When editing the experience, a removed or changed source invalidates its old match.
  // Export consumers without raw material use the server's persisted comparison result.
  if (sourceText !== undefined && !compact(sourceText).includes(compact(row.quote))) return 'unlocated';
  return row.basis;
}

export function buildPmEvidenceModel(sr = {}, { sourceText } = {}) {
  const cases = array(sr.keyExperiences).map((experience, sourceIndex) => ({ experience, sourceIndex })).filter(({ experience }) => experience && typeof experience === 'object').map(({ experience, sourceIndex }, index) => {
    const jd = experience?.jobData || {};
    const legacyRows = jd.pmEvidenceVersion !== 1 && !array(jd.pmEvidence).length ? [
      ['discovery', jd.problemSignal || experience.context || experience.situation],
      ['prioritization', [string(jd.decision), string(jd.alternatives)].filter(Boolean).join('\n')],
      ['delivery', experience.action], ['validation', jd.validation],
      ['outcome', experience.result], ['learning', experience.learning],
    ].filter(([, claim]) => string(claim)).map(([dimension, claim]) => ({ dimension, claim, quote: '', basis: 'unlocated', stage: 'unknown', derivedLegacy: true, missingEvidence: '기존 정리문 · 원문 대조 필요' })) : [];
    const records = (legacyRows.length ? legacyRows : array(jd.pmEvidence)).map((row, sourceRecordIndex) => row && ({ ...row, sourceRecordIndex })).filter(row => row && PM_DIMENSIONS.some(d => d.key === row.dimension) && string(row.claim)).slice(0, 12).map((row, i) => ({
      ...row, id: `${index}-${i}`, claim: string(row.claim), quote: string(row.quote),
      basis: currentBasis(row, sourceText), stage: currentBasis(row, sourceText) !== 'unlocated' && PM_STAGE_LABELS[row.stage] ? row.stage : 'unknown',
      ownership: currentBasis(row, sourceText) !== 'unlocated' ? string(row.ownership) : '',
    }));
    const metrics = array(jd.pmMetrics).filter(row => row && string(row.name)).slice(0, 5).map(row => {
      const basis = currentBasis(row, sourceText);
      return { ...row, basis, ...(basis === 'unlocated' ? { baseline: '', target: '', actual: '', period: '', population: '', method: '', unit: '' } : {}) };
    });
    const workProducts = normalizePmWorkProducts(jd.pmWorkProducts, row => currentBasis(row, sourceText));
    const productDimensions = { research: 'discovery', businessModel: 'prioritization', metricLinks: 'validation', serviceBlueprint: 'delivery', releases: 'delivery', risks: 'learning', problems: 'discovery', alternatives: 'prioritization', journey: 'delivery', requirements: 'delivery', experiments: 'validation', collaboration: 'delivery', troubleshooting: 'learning' };
    const evidenceRows = [...records, ...Object.entries(workProducts).flatMap(([key, rows]) => rows.map(row => ({ ...row, dimension: productDimensions[key] }))), ...metrics.map(row => ({ ...row, dimension: row.actual ? 'outcome' : 'validation' }))];
    const linkedCount = new Set(evidenceRows.filter(row => row.basis !== 'unlocated').map(row => `${row.basis}|${row.sourceName}|${row.quote}`)).size;
    return { id: experience.id || `pm-case-${index}`, sourceIndex, title: string(experience.title) || `제품 의사결정 ${index + 1}`, records, metrics, workProducts, evidenceRows, linkedCount, hasWorkProducts: Object.values(workProducts).some(rows => rows.length), workProductsVersion: jd.pmWorkProductsVersion || 0 };
  });
  const records = cases.flatMap(item => item.evidenceRows);
  const dimensions = PM_DIMENSIONS.map(dimension => {
    const entries = [...new Map(records.filter(row => row.dimension === dimension.key).map(row => [`${row.basis}|${row.sourceName}|${row.quote || row.claim}`, row])).values()];
    return { ...dimension, documented: entries.filter(row => row.basis === 'source_excerpt').length,
      selfReported: entries.filter(row => row.basis === 'self_report').length,
      missing: entries.length === 0 || entries.every(row => row.basis === 'unlocated'),
    };
  });
  return { cases, dimensions, legacy: sr.pmEvidenceVersion !== 1 && !array(sr.keyExperiences).some(ke => ke?.jobData?.pmEvidenceVersion === 1),
    documented: new Set(records.filter(row => row.basis === 'source_excerpt').map(row => `${row.sourceName}|${row.quote}`)).size,
    selfReported: new Set(records.filter(row => row.basis === 'self_report').map(row => `${row.sourceName}|${row.quote}`)).size,
    unlocated: records.filter(row => row.basis === 'unlocated').length,
    metrics: cases.flatMap(item => item.metrics),
  };
}

export function getPmPriorityItems(experiences = [], { sourceText } = {}) {
  return array(experiences).map((ke, i) => {
    const jd = ke?.jobData || {};
    const impact = Number(jd.impact), effort = Number(jd.effort);
    if (jd.pmEvidenceVersion !== 1 || !string(jd.priorityQuote) || !Number.isInteger(impact) || !Number.isInteger(effort) || impact < 1 || impact > 5 || effort < 1 || effort > 5) return null;
    if (sourceText !== undefined && !compact(sourceText).includes(compact(jd.priorityQuote))) return null;
    if (!new RegExp(`(?:impact|임팩트|영향도)\\s*[:：=]?\\s*${impact}\\s*(?:점|/\\s*5)(?!\\d)`, 'i').test(jd.priorityQuote)
      || !new RegExp(`(?:effort|노력|난이도|공수)\\s*[:：=]?\\s*${effort}\\s*(?:점|/\\s*5)(?!\\d)`, 'i').test(jd.priorityQuote)) return null;
    return { n: i + 1, label: string(ke.title) || `의사결정 ${i + 1}`, impact, effort };
  }).filter(Boolean);
}

export function buildPmEvidenceExportSections(sr = {}, options = {}) {
  const model = buildPmEvidenceModel(sr, options);
  if (model.legacy && !model.cases.some(item => item.records.length || item.hasWorkProducts)) return [];
  const sections = model.cases.filter(item => item.records.length || item.metrics.length || item.hasWorkProducts).map((item, index) => ({
    key: `core-pm-evidence-${index}`, type: 'core', label: item.title, enabled: true,
    content: [
      item.title,
      ...artifactExport(sr, item),
      ...pmWorkProductExport(item.workProducts, PM_STAGE_LABELS, PM_BASIS_LABELS),
      ...item.records.map(row => [
        `${PM_DIMENSIONS.find(d => d.key === row.dimension).label} · ${PM_STAGE_LABELS[row.stage]} · ${PM_BASIS_LABELS[row.basis]}`,
        row.claim,
        row.basis !== 'unlocated' && row.quote ? `원문 발췌: “${row.quote}”` : '',
        row.basis !== 'unlocated' ? `출처: ${string(row.sourceName)}${row.location ? ` · ${row.location}` : ''}` : '출처 대조 필요',
        row.ownership ? `본인 역할(추출): ${row.ownership}` : '본인 역할: 추가 확인 필요',
        row.limitation ? `해석 한계: ${row.limitation}` : '',
        row.missingEvidence ? `추가 확인: ${row.missingEvidence}` : '',
      ].filter(Boolean).join('\n')),
      ...item.metrics.map(metric => [
        `${metric.name} · ${PM_BASIS_LABELS[metric.basis]}`,
        metric.basis !== 'unlocated' ? `기준값: ${string(metric.baseline) || '미기록'} / 목표: ${string(metric.target) || '미기록'} / 관찰값: ${string(metric.actual) || '미측정·미기록'}` : '수치 원문 확인 필요',
        `기간: ${string(metric.period) || '미기록'} / 대상·표본: ${string(metric.population) || '미기록'}`,
        `정의·측정 방법: ${string(metric.method) || '미기록'}`,
        metric.basis !== 'unlocated' && metric.quote ? `원문 발췌: “${metric.quote}”\n출처: ${string(metric.sourceName)}` : '',
        metric.limitation ? `해석 한계: ${metric.limitation}` : '전후 변화만으로 이 결정의 인과효과를 단정하지 않습니다.',
      ].filter(Boolean).join('\n')),
    ].filter(Boolean).join('\n\n'),
  }));
  return sections;
}
