import axios from 'axios';
import { auth } from '../config/firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
});

/**
 * 요청마다 Firebase ID Token을 Authorization 헤더에 첨부
 *
 * 기존 x-user-id 헤더는 IDOR 취약점이 있으므로 제거.
 * Firebase Auth의 getIdToken()을 사용하면 서버 측에서 위조 불가능한
 * uid를 안전하게 검증할 수 있습니다.
 *
 * 토큰은 1시간마다 자동 갱신되므로 forceRefresh 불필요.
 */
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      // getIdToken()은 만료 시 자동으로 갱신된 토큰을 반환
      const idToken = await user.getIdToken();
      config.headers['Authorization'] = `Bearer ${idToken}`;
    }
  } catch (e) {
    console.warn('[API] 토큰 취득 실패 (비인증 요청으로 처리):', e.message);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 백엔드 서버가 실행되지 않은 경우 (ERR_CONNECTION_REFUSED / Network Error)
    if (!error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error')) {
      const serverError = new Error('백엔드 서버에 연결할 수 없습니다. start.ps1을 실행해 서버를 먼저 시작하세요.');
      serverError.isServerDown = true;
      console.error('API 에러: 백엔드 서버 미실행 (ERR_CONNECTION_REFUSED)');
      return Promise.reject(serverError);
    }
    // 인증 토큰 만료/무효 (401) — 재로그인 유도
    if (error.response?.status === 401) {
      const authError = new Error(error.response.data?.error || '인증이 필요합니다. 다시 로그인해주세요.');
      authError.isAuthError = true;
      return Promise.reject(authError);
    }
    // Rate limit 초과 (429) — retryAfter 정보를 에러에 첨부
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter;
      const msg = retryAfter
        ? `요청이 너무 많습니다. ${retryAfter}초 후 다시 시도해주세요.`
        : (error.response.data?.error || 'AI 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      const rateLimitError = new Error(msg);
      rateLimitError.isRateLimit = true;
      rateLimitError.retryAfter = retryAfter || 60;
      rateLimitError.response = error.response;
      return Promise.reject(rateLimitError);
    }
    const msg = error.response?.data?.error || error.response?.data?.detail || error.message || '알 수 없는 오류';
    console.error('API 에러:', msg);
    return Promise.reject(error);
  }
);

export default api;
