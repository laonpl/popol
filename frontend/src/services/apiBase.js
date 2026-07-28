export function getApiBaseUrl() {
  // 운영 브라우저는 Vercel의 동일 출처 프록시를 사용한다.
  // Render 직접 호출에서 생기는 CORS·콜드 스타트 네트워크 오류를 줄인다.
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'fitpoly.kr' || hostname === 'www.fitpoly.kr' || hostname.endsWith('.vercel.app')) {
      return '/api';
    }
  }

  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  return '/api';
}
