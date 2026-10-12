export const CONNECTION_KEY = 'fitpolyApplicationConnection';
export const MAX_CONNECTION_AGE = 15 * 60 * 1000;

export function senderOrigin(sender) {
  try {
    const url = new URL(sender?.url || sender?.origin || '');
    const allowed = url.protocol === 'https:' && ['fitpoly.kr', 'www.fitpoly.kr'].includes(url.hostname)
      || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    return allowed && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

export function nonceIsValid(nonce) {
  return typeof nonce === 'string' && /^[a-f0-9]{32,128}$/i.test(nonce);
}

export function expectedOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.origin === value
      ? url.origin : null;
  } catch {
    return null;
  }
}

export function connectionIsLive(connection, now = Date.now()) {
  return !!connection && nonceIsValid(connection.nonce) && !!expectedOrigin(connection.expectedOrigin)
    && typeof connection.expiresAt === 'number' && Number.isFinite(connection.expiresAt)
    && connection.expiresAt > now && connection.expiresAt <= now + MAX_CONNECTION_AGE;
}

export function createConnection(message, sender, now = Date.now()) {
  const origin = senderOrigin(sender);
  if (!origin || !nonceIsValid(message?.nonce) || !expectedOrigin(message?.expectedOrigin)
    || !Number.isFinite(message?.expiresAt) || message.expiresAt <= now
    || message.expiresAt > now + MAX_CONNECTION_AGE) return null;
  return {
    senderOrigin: origin,
    nonce: message.nonce,
    expectedOrigin: message.expectedOrigin,
    company: typeof message.company === 'string' ? message.company.trim().slice(0, 160) : '',
    position: typeof message.position === 'string' ? message.position.trim().slice(0, 160) : '',
    expiresAt: message.expiresAt,
  };
}

export function matchesConnection(connection, message, sender, now = Date.now()) {
  return connectionIsLive(connection, now) && senderOrigin(sender) === connection.senderOrigin
    && nonceIsValid(message?.nonce) && message.nonce === connection.nonce;
}

export function sanitizeCapture(capture, connection, now = Date.now()) {
  if (!connectionIsLive(connection, now) || !capture || capture.version !== 1) return null;
  let source;
  try {
    source = new URL(capture.sourceUrl);
  } catch {
    return null;
  }
  if (source.origin !== connection.expectedOrigin || source.username || source.password
    || !Array.isArray(capture.questions) || !capture.questions.length || capture.questions.length > 12) return null;
  const questions = capture.questions.map((item) => {
    if (!item || typeof item.question !== 'string' || typeof item.sourceQuote !== 'string') return null;
    const question = item.question.trim();
    const sourceQuote = item.sourceQuote.trim();
    if (question.length < 2 || question.length > 1600 || sourceQuote.length < 2 || sourceQuote.length > 2200) return null;
    const result = { question, sourceQuote };
    for (const field of ['minLength', 'maxLength']) {
      if (item[field] != null) {
        if (!Number.isInteger(item[field]) || item[field] < 1 || item[field] > 10000) return null;
        result[field] = item[field];
      }
    }
    if (result.minLength != null && result.maxLength != null && result.minLength > result.maxLength) return null;
    if (typeof item.countSpaces === 'boolean') result.countSpaces = item.countSpaces;
    return result;
  });
  if (questions.some((item) => !item)) return null;
  // Keep public posting identifiers, but never applicant/session tokens or fragments.
  const safeUrl = new URL(source.origin + source.pathname);
  const queryKeys = new Set(['rnId', 'gbn', 'ec', 'e', 'recruit_id', 'job_id']);
  for (const [key, value] of source.searchParams) {
    if (queryKeys.has(key) && /^[A-Za-z0-9_-]{1,80}$/.test(value)) safeUrl.searchParams.append(key, value);
  }
  return {
    version: 1,
    sourceUrl: safeUrl.href,
    capturedAt: new Date(now).toISOString(),
    questions,
    // Only fixed collector notices are retained, never arbitrary page text.
    warnings: Array.isArray(capture.warnings)
      ? capture.warnings.filter((item) => [
        '바이트 제한은 글자 수로 바꾸지 않았어요. 지원서의 제한을 확인해주세요.',
        '문항에 표시된 최소·최대 제한이 서로 달라요. 지원서에서 확인해주세요.',
        '긴 문항은 원문이 잘리지 않도록 자동 수집에서 제외했어요.',
        '문항은 최대 12개까지 가져와요. 추가 문항은 직접 입력해주세요.',
        '문항을 찾지 못했어요. 로그인·지원자 등록을 마친 뒤 자기소개서 문항이 보이는 작성 화면에서 다시 가져와주세요.',
      ].includes(item)).slice(0, 5)
      : [],
  };
}
