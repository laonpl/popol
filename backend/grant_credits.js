/**
 * grant_credits.js — 특정 계정에 크레딧 수동 지급 (일회용 관리 스크립트)
 *
 * 실행: backend 디렉터리에서  node grant_credits.js <email> <credits>
 */
import { adminDb, adminAuth } from './src/config/firebase.js';
import dotenv from 'dotenv';
dotenv.config();

const STARTER_CREDITS = Number(process.env.STARTER_CREDITS || 1000);

function defaultWallet(uid) {
  return {
    userId: uid,
    creditUnit: 'api-cost-v1',
    schemaVersion: 3,
    balance: STARTER_CREDITS,
    totalCharged: STARTER_CREDITS,
    totalUsed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function main() {
  const email = process.argv[2];
  const credits = Number(process.argv[3]);
  if (!email || !Number.isFinite(credits) || credits <= 0) {
    console.error('사용법: node grant_credits.js <email> <credits>');
    process.exit(1);
  }

  const user = await adminAuth.getUserByEmail(email);
  console.log(`대상 계정: ${email}  (uid: ${user.uid})`);

  const ref = adminDb.collection('creditWallets').doc(user.uid);
  let balanceAfter = 0;

  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const wallet = snap.exists ? snap.data() : defaultWallet(user.uid);
    balanceAfter = Number(wallet.balance || 0) + credits;
    tx.set(ref, {
      ...wallet,
      creditUnit: 'api-cost-v1',
      schemaVersion: 3,
      balance: balanceAfter,
      totalCharged: Number(wallet.totalCharged || 0) + credits,
      updatedAt: new Date(),
    });
    tx.set(ref.collection('transactions').doc(), {
      type: 'charge',
      schemaVersion: 3,
      amount: credits,
      balanceAfter,
      description: `${credits} 크레딧 지급 (관리자)`,
      createdAt: new Date(),
    });
  });

  console.log(`✅ ${credits} 크레딧 지급 완료. 잔액: ${balanceAfter}`);
  process.exit(0);
}

main().catch(e => { console.error('❌ 지급 실패:', e.message); process.exit(1); });
