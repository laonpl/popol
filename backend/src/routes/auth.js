import { Router } from 'express';
import crypto from 'crypto';
import admin from '../config/firebase.js';
import { adminDb, adminAuth } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendOtpEmail } from '../services/emailService.js';

const { FieldValue } = admin.firestore;

const router = Router();

// OTP 재요청 최소 간격(초)
const OTP_RESEND_COOLDOWN = 60;
// OTP 만료 시간(분)
const OTP_EXPIRE_MINUTES = 15;
// 시간당 최대 요청 횟수
const OTP_MAX_PER_HOUR = 5;
// 최대 틀린 횟수
const OTP_MAX_ATTEMPTS = 5;

// ── OTP 발급 ─────────────────────────────────────────────
router.post('/request-otp', authMiddleware, async (req, res) => {
  try {
    const { uid, email } = req.user;

    // 이미 인증된 계정은 스킵
    const firebaseUser = await adminAuth.getUser(uid);
    if (firebaseUser.emailVerified) {
      return res.json({ alreadyVerified: true });
    }

    const now = Date.now();
    const docRef = adminDb.collection('emailOtps').doc(uid);
    const existing = await docRef.get();

    if (existing.exists) {
      const d = existing.data();
      // 재발송 쿨다운 체크
      const lastReq = d.lastRequestAt?.toMillis?.() || 0;
      if (now - lastReq < OTP_RESEND_COOLDOWN * 1000) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN * 1000 - (now - lastReq)) / 1000);
        return res.status(429).json({ error: `${wait}초 후 다시 요청하세요`, waitSeconds: wait });
      }
      // 시간당 횟수 체크
      const hourAgo = now - 60 * 60 * 1000;
      if ((d.requestCount || 0) >= OTP_MAX_PER_HOUR && lastReq > hourAgo) {
        return res.status(429).json({ error: '잠시 후 다시 시도해주세요 (1시간 최대 5회)' });
      }
    }

    // 암호학적으로 안전한 6자리 OTP 생성
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    await docRef.set({
      hashedOtp,
      email,
      expiresAt: new Date(now + OTP_EXPIRE_MINUTES * 60 * 1000),
      used: false,
      attemptCount: 0,
      requestCount: existing.exists ? FieldValue.increment(1) : 1,
      lastRequestAt: new Date(),
    }, { merge: true });

    await sendOtpEmail(email, otp);

    res.json({ sent: true, expiresInMinutes: OTP_EXPIRE_MINUTES });
  } catch (err) {
    console.error('[Auth] OTP 발급 실패:', err);
    res.status(500).json({ error: err.message || '이메일 발송에 실패했습니다' });
  }
});

// ── OTP 검증 ─────────────────────────────────────────────
router.post('/verify-otp', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const { otp } = req.body;

    if (!otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ error: '6자리 숫자 코드를 입력해주세요' });
    }

    const docRef = adminDb.collection('emailOtps').doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(400).json({ error: '인증 코드를 먼저 요청해주세요' });
    }

    const d = snap.data();

    if (d.used) {
      return res.status(400).json({ error: '이미 사용된 코드입니다. 새 코드를 요청해주세요' });
    }

    if (d.expiresAt.toDate() < new Date()) {
      return res.status(400).json({ error: '만료된 코드입니다. 새 코드를 요청해주세요', expired: true });
    }

    if ((d.attemptCount || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(400).json({ error: '시도 횟수를 초과했습니다. 새 코드를 요청해주세요', maxAttempts: true });
    }

    const inputHash = crypto.createHash('sha256').update(String(otp)).digest('hex');

    if (inputHash !== d.hashedOtp) {
      await docRef.update({ attemptCount: FieldValue.increment(1) });
      const remaining = OTP_MAX_ATTEMPTS - (d.attemptCount || 0) - 1;
      return res.status(400).json({ error: `잘못된 코드입니다 (남은 시도: ${remaining}회)` });
    }

    // 인증 성공 — 즉시 토큰 무효화
    await docRef.update({ used: true });
    await adminAuth.updateUser(uid, { emailVerified: true });

    res.json({ verified: true });
  } catch (err) {
    console.error('[Auth] OTP 검증 실패:', err);
    res.status(500).json({ error: err.message || '인증에 실패했습니다' });
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

    // 4. OTP 데이터 삭제
    batch.delete(adminDb.collection('emailOtps').doc(uid));

    await batch.commit();

    // 5. Firebase Auth 계정 삭제
    await adminAuth.deleteUser(uid);

    res.json({ deleted: true, message: '계정과 모든 데이터가 삭제되었습니다.' });
  } catch (err) {
    console.error('[Auth] 계정 삭제 실패:', err);
    res.status(500).json({ error: '계정 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.' });
  }
});

export default router;
