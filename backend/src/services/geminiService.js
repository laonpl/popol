/**
 * geminiService.js
 * 비즈니스 로직 전용 — 네트워크(재시도/폴백) 계층은 config/geminiClient,
 * 프롬프트 템플릿은 prompts/* 로 분리되어 있음.
 *
 * ★ 경험 분석 설계:
 *   Pro 모델(2M TPM)의 503 에러를 피하기 위해 프롬프트를 3단계로 분할 호출.
 *   각 요청이 Pro의 한도 내에 들어가도록 output JSON 구조를 최소화.
 *   Pro가 끝까지 실패한 경우에만 Lite로 최후 폴백.
 */
import { generateWithRetry } from '../config/geminiClient.js';
import {
  buildExtractMomentsPrompt,
  buildOverviewPrompt,
  buildSingleKeyExperiencePrompt,
  buildMetaPrompt,
} from '../prompts/experiencePrompts.js';
import {
  buildCoverLetterDraftPrompt,
  buildValidatePortfolioPrompt,
  buildMatchSectionsPrompt,
} from '../prompts/portfolioPrompts.js';

// ── Pro 우선 옵션: Pro 내에서 지수 백오프로 끝까지 재시도 ──
const PRO_FIRST_OPTIONS = {
  models: ['gemini-2.5-pro', 'gemini-2.5-flash-lite'],
  retries: 4,
  delayMs: 2500,
  rateLimitDelayMs: 6000,
  preferPro: true,
};

// ── Lite 폴백 (Pro 완전 실패 시 최후 수단) ──
const LITE_FALLBACK_OPTIONS = {
  models: ['gemini-2.5-flash-lite'],
  retries: 4,
  delayMs: 2000,
  rateLimitDelayMs: 6000,
};

// ── Lite 전용 (메타데이터 등 비핵심·저비용 작업) ──
// aa.md 가이드 권장: 단순 작업은 flash-lite로 직접 처리해 비용 절감
const LITE_ONLY_OPTIONS = {
  models: ['gemini-2.5-flash-lite'],
  retries: 3,
  delayMs: 1500,
  rateLimitDelayMs: 5000,
};

// ── JSON 파싱 헬퍼 ──
function parseJSON(text, pattern = /\{[\s\S]*\}/) {
  const match = text.match(pattern);
  if (!match) throw new Error('AI 응답 JSON 파싱 실패');
  return JSON.parse(match[0]);
}

/**
 * AI 호출에 타임아웃을 적용하는 래퍼.
 * aa.md 가이드 권장: AI 분석 API 타임아웃을 최소 60초 이상으로 설정.
 * 타임아웃 초과 시 명확한 에러를 반환해 hung 호출로 인한 서버 레소스 낭비를 방지.
 */
function withTimeout(promise, ms = 90000, label = 'AI') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[${label}] 타임아웃 (${ms / 1000}초 초과)`)), ms)
    ),
  ]);
}

// ── Pro 우선 + 자동 Lite 폴백 호출 ──
async function callProFirst(prompt, label) {
  try {
    console.log(`[${label}] Pro 우선 호출 시작...`);
    const text = await generateWithRetry(prompt, PRO_FIRST_OPTIONS);
    console.log(`[${label}] ✓ 호출 성공`);
    return text;
  } catch (err) {
    const status = err?.status ?? null;
    const msg = err?.message || '';
    // 영구 오류(403 차단/유출, 월 한도 초과): Lite 재시도해도 소용없음 → 즉시 전파
    const isPermanent = status === 403
      || msg.includes('spending cap') || msg.includes('leaked') || msg.includes('Forbidden');
    if (isPermanent) {
      console.warn(`[${label}] 영구 오류 감지 (status=${status}) → Lite 폴백 건너뜀`);
      throw err;
    }
    console.warn(`[${label}] Pro+Lite 모두 실패 → 마지막 Lite 폴백:`, err.message);
    // 최후 수단: Lite 단독 재시도
    return await generateWithRetry(prompt, LITE_FALLBACK_OPTIONS);
  }
}

// 다른 서비스/라우트에서 import { generateWithRetry } from './geminiService.js' 를
// 유지하기 위한 재노출. 점진적 마이그레이션 중이므로 지금은 그대로 둔다.
export { generateWithRetry };

// Pro 우선 + 자동 Lite 폴백 — jobAnalysisService 등 외부 서비스에서 사용
export { callProFirst };

// JSON 파싱 헬퍼 — 외부 서비스 공용
export { parseJSON };

/**
 * 분할 호출 기반 경험 분석.
 *
 * 단계:
 *   Step 1. 프로젝트 개요 (projectOverview + intro/overview/task/...) — 1회 호출
 *   Step 2. keyExperiences 개별 추출 — N회 호출 (각각 단일 객체)
 *   Step 3. 메타데이터 (keywords/highlights/followUpQuestions) — 1회 호출
 *
 * 각 단계는 Pro 우선 모드로 호출하며, Pro가 끝까지 실패하는 경우에만 Lite로 폴백.
 * 분할 호출 덕분에 각 요청은 Pro의 TPM/output 한도 내에 충분히 들어감.
 */
export async function analyzeExperience(content, keyExperienceCount = 3, reviewedMoments = null, jobCategory = 'common') {
  const entries = Object.entries(content).filter(([, val]) => val && String(val).trim().length > 0);
  if (entries.length === 0) {
    throw new Error('분석할 경험 내용이 비어있습니다. 내용을 먼저 작성해주세요.');
  }

  let contentText = entries
    .map(([key, val]) => `[${key}]: ${String(val).substring(0, 1200)}`)
    .join('\n');
  if (contentText.length > 4000) contentText = contentText.substring(0, 4000);

  const hasReviewed = Array.isArray(reviewedMoments) && reviewedMoments.length > 0;
  const lockedCount = hasReviewed ? reviewedMoments.length : null;
  const maxCount = hasReviewed
    ? lockedCount
    : Math.min(Math.max(Number(keyExperienceCount) || 3, 3), 10);
  const targetCount = hasReviewed ? lockedCount : Math.max(maxCount, 3);

  console.log(`[경험분석] 병렬 호출 시작: Overview + KeyExp×${targetCount} + Meta (동시 실행)`);
  const t0 = Date.now();

  const momentHints = hasReviewed ? reviewedMoments : new Array(targetCount).fill(null);

  // ============================================================
  // 3 단계 (Overview / KeyExp×N / Meta) 를 모두 병렬 실행
  // 각 단계는 서로의 결과에 의존하지 않으므로 동시 실행 가능.
  // ============================================================
  const overviewPromise = (async () => {
    const prompt = buildOverviewPrompt(contentText, jobCategory);
    const text = await callProFirst(prompt, 'Step1-Overview');
    return parseJSON(text);
  })();

  const keyExpPromises = momentHints.map((hint, i) => (async () => {
    const expPrompt = buildSingleKeyExperiencePrompt(contentText, hint, i, targetCount);
    try {
      const expText = await callProFirst(expPrompt, `Step2-KeyExp[${i + 1}/${targetCount}]`);
      const expJson = parseJSON(expText);

      if (hasReviewed && hint) {
        const pick = (a, b) => {
          const av = a == null ? '' : String(a);
          if (av && !av.startsWith('[작성 필요]')) return a;
          return b ?? a ?? '';
        };
        return {
          title: pick(expJson.title, hint.title),
          metric: pick(expJson.metric, hint.metric),
          metricLabel: pick(expJson.metricLabel, hint.metricLabel),
          beforeMetric: pick(expJson.beforeMetric, hint.beforeMetric),
          afterMetric: pick(expJson.afterMetric, hint.afterMetric),
          context: pick(expJson.context ?? expJson.situation, hint.context ?? hint.situation),
          action: pick(expJson.action, hint.action),
          result: pick(expJson.result, hint.result),
          learning: pick(expJson.learning, hint.learning),
          keywords: (expJson.keywords && expJson.keywords.length ? expJson.keywords : (hint.keywords || [])),
          chartType: expJson.chartType || 'horizontalBar',
        };
      }
      return {
        title: expJson.title || '',
        metric: expJson.metric || '',
        metricLabel: expJson.metricLabel || '',
        beforeMetric: expJson.beforeMetric || '',
        afterMetric: expJson.afterMetric || '',
        context: expJson.context ?? expJson.situation ?? '',
        action: expJson.action || '',
        result: expJson.result || '',
        learning: expJson.learning || '',
        keywords: expJson.keywords || [],
        chartType: expJson.chartType || 'horizontalBar',
      };
    } catch (err) {
      console.warn(`[Step2-KeyExp[${i + 1}]] 추출 실패:`, err.message);
      if (hasReviewed && hint) {
        return {
          title: hint.title || '',
          metric: hint.metric || '',
          metricLabel: hint.metricLabel || '',
          beforeMetric: hint.beforeMetric || '',
          afterMetric: hint.afterMetric || '',
          context: hint.context ?? hint.situation ?? '',
          action: hint.action || '',
          result: hint.result || '',
          learning: hint.learning || '',
          keywords: hint.keywords || [],
          chartType: 'horizontalBar',
        };
      }
      return null;
    }
  })());

  // Meta 단계는 비핵심 작업이므로 Lite 모델 직접 사용 (비용 절감 — aa.md 가이드 권장)
  const metaPromise = (async () => {
    try {
      const metaPrompt = buildMetaPrompt(contentText);
      const metaText = await withTimeout(
        generateWithRetry(metaPrompt, LITE_ONLY_OPTIONS),
        60000,
        'Step3-Meta'
      );
      return parseJSON(metaText);
    } catch (err) {
      console.warn('[Step3-Meta] 메타 추출 실패 (Lite 직접 호출, 빈 값으로 진행):', err.message);
      return { keywords: [], highlights: [], followUpQuestions: [] };
    }
  })();

  const [overviewJson, keyExpResults, metaJson] = await Promise.all([
    overviewPromise,
    Promise.all(keyExpPromises),
    metaPromise,
  ]);
  const keyExperiences = keyExpResults.filter(Boolean);
  console.log(`[경험분석] 병렬 완료: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // ============================================================
  // 결과 통합
  // ============================================================
  const result = {
    projectOverview: overviewJson.projectOverview || {
      summary: '', background: '', goal: '', role: '', team: '', duration: '', techStack: [],
    },
    keyExperiences,
    intro: overviewJson.intro || '',
    overview: overviewJson.overview || '',
    task: overviewJson.task || '',
    process: overviewJson.process || '',
    output: overviewJson.output || '',
    growth: overviewJson.growth || '',
    competency: overviewJson.competency || '',
    jobCategory: jobCategory || 'common',
    jobSpecific: overviewJson.jobSpecific || {},
    keywords: metaJson.keywords || [],
    highlights: metaJson.highlights || [],
    followUpQuestions: metaJson.followUpQuestions || [],
  };

  console.log(`[경험분석] ✓ 완료: keyExperiences ${keyExperiences.length}개`);
  return result;
}

/**
 * 경험 순간(moments) 추출 — Pro 우선.
 * rawText는 5000자로 캡핑되어 있고 output도 최대 10개 moments로 제한되므로
 * 별도 분할 없이 단일 호출. Pro 실패 시 Lite로 폴백.
 */
export async function extractMoments(rawText, title) {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error('분석할 텍스트가 비어있습니다');
  }

  const prompt = buildExtractMomentsPrompt(rawText, title);
  const text = await callProFirst(prompt, 'ExtractMoments');
  const parsed = parseJSON(text);
  const moments = parsed.moments || [];

  console.log(`[ExtractMoments] ✓ ${moments.length}개 추출 완료`);
  return moments;
}

export async function generateCoverLetterDraft(question, linkedExperiences, targetCompany, targetPosition) {
  const experienceText = linkedExperiences.map((exp, i) => {
    const content = Object.entries(exp.content || {})
      .map(([k, v]) => `  ${k}: ${v}`)
      .join('\n');
    return `[경험 ${i + 1}: ${exp.title}]\n${content}`;
  }).join('\n\n');

  try {
    const prompt = buildCoverLetterDraftPrompt(question, experienceText, targetCompany, targetPosition);
    return (await generateWithRetry(prompt)).trim();
  } catch (err) {
    console.warn('Gemini 자소서 초안 생성 실패, 템플릿 폴백 사용:', err.message);
    return generateFallbackDraft(question, linkedExperiences, targetCompany, targetPosition);
  }
}

function generateFallbackDraft(question, linkedExperiences, targetCompany, targetPosition) {
  const company = targetCompany || '귀사';
  const position = targetPosition || '해당 직무';

  if (!linkedExperiences.length) {
    return `[${company} 지원 - ${position}]\n\n문항: ${question || '(문항 없음)'}\n\n저는 ${company}에 ${position} 직무로 지원하게 되었습니다.\n\n(여기에 관련 경험과 역량을 작성해주세요. 경험 카드를 연결하면 더 구체적인 초안이 생성됩니다.)`;
  }

  let draft = '';
  const firstExp = linkedExperiences[0];
  const content = firstExp.content || {};

  if (content.context || content.situation) {
    draft += (content.context || content.situation).substring(0, 200);
    if ((content.context || content.situation).length > 200) draft += '...';
    draft += '\n\n';
  }
  if (content.task) {
    draft += `이를 해결하기 위해 목표로 삼은 것은 다음과 같습니다. ${content.task.substring(0, 150)}`;
    draft += '\n\n';
  }
  if (content.action) {
    draft += `구체적으로 ${content.action.substring(0, 200)}`;
    if (content.action.length > 200) draft += '...';
    draft += '\n\n';
  }
  if (content.result) {
    draft += `그 결과, ${content.result.substring(0, 150)}`;
    draft += '\n\n';
  }
  draft += `이 경험을 통해 얻은 역량을 ${company}의 ${position} 직무에서 적극 발휘하겠습니다.`;

  return draft.trim() || `${company}에 ${position}(으)로 지원합니다.\n\n(연결된 경험을 바탕으로 직접 작성해주세요.)`;
}

export async function validatePortfolioWithAI(portfolioData, experiencesData) {
  const sectionsText = (portfolioData.sections || []).map((s, i) =>
    `[섹션 ${i + 1}: ${s.title}]\n역할: ${s.role || '미기재'}\n기여도: ${s.contribution || '미기재'}%\n내용: ${(s.content || '(비어있음)').substring(0, 300)}`
  ).join('\n\n');

  const prompt = buildValidatePortfolioPrompt(portfolioData, sectionsText);
  const result = await generateWithRetry(prompt);
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 검수 응답 파싱 실패');
  return JSON.parse(jsonMatch[0]);
}

/** 포트폴리오 섹션별 기업/직무 요건 매칭 분석 */
export async function matchSectionsToRequirements(sections, targetCompany, targetPosition) {
  const sectionsText = sections.map((s, i) => {
    const content = s.content
      ? s.content.substring(0, 300)
      : (s.projectTechStack ? `기술스택: ${s.projectTechStack.join(', ')}` : '(내용 없음)');
    return `[섹션 ${i}: "${s.title}" (타입: ${s.type})]\n${content}`;
  }).join('\n\n');

  try {
    const prompt = buildMatchSectionsPrompt(targetCompany, targetPosition, sectionsText);
    const text = await generateWithRetry(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('파싱 실패');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return sections.map((s, i) => ({
      index: i,
      matched: s.type !== 'custom' && !!(s.content || s.projectTechStack),
      relevance: 'medium',
      reason: '자동 분석 실패 - 수동 검토 권장',
    }));
  }
}
