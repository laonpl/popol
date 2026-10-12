export const AI_UNAVAILABLE_MESSAGE = 'AI 서비스가 일시적으로 혼잡해 초안을 생성하지 못했습니다. 잠시 후 초안 쓰기를 다시 눌러주세요.';

/** SDK errors can carry HTTP status in fields or a JSON-encoded message. */
export function getAiErrorStatus(error) {
  const status = value => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 400 && number <= 599 ? number : null;
  };
  for (const value of [error?.status, error?.statusCode, error?.response?.status, error?.code, error?.error?.code]) {
    const code = status(value);
    if (code) return code;
  }
  const message = String(error?.message || '');
  if (message.length <= 64000) {
    try {
      const parsed = JSON.parse(message);
      const code = status(parsed?.error?.code) || status(parsed?.code);
      if (code) return code;
      if (parsed?.error?.status === 'UNAVAILABLE' || parsed?.status === 'UNAVAILABLE') return 503;
    } catch { /* Plain SDK messages are handled below. */ }
  }
  const bracketed = message.match(/\[(\d{3})\s/);
  if (bracketed) return status(bracketed[1]);
  if (error?.status === 'UNAVAILABLE' || error?.code === 'UNAVAILABLE') return 503;
  if (message === 'GEMINI_TIMEOUT') return 504;
  return null;
}

export function isTransientAiError(error) {
  return [408, 429, 500, 502, 503, 504].includes(getAiErrorStatus(error));
}

export function aiUnavailableError(cause) {
  return Object.assign(new Error(AI_UNAVAILABLE_MESSAGE, { cause }), {
    status: 503, code: 'AI_TEMPORARILY_UNAVAILABLE',
  });
}
