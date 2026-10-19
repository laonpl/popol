// AI 호출 진입점. 이름은 기존 호출부 호환을 위해 geminiClient 로 남겨 두었지만,
// 2026-10 부터 실제 호출은 Amazon Bedrock(bedrockClient.js)으로 간다.
// 호출부가 넘기는 Gemini 모델명은 티어로 해석한다:
//   options.tier 지정 → 그 티어 / 첨부 파일(inlineData) → vision / 'lite' 모델만 → fast / 그 외 → standard
import OpenAI from 'openai';
import { assertHasCredits, getBillingStore, recordAiUsage } from '../services/billingService.js';
import { getAiErrorStatus } from '../utils/aiError.js';
import { AI_TIERS, AI_TIMEOUT_MESSAGE, callBedrock, getModelSlotStats, getTierModels, hasFreeModelSlot, hasInlineData } from './bedrockClient.js';

let openaiClient = null;
function getOpenAIClient() {
  const token = process.env.GITHUB_MODELS_TOKEN;
  if (!token) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      baseURL: process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference',
      apiKey: token,
    });
  }
  return openaiClient;
}

export async function callGitHubModelsFallback(prompt, billingStore = getBillingStore()) {
  await assertHasCredits();
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
    model: "openai/gpt-4o-mini",
    temperature: 0.7,
  });

  const text = response.choices[0].message.content;
  await recordAiUsage({ provider: 'github-models', model: 'gpt-4o-mini', usage: response.usage, prompt: safePrompt, output: text, billingStore });
  return text;
}

const MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite'
];

function resolveTier(tier, models, contents) {
  if (AI_TIERS.includes(tier)) return tier;
  if (hasInlineData(contents)) return 'vision';
  if (models.length && models.every(name => /lite/i.test(name))) return 'fast';
  return 'standard';
}

// Bedrock 에는 Google 검색 그라운딩이 없다. 호출부(callProFirstWithSearch 등)가
// 이 에러를 받고 검색 없는 경로로 넘어가도록 API 호출 전에 바로 던진다.
function assertNoSearchTools(config) {
  if (config?.tools?.some(tool => tool?.googleSearch || tool?.google_search)) {
    throw Object.assign(new Error('웹 검색 그라운딩은 현재 AI 제공자에서 지원하지 않습니다.'), { status: 501, code: 'SEARCH_UNSUPPORTED' });
  }
}

// ── 동시 실행 제어 ──────────────────────────────────────────────────────────
// 전체 동시 실행 수 + 사용자별 동시 실행 수를 제한한다. 한 사용자가 PPT·경험 분석을 동시에 돌려도
// 다른 사용자의 요청이 줄 뒤로 밀리지 않게 하려는 목적. (모델별 제한은 bedrockClient.js)
const MAX_CONCURRENCY = Number(process.env.AI_MAX_CONCURRENCY || 40);
const MAX_PER_USER = Number(process.env.AI_MAX_PER_USER || 4);
const MAX_QUEUE_SIZE = Number(process.env.AI_MAX_QUEUE || 100);

function createLimiter(max) {
  const limiter = { active: 0, waiters: [] };
  limiter.acquire = (timeoutMs) => new Promise((resolve, reject) => {
    if (limiter.active < max) {
      limiter.active++;
      return resolve();
    }
    if (limiter.waiters.length >= MAX_QUEUE_SIZE) return reject(new Error('QUEUE_FULL'));
    const waiter = { resolve, timer: null };
    waiter.timer = setTimeout(() => {
      limiter.waiters.splice(limiter.waiters.indexOf(waiter), 1);
      reject(new Error('QUEUE_TIMEOUT'));
    }, timeoutMs);
    limiter.waiters.push(waiter);
  });
  limiter.release = () => {
    const next = limiter.waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve(); // 슬롯을 그대로 넘겨준다 (active 유지)
    } else {
      limiter.active = Math.max(0, limiter.active - 1);
    }
  };
  return limiter;
}

const globalLimiter = createLimiter(MAX_CONCURRENCY);
const userLimiters = new Map();

export function acquireSemaphore(timeoutMs = 600000) {
  return globalLimiter.acquire(timeoutMs);
}

export function releaseSemaphore() {
  globalLimiter.release();
}

async function acquireUserAndGlobal(userId, timeoutMs) {
  let userLimiter = null;
  if (userId) {
    userLimiter = userLimiters.get(userId);
    if (!userLimiter) userLimiters.set(userId, userLimiter = createLimiter(MAX_PER_USER));
    await userLimiter.acquire(timeoutMs);
  }
  try {
    await globalLimiter.acquire(timeoutMs);
  } catch (err) {
    releaseUser(userId, userLimiter);
    throw err;
  }
  return () => {
    globalLimiter.release();
    releaseUser(userId, userLimiter);
  };
}

function releaseUser(userId, userLimiter) {
  if (!userLimiter) return;
  userLimiter.release();
  if (userLimiter.active === 0 && userLimiter.waiters.length === 0) userLimiters.delete(userId);
}

export function getQueueStats() {
  return {
    active: globalLimiter.active,
    waiting: globalLimiter.waiters.length,
    maxConcurrency: MAX_CONCURRENCY,
    maxQueue: MAX_QUEUE_SIZE,
    activeUsers: userLimiters.size,
    models: getModelSlotStats(),
  };
}

// ── 모델 상태 추적: 접근 불가·과부하 모델을 잠시 건너뛴다 ──
const modelBlockedUntil = new Map();
const ACCESS_BLOCK_MS = 10 * 60 * 1000; // 403/404: 권한·미제공 (예: Claude 사용 목적 미제출)
const THROTTLE_BLOCK_MS = 15 * 1000;    // 429: 호출 한도 초과

function blockModel(modelId, ms, reason) {
  console.warn(`[AI] ${modelId} ${Math.round(ms / 1000)}초간 건너뜀 (${reason})`);
  modelBlockedUntil.set(modelId, Date.now() + ms);
}

function isModelBlocked(modelId) {
  return (modelBlockedUntil.get(modelId) || 0) > Date.now();
}

export function getModelHealthStats() {
  return Object.fromEntries([...modelBlockedUntil]
    .filter(([, until]) => until > Date.now())
    .map(([id, until]) => [id, { blockedUntil: new Date(until).toISOString() }]));
}

// 키 자체가 틀렸거나 계정 정책(SCP)에 막힌 경우 — 어느 모델로 바꿔도 같으므로 즉시 중단
function isAuthError(err) {
  return /api key|bearer|security token|service control policy|AWS_BEARER_TOKEN_BEDROCK/i.test(err?.message || '');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 모델 체인을 순서대로 시도한다. 일시 오류는 같은 모델에서 재시도, 그 외에는 다음 모델로.
async function callModelChain(modelIds, { contents, config, retries, delayMs, callTimeoutMs, billingStore }) {
  let lastError;
  const unblocked = modelIds.filter(id => !isModelBlocked(id));
  // 전부 차단 상태면 차단을 무시하고 그래도 한 번씩은 시도한다.
  const candidates = unblocked.length ? unblocked : modelIds;
  // 앞 모델이 동시 실행 한도로 꽉 찼으면 기다리지 않고 자리가 빈 다음 모델부터 쓴다(순서는 유지).
  const ordered = [...candidates.filter(hasFreeModelSlot), ...candidates.filter(id => !hasFreeModelSlot(id))];
  for (const modelId of ordered) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await callBedrock({ modelId, contents, config, timeoutMs: callTimeoutMs, billingStore });
      } catch (err) {
        lastError = err;
        const status = getAiErrorStatus(err);
        console.warn(`[AI] ${modelId} 실패 (시도 ${attempt + 1}/${retries}, status=${status}): ${String(err?.message || '').slice(0, 160)}`);

        if (status === 402 || /CREDIT|BILLING/i.test(String(err?.code || ''))) throw err;
        if (status === 401 || isAuthError(err)) throw err;
        if (status === 415) throw err; // 첨부 형식 문제 — 모델을 바꿔도 동일
        if (status === 403 || status === 404) {
          blockModel(modelId, ACCESS_BLOCK_MS, `접근 불가 ${status}`);
          break;
        }
        if (status === 429) {
          blockModel(modelId, THROTTLE_BLOCK_MS, '호출 한도 초과');
          break; // 다른 제공사 모델은 한도가 따로라 바로 넘어간다
        }
        const transient = [408, 500, 502, 503, 504].includes(status) || err?.message === AI_TIMEOUT_MESSAGE;
        if (transient && attempt < retries - 1) {
          await sleep(Math.min(delayMs * 2 ** attempt, 15000) * (0.8 + Math.random() * 0.4));
          continue;
        }
        break; // 400(요청 형식 거부) 등은 다음 모델로
      }
    }
  }
  throw lastError || new Error('AI 호출 가능한 모델이 없습니다.');
}

/**
 * 모델 1개에 HTTP 요청 1번 (자료 가져오기·OCR 경로용 — 재시도·폴백은 호출부가 직접 한다).
 * Gemini flash → 티어 체인 1번째, lite → 2번째 모델. 차단 중인 모델은 다음 모델로 대신한다.
 */
export async function callGeminiModel(modelName, contents, timeoutMs = 90000, config = null, billingStore = getBillingStore(), returnMetadata = false) {
  await assertHasCredits();
  assertNoSearchTools(config);
  const chain = getTierModels(resolveTier(null, [modelName], contents));
  const preferred = chain.slice(/lite/i.test(modelName) ? Math.min(1, chain.length - 1) : 0);
  const modelId = preferred.find(id => !isModelBlocked(id)) || preferred[0];
  const text = await callModelChain([modelId], {
    contents, config, retries: 1, delayMs: 0, callTimeoutMs: timeoutMs, billingStore,
  });
  return returnMetadata ? { text, groundingMetadata: null } : text;
}

/**
 * AI 호출 + 재시도 + 모델 폴백.
 * @param {string|Array} prompt
 * @param {object} [options]
 * @param {string}   [options.tier] 'deep' | 'standard' | 'fast' | 'vision'. 생략 시 models·첨부로 추론.
 * @param {string[]} [options.models] (호환용) Gemini 모델명 목록 — 티어 추론에만 쓴다.
 * @param {number}   [options.retries] 각 모델당 시도 횟수. 기본 2.
 * @param {number}   [options.delayMs] 일시 오류 재시도 기본 대기(지수 백오프). 기본 1500ms.
 * @param {number}   [options.callTimeoutMs] 모델 1회 호출 당 타임아웃(ms). 기본 90000.
 * @param {object}   [options.config] temperature·maxOutputTokens·responseMimeType 반영. googleSearch 도구는 미지원.
 * @param {number}   [options.queueTimeoutMs] 동시 실행 대기 상한. 기본 600000ms.
 * @param {boolean}  [options.returnMetadata] { text, groundingMetadata: null } 형태로 반환.
 */
export async function generateWithRetry(prompt, options = {}) {
  const {
    tier = null,
    models = MODEL_FALLBACKS,
    retries = 2,
    delayMs = 1500,
    callTimeoutMs = 90000,
    config = null,
    githubFallback = true,
    billingStore: explicitBillingStore = null,
    returnMetadata = false,
    queueTimeoutMs = 600000,
  } = options;

  const billingStore = explicitBillingStore || getBillingStore();
  await assertHasCredits();
  assertNoSearchTools(config);

  let release;
  try {
    release = await acquireUserAndGlobal(billingStore?.userId, queueTimeoutMs);
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
    const chain = getTierModels(resolveTier(tier, models, prompt));
    const text = await callModelChain(chain, { contents: prompt, config, retries, delayMs, callTimeoutMs, billingStore });
    return returnMetadata ? { text, groundingMetadata: null } : text;
  } catch (lastError) {
    const status = getAiErrorStatus(lastError);
    const canFallback = githubFallback && typeof prompt === 'string'
      && status !== 402 && status !== 415 && !/CREDIT|BILLING/i.test(String(lastError?.code || ''));
    if (!canFallback) throw lastError;
    console.error('[AI] 모든 Bedrock 모델 실패. GitHub Models Fallback을 시도합니다...', lastError.message);
    try {
      const fallbackText = await callGitHubModelsFallback(prompt, billingStore);
      return returnMetadata ? { text: fallbackText, groundingMetadata: null } : fallbackText;
    } catch (fallbackErr) {
      console.error('[Fallback] GitHub Models Fallback도 실패했습니다:', fallbackErr.message);
      throw lastError;
    }
  } finally {
    release();
  }
}
