/**
 * credit_cost_report.js — 기능별 크레딧 사용 실측 리포트 (읽기 전용)
 *
 * creditWallets/{uid}/transactions 중 type=usage 기록을 전수 집계해
 * "기능별 평균/중앙값 크레딧, 평균 USD 원가, 모델 분포"를 산출한다.
 * 크레딧 단가·마진 검증의 기준 데이터 — docs/credit-margin-2026.md 참고.
 *
 * 실행: backend 디렉터리에서  node src/credit_cost_report.js
 * 결과: 콘솔 출력 + credit_cost_report.json 저장
 */
import { adminDb } from './config/firebase.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

function median(list) {
  if (list.length === 0) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const wallets = await adminDb.collection('creditWallets').get();
const byOp = new Map();
let totalCredits = 0;
let totalUsd = 0;
let txCount = 0;
let estimatedCount = 0;

for (const wallet of wallets.docs) {
  const txs = await wallet.ref.collection('transactions').where('type', '==', 'usage').get();
  for (const doc of txs.docs) {
    const tx = doc.data();
    const key = tx.description || tx.operation || '기타';
    const credits = Math.abs(Number(tx.amount || 0));
    const usd = Number(tx.usdCost || 0);
    const entry = byOp.get(key) || { count: 0, credits: 0, usd: 0, creditList: [], models: {} };
    entry.count++;
    entry.credits += credits;
    entry.usd += usd;
    entry.creditList.push(credits);
    for (const m of tx.models || []) entry.models[m] = (entry.models[m] || 0) + 1;
    byOp.set(key, entry);
    totalCredits += credits;
    totalUsd += usd;
    txCount++;
    if (tx.estimatedUsage) estimatedCount++;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  총_사용기록수: txCount,
  총_차감크레딧: totalCredits,
  총_AI원가_USD: +totalUsd.toFixed(4),
  사용량추정_비율_퍼센트: txCount ? +((estimatedCount / txCount) * 100).toFixed(1) : 0,
  기능별: [...byOp.entries()]
    .map(([op, e]) => ({
      기능: op,
      건수: e.count,
      평균_크레딧: Math.round(e.credits / e.count),
      중앙값_크레딧: median(e.creditList),
      최대_크레딧: Math.max(...e.creditList),
      평균_원가_USD: +(e.usd / e.count).toFixed(5),
      모델분포: e.models,
    }))
    .sort((a, b) => b.건수 - a.건수),
};

console.log(JSON.stringify(report, null, 2));
fs.writeFileSync('credit_cost_report.json', JSON.stringify(report, null, 2));
console.log('\n✓ credit_cost_report.json 저장 완료');
process.exit(0);
