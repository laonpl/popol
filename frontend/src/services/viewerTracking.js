/**
 * viewerTracking — 공개 링크(/p/:id)를 연 사람의 열람 행동을 기록한다.
 *
 * 열람자는 우리 서비스 회원이 아니다. 그래서 신원을 알 수 있는 값은 보내지 않는다.
 * 보내는 것은 방문 식별자(브라우저에만 저장되는 난수, 서버에서 다시 해시됨),
 * 스크롤 깊이, 체류 초, 열어본 프로젝트 제목뿐이다.
 * IP는 아예 전송하지 않고 서버도 원본을 저장하지 않는다.
 *
 * 제출처별 구분은 링크 토큰(?t=)으로 한다 — services 는 토큰을 그대로 전달만 하고
 * 어느 회사인지는 사용자가 붙인 라벨로 서버에서 붙인다.
 */
import { getApiBaseUrl } from './apiBase';

const ENDPOINT = `${getApiBaseUrl()}/analytics/view`;
const VISITOR_KEY = 'fitpoly-viewer-id';

/** 브라우저별 난수 ID — 재방문 판별용. 서버에서 한 번 더 해시해 저장한다. */
function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // 시크릿 모드 등 저장이 막힌 경우 — 익명 방문으로만 집계된다.
    return '';
  }
}

/* 페이지를 떠나는 중에도 유실되지 않도록 keepalive 로 보낸다.
   sendBeacon 은 쓰지 않는다 — JSON 본문이면 CORS 프리플라이트가 필요한데
   beacon 은 프리플라이트를 못 해서 교차 출처 환경에서 조용히 실패한다. */
function post(payload) {
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* 수집 실패는 열람 경험에 영향을 주지 않는다 */ });
  } catch { /* 무시 */ }
}

/**
 * 공개 페이지 열람 추적을 시작한다.
 * @returns {() => void} 정리 함수
 */
export function trackPortfolioVisit({ portfolioId, token }) {
  if (!portfolioId) return () => {};

  const base = { portfolioId, token: token || '', visitorId: visitorId() };
  const send = (eventType, extra = {}) => post({ ...base, eventType, ...extra });

  send('view', { referrer: document.referrer || '' });

  // 스크롤 깊이 — 25/50/75/100% 를 각각 한 번만
  const sentDepths = new Set();
  const onScroll = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    if (total <= 0) return;
    const pct = Math.min(100, Math.round((window.scrollY / total) * 100));
    [25, 50, 75, 100].forEach(mark => {
      if (pct >= mark && !sentDepths.has(mark)) {
        sentDepths.add(mark);
        send('depth', { depth: mark });
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 체류 시간 — 페이지를 떠날 때 한 번만. 중복 전송을 flushed 로 막는다.
  const startedAt = Date.now();
  let flushed = false;
  const flushDwell = () => {
    if (flushed) return;
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    if (seconds < 3) return;
    flushed = true;
    send('dwell', { seconds });
  };
  window.addEventListener('pagehide', flushDwell);

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pagehide', flushDwell);
    flushDwell();
  };
}

/** 프로젝트 상세를 열어봤을 때 — 어떤 경험이 실제로 읽히는지 확인용 */
export function trackProjectOpen({ portfolioId, token, title }) {
  if (!portfolioId || !title) return;
  post({
    portfolioId,
    token: token || '',
    visitorId: visitorId(),
    eventType: 'project_open',
    targetTitle: String(title).slice(0, 80),
  });
}
