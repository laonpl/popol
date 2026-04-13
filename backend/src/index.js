import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import experienceRoutes from './routes/experience.js';

import portfolioRoutes from './routes/portfolio.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';
import jobRoutes from './routes/job.js';
import uploadRoutes from './routes/upload.js';

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
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Routes
app.use('/api/experience', experienceRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);
app.use('/api/job', jobRoutes);
app.use('/api/upload', uploadRoutes);

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

