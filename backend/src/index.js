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

// 예상치 못한 예외 핸들러 — EADDRINUSE 같은 치명적 에러는 즉시 종료
process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[EADDRINUSE] 포트 ${err.port || PORT}가 이미 사용 중입니다. 기존 프로세스를 종료 후 다시 시작하세요.`);
    process.exit(1);
  }
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION] 처리되지 않은 Promise 거부:', reason);
});

// Render 등 리버스 프록시 뒤에서 올바른 protocol/IP 감지
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:3001', 
  'http://localhost:5173'
];
if (process.env.FRONTEND_URL) {
  // 여러 URL을 콤마로 구분해서 설정 가능: https://a.vercel.app,https://b.vercel.app
  process.env.FRONTEND_URL.split(',').forEach(u => allowedOrigins.push(u.trim()));
}
app.use(cors({
  origin: (origin, cb) => {
    // 서버 간 요청(origin=undefined) 또는 허용 목록 또는 *.vercel.app 허용
    if (!origin || allowedOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true
}));
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

const server = app.listen(PORT, () => {
  console.log(`✅ POPOL Backend 서버 실행 중 → http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[EADDRINUSE] 포트 ${PORT}가 이미 사용 중입니다. 기존 프로세스를 종료 후 다시 시작하세요.`);
    process.exit(1);
  }
  console.error('[SERVER ERROR]', err);
  process.exit(1);
});

// Windows nodemon 등에서 프로세스 종료 시 Port가 점유되는(Zombie) 현상 방지
const gracefulShutdown = (signal) => {
  console.log(`\n[${signal}] 종료 신호 수신. 포트 연결을 안전하게 해제합니다...`);
  server.close(() => {
    console.log('✅ 백엔드 서버 종료 완료. 포트 해제됨!');
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon reload signal


