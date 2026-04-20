import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

function keyGenerator(req) {
  return req.headers['x-user-id'] || ipKeyGenerator(req);
}

// 유저당 AI 요청: 분당 12회 (30명 동시 사용 시 유저별 충분한 여유)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (1분에 최대 12회)',
  },
  handler(req, res, next, options) {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.status(429).json({
      ...options.message,
      retryAfter,
    });
  },
});

// 일반 API: 유저당 15분간 최대 300회
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '요청이 너무 많습니다. 15분 후 다시 시도해주세요.',
  },
});

// 글로벌 AI 보호: 전체 서버 분당 최대 80회 (모든 유저 합산)
export const globalAiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  keyGenerator: () => 'global',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '서버 전체 AI 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',
  },
  handler(req, res, next, options) {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.status(429).json({
      ...options.message,
      retryAfter,
    });
  },
});
