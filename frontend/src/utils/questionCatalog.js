import { normalizeAnalysis, normalizeQuestions } from './coverLetter.js';
import { mergeApplicationQuestions } from './applicationConnector.js';

export function catalogLookupTarget(analysis) {
  if (!analysis?.sourceUrl || analysis.questionStatus === 'selection_required') return null;
  return { sourceUrl: analysis.sourceUrl,
    applicationUrl: analysis.selectedApplicationUrl || analysis.applicationUrl || analysis.sourceUrl };
}

export function mergeCatalogEntry(letter, entry) {
  if (!entry?.questions?.length || entry.questions.length > 12 || !entry.questionSourceText) throw new Error('확인된 지원서 문항이 없습니다.');
  const incoming = normalizeQuestions(entry.questions).map(q => ({ ...q, source: 'posting', validation: 'verified', importMethod: 'question_catalog' }));
  const merged = mergeApplicationQuestions(letter.questions, incoming);
  const oldExcerpts = (letter.questions || []).filter(q => q.source === 'posting' && q.validation === 'verified' && q.sourceQuote).map(q => q.sourceQuote);
  const questionSourceText = [entry.questionSourceText, oldExcerpts.length
    ? `[지원서 원문: 기존 확인 문항]\n자기소개서 문항\n${oldExcerpts.join('\n\n')}` : ''].filter(Boolean).join('\n\n');
  const analysis = normalizeAnalysis({ ...letter.analysis,
    company: letter.analysis?.company || entry.company,
    position: letter.analysis?.position || entry.position,
    questionSourceText, questions: merged.questions.filter(q => q.source === 'posting' && q.validation !== 'unverified'),
    questionStatus: 'verified', questionNotice: '해당 공고와 직무의 실제 지원서 원문을 확인한 문항입니다.',
    questionCatalog: { status: 'verified', id: entry.id, verifiedAt: entry.verifiedAt, expiresAt: entry.expiresAt },
    sources: [...(letter.analysis?.sources || []).filter(s => s.id !== 'question-catalog'),
      { id: 'question-catalog', title: '확인한 실제 지원서 문항', url: entry.sourceEvidenceUrl, type: 'posting' }],
  });
  return { ...letter, analysis, targetCompany: letter.targetCompany || entry.company,
    targetPosition: letter.targetPosition || entry.position, questions: merged.questions, status: 'draft' };
}
