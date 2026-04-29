import { Router } from 'express';
import { adminDb, adminAuth } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

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
