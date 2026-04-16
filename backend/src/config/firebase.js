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
    console.warn('⚠️ 서비스 계정 키를 찾을 수 없습니다:', keyPath);
    console.warn('   Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성');
    console.warn('   다운로드한 JSON 파일을 backend/serviceAccountKey.json 으로 저장하세요');
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'popol-cb20b',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'popol-cb20b.firebasestorage.app',
    });
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();
export default admin;
