import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import experienceRoutes from './routes/experience.js';
import portfolioRoutes from './routes/portfolio.js';
import coverletterRoutes from './routes/coverletter.js';
import exportRoutes from './routes/export.js';
import importRoutes from './routes/import.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '25mb' }));

// Routes
app.use('/api/experience', experienceRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/coverletter', coverletterRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || '서버 오류가 발생했습니다',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 POPOL Backend 서버 실행 중: http://localhost:${PORT}`);
});
