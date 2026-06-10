import { Router } from 'express';
import { adminDb, adminAuth } from '../config/firebase.js';

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'fitpoly';
// 실제 비밀번호는 ADMIN_PASSWORD 환경변수로 주입 (로컬은 .env, 운영은 Render 환경변수)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-via-env';

function isAuthorized(body = {}) {
  return body.username === ADMIN_USERNAME && body.password === ADMIN_PASSWORD;
}

// 트랜잭션 내에서 지갑에 크레딧을 충전한다. (호출 전 다른 읽기를 모두 끝낸 뒤 사용)
async function chargeWallet(tx, uid, amount, description) {
  const ref = adminDb.collection('creditWallets').doc(uid);
  const snap = await tx.get(ref);
  const wallet = snap.exists ? snap.data() : null;
  const before = Number(wallet?.balance || 0);
  const after = before + amount;
  if (snap.exists) {
    tx.update(ref, {
      balance: after,
      totalCharged: Number(wallet.totalCharged || 0) + amount,
      updatedAt: new Date(),
    });
  } else {
    tx.set(ref, {
      userId: uid,
      creditUnit: 'api-cost-v1',
      schemaVersion: 3,
      balance: after,
      totalCharged: amount,
      totalUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  tx.set(ref.collection('transactions').doc(), {
    type: 'charge',
    schemaVersion: 3,
    amount,
    balanceAfter: after,
    description,
    createdAt: new Date(),
  });
  return { before, after };
}

function toIso(ts) {
  return ts?.toDate?.()?.toISOString?.() || ts || null;
}

// 로그인 (UI 게이트용 — 자격증명 확인만)
router.post('/login', (req, res) => {
  if (!isAuthorized(req.body)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  res.json({ ok: true });
});

// 사용자 피드백 조회
router.post('/feedback', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const limit = Math.min(Math.max(Number(req.body.limit) || 100, 1), 200);
    const snap = await adminDb.collection('feedback')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const feedback = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt || null,
      };
    });
    res.json({ feedback });
  } catch (error) {
    next(error);
  }
});

// 이메일로 사용자의 지갑 잔액과 최근 거래내역 조회 (사용내역 파악용)
router.post('/user-lookup', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const email = String(req.body.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }

    let user;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: '해당 이메일의 계정을 찾을 수 없습니다.' });
    }

    const walletRef = adminDb.collection('creditWallets').doc(user.uid);
    const walletSnap = await walletRef.get();
    const wallet = walletSnap.exists ? walletSnap.data() : null;

    const limit = Math.min(Math.max(Number(req.body.limit) || 50, 1), 200);
    const txSnap = await walletRef.collection('transactions')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const transactions = txSnap.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, createdAt: toIso(data.createdAt) };
    });

    res.json({
      email: user.email,
      uid: user.uid,
      balance: Number(wallet?.balance || 0),
      totalCharged: Number(wallet?.totalCharged || 0),
      totalUsed: Number(wallet?.totalUsed || 0),
      transactions,
    });
  } catch (error) {
    next(error);
  }
});

// 이메일로 계정을 찾아 크레딧 충전
router.post('/grant-credits', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const email = String(req.body.email || '').trim();
    const amount = Number(req.body.amount);
    if (!email || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: '이메일과 1 이상의 크레딧 수량을 입력해주세요.' });
    }

    let user;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch {
      return res.status(404).json({ error: '해당 이메일의 계정을 찾을 수 없습니다.' });
    }

    const description = String(req.body.reason || '').trim() || '관리자 크레딧 충전';
    const { before, after } = await adminDb.runTransaction(tx =>
      chargeWallet(tx, user.uid, amount, description));

    res.json({ ok: true, email, uid: user.uid, amount, before, after });
  } catch (error) {
    next(error);
  }
});

// 충전 요청 목록 (계좌이체 입금 후 사용자가 올린 요청)
router.post('/credit-requests', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const snap = await adminDb.collection('creditRequests')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const requests = snap.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) };
    });
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

// 충전 요청 승인 → 해당 유저에게 즉시 충전 + 요청 완료 처리
router.post('/credit-requests/approve', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const id = String(req.body.id || '').trim();
    if (!id) return res.status(400).json({ error: '요청 ID가 필요합니다.' });

    const reqRef = adminDb.collection('creditRequests').doc(id);
    const result = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(reqRef);
      if (!snap.exists) {
        const error = new Error('충전 요청을 찾을 수 없습니다.');
        error.status = 404;
        throw error;
      }
      const request = snap.data();
      if (request.status !== 'pending') {
        return { skipped: true, status: request.status };
      }
      const amount = Number(request.credits || 0);
      const { before, after } = await chargeWallet(tx, request.userId, amount, `${amount} 크레딧 충전 (계좌이체)`);
      tx.update(reqRef, { status: 'done', balanceAfter: after, approvedAt: new Date(), updatedAt: new Date() });
      return { skipped: false, email: request.email, amount, before, after };
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

// 충전 요청 거절
router.post('/credit-requests/reject', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const id = String(req.body.id || '').trim();
    if (!id) return res.status(400).json({ error: '요청 ID가 필요합니다.' });
    const reqRef = adminDb.collection('creditRequests').doc(id);
    const snap = await reqRef.get();
    if (!snap.exists) return res.status(404).json({ error: '충전 요청을 찾을 수 없습니다.' });
    if (snap.data().status === 'pending') {
      await reqRef.update({ status: 'rejected', updatedAt: new Date() });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
