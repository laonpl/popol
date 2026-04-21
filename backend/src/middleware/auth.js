import { adminAuth } from '../config/firebase.js';

/**
 * 인증 미들웨어 — Firebase Admin SDK 기반 ID Token 검증
 *
 * 클라이언트는 모든 요청에 다음 헤더를 포함해야 합니다:
 *   Authorization: Bearer <Firebase ID Token>
 *
 * 검증 성공 시 req.user = { uid, email, ... } 를 설정합니다.
 * 검증 실패 시 401/403 을 반환합니다.
 *
 * IDOR 방지: uid는 클라이언트가 임의로 조작할 수 없는
 * 서버 측 검증 값이므로, 라우트에서 userId 비교 시 안전하게 사용 가능합니다.
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // Authorization 헤더 없음
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다. 로그인 후 다시 시도해주세요.' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Firebase Admin SDK로 서버 측 토큰 검증
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
    };
    next();
  } catch (err) {
    // 토큰 만료 / 위조 / 무효
    console.warn('[Auth] 토큰 검증 실패:', err.code || err.message);
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: '인증 토큰이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(403).json({ error: '유효하지 않은 인증 토큰입니다.' });
  }
}
