import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate Limit 키 생성기
 *
 * 인증 미들웨어가 Firebase ID Token을 검증한 후 req.user.uid 를 설정하므로,
 * 인증된 요청에는 uid 기반으로 제한을 적용합니다.
 * 미인증 요청(health check 등)은 IP로 폴백합니다.
 */
function keyGenerator(req) {
  return req.user?.uid || ipKeyGenerator(req);
}

// 유저당 AI 요청: 분당 30회
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
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
      error: 'AI requests are temporarily limited. Please retry shortly. (up to 30 per minute)',
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

// 공개 링크 열람 이벤트 수집: 인증이 없으므로 항상 IP 기준으로 제한한다.
// 한 명이 페이지 하나를 보는 동안 view/depth/dwell 등 10개 안팎이 발생하므로
// 같은 사무실에서 여러 명이 동시에 열어도 걸리지 않을 선으로 잡았다.
export const publicIngestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  // ipKeyGenerator 는 IP 문자열을 받는다 (req 가 아니다). IPv6 는 /56 단위로 묶인다.
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  },
});

// 글로벌 AI 보호: 전체 서버 분당 최대 80회
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
