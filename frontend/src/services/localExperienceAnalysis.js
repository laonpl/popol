import { buildLocalExperienceDraft } from '../utils/localExperienceDraft.js';

// Use the same persisted experience and analysis API as other intake methods.
// A created draft keeps its ID after failure; retries never create another copy.
export async function analyzeLocalExperiences({ items, jobCategory, careerStage, momentsCount = 3,
  records = {}, createExperience, analyzeExperience, onRecord = () => {},
  onProgress = () => {}, shouldStop = () => false }) {
  const nextRecords = { ...records };
  const failures = [];
  const warnings = [];
  let stopped = false;
  for (const [index, item] of items.entries()) {
    if (shouldStop()) { stopped = true; break; }
    if (nextRecords[item.id]?.status === 'complete') continue;
    let record = nextRecords[item.id];
    try {
      if (!record?.experienceId) {
        onProgress({ stage: 'saving', item, current: index + 1, total: items.length });
        const payload = buildLocalExperienceDraft(item, jobCategory, { careerStage, momentsCount });
        const experienceId = await createExperience(payload);
        if (!experienceId) throw new Error('저장된 경험 ID를 확인하지 못했어요.');
        record = { experienceId, status: 'draft' };
        nextRecords[item.id] = record;
        onRecord(item.id, record);
      }
      onProgress({ stage: 'analyzing', item, current: index + 1, total: items.length });
      // No reviewedMoments: the common parser's single candidate must not lock AI to one scene.
      const analysis = await analyzeExperience(record.experienceId, { momentsCount });
      if (analysis?._fallback || analysis?._draft || !analysis?.keyExperiences?.some(moment => moment && (moment.title || moment.action || moment.context))) {
        const issue = analysis?._analysisIssues?.find(row => row.stage === 'keyExperiences') || analysis?._analysisIssues?.[0];
        const error = new Error(issue?.message || 'AI가 핵심 경험을 반환하지 못했어요. 원문은 저장되어 있으니 다시 시도할 수 있어요.');
        error.stopBatch = issue?.stopBatch ?? true;
        throw error;
      }
      if (analysis._partial) {
        warnings.push({ id: item.id, title: item.title, message: '일부 분석이 완료되지 않았어요. 성공한 핵심 경험은 결과에서 확인할 수 있어요.' });
      }
      record = { ...record, status: 'complete' };
      nextRecords[item.id] = record;
      onRecord(item.id, record);
      if (analysis._partial && analysis._analysisIssues?.some(issue => ['CREDITS_REQUIRED', 'AI_CONFIGURATION', 'AI_RATE_LIMIT', 'AI_UNAVAILABLE'].includes(issue.code))) {
        stopped = index < items.length - 1;
        break;
      }
    } catch (error) {
      failures.push({ id: item.id, title: item.title, message: error.response?.data?.error || error.message || '분석 실패' });
      // Stop on account limits or provider outages instead of charging through the rest of the batch.
      const status = error.response?.status;
      if (error.stopBatch || error.response?.data?.stopBatch || error.isAuthError || error.isServerDown || [401, 402, 403, 429].includes(status) || status >= 500 || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
        stopped = index < items.length - 1;
        break;
      }
    }
  }
  return { records: nextRecords, failures, warnings, stopped };
}
