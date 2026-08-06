import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
const ALLOWED_EVENTS = new Set([
  'experience_completion_screen_viewed',
  'experience_portfolio_ready',
  'next_experience_started',
  'next_experience_draft_saved',
  'experience_candidate_detected',
  'experience_candidate_accepted',
  'experience_candidate_dismissed',
  'portfolio_skeleton_viewed',
  'portfolio_plan_created',
  'portfolio_generated_from_plan',
  'resume_task_opened',
]);

function sanitizeProperties(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const result = {};
  Object.entries(input).slice(0, 30).forEach(([key, value]) => {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) return;
    if (typeof value === 'string') result[key] = value.slice(0, 160);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'boolean') result[key] = value;
  });
  return result;
}

router.post('/event', authMiddleware, async (req, res, next) => {
  try {
    const eventName = String(req.body?.eventName || '');
    if (!ALLOWED_EVENTS.has(eventName)) {
      return res.status(400).json({ error: '지원하지 않는 제품 이벤트입니다.' });
    }
    await adminDb.collection('productEvents').add({
      eventName,
      userId: req.user.uid,
      properties: sanitizeProperties(req.body?.properties),
      clientOccurredAt: String(req.body?.clientOccurredAt || '').slice(0, 40) || null,
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    return res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
