import { Router } from 'express';
import { adminDb } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { aiRateLimiter, globalAiRateLimiter } from '../middleware/rateLimiter.js';
import { requireCredits } from '../services/billingService.js';
import { analyzeCoverLetter, generateCoverLetterAnswer, importCoverLetterQuestions, buildCoverLetterDocument, validateExperienceIds, inputError } from '../services/coverLetterService.js';
import { normalizePostingQuestions } from '../services/coverLetterEvidence.js';
import { createQuestionCatalog } from '../services/coverLetterQuestionCatalog.js';

const router = Router();
const collection = () => adminDb.collection('coverLetters');
const aiMiddleware = [authMiddleware, globalAiRateLimiter, aiRateLimiter, requireCredits];

function verifyStoredQuestions(data) {
  const sourceText = data.analysis?.questionSourceText ?? data.analysis?.sourceText ?? data.sourceText ?? '';
  const verify = question => question.source === 'posting'
    ? { ...question, validation: normalizePostingQuestions([question], sourceText).length ? 'verified' : 'unverified' }
    : question.source === 'suggested' ? { ...question, validation: 'unverified' } : question;
  const questions = (data.questions || []).map(verify);
  const analysis = data.analysis ? { ...data.analysis } : null;
  if (analysis) {
    analysis.questions = (analysis.questions || []).map(verify).filter(question => question.source === 'posting' && question.validation === 'verified');
    analysis.questionStatus = analysis.questions.length ? 'verified'
      : analysis.questionStatus === 'selection_required' ? 'selection_required' : 'unavailable';
  }
  return { ...data, questions, analysis };
}

function documentId(id) {
  if (typeof id !== 'string' || !id || id.length > 128 || /[\/]/.test(id)) throw inputError('자기소개서 ID가 올바르지 않습니다.');
  return id;
}

export function assertCoverLetterOwner(data, uid) {
  if (!data) throw inputError('자기소개서를 찾을 수 없습니다.', 404);
  if (data.userId !== uid) throw inputError('접근 권한이 없습니다.', 403);
}

async function ownedDocument(id, uid) {
  const ref = collection().doc(documentId(id));
  const snapshot = await ref.get();
  const data = snapshot.exists ? snapshot.data() : null;
  assertCoverLetterOwner(data, uid);
  return { ref, data };
}

router.post('/analyze', ...aiMiddleware, async (req, res, next) => {
  try {
    const catalog = createQuestionCatalog(adminDb);
    res.json({ analysis: await analyzeCoverLetter(req.body || {}, { lookupQuestions: payload => catalog.lookup(payload) }) });
  }
  catch (error) { next(error); }
});

router.post('/questions/import', authMiddleware, async (req, res, next) => {
  try { res.json(importCoverLetterQuestions(req.body || {})); }
  catch (error) { next(error); }
});

router.post('/generate', ...aiMiddleware, async (req, res, next) => {
  try {
    const ids = validateExperienceIds(req.body?.experienceIds ?? req.body?.question?.linkedExperienceIds);
    const snapshots = await Promise.all(ids.map(id => adminDb.collection('experiences').doc(id).get()));
    const experiences = snapshots.map((snapshot, index) => {
      if (!snapshot.exists) throw inputError('선택한 경험을 찾을 수 없습니다. 경험 목록을 새로고침해주세요.', 404);
      if (snapshot.data().userId !== req.user.uid) throw inputError('선택한 경험에 접근할 권한이 없습니다.', 403);
      return { ...snapshot.data(), id: ids[index] };
    });
    res.json(await generateCoverLetterAnswer(req.body || {}, experiences));
  } catch (error) { next(error); }
});

router.get('/list', authMiddleware, async (req, res, next) => {
  try {
    const snapshot = await collection().where('userId', '==', req.user.uid).get();
    const time = value => value?.toMillis?.() || (value?._seconds || value?.seconds || 0) * 1000;
    res.json(snapshot.docs.map(doc => verifyStoredQuestions({ ...doc.data(), id: doc.id })).sort((a, b) => time(b.updatedAt || b.createdAt) - time(a.updatedAt || a.createdAt)));
  } catch (error) { next(error); }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const document = buildCoverLetterDocument(req.body, req.user.uid);
    const ref = await collection().add(document);
    res.status(201).json(verifyStoredQuestions({ id: ref.id, ...document }));
  } catch (error) { next(error); }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { data } = await ownedDocument(req.params.id, req.user.uid);
    res.json(verifyStoredQuestions({ ...data, id: req.params.id }));
  } catch (error) { next(error); }
});

router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { ref, data } = await ownedDocument(req.params.id, req.user.uid);
    const document = buildCoverLetterDocument(req.body, req.user.uid, data);
    await ref.set(document);
    res.json(verifyStoredQuestions({ ...document, id: req.params.id }));
  } catch (error) { next(error); }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { ref } = await ownedDocument(req.params.id, req.user.uid);
    await ref.delete();
    res.json({ deleted: true });
  } catch (error) { next(error); }
});

export default router;
