import { buildDraftStructuredResult } from './experienceDraft.js';
import { materialPlainText } from '../../../shared/materialPlainText.mjs';

// Retain file-scoped originals separately from the user's reviewed fields for role analysis.
export function buildLocalExperienceDraft(item, jobCategory = 'common', { careerStage = 'first', momentsCount = 3 } = {}) {
  const value = key => materialPlainText(item[key]).slice(0, 8000);
  const documents = item.localDocuments || [{ path: item.sourcePaths?.[0] || '로컬 문서', text: item.sourceText || '' }];
  const originalText = documents.map(document => `--- ${String(document.path).replace(/[\r\n]/g, ' ')} ---\n${materialPlainText(document.text)}`).join('\n\n');
  if (originalText.length > 120000) throw new Error('한 경험의 원문이 12만 자를 넘어요. 자료를 나눠 정리해주세요.');
  const rawInput = [
    `경험: ${value('title')}`,
    value('period') && `기간: ${value('period')}`,
    value('role') && `역할: ${value('role')}`,
    value('context') && `S · 상황: ${value('context')}`,
    value('task') && `T · 과제: ${value('task')}`,
    value('action') && `A · 행동: ${value('action')}`,
    value('result') && `R · 결과: ${value('result')}`,
    value('learning') && `배운 점: ${value('learning')}`,
  ].filter(Boolean).join('\n');
  const content = { rawInput, '로컬 파일 원문': originalText };
  const structuredResult = buildDraftStructuredResult({
    title: value('title'), period: value('period'), jobCategory,
    collectedText: rawInput, content,
    moments: [{ title: value('title'), context: value('context'), action: value('action'),
      result: value('result'), learning: value('learning'), keywords: item.keywords || [] }],
  });
  structuredResult.projectOverview = { ...(structuredResult.projectOverview || {}), role: value('role') };
  structuredResult.framework = 'STAR';
  structuredResult.star = { situation: value('context'), task: value('task'), action: value('action'), result: value('result') };
  structuredResult.keyExperiences = structuredResult.keyExperiences.map(moment => ({ ...moment,
    framework: 'STAR', situation: value('context'), task: value('task') }));
  return {
    title: value('title'), framework: 'STAR', period: value('period'),
    category: item.category || '기타', jobCategory, careerStage, momentsCount, content, structuredResult,
    keywords: item.keywords || [], lifecycleStatus: 'needs_confirmation', analysisMode: 'local_folder',
    localSources: (item.sourcePaths || []).map(path => ({ path, type: 'local_file' })),
  };
}
