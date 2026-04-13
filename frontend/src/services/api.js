import axios from 'axios';
import { auth } from '../config/firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
});

// 요청마다 사용자 ID 헤더 추가
api.interceptors.request.use((config) => {
  try {
    const user = auth.currentUser;
    if (user?.uid) {
      config.headers['x-user-id'] = user.uid;
    }
  } catch (e) { /* ignore */ }
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
    const msg = error.response?.data?.error || error.response?.data?.detail || error.message || '알 수 없는 오류';
    console.error('API 에러:', msg);
    return Promise.reject(error);
  }
);

export default api;
