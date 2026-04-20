import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 모델 우선순위 — 앞쪽 모델이 실패하면 순서대로 폴백.
 * 2026-04 기준 현재 사용 가능한 정식/안정 모델만 사용.
 */
const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

/** SDK 에러 객체에서 HTTP 상태코드 추출 (문자열 메시지 파싱 포함). */
function extractStatus(err) {
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.response?.status === 'number') return err.response.status;
  const m = String(err?.message || '').match(/\[(\d{3})\s/);
  if (m) return parseInt(m[1], 10);
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 모델 호출을 약속(Promise)으로 감싸고 타임아웃 보호를 덧씌움. */
function callModelWithTimeout(model, prompt, timeoutMs = 90000) {
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
 *
 * 실패 유형별 전략:
 * - 400 API key: 즉시 전체 중단
 * - 404 모델없음: 다음 모델로 즉시 전환
 * - 429 쿼터초과: 같은 모델에서 더 긴 딜레이로 재시도 (3개 모델 모두 같은 키 공유)
 * - 500/503 서버과부하: 지수 백오프 재시도 후 다음 모델
 * - TIMEOUT: 짧은 딜레이 후 다음 모델
 * - 기타: 다음 모델로 전환
 */
export async function generateWithRetry(prompt, retries = 3, delayMs = 3000) {
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
        console.warn(`[Gemini] ${modelName} 실패 (시도 ${attempt + 1}/${retries}, status=${status}): ${msg.slice(0, 120)}`);

        // API 키 오류 → 즉시 전체 중단
        if (status === 400 && (msg.includes('API key') || msg.includes('API Key'))) {
          console.error('[Gemini] API 키 오류 - 유효한 Gemini API 키를 설정하세요');
          throw err;
        }

        // 모델 없음(404) → 다음 모델로 바로 이동
        if (status === 404) {
          break;
        }

        // 429 쿼터 초과 → 같은 API 키를 쓰는 다른 모델도 429일 가능성 높음
        // 재시도 간격을 길게 잡고 같은 모델에서 재시도
        if (status === 429) {
          if (attempt < retries - 1) {
            const wait = delayMs * Math.pow(2, attempt + 1); // 6s, 12s, ...
            console.warn(`[Gemini] 429 쿼터 초과 - ${wait}ms 대기 후 재시도`);
            await sleep(wait);
            continue;
          } else {
            // 재시도 소진 시 잠깐 대기 후 다음 모델
            await sleep(3000);
            break;
          }
        }

        // 500/503 서버 과부하 → 지수 백오프 후 재시도
        if (status === 503 || status === 500) {
          if (attempt < retries - 1) {
            const wait = delayMs * Math.pow(2, attempt); // 3s, 6s, ...
            console.warn(`[Gemini] ${status} 과부하 - ${wait}ms 대기 후 재시도`);
            await sleep(wait);
            continue;
          } else {
            await sleep(2000);
            break;
          }
        }

        // TIMEOUT → 짧은 대기 후 다음 모델
        if (msg === 'GEMINI_TIMEOUT') {
          await sleep(2000);
          break;
        }

        // 기타 → 다음 모델로 전환
        break;
      }
    }

    // 모델 전환 시 짧은 딜레이 (연속 요청 방지)
    if (modelName !== MODEL_FALLBACKS[MODEL_FALLBACKS.length - 1]) {
      await sleep(1000);
    }
  }

  throw lastError;
}
