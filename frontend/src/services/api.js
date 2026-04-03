import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
});

// 요청마다 사용자 ID 헤더 추가
api.interceptors.request.use((config) => {
  try {
    const saved = localStorage.getItem('popol_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (user?.uid) {
        config.headers['x-user-id'] = user.uid;
      }
    }
  } catch (e) { /* ignore */ }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API 에러:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;
