import axios from 'axios';
import { auth } from '../config/firebase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
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
    const msg = error.response?.data?.error || error.response?.data?.detail || error.message || '알 수 없는 오류';
    console.error('API 에러:', msg);
    return Promise.reject(error);
  }
);

export default api;
