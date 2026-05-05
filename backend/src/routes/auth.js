import { Router } from 'express';
import { adminDb, adminAuth } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { generalRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ── 이름+이메일 확인 후 임시 비밀번호 발급 ─────────────────────
router.post('/reset-password', generalRateLimiter, async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: '이메일과 이름을 모두 입력해주세요.' });
  }

  try {
    const userRecord = await adminAuth.getUserByEmail(email.trim());

    const storedName = (userRecord.displayName || '').trim();
    if (!storedName || storedName !== name.trim()) {
      return res.status(400).json({ error: '이메일 또는 이름이 일치하지 않습니다.' });
    }

    // 임시 비밀번호 생성 (10자리 영숫자)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 10; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    await adminAuth.updateUser(userRecord.uid, { password: tempPassword });

    return res.json({ tempPassword });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return res.status(400).json({ error: '등록되지 않은 이메일입니다.' });
    }
    console.error('[Auth] 비밀번호 초기화 실패:', err);
    return res.status(500).json({ error: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

// ── 계정 및 데이터 전체 삭제 (PIPA/GDPR 삭제권 준수) ────────────
router.delete('/account', authMiddleware, async (req, res) => {
  const { uid } = req.user;
  try {
    const batch = adminDb.batch();

    // 1. 개인 경험 데이터 삭제
    const expSnap = await adminDb.collection('experiences').where('userId', '==', uid).get();
    expSnap.docs.forEach(d => batch.delete(d.ref));

    // 2. 포트폴리오 데이터 삭제
    const portSnap = await adminDb.collection('portfolios').where('userId', '==', uid).get();
    portSnap.docs.forEach(d => batch.delete(d.ref));

    // 3. 채용 매칭 데이터 삭제
    const jobSnap = await adminDb.collection('jobMatches').where('userId', '==', uid).get();
    jobSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();

    // 4. Firebase Auth 계정 삭제
    await adminAuth.deleteUser(uid);

    res.json({ deleted: true, message: '계정과 모든 데이터가 삭제되었습니다.' });
  } catch (err) {
    console.error('[Auth] 계정 삭제 실패:', err);
    res.status(500).json({ error: '계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

export default router;
