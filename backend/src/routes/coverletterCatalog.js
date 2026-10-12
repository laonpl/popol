import { Router } from 'express';
import { adminAuth, adminDb } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { buildCatalogEntry, createQuestionCatalog, customerCatalogEntry } from '../services/coverLetterQuestionCatalog.js';

const router = Router();
const catalog = createQuestionCatalog(adminDb);
const DEFAULT_ADMIN_EMAIL = 'fitpoly.kr@gmail.com';

function inputError(message, status = 422) {
  return Object.assign(new Error(message), { status });
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAIL)
    .split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
}

// The common middleware intentionally exposes only UID/email. Recheck the signed
// token here so an unverified email or client supplied admin flag grants no access.
async function requireCatalogAdmin(req, res, next) {
  const header = req.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
    if (!req.user?.uid || decoded.uid !== req.user.uid || decoded.email_verified !== true
      || !email || !adminEmails().includes(email)) {
      return res.status(403).json({ error: '문항 원본 관리는 이메일 인증을 완료한 관리자만 이용할 수 있습니다.' });
    }
    next();
  } catch (_error) {
    return res.status(403).json({ error: '관리자 인증을 확인할 수 없습니다. 다시 로그인해주세요.' });
  }
}

function catalogId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw inputError('문항 원본 ID가 올바르지 않습니다.');
  }
  return value;
}

function listLimit(value) {
  if (value === undefined) return 50;
  if (typeof value !== 'string' || !/^\d{1,3}$/.test(value)) throw inputError('조회 개수는 1~100 사이 정수여야 합니다.');
  const limit = Number(value);
  if (limit < 1 || limit > 100) throw inputError('조회 개수는 1~100 사이 정수여야 합니다.');
  return limit;
}

function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw inputError('문항 원본 정보를 확인해주세요.');
  return body;
}

function assertQuestionConfirmations(body, entry) {
  const ids = body.confirmedQuestionIds;
  if (!Array.isArray(ids) || ids.length > 12 || ids.length !== entry.questions.length
    || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')
    || entry.questions.some(question => !ids.includes(question.id))) {
    throw inputError('모든 문항을 실제 지원서 원본과 대조하고 확인해주세요.');
  }
}

router.post('/lookup', authMiddleware, async (req, res, next) => {
  try {
    const body = bodyObject(req.body);
    const result = await catalog.lookup({ sourceUrl: body.sourceUrl, applicationUrl: body.applicationUrl });
    const entry = result.entry ? customerCatalogEntry(result.entry) : null;
    res.json({ status: result.status, requestId: result.requestId || null, entry, questions: entry?.questions || [] });
  } catch (error) { next(error); }
});

router.get('/admin', authMiddleware, requireCatalogAdmin, async (req, res, next) => {
  try { res.json(await catalog.list({ limit: listLimit(req.query.limit) })); }
  catch (error) { next(error); }
});

router.post('/admin/preview', authMiddleware, requireCatalogAdmin, async (req, res, next) => {
  try {
    const entry = buildCatalogEntry(bodyObject(req.body), { verifiedBy: req.user.uid, now: new Date(), preview: true });
    res.json({ entry, questions: entry.questions });
  } catch (error) { next(error); }
});

router.post('/admin/entries', authMiddleware, requireCatalogAdmin, async (req, res, next) => {
  try {
    const body = bodyObject(req.body);
    if (body.originalVerified !== true) throw inputError('실제 지원서 원본과 문항·글자 수를 대조한 뒤 등록해주세요.');
    const preview = buildCatalogEntry(body, { verifiedBy: req.user.uid, now: new Date() });
    assertQuestionConfirmations(body, preview);
    const entry = await catalog.publish(body, { verifiedBy: req.user.uid });
    res.status(201).json({ entry });
  } catch (error) { next(error); }
});

router.patch('/admin/entries/:id', authMiddleware, requireCatalogAdmin, async (req, res, next) => {
  try {
    const id = catalogId(req.params.id);
    const body = bodyObject(req.body);
    if (body.active !== false || Object.keys(body).some(key => key !== 'active')) {
      throw inputError('등록한 문항은 비활성화만 할 수 있습니다. 변경된 원본은 새로 검증해 등록해주세요.');
    }
    const entry = await catalog.setActive(id, false, { verifiedBy: req.user.uid });
    res.json({ entry });
  } catch (error) { next(error); }
});

export default router;
