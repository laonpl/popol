import axios from 'axios';
import { auth } from '../config/firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
});

/**
 * 요청마다 Firebase ID Token을 Authorization 헤더에 첨부
 *
 * 토큰은 인메모리에 캐시하여 매 요청마다 Firebase SDK를 호출하지 않음.
 * 만료 5분 전부터 강제 갱신 → 실질적으로 새 토큰 발급은 ~55분 간격.
 */
let _tokenCache = { value: null, exp: 0 };

async function getToken(user) {
  const now = Date.now() / 1000;
  // 만료까지 5분 이상 남아 있으면 캐시 재사용
  if (_tokenCache.value && _tokenCache.exp - now > 300) {
    return _tokenCache.value;
  }
  const idToken = await user.getIdToken();
  try {
    // JWT payload의 exp 파싱 (외부 검증 없음 — 로컬 캐시 만료 계산 전용)
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    _tokenCache = { value: idToken, exp: payload.exp };
  } catch {
    // 파싱 실패 시 캐시 없이 반환 (다음 요청에서 재시도)
    _tokenCache = { value: null, exp: 0 };
  }
  return idToken;
}

api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      config.headers['Authorization'] = `Bearer ${await getToken(user)}`;
    }
  } catch (e) {
    console.warn('[API] 토큰 취득 실패 (비인증 요청으로 처리):', e.message);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 네트워크 오류 (ERR_CONNECTION_REFUSED / Network Error)
    if (!error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error')) {
      const serverError = new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      serverError.isServerDown = true;
      console.error('API 에러: 서버 연결 실패');
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
