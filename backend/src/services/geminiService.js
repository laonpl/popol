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
  buildDirectPptxTemplateMappingPrompt,
  buildPortfolioDistillPrompt,
  buildValidatePortfolioPrompt,
  buildMatchSectionsPrompt,
  buildAiPptAnalyzePrompt,
  buildAiPptRevisePrompt,
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

function compactText(value, max = 600) {
  return String(value || '').replace(/\s+/g, ' ').trim().substring(0, max);
}

function collectPortfolioForPptx(portfolio = {}) {
  const lines = [
    `이름: ${portfolio.userName || ''}`,
    `희망 직무: ${portfolio.targetPosition || ''}`,
    `헤드라인: ${portfolio.headline || ''}`,
    `소개: ${compactText(portfolio.about || portfolio.valuesEssay, 700)}`,
  ];

  const skills = portfolio.skills || {};
  const skillText = [...(skills.languages || []), ...(skills.frameworks || []), ...(skills.tools || []), ...(skills.others || [])]
    .map(skill => typeof skill === 'string' ? skill : skill?.name)
    .filter(Boolean)
    .join(', ');
  if (skillText) lines.push(`기술/역량: ${skillText}`);

  (portfolio.experiences || []).slice(0, 12).forEach((exp, idx) => {
    const content = exp.frameworkContent || exp.structuredResult || exp.content || exp;
    lines.push(`\n[경험 ${idx + 1}] ${exp.title || exp.company || exp.name || '프로젝트'}`);
    ['intro', 'overview', 'description', 'task', 'process', 'output', 'growth', 'competency', 'aiSummary'].forEach(key => {
      if (content?.[key]) lines.push(`${key}: ${compactText(content[key], 500)}`);
    });
    if (content?.projectOverview) lines.push(`개요: ${compactText(JSON.stringify(content.projectOverview), 700)}`);
    if (Array.isArray(content?.keyExperiences)) {
      content.keyExperiences.slice(0, 4).forEach((item, itemIdx) => {
        lines.push(`핵심경험 ${itemIdx + 1}: ${compactText([item.title, item.metric, item.context, item.action, item.result, item.learning].filter(Boolean).join(' / '), 700)}`);
      });
    }
    if (Array.isArray(exp.sections)) {
      exp.sections.slice(0, 5).forEach(section => lines.push(`${section.title || '섹션'}: ${compactText(section.content, 500)}`));
    }
  });

  const contact = portfolio.contact || {};
  const contactText = [contact.email, contact.phone, contact.github, contact.website || contact.linkedin || contact.instagram].filter(Boolean).join(' / ');
  if (contactText) lines.push(`연락처: ${contactText}`);

  return lines.filter(line => line && !/:\s*$/.test(line)).join('\n');
}

/**
 * Stage 1: 링크형 포트폴리오 → 합격자 PPT 콘텐츠 팩 + 슬라이드 슬롯 계획.
 * 디자인과 분리된 순수 콘텐츠 추출 단계.
 */
function ensureContentPackSafety(pack, portfolio, slideCount) {
  const safe = pack && typeof pack === 'object' ? { ...pack } : {};
  safe.summary = { ...(safe.summary || {}) };
  const sum = safe.summary;

  if (!sum.name || /스킬|skill|·/i.test(String(sum.name))) sum.name = portfolio?.userName || '이름 미상';
  if (!sum.role_target) sum.role_target = portfolio?.targetPosition || '직무 미정';
  if (!sum.headline || sum.headline === sum.tagline) {
    sum.headline = portfolio?.headline || `${sum.role_target} 지원자 ${sum.name}`;
  }
  if (!Array.isArray(sum.contact_lines)) {
    const c = portfolio?.contact || {};
    sum.contact_lines = [c.email, c.phone, c.github, c.website || c.linkedin].filter(Boolean);
  }
  if (!sum.tagline) sum.tagline = '';

  // slide_slots 정합성 보정
  let slots = Array.isArray(safe.slide_slots) ? safe.slide_slots.slice(0, slideCount) : [];
  while (slots.length < slideCount) slots.push({ slideIndex: slots.length, intent: 'project', focus: `projects[${Math.max(0, slots.length - 2)}]` });
  slots = slots.map((s, i) => ({ slideIndex: i, intent: String(s.intent || 'project'), focus: String(s.focus || '') }));
  if (slideCount >= 1) slots[0] = { slideIndex: 0, intent: 'profile', focus: 'cover' };
  if (slideCount >= 2) slots[slideCount - 1] = { slideIndex: slideCount - 1, intent: 'contact', focus: 'closing' };
  safe.slide_slots = slots;

  if (!Array.isArray(safe.projects)) safe.projects = [];
  if (!Array.isArray(safe.skills_groups)) safe.skills_groups = [];
  if (!Array.isArray(safe.values_keywords)) safe.values_keywords = [];
  return safe;
}

async function distillPortfolioContentPack({ portfolio, slideCount }) {
  const portfolioText = collectPortfolioForPptx(portfolio);
  const prompt = buildPortfolioDistillPrompt({ portfolioText, slideCount });
  let raw = null;
  try {
    // 콘텐츠 추출은 구조화된 작업이라 Flash-Lite 로 충분 (Pro 보다 3~5배 빠름)
    // 타임아웃을 60초로 잡아 Stage 2 의 Pro 호출 시간을 충분히 확보
    const text = await withTimeout(
      generateWithRetry(prompt, LITE_ONLY_OPTIONS),
      60000,
      'PortfolioDistill'
    );
    raw = parseJSON(text);
  } catch (err) {
    console.warn('[PortfolioDistill] 실패, 안전 폴백으로 진행:', err.message);
  }
  return { contentPack: ensureContentPackSafety(raw, portfolio, slideCount), portfolioText };
}

export async function mapDirectPptxTemplateWithAI({ templateTitle, slides, portfolio }) {
  const safeSlides = (slides || []).slice(0, 40).map((slide, idx) => {
    const shapesIn = Array.isArray(slide.shapes) ? slide.shapes.slice(0, 30) : [];
    return {
      slideIndex: Number.isInteger(slide.slideIndex) ? slide.slideIndex : idx,
      textBoxCount: Math.max(1, Math.min(Number(slide.textBoxCount) || shapesIn.length || 1, 30)),
      shapes: shapesIn.map(s => ({
        shape_id: Number(s.shape_id),
        role_hint: compactText(s.role_hint, 30) || 'Subtext',
        width_pt: Number(s.width_pt) || null,
        height_pt: Number(s.height_pt) || null,
        x_pt: Number(s.x_pt) || null,
        y_pt: Number(s.y_pt) || null,
        char_budget: Math.max(8, Math.min(Number(s.char_budget) || 45, 240)),
        original_font_size_pt: Number(s.original_font_size_pt) || null,
      })),
    };
  });

  if (!safeSlides.length) throw new Error('분석할 PPTX 슬라이드 정보가 없습니다.');

  // ── Stage 1: 콘텐츠 추출 ──
  const { contentPack, portfolioText } = await distillPortfolioContentPack({
    portfolio,
    slideCount: safeSlides.length,
  });

  // ── Stage 2: 디자인-온리 레이아웃 핏 ──
  const prompt = buildDirectPptxTemplateMappingPrompt({
    templateTitle,
    slides: safeSlides,
    portfolioText,
    contentPack,
  });
  const text = await callProFirst(prompt, 'DirectPptxTemplateMapping');
  const parsed = parseJSON(text);
  const bySlide = new Map(safeSlides.map(slide => [slide.slideIndex, slide]));

  return (parsed.mappings || []).map(mapping => {
    const slideIndex = Number(mapping.slideIndex);
    const slide = bySlide.get(slideIndex);
    if (!slide) return null;
    const slideShapes = slide.shapes || [];
    const budgets = new Map(slideShapes.map(s => [s.shape_id, s.char_budget]));
    const origFonts = new Map(slideShapes.map(s => [s.shape_id, s.original_font_size_pt]));

    const shapesOut = Array.isArray(mapping.shapes)
      ? mapping.shapes.map(s => {
          const id = Number(s.shape_id);
          if (!Number.isFinite(id)) return null;
          const budget = budgets.get(id) || 60;
          let font = Number(s.font_size_pt);
          if (!Number.isFinite(font) || font < 6 || font > 96) font = null;
          let newText = String(s.new_text || '').replace(/\\n/g, '\n');

          // 박스 예산을 넘으면 줄 단위 → 글자 단위로 단계적으로 자르고, 잘렸다면 폰트도 1~2pt 축소
          if (newText.length > budget) {
            const lines = newText.split('\n').map(l => l.trim()).filter(Boolean);
            const kept = [];
            let used = 0;
            for (const line of lines) {
              const next = used + (kept.length ? 1 : 0) + line.length;
              if (next > budget) break;
              kept.push(line);
              used = next;
            }
            newText = kept.length ? kept.join('\n') : newText.slice(0, Math.max(8, budget - 1)) + '…';
            if (!font) {
              const orig = origFonts.get(id);
              if (orig && orig > 12) font = Math.max(11, orig - 2);
            }
          }

          return {
            shape_id: id,
            inferred_role: compactText(s.inferred_role, 40) || 'Subtext',
            new_text: newText,
            font_size_pt: font,
          };
        }).filter(Boolean)
      : [];

    const lines = Array.isArray(mapping.lines)
      ? mapping.lines.map(line => compactText(line, 80)).filter(Boolean).slice(0, slide.textBoxCount)
      : [];

    return {
      slideIndex,
      intent: compactText(mapping.intent, 40) || 'project',
      shapes: shapesOut,
      lines,
    };
  }).filter(Boolean);
}

// ── AI PPT 포트폴리오 ── 결정적 빌더로 deck를 완성한 뒤 AI가 문구만 다듬음
export async function generateAiPptDeck({ portfolio, templateHint, customTemplate }) {
  // 1단계: 포트폴리오 데이터로 슬라이드를 결정적으로 구축 (내용 100% 보장)
  const baseDeck = buildDeckFromPortfolio(portfolio);

  // 2단계: AI에게 문구 다듬기 부탁. 실패해도 baseDeck는 그대로 보존.
  let polished = null;
  try {
    const prompt = buildAiPptAnalyzePrompt({ portfolio, templateHint, customTemplate, baseDeck });
    const text = await withTimeout(callProFirst(prompt, 'AiPptDeck'), 90000, 'AiPptDeck');
    polished = parseJSON(text);
  } catch (err) {
    console.warn('[AiPptDeck] AI 문구 다듬기 실패 — 결정적 deck 그대로 사용:', err.message);
  }

  return mergeDecksWithPolish(baseDeck, polished);
}

// 포트폴리오 데이터에서 슬라이드를 결정적으로 빌드
function buildDeckFromPortfolio(p) {
  const slides = [];
  const userName = p.userName || '';
  const target = `${p.targetCompany || ''} ${p.targetPosition || ''}`.trim();

  // 1. 표지
  slides.push({
    id: 's1', layout: 'cover',
    title: p.title || `${userName} 포트폴리오`,
    subtitle: target || (p.headline || ''),
  });

  // 2. 프로필
  const profileBullets = [];
  if (userName) profileBullets.push(`이름 · ${userName}`);
  if (p.userBirth) profileBullets.push(`생년 · ${p.userBirth}`);
  if (p.userAddress) profileBullets.push(`거주 · ${p.userAddress}`);
  if (p.contact?.email) profileBullets.push(`Email · ${p.contact.email}`);
  if (p.contact?.phone) profileBullets.push(`Phone · ${p.contact.phone}`);
  if (p.contact?.website || p.contact?.linkedin) profileBullets.push(`Web · ${p.contact.website || p.contact.linkedin}`);
  if (profileBullets.length) {
    slides.push({ id: `s${slides.length + 1}`, layout: 'profile', title: 'Profile', subtitle: target || '', bullets: profileBullets });
  }

  // 3. 교육
  const education = Array.isArray(p.education) ? p.education : [];
  if (education.length) {
    slides.push({
      id: `s${slides.length + 1}`, layout: 'education', title: 'Education',
      items: education.slice(0, 3).map(e => ({
        heading: e.school || e.name || '',
        period: e.period || '',
        role: e.degree || e.major || '',
        body: e.major || e.description || '',
        bullets: Array.isArray(e.bullets) ? e.bullets : [],
        metrics: [],
      })),
    });
  }

  // 4. 경험: 1슬라이드당 1프로젝트
  const experiences = Array.isArray(p.experiences) ? p.experiences : [];
  experiences.slice(0, 6).forEach((e, idx) => {
    const sr = e.structuredResult || e.frameworkContent || {};
    const ov = sr.projectOverview || {};
    const heading = e.company || e.title || `프로젝트 ${idx + 1}`;
    const period = ov.duration || e.period || '';
    const role = ov.role || e.role || '';
    const body = e.description || sr.intro || sr.overview || ov.summary || e.detail || '';

    // bullets: experience.bullets > sections content > keyExperiences result
    let itemBullets = [];
    if (Array.isArray(e.bullets) && e.bullets.length) itemBullets = e.bullets.slice(0, 5);
    else if (Array.isArray(e.sections)) itemBullets = e.sections.slice(0, 4).map(s => s.title || s.content).filter(Boolean);

    const keyExps = Array.isArray(sr.keyExperiences) ? sr.keyExperiences : [];
    const metrics = keyExps.slice(0, 3).map(k => ({
      label: k.metricLabel || k.title || '',
      value: k.metric || '',
      before: k.beforeMetric || '',
      after: k.afterMetric || '',
    })).filter(m => m.label || m.value);

    // keyExperiences가 있고 itemBullets가 비면 result/action에서 채움
    if (!itemBullets.length && keyExps.length) {
      itemBullets = keyExps.slice(0, 4).map(k => k.result || k.action || k.title).filter(Boolean);
    }

    slides.push({
      id: `s${slides.length + 1}`, layout: 'experience',
      title: `핵심 경험: ${heading}`,
      subtitle: role || period,
      items: [{ heading, period, role, body, bullets: itemBullets, metrics }],
    });
  });

  // 5. 기술
  const skills = p.skills || {};
  const techBullets = [];
  ['languages', 'frameworks', 'tools', 'others'].forEach(cat => {
    const arr = Array.isArray(skills[cat]) ? skills[cat] : [];
    if (arr.length) {
      const labels = { languages: 'Languages', frameworks: 'Frameworks', tools: 'Tools', others: 'Others' };
      const names = arr.slice(0, 6).map(s => typeof s === 'string' ? s : s.name).filter(Boolean).join(', ');
      if (names) techBullets.push(`${labels[cat]} · ${names}`);
    }
  });
  if (techBullets.length) {
    slides.push({ id: `s${slides.length + 1}`, layout: 'skills', title: 'Skills', bullets: techBullets });
  }

  // 6. 수상
  const awards = Array.isArray(p.awards) ? p.awards : [];
  if (awards.length) {
    slides.push({
      id: `s${slides.length + 1}`, layout: 'awards', title: 'Awards',
      bullets: awards.slice(0, 6).map(a => {
        if (typeof a === 'string') return a;
        const parts = [a.name || a.title, a.issuer, a.date || a.period].filter(Boolean);
        return parts.join(' · ');
      }),
    });
  }

  // 7. 가치관
  const values = p.values || p.valuesEssay || p.about;
  if (values && String(values).trim()) {
    const trimmed = String(values).trim();
    const sentences = trimmed.split(/[\.!?。\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
    slides.push({
      id: `s${slides.length + 1}`, layout: 'values', title: 'Values',
      bullets: sentences.length ? sentences : [trimmed.slice(0, 200)],
    });
  }

  // 8. 마무리
  slides.push({
    id: `s${slides.length + 1}`, layout: 'closing',
    title: 'Thank You',
    subtitle: userName,
    bullets: [
      p.contact?.email ? `Email · ${p.contact.email}` : null,
      p.contact?.phone ? `Phone · ${p.contact.phone}` : null,
      p.contact?.website ? `Web · ${p.contact.website}` : null,
    ].filter(Boolean),
  });

  return {
    meta: { title: p.title || `${userName} 포트폴리오`, subtitle: target, accentColor: '#0F172A' },
    slides,
  };
}

// AI가 다듬은 문구로 baseDeck를 덮어쓰되, 비어있으면 base 유지
function mergeDecksWithPolish(baseDeck, polished) {
  if (!polished || !Array.isArray(polished.slides)) return baseDeck;

  const polishedById = new Map();
  polished.slides.forEach((s, i) => {
    polishedById.set(s.id || `s${i + 1}`, s);
  });

  const slides = baseDeck.slides.map(b => {
    const p = polishedById.get(b.id);
    if (!p) return b;

    const mergedBullets = (Array.isArray(p.bullets) && p.bullets.length)
      ? p.bullets.map(x => String(x).slice(0, 120)).slice(0, 8)
      : b.bullets || [];

    const mergedItems = (Array.isArray(p.items) && p.items.length)
      ? p.items.map((pit, idx) => {
          const bit = (b.items || [])[idx] || {};
          return {
            heading: String(pit.heading || bit.heading || '').slice(0, 60),
            period: String(pit.period || bit.period || '').slice(0, 40),
            role: String(pit.role || bit.role || '').slice(0, 60),
            body: String(pit.body || bit.body || '').slice(0, 200),
            bullets: Array.isArray(pit.bullets) && pit.bullets.length
              ? pit.bullets.map(x => String(x).slice(0, 120)).slice(0, 6)
              : (bit.bullets || []),
            metrics: Array.isArray(pit.metrics) && pit.metrics.length
              ? pit.metrics.slice(0, 4).map(m => ({
                  label: String(m.label || '').slice(0, 40),
                  value: String(m.value || '').slice(0, 30),
                  before: m.before ? String(m.before).slice(0, 20) : '',
                  after: m.after ? String(m.after).slice(0, 20) : '',
                })).filter(m => m.label || m.value)
              : (bit.metrics || []),
          };
        })
      : (b.items || []);

    return {
      id: b.id,
      layout: b.layout,
      title: String(p.title || b.title || '').slice(0, 80),
      subtitle: String(p.subtitle || b.subtitle || '').slice(0, 120),
      bullets: mergedBullets,
      items: mergedItems,
      notes: p.notes ? String(p.notes).slice(0, 200) : '',
    };
  });

  return {
    meta: { ...baseDeck.meta, ...(polished.meta || {}) },
    slides,
  };
}

export async function reviseAiPptSlide({ slide, instruction, portfolio }) {
  const prompt = buildAiPptRevisePrompt({ slide, instruction, portfolio });
  const text = await withTimeout(callProFirst(prompt, 'AiPptRevise'), 60000, 'AiPptRevise');
  const parsed = parseJSON(text);
  return {
    id: slide.id,
    layout: parsed.layout || slide.layout,
    title: String(parsed.title || slide.title || '').slice(0, 80),
    subtitle: parsed.subtitle ? String(parsed.subtitle).slice(0, 120) : (slide.subtitle || ''),
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(b => String(b).slice(0, 120)).slice(0, 8) : (slide.bullets || []),
    items: Array.isArray(parsed.items) ? parsed.items.slice(0, 4).map(it => ({
      heading: String(it.heading || '').slice(0, 60),
      period: String(it.period || '').slice(0, 40),
      role: String(it.role || '').slice(0, 60),
      body: String(it.body || '').slice(0, 200),
      bullets: Array.isArray(it.bullets) ? it.bullets.map(b => String(b).slice(0, 120)).slice(0, 6) : [],
    })) : (slide.items || []),
    notes: parsed.notes ? String(parsed.notes).slice(0, 200) : (slide.notes || ''),
  };
}
