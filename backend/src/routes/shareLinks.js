import { Router } from 'express';
import crypto from 'crypto';
import { adminDb } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';

/**
 * 회사별 공유 링크 — 같은 포트폴리오라도 제출처마다 다른 토큰을 발급한다.
 *
 * 링크가 하나뿐이면 "누군가 봤다"까지만 알 수 있고 "어디서 봤는지"는 알 수 없다.
 * 방문자 IP로 회사를 역추적하는 방식은 재택·모바일·공용망에서 적중률이 낮고
 * 개인정보 부담만 크므로, 사용자가 직접 라벨을 붙이는 방식을 택했다.
 *
 * 열람 이벤트 적재는 routes/analytics.js 의 공개 엔드포인트가 담당한다.
 */

const router = Router();

const MAX_LINKS_PER_PORTFOLIO = 50;

const newToken = () => crypto.randomBytes(9).toString('base64url'); // 12자

function cleanLabel(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

async function loadOwnedPortfolio(portfolioId, uid, res) {
  if (!portfolioId) {
    res.status(400).json({ error: 'portfolioId가 필요합니다.' });
    return null;
  }
  const snap = await adminDb.collection('portfolios').doc(String(portfolioId)).get();
  if (!snap.exists) {
    res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다.' });
    return null;
  }
  if (snap.data().userId !== uid) {
    res.status(403).json({ error: '접근 권한이 없습니다.' });
    return null;
  }
  return snap;
}

/** Firestore Timestamp → ISO 문자열 (프론트에서 그대로 쓰기 위함) */
const iso = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
};

function serializeLink(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    portfolioId: data.portfolioId,
    label: data.label,
    token: data.token,
    viewCount: data.viewCount || 0,
    lastViewedAt: iso(data.lastViewedAt),
    revoked: Boolean(data.revokedAt),
    createdAt: iso(data.createdAt),
  };
}

// POST /api/share-links — 제출처 라벨을 붙여 새 링크 발급
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const portfolioId = String(req.body?.portfolioId || '');
    const portfolioSnap = await loadOwnedPortfolio(portfolioId, req.user.uid, res);
    if (!portfolioSnap) return;

    const label = cleanLabel(req.body?.label);
    if (!label) return res.status(400).json({ error: '제출처 이름을 입력해주세요.' });

    const existing = await adminDb.collection('shareLinks')
      .where('portfolioId', '==', portfolioId)
      .get();
    if (existing.size >= MAX_LINKS_PER_PORTFOLIO) {
      return res.status(400).json({ error: `링크는 포트폴리오당 최대 ${MAX_LINKS_PER_PORTFOLIO}개까지 만들 수 있습니다.` });
    }

    const payload = {
      userId: req.user.uid,
      portfolioId,
      label,
      token: newToken(),
      viewCount: 0,
      lastViewedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    };
    const docRef = await adminDb.collection('shareLinks').add(payload);
    return res.status(201).json(serializeLink(await docRef.get()));
  } catch (error) {
    next(error);
  }
});

// GET /api/share-links?portfolioId=... — 해당 포트폴리오의 링크 목록
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const portfolioId = String(req.query?.portfolioId || '');
    const portfolioSnap = await loadOwnedPortfolio(portfolioId, req.user.uid, res);
    if (!portfolioSnap) return;

    const snap = await adminDb.collection('shareLinks')
      .where('portfolioId', '==', portfolioId)
      .get();
    const links = snap.docs
      .map(serializeLink)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return res.json({ links });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/share-links/:id — 라벨 수정 또는 링크 차단/해제
router.patch('/:id', authMiddleware, async (req, res, next) => {
  try {
    const docRef = adminDb.collection('shareLinks').doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
    if (snap.data().userId !== req.user.uid) return res.status(403).json({ error: '접근 권한이 없습니다.' });

    const patch = {};
    if (req.body?.label !== undefined) {
      const label = cleanLabel(req.body.label);
      if (!label) return res.status(400).json({ error: '제출처 이름을 입력해주세요.' });
      patch.label = label;
    }
    if (req.body?.revoked !== undefined) {
      patch.revokedAt = req.body.revoked ? new Date() : null;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: '변경할 내용이 없습니다.' });
    }

    await docRef.update(patch);
    return res.json(serializeLink(await docRef.get()));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/share-links/:id — 링크와 열람 기록 연결 해제 (기록 자체는 남는다)
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const docRef = adminDb.collection('shareLinks').doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
    if (snap.data().userId !== req.user.uid) return res.status(403).json({ error: '접근 권한이 없습니다.' });

    await docRef.delete();
    return res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

export default router;
