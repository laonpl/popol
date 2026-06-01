/**
 * metrics_snapshot.js — 사용자 검증 지표 스냅샷 (읽기 전용)
 *
 * Firestore 전 컬렉션을 읽어 "집계 수치만" 산출한다.
 * ⚠️ 개인정보(이름/이메일/본문) 절대 출력하지 않음 — 카운트·합계·분포만.
 *
 * 실행: backend 디렉터리에서  node src/metrics_snapshot.js
 * 결과: 콘솔 출력 + metrics_snapshot.json 저장
 */
import { adminDb, adminAuth } from './config/firebase.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const NOW = Date.now();
const DAY = 86400000;

// Firebase Auth 전수 조회 → 실제 접속(로그인) 데이터
async function getAuthAccessMetrics() {
  const created = [];      // creationTime ms
  const lastSignIn = [];   // lastSignInTime ms (로그인 이력 있는 계정만)
  let total = 0, neverSignedIn = 0, returning = 0;
  let active7 = 0, active30 = 0, active1 = 0;
  let pageToken;
  do {
    const res = await adminAuth.listUsers(1000, pageToken);
    for (const u of res.users) {
      total++;
      const cMs = u.metadata?.creationTime ? new Date(u.metadata.creationTime).getTime() : null;
      const sMs = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : null;
      if (cMs) created.push(cMs);
      if (!sMs) { neverSignedIn++; continue; }
      lastSignIn.push(sMs);
      // 가입 후 하루 이상 지나 다시 로그인 = 재접속(리텐션 신호)
      if (cMs && (sMs - cMs) > DAY) returning++;
      if (sMs >= NOW - 1 * DAY) active1++;
      if (sMs >= NOW - 7 * DAY) active7++;
      if (sMs >= NOW - 30 * DAY) active30++;
    }
    pageToken = res.pageToken;
  } while (pageToken);

  // 가입 7일 이상 경과 코호트의 7일내 재접속률(러프 리텐션)
  return { total, neverSignedIn, returning, active1, active30, active7, created };
}

const toMs = (ts) => {
  if (!ts) return null;
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? null : t;
};
const weekKey = (ms) => {
  if (!ms) return 'unknown';
  const d = new Date(ms);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
};
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
const bucketByWeek = (arr, getTs) => {
  const m = {};
  for (const x of arr) { const k = weekKey(getTs(x)); m[k] = (m[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort());
};

async function getAll(name) {
  try {
    const snap = await adminDb.collection(name).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn(`  (컬렉션 ${name} 조회 실패: ${e.message})`);
    return [];
  }
}

async function main() {
  console.log('🔄 Firestore 집계 중...\n');

  const [profiles, experiences, portfolios, jobMatches, wallets, orders, waitlist, auth] = await Promise.all([
    getAll('profiles'),
    getAll('experiences'),
    getAll('portfolios'),
    getAll('jobMatches'),
    getAll('creditWallets'),
    getAll('creditOrders'),
    getAll('waitlist'),
    getAuthAccessMetrics().catch(e => { console.warn('  (Auth 조회 실패:', e.message, ')'); return null; }),
  ]);

  // ── 회원 ──
  const members = profiles.length;

  // ── 경험 ──
  const hasStructured = e => e.structuredResult && typeof e.structuredResult === 'object';
  const keyExpCount = e => Array.isArray(e.structuredResult?.keyExperiences) ? e.structuredResult.keyExperiences.length : 0;
  const hasExport = e => !!e.structuredResult?.exportConfig;
  const hasResearch = e => Array.isArray(e.structuredResult?.marketResearch?.decisionMetrics) && e.structuredResult.marketResearch.decisionMetrics.length > 0;

  const expUsers = new Set(experiences.map(e => e.userId).filter(Boolean));
  const structuredExps = experiences.filter(hasStructured);
  const structuredUsers = new Set(structuredExps.map(e => e.userId).filter(Boolean));

  // 유저당 경험 수 분포
  const perUser = {};
  experiences.forEach(e => { if (e.userId) perUser[e.userId] = (perUser[e.userId] || 0) + 1; });
  const counts = Object.values(perUser);
  const dist = { '1개': 0, '2개': 0, '3~4개': 0, '5개+': 0 };
  counts.forEach(c => { if (c === 1) dist['1개']++; else if (c === 2) dist['2개']++; else if (c <= 4) dist['3~4개']++; else dist['5개+']++; });

  // ── 포트폴리오 ──
  const pfUsers = new Set(portfolios.map(p => p.userId).filter(Boolean));
  const publicPfs = portfolios.filter(p => p.isPublic === true);
  const publicUsers = new Set(publicPfs.map(p => p.userId).filter(Boolean));
  const byTemplate = {};
  portfolios.forEach(p => { const t = p.templateId || 'notion'; byTemplate[t] = (byTemplate[t] || 0) + 1; });

  // ── 사용량(크레딧) ──
  const totalUsedSum = wallets.reduce((s, w) => s + Number(w.totalUsed || 0), 0);
  const balanceSum = wallets.reduce((s, w) => s + Number(w.balance || 0), 0);
  const usedWallets = wallets.filter(w => Number(w.totalUsed || 0) > 0).length;

  // ── 결제 ──
  const ordersByStatus = {};
  orders.forEach(o => { const s = o.status || 'unknown'; ordersByStatus[s] = (ordersByStatus[s] || 0) + 1; });
  const paidOrders = orders.filter(o => o.status === 'paid');
  const payingUsers = new Set(paidOrders.map(o => o.uid).filter(Boolean));
  const orderUsers = new Set(orders.map(o => o.uid).filter(Boolean));
  const revenue = paidOrders.reduce((s, o) => s + Number(o.price || 0), 0);
  const paidByPackage = {};
  paidOrders.forEach(o => { const p = o.packageId || 'unknown'; paidByPackage[p] = (paidByPackage[p] || 0) + 1; });

  // ── 활성화 깔때기 (회원 기준) ──
  const funnel = [
    { step: '가입(profiles)', users: members, conv: 100 },
    { step: '경험 1건+ 생성', users: expUsers.size, conv: pct(expUsers.size, members) },
    { step: 'AI 구조화 완료', users: structuredUsers.size, conv: pct(structuredUsers.size, members) },
    { step: '포트폴리오 생성', users: pfUsers.size, conv: pct(pfUsers.size, members) },
    { step: '공개 포트폴리오', users: publicUsers.size, conv: pct(publicUsers.size, members) },
    { step: '결제 주문 시도', users: orderUsers.size, conv: pct(orderUsers.size, members) },
    { step: '결제 완료', users: payingUsers.size, conv: pct(payingUsers.size, members) },
  ];

  // ── 접속률 (Firebase Auth 실데이터) ──
  const access = auth ? {
    인증계정수: auth.total,
    한번도_로그인안함: auth.neverSignedIn,
    '재접속_회원수(가입+1일후 로그인)': auth.returning,
    '재접속률_퍼센트': pct(auth.returning, auth.total),
    '최근1일_접속': auth.active1,
    '최근7일_접속': auth.active7,
    '최근30일_접속': auth.active30,
    '7일_활성접속률_퍼센트': pct(auth.active7, auth.total),
    '30일_활성접속률_퍼센트': pct(auth.active30, auth.total),
  } : '(Auth 조회 불가)';

  const report = {
    generatedAt: new Date().toISOString(),
    회원: {
      가입자수: members,
      대기자명단_waitlist: waitlist.length,
      크레딧지갑_보유: wallets.length,
    },
    접속률_Auth실데이터: access,
    경험_생성: {
      총_생성건수: experiences.length,
      생성한_회원수: expUsers.size,
      회원당_평균: members ? Math.round((experiences.length / members) * 100) / 100 : 0,
      AI구조화_완료_건수: structuredExps.length,
      AI구조화_완료율_퍼센트: pct(structuredExps.length, experiences.length),
      내보내기구성_보유_건수: experiences.filter(hasExport).length,
      시장리서치_활용_건수: experiences.filter(hasResearch).length,
      유저당_경험수_분포: dist,
    },
    포트폴리오: {
      총_생성건수: portfolios.length,
      생성한_회원수: pfUsers.size,
      공개_포트폴리오수: publicPfs.length,
      공개_회원수: publicUsers.size,
      템플릿별: byTemplate,
    },
    jobMatches_건수: jobMatches.length,
    사용량_크레딧: {
      사용중_지갑수: usedWallets,
      총_사용크레딧: totalUsedSum,
      잔여_크레딧합: balanceSum,
      지갑당_평균사용: wallets.length ? Math.round(totalUsedSum / wallets.length) : 0,
    },
    결제: {
      총_주문수: orders.length,
      상태별_주문: ordersByStatus,
      결제완료_주문수: paidOrders.length,
      결제한_회원수: payingUsers.size,
      주문시도_회원수: orderUsers.size,
      매출원_KRW: revenue,
      '결제전환_결제회원÷가입자_퍼센트': pct(payingUsers.size, members),
      '결제전환_결제÷주문시도회원_퍼센트': pct(payingUsers.size, orderUsers.size),
      결제완료_패키지별: paidByPackage,
    },
    활성화_깔때기: funnel,
    주차별_생성: {
      경험: bucketByWeek(experiences, e => toMs(e.createdAt) || toMs(e.updatedAt)),
      포트폴리오: bucketByWeek(portfolios, p => toMs(p.createdAt) || toMs(p.updatedAt)),
      결제완료: bucketByWeek(paidOrders, o => toMs(o.createdAt)),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  fs.writeFileSync('./metrics_snapshot.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('\n✅ metrics_snapshot.json 저장 완료 (집계 수치만, PII 없음)');
  process.exit(0);
}

main().catch(e => { console.error('❌ 집계 실패:', e); process.exit(1); });
