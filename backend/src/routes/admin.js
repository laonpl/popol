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

function toMs(ts) {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? null : t;
}

// 한국시간(KST) 기준 오늘 0시
function kstDayStart() {
  const kst = new Date(Date.now() + 9 * 3600000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600000);
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const round1 = (n) => Math.round(Number(n || 0) * 10) / 10;

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

// 해당 시점이 속한 주의 월요일 0시(UTC) ms
function weekStartMs(ms) {
  const d = new Date(ms);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  const m = ms - dow * DAY_MS;
  return m - (m % DAY_MS);
}

// 최근 weeks주(이번 주 포함)에 대한 주별 카운트 [{ week:'MM/DD', count }]
function weeklyTrend(msList, weeks = 8, now = Date.now()) {
  const thisWeek = weekStartMs(now);
  const starts = [];
  for (let i = weeks - 1; i >= 0; i--) starts.push(thisWeek - i * WEEK_MS);
  const map = new Map(starts.map(w => [w, 0]));
  for (const ms of msList) {
    if (ms == null) continue;
    const w = weekStartMs(ms);
    if (map.has(w)) map.set(w, map.get(w) + 1);
  }
  return starts.map(w => ({ week: new Date(w).toISOString().slice(5, 10).replace('-', '/'), count: map.get(w) }));
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(arr, q) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const b = Math.floor(pos);
  return s[b + 1] !== undefined ? s[b] + (s[b + 1] - s[b]) * (pos - b) : s[b];
}

// 로그인 (UI 게이트용 — 자격증명 확인만)
router.post('/login', (req, res) => {
  if (!isAuthorized(req.body)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  res.json({ ok: true });
});

// 단위경제성 가정치 (러프 추정용)
const USD_TO_KRW = 1350;
const PG_FEE_RATE = 0.033; // 결제 수수료 가정

// 검증 계획(IR 2주 검증)의 가설 임계값 — 프론트에서 목표 대비 표시
const GOALS = {
  activationRate: 45,   // 가입→결과물 도달
  ttvMedianMin: 15,     // 가입~첫 결과물 중앙값(분)
  csatTop2Box: 70,      // 만족(4점↑) 비율 %
  d7Retention: 20,      // 7일 재방문 %
  reuseRate: 30,        // 2회차 사용 %
  payConversion: 5,     // 페이월/주문→결제 %
  grossMargin: 60,      // 매출총이익률 %
};

// 관리자 대시보드 — IR 검증 가설(가치·결제·지속) 실측 지표 집계
router.post('/dashboard', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const now = Date.now();
    const dayStart = kstDayStart();
    const dayStartMs = dayStart.getTime();

    // ── Firebase Auth 전수 조회 — 가입·접속 지표 + uid별 가입시각 맵 ──
    const createdAtByUid = new Map();
    const createdList = [];
    let totalUsers = 0, neverSignedIn = 0, returning = 0;
    let visitsToday = 0, active7 = 0, active30 = 0;
    let newToday = 0, new7d = 0, new30d = 0;
    let pageToken;
    do {
      const page = await adminAuth.listUsers(1000, pageToken);
      for (const u of page.users) {
        totalUsers++;
        const createdMs = u.metadata?.creationTime ? new Date(u.metadata.creationTime).getTime() : null;
        const signInMs = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : null;
        if (createdMs) {
          createdAtByUid.set(u.uid, createdMs);
          createdList.push(createdMs);
          if (createdMs >= dayStartMs) newToday++;
          if (createdMs >= now - 7 * DAY_MS) new7d++;
          if (createdMs >= now - 30 * DAY_MS) new30d++;
        }
        if (!signInMs) { neverSignedIn++; continue; }
        if (createdMs && signInMs - createdMs > DAY_MS) returning++;
        if (signInMs >= dayStartMs) visitsToday++;
        if (signInMs >= now - 7 * DAY_MS) active7++;
        if (signInMs >= now - 30 * DAY_MS) active30++;
      }
      pageToken = page.pageToken;
    } while (pageToken);

    const [expSnap, walletsSnap, portfolioSnap, deletionsSnap, ordersSnap, feedbackSnap] = await Promise.all([
      adminDb.collection('experiences').get(),
      adminDb.collection('creditWallets').get(),
      adminDb.collection('portfolios').get(),
      adminDb.collection('accountDeletions').get(),
      adminDb.collection('creditOrders').get(),
      adminDb.collection('feedback').get(),
    ]);

    // ── 경험정리 ──
    const experiences = expSnap.docs.map(d => d.data());
    const expUsers = new Set(experiences.map(e => e.userId).filter(Boolean));
    const isStructured = e => e.structuredResult && typeof e.structuredResult === 'object';
    const hasExport = e => !!e.structuredResult?.exportConfig;
    const structuredExps = experiences.filter(isStructured);
    const structuredUsers = new Set(structuredExps.map(e => e.userId).filter(Boolean));
    const exportUsers = new Set(experiences.filter(hasExport).map(e => e.userId).filter(Boolean));
    const expCreatedToday = experiences.filter(e => {
      const ms = toMs(e.createdAt) || toMs(e.updatedAt);
      return ms && ms >= dayStartMs;
    }).length;

    // 유저당 경험수 분포 + 재사용률(2건 이상)
    const perUser = {};
    experiences.forEach(e => { if (e.userId) perUser[e.userId] = (perUser[e.userId] || 0) + 1; });
    const distribution = { '1개': 0, '2개': 0, '3~4개': 0, '5개+': 0 };
    Object.values(perUser).forEach(c => {
      if (c === 1) distribution['1개']++;
      else if (c === 2) distribution['2개']++;
      else if (c <= 4) distribution['3~4개']++;
      else distribution['5개+']++;
    });
    const reuseUsers = Object.values(perUser).filter(c => c >= 2).length;

    // ── 포트폴리오 ──
    const portfolios = portfolioSnap.docs.map(d => d.data());
    const pfUsers = new Set(portfolios.map(p => p.userId).filter(Boolean));
    const publicPortfolios = portfolios.filter(p => p.isPublic === true);
    const publicUsers = new Set(publicPortfolios.map(p => p.userId).filter(Boolean));

    // ── 활성화: 가입 → 결과물(포폴 생성 or 내보내기) 도달 ──
    const reachedUsers = new Set([...pfUsers, ...exportUsers]);
    const funnel = [
      { step: '가입', users: totalUsers, rate: 100 },
      { step: '경험 작성', users: expUsers.size, rate: pct(expUsers.size, totalUsers) },
      { step: 'AI 구조화', users: structuredUsers.size, rate: pct(structuredUsers.size, totalUsers) },
      { step: '결과물 도달', users: reachedUsers.size, rate: pct(reachedUsers.size, totalUsers) },
      { step: '공개/공유', users: publicUsers.size, rate: pct(publicUsers.size, totalUsers) },
    ];
    const activationRate = pct(reachedUsers.size, totalUsers);

    // ── TTV: 가입 ~ 첫 AI 구조화 경험 생성 시간(분) ──
    const firstStructuredByUid = new Map();
    for (const e of structuredExps) {
      const ms = toMs(e.createdAt) || toMs(e.updatedAt);
      if (!e.userId || ms == null) continue;
      const prev = firstStructuredByUid.get(e.userId);
      if (prev == null || ms < prev) firstStructuredByUid.set(e.userId, ms);
    }
    const ttvMinutes = [];
    for (const [uid, firstMs] of firstStructuredByUid) {
      const createdMs = createdAtByUid.get(uid);
      if (createdMs == null) continue;
      const diffMin = (firstMs - createdMs) / 60000;
      if (diffMin > 0 && diffMin < 30 * 24 * 60) ttvMinutes.push(diffMin); // 이상치 제외
    }
    const ttvBuckets = [
      { label: '≤5분', count: ttvMinutes.filter(m => m <= 5).length },
      { label: '5~15분', count: ttvMinutes.filter(m => m > 5 && m <= 15).length },
      { label: '15~60분', count: ttvMinutes.filter(m => m > 15 && m <= 60).length },
      { label: '1~24시간', count: ttvMinutes.filter(m => m > 60 && m <= 1440).length },
      { label: '1일+', count: ttvMinutes.filter(m => m > 1440).length },
    ];

    // ── 가치: CSAT (피드백 별점) ──
    const ratings = feedbackSnap.docs.map(d => Number(d.data().rating || 0)).filter(r => r >= 1 && r <= 5);
    const csatCount = ratings.length;
    const csatAvg = csatCount ? round1(ratings.reduce((s, r) => s + r, 0) / csatCount) : 0;
    const csatTop2Box = pct(ratings.filter(r => r >= 4).length, csatCount);
    const ratingDist = [1, 2, 3, 4, 5].map(star => ({ star: `${star}점`, count: ratings.filter(r => r === star).length }));

    // ── 크레딧 + 단위경제성 (트랜잭션 전수) ──
    const balance = walletsSnap.docs.reduce((s, d) => s + Number(d.data().balance || 0), 0);
    const totalCharged = walletsSnap.docs.reduce((s, d) => s + Number(d.data().totalCharged || 0), 0);
    const totalUsed = walletsSnap.docs.reduce((s, d) => s + Number(d.data().totalUsed || 0), 0);
    let todayUsed = 0, todayCharged = 0, totalUsdCost = 0, todayUsdCost = 0;
    const txSnaps = await Promise.all(walletsSnap.docs.map(d => d.ref.collection('transactions').get()));
    for (const snap of txSnaps) {
      for (const doc of snap.docs) {
        const t = doc.data();
        const amount = Number(t.amount || 0);
        const usd = Number(t.usdCost || 0);
        const ms = toMs(t.createdAt);
        totalUsdCost += usd;
        if (ms && ms >= dayStartMs) {
          if (amount < 0) todayUsed += -amount; else todayCharged += amount;
          todayUsdCost += usd;
        }
      }
    }

    // ── 결제 ──
    const orders = ordersSnap.docs.map(d => d.data());
    const paidOrders = orders.filter(o => o.status === 'paid');
    const payingUsers = new Set(paidOrders.map(o => o.uid).filter(Boolean));
    const orderUsers = new Set(orders.map(o => o.uid).filter(Boolean));
    const revenue = paidOrders.reduce((s, o) => s + Number(o.price || 0), 0);
    const byPackageMap = {};
    paidOrders.forEach(o => {
      const id = o.packageId || 'unknown';
      if (!byPackageMap[id]) byPackageMap[id] = { package: id, count: 0, revenue: 0 };
      byPackageMap[id].count++;
      byPackageMap[id].revenue += Number(o.price || 0);
    });
    const arpu = pct(revenue, totalUsers) && totalUsers ? Math.round(revenue / totalUsers) : 0;
    const arppu = payingUsers.size ? Math.round(revenue / payingUsers.size) : 0;

    // ── 단위경제성 ──
    const aiCostKrw = Math.round(totalUsdCost * USD_TO_KRW);
    const grossMargin = revenue > 0 ? round1(((revenue - aiCostKrw - revenue * PG_FEE_RATE) / revenue) * 100) : 0;
    const costPerActiveUser = active30 ? Math.round(aiCostKrw / active30) : 0;

    // ── 탈퇴 ──
    const deletions = deletionsSnap.docs.map(d => d.data());
    const deletedToday = deletions.filter(d => {
      const ms = toMs(d.deletedAt);
      return ms && ms >= dayStartMs;
    }).length;

    // ── 주차별 추세 ──
    const trends = {
      signups: weeklyTrend(createdList, 8, now),
      experiences: weeklyTrend(experiences.map(e => toMs(e.createdAt) || toMs(e.updatedAt)), 8, now),
      portfolios: weeklyTrend(portfolios.map(p => toMs(p.createdAt) || toMs(p.updatedAt)), 8, now),
    };

    res.json({
      generatedAt: new Date().toISOString(),
      goals: GOALS,
      // 오늘 요약
      today: {
        visits: visitsToday,
        signups: newToday,
        experiences: expCreatedToday,
        creditsUsed: todayUsed,
        creditsCharged: todayCharged,
        aiCostKrw: Math.round(todayUsdCost * USD_TO_KRW),
      },
      // Acquisition
      acquisition: {
        total: totalUsers,
        newToday, new7d, new30d,
        neverSignedIn,
        trend: trends.signups,
      },
      // Activation (가치 도달)
      activation: {
        funnel,
        activationRate,
        ttvMedianMin: round1(median(ttvMinutes)),
        ttvP25: round1(quantile(ttvMinutes, 0.25)),
        ttvP75: round1(quantile(ttvMinutes, 0.75)),
        ttvSample: ttvMinutes.length,
        ttvBuckets,
      },
      // 가치 (CSAT + 설문 미수집 표기)
      value: {
        csatAvg,
        csatCount,
        csatTop2Box,
        ratingDist,
        surveyAvailable: false,
        surveyPending: ['NPS', 'Sean Ellis(PMF)', 'Van Westendorp 가격', '발견가치 동의율', '체감 시간절감'],
      },
      // Retention (지속)
      retention: {
        returning,
        returningRate: pct(returning, totalUsers),
        active7, active7Rate: pct(active7, totalUsers),
        active30, active30Rate: pct(active30, totalUsers),
        reuseUsers,
        reuseRate: pct(reuseUsers, expUsers.size),
        neverSignedIn,
      },
      // Revenue (결제)
      revenue: {
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        payingUsers: payingUsers.size,
        orderUsers: orderUsers.size,
        revenue,
        arpu,
        arppu,
        payConversionSignup: pct(payingUsers.size, totalUsers),
        payConversionOrder: pct(payingUsers.size, orderUsers.size),
        byPackage: Object.values(byPackageMap),
      },
      // Referral (공유)
      referral: {
        publicPortfolios: publicPortfolios.length,
        publicUsers: publicUsers.size,
        publicRate: pct(publicUsers.size, pfUsers.size),
      },
      // NSM: 주간 완성·내보내기 포트폴리오
      nsm: {
        thisWeek: trends.portfolios[trends.portfolios.length - 1]?.count || 0,
        trend: trends.portfolios,
      },
      // 단위경제성
      unitEconomics: {
        aiCostKrw,
        aiCostUsd: round1(totalUsdCost),
        costPerActiveUser,
        revenue,
        grossMargin,
        totalCreditsUsed: totalUsed,
        feeAssumption: PG_FEE_RATE,
        usdToKrw: USD_TO_KRW,
      },
      // 경험정리 상세
      experiences: {
        total: experiences.length,
        createdToday: expCreatedToday,
        structured: structuredExps.length,
        structuredRate: pct(structuredExps.length, experiences.length),
        usersWithExperience: expUsers.size,
        writeRate: pct(expUsers.size, totalUsers),
        avgPerWriter: expUsers.size ? round1(experiences.length / expUsers.size) : 0,
        distribution,
        trend: trends.experiences,
      },
      // 크레딧
      credits: {
        balance, totalCharged, totalUsed,
        usageRate: pct(totalUsed, totalCharged),
        todayUsed, todayCharged,
      },
      portfolios: {
        total: portfolios.length,
        public: publicPortfolios.length,
      },
      churn: {
        deletedTotal: deletions.length,
        deletedToday,
        churnRate: pct(deletions.length, totalUsers + deletions.length),
      },
    });
  } catch (error) {
    next(error);
  }
});

// 오류 로그 조회 + 요약 (서버/클라이언트 통합)
router.post('/error-logs', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const limit = Math.min(Math.max(Number(req.body.limit) || 150, 1), 300);
    const source = req.body.source; // 'server' | 'client' | undefined(전체)

    // source 필터 + createdAt 정렬 복합 인덱스를 피하려고 최신순으로 넉넉히 읽어 메모리에서 필터
    const snap = await adminDb.collection('errorLogs')
      .orderBy('createdAt', 'desc')
      .limit(300)
      .get();

    const allRaw = snap.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, _ms: toMs(data.createdAt) };
    });

    const dayStartMs = kstDayStart().getTime();
    const summary = {
      total: allRaw.length,
      today: allRaw.filter(l => l._ms && l._ms >= dayStartMs).length,
      bySource: {},
      byLevel: {},
      topMessages: [],
    };
    const msgMap = {};
    allRaw.forEach(l => {
      summary.bySource[l.source] = (summary.bySource[l.source] || 0) + 1;
      summary.byLevel[l.level] = (summary.byLevel[l.level] || 0) + 1;
      const key = String(l.message || '').slice(0, 80);
      msgMap[key] = (msgMap[key] || 0) + 1;
    });
    summary.topMessages = Object.entries(msgMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([message, count]) => ({ message, count }));

    const filtered = (source === 'server' || source === 'client')
      ? allRaw.filter(l => l.source === source)
      : allRaw;

    const logs = filtered.slice(0, limit).map(l => {
      const { _ms, ...rest } = l;
      return { ...rest, createdAt: toIso(rest.createdAt) };
    });

    res.json({ logs, summary });
  } catch (error) {
    next(error);
  }
});

// 오류 로그 비우기 (최신순으로 최대 500건씩 삭제)
router.post('/error-logs/clear', async (req, res, next) => {
  try {
    if (!isAuthorized(req.body)) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    const snap = await adminDb.collection('errorLogs').limit(500).get();
    let deleted = 0;
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = adminDb.batch();
      snap.docs.slice(i, i + 450).forEach(doc => { batch.delete(doc.ref); deleted++; });
      await batch.commit();
    }
    res.json({ ok: true, deleted, hasMore: snap.size === 500 });
  } catch (error) {
    next(error);
  }
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
