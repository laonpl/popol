// Amazon Bedrock Converse API 클라이언트 — Bearer 토큰(Bedrock API 키) 인증, SDK 없이 fetch.
// geminiClient.js 가 Gemini 형식 요청(문자열·inlineData parts·generation config)을 넘기면
// 여기서 Converse 형식으로 바꿔 호출하고 사용량을 기록한다.
import { getBillingStore, recordAiUsage } from '../services/billingService.js';

// 티어별 모델 체인: 앞에서부터 시도하고 실패하면 다음 모델(다른 제공사 = 별도 호출 한도)로 넘어간다.
// .env 의 BEDROCK_MODELS_DEEP / _STANDARD / _FAST / _VISION (쉼표 구분)으로 덮어쓸 수 있다.
// Claude(au.anthropic.*)는 AWS Marketplace 과금이라 무료 크레딧이 적용되지 않을 수 있어 기본값에서 뺐다.
// 선정 근거(2026-10-19 실측, 한국어 경험 정리 과제):
//   GLM-5 86tok/s·원문 충실·문장 품질 최고 / Qwen3 235B 94tok/s·지어낸 수치 없음 / GLM-4.7 104tok/s·충실
//   제외: DeepSeek V3.2(31tok/s — 경험 분석 개요가 180초 타임아웃), Nemotron(원문에 없는 행동을 지어냄),
//         gpt-oss(한국어 질문에 영어로 답함), Nova(한글 문서 OCR에서 없는 내용을 지어냄)
const DEFAULT_TIER_MODELS = {
  deep: ['zai.glm-5', 'qwen.qwen3-235b-a22b-2507-v1:0'],
  standard: ['qwen.qwen3-235b-a22b-2507-v1:0', 'zai.glm-4.7'],
  fast: ['qwen.qwen3-235b-a22b-2507-v1:0', 'zai.glm-4.7-flash'],
  vision: ['qwen.qwen3-vl-235b-a22b'],
};

export const AI_TIERS = Object.keys(DEFAULT_TIER_MODELS);

export function getTierModels(tier) {
  const configured = String(process.env[`BEDROCK_MODELS_${String(tier).toUpperCase()}`] || '')
    .split(',').map(id => id.trim()).filter(Boolean);
  return configured.length ? configured : (DEFAULT_TIER_MODELS[tier] || DEFAULT_TIER_MODELS.standard);
}

// 모델별 최대 출력 토큰. 넘기면 400 ValidationException 이 난다. (기본 체인 모델은 64000까지 실측 통과)
const MODEL_MAX_OUTPUT = { 'amazon.nova-lite-v1:0': 10000 };
const DEFAULT_MAX_TOKENS = 16000;

// 기존 호출부(importService, aiError, portfolio 라우트)가 이 문자열로 타임아웃을 판별한다.
export const AI_TIMEOUT_MESSAGE = 'GEMINI_TIMEOUT';

const JSON_ONLY_SYSTEM = 'JSON만 출력하세요. 코드블록(```)이나 설명 문장을 앞뒤에 붙이지 마세요.';

const IMAGE_FORMATS = {
  'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif', 'image/webp': 'webp',
};

export function hasInlineData(contents) {
  return Array.isArray(contents) && contents.some(part => part?.inlineData || part?.inline_data);
}

function toContentBlocks(contents) {
  const parts = Array.isArray(contents) ? contents : [contents];
  return parts.flatMap(part => {
    if (typeof part === 'string') return part ? [{ text: part }] : [];
    if (typeof part?.text === 'string') return [{ text: part.text }];
    const inline = part?.inlineData || part?.inline_data;
    if (inline) {
      const mimeType = String(inline.mimeType || inline.mime_type || '').toLowerCase();
      if (IMAGE_FORMATS[mimeType]) return [{ image: { format: IMAGE_FORMATS[mimeType], source: { bytes: inline.data } } }];
      if (mimeType === 'application/pdf') return [{ document: { format: 'pdf', name: 'document', source: { bytes: inline.data } } }];
      throw Object.assign(new Error(`지원하지 않는 첨부 형식입니다: ${mimeType}`), { status: 415 });
    }
    return [{ text: JSON.stringify(part) }];
  });
}

function stripJsonFence(text) {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

// ── 모델별 동시 실행 제한 (한 모델의 호출 한도를 혼자 다 쓰지 않도록) ──
// GLM-5·Qwen3 235B 모두 동시 30건에서 429 없이 처리됐다(2026-10-19 실측) → 여유를 두고 20.
const MAX_PER_MODEL = Number(process.env.BEDROCK_MAX_PER_MODEL || 20);
const modelSlots = new Map();

export function hasFreeModelSlot(modelId) {
  return (modelSlots.get(modelId)?.active || 0) < MAX_PER_MODEL;
}

function acquireModelSlot(modelId, timeoutMs) {
  let slot = modelSlots.get(modelId);
  if (!slot) modelSlots.set(modelId, slot = { active: 0, waiters: [] });
  if (slot.active < MAX_PER_MODEL) {
    slot.active++;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const waiter = { resolve, timer: null };
    waiter.timer = setTimeout(() => {
      slot.waiters.splice(slot.waiters.indexOf(waiter), 1);
      reject(Object.assign(new Error(AI_TIMEOUT_MESSAGE), { status: 504 }));
    }, timeoutMs);
    slot.waiters.push(waiter);
  });
}

function releaseModelSlot(modelId) {
  const slot = modelSlots.get(modelId);
  const next = slot.waiters.shift();
  if (next) {
    clearTimeout(next.timer);
    next.resolve(); // 슬롯을 그대로 넘겨준다 (active 유지)
  } else {
    slot.active--;
  }
}

export function getModelSlotStats() {
  return Object.fromEntries([...modelSlots].map(([id, slot]) => [id, { active: slot.active, waiting: slot.waiters.length }]));
}

/**
 * Bedrock 모델 1회 호출. 실패 시 status 가 붙은 에러를 던진다(재시도·폴백은 호출부 몫).
 * @param {object} p
 * @param {string} p.modelId
 * @param {string|Array} p.contents Gemini 형식 프롬프트(문자열 또는 parts 배열)
 * @param {object} [p.config] Gemini generation config — temperature, maxOutputTokens, responseMimeType 만 반영
 */
export async function callBedrock({ modelId, contents, config = null, timeoutMs = 90000, billingStore = getBillingStore() }) {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!token) throw Object.assign(new Error('AWS_BEARER_TOKEN_BEDROCK가 설정되지 않았습니다. .env 파일을 확인하세요.'), { status: 401, code: 'BEDROCK_AUTH' });

  const jsonMode = config?.responseMimeType === 'application/json';
  const inferenceConfig = {
    maxTokens: Math.min(Number(config?.maxOutputTokens) || DEFAULT_MAX_TOKENS, MODEL_MAX_OUTPUT[modelId] || 64000),
  };
  if (typeof config?.temperature === 'number') inferenceConfig.temperature = Math.min(config.temperature, 1);
  const body = {
    messages: [{ role: 'user', content: toContentBlocks(contents) }],
    inferenceConfig,
    ...(jsonMode ? { system: [{ text: JSON_ONLY_SYSTEM }] } : {}),
  };

  const deadline = Date.now() + timeoutMs;
  await acquireModelSlot(modelId, timeoutMs);
  let res;
  let payload;
  try {
    const region = process.env.BEDROCK_REGION || 'ap-southeast-2';
    res = await fetch(`https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
    });
    payload = await res.json().catch(() => ({}));
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw Object.assign(new Error(AI_TIMEOUT_MESSAGE), { status: 504, model: modelId });
    }
    throw Object.assign(err, { status: err?.status || 502, model: modelId });
  } finally {
    releaseModelSlot(modelId);
  }

  if (!res.ok) {
    const message = payload.message || payload.Message || `HTTP ${res.status}`;
    throw Object.assign(new Error(`[Bedrock] ${modelId} ${res.status}: ${message}`), {
      status: res.status,
      code: res.headers.get('x-amzn-errortype')?.split(':')[0] || null,
      model: modelId,
    });
  }

  const blocks = payload.output?.message?.content || [];
  // reasoningContent(추론 과정) 블록은 버리고 최종 텍스트만 쓴다.
  let text = blocks.filter(block => typeof block.text === 'string').map(block => block.text).join('');
  await recordAiUsage({ provider: 'bedrock', model: modelId, usage: payload.usage, prompt: contents, output: text, billingStore });
  if (!text.trim()) throw Object.assign(new Error(`[Bedrock] ${modelId} 응답에 텍스트가 없습니다.`), { status: 502, model: modelId });
  if (payload.stopReason === 'max_tokens') console.warn(`[Bedrock] ${modelId} 출력이 maxTokens(${inferenceConfig.maxTokens})에서 잘렸습니다.`);
  if (jsonMode) text = stripJsonFence(text);
  return text;
}
