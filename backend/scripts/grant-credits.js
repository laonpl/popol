// 운영용 수동 크레딧 지급 스크립트
//
//   조회(이름으로 uid 찾기):  node scripts/grant-credits.js --name 한석희
//   조회(잔액만):             node scripts/grant-credits.js --uid <uid>
//   지급:                     node scripts/grant-credits.js --uid <uid> --amount 1000 --reason "피드백 크레딧"
//   지급(이메일로):           node scripts/grant-credits.js --email a@b.com --amount 1000
//
// 지급은 지갑 balance/totalCharged 를 증가시키고 transactions 에 grant 기록을 남깁니다.
import { adminDb, adminAuth } from '../src/config/firebase.js';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function findByName(name) {
  const snap = await adminDb.collection('portfolios').where('userName', '==', name).get();
  const uids = [...new Set(snap.docs.map(d => d.data().userId).filter(Boolean))];
  const out = [];
  for (const uid of uids) {
    let email = '(이메일 조회 실패)';
    try { email = (await adminAuth.getUser(uid)).email || '(이메일 없음)'; } catch { /* ignore */ }
    out.push({ uid, email });
  }
  return out;
}

async function grant(uid, amount, reason) {
  const ref = adminDb.collection('creditWallets').doc(uid);
  let before = 0;
  let after = 0;
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const w = snap.exists ? snap.data() : null;
    before = Number(w?.balance || 0);
    after = before + amount;
    if (snap.exists) {
      tx.update(ref, {
        balance: after,
        totalCharged: Number(w.totalCharged || 0) + amount,
        updatedAt: new Date(),
      });
    } else {
      // 지갑이 없으면 가입 보너스 없이, 지급액만으로 지갑 생성
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
      type: 'grant',
      schemaVersion: 3,
      amount,
      balanceAfter: after,
      description: reason,
      createdAt: new Date(),
    });
  });
  return { before, after };
}

const name = arg('--name');
let uid = arg('--uid');
const email = arg('--email');
const amount = Number(arg('--amount') || 0);
const reason = arg('--reason') || '피드백 크레딧';

const run = async () => {
  if (email && !uid) {
    uid = (await adminAuth.getUserByEmail(email)).uid;
  }
  if (name && !uid) {
    const found = await findByName(name);
    console.log(`이름 "${name}" 후보 ${found.length}명:`);
    found.forEach(f => console.log(`  uid=${f.uid}  email=${f.email}`));
    console.log('지급하려면: node scripts/grant-credits.js --uid <uid> --amount <n>');
    return;
  }
  if (!uid) { console.error('uid / email / name 중 하나가 필요합니다.'); process.exit(1); }
  if (!amount) {
    const snap = await adminDb.collection('creditWallets').doc(uid).get();
    console.log(`uid=${uid} 현재 잔액=${snap.exists ? snap.data().balance : '(지갑 없음)'}`);
    return;
  }
  const { before, after } = await grant(uid, amount, reason);
  console.log(`✅ uid=${uid} 크레딧 ${amount} 지급 완료: ${before} → ${after} (${reason})`);
};

run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
