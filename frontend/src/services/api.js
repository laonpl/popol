import axios from 'axios';
import { auth } from '../config/firebase';
import { getApiBaseUrl } from './apiBase';
import { reportClientError } from './errorReporter';

// [주의] Vercel 배포 시 VITE_API_URL 환경변수를 빈 값으로 두어야 Vercel의 Rewrite(vercel.json)가 올바르게 작동하여 CORS 에러를 방지할 수 있습니다.
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 300000,
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
  (response) => {
    if (typeof window !== 'undefined' && !response.config?.url?.includes('/billing/wallet')) {
      window.dispatchEvent(new Event('credits:refresh'));
    }
    return response;
  },
  (error) => {
    const reqUrl = error.config?.url;
    // 오류 보고 자체의 실패가 다시 보고되지 않도록 수집 엔드포인트는 제외
    const isLogEndpoint = typeof reqUrl === 'string' && reqUrl.includes('/logs/client');

    // 네트워크 오류 (ERR_CONNECTION_REFUSED / Network Error)
    if (!error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error')) {
      const serverError = new Error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      serverError.isServerDown = true;
      console.error('API 에러: 서버 연결 실패');
      if (!isLogEndpoint) {
        reportClientError({ message: `Network Error: ${error.config?.method || ''} ${reqUrl || ''}`.trim(), source: 'api', status: 0 });
      }
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
    if (error.response?.status === 402) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('credits:depleted', {
          detail: error.response.data || {},
        }));
      }
      const creditError = new Error(error.response.data?.error || '크레딧이 부족합니다.');
      creditError.isCreditError = true;
      creditError.response = error.response;
      return Promise.reject(creditError);
    }
    const msg = error.response?.data?.error || error.response?.data?.detail || error.message || '알 수 없는 오류';
    console.error('API 에러:', msg);
    // 일부 502는 의도된 폴백(서버가 실패 시 프론트 로컬 처리로 유도) — 모니터링 노이즈가 되므로 제외
    const isHandledFallback = typeof reqUrl === 'string'
      && error.response?.status === 502
      && reqUrl.includes('/experience/draft');
    // 서버 측 오류(5xx)만 모니터링에 보고 — 4xx는 정상적인 검증/권한 실패
    if (!isLogEndpoint && !isHandledFallback && error.response?.status >= 500) {
      reportClientError({
        message: `API ${error.response.status}: ${error.config?.method || ''} ${reqUrl || ''} — ${msg}`.trim(),
        source: 'api',
        status: error.response.status,
      });
    }
    return Promise.reject(error);
  }
);

export default api;
