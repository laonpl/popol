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
  buildPortfolioDistillPrompt,
  buildValidatePortfolioPrompt,
  buildMatchSectionsPrompt,
  buildAiPptAnalyzePrompt,
  buildAiPptRevisePrompt,
  buildThemedPortfolioPrompt,
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

/**
 * Yoopta JSON ({ [uuid]: { type, value, meta:{order} } }) | 레거시 [{type,content}] | 문자열
 * → 정렬된 블록 배열로 정규화. 각 블록: { kind, depth, text, items[], image }
 *   kind: 'heading' | 'paragraph' | 'bullet' | 'numbered' | 'quote' | 'image' | 'text'
 */
function normalizeBlocks(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    return value.split('\n').filter(Boolean).map(text => ({ kind: 'paragraph', depth: 0, text }));
  }
  // 레거시 배열 ([{type:'text', content}, {type:'image', content/base64}])
  if (Array.isArray(value)) {
    return value.map(b => {
      if (!b || typeof b !== 'object') return null;
      if (b.type === 'image') return { kind: 'image', depth: 0, text: '', image: b.content || b.src || b.base64 || '' };
      const text = String(b.content || b.text || '').trim();
      if (!text) return null;
      return { kind: 'text', depth: 0, text };
    }).filter(Boolean);
  }
  // Yoopta JSON: UUID 키 → block dict
  if (typeof value === 'object') {
    const items = Object.values(value).filter(b => b && typeof b === 'object' && (b.value || b.children || b.type));
    items.sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0));
    return items.map(b => {
      const type = String(b.type || 'Paragraph');
      // Yoopta value: [{ id, type, props?, children:[{text,...}|{type:'image',props:{src}}] }, ...]
      const elements = Array.isArray(b.value) ? b.value : [];
      // 이미지 요소 — Yoopta image plugin은 props.src 에 base64 / URL 저장
      const imageEl = elements.find(el => el?.type === 'image' || el?.props?.src);
      const imageSrc = imageEl?.props?.src || imageEl?.src || '';
      // 텍스트 요소들의 text leaves 합치기 — 한 블록 = 한 줄로 평탄화
      const textParts = [];
      for (const el of elements) {
        if (!el || el.type === 'image') continue;
        const children = Array.isArray(el.children) ? el.children : [];
        const t = children.map(c => (c && typeof c.text === 'string') ? c.text : '').join('');
        if (t.trim()) textParts.push(t);
      }
      const text = textParts.join(' ').replace(/\s+/g, ' ').trim();
      const depth = Number(b?.meta?.depth) || 0;
      if (imageSrc) return { kind: 'image', depth, text, image: imageSrc };
      if (/^Heading/i.test(type)) return { kind: 'heading', depth, text };
      if (/BulletedList/i.test(type)) return { kind: 'bullet', depth, text };
      if (/NumberedList/i.test(type)) return { kind: 'numbered', depth, text };
      if (/Blockquote|Quote/i.test(type)) return { kind: 'quote', depth, text };
      return { kind: 'paragraph', depth, text };
    }).filter(b => b.text || b.image);
  }
  return [];
}

/** 텍스트에서 정량 지표(수치+단위/기호) 한두 개를 뽑아낸다. 합격자 PPT의 'key_result' 톤. */
const METRIC_PATTERN = /(?:^|[^A-Za-z0-9])(?:[+\-±↑↓]?\s*\d{1,3}(?:[,.\d]*)\s*(?:%|배|번|회|건|명|분|시간|일|주|개월|년|만원?|억원?|원|km|kg|MAU|DAU|위|위권|↑|↓|%p|x|×|배|TPS|RPS|p95|p99))/gi;
function extractMetricsFromText(text) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  for (const m of String(text).matchAll(METRIC_PATTERN)) {
    // 앞뒤 공백/구두점 + 캡쳐 시작의 비단어 1글자 제거
    const cleaned = m[0].replace(/^[^\w+\-±↑↓]+/, '').trim();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
    if (out.length >= 4) break;
  }
  return out;
}

/** 정규화된 블록들 → 텍스트 라인 + 헤딩 기준 섹션/메트릭. AI 입력용. */
function flattenBlocksForAI(blocks, { lineCap = 12, sectionLabel = '' } = {}) {
  if (!blocks?.length) return { text: '', sections: [], metrics: [] };
  const allMetrics = new Set();
  const sections = [];
  let cur = { heading: sectionLabel || '', lines: [], metrics: [] };
  const flushIfNonEmpty = () => {
    if (cur.heading || cur.lines.length) sections.push(cur);
  };
  for (const b of blocks) {
    if (b.kind === 'image') {
      cur.lines.push('[이미지 첨부]');
      continue;
    }
    if (b.kind === 'heading') {
      flushIfNonEmpty();
      cur = { heading: b.text, lines: [], metrics: [] };
      continue;
    }
    const prefix = b.kind === 'bullet' ? '• ' : b.kind === 'numbered' ? '· ' : b.kind === 'quote' ? '> ' : '';
    cur.lines.push(prefix + b.text);
    const ms = extractMetricsFromText(b.text);
    ms.forEach(m => { cur.metrics.push(m); allMetrics.add(m); });
  }
  flushIfNonEmpty();

  const textLines = [];
  for (const sec of sections) {
    if (sec.heading) textLines.push(`## ${sec.heading}`);
    sec.lines.slice(0, lineCap).forEach(line => textLines.push(line));
  }
  return {
    text: textLines.slice(0, 40).join('\n'),
    sections,
    metrics: [...allMetrics].slice(0, 8),
  };
}

function collectPortfolioForPptx(portfolio = {}) {
  const lines = [
    `이름: ${portfolio.userName || ''}`,
    `희망 직무: ${portfolio.targetPosition || ''}`,
    `헤드라인: ${portfolio.headline || ''}`,
  ];

  const allMetrics = new Set();
  const narrativeSections = []; // { source, heading, lines[], metrics[] }
  const imagePresence = []; // { source, count }

  // Yoopta-/legacy-블록 필드 1개를 텍스트 + 섹션 + 메트릭으로 펼침
  const expandBlockField = (value, source, sectionLabel = '') => {
    const blocks = normalizeBlocks(value);
    if (!blocks.length) return '';
    const imgCount = blocks.filter(b => b.kind === 'image').length;
    if (imgCount) imagePresence.push({ source, count: imgCount });
    const flat = flattenBlocksForAI(blocks, { sectionLabel });
    flat.metrics.forEach(m => allMetrics.add(m));
    flat.sections.forEach(sec => narrativeSections.push({ source, heading: sec.heading, lines: sec.lines, metrics: sec.metrics }));
    return flat.text;
  };

  // 자기소개 — 노션형은 valuesEssayBlocks(Yoopta), 링크형은 about/valuesEssay 평문
  const introBlocks = expandBlockField(portfolio.valuesEssayBlocks, 'values', '자기소개/가치관');
  const introPlain = compactText(portfolio.about || portfolio.valuesEssay, 800);
  if (introBlocks) lines.push(`소개:\n${introBlocks}`);
  else if (introPlain) lines.push(`소개: ${introPlain}`);

  const skills = portfolio.skills || {};
  const skillText = [...(skills.languages || []), ...(skills.frameworks || []), ...(skills.tools || []), ...(skills.others || [])]
    .map(skill => typeof skill === 'string' ? skill : skill?.name)
    .filter(Boolean)
    .join(', ');
  if (skillText) lines.push(`기술/역량: ${skillText}`);

  // 경험별 구조화 브리프 — distill 단계가 STAR 채우기 쉽도록 프로젝트별로 분리한 결정적 요약
  const projectBriefs = [];
  const toStrArr = (v) => Array.isArray(v)
    ? v.map(x => typeof x === 'string' ? x : (x?.content || x?.text || JSON.stringify(x))).filter(Boolean)
    : v ? [String(v)] : [];

  (portfolio.experiences || []).slice(0, 12).forEach((exp, idx) => {
    const content = exp.frameworkContent || exp.structuredResult || exp.content || {};
    const ov = content?.projectOverview || {};
    const git = exp._git || {};
    const expTitle = exp.title || exp.company || exp.name || ov.name || `프로젝트 ${idx + 1}`;
    const role = exp.role || ov.role || '';
    const period = exp.period || exp.date || ov.duration || git.period || '';

    // 기술 스택 — 중복 제거, 다양한 위치에서 수집
    const stackSet = new Set();
    const collectStack = (raw) => {
      if (!raw) return;
      if (Array.isArray(raw)) {
        raw.forEach(s => {
          const v = typeof s === 'string' ? s : (s?.name || s?.label);
          if (v) stackSet.add(String(v).trim());
        });
      } else if (typeof raw === 'string') {
        raw.split(/[,，·•|/]\s*/).map(s => s.trim()).filter(Boolean).forEach(v => stackSet.add(v));
      }
    };
    collectStack(ov.techStack);
    collectStack(exp.techStack);
    collectStack(exp.skills);
    collectStack(exp.tags);
    collectStack(exp.keywords);
    collectStack(git.core_tech_stack);
    const techStack = [...stackSet].slice(0, 12);

    // 핵심 경험(keyExperiences) — 사용자가 직접 작성한 STAR 형식의 경험 구조화 데이터.
    // 합격자 PPT 디테일의 핵심 소스. metric/metricLabel/beforeMetric/afterMetric/context/action/result/learning 보존.
    const keyExperiences = (Array.isArray(content?.keyExperiences) ? content.keyExperiences : [])
      .filter(it => it && (it.title || it.metric || it.action || it.context || it.result))
      .slice(0, 4)
      .map(it => ({
        title: compactText(it.title, 60),
        metricLabel: compactText(it.metricLabel, 30),
        metric: compactText(it.metric, 30),
        beforeMetric: compactText(it.beforeMetric, 30),
        afterMetric: compactText(it.afterMetric, 30),
        context: compactText(it.context, 280),
        action: compactText(it.action, 280),
        result: compactText(it.result, 240),
        learning: compactText(it.learning, 200),
        keywords: Array.isArray(it.keywords) ? it.keywords.slice(0, 5).map(k => compactText(k, 30)).filter(Boolean) : [],
      }));

    // 문제 정의 — 명시적 problem_definition 우선, keyExperience.context 도 포함
    const problemLines = [
      ...toStrArr(exp.problem_definition),
      ...toStrArr(git.problem_definition),
      ...toStrArr(exp.context),
      ...toStrArr(content?.problem),
      ...keyExperiences.map(ke => ke.context).filter(Boolean),
      ...(content?.intro ? [String(content.intro)] : []),
    ].map(s => compactText(s, 240)).filter(Boolean).slice(0, 5);

    // 행동/과정 — keyExperience.action 우선 반영
    const actionLines = [
      ...keyExperiences.map(ke => ke.action).filter(Boolean),
      ...toStrArr(exp.action),
      ...toStrArr(git.action_and_solution),
      ...toStrArr(git.code_changes),
      ...(content?.task ? [String(content.task)] : []),
      ...(content?.process ? [String(content.process)] : []),
    ].map(s => compactText(s, 260)).filter(Boolean).slice(0, 6);

    // 결과/성과 — keyExperience.result 와 metricLabel→metric 변환을 포함
    const keMetricLines = keyExperiences
      .filter(ke => ke.metric)
      .map(ke => {
        if (ke.metricLabel && ke.beforeMetric && ke.afterMetric) {
          return `${ke.metricLabel}: ${ke.beforeMetric} → ${ke.afterMetric}`;
        }
        if (ke.metricLabel) return `${ke.metricLabel} ${ke.metric}`;
        return ke.metric;
      });
    const resultLines = [
      ...keyExperiences.map(ke => ke.result).filter(Boolean),
      ...keMetricLines,
      ...toStrArr(exp.result),
      ...toStrArr(exp.impact),
      ...(content?.output ? [String(content.output)] : []),
      ...(exp.description && !content?.output ? [String(exp.description)] : []),
    ].map(s => compactText(s, 260)).filter(Boolean).slice(0, 6);

    // 배운점 — keyExperience.learning 포함
    const learningLines = [
      ...keyExperiences.map(ke => ke.learning).filter(Boolean),
      ...toStrArr(exp.learning),
      ...toStrArr(git.learning_items),
      ...toStrArr(git.troubleshooting),
      ...(content?.growth ? [String(content.growth)] : []),
      ...(content?.competency ? [String(content.competency)] : []),
    ].map(s => compactText(s, 220)).filter(Boolean).slice(0, 4);

    // 경험별 정량 지표 — keyExperience.metric 우선, metricLabel 과 함께 라벨된 형태도 포함
    const projectMetricSet = new Set();
    keyExperiences.forEach(ke => {
      if (ke.metric) {
        const labeled = ke.metricLabel ? `${ke.metricLabel} ${ke.metric}` : ke.metric;
        projectMetricSet.add(labeled);
      }
      if (ke.beforeMetric && ke.afterMetric) {
        projectMetricSet.add(`${ke.metricLabel || ''} ${ke.beforeMetric}→${ke.afterMetric}`.trim());
      }
    });
    [...problemLines, ...actionLines, ...resultLines, ...learningLines].forEach(t => {
      extractMetricsFromText(t).forEach(m => projectMetricSet.add(m));
    });
    const projectMetrics = [...projectMetricSet].filter(Boolean).slice(0, 6);
    projectMetrics.forEach(m => allMetrics.add(m));

    // 텍스트 브리프 — distill 프롬프트가 한눈에 STAR 매핑 가능하도록
    lines.push(`\n[경험 ${idx + 1}] ${expTitle}${role || period ? ` (${[role, period].filter(Boolean).join(' · ')})` : ''}`);
    if (techStack.length) lines.push(`기술스택: ${techStack.join(' · ')}`);
    if (problemLines.length) lines.push(`문제정의:\n${problemLines.map(l => `- ${l}`).join('\n')}`);
    if (actionLines.length) lines.push(`행동/과정:\n${actionLines.map(l => `- ${l}`).join('\n')}`);
    if (resultLines.length) lines.push(`결과:\n${resultLines.map(l => `- ${l}`).join('\n')}`);
    if (projectMetrics.length) lines.push(`정량 지표: ${projectMetrics.join(' · ')}`);
    if (learningLines.length) lines.push(`배운점: ${learningLines.join(' / ')}`);
    // 핵심 경험(case study) 구조 — metricLabel/before/after 등 PPT 강조 박스에 그대로 박힐 데이터
    if (keyExperiences.length) {
      lines.push(`핵심 경험(case studies):`);
      keyExperiences.forEach((ke, kIdx) => {
        const head = ke.title ? `- [${kIdx + 1}] ${ke.title}` : `- [${kIdx + 1}]`;
        lines.push(head);
        if (ke.metricLabel || ke.metric) {
          const ba = ke.beforeMetric && ke.afterMetric ? ` (${ke.beforeMetric} → ${ke.afterMetric})` : '';
          lines.push(`    metric: ${[ke.metricLabel, ke.metric].filter(Boolean).join(' = ')}${ba}`);
        }
        if (ke.context) lines.push(`    문제상황: ${ke.context}`);
        if (ke.action) lines.push(`    핵심행동: ${ke.action}`);
        if (ke.result) lines.push(`    결과: ${ke.result}`);
        if (ke.learning) lines.push(`    배운점: ${ke.learning}`);
      });
    }

    // frameworkContent 의 추가 자유 필드 (intro/description/aiSummary 가 위 문제정의/결과에 흡수되지 않은 경우)
    ['description', 'aiSummary'].forEach(key => {
      const v = content?.[key];
      if (!v) return;
      const txt = compactText(v, 400);
      if (txt && !problemLines.some(p => p.includes(txt.slice(0, 30))) && !resultLines.some(r => r.includes(txt.slice(0, 30)))) {
        lines.push(`${key === 'aiSummary' ? '요약' : '설명'}: ${txt}`);
        extractMetricsFromText(txt).forEach(m => allMetrics.add(m));
      }
    });

    // 사용자가 노션형 에디터로 작성한 섹션 본문 — heading 기반 narrative_sections 로도 들어가지만 텍스트에도 보존
    if (Array.isArray(exp.sections)) {
      exp.sections.slice(0, 4).forEach(section => {
        const blockText = expandBlockField(section.contentBlocks || section.blocks, `experiences[${idx}]`, `${expTitle} · ${section.title || '섹션'}`);
        const plain = compactText(section.content, 400);
        const body = blockText || plain;
        if (body) lines.push(`${section.title || '섹션'}:\n${body}`);
      });
    }

    projectBriefs.push({
      index: idx,
      title: expTitle,
      role,
      period,
      tech_stack: techStack,
      problem: problemLines,
      action: actionLines,
      result: resultLines,
      metrics: projectMetrics,
      learning: learningLines,
      key_experiences: keyExperiences,
    });
  });

  // 목표/계획 — descriptionBlocks (Yoopta)
  (portfolio.goals || []).slice(0, 8).forEach((g, i) => {
    const blockText = expandBlockField(g.descriptionBlocks, `goals[${i}]`, g.title || `목표 ${i + 1}`);
    const plain = compactText(g.description, 400);
    const body = blockText || plain;
    if (g.title || body) lines.push(`[목표 ${i + 1}] ${g.title || ''}\n${body}`.trim());
  });

  // 학력
  (portfolio.education || []).slice(0, 5).forEach((edu, idx) => {
    const parts = [edu.school || edu.name, edu.major, edu.degree, edu.period, edu.detail].filter(Boolean);
    if (parts.length) lines.push(`[학력 ${idx + 1}] ${compactText(parts.join(' · '), 200)}`);
  });

  // 수상/자격
  (portfolio.awards || []).slice(0, 8).forEach((aw, idx) => {
    const parts = [aw.date, aw.title, aw.organization, aw.detail].filter(Boolean);
    if (parts.length) {
      const txt = compactText(parts.join(' · '), 200);
      lines.push(`[수상 ${idx + 1}] ${txt}`);
      extractMetricsFromText(txt).forEach(m => allMetrics.add(m));
    }
  });

  // 비교과 활동 — descriptionBlocks (Yoopta)
  const extra = portfolio.extracurricular || {};
  (extra.details || []).slice(0, 8).forEach((d, i) => {
    const blockText = expandBlockField(d.descriptionBlocks, `extracurricular[${i}]`, d.title || `활동 ${i + 1}`);
    const plain = compactText(d.description, 400);
    const body = blockText || plain;
    if (d.title || body) lines.push(`[활동 ${i + 1}] ${[d.title, d.period].filter(Boolean).join(' · ')}\n${body}`.trim());
  });

  // 관심사/가치관 — 합격자 PPT의 표지/마무리 슬라이드 톤 결정에 도움
  if (Array.isArray(portfolio.interests) && portfolio.interests.length) {
    lines.push(`관심사: ${compactText(portfolio.interests.join(', '), 200)}`);
  }

  // 노션형 자유 블록(customBlocks) — segments(텍스트/이미지 섞임) 또는 단일 content
  (portfolio.customBlocks || []).slice(0, 8).forEach((cb, i) => {
    if (cb?.type === 'image' || (cb?.content && /^data:image|^https?:.*\.(png|jpe?g|gif|webp)/i.test(String(cb.content)))) {
      imagePresence.push({ source: `customBlocks[${i}]`, count: 1 });
      return;
    }
    if (Array.isArray(cb?.segments)) {
      const txt = cb.segments.filter(s => s?.type === 'text').map(s => s.content).filter(Boolean).join('\n');
      if (txt) {
        lines.push(`[커스텀 ${i + 1}] ${compactText(txt, 500)}`);
        extractMetricsFromText(txt).forEach(m => allMetrics.add(m));
      }
      if (cb.segments.some(s => s?.type === 'image')) imagePresence.push({ source: `customBlocks[${i}]`, count: 1 });
      return;
    }
    if (typeof cb?.content === 'string' && cb.content.trim()) {
      const txt = compactText(cb.content, 500);
      lines.push(`[커스텀 ${i + 1}] ${txt}`);
      extractMetricsFromText(txt).forEach(m => allMetrics.add(m));
    }
  });

  // 사용자 정의 섹션(링크형 포트폴리오의 자유 섹션)
  (portfolio.customSections || portfolio.sections || []).slice(0, 6).forEach((sec, idx) => {
    const title = sec.title || sec.label || `섹션 ${idx + 1}`;
    const body = sec.content || sec.body || sec.description;
    if (body) lines.push(`[자유섹션 ${idx + 1}] ${title}: ${compactText(body, 400)}`);
  });

  const contact = portfolio.contact || {};
  const contactText = [contact.email, contact.phone, contact.github, contact.website || contact.linkedin || contact.instagram].filter(Boolean).join(' / ');
  if (contactText) lines.push(`연락처: ${contactText}`);

  // 추가 링크(블로그/노션/링크인 등)
  if (Array.isArray(portfolio.links) && portfolio.links.length) {
    const linkText = portfolio.links.slice(0, 6).map(l => l?.url || l?.href || (typeof l === 'string' ? l : '')).filter(Boolean).join(' / ');
    if (linkText) lines.push(`링크: ${linkText}`);
  }

  // AI 가시 영역에 핵심 지표·이미지 가용성 요약 추가 → 합격자 PPT 'key_result' 추출이 쉬워짐
  if (allMetrics.size) lines.push(`\n[핵심 지표 후보] ${[...allMetrics].slice(0, 12).join(' · ')}`);
  if (imagePresence.length) {
    const imgSummary = imagePresence.slice(0, 6).map(p => `${p.source}×${p.count}`).join(', ');
    lines.push(`[첨부 이미지] ${imgSummary}`);
  }

  return {
    text: lines.filter(line => line && !/:\s*$/.test(line)).join('\n'),
    keyMetrics: [...allMetrics].slice(0, 12),
    narrativeSections: narrativeSections.slice(0, 16),
    projectBriefs: projectBriefs.slice(0, 8),
    hasImages: imagePresence.length > 0,
  };
}

/**
 * Stage 1: 링크형 포트폴리오 → 합격자 PPT 콘텐츠 팩 + 슬라이드 슬롯 계획.
 * 디자인과 분리된 순수 콘텐츠 추출 단계.
 */
function ensureContentPackSafety(pack, portfolio, slideCount, extras = {}) {
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

  // 결정적 projectBriefs 와 AI 결과를 머지: AI 가 빠뜨린 problem/tech_stack/metrics 를 보강해
  // 각 프로젝트 슬라이드에 "문제 → 행동 → 결과 → 기술스택" 이 빠짐없이 들어가게 한다.
  const briefs = Array.isArray(extras.projectBriefs) ? extras.projectBriefs : [];
  if (briefs.length) {
    const merged = briefs.map((brief, i) => {
      const aiProj = safe.projects[i] || {};
      const aiTech = Array.isArray(aiProj.tech_stack) ? aiProj.tech_stack.map(s => String(s).trim()).filter(Boolean) : [];
      const briefTech = Array.isArray(brief.tech_stack) ? brief.tech_stack : [];
      const tech_stack = [...new Set([...aiTech, ...briefTech])].slice(0, 10);

      const aiAction = Array.isArray(aiProj.action) ? aiProj.action.filter(Boolean) : [];
      const aiResult = Array.isArray(aiProj.result) ? aiProj.result.filter(Boolean) : [];

      // problem: AI가 string 으로 줬으면 첫 줄로, 비었으면 brief.problem 첫 줄
      const aiProblem = typeof aiProj.problem === 'string' ? aiProj.problem
        : (typeof aiProj.situation === 'string' ? aiProj.situation : '');
      const problem = (aiProblem || brief.problem?.[0] || '').trim();

      return {
        title: aiProj.title || brief.title,
        role_period: aiProj.role_period || [brief.role, brief.period].filter(Boolean).join(' · '),
        tech_stack,
        problem,
        situation: aiProj.situation || problem,
        task: aiProj.task || (brief.problem?.[1] || ''),
        action: aiAction.length ? aiAction.slice(0, 6) : brief.action.slice(0, 6),
        result: aiResult.length ? aiResult.slice(0, 6) : brief.result.slice(0, 6),
        metrics: Array.isArray(aiProj.metrics) && aiProj.metrics.length ? aiProj.metrics : brief.metrics,
        learning: aiProj.learning || brief.learning?.[0] || '',
        // 결정적 keyExperiences 는 AI 가 생성하지 않음 — brief 에서만 채움 (사용자가 직접 작성한 STAR 케이스)
        key_experiences: brief.key_experiences || [],
      };
    });
    // AI 가 더 많이 만들었으면 뒤쪽 항목도 살림
    if (safe.projects.length > briefs.length) {
      merged.push(...safe.projects.slice(briefs.length));
    }
    safe.projects = merged;
  }

  // 결정적으로 추출된 정량 지표가 있으면 contentPack에 보강 (AI가 만들지 않음 — 합격자 PPT 'key_result' 톤 보장)
  const ensured = new Set(Array.isArray(safe.key_metrics) ? safe.key_metrics.map(s => String(s).trim()).filter(Boolean) : []);
  (extras.keyMetrics || []).forEach(m => { if (m) ensured.add(String(m).trim()); });
  safe.key_metrics = [...ensured].slice(0, 8);

  // narrative_sections — heading 기준으로 그룹화된 원본 섹션. 매핑 단계에서 제목/본문 매핑 정확도↑
  if (!Array.isArray(safe.narrative_sections) && Array.isArray(extras.narrativeSections)) {
    safe.narrative_sections = extras.narrativeSections.slice(0, 12).map(sec => ({
      source: sec.source || '',
      heading: sec.heading || '',
      lines: (sec.lines || []).slice(0, 6),
      metrics: (sec.metrics || []).slice(0, 3),
    }));
  }
  return safe;
}

async function distillPortfolioContentPack({ portfolio, slideCount, designTokens = null }) {
  const collected = collectPortfolioForPptx(portfolio);
  const portfolioText = collected.text;
  const prompt = buildPortfolioDistillPrompt({
    portfolioText,
    slideCount,
    designTokens,
    keyMetrics: collected.keyMetrics,
    narrativeSections: collected.narrativeSections,
    projectBriefs: collected.projectBriefs,
    hasImages: collected.hasImages,
  });
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
  return {
    contentPack: ensureContentPackSafety(raw, portfolio, slideCount, {
      keyMetrics: collected.keyMetrics,
      narrativeSections: collected.narrativeSections,
      projectBriefs: collected.projectBriefs,
    }),
    portfolioText,
  };
}

/**
 * 테마 기반 전문가 포트폴리오 생성.
 * popoldesign.md 의 10가지 디자인 테마 프레임워크에 따라
 * visual_sections 배열을 AI로 생성한다.
 */
export async function generateThemedPortfolio({ themeId, experiencesData, portfolioMeta }) {
  if (!themeId || !Array.isArray(experiencesData)) {
    throw new Error('themeId 와 experiencesData 가 필요합니다.');
  }

  const prompt = buildThemedPortfolioPrompt({ themeId, experiencesData, portfolioMeta });
  console.log(`[ThemedPortfolio] 생성 시작: themeId=${themeId}, 경험 ${experiencesData.length}개`);

  const text = await withTimeout(
    callProFirst(prompt, 'ThemedPortfolio'),
    120000,
    'ThemedPortfolio'
  );

  // { visual_sections: [...] } 형태로 파싱
  let parsed;
  try {
    parsed = parseJSON(text, /\{[\s\S]*\}/);
  } catch {
    throw new Error('AI 테마 포트폴리오 응답 JSON 파싱 실패');
  }

  const visual_sections = Array.isArray(parsed.visual_sections) ? parsed.visual_sections : [];
  if (visual_sections.length === 0) {
    throw new Error('AI가 visual_sections 를 생성하지 못했습니다. 경험 데이터를 보강 후 재시도해주세요.');
  }

  console.log(`[ThemedPortfolio] ✓ 완료: ${visual_sections.length}개 섹션 생성`);
  return { visual_sections };
}
