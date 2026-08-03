import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

/**
 * 비로그인 방문자에게 앱 화면(허브)은 그대로 보여주되, 실제 기능 실행 시점에만 로그인으로 보낸다.
 * 로그인 후에는 원래 누르려던 화면으로 되돌아온다.
 */
export default function useAuthGate() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();

  const requireAuth = useCallback((action) => {
    if (user) return action?.();
    navigate('/login', { state: { from: location.pathname + location.search } });
    return undefined;
  }, [user, navigate, location.pathname, location.search]);

  return { isGuest: !user, requireAuth };
}
