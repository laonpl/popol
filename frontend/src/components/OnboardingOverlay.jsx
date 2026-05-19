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
    const permanent = localStorage.getItem(STORAGE_KEY(pageKey));
    const session   = sessionStorage.getItem(SESSION_KEY(pageKey));
    if (!permanent && !session) {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, [pageKey, force]);

  const dismiss = (permanent = false) => {
    if (!pageKey) {
      setVisible(false);
      return;
    }
    if (permanent) localStorage.setItem(STORAGE_KEY(pageKey), '1');
    sessionStorage.setItem(SESSION_KEY(pageKey), '1');
    setVisible(false);
  };

  const show = () => {
    if (pageKey) sessionStorage.removeItem(SESSION_KEY(pageKey));
    setVisible(true);
  };

  return { visible, dismiss, show };
}
