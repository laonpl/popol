export async function authMiddleware(req, res, next) {
  // 헤더에서 사용자 ID 읽기 (게스트 모드)
  const userId = req.headers['x-user-id'] || 'guest';
  req.user = { uid: userId, email: null };
  next();
}
