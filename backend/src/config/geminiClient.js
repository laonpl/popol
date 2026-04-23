import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Lazy 초기화 — .env 변경 후 서버 재시작 시 새 키 반영 보장
let genAIClient = null;
function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  if (!genAIClient) {
    genAIClient = new GoogleGenerativeAI(key);
    console.log('[Gemini] API 클라이언트 초기화 완료');
  }
  return genAIClient;
}

let openaiClient = null;
function getOpenAIClient() {
  const token = process.env.GITHUB_MODELS_TOKEN;
  if (!token) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: process.env.GITHUB_MODELS_ENDPOINT || 'https://models.inference.ai.azure.com',
      apiKey: token,
    });
  }
  return openaiClient;
}

export async function callGitHubModelsFallback(prompt) {
  const client = getOpenAIClient();
  if (!client) throw new Error("GitHub Models Token not configured");

  // gpt-4o-mini 한도 8000 tokens 총량(입출력 합산).
  // 한국어는 1~2자/token → 안전하게 6000자(≈4000토큰) 제한, 출력 예산 1500토큰 확보.
  const MAX_CHARS = 6000;
  const safePrompt = prompt.length > MAX_CHARS
    ? prompt.slice(0, MAX_CHARS) + '\n\n[내용 일부 생략. 위 정보만으로 JSON 응답하세요]'
    : prompt;

  console.log(`[Fallback] Using GitHub Models (gpt-4o-mini)... prompt=${safePrompt.length}자`);
  const response = await client.chat.completions.create({
    messages: [
      { role: "system", content: "You are a helpful assistant. Always respond in valid JSON." },
      { role: "user", content: safePrompt }
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

const MODEL_FALLBACKS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

// 경험 분석 전용: Pro 우선 + 최후의 안전망 Lite
// preferPro:true 모드에서는 Pro 내에서 지수백오프 재시도 → Pro가 끝까지 안 되면 Lite 폴백
export const EXPERIENCE_MODEL_FALLBACKS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
];

// Pro 전용 (안전망 없음) - 반드시 Pro로만 시도
export const PRO_ONLY_FALLBACKS = ['gemini-2.5-pro'];

// ── 글로벌 API 요청 큐: 15 RPM (분당 15요청) 한계선을 절대 넘지 않도록 강제 제어 ──
// 15 RPM = 1요청 당 4000ms. 안전하게 4100ms 파괴적 딜레이 적용.
const REQUEST_INTERVAL_MS = 4100;
const MAX_QUEUE_SIZE = 60;
const waitQueue = [];
let lastRequestTime = 0;
let isProcessingQueue = false;
let activeCount = 0; // 현재 AI가 처리중인 개수 (단순 통계용)

export function acquireSemaphore(timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
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
    processQueue();
  });
}

function processQueue() {
  if (isProcessingQueue || waitQueue.length === 0) return;
  isProcessingQueue = true;

  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  const timeToWait = Math.max(0, REQUEST_INTERVAL_MS - timeSinceLast);

  setTimeout(() => {
    if (waitQueue.length === 0) {
      isProcessingQueue = false;
      return;
    }
    const next = waitQueue.shift();
    clearTimeout(next.timer);
    
    lastRequestTime = Date.now();
    activeCount++;
    next.resolve(); // 요청 권한 획득!
    
    isProcessingQueue = false;
    processQueue(); // 큐에 남아있으면 예약 시작
  }, timeToWait);
}

export function releaseSemaphore() {
  // 큐 방식에서는 release 시점에서 딜레이를 주지 않고, acquire(분출) 단계에서 철저히 4.1초를 통제함
  activeCount = Math.max(0, activeCount - 1);
}

export function getQueueStats() {
  return { active: activeCount, waiting: waitQueue.length, maxQueue: MAX_QUEUE_SIZE };
}

export function getModelHealthStats() {
  return Object.entries(modelHealthTracker).reduce((acc, [name, tracker]) => {
    acc[name] = {
      consecutiveErrors: tracker.consecutiveErrors,
      blockedUntil: tracker.blockedUntil > 0 ? new Date(tracker.blockedUntil).toISOString() : null,
      isBlocked: Date.now() < tracker.blockedUntil,
    };
    return acc;
  }, {});
}

function extractStatus(err) {
  if (typeof err?.status === 'number') return err.status;
  if (typeof err?.response?.status === 'number') return err.response.status;
  const m = String(err?.message || '').match(/\[(\d{3})\s/);
  if (m) return parseInt(m[1], 10);
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Pro 모델 503 에러 추적: 연속 2회 503 → Pro 일시 건너뛰기 (60초간) ──
const modelHealthTracker = {
  'gemini-2.5-pro': { consecutiveErrors: 0, blockedUntil: 0 },
};

function isModelTemporarilyBlocked(modelName) {
  if (!modelHealthTracker[modelName]) return false;
  const tracker = modelHealthTracker[modelName];
  if (Date.now() < tracker.blockedUntil) {
    return true;
  }
  if (tracker.blockedUntil > 0) {
    tracker.consecutiveErrors = 0;
    tracker.blockedUntil = 0;
  }
  return false;
}

function recordModelError(modelName, status) {
  if (!modelHealthTracker[modelName]) return;
  const tracker = modelHealthTracker[modelName];

  // 503 에러만 추적 (Pro TPM 부족 신호)
  if (status === 503) {
    tracker.consecutiveErrors++;
    if (tracker.consecutiveErrors >= 2) {
      console.warn(`[Model Health] ${modelName} 연속 503 에러 감지 → 60초간 대기`);
      tracker.blockedUntil = Date.now() + 60000;
    }
  } else {
    tracker.consecutiveErrors = 0; // 503 아닌 다른 에러면 카운트 초기화
  }
}

function recordModelSuccess(modelName) {
  if (!modelHealthTracker[modelName]) return;
  const tracker = modelHealthTracker[modelName];
  tracker.consecutiveErrors = 0;
  tracker.blockedUntil = 0;
}

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
 * Gemini 호출 + 재시도 + 모델 폴백.
 * @param {string} prompt
 * @param {object} [options]
 * @param {string[]} [options.models] 사용할 모델 폴백 순서. 생략 시 기본 MODEL_FALLBACKS.
 * @param {number}   [options.retries] 각 모델당 시도 횟수. 기본 2.
 * @param {number}   [options.delayMs] 재시도 기본 대기(백오프 기준). 기본 1500ms.
 * @param {number}   [options.rateLimitDelayMs] 429(TPM/RPM) 전용 기본 대기. 기본 4000ms.
 * @param {boolean}  [options.preferPro] Pro 우선 모드 — 503 발생해도 Pro 내에서 재시도, 회로차단기 무시.
 */
export async function generateWithRetry(prompt, options = {}) {
  const {
    models = MODEL_FALLBACKS,
    retries = 2,
    delayMs = 1500,
    rateLimitDelayMs = 4000,
    preferPro = false,
  } = options;

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
    let skipAllGemini = false; // 월 한도 초과 시 모든 Gemini 즉시 포기 플래그

    for (const modelName of models) {
      if (skipAllGemini) break;

      // Pro 우선 모드에서는 회로차단기 무시 (Pro 강제 시도)
      if (!preferPro && isModelTemporarilyBlocked(modelName)) {
        console.warn(`[Gemini] ${modelName} 일시 차단 상태 → 다음 모델로 이동`);
        lastError = new Error(`${modelName}이(가) 일시 차단됨`);
        continue;
      }

      const model = getGenAI().getGenerativeModel({ model: modelName });

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await callModelWithTimeout(model, prompt);
          recordModelSuccess(modelName);
          return result;
        } catch (err) {
          lastError = err;
          const status = extractStatus(err);
          const msg = err?.message || '';
          console.warn(`[Gemini] ${modelName} 실패 (시도 ${attempt + 1}/${retries}, status=${status}): ${msg.slice(0, 120)}`);

          if (status === 400 && (msg.includes('API key') || msg.includes('API Key'))) {
            console.error('[Gemini] API 키 오류 - 유효한 Gemini API 키를 설정하세요');
            throw err;
          }

          if (status === 403) {
            // 키 유출 신고 / 영구 차단: 모든 Gemini 즉시 포기
            console.warn(`[Gemini] 403 Forbidden (키 차단/유출) → 모든 Gemini 건너뜀, GitHub Models로 전환`);
            skipAllGemini = true;
            break;
          }

          if (status === 404) {
            break;
          }

          if (status === 429) {
            // 월 한도 초과: 재시도해도 소용없음 → 즉시 GitHub Models로
            if (msg.includes('spending cap') || msg.includes('monthly spending') || msg.includes('spend cap')) {
              console.warn('[Gemini] 월 한도 초과 감지 → 모든 Gemini 건너뜀, GitHub Models로 전환');
              skipAllGemini = true;
              break;
            }
            // 일반 RPM/TPM 쿼터 초과: 지수 백오프 재시도
            if (attempt < retries - 1) {
              const wait = Math.min(rateLimitDelayMs * Math.pow(2, attempt), 60000);
              console.warn(`[Gemini] 429 쿼터 초과 - ${wait}ms 대기 후 재시도 (${modelName})`);
              await sleep(wait);
              continue;
            } else {
              await sleep(3000);
              break;
            }
          }

          if (status === 503 || status === 500) {
            recordModelError(modelName, status);

            const isPro = modelName.includes('pro');

            // Pro 우선 모드: 503이어도 Pro 내에서 지수 백오프로 끝까지 재시도
            if (preferPro && isPro && status === 503) {
              if (attempt < retries - 1) {
                const wait = Math.min(delayMs * Math.pow(2, attempt), 30000);
                console.warn(`[Gemini] Pro 우선 모드 503 - ${wait}ms 대기 후 Pro 재시도 (${attempt + 1}/${retries})`);
                await sleep(wait);
                continue;
              }
              console.warn(`[Gemini] Pro 우선 모드 재시도 소진 → 다음 모델로`);
              break;
            }

            // 일반 모드 Pro 503: 즉시 폴백 (대기 없음)
            if (!preferPro && isPro && status === 503) {
              console.warn(`[Gemini] Pro 모델 503 → 즉시 Lite로 폴백 (대기 없음)`);
              break;
            }

            // Lite 모델이나 500 에러: 지수 백오프로 재시도
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

          if (msg === 'GEMINI_TIMEOUT') {
            await sleep(2000);
            break;
          }

          break;
        }
      }

      if (!skipAllGemini && modelName !== models[models.length - 1]) {
        await sleep(1000);
      }
    }

    // 모든 Gemini 시도 실패 시 GitHub Models로 Fallback
    if (lastError) {
      console.error('[Gemini] 모든 Gemini 모델 실패. GitHub Models Fallback을 시도합니다...', lastError.message);
      try {
        return await callGitHubModelsFallback(prompt);
      } catch (fallbackErr) {
        console.error('[Fallback] GitHub Models Fallback도 실패했습니다:', fallbackErr.message);
        throw lastError;
      }
    }

    throw lastError;
  } finally {
    releaseSemaphore();
  }
}
