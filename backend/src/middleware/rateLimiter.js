import rateLimit from 'express-rate-limit';

/**
 * 키 생성기: x-user-id 헤더 → IP 순으로 식별
 * (게스트 모드 포함 모든 요청을 유저 단위로 제한)
 */
function keyGenerator(req) {
  return req.headers['x-user-id'] || req.ip;
}

/**
 * AI 엔드포인트 제한: 유저당 분당 최대 8회
 * 대상: /api/experience/analyze, /api/export/*, /api/job/*, /api/portfolio/validate
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1분
  max: 8,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AI 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (1분에 최대 8회)',
  },
  handler(req, res, next, options) {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.status(429).json({
      ...options.message,
      retryAfter,
    });
  },
});

/**
 * 일반 API 제한: 유저당 15분간 최대 200회
 * 과도한 자동화/스크래핑 방지
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 200,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '요청이 너무 많습니다. 15분 후 다시 시도해주세요.',
  },
});
