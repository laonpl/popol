import { Router } from 'express';
import crypto from 'crypto';
import admin from '../config/firebase.js';
import { adminDb, adminAuth } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendOtpEmail } from '../services/emailService.js';

const { FieldValue } = admin.firestore;

const router = Router();

// ── 회원가입 전용 OTP 발급 (인증 불필요) ───────────────────────
router.post('/signup-request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: '올바른 이메일을 입력해주세요' });
    }

    // 이미 Firebase Auth에 존재하는 이메일인지 확인
    try {
      await adminAuth.getUserByEmail(email);
      // 존재하면 이미 가입된 이메일
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다' });
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      // user-not-found → 새 이메일, 계속 진행
    }

    const now = Date.now();
    // 임시 키: 이메일 기반 (uid 없으므로)
    const tempKey = 'signup_' + Buffer.from(email.toLowerCase()).toString('base64');
    const docRef = adminDb.collection('emailOtps').doc(tempKey);
    const existing = await docRef.get();
    const prevData = existing.exists ? existing.data() : null;

    const hourAgo = now - 60 * 60 * 1000;
    let lastReq = 0;
    if (existing.exists) {
      const d = existing.data();
      lastReq = d.lastRequestAt?.toMillis?.() || 0;
      if (now - lastReq < OTP_RESEND_COOLDOWN * 1000) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN * 1000 - (now - lastReq)) / 1000);
        return res.status(429).json({ error: `${wait}초 후 다시 요청하세요`, waitSeconds: wait });
      }
      const countInWindow = lastReq > hourAgo ? (d.requestCount || 0) : 0;
      if (countInWindow >= OTP_MAX_PER_HOUR) {
        const wait = Math.ceil((lastReq + 60 * 60 * 1000 - now) / 1000);
        return res.status(429).json({
          error: `잠시 후 다시 시도해주세요 (1시간 최대 ${OTP_MAX_PER_HOUR}회)`,
          waitSeconds: Math.max(wait, 1),
        });
      }
    }

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    const prevCount = existing.exists ? (existing.data()?.requestCount || 0) : 0;
    const newCount = (!existing.exists || lastReq <= hourAgo) ? 1 : (prevCount + 1);

    await docRef.set({
      hashedOtp,
      email,
      expiresAt: new Date(now + OTP_EXPIRE_MINUTES * 60 * 1000),
      used: false,
      attemptCount: 0,
      requestCount: newCount,
      lastRequestAt: new Date(),
    }, { merge: true });

    // 발송 실패 시 OTP 상태를 롤백해 재시도 가능하도록 유지
    try {
      await sendOtpEmail(email, otp);
    } catch (sendErr) {
      if (prevData) {
        await docRef.set(prevData, { merge: false });
      } else {
        await docRef.delete();
      }
      throw sendErr;
    }
    
    res.json({ sent: true, expiresInMinutes: OTP_EXPIRE_MINUTES });
  } catch (err) {
    console.error('[Auth] 회원가입 OTP 발급 실패:', err);
    if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ENETUNREACH', 'EHOSTUNREACH'].includes(err.code)) {
      return res.status(503).json({ error: '이메일 서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해주세요.' });
    }
    res.status(500).json({ error: err.message || '이메일 발송에 실패했습니다' });
  }
});

// ── 회원가입 전용 OTP 검증 (인증 불필요) ───────────────────────
router.post('/signup-verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ error: '이메일과 6자리 코드를 입력해주세요' });
    }

    const tempKey = 'signup_' + Buffer.from(email.toLowerCase()).toString('base64');
    const docRef = adminDb.collection('emailOtps').doc(tempKey);
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

    // 인증 성공 — 토큰 사용 처리
    await docRef.update({ used: true });
    res.json({ verified: true });
  } catch (err) {
    console.error('[Auth] 회원가입 OTP 검증 실패:', err);
    res.status(500).json({ error: err.message || '인증에 실패했습니다' });
  }
});

// OTP 재요청 최소 간격(초)
const OTP_RESEND_COOLDOWN = Number(process.env.OTP_RESEND_COOLDOWN || 60);
// OTP 만료 시간(분)
const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 15);
// 시간당 최대 요청 횟수 (프로덕션 기본값 완화)
const OTP_MAX_PER_HOUR = Number(process.env.OTP_MAX_PER_HOUR || (process.env.NODE_ENV === 'production' ? 10 : 5));
// 최대 틀린 횟수
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);

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
    const prevData = existing.exists ? existing.data() : null;

    const hourAgo = now - 60 * 60 * 1000;
    let lastReq = 0;
    if (existing.exists) {
      const d = existing.data();
      lastReq = d.lastRequestAt?.toMillis?.() || 0;
      // 재발송 쿨다운 체크
      if (now - lastReq < OTP_RESEND_COOLDOWN * 1000) {
        const wait = Math.ceil((OTP_RESEND_COOLDOWN * 1000 - (now - lastReq)) / 1000);
        return res.status(429).json({ error: `${wait}초 후 다시 요청하세요`, waitSeconds: wait });
      }
      // 시간당 횟수 체크 — 1시간 창 기준으로 카운트 리셋
      const countInWindow = lastReq > hourAgo ? (d.requestCount || 0) : 0;
      if (countInWindow >= OTP_MAX_PER_HOUR) {
        const wait = Math.ceil((lastReq + 60 * 60 * 1000 - now) / 1000);
        return res.status(429).json({
          error: `잠시 후 다시 시도해주세요 (1시간 최대 ${OTP_MAX_PER_HOUR}회)`,
          waitSeconds: Math.max(wait, 1),
        });
      }
    }

    // 암호학적으로 안전한 6자리 OTP 생성
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    // 1시간 창이 넘었으면 카운트 리셋, 아니면 증가
    const prevCount = existing.exists ? (existing.data()?.requestCount || 0) : 0;
    const newCount = (!existing.exists || lastReq <= hourAgo) ? 1 : (prevCount + 1);
    await docRef.set({
      hashedOtp,
      email,
      expiresAt: new Date(now + OTP_EXPIRE_MINUTES * 60 * 1000),
      used: false,
      attemptCount: 0,
      requestCount: newCount,
      lastRequestAt: new Date(),
    }, { merge: true });

    // 발송 실패 시 OTP 상태를 롤백해 재시도 가능하도록 유지
    try {
      await sendOtpEmail(email, otp);
    } catch (sendErr) {
      if (prevData) {
        await docRef.set(prevData, { merge: false });
      } else {
        await docRef.delete();
      }
      throw sendErr;
    }

    res.json({ sent: true, expiresInMinutes: OTP_EXPIRE_MINUTES });
  } catch (err) {
    console.error('[Auth] OTP 발급 실패:', err);
    if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ENETUNREACH', 'EHOSTUNREACH'].includes(err.code)) {
      return res.status(503).json({ error: '이메일 서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해주세요.' });
    }
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

// ── 회원가입 완료 처리: OTP 성공 이력을 확인 후 emailVerified 확정 ──
router.post('/signup-complete', authMiddleware, async (req, res) => {
  try {
    const { uid, email } = req.user;
    if (!email) {
      return res.status(400).json({ error: '이메일 정보가 없습니다' });
    }

    const tempKey = 'signup_' + Buffer.from(email.toLowerCase()).toString('base64');
    const docRef = adminDb.collection('emailOtps').doc(tempKey);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(400).json({ error: '회원가입 인증 기록이 없습니다. 코드를 다시 인증해주세요.' });
    }

    const d = snap.data();
    if (!d.used) {
      return res.status(400).json({ error: 'OTP 인증이 완료되지 않았습니다.' });
    }

    if ((d.email || '').toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: '인증 이메일이 일치하지 않습니다.' });
    }

    await adminAuth.updateUser(uid, { emailVerified: true });
    // 재사용 방지를 위해 인증 기록 제거
    await docRef.delete();

    res.json({ verified: true });
  } catch (err) {
    console.error('[Auth] 회원가입 완료 처리 실패:', err);
    res.status(500).json({ error: err.message || '회원가입 완료 처리에 실패했습니다' });
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
