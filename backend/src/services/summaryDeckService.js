// 경험 요약 슬라이드 생성: 결정론 덱(원문 발췌) → AI 가 칸 문구를 줄임 → 검증 통과분만 반영.
import { generateWithRetry } from '../config/geminiClient.js';
import { parseJSON } from './geminiService.js';
import { buildSummaryDeckCopyPrompt } from '../prompts/summaryDeckPrompts.js';
import { applyDeckCopy, collectDeckMaterial, listDeckSlots, planSummaryDeck } from '../../../shared/summaryDeck.mjs';

export async function buildSummaryDeck(experience) {
  const base = planSummaryDeck(collectDeckMaterial(experience));
  // 원문이 이미 칸 길이 안에 들어가는 칸은 줄일 필요가 없다.
  const slots = listDeckSlots(base).filter(({ slot }) => slot.src.length > slot.max || slot.kind !== 'body');
  if (!slots.length) return { ...base, copy: 'source' };

  try {
    const text = await generateWithRetry(buildSummaryDeckCopyPrompt(slots), {
      tier: 'deep',
      retries: 2,
      callTimeoutMs: 90000,
      githubFallback: false,
      config: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 6000 },
    });
    const { deck, applied, rejected } = applyDeckCopy(base, parseJSON(text)?.slots || {});
    console.log(`[SummaryDeck] 칸 ${slots.length}개 중 AI 문구 반영 ${applied} · 거부 ${rejected}`);
    return { ...deck, copy: 'ai' };
  } catch (error) {
    if (error?.status === 402 || /CREDIT|BILLING/i.test(String(error?.code || ''))) throw error;
    console.warn('[SummaryDeck] AI 문구 다듬기 실패 → 원문 발췌 덱 사용:', error.message);
    return { ...base, copy: 'source' };
  }
}
