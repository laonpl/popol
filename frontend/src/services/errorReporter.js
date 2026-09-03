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
  // 인스타/페북 인앱 브라우저가 주입하는 네이티브 브리지 — 우리 코드가 아니고 조치 불가
  'window.webkit.messageHandlers',
  // 사용자가 화면을 벗어나 요청이 취소된 경우 (AbortError)
  'The operation was aborted',
  'signal is aborted without reason',
];

function isIgnored(message) {
  const text = String(message || '');
  return IGNORED_PATTERNS.some(p => text.includes(p));
}

// 배포 직후에는 이전 빌드의 청크 URL이 사라져 lazy import가 실패한다(사용자 화면은 백지).
// 새 빌드를 받으면 해소되므로 자동으로 한 번 새로고침하고, 그래도 실패하면 그때 실제 오류로 보고한다.
const CHUNK_ERROR_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOAD_AT_KEY = 'fitpoly:chunkReloadAt';
const RELOAD_COOLDOWN_MS = 30000;

function reloadedForChunkError(message) {
  if (!CHUNK_ERROR_PATTERN.test(String(message || ''))) return false;
  try {
    // 직전에 이미 새로고침했는데 또 실패했다면 진짜 오류 — 무한 새로고침을 막고 보고로 넘긴다.
    if (Date.now() - Number(sessionStorage.getItem(RELOAD_AT_KEY) || 0) < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
    location.reload();
    return true;
  } catch {
    // sessionStorage 사용 불가(프라이빗 모드 등) — 새로고침 없이 보고만 한다.
    return false;
  }
}

/**
 * 클라이언트 오류를 백엔드 수집 엔드포인트로 전송한다.
 * 전송 실패는 무시 — 오류 보고가 또 다른 오류를 만들지 않게 한다.
 */
export async function reportClientError({ message, stack, url, source = 'window', status, level = 'error' }) {
  try {
    if (!message) return;
    // 개발 서버(Vite HMR)의 오류는 편집 중 일시 상태가 대부분이다.
    // ('X is not defined', 모듈 재평가 실패 등 — 저장하는 순간 사라진다)
    // 운영 오류를 덮어버리므로 운영 빌드에서만 수집한다.
    if (import.meta.env.DEV) return;
    if (isIgnored(message)) return;
    if (reloadedForChunkError(message)) return;
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
