import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase Admin SDK 초기화 (서비스 계정 키 사용)
if (!admin.apps.length) {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    || join(__dirname, '../../serviceAccountKey.json');

  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'popol-cb20b.firebasestorage.app',
    });
    console.log('✅ Firebase Admin SDK 초기화 완료 (서비스 계정 키 사용)');
  } catch (err) {
    console.error('❌ Firebase 초기화 실패:', err.message);
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      console.error('   FIREBASE_SERVICE_ACCOUNT_JSON 환경변수의 JSON 형식을 확인하세요.');
      console.error('   특히 private_key의 \\n 이스케이프가 올바른지 확인하세요.');
    } else {
      console.error('   환경변수 FIREBASE_SERVICE_ACCOUNT_JSON 을 설정하거나');
      console.error('   backend/serviceAccountKey.json 파일을 배치하세요.');
    }
    // credentials 없이 초기화 — Firestore/Auth 호출 시 에러 발생하지만 서버는 기동
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'popol-cb20b',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'popol-cb20b.firebasestorage.app',
    });
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();
export default admin;
