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
import waitlistRoutes from './routes/waitlist.js';
import authRoutes from './routes/auth.js';
import { aiRateLimiter, generalRateLimiter, globalAiRateLimiter } from './middleware/rateLimiter.js';

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
  'http://localhost:5173',
  'https://www.fitpoly.kr',
  'https://fitpoly.kr'
];
if (process.env.FRONTEND_URL) {
  // 여러 URL을 콤마로 구분해서 설정 가능: https://a.vercel.app,https://b.vercel.app
  process.env.FRONTEND_URL.split(',').forEach(u => allowedOrigins.push(u.trim()));
}
app.use(cors({
  origin: (origin, cb) => {
    // 서버 간 요청(origin=undefined) 또는 명시적으로 허용된 Origin만 허용
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 요청 타임아웃: 2분 (AI 호출 포함 대기열 대기 시간 고려)
app.use('/api', (req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

// 전체 API 일반 제한
app.use('/api', generalRateLimiter);

// AI 엔드포인트: 유저별 + 글로벌 이중 제한
const aiLimiters = [globalAiRateLimiter, aiRateLimiter];

// Routes
app.use('/api/experience', experienceRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/export', ...aiLimiters, exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/job', ...aiLimiters, jobRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/auth', authRoutes);

// 업로드된 이미지 정적 서빙 (cross-origin 허용)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handler — 프로덕션에서 내부 메시지 노출 지연
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error(`[Server Error] ${status} ${req.method} ${req.path}:`, err.message || err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(status).json({
    error: isProd && status >= 500 ? '서버 오류가 발생했습니다.' : (err.message || '서버 오류가 발생했습니다.'),
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


