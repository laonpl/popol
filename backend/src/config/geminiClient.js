import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];

// ── 세마포어: 동시 Gemini API 호출 수 제한 (30명+ 동시 사용 대응) ──
const MAX_CONCURRENT = 6;
const MAX_QUEUE_SIZE = 60;
let activeCount = 0;
const waitQueue = [];

function acquireSemaphore(timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    if (activeCount < MAX_CONCURRENT) {
      activeCount++;
      return resolve();
    }
    if (waitQueue.length >= MAX_QUEUE_SIZE) {
      return reject(new Error('QUEUE_FULL'));
    }
    const entry = { resolve, reject, timer: null };
    entry.timer = setTimeout(() => {
      const idx = waitQueue.indexOf(entry);
      if (idx !== -1) waitQueue.splice(idx, 1);
      reject(new Error('QUEUE_TIMEOUT'));
    }, timeoutMs);
    waitQueue.push(entry);
  });
}

function releaseSemaphore() {
  if (waitQueue.length > 0) {
    const next = waitQueue.shift();
    clearTimeout(next.timer);
    next.resolve();
  } else {
    activeCount--;
  }
}

export function getQueueStats() {
  return { active: activeCount, waiting: waitQueue.length, maxConcurrent: MAX_CONCURRENT, maxQueue: MAX_QUEUE_SIZE };
}

function extractStatus(err) {
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.response?.status === 'number') return err.response.status;
  const m = String(err?.message || '').match(/\[(\d{3})\s/);
  if (m) return parseInt(m[1], 10);
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function callModelWithTimeout(model, prompt, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
    model.generateContent(prompt).then(
      r => { clearTimeout(timer); resolve(r.response.text()); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function generateWithRetry(prompt, retries = 3, delayMs = 3000) {
  // 세마포어 획득 — 동시 호출 수 제한
  try {
    await acquireSemaphore();
  } catch (err) {
    if (err.message === 'QUEUE_FULL') {
      throw new Error('서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
    }
    if (err.message === 'QUEUE_TIMEOUT') {
      throw new Error('요청 대기 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw err;
  }

  try {
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

          if (status === 400 && (msg.includes('API key') || msg.includes('API Key'))) {
            console.error('[Gemini] API 키 오류 - 유효한 Gemini API 키를 설정하세요');
            throw err;
          }

          if (status === 404) { break; }

          if (status === 429) {
            if (attempt < retries - 1) {
              const wait = delayMs * Math.pow(2, attempt + 1);
              console.warn(`[Gemini] 429 쿼터 초과 - ${wait}ms 대기 후 재시도`);
              await sleep(wait);
              continue;
            } else {
              await sleep(3000);
              break;
            }
          }

          if (status === 503 || status === 500) {
            if (attempt < retries - 1) {
              const wait = delayMs * Math.pow(2, attempt);
              console.warn(`[Gemini] ${status} 과부하 - ${wait}ms 대기 후 재시도`);
              await sleep(wait);
              continue;
            } else {
              await sleep(2000);
              break;
            }
          }

          if (msg === 'GEMINI_TIMEOUT') { await sleep(2000); break; }

          break;
        }
      }

      if (modelName !== MODEL_FALLBACKS[MODEL_FALLBACKS.length - 1]) {
        await sleep(1000);
      }
    }

    throw lastError;
  } finally {
    releaseSemaphore();
  }
}
