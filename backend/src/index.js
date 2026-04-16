import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import experienceRoutes from './routes/experience.js';

import portfolioRoutes from './routes/portfolio.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';
import jobRoutes from './routes/job.js';
import uploadRoutes from './routes/upload.js';
import { aiRateLimiter, generalRateLimiter } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 5000;

// 예상치 못한 예외로 서버가 종료되지 않도록 핸들러 등록
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION] 서버가 종료되지 않도록 오류를 기록합니다:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION] 처리되지 않은 Promise 거부:', reason);
});

// Middleware
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001', 
  'http://localhost:5173'
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 전체 API 일반 제한
app.use('/api', generalRateLimiter);

// Routes
app.use('/api/experience', experienceRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/export', aiRateLimiter, exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/job', aiRateLimiter, jobRoutes);
app.use('/api/upload', uploadRoutes);

// 업로드된 이미지 정적 서빙 (cross-origin 허용)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || '?�버 ?�류가 발생?�습?�다',
  });
});

app.listen(PORT, () => {
  console.log(`?? POPOL Backend ?�버 ?�행 �? http://localhost:${PORT}`);
});

