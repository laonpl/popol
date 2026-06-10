import { Router } from 'express';
import { adminDb } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { grantFeedbackReward } from '../services/billingService.js';

const router = Router();
const DEFAULT_ADMIN_EMAIL = 'fitpoly.kr@gmail.com';

function adminEmails() {
  const configured = process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL;
  return configured
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(email) {
  return !!email && adminEmails().includes(String(email).toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user?.email)) {
    return res.status(403).json({ error: '관리자만 확인할 수 있습니다.' });
  }
  next();
}

function cleanText(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

function serializeFeedback(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null,
  };
}

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    const feedback = cleanText(req.body.feedback, 3000);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: '별점은 1점부터 5점까지 선택해주세요.' });
    }

    if (!feedback) {
      return res.status(400).json({ error: '피드백 내용을 입력해주세요.' });
    }

    const now = new Date();
    const docRef = await adminDb.collection('feedback').add({
      userId: req.user.uid,
      userEmail: req.user.email || '',
      rating,
      feedback,
      context: cleanText(req.body.context || 'experience_complete', 120),
      experienceId: cleanText(req.body.experienceId, 160),
      sourcePath: cleanText(req.body.sourcePath, 500),
      userAgent: cleanText(req.get('user-agent'), 500),
      createdAt: now,
      updatedAt: now,
    });

    // 피드백 작성 보상 지급 (사용자당 1회). 실패해도 피드백 저장은 유지한다.
    let reward = { granted: false, amount: 0 };
    try {
      reward = await grantFeedbackReward(req.user.uid);
    } catch (rewardError) {
      console.error('[Feedback] 보상 지급 실패:', rewardError.message);
    }

    res.status(201).json({ success: true, id: docRef.id, reward });
  } catch (error) {
    next(error);
  }
});

router.get('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    const snap = await adminDb.collection('feedback')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    res.json({ feedback: snap.docs.map(serializeFeedback) });
  } catch (error) {
    next(error);
  }
});

export default router;
