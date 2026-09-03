import { adminDb } from '../config/firebase.js';

const MAX_MESSAGE = 1000;
const MAX_STACK = 4000;
const MAX_UA = 400;

function trim(value, max) {
  if (value == null) return null;
  return String(value).slice(0, max);
}

/**
 * 서비스 운영 중 발생한 오류를 Firestore `errorLogs`에 적재한다.
 * 모니터링이 본 흐름을 막지 않도록 best-effort(실패해도 무시)로 동작한다.
 */
export async function logError(entry = {}) {
  try {
    // /admin 오류 로그는 운영 모니터링용이다. 로컬 개발 중 발생한 오류(편집 중 일시 상태,
    // 로컬 전용 도구 실패 등)까지 쌓이면 실제 사용자 오류가 묻힌다. 콘솔에만 남긴다.
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[errorLogger:dev] ${entry.method || ''} ${entry.path || ''} ${entry.message || ''}`.trim());
      return;
    }
    await adminDb.collection('errorLogs').add({
      source: entry.source || 'server',        // 'server' | 'client'
      level: entry.level === 'warn' ? 'warn' : 'error',
      status: Number.isFinite(entry.status) ? entry.status : null,
      method: trim(entry.method, 10),
      path: trim(entry.path, 300),
      message: trim(entry.message, MAX_MESSAGE) || '(메시지 없음)',
      stack: trim(entry.stack, MAX_STACK),
      userId: trim(entry.userId, 128),
      userEmail: trim(entry.userEmail, 200),
      userAgent: trim(entry.userAgent, MAX_UA),
      url: trim(entry.url, 500),
      createdAt: new Date(),
    });
  } catch (err) {
    // 로깅 실패가 추가 오류를 만들지 않도록 콘솔에만 남긴다.
    console.error('[errorLogger] 오류 로그 저장 실패:', err.message);
  }
}
