import { Router } from 'express';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebase.js';
import { authMiddleware } from '../middleware/auth.js';
import { publicIngestRateLimiter } from '../middleware/rateLimiter.js';

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

/* ── 공개 링크 열람 추적 ────────────────────────────────────────────
   열람자는 우리 서비스 회원이 아니다. 그래서 다음 원칙을 지킨다.
   - 원본 IP·User-Agent 문자열을 저장하지 않는다. 재방문 판별에 필요한
     최소한만 단방향 해시로 바꿔 visitorId 로 남긴다.
   - referrer 는 호스트만 남긴다 (경로·쿼리에 개인정보가 실릴 수 있다).
   - 비공개 포트폴리오는 조용히 무시한다 (존재 여부를 노출하지 않기 위해).
   원본 이벤트는 portfolios/{id}/views 하위 컬렉션에 쌓인다. 하위 컬렉션을
   쓰면 orderBy(createdAt) 만으로 조회돼 복합 색인을 만들 필요가 없다. */

const VIEW_EVENTS = new Set(['view', 'depth', 'dwell', 'project_open']);
const VIEW_HASH_SECRET = process.env.VIEW_HASH_SECRET || 'fitpoly-view-salt';
const MAX_AGGREGATE_EVENTS = 500;

function hashVisitor(portfolioId, rawId) {
  return crypto
    .createHash('sha256')
    .update(`${VIEW_HASH_SECRET}:${portfolioId}:${rawId}`)
    .digest('hex')
    .slice(0, 16);
}

function referrerHost(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.slice(0, 80) || null;
  } catch {
    return null;
  }
}

function deviceOf(userAgent) {
  const ua = String(userAgent || '');
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

const toIso = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
};

// POST /api/analytics/view — 비인증. 공개 링크 열람자가 직접 호출한다.
router.post('/view', publicIngestRateLimiter, async (req, res, next) => {
  try {
    const portfolioId = String(req.body?.portfolioId || '').slice(0, 60);
    const eventType = String(req.body?.eventType || '');
    if (!portfolioId || !VIEW_EVENTS.has(eventType)) {
      return res.status(400).json({ error: '잘못된 요청입니다.' });
    }

    const portfolioSnap = await adminDb.collection('portfolios').doc(portfolioId).get();
    // 존재하지 않거나 비공개면 조용히 무시한다.
    if (!portfolioSnap.exists || portfolioSnap.data().isPublic !== true) {
      return res.status(202).json({ accepted: false });
    }

    // 토큰이 있으면 어느 제출처에서 열렸는지까지 기록한다.
    let shareLinkRef = null;
    let shareLinkId = null;
    let linkLabel = null;
    const token = String(req.body?.token || '').slice(0, 40);
    if (token) {
      const linkSnap = await adminDb.collection('shareLinks')
        .where('token', '==', token)
        .limit(1)
        .get();
      const linkDoc = linkSnap.docs[0];
      const linkData = linkDoc?.data();
      if (linkData && linkData.portfolioId === portfolioId && !linkData.revokedAt) {
        shareLinkRef = linkDoc.ref;
        shareLinkId = linkDoc.id;
        linkLabel = linkData.label || null;
      }
    }

    const rawVisitor = String(req.body?.visitorId || '').slice(0, 64);
    const event = {
      eventType,
      shareLinkId,
      linkLabel,
      visitorId: rawVisitor ? hashVisitor(portfolioId, rawVisitor) : null,
      depth: eventType === 'depth' ? Math.min(100, Math.max(0, Number(req.body?.depth) || 0)) : null,
      seconds: eventType === 'dwell' ? Math.min(7200, Math.max(0, Number(req.body?.seconds) || 0)) : null,
      targetTitle: eventType === 'project_open' ? String(req.body?.targetTitle || '').slice(0, 80) : null,
      referrerHost: referrerHost(req.body?.referrer),
      device: deviceOf(req.get('user-agent')),
      createdAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    };

    await adminDb.collection('portfolios').doc(portfolioId).collection('views').add(event);

    // 링크 카드에 바로 보여줄 값만 링크 문서에 함께 누적한다.
    if (shareLinkRef && eventType === 'view') {
      await shareLinkRef.update({
        viewCount: FieldValue.increment(1),
        lastViewedAt: FieldValue.serverTimestamp(),
      });
    }

    return res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/portfolio/:portfolioId — 소유자용 열람 현황 집계
router.get('/portfolio/:portfolioId', authMiddleware, async (req, res, next) => {
  try {
    const { portfolioId } = req.params;
    const portfolioSnap = await adminDb.collection('portfolios').doc(portfolioId).get();
    if (!portfolioSnap.exists) return res.status(404).json({ error: '포트폴리오를 찾을 수 없습니다.' });
    if (portfolioSnap.data().userId !== req.user.uid) return res.status(403).json({ error: '접근 권한이 없습니다.' });

    const [linkSnap, viewSnap] = await Promise.all([
      adminDb.collection('shareLinks').where('portfolioId', '==', portfolioId).get(),
      adminDb.collection('portfolios').doc(portfolioId).collection('views')
        .orderBy('createdAt', 'desc')
        .limit(MAX_AGGREGATE_EVENTS)
        .get(),
    ]);

    const events = viewSnap.docs.map(doc => ({ ...doc.data(), createdAt: toIso(doc.data().createdAt) }));

    // 링크별 버킷 — 토큰 없이 열린 방문은 'direct' 로 모은다.
    const buckets = new Map();
    const bucketFor = (key, label) => {
      if (!buckets.has(key)) {
        buckets.set(key, {
          shareLinkId: key === 'direct' ? null : key,
          label,
          views: 0,
          visitors: new Set(),
          firstViewedAt: null,
          lastViewedAt: null,
          dwellTotal: 0,
          dwellSamples: 0,
          maxDepth: 0,
          projectOpens: new Map(),
        });
      }
      return buckets.get(key);
    };

    linkSnap.docs.forEach(doc => {
      const data = doc.data();
      bucketFor(doc.id, data.label || '이름 없는 링크');
    });

    const uniqueVisitors = new Set();
    events.forEach(event => {
      const key = event.shareLinkId || 'direct';
      const bucket = bucketFor(key, event.linkLabel || (key === 'direct' ? '토큰 없는 직접 방문' : '삭제된 링크'));
      if (event.visitorId) {
        bucket.visitors.add(event.visitorId);
        uniqueVisitors.add(event.visitorId);
      }
      if (event.eventType === 'view') {
        bucket.views += 1;
        // events 는 최신순이라 마지막으로 만나는 값이 가장 오래된 방문이다.
        if (!bucket.lastViewedAt) bucket.lastViewedAt = event.createdAt;
        bucket.firstViewedAt = event.createdAt;
      }
      if (event.eventType === 'dwell' && event.seconds) {
        bucket.dwellTotal += event.seconds;
        bucket.dwellSamples += 1;
      }
      if (event.eventType === 'depth' && event.depth) {
        bucket.maxDepth = Math.max(bucket.maxDepth, event.depth);
      }
      if (event.eventType === 'project_open' && event.targetTitle) {
        bucket.projectOpens.set(event.targetTitle, (bucket.projectOpens.get(event.targetTitle) || 0) + 1);
      }
    });

    const links = [...buckets.entries()].map(([key, bucket]) => {
      const linkDoc = linkSnap.docs.find(doc => doc.id === key);
      const linkData = linkDoc?.data();
      return {
        shareLinkId: bucket.shareLinkId,
        label: bucket.label,
        token: linkData?.token || null,
        revoked: Boolean(linkData?.revokedAt),
        createdAt: toIso(linkData?.createdAt),
        views: bucket.views,
        visitorCount: bucket.visitors.size,
        firstViewedAt: bucket.firstViewedAt,
        lastViewedAt: bucket.lastViewedAt,
        avgDwellSeconds: bucket.dwellSamples ? Math.round(bucket.dwellTotal / bucket.dwellSamples) : 0,
        maxDepth: bucket.maxDepth,
        topProjects: [...bucket.projectOpens.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([title, count]) => ({ title, count })),
      };
    }).sort((a, b) => b.views - a.views || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    const viewEvents = events.filter(event => event.eventType === 'view');
    const dwellEvents = events.filter(event => event.eventType === 'dwell' && event.seconds);

    return res.json({
      portfolioId,
      isPublic: portfolioSnap.data().isPublic === true,
      totals: {
        views: viewEvents.length,
        visitorCount: uniqueVisitors.size,
        avgDwellSeconds: dwellEvents.length
          ? Math.round(dwellEvents.reduce((sum, event) => sum + event.seconds, 0) / dwellEvents.length)
          : 0,
        lastViewedAt: viewEvents[0]?.createdAt || null,
        truncated: events.length >= MAX_AGGREGATE_EVENTS,
      },
      links,
      recent: viewEvents.slice(0, 30).map(event => ({
        label: event.linkLabel || '토큰 없는 직접 방문',
        device: event.device || null,
        referrerHost: event.referrerHost || null,
        createdAt: event.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
