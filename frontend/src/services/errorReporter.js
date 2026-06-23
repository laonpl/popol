import { auth } from '../config/firebase';
import { getApiBaseUrl } from './apiBase';

// 같은 오류가 짧은 시간에 반복 전송되는 것을 막는 중복 억제 (키별 10초)
const lastSent = new Map();
const DEDUPE_MS = 10000;

function shouldSend(key) {
  const now = Date.now();
  const prev = lastSent.get(key);
  if (prev && now - prev < DEDUPE_MS) return false;
  lastSent.set(key, now);
  return true;
}

// 사용자 동작/브라우저 환경에서 비롯돼 코드로 고칠 수 없는 양성(benign) 오류는 보고하지 않는다.
// (모니터링 로그가 실제로 조치 가능한 오류만 담도록 노이즈를 걸러낸다.)
const IGNORED_PATTERNS = [
  // 클립보드 권한 거부 — 복사 기능은 실패해도 UX에 치명적이지 않음
  'The request is not allowed by the user agent or the platform',
  'Clipboard',
  'Document is not focused',
  // 교차 출처 스크립트의 상세 없는 일반 오류 — 조치 불가
  'Script error.',
  // 브라우저 IndexedDB 일시 장애 — 새로고침으로 해소
  'Connection to Indexed Database server lost',
  // 확장프로그램/외부 스크립트 노이즈
  'ResizeObserver loop',
];

function isIgnored(message) {
  const text = String(message || '');
  return IGNORED_PATTERNS.some(p => text.includes(p));
}

/**
 * 클라이언트 오류를 백엔드 수집 엔드포인트로 전송한다.
 * 전송 실패는 무시 — 오류 보고가 또 다른 오류를 만들지 않게 한다.
 */
export async function reportClientError({ message, stack, url, source = 'window', status, level = 'error' }) {
  try {
    if (!message) return;
    if (isIgnored(message)) return;
    const key = `${source}:${String(message).slice(0, 80)}`;
    if (!shouldSend(key)) return;

    let token = null;
    try {
      token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    } catch {
      token = null;
    }

    await fetch(`${getApiBaseUrl()}/logs/client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: String(message).slice(0, 1000),
        stack: stack ? String(stack).slice(0, 4000) : null,
        url: url || (typeof location !== 'undefined' ? location.href : null),
        source,
        status: status ?? null,
        level,
      }),
      keepalive: true,
    });
  } catch {
    // 무시
  }
}

// 전역 런타임 오류 / 처리되지 않은 Promise 거부를 수집
export function initErrorReporter() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportClientError({
      message: event.message || 'window error',
      stack: event.error?.stack,
      url: event.filename || undefined,
      source: 'window',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      message: reason?.message || (typeof reason === 'string' ? reason : 'unhandled rejection'),
      stack: reason?.stack,
      source: 'promise',
    });
  });
}
