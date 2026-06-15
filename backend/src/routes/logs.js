import { Router } from 'express';
import { adminAuth } from '../config/firebase.js';
import { logError } from '../services/errorLogger.js';

const router = Router();

// 브라우저(클라이언트)에서 발생한 오류를 수집한다.
// 비로그인 상태에서도 오류가 날 수 있으므로 인증을 강제하지 않되,
// 토큰이 있으면 사용자 정보를 함께 남긴다. (전역 rate limiter 적용됨)
router.post('/client', async (req, res) => {
  try {
    let userId = null;
    let userEmail = null;
    const authz = req.headers.authorization;
    if (authz?.startsWith('Bearer ')) {
      try {
        const decoded = await adminAuth.verifyIdToken(authz.slice(7));
        userId = decoded.uid;
        userEmail = decoded.email || null;
      } catch {
        // 토큰이 만료/무효해도 오류 로그는 익명으로 저장
      }
    }

    const body = req.body || {};
    await logError({
      source: 'client',
      level: body.level === 'warn' ? 'warn' : 'error',
      status: Number(body.status) || null,
      path: body.source || 'client', // 'window' | 'promise' | 'api'
      message: body.message,
      stack: body.stack,
      url: body.url,
      userId,
      userEmail,
      userAgent: req.get('user-agent'),
    });
  } catch {
    // 수집 실패는 무시 — 클라이언트에 영향 주지 않음
  }
  res.status(204).end();
});

export default router;
