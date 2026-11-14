import { buildDraftStructuredResult } from './experienceDraft.js';
import { materialPlainText } from '../../../shared/materialPlainText.mjs';

export const LOCAL_SAVED_IMAGES = 6;
const IMAGE_KIND = { result: '성과', screen: '화면', diagram: '구조도', photo: '활동 사진', document: '문서', design: '디자인', other: '이미지' };

// Pictures the user kept in the card, results and core work first.
export function savedLocalImages(item) {
  const rank = image => (image.analysis.relevance === 'core' ? 0 : 1) + (image.analysis.kind === 'result' ? 0 : 0.5);
  return (item.images || []).filter(image => image.include && image.analysis).sort((a, b) => rank(a) - rank(b)).slice(0, LOCAL_SAVED_IMAGES);
}

// Retain file-scoped originals separately from the user's reviewed fields for role analysis.
export function buildLocalExperienceDraft(item, jobCategory = 'common', { careerStage = 'first', momentsCount = 3, imageUrls = {} } = {}) {
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
  const visuals = savedLocalImages(item);
  const content = { rawInput, '로컬 파일 원문': originalText,
    ...(visuals.length ? { '문서 속 이미지 분석': visuals.map((image, index) => `[이미지 ${index + 1} · ${IMAGE_KIND[image.analysis.kind] || '이미지'} · ${String(image.path).replace(/[\r\n]/g, ' ')}${image.context ? ` · ${image.context}` : ''}] ${image.analysis.caption}${image.analysis.description ? ` — ${image.analysis.description}` : ''}${image.analysis.text ? ` / 보이는 글자: ${image.analysis.text}` : ''}`).join('\n') } : {}) };
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
  const images = visuals.filter(image => imageUrls[image.id]).map(image => ({ url: imageUrls[image.id], name: String(image.path).split('/').at(-1),
    caption: image.analysis.caption || '', description: image.analysis.description || '', text: image.analysis.text || '',
    kind: image.analysis.kind, source: image.path, localImage: true }));
  return {
    title: value('title'), framework: 'STAR', period: value('period'),
    category: item.category || '기타', jobCategory, careerStage, momentsCount, content, structuredResult,
    keywords: item.keywords || [], lifecycleStatus: 'needs_confirmation', analysisMode: 'local_folder',
    localSources: (item.sourcePaths || []).map(path => ({ path, type: 'local_file' })),
    ...(images.length ? { images } : {}),
  };
}
