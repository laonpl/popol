import { MARKETER_WORK_PRODUCTS } from './marketerWorkProducts.js';
import { artifactExport } from './roleArtifacts.js';
import { marketingCaseSections } from './marketerCaseStudy.js';
export const MARKETER_DIMENSIONS = [
  { key: 'conversion', label: '사업 · 브랜드 목표' }, { key: 'targeting', label: '고객 선택 근거' },
  { key: 'creative', label: '표현과 채널 선택' }, { key: 'experiment', label: '실행과 검증' },
  { key: 'attribution', label: '성과 해석' }, { key: 'learning', label: '판단의 변화' },
];
export const MARKETER_STAGE_LABELS = { planned: '계획', executed: '실행', observed: '관찰 결과', changed: '판단 변경', unknown: '단계 확인 필요' };
export const MARKETER_BASIS_LABELS = { source_excerpt: '자료 원문 대조', self_report: '본인 진술', unlocated: '원문 확인 필요', derived: '기존 정리 · 원문 미대조' };
export const METRIC_KINDS = { outcome: '고객 · 사업 반응', output: '제작 · 운영량', qualitative: '정성 반응', unclassified: '지표 성격 확인 필요' };
export const FUNNEL_STAGES = ['reach', 'click', 'conversion', 'retention', 'cost', 'qualitative'].map((key, i) => ({ key, label: ['도달 · 인지도', '클릭 · 유입', '전환', '관계 · 재구매', '비용 효율', '정성 반응'][i] }));
const str = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const arr = value => Array.isArray(value) ? value : [];
const norm = value => str(value).normalize('NFKC').replace(/\s+/g, ' ');
function currentBasis(row, sourceText) {
  if (!['source_excerpt', 'self_report'].includes(row.basis) || norm(row.quote).length < 12) return 'unlocated';
  if (sourceText !== undefined && !norm(sourceText).includes(norm(row.quote))) return 'unlocated';
  return row.basis;
}
export function buildMarketerEvidenceModel(sr = {}, { sourceText } = {}) {
  const kit = sr.marketerKit || {};
  const raw = arr(sr.keyExperiences);
  const experiences = raw.some(Boolean) ? raw : arr(kit.experienceCards).map(card => ({ ...card, action: card.execution || card.action, context: card.problem || card.context, jobData: {} }));
  const cases = experiences.map((experience, sourceIndex) => ({ experience, sourceIndex })).filter(({ experience }) => experience && typeof experience === 'object').map(({ experience, sourceIndex }) => {
    const jd = experience.jobData || {}, funnel = sourceIndex === 0 ? kit.funnel || {} : {};
    const extracted = arr(jd.marketerEvidence).map((row, sourceRecordIndex) => row && ({ ...row, sourceRecordIndex })).filter(row => row && MARKETER_DIMENSIONS.some(d => d.key === row.dimension) && str(row.claim)).slice(0, 8).map(row => {
      const basis = jd.marketerEvidenceVersion >= 2 ? currentBasis(row, sourceText) : 'unlocated';
      return { ...row, claim: str(row.claim), basis, stage: basis === 'unlocated' ? 'unknown' : row.stage, ownership: basis === 'unlocated' ? '' : str(row.ownership) };
    });
    const fallbacks = [
      ['conversion', jd.businessProblem || experience.context || funnel.problem || funnel.goal],
      ['targeting', jd.audienceInsight || jd.target || funnel.target],
      ['creative', jd.creative || funnel.strategy],
      ['experiment', experience.action || funnel.execution],
      ['attribution', experience.result || funnel.result],
      ['learning', experience.learning || funnel.insight || jd.nextExperiment],
    ].filter(([dimension, claim]) => str(claim) && !extracted.some(row => row.dimension === dimension)).map(([dimension, claim]) => ({ dimension, claim: str(claim), basis: 'derived', quote: '', stage: 'unknown', derivedLegacy: true }));
    const records = [...extracted, ...fallbacks].map((row, i) => ({ ...row, id: `${sourceIndex}-${i}` }));
    const workProducts = Object.fromEntries(MARKETER_WORK_PRODUCTS.map(group => [group.key, arr(jd.marketerWorkProducts?.[group.key]).map((row, sourceRowIndex) => row && ({ ...row, sourceRowIndex })).filter(Boolean).slice(0, group.limit).map(row => {
      const basis = currentBasis(row, sourceText), stage = basis === 'unlocated' ? 'unknown' : row.stage;
      const values = Object.fromEntries(group.fields.map(([field]) => [field, str(row[field]).slice(0, 600)]));
      if (basis === 'unlocated' || stage === 'planned') {
        if ('observation' in values) values.observation = '';
        if (group.key === 'experiments') values.decision = '';
        if (group.key === 'operations') { values.myAction = ''; values.agreement = ''; }
      }
      if (basis === 'unlocated' && group.key === 'channels') values.budget = '';
      return { ...row, ...values, basis, stage, ownership: basis === 'unlocated' ? '' : str(row.ownership) };
    }).filter(row => group.fields.some(([field]) => row[field]))]));
    const savedMetrics = arr(jd.marketerMetrics).filter(row => row && str(row.name));
    const legacyMetrics = [...arr(jd.kpis), ...(sourceIndex === 0 ? arr(kit.kpis) : []), ...(str(experience.afterMetric || experience.metric) ? [{ name: experience.metricLabel || '기존 성과 기록', value: experience.afterMetric || experience.metric }] : [])].filter(row => row && str(row.name) && str(row.value)).map(row => ({ name: row.name, actual: row.value, basis: 'derived' }));
    const metrics = (savedMetrics.length ? savedMetrics : legacyMetrics).slice(0, 5).map(row => {
      // v1 used partial excerpt matching and cross-file numbers. Never certify those as measured.
      const basis = jd.marketerEvidenceVersion >= 2 ? currentBasis(row, sourceText) : 'unlocated';
      const trusted = basis !== 'unlocated';
      return { ...row, basis, kind: METRIC_KINDS[row.kind] ? row.kind : 'unclassified', reportedValue: !trusted ? str(row.actual || row.value) : '',
        ...(!trusted ? { baseline: '', target: '', actual: '', unit: '', period: '', population: '', method: '' } : {}) };
    });
    const evidenceRows = [...records, ...Object.values(workProducts).flat(), ...metrics];
    return { id: experience.id || `mk-case-${sourceIndex}`, sourceIndex, title: str(experience.title) || `캠페인 ${sourceIndex + 1}`, records, metrics, workProducts, evidenceRows, hasWorkProducts: Object.values(workProducts).some(rows => rows.length), attributionLimit: str(jd.attributionLimit), nextExperiment: str(jd.nextExperiment) };
  });
  const records = cases.flatMap(item => item.evidenceRows);
  return { cases, legacy: !cases.some(item => item.hasWorkProducts), total: records.length,
    documented: records.filter(row => row.basis === 'source_excerpt').length, selfReported: records.filter(row => row.basis === 'self_report').length, metrics: cases.flatMap(item => item.metrics) };
}
export function buildMarketerEvidenceExportSections(sr = {}, options = {}) {
  const recordText = row => [MARKETER_DIMENSIONS.find(d => d.key === row.dimension)?.label + ' · ' + MARKETER_BASIS_LABELS[row.basis], row.claim,
    row.ownership && '내 기여: ' + row.ownership, row.userEdited && '직접 수정한 정리문 · 원문과 의미 대조 필요', row.limitation && '해석 범위: ' + row.limitation,
    ['source_excerpt', 'self_report'].includes(row.basis) && '원문: ' + row.quote + '\n출처: ' + str(row.sourceName)].filter(Boolean).join('\n');
  const metricText = row => [METRIC_KINDS[row.kind] + ' / ' + row.name, '기준: ' + (row.baseline || '미기록') + ' / 목표: ' + (row.target || '미기록') + ' / 실측: ' + (row.actual || '미확인'), row.reportedValue && '기존 수치(원문 대조 전): ' + row.reportedValue, row.period && '기간: ' + row.period, row.population && '대상·표본: ' + row.population, row.method && '측정 정의: ' + row.method, row.basis !== 'unlocated' && '원문: ' + row.quote + '\n출처: ' + str(row.sourceName), row.limitation].filter(Boolean).join('\n');
  return buildMarketerEvidenceModel(sr, options).cases.map((item, index) => {
    const files = artifactExport(sr, item);
    const sections = marketingCaseSections(item, { hasFiles: files.length > 0 });
    return { key: `core-marketer-evidence-${index}`, type: 'core', label: item.title, enabled: true,
      content: [item.title, ...item.records.filter(row => row.dimension === 'conversion').map(recordText),
        ...sections.flatMap(chapter => [chapter.label,
          ...(chapter.key === 'creative' ? files : []),
          ...(chapter.key === 'measurement' ? item.metrics.map(metricText) : []),
          ...chapter.records.map(recordText),
          ...chapter.groups.flatMap(key => {
            const group = MARKETER_WORK_PRODUCTS.find(entry => entry.key === key);
            return item.workProducts[key].map(row => [
              group.label + ' · ' + (MARKETER_STAGE_LABELS[row.stage] || '단계 확인 필요') + ' · ' + MARKETER_BASIS_LABELS[row.basis],
              ...group.fields.filter(([field]) => row[field]).map(([field, label]) => label + ': ' + row[field]),
              row.ownership && '내 기여(추출): ' + row.ownership,
              row.userEdited && '직접 수정한 정리문 · 원문과 의미 대조 필요',
              row.basis !== 'unlocated' && '원문: ' + row.quote,
              row.basis !== 'unlocated' && '출처: ' + row.sourceName,
            ].filter(Boolean).join('\n'));
          }),
          chapter.key === 'measurement' && item.attributionLimit && '성과 해석 한계: ' + item.attributionLimit,
          chapter.key === 'learning' && item.nextExperiment && !chapter.records.some(row => row.claim === item.nextExperiment) && '다음 실험: ' + item.nextExperiment,
        ]),
      ].filter(Boolean).join('\n\n'),
    };
  });
}
