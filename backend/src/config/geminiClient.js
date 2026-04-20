import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 모델 우선순위 — 앞쪽 모델이 실패하면 순서대로 폴백.
 * gemini-2.5-flash가 기본이며, 장애/쿼터 시 2.5-pro → 2.0-flash-001 으로 내려감.
 */
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

/** SDK 에러 객체에서 HTTP 상태코드 추출 (문자열 메시지 파싱 포함). */
function extractStatus(err) {
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.response?.status === 'number') return err.response.status;
  const m = String(err?.message || '').match(/\[(\d{3})\s/);
  if (m) return parseInt(m[1], 10);
  return null;
}

/** 모델 호출을 약속(Promise)으로 감싸고 타임아웃 보호를 덧씌움. */
function callModelWithTimeout(model, prompt, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
    model.generateContent(prompt).then(
      r => { clearTimeout(timer); resolve(r.response.text()); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * 지수 백오프 재시도 + 모델간 폴백.
 * - 400(API key)은 즉시 중단.
 * - 429/TIMEOUT은 다음 모델로 즉시 전환.
 * - 500/503은 지수 백오프 후 재시도, 재시도 소진 시 다음 모델.
 * - 그 외는 다음 모델로 이동.
 */
export async function generateWithRetry(prompt, retries = 2, delayMs = 1500) {
  let lastError;
  for (const modelName of MODEL_FALLBACKS) {
    const model = genAI.getGenerativeModel({ model: modelName });
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await callModelWithTimeout(model, prompt);
      } catch (err) {
        lastError = err;
        const status = extractStatus(err);
        const msg = err?.message || '';
        console.warn(`[Gemini] ${modelName} 실패 (시도 ${attempt + 1}, status=${status}): ${msg.slice(0, 120)}`);

        if (status === 400 && (msg.includes('API key') || msg.includes('API Key'))) {
          console.error('[Gemini] API 키 오류 - 유효한 Gemini API 키를 설정하세요');
          throw err;
        }

        if (msg === 'GEMINI_TIMEOUT' || status === 429) {
          break;
        } else if (status === 503 || status === 500) {
          if (attempt < retries - 1) {
            await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }
  }
  throw lastError;
}
