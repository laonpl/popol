import { Router } from 'express';
import { adminDb, adminAuth } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { generalRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function countUserDocs(uid) {
  const [experiences, portfolios, jobMatches] = await Promise.all([
    adminDb.collection('experiences').where('userId', '==', uid).count().get(),
    adminDb.collection('portfolios').where('userId', '==', uid).count().get(),
    adminDb.collection('jobMatches').where('userId', '==', uid).count().get(),
  ]);
  return {
    experiences: experiences.data().count || 0,
    portfolios: portfolios.data().count || 0,
    jobMatches: jobMatches.data().count || 0,
  };
}

async function findLegacyAccountCandidates(email, currentUid) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const candidates = new Map();
  const addCandidate = (uid, source) => {
    if (!uid || uid === currentUid) return;
    if (!candidates.has(uid)) candidates.set(uid, new Set());
    candidates.get(uid).add(source);
  };

  const profileSnap = await adminDb.collection('profiles').where('email', '==', normalizedEmail).get();
  profileSnap.docs.forEach(d => addCandidate(d.id, 'profile.email'));

  const portfolioContactSnap = await adminDb.collection('portfolios').where('contact.email', '==', normalizedEmail).get();
  portfolioContactSnap.docs.forEach(d => addCandidate(d.data().userId, 'portfolio.contact.email'));

  const result = [];
  for (const [uid, sources] of candidates.entries()) {
    const counts = await countUserDocs(uid);
    const total = counts.experiences + counts.portfolios + counts.jobMatches;
    if (total > 0) {
      result.push({ uid, sources: [...sources], counts, total });
    }
  }

  return result.sort((a, b) => b.total - a.total);
}

async function reassignUserDocs(fromUid, toUid, email) {
  const collections = ['experiences', 'portfolios', 'jobMatches'];
  const totals = { experiences: 0, portfolios: 0, jobMatches: 0 };

  for (const collectionName of collections) {
    const snap = await adminDb.collection(collectionName).where('userId', '==', fromUid).get();
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = adminDb.batch();
      snap.docs.slice(i, i + 450).forEach(d => {
        batch.update(d.ref, {
          userId: toUid,
          legacyUserId: fromUid,
          recoveredByEmail: email,
          recoveredAt: new Date(),
          updatedAt: new Date(),
        });
      });
      await batch.commit();
    }
    totals[collectionName] += snap.docs.length;
  }

  const oldProfileRef = adminDb.collection('profiles').doc(fromUid);
  const newProfileRef = adminDb.collection('profiles').doc(toUid);
  const [oldProfile, newProfile] = await Promise.all([oldProfileRef.get(), newProfileRef.get()]);
  if (oldProfile.exists) {
    await newProfileRef.set({
      ...oldProfile.data(),
      ...(newProfile.exists ? newProfile.data() : {}),
      uid: toUid,
      email,
      legacyUserId: fromUid,
      recoveredAt: new Date(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  return totals;
}

router.post('/recover-data', authMiddleware, async (req, res) => {
  const currentUid = req.user.uid;
  const email = normalizeEmail(req.user.email);
  if (!email) {
    return res.json({ recovered: false, reason: 'no-email', candidates: 0 });
  }

  try {
    const candidates = await findLegacyAccountCandidates(email, currentUid);
    if (candidates.length === 0) {
      return res.json({ recovered: false, candidates: 0 });
    }

    const recovered = [];
    for (const candidate of candidates) {
      const counts = await reassignUserDocs(candidate.uid, currentUid, email);
      recovered.push({ fromUid: candidate.uid, sources: candidate.sources, counts });
    }

    res.json({ recovered: true, candidates: candidates.length, recovered });
  } catch (err) {
    console.error('[Auth] Data recovery failed:', err);
    res.status(500).json({ error: '계정 데이터 복구 중 오류가 발생했습니다.' });
  }
});

// ── 비밀번호 재설정은 Firebase 클라이언트 SDK의 sendPasswordResetEmail을 사용 ──
router.post('/reset-password', generalRateLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: '이메일을 입력해주세요.' });
  }
  return res.status(410).json({
    error: '비밀번호 재설정은 Firebase 이메일 재설정 링크 방식으로 처리됩니다.',
  });
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
