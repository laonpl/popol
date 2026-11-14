// Google 모델 클라이언트 — .env 의 AI_PROVIDER 가 vertex 또는 gemini 이면 geminiClient.js 가 Bedrock 대신 이 클라이언트로 호출한다.
//   AI_PROVIDER=vertex : VERTEX_API_KEY(없으면 GEMINI_API_KEY)로 Vertex AI 익스프레스 모드(aiplatform.googleapis.com, global)
//   AI_PROVIDER=gemini : GEMINI_API_KEY 로 Gemini API(generativelanguage.googleapis.com)
//   VERTEX_MODEL       : 핵심 결과물(deep 티어 — 경험 분석·인터뷰 질문·맞춤 자소서)에서 가장 먼저 쓰는 모델.
//                        실패하면 아래 기본 체인으로 넘어간다. 다른 티어는 기본 체인만 쓴다.
// Vertex 키의 프로젝트에서 Vertex AI(Agent Platform) API가 꺼져 있으면 403 이 난다(GEMINI_API_KEY 프로젝트가 그랬다, 2026-11-13).
import { GoogleGenAI } from '@google/genai';
import { getBillingStore, recordAiUsage } from '../services/billingService.js';
import { AI_TIMEOUT_MESSAGE } from './bedrockClient.js';

// 제공자마다 쓸 수 있는 모델이 다르다(2026-11-13 확인). Gemini API: 2.5-pro 는 할당량 0(429).
// Vertex: 2.5 계열은 404, 3-flash-preview·3.1-flash-lite·3.1-pro-preview 만 응답했다.
const DEFAULT_TIER_MODELS = {
  gemini: {
    deep: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
    standard: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
    fast: ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'],
    vision: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
  },
  vertex: {
    deep: ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'],
    standard: ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'],
    fast: ['gemini-3.1-flash-lite', 'gemini-3-flash-preview'],
    vision: ['gemini-3-flash-preview', 'gemini-3.1-flash-lite'],
  },
};
// 2.5 계열은 생각(thinking) 토큰도 출력 한도에 포함된다. 낮은 한도는 JSON 이 중간에 잘리므로 Bedrock 기본값과 같은 바닥을 둔다.
const MIN_OUTPUT_TOKENS = 16000;
const MAX_OUTPUT_TOKENS = 65536;

const provider = () => String(process.env.AI_PROVIDER || '').trim().toLowerCase();
export const usesGemini = () => ['gemini', 'vertex', 'google'].includes(provider());

export function getGeminiTierModels(tier) {
  const configured = String(process.env[`GEMINI_MODELS_${String(tier).toUpperCase()}`] || '')
    .split(',').map(id => id.trim()).filter(Boolean);
  if (configured.length) return configured;
  const chains = DEFAULT_TIER_MODELS[provider() === 'vertex' ? 'vertex' : 'gemini'];
  const defaults = chains[tier] || chains.standard;
  // 비싸고 느린 VERTEX_MODEL(예: 3.1 Pro)은 핵심 결과물(deep)에만 쓴다. 찾기·묶기·이미지 판단 같은 보조 작업은 flash 계열.
  const preferred = tier === 'deep' && process.env.VERTEX_MODEL?.trim();
  return preferred ? [preferred, ...defaults.filter(id => id !== preferred)] : defaults;
}

function clientOptions() {
  if (provider() === 'vertex') {
    const apiKey = (process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) throw Object.assign(new Error('VERTEX_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.'), { status: 401 });
    return { vertexai: true, apiKey };
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.'), { status: 401 });
  return { apiKey };
}

let client = null;
let clientKey = '';
function getClient() {
  const options = clientOptions();
  const key = JSON.stringify(options);
  if (!client || clientKey !== key) { client = new GoogleGenAI(options); clientKey = key; }
  return client;
}

const toParts = contents => (Array.isArray(contents) ? contents : [contents])
  .filter(part => part !== '' && part != null)
  .map(part => typeof part === 'string' ? { text: part } : part);

/** Gemini 모델 1회 호출. callBedrock 과 같은 약속: 실패 시 status 가 붙은 에러, 성공 시 사용량 기록 후 텍스트. */
export async function callGemini({ modelId, contents, config = null, timeoutMs = 90000, billingStore = getBillingStore() }) {
  const generation = { maxOutputTokens: Math.min(Math.max(Number(config?.maxOutputTokens) || 0, MIN_OUTPUT_TOKENS), MAX_OUTPUT_TOKENS) };
  if (typeof config?.temperature === 'number') generation.temperature = config.temperature;
  if (config?.responseMimeType) generation.responseMimeType = config.responseMimeType;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await getClient().models.generateContent({ model: modelId, contents: [{ role: 'user', parts: toParts(contents) }],
      config: { ...generation, abortSignal: controller.signal } });
  } catch (err) {
    if (controller.signal.aborted) throw Object.assign(new Error(AI_TIMEOUT_MESSAGE), { status: 504, model: modelId });
    throw Object.assign(err, { status: err?.status || 502, model: modelId });
  } finally {
    clearTimeout(timer);
  }
  const text = response.text || '';
  await recordAiUsage({ provider: 'gemini', model: modelId, usage: response.usageMetadata, prompt: contents, output: text, billingStore });
  if (!text.trim()) throw Object.assign(new Error(`[Gemini] ${modelId} 응답에 텍스트가 없습니다.`), { status: 502, model: modelId });
  if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') console.warn(`[Gemini] ${modelId} 출력이 maxOutputTokens(${generation.maxOutputTokens})에서 잘렸습니다.`);
  return text;
}
