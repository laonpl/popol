import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import './index.css';

// 배포 후 구 청크 URL 로딩 실패 시 자동 새로고침 (1회 한정)
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('chunkReloaded')) {
    sessionStorage.setItem('chunkReloaded', '1');
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { borderRadius: '12px', padding: '12px 16px', fontSize: '14px' },
      }} />
      <Analytics />
    </BrowserRouter>
  </React.StrictMode>
);
