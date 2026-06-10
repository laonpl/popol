/**
 * grant_ysyesol.js — ysyesol35@gmail.com 일회용 크레딧 지급
 *
 *   1) 25000원 결제 → pro 패키지 12000 (charge)
 *   2) 첫 결제 추가 보너스 5000 (grant)
 *   총 17000 크레딧
 *
 * 실행: backend 디렉터리에서  node grant_ysyesol.js
 */
import { adminDb, adminAuth } from './src/config/firebase.js';

const EMAIL = 'ysyesol35@gmail.com';

const ENTRIES = [
  { type: 'charge', amount: 12000, description: '25000 크레딧 충전 (pro 패키지, 25000원)', paymentMethod: 'card', price: 25000 },
  { type: 'grant',  amount: 5000,  description: '첫 결제 추가 보너스' },
];

async function main() {
  const user = await adminAuth.getUserByEmail(EMAIL);
  console.log(`대상 계정: ${EMAIL}  (uid: ${user.uid})`);

  const ref = adminDb.collection('creditWallets').doc(user.uid);
  let before = 0;
  let after = 0;

  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const wallet = snap.exists ? snap.data() : {
      userId: user.uid,
      creditUnit: 'api-cost-v1',
      schemaVersion: 3,
      balance: 0,
      totalCharged: 0,
      totalUsed: 0,
      createdAt: new Date(),
    };
    before = Number(wallet.balance || 0);
    after = before;
    let totalCharged = Number(wallet.totalCharged || 0);

    for (const entry of ENTRIES) {
      after += entry.amount;
      totalCharged += entry.amount;
      const txDoc = {
        type: entry.type,
        schemaVersion: 3,
        amount: entry.amount,
        balanceAfter: after,
        description: entry.description,
        createdAt: new Date(),
      };
      if (entry.paymentMethod) txDoc.paymentMethod = entry.paymentMethod;
      if (entry.price) txDoc.price = entry.price;
      tx.set(ref.collection('transactions').doc(), txDoc);
    }

    tx.set(ref, {
      ...wallet,
      creditUnit: 'api-cost-v1',
      schemaVersion: 3,
      balance: after,
      totalCharged,
      updatedAt: new Date(),
    });
  });

  console.log(`✅ 지급 완료. 잔액: ${before} → ${after} (+${after - before})`);
  process.exit(0);
}

main().catch(e => { console.error('❌ 지급 실패:', e.message); process.exit(1); });
