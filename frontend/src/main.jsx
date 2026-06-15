import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';
import { initErrorReporter } from './services/errorReporter';

// 배포 후 구 청크 URL 로딩 실패 시 자동 새로고침 (1회 한정)
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunkReloaded')) {
    sessionStorage.setItem('chunkReloaded', '1');
    window.location.reload();
  }
});

// 전역 클라이언트 오류 모니터링 — 관리자 페이지에서 확인
initErrorReporter();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" toastOptions={{
      duration: 3000,
      style: { borderRadius: '12px', padding: '12px 16px', fontSize: '14px' },
      loading: { duration: Infinity },
    }} />
    <Analytics />
  </React.StrictMode>
);
