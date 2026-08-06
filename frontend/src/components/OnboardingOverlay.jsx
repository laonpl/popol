import { useState, useEffect } from 'react';

const STORAGE_KEY = (key) => `fitpoly_onboarding_${key}`;
const SESSION_KEY = (key) => `fitpoly_ob_session_${key}`;

/* Hook: 페이지별 온보딩 표시 여부 관리 */
export function useOnboarding(pageKey, options = {}) {
  const [visible, setVisible] = useState(false);
  const { force = false } = options;

  useEffect(() => {
    setVisible(false);
    if (!pageKey) return undefined;
    if (force) {
      const t = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(t);
    }
    // 한 번 닫았으면 다시 띄우지 않는다.
    // 예전엔 "건너뛰기"가 sessionStorage에만 기록돼, 새 탭·다음 날마다 튜토리얼이
    // 다시 떠서 "다시 보지 않기"를 정확히 누른 사람만 벗어날 수 있었다.
    const dismissed = localStorage.getItem(STORAGE_KEY(pageKey))
      || sessionStorage.getItem(SESSION_KEY(pageKey));
    if (dismissed) return undefined;

    // 사용자가 이미 화면을 조작하기 시작했으면 끼어들지 않는다.
    // (예전엔 500ms 뒤 무조건 떠서, 클릭하려던 순간 오버레이가 덮쳤다)
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    const events = ['pointerdown', 'keydown', 'wheel'];
    events.forEach(e => window.addEventListener(e, cancel, { once: true, passive: true }));

    const t = setTimeout(() => {
      if (!cancelled) setVisible(true);
    }, 900);

    return () => {
      clearTimeout(t);
      events.forEach(e => window.removeEventListener(e, cancel));
    };
  }, [pageKey, force]);

  const dismiss = (permanent = false) => {
    if (!pageKey) {
      setVisible(false);
      return;
    }
    // permanent 여부와 무관하게 재등장을 막는다.
    // (permanent=true 는 "다시 보지 않기"를 명시적으로 누른 경우 — 의미는 동일하게 유지)
    if (permanent) localStorage.setItem(STORAGE_KEY(pageKey), '1');
    sessionStorage.setItem(SESSION_KEY(pageKey), '1');
    localStorage.setItem(STORAGE_KEY(pageKey), '1');
    setVisible(false);
  };

  // 사용자가 직접 "튜토리얼 다시 보기"를 눌렀을 때 — 저장된 닫힘 표시를 모두 지운다
  const show = () => {
    if (pageKey) {
      sessionStorage.removeItem(SESSION_KEY(pageKey));
      localStorage.removeItem(STORAGE_KEY(pageKey));
    }
    setVisible(true);
  };

  return { visible, dismiss, show };
}
